# PROBE R28-put-no-guard (v0.4.2):
# True positive (extends conjunction coverage):
# Web API PUT mutation IS present (single-property update form per
# update-delete-entities-using-web-api), idempotency guard is absent.
# R28 MUST fire.
#
# Substrate citation:
#   https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/update-delete-entities-using-web-api
#   "To update a single property value, use a PUT request and add the
#   property name to the entity's Uri."

$optionSets = @("a")
Invoke-RestMethod -Method PUT -Uri "https://org.crm.dynamics.com/api/data/v9.2/accounts(00000000-0000-0000-0000-000000000001)/name" -Body '{"value":"Acme"}'
