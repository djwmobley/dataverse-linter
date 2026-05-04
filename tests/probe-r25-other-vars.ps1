# PROBE: R25 only catches literal $headers — does not generalize to other shadowable vars
$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    # R25 should warn — but only $headers is whitelisted; $client / $session / $config silently pass
    $client = New-Object System.Net.Http.HttpClient
    $session = "abc"
    $config = @{ url = "x" }
    $headers = @{ test = "1" }   # this one fires
}

Stop-Transcript
