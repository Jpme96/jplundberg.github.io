/* FDV inspection notes (Work page only, split from life-pages.page.js 2026-11-13): findings after NS 3451 and NS 3424,
   the report after NS 3424's order with charts. The everywhere part (summary, NS headings, KG, priority) is in life-pages.js. */
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
  window.addEventListener('hashchange', function () { if (/^#fdv=/.test(location.hash)) drawAll(); });
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
  /* Work → Inspections (JP 2026-11-14): the list, and one inspection on a page of its own with a back button and tabs
     (Findings, Building, Conclusion, Report). The page is #fdv=<id> in the address, so the phone's back gesture closes it. */
  var fdvOpen = null, fdvTab = 'findings';
  try { fdvTab = sessionStorage.getItem('dash.fdvTab') || 'findings'; } catch (e) {}
  function hashId() { var m = location.hash.match(/^#fdv=([\w-]+)$/); return m ? m[1] : null; }
  fdvOpen = hashId();
  function openInsp(id, tab) { fdvEdit = null; fdvOpen = id; if (tab) setTab(tab); if (hashId() !== id) history.pushState({ fdv: id }, '', location.pathname + location.search + '#fdv=' + id); drawAll(); window.scrollTo(0, 0); }
  function closeInsp() { if (hashId() && history.state && history.state.fdv) { history.back(); return; } fdvOpen = null; fdvEdit = null; history.replaceState(null, '', location.pathname + location.search); drawAll(); }
  function setTab(t) { fdvTab = t; try { sessionStorage.setItem('dash.fdvTab', t); } catch (e) {} }
  window.addEventListener('popstate', function () { var id = hashId(); if (id !== fdvOpen) { fdvOpen = id; fdvEdit = null; drawAll(); } });
  function worstOf(r) { var f = r.findings || []; return ['3', '2', '1', '0'].filter(function (t) { return f.some(function (x) { return String(x.tg) === t; }); })[0]; }
  mount('fdv', function (el) {
    var list = (Fe.list('fdv') || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    /* typing the conclusion: never redraw under the finger */
    var ae = document.activeElement; if (ae && el.contains(ae) && ae.matches('textarea[data-fdvconcl]')) return;
    var r = fdvOpen && list.filter(function (x) { return x.id === fdvOpen; })[0];
    if (fdvOpen && !r && document.documentElement.classList.contains('unlocked') && list.length) fdvOpen = null;
    document.body.classList.toggle('fdv-full', !!r);
    if (r) { el.innerHTML = fullView(r); fillPhotos(el); return; }
    var body = list.length ? '<ul class="kit-list">' + list.map(function (r) {
      var f = r.findings || [], worst = worstOf(r);
      return '<li class="kit-item"><button type="button" class="kit-main" data-fdvopen="' + esc(r.id) + '"><span class="kit-ic" style="--c:' + (worst ? TG[worst][2] : '#0891b2') + '"><i class="bi bi-building-check"></i></span>' +
        '<span class="kit-x"><b>' + esc(r.building) + '</b><small>' + esc([r.no, fmt(r.date), r.address, f.length + ' finding' + (f.length === 1 ? '' : 's'), r.level ? 'NS 3424 ' + I18N.k('ui.level-n', 'level {n}', { n: r.level }) : ''].filter(Boolean).join(' · ')) + '</small></span>' +
        (worst ? '<span class="kit-r"><span class="tg-b" style="--c:' + TG[worst][2] + '">' + TG[worst][0] + '</span></span>' : '') + '<i class="bi bi-chevron-right fdv-go"></i></button></li>';
    }).join('') + '</ul>' : '<p class="empty kit-empty" data-t="ui.walk-a-building-note-each-finding-with-i">Walk a building, note each finding with its condition grade (TG) and a photo – and get a tidy summary you can send or paste into a report.</p>';
    el.innerHTML = card('fdv', 'building-check', I18N.k('ui.insp', 'Building inspection'), '<button type="button" class="text-btn" data-fdvnew><i class="bi bi-plus-lg"></i> <span data-t="ui.new">New</span></button>', body, 'lp-fdv');
  });
  function fillPhotos(el) { el.querySelectorAll('img[data-ph]').forEach(function (im) { getPhoto(im.dataset.ph).then(function (b) { if (b) im.src = URL.createObjectURL(b); else { var w = im.closest('.fdv-ph'); if (w) w.remove(); } }); });
    el.querySelectorAll('img[data-rph]').forEach(function (im) { getPhoto(im.dataset.rph).then(function (b) { if (!b) return im.closest('figure') ? im.closest('figure').remove() : im.remove(); var fr = new FileReader(); fr.onload = function () { im.src = fr.result; }; fr.readAsDataURL(b); }); }); }
  /* one inspection on its own page */
  function fullView(r) {
    var worst = worstOf(r), T = [['findings', I18N.k('ui.fdv-tab-findings', 'Findings'), 'clipboard-check'], ['building', I18N.k('ui.fdv-tab-building', 'Building'), 'building'], ['conclusion', I18N.k('ui.fdv-conclusion', 'Conclusion'), 'text-paragraph'], ['report', I18N.k('ui.fdv-tab-report', 'Report'), 'file-earmark-text']];
    if (!T.some(function (t) { return t[0] === fdvTab; })) fdvTab = 'findings';
    var head = '<div class="fdv-top"><button type="button" class="fdv-back" data-fdvback><i class="bi bi-chevron-left"></i> <span data-t="ui.insp">Building inspection</span></button>' +
      '<div class="fdv-title"><h2 data-noi18n>' + esc(r.building || '') + '</h2><small data-noi18n>' + esc([r.no, fmt(r.date), r.address].filter(Boolean).join(' · ')) + '</small></div>' +
      (worst ? '<span class="tg-b" style="--c:' + TG[worst][2] + '">' + TG[worst][0] + '</span>' : '') + '</div>' +
      '<nav class="fdv-tabs" role="tablist">' + T.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (t[0] === fdvTab) + '" data-fdvtab="' + t[0] + '"><i class="bi bi-' + t[2] + '"></i> ' + esc(t[1]) + '</button>'; }).join('') + '</nav>';
    var body = fdvTab === 'findings' ? fdvDetail(r) : fdvTab === 'building' ? buildingTab(r) : fdvTab === 'conclusion' ? conclusionTab(r) : reportTab(r);
    return '<section class="card kit-card fdv-page" id="fdv">' + head + '<div class="fdv-body">' + body + '</div></section>';
  }
  /* revisions (JP 2026-11-14): Rev. 01, 02 … with a date and what changed; the last one is the report's current revision */
  function revs(r) { return (Array.isArray(r.revs) ? r.revs : []).filter(function (v) { return v && v.n; }); }
  function nextRev(r) { var hi = revs(r).reduce(function (a, v) { return Math.max(a, parseInt(v.n, 10) || 0); }, 0); return (hi + 1 < 10 ? '0' : '') + (hi + 1); }
  function curRev(r) { var l = revs(r); return l.length ? l[l.length - 1] : null; }
  function kvTable(rows) { rows = rows.filter(function (q) { return q[1] !== '' && q[1] != null; }); return rows.length ? '<table class="fdv-kv">' + rows.map(function (q) { return '<tr><th>' + esc(q[0]) + '</th><td data-noi18n>' + esc(q[1]) + '</td></tr>'; }).join('') + '</table>' : ''; }
  function buildingTab(r) {
    var me = readJSON('dash.profile', {}) || {};
    var a = [[I18N.k('ui.fdv-no', 'Report no.'), r.no], [I18N.k('ui.client', 'Client'), r.client], [I18N.k('ui.address', 'Address'), r.address], [I18N.k('ui.date', 'Date'), r.date ? fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''], [I18N.k('ui.inspected-by', 'Inspected by'), [me.name, me.role].filter(Boolean).join(', ')], [I18N.k('ui.survey-level', 'Survey level (NS 3424)'), levelName(r.level || 1)], [I18N.k('ui.fdv-present', 'Present'), r.present], [I18N.k('ui.fdv-weather', 'Weather'), r.weather]];
    var b = [[I18N.k('ui.fdv-btype', 'Type of building'), btName(r.btype)], [I18N.k('ui.fdv-built', 'Year built'), r.built], [I18N.k('ui.fdv-renov', 'Last renovated'), r.renov], [I18N.k('ui.fdv-area', 'Usable area (BRA)'), r.area ? nf.format(+r.area) + ' m²' : ''], [I18N.k('ui.fdv-floors', 'Floors'), r.floors], [I18N.k('ui.fdv-structure', 'Load-bearing structure'), r.structure], [I18N.k('ui.fdv-found', 'Foundation'), r.found], [I18N.k('ui.fdv-roofc', 'Roof covering'), r.roofc], [I18N.k('ui.fdv-heat', 'Heating and ventilation'), r.heat], [I18N.k('ui.fdv-gnr', 'Gnr/bnr'), r.gnr], [I18N.k('ui.fdv-owner', 'Owner'), r.owner]];
    var t = [[I18N.k('ui.fdv-bnotes', 'About the building'), r.bnotes], [I18N.k('ui.fdv-purpose', 'Purpose and scope'), r.purpose], [I18N.k('ui.fdv-limits', 'Not examined'), r.limits], [I18N.k('ui.fdv-docs', 'Documents received'), r.docs], [I18N.k('ui.notes', 'Notes'), r.notes]].filter(function (q) { return q[1]; });
    var bt = kvTable(b);
    return '<h3 class="fdv-h">' + esc(I18N.k('ui.fdv-the-inspection', 'The inspection')) + '</h3>' + kvTable(a) +
      '<h3 class="fdv-h">' + esc(I18N.k('ui.fdv-the-building', 'The building')) + '</h3>' + (bt || '<p class="muted">' + esc(I18N.k('ui.fdv-no-building', 'Nothing about the building yet – add year built, area, structure and more with Edit.')) + '</p>') +
      t.map(function (q) { return '<h3 class="fdv-h">' + esc(q[0]) + '</h3><p class="fdv-txt" data-noi18n>' + esc(q[1]).replace(/\n/g, '<br>') + '</p>'; }).join('') +
      '<h3 class="fdv-h">' + esc(I18N.k('ui.fdv-revisions', 'Revisions')) + '</h3>' + (revs(r).length ? '<ul class="fdv-revs">' + revs(r).map(function (v) { return '<li><b>Rev. ' + esc(v.n) + '</b> <span class="muted">' + esc(fmt(v.date)) + '</span><span data-noi18n>' + esc(v.text || '') + '</span><button type="button" class="icon-btn sm" data-fdvrevdel="' + esc(r.id) + ':' + esc(v.id) + '" aria-label="Remove revision" data-t-aria-label="ui.fdv-rev-remove"><i class="bi bi-x"></i></button></li>'; }).join('') + '</ul>' : '<p class="muted fdv-chint">' + esc(I18N.k('ui.fdv-rev-help', 'When you send an updated report, add a revision – it shows on the cover and in the footer.')) + '</p>') +
      '<form class="fdv-revadd" data-fdvrevadd="' + esc(r.id) + '"><input name="text" maxlength="160" placeholder="' + esc(I18N.k('ui.fdv-rev-ph', 'What changed, e.g. Added findings after the second visit')) + '" required><button type="submit" class="text-btn"><i class="bi bi-plus-lg"></i> ' + esc(I18N.k('ui.fdv-rev-add', 'Add Rev. {n}', { n: nextRev(r) })) + '</button></form>' +
      '<div class="fdv-acts"><button type="button" class="pill-btn" data-fdvedit="' + esc(r.id) + '"><i class="bi bi-pencil"></i> <span data-t="ui.edit">Edit</span></button></div>';
  }
  function conclusionTab(r) {
    var f = r.findings || [], c = function (t) { return f.filter(function (x) { return String(x.tg) === t; }).length; }, cost = f.reduce(function (a, x) { return a + (+x.cost || 0); }, 0);
    return '<p class="muted fdv-chint">' + esc(I18N.k('ui.fdv-concl-help', 'Your overall assessment – the state of the building and what matters most. It opens section 2 of the report.')) + '</p>' +
      '<textarea class="fdv-concl" data-fdvconcl="' + esc(r.id) + '" rows="9" maxlength="6000" placeholder="' + esc(I18N.k('ui.fdv-conclusion-ph', 'Your overall assessment – the state of the building and what matters most')) + '">' + esc(r.conclusion || '') + '</textarea>' +
      '<p class="fdv-csum">' + ['3', '2', '1', '0', 'iu'].map(function (t) { return '<span class="tg-b" style="--c:' + TG[t][2] + '">' + TG[t][0] + '</span> ' + c(t); }).join(' &nbsp; ') + (cost ? ' &nbsp;·&nbsp; ' + esc(I18N.k('ui.total-cost-estimate', 'Total cost estimate')) + ': <b>' + nf.format(cost) + ' kr</b>' : '') + '</p>';
  }
  function reportTab(r) {
    return '<div class="fdv-rbar"><label class="rp-opt"><input type="checkbox" data-rpphotos' + (RP.photos ? ' checked' : '') + '> <span data-t="ui.photos">Photos</span></label><span class="spacer"></span>' +
      '<button type="button" class="pill-btn" data-fdvmkpdf="' + esc(r.id) + '"><i class="bi bi-file-earmark-pdf"></i> <span>' + esc(I18N.k('ui.fdv-make-pdf', 'Make PDF')) + '</span></button></div>' +
      '<p class="fdv-pdfnote muted" hidden></p><article class="rp-doc rp-inline">' + report(r) + '</article>';
  }
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
  function BTYPES() { return [['', I18N.k('ui.fdv-btype-none', '– Not set –')], ['house', I18N.k('ui.fdv-bt-house', 'Detached house')], ['semi', I18N.k('ui.fdv-bt-semi', 'Semi-detached or terraced house')], ['flat', I18N.k('ui.fdv-bt-flat', 'Apartment building')], ['cabin', I18N.k('ui.fdv-bt-cabin', 'Cabin or holiday home')],
    ['office', I18N.k('ui.fdv-bt-office', 'Office or commercial')], ['school', I18N.k('ui.fdv-bt-school', 'School or kindergarten')], ['care', I18N.k('ui.fdv-bt-care', 'Health or care building')], ['industry', I18N.k('ui.fdv-bt-industry', 'Industry or warehouse')], ['other', I18N.k('ui.fdv-bt-other', 'Other')]]; }
  /* the next report number: this year's highest + 1, as 2026-001 */
  function nextNo() { var y = String(new Date().getFullYear()), hi = 0; (Fe.list('fdv') || []).forEach(function (r) { var m = String(r.no || '').match(/^(\d{4})-(\d+)$/); if (m && m[1] === y) hi = Math.max(hi, +m[2]); }); return y + '-' + String(hi + 1).padStart(3, '0'); }
  function btName(k) { var q = BTYPES().filter(function (x) { return x[0] === k; })[0]; return q && k ? q[1] : ''; }
  var FDV_FIELDS = { key: 'fdv', addTitle: 'New inspection', editTitle: 'Edit inspection', fields: [
    { k: 'building', type: 'title', label: 'Building', ph: 'Building or property, e.g. Storgata 12', req: true },
    { k: 'no', label: I18N.k('ui.fdv-no', 'Report no.'), grp: 'ins', head: I18N.k('ui.fdv-the-inspection', 'The inspection'), def: function () { return nextNo(); }, help: I18N.k('ui.fdv-no-help', 'Given by itself as year-number (2026-001, 2026-002 …); change it to follow your company’s series.') },
    { k: 'address', label: 'Address', ph: 'Street, town', grp: 'ins' }, { k: 'date', label: 'Date', type: 'date', req: true, grp: 'ins', def: function () { return dkey(new Date()); } },
    { k: 'client', label: 'Client', ph: 'Who it’s for', grp: 'ins' }, { k: 'level', label: I18N.k('ui.survey-level', 'Survey level (NS 3424)'), type: 'select', grp: 'ins', def: '1', options: function () { return [['1', levelName(1)], ['2', levelName(2)], ['3', levelName(3)]]; } },
    { k: 'present', label: I18N.k('ui.fdv-present', 'Present'), ph: I18N.k('ui.fdv-present-ph', 'Who was there'), grp: 'ins' }, { k: 'weather', label: I18N.k('ui.fdv-weather', 'Weather'), ph: I18N.k('ui.fdv-weather-ph', 'E.g. dry, 4 °C'), grp: 'ins' },
    /* about the building (JP 2026-11-13) */
    { k: 'btype', label: I18N.k('ui.fdv-btype', 'Type of building'), type: 'select', grp: 'bld', head: I18N.k('ui.fdv-the-building', 'The building'), def: '', options: function () { return BTYPES(); } },
    { k: 'built', label: I18N.k('ui.fdv-built', 'Year built'), type: 'number', ph: '1985', grp: 'bld' }, { k: 'renov', label: I18N.k('ui.fdv-renov', 'Last renovated'), ph: I18N.k('ui.fdv-renov-ph', 'E.g. 2015, bathroom'), grp: 'bld' },
    { k: 'area', label: I18N.k('ui.fdv-area', 'Usable area (BRA)'), type: 'number', suffix: 'm²', grp: 'bld' }, { k: 'floors', label: I18N.k('ui.fdv-floors', 'Floors'), ph: I18N.k('ui.fdv-floors-ph', 'E.g. 2 + basement'), grp: 'bld' },
    { k: 'structure', label: I18N.k('ui.fdv-structure', 'Load-bearing structure'), ph: I18N.k('ui.fdv-structure-ph', 'E.g. timber frame, concrete'), grp: 'bld' }, { k: 'found', label: I18N.k('ui.fdv-found', 'Foundation'), ph: I18N.k('ui.fdv-found-ph', 'E.g. concrete slab, crawl space'), grp: 'bld' },
    { k: 'roofc', label: I18N.k('ui.fdv-roofc', 'Roof covering'), ph: I18N.k('ui.fdv-roofc-ph', 'E.g. concrete tiles'), grp: 'bld' }, { k: 'heat', label: I18N.k('ui.fdv-heat', 'Heating and ventilation'), ph: I18N.k('ui.fdv-heat-ph', 'E.g. heat pump, balanced ventilation'), grp: 'bld' },
    { k: 'gnr', label: I18N.k('ui.fdv-gnr', 'Gnr/bnr'), ph: '12/345', grp: 'bld' }, { k: 'owner', label: I18N.k('ui.fdv-owner', 'Owner'), grp: 'bld' },
    { k: 'bnotes', label: I18N.k('ui.fdv-bnotes', 'About the building'), type: 'textarea', rows: 2, ph: I18N.k('ui.fdv-bnotes-ph', 'Anything else worth knowing – extensions, known damage, earlier work') },
    { k: 'purpose', label: I18N.k('ui.fdv-purpose', 'Purpose and scope'), type: 'textarea', rows: 2, ph: I18N.k('ui.fdv-purpose-ph', 'Why the survey is done and what it covers') },
    { k: 'limits', label: I18N.k('ui.fdv-limits', 'Not examined'), type: 'textarea', rows: 2, ph: I18N.k('ui.fdv-limits-ph', 'Rooms or parts you couldn’t reach, and why') },
    { k: 'docs', label: I18N.k('ui.fdv-docs', 'Documents received'), type: 'textarea', rows: 2, ph: I18N.k('ui.fdv-docs-ph', 'Drawings, FDV documentation, earlier reports …') },
    { k: 'conclusion', label: I18N.k('ui.fdv-conclusion', 'Conclusion'), type: 'textarea', rows: 4, ph: I18N.k('ui.fdv-conclusion-ph', 'Your overall assessment – the state of the building and what matters most') },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 3 }],
    beforeSave: function (it) { it.findings = it.findings || []; }, afterSave: function (it, isNew) { if (isNew) setTimeout(function () { openInsp(it.id, 'building'); }, 0); },
    onDelete: function (it) { (it.findings || []).forEach(function (x) { if (x.photo) delPhoto(x.photo); }); } };
  function saveFdv(id, fn) { var t = Fe.tools(); (t.fdv || []).forEach(function (r) { if (r.id === id) fn(r); }); Fe.saveTools(t); }
  document.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-fdvnew]') && K) return K.edit(FDV_FIELDS, null);
    if ((b = e.target.closest('[data-fdvedit]')) && K) return K.edit(FDV_FIELDS, Fe.list('fdv').filter(function (x) { return x.id === b.dataset.fdvedit; })[0]);
    if ((b = e.target.closest('[data-fdvfedit]'))) { fdvEdit = fdvEdit === b.dataset.fdvfedit ? null : b.dataset.fdvfedit; drawAll(); setTimeout(function () { var fm = document.querySelector('form.fdv-add.editing'); if (fm) { fm.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 80); return; }
    if (e.target.closest('[data-fdvfcancel]')) { fdvEdit = null; drawAll(); return; }
    if ((b = e.target.closest('[data-fdvopen]'))) { openInsp(b.dataset.fdvopen); return; }
    if (e.target.closest('[data-fdvback]')) { closeInsp(); return; }
    if ((b = e.target.closest('[data-fdvtab]'))) { setTab(b.dataset.fdvtab); fdvEdit = null; drawAll(); return; }
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
  /* findings per building part: one quiet bar each (the total), the grades as text after it */
  function chartParts(f) {
    var rows = [], seen = {};
    f.forEach(function (x) { var k = x.code ? x.code.slice(0, 2) : ''; if (!seen[k]) { seen[k] = { k: k, n: {} }; rows.push(seen[k]); } seen[k].n[x.tg] = (seen[k].n[x.tg] || 0) + 1; });
    if (rows.length < 2) return '';   /* one bar tells nothing the grade table doesn't */
    var tot = function (r) { return TGO.reduce(function (a, t) { return a + (r.n[t] || 0); }, 0); }, max = Math.max.apply(null, rows.map(tot));
    /* plain HTML rows (they reflow on a phone and print sharp): name, a quiet bar for the total, the count, the grades as text */
    return '<figure class="rp-chart rp-bars"><figcaption>' + esc(I18N.k('ui.fdv-chart-parts', 'Findings per building part')) + '</figcaption>' + rows.map(function (r) { var n = tot(r);
      return '<div class="rp-bar1"><span class="rp-bl">' + esc(r.k ? nsLabel(r.k) : I18N.k('ui.ns-no-code', '– No code –')) + '</span><span class="rp-bt"><i style="width:' + Math.max(3, Math.round(n / max * 100)) + '%"></i></span><b>' + n + '</b><small>' + esc(TGO.filter(function (t) { return r.n[t]; }).map(function (t) { return TG[t][0] + ': ' + r.n[t]; }).join(' · ')) + '</small></div>'; }).join('') + '</figure>';
  }
  function chartKey() { return '<p class="rp-key">' + TGO.map(function (t) { return '<span><i style="background:' + TG[t][2] + '"></i>' + TG[t][0] + '</span>'; }).join('') + '</p>'; }
  /* condition × consequence as a plain table of counts; the cells of the high and medium priority give a faint tint */
  function chartMatrix(f) {
    var xs = f.filter(function (x) { return x.kg != null && x.kg !== '' && x.tg !== 'iu'; }); if (!xs.length) return '';
    var tint = { 3: '#f6e3e3', 2: '#f7efdf', 1: '#f3f5f8', 0: '#fff' }, rows = '';
    for (var k = 3; k >= 0; k--) { rows += '<tr><th>KG ' + k + '</th>'; for (var t = 0; t <= 3; t++) { var n = xs.filter(function (x) { return +x.tg === t && +x.kg === k; }).length, pr = prio({ tg: String(t), kg: String(k) }); rows += '<td class="n" style="background:' + tint[pr] + '">' + (n || '') + '</td>'; } rows += '</tr>'; }
    return '<figure class="rp-chart rp-mx"><figcaption>' + esc(I18N.k('ui.fdv-chart-matrix', 'Condition × consequence')) + '</figcaption><table class="rp-mxt"><thead><tr><th></th><th class="n">TG 0</th><th class="n">TG 1</th><th class="n">TG 2</th><th class="n">TG 3</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="rp-key"><span><i style="background:' + tint[3] + '"></i>' + esc(prioName(3)) + '</span><span><i style="background:' + tint[2] + '"></i>' + esc(prioName(2)) + '</span></p></figure>';
  }
  /* the cost summary in the conclusion: a sentence, then the totals by when, by priority and by main group */
  function costSummary(f, cost) {
    var withC = f.filter(function (x) { return +x.cost > 0; }), noC = f.filter(function (x) { return (x.tg === '2' || x.tg === '3') && !(+x.cost > 0); }).length;
    if (!cost) return noC ? '<p class="rp-small">' + esc(I18N.k('ui.fdv-no-costs', 'No cost estimates yet – {n} findings with TG 2–3 have none.', { n: noC })) + '</p>' : '';
    var kr = function (n) { return nf.format(Math.round(n)) + ' kr'; }, sum = function (fn) { return withC.filter(fn).reduce(function (a, x) { return a + +x.cost; }, 0); };
    var soon = sum(function (x) { return x.when === 'now' || x.when === 'y1'; }), hi = sum(function (x) { return prio(x) === 3; });
    var row = function (lab, v) { return v ? '<tr><td>' + esc(lab) + '</td><td class="n">' + kr(v) + '</td><td class="n">' + Math.round(v / cost * 100) + ' %</td></tr>' : ''; };
    var when = [['now', 'now'], ['y1', 'y1'], ['y5', 'y5'], ['y10', 'y10']].map(function (q) { return row(whenName(q[0]), sum(function (x) { return x.when === q[0]; })); }).join('') + row(I18N.k('ui.fdv-when-unset', 'Not set'), sum(function (x) { return !x.when; }));
    var pri = [3, 2, 1, 0].map(function (p) { return row(prioName(p), sum(function (x) { return prio(x) === p; })); }).join('') + row(I18N.k('ui.fdv-prio-unset', 'No KG set'), sum(function (x) { return prio(x) == null; }));
    var grp = NS.filter(function (q) { return q[0].length === 1; }).map(function (q) { return row(q[0] + ' ' + nsName(q[0]), sum(function (x) { return (x.code || '')[0] === q[0]; })); }).join('') + row(I18N.k('ui.ns-no-code', '– No code –'), sum(function (x) { return !x.code; }));
    var head = function (t) { return '<table class="rp-ctab"><thead><tr><th>' + esc(t) + '</th><th class="n">kr</th><th class="n">%</th></tr></thead><tbody>'; };
    return '<h3>' + esc(I18N.k('ui.fdv-cost-summary', 'Cost summary')) + '</h3><p class="rp-p">' + esc([I18N.k('ui.fdv-cost-l1', 'Estimated cost of the measures: {t} in total.', { t: kr(cost) }), soon ? I18N.k('ui.fdv-cost-l2', '{s} of it now or within a year.', { s: kr(soon) }) : '', hi ? I18N.k('ui.fdv-cost-l3', '{h} for high-priority findings.', { h: kr(hi) }) : '', withC.length === 1 ? I18N.k('ui.fdv-cost-l4a', 'One finding carries an estimate.') : I18N.k('ui.fdv-cost-l4', '{n} findings carry an estimate.', { n: withC.length })].filter(Boolean).join(' '))   /* no "0 kr now" parts */ +
      (noC ? ' ' + esc(I18N.k('ui.fdv-cost-missing', '{n} findings with TG 2–3 have no estimate yet.', { n: noC })) : '') + '</p>' +
      (function () { var n = function (h) { return (h.match(/<tr>/g) || []).length; }, t = [[I18N.k('ui.when', 'When'), when], [I18N.k('ui.priority', 'Priority'), pri], [I18N.k('ui.building-part-ns-3451', 'Building part (NS 3451)'), grp]].filter(function (q) { return n(q[1]) >= 2; });   /* a table with one row says nothing the sentence doesn't */
        return t.length ? '<div class="rp-ctabs">' + t.map(function (q) { return head(q[0]) + q[1] + '</tbody></table>'; }).join('') : '<div>'; })() + '</div>' +
      '<p class="rp-cost">' + esc(I18N.k('ui.total-cost-estimate', 'Total cost estimate')) + ': <b>' + kr(cost) + '</b></p><p class="rp-small">' + esc(I18N.k('ui.fdv-cost-note', 'Estimates are rough and meant for planning; get prices before ordering work.')) + '</p>';
  }
  /* the report after NS 3424's order: 1 the assignment, 2 the conclusion, 3 the main report (by NS 3451 code), 4 appendices (photos, grades) */
  /* the report's own, muted colours (JP 2026-11-14: the bright app colours looked childish on paper) – the app keeps its own */
  var RC = { 3: '#8f2d2d', 2: '#9a6418', 1: '#3d5a80', 0: '#4a7356', iu: '#6b7280' }, RP_PRIO = { 3: '#8f2d2d', 2: '#9a6418', 1: '#3d5a80', 0: '#4a7356' };
  function report(r) {
    var f = (r.findings || []).slice().sort(byCode), me = readJSON('dash.profile', {}) || {}, L = function (k, en) { return esc(I18N.k(k, en)); };
    var by = function (t) { return f.filter(function (x) { return String(x.tg) === t; }); };
    var worst = ['3', '2', '1', '0'].filter(function (t) { return by(t).length; })[0];
    var tgb = function (t) { return '<span class="rp-tg" style="--c:' + RC[t] + '">' + TG[t][0] + '</span>'; };
    var kgb = function (x) { return x.kg != null && x.kg !== '' && KG[x.kg] ? '<span class="rp-tg rp-kg" style="--c:' + RC[x.kg] + '">' + KG[x.kg][0] + '</span>' : ''; };
    var prb = function (x) { var p = prio(x); return p == null ? '–' : '<span class="rp-pr" style="--c:' + RP_PRIO[p] + '">' + esc(prioName(p)) + '</span>'; };
    var todo = f.filter(function (x) { return x.tg === '3' || x.tg === '2'; }).sort(function (a, b) { var pa = prio(a), pb = prio(b); pa = pa == null ? -1 : pa; pb = pb == null ? -1 : pb; return pb - pa || (String(b.tg) > String(a.tg) ? 1 : String(b.tg) < String(a.tg) ? -1 : byCode(a, b)); });
    var cost = f.reduce(function (a, x) { return a + (+x.cost || 0); }, 0), dt = esc(fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' }));
    var nl = function (t) { return esc(t).replace(/\n/g, '<br>'); }, n4 = 0, nx = function () { return '4.' + (++n4) + ' '; }, n1 = 1, n1x = function () { return '1.' + (++n1) + ' '; };
    /* photos are numbered in the order they appear in the main report and shown in appendix 4.1 */
    var fno = {}; f.forEach(function (x, i) { fno[x.id] = i + 1; });   /* findings numbered in the order of the main report */
    var ph = [], phn = {}; if (RP.photos) f.forEach(function (x) { if (x.photo) { ph.push(x); phn[x.id] = ph.length; } });
    var mains = NS.filter(function (q) { return q[0].length === 1; }).map(function (q) { return q[0]; }).concat(['']);
    var grid = mains.map(function (m) { var xs = f.filter(function (x) { return (x.code || '').slice(0, 1) === m; }); return xs.length ? '<tr><td>' + esc(m ? m + ' ' + nsName(m) : I18N.k('ui.ns-no-code', '– No code –')) + '</td>' + ['3', '2', '1', '0', 'iu'].map(function (t) { var n = xs.filter(function (x) { return String(x.tg) === t; }).length; return '<td class="n">' + (n || '') + '</td>'; }).join('') + '</tr>' : ''; }).join('');
    var secs = [], seen = {};
    f.forEach(function (x) { var k = x.code ? x.code.slice(0, 2) : ''; if (!seen[k]) { seen[k] = 1; secs.push(k); } });
    /* 1 – the assignment */
    var who = [me.name, me.role].filter(Boolean).join(', ');
    var a1 = [[L('ui.fdv-no', 'Report no.'), r.no], [L('ui.client', 'Client'), r.client], [L('ui.address', 'Address'), r.address], [L('ui.date', 'Date'), dt ? fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''], [L('ui.inspected-by', 'Inspected by'), [who, me.employer].filter(Boolean).join(' · ')],
      [L('ui.survey-level', 'Survey level (NS 3424)'), levelName(r.level || 1)], [L('ui.fdv-present', 'Present'), r.present], [L('ui.fdv-weather', 'Weather'), r.weather]].filter(function (q) { return q[1]; });
    var b1 = [[L('ui.fdv-btype', 'Type of building'), btName(r.btype)], [L('ui.fdv-built', 'Year built'), r.built], [L('ui.fdv-renov', 'Last renovated'), r.renov], [L('ui.fdv-area', 'Usable area (BRA)'), r.area ? nf.format(+r.area) + ' m²' : ''], [L('ui.fdv-floors', 'Floors'), r.floors],
      [L('ui.fdv-structure', 'Load-bearing structure'), r.structure], [L('ui.fdv-found', 'Foundation'), r.found], [L('ui.fdv-roofc', 'Roof covering'), r.roofc], [L('ui.fdv-heat', 'Heating and ventilation'), r.heat], [L('ui.fdv-gnr', 'Gnr/bnr'), r.gnr], [L('ui.fdv-owner', 'Owner'), r.owner]].filter(function (q) { return q[1] !== '' && q[1] != null; });
    var h = '<div class="rp-cover"><header class="rp-head"><div><p class="rp-kick">' + L('ui.fdv-condition-report', 'Condition survey report') + (r.no ? ' · ' + esc(I18N.k('ui.fdv-report-no', 'Report no. {n}', { n: r.no })) : '') + (curRev(r) ? ' · Rev. ' + esc(curRev(r).n) : '') + '</p><h1>' + esc(r.building || 'Inspection') + '</h1>' +
      (r.address ? '<p class="rp-addr">' + esc(r.address) + '</p>' : '') + '</div>' +
      (worst ? '<div class="rp-worst" style="--c:' + RC[worst] + '"><small data-t="ui.worst-grade">Worst grade</small><b>' + TG[worst][0] + '</b></div>' : '') + '</header>' +
      '<table class="rp-cvt">' + [[L('ui.client', 'Client'), r.client], [L('ui.date', 'Date'), dt ? fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''], [L('ui.fdv-no', 'Report no.'), r.no], [L('ui.fdv-revision', 'Revision'), curRev(r) ? 'Rev. ' + curRev(r).n + ' – ' + fmt(curRev(r).date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''], [L('ui.inspected-by', 'Inspected by'), who], [L('ui.company', 'Company'), me.employer], [L('ui.survey-level', 'Survey level (NS 3424)'), levelName(r.level || 1)]].filter(function (q) { return q[1]; }).map(function (q) { return '<tr><th>' + q[0] + '</th><td data-noi18n>' + esc(q[1]) + '</td></tr>'; }).join('') + '</table>' +
      '<p class="rp-std">' + L('ui.fdv-std-line', 'Building parts after NS 3451, condition and consequence grades after NS 3424.') + '</p>' +
      (revs(r).length ? '<h2 class="rp-toch">' + L('ui.fdv-revisions', 'Revisions') + '</h2><table class="rp-grid rp-revt"><thead><tr><th>Rev.</th><th>' + L('ui.date', 'Date') + '</th><th>' + L('ui.fdv-rev-change', 'What changed') + '</th></tr></thead><tbody>' + revs(r).map(function (v) { return '<tr><td>' + esc(v.n) + '</td><td>' + esc(fmt(v.date, { day: 'numeric', month: 'short', year: 'numeric' })) + '</td><td data-noi18n>' + esc(v.text || '') + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
      '<h2 class="rp-toch">' + L('ui.fdv-contents', 'Contents') + '</h2><ol class="rp-toc"><li>' + L('ui.fdv-s1', 'Assignment') + '</li><li>' + L('ui.fdv-s2', 'Conclusion') + '</li><li>' + L('ui.fdv-s3', 'Main report') + '</li><li>' + L('ui.fdv-s4', 'Appendices') + '</li></ol></div>' +
      '<section class="rp-sec"><h2>1 ' + L('ui.fdv-s1', 'Assignment') + '</h2><h3>1.1 ' + L('ui.fdv-the-inspection', 'The inspection') + '</h3><table class="rp-meta rp-kv">' + a1.map(function (q) { return '<tr><th>' + q[0] + '</th><td data-noi18n>' + esc(q[1]) + '</td></tr>'; }).join('') + '</table>' +
        (b1.length || r.bnotes ? '<h3>' + n1x() + L('ui.fdv-the-building', 'The building') + '</h3>' + (b1.length ? '<table class="rp-meta rp-kv">' + b1.map(function (q) { return '<tr><th>' + q[0] + '</th><td data-noi18n>' + esc(q[1]) + '</td></tr>'; }).join('') + '</table>' : '') + (r.bnotes ? '<p class="rp-p" data-noi18n>' + nl(r.bnotes) + '</p>' : '') : '') +
        [['ui.fdv-purpose', 'Purpose and scope', r.purpose], ['ui.fdv-background', 'Background', r.intro], ['ui.fdv-limits', 'Not examined', r.limits], ['ui.fdv-docs', 'Documents received', r.docs]].filter(function (q) { return q[2]; }).map(function (q) { return '<h3>' + n1x() + L(q[0], q[1]) + '</h3><p class="rp-p" data-noi18n>' + nl(q[2]) + '</p>'; }).join('') +
        '<h3>' + n1x() + L('ui.condition-grades', 'Condition grades') + '</h3><p class="rp-p">' + L('ui.fdv-grades-intro', 'Each finding is given a condition grade (TG) for what was seen, and a consequence grade (KG) for what it can lead to, after NS 3424.') + '</p><table class="rp-legend">' + ['0', '1', '2', '3', 'iu'].map(function (t) {
          return '<tr><td>' + tgb(t) + '</td><td>' + esc({ 0: I18N.k('ui.tg0-long', 'No symptoms – no signs of wear or damage.'), 1: I18N.k('ui.tg1-long', 'Small symptoms – normal wear, some maintenance may be needed.'), 2: I18N.k('ui.tg2-long', 'Medium symptoms – clear wear or damage, should be followed up.'), 3: I18N.k('ui.tg3-long', 'Large symptoms – serious damage or risk, needs action.'), iu: I18N.k('ui.tgiu-long', 'Not examined (no access).') }[t]) + '</td></tr>';
        }).join('') + '</table>' +
        '<h3>' + n1x() + L('ui.consequence-grades', 'Consequence grades') + '</h3><table class="rp-legend">' + ['0', '1', '2', '3'].map(function (k) {
          return '<tr><td>' + kgb({ kg: k }) + '</td><td>' + esc({ 0: I18N.k('ui.kg0-long', 'No consequences.'), 1: I18N.k('ui.kg1-long', 'Small consequences.'), 2: I18N.k('ui.kg2-long', 'Medium consequences.'), 3: I18N.k('ui.kg3-long', 'Large consequences – for safety, health, the environment, function or cost.') }[k]) + '</td></tr>';
        }).join('') + '</table><p class="rp-small">' + L('ui.prio-explained', 'Priority is worked out from TG × KG: 6 or more high, 3–5 medium, 1–2 low.') + '</p>' + '</section>' +
      /* 2 – the conclusion */
      '<section class="rp-sec"><h2>2 ' + L('ui.fdv-s2', 'Conclusion') + '</h2>' +
        (r.conclusion ? '<p class="rp-p rp-concl" data-noi18n>' + nl(r.conclusion) + '</p>' : '<p class="rp-p rp-muted">' + L('ui.fdv-no-conclusion', 'No conclusion written yet – add it with Conclusion above or in the inspection.') + '</p>') +
        '<h3>' + L('ui.fdv-findings-by-grade', 'Findings by condition grade') + '</h3><table class="rp-tgt"><thead><tr>' + ['3', '2', '1', '0', 'iu'].map(function (t) { return '<th>' + tgb(t) + '</th>'; }).join('') + '<th>' + L('ui.fdv-total', 'Total') + '</th></tr></thead><tbody><tr>' +
          ['3', '2', '1', '0', 'iu'].map(function (t) { return '<td><b>' + by(t).length + '</b><small>' + esc(tgName(t)) + '</small></td>'; }).join('') + '<td><b>' + f.length + '</b><small>' + L('ui.fdv-findings', 'findings') + '</small></td></tr></tbody></table>' +
        chartParts(f) + chartMatrix(f) +
        (todo.length ? '<h3 data-t="ui.what-should-be-done">What should be done</h3><table class="rp-todo"><thead><tr><th>' + L('ui.fdv-nr', 'No.') + '</th><th data-t="ui.grade">Grade</th><th>' + L('ui.priority', 'Priority') + '</th><th data-t="ui.building-part">Building part</th><th data-t="ui.finding">Finding</th><th data-t="ui.action-2">Action</th><th>' + L('ui.when', 'When') + '</th></tr></thead><tbody>' + todo.map(function (x) {
          return '<tr><td class="rp-no">' + fno[x.id] + '</td><td class="rp-grs">' + tgb(x.tg) + kgb(x) + '</td><td>' + prb(x) + '</td><td data-noi18n>' + esc(partLabel(x)) + '</td><td data-noi18n>' + esc(x.text) + '</td><td data-noi18n>' + esc(x.action || '–') + (x.cost ? '<br><small>' + nf.format(+x.cost) + ' kr</small>' : '') + '</td><td>' + esc(whenName(x.when) || '–') + '</td></tr>';
        }).join('') + '</tbody></table>' : '') +
        costSummary(f, cost) + '</section>' +
      /* 3 – the main report: one sub-section per two-digit code */
      '<section class="rp-sec rp-newpage"><h2>3 ' + L('ui.fdv-s3', 'Main report') + '</h2><p class="rp-small">' + L('ui.findings-by-ns-3451', 'Findings by building part (NS 3451)') + '</p>' + (secs.length ? secs.map(function (k, si) {
        return '<section class="rp-part"><h3>3.' + (si + 1) + ' ' + esc(k ? nsLabel(k) : I18N.k('ui.ns-no-code', '– No code –')) + '</h3>' + f.filter(function (x) { return (x.code ? x.code.slice(0, 2) : '') === k; }).map(function (x) {
          var sub = [x.code && x.code.length > 2 ? nsLabel(x.code) : '', x.part].filter(Boolean).join(' · ');
          var mt = [x.kt ? I18N.k('ui.consequence-for', 'Consequence for') + ': ' + ktName(x.kt) : '', x.when ? I18N.k('ui.when', 'When') + ': ' + whenName(x.when) : '', x.cost ? nf.format(+x.cost) + ' kr' : ''].filter(Boolean).join(' · ');
          return '<div class="rp-f"><div class="rp-gr"><span class="rp-no">' + esc(I18N.k('ui.fdv-finding-n', 'Finding {n}', { n: fno[x.id] })) + '</span><span class="rp-grs">' + tgb(x.tg) + kgb(x) + '</span>' + (prio(x) != null ? prb(x) : '') + '</div><div class="rp-ft" data-noi18n>' + (sub ? '<p class="rp-where">' + esc(sub) + '</p>' : '') + '<p>' + esc(x.text) + '</p>' +
            (x.cause ? '<p class="rp-act">' + L('ui.cause', 'Cause') + ': ' + esc(x.cause) + '</p>' : '') + (x.action ? '<p class="rp-act">' + L('ui.action-2', 'Action') + ': ' + esc(x.action) + '</p>' : '') + (mt ? '<p class="rp-act">' + esc(mt) + '</p>' : '') +
            (phn[x.id] ? '<p class="rp-act rp-phref">' + esc(I18N.k('ui.fdv-see-photo', 'See photo {n}', { n: phn[x.id] })) + '</p>' : '') + '</div></div>';
        }).join('') + '</section>';
      }).join('') : '<p data-t="ui.no-findings-were-recorded">No findings were recorded.</p>') +
        (r.notes ? '<section class="rp-part"><h3>3.' + (secs.length + 1) + ' ' + L('ui.notes', 'Notes') + '</h3><p class="rp-notes" data-noi18n>' + nl(r.notes) + '</p></section>' : '') + '</section>' +
      /* 4 – appendices */
      '<section class="rp-sec rp-newpage"><h2>4 ' + L('ui.fdv-s4', 'Appendices') + '</h2>' +
        (ph.length ? '<h3>' + nx() + L('ui.photos', 'Photos') + '</h3><div class="rp-phs">' + ph.map(function (x, i) { return '<figure class="rp-fig"><img class="rp-ph" data-rph="' + esc(x.photo) + '" alt=""><figcaption data-noi18n><b>' + esc(I18N.k('ui.fdv-photo-n', 'Photo {n}', { n: i + 1 })) + '</b> · ' + esc(I18N.k('ui.fdv-finding-n', 'Finding {n}', { n: fno[x.id] })) + ' · ' + TG[x.tg][0] + ' · ' + esc(partLabel(x)) + ' – ' + esc(x.text) + '</figcaption></figure>'; }).join('') + '</div>' : '') +
        ((grid.match(/<tr>/g) || []).length >= 3 ? '<h3>' + nx() + L('ui.fdv-grade-table', 'Grades per main group (table)') + '</h3><table class="rp-grid"><thead><tr><th>' + L('ui.building-part-ns-3451', 'Building part (NS 3451)') + '</th>' + ['3', '2', '1', '0', 'iu'].map(function (t) { return '<th class="n">' + TG[t][0] + '</th>'; }).join('') + '</tr></thead><tbody>' + grid + '</tbody></table>' : '') +
        '</section>' +
      '<footer class="rp-foot" data-noi18n>' + [esc([me.name, me.role].filter(Boolean).join(', ')), esc(me.employer || ''), r.no ? esc(I18N.k('ui.fdv-report-no', 'Report no. {n}', { n: r.no })) : '', esc(r.building || ''), dt, esc(me.email || ''), esc(me.phone || '')].filter(Boolean).join(' · ') + '</footer>';
    return h;
  }
  /* the report tab: Photos on/off, the conclusion is typed in its own tab */
  document.addEventListener('change', function (e) { if (e.target.matches('[data-rpphotos]') && e.target.closest('.fdv-page')) { RP.photos = e.target.checked; drawAll(); } });
  document.addEventListener('input', function (e) {
    var ta = e.target.closest('textarea[data-fdvconcl]'); if (!ta) return;
    clearTimeout(ta._t); ta._t = setTimeout(function () { var v = ta.value.trim(); saveFdv(ta.dataset.fdvconcl, function (x) { x.conclusion = v; }); }, 500);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-fdvrevadd]'); if (!f) return; e.preventDefault();
    var t = f.text.value.trim(); if (!t) return;
    saveFdv(f.dataset.fdvrevadd, function (x) { x.revs = revs(x).concat([{ id: uid(), n: nextRev(x), date: dkey(new Date()), text: t.slice(0, 160) }]); });
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fdvrevdel]'); if (!b) return;
    var q = b.dataset.fdvrevdel.split(':'), gone = null;
    saveFdv(q[0], function (x) { x.revs = revs(x).filter(function (v) { if (v.id === q[1]) { gone = v; return false; } return true; }); });
    toast('<i class="bi bi-trash3"></i> ' + esc(I18N.k('ui.fdv-rev-removed', 'Revision removed')), function () { saveFdv(q[0], function (x) { x.revs = revs(x).concat([gone]).sort(function (a, c) { return (parseInt(a.n, 10) || 0) - (parseInt(c.n, 10) || 0); }); }); });
  });
  document.addEventListener('focusout', function (e) { if (e.target.matches && e.target.matches('textarea[data-fdvconcl]')) setTimeout(drawAll, 600); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fdvpdf]'); if (b) { openInsp(b.dataset.fdvpdf, 'report'); return; }
    b = e.target.closest('[data-fdvmkpdf]'); if (!b) return;
    if (b._pdf) { sharePdf(b._pdf); return; }   /* made already: a fresh tap shares it (the phone wants a tap of its own for the share sheet) */
    var r = Fe.list('fdv').filter(function (x) { return x.id === b.dataset.fdvmkpdf; })[0]; if (!r || b.disabled) return;
    var note = document.querySelector('.fdv-pdfnote'), lbl = b.querySelector('span');
    b.disabled = true; lbl.textContent = I18N.k('ui.fdv-making-pdf', 'Making the PDF …');
    makePdf(r).then(function (file) {
      b.disabled = false; b._pdf = file; lbl.textContent = I18N.k('ui.fdv-share-pdf', 'Share or save the PDF'); b.querySelector('i').className = 'bi bi-box-arrow-up';
      if (note) { note.hidden = false; note.textContent = I18N.k('ui.fdv-pdf-ready', 'Ready: {f} ({n} pages). Tap the button to share it, save it to Files or mail it.', { f: file.name, n: file._pages }); }
      if (!(navigator.canShare && navigator.canShare({ files: [file] }))) sharePdf(file);
    }).catch(function (err) {
      b.disabled = false; lbl.textContent = I18N.k('ui.fdv-make-pdf', 'Make PDF');
      toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(I18N.k('ui.fdv-pdf-failed', 'The PDF could not be made – check the connection the first time (the PDF tool is fetched once).')));
      try { console.warn('[fdv] pdf', err); } catch (e2) {}
    });
  });
  function sharePdf(file) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, '') }).catch(function () {}); return; }
    var a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  /* the PDF is made on the device: the report is laid out at A4 width, drawn to a picture (html2canvas), cut into pages between
     paragraphs, rows and findings – never through a line – and put into a PDF (jsPDF) with your name, the report number and
     the page number as real text at the foot of every page. The two tools are fetched only the first time (cmd/vendor). */
  function loadJs(src) { return new Promise(function (res, rej) { var sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }); }
  var LIBS = null;
  function libs() { return LIBS || (LIBS = Promise.all([window.jspdf ? 1 : loadJs('/cmd/vendor/jspdf.umd.min.js?v=2.5.2'), window.html2canvas ? 1 : loadJs('/cmd/vendor/html2canvas.min.js?v=1.4.1')]).catch(function (e) { LIBS = null; throw e; })); }
  function makePdf(r) {
    var me = readJSON('dash.profile', {}) || {}, foot = [[me.name, me.role].filter(Boolean).join(', '), me.employer, r.no ? I18N.k('ui.fdv-report-no', 'Report no. {n}', { n: r.no }) + (curRev(r) ? ' Rev. ' + curRev(r).n : '') : '', r.building].filter(Boolean).join('  ·  ');
    var name = ((r.no ? r.no + ' ' : '') + I18N.k('ui.fdv-file-name', 'Condition report') + ' ' + (r.building || '')).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() + '.pdf';
    return pagedPdf(report(r), foot, name);
  }
  /* any report in the .rp-doc look as an A4 PDF with a text footer (also used by Document control) */
  function pagedPdf(html, foot, name) {
    name = String(name || 'report.pdf').replace(/\u00ad/g, '');   /* soft hyphens in the Norwegian tab names stay out of the PDF */
    return libs().then(function () {
      var W = 700, MM = W / 182, PAGE = Math.floor(259 * MM);   /* A4 with 14 mm sides, 14 mm top and 24 mm for the footer */
      var box = document.createElement('div'); box.className = 'rp-pdfbox';
      box.innerHTML = '<article class="rp-doc rp-pdf">' + html + '</article>'; document.body.appendChild(box);
      var doc = box.firstChild;
      var waits = [].map.call(doc.querySelectorAll('img[data-rph]'), function (im) { return getPhoto(im.dataset.rph).then(function (bl) { if (!bl) { (im.closest('figure') || im).remove(); return; } return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { im.onload = ok; im.onerror = ok; im.src = fr.result; }; fr.readAsDataURL(bl); }); }); });
      return Promise.all(waits).then(function () { return new Promise(function (ok) { setTimeout(ok, 120); }); }).then(function () {
        var top0 = doc.getBoundingClientRect().top, Y = function (el, w) { var b = el.getBoundingClientRect(); return w ? b.bottom - top0 : b.top - top0; };
        var total = doc.scrollHeight;
        var atoms = [].slice.call(doc.querySelectorAll('h2, h3, p, tr, li, .rp-f, figure, .rp-bar1, .rp-mxt, .rp-tgt, .rp-head, .rp-cvt tr, footer')).map(function (e) { return [Y(e), Y(e, 1), /^H[23]$/.test(e.tagName)]; });
        var forced = [].slice.call(doc.querySelectorAll('.rp-newpage')).map(function (e) { return Y(e); }).concat([].slice.call(doc.querySelectorAll('.rp-cover')).map(function (e) { return Y(e, 1) + 1; })).filter(function (y) { return y > 4; }).sort(function (a, b) { return a - b; });
        var cuts = [], st = 0;
        while (st < total - 2) {
          var lim = st + PAGE, fb = forced.filter(function (y) { return y > st + 4 && y <= lim; })[0], end;
          if (fb) end = fb;
          else if (lim >= total) end = total;
          else {
            end = lim;
            for (var y = lim; y > st + PAGE * .4; y--) { if (!atoms.some(function (a) { return a[0] < y && a[1] > y; })) { end = y; break; } }
            /* a heading never ends a page alone */
            atoms.forEach(function (a) { if (a[2] && a[0] >= st && a[1] <= end && end - a[1] < 40 && a[0] > st + 20) end = Math.min(end, a[0] - 2); });
          }
          cuts.push([st, end]); st = end;
          while (st < total && !atoms.some(function (a) { return a[1] > st; })) st = total;
        }
        /* drawn a few pages at a time (JP 13:05 – a long report stopped half way on the iPhone: Safari draws nothing past ~16 million
           pixels in one picture, so one picture of the whole report came out blank at the bottom) */
        var chunks = [], cur = null;
        cuts.forEach(function (c, i) { if (!cur || c[1] - cur.a > 2400) { cur = { a: c[0], b: c[1], ix: [] }; chunks.push(cur); } cur.b = c[1]; cur.ix.push(i); });
        var PDF = window.jspdf.jsPDF, pdf = new PDF({ unit: 'mm', format: 'a4', compress: true }), W0 = doc.offsetWidth;
        return chunks.reduce(function (pr, ch) {
          return pr.then(function () {
            var H = Math.ceil(ch.b - ch.a);
            return window.html2canvas(box, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: document.documentElement.clientWidth, windowHeight: window.innerHeight,
              onclone: function (d) { var bx = d.querySelector('.rp-pdfbox'), ar = bx && bx.firstElementChild; if (!ar) return; bx.style.height = H + 'px'; bx.style.overflow = 'hidden'; ar.style.setProperty('margin-top', (-ch.a) + 'px', 'important'); } }   /* the same width the pages were measured at – on a phone it used to draw at desktop width, so the cuts landed in the wrong places (an empty page after a heading) */).then(function (cv) {
              var S = cv.width / W0;
              ch.ix.forEach(function (i) {
                var c = cuts[i];
                if (i) pdf.addPage();
                var h = Math.max(1, Math.round((c[1] - c[0]) * S)), pc = document.createElement('canvas'); pc.width = cv.width; pc.height = h;
                var g = pc.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, pc.width, h); g.drawImage(cv, 0, Math.round((c[0] - ch.a) * S), cv.width, h, 0, 0, cv.width, h);
                pdf.addImage(pc.toDataURL('image/jpeg', .9), 'JPEG', 14, 14, 182, (c[1] - c[0]) / MM, undefined, 'FAST');
                pdf.setDrawColor(213, 218, 224); pdf.setLineWidth(.2); pdf.line(14, 284, 196, 284);
                pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(110, 118, 128);
                pdf.text(foot.replace(/­/g, ''), 14, 288.5, { maxWidth: 160 }); pdf.text((i + 1) + ' / ' + cuts.length, 196, 288.5, { align: 'right' });
              });
              cv.width = cv.height = 0;
            });
          });
        }, Promise.resolve()).then(function () {
          box.remove();
          var file = new File([pdf.output('blob')], name, { type: 'application/pdf' }); file._pages = cuts.length;
          return file;
        });
      }).catch(function (e) { box.remove(); throw e; });
    });
  }
  window.FdvPdf = { make: makePdf, html: pagedPdf, share: sharePdf };
  drawAll();
})();
