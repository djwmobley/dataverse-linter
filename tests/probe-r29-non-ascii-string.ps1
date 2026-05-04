# PROBE: R29 - non-ASCII character inside a double-quoted string literal
# Windows PowerShell 5.1 silently corrupts brace-counting when multi-byte characters
# appear inside double-quoted string literals, causing MissingEndCurlyBrace parse
# errors at unrelated lines. The em-dash (U+2014) on line 13 triggers R29.
# R29 MUST fire on this file.

$optionSets = @("a")
Start-Transcript -Path "C:\Temp\log.txt"

$existing = $null
if ($null -eq $existing) {
    $msg = "Deploy complete — see dashboard"
}

Stop-Transcript
