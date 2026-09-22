# PROBE R47: noflag-null-assign
# Call-site row: `$null = F`.
# R47 MUST NOT fire.

function Get-Wrapped {
    return ,$x
}
$null = Get-Wrapped
