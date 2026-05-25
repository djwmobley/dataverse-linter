# R45 probe 10 -- NO FIRE
# (if ...) appears only in a full-line # comment.
# strippedContent strips full-line comments before matching.
# R45 MUST NOT fire.

# Example antipattern (do not use): (if ($x) { 'a' } else { 'b' })
# The correct form is: $(if ($x) { 'a' } else { 'b' })

$safeValue = "safe value"
