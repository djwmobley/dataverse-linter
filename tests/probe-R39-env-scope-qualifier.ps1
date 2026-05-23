# Probe 5 (NO FIRE): Legitimate $env: scope qualifier outside a double-quoted string.
# $env:USERNAME is a standard PS environment variable reference. The colon is the
# scope-qualifier separator, and USERNAME is a valid variable name after it.
# R39 MUST NOT fire (pattern requires the post-colon char to NOT be [A-Za-z0-9_{]).
$x = $env:USERNAME
Write-Host $x
