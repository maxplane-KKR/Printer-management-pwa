const CACHE_NAME = 'printer-management-shell-v4';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/icons/icon-any-192-v3.png',
  '/assets/icons/icon-any-512-v3.png',
  '/assets/icons/icon-maskable-192-v2.png',
  '/assets/icons/icon-maskable-512-v2.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/favicon.ico',
  '/assets/icons/mstile-150x150.png',
  '/assets/icons/safari-pinned-tab.svg'
];
const CACHEABLE_PATHS = new Set(APP_SHELL);

function isCacheableStaticRequest(request, url) {
  return request.method === 'GET' &&
    url.origin === self.location.origin &&
    (CACHEABLE_PATHS.has(url.pathname) || url.pathname.startsWith('/assets/'));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isCacheableStaticRequest(request, url)) {
    return;
  }

  const networkResponse = fetch(request).then(response => {
    if (!response || !response.ok) {
      return response;
    }

    const responseCopy = response.clone();
    caches.open(CACHE_NAME)
      .then(cache => cache.put(request, responseCopy))
      .catch(() => {});

    return response;
  });

  event.respondWith(
    caches.match(request).then(cachedResponse => cachedResponse || networkResponse)
  );
  event.waitUntil(networkResponse.catch(() => undefined));
});
