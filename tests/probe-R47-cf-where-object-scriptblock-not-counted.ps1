# PROBE R47: cf-where-object-scriptblock-not-counted
# Control-flow fix regression anchor: a scriptblock PASSED AS AN ARGUMENT (Where-Object { }) is
# NOT keyword-introduced -- it remains an opaque nested scriptblock excluded from the enclosing
# function's shape, even though it contains `return ,$x`. F's own return is plain, so F is P.
# R47 MUST NOT fire.

function F {
    $items | Where-Object { return ,$x }
    return $plain
}
F | Sort-Object
