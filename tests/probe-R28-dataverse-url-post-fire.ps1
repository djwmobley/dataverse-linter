# R28 probe -- FIRE: Dataverse Web API POST (/api/data/v9.2/) with no idempotency guard.
Invoke-RestMethod -Method POST -Uri "https://org.crm.dynamics.com/api/data/v9.2/contacts" -Body '{"lastname":"Smith"}'
