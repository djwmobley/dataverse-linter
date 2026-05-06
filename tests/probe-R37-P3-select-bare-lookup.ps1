# PROBE R37-P3-select-bare-lookup (v0.4.4 Gap 1):
# Positive probe (must trigger ERROR):
# appmoduleidunique in $select against appmodulecomponents EntitySet.
#
# appmoduleidunique on appmodulecomponent is Type=Lookup (Targets=appmodule) per
# https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/appmodulecomponent
# The Dataverse OData layer exposes Lookup attributes only via the underlying-value
# annotation (_<logicalname>_value) for $select and $filter. The bare logicalname is
# a navigation property for $expand only; requesting it in $select produces:
#   0x80060888 Could not find a property named 'appmoduleidunique' on type
#   'Microsoft.Dynamics.CRM.appmodulecomponent'
# The correct $select form: $select=objectid,componenttype,_appmoduleidunique_value
#
# Substrate: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/select-columns
#   "Lookup property data" section: single-valued navigation properties cannot be
#   used in $select; use $select with the _<logicalname>_value lookup property instead.
#
# R37 MUST fire.

$endpoint = "appmodulecomponents?`$filter=componenttype eq 62&`$select=objectid,componenttype,appmoduleidunique"
$result = Invoke-RestMethod -Uri "https://org.crm.dynamics.com/api/data/v9.2/$endpoint" -Method Get
