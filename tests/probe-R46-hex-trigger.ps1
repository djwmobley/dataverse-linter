# R46 probe 3 -- FIRE
# '{0:X4}' -f [Math]::Floor($n) -- :X (Hexadecimal) is integer-only.
# [Math]::Floor returns [double]; throws 'Format specifier was invalid' at runtime.
# R46 MUST fire.

$n = 255.9
$hhmm = '{0:X4}' -f [Math]::Floor($n)
