/* Reminders by place (2026-11-20, JP): an open to-do with a place (script.js, "Remind me at a place") – when cmd is open
   and you're within about 250 m, a toast (and a notification if they're allowed) says so. Checked when the dashboard
   unlocks, when the tab comes back, and every two minutes while it's open – only if the location is already allowed
   (it's asked once, when you pick the first place). A web app can't watch the location in the background, so it
   only works while cmd is open. Each to-do tells you at most once every six hours (localStorage dash.plSaid). */
(function () {
  'use strict';
  var R = 250, K = function (n, e, o) { return window.I18N && I18N.k ? I18N.k(n, e, o) : e; };
  function todos() { try { return (JSON.parse(localStorage.getItem('dash.todos')) || []).filter(function (t) { return t && !t.done && t.place && isFinite(t.place.lat) && isFinite(t.place.lon); }); } catch (e) { return []; } }
  function dist(a, b, c, d) { var r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return Math.sqrt(x * x + y * y) * 6371000; }
  var busy = false;
  function check() {
    if (busy || document.visibilityState !== 'visible' || !navigator.geolocation || !document.documentElement.classList.contains('unlocked')) return;
    var l = todos(); if (!l.length) return;
    var go = function () {
      busy = true;
      navigator.geolocation.getCurrentPosition(function (pos) {
        busy = false;
        var said = {}; try { said = JSON.parse(localStorage.getItem('dash.plSaid') || '{}') || {}; } catch (e) {}
        var now = Date.now(), lat = pos.coords.latitude, lon = pos.coords.longitude;
        l.forEach(function (t) {
          if (dist(lat, lon, t.place.lat, t.place.lon) > R || (said[t.id] && now - said[t.id] < 6 * 36e5)) return;
          said[t.id] = now;
          if (window.NotesPanel && NotesPanel.note) NotesPanel.note('place', '/cmd/#c=todo');   /* listed in the notification panel too (only the kind) */
          var title = K('ui.pl-near', 'You’re near {p}', { p: t.place.name });
          if (window.Quick && Quick.toast) Quick.toast('<i class="bi bi-geo-alt-fill"></i> ' + title.replace(/[<>&]/g, '') + ' – ' + String(t.text || '').replace(/[<>&]/g, ''));
          if (window.Notification && Notification.permission === 'granted' && navigator.serviceWorker) navigator.serviceWorker.getRegistration('/cmd/').then(function (reg) { if (reg) reg.showNotification(title, { body: t.text || '', tag: 'place:' + t.id, data: { url: '/cmd/' } }); }).catch(function () {});
        });
        try { localStorage.setItem('dash.plSaid', JSON.stringify(said)); } catch (e) {}
      }, function () { busy = false; }, { enableHighAccuracy: false, maximumAge: 60e3, timeout: 15000 });
    };
    if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: 'geolocation' }).then(function (s) { if (s.state === 'granted') go(); }, function () {});
  }
  if (window.Vault && Vault.onUnlock) Vault.onUnlock(function () { setTimeout(check, 1500); });
  document.addEventListener('visibilitychange', check);
  setInterval(check, 2 * 60e3);
  window.PlaceRemind = { check: check, dist: dist };
})();
