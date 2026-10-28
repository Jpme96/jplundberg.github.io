/* Lock screen + encrypted vault for the dashboard.
   Your passcode never leaves this device and is never stored. It is turned into an
   AES-256 key (PBKDF2-SHA-256, 310 000 rounds) that encrypts the finance data in
   this browser's storage. Without the passcode the data cannot be read. */
(function () {
  "use strict";

  var VAULT_KEY = 'dash.vault';
  var FAIL_KEY = 'dash.fails';
  var ITER = 310000;
  var IDLE_MS = 10 * 60 * 1000;   // lock after 10 minutes without activity
  var AWAY_MS = 2 * 60 * 1000;    // lock if the app was in the background for 2 minutes

  var enc = new TextEncoder();
  var dec = new TextDecoder();
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;

  var key = null;          // CryptoKey while unlocked, null when locked
  var salt = null;
  var data = null;         // decrypted vault contents while unlocked
  var writing = Promise.resolve();
  var idleTimer = null;
  var hiddenAt = 0;
  var unlockFns = [];
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

  function seal(obj, k, s) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(obj)))
      .then(function (ct) { return { v: 1, iter: ITER, salt: b64(s), iv: b64(iv), ct: b64(ct) }; });
  }

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
        ? 'This erases your encrypted finance data on this device. Your to-dos, notes and links stay.'
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

  function showLocked() {
    root.classList.add('locked');
    root.classList.remove('unlocked');
    $('lock').hidden = false;
    setMode(isVault(readJSON(VAULT_KEY)) ? 'unlock' : 'setup');
  }

  function finishUnlock() {
    removeKey(FAIL_KEY);
    $('lockPass').value = '';
    $('lockConfirm').value = '';
    $('lockPass').blur();
    root.classList.remove('locked');
    root.classList.add('unlocked');
    $('lock').hidden = true;
    resetIdle();
    unlockFns.forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } });
  }

  function lock() {
    key = null;
    data = null;
    salt = null;
    clearTimeout(idleTimer);
    lockFns.forEach(function (fn) { try { fn(); } catch (e) {} });
    showLocked();
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
        .then(function (k) { key = k; data = {}; return seal(data, key, salt); })
        .then(function (v) {
          busy(false);
          if (!writeJSON(VAULT_KEY, v)) { msg('This browser blocks storage (private mode?).'); key = null; return; }
          finishUnlock();
        })
        .catch(function () { busy(false); msg('This browser can’t encrypt. Try Safari or Chrome.'); });
      return;
    }

    var vault = readJSON(VAULT_KEY);
    if (!isVault(vault)) { setMode('setup'); return; }
    if (!pass) { shake(); return; }
    busy(true);
    var s = unb64(vault.salt), k;
    derive(pass, s, vault.iter || ITER)
      .then(function (kk) { k = kk; return open(vault, k); })
      .then(function (obj) {
        key = k; salt = s; data = obj || {};
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
  });

  $('lockForgot').addEventListener('click', function () { setMode('reset'); });
  $('lockCancelReset').addEventListener('click', function () { setMode('unlock'); });
  $('lockDoReset').addEventListener('click', function () {
    removeKey(VAULT_KEY);
    removeKey(FAIL_KEY);
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
      writeJSON(VAULT_KEY, v);
      setMode('unlock');
      msg('Backup loaded. Enter the passcode it was made with.', true);
    }).catch(function () { msg('That file isn’t a dashboard backup.'); shake(); });
  });

  /* ---------- auto-lock ---------- */
  function resetIdle() {
    if (!key) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(lock, IDLE_MS);
  }
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, resetIdle, { passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (key && hiddenAt && Date.now() - hiddenAt > AWAY_MS) lock();
  });
  /* Coming back with the back button must not show an unlocked page from the cache. */
  window.addEventListener('pageshow', function (e) { if (e.persisted && key) lock(); });

  $('lockNow').addEventListener('click', lock);

  /* ---------- public API used by finance.js ---------- */
  window.Vault = {
    onUnlock: function (fn) { unlockFns.push(fn); if (key) fn(data); },
    onLock: function (fn) { lockFns.push(fn); },
    get: function () { return data; },
    save: function (obj) {
      if (!key) return Promise.reject(new Error('locked'));
      data = obj;
      var k = key, s = salt;
      writing = writing.then(function () { return seal(obj, k, s); })
        .then(function (v) { if (key === k) writeJSON(VAULT_KEY, v); })
        .catch(function (e) { console.error(e); });
      return writing;
    },
    lock: lock,
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
      });
    },
    changePasscode: function (pass) {
      if (!key) return Promise.reject(new Error('locked'));
      var s = crypto.getRandomValues(new Uint8Array(16));
      return writing.then(function () { return derive(pass, s, ITER); })
        .then(function (k) {
          return seal(data, k, s).then(function (v) {
            writeJSON(VAULT_KEY, v);
            key = k; salt = s;
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
  showLocked();
})();
