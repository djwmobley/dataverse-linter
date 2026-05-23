# Probe 7 (NO FIRE): Single-quoted string -- no variable expansion occurs.
# PowerShell does not interpolate variables in single-quoted strings; $varname: is
# treated as a literal character sequence. No parse error occurs. R39 MUST NOT fire.
# The rule pattern anchors on double-quote delimiters ("...") and does not match
# single-quote delimiters ('...').
$z = '$varname: in single quotes -- not expanded, no parse error'
Write-Host $z
