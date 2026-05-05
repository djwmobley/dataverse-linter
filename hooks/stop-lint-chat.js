#!/usr/bin/env node
// Stop hook for Claude Code: lints every PowerShell fenced code block in the
// assistant's final turn text before Claude Code is allowed to stop.
//
// Payload contract (https://code.claude.com/docs/en/hooks):
//   Stop event delivers:
//     { session_id, transcript_path, cwd, permission_mode, hook_event_name }
//   The assistant's last-turn text is NOT in the payload directly. It is in the
//   JSONL file at transcript_path. Each line is a JSON object; the last object
//   with role "assistant" contains the final response text.
//
// Blocking contract:
//   Exit code 2 blocks the Stop event (stderr text is fed back to the assistant
//   as an error message). Exit 0 allows Claude Code to stop normally.
//
// Wire-up: add a Stop hook in ~/.claude/settings.json:
//   "Stop": [
//     {
//       "hooks": [
//         {
//           "type": "command",
//           "command": "node C:/gemini/dataverse-linter/hooks/stop-lint-chat.js"
//         }
//       ]
//     }
//   ]
//
// Behavior:
//   - Reads Claude Code hook payload as JSON on stdin.
//   - Opens transcript_path and finds the last assistant turn text.
//   - Regex-extracts every ```powershell, ```pwsh, and ```ps1 fenced block.
//   - Non-PS fenced blocks (```bash, ```js, etc.) and plain prose pass through.
//   - Writes each extracted PS block to a temp .ps1 file.
//   - Runs `node src/index.js` on each temp file.
//   - If all lint clean: exits 0 (Claude Code stops normally).
//   - If any violation: emits stripped-ANSI violations to stderr, exits 2.
//   - Temp files are deleted after each lint run regardless of outcome.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const LINTER_ROOT = path.resolve(__dirname, '..');
const LINTER_ENTRY = path.join(LINTER_ROOT, 'src', 'index.js');

// Fenced block extraction.
// Round-1 review (PR #2) widening:
//   - Leading anchor relaxed from `^` to `(?:^|\n|\s)` so an inline-prose
//     lead-in like "Run this: ```powershell\n...\n```" is captured. The
//     previous strict `^` only matched fences that began at column 0, which
//     allowed an assistant to bypass by placing inline prose before the fence
//     on the same line.
//   - Language-tag set widened to (powershell|pwsh|ps1|posh), case-insensitive
//     ("PowerShell", "PWSH", "POSH" all match). Generic `shell` and no-label
//     fences are intentionally excluded to avoid over-matching legitimate
//     non-PS code blocks.
// Closing fence is matched by `\n``` ` at the start of a new line (anchored
// by the preceding newline) with non-greedy body capture so adjacent blocks
// do not merge.
const FENCED_PS_RE = /(?:^|\n|\s)```(?:powershell|pwsh|ps1|posh)\r?\n([\s\S]*?)\n```/gi;

function extractFencedPsBlocks(text) {
    const blocks = [];
    let m;
    FENCED_PS_RE.lastIndex = 0;
    while ((m = FENCED_PS_RE.exec(text)) !== null) {
        blocks.push(m[1]);
    }
    return blocks;
}

function stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function findLastAssistantText(transcriptPath) {
    let raw;
    try {
        raw = fs.readFileSync(transcriptPath, 'utf8');
    } catch (e) {
        return null;
    }

    const lines = raw.split('\n').filter(l => l.trim().length > 0);
    let lastAssistantText = null;

    for (const line of lines) {
        let obj;
        try {
            obj = JSON.parse(line);
        } catch (_) {
            continue;
        }

        // Transcript format: each line may be a turn object with role + content,
        // or a wrapper with a message field containing role + content.
        // Handle both shapes defensively.
        const role = obj.role || (obj.message && obj.message.role);
        if (role !== 'assistant') continue;

        // Content may be a plain string or an array of content blocks.
        const content = obj.content || (obj.message && obj.message.content);
        if (!content) continue;

        if (typeof content === 'string') {
            lastAssistantText = content;
        } else if (Array.isArray(content)) {
            // Concatenate all text-type blocks.
            const textParts = content
                .filter(b => b.type === 'text' && typeof b.text === 'string')
                .map(b => b.text);
            if (textParts.length > 0) {
                lastAssistantText = textParts.join('\n');
            }
        }
    }

    return lastAssistantText;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
    let payload;
    try {
        payload = JSON.parse(raw);
    } catch (e) {
        process.stderr.write(`[dataverse-linter/stop] hook payload was not valid JSON; skipping lint (${e.message})\n`);
        process.exit(0);
    }

    // Only act on Stop events (defensive: hook may be misconfigured to receive others).
    if (payload.hook_event_name && payload.hook_event_name !== 'Stop') {
        process.exit(0);
    }

    const transcriptPath = payload.transcript_path;
    if (!transcriptPath || typeof transcriptPath !== 'string') {
        // No transcript available -- cannot lint chat text; pass through.
        process.exit(0);
    }

    const assistantText = findLastAssistantText(transcriptPath);
    if (!assistantText) {
        // No assistant turn found; nothing to lint.
        process.exit(0);
    }

    const blocks = extractFencedPsBlocks(assistantText);
    if (blocks.length === 0) {
        // No PS fenced blocks; pass through.
        process.exit(0);
    }

    const violations = [];
    const tempFiles = [];

    try {
        blocks.forEach((block, i) => {
            const tmpFile = path.join(os.tmpdir(), `dvlint-stop-${process.pid}-${i}.ps1`);
            tempFiles.push(tmpFile);
            fs.writeFileSync(tmpFile, block, 'utf8');

            try {
                execFileSync('node', [LINTER_ENTRY, tmpFile], { stdio: 'pipe' });
                // Exit 0 from linter: clean block.
            } catch (e) {
                const stdout = e.stdout ? e.stdout.toString() : '';
                const stderr = e.stderr ? e.stderr.toString() : '';
                const combined = stripAnsi((stdout + stderr).trim());
                violations.push({ blockIndex: i + 1, output: combined });
            }
        });
    } finally {
        // Always clean up temp files.
        for (const f of tempFiles) {
            try { fs.unlinkSync(f); } catch (_) {}
        }
    }

    if (violations.length === 0) {
        process.exit(0);
    }

    process.stderr.write(`\n[dataverse-linter/stop] Violations detected in chat-text PowerShell fenced blocks:\n`);
    for (const v of violations) {
        process.stderr.write(`\n--- Fenced block #${v.blockIndex} ---\n`);
        process.stderr.write(v.output + '\n');
    }
    process.stderr.write(
        `\n[dataverse-linter/stop] Fix the violations above before this response is considered complete. ` +
        `If a violation is a false positive, propose a rule refinement at ` +
        `https://github.com/djwmobley/dataverse-linter rather than bypassing the gate.\n`
    );
    process.exit(2);
});
