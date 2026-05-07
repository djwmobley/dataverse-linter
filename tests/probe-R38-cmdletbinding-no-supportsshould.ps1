# Probe 6 (FIRE): [CmdletBinding()] present but SupportsShouldProcess is absent.
# CmdletBinding without SupportsShouldProcess does not wire $PSCmdlet.ShouldProcess().
# R38 must fire.
[CmdletBinding()]
param(
    [string]$Environment,
    [switch]$WhatIf
)

if ($WhatIf) {
    Write-Host "WhatIf mode"
} else {
    Write-Host "Executing..."
}
