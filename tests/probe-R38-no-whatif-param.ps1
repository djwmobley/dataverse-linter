# Probe 5 (NO FIRE): script with no $WhatIf parameter of any kind.
# R38 pattern does not match; rule must not fire.
param(
    [string]$Environment,
    [switch]$Verbose
)

Write-Host "Running in environment: $Environment"
