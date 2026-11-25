/* Team's service worker: opens without signal (the app's own files are kept here; the data is in IndexedDB, still encrypted)
   and shows push notifications when Team is closed. /api is never cached. */
var CACHE = 'team-shell-2';
var SHELL = ['/', '/app.js', '/app.css', '/manifest.webmanifest', '/icon-192.png', '/icon-180.png',
  '/dc/doc-control.js', '/dc/xlsx-view.js', '/dc/paged-pdf.js', '/dc/ns.js', '/dc/words.js', '/dc/dc.css', '/dc/bi/bi.css'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: 'reload', credentials: 'same-origin' })).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
/* the network first (so you always get the newest app), the kept copy when there is no signal */
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.indexOf('/api/') === 0 || u.pathname.indexOf('/cdn-cgi/') === 0) return;
  var key = r.mode === 'navigate' ? '/' : u.pathname;
  e.respondWith(fetch(r).then(function (res) {
    if (res.ok && res.type === 'basic' && !res.redirected) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(key, copy); }); }
    return res;
  }).catch(function () { return caches.match(key).then(function (m) { return m || (r.mode === 'navigate' ? caches.match('/') : null) || Response.error(); }); }));   /* only a page falls back to the app – a file (version.txt) never gets the page instead (2026-11-25) */
});
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Team', { body: d.body || '', tag: d.tag || 'team', icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) { for (var i = 0; i < cs.length; i++) if ('focus' in cs[i]) return cs[i].focus(); return self.clients.openWindow(url); }));
});
