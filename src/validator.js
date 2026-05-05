const fs = require("fs");
const path = require("path");

function validate(extraction) {
    const { optionSets, payloads, parseErrors, rawContent, strippedContent, noCommentNoStringContent, functionBodyRanges, filePath } = extraction;
    const errors = [...(parseErrors || [])];

    // Helper: returns true if `idx` lies strictly inside any [start, end) range.
    // Used by rules with scope: "script-only" to skip matches that occur inside
    // a `function NAME { ... }` body.
    function isInsideFunctionBody(idx) {
        if (!functionBodyRanges || functionBodyRanges.length === 0) return false;
        for (const r of functionBodyRanges) {
            if (idx > r[0] && idx < r[1]) return true;
        }
        return false;
    }

    const overridesPath = path.join(__dirname, "../rules/overrides.json");
    let overrides = {};
    if (fs.existsSync(overridesPath)) { overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8")); }

    const registryPath = path.join(__dirname, "../rules/registry.json");
    let registry = [];
    if (fs.existsSync(registryPath)) { registry = JSON.parse(fs.readFileSync(registryPath, "utf8")); }

    let schema = null;
    const schemaPath = path.join(__dirname, "../rules/schema.json");
    if (fs.existsSync(schemaPath)) { schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")); }

    // systemEntities: hardcoded curated list of built-in Dataverse entities for which
    // Cascade=Cascade on relationships is high-risk. NOT driven by schema.json — schema
    // linkage is a separate rule (schema-entity-not-found). Keep this list in sync with
    // commonly-used built-in CE entities.
    const systemEntities = [
        "systemuser", "businessunit", "team", "organization", "transactioncurrency",
        "position", "queue", "account", "contact", "lead", "opportunity", "role",
        "email", "task", "appointment", "phonecall", "incident"
    ];

    // Normalize PowerShell line continuations (backtick followed by newline) for easier regex matching.
    const normalizedContent = strippedContent.replace(/`\s*\r?\n/g, ' ');

    // Evaluate dynamic rules from registry
    registry.forEach(rule => {
        if (!rule.enabled) return;

        // regex-inverse rules must use the comment- and string-stripped derivation so
        // that bypass text hidden in comments or string literals cannot satisfy them.
        // regex rules (R24, R21) use normalized content; all other regex rules use strippedContent.
        let targetContent;
        if (rule.type === "regex-inverse") {
            targetContent = noCommentNoStringContent;
        } else if (rule.id === "R24" || rule.id === "R21") {
            targetContent = normalizedContent;
        } else {
            targetContent = strippedContent;
        }

        // requires_absent (regex / regex-template only): a conjunction guard.
        // The rule fires only when the main pattern matches AND the
        // requires_absent regex does NOT match the rawContent. requires_absent
        // is matched against rawContent so that #Requires comment directives
        // (which strippedContent removes) remain visible to the guard check.
        let requiresAbsentSatisfied = true;
        if (rule.requires_absent) {
            const guardRe = new RegExp(rule.requires_absent, "m");
            // If the guard pattern IS present, the requires_absent condition is
            // NOT satisfied -- meaning the rule should NOT fire (guard in place).
            if (guardRe.test(rawContent)) {
                requiresAbsentSatisfied = false;
            }
        }

        if (rule.type === "regex" && rule.pattern) {
            if (!requiresAbsentSatisfied) return; // guard present -> rule suppressed
            const regex = new RegExp(rule.pattern, "gm");
            let match;
            while ((match = regex.exec(targetContent)) !== null) {
                if (rule.scope === "script-only" && isInsideFunctionBody(match.index)) continue;
                // Find line number roughly in the original strippedContent
                const lines = strippedContent.substring(0, match.index).split('\n');
                errors.push({
                    rule: rule.id,
                    message: rule.message,
                    details: "Matched pattern near line " + lines.length
                });
            }
        }

        if (rule.type === "regex-template" && rule.pattern) {
            if (!requiresAbsentSatisfied) return; // guard present -> rule suppressed
            if (!rule.variables || rule.variables.length === 0) {
                process.stderr.write(`[validator] regex-template rule ${rule.id} has no variables; skipping\n`);
            } else {
                // Use split/join to avoid $1-style substitution issues from String.replace
                const resolvedPattern = rule.pattern.split('${variables}').join(rule.variables.join('|'));
                const regex = new RegExp(resolvedPattern, "gm");
                let match;
                while ((match = regex.exec(targetContent)) !== null) {
                    if (rule.scope === "script-only" && isInsideFunctionBody(match.index)) continue;
                    const lines = strippedContent.substring(0, match.index).split('\n');
                    errors.push({
                        rule: rule.id,
                        message: rule.message,
                        details: "Matched pattern near line " + lines.length
                    });
                }
            }
        }

        if (rule.type === "regex-inverse" && rule.pattern) {
            const regex = new RegExp(rule.pattern, "gm");
            if (!regex.test(targetContent)) {
                errors.push({
                    rule: rule.id,
                    message: rule.message,
                    details: "File missing required pattern: " + rule.pattern
                });
            }
        }
    });

    // Module-environment compatibility check
    const moduleReqsPath = path.join(__dirname, "../rules/module-requirements.json");
    let moduleReqs = [];
    if (fs.existsSync(moduleReqsPath)) {
        moduleReqs = JSON.parse(fs.readFileSync(moduleReqsPath, "utf8"));
    }

    moduleReqs.forEach(req => {
        if (!req.import_pattern || !req.requires_directives || req.requires_directives.length === 0) return;
        const importRegex = new RegExp(req.import_pattern, "gm");
        if (importRegex.test(strippedContent)) {
            // Module is imported. Verify all required directives are present in rawContent.
            // rawContent is used for the directive check: #Requires directives are comments
            // and would be stripped by stripComments(), so we must check rawContent here.
            const missing = req.requires_directives.filter(directive => {
                const escaped = directive.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const directiveRegex = new RegExp("^" + escaped, "m");
                return !directiveRegex.test(rawContent);
            });
            if (missing.length > 0) {
                errors.push({
                    rule: req.rule_id,
                    message: req.message,
                    details: `Module '${req.module}' imported but missing required directive(s): ${missing.join(', ')}`
                });
            }
        }
    });

    payloads.forEach((payload, index) => {
        function traverse(obj) {
            if (typeof obj === "object" && obj !== null) {
                for (const key in obj) {
                    if (Object.hasOwnProperty.call(obj, key)) {
                        const value = obj[key];
                        if (key.endsWith("@odata.bind") && typeof value === "string") {
                            if (value.match(/\w+='[^']+'/)) {
                                errors.push({
                                    rule: "odata-bind-guid",
                                    message: overrides["odata-bind-guid"] ? overrides["odata-bind-guid"].message : "Invalid bind",
                                    details: `Found invalid bind in payload ${index}: ${key} = ${value}`
                                });
                            }
                            const optionSetMatch = value.match(/\/GlobalOptionSetDefinitions\(Name='([^']+)'\)/);
                            if (optionSetMatch) {
                                const optionSetName = optionSetMatch[1];
                                if (!optionSets.includes(optionSetName)) {
                                    errors.push({
                                        rule: "optionset-coverage",
                                        message: overrides["optionset-coverage"] ? overrides["optionset-coverage"].message : "Missing optionset",
                                        details: `Option set '${optionSetName}' referenced in payload ${index} is missing from $optionSets array.`
                                    });
                                }
                            }
                        }
                        traverse(value);
                    }
                }
            }
        }

        traverse(payload);

        if (payload.ReferencedEntity && systemEntities.includes(payload.ReferencedEntity.toLowerCase())) {
            if (payload.CascadeConfiguration && payload.CascadeConfiguration.Assign !== "NoCascade") {
                errors.push({
                    rule: "system-entity-cascade",
                    message: overrides["system-entity-cascade"] ? overrides["system-entity-cascade"].message : "Invalid cascade",
                    details: `Payload ${index} references ${payload.ReferencedEntity} with Assign=${payload.CascadeConfiguration.Assign}`
                });
            }
        }

        if (schema && schema.entities) {
            const entityNames = schema.entities.map(e => e.name.toLowerCase());
            if (payload.ReferencedEntity && !entityNames.includes(payload.ReferencedEntity.toLowerCase())) {
                errors.push({
                    rule: "schema-entity-not-found",
                    message: "Entity not found in schema",
                    details: `ReferencedEntity '${payload.ReferencedEntity}' in payload ${index} does not exist in Dataverse schema.`
                });
            }
            if (payload.ReferencingEntity && !entityNames.includes(payload.ReferencingEntity.toLowerCase())) {
                errors.push({
                    rule: "schema-entity-not-found",
                    message: "Entity not found in schema",
                    details: `ReferencingEntity '${payload.ReferencingEntity}' in payload ${index} does not exist in Dataverse schema.`
                });
            }
        }
    });

    return errors;
}

module.exports = { validate };
