# PROBE R32-singlequote-arg: trigger probe for R32 with single-quoted args.
# PnP examples idiomatically use single-quoted strings for URLs and tenant names.
# The original R32 pattern used [^'\n]* which terminated at the first single
# quote, missing this entire idiom. The pattern is now [^\n]* so single-quoted
# args between Connect-PnPOnline and -TenantId no longer terminate the match.
# R32 MUST fire on this fixture.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Connect-PnPOnline -Url 'https://contoso.sharepoint.com' -TenantId 'contoso.onmicrosoft.com'
}
