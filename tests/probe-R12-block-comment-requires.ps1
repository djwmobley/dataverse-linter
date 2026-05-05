<# #Requires -Version 5.1 #>
# PROBE R12 (v0.4.1, round-2 SHOWSTOPPER): a `#Requires` directive nested inside
# a single-line `<# ... #>` block comment is NOT honored by PowerShell at parse
# time, so the script will hang in pwsh exactly as R12 is supposed to prevent.
# The v0.3.1 conjunction-aware guard tested rule.requires_absent against
# rawContent, which spuriously matched the comment-internal lexeme. The v0.4.1
# fix introduces stripBlockComments() and tests the guard against
# rawContentNoBlockComments. R12 MUST fire here.
#
# Round-1 precedent: every documented limitation must be pinned by an asserting
# probe (per feedback_dataverse_linter_gate.md). This probe pins the round-2
# correctness gain.
#
# Citations (substrate):
#   - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_comments
#     ("PowerShell comment styles", Important callout): "you can't nest block
#     comments. If you attempt to nest block comments, the outer block comment
#     ends at the first `#>` encountered."
#   - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_requires
#     ("Examples"): "Each `#Requires` statement must be the first item on a line".
#     Inside a `<# ... #>` block, body lines are comment content; a `#Requires`
#     lexeme there is not a directive and PowerShell does not honor it.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Connect-CrmOnlineDiscovery -InteractiveMode
}
