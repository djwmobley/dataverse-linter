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

console.log('\nPreToolUse-Bash hook probes: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
