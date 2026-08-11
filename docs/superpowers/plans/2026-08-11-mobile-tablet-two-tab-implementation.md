# Mobile/Tablet Two-Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปรับหน้าจอไม่เกิน 1024px ให้เป็นแอป 2 แท็บเต็มหน้าจอ รองรับ swipe แนวนอน รายการปรับจำนวนแถวตามความสูง ตัด MAC Address ทั้งระบบ และดึงข้อมูลล่าสุดจาก Google Sheet เมื่อเปิดหรือกลับเข้าแท็บ

**Architecture:** รักษา single-page architecture เดิมใน `Index.html` และ Apps Script ใน `Code.gs` โดยเพิ่ม state สำหรับ `manage/list`, ตัวประสาน refresh แบบ single in-flight promise และ schema migration ฝั่ง Apps Script ที่อ่านตามชื่อ header พร้อมสำรอง MAC ก่อนลบคอลัมน์จริง การทดสอบแบ่งเป็น static regression, Apps Script sandbox และ Playwright browser seam

**Tech Stack:** HTML/CSS/Vanilla JavaScript, Google Apps Script, Node.js built-in test utilities, Playwright ที่มีอยู่ใน Codex runtime

## Global Constraints

- ใช้ desktop layout เมื่อ viewport ตั้งแต่ 1025px เท่านั้น; 1024px ลงมาเป็น compact layout
- ไม่เพิ่ม dependency, ไม่แก้ lockfile/environment/CI และไม่แยก production bundle ใหม่
- ไม่ deploy และไม่แตะ Google Sheet จริงในแผนนี้ การทดสอบ Apps Script ใช้ fake Spreadsheet เท่านั้น
- การย้าย schema จริงต้องสร้าง hidden backup ชื่อ `Printers_MAC_Backup_<timestamp>` ก่อนลบ MAC และไม่ลบ backup อัตโนมัติ
- การเปิดหน้า/refresh ห้ามส่ง bundled หรือ local cache ไปเขียนทับชีต การเขียนเกิดเฉพาะ action ที่ผู้ใช้สั่ง
- งานนี้ไม่มี Git repository จึงไม่มี commit checkpoint; หลังแต่ละ task ให้บันทึกไฟล์ที่แก้และคำสั่งทดสอบแทน
- ใช้ red-green-refactor ทุก task: เพิ่ม assertion ให้ล้มก่อน แก้ขั้นต่ำ แล้วรัน regression ที่เกี่ยวข้อง

---

## Task 1: ล็อกสัญญา schema และการอ่าน/ย้ายข้อมูล Google Sheet

**Files:**

- Create: `tests/sheet-data.test.cjs`
- Modify: `Code.gs:23-165`

- [ ] **1.1 สร้าง fake Spreadsheet seam สำหรับ Apps Script**

  ใช้ `node:vm` โหลด `Code.gs` และ stub เฉพาะ `SpreadsheetApp`, `LockService`, `Utilities`, `ContentService` โดย fake sheet ต้องรองรับ `getDataRange().getValues()`, `getRange().setValues()`, `deleteColumn()`, `copyTo()`, `setName()` และ `hideSheet()` เพื่อยืนยันผลโดยไม่แตะชีตจริง

- [ ] **1.2 เขียน test ที่ล้มสำหรับ contract การอ่านข้อมูล**

  เพิ่มกรณีต่อไปนี้ใน `tests/sheet-data.test.cjs`:

  ```js
  assert.deepEqual(context.HEADERS, [
    'ID', 'Printer Name', 'IP Address', 'Location', 'Type',
    'Status', 'Last Updated', 'Note', 'Synced At'
  ]);

  const result = context.getPrintersFromSheet();
  assert.equal(result.ok, true);
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.printers[0].ip, '192.168.1.10');
  assert.equal('mac' in result.printers[0], false);
  ```

  ทดสอบทั้งชีตใหม่ 9 คอลัมน์และ legacy 10 คอลัมน์ที่วาง `MAC Address` ไว้หลัง IP เพื่อยืนยันว่าอ่านตามชื่อ header ไม่ใช่เลขคอลัมน์

- [ ] **1.3 รัน test และยืนยันว่าแดง**

  Run:

  ```powershell
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\sheet-data.test.cjs
  ```

  Expected: ล้มเพราะ `getPrintersFromSheet()` ยังไม่มีและ `HEADERS` ยังมี MAC

- [ ] **1.4 เพิ่ม read API และ header-based mapping ขั้นต่ำใน `Code.gs`**

  เพิ่ม public interface:

  ```js
  function getPrintersFromSheet() {
    return withScriptLock_(function () {
      const sheet = getOrCreatePrintersSheet_();
      const values = sheet.getDataRange().getValues();
      const printers = mapSheetRowsByHeader_(values);
      return {
        ok: true,
        printers: printers,
        syncedAt: new Date().toISOString(),
        schemaVersion: 2
      };
    });
  }
  ```

  `mapSheetRowsByHeader_()` ต้อง normalize ด้วยกฎเดียวกับ `normalizePrinters_()` และไม่คืน property `mac`

- [ ] **1.5 เขียน test ที่ล้มสำหรับ migration และ write schema**

  ยืนยันว่าเมื่อ save legacy sheet:

  ```js
  assert.equal(fakeSpreadsheet.backups.length, 1);
  assert.match(fakeSpreadsheet.backups[0].name, /^Printers_MAC_Backup_\d{8}_\d{6}$/);
  assert.equal(fakeSpreadsheet.backups[0].hidden, true);
  assert.equal(fakeSheet.deletedColumns.filter(column => column === 4).length, 1);
  assert.deepEqual(fakeSheet.rows[0], context.HEADERS);
  assert.equal(fakeSheet.rows[1].length, 9);
  ```

  เรียก save ซ้ำแล้วต้องยังมี backup เดียว และไม่มีการลบคอลัมน์ซ้ำ

- [ ] **1.6 ทำ migration ก่อน write และเปลี่ยน writer เป็น 9 คอลัมน์**

  เพิ่ม `migrateMacColumnIfNeeded_(spreadsheet, sheet)` ให้ตรวจ header จริง, copy ชีตทั้งแผ่นเป็น backup, ซ่อน backup, แล้วจึง `deleteColumn(macColumnIndex + 1)` การพบ backup prefix เดิมต้องไม่สร้างซ้ำ ส่วน `savePrintersToSheet()` ต้องเขียน 9 ค่าเรียงตาม `HEADERS`

- [ ] **1.7 รัน test ให้เขียวและรัน regression เดิม**

  Run:

  ```powershell
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\sheet-data.test.cjs
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\responsive-layout.test.cjs
  ```

  Expected: ทั้งสองคำสั่ง exit 0

## Task 2: ตัด MAC Address ออกจาก client และ local data contract

**Files:**

- Create: `tests/client-data-contract.test.cjs`
- Modify: `Index.html:388-497`
- Modify: `Index.html:1871-2470`

- [ ] **2.1 เขียน static contract test ที่ล้ม**

  ตรวจ `Index.html` ว่าไม่มี input/label/table/search/CSV field ของ MAC และ object ที่ใช้ runtime ไม่มี key `mac`:

  ```js
  assert.doesNotMatch(html, /id=["']mac["']/i);
  assert.doesNotMatch(html, />\s*MAC Address\s*</i);
  assert.doesNotMatch(html, /IP\s*&\s*MAC Address/i);
  assert.doesNotMatch(html, /printer\.mac|\.mac\.toLowerCase|\bmac:\s*/);
  assert.match(html, />\s*IP Address\s*</i);
  ```

  อนุญาตคำว่า MAC เฉพาะใน `Code.gs` ส่วน migration/backup compatibility เท่านั้น

- [ ] **2.2 รัน test และยืนยันว่าแดง**

  Run:

  ```powershell
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\client-data-contract.test.cjs
  ```

- [ ] **2.3 ลบ MAC จาก markup และ runtime paths ทั้งหมด**

  แก้เฉพาะจุดเดิมใน `Index.html`:

  - ลบช่อง MAC และปรับ form grid เป็นคู่ `IP + Location`, `Type + Notes`
  - เปลี่ยนหัวตาราง `IP & MAC Address` เป็น `IP Address`
  - ลบ `mac` จาก sample normalization, submit, edit, render, filter/search, clipboard และ CSV export
  - เพิ่ม `normalizePrinterRecord(raw)` เพื่อรับ localStorage รุ่นเดิมแล้วคืน object ใหม่ที่ไม่มี `mac`
  - เพิ่ม local schema version ใหม่โดยไม่เรียก sheet writer ระหว่าง migration cache

- [ ] **2.4 รัน contract test และ regression**

  Run:

  ```powershell
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\client-data-contract.test.cjs
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\responsive-layout.test.cjs
  ```

## Task 3: ทำ sheet refresh ให้ข้อมูลล่าสุดเป็น source of truth โดยไม่เขียนทับอัตโนมัติ

**Files:**

- Create: `tests/client-refresh.browser.test.cjs`
- Modify: `Index.html:1876-1965`
- Modify: `Index.html:2480-2558`

- [ ] **3.1 สร้าง browser harness ที่ stub `google.script.run`**

  ใน test ใช้ `page.addInitScript()` ก่อนเปิด `Index.html` เพื่อฉีด chain API:

  ```js
  window.__sheetReads = 0;
  window.__sheetWrites = 0;
  window.google = { script: { run: createGoogleRunStub({
    getPrintersFromSheet(handler) {
      window.__sheetReads += 1;
      handler({ ok: true, printers: window.__sheetRows, syncedAt: '2026-08-11T05:00:00.000Z', schemaVersion: 2 });
    },
    savePrintersToSheet() { window.__sheetWrites += 1; }
  }) } };
  ```

  Test ต้องเปิด local file ด้วย Chromium executable ที่กำหนดผ่าน `PRINTER_CHROME_PATH`

- [ ] **3.2 เขียน browser tests ที่ล้มสำหรับ startup/visibility/fallback**

  ยืนยันว่า:

  - local cache แสดงก่อน แต่หลัง callback รายการจากชีตแทนทั้งหมด
  - startup มี read 1 ครั้งและ write 0 ครั้ง
  - `visibilitychange` เป็น visible และ `pageshow` เรียก refresh โดย request ที่ซ้อนกันแชร์ in-flight เดียว
  - read error คง local data, ตั้ง `body.dataset.sheetSync === 'error'` และไม่ write
  - ฟอร์ม dirty/editing ทำให้ refresh ถูก defer จน save/cancel

- [ ] **3.3 รัน browser test และยืนยันว่าแดง**

  Run:

  ```powershell
  $env:PRINTER_PLAYWRIGHT_PATH='C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'; $env:PRINTER_CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'; & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\client-refresh.browser.test.cjs
  ```

- [ ] **3.4 แยก local render ออกจาก remote refresh**

  ปรับ interface ฝั่ง client เป็น:

  ```js
  function loadCachedData() {}
  function refreshPrintersFromSheet({ reason = 'manual' } = {}) {}
  function applySheetSnapshot(result) {}
  function hasUnsavedPrinterForm() {}
  ```

  ใช้ `sheetRefreshPromise` ร่วมกัน, รอ `sheetWritePromise` ก่อนอ่าน, และเก็บ `deferredSheetRefresh` เมื่อฟอร์มมีข้อมูลค้าง ห้าม `loadData()` เรียก `saveData({ syncSheet: true })`

- [ ] **3.5 ผูก lifecycle event แบบไม่ยิงซ้ำเกินจำเป็น**

  หลัง render cache ให้เรียก refresh startup หนึ่งครั้ง จากนั้นผูก:

  ```js
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshPrintersFromSheet({ reason: 'visible' });
  });
  window.addEventListener('pageshow', () => refreshPrintersFromSheet({ reason: 'pageshow' }));
  ```

  `refreshPrintersFromSheet()` ต้อง dedupe เหตุการณ์คู่ที่เกิดขณะ promise เดิมยังทำงาน

- [ ] **3.6 รัน browser test ให้เขียวและรัน contract tests**

  ใช้คำสั่ง Task 3.3 แล้วตามด้วย test ใน Task 1-2

## Task 4: รวม compact navigation เป็น 2 แท็บและรองรับ swipe ที่ไม่แย่ง gesture ของ controls

**Files:**

- Create: `tests/compact-navigation.browser.test.cjs`
- Modify: `Index.html:275-353`
- Modify: `Index.html:388-468`
- Modify: `Index.html:2480-2558`

- [ ] **4.1 เขียน browser tests ที่ล้มสำหรับ 2-tab state**

  ที่ viewport 440x956 และ 820x1180 ยืนยันว่า nav มี 2 รายการชื่อ `จัดการ`/`รายการ`, ค่า state มีเพียง `manage/list`, และ legacy hash ทั้งสามค่าเปลี่ยนเป็น `#mobile-manage`

- [ ] **4.2 เขียน gesture tests ที่ล้ม**

  dispatch touch sequence ระยะ 80px:

  - ปัดซ้ายจาก manage ไป list
  - ปัดขวาจาก list กลับ manage
  - ปัดแนวตั้งไม่สลับ
  - เริ่มจาก `input, select, textarea, button, a` ไม่สลับ
  - desktop 1025px ไม่สลับ layout

- [ ] **4.3 รัน test และยืนยันว่าแดง**

  Run ด้วย env เดียวกับ Task 3.3:

  ```powershell
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\compact-navigation.browser.test.cjs
  ```

- [ ] **4.4 รวม DOM panel และเปลี่ยน navigation**

  สร้าง `#mobile-manage` ครอบ form, tools และ overview โดยไม่ duplicate element ส่วน `#mobile-list` อยู่เป็น sibling แยกต่างหาก เปลี่ยน nav ให้มี 2 anchor เท่ากัน และ desktop CSS ต้องแสดงทั้ง manage/list ตามโครงสร้างเดิม

- [ ] **4.5 ลด state และ harden swipe**

  ใช้:

  ```js
  const compactViewNames = ['manage', 'list'];
  const legacyCompactViews = new Set(['form', 'tools', 'overview']);
  const swipeControlSelector = 'input, select, textarea, button, a, [contenteditable="true"]';
  ```

  เก็บ target ตอน `touchstart`, ไม่เริ่ม gesture ถ้า `closest(swipeControlSelector)`, ต้องผ่าน threshold 60px และ `absX > absY * 1.2`

- [ ] **4.6 รัน navigation tests ให้เขียวและรัน regression เดิม**

  รัน Task 4.3, `tests/responsive-layout.test.cjs` และ `tests/client-data-contract.test.cjs`

## Task 5: ทำแท็บจัดการแบบเต็มจอและ form 2-grid สำหรับ iPad/มือถือ

**Files:**

- Create: `tests/compact-layout.browser.test.cjs`
- Modify: `Index.html:210-468`

- [ ] **5.1 เขียน viewport matrix test ที่ล้ม**

  ทดสอบ 320x720, 440x956, 812x375, 820x1180, 1024x768 และ 1025x768 โดยวัด:

  ```js
  const metrics = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    verticalOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    navCount: document.querySelectorAll('.mobile-tabbar .mobile-tab').length,
    formColumns: getComputedStyle(document.querySelector('.printer-form-grid')).gridTemplateColumns
  }));
  assert.ok(metrics.horizontalOverflow <= 1);
  assert.ok(metrics.verticalOverflow <= 1);
  ```

  ใน compact ต้องมี form 2 คอลัมน์, touch target ทุก control อย่างน้อย 44px และใน 820px ฟอร์มอยู่ซ้าย เครื่องมือ/ภาพรวมอยู่ขวา ส่วน 1025px ต้องคง desktop

- [ ] **5.2 รัน test และยืนยันว่าแดง**

  Run ด้วย env เดียวกับ Task 3.3:

  ```powershell
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\compact-layout.browser.test.cjs
  ```

- [ ] **5.3 สร้าง compact app shell ที่ไม่เกิด page overflow**

  ภายใต้ `@media (max-width: 1024px)` ใช้ `body { height: 100dvh; overflow: hidden; }`, container เป็น grid `header / minmax(0,1fr) / nav`, panel ใช้ `min-width: 0; min-height: 0; overflow: hidden` และคำนึงถึง `env(safe-area-inset-*)`

- [ ] **5.4 จัด manage layout ตาม viewport โดยไม่กระทบ desktop**

  - 768-1024px แนวตั้ง: form ซ้าย, tools + overview ขวา
  - 320-767px แนวตั้ง: form ด้านบน, tools grid 3x2 และ overview 2 ช่องด้านล่าง
  - จอสั้น/แนวนอน: form ซ้าย, tools + overview ขวา
  - ชื่อเครื่องพิมพ์และปุ่ม save span 2 คอลัมน์; คู่ field เป็น `IP + Location`, `Type + Notes`
  - ลดเฉพาะ gap/padding compact โดยรักษา font อ่านได้และ target 44px

- [ ] **5.5 รองรับ keyboard/visual viewport โดยไม่ดัน app เกินจอ**

  ใช้ CSS variable `--app-height` จาก `visualViewport.height` เมื่อมี keyboard และอัปเดตใน `resize`/`orientationchange`; ไม่ใช้ physical `screen.width/height`

- [ ] **5.6 รัน viewport matrix ให้เขียว**

  รัน Task 5.2 แล้วตามด้วย navigation และ responsive regression tests

## Task 6: ทำแท็บรายการเต็มพื้นที่และคำนวณจำนวนแถวแบบ adaptive

**Files:**

- Modify: `tests/compact-layout.browser.test.cjs`
- Modify: `Index.html:468-560`
- Modify: `Index.html:1973-2260`

- [ ] **6.1 เพิ่ม browser tests ที่ล้มสำหรับ isolated list view**

  เมื่ออยู่ `#mobile-list` ต้องมองเห็นเฉพาะ filter bar, list, page info และ pagination; `#mobile-manage` ต้องไม่กิน layout (`display: none`) และทั้ง document ต้องไม่มี overflow

- [ ] **6.2 เพิ่ม browser tests ที่ล้มสำหรับ adaptive rows**

  ใส่ข้อมูลอย่างน้อย 30 รายการ แล้วยืนยันว่า:

  - 440x956 แสดงจำนวนแถวมากกว่า 812x375
  - ทุกแถวสูงคงที่และข้อความยาวถูก line-clamp
  - แถวสุดท้ายไม่ทับ pagination/nav
  - resize และ `visualViewport.resize` คำนวณใหม่
  - compact ซ่อน selector 15/50/100/all แต่ desktop 1025px ยังใช้ selector เดิม
  - next/previous page ใช้ page size ที่คำนวณและไม่ข้ามข้อมูล

- [ ] **6.3 รัน test และยืนยันว่าแดง**

  ใช้คำสั่ง Task 5.2

- [ ] **6.4 เพิ่ม adaptive page-size calculator**

  เพิ่ม interface:

  ```js
  function calculateCompactRowsPerPage() {
    const listHeight = compactListViewport.clientHeight;
    const chromeHeight = filterBar.offsetHeight + pagination.offsetHeight;
    const rowHeight = Number.parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--compact-row-height')) || 72;
    return Math.max(1, Math.floor((listHeight - chromeHeight) / rowHeight));
  }
  ```

  ให้ `getActiveRowsPerPage()` คืนค่า adaptive เมื่อ compact และคืนค่าจาก `rowsPerPageSelect` เมื่อ desktop จากนั้น clamp `currentPage` ทุกครั้งที่ page size/filter เปลี่ยน

- [ ] **6.5 ทำ compact row ให้มีความสูงคงที่และไม่ล้น**

  ใช้ `--compact-row-height`, `min-width: 0`, `overflow: hidden`, `text-overflow: ellipsis`/line clamp และแสดงข้อมูลหลักเฉพาะชื่อ, IP, location/type, status, actions โดยไม่มี MAC

- [ ] **6.6 ผูก recalculation แบบ debounce หนึ่ง animation frame**

  เรียกเมื่อเปลี่ยนแท็บเป็น list, `resize`, `orientationchange`, `visualViewport.resize`, filter เปลี่ยน และหลัง snapshot จากชีต render เสร็จ โดยไม่เพิ่ม listener ซ้ำ

- [ ] **6.7 รัน browser tests ให้เขียวครบ viewport**

  รัน compact layout, navigation, refresh และ responsive regression tests

## Task 7: ตรวจรวม, visual QA และเตรียม handoff โดยไม่ deploy

**Files:**

- Modify: `Index.html` เฉพาะ cleanup ที่พบจาก verification
- Modify: `Code.gs` เฉพาะ cleanup ที่พบจาก verification
- Modify: `tests/*.cjs` เฉพาะ assertion ที่ทำให้ deterministic โดยไม่ลดความเข้มของ contract

- [ ] **7.1 รัน test suite ทั้งหมด**

  Run:

  ```powershell
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\responsive-layout.test.cjs
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\sheet-data.test.cjs
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\client-data-contract.test.cjs
  $env:PRINTER_PLAYWRIGHT_PATH='C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'; $env:PRINTER_CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'; & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\client-refresh.browser.test.cjs
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\compact-navigation.browser.test.cjs
  & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\compact-layout.browser.test.cjs
  ```

- [ ] **7.2 ตรวจ source hygiene และขอบเขต MAC**

  Run:

  ```powershell
  rg -n "MAC Address|printer\.mac|\bmac\s*:|TODO|FIXME|DEBUG" Index.html Code.gs tests
  ```

  Expected: MAC พบได้เฉพาะ test legacy และ migration/backup ใน `Code.gs`; ไม่พบ placeholder/debug marker ใน production

- [ ] **7.3 ถ่าย screenshot สำหรับ visual QA**

  เก็บภาพแท็บ manage/list ที่ 440x956, 812x375, 820x1180, 1024x768 และ desktop 1025x768 จาก local preview ตรวจด้วยตาว่าไม่มี content ถูกตัด, card เบียด, pagination ทับ nav หรือการเปลี่ยน visual identity

- [ ] **7.4 ตรวจ accessibility interaction ขั้นต่ำ**

  ยืนยัน keyboard focus ที่ nav/buttons, `aria-current` มีเพียงแท็บเดียว, tab labels อ่านได้, reduced-motion ปิด transition ที่ไม่จำเป็น และ swipe ไม่ใช่วิธีเดียวในการเปลี่ยนแท็บ

- [ ] **7.5 สรุป handoff อย่างชัดเจน**

  รายงานไฟล์ที่เปลี่ยน, ทุกคำสั่งที่รันพร้อมผลจริง, screenshot ที่ตรวจ, ข้อจำกัดว่า Apps Script/Google Sheet จริงยังไม่ได้ทดสอบ และขออนุมัติแยกก่อน deploy หรือ migration ชีตจริง

