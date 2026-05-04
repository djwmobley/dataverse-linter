# PROBE: R10 rejects legitimate componentType values from MS Learn taxonomy
# Per https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/solutioncomponent
# many values beyond {1,2,9,29} are valid: 10=EntityRelationship, 13=Form, 17=Process,
# 20=Role, 22=SiteMap, 24=WebResource, 26=Customization, 60=SystemForm, 80=AppModule, etc.
$optionSets = @("a")
Start-Transcript

$existing = $null
if ($null -eq $existing) {
    pac solution add-solution-component --componentType 10 --component aaa --publish-changes
    pac solution add-solution-component --componentType 13 --component bbb --publish-changes
    pac solution add-solution-component --componentType 24 --component ccc --publish-changes
    pac solution add-solution-component --componentType 60 --component ddd --publish-changes
    pac solution add-solution-component --componentType 80 --component eee --publish-changes
}

Stop-Transcript
