# Probe R40-5 (NO FIRE): Invoke-PnPSPRestMethod -Url with a full https:// URL.
# Full absolute URLs are legitimate (cross-site REST calls). R40 MUST NOT fire.
Connect-PnPOnline -Url "https://contoso.sharepoint.com/sites/pwa" -ClientId "abc123" -Interactive
Invoke-PnPSPRestMethod -Url "https://contoso.sharepoint.com/sites/pwa/_api/web/lists" -Method Get
