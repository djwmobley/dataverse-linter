# PROBE: regex-inverse rules satisfied by comment text
# This script has NO Start-Transcript and NO real idempotency guards
# but the linter will pass it because of the strings in this comment:
#   Start-Transcript
#   if ($null -eq $foo)

$optionSets = @("a", "b")

# Two POSTs, both unguarded. Should fire R28.
Invoke-RestMethod -Method POST -Uri "https://org.crm.dynamics.com/api/data/v9.2/entities"
Invoke-RestMethod -Method POST -Uri "https://org.crm.dynamics.com/api/data/v9.2/entities"
