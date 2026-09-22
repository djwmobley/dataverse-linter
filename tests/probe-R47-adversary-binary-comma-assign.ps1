# PROBE R47: adversary-binary-comma-assign
# Adversary case: binary/list comma assign `$x = 1,2,3; return $x` -- P, not W (no flag).
# R47 MUST NOT fire.

function Get-List {
    $x = 1,2,3
    return $x
}
Get-List | Sort-Object
