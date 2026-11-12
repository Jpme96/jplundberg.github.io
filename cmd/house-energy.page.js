/* House, more (Nov 2026):
   · Power bill estimate (Energy tab) – how much you use (from the meter readings) × the price today and this month
     (hour by hour from hvakosterstrommen.no, via Strømpris), plus grid rent and the fixed part, minus strømstøtte –
     or Norgespris. Updates itself every day; the year view shows kWh and cost by calendar year and month.
   · Read the meter from a photo – take a picture of the meter, the numbers are read on your phone
     (Tesseract, loaded the first time you use it) and you check them before they're saved.
   · Upkeep from your FDV documents (Upkeep tab) – the manuals in the FDV binder suggest the upkeep they ask for
     (heat pump filters, ventilation, drains, the water heater …), one tap to add.
   · Handymen (Projects tab) – the electrician, the plumber and the rest: phone, what they did, would you use them again.
   Data: dash.tools.hpros, dash.tools.energycfg; daily prices kept in localStorage dash.powerAvg (only averages). */
/* The page part of house-energy.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is house-energy.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["energy"]; if (!__c) return;
  var Fe = __c.Fe, $t = __c.$t, on = __c.on, estimate = __c.estimate, cfg = __c.cfg, readings = __c.readings, years = __c.years, nf = __c.nf, kr = __c.kr, today = __c.today, fromKey = __c.fromKey, isKey = __c.isKey, TRADES = __c.TRADES, trade = __c.trade, recordToday = __c.recordToday;
  var K = window.Kit || null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, ''); var x = parseFloat(s.replace(',', '.')); return isFinite(x) ? x : null; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function chip(t, c) { return '<span class="hl-chip" style="--c:' + c + '">' + t + '</span>'; }
  function card(key, icon, title, acts, body, cls) { return '<section class="card kit-card' + (cls ? ' ' + cls : '') + '" id="' + key + '"><div class="card-head"><h2><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h2>' + (acts ? '<div class="head-actions">' + acts + '</div>' : '') + '</div>' + body + '</section>'; }
  var GREEN = '#22b35e';
  var RED = '#e66767';
  var BLUE = '#3987e5';
  function setCfg(p) { var t = Fe.tools(); t.energycfg = Object.assign({}, t.energycfg || {}, p); if ('norgespris' in p) t.powercfg = Object.assign({}, t.powercfg || {}, { norgespris: p.norgespris }); Fe.saveTools(t); }
  function draw() {
    var el = $t('henergy'); if (!el) return;
    if (!on()) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    var e = estimate(), c = cfg(), r = readings(), ys = years(), yl = Object.keys(ys).sort().reverse();
    var ocrBtn = c.ocr ? '<button type="button" class="text-btn" data-mocr><i class="bi bi-camera"></i> <span data-t="ui.photo">Photo</span></button>' : '';
    var acts = ocrBtn + '<a class="text-btn" href="/cmd/?settings=house" aria-label="Settings" data-t-aria-label="ui.settings"><i class="bi bi-sliders"></i></a>';
    var body;
    if (e.none) body = '<p class="empty kit-empty">' + (r.length ? 'One more meter reading and you see what this month’s power costs.' : 'Read the meter (or take a photo of it) twice, a few days apart – then you see what this month’s power costs, updated with the price every day.') + '</p>' +
      (e.spot != null ? '<p class="muted hl-small">Price today: ' + nf.format(Math.round(e.spot)) + ' øre/kWh spot' + (e.up != null ? ' · ' + nf.format(Math.round(e.up)) + ' øre with grid rent' : '') + '</p>' : '');
    else {
      var mName = new Date().toLocaleDateString('en-GB', { month: 'long' });
      body = '<div class="kit-tiles">' +
        '<div class="kit-tile"><span>' + esc(mName) + ', about</span><b>' + (e.total != null ? esc(kr(e.total)) : '–') + '</b><small>' + nf.format(Math.round(e.kwh)) + ' kWh</small></div>' +
        '<div class="kit-tile"><span data-t="ui.per-day"><span data-t="ui.per-day">Per day</span></span><b>' + nf1.format(e.perDay) + ' <small>kWh</small></b><small>' + (e.up != null ? '≈ ' + esc(kr(e.perDay * e.up / 100)) : '&nbsp;') + '</small></div>' +
        '<div class="kit-tile"><span>' + (c.norgespris ? 'Norgespris' : 'Price ' + (e.monthAvg != null ? 'this month' : 'today')) + '</span><b>' + (e.up != null ? nf.format(Math.round(e.up)) + ' <small>øre</small>' : '–') + '</b><small>' + (c.norgespris ? '50 øre + grid rent' : e.spot != null ? nf.format(Math.round(e.spot)) + ' spot' + (c.support && e.spot > 93.75 ? ', after support' : '') : 'set it in Settings') + '</small></div></div>' +
        (e.energy != null ? '<ul class="he-split"><li><span>Energy' + (c.norgespris ? ' (Norgespris)' : '') + ' and grid rent per kWh</span><b>' + esc(kr(e.energy)) + '</b></li><li><span data-t="ui.grid-rent-fixed-part"><span data-t="ui.grid-rent-fixed-part">Grid rent, fixed part</span></span><b>' + esc(kr(e.fixed)) + '</b></li></ul>' : '');
    }
    if (yl.length) {
      /* the year view: each calendar year – kWh, about what it cost, against the year before (month by month is on Power use by month) */
      body += '<div class="he-year"><p class="fx-sub" data-t="ui.by-year"><span data-t="ui.by-year">By year</span></p><ul class="he-years">' + yl.slice(0, 4).map(function (y) {
        var o = ys[y], p = ys[String(+y - 1)], full = o.days >= 330, mx = o.months.indexOf(Math.max.apply(null, o.months));
        var cost = o.costDays ? o.cost / o.costDays * o.days + (+c.gridFixed || 0) * Math.min(12, Math.round(o.days / 30.4)) : null;
        var vs = p && p.days >= 330 && full ? (o.kwh <= p.kwh ? '−' : '+') + Math.round(Math.abs(o.kwh / p.kwh - 1) * 100) + ' % vs ' + (+y - 1) : '';
        return '<li><b>' + esc(y) + '</b><span>' + nf.format(Math.round(o.kwh)) + ' kWh' + (cost != null ? ' · ≈ ' + esc(kr(cost)) : '') + '<small>' + esc([full ? '' : o.days + ' days with readings', 'most in ' + new Date(+y, mx, 1).toLocaleDateString('en-GB', { month: 'long' }), vs].filter(Boolean).join(' · ')) + '</small></span></li>';
      }).join('') + '</ul></div>';
    }
    body += '<p class="kit-foot">An estimate: spot price from hvakosterstrommen.no (NO1)' + (c.support && !c.norgespris ? ', strømstøtte' : '') + ', your grid rent from Settings. The same month last year is used for the days ahead.</p>';
    el.innerHTML = card('henergy', 'lightning', I18N.k('ui.power-bill', 'Power bill'), acts, body);
  }
  var TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  function loadTess() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = TESS; s.onload = function () { ok(window.Tesseract); }; s.onerror = function () { no(new Error('load')); }; document.head.appendChild(s); });
  }
  function pick(text, last) {
    var c = (String(text).replace(/[oO]/g, '0').replace(/[lI|]/g, '1').match(/\d[\d ]{3,9}\d/g) || []).map(function (s) { return +s.replace(/\s/g, ''); }).filter(function (n) { return n > 0; });
    if (!c.length) return null;
    if (last != null) { var ok = c.filter(function (n) { return n >= last && n < last + 20000; }); if (ok.length) return ok.sort(function (a, b) { return a - b; })[0]; }
    return c.sort(function (a, b) { return String(b).length - String(a).length; })[0];
  }
  function shrink(file) {
    return new Promise(function (ok) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () { var s = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = img.width * s; cv.height = img.height * s; var x = cv.getContext('2d'); x.filter = 'grayscale(1) contrast(1.6)'; x.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); ok({ canvas: cv, url: cv.toDataURL('image/jpeg', .8) }); };
      img.onerror = function () { URL.revokeObjectURL(u); ok(null); };
      img.src = u;
    });
  }
  function ocrSheet() {
    var r = readings(), last = r.length ? r[r.length - 1].value : null;
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<form class="fo-box lf-box hl-box" role="dialog" aria-modal="true" aria-label="Read the meter" data-t-aria-label="ui.read-the-meter" autocomplete="off"><div class="lf-head"><h3><i class="bi bi-camera"></i> <span data-t="ui.read-the-meter">Read the meter</span></h3><button type="button" class="icon-btn sm" data-x aria-label="Close" data-t-aria-label="ui.close"><i class="bi bi-x-lg"></i></button></div>' +
      '<p class="muted lf-sub" data-t="ui.take-a-photo-close-to-the-numbers-its-re">Take a photo close to the numbers. It’s read on your phone – the photo isn’t kept.</p>' +
      '<label class="pill-btn he-pick"><i class="bi bi-camera"></i> <span data-t="ui.take-or-pick-a-photo">Take or pick a photo</span><input type="file" accept="image/*" capture="environment" hidden data-mfile></label>' +
      '<div class="he-ocr" data-mstate></div>' +
      '<div class="mp-grid"><label><span data-t="ui.meter-shows-kwh">Meter shows, kWh</span><input name="value" inputmode="decimal"></label><label><span data-t="ui.date"><span data-t="ui.date">Date</span></span><input name="date" type="date" value="' + today() + '"></label></div>' +
      (last != null ? '<p class="muted hl-small">Last reading: ' + nf.format(last) + ' kWh (' + esc(fromKey(r[r.length - 1].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + ')</p>' : '') +
      '<div class="lf-foot"><span class="spacer"></span><button type="submit" class="pill-btn wide"><i class="bi bi-check2"></i> <span data-t="ui.save-reading">Save reading</span></button></div></form>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var f = bg.querySelector('form'), st = bg.querySelector('[data-mstate]'), close = function () { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 180); };
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-x]')) close(); });
    bg.querySelector('[data-mfile]').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0]; if (!file) return;
      st.innerHTML = '<p class="muted"><i class="bi bi-hourglass-split"></i> <span data-t="ui.reading-the-numbers">Reading the numbers …</span></p>';
      shrink(file).then(function (im) {
        if (!im) throw new Error('img');
        st.innerHTML = '<img src="' + im.url + '" alt="The meter"><p class="muted"><i class="bi bi-hourglass-split"></i> <span data-t="ui.reading-the-numbers-the-first-time-takes">Reading the numbers … (the first time takes a little longer)</span></p>';
        return loadTess().then(function (T) { return T.recognize(im.canvas, 'eng', { tessedit_char_whitelist: '0123456789 ' }); }).then(function (res) {
          var n = pick(res && res.data && res.data.text, last);
          st.innerHTML = '<img src="' + im.url + '" alt="The meter">' + (n != null ? '<p class="he-found"><i class="bi bi-check2-circle"></i> <span data-t="ui.found">Found</span> <b>' + nf.format(n) + '</b> – check it against the photo</p>' : '<p class="muted" data-t="ui.couldnt-find-the-number-type-it-in">Couldn’t find the number – type it in.</p>');
          if (n != null) f.value.value = n;
          f.value.focus();
        });
      }).catch(function () { st.innerHTML = '<p class="muted" data-t="ui.couldnt-read-the-photo-here-type-the-num">Couldn’t read the photo here – type the number in.</p>'; f.value.focus(); });
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = num(f.value.value); if (v == null) { f.value.focus(); f.value.classList.add('kit-bad'); return; }
      if (last != null && v < last && !f.dataset.sure) { f.dataset.sure = 1; st.insertAdjacentHTML('beforeend', '<p class="hl-warn" data-t="ui.thats-lower-than-the-last-reading-save-a">That’s lower than the last reading – Save again if it’s right (a new meter).</p>'); return; }
      var t = Fe.tools(); t.hmeter = (Array.isArray(t.hmeter) ? t.hmeter : []).concat([{ id: uid(), date: isKey(f.date.value) ? f.date.value : today(), value: v, src: 'photo' }]); Fe.saveTools(t);
      close(); toast('<i class="bi bi-speedometer2"></i> Reading saved – ' + nf.format(v) + ' kWh');
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-mocr]')) { e.preventDefault(); ocrSheet(); } });
  var RULES = [
    ['hp', /varmepumpe|heat ?pump|luft.?til.?luft/i, 'Clean the heat pump filters', 3, 'Vacuum or rinse the filters in the indoor unit – the manual shows how.', 'fan'],
    ['hp2', /varmepumpe|heat ?pump/i, 'Keep the heat pump’s outdoor unit clear', 12, 'Leaves in autumn, snow and ice in winter.', 'snow'],
    ['vent', /ventilasjon|ventilation|balansert|aggregat|flexit|systemair|nilan/i, 'Change the ventilation filters', 6, 'Usually twice a year – note the filter type from the manual.', 'wind'],
    ['hood', /kjøkkenvifte|ventilator|cooker hood|avtrekk/i, 'Clean the cooker hood filter', 3, 'Grease filters in the dishwasher; carbon filters are replaced.', 'cup-hot'],
    ['drain', /sluk|drain|våtrom|bad(e)?rom|bathroom/i, I18N.k('ui.clean-the-bathroom-drain', 'Clean the bathroom drain'), 3, 'Take out the grate and the water lock, clean and rinse.', 'droplet'],
    ['seal', /våtrom|membran|fuge|silikon|sealant/i, 'Check the sealant in the bathroom', 12, 'Cracked or dark sealant lets water in behind the tiles.', 'bucket'],
    ['wh', /bereder|varmtvann|water heater|oso|høiax/i, 'Test the water heater’s safety valve', 12, 'Turn the valve until water runs out – and check for damp underneath.', 'thermometer-half'],
    ['leak', /vannstopp|lekkasje|leak|waterguard|aqua/i, 'Test the leak guard', 12, 'Press the test button or wet the sensor – it should close the water.', 'moisture'],
    ['valve', /stoppekran|main valve/i, 'Turn the main water valve once', 12, 'So it doesn’t get stuck when you need it.', 'moisture'],
    ['smoke', /røyk|smoke|brannvarsl|alarm/i, 'Test the smoke alarms', 3, 'Press the test button; new batteries every year.', 'alarm'],
    ['ext', /slukke|extinguisher|brannslange/i, 'Check the fire extinguisher', 12, 'The needle in the green, shake a powder extinguisher.', 'fire'],
    ['stove', /komfyrvakt|stove guard/i, 'Test the stove guard', 12, 'As the manual says – often a test button.', 'shield-check'],
    ['fuse', /sikringsskap|jordfeil|el.?anlegg|kursfortegnelse|fuse/i, 'Test the earth fault breakers', 6, 'Press the T button on each one – they should trip.', 'lightning-charge'],
    ['fire', /peis|ildsted|vedovn|fireplace|stove/i, 'Have the chimney swept and check the fireplace', 12, 'The fire service sweeps; check seals and glass yourself.', 'fire'],
    ['floor', /parkett|parquet|tregulv/i, 'Care for the wooden floor', 12, 'Clean with the right soap, oil or wax as the product sheet says.', 'grid-3x3'],
    ['win', /vindu|window|nordan|natre/i, 'Lubricate window and door hinges', 12, 'A drop of oil in hinges and locks, wash the tracks.', 'door-closed'],
    ['gutter', /takrenne|gutter|tak\b|roof/i, 'Clear the gutters and downpipes', 12, 'In autumn after the leaves fall.', 'house'],
    ['deck', /terrasse|platting|deck/i, 'Wash and oil the deck', 12, 'In late spring on a dry day.', 'tree'],
    ['dish', /oppvask|dishwasher/i, 'Clean the dishwasher filter', 1, 'Take out the filter at the bottom and rinse it.', 'cup-hot'],
    ['wash', /vaskemaskin|washing machine/i, 'Clean the washing machine filter and drawer', 3, 'The pump filter at the bottom front; run a hot cycle empty.', 'droplet-half'],
    ['dryer', /tørketrommel|dryer/i, 'Clean the dryer’s lint filter and condenser', 3, 'The lint filter every time, the condenser every few months.', 'wind'],
    ['fridge', /kjøleskap|fridge|fryser|freezer/i, 'Vacuum behind the fridge and defrost the freezer', 12, 'Dust on the coils makes it use more power.', 'snow2']];
  function suggestions() {
    if (!Fe.on('hdocs')) return [];
    var docs = Fe.list('hdocs'), have = Fe.list('hmaint').map(function (x) { return String(x.title || '').toLowerCase(); }), off = Fe.tools().hfdvoff || {};
    var out = [];
    RULES.forEach(function (r) {
      if (off[r[0]] || have.some(function (t) { return t === r[2].toLowerCase() || (t.length > 10 && r[2].toLowerCase().indexOf(t.slice(0, 18)) === 0); })) return;
      var hit = docs.filter(function (d) { return r[1].test([d.name, d.path, d.notes].join(' ')); });
      if (hit.length) out.push({ id: r[0], title: r[2], every: r[3], notes: r[4], icon: r[5], from: hit[0].name });
    });
    return out;
  }
  function drawFdv() {
    var el = $t('hfdvup'); if (!el) return;
    var c = cfg(), l = on() && c.fdvSuggest ? suggestions() : [];
    if (!l.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    var EV = { 1: 'every month', 3: 'every 3 months', 6: 'every 6 months', 12: 'every year' };
    el.innerHTML = card('hfdvup', 'journal-check', I18N.k('ui.upkeep-your-documents-ask-for', 'Upkeep your documents ask for'), '<button type="button" class="text-btn" data-fdvall><i class="bi bi-plus-lg"></i> <span data-t="ui.add-all">Add all</span></button>',
      '<p class="muted hl-small" data-t="ui.from-the-manuals-in-your-fdv-binder-add">From the manuals in your FDV binder – add the ones that fit, and they come round in Upkeep.</p><ul class="kit-list">' + l.slice(0, 8).map(function (x) {
        return '<li class="kit-item"><div class="kit-main he-sug"><span class="kit-ic" style="--c:' + BLUE + '"><i class="bi bi-' + x.icon + '"></i></span><span class="kit-x"><b>' + esc(x.title) + '</b><small>' + esc(EV[x.every] + ' · from “' + x.from + '”') + '</small></span>' +
          '<span class="kit-r he-sugb"><button type="button" class="icon-btn sm" data-fdvno="' + x.id + '" aria-label="Not for me"><i class="bi bi-x-lg"></i></button><button type="button" class="icon-btn sm he-add" data-fdvadd="' + x.id + '" aria-label="Add to Upkeep"><i class="bi bi-plus-lg"></i></button></span></div></li>';
      }).join('') + '</ul>' + (l.length > 8 ? '<p class="muted hl-small">' + (l.length - 8) + ' more after these</p>' : ''));
  }
  function addFdv(ids) {
    var l = suggestions().filter(function (x) { return ids.indexOf(x.id) > -1; }); if (!l.length) return;
    var t = Fe.tools(), old = (t.hmaint || []).slice();
    t.hmaint = (Array.isArray(t.hmaint) ? t.hmaint : []).concat(l.map(function (x) { return { id: uid(), title: x.title, every: x.every, last: '', notes: x.notes + ' (from ' + x.from + ')' }; }));
    Fe.saveTools(t);
    toast('<i class="bi bi-tools"></i> ' + (l.length === 1 ? esc(l[0].title) + ' added to Upkeep' : l.length + ' tasks added to Upkeep'), function () { var t2 = Fe.tools(); t2.hmaint = old; Fe.saveTools(t2); });
  }
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-fdvadd]'))) addFdv([b.dataset.fdvadd]);
    else if (e.target.closest('[data-fdvall]')) addFdv(suggestions().map(function (x) { return x.id; }));
    else if ((b = e.target.closest('[data-fdvno]'))) { var t = Fe.tools(); t.hfdvoff = Object.assign({}, t.hfdvoff || {}); t.hfdvoff[b.dataset.fdvno] = 1; Fe.saveTools(t); }
  });
  var RATE = [['', 'Not rated'], [3, 'Would use again'], [2, 'Was OK'], [1, 'Wouldn’t use again']];
  function tel(s) { return String(s || '').replace(/[^\d+]/g, ''); }
  var prosCol = K && $t('hpros') ? K.collection({
    mount: $t('hpros'), feature: 'house', key: 'hpros', icon: 'person-gear', title: 'Handymen', addLabel: 'Add', limit: 8,
    addTitle: 'New handyman', editTitle: 'Edit', fields: [
      { k: 'name', type: 'title', label: 'Name or company', ph: 'e.g. Oslo Elektro, Ola the plumber', req: true },
      { k: 'trade', label: 'Does', type: 'select', options: TRADES.map(function (x) { return [x[0], x[1]]; }), def: 'electric' },
      { k: 'phone', label: 'Phone', ph: '+47 …' }, { k: 'email', label: 'Email', ph: 'Optional' },
      { k: 'job', label: 'Last job', ph: 'e.g. New sockets in the kitchen' }, { k: 'when', label: 'When', type: 'date' },
      { k: 'price', label: 'Cost', type: 'number', suffix: 'kr' },
      { k: 'rate', label: 'Would you use them again', type: 'select', options: RATE, def: '' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'Org. number, who you talked to, the warranty on the work …' }],
    empty: 'The electrician, the plumber, the painter – with the phone number and what they did, so you know who to call (and who not to).',
    sort: function (a, b) { return (+b.rate || 0) - (+a.rate || 0) || String(a.trade).localeCompare(String(b.trade)) || String(a.name).localeCompare(String(b.name)); },
    row: function (x) { var t = trade(x.trade), r = +x.rate; return { icon: t[2], color: t[3], title: x.name, sub: esc([t[1], x.job, isKey(x.when) ? fromKey(x.when).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ')), right: r === 3 ? chip('<i class="bi bi-hand-thumbs-up"></i>', GREEN) : r === 1 ? chip('<i class="bi bi-hand-thumbs-down"></i>', RED) : '' }; },
    detail: function (x) {
      return (x.notes ? '<p class="kit-notes">' + esc(x.notes) + '</p>' : '') + (x.price ? '<p class="muted hl-small">Cost ' + esc(kr(x.price)) + '</p>' : '') +
        '<div class="hl-acts">' + (tel(x.phone) ? '<a class="pill-btn" href="tel:' + esc(tel(x.phone)) + '"><i class="bi bi-telephone"></i> <span data-t="ui.call">Call</span></a><a class="text-btn" href="sms:' + esc(tel(x.phone)) + '"><i class="bi bi-chat"></i> <span data-t="ui.text">Text</span></a>' : '') +
        (x.email ? '<a class="text-btn" href="mailto:' + esc(x.email) + '"><i class="bi bi-envelope"></i> <span data-t="ui.email">Email</span></a>' : '') + '</div>';
    }
  }) : null;
  function setFill() {
    var box = document.getElementById('hlSet-house2'); if (!box || box.contains(document.activeElement)) return;
    if (!on()) { box.innerHTML = ''; return; }
    var c = cfg();
    function sw(f, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-hecfg="' + f + '"' + (c[f] ? ' checked' : '') + '></label>'; }
    function numIn(f, label, unit, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><span class="st-unit"><input class="st-input st-num" inputmode="decimal" data-hecfg="' + f + '" value="' + esc(String(c[f] || '')) + '" placeholder="0"><span>' + esc(unit) + '</span></span></label>'; }
    function sub(icon, t) { return '<p class="st-sub ap-sub"><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</p>'; }
    box.innerHTML = sub('lightning', I18N.k('ui.power-bill', 'Power bill')) + '<div class="st-group">' + sw('norgespris', I18N.k('ui.i-have-norgespris', 'I have Norgespris'), I18N.k('ui.50-re-kwh-instead-of-the-spot-price', '50 øre/kWh instead of the spot price')) + sw('support', I18N.k('ui.count-the-power-subsidy-str-mst-tte', 'Count the power subsidy (strømstøtte)'), I18N.k('ui.90-of-the-price-above-93-75-re', '90 % of the price above 93,75 øre')) +
      numIn('grid', I18N.k('ui.grid-rent-energy-part', 'Grid rent, energy part'), 'øre/kWh', I18N.k('ui.nettleie-per-kwh-incl-vat-on-your-grid-b', 'Nettleie per kWh incl. VAT – on your grid bill')) + numIn('gridFixed', I18N.k('ui.grid-rent-fixed-part', 'Grid rent, fixed part'), 'kr / month', I18N.k('ui.kapasitetsledd-fastledd', 'Kapasitetsledd / fastledd')) + numIn('markup', I18N.k('ui.suppliers-markup', 'Supplier’s markup'), 'øre/kWh', I18N.k('ui.the-markup-p-slag-on-your-power-bill', 'The markup (påslag) on your power bill')) +
      sw('ocr', I18N.k('ui.read-the-meter-from-a-photo', 'Read the meter from a photo'), I18N.k('ui.a-photo-button-on-power-bill-the-numbers', 'A Photo button on Power bill – the numbers are read on your device')) + '</div>' +
      sub('journal-check', I18N.k('ui.fdv-binder', 'FDV binder')) + '<div class="st-group">' + sw('fdvSuggest', I18N.k('ui.suggest-upkeep-from-the-documents', 'Suggest upkeep from the documents'), I18N.k('ui.on-upkeep-from-the-manuals-youve-added', 'On Upkeep, from the manuals you’ve added')) +
      (Object.keys(Fe.tools().hfdvoff || {}).length ? '<button type="button" class="st-row st-btn" data-hefdvreset><span><i class="bi bi-arrow-counterclockwise"></i> <span data-t="ui.show-the-suggestions-i-said-no-to">Show the suggestions I said no to</span></span></button>' : '') + '</div>';
  }
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-hecfg]'); if (!i) return;
    var p = {}; p[i.dataset.hecfg] = i.type === 'checkbox' ? i.checked : Math.max(0, num(i.value) || 0); setCfg(p); toast('<i class="bi bi-check2"></i> Saved');
  });
  document.addEventListener('click', function (e) { if (e.target.closest('[data-hefdvreset]')) { var t = Fe.tools(); delete t.hfdvoff; Fe.saveTools(t); setFill(); toast('<i class="bi bi-check2"></i> They’re back on Upkeep'); } });
  window.addEventListener('st:page', function (e) { if (e.detail === 'house') setTimeout(setFill, 0); });
  function all() { [draw, drawFdv].forEach(function (f) { try { f(); } catch (er) { console.error(er); } }); }
  if ($t('henergy') || $t('hfdvup')) {
    ['tools:change', 'features:change', 'brief:refresh'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(all.t); all.t = setTimeout(all, 50); }); });
    window.Vault.onUnlock(function () { setTimeout(all, 120); });
    setInterval(function () { if (!document.hidden) all(); }, 30 * 60 * 1000);
  } else window.Vault.onUnlock(function () { setTimeout(recordToday, 2000); });
  Object.assign(window.HouseEnergy, { ocr: ocrSheet, pick: pick, suggestions: suggestions });
  (window.__ui = window.__ui || {})["energy"] = { ocrSheet: ocrSheet };
  /* the ⌘K command from another page comes here with #mocr: open the photo reader */
  if (location.hash === '#mocr') { try { history.replaceState(null, '', location.pathname); } catch (e) {} window.Vault.onUnlock(function () { setTimeout(ocrSheet, 400); }); }
})();
