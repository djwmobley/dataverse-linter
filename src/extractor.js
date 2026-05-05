const fs = require("fs");

function stripComments(content) {
    // Simple heuristic to strip PowerShell full-line comments to avoid regex-inverse bypasses.
    return content.replace(/^\s*#.*$/gm, '');
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

function extract(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const strippedContent = stripComments(content);
    const noCommentNoStringContent = buildNoCommentNoStringContent(content);
    
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

    return { optionSets, payloads, parseErrors, rawContent: content, strippedContent, noCommentNoStringContent, filePath };
}

module.exports = { extract };
