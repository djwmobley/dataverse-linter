# PROBE R28-no-mutation-no-guard (v0.4.2):
# Single-line snippet with NEITHER a Web API mutation call NOR an idempotency
# guard. Models the round-1-of-PR-#2 known limitation where minimal
# `pwsh -Command "Get-Date"` snippets tripped R28 because they had no POST to
# guard but R28 had no conjunction with mutation presence.
#
# v0.4.2 adds requires_present to R28 so the rule applies only when a Dataverse
# Web API mutation (POST/PATCH/PUT) is actually present. With no mutation in
# this file, R28 MUST NOT fire even though the inverse pattern is absent.
#
# Substrate for "POST/PATCH/PUT are mutations":
#   - https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/create-entity-web-api
#     "Send a `POST` request to the Web API entityset resource to create a
#     table row (entity record) in Microsoft Dataverse."
#   - https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/update-delete-entities-using-web-api
#     "Update operations use the HTTP `PATCH` verb."
#     "To update a single property value, use a `PUT` request and add the
#     property name to the entity's Uri."

Get-Date
