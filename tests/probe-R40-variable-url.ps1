# Probe R40-4 (NO FIRE): Invoke-PnPSPRestMethod -Url with a variable value.
# -Url $relativeUrl -- starts with '$', which is a variable reference.
# The rule only fires on string literals; variable URLs are not flagged. R40 MUST NOT fire.
Connect-PnPOnline -Url "https://contoso.sharepoint.com/sites/pwa" -ClientId "abc123" -Interactive
$relativeUrl = "/_api/ProjectServer/Projects"
Invoke-PnPSPRestMethod -Url $relativeUrl -Method Get
