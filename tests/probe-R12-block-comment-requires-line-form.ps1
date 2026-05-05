<#
#Requires -Version 5.1
#>
# PROBE R12 (v0.4.1, round-2 SHOWSTOPPER reviewer's exact reproduction):
# `<#` and `#>` on their own lines, with `#Requires -Version 5.1` on a middle
# line at column 0. This is the canonical false-negative shape: under v0.3.1
# the guard regex `^#Requires\s+(?:-Version\s+5\.1\b|-PSEdition\s+Desktop\b)`
# with the `m` flag matched the column-0 lexeme inside the block comment, so
# requires_absent was satisfied and R12 was suppressed even though pwsh would
# hang on Connect-CrmOnlineDiscovery. The v0.4.1 fix tests the guard against
# rawContentNoBlockComments where the block-comment range has been
# space-filled. R12 MUST fire.
#
# Citations as in probe-R12-block-comment-requires.ps1 (about_Comments,
# about_Requires).

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Connect-CrmOnlineDiscovery -InteractiveMode
}
