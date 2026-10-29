// Offline support: app shell is network-first (so updates show right away), libraries and fonts are cached.
const CACHE = 'bnb-hq-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('fonts')) return; // Firestore/Auth: never cache
  if (req.mode === 'navigate' || (url.origin === location.origin && /\.(html|webmanifest)$|\/$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  if (url.origin === location.origin || /gstatic\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; }).catch(() => hit); return hit || net; }));
  }
});
