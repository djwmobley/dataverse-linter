# R45 probe -- NO FIRE: keyword-in-parens text inside a here-string.
$doc = @"
WRONG: (if ($a) { 1 }) must be $(if ($a) { 1 })
"@
$note = @'
Also wrong: (foreach ($i in 1..3) { $i })
'@
Write-Output $doc
Write-Output $note
