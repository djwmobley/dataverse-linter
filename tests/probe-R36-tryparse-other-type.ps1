# PROBE R36-tryparse-other-type: [int]::TryParse($s, [ref]$null) must NOT trigger R36.
# The R36 pattern is anchored to [datetime]::TryParse. Other type TryParse calls
# (e.g., [int]::TryParse, [guid]::TryParse) may have similar semantics but are
# out of scope for this rule.
# R36 MUST NOT fire.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    $numStr = "42"
    $isValid = [int]::TryParse($numStr, [ref]$null)
}
