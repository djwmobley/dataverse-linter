# Probe 2 (FIRE): Colon followed by backtick escape sequence (`n).
# This is the exact incident that triggered R39: build_avinext_bundle.ps1 line 513.
# PS 5.1 reads $ZipPath: as a scope-qualifier prefix; backtick is not a valid
# variable-name start character, so the parser raises a parse-time error.
# The script cannot load or run. R39 MUST fire.
$msg = "Invoke-ZipIntegrityGate FAILED on $ZipPath:`n" + "See details above."
Write-Host $msg
