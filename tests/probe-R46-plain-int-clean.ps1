# R46 probe 6 -- NO FIRE
# '{0:D2}' -f $n -- no [Math] call; $n is an ordinary variable.
# R46 pattern requires [Math]::(Floor|Ceiling|Round); plain variable is out of scope.
# R46 MUST NOT fire.

$n = 7
$val = '{0:D2}' -f $n
