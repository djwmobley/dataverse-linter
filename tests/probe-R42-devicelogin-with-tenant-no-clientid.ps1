# Probe R42-2 (FIRE): Connect-PnPOnline with -DeviceLogin and -Tenant, mandatory app ID absent.
# The -Tenant parameter is present but the mandatory app registration ID param is still missing.
# R42 MUST fire.
Connect-PnPOnline -Url "https://contoso.sharepoint.com/sites/pwa" -Tenant "contoso.onmicrosoft.com" -DeviceLogin
