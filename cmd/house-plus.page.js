/* House, batch 4 (Oct 2026):
     Season checklists – autumn, winter, spring, summer: the usual jobs (gutters, outdoor taps, tyres …)
                         plus your own, ticked off per season and year.
     Power by month    – from the meter readings: kWh per month, next to the same month last year.
     Home inventory    – valuables with photo, receipt, price and room, the total value, and a list
                         for the insurance company (PDF / CSV).
     House picture     – a small drawing at the top of the House page that lights up what's due.
   Data in dash.tools: hseason ({'2026-autumn': {itemId: date}}), hseasonx (your own items),
   hseasonoff (usual items you've removed), hinv (inventory). Inventory photos are kept on the device and synced encrypted (filesync.js)
   (IndexedDB "dash-inv"). */
/* The page part of house-plus.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is house-plus.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["plus"]; if (!__c) return;
  var on = __c.on, seasonOf = __c.seasonOf, SEASONS = __c.SEASONS, sKey = __c.sKey, items = __c.items, doneMap = __c.doneMap, fromKey = __c.fromKey, Fe = __c.Fe, USUAL = __c.USUAL, today = __c.today, perMonth = __c.perMonth, readings = __c.readings, dkey = __c.dkey, hcfg = __c.hcfg, due = __c.due;
  var K = window.Kit;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
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
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); drawAll(); };
  var view = null;
  var editS = false;
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
      (editS ? '<form class="hs-add" data-hsadd="' + sid + '"><input name="t" placeholder="Add your own, e.g. Take in the boat" data-t-placeholder="ui.add-your-own-e-g-take-in-the-boat" maxlength="80" autocomplete="off"><button class="pill-btn" type="submit" aria-label="Add" data-t-aria-label="ui.add"><i class="bi bi-plus-lg"></i></button></form>' +
        ((Fe.tools().hseasonoff || []).some(function (id) { return USUAL[sid].some(function (u) { return u[0] === id; }); }) ? '<button type="button" class="text-btn" data-hsreset="' + sid + '"><i class="bi bi-arrow-counterclockwise"></i> <span data-t="ui.bring-back-the-usual-ones">Bring back the usual ones</span></button>' : '') : '');
    el.innerHTML = card('hseason', S[2], I18N.k('ui.season-checklist', 'Season checklist'), '<button type="button" class="text-btn" data-hsedit aria-pressed="' + editS + '"><i class="bi bi-' + (editS ? 'check2' : 'pencil') + '"></i> ' + (editS ? 'Done' : 'Edit') + '</button>', body);
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
  var MSHORT = function (ym) { return fromKey(ym + '-01').toLocaleDateString('en-GB', { month: 'short' }); };
  var pwSel = null;
  mount('hpower', function (el) {
    var P = perMonth(), keys = Object.keys(P.m).sort();
    if (keys.length < 1 || readings().length < 2) { el.innerHTML = card('hpower', 'bar-chart', I18N.k('ui.power-use-by-month', 'Power use by month'), '', '<p class="empty kit-empty" data-t="ui.with-two-or-more-meter-readings-this-sho">With two or more meter readings, this shows how many kWh you use each month – next to the same month last year.</p>'); return; }
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
      tile(I18N.k('ui.last-year', 'Last year'), sp ? nf.format(sp) + ' <small>kWh</small>' : '–', sp ? '<span class="' + (sv <= sp ? 'up' : 'dn') + '">' + (sv <= sp ? '−' : '+') + Math.round(Math.abs(sv / sp - 1) * 100) + '%</span>' : 'no readings then') +
      tile(I18N.k('ui.last-12-months', 'Last 12 months'), nf.format(y12) + ' <small>kWh</small>', y12p > y12 * .5 ? '<span class="' + (y12 <= y12p ? 'up' : 'dn') + '">' + (y12 <= y12p ? '−' : '+') + Math.round(Math.abs(y12 / y12p - 1) * 100) + '% vs the year before</span>' : (price ? '≈ ' + kr(y12 * price / 100) : '&nbsp;')) + '</div>';
    var bars = '<div class="hw-chart" role="group" aria-label="kWh per month">' + months.map(function (m) {
      var v = P.m[m] || 0, p = P.m[ly(m)] || 0, est = !covered(m) && v;
      return '<button type="button" class="hw-col' + (m === sel ? ' on' : '') + (m === now ? ' now' : '') + '" data-pwm="' + m + '" aria-label="' + esc(MSHORT(m) + ': ' + nf.format(v) + ' kWh' + (p ? ', last year ' + nf.format(p) : '')) + '">' +
        '<span class="hw-bars">' + (p ? '<i class="hw-prev" style="height:' + (p / max * 100).toFixed(1) + '%"></i>' : '') + '<i class="hw-cur' + (est ? ' est' : '') + '" style="height:' + (v / max * 100).toFixed(1) + '%"></i></span><small>' + esc(MSHORT(m).slice(0, 3)) + '</small></button>';
    }).join('') + '</div><p class="hw-key"><span><i class="hw-sw cur"></i> <span data-t="ui.this-year">This year</span></span><span><i class="hw-sw prev"></i> <span data-t="ui.same-month-last-year">Same month last year</span></span>' + (P.last < today() ? '<span class="muted">Up to the last reading, ' + esc(fromKey(P.last).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</span>' : '') + '</p>';
    el.innerHTML = card('hpower', 'bar-chart', I18N.k('ui.power-use-by-month', 'Power use by month'), '', tiles + bars);
  });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-pwm]'); if (b) { pwSel = b.dataset.pwm; drawAll(); } });
  var idb = null;
  function db() { return idb || (idb = new Promise(function (res, rej) { var r = indexedDB.open('dash-inv', 1); r.onupgradeneeded = function () { r.result.createObjectStore('photos'); }; r.onsuccess = function () { res(r.result); }; r.onerror = rej; })); }
  function keepPh(id, blob) { return db().then(function (d) { return new Promise(function (res) { var t = d.transaction('photos', 'readwrite'); t.objectStore('photos').put(blob, id); t.oncomplete = res; }); }); }
  function putPh(id, blob) { return keepPh(id, blob).then(function () { if (window.FileSync) window.FileSync.up(id, blob); }); }
  function localPh(id) { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('photos').objectStore('photos').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function getPh(id) { return localPh(id).then(function (b) { if (b || !window.FileSync) return b; return window.FileSync.down(id).then(function (nb) { if (nb) keepPh(id, nb); return nb; }); }); }
  function usedBy(fid, except) { return Fe.list('hinv').filter(function (x) { return x.id !== except && (x.photo === fid || x.receipt === fid); }); }
  function dropPh(fid, except) { if (fid && !usedBy(fid, except).length) delPh(fid); }
  function delPh(id) { if (window.FileSync) window.FileSync.del(id); return db().then(function (d) { d.transaction('photos', 'readwrite').objectStore('photos').delete(id); }).catch(function () {}); }
  if (/\/cmd\/house\/$/.test(location.pathname.replace(/index\.html$/, ''))) window.Vault.onUnlock(function () {
    setTimeout(function () {
      if (!window.FileSync || !Fe.on('house')) return;
      var ids = []; Fe.list('hinv').forEach(function (x) { if (x.photo) ids.push(x.photo); if (x.receipt) ids.push(x.receipt); });
      if (ids.length) window.FileSync.sync({ ids: ids, getLocal: localPh, putLocal: keepPh, download: false });
    }, 1500);
  });
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
    { k: 'ownWith', label: 'Owned together with', ph: 'Optional – e.g. your partner' },
    { k: 'ownPct', label: 'Your share, %', type: 'number', suffix: '%', help: 'When you own it together: your part (0 = all theirs)' },
    { k: 'agreed', label: 'Agreed in writing', type: 'date', help: 'When you both accepted this entry in the household register' },
    { k: 'brand', label: 'Brand and model', ph: 'Optional' },
    { k: 'serial', label: 'Serial number', ph: 'Optional' },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'Where the receipt is, the shop, warranty …' }],
    onDelete: function (it) { dropPh(it.photo, it.id); dropPh(it.receipt, it.id); } };
  var invCol = K && $t('hinv') ? K.collection({
    mount: $t('hinv'), feature: 'house', key: 'hinv', icon: 'box-seam', title: 'Home inventory', addLabel: 'Item', limit: 8,
    addTitle: INV.addTitle, editTitle: INV.editTitle, fields: INV.fields, onDelete: INV.onDelete,
    empty: 'Note your valuables with a photo, price and receipt – if there’s a fire or a break-in, the list for the insurance company is ready.',
    headExtra: function (l) { return l.length ? '<button type="button" class="text-btn" data-invpdf><i class="bi bi-file-earmark-pdf"></i> <span data-t="ui.insurance-list">Insurance list</span></button><button type="button" class="text-btn" data-invreg><i class="bi bi-journal-check"></i> Register</button>' : ''; },
    sort: function (a, b) { return (+b.price || 0) - (+a.price || 0); },
    summary: function (l) {
      if (!l.length) return '';
      var tot = l.reduce(function (a, x) { return a + (+x.price || 0); }, 0), rc = l.filter(function (x) { return x.receipt; }).length, ph = l.filter(function (x) { return x.photo; }).length;
      return '<div class="kit-tiles">' + tile('Items', l.length, ph + ' with a photo') + tile(I18N.k('ui.total-value', 'Total value'), nf.format(tot) + ' <small>kr</small>', 'price paid') + tile('Receipts', rc + ' <small>/ ' + l.length + '</small>', rc < l.length ? 'add the rest' : 'all saved') + '</div>';
    },
    row: function (x) {
      var c = cat(x.cat);
      var own = x.ownWith && +x.ownPct > 0 && +x.ownPct < 100 ? 'yours ' + String(x.ownPct).replace('.', ',') + ' % · with ' + x.ownWith : x.ownWith && x.ownPct !== '' && x.ownPct != null && +x.ownPct === 0 ? 'all ' + x.ownWith + '’s' : x.ownWith ? 'with ' + x.ownWith : '';
      if (x.ownWith && !x.agreed) own += ' · not agreed yet';
      return { icon: c[2], color: c[3], title: x.name, sub: esc([room(x.room), x.brand, x.bought ? x.bought.slice(0, 4) : '', own].filter(Boolean).join(' · ')) + (x.receipt ? ' <i class="bi bi-receipt" title="Receipt saved" data-t-title="ui.receipt-saved"></i>' : '') + (x.photo ? ' <i class="bi bi-image" title="Photo saved" data-t-title="ui.photo-saved"></i>' : ''), right: x.price ? esc(kr(x.price)) : '' };
    },
    detail: function (x) {
      var others = x.receipt ? usedBy(x.receipt, x.id).filter(function (o) { return o.receipt === x.receipt; }) : [];
      var canShare = !x.receipt && Fe.list('hinv').some(function (o) { return o.id !== x.id && o.receipt; });
      return '<div class="inv-ph">' + ['photo', 'receipt'].map(function (k) {
        return '<div class="inv-slot">' + (x[k] && k === 'receipt' && x.receiptPdf ? '<a class="inv-pdf" target="_blank" rel="noopener" data-invpdfopen="' + esc(x[k]) + '"><i class="bi bi-file-earmark-pdf"></i><span>Open the PDF receipt</span></a>' : x[k] ? '<img data-invimg="' + esc(x[k]) + '" alt="">' : '<span class="inv-none"><i class="bi bi-' + (k === 'photo' ? 'camera' : 'receipt') + '"></i></span>') +
          '<label class="text-btn"><i class="bi bi-' + (k === 'photo' ? 'camera' : 'receipt') + '"></i> ' + (x[k] ? (k === 'photo' ? 'New photo' : 'New receipt') : (k === 'photo' ? 'Add photo' : 'Add receipt')) +
          '<input type="file" accept="' + (k === 'receipt' ? 'image/*,application/pdf,.pdf' : 'image/*') + '" ' + (k === 'photo' ? 'capture="environment" ' : '') + 'data-invfile="' + esc(x.id + '|' + k) + '" hidden></label>' +
          (x[k] ? '<button type="button" class="text-btn danger" data-invrm="' + esc(x.id + '|' + k) + '"><i class="bi bi-trash3"></i> <span data-t="ui.remove">Remove</span></button>' : '') +
          (k === 'receipt' && canShare ? '<button type="button" class="text-btn" data-invsame="' + esc(x.id) + '"><i class="bi bi-link-45deg"></i> <span data-t="ui.same-receipt-as">Same receipt as…</span></button>' : '') + '</div>';
      }).join('') + '</div>' +
      (others.length ? '<p class="muted hl-small inv-same"><i class="bi bi-link-45deg"></i> Same receipt as ' + esc(others.map(function (o) { return o.name; }).join(', ')) + '</p>' : '') + (x.serial ? '<p class="muted hl-small">Serial ' + esc(x.serial) + '</p>' : '') + (x.notes ? '<p class="kit-notes">' + esc(x.notes) + '</p>' : '') +
        (window.SharedHome && window.SharedHome.forInv && (x.ownWith || x.shared) ? (function () {
          var i = window.SharedHome.invInfo ? window.SharedHome.invInfo(x.id) : null, h = '<button type="button" class="text-btn" data-invsplit="' + esc(x.id) + '"><i class="bi bi-people"></i> <span data-t="ui.split-and-who-paid">Split and who paid</span></button>';
          if (i && i.owe) h += '<button type="button" class="text-btn" data-invpb="' + esc(x.id) + '"><i class="bi bi-calendar2-check"></i> Paying back ' + esc(kr(i.owe.pay)) + ' a month · ' + esc(kr(i.owe.left)) + ' left</button>';
          else if (i && i.theyPaid && i.mine > 0) h += '<button type="button" class="text-btn" data-invpb="' + esc(x.id) + '"><i class="bi bi-calendar2-check"></i> Pay ' + esc(i.p.name) + ' back monthly</button>';
          var who = i && i.item ? (i.item.payer === 'me' ? 'You paid' : i.theyPaid ? esc(i.p.name) + ' paid' : '') : '';
          return '<p class="inv-split">' + (who ? '<span class="muted">' + who + ' · your part ' + esc(kr(i.mine)) + '</span>' : '') + h + '</p>';
        })() : '');
    },
    afterRender: function (el) {
      el.querySelectorAll('a[data-invpdfopen]').forEach(function (a) { getPh(a.dataset.invpdfopen).then(function (b) { if (b) a.href = URL.createObjectURL(b.type ? b : new Blob([b], { type: 'application/pdf' })); else a.querySelector('span').textContent = 'PDF receipt isn’t on this device yet'; }); });
      el.querySelectorAll('img[data-invimg]').forEach(function (im) { getPh(im.dataset.invimg).then(function (b) { if (b) im.src = URL.createObjectURL(b); }); }); },
    onClick: function (e) {
      if (e.target.closest('[data-invpdf]')) invList(); if (e.target.closest('[data-invreg]')) register();
      var sp = e.target.closest('[data-invsplit]'); if (sp && window.SharedHome) window.SharedHome.forInv(sp.dataset.invsplit);
      var rm = e.target.closest('[data-invrm]'); if (rm) removeFile(rm.dataset.invrm);
      var sm = e.target.closest('[data-invsame]'); if (sm) sameSheet(sm.dataset.invsame);
      var pb = e.target.closest('[data-invpb]'); if (pb && window.SharedHome) window.SharedHome.payBackInv(pb.dataset.invpb); }
  }) : null;
  if (invCol) window.addEventListener('fin:change', function () { var ae = document.activeElement; if (ae && ae.closest && ae.closest('[data-tool="hinv"]') && ae.matches('input, select, textarea')) return; invCol.render(); });
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-invfile]'); if (!i || !i.files.length) return;
    var q = i.dataset.invfile.split('|'), it = Fe.list('hinv').filter(function (x) { return x.id === q[0]; })[0]; if (!it) return;
    var pid = 'inv-' + q[1] + '-' + q[0] + '-' + Date.now().toString(36);
    var file = i.files[0], isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    /* a PDF receipt (most web shops send one) is kept as it is; pictures are made smaller */
    if (isPdf && file.size > 15e6) { toast('<i class="bi bi-exclamation-triangle"></i> That PDF is over 15 MB – try a smaller one'); i.value = ''; return; }
    (isPdf ? Promise.resolve(file) : shrink(file)).then(function (b) { return putPh(pid, b); }).then(function () {
      if (it[q[1]]) dropPh(it[q[1]], it.id);
      var t = Fe.tools(); (t.hinv || []).forEach(function (x) { if (x.id === q[0]) { x[q[1]] = pid; if (q[1] === 'receipt') { delete x.receiptOf; if (isPdf) x.receiptPdf = 1; else delete x.receiptPdf; } } }); Fe.saveTools(t);
      toast('<i class="bi bi-check2"></i> ' + (q[1] === 'photo' ? 'Photo' : isPdf ? 'PDF receipt' : 'Receipt') + ' saved' + (window.FileSync && window.FileSync.state().ok !== false ? ' – syncing to your other devices' : ' on this device'));
    }).catch(function () { toast('<i class="bi bi-exclamation-triangle"></i> Couldn’t read that file – a photo (JPG, PNG, HEIC) or a PDF works'); });
    i.value = '';
  });
  function removeFile(v) {
    var q = v.split('|'), it = Fe.list('hinv').filter(function (x) { return x.id === q[0]; })[0]; if (!it || !it[q[1]]) return;
    var fid = it[q[1]], was = { v: fid, pdf: it.receiptPdf, of: it.receiptOf };
    var t = Fe.tools(); (t.hinv || []).forEach(function (x) { if (x.id === q[0]) { delete x[q[1]]; if (q[1] === 'receipt') { delete x.receiptPdf; delete x.receiptOf; } } }); Fe.saveTools(t);
    var gone = false, timer = setTimeout(function () { gone = true; dropPh(fid); }, 8000);
    toast('<i class="bi bi-trash3"></i> ' + (q[1] === 'photo' ? 'Photo' : 'Receipt') + ' removed', function () {
      if (gone) return; clearTimeout(timer);
      var t2 = Fe.tools(); (t2.hinv || []).forEach(function (x) { if (x.id === q[0]) { x[q[1]] = was.v; if (q[1] === 'receipt') { if (was.pdf) x.receiptPdf = 1; if (was.of) x.receiptOf = was.of; } } }); Fe.saveTools(t2);
    });
  }
  function sameSheet(id) {
    var HFS = window.HouseFiles, it = Fe.list('hinv').filter(function (x) { return x.id === id; })[0]; if (!HFS || !it) return;
    var seen = {}, src = Fe.list('hinv').filter(function (o) { if (o.id === id || !o.receipt || seen[o.receipt]) return false; seen[o.receipt] = 1; return true; });
    var X = HFS.sheet(I18N.k('ui.same-receipt-as-2', 'Same receipt as')), box = X.box;
    box.innerHTML = HFS.head('link-45deg', I18N.k('ui.same-receipt-as-2', 'Same receipt as'), I18N.k('ui.bought-together-on-one-receipt-pick-the', 'Bought together on one receipt? Pick the item that has it – both point to the same file.')) +
      '<ul class="mp-list">' + src.map(function (o) {
        var names = Fe.list('hinv').filter(function (z) { return z.receipt === o.receipt; }).map(function (z) { return z.name; });
        return '<li class="mp-row"><button type="button" class="kit-main" data-invpick="' + esc(o.id) + '"><span class="kit-ic" style="--c:#0891b2"><i class="bi bi-' + (o.receiptPdf ? 'file-earmark-pdf' : 'receipt') + '"></i></span><span class="kit-x"><b>' + esc(names.join(', ')) + '</b><small>' + esc((o.receiptPdf ? 'PDF' : 'Photo') + (o.bought ? ' · ' + fromKey(o.bought).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')) + '</small></span></button></li>';
      }).join('') + '</ul>';
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-invpick]'); if (!b) return;
      var o = Fe.list('hinv').filter(function (z) { return z.id === b.dataset.invpick; })[0]; if (!o) return;
      var t = Fe.tools(); (t.hinv || []).forEach(function (x) { if (x.id === id) { x.receipt = o.receipt; if (o.receiptPdf) x.receiptPdf = 1; else delete x.receiptPdf; x.receiptOf = o.id; } }); Fe.saveTools(t);
      X.close(); toast('<i class="bi bi-link-45deg"></i> ' + esc(it.name) + ' uses the receipt from ' + esc(o.name));
    });
  }
  function ownText(x, me, them) {
    var pct = x.ownPct === '' || x.ownPct == null ? null : +x.ownPct;
    if (!x.ownWith) return '100 % ' + me;
    if (pct === 0) return '100 % ' + (x.ownWith || them);
    if (pct === 100) return '100 % ' + me;
    if (pct === 50 || pct == null) return '50/50';
    return String(pct).replace('.', ',') + ' % ' + me + ' / ' + String(Math.round((100 - pct) * 10) / 10).replace('.', ',') + ' % ' + (x.ownWith || them);
  }
  function register() {
    var prof = (function () { try { return JSON.parse(localStorage.getItem('dash.profile')) || {}; } catch (e) { return {}; } })();
    var pt = window.Shared && window.Shared.partner(), me = (prof.name || 'Me').split(' ')[0], them = pt ? pt.name : 'the other';
    var all = Fe.list('hinv').slice().sort(function (a, b) { return (a.bought || '') < (b.bought || '') ? -1 : 1; }), onlyShared = false;
    var bg = document.createElement('div'); bg.className = 'rp-bg';
    bg.innerHTML = '<div class="rp-bar"><button type="button" class="text-btn" data-rgclose><i class="bi bi-x-lg"></i> <span data-t="ui.close">Close</span></button><span class="spacer"></span><label class="rp-opt"><input type="checkbox" data-rgsh> Only what you own together</label>' +
      '<button type="button" class="pill-btn" data-rgprint><i class="bi bi-file-earmark-pdf"></i> <span data-t="ui.save-as-pdf">Save as PDF</span></button></div>' +
      '<p class="rp-hint">Each entry should be accepted by both of you in writing – sign the PDF, or reply to it by message. Set “Agreed in writing” on the item afterwards.</p><article class="rp-doc"></article>';
    document.body.appendChild(bg); document.body.classList.add('rp-open');
    var doc = bg.querySelector('.rp-doc');
    function draw() {
      var l = all.filter(function (x) { return !onlyShared || x.ownWith; }), tot = l.reduce(function (a, x) { return a + (+x.price || 0); }, 0);
      doc.innerHTML = '<header class="rp-head"><div><p class="rp-kick">Appendix B · Vedlegg B</p><h1>Register of household items</h1><p class="rp-addr">Register over innbo · ' + esc(prof.name || me) + (pt ? ' and ' + esc(pt.name) : '') + '</p></div>' +
        '<div class="iv-no"><small data-t="ui.total"><span data-t="ui.total">Total</span></small><b>' + esc(kr(tot)) + '</b></div></header>' +
        '<p class="rp-intro">Ownership: 50/50, 100 % one of you, or another split. ' + l.length + ' items · made ' + esc(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })) + '</p>' +
        '<table class="rg-t"><thead><tr><th data-t="ui.item"><span data-t="ui.item">Item</span></th><th data-t="ui.bought"><span data-t="ui.bought">Bought</span></th><th>Price</th><th>Ownership</th><th data-t="ui.agreed"><span data-t="ui.agreed">Agreed</span></th></tr></thead><tbody>' + l.map(function (x) {
          return '<tr><td><b>' + esc(x.name) + '</b>' + (x.brand ? '<br><small>' + esc(x.brand) + '</small>' : '') + '</td><td>' + esc(x.bought ? fromKey(x.bought).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–') + '</td><td>' + (x.price ? esc(kr(x.price)) : '–') + '</td><td>' + esc(ownText(x, me, them)) + '</td><td>' + (x.agreed ? esc(fromKey(x.agreed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })) : '') + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<div class="rg-sign"><div><span></span><p>' + esc(prof.name || me) + ' · date</p></div><div><span></span><p>' + esc(pt ? pt.name : 'Other party') + ' · date</p></div></div>' +
        '<footer class="rp-foot">Appendix B – register of household items · ' + esc(today()) + '</footer>';
    }
    function close() { bg.remove(); document.body.classList.remove('rp-open'); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    bg.addEventListener('change', function (e) { if (e.target.matches('[data-rgsh]')) { onlyShared = e.target.checked; draw(); } });
    bg.addEventListener('click', function (e) {
      if (e.target.closest('[data-rgclose]')) return close();
      if (e.target.closest('[data-rgprint]')) { var t = document.title; document.title = 'Appendix B – household items ' + today(); var done = function () { document.title = t; window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(function () { window.print(); }, 300); setTimeout(done, 60000); }
    });
    draw();
  }
  function invList() {
    var l = Fe.list('hinv').slice().sort(function (a, b) { return (a.room || '').localeCompare(b.room || '') || (+b.price || 0) - (+a.price || 0); });
    var me = (function () { try { return JSON.parse(localStorage.getItem('dash.profile')) || {}; } catch (e) { return {}; } })();
    var tot = l.reduce(function (a, x) { return a + (+x.price || 0); }, 0), withPh = true;
    var bg = document.createElement('div'); bg.className = 'rp-bg';
    bg.innerHTML = '<div class="rp-bar"><button type="button" class="text-btn" data-ilclose><i class="bi bi-x-lg"></i> <span data-t="ui.close">Close</span></button><span class="spacer"></span><label class="rp-opt"><input type="checkbox" data-ilph checked> <span data-t="ui.photos">Photos</span></label>' +
      '<button type="button" class="text-btn" data-ilcsv><i class="bi bi-filetype-csv"></i> <span data-t="ui.csv">CSV</span></button><button type="button" class="pill-btn" data-ilprint><i class="bi bi-file-earmark-pdf"></i> <span data-t="ui.save-as-pdf">Save as PDF</span></button></div>' +
      '<p class="rp-hint"><span data-t="ui.in-the-print-window-choose">In the print window, choose</span> <b data-t="ui.save-as-pdf"><span data-t="ui.save-as-pdf">Save as PDF</span></b><span data-t="ui.photos-and-receipts-come-from-this-devic">. Photos and receipts come from this device.</span></p><article class="rp-doc"></article>';
    document.body.appendChild(bg); document.body.classList.add('rp-open');
    var doc = bg.querySelector('.rp-doc');
    function draw() {
      var rooms = []; l.forEach(function (x) { var r = room(x.room) || 'Other'; if (rooms.indexOf(r) < 0) rooms.push(r); });
      doc.innerHTML = '<header class="rp-head"><div><p class="rp-kick" data-t="ui.home-inventory"><span data-t="ui.home-inventory">Home inventory</span></p><h1>' + esc(me.name || 'Contents') + '</h1><p class="rp-addr">' + esc(me.home && typeof me.home === 'object' ? (me.home.addr || me.home.name || '') : (me.home || '')) + '</p></div>' +
        '<div class="iv-no"><small data-t="ui.total-value"><span data-t="ui.total-value">Total value</span></small><b>' + esc(kr(tot)) + '</b></div></header>' +
        '<p class="rp-intro">' + l.length + ' items · ' + l.filter(function (x) { return x.receipt; }).length + ' with receipt · made ' + esc(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })) + '</p>' +
        rooms.map(function (r) {
          var rl = l.filter(function (x) { return (room(x.room) || 'Other') === r; });
          return '<h2>' + esc(r) + ' <small class="il-sum">' + esc(kr(rl.reduce(function (a, x) { return a + (+x.price || 0); }, 0))) + '</small></h2>' + rl.map(function (x) {
            var hasPh = withPh && x.photo, hasRc = withPh && x.receipt && !x.receiptPdf;
            var mates = x.receipt ? l.filter(function (z) { return z.id !== x.id && z.receipt === x.receipt; }).map(function (z) { return z.name; }) : [];
            return '<div class="rp-f il-f' + (hasPh ? '' : ' il-noph-f') + (hasRc ? '' : ' il-norc-f') + '">' + (hasPh ? '<img class="il-ph" data-ilimg="' + esc(x.photo) + '" alt="">' : '') +
              '<div class="rp-ft"><p><b>' + esc(x.name) + '</b>' + (x.brand ? ' – ' + esc(x.brand) : '') + '</p><p class="rp-act">' + esc([cat(x.cat)[1], x.bought ? 'bought ' + fromKey(x.bought).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '', x.serial ? 'serial ' + x.serial : '', x.receipt ? (x.receiptPdf ? 'PDF receipt saved' : 'receipt saved') + (mates.length ? ' (same receipt as ' + mates.join(', ') + ')' : '') : 'no receipt'].filter(Boolean).join(' · ')) + '</p>' + (x.notes ? '<p class="rp-act">' + esc(x.notes) + '</p>' : '') + '</div>' +
              '<b class="il-price">' + (x.price ? esc(kr(x.price)) : '–') + '</b>' + (hasRc ? '<img class="il-rc" data-ilimg="' + esc(x.receipt) + '" alt="">' : '') + '</div>';
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
  function illu() {
    var hero = /\/cmd\/house\/$/.test(location.pathname) && document.querySelector('.fp-hero'); if (!hero) return;
    var box = document.getElementById('hsIllu');
    if (!on() || !hcfg().illu) { if (box) box.remove(); hero.classList.remove('has-illu'); return; }
    if (!box) { box = document.createElement('figure'); box.id = 'hsIllu'; box.className = 'hs-illu'; hero.appendChild(box); hero.classList.add('has-illu'); }
    var d = due(), sid = seasonOf()[0], n = Object.keys(d).reduce(function (a, k) { return a + d[k].length; }, 0);
    var hot = function (k) { return d[k].length ? ' hot' : ''; };
    var badge = function (k, x, y) { return d[k].length ? '<g class="hs-b" transform="translate(' + x + ' ' + y + ')"><circle r="9"/><text y="3.6" text-anchor="middle">' + d[k].length + '</text></g>' : ''; };
    var leaf = { spring: '#5fc27e', summer: '#2f9e57', autumn: '#e8743b', winter: '#cfe3f2' }[sid];
    var svg = '<svg viewBox="0 0 240 150" role="img" aria-label="Your house" data-t-aria-label="ui.your-house">' +
      (window.SceneGround ? window.SceneGround() : '<rect x="0" y="128" width="240" height="22" class="hs-ground"/>') +
      '<g class="hs-smoke"><circle cx="146" cy="28" r="3"/><circle cx="146" cy="28" r="3"/><circle cx="146" cy="28" r="3"/></g>' +
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
    if (box._h !== html) { box._h = html; box.innerHTML = html; }   /* compare with what we drew last time, not innerHTML: Safari writes the svg back differently, which redrew the picture on every change and restarted its animations */
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-hsgo]'), a = e.target.closest('#hsIllu a[href^="#"]');
    var id = g ? g.dataset.hsgo : a ? a.getAttribute('href').slice(1) : null; if (!id) return;
    e.preventDefault(); var c = document.getElementById(id); if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'start' }); c.classList.add('sr-flash'); setTimeout(function () { c.classList.remove('sr-flash'); }, 1600); }
  });
})();
