# PROBE R33-inline-comment-false-positive: Publish-PnPPage in a trailing inline comment.
# strippedContent removes full-line # comments but RETAINS inline comments after code.
# If Publish-PnPPage appears in a trailing comment on a code line, R33 may still fire
# because strippedContent preserves the trailing comment text.
#
# EXPECTED BEHAVIOR: R33 FIRES (the pattern matches the text in the inline comment
# because strippedContent does not strip inline comments). This is a known limitation
# documented here as a regression anchor. The workaround is to remove deprecated
# cmdlet names from inline comments or move them to full-line comments.
#
# The probe asserts: R33 fires (even though it is a false positive for correct code).

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Set-PnPPage -Identity "Home.aspx" -Publish  # Previously: Publish-PnPPage -Identity "Home.aspx"
}
