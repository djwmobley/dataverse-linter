# PROBE module-env-xrmdata-missing: Import-Module Microsoft.Xrm.Data.PowerShell
# without #Requires -PSEdition Desktop.
# Microsoft.Xrm.Data.PowerShell is Desktop-only (not compatible with pwsh 7 Core).
# A script that imports it without the #Requires directive will silently exit at
# import time when launched under pwsh.exe.
# module-env-mismatch MUST fire on this file.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Import-Module Microsoft.Xrm.Data.PowerShell
    Write-Host "Module loaded"
}
