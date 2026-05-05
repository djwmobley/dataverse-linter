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
//   - Extracts inline PowerShell from the command string. Supported shapes:
//       * pwsh -Command|-c "..." or '...'   (double or single quoted body)
//       * powershell.exe -Command "..."
//       * pwsh -EncodedCommand <base64>      (UTF-16LE per Microsoft contract)
//       * pwsh << 'EOF' ... EOF              (heredoc directly to pwsh)
//       * <body> EOF | pwsh                  (heredoc, pipe on closing line)
//       * cat << 'EOF' | pwsh\nbody\nEOF     (heredoc, pipe on opening line)
//       * echo "<lit>" | pwsh                (stdin pipe; literal lifted)
//       * sh -c "$(...)" / bash -c "$(...)"  (subshell substitution; recursive)
//   - File invocations (powershell -File <path>.ps1) naturally produce no
//     extracted blocks because INLINE_COMMAND_RE requires -Command/-c (not -File);
//     the file itself was linted at write time by the PostToolUse hook. Mixed
//     command lines (file invocation followed by inline -Command) are extracted
//     and linted because the inline portion is not file-backed.
//   - cat-from-file pipes (cat file | pwsh) are detected but not linted -- the
//     hook cannot read arbitrary files; emits a block warning and exits 2.
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

// Pattern 1: pwsh[.exe] -Command|-c "..." or pwsh[.exe] -Command|-c '...'
// Captures double-quoted (group 1) or single-quoted (group 2) body after
// -Command or -c flag. Either group is the body -- caller picks whichever matched.
const INLINE_COMMAND_RE = /(?:pwsh(?:\.exe)?|powershell(?:\.exe)?)\s+(?:-Command|-c)\s+(?:"((?:[^"\\]|\\.)*)"|'([^']*)')/gi;

// Pattern 2: heredoc DIRECTLY to pwsh -- pwsh << 'EOF' ... EOF
const HEREDOC_RE = /(?:pwsh(?:\.exe)?|powershell(?:\.exe)?)\s+<<\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1/gi;

// Pattern 3a: piped heredoc, pipe on CLOSING line -- <body> EOF | pwsh
const PIPED_HEREDOC_CLOSING_RE = /<<\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1\s*\|\s*(?:pwsh(?:\.exe)?|powershell(?:\.exe)?)/gi;

// Pattern 3b: piped heredoc, pipe on OPENING line -- cat << 'EOF' | pwsh\nbody\nEOF
// More common in practice; reviewer documented as canonical bash idiom.
const PIPED_HEREDOC_OPENING_RE = /(?:cat|printf|echo)\s+<<\s*['"]?(\w+)['"]?\s*\|\s*(?:pwsh(?:\.exe)?|powershell(?:\.exe)?)\s*\n([\s\S]*?)\n\1/gi;

// Pattern 4: pwsh -EncodedCommand <base64>
// Per https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe
// quote: "Accepts a base-64-encoded string version of a command. Use this
// parameter to submit commands to PowerShell that require complex quotation
// marks or curly braces. The string must be formatted using UTF-16LE
// character encoding."
// Aliases: -EncodedCommand, -encodedcommand, -EnC, -enc (case-insensitive).
const ENCODED_COMMAND_RE = /(?:pwsh(?:\.exe)?|powershell(?:\.exe)?)\s+(?:-(?:NoProfile|NonInteractive|ExecutionPolicy\s+\S+|WindowStyle\s+\S+|Sta|Mta|NoLogo)\s+)*-(?:EncodedCommand|EnC|enc)\s+(\S+)/gi;

// Pattern 5: stdin-pipe to pwsh from echo/printf -- body is a literal we can lift.
// Captures the literal string body (double or single quoted) being echoed.
const STDIN_ECHO_RE = /(?:^|[;&|]|\|\|)\s*(?:echo|printf)\s+(?:"((?:[^"\\]|\\.)*)"|'([^']*)')\s*\|\s*(?:pwsh(?:\.exe)?|powershell(?:\.exe)?)/gi;

// Pattern 6: stdin-pipe to pwsh from cat <file> -- file content is unreadable
// at hook time. Detect-and-block-with-warning. Captures the file path.
const STDIN_CAT_RE = /(?:^|[;&|]|\|\|)\s*cat\s+(\S+)\s*\|\s*(?:pwsh(?:\.exe)?|powershell(?:\.exe)?)/gi;

// Pattern 7: subshell substitution -- sh -c "$(...)" / bash -c "$(...)"
// Body inside $(...) is recursively scanned for PS-invocation patterns.
const SUBSHELL_RE = /(?:sh|bash)\s+-c\s+"\$\(([\s\S]*?)\)"/gi;

const SUBSHELL_MAX_DEPTH = 3;

// ---------------------------------------------------------------------------
// EncodedCommand decoder
// ---------------------------------------------------------------------------
// Per Microsoft (URL above): "The string must be formatted using UTF-16LE
// character encoding." Round-trip verified 2026-05-05:
//   PS:   [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes("Get-Date"))
//         -> RwBlAHQALQBEAGEAdABlAA==
//   Node: Buffer.from("RwBlAHQALQBEAGEAdABlAA==", "base64").toString("utf16le")
//         -> "Get-Date"
function decodeEncodedCommand(b64) {
    try {
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
            return null;
        }
        const buf = Buffer.from(b64, 'base64');
        if (buf.length % 2 !== 0) {
            return null;
        }
        return buf.toString('utf16le');
    } catch (e) {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Block-with-warning state (cat-from-file pipe-to-pwsh shapes)
// ---------------------------------------------------------------------------
const catWarnings = [];

// Helper: collect all matches of a global regex against a string.
// Avoids stateful `regex.exec` lastIndex bugs across recursive calls -- the
// outer-loop bug here would otherwise be: an inner recursive call resets the
// shared regex's lastIndex to 0, then the outer call's `while (regex.exec)`
// re-matches the same input starting from 0 -> infinite loop. matchAll on a
// fresh iterator avoids the shared-state pitfall entirely.
function collectMatches(regex, str) {
    const out = [];
    // Re-construct a fresh RegExp instance from the source/flags so the
    // iterator does not share lastIndex with any caller's iterator.
    const fresh = new RegExp(regex.source, regex.flags);
    let m;
    while ((m = fresh.exec(str)) !== null) {
        out.push(m);
        if (m.index === fresh.lastIndex) fresh.lastIndex++; // zero-width safeguard
    }
    return out;
}

function extractInlinePsBlocks(command, depth) {
    if (typeof depth !== 'number') depth = 0;
    const blocks = [];

    if (depth > SUBSHELL_MAX_DEPTH) {
        return blocks;
    }

    // Pattern 1: -Command "..." or -Command '...'
    for (const m of collectMatches(INLINE_COMMAND_RE, command)) {
        if (m[1] !== undefined) {
            blocks.push(m[1].replace(/\\"/g, '"'));
        } else if (m[2] !== undefined) {
            blocks.push(m[2]);
        }
    }

    // Pattern 2: pwsh << 'EOF' ... EOF
    for (const m of collectMatches(HEREDOC_RE, command)) {
        blocks.push(m[2]);
    }

    // Pattern 3a: piped heredoc, pipe on closing line
    for (const m of collectMatches(PIPED_HEREDOC_CLOSING_RE, command)) {
        blocks.push(m[2]);
    }

    // Pattern 3b: piped heredoc, pipe on opening line
    for (const m of collectMatches(PIPED_HEREDOC_OPENING_RE, command)) {
        blocks.push(m[2]);
    }

    // Pattern 4: -EncodedCommand <base64>
    for (const m of collectMatches(ENCODED_COMMAND_RE, command)) {
        const decoded = decodeEncodedCommand(m[1]);
        if (decoded !== null) {
            blocks.push(decoded);
        } else {
            catWarnings.push(
                `Refusing pwsh -EncodedCommand with non-decodable payload (token: ${m[1].slice(0, 32)}...) -- payload must be valid UTF-16LE base64 per ` +
                `https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe`
            );
        }
    }

    // Pattern 5: echo "..." | pwsh  (literal lifted)
    for (const m of collectMatches(STDIN_ECHO_RE, command)) {
        if (m[1] !== undefined) {
            blocks.push(m[1].replace(/\\"/g, '"'));
        } else if (m[2] !== undefined) {
            blocks.push(m[2]);
        }
    }

    // Pattern 6: cat <file> | pwsh  (cannot read file at hook time)
    for (const m of collectMatches(STDIN_CAT_RE, command)) {
        catWarnings.push(
            `Refusing pipe-to-pwsh from external file source -- cannot lint ${m[1]}. ` +
            `Inline the script body (pwsh -Command "...") or write the file via Write/Edit so the PostToolUse hook can lint it.`
        );
    }

    // Pattern 7: sh/bash -c "$(...)" -- recursive scan with depth cap.
    // collectMatches returns concrete results before recursion -- avoids the
    // shared-lastIndex infinite-loop with the outer iterator.
    for (const m of collectMatches(SUBSHELL_RE, command)) {
        const innerBlocks = extractInlinePsBlocks(m[1], depth + 1);
        for (const b of innerBlocks) {
            blocks.push(b);
        }
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

    if (!payload.tool_name || payload.tool_name !== 'Bash') {
        process.exit(0);
    }

    const toolInput = payload.tool_input || {};
    const command = toolInput.command;
    if (!command || typeof command !== 'string') {
        process.exit(0);
    }

    catWarnings.length = 0;

    const blocks = extractInlinePsBlocks(command);

    if (blocks.length === 0 && catWarnings.length === 0) {
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

    if (catWarnings.length > 0) {
        process.stderr.write(`\n[dataverse-linter/pretool-bash] Unlintable inline PowerShell shape detected:\n`);
        for (const w of catWarnings) {
            process.stderr.write(`\n  - ${w}\n`);
        }
        process.stderr.write(`\n`);
    }

    if (violations.length === 0 && catWarnings.length === 0) {
        process.exit(0);
    }

    if (violations.length > 0) {
        process.stderr.write(`\n[dataverse-linter/pretool-bash] Violations in inline PowerShell within Bash command:\n`);
        for (const v of violations) {
            process.stderr.write(`\n--- Inline PS block #${v.blockIndex} ---\n`);
            process.stderr.write(v.output + '\n');
        }
    }

    process.stderr.write(
        `\n[dataverse-linter/pretool-bash] Fix the violations above before issuing this Bash command. ` +
        `If a violation is a false positive, propose a rule refinement at ` +
        `https://github.com/djwmobley/dataverse-linter rather than bypassing the gate.\n`
    );
    process.exit(2);
});
