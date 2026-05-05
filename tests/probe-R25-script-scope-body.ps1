# PROBE R25: $body = @{ ... } at script scope.
# v0.3.1 scope-aware R25 MUST fire: assignment is at script scope (not inside
# any function declaration body), and $body is in the watch-list.

$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    $body = @{ name = "test" }
    Invoke-RestMethod -Method POST -Uri "https://api/x" -Body $body
}

Stop-Transcript
