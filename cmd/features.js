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
    { id: 'habits', group: 'Everyday', name: 'Habits', icon: 'activity', c: '#d55181', desc: 'Weekly habits with streaks, on the Health page', def: true },
    { id: 'flex', group: 'Work', name: 'Flex time', icon: 'stopwatch', c: '#e8743b', desc: 'Clock in and out, flex balance and holiday days (fleksitid)' },
    { id: 'meetings', group: 'Work', name: 'Meeting notes', icon: 'people', c: '#3987e5', desc: 'Notes with action points you can send to your to-do list' },
    { id: 'learning', group: 'Work', name: 'Courses & certificates', icon: 'mortarboard', c: '#8a6fdf', desc: 'What you learn, and certificates that need renewing' },
    { id: 'training', group: 'Health', name: 'Training log', icon: 'heart-pulse', c: '#d55181', desc: 'Workouts with time, distance and how it felt' },
    { id: 'health', group: 'Health', name: 'Check-ups & medicine', icon: 'clipboard2-pulse', c: '#e66767', desc: 'Doctor and dentist, vaccines and prescriptions – with reminders' },
    { id: 'ahealth', group: 'Health', name: 'Apple Health', icon: 'apple', c: '#e66767', desc: 'Steps, sleep, heart rate and exercise from your iPhone' },
    { id: 'journal', group: 'Health', name: 'Journal', icon: 'journal-bookmark', c: '#c9a227', desc: 'One line a day and your mood' },
    { id: 'bucket', group: 'Travel', name: 'Places to visit', icon: 'pin-map', c: '#0891b2', desc: 'Your bucket list, on the map – turn one into a trip' },
    { id: 'subs', group: 'Finance', name: 'Subscriptions', icon: 'arrow-repeat', c: '#11a597', desc: 'What you pay every month and when it renews' },
    { id: 'warranty', group: 'Finance', name: 'Warranties & receipts', icon: 'receipt-cutoff', c: '#c98500', desc: 'Know when the warranty (reklamasjon) runs out' },
    { id: 'voice', group: 'Everyday', name: 'Talk to add', icon: 'mic', c: '#8a6fdf', desc: 'Say it and it’s added – “149 Rema”, “gym tomorrow 7”' },
    { id: 'findtime', group: 'Everyday', name: 'Find time', icon: 'calendar2-range', c: '#3987e5', desc: 'Finds a free slot this week for anything, and books it' },
    { id: 'shutdown', group: 'Work', name: 'Shutdown ritual', icon: 'moon-stars', c: '#6b4bc4', desc: 'End the workday in one go: clock out, move what’s left, pick tomorrow’s top 3' },
    { id: 'prep', group: 'Work', name: 'Meeting prep', icon: 'clipboard-check', c: '#3987e5', desc: 'Before a meeting: notes and open action points from last time' },
    { id: 'fdv', group: 'Work', name: 'FDV inspection notes', icon: 'building-check', c: '#0891b2', desc: 'Findings with TG per building part – and a tidy summary to send' },
    { id: 'holiday', group: 'Work', name: 'Holiday planner', icon: 'sun', c: '#e8743b', desc: 'Holiday days left, and where to put them for the longest breaks' },
    { id: 'gym', group: 'Health', name: 'Gym log', icon: 'person-arms-up', c: '#d55181', desc: 'Sets, reps and kg per exercise, progress, and next session’s weight' },
    { id: 'rest', group: 'Health', name: 'Rest-day advisor', icon: 'battery-half', c: '#22b35e', desc: 'Tells you when to rest – from sleep, heart rate and your training' },
    { id: 'hreport', group: 'Health', name: 'Weekly health report', icon: 'clipboard2-heart', c: '#d55181', desc: 'Every Sunday: sleep, steps, training and mood compared with last week', def: true },
    { id: 'tripbudget', group: 'Travel', name: 'Trip budget mode', icon: 'cash-coin', c: '#0891b2', desc: 'While you’re away: what you can spend today' },
    { id: 'smartpack', group: 'Travel', name: 'Smart packing', icon: 'bag-check', c: '#0891b2', desc: 'A packing list from the trip’s length and the weather there' },
    { id: 'power', group: 'Finance', name: 'Strømpris', icon: 'lightning-charge', c: '#c98500', desc: 'Electricity price in Oslo (NO1) hour by hour – and the cheapest hours' },
    { id: 'recur', group: 'Finance', name: 'Recurring payments', icon: 'arrow-repeat', c: '#11a597', desc: 'Charges that come back every month – add them to the budget in one tap', def: true },
    { id: 'shared', group: 'Finance', name: 'Shared expenses', icon: 'people', c: '#22b35e', desc: 'Split a payment with someone, see who owes what and settle up' },
    { id: 'jars', group: 'Finance', name: 'Savings jars', icon: 'piggy-bank', c: '#11a597', desc: 'Your savings goals as jars that fill up, with weeks left' },
    { id: 'ptime', group: 'Work', name: 'Time per client', icon: 'hourglass-split', c: '#e8743b', desc: 'A timer per client or project, hours per week and a list to invoice from' },
    { id: 'house', group: 'Home life', name: 'House', icon: 'house-gear', c: '#22b35e', desc: 'A page for upkeep that comes round again, bin days, meter readings and home info' },
    { id: 'people', group: 'Home life', name: 'People', icon: 'people', c: '#d55181', desc: 'A page for birthdays, keeping in touch and gift ideas' },
    { id: 'food', group: 'Home life', name: 'Food', icon: 'basket', c: '#c98500', desc: 'A page for the week’s dinners, the shopping list and your recipes' }
  ];
  var WORK = ['flex', 'meetings', 'learning', 'fdv', 'holiday', 'ptime'];
  var HEALTH = ['habits', 'training', 'health', 'journal', 'ahealth', 'gym', 'rest'];       // the Health page shows if any is on
  var REMIND_COLOR = '#c9a227';

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));      // lock.js puts it in the synced vault
  }
  function byId(id) { return LIST.filter(function (x) { return x.id === id; })[0]; }

  /* Simple mode (Settings → Features): the extras below are hidden – your own switches are kept and come back when Simple is off */
  var ADV = ['voice', 'findtime', 'shutdown', 'prep', 'holiday', 'rest', 'hreport', 'tripbudget', 'smartpack', 'power', 'jars', 'recur', 'shared', 'warranty'];
  function simple() { return !!((readJSON('dash.settings') || {}).simple); }
  function on(id) {
    if (simple() && ADV.indexOf(id) > -1) return false;
    if (id === 'work') return WORK.some(on);
    if (id === 'healthpage') return HEALTH.some(on);
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
  function setSimple(v) {
    var s = readJSON('dash.settings') || {}; s.simple = !!v; writeJSON('dash.settings', s);
    apply(); window.dispatchEvent(new Event('features:change')); window.dispatchEvent(new Event('cal:change'));
  }
  function apply() {
    var r = document.documentElement;
    LIST.forEach(function (x) { r.classList.toggle('feat-off-' + x.id, !on(x.id)); });
    r.classList.toggle('simple', simple());
    r.classList.toggle('feat-off-work', !on('work'));
    r.classList.toggle('feat-off-healthpage', !on('healthpage'));
  }
  apply();
  window.addEventListener('dash:settings', apply);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); apply(); window.dispatchEvent(new Event('features:change')); };

  /* settings arrive from the vault after unlocking (and from other devices when syncing) */
  if (window.Vault) window.Vault.onUnlock(function () { apply(); window.dispatchEvent(new Event('features:change')); window.dispatchEvent(new Event('tools:change')); });

  /* ---------- tool data ---------- */
  /* one bad item (null, or an old-format entry) must never break a page: lists come back without holes */
  function tools() {
    var t = readJSON('dash.tools');
    if (!t || typeof t !== 'object' || Array.isArray(t)) return {};
    Object.keys(t).forEach(function (k) { if (Array.isArray(t[k]) && t[k].some(function (x) { return x == null; })) t[k] = t[k].filter(function (x) { return x != null; }); });
    return t;
  }
  function saveTools(t) {
    writeJSON('dash.tools', t);
    window.dispatchEvent(new Event('tools:change'));
    window.dispatchEvent(new Event('cal:change'));
  }
  function list(key) { var t = tools(); return Array.isArray(t[key]) ? t[key].filter(function (x) { return x && typeof x === 'object'; }) : []; }

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

  /* ---------- Norwegian public holidays (helligdager) ---------- */
  function easter(y) {          /* Gregorian Easter Sunday (Meeus/Jones/Butcher) */
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31);
    return new Date(y, mo - 1, ((h + l - 7 * m + 114) % 31) + 1);
  }
  var holCache = {};
  function holidays(y) {
    if (holCache[y]) return holCache[y];
    var E = easter(y), rel = function (n) { var d = new Date(E); d.setDate(d.getDate() + n); return dkey(d); };
    var l = [[y + '-01-01', 'New Year’s Day', 'Første nyttårsdag'], [rel(-3), 'Maundy Thursday', 'Skjærtorsdag'], [rel(-2), 'Good Friday', 'Langfredag'],
      [rel(0), 'Easter Sunday', 'Første påskedag'], [rel(1), 'Easter Monday', 'Andre påskedag'], [y + '-05-01', 'Labour Day', 'Arbeidernes dag'],
      [y + '-05-17', 'Constitution Day', '17. mai'], [rel(39), 'Ascension Day', 'Kristi himmelfartsdag'], [rel(49), 'Whit Sunday', 'Første pinsedag'],
      [rel(50), 'Whit Monday', 'Andre pinsedag'], [y + '-12-25', 'Christmas Day', 'Første juledag'], [y + '-12-26', 'Boxing Day', 'Andre juledag']];
    return (holCache[y] = l.map(function (x) { return { date: x[0], name: x[1], no: x[2] }; }));
  }
  function holiday(k) {
    return holidays(+String(k).slice(0, 4)).filter(function (h) { return h.date === k; })[0] || null;
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
    /* workouts and courses show in the calendar, in the Training and Study categories */
    var SPORT = { strength: 'Strength', run: 'Running', walk: 'Walking', bike: 'Cycling', swim: 'Swimming', ball: 'Ball sports', yoga: 'Yoga / mobility', other: 'Workout' };
    if (on('training')) list('training').forEach(function (w) {
      if (!isKey(w.date)) return;
      out.push({ id: 'tool:wo:' + w.id, title: (SPORT[w.kind] || 'Workout') + (w.min ? ' · ' + w.min + ' min' : '') + (w.km ? ' · ' + String(w.km).replace('.', ',') + ' km' : ''),
        allDay: true, start: fromKey(w.date), days: 1, cat: 'training', readOnly: true, tool: 'Training log', link: '/cmd/habits/#training',
        location: '', notes: w.notes || '', exDays: {} });
    });
    if (on('learning')) list('learning').forEach(function (c) {
      if (!isKey(c.date)) return;
      out.push({ id: 'tool:co:' + c.id, title: (c.title || 'Course') + (c.status === 'done' ? ' ✓' : ''), allDay: true, start: fromKey(c.date), days: 1,
        cat: 'study', readOnly: true, tool: 'Courses & certificates', link: '/cmd/work/#learning', location: c.provider || '', notes: c.notes || '', exDays: {} });
    });
    /* to-dos with a day (not done yet) */
    (readJSON('dash.todos') || []).forEach(function (t) {
      if (!t || t.done || !isKey(t.due)) return;
      out.push({ id: 'todo:' + t.id, title: '☐ ' + (t.text || 'Task'), allDay: true, start: fromKey(t.due), days: 1, color: '#22b35e',
        readOnly: true, reminder: true, link: '/cmd/#c=todo', location: '', notes: '', exDays: {} });
    });
    /* your birthday, from the profile */
    var me = readJSON('dash.profile') || {};
    if (isKey(me.birthday)) out.push({ id: 'rem:bday', title: 'Your birthday', allDay: true, start: fromKey(me.birthday), days: 1, color: '#d55181',
      readOnly: true, reminder: true, link: '/cmd/?settings=profile', location: '', notes: '', exDays: {}, rule: { freq: 'YEARLY', interval: 1 } });
    if (on('health')) list('health').forEach(function (h) {
      var what = h.title || 'Health';
      if (isKey(h.date) && h.kind === 'checkup' && h.date >= addMonths(dkey(new Date()), -1)) {
        var start = fromKey(h.date), timed = /^\d{2}:\d{2}$/.test(h.time || '');
        if (timed) { var t = h.time.split(':'); start.setHours(+t[0], +t[1]); }
        out.push({ id: 'rem:hc:' + h.id, title: what + (h.where ? ' · ' + h.where : ''), allDay: !timed, start: start, days: 1, dur: 3600e3,
          color: REMIND_COLOR, readOnly: true, reminder: true, link: '/cmd/habits/#health', location: h.where || '', notes: h.notes || '', exDays: {} });
      }
      if (isKey(h.next)) ev('hn:' + h.id, ({ checkup: 'Book check-up: ', vaccine: 'Vaccine due: ', medicine: 'Renew prescription: ' }[h.kind] || 'Due: ') + what,
        h.next, h.where ? 'At ' + h.where : '', '/cmd/habits/#health');
    });
    if (on('warranty')) list('warranty').forEach(function (w) {
      var end = warrantyEnd(w);
      if (!end) return;
      ev('war:' + w.id, 'Warranty ends: ' + (w.item || 'item'), end, w.store ? 'Bought at ' + w.store + (w.receipt ? '. Receipt: ' + w.receipt : '') : '', '/cmd/finance/#warranty');
    });
    /* Home life: birthdays, bin days and upkeep (their own lines in At a glance come from home-life.js) */
    var HL = window.HomeLife;
    if (HL && on('people') && HL.cfg('peoplecfg').calendar) list('people').forEach(function (p) {
      var b = HL.bday(p); if (!b) return;
      out.push({ id: 'rem:pb:' + p.id, title: '🎈 ' + (p.name || 'Birthday') + (b.y ? ' (' + (fromKey(b.next).getFullYear() - b.y) + ')' : ''), allDay: true,
        start: new Date(b.y && b.y > 1900 ? b.y : new Date().getFullYear() - 1, b.m - 1, b.d), days: 1, color: '#d55181', readOnly: true, reminder: true, noBrief: true,
        link: '/cmd/people/', location: '', notes: p.gifts ? 'Gift ideas: ' + p.gifts : '', exDays: {}, rule: { freq: 'YEARLY', interval: 1 } });
    });
    if (HL && on('food') && HL.cfg('foodcfg').calendar) {
      var ml = HL.meals(); Object.keys(ml).forEach(function (k) {
        if (!isKey(k) || k < addMonths(dkey(new Date()), -1)) return;
        out.push({ id: 'rem:ml:' + k, title: '🍽 ' + ml[k], allDay: true, start: fromKey(k), days: 1, color: '#c98500', readOnly: true, reminder: true, noBrief: true, link: '/cmd/food/', location: '', notes: '', exDays: {} });
      });
    }
    if (HL && on('house') && HL.cfg('housecfg').calendar) {
      list('hbins').forEach(function (b) {
        if (!isKey(b.first)) return;
        out.push({ id: 'rem:bin:' + b.id, title: 'Bin day: ' + (b.title || 'bin'), allDay: true, start: fromKey(b.first), days: 1, color: '#7a8794', readOnly: true, reminder: true, noBrief: true,
          link: '/cmd/house/', location: '', notes: '', exDays: {}, rule: { freq: 'WEEKLY', interval: +b.every || 1 } });
      });
      /* upkeep: one entry per day – several jobs due the same day become "🔧 Upkeep · 4 jobs" instead of a long column */
      var hmDay = {};
      list('hmaint').forEach(function (m) { var k = HL.nextDue(m); if (!k || k < dkey(new Date())) return; (hmDay[k] = hmDay[k] || []).push(m); });
      Object.keys(hmDay).forEach(function (k) {
        var ms = hmDay[k], one = ms.length === 1;
        out.push({ id: 'rem:hm:' + (one ? ms[0].id : 'day:' + k), title: one ? '🔧 ' + (ms[0].title || 'Upkeep') : '🔧 Upkeep · ' + ms.length + ' jobs', allDay: true, start: fromKey(k), days: 1, color: REMIND_COLOR, readOnly: true, reminder: true, noBrief: true,
          link: '/cmd/house/#hmaint', location: '', notes: one ? (ms[0].notes || '') : ms.map(function (m) { return '• ' + (m.title || 'Upkeep'); }).join('\n'), exDays: {} });
      });
    }
    /* when to leave for events with a place (worked out by flow.js) */
    var lv = {}; try { lv = JSON.parse(localStorage.getItem('dash.leaveBlocks')) || {}; } catch (e) {}
    Object.keys(lv).forEach(function (k) {
      var x = lv[k], st = new Date(x.leave); if (!(st > new Date(Date.now() - 6 * 3600e3))) return;
      out.push({ id: 'rem:lv:' + k, title: 'Leave for ' + (x.title || 'your event'), allDay: false, start: st, days: 1, dur: x.mins * 60e3, color: '#7a8794',
        readOnly: true, reminder: true, noBrief: true, leave: true, link: '/cmd/travel/', location: (x.from === 'work' ? 'From work' : 'From home') + (x.lines && x.lines.length ? ' · ' + x.lines.join(', ') : '') + ' · ' + x.mins + ' min',
        notes: 'Public transport to ' + (x.loc || '') + ', planned with Entur', exDays: {} });
    });
    if (on('subs')) list('subs').forEach(function (s) {
      if (!isKey(s.renews) || s.paused) return;
      out.push({ id: 'rem:sub:' + s.id, title: 'Renews: ' + (s.name || 'subscription') + (s.amount ? ' · ' + Math.round(+s.amount) + ' kr' : ''),
        allDay: true, start: fromKey(s.renews), days: 1, color: REMIND_COLOR, readOnly: true, reminder: true, link: '/cmd/finance/#subs',
        location: '', notes: s.notes || '', exDays: {},
        rule: { freq: 'MONTHLY', interval: PERIOD_MONTHS[s.period] || 1, clamp: true } });
    });
    /* more reminders from other parts (name days and anniversaries in People, …) */
    (window.EventsExtra || []).forEach(function (f) { try { out = out.concat(f() || []); } catch (e) {} });
    return out;
  }

  window.Features = {
    LIST: LIST, WORK: WORK, HEALTH: HEALTH, REMIND_COLOR: REMIND_COLOR, holidays: holidays, holiday: holiday,
    on: on, set: set, apply: apply, byId: byId, ADV: ADV, simple: simple, setSimple: setSimple,
    tools: tools, saveTools: saveTools, list: list,
    events: events, nextRenewal: nextRenewal, warrantyEnd: warrantyEnd,
    dkey: dkey, fromKey: fromKey, addMonths: addMonths
  };
})();
