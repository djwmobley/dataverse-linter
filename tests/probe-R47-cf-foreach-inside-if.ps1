# PROBE R47: cf-foreach-inside-if
# Control-flow fix: nesting of control-flow blocks -- `if (...) { foreach (...) { return ,$x } }`
# must still count toward the enclosing function's shape (both blocks are keyword-introduced).
# R47 MUST fire.

function F {
    if ($cond) {
        foreach ($item in $items) {
            return ,$x
        }
    }
    return $y
}
F | Sort-Object
