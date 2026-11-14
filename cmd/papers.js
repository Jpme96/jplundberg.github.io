/* Papers (Nov 2026): one place for the papers that matter – contracts, insurance, loan and bank papers,
   work papers, ID, car, health and tax – each with its PDF or photos, who it's with, a reference number,
   and a reminder before it expires or renews (At a glance + the calendar).
   The details (title, dates, notes) are in dash.tools.papers – synced and encrypted like everything else.
   The FILES are kept on the device (IndexedDB "dash-papers") and synced encrypted to your other devices
   through the Worker (filesync.js); the page shows what is synced and what is still on its way. Receipts on Home inventory items,
   warranties and travel documents keep living where they are; the page links to them. */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in papers.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["papers"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +(p[2] || 1)); }
  function today() { return dkey(new Date()); }
  function daysTo(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function addYears(k, n) { var d = fromKey(k), day = d.getDate(); d.setDate(1); d.setFullYear(d.getFullYear() + n); var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return dkey(d); }
  function fmt(k, o) { return isKey(k) ? fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function on() { return Fe.on('papers'); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  var KINDS = [
    ['home', 'Home', 'house-door', '#a0673a'], ['contract', 'Contract', 'file-earmark-text', '#3987e5'], ['insurance', 'Insurance', 'shield-check', '#22b35e'],
    ['loan', 'Loan & bank', 'bank', '#11a597'], ['work', 'Work', 'briefcase', '#e8743b'], ['id', 'ID & certificates', 'person-vcard', '#8a6fdf'],
    ['car', 'Car', 'car-front', '#0891b2'], ['health', 'Health', 'heart-pulse', '#d55181'], ['tax', 'Tax', 'percent', '#6b6d73'], ['other', 'Other', 'folder2', '#7a8794']];
  function kind(k) { return KINDS.filter(function (x) { return x[0] === k; })[0] || KINDS[KINDS.length - 1]; }
  var VERB = { expires: 'expires', renews: 'renews', ends: 'ends', review: 'look at it again' };
  var idb = null;
  function db() { return idb || (idb = new Promise(function (res, rej) { var r = indexedDB.open('dash-papers', 1); r.onupgradeneeded = function () { r.result.createObjectStore('files'); }; r.onsuccess = function () { res(r.result); }; r.onerror = rej; })); }
  function putF(id, blob) { return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('files', 'readwrite'); t.objectStore('files').put(blob, id); t.oncomplete = res; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); }; }); }); }
  function getF(id) { return localF(id).then(function (b) { if (b || !window.FileSync) return b; return window.FileSync.down(id).then(function (nb) { if (nb) putF(id, nb).then(soonHere); return nb; }); }); }
  function soonHere() { clearTimeout(soonHere.t); soonHere.t = setTimeout(loadHere, 200); }
  function localF(id) { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('files').objectStore('files').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function allKeys() { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('files').objectStore('files').getAllKeys(); q.onsuccess = function () { res(q.result || []); }; q.onerror = function () { res([]); }; }); }).catch(function () { return []; }); }
  var here = null;
  function loadHere() { return allKeys().then(function (k) { var n = {}; k.forEach(function (x) { n[x] = 1; }); var ch = JSON.stringify(n) !== JSON.stringify(here); here = n; if (ch) redraw(); }); }
  function next(x) {
    if (!isKey(x.date)) return null;
    var d = x.date, ev = +x.every || 0;
    if (ev > 0) { var g = 0; while (daysTo(d) < 0 && g++ < 200) d = addYears(d, ev); }
    return d;
  }
  function lead(x) { return x.lead === '' || x.lead == null ? 30 : +x.lead; }
  function inDays(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n < 0 ? (-n) + ' days ago' : n < 45 ? 'in ' + n + ' days' : n < 550 ? 'in ' + Math.round(n / 30.4) + ' months' : 'in ' + (n / 365).toFixed(1).replace('.', ',').replace(',0', '') + ' years'; }
  function status(x) {
    var d = next(x); if (!d) return null;
    var n = daysTo(d), v = VERB[x.dateKind] || 'expires';
    var past = n < 0 ? (v === 'expires' ? 'expired' : v === 'renews' ? 'renewed' : v === 'ends' ? 'ended' : 'was due') : null;
    return { date: d, n: n, soon: n <= lead(x) && lead(x) > 0, over: n < 0,
      text: past ? cap(past) + ' ' + fmt(d) : cap(v) + ' ' + fmt(d), rel: inDays(n) };
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var invDb = null;
  function invGet(id) {
    var loc = (invDb || (invDb = new Promise(function (res, rej) { var r = indexedDB.open('dash-inv', 1); r.onupgradeneeded = function () { r.result.createObjectStore('photos'); }; r.onsuccess = function () { res(r.result); }; r.onerror = rej; })))
      .then(function (d) { return new Promise(function (res) { var q = d.transaction('photos').objectStore('photos').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; });
    return loc.then(function (b) { return b || !window.FileSync ? b : window.FileSync.down(id); });
  }
  var rcUrls = {};
  function drawReceipts() {
    var el = $t('parcpt'); if (!el) return;
    var inv = Fe.on('house') ? Fe.list('hinv').filter(function (x) { return x && x.receipt; }) : [];
    if (!on() || !inv.length) { el.hidden = true; el.innerHTML = ''; return; }
    var by = {}; inv.forEach(function (x) { (by[x.receipt] = by[x.receipt] || []).push(x); });
    var ids = Object.keys(by).sort(function (a, b) { var A = by[a][0].bought || '', B = by[b][0].bought || ''; return A < B ? 1 : A > B ? -1 : 0; });
    var tot = inv.reduce(function (a, x) { return a + (+x.price || 0); }, 0);
    var h = '<section class="card kit-card" id="parcpt"><div class="card-head"><h2><i class="bi bi-receipt"></i> <span data-t="ui.receipts">Receipts</span></h2><span class="muted pa-rsum">' + ids.length + (ids.length === 1 ? ' receipt' : ' receipts') + (tot ? ' · ' + kr(tot) : '') + '</span></div>' +
      '<ul class="pa-rgrid">' + ids.map(function (rid) { var l = by[rid], x = l[0], pdf = l.some(function (y) { return y.receiptPdf; }), pr = l.reduce(function (a, y) { return a + (+y.price || 0); }, 0);
        return '<li><a class="pa-rt" data-rcopen="' + esc(rid) + '" target="_blank" rel="noopener"><span class="pa-rth">' + (pdf ? '<i class="bi bi-file-earmark-pdf"></i>' : '<img data-rcimg="' + esc(rid) + '" alt=""><i class="bi bi-receipt"></i>') + '</span>' +
          '<b>' + esc(l.map(function (y) { return y.name; }).filter(Boolean).join(' + ') || 'Receipt') + '</b><small>' + esc([pr ? kr(pr) : '', x.bought ? fmt(x.bought, { day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ') || ' ') + '</small></a>' +
          '<a class="pa-rgo" href="/cmd/house/#hinv=' + esc(x.id) + '" aria-label="Open ' + esc(x.name || 'the item') + ' in Home inventory" title="Open in Home inventory"><i class="bi bi-box-arrow-up-right"></i></a></li>'; }).join('') + '</ul></section>';
    el.hidden = false;
    if (el._h !== h) { el._h = h; el.innerHTML = h;
      ids.forEach(function (rid) { invGet(rid).then(function (b) { if (!b) return; var u = rcUrls[rid] || (rcUrls[rid] = URL.createObjectURL(b.type ? b : new Blob([b], { type: by[rid].some(function (y) { return y.receiptPdf; }) ? 'application/pdf' : 'image/jpeg' }))); var a = el.querySelector('[data-rcopen="' + rid + '"]'); if (a) a.href = u; var im = el.querySelector('img[data-rcimg="' + rid + '"]'); if (im) { im.src = u; im.onload = function () { im.parentNode.classList.add('has-img'); }; } }); }); }
  }
  document.addEventListener('click', function (e) { var a = e.target.closest('[data-rcopen]'); if (a && !a.getAttribute('href')) { e.preventDefault(); toast('That receipt is only on the device it was added on – open House there once to sync it'); } });
  function redraw() { if (__ui().col) __ui().col.render(); drawSoon(); drawElse(); drawTiles(); drawReceipts(); }
  function travelDocs() { try { var t = JSON.parse(localStorage.getItem('dash.travel')) || {}; return Array.isArray(t.docs) ? t.docs : []; } catch (e) { return []; } }
  function upcoming(days) {
    var out = [];
    Fe.list('papers').forEach(function (x) { var s = status(x); if (s && s.n >= -14 && s.n <= days) out.push({ date: s.date, n: s.n, title: x.title, what: VERB[x.dateKind] || 'expires', k: kind(x.kind), href: '#papers=' + x.id, renew: x.dateKind === 'renews' }); });
    if (Fe.on('travel')) travelDocs().forEach(function (d) { if (isKey(d.expires)) { var n = daysTo(d.expires); if (n >= -14 && n <= days) out.push({ date: d.expires, n: n, title: d.name || 'Travel document', what: 'expires', k: ['', 'Travel', 'passport', '#0891b2'], href: '/cmd/travel/#docs', travel: true }); } });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  function drawSoon() {
    var el = $t('pasoon'); if (!el) return;
    if (!on()) { el.hidden = true; el.innerHTML = ''; return; }
    var l = upcoming(365); el.hidden = !l.length && !Fe.list('papers').length;
    var h = '<section class="card kit-card" id="pasoon"><div class="card-head"><h2><i class="bi bi-calendar-event"></i> <span data-t="ui.coming-up">Coming up</span></h2></div>' +
      (l.length ? '<ul class="pa-soon">' + l.map(function (u) {
        return '<li><a href="' + esc(u.href) + '"' + (u.travel ? '' : ' data-pago') + '><span class="pa-when' + (u.n < 0 && !u.renew ? ' over' : u.n <= 30 ? ' near' : '') + '"><b>' + esc(fromKey(u.date).getDate()) + '</b><small>' + esc(fmt(u.date, { month: 'short' })) + (fromKey(u.date).getFullYear() !== new Date().getFullYear() ? ' ' + fromKey(u.date).getFullYear() : '') + '</small></span>' +
          '<span class="kit-ic" style="--c:' + u.k[3] + '"><i class="bi bi-' + u.k[2] + '"></i></span><span class="kit-x"><b>' + esc(u.title) + '</b><small>' + esc(cap(u.what) + ' ' + inDays(u.n) + (u.travel ? ' · Travel' : '')) + '</small></span></a></li>';
      }).join('') + '</ul>' : '<p class="empty kit-empty">Nothing expires or renews in the next 12 months. Add a date to a paper to see it here.</p>') + '</section>';
    if (el.innerHTML !== h) el.innerHTML = h;
  }
  function drawElse() {
    var el = $t('paelse'); if (!el) return;
    if (!on()) { el.hidden = true; el.innerHTML = ''; return; }
    var rows = [];
    if (Fe.on('house')) { var inv = Fe.list('hinv'), rc = inv.filter(function (x) { return x.receipt; }).length; if (!rc) rows.push(['box-seam', '#22b35e', 'Receipts on home items', inv.length ? rc + ' of ' + inv.length + ' items have a receipt' : 'Photos and receipts for your valuables', '/cmd/house/#hinv']); }
    if (Fe.on('travel')) { var td = travelDocs(), nx = td.filter(function (d) { return isKey(d.expires) && daysTo(d.expires) >= 0; }).sort(function (a, b) { return a.expires < b.expires ? -1 : 1; })[0]; rows.push(['passport', '#0891b2', 'Travel documents', td.length ? td.length + ' saved' + (nx ? ' · next to expire: ' + (nx.name || 'document') + ' ' + fmt(nx.expires, { month: 'short', year: 'numeric' }) : '') : 'Passport, ID, EHIC and travel insurance', '/cmd/travel/#docs']); }
    if (Fe.on('house') && window.SharedHome) rows.push(['people', '#a0673a', 'Household register', 'Appendix B of the samboerkontrakt – from the Home inventory', '/cmd/house/#hinv']);
    el.hidden = !rows.length;
    var h = rows.length ? '<section class="card kit-card" id="paelse"><div class="card-head"><h2><i class="bi bi-signpost"></i> Kept elsewhere</h2></div><ul class="pa-else">' + rows.map(function (r) {
      return '<li><a href="' + esc(r[4]) + '"><span class="kit-ic" style="--c:' + r[1] + '"><i class="bi bi-' + r[0] + '"></i></span><span class="kit-x"><b>' + esc(r[2]) + '</b><small>' + esc(r[3]) + '</small></span><i class="bi bi-chevron-right"></i></a></li>';
    }).join('') + '</ul></section>' : '';
    if (el.innerHTML !== h) el.innerHTML = h;
  }
  function heroTile(icon, label, value, sub, href, c) { return '<a class="fp-tile hl-tile" href="' + href + '"' + (c ? ' style="--c:' + c + '"' : '') + '><div class="lbl"><i class="bi bi-' + icon + '"></i>' + label + '</div><div class="val">' + value + '</div><div class="sub">' + (sub || '&nbsp;') + '</div></a>'; }
  function drawTiles() {
    var el = document.getElementById('paTiles'); if (!el) return;
    var em = document.querySelector('[data-paempty]'); if (em) em.hidden = on();
    if (!on()) { el.hidden = true; el.innerHTML = ''; return; }
    var l = Fe.list('papers'), u = upcoming(365).filter(function (x) { return x.n >= 0; })[0];
    var ins = l.filter(function (x) { return +x.cost > 0; }).reduce(function (a, x) { return a + (+x.cost); }, 0);
    var nofile = l.filter(function (x) { return !(x.files || []).length; }).length;
    el.hidden = false;
    var h = heroTile('folder2-open', 'Papers', l.length, nofile ? I18N.k('ui.pa-nofile', '{n} without a file', { n: nofile }) : l.length ? I18N.k('ui.pa-allfile', 'all with a file') : I18N.k('ui.none-yet', 'none yet'), '#papers', '#6b4bc4') +
      heroTile('calendar-event', I18N.k('ui.next-date', 'Next date'), u ? esc(fmt(u.date, { day: 'numeric', month: 'short' })) : '–', u ? esc(u.title) : 'nothing in 12 months', '#pasoon', u && u.n <= 30 ? '#e8743b' : '#3987e5') +
      heroTile('cash-coin', I18N.k('ui.per-year', 'Per year'), ins ? kr(ins) : '–', ins ? kr(ins / 12) + ' a month' : 'add what insurance costs', '#papers', '#22b35e');
    if (el.innerHTML !== h) el.innerHTML = h;
  }
  window.BriefExtra = window.BriefExtra || [];
  window.BriefExtra.push(function (add) {
    if (!on()) return;
    Fe.list('papers').map(function (x) { return [x, status(x)]; }).filter(function (p) { return p[1] && lead(p[0]) > 0 && p[1].n <= lead(p[0]) && p[1].n >= (p[0].dateKind === 'renews' ? 0 : -30); })
      .sort(function (a, b) { return a[1].n - b[1].n; }).slice(0, 3).forEach(function (p) {
        var x = p[0], s = p[1], k = kind(x.kind), v = VERB[x.dateKind] || 'expires';
        add(s.n < 0 ? 30 : s.n <= 7 ? 38 : 56, k[2], s.n < 0 ? '#e66767' : s.n <= 7 ? '#e8743b' : k[3],
          x.title + ' ' + (s.n < 0 ? (v === 'expires' ? 'has expired' : v === 'ends' ? 'has ended' : 'was due') : v + ' ' + s.rel),
          [fmt(s.date), x.who, x.dateKind === 'ends' ? 'cancel or renew before then' : x.dateKind === 'renews' ? 'check the price, or switch' : ''].filter(Boolean).join(' · '), '/cmd/papers/#papers=' + x.id);
      });
  });
  (window.EventsExtra = window.EventsExtra || []).push(function () {
    if (!on()) return [];
    return Fe.list('papers').filter(function (x) { return isKey(x.date); }).map(function (x) {
      var k = kind(x.kind), ev = +x.every || 0;
      var e = { id: 'rem:paper:' + x.id, title: x.title + ' ' + (VERB[x.dateKind] || 'expires'), allDay: true, start: fromKey(x.date), days: 1, color: k[3], readOnly: true, reminder: true,
        link: '/cmd/papers/#papers=' + x.id, location: '', notes: [x.who, x.ref ? 'No. ' + x.ref : ''].filter(Boolean).join(' · '), exDays: {} };
      if (ev) e.rule = { freq: 'YEARLY', interval: ev };
      return e;
    });
  });
  window.CommandExtra = window.CommandExtra || [];
  window.CommandExtra.push(function () {
    if (!on()) return [];
    return [{ i: 'folder-plus', t: 'Add a paper', s: 'Papers', run: function () { if (__ui().IS_PAGE && __ui().col) __ui().editSheet(null); else location.href = '/cmd/papers/#add'; }, x: 'papers document dokument kontrakt contract insurance forsikring pdf' },
      { i: 'folder2-open', t: 'Papers', s: 'Contracts, insurance and documents', run: function () { location.href = '/cmd/papers/'; }, x: 'papers dokumenter papirer kontrakter avtaler' }];
  });
  window.Papers = { getFile: getF, list: function () { return Fe.list('papers'); }, upcoming: upcoming, status: status };
  (window.__core = window.__core || {})["papers"] = { on: on, Fe: Fe, fromKey: fromKey, VERB: VERB, kind: kind, KINDS: KINDS, isKey: isKey, fmt: fmt, lead: lead, status: status, inDays: inDays, cap: cap, daysTo: daysTo, today: today, dkey: dkey, pad: pad, next: next, addYears: addYears, getF: getF, soonHere: soonHere, loadHere: loadHere, redraw: redraw, drawReceipts: drawReceipts, rcUrls: rcUrls, invGet: invGet, invDb: invDb, esc: esc, kr: kr, nf: nf, $t: $t, drawTiles: drawTiles, heroTile: heroTile, upcoming: upcoming, travelDocs: travelDocs, drawElse: drawElse, drawSoon: drawSoon, here: here, allKeys: allKeys, db: db, idb: idb, putF: putF, localF: localF, toast: toast };
})();
