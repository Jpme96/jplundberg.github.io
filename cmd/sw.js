/* Service worker for the /cmd app.
   - Pages: network first – always the newest version online, the last copy offline.
   - Scripts, styles, icons (versioned …?v=12) and fonts: from the cache, so changing page is instant.
     A new version has a new address, so it's fetched the first time it's needed.
   - The private API is never cached – your data lives encrypted in the vault, not here. */
var CACHE = 'cmd-v37';

/* on install: keep a copy of every page, so the dashboard opens even without a connection
   (pages behind the Cloudflare login that answer with a redirect are skipped) */
var PAGES = ['/cmd/', '/cmd/calendar/', '/cmd/travel/', '/cmd/finance/', '/cmd/habits/', '/cmd/work/', '/cmd/house/', '/cmd/people/', '/cmd/food/'];
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(PAGES.map(function (u) {
      return fetch(u, { credentials: 'same-origin', redirect: 'manual' }).then(function (res) {
        if (!res.ok || res.type !== 'basic') return;
        return res.clone().text().then(function (html) {
          /* and the scripts and styles that page needs */
          var deps = [], re = /(?:src|href)="([^"]+\?v=[^"]+)"/g, m;
          while ((m = re.exec(html))) deps.push(new URL(m[1], self.location.origin + u).toString());
          return Promise.all([c.put(u, res)].concat(deps.map(function (d) { return c.match(d).then(function (hit) { return hit || fetch(d).then(function (r) { if (r.ok) return c.put(d, r); }); }).catch(function () {}); })));
        });
      }).catch(function () {});
    }));
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
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
        if (res.ok && res.type === 'basic' && !res.redirected) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
    return;
  }
  /* Pages: the copy you already have opens at once (no waiting for the network on every tab),
     and a fresh copy is fetched in the background for next time. Scripts are versioned, so a page
     never mixes old and new code. */
  if (req.mode === 'navigate' && PAGES.indexOf(url.pathname) > -1 && !url.search) {
    e.respondWith(caches.open(CACHE).then(function (c) {
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
    }));
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
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Dashboard', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Dashboard', {
    body: d.body || '', tag: d.tag || undefined, data: { url: d.url || '/cmd/' },
    icon: '/cmd/assets/icons/icon-192.png', badge: '/cmd/assets/icons/icon-192.png'
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
