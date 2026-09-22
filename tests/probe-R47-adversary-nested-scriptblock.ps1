# PROBE R47: adversary-nested-scriptblock
# Adversary case: nested scriptblock `$sb = { return ,$x }; & $sb; return $y` -- the scriptblock's own `return` must not leak into the enclosing function's shape (no flag).
# R47 MUST NOT fire.

function Get-Value {
    $sb = { return ,$x }
    & $sb
    return $y
}
Get-Value | Sort-Object
