# PROBE R47: flag-foreach-in
# Call-site row: `foreach ($i in F) { }` -- the loop body empirically runs once with the whole array.
# R47 MUST fire.

function Get-Wrapped {
    return ,$x
}
foreach ($i in Get-Wrapped) {
    Write-Host $i
}
