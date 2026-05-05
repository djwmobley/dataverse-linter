# PROBE R35-bound-variables: ParseFile with REAL bound variables — correct usage.
# $tokens and $errs are bound and accessible after the call.
# The diagnostic output is NOT discarded. R35 MUST NOT fire.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    $tokens = $null
    $errs = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$errs)
    if ($errs.Count -gt 0) {
        Write-Error "Parse errors found: $($errs[0].Message)"
    }
}
