# PROBE R25: $body = @{ ... } inside a function declaration body.
# v0.3.1 scope-aware R25 MUST NOT fire: PowerShell function bodies have their
# own variable scope; a $body assignment inside a function does not shadow
# $script:body (which is the failure mode R25 catches).
#
# This probe is the regression anchor for the v0.3.0 false positive that
# caused wire_cross_module_connections.ps1 v0.2 line 167 to be linted as a
# violation when the assignment was function-local.

$optionSets = @("a")
Start-Transcript

function Create-LookupFromRow {
    param([string]$Name)
    $body = @{
        SchemaName = $Name
        AttributeType = "Lookup"
    }
    return $body
}

$existing = $null
if ($null -eq $existing) {
    $myValue = Create-LookupFromRow -Name "test"
}

Stop-Transcript
