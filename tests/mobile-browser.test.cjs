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
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
});
let browser;

function listen() {
  return new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
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

  await page.addInitScript(() => {
    window.__sheetReads = 0;
    window.__sheetWrites = 0;
    const runner = {
      success: null,
      failure: null,
      withSuccessHandler(handler) { this.success = handler; return this; },
      withFailureHandler(handler) { this.failure = handler; return this; },
      getPrintersFromSheet() {
        window.__sheetReads += 1;
        const success = this.success;
        setTimeout(() => success({
          ok: true,
          schemaVersion: 2,
          syncedAt: '2026-08-11T05:00:00.000Z',
          printers: [{
            id: 'sheet-1', name: 'LATEST-FROM-SHEET', ip: '10.0.0.1',
            location: 'IT', type: 'Laser', status: 'online',
            lastUpdated: '11/08/2026 12:00', note: 'latest'
          }]
        }), 20);
      },
      savePrintersToSheet() { window.__sheetWrites += 1; }
    };
    window.google = { script: { run: runner } };
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.sheetSync === 'synced');
  assert.equal(await page.evaluate(() => window.__sheetWrites), 0, 'เปิดหน้าต้องไม่เขียน local data ทับชีต');
  assert.equal(await page.locator('#stat-total').textContent(), '1', 'ข้อมูลจากชีตต้องแทน local cache ทั้งชุด');

  const startupReads = await page.evaluate(() => window.__sheetReads);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')));
  await page.waitForFunction(previous => window.__sheetReads > previous, startupReads);

  const manageMetrics = await page.evaluate(() => ({
    layout: document.body.dataset.layout,
    tabs: document.querySelectorAll('.mobile-tab').length,
    widthOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    heightOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    sideColumns: getComputedStyle(document.querySelector('.manage-grid > div:last-child')).gridTemplateColumns
  }));
  assert.equal(manageMetrics.layout, 'compact');
  assert.equal(manageMetrics.tabs, 2);
  assert.ok(manageMetrics.widthOverflow <= 1);
  assert.ok(manageMetrics.heightOverflow <= 1);
  assert.equal(manageMetrics.sideColumns.split(' ').length, 1, 'การ์ดเครื่องมือ/ภาพรวมต้องซ้อนแนวตั้ง');

  const container = page.locator('.container');
  await container.dispatchEvent('touchstart', { changedTouches: [{ identifier: 1, clientX: 360, clientY: 700 }] });
  await container.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: 80, clientY: 700 }] });
  assert.equal(await page.evaluate(() => document.body.dataset.mobileView), 'list', 'ปัดซ้ายต้องเปิดรายการ');

  const listMetrics = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#table-body tr')];
    const wrapper = document.querySelector('.table-wrapper').getBoundingClientRect();
    const pagination = document.querySelector('.pagination-controls').getBoundingClientRect();
    return {
      manageDisplay: getComputedStyle(document.querySelector('#mobile-manage')).display,
      lastRowBottom: rows.at(-1).getBoundingClientRect().bottom,
      wrapperBottom: wrapper.bottom,
      paginationTop: pagination.top,
      navTop: document.querySelector('.mobile-tabbar').getBoundingClientRect().top
    };
  });
  assert.equal(listMetrics.manageDisplay, 'none');
  assert.ok(listMetrics.lastRowBottom <= listMetrics.wrapperBottom + 1);
  assert.ok(listMetrics.wrapperBottom <= listMetrics.paginationTop);
  assert.ok(listMetrics.paginationTop < listMetrics.navTop);

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
    { width: 812, height: 375 },
    { width: 1024, height: 768 }
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(80);
    const metrics = await page.evaluate(() => ({
      layout: document.body.dataset.layout,
      widthOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      heightOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      cardOverflow: [...document.querySelectorAll('#mobile-form,#mobile-tools,#mobile-overview')]
        .map(element => ({ id: element.id, client: element.clientHeight, scroll: element.scrollHeight })),
      minControlHeight: Math.min(...[...document.querySelectorAll('#printer-form input:not([type="hidden"]),#printer-form button:not([style*="display: none"])')]
        .map(element => element.getBoundingClientRect().height).filter(Boolean))
    }));
    assert.equal(metrics.layout, 'compact', `${viewport.width}px ต้องเป็น compact`);
    assert.ok(metrics.widthOverflow <= 1, `${viewport.width}px ต้องไม่ล้นแนวนอน`);
    assert.ok(metrics.heightOverflow <= 1, `${viewport.width}px ต้องไม่ล้นแนวตั้ง: ${JSON.stringify(metrics)}`);
    assert.equal(
      metrics.cardOverflow.some(card => card.scroll > card.client),
      false,
      `${viewport.width}px content ต้องไม่ล้นการ์ด: ${JSON.stringify(metrics.cardOverflow)}`
    );
    assert.ok(metrics.minControlHeight >= 44, `${viewport.width}px touch target ต้องไม่น้อยกว่า 44px`);
  }

  await page.setViewportSize({ width: 1025, height: 768 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => document.body.dataset.layout), 'desktop', '1025px ต้องเป็น desktop แม้มี scrollbar');
  assert.equal(await page.locator('.mobile-tabbar').evaluate(element => getComputedStyle(element).display), 'none');

  await browser.close();
  server.close();
  console.log('mobile browser behavior tests passed');
})().catch(async error => {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  console.error(error);
  process.exitCode = 1;
});
