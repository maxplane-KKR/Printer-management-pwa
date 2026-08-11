const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8');

assert.match(html, /data-api-url="\/api\/printers"/);
assert.doesNotMatch(html, /data-app-script-url/);
assert.doesNotMatch(html, /script\.google\.com\/macros\/s\//);
assert.match(html, /const apiUrl = document\.documentElement\.dataset\.apiUrl \|\| '\/api\/printers'/);
assert.match(html, /fetch\(apiUrl,\s*\{\s*method: 'GET'/s);
assert.match(html, /fetch\(apiUrl,\s*\{\s*method: 'POST'/s);
assert.doesNotMatch(html, /mode:\s*'no-cors'/);
assert.match(html, /cache:\s*'no-store'/);
assert.match(html, /if \(!response\.ok \|\| !result\?\.ok\)/);

console.log('frontend API contract tests passed');
