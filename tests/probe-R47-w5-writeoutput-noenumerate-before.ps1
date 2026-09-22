# PROBE R47: w5-writeoutput-noenumerate-before
# Return-shape row: `Write-Output -NoEnumerate X`.
# R47 MUST fire.

function Get-Wrapped {
    Write-Output -NoEnumerate $x
}
Get-Wrapped | Sort-Object
