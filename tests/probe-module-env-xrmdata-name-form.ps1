# PROBE module-env-xrmdata-name-form: Import-Module -Name Microsoft.Xrm.Data.PowerShell
# without #Requires -PSEdition Desktop. The original import_pattern only matched
# `Import-Module Microsoft.Xrm.Data.PowerShell` (no -Name). Idiomatic PowerShell
# allows the explicit -Name parameter form; the import_pattern now accepts it
# via the optional (?:\s+-Name)? group.
# module-env-mismatch MUST fire on this fixture.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Import-Module -Name Microsoft.Xrm.Data.PowerShell
    Write-Host "Module loaded via -Name form; missing #Requires -PSEdition Desktop"
}
