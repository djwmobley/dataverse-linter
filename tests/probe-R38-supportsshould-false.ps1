# Probe: (FIRE) [CmdletBinding(SupportsShouldProcess=$false)] + [switch]$WhatIf.
# Explicit opt-out from SupportsShouldProcess combined with a manual switch.
# SupportsShouldProcess=$false does NOT satisfy the requires_absent guard
# (the guard requires SupportsShouldProcess without =$false).
# R38 must fire.
[CmdletBinding(SupportsShouldProcess=$false)]
param(
    [string]$Environment,
    [switch]$WhatIf
)

if ($WhatIf) {
    Write-Host "WhatIf mode"
} else {
    Write-Host "Executing..."
}
