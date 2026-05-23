# Probe R41-3 (NO FIRE): _ownerid_value on a Dataverse Web API URL.
# /api/data/v9.2/... is the Dataverse endpoint; _value suffix is CORRECT there.
# R41 MUST NOT fire (the URL does not contain _api/ProjectServer or _api/web).
$dvHeaders = @{ 'OData-MaxVersion' = '4.0'; 'OData-Version' = '4.0' }
$dvResult = Invoke-RestMethod -Uri "/api/data/v9.2/accounts?`$select=name,_ownerid_value" -Headers $dvHeaders
