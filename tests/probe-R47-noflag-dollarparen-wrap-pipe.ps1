# PROBE R47: noflag-dollarparen-wrap-pipe
# Call-site row: `$(F) | ...`.
# R47 MUST NOT fire.

function Get-Wrapped {
    return ,$x
}
$(Get-Wrapped) | Sort-Object
