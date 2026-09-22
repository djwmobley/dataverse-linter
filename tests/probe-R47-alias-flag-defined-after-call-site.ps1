# PROBE R47: alias-flag-defined-after-call-site
# Alias extension: an alias whose `Set-Alias` definition appears AFTER its call site in the file
# still resolves, exactly like a function definition appearing after its own call site (whole-file
# scan, not a position-ordered one).
# R47 MUST fire.

function Get-Wrapped {
    return ,$x
}
gw | Sort-Object
Set-Alias gw Get-Wrapped
