# PROBE: R25 must NOT fire for variable names not in the configured variables array.
# $client, $session, $config are NOT in the default set (headers, body, conn, options, response, result).
# This probe verifies that the regex-template substitution is exact and does not over-match.
# Other rules may fire incidentally; only the absence of R25 is asserted.
$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    $client = New-Object System.Net.Http.HttpClient
    $session = "abc"
    $config = @{ url = "https://org.crm.dynamics.com" }
}

Stop-Transcript
