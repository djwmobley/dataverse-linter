# PROBE R12: neither Connect-CrmOnlineDiscovery nor the Xrm.Tooling import
# appears in this file. R12 MUST NOT fire.

$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    Write-Host "Plain script with no R12-relevant content."
}

Stop-Transcript
