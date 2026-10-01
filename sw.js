// service worker for people-failures — offline-first progressive enhancement
const CACHE = 'gf-cache-v3';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './real-cases.js',
  './script.js',
  './sw.js',
  './manifest.webmanifest',
  './scale-test.html',
  './scale-test.js',
  './REPORT.md'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(url).catch(function () {});
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
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== 'GET') return;

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
