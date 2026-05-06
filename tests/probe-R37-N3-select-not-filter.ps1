# PROBE R37-N3-select-not-filter (v0.4.4 repurposed from v0.4.3 negative to RETIRED):
# NOTE: This probe was a negative probe in v0.4.3, asserting R37 did NOT fire on
# $select=appmoduleidunique against appmodulecomponents. As of v0.4.4 Gap 1 widening,
# R37 DOES fire on this pattern. The probe file is retained for historical traceability
# but is NO LONGER REGISTERED in run-battery.js.
#
# The content below (bare Lookup in $select against appmodulecomponents) now correctly
# fires R37 at ERROR severity. The positive anchor is probe-R37-P3-select-bare-lookup.ps1.
# The negative anchors are probe-R37-N5 (appmodules EntitySet, Uniqueidentifier type) and
# probe-R37-N6 (PK in $select, not in watch list).
#
# DO NOT re-register this probe as a mustNotFire probe. The pattern it contains is the
# exact Gap 1 failure mode this PR addresses.

$appId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
$endpoint = "appmodulecomponents?`$filter=componenttype eq 62&`$select=objectid,componenttype,appmoduleidunique"
$result = Invoke-RestMethod -Uri "https://org.crm.dynamics.com/api/data/v9.2/$endpoint" -Method Get
