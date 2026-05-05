# PROBE R37-N4-expand-not-filter (v0.4.3):
# Negative probe (must NOT trigger):
# appmoduleid (the navigation property name for the appmoduleidunique Lookup)
# appears in a $expand clause. Navigation properties in $expand are the correct
# OData form for following Lookup relationships.
#
# Substrate: appmodule_appmodulecomponent relationship has
#   ReferencingEntityNavigationPropertyName = 'appmoduleid'
# (https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/appmodulecomponent)
# Using $expand=appmoduleid($select=name) is correct and should never fire R37.
#
# R37 MUST NOT fire. This guards against false positives on $expand navigation prop usage.

$endpoint = "appmodulecomponents?`$filter=componenttype eq 62&`$expand=appmoduleid(`$select=name)"
$result = Invoke-RestMethod -Uri "https://org.crm.dynamics.com/api/data/v9.2/$endpoint" -Method Get
