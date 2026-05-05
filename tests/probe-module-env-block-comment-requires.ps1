# PROBE module-env-mismatch-block-comment-requires (v0.4.2):
# Round-3 reviewer of PR #3 reproduction:
# A `#Requires -PSEdition Desktop` directive nested inside a `<# ... #>`
# block comment does NOT satisfy module-env-mismatch's directive presence
# check after v0.4.2. Before v0.4.2 the check ran against rawContent and
# would falsely accept the comment-internal lexeme; v0.4.2 changes the
# check to rawContentNoBlockComments to mirror the v0.4.1 R12 fix on the
# requires_absent path.
#
# Expected behavior: module-env-mismatch MUST fire. The script imports
# Microsoft.Xrm.Tooling.CrmConnector.PowerShell, which silently exits or
# hangs under pwsh 7, but PowerShell will not honor the
# block-comment-internal `#Requires` directive at parse time, so the
# script can still be launched under the wrong runtime.
#
# Substrate citations:
#   - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_comments
#     "All text within the block is treated as part of the same comment,
#     including whitespace."
#   - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_requires
#     "Each `#Requires` statement must be the first item on a line."
#     A lexeme inside a block comment is not the first item on a line.

<#
  #Requires -PSEdition Desktop
#>
# (This is the block-comment-internal directive; PS does NOT honor it.)

$optionSets = @("a")
Start-Transcript -Path "C:\Temp\log.txt"

Import-Module Microsoft.Xrm.Tooling.CrmConnector.PowerShell

$existing = $null
if ($null -eq $existing) {
    Write-Host "Module loaded under wrong runtime; PS does not honor block-comment-internal directive."
}

Stop-Transcript
