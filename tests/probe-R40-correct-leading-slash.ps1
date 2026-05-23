# Probe R40-3 (NO FIRE): Invoke-PnPSPRestMethod -Url with correct leading slash.
# "/_api/ProjectServer/Projects" starts with '/'. R40 MUST NOT fire.
Connect-PnPOnline -Url "https://contoso.sharepoint.com/sites/pwa" -ClientId "abc123" -Interactive
Invoke-PnPSPRestMethod -Url "/_api/ProjectServer/Projects" -Method Get
