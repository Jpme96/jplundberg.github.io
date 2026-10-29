/* Notifications and Siri & Shortcuts.

   Notifications are off until you switch them on (Settings → Notifications), and only on the
   device where you did. While the dashboard is open it plans the reminders for the next 7 days
   and gives them to the server (Worker), which sends each one at its time – also when the app is
   closed. "Private" text (the default) never sends titles or amounts: just "A bill is due today".
   "Full" sends the titles, so the reminder can say "Rent · 12 000 kr".
   Settings for this device are in localStorage "dash.push" (not synced – each device decides). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var API = '/cmd/api/push', KEY = 'dash.push';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function at(key, hh, mm) { var p = String(key).split('-'); return new Date(+p[0], p[1] - 1, +p[2], hh, mm || 0).getTime(); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(+n || 0)) + ' kr'; }
  var DEF = { on: false, ev: 15, k: { bills: true, tasks: true, pay: true, trips: true, checkin: true }, detail: 'private' };
  function prefs() { var p = readJSON(KEY, {}); var o = Object.assign({}, DEF, p); o.k = Object.assign({}, DEF.k, p.k || {}); return o; }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function devId() { var p = prefs(); if (!p.id) { p.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); save(p); } return p.id; }

  /* ================= Siri & Shortcuts ================= */
  function shortcuts() {
    var box = $('scList'); if (!box) return;
    var o = location.origin, Fe = window.Features, on = function (k, d) { return Fe ? Fe.on(k) : d; };
    var L = [['stars', 'Type a line – for Siri', o + '/cmd/?add=', 'Add what you say after it: “149 rema”, “fre 18 middag”, “løp 5 km”']];
    if (on('finance', true)) L.push(['receipt', 'Log expense', o + '/cmd/?add=expense', 'Opens the expense form']);
    if (on('calendar', true)) L.push(['calendar-plus', 'New event', o + '/cmd/?add=event', '']);
    L.push(['check2-square', 'New task', o + '/cmd/?add=task', '']);
    if (on('training', false)) L.push(['heart-pulse', 'Log workout', o + '/cmd/?add=workout', '']);
    L.push(['clipboard-check', 'Weekly check-in', o + '/cmd/#checkin', '']);
    if (on('finance', true)) L.push(['upload', 'Import from bank', o + '/cmd/finance/#import', '']);
    box.innerHTML = L.map(function (l) {
      return '<div class="st-row sc-row"><span class="st-ico" style="--c:#8a6fdf"><i class="bi bi-' + l[0] + '"></i></span><span class="st-label">' + esc(l[1]) +
        '<small class="sc-url">' + esc(l[2].replace(/^https?:\/\//, '')) + '</small>' + (l[3] ? '<small>' + esc(l[3]) + '</small>' : '') + '</span>' +
        '<button type="button" class="text-btn" data-sccopy="' + esc(l[2]) + '"><i class="bi bi-copy"></i> Copy</button></div>';
    }).join('');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sccopy]'); if (!b) return;
    var t = b.dataset.sccopy, done = function () { b.innerHTML = '<i class="bi bi-check-lg"></i> Copied'; setTimeout(function () { b.innerHTML = '<i class="bi bi-copy"></i> Copy'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { window.prompt('Copy this link', t); });
    else window.prompt('Copy this link', t);
  });

  /* ================= what to remind you of ================= */
  function plan() {
    var d = window.Vault && window.Vault.get(); if (!d) return [];
    var p = prefs(), full = p.detail === 'full', now = Date.now(), end = now + 7 * 864e5, out = [];
    var Fe = window.Features, C = window.Cal, Bu = window.Budget, Fl = window.Flow;
    var on = function (k, def) { return Fe ? Fe.on(k) : def; };
    function add(id, t, title, body, url) { if (t > now + 60e3 && t < end) out.push({ id: id, at: t, title: title, body: body, url: url || '/cmd/' }); }
    var tKey = dkey(new Date());
    /* events in your calendar (your own and your phone calendars), not all-day ones */
    if (+p.ev > 0 && C && on('calendar', true)) {
      try {
        C.occurrences(new Date(now), new Date(end), { card: true }).forEach(function (o) {
          if (o.allDay || o.ev.holiday || o.ev.reminder) return;
          var hm = pad(o.start.getHours()) + ':' + pad(o.start.getMinutes()), mins = +p.ev;
          add('ev:' + o.ev.id + ':' + o.start.getTime(), o.start.getTime() - mins * 60e3,
            full ? o.title : 'Coming up', full ? hm + (o.ev.location ? ' · ' + o.ev.location : '') + ' – in ' + (mins >= 60 ? mins / 60 + ' h' : mins + ' min') : 'Something in your calendar in ' + (mins >= 60 ? mins / 60 + ' hour' : mins + ' minutes'),
            '/cmd/calendar/#d=' + dkey(o.start));
        });
      } catch (e) {}
    }
    /* bills due (not subscriptions – those are paid automatically) */
    if (p.k.bills && d.budget && on('finance', true)) {
      for (var m = 0; m < 2; m++) {
        var base = new Date(); base = new Date(base.getFullYear(), base.getMonth() + m, 1);
        var ym = base.getFullYear() + '-' + pad(base.getMonth() + 1), dim = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate(), paid = (d.paid && d.paid[ym]) || [];
        (d.budget.fixed || []).forEach(function (f) {
          if (!f.day || f.src === 'sub' || paid.indexOf(f.id) > -1) return;
          var k = ym + '-' + pad(Math.min(f.day, dim));
          add('bill:' + f.id + ':' + k, at(k, 9), full ? f.name + ' is due today' : 'A bill is due today', full ? kr(f.amount) : 'Open Finances to see it', '/cmd/finance/#c=bills');
        });
      }
    }
    /* tasks with a day */
    if (p.k.tasks) (readJSON('dash.todos', []) || []).forEach(function (t) {
      if (t.done || !/^\d{4}-\d{2}-\d{2}$/.test(t.due || '')) return;
      add('task:' + t.id + ':' + t.due, at(t.due, 9), full ? t.text : 'A task is due today', full ? 'To-do · today' : 'Open your to-do list', '/cmd/#c=todo');
    });
    /* payday */
    if (p.k.pay && Bu && on('finance', true)) {
      try { Bu.paydays(d, new Date(), new Date(end)).forEach(function (x) { var k = dkey(x.date); add('pay:' + k, at(k, 8), x.title + ' today', full && x.net ? 'About ' + kr(x.net) : '', '/cmd/#fin'); }); } catch (e) {}
    }
    /* trips: the evening before */
    if (p.k.trips && Fl && on('travel', true)) {
      Fl.travel().trips.forEach(function (t) {
        if (!t.start || t.start <= tKey) return;
        var dt = new Date(t.start + 'T12:00'); dt.setDate(dt.getDate() - 1);
        add('trip:' + t.id, at(dkey(dt), 19), full ? (t.name || t.dest) + ' tomorrow' : 'Your trip starts tomorrow', full ? 'Check tickets, passport and packing list' : 'Check your packing list', '/cmd/travel/#trip=' + t.id);
      });
    }
    /* the weekly check-in, Sunday 18:00 */
    if (p.k.checkin && window.Checkin) {
      var sun = new Date(); sun.setDate(sun.getDate() + (7 - sun.getDay()) % 7);
      var wk = window.Checkin.weekOf(sun);
      if ((d.checkins || []).indexOf(wk.key) < 0) add('checkin:' + wk.key, at(dkey(sun), 18), 'Weekly check-in', '5 minutes: spending, the week ahead and habits', '/cmd/#checkin');
    }
    return out.sort(function (a, b) { return a.at - b.at; }).slice(0, 80);
  }

  /* ================= talking to the server ================= */
  function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function iosNotInstalled() { return /iP(hone|ad|od)/.test(navigator.userAgent) && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches); }
  function u8(b64) { var s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function api(method, body) {
    return fetch(API, { method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || ('error ' + r.status)); return j; }); });
  }
  function subscription(create) {
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        if (sub || !create) return sub;
        return api('GET').then(function (j) { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(j.key) }); });
      });
    });
  }
  var lastSent = '', timer = null;
  function sync(force) {
    var p = prefs();
    if (!p.on || !supported() || !window.Vault || !window.Vault.get()) return Promise.resolve();
    return subscription(false).then(function (sub) {
      if (!sub) return;
      var items = plan(), sig = JSON.stringify([items, p.detail]);
      if (!force && sig === lastSent && Date.now() - (p.synced || 0) < 6 * 3600e3) return;
      return api('PUT', { id: devId(), sub: sub.toJSON(), items: items }).then(function () {
        lastSent = sig; var q = prefs(); q.synced = Date.now(); q.count = items.length; save(q); fill();
      });
    }).catch(function (e) { var s = $('ntState'); if (s) s.textContent = 'Couldn’t reach the server: ' + e.message; });
  }
  function soon() { clearTimeout(timer); timer = setTimeout(sync, 4000); }

  /* ================= Settings → Notifications ================= */
  function fill() {
    var p = prefs(), box = $('ntOn'); if (!box) return;
    box.checked = !!p.on;
    $('ntMore').hidden = !p.on;
    var perm = 'Notification' in window ? Notification.permission : 'unsupported';
    $('ntState').textContent = !supported() ? 'This browser can’t show notifications' : iosNotInstalled() ? 'Open the dashboard from its Home Screen icon to use this' :
      !p.on ? 'Off' : perm === 'denied' ? 'Blocked – allow notifications for the app in the phone’s settings' :
      'On · ' + (p.count != null ? p.count + ' reminder' + (p.count === 1 ? '' : 's') + ' planned for the next 7 days' : 'planning…');
    document.querySelectorAll('[data-ntev]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.ntev === +p.ev)); });
    document.querySelectorAll('[data-ntk]').forEach(function (c) { c.checked = !!p.k[c.dataset.ntk]; });
    document.querySelectorAll('[data-ntdetail]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.ntdetail === p.detail)); });
    $('ntDetailNote').textContent = p.detail === 'full' ? 'Shows titles and amounts. They pass through your server to send them.' : 'No titles or amounts leave your device – “A bill is due today”.';
    $('ntHelp').textContent = 'Reminders are planned 7 days ahead each time you open the dashboard. Haven’t opened it for a week? Then they pause until you do.';
    var sum = $('sumNotify'); if (sum) sum.textContent = p.on ? 'On on this device' : 'Off';
  }
  function setP(patch) { var p = prefs(); Object.keys(patch).forEach(function (k) { p[k] = patch[k]; }); save(p); fill(); sync(true); }
  function turnOn() {
    if (!supported() || iosNotInstalled()) { $('ntOn').checked = false; fill(); return; }
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { $('ntOn').checked = false; var p = prefs(); p.on = false; save(p); fill(); $('ntState').textContent = 'Not allowed – you can allow it in the phone’s settings for the app'; return; }
      return subscription(true).then(function () { var p = prefs(); p.on = true; save(p); fill(); return sync(true); });
    }).catch(function (e) { $('ntOn').checked = false; $('ntState').textContent = 'Couldn’t switch on: ' + e.message; });
  }
  function turnOff() {
    var p = prefs(); p.on = false; save(p); fill();
    subscription(false).then(function (sub) {
      api('DELETE', { id: devId() }).catch(function () {});
      if (sub) sub.unsubscribe().catch(function () {});
    }).catch(function () {});
  }
  if ($('ntOn')) {
    $('ntOn').addEventListener('change', function () { if (this.checked) turnOn(); else turnOff(); });
    document.querySelectorAll('[data-ntev]').forEach(function (b) { b.addEventListener('click', function () { setP({ ev: +b.dataset.ntev }); }); });
    document.querySelectorAll('[data-ntk]').forEach(function (c) { c.addEventListener('change', function () { var p = prefs(); p.k[c.dataset.ntk] = c.checked; save(p); fill(); sync(true); }); });
    document.querySelectorAll('[data-ntdetail]').forEach(function (b) { b.addEventListener('click', function () { setP({ detail: b.dataset.ntdetail }); }); });
    $('ntTest').addEventListener('click', function () {
      var b = this; b.disabled = true;
      sync(true).then(function () { return api('POST', { id: devId(), test: true }); })
        .then(function () { if (window.Quick) window.Quick.toast('<i class="bi bi-send"></i> Test sent – it should arrive in a few seconds'); })
        .catch(function (e) { if (window.Quick) window.Quick.toast('<i class="bi bi-exclamation-circle"></i> ' + esc(e.message)); })
        .then(function () { b.disabled = false; });
    });
  }

  if (window.Vault) {
    window.Vault.onUnlock(function () { shortcuts(); fill(); setTimeout(sync, 2500); });
    ['dash:local', 'fin:change', 'cal:change', 'todos:change', 'travel:change', 'tools:change', 'checkin:done', 'features:change'].forEach(function (ev) { window.addEventListener(ev, soon); });
    setInterval(sync, 3 * 3600e3);
  }
  window.addEventListener('features:change', shortcuts);
  window.Notify = { plan: plan, sync: sync, prefs: prefs };
})();
