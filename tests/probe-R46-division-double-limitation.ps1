# R46 probe 7 -- NO FIRE (DOCUMENTED LIMITATION)
# '{0:D2}' -f ($n / 60) -- division produces a [double], which is also invalid
# with :D at runtime. However, R46 detects only the [Math]::(Floor|Ceiling|Round)
# token pattern; a bare arithmetic expression with no [Math] call is NOT caught.
# This is a known scope limitation: the pattern requires the [Math]:: token to
# anchor on the type-narrowing boundary. Fix: cast the division result to [int].
# R46 MUST NOT fire (documented false negative for division-produced doubles).

$n = 125
$val = '{0:D2}' -f ($n / 60)
