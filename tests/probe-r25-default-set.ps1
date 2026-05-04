# PROBE: R25 fires on all six default variables in the regex-template variables array.
# Variables: headers, body, conn, options, response, result.
# R25 must fire SIX times (once per variable assignment at script scope).
$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    $headers = @{ "Content-Type" = "application/json" }
    $body = @{ name = "test" }
    $conn = New-Object System.Net.Http.HttpClient
    $options = @{ verbose = $true }
    $response = Invoke-RestMethod -Method GET -Uri "https://api/data"
    $result = $response.value
}

Stop-Transcript
