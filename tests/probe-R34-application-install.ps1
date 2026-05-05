# PROBE R34-application-install: "pac application install" must NOT trigger R34.
# R34 pattern is \bpac\s+install\b. "pac application install" has a word ("application")
# between "pac" and "install", so it does NOT match \bpac\s+install\b.
# This is the correct surface for installing an app to an environment.
# R34 MUST NOT fire.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    pac application install --environment-id "00000000-0000-0000-0000-000000000000" --application-name "MyApp"
}
