# Probe 1 (FIRE): Literal colon after variable name, followed by space + identifier word.
# PS 5.1 reads $varname: as a scope-qualifier prefix and raises:
# "Variable reference is not valid. ':' was not followed by a valid variable name character."
# R39 MUST fire.
$msg = "Path $varname: more text"
Write-Host $msg
