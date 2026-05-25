# R45 probe -- NO FIRE: the fix for the real-world bug above.
# Replacing (if ...) with $(if ...) makes this legal PowerShell.
# The subexpression operator $( ) is designed for statement results.
# R45 MUST NOT fire on this line.

Invoke-SomeTool `
    -DumpFile $(if (-not [string]::IsNullOrWhiteSpace($RawDumpFolder)) { Join-Path $RawDumpFolder 'rest_x.json' } else { '' })
