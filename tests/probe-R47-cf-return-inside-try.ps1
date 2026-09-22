# PROBE R47: cf-return-inside-try
# Control-flow fix: a `return ,$x` inside a `try` block counts toward the enclosing function's
# shape, same as `if`.
# R47 MUST fire.

function F {
    try {
        return ,$x
    } catch {
        return $null
    }
}
F | Sort-Object
