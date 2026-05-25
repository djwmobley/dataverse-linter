# R45 probe 3 -- FIRE
# ( foreach ...) -- foreach statement keyword inside grouping operator.
# Same runtime failure as (if ...): foreach is not a command name.
# R45 MUST fire.

$items = ( foreach ($x in 1..3) { $x * 2 })
