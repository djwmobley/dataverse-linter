# Probe 1 (FIRE): param([switch]$WhatIf) with no CmdletBinding at all.
# R38 must fire: SupportsShouldProcess is entirely absent.
param(
    [string]$Environment,
    [switch]$WhatIf
)

if ($WhatIf) {
    Write-Host "WhatIf mode -- no changes made."
} else {
    Write-Host "Making changes..."
}
