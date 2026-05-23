# Probe R40-1 (FIRE): Invoke-PnPSPRestMethod -Url value without a leading slash.
# "api/ProjectServer/Projects" starts with 'a' (not '/' or '$' or http).
# R40 MUST fire.
Connect-PnPOnline -Url "https://contoso.sharepoint.com/sites/pwa" -ClientId "abc123" -Interactive
Invoke-PnPSPRestMethod -Url "api/ProjectServer/Projects" -Method Get
