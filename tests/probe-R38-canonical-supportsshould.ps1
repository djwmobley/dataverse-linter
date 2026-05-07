# Probe 4 (NO FIRE): [CmdletBinding(SupportsShouldProcess=$true)] present.
# This is the canonical correct form. R38 must NOT fire.
[CmdletBinding(SupportsShouldProcess=$true)]
param(
    [string]$Environment
)

if ($PSCmdlet.ShouldProcess($Environment, "Deploy")) {
    Write-Host "Deploying to $Environment"
}
