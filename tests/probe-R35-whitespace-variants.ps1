# PROBE R35-whitespace-variants: Extra whitespace between ParseFile args.
# Authors sometimes add extra spaces inside the argument list for readability.
# The R35 pattern uses \s* around punctuation to handle this.
# R35 MUST fire even with extra spaces around [ref]$null arguments.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    $ast = [System.Management.Automation.Language.Parser]::ParseFile( $scriptPath , [ref]$null , [ref]$null )
}
