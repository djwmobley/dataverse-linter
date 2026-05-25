# R45 probe 2 -- NO FIRE
# $(if ...) -- subexpression operator prefix makes this legal.
# The subexpression operator $( ) is designed to hold one or more statements.
# Per about_Operators: "Returns the result of one or more statements."
# R45 MUST NOT fire.

$RawDumpFolder = "C:\Temp"
$DumpFile = $(if (-not [string]::IsNullOrWhiteSpace($RawDumpFolder)) { Join-Path $RawDumpFolder 'rest_x.json' } else { '' })
