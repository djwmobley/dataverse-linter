# Probe R41-1 (FIRE): _owner_value suffix in a ProjectServer REST URL.
# _value is OData v4 / Dataverse syntax; ProjectServer uses OData v2/v3. R41 MUST fire.
$url = "/_api/ProjectServer/Projects?`$select=Title,_owner_value"
Invoke-PnPSPRestMethod -Url $url -Method Get
