# PROBE: R24 false-negative when two pac solution import calls appear on separate lines
# Prior defect: the lookahead character class [^;] did not stop at newlines, so
# --publish-changes on the SECOND import satisfied the lookahead for the FIRST import,
# masking the first call's missing flag. Fix changes [^;] to [^\n;|].
# After the fix R24 must fire ONCE (on the first import only), not zero times.
$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    pac solution import --path "solution-a.zip"
    pac solution import --path "solution-b.zip" --publish-changes
}

Stop-Transcript
