# R45 probe -- NO FIRE: (foreach-object ...) is the ForEach-Object cmdlet alias form, not the foreach keyword.
$items = (1..3 | foreach-object { $_ * 2 })
$more = (foreach-object -InputObject 1 -Process { $_ })
Write-Output $items
Write-Output $more
