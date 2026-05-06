# PROBE R37-N8-expand-nav-prop (v0.4.4 regression anchor for $expand):
# Negative probe (must NOT trigger):
# appmoduleid (navigation property name) in $expand.
#
# This probe is the successor to the original N4 probe (which tested $expand).
# The navigation property for the appmodule_appmodulecomponent relationship is
# 'appmoduleid' (NOT 'appmoduleidunique'):
#   ReferencingEntityNavigationPropertyName = 'appmoduleid'
# Source: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/appmodulecomponent
#
# 'appmoduleid' is NOT in the R37 watch list. 'appmoduleidunique' does not appear
# in the string at all. R37 MUST NOT fire.

$endpoint = "appmodulecomponents?`$filter=componenttype eq 62&`$expand=appmoduleid(`$select=name)"
$result = Invoke-RestMethod -Uri "https://org.crm.dynamics.com/api/data/v9.2/$endpoint" -Method Get
