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
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, K = window.Kit || null;
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, ''); var x = parseFloat(s.replace(',', '.')); return isFinite(x) ? x : null; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var dkey = Fe.dkey, fromKey = Fe.fromKey;
  function today() { return dkey(new Date()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function days(a, b) { return Math.round((fromKey(b) - fromKey(a)) / 864e5); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function kr(n) { return nf.format(Math.round(+n || 0)) + ' kr'; }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function readJSON(k, f) { try { var v = localStorage.getItem(k); return v === null ? f : JSON.parse(v); } catch (e) { return f; } }
  function chip(t, c) { return '<span class="hl-chip" style="--c:' + c + '">' + t + '</span>'; }
  function on() { return Fe.on('house'); }
  function card(key, icon, title, acts, body, cls) { return '<section class="card kit-card' + (cls ? ' ' + cls : '') + '" id="' + key + '"><div class="card-head"><h2><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h2>' + (acts ? '<div class="head-actions">' + acts + '</div>' : '') + '</div>' + body + '</section>'; }
  var GREEN = '#22b35e', AMBER = '#c98500', RED = '#e66767', BLUE = '#3987e5', GREY = '#7a8794';

  /* grid rent: energy part (øre/kWh, incl. VAT) and the fixed/capacity part (kr a month); Elvia-ish defaults */
  var DEF = { grid: 36, gridFixed: 415, markup: 0, norgespris: false, support: true, ocr: true, fdvSuggest: true, prosBrief: false };
  function cfg() { var c = Fe.tools().energycfg; var o = Object.assign({}, DEF, c && typeof c === 'object' ? c : {}); var pc = Fe.tools().powercfg; if (pc && pc.norgespris) o.norgespris = true; return o; }
  function setCfg(p) { var t = Fe.tools(); t.energycfg = Object.assign({}, t.energycfg || {}, p); if ('norgespris' in p) t.powercfg = Object.assign({}, t.powercfg || {}, { norgespris: p.norgespris }); Fe.saveTools(t); }

  /* ================= what you use ================= */
  function readings() { return Fe.list('hmeter').filter(function (x) { return isKey(x.date) && typeof x.value === 'number'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }
  /* kWh per day, spread evenly between two readings: { 'YYYY-MM-DD': kWh } for the days covered */
  function perDay() {
    var r = readings(), out = {};
    for (var i = 1; i < r.length; i++) {
      var a = r[i - 1], b = r[i], n = days(a.date, b.date); if (n <= 0 || b.value < a.value) continue;
      var v = (b.value - a.value) / n; for (var j = 0; j < n; j++) out[addDays(a.date, j)] = v;
    }
    return out;
  }
  function recentDaily() {
    var r = readings(); if (r.length < 2) return null;
    var last = r[r.length - 1], first = r.filter(function (x) { return x.date >= addDays(last.date, -45); })[0];
    if (first === last) first = r[r.length - 2];
    var n = days(first.date, last.date); return n > 0 ? (last.value - first.value) / n : null;
  }
  /* the same month last year (seasons matter: winter uses far more) – else the recent pace */
  function dailyFor(k, pd) { var y = addDays(k, -365); return pd[y] != null ? pd[y] : pd[k] != null ? pd[k] : recentDaily(); }

  /* ================= what it costs ================= */
  function avgStore() { var a = readJSON('dash.powerAvg', {}); return a && typeof a === 'object' ? a : {}; }
  function recordToday() {
    var P = window.PowerPrice; if (!P) return null;
    var tk = today(), h = P.day(tk); if (!h) return null;
    var v = h.filter(function (x) { return x != null; }); if (!v.length) return null;
    var avg = v.reduce(function (s, x) { return s + x; }, 0) / v.length, a = avgStore();
    if (Math.abs((a[tk] || 0) - avg) > 0.01) { a[tk] = Math.round(avg * 10) / 10; Object.keys(a).forEach(function (k) { if (k < addDays(tk, -400)) delete a[k]; }); try { localStorage.setItem('dash.powerAvg', JSON.stringify(a)); } catch (e) {} }
    return avg;
  }
  /* øre/kWh you pay for energy: spot (incl. VAT) after strømstøtte, or Norgespris; + the supplier's markup + grid rent */
  function unitPrice(spot) {
    var c = cfg(), P = window.PowerPrice;
    var e = c.norgespris ? 50 : (spot == null ? null : (c.support && P ? P.support(spot) : spot));
    if (e == null) { var hp = +((Fe.tools().housecfg || {}).price) || 0; if (!hp) return null; return hp; }
    return e + (+c.markup || 0) + (+c.grid || 0);
  }
  function monthPrice(ym) {
    var a = avgStore(), l = Object.keys(a).filter(function (k) { return k.slice(0, 7) === ym; }).map(function (k) { return a[k]; });
    return l.length ? l.reduce(function (s, x) { return s + x; }, 0) / l.length : null;
  }
  function estimate() {
    var spotToday = recordToday(), now = new Date(), ym = today().slice(0, 7), pd = perDay();
    var dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), c = cfg();
    var mp = monthPrice(ym), spot = mp != null ? mp : spotToday, up = unitPrice(spot);
    var kwh = 0, known = 0;
    for (var d = 1; d <= dim; d++) { var k = ym + '-' + String(d).padStart(2, '0'), v = dailyFor(k, pd); if (v != null) { kwh += v; known++; } }
    if (!known) return { none: true, spot: spotToday, up: up };
    if (known < dim) kwh = kwh / known * dim;
    var energy = up != null ? kwh * up / 100 : null, fixed = +c.gridFixed || 0;
    return { kwh: kwh, spot: spot, spotToday: spotToday, up: up, energy: energy, fixed: fixed, total: energy != null ? energy + fixed : null, perDay: kwh / dim, monthAvg: mp };
  }
  /* calendar years: kWh by month from the readings, cost from the saved daily prices (or the price you set) */
  function years() {
    var pd = perDay(), a = avgStore(), out = {}, c = cfg(), hp = +((Fe.tools().housecfg || {}).price) || 0;
    Object.keys(pd).forEach(function (k) {
      var y = k.slice(0, 4), m = +k.slice(5, 7) - 1, o = out[y] = out[y] || { kwh: 0, cost: 0, costDays: 0, months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], days: 0 };
      o.kwh += pd[k]; o.months[m] += pd[k]; o.days++;
      var sp = a[k] != null ? a[k] : null, up = sp != null ? unitPrice(sp) : (c.norgespris ? 50 + (+c.grid || 0) : hp || null);
      if (up != null) { o.cost += pd[k] * up / 100; o.costDays++; }
    });
    return out;
  }

  /* ================= the card ================= */
  function draw() {
    var el = $t('henergy'); if (!el) return;
    if (!on()) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    var e = estimate(), c = cfg(), r = readings(), ys = years(), yl = Object.keys(ys).sort().reverse();
    var ocrBtn = c.ocr ? '<button type="button" class="text-btn" data-mocr><i class="bi bi-camera"></i> Photo</button>' : '';
    var acts = ocrBtn + '<a class="text-btn" href="/cmd/?settings=house" aria-label="Settings" data-t-aria-label="ui.settings"><i class="bi bi-sliders"></i></a>';
    var body;
    if (e.none) body = '<p class="empty kit-empty">' + (r.length ? 'One more meter reading and you see what this month’s power costs.' : 'Read the meter (or take a photo of it) twice, a few days apart – then you see what this month’s power costs, updated with the price every day.') + '</p>' +
      (e.spot != null ? '<p class="muted hl-small">Price today: ' + nf.format(Math.round(e.spot)) + ' øre/kWh spot' + (e.up != null ? ' · ' + nf.format(Math.round(e.up)) + ' øre with grid rent' : '') + '</p>' : '');
    else {
      var mName = new Date().toLocaleDateString('en-GB', { month: 'long' });
      body = '<div class="kit-tiles">' +
        '<div class="kit-tile"><span>' + esc(mName) + ', about</span><b>' + (e.total != null ? esc(kr(e.total)) : '–') + '</b><small>' + nf.format(Math.round(e.kwh)) + ' kWh</small></div>' +
        '<div class="kit-tile"><span data-t="ui.per-day">Per day</span><b>' + nf1.format(e.perDay) + ' <small>kWh</small></b><small>' + (e.up != null ? '≈ ' + esc(kr(e.perDay * e.up / 100)) : '&nbsp;') + '</small></div>' +
        '<div class="kit-tile"><span>' + (c.norgespris ? 'Norgespris' : 'Price ' + (e.monthAvg != null ? 'this month' : 'today')) + '</span><b>' + (e.up != null ? nf.format(Math.round(e.up)) + ' <small>øre</small>' : '–') + '</b><small>' + (c.norgespris ? '50 øre + grid rent' : e.spot != null ? nf.format(Math.round(e.spot)) + ' spot' + (c.support && e.spot > 93.75 ? ', after support' : '') : 'set it in Settings') + '</small></div></div>' +
        (e.energy != null ? '<ul class="he-split"><li><span>Energy' + (c.norgespris ? ' (Norgespris)' : '') + ' and grid rent per kWh</span><b>' + esc(kr(e.energy)) + '</b></li><li><span data-t="ui.grid-rent-fixed-part">Grid rent, fixed part</span><b>' + esc(kr(e.fixed)) + '</b></li></ul>' : '');
    }
    if (yl.length) {
      /* the year view: each calendar year – kWh, about what it cost, against the year before (month by month is on Power use by month) */
      body += '<div class="he-year"><p class="fx-sub" data-t="ui.by-year">By year</p><ul class="he-years">' + yl.slice(0, 4).map(function (y) {
        var o = ys[y], p = ys[String(+y - 1)], full = o.days >= 330, mx = o.months.indexOf(Math.max.apply(null, o.months));
        var cost = o.costDays ? o.cost / o.costDays * o.days + (+c.gridFixed || 0) * Math.min(12, Math.round(o.days / 30.4)) : null;
        var vs = p && p.days >= 330 && full ? (o.kwh <= p.kwh ? '−' : '+') + Math.round(Math.abs(o.kwh / p.kwh - 1) * 100) + ' % vs ' + (+y - 1) : '';
        return '<li><b>' + esc(y) + '</b><span>' + nf.format(Math.round(o.kwh)) + ' kWh' + (cost != null ? ' · ≈ ' + esc(kr(cost)) : '') + '<small>' + esc([full ? '' : o.days + ' days with readings', 'most in ' + new Date(+y, mx, 1).toLocaleDateString('en-GB', { month: 'long' }), vs].filter(Boolean).join(' · ')) + '</small></span></li>';
      }).join('') + '</ul></div>';
    }
    body += '<p class="kit-foot">An estimate: spot price from hvakosterstrommen.no (NO1)' + (c.support && !c.norgespris ? ', strømstøtte' : '') + ', your grid rent from Settings. The same month last year is used for the days ahead.</p>';
    el.innerHTML = card('henergy', 'lightning', 'Power bill', acts, body);
  }

  /* ================= read the meter from a photo ================= */
  var TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  function loadTess() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = TESS; s.onload = function () { ok(window.Tesseract); }; s.onerror = function () { no(new Error('load')); }; document.head.appendChild(s); });
  }
  /* the meter's number: the longest run of digits (5–7), close to the last reading if there is one */
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
    bg.innerHTML = '<form class="fo-box lf-box hl-box" role="dialog" aria-modal="true" aria-label="Read the meter" data-t-aria-label="ui.read-the-meter" autocomplete="off"><div class="lf-head"><h3><i class="bi bi-camera"></i> Read the meter</h3><button type="button" class="icon-btn sm" data-x aria-label="Close" data-t-aria-label="ui.close"><i class="bi bi-x-lg"></i></button></div>' +
      '<p class="muted lf-sub" data-t="ui.take-a-photo-close-to-the-numbers-its-re">Take a photo close to the numbers. It’s read on your phone – the photo isn’t kept.</p>' +
      '<label class="pill-btn he-pick"><i class="bi bi-camera"></i> Take or pick a photo<input type="file" accept="image/*" capture="environment" hidden data-mfile></label>' +
      '<div class="he-ocr" data-mstate></div>' +
      '<div class="mp-grid"><label><span data-t="ui.meter-shows-kwh">Meter shows, kWh</span><input name="value" inputmode="decimal"></label><label><span data-t="ui.date">Date</span><input name="date" type="date" value="' + today() + '"></label></div>' +
      (last != null ? '<p class="muted hl-small">Last reading: ' + nf.format(last) + ' kWh (' + esc(fromKey(r[r.length - 1].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + ')</p>' : '') +
      '<div class="lf-foot"><span class="spacer"></span><button type="submit" class="pill-btn wide"><i class="bi bi-check2"></i> Save reading</button></div></form>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var f = bg.querySelector('form'), st = bg.querySelector('[data-mstate]'), close = function () { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 180); };
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-x]')) close(); });
    bg.querySelector('[data-mfile]').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0]; if (!file) return;
      st.innerHTML = '<p class="muted"><i class="bi bi-hourglass-split"></i> Reading the numbers …</p>';
      shrink(file).then(function (im) {
        if (!im) throw new Error('img');
        st.innerHTML = '<img src="' + im.url + '" alt="The meter"><p class="muted"><i class="bi bi-hourglass-split"></i> Reading the numbers … (the first time takes a little longer)</p>';
        return loadTess().then(function (T) { return T.recognize(im.canvas, 'eng', { tessedit_char_whitelist: '0123456789 ' }); }).then(function (res) {
          var n = pick(res && res.data && res.data.text, last);
          st.innerHTML = '<img src="' + im.url + '" alt="The meter">' + (n != null ? '<p class="he-found"><i class="bi bi-check2-circle"></i> Found <b>' + nf.format(n) + '</b> – check it against the photo</p>' : '<p class="muted" data-t="ui.couldnt-find-the-number-type-it-in">Couldn’t find the number – type it in.</p>');
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

  /* ================= upkeep from the FDV documents ================= */
  var RULES = [
    ['hp', /varmepumpe|heat ?pump|luft.?til.?luft/i, 'Clean the heat pump filters', 3, 'Vacuum or rinse the filters in the indoor unit – the manual shows how.', 'fan'],
    ['hp2', /varmepumpe|heat ?pump/i, 'Keep the heat pump’s outdoor unit clear', 12, 'Leaves in autumn, snow and ice in winter.', 'snow'],
    ['vent', /ventilasjon|ventilation|balansert|aggregat|flexit|systemair|nilan/i, 'Change the ventilation filters', 6, 'Usually twice a year – note the filter type from the manual.', 'wind'],
    ['hood', /kjøkkenvifte|ventilator|cooker hood|avtrekk/i, 'Clean the cooker hood filter', 3, 'Grease filters in the dishwasher; carbon filters are replaced.', 'cup-hot'],
    ['drain', /sluk|drain|våtrom|bad(e)?rom|bathroom/i, 'Clean the bathroom drain', 3, 'Take out the grate and the water lock, clean and rinse.', 'droplet'],
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
    el.innerHTML = card('hfdvup', 'journal-check', 'Upkeep your documents ask for', '<button type="button" class="text-btn" data-fdvall><i class="bi bi-plus-lg"></i> Add all</button>',
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

  /* ================= handymen ================= */
  var TRADES = [['electric', 'Electrician', 'lightning-charge', '#d9a400'], ['plumber', 'Plumber', 'droplet', '#3b9de0'], ['carpenter', 'Carpenter', 'hammer', '#a0673a'], ['painter', 'Painter', 'paint-bucket', '#8a6fdf'],
    ['tiler', 'Tiler / wet rooms', 'grid-3x3', '#0891b2'], ['roofer', 'Roofer', 'house', '#7a6a58'], ['hvac', 'Heat pump / ventilation', 'fan', '#e66767'], ['cleaner', 'Cleaning', 'stars', '#11a597'],
    ['lock', 'Locksmith', 'key', '#6b6d73'], ['garden', 'Garden', 'tree', '#2f9e57'], ['mover', 'Moving / transport', 'truck', '#c98500'], ['other', 'Other', 'person-gear', GREY]];
  function trade(k) { return TRADES.filter(function (x) { return x[0] === k; })[0] || TRADES[TRADES.length - 1]; }
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
        '<div class="hl-acts">' + (tel(x.phone) ? '<a class="pill-btn" href="tel:' + esc(tel(x.phone)) + '"><i class="bi bi-telephone"></i> Call</a><a class="text-btn" href="sms:' + esc(tel(x.phone)) + '"><i class="bi bi-chat"></i> Text</a>' : '') +
        (x.email ? '<a class="text-btn" href="mailto:' + esc(x.email) + '"><i class="bi bi-envelope"></i> Email</a>' : '') + '</div>';
    }
  }) : null;
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    if (!on()) return;
    Fe.list('hpros').forEach(function (x) { add('Handymen', trade(x.trade)[2], x.name, [trade(x.trade)[1], x.phone].filter(Boolean).join(' · '), '/cmd/house/#hpros=' + x.id); });
  });

  /* ================= At a glance: the power bill once a month ================= */
  (window.BriefExtra = window.BriefExtra || []).push(function (add, now) {
    if (!on() || !$t || now.getDate() !== 20) return;
    var e = estimate(); if (e.none || e.total == null) return;
    add(78, 'lightning', AMBER, 'Power this month: about ' + kr(e.total), nf.format(Math.round(e.kwh)) + ' kWh at ' + nf.format(Math.round(e.up)) + ' øre with grid rent', '/cmd/house/#henergy');
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() && cfg().ocr ? [{ i: 'camera', t: 'Read the meter from a photo', s: 'House', run: ocrSheet, x: 'meter måler strøm photo bilde avlesning kwh' }] : [];
  });

  /* ================= Settings → House (under what home-life.js draws) ================= */
  function setFill() {
    var box = document.getElementById('hlSet-house2'); if (!box || box.contains(document.activeElement)) return;
    if (!on()) { box.innerHTML = ''; return; }
    var c = cfg();
    function sw(f, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-hecfg="' + f + '"' + (c[f] ? ' checked' : '') + '></label>'; }
    function numIn(f, label, unit, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><span class="st-unit"><input class="st-input st-num" inputmode="decimal" data-hecfg="' + f + '" value="' + esc(String(c[f] || '')) + '" placeholder="0"><span>' + esc(unit) + '</span></span></label>'; }
    function sub(icon, t) { return '<p class="st-sub ap-sub"><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</p>'; }
    box.innerHTML = sub('lightning', 'Power bill') + '<div class="st-group">' + sw('norgespris', 'I have Norgespris', '50 øre/kWh instead of the spot price') + sw('support', 'Count the power subsidy (strømstøtte)', '90 % of the price above 93,75 øre') +
      numIn('grid', 'Grid rent, energy part', 'øre/kWh', 'Nettleie per kWh incl. VAT – on your grid bill') + numIn('gridFixed', 'Grid rent, fixed part', 'kr / month', 'Kapasitetsledd / fastledd') + numIn('markup', 'Supplier’s markup', 'øre/kWh', 'The markup (påslag) on your power bill') +
      sw('ocr', 'Read the meter from a photo', 'A Photo button on Power bill – the numbers are read on your device') + '</div>' +
      sub('journal-check', 'FDV binder') + '<div class="st-group">' + sw('fdvSuggest', 'Suggest upkeep from the documents', 'On Upkeep, from the manuals you’ve added') +
      (Object.keys(Fe.tools().hfdvoff || {}).length ? '<button type="button" class="st-row st-btn" data-hefdvreset><span><i class="bi bi-arrow-counterclockwise"></i> Show the suggestions I said no to</span></button>' : '') + '</div>';
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
  window.HouseEnergy = { estimate: estimate, years: years, ocr: ocrSheet, pick: pick, suggestions: suggestions };
})();
