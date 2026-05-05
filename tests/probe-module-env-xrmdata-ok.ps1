#Requires -PSEdition Desktop
# PROBE module-env-xrmdata-ok: Import-Module Microsoft.Xrm.Data.PowerShell
# WITH #Requires -PSEdition Desktop present.
# When the required directive is present, module-env-mismatch MUST NOT fire.
# The script is otherwise clean; expectClean is false only because other
# incidental rules may fire (none expected here since there is no pac/odata usage).

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Import-Module Microsoft.Xrm.Data.PowerShell
    Write-Host "Module loaded under Desktop edition as required"
}
