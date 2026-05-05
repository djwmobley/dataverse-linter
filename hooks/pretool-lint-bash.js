#!/usr/bin/env node
// PreToolUse hook for Claude Code: lints inline PowerShell embedded in Bash
// tool calls before the Bash tool is allowed to execute.
//
// Payload contract (https://code.claude.com/docs/en/hooks):
//   PreToolUse event delivers:
//     { session_id, transcript_path, cwd, permission_mode, hook_event_name,
//       tool_name, tool_input: { command, description?, timeout?, run_in_background? },
//       tool_use_id }
//   The Bash tool's command string is at payload.tool_input.command.
//
// Blocking contract:
//   Exit code 2 blocks the tool call (stderr text is fed back to the assistant
//   as a block reason). Exit 0 allows the Bash tool call to proceed.
//
// Wire-up: add a PreToolUse hook in ~/.claude/settings.json:
//   "PreToolUse": [
//     {
//       "matcher": "Bash",
//       "hooks": [
//         {
//           "type": "command",
//           "command": "node C:/gemini/dataverse-linter/hooks/pretool-lint-bash.js"
//         }
//       ]
//     }
//   ]
//
// Behavior:
//   - Reads Claude Code hook payload as JSON on stdin.
//   - Skips silently if tool_name is not "Bash".
//   - Extracts inline PowerShell from the command string:
//       pwsh -Command|-c "..." or powershell -Command|-c "..."
//       pwsh.exe -Command "..."
//       heredoc piped to pwsh|powershell  (pwsh << 'EOF' ... EOF)
//   - Pure file invocations (powershell -File <path>.ps1 or pwsh -File <path>.ps1)
//     pass through unaltered -- the file itself was linted at write time.
//   - Non-PS Bash commands pass through silently.
//   - Writes each extracted PS body to a temp .ps1 file, runs the linter.
//   - If all lint clean: exits 0.
//   - If any violation: emits stripped-ANSI violations to stderr, exits 2.
//   - Temp files are deleted after each lint run regardless of outcome.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const LINTER_ROOT = path.resolve(__dirname, '..');
const LINTER_ENTRY = path.join(LINTER_ROOT, 'src', 'index.js');

// ---------------------------------------------------------------------------
// Inline PS extraction patterns
// ---------------------------------------------------------------------------

// Pattern 1: pwsh[.exe] -Command|-c "..." or powershell[.exe] -Command|-c "..."
// Matches double-quoted body after -Command or -c flag.
// Stops at the end of the quoted string (handling escaped quotes minimally).
// We intentionally do NOT support single-quoted -Command args here because
// Windows PowerShell -Command with single quotes is non-standard and rare.
const INLINE_COMMAND_RE = /(?:pwsh(?:\.exe)?|powershell(?:\.exe)?)\s+(?:-Command|-c)\s+"((?:[^"\\]|\\.)*)"/gi;

// Pattern 2: heredoc piped to pwsh or powershell.
// Matches: ... | pwsh or ... | powershell at the end of the heredoc invocation,
// or pwsh/powershell << 'WORD' / << "WORD" / << WORD.
// We capture the heredoc body between the delimiter lines.
// This regex is applied to the full command string in multiline mode.
const HEREDOC_RE = /(?:pwsh(?:\.exe)?|powershell(?:\.exe)?)\s+<<\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1/gi;

// Pattern 3: piped heredoc -- cat << 'EOF' | pwsh form.
// Matches the body of a here-doc that is piped to pwsh/powershell.
const PIPED_HEREDOC_RE = /<<\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1\s*\|\s*(?:pwsh(?:\.exe)?|powershell(?:\.exe)?)/gi;

// Pure file invocation pattern (pass-through):
// powershell -File <path>.ps1 or pwsh -File <path>.ps1
const FILE_INVOCATION_RE = /(?:pwsh(?:\.exe)?|powershell(?:\.exe)?)\s+(?:-(?:NoProfile|NonInteractive|ExecutionPolicy\s+\S+)\s+)*-File\s+\S+\.ps1/i;

function extractInlinePsBlocks(command) {
    const blocks = [];

    // If the command is a pure file invocation, skip entirely.
    // (The file was linted at write time by the PostToolUse hook.)
    if (FILE_INVOCATION_RE.test(command)) {
        return blocks;
    }

    // Extract -Command inline bodies.
    let m;
    INLINE_COMMAND_RE.lastIndex = 0;
    while ((m = INLINE_COMMAND_RE.exec(command)) !== null) {
        // Unescape \" sequences that PowerShell uses inside -Command strings.
        const body = m[1].replace(/\\"/g, '"');
        blocks.push(body);
    }

    // Extract pwsh << 'HEREDOC' heredoc bodies.
    HEREDOC_RE.lastIndex = 0;
    while ((m = HEREDOC_RE.exec(command)) !== null) {
        blocks.push(m[2]);
    }

    // Extract cat << 'HEREDOC' | pwsh piped-heredoc bodies.
    PIPED_HEREDOC_RE.lastIndex = 0;
    while ((m = PIPED_HEREDOC_RE.exec(command)) !== null) {
        blocks.push(m[2]);
    }

    return blocks;
}

function stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
    let payload;
    try {
        payload = JSON.parse(raw);
    } catch (e) {
        process.stderr.write(`[dataverse-linter/pretool-bash] hook payload was not valid JSON; skipping lint (${e.message})\n`);
        process.exit(0);
    }

    // Only act on Bash tool calls.
    if (!payload.tool_name || payload.tool_name !== 'Bash') {
        process.exit(0);
    }

    const toolInput = payload.tool_input || {};
    const command = toolInput.command;
    if (!command || typeof command !== 'string') {
        process.exit(0);
    }

    const blocks = extractInlinePsBlocks(command);
    if (blocks.length === 0) {
        // No inline PS; pass through.
        process.exit(0);
    }

    const violations = [];
    const tempFiles = [];

    try {
        blocks.forEach((block, i) => {
            const tmpFile = path.join(os.tmpdir(), `dvlint-bash-${process.pid}-${i}.ps1`);
            tempFiles.push(tmpFile);
            fs.writeFileSync(tmpFile, block, 'utf8');

            try {
                execFileSync('node', [LINTER_ENTRY, tmpFile], { stdio: 'pipe' });
                // Exit 0: clean block.
            } catch (e) {
                const stdout = e.stdout ? e.stdout.toString() : '';
                const stderr = e.stderr ? e.stderr.toString() : '';
                const combined = stripAnsi((stdout + stderr).trim());
                violations.push({ blockIndex: i + 1, output: combined });
            }
        });
    } finally {
        for (const f of tempFiles) {
            try { fs.unlinkSync(f); } catch (_) {}
        }
    }

    if (violations.length === 0) {
        process.exit(0);
    }

    process.stderr.write(`\n[dataverse-linter/pretool-bash] Violations in inline PowerShell within Bash command:\n`);
    for (const v of violations) {
        process.stderr.write(`\n--- Inline PS block #${v.blockIndex} ---\n`);
        process.stderr.write(v.output + '\n');
    }
    process.stderr.write(
        `\n[dataverse-linter/pretool-bash] Fix the violations above before issuing this Bash command. ` +
        `If a violation is a false positive, propose a rule refinement at ` +
        `https://github.com/djwmobley/dataverse-linter rather than bypassing the gate.\n`
    );
    process.exit(2);
});
