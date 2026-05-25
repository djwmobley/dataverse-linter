# R45 probe 8 -- NO FIRE
# Normal statement: if ($condition) { ... }
# The keyword comes BEFORE the opening paren -- this is the correct PowerShell
# statement form; the paren is the condition-test delimiter, not a grouping
# operator wrapping a statement. R45 MUST NOT fire.

if ($env:BUILD_ENV -eq 'prod') {
    Write-Host "Production mode"
}

foreach ($item in Get-ChildItem .) {
    Write-Host $item.Name
}

while ($count -lt 10) {
    $count++
}
