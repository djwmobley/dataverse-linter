# Dataverse Linter

A standalone Node.js static analyzer for PowerShell scripts that call the Dataverse Web API and the `pac solution` CLI. It reads a `.ps1` file, extracts JSON payloads from here-strings, and evaluates the script against a registry of rules covering metadata layering, ALM sequencing, Web API correctness, and PowerShell script hygiene.

## Why it exists

Many Dataverse ALM scripts fail in non-obvious ways — formula columns blocked at the Web API, optionset coverage drift, idempotency gaps in POST loops, PowerShell variable names shadowing the script scope, and more. This linter encodes recurring failure modes as enforceable rules so they are caught at author time, not at deployment time.

## Status

Developed under adversarial review by an external "Judge" agent over four review phases. The substrate is currently approved for internal pilot use; it has not yet been validated by an org-wide pilot. Rule IDs, content derivations, and CLI surface are considered stable for pilot purposes but should be treated as pre-1.0 until pilot findings are incorporated.

## Install

```
git clone https://github.com/djwmobley/dataverse-linter.git
cd dataverse-linter
```

Requires **Node 18+**. PowerShell is required only for the scripts being linted — the linter itself runs entirely in Node.

No additional npm dependencies are required for the linter or the test battery.

## Quick start

Lint a single script:

```
node src/index.js path/to/script.ps1
```

Run the full test battery:

```
node tests/run-battery.js
```

Or via npm:

```
npm test
```

List all active rules:

```
node src/rule-manager.js list
```

## Rule catalogue

The linter applies two categories of rules: **dynamic rules** loaded from `rules/registry.json` at runtime, and **built-in structural rules** compiled into `src/validator.js` that reason over parsed JSON payloads.

| ID | Type | Severity | What it catches |
|---|---|---|---|
| R07 | regex | ERROR | `pac solution import --force-overwrite` usage; flag does not resolve metadata conflicts and should be paired with attribute deletion. |
| R12 | regex | ERROR | `Connect-CrmOnlineDiscovery` or `Microsoft.Xrm.Tooling.CrmConnector.PowerShell` import; these modules hang under pwsh — script must run under `powershell.exe` 5.1. |
| R13 | regex | ERROR | `$select`, `$filter`, or `$expand` inside a double-quoted string without a backtick escape; PowerShell interpolates these, corrupting the OData query. |
| R16 | regex-inverse | INFO | Script does not contain `Start-Transcript`; all ALM scripts should log to transcript. |
| R18 | regex | ERROR | `BooleanAttributeMetadata` payload missing `TrueOption`/`FalseOption`; both are required by the Dataverse Web API. |
| R21 | regex | WARN | `Invoke-RestMethod POST` appears after `pac solution import`; managed solution import should precede table/column creation to avoid metadata layering conflicts. |
| R24 | regex | WARN | `pac solution import` without `--publish-changes`; customizations remain unpublished after import. |
| R25 | regex-template | ERROR | Assignment to a bare script-scope variable matching one of the configured names (default: `headers`, `body`, `conn`, `options`, `response`, `result`); these shadow `$script:` prefixed equivalents. |
| R26 | regex | ERROR | OData query for `FormulaDefinition` on the base `AttributeMetadata` endpoint; a derived type cast is required (e.g., `/Microsoft.Dynamics.CRM.DecimalAttributeMetadata`). |
| R28 | regex-inverse | WARN | Script lacks an idempotency guard (`if ($null -eq ...)`); Web API POST calls should be guarded against re-creation. |
| odata-bind-guid | built-in | ERROR | `@odata.bind` value uses an alternate key (`Name='X'`) instead of a GUID; alternate-key binds are not supported by the Web API. |
| optionset-coverage | built-in | ERROR | A global option set name referenced in a payload is missing from the script's `$optionSets` bootstrap array. |
| system-entity-cascade | built-in | ERROR | Relationship payload targets a system entity (e.g., `systemuser`, `account`) with `Assign` set to a value other than `NoCascade`; cascade on system entities causes data integrity risks. |
| schema-entity-not-found | built-in | ERROR | `ReferencedEntity` or `ReferencingEntity` in a payload does not exist in `rules/schema.json`; fires only when a live schema has been fetched via `update-schema.js`. |
| extractor-json-error | built-in | ERROR | A here-string payload could not be parsed as JSON; commonly caused by unescaped PowerShell variable interpolation inside a double-quoted here-string (`@"..."@`). |

## Rule types

### `regex`

Fires when the pattern matches anywhere in the script content. The content surface used is `strippedContent` (full-line `#` comments removed) except for R21 and R24, which use `normalizedContent` (backtick line-continuations collapsed) so that multi-line `pac solution import` calls are evaluated as a single logical statement.

Example — R07 catches `--force-overwrite` on any `pac solution import` call:

```json
{
  "id": "R07",
  "type": "regex",
  "pattern": "pac\\s+solution\\s+import.*--force-overwrite",
  "message": "Use --force-overwrite only for property-level reconciliation.",
  "severity": "ERROR",
  "enabled": true
}
```

### `regex-inverse`

Fires when the pattern does NOT match — i.e., a required element is absent. Used for mandatory patterns such as `Start-Transcript` (R16) and idempotency guards (R28). These rules evaluate against `noCommentNoStringContent` (see Content derivations) so that a developer cannot satisfy the rule by hiding the pattern inside a comment or string literal.

Example — R16 fires when `Start-Transcript` is missing from real executable code:

```json
{
  "id": "R16",
  "type": "regex-inverse",
  "pattern": "Start-Transcript",
  "message": "Script must contain Start-Transcript.",
  "severity": "INFO",
  "enabled": true
}
```

### `regex-template`

A parameterized variant of `regex`. The pattern contains a `${variables}` placeholder that is substituted at evaluation time with the rule's `variables` array joined by `|`. This allows org-policy lists (variable names, banned commands, approved cmdlets, etc.) to be updated via `rule-manager.js set-variables` without rewriting the regex.

Example — R25 checks a configurable list of variable names that must not be assigned at bare script scope:

```json
{
  "id": "R25",
  "type": "regex-template",
  "pattern": "^\\s*\\$(${variables})\\s*=",
  "variables": ["headers", "body", "conn", "options", "response", "result"],
  "message": "Unprefixed assignment at script scope shadows $script:.",
  "severity": "ERROR",
  "enabled": true
}
```

At evaluation time, `${variables}` is replaced with `headers|body|conn|options|response|result`, producing a regex that matches any of those names at the start of an assignment.

## Content derivations

The validator works against three derived surfaces of the script content, not the raw file. Understanding which surface a rule uses is necessary when writing or debugging rules.

**`strippedContent`** — the raw file with full-line `#` comments removed (lines where the first non-whitespace character is `#`). Default for most `regex` and `regex-template` rules. Inline comments after code are retained; use `noCommentNoStringContent` if inline comment bypass is a concern.

**`normalizedContent`** — `strippedContent` with PowerShell backtick-newline continuations (`` ` `` followed by a newline) collapsed to a single space, making a multi-line command one logical line. Used by R24 and R21 so that a `pac solution import` split across lines with backtick continuation is evaluated as a single statement and `--publish-changes` is not missed.

**`noCommentNoStringContent`** — the most aggressively stripped surface. Removes, in order: here-string bodies, block comments (`<# ... #>`), double-quoted strings, single-quoted strings, and all remaining `#`-to-end-of-line comments. Used exclusively by `regex-inverse` rules (R16, R28) to prevent bypass: a developer cannot satisfy `Start-Transcript` or the idempotency guard requirement by placing the pattern inside a comment or a string literal.

## CLI reference — `rule-manager.js`

All subcommands are run as `node src/rule-manager.js <subcommand>`.

### `list`

Print all rules in the registry as a table.

```
node src/rule-manager.js list
```

### `template`

Print JSON templates for both `regex` and `regex-template` rule types. Use as a starting point when authoring a new rule.

```
node src/rule-manager.js template
```

### `ingest <file.json>`

Add or update rules from a JSON file. The file may contain a single rule object or an array of rule objects. Rules with the same `id` as an existing registry entry are overwritten in place; new IDs are appended. Reports counts of added and updated rules on completion.

```
node src/rule-manager.js ingest my-new-rules.json
```

A rule definition requires at minimum `id`, `type`, and `message`. Rules missing any of these are skipped with an error message.

### `delete <ruleId>`

Remove a rule from the registry by ID.

```
node src/rule-manager.js delete R07
```

### `set-variables <ruleId> <var1> [var2 ...]`

Replace the `variables` array on a `regex-template` rule. Errors if the rule is not `regex-template` type. Use this to update the policy list (e.g., adding a new variable name to R25) without editing the registry file directly.

```
node src/rule-manager.js set-variables R25 headers body conn options response result payload uri
```

## Live schema validation (optional)

By default, `rules/schema.json` contains a generic stub set of entities used for testing. The `schema-entity-not-found` rule runs against this stub and will false-positive on real org entities not present in it.

To populate `schema.json` from a live Dataverse environment, set these environment variables and run `update-schema.js`:

```
DATAVERSE_TENANT_ID=<your-tenant-id>
DATAVERSE_CLIENT_ID=<app-registration-client-id>
DATAVERSE_CLIENT_SECRET=<client-secret>
DATAVERSE_ENV_URL=https://yourorg.crm.dynamics.com
```

```
node src/update-schema.js
```

This authenticates via client-credentials flow, fetches the `$metadata` CSDL XML endpoint, and writes the parsed entity list to `rules/schema.json`.

To test the CSDL parser against a local XML file without live credentials:

```
node src/update-schema.js --mock path/to/metadata.xml
```

## Test battery

`tests/run-battery.js` runs a self-critical test suite that verifies both directions: it asserts that all expected rules fire on a known-bad fixture AND that no unexpected rules fire. The battery comprises:

- **Pass battery** (`battery-pass.ps1`) — a clean script expected to produce no violations; linter must exit 0.
- **Fail battery** (`battery-fail.ps1`) — a script with all 14 known violation types; linter must catch every one and must not fire any unexpected rule IDs.
- **13 adversarial probes** — targeted single-concern fixtures, each declaring which rules must fire, which must not fire, and in some cases exact fire counts. Probes cover: comment-bypass shapes for regex-inverse rules, single-quote here-string parsing, unparseable payloads with variable interpolation, backtick line-continuation handling for R24, semicolon- and pipe-terminated `pac solution import` calls, R25 with both default and non-default variable sets, and `system-entity-cascade` on a system entity.
- **1 unit test** (`test-r25-template.js`) — directly tests the `regex-template` substitution mechanism in `src/validator.js` without going through the full linter pipeline.

The probe set is the regression-test surface. When adding a new rule, ship a corresponding probe that asserts the rule fires on a minimal triggering fixture and does not fire on a clean one.

## Extending the linter

**Path A — dynamic rules (no code changes):** for `regex`, `regex-inverse`, or `regex-template` rules, write a JSON rule definition and ingest it:

```
node src/rule-manager.js ingest my-rule.json
```

The rule is active immediately for all subsequent linter runs. Add a probe fixture in `tests/` and register it in `run-battery.js`.

**Path B — structural rules:** rules that need to reason over parsed JSON payloads (like `odata-bind-guid` or `system-entity-cascade`) cannot be expressed as patterns alone. Add the logic directly to `src/validator.js` inside the `payloads.forEach` block. Add a corresponding message override to `rules/overrides.json` if the message should be configurable without touching source. Add a fixture and probe.

## License

MIT. See the LICENSE file.

## Provenance

Developed by Dan Mobley (djwmobley) with iterative adversarial review by an automated "Judge" agent over four phases. Review record archived externally.
