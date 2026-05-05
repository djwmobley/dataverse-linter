# PROBE R33-basic-trigger: Minimal trigger for Publish-PnPPage.
# Publish-PnPPage does not exist in PnP.PowerShell 3.x. The replacement is
# Set-PnPPage -Identity <name> -Publish. R33 MUST fire on this file.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Publish-PnPPage -Identity "Home.aspx"
}
