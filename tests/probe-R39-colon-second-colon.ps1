# Probe 3 (FIRE): Colon followed by space then another word -- double-colon pattern
# that looks scope-like but is not. "Result: $count: items" -- PS reads $count: as a
# scope-qualifier prefix; space after colon is not a valid variable-name start.
# R39 MUST fire.
$count = 5
$msg = "Result: $count: items found."
Write-Host $msg
