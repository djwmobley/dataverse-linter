# PROBE: module-env-mismatch - module imported without required PSEdition directive
# Microsoft.Xrm.Tooling.CrmConnector.PowerShell requires PowerShell 5.1 Desktop.
# This script imports it (via Import-Module) but omits #Requires -PSEdition Desktop.
# module-env-mismatch MUST fire on this file.
# R12 will also fire unconditionally.

$optionSets = @("a")
Start-Transcript -Path "C:\Temp\log.txt"

Import-Module Microsoft.Xrm.Tooling.CrmConnector.PowerShell

$existing = $null
if ($null -eq $existing) {
    Write-Host "Module loaded"
}

Stop-Transcript
