#Requires -PSEdition Desktop
# PROBE: module-env-ok - module imported WITH the required PSEdition directive
# This script has #Requires -PSEdition Desktop at the top, so module-env-mismatch
# must NOT fire. R12 will still fire unconditionally (expected).

$optionSets = @("a")
Start-Transcript -Path "C:\Temp\log.txt"

Import-Module Microsoft.Xrm.Tooling.CrmConnector.PowerShell

$existing = $null
if ($null -eq $existing) {
    Write-Host "Module loaded with correct runtime requirement declared"
}

Stop-Transcript
