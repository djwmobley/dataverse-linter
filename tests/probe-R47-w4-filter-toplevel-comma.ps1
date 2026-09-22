# PROBE R47: w4-filter-toplevel-comma
# Return-shape row: a top-level statement beginning with a unary comma. Also covers a `filter NAME { ... }` definition.
# R47 MUST fire.

filter Get-Wrapped {
    ,$_
}
Get-Wrapped | Sort-Object
