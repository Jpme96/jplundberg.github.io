/* Life sections – the cards (2026-11-21, JP). Each card mounts where its slot is ([data-tool="lp-<id>"]) and only while its
   feature is on. House: Emergency preparedness, Neighbourhood · Finances: Life admin, Deal checks, Climate footprint ·
   People: Celebrations, Big life moments, Family planning, Pets, Clubs · Health: Sleep, Calm, Books/films/games,
   Read later, Digital life · Work: Career · Travel: Outdoors. Lists live in Features.tools()[id]; texts by name. */
(function () {
  'use strict';
  if (!window.Features || !window.Vault || !window.Kit || !window.LifePlus) return;
  var Fe = window.Features, Kt = window.Kit, LP = window.LifePlus, K = function (k, en, o) { return I18N.k(k, en, o); };
  var EN2NB = {}, NB2EN = {};   /* every seed text in both languages, so a saved one is shown in the language you use now (live review 2026-11-25) */
  var NB = function () { return I18N.lang === 'nb'; }, S = function (en, nb) { if (en && nb) { EN2NB[en] = nb; NB2EN[nb] = en; } return NB() ? nb : en; };
  var shown = function (t) { return !t ? t : NB() ? (EN2NB[t] || t) : (NB2EN[t] || t); };   /* seed text is saved, so it's chosen once, in the language you use */
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var today = LP.today, isKey = LP.isKey, days = LP.days, addDays = LP.addDays, addMonths = LP.addMonths, kr = LP.kr, nextDue = LP.nextDue;
  function fmt(k) { return isKey(k) ? Fe.fromKey(k).toLocaleDateString(NB() ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short' }) : ''; }
  function chip(t, c) { return '<span class="hl-chip" style="--c:' + c + '">' + esc(t) + '</span>'; }
  function when(k) { var n = days(today(), k); return n < 0 ? chip(K('ui.lp-overdue', 'Overdue'), 'var(--danger)') : n === 0 ? chip(K('ui.lp-today', 'Today'), 'var(--warn)') : n <= 14 ? chip(K('ui.lp-in-days', 'In {n} days', { n: n }), n <= 7 ? 'var(--warn)' : 'var(--slate)') : chip(fmt(k), 'var(--slate)'); }
  function toast(h, u) { if (window.Quick && Quick.toast) Quick.toast(h, u); }
  function setList(id, fn) { var t = Fe.tools(); t[id] = (Array.isArray(t[id]) ? t[id] : []).map(function (x) { return fn(x) || x; }); Fe.saveTools(t); }
  function seed(id, items) { var t = Fe.tools(), l = Array.isArray(t[id]) ? t[id] : []; t[id] = l.concat(items.map(function (x) { return Object.assign({ id: uid() }, x); })); Fe.saveTools(t); }
  function tick(act, id, title) { return '<span role="button" tabindex="0" class="check lp-act" data-lpact="' + act + '" data-lpid="' + esc(id) + '" aria-label="' + esc(title) + '"><i class="bi bi-check-lg"></i></span>'; }
  var ACT = {};   /* data-lpact name → function (id, el) */
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-lpact]'); if (!b || !ACT[b.dataset.lpact]) return; e.preventDefault(); e.stopPropagation(); ACT[b.dataset.lpact](b.dataset.lpid, b); }, true);
  function card(id, o) {
    var el = $t('lp-' + id); if (!el) return null;
    return Kt.collection(Object.assign({ mount: el, feature: id, key: id, limit: 8, addLabel: K('ui.add', 'Add') }, o));
  }

  /* ================= House: Emergency preparedness (DSB: be able to manage on your own for a week) ================= */
  function readyList(n) {
    n = Math.max(1, +n || 1);
    return [[S('Drinking water', 'Drikkevann'), 20 * n + ' l', 'water'], [S('Food that keeps at room temperature – a week', 'Mat som tåler romtemperatur – en uke'), '', 'food'], [S('A way to cook without power, and fuel', 'Noe å lage mat på uten strøm, og brensel'), '', 'heat'],
      [S('Warm clothes, blankets, sleeping bags', 'Varme klær, pledd, soveposer'), '', 'heat'], [S('DAB radio with batteries', 'DAB-radio med batterier'), '', 'info'], [S('Torch or headlamp, spare batteries', 'Lommelykt eller hodelykt, ekstra batterier'), '', 'light'],
      [S('Candles and matches or a lighter', 'Stearinlys og fyrstikker eller lighter'), '', 'light'], [S('A charged power bank', 'En oppladet powerbank'), '', 'info'], [S('A week of your medicines, and a first aid kit', 'En uke med medisinene dine, og førstehjelpsutstyr'), '', 'health'],
      [S('Iodine tablets (under 40, pregnant or breastfeeding)', 'Jodtabletter (under 40, gravide og ammende)'), '', 'health'], [S('Some cash, and more than one bank card', 'Litt kontanter, og flere betalingskort'), '', 'money'], [S('Important phone numbers on paper', 'Viktige telefonnumre på papir'), '', 'info'],
      [S('Wet wipes, hand sanitiser, toilet paper, rubbish bags', 'Våtservietter, antibac, dopapir, søppelsekker'), '', 'health'], [S('Food and water for pets', 'Mat og vann til kjæledyr'), '', 'food']].map(function (x) { return { name: x[0], qty: x[1], cat: x[2], have: false }; });
  }
  card('ready', { icon: 'box2-heart', title: K('ui.lp-ready', 'Emergency preparedness'), addTitle: K('ui.lp-ready-add', 'Add to the kit'), editTitle: K('ui.lp-ready-edit', 'Edit'),
    fields: [{ k: 'name', type: 'title', label: K('ui.lp-what', 'What'), req: true }, { k: 'qty', label: K('ui.lp-qty', 'How much') }, { k: 'have', type: 'check', label: K('ui.lp-have', 'We have it') }, { k: 'exp', type: 'date', label: K('ui.lp-exp', 'Best before') }, { k: 'notes', type: 'textarea', rows: 2, label: K('ui.notes', 'Notes') }],
    empty: K('ui.lp-ready-empty', 'The authorities ask every home to manage on its own for a week without power, water or shops. Start from their list – tick what you have, and add best-before dates.'),
    above: function (items) { return items.length ? '' : '<div class="lp-start"><label>' + esc(K('ui.lp-people', 'People at home')) + ' <input type="number" min="1" max="12" value="2" data-lpready-n inputmode="numeric"></label><button type="button" class="pill-btn" data-lpact="readyseed" data-lpid=""><i class="bi bi-list-check"></i> ' + esc(K('ui.lp-start-list', 'Start from the recommended list')) + '</button></div>'; },
    summary: function (items) { if (!items.length) return ''; var h = items.filter(function (x) { return x.have; }).length; return '<p class="lp-sum"><b class="tnum">' + h + '/' + items.length + '</b> ' + esc(K('ui.lp-ready-sum', 'ready')) + ' · <a href="https://www.sikkerhverdag.no" target="_blank" rel="noopener">sikkerhverdag.no</a></p>'; },
    sort: function (a, b) { return (a.have ? 1 : 0) - (b.have ? 1 : 0) || ((a.exp || '9') < (b.exp || '9') ? -1 : 1); },
    row: function (x) { return { icon: x.have ? 'check2-circle' : 'circle', color: x.have ? 'var(--ok)' : 'var(--slate)', cls: x.have ? 'lp-done' : '', title: x.name, sub: esc([x.qty, x.exp ? K('ui.lp-bb', 'best before {d}', { d: fmt(x.exp) }) : ''].filter(Boolean).join(' · ')), right: (isKey(x.exp) && days(today(), x.exp) <= 30 ? when(x.exp) : '') + tick('readyhave', x.id, x.name) }; }
  });
  ACT.readyseed = function () { var n = (document.querySelector('[data-lpready-n]') || {}).value; seed('ready', readyList(n)); };
  ACT.readyhave = function (id) { setList('ready', function (x) { if (x.id === id) x.have = !x.have; }); };

  /* ================= House: Neighbourhood (housing association, dugnad, local events) ================= */
  var HOODK = [['meeting', K('ui.lp-hood-meeting', 'Meeting')], ['dugnad', K('ui.lp-hood-dugnad', 'Dugnad (work day)')], ['event', K('ui.lp-hood-event', 'Local event')], ['note', K('ui.lp-hood-note', 'Note')]];
  card('hood', { icon: 'houses', title: K('ui.lp-hood', 'Neighbourhood'), addTitle: K('ui.lp-hood-add', 'Add to Neighbourhood'), editTitle: K('ui.lp-edit', 'Edit'),
    fields: [{ k: 'title', type: 'title', label: K('ui.lp-what', 'What'), req: true }, { k: 'kind', type: 'select', label: K('ui.lp-kind', 'Kind'), options: HOODK, def: 'meeting' }, { k: 'date', type: 'date', label: K('ui.date', 'Date') }, { k: 'where', label: K('ui.lp-where', 'Where') }, { k: 'notes', type: 'textarea', rows: 3, label: K('ui.notes', 'Notes') }],
    empty: K('ui.lp-hood-empty', 'Housing association meetings, dugnad days, local events – and notes about the neighbours (who has a key, who to ask).'),
    sort: function (a, b) { var x = isKey(a.date) && a.date >= today() ? a.date : '9' + (a.date || ''), y = isKey(b.date) && b.date >= today() ? b.date : '9' + (b.date || ''); return x < y ? -1 : 1; },
    row: function (x) { var k = (HOODK.filter(function (q) { return q[0] === x.kind; })[0] || HOODK[3]); return { icon: { meeting: 'people', dugnad: 'tools', event: 'balloon', note: 'sticky' }[x.kind] || 'sticky', color: 'var(--teal, #3a8a78)', title: x.title, sub: esc([k[1], x.where].filter(Boolean).join(' · ')), right: isKey(x.date) && x.date >= today() ? when(x.date) : isKey(x.date) ? chip(fmt(x.date), 'var(--slate)') : '' }; }
  });

  /* ================= Finances: Life admin (the yearly deadlines and checks) ================= */
  function adminSeed() {
    return [[S('Check and send the tax return', 'Sjekk og lever skattemeldingen'), '04-30', 21, S('Wage earners and pensioners: by 30 April. You can ask for a month more.', 'Lønnstakere og pensjonister: innen 30. april. Du kan søke om en måned ekstra.')],
      [S('Pay back-tax (restskatt) early to avoid interest – if you owe', 'Betal restskatt tidlig for å slippe renter – hvis du skylder'), '05-31', 14, S('Paid by 31 May, no interest.', 'Betalt innen 31. mai, ingen renter.')],
      [S('Check your tax card for next year', 'Sjekk skattekortet for neste år'), '12-01', 14, ''],
      [S('Check passport and driving licence dates', 'Sjekk datoene på pass og førerkort'), '02-01', 14, ''],
      [S('Ask your bank for a better mortgage rate', 'Be banken om bedre boliglånsrente'), '10-01', 14, ''],
      [S('Check that BankID works on a new phone or card', 'Sjekk at BankID virker på ny telefon eller kort'), '01-15', 14, '']].map(function (x) { return { name: x[0], md: x[1], lead: x[2], notes: x[3], doneY: 0 }; });
  }
  adminSeed();   /* fills EN2NB / NB2EN */
  var MDS = function () { var o = []; for (var m = 1; m <= 12; m++) for (var d = 1; d <= 31; d += (d === 1 ? 14 : d === 15 ? 13 : 3)) { if (d > 28 && m === 2) continue; var md = String(m).padStart(2, '0') + '-' + String(Math.min(d, new Date(2026, m, 0).getDate())).padStart(2, '0'); if (!o.some(function (q) { return q[0] === md; })) o.push([md, new Date(2026, m - 1, +md.slice(3)).toLocaleDateString(NB() ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long' })]); } return o; };
  card('ladmin', { icon: 'clipboard-check', title: K('ui.lp-ladmin', 'Yearly tasks'), addTitle: K('ui.lp-ladmin-add', 'A yearly task'), editTitle: K('ui.lp-edit', 'Edit'),
    fields: [{ k: 'name', type: 'title', label: K('ui.lp-what', 'What'), req: true }, { k: 'md', type: 'select', label: K('ui.lp-every-year', 'Every year by'), options: MDS, def: '04-30' }, { k: 'lead', type: 'select', label: K('ui.lp-remind', 'Remind me'), options: [[7, K('ui.lp-1w', 'A week before')], [14, K('ui.lp-2w', 'Two weeks before')], [30, K('ui.lp-1m', 'A month before')]], def: 14 }, { k: 'notes', type: 'textarea', rows: 2, label: K('ui.notes', 'Notes') }],
    beforeSave: function (it) { it.lead = +it.lead || 14; },
    empty: K('ui.lp-ladmin-empty', 'The paperwork that comes back every year – the tax return, back-tax, renewals and checks. Tick it off each year; At a glance reminds you before.'),
    above: function (items) { return items.length ? '' : '<div class="lp-start"><button type="button" class="pill-btn" data-lpact="ladminseed" data-lpid=""><i class="bi bi-list-check"></i> ' + esc(K('ui.lp-start-norway', 'Start with the usual ones in Norway')) + '</button></div>'; },
    sort: function (a, b) { var y = new Date().getFullYear(), x = +a.doneY === y ? '9' + a.md : a.md, z = +b.doneY === y ? '9' + b.md : b.md; return x < z ? -1 : 1; },
    row: function (x) { var y = new Date().getFullYear(), done = +x.doneY === y, d = LP.yearDate(x.md || '12-31'); return { icon: done ? 'check2-circle' : 'calendar-event', color: done ? 'var(--ok)' : 'var(--blue)', cls: done ? 'lp-done' : '', title: shown(x.name), sub: esc(fmt(d) + (x.notes ? ' · ' + shown(x.notes) : '')), right: (done ? chip(K('ui.lp-done-year', 'Done {y}', { y: y }), 'var(--ok)') : days(today(), d) <= (+x.lead || 14) ? when(d) : '') + tick('ladmindone', x.id, x.name) }; }
  });
  ACT.ladminseed = function () { seed('ladmin', adminSeed()); };
  ACT.ladmindone = function (id) { var y = new Date().getFullYear(); setList('ladmin', function (x) { if (x.id === id) x.doneY = +x.doneY === y ? 0 : y; }); };

  /* ================= Finances: Deal checks (are you still on a good deal?) ================= */
  var DEALK = [['power', K('ui.lp-deal-power', 'Power')], ['mobile', K('ui.lp-deal-mobile', 'Mobile')], ['internet', K('ui.lp-deal-net', 'Internet')], ['insurance', K('ui.lp-deal-ins', 'Insurance')], ['loan', K('ui.lp-deal-loan', 'Loan rate')], ['tv', K('ui.lp-deal-tv', 'TV and streaming')], ['other', K('ui.other', 'Other')]];
  var DEALW = { power: 'strompris.no', mobile: 'finn.no/mobilabonnement', internet: 'finn.no/bredband', insurance: 'finn.no/forsikring', loan: 'finansportalen.no' };
  card('deals', { icon: 'arrow-left-right', title: K('ui.lp-deals', 'Deal checks'), addTitle: K('ui.lp-deals-add', 'A deal to keep an eye on'), editTitle: K('ui.lp-edit', 'Edit'),
    fields: [{ k: 'who', type: 'title', label: K('ui.lp-provider', 'Who with'), req: true, ph: K('ui.lp-provider-ph', 'e.g. Tibber, Telia, If') }, { k: 'kind', type: 'select', label: K('ui.lp-kind', 'Kind'), options: DEALK, def: 'power' }, { k: 'price', type: 'number', label: K('ui.lp-per-month', 'Per month'), suffix: 'kr' }, { k: 'saved', type: 'number', label: K('ui.lp-saved-yr', 'Saved by switching (a year)'), suffix: 'kr' },
      { k: 'last', type: 'date', label: K('ui.lp-last-checked', 'Last compared'), def: today }, { k: 'every', type: 'select', label: K('ui.lp-compare-every', 'Compare every'), options: [[6, K('ui.lp-6m', '6 months')], [12, K('ui.lp-12m', 'Year')], [24, K('ui.lp-24m', '2 years')]], def: 12 }, { k: 'notes', type: 'textarea', rows: 2, label: K('ui.notes', 'Notes') }],
    beforeSave: function (it) { it.every = +it.every || 12; },
    empty: K('ui.lp-deals-empty', 'Power, mobile, internet, insurance, the loan rate: note what you pay and when you last compared. At a glance says when it’s time to look again – moving is often cheaper.'),
    summary: function (items) { var s = items.reduce(function (a, x) { return a + (+x.price || 0); }, 0), sv = items.reduce(function (a, x) { return a + (+x.saved || 0); }, 0); return s || sv ? '<p class="lp-sum">' + esc([s ? K('ui.lp-deals-sum', '{a} a month together', { a: kr(s) }) : '', sv ? K('ui.lp-deals-saved', 'switching saves you {a} a year', { a: kr(sv) }) : ''].filter(Boolean).join(' · ')) + '</p>' : ''; },
    sort: function (a, b) { return nextDue(a.last, a.every) < nextDue(b.last, b.every) ? -1 : 1; },
    row: function (x) { var d = nextDue(x.last, x.every), k = (DEALK.filter(function (q) { return q[0] === x.kind; })[0] || DEALK[6]); return { icon: { power: 'lightning-charge', mobile: 'phone', internet: 'wifi', insurance: 'shield-check', loan: 'bank', tv: 'tv' }[x.kind] || 'tag', color: 'var(--blue)', title: x.who, sub: esc([k[1], x.price ? kr(x.price) + K('ui.lp-mo', '/mo') : '', DEALW[x.kind] || ''].filter(Boolean).join(' · ')), right: (d <= today() ? chip(K('ui.lp-compare-now', 'Compare now'), 'var(--warn)') : chip(fmt(d), 'var(--slate)')) + tick('dealdone', x.id, K('ui.lp-compared', 'Compared')) }; }
  });
  ACT.dealdone = function (id) { var was; setList('deals', function (x) { if (x.id === id) { was = x.last; x.last = today(); } }); toast('<i class="bi bi-check2"></i> ' + esc(K('ui.lp-compared-toast', 'Marked as compared today')), function () { setList('deals', function (x) { if (x.id === id) x.last = was; }); }); };

  /* ================= Finances: Climate footprint (a rough estimate from what you spend) ================= */
  /* kg CO₂e per 1 000 kr, by category – broad averages for Norwegian households; a rough guide, not a measurement */
  var CO2 = { groceries: 45, eating: 35, transport: 70, shopping: 30, home: 25, fun: 15, health: 10, travel: 90, other: 20 };
  function drawClimate() {
    var el = $t('lp-climate'); if (!el) return;
    if (!Fe.on('climate')) { el.hidden = true; el.innerHTML = ''; return; }
    var d = Vault.get() || {}, t = new Date(), y1 = new Date(t.getFullYear() - 1, t.getMonth(), t.getDate()), y2 = new Date(t.getFullYear() - 2, t.getMonth(), t.getDate()), k1 = Fe.dkey(y1), k2 = Fe.dkey(y2), by = {}, now = 0, before = 0;
    (d.expenses || []).forEach(function (e) { if (!e || !e.date) return; var c = CO2[e.cat] != null ? e.cat : 'other', kg = (+e.amount || 0) / 1000 * CO2[c]; if (e.date >= k1) { now += kg; by[c] = (by[c] || 0) + kg; } else if (e.date >= k2) before += kg; });
    var top = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).slice(0, 3), name = function (c) { return window.FinCats ? FinCats.name(c) : c; };
    var tips = { travel: K('ui.lp-tip-travel', 'Travel weighs most: a train or a longer stay instead of several short flights.'), transport: K('ui.lp-tip-transport', 'Public transport, bike or walking for short trips.'), groceries: K('ui.lp-tip-food', 'Less meat and less food thrown away.'), eating: K('ui.lp-tip-eating', 'Eat out a bit less, choose vegetarian now and then.'), shopping: K('ui.lp-tip-shop', 'Buy used, repair, and keep things longer.'), home: K('ui.lp-tip-home', 'Lower the heat a degree, and use the cheap power hours.') };
    el.hidden = false;
    el.innerHTML = '<section class="card kit-card" id="lp-climate"><div class="card-head"><h2><i class="bi bi-globe-europe-africa"></i> ' + esc(K('ui.lp-climate', 'Climate footprint')) + '</h2><span class="muted">' + esc(K('ui.lp-12m-short', 'last 12 months')) + '</span></div>' +
      (now ? '<p class="lp-big"><b class="tnum">' + (now / 1000).toFixed(1).replace('.', NB() ? ',' : '.') + ' t</b> CO₂e' + (before ? ' <span class="' + (now <= before ? 'lp-good' : 'lp-bad') + '">' + (now <= before ? '−' : '+') + Math.abs(Math.round((now - before) / before * 100)) + ' %</span>' : '') + '</p>' +
        '<ul class="lp-bars">' + top.map(function (c) { return '<li><span>' + esc(name(c)) + '</span><i style="width:' + Math.round(by[c] / now * 100) + '%"></i><b class="tnum">' + Math.round(by[c]) + ' kg</b></li>'; }).join('') + '</ul>' +
        (tips[top[0]] ? '<p class="lp-tip"><i class="bi bi-lightbulb"></i> ' + esc(tips[top[0]]) + '</p>' : '') : '<p class="empty">' + esc(K('ui.lp-climate-empty', 'Once you have some spending logged, a rough estimate of its climate footprint shows here.')) + '</p>') +
      '<p class="muted lp-small">' + esc(K('ui.lp-climate-note', 'A rough estimate from what you spend in each category (average emissions per krone) – not a measurement. Flights and travel count the most.')) + '</p></section>';
  }

  /* ================= People: Celebrations ================= */
  var PARTYK = [['birthday', K('ui.lp-p-bday', 'Birthday')], ['christmas', K('ui.lp-p-xmas', 'Christmas')], ['dinner', K('ui.lp-p-dinner', 'Dinner party')], ['other', K('ui.other', 'Other')]];
  card('parties', { icon: 'balloon', title: K('ui.lp-parties', 'Celebrations'), addTitle: K('ui.lp-parties-add', 'Plan a celebration'), editTitle: K('ui.lp-edit', 'Edit'),
    fields: [{ k: 'title', type: 'title', label: K('ui.lp-what', 'What'), req: true, ph: K('ui.lp-parties-ph', 'e.g. My 30th, Christmas Eve') }, { k: 'kind', type: 'select', label: K('ui.lp-kind', 'Kind'), options: PARTYK, def: 'birthday' }, { k: 'date', type: 'date', label: K('ui.date', 'Date') },
      { k: 'budget', type: 'number', label: K('ui.lp-budget', 'Budget'), suffix: 'kr' }, { k: 'guests', type: 'textarea', rows: 2, label: K('ui.lp-guests', 'Guests') }, { k: 'menu', type: 'textarea', rows: 3, label: K('ui.lp-menu', 'Menu') }, { k: 'todo', type: 'textarea', rows: 4, label: K('ui.lp-todo', 'To do – one per line, [x] when done'), help: K('ui.lp-todo-help', 'e.g. [x] Book the room') }],
    empty: K('ui.lp-parties-empty', 'Birthdays, Christmas, dinners: the guests, the menu, the budget and what’s left to do in one place. At a glance reminds you two weeks before.'),
    sort: function (a, b) { return (a.date || '9') < (b.date || '9') ? -1 : 1; },
    row: function (x) { var L = String(x.todo || '').split('\n').filter(function (l) { return l.trim(); }), done = L.filter(function (l) { return /^\s*\[x\]/i.test(l); }).length, g = String(x.guests || '').split(/[\n,]/).filter(function (s) { return s.trim(); }).length;
      return { icon: 'balloon', color: 'var(--pink)', title: x.title, sub: esc([g ? K('ui.lp-n-guests', '{n} guests', { n: g }) : '', x.budget ? kr(x.budget) : '', L.length ? K('ui.lp-n-done', '{d} of {n} done', { d: done, n: L.length }) : ''].filter(Boolean).join(' · ')), right: isKey(x.date) && x.date < today() && x.date >= addDays(today(), -45) && !x.logged ? costBtn('partycost', x.id) : isKey(x.date) ? when(x.date) : '' }; }
  });

  /* ================= People: Big life moments (a ready checklist into your to-dos) ================= */
  var MOM = {
    moving: [S('Moving', 'Flytting'), 'box-seam', [[-30, S('Book a van or movers', 'Bestill flyttebil eller flyttebyrå')], [-30, S('Tell the landlord or housing association', 'Si fra til utleier eller borettslaget')], [-21, S('Move or cancel power and internet', 'Flytt eller si opp strøm og internett')], [-14, S('Report the move to the Population Register (Skatteetaten)', 'Meld flytting til Folkeregisteret (Skatteetaten)')], [-14, S('Order mail forwarding from Posten', 'Bestill ettersending fra Posten')], [-7, S('Update the home insurance', 'Oppdater innboforsikringen')], [0, S('Read the meters on moving day', 'Les av målerne på flyttedagen')], [7, S('Change address with the bank, employer and subscriptions', 'Endre adresse hos bank, arbeidsgiver og abonnementer')]]],
    job: [S('New job', 'Ny jobb'), 'briefcase', [[-30, S('Hand in your notice in writing', 'Lever oppsigelse skriftlig')], [-21, S('Read the contract: salary, pension, insurance, notice', 'Les kontrakten: lønn, pensjon, forsikring, oppsigelsestid')], [-14, S('Ask about holiday days you can take with you', 'Spør om feriedager du kan ta med deg')], [-7, S('Tell the bank which account the salary goes to', 'Gi beskjed om hvilken konto lønnen skal til')], [0, S('Set up flex time and the work calendar in cmd', 'Sett opp fleksitid og jobbkalender i cmd')], [14, S('Update your CV and LinkedIn', 'Oppdater CV og LinkedIn')]]],
    renovate: [S('Renovating', 'Oppussing'), 'hammer', [[-60, S('Get at least three quotes', 'Hent inn minst tre tilbud')], [-60, S('Check if you must apply to the municipality', 'Sjekk om du må søke kommunen')], [-45, S('Check the firm (org. number, references, wet-room approval)', 'Sjekk firmaet (org.nr., referanser, våtromsgodkjenning)')], [-30, S('Sign a written contract', 'Skriv en skriftlig kontrakt')], [-1, S('Take before photos', 'Ta bilder før')], [30, S('Keep receipts and the declaration of conformity (samsvarserklæring)', 'Ta vare på kvitteringer og samsvarserklæring')]]],
    wedding: [S('Wedding', 'Bryllup'), 'heart', [[-300, S('Book the venue', 'Book lokalet')], [-180, S('Book a photographer', 'Book fotograf')], [-120, S('Apply for the marriage check (prøving av ekteskapsvilkår)', 'Søk om prøving av ekteskapsvilkår')], [-90, S('Send the invitations', 'Send invitasjoner')], [-60, S('Order the rings', 'Bestill ringer')], [30, S('Update names, insurance and beneficiaries', 'Oppdater navn, forsikring og begunstigede')]]]
  };
  card('moments', { icon: 'signpost-2', title: K('ui.lp-moments', 'Big life moments'), addTitle: K('ui.lp-moments-add', 'Start a checklist'), editTitle: K('ui.lp-edit', 'Edit'),
    fields: [{ k: 'kind', type: 'select', label: K('ui.lp-moment', 'What'), options: function () { return Object.keys(MOM).map(function (k) { return [k, MOM[k][0]]; }); }, def: 'moving' }, { k: 'date', type: 'date', label: K('ui.lp-moment-date', 'The day it happens'), req: true }, { k: 'notes', type: 'textarea', rows: 2, label: K('ui.notes', 'Notes') }],
    afterSave: function (it, isNew) {
      if (!isNew || !MOM[it.kind] || !isKey(it.date)) return;
      var todos = []; try { todos = JSON.parse(localStorage.getItem('dash.todos')) || []; } catch (e) {}
      var ids = [], name = MOM[it.kind][0];
      MOM[it.kind][2].forEach(function (s) { var id = uid(), due = addDays(it.date, s[0]); if (due < today()) due = today(); ids.push(id); todos.push({ id: id, text: s[1] + ' (' + name + ')', done: false, due: due, list: 'lp:' + it.id }); });
      try { localStorage.setItem('dash.todos', JSON.stringify(todos)); } catch (e) {} window.dispatchEvent(new Event('dash:local'));
      setList('moments', function (x) { if (x.id === it.id) x.todos = ids; });
      toast('<i class="bi bi-list-check"></i> ' + esc(K('ui.lp-moments-added', '{n} to-dos added with dates', { n: ids.length })));
    },
    empty: K('ui.lp-moments-empty', 'Moving, a new job, renovating, a wedding: pick one and the day, and the steps go into your to-do list with dates.'),
    sort: function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; },
    row: function (x) { var M = MOM[x.kind] || ['', 'signpost-2'], T = []; try { T = JSON.parse(localStorage.getItem('dash.todos')) || []; } catch (e) {} var mine = T.filter(function (t) { return t.list === 'lp:' + x.id; }), d = mine.filter(function (t) { return t.done; }).length;
      return { icon: M[1], color: 'var(--violet)', title: M[0], sub: esc(fmt(x.date) + (mine.length ? ' · ' + K('ui.lp-n-done', '{d} of {n} done', { d: d, n: mine.length }) : '')), right: isKey(x.date) && x.date >= today() ? when(x.date) : '' }; }
  });

  /* ================= People: Family planning ================= */
  function familySeed(due) {
    var leave = addDays(due, -21), y = +due.slice(0, 4), kg = (+due.slice(5, 7) <= 11 ? y + 1 : y + 2) + '-03-01';
    return [[S('Tell your employer about the leave – at least 3 months before', 'Si fra til arbeidsgiver om permisjonen – senest 3 måneder før'), addMonths(leave, -3)], [S('Agree on 80 % or 100 % parental benefit', 'Bli enige om 80 % eller 100 % foreldrepenger'), addDays(leave, -70)],
      [S('Apply for parental benefit at NAV – NAV advises 4–6 weeks before', 'Søk om foreldrepenger hos NAV – NAV anbefaler 4–6 uker før'), addDays(leave, -42)], [S('Leave usually starts 3 weeks before the due date', 'Permisjonen starter vanligvis 3 uker før termin'), leave],
      [S('Check child benefit (barnetrygd) on NAV', 'Sjekk barnetrygd hos NAV'), addDays(due, 14)], [S('Add the child to your insurance', 'Legg barnet til i forsikringen'), addDays(due, 30)], [S('Apply for a kindergarten place – by 1 March', 'Søk barnehageplass – innen 1. mars'), kg]].map(function (x) { return { name: x[0], date: x[1], done: false }; });
  }
  card('family', { icon: 'balloon-heart', title: K('ui.lp-family', 'Family planning'), addTitle: K('ui.lp-family-add', 'Add a step'), editTitle: K('ui.lp-edit', 'Edit'),
    fields: [{ k: 'name', type: 'title', label: K('ui.lp-what', 'What'), req: true }, { k: 'date', type: 'date', label: K('ui.date', 'Date') }, { k: 'done', type: 'check', label: K('ui.lp-done', 'Done') }, { k: 'notes', type: 'textarea', rows: 2, label: K('ui.notes', 'Notes') }],
    empty: K('ui.lp-family-empty', 'Leave, NAV, kindergarten: put in the due date and get the steps with dates. The rules change – check nav.no for yours.'),
    above: function (items) { return items.length ? '' : '<div class="lp-start"><label>' + esc(K('ui.lp-due-date', 'Due date')) + ' <input type="date" data-lpfam-d></label><button type="button" class="pill-btn" data-lpact="famseed" data-lpid=""><i class="bi bi-list-check"></i> ' + esc(K('ui.lp-make-steps', 'Make the steps')) + '</button></div>'; },
    summary: function (items) { return items.length ? '<p class="muted lp-small">' + esc(K('ui.lp-family-note', 'Dates worked out from the due date. Check nav.no and your municipality for the rules that apply to you.')) + '</p>' : ''; },
    sort: function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0) || ((a.date || '9') < (b.date || '9') ? -1 : 1); },
    row: function (x) { return { icon: x.done ? 'check2-circle' : 'circle', color: x.done ? 'var(--ok)' : 'var(--pink)', cls: x.done ? 'lp-done' : '', title: x.name, sub: esc(fmt(x.date)), right: (!x.done && isKey(x.date) ? when(x.date) : '') + tick('famdone', x.id, x.name) }; }
  });
  ACT.famseed = function () { var v = (document.querySelector('[data-lpfam-d]') || {}).value; if (!isKey(v)) { toast(esc(K('ui.lp-pick-date', 'Pick the due date first'))); return; } seed('family', familySeed(v)); };
  ACT.famdone = function (id) { setList('family', function (x) { if (x.id === id) x.done = !x.done; }); };

  /* ================= People: Pets ================= */
  card('pets', { icon: 'heart', title: K('ui.lp-pets', 'Pets'), addTitle: K('ui.lp-pets-add', 'Add a pet'), editTitle: K('ui.lp-edit', 'Edit'),
    fields: [{ k: 'name', type: 'title', label: K('ui.lp-name', 'Name'), req: true }, { k: 'kind', label: K('ui.lp-animal', 'Animal'), ph: K('ui.lp-animal-ph', 'e.g. cat, dog') }, { k: 'vet', type: 'date', label: K('ui.lp-last-vet', 'Last vet check') }, { k: 'vetEvery', type: 'select', label: K('ui.lp-vet-every', 'Vet check every'), options: [[6, K('ui.lp-6m', '6 months')], [12, K('ui.lp-12m', 'Year')]], def: 12 },
      { k: 'vacc', type: 'date', label: K('ui.lp-next-vacc', 'Next vaccine') }, { k: 'worm', type: 'date', label: K('ui.lp-last-worm', 'Last worming / flea treatment') }, { k: 'wormEvery', type: 'select', label: K('ui.lp-every', 'Every'), options: [[1, K('ui.lp-1mo', 'Month')], [3, K('ui.lp-3m', '3 months')], [6, K('ui.lp-6m', '6 months')]], def: 3 },
      { k: 'food', type: 'date', label: K('ui.lp-food-date', 'Order food by') }, { k: 'notes', type: 'textarea', rows: 2, label: K('ui.lp-pet-notes', 'Notes – vet, insurance, chip number') }],
    beforeSave: function (it) { it.vetEvery = +it.vetEvery || 12; it.wormEvery = +it.wormEvery || 3; },
    empty: K('ui.lp-pets-empty', 'Vet checks, vaccines, worming and food – each pet with its dates, and At a glance tells you a week before.'),
    row: function (p) { var j = LP.petJobs(p)[0]; return { icon: 'heart', color: 'var(--orange)', title: p.name, sub: esc([p.kind, j ? j[1] : ''].filter(Boolean).join(' · ')), right: (j ? when(j[2]) : '') + costBtn('petcost', p.id) }; }
  });

  /* ================= People: Volunteering and clubs ================= */
  card('clubs', { icon: 'people', title: K('ui.lp-clubs', 'Clubs and volunteering'), addTitle: K('ui.lp-clubs-add', 'Add a club'), editTitle: K('ui.lp-edit', 'Edit'),
    fields: [{ k: 'name', type: 'title', label: K('ui.lp-name', 'Name'), req: true }, { k: 'role', label: K('ui.lp-role', 'Your role or duties') }, { k: 'meets', label: K('ui.lp-meets', 'When it meets'), ph: K('ui.lp-meets-ph', 'e.g. Tuesdays 18:00') }, { k: 'fee', type: 'number', label: K('ui.lp-fee', 'Membership fee'), suffix: 'kr' }, { k: 'feeDue', type: 'date', label: K('ui.lp-fee-due', 'Fee due') }, { k: 'notes', type: 'textarea', rows: 2, label: K('ui.notes', 'Notes') }],
    empty: K('ui.lp-clubs-empty', 'Teams, choirs, the board, volunteering: when it meets, what you’ve promised, and when the fee is due.'),
    summary: function (items) { var s = items.reduce(function (a, x) { return a + (+x.fee || 0); }, 0); return s ? '<p class="lp-sum">' + esc(K('ui.lp-fees-sum', '{a} in fees', { a: kr(s) })) + '</p>' : ''; },
    row: function (c) { return { icon: 'people', color: 'var(--violet)', title: c.name, sub: esc([c.role, c.meets].filter(Boolean).join(' · ')), right: isKey(c.feeDue) && days(today(), c.feeDue) <= 30 ? when(c.feeDue) : '' }; }
  });

  /* ================= Health: Sleep coach ================= */
  function drawSleep() {
    var el = $t('lp-sleep'); if (!el) return;
    if (!Fe.on('sleep')) { el.hidden = true; el.innerHTML = ''; return; }
    var c = LP.sleepCfg(), goal = LP.goalHours(c), D = window.AHealth && AHealth.days ? AHealth.days() || {} : {}, rows = [];
    for (var i = 7; i >= 1; i--) { var k = addDays(today(), -i + 1), v = D[k] && +D[k].sleep; rows.push([k, v > 0 ? v : null]); }
    var got = rows.filter(function (r) { return r[1]; }), avg = got.length ? got.reduce(function (a, r) { return a + r[1]; }, 0) / got.length : 0, max = Math.max(goal + 1, Math.max.apply(null, got.map(function (r) { return r[1]; }).concat([0])));
    var hm = function (h) { var m = Math.round(h * 60); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
    el.hidden = false;
    el.innerHTML = '<section class="card kit-card" id="lp-sleep"><div class="card-head"><h2><i class="bi bi-moon-stars"></i> ' + esc(K('ui.lp-sleep', 'Sleep coach')) + '</h2></div>' +
      '<div class="lp-sleepset"><label>' + esc(K('ui.lp-bed', 'Bedtime')) + ' <input type="time" data-lpsleep="bed" value="' + esc(c.bed) + '"></label><label>' + esc(K('ui.lp-wake', 'Wake up')) + ' <input type="time" data-lpsleep="wake" value="' + esc(c.wake) + '"></label><label class="lp-sw"><input type="checkbox" class="switch" data-lpsleep="remind"' + (c.remind ? ' checked' : '') + '> ' + esc(K('ui.lp-wind-push', 'Wind-down reminder 30 min before')) + '</label></div>' +
      '<p class="lp-sum">' + esc(K('ui.lp-goal', 'Goal {h} a night', { h: hm(goal) })) + (got.length ? ' · ' + esc(K('ui.lp-avg', 'last 7 nights {h}', { h: hm(avg) })) + ' <span class="' + (avg >= goal - .25 ? 'lp-good' : 'lp-bad') + '">' + (avg >= goal ? '+' : '−') + hm(Math.abs(avg - goal)) + '</span>' : '') + '</p>' +
      (got.length ? '<div class="lp-nights">' + rows.map(function (r) { return '<span title="' + esc(fmt(r[0]) + (r[1] ? ' · ' + hm(r[1]) : '')) + '"><i style="height:' + (r[1] ? Math.round(r[1] / max * 100) : 2) + '%;background:' + (!r[1] ? 'rgba(var(--ink-rgb),.15)' : r[1] >= goal - .25 ? 'var(--ok)' : 'var(--warn)') + '"></i><small>' + esc(Fe.fromKey(r[0]).toLocaleDateString(NB() ? 'nb-NO' : 'en-GB', { weekday: 'narrow' })) + '</small></span>'; }).join('') + '<b class="lp-goalline" style="bottom:' + Math.round(goal / max * 100) + '%"></b></div>'
        : '<p class="empty">' + esc(K('ui.lp-sleep-empty', 'Your nights show here when Apple Health sends sleep (Settings → Apple Health).')) + '</p>') + '</section>';
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.matches || !t.matches('[data-lpsleep]')) return;
    var tl = Fe.tools(), c = Object.assign({}, LP.sleepCfg()); if (t.dataset.lpsleep === 'remind') c.remind = t.checked; else if (/^\d{2}:\d{2}$/.test(t.value)) c[t.dataset.lpsleep] = t.value;
    tl.sleepcfg = c; Fe.saveTools(tl); drawSleep(); try { if (window.Notify && Notify.sync) Notify.sync(); } catch (x) {}
  });

  /* ================= Health: Calm (a minute of breathing, and how you feel) ================= */
  function drawCalm() {
    var el = $t('lp-calm'); if (!el) return;
    if (!Fe.on('calm')) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = '<section class="card kit-card" id="lp-calm"><div class="card-head"><h2><i class="bi bi-wind"></i> ' + esc(K('ui.lp-calm', 'Mind and rest')) + '</h2></div>' +
      '<p class="muted">' + esc(K('ui.lp-calm-sub', 'One minute: breathe in for 4, hold for 4, out for 6.')) + '</p><div class="lp-acts"><button type="button" class="pill-btn" data-lpact="breathe" data-lpid=""><i class="bi bi-wind"></i> ' + esc(K('ui.lp-breathe', 'Breathe for a minute')) + '</button>' +
      (Fe.on('journal') ? '<a class="text-btn" href="#journal"><i class="bi bi-emoji-smile"></i> ' + esc(K('ui.lp-mood', 'How are you today?')) + '</a>' : '') + '</div></section>';
  }
  ACT.breathe = function () {
    var ov = document.createElement('div'); ov.className = 'lp-breath'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="lp-bcirc"></div><p class="lp-btxt" aria-live="polite"></p><button type="button" class="text-btn" data-lpbx>' + esc(K('ui.close', 'Close')) + '</button>';
    document.body.appendChild(ov);
    var txt = ov.querySelector('.lp-btxt'), circ = ov.querySelector('.lp-bcirc'), t0 = Date.now(), still = document.documentElement.classList.contains('reduce-motion') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var step = function () {
      if (!ov.isConnected) return; var s = ((Date.now() - t0) / 1000) % 14, el = (Date.now() - t0) / 1000;
      if (el >= 60) { txt.textContent = K('ui.lp-breath-done', 'Well done.'); circ.style.transform = 'scale(.6)'; return; }
      var ph = s < 4 ? [K('ui.lp-in', 'Breathe in'), .6 + .4 * s / 4] : s < 8 ? [K('ui.lp-hold', 'Hold'), 1] : [K('ui.lp-out', 'Breathe out'), 1 - .4 * (s - 8) / 6];
      txt.textContent = ph[0]; if (!still) circ.style.transform = 'scale(' + ph[1].toFixed(3) + ')'; setTimeout(step, 100);
    };
    step();
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-lpbx]')) ov.remove(); });
  };

  /* ================= Health: Books, films and games ================= */
  var MEDK = [['book', K('ui.lp-m-book', 'Book')], ['film', K('ui.lp-m-film', 'Film')], ['series', K('ui.lp-m-series', 'Series')], ['game', K('ui.lp-m-game', 'Game')], ['podcast', K('ui.lp-m-pod', 'Podcast')]];
  var MEDS = [['want', K('ui.lp-m-want', 'Want to')], ['now', K('ui.lp-m-now', 'On it now')], ['done', K('ui.lp-m-done', 'Finished')]];
  card('media', { icon: 'collection-play', title: K('ui.lp-media', 'Books, films and games'), addTitle: K('ui.lp-media-add', 'Add'), editTitle: K('ui.lp-edit', 'Edit'), limit: 10,
    fields: [{ k: 'title', type: 'title', label: K('ui.lp-title', 'Title'), req: true }, { k: 'kind', type: 'select', label: K('ui.lp-kind', 'Kind'), options: MEDK, def: 'book' }, { k: 'status', type: 'select', label: K('ui.lp-status', 'Status'), options: MEDS, def: 'want' }, { k: 'by', label: K('ui.lp-by', 'By / where to watch') },
      { k: 'rating', type: 'select', label: K('ui.lp-rating', 'Rating'), options: [['', '–'], [1, '★'], [2, '★★'], [3, '★★★'], [4, '★★★★'], [5, '★★★★★']] }, { k: 'notes', type: 'textarea', rows: 2, label: K('ui.notes', 'Notes') }],
    empty: K('ui.lp-media-empty', 'What you’re reading, watching or playing now, what you want to next, and what you thought of it.'),
    summary: function (items) { var n = items.filter(function (x) { return x.status === 'now'; }).length, y = new Date().getFullYear(), d = items.filter(function (x) { return x.status === 'done' && String(x.doneAt || '').slice(0, 4) === String(y); }).length; return items.length ? '<p class="lp-sum">' + esc(K('ui.lp-media-sum', '{n} on the go · {d} finished this year', { n: n, d: d })) + '</p>' : ''; },
    beforeSave: function (it) { if (it.status === 'done' && !it.doneAt) it.doneAt = today(); if (it.status !== 'done') delete it.doneAt; it.rating = it.rating ? +it.rating : ''; },
    sort: function (a, b) { var o = { now: 0, want: 1, done: 2 }; return (o[a.status] || 0) - (o[b.status] || 0); },
    row: function (x) { var k = MEDK.filter(function (q) { return q[0] === x.kind; })[0] || MEDK[0], s = MEDS.filter(function (q) { return q[0] === x.status; })[0] || MEDS[0];
      return { icon: { book: 'book', film: 'film', series: 'tv', game: 'controller', podcast: 'mic' }[x.kind] || 'book', color: x.status === 'now' ? 'var(--accent)' : 'var(--slate)', cls: x.status === 'done' ? 'lp-done' : '', title: x.title, sub: esc([k[1], x.by, x.rating ? '★'.repeat(+x.rating) : ''].filter(Boolean).join(' · ')), right: chip(s[1], x.status === 'now' ? 'var(--accent)' : 'var(--slate)') }; }
  });

  /* ================= Health: Read and watch later ================= */
  card('later', { icon: 'bookmark', title: K('ui.lp-later', 'Read and watch later'), addTitle: K('ui.lp-later-add', 'Save a link'), editTitle: K('ui.lp-edit', 'Edit'), limit: 10,
    fields: [{ k: 'url', type: 'url', label: K('ui.lp-link', 'Link'), req: true, ph: 'https://' }, { k: 'title', type: 'title', label: K('ui.lp-title', 'Title'), ph: K('ui.lp-later-ph', 'What it is (optional)') }, { k: 'read', type: 'check', label: K('ui.lp-read', 'Read / watched') }],
    beforeSave: function (it) { it.url = String(it.url || '').trim(); if (it.url && !/^https?:\/\//i.test(it.url)) it.url = 'https://' + it.url; if (!it.title) { try { it.title = new URL(it.url).hostname.replace(/^www\./, ''); } catch (e) { it.title = it.url; } } },
    empty: K('ui.lp-later-empty', 'Save articles, videos and podcasts to get to later. On Sundays At a glance reminds you what’s waiting.'),
    sort: function (a, b) { return (a.read ? 1 : 0) - (b.read ? 1 : 0); },
    row: function (x) { var h = ''; try { h = new URL(x.url).hostname.replace(/^www\./, ''); } catch (e) {} return { icon: x.read ? 'bookmark-check' : 'bookmark', color: x.read ? 'var(--ok)' : 'var(--blue)', cls: x.read ? 'lp-done' : '', title: x.title || x.url, sub: esc(h), right: '<a class="icon-btn sm lp-open" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(K('ui.lp-open', 'Open')) + '" data-lpopen="' + esc(x.id) + '"><i class="bi bi-box-arrow-up-right"></i></a>' + tick('laterread', x.id, K('ui.lp-read', 'Read / watched')) }; }
  });
  ACT.laterread = function (id) { setList('later', function (x) { if (x.id === id) x.read = !x.read; }); };
  document.addEventListener('click', function (e) { var a = e.target.closest('[data-lpopen]'); if (a) e.stopPropagation(); }, true);

  /* ================= Health: Digital life ================= */
  function digitalSeed() {
    return [[S('Check that your photos are backed up', 'Sjekk at bildene er sikkerhetskopiert'), 1], [S('Update the phone, computer and apps', 'Oppdater telefon, PC og apper'), 1], [S('Free up storage on the phone', 'Rydd lagringsplass på telefonen'), 3],
      [S('Turn on two-step login everywhere', 'Slå på totrinnsinnlogging overalt'), 12], [S('Change passwords you use in more than one place', 'Bytt passord du bruker flere steder'), 12], [S('Close accounts you no longer use', 'Slett kontoer du ikke bruker lenger'), 12],
      [S('Check who you share albums and documents with', 'Sjekk hvem du deler album og dokumenter med'), 12]].map(function (x) { return { name: x[0], every: x[1], last: '' }; });
  }
  card('digital', { icon: 'shield-lock', title: K('ui.lp-digital', 'Digital life'), addTitle: K('ui.lp-digital-add', 'A digital chore'), editTitle: K('ui.lp-edit', 'Edit'),
    fields: [{ k: 'name', type: 'title', label: K('ui.lp-what', 'What'), req: true }, { k: 'every', type: 'select', label: K('ui.lp-every', 'Every'), options: [[1, K('ui.lp-1mo', 'Month')], [3, K('ui.lp-3m', '3 months')], [6, K('ui.lp-6m', '6 months')], [12, K('ui.lp-12m', 'Year')]], def: 3 }, { k: 'last', type: 'date', label: K('ui.lp-last-done', 'Last done') }],
    beforeSave: function (it) { it.every = +it.every || 3; },
    empty: K('ui.lp-digital-empty', 'Backups, updates, passwords, old accounts – the digital chores that keep your things safe, with a reminder when each is due.'),
    above: function (items) { return items.length ? '' : '<div class="lp-start"><button type="button" class="pill-btn" data-lpact="digseed" data-lpid=""><i class="bi bi-list-check"></i> ' + esc(K('ui.lp-start-usual', 'Start with the usual ones')) + '</button></div>'; },
    sort: function (a, b) { return nextDue(a.last, a.every) < nextDue(b.last, b.every) ? -1 : 1; },
    row: function (x) { var d = nextDue(x.last, x.every); return { icon: 'shield-lock', color: d <= today() ? 'var(--warn)' : 'var(--ok)', title: x.name, sub: esc(x.last ? K('ui.lp-last', 'Last {d}', { d: fmt(x.last) }) : K('ui.lp-never', 'Not done yet')), right: (d <= today() ? chip(K('ui.lp-due', 'Due'), 'var(--warn)') : chip(fmt(d), 'var(--slate)')) + tick('digdone', x.id, x.name) }; }
  });
  ACT.digseed = function () { seed('digital', digitalSeed()); };
  ACT.digdone = function (id) { var was; setList('digital', function (x) { if (x.id === id) { was = x.last; x.last = today(); } }); toast('<i class="bi bi-check2"></i> ' + esc(K('ui.lp-done-today', 'Done today')), function () { setList('digital', function (x) { if (x.id === id) x.last = was; }); }); };

  /* ================= Work: Career ================= */
  var CARK = [['win', K('ui.lp-c-win', 'Something I achieved')], ['salary', K('ui.lp-c-salary', 'Salary')], ['course', K('ui.lp-c-course', 'Course or certificate')], ['application', K('ui.lp-c-app', 'Job application')], ['contact', K('ui.lp-c-contact', 'Contact')]];
  card('career', { icon: 'graph-up-arrow', title: K('ui.lp-career', 'Career'), addTitle: K('ui.lp-career-add', 'Add to your career log'), editTitle: K('ui.lp-edit', 'Edit'),
    fields: [{ k: 'title', type: 'title', label: K('ui.lp-what', 'What'), req: true }, { k: 'kind', type: 'select', label: K('ui.lp-kind', 'Kind'), options: CARK, def: 'win' }, { k: 'date', type: 'date', label: K('ui.date', 'Date'), def: today }, { k: 'amount', type: 'number', label: K('ui.lp-salary-year', 'Salary a year (for Salary)'), suffix: 'kr' }, { k: 'notes', type: 'textarea', rows: 3, label: K('ui.notes', 'Notes') }],
    empty: K('ui.lp-career-empty', 'Write down what you achieve as it happens, your salary over the years and the jobs you apply for – it makes the salary talk and the next CV easy.'),
    headExtra: function (items) { return items.some(function (x) { return x.kind === 'win'; }) ? '<button type="button" class="text-btn" data-lpact="salarytalk" data-lpid=""><i class="bi bi-chat-square-text"></i> ' + esc(K('ui.lp-salary-talk', 'Salary talk')) + '</button>' : ''; },
    summary: function (items) { var s = items.filter(function (x) { return x.kind === 'salary' && +x.amount; }).sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; }); if (!s.length) return ''; var l = s[s.length - 1], p = s[s.length - 2];
      return '<p class="lp-sum">' + esc(K('ui.lp-salary-now', 'Salary {a}', { a: kr(l.amount) })) + (p && +p.amount ? ' <span class="' + (+l.amount >= +p.amount ? 'lp-good' : 'lp-bad') + '">' + (+l.amount >= +p.amount ? '+' : '−') + Math.abs(Math.round((l.amount - p.amount) / p.amount * 1000) / 10) + ' %</span>' : '') + '</p>'; },
    sort: function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; },
    row: function (x) { var k = CARK.filter(function (q) { return q[0] === x.kind; })[0] || CARK[0]; return { icon: { win: 'trophy', salary: 'cash-stack', course: 'mortarboard', application: 'send', contact: 'person-lines-fill' }[x.kind] || 'star', color: 'var(--gold, #c8901e)', title: x.title, sub: esc([k[1], fmt(x.date), x.amount ? kr(x.amount) : ''].filter(Boolean).join(' · ')), right: '' }; }
  });
  ACT.salarytalk = function () {
    var y = String(new Date().getFullYear() - (new Date().getMonth() < 2 ? 1 : 0)), w = Fe.list('career').filter(function (x) { return x.kind === 'win' && String(x.date || '') >= (+y - 1) + '-' + String(new Date().getMonth() + 1).padStart(2, '0'); });
    var txt = K('ui.lp-salary-intro', 'What I achieved this last year:') + '\n' + w.map(function (x) { return '– ' + x.title + (x.notes ? ': ' + x.notes : ''); }).join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('<i class="bi bi-clipboard-check"></i> ' + esc(K('ui.lp-copied', 'Copied – paste it into your notes for the talk'))); }, function () { if (window.Ask) Ask.alert(txt); });
  };

  /* ================= Travel: Outdoors ================= */
  var OUTK = [['hike', K('ui.lp-o-hike', 'Hike')], ['ski', K('ui.lp-o-ski', 'Skiing')], ['cabin', K('ui.lp-o-cabin', 'Cabin trip')], ['bike', K('ui.lp-o-bike', 'Bike ride')], ['paddle', K('ui.lp-o-paddle', 'Paddling')], ['swim', K('ui.lp-o-swim', 'Swim')], ['other', K('ui.other', 'Other')]];
  card('outdoor', { icon: 'tree', title: K('ui.lp-outdoor', 'Outdoors'), addTitle: K('ui.lp-outdoor-add', 'A trip outdoors'), editTitle: K('ui.lp-edit', 'Edit'),
    fields: [{ k: 'title', type: 'title', label: K('ui.lp-what', 'What'), req: true, ph: K('ui.lp-outdoor-ph', 'e.g. Kolsåstoppen, Ullevålseter') }, { k: 'kind', type: 'select', label: K('ui.lp-kind', 'Kind'), options: OUTK, def: 'hike' }, { k: 'date', type: 'date', label: K('ui.date', 'Date') }, { k: 'place', label: K('ui.lp-where', 'Where') },
      { k: 'km', type: 'number', label: K('ui.lp-km', 'Distance'), suffix: 'km' }, { k: 'done', type: 'check', label: K('ui.lp-been', 'Done it') }, { k: 'notes', type: 'textarea', rows: 2, label: K('ui.lp-out-notes', 'Notes – what to bring, the cabin, how it was') }],
    empty: K('ui.lp-outdoor-empty', 'Hikes, ski trips and cabin weekends – the ones you want to do and the ones you’ve done, with the distance. At a glance reminds you to check the weather.'),
    summary: function (items) { var y = String(new Date().getFullYear()), d = items.filter(function (x) { return x.done && String(x.date || '').slice(0, 4) === y; }), km = d.reduce(function (a, x) { return a + (+x.km || 0); }, 0); return d.length ? '<p class="lp-sum">' + esc(K('ui.lp-out-sum', '{n} trips this year · {k} km', { n: d.length, k: nf(km) })) + ' · <a href="https://ut.no" target="_blank" rel="noopener">ut.no</a> · <a href="https://www.yr.no" target="_blank" rel="noopener">yr.no</a></p>' : ''; },
    sort: function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0) || ((a.date || '9') < (b.date || '9') ? (a.done ? 1 : -1) : (a.done ? -1 : 1)); },
    row: function (x) { var k = OUTK.filter(function (q) { return q[0] === x.kind; })[0] || OUTK[0]; return { icon: { hike: 'signpost', ski: 'snow', cabin: 'house', bike: 'bicycle', paddle: 'water', swim: 'water' }[x.kind] || 'tree', color: 'var(--ok)', cls: x.done ? 'lp-done' : '', title: x.title, sub: esc([k[1], x.place, x.km ? x.km + ' km' : '', x.done && x.date ? fmt(x.date) : ''].filter(Boolean).join(' · ')), right: !x.done && isKey(x.date) && x.date >= today() ? when(x.date) : x.done ? chip(K('ui.lp-been-short', 'Done'), 'var(--ok)') : '' }; }
  });
  function nf(n) { return new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 }).format(n); }

  /* ================= Me: Mood check-in (one tap a day – it is the journal's mood, so nothing is kept twice) ================= */
  var MOODV = [[1, K('ui.lp-md-1', 'Bad'), 'emoji-frown', 'var(--danger)'], [2, K('ui.lp-md-2', 'Meh'), 'emoji-neutral', 'var(--orange)'], [3, K('ui.lp-md-3', 'OK'), 'emoji-smile', 'var(--gold)'], [4, K('ui.lp-md-4', 'Good'), 'emoji-laughing', 'var(--ok)'], [5, K('ui.lp-md-5', 'Great'), 'emoji-heart-eyes', '#14b8a6']];
  function moodOf(v) { return MOODV[(Math.round(+v) || 3) - 1] || MOODV[2]; }
  function moodsBy() { var by = {}; (Fe.tools().journal || []).forEach(function (j) { if (+j.mood >= 1 && +j.mood <= 5) by[j.date] = +j.mood; }); return by; }
  function drawMood() {
    var el = $t('lp-mood'); if (!el) return;
    if (!Fe.on('mood')) { el.hidden = true; el.innerHTML = ''; return; }
    var by = moodsBy(), t = today(), D = window.AHealth && AHealth.days ? AHealth.days() || {} : {}, goal = LP.goalHours(LP.sleepCfg()), cells = '', good = [], short = [];
    for (var i = 13; i >= 0; i--) {
      var k = addDays(t, -i), m = by[k], sl = D[k] && +D[k].sleep;
      cells += '<span title="' + esc(fmt(k) + (m ? ' · ' + moodOf(m)[1] : '') + (sl ? ' · ' + nf(sl) + ' h' : '')) + '"><i style="background:' + (m ? moodOf(m)[3] : 'rgba(var(--ink-rgb),.12)') + '"></i><small>' + (sl ? nf(Math.round(sl * 2) / 2) : '') + '</small></span>';
    }
    Object.keys(by).forEach(function (k) { var sl = D[k] && +D[k].sleep; if (sl > 0) (sl >= goal - .5 ? good : short).push(by[k]); });
    var avg = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
    var tip = good.length >= 3 && short.length >= 3 ? K('ui.lp-md-tip', 'After enough sleep you feel {a} – after short nights {b}.', { a: moodOf(avg(good))[1].toLowerCase(), b: moodOf(avg(short))[1].toLowerCase() }) : K('ui.lp-md-tip0', 'With a few days of mood and sleep you’ll see how your nights affect your days.');
    el.hidden = false;
    el.innerHTML = '<section class="card kit-card" id="lp-mood"><div class="card-head"><h2><i class="bi bi-emoji-smile"></i> ' + esc(K('ui.lp-mood-t', 'Mood check-in')) + '</h2></div>' +
      '<p class="lp-sum">' + esc(K('ui.lp-mood', 'How are you today?')) + '</p><div class="lp-moods">' + MOODV.map(function (m) { return '<button type="button" class="lp-mdb' + (by[t] === m[0] ? ' on' : '') + '" style="--c:' + m[3] + '" data-lpact="mood" data-lpid="' + m[0] + '" aria-pressed="' + (by[t] === m[0]) + '"><i class="bi bi-' + m[2] + '"></i><small>' + esc(m[1]) + '</small></button>'; }).join('') + '</div>' +
      '<div class="lp-mdstrip" aria-label="' + esc(K('ui.lp-md-14', 'Last 14 days – mood, and hours of sleep under it')) + '">' + cells + '</div><p class="lp-sum">' + esc(tip) + '</p></section>';
  }
  ACT.mood = function (v) {
    var t = Fe.tools(), l = Array.isArray(t.journal) ? t.journal : [], k = today(), j = l.filter(function (x) { return x.date === k; })[0];
    if (j) j.mood = String(v); else l.push({ id: uid(), date: k, mood: String(v), line: '' });
    t.journal = l; Fe.saveTools(t); drawMood();
  };

  /* ================= Me: Life wheel (score the parts of life every few months) ================= */
  var AREAS = [['health', K('ui.lp-w-health', 'Health')], ['money', K('ui.lp-w-money', 'Money')], ['work', K('ui.lp-w-work', 'Work')], ['love', K('ui.lp-w-love', 'Love')], ['people', K('ui.lp-w-people', 'Family & friends')], ['fun', K('ui.lp-w-fun', 'Fun')], ['home', K('ui.lp-w-home', 'Home')], ['growth', K('ui.lp-w-growth', 'Growing')]];
  var wheelForm = false;
  function wheels() { return (Fe.tools().wheel || []).filter(function (w) { return w && isKey(w.date) && w.s; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }
  function wheelSvg(cur, prev) {
    var R = 80, C = 110, n = AREAS.length, pt = function (i, v) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [C + Math.cos(a) * R * v / 10, C + Math.sin(a) * R * v / 10]; };
    var poly = function (w) { return AREAS.map(function (a, i) { return pt(i, +w.s[a[0]] || 0).map(function (x) { return x.toFixed(1); }).join(','); }).join(' '); };
    var g = '';
    [2.5, 5, 7.5, 10].forEach(function (r) { g += '<polygon points="' + AREAS.map(function (a, i) { return pt(i, r).join(','); }).join(' ') + '" fill="none" stroke="rgba(var(--ink-rgb),.12)"/>'; });
    AREAS.forEach(function (a, i) { var p = pt(i, 10), q = pt(i, 12.4); g += '<line x1="' + C + '" y1="' + C + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="rgba(var(--ink-rgb),.12)"/><text x="' + q[0].toFixed(1) + '" y="' + (q[1] + 4).toFixed(1) + '" text-anchor="middle">' + esc(a[1]) + '</text>'; });
    if (prev) g += '<polygon points="' + poly(prev) + '" fill="none" stroke="rgba(var(--ink-rgb),.45)" stroke-dasharray="4 3"/>';
    g += '<polygon points="' + poly(cur) + '" fill="rgba(var(--accent-rgb),.22)" stroke="var(--accent)" stroke-width="2"/>';
    return '<svg class="lp-wheel" viewBox="-30 0 280 220" role="img" aria-label="' + esc(K('ui.lp-wheel', 'Life wheel')) + '">' + g + '</svg>';
  }
  function drawWheel() {
    var el = $t('lp-wheel'); if (!el) return;
    if (!Fe.on('wheel')) { el.hidden = true; el.innerHTML = ''; return; }
    var ws = wheels(), cur = ws[ws.length - 1], prev = ws[ws.length - 2], body;
    if (wheelForm || !cur) {
      var base = cur ? cur.s : {};
      body = (cur ? '' : '<p class="muted">' + esc(K('ui.lp-wheel-intro', 'Give each part of your life a score from 1 to 10 – how it feels now, not how it should be. Do it again every few months and see what moves.')) + '</p>') +
        (wheelForm ? '<div class="lp-wform">' + AREAS.map(function (a) { var v = +base[a[0]] || 5; return '<label><span>' + esc(a[1]) + '</span><input type="range" min="1" max="10" step="1" value="' + v + '" data-lpwheel="' + a[0] + '"><b>' + v + '</b></label>'; }).join('') + '</div><div class="lp-acts"><button type="button" class="pill-btn" data-lpact="wheelsave" data-lpid=""><i class="bi bi-check-lg"></i> ' + esc(K('ui.save', 'Save')) + '</button><button type="button" class="text-btn" data-lpact="wheelform" data-lpid="">' + esc(K('ui.cancel', 'Cancel')) + '</button></div>'
          : '<div class="lp-acts"><button type="button" class="pill-btn" data-lpact="wheelform" data-lpid=""><i class="bi bi-bullseye"></i> ' + esc(K('ui.lp-wheel-go', 'Score now')) + '</button></div>');
    } else {
      var low = AREAS.slice().sort(function (a, b) { return (+cur.s[a[0]] || 0) - (+cur.s[b[0]] || 0); })[0];
      body = wheelSvg(cur, prev) + '<p class="lp-sum">' + esc(K('ui.lp-wheel-last', 'Scored {d}', { d: fmt(cur.date) + ' ' + cur.date.slice(0, 4) })) + (prev ? ' · ' + esc(K('ui.lp-wheel-prev', 'dashed line: {d}', { d: fmt(prev.date) + ' ' + prev.date.slice(0, 4) })) : '') + '<br>' +
        esc(K('ui.lp-wheel-low', 'Lowest now: {a} ({n}) – a good place to start.', { a: low[1], n: +cur.s[low[0]] || 0 })) + '</p><div class="lp-acts"><button type="button" class="text-btn" data-lpact="wheelform" data-lpid=""><i class="bi bi-arrow-repeat"></i> ' + esc(K('ui.lp-wheel-again', 'Score again')) + '</button></div>';
    }
    el.hidden = false;
    el.innerHTML = '<section class="card kit-card" id="lp-wheel"><div class="card-head"><h2><i class="bi bi-bullseye"></i> ' + esc(K('ui.lp-wheel', 'Life wheel')) + '</h2></div>' + body + '</section>';
  }
  document.addEventListener('input', function (e) { var r = e.target; if (r.matches && r.matches('[data-lpwheel]') && r.nextElementSibling) r.nextElementSibling.textContent = r.value; });
  ACT.wheelform = function () { wheelForm = !wheelForm; drawWheel(); };
  ACT.wheelsave = function () {
    var s = {}; document.querySelectorAll('[data-lpwheel]').forEach(function (r) { s[r.dataset.lpwheel] = Math.max(1, Math.min(10, +r.value || 5)); });
    var t = Fe.tools(), l = (Array.isArray(t.wheel) ? t.wheel : []).filter(function (w) { return w.date !== today(); });
    l.push({ id: uid(), date: today(), s: s }); t.wheel = l; wheelForm = false; Fe.saveTools(t); drawWheel();
  };

  /* ================= Me: Wins & gratitude (three good things a week, a look back in December) ================= */
  var WINK = [['win', K('ui.lp-wn-win', 'A win')], ['thanks', K('ui.lp-wn-thanks', 'Grateful for')]];
  var winYear = false;
  function monKey() { return addDays(today(), -((Fe.fromKey(today()).getDay() + 6) % 7)); }   /* this week's Monday */
  card('wins', { icon: 'trophy', title: K('ui.lp-wins', 'Wins & gratitude'), addTitle: K('ui.lp-wins-add', 'Something good'), editTitle: K('ui.lp-edit', 'Edit'), limit: 6,
    fields: [{ k: 'title', type: 'title', label: K('ui.lp-wins-what', 'What was good'), req: true, ph: K('ui.lp-wins-ph', 'e.g. Finished the report, a walk with Mum') }, { k: 'kind', type: 'select', label: K('ui.lp-kind', 'Kind'), options: WINK, def: 'win' }, { k: 'date', type: 'date', label: K('ui.date', 'Date'), def: today }],
    empty: K('ui.lp-wins-empty', 'Three good things a week – something you did well, or something you’re grateful for. In December you get your year back.'),
    sort: function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; },
    summary: function (items) {
      var mk = monKey(), wk = items.filter(function (x) { return (x.date || '') >= mk; }).length, y = today().slice(0, 4), yr = items.filter(function (x) { return String(x.date || '').slice(0, 4) === y; });
      var h = items.length ? '<p class="lp-sum"><span class="lp-dots">' + [0, 1, 2].map(function (i) { return '<i class="' + (i < wk ? 'on' : '') + '"></i>'; }).join('') + '</span> ' + esc(K('ui.lp-wins-wk', '{n} of 3 this week', { n: Math.min(wk, 3) })) + (+today().slice(5, 7) === 12 && yr.length ? ' · <span role="button" tabindex="0" class="text-btn lp-act" data-lpact="winyear" data-lpid="">' + esc(winYear ? K('ui.lp-wins-hide', 'Hide your year') : K('ui.lp-wins-year', 'Your year: {n} good things', { n: yr.length })) + '</span>' : '') + '</p>' : '';
      if (winYear && yr.length) {
        var by = {}; yr.forEach(function (x) { var m = +x.date.slice(5, 7); (by[m] = by[m] || []).push(x); });
        h += '<div class="lp-year">' + Object.keys(by).sort(function (a, b) { return a - b; }).map(function (m) { return '<p><b>' + esc(new Date(+y, m - 1, 1).toLocaleDateString(NB() ? 'nb-NO' : 'en-GB', { month: 'long' })) + '</b> ' + by[m].map(function (x) { return esc(x.title); }).join(' · ') + '</p>'; }).join('') + '</div>';
      }
      return h;
    },
    row: function (x) { return { icon: x.kind === 'thanks' ? 'heart' : 'trophy', color: x.kind === 'thanks' ? 'var(--pink)' : 'var(--gold)', title: x.title, sub: esc([(WINK.filter(function (q) { return q[0] === x.kind; })[0] || WINK[0])[1], fmt(x.date)].filter(Boolean).join(' · ')) }; }
  });
  ACT.winyear = function () { winYear = !winYear; window.dispatchEvent(new Event('tools:change')); };

  /* ================= Me: Hobbies & projects ================= */
  var HOBK = [['build', K('ui.lp-h-build', 'Building')], ['practice', K('ui.lp-h-practice', 'Practising')], ['learn', K('ui.lp-h-learn', 'Learning')], ['make', K('ui.lp-h-make', 'Making')], ['play', K('ui.lp-h-play', 'Playing')], ['other', K('ui.other', 'Other')]];
  var HOBS = [['active', K('ui.lp-h-active', 'Going')], ['paused', K('ui.lp-h-paused', 'Paused')], ['done', K('ui.lp-h-done', 'Finished')]];
  card('hobbies', { icon: 'palette', title: K('ui.lp-hobbies', 'Hobbies & projects'), addTitle: K('ui.lp-hob-add', 'A hobby or project'), editTitle: K('ui.lp-edit', 'Edit'),
    fields: [{ k: 'title', type: 'title', label: K('ui.lp-what', 'What'), req: true, ph: K('ui.lp-hob-ph', 'e.g. Guitar, a bookshelf, Spanish') }, { k: 'kind', type: 'select', label: K('ui.lp-kind', 'Kind'), options: HOBK, def: 'practice' }, { k: 'status', type: 'select', label: K('ui.lp-status', 'Status'), options: HOBS, def: 'active' },
      { k: 'next', label: K('ui.lp-hob-next', 'Next step'), ph: K('ui.lp-hob-next-ph', 'The very next thing to do') }, { k: 'hrs', type: 'number', label: K('ui.lp-hob-hrs', 'Time so far'), suffix: 'h' }, { k: 'notes', type: 'textarea', rows: 2, label: K('ui.notes', 'Notes') }],
    empty: K('ui.lp-hob-empty', 'What you build, practise or learn for fun – the next step, and the time you’ve put in (+30 min on the row).'),
    summary: function (items) { var a = items.filter(function (x) { return x.status === 'active'; }).length, h = items.reduce(function (s, x) { return s + (+x.hrs || 0); }, 0); return items.length ? '<p class="lp-sum">' + esc(K('ui.lp-hob-sum', '{n} going · {h} h in all', { n: a, h: nf(h) })) + '</p>' : ''; },
    sort: function (a, b) { var o = { active: 0, paused: 1, done: 2 }; return (o[a.status] || 0) - (o[b.status] || 0) || ((b.last || '') > (a.last || '') ? 1 : -1); },
    row: function (x) { return { icon: { build: 'hammer', practice: 'music-note-beamed', learn: 'translate', make: 'scissors', play: 'controller' }[x.kind] || 'palette', color: x.status === 'active' ? 'var(--violet)' : 'var(--slate)', cls: x.status === 'done' ? 'lp-done' : '', title: x.title,
      sub: esc([x.next ? K('ui.lp-hob-nx', 'Next: {t}', { t: x.next }) : '', +x.hrs ? nf(+x.hrs) + ' h' : '', isKey(x.last) ? fmt(x.last) : ''].filter(Boolean).join(' · ')), right: x.status === 'done' ? chip((HOBS[2])[1], 'var(--slate)') : '<span role="button" tabindex="0" class="hl-chip lp-act lp-plus" style="--c:var(--violet)" data-lpact="hob30" data-lpid="' + esc(x.id) + '">+30 min</span>' }; }
  });
  ACT.hob30 = function (id) { setList('hobbies', function (x) { if (x.id === id) { x.hrs = Math.round(((+x.hrs || 0) + .5) * 10) / 10; x.last = today(); if (x.status === 'paused') x.status = 'active'; } }); toast(K('ui.lp-hob-30', '30 minutes added')); };

  /* ================= Me: Body upkeep (haircut, dentist, eyes … when each is due) ================= */
  function bodySeed() { return [
    { title: S('Haircut', 'Frisør'), every: 6, unit: 'w' }, { title: S('Dentist', 'Tannlege'), every: 12, unit: 'm' }, { title: S('Eye test', 'Synstest'), every: 24, unit: 'm' },
    { title: S('Check your moles', 'Sjekk føflekkene'), every: 3, unit: 'm' }, { title: S('New running shoes', 'Nye løpesko'), every: 12, unit: 'm' }, { title: S('GP check-up', 'Sjekk hos fastlegen'), every: 24, unit: 'm' }]; }
  var bodyDue = LP.bodyDue;
  card('bodycare', { icon: 'scissors', title: K('ui.lp-body', 'Body upkeep'), addTitle: K('ui.lp-body-add', 'Something to keep up'), editTitle: K('ui.lp-edit', 'Edit'), limit: 8,
    fields: [{ k: 'title', type: 'title', label: K('ui.lp-what', 'What'), req: true, ph: K('ui.lp-body-ph', 'e.g. Haircut, Dentist') }, { k: 'every', type: 'number', label: K('ui.lp-every', 'Every'), def: 12 }, { k: 'unit', type: 'select', label: K('ui.lp-unit', 'Weeks or months'), options: [['m', K('ui.lp-months', 'months')], ['w', K('ui.lp-weeks', 'weeks')]], def: 'm' }, { k: 'last', type: 'date', label: K('ui.lp-last-time', 'Last time') }, { k: 'notes', type: 'textarea', rows: 2, label: K('ui.notes', 'Notes') }],
    empty: K('ui.lp-body-empty', 'Haircut, dentist, eye test, moles, running shoes – each with how often, so you see what’s due. Tick when it’s done.'),
    above: function (items) { return items.length ? '' : '<div class="lp-start"><button type="button" class="pill-btn" data-lpact="bodyseed" data-lpid=""><i class="bi bi-list-check"></i> ' + esc(K('ui.lp-body-seed', 'Add the usual list')) + '</button></div>'; },
    sort: function (a, b) { return (bodyDue(a) || '0') < (bodyDue(b) || '0') ? -1 : 1; },
    row: function (x) { var d = bodyDue(x); return { icon: 'scissors', color: d && d <= today() ? 'var(--warn)' : 'var(--blue)', title: x.title, sub: esc([K(x.unit === 'w' ? 'ui.lp-every-w' : 'ui.lp-every-m', x.unit === 'w' ? 'every {n} weeks' : 'every {n} months', { n: +x.every || (x.unit === 'w' ? 6 : 12) }), isKey(x.last) ? K('ui.lp-last-d', 'last {d}', { d: fmt(x.last) }) : K('ui.lp-last-none', 'tick the first time it’s done')].join(' · ')), right: (d ? when(d) : '') + tick('bodydone', x.id, K('ui.lp-done-now', 'Done now')) }; }
  });
  ACT.bodyseed = function () { seed('bodycare', bodySeed()); };
  ACT.bodydone = function (id) { setList('bodycare', function (x) { if (x.id === id) x.last = today(); }); toast(K('ui.lp-body-ok', 'Done – the next one is counted from today')); };

  /* ================= Me: Screen time (phone-free evenings) ================= */
  function scr() { var s = Fe.tools().screen || {}; return { goal: Math.max(1, Math.min(7, +s.goal || 3)), days: Array.isArray(s.days) ? s.days.filter(isKey) : [] }; }
  function drawScreen() {
    var el = $t('lp-screen'); if (!el) return;
    if (!Fe.on('screen')) { el.hidden = true; el.innerHTML = ''; return; }
    var s = scr(), t = today(), mk = monKey(), wk = s.days.filter(function (k) { return k >= mk && k <= t; }).length, streak = 0;
    for (var w = 1; w < 60; w++) { var a = addDays(mk, -7 * w), b = addDays(a, 6), n = s.days.filter(function (k) { return k >= a && k <= b; }).length; if (n >= s.goal) streak++; else break; }
    var dots = ''; for (var i = 0; i < 7; i++) { var k = addDays(mk, i); dots += '<span class="' + (s.days.indexOf(k) > -1 ? 'on' : '') + (k === t ? ' now' : '') + '" title="' + esc(fmt(k)) + '"><i class="bi bi-moon"></i><small>' + esc(Fe.fromKey(k).toLocaleDateString(NB() ? 'nb-NO' : 'en-GB', { weekday: 'narrow' })) + '</small></span>'; }
    var tonight = s.days.indexOf(t) > -1;
    el.hidden = false;
    el.innerHTML = '<section class="card kit-card" id="lp-screen"><div class="card-head"><h2><i class="bi bi-phone"></i> ' + esc(K('ui.lp-screen', 'Screen time')) + '</h2></div>' +
      '<p class="lp-sum">' + esc(K('ui.lp-scr-goal', 'Phone-free evenings a week:')) + ' <select data-lpscreen aria-label="' + esc(K('ui.lp-scr-goal', 'Phone-free evenings a week:')) + '">' + [1, 2, 3, 4, 5, 6, 7].map(function (n) { return '<option' + (n === s.goal ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></p>' +
      '<div class="lp-week">' + dots + '</div><p class="lp-sum"><b>' + esc(K('ui.lp-scr-wk', '{n} of {g} this week', { n: wk, g: s.goal })) + '</b>' + (streak ? ' · ' + esc(K('ui.lp-scr-streak', '{n} weeks in a row', { n: streak })) : '') + '</p>' +
      '<div class="lp-acts"><button type="button" class="pill-btn" data-lpact="screentick" data-lpid="" aria-pressed="' + tonight + '"><i class="bi bi-' + (tonight ? 'check-lg' : 'moon') + '"></i> ' + esc(tonight ? K('ui.lp-scr-done', 'Phone-free tonight ✓') : K('ui.lp-scr-tick', 'Phone-free tonight')) + '</button></div></section>';
  }
  ACT.screentick = function () { var t = Fe.tools(), s = scr(), k = today(), i = s.days.indexOf(k); if (i > -1) s.days.splice(i, 1); else s.days.push(k); s.days = s.days.filter(function (d) { return d >= addDays(k, -400); }); t.screen = s; Fe.saveTools(t); drawScreen(); };
  document.addEventListener('change', function (e) { var t = e.target; if (!t.matches || !t.matches('[data-lpscreen]')) return; var tl = Fe.tools(), s = scr(); s.goal = +t.value || 3; tl.screen = s; Fe.saveTools(tl); drawScreen(); });

  /* ================= Me: Style (sizes, clothes to replace, things to buy on sale) ================= */
  var STK = [['size', K('ui.lp-st-size', 'My size')], ['replace', K('ui.lp-st-replace', 'To replace')], ['sale', K('ui.lp-st-sale', 'Buy on sale')]];
  function blackFriday(y) { var d = new Date(y, 10, 1); d.setDate(1 + (4 - d.getDay() + 7) % 7 + 21 + 1); return d; }
  card('style', { icon: 'bag-heart', title: K('ui.lp-style', 'Style'), addTitle: K('ui.lp-st-add', 'Add'), editTitle: K('ui.lp-edit', 'Edit'), limit: 10,
    fields: [{ k: 'kind', type: 'select', label: K('ui.lp-kind', 'Kind'), options: STK, def: 'size' }, { k: 'title', type: 'title', label: K('ui.lp-what', 'What'), req: true, ph: K('ui.lp-st-ph', 'e.g. Shoes, Jeans, Winter jacket') }, { k: 'val', label: K('ui.lp-st-val', 'Size or details'), ph: K('ui.lp-st-val-ph', 'e.g. 44, W32 L34, M') }, { k: 'price', type: 'number', label: K('ui.lp-st-price', 'Price'), suffix: 'kr' }, { k: 'done', type: 'check', label: K('ui.lp-st-done', 'Bought') }],
    empty: K('ui.lp-st-empty', 'Your sizes (handy in a shop or when buying a gift for you), clothes that need replacing, and things to buy when there’s a sale.'),
    summary: function (items) {
      var sale = items.filter(function (x) { return x.kind !== 'size' && !x.done; }), sum = sale.reduce(function (a, x) { return a + (+x.price || 0); }, 0), y = new Date().getFullYear(), bf = blackFriday(y), now = new Date(), bfd = Math.round((bf - now) / 864e5);
      var h = sale.length ? esc(K('ui.lp-st-sum', '{n} to buy', { n: sale.length })) + (sum ? ' · ' + esc(kr(sum)) : '') : '';
      if (sale.length && bfd >= -3 && bfd <= 30) h += ' · ' + esc(K('ui.lp-st-bf', 'Black Friday {d}', { d: bf.toLocaleDateString(NB() ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short' }) }));
      return h ? '<p class="lp-sum">' + h + '</p>' : '';
    },
    sort: function (a, b) { var o = { replace: 0, sale: 1, size: 2 }; return (a.done ? 1 : 0) - (b.done ? 1 : 0) || (o[a.kind] || 0) - (o[b.kind] || 0); },
    row: function (x) { var k = STK.filter(function (q) { return q[0] === x.kind; })[0] || STK[0]; return { icon: { size: 'rulers', replace: 'arrow-repeat', sale: 'tag' }[x.kind] || 'bag', color: x.kind === 'size' ? 'var(--slate)' : x.kind === 'sale' ? 'var(--pink)' : 'var(--orange)', cls: x.done ? 'lp-done' : '', title: x.title,
      sub: esc([k[1], x.kind !== 'size' ? x.val : '', +x.price ? kr(+x.price) : ''].filter(Boolean).join(' · ')), right: x.kind === 'size' && x.val ? '<b class="lp-size">' + esc(x.val) + '</b>' : '' }; }
  });
  window.LifePlusMe = { blackFriday: blackFriday, bodyDue: bodyDue, bodySeed: bodySeed };

  /* ================= Food: Use it up (things to eat soon, and your recipes that use them) ================= */
  function recipesWith(name) {
    var w = String(name || '').toLowerCase().trim().split(/\s+/)[0]; if (w.length < 3) return [];
    var rx = new RegExp('(^|[^a-zæøå])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return (Fe.tools().recipes || []).filter(function (r) { return r && rx.test(String(r.ingr || '') + ' ' + String(r.title || r.name || '')); });
  }
  card('usefood', { icon: 'clock-history', title: K('ui.lp-use', 'Use it up'), addTitle: K('ui.lp-use-add', 'Something to use soon'), editTitle: K('ui.lp-edit', 'Edit'), limit: 8,
    fields: [{ k: 'title', type: 'title', label: K('ui.lp-what', 'What'), req: true, ph: K('ui.lp-use-ph', 'e.g. Spinach, cream, half a chicken') }, { k: 'by', type: 'date', label: K('ui.lp-use-by', 'Use by'), def: function () { return addDays(today(), 2); } }, { k: 'done', type: 'check', label: K('ui.lp-use-done', 'Used') }],
    empty: K('ui.lp-use-empty', 'Write down what needs eating soon – the card shows which of your recipes use it, soonest first.'),
    sort: function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0) || ((a.by || '9') < (b.by || '9') ? -1 : 1); },
    summary: function (items) { var n = items.filter(function (x) { return !x.done && isKey(x.by) && x.by <= addDays(today(), 1); }).length; return n ? '<p class="lp-sum">' + esc(K('ui.lp-use-sum', '{n} to use today or tomorrow', { n: n })) + '</p>' : ''; },
    row: function (x) {
      var rs = x.done ? [] : recipesWith(x.title);
      return { icon: 'basket', color: !x.done && isKey(x.by) && x.by <= today() ? 'var(--warn)' : 'var(--ok)', cls: x.done ? 'lp-done' : '', title: x.title,
        sub: rs.length ? esc(K('ui.lp-use-rec', 'In: {r}', { r: rs.slice(0, 3).map(function (r) { return r.title || r.name; }).join(', ') })) : esc(x.done ? '' : K('ui.lp-use-norec', 'None of your recipes uses it yet')),
        right: (isKey(x.by) && !x.done ? when(x.by) : '') + (x.done ? '' : tick('useddone', x.id, K('ui.lp-use-done', 'Used'))) };
    }
  });
  ACT.useddone = function (id) { setList('usefood', function (x) { if (x.id === id) x.done = true; }); };

  /* ================= Food: Freezer (what's in it and since when, oldest first) ================= */
  card('freezer', { icon: 'snow', title: K('ui.lp-frz', 'Freezer'), addTitle: K('ui.lp-frz-add', 'Into the freezer'), editTitle: K('ui.lp-edit', 'Edit'), limit: 10,
    fields: [{ k: 'title', type: 'title', label: K('ui.lp-what', 'What'), req: true, ph: K('ui.lp-frz-ph', 'e.g. Bolognese, bread, berries') }, { k: 'n', type: 'number', label: K('ui.lp-frz-n', 'Portions'), def: 1 }, { k: 'date', type: 'date', label: K('ui.lp-frz-in', 'Frozen'), def: today }, { k: 'where', label: K('ui.lp-frz-where', 'Where'), ph: K('ui.lp-frz-where-ph', 'e.g. top drawer') }],
    empty: K('ui.lp-frz-empty', 'What’s in the freezer and since when – oldest first, so nothing gets lost at the bottom. Tap −1 when you take a portion.'),
    sort: function (a, b) { return (a.date || '9') < (b.date || '9') ? -1 : 1; },
    summary: function (items) { var n = items.reduce(function (s, x) { return s + (+x.n || 1); }, 0), old = items.filter(function (x) { return isKey(x.date) && days(x.date, today()) > 180; }).length; return items.length ? '<p class="lp-sum">' + esc(K('ui.lp-frz-sum', '{n} portions', { n: n })) + (old ? ' · ' + esc(K('ui.lp-frz-old', '{n} in for more than 6 months', { n: old })) : '') + '</p>' : ''; },
    row: function (x) { var d = isKey(x.date) ? days(x.date, today()) : 0; return { icon: 'snow', color: d > 180 ? 'var(--warn)' : 'var(--blue)', title: x.title + ((+x.n || 1) > 1 ? ' ×' + (+x.n) : ''),
      sub: esc([isKey(x.date) ? K('ui.lp-frz-since', 'in since {d}', { d: fmt(x.date) }) : '', x.where].filter(Boolean).join(' · ')), right: '<span role="button" tabindex="0" class="hl-chip lp-act lp-plus" style="--c:var(--blue)" data-lpact="frzone" data-lpid="' + esc(x.id) + '">−1</span>' }; }
  });
  ACT.frzone = function (id) {
    var t = Fe.tools(), l = Array.isArray(t.freezer) ? t.freezer : [], x = l.filter(function (q) { return q.id === id; })[0]; if (!x) return;
    var was = JSON.parse(JSON.stringify(l));
    if ((+x.n || 1) > 1) x.n = (+x.n || 1) - 1; else t.freezer = l.filter(function (q) { return q.id !== id; });
    Fe.saveTools(t); toast(K('ui.lp-frz-took', 'Taken out'), function () { var t2 = Fe.tools(); t2.freezer = was; Fe.saveTools(t2); });
  };

  /* ================= Papers: Return deadlines (14 days for buying online in Norway – angrerett – or the shop's own time) ================= */
  var RDAYS = [[14, K('ui.lp-ret-14', '14 days – bought online or by phone (angrerett)')], [30, K('ui.lp-ret-30', '30 days')], [60, K('ui.lp-ret-60', '60 days')], [100, K('ui.lp-ret-100', '100 days')], [365, K('ui.lp-ret-365', 'A year')]];
  function retBy(x) { return isKey(x.got) ? addDays(x.got, +x.days || 14) : ''; }
  card('returns', { icon: 'arrow-return-left', title: K('ui.lp-ret', 'Return deadlines'), addTitle: K('ui.lp-ret-add', 'Something you might return'), editTitle: K('ui.lp-edit', 'Edit'), limit: 8,
    fields: [{ k: 'title', type: 'title', label: K('ui.lp-what', 'What'), req: true, ph: K('ui.lp-ret-ph', 'e.g. Jacket from Zalando') }, { k: 'shop', label: K('ui.lp-ret-shop', 'Shop') }, { k: 'got', type: 'date', label: K('ui.lp-ret-got', 'Received'), def: today }, { k: 'days', type: 'select', label: K('ui.lp-ret-days', 'Return within'), options: RDAYS, def: 14 }, { k: 'cost', type: 'number', label: K('ui.lp-st-price', 'Price'), suffix: 'kr' }, { k: 'state', type: 'select', label: K('ui.lp-status', 'Status'), options: [['open', K('ui.lp-ret-open', 'Deciding')], ['keep', K('ui.lp-ret-keep', 'Keeping it')], ['sent', K('ui.lp-ret-sent', 'Sent back')], ['refund', K('ui.lp-ret-refund', 'Money back')]], def: 'open' }],
    beforeSave: function (it) { it.days = +it.days || 14; },
    empty: K('ui.lp-ret-empty', 'Not sure you’ll keep it? Add it with the day it arrived – you see the last day to send it back, and a reminder comes three days before. Buying online in Norway you have 14 days from when you got it (angrerett); in a shop it’s the shop’s own rules.'),
    sort: function (a, b) { var o = { open: 0, sent: 1, refund: 2, keep: 3 }; return (o[a.state] || 0) - (o[b.state] || 0) || (retBy(a) < retBy(b) ? -1 : 1); },
    summary: function (items) { var o = items.filter(function (x) { return (x.state || 'open') === 'open' && retBy(x) >= today(); }), w = items.filter(function (x) { return x.state === 'sent'; }); return items.length ? '<p class="lp-sum">' + esc(K('ui.lp-ret-sum', '{n} still to decide', { n: o.length })) + (w.length ? ' · ' + esc(K('ui.lp-ret-wait', '{n} waiting for money back', { n: w.length })) : '') + '</p>' : ''; },
    row: function (x) { var d = retBy(x), st = x.state || 'open', past = d && d < today();
      return { icon: 'arrow-return-left', color: st === 'open' ? (past ? 'var(--slate)' : 'var(--orange)') : st === 'sent' ? 'var(--blue)' : 'var(--ok)', cls: st === 'keep' || st === 'refund' ? 'lp-done' : '', title: x.title,
        sub: esc([x.shop, +x.cost ? kr(+x.cost) : '', st === 'sent' ? K('ui.lp-ret-sent', 'Sent back') : st === 'keep' ? K('ui.lp-ret-keep', 'Keeping it') : st === 'refund' ? K('ui.lp-ret-refund', 'Money back') : (past ? K('ui.lp-ret-late', 'Too late to return') : K('ui.lp-ret-last', 'last day {d}', { d: fmt(d) }))].filter(Boolean).join(' · ')),
        right: st === 'open' && !past ? when(d) : '' }; }
  });

  /* ================= People: Thank-yous (who gave you what, and whether you've said thanks) ================= */
  function pplOpts() { return [['', K('ui.lp-ty-someone', 'Someone else')]].concat((Fe.tools().people || []).filter(function (p) { return p && p.name; }).sort(function (a, b) { return String(a.name).localeCompare(b.name, 'nb'); }).map(function (p) { return [p.id, p.name]; })); }
  function whoName(x) { var p = (Fe.tools().people || []).filter(function (q) { return q.id === x.pid; })[0]; return p ? p.name : (x.from || ''); }
  card('thanks', { icon: 'envelope-heart', title: K('ui.lp-ty', 'Thank-yous'), addTitle: K('ui.lp-ty-add', 'A gift you got'), editTitle: K('ui.lp-edit', 'Edit'), limit: 10,
    fields: [{ k: 'what', type: 'title', label: K('ui.lp-ty-what', 'What you got'), req: true, ph: K('ui.lp-ty-ph', 'e.g. A scarf, a dinner invitation') }, { k: 'pid', type: 'select', label: K('ui.lp-ty-from', 'From'), options: pplOpts }, { k: 'from', label: K('ui.lp-ty-from2', 'Or write who'), ph: K('ui.lp-ty-from2-ph', 'If they’re not in People') },
      { k: 'date', type: 'date', label: K('ui.date', 'Date'), def: today }, { k: 'done', type: 'check', label: K('ui.lp-ty-done', 'Thanked') }],
    empty: K('ui.lp-ty-empty', 'After a birthday or Christmas: who gave you what, and tick them off when you’ve said thanks. Next year you’ll remember who gave what.'),
    sort: function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0) || ((b.date || '') > (a.date || '') ? 1 : -1); },
    summary: function (items) { var n = items.filter(function (x) { return !x.done; }).length; return items.length ? '<p class="lp-sum">' + esc(n ? K('ui.lp-ty-sum', '{n} still to thank', { n: n }) : K('ui.lp-ty-all', 'Everyone thanked ✓')) + '</p>' : ''; },
    row: function (x) { return { icon: x.done ? 'envelope-check' : 'envelope-heart', color: x.done ? 'var(--ok)' : 'var(--pink)', cls: x.done ? 'lp-done' : '', title: x.what,
      sub: esc([whoName(x) ? K('ui.lp-ty-fromx', 'from {n}', { n: whoName(x) }) : '', fmt(x.date)].filter(Boolean).join(' · ')), right: x.done ? '' : tick('tydone', x.id, K('ui.lp-ty-done', 'Thanked')) }; }
  });
  ACT.tydone = function (id) { setList('thanks', function (x) { if (x.id === id) x.done = true; }); };

  /* money from the life sections into Finances (2026-11-22): quick add's expense form, filled in – you check the amount and save */
  function costBtn(act, id) { return '<span role="button" tabindex="0" class="hl-chip lp-act lp-plus" style="--c:var(--ok)" data-lpact="' + act + '" data-lpid="' + esc(id) + '"><i class="bi bi-wallet2"></i> ' + esc(K('ui.lp-log-cost', 'Log the cost')) + '</span>'; }
  function toExpense(pre) { if (window.Quick && window.Quick.open) window.Quick.open('expense', pre); }
  ACT.partycost = function (id) { var x = Fe.list('parties').filter(function (q) { return q.id === id; })[0]; if (!x) return; toExpense({ n: x.title, c: 'fun', d: x.date, a: +x.budget || '' }); setList('parties', function (q) { if (q.id === id) q.logged = 1; }); };
  ACT.petcost = function (id) { var p = Fe.list('pets').filter(function (q) { return q.id === id; })[0]; if (!p) return; toExpense({ n: p.name + (p.kind ? ' (' + p.kind + ')' : ''), c: 'other' }); };
  /* plain cards draw on the same changes as the Kit ones */
  function drawPlain() { drawClimate(); drawSleep(); drawCalm(); drawMood(); drawWheel(); drawScreen(); }
  ['tools:change', 'features:change', 'fin:change', 'health:change', 'vault:in'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(drawPlain, 30); }); });
  if (window.Vault.onUnlock) window.Vault.onUnlock(function () { setTimeout(drawPlain, 60); });
  drawPlain();
  window.LifePlusUI = { readyList: readyList, adminSeed: adminSeed, familySeed: familySeed, digitalSeed: digitalSeed, MOM: MOM };
})();
