# Probe R44-1 (FIRE): OData v4 type-cast syntax in $select on a ProjectServer URL.
# Microsoft.SharePoint.Lookup/ is an OData v4 type cast; invalid on v2/v3 endpoints. R44 MUST fire.
$url = "/_api/ProjectServer/Projects?`$select=Microsoft.SharePoint.Lookup/Title"
Invoke-PnPSPRestMethod -Url $url -Method Get
