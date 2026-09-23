# PROBE R47: mixed-w-and-p
# Mixed W and P exit paths in one function: W (any W-shaped return path makes the whole function W).
# R47 MUST fire.

function Get-Wrapped {
    if ($cond) {
        return $obj
    }
    return ,$x
}
Get-Wrapped | Sort-Object
