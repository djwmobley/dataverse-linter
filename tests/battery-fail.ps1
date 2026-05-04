$optionSets = @("valid_optionset1")

# R07: force-overwrite without delete
pac solution import --force-overwrite

# R21: Topological Ordering Violation (create before import)
Invoke-RestMethod -Method POST -Uri "https://api/entities"
pac solution import --path "solution.zip"

# R26: Type Casting Violation
$url = "https://org.crm.dynamics.com/api/data/v9.2/EntityDefinitions(LogicalName='sample_keyresult')/Attributes(LogicalName='sample_progress')?$select=LogicalName,SourceType,FormulaDefinition"

# R28: Idempotency Violation (POST without if ($null -eq ...))
# Note: Comment has the words "if ($null -eq ...)" but it should be ignored by the strippedContent logic.
Invoke-RestMethod -Method POST -Uri "https://api/entities"

# R18: Boolean missing options
$payload2 = @"
{
    "@odata.type": "#Microsoft.Dynamics.CRM.BooleanAttributeMetadata",
    "SchemaName": "new_bool"
}
"@

# R24: import missing --publish-changes
pac solution import --path "solution.zip"

# R12: Old module
Connect-CrmOnlineDiscovery

# R13: variable expansion in string
$url3 = "https://api/?\$select=name"

# R25: shadowed headers
$headers = @{}

# extractor-json-error: interpolation
$payload3 = @"
{
    "name": "Test $($foo)"
}
"@

# odata-bind-guid
$payload4 = @"
{
    "name": "Test1",
    "global_optionset@odata.bind": "/GlobalOptionSetDefinitions(Name='missing_optionset')"
}
"@

# optionset-coverage
$payload5 = @"
{
    "name": "Test1",
    "global_optionset@odata.bind": "/GlobalOptionSetDefinitions(Name='missing_optionset2')"
}
"@

# system-entity-cascade
$payload6 = @"
{
    "SchemaName": "sample_initiative_systemuser",
    "ReferencedEntity": "systemuser",
    "ReferencingEntity": "sample_initiative",
    "CascadeConfiguration": {
        "Assign": "Cascade"
    }
}
"@