/* Optional cards on the pages they belong to (Settings → Features):
     Finances   Strømpris (hour-by-hour price in NO1), Savings jars
     Work       FDV inspection notes (findings with TG, a summary to send), Holiday planner
     Health     Gym log (sets × reps × kg, progress, next weight), Rest-day advisor
     Travel     Smart packing (from the trip's length and weather)
   Each mounts into a [data-tool="…"] box in the page, like the other tools. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var Fe = window.Features, K = window.Kit;
  if (!Fe) return;
  function on(k) { return Fe.on(k); }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function num(v) { var x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : null; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function fmt(k, o) { return fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function card(id, icon, title, actions, body, cls) {
    return '<section class="card kit-card lp-card ' + (cls || '') + '" id="' + id + '"><div class="card-head"><h2><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h2>' +
      (actions ? '<div class="head-actions">' + actions + '</div>' : '') + '</div>' + body + '</section>';
  }
  function tile(label, value, sub) { return '<div class="kit-tile" data-tk="' + esc(label).replace(/\b(19|20)\d\d\b/g, 'Y') + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  var mounts = [];
  function mount(name, render) {
    var el = $t(name); if (!el) return;
    function draw() { var ok = on(name); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; } render(el); }
    mounts.push(draw);
  }
  function drawAll() { mounts.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  ['tools:change', 'features:change', 'fin:change', 'habits:change', 'health:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(drawAll.t); drawAll.t = setTimeout(drawAll, 30); }); });
  window.Vault.onUnlock(function () { setTimeout(drawAll, 60); });

  /* ======================= Strømpris (NO1) ======================= */
  var PW = { day: 'today' }, pwLoading = {};
  function pwKey(k) { return 'pw:' + k; }
  function prices(k) {
    var c = readJSON('dash.power', {}) || {};
    if (c[k]) return c[k];
    if (pwLoading[k]) return null;
    pwLoading[k] = true;
    var d = fromKey(k), url = 'https://www.hvakosterstrommen.no/api/v1/prices/' + d.getFullYear() + '/' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_NO1.json';
    /* through your Worker (cached, no browser limits); straight from the source if the Worker is older */
    var get = function (u) { return fetch(u, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
    get('/cmd/api/power?date=' + k).catch(function () { return get(url); }).then(function (l) {
      if (!Array.isArray(l)) throw new Error('bad');
      /* by the hour (the market gives 15-minute prices since autumn 2025) – incl. 25 % VAT, in øre */
      var h = []; for (var i = 0; i < 24; i++) h.push([]);
      l.forEach(function (x) { var t = new Date(x.time_start); if (dkey(t) === k) h[t.getHours()].push(x.NOK_per_kWh * 125); });
      var out = h.map(function (v) { return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; });
      var cc = readJSON('dash.power', {}) || {}; Object.keys(cc).forEach(function (x) { if (x < addDays(dkey(new Date()), -2)) delete cc[x]; });
      cc[k] = out; try { localStorage.setItem('dash.power', JSON.stringify(cc)); } catch (e) {}
      pwLoading[k] = false; drawAll(); window.dispatchEvent(new Event('brief:refresh'));
    }).catch(function () { pwLoading[k] = 'fail'; drawAll(); });
    return null;
  }
  function cheapest(h, len, from) {
    var best = null;
    for (var i = from || 0; i + len <= 24; i++) {
      var v = h.slice(i, i + len); if (v.some(function (x) { return x == null; })) continue;
      var a = v.reduce(function (s, x) { return s + x; }, 0) / len;
      if (!best || a < best.avg) best = { h: i, avg: a };
    }
    return best;
  }
  function support(p) { return p - .9 * Math.max(0, p - 93.75); }     // strømstøtte: 90 % above 93,75 øre incl. VAT
  mount('power', function (el) {
    var now = new Date(), tk = dkey(now), tom = addDays(tk, 1), k = PW.day === 'tomorrow' ? tom : tk;
    var h = prices(k), hTom = now.getHours() >= 13 ? prices(tom) : null;
    var cfg = (Fe.tools().powercfg) || {};
    var acts = '<div class="seg lp-seg"><button type="button" data-pwday="today" aria-pressed="' + (PW.day === 'today') + '">Today</button>' +
      (hTom || PW.day === 'tomorrow' ? '<button type="button" data-pwday="tomorrow" aria-pressed="' + (PW.day === 'tomorrow') + '">Tomorrow</button>' : '') + '</div>';
    if (!h) { el.innerHTML = card('power', 'lightning-charge', 'Strømpris', '', '<p class="muted">' + (pwLoading[k] === 'fail' ? 'Couldn’t reach the price service right now – try again later.' : 'Getting today’s prices …') + '</p>'); return; }
    var valid = h.filter(function (x) { return x != null; }), avg = valid.reduce(function (a, b) { return a + b; }, 0) / valid.length;
    var max = Math.max.apply(null, valid), min = Math.min.apply(null, valid), cur = k === tk ? h[now.getHours()] : null;
    var c3 = cheapest(h, 3, k === tk ? now.getHours() : 0), exp = h.indexOf(max);
    var lvl = function (p) { return p <= avg * .85 ? 'cheap' : p >= avg * 1.2 ? 'dear' : 'mid'; };
    var big = cur != null ? cur : avg;
    var body = '<div class="pw-now"><div><span class="muted">' + (cur != null ? 'Now, ' + pad(now.getHours()) + '–' + pad((now.getHours() + 1) % 24) : 'Average ' + (k === tom ? 'tomorrow' : 'today')) + '</span>' +
      '<b class="pw-big">' + nf.format(Math.round(big)) + ' <small>øre/kWh</small></b>' +
      '<span class="pw-lvl ' + lvl(big) + '">' + ({ cheap: 'Cheap', mid: 'Normal', dear: 'Expensive' })[lvl(big)] + '</span>' +
      (cfg.norgespris ? '<small class="muted">You pay 50 øre with Norgespris</small>' : big > 93.75 ? '<small class="muted">≈ ' + nf.format(Math.round(support(big))) + ' øre after strømstøtte</small>' : '') + '</div>' +
      '<div class="pw-side"><span><i class="bi bi-arrow-down-circle"></i> Cheapest ' + (c3 ? pad(c3.h) + '–' + pad(c3.h + 3) + ' · ' + nf.format(Math.round(c3.avg)) + ' øre' : '–') + '</span>' +
      '<span><i class="bi bi-arrow-up-circle"></i> Most expensive ' + pad(exp) + '–' + pad((exp + 1) % 24) + ' · ' + nf.format(Math.round(max)) + ' øre</span>' +
      '<span><i class="bi bi-dash-circle"></i> Average ' + nf.format(Math.round(avg)) + ' øre</span></div></div>' +
      '<div class="pw-bars" role="img" aria-label="Price per hour">' + h.map(function (p, i) {
        var inC = c3 && i >= c3.h && i < c3.h + 3, isNow = k === tk && i === now.getHours();
        return '<i class="' + (p == null ? 'na ' : '') + lvl(p || avg) + (inC ? ' best' : '') + (isNow ? ' now' : '') + (k === tk && i < now.getHours() ? ' past' : '') + '" style="--h:' + (p == null ? 2 : Math.max(4, Math.round(p / max * 100))) + '%" title="' + pad(i) + ':00 · ' + (p == null ? '–' : nf.format(Math.round(p)) + ' øre') + '"></i>';
      }).join('') + '</div><div class="pw-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>' +
      '<p class="kit-foot">Spot price in NO1 with VAT, before grid rent (nettleie). Prices from hvakosterstrommen.no. <label class="lp-inl"><input type="checkbox" data-pwnorge' + (cfg.norgespris ? ' checked' : '') + '> I have Norgespris</label></p>';
    el.innerHTML = card('power', 'lightning-charge', 'Strømpris', acts, body, 'lp-power');
  });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-pwday]'); if (b) { PW.day = b.dataset.pwday; drawAll(); } });
  document.addEventListener('change', function (e) { if (e.target.matches('[data-pwnorge]')) { var t = Fe.tools(); t.powercfg = Object.assign({}, t.powercfg, { norgespris: e.target.checked }); Fe.saveTools(t); } });
  /* At a glance: tell when it's cheap now, or very expensive */
  window.BriefExtra = window.BriefExtra || [];
  window.BriefExtra.push(function (add, now) {
    if (!on('power')) return;
    var tk = dkey(now), h = prices(tk); if (!h) return;
    var cfg = Fe.tools().powercfg || {}; if (cfg.norgespris) return;
    var c3 = cheapest(h, 3, now.getHours()), cur = h[now.getHours()];
    if (c3 && c3.h === now.getHours()) add(36, 'lightning-charge', '#22b35e', 'Cheap power now – ' + nf.format(Math.round(cur)) + ' øre', 'Good time to wash, dry or charge · until ' + pad(c3.h + 3) + ':00', '/cmd/finance/#power');
    else if (c3 && now.getHours() >= 17 && now.getHours() < 23) add(48, 'lightning-charge', '#c98500', 'Cheapest power ' + pad(c3.h) + '–' + pad(c3.h + 3), nf.format(Math.round(c3.avg)) + ' øre/kWh · now ' + nf.format(Math.round(cur)) + ' øre', '/cmd/finance/#power');
  });

  /* ======================= Savings jars ======================= */
  var svList = document.getElementById('svList');
  function jars() {
    if (!svList) return;
    var want = on('jars'); svList.classList.toggle('sv-jars', want);
    if (!want) return;
    var d = window.Vault.get() || {}, B = window.Budget;
    svList.querySelectorAll('li.goal[data-id]').forEach(function (li) {
      var g = (d.savings || []).filter(function (x) { return x.id === li.dataset.id; })[0]; if (!g) return;
      var pct = g.target > 0 ? Math.min(1, (+g.saved || 0) / g.target) : 0;
      var mo = B && B.saveMonthly ? B.saveMonthly(g) : 0, left = Math.max(0, (+g.target || 0) - (+g.saved || 0));
      var weeks = pct >= 1 ? 0 : mo > 0 ? Math.ceil(left / (mo / 4.345)) : null;
      var j = li.querySelector('.jar');
      var html = '<svg viewBox="0 0 60 76" aria-hidden="true"><defs><clipPath id="jc' + esc(g.id) + '"><path d="M12 14h36v6c6 3 8 8 8 14v30c0 6-4 10-10 10H14C8 74 4 70 4 64V34c0-6 2-11 8-14z"/></clipPath></defs>' +
        '<rect class="jar-lid" x="10" y="3" width="40" height="9" rx="3"/><g clip-path="url(#jc' + esc(g.id) + ')"><rect class="jar-glass" x="0" y="0" width="60" height="76"/><rect class="jar-fill" x="0" y="' + (74 - 60 * pct).toFixed(1) + '" width="60" height="76"/></g>' +
        '<path class="jar-edge" d="M12 14h36v6c6 3 8 8 8 14v30c0 6-4 10-10 10H14C8 74 4 70 4 64V34c0-6 2-11 8-14z"/><text x="30" y="52" text-anchor="middle">' + Math.round(pct * 100) + '%</text></svg>' +
        '<small class="jar-weeks">' + (pct >= 1 ? 'Full 🎉' : weeks != null ? weeks + ' week' + (weeks === 1 ? '' : 's') + ' to go' : kr(left) + ' to go') + '</small>';
      if (!j) { j = document.createElement('div'); j.className = 'jar'; li.insertBefore(j, li.firstChild); }
      if (j.innerHTML !== html) j.innerHTML = html;
    });
  }
  if (svList) { new MutationObserver(function () { if (on('jars') && svList.querySelector('li.goal:not(:has(.jar))')) jars(); }).observe(svList, { childList: true }); mounts.push(jars); }

  /* ======================= FDV inspection notes ======================= */
  var PARTS = ['Roof', 'Facade', 'Windows and doors', 'Wet rooms', 'Kitchen', 'Electrical', 'Plumbing (VVS)', 'Ventilation', 'Heating', 'Fire safety', 'Structure', 'Outdoor areas', 'Other'];
  var TG = { 0: ['TG 0', 'No issues', '#22b35e'], 1: ['TG 1', 'Minor issues', '#3987e5'], 2: ['TG 2', 'Significant issues', '#c98500'], 3: ['TG 3', 'Serious issues', '#e66767'], iu: ['TG IU', 'Not examined', '#8b8f9a'] };
  /* photos stay on this device (IndexedDB), the text is in your synced vault */
  var idb = null;
  function db() { return idb || (idb = new Promise(function (res, rej) { var r = indexedDB.open('dash-fdv', 1); r.onupgradeneeded = function () { r.result.createObjectStore('photos'); }; r.onsuccess = function () { res(r.result); }; r.onerror = rej; })); }
  function putPhoto(id, blob) { return db().then(function (d) { return new Promise(function (res) { var t = d.transaction('photos', 'readwrite'); t.objectStore('photos').put(blob, id); t.oncomplete = res; }); }); }
  function getPhoto(id) { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('photos').objectStore('photos').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function delPhoto(id) { return db().then(function (d) { d.transaction('photos', 'readwrite').objectStore('photos').delete(id); }).catch(function () {}); }
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(); img.onload = function () { var s = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(function (b) { b ? res(b) : rej(); }, 'image/jpeg', .82); URL.revokeObjectURL(img.src); };
      img.onerror = rej; img.src = URL.createObjectURL(file);
    });
  }
  var fdvOpen = null;
  function summary(r) {
    var f = r.findings || [], by = function (t) { return f.filter(function (x) { return String(x.tg) === t; }); };
    var lines = ['FDV inspection – ' + (r.building || ''), [r.address, fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' }), r.client ? 'For ' + r.client : ''].filter(Boolean).join(' · '), ''];
    lines.push('Summary: ' + ['3', '2', '1', '0', 'iu'].map(function (t) { return by(t).length ? by(t).length + ' × ' + TG[t][0] : ''; }).filter(Boolean).join(', '), '');
    ['3', '2', '1', 'iu', '0'].forEach(function (t) {
      if (!by(t).length) return;
      lines.push(TG[t][0] + ' – ' + TG[t][1]);
      by(t).forEach(function (x) { lines.push('• ' + x.part + ': ' + x.text + (x.action ? ' → ' + x.action : '')); });
      lines.push('');
    });
    if (r.notes) lines.push('Notes: ' + r.notes);
    return lines.join('\n').trim();
  }
  mount('fdv', function (el) {
    var list = (Fe.list('fdv') || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var body = list.length ? '<ul class="kit-list">' + list.map(function (r) {
      var f = r.findings || [], worst = ['3', '2', '1', '0'].filter(function (t) { return f.some(function (x) { return String(x.tg) === t; }); })[0];
      var open = fdvOpen === r.id;
      return '<li class="kit-item' + (open ? ' open' : '') + '"><button type="button" class="kit-main" data-fdvopen="' + esc(r.id) + '"><span class="kit-ic" style="--c:' + (worst ? TG[worst][2] : '#0891b2') + '"><i class="bi bi-building-check"></i></span>' +
        '<span class="kit-x"><b>' + esc(r.building) + '</b><small>' + esc([fmt(r.date), r.address, f.length + ' finding' + (f.length === 1 ? '' : 's')].filter(Boolean).join(' · ')) + '</small></span>' +
        (worst ? '<span class="kit-r"><span class="tg-b" style="--c:' + TG[worst][2] + '">' + TG[worst][0] + '</span></span>' : '') + '</button>' +
        (open ? fdvDetail(r) : '') + '</li>';
    }).join('') + '</ul>' : '<p class="empty kit-empty">Walk a building, note each finding with its condition grade (TG) and a photo – and get a tidy summary you can send or paste into a report.</p>';
    el.innerHTML = card('fdv', 'building-check', 'FDV inspection notes', '<button type="button" class="text-btn" data-fdvnew><i class="bi bi-plus-lg"></i> New</button>', body, 'lp-fdv');
    el.querySelectorAll('img[data-ph]').forEach(function (im) { getPhoto(im.dataset.ph).then(function (b) { if (b) im.src = URL.createObjectURL(b); else im.closest('.fdv-ph').remove(); }); });
  });
  function fdvDetail(r) {
    var f = r.findings || [];
    return '<div class="kit-detail fdv-detail">' +
      (f.length ? '<ul class="fdv-list">' + f.map(function (x) {
        return '<li><span class="tg-b" style="--c:' + TG[x.tg][2] + '">' + TG[x.tg][0] + '</span><div><b>' + esc(x.part) + '</b> ' + esc(x.text) + (x.action ? '<small>→ ' + esc(x.action) + '</small>' : '') +
          (x.photo ? '<span class="fdv-ph"><img data-ph="' + esc(x.photo) + '" alt="Photo: ' + esc(x.part) + '"></span>' : '') + '</div>' +
          '<button type="button" class="icon-btn sm" data-fdvdel="' + esc(r.id) + ':' + esc(x.id) + '" aria-label="Remove finding"><i class="bi bi-x"></i></button></li>';
      }).join('') + '</ul>' : '<p class="muted">No findings yet – add the first one below.</p>') +
      '<form class="fdv-add" data-fdvadd="' + esc(r.id) + '"><div class="row2"><select name="part" aria-label="Building part">' + PARTS.map(function (p) { return '<option>' + p + '</option>'; }).join('') + '</select>' +
      '<select name="tg" aria-label="Condition grade">' + ['0', '1', '2', '3', 'iu'].map(function (t) { return '<option value="' + t + '"' + (t === '2' ? ' selected' : '') + '>' + TG[t][0] + ' – ' + TG[t][1] + '</option>'; }).join('') + '</select></div>' +
      '<input name="text" placeholder="What you found, e.g. Cracked sealant around window, 2nd floor" required maxlength="300">' +
      '<input name="action" placeholder="What should be done (optional)" maxlength="200">' +
      '<div class="fdv-row"><label class="text-btn fdv-photo"><i class="bi bi-camera"></i> <span>Photo</span><input type="file" name="photo" accept="image/*" capture="environment" hidden></label><span class="spacer"></span><button type="submit" class="pill-btn"><i class="bi bi-plus-lg"></i> Add finding</button></div></form>' +
      (r.notes ? '<p class="kit-notes">' + esc(r.notes) + '</p>' : '') +
      '<div class="fdv-acts"><button type="button" class="text-btn" data-fdvcopy="' + esc(r.id) + '"><i class="bi bi-clipboard"></i> Copy summary</button>' +
      (navigator.share ? '<button type="button" class="text-btn" data-fdvshare="' + esc(r.id) + '"><i class="bi bi-share"></i> Share</button>' : '') +
      '<button type="button" class="text-btn" data-fdvpdf="' + esc(r.id) + '"><i class="bi bi-file-earmark-pdf"></i> PDF report</button>' +
      '<button type="button" class="text-btn" data-fdvtodo="' + esc(r.id) + '"><i class="bi bi-box-arrow-in-right"></i> TG 2–3 to to-do</button>' +
      '<button type="button" class="text-btn" data-fdvedit="' + esc(r.id) + '"><i class="bi bi-pencil"></i> Edit</button></div></div>';
  }
  var FDV_FIELDS = { key: 'fdv', addTitle: 'New inspection', editTitle: 'Edit inspection', fields: [
    { k: 'building', type: 'title', label: 'Building', ph: 'Building or property, e.g. Storgata 12', req: true },
    { k: 'address', label: 'Address', ph: 'Street, town' }, { k: 'date', label: 'Date', type: 'date', req: true, def: function () { return dkey(new Date()); } },
    { k: 'client', label: 'Client', ph: 'Who it’s for' }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 3 }],
    beforeSave: function (it) { it.findings = it.findings || []; }, afterSave: function (it, isNew) { if (isNew) fdvOpen = it.id; },
    onDelete: function (it) { (it.findings || []).forEach(function (x) { if (x.photo) delPhoto(x.photo); }); } };
  function saveFdv(id, fn) { var t = Fe.tools(); (t.fdv || []).forEach(function (r) { if (r.id === id) fn(r); }); Fe.saveTools(t); }
  document.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-fdvnew]') && K) return K.edit(FDV_FIELDS, null);
    if ((b = e.target.closest('[data-fdvedit]')) && K) return K.edit(FDV_FIELDS, Fe.list('fdv').filter(function (x) { return x.id === b.dataset.fdvedit; })[0]);
    if ((b = e.target.closest('[data-fdvopen]'))) { fdvOpen = fdvOpen === b.dataset.fdvopen ? null : b.dataset.fdvopen; drawAll(); return; }
    if ((b = e.target.closest('[data-fdvdel]'))) {
      var q = b.dataset.fdvdel.split(':'), gone = null;
      saveFdv(q[0], function (r) { r.findings = (r.findings || []).filter(function (x) { if (x.id === q[1]) { gone = x; return false; } return true; }); });
      toast('<i class="bi bi-trash3"></i> Finding removed', function () { saveFdv(q[0], function (r) { r.findings.push(gone); }); });
      return;
    }
    var r;
    if ((b = e.target.closest('[data-fdvcopy]'))) { r = Fe.list('fdv').filter(function (x) { return x.id === b.dataset.fdvcopy; })[0]; if (r && navigator.clipboard) navigator.clipboard.writeText(summary(r)).then(function () { toast('<i class="bi bi-clipboard-check"></i> Summary copied'); }); return; }
    if ((b = e.target.closest('[data-fdvshare]'))) {
      r = Fe.list('fdv').filter(function (x) { return x.id === b.dataset.fdvshare; })[0]; if (!r) return;
      var ids = (r.findings || []).filter(function (x) { return x.photo; });
      Promise.all(ids.map(function (x) { return getPhoto(x.photo).then(function (bl) { return bl ? new File([bl], (x.part + '-' + x.id).replace(/[^\w-]+/g, '_') + '.jpg', { type: 'image/jpeg' }) : null; }); })).then(function (files) {
        files = files.filter(Boolean);
        var data = { title: 'FDV – ' + r.building, text: summary(r) };
        if (files.length && navigator.canShare && navigator.canShare({ files: files })) data.files = files;
        navigator.share(data).catch(function () {});
      });
      return;
    }
    if ((b = e.target.closest('[data-fdvtodo]'))) {
      r = Fe.list('fdv').filter(function (x) { return x.id === b.dataset.fdvtodo; })[0]; if (!r) return;
      var todos = readJSON('dash.todos', []) || [], n = 0;
      (r.findings || []).filter(function (x) { return x.tg === '2' || x.tg === '3'; }).forEach(function (x) { todos.push({ id: uid(), text: (r.building + ': ' + x.part + ' – ' + (x.action || x.text)).slice(0, 200), done: false, focus: x.tg === '3' }); n++; });
      writeJSON('dash.todos', todos); window.dispatchEvent(new Event('todos:change'));
      toast('<i class="bi bi-check2-square"></i> ' + n + ' task' + (n === 1 ? '' : 's') + ' added to your to-do list');
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.name === 'photo' && e.target.closest('.fdv-add')) { var l = e.target.closest('label'); l.classList.toggle('has', !!e.target.files.length); l.querySelector('span').textContent = e.target.files.length ? 'Photo ✓' : 'Photo'; }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-fdvadd]'); if (!f) return;
    e.preventDefault();
    var id = f.dataset.fdvadd, fid = uid(), file = f.photo.files[0];
    var item = { id: fid, part: f.part.value, tg: f.tg.value, text: f.text.value.trim(), action: f.action.value.trim() };
    if (!item.text) return;
    var go = function () { saveFdv(id, function (r) { r.findings = r.findings || []; r.findings.push(item); }); };
    if (file) shrink(file).then(function (bl) { item.photo = 'ph-' + fid; return putPhoto(item.photo, bl); }).then(go, go); else go();
  });

  /* ---------- FDV report: a tidy A4 report – print it, or "Save as PDF" from the print sheet ---------- */
  var RP = { photos: true };
  function report(r) {
    var f = r.findings || [], me = readJSON('dash.profile', {}) || {};
    var by = function (t) { return f.filter(function (x) { return String(x.tg) === t; }); };
    var worst = ['3', '2', '1', '0'].filter(function (t) { return by(t).length; })[0];
    var tgb = function (t) { return '<span class="rp-tg" style="--c:' + TG[t][2] + '">' + TG[t][0] + '</span>'; };
    var todo = f.filter(function (x) { return x.tg === '3' || x.tg === '2'; }).sort(function (a, b) { return a.tg < b.tg ? 1 : -1; });
    var parts = PARTS.filter(function (p) { return f.some(function (x) { return x.part === p; }); });
    var h = '<header class="rp-head"><div><p class="rp-kick">FDV inspection report</p><h1>' + esc(r.building || 'Inspection') + '</h1>' +
      (r.address ? '<p class="rp-addr">' + esc(r.address) + '</p>' : '') + '</div>' +
      (worst ? '<div class="rp-worst" style="--c:' + TG[worst][2] + '"><small>Worst grade</small><b>' + TG[worst][0] + '</b></div>' : '') + '</header>' +
      '<table class="rp-meta"><tr><th>Date</th><td>' + esc(fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' })) + '</td><th>Client</th><td>' + esc(r.client || '–') + '</td></tr>' +
      '<tr><th>Inspected by</th><td>' + esc([me.name, me.role].filter(Boolean).join(', ') || '–') + '</td><th>Company</th><td>' + esc(me.employer || '–') + '</td></tr></table>' +
      (r.intro ? '<p class="rp-intro">' + esc(r.intro).replace(/\n/g, '<br>') + '</p>' : '') +
      '<h2>Summary</h2><div class="rp-sum">' + ['3', '2', '1', '0', 'iu'].map(function (t) {
        return '<div style="--c:' + TG[t][2] + '"><b>' + by(t).length + '</b><span>' + TG[t][0] + '</span><small>' + TG[t][1] + '</small></div>';
      }).join('') + '</div>' +
      (todo.length ? '<h2>What should be done</h2><table class="rp-todo"><thead><tr><th>Grade</th><th>Building part</th><th>Finding</th><th>Action</th></tr></thead><tbody>' + todo.map(function (x) {
        return '<tr><td>' + tgb(x.tg) + '</td><td>' + esc(x.part) + '</td><td>' + esc(x.text) + '</td><td>' + esc(x.action || '–') + '</td></tr>';
      }).join('') + '</tbody></table>' : '') +
      '<h2>Findings by building part</h2>' + (parts.length ? parts.map(function (p) {
        return '<section class="rp-part"><h3>' + esc(p) + '</h3>' + f.filter(function (x) { return x.part === p; }).map(function (x) {
          return '<div class="rp-f">' + tgb(x.tg) + '<div class="rp-ft"><p>' + esc(x.text) + '</p>' + (x.action ? '<p class="rp-act">Action: ' + esc(x.action) + '</p>' : '') + '</div>' +
            (x.photo && RP.photos ? '<img class="rp-ph" data-rph="' + esc(x.photo) + '" alt="">' : '') + '</div>';
        }).join('') + '</section>';
      }).join('') : '<p>No findings were recorded.</p>') +
      (r.notes ? '<h2>Notes</h2><p class="rp-notes">' + esc(r.notes).replace(/\n/g, '<br>') + '</p>' : '') +
      '<h2>Condition grades</h2><table class="rp-legend">' + ['0', '1', '2', '3', 'iu'].map(function (t) {
        return '<tr><td>' + tgb(t) + '</td><td>' + ({ 0: 'No signs of wear or damage.', 1: 'Normal wear; some maintenance may be needed.', 2: 'Significant wear or damage – should be followed up.', 3: 'Serious damage or risk – needs action now.', iu: 'Not examined (no access).' }[t]) + '</td></tr>';
      }).join('') + '</table>' +
      '<footer class="rp-foot">' + esc(r.building || '') + ' · ' + esc(fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' })) + (me.email ? ' · ' + esc(me.email) : '') + (me.phone ? ' · ' + esc(me.phone) : '') + '</footer>';
    return h;
  }
  function openReport(r) {
    var bg = document.createElement('div'); bg.className = 'rp-bg';
    bg.innerHTML = '<div class="rp-bar"><button type="button" class="text-btn" data-rpclose><i class="bi bi-x-lg"></i> Close</button><span class="spacer"></span>' +
      '<label class="rp-opt"><input type="checkbox" data-rpphotos' + (RP.photos ? ' checked' : '') + '> Photos</label>' +
      '<button type="button" class="text-btn" data-rpintro><i class="bi bi-text-paragraph"></i> Intro</button>' +
      '<button type="button" class="pill-btn" data-rpprint><i class="bi bi-file-earmark-pdf"></i> Save as PDF</button></div>' +
      '<p class="rp-hint">In the print window, choose <b>Save as PDF</b> (on iPhone: pinch out on the preview, then Share).</p><textarea class="rp-introbox" rows="3" maxlength="1500" placeholder="A short introduction at the top of the report – purpose, scope, weather, what you couldn’t access" hidden></textarea><article class="rp-doc"></article>';
    document.body.appendChild(bg); document.body.classList.add('rp-open');
    var doc = bg.querySelector('.rp-doc');
    function draw() {
      doc.innerHTML = report(r);
      doc.querySelectorAll('img[data-rph]').forEach(function (im) {
        getPhoto(im.dataset.rph).then(function (b) {
          if (!b) return im.remove();
          var fr = new FileReader(); fr.onload = function () { im.src = fr.result; }; fr.readAsDataURL(b);       // a data URL survives printing
        });
      });
    }
    draw();
    function close() { bg.remove(); document.body.classList.remove('rp-open'); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    var ib = bg.querySelector('.rp-introbox'); ib.value = r.intro || '';
    ib.addEventListener('input', function () { r.intro = ib.value.trim(); clearTimeout(draw.t); draw.t = setTimeout(function () { draw(); saveFdv(r.id, function (x) { x.intro = r.intro; }); }, 400); });
    bg.addEventListener('change', function (e) { if (e.target.matches('[data-rpphotos]')) { RP.photos = e.target.checked; draw(); } });
    bg.addEventListener('click', function (e) {
      if (e.target.closest('[data-rpclose]')) return close();
      if (e.target.closest('[data-rpintro]')) { var ta = bg.querySelector('.rp-introbox'); ta.hidden = !ta.hidden; if (!ta.hidden) ta.focus(); return; }
      if (e.target.closest('[data-rpprint]')) {
        var imgs = [].slice.call(doc.querySelectorAll('img[data-rph]')).filter(function (im) { return !im.complete || !im.src; });
        var title = document.title;
        var go = function () {
          document.title = ('FDV ' + (r.building || '') + ' ' + (r.date || '')).trim();
          document.body.classList.add('rp-printing');
          var done = function () { document.body.classList.remove('rp-printing'); document.title = title; window.removeEventListener('afterprint', done); };
          window.addEventListener('afterprint', done);
          window.print();
          setTimeout(done, 60000);
        };
        if (imgs.length) setTimeout(go, 400); else go();
      }
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fdvpdf]'); if (!b) return;
    var r = Fe.list('fdv').filter(function (x) { return x.id === b.dataset.fdvpdf; })[0];
    if (r) openReport(r);
  });

  /* ======================= Holiday planner ======================= */
  function offDay(k) { var d = fromKey(k).getDay(); return d === 0 || d === 6 || !!Fe.holiday(k); }
  function breaks() {
    var today = dkey(new Date()), out = [], seen = {};
    for (var i = 1; i < 380; i++) {
      var k = addDays(today, i), h = Fe.holiday(k);
      if (!h || fromKey(k).getDay() % 6 === 0 || seen[h.name + k.slice(0, 4)]) continue;
      if (out.length && k <= addDays(out[out.length - 1].b, 2)) continue;          // part of the break just found (Easter, Christmas)
      seen[h.name + k.slice(0, 4)] = 1;
      /* every way to use 1–5 work days next to this holiday; keep the best ratio, then the longest */
      var best = null;
      for (var s = -6; s <= 0; s++) for (var len = 1; len <= 9; len++) {
        var from = addDays(k, s), to = addDays(from, len - 1); if (from <= today) continue;
        if (to < k) continue;
        var used = 0, j; for (j = 0; j < len; j++) if (!offDay(addDays(from, j))) used++;
        if (!used || used > 5) continue;
        var a = from, b = to; while (offDay(addDays(a, -1))) a = addDays(a, -1); while (offDay(addDays(b, 1))) b = addDays(b, 1);
        var total = Math.round((fromKey(b) - fromKey(a)) / 864e5) + 1, sc = total / used;
        if (total < 4) continue;
        if (sc < 2.5) continue;
        var wd = workDays(from, to);
        /* the longest break that still gives 2,5+ days off per day used; equal length → fewer days used */
        if (!best || total > best.total || (total === best.total && used < best.used)) best = { sc: sc, total: total, used: used, a: a, b: b, take: wd[0], takeTo: wd[wd.length - 1], name: h.name };
      }
      if (best) out.push(best);
    }
    var uniq = {}; return out.filter(function (x) { var u = x.a + x.b; if (uniq[u]) return false; uniq[u] = 1; return true; }).slice(0, 6);
  }
  function workDays(a, b) { var l = [], k = a; while (k <= b) { if (!offDay(k)) l.push(k); k = addDays(k, 1); } return l; }
  mount('holiday', function (el) {
    var y = dkey(new Date()).slice(0, 4), cfg = Fe.tools().holidaycfg || {};
    var total = on('flex') ? (+((Fe.tools().flexcfg || {}).vacation) || 25) : (+cfg.total || 25);
    var used = on('flex') ? Fe.list('flex').filter(function (e) { return e.type === 'vacation' && String(e.date).slice(0, 4) === y; }).length : (+cfg.used || 0);
    var planned = (cfg.plans || []).filter(function (p) { return p.take.slice(0, 4) === y && p.take > dkey(new Date()); }).reduce(function (a, p) { return a + p.used; }, 0);
    var next = null; for (var i = 0; i < 370 && !next; i++) { var k = addDays(dkey(new Date()), i), h = Fe.holiday(k); if (h) next = { k: k, h: h }; }
    var br = breaks();
    var body = '<div class="kit-tiles">' + tile('Days left ' + y, (total - used - planned) + ' <small>/ ' + total + '</small>', used + ' used' + (planned ? ' · ' + planned + ' planned' : '')) +
      (next ? tile('Next public holiday', esc(next.h.name), fmt(next.k, { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</div>' +
      '<h3 class="lp-h3">Longest breaks for the fewest days</h3>' +
      (br.length ? '<ul class="hp-list">' + br.map(function (x) {
        var plannedAlready = (cfg.plans || []).some(function (p) { return p.take === x.take; });
        return '<li><div class="hp-ratio"><b>' + x.total + '</b><small>days off</small></div><div class="hp-x"><b>' + esc(x.name) + '</b><span>Take ' + x.used + ' day' + (x.used === 1 ? '' : 's') + ': ' + esc(fmt(x.take, { weekday: 'short', day: 'numeric', month: 'short' })) + (x.takeTo !== x.take ? ' – ' + esc(fmt(x.takeTo, { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</span><small>Off ' + esc(fmt(x.a, { weekday: 'short', day: 'numeric', month: 'short' })) + ' – ' + esc(fmt(x.b, { weekday: 'short', day: 'numeric', month: 'short' })) + '</small></div>' +
          (plannedAlready ? '<span class="kit-badge">In calendar</span>' : '<button type="button" class="text-btn" data-hpplan="' + x.take + '|' + x.takeTo + '|' + x.a + '|' + x.b + '|' + x.used + '|' + esc(x.name) + '"><i class="bi bi-calendar-plus"></i> Plan it</button>') + '</li>';
      }).join('') + '</ul>' : '<p class="muted">No clever breaks in the next 12 months.</p>') +
      (on('flex') ? '' : '<p class="kit-foot">Holiday days a year: <input class="lp-num" type="number" min="0" max="60" value="' + total + '" data-hpcfg="total" aria-label="Holiday days a year"> · used so far: <input class="lp-num" type="number" min="0" max="60" value="' + used + '" data-hpcfg="used" aria-label="Holiday days used"></p>');
    el.innerHTML = card('holiday', 'sun', 'Holiday planner', '', body, 'lp-holiday');
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hpplan]'); if (!b) return;
    var q = b.dataset.hpplan.split('|'), cal = readJSON('dash.calendar', null) || { events: [], hidden: {}, feeds: [] };
    cal.events = cal.events || [];
    var ev = { id: uid(), title: 'Ferie – ' + q[5], cat: 'personal', date: q[2], end: q[3], allDay: true };
    cal.events.push(ev); writeJSON('dash.calendar', cal); window.dispatchEvent(new Event('cal:change'));
    var t = Fe.tools(); t.holidaycfg = t.holidaycfg || {}; t.holidaycfg.plans = (t.holidaycfg.plans || []).concat([{ take: q[0], takeTo: q[1], used: +q[4], ev: ev.id }]);
    if (on('flex')) workDays(q[0], q[1]).forEach(function (k) { t.flex = t.flex || []; t.flex.push({ id: uid(), date: k, type: 'vacation' }); });
    Fe.saveTools(t);
    toast('<i class="bi bi-sun"></i> ' + esc(q[5]) + ' break in your calendar' + (on('flex') ? ' and flex time' : ''));
  });
  document.addEventListener('change', function (e) { var c = e.target.dataset && e.target.dataset.hpcfg; if (!c) return; var t = Fe.tools(); t.holidaycfg = t.holidaycfg || {}; t.holidaycfg[c] = +e.target.value || 0; Fe.saveTools(t); });

  /* ======================= Gym log ======================= */
  var EX = ['Bench press', 'Squat', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-ups', 'Lat pulldown', 'Leg press', 'Lunges', 'Romanian deadlift', 'Biceps curl', 'Triceps pushdown', 'Dips', 'Seated row', 'Leg curl', 'Calf raise', 'Plank'];
  function sessions() { return (Fe.list('gym') || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }); }
  function e1rm(s) { return (+s.kg || 0) * (1 + (+s.r || 0) / 30); }
  function history(name) {
    var out = []; sessions().slice().reverse().forEach(function (s) { (s.ex || []).forEach(function (x) { if (x.n.toLowerCase() === name.toLowerCase() && x.sets && x.sets.length) out.push({ date: s.date, sets: x.sets, best: Math.max.apply(null, x.sets.map(e1rm)) }); }); });
    return out;
  }
  /* last time + a suggestion: all sets reached the reps → a bit heavier */
  function suggest(name) {
    var h = history(name); if (!h.length) return null;
    var last = h[h.length - 1], top = Math.max.apply(null, last.sets.map(function (s) { return +s.kg || 0; }));
    var topSets = last.sets.filter(function (s) { return (+s.kg || 0) === top; }), reps = Math.min.apply(null, topSets.map(function (s) { return +s.r || 0; }));
    var step = top >= 40 ? 2.5 : top >= 10 ? 1 : .5, up = reps >= 8;
    return { last: last, text: topSets.length + '×' + reps + ' @ ' + nf1.format(top) + ' kg', next: up ? top + step : top, reps: up ? Math.max(5, reps - 2) : reps + 1, up: up };
  }
  mount('gym', function (el) {
    var l = sessions(), tk = dkey(new Date()), mon = addDays(tk, -((new Date().getDay() + 6) % 7));
    var wk = l.filter(function (s) { return s.date >= mon; }), vol = 0;
    wk.forEach(function (s) { (s.ex || []).forEach(function (x) { (x.sets || []).forEach(function (t) { vol += (+t.r || 0) * (+t.kg || 0); }); }); });
    var names = {}; l.forEach(function (s) { (s.ex || []).forEach(function (x) { names[x.n] = (names[x.n] || 0) + 1; }); });
    var top = Object.keys(names).sort(function (a, b) { return names[b] - names[a]; }).slice(0, 5);
    var prs = 0; top.forEach(function (n) { var h = history(n); if (h.length > 1 && h[h.length - 1].best >= Math.max.apply(null, h.slice(0, -1).map(function (x) { return x.best; })) && h[h.length - 1].date >= addDays(tk, -30)) prs++; });
    var body = '<div class="kit-tiles">' + tile('This week', wk.length, 'session' + (wk.length === 1 ? '' : 's')) + tile('Volume', nf.format(Math.round(vol)) + ' <small>kg</small>', 'this week') + tile('New bests', prs, 'last 30 days') + '</div>' +
      (top.length ? '<h3 class="lp-h3">Progress</h3><ul class="gym-prog">' + top.map(function (n) {
        var h = history(n).slice(-10), mx = Math.max.apply(null, h.map(function (x) { return x.best; })), mn = Math.min.apply(null, h.map(function (x) { return x.best; })), sg = suggest(n);
        var pts = h.map(function (x, i) { return (h.length === 1 ? 50 : i / (h.length - 1) * 100).toFixed(1) + ',' + (mx === mn ? 50 : 90 - (x.best - mn) / (mx - mn) * 80).toFixed(1); }).join(' ');
        return '<li><div class="gym-x"><b>' + esc(n) + '</b><small>' + esc(sg ? 'Last ' + sg.text : '') + '</small></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" class="gym-spark" aria-hidden="true"><polyline points="' + pts + '"/></svg>' +
          '<div class="gym-next"><small>Next</small><b>' + (sg ? nf1.format(sg.next) + ' kg × ' + sg.reps : '–') + '</b></div></li>';
      }).join('') + '</ul>' : '') +
      (l.length ? '<h3 class="lp-h3">Recent</h3><ul class="kit-list">' + l.slice(0, 4).map(function (s) { return '<li class="kit-item"><button type="button" class="kit-main" data-gymedit="' + esc(s.id) + '"><span class="kit-ic" style="--c:#d55181"><i class="bi bi-person-arms-up"></i></span><span class="kit-x"><b>' + esc(fmt(s.date, { weekday: 'long', day: 'numeric', month: 'short' })) + '</b><small>' + esc((s.ex || []).map(function (x) { return x.n + ' ' + (x.sets || []).length + '×'; }).join(' · ')) + '</small></span></button></li>'; }).join('') + '</ul>' :
        '<p class="empty kit-empty">Log sets, reps and kilos per exercise. It shows your progress and suggests the weight for next time.</p>');
    el.innerHTML = card('gym', 'person-arms-up', 'Gym log', '<button type="button" class="text-btn" data-gymstart><i class="bi bi-play-fill"></i> Start workout</button>', body, 'lp-gym');
  });
  function gymSheet(sess) {
    var s = sess ? JSON.parse(JSON.stringify(sess)) : { id: uid(), date: dkey(new Date()), ex: [] }, isNew = !sess;
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<div class="fo-box lf-box gym-box" role="dialog" aria-modal="true" aria-label="Workout"></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var box = bg.firstChild;
    function close() { bg.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape' && !e.target.closest('input')) { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    function draw() {
      box.innerHTML = '<div class="lf-head"><h3><i class="bi bi-person-arms-up"></i> ' + (isNew ? 'Workout' : 'Edit workout') + '</h3><button type="button" class="icon-btn sm" data-gclose aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' +
        '<label class="gym-date">Date <input type="date" data-gdate value="' + s.date + '"></label>' +
        s.ex.map(function (x, xi) {
          var sg = suggest(x.n);
          return '<section class="gym-ex"><div class="gym-exh"><b>' + esc(x.n) + '</b>' + (sg ? '<small>Last ' + esc(sg.text) + ' · try <b>' + nf1.format(sg.next) + ' kg × ' + sg.reps + '</b>' + (sg.up ? ' ↑' : '') + '</small>' : '') + '<button type="button" class="icon-btn sm" data-gexdel="' + xi + '" aria-label="Remove ' + esc(x.n) + '"><i class="bi bi-trash3"></i></button></div>' +
            '<div class="gym-sets">' + x.sets.map(function (t, si) {
              return '<div class="gym-set"><span>' + (si + 1) + '</span><input inputmode="numeric" data-gs="' + xi + ':' + si + ':r" value="' + esc(t.r) + '" aria-label="Reps"><em>reps</em><input inputmode="decimal" data-gs="' + xi + ':' + si + ':kg" value="' + esc(t.kg) + '" aria-label="Kilos"><em>kg</em><button type="button" class="icon-btn sm" data-gsdel="' + xi + ':' + si + '" aria-label="Remove set"><i class="bi bi-x"></i></button></div>';
            }).join('') + '</div><button type="button" class="text-btn" data-gsadd="' + xi + '"><i class="bi bi-plus-lg"></i> Set</button></section>';
        }).join('') +
        '<form class="gym-addex"><input list="gymEx" name="n" placeholder="Add exercise, e.g. Bench press" autocomplete="off" maxlength="60"><datalist id="gymEx">' + Object.keys(EX.concat(sessions().reduce(function (a, q) { return a.concat((q.ex || []).map(function (x) { return x.n; })); }, [])).reduce(function (o, n) { o[n] = 1; return o; }, {})).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist><button class="pill-btn" type="submit" aria-label="Add exercise"><i class="bi bi-plus-lg"></i></button></form>' +
        '<div class="lf-foot">' + (isNew ? '<span class="spacer"></span>' : '<button type="button" class="text-btn danger" data-gdel><i class="bi bi-trash3"></i> Delete</button>') + '<button type="button" class="pill-btn wide" data-gsave><i class="bi bi-check2"></i> Save workout</button></div>';
    }
    box.addEventListener('submit', function (e) {
      e.preventDefault(); var n = e.target.n.value.trim(); if (!n) return;
      var sg = suggest(n); s.ex.push({ n: n, sets: [{ r: sg ? sg.reps : 8, kg: sg ? sg.next : '' }] }); draw();
      var last = box.querySelectorAll('[data-gs$=":kg"]'); if (last.length) last[last.length - 1].focus();
    });
    box.addEventListener('input', function (e) { var g = e.target.dataset.gs; if (g) { var q = g.split(':'); s.ex[+q[0]].sets[+q[1]][q[2]] = q[2] === 'kg' ? (num(e.target.value) == null ? '' : num(e.target.value)) : (parseInt(e.target.value, 10) || ''); } if (e.target.matches('[data-gdate]')) s.date = e.target.value || s.date; });
    box.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-gclose]')) return close();
      if ((b = e.target.closest('[data-gsadd]'))) { var x = s.ex[+b.dataset.gsadd], l = x.sets[x.sets.length - 1] || { r: 8, kg: '' }; x.sets.push({ r: l.r, kg: l.kg }); draw(); return; }
      if ((b = e.target.closest('[data-gsdel]'))) { var q = b.dataset.gsdel.split(':'); s.ex[+q[0]].sets.splice(+q[1], 1); if (!s.ex[+q[0]].sets.length) s.ex.splice(+q[0], 1); draw(); return; }
      if ((b = e.target.closest('[data-gexdel]'))) { s.ex.splice(+b.dataset.gexdel, 1); draw(); return; }
      if (e.target.closest('[data-gdel]')) { var t0 = Fe.tools(); t0.gym = (t0.gym || []).filter(function (x) { return x.id !== s.id; }); Fe.saveTools(t0); close(); toast('<i class="bi bi-trash3"></i> Workout deleted', function () { var t1 = Fe.tools(); t1.gym = (t1.gym || []).concat([sess]); Fe.saveTools(t1); }); return; }
      if (e.target.closest('[data-gsave]')) {
        s.ex = s.ex.filter(function (x) { x.sets = x.sets.filter(function (t) { return t.r || t.kg; }); return x.sets.length; });
        if (!s.ex.length) { close(); return; }
        var t = Fe.tools(); t.gym = (t.gym || []).filter(function (x) { return x.id !== s.id; }); t.gym.push(s); Fe.saveTools(t);
        /* tick the training habit for that day */
        var hb = readJSON('dash.habits', null);
        if (hb && hb.list) { var h = hb.list.filter(function (x) { return /train|gym|trening|styrke|strength/i.test(x.name); })[0]; if (h) { hb.log = hb.log || {}; var day = hb.log[s.date] = hb.log[s.date] || []; if (day.indexOf(h.id) < 0) { day.push(h.id); writeJSON('dash.habits', hb); window.dispatchEvent(new Event('habits:change')); } } }
        close(); toast('<i class="bi bi-person-arms-up"></i> Workout saved – ' + s.ex.length + ' exercise' + (s.ex.length === 1 ? '' : 's'));
      }
    });
    draw();
    var inp = box.querySelector('.gym-addex input'); if (inp && isNew) setTimeout(function () { inp.focus(); }, 40);
  }
  document.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-gymstart]')) return gymSheet(null);
    if ((b = e.target.closest('[data-gymedit]'))) gymSheet(Fe.list('gym').filter(function (x) { return x.id === b.dataset.gymedit; })[0]);
  });

  /* ======================= Rest-day advisor ======================= */
  mount('rest', function (el) {
    var r = window.Readiness ? window.Readiness() : null;
    if (!r || r.score == null) { el.innerHTML = card('rest', 'battery-half', 'Rest-day advisor', '', '<p class="empty kit-empty">Needs a few days of sleep, heart rate (HRV, resting pulse) from Apple Health, or your training log, to know your normal.</p>'); return; }
    var col = { go: '#22b35e', easy: '#c98500', rest: '#e66767' }[r.level], C = 2 * Math.PI * 34;
    var title = { go: 'Ready to train', easy: 'Go easy today', rest: 'Take a rest day' }[r.level];
    var tip = { go: 'Your body is recovered – a good day for a hard session.', easy: 'Train light: technique, mobility, a walk or an easy run.', rest: 'Rest, sleep early and eat well – you’ll come back stronger.' }[r.level];
    el.innerHTML = card('rest', 'battery-half', 'Rest-day advisor', '', '<div class="rd-row"><svg class="rd-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="trk"/><circle cx="40" cy="40" r="34" class="val" style="stroke:' + col + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - r.score / 100)).toFixed(1) + '"/><text x="40" y="46" text-anchor="middle">' + r.score + '</text></svg>' +
      '<div><b class="rd-t" style="color:' + col + '">' + title + '</b><p class="rd-tip">' + tip + '</p>' + (r.why.length ? '<ul class="rd-why">' + r.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') + '</div></div>', 'lp-rest');
  });

  /* ======================= Smart packing (Travel → trip → Prepare) ======================= */
  var packBtn = document.getElementById('tpPackBasics');
  if (packBtn) {
    var sp = document.createElement('button'); sp.type = 'button'; sp.className = 'text-btn'; sp.id = 'tpSmartPack'; sp.innerHTML = '<i class="bi bi-bag-check"></i> Smart list';
    packBtn.parentNode.insertBefore(sp, packBtn.nextSibling);
    var spShow = function () { sp.hidden = !on('smartpack'); if (on('smartpack')) packBtn.hidden = true; };
    window.addEventListener('features:change', spShow); window.addEventListener('travel:change', spShow); spShow();
    sp.addEventListener('click', function () {
      var m = location.hash.match(/trip=([\w-]+)/), F = window.Flow; if (!m || !F) return;
      var data = F.travel(), tr = (data.trips || []).filter(function (t) { return t.id === m[1]; })[0]; if (!tr) return;
      sp.disabled = true; sp.innerHTML = '<i class="bi bi-hourglass-split"></i> Checking the weather …';
      var nights = Math.max(1, Math.round((fromKey(tr.end || tr.start) - fromKey(tr.start)) / 864e5)), days = nights + 1;
      var soon = (fromKey(tr.start) - new Date()) / 864e5 < 15, p = tr.place;
      var wx = soon && p && p.lat != null ? fetch('https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lon + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=' + tr.start + '&end_date=' + (tr.end || tr.start))
        .then(function (r) { return r.json(); }).then(function (d) { var dd = d.daily || {}; return { max: Math.max.apply(null, dd.temperature_2m_max || [20]), min: Math.min.apply(null, dd.temperature_2m_min || [10]), rain: Math.max.apply(null, dd.precipitation_probability_max || [0]) }; }).catch(function () { return null; }) : Promise.resolve(null);
      wx.then(function (w) {
        if (!w) { var mo = fromKey(tr.start).getMonth(), lat = p && p.lat != null ? Math.abs(p.lat) : 55, winter = mo <= 2 || mo >= 10, summer = mo >= 5 && mo <= 7;
          w = { max: lat < 45 ? (summer ? 30 : winter ? 15 : 22) : (summer ? 22 : winter ? 2 : 12), min: lat < 45 ? (winter ? 8 : 15) : (winter ? -4 : 6), rain: 40, guess: true }; }
        var L = ['Passport or ID', 'Phone charger', 'Wallet and cards', 'Toothbrush and toiletries', 'Medicine', 'Headphones'];
        var n = Math.min(days, 7); L.push(n + ' × underwear', n + ' × socks', Math.min(days, 5) + ' × T-shirts');
        if (w.max >= 24) L.push('Sunglasses', 'Sunscreen', 'Shorts', 'Swimwear', 'Sandals', 'Cap or hat'); else if (w.max >= 15) L.push('Light jacket', 'Sunglasses');
        if (w.min <= 10) L.push('Warm sweater', 'Long trousers'); if (w.min <= 3) L.push('Winter jacket', 'Hat and gloves', 'Warm shoes');
        if (w.rain >= 50) L.push('Umbrella', 'Rain jacket');
        if (nights >= 5) L.push('Laundry bag'); if (p && p.cc && p.cc !== 'NO') L.push('Travel adapter', 'EU health card', 'Travel insurance details');
        if (/work|jobb|kurs|conference|konferanse|møte/i.test((tr.name || '') + ' ' + (tr.notes || ''))) L.push('Laptop and charger', 'Smart clothes', 'Business cards');
        if (/ski|hytte|cabin|fjell/i.test((tr.name || '') + ' ' + (tr.dest || '') + ' ' + (tr.notes || ''))) L.push('Wool layer', 'Ski goggles', 'Thermos');
        tr.pack = tr.pack || []; var added = 0;
        L.forEach(function (x) { var base = x.replace(/^\d+ × /, '').toLowerCase(); if (!tr.pack.some(function (q) { return q.text.toLowerCase().replace(/^\d+ × /, '') === base; })) { tr.pack.push({ id: uid(), text: x, done: false }); added++; } });
        F.saveTravel(data); window.dispatchEvent(new Event('travel:change'));
        sp.disabled = false; sp.innerHTML = '<i class="bi bi-bag-check"></i> Smart list';
        toast('<i class="bi bi-bag-check"></i> ' + added + ' things added' + (w.guess ? ' (weather from the season – forecast comes 2 weeks before)' : ' · ' + Math.round(w.min) + '–' + Math.round(w.max) + '°' + (w.rain >= 50 ? ', rain likely' : '')));
      });
    });
  }

  drawAll();
  window.LifePages = { redraw: drawAll, summary: summary };
})();
