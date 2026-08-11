const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
const assetPath = path.join(root, 'assets', 'printer-network-watermark.png');

assert.equal(fs.existsSync(assetPath), true, 'ต้องมีไฟล์ลายน้ำ PNG');
const png = fs.readFileSync(assetPath);
assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(png[25], 6, 'PNG ต้องเป็นชนิด RGBA ที่มี alpha channel');
assert.match(html, /printer-network-watermark\.png/);
assert.match(html, /\.container\s*>\s*h1::before/);
assert.match(html, /pointer-events:\s*none/);
assert.match(html, /@media\s*\(max-width:\s*480px\)/);
assert.match(html, /@media\s*\(min-width:\s*1025px\)/);

console.log('header watermark contract tests passed');
