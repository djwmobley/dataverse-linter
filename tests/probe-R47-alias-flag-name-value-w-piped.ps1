# PROBE R47: alias-flag-name-value-w-piped
# Alias extension: `Set-Alias -Name NAME -Value TARGET` form where TARGET is a W-shaped function.
# R47 MUST fire.

function Get-Wrapped {
    return ,$x
}
Set-Alias -Name gw -Value Get-Wrapped
gw | Sort-Object
