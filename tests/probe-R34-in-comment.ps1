# PROBE R34-in-comment: "pac install" appearing only on a full-line # comment.
# strippedContent strips full-line # comments before regex matching.
# R34 MUST NOT fire on a full-line comment containing "pac install".

$optionSets = @("a")

$existing = $null
if ($null -eq $existing) {
    # pac install latest  <-- this is a WRONG command, replaced by pac application install
    pac application install --environment-id "00000000-0000-0000-0000-000000000000" --application-name "MyApp"
}
