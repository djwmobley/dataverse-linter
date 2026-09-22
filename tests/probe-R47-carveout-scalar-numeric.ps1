# PROBE R47: carveout-scalar-numeric
# Carve-out: unary comma whose operand is a bare NUMERIC literal is a runtime no-op scalar wrap -- treated as P, not W.
# R47 MUST NOT fire.

function Get-Wrapped {
    return ,5
}
Get-Wrapped | Sort-Object
