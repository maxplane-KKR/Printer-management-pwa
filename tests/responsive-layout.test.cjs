const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.join(__dirname, '..', 'Index.html');
const html = fs.readFileSync(indexPath, 'utf8');

const desktopFunctionMatch = html.match(
  /function isDesktopScreen\(\)\s*\{([\s\S]*?)\n\s*\}/
);
assert.ok(desktopFunctionMatch, 'ต้องพบฟังก์ชัน isDesktopScreen()');

const desktopFunctionBody = desktopFunctionMatch[1];
const isDesktopScreen = new Function('document', 'window', desktopFunctionBody);

const viewportCases = [
  { viewportWidth: 320, screenWidth: 1920, screenHeight: 1080, expected: false },
  { viewportWidth: 768, screenWidth: 1366, screenHeight: 768, expected: false },
  { viewportWidth: 1024, screenWidth: 1920, screenHeight: 1080, expected: false },
  { viewportWidth: 1025, clientWidth: 1010, screenWidth: 1366, screenHeight: 768, expected: true },
  { viewportWidth: 1025, screenWidth: 1366, screenHeight: 768, expected: true },
  { viewportWidth: 1366, screenWidth: 1366, screenHeight: 768, expected: true },
  { viewportWidth: 1440, screenWidth: 1920, screenHeight: 900, expected: true }
];

for (const testCase of viewportCases) {
  const actual = isDesktopScreen(
    { documentElement: { clientWidth: testCase.clientWidth || testCase.viewportWidth } },
    {
      innerWidth: testCase.viewportWidth,
      screen: { width: testCase.screenWidth, height: testCase.screenHeight }
    }
  );

  assert.equal(
    actual,
    testCase.expected,
    `viewport ${testCase.viewportWidth}px ต้องเป็น ${testCase.expected ? 'desktop' : 'compact'}`
  );
}

assert.doesNotMatch(
  desktopFunctionBody,
  /window\.screen|screenWidth|screenHeight/,
  'การเลือก layout ต้องไม่ขึ้นกับ physical screen'
);

const mobileNavStyleMatch = html.match(
  /<style data-mobile-nav="native">([\s\S]*?)<\/style>/
);
assert.ok(mobileNavStyleMatch, 'ต้องพบ style ของ mobile navigation');
assert.doesNotMatch(
  mobileNavStyleMatch[1],
  /max-height/,
  'responsive breakpoint ต้องไม่ขึ้นกับความสูงหน้าจอ'
);

const compactBreakpointCount = (
  mobileNavStyleMatch[1].match(/@media \(max-width: 1024px\)/g) || []
).length;
assert.ok(
  compactBreakpointCount >= 2,
  'mobile navigation และ compact panel ต้องใช้ breakpoint สูงสุด 1024px'
);
assert.match(
  html,
  /\.btn \{\s*\n\s*min-height: 44px;/,
  'ปุ่มหลักต้องมี touch target สูงอย่างน้อย 44px'
);
assert.match(
  mobileNavStyleMatch[1],
  /\.btn-sm \{ min-height: 44px; \}/,
  'ปุ่มขนาดเล็กบน compact layout ต้องสูงอย่างน้อย 44px'
);
assert.match(
  mobileNavStyleMatch[1],
  /\.clear-search-btn \{[^}]*width: 44px; height: 44px;/,
  'ปุ่มล้างช่องค้นหาต้องมีพื้นที่แตะอย่างน้อย 44px'
);

const mobileTableStyleMatch = html.match(
  /<style data-mobile-table="compact">([\s\S]*?)<\/style>/
);
assert.ok(mobileTableStyleMatch, 'ต้องพบ style ของ mobile table');
assert.match(
  mobileTableStyleMatch[1],
  /@media \(max-width: 1024px\)/,
  'mobile table ต้องครอบคลุม viewport ถึง 1024px'
);
assert.match(
  mobileTableStyleMatch[1],
  /#main-table td:nth-child\(8\) \.btn \{[^}]*min-height: 44px;/,
  'ปุ่มจัดการใน mobile table ต้องสูงอย่างน้อย 44px'
);

console.log('responsive layout breakpoint tests passed');
