# PROBE R47: adversary-undefined-command-no-fire
# Adversary case: call to an undefined command `Get-ChildItem | Where-Object` -- no flag (Get-ChildItem is a real cmdlet with no in-file definition; shape X).
# R47 MUST NOT fire.

Get-ChildItem | Where-Object { $_.Length -gt 0 }
