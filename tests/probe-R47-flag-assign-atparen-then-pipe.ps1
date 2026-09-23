# PROBE R47: flag-assign-atparen-then-pipe
# Call-site row: `$r = @(F); $r | ...`.
# R47 MUST fire.

function Get-Wrapped {
    return ,$x
}
$r = @(Get-Wrapped)
$r | Sort-Object
