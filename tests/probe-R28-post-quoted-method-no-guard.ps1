# PROBE R28-post-quoted-method-no-guard (v0.4.2 round-1 fix-pass regression anchor):
# True positive (HIGH-1 fix anchor):
# Web API POST mutation IS present with the QUOTED method literal form
# (Invoke-RestMethod -Method "POST" -- idiomatic ALM-script form),
# idempotency guard is absent. R28 MUST fire.
#
# Pre-fix v0.4.2 (commit 0525d04): R28 silently skipped this script
# because requires_present ran against noCommentNoStringContent, which
# strips string literals (rendering "POST" as ""). The precondition
# alternation (?:POST|Post|post|...) does not match empty. Rule skipped.
# Post-fix v0.4.2 (commit dea0d9f+): requires_present runs against
# normalizedContent (strings preserved). The precondition matches the
# literal POST inside the quotes. R28 fires.
#
# This probe pins the HIGH-1 fix so a future revert of normalizedContent
# back to targetContent would surface as a battery red.

$optionSets = @("a")

Invoke-RestMethod -Method "POST" -Uri "https://org.crm.dynamics.com/api/data/v9.2/accounts" -Body '{"name":"Acme"}'
