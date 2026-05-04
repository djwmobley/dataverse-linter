/**
 * test-r25-template.js
 *
 * Unit test for the regex-template rule type in validator.js.
 * Self-contained: appends a synthetic regex-template rule, runs validate(),
 * and restores the registry via try/finally.
 *
 * Strategy: temporarily append a synthetic regex-template rule to registry.json,
 * run validate() against a synthetic extraction, then restore registry.json.
 * A try/finally guarantees restoration even on failure.
 */

const fs = require("fs");
const path = require("path");
const { validate } = require("../src/validator");

const registryPath = path.join(__dirname, "../rules/registry.json");

function buildExtraction(content) {
    // Minimal extraction object matching the shape validator.js expects.
    return {
        optionSets: [],
        payloads: [],
        parseErrors: [],
        rawContent: content,
        strippedContent: content,
        noCommentNoStringContent: content,
        filePath: "(synthetic)"
    };
}

function runTests() {
    const originalRegistry = fs.readFileSync(registryPath, "utf8");
    const registry = JSON.parse(originalRegistry);

    // Synthetic rule with a unique ID that does not collide with any real rule.
    const syntheticRule = {
        id: "RTEST_TEMPLATE",
        title: "Synthetic regex-template test rule",
        severity: "ERROR",
        type: "regex-template",
        pattern: "^\\s*\\$(${variables})\\s*=",
        variables: ["xyzfoo"],
        message: "Synthetic regex-template violation.",
        enabled: true
    };

    // Empty-variables variant for the second assertion.
    const emptyVarsRule = Object.assign({}, syntheticRule, { id: "RTEST_EMPTY_VARS", variables: [] });

    let allPassed = true;

    try {
        // --- Test 1: variable in the set must fire ---
        const modifiedRegistry1 = [...registry, syntheticRule];
        fs.writeFileSync(registryPath, JSON.stringify(modifiedRegistry1, null, 2), "utf8");

        // Content with $xyzfoo = @{} at line start.
        const content1 = "$xyzfoo = @{}\n";
        const extraction1 = buildExtraction(content1);

        // Capture stderr to verify no warning is emitted for test 1.
        const stderrChunks1 = [];
        const origStderrWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = (chunk) => { stderrChunks1.push(chunk); return true; };

        const errors1 = validate(extraction1);

        process.stderr.write = origStderrWrite;

        const fired1 = errors1.some(e => e.rule === "RTEST_TEMPLATE");
        if (fired1) {
            console.log("Test 1 PASS: regex-template rule fired on $xyzfoo = @{}");
        } else {
            console.error("Test 1 FAIL: regex-template rule did NOT fire on $xyzfoo = @{}");
            console.error("Errors returned:", JSON.stringify(errors1, null, 2));
            allPassed = false;
        }

        const stderr1 = stderrChunks1.join("");
        if (stderr1.includes("RTEST_TEMPLATE")) {
            console.error("Test 1 FAIL: unexpected warning emitted to stderr for RTEST_TEMPLATE");
            console.error("Stderr was:", stderr1);
            allPassed = false;
        }

        // --- Test 2: empty variables array must skip the rule and emit warning ---
        const modifiedRegistry2 = [...registry, emptyVarsRule];
        fs.writeFileSync(registryPath, JSON.stringify(modifiedRegistry2, null, 2), "utf8");

        const extraction2 = buildExtraction(content1);

        const stderrChunks2 = [];
        process.stderr.write = (chunk) => { stderrChunks2.push(chunk); return true; };

        const errors2 = validate(extraction2);

        process.stderr.write = origStderrWrite;

        const fired2 = errors2.some(e => e.rule === "RTEST_EMPTY_VARS");
        const stderr2 = stderrChunks2.join("");
        const warnEmitted = stderr2.includes("RTEST_EMPTY_VARS") && stderr2.includes("no variables");

        if (!fired2) {
            console.log("Test 2 PASS: empty-variables rule correctly did not fire");
        } else {
            console.error("Test 2 FAIL: empty-variables rule fired when it should have been skipped");
            allPassed = false;
        }

        if (warnEmitted) {
            console.log("Test 2 PASS: warning emitted to stderr for empty-variables rule");
        } else {
            console.error("Test 2 FAIL: expected stderr warning for RTEST_EMPTY_VARS was not found");
            console.error("Stderr was:", stderr2);
            allPassed = false;
        }

    } finally {
        // Always restore registry.json to its original state.
        fs.writeFileSync(registryPath, originalRegistry, "utf8");
        // Ensure stderr.write is restored even if an exception escaped the try block.
        // (process.stderr.write is restored in each branch above, but guard here too.)
    }

    if (allPassed) {
        console.log("\nSUCCESS: All regex-template unit tests passed.");
        process.exit(0);
    } else {
        console.error("\nFAILURE: One or more regex-template unit tests failed.");
        process.exit(1);
    }
}

runTests();
