const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const readRootFile = fileName => fs.readFileSync(path.join(root, fileName), 'utf8');

(async () => {
const html = readRootFile('Index.html');
assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/);
assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="\/assets\/icons\/apple-touch-icon\.png">/);
assert.match(html, /<link rel="icon" href="\/assets\/icons\/favicon\.ico" sizes="any">/);
assert.match(html, /<link rel="mask-icon" href="\/assets\/icons\/safari-pinned-tab\.svg" color="#20252B">/);
assert.match(html, /<meta name="theme-color" content="#F4C95D">/);
assert.match(html, /<meta name="msapplication-TileImage" content="\/assets\/icons\/mstile-150x150\.png">/);
assert.match(html, /navigator\.serviceWorker\.register\('\/service-worker\.js'\)/);

const manifest = JSON.parse(readRootFile('manifest.webmanifest'));

assert.equal(manifest.id, '/');
assert.equal(manifest.name, 'Printer Management Pro');
assert.equal(manifest.short_name, 'Printer Pro');
assert.equal(manifest.description, 'ระบบจัดการและติดตามสถานะเครื่องพิมพ์');
assert.equal(manifest.lang, 'th');
assert.equal(manifest.start_url, '/');
assert.equal(manifest.scope, '/');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.background_color, '#FFFDF7');
assert.equal(manifest.theme_color, '#F4C95D');

const expectedIcons = [
  ['/assets/icons/icon-192.png', '192x192', 'any'],
  ['/assets/icons/icon-512.png', '512x512', 'any'],
  ['/assets/icons/icon-maskable-192.png', '192x192', 'maskable'],
  ['/assets/icons/icon-maskable-512.png', '512x512', 'maskable']
];

for (const [src, sizes, purpose] of expectedIcons) {
  assert.ok(
    manifest.icons.some(icon =>
      icon.src === src &&
      icon.sizes === sizes &&
      icon.type === 'image/png' &&
      icon.purpose === purpose
    ),
    `manifest ต้องอ้างอิง ${src} แบบ ${purpose}`
  );
}

const listeners = {};
const cacheEntries = new Map();
const deletedCaches = [];
const backgroundTasks = [];
let fetchedUrls = [];

const caches = {
  async open(name) {
    return {
      async addAll(urls) {
        cacheEntries.set(name, [...urls]);
      },
      async match() {
        return undefined;
      },
      async put() {}
    };
  },
  async keys() {
    return ['printer-management-shell-v0', 'printer-management-shell-v1'];
  },
  async delete(name) {
    deletedCaches.push(name);
    return true;
  },
  async match() {
    return undefined;
  }
};

const sandbox = {
  URL,
  caches,
  fetch: async request => {
    fetchedUrls.push(typeof request === 'string' ? request : request.url);
    return { ok: true, clone() { return this; } };
  },
  self: {
    location: { origin: 'https://printer.example' },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    skipWaiting() {},
    clients: { claim: async () => {} }
  }
};

vm.runInNewContext(readRootFile('service-worker.js'), sandbox, {
  filename: 'service-worker.js'
});

for (const eventName of ['install', 'activate', 'fetch']) {
  assert.equal(typeof listeners[eventName], 'function', `service worker ต้องรองรับ ${eventName}`);
}

let installTask;
listeners.install({ waitUntil(task) { installTask = task; } });
await installTask;
assert.deepEqual(cacheEntries.get('printer-management-shell-v1'), [
  '/',
  '/Index.html',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
]);

let activateTask;
listeners.activate({ waitUntil(task) { activateTask = task; } });
await activateTask;
assert.deepEqual(deletedCaches, ['printer-management-shell-v0']);

function dispatchFetch(url, method = 'GET') {
  let responseTask;
  listeners.fetch({
    request: { url, method },
    respondWith(task) { responseTask = task; },
    waitUntil(task) { backgroundTasks.push(task); }
  });
  return responseTask;
}

assert.equal(
  dispatchFetch('https://printer.example/api/printers'),
  undefined,
  'คำขอ API ต้องเป็น network-only และไม่ถูก service worker intercept'
);
assert.equal(
  dispatchFetch('https://printer.example/Index.html', 'POST'),
  undefined,
  'คำขอที่แก้ไขข้อมูลต้องไม่ถูก service worker intercept'
);

const staticResponse = dispatchFetch('https://printer.example/assets/icons/icon-192.png');
assert.ok(staticResponse instanceof Promise, 'ไฟล์ static แบบ GET ต้องใช้กลยุทธ์ cache-first');
await staticResponse;
await Promise.all(backgroundTasks);
assert.deepEqual(fetchedUrls, ['https://printer.example/assets/icons/icon-192.png']);

const vercel = JSON.parse(readRootFile('vercel.json'));
const packageMetadata = JSON.parse(readRootFile('package.json'));
assert.deepEqual(vercel.rewrites, [{ source: '/', destination: '/Index.html' }]);
assert.equal(packageMetadata.private, true);
assert.equal(packageMetadata.engines.node, '24.x');
assert.equal(vercel.functions, undefined, 'Node runtime ต้องกำหนดด้วย package.json engines');

const serviceWorkerHeader = vercel.headers.find(route => route.source === '/service-worker.js');
assert.ok(serviceWorkerHeader, 'Vercel ต้องกำหนด header ให้ service worker');
assert.ok(
  serviceWorkerHeader.headers.some(header =>
    header.key.toLowerCase() === 'cache-control' && header.value === 'no-cache'
  ),
  'service worker ต้องใช้ Cache-Control: no-cache'
);

const manifestHeader = vercel.headers.find(route => route.source === '/manifest.webmanifest');
assert.ok(manifestHeader, 'Vercel ต้องกำหนด Content-Type ให้ manifest');
assert.ok(
  manifestHeader.headers.some(header =>
    header.key.toLowerCase() === 'content-type' &&
    header.value === 'application/manifest+json; charset=utf-8'
  ),
  'manifest ต้องส่ง Content-Type สำหรับ web app manifest'
);

console.log('PWA shell contract tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
