# PROBE R37-P2-combined-predicate (v0.4.3):
# Positive probe (must trigger ERROR):
# Combined predicate: componenttype eq 62 and appmoduleidunique eq <guid>.
# The appmoduleidunique term uses the bare logicalname despite a preceding
# non-Lookup predicate. R37 must detect the Lookup term anywhere in the
# $filter expression, not just as the first predicate.
#
# Substrate: appmoduleidunique is Type=Lookup on appmodulecomponent.
# The correct form: componenttype eq 62 and _appmoduleidunique_value eq <guid>.
#
# R37 MUST fire.

$appId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
$endpoint = "appmodulecomponents?`$filter=componenttype eq 62 and appmoduleidunique eq $appId&`$select=objectid,componenttype"
$result = Invoke-RestMethod -Uri "https://org.crm.dynamics.com/api/data/v9.2/$endpoint" -Method Get
