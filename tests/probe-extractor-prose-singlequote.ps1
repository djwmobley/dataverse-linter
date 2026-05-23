# PROBE 2: Prose @'...'@ here-string must NOT trigger extractor-json-error
# Single-quote here-strings are also scanned; prose bodies must be skipped.
$optionSets = @()
Start-Transcript

$readme = @'
Microsoft Graph Authentication. The core auth module for Microsoft Graph
PowerShell. This script uses it to resolve user GUIDs returned by PWA
into UPNs and display names for human-readable output.
'@

Stop-Transcript