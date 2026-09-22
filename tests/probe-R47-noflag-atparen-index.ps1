# PROBE R47: noflag-atparen-index
# Call-site row: `@(F)[0]`.
# R47 MUST NOT fire.

function Get-Wrapped {
    return ,$x
}
@(Get-Wrapped)[0]
