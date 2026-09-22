# PROBE R47: adversary-multiline-atparen-continuation
# Adversary case: multi-line `@( 'a'` / newline / `, 'b' )` array-literal continuation must NOT be read as a top-level unary-comma statement (no flag).
# R47 MUST NOT fire.

function Get-Array {
    $arr = @(
        'a'
        , 'b'
    )
    return $arr
}
Get-Array | Sort-Object
