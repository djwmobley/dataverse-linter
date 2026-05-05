# PROBE R36-as-operator: Correct replacement using -as [datetime].
# $result = $s -as [datetime] returns $null on failure with no exception and no
# overload-resolution ambiguity. R36 MUST NOT fire.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    $dateStr = "2026-05-04"
    $parsedDate = $dateStr -as [datetime]
    if ($null -ne $parsedDate) {
        Write-Host "Valid date: $parsedDate"
    }
}
