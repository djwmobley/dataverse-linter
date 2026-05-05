#Requires -Version 5.1
# PROBE R12: Connect-CrmOnlineDiscovery present WITH #Requires -Version 5.1 guard.
# v0.3.1 conjunction-aware R12 MUST NOT fire: the guard the rule is designed to
# enforce is in place; the script will be parse-rejected on pwsh 7 before any
# Connect-CrmOnlineDiscovery call can be reached.
# Citation: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_requires

$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    Connect-CrmOnlineDiscovery -InteractiveMode
}

Stop-Transcript
