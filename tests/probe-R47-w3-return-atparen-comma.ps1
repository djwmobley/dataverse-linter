# PROBE R47: w3-return-atparen-comma
# Return-shape row: `return @(,expr)`.
# R47 MUST fire.

function Get-Wrapped {
    return @(,$x)
}
Get-Wrapped | Sort-Object
