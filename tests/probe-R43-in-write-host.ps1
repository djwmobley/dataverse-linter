# Probe R43-2 (FIRE): Register-PnPManagementShellAccess in a Write-Host string.
# Even inside a string literal the cmdlet name is present in strippedContent.
# The error-handler pattern in Invoke-PWADiscovery.ps1 matches this form. R43 MUST fire.
Write-Host "  Register-PnPManagementShellAccess" -ForegroundColor Cyan
