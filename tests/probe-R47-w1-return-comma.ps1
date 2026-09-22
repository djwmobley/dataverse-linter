# PROBE R47: w1-return-comma
# Return-shape row: `return ,expr` (space after comma allowed).
# R47 MUST fire.

function Get-Wrapped {
    return ,$x
}
Get-Wrapped | Sort-Object
