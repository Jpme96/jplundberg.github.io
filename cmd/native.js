/* Inside the iPhone apps (2026-11-22, JP: "maybe I should make a proper app for my phone"): _app/ wraps the live pages in
   Capacitor. This file only does something there – on the web it stops at the first line. It runs once (a head module):
   - links like jplcmd://cmd/food/ or jplcmd://?say=milk (Siri Shortcuts, widgets later) open that page in the app
   - a tapped reminder opens its page
   Reminders themselves are scheduled on the phone by notify.js (Native.notes). */
(function () {
  var C = window.Capacitor, on = !!(C && C.isNativePlatform && C.isNativePlatform()), P = on ? C.Plugins || {} : {};
  window.Native = { on: on, app: on ? (/homeapp\//.test(navigator.userAgent) ? 'home' : 'cmd') : '', notes: on ? P.LocalNotifications || null : null,
    scheme: on ? (/homeapp\//.test(navigator.userAgent) ? 'jplhome://' : 'jplcmd://') : '' };
  if (!on) return;
  document.documentElement.classList.add('in-app');
  /* jplcmd://cmd/food/#shop → /cmd/food/#shop; jplcmd://?say=milk → /cmd/?say=milk (the scheme's host is the first folder) */
  function open(url) {
    var m = /^jpl(?:cmd|home):\/\/([^?#]*)([?#].*)?$/.exec(url || ''); if (!m) return;
    var path = '/' + m[1].replace(/^\/+/, ''); if (!/^\/cmd(\/|$)/.test(path)) path = '/cmd/' + path.replace(/^\/+/, '');
    location.href = path.replace(/\/{2,}/g, '/') + (m[2] || '');
  }
  /* no form toolbar (arrows and ✓) above the keyboard – an app can hide it, a website can't */
  if (P.Keyboard && P.Keyboard.setAccessoryBarVisible) P.Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(function () {});
  if (P.App && P.App.addListener) {
    P.App.addListener('appUrlOpen', function (e) { open(e && e.url); });
    if (P.App.getLaunchUrl) P.App.getLaunchUrl().then(function (r) { if (r && r.url && !sessionStorage.getItem('dash.app.launched')) { sessionStorage.setItem('dash.app.launched', '1'); open(r.url); } }).catch(function () {});
  }
  if (window.Native.notes && window.Native.notes.addListener)
    window.Native.notes.addListener('localNotificationActionPerformed', function (a) { var u = a && a.notification && a.notification.extra && a.notification.extra.url; if (u && /^\/cmd\//.test(u)) location.href = u; });
})();
