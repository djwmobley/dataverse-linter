# Probe 7 (NO FIRE): [bool]$WhatIf -- different type, not [switch].
# R38 anchors on [switch]\s*$WhatIf. A [bool]$WhatIf is a different declaration
# and by design is not in scope for this rule. R38 must NOT fire.
param(
    [string]$Environment,
    [bool]$WhatIf = $false
)

if ($WhatIf) {
    Write-Host "WhatIf mode"
} else {
    Write-Host "Executing..."
}
