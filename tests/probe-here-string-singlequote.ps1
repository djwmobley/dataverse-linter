# PROBE: extractor only reads @"..."@ here-strings, not @'...'@
# Single-quote here-strings are common when devs want literal $-signs in JSON
$optionSets = @("good")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    $payload = @'
{
    "name": "Test",
    "global_optionset@odata.bind": "/GlobalOptionSetDefinitions(Name='missing_optionset')",
    "@odata.type": "#Microsoft.Dynamics.CRM.BooleanAttributeMetadata",
    "SchemaName": "bad_bool",
    "SourceType": 3
}
'@
    Invoke-RestMethod -Method POST -Body $payload
}

Stop-Transcript
