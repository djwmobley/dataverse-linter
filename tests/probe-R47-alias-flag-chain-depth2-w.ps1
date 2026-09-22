# PROBE R47: alias-flag-chain-depth2-w
# Alias extension: an alias-to-alias chain (depth 2: gw2 -> gw1 -> Get-Wrapped) resolves
# transitively to the W-shaped function at the end of the chain and must flag, well within the
# depth-4 resolution limit.
# R47 MUST fire.

function Get-Wrapped {
    return ,$x
}
Set-Alias gw1 Get-Wrapped
Set-Alias gw2 gw1
gw2 | Sort-Object
