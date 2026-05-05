#Requires -PSEdition Desktop
# PROBE module-env-xrmdata-ok: Import-Module Microsoft.Xrm.Data.PowerShell
# WITH #Requires -PSEdition Desktop present.
# When the required directive is present, module-env-mismatch MUST NOT fire.
# The fixture includes a Start-Transcript-free, guard-protected Web-API-free
# body so the script is fully clean; expectClean is true.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Import-Module Microsoft.Xrm.Data.PowerShell
    Write-Host "Module loaded under Desktop edition as required"
}
