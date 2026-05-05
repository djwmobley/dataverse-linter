# PROBE R25: $script:body = ... at script scope.
# v0.3.1 R25 MUST NOT fire: explicit $script: prefix is precisely the correct
# usage R25 wants to encourage (no shadowing risk -- the writer named the scope).

$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    $script:body = @{ name = "test" }
    Invoke-RestMethod -Method POST -Uri "https://api/x" -Body $script:body
}

Stop-Transcript
