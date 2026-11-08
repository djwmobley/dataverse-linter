# R45 probe -- FIRE: bare statement keyword inside the grouping operator.
$a = $true
$x = ( if ($a) {1} )
Write-Output $x
