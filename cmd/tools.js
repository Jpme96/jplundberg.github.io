/* The optional tools (Settings → Features). Each one mounts into a [data-tool="…"]
   container on the page where it belongs:
   Work page:      flex time, meeting notes, courses & certificates
   Habits page:    training log, journal
   Travel page:    places to visit
   Finance page:   subscriptions, warranties & receipts
   Dashboard:      a small "Work today" card for flex time */
(function () {
  "use strict";
  var F = window.Features, K = window.Kit;
  if (!F || !K) return;
  var esc = K.esc, today = K.today, fmt = K.fmt, kr = K.kr;
  function $t(name) { return document.querySelector('[data-tool="' + name + '"]'); }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
  function addDays(k, n) { var d = F.fromKey(k); d.setDate(d.getDate() + n); return F.dkey(d); }
  function tile(label, value, sub) { return '<div class="kit-tile"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function hm(min) {
    var neg = min < 0; min = Math.abs(Math.round(min));
    var h = Math.floor(min / 60), m = min % 60;
    return (neg ? '−' : '') + (h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min');
  }
  /* short form for the number tiles: 15 h 26 → "15h 26m" */
  function hms(min) {
    var neg = min < 0; min = Math.abs(Math.round(min));
    var h = Math.floor(min / 60), m = min % 60;
    return (neg ? '−' : '') + (h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm');
  }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function nowHM() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  /* ================= WORK: flex time ================= */
  var FLEX_TYPES = { work: 'Work', vacation: 'Holiday (ferie)', sick: 'Sick', flexoff: 'Flex day off (avspasering)', holiday: 'Public holiday', course: 'Course / travel' };
  function flexCfg() { var c = F.tools().flexcfg || {}; return { norm: +c.norm || 7.5, vacation: +c.vacation || 25 }; }
  function worked(e, isToday) {
    if (e.type !== 'work' && e.type !== 'course') return 0;
    var a = toMin(e.in), b = toMin(e.out);
    if (a == null) return 0;
    if (b == null) { if (!isToday) return 0; b = toMin(nowHM()); }
    var w = b - a; if (w < 0) w += 1440;
    return Math.max(0, w - (+e.brk || 0));
  }
  function flexDays() {
    var by = {}, td = today();
    F.list('flex').forEach(function (e) { (by[e.date] = by[e.date] || []).push(e); });
    var norm = flexCfg().norm * 60;
    return Object.keys(by).sort().map(function (k) {
      var es = by[k], open = es.some(function (e) { return (e.type === 'work' || e.type === 'course') && e.in && !e.out; });
      var w = es.reduce(function (a, e) { return a + worked(e, k === td); }, 0);
      var free = es.some(function (e) { return e.type === 'vacation' || e.type === 'sick' || e.type === 'holiday'; });
      var hol = F.holiday(k) && F.fromKey(k).getDay() % 6 !== 0;   // public holiday on a weekday: all work is extra
      var delta = free ? 0 : hol ? w : w - norm;
      return { date: k, entries: es, worked: w, delta: delta, open: open, free: free };
    });
  }
  function flexStats() {
    var days = flexDays(), td = today(), y = td.slice(0, 4), mon = F.dkey(monday(new Date()));
    var balance = days.filter(function (d) { return d.date < td || (d.date === td && !d.open); }).reduce(function (a, d) { return a + d.delta; }, 0);
    var t = days.filter(function (d) { return d.date === td; })[0];
    var week = days.filter(function (d) { return d.date >= mon && d.date <= td; });
    var weekWorked = week.reduce(function (a, d) { return a + d.worked; }, 0);
    var wd = Math.min(5, ((new Date().getDay() + 6) % 7) + 1), off = {};
    week.forEach(function (d) { if (d.free) off[d.date] = 1; });
    for (var i = 0; i < wd; i++) { var hk = addDays(mon, i); if (F.holiday(hk)) off[hk] = 1; }
    var weekFree = Object.keys(off).filter(function (k) { var g = F.fromKey(k).getDay(); return g > 0 && g < 6; }).length;
    var weekTarget = Math.max(0, wd - weekFree) * flexCfg().norm * 60;
    var vac = F.list('flex').filter(function (e) { return e.type === 'vacation' && String(e.date).slice(0, 4) === y; }).length;
    var openE = F.list('flex').filter(function (e) { return e.date === td && (e.type === 'work' || e.type === 'course') && e.in && !e.out; })[0];
    return { balance: balance, today: t ? t.worked : 0, open: openE, week: weekWorked, weekTarget: weekTarget, vac: vac };
  }
  function clock() {
    var t = F.tools(), l = Array.isArray(t.flex) ? t.flex : [], td = today();
    var open = l.filter(function (e) { return e.date === td && e.in && !e.out && e.type === 'work'; })[0];
    if (open) open.out = nowHM();
    else l.push({ id: K.uid(), date: td, type: 'work', in: nowHM(), out: '', brk: l.some(function (e) { return e.date === td && e.type === 'work'; }) ? 0 : (+(t.flexcfg || {}).brk || 0) });
    t.flex = l;
    F.saveTools(t);
  }
  function clockBlock(s) {
    return '<div class="flex-clock">' +
      '<div class="fc-now"><span class="fc-dot' + (s.open ? ' on' : '') + '"></span><span>' + (s.open ? 'Clocked in at <b>' + esc(s.open.in) + '</b>' : 'Not clocked in') + '</span></div>' +
      '<b class="fc-time" data-flex-live>' + hm(s.today) + '</b><small>today</small>' +
      '<button type="button" class="pill-btn fc-btn' + (s.open ? ' out' : '') + '" data-flex-clock><i class="bi bi-' + (s.open ? 'stop-fill' : 'play-fill') + '"></i> ' + (s.open ? 'Clock out' : 'Clock in') + '</button></div>';
  }
  var flex = K.collection({
    mount: $t('flex'), feature: 'flex', key: 'flex', title: 'Flex time', icon: 'stopwatch', addLabel: 'Add day',
    addTitle: 'Add a day', editTitle: 'Edit day', limit: 6,
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'type', label: 'Type', type: 'select', options: Object.keys(FLEX_TYPES).map(function (k) { return [k, FLEX_TYPES[k]]; }), def: 'work' },
      { k: 'in', label: 'In', type: 'time' }, { k: 'out', label: 'Out', type: 'time' },
      { k: 'brk', label: 'Unpaid break', type: 'number', suffix: 'min', def: 0, help: 'Only if lunch is not part of your paid time.' },
      { k: 'note', label: 'Note', type: 'textarea', rows: 2 }
    ],
    sort: function (a, b) { return (b.date + (b.in || '')) > (a.date + (a.in || '')) ? 1 : -1; },
    summary: function () {
      var s = flexStats(), c = flexCfg();
      return clockBlock(s) + '<div class="kit-tiles">' +
        tile('Flex balance', '<span class="' + (s.balance < 0 ? 'neg' : 'pos') + '">' + (s.balance > 0 ? '+' : '') + hms(s.balance) + '</span>', 'logged days') +
        tile('This week', hms(s.week), 'of ' + hms(s.weekTarget)) +
        tile('Holiday ' + today().slice(0, 4), s.vac + ' <small>/ ' + c.vacation + '</small>', 'days used') + '</div>';
    },
    row: function (e) {
      var isT = e.date === today(), w = worked(e, isT), lbl = FLEX_TYPES[e.type] || 'Work';
      return { icon: e.type === 'vacation' ? 'sun' : e.type === 'sick' ? 'thermometer-half' : e.type === 'flexoff' ? 'cup-hot' : e.type === 'holiday' ? 'flag' : 'briefcase',
        color: e.type === 'work' || e.type === 'course' ? '#e8743b' : '#7a8794',
        title: fmt(e.date, { weekday: 'short', day: 'numeric', month: 'short' }) + (e.type !== 'work' ? ' · ' + lbl : ''),
        sub: (e.in ? esc(e.in) + '–' + (e.out ? esc(e.out) : 'now') : '') + (e.brk ? ' · ' + e.brk + ' min break' : '') + (e.note ? ' · ' + esc(e.note) : ''),
        right: e.type === 'work' || e.type === 'course' ? hm(w) : '' };
    },
    empty: 'Tap “Clock in” when you start, “Clock out” when you leave. Holidays and flex days off go in with “Add day”.',
    afterRender: function (el) {
      var c = flexCfg();
      el.querySelector('.kit-card').insertAdjacentHTML('beforeend', '<p class="kit-foot">Normal day <input class="kit-mini" data-flexcfg="norm" value="' + c.norm + '" inputmode="decimal" aria-label="Normal day in hours"> h · Holiday <input class="kit-mini" data-flexcfg="vacation" value="' + c.vacation + '" inputmode="numeric" aria-label="Holiday days per year"> days a year</p>');
    },
    onClick: function (e) { if (e.target.closest('[data-flex-clock]')) clock(); }
  });
  document.addEventListener('change', function (e) {
    var k = e.target.dataset && e.target.dataset.flexcfg;
    if (!k) return;
    var v = K.num(e.target.value);
    if (v == null || v <= 0) return;
    var t = F.tools(); t.flexcfg = t.flexcfg || {}; t.flexcfg[k] = v; F.saveTools(t);
  });
  /* keep the running time fresh */
  setInterval(function () {
    if (!F.on('flex')) return;
    var s = flexStats();
    if (!s.open) return;
    document.querySelectorAll('[data-flex-live]').forEach(function (el) { el.textContent = hm(s.today); });
  }, 30000);

  /* Dashboard card: Work today */
  var home = document.getElementById('flexCard');
  function renderHome() {
    if (!home) return;
    var on = F.on('flex');
    home.hidden = !on;
    if (!on) return;
    var s = flexStats();
    home.innerHTML = '<div class="card-head"><h2><i class="bi bi-stopwatch"></i> Work today</h2><a class="text-btn" href="work/">Details</a></div>' +
      clockBlock(s) + '<p class="fc-bal">Flex balance <b class="' + (s.balance < 0 ? 'neg' : 'pos') + '">' + (s.balance > 0 ? '+' : '') + hm(s.balance) + '</b> · this week ' + hm(s.week) + '</p>';
  }
  if (home) {
    home.addEventListener('click', function (e) { if (e.target.closest('[data-flex-clock]')) clock(); });
    window.addEventListener('tools:change', renderHome);
    window.addEventListener('features:change', renderHome);
    if (window.Vault) window.Vault.onUnlock(renderHome);
  }

  /* ================= WORK: meeting notes ================= */
  K.collection({
    mount: $t('meetings'), feature: 'meetings', key: 'meetings', title: 'Meeting notes', icon: 'people', addLabel: 'New',
    addTitle: 'New meeting note', editTitle: 'Edit meeting note',
    fields: [
      { k: 'title', type: 'title', label: 'Title', ph: 'Meeting, e.g. Status FDV handover', req: true },
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'who', label: 'With', ph: 'Who was there' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 6 },
      { k: 'actions', label: 'Action points', type: 'textarea', rows: 3, help: 'One per line. Tick them off here or send them to your to-do list.' }
    ],
    beforeSave: function (it) { it.done = it.done || {}; },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    row: function (m) {
      var acts = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); }), done = acts.filter(function (_, i) { return (m.done || {})[i]; }).length;
      return { icon: 'people', color: '#3987e5', title: m.title || 'Meeting', sub: fmt(m.date) + (m.who ? ' · ' + esc(m.who) : '') + (acts.length ? ' · ' + done + '/' + acts.length + ' actions' : ''),
        cls: acts.length && done < acts.length ? 'has-open' : '' };
    },
    detail: function (m) {
      var acts = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); });
      return (m.notes ? '<p class="kit-notes">' + esc(m.notes) + '</p>' : '') +
        (acts.length ? '<ul class="kit-checks">' + acts.map(function (a, i) {
          var d = (m.done || {})[i];
          return '<li class="' + (d ? 'done' : '') + '"><label><input type="checkbox" data-mact="' + esc(m.id) + ':' + i + '"' + (d ? ' checked' : '') + '><span>' + esc(a) + '</span></label>' +
            '<button type="button" class="text-btn" data-mtodo="' + esc(m.id) + ':' + i + '"><i class="bi bi-box-arrow-in-right"></i> To-do</button></li>';
        }).join('') + '</ul>' : '');
    },
    empty: 'Write down what was decided and who does what. Action points can go straight to your to-do list.',
    onClick: function (e, render) {
      var b = e.target.closest('[data-mtodo]');
      if (!b) return;
      var p = b.dataset.mtodo.split(':'), m = F.list('meetings').filter(function (x) { return x.id === p[0]; })[0];
      if (!m) return;
      var text = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); })[+p[1]];
      var todos = readJSON('dash.todos') || [];
      todos.push({ id: K.uid(), text: text.trim() + (m.title ? ' (' + m.title + ')' : ''), done: false });
      writeJSON('dash.todos', todos);
      b.innerHTML = '<i class="bi bi-check2"></i> Added';
      b.disabled = true;
    }
  });
  document.addEventListener('change', function (e) {
    var a = e.target.dataset && e.target.dataset.mact;
    if (!a) return;
    var p = a.split(':'), t = F.tools();
    (t.meetings || []).forEach(function (m) { if (m.id === p[0]) { m.done = m.done || {}; if (e.target.checked) m.done[p[1]] = true; else delete m.done[p[1]]; } });
    F.saveTools(t);
  });

  /* ================= WORK: courses & certificates ================= */
  var KINDS = [['course', 'Course'], ['certificate', 'Certificate'], ['book', 'Book'], ['standard', 'Standard / regulation'], ['other', 'Other']];
  var KIND_ICON = { course: 'mortarboard', certificate: 'award', book: 'book', standard: 'file-earmark-text', other: 'lightbulb' };
  var STATUS = [['planned', 'Planned'], ['progress', 'In progress'], ['done', 'Done']];
  function expiryBadge(k) {
    if (!k) return '';
    var days = Math.round((F.fromKey(k) - F.fromKey(today())) / 864e5);
    if (days < 0) return '<span class="kit-badge bad">Expired</span>';
    if (days < 183) return '<span class="kit-badge warn">Expires ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
    return '<span class="kit-badge">Until ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
  }
  K.collection({
    mount: $t('learning'), feature: 'learning', key: 'learning', title: 'Courses & certificates', icon: 'mortarboard',
    addTitle: 'Add course or certificate',
    fields: [
      { k: 'title', type: 'title', label: 'Title', ph: 'e.g. Varme arbeider, NS 3456, Plania advanced', req: true },
      { k: 'kind', label: 'Type', type: 'select', options: KINDS, def: 'course' },
      { k: 'provider', label: 'From', ph: 'Provider or author' },
      { k: 'status', label: 'Status', type: 'select', options: STATUS, def: 'planned' },
      { k: 'date', label: 'Date', type: 'date', help: 'When you took it or plan to.' },
      { k: 'expires', label: 'Expires', type: 'date', help: 'For certificates that must be renewed – you get a reminder in your calendar 2 months before.' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
    ],
    sort: function (a, b) { var o = { progress: 0, planned: 1, done: 2 }; return (o[a.status] - o[b.status]) || ((b.date || '') > (a.date || '') ? 1 : -1); },
    summary: function (items) {
      var y = today().slice(0, 4);
      var done = items.filter(function (c) { return c.status === 'done' && String(c.date || '').slice(0, 4) === y; }).length;
      var prog = items.filter(function (c) { return c.status === 'progress'; }).length;
      var soon = items.filter(function (c) { return c.expires && c.expires < F.addMonths(today(), 6); }).length;
      return items.length ? '<div class="kit-tiles">' + tile('Done in ' + y, done) + tile('In progress', prog) + tile('Expiring soon', '<span class="' + (soon ? 'neg' : '') + '">' + soon + '</span>', 'within 6 months') + '</div>' : '';
    },
    row: function (c) {
      return { icon: KIND_ICON[c.kind] || 'lightbulb', color: '#8a6fdf', title: c.title, cls: c.status === 'done' ? 'is-done' : '',
        sub: [c.provider ? esc(c.provider) : '', (STATUS.filter(function (s) { return s[0] === c.status; })[0] || ['', ''])[1], c.date ? fmt(c.date, { month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · '),
        right: expiryBadge(c.expires) };
    },
    empty: 'Courses you want to take, certificates that need renewing (like varme arbeider or first aid), and standards you’re reading up on.'
  });

  /* ================= HABITS: training log ================= */
  var SPORTS = [['strength', 'Strength', 'trophy'], ['run', 'Running', 'person-walking'], ['walk', 'Walking', 'person-walking'], ['bike', 'Cycling', 'bicycle'],
    ['swim', 'Swimming', 'water'], ['ball', 'Ball sports', 'dribbble'], ['yoga', 'Yoga / mobility', 'person-arms-up'], ['other', 'Other', 'heart-pulse']];
  var EFFORT = [['1', 'Easy'], ['2', 'Light'], ['3', 'Moderate'], ['4', 'Hard'], ['5', 'All out']];
  function habitOptions() {
    var hb = readJSON('dash.habits') || { list: [] };
    return [['', 'Don’t tick a habit']].concat((hb.list || []).map(function (h) { return [h.id, 'Tick “' + h.name + '”']; }));
  }
  function defaultHabit() {
    var hb = readJSON('dash.habits') || { list: [] };
    var h = (hb.list || []).filter(function (x) { return /train|trening|gym|workout|løp|run|exercise/i.test(x.name); })[0];
    return h ? h.id : '';
  }
  K.collection({
    mount: $t('training'), feature: 'training', key: 'training', title: 'Training log', icon: 'heart-pulse', addLabel: 'Log workout',
    addTitle: 'Log a workout', editTitle: 'Edit workout',
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'kind', label: 'Type', type: 'select', options: SPORTS.map(function (s) { return [s[0], s[1]]; }), def: 'strength' },
      { k: 'min', label: 'Time', type: 'number', suffix: 'min', req: true, def: 60 },
      { k: 'km', label: 'Distance', type: 'number', suffix: 'km' },
      { k: 'effort', label: 'How hard', type: 'select', options: EFFORT, def: '3' },
      { k: 'habit', label: 'Habit', type: 'select', options: habitOptions, def: defaultHabit },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, help: 'Exercises, weights, how it felt.' }
    ],
    afterSave: function (w) {
      if (!w.habit) return;
      var hb = readJSON('dash.habits') || { list: [], log: {} };
      hb.log = hb.log || {};
      var l = hb.log[w.date] = hb.log[w.date] || [];
      if (l.indexOf(w.habit) < 0) { l.push(w.habit); writeJSON('dash.habits', hb); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
    },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    summary: function (items) {
      var mon = F.dkey(monday(new Date())), m = today().slice(0, 7);
      var wk = items.filter(function (w) { return w.date >= mon; }), mo = items.filter(function (w) { return String(w.date).slice(0, 7) === m; });
      var sum = function (l, k) { return l.reduce(function (a, w) { return a + (+w[k] || 0); }, 0); };
      return '<div class="kit-tiles">' + tile('This week', wk.length + ' <small>sessions</small>', hms(sum(wk, 'min'))) +
        tile('This month', mo.length + ' <small>sessions</small>', hms(sum(mo, 'min'))) +
        tile('Distance this month', (Math.round(sum(mo, 'km') * 10) / 10).toString().replace('.', ',') + ' <small>km</small>') + '</div>';
    },
    row: function (w) {
      var s = SPORTS.filter(function (x) { return x[0] === w.kind; })[0] || SPORTS[7];
      return { icon: s[2], color: '#d55181', title: s[1], sub: fmt(w.date, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + hm(+w.min || 0) + (w.km ? ' · ' + String(w.km).replace('.', ',') + ' km' : '') + (w.notes ? ' · ' + esc(String(w.notes).slice(0, 60)) : ''),
        right: '<span class="kit-dots">' + [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= +w.effort ? 'on' : '') + '"></i>'; }).join('') + '</span>' };
    },
    empty: 'Log a workout and it also ticks your training habit for that day.'
  });

  /* ================= HEALTH: check-ups, vaccines, medicine ================= */
  var HKINDS = [['checkup', 'Appointment / check-up'], ['vaccine', 'Vaccine'], ['medicine', 'Medicine / prescription']];
  var HICON = { checkup: 'clipboard2-pulse', vaccine: 'shield-plus', medicine: 'capsule' };
  var HNEXT = { checkup: 'Next check-up', vaccine: 'Booster due', medicine: 'Renew by' };
  function dueBadge(k, word) {
    if (!k) return '';
    var days = Math.round((F.fromKey(k) - F.fromKey(today())) / 864e5);
    if (days < 0) return '<span class="kit-badge bad">' + word + ' overdue</span>';
    if (days <= 60) return '<span class="kit-badge warn">' + word + ' ' + fmt(k, { day: 'numeric', month: 'short' }) + '</span>';
    return '<span class="kit-badge">' + word + ' ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
  }
  K.collection({
    mount: $t('health'), feature: 'health', key: 'health', title: 'Check-ups & medicine', icon: 'clipboard2-pulse',
    addTitle: 'Add to health', editTitle: 'Edit',
    fields: [
      { k: 'title', type: 'title', label: 'What', ph: 'e.g. Dentist, Tetanus booster, Allergy pills', req: true },
      { k: 'kind', label: 'Type', type: 'select', options: HKINDS, def: 'checkup' },
      { k: 'date', label: 'Date', type: 'date', def: today, help: 'The appointment, when you took the vaccine, or when it was prescribed.' },
      { k: 'time', label: 'Time', type: 'time', help: 'For appointments – it goes in your calendar.' },
      { k: 'where', label: 'Where / who', ph: 'Clinic, doctor, pharmacy' },
      { k: 'next', label: 'Next / renew by', type: 'date', help: 'Next check-up, when a booster is due, or when the prescription runs out. You get a reminder in your calendar.' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, help: 'Dose, what was said, questions for next time …' }
    ],
    sort: function (a, b) {
      var ka = a.kind === 'checkup' && a.date >= today() ? a.date : (a.next || '9999'), kb = b.kind === 'checkup' && b.date >= today() ? b.date : (b.next || '9999');
      return ka > kb ? 1 : ka < kb ? -1 : 0;
    },
    summary: function (items) {
      if (!items.length) return '';
      var td = today();
      var up = items.filter(function (h) { return h.kind === 'checkup' && h.date >= td; }).sort(function (a, b) { return a.date > b.date ? 1 : -1; })[0];
      var due = items.filter(function (h) { return h.next && h.next <= F.addMonths(td, 2); }).length;
      var vac = items.filter(function (h) { return h.kind === 'vaccine'; }).length;
      return '<div class="kit-tiles">' + tile('Next appointment', up ? fmt(up.date, { weekday: 'short', day: 'numeric', month: 'short' }) : '–', up ? esc(up.title) + (up.time ? ' · ' + esc(up.time) : '') : 'nothing booked') +
        tile('Due soon', '<span class="' + (due ? 'neg' : '') + '">' + due + '</span>', 'within 2 months') + tile('Vaccines', vac, 'on record') + '</div>';
    },
    row: function (h) {
      var past = h.kind === 'checkup' && h.date && h.date < today();
      return { icon: HICON[h.kind] || 'clipboard2-pulse', color: '#e66767', title: h.title,
        sub: [{ checkup: 'Check-up', vaccine: 'Vaccine', medicine: 'Medicine' }[h.kind] || '', h.date ? fmt(h.date) + (h.time && !past ? ' ' + esc(h.time) : '') : '', h.where ? esc(h.where) : ''].filter(Boolean).join(' · '),
        right: dueBadge(h.next, h.kind === 'medicine' ? 'Renew' : h.kind === 'vaccine' ? 'Booster' : 'Next') };
    },
    empty: 'Doctor and dentist appointments, vaccines (useful before trips) and prescriptions. You get reminders in your calendar before things are due.'
  });

  /* ================= HABITS: journal ================= */
  var MOODS = [['1', 'Bad', 'emoji-frown', '#e66767'], ['2', 'Meh', 'emoji-neutral', '#e8743b'], ['3', 'OK', 'emoji-smile', '#c9a227'], ['4', 'Good', 'emoji-laughing', '#22b35e'], ['5', 'Great', 'emoji-heart-eyes', '#14b8a6']];
  function mood(v) { return MOODS.filter(function (m) { return m[0] === String(v); })[0] || MOODS[2]; }
  K.collection({
    mount: $t('journal'), feature: 'journal', key: 'journal', title: 'Journal', icon: 'journal-bookmark', addLabel: 'Today',
    addTitle: 'Journal', editTitle: 'Journal', limit: 7,
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'mood', label: 'Mood', type: 'select', options: MOODS.map(function (m) { return [m[0], m[1]]; }), def: '4' },
      { k: 'line', type: 'title', label: 'Today in one line', ph: 'Today in one sentence', req: true, max: 200 },
      { k: 'notes', label: 'More (optional)', type: 'textarea', rows: 4 }
    ],
    beforeSave: function (it) {    /* one entry per day */
      var t = F.tools();
      t.journal = (t.journal || []).filter(function (x) { return x.date !== it.date || x.id === it.id; });
      F.saveTools(t);
    },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    summary: function (items) {
      var by = {}; items.forEach(function (j) { by[j.date] = j; });
      var cells = '', t = today();
      for (var i = 27; i >= 0; i--) {
        var k = addDays(t, -i), j = by[k];
        cells += '<i title="' + fmt(k, { weekday: 'short', day: 'numeric', month: 'short' }) + (j ? ': ' + mood(j.mood)[1] : '') + '" style="' + (j ? 'background:' + mood(j.mood)[3] : '') + '"></i>';
      }
      var streak = 0; for (var d = 0; d < 400; d++) { if (by[addDays(t, -d)]) streak++; else if (d > 0) break; }
      var last7 = items.filter(function (j) { return j.date > addDays(t, -7); });
      var avg = last7.length ? last7.reduce(function (a, j) { return a + (+j.mood || 0); }, 0) / last7.length : 0;
      return '<div class="kit-mood">' + cells + '</div><p class="kit-moodlbl">Last 4 weeks' + (streak ? ' · ' + streak + ' day' + (streak > 1 ? 's' : '') + ' in a row' : '') + (avg ? ' · this week: ' + mood(Math.round(avg))[1].toLowerCase() : '') + '</p>';
    },
    row: function (j) { var m = mood(j.mood); return { icon: m[2], color: m[3], title: j.line, sub: fmt(j.date, { weekday: 'long', day: 'numeric', month: 'short' }) + (j.notes ? ' · ' + esc(String(j.notes).slice(0, 70)) : '') }; },
    empty: 'One line a day is enough. Over time you’ll see how your weeks really were.'
  });

  /* ================= TRAVEL: places to visit ================= */
  K.collection({
    mount: $t('bucket'), feature: 'bucket', key: 'bucket', title: 'Places to visit', icon: 'pin-map',
    addTitle: 'A place you want to visit',
    fields: [
      { k: 'place', type: 'title', label: 'Place', ph: 'City or place, e.g. Lisbon', req: true },
      { k: 'notes', label: 'Why / what to do', type: 'textarea', rows: 3 },
      { k: 'visited', label: 'Been there', type: 'check' }
    ],
    afterSave: function (it) {      /* find it on the map */
      if (!window.World || (it.geo && it.geo.q === it.place)) return;
      window.World.search(it.place).then(function (l) {
        if (!l || !l[0]) return;
        var t = F.tools();
        (t.bucket || []).forEach(function (x) { if (x.id === it.id) x.geo = Object.assign({ q: it.place }, l[0]); });
        F.saveTools(t);
      }).catch(function () {});
    },
    sort: function (a, b) { return (a.visited ? 1 : 0) - (b.visited ? 1 : 0) || (a.place > b.place ? 1 : -1); },
    summary: function (items) {
      var v = items.filter(function (x) { return x.visited; }).length;
      return items.length ? '<p class="kit-moodlbl">' + items.length + ' place' + (items.length > 1 ? 's' : '') + ' · ' + v + ' visited · they show on the map under History</p>' : '';
    },
    row: function (b) { return { icon: b.visited ? 'check-circle-fill' : 'pin-map', color: b.visited ? '#22b35e' : '#0891b2', title: b.place, cls: b.visited ? 'is-done' : '', sub: [b.geo ? esc(b.geo.country) : '', b.notes ? esc(String(b.notes).slice(0, 70)) : ''].filter(Boolean).join(' · ') }; },
    detail: function (b) {
      return (b.notes ? '<p class="kit-notes">' + esc(b.notes) + '</p>' : '') +
        (b.visited ? '' : '<button type="button" class="text-btn" data-plantrip="' + esc(b.id) + '"><i class="bi bi-suitcase-lg"></i> Plan a trip</button>');
    },
    empty: 'Cities and places you want to see. Turn one into a trip when you’re ready.',
    onClick: function (e) {
      var b = e.target.closest('[data-plantrip]');
      if (!b || !window.Flow) return;
      var it = F.list('bucket').filter(function (x) { return x.id === b.dataset.plantrip; })[0];
      if (!it) return;
      var tr = window.Flow.travel(), start = F.addMonths(today(), 1);
      var trip = { id: K.uid(), name: it.place, dest: it.geo ? it.geo.name : it.place, start: start, end: addDays(start, 3), items: [], pack: [], notes: it.notes || '' };
      if (it.geo) trip.place = { name: it.geo.name, region: it.geo.region, country: it.geo.country, cc: it.geo.cc, lat: it.geo.lat, lon: it.geo.lon, tz: it.geo.tz };
      tr.trips.push(trip);
      window.Flow.saveTravel(tr);
      location.href = '/cmd/travel/#trip=' + trip.id;
    }
  });

  /* ================= FINANCE: subscriptions ================= */
  var PERIODS = [['monthly', 'Every month'], ['quarterly', 'Every 3 months'], ['yearly', 'Every year']];
  var PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  var SUB_CATS = [['streaming', 'Streaming & music'], ['software', 'Apps & software'], ['phone', 'Phone & internet'], ['training', 'Training'], ['news', 'News & magazines'], ['insurance', 'Insurance'], ['other', 'Other']];
  K.collection({
    mount: $t('subs'), feature: 'subs', key: 'subs', title: 'Subscriptions', icon: 'arrow-repeat',
    addTitle: 'Add subscription', editTitle: 'Edit subscription',
    fields: [
      { k: 'name', type: 'title', label: 'Name', ph: 'e.g. Spotify, iCloud+, SATS', req: true },
      { k: 'amount', label: 'Price', type: 'number', suffix: 'kr', req: true },
      { k: 'period', label: 'Paid', type: 'select', options: PERIODS, def: 'monthly' },
      { k: 'renews', label: 'Next payment', type: 'date', req: true, def: today, help: 'It shows in your calendar every time it renews.' },
      { k: 'cat', label: 'Category', type: 'select', options: SUB_CATS, def: 'streaming' },
      { k: 'paused', label: 'Paused / cancelled', type: 'check' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'e.g. how to cancel, or the account it’s on.' }
    ],
    sort: function (a, b) { return (a.paused ? 1 : 0) - (b.paused ? 1 : 0) || (F.nextRenewal(a) > F.nextRenewal(b) ? 1 : -1); },
    summary: function (items) {
      var act = items.filter(function (s) { return !s.paused; });
      var m = act.reduce(function (a, s) { return a + (+s.amount || 0) * (PER_MONTH[s.period] || 1); }, 0);
      var next = act.slice().sort(function (a, b) { return F.nextRenewal(a) > F.nextRenewal(b) ? 1 : -1; })[0];
      return items.length ? '<div class="kit-tiles">' + tile('Per month', kr(m)) + tile('Per year', kr(m * 12)) +
        (next ? tile('Next', esc(next.name), fmt(F.nextRenewal(next), { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</div>' : '';
    },
    row: function (s) {
      var per = { monthly: '/ month', quarterly: '/ 3 months', yearly: '/ year' }[s.period] || '';
      return { icon: 'arrow-repeat', color: '#11a597', title: s.name, cls: s.paused ? 'is-done' : '',
        sub: kr(+s.amount) + ' ' + per + (s.paused ? ' · paused' : ' · next ' + fmt(F.nextRenewal(s), { day: 'numeric', month: 'short' })),
        right: s.period !== 'monthly' && !s.paused ? '<small class="muted">' + kr((+s.amount || 0) * (PER_MONTH[s.period] || 1)) + '/mo</small>' : '' };
    },
    empty: 'Streaming, apps, phone, gym … see what it all costs per month and year, and get a reminder before each payment.'
  });

  /* ================= FINANCE: warranties & receipts ================= */
  K.collection({
    mount: $t('warranty'), feature: 'warranty', key: 'warranty', title: 'Warranties & receipts', icon: 'receipt-cutoff',
    addTitle: 'Add a purchase', editTitle: 'Edit purchase',
    fields: [
      { k: 'item', type: 'title', label: 'What', ph: 'e.g. MacBook Air, washing machine', req: true },
      { k: 'store', label: 'Store', ph: 'Where you bought it' },
      { k: 'bought', label: 'Bought', type: 'date', req: true, def: today },
      { k: 'price', label: 'Price', type: 'number', suffix: 'kr' },
      { k: 'years', label: 'Complaint period', type: 'select', def: '2', options: [['2', '2 years (most things)'], ['5', '5 years (meant to last: phone, PC, white goods…)'], ['1', '1 year'], ['3', '3 years']],
        help: 'In Norway you can complain (reklamere) for 2 years, or 5 years for things meant to last much longer.' },
      { k: 'receipt', label: 'Receipt', ph: 'Where it is, e.g. email, Vipps, folder' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'Serial number, model, insurance …' }
    ],
    sort: function (a, b) { return F.warrantyEnd(a) > F.warrantyEnd(b) ? 1 : -1; },
    summary: function (items) {
      var td = today(), act = items.filter(function (w) { return F.warrantyEnd(w) >= td; });
      var soon = act.filter(function (w) { return F.warrantyEnd(w) < F.addMonths(td, 3); }).length;
      var val = act.reduce(function (a, w) { return a + (+w.price || 0); }, 0);
      return items.length ? '<div class="kit-tiles">' + tile('Covered', act.length, 'things still under warranty') + tile('Ending soon', '<span class="' + (soon ? 'neg' : '') + '">' + soon + '</span>', 'within 3 months') + tile('Value covered', kr(val)) + '</div>' : '';
    },
    row: function (w) {
      var end = F.warrantyEnd(w), over = end < today();
      return { icon: 'receipt-cutoff', color: '#c98500', title: w.item, cls: over ? 'is-done' : '',
        sub: [w.store ? esc(w.store) : '', fmt(w.bought), w.price ? kr(+w.price) : '', w.receipt ? 'receipt: ' + esc(w.receipt) : ''].filter(Boolean).join(' · '),
        right: over ? '<span class="kit-badge">Ended</span>' : expiryBadge(end).replace('Until', 'Until').replace('Expires', 'Ends') };
    },
    empty: 'Keep track of what you bought, where the receipt is, and when you can no longer complain. You get a reminder in your calendar.'
  });

  /* Work page with nothing switched on */
  var wkEmpty = document.getElementById('wkEmpty');
  function workEmpty() { if (wkEmpty) wkEmpty.hidden = F.on('work'); }
  if (wkEmpty) { window.addEventListener('features:change', workEmpty); workEmpty(); }
})();
