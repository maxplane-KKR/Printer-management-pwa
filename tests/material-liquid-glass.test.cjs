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
const printers = Array.from({ length: 8 }, (_, index) => ({
  id: `glass-${index + 1}`,
  name: `Printer ${index + 1}`,
  ip: `10.0.0.${index + 1}`,
  location: 'WARD8',
  type: 'HP LaserJet MFP E52645',
  note: '',
  status: index % 3 === 0 ? 'offline' : 'online',
  lastUpdated: '13/08/2026 10:00',
}));

const server = http.createServer((request, response) => {
  if (request.url === '/api/printers') {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ ok: true, schemaVersion: 2, printers }));
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
});

let browser;

function assertGlassSurface(surface, viewport) {
  assert.match(
    surface.backdropFilter,
    /blur\(/,
    `${viewport} ${surface.selector} ต้องมี glass blur: ${JSON.stringify(surface)}`,
  );
  assert.match(
    surface.backgroundColor,
    /^rgba\(/,
    `${viewport} ${surface.selector} ต้องใช้พื้นผิวโปร่งแสง: ${JSON.stringify(surface)}`,
  );
  assert.doesNotMatch(
    surface.boxShadow,
    /(?:5px 5px|8px 8px) 0px/,
    `${viewport} ${surface.selector} ต้องเลิกใช้เงาแข็งแบบเดิม: ${JSON.stringify(surface)}`,
  );
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage();
  await page.route(/^https:\/\//, route => route.abort());

  for (const viewport of [
    { width: 384, height: 824 },
    { width: 1280, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`http://127.0.0.1:${port}/#mobile-manage`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.dataset.sheetSync === 'synced');

    const manageVisuals = await page.evaluate(() => {
      const readSurface = selector => {
        const style = getComputedStyle(document.querySelector(selector));
        return {
          selector,
          backgroundColor: style.backgroundColor,
          backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
          boxShadow: style.boxShadow,
          borderRadius: style.borderRadius,
        };
      };
      return {
        bodyBackground: getComputedStyle(document.body).backgroundImage,
        surfaces: ['.container > h1', '#mobile-form', '#mobile-tools'].map(readSurface),
      };
    });

    assert.match(
      manageVisuals.bodyBackground,
      /radial-gradient/,
      `${viewport.width}x${viewport.height} ต้องมี tonal ambient background`,
    );
    manageVisuals.surfaces.forEach(surface => assertGlassSurface(surface, `${viewport.width}x${viewport.height}`));
    assert.match(
      manageVisuals.bodyBackground,
      /rgba\(56, 189, 248, 0\.22\)/,
      `${viewport.width}x${viewport.height} ambient palette ต้องใช้ฟ้า sky blue โดยไม่มีม่วง`,
    );

    const defaultInputVisuals = await page.locator('#printer-name').evaluate(element => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        borderRadius: style.borderRadius,
        minHeight: style.minHeight,
      };
    });
    assert.match(defaultInputVisuals.backgroundColor, /^rgba\(/, `input ต้องเป็น tonal translucent surface: ${JSON.stringify(defaultInputVisuals)}`);
    assert.equal(defaultInputVisuals.borderColor, 'rgba(77, 91, 119, 0.42)', `input ต้องใช้ strong outline token: ${JSON.stringify(defaultInputVisuals)}`);
    assert.equal(defaultInputVisuals.borderRadius, '14px', `input ต้องใช้ Material control radius: ${JSON.stringify(defaultInputVisuals)}`);

    await page.locator('#printer-name').focus();
    const focusedInputVisuals = await page.locator('#printer-name').evaluate(element => {
      const style = getComputedStyle(element);
      return {
        outlineColor: style.outlineColor,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });
    assert.equal(focusedInputVisuals.outlineColor, 'rgb(37, 99, 235)', `input focus ring ต้องใช้ blue focus token: ${JSON.stringify(focusedInputVisuals)}`);
    assert.ok(Number.parseFloat(focusedInputVisuals.outlineWidth) >= 3, `input focus ring ต้องเห็นชัดอย่างน้อย 3px: ${JSON.stringify(focusedInputVisuals)}`);

    await page.locator('#submit-btn').focus();
    const submitVisuals = await page.locator('#submit-btn').evaluate(element => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderRadius: style.borderRadius,
        outlineColor: style.outlineColor,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });
    assert.equal(submitVisuals.backgroundColor, 'rgb(30, 64, 175)', `ปุ่มบันทึกต้องเป็น blue primary action: ${JSON.stringify(submitVisuals)}`);
    assert.equal(submitVisuals.color, 'rgb(255, 255, 255)', `ปุ่มบันทึกต้องใช้ on-primary contrast: ${JSON.stringify(submitVisuals)}`);
    assert.equal(submitVisuals.borderRadius, '14px', `ปุ่มบันทึกต้องใช้ Material control radius: ${JSON.stringify(submitVisuals)}`);
    assert.equal(submitVisuals.outlineColor, 'rgb(37, 99, 235)', `button focus ring ต้องใช้ blue focus token: ${JSON.stringify(submitVisuals)}`);
    assert.ok(Number.parseFloat(submitVisuals.outlineWidth) >= 3, `button focus ring ต้องเห็นชัดอย่างน้อย 3px: ${JSON.stringify(submitVisuals)}`);
    assert.doesNotMatch(submitVisuals.boxShadow, /5px 5px 0px/, `button ต้องใช้ soft elevation: ${JSON.stringify(submitVisuals)}`);

    const databaseActionVisuals = await page.evaluate(() => {
      const readColors = selector => {
        const style = getComputedStyle(document.querySelector(selector));
        return { backgroundColor: style.backgroundColor, color: style.color };
      };
      return {
        tcpScript: readColors('#copy-ping-script-btn'),
        exportCsv: readColors('#export-csv-btn'),
        updateStatus: readColors('#import-ping-results-btn'),
      };
    });
    assert.deepEqual(
      databaseActionVisuals.tcpScript,
      { backgroundColor: 'rgb(255, 218, 221)', color: 'rgb(173, 47, 56)' },
      `ปุ่มสคริปต์ TCP ต้องเป็นแดง tonal: ${JSON.stringify(databaseActionVisuals.tcpScript)}`,
    );
    assert.deepEqual(
      databaseActionVisuals.updateStatus,
      { backgroundColor: 'rgb(184, 241, 223)', color: 'rgb(11, 107, 88)' },
      `ปุ่มอัปเดตสถานะต้องเป็นเขียว tonal: ${JSON.stringify(databaseActionVisuals.updateStatus)}`,
    );
    assert.deepEqual(
      databaseActionVisuals.exportCsv,
      { backgroundColor: 'rgb(224, 242, 254)', color: 'rgb(7, 89, 133)' },
      `ปุ่ม Export CSV ต้องเป็นฟ้า sky tonal และไม่ซ้ำปุ่มเขียว: ${JSON.stringify(databaseActionVisuals.exportCsv)}`,
    );

    if (viewport.width <= 1024) await page.locator('[data-mobile-view="list"]').click();
    if (viewport.width <= 1024) await page.waitForTimeout(250);
    if (viewport.width <= 1024) {
      const activeTabColor = await page.locator('.mobile-tab[data-mobile-view="list"]').evaluate(element => getComputedStyle(element).backgroundColor);
      assert.equal(activeTabColor, 'rgb(219, 234, 254)', `active mobile tab ต้องใช้ blue primary container: ${activeTabColor}`);
    }
    const listVisuals = await page.evaluate(() => {
      const selectors = ['#mobile-list .filter-bar', '#mobile-list .table-wrapper'];
      return selectors.map(selector => {
        const style = getComputedStyle(document.querySelector(selector));
        return {
          selector,
          backgroundColor: style.backgroundColor,
          backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
          boxShadow: style.boxShadow,
          borderRadius: style.borderRadius,
        };
      });
    });
    listVisuals.forEach(surface => assertGlassSurface(surface, `${viewport.width}x${viewport.height}`));

    const emojiInInterface = await page.evaluate(() => {
      const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
      const interactiveLabels = [...document.querySelectorAll('button, a')]
        .map(element => element.textContent.trim())
        .filter(label => emojiPattern.test(label));
      const placeholders = [...document.querySelectorAll('input[placeholder]')]
        .map(element => element.getAttribute('placeholder'))
        .filter(label => emojiPattern.test(label));
      return [...interactiveLabels, ...placeholders];
    });
    assert.deepEqual(emojiInInterface, [], `structural icons ต้องใช้ SVG ไม่ใช่ emoji: ${JSON.stringify(emojiInInterface)}`);
  }

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 384, height: 824 });
  await page.goto(`http://127.0.0.1:${port}/#mobile-manage`, { waitUntil: 'domcontentloaded' });
  const motionVisuals = await page.locator('#submit-btn').evaluate(element => {
    const style = getComputedStyle(element);
    return {
      durations: style.transitionDuration.split(',').map(value => value.trim()),
      easing: style.transitionTimingFunction,
    };
  });
  assert.ok(motionVisuals.durations.every(duration => duration === '0.2s'), `Material state motion ต้องใช้ 200ms: ${JSON.stringify(motionVisuals)}`);
  assert.match(motionVisuals.easing, /cubic-bezier\(0\.2, 0, 0, 1\)/, `Material state motion ต้องใช้ emphasized easing: ${JSON.stringify(motionVisuals)}`);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reducedDurations = await page.locator('#submit-btn').evaluate(element =>
    getComputedStyle(element).transitionDuration.split(',').map(value => Number.parseFloat(value)),
  );
  assert.ok(
    reducedDurations.every(duration => duration <= 0.001),
    `reduced motion ต้องลด transition เหลือแทบศูนย์: ${JSON.stringify(reducedDurations)}`,
  );

  await browser.close();
  server.close();
  console.log('material liquid glass surface tests passed');
})().catch(async error => {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  console.error(error);
  process.exitCode = 1;
});
