/* The shared app's own service worker – only for notifications (nothing is cached here). */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
try { importScripts('/cmd/push-key.js'); } catch (x) {}
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Home', body: e.data ? e.data.text() : '' }; }
  /* a reminder comes sealed (F-R): open it with this device's key; without the key, a plain "Reminder" */
  var text = d.c !== undefined && self.PushKey ? self.PushKey.open(d.c).then(function (m) { return m || self.PushKey.fallback(); }) : Promise.resolve({ t: d.title || 'Home', b: d.body || '' });
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
