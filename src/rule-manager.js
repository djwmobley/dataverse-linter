const fs = require('fs');
const path = require('path');

const registryPath = path.join(__dirname, '../rules/registry.json');

function getRegistry() {
    if (fs.existsSync(registryPath)) {
        return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    }
    return [];
}

function saveRegistry(registry) {
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
    console.log("Dataverse Linter Rule Manager\n\nUsage:\n  node rule-manager.js template                               # Print rule templates (regex and regex-template)\n  node rule-manager.js ingest <file.json>                     # Ingest a rule definition file\n  node rule-manager.js list                                   # List all rules\n  node rule-manager.js delete <ruleId>                        # Delete a rule by ID\n  node rule-manager.js set-variables <ruleId> <v1> [<v2>...]  # Set variables on a regex-template rule\n");
    process.exit(0);
}

if (command === 'template') {
    const regexTemplate = {
        id: "RXX",
        title: "Example Regex Rule",
        severity: "ERROR",
        type: "regex",
        pattern: "example-pattern",
        message: "Example violation message.",
        enabled: true
    };
    const regexTemplateRule = {
        id: "RXX",
        title: "Example Regex-Template Rule",
        severity: "ERROR",
        type: "regex-template",
        pattern: "^\\s*\\$(${variables})\\s*=",
        variables: ["varname1", "varname2"],
        message: "Example regex-template violation message.",
        enabled: true
    };
    console.log("// regex rule template:");
    console.log(JSON.stringify(regexTemplate, null, 2));
    console.log("\n// regex-template rule template (variables are joined with | and substituted into ${variables}):");
    console.log(JSON.stringify(regexTemplateRule, null, 2));
    process.exit(0);
}

if (command === 'list') {
    const registry = getRegistry();
    console.table(registry.map(r => ({ ID: r.id, Title: r.title, Type: r.type, Enabled: r.enabled })));
    process.exit(0);
}

if (command === 'delete') {
    const id = args[1];
    if (!id) { console.error('Provide a rule ID'); process.exit(1); }
    let registry = getRegistry();
    const initialLen = registry.length;
    registry = registry.filter(r => r.id !== id);
    if (registry.length < initialLen) {
        saveRegistry(registry);
        console.log("Deleted rule " + id);
    } else {
        console.log("Rule " + id + " not found");
    }
    process.exit(0);
}

if (command === 'ingest') {
    const file = args[1];
    if (!file) { console.error('Provide a file to ingest'); process.exit(1); }
    const fullPath = path.resolve(file);
    if (!fs.existsSync(fullPath)) { console.error('File not found'); process.exit(1); }
    
    try {
        const input = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const rules = Array.isArray(input) ? input : [input];
        const registry = getRegistry();
        
        let added = 0;
        let updated = 0;
        
        rules.forEach(newRule => {
            if (!newRule.id || !newRule.type || !newRule.message) {
                console.error('Invalid rule definition skipped (missing id, type, or message)');
                return;
            }
            const existingIndex = registry.findIndex(r => r.id === newRule.id);
            if (existingIndex >= 0) {
                registry[existingIndex] = newRule;
                updated++;
            } else {
                registry.push(newRule);
                added++;
            }
        });
        
        saveRegistry(registry);
        console.log("Ingestion complete. Added: " + added + ", Updated: " + updated);
    } catch (e) {
        console.error('Error parsing or ingesting file:', e.message);
        process.exit(1);
    }
}

if (command === 'set-variables') {
    const ruleId = args[1];
    const variables = args.slice(2);
    if (!ruleId) { console.error('Provide a rule ID'); process.exit(1); }
    if (variables.length === 0) { console.error('Provide at least one variable name'); process.exit(1); }
    const registry = getRegistry();
    const idx = registry.findIndex(r => r.id === ruleId);
    if (idx < 0) { console.error('Rule ' + ruleId + ' not found'); process.exit(1); }
    const rule = registry[idx];
    if (rule.type !== 'regex-template') {
        console.error('Rule ' + ruleId + ' is type "' + rule.type + '", not "regex-template". set-variables only applies to regex-template rules.');
        process.exit(1);
    }
    registry[idx].variables = variables;
    saveRegistry(registry);
    console.log('Updated ' + ruleId + ' variables: ' + variables.join(', '));
    process.exit(0);
}
