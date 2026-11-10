/* Lock screen + encrypted vault for the dashboard.
   Your passcode never leaves this device and is never stored. It is turned into an
   AES-256 key (PBKDF2-SHA-256, 310 000 rounds) that encrypts the finance data in
   this browser's storage. Without the passcode the data cannot be read.
   Sync: if the Cloudflare worker (/_cloudflare/worker.js) is set up, the same
   encrypted blob is copied to Cloudflare so every device you log in on gets it.
   Cloudflare only ever sees the encrypted version. */
(function () {
  "use strict";

  /* Changes from another device or from the person you share with redraw parts of the page. keepView(fn) runs fn and
     then keeps what you were looking at in the same spot on screen (the browser's own scroll anchoring doesn't help:
     the redrawn parts are new elements, and iPhone Safari has none). It stops as soon as you scroll yourself. */
  function anchorAt(y) {
    var el = document.elementFromPoint(innerWidth / 2, y), node = el;
    if (!el || el === document.body || el === document.documentElement) return null;
    var q = function (v) { return String(v).replace(/["\\]/g, '\\$&'); };
    /* the nearest small thing that can be found again: a section with an id, an element with a data- name, or its text */
    var small = function (n) { return n.getBoundingClientRect().height < innerHeight * 1.2; };
    for (var pass = 0; pass < 2; pass++) {
      for (node = el; node && node !== document.body && small(node); node = node.parentElement) {
        var sel = null;
        if (node.id) sel = '[id="' + q(node.id) + '"]';
        else if (pass) for (var i = 0; i < node.attributes.length && !sel; i++) { var at = node.attributes[i]; if (/^data-/.test(at.name) && at.value && at.value.length < 100 && !/^data-(ok|mid)$/.test(at.name)) sel = node.tagName.toLowerCase() + '[' + at.name + '="' + q(at.value) + '"]'; }
        if (sel) { try { if (document.querySelectorAll(sel).length === 1) return { sel: sel, top: node.getBoundingClientRect().top, el: node }; } catch (e) {} }
      }
    }
    var tx = (el.textContent || '').trim().slice(0, 80);
    if (tx && tx.length < 80) return { tag: el.tagName, tx: tx, top: el.getBoundingClientRect().top, el: el };
    for (node = el; node && node !== document.body; node = node.parentElement) if (node.id) return { sel: '[id="' + q(node.id) + '"]', top: node.getBoundingClientRect().top, el: node };
    return null;
  }
  function anchorFind(a) {
    if (a.el && a.el.isConnected) return a.el;
    if (a.sel) return document.querySelector(a.sel);
    var best = null, bd = 1e9; [].forEach.call(document.getElementsByTagName(a.tag), function (x) { if ((x.textContent || '').trim().slice(0, 80) === a.tx) { var d = Math.abs(x.getBoundingClientRect().top - a.top); if (d < bd) { bd = d; best = x; } } });
    return best;
  }
  function keepView(fn) {
    /* a few things down the screen; the middle value of how far they moved wins, so one item that moved on its own (ticked off, sorted) doesn't count */
    var as = []; try { if (window.scrollY > 0) [0.25, 0.4, 0.55, 0.7].forEach(function (f) { var a = anchorAt(innerHeight * f); if (a) as.push(a); }); } catch (e) {}
    var out = fn();
    if (!as.length || !window.MutationObserver) return out;
    var stop = false, fix = function () {
      if (stop) return;
      var ds = []; as.forEach(function (a) { var el = anchorFind(a); if (el) ds.push(el.getBoundingClientRect().top - a.top); });
      if (!ds.length) return; ds.sort(function (x, y) { return x - y; });
      var d = ds[Math.floor((ds.length - 1) / 2)];
      if (Math.abs(d) > 1 && Math.abs(d) < innerHeight * 0.6) { window.scrollBy(0, d); }
    };
    var mo = new MutationObserver(function () { requestAnimationFrame(fix); });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    var you = function () { stop = true; }, evs = ['touchstart', 'wheel', 'keydown'];
    evs.forEach(function (ev) { window.addEventListener(ev, you, { passive: true, once: true }); });
    requestAnimationFrame(fix);
    setTimeout(function () { stop = true; mo.disconnect(); evs.forEach(function (ev) { window.removeEventListener(ev, you); }); }, 3000);
    return out;
  }
  /* someone is writing in a field (not the chat): changes from elsewhere wait a moment, so the field isn't redrawn under them */
  function typingHere() {
    var e = document.activeElement; if (!e || e.closest && e.closest('.hc')) return false;
    if (e.isContentEditable) return true;
    return (e.tagName === 'TEXTAREA' || (e.tagName === 'INPUT' && /^(text|search|email|url|tel|number|)$/i.test(e.type || ''))) && String(e.value || '').trim() !== '';
  }
  window.keepView = keepView; window.typingHere = typingHere;

  /* no pinch- or double-tap zoom on the phone: it is an app, and the text size is set in Settings */
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault(); }, { passive: false });

  var VAULT_KEY = 'dash.vault';
  var FAIL_KEY = 'dash.fails';
  var ITER = 310000;
  /* Stays unlocked on this device until this long without activity (Settings → Security). */
  function idleMs() {
    var m = 60;
    try { m = (JSON.parse(localStorage.getItem('dash.settings')) || {}).lockMins || 60; } catch (e) {}
    return Math.max(5, Math.min(m, 1440)) * 60 * 1000;
  }

  var enc = new TextEncoder();
  var dec = new TextDecoder();
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;

  var API = '/cmd/api/vault';
  var SYNC_KEY = 'dash.syncRev';
  var WIDGET_KEYS = ['dash.goals', 'dash.todos', 'dash.links', 'dash.notes', 'dash.settings', 'dash.transit', 'dash.habits', 'dash.travel', 'dash.calendar', 'dash.tools', 'dash.profile'];

  var key = null;          // CryptoKey while unlocked, null when locked
  var salt = null;
  var data = null;         // decrypted vault contents while unlocked
  var writing = Promise.resolve();
  var idleTimer = null;
  var lastActive = 0;
  var savedAt = 0;
  var unlockFns = [];
  var remote = null;       // newest vault found on the server (while locked)
  var remoteRev = null;    // rev on the server, if known
  var ignoreRemote = false;
  var syncState = 'off';
  var available = false;
  var remoteCheck = Promise.resolve();
  var remoteSalt = null;  // salt of the synced vault, if known   // true once the sync worker has answered
  var pushTimer = null;
  var pushing = false;
  var lockFns = [];

  /* ---------- helpers ---------- */
  function b64(buf) {
    var bytes = new Uint8Array(buf), s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function removeKey(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function derive(pass, saltBytes, iter) {
    return crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: saltBytes, iterations: iter, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  function widgets() {
    var w = {};
    WIDGET_KEYS.forEach(function (k) { var v = readJSON(k); if (v !== null) w[k] = v; });
    return w;
  }

  function seal(obj, k, s, rev) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var plain = Object.assign({}, obj, { _w: widgets() });
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(plain)))
      .then(function (ct) {
        var out = { v: 1, rev: rev || 0, iter: ITER, salt: b64(s), iv: b64(iv), ct: b64(ct) };
        var rec = recNext !== undefined ? recNext : (readJSON(VAULT_KEY) || {}).rec;
        if (rec) out.rec = rec;
        return out;
      });
  }

  /* ---------- recovery code ----------
     A code you keep somewhere safe (printed, in your password manager) that opens the dashboard if
     you forget the passcode. It locks a copy of the passcode (rec in the vault file, encrypted with a
     key made from the code – the server can't read it). The code itself is kept inside the encrypted
     vault, so changing the passcode updates the copy. */
  var recNext;                 // undefined: keep what the vault file has; null: remove; object: new
  var REC_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function recNorm(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function recWrap(code, pass) {
    var rs = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    return derive(recNorm(code), rs, ITER).then(function (rk) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, rk, enc.encode(pass)); })
      .then(function (ct) { return { salt: b64(rs), iv: b64(iv), ct: b64(ct) }; });
  }
  function recUnwrap(code, rec) {
    return derive(recNorm(code), unb64(rec.salt), ITER).then(function (rk) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, rk, unb64(rec.ct)); })
      .then(function (pt) { return dec.decode(pt); });
  }
  function recNew() {
    var r = crypto.getRandomValues(new Uint8Array(20)), c = '';
    for (var i = 0; i < 20; i++) { c += REC_ABC[r[i] % REC_ABC.length]; if (i % 4 === 3 && i < 19) c += '-'; }
    return c;
  }

  /* Takes widgets (to-dos, notes …) out of a decrypted vault and puts them on screen. */
  /* Holes in lists (null items, from an old version or a half-written save) are dropped, two levels
     deep, so one bad item can't stop a page from drawing. Expenses get a number for an amount. */
  function tidy(v, depth) {
    if (Array.isArray(v)) {
      if (v.some(function (x) { return x == null; })) v = v.filter(function (x) { return x != null; });
      if (depth > 0) for (var i = 0; i < v.length; i++) v[i] = tidy(v[i], depth - 1);
    } else if (v && typeof v === 'object' && depth > 0) Object.keys(v).forEach(function (k) { v[k] = tidy(v[k], depth - 1); });
    return v;
  }
  /* A change made right before leaving the page (a switch flipped, then a tap on the menu) is in this browser's storage
     but may not be sealed into the vault yet. 'dash.dirty' marks that; opening the next page keeps this browser's copy
     instead of the older one in the vault, and seals it again. */
  var DIRTY_KEY = 'dash.dirty', resealAfterOpen = false;
  function unpackKeep(obj, local) {
    var dirty = local && +readJSON(DIRTY_KEY) > 0, snap = dirty ? widgets() : null, d = unpack(obj);
    if (snap) { Object.keys(snap).forEach(function (k) { try { localStorage.setItem(k, JSON.stringify(snap[k])); } catch (e) {} }); resealAfterOpen = true; }
    return d;
  }
  function unpack(obj) {
    obj = obj && typeof obj === 'object' ? obj : {};
    Object.keys(obj).forEach(function (k) { if (k !== '_w' && k !== 'health') obj[k] = tidy(obj[k], 2); });
    if (Array.isArray(obj.expenses)) obj.expenses = obj.expenses.filter(function (e) { return e && typeof e === 'object'; }).map(function (e) {
      if (typeof e.amount === 'string' && isFinite(+e.amount.replace(',', '.'))) e.amount = +e.amount.replace(',', '.');
      return e;
    });
    if (obj._w) {
      var w = obj._w;
      delete obj._w;
      /* only what differs from this browser's copy is written, and the page only redraws when something
         did – unlocking on the same device used to draw every part twice (slow to open on a phone) */
      var changed = false;
      Object.keys(w).forEach(function (k) {
        if (WIDGET_KEYS.indexOf(k) < 0) return;
        var v = JSON.stringify(tidy(w[k], 3)), cur = null;
        try { cur = localStorage.getItem(k); } catch (e) {}
        if (cur !== v) { changed = true; try { localStorage.setItem(k, v); } catch (e) {} }
      });
      if (changed && window.Dash && window.Dash.reload) window.Dash.reload();
    }
    return obj;
  }
  var memVault = null;          // the newest sealed copy when localStorage is full (see save)
  function localRev() { var v = memVault || readJSON(VAULT_KEY); return v && v.rev || 0; }
  function syncedRev() { var n = readJSON(SYNC_KEY); return typeof n === 'number' ? n : -1; }

  function open(vault, k) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, k, unb64(vault.ct))
      .then(function (pt) { var o = JSON.parse(dec.decode(pt)); return vault.v === 2 ? assemble(o, vault, k) : o; });
  }

  function isVault(v) { return v && (v.v === 1 || v.v === 2) && v.salt && v.iv && v.ct; }

  /* ---------- the vault in pieces (rebuild A4) ----------
     On the server the dashboard is a small core plus pieces: every big part (one month of Apple Health, a tool
     list, the finances …) is encrypted on its own, so a change uploads the core and the one piece that changed.
     A piece's id is the hash of its encrypted bytes; which part it is, is only written inside the encrypted core
     (_pc). This browser keeps the whole thing as before (a server copy is stored with its pieces in pcs), so
     unlocking without internet still works, and every merge works on the whole dashboard as it always did. */
  var PIECE_MIN = 2048, PIECE_API = '/cmd/api/vpiece', pcBody = {}, pcMine = {}, srvHas = {}, pcKey = null;
  function pcFor(k) { if (pcKey !== k) { pcMine = {}; pcKey = k; } }   /* a new passcode: pieces are encrypted again, never reused */
  function piecesOff() { return readJSON('dash.vp.off') === 1; }
  function fnv(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + str.length; }
  function sha32(str) { return crypto.subtle.digest('SHA-256', enc.encode(str)).then(function (h) { return Array.prototype.map.call(new Uint8Array(h).slice(0, 16), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }); }
  function pieceOf(name) {
    if (name.indexOf('h:') === 0) return null;
    var n = name.slice(2); return name[0] === 'w' ? ['_w'].concat(n.indexOf('dash.tools/') === 0 ? ['dash.tools', n.slice(11)] : [n]) : [n];
  }
  function split(obj) {
    var core = Object.assign({}, obj), parts = {}, big = function (v) { return v !== undefined && JSON.stringify(v).length >= PIECE_MIN; };
    if (isObj(obj._w)) { core._w = Object.assign({}, obj._w); if (isObj(obj._w['dash.tools'])) core._w['dash.tools'] = Object.assign({}, obj._w['dash.tools']); }
    if (isObj(obj.health)) {
      core.health = Object.assign({}, obj.health);
      if (isObj(obj.health.days)) {
        var days = core.health.days = Object.assign({}, obj.health.days), mon = {};
        Object.keys(days).forEach(function (d) { var m = String(d).slice(0, 7); (mon[m] = mon[m] || {})[d] = days[d]; });
        Object.keys(mon).forEach(function (m) { if (big(mon[m])) { parts['h:' + m] = mon[m]; Object.keys(mon[m]).forEach(function (d) { delete days[d]; }); } });
      }
    }
    Object.keys(core).forEach(function (k) { if (k !== '_w' && big(core[k])) { parts['d:' + k] = core[k]; delete core[k]; } });
    if (isObj(core._w)) Object.keys(core._w).forEach(function (k) {
      if (k === 'dash.tools' && isObj(core._w[k])) { var t = core._w[k]; Object.keys(t).forEach(function (s2) { if (big(t[s2])) { parts['w:dash.tools/' + s2] = t[s2]; delete t[s2]; } }); }
      else if (big(core._w[k])) { parts['w:' + k] = core._w[k]; delete core._w[k]; }
    });
    return { core: core, parts: parts };
  }
  function join(core, parts) {
    var names = Object.keys(parts);
    names.filter(function (n) { return n.indexOf('h:') !== 0; }).forEach(function (n) { var p = pieceOf(n); setPath(core, p, parts[n]); });
    names.filter(function (n) { return n.indexOf('h:') === 0; }).forEach(function (n) { core.health = isObj(core.health) ? core.health : {}; core.health.days = isObj(core.health.days) ? core.health.days : {}; Object.assign(core.health.days, parts[n]); });
    return core;
  }
  function getPieces(ids, have) {
    var need = ids.filter(function (id) { return !(have && have[id]) && !pcBody[id]; }), jobs = [];
    for (var i = 0; i < need.length; i += 200) jobs.push(fetch(PIECE_API + '?ids=' + need.slice(i, i + 200).join(','), { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('pieces ' + r.status); return r.json(); })
      .then(function (j) { Object.keys(j.pcs || {}).forEach(function (id) { pcBody[id] = j.pcs[id]; srvHas[id] = 1; }); }));
    return Promise.all(jobs).then(function () { var out = {}; ids.forEach(function (id) { var b = (have && have[id]) || pcBody[id]; if (!b) throw new Error('a piece is missing'); out[id] = b; }); return out; });
  }
  /* a copy from the server: with its pieces, so it can be kept and opened like a whole one */
  function withPieces(v) {
    if (!v || v.v !== 2 || !Array.isArray(v.pc)) return Promise.resolve(v);
    v.pc.forEach(function (id) { srvHas[id] = 1; });
    return getPieces(v.pc, v.pcs).then(function (b) { v.pcs = b; return v; });
  }
  function assemble(core, vault, k) {
    var map = isObj(core._pc) ? core._pc : {}, names = Object.keys(map); delete core._pc; pcFor(k);
    return getPieces(names.map(function (n) { return map[n]; }), vault.pcs).then(function (bodies) {
      return Promise.all(names.map(function (n) { var b = JSON.parse(bodies[map[n]]);
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(b.iv) }, k, unb64(b.ct)).then(function (pt) { var s2 = dec.decode(pt); pcMine[n] = { ph: fnv(s2), id: map[n] }; pcBody[map[n]] = bodies[map[n]]; return [n, JSON.parse(s2)]; }); }));
    }).then(function (l) { var parts = {}; l.forEach(function (x) { parts[x[0]] = x[1]; }); return join(core, parts); });
  }
  /* what goes to the server: the core and the pieces it doesn't have yet */
  function toServer(local, k) {
    return open(local, k).then(function (obj) {
      var sp = split(obj), map = {}, jobs = []; pcFor(k);
      Object.keys(sp.parts).forEach(function (n) {
        var str = JSON.stringify(sp.parts[n]), ph = fnv(str);
        if (pcMine[n] && pcMine[n].ph === ph && pcBody[pcMine[n].id]) { map[n] = pcMine[n].id; return; }
        var iv = crypto.getRandomValues(new Uint8Array(12));
        jobs.push(crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(str)).then(function (ct) {
          var body = JSON.stringify({ iv: b64(iv), ct: b64(ct) });
          return sha32(body).then(function (id) { pcBody[id] = body; pcMine[n] = { ph: ph, id: id }; map[n] = id; });
        }));
      });
      return Promise.all(jobs).then(function () {
        sp.core._pc = map;
        var ids = Object.keys(map).map(function (n) { return map[n]; }), up = ids.filter(function (id) { return !srvHas[id]; });
        var batches = [], cur = {}, size = 0;
        up.forEach(function (id) { if (size + pcBody[id].length > 3e6 && size) { batches.push(cur); cur = {}; size = 0; } cur[id] = pcBody[id]; size += pcBody[id].length; });
        if (size) batches.push(cur);
        return batches.reduce(function (p, b) { return p.then(function () { return fetch(PIECE_API, { method: 'PUT', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pcs: b }) })
          .then(function (r) { if (!r.ok) throw new Error('pieces ' + r.status); Object.keys(b).forEach(function (id) { srvHas[id] = 1; }); }); }); }, Promise.resolve()).then(function () {
          var iv = crypto.getRandomValues(new Uint8Array(12));
          return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(sp.core))).then(function (ct) {
            var out = { v: 2, rev: local.rev || 0, iter: local.iter || ITER, salt: local.salt, iv: b64(iv), ct: b64(ct), pc: ids };
            if (local.rec) out.rec = local.rec;
            return JSON.stringify(out);
          });
        });
      });
    });
  }
  window.__pieces = { split: split, join: join, count: function () { return Object.keys(pcMine).length; } };   /* for the tests */

  /* ---------- lock screen UI ---------- */
  var mode = 'unlock';   // 'setup' | 'unlock' | 'reset'

  function setMode(m) {
    mode = m;
    var setup = m === 'setup';
    $('lockTitle').textContent = setup ? 'Create a passcode' : m === 'reset' ? 'Start over?' : 'Welcome back';
    $('lockSub').textContent = setup
      ? 'Choose at least 6 characters. It encrypts your finances on this device.'
      : m === 'reset'
        ? 'This erases your encrypted finance data on this device and on your other devices. To-dos, notes and links stay on this device.'
        : 'Enter your passcode to open the dashboard.';
    $('lockForm').hidden = m === 'reset';
    $('lockConfirm').hidden = !setup;
    $('lockConfirm').required = setup;
    $('lockPass').setAttribute('autocomplete', setup ? 'new-password' : 'current-password');
    $('lockSubmit').textContent = setup ? 'Create and open' : 'Unlock';
    $('lockForgot').hidden = m !== 'unlock';
    $('lockRestore').hidden = !setup;
    $('lockReset').hidden = m !== 'reset';
    $('lockWarn').hidden = !setup;
    msg('');
    $('lockPass').value = '';
    $('lockConfirm').value = '';
    if (m !== 'reset') setTimeout(function () { try { $('lockPass').focus({ preventScroll: true }); } catch (e) {} }, 60);
  }

  function msg(text, ok) {
    var el = $('lockMsg');
    el.textContent = text;
    el.classList.toggle('ok', !!ok);
  }

  function shake() {
    var box = $('lockBox');
    box.classList.remove('shake');
    void box.offsetWidth;
    box.classList.add('shake');
  }

  function busy(on) {
    $('lockSubmit').disabled = on;
    $('lockBox').classList.toggle('busy', on);
  }

  /* Slows down guessing: after 5 wrong tries you wait 30 s, then 1 min, 2 min … up to 15 min. */
  function waitLeft() {
    var f = readJSON(FAIL_KEY);
    return f && f.until ? Math.max(0, f.until - Date.now()) : 0;
  }
  function addFail() {
    var f = readJSON(FAIL_KEY) || { n: 0 };
    f.n += 1;
    if (f.n >= 5) f.until = Date.now() + Math.min(15 * 60, 30 * Math.pow(2, f.n - 5)) * 1000;
    writeJSON(FAIL_KEY, f);
  }

  function showLocked(note) {
    root.classList.add('locked');
    root.classList.remove('unlocked', 'resuming');
    $('lock').hidden = false;
    remote = null;
    setMode(isVault(readJSON(VAULT_KEY)) ? 'unlock' : 'setup');
    if (note) msg(note);
    /* Look for a newer synced version (e.g. made on your phone) before unlocking. */
    remoteCheck = Promise.race([
      getRemote(),
      new Promise(function (r) { setTimeout(r, 6000); })   // never wait forever when offline
    ]).then(function (v) {
      if (!v || ignoreRemote || key) return;
      var local = readJSON(VAULT_KEY);
      var foreign = isVault(local) && syncedRev() === -1 && v.salt !== local.salt;
      if (!isVault(local) || foreign || (v.rev || 0) > (local.rev || 0)) {
        remote = v;
        if (mode === 'setup') { setMode('unlock'); msg('Found your synced dashboard. Enter your passcode.', true); }
      }
    });
  }

  function finishUnlock() {
    removeKey(FAIL_KEY);
    ignoreRemote = false;
    $('lockPass').value = '';
    $('lockConfirm').value = '';
    $('lockPass').blur();
    root.classList.remove('locked', 'resuming');
    root.classList.add('unlocked');
    if (resealAfterOpen) { resealAfterOpen = false; setTimeout(function () { if (key) window.Vault.save(data); }, 0); }
    $('lock').hidden = true;
    $('lockBox').style.visibility = '';
    resetIdle(true);
    emit();
    sync();
  }
  function emit() {
    unlockFns.forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } });
  }

  function lock(note) {
    if (typeof note !== 'string') note = '';
    /* Normal lock: upload the last change first. Locked because of a passcode mismatch: never upload. */
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; if (key && !note) push(); }
    key = null;
    data = null;
    salt = null;
    clearTimeout(idleTimer);
    forget();
    lockFns.forEach(function (fn) { try { fn(); } catch (e) {} });
    showLocked(note);
  }

  $('lockForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pass = $('lockPass').value;
    var wait = waitLeft();
    if (wait > 0) { msg('Too many tries. Wait ' + Math.ceil(wait / 1000) + ' s.'); shake(); return; }

    if (mode === 'setup') {
      if (pass.length < 6) { msg('Use at least 6 characters.'); shake(); return; }
      if (pass !== $('lockConfirm').value) { msg('The two passcodes don’t match.'); shake(); return; }
      busy(true);
      salt = crypto.getRandomValues(new Uint8Array(16));
      derive(pass, salt, ITER)
        .then(function (k) {
          key = k; data = {};
          return seal(data, key, salt, remoteRev !== null ? remoteRev + 1 : 1);
        })
        .then(function (v) {
          busy(false);
          if (!writeJSON(VAULT_KEY, v)) { msg('This browser blocks storage (private mode?).'); key = null; return; }
          if (remoteRev !== null) writeJSON(SYNC_KEY, remoteRev);
          finishUnlock();
        })
        .catch(function () { busy(false); msg('This browser can’t encrypt. Try Safari or Chrome.'); });
      return;
    }

    if (!pass) { shake(); return; }
    busy(true);
    remoteCheck.then(function () { tryUnlock(pass); });
  });

  function tryUnlock(pass) {
    var vault = remote || readJSON(VAULT_KEY);
    if (!isVault(vault)) { busy(false); setMode('setup'); return; }
    var fromRemote = vault === remote;
    var s = unb64(vault.salt), k;
    derive(pass, s, vault.iter || ITER)
      .then(function (kk) { k = kk; return open(vault, k); })
      .then(function (obj) {
        key = k; salt = s;
        if (fromRemote) { memVault = null; writeJSON(VAULT_KEY, vault); writeJSON(SYNC_KEY, vault.rev || 0); remote = null; }
        data = unpackKeep(obj, !fromRemote);
        busy(false);
        finishUnlock();
      })
      .catch(function () {
        busy(false);
        addFail();
        $('lockPass').value = '';
        var w = waitLeft();
        msg(w > 0 ? 'Wrong passcode. Wait ' + Math.ceil(w / 1000) + ' s.' : 'Wrong passcode.');
        shake();
      });
  }

  $('lockForgot').addEventListener('click', function () { setMode('reset'); recForm(); });
  function recVault() { var v = remote || readJSON(VAULT_KEY); return isVault(v) && v.rec ? v : null; }
  function recForm() {
    var old = $('lockRec'); if (old) old.remove();
    var v = recVault(); if (!v) return;
    var f = document.createElement('form'); f.id = 'lockRec'; f.className = 'lock-rec'; f.autocomplete = 'off';
    f.innerHTML = '<p class="lock-rec-h"><i class="bi bi-key"></i> Have your recovery code?</p>' +
      '<input id="lockRecIn" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocapitalize="characters" spellcheck="false" aria-label="Recovery code" required>' +
      '<button class="pill-btn lock-submit" type="submit">Open with the code</button><p class="lock-rec-or muted">Or start over:</p>';
    $('lockReset').parentNode.insertBefore(f, $('lockReset'));
    $('lockSub').textContent = 'Use your recovery code to get in – then choose a new passcode. Without it, the only way is to start over.';
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var w = waitLeft(); if (w > 0) { msg('Wait ' + Math.ceil(w / 1000) + ' s.'); return; }
      busy(true);
      recUnwrap($('lockRecIn').value, v.rec).then(function (pass) {
        f.remove(); setMode('unlock'); busy(true);
        try { sessionStorage.setItem('dash.recUsed', '1'); } catch (x) {}
        tryUnlock(pass);
      }).catch(function () { busy(false); addFail(); msg('That code doesn’t fit. Check it and try again.'); shake(); });
    });
  }
  /* opened with the recovery code: go straight to choosing a new passcode */
  unlockFns.push(function () {
    var used = false; try { used = sessionStorage.getItem('dash.recUsed') === '1'; sessionStorage.removeItem('dash.recUsed'); } catch (e) {}
    if (!used) return;
    setTimeout(function () {
      if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-key"></i> Opened with your recovery code – choose a new passcode');
      var b = $('settingsBtn'); if (!b) return; b.click();
      setTimeout(function () { var g = document.querySelector('[data-go="security"]'); if (g) g.click(); setTimeout(function () { var c = $('stChangePc'); if (c && $('pcForm').hidden) c.click(); }, 300); }, 300);
    }, 700);
  });
  $('lockCancelReset').addEventListener('click', function () { var r = $('lockRec'); if (r) r.remove(); setMode('unlock'); });
  $('lockDoReset').addEventListener('click', function () {
    removeKey(VAULT_KEY);
    removeKey(FAIL_KEY);
    remote = null;
    ignoreRemote = true; writeJSON(REPLACE_KEY, 1);
    setMode('setup');
    msg('Erased. Create a new passcode.', true);
  });

  /* Restore an encrypted backup (e.g. on a new phone). Then unlock with the old passcode. */
  $('lockRestore').addEventListener('click', function () { $('lockFile').click(); });
  $('lockFile').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    file.text().then(function (t) {
      var v = JSON.parse(t);
      if (!isVault(v)) throw new Error('bad');
      v.rev = Math.max(v.rev || 0, remoteRev !== null ? remoteRev + 1 : 0, localRev() + 1);
      memVault = null; writeJSON(VAULT_KEY, v); writeJSON(REPLACE_KEY, 1);
      remote = null;
      ignoreRemote = true;
      setMode('unlock');
      msg('Backup loaded. Enter the passcode it was made with.', true);
    }).catch(function () { msg('That file isn’t a dashboard backup.'); shake(); });
  });

  /* ---------- auto-lock ---------- */
  function resetIdle(force) {
    if (!key) return;
    lastActive = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(lock, idleMs());
    if (force === true || lastActive - savedAt > 60 * 1000) remember();
  }

  /* ---------- stay unlocked on this device ----------
     The key is kept in this browser's IndexedDB as a non-extractable CryptoKey:
     the page can use it, but it can't be read out or copied. It expires after
     an hour without activity, and the lock button deletes it at once. */
  function idb(mode, fn) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open('dash-lock', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('k'); };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () {
        var db = req.result, tx = db.transaction('k', mode), q = fn(tx.objectStore('k'));
        tx.oncomplete = function () { db.close(); resolve(q && q.result); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      };
    });
  }
  function remember() {
    if (!key || !salt) return;
    savedAt = Date.now();
    var rec = { key: key, salt: b64(salt), until: savedAt + idleMs() };
    idb('readwrite', function (st) { return st.put(rec, 'session'); }).catch(function () {});
    try { localStorage.setItem('dash.until', String(rec.until)); } catch (e) {}     // lets the next page skip the lock screen flash
  }
  function forget() { savedAt = 0; try { localStorage.removeItem('dash.until'); } catch (e) {} idb('readwrite', function (st) { return st.delete('session'); }).catch(function () {}); }
  function recall() {
    if (!window.indexedDB) return Promise.resolve(null);
    return Promise.race([
      idb('readonly', function (st) { return st.get('session'); }),
      new Promise(function (r) { setTimeout(function () { r(null); }, 1500); })
    ]).catch(function () { return null; });
  }

  function tooLongAway() { return key && lastActive && Date.now() - lastActive > idleMs(); }
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, resetIdle, { passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (tooLongAway()) { lock(); return; }
    if (key) sync();
  });
  setInterval(function () { if (key && !document.hidden) sync(); }, 60 * 1000);
  /* instant updates (share-core.js): another of your devices saved – fetch it now instead of within a minute */
  var liveSyncT = null;
  window.addEventListener('cmd-live-vault', function (e) {
    var r = +(e && e.detail); if (!key || !(r > syncedRev()) || pushing) return;
    var n = 0, go = function () { if (!key || pushing) return; if (typingHere() && n++ < 12) { liveSyncT = setTimeout(go, 1500); return; } sync(); };
    clearTimeout(liveSyncT); liveSyncT = setTimeout(go, 300);
  });
  document.addEventListener('click', function (e) { if (key && e.target.closest('#syncState')) sync(); });
  window.addEventListener('online', function () { if (key) sync(); });
  /* To-dos, notes, goals and links changed: include them in the encrypted vault. */
  window.addEventListener('dash:local', function () { if (key) { try { localStorage.setItem(DIRTY_KEY, String(Date.now())); } catch (e) {} window.Vault.save(data); } });

  /* ---------- sync with Cloudflare ---------- */
  function setSync(state, why) {
    syncState = state;
    var el = $('syncState');
    if (!el) return;
    var t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    el.innerHTML = {
      off: '<i class="bi bi-phone"></i> Saved on this device only',
      busy: '<i class="bi bi-arrow-repeat spin"></i> Syncing…',
      ok: '<i class="bi bi-cloud-check"></i> Synced across your devices · ' + t,
      offline: '<i class="bi bi-cloud-slash"></i> Offline. Changes sync when you’re back online'
    }[state] + (why ? '<span class="sync-why">' + why + ' · tap to retry</span>' : '');
    el.className = 'sync sync-' + state;
    try { window.dispatchEvent(new CustomEvent('sync:state', { detail: state })); } catch (e) {}
    retryCheck(state, why);
  }
  /* A failed sync is tried again by itself – after 4 s, 12 s, 30 s, 1½ min, then every 4 min – and
     after the third miss one calm message says what's going on, with Try again. Edits are always
     saved on this device first, so nothing is lost while it waits. */
  var retryN = 0, retryT = null, told = false;
  function retryCheck(state, why) {
    var D = window.Diag;
    if (state === 'ok') { retryN = 0; clearTimeout(retryT); retryT = null; if (told && D) D.hide('sync'); told = false; return; }
    if (state === 'busy' || !key) return;
    if (state === 'off' && !why && syncedRev() === -1) return;           // this device has never synced: nothing to retry
    clearTimeout(retryT);
    var wait = [4, 12, 30, 90, 240][Math.min(retryN, 4)] * 1000;
    retryN++;
    retryT = setTimeout(function () { retryT = null; if (key) sync(); }, wait);
    if (D && retryN === 1) D.log('sync', state + (why ? ': ' + why : ''), 'lock.js');
    if (D && retryN === 3 && !told) {
      told = true;
      var unsynced = localRev() > syncedRev();
      var nbl = window.I18N && window.I18N.lang === 'nb';
      var t = navigator.onLine === false
        ? (nbl ? 'Du er frakoblet. ' + (unsynced ? 'Endringene dine er trygt lagret her og synkroniseres når nettet er tilbake.' : 'Alt er lagret her.') : 'You’re offline. ' + (unsynced ? 'Your changes are safe on this device and will sync when you’re back online.' : 'Everything is saved here.'))
        : /^(the server|serveren)/.test(why || '') ? why.charAt(0).toUpperCase() + why.slice(1) + (nbl ? '. Endringene er lagret på denne enheten og sendes når den svarer.' : '. Your changes are saved on this device and go up when it answers.')
        : (nbl ? 'Synkroniseringen virker ikke' + (why ? ': ' + why : '') + '. Endringene er lagret på denne enheten.' : 'Sync isn’t working' + (why ? ': ' + why : '') + '. Your changes are saved on this device.');
      D.notice('sync', t, nbl ? 'Prøv igjen' : 'Try again', function () { retryN = 0; sync(); });
    }
  }

  /* Returns the server's vault, null if there is none, or undefined if sync isn't available. */
  function getRemote() {
    return fetch(API, { cache: 'no-store', credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (r) {
        var isJson = (r.headers.get('content-type') || '').indexOf('json') > -1;
        if (!isJson) {
          available = false;
          return r.text().then(function (t) {
            /* Tells you which part of the Cloudflare setup is missing. */
            var why = /hello world/i.test(t) ? 'Sync worker still has the Hello World code. Paste in the sync code and deploy'
              : r.status === 404 ? 'Sync route not active (jplundberg.com/cmd/api/*)'
              : 'Sync worker didn’t answer (' + r.status + ')';
            setSync('off', why);
            return undefined;
          });
        }
        /* the person you share your home with opened the dashboard address: send them to their own app */
        if (r.status === 403) return r.clone().json().then(function (j) { if (j && j.partner) { location.replace('/cmd/home/'); return new Promise(function () {}); } available = false; setSync('off', 'This login has no access to the dashboard'); return undefined; }, function () { return undefined; });
        if (r.status === 404) { available = true; remoteRev = null; remoteSalt = null; return null; }  // set up, but empty
        if (!r.ok) {
          available = false;
          /* 503 is a setup problem only when the Worker says so; otherwise the server is just busy for a moment */
          return r.json().catch(function () { return {}; }).then(function (j) {
            var nbl = window.I18N && window.I18N.lang === 'nb';
            setSync('off', r.status === 401 ? 'Sync refused the login. Check TEAM_DOMAIN and POLICY_AUD'
              : r.status === 503 && /not configured/.test(j && j.error || '') ? 'Sync worker is missing VAULT, TEAM_DOMAIN or POLICY_AUD'
              : r.status >= 500 ? (nbl ? 'serveren svarer ikke akkurat nå' : 'the server isn’t answering right now') + ' (' + r.status + ')'
              : 'Sync error ' + r.status);
            return undefined;
          });
        }
        available = true;
        return r.json().then(withPieces).then(function (v) {
          if (!isVault(v)) return undefined;
          remoteRev = v.rev || 0;
          remoteSalt = v.salt;
          return v;
        });
      })
      .catch(function () {
        if (available || navigator.onLine === false) setSync('offline');
        else setSync('off', 'Cloudflare login expired. Reload the page');
        return undefined;
      });
  }

  /* Takes a newer version from another device. */
  /* ---------- merging changes from two devices ----------
     After every sync this device remembers a fingerprint (hash) of each part of the data:
     every widget (to-dos, habits, calendar …) and every top-level part of the finances.
     If another device saved in the meantime, the parts changed HERE since the last sync are
     kept, and everything else comes from the other device – instead of one side losing. */
  var BASE_KEY = 'dash.syncBase';
  /* set by a restored backup or 'Erase and start over': the next upload replaces the server's copy instead of merging */
  var REPLACE_KEY = 'dash.syncReplace';
  /* Settings, tool data, profile and travel are compared one level deeper (each setting, each tool),
     and Apple Health day by day – so a change on the phone to one setting doesn't undo a change made
     on the computer to another, and health numbers from two devices both stay. */
  var DEEP_W = { 'dash.settings': 1, 'dash.tools': 1, 'dash.profile': 1, 'dash.travel': 1 };
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function parts(obj, w) {
    var out = {};
    Object.keys(obj || {}).forEach(function (k) {
      if (k === '_w') return;
      if (k === 'health' && isObj(obj.health)) {
        Object.keys(obj.health).forEach(function (s) {
          if (s === 'days' && isObj(obj.health.days)) Object.keys(obj.health.days).forEach(function (dk) { out['d:health/days/' + dk] = obj.health.days[dk]; });
          else out['d:health/' + s] = obj.health[s];
        });
      } else out['d:' + k] = obj[k];
    });
    WIDGET_KEYS.forEach(function (k) {
      var v = w[k] === undefined ? null : w[k];
      if (DEEP_W[k] && isObj(v)) Object.keys(v).forEach(function (s) { out['w:' + k + '/' + s] = v[s]; });
      else out['w:' + k] = v;
    });
    return out;
  }
  function getPath(o, p) { for (var i = 0; i < p.length; i++) { if (!isObj(o)) return undefined; o = o[p[i]]; } return o; }
  function setPath(o, p, v) {
    for (var i = 0; i < p.length - 1; i++) { if (!isObj(o[p[i]])) o[p[i]] = {}; o = o[p[i]]; }
    if (v === undefined) delete o[p[p.length - 1]]; else o[p[p.length - 1]] = JSON.parse(JSON.stringify(v));
  }
  function fingerprints(p) {
    var keys = Object.keys(p);
    return Promise.all(keys.map(function (k) {
      return crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify(p[k]))).then(function (h) { return b64(h).slice(0, 22); });
    })).then(function (hs) { var o = {}; keys.forEach(function (k, i) { o[k] = hs[i]; }); return o; });
  }

  /* ---------- item-by-item merge ----------
     Each device keeps (encrypted, in IndexedDB) the last version it shared with the server: the "base".
     When another device saved in the meantime, the three versions are compared item by item:
     - objects key by key, lists of things with an id thing by thing, plain lists (tags, ids) as sets;
     - only one side changed something → that change is kept; both changed the same thing → this device's;
     - removed on one side and untouched on the other → removed; removed on one side, edited on the other → kept.
     So a shopping item added on the phone and another ticked off on the computer both stay. */
  function baseDb(mode, fn) {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { resolve(null); return; }
      var req = indexedDB.open('dash-syncbase', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('b'); };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () { var db = req.result, tx = db.transaction('b', mode), q = fn(tx.objectStore('b')); tx.oncomplete = function () { db.close(); resolve(q && q.result); }; tx.onerror = function () { db.close(); reject(tx.error); }; };
    });
  }
  function saveBase(v) { if (v && isVault(v)) baseDb('readwrite', function (st) { return st.put(v, 'base'); }).catch(function () {}); }
  function loadBase() { return Promise.race([baseDb('readonly', function (st) { return st.get('base'); }), new Promise(function (r) { setTimeout(function () { r(null); }, 2000); })]).catch(function () { return null; }); }
  function same(a, b) { return a === b || JSON.stringify(a) === JSON.stringify(b); }
  function idOf(x) { return x && typeof x === 'object' && !Array.isArray(x) && x.id != null && x.id !== '' ? String(x.id) : null; }
  function keyed(a) { if (!a.length) return true; var seen = {}; for (var i = 0; i < a.length; i++) { var k = idOf(a[i]); if (k === null || seen[k]) return false; seen[k] = 1; } return true; }
  function prim(a) { return a.every(function (x) { return x === null || typeof x !== 'object'; }); }
  function m3(b, m, t) {
    if (same(m, t)) return m;
    if (same(b, m)) return t;                       /* only the other device changed it */
    if (same(b, t)) return m;                       /* only this device changed it */
    if (isObj(m) && isObj(t)) {
      var bb = isObj(b) ? b : {}, o = {}, ks = {};
      [m, t, bb].forEach(function (x) { Object.keys(x).forEach(function (k) { ks[k] = 1; }); });
      Object.keys(ks).forEach(function (k) { var r = m3(bb[k], m[k], t[k]); if (r !== undefined) o[k] = r; });
      return o;
    }
    if (Array.isArray(m) && Array.isArray(t)) return mList(Array.isArray(b) ? b : [], m, t);
    if (m === undefined) return t;                   /* removed here, changed there: keep their change */
    return m;                                        /* both changed the same thing: this device's */
  }
  function mList(b, m, t) {
    if (keyed(m) && keyed(t) && keyed(b) && (m.length || t.length)) {
      var B = {}, M = {}, T = {};
      b.forEach(function (x) { B[idOf(x)] = x; }); m.forEach(function (x) { M[idOf(x)] = x; }); t.forEach(function (x) { T[idOf(x)] = x; });
      /* their order, with things that are new here put after the thing before them here */
      var order = t.map(idOf);
      m.forEach(function (x, i) { var id = idOf(x); if (order.indexOf(id) >= 0) return; var at = -1; for (var j = i - 1; j >= 0; j--) { at = order.indexOf(idOf(m[j])); if (at >= 0) break; } order.splice(at + 1, 0, id); });
      Object.keys(B).forEach(function (id) { if (order.indexOf(id) < 0) order.push(id); });
      var out = []; order.forEach(function (id) { var r = m3(B[id], M[id], T[id]); if (r !== undefined) out.push(r); });
      return out;
    }
    if (prim(m) && prim(t) && prim(b)) {
      var has = function (a, x) { return a.indexOf(x) >= 0; };
      var res = t.filter(function (x) { return !(has(b, x) && !has(m, x)); });
      m.forEach(function (x) { if (!has(b, x) && !has(res, x)) res.push(x); });
      return res;
    }
    return m;
  }
  window.__m3 = m3;   /* for the tests */
  function recordBase(obj, w) {
    return fingerprints(parts(obj, w || widgets())).then(function (h) { writeJSON(BASE_KEY, h); }).catch(function () {});
  }
  function localChanges() {
    var base = readJSON(BASE_KEY);
    if (!base || !data) return Promise.resolve([]);
    var w = widgets(), p = parts(data, w), whole = {};
    /* a base saved before the deeper comparison: judge new deeper parts by their whole part */
    Object.keys(DEEP_W).forEach(function (k) { whole['w:' + k] = w[k] === undefined ? null : w[k]; });
    whole['d:health'] = data.health;
    Object.keys(whole).forEach(function (k) { p['~' + k] = whole[k]; });
    return fingerprints(p).then(function (now) {
      var keys = Object.keys(now).filter(function (k) { return k[0] !== '~'; });
      Object.keys(base).forEach(function (k) { if (!(k in now) && !(k in whole)) keys.push(k); });   // gone here (old whole parts are now compared deeper)
      return keys.filter(function (k) {
        if (base[k] === now[k]) return false;
        if (!(k in base)) { var parent = k.split('/')[0]; if (parent !== k && (parent in base)) return base[parent] !== now['~' + parent]; }
        return true;
      });
    });
  }

  /* every change made on this device counts up; taking in another device's version starts over if you changed
     something while it was being opened (else a tap in that moment – folding a card, ticking an item – was lost) */
  var editSeq = 0;
  window.addEventListener('dash:local', function () { editSeq++; });
  window.addEventListener('tools:change', function () { editSeq++; });
  function adopt(v, failNote) {
    var k = key, seq0 = editSeq;
    var again = function () { setTimeout(function () { if (key && !pushing) sync(); }, 900); };
    return open(v, k).then(function (obj) {
      if (key !== k) return;
      if (editSeq !== seq0 && !failNote) { again(); return; }
      return localChanges().catch(function () { return []; }).then(function (changed) {
        if (key !== k) return;
        if (editSeq !== seq0 && !failNote) { again(); return; }
        salt = unb64(v.salt);
        memVault = null; writeJSON(VAULT_KEY, v);
        writeJSON(SYNC_KEY, v.rev || 0);
        remoteRev = v.rev || 0;
        var w = obj._w || {};
        if (!changed.length || failNote) {           // nothing new here: take the other device's version
          saveBase(v);
          data = unpack(obj);
          recordBase(data, w);
          keepView(emit);
          setSync('ok');
          return;
        }
        /* both devices changed something: merge item by item against the last shared version */
        return loadBase().then(function (bv) {
          if (key !== k) return;
          return (bv && bv.salt === v.salt ? open(bv, k).catch(function () { return null; }) : Promise.resolve(null)).then(function (baseObj) {
            if (key !== k) return;
            saveBase(v);
            if (baseObj) {
              var mine = JSON.parse(JSON.stringify(Object.assign({}, data || {}, { _w: widgets() })));
              var merged3 = m3(baseObj, mine, obj);
              recordBase(obj, w);
              data = unpack(merged3);
              keepView(emit);
              return window.Vault.save(data);
            }
            return oldMerge();
          });
        });
        function oldMerge() {
        recordBase(obj, w);                          // what the server has now (before merging)
        w = JSON.parse(JSON.stringify(w));
        var mine = widgets(), merged = {};
        Object.keys(obj).forEach(function (x) { if (x !== '_w') merged[x] = obj[x]; });
        changed.forEach(function (c) {
          var name = c.slice(2), path = name.split('/');
          if (c.indexOf('d:') === 0) {
            if (path.length > 1) setPath(merged, path, getPath(data, path));
            else if (data && name in data) merged[name] = data[name]; else delete merged[name];
          } else if (path.length > 1) {
            if (!isObj(w[path[0]])) w[path[0]] = {};
            setPath(w[path[0]], path.slice(1), getPath(mine[path[0]], path.slice(1)));
          } else if (mine[name] !== undefined) w[name] = mine[name]; else delete w[name];
        });
        merged._w = w;
        data = unpack(merged);
        keepView(emit);
        return window.Vault.save(data);           // new version on top of the other device's, then upload
        }
      });
    }, function () {
      /* Encrypted with another passcode: it was changed on another device. */
      lock(failNote || 'Your passcode was changed on another device. Use the new one.');
    });
  }

  function sync() {
    if (!key) return Promise.resolve();
    setSync('busy');
    return getRemote().then(function (v) {
      if (v === undefined || !key) return;
      var lr = localRev();
      var local = readJSON(VAULT_KEY);
      /* This device made its own vault before it ever synced: never overwrite the synced one. */
      if (v && syncedRev() === -1 && local && v.salt !== local.salt) {
        return adopt(v, 'You already have a synced dashboard. Enter its passcode to use it on this device.');
      }
      if (v && (v.rev || 0) > lr) return adopt(v);
      /* the server moved on since this device last synced: merge first (even if this device's own version number
         is as high) – uploading straight away would overwrite what the other device saved */
      if (v && !readJSON(REPLACE_KEY) && syncedRev() >= 0 && (v.rev || 0) > syncedRev()) return adopt(v);
      if (!v || lr > (v.rev || 0) || syncedRev() !== (v.rev || 0)) return push();
      writeJSON(SYNC_KEY, v.rev || 0);
      setSync('ok');
      if (local && (local.rev || 0) === (v.rev || 0)) loadBase().then(function (bv) { if (!bv || bv.rev !== v.rev) saveBase(v); });
      if (data && !readJSON(BASE_KEY)) recordBase(data);
    });
  }

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { pushTimer = null; push(); }, 700);
  }

  var pushAgain = false;
  var missTry = 0;
  function push() {
    if (pushing) { pushAgain = true; return Promise.resolve(); }
    var pk = key;
    if (!available) { if (navigator.onLine === false) setSync('offline'); else if (syncState !== 'off') setSync('off'); else retryCheck('off'); return Promise.resolve(); }
    pushing = true;
    setSync('busy');
    return writing.then(function () {
      var raw = memVault ? JSON.stringify(memVault) : localStorage.getItem(VAULT_KEY);
      var v = JSON.parse(raw);
      /* Never upload over a synced dashboard this device has never been part of. */
      if ((syncedRev() === -1 && remoteSalt && v.salt !== remoteSalt && !ignoreRemote)) { setSync('off'); return; }
      /* save on top of the version this device last synced with – if the server has a newer one, it answers 409 and we merge */
      var base = readJSON(REPLACE_KEY) ? (remoteRev !== null ? remoteRev : -1) : syncedRev() >= 0 ? syncedRev() : (remoteRev !== null ? remoteRev : -1);
      /* in pieces when unlocked (the key is needed to cut it up); a whole copy otherwise – the server takes both */
      return (pk && !piecesOff() ? toServer(v, pk).catch(function (e) { if (window.Diag && window.Diag.log) window.Diag.log('sync', 'pieces: ' + ((e && e.message) || e), 'lock.js'); return v.v === 2 ? Promise.reject(e) : raw; }) : Promise.resolve(v.v === 2 ? null : raw)).then(function (body) {
        if (!body) return;
        return fetch(API, {
        method: 'PUT', credentials: 'same-origin', cache: 'no-store',
        headers: { 'content-type': 'application/json', 'X-Base-Rev': String(base) },
        body: body
      }).then(function (r) {
        if (r.ok) { missTry = 0; remoteRev = v.rev; writeJSON(SYNC_KEY, v.rev); removeKey(REPLACE_KEY); setSync('ok'); saveBase(v); if (data) recordBase(data); return; }
        if (r.status === 412 && missTry < 2) { missTry++; return r.json().then(function (j) { (j.missing || []).forEach(function (id) { delete srvHas[id]; }); pushAgain = true; }); }
        if (r.status === 409) return r.json().then(withPieces).then(function (cur) { remoteRev = cur.rev || 0; return adopt(cur); });
        if (r.status === 401) { available = false; setSync('off', 'Sync refused the save (' + r.status + ')'); }
        else setSync('offline');
      });
      });
    }).catch(function () { setSync('offline'); })
      .then(function () { pushing = false; if (pushAgain) { pushAgain = false; if (key && localRev() > syncedRev()) schedulePush(); } });
  }
  /* Coming back with the back button must not show an unlocked page from the cache. */
  window.addEventListener('pageshow', function (e) { if (e.persisted && tooLongAway()) lock(); });

  if ($('lockNow')) $('lockNow').addEventListener('click', lock);

  /* ---------- public API used by finance.js ---------- */
  window.Vault = {
    onUnlock: function (fn) { unlockFns.push(fn); if (key) fn(data); },
    onLock: function (fn) { lockFns.push(fn); },
    /* instant page changes (softnav.js): what the head registered stays, what a page registered goes when you leave it */
    _regs: { mark: function () { return [unlockFns.length, lockFns.length]; }, reset: function (m) { if (m) { unlockFns.length = Math.min(unlockFns.length, m[0]); lockFns.length = Math.min(lockFns.length, m[1]); } } },
    get: function () { return data; },
    syncState: function () { return syncState; },
    save: function (obj) {
      if (!key) return Promise.reject(new Error('locked'));
      data = obj;
      var k = key, s = salt;
      var t0 = Date.now();
      writing = writing.then(function () { return seal(obj, k, s, localRev() + 1); })
        .then(function (v) {
          if (key !== k) return;
          if (writeJSON(VAULT_KEY, v)) { memVault = null; if ((+readJSON(DIRTY_KEY) || 0) <= t0) removeKey(DIRTY_KEY); }
          else {
            /* this browser's storage is full: keep the newest copy in memory and upload it */
            memVault = v;
            if (window.Diag) {
              window.Diag.log('storage', 'vault save failed: storage full', 'lock.js');
              var nbl = window.I18N && window.I18N.lang === 'nb';
              window.Diag.notice('storage', nbl ? 'Lagringsplassen i nettleseren er full. Endringen er sendt til serveren – last ned en sikkerhetskopi og fjern gamle bilder.' : 'This browser’s storage is full. The change was sent to your server – download a backup and remove old photos.', null, null, 'device-hdd');
            }
          }
          schedulePush();
        })
        .catch(function (e) { console.error(e); });
      return writing;
    },
    lock: lock,
    sync: sync,
    /* read an older copy (a daily snapshot) with this passcode, without switching to it */
    peek: function (v) { if (!key || !isVault(v)) return Promise.reject(new Error('locked')); return open(v, key); },
    /* restore a backup file from Settings → Data & sync: it replaces this dashboard (and, after
       unlocking, the synced copy), then asks for the passcode the backup was made with */
    restore: function (text) {
      var v = JSON.parse(text);
      if (!isVault(v)) return Promise.reject(new Error('That file isn’t a dashboard backup.'));
      return writing.then(function () {
        v.rev = Math.max(v.rev || 0, remoteRev !== null ? remoteRev + 1 : 0, localRev() + 1);
        if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
        memVault = null; writeJSON(VAULT_KEY, v); writeJSON(REPLACE_KEY, 1);
        remote = null;
        ignoreRemote = true;
        lock('Backup restored');
        setMode('unlock');
        msg('Backup restored. Unlock with the passcode it was made with.', true);
      });
    },
    backup: function () {
      return writing.then(function () {
        var raw = localStorage.getItem(VAULT_KEY);
        var blob = new Blob([raw], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'dashboard-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        try { localStorage.setItem('dash.lastBackup', String(Date.now())); } catch (e) {}
        /* remembered in the vault too, so every device knows when you last took one */
        if (data) { data.lastBackup = Date.now(); window.Vault.save(data); }
        window.dispatchEvent(new Event('dash:backup'));
      });
    },
    recovery: {
      has: function () { return !!(data && data._recCode); },
      code: function () { return data && data._recCode || null; },
      /* needs the passcode once (it's never stored) */
      create: function (pass) {
        if (!key) return Promise.reject(new Error('locked'));
        var vault = readJSON(VAULT_KEY);
        return derive(pass, unb64(vault.salt), vault.iter || ITER).then(function (k) { return open(vault, k); })
          .then(function () {
            var code = recNew();
            return recWrap(code, pass).then(function (r) {
              recNext = r; data._recCode = code;
              return window.Vault.save(data).then(function () { recNext = undefined; return code; });
            });
          }, function () { throw new Error('wrong'); });
      },
      remove: function () {
        if (!key) return Promise.reject(new Error('locked'));
        recNext = null; delete data._recCode;
        return window.Vault.save(data).then(function () { recNext = undefined; });
      }
    },
    /* for the Face ID / fingerprint unlock (passkey.js): check a passcode without unlocking, then unlock with it */
    tryPass: function (pass) {
      var vault = remote || readJSON(VAULT_KEY); if (!isVault(vault)) return Promise.resolve(false);
      return derive(pass, unb64(vault.salt), vault.iter || ITER).then(function (k) { return open(vault, k); }).then(function () { return true; }, function () { return false; });
    },
    unlockWith: function (pass) { if (key) return; busy(true); remoteCheck.then(function () { tryUnlock(pass); }); },
    changePasscode: function (pass) {
      if (!key) return Promise.reject(new Error('locked'));
      try { window.dispatchEvent(new CustomEvent('passcode:change')); } catch (e) {}
      var s = crypto.getRandomValues(new Uint8Array(16));
      return writing.then(function () { return data && data._recCode ? recWrap(data._recCode, pass).then(function (r) { recNext = r; }) : null; })
        .then(function () { return derive(pass, s, ITER); })
        .then(function (k) {
          return seal(data, k, s, localRev() + 1).then(function (v) {
            recNext = undefined;
            memVault = null; writeJSON(VAULT_KEY, v);
            key = k; salt = s;
            remember();
            return push();
          });
        });
    }
  };

  if (!window.crypto || !crypto.subtle) {
    showLocked();
    msg('Open the dashboard over https to unlock it.');
    $('lockSubmit').disabled = true;
    return;
  }

  /* Still unlocked from earlier on this device? Then open straight away. */
  $('lockBox').style.visibility = 'hidden';
  recall().then(function (rec) {
    var vault = readJSON(VAULT_KEY);
    /* "Lock now" removes dash.until at once (the stored key is deleted a moment later), so a reload right after locking stays locked */
    var until = null; try { until = localStorage.getItem('dash.until'); } catch (e) {}
    if (!rec || !rec.key || rec.until < Date.now() || !until || !isVault(vault) || vault.salt !== rec.salt) {
      if (rec) forget();
      throw new Error('locked');
    }
    return open(vault, rec.key).then(function (obj) {
      key = rec.key; salt = unb64(vault.salt);
      data = unpackKeep(obj, true);
      finishUnlock();
    });
  }).catch(function () {
    $('lockBox').style.visibility = '';
    if (!key) showLocked();
  });
})();
