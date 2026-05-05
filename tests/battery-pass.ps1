#Requires -PSEdition Desktop
$transcriptPath = "logs\run.log"
Start-Transcript -Path $transcriptPath -Append

$optionSets = @("valid_optionset1", "valid_optionset2")

# Valid pac import FIRST
# Also tests R24 bypass (backtick continuation shouldn't flag missing --publish-changes)
pac solution import `
  --path "solution.zip" `
  --publish-changes

# Valid Bind
$payload1 = @"
{
    "name": "Test1",
    "global_optionset@odata.bind": "/GlobalOptionSetDefinitions(00000000-0000-0000-0000-000000000000)"
}
"@

# Single quote here-string valid bind
$payload2 = @'
{
    "name": "Test2",
    "global_optionset@odata.bind": "/GlobalOptionSetDefinitions(00000000-0000-0000-0000-000000000000)"
}
'@

# Valid Idempotency Check
$existing = $null
if ($null -eq $existing) {
    # Valid Web API Create
    Invoke-RestMethod -Method POST -Uri "https://org.crm.dynamics.com/api/data/v9.2/entities"
}

# Valid Type Casting for Formula
$url = "https://org.crm.dynamics.com/api/data/v9.2/EntityDefinitions(LogicalName='sample_keyresult')/Attributes(LogicalName='sample_progress')/Microsoft.Dynamics.CRM.DecimalAttributeMetadata?$select=LogicalName,SourceType,FormulaDefinition"

# Valid module import (pwsh-compatible)
Import-Module Microsoft.Xrm.Data.PowerShell

# Safe assignment
$myHeaders = @{}

Stop-Transcript