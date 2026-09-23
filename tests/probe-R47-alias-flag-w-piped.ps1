# PROBE R47: alias-flag-w-piped
# Alias extension: `Set-Alias NAME TARGET` where TARGET is a W-shaped function. Piping the alias
# directly must flag exactly like piping the underlying function would.
# R47 MUST fire.

function Get-Wrapped {
    return ,$x
}
Set-Alias gw Get-Wrapped
gw | Sort-Object
