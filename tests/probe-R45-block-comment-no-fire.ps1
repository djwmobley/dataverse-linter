# R45 probe -- NO FIRE (v0.7.2 block-comment false-positive fix)
# A <# ... #> block-comment body containing "(if", "(foreach", "(while" etc.
# must NOT cause R45 to fire. Block-comment bodies are comment content
# per about_Comments: "All text within the block is treated as part of the
# same comment." Keywords inside a block comment are never executed, so the
# runtime error R45 guards against cannot occur there.
#
# Before v0.7.2: R45 evaluated against strippedContent, which strips only
# line comments. Block-comment bodies survived into strippedContent, causing
# R45 to fire on doc-comment prose containing "(if" -- a false positive.
# v0.7.2: R45 now evaluates against strippedNoBlockComments (strippedContent
# with block-comment ranges additionally blanked), eliminating this FP class.
#
# Substrate citation:
#   https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_comments
#   "All text within the block is treated as part of the same comment."
#
# R45 MUST NOT fire.

<#
.SYNOPSIS
  Example utility function.

.DESCRIPTION
  WRONG USAGE (do not use):  -DumpFile (if ($x) { 'a' } else { 'b' })
  The (if ...) form places a statement keyword inside the grouping operator;
  PS parses 'if' as a command name at runtime. The correct form uses the
  subexpression operator: -DumpFile $(if ($x) { 'a' } else { 'b' }).

  The (foreach ...) and (while ...) forms have the same problem.
  Always use $(foreach ...) or $(while ...) instead.
#>
function Get-SafeValue {
    param([string]$InputVal)
    return $InputVal.Trim()
}

$trimmedVal = Get-SafeValue -InputVal "test"
