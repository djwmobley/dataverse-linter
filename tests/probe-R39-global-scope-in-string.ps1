# Probe 8 (NO FIRE): Legitimate $global: scope qualifier inside a double-quoted string.
# $global:foo is a valid PS scope-qualified reference. The char after the colon is 'f',
# which is in [A-Za-z0-9_{], so the negative lookahead in R39 suppresses the match.
# R39 MUST NOT fire.
$global:foo = "bar"
$msg = "Global value: $global:foo is set."
Write-Host $msg
