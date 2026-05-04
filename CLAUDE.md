# dataverse-linter — Project Context

## What this is

This is the dataverse-linter repo, a standalone Node.js static analyzer for PowerShell scripts that call the Dataverse Web API and the `pac solution` CLI, publicly hosted at github.com/djwmobley/dataverse-linter and owned by Dan Mobley. Substrate over assumption — README.md and the current source files are authoritative; do not reason from training-data assumptions about how the rules work.

## Authoritative references

- **README.md** — rule catalogue, rule types, content derivations, CLI reference. Read first.
- **HANDOFF.md** — current state and active session mission. Read before touching anything.
- **`src/`** — `validator.js`, `rule-manager.js`, `index.js`, `update-schema.js` are canonical truth. Re-read after any change.
- **`rules/`** — `registry.json` (dynamic rules), `module-requirements.json` (module-env rules), `schema.json` (optional live entity list), `overrides.json` (built-in message overrides).

## Rule addition workflow (canonical)

1. **Cite the source** — MS Learn URL (pinned to version), GitHub issue URL, or AdvAccel memory file path. No rule ships without a substrate citation.
2. **Pick the shape** — `regex` / `regex-inverse` / `regex-template` / `module-env-mismatch`. If none fit, defer and flag; a new rule type is a Principal-level decision.
3. **Add the rule** — use `node src/rule-manager.js ingest <file.json>`, or edit `registry.json` / `module-requirements.json` directly.
4. **Author probes** — one fixture that MUST fire the rule, one that must NOT fire it (negation probe). Minimal triggering content only.
5. **Extend `tests/run-battery.js`** — add probe entries to the `probes` array AND add the rule ID to `knownValidRules`.
6. **Run `node tests/run-battery.js`** — must be all-green before commit. Zero failures, zero unexpected rule IDs.
7. **Update README rule-catalogue table** — one row per rule, matching the format of the existing rows.
8. **Bump version in `package.json`, commit, push.**

## Hard rules

- Never delete an existing rule ID without Principal approval. Deprecate first via `enabled: false`, then get approval, then delete.
- Never break an existing probe. If a new rule fires on an existing fixture, review the fixture's expectations before suppressing.
- Every rule requires a substrate citation — in the commit message and in the rule's `message` field or a code comment.
- Probes are the regression surface. A rule without a probe has undefined future behavior.
- The linter is stateless: no DB, no env vars affecting rule evaluation, no network calls in the main path (only `update-schema.js` makes network calls).
- Node stdlib only. Do not add npm dependencies.

## Forbidden

- Writing files outside `C:\gemini\dataverse-linter\`.
- Touching the Judge persona's records or `pipeline_architect.exchange_log` DB.
- Pushing to `main` without battery green.
- Adding npm dependencies to `package.json`.

## Substrate citation requirement

Every claim about Dataverse / Power Platform / PowerShell behavior in a commit message, rule `message` field, or README description must point to an authoritative source — preferably an MS Learn URL pinned to the version in question. Internal AdvAccel memory files under `C:\Users\djwmo\.claude\projects\C--claudecode-AdvAccel\memory\` are acceptable substrate when an MS Learn URL does not cover the case. For example, `reference_ps51_unicode_in_strings_parser_hazard.md` is the substrate for R29; `feedback_ps_script_scope_shadowing_script_headers.md` is the substrate for R25. Narrative-only confirmations — "I know this to be true" or LLM training-data assertions — are not substrate. Per the AdvAccel `feedback_substrate_verify_full_api_surface_not_just_immediate_failure.md` rule: when auditing a body shape or API surface, read the full MS Learn reference page for every endpoint the script touches, not just the one that failed.
