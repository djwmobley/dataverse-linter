# PROBE: C# here-string body starting with [DllImport must NOT trigger extractor-json-error.
# Root cause of false positive: trim() strips the leading newline of @'...'@ bodies,
# leaving '[DllImport(' as the first char. The '[' passes the JSON-shape guard but
# JSON.parse fails on C# code. Fix: require the first non-whitespace char after '[' to
# be a JSON array element-start char; 'D' (DllImport) is not, so the body is skipped.
$optionSets = @()

$setDllDirSig = @'
[DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
public static extern bool SetDllDirectory(string lpPathName);
'@

Add-Type -MemberDefinition $setDllDirSig -Name 'NativeMethods' -Namespace 'Spike' -PassThru | Out-Null
