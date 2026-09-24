"use strict";

// R47 -- built-in structural rule (mirrors the existing built-in category already used by
// odata-bind-guid / optionset-coverage / system-entity-cascade / schema-entity-not-found in
// validator.js: none of those are rules/registry.json entries either, because validator.js's
// registry dispatch only understands the "regex" / "regex-template" / "regex-inverse" rule
// types -- there is no "code"-backed rule type in this clone's legacy engine. R47's shape
// analysis (tracking a function's return statements across its own control-flow blocks while
// excluding genuinely nested scriptblocks, resolving the last assignment to a variable before a
// bare `return $v`) cannot be expressed as a single
// regex over a blanked content view, so -- like the four existing built-ins -- it is implemented
// here as a dedicated, hand-written scanner and wired into validate() directly, not through the
// registry.json type dispatch. See README "Rule catalogue" / R47 section for the full writeup
// and the ADR-style deviation note.
//
// Intent: a function/filter that returns `,$x` sends its ENTIRE array as a single pipeline
// object ($_). A downstream pipeline stage, or a `foreach ($i in F)` loop, then silently
// operates on the whole array once instead of once per item -- a class of bug PSScriptAnalyzer
// and PowerShell's own parser cannot see (both accept the syntax; the defect is a runtime
// semantic one about how many objects flow down the pipeline).
//
// Architecture: a purpose-built tokenizer (same spirit as extractor.js's computeFunctionBodyRanges
// character-level automaton: never a regex over raw untreated source) turns the whole file into a
// flat, comment/string-opaque token stream. Two scans run over that stream:
//   1. detectFunctionShapes -- locate every `function NAME { ... }`, `filter NAME { ... }`, and
//      `${function:NAME} = { ... }` definition and classify its RETURN SHAPE (W = unary-comma-
//      wrapped, P = plain, U = the definition's own braces could not be resolved).
//   2. scanCallSites -- walk every token in the file (not restricted to any particular scope --
//      a call site can occur anywhere) looking for invocations of a name found in step 1, and
//      classify each one FLAG / NO FLAG per the call-site rules below.
//
// Total classification, not an allow-list: every call site to a W-shaped (or unparseable) NAME
// maps to FLAG unless it matches one of the enumerated NO-FLAG shapes; every call site to a P or
// X (undefined) NAME is NO FLAG, full stop. An unparseable return shape (U) always flags its call
// sites -- the unknown branch is never a silent pass.

// ---------------------------------------------------------------------------
// Tokenizer: turns raw PowerShell source into a flat stream of tokens, skipping comment and
// string/here-string bodies entirely (they contribute zero tokens and can never corrupt brace/
// paren/bracket depth tracking or be mistaken for real keywords/punctuation).
// ---------------------------------------------------------------------------
function tokenize(content) {
  const tokens = [];
  const len = content.length;
  let i = 0;
  let line = 1;

  function push(type, start, end, extra) {
    tokens.push(Object.assign({ type, start, end, line }, extra || {}));
  }

  while (i < len) {
    const c = content[i];

    if (c === "\r") { i++; continue; }
    if (c === "\n") { push("NEWLINE", i, i + 1); line++; i++; continue; }
    if (c === " " || c === "\t") { i++; continue; }

    // Backtick line-continuation: the statement continues onto the next line, so no NEWLINE
    // token is emitted (mirrors PowerShell's own continuation semantics).
    if (c === "`" && (content[i + 1] === "\n" || (content[i + 1] === "\r" && content[i + 2] === "\n"))) {
      i++;
      if (content[i] === "\r") i++;
      if (content[i] === "\n") { i++; line++; }
      continue;
    }
    // A backtick escaping any other single character outside a string (rare but legal at the
    // token level, e.g. before a special char) -- consume both chars, emit nothing.
    if (c === "`" && i + 1 < len) { i += 2; continue; }

    if (c === "<" && content[i + 1] === "#") {
      i += 2;
      while (i < len - 1 && !(content[i] === "#" && content[i + 1] === ">")) {
        if (content[i] === "\n") line++;
        i++;
      }
      i = Math.min(i + 2, len);
      continue;
    }
    if (c === "#") {
      while (i < len && content[i] !== "\n") i++;
      continue;
    }
    if (c === "@" && (content[i + 1] === '"' || content[i + 1] === "'")) {
      const quote = content[i + 1];
      i += 2;
      while (i < len - 1) {
        if (content[i] === "\n") line++;
        if (content[i] === quote && content[i + 1] === "@") { i += 2; break; }
        i++;
      }
      push("STRING", i, i);
      continue;
    }
    if (c === '"') {
      i++;
      while (i < len) {
        if (content[i] === "`" && i + 1 < len) { i += 2; continue; }
        if (content[i] === "\n") line++;
        if (content[i] === '"') { i++; break; }
        i++;
      }
      push("STRING", i, i);
      continue;
    }
    if (c === "'") {
      i++;
      while (i < len) {
        if (content[i] === "'") {
          if (content[i + 1] === "'") { i += 2; continue; }
          i++;
          break;
        }
        if (content[i] === "\n") line++;
        i++;
      }
      push("STRING", i, i);
      continue;
    }
    if (c === "$" && content[i + 1] === "(") {
      push("DOLLARPAREN", i, i + 2);
      i += 2;
      continue;
    }
    if (c === "$") {
      const start = i;
      i++;
      if (content[i] === "{") {
        i++;
        while (i < len && content[i] !== "}") i++;
        if (content[i] === "}") i++;
      } else {
        while (i < len && /[A-Za-z0-9_:]/.test(content[i])) i++;
      }
      push("VAR", start, i, { name: content.slice(start, i) });
      continue;
    }
    if (c === "@" && content[i + 1] === "(") {
      push("ATPAREN", i, i + 2);
      i += 2;
      continue;
    }
    if (c === "@" && content[i + 1] === "{") {
      push("ATBRACE", i, i + 2);
      i += 2;
      continue;
    }
    // Compound assignment / arithmetic operators that contain '=' -- must be lexed as a single
    // token so a later scan for a plain '=' assignment token never mistakes `+=`/`-=`/etc. for
    // a bare `=`. Comparison operators (-eq, -ne, ...) are handled by the WORD branch below
    // (they start with '-' followed by a letter, not by one of these symbol chars).
    if ("+-*/%".includes(c) && content[i + 1] === "=") {
      push("COMPOUNDEQ", i, i + 2);
      i += 2;
      continue;
    }
    if (c === "-" && /[A-Za-z]/.test(content[i + 1] || "")) {
      const start = i;
      i++;
      while (i < len && /[A-Za-z0-9_-]/.test(content[i])) i++;
      push("WORD", start, i, { text: content.slice(start, i) });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < len && /[A-Za-z0-9_-]/.test(content[i])) i++;
      push("WORD", start, i, { text: content.slice(start, i) });
      continue;
    }
    if (/[0-9]/.test(c)) {
      const start = i;
      i++;
      while (i < len && /[0-9A-Fa-fxX.]/.test(content[i])) i++;
      push("NUMBER", start, i);
      continue;
    }
    if ("{}()[],;|&.=".includes(c)) {
      push(c, i, i + 1);
      i++;
      continue;
    }
    push("OTHER", i, i + 1, { text: c });
    i++;
  }
  push("EOF", len, len);
  return tokens;
}

// A single '(' / '@(' / '$(' opener closes with a plain ')'. Returns the index of the matching
// ')' token, or -1 if the file ends before it is found (an unparseable/unbalanced construct).
function matchParenLike(tokens, openIdx) {
  let depth = 1;
  let j = openIdx + 1;
  while (j < tokens.length) {
    const ty = tokens[j].type;
    if (ty === "(" || ty === "ATPAREN" || ty === "DOLLARPAREN") depth++;
    else if (ty === ")") { depth--; if (depth === 0) return j; }
    else if (ty === "EOF") return -1;
    j++;
  }
  return -1;
}

// True when `tok` is a token that can legally precede the FIRST word of a new PowerShell
// statement/pipeline-stage/command-argument-list -- i.e. `tok` is NOT itself part of the same
// command invocation. Used to decide whether a WORD spelling a known function name is being
// used in COMMAND-NAME position (a real call site) rather than merely appearing as an argument
// value to some other command.
function isCommandBoundary(tok) {
  if (!tok) return true; // start of file
  if (tok.type === "NEWLINE") return true;
  if (["{", "}", "(", ";", "|", "&", ".", ",", "ATPAREN", "DOLLARPAREN"].includes(tok.type)) return true;
  if (tok.type === "WORD" && /^in$/i.test(tok.text)) return true; // `foreach ($i in F)`
  return false;
}

// True when `tokens` (an array slice) is EXACTLY one literal token that is a bare numeric or
// string literal -- the "scalar carve-out": a unary comma whose sole operand is a bare literal
// is a runtime no-op (`,5` and `5` are observably different only when something downstream
// distinguishes a 1-element array from a scalar, which nothing in this rule's failure mode
// does), so it is treated as P even though it is syntactically a unary comma.
function isScalarLiteralOperand(tokens) {
  if (tokens.length !== 1) return false;
  return tokens[0].type === "NUMBER" || tokens[0].type === "STRING";
}

// ---------------------------------------------------------------------------
// Step 1: locate every function/filter/${function:NAME} definition and classify its return shape.
// ---------------------------------------------------------------------------

// Finds the token index of the '{' that opens NAME's body, starting the search at `fromIdx`
// (immediately after the name, optional attributes, and optional param block). Tracks paren/
// bracket depth so `[CmdletBinding()]`/`param(...)` are skipped correctly. Returns -1 if no such
// '{' is found before EOF (a structurally unparseable definition).
function findBodyOpenBrace(tokens, fromIdx) {
  let parenDepth = 0;
  let bracketDepth = 0;
  let j = fromIdx;
  while (j < tokens.length) {
    const ty = tokens[j].type;
    if (ty === "EOF") return -1;
    if (ty === "(" || ty === "ATPAREN" || ty === "DOLLARPAREN" || ty === "ATBRACE") { parenDepth++; j++; continue; }
    if (ty === ")") { parenDepth = Math.max(0, parenDepth - 1); j++; continue; }
    if (ty === "[") { bracketDepth++; j++; continue; }
    if (ty === "]") { bracketDepth = Math.max(0, bracketDepth - 1); j++; continue; }
    if (ty === "{" && parenDepth === 0 && bracketDepth === 0) return j;
    j++;
  }
  return -1;
}

// Given the index of the body's OPEN '{', returns the index of its matching close '}', or -1 if
// EOF is reached first (unparseable/unbalanced -- the caller must treat this as shape "U", never
// silently as "no definition" or "P").
function findMatchingCurly(tokens, openIdx) {
  let depth = 1;
  let j = openIdx + 1;
  while (j < tokens.length) {
    const ty = tokens[j].type;
    if (ty === "EOF") return -1;
    if (ty === "{" || ty === "ATBRACE") depth++;
    else if (ty === "}") { depth--; if (depth === 0) return j; }
    j++;
  }
  return -1;
}

// Control-flow keywords whose `{ }` body is part of the ENCLOSING function's own statement list
// (a `return`/leading-unary-comma/`Write-Output -NoEnumerate`/`$v = ,expr` inside one of these
// counts toward the enclosing function's shape, per spec: "mixed W and P exit paths in one
// function: W" exists precisely for `if (...) { return ,$a }; return $b`). "switch"'s own value/
// case-label blocks are handled separately below (they are not literally preceded by one of these
// keyword tokens).
const CONTROL_FLOW_BLOCK_KEYWORDS = /^(if|elseif|else|switch|foreach|for|while|do|try|catch|finally|begin|process|end)$/i;

// Determines whether the '{' at `openIdx` is introduced by a control-flow keyword (directly, or
// via a condition in parens, or via a `catch [Type1],[Type2] { }` type-filter list), and if so
// returns that keyword (lowercased): "if", "elseif", "else", "switch", "foreach", "for", "while",
// "do", "try", "catch", "finally", "begin", "process", "end". Returns null for every other `{`
// (an assigned/passed/otherwise unintroduced scriptblock literal -- `$sb = { }`,
// `ForEach-Object { }`, `Where-Object { }`, `& { }`, a nested `function`/`filter` body, etc.),
// which remains an opaque nested scriptblock excluded from the enclosing function's shape.
// `transparentBraceSet` (used only by the R47-alias whole-file scan below; always undefined for
// the original per-function shape computation, so that computation's behavior is byte-for-byte
// unchanged) is a Set of token indexes -- each the OPEN '{' of a `function`/`filter`/
// `${function:NAME}` definition body, as recorded by detectFunctionShapes -- that should be
// treated as transparent (keyword-introduced) even though the '{' itself is not literally
// preceded by the "function"/"filter" keyword token (a name, optional attributes, and optional
// param(...) block sit in between). Returns the sentinel "function-body" (truthy, and distinct
// from "switch" so `forceAllBlocksCount` is never mistakenly triggered for a function's own
// direct-child blocks).
function precedingKeywordForBlock(tokens, openIdx, transparentBraceSet) {
  if (transparentBraceSet && transparentBraceSet.has(openIdx)) return "function-body";
  let k = openIdx - 1;
  while (k >= 0 && tokens[k].type === "NEWLINE") k--;
  if (k < 0) return null;
  const t = tokens[k];

  // Bare keyword directly before '{': else / try / finally / do / begin / process / end / catch
  // (catch with no type filter).
  if (t.type === "WORD" && CONTROL_FLOW_BLOCK_KEYWORDS.test(t.text) && !/^(if|elseif|switch|foreach|for|while)$/i.test(t.text)) {
    return t.text.toLowerCase();
  }

  // `catch [Type1],[Type2] { }` -- walk back over one or more bracketed type literals separated
  // by commas to find the `catch` keyword.
  if (t.type === "]") {
    let j = k;
    while (j >= 0 && tokens[j].type === "]") {
      let depth = 1;
      j--;
      while (j >= 0 && depth > 0) {
        if (tokens[j].type === "]") depth++;
        else if (tokens[j].type === "[") depth--;
        j--;
      }
      while (j >= 0 && tokens[j].type === "NEWLINE") j--;
      if (j >= 0 && tokens[j].type === ",") {
        j--;
        while (j >= 0 && tokens[j].type === "NEWLINE") j--;
        continue;
      }
      break;
    }
    if (j >= 0 && tokens[j].type === "WORD" && /^catch$/i.test(tokens[j].text)) return "catch";
    return null;
  }

  // `if (cond) { }` / `elseif (cond) { }` / `switch [-Flags] (cond) { }` / `foreach [-Parallel]
  // ($i in X) { }` / `for (...) { }` / `while (cond) { }` -- t is the closing ')' of the
  // condition; walk back to its matching '(' and then past any leading `-Flag` tokens to the
  // keyword.
  if (t.type === ")") {
    let depth = 1;
    let j = k - 1;
    while (j >= 0 && depth > 0) {
      if (tokens[j].type === ")") depth++;
      else if (tokens[j].type === "(") depth--;
      j--;
    }
    let m = j;
    while (m >= 0) {
      const tok = tokens[m];
      if (tok.type === "NEWLINE") { m--; continue; }
      if (tok.type === "WORD" && /^(if|elseif|switch|foreach|for|while)$/i.test(tok.text)) return tok.text.toLowerCase();
      if (tok.type === "WORD" && /^-/.test(tok.text)) { m--; continue; } // e.g. switch -Regex, foreach -Parallel
      break;
    }
    return null;
  }

  return null;
}

// Recursively splits a function/filter body's token range [start, end) into shape-evidence
// statements. A `{ }` block is treated one of two ways:
//   - Control-flow-introduced (if/elseif/else/switch/foreach/for/while/do/try/catch/finally/
//     begin/process/end): part of the enclosing function's own body. Its content is recursively
//     split and its statements are folded into the SAME flat list, in source order.
//   - Everything else (a nested `function`/`filter` definition, an assigned/passed/otherwise
//     unintroduced scriptblock literal `$sb = { }` / `ForEach-Object { }` / `& { }`): an opaque
//     nested scriptblock, excluded entirely (its `return`/comma statements belong to a different
//     scope -- see the "nested scriptblock" adversary case).
// `switch`'s own body is special: a switch body is a sequence of `<value-or-condition> { action }`
// case blocks that are not literally preceded by a keyword token, so once inside a block whose
// keyword was "switch" (forceAllBlocksCount), EVERY direct-child `{ }` is itself a case-action
// block and recurses (with forceAllBlocksCount off again one level down, so a case body's own
// assigned scriptblocks etc. are excluded as usual).
// Statement boundaries (`;` or a real newline) are only recognized when paren/bracket depth is 0
// at the CURRENT recursion level, so a multi-line array literal (`@( 'a'` / newline / `, 'b' )`)
// never gets split mid-literal.
function splitTopLevelStatements(tokens, start, end, forceAllBlocksCount, transparentBraceSet) {
  const statements = [];
  let current = [];
  let parenDepth = 0;
  let bracketDepth = 0;
  let i = start;

  function flush() {
    if (current.length) statements.push(current);
    current = [];
  }

  while (i < end) {
    const t = tokens[i];
    if (t.type === "{" || t.type === "ATBRACE") {
      const keyword = t.type === "{"
        ? (forceAllBlocksCount ? "switch-case" : precedingKeywordForBlock(tokens, i, transparentBraceSet))
        : null;
      if (keyword) {
        flush(); // whatever preceded the block (the keyword/condition tokens) carries no shape evidence of its own.
        const close = findMatchingCurly(tokens, i);
        const bodyEnd = close < 0 ? end : close;
        const childStatements = splitTopLevelStatements(tokens, i + 1, bodyEnd, keyword === "switch", transparentBraceSet);
        statements.push(...childStatements);
        i = close < 0 ? end : close + 1;
        continue;
      }
      // Opaque nested block: skip entirely, contributing nothing to the current statement.
      let depth = 1;
      i++;
      while (i < end && depth > 0) {
        if (tokens[i].type === "{" || tokens[i].type === "ATBRACE") depth++;
        else if (tokens[i].type === "}") depth--;
        i++;
      }
      continue;
    }
    if (t.type === "(" || t.type === "ATPAREN" || t.type === "DOLLARPAREN") { parenDepth++; current.push(t); i++; continue; }
    if (t.type === ")") { parenDepth = Math.max(0, parenDepth - 1); current.push(t); i++; continue; }
    if (t.type === "[") { bracketDepth++; current.push(t); i++; continue; }
    if (t.type === "]") { bracketDepth = Math.max(0, bracketDepth - 1); current.push(t); i++; continue; }
    if ((t.type === ";" || t.type === "NEWLINE") && parenDepth === 0 && bracketDepth === 0) {
      flush();
      i++;
      continue;
    }
    current.push(t);
    i++;
  }
  flush();
  return statements;
}

// Classifies one `return <expr>` statement's tokens (statement[0] is the `return` WORD).
// Returns "W", "P", or null (not a return statement / bare `return` with no value -> P).
function classifyReturnStatement(statement) {
  const expr = statement.slice(1);
  if (expr.length === 0) return "P"; // bare `return;` -- returns $null, never W.

  // `return ,expr`
  if (expr[0].type === ",") {
    const operand = expr.slice(1);
    if (operand.length === 0) return "P";
    return isScalarLiteralOperand(operand) ? "P" : "W";
  }
  // `return (,expr)` -- the '(' must wrap the ENTIRE remaining expression.
  if (expr[0].type === "(" && expr[1] && expr[1].type === ",") {
    if (expr[expr.length - 1].type === ")") {
      const operand = expr.slice(2, expr.length - 1);
      if (operand.length === 0) return "P";
      return isScalarLiteralOperand(operand) ? "P" : "W";
    }
  }
  // `return @(,expr)`
  if (expr[0].type === "ATPAREN" && expr[1] && expr[1].type === ",") {
    if (expr[expr.length - 1].type === ")") {
      const operand = expr.slice(2, expr.length - 1);
      if (operand.length === 0) return "P";
      return isScalarLiteralOperand(operand) ? "P" : "W";
    }
    // `return @(,@())` etc: the comma's operand is everything up to the matching close of @(,
    // even when that close isn't the statement's own last token (defensive fallback; the
    // common case above already covers `return @(,expr)` used as a whole statement).
    return "W";
  }
  // `return $v` -- bare variable, no member/index/anything else trailing.
  if (expr.length === 1 && expr[0].type === "VAR") {
    return { bareVar: expr[0].name.toLowerCase().replace(/^\$\{?/, "").replace(/\}$/, "").replace(/^[a-z_][a-z0-9_]*:/i, "") };
  }
  return "P";
}

// Classifies whether `statement` is `Write-Output ... -NoEnumerate ...` (either argument order).
function isWriteOutputNoEnumerate(statement) {
  if (!statement[0] || statement[0].type !== "WORD" || !/^write-output$/i.test(statement[0].text)) return false;
  return statement.some((t) => t.type === "WORD" && /^-noenumerate$/i.test(t.text));
}

// Classifies whether `statement` is a bare top-level unary-comma expression (`,$x`), i.e. the
// comma is literally the first token of the statement. Returns "W", "P" (scalar carve-out), or
// null (not this shape).
function classifyTopLevelCommaStatement(statement) {
  if (!statement[0] || statement[0].type !== ",") return null;
  const operand = statement.slice(1);
  if (operand.length === 0) return null;
  return isScalarLiteralOperand(operand) ? "P" : "W";
}

// Computes the return shape ("W" or "P") of one function/filter body given its token range
// [start, end) (exclusive of the enclosing braces themselves).
function computeBodyShape(tokens, start, end) {
  const statements = splitTopLevelStatements(tokens, start, end);
  const lastAssignment = new Map(); // varname(lower) -> "W" | "P"
  let sawW = false;

  for (const statement of statements) {
    if (!statement.length) continue;

    // Plain assignment `$v = <rhs>` (compound assignment `+=` etc. is a distinct token type and
    // never matches this shape, so it never overwrites a prior W/P classification for $v).
    if (statement[0].type === "VAR" && statement[1] && statement[1].type === "=") {
      const rhs = statement.slice(2);
      const varName = statement[0].name.toLowerCase().replace(/^\$\{?/, "").replace(/\}$/, "").replace(/^[a-z_][a-z0-9_]*:/i, "");
      let rhsShape = "P";
      if (rhs.length && rhs[0].type === ",") {
        const operand = rhs.slice(1);
        rhsShape = operand.length && !isScalarLiteralOperand(operand) ? "W" : "P";
      }
      lastAssignment.set(varName, rhsShape);
      continue;
    }

    if (statement[0].type === "WORD" && /^return$/i.test(statement[0].text)) {
      const result = classifyReturnStatement(statement);
      if (result === "W") sawW = true;
      else if (result && typeof result === "object" && result.bareVar) {
        if (lastAssignment.get(result.bareVar) === "W") sawW = true;
      }
      continue;
    }

    if (isWriteOutputNoEnumerate(statement)) { sawW = true; continue; }

    const commaShape = classifyTopLevelCommaStatement(statement);
    if (commaShape === "W") sawW = true;
  }

  return sawW ? "W" : "P";
}

// Strips an optional single scope-qualifier prefix (script:/global:/local:/private:/etc.) and
// lowercases, mirroring the convention already established elsewhere in this codebase for
// comparing function/command names.
function stripScope(name) {
  const match = String(name || "").match(/^[A-Za-z_][A-Za-z0-9_]*:(.*)$/);
  return (match ? match[1] : String(name || "")).toLowerCase();
}

// Scans the whole token stream for function/filter/${function:NAME} definitions and returns a
// Map of lowercased bare NAME -> "W" | "P" | "U". A NAME defined more than once is "W" if ANY of
// its definitions is "W" (per spec); "U" (unparseable) only when a definition's own braces could
// not be resolved, and an unparseable definition never gets silently overridden back to P/W by
// another definition of the same name currently found afterward, since "U" already forces every
// call site to flag regardless -- widening rather than narrowing risk is the safe default here.
function detectFunctionShapes(tokens) {
  const shapes = new Map();
  const definitionNameTokenIndexes = new Set();
  // Every function/filter/${function:NAME} body's OPEN '{' token index -- consumed by the R47-alias
  // whole-file statement scan (below) so that a body's contents are treated as a transparent,
  // keyword-introduced block (same visibility as a top-level or control-flow-nested statement),
  // never as an opaque assigned/passed scriptblock. Recorded even when the body's own close brace
  // could not be resolved (shape "U"): the OPEN token's identity is independent of that.
  const bodyOpenBraces = new Set();

  function mergeShape(name, shape) {
    const existing = shapes.get(name);
    if (existing === "U" || shape === "U") { shapes.set(name, "U"); return; }
    if (existing === "W" || shape === "W") { shapes.set(name, "W"); return; }
    shapes.set(name, "P");
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === "WORD" && /^(function|filter)$/i.test(t.text)) {
      // Class methods (`class Foo { [type] Bar() { } }`) never spell the "function"/"filter"
      // keyword at all, so they are excluded by construction -- no extra check needed here.
      const nameTok = tokens[i + 1];
      if (!nameTok || nameTok.type !== "WORD") continue;
      definitionNameTokenIndexes.add(i + 1);
      const name = stripScope(nameTok.text);
      const openBrace = findBodyOpenBrace(tokens, i + 2);
      if (openBrace < 0) { mergeShape(name, "U"); continue; }
      bodyOpenBraces.add(openBrace);
      const closeBrace = findMatchingCurly(tokens, openBrace);
      if (closeBrace < 0) { mergeShape(name, "U"); continue; }
      mergeShape(name, computeBodyShape(tokens, openBrace + 1, closeBrace));
      continue;
    }

    if (t.type === "VAR" && /^\$\{function:/i.test(t.name)) {
      const match = t.name.match(/^\$\{function:(?:[A-Za-z_][A-Za-z0-9_]*:)?([A-Za-z_][A-Za-z0-9_-]*)\}$/i);
      if (!match) continue;
      const name = match[1].toLowerCase();
      // Expect `= { ... }` immediately after (skipping NEWLINE tokens only).
      let j = i + 1;
      while (tokens[j] && tokens[j].type === "NEWLINE") j++;
      if (!tokens[j] || tokens[j].type !== "=") continue;
      j++;
      while (tokens[j] && tokens[j].type === "NEWLINE") j++;
      if (!tokens[j] || tokens[j].type !== "{") continue;
      const openBrace = j;
      bodyOpenBraces.add(openBrace);
      const closeBrace = findMatchingCurly(tokens, openBrace);
      if (closeBrace < 0) { mergeShape(name, "U"); continue; }
      mergeShape(name, computeBodyShape(tokens, openBrace + 1, closeBrace));
      continue;
    }
  }

  return { shapes, definitionNameTokenIndexes, bodyOpenBraces };
}

// ---------------------------------------------------------------------------
// Step 1b: same-file alias resolution (`Set-Alias`/`New-Alias`/`Remove-Alias`) -- NAME takes
// TARGET's return shape (W/P/U), resolved transitively through alias-to-alias chains up to depth
// 4. Total classification: every alias definition maps to exactly one outcome below; there is no
// enumerated allow-list of "shapes that get special-cased" -- anything this scan cannot statically
// resolve (an unresolvable name/target, an undefined target, a chain exceeding depth 4, a cycle,
// or a definition inside an opaque assigned/passed scriptblock) falls through to the SAME "X"
// (undefined) branch every other unresolved NAME already falls through to elsewhere in this file --
// never a distinct silent-pass branch of its own.
// ---------------------------------------------------------------------------

// Parses one alias-definition statement's arguments (statement[0] is the Set-Alias/New-Alias/
// Remove-Alias WORD). Recognizes `-Name`/`-Value` by flag, and otherwise consumes bareword/VAR
// tokens positionally (first positional = NAME, second = TARGET), matching PowerShell's own
// parameter-binding order for these cmdlets. Any other named flag conservatively consumes one
// following value token unless it is a known boolean switch or the statement ends, so e.g.
// `-Scope Global gw Get-Wrapped` never misreads "Global" as the alias NAME. Quoted-string NAME/
// TARGET values cannot be recovered here -- the tokenizer intentionally discards string contents
// (see tokenize()) -- so a quoted form yields a null field, which the caller treats as
// unresolvable (documented blind spot, never a crash and never a silent false-positive).
const ALIAS_BOOLEAN_SWITCHES = new Set(["-force", "-passthru", "-whatif", "-confirm"]);
function parseAliasArgs(statement) {
  let name = null;
  let target = null;
  const positional = [];
  let i = 1;
  while (i < statement.length) {
    const tok = statement[i];
    if (tok.type === "WORD" && /^-name$/i.test(tok.text)) {
      const val = statement[i + 1];
      if (val && val.type === "WORD") name = val.text;
      i += 2;
      continue;
    }
    if (tok.type === "WORD" && /^-value$/i.test(tok.text)) {
      const val = statement[i + 1];
      if (val && val.type === "WORD") target = val.text;
      i += 2;
      continue;
    }
    if (tok.type === "WORD" && /^-/.test(tok.text)) {
      const flag = tok.text.toLowerCase();
      if (ALIAS_BOOLEAN_SWITCHES.has(flag)) { i += 1; continue; }
      const next = statement[i + 1];
      if (next && !(next.type === "WORD" && /^-/.test(next.text))) { i += 2; continue; }
      i += 1;
      continue;
    }
    if (tok.type === "WORD" || tok.type === "VAR") {
      positional.push(tok.type === "WORD" ? tok.text : tok.name);
    }
    i += 1;
  }
  if (name === null && positional.length >= 1) name = positional[0];
  if (target === null && positional.length >= 2) target = positional[1];
  return { name, target };
}

// Walks the whole-file `visibleStatements` list (top-level, control-flow-nested, AND
// function/filter-body-nested -- i.e. every "top-level or keyword-introduced block position"; an
// alias defined inside an assigned/passed/anonymously-invoked scriptblock never appears in
// `visibleStatements` at all, since that block was excluded as opaque by splitTopLevelStatements
// the same way a nested scriptblock's `return` already is) and returns a Map of
// lowercased-alias-name -> lowercased-target-name, reflecting the LAST definition in file order
// (a later Set-Alias/New-Alias/Remove-Alias of the same NAME always overwrites an earlier one,
// since the map is populated by a single forward pass). `Remove-Alias NAME` and a Set-Alias/
// New-Alias whose TARGET could not be statically read both record `null` (unresolvable/no active
// target as of that point in the file) rather than leaving a stale prior mapping in place.
function detectAliasDefinitions(visibleStatements) {
  const aliasMap = new Map();
  for (const statement of visibleStatements) {
    if (!statement.length || statement[0].type !== "WORD") continue;
    const cmd = statement[0].text.toLowerCase();
    if (cmd !== "set-alias" && cmd !== "new-alias" && cmd !== "remove-alias") continue;
    const { name, target } = parseAliasArgs(statement);
    if (!name) continue; // NAME itself could not be statically read -- no NAME to key the map on.
    const nameLower = stripScope(name);
    if (cmd === "remove-alias" || !target) {
      aliasMap.set(nameLower, null);
      continue;
    }
    aliasMap.set(nameLower, stripScope(target));
  }
  return aliasMap;
}

// Resolves one alias's ultimate return shape by walking `aliasMap` from `startName` toward a
// function/filter NAME present in `functionShapes`, up to 4 alias-to-alias hops. Returns "X" for:
// an undefined target, a `null` (removed/unresolvable) target, a cycle, or a chain exceeding depth
// 4 -- the same "X" every other unresolved NAME in this file already resolves to, never a distinct
// branch.
function resolveAliasChain(startName, aliasMap, functionShapes) {
  let current = startName;
  const visited = new Set();
  let hops = 0;
  for (;;) {
    if (functionShapes.has(current)) return functionShapes.get(current);
    if (visited.has(current)) return "X"; // cyclic alias chain.
    visited.add(current);
    if (!aliasMap.has(current)) return "X"; // target is neither a known function nor a known alias.
    if (hops >= 4) return "X"; // chain depth exceeded.
    const next = aliasMap.get(current);
    if (next === null) return "X"; // removed, or a later definition's target was unresolvable.
    hops++;
    current = next;
  }
}

// Returns a Map of lowercased-alias-name -> "W"|"P"|"U" for every alias whose chain resolves to a
// known function/filter shape. Aliases resolving to "X" are omitted entirely (an absent map entry
// and an entry whose value is neither "U" nor "W" behave identically in scanCallSites, so omitting
// them is a pure size optimization, not a behavioral shortcut).
function resolveAliasShapes(aliasMap, functionShapes) {
  const resolved = new Map();
  for (const name of aliasMap.keys()) {
    const shape = resolveAliasChain(name, aliasMap, functionShapes);
    if (shape !== "X") resolved.set(name, shape);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Step 2: call-site classification.
// ---------------------------------------------------------------------------

// Scans forward from `i` (the call's command-name token) to the first depth-0 pipeline/statement
// boundary, returning that boundary token's index (which may be tokens.length if EOF is reached
// first).
function findInvocationEnd(tokens, i) {
  let j = i + 1;
  let pd = 0, bd = 0, cd = 0;
  while (j < tokens.length) {
    const ty = tokens[j].type;
    if (ty === "(" || ty === "ATPAREN" || ty === "DOLLARPAREN") { pd++; j++; continue; }
    if (ty === ")") { if (pd === 0) break; pd--; j++; continue; }
    if (ty === "[") { bd++; j++; continue; }
    if (ty === "]") { if (bd === 0) break; bd--; j++; continue; }
    if (ty === "{" || ty === "ATBRACE") { cd++; j++; continue; }
    if (ty === "}") { if (cd === 0) break; cd--; j++; continue; }
    if (pd === 0 && bd === 0 && cd === 0 && (ty === "|" || ty === ";" || ty === "NEWLINE" || ty === "EOF")) break;
    j++;
  }
  return j;
}

// Classifies a single call site at token index `i` (tokens[i] is the WORD naming a W-shaped
// function). Mutates `varWrapState` when this call is the RHS of a tracked assignment shape.
// Returns true (FLAG) or false (NO FLAG) for firing AT THIS call site directly; the deferred
// `$r = @(F); $r | ...` shape is resolved later, at $r's own usage, by the caller's main loop.
function classifyWCallSite(tokens, i, varWrapState) {
  const prev = tokens[i - 1];

  // What (if anything) wraps this call in a `(`, `$(`, or `@(` that opens immediately before it.
  // This must be resolved BEFORE computing the invocation's end boundary: when a wrapper opened
  // before `i`, findInvocationEnd's own depth counters (which start at 0, relative to `i`) see
  // the wrapper's close as an immediate, unmatched ')' and stop right there -- so the boundary
  // used for pipe-stage detection below must be "one past the wrapper's own close", not
  // findInvocationEnd's raw result, whenever the call is exactly wrapped.
  let openType = null;
  if (prev) {
    if (prev.type === "(") openType = "(";
    else if (prev.type === "DOLLARPAREN") openType = "$(";
    else if (prev.type === "ATPAREN") openType = "@(";
  }
  const rawInvocationEnd = findInvocationEnd(tokens, i);
  let wrapClose = -1;
  if (openType) wrapClose = matchParenLike(tokens, i - 1);
  const isExactlyWrapped = openType && wrapClose !== -1 && wrapClose === rawInvocationEnd;

  const j = isExactlyWrapped ? wrapClose + 1 : rawInvocationEnd;
  const afterTok = tokens[j];

  if (isExactlyWrapped && (openType === "(" || openType === "$(")) {
    // `(F) | ...` / `$(F) | ...` -- plain grouping/subexpression unwraps. NO FLAG.
    // `(F).Where{}` / `(F).ForEach{}` also fall through this same wrapper shape; both are NO FLAG
    // regardless of what follows, so no further check is needed for either form.
    return false;
  }

  if (isExactlyWrapped && openType === "@(") {
    const afterClose = tokens[wrapClose + 1];
    if (afterClose && afterClose.type === "[") return false; // `@(F)[0]` -- NO FLAG.
    // Otherwise fall through to the general pipe-based rule below (`@(F) | ...` -> FLAG).
  }

  // `$null = F` -- NO FLAG. `$r = F` (any other bare variable, no wrapper) -- NO FLAG, and
  // records `$r` as a plain (unwrapped) assignment so a LATER `$r | ...` is correctly not
  // attributed back to this call either.
  if (prev && prev.type === "=") {
    const lhs = tokens[i - 2];
    if (lhs && lhs.type === "VAR") {
      const varLower = lhs.name.toLowerCase().replace(/^\$\{?/, "").replace(/\}$/, "");
      if (!/^null$/i.test(varLower)) varWrapState.set(varLower, { kind: "plain" });
      return false;
    }
  }

  // `$r = @(F)` -- do not flag AT the assignment; defer to `$r`'s own later pipe usage.
  if (openType === "@(" && isExactlyWrapped) {
    const beforeOpen = tokens[i - 2];
    if (beforeOpen && beforeOpen.type === "=") {
      const lhs = tokens[i - 3];
      if (lhs && lhs.type === "VAR") {
        const varLower = lhs.name.toLowerCase().replace(/^\$\{?/, "").replace(/\}$/, "");
        varWrapState.set(varLower, { kind: "wrapped" });
        return false;
      }
    }
  }

  // `foreach ($i in F) { }` -- FLAG. (`in` is only recognized as a command boundary in
  // isCommandBoundary for exactly this shape, so reaching here with prev.type WORD "in" is
  // already a strong, low-false-positive signal on its own.)
  if (prev && prev.type === "WORD" && /^in$/i.test(prev.text)) return true;

  // General pipe rule: `F | <any stage>` -- FLAG, except the two documented literal carve-outs.
  if (afterTok && afterTok.type === "|") {
    const stage1 = tokens[j + 1];
    if (stage1 && stage1.type === "WORD" && /^out-null$/i.test(stage1.text)) return false;
    if (stage1 && stage1.type === "WORD" && /^foreach-object$/i.test(stage1.text)) {
      let k = j + 2;
      if (tokens[k] && (tokens[k].type === "{" || tokens[k].type === "ATBRACE")) {
        const body = [];
        let m = k + 1;
        while (m < tokens.length && tokens[m].type !== "}" && tokens[m].type !== "EOF") { body.push(tokens[m]); m++; }
        if (body.length === 1 && body[0].type === "VAR" && /^\$_$/.test(body[0].name)) return false;
      }
    }
    return true;
  }

  return false;
}

// Scans the entire token stream for call sites to any NAME present in `shapes`, returning a list
// of { index, name } findings for every FLAGGED call.
function scanCallSites(tokens, shapes, definitionNameTokenIndexes) {
  const findings = [];
  const varWrapState = new Map();

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === "WORD" && !definitionNameTokenIndexes.has(i)) {
      const lower = stripScope(t.text);
      if (shapes.has(lower) && isCommandBoundary(tokens[i - 1])) {
        const shape = shapes.get(lower);
        if (shape === "U") {
          findings.push({ index: i, name: t.text });
        } else if (shape === "W") {
          if (classifyWCallSite(tokens, i, varWrapState)) findings.push({ index: i, name: t.text });
        }
        // shape === "P": never flagged, and never tracked into varWrapState either.
      }
      continue;
    }

    if (t.type === "VAR") {
      const varLower = t.name.toLowerCase().replace(/^\$\{?/, "").replace(/\}$/, "");
      const state = varWrapState.get(varLower);
      if (state && state.kind === "wrapped") {
        const prev = tokens[i - 1];
        const next = tokens[i + 1];
        if (isCommandBoundary(prev) && next && next.type === "|") {
          findings.push({ index: i, name: t.name });
          varWrapState.delete(varLower); // consume -- avoid re-flagging on a later unrelated use.
        }
      } else if (state && state.kind === "plain") {
        // A subsequent, unrelated reassignment or pipe use of a plain-assigned variable is out
        // of scope for this rule (plain assignment already unwrapped the array once).
      }
    }
  }

  return findings;
}

// Computes a 1-based line number for a token's start offset.
function lineForOffset(content, offset) {
  let line = 1;
  for (let k = 0; k < offset && k < content.length; k++) {
    if (content[k] === "\n") line++;
  }
  return line;
}

/**
 * Runs the R47 scan against `rawContent` (the ORIGINAL, unmodified script text -- this rule
 * needs no comment/string-blanked view because the tokenizer itself skips comment and string
 * bodies while walking the raw text) and returns an array of validator.js-shaped findings:
 * { rule: "R47", message, details }.
 */
function detectWrappedReturnPipelineFindings(rawContent) {
  const content = String(rawContent || "");
  if (!content) return [];
  const tokens = tokenize(content);
  const { shapes, definitionNameTokenIndexes, bodyOpenBraces } = detectFunctionShapes(tokens);

  // Whole-file alias resolution (R47 alias extension): a flat, top-level-or-keyword-introduced
  // (control-flow- AND function/filter-body-nested) statement list, excluding the same opaque
  // assigned/passed scriptblocks the per-function shape computation already excludes. `end` is
  // tokens.length - 1 to exclude the trailing EOF sentinel token, mirroring how a function body's
  // own close-brace index is used as an exclusive end elsewhere in this file.
  const visibleStatements = splitTopLevelStatements(tokens, 0, tokens.length - 1, false, bodyOpenBraces);
  const aliasMap = detectAliasDefinitions(visibleStatements);
  const aliasShapes = resolveAliasShapes(aliasMap, shapes);
  const mergedShapes = new Map(shapes);
  for (const [name, shape] of aliasShapes) {
    if (!mergedShapes.has(name)) mergedShapes.set(name, shape); // a real function/filter NAME always wins over a same-named alias.
  }

  if (mergedShapes.size === 0) return [];
  const hits = scanCallSites(tokens, mergedShapes, definitionNameTokenIndexes);

  return hits.map((hit) => {
    const line = lineForOffset(content, tokens[hit.index].start);
    return {
      rule: "R47",
      message:
        "A function/filter whose return statement unary-comma-wraps its result (`return ,$x`, `return (,$x)`, `return @(,$x)`, `Write-Output -NoEnumerate`, or `return $v` where $v's last assignment was `,expr`) sends its array as a single pipeline object. Piping the call directly, assigning it through `@( )` before piping, or using it as a `foreach (...in ...)` source silently processes the WHOLE array once instead of once per item. Unwrap at the call site with `(" +
        hit.name +
        ") | ...` or `$r = " +
        hit.name +
        "; $r | ...`, or change the function to return the array plainly if per-item enumeration is intended. Accepted, documented false positive: a function that intentionally returns one batched array as an API contract is syntactically indistinguishable from this defect; this linter has no suppression-annotation mechanism, so signal intent by wrapping the call in parentheses (`(" +
        hit.name +
        ") | ...`), which this rule always treats as an explicit unwrap.",
      details: `Call to '${hit.name}' near line ${line}.`,
    };
  });
}

module.exports = {
  detectWrappedReturnPipelineFindings,
  // exported for unit-level reuse/testing only; not part of the CLI-facing contract.
  tokenize,
  detectFunctionShapes,
  scanCallSites,
  detectAliasDefinitions,
  resolveAliasShapes,
};
