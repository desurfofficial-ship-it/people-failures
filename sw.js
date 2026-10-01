// service worker for people-failures — offline-first progressive enhancement
const CACHE = 'gf-cache-v2';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './data-mega-v2.js',
  './scenario-catalog-seeds.js',
  './scenario-catalog.js',
  './script.js',
  './manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Use addAll with try/catch per-asset so a single 404 doesn't break the whole cache.
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(url).catch(function () { /* skip missing */ });
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const url = new URL(e.request.url);
  // Skip cross-origin — we only cache same-origin assets.
  if (url.origin !== self.location.origin) return;
  // Skip non-GET.
  if (e.request.method !== 'GET') return;

  // Network-first for HTML so users get updates; cache fallback offline.
  if (e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(e.request).then(function (resp) {
        const copy = resp.clone();
        caches.open(CACHE).then(function (cache) { cache.put(e.request, copy); }).catch(function () {});
        return resp;
      }).catch(function () {
        return caches.match(e.request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Cache-first for static assets.
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (resp) {
        const copy = resp.clone();
        caches.open(CACHE).then(function (cache) { cache.put(e.request, copy); }).catch(function () {});
        return resp;
      }).catch(function () { return cached || Response.error(); });
    })
  );
});
