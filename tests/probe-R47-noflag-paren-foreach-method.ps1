# PROBE R47: noflag-paren-foreach-method
# Call-site row: `(F).ForEach{}`.
# R47 MUST NOT fire.

function Get-Wrapped {
    return ,$x
}
(Get-Wrapped).ForEach({ $_ })
