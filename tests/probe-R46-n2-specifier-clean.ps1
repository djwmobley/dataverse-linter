# R46 probe 5 -- NO FIRE
# '{0:N2}' -f [Math]::Round($n, 2) -- :N (numeric) is valid on floating-point types.
# .NET docs: "Supported by: All numeric types." No runtime error.
# R46 MUST NOT fire.

$n = 3.14159
$val = '{0:N2}' -f [Math]::Round($n, 2)
