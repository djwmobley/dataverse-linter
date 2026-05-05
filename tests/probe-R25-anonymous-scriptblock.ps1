# PROBE R25: $body = @{ ... } inside an anonymous scriptblock literal at script scope.
#
# DOCUMENTED LIMITATION (v0.3.1): the scope-aware tracker in
# `computeFunctionBodyRanges` only walks NAMED `function NAME { ... }`
# declarations. It does NOT track anonymous scriptblock literals like
# `$sb = { ... }`. At runtime PowerShell gives the anonymous scriptblock its
# own variable scope -- so the $body assignment inside it cannot actually
# shadow $script:body -- but the static scanner does not detect that, and
# R25 fires here.
#
# This probe ASSERTS THE GAP HOLDS -- not that R25 should fire on this
# shape philosophically. The probe pins the documented limitation: if a
# future version extends `computeFunctionBodyRanges` to track anonymous
# scriptblocks, this probe will FAIL with a `mustFire: ['R25']` mismatch
# and force an explicit policy decision (update the README failure_modes
# section, decide whether to retire this probe, etc.). Per the
# dataverse-linter gate protocol (see feedback_dataverse_linter_gate.md),
# every documented limitation must be pinned by an asserting probe so that
# silent widening of the scope tracker cannot regress the docs.
#
# Cross-references:
#   - README.md "Known limitations" section
#   - tests/run-battery.js R25 section header comment

$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    $sb = {
        $body = @{ name = "test" }
        Invoke-RestMethod -Method POST -Uri "https://api/x" -Body $body
    }
    & $sb
}

Stop-Transcript
