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
  function num(v) { var x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : null; }
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

  /* ---------- settings per page (Settings → Pages → House / People / Food, and Work) ---------- */
  var DEF = {
    housecfg: { binHour: 14, binMorning: true, lead: 2, price: 0, meterNudge: true, calendar: true },
    peoplecfg: { lead: 7, catchup: true, catchupMax: 1, defEvery: 0, calendar: true },
    foodcfg: { nudge: true, nudgeHour: 13, repeat: 14, sort: 'aisle', calendar: false },
    ptcfg: { round: 0, long: 4 }
  };
  function cfg(k) { var c = Fe.tools()[k]; return Object.assign({}, DEF[k], c && typeof c === 'object' ? c : {}); }
  function setCfg(k, patch) { var t = Fe.tools(); t[k] = Object.assign({}, t[k] || {}, patch); Fe.saveTools(t); }
  function gear(page) { return '<a class="text-btn" href="/cmd/?settings=' + page + '" aria-label="Settings"><i class="bi bi-sliders"></i> Settings</a>'; }

  /* a small centred sheet (pick a kind, manage a list) */
  function dialog(html, onClick) {
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<div class="fo-box lf-box hl-box" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    function close() { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 180); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-hlclose]')) return close(); if (onClick) onClick(e, close); });
    return { el: bg.firstChild, close: close };
  }
  function dhead(icon, title, sub) { return '<div class="lf-head"><h3><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h3><button type="button" class="icon-btn sm" data-hlclose aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' + (sub ? '<p class="muted lf-sub">' + esc(sub) + '</p>' : ''); }
  function picker(icon, title, sub, opts, pick) {
    dialog(dhead(icon, title, sub) + '<div class="hl-pick">' + opts.map(function (o, i) {
      return '<button type="button" data-hlpick="' + i + '" style="--c:' + o.c + '"><span class="kit-ic" style="--c:' + o.c + '"><i class="bi bi-' + o.i + '"></i></span><span><b>' + esc(o.n) + '</b>' + (o.s ? '<small>' + esc(o.s) + '</small>' : '') + '</span></button>';
    }).join('') + '</div>', function (e, close) { var b = e.target.closest('[data-hlpick]'); if (b) { close(); setTimeout(function () { pick(opts[+b.dataset.hlpick]); }, 120); } });
  }
  /* catch a card's own "+" / "Edit" before Kit does (to ask what kind first, or use that kind's form) */
  function intercept(el, fn) { if (el) el.addEventListener('click', function (e) { if (fn(e) === false) { e.stopPropagation(); e.preventDefault(); } }, true); }
  function withDefaults(base, defs) { return Object.assign({}, base, { fields: base.fields.map(function (f) { return f.k in defs ? Object.assign({}, f, { def: defs[f.k] }) : f; }) }); }

  /* the numbers at the top of each page */
  function heroTile(icon, label, value, sub, href, c) {
    return '<a class="fp-tile hl-tile" href="' + href + '"' + (c ? ' style="--c:' + c + '"' : '') + '><div class="lbl"><i class="bi bi-' + icon + '"></i>' + label + '</div><div class="val">' + value + '</div><div class="sub">' + (sub || '&nbsp;') + '</div></a>';
  }
  var heroes = {};
  function drawHero() {
    var el = document.getElementById('hlTiles'); if (!el || !PAGE || !heroes[PAGE]) return;
    if (!on(PAGE)) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    var h = heroes[PAGE](); if (el.innerHTML !== h) el.innerHTML = h;
  }
  ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(drawHero.t); drawHero.t = setTimeout(drawHero, 20); }); });
  window.Vault.onUnlock(drawHero);
  document.addEventListener('click', function (e) {
    var a = e.target.closest('.hl-tile[href^="#"]'); if (!a) return;
    e.preventDefault(); var c = document.getElementById(a.getAttribute('href').slice(1)); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ============================== HOUSE ============================== */
  /* ---- upkeep that comes round again ---- */
  var EVERY = [[1, 'Every month'], [2, 'Every 2 months'], [3, 'Every 3 months'], [6, 'Every 6 months'], [12, 'Every year'], [24, 'Every 2 years'], [60, 'Every 5 years']];
  function everyName(m) { var x = EVERY.filter(function (e) { return e[0] === +m; })[0]; return x ? x[1] : 'Every ' + m + ' months'; }
  function nextDue(it) { return isKey(it.last) ? addMonths(it.last, +it.every || 12) : today(); }
  var USUAL = [
    ['Test the smoke alarms', 3, 'Press the test button on each one.', 'alarm'],
    ['New batteries in the smoke alarms', 12, '1 December is smoke alarm day (røykvarslerens dag).', 'battery-charging'],
    ['Check the fire extinguisher', 12, 'Turn it upside down a few times; the needle should be in the green.', 'fire'],
    ['Clean the heat pump filters', 3, 'Rinse in lukewarm water, let them dry.', 'fan'],
    ['Clean the shower and sink drains (sluk)', 3, '', 'droplet'],
    ['Change the ventilation filter', 6, '', 'wind'],
    ['Check under and around the water heater', 12, 'Look for damp or rust; check the leak guard if you have one.', 'thermometer-half'],
    ['Clean the gutters', 12, 'Autumn, after the leaves have fallen.', 'house'],
    ['Check the sealant in the bathroom', 12, 'Cracked or dark sealant lets water in behind the tiles.', 'bucket']
  ];
  var HM = { key: 'hmaint', addTitle: 'New upkeep task', editTitle: 'Edit upkeep task', fields: [
    { k: 'title', type: 'title', label: 'Task', ph: 'e.g. Clean the heat pump filters', req: true },
    { k: 'every', label: 'How often', type: 'select', options: EVERY, def: 12 },
    { k: 'last', label: 'Last done', type: 'date', def: today, help: 'Leave empty if it’s never been done – then it’s due now.' },
    { k: 'notes', label: 'How / notes', type: 'textarea', rows: 2 }] };
  function hmIcon(t) { var u = USUAL.filter(function (x) { return x[0] === t; })[0]; return u ? u[3] : /røyk|smoke/i.test(t) ? 'alarm' : /filter|vent/i.test(t) ? 'wind' : /sluk|drain|vann|water/i.test(t) ? 'droplet' : 'tools'; }
  col({
    mount: $t('hmaint'), feature: 'house', key: 'hmaint', icon: 'tools', title: 'Upkeep', addLabel: 'Add', limit: 10,
    addTitle: HM.addTitle, editTitle: HM.editTitle, fields: HM.fields,
    headExtra: function () { return gear('house'); },
    empty: 'Things that need doing every few months – filters, drains, smoke alarms. You get a nudge when they’re due.',
    sort: function (a, b) { return nextDue(a) < nextDue(b) ? -1 : 1; },
    above: function (l) { return l.length ? '' : '<button type="button" class="pill-btn hl-seed" data-hmseed><i class="bi bi-magic"></i> Pick from the usual ones</button>'; },
    row: function (it) {
      var n = daysTo(nextDue(it)), c = n < 0 ? RED : n <= 14 ? AMBER : GREEN;
      return { icon: hmIcon(it.title), color: c, title: it.title, sub: esc(everyName(it.every) + (isKey(it.last) ? ' · last ' + fmt(it.last) : ' · not done yet')),
        right: chip(n < 0 ? 'Overdue' : cap(inDays(n)), c) };
    },
    detail: function (it) {
      return (it.notes ? '<p class="kit-notes">' + esc(it.notes) + '</p>' : '') +
        '<p class="muted hl-small">Next time: ' + esc(fmt(nextDue(it), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })) + '</p>' +
        '<div class="hl-acts"><button type="button" class="pill-btn" data-hmdone="' + esc(it.id) + '"><i class="bi bi-check2"></i> Done today</button></div>';
    },
    onClick: function (e) { var b = e.target.closest('[data-hmdone]'); if (b) hmDone(b.dataset.hmdone); }
  });
  /* "+": a usual one (with its interval and how-to filled in) or your own */
  function hmPick() {
    var have = Fe.list('hmaint').map(function (x) { return x.title; });
    var opts = USUAL.filter(function (u) { return have.indexOf(u[0]) < 0; }).map(function (u) { return { n: u[0], s: everyName(u[1]), i: u[3], c: GREEN, u: u }; });
    opts.push({ n: 'Something else', s: 'Write your own', i: 'pencil', c: '#7a8794' });
    picker('tools', 'New upkeep task', 'Pick one – it comes with how often and how to', opts, function (o) {
      K.edit(o.u ? withDefaults(HM, { title: o.u[0], every: o.u[1], notes: o.u[2] }) : HM, null);
    });
  }
  intercept($t('hmaint'), function (e) { if (e.target.closest('[data-kit-add], [data-hmseed]')) { hmPick(); return false; } });
  function hmDone(id) {
    var old = snapshot('hmaint');
    saveList('hmaint', function (l) { l.forEach(function (x) { if (x.id === id) x.last = today(); }); });
    var it = byId('hmaint', id);
    toast('<i class="bi bi-check2"></i> Done – next ' + (it ? fmt(nextDue(it), { day: 'numeric', month: 'short', year: 'numeric' }) : ''), function () { restore('hmaint', old); });
  }
  window.BriefExtra.push(function (add) {
    if (!on('house')) return;
    var lead = +cfg('housecfg').lead || 0;
    Fe.list('hmaint').filter(function (x) { return daysTo(nextDue(x)) <= lead; }).sort(function (a, b) { return nextDue(a) < nextDue(b) ? -1 : 1; }).slice(0, 2).forEach(function (x) {
      var n = daysTo(nextDue(x));
      add(n < 0 ? 33 : 46, hmIcon(x.title), n < 0 ? RED : AMBER, x.title, n < 0 ? 'Overdue since ' + fmt(nextDue(x)) : 'Due ' + inDays(n), '/cmd/house/',
        { act: { id: 'hm:' + x.id + ':' + today(), label: 'Done' }, run: function () { hmDone(x.id); } });
    });
  });

  /* ---- bin days (renovasjon) ---- */
  var BIN_TYPES = [
    ['Restavfall', '#7a8794', 'trash3'], ['Papir og papp', BLUE, 'newspaper'], ['Plastemballasje', '#8a6fdf', 'bag'],
    ['Matavfall', GREEN, 'apple'], ['Glass- og metallemballasje', '#0891b2', 'cup-straw'], ['Hageavfall', '#5d9c3a', 'tree']
  ];
  var EVERY_WK = [[1, 'Every week'], [2, 'Every 2 weeks'], [3, 'Every 3 weeks'], [4, 'Every 4 weeks'], [6, 'Every 6 weeks'], [8, 'Every 8 weeks']];
  var BINS = { key: 'hbins', addTitle: 'New bin', editTitle: 'Edit bin', fields: [
    { k: 'title', type: 'title', label: 'Bin', ph: 'Restavfall, Papir, Plast, Glass og metall …', req: true },
    { k: 'first', label: 'Next pickup', type: 'date', req: true, def: function () { return addDays(today(), 1); }, help: 'Or any day it was picked up – the rest follow from it. Your kommune’s app or website has the dates.' },
    { k: 'every', label: 'How often', type: 'select', options: EVERY_WK, def: 2 },
    { k: 'night', label: 'Remind me the evening before', type: 'check', def: true }] };
  function nextPickup(b, from) {
    if (!isKey(b.first)) return null;
    from = from || today();
    var step = (+b.every || 1) * 7, n = Math.round((fromKey(from) - fromKey(b.first)) / 864e5);
    var k = n <= 0 ? 0 : Math.ceil(n / step);
    return addDays(b.first, k * step);
  }
  function binType(t) { return BIN_TYPES.filter(function (x) { return x[0] === t; })[0] || (/papir|paper|papp/i.test(t) ? BIN_TYPES[1] : /plast/i.test(t) ? BIN_TYPES[2] : /mat|food|bio/i.test(t) ? BIN_TYPES[3] : /glass|metall/i.test(t) ? BIN_TYPES[4] : /hage|garden/i.test(t) ? BIN_TYPES[5] : BIN_TYPES[0]); }
  function nextBins() {
    var nx = Fe.list('hbins').map(function (b) { return [nextPickup(b), b]; }).filter(function (x) { return x[0]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    if (!nx.length) return null;
    return { k: nx[0][0], names: nx.filter(function (x) { return x[0] === nx[0][0]; }).map(function (x) { return x[1].title; }) };
  }
  col({
    mount: $t('hbins'), feature: 'house', key: 'hbins', icon: 'trash3', title: 'Bin days', addLabel: 'Add',
    addTitle: BINS.addTitle, editTitle: BINS.editTitle, fields: BINS.fields,
    empty: 'Add each bin once with its next pickup – you get a reminder the evening before.',
    sort: function (a, b) { return (nextPickup(a) || '9') < (nextPickup(b) || '9') ? -1 : 1; },
    summary: function () {
      var n = nextBins(); if (!n) return '';
      return '<p class="hl-lead"><i class="bi bi-truck"></i> Next: <b>' + esc(n.names.join(' + ')) + '</b> ' + esc(inDays(daysTo(n.k))) + ' · ' + esc(fmt(n.k, { weekday: 'long' })) + '</p>';
    },
    row: function (b) {
      var k = nextPickup(b), n = k ? daysTo(k) : null, bt = binType(b.title);
      var ev = (EVERY_WK.filter(function (x) { return x[0] === +b.every; })[0] || [0, ''])[1];
      return { icon: bt[2], color: bt[1], title: b.title, sub: esc(ev + (k ? ' · ' + fmt(k, { weekday: 'long' }) : '') + (b.night === false ? ' · no reminder' : '')),
        right: k ? chip(cap(inDays(n)), n <= 1 ? AMBER : '#7a8794') : '' };
    }
  });
  intercept($t('hbins'), function (e) {
    if (!e.target.closest('[data-kit-add]')) return;
    var have = Fe.list('hbins').map(function (x) { return x.title; });
    var opts = BIN_TYPES.filter(function (b) { return have.indexOf(b[0]) < 0; }).map(function (b) { return { n: b[0], i: b[2], c: b[1] }; });
    opts.push({ n: 'Another bin', s: 'Write your own', i: 'pencil', c: '#7a8794' });
    picker('trash3', 'New bin', 'Which one?', opts, function (o) { K.edit(o.s ? BINS : withDefaults(BINS, { title: o.n }), null); });
    return false;
  });
  window.BriefExtra.push(function (add, now) {
    if (!on('house')) return;
    var c = cfg('housecfg'), tk = today(), tm = addDays(tk, 1), h = now.getHours();
    var tonight = Fe.list('hbins').filter(function (b) { return b.night !== false && nextPickup(b, tm) === tm; }).map(function (b) { return b.title; });
    var tod = Fe.list('hbins').filter(function (b) { return nextPickup(b) === tk; }).map(function (b) { return b.title; });
    if (tonight.length && h >= (+c.binHour || 14)) add(17, 'trash3', AMBER, 'Put out ' + tonight.join(' + ') + ' tonight', 'Picked up tomorrow', '/cmd/house/');
    else if (tod.length && c.binMorning && h < 10) add(19, 'trash3', AMBER, tod.join(' + ') + ' is picked up today', 'Out by 7 if it isn’t already', '/cmd/house/');
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
  var METER = { key: 'hmeter', addTitle: 'New reading', editTitle: 'Edit reading', fields: [
    { k: 'date', label: 'Date', type: 'date', req: true, def: today },
    { k: 'value', label: 'Meter shows', type: 'number', req: true, suffix: 'kWh', help: 'The big number on the meter, or the latest one in your power company’s app.' },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 }] };
  col({
    mount: $t('hmeter'), feature: 'house', key: 'hmeter', icon: 'speedometer2', title: 'Electricity meter', addLabel: 'Reading', limit: 6,
    addTitle: METER.addTitle, editTitle: METER.editTitle, fields: METER.fields,
    empty: 'Read the meter now and then (or copy the number from the app) – you see how much you use per day and per year.',
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    summary: function (l) {
      var s = meterStats(l); if (s.r.length < 2) return s.r.length ? '<p class="muted hl-small">Add one more reading to see how much you use.</p>' : '';
      var pr = +cfg('housecfg').price || 0;
      return '<div class="kit-tiles">' + tile('Per day, lately', nf1.format(s.last) + ' <small>kWh</small>') + tile('Per day, avg', nf1.format(s.avg) + ' <small>kWh</small>', 'last 12 months') +
        (pr ? tile('Per month', '≈ ' + nf.format(s.avg * 30.4 * pr / 100) + ' <small>kr</small>', 'at ' + nf.format(pr) + ' øre/kWh') : tile('Per year', nf.format(s.avg * 365) + ' <small>kWh</small>', 'at that pace')) + '</div>';
    },
    row: function (x) {
      var s = meterStats(Fe.list('hmeter')), p = s.prev(x), d = p ? s.per(p, x) : null;
      return { icon: 'speedometer2', color: AMBER, title: fmt(x.date, { day: 'numeric', month: 'short', year: 'numeric' }),
        sub: p ? esc('+' + nf.format(x.value - p.value) + ' kWh' + (d != null ? ' · ' + nf1.format(d) + ' kWh/day' : '')) : 'First reading', right: esc(nf.format(x.value)) };
    }
  });
  window.BriefExtra.push(function (add) {
    if (!on('house') || !cfg('housecfg').meterNudge) return;
    var r = meterStats(Fe.list('hmeter')).r; if (!r.length) return;
    var n = -daysTo(r[r.length - 1].date);
    if (n >= 28 && new Date().getDate() <= 3) add(70, 'speedometer2', AMBER, 'Read the electricity meter', 'Last reading ' + ago(r[r.length - 1].date), '/cmd/house/');
  });
  window.CommandExtra.push(function () { return on('house') ? [{ i: 'speedometer2', t: 'New meter reading', s: 'House', run: function () { if ($t('hmeter') && K) K.edit(METER, null); else location.href = '/cmd/house/#hmeter'; }, x: 'meter strøm måler kwh avlesning' }] : []; });

  /* ---- good to know: a form per kind ---- */
  var LINE = function (k, label, o) { return Object.assign({ k: k, label: label }, o || {}); };
  var NOTES = LINE('notes', 'Notes', { type: 'textarea', rows: 3 });
  var INFO = {
    wifi: { n: 'Wi-Fi', s: 'Network and password', i: 'wifi', c: BLUE, f: [LINE('title', 'Name', { type: 'title', def: 'Wi-Fi', req: true }), LINE('ssid', 'Network name', { ph: 'Lundberg-5G' }), LINE('pass', 'Password', { secret: true }), LINE('guest', 'Guest network', { ph: 'Name / password' }), LINE('router', 'Router', { ph: 'Where it is, admin login' }), NOTES] },
    water: { n: 'Water & stopcock', s: 'Where to turn the water off', i: 'droplet', c: '#0891b2', f: [LINE('title', 'Name', { type: 'title', def: 'Stopcock (stoppekran)', req: true }), LINE('where', 'Where it is', { ph: 'Under the kitchen sink, behind the panel' }), LINE('heater', 'Water heater', { ph: 'Size, year, where' }), NOTES] },
    power: { n: 'Fuse box & power', s: 'Fuses, meter, supplier', i: 'lightning-charge', c: AMBER, f: [LINE('title', 'Name', { type: 'title', def: 'Fuse box (sikringsskap)', req: true }), LINE('where', 'Where it is', { ph: 'Hallway cupboard' }), LINE('fuses', 'Which fuse is what', { type: 'textarea', rows: 3, ph: '1 Kitchen, 2 Bathroom floor heating …' }), LINE('supplier', 'Power company'), LINE('meter', 'Meter / målepunkt-ID', { secret: false }), NOTES] },
    contact: { n: 'Contact', s: 'Landlord, plumber, the board (styret)', i: 'person-lines-fill', c: '#d55181', f: [LINE('title', 'Who', { type: 'title', ph: 'Landlord, plumber, styret …', req: true }), LINE('name', 'Name'), LINE('phone', 'Phone', { type: 'tel', ph: '+47' }), LINE('email', 'Email', { type: 'email' }), NOTES] },
    appliance: { n: 'Appliance', s: 'Model, serial, warranty, manual', i: 'plug', c: '#8a6fdf', f: [LINE('title', 'What', { type: 'title', ph: 'Dishwasher, heat pump …', req: true }), LINE('model', 'Brand & model', { ph: 'Bosch SMV4HVX31E' }), LINE('serial', 'Serial number'), LINE('bought', 'Bought', { type: 'date' }), LINE('years', 'Complaint period', { type: 'select', options: [[2, '2 years'], [5, '5 years (things meant to last)']], def: 5 }), LINE('manual', 'Manual', { type: 'url', ph: 'https://' }), NOTES] },
    paint: { n: 'Paint & materials', s: 'Colour codes, tiles, flooring', i: 'palette', c: '#e8743b', f: [LINE('title', 'Where', { type: 'title', ph: 'Living room walls', req: true }), LINE('product', 'Brand & colour', { ph: 'Jotun Lady Pure Color – 1024 Ullhvit' }), LINE('finish', 'Gloss / type', { ph: 'Matt 5' }), LINE('amount', 'Amount used', { ph: '2 × 2,7 l' }), NOTES] },
    code: { n: 'Codes & keys', s: 'Door, alarm, storage room', i: 'key', c: '#7a8794', f: [LINE('title', 'What', { type: 'title', ph: 'Door code, alarm, bike room …', req: true }), LINE('code', 'Code', { secret: true }), LINE('keys', 'Who has keys'), NOTES] },
    other: { n: 'Something else', s: 'A free note', i: 'info-circle', c: GREEN, f: [LINE('title', 'What', { type: 'title', req: true }), LINE('text', 'Details', { type: 'textarea', rows: 4 })] }
  };
  function infoCfg(kind) {
    var k = INFO[kind] ? kind : 'other', x = INFO[k];
    return { key: 'hinfo', addTitle: x.n, editTitle: x.n, fields: x.f, beforeSave: function (it) { it.kind = k; } };
  }
  function infoLine(x) {
    var k = INFO[x.kind] ? x.kind : 'other';
    if (k === 'wifi') return x.ssid || '';
    if (k === 'contact') return [x.name, x.phone].filter(Boolean).join(' · ');
    if (k === 'appliance') return [x.model, x.bought ? 'bought ' + fmt(x.bought, { month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ');
    if (k === 'paint') return [x.product, x.finish].filter(Boolean).join(' · ');
    if (k === 'code') return x.keys ? 'Keys: ' + x.keys : (x.code ? '••••' : '');
    if (k === 'water' || k === 'power') return x.where || '';
    return String(x.text || x.notes || '').split('\n')[0].slice(0, 80);
  }
  function infoDetail(x) {
    var k = INFO[x.kind] ? x.kind : 'other', rows = '';
    INFO[k].f.forEach(function (f) {
      var v = x[f.k]; if (f.k === 'title' || f.k === 'notes' || v == null || v === '') return;
      var val = esc(f.type === 'select' ? ((f.options.filter(function (o) { return String(o[0]) === String(v); })[0] || [, v])[1]) : f.type === 'date' ? fmt(v, { day: 'numeric', month: 'long', year: 'numeric' }) : v), act = '';
      if (f.secret) { val = '<span class="hl-secret" data-sec="' + esc(v) + '">••••••••</span>'; act = '<button type="button" class="text-btn" data-hlshow>Show</button>'; }
      if (f.type === 'tel') act = '<a class="text-btn" href="tel:' + esc(String(v).replace(/[^\d+]/g, '')) + '"><i class="bi bi-telephone"></i> Call</a>';
      if (f.type === 'email') act = '<a class="text-btn" href="mailto:' + esc(v) + '"><i class="bi bi-envelope"></i></a>';
      if (f.type === 'url' && /^https?:\/\//.test(v)) { val = 'Link'; act = '<a class="text-btn" href="' + esc(v) + '" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Open</a>'; }
      if (f.type !== 'url' && f.type !== 'tel' && f.type !== 'email' && f.type !== 'select' && f.type !== 'date' && f.type !== 'textarea') act += '<button type="button" class="icon-btn sm" data-hlcopy="' + esc(v) + '" aria-label="Copy"><i class="bi bi-clipboard"></i></button>';
      rows += '<div class="hl-kv"><span>' + esc(f.label) + '</span><b class="' + (f.type === 'textarea' ? 'hl-pre' : '') + '">' + val + '</b><span class="hl-kva">' + act + '</span></div>';
    });
    if (k === 'appliance' && isKey(x.bought)) {
      var end = addMonths(x.bought, 12 * (+x.years || 5)), n = daysTo(end);
      rows += '<div class="hl-kv"><span>Complaint period</span><b>' + (n >= 0 ? 'Until ' + esc(fmt(end, { day: 'numeric', month: 'short', year: 'numeric' })) : 'Ended ' + esc(fmt(end, { month: 'short', year: 'numeric' }))) + '</b><span></span></div>';
    }
    return (rows ? '<div class="hl-kvs">' + rows + '</div>' : '') + (x.notes ? '<p class="kit-notes hl-pre">' + esc(x.notes) + '</p>' : '');
  }
  col({
    mount: $t('hinfo'), feature: 'house', key: 'hinfo', icon: 'info-circle', title: 'Good to know', addLabel: 'Add', limit: 12,
    addTitle: 'New', editTitle: 'Edit', fields: INFO.other.f,
    empty: 'Wi-Fi, where the stopcock and the fuse box are, codes, the landlord’s number, paint colours, appliance models – encrypted like the rest.',
    sort: function (a, b) { var o = Object.keys(INFO); return o.indexOf(a.kind || 'other') - o.indexOf(b.kind || 'other') || a.title.localeCompare(b.title, 'nb'); },
    row: function (x) { var k = INFO[x.kind] ? x.kind : 'other'; return { icon: INFO[k].i, color: INFO[k].c, title: x.title, sub: esc(infoLine(x)) }; },
    detail: infoDetail,
    onClick: function (e) {
      var b;
      if ((b = e.target.closest('[data-hlcopy]')) && navigator.clipboard) { navigator.clipboard.writeText(b.dataset.hlcopy).then(function () { toast('<i class="bi bi-clipboard-check"></i> Copied'); }); return; }
      if ((b = e.target.closest('[data-hlshow]'))) { var s = b.closest('.hl-kv').querySelector('.hl-secret'); var shown = s.textContent !== '••••••••'; s.textContent = shown ? '••••••••' : s.dataset.sec; b.textContent = shown ? 'Show' : 'Hide'; }
    }
  });
  intercept($t('hinfo'), function (e) {
    var b;
    if (e.target.closest('[data-kit-add]')) {
      var ks = Object.keys(INFO);
      picker('info-circle', 'Add to Good to know', 'What is it?', ks.map(function (k) { return { n: INFO[k].n, s: INFO[k].s, i: INFO[k].i, c: INFO[k].c, k: k }; }), function (o) { K.edit(infoCfg(o.k), null); });
      return false;
    }
    if ((b = e.target.closest('[data-kit-edit]'))) { var x = byId('hinfo', b.dataset.kitEdit); if (x) K.edit(infoCfg(x.kind), x); return false; }
  });

  heroes.house = function () {
    var nb = nextBins(), up = Fe.list('hmaint'), over = up.filter(function (x) { return daysTo(nextDue(x)) < 0; });
    var nx = up.slice().sort(function (a, b) { return nextDue(a) < nextDue(b) ? -1 : 1; })[0];
    var ms = meterStats(Fe.list('hmeter')), pr = +cfg('housecfg').price || 0, info = Fe.list('hinfo');
    return heroTile('trash3', 'Next bin', nb ? esc(cap(inDays(daysTo(nb.k)))) : '–', nb ? esc(nb.names.join(' + ')) : 'Add your bins', '#hbins') +
      heroTile('tools', 'Upkeep', over.length ? '<span class="neg">' + over.length + ' overdue</span>' : nx ? esc(cap(inDays(daysTo(nextDue(nx))))) : '–', nx ? esc(nx.title) : 'Nothing added yet', '#hmaint') +
      heroTile('lightning-charge', 'Power', ms.avg != null ? nf1.format(ms.last != null ? ms.last : ms.avg) + ' <small>kWh/day</small>' : '–', ms.avg != null ? (pr ? '≈ ' + nf.format(ms.avg * 30.4 * pr / 100) + ' kr a month' : nf.format(ms.avg * 365) + ' kWh a year') : 'Add two readings', '#hmeter') +
      heroTile('info-circle', 'Good to know', info.length, info.length ? esc(info.slice(0, 3).map(function (x) { return x.title; }).join(', ')) : 'Wi-Fi, codes, contacts', '#hinfo');
  };

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
    { k: 'every', label: 'Keep in touch', type: 'select', options: KEEP, def: function () { return cfg('peoplecfg').defEvery; } },
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
    headExtra: function () { return gear('people'); },
    empty: 'Add the people who matter – with a birthday you get a heads-up a week before, with “keep in touch” a nudge when it’s been too long.',
    sort: function (a, b) {
      var oa = overdue(a), ob = overdue(b), ba = bday(a), bb = bday(b);
      var sa = ba && ba.n <= 14 ? ba.n : oa != null ? 20 : 100 + (ba ? ba.n : 400), sb = bb && bb.n <= 14 ? bb.n : ob != null ? 20 : 100 + (bb ? bb.n : 400);
      return sa - sb || String(a.name).localeCompare(b.name, 'nb');
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
    var l = Fe.list('people'), pc = cfg('peoplecfg');
    l.forEach(function (p) {
      var b = bday(p); if (!b || b.n > +pc.lead) return;
      var tel = String(p.phone || '').replace(/[^\d+]/g, '');
      if (b.n === 0) add(8, 'balloon', '#d55181', p.name + '’s birthday today', (b.age ? 'Turns ' + b.age : 'Send a greeting') , tel ? 'sms:' + tel : '/cmd/people/', { badge: true });
      else add(b.n <= 2 ? 24 : 40, 'balloon', '#d55181', p.name + '’s birthday ' + inDays(b.n), p.gifts ? 'Gift idea: ' + String(p.gifts).split('\n')[0] : (b.age ? 'Turns ' + b.age + ' · ' : '') + 'no gift ideas yet', '/cmd/people/');
    });
    if (pc.catchup) l.filter(function (p) { return overdue(p) != null; }).sort(function (a, b) { return overdue(b) - overdue(a); }).slice(0, +pc.catchupMax || 1).forEach(function (p) {
      add(58, 'chat-heart', AMBER, 'Catch up with ' + p.name, isKey(p.last) ? 'Last talked ' + ago(p.last) : 'Say hi', '/cmd/people/',
        { act: { id: 'pp:' + p.id + ':' + today(), label: 'Talked' }, run: function () { talked(p.id); } });
    });
  });

  heroes.people = function () {
    var l = Fe.list('people'), bs = l.map(function (p) { return [bday(p), p]; }).filter(function (x) { return x[0]; }).sort(function (a, b) { return a[0].n - b[0].n; });
    var due = l.filter(function (p) { return overdue(p) != null; }), m = new Date().getMonth() + 1, mon = bs.filter(function (x) { return x[0].m === m; });
    return heroTile('balloon', 'Next birthday', bs.length ? esc(cap(inDays(bs[0][0].n))) : '–', bs.length ? esc(bs[0][1].name + (bs[0][0].age ? ' · turns ' + bs[0][0].age : '')) : 'Add a birthday', '#pdates', '#d55181') +
      heroTile('chat-heart', 'Catch up', due.length ? '<span class="neg">' + due.length + '</span>' : '0', due.length ? esc(due.slice(0, 3).map(function (p) { return p.name; }).join(', ')) : 'All in touch', '#people') +
      heroTile('calendar-heart', 'This month', mon.length, mon.length ? esc(mon.map(function (x) { return x[1].name; }).join(', ')) : 'No birthdays', '#pdates') +
      heroTile('people', 'People', l.length, l.filter(function (p) { return +p.every; }).length + ' to keep in touch with', '#people');
  };

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
        '<div class="head-actions">' + gear('food') + '<button type="button" class="icon-btn" data-mlwk="-1" aria-label="Previous week"><i class="bi bi-chevron-left"></i></button>' +
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
        var used = {}; Object.keys(t.meals).forEach(function (k) { var rep = +cfg('foodcfg').repeat || 0; if (rep && k >= addDays(today(), -rep)) used[String(t.meals[k]).toLowerCase()] = 1; });
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
  /* ---- shopping list, in the order you walk the shop ---- */
  var AISLES = [
    ['veg', 'Fruit & veg', 'apple', '#22b35e', /eple|banan|appelsin|sitron|lime|frukt|bær|druer|avokado|tomat|agurk|salat|paprika|løk|hvitløk|potet|gulrot|brokkoli|blomkål|kål|spinat|sopp|squash|mais|ingefær|chili|urter|basilikum|koriander|persille|purre|selleri|fruit|apple|banana|lemon|berr|grape|avocado|tomato|cucumber|lettuce|pepper|onion|garlic|potato|carrot|broccoli|cabbage|mushroom|herb/],
    ['bread', 'Bread', 'basket', '#c98500', /brød|rundstykk|baguett|lompe|tortilla|wraps?|knekkebrød|boller|croissant|pita|bread|bun|roll|bagel|crispbread/],
    ['dairy', 'Dairy & eggs', 'egg', '#3987e5', /melk|fløte|rømme|yoghurt|skyr|smør|margarin|ost|egg|kesam|cottage|crème|creme|milk|cream|butter|cheese|yogurt/],
    ['meat', 'Meat & fish', 'fire', '#e66767', /kjøtt|kylling|svin|storfe|lam|bacon|pølse|skinke|karbonade|kjøttdeig|fisk|laks|torsk|sei|reker|tunfisk|makrell|chicken|beef|pork|lamb|sausage|ham|mince|fish|salmon|cod|shrimp|prawn|tuna/],
    ['cold', 'Chilled & ready', 'snow2', '#0891b2', /pålegg|leverpostei|hummus|pesto|ferdig|pizza|lasagne|taco ?saus|salsa|juice|smoothie|spread|ready/],
    ['dry', 'Pasta, rice & tins', 'box-seam', '#8a6fdf', /pasta|spaghetti|ris|nudler|mel|sukker|havre|gryn|müsli|musli|frokostblanding|bønner|linser|kikerter|hermetikk|tomater på boks|buljong|kokosmelk|olje|eddik|nøtter|rice|noodle|flour|sugar|oat|cereal|beans|lentil|chickpea|tin|stock|oil|vinegar|nut/],
    ['spice', 'Spices & sauces', 'droplet-half', '#c98500', /salt|pepper\b|krydder|kanel|paprikapulver|karri|soya|ketchup|sennep|majones|dressing|saus|sauce|spice|curry|mustard|mayo/],
    ['frozen', 'Frozen', 'snow', '#3987e5', /frys|frossen|is\b|iskrem|frozen|ice ?cream|peas|erter/],
    ['drink', 'Drinks', 'cup-straw', '#0891b2', /kaffe|te\b|brus|cola|vann|øl|vin|saft|coffee|tea|soda|water|beer|wine|squash/],
    ['snack', 'Snacks & sweets', 'cookie', '#d55181', /sjokolade|godteri|chips|kjeks|snacks|popcorn|nøtteblanding|chocolate|candy|sweets|crisps|biscuit|cookie/],
    ['home', 'Household', 'house', '#7a8794', /dopapir|tørkerull|oppvask|vaskemiddel|såpe|søppelpose|poser|folie|bakepapir|batteri|lyspære|servietter|toilet paper|kitchen roll|dish|detergent|soap|bin bags|foil|battery|napkin/],
    ['care', 'Toiletries & pharmacy', 'bandaid', '#d55181', /sjampo|balsam|tannkrem|tannbørste|deodorant|bind|tamponger|bleier|plaster|paracet|ibux|vitamin|shampoo|toothpaste|toothbrush|deo|nappies|diaper|plaster|painkiller/],
    ['other', 'Other', 'three-dots', '#7a8794', /$^/]
  ];
  var AISLE = {}; AISLES.forEach(function (a, i) { AISLE[a[0]] = { i: i, n: a[1], ic: a[2], c: a[3] }; });
  function aisleOf(text) {
    var own = (Fe.tools().shopcat || {})[String(text).toLowerCase().trim()]; if (own && AISLE[own]) return own;
    var t = ' ' + String(text).toLowerCase() + ' ';
    for (var i = 0; i < AISLES.length - 1; i++) if (AISLES[i][4].test(t)) return AISLES[i][0];
    return 'other';
  }
  /* the order you walk the shop: learned from the order you tick things off */
  function aisleRank(a) { var r = (Fe.tools().shoprank || {})[a]; return r != null ? r : AISLE[a].i; }
  function learn(a) {
    var t = Fe.tools(), now = Date.now(), tr = t.shoptrip && now - t.shoptrip.at < 3 * 3600e3 ? t.shoptrip : { n: 0, seen: {} };
    if (!tr.seen[a]) {
      var pos = tr.n++, r = t.shoprank || {}, scale = AISLES.length / 6;          // position in this trip, on the same scale as the default order
      r[a] = r[a] != null ? Math.round((r[a] * .65 + pos * scale * .35) * 100) / 100 : pos * scale;
      t.shoprank = r; tr.seen[a] = 1;
    }
    tr.at = now; t.shoptrip = tr;
    return t;
  }
  (function () {
    var el = $t('shop'); if (!el) return;
    function list() { var l = Fe.tools().shop; return Array.isArray(l) ? l : []; }
    function save(fn, t) { t = t || Fe.tools(); t.shop = Array.isArray(t.shop) ? t.shop : []; fn(t.shop); Fe.saveTools(t); }
    function row(x) {
      var a = AISLE[aisleOf(x.text)];
      return '<li class="' + (x.done ? 'done' : '') + '"><label><input type="checkbox" data-shx="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '><span>' + esc(x.text) + '</span></label>' +
        (x.done ? '' : '<button type="button" class="icon-btn sm sh-aisle" data-shaisle="' + esc(x.id) + '" aria-label="Section: ' + esc(a.n) + '" style="--c:' + a.c + '"><i class="bi bi-' + a.ic + '"></i></button>') +
        '<button type="button" class="icon-btn sm" data-shdel="' + esc(x.id) + '" aria-label="Remove ' + esc(x.text) + '"><i class="bi bi-x"></i></button></li>';
    }
    function draw() {
      var ok = on('food'); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; }
      var l = list(), open = l.filter(function (x) { return !x.done; }), done = l.filter(function (x) { return x.done; }), mode = cfg('foodcfg').sort, body;
      if (mode === 'aisle') {
        var by = {}; open.forEach(function (x) { var a = aisleOf(x.text); (by[a] = by[a] || []).push(x); });
        body = Object.keys(by).sort(function (a, b) { return aisleRank(a) - aisleRank(b); }).map(function (a) {
          return '<li class="sh-grp" style="--c:' + AISLE[a].c + '"><i class="bi bi-' + AISLE[a].ic + '"></i> ' + esc(AISLE[a].n) + '</li>' + by[a].map(row).join('');
        }).join('') + done.map(row).join('');
      } else {
        if (mode === 'abc') open.sort(function (a, b) { return a.text.localeCompare(b.text, 'nb'); });
        body = open.concat(done).map(row).join('');
      }
      var keep = el.querySelector('.hl-shopadd input'), typed = keep ? keep.value : '', focus = keep && document.activeElement === keep;
      el.innerHTML = '<section class="card kit-card" id="shop"><div class="card-head"><h2><i class="bi bi-cart3"></i> Shopping list' + (open.length ? ' <span class="hl-count">' + open.length + '</span>' : '') + '</h2>' +
        '<div class="head-actions">' + (open.length ? '<button type="button" class="text-btn" data-shshare><i class="bi bi-' + (navigator.share ? 'share' : 'clipboard') + '"></i> ' + (navigator.share ? 'Share' : 'Copy') + '</button>' : '') +
        (done.length ? '<button type="button" class="text-btn" data-shclear><i class="bi bi-check2-all"></i> Clear done</button>' : '') + '</div></div>' +
        '<form class="hl-shopadd"><input placeholder="Add – milk, eggs, coffee" maxlength="300" enterkeyhint="done" autocomplete="off" aria-label="Add to the shopping list"><button type="submit" class="icon-btn" aria-label="Add"><i class="bi bi-plus-lg"></i></button></form>' +
        (l.length ? '<ul class="hl-shop">' + body + '</ul>' + (mode === 'aisle' && open.length ? '<p class="muted hl-small">Sorted by section, in the order you tick things off in the shop. Tap a section icon to move an item.</p>' : '')
          : '<p class="empty kit-empty">Nothing to buy. Add things here, or send a week of recipes over from the dinners.</p>') + '</section>';
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
      setTimeout(function () {
        var t = Fe.tools(), it = (t.shop || []).filter(function (x) { return x.id === c.dataset.shx; })[0];
        if (c.checked && it) t = learn(aisleOf(it.text));
        save(function (l) { l.forEach(function (x) { if (x.id === c.dataset.shx) x.done = c.checked; }); }, t);
      }, c.checked ? 280 : 0);
    });
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-shaisle]'))) {
        var it = list().filter(function (x) { return x.id === b.dataset.shaisle; })[0]; if (!it) return;
        picker('signpost', it.text, 'Which section is it in?', AISLES.map(function (a) { return { n: a[1], i: a[2], c: a[3], k: a[0] }; }), function (o) {
          var t = Fe.tools(); t.shopcat = t.shopcat || {}; t.shopcat[it.text.toLowerCase().trim()] = o.k; Fe.saveTools(t);
          toast('<i class="bi bi-signpost"></i> ' + esc(it.text) + ' → ' + esc(o.n) + ' – remembered');
        });
        return;
      }
      if ((b = e.target.closest('[data-shdel]'))) { var old = snapshot('shop'); save(function (l) { for (var i = l.length - 1; i >= 0; i--) if (l[i].id === b.dataset.shdel) l.splice(i, 1); }); toast('<i class="bi bi-trash3"></i> Removed', function () { restore('shop', old); }); return; }
      if (e.target.closest('[data-shclear]')) { var o2 = snapshot('shop'); save(function (l) { for (var i = l.length - 1; i >= 0; i--) if (l[i].done) l.splice(i, 1); }); toast('<i class="bi bi-check2-all"></i> Cleared', function () { restore('shop', o2); }); return; }
      if (e.target.closest('[data-shshare]')) {
        var open = list().filter(function (x) { return !x.done; }), txt;
        if (cfg('foodcfg').sort === 'aisle') {
          var by = {}; open.forEach(function (x) { var a = aisleOf(x.text); (by[a] = by[a] || []).push(x.text); });
          txt = Object.keys(by).sort(function (a, b) { return aisleRank(a) - aisleRank(b); }).map(function (a) { return AISLE[a].n + '\n' + by[a].map(function (x) { return '• ' + x; }).join('\n'); }).join('\n\n');
        } else txt = open.map(function (x) { return '• ' + x.text; }).join('\n');
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
    var fc = cfg('foodcfg');
    if (m && h < 20) {
      var r = recipeFor(m);
      add(h >= 14 ? 34 : 64, 'egg-fried', AMBER, 'Dinner: ' + m, r && r.mins ? r.mins + ' min' + (shop ? ' · ' + shop + ' on the shopping list' : '') : shop ? shop + ' on the shopping list' : 'Planned for tonight', '/cmd/food/');
    } else if (!m && fc.nudge && h >= (+fc.nudgeHour || 13) && h < 19) add(56, 'egg-fried', '#7a8794', 'What’s for dinner?', 'Nothing planned tonight' + (shop ? ' · ' + shop + ' on the shopping list' : ''), '/cmd/food/');
  });
  heroes.food = function () {
    var m = meals(), tk = today(), m0 = monday(0), n = 0, i; for (i = 0; i < 7; i++) if (m[addDays(m0, i)]) n++;
    var shop = (Fe.tools().shop || []).filter(function (x) { return !x.done; }), r = recipeFor(m[tk]);
    return heroTile('egg-fried', 'Tonight', m[tk] ? esc(m[tk]) : '–', m[tk] ? (r && r.mins ? r.mins + ' min' : 'Planned') : 'Nothing planned', '#meals', AMBER) +
      heroTile('calendar-week', 'This week', n + ' <small>/ 7</small>', 'dinners planned', '#meals') +
      heroTile('cart3', 'Shopping list', shop.length, shop.length ? esc(shop.slice(0, 3).map(function (x) { return x.text; }).join(', ')) : 'Nothing to buy', '#shop') +
      heroTile('journal-text', 'Recipes', Fe.list('recipes').length, 'to plan from', '#recipes');
  };
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
    var mins = Math.round((Date.now() - r.start) / 60000), rd = +cfg('ptcfg').round || 0;
    if (rd && mins >= 1) mins = Math.max(rd, Math.ceil(mins / rd) * rd);
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
        gear('work') + '<button type="button" class="text-btn" data-ptproj><i class="bi bi-plus-lg"></i> Client</button>' +
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
      dialog(dhead('briefcase', 'Clients and projects', 'Tap one to change its name, rate or mark it finished') + '<ul class="kit-list">' + ps.map(function (p) {
        return '<li class="kit-item"><button type="button" class="kit-main" data-pm="' + esc(p.id) + '"><span class="kit-ic" style="--c:' + p.color + '"><i class="bi bi-briefcase"></i></span><span class="kit-x"><b>' + esc(p.name) + '</b><small>' + esc([p.client, p.rate ? nf.format(p.rate) + ' kr/h' : '', p.archived ? 'finished' : ''].filter(Boolean).join(' · ')) + '</small></span><i class="bi bi-chevron-right"></i></button></li>';
      }).join('') + '</ul><button type="button" class="pill-btn wide" data-hlclose>Done</button>', function (e, close) {
        var b = e.target.closest('[data-pm]'); if (b) { close(); K.edit(PROJ, byId('pproj', b.dataset.pm)); }
      });
    }
    ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, draw); });
    window.Vault.onUnlock(draw);
  })();
  window.BriefExtra.push(function (add) {
    if (!on('ptime')) return;
    var r = run(); if (!r) return;
    var m = (Date.now() - r.start) / 60000, p = proj(r.pid);
    var lg = (+cfg('ptcfg').long || 4) * 60;
    add(m > lg ? 11 : 27, 'hourglass-split', m > lg ? RED : '#e8743b', 'Timer: ' + p.name, hm(m) + (m > lg ? ' – still working on it?' : ' so far'), '/cmd/work/#ptime',
      { act: { id: 'ptstop:' + r.start, label: 'Stop' }, run: function () { stopT(); } });
  });
  window.CommandExtra.push(function () {
    if (!on('ptime')) return [];
    var r = run(), out = r ? [{ i: 'stop-fill', t: 'Stop the timer', s: proj(r.pid).name, run: function () { stopT(); }, x: 'stop timer time tid' }] : [];
    return out.concat(Fe.list('pproj').filter(function (p) { return !p.archived && (!r || r.pid !== p.id); }).map(function (p) {
      return { i: 'play-fill', t: 'Start timer: ' + p.name, s: p.client || 'Time per client', run: function () { startT(p.id); }, x: 'start timer time tid ' + (p.client || '') };
    }));
  });

  /* ======================= The day at work: one report (Work page, ⌘K) ======================= */
  var RPT = { day: 0 };
  function workReport(k) {
    var FT = window.FlexTime, lines = [], parts = [], d = fromKey(k), dur = function (m) { return FT ? FT.dur(m) : hm(m); };
    var title = 'Work – ' + d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    /* flex time */
    if (on('flex')) {
      var es = Fe.list('flex').filter(function (e) { return e.date === k; }), day = FT ? FT.days().filter(function (x) { return x.date === k; })[0] : null;
      if (es.length) {
        var w = es.filter(function (e) { return e.in; }).map(function (e) { return e.in + '–' + (e.out || 'now'); }).join(', ');
        var other = es.filter(function (e) { return e.type && e.type !== 'work' && e.type !== 'course'; }).map(function (e) { return ({ vacation: 'Holiday', sick: 'Sick', flexoff: 'Flex day off', holiday: 'Public holiday' })[e.type] || e.type; });
        var st = FT ? FT.stats() : null;
        parts.push({ h: 'Hours', i: 'stopwatch', l: [(w ? w + (day && !day.open ? ' · ' + dur(day.worked) + ' worked' : day && day.open ? ' · still at work' : '') : other.join(', ')) + (day && !day.free && !day.open && day.delta ? ' (' + (day.delta > 0 ? '+' : '') + dur(day.delta) + ' flex)' : ''), st ? 'Flex balance: ' + (st.balance > 0 ? '+' : '') + dur(st.balance) : ''].filter(Boolean) });
      }
    }
    /* client time */
    if (on('ptime')) {
      var per = {}; Fe.list('ptime').filter(function (e) { return e.date === k; }).forEach(function (e) { per[e.pid] = per[e.pid] || { m: 0, n: [] }; per[e.pid].m += e.mins; if (e.note) per[e.pid].n.push(e.note); });
      var r = run(); if (r && dkey(new Date(r.start)) === k) { per[r.pid] = per[r.pid] || { m: 0, n: [] }; per[r.pid].m += (Date.now() - r.start) / 60000; per[r.pid].live = true; }
      var ks = Object.keys(per);
      if (ks.length) parts.push({ h: 'Clients', i: 'hourglass-split', l: ks.sort(function (a, b) { return per[b].m - per[a].m; }).map(function (id) { var p = proj(id); return p.name + (p.client ? ' (' + p.client + ')' : '') + ': ' + nf1.format(per[id].m / 60) + ' h' + (per[id].live ? ' (timer running)' : '') + (per[id].n.length ? ' – ' + per[id].n.join('; ') : ''); }) });
    }
    /* meetings */
    if (on('meetings')) {
      var ms = Fe.list('meetings').filter(function (m) { return m.date === k; });
      if (ms.length) parts.push({ h: 'Meetings', i: 'people', l: ms.map(function (m) {
        var acts = String(m.actions || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean), open = acts.filter(function (_, i) { return !(m.done || {})[i]; });
        return m.title + (m.who ? ' – with ' + m.who : '') + (open.length ? '. To do: ' + open.join('; ') : '');
      }) });
    }
    /* inspections */
    if (on('fdv')) {
      var fs = Fe.list('fdv').filter(function (r) { return r.date === k; });
      if (fs.length) parts.push({ h: 'Inspections', i: 'building-check', l: fs.map(function (r) {
        var f = r.findings || [], c = function (t) { return f.filter(function (x) { return String(x.tg) === t; }).length; };
        return (r.building || 'Inspection') + (r.client ? ' (' + r.client + ')' : '') + ': ' + f.length + ' finding' + (f.length === 1 ? '' : 's') + (c('3') ? ', ' + c('3') + ' × TG 3' : '') + (c('2') ? ', ' + c('2') + ' × TG 2' : '');
      }) });
    }
    /* tasks ticked off that day */
    var done = (readJSON('dash.todos', []) || []).filter(function (t) { return t.done && t.doneAt === k; });
    if (done.length) parts.push({ h: 'Done', i: 'check2-square', l: done.map(function (t) { return t.text; }) });
    /* focus sessions */
    var fm = (readJSON('dash.focusLog', []) || []).filter(function (x) { return x.d === k; }).reduce(function (s, x) { return s + (+x.m || 0); }, 0);
    if (fm) parts.push({ h: 'Focus', i: 'bullseye', l: [dur(fm) + ' of focused work'] });
    lines.push(title, '');
    parts.forEach(function (p) { lines.push(p.h.toUpperCase()); p.l.forEach(function (l) { lines.push('• ' + l); }); lines.push(''); });
    return { title: title, parts: parts, text: lines.join('\n').trim() };
  }
  (function () {
    var el = $t('wkday'); if (!el) return;
    function draw() {
      var ok = on('work'); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; }
      var k = addDays(today(), -RPT.day), r = workReport(k);
      el.innerHTML = '<section class="card kit-card" id="wkday"><div class="card-head"><h2><i class="bi bi-clipboard-data"></i> Day report</h2><div class="head-actions">' +
        '<div class="seg lp-seg"><button type="button" data-rpday="0" aria-pressed="' + (RPT.day === 0) + '">Today</button><button type="button" data-rpday="1" aria-pressed="' + (RPT.day === 1) + '">Yesterday</button></div></div></div>' +
        (r.parts.length ? '<div class="wr-parts">' + r.parts.map(function (p) {
          return '<div class="wr-p"><h3><i class="bi bi-' + p.i + '"></i> ' + esc(p.h) + '</h3><ul>' + p.l.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div>';
        }).join('') + '</div>' +
        '<div class="hl-acts"><button type="button" class="pill-btn" data-wrcopy><i class="bi bi-clipboard"></i> Copy</button>' +
        (navigator.share ? '<button type="button" class="text-btn" data-wrshare><i class="bi bi-share"></i> Share</button>' : '') +
        '<a class="text-btn" href="mailto:?subject=' + encodeURIComponent(r.title) + '&body=' + encodeURIComponent(r.text) + '"><i class="bi bi-envelope"></i> Email</a></div>'
          : '<p class="empty kit-empty">Nothing logged ' + (RPT.day ? 'yesterday' : 'yet today') + '. Clock in, run a client timer, write meeting notes or an inspection – it all comes together here as one summary you can send.</p>') + '</section>';
    }
    el.addEventListener('click', function (e) {
      var b, r = workReport(addDays(today(), -RPT.day));
      if ((b = e.target.closest('[data-rpday]'))) { RPT.day = +b.dataset.rpday; return draw(); }
      if (e.target.closest('[data-wrcopy]') && navigator.clipboard) return navigator.clipboard.writeText(r.text).then(function () { toast('<i class="bi bi-clipboard-check"></i> Report copied'); });
      if (e.target.closest('[data-wrshare]')) navigator.share({ title: r.title, text: r.text }).catch(function () {});
    });
    ['tools:change', 'features:change', 'todos:change'].forEach(function (ev) { window.addEventListener(ev, draw); });
    window.Vault.onUnlock(draw);
    setInterval(function () { if (!document.hidden && run()) draw(); }, 60000);
  })();
  window.CommandExtra.push(function () { return on('work') ? [{ i: 'clipboard-data', t: 'Work report for today', s: 'Copy the day at work', run: function () {
    var r = workReport(today());
    if (navigator.clipboard) navigator.clipboard.writeText(r.text).then(function () { toast('<i class="bi bi-clipboard-check"></i> Report copied'); });
  }, x: 'report rapport dag work day summary' }] : []; });

  /* ======================= Notifications on your phone (Settings → Notifications) ======================= */
  window.NotifyExtra = window.NotifyExtra || [];
  window.NotifyExtra.push(function (add, o) {
    var tk = today(), full = o.full;
    for (var i = 0; i < 8; i++) {
      var k = addDays(tk, i), nk = addDays(k, 1);
      if (o.k.house && on('house')) {
        var hc = cfg('housecfg');
        var bins = Fe.list('hbins').filter(function (b) { return b.night !== false && nextPickup(b, nk) === nk; }).map(function (b) { return b.title; });
        if (bins.length) add('bin:' + nk, o.at(k, Math.max(17, +hc.binHour || 18)), full ? 'Put out ' + bins.join(' + ') + ' tonight' : 'A bin goes out tonight', full ? 'Picked up tomorrow' : 'Open House to see which', '/cmd/house/');
        Fe.list('hmaint').forEach(function (m) { if (nextDue(m) === k) add('hm:' + m.id + ':' + k, o.at(k, 10), full ? m.title : 'Upkeep is due today', full ? 'Due today' : 'Open House to see what', '/cmd/house/'); });
      }
      if (o.k.people && on('people')) Fe.list('people').forEach(function (p) {
        var b = bday(p); if (!b) return;
        if (b.next === nk) add('pb1:' + p.id + ':' + nk, o.at(k, 19), full ? p.name + '’s birthday tomorrow' : 'A birthday tomorrow', full ? (b.age ? 'Turns ' + b.age : '') + (p.gifts ? (b.age ? ' · ' : '') + 'Gift idea: ' + String(p.gifts).split('\n')[0] : '') : 'Open People to see who', '/cmd/people/');
        if (b.next === k) add('pb0:' + p.id + ':' + k, o.at(k, 9), full ? p.name + '’s birthday today' : 'A birthday today', full ? 'Send a greeting' : 'Open People to see who', '/cmd/people/');
      });
    }
    /* a client timer that's been left running */
    if (o.k.timer && on('ptime')) { var r = run(); if (r) add('pt:' + r.start, r.start + (+cfg('ptcfg').long || 4) * 3600e3, full ? 'Timer still running: ' + proj(r.pid).name : 'A timer is still running', 'Stop it if you’re done', '/cmd/work/#ptime'); }
    /* time to leave for work: your usual clock-in (from Flex time) minus the trip */
    if (o.k.commute && on('travel')) {
      var usual = usualStart(), trip = +localStorage.getItem('dash.commuteMins') || 0;
      if (usual != null && trip) for (var j = 0; j < 7; j++) {
        var dk = addDays(tk, j), wd = fromKey(dk).getDay(); if (wd === 0 || wd === 6 || Fe.holiday(dk)) continue;
        if (Fe.list('flex').some(function (e) { return e.date === dk && ((e.type && e.type !== 'work' && e.type !== 'course') || e.in); })) continue;   // a day off, or already at work
        var leave = usual - trip - 10;
        add('cm:' + dk, o.at(dk, Math.floor(leave / 60), leave % 60), 'Time to leave for work', 'About ' + trip + ' min to work – open the dashboard for the next departures', '/cmd/');
      }
    }
  });
  /* the time you usually clock in (median of the last 15 work days), in minutes after midnight */
  function usualStart() {
    var l = Fe.list('flex').filter(function (e) { return e.type === 'work' && /^\d{1,2}:\d{2}$/.test(e.in || ''); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 15)
      .map(function (e) { var p = e.in.split(':'); return +p[0] * 60 + +p[1]; }).sort(function (a, b) { return a - b; });
    return l.length >= 5 ? l[Math.floor(l.length / 2)] : null;
  }

  /* ======================= Settings → Pages → House / People / Food (and Work) ======================= */
  (function () {
    if (!document.getElementById('settings')) return;
    function sel(k, f, label, opts, sub) {
      var v = String(cfg(k)[f]);
      return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><select class="st-select" data-hlcfg="' + k + ':' + f + '">' +
        opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
    }
    function sw(k, f, label, sub) {
      return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-hlcfg="' + k + ':' + f + '"' + (cfg(k)[f] ? ' checked' : '') + '></label>';
    }
    function numIn(k, f, label, unit, sub) {
      var v = cfg(k)[f];
      return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><span class="st-unit"><input class="st-input st-num" inputmode="decimal" data-hlcfg="' + k + ':' + f + '" value="' + (v ? esc(String(v).replace('.', ',')) : '') + '" placeholder="–"> ' + unit + '</span></label>';
    }
    function sub(icon, t) { return '<p class="st-sub ap-sub"><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</p>'; }
    function link(href, icon, t) { return '<a class="st-row st-btn" href="' + href + '"><span><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</span><i class="bi bi-chevron-right"></i></a>'; }
    var HOURS = [12, 14, 16, 17, 18, 19, 20].map(function (h) { return [h, 'From ' + pad(h) + ':00']; });
    var PAGES = {
      house: function () {
        return '<p class="st-intro">Reminders and estimates for the House page. Your bins, upkeep and notes are on the page itself.</p>' +
          sub('trash3', 'Bin days') + '<div class="st-group">' + sel('housecfg', 'binHour', 'Evening-before reminder', HOURS, 'In At a glance') + sw('housecfg', 'binMorning', 'Also on the morning of pickup') + '</div>' +
          sub('tools', 'Upkeep') + '<div class="st-group">' + sel('housecfg', 'lead', 'Remind me', [[0, 'On the day'], [2, '2 days before'], [7, 'A week before'], [14, '2 weeks before']]) + '</div>' +
          sub('lightning-charge', 'Electricity') + '<div class="st-group">' + numIn('housecfg', 'price', 'Price for estimates', 'øre/kWh', 'Power + grid rent, incl. VAT – shows ≈ kr a month') + sw('housecfg', 'meterNudge', 'Remind me to read the meter', 'At the start of each month') + '</div>' +
          sub('calendar3', 'Calendar') + '<div class="st-group">' + sw('housecfg', 'calendar', 'Bin days and upkeep in the calendar') + '</div>' +
          '<div class="st-group">' + link('/cmd/house/', 'house-gear', 'Open House') + link('/cmd/house/?customize', 'grid-1x2', 'Order and hide cards') + '</div>';
      },
      people: function () {
        return '<p class="st-intro">How People reminds you about birthdays and keeping in touch.</p>' +
          sub('balloon', 'Birthdays') + '<div class="st-group">' + sel('peoplecfg', 'lead', 'Heads-up', [[0, 'On the day'], [1, 'The day before'], [3, '3 days before'], [7, 'A week before'], [14, '2 weeks before']], 'In At a glance') + sw('peoplecfg', 'calendar', 'Birthdays in the calendar') + '</div>' +
          sub('chat-heart', 'Keeping in touch') + '<div class="st-group">' + sw('peoplecfg', 'catchup', 'Nudges in At a glance') + sel('peoplecfg', 'catchupMax', 'At most', [[1, '1 person at a time'], [2, '2 people'], [3, '3 people']]) +
          sel('peoplecfg', 'defEvery', 'For new people', KEEP, 'What “Keep in touch” starts at') + '</div>' +
          '<div class="st-group">' + link('/cmd/people/', 'people', 'Open People') + link('/cmd/people/?customize', 'grid-1x2', 'Order and hide cards') + '</div>';
      },
      food: function () {
        return '<p class="st-intro">The dinner plan, shopping list and reminders.</p>' +
          sub('egg-fried', 'Dinner') + '<div class="st-group">' + sw('foodcfg', 'nudge', 'Ask “What’s for dinner?”', 'In At a glance, when nothing is planned') + sel('foodcfg', 'nudgeHour', 'Ask', [12, 13, 14, 15, 16].map(function (h) { return [h, 'From ' + pad(h) + ':00']; })) +
          sel('foodcfg', 'repeat', 'Fill the empty days: skip dinners from the last', [[0, 'Don’t skip'], [7, 'Week'], [14, '2 weeks'], [21, '3 weeks']]) + sw('foodcfg', 'calendar', 'Dinners in the calendar') + '</div>' +
          sub('cart3', 'Shopping list') + '<div class="st-group">' + sel('foodcfg', 'sort', 'Order', [['aisle', 'By section in the shop'], ['added', 'As added'], ['abc', 'A–Å']]) + '<button type="button" class="st-row st-btn" data-shreset><span><i class="bi bi-arrow-counterclockwise"></i> Forget the learned shop order</span></button>' + '</div>' +
          '<div class="st-group">' + link('/cmd/food/', 'basket', 'Open Food') + link('/cmd/food/?customize', 'grid-1x2', 'Order and hide cards') + '</div>';
      }
    };
    function summary(k) {
      if (k === 'house') { var h = cfg('housecfg'); return 'Bins from ' + pad(h.binHour) + ':00 · upkeep ' + (+h.lead ? h.lead + ' days before' : 'on the day') + (+h.price ? ' · ' + h.price + ' øre/kWh' : ''); }
      if (k === 'people') { var p = cfg('peoplecfg'); return 'Birthdays ' + (+p.lead ? p.lead + ' days before' : 'on the day') + (p.catchup ? ' · catch-up nudges' : ''); }
      var f = cfg('foodcfg'); return (f.nudge ? 'Dinner nudge from ' + pad(f.nudgeHour) + ':00' : 'No dinner nudge') + ' · list ' + (f.sort === 'abc' ? 'A–Å' : f.sort === 'aisle' ? 'by section' : 'as added');
    }
    function rows() {
      ['house', 'people', 'food'].forEach(function (k) {
        var r = document.getElementById('stRow-' + k); if (r) r.hidden = !on(k);
        var c = document.querySelector('[data-hlcust="' + k + '"]'); if (c) c.hidden = !on(k);
        document.querySelectorAll('[data-ntfeat]').forEach(function (r) { r.hidden = !on(r.dataset.ntfeat); });
        var s = document.getElementById('sum-' + k); if (s) s.textContent = summary(k);
        var bx = document.getElementById('hlSet-' + k); if (bx && on(k) && !bx.contains(document.activeElement)) fill(k);
      });
      work();
    }
    function fill(k) { var box = document.getElementById('hlSet-' + k); if (box && PAGES[k]) box.innerHTML = PAGES[k](); }
    /* Work: Time per client settings, under the flex time ones */
    function work() {
      var pg = document.querySelector('.st-page[data-page="work"]'); if (!pg) return;
      var box = document.getElementById('hlSet-ptime');
      if (!on('ptime')) { if (box) box.remove(); return; }
      if (!box) { box = document.createElement('div'); box.id = 'hlSet-ptime'; pg.appendChild(box); }
      box.innerHTML = sub('hourglass-split', 'Time per client') + '<div class="st-group">' +
        sel('ptcfg', 'round', 'Round timers up to', [[0, 'Exact minutes'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes']]) +
        sel('ptcfg', 'long', 'Ask if a timer runs longer than', [[2, '2 hours'], [4, '4 hours'], [8, '8 hours']]) + '</div>';
      var r = document.getElementById('stWorkRow'); if (r && on('ptime')) r.hidden = false;
    }
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-shreset]')) return;
      var t = Fe.tools(); delete t.shoprank; delete t.shoptrip; Fe.saveTools(t);
      if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-arrow-counterclockwise"></i> Back to the usual shop order');
    });
    document.addEventListener('change', function (e) {
      var i = e.target.closest('[data-hlcfg]'); if (!i) return;
      var q = i.dataset.hlcfg.split(':'), v;
      if (i.type === 'checkbox') v = i.checked;
      else if (i.classList.contains('st-num')) { v = num(i.value); if (v == null || v < 0) v = 0; }
      else v = /^\d+$/.test(i.value) ? +i.value : i.value;
      var patch = {}; patch[q[1]] = v; setCfg(q[0], patch);
      if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-check2"></i> Saved');
    });
    window.addEventListener('st:page', function (e) { var k = e.detail; if (PAGES[k]) fill(k); if (k === 'work') work(); if (k === 'home' || k === 'layout') rows(); });
    ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, rows); });
    window.Vault.onUnlock(rows);
  })();

  /* ======================= the avatar: a ring for today's top 3 ======================= */
  function ring() {
    var tk = today(), l = readJSON('dash.todos', []) || [], top = l.filter(function (t) { return t.today === tk; }).slice(0, 3);
    var done = top.filter(function (t) { return t.done; }).length;
    document.querySelectorAll('.me-btn[data-me]').forEach(function (b) {
      b.classList.toggle('me-ring', top.length > 0); b.classList.toggle('all', top.length > 0 && done === top.length);
      if (top.length) { b.style.setProperty('--ring', (done / top.length).toFixed(3)); b.title = 'Top 3 today: ' + done + ' of ' + top.length + ' done'; }
      else { b.style.removeProperty('--ring'); b.removeAttribute('title'); }
    });
  }
  ['todos:change', 'plan:change', 'dash:local', 'profile:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(ring.t); ring.t = setTimeout(ring, 50); }); });
  window.Vault.onUnlock(function () { setTimeout(ring, 200); });

  window.HomeLife = { cfg: cfg, meals: meals, bday: bday, nextPickup: nextPickup, nextDue: nextDue, addShop: addShop, start: startT, stop: stopT };
})();
