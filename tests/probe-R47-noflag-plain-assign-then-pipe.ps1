# PROBE R47: noflag-plain-assign-then-pipe
# Call-site row: `$r = F; $r | ...` -- plain assignment unwraps.
# R47 MUST NOT fire.

function Get-Wrapped {
    return ,$x
}
$r = Get-Wrapped
$r | Sort-Object
