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
  /* the shared key's push key (2026-11-12): the things you send the other one's phones – a nudge, "N added milk", a chat
     line – are sealed with a key both of you have, made from the shared key (HKDF, info 'cmd-push-shared') and kept here
     under 'shared' on every device that has the shared key, so the service worker can open them. The Worker never sees the text. */
  function getK(name) { return idb().then(function (db) { return new Promise(function (ok, no) { var q = db.transaction(ST).objectStore(ST).get(name); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { no(q.error); }; }); }); }
  function putK(name, v) { return idb().then(function (db) { return new Promise(function (ok, no) { var t = db.transaction(ST, 'readwrite'); t.objectStore(ST).put(v, name); t.oncomplete = function () { ok(v); }; t.onerror = function () { no(t.error); }; }); }); }
  var keptFor = null, keptP = null;
  function keepShared(k) {
    if (!k || !G.crypto || !crypto.subtle) return Promise.resolve(null);
    if (k === keptFor && keptP) return keptP;
    keptFor = k;
    var raw = unb64(String(k).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(k).length + 3) % 4));
    keptP = crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('cmd-push-shared') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }).then(function (sk) { return putK('shared', sk); }).catch(function () { keptFor = null; keptP = null; return null; });
    return keptP;
  }
  function sealWith(k, obj) { var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(JSON.stringify(obj))).then(function (ct) { var out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12); return b64(out); }); }
  function sealShared(obj) { return (keptP || Promise.resolve(null)).then(function (k) { return k || getK('shared'); }).then(function (k) { if (!k) throw new Error('no shared push key'); return sealWith(k, obj); }); }
  function openShared(c) {
    if (!c) return Promise.resolve(null);
    return getK('shared').then(function (k) { if (!k) return null; var u = unb64(c); return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, k, u.slice(12)).then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); }); }).catch(function () { return null; });
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
  function fallbackShared(home) { var nb = /^(nb|no|nn)\b/i.test((G.navigator && G.navigator.language) || ''); return { t: home ? (nb ? 'Hjem' : 'Home') : (nb ? 'Delt hjem' : 'Shared home'), b: nb ? 'Noe nytt – åpne appen for å se det' : 'Something new – open the app to see it' }; }
  /* what a push message holds → the text to show: sealed for this device (c), sealed with the shared key (c + s), or nothing readable */
  function text(d, home) {
    if (d && d.c !== undefined && d.s) return openShared(d.c).then(function (m) { return m || fallbackShared(home); });
    if (d && d.c !== undefined) return open(d.c).then(function (m) { return m || fallback(); });
    return Promise.resolve({ t: (d && d.title) || (home ? 'Home' : 'Dashboard'), b: (d && d.body) || '' });
  }
  G.PushKey = { seal: seal, open: open, sealItems: sealItems, fallback: fallback, keepShared: keepShared, sealShared: sealShared, openShared: openShared, fallbackShared: fallbackShared, text: text };
})(typeof self !== 'undefined' ? self : window);
