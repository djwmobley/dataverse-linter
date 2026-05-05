#Requires -PSEdition Desktop
# PROBE module-env-mismatch-line-comment-still-works (v0.4.2):
# Regression anchor for the v0.4.2 module-env-mismatch fix:
# A canonical line-comment `#Requires -PSEdition Desktop` directive (NOT
# inside `<# #>`) MUST continue to be recognized as a guard after the
# rawContent -> rawContentNoBlockComments change. Pins line-comment
# directive recognition so future widening of stripBlockComments cannot
# regress it.
#
# module-env-mismatch MUST NOT fire here. The script imports
# Microsoft.Xrm.Tooling.CrmConnector.PowerShell with the proper line-comment
# directive in place; PS honors this and the script will not launch under
# pwsh 7.

$optionSets = @("a")
Start-Transcript -Path "C:\Temp\log.txt"

Import-Module Microsoft.Xrm.Tooling.CrmConnector.PowerShell

$existing = $null
if ($null -eq $existing) {
    Write-Host "Module loaded with correct runtime requirement declared at column 0."
}

Stop-Transcript
