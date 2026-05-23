# PROBE 4: Valid JSON array in @"..."@ must be parsed into payloads (regression guard)
# Array-shaped here-string (starts with [) must still be parsed after the fix.
$optionSets = @("good")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    $payload = @"
[
    { "id": 1 },
    { "id": 2 }
]
"@
    Invoke-RestMethod -Method POST -Body $payload
}

Stop-Transcript