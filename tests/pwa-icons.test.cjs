const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const expectedPngs = new Map([
  ['assets/icons/icon-master-1024.png', [1024, 1024]],
  ['assets/icons/icon-192.png', [192, 192]],
  ['assets/icons/icon-512.png', [512, 512]],
  ['assets/icons/icon-maskable-192-v2.png', [192, 192]],
  ['assets/icons/icon-maskable-512-v2.png', [512, 512]],
  ['assets/icons/apple-touch-icon.png', [180, 180]],
  ['assets/icons/favicon-16x16.png', [16, 16]],
  ['assets/icons/favicon-32x32.png', [32, 32]],
  ['assets/icons/mstile-150x150.png', [150, 150]]
]);

function readPngSize(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG', file + ' ต้องเป็น PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

for (const [file, size] of expectedPngs) {
  assert.deepEqual(readPngSize(file), size, file + ' มีขนาดไม่ถูกต้อง');
}

for (const file of ['assets/icons/favicon.ico', 'assets/icons/safari-pinned-tab.svg']) {
  const stats = fs.statSync(path.join(root, file));
  assert.ok(stats.size > 0, file + ' ต้องไม่เป็นไฟล์ว่าง');
}

assert.equal(
  fs.readFileSync(path.join(root, 'requirements-icons.txt'), 'utf8').trim(),
  'Pillow==12.2.0',
  'dependency สำหรับสร้างไอคอนต้อง pin เวอร์ชันเพื่อให้สร้างซ้ำได้'
);

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
}

assert.notEqual(
  sha256('assets/icons/icon-192.png'),
  sha256('assets/icons/icon-maskable-192-v2.png'),
  'maskable icon ต้องเป็น safe-zone variant ไม่ใช่ไฟล์เดียวกับไอคอนปกติ'
);

const pinnedTab = fs.readFileSync(path.join(root, 'assets/icons/safari-pinned-tab.svg'), 'utf8');
assert.match(pinnedTab, /viewBox="0 0 512 512"/);
assert.doesNotMatch(pinnedTab, /#[0-9a-f]{6}/i, 'Safari pinned tab ต้องใช้สีเดียวจาก currentColor');

console.log('pwa icon asset tests passed');
