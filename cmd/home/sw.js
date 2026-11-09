/* The shared app's own service worker – only for notifications (nothing is cached here). */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Home', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Home', {
    body: d.body || '', tag: d.tag || undefined, data: { url: d.url || '/cmd/home/' },
    icon: '/cmd/assets/icons/icon-192.png', badge: '/cmd/assets/icons/icon-192.png'
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
