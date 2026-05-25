# R45 probe 11 -- documented false positive anchor
# (if ...) inside a string literal. strippedContent does NOT strip
# string content, so R45 fires on the string literal.
# This is an EXPECTED false positive (analogous to R34/R33 string FP pattern).
# EXPECTED: R45 fires.
# This probe documents the known limitation.

Write-Host "WRONG: use (if ...) not $(if ...)"
