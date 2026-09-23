# PROBE R47: noflag-paren-where
# Call-site row: `(F).Where{}`.
# R47 MUST NOT fire.

function Get-Wrapped {
    return ,$x
}
(Get-Wrapped).Where({ $true })
