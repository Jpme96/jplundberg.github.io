/* Home life (Settings → Features), each a page of its own, off until you switch it on:
     House    upkeep that comes round again, bin days, meter readings, home info  (/cmd/house/)
     People   birthdays, keeping in touch, gift ideas                              (/cmd/people/)
     Food     the week's dinners, the shopping list, recipes                       (/cmd/food/)
   and on the Work page:
     Time per client – a timer per client or project, hours per week, a CSV to invoice from.
   Data lives in dash.tools (synced, encrypted); lines for At a glance go through window.BriefExtra,
   reminders into the calendar through Features.events(). */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in home-life.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["homelife"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function on(k) { return Fe.on(k); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : null; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  var dkey = Fe.dkey;
  var fromKey = Fe.fromKey;
  var addMonths = Fe.addMonths;
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function today() { return dkey(new Date()); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function daysTo(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function inDays(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n < 0 ? -n + ' days ago' : 'in ' + n + ' days'; }
  function fmt(k, o) { return fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }); }
  function ago(k) {
    var n = -daysTo(k);
    if (n <= 0) return 'today'; if (n === 1) return 'yesterday'; if (n < 14) return n + ' days ago';
    if (n < 60) return Math.round(n / 7) + ' weeks ago'; if (n < 700) return Math.round(n / 30.4) + ' months ago';
    return Math.round(n / 365) + ' years ago';
  }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function saveList(key, fn) { var t = Fe.tools(); t[key] = Array.isArray(t[key]) ? t[key] : []; fn(t[key], t); Fe.saveTools(t); }
  function byId(key, id) { return Fe.list(key).filter(function (x) { return x.id === id; })[0]; }
  function snapshot(key) { return JSON.parse(JSON.stringify(Fe.tools()[key] || null)); }
  function restore(key, v) { var t = Fe.tools(); t[key] = v; Fe.saveTools(t); }
  var RED = '#e66767';
  var AMBER = '#c98500';
  var GREEN = '#22b35e';
  var BLUE = '#3987e5';
  window.BriefExtra = window.BriefExtra || [];
  window.CommandExtra = window.CommandExtra || [];
  var DEF = {
    housecfg: { binHour: 14, binMorning: true, lead: 2, price: 0, meterNudge: true, calendar: true, seasonNudge: true, illu: true },
    peoplecfg: { lead: 7, catchup: true, catchupMax: 1, defEvery: 0, calendar: true, askNote: true, namedays: true, ndCal: true, annLead: 3,
      gbXmas: 0, gbBday: 0, gbOther: 0, xmasNudge: true, giftFin: false },
    foodcfg: { nudge: true, nudgeHour: 13, repeat: 14, sort: 'aisle', calendar: false, servings: 0, pantryBack: true, pantrySkip: true, shopToPantry: true, pantryLow: true },
    ptcfg: { round: 0, long: 4, vat: true, payDays: 14, org: '', account: '', addr: '', invNext: 1 }
  };
  function cfg(k) { var c = Fe.tools()[k]; return Object.assign({}, DEF[k], c && typeof c === 'object' ? c : {}); }
  function setCfg(k, patch) { var t = Fe.tools(); t[k] = Object.assign({}, t[k] || {}, patch); Fe.saveTools(t); }
  function gear(page) { return '<a class="text-btn" href="/cmd/?settings=' + page + '" aria-label="Settings"><i class="bi bi-sliders"></i> <span data-t="ui.settings">Settings</span></a>'; }
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
  function dhead(icon, title, sub) { return '<div class="lf-head"><h3><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h3><button type="button" class="icon-btn sm" data-hlclose aria-label="Close" data-t-aria-label="ui.close"><i class="bi bi-x-lg"></i></button></div>' + (sub ? '<p class="muted lf-sub">' + esc(sub) + '</p>' : ''); }
  function picker(icon, title, sub, opts, pick) {
    dialog(dhead(icon, title, sub) + '<div class="hl-pick">' + opts.map(function (o, i) {
      return '<button type="button" data-hlpick="' + i + '" style="--c:' + o.c + '"><span class="kit-ic" style="--c:' + o.c + '"><i class="bi bi-' + o.i + '"></i></span><span><b>' + esc(o.n) + '</b>' + (o.s ? '<small>' + esc(o.s) + '</small>' : '') + '</span></button>';
    }).join('') + '</div>', function (e, close) { var b = e.target.closest('[data-hlpick]'); if (b) { close(); setTimeout(function () { pick(opts[+b.dataset.hlpick]); }, 120); } });
  }
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
  function hmIcon(t) { var u = USUAL.filter(function (x) { return x[0] === t; })[0]; return u ? u[3] : /røyk|smoke/i.test(t) ? 'alarm' : /filter|vent/i.test(t) ? 'wind' : /sluk|drain|vann|water/i.test(t) ? 'droplet' : 'tools'; }
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
      var nm = String(x.title || x.text || 'Upkeep');
      add(n < 0 ? 33 : 46, hmIcon(nm), n < 0 ? RED : AMBER, nm, n < 0 ? 'Overdue since ' + fmt(nextDue(x)) : 'Due ' + inDays(n), '/cmd/house/',
        { act: { id: 'hm:' + x.id + ':' + today(), label: 'Done' }, run: function () { hmDone(x.id); }, badge: n < 0 && !!(window.Delight && window.Delight.on('badgeHouse')) });
    });
  });
  function nextPickup(b, from) {
    if (!isKey(b.first)) return null;
    from = from || today();
    var step = (+b.every || 1) * 7, n = Math.round((fromKey(from) - fromKey(b.first)) / 864e5);
    var k = n <= 0 ? 0 : Math.ceil(n / step);
    return addDays(b.first, k * step);
  }
  window.BriefExtra.push(function (add, now) {
    if (!on('house')) return;
    var c = cfg('housecfg'), tk = today(), tm = addDays(tk, 1), h = now.getHours();
    var tonight = Fe.list('hbins').filter(function (b) { return b.night !== false && nextPickup(b, tm) === tm; }).map(function (b) { return b.title; });
    var tod = Fe.list('hbins').filter(function (b) { return nextPickup(b) === tk; }).map(function (b) { return b.title; });
    if (tonight.length && h >= (+c.binHour || 14)) add(17, 'trash3', AMBER, 'Put out ' + tonight.join(' + ') + ' tonight', I18N.k('ui.picked-up-tomorrow', 'Picked up tomorrow'), '/cmd/house/');
    else if (tod.length && c.binMorning && h < 10) add(19, 'trash3', AMBER, tod.join(' + ') + ' is picked up today', I18N.k('ui.out-by-7-if-it-isnt-already', 'Out by 7 if it isn’t already'), '/cmd/house/');
  });
  function meterStats(l) {
    var r = l.filter(function (x) { return isKey(x.date) && typeof x.value === 'number'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var per = function (a, b) { var d = Math.round((fromKey(b.date) - fromKey(a.date)) / 864e5); return d > 0 ? (b.value - a.value) / d : null; };
    var last = r.length > 1 ? per(r[r.length - 2], r[r.length - 1]) : null;
    var yr = r.filter(function (x) { return x.date >= addDays(today(), -400); });
    var avg = yr.length > 1 ? per(yr[0], yr[yr.length - 1]) : null;
    return { r: r, last: last, avg: avg, prev: function (x) { var i = r.map(function (y) { return y.id; }).indexOf(x.id); return i > 0 ? r[i - 1] : null; }, per: per };
  }
  window.BriefExtra.push(function (add) {
    if (!on('house') || !cfg('housecfg').meterNudge) return;
    var r = meterStats(Fe.list('hmeter')).r; if (!r.length) return;
    var n = -daysTo(r[r.length - 1].date);
    if (n >= 28 && new Date().getDate() <= 3) add(70, 'speedometer2', AMBER, I18N.k('ui.read-the-electricity-meter', 'Read the electricity meter'), 'Last reading ' + ago(r[r.length - 1].date), '/cmd/house/');
  });
  window.CommandExtra.push(function () { return on('house') ? [{ i: 'speedometer2', t: 'New meter reading', s: 'House', run: function () { if (__ui().$t && __ui().$t('hmeter') && __ui().K) __ui().K.edit(__ui().METER, null); else location.href = '/cmd/house/#hmeter'; }, x: 'meter strøm måler kwh avlesning' }] : []; });
  var LINE = function (k, label, o) { return Object.assign({ k: k, label: label }, o || {}); };
  var NOTES = LINE('notes', 'Notes', { type: 'textarea', rows: 3 });
  var INFO = {
    wifi: { n: 'Wi-Fi', s: 'Network and password', i: 'wifi', c: BLUE, f: [LINE('title', 'Name', { type: 'title', def: 'Wi-Fi', req: true }), LINE('ssid', I18N.k('ui.network-name', 'Network name'), { ph: 'Lundberg-5G' }), LINE('pass', 'Password', { secret: true }), LINE('guest', I18N.k('ui.guest-network', 'Guest network'), { ph: 'Name / password' }), LINE('router', 'Router', { ph: 'Where it is, admin login' }), NOTES] },
    water: { n: 'Water & stopcock', s: 'Where to turn the water off', i: 'droplet', c: '#0891b2', f: [LINE('title', 'Name', { type: 'title', def: 'Stopcock (stoppekran)', req: true }), LINE('where', I18N.k('ui.where-it-is', 'Where it is'), { ph: 'Under the kitchen sink, behind the panel' }), LINE('heater', I18N.k('ui.water-heater', 'Water heater'), { ph: 'Size, year, where' }), NOTES] },
    power: { n: 'Fuse box & power', s: 'Fuses, meter, supplier', i: 'lightning-charge', c: AMBER, f: [LINE('title', 'Name', { type: 'title', def: 'Fuse box (sikringsskap)', req: true }), LINE('where', I18N.k('ui.where-it-is', 'Where it is'), { ph: 'Hallway cupboard' }), LINE('fuses', I18N.k('ui.which-fuse-is-what', 'Which fuse is what'), { type: 'textarea', rows: 3, ph: '1 Kitchen, 2 Bathroom floor heating …' }), LINE('supplier', I18N.k('ui.power-company', 'Power company')), LINE('meter', I18N.k('ui.meter-m-lepunkt-id', 'Meter / målepunkt-ID'), { secret: false }), NOTES] },
    contact: { n: 'Contact', s: 'Landlord, plumber, the board (styret)', i: 'person-lines-fill', c: '#d55181', f: [LINE('title', 'Who', { type: 'title', ph: 'Landlord, plumber, styret …', req: true }), LINE('name', 'Name'), LINE('phone', 'Phone', { type: 'tel', ph: '+47' }), LINE('email', 'Email', { type: 'email' }), NOTES] },
    appliance: { n: 'Appliance', s: 'Model, serial, warranty, manual', i: 'plug', c: '#8a6fdf', f: [LINE('title', 'What', { type: 'title', ph: 'Dishwasher, heat pump …', req: true }), LINE('model', I18N.k('ui.brand-model', 'Brand & model'), { ph: 'Bosch SMV4HVX31E' }), LINE('serial', I18N.k('ui.serial-number', 'Serial number')), LINE('bought', 'Bought', { type: 'date' }), LINE('years', I18N.k('ui.complaint-period', 'Complaint period'), { type: 'select', options: [[2, '2 years'], [5, '5 years (things meant to last)']], def: 5 }), LINE('manual', 'Manual', { type: 'url', ph: 'https://' }), NOTES] },
    paint: { n: 'Paint & materials', s: 'Colour codes, tiles, flooring', i: 'palette', c: '#e8743b', f: [LINE('title', 'Where', { type: 'title', ph: 'Living room walls', req: true }), LINE('product', I18N.k('ui.brand-colour', 'Brand & colour'), { ph: 'Jotun Lady Pure Color – 1024 Ullhvit' }), LINE('finish', I18N.k('ui.gloss-type', 'Gloss / type'), { ph: 'Matt 5' }), LINE('amount', I18N.k('ui.amount-used', 'Amount used'), { ph: '2 × 2,7 l' }), NOTES] },
    code: { n: 'Codes & keys', s: 'Door, alarm, storage room', i: 'key', c: '#7a8794', f: [LINE('title', 'What', { type: 'title', ph: 'Door code, alarm, bike room …', req: true }), LINE('code', 'Code', { secret: true }), LINE('keys', I18N.k('ui.who-has-keys', 'Who has keys')), NOTES] },
    other: { n: 'Something else', s: 'A free note', i: 'info-circle', c: GREEN, f: [LINE('title', 'What', { type: 'title', req: true }), LINE('text', 'Details', { type: 'textarea', rows: 4 })] }
  };
  function infoCfg(kind) {
    var k = INFO[kind] ? kind : 'other', x = INFO[k];
    return { key: 'hinfo', addTitle: x.n, editTitle: x.n, fields: x.f, beforeSave: function (it) { it.kind = k; } };
  }
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
  function talked(id, ask) {
    var old = snapshot('people');
    saveList('people', function (l) { l.forEach(function (x) {
      if (x.id !== id) return;
      x.last = today(); x.log = Array.isArray(x.log) ? x.log : [];
      if (!x.log.length || x.log[0].d !== today()) x.log.unshift({ d: today() });
      x.log = x.log.slice(0, 40);
    }); });
    if (ask && window.PeoplePlus && window.PeoplePlus.askNote(id, old)) return;
    toast('<i class="bi bi-chat-heart"></i> Noted', function () { restore('people', old); });
  }
  window.BriefExtra.push(function (add) {
    if (!on('people')) return;
    var l = Fe.list('people'), pc = cfg('peoplecfg');
    l.forEach(function (p) {
      var b = bday(p); if (!b || b.n > +pc.lead) return;
      var tel = String(p.phone || '').replace(/[^\d+]/g, '');
      if (b.n === 0) add(8, 'balloon', '#d55181', p.name + '’s birthday today', (b.age ? 'Turns ' + b.age : 'Send a greeting') , tel ? 'sms:' + tel : '/cmd/people/', { badge: !window.Delight || window.Delight.on('badgeBday') });
      else add(b.n <= 2 ? 24 : 40, 'balloon', '#d55181', p.name + '’s birthday ' + inDays(b.n), p.gifts ? 'Gift idea: ' + String(p.gifts).split('\n')[0] : (b.age ? 'Turns ' + b.age + ' · ' : '') + 'no gift ideas yet', '/cmd/people/');
    });
    if (pc.catchup) l.filter(function (p) { return overdue(p) != null; }).sort(function (a, b) { return overdue(b) - overdue(a); }).slice(0, +pc.catchupMax || 1).forEach(function (p) {
      add(58, 'chat-heart', AMBER, 'Catch up with ' + p.name, isKey(p.last) ? 'Last talked ' + ago(p.last) : 'Say hi', '/cmd/people/',
        { act: { id: 'pp:' + p.id + ':' + today(), label: 'Talked' }, run: function () { talked(p.id); } });
    });
  });
  function mealText(v) { return v == null ? '' : typeof v === 'string' ? v : typeof v === 'object' ? String(v.text || v.name || v.title || '') : String(v); }
  function meals() {
    var m = Fe.tools().meals; if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
    Object.keys(m).forEach(function (k) { if (typeof m[k] !== 'string') { var t = mealText(m[k]); if (t) m[k] = t; else delete m[k]; } });
    return m;
  }
  function recipeFor(name) { var n = String(name || '').trim().toLowerCase(); return n ? Fe.list('recipes').filter(function (r) { return String(r.title).trim().toLowerCase() === n; })[0] : null; }
  function ingredients(r) { return String((r && r.ingr) || '').split('\n').map(function (x) { return x.replace(/^[-•*\s]+/, '').trim(); }).filter(Boolean); }
  function addShop(items, from) {
    var t = Fe.tools(), l = Array.isArray(t.shop) ? t.shop : [], have = {}, n = 0;
    l.forEach(function (x) { if (!x.done) have[String(x.text || '').toLowerCase()] = 1; });
    addShop.skipped = [];
    items.forEach(function (s) {
      s = String(s).trim().slice(0, 120); if (!s || have[s.toLowerCase()]) return;
      if (from && from !== 'pantry' && window.FoodPlus && window.FoodPlus.inPantry(s)) { addShop.skipped.push(s); return; }   // basics you have at home
      have[s.toLowerCase()] = 1; l.push({ id: uid(), text: s, done: false, from: from || '' }); n++;
    });
    t.shop = l; Fe.saveTools(t); return n;
  }
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
    ['home', 'Household', 'house', '#7a8794', /dopapir|tørkerull|oppvask|vaskemiddel|såpe|søppelpose|poser|folie|bakepapir|batteri|lyspære|servietter|toilet paper|kitchen roll|washing-up|dish|detergent|soap|bin bags|foil|battery|napkin/],
    ['care', 'Toiletries & pharmacy', 'bandaid', '#d55181', /sjampo|balsam|tannkrem|tannbørste|deodorant|bind|tamponger|bleier|plaster|paracet|ibux|vitamin|shampoo|toothpaste|toothbrush|deo|nappies|diaper|plaster|painkiller/],
    ['other', 'Other', 'three-dots', '#7a8794', /$^/]
  ];
  var AISLE = {};
  AISLES.forEach(function (a, i) { AISLE[a[0]] = { i: i, n: a[1], ic: a[2], c: a[3] }; });
  function aisleOf(text) {
    var own = (Fe.tools().shopcat || {})[String(text).toLowerCase().trim()]; if (own && AISLE[own]) return own;
    var t = ' ' + String(text).toLowerCase() + ' ';
    /* household first: "toilet paper" shouldn't land with the oil */
    for (var j = 0; j < AISLES.length - 1; j++) if (AISLES[j][0] === 'home' && AISLES[j][4].test(t)) return AISLES[j][0];
    /* tins and plain salt/pepper before fruit & veg: "tinned tomatoes" isn't fresh, "pepper" alone is the spice */
    if (/kaffefilter|coffee filter|filterpapir/.test(t)) return 'home';
    if (/tinned|canned|hermetisk|på boks|hakkede tomater|chopped tomatoes|buljong|stock cube/.test(t)) return 'dry';
    if (/^ (salt|pepper|sort pepper|black pepper|kvernet pepper) $/.test(t)) return 'spice';
    for (var i = 0; i < AISLES.length - 1; i++) if (AISLES[i][4].test(t)) return AISLES[i][0];
    return 'other';
  }
  window.BriefExtra.push(function (add, now) {
    if (!on('food')) return;
    var m = meals()[today()], h = now.getHours(), shop = (Fe.tools().shop || []).filter(function (x) { return !x.done; }).length;
    var fc = cfg('foodcfg');
    if (m && h < 20) {
      var r = recipeFor(m);
      add(h >= 14 ? 34 : 64, 'egg-fried', AMBER, 'Dinner: ' + m, r && r.mins ? r.mins + ' min' + (shop ? ' · ' + shop + ' on the shopping list' : '') : shop ? shop + ' on the shopping list' : 'Planned for tonight', '/cmd/food/');
    } else if (!m && fc.nudge && h >= (+fc.nudgeHour || 13) && h < 19) add(56, 'egg-fried', '#7a8794', I18N.k('ui.whats-for-dinner', 'What’s for dinner?'), 'Nothing planned tonight' + (shop ? ' · ' + shop + ' on the shopping list' : ''), '/cmd/food/');
  });
  window.CommandExtra.push(function () { return on('food') ? [{ i: 'cart3', t: 'Shopping list', s: 'Food', run: function () { location.href = '/cmd/food/#shop'; }, x: 'handleliste shopping list groceries butikk' }] : []; });
  function proj(id) { return byId('pproj', id) || { name: 'Unknown', color: '#7a8794' }; }
  function run() { return Fe.tools().ptrun || null; }
  function hm(m) { m = Math.round(m); return Math.floor(m / 60) + ' h ' + pad(m % 60); }
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
  window.CommandExtra.push(function () { return on('work') ? [{ i: 'clipboard-data', t: 'Work report for today', s: 'Copy the day at work', run: function () {
    if (!__ui().workReport) { location.href = '/cmd/work/'; return; }   /* the report is drawn by the Work page's part */
    var r = __ui().workReport(today());
    if (navigator.clipboard) navigator.clipboard.writeText(r.text).then(function () { toast('<i class="bi bi-clipboard-check"></i> Report copied'); });
  }, x: 'report rapport dag work day summary' }] : []; });
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
        add('cm:' + dk, o.at(dk, Math.floor(leave / 60), leave % 60), I18N.k('ui.time-to-leave-for-work', 'Time to leave for work'), 'About ' + trip + ' min to work – open the dashboard for the next departures', '/cmd/');
      }
    }
  });
  function usualStart() {
    var l = Fe.list('flex').filter(function (e) { return e.type === 'work' && /^\d{1,2}:\d{2}$/.test(e.in || ''); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 15)
      .map(function (e) { var p = e.in.split(':'); return +p[0] * 60 + +p[1]; }).sort(function (a, b) { return a - b; });
    return l.length >= 5 ? l[Math.floor(l.length / 2)] : null;
  }
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
    function txt(k, f, label, ph) { return '<label class="st-row"><span>' + esc(label) + '</span><input class="st-input" data-hlcfg="' + k + ':' + f + '" value="' + esc(cfg(k)[f] || '') + '" placeholder="' + esc(ph || '') + '" maxlength="80"></label>'; }
    function link(href, icon, t) { return '<a class="st-row st-btn" href="' + href + '"><span><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</span><i class="bi bi-chevron-right"></i></a>'; }
    var HOURS = [12, 14, 16, 17, 18, 19, 20].map(function (h) { return [h, 'From ' + pad(h) + ':00']; });
    var PAGES = {
      house: function () {
        return '<p class="st-intro" data-t="ui.reminders-and-estimates-for-the-house-pa">Reminders and estimates for the House page. Your bins, upkeep and notes are on the page itself.</p>' +
          sub('trash3', I18N.k('ui.bin-days', 'Bin days')) + '<div class="st-group">' + sel('housecfg', 'binHour', I18N.k('ui.evening-before-reminder', 'Evening-before reminder'), HOURS, I18N.k('ui.in-at-a-glance', 'In At a glance')) + sw('housecfg', 'binMorning', I18N.k('ui.also-on-the-morning-of-pickup', 'Also on the morning of pickup')) + '</div>' +
          sub('tools', 'Upkeep') + '<div class="st-group">' + sel('housecfg', 'lead', I18N.k('ui.remind-me', 'Remind me'), [[0, 'On the day'], [2, '2 days before'], [7, 'A week before'], [14, '2 weeks before']]) + '</div>' +
          sub('lightning-charge', 'Electricity') + '<div class="st-group">' + numIn('housecfg', 'price', I18N.k('ui.price-for-estimates', 'Price for estimates'), 'øre/kWh', I18N.k('ui.power-grid-rent-incl-vat-shows-kr-a-mont', 'Power + grid rent, incl. VAT – shows ≈ kr a month')) + sw('housecfg', 'meterNudge', I18N.k('ui.remind-me-to-read-the-meter', 'Remind me to read the meter'), I18N.k('ui.at-the-start-of-each-month', 'At the start of each month')) + '</div>' +
          sub('calendar3', 'Calendar') + '<div class="st-group">' + sw('housecfg', 'calendar', I18N.k('ui.bin-days-and-upkeep-in-the-calendar', 'Bin days and upkeep in the calendar')) + '</div>' +
          sub('tree', I18N.k('ui.seasons-and-the-house', 'Seasons and the house')) + '<div class="st-group">' + sw('housecfg', 'seasonNudge', I18N.k('ui.season-checklist-in-at-a-glance', 'Season checklist in At a glance'), I18N.k('ui.the-first-weeks-of-autumn-winter-spring', 'The first weeks of autumn, winter, spring and summer')) + sw('housecfg', 'illu', I18N.k('ui.house-picture-at-the-top', 'House picture at the top'), I18N.k('ui.shows-whats-due-tap-a-part-to-go-there', 'Shows what’s due – tap a part to go there')) + '</div>' +
          '<div class="st-group">' + link('/cmd/house/', 'house-gear', I18N.k('ui.open-house', 'Open House')) + link('/cmd/house/?customize', 'grid-1x2', I18N.k('ui.order-and-hide-cards', 'Order and hide cards')) + '</div>';
      },
      people: function () {
        return '<p class="st-intro" data-t="ui.how-people-reminds-you-about-birthdays-a">How People reminds you about birthdays and keeping in touch.</p>' +
          sub('balloon', 'Birthdays') + '<div class="st-group">' + sel('peoplecfg', 'lead', 'Heads-up', [[0, 'On the day'], [1, 'The day before'], [3, '3 days before'], [7, 'A week before'], [14, '2 weeks before']], I18N.k('ui.in-at-a-glance', 'In At a glance')) + sw('peoplecfg', 'calendar', I18N.k('ui.birthdays-in-the-calendar', 'Birthdays in the calendar')) + '</div>' +
          sub('chat-heart', I18N.k('ui.keeping-in-touch', 'Keeping in touch')) + '<div class="st-group">' + sw('peoplecfg', 'catchup', I18N.k('ui.nudges-in-at-a-glance', 'Nudges in At a glance')) + sel('peoplecfg', 'catchupMax', I18N.k('ui.at-most', 'At most'), [[1, '1 person at a time'], [2, '2 people'], [3, '3 people']]) +
          sel('peoplecfg', 'defEvery', I18N.k('ui.for-new-people', 'For new people'), KEEP, I18N.k('ui.what-keep-in-touch-starts-at', 'What “Keep in touch” starts at')) + sw('peoplecfg', 'askNote', I18N.k('ui.ask-for-a-note-after-talked-today', 'Ask for a note after “Talked today”'), I18N.k('ui.one-line-kept-as-a-short-history', 'One line, kept as a short history')) + '</div>' +
          sub('calendar-heart', I18N.k('ui.name-days-and-anniversaries', 'Name days and anniversaries')) + '<div class="st-group">' + sw('peoplecfg', 'namedays', I18N.k('ui.name-days', 'Name days'), I18N.k('ui.from-the-norwegian-almanac-by-first-name', 'From the Norwegian almanac, by first name – in At a glance on the day')) +
          sel('peoplecfg', 'annLead', I18N.k('ui.anniversaries-heads-up', 'Anniversaries: heads-up'), [[0, 'On the day'], [1, 'The day before'], [3, '3 days before'], [7, 'A week before']]) + sw('peoplecfg', 'ndCal', I18N.k('ui.name-days-and-anniversaries-in-the-calen', 'Name days and anniversaries in the calendar')) + '</div>' +
          sub('gift', 'Gifts') + '<div class="st-group">' + numIn('peoplecfg', 'gbXmas', I18N.k('ui.christmas-budget', 'Christmas budget'), 'kr', I18N.k('ui.for-all-christmas-gifts-together', 'For all Christmas gifts together')) + numIn('peoplecfg', 'gbBday', I18N.k('ui.birthday-gift-budget', 'Birthday gift budget'), 'kr', I18N.k('ui.per-gift', 'Per gift')) +
          numIn('peoplecfg', 'gbOther', I18N.k('ui.other-occasions', 'Other occasions'), 'kr', I18N.k('ui.per-gift-weddings-christenings-thank-you', 'Per gift – weddings, christenings, thank-yous')) + sw('peoplecfg', 'xmasNudge', I18N.k('ui.christmas-gift-list-in-at-a-glance', 'Christmas gift list in At a glance'), I18N.k('ui.from-15-november', 'From 15 November')) +
          sw('peoplecfg', 'giftFin', I18N.k('ui.add-gifts-to-finances', 'Add gifts to Finances'), I18N.k('ui.as-spending-shopping-when-you-note-a-gif', 'As spending (Shopping) when you note a gift with a price')) + '</div>' +
          '<div class="st-group">' + link('/cmd/people/', 'people', I18N.k('ui.open-people', 'Open People')) + link('/cmd/people/?customize', 'grid-1x2', I18N.k('ui.order-and-hide-cards', 'Order and hide cards')) + '</div>';
      },
      food: function () {
        return '<p class="st-intro" data-t="ui.the-dinner-plan-shopping-list-and-remind">The dinner plan, shopping list and reminders.</p>' +
          sub('egg-fried', 'Dinner') + '<div class="st-group">' + sw('foodcfg', 'nudge', I18N.k('ui.ask-whats-for-dinner', 'Ask “What’s for dinner?”'), I18N.k('ui.in-at-a-glance-when-nothing-is-planned', 'In At a glance, when nothing is planned')) + sel('foodcfg', 'nudgeHour', 'Ask', [12, 13, 14, 15, 16].map(function (h) { return [h, 'From ' + pad(h) + ':00']; })) +
          sel('foodcfg', 'repeat', I18N.k('ui.fill-the-empty-days-skip-dinners-from-th', 'Fill the empty days: skip dinners from the last'), [[0, 'Don’t skip'], [7, 'Week'], [14, '2 weeks'], [21, '3 weeks']]) + sw('foodcfg', 'calendar', I18N.k('ui.dinners-in-the-calendar', 'Dinners in the calendar')) + '</div>' +
          sub('journal-text', 'Recipes') + '<div class="st-group">' + sel('foodcfg', 'servings', I18N.k('ui.usually-cooking-for', 'Usually cooking for'), [[0, 'As the recipe says'], [1, '1 person'], [2, '2 people'], [3, '3 people'], [4, '4 people'], [5, '5 people'], [6, '6 people'], [8, '8 people']], I18N.k('ui.recipes-open-scaled-to-this-and-the-week', 'Recipes open scaled to this, and the week’s shopping list too')) + '</div>' +
          sub('box-seam', 'Pantry') + '<div class="st-group">' + sw('foodcfg', 'shopToPantry', I18N.k('ui.bought-items-go-into-the-pantry', 'Bought items go into the pantry'), I18N.k('ui.tick-something-off-the-shopping-list-and', 'Tick something off the shopping list and it’s in stock at home')) + sw('foodcfg', 'pantryBack', I18N.k('ui.back-in-stock-when-ticked-off-the-shoppi', 'Back in stock when ticked off the shopping list')) + sw('foodcfg', 'pantryLow', I18N.k('ui.on-the-shopping-list-running-out', 'On the shopping list = running out'), I18N.k('ui.adding-something-you-keep-at-home-marks', 'Adding something you keep at home marks it as running low')) + sw('foodcfg', 'pantrySkip', I18N.k('ui.skip-basics-you-have-when-adding-recipes', 'Skip basics you have when adding recipes'), I18N.k('ui.salt-oil-rice-stay-off-the-list-while-th', 'Salt, oil, rice … stay off the list while they’re in stock')) + '</div>' +
          sub('cart3', I18N.k('ui.shopping-list', 'Shopping list')) + '<div class="st-group">' + sel('foodcfg', 'sort', 'Order', [['aisle', 'By section in the shop'], ['added', 'As added'], ['abc', 'A–Å']]) + '<button type="button" class="st-row st-btn" data-shreset><span><i class="bi bi-arrow-counterclockwise"></i> Forget the learned shop order</span></button>' + '</div>' +
          '<div class="st-group">' + link('/cmd/food/', 'basket', I18N.k('ui.open-food', 'Open Food')) + link('/cmd/food/?customize', 'grid-1x2', I18N.k('ui.order-and-hide-cards', 'Order and hide cards')) + '</div>';
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
      box.innerHTML = sub('hourglass-split', I18N.k('ui.time-per-client', 'Time per client')) + '<div class="st-group">' +
        sel('ptcfg', 'round', I18N.k('ui.round-timers-up-to', 'Round timers up to'), [[0, 'Exact minutes'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes']]) +
        sel('ptcfg', 'long', I18N.k('ui.ask-if-a-timer-runs-longer-than', 'Ask if a timer runs longer than'), [[2, '2 hours'], [4, '4 hours'], [8, '8 hours']]) + '</div>' +
        sub('receipt', I18N.k('ui.invoice-drafts', 'Invoice drafts')) + '<div class="st-group">' + txt('ptcfg', 'org', I18N.k('ui.organisation-number', 'Organisation number'), 'e.g. 912 345 678') + txt('ptcfg', 'account', I18N.k('ui.bank-account', 'Bank account'), 'e.g. 1234 56 78901') +
        txt('ptcfg', 'addr', I18N.k('ui.your-address-on-invoices', 'Your address on invoices'), I18N.k('ui.street-postcode-and-town', 'Street, postcode and town')) + sel('ptcfg', 'payDays', I18N.k('ui.payment-terms', 'Payment terms'), [[10, '10 days'], [14, '14 days'], [20, '20 days'], [30, '30 days']]) +
        sw('ptcfg', 'vat', I18N.k('ui.add-25-vat-mva', 'Add 25 % VAT (MVA)')) + numIn('ptcfg', 'invNext', I18N.k('ui.next-invoice-number', 'Next invoice number'), '') + '</div>';
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
  /* the Top 3 ring on the avatar button – every page */
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
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
  window.HomeLife = { cfg: cfg, setCfg: setCfg, meals: meals, bday: bday, nextPickup: nextPickup, nextDue: nextDue, addShop: addShop, start: startT, stop: stopT, aisleOf: aisleOf, AISLE: AISLE, ingredients: ingredients, talked: talked, dialog: dialog, dhead: dhead, picker: picker, hmDone: hmDone, INFO: INFO, infoCfg: infoCfg, overdue: overdue, recipeFor: recipeFor, gear: gear };
  (window.__core = window.__core || {})["homelife"] = { setCfg: setCfg, Fe: Fe, num: num, on: on, KEEP: KEEP, pad: pad, esc: esc, cfg: cfg, DEF: DEF, fromKey: fromKey, usualStart: usualStart, proj: proj, byId: byId, run: run, bday: bday, dkey: dkey, nextDue: nextDue, today: today, addMonths: addMonths, isKey: isKey, nextPickup: nextPickup, addDays: addDays, hm: hm, RED: RED, AMBER: AMBER, recipeFor: recipeFor, meals: meals, mealText: mealText, ago: ago, daysTo: daysTo, overdue: overdue, inDays: inDays, meterStats: meterStats, fmt: fmt, hmIcon: hmIcon, USUAL: USUAL, gear: gear, infoCfg: infoCfg, INFO: INFO, GREEN: GREEN, NOTES: NOTES, LINE: LINE, BLUE: BLUE, hmDone: hmDone, restore: restore, toast: toast, saveList: saveList, snapshot: snapshot, picker: picker, dhead: dhead, dialog: dialog, talked: talked, ingredients: ingredients, AISLE: AISLE, aisleOf: aisleOf, AISLES: AISLES, stopT: stopT, uid: uid, startT: startT, addShop: addShop };
})();
