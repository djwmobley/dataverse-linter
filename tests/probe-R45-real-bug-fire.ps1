# R45 probe -- FIRE: the exact real-world bug that motivated this rule.
# From an AdvAccel script: a -DumpFile parameter was set via (if ...) which
# PS parses 'if' as a command name; runtime error: "The term 'if' is not
# recognized as a name of a cmdlet, function, script file, or executable program."
# R45 MUST fire on this line.

Invoke-SomeTool `
    -DumpFile (if (-not [string]::IsNullOrWhiteSpace($RawDumpFolder)) { Join-Path $RawDumpFolder 'rest_x.json' } else { '' })
