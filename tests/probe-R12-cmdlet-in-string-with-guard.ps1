#Requires -PSEdition Desktop
# PROBE R12: cmdlet name appears only in a Write-Host string literal; #Requires
# guard is present. v0.3.1 conjunction-aware R12 MUST NOT fire because the
# guard suppresses R12 globally. Documents that string-literal occurrences are
# benign when the guard is in place. (Strings are not stripped from
# strippedContent, so R12's pattern would otherwise match the literal.)

$optionSets = @("a")
Start-Transcript

# R28 guard: idempotency check at script scope so the probe is otherwise clean.
$existing = $null
if ($null -eq $existing) {
    Write-Host "This script avoids using Connect-CrmOnlineDiscovery directly."
}

Stop-Transcript
