<#
.SYNOPSIS
A benign block comment without any #Requires directive inside.
This is regular comment-based help text. Nothing in this block should be
recognized as a guard directive.
#>
#Requires -Version 5.1
# PROBE R12 (v0.4.1): mixed-form true-negative. The script has BOTH a benign
# `<# ... #>` block comment (containing comment-based help text but NO
# `#Requires` lexeme) AND a real line-comment `#Requires -Version 5.1`
# directive. R12 MUST NOT fire — block-comment stripping must not damage
# line-comment guard recognition.
#
# This probe asserts that stripBlockComments() is a surgical, range-bounded
# transformation: it blanks ONLY the bytes inside `<# ... #>` ranges, leaving
# everything outside those ranges (including the column-0 line-comment
# `#Requires` directive) intact for the guard regex to see.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Connect-CrmOnlineDiscovery -InteractiveMode
}
