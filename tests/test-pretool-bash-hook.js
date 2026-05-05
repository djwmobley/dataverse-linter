#!/usr/bin/env node
// Adversarial probe battery for hooks/pretool-lint-bash.js
//
// Probes:
//   BASH-1: pwsh -Command with R-violation (Connect-CrmOnlineDiscovery -ShowProgress) -> must block (exit 2)
//   BASH-2: pwsh -Command with clean PS -> must pass (exit 0)
//   BASH-3: powershell -File invocation -> must pass (exit 0; file linted at write time)
//   BASH-4: Heredoc piped to pwsh with R-violation -> must block (exit 2)
//   BASH-5: Non-PS Bash command (git status) -> must pass (exit 0)
//   BASH-6: powershell -Command with R-violation -> must block (exit 2)
//   BASH-7: Malformed JSON payload -> must exit 0 with warning on stderr
//   BASH-8: tool_name is not Bash -> must pass (exit 0)
//
// Citation: PreToolUse hook payload schema at https://code.claude.com/docs/en/hooks

const { spawnSync } = require('child_process');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, '../hooks/pretool-lint-bash.js');

function runHook(payloadStr) {
    const r = spawnSync('node', [HOOK], { input: payloadStr, encoding: 'utf8', timeout: 30000 });
    return { exitCode: r.status !== null ? r.status : 1, stderr: r.stderr || '', stdout: r.stdout || '' };
}

function mkPayload(command) {
    return JSON.stringify({
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: command },
        session_id: 'test',
        cwd: os.tmpdir(),
        permission_mode: 'default'
    });
}

let passed = 0, failed = 0;
function assert(label, ok, detail) {
    if (ok) { console.log('  PASS: ' + label); passed++; }
    else { console.error('  FAIL: ' + label); if (detail) console.error('        ' + detail); failed++; }
}

// ---------------------------------------------------------------------------
// BASH-1: pwsh -Command with known-bad param (R31: Connect-CrmOnlineDiscovery -ShowProgress)
// This is the exact failure mode documented in feedback_verify_cmdlet_parameter_sets.md.
// -ShowProgress does not exist in Microsoft.Xrm.Data.PowerShell v2.8.21.
// R12 also fires (Connect-CrmOnlineDiscovery flagged unconditionally).
// Must block (exit 2).
// ---------------------------------------------------------------------------
console.log('\nBASH-1: pwsh -Command with R31 violation (Connect-CrmOnlineDiscovery -ShowProgress)...');
{
    const cmd = 'pwsh -Command "Connect-CrmOnlineDiscovery -InteractiveMode -ShowProgress $false"';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode);
    assert('stderr has linter marker', r.stderr.includes('[dataverse-linter/pretool-bash]'), r.stderr.slice(0, 200));
}

// ---------------------------------------------------------------------------
// BASH-2: pwsh -Command with clean PS -- must pass (exit 0)
// A minimal conformant PS script: has $optionSets, Start/Stop-Transcript,
// and an idempotency guard to satisfy all regex-inverse rules (R28).
// No banned patterns present.
// ---------------------------------------------------------------------------
console.log('\nBASH-2: pwsh -Command with clean PS (conformant snippet)...');
{
    // Inline command that satisfies R28 (idempotency guard) and has no banned patterns.
    const psBody = '$optionSets = @(\\"adv_Status\\"); Start-Transcript -Path \\"C:\\\\\\\\Temp\\\\\\\\log.txt\\"; $existing = $null; if ($null -eq $existing) { Write-Host \\"ok\\" }; Stop-Transcript';
    const cmd = 'pwsh -Command "' + psBody + '"';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 200));
}

// ---------------------------------------------------------------------------
// BASH-3: powershell -File invocation -- must pass (exit 0)
// File-based invocations are linted at write time by the PostToolUse hook.
// The pretool-bash hook passes file invocations through unaltered.
// ---------------------------------------------------------------------------
console.log('\nBASH-3: powershell -File invocation (pass-through)...');
{
    const cmd = 'powershell -NoProfile -File C:/scripts/migrate.ps1 -OrgUrl https://org.crm.dynamics.com';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 200));
}

// ---------------------------------------------------------------------------
// BASH-4: Heredoc piped to pwsh with R-violation (pac install) -- must block (exit 2)
// Tests the heredoc extraction path. R34: pac install is not valid.
// R28: no idempotency guard.
// ---------------------------------------------------------------------------
console.log('\nBASH-4: Heredoc piped to pwsh with R-violation (pac install)...');
{
    // Simulate: pwsh << 'EOF' ... EOF
    const cmd = 'pwsh << \'EOF\'\n$optionSets = @("x")\npac install latest\nInvoke-RestMethod -Method POST -Uri "https://org.crm.dynamics.com/api/data/v9.2/entities"\nEOF';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode);
    assert('stderr has linter marker', r.stderr.includes('[dataverse-linter/pretool-bash]'), r.stderr.slice(0, 200));
}

// ---------------------------------------------------------------------------
// BASH-5: Non-PS Bash command (git status) -- must pass (exit 0)
// The hook silently passes non-PS Bash commands.
// ---------------------------------------------------------------------------
console.log('\nBASH-5: Non-PS Bash command (git status)...');
{
    const r = runHook(mkPayload('git status'));
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode);
}

// ---------------------------------------------------------------------------
// BASH-6: powershell -Command with R-violation (pac install) -- must block (exit 2)
// Tests the powershell.exe alias path (not just pwsh).
// ---------------------------------------------------------------------------
console.log('\nBASH-6: powershell -Command with R-violation (R34 + R28)...');
{
    const cmd = 'powershell -Command "$optionSets = @(\\"x\\"); pac install latest; Invoke-RestMethod -Method POST -Uri \\"https://org.crm.dynamics.com/api/data/v9.2/entities\\""';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode);
    assert('stderr has linter marker', r.stderr.includes('[dataverse-linter/pretool-bash]'), r.stderr.slice(0, 200));
}

// ---------------------------------------------------------------------------
// BASH-7: Malformed JSON payload -- must exit 0 with warning on stderr
// A bad payload must not crash or block Claude Code; degrade gracefully.
// ---------------------------------------------------------------------------
console.log('\nBASH-7: Malformed JSON payload...');
{
    const r = runHook('NOT JSON');
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode);
    assert('stderr has skipping warning', r.stderr.includes('skipping lint'), r.stderr.slice(0, 200));
}

// ---------------------------------------------------------------------------
// BASH-8: tool_name is not Bash -- must pass (exit 0)
// Hook only inspects Bash tool calls; other tools pass silently.
// ---------------------------------------------------------------------------
console.log('\nBASH-8: tool_name is Write (not Bash)...');
{
    const payload = JSON.stringify({
        hook_event_name: 'PreToolUse',
        tool_name: 'Write',
        tool_input: { file_path: 'C:/some/script.ps1', content: 'pac install latest' },
        session_id: 'test',
        cwd: os.tmpdir()
    });
    const r = runHook(payload);
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode);
}

// ===========================================================================
// Round-1 review (PR #2) bypass-closure probes
// All closures below were APPROVE-CONDITIONAL findings + reviewer-flagged
// out-of-scope evasions widened in scope per Damian directive 2026-05-05.
// ===========================================================================

// Reusable PS bodies.
// Bad body: triggers R12 (Connect-CrmOnlineDiscovery) and R31 (-ShowProgress).
const BAD_PS_INLINE = 'Connect-CrmOnlineDiscovery -InteractiveMode -ShowProgress $false';
// Double-quoted -Command bodies need $-escaping for bash.
const BAD_PS_INLINE_DQ_ESC = 'Connect-CrmOnlineDiscovery -InteractiveMode -ShowProgress \\$false';
// Clean body satisfies R28 (idempotency guard) and has no banned patterns.
const CLEAN_PS_INLINE_DQ = '$optionSets = @(\\"adv_Status\\"); Start-Transcript -Path \\"C:\\\\\\\\Temp\\\\\\\\log.txt\\"; $existing = $null; if ($null -eq $existing) { Write-Host \\"ok\\" }; Stop-Transcript';
// Single-quoted variant (no \\ escaping inside ' ').
const CLEAN_PS_SQ = '$optionSets = @("adv_Status"); Start-Transcript -Path "C:\\\\Temp\\\\log.txt"; $existing = $null; if ($null -eq $existing) { Write-Host "ok" }; Stop-Transcript';
// Multi-line clean body for heredoc tests.
const CLEAN_PS_MULTILINE = '#Requires -PSEdition Desktop\n$optionSets = @("adv_Status")\nStart-Transcript -Path "C:\\\\Temp\\\\log.txt"\n$existing = $null\nif ($null -eq $existing) { Write-Host "ok" }\nStop-Transcript';
// Multi-line bad body for heredoc tests (R34 + R28).
const BAD_PS_MULTILINE = '$optionSets = @("x")\npac install latest\nInvoke-RestMethod -Method POST -Uri "https://org.crm.dynamics.com/api/data/v9.2/entities"';

// ---------------------------------------------------------------------------
// Closure 1 (MAJOR): file-invocation early-return short-circuit
// Bypass: pwsh -File ok.ps1; pwsh -Command "<bad>"
// Pre-fix: FILE_INVOCATION_RE matched, function returned early, inline body
// never extracted -> exit 0. Fix: drop the early return entirely.
// ---------------------------------------------------------------------------
console.log('\n[file-then-inline-bad]: pwsh -File ok.ps1; pwsh -Command "<bad>"...');
{
    const cmd = 'pwsh -File C:/scripts/ok.ps1; pwsh -Command "' + BAD_PS_INLINE_DQ_ESC + '"';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
    assert('stderr has linter marker', r.stderr.includes('[dataverse-linter/pretool-bash]'), r.stderr.slice(0, 200));
}
console.log('\n[file-then-inline-clean]: pwsh -File ok.ps1; pwsh -Command "<clean>" (true negative)...');
{
    const cmd = 'pwsh -File C:/scripts/ok.ps1; pwsh -Command "' + CLEAN_PS_INLINE_DQ + '"';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
}

// ---------------------------------------------------------------------------
// Closure 2 (MAJOR): pwsh -EncodedCommand <base64> not extracted
// Citation: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe
// Verbatim: "Accepts a base-64-encoded string version of a command. ... The
// string must be formatted using UTF-16LE character encoding."
// Round-trip verified 2026-05-05: PS [System.Text.Encoding]::Unicode <==> Node 'utf16le'.
// ---------------------------------------------------------------------------
console.log('\n[encoded-command-bad]: pwsh -EncodedCommand <b64-of-bad-ps>...');
{
    const b64 = Buffer.from(BAD_PS_INLINE, 'utf16le').toString('base64');
    const cmd = 'pwsh -NoProfile -EncodedCommand ' + b64;
    const r = runHook(mkPayload(cmd));
    assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
    assert('stderr has linter marker', r.stderr.includes('[dataverse-linter/pretool-bash]'), r.stderr.slice(0, 200));
}
console.log('\n[encoded-command-clean]: pwsh -EncodedCommand <b64-of-clean-ps> (true negative)...');
{
    const cleanBody = '$optionSets = @("adv_Status"); Start-Transcript -Path "C:\\Temp\\log.txt"; $existing = $null; if ($null -eq $existing) { Write-Host "ok" }; Stop-Transcript';
    const b64 = Buffer.from(cleanBody, 'utf16le').toString('base64');
    const cmd = 'pwsh -EncodedCommand ' + b64;
    const r = runHook(mkPayload(cmd));
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
}
console.log('\n[encoded-command-shortform-enc]: pwsh -enc <b64-of-bad-ps> (lowercase alias)...');
{
    const b64 = Buffer.from(BAD_PS_INLINE, 'utf16le').toString('base64');
    const cmd = 'pwsh -enc ' + b64;
    const r = runHook(mkPayload(cmd));
    assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
}

// ---------------------------------------------------------------------------
// Closure 3 (MINOR): heredoc pipe-on-opening-line bypass
// Pre-fix: PIPED_HEREDOC_RE only matched <body> EOF | pwsh (closing-line pipe).
// Bash also supports cat << 'EOF' | pwsh\n<body>\nEOF (opening-line pipe);
// the latter is the more common idiom in practice.
// ---------------------------------------------------------------------------
console.log('\n[heredoc-pipe-opening-bad]: cat << EOF | pwsh\\n<bad>\\nEOF...');
{
    const cmd = "cat << 'EOF' | pwsh\n" + BAD_PS_MULTILINE + "\nEOF";
    const r = runHook(mkPayload(cmd));
    assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
    assert('stderr has linter marker', r.stderr.includes('[dataverse-linter/pretool-bash]'), r.stderr.slice(0, 200));
}
console.log('\n[heredoc-pipe-opening-clean]: cat << EOF | pwsh\\n<clean>\\nEOF (true negative)...');
{
    const cmd = "cat << 'EOF' | pwsh\n" + CLEAN_PS_MULTILINE + "\nEOF";
    const r = runHook(mkPayload(cmd));
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
}

// ---------------------------------------------------------------------------
// Closure 5 (out-of-scope-widened): single-quoted -Command body
// Pre-fix: INLINE_COMMAND_RE only matched double-quoted bodies.
// Single quotes are an idiomatic bash form to embed PS without $-escaping.
// ---------------------------------------------------------------------------
console.log("\n[single-quoted-bad]: pwsh -Command '<bad>'...");
{
    const cmd = "pwsh -Command 'Connect-CrmOnlineDiscovery -InteractiveMode -ShowProgress $false'";
    const r = runHook(mkPayload(cmd));
    assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
    assert('stderr has linter marker', r.stderr.includes('[dataverse-linter/pretool-bash]'), r.stderr.slice(0, 200));
}
console.log("\n[single-quoted-clean]: pwsh -Command '<clean>' (true negative)...");
{
    const cmd = "pwsh -Command '" + CLEAN_PS_SQ + "'";
    const r = runHook(mkPayload(cmd));
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
}

// ---------------------------------------------------------------------------
// Closure 6 (out-of-scope-widened): subshell substitution sh -c "$(...)"
// Pre-fix: not detected. Reviewer flagged as "complicit-author shape".
// Recursion depth capped at 3 (constant SUBSHELL_MAX_DEPTH in hook).
// ---------------------------------------------------------------------------
console.log('\n[subshell-substitution-bad]: sh -c "$(echo pwsh -Command \'<bad>\')"...');
{
    const cmd = 'sh -c "$(echo pwsh -Command \'Connect-CrmOnlineDiscovery -InteractiveMode -ShowProgress $false\')"';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
    assert('stderr has linter marker', r.stderr.includes('[dataverse-linter/pretool-bash]'), r.stderr.slice(0, 200));
}
console.log('\n[subshell-substitution-bash-bad]: bash -c "$(echo pwsh -Command \'<bad>\')"...');
{
    const cmd = 'bash -c "$(echo pwsh -Command \'Connect-CrmOnlineDiscovery -InteractiveMode -ShowProgress $false\')"';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
}
console.log('\n[subshell-substitution-clean]: sh -c "$(echo pwsh -Command \'<clean>\')" (true negative)...');
{
    const cmd = 'sh -c "$(echo pwsh -Command \'' + CLEAN_PS_SQ + '\')"';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
}

// ---------------------------------------------------------------------------
// Closure 7 (out-of-scope-widened): stdin pipe to pwsh
// Two sub-shapes:
//   (a) echo "<lit>" | pwsh   -- literal lifted from echo, linted directly.
//   (b) cat <file> | pwsh     -- file unreadable; refuse with warning + exit 2.
// ---------------------------------------------------------------------------
console.log('\n[stdin-pipe-echo-bad]: echo "<bad>" | pwsh...');
{
    const cmd = 'echo "Connect-CrmOnlineDiscovery -InteractiveMode -ShowProgress \\$false" | pwsh';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
    assert('stderr has linter marker', r.stderr.includes('[dataverse-linter/pretool-bash]'), r.stderr.slice(0, 200));
}
console.log('\n[stdin-pipe-echo-clean]: echo "<clean>" | pwsh (true negative)...');
{
    const cmd = 'echo "' + CLEAN_PS_INLINE_DQ + '" | pwsh';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
}
console.log('\n[stdin-pipe-cat-warn-and-block]: cat foo.ps1 | pwsh -- refuse with warning...');
{
    const cmd = 'cat C:/secret/script.ps1 | pwsh';
    const r = runHook(mkPayload(cmd));
    assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode + '; ' + r.stderr.slice(0, 300));
    assert('stderr has refusal message',
        r.stderr.includes('Refusing pipe-to-pwsh from external file source'),
        r.stderr.slice(0, 400));
}

console.log('\nPreToolUse-Bash hook probes: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
