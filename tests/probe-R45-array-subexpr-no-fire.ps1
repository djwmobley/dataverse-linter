# R45 probe 7 -- NO FIRE
# @(if ...) -- array subexpression operator. The @ prefix makes this the
# array subexpression operator @( ), which legally accepts statements.
# R45 MUST NOT fire.

$items = @(if ($true) { 'yes' } else { 'no' })
