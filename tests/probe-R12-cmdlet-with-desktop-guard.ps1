#Requires -PSEdition Desktop
# PROBE R12: Connect-CrmOnlineDiscovery present WITH #Requires -PSEdition Desktop guard.
# v0.3.1 conjunction-aware R12 MUST NOT fire: the Desktop edition guard is the
# more semantically correct guard (Desktop edition === Windows PowerShell, which
# in the modern stack means 5.1). PowerShell Gallery package metadata for
# Microsoft.Xrm.Tooling.CrmConnector.PowerShell declares PSEdition Desktop and
# minimum PowerShell version 5.1; either guard is sufficient to prevent the
# script from being run under pwsh 7 (where the cmdlet hangs).
# Citation: https://www.powershellgallery.com/packages/Microsoft.Xrm.Tooling.CrmConnector.PowerShell

$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    Connect-CrmOnlineDiscovery -InteractiveMode
}

Stop-Transcript
