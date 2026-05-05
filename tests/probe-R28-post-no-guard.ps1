# PROBE R28-post-no-guard (v0.4.2):
# True positive (regression anchor for the v0.4.2 conjunction):
# Web API POST mutation IS present, idempotency guard is absent. R28 MUST fire.
#
# This pins the canonical R28 failure mode: re-running the script will create
# duplicate records because the POST is unguarded.

$optionSets = @("a")

Invoke-RestMethod -Method POST -Uri "https://org.crm.dynamics.com/api/data/v9.2/accounts" -Body '{"name":"Acme"}'
