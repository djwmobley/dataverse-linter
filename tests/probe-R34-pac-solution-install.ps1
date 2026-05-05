# PROBE R34-pac-solution-install: "pac solution import" must NOT trigger R34.
# This is the correct command for importing a solution. The word "install" does
# not appear, so R34 must not fire. R24 WILL fire (missing --publish-changes),
# which is expected and unrelated to R34.
# R34 MUST NOT fire.

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    pac solution import --path "C:\solutions\MySolution.zip" --publish-changes
}
