# PROBE R37-N3-select-not-filter (v0.4.3):
# Negative probe (must NOT trigger):
# appmoduleidunique appears in a $select clause, NOT in $filter.
#
# $select=appmoduleidunique is a valid column selection -- retrieving the Lookup
# column's value as part of the returned record. The R37 pattern anchors on
# '$filter=...<name> eq', so a $select clause containing the logicalname does not match.
#
# R37 MUST NOT fire. This guards against false positives on $select usage.

$appId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
$endpoint = "appmodulecomponents?`$filter=componenttype eq 62&`$select=objectid,componenttype,appmoduleidunique"
$result = Invoke-RestMethod -Uri "https://org.crm.dynamics.com/api/data/v9.2/$endpoint" -Method Get
