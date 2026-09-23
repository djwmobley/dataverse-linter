# PROBE R47: carveout-scalar-string
# Carve-out: unary comma whose operand is a bare STRING literal -- treated as P, not W.
# R47 MUST NOT fire.

function Get-Wrapped {
    return ,'a'
}
Get-Wrapped | Sort-Object
