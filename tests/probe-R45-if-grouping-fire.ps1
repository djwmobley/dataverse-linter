# R45 probe 1 -- FIRE
# (if ...) -- statement keyword immediately after opening paren with no $ or @ prefix.
# The grouping operator treats 'if' as a command name; runtime raises:
#   "The term 'if' is not recognized as a name of a cmdlet, ..."
# R45 MUST fire.

$RawDumpFolder = "C:\Temp"
$DumpFile = (if (-not [string]::IsNullOrWhiteSpace($RawDumpFolder)) { Join-Path $RawDumpFolder 'rest_x.json' } else { '' })
