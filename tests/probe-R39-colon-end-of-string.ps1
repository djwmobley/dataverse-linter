# Probe 4 (FIRE): Colon immediately before the closing double-quote.
# PS reads $username: as a scope-qualifier prefix; the closing quote is not a valid
# variable-name start character, so the parser raises a parse-time error.
# R39 MUST fire.
$username = "alice"
Write-Host "User $username:" -ForegroundColor Red
