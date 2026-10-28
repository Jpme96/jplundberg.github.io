/* Features: which parts of the dashboard are switched on (Settings → Features).
   Switched-off parts disappear from the menu, the home page and the calendar,
   but their data stays in the vault, so switching back on brings everything back.
   Also holds the data of the smaller tools ("dash.tools", synced and encrypted)
   and the reminders they put in the calendar. */
(function () {
  "use strict";

  var LIST = [
    { id: 'calendar', group: 'Everyday', name: 'Calendar', icon: 'calendar3', c: '#3987e5', desc: 'Events, repeats and your phone calendar', def: true },
    { id: 'travel', group: 'Everyday', name: 'Travel', icon: 'signpost-split', c: '#0891b2', desc: 'Departures, journey planner, trips and documents', def: true },
    { id: 'finance', group: 'Everyday', name: 'Finances', icon: 'wallet2', c: '#11a597', desc: 'Budget, spending, savings and net worth', def: true },
    { id: 'habits', group: 'Everyday', name: 'Habits', icon: 'activity', c: '#d55181', desc: 'Weekly habits with streaks', def: true },
    { id: 'flex', group: 'Work', name: 'Flex time', icon: 'stopwatch', c: '#e8743b', desc: 'Clock in and out, flex balance and holiday days (fleksitid)' },
    { id: 'meetings', group: 'Work', name: 'Meeting notes', icon: 'people', c: '#3987e5', desc: 'Notes with action points you can send to your to-do list' },
    { id: 'learning', group: 'Work', name: 'Courses & certificates', icon: 'mortarboard', c: '#8a6fdf', desc: 'What you learn, and certificates that need renewing' },
    { id: 'training', group: 'Habits', name: 'Training log', icon: 'heart-pulse', c: '#d55181', desc: 'Workouts with time, distance and how it felt' },
    { id: 'journal', group: 'Habits', name: 'Journal', icon: 'journal-bookmark', c: '#c9a227', desc: 'One line a day and your mood' },
    { id: 'bucket', group: 'Travel', name: 'Places to visit', icon: 'pin-map', c: '#0891b2', desc: 'Your bucket list, on the map – turn one into a trip' },
    { id: 'subs', group: 'Finance', name: 'Subscriptions', icon: 'arrow-repeat', c: '#11a597', desc: 'What you pay every month and when it renews' },
    { id: 'warranty', group: 'Finance', name: 'Warranties & receipts', icon: 'receipt-cutoff', c: '#c98500', desc: 'Know when the warranty (reklamasjon) runs out' }
  ];
  var WORK = ['flex', 'meetings', 'learning'];
  var REMIND_COLOR = '#c9a227';

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));      // lock.js puts it in the synced vault
  }
  function byId(id) { return LIST.filter(function (x) { return x.id === id; })[0]; }

  function on(id) {
    if (id === 'work') return WORK.some(on);
    var f = (readJSON('dash.settings') || {}).features || {};
    var d = byId(id);
    return Object.prototype.hasOwnProperty.call(f, id) ? !!f[id] : !!(d && d.def);
  }
  function set(id, val) {
    var s = readJSON('dash.settings') || {};
    s.features = s.features || {};
    s.features[id] = !!val;
    writeJSON('dash.settings', s);
    apply();
    window.dispatchEvent(new Event('features:change'));
    window.dispatchEvent(new Event('cal:change'));
  }
  function apply() {
    var r = document.documentElement;
    LIST.forEach(function (x) { r.classList.toggle('feat-off-' + x.id, !on(x.id)); });
    r.classList.toggle('feat-off-work', !on('work'));
  }
  apply();
  window.addEventListener('dash:settings', apply);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); apply(); window.dispatchEvent(new Event('features:change')); };

  /* settings arrive from the vault after unlocking (and from other devices when syncing) */
  if (window.Vault) window.Vault.onUnlock(function () { apply(); window.dispatchEvent(new Event('features:change')); window.dispatchEvent(new Event('tools:change')); });

  /* ---------- tool data ---------- */
  function tools() {
    var t = readJSON('dash.tools');
    return t && typeof t === 'object' ? t : {};
  }
  function saveTools(t) {
    writeJSON('dash.tools', t);
    window.dispatchEvent(new Event('tools:change'));
    window.dispatchEvent(new Event('cal:change'));
  }
  function list(key) { var t = tools(); return Array.isArray(t[key]) ? t[key] : []; }

  /* ---------- small date helpers ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function addMonths(k, n) {
    var d = fromKey(k), day = d.getDate(), x = new Date(d.getFullYear(), d.getMonth() + n, 1);
    x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
    return dkey(x);
  }
  var isKey = function (k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); };

  /* Next renewal of a subscription on or after a day */
  var PERIOD_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 };
  function nextRenewal(s, from) {
    if (!isKey(s.renews)) return '';
    var k = s.renews, m = PERIOD_MONTHS[s.period] || 1, guard = 0;
    from = from || dkey(new Date());
    while (k < from && guard++ < 600) k = addMonths(s.renews, m * guard);
    return k;
  }
  function warrantyEnd(w) {
    if (!isKey(w.bought)) return '';
    return addMonths(w.bought, Math.round((+w.years || 2) * 12));
  }

  /* ---------- reminders for the calendar ---------- */
  function events() {
    var out = [];
    function ev(id, title, k, notes, link) {
      out.push({ id: 'rem:' + id, title: title, allDay: true, start: fromKey(k), days: 1, color: REMIND_COLOR,
        readOnly: true, reminder: true, link: link, location: '', notes: notes || '', exDays: {} });
    }
    if (on('learning')) list('learning').forEach(function (c) {
      if (!isKey(c.expires)) return;
      ev('learn:' + c.id, (c.title || 'Certificate') + ' expires', c.expires, c.provider ? 'From ' + c.provider : '', '/cmd/work/#learning');
      var soon = addMonths(c.expires, -2);
      ev('learn2:' + c.id, 'Renew: ' + (c.title || 'certificate'), soon, 'Expires ' + c.expires, '/cmd/work/#learning');
    });
    if (on('warranty')) list('warranty').forEach(function (w) {
      var end = warrantyEnd(w);
      if (!end) return;
      ev('war:' + w.id, 'Warranty ends: ' + (w.item || 'item'), end, w.store ? 'Bought at ' + w.store + (w.receipt ? '. Receipt: ' + w.receipt : '') : '', '/cmd/finance/#warranty');
    });
    if (on('subs')) list('subs').forEach(function (s) {
      if (!isKey(s.renews) || s.paused) return;
      out.push({ id: 'rem:sub:' + s.id, title: 'Renews: ' + (s.name || 'subscription') + (s.amount ? ' · ' + Math.round(+s.amount) + ' kr' : ''),
        allDay: true, start: fromKey(s.renews), days: 1, color: REMIND_COLOR, readOnly: true, reminder: true, link: '/cmd/finance/#subs',
        location: '', notes: s.notes || '', exDays: {},
        rule: { freq: 'MONTHLY', interval: PERIOD_MONTHS[s.period] || 1, clamp: true } });
    });
    return out;
  }

  window.Features = {
    LIST: LIST, WORK: WORK, REMIND_COLOR: REMIND_COLOR,
    on: on, set: set, apply: apply, byId: byId,
    tools: tools, saveTools: saveTools, list: list,
    events: events, nextRenewal: nextRenewal, warrantyEnd: warrantyEnd,
    dkey: dkey, fromKey: fromKey, addMonths: addMonths
  };
})();
