# PROBE R35-parsestring-not-parsefile: [Parser]::ParseInput (not ParseFile) must NOT fire R35.
# The pattern anchors on "ParseFile". ParseInput and ParseScript are different methods
# on the Parser class; they should not be flagged by this rule.
# R35 MUST NOT fire.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    $ast = [System.Management.Automation.Language.Parser]::ParseInput($scriptContent, [ref]$null, [ref]$null)
}
