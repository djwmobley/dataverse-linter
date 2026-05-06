# PROBE R37-N5-appmodules-uniqueidentifier (v0.4.4 Gap 1 false-positive guard):
# Negative probe (must NOT trigger):
# appmoduleidunique in $select against the appmodules EntitySet.
#
# appmoduleidunique on the appmodule entity itself is Type=Uniqueidentifier
# (NOT a Lookup) per:
# https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/appmodule
#   LogicalName: appmoduleidunique, Type: Uniqueidentifier
#
# Selecting a Uniqueidentifier by its bare logicalname is correct OData.
# The R37 $select pattern is anchored to 'appmodulecomponents' (the EntitySet
# where appmoduleidunique IS a Lookup), not 'appmodules' (where it is a Uniqueidentifier).
# Without this entity-anchoring, R37 would false-positive on the common AdvAccel
# pattern of querying appmodules?$select=appmoduleid,appmoduleidunique,...
#
# R37 MUST NOT fire. This is the entity-context false-positive guard.

$appResp = Invoke-RestMethod -Uri "https://org.crm.dynamics.com/api/data/v9.2/appmodules?`$select=appmoduleid,appmoduleidunique,uniquename,name,clienttype,solutionid" -Method Get
