# PROBE: system-entity-cascade hardcodes only systemuser/businessunit/team
# Other built-in entities (account, contact, role, organization, email, task, ...)
# get NO cascade check. Cascade=Cascade against these is just as risky.
$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    $payload = @"
{
    "SchemaName": "sample_initiative_account",
    "ReferencedEntity": "account",
    "ReferencingEntity": "sample_initiative",
    "CascadeConfiguration": {
        "Assign": "Cascade",
        "Delete": "Cascade",
        "Merge": "Cascade",
        "Reparent": "Cascade",
        "Share": "Cascade",
        "Unshare": "Cascade"
    }
}
"@
    Invoke-RestMethod -Method POST -Body $payload
}

Stop-Transcript
