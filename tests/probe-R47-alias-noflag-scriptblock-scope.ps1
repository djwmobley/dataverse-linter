# PROBE R47: alias-noflag-scriptblock-scope
# Alias extension: an alias defined inside an anonymously-invoked `& { }` scriptblock is inside an
# opaque, assigned/passed-style scriptblock -- consistent with the existing R47 scriptblock
# exclusion -- so the alias definition is never observed and the later use resolves to shape X
# (undefined, never flagged).
# R47 MUST NOT fire.

function Get-Wrapped {
    return ,$x
}
& {
    Set-Alias gw Get-Wrapped
}
gw | Sort-Object
