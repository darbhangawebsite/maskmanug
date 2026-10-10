const CACHE = 'maskmanug-shell-v4';
const ROOT = new URL('./', self.location.href);
const SHELL = [
  new URL('./', ROOT).href,
  new URL('index.html', ROOT).href,
  new URL('styles.css', ROOT).href,
  new URL('app.js', ROOT).href,
  new URL('config.json', ROOT).href,
  new URL('manifest.webmanifest', ROOT).href,
  new URL('icons/icon-192.png', ROOT).href,
  new URL('icons/icon-512.png', ROOT).href,
  new URL('icons/maskmanug-logo.png', ROOT).href,
  new URL('icons/maskable-512.png', ROOT).href
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/data/channel.json') || url.pathname.endsWith('/config.json')) {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(new URL('index.html', ROOT).href)));
    return;
  }
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy));
    }
    return response;
  })));
});
