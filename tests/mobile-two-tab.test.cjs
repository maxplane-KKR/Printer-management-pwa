const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8');

assert.doesNotMatch(html, /id=["']printer-mac["']/i, 'ต้องไม่มีช่อง MAC ในฟอร์ม');
assert.doesNotMatch(html, /printer\.mac|\bp\.mac|\bmac:\s*p\.mac|IP\s*&\s*MAC/i, 'client runtime ต้องไม่ใช้ MAC');
assert.doesNotMatch(html, /Name,IP,MAC/i, 'CSV ต้องไม่มี MAC');

const tabbar = html.match(/<nav class="mobile-tabbar"[\s\S]*?<\/nav>/);
assert.ok(tabbar, 'ต้องมี compact navigation');
assert.equal((tabbar[0].match(/class="mobile-tab"/g) || []).length, 2, 'compact navigation ต้องมี 2 แท็บ');
assert.match(tabbar[0], /data-mobile-view="manage"[\s\S]*>จัดการ</);
assert.match(tabbar[0], /data-mobile-view="list"[\s\S]*>รายการ</);

assert.match(html, /const mobileViewNames = \['manage', 'list'\]/, 'view state ต้องมีเฉพาะ manage/list');
assert.match(html, /body\[data-mobile-view="manage"\]\s+#mobile-manage/, 'manage view ต้องเป็น panel เดียว');
assert.match(html, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/, 'tabbar ต้องแบ่ง 2 คอลัมน์เท่ากัน');
assert.match(html, /height:\s*(?:var\(--app-height\)|100dvh)/, 'compact app shell ต้องล็อกความสูงตาม viewport');
assert.match(html, /body\s*\{[^}]*overflow:\s*hidden/s, 'compact page ต้องไม่เกิด page scroll');
assert.match(html, /function getActiveRowsPerPage\(\)/, 'compact list ต้องมี adaptive page size');
assert.match(html, /visualViewport/, 'layout ต้องตอบสนอง visual viewport');
assert.match(html, /closest\(swipeControlSelector\)/, 'swipe ต้องไม่เริ่มจาก interactive control');

console.log('mobile two-tab contract tests passed');
