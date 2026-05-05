# Dataverse Linter

A standalone Node.js static analyzer for PowerShell scripts that call the Dataverse Web API and the `pac solution` CLI. It reads a `.ps1` file, extracts JSON payloads from here-strings, and evaluates the script against a registry of rules covering metadata layering, ALM sequencing, Web API correctness, and PowerShell script hygiene.

## Why it exists

Many Dataverse ALM scripts fail in non-obvious ways — formula columns blocked at the Web API, optionset coverage drift, idempotency gaps in POST loops, PowerShell variable names shadowing the script scope, and more. This linter encodes recurring failure modes as enforceable rules so they are caught at author time, not at deployment time.

## Severity policy

Every rule in this linter has severity **ERROR**. The design principle: if a pattern expresses a real failure mode it is an ERROR; if it does not, the rule should not exist. There are no WARN or INFO rules. If a proposed rule cannot be linked to a concrete runtime failure, it is not added.

## Status

Developed under adversarial review by an external "Judge" agent over six review phases. The substrate is approved for internal pilot use; it has not yet been validated by an org-wide pilot. Rule IDs, content derivations, and CLI surface are considered stable for pilot purposes but should be treated as pre-1.0 until pilot findings are incorporated.

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
| R18 | regex | ERROR | `BooleanAttributeMetadata` payload missing `TrueOption`/`FalseOption`; both are required by the Dataverse Web API. |
| R21 | regex | ERROR | `Invoke-RestMethod POST` appears after `pac solution import`; managed solution import should precede table/column creation to avoid metadata layering conflicts. |
| R24 | regex | ERROR | `pac solution import` without `--publish-changes`; customizations remain unpublished after import, leaving the deployment half-broken. |
| R25 | regex-template | ERROR | Assignment to a bare script-scope variable matching one of the configured names (default: `headers`, `body`, `conn`, `options`, `response`, `result`); these shadow `$script:` prefixed equivalents. |
| R26 | regex | ERROR | OData query for `FormulaDefinition` on the base `AttributeMetadata` endpoint; a derived type cast is required (e.g., `/Microsoft.Dynamics.CRM.DecimalAttributeMetadata`). |
| R28 | regex-inverse | ERROR | Script lacks an idempotency guard (`if ($null -eq ...)`); Web API POST calls without a guard create duplicate records on every re-run. |
| R29 | regex | ERROR | Non-ASCII character (em-dash, section sign, smart quotes, ellipsis, bullet, en-dash, nbsp) inside a double-quoted string literal; PS 5.1's brace-counter silently misbehaves and produces `MissingEndCurlyBrace` at unrelated lines. Same chars in `#` comments are safe. |
| R31 | regex-template | ERROR | Cmdlet+parameter combination known to fail at runtime. Default list seeded with `Connect-CrmOnlineDiscovery` + `-ShowProgress` (switch absent in `Microsoft.Xrm.Data.PowerShell` v2.8.21). Extend via `node src/rule-manager.js set-variables R31 <new-bad-pattern> ...`. |
| R32 | regex | ERROR | `Connect-PnPOnline -TenantId` usage; `-TenantId` is not a valid parameter on `Connect-PnPOnline` (PnP.PowerShell 3.x). The correct parameter is `-Tenant`. See: https://pnp.github.io/powershell/cmdlets/Connect-PnPOnline.html |
| R33 | regex | ERROR | `Publish-PnPPage` usage; this cmdlet does not exist in PnP.PowerShell 3.x. The replacement is `Set-PnPPage -Identity <name> -Publish`. See: https://pnp.github.io/powershell/cmdlets/Set-PnPPage.html |
| R34 | regex | ERROR | `pac install` usage; `install` is not a recognized pac command group. The closest valid surface is `pac application install --environment-id <id> --application-name <name>`. See: https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/ |
| R35 | regex | ERROR | `[Parser]::ParseFile($p, [ref]$null, [ref]$null)` with both output arguments as `[ref]$null`; silently discards all parsed tokens and all parse errors. See: https://learn.microsoft.com/en-us/dotnet/api/system.management.automation.language.parser.parsefile |
| R36 | regex | ERROR | `[datetime]::TryParse($s, [ref]$null)` 2-argument form with `[ref]$null`; the parsed `DateTime` value is unreachable, and on .NET 7+ the call may resolve to a different overload and fail. See: https://learn.microsoft.com/en-us/dotnet/api/system.datetime.tryparse |
| odata-bind-guid | built-in | ERROR | `@odata.bind` value uses an alternate key (`Name='X'`) instead of a GUID; alternate-key binds are not supported by the Web API. |
| optionset-coverage | built-in | ERROR | A global option set name referenced in a payload is missing from the script's `$optionSets` bootstrap array. |
| system-entity-cascade | built-in | ERROR | Relationship payload targets a system entity (e.g., `systemuser`, `account`) with `Assign` set to a value other than `NoCascade`; cascade on system entities causes data integrity risks. |
| schema-entity-not-found | built-in | ERROR | `ReferencedEntity` or `ReferencingEntity` in a payload does not exist in `rules/schema.json`; fires only when a live schema has been fetched via `update-schema.js`. |
| extractor-json-error | built-in | ERROR | A here-string payload could not be parsed as JSON; commonly caused by unescaped PowerShell variable interpolation inside a double-quoted here-string (`@"..."@`). |
| module-env-mismatch | module-env | ERROR | Script imports a module with known runtime-environment prerequisites without declaring those prerequisites. Seeded entries: `Microsoft.Xrm.Tooling.CrmConnector.PowerShell` and `Microsoft.Xrm.Data.PowerShell` both require `#Requires -PSEdition Desktop`. New entries are added by editing `rules/module-requirements.json`. |

## Failure modes

This section describes, in plain English, the runtime failure each rule catches and the known limitations of the rule's detection.

### R07 — `pac solution import --force-overwrite`

When a managed solution import encounters a conflicting component (for example, a column that exists in the target environment with different metadata), `--force-overwrite` forces the import to proceed by overwriting property-level metadata. It does **not** resolve structural conflicts such as schema-name mismatches or incompatible attribute types. Scripts that rely on `--force-overwrite` as a blanket conflict-resolver may produce a partially imported solution where some components are silently left in a broken state. The safe pattern is to identify and delete conflicting components before import, then import without the flag.

### R12 — `Connect-CrmOnlineDiscovery` / `Microsoft.Xrm.Tooling.CrmConnector.PowerShell`

These modules are built against the .NET Framework and use WinAPI threading primitives that are incompatible with PowerShell Core (pwsh 7). When imported under pwsh, the module either fails to load silently or hangs indefinitely on the connection attempt. The script must carry `#Requires -PSEdition Desktop` and be invoked via `powershell.exe`, not `pwsh.exe`. The `module-env-mismatch` rule provides a complementary check via `module-requirements.json`.

### R13 — `$select`/`$filter`/`$expand` in double-quoted strings

PowerShell variable interpolation treats `$select` inside a double-quoted string as a variable reference (`$select` expands to the value of `$select`, which is typically empty). The OData query is silently corrupted: the `$select=` clause disappears from the URL and the API returns all columns or rejects the request. Use backtick-escaping: `` `$select ``.

### R18 — `BooleanAttributeMetadata` without `TrueOption`/`FalseOption`

The Dataverse Web API requires that a `BooleanAttributeMetadata` POST body include both `TrueOption` and `FalseOption` option definitions. A body omitting these fails at the API with a 400-level error and the column is not created. The error message from the API is not always clear about which field is missing.

### R21 — Topological stage ordering violation

When a script runs `Invoke-RestMethod -Method POST` (creating a table or column) before `pac solution import`, the newly created component is not part of any managed solution layer. If the solution import then brings in a component with the same schema name, Dataverse may reject the import with a metadata conflict, or import the solution on top of an orphaned unmanaged component. Managed solution import must precede component creation in all ALM scripts.

### R24 — `pac solution import` without `--publish-changes`

A `pac solution import` that succeeds at the CLI level does not automatically publish customizations. The solution is imported but any customizations (forms, views, workflows) remain in the draft/unpublished state until a publish operation runs. The deployment appears to succeed but the target environment is not fully operational. Always include `--publish-changes` on the import invocation.

### R25 — Unprefixed assignment shadows `$script:` variable

In PowerShell, a bare `$headers = ...` assignment at script scope is identical to `$script:headers = ...`. If a helper function later does `$headers = ...` as a local variable, it shadows the script-scope variable silently — subsequent code using `$script:headers` gets the wrong value, commonly manifesting as a 401 (auth dict wiped) on subsequent Web API calls. Use unique local names or explicit `$local:` / `$script:` prefixes to avoid the ambiguity.

### R26 — OData type-casting constraint for `FormulaDefinition`

`FormulaDefinition` is a property defined on derived attribute metadata types (e.g., `DecimalAttributeMetadata`, `StringAttributeMetadata`), not on the base `AttributeMetadata` class. Querying it without a type cast in the URL path produces a 400 error from the Dataverse OData endpoint. The URL must include a derived type cast segment before the query string: `.../Attributes(LogicalName='x')/Microsoft.Dynamics.CRM.DecimalAttributeMetadata?$select=FormulaDefinition`.

### R28 — Missing idempotency guard

Web API POST calls to create Dataverse records fail on re-run if the record already exists (duplicate detection or unique constraint violations). A script that runs `Invoke-RestMethod -Method POST` without first checking whether the target entity exists (`if ($null -eq $existing)`) is not safe to re-run. Every ALM script should guard POST calls with an existence check. **Known limitation:** R28 is a `regex-inverse` rule that checks for the presence of `if ($null -eq` anywhere in the script. It does not verify that the guard actually wraps the POST call — a script with a guard that is unrelated to the POST calls would satisfy the rule.

### R29 — Non-ASCII characters in double-quoted string literals

PowerShell 5.1 (Windows PowerShell) has a brace-counting parser defect where multi-byte Unicode characters inside double-quoted string literals corrupt internal state, causing `MissingEndCurlyBrace` parse errors at lines that have nothing wrong with them. Characters such as em-dash (`—`, U+2014), en-dash, smart quotes, ellipsis, section sign, and non-breaking space are common culprits introduced by copy-paste from Word or Confluence. The same characters in `#` comments are safe. Replace with ASCII equivalents (em-dash to `--`, section sign to `S`, smart quotes to straight quotes).

### R31 — Known-bad cmdlet+parameter combination

Some module versions ship cmdlets with a subset of the parameters that appear in documentation or older versions. Using a parameter that does not exist in the deployed module version produces a `NamedParameterNotFound` error at runtime, often with no indication of which module version is loaded. The default entry catches `Connect-CrmOnlineDiscovery -ShowProgress`, which does not exist in `Microsoft.Xrm.Data.PowerShell` v2.8.21. The `variables` list is extensible via `rule-manager.js set-variables R31 ...`.

Source: https://github.com/seanmcne/Microsoft.Xrm.Data.PowerShell/blob/master/Microsoft.Xrm.Data.PowerShell/Microsoft.Xrm.Data.PowerShell.psm1

### R32 — `Connect-PnPOnline -TenantId`

The PnP.PowerShell 3.x `Connect-PnPOnline` cmdlet does not have a `-TenantId` parameter. The documented parameter is `-Tenant`, which accepts a tenant name (e.g., `mycompany.onmicrosoft.com`). Using `-TenantId` produces a PowerShell parameter-binding error at runtime and the connection is not established.

Source: https://pnp.github.io/powershell/cmdlets/Connect-PnPOnline.html

**Known limitations:**

- **Case-sensitivity gap:** The regex is case-sensitive (`gm` flags, no `i`). A script using `connect-pnponline -tenantid` or `CONNECT-PNPONLINE -TENANTID` will not be caught. PowerShell cmdlets are case-insensitive at runtime but the linter regex is not. See `probe-R32-case-insensitive-miss.ps1`.
- **Inline-comment false positive:** The pattern `[^\n]*` spans across inline comments on the same line. A line like `Connect-PnPOnline -Url "..." # -TenantId removed` fires R32 even though the actual code is correct — `-TenantId` appears only in the comment. This false positive is the trade-off accepted in v0.3.x to catch the single-quoted-arg case (see `probe-R32-singlequote-arg.ps1`); the previous `[^'\n]*` pattern excluded single quotes and missed `Connect-PnPOnline -Url 'x' -TenantId 'y'`. See `probe-R32-tenantid-inline-comment.ps1`.
- **Backtick-continuation false negative:** If `-TenantId` appears on the next line after a backtick continuation, the `\n` in the pattern terminates the match before reaching it. R32 will not fire on the continuation form. See `probe-R32-multiline-backtick.ps1`.

### R33 — `Publish-PnPPage` does not exist in PnP.PowerShell 3.x

`Publish-PnPPage` is not present in the modern `PnP.PowerShell` 3.x module (which targets SharePoint Online via modern auth). The legacy `SharePointPnPPowerShellOnline` module (deprecated) had a `Publish-PnPPage` cmdlet, but that module is not compatible with current PowerShell versions or modern authentication. A script using `Publish-PnPPage` against PnP.PowerShell 3.x fails at runtime with a command-not-found error. Use `Set-PnPPage -Identity <name> -Publish` instead.

Source: https://pnp.github.io/powershell/cmdlets/Set-PnPPage.html

**Known limitations:**

- **Inline-comment false positive:** `Publish-PnPPage` appearing in a trailing inline comment after real code fires R33 because `strippedContent` only strips full-line `#` comments, not inline comments. A line like `Set-PnPPage -Identity "x" -Publish  # Previously: Publish-PnPPage -Identity "x"` will fire R33. See `probe-R33-inline-comment-false-positive.ps1`. **Workaround:** move deprecated-call notes to full-line comments.
- **Full-line comment safe:** `Publish-PnPPage` on a full-line `# ...` comment does not fire R33 (stripped before matching). See `probe-R33-in-comment.ps1`.

### R34 — `pac install` is not a valid pac command group

The Power Platform CLI (`pac`) has no top-level `install` command group. The complete list of pac command groups (as of 2026-02-25) does not include `install`. Scripts using `pac install latest` or any other `pac install` subcommand fail at CLI parse time with "unknown command". The correct surface for installing an app to an environment is `pac application install --environment-id <id> --application-name <name>`.

Source: https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/

**Known limitations:**

- **String-literal false positive:** `pac install` inside a string literal (e.g., a `Write-Host` message telling users not to use the command) fires R34 because `strippedContent` does not strip string content. See `probe-R34-install-in-string.ps1`.
- **Full-line comment safe:** `pac install` on a full-line `# ...` comment does not fire R34. See `probe-R34-in-comment.ps1`.
- **`pac application install` is safe:** The word `application` between `pac` and `install` prevents the `\bpac\s+install\b` pattern from matching. See `probe-R34-application-install.ps1`.

### R35 — `[Parser]::ParseFile` with both output arguments as `[ref]$null`

The .NET API `System.Management.Automation.Language.Parser.ParseFile` has the signature `ParseFile(string fileName, out Token[] tokens, out ParseError[] errors)`. Both `tokens` and `errors` are `out` parameters — they carry results out of the method to the caller. Passing `[ref]$null` for both arguments writes the parsed token array and the error array into unreachable null references. The method call "succeeds" (returns an AST) but the caller has no way to inspect either the tokens or any parse errors. This pattern commonly appears as a shortcut to get the AST without caring about tokens/errors, but it silently hides all parse errors that would indicate a malformed script.

Source: https://learn.microsoft.com/en-us/dotnet/api/system.management.automation.language.parser.parsefile

**Known limitations:**

- **Single-null case not flagged:** R35 only fires when BOTH arguments are `[ref]$null`. Discarding only tokens (`[ref]$null` for tokens, real variable for errors) or only errors (real variable for tokens, `[ref]$null` for errors) is not flagged. These are partial captures and are arguably less harmful, but the pattern of discarding errors is still a diagnostic gap. See `probe-R35-one-null-arg.ps1`.
- **`ParseInput` not flagged:** R35 anchors on `ParseFile`. The related `[Parser]::ParseInput` method with both `[ref]$null` args exhibits the same problem but is outside this rule's scope.

### R36 — `[datetime]::TryParse($s, [ref]$null)` overload-resolution hazard

The .NET `DateTime.TryParse` method has multiple overloads. The 2-argument overloads are `(String, out DateTime)` and `(ReadOnlySpan<Char>, out DateTime)`. When called from PowerShell as `[datetime]::TryParse($s, [ref]$null)`, the parsed `DateTime` value is written into an unreachable null reference — the caller gets the boolean return (`$true`/`$false`) but cannot read the parsed date. On .NET 7+ (PowerShell 7.x), the method may resolve to a different overload entirely (there is a `(String, IFormatProvider, DateTimeStyles, out DateTime)` family) and may fail outright. The recommended replacement is `$result = $s -as [datetime]`, which returns `$null` on failure with no exception and no overload ambiguity.

Source: https://learn.microsoft.com/en-us/dotnet/api/system.datetime.tryparse

**Known limitations:**

- **Case-sensitivity gap:** The pattern anchors on `\[datetime\]` (lowercase). PowerShell type accelerators are case-insensitive, so `[DateTime]::TryParse` (capital D) is identical at runtime but is not caught by R36. See `probe-R36-capitalized-type.ps1`.
- **3-argument form not flagged:** `[datetime]::TryParse($s, $provider, [ref]$dt)` with a real bound `$dt` variable is the correct 3-argument form and is not flagged. R36 scope is strictly the 2-argument form where the second arg is `[ref]$null`. See `probe-R36-three-arg-form.ps1`.

### module-env-mismatch — module imported without required runtime directive

Some PowerShell modules are incompatible with PowerShell Core (pwsh 7 / .NET). When imported under the wrong runtime, these modules fail silently — the module appears to load but cmdlets are missing or the process exits without a diagnostic error. The `#Requires -PSEdition Desktop` directive is the only mechanism that fails fast (at parse time, before any code runs) when the script is launched under the wrong runtime.

**Seeded entries (as of v0.3.0):**

- `Microsoft.Xrm.Tooling.CrmConnector.PowerShell` — hangs or fails under pwsh 7.
- `Microsoft.Xrm.Data.PowerShell` — "not compatible yet with PowerShell Core and must use v4 or v5" (verbatim from module README at https://github.com/seanmcne/Microsoft.Xrm.Data.PowerShell). Silently exits at import time under pwsh.

Both require `#Requires -PSEdition Desktop`. Add new entries to `rules/module-requirements.json` without touching source code.

**Import form coverage:** the `import_pattern` for both seeded entries accepts both the positional form (`Import-Module Microsoft.Xrm.Data.PowerShell`) and the explicit-named form (`Import-Module -Name Microsoft.Xrm.Data.PowerShell`), with optional single or double quotes around the module name. New entries should follow the same shape. See `probe-module-env-xrmdata-name-form.ps1`.

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

Fires when the pattern does NOT match — i.e., a required element is absent. Used for mandatory patterns such as idempotency guards (R28). These rules evaluate against `noCommentNoStringContent` (see Content derivations) so that a developer cannot satisfy the rule by hiding the pattern inside a comment or string literal.

Example — R28 fires when `if ($null -eq` is missing from real executable code:

```json
{
  "id": "R28",
  "type": "regex-inverse",
  "pattern": "if\\s*\\(\\$null\\s*-eq",
  "message": "Script lacks standard idempotency guards.",
  "severity": "ERROR",
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

### Module-environment requirements

A distinct rule category driven by `rules/module-requirements.json` rather than `rules/registry.json`. Each entry maps a module name to an import-detection pattern and a list of `#Requires` directives that must appear in the script. If the import pattern matches but none of the required directives are present, the linter fires `module-env-mismatch` at ERROR severity.

Entry shape:

```json
{
  "module": "Microsoft.Xrm.Data.PowerShell",
  "import_pattern": "Import-Module\\s+(?:['\"]?)Microsoft\\.Xrm\\.Data\\.PowerShell(?:['\"]?)",
  "requires_directives": ["#Requires -PSEdition Desktop"],
  "rule_id": "module-env-mismatch",
  "severity": "ERROR",
  "message": "Microsoft.Xrm.Data.PowerShell requires PowerShell Desktop edition..."
}
```

Adding a new module is a config-only edit — no validator code change is needed provided the new entry follows the same `import_pattern` + `requires_directives` shape.

## Content derivations

The validator works against three derived surfaces of the script content, not the raw file. Understanding which surface a rule uses is necessary when writing or debugging rules.

**`strippedContent`** — the raw file with full-line `#` comments removed (lines where the first non-whitespace character is `#`). Default for most `regex` and `regex-template` rules. Inline comments after code are retained; use `noCommentNoStringContent` if inline comment bypass is a concern.

**`normalizedContent`** — `strippedContent` with PowerShell backtick-newline continuations (`` ` `` followed by a newline) collapsed to a single space, making a multi-line command one logical line. Used by R24 and R21 so that a `pac solution import` split across lines with backtick continuation is evaluated as a single statement and `--publish-changes` is not missed.

**`noCommentNoStringContent`** — the most aggressively stripped surface. Removes, in order: here-string bodies, block comments (`<# ... #>`), double-quoted strings, single-quoted strings, and all remaining `#`-to-end-of-line comments. Used exclusively by `regex-inverse` rules (R28) to prevent bypass: a developer cannot satisfy the idempotency guard requirement by placing the pattern inside a comment or a string literal.

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
- **Fail battery** (`battery-fail.ps1`) — a script with known violation types; linter must catch every one and must not fire any unexpected rule IDs.
- **49 adversarial probes** — targeted single-concern fixtures, each declaring which rules must fire, which must not fire, and in some cases exact fire counts. Probes cover: comment-bypass shapes for regex-inverse rules; single-quote here-string parsing; unparseable payloads with variable interpolation; backtick line-continuation handling for R24; semicolon- and pipe-terminated `pac solution import` calls; R25 with both default and non-default variable sets; `system-entity-cascade` on a system entity; non-ASCII chars inside double-quoted strings (R29); non-ASCII chars inside `#` comments (R29 safe-path); known-bad cmdlet+param combination (R31); module import without required directive (`module-env-mismatch`); module import with required directive present (clean path); and the full R32–R36 trigger/clean/edge-case/false-positive/false-negative probe sets.
- **1 unit test** (`test-r25-template.js`) — directly tests the `regex-template` substitution mechanism in `src/validator.js` without going through the full linter pipeline.

The probe set is the regression-test surface. When adding a new rule, ship a corresponding probe that asserts the rule fires on a minimal triggering fixture and does not fire on a clean one. Document any known false-positive or false-negative behavior in the run-battery.js entry comment.

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

Developed by Dan Mobley (djwmobley) with iterative adversarial review by an automated "Judge" agent over six phases. Review record archived externally.
