# PROBE R28-mixedcase-method-no-fire (v0.4.2):
# Case-sensitivity anchor:
# The R28 requires_present regex is case-sensitive (regex flags 'm', no 'i')
# and enumerates three case forms per method (e.g. POST|Post|post). A fully
# mixed-case form like `pOsT` is NOT in the alternation and the precondition
# does NOT match. R28 is therefore skipped. PowerShell parameter parsing IS
# case-insensitive at runtime (`-Method pOsT` would actually POST), so this
# probe pins a known boundary of the linter's intent-detection: PowerShell
# accepts the mixed-case form, the linter does not detect it.
# This is the deliberate design (the case enumeration is explicit); the
# probe exists so a future widening to `(?i:...)` triggers a regression
# signal and forces conscious sign-off on broadening the conjunction.
# R28 MUST NOT fire.

$optionSets = @("a")
Invoke-RestMethod -Method pOsT -Uri "https://org.crm.dynamics.com/api/data/v9.2/accounts" -Body '{"name":"Acme"}'
