# PROBE R32-case-insensitive-miss: Uppercase CONNECT-PNPONLINE -TENANTID.
# The R32 pattern is case-sensitive (no 'i' flag in the regex options used by the
# linter's validator.js — "gm" flags only). PowerShell cmdlets are case-insensitive
# but the linter regex is not.
#
# EXPECTED BEHAVIOR: R32 does NOT fire on all-uppercase variant.
# This probe documents the case-sensitivity limitation. Authors using
# uppercase or mixed-case cmdlet names would bypass the rule.
# KNOWN FALSE NEGATIVE — documented as a scope limit in README.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    CONNECT-PNPONLINE -Url "https://contoso.sharepoint.com" -TENANTID "contoso.onmicrosoft.com"
}
