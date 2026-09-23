# PROBE R47: alias-flag-new-alias-foreach
# Alias extension: `New-Alias` defined inside a control-flow-introduced block (`foreach`) is a
# visible, keyword-introduced block position -- not an opaque assigned/passed scriptblock -- so
# the alias still resolves to the W-shaped target and the later pipe use must flag.
# R47 MUST fire.

function Get-Wrapped {
    return ,$x
}
foreach ($n in 1..1) {
    New-Alias gw Get-Wrapped
}
gw | Sort-Object
