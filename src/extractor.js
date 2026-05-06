const fs = require("fs");

function stripComments(content) {
    // Simple heuristic to strip PowerShell full-line comments to avoid regex-inverse bypasses.
    // v0.3.1 change: replace matched comment characters with spaces (preserving newlines)
    // so that strippedContent stays length-aligned with rawContent. This matters for
    // scope-aware rules whose match indices in strippedContent must map to function-body
    // ranges computed against the same surface. Previously, the empty-string replacement
    // caused index-misalignment between strippedContent and rawContent, but no rule depended
    // on alignment so it was unnoticed.
    return content.replace(/^\s*#.*$/gm, (m) => m.replace(/[^\r\n]/g, ' '));
}

/**
 * Produce a derivation of `rawContent` with every PowerShell block-comment range
 * (<# ... #>) length-preservingly space-filled (newlines preserved). Used by
 * rules with `requires_absent` guards so that a `#Requires` directive nested
 * inside a `<# ... #>` block comment is NOT recognized as a guard, matching
 * PowerShell's actual parser behavior (the runtime ignores it).
 *
 * Why a third view (rather than reusing strippedContent or noCommentNoStringContent):
 *   - strippedContent removes only `^\s*#.*$` (line comments). It blanks the
 *     literal `#>` close tokens but does not blank the body of a multi-line
 *     `<# ... #>` block. A `#Requires` directive on a body line at column 0
 *     therefore survives in strippedContent.
 *   - noCommentNoStringContent removes block comments AND string literals AND
 *     line comments — too aggressive for a guard check, which must keep the
 *     LINE-comment `#Requires` directives (those ARE honored by PowerShell)
 *     visible.
 *   - This view removes ONLY `<# ... #>` ranges, which is the minimum surgery
 *     needed to fix the round-2 false negative without regressing the
 *     line-comment guard recognition.
 *
 * Length preservation keeps byte-index alignment with `rawContent`, matching
 * the same invariant `stripComments` adopted in v0.3.1. No current caller
 * depends on the alignment (the guard test is a regex .test() that only
 * needs match/no-match), but preservation costs nothing and keeps the view
 * usable for any future caller that does need alignment.
 *
 * Substrate citation for the non-greedy regex (`<#[\s\S]*?#>`):
 *   - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_comments
 *     (about_Comments, "PowerShell comment styles" section, "Important" callout):
 *     "you can't nest block comments. If you attempt to nest block comments,
 *     the outer block comment ends at the first `#>` encountered."
 *   - Same page, "Notes" section: "Block comments can't be nested."
 *   Therefore non-greedy first-`#>`-wins matching is correct: an inner `<#`
 *   inside an outer block comment carries no special meaning, and the first
 *   `#>` always closes the outermost (and only) block.
 *
 * Substrate citation for the false negative this fixes:
 *   - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_requires
 *     ("Examples" section): "Each `#Requires` statement must be the first item
 *     on a line". Inside a `<# ... #>` block, the body lines are comment text
 *     per about_Comments ("All text within the block is treated as part of the
 *     same comment, including whitespace"), so a `#Requires` lexeme inside
 *     the block is not a directive — it is comment content, and PowerShell
 *     does not honor it at parse time. R12's guard must mirror that behavior.
 */
function stripBlockComments(content) {
    // Non-greedy <# ... #>; per about_Comments, block comments do not nest.
    return content.replace(/<#[\s\S]*?#>/g, (m) => m.replace(/[^\r\n]/g, ' '));
}

/**
 * Produce a content view that collapses PowerShell `+`-based string concatenation
 * across line boundaries into single logical lines. Used by R37 and any future rule
 * that needs to detect patterns spanning adjacent string operands joined by `+`.
 *
 * Input: strippedContent (full-line # comments already removed).
 *
 * Algorithm: repeatedly collapse adjacent quoted-string segments joined by `+`
 * where the `+` may be at the end of one line and the next segment at the start of
 * the following line (with optional leading whitespace). Only direct string-literal
 * concatenation (`"a" + "b"` or `"a" +\n    "b"`) is collapsed; PowerShell
 * backtick line-continuations (`` ` `` at end of line) are a different mechanism
 * and must NOT be collapsed here (they are handled separately by normalizedContent).
 *
 * Edge cases handled:
 *   - Both double-quoted and single-quoted string segments.
 *   - Backtick-escaped characters inside double-quoted strings (preserved intact).
 *   - Multiple `+` operands on one line: collapsed left-to-right in a single pass.
 *   - Block comments within concatenation: should already be stripped by
 *     strippedBlockComments step upstream; this function operates on strippedContent.
 *   - Variable interpolation `$x` inside strings: preserved intact (joining is
 *     string-literal boundary collapsing only; interpolated content is untouched).
 *
 * NOT collapsed:
 *   - `+` between non-string expressions (e.g., `$a + $b`): the regex requires
 *     a closing quote on the left operand and an opening quote on the right operand.
 *   - Backtick statement-continuation at end of line: that is `\` ` at EOL with no
 *     `+` present; not matched by this function.
 *
 * Architecture note (v0.4.4): This is a framework content view, not a rule-specific
 * shim. Rules opt in via `"content_view": "joinPlusContent"` in the registry entry.
 * Lower blast radius than a blanket default change; higher reusability than a shim.
 * R13 is NOT retrofitted in this PR (separate scope).
 *
 * Substrate citation for why this is needed:
 *   Dataverse Web API OData query correctness (filter-rows, select-columns):
 *   https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/filter-rows
 *   https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/select-columns
 *   The canonical AdvAccel multi-line idiom splits an OData URL across two string
 *   literals joined by `+`; each line alone is innocent, but the joined URL contains
 *   a bare Lookup logicalname that fails at runtime. strippedContent sees each line
 *   separately; joinPlusContent joins them for whole-URL analysis.
 */
function buildJoinPlusContent(strippedContent) {
    // Regex: match the end of a double- or single-quoted string literal, optional
    // whitespace, then `+`, then optional whitespace and a newline, then optional
    // leading whitespace, then the opening quote of the next string literal.
    // Replace with: close-of-first + open-of-second (no `+` or newline in result),
    // effectively merging the two string literals.
    //
    // Pattern explanation:
    //   (["'])   — close-quote of left operand (captured as group 1)
    //   \s*\+\s* — the `+` operator with optional surrounding whitespace
    //   \r?\n    — the line boundary
    //   \s*      — optional leading whitespace on next line
    //   \1       — open-quote of right operand (same quote type as left)
    //
    // We iterate until no more matches (handles chains of 3+ operands).
    let result = strippedContent;
    let prev;
    do {
        prev = result;
        result = result.replace(/(["'])\s*\+\s*\r?\n\s*\1/g, '');
    } while (result !== prev);
    return result;
}

/**
 * Produce a derivation of content with block comments, string literals, and inline
 * comments removed. Used exclusively for regex-inverse rules (R28) so that
 * bypass text hidden in comments or strings cannot satisfy a pattern that should only
 * be satisfied by real executable code.
 *
 * Strip order (matters — each step removes text that could confuse the next):
 *   1. Excise here-string bodies (replace their interior with a placeholder so that
 *      bypass tokens like an idempotency-guard substring inside a @'...'@ literal
 *      can't satisfy R28).
 *   2. Strip PowerShell block comments: <# ... #>
 *   3. Strip non-here-string double-quoted strings (supports backtick-escaped chars).
 *   4. Strip non-here-string single-quoted strings (supports '' for embedded quote).
 *   5. Strip all remaining # comments (inline and full-line) to end of line.
 */
function buildNoCommentNoStringContent(content) {
    let s = content;

    // Step 1: replace here-string interiors with empty placeholder so their bodies
    // are invisible to subsequent passes.  Handles both @"..."@ and @'...'@.
    s = s.replace(/@("|')([\s\S]*?)\1@/g, (match, q) => `@${q}${q}@`);

    // Step 2: strip block comments (lazy multi-line).
    s = s.replace(/<#[\s\S]*?#>/g, ' ');

    // Step 3: strip double-quoted strings — supports backtick escapes (`` `" ``, `` `n ``, etc.)
    s = s.replace(/"(?:`.|[^"`\r\n])*"/g, '""');

    // Step 4: strip single-quoted strings — supports '' as embedded-quote escape.
    s = s.replace(/'(?:''|[^'\r\n])*'/g, "''");

    // Step 5: strip from # to end of line everywhere that remains.
    s = s.replace(/#[^\n]*/g, '');

    return s;
}

/**
 * Compute byte-index ranges in `content` that fall inside the body of a
 * `function NAME { ... }` declaration. Used by rules that scope to "script-only"
 * (e.g. R25): a regex match whose start index lies in any of these ranges is
 * inside a function body and is suppressed.
 *
 * Implementation: walk `content` char by char with a small state machine that
 *   1. tracks whether we're inside a string literal (single or double quoted)
 *      or a here-string body or a block / line comment, and
 *   2. on encountering the keyword `function` outside any string/comment,
 *      finds the next `{` at the current brace-depth and records [openIdx, closeIdx]
 *      for the matching close brace.
 *
 * Limitations (documented in README per-rule failure_modes):
 *   - Anonymous scriptblocks (e.g. `$sb = { $body = ... }`) are NOT treated as
 *     function bodies — those still match script-scope rules. This is an
 *     accepted limitation because anonymous scriptblocks are rarer than
 *     named-function declarations and the heuristic stays bounded.
 *   - Filter declarations (`filter Foo { ... }`) are not treated as function
 *     bodies. PowerShell uses `filter` rarely; if needed, a future rev can
 *     add the keyword to the scanner.
 *   - Nested functions inside functions: the outer range covers the inner one,
 *     so a match inside the inner is still inside a function body. Correct
 *     by inclusion (any function-body containment suppresses).
 *   - Heredoc / here-string bodies are skipped during the scan; opening tokens
 *     `@"` and `@'` are recognized.
 */
function computeFunctionBodyRanges(content) {
    const ranges = [];
    const len = content.length;
    let i = 0;

    // Skip helpers --------------------------------------------------------
    function skipLineComment(start) {
        let j = start;
        while (j < len && content[j] !== '\n') j++;
        return j;
    }
    function skipBlockComment(start) {
        let j = start + 2; // past <#
        while (j < len - 1) {
            if (content[j] === '#' && content[j + 1] === '>') return j + 2;
            j++;
        }
        return len;
    }
    function skipDoubleQuoted(start) {
        // Backtick is the PS escape character; any char following backtick is consumed.
        let j = start + 1;
        while (j < len) {
            const c = content[j];
            if (c === '`' && j + 1 < len) { j += 2; continue; }
            if (c === '"') return j + 1;
            j++;
        }
        return len;
    }
    function skipSingleQuoted(start) {
        // '' is the embedded-quote escape; otherwise any char until the closing '.
        let j = start + 1;
        while (j < len) {
            if (content[j] === "'") {
                if (content[j + 1] === "'") { j += 2; continue; }
                return j + 1;
            }
            j++;
        }
        return len;
    }
    function skipHereString(start, quote) {
        // Pattern: @"..."@   or   @'...'@
        // Body terminates at \n followed by optional whitespace? Actually canonical
        // here-string termination is the closing token at the start of a line.
        // We use a simple "find next quote@" scan; close enough for brace tracking.
        let j = start + 2;
        const close = quote + '@';
        while (j < len - 1) {
            if (content[j] === quote && content[j + 1] === '@') return j + 2;
            j++;
        }
        return len;
    }

    // Find a candidate `function` keyword.  We require that the previous
    // non-whitespace char is one of: start-of-file, ';', '{', '}', '\n', ')'
    // — i.e. statement-start contexts.  Otherwise the literal `function` could
    // be inside an identifier or a string we already skipped.
    function isStatementStart(idx) {
        let k = idx - 1;
        while (k >= 0 && (content[k] === ' ' || content[k] === '\t')) k--;
        if (k < 0) return true;
        const c = content[k];
        return c === '\n' || c === ';' || c === '{' || c === '}' || c === '\r';
    }
    // Match keyword `function` (case-insensitive) at position i with a word-boundary.
    function matchesFunctionKeyword(idx) {
        if (idx + 8 > len) return false;
        const slice = content.substring(idx, idx + 8);
        if (!/^function$/i.test(slice)) return false;
        const next = content[idx + 8];
        // Word-boundary: next char must not be alphanumeric or _ or -.
        return next === undefined || /[\s({]/.test(next);
    }

    while (i < len) {
        const c = content[i];

        // Comments / strings outside of function-body detection.
        if (c === '<' && content[i + 1] === '#') { i = skipBlockComment(i); continue; }
        if (c === '#') { i = skipLineComment(i); continue; }
        if (c === '@' && (content[i + 1] === '"' || content[i + 1] === "'")) {
            i = skipHereString(i, content[i + 1]);
            continue;
        }
        if (c === '"') { i = skipDoubleQuoted(i); continue; }
        if (c === "'") { i = skipSingleQuoted(i); continue; }

        if (matchesFunctionKeyword(i) && isStatementStart(i)) {
            // Find the next `{` that opens the function body, skipping strings/comments
            // and balanced parentheses (the optional [CmdletBinding()][param(...)] etc.).
            let j = i + 8;
            let parenDepth = 0;
            let bracketDepth = 0;
            let openBrace = -1;
            while (j < len) {
                const cc = content[j];
                if (cc === '<' && content[j + 1] === '#') { j = skipBlockComment(j); continue; }
                if (cc === '#') { j = skipLineComment(j); continue; }
                if (cc === '@' && (content[j + 1] === '"' || content[j + 1] === "'")) {
                    j = skipHereString(j, content[j + 1]); continue;
                }
                if (cc === '"') { j = skipDoubleQuoted(j); continue; }
                if (cc === "'") { j = skipSingleQuoted(j); continue; }
                if (cc === '(') { parenDepth++; j++; continue; }
                if (cc === ')') { parenDepth--; j++; continue; }
                if (cc === '[') { bracketDepth++; j++; continue; }
                if (cc === ']') { bracketDepth--; j++; continue; }
                if (cc === '{' && parenDepth === 0 && bracketDepth === 0) { openBrace = j; break; }
                j++;
            }
            if (openBrace < 0) { i++; continue; }

            // Walk forward to find the matching `}`. Increment depth on `{`, decrement on `}`.
            let depth = 1;
            let k = openBrace + 1;
            while (k < len && depth > 0) {
                const cc = content[k];
                if (cc === '<' && content[k + 1] === '#') { k = skipBlockComment(k); continue; }
                if (cc === '#') { k = skipLineComment(k); continue; }
                if (cc === '@' && (content[k + 1] === '"' || content[k + 1] === "'")) {
                    k = skipHereString(k, content[k + 1]); continue;
                }
                if (cc === '"') { k = skipDoubleQuoted(k); continue; }
                if (cc === "'") { k = skipSingleQuoted(k); continue; }
                if (cc === '{') { depth++; k++; continue; }
                if (cc === '}') { depth--; k++; if (depth === 0) break; continue; }
                k++;
            }
            // Range covers the body interior [openBrace+1, k-1] inclusive.
            // We record [openBrace, k] (half-open) so a match index strictly between
            // openBrace and k is inside the function body.
            ranges.push([openBrace, k]);
            i = openBrace + 1; // continue scanning inside; nested functions also recorded
            continue;
        }

        i++;
    }

    return ranges;
}

function isInsideAnyRange(idx, ranges) {
    for (const [start, end] of ranges) {
        if (idx > start && idx < end) return true;
    }
    return false;
}

function extract(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const strippedContent = stripComments(content);
    const noCommentNoStringContent = buildNoCommentNoStringContent(content);
    // v0.4.1: third content view. rawContent with `<# ... #>` ranges
    // length-preservingly space-filled. Used by validator for `requires_absent`
    // guard checks so that a `#Requires` lexeme inside a block comment is
    // NOT treated as an active guard (matching PS parser behavior). See
    // stripBlockComments() docstring for substrate citations and rationale.
    const rawContentNoBlockComments = stripBlockComments(content);
    // v0.4.4: fourth content view. strippedContent with PowerShell `+`-based
    // string concatenation across line boundaries collapsed into single lines.
    // Rules opt in via content_view: "joinPlusContent" in their registry entry.
    // See buildJoinPlusContent() docstring for rationale and edge-case handling.
    const joinPlusContent = buildJoinPlusContent(strippedContent);
    // Compute function-body ranges against rawContent. stripComments now preserves
    // length (replaces matched chars with spaces so newlines and offsets align), so
    // ranges computed against rawContent are valid for matches whose index is
    // produced from strippedContent. The function-body scanner needs to see block
    // comment delimiters (<# ... #>) intact, which only rawContent provides --
    // strippedContent blanks the `#>` close because it matches `^\s*#.*$`.
    const functionBodyRanges = computeFunctionBodyRanges(content);
    
    const optionSetsMatch = content.match(/\$optionSets\s*=\s*@\(([\s\S]*?)\)/);
    let optionSets = [];
    if (optionSetsMatch) {
        const items = optionSetsMatch[1].split(",").map(s => s.trim().replace(/^"|"$|^'|'$/g, ""));
        optionSets = items.filter(i => i.length > 0);
    }

    const payloads = [];
    const parseErrors = [];
    
    // Match both @"..."@ and @'...'@
    const payloadRegex = /@("|')([\s\S]*?)\1@/g;
    let match;
    while ((match = payloadRegex.exec(content)) !== null) {
        const quoteType = match[1];
        const jsonStr = match[2].trim();
        
        try {
            const parsed = JSON.parse(jsonStr);
            payloads.push(parsed);
        } catch (e) {
            let msg = `JSON parse error: ${e.message}`;
            if (quoteType === '"' && (jsonStr.includes('$(') || jsonStr.match(/(?<!`)\$\w+/))) {
                msg = `JSON parse error: Payload contains PowerShell variable interpolation which invalidates JSON structure.`;
            }
            parseErrors.push({
                rule: "extractor-json-error",
                message: msg,
                details: jsonStr.substring(0, 80).replace(/\r?\n/g, ' ') + '...'
            });
        }
    }

    return { optionSets, payloads, parseErrors, rawContent: content, strippedContent, noCommentNoStringContent, rawContentNoBlockComments, joinPlusContent, functionBodyRanges, filePath };
}

module.exports = { extract, computeFunctionBodyRanges, isInsideAnyRange, stripBlockComments, buildJoinPlusContent };
