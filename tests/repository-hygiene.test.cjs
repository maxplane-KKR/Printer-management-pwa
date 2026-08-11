const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

for (const entry of ['.vercel/', '.env', '.env.*', 'node_modules/', '*.log']) {
  assert.ok(
    gitignore.split(/\r?\n/).includes(entry),
    '.gitignore ต้องป้องกัน ' + entry
  );
}

const sourceFiles = [
  'Index.html',
  'manifest.webmanifest',
  'service-worker.js',
  'vercel.json',
  'api/printers.js'
];
for (const file of sourceFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.doesNotMatch(source, /https:\/\/script\.google\.com\/macros\/s\//);
  assert.doesNotMatch(source, /(?:ghp_|github_pat_|VERCEL_TOKEN=)/);
}

console.log('repository hygiene tests passed');
