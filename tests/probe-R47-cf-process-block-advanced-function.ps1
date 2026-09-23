# PROBE R47: cf-process-block-advanced-function
# Control-flow fix: `begin`/`process`/`end` blocks of an advanced function are part of the
# function's own body -- a `return ,$x` inside `process { }` counts toward shape.
# R47 MUST fire.

function F {
    [CmdletBinding()]
    param()
    begin {
        $z = 1
    }
    process {
        return ,$x
    }
    end {
        Write-Host 'done'
    }
}
F | Sort-Object
