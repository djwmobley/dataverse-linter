# PROBE R28-delete-no-guard (v0.4.2):
# True negative anchor (intentional-exclusion pin):
# Web API DELETE call IS present, idempotency guard is absent.
# DELETE is INTENTIONALLY excluded from R28's requires_present because
# HTTP DELETE is idempotent by spec -- a re-run cannot create duplicates
# (the second call returns 404). The R28 rule's stated intent is to
# prevent duplicate-create on re-run; DELETE cannot cause that.
# Substrate: RFC 9110 S9.3.5 ("DELETE method is idempotent") and
# update-delete-entities-using-web-api ("To delete an entity, send a
# DELETE request to the URI of the entity record").
#
# Substrate citations:
#   RFC 9110 S9.3.5 (DELETE idempotency):
#     https://www.rfc-editor.org/rfc/rfc9110#name-delete
#   MS Learn (delete entity via Web API):
#     https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/update-delete-entities-using-web-api
#
# R28 MUST NOT fire.

$optionSets = @("a")
Invoke-RestMethod -Method DELETE -Uri "https://org.crm.dynamics.com/api/data/v9.2/accounts(00000000-0000-0000-0000-000000000001)"
