# Probe R40-2 (FIRE): Invoke-PnPSPRestMethod -Url with relative path starting with word char.
# "_api/..." would need a leading slash; without it this is relative. R40 MUST fire.
# Note: this string starts with underscore then 'a' which is not '/' or '$'.
# Wait: the pattern requires the char after quote NOT be '/' '$' or space.
# '_' is not '/', '$', or whitespace, so this should fire.
Connect-PnPOnline -Url "https://contoso.sharepoint.com/sites/pwa" -ClientId "abc123" -Interactive
Invoke-PnPSPRestMethod -Url "_api/web/lists" -Method Get
