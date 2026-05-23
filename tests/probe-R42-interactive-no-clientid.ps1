# Probe R42-4 (NO FIRE): Connect-PnPOnline -Interactive (not -DeviceLogin), no -ClientId.
# The rule anchors on -DeviceLogin specifically. -Interactive is a different auth flow
# and is outside the scope of R42. R42 MUST NOT fire.
Connect-PnPOnline -Url "https://contoso.sharepoint.com/sites/pwa" -Interactive
