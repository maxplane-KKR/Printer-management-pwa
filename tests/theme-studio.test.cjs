const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8');

assert.match(html, /id="theme-studio"/, 'ต้องมี Theme Studio panel');
assert.match(html, /id="theme-mode-toggle"/, 'ต้องมีปุ่มสลับโหมด');
assert.match(html, /id="theme-toggle-btn"/, 'ต้องมีปุ่มสลับธีม');
assert.match(html, /id="theme-studio-header-btn"/, 'ต้องมีปุ่มเปิด Theme Studio ใน header/mobile view');
assert.equal((html.match(/data-theme-studio-open="true"/g) || []).length, 1, 'ต้องมี trigger เปิด Theme Studio เพียงจุดเดียวใน header');
assert.doesNotMatch(html, /id="theme-studio-open-btn"/, 'การ์ดเครื่องมือไม่ควรมีปุ่มธีมซ้ำกับ header');
assert.match(html, /\.sheet-sync-indicator\s*\{\s*right:\s*14px !important;/, 'ข้อความสถานะต้องชิดมุมขวาของ header ทุก format');
assert.doesNotMatch(html, /เพิ่มเครื่องพิมพ์ใหม่ \(Add New Printer\)/, 'หัวข้อฟอร์ม compact ไม่ควรพ่วงข้อความภาษาอังกฤษ');
assert.match(html, /class="theme-mode-icon(?:\s|\")/, 'สวิตช์ธีมต้องใช้ไอคอนแบบกระชับ');
assert.match(html, /aria-label="สลับเป็นโหมดสว่าง"/, 'ปุ่มธีมต้องมี accessible label');
assert.match(html, /data-theme-storage-key="printerThemeSettings"/, 'ต้องระบุ storage key ของธีม');
assert.match(html, /aria-label="สลับโหมดพื้นผิว"/, 'toggle ต้องมี accessible label');
assert.match(html, /function normalizeThemeState\(/, 'ต้องมีตัว normalize theme state');
assert.match(html, /function applyThemeState\(/, 'ต้องมีตัว apply theme state');
assert.match(html, /const COMPACT_MIN_ROWS = 4/, 'compact list ต้องประกาศขั้นต่ำ 4 แถว');
assert.match(html, /Math\.max\(COMPACT_MIN_ROWS/, 'compact pagination ต้องบังคับขั้นต่ำ 4 แถว');
assert.match(html, /body\[data-surface="light"\]/, 'ต้องมี Light Glass surface');
assert.match(html, /body\[data-surface="dark"\]/, 'ต้องมี Dark Glass surface');
assert.match(html, /@media \(max-width: 1024px\)/, 'theme/layout ต้องครอบคลุม compact breakpoint');
assert.match(html, /overflow-x:\s*(hidden|clip)/, 'หน้าแอปต้องป้องกัน horizontal overflow');
assert.match(html, /localStorage\.getItem\(themeStorageKey\)/, 'ต้องอ่าน theme จาก localStorage');
assert.match(html, /localStorage\.setItem\(themeStorageKey/, 'ต้องบันทึก theme ลง localStorage');
for (const preset of ['mint', 'neon', 'rose', 'sunset', 'netflix', 'luxury']) {
  assert.match(html, new RegExp(`data-preset="${preset}"`), `ต้องมี preset ${preset}`);
}
assert.match(html, /id="theme-opacity"[^>]+min="40"[^>]+max="100"/, 'opacity ต้อง clamp 40-100');
assert.match(html, /id="theme-blur"[^>]+min="0"[^>]+max="30"/, 'blur ต้อง clamp 0-30');
assert.match(html, /id="theme-reset-btn"/, 'ต้องมีปุ่มคืนค่าเริ่มต้น');
assert.match(html, /prefers-reduced-motion/, 'ต้องรองรับ reduced motion');

const normalizeMatch = html.match(
  /function normalizeThemeState\(input = \{\}\)\s*\{([\s\S]*?)\n\s*\}\s*\/\/ theme-state-end/
);
assert.ok(normalizeMatch, 'ต้องมีขอบเขต pure normalizeThemeState สำหรับตรวจ state');
const normalizeThemeState = new Function('input', normalizeMatch[1]);

assert.deepEqual(normalizeThemeState({}), {
  preset: 'netflix',
  surface: 'dark',
  opacity: 88,
  blur: 12,
  customImage: null
});
assert.deepEqual(normalizeThemeState({ surface: 'light', opacity: 999, blur: -4 }), {
  preset: 'netflix',
  surface: 'light',
  opacity: 100,
  blur: 0,
  customImage: null
});

console.log('theme studio contract tests passed');
