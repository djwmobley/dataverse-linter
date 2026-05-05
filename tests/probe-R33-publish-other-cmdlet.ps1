# PROBE R33-publish-other-cmdlet: Publish-Something-Else must NOT trigger R33.
# The pattern is \bPublish-PnPPage\b with word boundaries.
# Other cmdlets containing "Publish" (Publish-PnPFile, Publish-Module, etc.)
# must not match. This tests that the word-boundary anchor prevents partial matches.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Publish-PnPFile -ServerRelativeUrl "/sites/contoso/Documents/report.pdf" -Approve
}
