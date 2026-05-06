# PROBE R37-N9-backtick-continuation-not-concat (v0.4.4 Gap 2 boundary):
# Negative probe (must NOT trigger):
# PowerShell backtick statement-continuation -- NOT string '+' concatenation.
#
# A backtick at the end of a line is a statement-continuation character in
# PowerShell, handled by the existing 'normalizedContent' view (which R37
# does NOT use -- R37 uses 'joinPlusContent'). The joinPlusContent view's
# regex only collapses patterns of the form:
#   (quote) optional-ws + optional-ws NEWLINE optional-ws (same-quote)
# A bare backtick at end-of-line without a '+' and quote on the next line
# is NOT collapsed by joinPlusContent (different pattern).
#
# This probe uses a backtick continuation that splits the invocation -- NOT
# the URL string itself -- across lines. The URL on each line does NOT
# contain 'appmoduleidunique' (the filter uses the correct _value form).
# R37 MUST NOT fire.

$appId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
$result = Invoke-RestMethod `
    -Uri "https://org.crm.dynamics.com/api/data/v9.2/appmodulecomponents?`$filter=_appmoduleidunique_value eq $appId" `
    -Method Get
