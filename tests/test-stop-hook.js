#!/usr/bin/env node
// Adversarial probe battery for hooks/stop-lint-chat.js
//
// Probes:
//   STOP-1: R-violation PS fenced block -> must block (exit 2)
//   STOP-2: Clean PS fenced block -> must pass (exit 0)
//   STOP-3: No PS fenced blocks in response -> must pass (exit 0)
//   STOP-4: Non-PS fenced blocks (bash, js) only -> must pass (exit 0)
//   STOP-5: Multiple blocks, one bad, one clean -> must block (exit 2)
//   STOP-6: Malformed JSON payload -> must exit 0 with warning on stderr
//   STOP-7: Payload missing transcript_path -> must pass (exit 0)
//   STOP-8: Non-existent transcript_path -> must pass (exit 0)
//
// Citation: Stop hook payload schema at https://code.claude.com/docs/en/hooks

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, '../hooks/stop-lint-chat.js');
// Three backticks used to open/close fenced code blocks in synthesized assistant text.
const B3 = '`' + '`' + '`';

function makeTranscript(txt) {
    const p = path.join(os.tmpdir(), 'dvlint-tp-' + process.pid + '-' + Date.now() + '.jsonl');
    const entries = [
        JSON.stringify({ role: 'user', content: 'test' }),
        JSON.stringify({ role: 'assistant', content: txt })
    ];
    fs.writeFileSync(p, entries.join('\n') + '\n', 'utf8');
    return p;
}

function runHook(s) {
    const r = spawnSync('node', [HOOK], { input: s, encoding: 'utf8', timeout: 30000 });
    return { exitCode: r.status !== null ? r.status : 1, stderr: r.stderr || '', stdout: r.stdout || '' };
}

function mkpayload(tp) {
    return JSON.stringify({
        hook_event_name: 'Stop', session_id: 'test', transcript_path: tp,
        cwd: os.tmpdir(), permission_mode: 'default'
    });
}

let passed = 0, failed = 0;
function assert(label, ok, detail) {
    if (ok) { console.log('  PASS: ' + label); passed++; }
    else { console.error('  FAIL: ' + label); if (detail) console.error('        ' + detail); failed++; }
}

// ---------------------------------------------------------------------------
// STOP-1: R-violation PS fenced block -- must block (exit 2)
// R34: pac install not a valid pac command group.
// R28: no idempotency guard present in the block.
// ---------------------------------------------------------------------------
console.log('\nSTOP-1: R-violation PS block (R34 + R28)...');
{
    const badPs = '$optionSets = @("x")\npac install latest\nInvoke-RestMethod -Method POST -Uri "https://org.crm.dynamics.com/api/data/v9.2/entities"\n';
    const tp = makeTranscript('script:\n\n' + B3 + 'powershell\n' + badPs + B3 + '\nDone.');
    try {
        const r = runHook(mkpayload(tp));
        assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode);
        assert('stderr has linter marker', r.stderr.includes('[dataverse-linter/stop]'), r.stderr.slice(0, 200));
        assert('stderr has rule ID', /\[R\d+\]/.test(r.stderr), r.stderr.slice(0, 200));
    } finally { try { fs.unlinkSync(tp); } catch (_) {} }
}

// ---------------------------------------------------------------------------
// STOP-2: Clean PS fenced block -- must pass (exit 0)
// Satisfies R28 (idempotency guard), no banned patterns, valid PS structure.
// ---------------------------------------------------------------------------
console.log('\nSTOP-2: Clean PS block...');
{
    const cleanPs = '#Requires -PSEdition Desktop\n$optionSets = @("adv_Status")\nStart-Transcript -Path "C:\\\\Temp\\\\log.txt"\n$existing = $null\nif ($null -eq $existing) { Write-Host "ok" }\nStop-Transcript\n';
    const tp = makeTranscript('Use:\n\n' + B3 + 'pwsh\n' + cleanPs + B3);
    try {
        const r = runHook(mkpayload(tp));
        assert('exit code is 0', r.exitCode === 0, 'got ' + r.exitCode + '; ' + r.stderr.slice(0, 200));
    } finally { try { fs.unlinkSync(tp); } catch (_) {} }
}

// ---------------------------------------------------------------------------
// STOP-3: No PS fenced blocks in assistant text -- must pass (exit 0)
// ---------------------------------------------------------------------------
console.log('\nSTOP-3: No PS fenced blocks...');
{
    const tp = makeTranscript('Prose only. No code blocks.');
    try {
        const r = runHook(mkpayload(tp));
        assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode);
    } finally { try { fs.unlinkSync(tp); } catch (_) {} }
}

// ---------------------------------------------------------------------------
// STOP-4: Non-PS fenced blocks only (bash + js) -- must pass (exit 0)
// Hook only matches powershell / pwsh / ps1 markers; other languages pass.
// ---------------------------------------------------------------------------
console.log('\nSTOP-4: Non-PS fenced blocks only (bash + js)...');
{
    const txt = 'Shell:\n' + B3 + 'bash\npac solution import\n' + B3 + '\nJS:\n' + B3 + 'js\nconsole.log(42);\n' + B3;
    const tp = makeTranscript(txt);
    try {
        const r = runHook(mkpayload(tp));
        assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode);
    } finally { try { fs.unlinkSync(tp); } catch (_) {} }
}

// ---------------------------------------------------------------------------
// STOP-5: Multiple blocks, one bad, one clean -- must block (exit 2)
// Even one bad block in a multi-block response triggers a block.
// ---------------------------------------------------------------------------
console.log('\nSTOP-5: Multiple blocks (one bad, one clean)...');
{
    const cleanPs = '#Requires -PSEdition Desktop\n$optionSets = @("a")\n$existing = $null\nif ($null -eq $existing) { Write-Host "ok" }\n';
    const badPs = '$optionSets = @("a")\npac install latest\nInvoke-RestMethod -Method POST -Uri "https://org.crm.dynamics.com/api/data/v9.2/entities"\n';
    const txt = 'Clean:\n' + B3 + 'powershell\n' + cleanPs.trimEnd() + '\n' + B3 + '\nBad:\n' + B3 + 'ps1\n' + badPs.trimEnd() + '\n' + B3;
    const tp = makeTranscript(txt);
    try {
        const r = runHook(mkpayload(tp));
        assert('exit code is 2', r.exitCode === 2, 'got exit ' + r.exitCode);
        assert('stderr mentions Fenced block', r.stderr.includes('Fenced block'), r.stderr.slice(0, 300));
    } finally { try { fs.unlinkSync(tp); } catch (_) {} }
}

// ---------------------------------------------------------------------------
// STOP-6: Malformed JSON payload -- must exit 0 with warning on stderr
// A bad payload must not crash or block Claude Code; degrade gracefully.
// ---------------------------------------------------------------------------
console.log('\nSTOP-6: Malformed JSON payload...');
{
    const r = runHook('{ NOT VALID JSON !!!');
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode);
    assert('stderr has skipping warning', r.stderr.includes('skipping lint'), r.stderr.slice(0, 200));
}

// ---------------------------------------------------------------------------
// STOP-7: Missing transcript_path field -- must pass (exit 0)
// Hook cannot read transcript; degrades gracefully without blocking.
// ---------------------------------------------------------------------------
console.log('\nSTOP-7: Payload missing transcript_path...');
{
    const r = runHook(JSON.stringify({ hook_event_name: 'Stop', session_id: 'x', cwd: os.tmpdir() }));
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode);
}

// ---------------------------------------------------------------------------
// STOP-8: transcript_path points to non-existent file -- must pass (exit 0)
// ---------------------------------------------------------------------------
console.log('\nSTOP-8: Non-existent transcript_path...');
{
    const noFile = path.join(os.tmpdir(), 'no-file-dvlint.jsonl');
    const r = runHook(JSON.stringify({ hook_event_name: 'Stop', session_id: 'x', transcript_path: noFile, cwd: os.tmpdir() }));
    assert('exit code is 0', r.exitCode === 0, 'got exit ' + r.exitCode);
}

console.log('\nStop hook probes: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
