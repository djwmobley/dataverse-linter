# Probe 9 (NO FIRE): Legitimate $script: scope qualifier inside a double-quoted string.
# $script:bar is a valid PS scope-qualified reference. The char after ':' is 'b',
# which is in [A-Za-z0-9_{], so the negative lookahead in R39 suppresses the match.
# R39 MUST NOT fire.
$script:bar = "baz.txt"
$msg = "Processing $script:bar now."
Write-Host $msg
