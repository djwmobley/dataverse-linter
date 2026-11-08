# R28 probe -- NO FIRE: non-Dataverse (Azure DevOps) REST POST with no guard.
# No /api/data/ in the script, so the Dataverse idempotency rule does not apply.
Invoke-RestMethod -Method POST -Uri "https://dev.azure.com/org/project/_apis/wit/workitems/`$task?api-version=7.1" -Body '{}'
