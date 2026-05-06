# PROBE R37-P6-multiline-concat-select (v0.4.4 Gap 1 + Gap 2 combined):
# Positive probe (must trigger ERROR):
# $select=...,appmoduleidunique straddles a '+' line boundary against
# the appmodulecomponents EntitySet.
#
# Combines both gaps: bare Lookup name in $select (Gap 1) AND the pattern
# spans a '+' concat boundary (Gap 2). After joinPlusContent collapses:
#   "appmodulecomponents?`$filter=componenttype eq 62&`$select=objectid,componenttype,appmoduleidunique"
# which fires the $select arm of R37.
#
# Substrate: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/select-columns
#   Lookup property data section: use _<logicalname>_value in $select.
#
# R37 MUST fire.

$r = Invoke-RestMethod -Uri ("https://org.crm.dynamics.com/api/data/v9.2/appmodulecomponents?`$filter=componenttype eq 62&`$select=objectid," +
    "componenttype,appmoduleidunique") -Method Get
