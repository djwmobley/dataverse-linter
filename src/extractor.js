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
    // v0.7.2: fourth content view. rawContent with BOTH `<# ... #>` block-comment
    // ranges AND full-line `#` comments length-preservingly space-filled, while keeping
    // string literals intact. Used by R45 (and any future rule that specifies
    // content_view: "strippedNoBlockComments") so that neither comment type can
    // produce false positives while the rule still fires on executable code.
    //
    // Why this composed view is necessary:
    //   - strippedContent strips only line comments (^\s*#.*$); a block-comment body
    //     containing "(if" / "(foreach" etc. (e.g. doc-comment prose) would still match
    //     R45's pattern, producing a false positive.
    //   - rawContentNoBlockComments strips only block comments; it retains line comments,
    //     so "(if ..." in a line comment would fire -- regressing the suppression that
    //     was already in place via strippedContent.
    //   - Composing the two length-preserving transforms gives a view where both comment
    //     types are blanked while string literals remain, matching exactly what R45 needs.
    //
    // COMPOSITION ORDER IS CRITICAL -- stripBlockComments MUST run on rawContent (not
    // on strippedContent). Reason: stripComments (the line-comment stripper) uses the
    // pattern `^\s*#.*$` which matches any line starting with `#` -- including the `#>`
    // block-comment close token on its own line. If stripComments runs first (as when
    // composing stripBlockComments(strippedContent)), the `#>` close is erased and
    // stripBlockComments finds no matching close token, so the non-greedy
    // `/<#[\s\S]*?#>/g` pattern never fires and the block body is NOT blanked.
    // Running stripBlockComments first (on rawContent where `#>` is intact) correctly
    // blanks the body; then stripComments on the result removes line-comment `#` lines
    // that survived (including any `#>` or `<#` lines that were not part of a block pair).
    //
    // Length-preservation invariant: both stripComments and stripBlockComments replace
    // matched characters with spaces (newlines preserved). Composing them keeps byte-offset
    // alignment with rawContent, so match-index->line-number reporting in the validator
    // remains correct.
    //
    // Substrate citation for block-comment bodies being inert executable content:
    //   https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_comments
    //   "All text within the block is treated as part of the same comment" -- keywords
    //   appearing inside <# ... #> are comment text, not executable statements, so R45
    //   must not fire on them.
    const strippedNoBlockComments = stripComments(stripBlockComments(content));
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
    // Per about_Quoting_Rules (https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_quoting_rules):
    // here-strings hold arbitrary literal text and are NOT necessarily JSON.
    // Only attempt JSON.parse when the trimmed body is JSON-shaped (starts with { or [).
    // Prose here-strings (e.g. module descriptions, multi-line messages) are silently skipped.
    const payloadRegex = /@("|')([\s\S]*?)\1@/g;
    let match;
    while ((match = payloadRegex.exec(content)) !== null) {
        const quoteType = match[1];
        const jsonStr = match[2].trim();

        // Skip non-JSON-shaped here-strings (prose, empty, or whitespace-only bodies).
        // A JSON-shaped here-string must begin with { (object) or [ (array).
        if (jsonStr.length === 0 || (jsonStr[0] !== '{' && jsonStr[0] !== '[')) {
            continue;
        }

        // Additional guard for '['-opening bodies: a C# here-string body such as
        //   [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        //   public static extern bool SetDllDirectory(string lpPathName);
        // trims to '[DllImport...' and would otherwise reach JSON.parse.
        //
        // In a valid JSON array the first non-whitespace char after '[' is one of:
        //   " (string element), { (object element), [ (nested array), 0-9 (number),
        //   ] (empty array close), t/f/n (true/false/null literals).
        //
        // A C# attribute starts with an uppercase or lowercase letter that is NOT
        // one of the above (e.g. 'D' in DllImport, 'S' in StructLayout, 'O' in Out).
        //
        // Known limitation: a '[t...]', '[f...]', or '[n...]' C# attribute (highly
        // unlikely in practice) would pass this guard and fail JSON.parse cleanly --
        // no change to the error path, just one extra JSON.parse call.
        if (jsonStr[0] === '[') {
            const afterBracket = jsonStr.slice(1).trimStart();
            if (afterBracket.length === 0) {
                // '[' followed only by whitespace -- not a valid JSON array
                continue;
            }
            // JSON array element-start chars (RFC 8259 value productions)
            if (!/^["{\[0-9\]tfn]/.test(afterBracket[0])) {
                continue;
            }
        }

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

    return { optionSets, payloads, parseErrors, rawContent: content, strippedContent, noCommentNoStringContent, rawContentNoBlockComments, strippedNoBlockComments, functionBodyRanges, filePath };
}

module.exports = { extract, computeFunctionBodyRanges, isInsideAnyRange, stripBlockComments };
