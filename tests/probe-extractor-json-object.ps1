# PROBE 3: Valid JSON object in @"..."@ must be parsed into payloads (regression guard)
# JSON-shaped here-string (starts with {) must still be parsed after the fix.
$optionSets = @("good")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    $payload = @"
{
    "a": 1,
    "b": "hello"
}
"@
    Invoke-RestMethod -Method POST -Body $payload
}

Stop-Transcript