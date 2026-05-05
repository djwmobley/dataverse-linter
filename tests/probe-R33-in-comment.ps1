# PROBE R33-in-comment: Publish-PnPPage appearing only inside a comment.
# strippedContent strips full-line # comments. If Publish-PnPPage appears only
# on a full-line comment, R33 (which is a regex rule using strippedContent) should
# NOT fire because the comment line is stripped before matching.
#
# Note: This behavior is correct and desirable — commenting out a deprecated call
# should not fire the rule.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    # Publish-PnPPage -Identity "Home.aspx"    <-- old call, replaced below
    Set-PnPPage -Identity "Home.aspx" -Publish
}
