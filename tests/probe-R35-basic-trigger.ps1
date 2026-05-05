# PROBE R35-basic-trigger: ParseFile with both output args as [ref]$null.
# [Parser]::ParseFile($p, [ref]$null, [ref]$null) discards ALL diagnostic output.
# Both 'tokens' and 'errors' are out parameters; [ref]$null writes them into
# unreachable references. The caller cannot inspect the parse result.
# R35 MUST fire on this file.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$null, [ref]$null)
}
