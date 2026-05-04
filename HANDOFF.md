# dataverse-linter — Session Handoff

## Last session summary (2026-05-04)

Released **v0.2.0** (tag `v0.2.0`, main commit `a9ec2a8`).

Three new rules shipped, all AdvAccel-derived:

- **R29** (`regex`, ERROR) — non-ASCII characters (em-dash, section sign, smart quotes, ellipsis, bullet, en-dash, non-breaking space) inside double-quoted string literals. Substrate: `reference_ps51_unicode_in_strings_parser_hazard.md`. PS 5.1 brace-counter silently misbehaves; same characters in `#` comments are safe.
- **R31** (`regex-template`, ERROR) — known-bad cmdlet+parameter combinations. Initial seed: `Connect-CrmOnlineDiscovery` + `-ShowProgress` (switch absent in `Microsoft.Xrm.Data.PowerShell` v2.8.21). Extensible via `node src/rule-manager.js set-variables R31`.
- **module-env-mismatch** (new rule category, ERROR) — driven by `rules/module-requirements.json`. Initial seed: `Microsoft.Xrm.Tooling.CrmConnector.PowerShell` requires `#Requires -PSEdition Desktop`.

Five new probes added. Battery result at release: **2 batteries + 18 probes + 1 unit test, all green.**

## Current rule inventory

### Dynamic rules — `rules/registry.json` (12 rules)

| ID | Type | Severity | Summary |
|---|---|---|---|
| R07 | regex | ERROR | `pac solution import --force-overwrite` without attribute deletion |
| R12 | regex | ERROR | `Connect-CrmOnlineDiscovery` / `Microsoft.Xrm.Tooling.CrmConnector.PowerShell` in pwsh |
| R13 | regex | ERROR | `$select`/`$filter`/`$expand` in double-quoted string without backtick escape |
| R16 | regex-inverse | INFO | Missing `Start-Transcript` |
| R18 | regex | ERROR | `BooleanAttributeMetadata` payload missing `TrueOption`/`FalseOption` |
| R21 | regex | WARN | `Invoke-RestMethod POST` appears after `pac solution import` (wrong stage ordering) |
| R24 | regex | WARN | `pac solution import` without `--publish-changes` |
| R25 | regex-template | ERROR | Unprefixed script-scope assignment to shadow-prone variable names |
| R26 | regex | ERROR | `FormulaDefinition` query on base `AttributeMetadata` without derived type cast |
| R28 | regex-inverse | WARN | Missing idempotency guard (`if ($null -eq ...)`) |
| R29 | regex | ERROR | Non-ASCII character inside double-quoted string literal (PS 5.1 parser hazard) |
| R31 | regex-template | ERROR | Known-bad cmdlet+parameter combination |

### Built-in payload rules — `src/validator.js` (5 rules)

| ID | Severity | Summary |
|---|---|---|
| odata-bind-guid | ERROR | `@odata.bind` using alternate-key syntax instead of GUID |
| optionset-coverage | ERROR | Global option set name missing from `$optionSets` bootstrap array |
| system-entity-cascade | ERROR | Relationship payload targets system entity with `Assign` != `NoCascade` |
| schema-entity-not-found | ERROR | `ReferencedEntity`/`ReferencingEntity` absent from `rules/schema.json` |
| extractor-json-error | ERROR | Here-string payload not parseable as JSON |

### Module-environment rules — `rules/module-requirements.json` (1 rule)

| Rule ID | Module | Required directive |
|---|---|---|
| module-env-mismatch | Microsoft.Xrm.Tooling.CrmConnector.PowerShell | `#Requires -PSEdition Desktop` |

**Total: 18 rules.**

## Next session mission — EXTERNAL RESEARCH

Research authoritative external sources for syntax-related and runtime-related gotchas that fit the linter's rule shapes. Deliverable: **v0.3.0** with N new rules (target 3–8), each backed by a substrate citation, a fire probe, and a negation probe.

### Scope vectors

**Syntax gotchas — PS 5.1 specifically:**

- PS 7+ syntax that silently breaks PS 5.1 parsing: ternary `? :`, null-coalescing `??` and `??=`, chain operators `&&`/`||`, `using namespace`, `Foreach-Object -Parallel`, `using assembly`, `[ordered]` accelerator placement
- Additional Unicode-class hazards beyond R29: zero-width chars (U+200B, U+FEFF mid-file), RTL marks (U+200F), combining diacritics, BOM in the middle of a file
- Backtick edge cases: escape sequences inside double-quoted here-strings, double-backtick (`\`\``) semantics
- `[CmdletBinding()]` placement and parameter attribute ordering quirks

**Runtime gotchas — Dataverse Web API:**

- Missing canonical headers (`OData-MaxVersion: 4.0`, `OData-Version: 4.0`, `Accept: application/json`) on Web API requests — these produce unhelpful 400/406 errors
- Wrong `Prefer: odata.include-annotations` syntax
- `MSCRM.SolutionUniqueName` header for solution-targeted metadata operations
- `If-Match` semantics: upsert vs update vs optimistic concurrency confusion
- Batch request boundary syntax errors (`--batchrequest_` delimiter shape)
- `_<lookup>_value` field naming convention violations in `$select`/`$filter`
- `EntitySetName` (plural, e.g. `accounts`) vs `LogicalName` (singular, e.g. `account`) confusion in URL paths
- 429 throttling without retry/backoff pattern
- Token expiration without refresh logic
- Upsert with `@odata.bind` in wrong payload position
- `BooleanAttributeMetadata` adjacent: `CreateEntity` missing required `PrimaryAttribute` shape (see `feedback_substrate_verify_full_api_surface_not_just_immediate_failure.md`)

**Runtime gotchas — pac CLI:**

- `pac auth select` ambiguity when multiple profiles exist
- `pac solution import` vs `pac solution upgrade` vs `pac solution stage-and-upgrade` choice errors
- `pac org list` vs `pac admin list` scope differences
- pac CLI .NET runtime version requirements
- pac canvas commands deprecated — migration to `pac powerfx`

**Module-environment entries (extend `module-requirements.json`):**

- `Microsoft.Xrm.Data.PowerShell` — PS edition and minimum version
- `Az.*` modules — minimum PS version requirement
- `Microsoft.Graph.*` — requires `#Requires -Version 7.0`
- `MicrosoftPowerBIMgmt` — known quirks
- `MSAL.PS` vs `Microsoft.Identity.Client` — module-choice signal

### Reference sources (in priority order)

1. **AdvAccel memory files** — `C:\Users\djwmo\.claude\projects\C--claudecode-AdvAccel\memory\` — re-canvass for feedback files with rule-shaped findings not yet generalized. Pay special attention to `feedback_substrate_verify_full_api_surface_not_just_immediate_failure.md` for `CreateEntity` primary-attribute and Boolean OptionSet body shapes.
2. **MS Learn — Dataverse Web API:** `https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/` — headers, batch operations, metadata operations, error handling
3. **MS Learn — PowerShell language spec:** `https://learn.microsoft.com/en-us/powershell/scripting/lang-spec/chapter-01` and following — version-specific syntax differences
4. **MS Learn — pac CLI reference:** `https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/` — full subcommand surface
5. **GitHub issues:** `https://github.com/microsoft/PowerApps-CLI/issues` (closed-fixed, past gotchas) and `https://github.com/seanmcne/Microsoft.Xrm.Data.PowerShell/issues`
6. **MS Q&A:** `https://learn.microsoft.com/en-us/answers/topics/dataverse-developers.html`
7. **StackOverflow:** `[dataverse]` + `[powershell]` tag combination
8. **Power Platform Community:** `https://powerusers.microsoft.com` — Power Apps Developer board
9. **Long-tail blogs:** Sara Lagerquist (notesfromnathalie.com), Carl de Souza (carldesouza.com), Mark Carrington (markcarrington.dev) — practitioner-level findings that MS Learn glosses over

### Output discipline (per CLAUDE.md)

For each new rule, deliver:
- Substrate citation (URL or AdvAccel memory file path)
- JSON rule definition (or `module-requirements.json` entry)
- Fire probe fixture + negation probe fixture under `tests/`
- `run-battery.js` extension: add to `probes` array AND `knownValidRules` set
- README catalogue row in the existing table format
- Commit message naming the source

Quality gate: battery all-green before commit. If a new rule fires on an existing probe fixture, review the existing probe's expectations first — do not suppress to make the new rule fit.

**Volume discipline:** 3–8 new rules per research pass depending on substrate density. A single well-substrated rule with a clean probe pair is worth more than five hand-wavy rules.

## Workflow reminders

Read CLAUDE.md and README.md first if CWD is the linter repo (CLAUDE.md auto-loads in Claude Code). Both document the rule-addition workflow.

- `node src/rule-manager.js template` — see the rule JSON shape
- `node src/rule-manager.js list` — see the current registry
- `node src/rule-manager.js ingest <file.json>` — add or update rules from a JSON file
- For module-env additions: edit `rules/module-requirements.json` directly; no `validator.js` code change needed

For each candidate finding: decide whether it fits `regex` / `regex-inverse` / `regex-template` / `module-env-mismatch`. If none of those shapes work, defer and flag it — a new rule type requires a Principal-level decision, not a research-session decision.

## Aim

Ship v0.2.0 → **v0.3.0** with the research-derived rules. Tag and push at session end. Rewrite the "Last session summary" section in this file with the new state when done.

## Optional checkpoints

- **Mid-session:** if a finding is significant enough for Judge oversight before encoding it as a rule, file a `kind='research'` row in `pipeline_architect.exchange_log` via psql.
- **End-session:** bump version in `package.json`, run battery, commit, push, tag, update this file.
