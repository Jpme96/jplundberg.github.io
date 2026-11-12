/* Reminders sealed on this device (F-R, 2026-11-12). Each device makes its own AES-GCM key once (not extractable,
   kept in IndexedDB 'cmd-push') and seals every reminder's title and text with it before it goes to the Worker.
   The Worker keeps only the time, an id, the page to open and this ciphertext, and hands the ciphertext back in the
   push message; the service worker (cmd/sw.js, cmd/home/sw.js – both importScripts this file) opens it with the same
   key and shows the notification. The key never leaves the device. Lost key (site data cleared) → the notification
   says "Reminder – open the app to see it", and the next upload seals again with a new key.
   Used by cmd (notify.js) and the shared app (home/app.js): PushKey.sealItems(items) → [{ id, at, url, c }]. */
(function (G) {
  'use strict';
  if (G.PushKey) return;
  var DB = 'cmd-push', ST = 'k', KEY = 'key';
  function idb() { return new Promise(function (ok, no) { var r = indexedDB.open(DB, 1); r.onupgradeneeded = function () { r.result.createObjectStore(ST); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; }); }
  function get(db) { return new Promise(function (ok, no) { var q = db.transaction(ST).objectStore(ST).get(KEY); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { no(q.error); }; }); }
  function put(db, k) { return new Promise(function (ok, no) { var t = db.transaction(ST, 'readwrite'); t.objectStore(ST).put(k, KEY); t.oncomplete = function () { ok(k); }; t.onerror = function () { no(t.error); }; }); }
  var made = null;
  function key(make) {
    if (made) return made;
    var p = idb().then(function (db) { return get(db).then(function (k) { if (k || !make) return k; return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']).then(function (nk) { return put(db, nk); }); }); });
    if (make) made = p.catch(function (e) { made = null; throw e; });
    return p;
  }
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function seal(obj) {
    return key(true).then(function (k) { var iv = crypto.getRandomValues(new Uint8Array(12));
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(JSON.stringify(obj))).then(function (ct) { var out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12); return b64(out); }); });
  }
  function open(c) {
    if (!c) return Promise.resolve(null);
    return key(false).then(function (k) { if (!k) return null; var u = unb64(c); return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, k, u.slice(12)).then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); }); }).catch(function () { return null; });
  }
  /* the list a device uploads: the text sealed, nothing readable left beside it (no key = no text, never plain text) */
  function sealItems(items) {
    return Promise.all((items || []).map(function (x) {
      var keep = { id: x.id, at: x.at, url: x.url };
      return seal({ t: String(x.title || ''), b: String(x.body || '') }).then(function (c) { keep.c = c; return keep; }, function () { return keep; });
    }));
  }
  /* what the service worker shows when the text can't be opened */
  function fallback() { var nb = /^(nb|no|nn)\b/i.test((G.navigator && G.navigator.language) || ''); return { t: nb ? 'Påminnelse' : 'Reminder', b: nb ? 'Åpne appen for å se den' : 'Open the app to see it' }; }
  G.PushKey = { seal: seal, open: open, sealItems: sealItems, fallback: fallback };
})(typeof self !== 'undefined' ? self : window);
