# Probe R44-3 (NO FIRE): OData v4 type cast on a Dataverse Web API URL.
# /api/data/v9.2/... is the Dataverse endpoint; v4 type casts are CORRECT there.
# R44 anchors on _api/ProjectServer or _api/web -- Dataverse URLs do not match. R44 MUST NOT fire.
$dvHeaders = @{ 'OData-MaxVersion' = '4.0' }
$uri = "/api/data/v9.2/accounts?`$select=Microsoft.Dynamics.CRM.Account/name"
$dvData = Invoke-RestMethod -Uri $uri -Headers $dvHeaders
