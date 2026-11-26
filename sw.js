// Service worker: simpan fail apps supaya boleh dibuka tanpa internet.
const CACHE = 'kaiser-v21';
const FILES = ['./', './index.html', './styles.css', './app.js', './buku-tunai.js', './akaun-lib.js', './bahasa.js', './bahasa-en.js', './manifest.json', './icon-192.png', './icon-512.png', './icon-64.png', './firebase-config.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && !k.startsWith('kaiser-pekerja')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Hanya fail apps sendiri; sambungan Firebase/Firestore tidak disimpan dalam cache.
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/pekerja/')) return;
  // Rangkaian dahulu supaya kemas kini apps terus diterima; cache bila luar talian.
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
