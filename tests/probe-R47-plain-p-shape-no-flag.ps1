# PROBE R47: plain-p-shape-no-flag
# Shape P: every other return (a plain, unwrapped return value). Any call site is never flagged.
# R47 MUST NOT fire.

function Get-Plain {
    return $obj
}
Get-Plain | Sort-Object
