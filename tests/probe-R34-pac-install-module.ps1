# PROBE R34-pac-install-module: Install-Module is unrelated to pac and must NOT trigger R34.
# The pattern \bpac\s+install\b requires the word "pac" to immediately precede "install"
# with only whitespace between them. "Install-Module" does not start with "pac",
# so it must not match.
# R34 MUST NOT fire.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    Install-Module -Name Microsoft.Xrm.Data.PowerShell -Force
}
