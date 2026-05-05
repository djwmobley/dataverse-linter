# PROBE R37-N1-correct-value-form (v0.4.3):
# Negative probe (must NOT trigger):
# Already-correct form: _appmoduleidunique_value eq <guid>.
# The leading underscore and trailing _value are the OData Lookup property
# annotation required by the Dataverse Web API $filter on Lookup attributes.
#
# Substrate: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/filter-rows
#   "Filter on lookup property: $filter=_owninguser_value eq <systemuserid value>"
#
# R37 MUST NOT fire. This is the regression anchor for the clean path.

$appId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
$endpoint = "appmodulecomponents?`$filter=componenttype eq 62 and _appmoduleidunique_value eq $appId&`$select=objectid,componenttype"
$result = Invoke-RestMethod -Uri "https://org.crm.dynamics.com/api/data/v9.2/$endpoint" -Method Get
