# Probe R43-3 (NO FIRE): Register-PnPEntraIDAppForInteractiveLogin -- the replacement cmdlet.
# The rule anchors on the removed cmdlet name. The replacement name does not match. R43 MUST NOT fire.
Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "MyPnPApp" -Tenant "contoso.onmicrosoft.com"
