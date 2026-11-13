/* Service worker for the /cmd app.
   - Pages: network first – always the newest version online, the last copy offline.
   - Scripts, styles, icons (versioned …?v=12) and fonts: from the cache, so changing page is instant.
     A new version has a new address, so it's fetched the first time it's needed.
   - The private API is never cached – your data lives encrypted in the vault, not here. */
var CACHE = 'cmd-v3f58485d7b';
/* versioned files (…?v=…, fonts, images) never change, so they live in their own cache that survives updates:
   a new version of the app only downloads the files that actually changed */
var ASSETS = 'cmd-assets';
/* the last good version (Phase D): a version that reached the lock screen is "good" (the page says so). Its copy is
   kept when a new version comes, and if the new one doesn't start, the page asks to go back to it ("use") until you
   try the new one again – or until the next version, which gets a fresh try. Kept in a small cache of its own. */
var META = 'cmd-meta';
function meta(k) { return caches.open(META).then(function (c) { return c.match('/' + k); }).then(function (r) { return r ? r.text() : ''; }); }
function setMeta(k, v) { return caches.open(META).then(function (c) { return v ? c.put('/' + k, new Response(v)) : c.delete('/' + k); }); }
self.addEventListener('message', function (e) {
  var d = e.data || {}, port = e.ports && e.ports[0], reply = function (x) { if (port) port.postMessage(x); };
  if (d.lgv === 'good') e.waitUntil(meta('use').then(function (u) { return u ? null : setMeta('good', CACHE); }).then(function () { reply({ ok: true, good: CACHE }); }));
  else if (d.lgv === 'back') e.waitUntil(meta('good').then(function (g) { if (!g || g === CACHE) { reply({ use: '' }); return; } return caches.has(g).then(function (has) { if (!has) { reply({ use: '' }); return; } return setMeta('use', g).then(function () { reply({ use: g }); }); }); }));
  else if (d.lgv === 'forward') e.waitUntil(setMeta('use', '').then(function () { reply({ ok: true }); }));
  else if (d.lgv === 'state') e.waitUntil(Promise.all([meta('good'), meta('use')]).then(function (x) { reply({ current: CACHE, good: x[0], use: x[1] }); }));
});

/* on install: keep a copy of every page, so the dashboard opens even without a connection
   (pages behind the Cloudflare login that answer with a redirect are skipped) */
var PAGES = ['/cmd/', '/cmd/calendar/', '/cmd/travel/', '/cmd/finance/', '/cmd/habits/', '/cmd/work/', '/cmd/house/', '/cmd/people/', '/cmd/food/', '/cmd/wish/', '/cmd/goals/', '/cmd/papers/', '/cmd/admin/'];
self.addEventListener('install', function (e) {
  self.skipWaiting();
  /* One page at a time (with its new files), not everything at once: an update used to download
     13 pages and ~30 scripts in parallel while you were changing pages, which made the menu stutter.
     Until this finishes, the previous version keeps serving its own copies. */
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return caches.open(ASSETS).then(function (a) {
      var seen = {};
      function one(u) {
        return fetch(u, { credentials: 'same-origin', redirect: 'manual' }).then(function (res) {
          if (!res.ok || res.type !== 'basic') return;
          return res.clone().text().then(function (html) {
            /* and the scripts and styles that page needs (each file once) */
            var deps = [], re = /(?:src|href)="([^"]+\?v=[^"]+)"/g, m;
            while ((m = re.exec(html))) { var d = new URL(m[1], self.location.origin + u).toString(); if (!seen[d]) { seen[d] = 1; deps.push(d); } }
            return deps.reduce(function (p, d) {
              return p.then(function () { return a.match(d).then(function (hit) { return hit || fetch(d).then(function (r) { if (r.ok) return a.put(d, r); }); }).catch(function () {}); });
            }, Promise.resolve()).then(function () { return c.put(u, res); });
          });
        }).catch(function () {});
      }
      return PAGES.reduce(function (p, u) { return p.then(function () { return one(u); }); }, Promise.resolve());
    });
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(Promise.all([caches.keys(), meta('good')]).then(function (x) {
    var keys = x[0], good = x[1];
    /* a new version gets a fresh try (no "use" left over); the last good copy stays, older ones go */
    return setMeta('use', '').then(function () { return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== ASSETS && k !== META && k !== good; }).map(function (k) { return caches.delete(k); })); });
  }).then(function () {   /* keep the asset cache from growing forever: the newest 250 files stay */
    return caches.open(ASSETS).then(function (a) { return a.keys().then(function (ks) { return Promise.all(ks.slice(0, Math.max(0, ks.length - 250)).map(function (k) { return a.delete(k); })); }); });
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  var same = url.origin === self.location.origin;
  /* fonts: from the cache at once, refreshed in the background */
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
    return;
  }
  var mine = same && (url.pathname.indexOf('/cmd/') === 0 || url.pathname.indexOf('/assets/vendor/bootstrap-icons/') === 0 || url.pathname.indexOf('/assets/img/') === 0);
  if (!mine || url.pathname.indexOf('/cmd/api/') === 0) return;      // let the browser handle it
  /* Scripts, styles and images with a version (…?v=12) never change: straight from the cache,
     so changing page doesn't wait for 25 downloads. The pages themselves always come fresh. */
  var fixed = /[?&]v=/.test(url.search) || url.pathname.indexOf('/assets/') > -1 || /\.(png|jpg|webp|woff2?)$/.test(url.pathname);
  if (fixed && req.mode !== 'navigate') {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok && res.type === 'basic' && !res.redirected) { var copy = res.clone(); caches.open(ASSETS).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
    return;
  }
  /* Pages: the copy you already have opens at once (no waiting for the network on every tab),
     and a fresh copy is fetched in the background for next time. Scripts are versioned, so a page
     never mixes old and new code. */
  if (req.mode === 'navigate' && PAGES.indexOf(url.pathname) > -1 && !url.search) {
    e.respondWith(meta('use').then(function (use) {
      /* going back to the last good version: its pages (and so its scripts) */
      if (use) return caches.open(use).then(function (c) { return c.match(url.pathname); }).then(function (h) { return h || caches.open(CACHE).then(function (c) { return c.match(url.pathname); }).then(function (h2) { return h2 || fetch(req); }); });
      return caches.open(CACHE).then(function (c) {
      return Promise.all([c.match(url.pathname), c.match('/cmd/__login')]).then(function (x) {
        var hit = x[0], login = x[1];
        var net = fetch(req).then(function (res) {
          if (res.ok && res.type === 'basic' && !res.redirected) { c.put(url.pathname, res.clone()); c.delete('/cmd/__login'); }
          /* Cloudflare wants you to log in again: the next page comes from the network, so you see the login */
          else if (res.redirected || res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) c.put('/cmd/__login', new Response('1'));
          return res;
        });
        if (hit && !login) { e.waitUntil(net.catch(function () {})); return hit; }
        return net.catch(function () { return c.match('/cmd/').then(function (h) { return h || Response.error(); }); });
      });
    }); }));
    return;
  }
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

/* ---------- notifications (Settings → Notifications, off until you switch them on) ---------- */
try { importScripts('/cmd/push-key.js'); } catch (x) {}
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Dashboard', body: e.data ? e.data.text() : '' }; }
  /* a reminder comes sealed with this device's key (F-R); things from the other one with the shared key; without the key, a plain line */
  var text = self.PushKey ? self.PushKey.text(d, false) : Promise.resolve({ t: d.title || 'Dashboard', b: d.body || '' });   /* sealed (F-R and the shared key) – never readable on the way */
  e.waitUntil(text.then(function (m) {
    return self.registration.showNotification(m.t || 'Dashboard', { body: m.b || '', tag: d.tag || undefined, data: { url: d.url || '/cmd/' },
      icon: '/cmd/assets/icons/icon-192.png', badge: '/cmd/assets/icons/icon-192.png' });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/cmd/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf('/cmd/') > -1 && 'focus' in c) { if ('navigate' in c) c.navigate(url).catch(function () {}); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
