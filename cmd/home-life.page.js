/* Home life (Settings → Features), each a page of its own, off until you switch it on:
     House    upkeep that comes round again, bin days, meter readings, home info  (/cmd/house/)
     People   birthdays, keeping in touch, gift ideas                              (/cmd/people/)
     Food     the week's dinners, the shopping list, recipes                       (/cmd/food/)
   and on the Work page:
     Time per client – a timer per client or project, hours per week, a CSV to invoice from.
   Data lives in dash.tools (synced, encrypted); lines for At a glance go through window.BriefExtra,
   reminders into the calendar through Features.events(). */
/* The page part of home-life.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is home-life.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["homelife"]; if (!__c) return;
  var cfg = __c.cfg, on = __c.on, today = __c.today, gear = __c.gear, nextDue = __c.nextDue, daysTo = __c.daysTo, RED = __c.RED, AMBER = __c.AMBER, GREEN = __c.GREEN, hmIcon = __c.hmIcon, esc = __c.esc, isKey = __c.isKey, fmt = __c.fmt, inDays = __c.inDays, hmDone = __c.hmDone, Fe = __c.Fe, USUAL = __c.USUAL, picker = __c.picker, BLUE = __c.BLUE, addDays = __c.addDays, nextPickup = __c.nextPickup, meterStats = __c.meterStats, INFO = __c.INFO, addMonths = __c.addMonths, toast = __c.toast, infoCfg = __c.infoCfg, byId = __c.byId, KEEP = __c.KEEP, snapshot = __c.snapshot, saveList = __c.saveList, uid = __c.uid, restore = __c.restore, overdue = __c.overdue, bday = __c.bday, ago = __c.ago, talked = __c.talked, fromKey = __c.fromKey, meals = __c.meals, addShop = __c.addShop, dkey = __c.dkey, recipeFor = __c.recipeFor, ingredients = __c.ingredients, AISLES = __c.AISLES, AISLE = __c.AISLE, aisleOf = __c.aisleOf, pad = __c.pad, run = __c.run, proj = __c.proj, hm = __c.hm, startT = __c.startT, stopT = __c.stopT, dialog = __c.dialog, dhead = __c.dhead;
  var K = window.Kit || null;
  function col(cfg) { return K && cfg.mount ? K.collection(cfg) : null; }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function tile(label, value, sub) { return '<div class="kit-tile"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function chip(text, c) { return '<span class="hl-chip" style="--c:' + c + '">' + text + '</span>'; }
  var PAGE = (location.pathname.match(/\/cmd\/(house|people|food|work)\/$/) || [])[1];
  if (PAGE) {
    var pgEmpty = function () { var e = document.querySelector('[data-pgempty]'); if (e) e.hidden = on(PAGE); };
    pgEmpty(); window.addEventListener('features:change', pgEmpty); window.Vault.onUnlock(pgEmpty);
  }
  function intercept(el, fn) { if (el) el.addEventListener('click', function (e) { if (fn(e) === false) { e.stopPropagation(); e.preventDefault(); } }, true); }
  function withDefaults(base, defs) { return Object.assign({}, base, { fields: base.fields.map(function (f) { return f.k in defs ? Object.assign({}, f, { def: defs[f.k] }) : f; }) }); }
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
  var EVERY = [[1, 'Every month'], [2, 'Every 2 months'], [3, 'Every 3 months'], [6, 'Every 6 months'], [12, 'Every year'], [24, 'Every 2 years'], [60, 'Every 5 years']];
  function everyName(m) { var x = EVERY.filter(function (e) { return e[0] === +m; })[0]; return x ? x[1] : 'Every ' + m + ' months'; }
  var HM = { key: 'hmaint', addTitle: 'New upkeep task', editTitle: 'Edit upkeep task', fields: [
    { k: 'title', type: 'title', label: 'Task', ph: 'e.g. Clean the heat pump filters', req: true },
    { k: 'every', label: 'How often', type: 'select', options: EVERY, def: 12 },
    { k: 'last', label: 'Last done', type: 'date', def: today, help: 'Leave empty if it’s never been done – then it’s due now.' },
    { k: 'notes', label: 'How / notes', type: 'textarea', rows: 2 }] };
  col({
    mount: $t('hmaint'), feature: 'house', key: 'hmaint', icon: 'tools', title: 'Upkeep', addLabel: 'Add', limit: 10,
    addTitle: HM.addTitle, editTitle: HM.editTitle, fields: HM.fields,
    headExtra: function () { return gear('house'); },
    empty: 'Things that need doing every few months – filters, drains, smoke alarms. You get a nudge when they’re due.',
    sort: function (a, b) { return nextDue(a) < nextDue(b) ? -1 : 1; },
    above: function (l) { return l.length ? '' : '<button type="button" class="pill-btn hl-seed" data-hmseed><i class="bi bi-magic"></i> <span data-t="ui.pick-from-the-usual-ones">Pick from the usual ones</span></button>'; },
    row: function (it) {
      var n = daysTo(nextDue(it)), c = n < 0 ? RED : n <= 14 ? AMBER : GREEN;
      return { icon: hmIcon(it.title), color: c, title: it.title, sub: esc(everyName(it.every) + (isKey(it.last) ? ' · last ' + fmt(it.last) : ' · not done yet')),
        right: chip(n < 0 ? 'Overdue' : cap(inDays(n)), c) };
    },
    detail: function (it) {
      return (it.notes ? '<p class="kit-notes">' + esc(it.notes) + '</p>' : '') +
        '<p class="muted hl-small">Next time: ' + esc(fmt(nextDue(it), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })) + '</p>' +
        '<div class="hl-acts"><button type="button" class="pill-btn" data-hmdone="' + esc(it.id) + '"><i class="bi bi-check2"></i> <span data-t="ui.done-today">Done today</span></button></div>';
    },
    onClick: function (e) { var b = e.target.closest('[data-hmdone]'); if (b) hmDone(b.dataset.hmdone); }
  });
  function hmPick() {
    var have = Fe.list('hmaint').map(function (x) { return x.title; });
    var opts = USUAL.filter(function (u) { return have.indexOf(u[0]) < 0; }).map(function (u) { return { n: u[0], s: everyName(u[1]), i: u[3], c: GREEN, u: u }; });
    opts.push({ n: 'Something else', s: 'Write your own', i: 'pencil', c: '#7a8794' });
    picker('tools', I18N.k('ui.new-upkeep-task', 'New upkeep task'), I18N.k('ui.pick-one-it-comes-with-how-often-and-how', 'Pick one – it comes with how often and how to'), opts, function (o) {
      K.edit(o.u ? withDefaults(HM, { title: o.u[0], every: o.u[1], notes: o.u[2] }) : HM, null);
    });
  }
  intercept($t('hmaint'), function (e) { if (e.target.closest('[data-kit-add], [data-hmseed]')) { hmPick(); return false; } });
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
    picker('trash3', I18N.k('ui.new-bin', 'New bin'), I18N.k('ui.which-one', 'Which one?'), opts, function (o) { K.edit(o.s ? BINS : withDefaults(BINS, { title: o.n }), null); });
    return false;
  });
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
      var s = meterStats(l); if (s.r.length < 2) return s.r.length ? '<p class="muted hl-small" data-t="ui.add-one-more-reading-to-see-how-much-you">Add one more reading to see how much you use.</p>' : '';
      var pr = +cfg('housecfg').price || 0;
      return '<div class="kit-tiles">' + tile(I18N.k('ui.per-day-lately', 'Per day, lately'), nf1.format(s.last) + ' <small>kWh</small>') + tile(I18N.k('ui.per-day-avg', 'Per day, avg'), nf1.format(s.avg) + ' <small>kWh</small>', 'last 12 months') +
        (pr ? tile(I18N.k('ui.per-month', 'Per month'), '≈ ' + nf.format(s.avg * 30.4 * pr / 100) + ' <small>kr</small>', 'at ' + nf.format(pr) + ' øre/kWh') : tile(I18N.k('ui.per-year', 'Per year'), nf.format(s.avg * 365) + ' <small>kWh</small>', 'at that pace')) + '</div>';
    },
    row: function (x) {
      var s = meterStats(Fe.list('hmeter')), p = s.prev(x), d = p ? s.per(p, x) : null;
      return { icon: 'speedometer2', color: AMBER, title: fmt(x.date, { day: 'numeric', month: 'short', year: 'numeric' }),
        sub: p ? esc('+' + nf.format(x.value - p.value) + ' kWh' + (d != null ? ' · ' + nf1.format(d) + ' kWh/day' : '')) : 'First reading', right: typeof x.value === 'number' ? esc(nf.format(x.value)) : '–' };
    }
  });
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
      if (f.secret) { val = '<span class="hl-secret" data-sec="' + esc(v) + '">••••••••</span>'; act = '<button type="button" class="text-btn" data-hlshow data-t="ui.show"><span data-t="ui.show">Show</span></button>'; }
      if (f.type === 'tel') act = '<a class="text-btn" href="tel:' + esc(String(v).replace(/[^\d+]/g, '')) + '"><i class="bi bi-telephone"></i> <span data-t="ui.call">Call</span></a>';
      if (f.type === 'email') act = '<a class="text-btn" href="mailto:' + esc(v) + '"><i class="bi bi-envelope"></i></a>';
      if (f.type === 'url' && /^https?:\/\//.test(v)) { val = 'Link'; act = '<a class="text-btn" href="' + esc(v) + '" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> <span data-t="ui.open">Open</span></a>'; }
      if (f.type !== 'url' && f.type !== 'tel' && f.type !== 'email' && f.type !== 'select' && f.type !== 'date' && f.type !== 'textarea') act += '<button type="button" class="icon-btn sm" data-hlcopy="' + esc(v) + '" aria-label="Copy"><i class="bi bi-clipboard"></i></button>';
      rows += '<div class="hl-kv"><span>' + esc(f.label) + '</span><b class="' + (f.type === 'textarea' ? 'hl-pre' : '') + '">' + val + '</b><span class="hl-kva">' + act + '</span></div>';
    });
    if (k === 'appliance' && isKey(x.bought)) {
      var end = addMonths(x.bought, 12 * (+x.years || 5)), n = daysTo(end);
      rows += '<div class="hl-kv"><span data-t="ui.complaint-period"><span data-t="ui.complaint-period">Complaint period</span></span><b>' + (n >= 0 ? 'Until ' + esc(fmt(end, { day: 'numeric', month: 'short', year: 'numeric' })) : 'Ended ' + esc(fmt(end, { month: 'short', year: 'numeric' }))) + '</b><span></span></div>';
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
      picker('info-circle', I18N.k('ui.add-to-good-to-know', 'Add to Good to know'), I18N.k('ui.what-is-it', 'What is it?'), ks.map(function (k) { return { n: INFO[k].n, s: INFO[k].s, i: INFO[k].i, c: INFO[k].c, k: k }; }), function (o) { K.edit(infoCfg(o.k), null); });
      return false;
    }
    if ((b = e.target.closest('[data-kit-edit]'))) { var x = byId('hinfo', b.dataset.kitEdit); if (x) K.edit(infoCfg(x.kind), x); return false; }
  });
  heroes.house = function () {
    var nb = nextBins(), up = Fe.list('hmaint'), over = up.filter(function (x) { return daysTo(nextDue(x)) < 0; });
    var nx = up.slice().sort(function (a, b) { return nextDue(a) < nextDue(b) ? -1 : 1; })[0];
    var ms = meterStats(Fe.list('hmeter')), pr = +cfg('housecfg').price || 0, info = Fe.list('hinfo');
    return heroTile('trash3', I18N.k('ui.next-bin', 'Next bin'), nb ? esc(cap(inDays(daysTo(nb.k)))) : '–', nb ? esc(nb.names.join(' + ')) : 'Add your bins', '#hbins') +
      heroTile('tools', 'Upkeep', over.length ? '<span class="neg">' + over.length + ' overdue</span>' : nx ? esc(cap(inDays(daysTo(nextDue(nx))))) : '–', nx ? esc(nx.title) : 'Nothing added yet', '#hmaint') +
      heroTile('lightning-charge', 'Power', ms.avg != null ? nf1.format(ms.last != null ? ms.last : ms.avg) + ' <small>kWh/day</small>' : '–', ms.avg != null ? (pr ? '≈ ' + nf.format(ms.avg * 30.4 * pr / 100) + ' kr a month' : nf.format(ms.avg * 365) + ' kWh a year') : 'Add two readings', '#hmeter') +
      heroTile('info-circle', I18N.k('ui.good-to-know', 'Good to know'), info.length, info.length ? esc(info.slice(0, 3).map(function (x) { return x.title; }).join(', ')) : 'Wi-Fi, codes, contacts', '#hinfo');
  };
  var REL = [['family', 'Family'], ['friend', 'Friend'], ['work', 'Work'], ['other', 'Other']];
  var REL_C = { family: '#d55181', friend: BLUE, work: '#e8743b', other: '#7a8794' };
  var PP = { key: 'people', addTitle: 'New person', editTitle: 'Edit person', fields: [
    { k: 'name', type: 'title', label: 'Name', ph: 'Name', req: true },
    { k: 'rel', label: 'Who', type: 'select', options: REL, def: 'friend' },
    { k: 'bday', label: 'Birthday', ph: '24.12 or 24.12.1990', help: 'With the year, you also see how old they turn.' },
    { k: 'every', label: 'Keep in touch', type: 'select', options: KEEP, def: function () { return cfg('peoplecfg').defEvery; } },
    { k: 'last', label: 'Last talked', type: 'date' },
    { k: 'phone', label: 'Phone', type: 'tel', ph: '+47' },
    { k: 'gifts', label: 'Gift ideas', type: 'textarea', rows: 2, help: 'Jot them down when you hear them – one per line.' },
    { k: 'xmas', label: 'On the Christmas gift list', type: 'check' },
    { k: 'dates', label: 'Other dates', type: 'textarea', rows: 2, ph: 'Wedding 12.06.2015\nStarted school 19.08.2024', help: 'Anniversaries and other yearly days – one per line, a name and a date. Name days come by themselves from the Norwegian almanac.' },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'Partner’s and kids’ names, allergies, what they’re up to.' }] };
  col({
    mount: $t('people'), feature: 'people', key: 'people', icon: 'people', title: 'People', addLabel: 'Add', limit: 12,
    addTitle: PP.addTitle, editTitle: PP.editTitle, fields: PP.fields,
    headExtra: function () { return (window.PeoplePlus ? window.PeoplePlus.importBtn() : '') + gear('people'); },
    empty: 'Add the people who matter – with a birthday you get a heads-up a week before, with “keep in touch” a nudge when it’s been too long.',
    /* who you live with is already known (shared home): offer them in one tap until they're in the list (2026-11-10) */
    afterRender: function (el, items) {
      var nm = ''; try { nm = window.ShareSpace && ShareSpace.on() ? String(ShareSpace.name() || '').trim() : ''; } catch (e) {}
      var has = !nm || nm === 'them' || items.some(function (x) { return String(x.name || '').trim().toLowerCase() === nm.toLowerCase(); });
      var old = el.querySelector('.pp-suggest'); if (has) { if (old) old.remove(); return; }
      if (old) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pill-btn sm pp-suggest'; var nb = window.I18N && I18N.lang === 'nb'; b.innerHTML = '<i class="bi bi-person-plus"></i> ' + (nb ? 'Legg til ' : 'Add ') + esc(nm);
      b.addEventListener('click', function () {
        var was = snapshot('people');
        saveList('people', function (l) { l.push({ id: uid(), name: nm, rel: 'family' }); });
        toast('<i class="bi bi-person-check"></i> ' + esc(nm) + (nb ? ' lagt til' : ' added'), function () { restore('people', was); });
      });
      var at = el.querySelector('.kit-list, .kit-empty'); if (at) at.parentNode.insertBefore(b, at); else el.appendChild(b);
    },
    sort: function (a, b) {
      var oa = overdue(a), ob = overdue(b), ba = bday(a), bb = bday(b);
      var sa = ba && ba.n <= 14 ? ba.n : oa != null ? 20 : 100 + (ba ? ba.n : 400), sb = bb && bb.n <= 14 ? bb.n : ob != null ? 20 : 100 + (bb ? bb.n : 400);
      return sa - sb || String(a.name).localeCompare(b.name, 'nb');
    },
    row: function (p) {
      var b = bday(p), o = overdue(p), subs = [];
      if (b) subs.push('Birthday ' + fmt(b.next) + (b.age ? ' (' + b.age + ')' : ''));
      if (isKey(p.last)) subs.push('talked ' + ago(p.last));
      var right = b && b.n <= 14 ? chip('<i class="bi bi-balloon"></i> ' + cap(inDays(b.n)), '#d55181') : o != null ? chip(I18N.k('ui.catch-up', 'Catch up'), AMBER) : '';
      return { icon: 'person', color: REL_C[p.rel] || BLUE, title: p.name, sub: esc(subs.join(' · ')), right: right };
    },
    detail: function (p) {
      var tel = String(p.phone || '').replace(/[^\d+]/g, ''), b = bday(p);
      return (b ? '<p class="hl-small muted"><i class="bi bi-balloon"></i> ' + esc(fmt(b.next, { weekday: 'long', day: 'numeric', month: 'long' })) + (b.age ? ' – turns ' + b.age : '') + ' · ' + esc(inDays(b.n)) + '</p>' : '') +
        (window.PeoplePlus ? window.PeoplePlus.days(p) : '') +
        (p.gifts ? '<div class="hl-gifts"><b><i class="bi bi-gift"></i> <span data-t="ui.gift-ideas">Gift ideas</span></b><ul>' + String(p.gifts).split('\n').filter(Boolean).map(function (g, i) { return '<li><span data-noi18n>' + esc(g) + '</span>' + (window.PeoplePlus ? ' <button type="button" class="text-btn pp5-gave" data-ppgave="' + esc(p.id) + '|' + i + '"><span data-t="ui.gave-it">Gave it</span></button>' : '') + '</li>'; }).join('') + '</ul></div>' : '') +
        (p.notes ? '<p class="kit-notes hl-pre">' + esc(p.notes) + '</p>' : '') +
        (window.PeoplePlus ? window.PeoplePlus.detail(p) : '') +
        '<div class="hl-acts"><button type="button" class="pill-btn" data-pptalk="' + esc(p.id) + '"><i class="bi bi-chat-heart"></i> <span data-t="ui.talked-today">Talked today</span></button>' +
        (tel ? '<a class="text-btn" href="tel:' + esc(tel) + '"><i class="bi bi-telephone"></i> <span data-t="ui.call">Call</span></a><a class="text-btn" href="sms:' + esc(tel) + '"><i class="bi bi-chat"></i> <span data-t="ui.message">Message</span></a>' : '') + '</div>';
    },
    onClick: function (e) { var b = e.target.closest('[data-pptalk]'); if (b) talked(b.dataset.pptalk, true); }
  });
  (function () {
    var el = $t('pdates'); if (!el) return;
    function draw() {
      var ok = on('people'); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; }
      var l = Fe.list('people').map(function (p) { return [bday(p), p]; }).filter(function (x) { return x[0] && x[0].n <= 120; });
      if (window.PeoplePlus) l = l.concat(window.PeoplePlus.upcoming(120));          // name days and anniversaries
      l = l.sort(function (a, b) { return a[0].n - b[0].n || (a[0].kind ? 1 : 0) - (b[0].kind ? 1 : 0); }).slice(0, 8);
      el.innerHTML = '<section class="card kit-card" id="pdates"><div class="card-head"><h2><i class="bi bi-balloon"></i> <span data-t="ui.coming-up">Coming up</span></h2></div>' +
        (l.length ? '<ul class="hl-dates">' + l.map(function (x) {
          var b = x[0], d = fromKey(b.next);
          return '<li' + (b.n <= 7 ? ' class="soon"' : '') + '><span class="hl-day"><b>' + d.getDate() + '</b><small>' + esc(d.toLocaleDateString('en-GB', { month: 'short' })) + '</small></span>' +
            '<span class="hl-dx"><b><span data-noi18n>' + esc(x[1].name) + '</span>' + (b.kind ? ' <span class="pp5-kind" style="--c:' + b.c + '"><i class="bi bi-' + b.icon + '"></i> ' + esc(b.label) + '</span>' : '') + '</b><small>' + esc(cap(inDays(b.n)) + (b.age ? ' · turns ' + b.age : '') + (b.years ? ' · ' + b.years + ' years' : '')) + (!b.kind && x[1].gifts ? ' · <i class="bi bi-gift"></i> ' + esc(String(x[1].gifts).split('\n')[0]) : '') + '</small></span></li>';
        }).join('') + '</ul>' : '<p class="empty kit-empty" data-t="ui.nothing-in-the-next-four-months-add-birt">Nothing in the next four months – add birthdays and other dates to the people in your list.</p>') + '</section>';
    }
    ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, draw); });
    window.Vault.onUnlock(draw);
  })();
  heroes.people = function () {
    var l = Fe.list('people'), bs = l.map(function (p) { return [bday(p), p]; }).filter(function (x) { return x[0]; }).sort(function (a, b) { return a[0].n - b[0].n; });
    var due = l.filter(function (p) { return overdue(p) != null; }), m = new Date().getMonth() + 1, mon = bs.filter(function (x) { return x[0].m === m; });
    return heroTile('balloon', I18N.k('ui.next-birthday', 'Next birthday'), bs.length ? esc(cap(inDays(bs[0][0].n))) : '–', bs.length ? esc(bs[0][1].name + (bs[0][0].age ? ' · turns ' + bs[0][0].age : '')) : 'Add a birthday', '#pdates', '#d55181') +
      heroTile('chat-heart', I18N.k('ui.catch-up', 'Catch up'), due.length ? '<span class="neg">' + due.length + '</span>' : '0', due.length ? esc(due.slice(0, 3).map(function (p) { return p.name; }).join(', ')) : 'All in touch', '#people') +
      heroTile('calendar-heart', I18N.k('ui.this-month', 'This month'), mon.length, mon.length ? esc(mon.map(function (x) { return x[1].name; }).join(', ')) : 'No birthdays', '#pdates') +
      heroTile('people', 'People', l.length, l.filter(function (p) { return +p.every; }).length + ' to keep in touch with', '#people');
  };
  function setMeal(k, v) { var t = Fe.tools(); t.meals = meals(); if (v) t.meals[k] = v; else delete t.meals[k]; Object.keys(t.meals).forEach(function (x) { if (x < addDays(today(), -60)) delete t.meals[x]; }); Fe.saveTools(t); }
  function skippedNote() { var k = addShop.skipped || []; return k.length ? ' · ' + k.length + ' basic' + (k.length === 1 ? '' : 's') + ' skipped' : ''; }
  var ML = { wk: 0, voting: false };
  function votePartner() { var d = window.Vault.get() || {}, sh = d.share || {}, S = window.Shared, p = S && S.partner ? S.partner() : null; var nm = (p && p.name) || sh.name || ''; return sh.on && (sh.what || {}).meals !== false && nm ? String(nm).split(/\s+/)[0] : ''; }
  function votes() { var cut = addDays(today(), -2); return Fe.list('votes').filter(function (v) { return v.date >= cut && Array.isArray(v.opts) && v.opts.length; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }
  function voteHtml() {
    var pn = votePartner(); if (!pn) return '';
    var dd = function (k) { return fromKey(k).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }); };
    var h = votes().map(function (v) {
      if (v.pick != null) return '<li class="hl-vote done"><i class="bi bi-check2-circle"></i><span>' + esc((v.from === 'me' ? pn + ' picked ' : 'You picked ') + v.opts[v.pick] + ' for ' + dd(v.date)) + '</span></li>';
      if (v.from === 'me') return '<li class="hl-vote wait"><i class="bi bi-hourglass-split"></i><span>' + esc('Waiting for ' + pn + ' to pick for ' + dd(v.date) + ': ' + v.opts.join(' · ')) + '</span><button type="button" class="icon-btn sm" data-vtdel="' + esc(v.id) + '" aria-label="Cancel"><i class="bi bi-x"></i></button></li>';
      return '<li class="hl-vote pick"><i class="bi bi-hand-index-thumb"></i><span>' + esc(pn + ' can’t decide – pick dinner for ' + dd(v.date)) + '</span><div class="hl-vopts">' + v.opts.map(function (o, i) { return '<button type="button" class="pill-btn sm" data-vtpick="' + esc(v.id) + '|' + i + '">' + esc(o) + '</button>'; }).join('') + '</div></li>';
    }).join('');
    var form = '';
    if (ML.voting) {
      var opts = ''; for (var i = 0; i < 7; i++) { var k = addDays(today(), i); opts += '<option value="' + k + '"' + (meals()[k] ? '' : '') + '>' + esc(i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fromKey(k).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })) + (meals()[k] ? ' (planned)' : '') + '</option>'; }
      form = '<form class="hl-vform" data-vtform><select name="d" aria-label="Which day">' + opts + '</select>' + [1, 2, 3].map(function (n) { return '<input name="o' + n + '" list="hlRecipes" maxlength="80" placeholder="' + (n === 3 ? 'Suggestion 3 (optional)' : 'Suggestion ' + n) + '" autocomplete="off"' + (n < 3 ? ' required' : '') + '>'; }).join('') +
        '<div class="form-actions"><button type="button" class="text-btn" data-vtcancel data-t="ui.cancel"><span data-t="ui.cancel">Cancel</span></button><span class="spacer"></span><button class="pill-btn" type="submit"><i class="bi bi-send"></i> Send to ' + esc(pn) + '</button></div></form>';
    }
    return (h ? '<ul class="hl-votes">' + h + '</ul>' : '') + form;
  }
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
        '<div class="head-actions">' + gear('food') + '<button type="button" class="icon-btn" data-mlwk="-1" aria-label="Previous week" data-t-aria-label="ui.previous-week"><i class="bi bi-chevron-left"></i></button>' +
        (ML.wk ? '<button type="button" class="text-btn" data-mlwk="0" data-t="ui.this-week"><span data-t="ui.this-week">This week</span></button>' : '') +
        '<button type="button" class="icon-btn" data-mlwk="1" aria-label="Next week" data-t-aria-label="ui.next-week"><i class="bi bi-chevron-right"></i></button></div></div>' +
        voteHtml() + '<ul class="hl-meals">' + days.map(function (k) {
          var d = fromKey(k), r = recipeFor(m[k]);
          return '<li class="' + (k === tk ? 'today' : '') + (k < tk ? ' past' : '') + '"><label for="ml-' + k + '"><b>' + esc(d.toLocaleDateString('en-GB', { weekday: 'short' })) + '</b><small>' + d.getDate() + '.' + (d.getMonth() + 1) + '</small></label>' +
            '<input id="ml-' + k + '" data-ml="' + k + '" list="hlRecipes" value="' + esc(m[k] || '') + '" placeholder="' + (k === tk ? 'What’s for dinner?' : '–') + '" maxlength="80" autocomplete="off" enterkeyhint="next">' +
            (r ? '<button type="button" class="icon-btn sm" data-mlrec="' + esc(r.id) + '" aria-label="Open the recipe"><i class="bi bi-journal-text"></i></button>' : '<span class="hl-sp"></span>') + '</li>';
        }).join('') + '</ul><datalist id="hlRecipes">' + rs.map(function (r) { return '<option value="' + esc(r.title) + '">'; }).join('') + '</datalist>' +
        '<div class="hl-acts">' + (withR.length ? '<button type="button" class="pill-btn" data-mlshop><i class="bi bi-cart-plus"></i> Ingredients to the shopping list</button>' : '') +
        (rs.length && planned.length < 7 ? '<button type="button" class="text-btn" data-mlfill><i class="bi bi-shuffle"></i> <span data-t="ui.fill-the-empty-days">Fill the empty days</span></button>' : '') +
        (votePartner() && !ML.voting ? '<button type="button" class="text-btn" data-vtnew><i class="bi bi-hand-index-thumb"></i> Let ' + esc(votePartner()) + ' choose</button>' : '') +
        (planned.length ? '<span class="muted hl-small">' + planned.length + ' of 7 planned</span>' : '') + '</div></section>';
    }
    el.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-vtform]'); if (!f) return; e.preventDefault();
      var o = [f.o1.value, f.o2.value, f.o3.value].map(function (x) { return x.trim(); }).filter(Boolean); if (o.length < 2) { (f.o2.value.trim() ? f.o1 : f.o2).focus(); return; }
      var t = Fe.tools(); t.votes = (Array.isArray(t.votes) ? t.votes : []).filter(function (v) { return v.date >= addDays(today(), -2); }).concat([{ id: 'v' + Date.now().toString(36), date: f.d.value, opts: o.slice(0, 3), from: 'me', at: Date.now() }]);
      ML.voting = false; if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur(); Fe.saveTools(t); draw();
      toast('<i class="bi bi-send"></i> Sent to ' + esc(votePartner()) + ' – they pick one');
    });
    el.addEventListener('change', function (e) { var i = e.target.closest('[data-ml]'); if (i) { setMeal(i.dataset.ml, i.value.trim()); } });
    el.addEventListener('keydown', function (e) { var i = e.target.closest('[data-ml]'); if (i && e.key === 'Enter') { e.preventDefault(); var n = i.closest('li').nextElementSibling; if (n) n.querySelector('input').focus(); else i.blur(); } });
    el.addEventListener('focusout', function () { setTimeout(function () { if (!el.contains(document.activeElement)) draw(); }, 50); });
    el.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-vtnew]')) { ML.voting = true; draw(); var f0 = el.querySelector('[data-vtform] input'); if (f0) f0.focus(); return; }
      if (e.target.closest('[data-vtcancel]')) { ML.voting = false; return draw(); }
      if ((b = e.target.closest('[data-vtdel]'))) { var t0 = Fe.tools(); t0.votes = (t0.votes || []).filter(function (v) { return v.id !== b.dataset.vtdel; }); Fe.saveTools(t0); return; }
      if ((b = e.target.closest('[data-vtpick]'))) {
        var q = b.dataset.vtpick.split('|'), t1 = Fe.tools(), v1 = (t1.votes || []).filter(function (v) { return v.id === q[0]; })[0]; if (!v1) return;
        v1.pick = +q[1]; t1.meals = meals(); t1.meals[v1.date] = v1.opts[v1.pick]; Fe.saveTools(t1);
        var rr = recipeFor(v1.opts[v1.pick]), n = rr ? addShop(window.FoodPlus ? window.FoodPlus.lines(rr, 'week') : ingredients(rr), 'week') : 0;
        toast('<i class="bi bi-egg-fried"></i> ' + esc(v1.opts[v1.pick]) + ' it is' + (n ? ' · ' + n + ' thing' + (n === 1 ? '' : 's') + ' to the shopping list' : ''));
        return;
      }
      if ((b = e.target.closest('[data-mlwk]'))) { ML.wk = +b.dataset.mlwk === 0 ? 0 : ML.wk + (+b.dataset.mlwk); return draw(); }
      if ((b = e.target.closest('[data-mlrec]'))) { RC.open(b.dataset.mlrec); var c = $t('recipes'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (e.target.closest('[data-mlshop]')) {
        var m = meals(), m0 = monday(ML.wk), all = [];
        for (var i = 0; i < 7; i++) { var k = addDays(m0, i), rr = recipeFor(m[k]); if (rr && (k >= today() || ML.wk > 0)) all = all.concat(window.FoodPlus ? window.FoodPlus.lines(rr, 'week') : ingredients(rr)); }
        var n = addShop(all, 'week');
        toast('<i class="bi bi-cart-check"></i> ' + (n ? n + ' thing' + (n === 1 ? '' : 's') + ' added to the shopping list' : 'It’s all on the list already') + skippedNote());
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
    var shMore = null, shDoneOpen = false;
    function row(x) {
      var a = AISLE[aisleOf(x.text)];
      /* compact: tick + name; section, pantry and remove sit behind one ⋯ (ticked items just get ×) */
      var more = !x.done && shMore === x.id;
      return '<li class="' + (x.done ? 'done' : '') + (more ? ' more' : '') + '"><label><input type="checkbox" data-shx="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '><span>' + esc(x.text) + '</span></label>' +
        (x.done ? '<button type="button" class="icon-btn sm" data-shdel="' + esc(x.id) + '" aria-label="Remove ' + esc(x.text) + '"><i class="bi bi-x"></i></button>'
          : '<span class="sh-acts">' + (more ? '<button type="button" class="icon-btn sm sh-aisle" data-shaisle="' + esc(x.id) + '" aria-label="Section: ' + esc(a.n) + '" title="Move to another section" style="--c:' + a.c + '"><i class="bi bi-' + a.ic + '"></i></button>' +
            (window.FoodPlus ? window.FoodPlus.shopBtn(x) : '') +
            '<button type="button" class="icon-btn sm" data-shdel="' + esc(x.id) + '" aria-label="Remove ' + esc(x.text) + '"><i class="bi bi-trash3"></i></button>' : '') +
            '<button type="button" class="icon-btn sm sh-more" data-shmore="' + esc(x.id) + '" aria-expanded="' + more + '" aria-label="More for ' + esc(x.text) + '"><i class="bi bi-' + (more ? 'x-lg' : 'three-dots') + '"></i></button></span>') + '</li>';
    }
    function draw() {
      var ok = on('food'); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; }
      var l = list(), open = l.filter(function (x) { return !x.done; }), done = l.filter(function (x) { return x.done; }), mode = cfg('foodcfg').sort, body;
      if (mode === 'aisle') {
        var by = {}; open.forEach(function (x) { var a = aisleOf(x.text); (by[a] = by[a] || []).push(x); });
        body = Object.keys(by).sort(function (a, b) { return aisleRank(a) - aisleRank(b); }).map(function (a) {
          return '<li class="sh-grp" style="--c:' + AISLE[a].c + '"><i class="bi bi-' + AISLE[a].ic + '"></i> ' + esc(AISLE[a].n) + '</li>' + by[a].map(row).join('');
        }).join('');
      } else {
        if (mode === 'abc') open.sort(function (a, b) { return a.text.localeCompare(b.text, 'nb'); });
        body = open.map(row).join('');
      }
      /* ticked items fold into one line at the bottom */
      if (done.length) body += '<li class="sh-donehead"><button type="button" class="text-btn" data-shdonetog aria-expanded="' + shDoneOpen + '"><i class="bi bi-chevron-' + (shDoneOpen ? 'down' : 'right') + '"></i> In the cart · ' + done.length + '</button></li>' + (shDoneOpen ? done.map(row).join('') : '');
      var keep = el.querySelector('.hl-shopadd input'), typed = keep ? keep.value : '', focus = keep && document.activeElement === keep;
      el.innerHTML = '<section class="card kit-card" id="shop"><div class="card-head"><h2><i class="bi bi-cart3"></i> Shopping list' + (open.length ? ' <span class="hl-count">' + open.length + '</span>' : '') + '</h2>' +
        '<div class="head-actions">' + (open.length ? '<button type="button" class="text-btn" data-shshare><i class="bi bi-' + (navigator.share ? 'share' : 'clipboard') + '"></i> ' + (navigator.share ? 'Share' : 'Copy') + '</button>' : '') +
        (done.length ? '<button type="button" class="text-btn" data-shclear><i class="bi bi-check2-all"></i> <span data-t="ui.clear-done">Clear done</span></button>' : '') + '</div></div>' +
        '<form class="hl-shopadd"><input placeholder="Add – milk, eggs, coffee" data-t-placeholder="ui.add-milk-eggs-coffee" maxlength="300" enterkeyhint="done" autocomplete="off" aria-label="Add to the shopping list"><button type="submit" class="icon-btn" aria-label="Add" data-t-aria-label="ui.add"><i class="bi bi-plus-lg"></i></button></form>' +
        (l.length ? '<ul class="hl-shop">' + body + '</ul>'
          : '<p class="empty kit-empty" data-t="ui.nothing-to-buy-add-things-here-or-send-a">Nothing to buy. Add things here, or send a week of recipes over from the dinners.</p>') + '</section>';
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
      if ((b = e.target.closest('[data-shmore]'))) { shMore = shMore === b.dataset.shmore ? null : b.dataset.shmore; draw(); return; }
      if ((b = e.target.closest('[data-shdonetog]'))) { shDoneOpen = !shDoneOpen; draw(); return; }
      if ((b = e.target.closest('[data-shaisle]'))) {
        var it = list().filter(function (x) { return x.id === b.dataset.shaisle; })[0]; if (!it) return;
        picker('signpost', it.text, I18N.k('ui.which-section-is-it-in', 'Which section is it in?'), AISLES.map(function (a) { return { n: a[1], i: a[2], c: a[3], k: a[0] }; }), function (o) {
          var t = Fe.tools(); t.shopcat = t.shopcat || {}; t.shopcat[String(it.text || '').toLowerCase().trim()] = o.k; Fe.saveTools(t);
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
  var RC = { open: function () {} };
  col({
    mount: $t('recipes'), feature: 'food', key: 'recipes', icon: 'journal-text', title: 'Recipes', addLabel: 'Add', limit: 10,
    headExtra: function () { return window.FoodPlus ? window.FoodPlus.importBtn() : ''; },
    addTitle: 'New recipe', editTitle: 'Edit recipe', fields: [
      { k: 'title', type: 'title', label: 'Name', ph: 'e.g. Fish tacos', req: true },
      { k: 'mins', label: 'Time', type: 'number', suffix: 'min' },
      { k: 'serves', label: 'Serves', type: 'number', suffix: 'people', help: 'How many the ingredients are for – then you can scale it up or down.' },
      { k: 'ingr', label: 'Ingredients', type: 'textarea', rows: 5, help: 'One per line – they go to the shopping list as they are.' },
      { k: 'steps', label: 'How', type: 'textarea', rows: 4 },
      { k: 'link', label: 'Link', type: 'url', ph: 'https://' }],
    empty: 'Your go-to dinners. Plan them into the week and their ingredients go on the shopping list in one tap.',
    sort: function (a, b) { return String(a.title).localeCompare(b.title, 'nb'); },
    row: function (r) {
      var n = ingredients(r).length;
      return { icon: 'journal-text', color: AMBER, title: r.title, sub: esc([r.mins ? r.mins + ' min' : '', +r.serves ? 'serves ' + r.serves : '', n ? n + ' ingredient' + (n === 1 ? '' : 's') : ''].filter(Boolean).join(' · ')) };
    },
    detail: function (r) {
      var ing = ingredients(r), link = /^https?:\/\//.test(r.link || '') ? r.link : '';
      return (window.FoodPlus ? window.FoodPlus.ingrBlock(r) : ing.length ? '<ul class="hl-ingr">' + ing.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        (r.steps ? '<p class="kit-notes hl-pre">' + esc(r.steps) + '</p>' : '') +
        '<div class="hl-acts"><button type="button" class="pill-btn" data-rctoday="' + esc(r.id) + '"><i class="bi bi-calendar-check"></i> <span data-t="ui.dinner-today">Dinner today</span></button>' +
        (ing.length ? '<button type="button" class="text-btn" data-rcshop="' + esc(r.id) + '"><i class="bi bi-cart-plus"></i> To the list</button>' : '') +
        (link ? '<a class="text-btn" href="' + esc(link) + '" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> <span data-t="ui.open">Open</span></a>' : '') + '</div>';
    },
    onClick: function (e) {
      var b, r;
      if ((b = e.target.closest('[data-rctoday]')) && (r = byId('recipes', b.dataset.rctoday))) { setMeal(today(), r.title); toast('<i class="bi bi-calendar-check"></i> ' + esc(r.title) + ' tonight'); }
      if ((b = e.target.closest('[data-rcshop]')) && (r = byId('recipes', b.dataset.rcshop))) { var n = addShop(window.FoodPlus ? window.FoodPlus.lines(r) : ingredients(r), r.title); toast('<i class="bi bi-cart-check"></i> ' + (n ? n + ' added to the shopping list' : 'Already on the list') + skippedNote()); }
    }
  });
  RC.open = function (id) { var c = $t('recipes'), b = c && c.querySelector('[data-kit-toggle="' + id + '"]'); if (b && !b.closest('li').classList.contains('open')) b.click(); };
  heroes.food = function () {
    var m = meals(), tk = today(), m0 = monday(0), n = 0, i; for (i = 0; i < 7; i++) if (m[addDays(m0, i)]) n++;
    var shop = (Fe.tools().shop || []).filter(function (x) { return !x.done; }), r = recipeFor(m[tk]);
    return heroTile('egg-fried', 'Tonight', m[tk] ? esc(m[tk]) : '–', m[tk] ? (r && r.mins ? r.mins + ' min' : 'Planned') : 'Nothing planned', '#meals', AMBER) +
      heroTile('calendar-week', I18N.k('ui.this-week', 'This week'), n + ' <small>/ 7</small>', 'dinners planned', '#meals') +
      heroTile('cart3', I18N.k('ui.shopping-list', 'Shopping list'), shop.length, shop.length ? esc(shop.slice(0, 3).map(function (x) { return x.text; }).join(', ')) : 'Nothing to buy', '#shop') +
      heroTile('journal-text', 'Recipes', Fe.list('recipes').length, 'to plan from', '#recipes');
  };
  var PCOL = ['#e8743b', BLUE, '#22b35e', '#8a6fdf', '#d55181', '#0891b2', '#c98500'];
  var PROJ = { key: 'pproj', addTitle: 'New client or project', editTitle: 'Edit client or project', fields: [
    { k: 'name', type: 'title', label: 'Name', ph: 'e.g. Obos – Storgata 12', req: true },
    { k: 'client', label: 'Client', ph: 'Who pays' },
    { k: 'rate', label: 'Hourly rate', type: 'number', suffix: 'kr', help: 'Optional – shows what the hours are worth.' },
    { k: 'archived', label: 'Finished (hide it)', type: 'check' }],
    beforeSave: function (it, isNew) { if (isNew) it.color = PCOL[Fe.list('pproj').length % PCOL.length]; } };
  function ptList() { return Fe.list('ptime').map(function (e) { var m = +e.mins; if (isFinite(m) && e.mins != null) return e; return Object.assign({}, e, { mins: +e.min || +e.minutes || Math.round((+e.hours || 0) * 60) || 0 }); }); }
  var ENTRY = { key: 'ptime', addTitle: 'Add time', editTitle: 'Edit time', fields: [
    { k: 'pid', label: 'Client / project', type: 'select', options: function () { return Fe.list('pproj').filter(function (p) { return !p.archived; }).map(function (p) { return [p.id, p.name]; }); }, req: true },
    { k: 'date', label: 'Date', type: 'date', req: true, def: today },
    { k: 'hours', label: 'Time', type: 'number', suffix: 'hours', req: true, help: 'e.g. 1,5 for an hour and a half' },
    { k: 'note', label: 'What you did', ph: 'Optional' }],
    beforeSave: function (it) { it.mins = Math.round((+it.hours || 0) * 60); delete it.hours; } };
  var PT = { range: 'week' };
  function clock(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 3600) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }
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
      var es = ptList().filter(function (e) { return e.date >= rg[0] && e.date <= rg[1]; }), tot = 0, val = 0, per = {};
      es.forEach(function (e) { tot += e.mins; per[e.pid] = (per[e.pid] || 0) + e.mins; var p = proj(e.pid); if (p.rate) val += e.mins / 60 * p.rate; });
      var todayM = ptList().filter(function (e) { return e.date === today(); }).reduce(function (s, e) { return s + e.mins; }, 0);
      var max = Math.max.apply(null, [1].concat(Object.keys(per).map(function (k) { return per[k]; })));
      var h = '<section class="card kit-card" id="ptime"><div class="card-head"><h2><i class="bi bi-hourglass-split"></i> <span data-t="ui.time-per-client">Time per client</span></h2><div class="head-actions">' +
        gear('work') + '<button type="button" class="text-btn" data-ptproj><i class="bi bi-plus-lg"></i> <span data-t="ui.client">Client</span></button>' +
        (live.length ? '<button type="button" class="text-btn" data-ptadd><i class="bi bi-clock-history"></i> <span data-t="ui.add-time">Add time</span></button>' : '') + '</div></div>';
      if (!ps.length) h += '<p class="empty kit-empty" data-t="ui.add-a-client-or-project-then-start-a-tim">Add a client or project, then start a timer when you work on it – or add the hours afterwards. You get hours per week and a list to invoice from.</p>';
      else {
        h += r ? '<div class="pt-run" style="--c:' + proj(r.pid).color + '"><span class="pt-dot"></span><span class="pt-x"><b>' + esc(proj(r.pid).name) + '</b><small>Since ' + pad(new Date(r.start).getHours()) + ':' + pad(new Date(r.start).getMinutes()) + '</small></span>' +
          '<span class="pt-clock" data-ptclock>' + clock(Date.now() - r.start) + '</span><button type="button" class="pill-btn danger-btn" data-ptstop><i class="bi bi-stop-fill"></i> <span data-t="ui.stop">Stop</span></button></div>' : '';
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
          '<button type="button" class="text-btn" data-ptcopy><i class="bi bi-clipboard"></i> <span data-t="ui.copy-summary">Copy summary</span></button></div>';
        var arch = ps.filter(function (p) { return p.archived; }).length;
        h += '<p class="muted hl-small">' + (live.length ? '<button type="button" class="link-btn" data-ptmanage data-t="ui.edit-clients"><span data-t="ui.edit-clients">Edit clients</span></button>' : '') + (arch ? ' · ' + arch + ' finished' : '') +
          (window.WorkPlus && ptList().length ? ' · <button type="button" class="link-btn" data-ptinv><i class="bi bi-receipt"></i> <span data-t="ui.invoice-draft">Invoice draft</span></button>' : '') + '</p>';
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
      var rg = range(PT.range), es = ptList().filter(function (x) { return x.date >= rg[0] && x.date <= rg[1]; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
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
      dialog(dhead('briefcase', I18N.k('ui.clients-and-projects', 'Clients and projects'), I18N.k('ui.tap-one-to-change-its-name-rate-or-mark', 'Tap one to change its name, rate or mark it finished')) + '<ul class="kit-list">' + ps.map(function (p) {
        return '<li class="kit-item"><button type="button" class="kit-main" data-pm="' + esc(p.id) + '"><span class="kit-ic" style="--c:' + p.color + '"><i class="bi bi-briefcase"></i></span><span class="kit-x"><b>' + esc(p.name) + '</b><small>' + esc([p.client, p.rate ? nf.format(p.rate) + ' kr/h' : '', p.archived ? 'finished' : ''].filter(Boolean).join(' · ')) + '</small></span><i class="bi bi-chevron-right"></i></button></li>';
      }).join('') + '</ul><button type="button" class="pill-btn wide" data-hlclose data-t="ui.done"><span data-t="ui.done">Done</span></button>', function (e, close) {
        var b = e.target.closest('[data-pm]'); if (b) { close(); K.edit(PROJ, byId('pproj', b.dataset.pm)); }
      });
    }
    ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, draw); });
    window.Vault.onUnlock(draw);
  })();
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
      var per = {}; ptList().filter(function (e) { return e.date === k; }).forEach(function (e) { per[e.pid] = per[e.pid] || { m: 0, n: [] }; per[e.pid].m += e.mins; if (e.note) per[e.pid].n.push(e.note); });
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
      el.innerHTML = '<section class="card kit-card" id="wkday"><div class="card-head"><h2><i class="bi bi-clipboard-data"></i> <span data-t="ui.day-report">Day report</span></h2><div class="head-actions">' +
        '<div class="seg lp-seg"><button type="button" data-rpday="0" aria-pressed="' + (RPT.day === 0) + '"><span data-t="ui.today">Today</span></button><button type="button" data-rpday="1" aria-pressed="' + (RPT.day === 1) + '"><span data-t="ui.yesterday">Yesterday</span></button></div></div></div>' +
        (r.parts.length ? '<div class="wr-parts">' + r.parts.map(function (p) {
          return '<div class="wr-p"><h3><i class="bi bi-' + p.i + '"></i> ' + esc(p.h) + '</h3><ul>' + p.l.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div>';
        }).join('') + '</div>' +
        '<div class="hl-acts"><button type="button" class="pill-btn" data-wrcopy><i class="bi bi-clipboard"></i> <span data-t="ui.copy">Copy</span></button>' +
        (navigator.share ? '<button type="button" class="text-btn" data-wrshare><i class="bi bi-share"></i> <span data-t="ui.share">Share</span></button>' : '') +
        '<a class="text-btn" href="mailto:?subject=' + encodeURIComponent(r.title) + '&body=' + encodeURIComponent(r.text) + '"><i class="bi bi-envelope"></i> <span data-t="ui.email">Email</span></a></div>'
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
  heroes.work = function () {
    var out = [], tk = today();
    if (on('flex') && window.FlexTime) {
      var st = window.FlexTime.stats(), sg = st.balance < 0 ? '−' : st.balance > 0 ? '+' : '', h = window.FlexTime.dur(Math.abs(st.balance));
      out.push(heroTile('stopwatch', I18N.k('ui.flex-balance', 'Flex balance'), '<span class="' + (st.balance < 0 ? 'neg' : 'pos') + '">' + sg + esc(h) + '</span>', esc(window.FlexTime.dur(st.week)) + ' this week', '#flex', '#e8743b'));
    }
    if (on('ptime')) {
      var m0 = monday(0), mins = ptList().filter(function (x) { return x.date >= m0 && x.date <= tk; }).reduce(function (a, x) { return a + (+x.mins || 0); }, 0), r = run();
      out.push(heroTile('hourglass-split', I18N.k('ui.client-time', 'Client time'), esc(hm(mins)), r ? 'Timer running: ' + esc(proj(r.pid).name) : 'this week', '#ptime'));
    }
    if (on('meetings')) {
      var open = 0; Fe.list('meetings').forEach(function (m) { String(m.actions || '').split('\n').forEach(function (x, i) { if (x.trim() && !(m.done || {})[i]) open++; }); });
      out.push(heroTile('people', I18N.k('ui.action-points', 'Action points'), open ? '<span class="neg">' + open + '</span>' : '0', open ? 'open from meetings' : 'All done', '#meetings'));
    }
    if (on('fdv')) {
      var fl = Fe.list('fdv'), last = fl.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0], tg = 0;
      fl.forEach(function (x) { (x.findings || []).forEach(function (f) { if (String(f.tg) === '3') tg++; }); });
      out.push(heroTile('building-check', 'Inspections', fl.length, last ? esc(last.building) + (tg ? ' · ' + tg + ' TG 3' : '') : 'None yet', '#fdv'));
    }
    if (on('learning') && out.length < 4) {
      var ex = Fe.list('learning').filter(function (c) { return isKey(c.expires) && c.expires >= tk; }).sort(function (a, b) { return a.expires < b.expires ? -1 : 1; })[0];
      out.push(heroTile('mortarboard', I18N.k('ui.next-renewal', 'Next renewal'), ex ? esc(cap(inDays(daysTo(ex.expires)))) : '–', ex ? esc(ex.title) : 'No certificates expiring', '#learning'));
    }
    if (on('holiday') && out.length < 4 && window.FlexTime) {
      var s2 = window.FlexTime.stats(), tot = +((Fe.tools().flexcfg || {}).vacation) || 25;
      out.push(heroTile('sun', I18N.k('ui.holiday-left', 'Holiday left'), Math.max(0, tot - s2.vac) + ' <small>/ ' + tot + '</small>', 'days this year', '#holiday'));
    }
    return out.slice(0, 4).join('');
  };
  (window.__ui = window.__ui || {})["homelife"] = { workReport: workReport, $t: $t, K: K, METER: METER };
})();
