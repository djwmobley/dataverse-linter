# PROBE: extractor silently drops payloads that JSON.parse cannot read
# Anything with PowerShell variable interpolation in the body becomes invisible
$optionSets = @("good")
Start-Transcript

$tableId = "abc"
$existing = $null
if ($null -eq $existing) {
    $payload = @"
{
    "ParentTable": "$($tableId)",
    "global_optionset@odata.bind": "/GlobalOptionSetDefinitions(Name='missing_optionset')",
    "@odata.type": "#Microsoft.Dynamics.CRM.BooleanAttributeMetadata",
    "SchemaName": "bad_bool"
}
"@
    Invoke-RestMethod -Method POST -Body $payload
}

Stop-Transcript
