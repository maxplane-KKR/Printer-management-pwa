# แผนติดตั้งลายน้ำ Header แบบ A

> **สำหรับผู้ลงมือแบบ agentic:** ทำตามงานทีละข้อพร้อมรอบทดสอบ Red–Green–Refactor; สภาพแวดล้อมนี้ไม่มี `superpowers:executing-plans` และไม่ใช่ Git repository จึงทำแบบ inline และไม่มีขั้น commit

**เป้าหมาย:** สร้างลายน้ำ PNG โปร่งใสรูปเครื่องพิมพ์เชื่อมโหนดเครือข่าย วางด้านขวาของ Header โดยไม่ทับข้อความหรือทำให้หน้า responsive ล้น

**สถาปัตยกรรม:** เก็บภาพตกแต่งไว้ใน `assets/` และอ้างผ่าน `::before` ของ `.container > h1` เพื่อแยกภาพจาก DOM เชิงความหมาย ขนาดและ opacity ปรับด้วย media query เดิมโดยไม่เปลี่ยนความสูง Header

**เทคโนโลยี:** HTML/CSS, PNG RGBA, Node.js contract test, Playwright browser test

## ข้อจำกัดร่วม

- ใช้ไฟล์ `assets/printer-network-watermark.png` ที่มี alpha channel จริง
- ไอแพดใช้ความกว้างประมาณ 30% และ opacity ประมาณ 12%
- มือถือไม่เกิน 480px ใช้ความกว้างประมาณ 42% และเลื่อนไปทางขวาเล็กน้อย
- เดสก์ท็อปใช้ความกว้าง 22–26%
- ห้ามเพิ่ม dependency และห้ามเปลี่ยนลอจิกข้อมูลหรือ Google Sheet
- จุดตัด desktop คงเดิมที่ 1025px

---

### งาน 1: เพิ่มสัญญาทดสอบ asset และ CSS

**ไฟล์:**
- สร้าง: `tests/header-watermark.test.cjs`
- อ่าน: `Index.html`
- อ่านหลังสร้าง: `assets/printer-network-watermark.png`

**อินเทอร์เฟซ:**
- รับ: ไฟล์ PNG และ CSS ของ Header
- ให้ผล: การยืนยันว่า PNG เป็น RGBA และ Header อ้าง asset พร้อม breakpoint ครบ

- [ ] **ขั้น 1: เขียน failing test**

```js
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
```

- [ ] **ขั้น 2: รันเพื่อยืนยันว่าแดง**

```powershell
& 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\header-watermark.test.cjs
```

ผลที่คาด: FAIL เพราะยังไม่มี `assets/printer-network-watermark.png`

---

### งาน 2: สร้าง PNG โปร่งใสและตรวจ alpha

**ไฟล์:**
- สร้างชั่วคราว: `tmp/imagegen/printer-network-watermark-chroma.png`
- สร้าง: `assets/printer-network-watermark.png`

**อินเทอร์เฟซ:**
- รับ: ภาพเส้นเครื่องพิมพ์กับโหนดเครือข่ายบนพื้น `#00ff00`
- ให้ผล: PNG RGBA พื้นหลังโปร่งใส ไม่มีข้อความหรือเงาตกกระทบ

- [ ] **ขั้น 1: สร้างต้นฉบับด้วย built-in image generation**

ใช้ prompt นี้โดยตรง:

```text
Use case: logo-brand
Asset type: transparent header watermark for a printer management web app
Primary request: a minimal bold line-art printer connected to three small network nodes
Style/medium: clean geometric monoline icon, dark navy strokes, no gradients
Composition/framing: landscape 3:2, subject centered with generous padding
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: no text, no letters, no logos, no shadow, no reflection; do not use #00ff00 in the subject
```

คัดลอกผลที่เลือกไป `tmp/imagegen/printer-network-watermark-chroma.png`

- [ ] **ขั้น 2: ตัดพื้นหลังเป็น alpha PNG**

```powershell
& 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\Theboy-AsusTUF\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py' --input 'tmp\imagegen\printer-network-watermark-chroma.png' --out 'assets\printer-network-watermark.png' --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

- [ ] **ขั้น 3: รัน contract test ให้ผ่านส่วน PNG**

ใช้คำสั่งจากงาน 1 ผลที่คาดคือผ่าน signature/alpha แต่ยัง FAIL ที่ CSS reference

---

### งาน 3: ผูกลายน้ำเข้ากับ Header

**ไฟล์:**
- แก้ไข: `Index.html`
- ทดสอบ: `tests/header-watermark.test.cjs`

**อินเทอร์เฟซ:**
- รับ: `assets/printer-network-watermark.png`
- ให้ผล: `.container > h1::before` เป็นชั้นภาพตกแต่ง responsive

- [ ] **ขั้น 1: เพิ่ม CSS ขั้นต่ำ**

```css
.container > h1 {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}
.container > h1::before {
  content: "";
  position: absolute;
  inset: -6% 3% -6% auto;
  width: 30%;
  background: url("assets/printer-network-watermark.png") center / contain no-repeat;
  opacity: .12;
  pointer-events: none;
  z-index: -1;
}
@media (max-width: 480px) {
  .container > h1::before { right: -3%; width: 42%; }
}
@media (min-width: 1025px) {
  .container > h1::before { width: 24%; }
}
```

- [ ] **ขั้น 2: รัน contract test ให้เป็นเขียว**

ใช้คำสั่งจากงาน 1 ผลที่คาด: `header watermark contract tests passed`

- [ ] **ขั้น 3: ตรวจ source hygiene**

```powershell
rg -n "printer-network-watermark|container > h1::before" Index.html tests\header-watermark.test.cjs
```

---

### งาน 4: ตรวจภาพจริงและ regression

**ไฟล์:**
- แก้เมื่อจำเป็น: `Index.html`
- ทดสอบ: `tests/mobile-browser.test.cjs`

**อินเทอร์เฟซ:**
- รับ: หน้า Header ที่ผูกลายน้ำแล้ว
- ให้ผล: ยืนยันความอ่านง่ายและไม่มี overflow ทุกจุดตัด

- [ ] **ขั้น 1: ตรวจภาพที่ความละเอียดเป้าหมาย**

ตรวจ 320×720, 430×932, 820×1180, 812×375, 1024×768 และ 1025×768 โดยยืนยันว่า Title/Subtitle อ่านชัด, ลายน้ำอยู่ขวา และ Header ไม่เปลี่ยนความสูง

- [ ] **ขั้น 2: รันชุดทดสอบทั้งหมด**

```powershell
& 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\responsive-layout.test.cjs
& 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\mobile-two-tab.test.cjs
& 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\sheet-schema.test.cjs
& 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\header-watermark.test.cjs
```

รัน `tests/mobile-browser.test.cjs` ด้วยค่า `PRINTER_PLAYWRIGHT_PATH` และ `PRINTER_CHROME_PATH` เดิม ผลที่คาด: ทุกชุด exit code 0

- [ ] **ขั้น 3: รายงานขอบเขตที่ตรวจได้**

ระบุชัดว่าเป็น local preview/test เท่านั้น และยังไม่ได้ deploy หรือทดสอบ Apps Script/Google Sheet จริง
