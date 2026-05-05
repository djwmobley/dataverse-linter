# PROBE R32-different-cmdlet-tenantid: -TenantId on a different cmdlet must NOT trigger R32.
# R32 specifically checks for Connect-PnPOnline followed by -TenantId on the same
# line. A cmdlet like Connect-AzAccount -TenantId is a legitimate call (Azure cmdlets
# do use -TenantId). The pattern anchors on Connect-PnPOnline so this must not fire.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Connect-AzAccount -TenantId "f7c161a5-9ff0-48be-901d-62a88277c927"
}
