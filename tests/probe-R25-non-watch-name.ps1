# PROBE R25: $widget = ... at script scope (not in watch list).
# v0.3.1 R25 MUST NOT fire: the variable name is not in the configured
# variables array (headers, body, conn, options, response, result).

$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    $widget = @{ name = "test" }
    Write-Host $widget.name
}

Stop-Transcript
