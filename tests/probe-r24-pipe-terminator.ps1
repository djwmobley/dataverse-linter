# PROBE: R24 pipe-as-statement-boundary case
# pac solution import piped to Out-Null without --publish-changes.
# The pipe character | is a statement boundary in PowerShell: everything after the pipe
# belongs to a different command, so --publish-changes cannot legally appear before the pipe
# on the import call itself. The fix adds | to the lookahead stop set [^\n;|],
# so R24 must fire on this form.
$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    pac solution import --path "solution.zip" | Out-Null
}

Stop-Transcript
