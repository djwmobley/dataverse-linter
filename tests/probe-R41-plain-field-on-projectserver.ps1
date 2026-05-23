# Probe R41-4 (NO FIRE): Plain field name (Owner) in a ProjectServer REST URL.
# OData v2/v3 correct form: no _value suffix. R41 MUST NOT fire.
$url = "/_api/ProjectServer/Projects?`$select=Title,Owner"
Invoke-PnPSPRestMethod -Url $url -Method Get
