# PROBE R47: alias-noflag-undefined-target
# Alias extension: `Set-Alias NAME TARGET` where TARGET has no definition anywhere in the file
# (shape X, e.g. a real cmdlet or a typo). The alias itself is never flagged.
# R47 MUST NOT fire.

Set-Alias gx Get-NoSuchFunction
gx | Sort-Object
