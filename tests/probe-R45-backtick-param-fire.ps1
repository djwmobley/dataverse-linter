# R45 probe 6 -- FIRE
# Backtick line-continuation before the paren -- (if ...) antipattern
# split across lines. strippedContent preserves the paren-then-keyword
# even when backtick-continued (the validator normalizes backtick continuations
# for R24/R21 but R45 runs on strippedContent, which retains the pattern
# because the keyword appears on the next line after the ( on the prior line).
# The key test: ( is immediately followed by whitespace/newline, then 'if'.
# R45 MUST fire.

Invoke-SomeTool `
    -DumpFile (if (-not [string]::IsNullOrWhiteSpace($folder)) { Join-Path $folder 'out.json' } else { '' })
