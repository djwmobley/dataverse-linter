# PROBE R47: w7-return-var-last-assign-comma
# Return-shape row: `return $v` where the last assignment to $v is a leading unary comma expression.
# R47 MUST fire.

function Get-Wrapped {
    $v = ,$x
    return $v
}
Get-Wrapped | Sort-Object
