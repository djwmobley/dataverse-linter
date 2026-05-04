# PROBE: R24 semicolon-as-statement-boundary case
# Two pac solution import calls on a single line separated by a semicolon.
# Only the second call has --publish-changes. R24 must fire ONCE (on the first call).
# The semicolon stop was already in the original pattern, so this probe validates that
# the existing semicolon behavior is preserved after adding \n and | to the stop set.
$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    pac solution import --path "solution-a.zip"; pac solution import --path "solution-b.zip" --publish-changes
}

Stop-Transcript
