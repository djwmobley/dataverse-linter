# PROBE R32-basic-trigger: Minimal trigger for Connect-PnPOnline -TenantId
# -TenantId is not a valid parameter on Connect-PnPOnline (PnP.PowerShell 3.x).
# The correct parameter is -Tenant. This script uses -TenantId exactly as an
# author would accidentally write it. R32 MUST fire.
#
# Note: R28 will also fire (no idempotency guard) and R16 is deleted, so only
# R32 is asserted in mustFire for this probe.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Connect-PnPOnline -Url "https://contoso.sharepoint.com" -TenantId "contoso.onmicrosoft.com"
}
