/* File sync (Nov 2026): PDFs and photos on Papers and the Home inventory, shared between your devices.
   Each file is encrypted here with a random AES-256 file key before it is sent to the Worker
   (/cmd/api/file → KV "file:<id>"). The key lives in dash.tools.filekeys, which is inside the
   encrypted vault, so the Worker only ever stores bytes it can't read. Keys are also kept in this
   device's IndexedDB ("dash-fsync") and put back if a sync conflict ever drops one.
   Stored format: "JPF1" + key id (8) + iv (12) + AES-GCM( [type length][type][bytes] ).
   window.FileSync = { up, down, del, sync, state } – callers keep their own copy on the device. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features || !window.crypto || !crypto.subtle) return;
  var Fe = window.Features, API = '/cmd/api/file';
  var enc = new TextEncoder(), dec = new TextDecoder();
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function hex(n) { var u = crypto.getRandomValues(new Uint8Array(n)); return Array.prototype.map.call(u, function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }

  /* state the pages show: ok (null = not asked yet, false = the Worker has no file API yet), what's on the server */
  var state = { ok: null, server: null, bytes: 0, busy: 0, error: '' };
  function changed() { try { window.dispatchEvent(new CustomEvent('filesync:change', { detail: state })); } catch (e) {} }

  /* ---------- the key ring ---------- */
  var kdb = null;
  function keyDb() { return kdb || (kdb = new Promise(function (res, rej) { var r = indexedDB.open('dash-fsync', 1); r.onupgradeneeded = function () { r.result.createObjectStore('keys'); }; r.onsuccess = function () { res(r.result); }; r.onerror = rej; })); }
  function localKeys() { return keyDb().then(function (d) { return new Promise(function (res) { var out = {}, q = d.transaction('keys').objectStore('keys').openCursor(); q.onsuccess = function () { var c = q.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); }; q.onerror = function () { res(out); }; }); }).catch(function () { return {}; }); }
  function keepKey(kid, k) { return keyDb().then(function (d) { d.transaction('keys', 'readwrite').objectStore('keys').put(k, kid); }).catch(function () {}); }
  function ring() { var t = Fe.tools(); return t.filekeys && typeof t.filekeys === 'object' ? t.filekeys : {}; }
  var healed = null;
  function heal() {
    return healed || (healed = localKeys().then(function (loc) {
      var t = Fe.tools(), r = t.filekeys && typeof t.filekeys === 'object' ? t.filekeys : {}, add = 0;
      Object.keys(loc).forEach(function (kid) { if (!r[kid]) { r[kid] = loc[kid]; add++; } });
      Object.keys(r).forEach(function (kid) { if (!loc[kid]) keepKey(kid, r[kid]); });
      if (add) { t.filekeys = r; if (!t.filekid || !r[t.filekid]) t.filekid = Object.keys(r)[0]; Fe.saveTools(t); }
    }));
  }
  function currentKid() {
    return heal().then(function () {
      var t = Fe.tools(), r = ring();
      if (t.filekid && r[t.filekid]) return t.filekid;
      var kid = hex(4), raw = crypto.getRandomValues(new Uint8Array(32));
      r[kid] = b64(raw); t.filekeys = r; t.filekid = kid; Fe.saveTools(t); keepKey(kid, r[kid]);
      return kid;
    });
  }
  var cache = {};
  function key(kid) {
    if (cache[kid]) return cache[kid];
    var r = ring(); if (!r[kid]) return Promise.reject(new Error('missing key'));
    return (cache[kid] = crypto.subtle.importKey('raw', unb64(r[kid]), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']));
  }

  /* ---------- seal and open ---------- */
  function seal(blob) {
    return Promise.all([currentKid(), blob.arrayBuffer()]).then(function (a) {
      var kid = a[0], data = new Uint8Array(a[1]), type = enc.encode(String(blob.type || '').slice(0, 100));
      var plain = new Uint8Array(1 + type.length + data.length); plain[0] = type.length; plain.set(type, 1); plain.set(data, 1 + type.length);
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return key(kid).then(function (k) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, plain); }).then(function (ct) {
        return new Blob([enc.encode('JPF1' + kid), iv, ct], { type: 'application/octet-stream' });
      });
    });
  }
  function open(buf) {
    var u = new Uint8Array(buf);
    if (u.length < 30 || dec.decode(u.subarray(0, 4)) !== 'JPF1') return Promise.reject(new Error('not a file'));
    var kid = dec.decode(u.subarray(4, 12)), iv = u.subarray(12, 24), ct = u.subarray(24);
    return heal().then(function () { return key(kid); }).then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, k, ct); }).then(function (p) {
      var pu = new Uint8Array(p), tl = pu[0];
      return new Blob([pu.subarray(1 + tl)], { type: dec.decode(pu.subarray(1, 1 + tl)) || 'application/octet-stream' });
    });
  }

  /* ---------- talking to the Worker ---------- */
  function req(method, q, body) {
    return fetch(API + q, { method: method, body: body, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'content-type': 'application/octet-stream' } : {} });
  }
  function noApi(r) { if (r.status === 404) return r.clone().json().then(function (j) { return j && j.error === 'not found' && !j.id ? true : false; }).catch(function () { return false; }); return Promise.resolve(false); }
  function list() {
    return req('GET', '?list=1').then(function (r) {
      if (r.ok) return r.json().then(function (j) { state.ok = true; state.server = j.files || {}; state.bytes = j.bytes || 0; state.error = ''; changed(); return state.server; });
      return noApi(r).then(function (old) { if (old) state.ok = false; state.error = old ? 'old-worker' : 'http ' + r.status; changed(); return null; });
    }).catch(function () { state.error = 'offline'; changed(); return null; });
  }
  var upping = {};
  function up(id, blob) {
    if (upping[id] || state.ok === false) return upping[id] || Promise.resolve(false);
    state.busy++; changed();
    return (upping[id] = seal(blob).then(function (b) { return req('PUT', '?id=' + encodeURIComponent(id), b).then(function (r) { if (r.ok) { if (state.server) state.server[id] = b.size; return true; } return noApi(r).then(function (old) { if (old) state.ok = false; state.error = old ? 'old-worker' : r.status === 413 ? 'too-large' : 'http ' + r.status; return false; }); }); })
      .catch(function () { return false; })
      .then(function (ok) { delete upping[id]; state.busy--; changed(); return ok; }));
  }
  var downing = {};
  function down(id) {
    if (downing[id]) return downing[id];
    if (state.ok === false || (state.server && !(id in state.server))) return Promise.resolve(null);
    return (downing[id] = req('GET', '?id=' + encodeURIComponent(id)).then(function (r) { return r.ok ? r.arrayBuffer().then(open) : null; })
      .catch(function () { return null; }).then(function (b) { delete downing[id]; return b; }));
  }
  /* deletes that couldn't reach the Worker are tried again later */
  var DQ = 'dash.fsync.del';
  function dq() { try { return JSON.parse(localStorage.getItem(DQ)) || []; } catch (e) { return []; } }
  function setDq(l) { try { localStorage.setItem(DQ, JSON.stringify(l.slice(-200))); } catch (e) {} }
  /* removed files are remembered (synced), so a device that hasn't heard yet can't send them back up */
  function gone() { var t = Fe.tools(); return Array.isArray(t.filegone) ? t.filegone : []; }
  function bury(id) { var t = Fe.tools(), g = Array.isArray(t.filegone) ? t.filegone : []; if (g.indexOf(id) < 0) { g.push(id); t.filegone = g.slice(-500); Fe.saveTools(t); } }
  function del(id, quiet) {
    if (!quiet) bury(id);
    if (state.server) delete state.server[id];
    return req('DELETE', '?id=' + encodeURIComponent(id)).then(function (r) { if (!r.ok) throw 0; setDq(dq().filter(function (x) { return x !== id; })); changed(); return true; })
      .catch(function () { var l = dq(); if (l.indexOf(id) < 0) l.push(id); setDq(l); return false; });
  }
  function flushDel() { dq().forEach(function (id) { del(id); }); }

  /* bring a page's files in line: upload what only this device has, download what only the server has */
  function sync(o) {
    flushDel();
    return list().then(function (srv) {
      if (!srv) return { ok: false };
      var res = { ok: true, up: 0, down: 0 }, g = gone();
      /* a file another device removed, sent back up by a device that hadn't heard yet: remove it again */
      g.forEach(function (id) { if (id in srv && o.ids.indexOf(id) < 0) del(id, true); });
      return o.ids.filter(function (id) { return g.indexOf(id) < 0; }).reduce(function (p, id) {
        return p.then(function () {
          return o.getLocal(id).then(function (b) {
            if (b && !(id in srv)) return up(id, b).then(function (k) { if (k) res.up++; });
            if (!b && (id in srv) && o.download) return down(id).then(function (nb) { if (nb) return Promise.resolve(o.putLocal(id, nb)).then(function () { res.down++; }); });
          });
        });
      }, Promise.resolve()).then(function () { return res; });
    });
  }
  window.FileSync = { up: up, down: down, del: del, sync: sync, list: list, state: function () { return state; } };
})();
