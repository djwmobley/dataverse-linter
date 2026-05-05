# PROBE R33-set-pnppage-correct: Correct replacement for Publish-PnPPage.
# Set-PnPPage -Identity <name> -Publish is the documented 3.x replacement.
# R33 MUST NOT fire on this file.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Set-PnPPage -Identity "Home.aspx" -Publish
}
