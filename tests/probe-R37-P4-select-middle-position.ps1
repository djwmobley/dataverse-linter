# PROBE R37-P4-select-middle-position (v0.4.4 Gap 1):
# Positive probe (must trigger ERROR):
# appmoduleidunique in $select in middle position (not first, not last).
#
# Verifies R37 fires regardless of where the bare Lookup logicalname appears
# within the comma-separated $select list.
#
# appmoduleidunique is Type=Lookup on appmodulecomponent; cannot be used as a
# bare primitive in $select against the appmodulecomponents EntitySet.
# Substrate: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/appmodulecomponent
#
# R37 MUST fire.

$endpoint = "appmodulecomponents?`$select=componenttype,appmoduleidunique,objectid"
$result = Invoke-RestMethod -Uri "https://org.crm.dynamics.com/api/data/v9.2/$endpoint" -Method Get
