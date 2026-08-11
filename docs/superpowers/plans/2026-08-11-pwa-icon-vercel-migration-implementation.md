# PWA Icon and Vercel Migration Implementation Plan

> **สำหรับ agentic workers:** ต้องใช้ sub-skill superpowers:subagent-driven-development (แนะนำ) หรือ superpowers:executing-plans เพื่อทำแผนนี้ทีละ Task และใช้ checkbox เพื่อติดตามงาน

**Goal:** สร้าง Printer Management Pro แบบ PWA พร้อมไอคอนแนว A ทุก OS ย้าย frontend ไป Vercel และคง Google Apps Script กับ Google Sheet เป็น backend ที่เรียกผ่าน Vercel proxy

**Architecture:** Vercel ให้บริการ Index.html, manifest, service worker และ static icons ส่วน api/printers.js เป็น same-origin proxy ที่เติม Shared Secret ก่อนส่งคำขอไป Apps Script Web App โดย browser จะไม่เห็น URL หรือ secret ของ backend

**Tech Stack:** HTML/CSS/JavaScript เดิม, Node.js Vercel Function, Google Apps Script, Web App Manifest, Service Worker, PNG/ICO/SVG และ Node test runner แบบไฟล์ .cjs

## Global Constraints

- Desktop เริ่มที่ 1025px และ 1024px ลงไปยังเป็น compact layout
- มือถือและไอแพดมีเพียงสองแท็บ จัดการ และ รายการ
- ห้ามเพิ่ม MAC Address กลับเข้า schema หรือ UI
- ต้องคง Google Sheet และ Apps Script เป็น backend เดิม
- ห้ามใส่ APPS_SCRIPT_URL, API_SHARED_SECRET หรือ token ใด ๆ ลง source control
- ไอคอนใช้สี #F4C95D, #A9D8F5, #20252B, #F4897D และ #FFFDF7
- รายละเอียดสำคัญของ maskable icon ต้องอยู่ภายในพื้นที่กลาง 66%
- ห้าม cache เส้นทาง /api/printers หรือคำขอแก้ไขข้อมูลใน Service Worker
- การทดสอบ local ห้ามแก้ข้อมูล Google Sheet จริง
- Production write test ต้องหยุดรอ production gate จากผู้ใช้ก่อน

---

## โครงสร้างไฟล์เป้าหมาย

- Index.html: หน้า frontend, PWA metadata, API adapter และ service worker registration
- Code.gs: Apps Script API dispatcher, Shared Secret validation และ Google Sheet operations
- api/printers.js: Vercel serverless proxy เพียงจุดเดียว
- manifest.webmanifest: PWA identity, theme และรายการไอคอน
- service-worker.js: cache app shell/static assets และ network-only สำหรับ API
- vercel.json: root rewrite, static headers และ function runtime
- assets/icons/icon-master-1024.png: master artwork ที่อนุมัติ
- assets/icons/*.png, favicon.ico, safari-pinned-tab.svg: ไฟล์สำหรับแต่ละ OS
- scripts/generate-pwa-icons.py: แตกขนาดจาก master แบบทำซ้ำได้
- tests/pwa-icons.test.cjs: ตรวจไฟล์ ขนาด safe-zone metadata และ manifest
- tests/pwa-shell.test.cjs: ตรวจ metadata, service worker และ Vercel routes
- tests/vercel-api.test.cjs: unit test ของ proxy โดย mock fetch
- tests/apps-script-api.test.cjs: contract test ของ doPost และ Shared Secret
- tests/frontend-api.test.cjs: contract test ของ frontend same-origin API

---

### Task 1: บันทึก responsive fix ปัจจุบันเป็น baseline

**Files:**
- Modify: Index.html
- Modify: tests/mobile-browser.test.cjs
- Test: tests/responsive-layout.test.cjs
- Test: tests/mobile-browser.test.cjs

**Interfaces:**
- Consumes: compact layout และ test suite ที่มีอยู่
- Produces: baseline commit ที่ไม่มีปุ่มบันทึกทับ Type/Notes ก่อนเริ่ม migration

- [ ] **Step 1: ตรวจ diff ให้มีเฉพาะ responsive fix ที่ผู้ใช้อนุมัติ**

Run:

    git diff -- Index.html tests/mobile-browser.test.cjs

Expected: มี media query จอเตี้ยและ formControlGap regression assertion เท่านั้น

- [ ] **Step 2: รัน regression test เดิมทั้งหมด**

Run:

    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\responsive-layout.test.cjs
    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\mobile-two-tab.test.cjs
    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\sheet-schema.test.cjs
    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\header-watermark.test.cjs

Browser test ต้องกำหนด PRINTER_PLAYWRIGHT_PATH และ PRINTER_CHROME_PATH ตามค่าปัจจุบัน แล้วคาดหวังข้อความ mobile browser behavior tests passed

- [ ] **Step 3: Commit baseline แยกจากงาน PWA**

Run:

    git add Index.html tests/mobile-browser.test.cjs
    git commit -m "fix: prevent compact form controls from overlapping"

Expected: commit ใหม่มีเพียงสองไฟล์นี้

---

### Task 2: สร้าง icon master และชุดไอคอนทุก OS

**Files:**
- Create: assets/icons/icon-master-1024.png
- Create: assets/icons/icon-192.png
- Create: assets/icons/icon-512.png
- Create: assets/icons/icon-maskable-192.png
- Create: assets/icons/icon-maskable-512.png
- Create: assets/icons/apple-touch-icon.png
- Create: assets/icons/favicon-16x16.png
- Create: assets/icons/favicon-32x32.png
- Create: assets/icons/favicon.ico
- Create: assets/icons/mstile-150x150.png
- Create: assets/icons/safari-pinned-tab.svg
- Create: scripts/generate-pwa-icons.py
- Create: tests/pwa-icons.test.cjs

**Interfaces:**
- Consumes: ภาพแนว A ที่อนุมัติและสีจาก Global Constraints
- Produces: ไฟล์ icon paths ที่ manifest และ Index.html จะอ้างอิง

- [ ] **Step 1: เขียน failing test ตรวจรายการและขนาด PNG**

สร้าง tests/pwa-icons.test.cjs ให้ใช้ fs อ่าน PNG header และ assert:

    const expectedPngs = new Map([
      ['assets/icons/icon-master-1024.png', [1024, 1024]],
      ['assets/icons/icon-192.png', [192, 192]],
      ['assets/icons/icon-512.png', [512, 512]],
      ['assets/icons/icon-maskable-192.png', [192, 192]],
      ['assets/icons/icon-maskable-512.png', [512, 512]],
      ['assets/icons/apple-touch-icon.png', [180, 180]],
      ['assets/icons/favicon-16x16.png', [16, 16]],
      ['assets/icons/favicon-32x32.png', [32, 32]],
      ['assets/icons/mstile-150x150.png', [150, 150]]
    ]);

อ่าน width/height จาก byte offsets 16 และ 20 แบบ UInt32BE และตรวจว่า favicon.ico กับ safari-pinned-tab.svg มีขนาดมากกว่า 0

- [ ] **Step 2: รัน test เพื่อยืนยันว่า fail**

Run:

    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\pwa-icons.test.cjs

Expected: FAIL เพราะ assets/icons/icon-master-1024.png ยังไม่มี

- [ ] **Step 3: สร้าง master artwork ด้วย imagegen**

ใช้ prompt ที่ล็อกไว้:

    Use case: logo-brand
    Asset type: 1024x1024 PWA master icon
    Subject: a bold clay-style printer connected to three network nodes
    Palette: #F4C95D background, #20252B outlines, #A9D8F5 paper, #F4897D status dot
    Composition: centered; all essential geometry inside central 66%; no text; no external logo
    Avoid: thin lines, tiny details, transparency checkerboard, device mockup, watermark

ตรวจภาพด้วย view_image และคัดลอก output ที่อนุมัติเป็น assets/icons/icon-master-1024.png โดยไม่แก้ภาพต้นฉบับใน generated_images

- [ ] **Step 4: เขียนสคริปต์แตกไฟล์**

scripts/generate-pwa-icons.py ต้อง:

    from PIL import Image
    from pathlib import Path

    ROOT = Path(__file__).resolve().parents[1]
    ICONS = ROOT / 'assets' / 'icons'
    source = Image.open(ICONS / 'icon-master-1024.png').convert('RGBA')
    sizes = {
        'icon-192.png': 192,
        'icon-512.png': 512,
        'icon-maskable-192.png': 192,
        'icon-maskable-512.png': 512,
        'apple-touch-icon.png': 180,
        'favicon-16x16.png': 16,
        'favicon-32x32.png': 32,
        'mstile-150x150.png': 150,
    }
    for name, size in sizes.items():
        source.resize((size, size), Image.Resampling.LANCZOS).save(ICONS / name)
    source.save(ICONS / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

สร้าง safari-pinned-tab.svg เป็น monochrome silhouette ของ printer + network nodes ใช้ fill เดียวและ viewBox 0 0 512 512

- [ ] **Step 5: รัน generator และ test**

Run:

    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\generate-pwa-icons.py
    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\pwa-icons.test.cjs

Expected: PASS และ view_image ของ 16, 180, 512 แสดง silhouette อ่านออก ไม่มีส่วนสำคัญถูกตัด

- [ ] **Step 6: Commit icon pack**

Run:

    git add assets/icons scripts/generate-pwa-icons.py tests/pwa-icons.test.cjs
    git commit -m "feat: add cross-platform pwa icon set"

---

### Task 3: เพิ่ม manifest, service worker และ Vercel static routing

**Files:**
- Create: manifest.webmanifest
- Create: service-worker.js
- Create: vercel.json
- Modify: Index.html ส่วน head และท้าย script
- Create: tests/pwa-shell.test.cjs

**Interfaces:**
- Consumes: paths จาก Task 2
- Produces: installable app shell และ root route / ที่ Vercel ให้บริการ

- [ ] **Step 1: เขียน failing contract test**

tests/pwa-shell.test.cjs ต้อง assert:

    const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
    assert.equal(manifest.name, 'Printer Management Pro');
    assert.equal(manifest.short_name, 'Printer Pro');
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.theme_color, '#F4C95D');
    assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));

และตรวจ Index.html มี rel="manifest", apple-touch-icon, favicon.ico, theme-color, msapplication-TileImage รวมถึง service worker registration ส่วน service-worker.js ต้องมี /api/ exclusion และ vercel.json ต้อง rewrite / ไป /Index.html

- [ ] **Step 2: รัน test เพื่อยืนยันว่า fail**

Run:

    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\pwa-shell.test.cjs

Expected: FAIL เพราะ manifest.webmanifest ยังไม่มี

- [ ] **Step 3: สร้าง manifest**

manifest.webmanifest ต้องมีโครงหลัก:

    {
      "id": "/",
      "name": "Printer Management Pro",
      "short_name": "Printer Pro",
      "description": "ระบบจัดการและติดตามสถานะเครื่องพิมพ์",
      "lang": "th",
      "start_url": "/",
      "scope": "/",
      "display": "standalone",
      "background_color": "#FFFDF7",
      "theme_color": "#F4C95D",
      "icons": [
        { "src": "/assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
        { "src": "/assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
        { "src": "/assets/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
        { "src": "/assets/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
      ]
    }

- [ ] **Step 4: สร้าง service worker แบบ API network-only**

service-worker.js ต้อง:

    const CACHE_NAME = 'printer-management-shell-v1';
    const APP_SHELL = [
      '/', '/Index.html', '/manifest.webmanifest',
      '/assets/icons/icon-192.png',
      '/assets/icons/icon-512.png'
    ];

install ใช้ cache.addAll(APP_SHELL), activate ลบ cache ชื่ออื่น และ fetch ต้อง return ทันทีโดยไม่ intercept เมื่อ url.pathname.startsWith('/api/')

สำหรับ GET static files ใช้ cache-first พร้อม background refresh ห้าม cache POST, PUT, PATCH หรือ DELETE

- [ ] **Step 5: เพิ่ม metadata และ registration**

ใน head ของ Index.html เพิ่ม link/meta ตามไฟล์จริง และท้าย script เพิ่ม:

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(error => {
          console.warn('Service worker registration failed.', error);
        });
      });
    }

- [ ] **Step 6: สร้าง vercel.json**

กำหนด rewrite จาก / ไป /Index.html, runtime ของ api/*.js เป็น nodejs20.x, Cache-Control: no-cache สำหรับ service-worker.js และ Content-Type ที่ถูกต้องสำหรับ manifest.webmanifest

- [ ] **Step 7: รัน test และ commit**

Run:

    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\pwa-shell.test.cjs

Expected: PASS

Commit:

    git add Index.html manifest.webmanifest service-worker.js vercel.json tests/pwa-shell.test.cjs
    git commit -m "feat: add installable pwa shell"

---

### Task 4: สร้าง Vercel API proxy แบบ test-first

**Files:**
- Create: api/printers.js
- Create: tests/vercel-api.test.cjs

**Interfaces:**
- Consumes: Environment variables APPS_SCRIPT_URL และ API_SHARED_SECRET
- Produces: handler(req, res) ที่รองรับ GET และ POST /api/printers

- [ ] **Step 1: เขียน mock response และ failing tests**

tests/vercel-api.test.cjs ต้อง import handler และมี helper:

    function createResponse() {
      return {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; }
      };
    }

Test cases:

- env หายต้องได้ 500 และ code CONFIG_ERROR
- method อื่นนอกจาก GET/POST ต้องได้ 405 พร้อม Allow: GET, POST
- GET ต้อง POST ไป Apps Script ด้วย action getPrinters และ token จาก env
- POST ที่ไม่มี printers array ต้องได้ 400
- POST ที่ body เกิน 1,000,000 bytes ต้องได้ 413
- upstream non-2xx หรือ JSON ไม่ถูกต้องต้องได้ 502
- response ต้องไม่ประกอบด้วย secret หรือ Apps Script URL

- [ ] **Step 2: รัน test เพื่อยืนยันว่า fail**

Run:

    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\vercel-api.test.cjs

Expected: FAIL ด้วย MODULE_NOT_FOUND api/printers.js

- [ ] **Step 3: Implement handler ขั้นต่ำ**

api/printers.js ต้อง export:

    module.exports = async function handler(req, res) {
      res.setHeader('Cache-Control', 'no-store');
      if (!['GET', 'POST'].includes(req.method)) {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
      }

      const endpoint = process.env.APPS_SCRIPT_URL;
      const token = process.env.API_SHARED_SECRET;
      if (!endpoint || !token) {
        return res.status(500).json({ ok: false, code: 'CONFIG_ERROR' });
      }

      const clientPayload = req.method === 'GET' ? { action: 'getPrinters' } : req.body;
      if (req.method === 'POST' && !Array.isArray(clientPayload?.printers)) {
        return res.status(400).json({ ok: false, code: 'INVALID_PAYLOAD' });
      }
      const upstreamPayload = { ...clientPayload, token };
      const serialized = JSON.stringify(upstreamPayload);
      if (Buffer.byteLength(serialized) > 1000000) {
        return res.status(413).json({ ok: false, code: 'PAYLOAD_TOO_LARGE' });
      }

      try {
        const upstream = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: serialized,
          redirect: 'follow'
        });
        if (!upstream.ok) throw new Error('Upstream status ' + upstream.status);
        const result = await upstream.json();
        return res.status(result?.ok ? 200 : 502).json(result?.ok ? result : { ok: false, code: 'UPSTREAM_ERROR' });
      } catch (error) {
        console.error('Apps Script proxy failed.', error?.message || error);
        return res.status(502).json({ ok: false, code: 'UPSTREAM_UNAVAILABLE' });
      }
    };

- [ ] **Step 4: รัน test และ commit**

Run:

    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\vercel-api.test.cjs

Expected: PASS

Commit:

    git add api/printers.js tests/vercel-api.test.cjs
    git commit -m "feat: proxy printer data through vercel"

---

### Task 5: เพิ่ม Apps Script authenticated API dispatcher

**Files:**
- Modify: Code.gs ส่วน doPost และ helper functions
- Create: tests/apps-script-api.test.cjs
- Modify: tests/sheet-schema.test.cjs หากต้องเพิ่ม contract โดยไม่ลด assertion เดิม

**Interfaces:**
- Consumes: payload { action, token, printers?, updatedAt? }
- Produces: JSON { ok, printers?, syncedRows?, syncedAt?, error? }

- [ ] **Step 1: เขียน failing tests ด้วย vm sandbox**

tests/apps-script-api.test.cjs ต้องโหลด Code.gs ผ่าน vm และ stub:

    const properties = new Map([['API_SHARED_SECRET', 'test-secret']]);
    const sandbox = {
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: key => properties.get(key) || ''
        })
      },
      ContentService: {
        MimeType: { JSON: 'application/json' },
        createTextOutput: text => ({
          text,
          setMimeType() { return this; }
        })
      },
      console
    };

Test:

- token ผิดต้องตอบ ok false และไม่เรียก sheet
- ไม่มี API_SHARED_SECRET ต้อง fail closed
- action getPrinters พร้อม token ถูกต้องต้องเรียก getPrintersFromSheet
- action syncPrinters พร้อม token ถูกต้องต้องเรียก savePrintersToSheet
- error response ห้ามมีค่า test-secret

- [ ] **Step 2: รัน test เพื่อยืนยันว่า fail**

Run:

    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\apps-script-api.test.cjs

Expected: FAIL เพราะ doPost ยังไม่ตรวจ Shared Secret และยัง dispatch read ไม่ได้

- [ ] **Step 3: แยก dispatcher และ secret validator**

แก้ Code.gs:

    function doPost(event) {
      try {
        const payload = parsePayload_(event);
        verifyApiSecret_(payload.token);
        if (payload.action === 'getPrinters') {
          return jsonResponse_(getPrintersFromSheet());
        }
        return jsonResponse_(savePrintersToSheet(payload));
      } catch (error) {
        console.error(error);
        return jsonResponse_({
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      }
    }

    function verifyApiSecret_(providedToken) {
      const expectedToken = PropertiesService.getScriptProperties().getProperty('API_SHARED_SECRET');
      if (!expectedToken || !providedToken || providedToken !== expectedToken) {
        throw new Error('Unauthorized API request');
      }
    }

ห้าม log providedToken และคง google.script.run functions เดิมเพื่อไม่ทำลาย legacy fallback

- [ ] **Step 4: รัน Apps Script และ schema tests**

Run:

    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\apps-script-api.test.cjs
    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\sheet-schema.test.cjs

Expected: PASS ทั้งคู่

- [ ] **Step 5: Commit**

Run:

    git add Code.gs tests/apps-script-api.test.cjs tests/sheet-schema.test.cjs
    git commit -m "feat: secure apps script api requests"

---

### Task 6: เปลี่ยน frontend ให้ใช้ same-origin API และโหลดข้อมูลล่าสุด

**Files:**
- Modify: Index.html ส่วน html dataset, performSheetSync และ refreshPrintersFromSheet
- Create: tests/frontend-api.test.cjs
- Modify: tests/mobile-browser.test.cjs เพื่อ mock /api/printers

**Interfaces:**
- Consumes: GET/POST /api/printers จาก Task 4
- Produces: applySheetSnapshot(result), performSheetSync(action) และ fallback local storage

- [ ] **Step 1: เขียน failing static contract**

tests/frontend-api.test.cjs ต้อง assert:

    assert.match(html, /data-api-url="\/api\/printers"/);
    assert.doesNotMatch(html, /data-app-script-url/);
    assert.doesNotMatch(html, /script\.google\.com\/macros\/s\//);
    assert.match(html, /fetch\(apiUrl/);
    assert.match(html, /method:\s*'GET'/);
    assert.match(html, /method:\s*'POST'/);

และตรวจว่า POST ไม่ใช้ mode: no-cors

- [ ] **Step 2: รัน test เพื่อยืนยันว่า fail**

Run:

    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\frontend-api.test.cjs

Expected: FAIL เพราะ Index.html ยังใช้ data-app-script-url

- [ ] **Step 3: Implement frontend adapter**

เปลี่ยน root element เป็น:

    <html lang="th" data-api-url="/api/printers">

กำหนด:

    const apiUrl = document.documentElement.dataset.apiUrl || '/api/printers';

performSheetSync ต้อง POST JSON, ตรวจ response.ok และ result.ok ก่อน set synced:

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });
    const result = await response.json();
    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || result?.code || 'บันทึกลงชีตไม่สำเร็จ');
    }

refreshPrintersFromSheet ต้อง GET apiUrl ด้วย cache: no-store แล้วเรียก applySheetSnapshot เมื่อสำเร็จ หากล้มเหลวให้ setSheetSyncStatus('local') และรักษา local data

- [ ] **Step 4: ปรับ browser test ให้คืน snapshot จาก /api/printers**

ใน local test server:

- GET /api/printers ตอบ { ok: true, printers: stubPrinters, syncedAt: fixedIso }
- POST /api/printers ตอบ { ok: true, syncedRows: body.printers.length }
- เพิ่ม assertion ว่า startup เรียก GET หนึ่งครั้ง และการ submit เรียก POST โดยไม่มี token

- [ ] **Step 5: รัน frontend และ browser tests**

Run:

    & 'C:\Users\Theboy-AsusTUF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\frontend-api.test.cjs

จากนั้นรัน tests/mobile-browser.test.cjs พร้อม Playwright/Chrome environment เดิม

Expected: PASS และยังไม่มี page/card overflow

- [ ] **Step 6: Commit**

Run:

    git add Index.html tests/frontend-api.test.cjs tests/mobile-browser.test.cjs
    git commit -m "feat: load printer data through same-origin api"

---

### Task 7: Full regression, security scan และ local preview

**Files:**
- Test: tests/*.test.cjs
- Modify when required by a failing assertion: Index.html, Code.gs, api/printers.js, manifest.webmanifest, service-worker.js, vercel.json และไฟล์ test ที่ชี้สาเหตุ

**Interfaces:**
- Consumes: ผลลัพธ์ Tasks 1-6
- Produces: source พร้อม push โดยไม่มี secret และไม่มี layout regression

- [ ] **Step 1: รัน test ทุกไฟล์**

Run แต่ละไฟล์ด้วย bundled Node:

    tests/responsive-layout.test.cjs
    tests/mobile-two-tab.test.cjs
    tests/sheet-schema.test.cjs
    tests/header-watermark.test.cjs
    tests/pwa-icons.test.cjs
    tests/pwa-shell.test.cjs
    tests/vercel-api.test.cjs
    tests/apps-script-api.test.cjs
    tests/frontend-api.test.cjs
    tests/mobile-browser.test.cjs

Expected: PASS ทุกไฟล์ ห้ามลดหรือข้าม assertion ที่ fail

- [ ] **Step 2: ตรวจ secret และ endpoint leakage**

Run:

    rg -n "API_SHARED_SECRET|script\.google\.com/macros/s/|VERCEL_TOKEN|ghp_|github_pat_" -g "!docs/**" -g "!.git/**"

Expected: พบเฉพาะชื่อตัวแปร environment ใน server-side files และไม่พบค่าจริงหรือ Apps Script deployment URL

- [ ] **Step 3: ตรวจ Git และ asset size**

Run:

    git diff --check
    git status --short
    Get-ChildItem assets\icons | Select-Object Name,Length

Expected: worktree clean, master ไม่เกิน 2 MB, PNG derivative แต่ละไฟล์ไม่เกิน 512 KB และไม่มีไฟล์ preview comparison ถูก commit

- [ ] **Step 4: เปิด local preview**

ให้ local server จำลอง /api/printers แล้วตรวจ 430×720, 820×1180 และ 1025×768:

- header, icon metadata และสองแท็บ
- form ไม่มี overlap
- list row สามบรรทัดบนมือถือ
- ไม่มี horizontal/vertical page overflow
- GET snapshot ล่าสุดถูก apply

- [ ] **Step 5: Commit เฉพาะ regression fix หากมี**

Run:

    git add -- Index.html Code.gs api/printers.js manifest.webmanifest service-worker.js vercel.json tests
    git commit -m "fix: resolve pwa migration regressions"

หากไม่มีไฟล์แก้ ห้ามสร้าง empty commit

---

### Task 8: Publish ไป GitHub และสร้าง Vercel preview

**Files:**
- Git metadata: branch main และ remote origin
- Vercel project metadata: ไม่ commit .vercel directory

**Interfaces:**
- Consumes: clean commits จาก Task 7
- Produces: GitHub main branch และ Vercel preview URL

- [ ] **Step 1: ตรวจสิทธิ์ก่อน push**

ยืนยัน repository maxplane-KKR/Printer-management-pwa ยังว่างและ connector มี push/admin จากนั้นตรวจ:

    gh auth status --hostname github.com

หาก token CLI ยังหมดอายุ ให้ทำ:

    gh auth login --hostname github.com --git-protocol https --web

รอผู้ใช้อนุมัติใน browser แล้วตรวจ auth ซ้ำ ห้ามขอให้ผู้ใช้วาง token ในแชต

- [ ] **Step 2: ตรวจ commit scope ก่อนเปลี่ยน branch**

Run:

    git log --oneline --decorate -10
    git status --short

Expected: worktree clean และไม่มี secret

- [ ] **Step 3: เปลี่ยน local branch และตั้ง remote**

Run:

    git branch -M main
    git remote add origin https://github.com/maxplane-KKR/Printer-management-pwa.git

ถ้ามี origin อยู่แล้ว ต้องตรวจ URL ก่อนใช้ git remote set-url และห้ามเขียนทับ remote ที่ไม่เกี่ยวข้องโดยไม่แจ้งผู้ใช้

- [ ] **Step 4: Push main**

Run:

    git push -u origin main

Expected: GitHub main ชี้ commit เดียวกับ local HEAD และ repository แสดง assets, api, manifest, service worker โดยไม่มี secret

- [ ] **Step 5: สร้าง Vercel project และ preview**

ใช้ Vercel team team_bopvSQ6vY2ufCuCyhGEMUBes และชื่อ project printer-management-pwa เชื่อม GitHub repository เป้าหมาย ตั้ง Framework Preset เป็น Other และ Root Directory เป็น repository root

ก่อน deploy ต้องมี Environment Variables:

- APPS_SCRIPT_URL: URL /exec ของ Apps Script deployment
- API_SHARED_SECRET: ค่าเดียวกับ Apps Script Script Property

ค่าจริงต้องตั้งผ่าน Vercel environment UI/CLI ที่ปลอดภัยและห้ามพิมพ์ใน output หรือ commit

- [ ] **Step 6: Deploy preview และตรวจ build**

ใช้ Vercel deployment tool สร้าง preview ก่อน production แล้วตรวจ status จนเป็น READY หาก ERROR ให้ดึง build logs และแก้ root cause

ตรวจ preview:

- GET / ตอบ 200
- manifest และ icon paths ตอบ 200 พร้อม Content-Type ถูกต้อง
- service-worker.js ตอบ no-cache
- GET /api/printers ไม่เปิดเผย URL/secret
- responsive smoke test ผ่าน

ห้ามทดสอบ POST ที่เปลี่ยนชีตจริงในขั้น preview

---

### Task 9: Apps Script deployment gate และ Vercel production

**Files:**
- External configuration only: Apps Script deployment และ Vercel environment
- ห้ามแก้ source หลัง preview artifact ผ่านโดยไม่สร้าง preview ใหม่

**Interfaces:**
- Consumes: preview ที่ผ่าน Task 8 และ Code.gs ที่มี authenticated dispatcher
- Produces: production URL ที่อ่าน/บันทึก Google Sheet ได้จริง

- [ ] **Step 1: ให้ผู้ใช้ตั้ง Apps Script Property**

ผู้ใช้ตั้ง:

- API_SHARED_SECRET เป็นค่าเดียวกับ Vercel
- SPREADSHEET_ID เมื่อ Apps Script เป็น standalone project

จากนั้น Deploy Code.gs เป็น Web App แบบ Execute as Me และกำหนด access ตามนโยบายผู้ใช้

- [ ] **Step 2: ตรวจ read-only production backend**

เรียก GET /api/printers ผ่าน Vercel preview ซึ่ง proxy เป็น POST action getPrinters ไป Apps Script

Expected: { ok: true, printers: [...], syncedAt: ... } และหน้าเว็บแสดงจำนวน/รายการตรงกับ snapshot ล่าสุด

- [ ] **Step 3: ขอ production write gate**

ก่อนส่ง POST ที่เปลี่ยน Google Sheet จริง ต้องแจ้งจำนวนแถวและผลกระทบ แล้วรอคำว่าอนุมัติจากผู้ใช้

- [ ] **Step 4: ทดสอบ write หลังอนุมัติ**

ใช้ข้อมูล snapshot เดิมแบบไม่แก้ค่า ส่ง action syncPrinters หนึ่งครั้ง แล้วอ่านกลับทันที

Expected: syncedRows เท่าจำนวนรายการ, ไม่มีข้อมูลสูญหาย, headers ตรง schema และหน้าเว็บเปลี่ยนสถานะเป็น synced

- [ ] **Step 5: Promote preview เดิมเป็น production**

ใช้ Vercel promote กับ preview artifact ที่ตรวจแล้ว ไม่ rebuild ใหม่ แล้วตรวจ deployment status เป็น READY

- [ ] **Step 6: ตรวจ production หลัง deploy**

ตรวจ:

- root, manifest, icons และ service worker ตอบ 200
- PWA install metadata ถูกต้อง
- API read สำเร็จและไม่ถูก cache
- mobile 430×720, iPad 820×1180 และ desktop 1025×768 ไม่มี overflow
- Vercel runtime/build logs ไม่มี error ใหม่

- [ ] **Step 7: สรุป deploy**

รายงาน URL, target production, status, commit SHA, framework Other/Static + Node Function, test commands ที่รัน และข้อจำกัดว่าการติดตั้งจริงบนอุปกรณ์ใดได้ตรวจหรือยังไม่ได้ตรวจ
