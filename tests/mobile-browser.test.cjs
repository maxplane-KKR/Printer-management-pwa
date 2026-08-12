const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const playwrightPath = process.env.PRINTER_PLAYWRIGHT_PATH;
const chromePath = process.env.PRINTER_CHROME_PATH;
assert.ok(playwrightPath, 'ต้องกำหนด PRINTER_PLAYWRIGHT_PATH');
assert.ok(chromePath, 'ต้องกำหนด PRINTER_CHROME_PATH');
const { chromium } = require(playwrightPath);

const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'));
let sheetReads = 0;
let sheetWrites = 0;
const sheetSnapshot = {
  ok: true,
  schemaVersion: 2,
  syncedAt: '2026-08-11T05:00:00.000Z',
  printers: [{
    id: 'sheet-1', name: 'HP LaserJet MFP E52645 Long Department Printer', ip: '10.0.0.1',
    location: 'WARD8', type: 'HP LaserJet MFP E52645', status: 'online',
    lastUpdated: '11/08/2026 12:00', note: 'latest'
  }]
};
const server = http.createServer((request, response) => {
  if (request.url === '/api/printers') {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (request.method === 'GET') {
      sheetReads += 1;
      response.end(JSON.stringify(sheetSnapshot));
      return;
    }
    if (request.method === 'POST') {
      sheetWrites += 1;
      response.end(JSON.stringify({ ok: true, syncedRows: sheetSnapshot.printers.length }));
      return;
    }
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
});
let browser;

function listen() {
  return new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}

function waitForSheetRead(previousCount, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (sheetReads > previousCount) return resolve();
      if (Date.now() - startedAt >= timeoutMs) {
        return reject(new Error('หมดเวลารอการอ่านข้อมูลจาก same-origin API'));
      }
      setTimeout(check, 10);
    };
    check();
  });
}

(async () => {
  await listen();
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/Index.html`;
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true });
  await context.route(/^https:\/\//, route => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(10000);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.sheetSync === 'synced');
  assert.equal(sheetWrites, 0, 'เปิดหน้าต้องไม่เขียน local data ทับชีต');
  assert.equal(await page.locator('#stat-total').textContent(), '1', 'ข้อมูลจากชีตต้องแทน local cache ทั้งชุด');

  const startupReads = sheetReads;
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')));
  await waitForSheetRead(startupReads);
  assert.ok(sheetReads > startupReads, 'pageshow ต้องโหลด snapshot ล่าสุดผ่าน same-origin API');

  const manageMetrics = await page.evaluate(() => ({
    layout: document.body.dataset.layout,
    tabs: document.querySelectorAll('.mobile-tab').length,
    widthOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    heightOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    sideColumns: getComputedStyle(document.querySelector('.manage-grid > div:last-child')).gridTemplateColumns,
    headerHeight: document.querySelector('.container > h1').getBoundingClientRect().height,
    navHeight: document.querySelector('.mobile-tabbar').getBoundingClientRect().height
  }));
  assert.equal(manageMetrics.layout, 'compact');
  assert.equal(manageMetrics.tabs, 2);
  assert.ok(manageMetrics.widthOverflow <= 1);
  assert.ok(manageMetrics.heightOverflow <= 1);
  assert.equal(manageMetrics.sideColumns.split(' ').length, 1, 'การ์ดเครื่องมือ/ภาพรวมต้องซ้อนแนวตั้ง');
  assert.ok(manageMetrics.headerHeight >= 104, `Header มือถือต้องสูงอย่างน้อย 104px: ${manageMetrics.headerHeight}`);
  assert.ok(manageMetrics.navHeight <= 62, `เมนูล่างมือถือต้องไม่สูงเกิน 62px: ${manageMetrics.navHeight}`);

  const container = page.locator('.container');
  await container.dispatchEvent('touchstart', { changedTouches: [{ identifier: 1, clientX: 360, clientY: 700 }] });
  await container.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: 80, clientY: 700 }] });
  assert.equal(await page.evaluate(() => document.body.dataset.mobileView), 'list', 'ปัดซ้ายต้องเปิดรายการ');

  const listMetrics = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#table-body tr')];
    const firstRow = rows[0];
    const primaryLine = firstRow?.querySelector('.mobile-printer-line');
    const ipLine = firstRow?.querySelector('.mobile-ip-inline');
    const metaLine = firstRow?.querySelector('.mobile-device-meta');
    const wrapper = document.querySelector('.table-wrapper').getBoundingClientRect();
    const pagination = document.querySelector('.pagination-controls').getBoundingClientRect();
    return {
      manageDisplay: getComputedStyle(document.querySelector('#mobile-manage')).display,
      lastRowBottom: rows.at(-1).getBoundingClientRect().bottom,
      wrapperBottom: wrapper.bottom,
      paginationTop: pagination.top,
      navTop: document.querySelector('.mobile-tabbar').getBoundingClientRect().top,
      threeLineTops: [primaryLine, ipLine, metaLine].filter(Boolean).map(element => Math.round(element.getBoundingClientRect().top)),
      primaryLineHeight: primaryLine?.getBoundingClientRect().height || 0,
      rowHeight: firstRow?.getBoundingClientRect().height || 0
    };
  });
  assert.equal(listMetrics.manageDisplay, 'none');
  assert.ok(listMetrics.lastRowBottom <= listMetrics.wrapperBottom + 1);
  assert.ok(listMetrics.wrapperBottom <= listMetrics.paginationTop);
  assert.ok(listMetrics.paginationTop < listMetrics.navTop);
  assert.equal(new Set(listMetrics.threeLineTops).size, 3, `รายการมือถือแต่ละใบต้องมี 3 บรรทัด: ${JSON.stringify(listMetrics)}`);
  assert.ok(listMetrics.primaryLineHeight <= 32, `ชื่อและสถานะต้องอยู่บรรทัดเดียว: ${JSON.stringify(listMetrics)}`);
  assert.ok(listMetrics.rowHeight <= 92, `การ์ดรายการต้องกระชับไม่เกิน 92px: ${JSON.stringify(listMetrics)}`);

  await page.locator('#search-input').dispatchEvent('touchstart', { changedTouches: [{ identifier: 2, clientX: 350, clientY: 90 }] });
  await page.locator('#search-input').dispatchEvent('touchend', { changedTouches: [{ identifier: 2, clientX: 80, clientY: 90 }] });
  assert.equal(await page.evaluate(() => document.body.dataset.mobileView), 'list', 'swipe จาก input ต้องไม่สลับแท็บ');

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(100);
  const ipadMetrics = await page.evaluate(() => ({
    widthOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    heightOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    tabs: document.querySelectorAll('.mobile-tab').length
  }));
  assert.ok(ipadMetrics.widthOverflow <= 1);
  assert.ok(ipadMetrics.heightOverflow <= 1);
  assert.equal(ipadMetrics.tabs, 2);

  await page.locator('[data-mobile-view="manage"]').click();
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 430, height: 720 },
    { width: 430, height: 932 },
    { width: 812, height: 375 },
    { width: 1023, height: 768 }
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(80);
    const metrics = await page.evaluate(() => {
      const submitTop = document.querySelector('#submit-btn').getBoundingClientRect().top;
      const finalInputBottom = Math.max(
        ...[...document.querySelectorAll('#printer-type,#printer-note')]
          .map(element => element.getBoundingClientRect().bottom)
      );
      return {
        layout: document.body.dataset.layout,
        widthOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        heightOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        cardOverflow: [...document.querySelectorAll('#mobile-form,#mobile-tools,#mobile-overview')]
          .map(element => ({ id: element.id, client: element.clientHeight, scroll: element.scrollHeight })),
        formControlGap: submitTop - finalInputBottom,
        toolCardHeight: document.querySelector('#mobile-tools').getBoundingClientRect().height,
        maxToolButtonHeight: Math.max(...[...document.querySelectorAll('#mobile-tools .btn')]
          .map(element => element.getBoundingClientRect().height)),
        minControlHeight: Math.min(...[...document.querySelectorAll('#printer-form input:not([type="hidden"]),#printer-form button:not([style*="display: none"])')]
          .map(element => element.getBoundingClientRect().height).filter(Boolean))
      };
    });
    assert.equal(metrics.layout, 'compact', `${viewport.width}px ต้องเป็น compact`);
    assert.ok(metrics.widthOverflow <= 1, `${viewport.width}px ต้องไม่ล้นแนวนอน`);
    assert.ok(metrics.heightOverflow <= 1, `${viewport.width}px ต้องไม่ล้นแนวตั้ง: ${JSON.stringify(metrics)}`);
    assert.equal(
      metrics.cardOverflow.some(card => card.scroll > card.client),
      false,
      `${viewport.width}px content ต้องไม่ล้นการ์ด: ${JSON.stringify(metrics.cardOverflow)}`
    );
    const requiredFormGap = viewport.width === 430 && viewport.height === 932 ? 12 : 4;
    assert.ok(metrics.formControlGap >= requiredFormGap, `${viewport.width}px ปุ่มบันทึกต้องเว้นจากช่อง Type/Notes อย่างน้อย ${requiredFormGap}px: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.minControlHeight >= 44, `${viewport.width}px touch target ต้องไม่น้อยกว่า 44px`);
    if (viewport.width === 430 && viewport.height === 932) {
      assert.ok(metrics.toolCardHeight <= 200, `POCO viewport การ์ดเครื่องมือต้องกระชับไม่เกิน 200px: ${JSON.stringify(metrics)}`);
      assert.ok(metrics.maxToolButtonHeight <= 48, `POCO viewport ปุ่มเครื่องมือต้องไม่สูงเกิน 48px: ${JSON.stringify(metrics)}`);
    }
  }

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => document.body.dataset.layout), 'desktop', '1024px ต้องเป็น desktop แม้มี scrollbar');
  assert.equal(await page.locator('.mobile-tabbar').evaluate(element => getComputedStyle(element).display), 'none');

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(80);
  const desktopToolMetrics = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('#mobile-tools .btn')]
      .map(element => element.getBoundingClientRect());
    const rounded = values => [...new Set(values.map(value => Math.round(value)))];
    return {
      buttonCount: buttons.length,
      hasBackup: Boolean(document.querySelector('#backup-btn')),
      hasRestore: Boolean(document.querySelector('#restore-btn')),
      rows: rounded(buttons.map(rect => rect.top)).length,
      columns: rounded(buttons.map(rect => rect.left)).length,
      widthSpread: Math.max(...buttons.map(rect => rect.width)) - Math.min(...buttons.map(rect => rect.width)),
      cardOverflow: document.querySelector('#mobile-tools').scrollWidth - document.querySelector('#mobile-tools').clientWidth
    };
  });
  assert.equal(desktopToolMetrics.hasBackup, false, 'Desktop ต้องไม่มีปุ่ม Backup');
  assert.equal(desktopToolMetrics.hasRestore, false, 'Desktop ต้องไม่มีปุ่ม Restore');
  assert.equal(desktopToolMetrics.buttonCount, 4, `Desktop ต้องเหลือปุ่มเครื่องมือ 4 ปุ่ม: ${JSON.stringify(desktopToolMetrics)}`);
  assert.equal(desktopToolMetrics.rows, 2, `Desktop ต้องเรียงปุ่มเครื่องมือ 2 แถว: ${JSON.stringify(desktopToolMetrics)}`);
  assert.equal(desktopToolMetrics.columns, 2, `Desktop ต้องเรียงปุ่มเครื่องมือ 2 คอลัมน์: ${JSON.stringify(desktopToolMetrics)}`);
  assert.ok(desktopToolMetrics.widthSpread <= 1, `ปุ่ม Desktop ต้องกว้างเท่ากัน: ${JSON.stringify(desktopToolMetrics)}`);
  assert.ok(desktopToolMetrics.cardOverflow <= 1, `ปุ่ม Desktop ต้องไม่ล้นการ์ด: ${JSON.stringify(desktopToolMetrics)}`);

  await browser.close();
  server.close();
  console.log('mobile browser behavior tests passed');
})().catch(async error => {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  console.error(error);
  process.exitCode = 1;
});
