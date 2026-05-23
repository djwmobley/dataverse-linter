# PROBE 6: JSON-shaped @"..."@ with PS interpolation must produce interpolation-specific message
# The here-string body contains $($v) and an @odata.type key.
# The "@ inside the body causes payloadRegex to terminate early, producing broken JSON.
# Since the broken body also contains $( , the interpolation-specific message fires.
# This regression-guards the interpolation detection path against the prose-skip fix.
$optionSets = @("good")
Start-Transcript

$v = "somevalue"
$existing = $null
if ($null -eq $existing) {
    $payload = @"
{
    "ParentTable": "$($v)",
    "@odata.type": "#Microsoft.Dynamics.CRM.BooleanAttributeMetadata"
}
"@
    Invoke-RestMethod -Method POST -Body $payload
}

Stop-Transcript