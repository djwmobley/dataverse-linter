# R46 probe 4 -- FIRE
# '{0:D2}' -f [Math]::Round($n, 0) -- [Math]::Round also returns [double].
# :D format specifier is integer-only; throws 'Format specifier was invalid' at runtime.
# R46 MUST fire.

$n = 42.6
$val = '{0:D2}' -f [Math]::Round($n, 0)
