# PROBE: R31 - known-bad cmdlet+parameter combination
# Connect-CrmOnlineDiscovery does not expose -ShowProgress in
# Microsoft.Xrm.Data.PowerShell v2.8.21. Using it causes NamedParameterNotFound
# at runtime. R31 MUST fire on this file.
#
# R12 will also fire (Connect-CrmOnlineDiscovery is flagged unconditionally).

$optionSets = @("a")
Start-Transcript -Path "C:\Temp\log.txt"

$existing = $null
if ($null -eq $existing) {
    Connect-CrmOnlineDiscovery -InteractiveMode -ShowProgress $false
}

Stop-Transcript
