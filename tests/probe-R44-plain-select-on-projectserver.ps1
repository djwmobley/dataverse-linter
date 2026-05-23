# Probe R44-4 (NO FIRE): $select with plain field names (no type cast) on ProjectServer URL.
# Title,Description are simple field names with no Namespace.Type/ segment. R44 MUST NOT fire.
$url = "/_api/ProjectServer/Projects?`$select=Title,Description,StartDate"
Invoke-PnPSPRestMethod -Url $url -Method Get
