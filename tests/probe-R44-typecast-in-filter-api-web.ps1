# Probe R44-2 (FIRE): OData v4 type-cast syntax in $filter on a /_api/web/ URL.
# SP.Data.TasksListItem/ is an OData v4 cast segment; SharePoint REST is v2/v3. R44 MUST fire.
$url = "/_api/web/lists/getbytitle('Tasks')/items?`$filter=SP.Data.TasksListItem/Completed eq true"
Invoke-PnPSPRestMethod -Url $url -Method Get
