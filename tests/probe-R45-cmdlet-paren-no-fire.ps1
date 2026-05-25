# R45 probe 9 -- NO FIRE
# (Get-Foo) -- grouping operator wrapping a command/expression, not a statement keyword.
# This is the legitimate use of the grouping operator. R45 MUST NOT fire.

$count = (Get-ChildItem .).Count
$date  = (Get-Date).ToString("yyyy-MM-dd")
$value = (1 + 2 + 3)
