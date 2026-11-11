/* Your devices (Settings → Security → Your devices), Nov 2026.
   Each device gets a random id (dash.devId, never synced) and a name, sends it with every request to the
   Worker (X-Dash-Device), and says hello after unlocking at most every 6 hours – so you see which phones,
   tablets and computers have your dashboard, when each was last used, and from where.
   Sign one out: the Worker refuses it from then on, and the device erases its own copy (the passcode is
   needed to get it back). Needs the Worker from Nov 2026 – an older one just shows no list. */
(function () {
  "use strict";
  var ID_KEY = 'dash.devId', NAME_KEY = 'dash.devName', SEEN_KEY = 'dash.devSeen';
  function rs(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ws(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function newId() { var a = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (x, i) { a[i] = Math.random() * 256; }); return Array.prototype.map.call(a, function (b) { return b.toString(36).padStart(2, '0'); }).join('').slice(0, 20); }
  var id = rs(ID_KEY); if (!/^[a-z0-9]{8,40}$/.test(id || '')) { id = newId(); ws(ID_KEY, id); }
  function guess() {
    var u = navigator.userAgent, p = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows PC' : /Linux/.test(u) ? 'Linux' : 'Device';
    var b = /Edg\//.test(u) ? 'Edge' : /Firefox\//.test(u) ? 'Firefox' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : '';
    var app = matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'app' : b;
    return p + (app ? ' · ' + app : '');
  }
  function name() { return rs(NAME_KEY) || guess(); }

  /* every request to the Worker carries the device id; "signed out" wipes this device */
  var wiping = false;
  if (window.fetch) {
    var orig = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : input && input.url;
      if (!url || !/\/cmd\/api\//.test(url) || (/^https?:/.test(url) && url.indexOf(location.origin) !== 0)) return orig(input, init);
      init = Object.assign({}, init || {});
      var h = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {}); h.set('X-Dash-Device', id); init.headers = h;
      return orig(input, init).then(function (r) {
        if (r.status === 401) r.clone().json().then(function (j) { if (j && j.signedOut) wipe(); }).catch(function () {});
        return r;
      });
    };
  }
  function wipe() {
    if (wiping) return; wiping = true;
    try { Object.keys(localStorage).forEach(function (k) { if (/^dash[.:-]|^taskList$/.test(k)) localStorage.removeItem(k); }); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    var done = function () { ws(ID_KEY, newId()); location.replace('/cmd/?signedout=1'); };
    try {
      if (indexedDB && indexedDB.databases) indexedDB.databases().then(function (l) { (l || []).forEach(function (d) { if (/^dash/.test(d.name || '')) indexedDB.deleteDatabase(d.name); }); setTimeout(done, 300); }).catch(done);
      else done();
    } catch (e) { done(); }
  }
  /* say hello after unlocking – at most every 6 hours */
  function hello(force) {
    var last = +rs(SEEN_KEY) || 0; if (!force && Date.now() - last < 6 * 3600e3) return Promise.resolve();
    return window.fetch('/cmd/api/devices', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, name: name() }) })
      .then(function (r) { if (r.ok) ws(SEEN_KEY, String(Date.now())); }).catch(function () {});
  }
  if (window.Vault && window.Vault.onUnlock) window.Vault.onUnlock(function () { setTimeout(hello, 4000); });

  /* ---------- Settings → Security ---------- */
  function ago(ts) { var s = (Date.now() - ts) / 1000; return s < 120 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) === 1 ? 'yesterday' : Math.round(s / 86400) + ' days ago'; }
  function icon(d) { var u = (d.name || '') + ' ' + (d.ua || ''); return /iPhone|Android/.test(u) ? 'phone' : /iPad/.test(u) ? 'tablet' : 'laptop'; }
  function fill() {
    var box = document.getElementById('stDevices'); if (!box) return;
    box.innerHTML = '<p class="muted st-pad" data-t="ui.loading-2">Loading …</p>';
    window.fetch('/cmd/api/devices', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (j) {
      var l = (j.devices || []).sort(function (a, b) { return (a.id === id ? -1 : b.id === id ? 1 : 0) || (b.revoked ? -1 : 0) + (a.revoked ? 1 : 0) || (b.last || 0) - (a.last || 0); });
      if (!l.some(function (d) { return d.id === id; })) l.unshift({ id: id, name: name(), last: Date.now(), first: Date.now() });
      box.innerHTML = '<ul class="dv-list">' + l.map(function (d) {
        var me = d.id === id;
        return '<li class="' + (d.revoked ? 'off' : '') + '"><span class="st-ico" style="--c:' + (me ? '#22b35e' : d.revoked ? '#7a8794' : '#3987e5') + '"><i class="bi bi-' + icon(d) + '"></i></span>' +
          '<span class="dv-x"><b>' + esc(d.name || 'Device') + (me ? ' <em data-t="ui.this-device">this device</em>' : '') + '</b><small>' + (d.revoked ? 'Signed out ' + esc(ago(d.revoked)) : 'Last used ' + esc(ago(d.last || 0)) + (d.where ? ' · ' + esc(d.where) : '')) + (d.first ? ' · first ' + esc(new Date(d.first).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })) : '') + '</small></span>' +
          (me ? '<button type="button" class="text-btn" data-dvname data-t="ui.rename">Rename</button>' : d.revoked ? '<button type="button" class="text-btn" data-dvforget="' + esc(d.id) + '">Remove</button>' : '<button type="button" class="text-btn danger" data-dvout="' + esc(d.id) + '">Sign out</button>') + '</li>';
      }).join('') + '</ul><p class="st-note st-pad" data-t="ui.signing-out-a-device-erases-the-dashboar">Signing out a device erases the dashboard on it the next time it’s used – your data stays here and on your other devices. Lost a phone? Change the passcode too.</p>';
    }).catch(function () { box.innerHTML = '<p class="st-note st-pad">The list of devices needs the newest Worker (dashboard-sync). This device: <b>' + esc(name()) + '</b>.</p>'; });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-dvout]');
    if (b) {
      if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Tap again'; return; }
      window.fetch('/cmd/api/devices?id=' + encodeURIComponent(b.dataset.dvout), { method: 'DELETE', credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw 0; fill(); if (window.Quick) window.Quick.toast('<i class="bi bi-box-arrow-right"></i> Signed out – it erases itself next time it’s used'); }).catch(function () { if (window.Quick) window.Quick.toast('Couldn’t reach the Worker'); });
      return;
    }
    var f = e.target.closest('[data-dvforget]');
    if (f) { window.fetch('/cmd/api/devices?forget=1&id=' + encodeURIComponent(f.dataset.dvforget), { method: 'DELETE', credentials: 'same-origin' }).then(fill); return; }
    if (e.target.closest('[data-dvname]')) {
      var li = e.target.closest('li'), x = li.querySelector('.dv-x');
      x.innerHTML = '<input class="st-input dv-in" maxlength="40" value="' + esc(name()) + '" aria-label="Name of this device">';
      var i = x.querySelector('input'); i.focus(); i.select();
      var save = function () { var v = i.value.trim(); if (v) ws(NAME_KEY, v); else try { localStorage.removeItem(NAME_KEY); } catch (er) {} hello(true).then(fill); };
      i.addEventListener('keydown', function (k) { if (k.key === 'Enter') { k.preventDefault(); i.blur(); } });
      i.addEventListener('blur', save, { once: true });
    }
  });
  window.addEventListener('st:page', function (e) { if (e.detail === 'security') fill(); });
  if (/[?&]signedout=1/.test(location.search)) document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () { var m = document.getElementById('lockMsg'); if (m) m.textContent = 'This device was signed out from another device, and its copy erased. Enter your passcode to set it up again.'; }, 1500);
    history.replaceState(null, '', location.pathname);
  });
  window.Devices = { id: function () { return id; }, name: name, hello: hello, list: fill };
})();
