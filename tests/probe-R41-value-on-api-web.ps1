# Probe R41-2 (FIRE): _assignedto_value suffix in a /_api/web/ REST URL.
# SharePoint REST is OData v2/v3; _value suffix is wrong here. R41 MUST fire.
$url = "/_api/web/lists/getbytitle('Tasks')/items?`$select=Title,_assignedto_value"
Invoke-PnPSPRestMethod -Url $url -Method Get
