# PROBE R47: adversary-empty-return-comma-atparen-piped
# Adversary case: empty `return ,@()` piped -- flag (the operand @() is not a bare scalar literal, so the carve-out does not apply).
# R47 MUST fire.

function Get-Wrapped {
    return ,@()
}
Get-Wrapped | Sort-Object
