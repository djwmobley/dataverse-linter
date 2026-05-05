# PROBE R36-basic-trigger: [datetime]::TryParse($s, [ref]$null) — 2-argument form.
# The 2-argument overload expects (String, out DateTime). Passing [ref]$null as
# the second argument discards the parsed DateTime value. On .NET 7+ this may
# also resolve to a different overload. R36 MUST fire on this file.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    $dateStr = "2026-05-04"
    $isValid = [datetime]::TryParse($dateStr, [ref]$null)
}
