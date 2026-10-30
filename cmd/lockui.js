/* The lock screen's look, and recovery by email.
     Look      Settings → Appearance → Lock screen: the dashboard's background, a photo of your own
               (kept on this device only), or a style – and a big clock with the date.
     Recovery  Settings → Security → Recovery by email: turn on (needs the passcode once), test email, new key, turn off.
               On the lock screen: "Forgot passcode?" → "Open with the code" (lock.js). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function settings() { return readJSON('dash.settings', {}) || {}; }
  function setS(patch) { var s = settings(); Object.keys(patch).forEach(function (k) { if (patch[k] === undefined) delete s[k]; else s[k] = patch[k]; }); try { localStorage.setItem('dash.settings', JSON.stringify(s)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); apply(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(h) { if (window.Quick && window.Quick.toast) window.Quick.toast(h); }

  /* ============================== the look ============================== */
  var STYLES = [['', 'Same as the dashboard'], ['photo', 'Your photo'], ['aurora', 'Aurora'], ['dusk', 'Dusk'], ['ocean', 'Ocean'], ['midnight', 'Midnight'], ['minimal', 'Minimal']];
  function db(mode, fn) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open('dash-bg', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('img'); };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () { var d = req.result, tx = d.transaction('img', mode), q = fn(tx.objectStore('img')); tx.oncomplete = function () { d.close(); resolve(q && q.result); }; tx.onerror = function () { d.close(); reject(tx.error); }; };
    });
  }
  var photoUrl = null, photoTried = false;
  function loadPhoto() {
    if (photoTried || !window.indexedDB) return Promise.resolve(photoUrl);
    photoTried = true;
    return db('readonly', function (st) { return st.get('lock'); }).then(function (b) {
      if (b) { photoUrl = URL.createObjectURL(b); root.style.setProperty('--lock-photo', 'url("' + photoUrl + '")'); }
      return photoUrl;
    }).catch(function () { return null; });
  }
  function apply() {
    var s = settings(), st = s.lockStyle || '';
    if (st === 'photo') loadPhoto().then(function (u) { if (!u && settings().lockStyle === 'photo') root.removeAttribute('data-lock'); });
    if (st) root.setAttribute('data-lock', st); else root.removeAttribute('data-lock');
    clock();
  }
  /* the clock on the lock screen */
  var tick = null;
  function clock() {
    var lock = $('lock'); if (!lock) return;
    var on = settings().lockClock !== false, el = $('lockClock');
    if (!on) { if (el) el.remove(); clearInterval(tick); tick = null; return; }
    if (!el) { el = document.createElement('div'); el.id = 'lockClock'; el.className = 'lock-clock'; el.setAttribute('aria-hidden', 'true'); lock.insertBefore(el, lock.firstChild); }
    var draw = function () {
      var d = new Date();
      el.innerHTML = '<b>' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + '</b><span>' + esc(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })) + '</span>';
    };
    draw();
    if (!tick) tick = setInterval(function () { if (!lock.hidden && !document.hidden) draw(); }, 15000);
  }
  apply();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) clock(); });

  /* ---------- Settings → Appearance → Lock screen ---------- */
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var max = 2000, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('encode')); }, 'image/jpeg', .85);
      };
      img.onerror = function () { reject(new Error('read')); };
      img.src = URL.createObjectURL(file);
    });
  }
  function mountLook() {
    var bgTiles = $('stBgTiles'); if (!bgTiles || $('stLockLook')) return;
    var sec = bgTiles.closest('section'); if (!sec) return;
    var head = document.createElement('p'); head.className = 'st-sub ap-sub'; head.innerHTML = '<i class="bi bi-lock"></i> Lock screen';
    var box = document.createElement('section'); box.className = 'st-group'; box.id = 'stLockLook';
    sec.parentNode.insertBefore(box, sec.nextSibling); sec.parentNode.insertBefore(head, box);
    function render() {
      var s = settings(), cur = s.lockStyle || '';
      box.innerHTML = '<div class="st-col"><div class="lk-tiles">' + STYLES.map(function (x) {
        return '<button type="button" class="lk-tile" data-lkstyle="' + x[0] + '" aria-pressed="' + (cur === x[0]) + '"><span class="lk-prev lk-' + (x[0] || 'same') + '"' + (x[0] === 'photo' && photoUrl ? ' style="background-image:url(' + photoUrl + ')"' : '') + '><i class="bi bi-lock-fill"></i></span>' + esc(x[1]) + '</button>';
      }).join('') + '</div><input type="file" id="stLockFile" accept="image/*" hidden>' +
        (cur === 'photo' ? '<p class="st-note"><button type="button" class="link-btn" data-lkchange>Choose another photo</button> · on this device only</p>' : '') + '</div>' +
        '<label class="st-row"><span class="st-label">Clock and date<small>Big, above the passcode</small></span><input type="checkbox" class="switch" id="stLockClock"' + (s.lockClock !== false ? ' checked' : '') + '></label>';
    }
    loadPhoto().then(render);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lkstyle]');
      if (b) { var v = b.dataset.lkstyle; if (v === 'photo' && !photoUrl) { $('stLockFile').click(); return; } setS({ lockStyle: v || undefined }); render(); toast('<i class="bi bi-lock"></i> Lock screen updated'); return; }
      if (e.target.closest('[data-lkchange]')) $('stLockFile').click();
    });
    box.addEventListener('change', function (e) {
      if (e.target.id === 'stLockClock') { setS({ lockClock: e.target.checked ? undefined : false }); return; }
      if (e.target.id !== 'stLockFile') return;
      var f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
      shrink(f).then(function (blob) {
        return db('readwrite', function (st) { return st.put(blob, 'lock'); }).then(function () {
          if (photoUrl) URL.revokeObjectURL(photoUrl);
          photoUrl = URL.createObjectURL(blob); root.style.setProperty('--lock-photo', 'url("' + photoUrl + '")');
          setS({ lockStyle: 'photo' }); render(); toast('<i class="bi bi-image"></i> Lock screen photo set');
        });
      }).catch(function () { toast('That photo couldn’t be used. Try a JPEG or PNG.'); });
    });
  }

  /* ============================== recovery by email ============================== */
  function R() { return window.Vault && window.Vault.recovery; }
  function recState() {
    var el = $('stRecState'); if (!el || !R()) return;
    var m = R().mode();
    el.textContent = m === 'email' ? 'On – forgot the passcode? Get a code by email' : m === 'code' ? 'Old printed code – switch to a code by email' : 'Not set up – if you forget the passcode, everything is lost';
    var b = $('stRecovery'); if (b) b.classList.toggle('st-warnrow', m !== 'email');
  }
  function dialog(html, onClick) {
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<div class="fo-box lf-box rc-box" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    function close() { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 180); }
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-rcclose]')) return close(); if (onClick) onClick(e, close, bg.firstChild); });
    return { el: bg.firstChild, close: close };
  }
  function head(t, sub) { return '<div class="lf-head"><h3><i class="bi bi-life-preserver"></i> ' + esc(t) + '</h3><button type="button" class="icon-btn sm" data-rcclose aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' + (sub ? '<p class="muted lf-sub">' + esc(sub) + '</p>' : ''); }
  function showOn() {
    var d = dialog(head('Email recovery', 'If you forget the passcode: lock screen → Forgot passcode? → Email me a code. The code works for 15 minutes, then you choose a new passcode.') +
      '<p class="rc-state" id="rcState"><i class="bi bi-hourglass-split"></i> Checking the server…</p>' +
      '<div class="rc-acts"><button type="button" class="pill-btn" data-rctest><i class="bi bi-envelope-check"></i> Send a test email</button></div>' +
      '<p class="lock-msg" id="rcMsg"></p>' +
      '<div class="rc-more"><button type="button" class="text-btn" data-rcnew><i class="bi bi-arrow-repeat"></i> Make a new key</button><button type="button" class="text-btn danger" data-rcdel><i class="bi bi-trash3"></i> Turn off</button></div>',
      function (e, close) {
        var t = e.target.closest('[data-rctest]');
        if (t) {
          t.disabled = true; $('rcMsg').classList.remove('ok'); $('rcMsg').textContent = '';
          R().test().then(function (j) {
            t.disabled = false;
            $('rcMsg').classList.toggle('ok', !!j.ok);
            $('rcMsg').textContent = j.ok ? 'Sent – check your inbox (and spam).' : R().error(j);
          }, function () { t.disabled = false; $('rcMsg').textContent = R().error(null); });
          return;
        }
        if (e.target.closest('[data-rcnew]')) { close(); setTimeout(function () { create(true); }, 200); return; }
        var b = e.target.closest('[data-rcdel]');
        if (b) {
          if (!b.dataset.armed) { b.dataset.armed = '1'; b.innerHTML = '<i class="bi bi-trash3"></i> Tap again to turn off'; return; }
          R().remove().then(function () { close(); recState(); toast('<i class="bi bi-life-preserver"></i> Email recovery turned off'); });
        }
      });
    R().status().then(function (j) {
      var el = d.el.querySelector('#rcState'); if (!el) return;
      if (!j._s) { el.innerHTML = '<i class="bi bi-wifi-off"></i> ' + esc('Offline – can’t check the server now.'); return; }
      if (!j.on) { el.className = 'rc-state warn'; el.innerHTML = '<i class="bi bi-exclamation-triangle"></i> ' + esc('The server doesn’t have the key. Tap “Make a new key”.'); return; }
      el.className = 'rc-state' + (j.email ? ' ok' : ' warn');
      el.innerHTML = j.email ? '<i class="bi bi-check-circle"></i> ' + esc('Ready – the key is on the server and email is set up.')
        : '<i class="bi bi-exclamation-triangle"></i> ' + esc('The key is saved, but the Worker can’t send email yet. Add the Send email binding EMAIL (see the setup notes).');
    }, function () {});
  }
  function create(replace) {
    var old = R().mode() === 'code';
    var d = dialog(head(replace ? 'Make a new key' : 'Set up email recovery', 'Enter your passcode once. If you ever forget it, the lock screen can email you a 6-digit code that opens the dashboard.' + (old ? ' Your old printed code stops working.' : replace ? ' Codes already sent stop working.' : '')) +
      '<form class="rc-form" autocomplete="off"><input type="text" name="username" value="dashboard" autocomplete="username" hidden>' +
      '<input type="password" id="rcPass" placeholder="Your passcode" autocomplete="current-password" required aria-label="Your passcode">' +
      '<p class="lock-msg" id="rcMsg"></p><button type="submit" class="pill-btn wide">Turn on</button></form>');
    setTimeout(function () { var i = $('rcPass'); if (i) i.focus(); }, 80);
    d.el.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = d.el.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Turning on…';
      R().create($('rcPass').value).then(function () {
        d.close(); recState(); toast('<i class="bi bi-envelope-check"></i> Email recovery is on'); setTimeout(showOn, 200);
      }).catch(function (err) {
        btn.disabled = false; btn.textContent = 'Turn on';
        if (err && err.message === 'server') { $('rcMsg').textContent = R().error(err.info); return; }
        $('rcMsg').textContent = 'Wrong passcode.'; $('rcPass').value = ''; $('rcPass').focus();
      });
    });
  }
  function mountRecovery() {
    var b = $('stRecovery'); if (!b || b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('click', function () {
      if (!R()) return;
      if (R().mode() === 'email') showOn(); else create(false);
    });
  }

  function mount() { mountLook(); mountRecovery(); recState(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  if (window.Vault) window.Vault.onUnlock(function () { recState(); apply(); });
  window.addEventListener('st:page', function (e) { if (e.detail === 'security') recState(); if (e.detail === 'appearance') mountLook(); });
  window.addEventListener('storage', function (e) { if (e.key === 'dash.settings') apply(); });
  window.addEventListener('dash:local', function () { clearTimeout(apply.t); apply.t = setTimeout(apply, 100); });
})();
