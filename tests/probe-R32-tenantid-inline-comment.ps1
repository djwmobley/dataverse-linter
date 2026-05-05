# PROBE R32-tenantid-inline-comment: Demonstrates a known FALSE POSITIVE for R32.
# The rule pattern is Connect-PnPOnline\b[^'\n]*-TenantId\b.
# The [^'\n]* greedy class spans across inline comments on the SAME line.
# A line like:
#   Connect-PnPOnline -Url "..." # -TenantId removed
# contains the literal text "-TenantId" after the # comment marker, on the same
# line as the Connect-PnPOnline call. The regex still matches because [^'\n]*
# captures everything up to end-of-line including the comment text.
#
# EXPECTED BEHAVIOR: R32 FIRES (false positive — the actual code is correct, but
# the inline comment contains -TenantId and the pattern cannot distinguish).
# This probe documents the limitation explicitly as a regression anchor.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Connect-PnPOnline -Url "https://contoso.sharepoint.com" -Tenant "contoso.onmicrosoft.com" # -TenantId removed in v2
}
