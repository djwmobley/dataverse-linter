# PROBE R35-one-null-arg: ParseFile with only ONE [ref]$null argument.
# R35 only flags the case where BOTH output args are [ref]$null.
# This is a documented scope limit: discarding only one output (tokens OR errors)
# is a partial capture and is not flagged by R35.
#
# This probe uses [ref]$null for the tokens arg but binds a real variable for errors.
# R35 MUST NOT fire (single-null case is out of R35 scope).

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    $errs = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$null, [ref]$errs)
}
