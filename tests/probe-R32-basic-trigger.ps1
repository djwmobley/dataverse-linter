# PROBE R32-basic-trigger: Minimal trigger for Connect-PnPOnline -TenantId
# -TenantId is not a valid parameter on Connect-PnPOnline (PnP.PowerShell 3.x).
# The correct parameter is -Tenant. This script uses -TenantId exactly as an
# author would accidentally write it. R32 MUST fire.
#
# The fixture includes an `if ($null -eq $existing)` guard so R28 does not fire,
# isolating R32 as the single rule under test.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Connect-PnPOnline -Url "https://contoso.sharepoint.com" -TenantId "contoso.onmicrosoft.com"
}
