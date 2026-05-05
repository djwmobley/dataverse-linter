# PROBE R36-capitalized-type: [DateTime]::TryParse (capital D) with [ref]$null.
# The R36 pattern is \[datetime\]::TryParse — lowercase "datetime".
# PowerShell type accelerators are case-insensitive, but the linter regex is case-sensitive.
#
# EXPECTED BEHAVIOR: R36 does NOT fire on [DateTime]::TryParse (capital D).
# This documents the case-sensitivity limitation. Authors using [DateTime] (as some
# do for clarity) would bypass the rule.
# KNOWN FALSE NEGATIVE — documented as a scope limit in README.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    $dateStr = "2026-05-04"
    $isValid = [DateTime]::TryParse($dateStr, [ref]$null)
}
