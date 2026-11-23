/* Inside the iPhone apps (2026-11-22, JP: "maybe I should make a proper app for my phone"): _app/ wraps the live pages in
   Capacitor. This file only does something there – on the web it stops at the first line. It runs once (a head module):
   - links like jplcmd://cmd/food/ or jplcmd://?say=milk (Siri Shortcuts, widgets later) open that page in the app
   - a tapped reminder opens its page
   Reminders themselves are scheduled on the phone by notify.js (Native.notes). */
(function () {
  var C = window.Capacitor, on = !!(C && C.isNativePlatform && C.isNativePlatform()), P = on ? C.Plugins || {} : {};
  /* 2026-11-23: Face ID through the Keychain (passkey.js), Apple's document scanner (Papers) and small vibrations */
  function tap(kind) { var H = P.Haptics; if (!H) return; try { kind === 'done' ? H.notification({ type: 'SUCCESS' }) : H.impact({ style: kind === 'firm' ? 'MEDIUM' : 'LIGHT' }); } catch (e) {} }
  function scan() {   /* → [{ url, w, h }] JPEG pages, or [] when cancelled */
    var D = P.DocumentScanner; if (!D) return Promise.reject(new Error('no scanner'));
    return D.scanDocument({ responseType: 'base64', croppedImageQuality: 85, letUserAdjustCrop: true }).then(function (r) {
      var L = (r && r.status !== 'cancel' && r.scannedImages) || [];
      return Promise.all(L.map(function (b) { var url = /^data:/.test(b) ? b : 'data:image/jpeg;base64,' + b;
        return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok({ url: url, w: i.naturalWidth, h: i.naturalHeight }); }; i.onerror = function () { ok(null); }; i.src = url; }); }))
        .then(function (a) { return a.filter(Boolean); });
    });
  }
  window.Native = { on: on, app: on ? (/homeapp\//.test(navigator.userAgent) ? 'home' : 'cmd') : '', notes: on ? P.LocalNotifications || null : null, bio: on ? P.NativeBiometric || null : null, scan: on && P.DocumentScanner ? scan : null, tap: on ? tap : function () {},
    scheme: on ? (/homeapp\//.test(navigator.userAgent) ? 'jplhome://' : 'jplcmd://') : '' };
  if (!on) return;
  document.documentElement.classList.add('in-app');
  /* a light tap when something is ticked off; a short "done" when something is saved */
  document.addEventListener('change', function (e) { var t = e.target; if (t && (t.type === 'checkbox' || t.type === 'radio') && !t.closest('#lock')) tap(t.checked ? 'tick' : 'untick'); }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button, [role=button], label'); if (!b || !b.dataset) return;
    var ks = Object.keys(b.dataset).join(' ');
    if (/tick|done|smx|chk|check|toggle/i.test(ks) && !/undo|del|rm|x$/i.test(ks)) tap('tick');
  }, true);
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
