# PROBE R28-post-with-guard (v0.4.2):
# True negative anchor: Web API POST mutation IS present AND idempotency guard
# IS present. R28 MUST NOT fire (legitimate guarded code).
#
# This is the correct shape that a guarded ALM script should take. Pins the
# R28 clean path so future changes to the conjunction logic surface as a probe
# failure if the legitimate-guarded shape regresses.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Invoke-RestMethod -Method POST -Uri "https://org.crm.dynamics.com/api/data/v9.2/accounts" -Body '{"name":"Acme"}'
}
