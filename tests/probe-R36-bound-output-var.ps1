# PROBE R36-bound-output-var: 2-argument TryParse with a real bound output variable.
# [datetime]::TryParse($s, [ref]$parsedDate) where $parsedDate is a real variable
# is the correct 2-argument usage that produces a usable result. R36 MUST NOT fire.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    $dateStr = "2026-05-04"
    $parsedDate = [datetime]::MinValue
    $isValid = [datetime]::TryParse($dateStr, [ref]$parsedDate)
    if ($isValid) {
        Write-Host "Parsed: $parsedDate"
    }
}
