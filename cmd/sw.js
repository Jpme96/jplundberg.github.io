/* Service worker for the /cmd app.
   Network first, always: you get the newest version whenever you're online, and the last
   copy when you're not (on a plane, in the tunnel). The private API is never cached –
   your data lives encrypted in the vault, not here. */
var CACHE = 'cmd-v1';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  var same = url.origin === self.location.origin;
  var mine = same && (url.pathname.indexOf('/cmd/') === 0 || url.pathname.indexOf('/assets/vendor/bootstrap-icons/') === 0 || url.pathname.indexOf('/assets/img/') === 0);
  if (!mine || url.pathname.indexOf('/cmd/api/') === 0) return;      // let the browser handle it
  e.respondWith(
    fetch(req).then(function (res) {
      /* only keep normal, successful answers (not the Cloudflare Access login) */
      if (res.ok && res.type === 'basic' && !res.redirected) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (hit) {
        if (hit) return hit;
        if (req.mode !== 'navigate') return Response.error();
        return caches.match('/cmd/').then(function (home) { return home || Response.error(); });
      });
    })
  );
});
