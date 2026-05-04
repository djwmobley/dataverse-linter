# PROBE: R24 negative-lookahead is single-line; backtick line-continuation defeats it
$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    pac solution import `
        --path "solution.zip" `
        --publish-changes
}

Stop-Transcript
