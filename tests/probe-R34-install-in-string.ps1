# PROBE R34-install-in-string: "pac install" inside a double-quoted string.
# The rule uses strippedContent (full-line # comments stripped).
# String literals are NOT stripped from strippedContent, so "pac install" inside
# a string value would still match the pattern.
#
# EXPECTED BEHAVIOR: R34 FIRES (false positive — the string is a description or
# echo, not an actual pac invocation). This is a known limitation of strippedContent
# vs noCommentNoStringContent. The probe documents this gap explicitly.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Write-Host "To install: pac install latest is NOT a valid command. Use pac application install instead."
}
