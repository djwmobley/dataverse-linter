# R45 probe 12 -- NO FIRE
# $ifConfig -- a variable whose name starts with 'if'. The pattern requires
# the char before ( to NOT be $, @, or a word char (\w). A variable like
# $ifConfig is accessed as ($ifConfig.Name) -- the ( is preceded by nothing
# (start of expression) or whitespace, and the content is $ifConfig, not 'if'.
# The lookbehind (?<![$@\w]) anchors on the ( character; what follows is '$'
# then a letter, not 'if' directly. R45 MUST NOT fire.

$ifConfig = @{ name = 'eth0'; enabled = $true }
$name = ($ifConfig.name)
$status = ($ifConfig.enabled)
