# R45 probe -- FIRE (regression anchor: real code (if ...) must still fire after v0.7.2)
# Confirms that pointing R45 at strippedNoBlockComments does NOT suppress detection
# of the actual antipattern in executable code. The block-comment FP fix must not
# introduce any false negatives for real code.
#
# R45 MUST fire.

$RawDumpFolder = "C:\Temp"
$DumpFile = (if (-not [string]::IsNullOrWhiteSpace($RawDumpFolder)) { Join-Path $RawDumpFolder 'out.json' } else { '' })
