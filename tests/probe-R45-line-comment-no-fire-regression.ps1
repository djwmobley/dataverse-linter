# R45 probe -- NO FIRE (regression anchor: line-comment suppression must survive v0.7.2)
# (if ...), (foreach ...), (while ...) appearing only in full-line # comments.
# strippedContent (and therefore strippedNoBlockComments) both have line comments
# stripped, so these must NOT cause R45 to fire.
#
# This probe is a REGRESSION ANCHOR: the v0.7.2 switch from strippedContent to
# strippedNoBlockComments must not regress the line-comment suppression that was
# already in place under v0.7.0/v0.7.1.
#
# R45 MUST NOT fire.

# Example antipattern (do not use): (if ($condition) { 'yes' } else { 'no' })
# Also wrong: (foreach ($item in $list) { $item })
# Also wrong: (while ($i -lt 10) { $i++ })
# The correct forms are: $(if ...), $(foreach ...), $(while ...)

$safeValue = "no antipatterns in executable code here"
