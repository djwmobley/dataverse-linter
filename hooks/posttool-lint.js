#!/usr/bin/env node
// PostToolUse hook for Claude Code: runs the dataverse-linter on every
// .ps1 file written or edited via the Write/Edit tools, and surfaces
// violations back to the model via stderr + exit code 2.
//
// Wire-up: add a PostToolUse hook in ~/.claude/settings.json with
//   "matcher": "Write|Edit",
//   "command": "node C:/gemini/dataverse-linter/hooks/posttool-lint.js"
//
// Behavior:
//   - Reads Claude Code hook payload as JSON on stdin.
//   - Skips silently when tool_input.file_path is absent or non-.ps1.
//   - Skips silently when the file is inside this linter repo (so test
//     fixtures and intentionally-bad probes don't block linter dev work).
//   - Runs `node src/index.js <file>` against the file.
//   - Linter exit 0 -> hook exits 0 (silent pass).
//   - Linter non-zero -> hook strips ANSI, prints linter output to stderr,
//     and exits 2. Per the Claude Code hook contract, stderr on exit 2 is
//     fed back to the assistant as feedback so violations are addressed.

const { execFileSync } = require('child_process');
const path = require('path');

const LINTER_ROOT = path.resolve(__dirname, '..');
const LINTER_ENTRY = path.join(LINTER_ROOT, 'src', 'index.js');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
    let payload;
    try {
        payload = JSON.parse(raw);
    } catch (e) {
        // Malformed payload - don't block tool flow, but surface the failure
        // to stderr so the operator sees that the hook ran and bailed (a
        // silent skip would mask a real Claude Code hook contract change or
        // a serializer bug).
        process.stderr.write(`[dataverse-linter] hook payload was not valid JSON; skipping lint (${e.message})\n`);
        process.exit(0);
    }

    const toolInput = payload.tool_input || {};
    const filePath = toolInput.file_path;
    if (!filePath || typeof filePath !== 'string') {
        process.exit(0);
    }

    // Only PowerShell files.
    if (!/\.ps1$/i.test(filePath)) {
        process.exit(0);
    }

    // Skip files inside this linter repo (probes, fixtures, test battery).
    const absFile = path.resolve(filePath);
    const linterRootResolved = path.resolve(LINTER_ROOT);
    const rel = path.relative(linterRootResolved, absFile);
    const insideLinterRepo = rel && !rel.startsWith('..') && !path.isAbsolute(rel);
    if (insideLinterRepo) {
        process.exit(0);
    }

    try {
        execFileSync('node', [LINTER_ENTRY, absFile], { stdio: 'pipe' });
        process.exit(0);
    } catch (e) {
        const stdout = e.stdout ? e.stdout.toString() : '';
        const stderr = e.stderr ? e.stderr.toString() : '';
        const combined = (stdout + stderr).replace(/\x1b\[[0-9;]*m/g, '');

        process.stderr.write(`\n[dataverse-linter] Violations in ${absFile}:\n\n`);
        process.stderr.write(combined.trim() + '\n');
        process.stderr.write(`\n[dataverse-linter] Fix the violations above before considering this write complete. ` +
            `If the violation is a false positive, propose a rule refinement at ` +
            `https://github.com/djwmobley/dataverse-linter rather than bypassing the gate.\n`);
        process.exit(2);
    }
});
