# PROBE R47: flag-atparen-wrap-pipe
# Call-site row: `@(F) | ...`.
# R47 MUST fire.

function Get-Wrapped {
    return ,$x
}
@(Get-Wrapped) | Sort-Object
