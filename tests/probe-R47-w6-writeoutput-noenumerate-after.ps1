# PROBE R47: w6-writeoutput-noenumerate-after
# Return-shape row: `Write-Output X -NoEnumerate` (flag after the value).
# R47 MUST fire.

function Get-Wrapped {
    Write-Output $x -NoEnumerate
}
Get-Wrapped | Sort-Object
