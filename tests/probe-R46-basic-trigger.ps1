# R46 probe 1 -- FIRE
# '{0:D2}:{1:D2}' -f [Math]::Floor(...), ... -- [Math]::Floor returns [double];
# :D2 format specifier is integer-only (.NET docs: "Supported by: Integral types only").
# This throws 'Format specifier was invalid' at runtime.
# R46 MUST fire.

$m = 125
$timeStr = '{0:D2}:{1:D2}' -f [Math]::Floor($m / 60), ($m % 60)
