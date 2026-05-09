# Dataverse Linter

A standalone Node.js static analyzer for PowerShell scripts that call the Dataverse Web API, the `pac solution` CLI, and PnP.PowerShell. It reads a `.ps1` file, extracts JSON payloads from here-strings, and evaluates the script against a registry of rules covering metadata layering, ALM sequencing, Web API correctness, and PowerShell script hygiene.

## Why it exists

PowerShell scripts targeting Dataverse, the `pac` CLI, and PnP are typically authored without runtime feedback at write-time. AI agents emitting code into chat or files are the most acute case — they produce syntactically plausible output with no connection to a live environment — but the same gap applies to one-shot scratch scripts, copy-paste from documentation, and any author who hasn't yet hit a given failure mode. The linter encodes the failure modes you would otherwise only learn by hitting them in production, and applies that catalog at author time.

Three design choices follow from this:

- **Surface coverage.** A script can originate from a file write, from a fenced PowerShell block in an assistant turn, or from PowerShell embedded inline in a Bash invocation. A single-surface gate leaks the other two. The linter enforces at all three surfaces via the same rule set and the same binary.
- **Rule scope.** The catalog spans PowerShell script hygiene, Dataverse Web API correctness, `pac solution` CLI usage, and PnP.PowerShell cmdlet behavior. It is not single-domain.

## Severity policy

Every rule in this linter has severity **ERROR**. The design principle: if a pattern expresses a real failure mode it is an ERROR; if it does not, the rule should not exist. There are no WARN or INFO rules. If a proposed rule cannot be linked to a concrete runtime failure, it is not added.

This severity policy applies uniformly across all three enforcement surfaces described below.

## Enforcement surfaces

The linter enforces rules at three distinct surfaces. All three call the same `node src/index.js` binary; no surface has separate rules.

### 1. PostToolUse — `hooks/posttool-lint.js`

Triggered after every `Write` or `Edit` tool call. Lints the file at `tool_input.file_path` if the extension is `.ps1`. Files inside the linter repo itself are skipped (so probe fixtures are not blocked during linter development).

Payload contract (`PostToolUse`):
```json
{ "tool_name": "Write|Edit", "tool_input": { "file_path": "...", "content|new_string|..." } }
```

Blocking: exit code 2; stderr text is fed back to the assistant as a violation report.

Wire-up in `~/.claude/settings.json`:
```json
"PostToolUse": [{ "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "node C:/gemini/dataverse-linter/hooks/posttool-lint.js" }] }]
```

### 2. Stop — `hooks/stop-lint-chat.js`

Triggered when Claude Code is about to stop (end a turn). Reads the transcript JSONL at `payload.transcript_path`, finds the last assistant turn, regex-extracts every fenced block whose language tag matches (case-insensitive) `powershell`, `pwsh`, `ps1`, or `posh`, writes each block to a temp `.ps1` file, and lints it. The fence regex accepts both column-0 fences and fences that follow inline prose on the same line (e.g., `Run this: ```powershell`). Generic `shell` and no-label fences are intentionally excluded. Non-PS fenced blocks (`bash`, `js`, etc.) and plain prose pass through silently. Temp files are deleted after each lint run.

Payload contract (`Stop`, documented at https://code.claude.com/docs/en/hooks):
```json
{ "hook_event_name": "Stop", "session_id": "...", "transcript_path": "/path/to/session.jsonl", "cwd": "...", "permission_mode": "..." }
```

The assistant's final turn text is not directly in the payload. It is in the JSONL file at `transcript_path`. Each line is a JSON object; the last object with `role: "assistant"` contains the response.

Blocking: exit code 2; stderr text is fed back to the assistant as a violation report. The hook degrades gracefully (exits 0) if the payload is malformed, the transcript file is missing, or no PS fenced blocks are present.

Wire-up in `~/.claude/settings.json`:
```json
"Stop": [{ "hooks": [{ "type": "command", "command": "node C:/gemini/dataverse-linter/hooks/stop-lint-chat.js" }] }]
```

### 3. PreToolUse (Bash) — `hooks/pretool-lint-bash.js`

Triggered before every `Bash` tool call. Inspects `tool_input.command` and extracts inline PowerShell from these forms:
- `pwsh -Command "..."` / `pwsh -c "..."` (double-quoted body)
- `pwsh -Command '...'` / `pwsh -c '...'` (single-quoted body)
- `powershell -Command "..."` / `powershell.exe -Command "..."`
- `pwsh -EncodedCommand <base64>` / `pwsh -enc <base64>` (UTF-16LE per Microsoft contract; round-trip-decoded and linted)
- `pwsh << 'WORD' ... WORD` (heredoc directly to pwsh)
- `<body> WORD | pwsh` (heredoc with pipe on the closing line)
- `cat << 'WORD' | pwsh\n<body>\nWORD` (heredoc with pipe on the opening line)
- `echo "<lit>" | pwsh` / `printf "..." | pwsh` (literal stdin pipe; body lifted)
- `sh -c "$(...)"` / `bash -c "$(...)"` (subshell substitution; recursively scanned, depth cap 3)

Mixed shapes (e.g., `pwsh -File ok.ps1; pwsh -Command "<inline>"`) extract and lint the inline portion. The `-File path.ps1` portion was linted at write time by the PostToolUse hook.

Known limitation -- `cat <file> | pwsh`: the hook cannot read arbitrary files at hook time, so this shape is detected and refused (exit 2) with a stderr message asking the author to inline the body via `pwsh -Command` or write the file via Write/Edit (which routes through the PostToolUse linter gate).

Non-Bash tool calls and Bash commands without inline PS pass through silently.

EncodedCommand decoding contract: per [about_PowerShell_exe](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe), "Accepts a base-64-encoded string version of a command. ... The string must be formatted using UTF-16LE character encoding." The hook decodes via `Buffer.from(b64, 'base64').toString('utf16le')`, which is round-trip-equivalent to PowerShell's `[System.Text.Encoding]::Unicode.GetBytes()` encoder. Malformed b64 is detect-and-block.

Payload contract (`PreToolUse`, documented at https://code.claude.com/docs/en/hooks):
```json
{ "hook_event_name": "PreToolUse", "tool_name": "Bash", "tool_input": { "command": "pwsh -Command \"...\"", "description": "...", "timeout": 120000 }, "tool_use_id": "..." }
```

Blocking: exit code 2; stderr text is fed back to the assistant as a block reason.

Wire-up in `~/.claude/settings.json`:
```json
"PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "node C:/gemini/dataverse-linter/hooks/pretool-lint-bash.js" }] }]
```

## Status

The substrate is approved for internal pilot use; it has not yet been validated by an org-wide pilot. Rule IDs, content views, and CLI surface are considered stable for pilot purposes but should be treated as pre-1.0 until pilot findings are incorporated.

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
| R12 | regex (conjunction) | ERROR | `Connect-CrmOnlineDiscovery` or `Microsoft.Xrm.Tooling.CrmConnector.PowerShell` import without a `#Requires -Version 5.1` or `#Requires -PSEdition Desktop` guard; these modules hang under pwsh — script must run under `powershell.exe` 5.1. v0.3.1 made the rule conjunction-aware via `requires_absent`. v0.4.1 fixed a false negative where a `#Requires` lexeme nested inside a `<# ... #>` block comment was incorrectly accepted as a guard (PS does not honor it at parse time); the guard view is now `rawContentNoBlockComments`. |
| R13 | regex | ERROR | `$select`, `$filter`, or `$expand` inside a double-quoted string without a backtick escape; PowerShell interpolates these, corrupting the OData query. |
| R18 | regex | ERROR | `BooleanAttributeMetadata` payload missing `TrueOption`/`FalseOption`; both are required by the Dataverse Web API. |
| R21 | regex | ERROR | `Invoke-RestMethod POST` appears after `pac solution import`; managed solution import should precede table/column creation to avoid metadata layering conflicts. |
| R24 | regex | ERROR | `pac solution import` without `--publish-changes`; customizations remain unpublished after import, leaving the deployment half-broken. |
| R25 | regex-template (script-scope only) | ERROR | Assignment to a bare script-scope variable matching one of the configured names (default: `headers`, `body`, `conn`, `options`, `response`, `result`); these shadow `$script:` prefixed equivalents. v0.3.1 made the rule scope-aware via `scope: "script-only"`: matches inside a `function NAME { ... }` body are suppressed because PowerShell function bodies have their own variable scope and cannot shadow `$script:`. |
| R26 | regex | ERROR | OData query for `FormulaDefinition` on the base `AttributeMetadata` endpoint; a derived type cast is required (e.g., `/Microsoft.Dynamics.CRM.DecimalAttributeMetadata`). |
| R28 | regex-inverse (conjunction) | ERROR | Script lacks an idempotency guard (`if ($null -eq ...)`); Web API POST calls without a guard create duplicate records on every re-run. v0.4.2 made the rule conjunction-aware via `requires_present`: it applies only when the file actually contains a Dataverse Web API mutation call (`Invoke-RestMethod`/`Invoke-WebRequest` with `-Method POST`/`PATCH`/`PUT`). Minimal snippets without a mutation no longer false-positive. |
| R29 | regex | ERROR | Non-ASCII character (em-dash, section sign, smart quotes, ellipsis, bullet, en-dash, nbsp) inside a double-quoted string literal; PS 5.1's brace-counter silently misbehaves and produces `MissingEndCurlyBrace` at unrelated lines. Same chars in `#` comments are safe. |
| R31 | regex-template | ERROR | Cmdlet+parameter combination known to fail at runtime. Default list seeded with `Connect-CrmOnlineDiscovery` + `-ShowProgress` (switch absent in `Microsoft.Xrm.Data.PowerShell` v2.8.21). Extend via `node src/rule-manager.js set-variables R31 <new-bad-pattern> ...`. |
| R32 | regex | ERROR | `Connect-PnPOnline -TenantId` usage; `-TenantId` is not a valid parameter on `Connect-PnPOnline` (PnP.PowerShell 3.x). The correct parameter is `-Tenant`. See: https://pnp.github.io/powershell/cmdlets/Connect-PnPOnline.html |
| R33 | regex | ERROR | `Publish-PnPPage` usage; this cmdlet does not exist in PnP.PowerShell 3.x. The replacement is `Set-PnPPage -Identity <name> -Publish`. See: https://pnp.github.io/powershell/cmdlets/Set-PnPPage.html |
| R34 | regex | ERROR | `pac install` usage; `install` is not a recognized pac command group. The closest valid surface is `pac application install --environment-id <id> --application-name <name>`. See: https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/ |
| R35 | regex | ERROR | `[Parser]::ParseFile($p, [ref]$null, [ref]$null)` with both output arguments as `[ref]$null`; silently discards all parsed tokens and all parse errors. See: https://learn.microsoft.com/en-us/dotnet/api/system.management.automation.language.parser.parsefile |
| R36 | regex | ERROR | `[datetime]::TryParse($s, [ref]$null)` 2-argument form with `[ref]$null`; the parsed `DateTime` value is unreachable, and on .NET 7+ the call may resolve to a different overload and fail. See: https://learn.microsoft.com/en-us/dotnet/api/system.datetime.tryparse |
| R38 | regex (conjunction) | ERROR | Manual `[switch]$WhatIf` parameter without `[CmdletBinding(SupportsShouldProcess=$true)]`. A manual switch does not wire `$WhatIfPreference`, `-Confirm`, or `$PSCmdlet.ShouldProcess()` -- side-effects fire regardless of WhatIf intent. See: https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-shouldprocess |
| odata-bind-guid | built-in | ERROR | `@odata.bind` value uses an alternate key (`Name='X'`) instead of a GUID; alternate-key binds are not supported by the Web API. |
| optionset-coverage | built-in | ERROR | A global option set name referenced in a payload is missing from the script's `$optionSets` bootstrap array. |
| system-entity-cascade | built-in | ERROR | Relationship payload targets a system entity (e.g., `systemuser`, `account`) with `Assign` set to a value other than `NoCascade`; cascade on system entities causes data integrity risks. |
| schema-entity-not-found | built-in | ERROR | `ReferencedEntity` or `ReferencingEntity` in a payload does not exist in `rules/schema.json`; fires only when a live schema has been fetched via `update-schema.js`. |
| extractor-json-error | built-in | ERROR | A here-string payload could not be parsed as JSON; commonly caused by unescaped PowerShell variable interpolation inside a double-quoted here-string (`@"..."@`). |
| module-env-mismatch | module-env | ERROR | Script imports a module with known runtime-environment prerequisites without declaring those prerequisites. Seeded entries: `Microsoft.Xrm.Tooling.CrmConnector.PowerShell` and `Microsoft.Xrm.Data.PowerShell` both require `#Requires -PSEdition Desktop`. v0.4.2 fixed a false negative where a `#Requires` lexeme nested inside a `<# ... #>` block comment satisfied the directive presence check (it was tested against `rawContent`); the check now uses `rawContentNoBlockComments`, mirroring the v0.4.1 R12 fix on the `requires_absent` path. New entries are added by editing `rules/module-requirements.json`. |

## Failure modes

This section describes, in plain English, the runtime failure each rule catches and the known limitations of the rule's detection.

### R07 — `pac solution import --force-overwrite`

When a managed solution import encounters a conflicting component (for example, a column that exists in the target environment with different metadata), `--force-overwrite` forces the import to proceed by overwriting property-level metadata. It does **not** resolve structural conflicts such as schema-name mismatches or incompatible attribute types. Scripts that rely on `--force-overwrite` as a blanket conflict-resolver may produce a partially imported solution where some components are silently left in a broken state. The safe pattern is to identify and delete conflicting components before import, then import without the flag.

### R12 — `Connect-CrmOnlineDiscovery` / `Microsoft.Xrm.Tooling.CrmConnector.PowerShell`

These modules are built against the .NET Framework and use WinAPI threading primitives that are incompatible with PowerShell Core (pwsh 7). When imported under pwsh, the module either fails to load silently or hangs indefinitely on the connection attempt. The script must carry a guard directive (either `#Requires -Version 5.1` or `#Requires -PSEdition Desktop`) and be invoked via `powershell.exe`, not `pwsh.exe`. The `module-env-mismatch` rule provides a complementary check via `module-requirements.json` (which specifically requires `#Requires -PSEdition Desktop`; -Version 5.1 is accepted by R12 but not by `module-env-mismatch`).

**v0.3.1 — conjunction-aware:** R12 uses the `requires_absent` rule field. The rule fires only when the main pattern matches AND the guard view does NOT match `^#Requires\s+(?:-Version\s+5\.1\b|-PSEdition\s+Desktop\b)`. Either guard is accepted as satisfying the rule. The previous behavior (fire on every cmdlet occurrence regardless of context) caused the linter to fire on legitimate, correct PowerShell that already had the guard in place — including hits on the cmdlet name appearing in comments and string literals. With the conjunction in place, R12 now matches the message's stated intent: "Ensure script has #Requires ... and runs under powershell.exe."

**v0.4.1 — block-comment guard fix:** The guard view changed from `rawContent` to `rawContentNoBlockComments`. The fix addresses a false negative: a `#Requires -Version 5.1` lexeme nested inside a `<# ... #>` block comment satisfied the guard regex when tested against `rawContent`, but PowerShell does not honor `#Requires` inside block comments at parse time, so the script would still hang on `Connect-CrmOnlineDiscovery` under pwsh — exactly the failure R12 is designed to catch. The fix introduces `stripBlockComments()` in `extractor.js`, which length-preservingly space-fills every `<# ... #>` range. The guard regex now tests against this view, so block-comment-nested `#Requires` lexemes are correctly NOT recognized as guards while line-comment `#Requires` directives (the form PS actually honors) ARE recognized.

The v0.4.1 fix also adds a `\b` word boundary after `5\.1` in the guard regex (`-Version 5\.1\b`), preventing a hypothetical `#Requires -Version 5.10` from satisfying the prefix.

Substrate citations:

- PowerShell Gallery package metadata: https://www.powershellgallery.com/packages/Microsoft.Xrm.Tooling.CrmConnector.PowerShell — declares minimum PowerShell version 5.1 and PSEdition Desktop.
- MS Learn (Use PowerShell cmdlets for XRM tooling): https://learn.microsoft.com/en-us/power-apps/developer/data-platform/xrm-tooling/use-powershell-cmdlets-xrm-tooling-connect — describes the cmdlets as "Windows PowerShell" cmdlets (Desktop edition).
- About #Requires: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_requires — describes the -Version and -PSEdition forms; "Each `#Requires` statement must be the first item on a line".
- About comments: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_comments — "you can't nest block comments. If you attempt to nest block comments, the outer block comment ends at the first `#>` encountered." Justifies non-greedy `<#[\s\S]*?#>` matching in `stripBlockComments()`.

**Probes:**

- `probe-R12-cmdlet-no-guard.ps1` (v0.3.1) — true positive: cmdlet present, no guard. R12 fires.
- `probe-R12-cmdlet-with-guard.ps1` (v0.3.1) — true negative: cmdlet present, `#Requires -Version 5.1` present. R12 suppressed. (`module-env-mismatch` fires independently because its required directive is the stricter `-PSEdition Desktop`.)
- `probe-R12-cmdlet-with-desktop-guard.ps1` (v0.3.1) — true negative: cmdlet present, `#Requires -PSEdition Desktop` present. R12 suppressed. Probe is fully clean.
- `probe-R12-no-cmdlet-no-guard.ps1` (v0.3.1) — negative control: neither pattern matches. R12 does not fire.
- `probe-R12-cmdlet-in-string-with-guard.ps1` (v0.3.1) — true negative: cmdlet name appears only in a string literal AND the guard is present. R12 suppressed (guard is dispositive). Documents that string-literal cmdlet mentions are benign once the guard is in place.
- `probe-R12-block-comment-requires.ps1` (v0.4.1) — true positive: `<# #Requires -Version 5.1 #>` followed by `Connect-CrmOnlineDiscovery`. The block-comment-nested directive is not honored by PS, so R12 fires. Pins the v0.4.1 block-comment guard fix.
- `probe-R12-block-comment-requires-line-form.ps1` (v0.4.1) — true positive: block-comment-nested directive with structure (`<#` and `#>` on their own lines, `#Requires -Version 5.1` at column 0 on a middle line). R12 fires.
- `probe-R12-line-comment-requires-still-works.ps1` (v0.4.1) — regression anchor: canonical line-comment `#Requires -Version 5.1` (NOT inside `<# #>`). R12 does NOT fire — pins line-comment guard recognition so future widening of `stripBlockComments` cannot regress it.
- `probe-R12-mixed-block-and-line.ps1` (v0.4.1) — true negative: a benign `<# block comment without requires #>` AND a real `#Requires -Version 5.1` line. Asserts that block-comment stripping is range-bounded and does not damage line-comment guard recognition. R12 does NOT fire.

**Behavior summary:**

- Line-comment `#Requires` directives (e.g., `#Requires -Version 5.1` at column 0 on its own line, the form PS honors at parse time) ARE recognized as guards and suppress R12.
- Block-comment-nested `#Requires` directives (e.g., `<# #Requires -Version 5.1 #>` or a multi-line `<# ... #Requires -Version 5.1 ... #>`) are correctly NOT recognized as guards (per PS parser behavior — they are comment content, not directives) and do NOT suppress R12.
- A `#Requires -Version 7.0` or other non-Desktop version directive does NOT satisfy the guard; only `-Version 5.1` or `-PSEdition Desktop` are accepted. This is correct: the rule's purpose is to ensure the script cannot be launched under pwsh 7 against the legacy module.

**Known limitations:**

- The guard is checked via a single-line regex anchor (`^#Requires ...` with `m` flag) — only `#Requires` lines that begin at the start of a line are recognized. A `#Requires` directive that follows code on the same line (which is non-standard PowerShell and would not work as a parse-time gate anyway) is not recognized.

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

**v0.3.1 — scope-aware:** R25 now uses the `scope: "script-only"` rule field. Matches whose match index lies inside a `function NAME { ... }` declaration body are suppressed. PowerShell function bodies have their own variable scope; an assignment of the form `$body = ...` inside a function is function-local and CANNOT shadow `$script:body` (which is what R25 is designed to catch). The previous behavior fired on legitimate function-local assignments, forcing authors to either rename variables (acceptable) or pollute the watch-list with apologetic comments. Scope-awareness restores the rule to its stated intent: "Unprefixed assignment **at script scope** shadows `$script:`."

Implementation: `extractor.computeFunctionBodyRanges(rawContent)` walks the file with a string-/comment-aware scanner, finds each `function` keyword at a statement-start position, then traces the matching open/close brace to record `[openBraceIdx, closeBraceIdx]`. The validator skips matches whose `match.index` falls strictly inside any recorded range. Range computation uses `rawContent` because `strippedContent` blanks `#>` block-comment terminators; using rawContent keeps block comments balanced. The v0.3.1 length-preserving `stripComments` change (replace matched chars with spaces, preserving newlines) ensures `match.index` in `strippedContent` aligns with rawContent indices.

**Probes (v0.3.1):**

- `probe-R25-script-scope-body.ps1` — true positive: `$body = @{...}` at script scope (inside an `if` block — `if` is not a function declaration). R25 fires once.
- `probe-R25-function-local-body.ps1` — true negative (regression anchor for the v0.3.1 fix): `$body = @{...}` inside `function Create-LookupFromRow { ... }`. R25 does not fire. This anchors the false positive that caused `wire_cross_module_connections.ps1` v0.2 line 167 to be linted as a violation under v0.3.0.
- `probe-R25-watch-name-prefixed.ps1` — true negative: `$script:body = ...` at script scope. The leading `$script:` makes the leading regex `^\s*\$(headers|body|...)\s*=` not match, so R25 does not fire.
- `probe-R25-non-watch-name.ps1` — true negative: `$widget = ...` at script scope. The variable name is not in the watch-list; R25 does not fire.

**Known limitations:**

- **Anonymous scriptblocks not tracked.** A construct like `$sb = { $body = "x" }` (anonymous scriptblock literal at script scope) IS a function-local scope at runtime, but the v0.3.1 scanner only tracks `function NAME { ... }` declarations, not anonymous `{ ... }` scriptblocks. R25 will fire on `$body` inside an anonymous scriptblock at script scope, even though the runtime behavior is identical to a function. This is an accepted limitation; if it becomes a real false-positive source, a future rev can extend `computeFunctionBodyRanges` to track scriptblock literals (the heuristic is harder because `{ ... }` appears in many non-scriptblock contexts: hashtables, if-blocks, foreach-blocks, etc.).
- **`filter` declarations not tracked.** `filter Foo { ... }` is treated like a function at runtime but the v0.3.1 scanner anchors on the `function` keyword. PowerShell `filter` is rare; not worth a separate scanner pass yet.
- **Nested functions covered by inclusion.** A function declared inside another function's body has its own range, but the outer range already covers it; either range matching suppresses the rule, so behavior is correct (function-local at any nesting level is suppressed).
- **Statement-start heuristic.** The scanner requires the `function` keyword to appear after start-of-file, `\n`, `;`, `{`, `}`, or `\r` (with optional intervening whitespace). A `function` keyword that follows a non-statement-start char is treated as an identifier and not as a declaration. This is correct PowerShell parsing for the cases the scanner targets but is not a full PS-AST parse.

### R26 — OData type-casting constraint for `FormulaDefinition`

`FormulaDefinition` is a property defined on derived attribute metadata types (e.g., `DecimalAttributeMetadata`, `StringAttributeMetadata`), not on the base `AttributeMetadata` class. Querying it without a type cast in the URL path produces a 400 error from the Dataverse OData endpoint. The URL must include a derived type cast segment before the query string: `.../Attributes(LogicalName='x')/Microsoft.Dynamics.CRM.DecimalAttributeMetadata?$select=FormulaDefinition`.

### R28 — Missing idempotency guard

Web API POST calls to create Dataverse records fail on re-run if the record already exists (duplicate detection or unique constraint violations). A script that runs `Invoke-RestMethod -Method POST` without first checking whether the target entity exists (`if ($null -eq $existing)`) is not safe to re-run. Every ALM script should guard POST calls with an existence check. **Known limitation:** R28 is a `regex-inverse` rule that checks for the presence of `if ($null -eq` anywhere in the script. It does not verify that the guard actually wraps the POST call — a script with a guard that is unrelated to the POST calls would satisfy the rule.

**v0.4.2 — conjunction-aware via `requires_present`:** R28 now applies only when the file actually contains a Dataverse Web API mutation call. The `requires_present` regex matches `Invoke-RestMethod` or `Invoke-WebRequest` with `-Method` set to one of `POST`, `PATCH`, or `PUT` (case variants of each). If no mutation call is present, R28 is skipped entirely — the rule does not apply.

This closed a known limitation from v0.4.0: minimal snippets such as `pwsh -Command "Get-Date"` or any script that does not call the Web API at all tripped R28 because the inverse pattern was absent file-wide. With the conjunction in place, R28 fires only when the rule's stated intent applies — a real mutation call exists and is unguarded.

The `requires_present` check uses `normalizedContent` (line-comment-stripped, backtick-continuation-collapsed) so that a mutation call with a quoted method literal (`-Method "POST"`) is correctly recognized. `noCommentNoStringContent` strips string contents, turning `-Method "POST"` into `-Method ""` and silently failing the method alternation. A mutation-shaped string inside a line comment is excluded from `normalizedContent` because line comments are stripped via `strippedContent`. Block comments are not stripped from this view; if a future use case demands block-comment exclusion for `requires_present`, switch to a normalized-`rawContentNoBlockComments` hybrid then.

**Substrate citations for the mutation-method list:**

- Create (POST): https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/create-entity-web-api — "Send a `POST` request to the Web API entityset resource to create a table row (entity record) in Microsoft Dataverse."
- Update (PATCH): https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/update-delete-entities-using-web-api — "Update operations use the HTTP `PATCH` verb. Pass a JSON object containing the properties you want to update to the URI that represents the record."
- Single-property update (PUT): same page — "To update a single property value, use a `PUT` request and add the property name to the entity's Uri."
- Upsert (PATCH): same page — "It uses a `PATCH` request and uses a URI to reference a specific record."

DELETE is intentionally excluded from `requires_present`: HTTP DELETE is idempotent by spec, so a re-run does not create duplicates (the second call simply returns 404). The idempotency-guard rule's stated intent is to prevent duplicate-create on re-run, which DELETE cannot cause.

**Known limitation:**

- **Case-sensitivity:** The `requires_present` regex is case-sensitive (`m` flag, no `i`) and enumerates three case forms per method (`POST|Post|post`, etc.). A fully mixed-case form like `-Method pOsT` is NOT covered; PowerShell accepts it at runtime but R28's precondition does not match, so R28 is skipped. This is the deliberate design (the case enumeration is explicit); see `probe-R28-mixedcase-method-no-fire.ps1`. A future widening to `(?i:POST|PATCH|PUT)` would broaden the conjunction.

**Probes (v0.4.2):**

- `probe-R28-no-mutation-no-guard.ps1` — single-line `Get-Date` snippet with neither mutation nor guard. R28 does NOT fire (regression anchor for the v0.4.0 known limitation).
- `probe-R28-post-no-guard.ps1` — POST mutation present, no guard. R28 fires (canonical R28 case).
- `probe-R28-post-with-guard.ps1` — POST mutation present, guard present. R28 does NOT fire (true negative anchor for legitimate guarded code).
- `probe-R28-get-only-no-guard.ps1` — `-Method Get` only, no guard. R28 does NOT fire (read-only path; GET is not a mutation per substrate).
- `probe-R28-patch-no-guard.ps1` — PATCH mutation present, no guard. R28 fires (extends conjunction coverage beyond POST).
- `probe-R28-put-no-guard.ps1` — PUT mutation present, no guard. R28 fires (pins PUT as the third member of the mutation set).
- `probe-R28-delete-no-guard.ps1` — DELETE call present, no guard. R28 does NOT fire (intentional-exclusion pin: HTTP DELETE is idempotent by spec, RFC 9110 S9.3.5; a re-run cannot create duplicates).
- `probe-R28-mixedcase-method-no-fire.ps1` — `-Method pOsT` (fully mixed case). R28 does NOT fire (case-sensitivity boundary anchor; pins deliberate design of explicit case enumeration).
- `probe-R28-post-quoted-method-no-guard.ps1` — POST mutation with quoted method literal (`-Method "POST"`), no guard. R28 fires. Pins the v0.4.2 `requires_present` / `normalizedContent` fix.

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

### R38 -- Manual `[switch]$WhatIf` parameter (manual WhatIf antipattern)

R38 fires when a `param(...)` block declares `[switch]$WhatIf` without `[CmdletBinding(SupportsShouldProcess=$true)]` on the enclosing script or function. A manual `[switch]$WhatIf` bypasses PowerShell's CommonParameter injection: it does not set `$WhatIfPreference` for called cmdlets, does not wire `-Confirm`, and does not force destructive code through `$PSCmdlet.ShouldProcess()` -- leaving prologue `throw` statements and other side-effects free to fire regardless of WhatIf intent. The canonical fix is to add `[CmdletBinding(SupportsShouldProcess=$true)]`, remove the manual switch, and gate all writes through `$PSCmdlet.ShouldProcess($target, $operation)`. Authority: https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-shouldprocess and https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_functions_cmdletbindingattribute.

**Detection strategy:** Two-step conjunction using `requires_absent`. The main pattern `\[switch\]\s*\$WhatIf\b` fires on `strippedContent`. The `requires_absent` guard `SupportsShouldProcess\s*(?:=\s*\$true|\s*[,\)]|\s*$)` tests `rawContentNoBlockComments`: if `SupportsShouldProcess` is present with a non-false value (bare name, `=$true`, or followed by `,` or `)`), the guard is satisfied and the rule is suppressed. If `SupportsShouldProcess=$false` is present or `SupportsShouldProcess` is absent entirely, the guard is not satisfied and R38 fires.

**Acceptable forms (rule suppressed):**

- `[CmdletBinding(SupportsShouldProcess=$true)]` -- canonical
- `[CmdletBinding(SupportsShouldProcess)]` -- bare-name shorthand (PS treats as `=$true`)
- `[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact='High')]` -- with whitespace and additional args

**Antipattern forms (rule fires):**

- `param([switch]$WhatIf)` with no `CmdletBinding`
- `[CmdletBinding()]` + `param([switch]$WhatIf)` -- `CmdletBinding` without `SupportsShouldProcess`
- `[CmdletBinding(SupportsShouldProcess=$false)]` + `param([switch]$WhatIf)` -- explicit opt-out plus manual switch

**Probes:**

- `probe-R38-no-cmdletbinding.ps1` -- FIRE: no `CmdletBinding` at all
- `probe-R38-function-no-cmdletbinding.ps1` -- FIRE: function body with manual `[switch]$WhatIf`, no `CmdletBinding`
- `probe-R38-param-decorator-no-suppress.ps1` -- FIRE: `[Parameter()]` decorator does not suppress the rule
- `probe-R38-canonical-supportsshould.ps1` -- NO FIRE: `[CmdletBinding(SupportsShouldProcess=$true)]` present
- `probe-R38-no-whatif-param.ps1` -- NO FIRE: no `$WhatIf` parameter in script
- `probe-R38-cmdletbinding-no-supportsshould.ps1` -- FIRE: `[CmdletBinding()]` without `SupportsShouldProcess`
- `probe-R38-bool-whatif-no-fire.ps1` -- NO FIRE: `[bool]$WhatIf` is a different type; rule anchors on `[switch]`
- `probe-R38-supportsshould-false.ps1` -- FIRE: `SupportsShouldProcess=$false` does not satisfy the guard

**Substrate citations:**

- everything-about-shouldprocess: https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-shouldprocess
- about_Functions_CmdletBindingAttribute: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_functions_cmdletbindingattribute
- about_Functions_Advanced_Methods: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_functions_advanced_methods

### module-env-mismatch — module imported without required runtime directive

Some PowerShell modules are incompatible with PowerShell Core (pwsh 7 / .NET). When imported under the wrong runtime, these modules fail silently — the module appears to load but cmdlets are missing or the process exits without a diagnostic error. The `#Requires -PSEdition Desktop` directive is the only mechanism that fails fast (at parse time, before any code runs) when the script is launched under the wrong runtime.

**Seeded entries (as of v0.3.0):**

- `Microsoft.Xrm.Tooling.CrmConnector.PowerShell` — hangs or fails under pwsh 7.
- `Microsoft.Xrm.Data.PowerShell` — "not compatible yet with PowerShell Core and must use v4 or v5" (verbatim from module README at https://github.com/seanmcne/Microsoft.Xrm.Data.PowerShell). Silently exits at import time under pwsh.

Both require `#Requires -PSEdition Desktop`. Add new entries to `rules/module-requirements.json` without touching source code.

**Import form coverage:** the `import_pattern` for both seeded entries accepts both the positional form (`Import-Module Microsoft.Xrm.Data.PowerShell`) and the explicit-named form (`Import-Module -Name Microsoft.Xrm.Data.PowerShell`), with optional single or double quotes around the module name. New entries should follow the same shape. See `probe-module-env-xrmdata-name-form.ps1`.

**v0.4.2 — block-comment guard fix:** The directive presence check changed from `rawContent` to `rawContentNoBlockComments`. A false negative analogous to the v0.4.1 R12 fix existed on a different rule path: a `#Requires -PSEdition Desktop` directive nested inside a `<# ... #>` block comment satisfied the rawContent regex, but PowerShell does not honor `#Requires` lexemes inside block comments at parse time — the script can still be launched under the wrong runtime and the import will silently fail or hang. The fix structurally mirrors the v0.4.1 R12 fix: both code paths now test the directive guard against `rawContentNoBlockComments` (the block-comment-stripped view produced by `extractor.stripBlockComments()`). Line-comment `#Requires -PSEdition Desktop` directives (the form PS honors at parse time) remain visible.

**Probes (v0.4.2):**

- `probe-module-env-block-comment-requires.ps1` — `<# #Requires -PSEdition Desktop #>` followed by `Import-Module Microsoft.Xrm.Tooling.CrmConnector.PowerShell`. The block-comment-internal directive is not honored by PS, so module-env-mismatch fires. Pins the v0.4.2 block-comment guard fix.
- `probe-module-env-line-comment-still-works.ps1` — canonical line-comment `#Requires -PSEdition Desktop` at column 0. PS honors this; module-env-mismatch does NOT fire. Regression anchor that pins line-comment directive recognition so future widening of `stripBlockComments` cannot regress it.

**Substrate citations:**

- about_Comments: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_comments — "All text within the block is treated as part of the same comment, including whitespace."
- about_Requires: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_requires — "Each `#Requires` statement must be the first item on a line."

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

Fires when the pattern does NOT match — i.e., a required element is absent. Used for mandatory patterns such as idempotency guards (R28). These rules evaluate against `noCommentNoStringContent` (see Validator content views) so that a developer cannot satisfy the rule by hiding the pattern inside a comment or string literal.

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

### Optional rule fields (regex / regex-template / regex-inverse)

The following optional fields refine when a rule applies. All three rule types accept these unless noted otherwise.

#### `requires_absent` — conjunction guard (v0.3.1; v0.4.1 view fix)

A regex pattern. If set, the rule fires only when the main `pattern` matches AND the `requires_absent` regex does NOT match the guard view. Used to express "this is a violation UNLESS a guard directive is present" — for example, R12 fires on `Connect-CrmOnlineDiscovery` only when neither `#Requires -Version 5.1` nor `#Requires -PSEdition Desktop` is in the file.

The guard view is `rawContentNoBlockComments` — `rawContent` with every `<# ... #>` block-comment range length-preservingly space-filled (newlines preserved). The match uses the `m` flag (multiline anchors). Rationale (v0.4.1):

- Line-comment `#Requires` directives (the form PS honors at parse time) remain visible to the guard regex because `stripBlockComments` only blanks block-comment ranges, not line-comment text.
- Block-comment-nested `#Requires` lexemes are NOT visible in this view, matching PowerShell parser behavior: text inside `<# ... #>` is comment content (per [about_Comments](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_comments): "All text within the block is treated as part of the same comment, including whitespace"), and a `#Requires` directive must be "the first item on a line" (per [about_Requires](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_requires)) — which a comment-internal lexeme is not.
- Previously (v0.3.1) the test ran against `rawContent`, which matched a block-comment-nested directive and suppressed the rule even though PS would not honor the directive at runtime. v0.4.1 closes this gap by testing the guard against `rawContentNoBlockComments`.

Block comments do not nest in PowerShell (per about_Comments: "you can't nest block comments. If you attempt to nest block comments, the outer block comment ends at the first `#>` encountered."), so the non-greedy `<#[\s\S]*?#>` regex inside `stripBlockComments` is correct.

```json
{
  "id": "R12",
  "type": "regex",
  "pattern": "Connect-CrmOnlineDiscovery|Import-Module\\s+Microsoft\\.Xrm\\.Tooling\\.CrmConnector\\.PowerShell",
  "requires_absent": "^#Requires\\s+(?:-Version\\s+5\\.1|-PSEdition\\s+Desktop)",
  "message": "These modules hang in pwsh. Ensure script has #Requires -Version 5.1 or #Requires -PSEdition Desktop ...",
  "severity": "ERROR",
  "enabled": true
}
```

#### `requires_present` — conjunction precondition (v0.4.2)

Mirror of `requires_absent` but inverted semantically. A regex pattern. If set, the rule applies only when the `requires_present` regex DOES match the **`normalizedContent`** view. If it does not match, the rule is skipped entirely — no fire, regardless of any other condition.

Used to express "this rule applies only when the file actually does the thing being guarded." For `regex-inverse` rules in particular, this closes the false-positive shape where a rule fires on any file that lacks the inverse pattern — even files that have nothing for the rule to guard.

The check uses `normalizedContent` (`strippedContent` with backtick line continuations collapsed). This view is used — rather than `targetContent` — because `requires_present` is intent detection, not bypass prevention. `noCommentNoStringContent` (the `targetContent` view for `regex-inverse` rules) strips string contents, turning `-Method "POST"` into `-Method ""` and causing the method alternation to silently fail, which would skip R28 on the idiomatic ALM-script form with a quoted method literal. `normalizedContent` strips only line comments and collapses backtick continuations; a mutation call with a quoted method such as `-Method "POST"` or `-Method 'PATCH'` is therefore correctly recognized. A mutation-shaped string inside a line comment is excluded because line comments are stripped via `strippedContent`. Block comments are not stripped from this view; if a future use case demands block-comment exclusion for `requires_present`, switch to a normalized-`rawContentNoBlockComments` hybrid then.

R28 is the seeded use case: the rule applies only when the file contains a Dataverse Web API mutation call (`Invoke-RestMethod` or `Invoke-WebRequest` with `-Method POST`/`PATCH`/`PUT`). A `pwsh -Command "Get-Date"` snippet no longer false-positives.

```json
{
  "id": "R28",
  "type": "regex-inverse",
  "pattern": "if\\s*\\(\\$null\\s*-eq",
  "requires_present": "(?:Invoke-RestMethod|Invoke-WebRequest)[^\\n]*-Method\\s+[\"']?(?:POST|Post|post|PATCH|Patch|patch|PUT|Put|put)[\"']?",
  "message": "Script lacks standard idempotency guards (e.g., if ($null -eq $existing)). Ensure Web API POSTs are guarded.",
  "severity": "ERROR",
  "enabled": true
}
```

#### `scope: "script-only"` — function-body suppression

When set on a `regex` or `regex-template` rule, matches whose start index falls strictly inside any `function NAME { ... }` declaration body are suppressed. Used by R25 to enforce that "unprefixed assignment shadows script scope" applies only to script-scope assignments — function-local assignments cannot shadow `$script:` and should not fire the rule.

```json
{
  "id": "R25",
  "type": "regex-template",
  "pattern": "^\\s*\\$(${variables})\\s*=",
  "variables": ["headers", "body", "conn", "options", "response", "result"],
  "scope": "script-only",
  "message": "Unprefixed assignment at script scope shadows $script:.",
  "severity": "ERROR",
  "enabled": true
}
```

Function-body ranges are computed once per file in the extractor (`computeFunctionBodyRanges`). The scanner is string-/comment-aware: it skips `<# ... #>` block comments, `# ...` line comments, single-/double-quoted strings, and here-strings (`@"..."@` and `@'...'@`) so that a `function` keyword inside a string literal or a comment is not mistaken for a declaration. Limitations: anonymous scriptblocks (`$sb = { ... }`) and `filter` declarations are not tracked; see the R25 failure_modes section for details.

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

## Validator content views

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
- **84 adversarial probes** (see `tests/run-battery.js` for the authoritative count and registry) — targeted single-concern fixtures, each declaring which rules must fire, which must not fire, and in some cases exact fire counts. Probes cover: comment-bypass shapes for regex-inverse rules; single-quote here-string parsing; unparseable payloads with variable interpolation; backtick line-continuation handling for R24; semicolon- and pipe-terminated `pac solution import` calls; R25 with both default and non-default variable sets; `system-entity-cascade` on a system entity; non-ASCII chars inside double-quoted strings (R29); non-ASCII chars inside `#` comments (R29 safe-path); known-bad cmdlet+param combination (R31); module import without required directive (`module-env-mismatch`); module import with required directive present (clean path); the full R32–R36 trigger/clean/edge-case/false-positive/false-negative probe sets; the v0.3.1 R12 conjunction-aware probes (with-guard / no-guard / desktop-guard / cmdlet-in-string / no-cmdlet-no-guard); the v0.3.1 R25 scope-aware probes (script-scope / function-local / watch-name-prefixed / non-watch-name); the R25 anonymous-scriptblock limitation anchor that pins the documented scope-tracker gap; the v0.4.1 R12 block-comment-guard probes (block-comment-requires / block-comment-requires-line-form / line-comment-requires-still-works / mixed-block-and-line) that pin the v0.4.1 block-comment guard fix and its regression anchors; the v0.4.2 R28 conjunction-aware probes (no-mutation-no-guard / post-no-guard / post-with-guard / get-only-no-guard / patch-no-guard / put-no-guard / delete-no-guard / mixedcase-method-no-fire) that pin the `requires_present` precondition, PUT coverage, DELETE intentional-exclusion, and case-sensitivity boundary; the v0.4.2 module-env-mismatch block-comment guard probes (block-comment-requires / line-comment-still-works) that pin the v0.4.2 module-env-mismatch block-comment fix; and the R38 manual-WhatIf probes (no-cmdletbinding / function-no-cmdletbinding / param-decorator-no-suppress / canonical-supportsshould / no-whatif-param / cmdletbinding-no-supportsshould / bool-whatif-no-fire / supportsshould-false / supportsshould-bare) that cover the full detection envelope including the bare-name shorthand and the explicit-false antipattern.
- **1 unit test** (`test-r25-template.js`) — directly tests the `regex-template` substitution mechanism in `src/validator.js` without going through the full linter pipeline.

The probe set is the regression-test surface. When adding a new rule, ship a corresponding probe that asserts the rule fires on a minimal triggering fixture and does not fire on a clean one. Document any known false-positive or false-negative behavior in the run-battery.js entry comment.

## Extending the linter

A new rule is justified only when it encodes a concrete runtime failure — the failure mode should be documented in the probe's `run-battery.js` comment and in the `## Failure modes` section.

**Path A — dynamic rules (no code changes):** for `regex`, `regex-inverse`, or `regex-template` rules, write a JSON rule definition and ingest it:

```
node src/rule-manager.js ingest my-rule.json
```

The rule is active immediately for all subsequent linter runs. Add a probe fixture in `tests/` and register it in `run-battery.js`.

**Path B — structural rules:** rules that need to reason over parsed JSON payloads (like `odata-bind-guid` or `system-entity-cascade`) cannot be expressed as patterns alone. Add the logic directly to `src/validator.js` inside the `payloads.forEach` block. Add a corresponding message override to `rules/overrides.json` if the message should be configurable without touching source. Add a fixture and probe.

## License

MIT. See the LICENSE file.

## Provenance

Developed by Dan Mobley (djwmobley).
