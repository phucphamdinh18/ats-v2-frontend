const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1].trim())
  .filter(Boolean);

assert.ok(inlineScripts.length > 0, 'Expected at least one inline script');
for (const source of inlineScripts) new vm.Script(source);
console.log(`Inline script syntax OK: ${inlineScripts.length}`);
