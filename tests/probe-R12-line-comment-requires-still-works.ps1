#Requires -Version 5.1
# PROBE R12 (v0.4.1): true-negative anchor for line-comment guard recognition.
# A canonical line-comment `#Requires -Version 5.1` directive on the first line
# (the form PowerShell actually honors at parse time) followed by
# Connect-CrmOnlineDiscovery. R12 MUST NOT fire — this pins the existing
# line-comment behavior so that the new stripBlockComments step does not
# accidentally regress it. The block-comment fix surgically blanks only
# `<# ... #>` ranges; line-comment text remains visible to the guard regex.
#
# Without this regression anchor a future rev that, e.g., expanded the
# guard view to also strip line comments would silently re-fire R12 on
# correctly-guarded scripts; this probe makes the regression a probe FAILURE.
#
# Citation: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_requires

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Connect-CrmOnlineDiscovery -InteractiveMode
}
