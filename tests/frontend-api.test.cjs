const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const apiSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'printers-api.ts'), 'utf8');

assert.match(apiSource, /url = '\/api\/printers'/);
assert.doesNotMatch(apiSource, /script\.google\.com\/macros\/s\//);
assert.doesNotMatch(apiSource, /API_SHARED_SECRET/);
assert.match(apiSource, /method: 'GET'/);
assert.match(apiSource, /method: 'POST'/);
assert.match(apiSource, /cache: 'no-store'/);
assert.match(apiSource, /!response\.ok \|\| result\?\.ok !== true/);

console.log('frontend API contract tests passed');
