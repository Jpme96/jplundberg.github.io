/* House, batch 4 (Oct 2026):
     Season checklists – autumn, winter, spring, summer: the usual jobs (gutters, outdoor taps, tyres …)
                         plus your own, ticked off per season and year.
     Power by month    – from the meter readings: kWh per month, next to the same month last year.
     Home inventory    – valuables with photo, receipt, price and room, the total value, and a list
                         for the insurance company (PDF / CSV).
     House picture     – a small drawing at the top of the House page that lights up what's due.
   Data in dash.tools: hseason ({'2026-autumn': {itemId: date}}), hseasonx (your own items),
   hseasonoff (usual items you've removed), hinv (inventory). Inventory photos stay on this device
   (IndexedDB "dash-inv"). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, K = window.Kit;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +(p[2] || 1)); }
  function today() { return dkey(new Date()); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function daysTo(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function on() { return Fe.on('house'); }
  function hcfg() { return window.HomeLife ? window.HomeLife.cfg('housecfg') : {}; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function card(id, icon, title, actions, body) {
    return '<section class="card kit-card hp4-card" id="' + id + '"><div class="card-head"><h2><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h2>' + (actions ? '<div class="head-actions">' + actions + '</div>' : '') + '</div>' + body + '</section>';
  }
  function tile(label, value, sub) { return '<div class="kit-tile" data-tk="' + esc(label) + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  var mounts = [];
  function mount(name, fn) {
    var el = $t(name); if (!el) return;
    mounts.push(function () { var ok = on(); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; } fn(el); });
  }
  function drawAll() { mounts.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); illu(); }
  ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(drawAll.t); drawAll.t = setTimeout(drawAll, 40); }); });
  window.Vault.onUnlock(function () { setTimeout(drawAll, 60); });
  var prevReload = window.Dash && window.Dash.reload; window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); drawAll(); };

  /* ======================= Season checklists ======================= */
  var SEASONS = [['spring', 'Spring', 'flower1', '#22b35e', [2, 3, 4]], ['summer', 'Summer', 'sun', '#d9a400', [5, 6, 7]], ['autumn', 'Autumn', 'tree', '#e8743b', [8, 9, 10]], ['winter', 'Winter', 'snow', '#3b9de0', [11, 0, 1]]];
  var USUAL = {
    autumn: [['a1', 'Clean the gutters and downpipes', 'house'], ['a2', 'Turn off and drain the outdoor taps', 'droplet'], ['a3', 'Change to winter tyres', 'car-front'], ['a4', 'Put away garden furniture and the hose', 'umbrella'],
      ['a5', 'Check the roof for loose tiles', 'house-exclamation'], ['a6', 'Rake the leaves off the lawn', 'tree-fill'], ['a7', 'Find the snow shovel and ice grips', 'snow'], ['a8', 'Check the seals on doors and windows', 'door-closed'], ['a9', 'Bleed the radiators', 'thermometer-half']],
    winter: [['w1', 'New batteries in the smoke alarms (1 December)', 'alarm'], ['w2', 'Keep snow and ice off the roof edge', 'snow2'], ['w3', 'Keep the heat pump’s outdoor unit free of snow', 'fan'], ['w4', 'Clear snow from vents and the chimney', 'wind'], ['w5', 'Check pipes in cold rooms for frost', 'thermometer-snow']],
    spring: [['s1', 'Change to summer tyres', 'car-front'], ['s2', 'Clean the gutters after the winter', 'house'], ['s3', 'Look for winter damage on the roof and facade', 'house-exclamation'], ['s4', 'Turn the outdoor taps back on and check for leaks', 'droplet'],
      ['s5', 'Wash the windows', 'window'], ['s6', 'Service the lawnmower', 'scissors'], ['s7', 'Check that water runs away from the house', 'water'], ['s8', 'Clean the heat pump filters', 'fan']],
    summer: [['u1', 'Paint or stain the facade or deck where needed', 'brush'], ['u2', 'Wash and oil the deck', 'grid-3x3'], ['u3', 'Clean the ventilation valves', 'wind'], ['u4', 'Wash the facade', 'house'], ['u5', 'Check the roof and flashings', 'house-check']]
  };
  function seasonOf(d) { d = d || new Date(); var m = d.getMonth(); return SEASONS.filter(function (s) { return s[4].indexOf(m) > -1; })[0]; }
  /* the year a season belongs to: winter Dec 2026–Feb 2027 is "2026-winter" */
  function sKey(id, d) { d = d || new Date(); var y = d.getFullYear(); if (id === 'winter' && d.getMonth() < 2) y--; return y + '-' + id; }
  function items(id) {
    var t = Fe.tools(), off = Array.isArray(t.hseasonoff) ? t.hseasonoff : [], mine = ((t.hseasonx || {})[id]) || [];
    return USUAL[id].filter(function (x) { return off.indexOf(x[0]) < 0; }).map(function (x) { return { id: x[0], text: x[1], icon: x[2], usual: true }; })
      .concat(mine.map(function (x) { return { id: x.id, text: x.text, icon: 'check2-square', mine: true }; }));
  }
  function doneMap(key) { var h = Fe.tools().hseason || {}; return h[key] || {}; }
  var view = null, editS = false;
  mount('hseason', function (el) {
    var cur = seasonOf(), sid = view || cur[0], S = SEASONS.filter(function (s) { return s[0] === sid; })[0], key = sKey(sid);
    /* another season: the next one coming, so you can plan ahead */
    if (sid !== cur[0]) { var now0 = new Date(), y = now0.getFullYear() - 1; while (new Date(y, S[4][0], 1) <= now0) y++; key = y + '-' + sid; }
    var l = items(sid), dm = doneMap(key), n = l.filter(function (x) { return dm[x.id]; }).length, pct = l.length ? Math.round(n / l.length * 100) : 0;
    var body = '<div class="seg lp-seg hs-seg">' + SEASONS.map(function (s) { return '<button type="button" data-hsview="' + s[0] + '" aria-pressed="' + (s[0] === sid) + '"><i class="bi bi-' + s[2] + '"></i> ' + s[1] + '</button>'; }).join('') + '</div>' +
      '<div class="hs-prog" style="--c:' + S[3] + '"><span><b>' + n + ' / ' + l.length + '</b> ' + (sid === cur[0] ? 'done this ' + S[1].toLowerCase() : 'done for ' + S[1].toLowerCase() + ' ' + key.slice(0, 4)) + '</span><i><em style="width:' + pct + '%"></em></i></div>' +
      '<ul class="hs-list">' + l.map(function (x) {
        var d = dm[x.id];
        return '<li class="hs-item' + (d ? ' done' : '') + '"><label><input type="checkbox" data-hstick="' + esc(key + '|' + x.id) + '"' + (d ? ' checked' : '') + '><i class="bi bi-' + x.icon + '"></i><span' + (x.mine ? ' data-noi18n' : '') + '>' + esc(x.text) + '</span>' + (d ? '<small>' + esc(fromKey(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</small>' : '') + '</label>' +
          (editS ? '<button type="button" class="icon-btn sm" data-hsdel="' + esc(sid + '|' + x.id) + '" aria-label="Remove"><i class="bi bi-x"></i></button>' : '') + '</li>';
      }).join('') + '</ul>' +
      (editS ? '<form class="hs-add" data-hsadd="' + sid + '"><input name="t" placeholder="Add your own, e.g. Take in the boat" maxlength="80" autocomplete="off"><button class="pill-btn" type="submit" aria-label="Add"><i class="bi bi-plus-lg"></i></button></form>' +
        ((Fe.tools().hseasonoff || []).some(function (id) { return USUAL[sid].some(function (u) { return u[0] === id; }); }) ? '<button type="button" class="text-btn" data-hsreset="' + sid + '"><i class="bi bi-arrow-counterclockwise"></i> Bring back the usual ones</button>' : '') : '');
    el.innerHTML = card('hseason', S[2], 'Season checklist', '<button type="button" class="text-btn" data-hsedit aria-pressed="' + editS + '"><i class="bi bi-' + (editS ? 'check2' : 'pencil') + '"></i> ' + (editS ? 'Done' : 'Edit') + '</button>', body);
  });
  document.addEventListener('change', function (e) {
    var c = e.target.closest('[data-hstick]'); if (!c) return;
    var q = c.dataset.hstick.split('|'), t = Fe.tools(); t.hseason = t.hseason || {}; var m = t.hseason[q[0]] = t.hseason[q[0]] || {};
    if (c.checked) m[q[1]] = today(); else delete m[q[1]];
    Fe.saveTools(t);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-hsadd]'); if (!f) return; e.preventDefault();
    var v = f.t.value.trim(); if (!v) return;
    var t = Fe.tools(); t.hseasonx = t.hseasonx || {}; (t.hseasonx[f.dataset.hsadd] = t.hseasonx[f.dataset.hsadd] || []).push({ id: uid(), text: v }); Fe.saveTools(t);
    setTimeout(function () { var i = document.querySelector('[data-hsadd] input'); if (i) i.focus(); }, 80);
  });
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-hsview]'))) { view = b.dataset.hsview; drawAll(); return; }
    if (e.target.closest('[data-hsedit]')) { editS = !editS; drawAll(); return; }
    if ((b = e.target.closest('[data-hsreset]'))) { var t0 = Fe.tools(); t0.hseasonoff = (t0.hseasonoff || []).filter(function (id) { return !USUAL[b.dataset.hsreset].some(function (u) { return u[0] === id; }); }); Fe.saveTools(t0); return; }
    if ((b = e.target.closest('[data-hsdel]'))) {
      var q = b.dataset.hsdel.split('|'), t = Fe.tools(), old = JSON.parse(JSON.stringify({ x: t.hseasonx || {}, o: t.hseasonoff || [] }));
      if (USUAL[q[0]].some(function (u) { return u[0] === q[1]; })) { t.hseasonoff = (t.hseasonoff || []).concat([q[1]]); }
      else { t.hseasonx = t.hseasonx || {}; t.hseasonx[q[0]] = (t.hseasonx[q[0]] || []).filter(function (x) { return x.id !== q[1]; }); }
      Fe.saveTools(t);
      toast('<i class="bi bi-trash3"></i> Removed', function () { var t2 = Fe.tools(); t2.hseasonx = old.x; t2.hseasonoff = old.o; Fe.saveTools(t2); });
    }
  });
  function seasonLeft() { var s = seasonOf(), key = sKey(s[0]), l = items(s[0]), dm = doneMap(key); return { s: s, left: l.filter(function (x) { return !dm[x.id]; }), all: l }; }
  (window.BriefExtra = window.BriefExtra || []).push(function (add, now) {
    if (!on() || !hcfg().seasonNudge) return;
    var s = seasonOf(now), m = now.getMonth(), first = s[4][0], inFirst = m === first || (m === s[4][1] && now.getDate() <= 15);
    if (!inFirst) return;
    var x = seasonLeft(); if (!x.left.length) return;
    add(66, s[2], s[3], s[1] + ' checklist: ' + (x.all.length - x.left.length) + ' of ' + x.all.length + ' done', x.left.slice(0, 2).map(function (y) { return y.text; }).join(' · '), '/cmd/house/#hseason', { key: 'season:' + sKey(s[0]) + ':' + (x.all.length - x.left.length), tip: true });
  });

  /* ======================= Power by month (from the meter readings) ======================= */
  function readings() { return Fe.list('hmeter').filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') && typeof x.value === 'number'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }
  /* spread the use between two readings evenly over the days in between, then add up per month */
  function perMonth() {
    var r = readings(), out = {};
    for (var i = 1; i < r.length; i++) {
      var a = r[i - 1], b = r[i], days = Math.round((fromKey(b.date) - fromKey(a.date)) / 864e5), use = b.value - a.value;
      if (days <= 0 || use < 0) continue;
      var perDay = use / days, d = fromKey(a.date);
      for (var k = 0; k < days; k++) { var m = dkey(d).slice(0, 7); out[m] = (out[m] || 0) + perDay; d.setDate(d.getDate() + 1); }
    }
    return { m: out, first: r.length ? r[0].date : null, last: r.length ? r[r.length - 1].date : null };
  }
  var MSHORT = function (ym) { return fromKey(ym + '-01').toLocaleDateString('en-GB', { month: 'short' }); };
  var pwSel = null;
  mount('hpower', function (el) {
    var P = perMonth(), keys = Object.keys(P.m).sort();
    if (keys.length < 1 || readings().length < 2) { el.innerHTML = card('hpower', 'bar-chart', 'Power use by month', '', '<p class="empty kit-empty">With two or more meter readings, this shows how many kWh you use each month – next to the same month last year.</p>'); return; }
    var now = today().slice(0, 7), months = [];
    for (var i = 11; i >= 0; i--) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(dkey(d).slice(0, 7)); }
    var ly = function (ym) { return (+ym.slice(0, 4) - 1) + ym.slice(4); };
    var covered = function (ym) { return P.last && ym <= P.last.slice(0, 7) && P.first && ym >= P.first.slice(0, 7); };
    var max = Math.max.apply(null, months.map(function (m) { return Math.max(P.m[m] || 0, P.m[ly(m)] || 0); })) || 1;
    var price = +hcfg().price || 0;
    var lastFull = months.filter(function (m) { return m < now && P.m[m] && P.last >= dkey(new Date(+m.slice(0, 4), +m.slice(5), 0)); }).pop();
    var y12 = months.reduce(function (a, m) { return a + (P.m[m] || 0); }, 0), y12p = months.reduce(function (a, m) { return a + (P.m[ly(m)] || 0); }, 0);
    var sel = pwSel && months.indexOf(pwSel) > -1 ? pwSel : lastFull || months[months.length - 1];
    var sv = P.m[sel] || 0, sp = P.m[ly(sel)] || 0;
    var tiles = '<div class="kit-tiles">' + tile(esc(fromKey(sel + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })), nf.format(sv) + ' <small>kWh</small>', price ? '≈ ' + kr(sv * price / 100) : (sel === now ? 'so far' : '&nbsp;')) +
      tile('Last year', sp ? nf.format(sp) + ' <small>kWh</small>' : '–', sp ? '<span class="' + (sv <= sp ? 'up' : 'dn') + '">' + (sv <= sp ? '−' : '+') + Math.round(Math.abs(sv / sp - 1) * 100) + '%</span>' : 'no readings then') +
      tile('Last 12 months', nf.format(y12) + ' <small>kWh</small>', y12p > y12 * .5 ? '<span class="' + (y12 <= y12p ? 'up' : 'dn') + '">' + (y12 <= y12p ? '−' : '+') + Math.round(Math.abs(y12 / y12p - 1) * 100) + '% vs the year before</span>' : (price ? '≈ ' + kr(y12 * price / 100) : '&nbsp;')) + '</div>';
    var bars = '<div class="hw-chart" role="group" aria-label="kWh per month">' + months.map(function (m) {
      var v = P.m[m] || 0, p = P.m[ly(m)] || 0, est = !covered(m) && v;
      return '<button type="button" class="hw-col' + (m === sel ? ' on' : '') + (m === now ? ' now' : '') + '" data-pwm="' + m + '" aria-label="' + esc(MSHORT(m) + ': ' + nf.format(v) + ' kWh' + (p ? ', last year ' + nf.format(p) : '')) + '">' +
        '<span class="hw-bars">' + (p ? '<i class="hw-prev" style="height:' + (p / max * 100).toFixed(1) + '%"></i>' : '') + '<i class="hw-cur' + (est ? ' est' : '') + '" style="height:' + (v / max * 100).toFixed(1) + '%"></i></span><small>' + esc(MSHORT(m).slice(0, 3)) + '</small></button>';
    }).join('') + '</div><p class="hw-key"><span><i class="hw-sw cur"></i> This year</span><span><i class="hw-sw prev"></i> Same month last year</span>' + (P.last < today() ? '<span class="muted">Up to the last reading, ' + esc(fromKey(P.last).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</span>' : '') + '</p>';
    el.innerHTML = card('hpower', 'bar-chart', 'Power use by month', '', tiles + bars);
  });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-pwm]'); if (b) { pwSel = b.dataset.pwm; drawAll(); } });

  /* ======================= Home inventory ======================= */
  var idb = null;
  function db() { return idb || (idb = new Promise(function (res, rej) { var r = indexedDB.open('dash-inv', 1); r.onupgradeneeded = function () { r.result.createObjectStore('photos'); }; r.onsuccess = function () { res(r.result); }; r.onerror = rej; })); }
  function putPh(id, blob) { return db().then(function (d) { return new Promise(function (res) { var t = d.transaction('photos', 'readwrite'); t.objectStore('photos').put(blob, id); t.oncomplete = res; }); }); }
  function getPh(id) { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('photos').objectStore('photos').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function delPh(id) { return db().then(function (d) { d.transaction('photos', 'readwrite').objectStore('photos').delete(id); }).catch(function () {}); }
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(); img.onload = function () { var s = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(function (b) { b ? res(b) : rej(); }, 'image/jpeg', .82); URL.revokeObjectURL(img.src); };
      img.onerror = rej; img.src = URL.createObjectURL(file);
    });
  }
  var ROOMS = [['living', 'Living room'], ['kitchen', 'Kitchen'], ['bedroom', 'Bedroom'], ['office', 'Office'], ['bathroom', 'Bathroom'], ['hall', 'Hall'], ['storage', 'Storage or attic'], ['garage', 'Garage or shed'], ['outdoor', 'Outdoors'], ['other', 'Other']];
  var CATS = [['electronics', 'Electronics', 'laptop', '#3987e5'], ['appliance', 'Appliance', 'plug', '#0891b2'], ['furniture', 'Furniture', 'lamp', '#c98500'], ['jewellery', 'Jewellery and watches', 'gem', '#d55181'], ['sport', 'Bikes and sport', 'bicycle', '#22b35e'],
    ['tools', 'Tools', 'tools', '#7a8794'], ['art', 'Art and design', 'palette', '#8a6fdf'], ['clothes', 'Clothes and bags', 'bag', '#e8743b'], ['music', 'Instruments', 'music-note-beamed', '#e66767'], ['other', 'Other', 'box-seam', '#6b6d73']];
  function cat(id) { return CATS.filter(function (c) { return c[0] === id; })[0] || CATS[CATS.length - 1]; }
  function room(id) { return (ROOMS.filter(function (r) { return r[0] === id; })[0] || [0, ''])[1]; }
  var INV = { key: 'hinv', addTitle: 'New item', editTitle: 'Edit item', fields: [
    { k: 'name', type: 'title', label: 'Item', ph: 'e.g. MacBook Pro 14″, Sofa, Bike', req: true },
    { k: 'cat', label: 'Kind', type: 'select', options: CATS.map(function (c) { return [c[0], c[1]]; }), def: 'electronics' },
    { k: 'room', label: 'Room', type: 'select', options: ROOMS, def: 'living' },
    { k: 'price', label: 'Price paid', type: 'number', suffix: 'kr' },
    { k: 'bought', label: 'Bought', type: 'date' },
    { k: 'brand', label: 'Brand and model', ph: 'Optional' },
    { k: 'serial', label: 'Serial number', ph: 'Optional' },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'Where the receipt is, the shop, warranty …' }],
    onDelete: function (it) { if (it.photo) delPh(it.photo); if (it.receipt) delPh(it.receipt); } };
  var invCol = K && $t('hinv') ? K.collection({
    mount: $t('hinv'), feature: 'house', key: 'hinv', icon: 'box-seam', title: 'Home inventory', addLabel: 'Item', limit: 8,
    addTitle: INV.addTitle, editTitle: INV.editTitle, fields: INV.fields, onDelete: INV.onDelete,
    empty: 'Note your valuables with a photo, price and receipt – if there’s a fire or a break-in, the list for the insurance company is ready.',
    headExtra: function (l) { return l.length ? '<button type="button" class="text-btn" data-invpdf><i class="bi bi-file-earmark-pdf"></i> Insurance list</button>' : ''; },
    sort: function (a, b) { return (+b.price || 0) - (+a.price || 0); },
    summary: function (l) {
      if (!l.length) return '';
      var tot = l.reduce(function (a, x) { return a + (+x.price || 0); }, 0), rc = l.filter(function (x) { return x.receipt; }).length, ph = l.filter(function (x) { return x.photo; }).length;
      return '<div class="kit-tiles">' + tile('Items', l.length, ph + ' with a photo') + tile('Total value', nf.format(tot) + ' <small>kr</small>', 'price paid') + tile('Receipts', rc + ' <small>/ ' + l.length + '</small>', rc < l.length ? 'add the rest' : 'all saved') + '</div>';
    },
    row: function (x) {
      var c = cat(x.cat);
      return { icon: c[2], color: c[3], title: x.name, sub: esc([room(x.room), x.brand, x.bought ? x.bought.slice(0, 4) : ''].filter(Boolean).join(' · ')) + (x.receipt ? ' <i class="bi bi-receipt" title="Receipt saved"></i>' : '') + (x.photo ? ' <i class="bi bi-image" title="Photo saved"></i>' : ''), right: x.price ? esc(kr(x.price)) : '' };
    },
    detail: function (x) {
      return '<div class="inv-ph">' + ['photo', 'receipt'].map(function (k) {
        return '<div class="inv-slot">' + (x[k] ? '<img data-invimg="' + esc(x[k]) + '" alt="">' : '<span class="inv-none"><i class="bi bi-' + (k === 'photo' ? 'camera' : 'receipt') + '"></i></span>') +
          '<label class="text-btn"><i class="bi bi-' + (k === 'photo' ? 'camera' : 'receipt') + '"></i> ' + (x[k] ? (k === 'photo' ? 'New photo' : 'New receipt') : (k === 'photo' ? 'Add photo' : 'Add receipt')) +
          '<input type="file" accept="image/*" ' + (k === 'photo' ? 'capture="environment" ' : '') + 'data-invfile="' + esc(x.id + '|' + k) + '" hidden></label></div>';
      }).join('') + '</div>' + (x.serial ? '<p class="muted hl-small">Serial ' + esc(x.serial) + '</p>' : '') + (x.notes ? '<p class="kit-notes">' + esc(x.notes) + '</p>' : '');
    },
    afterRender: function (el) { el.querySelectorAll('img[data-invimg]').forEach(function (im) { getPh(im.dataset.invimg).then(function (b) { if (b) im.src = URL.createObjectURL(b); }); }); },
    onClick: function (e) { if (e.target.closest('[data-invpdf]')) invList(); }
  }) : null;
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-invfile]'); if (!i || !i.files.length) return;
    var q = i.dataset.invfile.split('|'), it = Fe.list('hinv').filter(function (x) { return x.id === q[0]; })[0]; if (!it) return;
    var pid = 'inv-' + q[1] + '-' + q[0] + '-' + Date.now().toString(36);
    shrink(i.files[0]).then(function (b) { return putPh(pid, b); }).then(function () {
      if (it[q[1]]) delPh(it[q[1]]);
      var t = Fe.tools(); (t.hinv || []).forEach(function (x) { if (x.id === q[0]) x[q[1]] = pid; }); Fe.saveTools(t);
      toast('<i class="bi bi-check2"></i> ' + (q[1] === 'photo' ? 'Photo' : 'Receipt') + ' saved on this device');
    }).catch(function () { toast('<i class="bi bi-exclamation-triangle"></i> Couldn’t read that picture'); });
  });
  /* the list for the insurance company: A4, with photos – Save as PDF from the print sheet */
  function invList() {
    var l = Fe.list('hinv').slice().sort(function (a, b) { return (a.room || '').localeCompare(b.room || '') || (+b.price || 0) - (+a.price || 0); });
    var me = (function () { try { return JSON.parse(localStorage.getItem('dash.profile')) || {}; } catch (e) { return {}; } })();
    var tot = l.reduce(function (a, x) { return a + (+x.price || 0); }, 0), withPh = true;
    var bg = document.createElement('div'); bg.className = 'rp-bg';
    bg.innerHTML = '<div class="rp-bar"><button type="button" class="text-btn" data-ilclose><i class="bi bi-x-lg"></i> Close</button><span class="spacer"></span><label class="rp-opt"><input type="checkbox" data-ilph checked> Photos</label>' +
      '<button type="button" class="text-btn" data-ilcsv><i class="bi bi-filetype-csv"></i> CSV</button><button type="button" class="pill-btn" data-ilprint><i class="bi bi-file-earmark-pdf"></i> Save as PDF</button></div>' +
      '<p class="rp-hint">In the print window, choose <b>Save as PDF</b>. Photos and receipts come from this device.</p><article class="rp-doc"></article>';
    document.body.appendChild(bg); document.body.classList.add('rp-open');
    var doc = bg.querySelector('.rp-doc');
    function draw() {
      var rooms = []; l.forEach(function (x) { var r = room(x.room) || 'Other'; if (rooms.indexOf(r) < 0) rooms.push(r); });
      doc.innerHTML = '<header class="rp-head"><div><p class="rp-kick">Home inventory</p><h1>' + esc(me.name || 'Contents') + '</h1><p class="rp-addr">' + esc(me.home && typeof me.home === 'object' ? (me.home.addr || me.home.name || '') : (me.home || '')) + '</p></div>' +
        '<div class="iv-no"><small>Total value</small><b>' + esc(kr(tot)) + '</b></div></header>' +
        '<p class="rp-intro">' + l.length + ' items · ' + l.filter(function (x) { return x.receipt; }).length + ' with receipt · made ' + esc(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })) + '</p>' +
        rooms.map(function (r) {
          var rl = l.filter(function (x) { return (room(x.room) || 'Other') === r; });
          return '<h2>' + esc(r) + ' <small class="il-sum">' + esc(kr(rl.reduce(function (a, x) { return a + (+x.price || 0); }, 0))) + '</small></h2>' + rl.map(function (x) {
            return '<div class="rp-f il-f">' + (withPh && x.photo ? '<img class="il-ph" data-ilimg="' + esc(x.photo) + '" alt="">' : '<span class="il-ph il-noph"></span>') +
              '<div class="rp-ft"><p><b>' + esc(x.name) + '</b>' + (x.brand ? ' – ' + esc(x.brand) : '') + '</p><p class="rp-act">' + esc([cat(x.cat)[1], x.bought ? 'bought ' + fromKey(x.bought).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '', x.serial ? 'serial ' + x.serial : '', x.receipt ? 'receipt saved' : 'no receipt'].filter(Boolean).join(' · ')) + '</p>' + (x.notes ? '<p class="rp-act">' + esc(x.notes) + '</p>' : '') + '</div>' +
              '<b class="il-price">' + (x.price ? esc(kr(x.price)) : '–') + '</b>' + (withPh && x.receipt ? '<img class="il-rc" data-ilimg="' + esc(x.receipt) + '" alt="">' : '') + '</div>';
          }).join('');
        }).join('') + '<footer class="rp-foot">Home inventory · ' + esc(me.name || '') + ' · ' + esc(today()) + '</footer>';
      doc.querySelectorAll('img[data-ilimg]').forEach(function (im) { getPh(im.dataset.ilimg).then(function (b) { if (!b) return im.remove(); var fr = new FileReader(); fr.onload = function () { im.src = fr.result; }; fr.readAsDataURL(b); }); });
    }
    function close() { bg.remove(); document.body.classList.remove('rp-open'); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    bg.addEventListener('change', function (e) { if (e.target.matches('[data-ilph]')) { withPh = e.target.checked; draw(); } });
    bg.addEventListener('click', function (e) {
      if (e.target.closest('[data-ilclose]')) return close();
      if (e.target.closest('[data-ilcsv]')) {
        var rows = [['Item', 'Brand/model', 'Kind', 'Room', 'Bought', 'Price', 'Serial', 'Receipt', 'Notes']].concat(l.map(function (x) { return [x.name, x.brand || '', cat(x.cat)[1], room(x.room), x.bought || '', String(x.price || ''), x.serial || '', x.receipt ? 'yes' : 'no', x.notes || '']; }));
        var csv = '﻿' + rows.map(function (r) { return r.map(function (v) { v = String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\r\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'home-inventory-' + today() + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        return;
      }
      if (e.target.closest('[data-ilprint]')) { var t = document.title; document.title = 'Home inventory ' + today(); var done = function () { document.title = t; window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(function () { window.print(); }, 300); setTimeout(done, 60000); }
    });
    draw();
  }
  (window.CommandExtra = window.CommandExtra || []).push(function () { return on() ? [{ i: 'box-seam', t: 'Home inventory', s: 'House', run: function () { location.href = '/cmd/house/#hinv'; }, x: 'inventory insurance forsikring innbo valuables' }] : []; });

  /* ======================= The house picture (top of the House page) ======================= */
  function due() {
    var HL = window.HomeLife, out = { roof: [], bins: [], meter: [], door: [], garden: [], window: [] };
    if (!HL) return out;
    var lead = +hcfg().lead || 0;
    Fe.list('hmaint').forEach(function (x) {
      var n = daysTo(HL.nextDue(x)); if (n > lead) return;
      var t = (x.title || '').toLowerCase(), k = /gutter|takrenne|roof|tak/.test(t) ? 'roof' : /smoke|røyk|fire|brann|alarm/.test(t) ? 'door' : /drain|sluk|water|vann|bath|sealant|fuge/.test(t) ? 'window' : /heat pump|varmepumpe|filter|vent/.test(t) ? 'meter' : 'door';
      out[k].push({ t: x.title, href: '#hmaint', late: n < 0 });
    });
    var tm = addDays(today(), 1);
    Fe.list('hbins').forEach(function (b) { var nx = HL.nextPickup(b); if (nx === today() || nx === tm) out.bins.push({ t: (b.title || 'Bin') + (nx === today() ? ' – today' : ' – tomorrow'), href: '#hbins' }); });
    var r = readings(); if (hcfg().meterNudge && (!r.length || daysTo(r[r.length - 1].date) < -31)) out.meter.push({ t: 'Read the meter', href: '#hmeter' });
    var s = seasonLeft(); if (s.left.length) out.garden.push({ t: s.s[1] + ' checklist: ' + s.left.length + ' left', href: '#hseason' });
    return out;
  }
  function illu() {
    var hero = /\/cmd\/house\/$/.test(location.pathname) && document.querySelector('.fp-hero'); if (!hero) return;
    var box = document.getElementById('hsIllu');
    if (!on() || !hcfg().illu) { if (box) box.remove(); hero.classList.remove('has-illu'); return; }
    if (!box) { box = document.createElement('figure'); box.id = 'hsIllu'; box.className = 'hs-illu'; hero.appendChild(box); hero.classList.add('has-illu'); }
    var d = due(), sid = seasonOf()[0], n = Object.keys(d).reduce(function (a, k) { return a + d[k].length; }, 0);
    var hot = function (k) { return d[k].length ? ' hot' : ''; };
    var badge = function (k, x, y) { return d[k].length ? '<g class="hs-b" transform="translate(' + x + ' ' + y + ')"><circle r="9"/><text y="3.6" text-anchor="middle">' + d[k].length + '</text></g>' : ''; };
    var leaf = { spring: '#5fc27e', summer: '#2f9e57', autumn: '#e8743b', winter: '#cfe3f2' }[sid];
    var svg = '<svg viewBox="0 0 240 150" role="img" aria-label="Your house">' +
      '<rect x="0" y="128" width="240" height="22" class="hs-ground"/>' +
      (sid === 'winter' ? '<path d="M0 128 Q60 122 120 127 T240 126 V132 H0Z" class="hs-snow"/>' : '') +
      /* tree */
      '<g class="hs-part' + hot('garden') + '" data-hsgo="hseason"><rect x="200" y="96" width="6" height="32" class="hs-trunk"/><circle cx="203" cy="88" r="20" fill="' + leaf + '" class="hs-crown"/>' + (sid === 'autumn' ? '<circle cx="190" cy="124" r="2.5" fill="#e8743b"/><circle cx="215" cy="126" r="2" fill="#c98500"/>' : '') + '</g>' +
      /* house */
      '<g class="hs-part' + hot('door') + '" data-hsgo="hmaint"><rect x="56" y="68" width="112" height="60" rx="3" class="hs-wall"/><rect x="100" y="94" width="22" height="34" rx="2" class="hs-door"/><circle cx="117" cy="112" r="1.6" class="hs-knob"/></g>' +
      '<g class="hs-part' + hot('window') + '" data-hsgo="hmaint"><rect x="68" y="80" width="22" height="20" rx="2" class="hs-win"/><rect x="134" y="80" width="22" height="20" rx="2" class="hs-win"/><path d="M79 80V100M68 90H90M145 80V100M134 90H156" class="hs-bar"/></g>' +
      '<g class="hs-part' + hot('roof') + '" data-hsgo="hmaint"><path d="M46 70 L112 26 L178 70 Z" class="hs-roof"/>' + (sid === 'winter' ? '<path d="M52 66 L112 28 L172 66 L166 64 L112 32 L58 64Z" class="hs-snow"/>' : '') + '<rect x="140" y="34" width="12" height="20" class="hs-chim"/><path d="M48 71 H176" class="hs-gutter"/></g>' +
      /* meter box */
      '<g class="hs-part' + hot('meter') + '" data-hsgo="hmeter"><rect x="158" y="102" width="14" height="18" rx="2" class="hs-meter"/><path d="M166 105 L162 112 H166 L163 118 L169 110 H165 Z" class="hs-bolt"/></g>' +
      /* bins */
      '<g class="hs-part' + hot('bins') + '" data-hsgo="hbins"><rect x="18" y="104" width="14" height="24" rx="2" class="hs-bin a"/><rect x="34" y="108" width="12" height="20" rx="2" class="hs-bin b"/><rect x="16" y="101" width="18" height="4" rx="1.5" class="hs-lid"/></g>' +
      (window.SceneDeco ? window.SceneDeco('house') : '') +
      badge('roof', 112, 18) + badge('door', 128, 64) + badge('window', 92, 78) + badge('meter', 176, 98) + badge('bins', 32, 96) + badge('garden', 222, 70) +
      '</svg>';
    var list = []; Object.keys(d).forEach(function (k) { d[k].forEach(function (x) { list.push(x); }); });
    var cap = n ? list.slice(0, 3).map(function (x) { return '<a href="' + x.href + '"' + (x.late ? ' class="late"' : '') + '>' + esc(x.t) + '</a>'; }).join(' · ') + (list.length > 3 ? ' · +' + (list.length - 3) : '') : 'Nothing due – the house is in good shape.';
    var html = svg + '<figcaption>' + cap + '</figcaption>';
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-hsgo]'), a = e.target.closest('#hsIllu a[href^="#"]');
    var id = g ? g.dataset.hsgo : a ? a.getAttribute('href').slice(1) : null; if (!id) return;
    e.preventDefault(); var c = document.getElementById(id); if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'start' }); c.classList.add('sr-flash'); setTimeout(function () { c.classList.remove('sr-flash'); }, 1600); }
  });

  window.HousePlus = { perMonth: perMonth, seasonOf: seasonOf, seasonLeft: seasonLeft, due: due };
})();
