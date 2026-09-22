# PROBE R47: cf-return-inside-if
# Control-flow fix: a `return ,$x` inside an `if` block is part of the enclosing function's own
# body (not an opaque nested scriptblock) -- covers the "mixed W and P exit paths: W" row for the
# canonical `if (...) { return ,$a }; return $b` shape named in the fix request.
# R47 MUST fire.

function F {
    if ($cond) {
        return ,$x
    }
    return $y
}
F | Sort-Object
