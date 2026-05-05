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
        // R16 removed: rule deleted by design (does not catch a real failure mode).
        // R21, R24, R28 promoted to ERROR (severity change only; still fire).
        const expectedRules = [
            'R07', 'R12', 'R13', 'R18', 'R21', 'R24', 'R25', 'R26', 'R28',
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
            const knownValidRules = [
                ...expectedRules,
                'schema-entity-not-found', 'R29', 'R31', 'module-env-mismatch',
                'R32', 'R33', 'R34', 'R35', 'R36'
            ];
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
        // R16 was deleted (does not catch a real failure mode; ERROR-or-delete principle).
        // R28 still fires: the script has no real idempotency guard, and comment-bypass
        // text cannot satisfy the noCommentNoStringContent check for regex-inverse rules.
        mustFire: ['R28'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-comment-bypass-trailing.ps1'),
        label: 'probe-comment-bypass-trailing',
        // R16 was deleted. R28 fires because trailing-comment, block-comment, and
        // string-literal bypass shapes for if ($null -eq) are rejected by noCommentNoStringContent.
        // R28 is now ERROR (promoted from WARN).
        mustFire: ['R28'],
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
        // v0.3.1: R12 is now conjunction-aware and ALSO suppresses when the guard is
        // present, so this probe is now CLEAN. (Was expectClean: false in v0.3.0 because
        // R12 fired unconditionally.) Regression anchor for the R12 refinement.
        mustFire: [],
        mustNotFire: ['module-env-mismatch', 'R12'],
        expectClean: true
    },

    // =========================================================================
    // R32 — Connect-PnPOnline -TenantId (wrong parameter name)
    // Citation: https://pnp.github.io/powershell/cmdlets/Connect-PnPOnline.html
    // =========================================================================
    {
        file: path.join(__dirname, 'probe-R32-basic-trigger.ps1'),
        label: 'probe-R32-basic-trigger',
        // Minimal trigger: Connect-PnPOnline -TenantId on one line.
        // -TenantId is not a parameter on Connect-PnPOnline; -Tenant is.
        // R32 MUST fire.
        mustFire: ['R32'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-R32-correct-tenant.ps1'),
        label: 'probe-R32-correct-tenant',
        // Clean path: Connect-PnPOnline with -Tenant (correct param). R32 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R32'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R32-singlequote-arg.ps1'),
        label: 'probe-R32-singlequote-arg',
        // Trigger probe with single-quoted args between Connect-PnPOnline and -TenantId.
        // PnP examples idiomatically use single-quoted strings; the original [^'\n]* pattern
        // terminated at the first single quote and missed this case. The widened [^\n]*
        // pattern catches it. R32 MUST fire.
        mustFire: ['R32'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-R32-tenantid-inline-comment.ps1'),
        label: 'probe-R32-tenantid-inline-comment',
        // DOCUMENTED FALSE POSITIVE: -TenantId appears in a trailing inline comment on
        // the same line as a correct Connect-PnPOnline call. The pattern [^\n]* spans
        // through the comment before the newline. R32 fires even though the code is correct.
        // This probe anchors the known limitation as a regression anchor.
        // EXPECTED: R32 fires (false positive accepted in exchange for catching the
        // single-quoted-arg case via [^\n]* widening).
        mustFire: ['R32'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-R32-different-cmdlet-tenantid.ps1'),
        label: 'probe-R32-different-cmdlet-tenantid',
        // Connect-AzAccount -TenantId is legitimate (Azure cmdlets use -TenantId).
        // R32 anchors on Connect-PnPOnline. R32 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R32'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R32-multiline-backtick.ps1'),
        label: 'probe-R32-multiline-backtick',
        // DOCUMENTED FALSE NEGATIVE: -TenantId on the next line after a backtick continuation.
        // The pattern stops at \n so the continuation line is not captured.
        // R32 does NOT fire (known false negative for backtick-continuation form).
        mustFire: [],
        mustNotFire: ['R32'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R32-case-insensitive-miss.ps1'),
        label: 'probe-R32-case-insensitive-miss',
        // DOCUMENTED FALSE NEGATIVE: CONNECT-PNPONLINE -TENANTID (all uppercase).
        // The R32 regex uses "gm" flags (no 'i'). PowerShell is case-insensitive but
        // the linter regex is not. Uppercase cmdlet + param bypasses detection.
        // R32 does NOT fire (known false negative for uppercase variants).
        mustFire: [],
        mustNotFire: ['R32'],
        expectClean: true
    },

    // =========================================================================
    // R33 — Publish-PnPPage does not exist in PnP.PowerShell 3.x
    // Citation: https://pnp.github.io/powershell/cmdlets/Set-PnPPage.html
    // =========================================================================
    {
        file: path.join(__dirname, 'probe-R33-basic-trigger.ps1'),
        label: 'probe-R33-basic-trigger',
        // Minimal trigger: Publish-PnPPage -Identity "Home.aspx".
        // Replacement: Set-PnPPage -Identity <name> -Publish. R33 MUST fire.
        mustFire: ['R33'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-R33-set-pnppage-correct.ps1'),
        label: 'probe-R33-set-pnppage-correct',
        // Clean path: uses Set-PnPPage -Publish (documented 3.x replacement).
        // R33 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R33'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R33-in-comment.ps1'),
        label: 'probe-R33-in-comment',
        // Publish-PnPPage appears only on a full-line # comment.
        // strippedContent strips full-line comments; R33 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R33'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R33-publish-other-cmdlet.ps1'),
        label: 'probe-R33-publish-other-cmdlet',
        // Publish-PnPFile (a different cmdlet). Word-boundary \b prevents partial matches.
        // R33 MUST NOT fire on Publish-PnPFile.
        mustFire: [],
        mustNotFire: ['R33'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R33-inline-comment-false-positive.ps1'),
        label: 'probe-R33-inline-comment-false-positive',
        // DOCUMENTED FALSE POSITIVE: Publish-PnPPage in a trailing inline comment after
        // correct code. strippedContent retains inline comments so R33 fires on comment text.
        // EXPECTED: R33 fires (false positive; inline comments not stripped by strippedContent).
        mustFire: ['R33'],
        mustNotFire: [],
        expectClean: false
    },

    // =========================================================================
    // R34 — pac install is not a valid pac command group
    // Citation: https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/
    // =========================================================================
    {
        file: path.join(__dirname, 'probe-R34-basic-trigger.ps1'),
        label: 'probe-R34-basic-trigger',
        // "pac install latest" — a common hallucination. pac has no "install" command group.
        // R34 MUST fire.
        mustFire: ['R34'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-R34-application-install.ps1'),
        label: 'probe-R34-application-install',
        // "pac application install" is correct. "application" separates pac from install
        // so \bpac\s+install\b does not match. R34 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R34'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R34-pac-solution-install.ps1'),
        label: 'probe-R34-pac-solution-install',
        // "pac solution import" has no "install" word. R34 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R34'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R34-install-in-string.ps1'),
        label: 'probe-R34-install-in-string',
        // DOCUMENTED FALSE POSITIVE: "pac install" inside a Write-Host string literal.
        // strippedContent does not strip string content, so R34 fires on the string.
        // EXPECTED: R34 fires (false positive; strings not stripped from strippedContent).
        mustFire: ['R34'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-R34-pac-install-module.ps1'),
        label: 'probe-R34-pac-install-module',
        // Install-Module has no "pac" prefix. \bpac\s+install\b requires "pac" before "install".
        // R34 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R34'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R34-in-comment.ps1'),
        label: 'probe-R34-in-comment',
        // "pac install" on a full-line # comment. strippedContent strips full-line comments.
        // R34 MUST NOT fire when "pac install" is only in a comment.
        mustFire: [],
        mustNotFire: ['R34'],
        expectClean: true
    },

    // =========================================================================
    // R35 — [Parser]::ParseFile with both output args as [ref]$null
    // Citation: https://learn.microsoft.com/en-us/dotnet/api/system.management.automation.language.parser.parsefile
    // =========================================================================
    {
        file: path.join(__dirname, 'probe-R35-basic-trigger.ps1'),
        label: 'probe-R35-basic-trigger',
        // ParseFile($p, [ref]$null, [ref]$null): both output parameters discarded.
        // Caller cannot inspect tokens or parse errors. R35 MUST fire.
        mustFire: ['R35'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-R35-bound-variables.ps1'),
        label: 'probe-R35-bound-variables',
        // ParseFile with real $tokens and $errs variables (correct usage). R35 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R35'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R35-one-null-arg.ps1'),
        label: 'probe-R35-one-null-arg',
        // DOCUMENTED SCOPE LIMIT: only the tokens arg is [ref]$null; errors are captured.
        // R35 flags only when BOTH args are [ref]$null. Single-null is out of scope.
        // R35 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R35'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R35-whitespace-variants.ps1'),
        label: 'probe-R35-whitespace-variants',
        // Extra spaces around [ref]$null in the argument list. The pattern handles \s*.
        // R35 MUST fire even with extra whitespace.
        mustFire: ['R35'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-R35-parsestring-not-parsefile.ps1'),
        label: 'probe-R35-parsestring-not-parsefile',
        // [Parser]::ParseInput (different method). R35 anchors on "ParseFile".
        // R35 MUST NOT fire on ParseInput.
        mustFire: [],
        mustNotFire: ['R35'],
        expectClean: true
    },

    // =========================================================================
    // R36 — [datetime]::TryParse($s, [ref]$null) overload-resolution hazard
    // Citation: https://learn.microsoft.com/en-us/dotnet/api/system.datetime.tryparse
    // =========================================================================
    {
        file: path.join(__dirname, 'probe-R36-basic-trigger.ps1'),
        label: 'probe-R36-basic-trigger',
        // [datetime]::TryParse($s, [ref]$null): 2-arg form with discarded output.
        // Parsed DateTime unreachable; .NET 7+ may resolve wrong overload. R36 MUST fire.
        mustFire: ['R36'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-R36-as-operator.ps1'),
        label: 'probe-R36-as-operator',
        // $result = $s -as [datetime]: recommended replacement. R36 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R36'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R36-three-arg-form.ps1'),
        label: 'probe-R36-three-arg-form',
        // TryParse($s, $provider, [ref]$parsed): 3-arg form. Second arg is a real
        // $provider variable, not [ref]$null. R36 scope is 2-arg only. R36 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R36'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R36-bound-output-var.ps1'),
        label: 'probe-R36-bound-output-var',
        // [datetime]::TryParse($s, [ref]$parsedDate): 2-arg form with a real bound variable.
        // The correct usage. R36 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R36'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R36-tryparse-other-type.ps1'),
        label: 'probe-R36-tryparse-other-type',
        // [int]::TryParse($s, [ref]$null): different type. R36 anchors on [datetime].
        // R36 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R36'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R36-capitalized-type.ps1'),
        label: 'probe-R36-capitalized-type',
        // DOCUMENTED FALSE NEGATIVE: [DateTime]::TryParse (capital D).
        // The R36 pattern uses lowercase \[datetime\]; case-sensitive regex ("gm" flags, no 'i').
        // PowerShell type accelerators are case-insensitive, so [DateTime] is identical at
        // runtime, but the linter misses it. R36 does NOT fire (known false negative).
        mustFire: [],
        mustNotFire: ['R36'],
        expectClean: true
    },

    // =========================================================================
    // module-env-mismatch — Microsoft.Xrm.Data.PowerShell (new entry)
    // Citations: https://github.com/seanmcne/Microsoft.Xrm.Data.PowerShell
    //            https://learn.microsoft.com/en-us/power-apps/developer/data-platform/xrm-tooling/use-powershell-cmdlets-xrm-tooling-connect
    // =========================================================================
    {
        file: path.join(__dirname, 'probe-module-env-xrmdata-missing.ps1'),
        label: 'probe-module-env-xrmdata-missing',
        // Import-Module Microsoft.Xrm.Data.PowerShell without #Requires -PSEdition Desktop.
        // Desktop-only module; pwsh 7 silently exits at import. module-env-mismatch MUST fire.
        mustFire: ['module-env-mismatch'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-module-env-xrmdata-ok.ps1'),
        label: 'probe-module-env-xrmdata-ok',
        // Same import WITH #Requires -PSEdition Desktop (correct usage).
        // module-env-mismatch MUST NOT fire.
        mustFire: [],
        mustNotFire: ['module-env-mismatch'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-module-env-xrmdata-name-form.ps1'),
        label: 'probe-module-env-xrmdata-name-form',
        // Trigger probe with the explicit `Import-Module -Name <module>` form, missing
        // #Requires -PSEdition Desktop. The original import_pattern only matched
        // `Import-Module Microsoft.Xrm.Data.PowerShell` (no -Name); the widened
        // pattern accepts both forms. module-env-mismatch MUST fire.
        mustFire: ['module-env-mismatch'],
        mustNotFire: [],
        expectClean: false
    },

    // =========================================================================
    // v0.3.1 R12 conjunction-aware refinement
    // R12 fires only when (Connect-CrmOnlineDiscovery OR Xrm.Tooling import)
    // matches AND the rawContent does NOT contain
    //   '#Requires -Version 5.1'  or  '#Requires -PSEdition Desktop'.
    // Citations:
    //   - https://www.powershellgallery.com/packages/Microsoft.Xrm.Tooling.CrmConnector.PowerShell
    //     declares minimum PS version 5.1 and PSEdition Desktop.
    //   - https://learn.microsoft.com/en-us/power-apps/developer/data-platform/xrm-tooling/use-powershell-cmdlets-xrm-tooling-connect
    //     describes the cmdlets as "Windows PowerShell" cmdlets.
    //   - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_requires
    //     describes the #Requires directive forms.
    // =========================================================================
    {
        file: path.join(__dirname, 'probe-R12-cmdlet-no-guard.ps1'),
        label: 'probe-R12-cmdlet-no-guard',
        // True positive: cmdlet present, no #Requires guard. R12 MUST fire.
        mustFire: ['R12'],
        mustNotFire: [],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-R12-cmdlet-with-guard.ps1'),
        label: 'probe-R12-cmdlet-with-guard',
        // True negative for R12 specifically: cmdlet present WITH
        // #Requires -Version 5.1. R12 MUST NOT fire (the v0.3.1 conjunction
        // suppresses it when the guard is present). The probe is NOT
        // expectClean=true because module-env-mismatch fires independently:
        // its import_pattern in module-requirements.json includes
        // Connect-CrmOnlineDiscovery and its required directive is specifically
        // '#Requires -PSEdition Desktop' (not -Version 5.1). That's a separate
        // rule with its own contract; R12's contract is what's being asserted here.
        mustFire: [],
        mustNotFire: ['R12'],
        expectClean: false
    },
    {
        file: path.join(__dirname, 'probe-R12-cmdlet-with-desktop-guard.ps1'),
        label: 'probe-R12-cmdlet-with-desktop-guard',
        // True negative: cmdlet present WITH #Requires -PSEdition Desktop.
        // Both -Version 5.1 and -PSEdition Desktop are accepted as guards
        // (substrate-verified: PS Gallery declares PSEdition Desktop, MS Learn
        // describes the cmdlets as "Windows PowerShell" cmdlets). R12 MUST NOT fire.
        mustFire: [],
        mustNotFire: ['R12'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R12-no-cmdlet-no-guard.ps1'),
        label: 'probe-R12-no-cmdlet-no-guard',
        // Negative control: neither the trigger pattern nor the guard is present.
        // R12 MUST NOT fire (main pattern doesn't match).
        mustFire: [],
        mustNotFire: ['R12'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R12-cmdlet-in-string-with-guard.ps1'),
        label: 'probe-R12-cmdlet-in-string-with-guard',
        // True negative: cmdlet name appears only in a string literal, guard is
        // present. R12 MUST NOT fire (guard suppresses globally even if the
        // pattern matches the literal). Documents that string-literal cmdlet
        // mentions are benign once the guard is in place.
        mustFire: [],
        mustNotFire: ['R12'],
        expectClean: true
    },

    // =========================================================================
    // v0.3.1 R25 scope-aware refinement
    // R25 fires only on assignments at script scope (not inside any
    // `function NAME { ... }` body). Implementation: extractor.computeFunctionBodyRanges
    // walks the file and records [openBrace, closeBrace] index pairs for each
    // function declaration body; validator skips matches whose index lies inside
    // any range when rule.scope === "script-only".
    // Limitations documented in README: anonymous scriptblocks `$sb = { ... }`
    // are NOT tracked; matches inside an anonymous scriptblock still fire.
    // =========================================================================
    {
        file: path.join(__dirname, 'probe-R25-script-scope-body.ps1'),
        label: 'probe-R25-script-scope-body',
        // True positive: $body = ... at script scope (inside an `if` block, but
        // `if` is not a function declaration). R25 MUST fire.
        mustFire: ['R25'],
        mustNotFire: [],
        expectClean: false,
        exactFireCount: { 'R25': 1 }
    },
    {
        file: path.join(__dirname, 'probe-R25-function-local-body.ps1'),
        label: 'probe-R25-function-local-body',
        // True negative (regression anchor for the v0.3.1 fix): $body = ...
        // inside `function Create-LookupFromRow { ... }`. PowerShell function
        // bodies have their own variable scope; a function-local $body cannot
        // shadow $script:body, which is the failure mode R25 catches.
        // R25 MUST NOT fire. This anchors the false positive that caused
        // wire_cross_module_connections.ps1 v0.2 line 167 to be linted as a
        // violation under v0.3.0.
        mustFire: [],
        mustNotFire: ['R25'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R25-watch-name-prefixed.ps1'),
        label: 'probe-R25-watch-name-prefixed',
        // True negative: $script:body = ... at script scope. The explicit prefix
        // means there is no shadowing risk. R25 MUST NOT fire (the leading $
        // followed by 'script:' does not match the regex `^\\s*\\$(${variables})\\s*=`).
        mustFire: [],
        mustNotFire: ['R25'],
        expectClean: true
    },
    {
        file: path.join(__dirname, 'probe-R25-non-watch-name.ps1'),
        label: 'probe-R25-non-watch-name',
        // True negative: $widget at script scope, name not in the watch-list.
        // R25 MUST NOT fire (template variable substitution is exact).
        mustFire: [],
        mustNotFire: ['R25'],
        expectClean: true
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
// Hook tests: test-stop-hook.js and test-pretool-bash-hook.js
// ---------------------------------------------------------------------------
console.log("Running hook test: test-stop-hook.js...");
{
    const hookTestPath = path.join(__dirname, 'test-stop-hook.js');
    try {
        const out = execSync('node "' + hookTestPath + '"', { stdio: 'pipe' }).toString();
        console.log(out.trim());
        console.log("  test-stop-hook.js: PASS\n");
    } catch (e) {
        const out = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
        console.error(out.trim());
        console.error("  test-stop-hook.js: FAIL\n");
        overallPass = false;
    }
}

console.log("Running hook test: test-pretool-bash-hook.js...");
{
    const hookTestPath = path.join(__dirname, 'test-pretool-bash-hook.js');
    try {
        const out = execSync('node "' + hookTestPath + '"', { stdio: 'pipe' }).toString();
        console.log(out.trim());
        console.log("  test-pretool-bash-hook.js: PASS\n");
    } catch (e) {
        const out = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
        console.error(out.trim());
        console.error("  test-pretool-bash-hook.js: FAIL\n");
        overallPass = false;
    }
}

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
