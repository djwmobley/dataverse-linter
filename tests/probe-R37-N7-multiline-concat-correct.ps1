# PROBE R37-N7-multiline-concat-correct (v0.4.4 Gap 2 regression anchor):
# Negative probe (must NOT trigger):
# Multi-line '+' concat with correct _appmoduleidunique_value form.
#
# Verifies that joinPlusContent joining does not break the correct-path
# regression anchor: _appmoduleidunique_value spanning a '+' boundary
# must remain clean after the join collapses lines.
#
# After joinPlusContent:
#   "appmodulecomponents?`$filter=componenttype eq 62 and _appmoduleidunique_value eq $appId&`$select=objectid,componenttype"
# The leading '_' causes \b before 'appmoduleidunique' to fail (since '_' is \w,
# no word boundary exists between '_' and 'a'). R37 MUST NOT fire.
#
# Substrate: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/filter-rows
#   "Filter on lookup property": $filter=_owninguser_value eq <systemuserid value>
#
# R37 MUST NOT fire. This is the multi-line-concat regression anchor for the correct path.

$appId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
$smComp = Invoke-RestMethod -Uri ("https://org.crm.dynamics.com/api/data/v9.2/appmodulecomponents?`$filter=componenttype eq 62 and " +
    "_appmoduleidunique_value eq $appId&`$select=objectid,componenttype") -Method Get
