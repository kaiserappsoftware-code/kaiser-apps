// Service worker Apps Pekerja: simpan fail apps supaya boleh dibuka tanpa internet.
const CACHE = 'kaiser-pekerja-v13';
const FILES = ['./', './index.html', './manifest.json', '../app.js', '../akaun-lib.js', '../bahasa.js', '../bahasa-en.js', '../styles.css', '../firebase-config.js', './icon-64.png', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('kaiser-pekerja')).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Rangkaian dahulu supaya kemas kini apps terus diterima; cache bila luar talian.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
