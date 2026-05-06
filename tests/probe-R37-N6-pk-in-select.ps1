# PROBE R37-N6-pk-in-select (v0.4.4 Gap 1 false-positive guard):
# Negative probe (must NOT trigger):
# appmodulecomponentid (PrimaryIdAttribute, Type=Uniqueidentifier) in $select.
#
# appmodulecomponentid is the PK of appmodulecomponent and is Type=Uniqueidentifier.
# It is NOT in the R37 watch list ('appmodulecomponentid' vs 'appmoduleidunique').
# Selecting a PK by its bare logicalname is always correct OData.
#
# Substrate: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/appmodulecomponent
#   PrimaryIdAttribute: appmodulecomponentid, Type: Uniqueidentifier
#
# R37 MUST NOT fire.

$endpoint = "appmodulecomponents?`$filter=componenttype eq 62&`$select=appmodulecomponentid,objectid"
$result = Invoke-RestMethod -Uri "https://org.crm.dynamics.com/api/data/v9.2/$endpoint" -Method Get
