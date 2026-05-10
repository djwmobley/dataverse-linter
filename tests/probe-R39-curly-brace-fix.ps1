# Probe 6 (NO FIRE): Already-fixed curly-brace delimiter form.
# ${varname}: makes the colon a literal character following the variable expansion.
# The ${ prefix is not matched by \$[A-Za-z_]\w* (pattern requires a letter after $,
# not an opening brace), so R39 MUST NOT fire.
$ZipPath = "C:\packages\solution.zip"
$msg = "FAILED on ${ZipPath}:`n" + "See details above."
Write-Host $msg
