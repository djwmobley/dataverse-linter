# PROBE R28-get-only-no-guard (v0.4.2):
# Read-only path: Invoke-RestMethod -Method Get with no idempotency guard.
# GET is not a mutation per Dataverse Web API substrate, so requires_present
# does not match and R28 does not apply. R28 MUST NOT fire.
#
# Substrate for "GET is read":
#   - https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/create-entity-web-api
#     The create page uses POST exclusively. GET is described elsewhere as the
#     query verb (retrieve-entity-using-web-api).
#
# This probe pins the read-only path so a future widening of requires_present
# (e.g. to include GET) surfaces as a probe failure.

$optionSets = @("a")

$response = Invoke-RestMethod -Method Get -Uri "https://org.crm.dynamics.com/api/data/v9.2/accounts(00000000-0000-0000-0000-000000000001)"
Write-Host "Account name: $($response.name)"
