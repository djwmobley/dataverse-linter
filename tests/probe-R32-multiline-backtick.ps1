# PROBE R32-multiline-backtick: Connect-PnPOnline with -TenantId on a CONTINUATION line.
# The R32 pattern uses [^'\n]* which stops at newlines, so -TenantId on the NEXT
# line (after a backtick continuation) will NOT be caught by R32 because the \n
# terminates the match before reaching -TenantId.
#
# EXPECTED BEHAVIOR: R32 does NOT fire (known false-negative for backtick-continuation
# form). This probe documents the limitation.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Connect-PnPOnline -Url "https://contoso.sharepoint.com" `
        -TenantId "contoso.onmicrosoft.com"
}
