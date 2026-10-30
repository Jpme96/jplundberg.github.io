/* Lock screen + encrypted vault for the dashboard.
   Your passcode never leaves this device and is never stored. It is turned into an
   AES-256 key (PBKDF2-SHA-256, 310 000 rounds) that encrypts the finance data in
   this browser's storage. Without the passcode the data cannot be read.
   Sync: if the Cloudflare worker (/_cloudflare/worker.js) is set up, the same
   encrypted blob is copied to Cloudflare so every device you log in on gets it.
   Cloudflare only ever sees the encrypted version. */
(function () {
  "use strict";

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
  function unpack(obj) {
    obj = obj || {};
    if (obj._w) {
      var w = obj._w;
      delete obj._w;
      Object.keys(w).forEach(function (k) { if (WIDGET_KEYS.indexOf(k) > -1) writeJSON(k, w[k]); });
      if (window.Dash && window.Dash.reload) window.Dash.reload();
    }
    return obj;
  }
  function localRev() { var v = readJSON(VAULT_KEY); return v && v.rev || 0; }
  function syncedRev() { var n = readJSON(SYNC_KEY); return typeof n === 'number' ? n : -1; }

  function open(vault, k) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, k, unb64(vault.ct))
      .then(function (pt) { return JSON.parse(dec.decode(pt)); });
  }

  function isVault(v) { return v && v.v === 1 && v.salt && v.iv && v.ct; }

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
        if (fromRemote) { writeJSON(VAULT_KEY, vault); writeJSON(SYNC_KEY, vault.rev || 0); remote = null; }
        data = unpack(obj);
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
    ignoreRemote = true;
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
      writeJSON(VAULT_KEY, v);
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
  document.addEventListener('click', function (e) { if (key && e.target.closest('#syncState')) sync(); });
  window.addEventListener('online', function () { if (key) sync(); });
  /* To-dos, notes, goals and links changed: include them in the encrypted vault. */
  window.addEventListener('dash:local', function () { if (key) window.Vault.save(data); });

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
        if (r.status === 404) { available = true; remoteRev = null; remoteSalt = null; return null; }  // set up, but empty
        if (!r.ok) {
          available = false;
          setSync('off', r.status === 401 ? 'Sync refused the login. Check TEAM_DOMAIN and POLICY_AUD'
            : r.status === 503 ? 'Sync worker is missing VAULT, TEAM_DOMAIN or POLICY_AUD'
            : 'Sync error ' + r.status);
          return undefined;
        }
        available = true;
        return r.json().then(function (v) {
          if (!isVault(v)) return undefined;
          remoteRev = v.rev || 0;
          remoteSalt = v.salt;
          return v;
        });
      })
      .catch(function () {
        if (available) setSync('offline');
        else setSync('off', navigator.onLine === false ? 'No internet' : 'Cloudflare login expired. Reload the page');
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

  function adopt(v, failNote) {
    var k = key;
    return open(v, k).then(function (obj) {
      if (key !== k) return;
      return localChanges().catch(function () { return []; }).then(function (changed) {
        if (key !== k) return;
        salt = unb64(v.salt);
        writeJSON(VAULT_KEY, v);
        writeJSON(SYNC_KEY, v.rev || 0);
        remoteRev = v.rev || 0;
        var w = obj._w || {};
        if (!changed.length || failNote) {           // nothing new here: take the other device's version
          data = unpack(obj);
          recordBase(data, w);
          emit();
          setSync('ok');
          return;
        }
        /* both devices changed something: keep this device's changed parts */
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
        emit();
        return window.Vault.save(data);           // new version on top of the other device's, then upload
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
      if (!v || lr > (v.rev || 0) || syncedRev() !== (v.rev || 0)) return push();
      writeJSON(SYNC_KEY, v.rev || 0);
      setSync('ok');
      if (data && !readJSON(BASE_KEY)) recordBase(data);
    });
  }

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { pushTimer = null; push(); }, 1500);
  }

  function push() {
    if (pushing || !available) { if (!available) setSync('off'); return Promise.resolve(); }
    pushing = true;
    setSync('busy');
    return writing.then(function () {
      var raw = localStorage.getItem(VAULT_KEY);
      var v = JSON.parse(raw);
      /* Never upload over a synced dashboard this device has never been part of. */
      if ((syncedRev() === -1 && remoteSalt && v.salt !== remoteSalt && !ignoreRemote)) { setSync('off'); return; }
      var base = remoteRev !== null ? remoteRev : syncedRev();
      return fetch(API, {
        method: 'PUT', credentials: 'same-origin', cache: 'no-store',
        headers: { 'content-type': 'application/json', 'X-Base-Rev': String(base) },
        body: raw
      }).then(function (r) {
        if (r.ok) { remoteRev = v.rev; writeJSON(SYNC_KEY, v.rev); setSync('ok'); if (data) recordBase(data); return; }
        if (r.status === 409) return r.json().then(function (cur) { remoteRev = cur.rev || 0; return adopt(cur); });
        if (r.status === 401 || r.status === 503) { available = false; setSync('off', 'Sync refused the save (' + r.status + ')'); }
        else setSync('offline');
      });
    }).catch(function () { setSync('offline'); })
      .then(function () { pushing = false; });
  }
  /* Coming back with the back button must not show an unlocked page from the cache. */
  window.addEventListener('pageshow', function (e) { if (e.persisted && tooLongAway()) lock(); });

  if ($('lockNow')) $('lockNow').addEventListener('click', lock);

  /* ---------- public API used by finance.js ---------- */
  window.Vault = {
    onUnlock: function (fn) { unlockFns.push(fn); if (key) fn(data); },
    onLock: function (fn) { lockFns.push(fn); },
    get: function () { return data; },
    save: function (obj) {
      if (!key) return Promise.reject(new Error('locked'));
      data = obj;
      var k = key, s = salt;
      writing = writing.then(function () { return seal(obj, k, s, localRev() + 1); })
        .then(function (v) { if (key === k) { writeJSON(VAULT_KEY, v); schedulePush(); } })
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
        writeJSON(VAULT_KEY, v);
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
    changePasscode: function (pass) {
      if (!key) return Promise.reject(new Error('locked'));
      var s = crypto.getRandomValues(new Uint8Array(16));
      return writing.then(function () { return data && data._recCode ? recWrap(data._recCode, pass).then(function (r) { recNext = r; }) : null; })
        .then(function () { return derive(pass, s, ITER); })
        .then(function (k) {
          return seal(data, k, s, localRev() + 1).then(function (v) {
            recNext = undefined;
            writeJSON(VAULT_KEY, v);
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
    if (!rec || !rec.key || rec.until < Date.now() || !isVault(vault) || vault.salt !== rec.salt) {
      if (rec) forget();
      throw new Error('locked');
    }
    return open(vault, rec.key).then(function (obj) {
      key = rec.key; salt = unb64(vault.salt);
      data = unpack(obj);
      finishUnlock();
    });
  }).catch(function () {
    $('lockBox').style.visibility = '';
    if (!key) showLocked();
  });
})();
