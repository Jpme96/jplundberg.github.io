/* Home life (Settings → Features), each a page of its own, off until you switch it on:
     House    upkeep that comes round again, bin days, meter readings, home info  (/cmd/house/)
     People   birthdays, keeping in touch, gift ideas                              (/cmd/people/)
     Food     the week's dinners, the shopping list, recipes                       (/cmd/food/)
   and on the Work page:
     Time per client – a timer per client or project, hours per week, a CSV to invoice from.
   Data lives in dash.tools (synced, encrypted); lines for At a glance go through window.BriefExtra,
   reminders into the calendar through Features.events(). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, K = window.Kit || null;      // the cards need Kit; the calendar and At a glance only need the data
  function col(cfg) { return K && cfg.mount ? K.collection(cfg) : null; }
  function on(k) { return Fe.on(k); }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  var dkey = Fe.dkey, fromKey = Fe.fromKey, addMonths = Fe.addMonths;
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function today() { return dkey(new Date()); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function daysTo(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function inDays(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n < 0 ? -n + ' days ago' : 'in ' + n + ' days'; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fmt(k, o) { return fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }); }
  function ago(k) {
    var n = -daysTo(k);
    if (n <= 0) return 'today'; if (n === 1) return 'yesterday'; if (n < 14) return n + ' days ago';
    if (n < 60) return Math.round(n / 7) + ' weeks ago'; if (n < 700) return Math.round(n / 30.4) + ' months ago';
    return Math.round(n / 365) + ' years ago';
  }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function tile(label, value, sub) { return '<div class="kit-tile"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function chip(text, c) { return '<span class="hl-chip" style="--c:' + c + '">' + text + '</span>'; }
  function saveList(key, fn) { var t = Fe.tools(); t[key] = Array.isArray(t[key]) ? t[key] : []; fn(t[key], t); Fe.saveTools(t); }
  function byId(key, id) { return Fe.list(key).filter(function (x) { return x.id === id; })[0]; }
  function snapshot(key) { return JSON.parse(JSON.stringify(Fe.tools()[key] || null)); }
  function restore(key, v) { var t = Fe.tools(); t[key] = v; Fe.saveTools(t); }
  var RED = '#e66767', AMBER = '#c98500', GREEN = '#22b35e', BLUE = '#3987e5';

  /* the page itself is switched off: say so instead of an empty page */
  var PAGE = (location.pathname.match(/\/cmd\/(house|people|food)\/$/) || [])[1];
  if (PAGE) {
    var pgEmpty = function () { var e = document.querySelector('[data-pgempty]'); if (e) e.hidden = on(PAGE); };
    pgEmpty(); window.addEventListener('features:change', pgEmpty); window.Vault.onUnlock(pgEmpty);
  }

  window.BriefExtra = window.BriefExtra || [];
  window.CommandExtra = window.CommandExtra || [];

  /* ============================== HOUSE ============================== */
  /* ---- upkeep that comes round again ---- */
  var EVERY = [[1, 'Every month'], [2, 'Every 2 months'], [3, 'Every 3 months'], [6, 'Every 6 months'], [12, 'Every year'], [24, 'Every 2 years'], [60, 'Every 5 years']];
  function everyName(m) { var x = EVERY.filter(function (e) { return e[0] === +m; })[0]; return x ? x[1] : 'Every ' + m + ' months'; }
  function nextDue(it) { return isKey(it.last) ? addMonths(it.last, +it.every || 12) : today(); }
  var USUAL = [
    ['Test the smoke alarms', 3, 'Press the test button on each one.'],
    ['New batteries in the smoke alarms', 12, '1 December is smoke alarm day (røykvarslerens dag).'],
    ['Check the fire extinguisher', 12, 'Turn it upside down a few times; the needle should be in the green.'],
    ['Clean the heat pump filters', 3, 'Rinse in lukewarm water, let them dry.'],
    ['Clean the shower and sink drains (sluk)', 3, ''],
    ['Change the ventilation filter', 6, ''],
    ['Check under and around the water heater', 12, 'Look for damp or rust; check the leak guard if you have one.']
  ];
  var HM = { key: 'hmaint', addTitle: 'New upkeep task', editTitle: 'Edit upkeep task', fields: [
    { k: 'title', type: 'title', label: 'Task', ph: 'e.g. Clean the heat pump filters', req: true },
    { k: 'every', label: 'How often', type: 'select', options: EVERY, def: 12 },
    { k: 'last', label: 'Last done', type: 'date', def: today, help: 'Leave empty if it’s never been done – then it’s due now.' },
    { k: 'notes', label: 'How / notes', type: 'textarea', rows: 2 }] };
  col({
    mount: $t('hmaint'), feature: 'house', key: 'hmaint', icon: 'tools', title: 'Upkeep', addLabel: 'Add', limit: 10,
    addTitle: HM.addTitle, editTitle: HM.editTitle, fields: HM.fields,
    empty: 'Things that need doing every few months – filters, drains, smoke alarms. You get a nudge when they’re due.',
    sort: function (a, b) { return nextDue(a) < nextDue(b) ? -1 : 1; },
    summary: function (l) {
      if (!l.length) return '';
      var over = l.filter(function (x) { return daysTo(nextDue(x)) < 0; }).length, soon = l.filter(function (x) { var n = daysTo(nextDue(x)); return n >= 0 && n <= 30; }).length;
      var nx = l.slice().sort(function (a, b) { return nextDue(a) < nextDue(b) ? -1 : 1; })[0];
      return '<div class="kit-tiles">' + tile('Overdue', '<span class="' + (over ? 'neg' : '') + '">' + over + '</span>') + tile('Next 30 days', soon) +
        tile('Next up', daysTo(nextDue(nx)) < 0 ? '<span class="neg">Overdue</span>' : esc(cap(inDays(daysTo(nextDue(nx))))), esc(nx.title)) + '</div>';
    },
    above: function (l) { return l.length ? '' : '<button type="button" class="pill-btn hl-seed" data-hmseed><i class="bi bi-magic"></i> Add the usual ones</button>'; },
    row: function (it) {
      var n = daysTo(nextDue(it)), c = n < 0 ? RED : n <= 14 ? AMBER : GREEN;
      return { icon: 'tools', color: c, title: it.title, sub: esc(everyName(it.every) + (isKey(it.last) ? ' · last ' + fmt(it.last) : ' · not done yet')),
        right: chip(n < 0 ? 'Overdue' : cap(inDays(n)), c) };
    },
    detail: function (it) {
      return (it.notes ? '<p class="kit-notes">' + esc(it.notes) + '</p>' : '') +
        '<p class="muted hl-small">Next time: ' + esc(fmt(nextDue(it), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })) + '</p>' +
        '<button type="button" class="pill-btn" data-hmdone="' + esc(it.id) + '"><i class="bi bi-check2"></i> Done today</button> ';
    },
    onClick: function (e) {
      var b;
      if (e.target.closest('[data-hmseed]')) {
        saveList('hmaint', function (l) { USUAL.forEach(function (u) { l.push({ id: uid(), title: u[0], every: u[1], last: today(), notes: u[2] }); }); });
        toast('<i class="bi bi-tools"></i> ' + USUAL.length + ' tasks added – set when each was last done');
      }
      if ((b = e.target.closest('[data-hmdone]'))) hmDone(b.dataset.hmdone);
    }
  });
  function hmDone(id) {
    var old = snapshot('hmaint');
    saveList('hmaint', function (l) { l.forEach(function (x) { if (x.id === id) x.last = today(); }); });
    var it = byId('hmaint', id);
    toast('<i class="bi bi-check2"></i> Done – next ' + (it ? fmt(nextDue(it), { day: 'numeric', month: 'short', year: 'numeric' }) : ''), function () { restore('hmaint', old); });
  }
  window.BriefExtra.push(function (add) {
    if (!on('house')) return;
    Fe.list('hmaint').filter(function (x) { return daysTo(nextDue(x)) <= 2; }).sort(function (a, b) { return nextDue(a) < nextDue(b) ? -1 : 1; }).slice(0, 2).forEach(function (x) {
      var n = daysTo(nextDue(x));
      add(n < 0 ? 33 : 46, 'tools', n < 0 ? RED : AMBER, x.title, n < 0 ? 'Overdue since ' + fmt(nextDue(x)) : 'Due ' + inDays(n), '/cmd/house/',
        { act: { id: 'hm:' + x.id + ':' + today(), label: 'Done' }, run: function () { hmDone(x.id); } });
    });
  });

  /* ---- bin days (renovasjon) ---- */
  var BINS = { key: 'hbins', addTitle: 'New bin', editTitle: 'Edit bin', fields: [
    { k: 'title', type: 'title', label: 'Bin', ph: 'Restavfall, Papir, Plast, Glass og metall …', req: true },
    { k: 'first', label: 'A pickup day', type: 'date', req: true, def: today, help: 'Any day it was (or will be) picked up – the rest follow from it.' },
    { k: 'every', label: 'How often', type: 'select', options: [[1, 'Every week'], [2, 'Every 2 weeks'], [3, 'Every 3 weeks'], [4, 'Every 4 weeks'], [8, 'Every 8 weeks']], def: 2 },
    { k: 'night', label: 'Remind me the evening before', type: 'check', def: true }] };
  function nextPickup(b, from) {
    if (!isKey(b.first)) return null;
    from = from || today();
    var step = (+b.every || 1) * 7, n = Math.round((fromKey(from) - fromKey(b.first)) / 864e5);
    var k = n <= 0 ? 0 : Math.ceil(n / step);
    return addDays(b.first, k * step);
  }
  var BIN_C = function (t) { return /papir|paper|papp/i.test(t) ? BLUE : /plast/i.test(t) ? '#8a6fdf' : /glass|metall/i.test(t) ? '#0891b2' : /mat|food|bio/i.test(t) ? GREEN : '#7a8794'; };
  col({
    mount: $t('hbins'), feature: 'house', key: 'hbins', icon: 'trash3', title: 'Bin days', addLabel: 'Add',
    addTitle: BINS.addTitle, editTitle: BINS.editTitle, fields: BINS.fields,
    empty: 'Add each bin once with a day it was picked up – you get a reminder the evening before.',
    sort: function (a, b) { return (nextPickup(a) || '9') < (nextPickup(b) || '9') ? -1 : 1; },
    summary: function (l) {
      var nx = l.map(function (b) { return [nextPickup(b), b]; }).filter(function (x) { return x[0]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
      if (!nx.length) return '';
      var same = nx.filter(function (x) { return x[0] === nx[0][0]; }).map(function (x) { return x[1].title; });
      return '<p class="hl-lead"><i class="bi bi-truck"></i> Next: <b>' + esc(same.join(' + ')) + '</b> ' + esc(inDays(daysTo(nx[0][0]))) + ' · ' + esc(fmt(nx[0][0], { weekday: 'long' })) + '</p>';
    },
    row: function (b) {
      var k = nextPickup(b), n = k ? daysTo(k) : null;
      return { icon: 'trash3', color: BIN_C(b.title), title: b.title, sub: esc((({ 1: 'Every week', 2: 'Every 2 weeks', 3: 'Every 3 weeks', 4: 'Every 4 weeks', 8: 'Every 8 weeks' })[b.every] || '') + (k ? ' · ' + fmt(k, { weekday: 'long' }) : '')),
        right: k ? chip(cap(inDays(n)), n <= 1 ? AMBER : '#7a8794') : '' };
    }
  });
  window.BriefExtra.push(function (add, now) {
    if (!on('house')) return;
    var tk = today(), tm = addDays(tk, 1), h = now.getHours();
    var tonight = Fe.list('hbins').filter(function (b) { return b.night !== false && nextPickup(b, tm) === tm; }).map(function (b) { return b.title; });
    var tod = Fe.list('hbins').filter(function (b) { return nextPickup(b) === tk; }).map(function (b) { return b.title; });
    if (tonight.length && h >= 14) add(17, 'trash3', AMBER, 'Put out ' + tonight.join(' + ') + ' tonight', 'Picked up tomorrow', '/cmd/house/');
    else if (tod.length && h < 10) add(19, 'trash3', AMBER, tod.join(' + ') + ' is picked up today', 'Out by 7 if it isn’t already', '/cmd/house/');
  });

  /* ---- meter readings ---- */
  function meterStats(l) {
    var r = l.filter(function (x) { return isKey(x.date) && typeof x.value === 'number'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var per = function (a, b) { var d = Math.round((fromKey(b.date) - fromKey(a.date)) / 864e5); return d > 0 ? (b.value - a.value) / d : null; };
    var last = r.length > 1 ? per(r[r.length - 2], r[r.length - 1]) : null;
    var yr = r.filter(function (x) { return x.date >= addDays(today(), -400); });
    var avg = yr.length > 1 ? per(yr[0], yr[yr.length - 1]) : null;
    return { r: r, last: last, avg: avg, prev: function (x) { var i = r.map(function (y) { return y.id; }).indexOf(x.id); return i > 0 ? r[i - 1] : null; }, per: per };
  }
  col({
    mount: $t('hmeter'), feature: 'house', key: 'hmeter', icon: 'speedometer2', title: 'Electricity meter', addLabel: 'Reading', limit: 6,
    addTitle: 'New reading', editTitle: 'Edit reading', fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'value', label: 'Meter shows', type: 'number', req: true, suffix: 'kWh' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 }],
    empty: 'Read the meter now and then (or copy the number from the app) – you see how much you use per day and per year.',
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    summary: function (l) {
      var s = meterStats(l); if (s.r.length < 2) return s.r.length ? '<p class="muted hl-small">Add one more reading to see how much you use.</p>' : '';
      return '<div class="kit-tiles">' + tile('Per day, lately', nf1.format(s.last) + ' <small>kWh</small>') + tile('Per day, avg', nf1.format(s.avg) + ' <small>kWh</small>', 'last 12 months') +
        tile('Per year', nf.format(s.avg * 365) + ' <small>kWh</small>', 'at that pace') + '</div>';
    },
    row: function (x) {
      var s = meterStats(Fe.list('hmeter')), p = s.prev(x), d = p ? s.per(p, x) : null;
      return { icon: 'speedometer2', color: AMBER, title: fmt(x.date, { day: 'numeric', month: 'short', year: 'numeric' }),
        sub: p ? esc('+' + nf.format(x.value - p.value) + ' kWh' + (d != null ? ' · ' + nf1.format(d) + ' kWh/day' : '')) : 'First reading', right: esc(nf.format(x.value)) };
    }
  });
  window.BriefExtra.push(function (add) {
    if (!on('house')) return;
    var r = meterStats(Fe.list('hmeter')).r; if (!r.length) return;
    var n = -daysTo(r[r.length - 1].date);
    if (n >= 35 && new Date().getDate() <= 3) add(70, 'speedometer2', AMBER, 'Read the electricity meter', 'Last reading ' + ago(r[r.length - 1].date), '/cmd/house/');
  });
  window.CommandExtra.push(function () { return on('house') ? [{ i: 'speedometer2', t: 'New meter reading', s: 'House', run: function () { if ($t('hmeter')) K.edit({ key: 'hmeter', addTitle: 'New reading', fields: [{ k: 'date', label: 'Date', type: 'date', req: true, def: today }, { k: 'value', label: 'Meter shows', type: 'number', req: true, suffix: 'kWh' }] }, null); else location.href = '/cmd/house/#hmeter'; }, x: 'meter strøm måler kwh avlesning' }] : []; });

  /* ---- home info ---- */
  col({
    mount: $t('hinfo'), feature: 'house', key: 'hinfo', icon: 'info-circle', title: 'Good to know', addLabel: 'Add',
    addTitle: 'New note', editTitle: 'Edit note', fields: [
      { k: 'title', type: 'title', label: 'What', ph: 'Stopcock, fuse box, Wi-Fi, landlord, paint colours …', req: true },
      { k: 'text', label: 'Details', type: 'textarea', rows: 4 }],
    empty: 'Where the stopcock and the fuse box are, the Wi-Fi password, paint colours, the landlord’s number – encrypted like the rest.',
    sort: function (a, b) { return a.title.localeCompare(b.title, 'nb'); },
    row: function (x) { return { icon: /wi-?fi|nett/i.test(x.title) ? 'wifi' : /sikring|fuse|strøm/i.test(x.title) ? 'lightning' : /vann|water|stopp/i.test(x.title) ? 'droplet' : 'info-circle', color: '#22b35e', title: x.title, sub: esc(String(x.text || '').split('\n')[0].slice(0, 80)) }; },
    detail: function (x) { return x.text ? '<p class="kit-notes hl-pre">' + esc(x.text) + '</p><button type="button" class="text-btn" data-hicopy="' + esc(x.id) + '"><i class="bi bi-clipboard"></i> Copy</button> ' : ''; },
    onClick: function (e) {
      var b = e.target.closest('[data-hicopy]'); if (!b) return;
      var x = byId('hinfo', b.dataset.hicopy); if (x && navigator.clipboard) navigator.clipboard.writeText(x.text).then(function () { toast('<i class="bi bi-clipboard-check"></i> Copied'); });
    }
  });

  /* ============================== PEOPLE ============================== */
  var REL = [['family', 'Family'], ['friend', 'Friend'], ['work', 'Work'], ['other', 'Other']];
  var REL_C = { family: '#d55181', friend: BLUE, work: '#e8743b', other: '#7a8794' };
  var KEEP = [[0, 'No reminder'], [14, 'Every 2 weeks'], [30, 'Every month'], [60, 'Every 2 months'], [90, 'Every 3 months'], [180, 'Every 6 months'], [365, 'Once a year']];
  function bday(p) {
    var m = String(p.bday || '').trim().match(/^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?$/) || String(p.bday || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var d, mo, y;
    if (m[0].indexOf('-') === 4) { y = +m[1]; mo = +m[2]; d = +m[3]; } else { d = +m[1]; mo = +m[2]; y = m[3] ? +m[3] : null; if (y && y < 100) y += y > 30 ? 1900 : 2000; }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), nx = new Date(now.getFullYear(), mo - 1, d);
    if (nx < t0) nx.setFullYear(nx.getFullYear() + 1);
    return { d: d, m: mo, y: y, next: dkey(nx), n: Math.round((nx - t0) / 864e5), age: y ? nx.getFullYear() - y : null };
  }
  function overdue(p) { var e = +p.every || 0; if (!e) return null; if (!isKey(p.last)) return 0; var n = -daysTo(p.last) - e; return n >= 0 ? n : null; }
  var PP = { key: 'people', addTitle: 'New person', editTitle: 'Edit person', fields: [
    { k: 'name', type: 'title', label: 'Name', ph: 'Name', req: true },
    { k: 'rel', label: 'Who', type: 'select', options: REL, def: 'friend' },
    { k: 'bday', label: 'Birthday', ph: '24.12 or 24.12.1990', help: 'With the year, you also see how old they turn.' },
    { k: 'every', label: 'Keep in touch', type: 'select', options: KEEP, def: 0 },
    { k: 'last', label: 'Last talked', type: 'date' },
    { k: 'phone', label: 'Phone', type: 'tel', ph: '+47' },
    { k: 'gifts', label: 'Gift ideas', type: 'textarea', rows: 2, help: 'Jot them down when you hear them – one per line.' },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'Partner’s and kids’ names, allergies, what they’re up to.' }] };
  function talked(id) {
    var old = snapshot('people');
    saveList('people', function (l) { l.forEach(function (x) { if (x.id === id) x.last = today(); }); });
    toast('<i class="bi bi-chat-heart"></i> Noted', function () { restore('people', old); });
  }
  col({
    mount: $t('people'), feature: 'people', key: 'people', icon: 'people', title: 'People', addLabel: 'Add', limit: 12,
    addTitle: PP.addTitle, editTitle: PP.editTitle, fields: PP.fields,
    empty: 'Add the people who matter – with a birthday you get a heads-up a week before, with “keep in touch” a nudge when it’s been too long.',
    sort: function (a, b) {
      var oa = overdue(a), ob = overdue(b), ba = bday(a), bb = bday(b);
      var sa = ba && ba.n <= 14 ? ba.n : oa != null ? 20 : 100 + (ba ? ba.n : 400), sb = bb && bb.n <= 14 ? bb.n : ob != null ? 20 : 100 + (bb ? bb.n : 400);
      return sa - sb || String(a.name).localeCompare(b.name, 'nb');
    },
    summary: function (l) {
      if (!l.length) return '';
      var b30 = l.filter(function (p) { var b = bday(p); return b && b.n <= 30; }).length, due = l.filter(function (p) { return overdue(p) != null; }).length;
      return '<div class="kit-tiles">' + tile('Birthdays', b30, 'next 30 days') + tile('Catch up', '<span class="' + (due ? 'neg' : '') + '">' + due + '</span>', 'it’s been a while') + tile('People', l.length) + '</div>';
    },
    row: function (p) {
      var b = bday(p), o = overdue(p), subs = [];
      if (b) subs.push('Birthday ' + fmt(b.next) + (b.age ? ' (' + b.age + ')' : ''));
      if (isKey(p.last)) subs.push('talked ' + ago(p.last));
      var right = b && b.n <= 14 ? chip('<i class="bi bi-balloon"></i> ' + cap(inDays(b.n)), '#d55181') : o != null ? chip('Catch up', AMBER) : '';
      return { icon: 'person', color: REL_C[p.rel] || BLUE, title: p.name, sub: esc(subs.join(' · ')), right: right };
    },
    detail: function (p) {
      var tel = String(p.phone || '').replace(/[^\d+]/g, ''), b = bday(p);
      return (b ? '<p class="hl-small muted"><i class="bi bi-balloon"></i> ' + esc(fmt(b.next, { weekday: 'long', day: 'numeric', month: 'long' })) + (b.age ? ' – turns ' + b.age : '') + ' · ' + esc(inDays(b.n)) + '</p>' : '') +
        (p.gifts ? '<div class="hl-gifts"><b><i class="bi bi-gift"></i> Gift ideas</b><ul>' + String(p.gifts).split('\n').filter(Boolean).map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul></div>' : '') +
        (p.notes ? '<p class="kit-notes hl-pre">' + esc(p.notes) + '</p>' : '') +
        '<div class="hl-acts"><button type="button" class="pill-btn" data-pptalk="' + esc(p.id) + '"><i class="bi bi-chat-heart"></i> Talked today</button>' +
        (tel ? '<a class="text-btn" href="tel:' + esc(tel) + '"><i class="bi bi-telephone"></i> Call</a><a class="text-btn" href="sms:' + esc(tel) + '"><i class="bi bi-chat"></i> Message</a>' : '') + '</div>';
    },
    onClick: function (e) { var b = e.target.closest('[data-pptalk]'); if (b) talked(b.dataset.pptalk); }
  });
  /* the next birthdays, as a calendar strip */
  (function () {
    var el = $t('pdates'); if (!el) return;
    function draw() {
      var ok = on('people'); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; }
      var l = Fe.list('people').map(function (p) { return [bday(p), p]; }).filter(function (x) { return x[0] && x[0].n <= 120; }).sort(function (a, b) { return a[0].n - b[0].n; }).slice(0, 8);
      el.innerHTML = '<section class="card kit-card" id="pdates"><div class="card-head"><h2><i class="bi bi-balloon"></i> Coming up</h2></div>' +
        (l.length ? '<ul class="hl-dates">' + l.map(function (x) {
          var b = x[0], d = fromKey(b.next);
          return '<li' + (b.n <= 7 ? ' class="soon"' : '') + '><span class="hl-day"><b>' + d.getDate() + '</b><small>' + esc(d.toLocaleDateString('en-GB', { month: 'short' })) + '</small></span>' +
            '<span class="hl-dx"><b>' + esc(x[1].name) + '</b><small>' + esc(cap(inDays(b.n)) + (b.age ? ' · turns ' + b.age : '')) + (x[1].gifts ? ' · <i class="bi bi-gift"></i> ' + esc(String(x[1].gifts).split('\n')[0]) : '') + '</small></span></li>';
        }).join('') + '</ul>' : '<p class="empty kit-empty">No birthdays in the next four months.</p>') + '</section>';
    }
    ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, draw); });
    window.Vault.onUnlock(draw);
  })();
  window.BriefExtra.push(function (add) {
    if (!on('people')) return;
    var l = Fe.list('people');
    l.forEach(function (p) {
      var b = bday(p); if (!b || b.n > 7) return;
      var tel = String(p.phone || '').replace(/[^\d+]/g, '');
      if (b.n === 0) add(8, 'balloon', '#d55181', p.name + '’s birthday today', (b.age ? 'Turns ' + b.age : 'Send a greeting') , tel ? 'sms:' + tel : '/cmd/people/', { badge: true });
      else add(b.n <= 2 ? 24 : 40, 'balloon', '#d55181', p.name + '’s birthday ' + inDays(b.n), p.gifts ? 'Gift idea: ' + String(p.gifts).split('\n')[0] : (b.age ? 'Turns ' + b.age + ' · ' : '') + 'no gift ideas yet', '/cmd/people/');
    });
    l.filter(function (p) { return overdue(p) != null; }).sort(function (a, b) { return overdue(b) - overdue(a); }).slice(0, 1).forEach(function (p) {
      add(58, 'chat-heart', AMBER, 'Catch up with ' + p.name, isKey(p.last) ? 'Last talked ' + ago(p.last) : 'Say hi', '/cmd/people/',
        { act: { id: 'pp:' + p.id + ':' + today(), label: 'Talked' }, run: function () { talked(p.id); } });
    });
  });

  /* ============================== FOOD ============================== */
  function meals() { var m = Fe.tools().meals; return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; }
  function setMeal(k, v) { var t = Fe.tools(); t.meals = meals(); if (v) t.meals[k] = v; else delete t.meals[k]; Object.keys(t.meals).forEach(function (x) { if (x < addDays(today(), -60)) delete t.meals[x]; }); Fe.saveTools(t); }
  function recipeFor(name) { var n = String(name || '').trim().toLowerCase(); return n ? Fe.list('recipes').filter(function (r) { return String(r.title).trim().toLowerCase() === n; })[0] : null; }
  function ingredients(r) { return String((r && r.ingr) || '').split('\n').map(function (x) { return x.replace(/^[-•*\s]+/, '').trim(); }).filter(Boolean); }
  function addShop(items, from) {
    var t = Fe.tools(), l = Array.isArray(t.shop) ? t.shop : [], have = {}, n = 0;
    l.forEach(function (x) { if (!x.done) have[x.text.toLowerCase()] = 1; });
    items.forEach(function (s) { s = String(s).trim().slice(0, 120); if (!s || have[s.toLowerCase()]) return; have[s.toLowerCase()] = 1; l.push({ id: uid(), text: s, done: false, from: from || '' }); n++; });
    t.shop = l; Fe.saveTools(t); return n;
  }
  /* ---- the week's dinners ---- */
  var ML = { wk: 0 };
  function monday(off) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7 + off * 7); return dkey(d); }
  function weekNo(k) { var d = fromKey(k); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); var w1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7); }
  (function () {
    var el = $t('meals'); if (!el) return;
    function draw() {
      var ok = on('food'); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; }
      if (el.contains(document.activeElement) && document.activeElement.matches('input')) return;      // don't redraw under your fingers
      var m0 = monday(ML.wk), m = meals(), tk = today(), rs = Fe.list('recipes');
      var days = []; for (var i = 0; i < 7; i++) days.push(addDays(m0, i));
      var planned = days.filter(function (k) { return m[k]; }), withR = planned.filter(function (k) { return recipeFor(m[k]); });
      el.innerHTML = '<section class="card kit-card" id="meals"><div class="card-head"><h2><i class="bi bi-calendar-week"></i> Dinners · week ' + weekNo(m0) + '</h2>' +
        '<div class="head-actions"><button type="button" class="icon-btn" data-mlwk="-1" aria-label="Previous week"><i class="bi bi-chevron-left"></i></button>' +
        (ML.wk ? '<button type="button" class="text-btn" data-mlwk="0">This week</button>' : '') +
        '<button type="button" class="icon-btn" data-mlwk="1" aria-label="Next week"><i class="bi bi-chevron-right"></i></button></div></div>' +
        '<ul class="hl-meals">' + days.map(function (k) {
          var d = fromKey(k), r = recipeFor(m[k]);
          return '<li class="' + (k === tk ? 'today' : '') + (k < tk ? ' past' : '') + '"><label for="ml-' + k + '"><b>' + esc(d.toLocaleDateString('en-GB', { weekday: 'short' })) + '</b><small>' + d.getDate() + '.' + (d.getMonth() + 1) + '</small></label>' +
            '<input id="ml-' + k + '" data-ml="' + k + '" list="hlRecipes" value="' + esc(m[k] || '') + '" placeholder="' + (k === tk ? 'What’s for dinner?' : '–') + '" maxlength="80" autocomplete="off" enterkeyhint="next">' +
            (r ? '<button type="button" class="icon-btn sm" data-mlrec="' + esc(r.id) + '" aria-label="Open the recipe"><i class="bi bi-journal-text"></i></button>' : '<span class="hl-sp"></span>') + '</li>';
        }).join('') + '</ul><datalist id="hlRecipes">' + rs.map(function (r) { return '<option value="' + esc(r.title) + '">'; }).join('') + '</datalist>' +
        '<div class="hl-acts">' + (withR.length ? '<button type="button" class="pill-btn" data-mlshop><i class="bi bi-cart-plus"></i> Ingredients to the shopping list</button>' : '') +
        (rs.length && planned.length < 7 ? '<button type="button" class="text-btn" data-mlfill><i class="bi bi-shuffle"></i> Fill the empty days</button>' : '') +
        (planned.length ? '<span class="muted hl-small">' + planned.length + ' of 7 planned</span>' : '') + '</div></section>';
    }
    el.addEventListener('change', function (e) { var i = e.target.closest('[data-ml]'); if (i) { setMeal(i.dataset.ml, i.value.trim()); } });
    el.addEventListener('keydown', function (e) { var i = e.target.closest('[data-ml]'); if (i && e.key === 'Enter') { e.preventDefault(); var n = i.closest('li').nextElementSibling; if (n) n.querySelector('input').focus(); else i.blur(); } });
    el.addEventListener('focusout', function () { setTimeout(function () { if (!el.contains(document.activeElement)) draw(); }, 50); });
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-mlwk]'))) { ML.wk = +b.dataset.mlwk === 0 ? 0 : ML.wk + (+b.dataset.mlwk); return draw(); }
      if ((b = e.target.closest('[data-mlrec]'))) { RC.open(b.dataset.mlrec); var c = $t('recipes'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (e.target.closest('[data-mlshop]')) {
        var m = meals(), m0 = monday(ML.wk), all = [];
        for (var i = 0; i < 7; i++) { var k = addDays(m0, i); if (k >= today() || ML.wk > 0) all = all.concat(ingredients(recipeFor(m[k]))); }
        var n = addShop(all, 'week');
        toast('<i class="bi bi-cart-check"></i> ' + (n ? n + ' thing' + (n === 1 ? '' : 's') + ' added to the shopping list' : 'It’s all on the list already'));
        return;
      }
      if (e.target.closest('[data-mlfill]')) {
        var t = Fe.tools(); t.meals = meals();
        var used = {}; Object.keys(t.meals).forEach(function (k) { if (k >= addDays(today(), -14)) used[String(t.meals[k]).toLowerCase()] = 1; });
        var pool = Fe.list('recipes').map(function (r) { return r.title; }), fresh = pool.filter(function (x) { return !used[x.toLowerCase()]; });
        var bag = (fresh.length ? fresh : pool).slice().sort(function () { return Math.random() - .5; }), f0 = monday(ML.wk), filled = 0;
        for (var j = 0; j < 7 && bag.length; j++) { var kk = addDays(f0, j); if (kk < today() || t.meals[kk]) continue; t.meals[kk] = bag[filled % bag.length]; filled++; }
        Fe.saveTools(t);
        toast('<i class="bi bi-shuffle"></i> ' + filled + ' dinner' + (filled === 1 ? '' : 's') + ' planned');
      }
    });
    ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, draw); });
    window.Vault.onUnlock(draw);
  })();
  /* ---- shopping list ---- */
  (function () {
    var el = $t('shop'); if (!el) return;
    function list() { var l = Fe.tools().shop; return Array.isArray(l) ? l : []; }
    function save(fn) { var t = Fe.tools(); t.shop = list(); fn(t.shop); Fe.saveTools(t); }
    function draw() {
      var ok = on('food'); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; }
      var l = list(), open = l.filter(function (x) { return !x.done; }), done = l.filter(function (x) { return x.done; });
      var keep = el.querySelector('.hl-shopadd input'), typed = keep ? keep.value : '', focus = keep && document.activeElement === keep;
      el.innerHTML = '<section class="card kit-card" id="shop"><div class="card-head"><h2><i class="bi bi-cart3"></i> Shopping list' + (open.length ? ' <span class="hl-count">' + open.length + '</span>' : '') + '</h2>' +
        '<div class="head-actions">' + (open.length ? '<button type="button" class="text-btn" data-shshare><i class="bi bi-' + (navigator.share ? 'share' : 'clipboard') + '"></i> ' + (navigator.share ? 'Share' : 'Copy') + '</button>' : '') +
        (done.length ? '<button type="button" class="text-btn" data-shclear><i class="bi bi-check2-all"></i> Clear done</button>' : '') + '</div></div>' +
        '<form class="hl-shopadd"><input placeholder="Add – milk, eggs, coffee" maxlength="300" enterkeyhint="done" autocomplete="off" aria-label="Add to the shopping list"><button type="submit" class="icon-btn" aria-label="Add"><i class="bi bi-plus-lg"></i></button></form>' +
        (l.length ? '<ul class="hl-shop">' + open.concat(done).map(function (x) {
          return '<li class="' + (x.done ? 'done' : '') + '"><label><input type="checkbox" data-shx="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '><span>' + esc(x.text) + '</span></label>' +
            '<button type="button" class="icon-btn sm" data-shdel="' + esc(x.id) + '" aria-label="Remove ' + esc(x.text) + '"><i class="bi bi-x"></i></button></li>';
        }).join('') + '</ul>' : '<p class="empty kit-empty">Nothing to buy. Add things here, or send a week of recipes over from the dinners.</p>') + '</section>';
      var inp = el.querySelector('.hl-shopadd input'); inp.value = typed; if (focus) inp.focus();
    }
    el.addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = el.querySelector('.hl-shopadd input'), v = inp.value; inp.value = '';
      addShop(v.split(/,|\n/), ''); inp.focus();
    });
    el.addEventListener('change', function (e) {
      var c = e.target.closest('[data-shx]'); if (!c) return;
      var li = c.closest('li'); li.classList.toggle('done', c.checked);
      setTimeout(function () { save(function (l) { l.forEach(function (x) { if (x.id === c.dataset.shx) x.done = c.checked; }); }); }, c.checked ? 280 : 0);
    });
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-shdel]'))) { var old = snapshot('shop'); save(function (l) { for (var i = l.length - 1; i >= 0; i--) if (l[i].id === b.dataset.shdel) l.splice(i, 1); }); toast('<i class="bi bi-trash3"></i> Removed', function () { restore('shop', old); }); return; }
      if (e.target.closest('[data-shclear]')) { var o2 = snapshot('shop'); save(function (l) { for (var i = l.length - 1; i >= 0; i--) if (l[i].done) l.splice(i, 1); }); toast('<i class="bi bi-check2-all"></i> Cleared', function () { restore('shop', o2); }); return; }
      if (e.target.closest('[data-shshare]')) {
        var txt = list().filter(function (x) { return !x.done; }).map(function (x) { return '• ' + x.text; }).join('\n');
        if (navigator.share) navigator.share({ title: 'Shopping list', text: txt }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('<i class="bi bi-clipboard-check"></i> List copied'); });
      }
    });
    ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, draw); });
    window.Vault.onUnlock(draw);
  })();
  /* ---- recipes ---- */
  var RC = { open: function () {} };
  col({
    mount: $t('recipes'), feature: 'food', key: 'recipes', icon: 'journal-text', title: 'Recipes', addLabel: 'Add', limit: 10,
    addTitle: 'New recipe', editTitle: 'Edit recipe', fields: [
      { k: 'title', type: 'title', label: 'Name', ph: 'e.g. Fish tacos', req: true },
      { k: 'mins', label: 'Time', type: 'number', suffix: 'min' },
      { k: 'ingr', label: 'Ingredients', type: 'textarea', rows: 5, help: 'One per line – they go to the shopping list as they are.' },
      { k: 'steps', label: 'How', type: 'textarea', rows: 4 },
      { k: 'link', label: 'Link', type: 'url', ph: 'https://' }],
    empty: 'Your go-to dinners. Plan them into the week and their ingredients go on the shopping list in one tap.',
    sort: function (a, b) { return String(a.title).localeCompare(b.title, 'nb'); },
    row: function (r) {
      var n = ingredients(r).length;
      return { icon: 'journal-text', color: AMBER, title: r.title, sub: esc([r.mins ? r.mins + ' min' : '', n ? n + ' ingredient' + (n === 1 ? '' : 's') : ''].filter(Boolean).join(' · ')) };
    },
    detail: function (r) {
      var ing = ingredients(r), link = /^https?:\/\//.test(r.link || '') ? r.link : '';
      return (ing.length ? '<ul class="hl-ingr">' + ing.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        (r.steps ? '<p class="kit-notes hl-pre">' + esc(r.steps) + '</p>' : '') +
        '<div class="hl-acts"><button type="button" class="pill-btn" data-rctoday="' + esc(r.id) + '"><i class="bi bi-calendar-check"></i> Dinner today</button>' +
        (ing.length ? '<button type="button" class="text-btn" data-rcshop="' + esc(r.id) + '"><i class="bi bi-cart-plus"></i> To the list</button>' : '') +
        (link ? '<a class="text-btn" href="' + esc(link) + '" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Open</a>' : '') + '</div>';
    },
    onClick: function (e) {
      var b, r;
      if ((b = e.target.closest('[data-rctoday]')) && (r = byId('recipes', b.dataset.rctoday))) { setMeal(today(), r.title); toast('<i class="bi bi-calendar-check"></i> ' + esc(r.title) + ' tonight'); }
      if ((b = e.target.closest('[data-rcshop]')) && (r = byId('recipes', b.dataset.rcshop))) { var n = addShop(ingredients(r), r.title); toast('<i class="bi bi-cart-check"></i> ' + (n ? n + ' added to the shopping list' : 'Already on the list')); }
    }
  });
  RC.open = function (id) { var c = $t('recipes'), b = c && c.querySelector('[data-kit-toggle="' + id + '"]'); if (b && !b.closest('li').classList.contains('open')) b.click(); };
  window.BriefExtra.push(function (add, now) {
    if (!on('food')) return;
    var m = meals()[today()], h = now.getHours(), shop = (Fe.tools().shop || []).filter(function (x) { return !x.done; }).length;
    if (m && h < 20) {
      var r = recipeFor(m);
      add(h >= 14 ? 34 : 64, 'egg-fried', AMBER, 'Dinner: ' + m, r && r.mins ? r.mins + ' min' + (shop ? ' · ' + shop + ' on the shopping list' : '') : shop ? shop + ' on the shopping list' : 'Planned for tonight', '/cmd/food/');
    } else if (!m && h >= 13 && h < 18) add(56, 'egg-fried', '#7a8794', 'What’s for dinner?', 'Nothing planned tonight' + (shop ? ' · ' + shop + ' on the shopping list' : ''), '/cmd/food/');
  });
  window.CommandExtra.push(function () { return on('food') ? [{ i: 'cart3', t: 'Shopping list', s: 'Food', run: function () { location.href = '/cmd/food/#shop'; }, x: 'handleliste shopping list groceries butikk' }] : []; });

  /* ======================= Time per client / project (Work) ======================= */
  var PCOL = ['#e8743b', BLUE, '#22b35e', '#8a6fdf', '#d55181', '#0891b2', '#c98500'];
  var PROJ = { key: 'pproj', addTitle: 'New client or project', editTitle: 'Edit client or project', fields: [
    { k: 'name', type: 'title', label: 'Name', ph: 'e.g. Obos – Storgata 12', req: true },
    { k: 'client', label: 'Client', ph: 'Who pays' },
    { k: 'rate', label: 'Hourly rate', type: 'number', suffix: 'kr', help: 'Optional – shows what the hours are worth.' },
    { k: 'archived', label: 'Finished (hide it)', type: 'check' }],
    beforeSave: function (it, isNew) { if (isNew) it.color = PCOL[Fe.list('pproj').length % PCOL.length]; } };
  var ENTRY = { key: 'ptime', addTitle: 'Add time', editTitle: 'Edit time', fields: [
    { k: 'pid', label: 'Client / project', type: 'select', options: function () { return Fe.list('pproj').filter(function (p) { return !p.archived; }).map(function (p) { return [p.id, p.name]; }); }, req: true },
    { k: 'date', label: 'Date', type: 'date', req: true, def: today },
    { k: 'hours', label: 'Time', type: 'number', suffix: 'hours', req: true, help: 'e.g. 1,5 for an hour and a half' },
    { k: 'note', label: 'What you did', ph: 'Optional' }],
    beforeSave: function (it) { it.mins = Math.round((+it.hours || 0) * 60); delete it.hours; } };
  var PT = { range: 'week' };
  function proj(id) { return byId('pproj', id) || { name: 'Unknown', color: '#7a8794' }; }
  function run() { return Fe.tools().ptrun || null; }
  function hm(m) { m = Math.round(m); return Math.floor(m / 60) + ' h ' + pad(m % 60); }
  function clock(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 3600) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }
  function startT(pid) {
    var t = Fe.tools(), r = t.ptrun;
    if (r) stopT(true);
    t = Fe.tools(); t.ptrun = { pid: pid, start: Date.now() }; Fe.saveTools(t);
    toast('<i class="bi bi-play-fill"></i> Timer started – ' + esc(proj(pid).name));
  }
  function stopT(quiet) {
    var t = Fe.tools(), r = t.ptrun; if (!r) return;
    var mins = Math.round((Date.now() - r.start) / 60000);
    t.ptrun = null;
    if (mins >= 1) { t.ptime = Array.isArray(t.ptime) ? t.ptime : []; t.ptime.push({ id: uid(), pid: r.pid, date: dkey(new Date(r.start)), mins: mins, note: r.note || '' }); }
    Fe.saveTools(t);
    if (!quiet) toast('<i class="bi bi-stop-fill"></i> ' + (mins >= 1 ? hm(mins) + ' on ' + esc(proj(r.pid).name) : 'Under a minute – not saved'));
  }
  function range(kind) {
    var tk = today();
    if (kind === 'week') { var a = monday(0); return [a, addDays(a, 6), 'This week']; }
    if (kind === 'last') { var b = monday(-1); return [b, addDays(b, 6), 'Last week']; }
    var d = new Date(); return [dkey(new Date(d.getFullYear(), d.getMonth(), 1)), tk.slice(0, 8) + pad(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()), 'This month'];
  }
  (function () {
    var el = $t('ptime'); if (!el) return;
    var tick = null;
    function draw() {
      var ok = on('ptime'); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; }
      var ps = Fe.list('pproj'), live = ps.filter(function (p) { return !p.archived; }), r = run(), rg = range(PT.range);
      var es = Fe.list('ptime').filter(function (e) { return e.date >= rg[0] && e.date <= rg[1]; }), tot = 0, val = 0, per = {};
      es.forEach(function (e) { tot += e.mins; per[e.pid] = (per[e.pid] || 0) + e.mins; var p = proj(e.pid); if (p.rate) val += e.mins / 60 * p.rate; });
      var todayM = Fe.list('ptime').filter(function (e) { return e.date === today(); }).reduce(function (s, e) { return s + e.mins; }, 0);
      var max = Math.max.apply(null, [1].concat(Object.keys(per).map(function (k) { return per[k]; })));
      var h = '<section class="card kit-card" id="ptime"><div class="card-head"><h2><i class="bi bi-hourglass-split"></i> Time per client</h2><div class="head-actions">' +
        '<button type="button" class="text-btn" data-ptproj><i class="bi bi-plus-lg"></i> Client</button>' +
        (live.length ? '<button type="button" class="text-btn" data-ptadd><i class="bi bi-clock-history"></i> Add time</button>' : '') + '</div></div>';
      if (!ps.length) h += '<p class="empty kit-empty">Add a client or project, then start a timer when you work on it – or add the hours afterwards. You get hours per week and a list to invoice from.</p>';
      else {
        h += r ? '<div class="pt-run" style="--c:' + proj(r.pid).color + '"><span class="pt-dot"></span><span class="pt-x"><b>' + esc(proj(r.pid).name) + '</b><small>Since ' + pad(new Date(r.start).getHours()) + ':' + pad(new Date(r.start).getMinutes()) + '</small></span>' +
          '<span class="pt-clock" data-ptclock>' + clock(Date.now() - r.start) + '</span><button type="button" class="pill-btn danger-btn" data-ptstop><i class="bi bi-stop-fill"></i> Stop</button></div>' : '';
        h += '<div class="pt-starts">' + live.map(function (p) {
          var cur = r && r.pid === p.id;
          return '<button type="button" class="pt-start' + (cur ? ' on' : '') + '" style="--c:' + p.color + '" data-ptgo="' + esc(p.id) + '"' + (cur ? ' disabled' : '') + '><i class="bi bi-' + (cur ? 'record-fill' : 'play-fill') + '"></i>' + esc(p.name) + '</button>';
        }).join('') + '</div>';
        h += '<div class="seg lp-seg pt-seg">' + [['week', 'This week'], ['last', 'Last week'], ['month', 'This month']].map(function (x) { return '<button type="button" data-ptrange="' + x[0] + '" aria-pressed="' + (PT.range === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
        h += '<div class="kit-tiles">' + tile(rg[2], hm(tot)) + tile('Today', hm(todayM)) + tile(val ? 'Worth' : 'Clients', val ? nf.format(val) + ' <small>kr</small>' : Object.keys(per).length, val ? 'at your rates' : 'with hours') + '</div>';
        var keys = Object.keys(per).sort(function (a, b) { return per[b] - per[a]; });
        if (keys.length) h += '<ul class="pt-bars">' + keys.map(function (k) {
          var p = proj(k);
          return '<li style="--c:' + p.color + '"><span class="pt-n">' + esc(p.name) + (p.client ? '<small>' + esc(p.client) + '</small>' : '') + '</span><span class="pt-track"><i style="width:' + Math.max(3, per[k] / max * 100).toFixed(1) + '%"></i></span><b>' + hm(per[k]) + '</b></li>';
        }).join('') + '</ul>';
        var recent = es.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 8);
        if (recent.length) h += '<ul class="kit-list pt-list">' + recent.map(function (e) {
          var p = proj(e.pid);
          return '<li class="kit-item"><button type="button" class="kit-main" data-ptedit="' + esc(e.id) + '"><span class="kit-ic" style="--c:' + p.color + '"><i class="bi bi-clock"></i></span><span class="kit-x"><b>' + esc(p.name) + '</b><small>' +
            esc(fmt(e.date, { weekday: 'short', day: 'numeric', month: 'short' }) + (e.note ? ' · ' + e.note : '')) + '</small></span><span class="kit-r">' + hm(e.mins) + '</span></button></li>';
        }).join('') + '</ul>';
        if (es.length) h += '<div class="hl-acts"><button type="button" class="text-btn" data-ptcsv><i class="bi bi-filetype-csv"></i> Export ' + rg[2].toLowerCase() + ' (CSV)</button>' +
          '<button type="button" class="text-btn" data-ptcopy><i class="bi bi-clipboard"></i> Copy summary</button></div>';
        var arch = ps.filter(function (p) { return p.archived; }).length;
        h += '<p class="muted hl-small">' + (live.length ? '<button type="button" class="link-btn" data-ptmanage>Edit clients</button>' : '') + (arch ? ' · ' + arch + ' finished' : '') + '</p>';
      }
      el.innerHTML = h + '</section>';
      clearInterval(tick);
      if (r) tick = setInterval(function () { var c = el.querySelector('[data-ptclock]'); if (!c || !run()) return clearInterval(tick); if (!document.hidden) c.textContent = clock(Date.now() - run().start); }, 1000);
    }
    function csv(rows) { return rows.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c); return /[";\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';'); }).join('\r\n'); }
    el.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-ptproj]')) return K.edit(PROJ, null);
      if (e.target.closest('[data-ptadd]')) return K.edit(ENTRY, null);
      if ((b = e.target.closest('[data-ptgo]'))) return startT(b.dataset.ptgo);
      if (e.target.closest('[data-ptstop]')) return stopT();
      if ((b = e.target.closest('[data-ptrange]'))) { PT.range = b.dataset.ptrange; return draw(); }
      if ((b = e.target.closest('[data-ptedit]'))) { var en = byId('ptime', b.dataset.ptedit); if (en) K.edit(ENTRY, Object.assign({}, en, { hours: Math.round(en.mins / 60 * 100) / 100 })); return; }
      if (e.target.closest('[data-ptmanage]')) { manage(); return; }
      var rg = range(PT.range), es = Fe.list('ptime').filter(function (x) { return x.date >= rg[0] && x.date <= rg[1]; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      if (e.target.closest('[data-ptcsv]')) {
        var rows = [['Date', 'Client', 'Project', 'Hours', 'Note']].concat(es.map(function (x) { var p = proj(x.pid); return [x.date, p.client || '', p.name, String(Math.round(x.mins / 60 * 100) / 100).replace('.', ','), x.note || '']; }));
        var blob = new Blob(['﻿' + csv(rows)], { type: 'text/csv;charset=utf-8' }), name = 'hours-' + rg[0] + '-' + rg[1] + '.csv';
        var file = window.File ? new File([blob], name, { type: 'text/csv' }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) { navigator.share({ files: [file], title: name }).catch(function () {}); return; }
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        return;
      }
      if (e.target.closest('[data-ptcopy]')) {
        var per = {}; es.forEach(function (x) { per[x.pid] = (per[x.pid] || 0) + x.mins; });
        var txt = rg[2] + ' (' + fmt(rg[0]) + '–' + fmt(rg[1]) + ')\n' + Object.keys(per).map(function (k) { var p = proj(k); return '• ' + p.name + (p.client ? ' (' + p.client + ')' : '') + ': ' + nf1.format(per[k] / 60) + ' h'; }).join('\n') +
          '\nTotal: ' + nf1.format(es.reduce(function (s, x) { return s + x.mins; }, 0) / 60) + ' h';
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('<i class="bi bi-clipboard-check"></i> Summary copied'); });
      }
    });
    /* editing clients: one list in a small sheet, tap one to edit */
    function manage() {
      var ps = Fe.list('pproj');
      var box = document.createElement('div'); box.className = 'fo-bg'; box.innerHTML = '<div class="fo-box lf-box"><h3>Clients and projects</h3><ul class="kit-list">' + ps.map(function (p) {
        return '<li class="kit-item"><button type="button" class="kit-main" data-pm="' + esc(p.id) + '"><span class="kit-ic" style="--c:' + p.color + '"><i class="bi bi-briefcase"></i></span><span class="kit-x"><b>' + esc(p.name) + '</b><small>' + esc([p.client, p.rate ? nf.format(p.rate) + ' kr/h' : '', p.archived ? 'finished' : ''].filter(Boolean).join(' · ')) + '</small></span><i class="bi bi-chevron-right"></i></button></li>';
      }).join('') + '</ul><button type="button" class="pill-btn wide" data-pmclose>Done</button></div>';
      document.body.appendChild(box);
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pm]');
        if (b) { box.remove(); K.edit(PROJ, byId('pproj', b.dataset.pm)); return; }
        if (e.target === box || e.target.closest('[data-pmclose]')) box.remove();
      });
    }
    ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, draw); });
    window.Vault.onUnlock(draw);
  })();
  window.BriefExtra.push(function (add) {
    if (!on('ptime')) return;
    var r = run(); if (!r) return;
    var m = (Date.now() - r.start) / 60000, p = proj(r.pid);
    add(m > 240 ? 11 : 27, 'hourglass-split', m > 240 ? RED : '#e8743b', 'Timer: ' + p.name, hm(m) + (m > 240 ? ' – still working on it?' : ' so far'), '/cmd/work/#ptime',
      { act: { id: 'ptstop:' + r.start, label: 'Stop' }, run: function () { stopT(); } });
  });
  window.CommandExtra.push(function () {
    if (!on('ptime')) return [];
    var r = run(), out = r ? [{ i: 'stop-fill', t: 'Stop the timer', s: proj(r.pid).name, run: function () { stopT(); }, x: 'stop timer time tid' }] : [];
    return out.concat(Fe.list('pproj').filter(function (p) { return !p.archived && (!r || r.pid !== p.id); }).map(function (p) {
      return { i: 'play-fill', t: 'Start timer: ' + p.name, s: p.client || 'Time per client', run: function () { startT(p.id); }, x: 'start timer time tid ' + (p.client || '') };
    }));
  });

  window.HomeLife = { bday: bday, nextPickup: nextPickup, nextDue: nextDue, addShop: addShop, start: startT, stop: stopT };
})();
