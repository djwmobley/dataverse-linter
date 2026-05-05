# PROBE R36-three-arg-form: 3-argument TryParse with a real bound variable must NOT fire R36.
# [datetime]::TryParse($s, $provider, [ref]$dt) with a real $dt is legitimate.
# R36 scope is EXPLICITLY limited to the 2-argument form where the SECOND arg is [ref]$null.
# The 3-argument form with a real output variable is a valid .NET call and must not be flagged.
# R36 MUST NOT fire.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    $dateStr = "2026-05-04"
    $provider = [System.Globalization.CultureInfo]::InvariantCulture
    $parsed = [datetime]::MinValue
    $isValid = [datetime]::TryParse($dateStr, $provider, [ref]$parsed)
}
