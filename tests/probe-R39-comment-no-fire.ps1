# Probe 10 (NO FIRE): $varname: pattern appears only in a full-line comment.
# strippedContent strips full-line # comments before matching. The pattern does not
# see the comment text. R39 MUST NOT fire.
# Example of what NOT to do: $path: followed by text causes a parse error.
$path = "C:\data\output"
Write-Host "Path is: $path"
