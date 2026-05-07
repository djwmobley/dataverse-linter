# Probe 2 (FIRE): function with param([switch]$WhatIf) and no CmdletBinding.
# R38 must fire: the function declares a manual WhatIf switch without SupportsShouldProcess.
function Invoke-Deployment {
    param(
        [string]$TargetEnv,
        [switch]$WhatIf
    )
    if ($WhatIf) {
        Write-Host "WhatIf: would deploy to $TargetEnv"
    } else {
        Write-Host "Deploying to $TargetEnv"
    }
}
