# PROBE R37-N2-pk-equality (v0.4.3):
# Negative probe (must NOT trigger):
# PrimaryIdAttribute equality: appmodulecomponents?$filter=appmodulecomponentid eq <guid>.
#
# appmodulecomponentid is Type=Uniqueidentifier (NOT a Lookup) -- it is the PrimaryIdAttribute
# of appmodulecomponent. Filtering by a bare Uniqueidentifier PK is the correct OData form.
# Source: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/appmodulecomponent
#   PrimaryIdAttribute = appmodulecomponentid, Type = Uniqueidentifier.
#
# R37 anchors only on 'appmoduleidunique' (a known Lookup). 'appmodulecomponentid' is NOT
# in the watch list. R37 MUST NOT fire.

$componentId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
$endpoint = "appmodulecomponents?`$filter=appmodulecomponentid eq $componentId"
$result = Invoke-RestMethod -Uri "https://org.crm.dynamics.com/api/data/v9.2/$endpoint" -Method Get
