# PROBE R37-P1-bare-filter (v0.4.3):
# Positive probe (must trigger ERROR):
# The exact bug: $filter=appmoduleidunique eq <guid> on appmodulecomponents.
#
# appmoduleidunique is Type=Lookup (Targets=appmodule) on appmodulecomponent per
# https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/appmodulecomponent
# Filtering by the bare logicalname produces:
#   0x80060888 Could not find a property named 'appmoduleidunique' on type
#   'Microsoft.Dynamics.CRM.appmodulecomponent'
# The correct form is _appmoduleidunique_value eq <guid>.
#
# R37 MUST fire.

$appId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
$uri = "https://org.crm.dynamics.com/api/data/v9.2/appmodulecomponents?`$filter=appmoduleidunique eq $appId"
$result = Invoke-RestMethod -Uri $uri -Method Get
