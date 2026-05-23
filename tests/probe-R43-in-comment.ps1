# Probe R43-4 (NO FIRE): Register-PnPManagementShellAccess on a full-line # comment.
# strippedContent strips full-line comments before matching. R43 MUST NOT fire.
# Previously: Register-PnPManagementShellAccess (removed in PnP 2.x)
Connect-PnPOnline -Url "https://contoso.sharepoint.com/sites/pwa" -ClientId "abc123" -Interactive
