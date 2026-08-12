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
const printerFixtures = Array.from({ length: 8 }, (_, index) => ({
  id: `fixture-${index + 1}`,
  name: `Printer ${index + 1}`,
  ip: `10.0.0.${index + 1}`,
  location: 'WARD8',
  type: 'HP LaserJet MFP E52645',
  note: '',
  status: index % 2 === 0 ? 'online' : 'offline',
  lastUpdated: '12/08/2026 17:30',
}));
let servedPrinters = [];
const server = http.createServer((request, response) => {
  if (request.url === '/api/printers') {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({
      ok: true,
      schemaVersion: 2,
      printers: servedPrinters,
    }));
    return;
  }

  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
});

let browser;

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage();
  await page.route(/^https:\/\//, route => route.abort());

  const cases = [
    { width: 1280, height: 1024, expectedLayout: 'desktop', expectedNav: 'none' },
    { width: 1024, height: 1280, expectedLayout: 'desktop', expectedNav: 'none' },
    { width: 384, height: 824, expectedLayout: 'compact', expectedNav: 'grid' },
  ];

  for (const viewport of cases) {
    servedPrinters = viewport.width === 384 ? printerFixtures : [];
    await page.setViewportSize(viewport);
    await page.goto(`http://127.0.0.1:${port}/Index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(100);

    const metrics = await page.evaluate(() => ({
      layout: document.body.dataset.layout,
      widthOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      navDisplay: getComputedStyle(document.querySelector('.mobile-tabbar')).display,
      minControlHeight: Math.min(
        ...[...document.querySelectorAll(
          'button, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), select'
        )]
          .filter(element => element.getClientRects().length)
          .map(element => element.getBoundingClientRect().height)
          .filter(Boolean)
      ),
    }));

    assert.equal(metrics.layout, viewport.expectedLayout, `${viewport.width}x${viewport.height}px ใช้ layout ไม่ถูกต้อง`);
    assert.equal(metrics.navDisplay, viewport.expectedNav, `${viewport.width}x${viewport.height}px แสดง navigation ไม่ถูกต้อง`);
    assert.ok(metrics.widthOverflow <= 1, `${viewport.width}x${viewport.height}px ต้องไม่ล้นแนวนอน: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.minControlHeight >= 44, `${viewport.width}x${viewport.height}px ต้องมี touch target อย่างน้อย 44px`);

    if (viewport.width === 384) {
      const mobileManageMetrics = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const inputGroups = [...document.querySelectorAll('.printer-form-grid > .form-group')].map(element => element.getBoundingClientRect());
        const toolButtonHeights = [...document.querySelectorAll('#mobile-tools .btn')]
          .map(element => element.getBoundingClientRect().height);
        const finalInputBottom = Math.max(rect('#printer-type').bottom, rect('#printer-note').bottom);
        const controlTops = [
          rect('#printer-name').top,
          Math.min(rect('#printer-ip').top, rect('#printer-location').top),
          Math.min(rect('#printer-type').top, rect('#printer-note').top),
          rect('#submit-btn').top,
        ];
        return {
          formHeight: rect('#mobile-form').height,
          toolsHeight: rect('#mobile-tools').height,
          toolButtonHeights,
          nameToGridGap: rect('.printer-form-grid').top - rect('#printer-form > .form-group').bottom,
          inputGridRowGap: Math.min(inputGroups[2].top, inputGroups[3].top) - Math.max(inputGroups[0].bottom, inputGroups[1].bottom),
          formControlGap: rect('#submit-btn').top - finalInputBottom,
          formBottomSpace: rect('#mobile-form').bottom - rect('#submit-btn').bottom,
          controlTopSteps: controlTops.slice(1).map((top, index) => top - controlTops[index]),
        };
      });
      assert.ok(mobileManageMetrics.formHeight >= 336, `384x824 form card must receive the freed space: ${JSON.stringify(mobileManageMetrics)}`);
      assert.ok(Math.abs(mobileManageMetrics.toolsHeight - 166) <= 0.5, `384x824 database card must free 18px for the form: ${JSON.stringify(mobileManageMetrics)}`);
      assert.ok(Math.min(...mobileManageMetrics.toolButtonHeights) >= 54.5, `database buttons must retain a safe touch height: ${JSON.stringify(mobileManageMetrics)}`);
      assert.ok(Math.max(...mobileManageMetrics.toolButtonHeights) <= 55.5, `database buttons must free the required form space: ${JSON.stringify(mobileManageMetrics)}`);
      assert.ok(mobileManageMetrics.formControlGap >= 31, `expanded form must use its space before the save button: ${JSON.stringify(mobileManageMetrics)}`);
      assert.ok(Math.abs(mobileManageMetrics.nameToGridGap - mobileManageMetrics.inputGridRowGap) <= 1, `form input spacing must stay consistent: ${JSON.stringify(mobileManageMetrics)}`);
      assert.ok(Math.abs(mobileManageMetrics.formControlGap - mobileManageMetrics.inputGridRowGap - 18) <= 1, `save button spacing must account for the missing label: ${JSON.stringify(mobileManageMetrics)}`);
      assert.ok(mobileManageMetrics.formBottomSpace <= 18, `expanded form must not leave excessive space below the save button: ${JSON.stringify(mobileManageMetrics)}`);
      assert.ok(Math.max(...mobileManageMetrics.controlTopSteps) - Math.min(...mobileManageMetrics.controlTopSteps) <= 1, `input rows and save button must be spaced evenly: ${JSON.stringify(mobileManageMetrics)}`);
    }

    if (viewport.expectedLayout === 'compact') {
      await page.locator('[data-mobile-view="list"]').click();
      const listMetrics = await page.evaluate(() => ({
        widthOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        heightOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        rowCount: document.querySelectorAll('#table-body tr').length,
        tableRight: document.querySelector('#mobile-list .table-wrapper').getBoundingClientRect().right,
        viewportWidth: window.innerWidth,
      }));
      if (viewport.width === 384) assert.equal(listMetrics.rowCount, 4, `384x824px mobile list must show four rows: ${JSON.stringify(listMetrics)}`);
      assert.ok(listMetrics.widthOverflow <= 1, `แท็บรายการต้องไม่ล้นแนวนอน: ${JSON.stringify(listMetrics)}`);
      assert.ok(listMetrics.heightOverflow <= 1, `แท็บรายการต้องไม่ล้นแนวตั้ง: ${JSON.stringify(listMetrics)}`);
      assert.ok(listMetrics.tableRight <= listMetrics.viewportWidth + 1, `ตารางต้องไม่ล้น viewport: ${JSON.stringify(listMetrics)}`);
    }
  }

  await browser.close();
  server.close();
  console.log('target viewport responsive tests passed');
})().catch(async error => {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  console.error(error);
  process.exitCode = 1;
});
