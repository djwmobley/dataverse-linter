# PROBE R37-P5-multiline-concat-filter (v0.4.4 Gap 2):
# Positive probe (must trigger ERROR):
# $filter=...appmoduleidunique eq straddles a '+' line boundary.
#
# The canonical AdvAccel multi-line idiom splits a URL across two string literals
# joined by '+'. Each line in isolation is innocent. R37 must catch the pattern
# when the joining collapses the lines:
#   Line 1: "appmodulecomponents?`$filter=componenttype eq 62 and "
#   Line 2: "appmoduleidunique eq $appIdUnique&`$select=objectid,componenttype"
# After joinPlusContent collapses: both segments become one line containing
# '`$filter=componenttype eq 62 and appmoduleidunique eq $appIdUnique', which fires.
#
# This is the exact two-bug shape from AdvAccel B5R3 work (2026-05-05 failure).
# Without the joinPlusContent view, each line's strippedContent is innocent;
# only the joined view surfaces the bare-lookup-name pattern.
#
# Substrate: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/filter-rows
#   "Filter on lookup property": $filter=_<logicalname>_value eq <guid>
#
# R37 MUST fire.

$appIdUnique = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
$smComp = Invoke-RestMethod -Uri ("https://org.crm.dynamics.com/api/data/v9.2/appmodulecomponents?`$filter=componenttype eq 62 and " +
    "appmoduleidunique eq $appIdUnique&`$select=objectid,componenttype") -Method Get
