# PROBE R12: Connect-CrmOnlineDiscovery present, no #Requires guard.
# v0.3.1 conjunction-aware R12 MUST fire because rawContent has neither
#   '#Requires -Version 5.1'  nor  '#Requires -PSEdition Desktop'.
# Citation: https://www.powershellgallery.com/packages/Microsoft.Xrm.Tooling.CrmConnector.PowerShell
#   declares minimum PowerShell version 5.1 and PSEdition Desktop. The cmdlet hangs in pwsh 7.

$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    Connect-CrmOnlineDiscovery -InteractiveMode
}

Stop-Transcript
