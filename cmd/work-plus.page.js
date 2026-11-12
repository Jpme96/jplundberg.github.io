/* Work, batch 4 (Oct 2026):
     FDV templates  – phrases per building part (built-in + your own) inserted with one tap while on site,
                      your own building parts, and the form remembers the last part and grade.
     Offline        – the FDV card says clearly when you're offline (everything is kept on the phone)
                      and shows "Synced ✓" when it's back online.
     Invoice draft  – from Time per client: hours × rate for one client and month, as an A4 page
                      (same look as the FDV report) – Save as PDF from the print sheet.
   Data in dash.tools: fdvph (your phrases), fdvparts (your building parts), ptcfg (invoice details). */
/* The page part of work-plus.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is work-plus.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["work"]; if (!__c) return;
  var myPhrases = __c.myPhrases, myParts = __c.myParts, esc = __c.esc, toast = __c.toast, Fe = __c.Fe;
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +(p[2] || 1)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function nb() { return window.I18N && window.I18N.lang === 'nb'; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function kr2(n) { return nf2.format(Math.round((n || 0) * 100) / 100); }
  var BUILT = {
    'Roof': [['Loose or missing roof tiles', 'Løse eller manglende takstein', 'Replace and fasten tiles', 'Skift og fest takstein', '2'], ['Gutters clogged with leaves', 'Takrenner tette av løv', 'Clean gutters and downpipes', 'Rens takrenner og nedløp', '1'], ['Moss growth on the roof', 'Mosegroing på taket', 'Treat with moss remover', 'Behandle med mosefjerner', '1'], ['Damaged flashing around the chimney', 'Skadet beslag rundt pipe', 'Repair the flashing', 'Reparer beslaget', '2']],
    'Facade': [['Flaking paint on the cladding', 'Flassende maling på kledningen', 'Scrape and repaint', 'Skrap og mal', '1'], ['Rot in the cladding near the ground', 'Råte i kledning mot terreng', 'Replace damaged boards, more clearance to the ground', 'Skift skadde bord, øk avstand til terreng', '2'], ['Cracks in render or masonry', 'Riss i puss eller mur', 'Monitor and seal the cracks', 'Følg med og tett rissene', '1']],
    'Windows and doors': [['Cracked sealant around the window', 'Sprukket fuge rundt vinduet', 'Re-seal', 'Fug på nytt', '1'], ['Condensation between the panes', 'Kondens mellom glassene (punktert rute)', 'Replace the glass unit', 'Skift glasset', '2'], ['Door does not close properly', 'Døren lukker ikke ordentlig', 'Adjust hinges and lock', 'Juster hengsler og lås', '1']],
    'Wet rooms': [['Missing or failing silicone joints', 'Manglende eller dårlige silikonfuger', 'Re-seal the joints', 'Fug på nytt', '2'], ['High moisture reading behind the tiles', 'Forhøyet fukt bak flisene', 'Further investigation', 'Videre undersøkelse', '3'], ['Floor drain not cleaned', 'Sluk ikke rengjort', 'Clean the drain', 'Rens sluket', '1'], ['Too little fall towards the drain', 'For lite fall mot sluk', 'Assess when renovating', 'Vurder ved rehabilitering', '2']],
    'Kitchen': [['No leak guard under the dishwasher', 'Mangler lekkasjesikring under oppvaskmaskinen', 'Install a leak guard', 'Monter lekkasjestopper', '2'], ['Dirty filter in the cooker hood', 'Tilsmusset filter i kjøkkenviften', 'Clean or replace the filter', 'Rens eller skift filteret', '1']],
    'Electrical': [['Old fuse box with screw fuses', 'Gammelt sikringsskap med skrusikringer', 'Assessment by an electrician', 'Vurdering av elektriker', '2'], ['No earth fault breaker', 'Mangler jordfeilbryter', 'Install an earth fault breaker', 'Monter jordfeilbryter', '2'], ['Loose socket or cover', 'Løs stikkontakt eller deksel', 'Fasten or replace', 'Fest eller skift', '1']],
    'Plumbing (VVS)': [['Water heater older than 20 years', 'Varmtvannsbereder eldre enn 20 år', 'Plan a replacement', 'Planlegg utskifting', '2'], ['Corrosion on pipes', 'Korrosjon på rør', 'Monitor or replace', 'Følg med eller skift', '2'], ['Main stopcock hard to turn', 'Hovedstoppekran går tungt', 'Service or replace', 'Service eller skift', '1']],
    'Ventilation': [['Dirty valves and ducts', 'Tilsmussede ventiler og kanaler', 'Clean valves and ducts', 'Rens ventiler og kanaler', '1'], ['Filter not changed', 'Filter ikke skiftet', 'Change the filter', 'Skift filteret', '1'], ['No fresh air supply in the bedroom', 'Mangler tilluft på soverommet', 'Install a vent', 'Monter ventil', '2']],
    'Heating': [['Dirty heat pump filter', 'Tilsmusset filter i varmepumpen', 'Clean the filter', 'Rens filteret', '1'], ['Radiator heats unevenly', 'Radiator varmer ujevnt', 'Bleed or service', 'Luft eller service', '1']],
    'Fire safety': [['Smoke alarm missing on a floor', 'Mangler røykvarsler i én etasje', 'Install a smoke alarm', 'Monter røykvarsler', '3'], ['Fire extinguisher out of date', 'Brannslukker utgått på dato', 'Service or replace', 'Service eller skift', '2'], ['Escape route blocked', 'Rømningsvei blokkert', 'Clear the escape route', 'Rydd rømningsveien', '3']],
    'Structure': [['Cracks in the foundation wall', 'Riss i grunnmuren', 'Monitor and seal', 'Følg med og tett', '2'], ['Signs of settlement', 'Tegn på setninger', 'Further investigation', 'Videre undersøkelse', '2'], ['Moisture in the crawl space', 'Fukt i krypkjelleren', 'Better ventilation or a dehumidifier', 'Bedre lufting eller avfukter', '2']],
    'Outdoor areas': [['Ground slopes towards the house', 'Terrenget faller mot huset', 'Re-grade away from the wall', 'Juster fallet fra veggen', '2'], ['Rot in deck boards', 'Råte i terrassebord', 'Replace the boards', 'Skift bordene', '1'], ['Loose railing', 'Løst rekkverk', 'Fasten the railing', 'Fest rekkverket', '3']],
    'Other': [['No visible damage', 'Ingen synlige skader', '', '', '0'], ['Not accessible', 'Ikke tilgjengelig', 'Examine at the next inspection', 'Undersøk ved neste befaring', 'iu']]
  };
  function partKey(v) { if (BUILT[v]) return v; var T = window.I18N && window.I18N.t; return T ? Object.keys(BUILT).filter(function (k) { return T(k) === v; })[0] || v : v; }
  function phrasesFor(part) {
    var mine = myPhrases().filter(function (x) { return x.part === part; }).map(function (x) { return { id: x.id, text: x.text, action: x.action || '', tg: x.tg || '', mine: true }; });
    var b = (BUILT[partKey(part)] || []).map(function (x, i) { return { id: 'b' + i, text: nb() ? x[1] : x[0], action: nb() ? x[3] : x[2], tg: x[4] }; });
    var seen = {}; return mine.concat(b).filter(function (x) { var k = String(x.text || '').toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; });
  }
  var last = { part: null, tg: null };
  function decorate(form) {
    var sel = form.querySelector('select[name="part"]'), tg = form.querySelector('select[name="tg"]'); if (!sel) return;
    /* your own building parts in the list */
    myParts().forEach(function (p) { if (![].some.call(sel.options, function (o) { return o.value === p; })) { var o = document.createElement('option'); o.textContent = p; o.value = p; sel.insertBefore(o, sel.querySelector('option:last-child')); } });
    if (form.dataset.wpDone) return;
    if (!form.dataset.wpDone) {
      form.dataset.wpDone = '1';
      if (last.part && [].some.call(sel.options, function (o) { return o.value === last.part; })) sel.value = last.part;
      if (last.tg && tg) tg.value = last.tg;
      var box = document.createElement('div'); box.className = 'fdv-tpl'; box.setAttribute('data-noi18n', '');
      form.querySelector('.row2').insertAdjacentElement('afterend', box);
    }
    chips(form);
  }
  function chips(form) {
    var box = form.querySelector('.fdv-tpl'), part = form.part.value; if (!box) return;
    var l = phrasesFor(part);
    box.innerHTML = l.map(function (x, i) {
      return '<span class="fdv-chip' + (x.mine ? ' mine' : '') + '"><button type="button" data-fdvph="' + i + '" title="' + esc(x.action ? '→ ' + x.action : '') + '">' + (x.tg ? '<i class="tgd tg' + x.tg + '"></i>' : '') + esc(x.text) + '</button>' +
        (x.mine ? '<button type="button" class="fdv-chx" data-fdvphdel="' + esc(x.id) + '" aria-label="Remove phrase"><i class="bi bi-x"></i></button>' : '') + '</span>';
    }).join('') + '<button type="button" class="fdv-chip fdv-save" data-fdvphsave title="Save what you’ve typed as a phrase for this part" data-t-title="ui.save-what-youve-typed-as-a-phrase-for-th"><i class="bi bi-star"></i> <span data-t="ui.save-phrase"><span data-t="ui.save-phrase">Save phrase</span></span></button>';
    box._list = l;
  }
  var host = document.querySelector('[data-tool="fdv"]');
  if (host) {
    /* the card redraws itself; decorate the new form once (our own changes inside the chips / status line are ignored) */
    new MutationObserver(function (ms) {
      if (ms.every(function (m) { return m.target.closest && m.target.closest('.fdv-tpl, .fdv-sync, select'); })) return;
      host.querySelectorAll('form.fdv-add:not([data-wp-done])').forEach(decorate); status();
    }).observe(host, { childList: true, subtree: true });
    host.addEventListener('change', function (e) {
      var f = e.target.closest('form.fdv-add'); if (!f) return;
      if (e.target.name === 'part') { last.part = e.target.value; chips(f); }
      if (e.target.name === 'tg') last.tg = e.target.value;
    });
    host.addEventListener('submit', function (e) { var f = e.target.closest('form.fdv-add'); if (f) { last.part = f.part.value; last.tg = f.tg.value; pendingBump(); } }, true);
    host.addEventListener('click', function (e) {
      var b, f = e.target.closest('form.fdv-add');
      if ((b = e.target.closest('[data-fdvph]')) && f) {
        var x = f.querySelector('.fdv-tpl')._list[+b.dataset.fdvph]; if (!x) return;
        f.text.value = x.text; f.action.value = x.action || ''; if (x.tg) { f.tg.value = x.tg; last.tg = x.tg; }
        f.text.focus(); try { f.text.setSelectionRange(x.text.length, x.text.length); } catch (er) {}
        return;
      }
      if (e.target.closest('[data-fdvphsave]') && f) {
        var text = f.text.value.trim(); if (!text) { f.text.focus(); toast('<i class="bi bi-info-circle"></i> Type the finding first, then save it as a phrase'); return; }
        var t = Fe.tools(); t.fdvph = Array.isArray(t.fdvph) ? t.fdvph : [];
        if (!t.fdvph.some(function (q) { return q.part === f.part.value && String(q.text || '').toLowerCase() === text.toLowerCase(); })) t.fdvph.push({ id: uid(), part: f.part.value, text: text.slice(0, 300), action: f.action.value.trim().slice(0, 200), tg: f.tg.value });
        var keep = { text: f.text.value, action: f.action.value };
        Fe.saveTools(t);
        setTimeout(function () { var f2 = host.querySelector('form.fdv-add'); if (f2) { f2.text.value = keep.text; f2.action.value = keep.action; } }, 80);
        toast('<i class="bi bi-star-fill"></i> Phrase saved for ' + esc(f.part.value));
        return;
      }
      if ((b = e.target.closest('[data-fdvphdel]'))) {
        var t2 = Fe.tools(), gone = (t2.fdvph || []).filter(function (q) { return q.id === b.dataset.fdvphdel; })[0];
        t2.fdvph = (t2.fdvph || []).filter(function (q) { return q !== gone; }); Fe.saveTools(t2);
        toast('<i class="bi bi-trash3"></i> Phrase removed', function () { var t3 = Fe.tools(); t3.fdvph = (t3.fdvph || []).concat([gone]); Fe.saveTools(t3); });
      }
    });
  }
  function pending() { return +(readJSON('dash.fdvPend', 0) || 0); }
  function pendingBump() { if (!navigator.onLine || (window.Vault.syncState && window.Vault.syncState() === 'offline')) { try { localStorage.setItem('dash.fdvPend', String(pending() + 1)); } catch (e) {} } }
  var syncedAt = null;
  function status() {
    if (!host || host.hidden) return;
    var card = host.querySelector('.card'); if (!card) return;
    var el = card.querySelector('.fdv-sync');
    if (!el) { el = document.createElement('p'); el.className = 'fdv-sync'; var hd = card.querySelector('.card-head'); hd.insertAdjacentElement('afterend', el); }
    var st = window.Vault.syncState ? window.Vault.syncState() : 'ok', off = !navigator.onLine || st === 'offline', n = pending();
    var h = off ? '<i class="bi bi-cloud-slash"></i> <b>Offline</b> – findings and photos are saved on this phone' + (n ? ' (' + n + ' new)' : '') + '. They sync by themselves when you’re back online.'
      : st === 'busy' && n ? '<i class="bi bi-arrow-repeat spin"></i> Back online – syncing …'
      : syncedAt ? '<i class="bi bi-cloud-check"></i> Synced ✓ ' + syncedAt + ' · photos stay on this phone'
      : '';
    el.className = 'fdv-sync' + (off ? ' off' : syncedAt ? ' ok' : '');
    el.hidden = !h; if (el.innerHTML !== h) el.innerHTML = h;
  }
  /* the waiting flag is cleared by the everywhere part (work-plus.js) on any page; here only what you see */
  window.addEventListener('fdv:synced', function () { syncedAt = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); if (host) toast('<i class="bi bi-cloud-check"></i> Inspection synced ✓'); });
  window.addEventListener('sync:state', function () { status(); });
  ['online', 'offline'].forEach(function (ev) { window.addEventListener(ev, status); });
  function pcfg() { var c = Fe.tools().ptcfg || {}; return { vat: c.vat !== false, payDays: +c.payDays || 14, org: c.org ? String(c.org) : '', account: c.account ? String(c.account) : '', addr: c.addr ? String(c.addr) : '', invNext: +c.invNext || 1 }; }
  function proj(id) { return Fe.list('pproj').filter(function (p) { return p.id === id; })[0] || { name: 'Unknown' }; }
  function months() { var m = {}; Fe.list('ptime').forEach(function (e) { if (e.date) m[e.date.slice(0, 7)] = 1; }); return Object.keys(m).sort().reverse(); }
  function mName(ym) { return fromKey(ym + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
  var INV = { by: 'entry' };
  function invoiceSheet() {
    var ms = months(); if (!ms.length) { toast('<i class="bi bi-info-circle"></i> No hours logged yet'); return; }
    var now = dkey(new Date()).slice(0, 7), lastM = dkey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)).slice(0, 7);
    var st = { ym: ms.indexOf(lastM) > -1 ? lastM : ms[0], key: null, no: '', rate: '' };
    var bg = document.createElement('div'); bg.className = 'rp-bg';
    bg.innerHTML = '<div class="rp-bar"><button type="button" class="text-btn" data-ivclose><i class="bi bi-x-lg"></i> <span data-t="ui.close">Close</span></button><span class="spacer"></span>' +
      '<select data-ivym aria-label="Month" data-t-aria-label="ui.month"></select><select data-ivwho aria-label="Client" data-t-aria-label="ui.client"></select>' +
      '<button type="button" class="pill-btn" data-ivprint><i class="bi bi-file-earmark-pdf"></i> <span data-t="ui.save-as-pdf">Save as PDF</span></button></div>' +
      '<div class="iv-opts"><label><span data-t="ui.invoice-no">Invoice no.</span> <input data-ivno inputmode="numeric" maxlength="20"></label><label data-ivratel hidden><span data-t="ui.rate">Rate</span> <input data-ivrate inputmode="decimal" placeholder="kr/h" maxlength="10"></label>' +
      '<span class="seg lp-seg"><button type="button" data-ivby="entry" data-t="ui.each-entry"><span data-t="ui.each-entry">Each entry</span></button><button type="button" data-ivby="day" data-t="ui.per-day"><span data-t="ui.per-day">Per day</span></button><button type="button" data-ivby="total" data-t="ui.one-line"><span data-t="ui.one-line">One line</span></button></span>' +
      '<label class="rp-opt"><input type="checkbox" data-ivvat> <span data-t="ui.25-vat">25 % VAT</span></label><button type="button" class="text-btn" data-ivcopy><i class="bi bi-clipboard"></i> <span data-t="ui.copy-as-text">Copy as text</span></button></div>' +
      '<p class="rp-hint"><span data-t="ui.a-draft-to-check-before-you-send-it-in-t">A draft to check before you send it – in the print window, choose</span> <b data-t="ui.save-as-pdf"><span data-t="ui.save-as-pdf">Save as PDF</span></b><span data-t="ui.your-details-are-in-settings-work">. Your details are in Settings → Work.</span></p><article class="rp-doc iv-doc"></article>';
    document.body.appendChild(bg); document.body.classList.add('rp-open');
    var doc = bg.querySelector('.rp-doc'), C = pcfg(), vat = C.vat;
    bg.querySelector('[data-ivvat]').checked = vat;
    function who(ym) {
      /* one invoice per client: projects with the same client go together; projects without one stand alone */
      var g = {};
      Fe.list('ptime').filter(function (e) { return e.date && e.date.slice(0, 7) === ym; }).forEach(function (e) { var p = proj(e.pid), k = p.client ? 'c:' + p.client.toLowerCase() : 'p:' + e.pid; (g[k] = g[k] || { name: p.client || p.name, es: [] }).es.push(e); });
      return g;
    }
    function fill() {
      bg.querySelector('[data-ivym]').innerHTML = ms.map(function (m) { return '<option value="' + m + '"' + (m === st.ym ? ' selected' : '') + '>' + esc(mName(m)) + (m === now ? ' (so far)' : '') + '</option>'; }).join('');
      var g = who(st.ym), ks = Object.keys(g).sort(function (a, b) { return g[b].es.length - g[a].es.length; });
      if (ks.indexOf(st.key) < 0) st.key = ks[0];
      bg.querySelector('[data-ivwho]').innerHTML = ks.map(function (k) { return '<option value="' + esc(k) + '"' + (k === st.key ? ' selected' : '') + '>' + esc(g[k].name) + '</option>'; }).join('');
      bg.querySelectorAll('[data-ivby]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.ivby === INV.by)); });
      return g;
    }
    function lines(g) {
      var es = (g[st.key] || { es: [] }).es.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }), rateIn = parseFloat(String(st.rate).replace(',', '.')) || 0;
      var rateOf = function (e) { return +proj(e.pid).rate || rateIn; };
      var L = [];
      if (INV.by === 'total') {
        var per = {}; es.forEach(function (e) { var p = proj(e.pid), r = rateOf(e), k = e.pid + '|' + r; (per[k] = per[k] || { text: p.name + ' – ' + mName(st.ym), mins: 0, rate: r }).mins += e.mins; });
        L = Object.keys(per).map(function (k) { return per[k]; });
      } else if (INV.by === 'day') {
        var pd = {}; es.forEach(function (e) { var r = rateOf(e), k = e.date + '|' + e.pid + '|' + r; var x = pd[k] = pd[k] || { date: e.date, text: proj(e.pid).name, notes: [], mins: 0, rate: r }; x.mins += e.mins; if (e.note) x.notes.push(e.note); });
        L = Object.keys(pd).sort().map(function (k) { var x = pd[k]; x.text += x.notes.length ? ': ' + x.notes.join('; ') : ''; return x; });
      } else L = es.map(function (e) { return { date: e.date, text: proj(e.pid).name + (e.note ? ': ' + e.note : ''), mins: e.mins, rate: rateOf(e) }; });
      L.forEach(function (x) { x.h = Math.round(x.mins / 60 * 100) / 100; x.sum = x.h * x.rate; });
      return { L: L, needRate: es.some(function (e) { return !+proj(e.pid).rate; }) };
    }
    function draw() {
      var g = fill(), r = lines(g), L = r.L, me = readJSON('dash.profile', {}) || {}, C2 = pcfg();
      bg.querySelector('[data-ivratel]').hidden = !r.needRate;
      var no = st.no || (new Date().getFullYear() + '-' + String(C2.invNext).padStart(3, '0')); st.noShown = no;
      var ino = bg.querySelector('[data-ivno]'); if (document.activeElement !== ino) ino.value = no;
      var ex = L.reduce(function (a, x) { return a + x.sum; }, 0), mva = vat ? ex * .25 : 0, hrs = L.reduce(function (a, x) { return a + x.h; }, 0);
      var issued = dkey(new Date()), due = new Date(); due.setDate(due.getDate() + C2.payDays);
      var dfmt = function (k) { return fromKey(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };
      var client = (g[st.key] || {}).name || '';
      doc.innerHTML = '<header class="rp-head iv-head"><div><p class="rp-kick" data-t="ui.invoice-draft"><span data-t="ui.invoice-draft">Invoice draft</span></p><h1>' + esc(me.name || 'Your name') + '</h1>' +
        '<p class="rp-addr">' + [C2.addr, me.email, me.phone, C2.org ? 'Org. no. ' + C2.org + (vat ? ' MVA' : '') : ''].filter(Boolean).map(esc).join('<br>') + '</p></div>' +
        '<div class="iv-no"><small data-t="ui.invoice"><span data-t="ui.invoice">Invoice</span></small><b>' + esc(no) + '</b></div></header>' +
        '<table class="rp-meta"><tr><th data-t="ui.to"><span data-t="ui.to">To</span></th><td><b>' + esc(client) + '</b></td><th data-t="ui.invoice-date"><span data-t="ui.invoice-date">Invoice date</span></th><td>' + esc(dfmt(issued)) + '</td></tr>' +
        '<tr><th data-t="ui.period"><span data-t="ui.period">Period</span></th><td>' + esc(mName(st.ym)) + '</td><th data-t="ui.due-date"><span data-t="ui.due-date">Due date</span></th><td>' + esc(dfmt(dkey(due))) + '</td></tr>' +
        '<tr><th data-t="ui.hours"><span data-t="ui.hours">Hours</span></th><td>' + esc(nf2.format(hrs)) + '</td><th data-t="ui.pay-to"><span data-t="ui.pay-to">Pay to</span></th><td>' + esc(C2.account || '–') + '</td></tr></table>' +
        '<table class="rp-todo iv-lines"><thead><tr>' + (INV.by === 'total' ? '' : '<th data-t="ui.date"><span data-t="ui.date">Date</span></th>') + '<th data-t="ui.description"><span data-t="ui.description">Description</span></th><th class="n" data-t="ui.hours"><span data-t="ui.hours">Hours</span></th><th class="n" data-t="ui.rate"><span data-t="ui.rate">Rate</span></th><th class="n" data-t="ui.amount"><span data-t="ui.amount">Amount</span></th></tr></thead><tbody>' +
        L.map(function (x) { return '<tr>' + (INV.by === 'total' ? '' : '<td class="iv-d">' + esc(fromKey(x.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</td>') + '<td>' + esc(x.text) + '</td><td class="n">' + nf2.format(x.h) + '</td><td class="n">' + (x.rate ? kr2(x.rate) : '<span class="iv-miss">–</span>') + '</td><td class="n">' + kr2(x.sum) + '</td></tr>'; }).join('') +
        '</tbody></table><table class="iv-tot"><tr><th data-t="ui.total-excl-vat"><span data-t="ui.total-excl-vat">Total excl. VAT</span></th><td>' + kr2(ex) + ' kr</td></tr>' + (vat ? '<tr><th data-t="ui.vat-25"><span data-t="ui.vat-25">VAT 25 %</span></th><td>' + kr2(mva) + ' kr</td></tr>' : '') +
        '<tr class="iv-sum"><th data-t="ui.amount-due"><span data-t="ui.amount-due">Amount due</span></th><td>' + kr2(ex + mva) + ' kr</td></tr></table>' +
        (r.needRate && !(parseFloat(st.rate) > 0) ? '<p class="iv-warn" data-t="ui.no-hourly-rate-for-this-client-add-one-a">No hourly rate for this client – add one above, or on the client in Time per client.</p>' : '') +
        '<footer class="rp-foot">' + esc([me.name, C2.org ? 'Org. no. ' + C2.org : '', C2.account ? 'Account ' + C2.account : '', 'Invoice ' + no].filter(Boolean).join(' · ')) + '</footer>';
      st.total = ex + mva; st.client = client; st.lines = L; st.ex = ex; st.mva = mva; st.dueK = dkey(due);
    }
    function close() { bg.remove(); document.body.classList.remove('rp-open'); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    bg.addEventListener('change', function (e) {
      if (e.target.matches('[data-ivym]')) { st.ym = e.target.value; draw(); }
      if (e.target.matches('[data-ivwho]')) { st.key = e.target.value; draw(); }
      if (e.target.matches('[data-ivvat]')) { vat = e.target.checked; draw(); }
    });
    bg.addEventListener('input', function (e) {
      if (e.target.matches('[data-ivno]')) { st.no = e.target.value.trim(); clearTimeout(draw.t); draw.t = setTimeout(draw, 250); }
      if (e.target.matches('[data-ivrate]')) { st.rate = e.target.value; clearTimeout(draw.t); draw.t = setTimeout(draw, 250); }
    });
    bg.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-ivclose]')) return close();
      if ((b = e.target.closest('[data-ivby]'))) { INV.by = b.dataset.ivby; draw(); return; }
      if (e.target.closest('[data-ivcopy]')) {
        var txt = 'Invoice ' + st.noShown + ' – ' + st.client + ' – ' + mName(st.ym) + '\n' + st.lines.map(function (x) { return (x.date ? x.date + ' ' : '') + x.text + ': ' + nf2.format(x.h) + ' h × ' + kr2(x.rate) + ' = ' + kr2(x.sum) + ' kr'; }).join('\n') +
          '\nTotal excl. VAT ' + kr2(st.ex) + ' kr' + (vat ? '\nVAT 25 % ' + kr2(st.mva) + ' kr' : '') + '\nAmount due ' + kr2(st.total) + ' kr, by ' + st.dueK;
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('<i class="bi bi-clipboard-check"></i> Copied'); });
        return;
      }
      if (e.target.closest('[data-ivprint]')) {
        var title = document.title;
        document.title = ('Invoice ' + st.noShown + ' ' + st.client).trim();
        /* the next number moves on when this one used the suggested number */
        var C3 = pcfg(), used = st.noShown === new Date().getFullYear() + '-' + String(C3.invNext).padStart(3, '0') || st.noShown === String(C3.invNext);
        var done = function () { document.title = title; window.removeEventListener('afterprint', done); };
        window.addEventListener('afterprint', done);
        window.print(); setTimeout(done, 60000);
        if (used) { var t = Fe.tools(); t.ptcfg = Object.assign({}, t.ptcfg || {}, { invNext: C3.invNext + 1 }); Fe.saveTools(t); }
      }
    });
    draw();
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-ptinv]')) invoiceSheet(); });
  Object.assign(window.WorkPlus, { invoice: invoiceSheet, phrasesFor: phrasesFor });
  (window.__ui = window.__ui || {})["work"] = { invoiceSheet: invoiceSheet };
})();
