# Probe R42-3 (NO FIRE): Connect-PnPOnline -DeviceLogin WITH -ClientId.
# -ClientId is present. This is the correct post-2024-09-09 form. R42 MUST NOT fire.
Connect-PnPOnline -Url "https://contoso.sharepoint.com/sites/pwa" -DeviceLogin -ClientId "00000000-0000-0000-0000-000000000001" -Tenant "contoso.onmicrosoft.com"
