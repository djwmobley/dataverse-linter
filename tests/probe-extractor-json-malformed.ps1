# PROBE 5: JSON-shaped but malformed here-string must STILL produce extractor-json-error
# The JSON-shape filter (starts with {) does NOT suppress real broken JSON payloads.
$optionSets = @("good")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    $payload = @"
{ broken
"@
    Invoke-RestMethod -Method POST -Body $payload
}

Stop-Transcript