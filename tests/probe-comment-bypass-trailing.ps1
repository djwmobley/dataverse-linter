# PROBE 8: trailing-comment / string-literal / block-comment bypass survives stripComments
# stripComments only strips ^\s*#.*$ (full-line comments).
# This script has NO real Start-Transcript and NO real if ($null -eq ...) guard.
# It uses three OTHER comment shapes that stripComments does not handle.

$optionSets = @("a")

# Trailing comment after a statement carries the bypass text:
$x = 1  # Start-Transcript    if ($null -eq $foo)

# Block comment (PowerShell <# ... #>) is not handled either:
<#
  Start-Transcript
  if ($null -eq $foo)
#>

# String literal containing the bypass text:
$msg = "remember to call Start-Transcript and check if (`$null -eq `$foo)"

# Two unguarded POSTs that should fire R28 if the rule worked.
Invoke-RestMethod -Method POST -Uri "https://api/entities"
Invoke-RestMethod -Method POST -Uri "https://api/entities"
