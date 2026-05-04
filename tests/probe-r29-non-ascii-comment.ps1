# PROBE: R29 — non-ASCII character in a comment is harmless
# The em-dash (U+2014) and section sign (§) below appear only in comments
# and in a single-quoted string, NOT in any double-quoted literal.
# R29 must NOT fire on this file.
# Example note: "Deploy complete — see notes §3 for details" (in comment, safe)

$optionSets = @("a")
Start-Transcript -Path "$env:TEMP\log.txt"

$existing = $null
if ($null -eq $existing) {
    # em-dash — used in comment prose only
    $msg = 'single-quoted: em-dash — is fine here'
    Write-Host "All clean"
}

Stop-Transcript
