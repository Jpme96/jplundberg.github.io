/* The shared app's own service worker – only for notifications (nothing is cached here). */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
try { importScripts('/cmd/push-key.js'); } catch (x) {}
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Home', body: e.data ? e.data.text() : '' }; }
  /* a reminder comes sealed with this device's key (F-R); things from the other one with the shared key; without the key, a plain line */
  var text = self.PushKey ? self.PushKey.text(d, true) : Promise.resolve({ t: d.title || 'Home', b: d.body || '' });   /* sealed (F-R and the shared key) – never readable on the way */
  e.waitUntil(text.then(function (m) {
    return self.registration.showNotification(m.t || 'Home', { body: m.b || '', tag: d.tag || undefined, data: { url: d.url || '/cmd/home/' },
      icon: '/cmd/assets/icons/icon-192.png', badge: '/cmd/assets/icons/icon-192.png' });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/cmd/home/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { var c = list[i]; if (c.url.indexOf('/cmd/home') > -1 && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
