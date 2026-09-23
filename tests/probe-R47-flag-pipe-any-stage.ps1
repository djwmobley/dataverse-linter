# PROBE R47: flag-pipe-any-stage
# Call-site row: `F | <any stage>` -- the general pipe rule.
# R47 MUST fire.

function Get-Wrapped {
    return ,$x
}
Get-Wrapped | Select-Object -First 1
