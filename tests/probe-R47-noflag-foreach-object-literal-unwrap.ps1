# PROBE R47: noflag-foreach-object-literal-unwrap
# Call-site row: `F | ForEach-Object { $_ }` as the first stage -- literal unwrap.
# R47 MUST NOT fire.

function Get-Wrapped {
    return ,$x
}
Get-Wrapped | ForEach-Object { $_ }
