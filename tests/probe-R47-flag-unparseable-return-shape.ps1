# PROBE R47: flag-unparseable-return-shape
# Call-site row: the function body's return shape cannot be parsed at all (here, an unclosed function body) -- unparseable defaults to flag, never a silent pass.
# R47 MUST fire.

function Get-Wrapped {
    return ,$x
Get-Wrapped | Sort-Object
