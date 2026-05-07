# Probe 3 (FIRE): [Parameter()] decorator on [switch]$WhatIf does not suppress R38.
# The pattern anchors on [switch]$WhatIf regardless of preceding [Parameter(...)] attributes.
# R38 must fire.
param(
    [Parameter(HelpMessage = "Run in WhatIf mode")]
    [switch]$WhatIf
)

Write-Host "Running..."
