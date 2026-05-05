# PROBE R32-correct-tenant: Connect-PnPOnline with the CORRECT -Tenant parameter.
# -Tenant is the documented parameter name; -TenantId is absent from the PnP docs.
# R32 MUST NOT fire on this script.
#
# This is a clean-path negative probe. The idempotency guard and
# $optionSets are present to avoid unrelated violations muddying the probe.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Connect-PnPOnline -Url "https://contoso.sharepoint.com" -Tenant "contoso.onmicrosoft.com" -Interactive
}
