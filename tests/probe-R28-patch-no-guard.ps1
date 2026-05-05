# PROBE R28-patch-no-guard (v0.4.2):
# True positive: Invoke-RestMethod -Method Patch with no idempotency guard.
# PATCH is a Dataverse Web API mutation per substrate. R28 MUST fire.
#
# Substrate for "PATCH is a mutation":
#   - https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/update-delete-entities-using-web-api
#     "Update operations use the HTTP `PATCH` verb. Pass a JSON object
#     containing the properties you want to update to the URI that represents
#     the record."
#   - Same page (Upsert section): "It uses a `PATCH` request and uses a URI
#     to reference a specific record."
#
# This probe extends R28 conjunction coverage beyond POST. Confirms that the
# requires_present alternation includes PATCH.

$optionSets = @("a")

Invoke-RestMethod -Method Patch -Uri "https://org.crm.dynamics.com/api/data/v9.2/accounts(00000000-0000-0000-0000-000000000001)" -Body '{"name":"Updated"}'
