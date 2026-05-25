# R45 probe 4 -- FIRE
# (switch ...) -- switch statement keyword inside grouping operator.
# switch is a language statement; ( ) treats it as a command and fails at runtime.
# R45 MUST fire.

$val = (switch ($env:ComputerName) { 'SRV01' { 'server' } default { 'other' } })
