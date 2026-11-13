/* Optional cards on the pages they belong to (Settings → Features):
     Finances   Strømpris (hour-by-hour price in NO1), Savings jars
     Work       FDV inspection notes (findings with TG, a summary to send), Holiday planner
     Health     Gym log (sets × reps × kg, progress, next weight), Rest-day advisor
     Travel     Smart packing (from the trip's length and weather)
   Each mounts into a [data-tool="…"] box in the page, like the other tools. */
/* The page part of life-pages.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is life-pages.js. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var __c = (window.__core || {})["lifepages"]; if (!__c) return;
  var nf = __c.nf, on = __c.on, mounts = __c.mounts, drawAll = __c.drawAll, dkey = __c.dkey, addDays = __c.addDays, prices = __c.prices, Fe = __c.Fe, pwLoading = __c.pwLoading, cheapest = __c.cheapest, pad = __c.pad, support = __c.support, TG = __c.TG, NS = __c.NS, nsName = __c.nsName, nsLabel = __c.nsLabel, partLabel = __c.partLabel, ownMap = __c.ownMap, KG = __c.KG, prio = __c.prio, PRIO = __c.PRIO, fmt = __c.fmt, toast = __c.toast, summary = __c.summary, readJSON = __c.readJSON, uid = __c.uid, fromKey = __c.fromKey, templates = __c.templates, saveTpls = __c.saveTpls, starter = __c.starter;
  var K = window.Kit;
  if (!Fe) return;
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : null; }
  var nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function card(id, icon, title, actions, body, cls) {
    return '<section class="card kit-card lp-card ' + (cls || '') + '" id="' + id + '"><div class="card-head"><h2><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h2>' +
      (actions ? '<div class="head-actions">' + actions + '</div>' : '') + '</div>' + body + '</section>';
  }
  function tile(label, value, sub) { return '<div class="kit-tile" data-tk="' + esc(label).replace(/\b(19|20)\d\d\b/g, 'Y') + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function mount(name, render) {
    var el = $t(name); if (!el) return;
    function draw() { var ok = on(name); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; } render(el); }
    mounts.push(draw);
  }
  ['tools:change', 'features:change', 'fin:change', 'habits:change', 'health:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(drawAll.t); drawAll.t = setTimeout(drawAll, 30); }); });
  window.Vault.onUnlock(function () { setTimeout(drawAll, 60); });
  window.addEventListener('hashchange', function () { if (/^#fdv=/.test(location.hash)) drawAll(); });
  var PW = { day: 'today' };
  function pwKey(k) { return 'pw:' + k; }
  mount('power', function (el) {
    var now = new Date(), tk = dkey(now), tom = addDays(tk, 1), k = PW.day === 'tomorrow' ? tom : tk;
    var h = prices(k), hTom = now.getHours() >= 13 ? prices(tom) : null;
    var cfg = (Fe.tools().powercfg) || {};
    var acts = '<div class="seg lp-seg"><button type="button" data-pwday="today" aria-pressed="' + (PW.day === 'today') + '"><span data-t="ui.today"><span data-t="ui.today">Today</span></span></button>' +
      (hTom || PW.day === 'tomorrow' ? '<button type="button" data-pwday="tomorrow" aria-pressed="' + (PW.day === 'tomorrow') + '"><span data-t="ui.tomorrow"><span data-t="ui.tomorrow">Tomorrow</span></span></button>' : '') + '</div>';
    if (!h) { el.innerHTML = card('power', 'lightning-charge', 'Strømpris', '', '<p class="muted">' + (pwLoading[k] === 'fail' ? I18N.k('ui.price-service-down', 'Couldn’t reach the price service right now – try again later.') : I18N.k('ui.getting-todays-prices', 'Getting today’s prices …')) + '</p>'); return; }
    var valid = h.filter(function (x) { return x != null; }), avg = valid.reduce(function (a, b) { return a + b; }, 0) / valid.length;
    var max = Math.max.apply(null, valid), min = Math.min.apply(null, valid), cur = k === tk ? h[now.getHours()] : null;
    var c3 = cheapest(h, 3, k === tk ? now.getHours() : 0), exp = h.indexOf(max);
    var lvl = function (p) { return p <= avg * .85 ? 'cheap' : p >= avg * 1.2 ? 'dear' : 'mid'; };
    var big = cur != null ? cur : avg;
    var body = '<div class="pw-now"><div><span class="muted">' + (cur != null ? 'Now, ' + pad(now.getHours()) + '–' + pad((now.getHours() + 1) % 24) : 'Average ' + (k === tom ? 'tomorrow' : 'today')) + '</span>' +
      '<b class="pw-big">' + nf.format(Math.round(big)) + ' <small>øre/kWh</small></b>' +
      '<span class="pw-lvl ' + lvl(big) + '">' + ({ cheap: 'Cheap', mid: 'Normal', dear: 'Expensive' })[lvl(big)] + '</span>' +
      (cfg.norgespris ? '<small class="muted" data-t="ui.you-pay-50-re-with-norgespris">You pay 50 øre with Norgespris</small>' : big > 93.75 ? '<small class="muted">≈ ' + nf.format(Math.round(support(big))) + ' øre after strømstøtte</small>' : '') + '</div>' +
      '<div class="pw-side"><span><i class="bi bi-arrow-down-circle"></i> Cheapest ' + (c3 ? pad(c3.h) + '–' + pad(c3.h + 3) + ' · ' + nf.format(Math.round(c3.avg)) + ' øre' : '–') + '</span>' +
      '<span><i class="bi bi-arrow-up-circle"></i> Most expensive ' + pad(exp) + '–' + pad((exp + 1) % 24) + ' · ' + nf.format(Math.round(max)) + ' øre</span>' +
      '<span><i class="bi bi-dash-circle"></i> Average ' + nf.format(Math.round(avg)) + ' øre</span></div></div>' +
      '<div class="pw-bars" role="img" aria-label="Price per hour">' + h.map(function (p, i) {
        var inC = c3 && i >= c3.h && i < c3.h + 3, isNow = k === tk && i === now.getHours();
        return '<i class="' + (p == null ? 'na ' : '') + lvl(p || avg) + (inC ? ' best' : '') + (isNow ? ' now' : '') + (k === tk && i < now.getHours() ? ' past' : '') + '" style="--h:' + (p == null ? 2 : Math.max(4, Math.round(p / max * 100))) + '%" title="' + pad(i) + ':00 · ' + (p == null ? '–' : nf.format(Math.round(p)) + ' øre') + '"></i>';
      }).join('') + '</div><div class="pw-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>' +
      '<p class="kit-foot"><span data-t="ui.spot-price-in-no1-with-vat-before-grid-r">Spot price in NO1 with VAT, before grid rent (nettleie). Prices from hvakosterstrommen.no.</span> <label class="lp-inl"><input type="checkbox" data-pwnorge' + (cfg.norgespris ? ' checked' : '') + '> <span data-t="ui.i-have-norgespris"><span data-t="ui.i-have-norgespris">I have Norgespris</span></span></label></p>';
    el.innerHTML = card('power', 'lightning-charge', 'Strømpris', acts, body, 'lp-power');
  });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-pwday]'); if (b) { PW.day = b.dataset.pwday; drawAll(); } });
  document.addEventListener('change', function (e) { if (e.target.matches('[data-pwnorge]')) { var t = Fe.tools(); t.powercfg = Object.assign({}, t.powercfg, { norgespris: e.target.checked }); Fe.saveTools(t); } });
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
  /* FDV after NS 3451 (building part codes) and NS 3424 (TG, KG, survey level) – 2026-11-13, JP */
  function codeOpts(sel) {
    var h = '<option value=""' + (!sel ? ' selected' : '') + '>' + esc(I18N.k('ui.ns-no-code', '– No code –')) + '</option>';
    NS.filter(function (q) { return q[0].length === 1; }).forEach(function (m) {
      var subs = NS.filter(function (q) { return q[0].length === 2 && q[0][0] === m[0]; }).map(function (q) { return [q[0], nsName(q[0])]; });
      h += '<optgroup label="' + esc(m[0] + ' ' + nsName(m[0])) + '">' + [[m[0], nsName(m[0])]].concat(subs).map(function (q) { return '<option value="' + q[0] + '"' + (q[0] === sel ? ' selected' : '') + '>' + esc(q[0] + ' ' + q[1]) + '</option>'; }).join('') + '</optgroup>';
    });
    return h + '<option value="+">' + esc(I18N.k('ui.ns-add-code', 'Add a three-digit code …')) + '</option>';
  }
  function tgName(t) { return { 0: I18N.k('ui.tg-0', 'No issues'), 1: I18N.k('ui.tg-1', 'Minor issues'), 2: I18N.k('ui.tg-2', 'Significant issues'), 3: I18N.k('ui.tg-3', 'Serious issues'), iu: I18N.k('ui.tg-iu', 'Not examined') }[t] || ''; }
  /* the codes under a code, one level down (your own list: three digits under two, four under three) */
  function kids(parent) { var m = ownMap(), n = String(parent || '').length + 1; return parent && n >= 3 ? Object.keys(m).filter(function (c) { return c.length === n && c.indexOf(parent) === 0; }).sort() : []; }
  function subOpts(parent, sel) { var l = kids(parent); return l.length ? '<option value="">' + esc(I18N.k('ui.ns-whole', 'All of {c}', { c: parent })) + '</option>' + l.map(function (c) { return '<option value="' + c + '"' + (c === sel ? ' selected' : '') + '>' + esc(c + ' ' + (ownMap()[c] || '')) + '</option>'; }).join('') : ''; }
  /* the picked code: the deepest level that is set */
  function formCode(f) { var v = f.code.value; if (v === '+') return '+'; return (f.code4 && !f.code4.hidden && f.code4.value) || (f.code3 && !f.code3.hidden && f.code3.value) || v; }
  function subs(f) { var c2 = f.code.value, o3 = c2 && c2 !== '+' ? subOpts(c2, f.code3.value) : ''; f.code3.innerHTML = o3; f.code3.hidden = !o3; var o4 = !f.code3.hidden && f.code3.value ? subOpts(f.code3.value, f.code4.value) : ''; f.code4.innerHTML = o4; f.code4.hidden = !o4; f.querySelector('.fdv-sub').hidden = f.code3.hidden; }
  window.FdvCode = { form: formCode, set: function (f, c) { c = String(c || ''); var top = c.length >= 2 ? c.slice(0, 2) : c; if (![].some.call(f.code.options, function (o) { return o.value === top; })) return; f.code.value = top; f.code3.value = ''; f.code4.value = ''; subs(f); if (c.length >= 3) { f.code3.value = c.slice(0, 3); subs(f); } if (c.length >= 4) { f.code4.value = c.slice(0, 4); subs(f); } } };
  function kgName(k) { return { 0: I18N.k('ui.kg-0', 'KG 0 – No consequences'), 1: I18N.k('ui.kg-1', 'KG 1 – Small consequences'), 2: I18N.k('ui.kg-2', 'KG 2 – Medium consequences'), 3: I18N.k('ui.kg-3', 'KG 3 – Large consequences') }[k] || ''; }
  function ktName(k) { return { safety: I18N.k('ui.kt-safety', 'Safety'), health: I18N.k('ui.kt-health', 'Health'), env: I18N.k('ui.kt-env', 'Environment'), cost: I18N.k('ui.kt-cost', 'Cost'), use: I18N.k('ui.kt-use', 'Function and use'), look: I18N.k('ui.kt-look', 'Aesthetics') }[k] || ''; }
  function whenName(k) { return { now: I18N.k('ui.when-now', 'Now'), y1: I18N.k('ui.when-y1', 'Within 1 year'), y5: I18N.k('ui.when-y5', '1–5 years'), y10: I18N.k('ui.when-y10', '5–10 years') }[k] || ''; }
  function prioName(p) { return { 3: I18N.k('ui.prio-3', 'High priority'), 2: I18N.k('ui.prio-2', 'Medium priority'), 1: I18N.k('ui.prio-1', 'Low priority'), 0: I18N.k('ui.prio-0', 'No priority') }[p] || ''; }
  function levelName(l) { return { 1: I18N.k('ui.level-1', 'Level 1 – general, visual'), 2: I18N.k('ui.level-2', 'Level 2 – more detailed, simple measurements'), 3: I18N.k('ui.level-3', 'Level 3 – thorough, special examinations') }[l] || ''; }
  function opts(list, sel, first) { return (first ? '<option value="">' + esc(first) + '</option>' : '') + list.map(function (q) { return '<option value="' + q[0] + '"' + (String(q[0]) === String(sel == null ? '' : sel) ? ' selected' : '') + '>' + esc(q[1]) + '</option>'; }).join(''); }
  /* order: by code (no code last), then worst first */
  function byCode(a, b) { var x = a.code || '~', y = b.code || '~'; return x < y ? -1 : x > y ? 1 : (String(b.tg) > String(a.tg) ? 1 : -1); }
  var fdvEdit = null;   /* 'inspection:finding' while a finding is being changed in the form */
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
  mount('fdv', function (el) {
    var list = (Fe.list('fdv') || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    /* from search: …/work/#fdv=<id> opens that inspection */
    var hm = location.hash.match(/^#fdv=([\w-]+)$/), goTo = null;
    if (hm && list.some(function (r) { return r.id === hm[1]; }) && document.documentElement.classList.contains('unlocked')) { fdvOpen = goTo = hm[1]; window.history.replaceState(null, '', location.pathname + location.search); }
    var body = list.length ? '<ul class="kit-list">' + list.map(function (r) {
      var f = r.findings || [], worst = ['3', '2', '1', '0'].filter(function (t) { return f.some(function (x) { return String(x.tg) === t; }); })[0];
      var open = fdvOpen === r.id;
      return '<li class="kit-item' + (open ? ' open' : '') + '"><button type="button" class="kit-main" data-fdvopen="' + esc(r.id) + '"><span class="kit-ic" style="--c:' + (worst ? TG[worst][2] : '#0891b2') + '"><i class="bi bi-building-check"></i></span>' +
        '<span class="kit-x"><b>' + esc(r.building) + '</b><small>' + esc([fmt(r.date), r.address, f.length + ' finding' + (f.length === 1 ? '' : 's'), r.level ? 'NS 3424 ' + I18N.k('ui.level-n', 'level {n}', { n: r.level }) : ''].filter(Boolean).join(' · ')) + '</small></span>' +
        (worst ? '<span class="kit-r"><span class="tg-b" style="--c:' + TG[worst][2] + '">' + TG[worst][0] + '</span></span>' : '') + '</button>' +
        (open ? fdvDetail(r) : '') + '</li>';
    }).join('') + '</ul>' : '<p class="empty kit-empty" data-t="ui.walk-a-building-note-each-finding-with-i">Walk a building, note each finding with its condition grade (TG) and a photo – and get a tidy summary you can send or paste into a report.</p>';
    el.innerHTML = card('fdv', 'building-check', I18N.k('ui.fdv-inspection-notes', 'FDV inspection notes'), '<button type="button" class="text-btn" data-fdvnew><i class="bi bi-plus-lg"></i> <span data-t="ui.new"><span data-t="ui.new">New</span></span></button>', body, 'lp-fdv');
    el.querySelectorAll('img[data-ph]').forEach(function (im) { getPhoto(im.dataset.ph).then(function (b) { if (b) im.src = URL.createObjectURL(b); else im.closest('.fdv-ph').remove(); }); });
    if (goTo) { var li = el.querySelector('.kit-item.open'); if (li) setTimeout(function () { li.scrollIntoView({ behavior: 'smooth', block: 'start' }); li.classList.add('sr-flash'); setTimeout(function () { li.classList.remove('sr-flash'); }, 1600); }, 350); }
  });
  function fdvDetail(r) {
    var f = (r.findings || []).slice().sort(byCode), ed = null, eq = fdvEdit && fdvEdit.split(':');
    if (eq && eq[0] === r.id) ed = (r.findings || []).filter(function (x) { return x.id === eq[1]; })[0] || null;
    var e = ed || {}, places = [].concat(Fe.tools().fdvparts || []).concat((r.findings || []).map(function (x) { return x.part; })).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).slice(0, 40);
    return '<div class="kit-detail fdv-detail">' +
      (f.length ? '<ul class="fdv-list">' + f.map(function (x) {
        var pr = prio(x), meta = [x.kg != null && x.kg !== '' ? KG[x.kg][0] + (x.kt ? ' (' + ktName(x.kt) + ')' : '') : '', pr != null ? prioName(pr) : '', x.when ? whenName(x.when) : '', x.cost ? nf.format(+x.cost) + ' kr' : ''].filter(Boolean).join(' · ');
        return '<li' + (ed && ed.id === x.id ? ' class="fdv-on"' : '') + '><span class="tg-b" style="--c:' + TG[x.tg][2] + '">' + TG[x.tg][0] + '</span><div data-noi18n><b>' + esc(partLabel(x)) + '</b> ' + esc(x.text) +
          (meta ? '<small class="fdv-meta">' + esc(meta) + '</small>' : '') + (x.cause ? '<small>' + esc(I18N.k('ui.cause', 'Cause')) + ': ' + esc(x.cause) + '</small>' : '') + (x.action ? '<small>→ ' + esc(x.action) + '</small>' : '') +
          (x.photo ? '<span class="fdv-ph"><img data-ph="' + esc(x.photo) + '" alt="Photo: ' + esc(partLabel(x)) + '"></span>' : '') + '</div>' +
          '<button type="button" class="icon-btn sm" data-fdvfedit="' + esc(r.id) + ':' + esc(x.id) + '" aria-label="Edit finding" data-t-aria-label="ui.edit-finding"><i class="bi bi-pencil"></i></button>' +
          '<button type="button" class="icon-btn sm" data-fdvdel="' + esc(r.id) + ':' + esc(x.id) + '" aria-label="Remove finding"><i class="bi bi-x"></i></button></li>';
      }).join('') + '</ul>' : '<p class="muted" data-t="ui.no-findings-yet-add-the-first-one-below">No findings yet – add the first one below.</p>') +
      '<form class="fdv-add' + (ed ? ' editing' : '') + '" data-fdvadd="' + esc(r.id) + '">' + (ed ? '<input type="hidden" name="fid" value="' + esc(ed.id) + '"><p class="fdv-edhd"><i class="bi bi-pencil"></i> <span data-t="ui.edit-finding">Edit finding</span></p>' : '') +
      '<div class="row2"><select name="code" aria-label="Building part (NS 3451)" data-t-aria-label="ui.building-part-ns-3451">' + codeOpts(ed ? String(e.code || '').slice(0, 2) : '') + '</select>' +
      '<select name="tg" aria-label="Condition grade">' + ['0', '1', '2', '3', 'iu'].map(function (t) { return '<option value="' + t + '"' + (t === (ed ? String(e.tg) : '2') ? ' selected' : '') + '>' + TG[t][0] + ' – ' + esc(tgName(t)) + '</option>'; }).join('') + '</select></div>' +
      (function () { var c = ed ? String(e.code || '') : '', o3 = c.length >= 2 ? subOpts(c.slice(0, 2), c.slice(0, 3)) : '', o4 = o3 && c.length >= 3 ? subOpts(c.slice(0, 3), c.slice(0, 4)) : '';
        return '<div class="row2 fdv-sub"' + (o3 ? '' : ' hidden') + '><select name="code3" aria-label="Three-digit code" data-t-aria-label="ui.ns-code3"' + (o3 ? '' : ' hidden') + '>' + o3 + '</select><select name="code4" aria-label="Four-digit code" data-t-aria-label="ui.ns-code4"' + (o4 ? '' : ' hidden') + '>' + o4 + '</select></div>'; })() +
      '<input name="newcode" class="fdv-newcode" placeholder="Code and name, e.g. 231 Load-bearing outer walls" data-t-placeholder="ui.ns-new-code-ph" maxlength="80" hidden>' +
      '<div class="row2"><select name="kg" aria-label="Consequence grade" data-t-aria-label="ui.consequence-grade">' + opts([['0', kgName(0)], ['1', kgName(1)], ['2', kgName(2)], ['3', kgName(3)]], ed ? e.kg : '', I18N.k('ui.kg-none', 'KG – not set')) + '</select>' +
      '<select name="kt" aria-label="Consequence for" data-t-aria-label="ui.consequence-for">' + opts([['safety', ktName('safety')], ['health', ktName('health')], ['env', ktName('env')], ['cost', ktName('cost')], ['use', ktName('use')], ['look', ktName('look')]], ed ? e.kt : '', I18N.k('ui.kt-none', 'Consequence for … (optional)')) + '</select></div>' +
      '<input name="part" list="fdvPlaces" placeholder="Where – room, floor, side (optional)" data-t-placeholder="ui.fdv-place-ph" maxlength="80" value="' + esc(e.part || '') + '"><datalist id="fdvPlaces">' + places.map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>' +
      '<input name="text" placeholder="What you found, e.g. Cracked sealant around window, 2nd floor" data-t-placeholder="ui.what-you-found-e-g-cracked-sealant-aroun" required maxlength="300" value="' + esc(e.text || '') + '">' +
      '<input name="action" placeholder="What should be done (optional)" data-t-placeholder="ui.what-should-be-done-optional" maxlength="200" value="' + esc(e.action || '') + '">' +
      '<details class="fdv-more"' + (ed && (e.cause || e.when || e.cost) ? ' open' : '') + '><summary data-t="ui.fdv-more">Cause, when and cost</summary>' +
        '<input name="cause" placeholder="Likely cause (optional)" data-t-placeholder="ui.fdv-cause-ph" maxlength="200" value="' + esc(e.cause || '') + '">' +
        '<div class="row2"><select name="when" aria-label="When" data-t-aria-label="ui.when">' + opts([['now', whenName('now')], ['y1', whenName('y1')], ['y5', whenName('y5')], ['y10', whenName('y10')]], ed ? e.when : '', I18N.k('ui.when-none', 'Do it … (optional)')) + '</select>' +
        '<input name="cost" inputmode="numeric" placeholder="Cost estimate, kr" data-t-placeholder="ui.fdv-cost-ph" maxlength="12" value="' + esc(e.cost || '') + '"></div></details>' +
      '<div class="fdv-row"><label class="text-btn fdv-photo"><i class="bi bi-camera"></i> <span data-t="ui.photo">Photo</span><input type="file" name="photo" accept="image/*" capture="environment" hidden></label><span class="spacer"></span>' +
      (ed ? '<button type="button" class="text-btn" data-fdvfcancel><span data-t="ui.cancel">Cancel</span></button><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> <span data-t="ui.save-finding">Save finding</span></button>'
        : '<button type="submit" class="pill-btn"><i class="bi bi-plus-lg"></i> <span data-t="ui.add-finding">Add finding</span></button>') + '</div></form>' +
      (r.notes ? '<p class="kit-notes">' + esc(r.notes) + '</p>' : '') +
      '<div class="fdv-acts"><button type="button" class="text-btn" data-fdvcopy="' + esc(r.id) + '"><i class="bi bi-clipboard"></i> <span data-t="ui.copy-summary"><span data-t="ui.copy-summary">Copy summary</span></span></button>' +
      (navigator.share ? '<button type="button" class="text-btn" data-fdvshare="' + esc(r.id) + '"><i class="bi bi-share"></i> <span data-t="ui.share"><span data-t="ui.share">Share</span></span></button>' : '') +
      '<button type="button" class="text-btn" data-fdvpdf="' + esc(r.id) + '"><i class="bi bi-file-earmark-pdf"></i> <span data-t="ui.pdf-report"><span data-t="ui.pdf-report">PDF report</span></span></button>' +
      '<button type="button" class="text-btn" data-fdvtodo="' + esc(r.id) + '"><i class="bi bi-box-arrow-in-right"></i> <span data-t="ui.tg-2-3-to-to-do">TG 2–3 to to-do</span></button>' +
      '<button type="button" class="text-btn" data-fdvedit="' + esc(r.id) + '"><i class="bi bi-pencil"></i> <span data-t="ui.edit"><span data-t="ui.edit">Edit</span></span></button></div></div>';
  }
  var FDV_FIELDS = { key: 'fdv', addTitle: 'New inspection', editTitle: 'Edit inspection', fields: [
    { k: 'building', type: 'title', label: 'Building', ph: 'Building or property, e.g. Storgata 12', req: true },
    { k: 'address', label: 'Address', ph: 'Street, town' }, { k: 'date', label: 'Date', type: 'date', req: true, def: function () { return dkey(new Date()); } },
    { k: 'client', label: 'Client', ph: 'Who it’s for' }, { k: 'level', label: I18N.k('ui.survey-level', 'Survey level (NS 3424)'), type: 'select', def: '1', options: function () { return [['1', levelName(1)], ['2', levelName(2)], ['3', levelName(3)]]; } },
    { k: 'purpose', label: I18N.k('ui.fdv-purpose', 'Purpose and scope'), type: 'textarea', rows: 2, ph: I18N.k('ui.fdv-purpose-ph', 'Why the survey is done and what it covers') },
    { k: 'limits', label: I18N.k('ui.fdv-limits', 'Not examined'), type: 'textarea', rows: 2, ph: I18N.k('ui.fdv-limits-ph', 'Rooms or parts you couldn’t reach, and why') },
    { k: 'docs', label: I18N.k('ui.fdv-docs', 'Documents received'), type: 'textarea', rows: 2, ph: I18N.k('ui.fdv-docs-ph', 'Drawings, FDV documentation, earlier reports …') },
    { k: 'present', label: I18N.k('ui.fdv-present', 'Present'), ph: I18N.k('ui.fdv-present-ph', 'Who was there') }, { k: 'weather', label: I18N.k('ui.fdv-weather', 'Weather'), ph: I18N.k('ui.fdv-weather-ph', 'E.g. dry, 4 °C') },
    { k: 'conclusion', label: I18N.k('ui.fdv-conclusion', 'Conclusion'), type: 'textarea', rows: 4, ph: I18N.k('ui.fdv-conclusion-ph', 'Your overall assessment – the state of the building and what matters most') },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 3 }],
    beforeSave: function (it) { it.findings = it.findings || []; }, afterSave: function (it, isNew) { if (isNew) fdvOpen = it.id; },
    onDelete: function (it) { (it.findings || []).forEach(function (x) { if (x.photo) delPhoto(x.photo); }); } };
  function saveFdv(id, fn) { var t = Fe.tools(); (t.fdv || []).forEach(function (r) { if (r.id === id) fn(r); }); Fe.saveTools(t); }
  document.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-fdvnew]') && K) return K.edit(FDV_FIELDS, null);
    if ((b = e.target.closest('[data-fdvedit]')) && K) return K.edit(FDV_FIELDS, Fe.list('fdv').filter(function (x) { return x.id === b.dataset.fdvedit; })[0]);
    if ((b = e.target.closest('[data-fdvfedit]'))) { fdvEdit = fdvEdit === b.dataset.fdvfedit ? null : b.dataset.fdvfedit; drawAll(); setTimeout(function () { var fm = document.querySelector('form.fdv-add.editing'); if (fm) { fm.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 80); return; }
    if (e.target.closest('[data-fdvfcancel]')) { fdvEdit = null; drawAll(); return; }
    if ((b = e.target.closest('[data-fdvopen]'))) { fdvEdit = null; fdvOpen = fdvOpen === b.dataset.fdvopen ? null : b.dataset.fdvopen; drawAll(); return; }
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
      Promise.all(ids.map(function (x) { return getPhoto(x.photo).then(function (bl) { return bl ? new File([bl], ((x.code || 'fdv') + '-' + x.id).replace(/[^\w-]+/g, '_') + '.jpg', { type: 'image/jpeg' }) : null; }); })).then(function (files) {
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
      (r.findings || []).filter(function (x) { return x.tg === '2' || x.tg === '3'; }).forEach(function (x) { todos.push({ id: uid(), text: (r.building + ': ' + partLabel(x) + ' – ' + (x.action || x.text)).slice(0, 200), done: false, focus: x.tg === '3' || prio(x) === 3 }); n++; });
      writeJSON('dash.todos', todos); window.dispatchEvent(new Event('todos:change'));
      toast('<i class="bi bi-check2-square"></i> ' + n + ' task' + (n === 1 ? '' : 's') + ' added to your to-do list');
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.name === 'code' && e.target.closest('.fdv-add')) { var fa = e.target.closest('.fdv-add'), nc = fa.querySelector('.fdv-newcode'); nc.hidden = e.target.value !== '+'; if (!nc.hidden) nc.focus(); fa.code3.value = ''; fa.code4.value = ''; subs(fa); }
    if (e.target.name === 'code3' && e.target.closest('.fdv-add')) { var fb = e.target.closest('.fdv-add'); fb.code4.value = ''; subs(fb); }
    if (e.target.name === 'photo' && e.target.closest('.fdv-add')) { var l = e.target.closest('label'); l.classList.toggle('has', !!e.target.files.length); l.querySelector('span').textContent = e.target.files.length ? 'Photo ✓' : 'Photo'; }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-fdvadd]'); if (!f) return;
    e.preventDefault();
    var id = f.dataset.fdvadd, old = f.fid ? f.fid.value : '', fid = old || uid(), file = f.photo.files[0];
    var code = formCode(f);
    if (code === '+') {   /* a three-digit code of your own: "231 Load-bearing outer walls" – remembered for the next time */
      var m = f.newcode.value.trim().match(/^(\d{3,4})\s*[-–:.]?\s*(.*)$/);
      if (!m) { f.newcode.hidden = false; f.newcode.focus(); toast('<i class="bi bi-info-circle"></i> ' + esc(I18N.k('ui.ns-code-help', 'Type the code first, e.g. 231 Load-bearing outer walls'))); return; }
      code = m[1]; var tl = Fe.tools(); tl.fdvcodes = (Array.isArray(tl.fdvcodes) ? tl.fdvcodes : []).filter(function (c) { return c && c.c !== code; }).concat([{ c: code, n: m[2].slice(0, 100) }]).sort(function (a, b) { return a.c < b.c ? -1 : 1; }).slice(0, 3000); Fe.saveTools(tl);
    }
    var cost = num(f.cost.value);
    var item = { id: fid, code: code, part: f.part.value.trim(), tg: f.tg.value, kg: f.kg.value, kt: f.kt.value, text: f.text.value.trim(), action: f.action.value.trim(), cause: f.cause.value.trim(), when: f.when.value, cost: cost != null && cost > 0 ? Math.round(cost) : '' };
    Object.keys(item).forEach(function (k) { if (item[k] === '' && k !== 'part') delete item[k]; });
    if (!item.text) return;
    var go = function () { saveFdv(id, function (r) { r.findings = r.findings || []; var at = -1; r.findings.forEach(function (x, i) { if (x.id === fid) at = i; });
      if (at > -1) { var was = r.findings[at]; if (item.photo && was.photo && item.photo !== was.photo) delPhoto(was.photo); if (!item.photo && was.photo) item.photo = was.photo; Object.keys(was).forEach(function (k) { if (!(k in item) && ['code', 'part', 'kg', 'kt', 'action', 'cause', 'when', 'cost', 'photo'].indexOf(k) < 0) item[k] = was[k]; }); r.findings[at] = item; } else r.findings.push(item); });
      if (old) { fdvEdit = null; toast('<i class="bi bi-check2"></i> ' + esc(I18N.k('ui.finding-saved', 'Finding saved'))); } };
    if (file) shrink(file).then(function (bl) { item.photo = 'ph-' + fid + (old ? '-' + Date.now().toString(36) : ''); return putPhoto(item.photo, bl); }).then(go, go); else go();
  });
  var RP = { photos: true };
  /* charts for the report (plain SVG, so they print): findings per building part, the TG × KG matrix, cost by when */
  var TGO = ['3', '2', '1', '0', 'iu'];
  function chartParts(f) {
    var rows = [], seen = {};
    f.forEach(function (x) { var k = x.code ? x.code.slice(0, 2) : ''; if (!seen[k]) { seen[k] = { k: k, n: {} }; rows.push(seen[k]); } seen[k].n[x.tg] = (seen[k].n[x.tg] || 0) + 1; });
    if (!rows.length) return '';
    var max = Math.max.apply(null, rows.map(function (r) { return TGO.reduce(function (a, t) { return a + (r.n[t] || 0); }, 0); })), W = 640, LX = 210, BW = W - LX - 40, RH = 26, H = rows.length * RH + 8;
    var g = rows.map(function (r, i) { var x = LX, y = 4 + i * RH, tot = 0, segs = '';
      TGO.forEach(function (t) { var n = r.n[t] || 0; if (!n) return; var w = n / max * BW; segs += '<rect x="' + x.toFixed(1) + '" y="' + (y + 5) + '" width="' + Math.max(2, w - 2).toFixed(1) + '" height="14" rx="3" fill="' + TG[t][2] + '"/>'; x += w; tot += n; });
      var lab = r.k ? nsLabel(r.k) : I18N.k('ui.ns-no-code', '– No code –'); if (lab.length > 30) lab = lab.slice(0, 29) + '…';
      return '<text x="' + (LX - 8) + '" y="' + (y + 16) + '" text-anchor="end" class="rp-cl">' + esc(lab) + '</text>' + segs + '<text x="' + (x + 6).toFixed(1) + '" y="' + (y + 16) + '" class="rp-cv">' + tot + '</text>'; }).join('');
    return '<figure class="rp-chart"><figcaption>' + esc(I18N.k('ui.fdv-chart-parts', 'Findings per building part')) + '</figcaption><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(I18N.k('ui.fdv-chart-parts', 'Findings per building part')) + '">' + g + '</svg>' + chartKey() + '</figure>';
  }
  function chartKey() { return '<p class="rp-key">' + TGO.map(function (t) { return '<span><i style="background:' + TG[t][2] + '"></i>' + TG[t][0] + '</span>'; }).join('') + '</p>'; }
  function chartMatrix(f) {
    var xs = f.filter(function (x) { return x.kg != null && x.kg !== '' && x.tg !== 'iu'; }); if (!xs.length) return '';
    var C = 64, X0 = 70, Y0 = 8, cell = '', zone = { 3: 'rgba(230,103,103,.30)', 2: 'rgba(201,133,0,.24)', 1: 'rgba(57,135,229,.16)', 0: 'rgba(34,179,94,.12)' };
    for (var k = 3; k >= 0; k--) for (var t = 0; t <= 3; t++) {
      var n = xs.filter(function (x) { return +x.tg === t && +x.kg === k; }).length, pr = prio({ tg: String(t), kg: String(k) }), cx = X0 + t * (C + 2), cy = Y0 + (3 - k) * (C + 2);
      cell += '<rect x="' + cx + '" y="' + cy + '" width="' + C + '" height="' + C + '" rx="6" fill="' + zone[pr] + '"/>' + (n ? '<circle cx="' + (cx + C / 2) + '" cy="' + (cy + C / 2) + '" r="' + (11 + Math.min(9, n * 2)) + '" fill="#fff" stroke="' + PRIO[pr][1] + '" stroke-width="2"/><text x="' + (cx + C / 2) + '" y="' + (cy + C / 2 + 5) + '" text-anchor="middle" class="rp-cn">' + n + '</text>' : '');
    }
    var ax = [0, 1, 2, 3].map(function (t) { return '<text x="' + (X0 + t * (C + 2) + C / 2) + '" y="' + (Y0 + 4 * (C + 2) + 14) + '" text-anchor="middle" class="rp-cl">TG ' + t + '</text>'; }).join('') +
      [0, 1, 2, 3].map(function (k) { return '<text x="' + (X0 - 8) + '" y="' + (Y0 + (3 - k) * (C + 2) + C / 2 + 4) + '" text-anchor="end" class="rp-cl">KG ' + k + '</text>'; }).join('');
    var W = X0 + 4 * (C + 2) + 10, H = Y0 + 4 * (C + 2) + 22;
    return '<figure class="rp-chart rp-mx"><figcaption>' + esc(I18N.k('ui.fdv-chart-matrix', 'Condition × consequence')) + '</figcaption><svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" style="max-width:100%" role="img" aria-label="' + esc(I18N.k('ui.fdv-chart-matrix', 'Condition × consequence')) + '">' + cell + ax + '</svg>' +
      '<p class="rp-key">' + [3, 2, 1].map(function (p) { return '<span><i style="background:' + zone[p] + ';border:1px solid ' + PRIO[p][1] + '"></i>' + esc(prioName(p)) + '</span>'; }).join('') + '</p></figure>';
  }
  function chartCost(f) {
    var B = [['now', whenName('now')], ['y1', whenName('y1')], ['y5', whenName('y5')], ['y10', whenName('y10')], ['', I18N.k('ui.fdv-when-unset', 'Not set')]].map(function (q) { return [q[1], f.filter(function (x) { return (x.when || '') === q[0]; }).reduce(function (a, x) { return a + (+x.cost || 0); }, 0)]; }).filter(function (q, i) { return q[1] > 0 || i < 4; });
    var max = Math.max.apply(null, B.map(function (q) { return q[1]; })); if (!(max > 0)) return '';
    var W = 360, H = 170, BW = 50, gap = (W - B.length * BW) / (B.length + 1), base = H - 30;
    var g = B.map(function (q, i) { var x = gap + i * (BW + gap), h = q[1] / max * (base - 22); return (q[1] ? '<path d="M' + x.toFixed(1) + ' ' + base + ' V' + (base - h + 4).toFixed(1) + ' q0 -4 4 -4 H' + (x + BW - 4).toFixed(1) + ' q4 0 4 4 V' + base + ' Z" fill="#0891b2"/><text x="' + (x + BW / 2).toFixed(1) + '" y="' + (base - h - 6).toFixed(1) + '" text-anchor="middle" class="rp-cv">' + esc(nf.format(Math.round(q[1] / 1000)) + 'k') + '</text>' : '') +
      '<text x="' + (x + BW / 2).toFixed(1) + '" y="' + (base + 16) + '" text-anchor="middle" class="rp-cl">' + esc(q[0]) + '</text>'; }).join('') + '<line x1="0" x2="' + W + '" y1="' + base + '" y2="' + base + '" stroke="#d5dae0"/>';
    return '<figure class="rp-chart rp-cc"><figcaption>' + esc(I18N.k('ui.fdv-chart-cost', 'Cost estimate by when (kr)')) + '</figcaption><svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" style="max-width:100%" role="img" aria-label="' + esc(I18N.k('ui.fdv-chart-cost', 'Cost estimate by when (kr)')) + '">' + g + '</svg></figure>';
  }
  /* the report after NS 3424's order: 1 the assignment, 2 the conclusion, 3 the main report (by NS 3451 code), 4 appendices (photos, grades) */
  function report(r) {
    var f = (r.findings || []).slice().sort(byCode), me = readJSON('dash.profile', {}) || {}, L = function (k, en) { return esc(I18N.k(k, en)); };
    var by = function (t) { return f.filter(function (x) { return String(x.tg) === t; }); };
    var worst = ['3', '2', '1', '0'].filter(function (t) { return by(t).length; })[0];
    var tgb = function (t) { return '<span class="rp-tg" style="--c:' + TG[t][2] + '">' + TG[t][0] + '</span>'; };
    var kgb = function (x) { return x.kg != null && x.kg !== '' && KG[x.kg] ? '<span class="rp-tg rp-kg" style="--c:' + KG[x.kg][2] + '">' + KG[x.kg][0] + '</span>' : ''; };
    var prb = function (x) { var p = prio(x); return p == null ? '–' : '<span class="rp-pr" style="--c:' + PRIO[p][1] + '">' + esc(prioName(p)) + '</span>'; };
    var todo = f.filter(function (x) { return x.tg === '3' || x.tg === '2'; }).sort(function (a, b) { var pa = prio(a), pb = prio(b); pa = pa == null ? -1 : pa; pb = pb == null ? -1 : pb; return pb - pa || (String(b.tg) > String(a.tg) ? 1 : String(b.tg) < String(a.tg) ? -1 : byCode(a, b)); });
    var cost = f.reduce(function (a, x) { return a + (+x.cost || 0); }, 0), dt = esc(fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' }));
    var nl = function (t) { return esc(t).replace(/\n/g, '<br>'); }, n4 = 0, nx = function () { return '4.' + (++n4) + ' '; };
    /* photos are numbered in the order they appear in the main report and shown in appendix 4.1 */
    var ph = [], phn = {}; if (RP.photos) f.forEach(function (x) { if (x.photo) { ph.push(x); phn[x.id] = ph.length; } });
    var mains = NS.filter(function (q) { return q[0].length === 1; }).map(function (q) { return q[0]; }).concat(['']);
    var grid = mains.map(function (m) { var xs = f.filter(function (x) { return (x.code || '').slice(0, 1) === m; }); return xs.length ? '<tr><td>' + esc(m ? m + ' ' + nsName(m) : I18N.k('ui.ns-no-code', '– No code –')) + '</td>' + ['3', '2', '1', '0', 'iu'].map(function (t) { var n = xs.filter(function (x) { return String(x.tg) === t; }).length; return '<td class="n">' + (n || '') + '</td>'; }).join('') + '</tr>' : ''; }).join('');
    var secs = [], seen = {};
    f.forEach(function (x) { var k = x.code ? x.code.slice(0, 2) : ''; if (!seen[k]) { seen[k] = 1; secs.push(k); } });
    /* 1 – the assignment */
    var who = [me.name, me.role].filter(Boolean).join(', ');
    var a1 = [[L('ui.client', 'Client'), r.client], [L('ui.address', 'Address'), r.address], [L('ui.date', 'Date'), dt ? fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''], [L('ui.inspected-by', 'Inspected by'), [who, me.employer].filter(Boolean).join(' · ')],
      [L('ui.survey-level', 'Survey level (NS 3424)'), levelName(r.level || 1)], [L('ui.fdv-present', 'Present'), r.present], [L('ui.fdv-weather', 'Weather'), r.weather]].filter(function (q) { return q[1]; });
    var h = '<header class="rp-head"><div><p class="rp-kick">' + L('ui.fdv-condition-report', 'Condition survey report') + '</p><h1>' + esc(r.building || 'Inspection') + '</h1>' +
      (r.address ? '<p class="rp-addr">' + esc(r.address) + '</p>' : '') + '</div>' +
      (worst ? '<div class="rp-worst" style="--c:' + TG[worst][2] + '"><small data-t="ui.worst-grade">Worst grade</small><b>' + TG[worst][0] + '</b></div>' : '') + '</header>' +
      '<p class="rp-std">' + L('ui.fdv-std-line', 'Building parts after NS 3451, condition and consequence grades after NS 3424.') + '</p>' +
      '<ol class="rp-toc"><li>' + L('ui.fdv-s1', 'Assignment') + '</li><li>' + L('ui.fdv-s2', 'Conclusion') + '</li><li>' + L('ui.fdv-s3', 'Main report') + '</li><li>' + L('ui.fdv-s4', 'Appendices') + '</li></ol>' +
      '<section class="rp-sec"><h2>1 ' + L('ui.fdv-s1', 'Assignment') + '</h2><table class="rp-meta rp-kv">' + a1.map(function (q) { return '<tr><th>' + q[0] + '</th><td data-noi18n>' + esc(q[1]) + '</td></tr>'; }).join('') + '</table>' +
        [['ui.fdv-purpose', 'Purpose and scope', r.purpose], ['ui.fdv-background', 'Background', r.intro], ['ui.fdv-limits', 'Not examined', r.limits], ['ui.fdv-docs', 'Documents received', r.docs]].filter(function (q) { return q[2]; }).map(function (q) { return '<h3>' + L(q[0], q[1]) + '</h3><p class="rp-p" data-noi18n>' + nl(q[2]) + '</p>'; }).join('') + '</section>' +
      /* 2 – the conclusion */
      '<section class="rp-sec"><h2>2 ' + L('ui.fdv-s2', 'Conclusion') + '</h2>' +
        (r.conclusion ? '<p class="rp-p rp-concl" data-noi18n>' + nl(r.conclusion) + '</p>' : '<p class="rp-p rp-muted">' + L('ui.fdv-no-conclusion', 'No conclusion written yet – add it with Conclusion above or in the inspection.') + '</p>') +
        '<h3>' + L('ui.fdv-findings-by-grade', 'Findings by condition grade') + '</h3><div class="rp-sum">' + ['3', '2', '1', '0', 'iu'].map(function (t) {
          return '<div style="--c:' + TG[t][2] + '"><b>' + by(t).length + '</b><span>' + TG[t][0] + '</span><small>' + esc(tgName(t)) + '</small></div>';
        }).join('') + '</div>' +
        chartParts(f) + '<div class="rp-charts2">' + chartMatrix(f) + chartCost(f) + '</div>' +
        (todo.length ? '<h3 data-t="ui.what-should-be-done">What should be done</h3><table class="rp-todo"><thead><tr><th data-t="ui.grade">Grade</th><th>' + L('ui.priority', 'Priority') + '</th><th data-t="ui.building-part">Building part</th><th data-t="ui.finding">Finding</th><th data-t="ui.action-2">Action</th><th>' + L('ui.when', 'When') + '</th></tr></thead><tbody>' + todo.map(function (x) {
          return '<tr><td>' + tgb(x.tg) + ' ' + kgb(x) + '</td><td>' + prb(x) + '</td><td data-noi18n>' + esc(partLabel(x)) + '</td><td data-noi18n>' + esc(x.text) + '</td><td data-noi18n>' + esc(x.action || '–') + (x.cost ? '<br><small>' + nf.format(+x.cost) + ' kr</small>' : '') + '</td><td>' + esc(whenName(x.when) || '–') + '</td></tr>';
        }).join('') + '</tbody></table>' : '') +
        (cost ? '<p class="rp-cost">' + L('ui.total-cost-estimate', 'Total cost estimate') + ': <b>' + nf.format(cost) + ' kr</b></p>' : '') + '</section>' +
      /* 3 – the main report: one sub-section per two-digit code */
      '<section class="rp-sec rp-newpage"><h2>3 ' + L('ui.fdv-s3', 'Main report') + '</h2><p class="rp-small">' + L('ui.findings-by-ns-3451', 'Findings by building part (NS 3451)') + '</p>' + (secs.length ? secs.map(function (k, si) {
        return '<section class="rp-part"><h3>3.' + (si + 1) + ' ' + esc(k ? nsLabel(k) : I18N.k('ui.ns-no-code', '– No code –')) + '</h3>' + f.filter(function (x) { return (x.code ? x.code.slice(0, 2) : '') === k; }).map(function (x) {
          var sub = [x.code && x.code.length > 2 ? nsLabel(x.code) : '', x.part].filter(Boolean).join(' · ');
          var mt = [x.kt ? I18N.k('ui.consequence-for', 'Consequence for') + ': ' + ktName(x.kt) : '', x.when ? I18N.k('ui.when', 'When') + ': ' + whenName(x.when) : '', x.cost ? nf.format(+x.cost) + ' kr' : ''].filter(Boolean).join(' · ');
          return '<div class="rp-f"><div class="rp-gr">' + tgb(x.tg) + kgb(x) + (prio(x) != null ? prb(x) : '') + '</div><div class="rp-ft" data-noi18n>' + (sub ? '<p class="rp-where">' + esc(sub) + '</p>' : '') + '<p>' + esc(x.text) + '</p>' +
            (x.cause ? '<p class="rp-act">' + L('ui.cause', 'Cause') + ': ' + esc(x.cause) + '</p>' : '') + (x.action ? '<p class="rp-act">' + L('ui.action-2', 'Action') + ': ' + esc(x.action) + '</p>' : '') + (mt ? '<p class="rp-act">' + esc(mt) + '</p>' : '') +
            (phn[x.id] ? '<p class="rp-act rp-phref">' + esc(I18N.k('ui.fdv-see-photo', 'See photo {n}', { n: phn[x.id] })) + '</p>' : '') + '</div></div>';
        }).join('') + '</section>';
      }).join('') : '<p data-t="ui.no-findings-were-recorded">No findings were recorded.</p>') +
        (r.notes ? '<section class="rp-part"><h3>3.' + (secs.length + 1) + ' ' + L('ui.notes', 'Notes') + '</h3><p class="rp-notes" data-noi18n>' + nl(r.notes) + '</p></section>' : '') + '</section>' +
      /* 4 – appendices */
      '<section class="rp-sec rp-newpage"><h2>4 ' + L('ui.fdv-s4', 'Appendices') + '</h2>' +
        (ph.length ? '<h3>' + nx() + L('ui.photos', 'Photos') + '</h3><div class="rp-phs">' + ph.map(function (x, i) { return '<figure class="rp-fig"><img class="rp-ph" data-rph="' + esc(x.photo) + '" alt=""><figcaption data-noi18n><b>' + esc(I18N.k('ui.fdv-photo-n', 'Photo {n}', { n: i + 1 })) + '</b> · ' + TG[x.tg][0] + ' · ' + esc(partLabel(x)) + ' – ' + esc(x.text) + '</figcaption></figure>'; }).join('') + '</div>' : '') +
        (grid ? '<h3>' + nx() + L('ui.fdv-grade-table', 'Grades per main group (table)') + '</h3><table class="rp-grid"><thead><tr><th>' + L('ui.building-part-ns-3451', 'Building part (NS 3451)') + '</th>' + ['3', '2', '1', '0', 'iu'].map(function (t) { return '<th class="n">' + TG[t][0] + '</th>'; }).join('') + '</tr></thead><tbody>' + grid + '</tbody></table>' : '') +
        '<h3>' + nx() + L('ui.condition-grades', 'Condition grades') + '</h3><table class="rp-legend">' + ['0', '1', '2', '3', 'iu'].map(function (t) {
          return '<tr><td>' + tgb(t) + '</td><td>' + esc({ 0: I18N.k('ui.tg0-long', 'No symptoms – no signs of wear or damage.'), 1: I18N.k('ui.tg1-long', 'Small symptoms – normal wear, some maintenance may be needed.'), 2: I18N.k('ui.tg2-long', 'Medium symptoms – clear wear or damage, should be followed up.'), 3: I18N.k('ui.tg3-long', 'Large symptoms – serious damage or risk, needs action.'), iu: I18N.k('ui.tgiu-long', 'Not examined (no access).') }[t]) + '</td></tr>';
        }).join('') + '</table>' +
        '<h3>' + nx() + L('ui.consequence-grades', 'Consequence grades') + '</h3><table class="rp-legend">' + ['0', '1', '2', '3'].map(function (k) {
          return '<tr><td>' + kgb({ kg: k }) + '</td><td>' + esc({ 0: I18N.k('ui.kg0-long', 'No consequences.'), 1: I18N.k('ui.kg1-long', 'Small consequences.'), 2: I18N.k('ui.kg2-long', 'Medium consequences.'), 3: I18N.k('ui.kg3-long', 'Large consequences – for safety, health, the environment, function or cost.') }[k]) + '</td></tr>';
        }).join('') + '</table><p class="rp-small">' + L('ui.prio-explained', 'Priority is worked out from TG × KG: 6 or more high, 3–5 medium, 1–2 low.') + '</p></section>' +
      '<footer class="rp-foot">' + esc(r.building || '') + ' · ' + dt + (me.email ? ' · ' + esc(me.email) : '') + (me.phone ? ' · ' + esc(me.phone) : '') + '</footer>';
    return h;
  }
  function openReport(r) {
    var bg = document.createElement('div'); bg.className = 'rp-bg';
    bg.innerHTML = '<div class="rp-bar"><button type="button" class="text-btn" data-rpclose><i class="bi bi-x-lg"></i> <span data-t="ui.close"><span data-t="ui.close">Close</span></span></button><span class="spacer"></span>' +
      '<label class="rp-opt"><input type="checkbox" data-rpphotos' + (RP.photos ? ' checked' : '') + '> <span data-t="ui.photos"><span data-t="ui.photos">Photos</span></span></label>' +
      '<button type="button" class="text-btn" data-rpintro><i class="bi bi-text-paragraph"></i> <span data-t="ui.fdv-conclusion">Conclusion</span></button>' +
      '<button type="button" class="pill-btn" data-rpprint><i class="bi bi-file-earmark-pdf"></i> <span data-t="ui.save-as-pdf"><span data-t="ui.save-as-pdf">Save as PDF</span></span></button></div>' +
      '<p class="rp-hint">In the print window, choose <b data-t="ui.save-as-pdf">Save as PDF</b> (on iPhone: pinch out on the preview, then Share).</p><textarea class="rp-introbox" rows="4" maxlength="4000" placeholder="Your overall assessment – the state of the building and what matters most" data-t-placeholder="ui.fdv-conclusion-ph" hidden></textarea><article class="rp-doc"></article>';
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
    var ib = bg.querySelector('.rp-introbox'); ib.value = r.conclusion || '';
    ib.addEventListener('input', function () { r.conclusion = ib.value.trim(); clearTimeout(draw.t); draw.t = setTimeout(function () { draw(); saveFdv(r.id, function (x) { x.conclusion = r.conclusion; }); }, 400); });
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
      (next ? tile(I18N.k('ui.next-public-holiday', 'Next public holiday'), esc(next.h.name), fmt(next.k, { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</div>' +
      '<h3 class="lp-h3" data-t="ui.longest-breaks-for-the-fewest-days">Longest breaks for the fewest days</h3>' +
      (br.length ? '<ul class="hp-list">' + br.map(function (x) {
        var plannedAlready = (cfg.plans || []).some(function (p) { return p.take === x.take; });
        return '<li><div class="hp-ratio"><b>' + x.total + '</b><small data-t="ui.days-off"><span data-t="ui.days-off"><span data-t="ui.days-off">days off</span></span></small></div><div class="hp-x"><b>' + esc(x.name) + '</b><span>Take ' + x.used + ' day' + (x.used === 1 ? '' : 's') + ': ' + esc(fmt(x.take, { weekday: 'short', day: 'numeric', month: 'short' })) + (x.takeTo !== x.take ? ' – ' + esc(fmt(x.takeTo, { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</span><small>Off ' + esc(fmt(x.a, { weekday: 'short', day: 'numeric', month: 'short' })) + ' – ' + esc(fmt(x.b, { weekday: 'short', day: 'numeric', month: 'short' })) + '</small></div>' +
          (plannedAlready ? '<span class="kit-badge" data-t="ui.in-calendar"><span data-t="ui.in-calendar"><span data-t="ui.in-calendar">In calendar</span></span></span>' : '<button type="button" class="text-btn" data-hpplan="' + x.take + '|' + x.takeTo + '|' + x.a + '|' + x.b + '|' + x.used + '|' + esc(x.name) + '"><i class="bi bi-calendar-plus"></i> <span data-t="ui.plan-it"><span data-t="ui.plan-it">Plan it</span></span></button>') + '</li>';
      }).join('') + '</ul>' : '<p class="muted" data-t="ui.no-clever-breaks-in-the-next-12-months">No clever breaks in the next 12 months.</p>') +
      (on('flex') ? '' : '<p class="kit-foot">Holiday days a year: <input class="lp-num" type="number" min="0" max="60" value="' + total + '" data-hpcfg="total" aria-label="Holiday days a year"> · used so far: <input class="lp-num" type="number" min="0" max="60" value="' + used + '" data-hpcfg="used" aria-label="Holiday days used"></p>');
    el.innerHTML = card('holiday', 'sun', I18N.k('ui.holiday-planner', 'Holiday planner'), '', body, 'lp-holiday');
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
  var EX = ['Bench press', 'Squat', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-ups', 'Lat pulldown', 'Leg press', 'Lunges', 'Romanian deadlift', 'Biceps curl', 'Triceps pushdown', 'Dips', 'Seated row', 'Leg curl', I18N.k('ui.calf-raise', 'Calf raise'), 'Plank'];
  function sessions() { return (Fe.list('gym') || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }); }
  function e1rm(s) { return (+s.kg || 0) * (1 + (+s.r || 0) / 30); }
  function history(name) {
    var out = []; sessions().slice().reverse().forEach(function (s) { (s.ex || []).forEach(function (x) { if (x.n.toLowerCase() === name.toLowerCase() && x.sets && x.sets.length) out.push({ date: s.date, sets: x.sets, best: Math.max.apply(null, x.sets.map(e1rm)) }); }); });
    return out;
  }
  function suggest(name) {
    var h = history(name); if (!h.length) return null;
    var last = h[h.length - 1], top = Math.max.apply(null, last.sets.map(function (s) { return +s.kg || 0; }));
    var topSets = last.sets.filter(function (s) { return (+s.kg || 0) === top; }), reps = Math.min.apply(null, topSets.map(function (s) { return +s.r || 0; }));
    if (!top) return { last: last, text: topSets.length + '×' + reps, next: 0, reps: reps + 1, up: false, bw: true };   // body weight (dips, pull-ups …): one more rep
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
    var body = '<div class="kit-tiles">' + tile(I18N.k('ui.this-week', 'This week'), wk.length, 'session' + (wk.length === 1 ? '' : 's')) + tile('Volume', nf.format(Math.round(vol)) + ' <small>kg</small>', 'this week') + tile(I18N.k('ui.new-bests', 'New bests'), prs, 'last 30 days') + '</div>' +
      (top.length ? '<h3 class="lp-h3" data-t="ui.progress"><span data-t="ui.progress"><span data-t="ui.progress">Progress</span></span></h3><ul class="gym-prog">' + top.map(function (n) {
        var h = history(n).slice(-10), mx = Math.max.apply(null, h.map(function (x) { return x.best; })), mn = Math.min.apply(null, h.map(function (x) { return x.best; })), sg = suggest(n);
        var pts = h.map(function (x, i) { return (h.length === 1 ? 50 : i / (h.length - 1) * 100).toFixed(1) + ',' + (mx === mn ? 50 : 90 - (x.best - mn) / (mx - mn) * 80).toFixed(1); }).join(' ');
        var heavy = 0; history(n).forEach(function (x) { x.sets.forEach(function (t) { heavy = Math.max(heavy, +t.kg || 0); }); }); var isPr = h.length > 1 && h[h.length - 1].best >= Math.max.apply(null, h.slice(0, -1).map(function (x) { return x.best; }));
        return '<li><div class="gym-x"><b>' + esc(n) + (isPr ? ' <span class="hl-chip" style="--c:#e8743b"><i class="bi bi-trophy"></i> <span data-t="ui.best"><span data-t="ui.best">Best</span></span></span>' : '') + '</b><small>' + esc((sg ? 'Last ' + sg.text : '') + (heavy ? ' · record ' + nf1.format(heavy) + ' kg' : '')) + '</small></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" class="gym-spark" aria-hidden="true"><polyline points="' + pts + '"/></svg>' +
          '<div class="gym-next"><small data-t="ui.next"><span data-t="ui.next"><span data-t="ui.next">Next</span></span></small><b>' + (sg ? (sg.bw ? '' : nf1.format(sg.next) + ' kg ') + '× ' + sg.reps : '–') + '</b></div></li>';
      }).join('') + '</ul>' : '') +
      (l.length ? '<h3 class="lp-h3" data-t="ui.recent"><span data-t="ui.recent"><span data-t="ui.recent">Recent</span></span></h3><ul class="kit-list">' + l.slice(0, 4).map(function (s) { return '<li class="kit-item"><button type="button" class="kit-main" data-gymedit="' + esc(s.id) + '"><span class="kit-ic" style="--c:#d55181"><i class="bi bi-person-arms-up"></i></span><span class="kit-x"><b>' + esc(fmt(s.date, { weekday: 'long', day: 'numeric', month: 'short' })) + '</b><small>' + esc((s.ex || []).map(function (x) { return x.n + ' ' + (x.sets || []).length + '×'; }).join(' · ')) + '</small></span></button></li>'; }).join('') + '</ul>' :
        '<p class="empty kit-empty" data-t="ui.log-sets-reps-and-kilos-per-exercise-it">Log sets, reps and kilos per exercise. It shows your progress and suggests the weight for next time.</p>');
    var tpls = templates();
    var tplRow = '<div class="gym-tpls" aria-label="Workout templates" data-t-aria-label="ui.workout-templates"><span class="gym-tpl-l"><i class="bi bi-collection"></i> <span data-t="ui.start"><span data-t="ui.start">Start</span></span></span>' + (tpls.length ? tpls.map(function (t) {
        return '<span class="gym-tpl' + (tplEdit ? ' editing' : '') + '"><button type="button" class="lf-chip" data-gymtpl="' + esc(t.id) + '" title="' + esc(t.ex.map(function (x) { return x.n; }).join(', ')) + '">' + esc(t.name) + ' <small>' + t.ex.length + '</small></button>' +
          (tplEdit ? '<button type="button" class="icon-btn sm" data-gymtpldel="' + esc(t.id) + '" aria-label="Delete ' + esc(t.name) + '"><i class="bi bi-x"></i></button>' : '') + '</span>';
      }).join('') + '<button type="button" class="icon-btn sm" data-gymtpledit aria-pressed="' + tplEdit + '" aria-label="' + (tplEdit ? 'Done' : 'Edit templates') + '" title="' + (tplEdit ? 'Done' : 'Edit templates') + '"><i class="bi bi-' + (tplEdit ? 'check2' : 'pencil') + '"></i></button>'
      : '<button type="button" class="lf-chip" data-gymstarter><i class="bi bi-plus-lg"></i> Push · Pull · Legs</button><small class="muted" data-t="ui.or-save-any-workout-as-a-template">or save any workout as a template</small>') + '</div>';
    el.innerHTML = card('gym', 'person-arms-up', I18N.k('ui.gym-log', 'Gym log'), '<button type="button" class="text-btn" data-gymstart><i class="bi bi-play-fill"></i> <span data-t="ui.start-workout"><span data-t="ui.start-workout">Start workout</span></span></button>', tplRow + body, 'lp-gym');
  });
  var tplEdit = false;
  function fromTpl(t) {
    return { id: uid(), date: dkey(new Date()), tpl: t.id, ex: t.ex.map(function (x) {
      var sg = suggest(x.n), n = Math.max(1, Math.min(10, +x.sets || 3)), out = [];
      for (var i = 0; i < n; i++) out.push({ r: sg ? sg.reps : (+x.r || 8), kg: sg && !sg.bw ? sg.next : '' });
      return { n: x.n, sets: out };
    }) };
  }
  function tplOf(s) { return { n: s.n, sets: (s.sets || []).length || 3, r: Math.max.apply(null, (s.sets || [{ r: 8 }]).map(function (t) { return +t.r || 0; })) || 8 }; }
  function gymSheet(sess, tpl) {
    var s = sess ? JSON.parse(JSON.stringify(sess)) : tpl ? fromTpl(tpl) : { id: uid(), date: dkey(new Date()), ex: [] }, isNew = !sess, naming = false;
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<div class="fo-box lf-box gym-box" role="dialog" aria-modal="true" aria-label="Workout" data-t-aria-label="ui.workout"></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var box = bg.firstChild;
    function close() { bg.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape' && !e.target.closest('input')) { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    function draw() {
      var T = s.tpl ? templates().filter(function (t) { return t.id === s.tpl; })[0] : null;
      box.innerHTML = '<div class="lf-head"><h3><i class="bi bi-person-arms-up"></i> ' + (T ? esc(T.name) : isNew ? 'Workout' : 'Edit workout') + '</h3><button type="button" class="icon-btn sm" data-gclose aria-label="Close" data-t-aria-label="ui.close"><i class="bi bi-x-lg"></i></button></div>' +
        '<label class="gym-date"><span data-t="ui.date"><span data-t="ui.date">Date</span></span> <input type="date" data-gdate value="' + s.date + '"></label>' +
        s.ex.map(function (x, xi) {
          var sg = suggest(x.n);
          return '<section class="gym-ex"><div class="gym-exh"><b>' + esc(x.n) + '</b>' + (sg ? '<small>Last ' + esc(sg.text) + ' · try <b>' + (sg.bw ? '' : nf1.format(sg.next) + ' kg ') + '× ' + sg.reps + '</b>' + (sg.up ? ' ↑' : '') + '</small>' : '') + '<button type="button" class="icon-btn sm" data-gexdel="' + xi + '" aria-label="Remove ' + esc(x.n) + '"><i class="bi bi-trash3"></i></button></div>' +
            '<div class="gym-sets">' + x.sets.map(function (t, si) {
              return '<div class="gym-set"><span>' + (si + 1) + '</span><input inputmode="numeric" data-gs="' + xi + ':' + si + ':r" value="' + esc(t.r) + '" aria-label="Reps"><em data-t="ui.reps"><span data-t="ui.reps"><span data-t="ui.reps">reps</span></span></em><input inputmode="decimal" data-gs="' + xi + ':' + si + ':kg" value="' + esc(t.kg) + '" aria-label="Kilos"><em>kg</em><button type="button" class="icon-btn sm" data-gsdel="' + xi + ':' + si + '" aria-label="Remove set"><i class="bi bi-x"></i></button></div>';
            }).join('') + '</div><button type="button" class="text-btn" data-gsadd="' + xi + '"><i class="bi bi-plus-lg"></i> <span data-t="ui.set"><span data-t="ui.set">Set</span></span></button></section>';
        }).join('') +
        '<form class="gym-addex"><input list="gymEx" name="n" placeholder="Add exercise, e.g. Bench press" data-t-placeholder="ui.add-exercise-e-g-bench-press" autocomplete="off" maxlength="60"><datalist id="gymEx">' + Object.keys(EX.concat(sessions().reduce(function (a, q) { return a.concat((q.ex || []).map(function (x) { return x.n; })); }, [])).reduce(function (o, n) { o[n] = 1; return o; }, {})).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist><button class="pill-btn" type="submit" aria-label="Add exercise"><i class="bi bi-plus-lg"></i></button></form>' +
        (s.ex.length ? (naming ? '<div class="gym-tplname"><input data-gtplname placeholder="Template name, e.g. Push" maxlength="30" value="' + esc(T ? T.name : '') + '" autocomplete="off"><button type="button" class="pill-btn sm" data-gtplsave data-t="ui.save"><span data-t="ui.save"><span data-t="ui.save">Save</span></span></button><button type="button" class="icon-btn sm" data-gtplx aria-label="Cancel" data-t-aria-label="ui.cancel"><i class="bi bi-x"></i></button></div>'
          : '<div class="gym-tplbar">' + (T ? '<button type="button" class="text-btn" data-gtplupd><i class="bi bi-arrow-repeat"></i> Update “' + esc(T.name) + '”</button>' : '') + '<button type="button" class="text-btn" data-gtplnew><i class="bi bi-collection"></i> <span data-t="ui.save-as-template">Save as template</span></button></div>') : '') +
        '<div class="lf-foot">' + (isNew ? '<span class="spacer"></span>' : '<button type="button" class="text-btn danger" data-gdel><i class="bi bi-trash3"></i> <span data-t="ui.delete"><span data-t="ui.delete">Delete</span></span></button>') + '<button type="button" class="pill-btn wide" data-gsave><i class="bi bi-check2"></i> <span data-t="ui.save-workout"><span data-t="ui.save-workout">Save workout</span></span></button></div>';
    }
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('[data-gtplname]')) { e.preventDefault(); var b = box.querySelector('[data-gtplsave]'); if (b) b.click(); } });
    box.addEventListener('submit', function (e) {
      e.preventDefault(); var n = e.target.n.value.trim(); if (!n) return;
      var sg = suggest(n); s.ex.push({ n: n, sets: [{ r: sg ? sg.reps : 8, kg: sg && !sg.bw ? sg.next : '' }] }); draw();
      var last = box.querySelectorAll('[data-gs$=":kg"]'); if (last.length) last[last.length - 1].focus();
    });
    box.addEventListener('input', function (e) { var g = e.target.dataset.gs; if (g) { var q = g.split(':'); s.ex[+q[0]].sets[+q[1]][q[2]] = q[2] === 'kg' ? (num(e.target.value) == null ? '' : num(e.target.value)) : (parseInt(e.target.value, 10) || ''); } if (e.target.matches('[data-gdate]')) s.date = e.target.value || s.date; });
    box.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-gclose]')) return close();
      if (e.target.closest('[data-gtplnew]')) { naming = true; draw(); var ni = box.querySelector('[data-gtplname]'); if (ni) ni.focus(); return; }
      if (e.target.closest('[data-gtplx]')) { naming = false; draw(); return; }
      if (e.target.closest('[data-gtplsave]') || e.target.closest('[data-gtplupd]')) {
        var upd = !!e.target.closest('[data-gtplupd]'), nm = upd ? '' : (box.querySelector('[data-gtplname]').value || '').trim();
        if (!upd && !nm) { box.querySelector('[data-gtplname]').focus(); return; }
        var L = templates(), ex = s.ex.filter(function (x) { return x.n; }).map(tplOf), same = upd ? L.filter(function (t) { return t.id === s.tpl; })[0] : L.filter(function (t) { return String(t.name || '').toLowerCase() === nm.toLowerCase(); })[0];
        if (same) { same.ex = ex; if (nm) same.name = nm; } else { same = { id: uid(), name: nm.slice(0, 30), ex: ex }; L.push(same); }
        s.tpl = same.id; saveTpls(L); naming = false; draw();
        toast('<i class="bi bi-collection"></i> Template “' + esc(same.name) + '” saved – ' + ex.length + ' exercise' + (ex.length === 1 ? '' : 's')); return;
      }
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
    if ((b = e.target.closest('[data-gymtpl]'))) { var tp = templates().filter(function (t) { return t.id === b.dataset.gymtpl; })[0]; if (tp) gymSheet(null, tp); return; }
    if (e.target.closest('[data-gymstarter]')) return starter();
    if (e.target.closest('[data-gymtpledit]')) { tplEdit = !tplEdit; drawAll(); return; }
    if ((b = e.target.closest('[data-gymtpldel]'))) { var all = templates(), gone = all.filter(function (t) { return t.id === b.dataset.gymtpldel; })[0]; saveTpls(all.filter(function (t) { return t !== gone; })); if (gone) toast('<i class="bi bi-trash3"></i> Template “' + esc(gone.name) + '” deleted', function () { saveTpls(templates().concat([gone])); }); return; }
    if ((b = e.target.closest('[data-gymedit]'))) gymSheet(Fe.list('gym').filter(function (x) { return x.id === b.dataset.gymedit; })[0]);
  });
  mount('rest', function (el) {
    var r = window.Readiness ? window.Readiness() : null;
    if (!r || r.score == null) { el.innerHTML = card('rest', 'battery-half', I18N.k('ui.rest-day-advisor', 'Rest-day advisor'), '', '<p class="empty kit-empty" data-t="ui.needs-a-few-days-of-sleep-heart-rate-hrv">Needs a few days of sleep, heart rate (HRV, resting pulse) from Apple Health, or your training log, to know your normal.</p>'); return; }
    var col = { go: '#22b35e', easy: '#c98500', rest: '#e66767' }[r.level], C = 2 * Math.PI * 34;
    var title = { go: 'Ready to train', easy: 'Go easy today', rest: 'Take a rest day' }[r.level];
    var tip = { go: 'Your body is recovered – a good day for a hard session.', easy: 'Train light: technique, mobility, a walk or an easy run.', rest: 'Rest, sleep early and eat well – you’ll come back stronger.' }[r.level];
    el.innerHTML = card('rest', 'battery-half', I18N.k('ui.rest-day-advisor', 'Rest-day advisor'), '', '<div class="rd-row"><svg class="rd-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="trk"/><circle cx="40" cy="40" r="34" class="val" style="stroke:' + col + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - r.score / 100)).toFixed(1) + '"/><text x="40" y="46" text-anchor="middle">' + r.score + '</text></svg>' +
      '<div><b class="rd-t" style="color:' + col + '">' + title + '</b><p class="rd-tip">' + tip + '</p>' + (r.why.length ? '<ul class="rd-why">' + r.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') + '</div></div>', 'lp-rest');
  });
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
        L.forEach(function (x) { var base = x.replace(/^\d+ × /, '').toLowerCase(); if (!tr.pack.some(function (q) { return String(q.text || '').toLowerCase().replace(/^\d+ × /, '') === base; })) { tr.pack.push({ id: uid(), text: x, done: false }); added++; } });
        F.saveTravel(data); window.dispatchEvent(new Event('travel:change'));
        sp.disabled = false; sp.innerHTML = '<i class="bi bi-bag-check"></i> Smart list';
        toast('<i class="bi bi-bag-check"></i> ' + added + ' things added' + (w.guess ? ' (weather from the season – forecast comes 2 weeks before)' : ' · ' + Math.round(w.min) + '–' + Math.round(w.max) + '°' + (w.rain >= 50 ? ', rain likely' : '')));
      });
    });
  }
  drawAll();
})();
