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
  var DEF = { on: false, ev: 15, k: { bills: true, tasks: true, pay: true, trips: true, checkin: true, summary: true, monthly: true, house: true, people: true, timer: true, commute: false, morning: true }, detail: 'private' };
  function prefs() { var p = readJSON(KEY, {}); var o = Object.assign({}, DEF, p); o.k = Object.assign({}, DEF.k, p.k || {}); return o; }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function devId() { var p = prefs(); if (!p.id) { p.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); save(p); } return p.id; }

  /* ================= Siri & Shortcuts ================= */
  function shortcuts() {
    var box = $('scList'); if (!box) return;
    var o = location.origin, Fe = window.Features, on = function (k, d) { return Fe ? Fe.on(k) : d; };
    var K = I18N.k, L = [['stars', K('ui.sc-type-a-line', 'Type a line – for Siri'), o + '/cmd/?add=', K('ui.sc-add-what-you-say', 'Add what you say after it: “149 rema”, “fre 18 middag”, “løp 5 km”')]];
    if (on('finance', true)) L.push(['receipt', K('ui.log-expense', 'Log expense'), o + '/cmd/?add=expense', K('ui.sc-opens-the-expense-form', 'Opens the expense form')]);
    if (on('calendar', true)) L.push(['calendar-plus', K('ui.sc-new-event', 'New event'), o + '/cmd/?add=event', '']);
    L.push(['check2-square', K('ui.sc-new-task', 'New task'), o + '/cmd/?add=task', '']);
    if (on('training', false)) L.push(['heart-pulse', K('ui.sc-log-workout', 'Log workout'), o + '/cmd/?add=workout', '']);
    L.push(['clipboard-check', K('ui.weekly-check-in', 'Weekly check-in'), o + '/cmd/#checkin', '']);
    if (on('finance', true)) L.push(['upload', K('ui.import-from-bank', 'Import from bank'), o + '/cmd/finance/#import', '']);
    box.innerHTML = L.map(function (l) {
      return '<div class="st-row sc-row"><span class="st-ico" style="--c:#8a6fdf"><i class="bi bi-' + l[0] + '"></i></span><span class="st-label">' + esc(l[1]) +
        '<small class="sc-url">' + esc(l[2].replace(/^https?:\/\//, '')) + '</small>' + (l[3] ? '<small>' + esc(l[3]) + '</small>' : '') + '</span>' +
        '<button type="button" class="text-btn" data-sccopy="' + esc(l[2]) + '"><i class="bi bi-copy"></i> <span data-t="ui.copy">Copy</span></button></div>';
    }).join('');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sccopy]'); if (!b) return;
    var t = b.dataset.sccopy, done = function () { b.innerHTML = '<i class="bi bi-check-lg"></i> Copied'; setTimeout(function () { b.innerHTML = '<i class="bi bi-copy"></i> Copy'; }, 1600); };
    var show = function () { window.Ask.prompt(I18N.k('ui.copy-this-link', 'Copy this link'), t, { ok: I18N.k('ui.close', 'Close') }); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, show);
    else show();
  });

  /* ================= what to remind you of ================= */
  /* plan(opts): the reminders from now to a week ahead (what's sent to the server). opts.from / opts.to (ms) widen or
     narrow the window and opts.full asks for the full text – the notification panel shows the last days too and only
     what you'd be told (2026-11-20). */
  function plan(opts) {
    opts = opts || {};
    var d = window.Vault && window.Vault.get(); if (!d) return [];
    var p = prefs(), full = opts.full != null ? opts.full : p.detail === 'full', now = opts.from != null ? opts.from - 60e3 : Date.now(), end = opts.to != null ? opts.to : Date.now() + 7 * 864e5, out = [];
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
          add('bill:' + f.id + ':' + k, at(k, 9), full ? f.name + ' is due today' : 'A bill is due today', full ? kr(f.amount) : 'Open Finances to see it', '/cmd/finance/#c=next');
        });
      }
    }
    /* the morning "Today" (later features): 07:30 each of the next mornings – what's in the calendar, your top
       tasks and bills due that day (worked out now, so it's as fresh as the last time the dashboard was open) */
    /* the panel asks for the last days too (opts.from): their mornings are listed as well, worked out from today's data */
    var m0 = opts.from != null ? -Math.ceil((Date.now() - opts.from) / 864e5) : 0;
    if (p.k.morning) for (var mi = m0; mi < 3; mi++) {
      var md = new Date(); md.setDate(md.getDate() + mi); var mk = dkey(md), evs = [], tasks = [], bills = [];
      try { if (C && on('calendar', true)) evs = C.occurrences(new Date(md.getFullYear(), md.getMonth(), md.getDate()), new Date(md.getFullYear(), md.getMonth(), md.getDate(), 23, 59), { card: true }).filter(function (o) { return !(o.ev && (o.ev.holiday || o.ev.reminder)); }); } catch (e) {}
      tasks = (readJSON('dash.todos', []) || []).filter(function (t) { return !t.done && (t.due === mk || t.today === mk); });
      if (d.budget && on('finance', true)) { var mym = mk.slice(0, 7), mpaid = (d.paid && d.paid[mym]) || []; bills = (d.budget.fixed || []).filter(function (f) { return f.day && f.src !== 'sub' && +f.day === md.getDate() && mpaid.indexOf(f.id) < 0; }); }
      if (!evs.length && !tasks.length && !bills.length) continue;
      var first = evs.filter(function (o) { return !o.allDay; })[0], parts = [];
      if (evs.length) parts.push(evs.length + (evs.length === 1 ? ' event' : ' events') + (full && first ? ' (first ' + pad(first.start.getHours()) + ':' + pad(first.start.getMinutes()) + ' ' + first.title + ')' : ''));
      if (tasks.length) parts.push(full ? 'Tasks: ' + tasks.slice(0, 3).map(function (t) { return t.text; }).join(', ') : tasks.length + (tasks.length === 1 ? ' task' : ' tasks'));
      if (bills.length) parts.push(full ? 'Due: ' + bills.map(function (f) { return f.name; }).join(', ') : bills.length + (bills.length === 1 ? ' bill due' : ' bills due'));
      add('morning:' + mk, at(mk, 7, 30), 'Today', parts.join(' · '), '/cmd/#c=brief');
    }
    /* tasks with a day */
    if (p.k.tasks) (readJSON('dash.todos', []) || []).forEach(function (t) {
      if (t.done || !/^\d{4}-\d{2}-\d{2}$/.test(t.due || '')) return;
      add('task:' + t.id + ':' + t.due, at(t.due, 9), full ? t.text : 'A task is due today', full ? 'To-do · today' : 'Open your to-do list', '/cmd/#c=todo');
    });
    /* payday */
    if (p.k.pay && Bu && on('finance', true)) {
      try {
        /* the payday checklist: what to move where (the plan as it stands now) */
        var mv = Bu.payPlan ? Bu.payPlan(d).moves : [];
        var mvTxt = mv.length ? (full ? mv.slice(0, 3).map(function (m) { return kr(m.amount) + ' → ' + m.label.replace(/^Move to |^Put aside for /, ''); }).join(', ') : mv.length + ' move' + (mv.length === 1 ? '' : 's') + ' on your payday checklist') : '';
        Bu.paydays(d, new Date(), new Date(end)).forEach(function (x) { var k = dkey(x.date); add('pay:' + k, at(k, 8), x.title + ' today', (full && x.net ? 'About ' + kr(x.net) + (mvTxt ? ' · ' : '') : '') + mvTxt, mv.length ? '/cmd/finance/#c=flow' : '/cmd/#fin'); });
      } catch (e) {}
    }
    /* credit card bills: the day before and on the due day, until marked paid in full */
    if (p.k.bills && Bu && Bu.cardBills && on('finance', true)) {
      try {
        Bu.cardBills(d).forEach(function (c) {
          if (!c.due || c.paid || c.days < 0 || c.days > 8) return;
          var k = dkey(c.date), pre = new Date(c.date); pre.setDate(pre.getDate() - 1);
          var body = full ? (c.amount ? 'About ' + kr(c.amount) + ' – ' : '') + 'pay the whole bill' : 'Pay the whole bill to avoid interest';
          if (c.days >= 1) add('cc1:' + c.acct.id + ':' + k, at(dkey(pre), 18), full ? c.acct.label + ' bill due tomorrow' : 'A card bill is due tomorrow', body, '/cmd/finance/#c=flow');
          add('cc0:' + c.acct.id + ':' + k, at(k, 9), full ? c.acct.label + ' bill due today' : 'A card bill is due today', body, '/cmd/finance/#c=flow');
        });
      } catch (e) {}
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
      if ((d.checkins || []).indexOf(wk.key) < 0) add('checkin:' + wk.key, at(dkey(sun), 18), I18N.k('ui.weekly-check-in', 'Weekly check-in'), I18N.k('ui.checkin-sub2', '5 minutes: spending, the week ahead and habits'), '/cmd/#checkin');
    }
    /* the Sunday summary (2026-11-20, list of 16 Nov point 24): Sunday 19:00 – money spent this week, workouts, and the
       week ahead. Worked out now, so it's as fresh as the last time the dashboard was open. */
    if (p.k.summary !== false) {
      var su = new Date(); su.setDate(su.getDate() + (7 - su.getDay()) % 7); var suK = dkey(su), mo = new Date(su); mo.setDate(mo.getDate() - 6); var moK = dkey(mo);
      var spent = on('finance', true) ? (d.expenses || []).filter(function (e) { return e && e.date >= moK && e.date <= suK; }).reduce(function (a, e) { return a + (+e.amount || 0); }, 0) : null;
      var wo = null; try { var hw = window.HealthPlus && window.HealthPlus.week ? window.HealthPlus.week(moK) : null; wo = hw ? hw.workouts : null; } catch (e) {}
      var ahead = 0; try { if (C && on('calendar', true)) { var n1 = new Date(su.getFullYear(), su.getMonth(), su.getDate() + 1), n7 = new Date(su.getFullYear(), su.getMonth(), su.getDate() + 7, 23, 59); ahead = C.occurrences(n1, n7, { card: true }).filter(function (o) { return !o.ev || !o.ev.reminder; }).length; } } catch (e) {}
      var bits = [];
      if (spent != null) bits.push(I18N.k('ui.sum-spent', 'Spent {a}', { a: kr(spent) }));
      if (wo != null) bits.push(I18N.k(wo === 1 ? 'ui.sum-wo1' : 'ui.sum-wo', wo === 1 ? '1 workout' : '{n} workouts', { n: wo }));
      bits.push(I18N.k(ahead === 1 ? 'ui.sum-ahead1' : 'ui.sum-ahead', ahead === 1 ? '1 event next week' : '{n} events next week', { n: ahead }));
      add('summary:' + suK, at(suK, 19), I18N.k('ui.sum-title', 'Your week'), full ? bits.join(' · ') : I18N.k('ui.sum-private', 'Your week in short – open the dashboard'), '/cmd/#c=brief');
    }
    /* your month in money (JP 2026-11-21): the 1st at 09:00 – what last month cost against the month before, the category that
       changed most, and how far the savings goal has come. Worked out on the device; the private setting shows no numbers. */
    if (p.k.monthly !== false && on('finance', true)) {
      try {
        var m1 = new Date(); m1 = new Date(m1.getFullYear(), m1.getMonth() + 1, 1); var m1K = dkey(m1);
        var mk = function (dt, n) { var x = new Date(dt.getFullYear(), dt.getMonth() + n, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
        var lm = mk(m1, -1), pm = mk(m1, -2), byC = function (ym) { var o = { t: 0 }; (d.expenses || []).forEach(function (e) { if (e && String(e.date).slice(0, 7) === ym) { var a = +e.amount || 0; o.t += a; o[e.cat || 'other'] = (o[e.cat || 'other'] || 0) + a; } }); return o; };
        var A = byC(lm), B = byC(pm);
        if (A.t > 0) {
          var mb = [I18N.k('ui.msum-spent', '{m}: {a}', { m: new Date(lm + '-15').toLocaleDateString(I18N.lang === 'nb' ? 'nb-NO' : 'en-GB', { month: 'long' }), a: kr(A.t) })];
          if (B.t > 0) { var dp = Math.round((A.t - B.t) / B.t * 100); mb.push(dp === 0 ? I18N.k('ui.msum-same', 'same as the month before') : I18N.k(dp > 0 ? 'ui.msum-up' : 'ui.msum-down', dp > 0 ? '{p} % more than the month before' : '{p} % less than the month before', { p: Math.abs(dp) })); }
          var big = null; Object.keys(A).concat(Object.keys(B)).forEach(function (c) { if (c === 't') return; var dc = (A[c] || 0) - (B[c] || 0); if (!big || Math.abs(dc) > Math.abs(big[1])) big = [c, dc]; });
          if (big && B.t > 0 && Math.abs(big[1]) >= 500) { var cn = window.FinCats && window.FinCats.name ? window.FinCats.name(big[0]) : big[0]; mb.push(I18N.k(big[1] > 0 ? 'ui.msum-cat-up' : 'ui.msum-cat-down', big[1] > 0 ? '{c} +{a}' : '{c} −{a}', { c: cn, a: kr(Math.abs(big[1])) })); }
          var wi0 = ((Fe && Fe.tools && Fe.tools().whatif) || [])[0];
          if (wi0 && +wi0.target > 0 && window.Accts) { var sv = window.Accts.list(d).filter(function (a) { return (a.kind === 'savings' || a.kind === 'fund') && a.bal != null && a.nw; }).reduce(function (a, x) { return a + x.bal; }, 0); if (sv > 0) mb.push(I18N.k('ui.msum-goal', 'savings goal {p} %', { p: Math.min(100, Math.round(sv / wi0.target * 100)) })); }
          add('monthly:' + lm, at(m1K, 9), I18N.k('ui.msum-title', 'Your month in money'), full ? mb.join(' · ') : I18N.k('ui.msum-private', 'Last month in short – open Finances'), '/cmd/finance/#c=flow');
        }
      } catch (e) {}
    }
    /* document deadlines (JP 23:46): a week before and on the day, 08:00, while documents are still missing or not approved */
    if (Fe && Fe.list) (Fe.list('dctl') || []).forEach(function (pj) {
      if (!pj || !/^\d{4}-\d\d-\d\d$/.test(pj.due || '')) return;
      var L = pj.lines || [], miss = L.filter(function (l) { return l.st === 'missing'; }).length, open = L.filter(function (l) { return l.st === 'missing' || l.st === 'recv' || l.st === 'rej'; }).length;
      if (!open) return;
      var body = full ? I18N.k('ui.nt-dc-body', '{m} documents missing, {o} not approved yet', { m: miss, o: open }) : I18N.k('ui.nt-dc-open', 'Documents are still open'), url = '/cmd/work/#dc=' + pj.id, d0 = new Date(pj.due + 'T12:00'), wk = new Date(d0); wk.setDate(wk.getDate() - 7);
      add('dc:' + pj.id + ':7', at(dkey(wk), 8), full ? I18N.k('ui.nt-dc-week', '{p}: deadline in a week', { p: pj.name }) : I18N.k('ui.nt-dc-week0', 'A document deadline is in a week'), body, url);
      add('dc:' + pj.id + ':0', at(pj.due, 8), full ? I18N.k('ui.nt-dc-today', '{p}: deadline today', { p: pj.name }) : I18N.k('ui.nt-dc-today0', 'A document deadline is today'), body, url);
    });
    /* more from the other parts (House, People, client timer …): window.NotifyExtra */
    (window.NotifyExtra || []).forEach(function (fn) { try { fn(add, { full: full, k: p.k, now: now, end: end, at: at, dkey: dkey }); } catch (e) {} });
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
      return (window.PushKey ? PushKey.sealItems(items) : Promise.resolve(items.map(function (x) { return { id: x.id, at: x.at, url: x.url }; }))).then(function (sealed) { return api('PUT', { id: devId(), sub: sub.toJSON(), items: sealed }); }).then(function () {
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
    var K = I18N.k;
    $('ntState').textContent = !supported() ? K('ui.nt-st-none', 'This browser can’t show notifications') : iosNotInstalled() ? K('ui.nt-st-ios', 'Open the dashboard from its Home Screen icon to use this') :
      !p.on ? K('ui.off', 'Off') : perm === 'denied' ? K('ui.nt-st-blocked', 'Blocked – allow notifications for the app in the phone’s settings') :
      (p.count != null ? K(p.count === 1 ? 'ui.nt-st-on1' : 'ui.nt-st-on', p.count === 1 ? 'On · 1 reminder planned for the next 7 days' : 'On · {n} reminders planned for the next 7 days', { n: p.count }) : K('ui.nt-st-planning', 'On · planning…'));
    document.querySelectorAll('[data-ntev]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.ntev === +p.ev)); });
    document.querySelectorAll('[data-ntk]').forEach(function (c) { c.checked = !!p.k[c.dataset.ntk]; });
    document.querySelectorAll('[data-ntdetail]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.ntdetail === p.detail)); });
    $('ntDetailNote').textContent = p.detail === 'full' ? I18N.k('ui.nt-detail-full', 'Shows titles and amounts. They pass through your server to send them.') : I18N.k('ui.nt-detail-short', 'No titles or amounts leave your device – “A bill is due today”.');
    $('ntHelp').textContent = I18N.k('ui.nt-help-planned-7-days', 'Reminders are planned 7 days ahead each time you open the dashboard. Haven’t opened it for a week? Then they pause until you do.');
    var sum = $('sumNotify'); if (sum) sum.textContent = p.on ? I18N.k('ui.notify-on-here', 'On for this device') : I18N.k('ui.off', 'Off');
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
  /* for the notification panel: what you've been told lately and what's coming (2026-11-20) */
  function recent(backH, aheadH) { var n = Date.now(); return plan({ from: n - (backH || 72) * 36e5, to: n + (aheadH || 24) * 36e5, full: true }); }
  window.Notify = { plan: plan, sync: sync, prefs: prefs, recent: recent };
})();
