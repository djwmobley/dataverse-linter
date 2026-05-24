# PROBE (regression guard): valid JSON array starting with [ must still be parsed.
# After the C# attribute guard, a '['-opening body whose first post-bracket non-whitespace
# char is '"', '{', '[', digit, ']', 't', 'f', or 'n' must still reach JSON.parse.
# This probe uses a '[{ "id": 1 }]' array that starts with '[' followed by '{'.
# odata-bind-guid and optionset-coverage may fire from the parsed payload; that is
# acceptable. extractor-json-error must NOT fire (no parse error on valid JSON).
$optionSets = @("account")

$payload = @"
[{ "logicalName": "account", "attributes": { "name": "test" } }]
"@

Invoke-RestMethod -Method POST -Uri "https://org.crm.dynamics.com/api/data/v9.2/accounts" -Body $payload
