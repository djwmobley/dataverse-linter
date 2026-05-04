const { execSync } = require('child_process');
const path = require('path');

const passScript = path.join(__dirname, 'battery-pass.ps1');
const failScript = path.join(__dirname, 'battery-fail.ps1');
const linter = path.join(__dirname, '../src/index.js');

// ---------------------------------------------------------------------------
// Helper: run linter against a file; return { exitCode, output }
// ---------------------------------------------------------------------------
function runLinter(filePath) {
    try {
        const out = execSync(`node "${linter}" "${filePath}"`, { stdio: 'pipe' }).toString();
        return { exitCode: 0, output: out };
    } catch (e) {
        return { exitCode: e.status || 1, output: (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '') };
    }
}

// ---------------------------------------------------------------------------
// Helper: extract all [RULEID] tokens from linter output
// ---------------------------------------------------------------------------
function extractRuleIds(output) {
    const re = /\[([A-Za-z0-9_-]+)\]/g;
    const ids = new Set();
    let m;
    while ((m = re.exec(output)) !== null) {
        ids.add(m[1]);
    }
    return ids;
}

let overallPass = true;

// ---------------------------------------------------------------------------
// Pass Battery
// ---------------------------------------------------------------------------
console.log("Running Pass Battery...");
{
    const { exitCode, output } = runLinter(passScript);
    if (exitCode !== 0) {
        console.error("Pass Battery FAILED. Expected success (exit 0).");
        console.error(output);
        overallPass = false;
    } else {
        console.log("Pass Battery: Success\n");
    }
}

// ---------------------------------------------------------------------------
// Fail Battery
// ---------------------------------------------------------------------------
console.log("Running Fail Battery...");
{
    const { exitCode, output } = runLinter(failScript);
    if (exitCode === 0) {
        console.error("Fail Battery FAILED. Expected linter to catch violations (exit 1).");
        overallPass = false;
    } else {
        const expectedRules = [
            'R07', 'R12', 'R13', 'R16', 'R18', 'R21', 'R24', 'R25', 'R26', 'R28',
            'extractor-json-error', 'odata-bind-guid', 'optionset-coverage', 'system-entity-cascade'
        ];

        let missing = [];
        expectedRules.forEach(rule => {
            if (!output.includes(`[${rule}]`)) {
                missing.push(rule);
            }
        });

        if (missing.length > 0) {
            console.error("Fail Battery missed the following expected rules:");
            console.error(missing.join(', '));
            console.error("\nActual output:");
            console.error(output);
            overallPass = false;
        } else {
            // Assert no unexpected rule IDs fired.
            const knownValidRules = [...expectedRules, 'schema-entity-not-found', 'R29', 'R31', 'module-env-mismatch'];
            const seenRules = extractRuleIds(output);
            const unexpected = [...seenRules].filter(r => !knownValidRules.includes(r));
            if (unexpected.length > 0) {
                console.error("Fail Battery fired UNEXPECTED rule IDs:");
                console.error(unexpected.join(', '));
                console.error("\nActual output:");
                console.error(output);
                overallPass = false;
            } else {
                console.log("Fail Battery: Caught ALL expected violations.\n");
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Probe fixtures
// Each entry declares:
//   file        — probe file path
//   label       — display name
//   mustFire    — rule IDs that MUST appear in output ([] = none required)
//   mustNotFire — rule IDs that must NOT appear in output ([] = no restriction)
//   expectClean — if true, linter must exit 0 (no violations at all)
// ---------------------------------------------------------------------------
const probes = [
    // --- Existing 8 probes ---
    {
        file: path.join(__dirname, 'probe-comment-bypass.ps1'),
        label: 'probe-comment-bypass',
        // The probe was originally written to document a bypass defect when using only
        // strippedContent for regex-inverse rules. The defect is now fixed: regex-inverse
        // rules use noCommentNoStringContent, so comment-hidden bypass text does not satisfy
        // them. R16 and R28 correctly fire (the script has no real Start-Transcript or guard).
        mustFire: ['R16', 'R28'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-comment-bypass-trailing.ps1'),
        label: 'probe-comment-bypass-trailing',
        // Same as probe-comment-bypass: trailing/block/string bypass shapes are also handled
        // by noCommentNoStringContent. R16 and R28 correctly fire.
        mustFire: ['R16', 'R28'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-here-string-singlequote.ps1'),
        label: 'probe-here-string-singlequote',
        // The probe was written to document that single-quote here-strings were not parsed.
        // The extractor now handles both @"..."@ and @'...'@ (payloadRegex uses both quote
        // types). The probe's single-quote payload is parsed; payload rules fire.
        // extractor-json-error fires (two: the single-quote body fails JSON.parse with '...'
        // placeholders from noCommentNoStringContent); R18, odata-bind-guid, optionset-coverage
        // also fire from the parsed payload.
        mustFire: ['extractor-json-error', 'R18', 'odata-bind-guid', 'optionset-coverage'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-unparseable-payload.ps1'),
        label: 'probe-unparseable-payload',
        // Payload with variable interpolation cannot be parsed; extractor-json-error fires.
        mustFire: ['extractor-json-error'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-r10-legitimate.ps1'),
        label: 'probe-r10-legitimate',
        // Legitimate componentType values — no R10 rule in registry, so clean.
        mustFire: [],
        mustNotFire: [],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-r24-line-continuation.ps1'),
        label: 'probe-r24-line-continuation',
        // Backtick continuation collapses to a space in normalizedContent.
        // R24 must NOT fire (--publish-changes is present on the same logical line).
        mustFire: [],
        mustNotFire: ['R24'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-r25-other-vars.ps1'),
        label: 'probe-r25-other-vars',
        // $client, $session, $config are not in default set; only $headers fires R25.
        mustFire: ['R25'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-system-entity-incomplete.ps1'),
        label: 'probe-system-entity-incomplete',
        // account IS in systemEntities; system-entity-cascade must fire.
        mustFire: ['system-entity-cascade'],
        mustNotFire: [],
        expectClean: false
    },

    // --- 5 new probes ---
    {
        file: path.join(__dirname, 'probe-r24-multi-import.ps1'),
        label: 'probe-r24-multi-import',
        // Two imports on separate lines, second has --publish-changes.
        // R24 must fire ONCE (on the first import). Prior false-negative probe.
        mustFire: ['R24'],
        mustNotFire: [],
        expectClean: false,
        exactFireCount: { 'R24': 1 }
    },
    {
        file: path.join(__dirname, 'probe-r24-pipe-terminator.ps1'),
        label: 'probe-r24-pipe-terminator',
        // pac solution import piped to Out-Null without --publish-changes. R24 must fire.
        mustFire: ['R24'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-r24-semicolon-terminator.ps1'),
        label: 'probe-r24-semicolon-terminator',
        // Two imports on one line, semicolon-separated; second has --publish-changes.
        // R24 must fire ONCE on the first call.
        mustFire: ['R24'],
        mustNotFire: [],
        expectClean: false,
        exactFireCount: { 'R24': 1 }
    },
    {
        file: path.join(__dirname, 'probe-r25-default-set.ps1'),
        label: 'probe-r25-default-set',
        // All six default variables assigned at script scope. R25 must fire SIX times.
        mustFire: ['R25'],
        mustNotFire: [],
        expectClean: false,
        exactFireCount: { 'R25': 6 }
    },
    {
        file: path.join(__dirname, 'probe-r25-non-default.ps1'),
        label: 'probe-r25-non-default',
        // $client, $session, $config are NOT in the default set. R25 must NOT fire.
        mustFire: [],
        mustNotFire: ['R25'],
        expectClean: true
    },

    // --- R29, R31, module-env-mismatch probes ---
    {
        file: path.join(__dirname, 'probe-r29-non-ascii-string.ps1'),
        label: 'probe-r29-non-ascii-string',
        // Em-dash (U+2014) inside a double-quoted string literal. R29 must fire.
        mustFire: ['R29'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-r29-non-ascii-comment.ps1'),
        label: 'probe-r29-non-ascii-comment',
        // Em-dash appears only in comments and single-quoted strings. R29 must NOT fire.
        mustFire: [],
        mustNotFire: ['R29'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-r31-bad-cmdlet.ps1'),
        label: 'probe-r31-bad-cmdlet',
        // Connect-CrmOnlineDiscovery with -ShowProgress (known-bad param). R31 must fire.
        // R12 and module-env-mismatch also fire; expectClean false.
        mustFire: ['R31'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-module-env-mismatch.ps1'),
        label: 'probe-module-env-mismatch',
        // Import-Module Xrm.Tooling without #Requires -PSEdition Desktop. Rule must fire.
        mustFire: ['module-env-mismatch'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-module-env-ok.ps1'),
        label: 'probe-module-env-ok',
        // Same import WITH #Requires -PSEdition Desktop. module-env-mismatch must NOT fire.
        // R12 still fires unconditionally; expectClean false.
        mustFire: [],
        mustNotFire: ['module-env-mismatch'],
        expectClean: false
    }
];

// ---------------------------------------------------------------------------
// Run probes
// ---------------------------------------------------------------------------
probes.forEach(probe => {
    console.log(`Running probe: ${probe.label}...`);
    const { exitCode, output } = runLinter(probe.file);
    let probePassed = true;

    // Check clean expectation
    if (probe.expectClean && exitCode !== 0) {
        console.error(`  FAIL: expected exit 0 (clean), got exit ${exitCode}`);
        console.error("  Output:", output);
        probePassed = false;
    } else if (!probe.expectClean && exitCode === 0) {
        console.error(`  FAIL: expected violations (exit 1), got exit 0`);
        console.error("  Output:", output);
        probePassed = false;
    }

    const seenRules = extractRuleIds(output);

    // Check mustFire
    (probe.mustFire || []).forEach(ruleId => {
        if (!seenRules.has(ruleId)) {
            console.error(`  FAIL: expected rule [${ruleId}] to fire but it did not`);
            console.error("  Output:", output);
            probePassed = false;
        }
    });

    // Check mustNotFire
    (probe.mustNotFire || []).forEach(ruleId => {
        if (seenRules.has(ruleId)) {
            console.error(`  FAIL: expected rule [${ruleId}] NOT to fire but it did`);
            console.error("  Output:", output);
            probePassed = false;
        }
    });

    // Check exactFireCount
    if (probe.exactFireCount) {
        Object.entries(probe.exactFireCount).forEach(([ruleId, expectedCount]) => {
            const re = new RegExp(`\\[${ruleId}\\]`, 'g');
            const matches = output.match(re);
            const actualCount = matches ? matches.length : 0;
            if (actualCount !== expectedCount) {
                console.error(`  FAIL: expected [${ruleId}] to fire ${expectedCount} time(s), got ${actualCount}`);
                console.error("  Output:", output);
                probePassed = false;
            }
        });
    }

    if (probePassed) {
        console.log(`  ${probe.label}: PASS\n`);
    } else {
        overallPass = false;
        console.error(`  ${probe.label}: FAIL\n`);
    }
});

// ---------------------------------------------------------------------------
// Unit test: test-r25-template.js
// ---------------------------------------------------------------------------
console.log("Running unit test: test-r25-template.js...");
{
    const unitTestPath = path.join(__dirname, 'test-r25-template.js');
    try {
        const out = execSync(`node "${unitTestPath}"`, { stdio: 'pipe' }).toString();
        console.log(out.trim());
        console.log("  test-r25-template.js: PASS\n");
    } catch (e) {
        const out = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
        console.error(out.trim());
        console.error("  test-r25-template.js: FAIL\n");
        overallPass = false;
    }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
if (overallPass) {
    console.log("All batteries, probes, and unit tests passed!");
    process.exit(0);
} else {
    console.error("One or more checks FAILED.");
    process.exit(1);
}
