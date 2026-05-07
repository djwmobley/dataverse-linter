# Probe: (NO FIRE) [CmdletBinding(SupportsShouldProcess)] bare-name shorthand.
# PowerShell treats bare [SupportsShouldProcess] as =$true.
# The requires_absent guard regex matches SupportsShouldProcess followed by ),
# which is the bare-name form. R38 must NOT fire.
[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$Environment
)

if ($PSCmdlet.ShouldProcess($Environment, "Deploy")) {
    Write-Host "Deploying..."
}
