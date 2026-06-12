# R46 probe 2 -- NO FIRE
# [int][Math]::Floor(...) and [int]($m % 60) -- explicit cast to [int] before -f.
# :D2 is valid on integral types; cast makes the type correct.
# R46 MUST NOT fire.

$m = 125
$timeStr = '{0:D2}:{1:D2}' -f [int][Math]::Floor($m / 60), [int]($m % 60)
