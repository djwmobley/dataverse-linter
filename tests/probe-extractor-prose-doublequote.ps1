# PROBE 1: Prose @"..."@ here-string must NOT trigger extractor-json-error
# After fix: non-JSON-shaped here-strings are silently skipped.
# This prose description starts with 'P', not { or [, so it is skipped.
$optionSets = @()
Start-Transcript

$desc = @"
PnP PowerShell. The community-maintained module that wraps the SharePoint
Online REST and CSOM APIs. This script uses it for authentication and
REST calls into the /_api/ProjectServer/ endpoints.
"@

Stop-Transcript