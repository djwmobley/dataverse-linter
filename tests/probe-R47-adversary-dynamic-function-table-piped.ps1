# PROBE R47: adversary-dynamic-function-table-piped
# Adversary case: ${function:F} = { return ,$x } piped -- flag.
# R47 MUST fire.

${function:Get-Wrapped} = { return ,$x }
Get-Wrapped | Sort-Object
