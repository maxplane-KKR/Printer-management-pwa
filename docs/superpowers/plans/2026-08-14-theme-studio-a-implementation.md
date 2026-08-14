# Theme Studio แนวทาง A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: ใช้ `superpowers:executing-plans` หรือทำตามแผนนี้แบบ inline ทีละ task พร้อม checkpoint ทุก task

**Goal:** เพิ่ม Theme Studio แนวทาง A ให้ Printer Management Pro รองรับ preset, Dark/Light Glass, opacity/blur persistence และ responsive list ที่เห็นอย่างน้อย 4 รายการบนมือถือ โดยไม่กระทบการ sync ชีตเดิม

**Architecture:** คงสถาปัตยกรรม vanilla HTML/CSS/JS ใน `Index.html` ไม่เพิ่ม framework หรือ dependency แยก theme state ออกจาก printer state ด้วย `themeState` และใช้ CSS custom properties บน `body[data-surface]` เป็นแหล่งแสดงผลเดียว Theme Studio เปิดจากปุ่มเครื่องมือ/ปุ่มสลับโหมด และบันทึกเฉพาะ primitive ที่ validate แล้วใน localStorage

**Tech Stack:** `Index.html` (inline CSS/JavaScript), Node.js built-in `assert` contract tests, Chrome responsive viewport verification

## Global Constraints

- Breakpoint หลักคงที่ที่ `1025px`: ต่ำกว่าหรือเท่ากับ 1024px ใช้ compact/mobile layout
- ค่า default: `Netflix + Dark Glass + opacity 88% + blur 12px`
- Preset ต้องมี `Mint`, `Neon`, `Rose`, `Sunset`, `Netflix`, `Luxury`
- Opacity ต้อง clamp ช่วง `40–100` และ blur clamp ช่วง `0–30px`
- ปุ่ม Dark/Light ต้องมี `aria-pressed`, focus-visible และ touch target อย่างน้อย `44px`
- หน้า list บน compact layout ต้องคำนวณให้แสดงอย่างน้อย 4 รายการเมื่อข้อมูลมี 4 รายการขึ้นไป
- ห้ามเพิ่มการเรียก API หรือแก้ schema/ข้อมูลชีตจากการเปลี่ยนธีม
- ห้ามนำช่อง Mac Address หรือปุ่ม Backup/Restore กลับเข้า layout
- ต้องคง watermark header, เมนู 2 แท็บ และไม่มี horizontal overflow

---

### Task 1: สร้าง contract test ของ Theme Studio และ compact list

**Files:**
- Create: `tests/theme-studio.test.cjs`
- Reference: `Index.html` (ยังไม่แก้ใน task นี้)

**Interfaces:**
- Consumes: HTML/JS public seams ใน `Index.html`
- Produces: สัญญาที่ตรวจได้สำหรับ controls, default state, state normalization, persistence hooks และ minimum compact rows

- [ ] **Step 1: Write the failing test**

เพิ่ม assertion ให้ทดสอบสิ่งต่อไปนี้จาก HTML:

```js
assert.match(html, /id="theme-studio"/);
assert.match(html, /id="theme-mode-toggle"/);
assert.match(html, /id="theme-dark-btn"/);
assert.match(html, /id="theme-light-btn"/);
assert.match(html, /data-theme-storage-key="printerThemeSettings"/);
assert.match(html, /function normalizeThemeState\(/);
assert.match(html, /function applyThemeState\(/);
assert.match(html, /const COMPACT_MIN_ROWS = 4/);
assert.match(html, /Math\.max\(COMPACT_MIN_ROWS/);
assert.match(html, /@media \(max-width: 1024px\)/);
assert.match(html, /overflow-x:\s*(hidden|clip)/);
```

ดึง body ของ `normalizeThemeState` แบบเดียวกับ `responsive-layout.test.cjs` แล้วตรวจค่า known-good literal:

```js
const normalizeThemeState = new Function('input', `return (${body})(input);`);
assert.deepEqual(normalizeThemeState({}), {
  preset: 'netflix', surface: 'dark', opacity: 88, blur: 12, customImage: null
});
assert.equal(normalizeThemeState({ surface: 'light', opacity: 999, blur: -4 }).opacity, 100);
assert.equal(normalizeThemeState({ surface: 'light', opacity: 999, blur: -4 }).blur, 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/theme-studio.test.cjs`

Expected: FAIL เพราะ `Index.html` ยังไม่มี Theme Studio controls, state helpers และ `COMPACT_MIN_ROWS`

- [ ] **Step 3: Commit the red test**

```bash
git add tests/theme-studio.test.cjs
git commit -m "test: define theme studio contracts"
```

### Task 2: เพิ่ม theme state, Dark/Light toggle และ persistence

**Files:**
- Modify: `Index.html:135-750` (theme CSS overrides)
- Modify: `Index.html:760-940` (header/tools Theme Studio controls)
- Modify: `Index.html:2100-2940` (theme state and event handlers)
- Test: `tests/theme-studio.test.cjs`

**Interfaces:**
- Consumes: `body`, existing header/tools DOM, existing localStorage usage
- Produces: `themeState`, `normalizeThemeState(input)`, `applyThemeState(next)`, `loadThemeState()`, `saveThemeState()` และ DOM ids `theme-studio`, `theme-mode-toggle`, `theme-dark-btn`, `theme-light-btn`

- [ ] **Step 1: Write the failing behavior assertion**

เพิ่ม assertion ว่า Dark/Light control มี accessible labels และ style รองรับทั้ง surface:

```js
assert.match(html, /aria-label="สลับโหมดพื้นผิว"/);
assert.match(html, /data-surface="dark"/);
assert.match(html, /body\[data-surface="light"\]/);
assert.match(html, /localStorage\.getItem\(themeStorageKey\)/);
assert.match(html, /localStorage\.setItem\(themeStorageKey/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/theme-studio.test.cjs`

Expected: FAIL ที่ controls/state/persistence ยังไม่มี

- [ ] **Step 3: Implement minimal state and controls**

เพิ่ม Theme Studio panel ใน `#mobile-tools` พร้อม segmented toggle:

```html
<section id="theme-studio" data-theme-storage-key="printerThemeSettings">
  <div id="theme-mode-toggle" role="group" aria-label="สลับโหมดพื้นผิว">
    <button id="theme-dark-btn" type="button" data-surface="dark" aria-pressed="true">Dark</button>
    <button id="theme-light-btn" type="button" data-surface="light" aria-pressed="false">Light</button>
  </div>
</section>
```

เพิ่ม pure helpers ใน script เดิมโดยให้ function พึ่งพาเฉพาะ input และ literals ของ state:

```js
const themeDefaults = { preset: 'netflix', surface: 'dark', opacity: 88, blur: 12, customImage: null };
const themeStorageKey = 'printerThemeSettings';

function normalizeThemeState(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const presets = ['mint', 'neon', 'rose', 'sunset', 'netflix', 'luxury'];
  const preset = presets.includes(source.preset) ? source.preset : themeDefaults.preset;
  const surface = source.surface === 'light' ? 'light' : 'dark';
  const opacity = Math.min(100, Math.max(40, Number.isFinite(Number(source.opacity)) ? Number(source.opacity) : themeDefaults.opacity));
  const blur = Math.min(30, Math.max(0, Number.isFinite(Number(source.blur)) ? Number(source.blur) : themeDefaults.blur));
  return { preset, surface, opacity, blur, customImage: null };
}
```

`applyThemeState` ต้องตั้ง `body.dataset.surface`, CSS variables, `aria-pressed` และ label ของปุ่มโดยไม่เรียก `fetch`, `syncSheetNow` หรือแก้ `printers` จากนั้น bind click/input events และโหลด/บันทึก localStorage ผ่าน `loadThemeState`/`saveThemeState`

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/theme-studio.test.cjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add Index.html tests/theme-studio.test.cjs
git commit -m "feat: add theme studio dark light controls"
```

### Task 3: เพิ่ม preset, opacity/blur controls และ Light Glass contrast

**Files:**
- Modify: `Index.html:135-750` (theme CSS)
- Modify: `Index.html:800-850` (Theme Studio controls)
- Modify: `Index.html:2100-2940` (input binding)
- Test: `tests/theme-studio.test.cjs`

**Interfaces:**
- Consumes: `themeState`, `applyThemeState`, `saveThemeState`
- Produces: preset swatches, range inputs `theme-opacity`/`theme-blur`, reset button และ Light Glass text/background contrast

- [ ] **Step 1: Write the failing test**

```js
for (const preset of ['mint', 'neon', 'rose', 'sunset', 'netflix', 'luxury']) {
  assert.match(html, new RegExp(`data-preset="${preset}"`));
}
assert.match(html, /id="theme-opacity"[^>]+min="40"[^>]+max="100"/);
assert.match(html, /id="theme-blur"[^>]+min="0"[^>]+max="30"/);
assert.match(html, /id="theme-reset-btn"/);
assert.match(html, /prefers-reduced-motion/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/theme-studio.test.cjs`

Expected: FAIL เพราะยังไม่มี swatches/sliders/reset

- [ ] **Step 3: Implement minimal controls and CSS variables**

เพิ่ม swatches 6 ปุ่ม, sliders และ reset button ใน Theme Studio ใช้ `data-preset` และแสดงค่าปัจจุบันจาก state; เพิ่ม CSS variables ต่อ preset และ override ของ `body[data-surface="light"]` ให้ข้อความ/ขอบ/พื้นผิวมี contrast ชัดเจน

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/theme-studio.test.cjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add Index.html tests/theme-studio.test.cjs
git commit -m "feat: add theme presets and glass controls"
```

### Task 4: บังคับ compact list ให้มีอย่างน้อย 4 รายการและไม่ล้น

**Files:**
- Modify: `Index.html:393-750` (compact list CSS)
- Modify: `Index.html:2100-2460` (pagination calculation)
- Test: `tests/theme-studio.test.cjs`, `tests/responsive-layout.test.cjs`

**Interfaces:**
- Consumes: `isCompactLayout()`, `calculateCompactRowsPerPage()`, `#mobile-list .table-wrapper`
- Produces: `COMPACT_MIN_ROWS = 4`, compact pagination that never returns less than 4 when the table has at least 4 filtered rows, and row/action layout without horizontal overflow

- [ ] **Step 1: Write the failing test**

```js
assert.match(html, /const COMPACT_MIN_ROWS = 4/);
assert.match(html, /return Math\.max\(COMPACT_MIN_ROWS, Math\.floor\(/);
assert.match(html, /#main-table td:nth-child\(8\) \.btn[^}]*min-height: 44px/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/theme-studio.test.cjs`

Expected: FAIL เพราะ compact pagination ยังใช้ค่าที่คำนวณได้โดยไม่บังคับขั้นต่ำ 4

- [ ] **Step 3: Implement minimal pagination/layout change**

ประกาศ `const COMPACT_MIN_ROWS = 4;` ใกล้ state variables และปรับ `calculateCompactRowsPerPage()` ให้คืน `Math.max(COMPACT_MIN_ROWS, Math.floor(...))` เมื่อ `filteredPrinters.length >= COMPACT_MIN_ROWS`; จำกัดข้อมูลกรณีมีน้อยกว่า 4 ให้แสดงเท่าที่มี และคงปุ่มจัดการ 44px/ข้อความ ellipsis

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/theme-studio.test.cjs; node tests/responsive-layout.test.cjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add Index.html tests/theme-studio.test.cjs tests/responsive-layout.test.cjs
git commit -m "fix: keep four printer rows visible on compact list"
```

### Task 5: ตรวจ regression และ visual responsive

**Files:**
- Test: `tests/theme-studio.test.cjs`, `tests/responsive-layout.test.cjs`, `tests/mobile-two-tab.test.cjs`, `tests/mobile-browser.test.cjs`

- [ ] **Step 1: Run focused tests**

```powershell
node tests/theme-studio.test.cjs
node tests/responsive-layout.test.cjs
node tests/mobile-two-tab.test.cjs
node tests/mobile-browser.test.cjs
```

Expected: ทุกชุด PASS; หาก browser test ต้องใช้ dev server ให้ใช้คำสั่งที่มีอยู่ในไฟล์ test เท่านั้น

- [ ] **Step 2: เปิด local preview และตรวจ viewport จริง**

ตรวจ `375×844`, `400×869` (จำลอง POCO F8 Ultra), `430×932`, `820×1180`, `1024×768`, `1025×768`, `1440×900` โดยยืนยันว่า:

- Dark/Light สลับได้และ focus/pressed state อ่านได้
- compact list มีอย่างน้อย 4 รายการเมื่อข้อมูลถึงเกณฑ์
- ไม่มี horizontal overflow และปุ่มแก้ไข/ลบไม่ชน
- เมนู 2 แท็บยังเต็มความกว้างและใช้งานได้

- [ ] **Step 3: Run full existing contract suite**

Run: `Get-ChildItem tests -Filter '*.test.cjs' | ForEach-Object { node $_.FullName }`

Expected: ทุก contract test ที่มีอยู่ PASS; รายงาน test ที่ต้องพึ่ง environment ภายนอกแยกจากผล local

- [ ] **Step 4: Review diff and status**

Run: `git diff --check; git status --short`

Expected: ไม่มี whitespace error, ไม่มีไฟล์ generated/secret/environment ถูกแก้โดยไม่ตั้งใจ
