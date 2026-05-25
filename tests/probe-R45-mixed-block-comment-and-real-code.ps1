# R45 probe -- FIRE EXACTLY ONCE (mixed: block-comment with keyword + real code with keyword)
# A block comment containing "(while ..." must NOT fire R45.
# A real executable "(foreach (...) {...})" on a separate line MUST fire R45 once.
# Net result: R45 fires exactly once (on the real code line only).
#
# This probe validates that strippedNoBlockComments correctly suppresses the
# block-comment instance while the real-code instance still triggers detection.
#
# R45 MUST fire exactly once.

<#
.NOTES
  WRONG USAGE (do not use): (while ($i -lt $max) { $i++ })
  This appears in block comment doc prose -- should NOT cause R45 to fire.
  The (while ...) inside this block comment is inert comment text.
#>

# The following line has the real antipattern in executable code:
$items = (foreach ($x in @(1,2,3)) { $x * 2 })
