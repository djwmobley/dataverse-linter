# PROBE R47: alias-noflag-p-piped
# Alias extension: `Set-Alias NAME TARGET` where TARGET is a P-shaped (plain) function. An alias to
# a P-shaped function is never flagged, exactly like calling the function by its own name.
# R47 MUST NOT fire.

function Get-Plain {
    return $x
}
Set-Alias gp Get-Plain
gp | Sort-Object
