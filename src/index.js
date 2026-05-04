#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { extract } = require('./extractor');
const { validate } = require('./validator');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Dataverse Linter

Usage:
  dataverse-linter <path-to-script.ps1>

Options:
  --help, -h    Show help message
`);
  process.exit(0);
}

if (args.length === 0) {
  console.error('\x1b[31mError: No script path provided. Use --help for usage information.\x1b[0m');
  process.exit(1);
}

const targetPath = args[0];
const fullPath = path.resolve(targetPath);

if (!fs.existsSync(fullPath)) {
  console.error(`\x1b[31mError: File not found at ${fullPath}\x1b[0m`);
  process.exit(1);
}

console.log(`\x1b[36mLinting script:\x1b[0m ${targetPath}\n`);

try {
  const extractedData = extract(fullPath);
  const errors = validate(extractedData);

  if (errors.length > 0) {
    console.error(`\x1b[31mFound ${errors.length} violation(s):\x1b[0m\n`);
    errors.forEach((err, i) => {
      console.error(`\x1b[33m[${err.rule}]\x1b[0m ${err.message}`);
      console.error(`  \x1b[90mDetails: ${err.details}\x1b[0m\n`);
    });
    process.exit(1);
  } else {
    console.log('\x1b[32m✔ No violations found. Script is clean.\x1b[0m');
    process.exit(0);
  }
} catch (e) {
  console.error(`\x1b[31mError during linting: ${e.message}\x1b[0m`);
  process.exit(1);
}