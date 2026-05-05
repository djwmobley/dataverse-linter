# PROBE R34-pac-solution-install: "pac solution import" must NOT trigger R34.
# This is the correct command for importing a solution. The word "install" does
# not appear, so R34 must not fire. The fixture also includes --publish-changes
# so R24 does not fire either; the script is genuinely clean.
# R34 MUST NOT fire; expectClean is true.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    pac solution import --path "C:\solutions\MySolution.zip" --publish-changes
}
