# PROBE R34-basic-trigger: Minimal trigger for pac install.
# "pac install" is not a recognized pac command group. The pac CLI (as of 2026-02-25)
# has no top-level "install" command. R34 MUST fire on this file.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    pac install latest
}
