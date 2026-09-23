# PROBE R47: w2-return-paren-comma
# Return-shape row: `return (,expr)`.
# R47 MUST fire.

function Get-Wrapped {
    return (,$x)
}
Get-Wrapped | Sort-Object
