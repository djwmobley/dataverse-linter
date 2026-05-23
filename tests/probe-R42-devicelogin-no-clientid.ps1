# Probe R42-1 (FIRE): Connect-PnPOnline with device-login flow, mandatory param absent.
# Since 2024-09-09 the shared PnP Entra app was retired; the client ID parameter is now required.
# R42 MUST fire.
Connect-PnPOnline -Url "https://contoso.sharepoint.com/sites/pwa" -DeviceLogin -ErrorAction Stop
