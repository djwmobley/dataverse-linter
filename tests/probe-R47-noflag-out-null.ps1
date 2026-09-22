# PROBE R47: noflag-out-null
# Call-site row: `F | Out-Null`.
# R47 MUST NOT fire.

function Get-Wrapped {
    return ,$x
}
Get-Wrapped | Out-Null
