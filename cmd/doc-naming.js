/* Document control → file naming (JP 2026-11-16, a test – loaded only where it is switched on, dash.dcNaming = '1'; in Team
   open once with ?naming=1). Each file gets an NS 3451 code and a document type (Boligbygg's Tillegg A letters), a name from
   the project's naming rule (Boligbygg's documents / photos / drawings, or your own), and a content check of PDFs read in this
   browser (pdf.js from vendor/, fetched the first time; nothing is sent). Saved on the file (f.p.code/abbr, f.nv the parts you
   typed, f.orig the name it came with, f.sg what was suggested, f.cc the check's findings – never the text) and on the project
   (p.nrules own rules, p.nuse the rule per kind of file), so Team keeps them in the project.
   doc-control.page.js loads this file (cmd and Team's copy) and hands it its helpers with DocNaming.use(api). */
(function () {
  function zoomOf() { var z = parseFloat(getComputedStyle(document.documentElement).zoom); return z > 0 ? z : 1; }   /* Team on a PC scales the page (CSS zoom): mouse and box positions come in screen px, lengths are set in page px */
  "use strict";
  var I, esc, k, toast, uid, saveP, proj, draw, getBlob, lineOf, unlink, bestLine, parseName, pairs, issueText, linkOpts, codeName, lineTitle, ABBR, TEG, FAG, PAIR, today, pad, LP, HOST;
  /* defaults until a host sets them up, so the PDF viewer also works on its own (Team's Files tab, 2026-11-23) */
  esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  k = function (key, en, o) { return window.I18N && window.I18N.k ? window.I18N.k(key, en, o) : String(en).replace(/\{(\w+)\}/g, function (m, x) { return o && o[x] != null ? o[x] : m; }); };
  var ON = [];
  function on(t, f, c) { document.addEventListener(t, f, c); ON.push([t, f, c]); }
  function cur() { return I.cur(); }
  function use(api) {
    I = api; esc = api.esc; k = api.k; toast = api.toast; uid = api.uid; saveP = api.saveP; proj = api.proj; draw = function () { window.__dcUser = Date.now(); var r = api.draw.apply(this, arguments); lift(); return r; }; drawBg = function () { var r = api.draw.apply(this, arguments); lift(); return r; }; getBlob = api.getBlob; lineOf = api.lineOf; unlink = api.unlink; bestLine = api.bestLine;
    parseName = api.parseName; pairs = api.pairs; issueText = api.issueText; linkOpts = api.linkOpts; codeName = function (c) { var c3 = String(c || '').slice(0, 3), own = LP && LP.ownMap ? LP.ownMap() : {}, n = nsNames()[c3] || own[c3]; return n || api.codeName(c); }; lineTitle = api.lineTitle; ABBR = api.ABBR; TEG = api.TEG; FAG = api.FAG; PAIR = api.PAIR; today = api.today; pad = api.pad; LP = api.LP; HOST = api.HOST;
    ON.forEach(function (x) { document.removeEventListener(x[0], x[1], x[2]); }); ON = []; listen();   /* the page may run again (instant page changes): one set of listeners, on its newest helpers */
  }
  function nb() { return window.I18N && I18N.lang === 'nb'; }
  /* the document types as in JP's Coda ("Hjelpe verktøy til bygning" → Dokument kategorier, 2026-11-25): technical (t) first, then administrative (a);
     a code in both tables (NO, PR, RA, SK) takes the technical name – that is what files are named with */
  var CATN = [['DA', 'Dataark', 'Datasheet', 't'], ['SE', 'Samsvarserklæringer', 'Declarations of conformity', 't'], ['DV', 'Instrukser og anvisninger', 'Instructions and guidance (O&M)', 't'], ['BA', 'Bruksanvisninger', 'User instructions', 't'],
    ['FB', 'Funksjonsbeskrivelse', 'Function description', 't'], ['BE', 'System- og funksjonsbeskrivelser', 'System and function descriptions', 't'], ['SP', 'Spesifikasjoner', 'Specifications', 't'], ['AT', 'Attest, sertifikat, kontrollerklæring, ferdigattest, brukstillatelse', 'Certificates, declarations of control, completion certificate', 't'],
    ['KR', 'Kravoppnåelse', 'Compliance', 't'], ['BR', 'Branndokumentasjon', 'Fire documentation', 't'], ['PT', 'Testprosedyrer', 'Test procedures', 't'], ['PU', 'Testrapporter, dokumentert sluttprøve', 'Test reports, documented final test', 't'],
    ['RA', 'Rapporter, analyser, beregninger, utredninger, testrapporter', 'Reports, analyses, calculations, studies', 't'], ['RI', 'Risikovurdering', 'Risk assessment', 't'], ['PR', 'Prosedyrer, rutiner', 'Procedures, routines', 't'], ['SA', 'Serviceavtaler', 'Service agreements', 't'],
    ['ID', 'Identifikasjon', 'Identification', 't'], ['LI', 'Lister, dokumentplan, tegningslister, modelllister', 'Lists, document plan, drawing and model lists', 't'], ['NO', 'Notat – fag/tekniske, beskrivelser, forvaltningsplan', 'Note – technical, descriptions, management plan', 't'],
    ['SK', 'Skjema, dørskjema', 'Forms, door schedule', 't'], ['SH', 'SHA-plan og miljøoppfølging', 'HSE plan and environmental follow-up', 't'], ['BI', 'Bilder', 'Pictures', 't'],
    ['BM', 'BIM strategi, manualer og relaterte dokumenter', 'BIM strategy, manuals and related documents', 't'], ['BF', 'BIM følgeskriv', 'BIM cover letter', 't'],
    ['PK', 'Protokoller, garantidokumenter', 'Protocols, warranty documents', 'a'], ['PL', 'Planer, fremdrift, KS, organisasjon, opplæring', 'Plans, progress, quality, organisation, training', 'a'], ['OK', 'Avtaledokument', 'Agreement', 'a'], ['RF', 'Referat', 'Minutes', 'a'],
    ['MR', 'Månedsrapport', 'Monthly report', 'a'], ['PA', 'Prosjekteringsanvisning', 'Design guideline', 'a'], ['PD', 'Premissdokument, prinsippdokumenter', 'Premise and principle documents', 'a'], ['PP', 'Presentasjoner', 'Presentations', 'a'],
    ['ST', 'Strategidokument', 'Strategy document', 'a'], ['SD', 'Styringsdokument', 'Governing document', 'a']];
  function catName(a) { var c = CATN.filter(function (x) { return x[0] === a; })[0]; return c ? (nb() ? c[1] : c[2]) : ''; }
  var FLOORS = ['K02', 'K01', 'U02', 'U01', 'H01', 'H02', 'H03', 'H04', 'H05', 'L01', 'T01', '000'], DTYPES = ['B', 'D', 'F', 'O', 'P', 'S', 'T', 'U'];
  /* what the letters mean – Boligbygg's FDVU specification, tables 8–11 (JP 2026-11-16 21:21 "make it easier to pick") */
  var MEAN = {
    floor: { K02: ['2. kjelleretasje', '2nd basement'], K01: ['1. kjelleretasje', '1st basement'], U02: ['2. underetasje', '2nd lower floor'], U01: ['1. underetasje', '1st lower floor'], H01: ['1. hovedetasje', '1st main floor'], H02: ['2. hovedetasje', '2nd main floor'], H03: ['3. hovedetasje', '3rd main floor'], H04: ['4. hovedetasje', '4th main floor'], H05: ['5. hovedetasje', '5th main floor'], L01: ['1. loftsetasje', '1st attic floor'], T01: ['Takplan (utvendig)', 'Roof plan (outside)'], '000': ['Generelt', 'General'] },
    /* Fag and Tegningstype as in JP's Coda ("05 Spesifikke krav til tegninger", 2026-11-25): per building, and for the whole property (G L M R W) */
    disc: { A: ['Arkitekt', 'Architect'], B: ['Rådgivende ingeniør byggeteknikk (RIB)', 'Structural engineer (RIB)'], C: ['Akustikk', 'Acoustics'], E: ['Rådgivende ingeniør elektroteknikk (RIE)', 'Electrical engineer (RIE)'], F: ['Brannrådgiver (RIBr)', 'Fire consultant (RIBr)'], I: ['Interiørarkitekt', 'Interior architect'], H: ['Heiskonsulent', 'Lift consultant'], K: ['Konsulent (spesial)', 'Consultant (special)'], T: ['Tele- og automatiseringskonsulent', 'Telecom and automation consultant'], V: ['Rådgivende ingeniør varme, ventilasjon og sanitær (RIV)', 'HVAC and plumbing engineer (RIV)'],
      G: ['Geoteknikk og grunnarbeider (RIG)', 'Geotechnics and groundworks (RIG)'], L: ['Landskapsarkitekt (LARK)', 'Landscape architect (LARK)'], M: ['Miljørådgiver (RIM)', 'Environmental consultant (RIM)'], R: ['Reguleringsarkitekt', 'Zoning architect'], W: ['Vei og trafikk', 'Roads and traffic'] },
    dtype: { B: ['Bygningsmessige tegninger tekniske fag/utsparingstegninger', 'Builder’s work for technical trades / openings'], D: ['Detalj(er)', 'Detail(s)'], F: ['Fasade', 'Facade'], O: ['Oppriss', 'Elevation'], P: ['Plan', 'Plan'], S: ['Snitt', 'Section'], T: ['Skjema', 'Schematic'], U: ['Utendørs/terrengarbeider', 'Outdoor / site works'] } };
  function mean(key, x, p) { var m = MEAN[key] && MEAN[key][x]; return m ? (nb() ? m[0] : m[1]) : p ? ownMean(p, key, x) : ''; }
  /* your own codes (JP 2026-11-16 22:30 "custom code in the drop down … or free text"): p.ncodes[part] = [[code, meaning]] – shown in the lists under "Your codes" */
  var OWNK = [['code', 'ui.dcn-code', 'NS 3451 code'], ['type', 'ui.dcn-type', 'Document type'], ['floor', 'ui.dcn-p-floor', 'Floor'], ['disc', 'ui.dcn-p-disc', 'Discipline'], ['dtype', 'ui.dcn-p-dtype', 'Drawing type']];
  /* own codes (JP 2026-11-25): Team – a template for the whole team (cfgncodes; whoever has the "codes" action, admins by default) and each person's own list
     (shown only to them); cmd – your one list in your tools (synced). Codes saved on projects before (p.ncodes) move into the template once. */
  var CPEND = { t: null, m: null, at: 0 }, CMIG = false;
  function cstore() { return HOST && HOST.codes ? 'team' : !HOST && window.Features && window.Features.tools ? 'me' : 'here'; }
  function cmap(w) {
    if (CPEND[w] && Date.now() - CPEND.at < 15000) return CPEND[w];
    var st = cstore(); if (st === 'team') return (w === 't' ? HOST.codes.t() : HOST.codes.m()) || {};
    if (w === 'm') return {};
    if (st === 'me') { var t0 = window.Features.tools(); return (t0.dcncodes && t0.dcncodes.c) || {}; }
    try { return (JSON.parse(localStorage.getItem('dcn.codes') || '{}') || {}).c || {}; } catch (e) { return {}; }
  }
  function cmig() { var st = cstore(); if (CPEND.t) return true; if (st === 'team') return HOST.codes.mig(); if (st === 'me') return !!(window.Features.tools().dcncodes || {}).mig; try { return !!(JSON.parse(localStorage.getItem('dcn.codes') || '{}') || {}).mig; } catch (e) { return false; } }
  function canT() { return cstore() === 'team' ? !!HOST.codes.can() : true; }
  function csave(w, map) {
    CPEND[w] = map; CPEND.at = Date.now(); var st = cstore();
    if (st === 'team') return Promise.resolve(HOST.codes.save(w, map)).then(function (ok) { if (ok === false) { CPEND[w] = null; toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.dcn-codes-fail', 'Could not save the codes – try again'))); } drawBg(); });
    if (st === 'me') { var Fe0 = window.Features, t1 = Fe0.tools(); t1.dcncodes = { c: map, mig: 1 }; Fe0.saveTools(t1); }
    else try { localStorage.setItem('dcn.codes', JSON.stringify({ c: map, mig: 1 })); } catch (e) {}
    return Promise.resolve();
  }
  /* once: the codes kept on projects (and the naming tool) become the template – done by someone who may change it */
  function cmigrate() {
    if (CMIG || cmig() || !canT()) return; CMIG = true;
    var M = JSON.parse(JSON.stringify(cmap('t'))), add = function (nc) { Object.keys(nc || {}).forEach(function (key) { (nc[key] || []).forEach(function (y) { if (!y || !y[0]) return; M[key] = M[key] || []; if (!M[key].some(function (z) { return z[0] === y[0]; })) M[key].push([String(y[0]), String(y[1] || '')]); }); }); };
    ((I && I.projects ? I.projects() : []) || []).forEach(function (p) { add(p && p.ncodes); });
    try { add((JSON.parse(localStorage.getItem('dcn.tool') || '{}') || {}).ncodes); } catch (e) {}
    csave('t', M);
  }
  function clist(w, key, p) { var L = (cmap(w)[key] || []).slice(); if (w === 't' && !cmig()) ((p && p.ncodes && p.ncodes[key]) || []).forEach(function (y) { if (!L.some(function (z) { return z[0] === y[0]; })) L.push(y); }); return L; }
  function owns(p, key) { cmigrate(); var L = clist('t', key, p); clist('m', key).forEach(function (y) { if (!L.some(function (z) { return z[0] === y[0]; })) L.push(y); }); return L; }
  function addCode(key, c, m, w) { w = w || (canT() ? 't' : 'm'); var M = JSON.parse(JSON.stringify(cmap(w))), L = (M[key] || []).filter(function (y) { return y[0] !== c; }); L.push([c, m || '']); M[key] = L.slice(-200); return csave(w, M); }
  function okey(key) { var x = OWNK.filter(function (y) { return y[0] === key; })[0]; return x ? k(x[1], x[2]) : key; }
  /* delete one own code: asked first, Undo for a while (JP 2026-11-25 "an option to delete something I made myself"); a file already named with it keeps its name */
  function codeDel(w, key, c) {
    var go = function () { var M0 = cmap(w), M = JSON.parse(JSON.stringify(M0)); if (!M[key]) return; M[key] = M[key].filter(function (y) { return y[0] !== c; }); csave(w, M); draw(); if (document.querySelector('.dcn-codes')) codesPop(key);
      toast('<i class="bi bi-trash3"></i> ' + esc(k('ui.dcn-codes-gone', '{c} deleted', { c: c })), function () { csave(w, JSON.parse(JSON.stringify(M0))); draw(); if (document.querySelector('.dcn-codes')) codesPop(key); }); };
    (window.Ask ? window.Ask.confirm(k('ui.dcn-codes-sure', 'Delete {c} from the list? Files already named with it keep their names.', { c: c }), { danger: true, ok: k('ui.delete', 'Delete') }) : Promise.resolve(true)).then(function (ok) { if (ok) go(); });
  }
  /* "Edit own codes …" in every list: the team's codes (changed by whoever may) and your own, a pen and a bin on each, a field to add */
  var CED = '';
  function codesPop(key) {
    var old = document.querySelector('.dcn-codes'); if (old) { if (old.__close) old.__close(); else old.remove(); }   /* a popup opened again closes the old one properly (its Escape listener too) */
    var ov = document.createElement('div'), team = cstore() === 'team'; ov.className = 'dcn-ov dc-host dcn-codes';
    var row = function (w, y) { var id = w + ':' + y[0], can = w === 'm' || canT();
      if (CED === id) return '<li class="dcn-cdr ed"><input data-cdc maxlength="40" value="' + esc(y[0]) + '" aria-label="' + esc(k('ui.dcn-own-c', 'Code or text, e.g. E2')) + '"><input data-cdm maxlength="60" value="' + esc(y[1] || '') + '" placeholder="' + esc(k('ui.dcn-own-m', 'What it means (optional)')) + '" aria-label="' + esc(k('ui.dcn-own-m', 'What it means (optional)')) + '"><span class="dcn-b"><button type="button" class="pill-btn sm" data-cdsave="' + esc(id) + '">' + esc(k('ui.save', 'Save')) + '</button><button type="button" class="pill-btn sm ghost" data-cdcan>' + esc(k('ui.cancel', 'Cancel')) + '</button></span></li>';
      return '<li class="dcn-cdr"><span class="dcn-cdt"><b data-noi18n>' + esc(y[0]) + '</b>' + (y[1] ? '<small class="muted" data-noi18n>' + esc(y[1]) + '</small>' : '') + '</span>' + (can ? '<span class="dcn-b"><button type="button" class="icon-btn sm" data-cded="' + esc(id) + '" aria-label="' + esc(k('ui.edit', 'Edit')) + ' ' + esc(y[0]) + '"><i class="bi bi-pencil"></i></button><button type="button" class="icon-btn sm" data-cddel="' + esc(id) + '" aria-label="' + esc(k('ui.delete', 'Delete')) + ' ' + esc(y[0]) + '"><i class="bi bi-trash3"></i></button></span>' : '') + '</li>'; };
    var sec = function (w, title, note, empty) { var L = clist(w, key); return '<p class="dcn-cdh"><b>' + esc(title) + '</b>' + (note ? '<small class="muted">' + esc(note) + '</small>' : '') + '</p>' + (L.length ? '<ul class="dcn-cdl">' + L.map(function (y) { return row(w, y); }).join('') + '</ul>' : '<p class="muted dc-help">' + esc(empty) + '</p>'); };
    var render = function () {
      var tw = canT() ? 't' : 'm';
      ov.innerHTML = '<div class="dcn-sheet dcn-cds" role="dialog" aria-modal="true" aria-label="' + esc(k('ui.dcn-codes-h', 'Own codes – {f}', { f: okey(key) })) + '"><div class="dcn-shead"><b>' + esc(k('ui.dcn-codes-h', 'Own codes – {f}', { f: okey(key) })) + '</b><button type="button" class="icon-btn" data-cdx aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
        (team ? sec('t', k('ui.dcn-codes-team', 'The team’s codes'), canT() ? k('ui.dcn-codes-team-s', 'Everyone in the team sees these') : k('ui.dcn-codes-team-ro', 'Everyone sees these – only the ones allowed to change the list can'), k('ui.dcn-codes-none', 'None yet.')) +
          (!canT() || clist('m', key).length ? sec('m', k('ui.dcn-codes-mine', 'My codes'), k('ui.dcn-codes-mine-s', 'Only you see these – for what the team’s list doesn’t have'), k('ui.dcn-codes-none', 'None yet.')) : '')   /* whoever keeps the team's list adds there – no empty "My codes" (JP 2026-11-25) */
          : sec('t', k('ui.dcn-own-codes', 'Your codes'), '', k('ui.dcn-codes-none', 'None yet.'))) +
        '<div class="dcn-cdadd"><input data-cdnc maxlength="40" placeholder="' + esc(k('ui.dcn-own-c', 'Code or text, e.g. E2')) + '" aria-label="' + esc(k('ui.dcn-own-c', 'Code or text, e.g. E2')) + '"><input data-cdnm maxlength="60" placeholder="' + esc(k('ui.dcn-own-m', 'What it means (optional)')) + '" aria-label="' + esc(k('ui.dcn-own-m', 'What it means (optional)')) + '">' +
        '<button type="button" class="pill-btn" data-cdadd><i class="bi bi-plus-lg"></i> ' + esc(team ? (tw === 't' ? k('ui.dcn-codes-add-t', 'Add to the team’s codes') : k('ui.dcn-codes-add-m', 'Add to my codes')) : k('ui.dcn-own-addb', 'Add')) + '</button></div>' +
        '<p class="muted dc-help">' + esc(k('ui.dcn-codes-help', 'A file already named with a code keeps its name when you change or delete the code.')) + '</p></div>';
      if (window.I18N && I18N.apply) try { I18N.apply(ov); } catch (e) {}
    };
    var close = function () { ov.remove(); CED = ''; document.removeEventListener('keydown', ek, true); document.documentElement.classList.toggle('dcn-modal', !!document.querySelector('.dcn-ov, .dx-tov')); };
    ov.__close = close;
    var ek = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    var dn = null; ov.addEventListener('pointerdown', function (e) { dn = e.target; });
    ov.addEventListener('click', function (e) {
      var t = e.target, b;
      if ((t === ov && dn === ov) || t.closest('[data-cdx]')) { close(); return; }
      if ((b = t.closest('[data-cded]'))) { CED = b.dataset.cded; render(); var i0 = ov.querySelector('[data-cdc]'); if (i0) i0.focus(); return; }
      if (t.closest('[data-cdcan]')) { CED = ''; render(); return; }
      if ((b = t.closest('[data-cddel]'))) { var dd = b.dataset.cddel.split(':'); codeDel(dd[0], key, dd.slice(1).join(':')); return; }
      if ((b = t.closest('[data-cdsave]'))) { var sv = b.dataset.cdsave.split(':'), w = sv[0], was = sv.slice(1).join(':'), li = b.closest('li'), nc = nclean(li.querySelector('[data-cdc]').value).slice(0, 40), nm = li.querySelector('[data-cdm]').value.trim().slice(0, 60);
        if (!nc) { li.querySelector('[data-cdc]').focus(); return; }
        var M = JSON.parse(JSON.stringify(cmap(w))); M[key] = (M[key] || []).map(function (y) { return y[0] === was ? [nc, nm] : y; }).filter(function (y, i, a) { return a.findIndex(function (z) { return z[0] === y[0]; }) === i; }); csave(w, M); CED = ''; render(); draw(); return; }
      if (t.closest('[data-cdadd]')) { var ni = ov.querySelector('[data-cdnc]'), nc2 = nclean(ni.value).slice(0, 40), nm2 = ov.querySelector('[data-cdnm]').value.trim().slice(0, 60); if (!nc2) { ni.focus(); return; } addCode(key, nc2, nm2); render(); draw(); var n1 = ov.querySelector('[data-cdnc]'); if (n1) n1.focus(); return; }
    });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('[data-cdnc], [data-cdnm]')) { e.preventDefault(); var ab = ov.querySelector('[data-cdadd]'); if (ab) ab.click(); } else if (e.key === 'Enter' && e.target.matches('[data-cdc], [data-cdm]')) { e.preventDefault(); var sb = ov.querySelector('[data-cdsave]'); if (sb) sb.click(); } });
    render(); document.addEventListener('keydown', ek, true); document.body.appendChild(ov); document.documentElement.classList.add('dcn-modal');
    return ov;
  }
  function ownMean(p, key, x) { var o = owns(p, key).filter(function (y) { return y[0] === x; })[0]; return o ? o[1] || '' : ''; }
  var nown = '';
  function ownOpts(p, key, v, known) {
    cmigrate();
    var team = cstore() === 'team', T = clist('t', key, p).filter(function (y) { return known.indexOf(y[0]) < 0; }), M = clist('m', key).filter(function (y) { return known.indexOf(y[0]) < 0 && !T.some(function (z) { return z[0] === y[0]; }); }), O = T.concat(M);
    var free = v && known.indexOf(v) < 0 && !O.some(function (y) { return y[0] === v; }), o = function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === v ? ' selected' : '') + '>' + esc(x[0] + (x[1] ? ' – ' + x[1] : '')) + '</option>'; };
    var g = function (lab, L) { return L.length ? '<optgroup label="' + esc(lab) + '">' + L.map(o).join('') + '</optgroup>' : ''; };
    return (team ? g(k('ui.dcn-codes-team', 'The team’s codes'), T) + g(k('ui.dcn-codes-mine', 'My codes'), M) : g(k('ui.dcn-own-codes', 'Your codes'), O)) + (free ? '<option value="' + esc(v) + '" selected>' + esc(v) + '</option>' : '') +
      '<option value="__own">' + esc(k('ui.dcn-own-add', '+ Own code or free text …')) + '</option><option value="__ownedit">' + esc(k('ui.dcn-codes-edit', 'Edit own codes …')) + '</option>';
  }
  function ownForm(fid, key) {
    return '<div class="dcn-ownf" data-dcnownf="' + esc(fid + ':' + key) + '"><b>' + esc(k('ui.dcn-own-t', 'Own code or free text')) + '</b>' +
      '<input data-dcnoc maxlength="40" placeholder="' + esc(k('ui.dcn-own-c', 'Code or text, e.g. E2')) + '" aria-label="' + esc(k('ui.dcn-own-c', 'Code or text, e.g. E2')) + '">' +
      '<input data-dcnom maxlength="60" placeholder="' + esc(k('ui.dcn-own-m', 'What it means (optional)')) + '" aria-label="' + esc(k('ui.dcn-own-m', 'What it means (optional)')) + '">' +
      '<label class="dcn-req"><input type="checkbox" data-dcnor checked> ' + esc(k('ui.dcn-own-keep', 'Keep it in the list for later')) + '</label>' +
      '<span class="dcn-b"><button type="button" class="pill-btn dx-pri" data-dcnosave><i class="bi bi-check2"></i> ' + esc(k('ui.dcn-own-use', 'Use it')) + '</button><button type="button" class="text-btn" data-dcnocan>' + esc(k('ui.cancel', 'Cancel')) + '</button></span></div>';
  }
  /* a first guess when the name doesn't say: the discipline from the NS 3451 code, the drawing type from words in the name */
  function guessDisc(code) { var c = String(code || ''); return /^62/.test(c) ? 'H' : /^2/.test(c) ? 'B' : /^3/.test(c) ? 'V' : /^4/.test(c) ? 'E' : /^5/.test(c) ? 'T' : /^7/.test(c) ? 'L' : ''; }
  function guessDtype(n) { var t = String(n || '').toLowerCase(); return /snitt|section/.test(t) ? 'S' : /fasade|facade/.test(t) ? 'F' : /detalj|detail/.test(t) ? 'D' : /oppriss|elevation/.test(t) ? 'O' : /skjema|prinsipp|schematic|diagram/.test(t) ? 'T' : /utomhus|terreng|utendørs|site plan/.test(t) ? 'U' : /utsparing|hulltaking|bygningsmessig/.test(t) ? 'B' : /plan|rørplan|planteg/.test(t) ? 'P' : ''; }
  var NPART = { code: ['ui.dcn-p-code', 'NS 3451 code'], type: ['ui.dcn-p-type', 'Document type (letters)'], typename: ['ui.dcn-p-typename', 'Document type (name)'], proj: ['ui.dcn-p-proj', 'Project number'],
    bno: ['ui.dcn-p-bno', 'Building number'], unit: ['ui.dcn-p-unit', 'Property ID'], pname: ['ui.dcn-p-pname', 'Property name'], contractor: ['ui.dcn-p-contractor', 'Contractor', 1], desc: ['ui.dcn-p-desc', 'Description', 1],
    floor: ['ui.dcn-p-floor', 'Floor', 1], disc: ['ui.dcn-p-disc', 'Discipline', 1], dtype: ['ui.dcn-p-dtype', 'Drawing type', 1], room: ['ui.dcn-p-room', 'Flat or room number', 1], free: ['ui.dcn-p-free', 'Free text', 1], rev: ['ui.dcn-p-rev', 'Revision', 1],
    date: ['ui.dcn-p-date', 'Date'], run: ['ui.dcn-p-run', 'Running number'], text: ['ui.dcn-p-text', 'Fixed text'] };
  function partName(key) { var q = NPART[key]; return q ? k(q[0], q[1]) : key; }
  var NSEP = [[' ', 'ui.dcn-sep-space', 'Space'], ['-', 'ui.dcn-sep-hyphen', 'Hyphen -'], ['_', 'ui.dcn-sep-under', 'Underscore _'], ['–', 'ui.dcn-sep-dash', 'Dash –'], [' – ', 'ui.dcn-sep-sdash', 'Dash with spaces " – "'], ['', 'ui.dcn-sep-none', 'Nothing']];
  /* Boligbygg's three (FDVU spec 4.5.3, table 3 and tables 6–11) – built in, copied to make your own; no 30-character limit (JP) */
  var NRULES = [{ id: 'bby-doc', b: 1, n: ['ui.dcn-r-doc', 'Documents'], sep: ' ', cs: 'keep', parts: [{ k: 'code' }, { k: 'type' }, { k: 'desc' }] },
    { id: 'bby-photo', b: 1, n: ['ui.dcn-r-photo', 'Photos'], sep: '–', cs: 'keep', parts: [{ k: 'unit' }, { k: 'floor' }, { k: 'room' }, { k: 'free' }, { k: 'date', fmt: 'iso' }] },
    { id: 'bby-dwg', b: 1, n: ['ui.dcn-r-dwg', 'Drawings as built'], sep: '-', cs: 'keep', parts: [{ k: 'bno' }, { k: 'floor' }, { k: 'disc' }, { k: 'code' }, { k: 'dtype' }, { k: 'run' }, { k: 'desc', pre: ' – ' }] }];
  var NDEF = { doc: 'bby-doc', photo: 'bby-photo', drawing: 'bby-dwg' };
  function nrules(p) { return NRULES.concat((p && p.nrules) || []); }
  function nrule(p, id) { return nrules(p).filter(function (r) { return r.id === id; })[0] || null; }
  function rname(r) { return r.b ? k(r.n[0], r.n[1]) : r.n; }
  function fkind(f) { if (f.nk) return f.nk; var e = (String(f.name).match(/\.([a-z0-9]{2,5})$/i) || ['', ''])[1].toLowerCase(); if (/^(jpe?g|png|heic|heif|webp|gif)$/.test(e)) return 'photo'; return f.p && f.p.kind === 'drawing' || /^(dwg|dxf|ifc)$/.test(e) ? 'drawing' : 'doc'; }
  function ruleFor(p, f) { var u = (p.nuse || {})[fkind(f)]; return nrule(p, u) || nrule(p, NDEF[fkind(f)]); }
  function ext(n) { return (String(n).match(/(\.[a-z0-9]{2,5})$/i) || ['', ''])[1].toLowerCase(); }
  function drawn(f) { var m = String(f.orig || f.name).replace(/\.[a-z0-9]{2,5}$/i, '').match(TEG); return m ? { floor: m[2], disc: m[3], dtype: m[5] } : {}; }
  /* guesses that save typing (JP 2026-11-24): the free text starts as the old file name, a photo's floor as the last one you picked */
  function lc1(t) { t = String(t || ''); return /^[A-ZÆØÅ0-9]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1); }   /* a field name inside a sentence: floor, property ID – NS 3451 and ID keep their capitals (JP 2026-11-24) */
  function freeGuess(f) { var n = String(f.orig || f.name).replace(/\.[a-z0-9]{2,5}$/i, ''); return /^(img|dsc|pxl|photo|image|bilde|untitled|uten navn)[\s_-]*\d*$/i.test(n) ? '' : n.replace(/[_]+/g, ' ').trim().slice(0, 60); }
  function lastFloor() { try { return localStorage.getItem('dcn.floor') || ''; } catch (e) { return ''; } }
  /* the day a photo was taken: the earliest EXIF date in its first 256 kB (DateTimeOriginal is never later than an edit date), else the file's own date */
  function photoDate(blob) { return blob.slice(0, 262144).arrayBuffer().then(function (ab) { var t = new TextDecoder('latin1').decode(new Uint8Array(ab)), rx = /(19|20)(\d{2}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}/g, m, best = ''; while ((m = rx.exec(t))) { var d = m[1] + m[2] + '-' + m[3] + '-' + m[4]; if (+m[3] >= 1 && +m[3] <= 12 && +m[4] >= 1 && +m[4] <= 31 && (!best || d < best)) best = d; } return best; }).catch(function () { return ''; }); }
  function nval(p, f, part) {
    var v = f.nv || {}, d = drawn(f), x;
    switch (part.k) {
      case 'code': return f.p && f.p.code || ''; case 'type': return f.p && f.p.abbr || ''; case 'typename': return catName(f.p && f.p.abbr) || ownMean(p, 'type', f.p && f.p.abbr);
      case 'proj': return p.no || ''; case 'bno': return p.bid || ''; case 'unit': return p.pid || ''; case 'pname': return p.pname || '';
      case 'contractor': return v.contractor != null ? v.contractor : p.who || '';
      case 'desc': return v.desc != null ? v.desc : f.p && f.p.text || '';
      case 'floor': case 'disc': case 'dtype': return v[part.k] != null ? v[part.k] : d[part.k] || (part.k === 'disc' ? guessDisc(f.p && f.p.code) : part.k === 'dtype' ? guessDtype(f.orig || f.name) : part.k === 'floor' && fkind(f) === 'photo' ? lastFloor() : '');
      case 'free': return v.free != null ? v.free : freeGuess(f);
      case 'rev': x = String(v.rev || '').trim(); return x ? 'Rev' + x : '';
      case 'date': var dd = f.dt || (fkind(f) === 'photo' ? f.lm : '') || '', t = /^\d{4}-\d{2}-\d{2}$/.test(dd) ? new Date(dd + 'T12:00:00') : new Date(), y = t.getFullYear(), mo = pad(t.getMonth() + 1), da = pad(t.getDate());   /* the day the photo was taken (or the file's own date) when known (JP 2026-11-24) */ return part.fmt === 'compact' ? '' + y + mo + da : part.fmt === 'no' ? da + '.' + mo + '.' + y : y + '-' + mo + '-' + da;
      case 'run': var n = 0, kd = fkind(f), c = f.p && f.p.code; (p.files || []).some(function (o) { if (fkind(o) === kd && (o.p && o.p.code) === c) n++; return o.id === f.id; }); return pad(Math.max(1, n));
      case 'text': return part.text || '';
      default: return v[part.k] || '';
    }
  }
  /* the closest codes / types from the text as buttons you can pick (JP 2026-11-17) */
  function pick(f, key, L) { return ' ' + L.map(function (x) { var on = key === 'code' ? String(f.p.code || '').slice(0, 3) === x : f.p.abbr === x; return '<button type="button" class="dc-chip dcn-pk' + (on ? ' on' : '') + '" data-dcnpick="' + esc(f.id + '|' + key + '|' + x) + '" aria-pressed="' + on + '">' + esc(x + (key === 'code' ? ' ' + (codeName(x) || '') : ' · ' + catName(x))) + '</button>'; }).join(''); }
  function nclean(s) { return String(s).replace(/[\/\\:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim(); }
  /* the name a rule gives this file: plain text, the parts still missing, and HTML with the gaps marked */
  function nbuild(p, f, r) {
    r = r || ruleFor(p, f); var segs = [], miss = [];
    r.parts.forEach(function (q) {
      var v = nclean(nval(p, f, q)); if (v && r.cs === 'upper') v = v.toUpperCase(); else if (v && r.cs === 'lower') v = v.toLowerCase();
      if (!v) { if (q.req === false) return; miss.push(q.k); segs.push({ q: q, v: '‹' + lc1(partName(q.k)) + '›', gap: 1 }); return; }
      segs.push({ q: q, v: v });
    });
    var plain = '', html = '';
    segs.forEach(function (s, i) { var sep = i ? (s.q.pre != null ? s.q.pre : r.sep) : ''; plain += sep + s.v; html += esc(sep) + (s.gap ? '<i class="dcn-gap">' + esc(s.v) + '</i>' : esc(s.v)); });
    return { plain: plain, html: html, miss: miss };
  }

  /* ---------- guesses: words that point to a type or an NS 3451 code (2022 numbers), in a file name or a PDF's text ---------- */
  var TKW = { SE: [['samsvarserklæring', 6], ['declaration of conformity', 6], ['eu declaration', 5], ['samsvar', 4], ['konformitet', 4], ['we hereby declare', 4], ['erklærer at', 3]],
    DA: [['produktdatablad', 6], ['datablad', 6], ['data sheet', 6], ['datasheet', 6], ['technical data', 4], ['tekniske data', 4], ['produktblad', 4]],
    DV: [['fdv', 4], ['drift og vedlikehold', 6], ['driftsinstruks', 6], ['vedlikeholdsinstruks', 6], ['brukerveiledning', 5], ['bruksanvisning', 5], ['monteringsanvisning', 3], ['installation manual', 3], ['user manual', 5], ['operating instructions', 5], ['maintenance', 2], ['vedlikehold', 2]],
    FB: [['funksjonsbeskrivelse', 7], ['systembeskrivelse', 6], ['function description', 6], ['functional description', 6]],
    PK: [['testprotokoll', 6], ['protokoll', 4], ['igangkjøring', 3], ['garantibevis', 5], ['garanti', 3], ['warranty', 3]],
    PL: [['opplæringsplan', 6], ['kvalitetsplan', 5], ['fremdriftsplan', 5]], PR: [['prosedyre', 4], ['rutinebeskrivelse', 4]], RA: [['beregning', 3], ['rapport', 2]], SK: [['skjema', 3]], LI: [['dokumentplan', 6], ['tegningsliste', 6]] };
  var CKW = { 332: ['sprinkler'], 337: ['håndslukker', 'brannslukker', 'brannslange'], 542: ['brannalarm', 'branndetektor', 'røykdetektor', 'brannsentral', 'fire alarm', 'smoke detector'],
    621: ['heis', 'elevator'], 625: ['trappeheis'], 365: ['ventilasjonsaggregat', 'aggregat', 'air handling', 'varmegjenvinner', 'gjenvinner', 'kanalvifte', 'takvifte', 'vifte'],
    364: ['tilluftsventil', 'avtrekksventil', 'luftfordeling', 'diffusor'], 362: ['kanalsystem', 'spjeld', 'damper', 'spirokanal'], 442: ['lysarmatur', 'armatur', 'belysning', 'luminaire', 'downlight', 'taklampe'],
    443: ['nødlys', 'ledelys', 'emergency light'], 433: ['sikringsskap', 'el-tavle', 'fordelingstavle', 'stikkontakt', 'jordfeilbryter'], 436: ['ladestasjon', 'elbillader', 'ladeboks'],
    314: ['blandebatteri', 'termostatventil'], 315: ['servant', 'toalett', 'klosett', 'dusj', 'varmtvannsbereder', 'bereder'], 312: ['vannrør', 'tappevann', 'rør-i-rør', 'avløpsrør'],
    322: ['gulvvarme', 'varmerør', 'vannbåren'], 325: ['radiator', 'varmepumpe'], 234: ['vindu', 'vinduer', 'window', 'ytterdør', 'balkongdør'], 244: ['innerdør', 'innvendig dør'],
    235: ['utvendig treverk', 'oljemaling', 'dekkbeis', 'fasademaling', 'utvendig kledning', 'trekledning', 'utvendig overflate'], 262: ['takbelegg', 'taktekking', 'takpapp', 'roof membrane'], 263: ['røykluke', 'takluke', 'takvindu'], 273: ['kjøkkeninnredning'], 274: ['baderomsinnredning', 'våtromsinnredning'] };
  function cnt(t, w) { var n = 0, i = 0; if (!t) return 0; while ((i = t.indexOf(w, i)) >= 0) { n++; i += w.length; } return n; }
  /* a code word counts as the whole word or the END of a compound, with Norwegian/English endings: "kanalvifte", "vifter" yes –
     "viftevinkel" (a spray gun's fan angle in a paint datasheet) no: in a compound the last part says what the thing is (JP 2026-11-19) */
  var RXC = {};
  function cntW(t, w) { if (!t) return 0; var rx = RXC[w] || (RXC[w] = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:e|er|en|ene|et|a|s|ne|r|n|ar|ane)?(?![a-zæøåäöü])', 'g')), m = t.match(rx); return m ? m.length : 0; }
  function scoreKw(tab, text, first, words) {
    var out = []; Object.keys(tab).forEach(function (key) { var sc = 0, hits = [];
      tab[key].forEach(function (e) { var w = typeof e === 'string' ? e : e[0], wt = typeof e === 'string' ? 3 : e[1], f = words ? cntW : cnt, n = f(text, w), p1 = f(first, w); if (n) { sc += wt * Math.min(n, 4) + (p1 ? wt * 2 : 0); hits.push([w, n, p1 > 0]); } });
      if (sc) out.push({ k: key, s: sc, h: hits.sort(function (a, b) { return b[1] - a[1]; }) }); });
    return out.sort(function (a, b) { return b.s - a.s; });
  }
  function scoreCodes(text, first) {
    var s = scoreKw(CKW, text, first, 1), s2 = scoreKw(nsKw(), text, first, 1), re = /(?:^|[\s=+])(\d{3})\.\d{3}\b/g, m, tf = {};   /* TFM tags (=332.001) */
    s2.forEach(function (y) { var e = s.filter(function (x) { return x.k === y.k; })[0]; if (e) { e.s += y.s; e.h = e.h.concat(y.h); } else s.push(y); });
    while ((m = re.exec(text))) tf[m[1]] = (tf[m[1]] || 0) + 1;
    Object.keys(tf).forEach(function (c) { var e = s.filter(function (x) { return x.k === c; })[0], hit = ['TFM ' + c + '.xxx', tf[c], false]; if (e) { e.s += 8 * Math.min(tf[c], 3); e.h.unshift(hit); } else s.push({ k: c, s: 8 * Math.min(tf[c], 3), h: [hit] }); });
    return s.sort(function (a, b) { return b.s - a.s; });
  }
  /* ---------- better code suggestions (JP 2026-11-19): your names from the standard as words, codes learned from your choices, two options when unsure ---------- */
  var STOPW = ' andre annet øvrige øvrig generelt generell felles diverse system systemer anlegg anlegget utstyr deler delen bygning bygninger installasjoner installasjon komponenter ' +
    'tilhørende inklusive spesielle spesiell eventuelt komplett komplette other general common including ';
  var NKW = null, NKWk = '';
  function nsKw() {   /* each code's name split into words (5+ letters); a word that is in 4 or more codes' names says too little to count */
    var all = Object.assign({}, nsNames(), LP && LP.ownMap ? LP.ownMap() : {}), key = Object.keys(all).length + ':' + JSON.stringify(all).length;
    if (NKW && NKWk === key) return NKW;
    var per = {}, df = {};
    Object.keys(all).forEach(function (c) { if (!/^\d{3,4}$/.test(c)) return; var k3 = c.slice(0, 3);
      String(all[c] || '').toLowerCase().split(/[^a-zæøåäöü]+/).forEach(function (w) { if (w.length < 5 || STOPW.indexOf(' ' + w + ' ') >= 0) return; per[k3] = per[k3] || {}; if (!per[k3][w]) { per[k3][w] = 1; df[w] = (df[w] || 0) + 1; } }); });
    NKW = {}; Object.keys(per).forEach(function (k3) { var L = Object.keys(per[k3]).filter(function (w) { return df[w] < 4; }).map(function (w) { return [w, 1]; });   /* a word from a name counts less than a hand-picked code word (fasade in “Fasade- og takvask” must not beat oljemaling – JP 2026-11-19) */ if (L.length) NKW[k3] = L; });
    NKWk = key; return NKW;
  }
  /* ---------- suggestions that keep learning (JP 2026-11-25 16:28–16:56 "a system that learns and learns") ----------
     Every finished file is a lesson: its clues (words of its name, the maker/product the PDF text gave, document words in any language,
     the file type) → the code and type it ended with. A kept suggestion is a vote, a changed one weakens the old answer; an approved
     line counts double, "Not approved" weakens. One vote is only a hint; a few make it the suggestion; old votes fade over a year.
     Where it's kept: cmd – your tools (fdvlearn); Team – your own votes (an `lrn` record only you and admins receive) and the team's
     finished rules (cfglearn: clue → code/type, no counts, made by whoever keeps the code template – JP). Only JP (canT) sees what it
     learned and why; the others get the suggestion with a neutral reason. Rules only – never file names, text or files. */
  var LKEY = 'dcn.nslearn', LRN = null, LRNt = null, LDAY = function () { return Math.floor(Date.now() / 864e5); };
  var NOTW = /^(pdf|docx?|xlsx?|dwg|nor|nob|eng|tds|fdvu|teknisk|technical|data|sheet|produkt|product|dokument|document|versjon|version|norsk|english|final|ferdig|kopi|copy|scan|skann|sverige|norge|danmark|rev|side|page)$/;
  /* the same document in Norwegian, Swedish, Danish and English, with or without æøå – one clue (JP 16:56) */
  var SYN = [['#se', /samsvarserkl|samsvars?erkl|forsakran om overensstammelse|overensstemmelseserkl|overensstemmelse|declaration of conformity|eu.?declaration|konformitetserkl|\bdoc\b/],
    ['#dop', /ytelseserkl|prestandadeklaration|ydeevnedeklaration|declaration of performance|\bdop\b/],
    ['#mont', /monteringsanvisning|montageanvisning|monteringsvejledning|installasjonsveiledning|installationsanvisning|installation (manual|instructions?)|monteringsveiledning/],
    ['#fdv', /\bfdv\b|drift og vedlikehold|driftsinstruks|vedlikeholdsinstruks|skotselanvisning|drift och underhall|drift og vedligehold|o&m|operation and maintenance|maintenance manual/],
    ['#data', /produktdatablad|produktblad|datablad|datasheet|data sheet|tekniske? data|technical data|produktinformation|produktinformasjon/],
    ['#bruk', /brukerveiledning|bruksanvisning|bruksanvisning|brugsanvisning|user manual|user guide|bruksveiledning/],
    ['#tegn', /tegning|ritning|drawing|som bygget|as.?built|plantegning/], ['#gar', /garanti|warranty|guarantee/], ['#sert', /sertifikat|certifikat|certificate|intyg|attest/],
    ['#test', /testrapport|testprotokoll|protokoll|innregulering|injustering|commissioning/], ['#brann', /brann|fire|brand/]];
  function fold(t) { return String(t || '').toLowerCase().replace(/æ/g, 'ae').replace(/[øö]/g, 'o').replace(/[åä]/g, 'a').replace(/ü/g, 'u').replace(/é/g, 'e'); }
  function stemW(w) { return w.length > 6 ? w.replace(/(erne|ene|ane|ene|er|ar|en|et|s)$/, '') : w; }
  function lwords(name) { var seen = {}; return fold(name).replace(/\.[a-z0-9]{2,5}$/, '').split(/[^a-z]+/).filter(function (w) { if (w.length < 4 || NOTW.test(w) || STOPW.indexOf(' ' + w + ' ') >= 0) return false; w = stemW(w); if (seen[w]) return false; seen[w] = 1; return true; }).map(stemW).slice(0, 8); }
  /* the clues of a file: [clue, kind] – n name word, d maker/product from the text, s document word (the file type says too little to count) */
  function clues(f) {
    var nm = f.orig || f.name, out = [], seen = {}, add = function (c, kd) { if (c && !seen[c]) { seen[c] = 1; out.push([c, kd]); } };
    lwords(nm).forEach(function (w) { add(w, 'n'); });
    if (f.cc && f.cc.d) lwords(f.cc.d).forEach(function (w) { add(w, 'd'); });
    var txt = fold(nm + ' ' + (f.cc && f.cc.d || '') + ' ' + (ccText[f.id] || '').slice(0, 1500));
    SYN.forEach(function (x) { if (x[1].test(txt)) add(x[0], 's'); });
    return out.slice(0, 14);
  }
  function lrnWhere() { return HOST && HOST.learn ? 'team' : !HOST && window.Features && window.Features.tools ? 'me' : 'here'; }
  function lNorm(o) {   /* older shape {w: {word: {code: n}}} → {w: {clue: {c, t, a}}} */
    o = o && o.w ? o : { w: {} }; var d = LDAY();
    Object.keys(o.w).forEach(function (x) { var e = o.w[x]; if (e && !e.c && !e.t) o.w[x] = { c: e, t: {}, a: d }; });
    o.v = 2; o.k = o.k || 0; o.x = o.x || 0; o.cf = o.cf || {}; o.tr = o.tr || {}; return o;
  }
  function lrnGet() {   /* your own votes */
    var w = lrnWhere();
    if (w === 'team') { var m = HOST.learn.mine(); if (!LRN || LRN.__src !== m) { LRN = lNorm(m ? JSON.parse(JSON.stringify(m)) : null); Object.defineProperty(LRN, '__src', { value: m, enumerable: false }); } return LRN; }
    if (LRN) return LRN;
    try { if (w === 'me') { var t = window.Features.tools(); LRN = lNorm(t.fdvlearn ? JSON.parse(JSON.stringify(t.fdvlearn)) : null); } else LRN = lNorm(JSON.parse(localStorage.getItem(LKEY) || 'null')); } catch (e) { LRN = lNorm(null); }
    return LRN;
  }
  var lSaveT = 0;
  function lrnSave() {
    var L = lrnGet(), d = LDAY(), W = Object.keys(L.w);
    W.forEach(function (x) { if (d - (L.w[x].a || d) > 365) delete L.w[x]; });   /* unused for a year: gone */
    W = Object.keys(L.w); if (W.length > 3000) W.sort(function (a, b) { return (L.w[a].a || 0) - (L.w[b].a || 0); }).slice(0, W.length - 3000).forEach(function (x) { delete L.w[x]; });
    var w = lrnWhere();
    if (w === 'team') { clearTimeout(lSaveT); lSaveT = setTimeout(function () { Promise.resolve(HOST.learn.saveMine(JSON.parse(JSON.stringify(L)))).then(function () { teamRules(); }); }, 1500); return; }
    if (w === 'me') { var Fe0 = window.Features, t = Fe0.tools(); t.fdvlearn = JSON.parse(JSON.stringify(L)); Fe0.saveTools(t); return; }
    try { localStorage.setItem(LKEY, JSON.stringify(L)); } catch (e) {}
  }
  /* the team's finished rules – worked out on JP's device from everyone's votes (his count fully, the others' half) */
  function teamRules() {
    if (lrnWhere() !== 'team' || !canT() || !HOST.learn.all) return;
    var tot = {}, d = LDAY();
    HOST.learn.all().forEach(function (v) { var o = lNorm(JSON.parse(JSON.stringify(v.o || {}))), wt = v.me ? 1 : 0.5;
      Object.keys(o.w).forEach(function (x) { var e = o.w[x], f = Math.pow(0.5, Math.max(0, d - (e.a || d)) / 365), T = tot[x] = tot[x] || { c: {}, t: {} };
        ['c', 't'].forEach(function (q) { Object.keys(e[q] || {}).forEach(function (y) { T[q][y] = (T[q][y] || 0) + e[q][y] * wt * f; }); }); }); });
    var r = {}; Object.keys(tot).forEach(function (x) { var c = top(tot[x].c), t = top(tot[x].t); if (c || t) r[x] = [c || '', t || '']; });
    var cur0 = HOST.learn.rules() || {}; if (JSON.stringify(cur0) !== JSON.stringify(r)) HOST.learn.saveRules(r);
  }
  function top(m) { var o = Object.keys(m || {}).sort(function (a, b) { return m[b] - m[a]; }); return o.length && m[o[0]] >= 3 && (!o[1] || m[o[0]] >= m[o[1]] * 2) ? o[0] : ''; }
  /* votes: the file's clues → its code and type (w: how much it counts; negative weakens) */
  function vote(f, code, abbr, w) {
    if (!f || fkind(f) === 'photo') return; var L = lrnGet(), d = LDAY(); w = w || 1;
    clues(f).forEach(function (cl) { var e = L.w[cl[0]] = L.w[cl[0]] || { c: {}, t: {}, a: d };
      if (d - (e.a || d) > 180) { ['c', 't'].forEach(function (q) { Object.keys(e[q]).forEach(function (y) { e[q][y] = e[q][y] / 2; }); }); }   /* old votes fade */
      e.a = d;
      if (/^\d{3}/.test(code || '')) { e.c[code] = Math.max(0, (e.c[code] || 0) + w); if (!e.c[code]) delete e.c[code]; }
      if (abbr) { e.t[abbr] = Math.max(0, (e.t[abbr] || 0) + w); if (!e.t[abbr]) delete e.t[abbr]; } });
    lrnSave();
  }
  /* a finished file (its final name, or "Looks right"): a lesson; a suggestion kept or changed is counted for the self-check */
  function teach(f, w) {
    if (!f || !f.p || fkind(f) === 'photo') return; var L = lrnGet();
    if (f.sgc) { if (f.sgc === f.p.code) { L.k++; trust(f.sgk, 1); } else { L.x++; trust(f.sgk, -1); } delete f.sgc; delete f.sgk; }
    L.n = (L.n || 0) + 1; vote(f, f.p.code, f.p.abbr, w || 1);
  }
  function trust(kd, d) { if (!kd) return; var L = lrnGet(), t = L.tr[kd] = L.tr[kd] || [0, 0]; t[d > 0 ? 0 : 1]++; }
  function trustOf(kd) { var t = lrnGet().tr[kd]; return t ? 0.5 + (t[0] + 1) / (t[0] + t[1] + 2) : 1; }
  /* a code you changed: the old answer weakens and the pair is remembered (mix-ups become a choice next time) */
  function learn(f, code) {
    if (!f || !/^\d{3}/.test(code || '')) return; var L = lrnGet();
    if (f.sgc && f.sgc !== code) { var pr = [f.sgc, code].sort().join('|'); L.cf[pr] = (L.cf[pr] || 0) + 1; vote(f, f.sgc, '', -1); L.x++; trust(f.sgk, -1); delete f.sgc; delete f.sgk; }
    vote(f, code, '', 1);
  }
  function learnT(f, abbr) { if (f && abbr) vote(f, '', abbr, 1); }
  /* what it has learned for a file: {k, s, w, hint, why} – own votes first (with their weight), then the team's rules */
  function lScore(f, q) {
    var L = lrnGet(), d = LDAY(), sc = {}, hit = {};
    clues(f).forEach(function (cl) { var e = L.w[cl[0]]; if (!e || !e[q]) return; var fd = Math.pow(0.5, Math.max(0, d - (e.a || d)) / 365), tw = trustOf(cl[1]);
      Object.keys(e[q]).forEach(function (y) { var v = e[q][y] * fd * tw; sc[y] = (sc[y] || 0) + v; if (!hit[y] || v > hit[y][1]) hit[y] = [cl[0], e[q][y]]; }); });
    if (lrnWhere() === 'team') { var R = HOST.learn.rules() || {}; clues(f).forEach(function (cl) { var r = R[cl[0]], y = r && r[q === 'c' ? 0 : 1]; if (y) { sc[y] = (sc[y] || 0) + 3; if (!hit[y]) hit[y] = [cl[0], 3]; } }); }
    var o = Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a]; });
    if (!o.length || sc[o[0]] < 0.9 || (o[1] && sc[o[0]] < sc[o[1]] * 2)) return null;
    return { k: o[0], s: sc[o[0]], w: hit[o[0]][0], n: Math.round(hit[o[0]][1]), hint: hit[o[0]][1] < 1.8 };   /* chosen once: only a hint; twice or more: the suggestion */
  }
  function learnedFor(f) { return typeof f === 'string' ? lScore({ name: f, p: {} }, 'c') : lScore(f, 'c'); }
  function learnedType(f) { return lScore(f, 't'); }
  /* the reason shown: JP sees why (the clue and how often), everyone else a neutral line (JP 16:34, 16:56) */
  function seeWhy() { return lrnWhere() !== 'team' || canT(); }
  function whyL(x) { if (!seeWhy()) return k('ui.dcn-why-team', 'Suggested from the team’s template'); var w = String(x.w || '').charAt(0) === '#' ? x.w.slice(1) : x.w; return x.n > 1 ? k('ui.dcn-why-learned-n', 'chosen {n}× for “{w}”', { n: x.n, w: w }) : k('ui.dcn-why-learned', 'learned from earlier choices (“{w}”)', { w: w }); }
  function whyHint(x) { return seeWhy() ? k('ui.dcn-why-last', 'chosen last time for “{w}”', { w: String(x.w).replace(/^#/, '') }) : k('ui.dcn-why-team', 'Suggested from the team’s template'); }
  /* mix-ups: a code often swapped with another is offered side by side */
  function mixFor(code) { var L = lrnGet(), out = ''; Object.keys(L.cf).forEach(function (pr) { var q = pr.split('|'); if (L.cf[pr] >= 2 && q.indexOf(code) >= 0) out = q[0] === code ? q[1] : q[0]; }); return out; }
  /* a line in the project's plan the file fits (planned name or title) – the strongest suggestion after a code in the name */
  function planMatch(p, f) {
    if (!p || !p.lines || !p.lines.length) return null; var mine = {}, n0 = 0;
    lwords((f.orig || f.name) + ' ' + (f.cc && f.cc.d || '')).forEach(function (w) { mine[w] = 1; n0++; }); if (n0 < 2) return null;
    var best = null, second = 0;
    p.lines.forEach(function (l) { if (!l.code || l.ex) return; var lw = lwords((l.planned || '') + ' ' + (l.sys || '')), hit = 0; lw.forEach(function (w) { if (mine[w]) hit++; }); if (!lw.length) return;
      var sc = hit / Math.min(lw.length, n0); if (hit >= 2 && sc >= 0.5) { if (!best || sc > best.s) { second = best ? best.s : second; best = { l: l, s: sc }; } else if (sc > second) second = sc; } });
    return best && best.s > second ? best.l : null;
  }
  function abbrOf(t) { if (!t) return ''; var A = ABBR || {}, o = Object.keys(A).filter(function (a) { return A[a] === t; })[0]; return o || Object.keys(A).filter(function (a) { return A[a] && A[a].indexOf(t.charAt(0)) >= 0; })[0] || ''; }
  /* the head start: once, quietly, everything already finished teaches it (files with their final names, approved lines, imported plans) */
  function headStart() {
    if (lrnWhere() === 'team' && !canT()) return; var L = lrnGet(); if (L.hs) return; L.hs = 1;
    var P = []; try { P = (I && I.projects ? I.projects() : []) || []; } catch (e) {}
    P.forEach(function (p) { if (!p) return;
      (p.files || []).forEach(function (f) { if (!f || !f.p || !f.p.code || fkind(f) === 'photo') return; var ln = f.line && (p.lines || []).filter(function (l) { return l.id === f.line; })[0];
        if (f.orig || (ln && ln.st === 'ok')) { var c = clues(f), d = LDAY(); c.forEach(function (cl) { var e = L.w[cl[0]] = L.w[cl[0]] || { c: {}, t: {}, a: d }, w = ln && ln.st === 'ok' ? 2 : 1; e.c[f.p.code] = (e.c[f.p.code] || 0) + w; if (f.p.abbr) e.t[f.p.abbr] = (e.t[f.p.abbr] || 0) + w; }); L.n = (L.n || 0) + 1; } });
      (p.lines || []).forEach(function (l) { if (!l.planned || l.ex || !/^\d{3}/.test(l.code || '')) return; var c = clues({ name: l.planned, p: {} }), d = LDAY(), ab = abbrOf(l.t); c.forEach(function (cl) { if (cl[1] === 'x') return; var e = L.w[cl[0]] = L.w[cl[0]] || { c: {}, t: {}, a: d }; e.c[l.code] = (e.c[l.code] || 0) + 1; if (ab) e.t[ab] = (e.t[ab] || 0) + 1; }); }); });
    if (lrnWhere() === 'team' && HOST.store) Promise.resolve(HOST.store.get('nslearn')).then(function (o) { if (o && o.w) { var d = LDAY(); Object.keys(o.w).forEach(function (x) { var e = o.w[x]; if (!e || e.c) return; var c = L.w[fold(x)] = L.w[fold(x)] || { c: {}, t: {}, a: d }; Object.keys(e).forEach(function (y) { c.c[y] = (c.c[y] || 0) + e[y]; }); }); } lrnSave(); }).catch(function () { lrnSave(); });
    else lrnSave();
  }
  /* an approved line teaches double; "Not approved" weakens what its files were given */
  function approved(p, l, ok) { if (!p || !l) return; (l.files || []).forEach(function (id) { var f = (p.files || []).filter(function (x) { return x.id === id; })[0]; if (f && f.p && f.p.code) vote(f, f.p.code, f.p.abbr, ok ? 2 : -1); }); }
  /* a set: files from the same delivery with the same maker/product get the code one of them has */
  function sets(p, ids) {
    if (!ids || ids.length < 2) return 0;   /* a set is files that came in together */
    var F = (p.files || []).filter(function (f) { return !f.nf && fkind(f) !== 'photo' && ids.indexOf(f.id) >= 0; }), by = {};
    F.forEach(function (f) { if (!f.p.code || (f.sg && f.sg.alt)) return; clues(f).forEach(function (cl) { if (cl[1] === 'd' || cl[1] === 'n') (by[cl[0]] = by[cl[0]] || {})[f.p.code] = 1; }); });
    var n = 0; F.forEach(function (f) { if (f.p.code) return; var got = {};
      clues(f).forEach(function (cl) { if ((cl[1] === 'd' || cl[1] === 'n') && by[cl[0]] && Object.keys(by[cl[0]]).length === 1) { var c = Object.keys(by[cl[0]])[0]; got[c] = (got[c] || 0) + 1; } });
      var o = Object.keys(got).sort(function (a, b) { return got[b] - got[a]; }); if (o.length && got[o[0]] >= 2 && (!o[1] || got[o[0]] > got[o[1]])) { f.p.code = o[0]; f.sgc = o[0]; f.sgk = 'n'; f.sg = Object.assign({}, f.sg, { c: seeWhy() ? k('ui.dcn-why-set', 'the same set as the other files from this maker') : k('ui.dcn-why-team', 'Suggested from the team’s template') }); delete f.sg.alt; n++; } });
    return n;
  }
  /* put a suggestion on a file: plan → learned → (the caller's keyword guess); returns true when it set the code */
  function suggestLearned(p, f) {
    if (f.p.code) return false;
    var pl = planMatch(p, f); if (pl) { f.p.code = pl.code; f.sgc = pl.code; f.sgk = 'n'; if (!f.p.abbr && fkind(f) === 'doc') { var ab = abbrOf(pl.t); if (ab) f.p.abbr = ab; } f.sg = Object.assign({}, f.sg, { c: seeWhy() ? k('ui.dcn-why-plan', 'like line {c} in the plan', { c: pl.code }) : k('ui.dcn-why-team', 'Suggested from the team’s template') }); return true; }
    var lc = learnedFor(f); if (!lc) return false;
    var mx = mixFor(lc.k);
    if (lc.hint || mx) { f.sg = Object.assign({}, f.sg, { alt: [[lc.k, lc.hint ? whyHint(lc) : whyL(lc)]].concat(mx ? [[mx, k('ui.dcn-why-mix', 'often chosen instead')]] : []) }); return false; }
    f.p.code = lc.k; f.sgc = lc.k; f.sgk = 'n'; f.sg = Object.assign({}, f.sg, { c: whyL(lc) }); if (f.sg.alt) delete f.sg.alt; return true;
  }
  function suggestType(f) { if (f.p.abbr || fkind(f) !== 'doc') return false; var lt = learnedType(f); if (!lt || lt.hint) return false; f.p.abbr = lt.k; f.sg = Object.assign({}, f.sg, { t: whyL(lt) }); return true; }
  function strong(l) { return l[0] && l[0].s >= 5 && (!l[1] || l[0].s >= l[1].s * 1.5) ? l[0] : null; }
  function why(x, src) { var h = x.h[0]; return (src === 'n' ? k('ui.dcn-why-name', 'the file name has “{w}”', { w: h[0] }) : k('ui.dcn-why-text', 'found “{w}” {n}× in the text', { w: h[0], n: h[1] })) + (h[2] ? ' · ' + k('ui.dcn-why-p1', 'also on page 1') : ''); }
  /* a file without a code or type: guess from words in its name (marked as suggested until you say it looks right) */
  function guessName(f, p) {
    if (fkind(f) === 'photo') return; var low = String(f.p && f.p.stem || f.name).toLowerCase().replace(/[_]+/g, ' ');
    headStart();
    /* the plan and what it has learned come first; then the words of the name (JP 2026-11-25) */
    if (!f.p.code && !suggestLearned(p || (I && I.cur && proj(cur())), f) && !(f.sg && f.sg.alt)) { var cs = scoreCodes(low, ''), c = strong(cs) || (cs[0] && (!cs[1] || cs[0].s >= cs[1].s * 2) ? cs[0] : null);
      if (c) { f.p.code = c.k; f.sgc = c.k; f.sgk = 'n'; f.sg = Object.assign({}, f.sg, { c: why(c, 'n') }); if (f.sg.alt) delete f.sg.alt; }
      else if (cs.length > 1) f.sg = Object.assign({}, f.sg, { alt: cs.slice(0, 2).map(function (x) { return [x.k, why(x, 'n')]; }) }); }
    if (f.p.code && !f.p.abbr && !suggestType(f)) { var t = scoreKw(TKW, low, '')[0]; if (t && t.s >= 3) { f.p.abbr = t.k; f.sg = Object.assign({}, f.sg, { t: why(t, 'n') }); } }
  }
  /* keep every word of the file name, add only what the content adds (K200 EC is already in K200EC – JP 11:43) */
  function mergeDesc(a, b) { var sq = function (x) { return x.toLowerCase().replace(/[^a-z0-9æøå]+/g, ''); }, have = sq(a), add = []; String(b || '').split(/\s+/).forEach(function (w) { var q = sq(w); if (q && have.indexOf(q) < 0) { add.push(w); have += q; } }); return (a + ' ' + add.join(' ')).replace(/\s+/g, ' ').trim(); }

  /* ---------- the content check: the PDF's text read here with pdf.js (main thread; the first 40 pages) ---------- */
  var PDFJS = null, ccText = {}, ccBusy = {};
  function pdfLib() {
    var base = HOST || window.PAGED_PDF_VENDOR === '/dc/vendor/' ? '/dc/vendor/' : '/cmd/vendor/';
    var load = function (src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load')); }; document.head.appendChild(s); }); };
    /* pdf.js reads in a real background worker (same-origin – both CSPs allow it): reading PDFs on the page froze it for ~0.5 s per file (JP 2026-11-25 "it stutters") */
    if (!PDFJS) PDFJS = (window.pdfjsLib ? Promise.resolve() : load(base + 'pdf.min.js?v=3.11.174')).then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js?v=3.11.174'; return window.pdfjsLib; });
    PDFJS.catch(function () { PDFJS = null; });
    return PDFJS;
  }
  /* see a file in a popup over the page instead of a new tab (JP 2026-11-17 07:53): PDF pages drawn with pdf.js (first 40), pictures, text; others offer Download */
  /* zoom inside the PDF, not the whole page (2026-11-23, JP: "in Team when I'm opening a PDF, I have to zoom the entire
     page"): pinch on the pages, double-tap to go in or back to the width of the screen, − / + on a computer. The browser's own
     page zoom is off over the pages (touch-action), the pages scroll both ways, and when the zoom settles they are drawn
     again sharp for it (up to 4096 px wide each – phones run out of canvas room beyond that). */
  function zoomer(box, wrap, pages) {
    var z = 1, MIN = 1, MAX = 4, again = null;
    function set(nz, cx, cy) {
      nz = Math.max(MIN, Math.min(MAX, nz)); if (Math.abs(nz - z) < .001) return;
      var r = box.getBoundingClientRect(), zq = zoomOf(), px = (cx == null ? r.width / 2 : cx - r.left) / zq, py = (cy == null ? r.height / 2 : cy - r.top) / zq;
      var ax = (box.scrollLeft + px) / z, ay = (box.scrollTop + py) / z;
      z = nz; wrap.__z = z; box.classList.toggle('dx-zin', z > 1.01);
      pages.forEach(function (p) { p.c.style.width = Math.round(p.w * z) + 'px'; });
      box.scrollLeft = ax * z - px; box.scrollTop = ay * z - py;
      clearTimeout(again); again = setTimeout(sharp, 260);
      var lb = box.parentNode.querySelector('[data-dxzl]'); if (lb) lb.textContent = Math.round(z * 100) + '%';
    }
    function sharp() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      pages.forEach(function (p) {
        var want = Math.min(p.sc * z * dpr, 4096 / (p.w / p.sc));
        if (want <= p.done * 1.15 || p.busy) return;
        p.busy = true; var vp = p.pg.getViewport({ scale: want }), c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
        p.pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () {
          p.busy = false; if (!p.c.isConnected) return; c.style.width = p.c.style.width; p.c.replaceWith(c); p.c = c; p.done = want;
        }, function () { p.busy = false; });
      });
    }
    var t0 = null, lastTap = 0;
    function dist(t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
    box.addEventListener('touchstart', function (e) { if (e.touches.length === 2) t0 = { d: dist(e.touches), z: z }; }, { passive: true });
    box.addEventListener('touchmove', function (e) {
      if (!t0 || e.touches.length !== 2) return; e.preventDefault();
      set(t0.z * dist(e.touches) / t0.d, (e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
    }, { passive: false });
    box.addEventListener('touchend', function (e) {
      if (t0 && e.touches.length < 2) { t0 = null; return; }
      if (e.touches.length || e.changedTouches.length !== 1) return;
      var now = Date.now(), t = e.changedTouches[0];
      if (now - lastTap < 300) { lastTap = 0; e.preventDefault(); set(z > 1.2 ? 1 : 2.5, t.clientX, t.clientY); } else lastTap = now;
    });
    box.addEventListener('wheel', function (e) { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); set(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY); }, { passive: false });
    var bar = box.parentNode.querySelector('.dx-fvzb'); if (bar) { bar.hidden = false; bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-dxz]'); if (!b) return; var k2 = b.dataset.dxz; set(k2 === 'in' ? z * 1.4 : k2 === 'out' ? z / 1.4 : 1); }); }
    return { set: set, get: function () { return z; } };
  }
  function view(blob, name, opt) {
    opt = opt || {};   /* opt.sub: a small line under the name; opt.share: a Share button when the device can share files (Team's files, JP 2026-11-25) */
    var old = document.querySelector('.dx-fv'); if (old) { if (old.__close) old.__close(); else old.remove(); }   /* a popup opened again closes the old one properly (its Escape listener too) */
    var url = URL.createObjectURL(blob), e0 = ext(name), pdf = e0 === '.pdf' || blob.type === 'application/pdf', img = /^\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/.test(e0) || /^image\//.test(blob.type), txt = /^\.(txt|csv|tsv|xml|json|md)$/.test(e0);
    var shareFile = null; try { shareFile = blob instanceof File && blob.name === name ? blob : new File([blob], name, { type: blob.type || (pdf ? 'application/pdf' : '') }); } catch (x) {}
    var canShare = !!(opt.share && shareFile && navigator.share && navigator.canShare && navigator.canShare({ files: [shareFile] }));
    var ov = document.createElement('div'); ov.className = 'dcn-ov dc-host dx-fv';
    ov.innerHTML = '<div class="dcn-sheet dx-fvs" role="dialog" aria-modal="true" aria-label="' + esc(name) + '"><div class="dcn-shead"><span class="dx-fvt"><b data-noi18n>' + esc(name) + '</b>' + (opt.sub ? '<small class="muted" data-noi18n>' + esc(opt.sub) + '</small>' : '') + '</span><span class="dcn-b">' + (canShare ? '<button type="button" class="pill-btn sm ghost" data-dxfvsh><i class="bi bi-box-arrow-up"></i> ' + esc(k('ui.dx-fv-share', 'Share')) + '</button>' : '') + '<a class="pill-btn sm ghost" href="' + url + '" download="' + esc(name) + '"><i class="bi bi-download"></i> ' + esc(k('ui.download', 'Download')) + '</a>' +
      '<button type="button" class="icon-btn" data-dxfvx aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></span></div>' +
      '<div class="dx-fvzb" hidden><button type="button" class="icon-btn" data-dxz="out" aria-label="' + esc(k('ui.zoom-out', 'Zoom out')) + '"><i class="bi bi-dash-lg"></i></button><button type="button" class="pill-btn sm ghost" data-dxz="fit" data-dxzl>100%</button><button type="button" class="icon-btn" data-dxz="in" aria-label="' + esc(k('ui.zoom-in', 'Zoom in')) + '"><i class="bi bi-plus-lg"></i></button></div><div class="dx-fvb">' +
      (img ? '<img src="' + url + '" alt="">' : pdf || txt ? '<p class="muted">' + esc(k('ui.dx-fv-loading', 'Opening …')) + '</p>' : '<p class="muted">' + esc(k('ui.dx-fv-none', 'No preview for this kind of file – download it to open it.')) + '</p>') + '</div></div>';
    var close = function () { ov.remove(); URL.revokeObjectURL(url); document.removeEventListener('keydown', ek, true); document.documentElement.classList.remove('dcn-modal'); };
    ov.__close = close;
    var ek = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    var dn = null; ov.addEventListener('pointerdown', function (e) { dn = e.target; });
    ov.addEventListener('click', function (e) { if ((e.target === ov && dn === ov) || e.target.closest('[data-dxfvx]')) close(); if (e.target.closest('[data-dxfvsh]')) navigator.share({ files: [shareFile] }).catch(function () {}); });
    document.addEventListener('keydown', ek, true); document.body.appendChild(ov); document.documentElement.classList.add('dcn-modal');
    var body = ov.querySelector('.dx-fvb'), bt = ov.querySelector('[data-dxfvx]'); if (bt) bt.focus();
    if (txt) blob.text().then(function (t) { var pre = document.createElement('pre'); pre.textContent = t.slice(0, 200000); body.innerHTML = ''; body.appendChild(pre); });
    if (pdf) blob.arrayBuffer().then(function (buf) { return pdfLib().then(function (lib) { return lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise; }); }).then(function (doc) {
      body.innerHTML = ''; var W = Math.min(body.clientWidth || 800, 900), n = Math.min(doc.numPages, 40), chain = Promise.resolve(), pages = [];
      var wrap = document.createElement('div'); wrap.className = 'dx-fvz'; body.appendChild(wrap); zoomer(body, wrap, pages);
      for (var i = 1; i <= n; i++) (function (i) { chain = chain.then(function () { if (!ov.isConnected) return; return doc.getPage(i).then(function (pg) {
        var v1 = pg.getViewport({ scale: 1 }), dpr = Math.min(window.devicePixelRatio || 1, 2), sc = W / v1.width, vp = pg.getViewport({ scale: sc * dpr }), c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height; c.style.width = Math.round(vp.width / dpr * (wrap.__z || 1)) + 'px'; wrap.appendChild(c);
        pages.push({ pg: pg, c: c, w: vp.width / dpr, sc: sc, done: sc * dpr }); return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; }); }); })(i);
      chain.then(function () { if (doc.numPages > n && ov.isConnected) { var m = document.createElement('p'); m.className = 'muted'; m.textContent = k('ui.dx-fv-more', 'Showing the first {n} of {t} pages – download for the rest.', { n: n, t: doc.numPages }); body.appendChild(m); } });
    }).catch(function () { body.innerHTML = '<p class="muted">' + esc(k('ui.dx-fv-bad', 'Could not show this PDF – download it to open it.')) + '</p>'; });
    return ov;
  }
  function pdfText(blob, upto) {
    return blob.arrayBuffer().then(function (buf) { return pdfLib().then(function (lib) { return lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise; }); }).then(function (pdf) {
      var n = Math.min(pdf.numPages, upto || 40), pages = [], title = '', th = 0, chain = Promise.resolve(), pw = 0, ph = 0;
      for (var i = 1; i <= n; i++) (function (i) { chain = chain.then(function () { return pdf.getPage(i).then(function (pg) { if (i === 1) { var v = pg.getViewport({ scale: 1 }); pw = v.width; ph = v.height; } return pg.getTextContent(); }).then(function (tc) {
        var lines = [], cur = '', ly = null;
        tc.items.forEach(function (it) { if (!('str' in it)) return; var y = Math.round(it.transform[5]); if (ly !== null && Math.abs(y - ly) > 2) { lines.push(cur); cur = ''; } cur += (cur && !/\s$/.test(cur) ? ' ' : '') + it.str; ly = y; if (it.hasEOL) { lines.push(cur); cur = ''; ly = null; }
          if (i === 1) { var h = Math.abs(it.height || it.transform[3] || 0), s = it.str.trim(); if (s.length >= 3 && /[A-Za-zÆØÅæøå]/.test(s)) { if (h > th + 0.5) { th = h; title = s; } else if (Math.abs(h - th) <= 0.5 && title.length < 60 && title.indexOf(s) < 0) title += ' ' + s; } } });
        if (cur) lines.push(cur); pages.push(lines.map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean).join('\n'));
      }); }); })(i);
      return chain.then(function () { return { n: pdf.numPages, pages: pages, title: title, w: pw, h: ph }; });
    });
  }
  function langOf(t) {
    var w = ' ' + t.replace(/[^a-zæøåäö]+/g, ' ') + ' ', sum = function (l) { return l.reduce(function (a, x) { return a + cnt(w, ' ' + x + ' '); }, 0); };
    var L = [['nb', sum(['og', 'ikke', 'skal', 'med', 'til', 'av', 'som', 'eller', 'må', 'ved'])], ['en', sum(['the', 'and', 'with', 'must', 'shall', 'of', 'or', 'to', 'be', 'is'])], ['sv', sum(['och', 'inte', 'ska', 'för', 'eller', 'med'])], ['de', sum(['und', 'die', 'der', 'nicht', 'mit', 'für', 'das'])]].sort(function (a, b) { return b[1] - a[1]; });
    return L[0][1] >= 5 ? L[0][0] : '';
  }
  /* a drawing sent as a PDF with an ordinary name (JP 2026-11-24): the title block gives it away – words like Tegningsnr., Målestokk, a scale 1:50,
     Tegnet/Kontrollert av – on a landscape or large first page. Two signs at least, one of them strong; datasheets don't have these. */
  function looksDrawn(r) {
    var t = (r.pages[0] || '').toLowerCase(), strong = [/tegn(?:ings)?\.?\s*nr|tegningsnummer|drawing\s*(?:no|number|nr)/, /m[åa]lestokk|\bscale\b|\bm\s*1\s*:\s*\d{1,4}\b|\b1\s*:\s*(?:5|10|20|25|50|100|200|250|500|1000)\b/], weak = [/tegnet\s*(?:av)?|\bdrawn\b|\btegn\.\b/, /kontr(?:ollert)?\.?\s*(?:av)?|\bchecked\b|\bkontr\b/, /\brev(?:isjon)?\.?\b|\brevision\b/, /\bfag\b|\bdiscipline\b/, /oppdragsgiver|byggherre|\bclient\b/, /plan\s*\d|snitt|fasade|detalj|situasjonsplan|plantegning/];
    var s1 = strong.filter(function (x) { return x.test(t); }).length, s2 = weak.filter(function (x) { return x.test(t); }).length, shape = r.w > r.h * 1.15 || Math.max(r.w, r.h) > 1150;
    return s1 >= 1 && s1 + s2 >= 2 && shape;
  }
  function ccRun(pid, fid) {
    if (ccBusy[fid]) return; ccBusy[fid] = 1; draw();
    getBlob(fid).then(function (bl) {
      if (!bl) throw { here: 1 };
      /* pages 1–3 first – that is where the title, maker and kind of document are; the rest only when still unsure (JP 2026-11-25) */
      return pdfText(bl, 3).then(function (r) { var low0 = r.pages.join('\n').toLowerCase(), f0 = (r.pages[0] || '').toLowerCase();
        /* a scan (no text in it): read the picture of page 1, quietly – no word about scanning anywhere (JP 16:53 "it should be built in") */
        if (low0.replace(/\s/g, '').length < 30) return ocrOk().then(function (ok) { return ok ? ocrPdf(bl).then(function (t) { if (!t) return r; var L0 = lrnGet(); L0.sc = (L0.sc || 0) + 1; return { n: r.n, pages: [t], title: '', w: r.w, h: r.h, ocr: 1 }; }, function () { return r; }) : r; });
        if (r.n <= 3 || (strong(scoreKw(TKW, low0, f0)) && strong(scoreCodes(low0, f0)))) return r; return pdfText(bl, 40); });
    }).then(function (r) {
      var all = r.pages.join('\n'), low = all.toLowerCase(), first = (r.pages[0] || '').toLowerCase(), chars = all.replace(/\s/g, '').length;
      var ty = scoreKw(TKW, low, first), co = scoreCodes(low, first).filter(function (x) { return x.h.reduce(function (a, h) { return a + h[1]; }, 0) >= 2 || /^TFM/.test(x.h[0][0]); }), st = strong(ty), sc = strong(co);   /* a code from the text needs the word at least twice (or a TFM tag) – one mention in a long datasheet is not what the document is about */
      var pl = /^(?:produkt(?:navn)?|product(?: name)?|modell?|model|typebetegnelse)\s*[:\-–]\s*(.{3,80})$/im.exec(all), d = (pl ? pl[1] : r.title || '').replace(/\s+/g, ' ').trim();
      [].concat(TKW.SE, TKW.DA, TKW.DV, TKW.FB).forEach(function (e) { d = d.replace(new RegExp('\\S*' + e[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\S*', 'ig'), '');   /* the whole word: EU-samsvarserklæring goes, not just its middle */ });
      d = d.replace(/[-–:|]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
      var mm = /\b([A-ZÆØÅ][\wÆØÅæøå&.-]{1,25}(?:\s[A-ZÆØÅ][\wÆØÅæøå&.-]{1,25})?)\s(AS|ASA|AB|GmbH|Oy|A\/S|Ltd|Inc)\b/.exec(all); if (mm && d.toLowerCase().indexOf(mm[1].toLowerCase()) < 0) d = (d ? d + ' ' : '') + mm[1];
      ccText[fid] = all.slice(0, 1500); var dw = looksDrawn(r);
      var cc = { at: today(), pg: r.n, ch: chars, t: st ? [st.k, why(st, 't')] : null, c: sc ? [sc.k, why(sc, 't')] : null, ca: !sc && co.length > 1 ? co.slice(0, 2).map(function (x) { return [x.k, why(x, 't')]; }) : null, tt: ty.slice(0, 3).map(function (x) { return x.k; }), cs: co.slice(0, 3).map(function (x) { return x.k; }), d: d.slice(0, 80),
        lang: chars > 200 ? langOf(low) : '', mk: ['Bruker', 'Drift', 'Prosjekt'].filter(function (w) { return new RegExp('(^|[^A-Za-zæøå])' + w + '([^a-zæøå]|$)').test(all); }), w: [] };
      if (r.ocr) cc.o = 1; else if (chars < 40 * Math.max(1, r.pages.length)) cc.w.push(chars ? 'little' : 'notext');
      saveP(pid, function (p) {
        var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (!f) return; f.cc = cc;
        if (dw && !f.nk && fkind(f) === 'doc') { f.p.kind = 'drawing'; f.kdw = 1; }   /* found to be a drawing – it gets the drawing rule and is kept out of bulk changes; "Type fil" still decides */
        var weak = k('ui.dcn-closest', 'closest match in the text – check it');
        if (!f.p.code) { f.cc = cc;   /* the plan and what it has learned first (now with the maker from the text), then a clear match in the text; close calls are two options to choose from */
          if (suggestLearned(p, f) || (f.sg && f.sg.alt && f.sg.alt.length && !cc.c)) {}
          else if (cc.c) { f.p.code = cc.c[0]; f.sgc = cc.c[0]; f.sgk = 'd'; f.sg = Object.assign({}, f.sg, { c: cc.c[1] }); }
          else if (cc.ca) f.sg = Object.assign({}, f.sg, { alt: cc.ca });
          else if (cc.cs.length) { f.p.code = cc.cs[0]; f.sg = Object.assign({}, f.sg, { c: weak }); }
          if (f.p.code && f.sg && f.sg.alt) delete f.sg.alt; }
        if (!f.p.abbr && fkind(f) === 'doc' && suggestType(f)) {}
        else if (!f.p.abbr && fkind(f) === 'doc' && (cc.t || cc.tt.length)) { f.p.abbr = cc.t ? cc.t[0] : cc.tt[0]; f.sg = Object.assign({}, f.sg, { t: cc.t ? cc.t[1] : weak }); }
        if (cc.d && splitStem(f.name) !== nbuild(p, f).plain) { f.nv = Object.assign({}, f.nv, { desc: mergeDesc(nval(p, f, { k: 'desc' }), cc.d) }); }
        relink(p, f);
      });
    }).catch(function (e) {
      var code = e && e.here ? 'here' : e && e.name === 'PasswordException' ? 'locked' : e && e.name === 'InvalidPDFException' ? 'broken' : e && e.message === 'load' ? 'lib' : 'read';
      if (code === 'here' || code === 'lib') toast('<i class="bi bi-info-circle"></i> ' + esc(code === 'here' ? k('ui.dc-file-elsewhere', 'The file is on the device it was imported on.') : k('ui.dcn-lib', 'The PDF reader could not be loaded – check the connection (it is fetched the first time).')));
      else saveP(pid, function (p) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (f) f.cc = { at: today(), e: code }; });
    }).then(function () { delete ccBusy[fid]; drawBg(); });   /* a check finishing in the background must not close a list you have open */
  }
  /* ---------- scans: text recognition (tesseract.js, Norwegian + English) in a background worker, loaded the first time a scan turns up ---------- */
  var OCRW = null, OCRQ = Promise.resolve();
  function ocrBase() { return (HOST || window.PAGED_PDF_VENDOR === '/dc/vendor/' ? '/dc/vendor/' : '/cmd/vendor/') + 'ocr/'; }
  function ocrOk() {   /* phones: only when the phone isn't saving power or data; otherwise the next PC that opens it reads it */
    if (window.__noOcr) return Promise.resolve(false);
    var phone = window.matchMedia && matchMedia('(pointer: coarse)').matches, c = navigator.connection;
    if (!phone) return Promise.resolve(true); if (c && c.saveData) return Promise.resolve(false);
    if (!navigator.getBattery) return Promise.resolve(true);
    return navigator.getBattery().then(function (b) { return b.charging || b.level > 0.3; }, function () { return true; });
  }
  function simdOk() { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; } }
  function ocrLib() {
    if (OCRW) return OCRW; var base = ocrBase();
    var load = function (src) { return new Promise(function (res, rej) { if (window.Tesseract) { res(); return; } var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load')); }; document.head.appendChild(s); }); };
    OCRW = load(base + 'tesseract.min.js?v=7.0.0').then(function () {
      return window.Tesseract.createWorker(['nor', 'eng'], 1, { workerPath: base + 'worker.min.js?v=7.0.0', corePath: base + (simdOk() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'), langPath: base.replace(/\/$/, ''), workerBlobURL: false, gzip: true, logger: function () {}, errorHandler: function () {} });
    });
    OCRW.catch(function () { OCRW = null; });
    return OCRW;
  }
  /* page 1 as a picture (grey, sensible sharpness): the top part first – title, maker, kind of document; the whole page only when that says too little */
  function ocrPdf(bl) {
    var job = OCRQ.then(function () {   /* one scan at a time */
      return Promise.all([bl.arrayBuffer().then(function (buf) { return pdfLib().then(function (lib) { return lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise; }); }), ocrLib()]).then(function (a) {
        var pdf = a[0], w = a[1];
        return pdf.getPage(1).then(function (pg) {
          var v0 = pg.getViewport({ scale: 1 }), sc = Math.min(2.2, 1700 / Math.max(1, v0.width)), v = pg.getViewport({ scale: sc }), cv = document.createElement('canvas'); cv.width = Math.round(v.width); cv.height = Math.round(v.height);
          var cx = cv.getContext('2d', { willReadFrequently: false }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
          return pg.render({ canvasContext: cx, viewport: v }).promise.then(function () {
            var part = function (frac) { var c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = Math.round(cv.height * frac); var x2 = c2.getContext('2d'); x2.filter = 'grayscale(1)'; x2.drawImage(cv, 0, 0); return c2; };
            return w.recognize(part(0.45)).then(function (o) { var t = (o && o.data && o.data.text) || '';
              if (t.replace(/\s/g, '').length > 120) return t;
              return w.recognize(part(1)).then(function (o2) { return (o2 && o2.data && o2.data.text) || t; }); });
          });
        });
      });
    });
    OCRQ = job.catch(function () {}); return job;
  }
  function splitStem(n) { return String(n).replace(/\.[a-z0-9]{2,5}$/i, ''); }
  /* after the code or type changed: the file goes to the plan line that fits it now */
  function relink(p, f) {
    if (f.line) { var o = lineOf(p, f.line), L = ABBR[f.p.abbr] || '';
      if (o && (String(o.code).slice(0, 3) !== String(f.p.code || '').slice(0, 3) || (L && o.t && !L.split('').some(function (y) { return o.t.indexOf(y) >= 0; })))) unlink(p, f.line, f.id); }
    if (!f.line && f.p.code) { var l = bestLine(p, f.p); if (l) { f.line = l.id; l.files = (l.files || []).filter(function (x) { return x !== f.id; }).concat([f.id]); if (l.st === 'missing') l.st = 'recv'; } }
  }
  function rename(p, f, name) {
    if (!f.orig) f.orig = f.name; f.name = name.slice(0, 160); var pn = parseName(f.name);
    f.p = { code: pn.code || f.p.code, abbr: pn.abbr || f.p.abbr, text: pn.text.slice(0, 80), stem: pn.stem.slice(0, 120), kind: pn.kind }; f.iss = pn.issues; pairs(p);
  }

  /* ---------- the Files tab with naming on ---------- */
  var nsel = '', nopen = false;
  /* many files (JP 2026-11-16 21:55 "could be messy"): over 6 files each row is one line – the name now → the new name and where it
     stands – and opens on a tap; chips show only what needs you, what is ready, or what is done */
  var drawBg = function () {};
  var nexp = {}, nflt = '', nfo = '';   /* nfo: the file open in the popup (nopen is the rules box) */
  function fstate(p, f) { var b = nbuild(p, f); if (b.miss.length || (!f.p.code && fkind(f) !== 'photo') || (f.p.code && !f.p.abbr && fkind(f) === 'doc')) return 'todo'; return b.plain + ext(f.orig || f.name) === f.name ? 'done' : 'ready'; }
  var CGRP = { '0': ['Felles', 'Common'], '1': ['Øvrige dokumentasjoner', 'Other documentation'], '2': ['Bygning', 'Building'], '3': ['VVS-installasjoner', 'HVAC and plumbing'], '4': ['Elkraftinstallasjoner', 'Electrical power'], '5': ['Ekom og automatisering', 'Telecom and automation'], '6': ['Andre installasjoner', 'Other installations'], '7': ['Utendørs', 'Outdoor'], '8': ['Andre', 'Other'], '9': ['Andre', 'Other'] };
  /* every code as a dropdown, grouped by its two-digit part (JP 2026-11-17 07:22 "why free text?"). The three-digit names aren't in the
     public code (licence), so a code shows its own name when the plan or your own codes know it, else its group's name. */
  var NSK = 'dcn.nsnames';
  function nsNames() { try { var o = JSON.parse(localStorage.getItem(NSK) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function parseNS(txt) {
    var out = {};
    String(txt || '').split(/\r?\n/).forEach(function (ln) {
      ln = ln.trim(); if (!ln || ln[0] === '#') return; var code = '', name = '', m;
      if (/[|\t;]/.test(ln)) ln.split(/[|\t;]/).map(function (x) { return x.trim(); }).forEach(function (x) { var q = x.match(/^(\d{2,4})(?:[.,]0+)?$/); if (q) { if (q[1].length >= code.length) code = q[1]; } else if (x && !name) name = x; });
      else if ((m = ln.match(/^(\d{2,4})(?:[.,]0+)?\s*[-–:.]?\s*(.+)$/))) { code = m[1]; name = m[2]; }
      name = name.replace(/\s+/g, ' ').replace(/\.$/, '').trim();
      if (code && name && !/^\(?reservert\)?$/i.test(name)) out[code] = name.slice(0, 100);
    });
    return out;
  }
  /* a searchable list for the code (JP 2026-11-17 12:53 "make it searchable"): opens over the page, filters by number or name as you type;
     built from the hidden select, which still does the saving */
  function cpick(sel) {
    var old = document.querySelector('.dcn-cpk'); if (old) { if (old.__close) old.__close(); else old.remove(); }   /* a popup opened again closes the old one properly (its Escape listener too) */
    var items = [], grp = '';
    [].forEach.call(sel.querySelectorAll('option, optgroup'), function (n) { if (n.tagName === 'OPTGROUP') { grp = n.label; return; } if (n.value) items.push({ v: n.value, t: n.textContent, g: n.parentNode.tagName === 'OPTGROUP' ? n.parentNode.label : '', on: n.value === sel.value }); });
    var ov = document.createElement('div'); ov.className = 'dcn-ov dc-host dcn-cpk';
    ov.innerHTML = '<div class="dcn-sheet dcn-cpks" role="dialog" aria-modal="true" aria-label="' + esc(k('ui.dcn-code', 'NS 3451 code')) + '"><div class="dcn-shead"><b>' + esc(k('ui.dcn-code', 'NS 3451 code')) + '</b><button type="button" class="icon-btn" data-cpx aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
      '<input type="search" class="dcn-cpq" placeholder="' + esc(k('ui.dcn-cp-q', 'Search a number or a word – e.g. 36 or ventilasjon')) + '" aria-label="' + esc(k('ui.dcn-cp-q', 'Search a number or a word – e.g. 36 or ventilasjon')) + '" autocomplete="off"><ul class="dcn-cpl"></ul></div>';
    var q = ov.querySelector('.dcn-cpq'), ul = ov.querySelector('.dcn-cpl'), dn = null;
    var close = function () { ov.remove(); document.removeEventListener('keydown', ek, true); document.documentElement.classList.toggle('dcn-modal', !!document.querySelector('.dcn-ov')); };
    ov.__close = close;
    var pick = function (v) { close(); sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); };
    var draw1 = function () {
      var w = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean), last = '', h = '', n = 0;
      var last1 = '';
      items.forEach(function (it) { var hay = (it.t + ' ' + it.g).toLowerCase(); if (w.some(function (x) { return /^\d+$/.test(x) ? it.v.indexOf(x) !== 0 && it.g.indexOf(x) !== 0 : hay.indexOf(x) < 0; })) return;
        var d1 = /^\d{3,4}$/.test(it.v) ? it.v[0] : '';
        if (d1 && d1 !== last1) { last1 = d1; var c1 = CGRP[d1]; h += '<li class="dcn-cp1">' + esc(d1 + ' ' + (c1 ? (nb() ? c1[0] : c1[1]) : '')) + '</li>'; }
        if (it.g !== last) { last = it.g; h += '<li class="dcn-cpg">' + esc(it.g || '') + '</li>'; }
        var lv = it.v.length >= 4 && /^\d+$/.test(it.v) ? ' l4' : '';
        if (n++ < 3000) h += '<li><button type="button" data-cpv="' + esc(it.v) + '" class="' + lv + (it.on ? ' on' : '') + '"' + (it.on ? ' aria-current="true"' : '') + '><b>' + esc(it.v) + '</b> ' + esc(it.t.replace(/^\s*\S+\s*/, '')) + '</button></li>'; });
      ul.innerHTML = h || '<li class="dcn-cpg">' + esc(k('ui.dcn-cp-none', 'Nothing found – pick “+ Own code or free text” to write it yourself')) + '</li>';
    };
    var ek = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === 'Enter' && document.activeElement === q) { e.preventDefault(); var b = ul.querySelector('[data-cpv]'); if (b) pick(b.dataset.cpv); } };
    ov.addEventListener('pointerdown', function (e) { dn = e.target; });
    ov.addEventListener('click', function (e) { var b = e.target.closest('[data-cpv]'); if (b) { pick(b.dataset.cpv); return; } if ((e.target === ov && dn === ov) || e.target.closest('[data-cpx]')) close(); });
    q.addEventListener('input', draw1);
    document.addEventListener('keydown', ek, true); document.body.appendChild(ov); document.documentElement.classList.add('dcn-modal');
    draw1(); var on = ul.querySelector('.on'); if (on) on.scrollIntoView({ block: 'center' });
    if (!matchMedia('(pointer: coarse)').matches) q.focus();
    return ov;
  }
  /* the code list is the same for every file of a project: built once and kept until the codes, their names or the plan change –
     only "selected" differs (JP 2026-11-27: building 730 choices again took most of the file card's time) */
  var COC = null;
  function codeOpts(p, f) {
    var v = String(f.p.code || ''), key = '';
    try { key = (nb() ? 'n' : 'e') + '\u0001' + (localStorage.getItem(NSK) || '') + '\u0001' + JSON.stringify(LP && LP.ownMap ? LP.ownMap() : {}) + '\u0001' + JSON.stringify(owns(p, 'code')) + '\u0001' + (p.lines || []).map(function (l) { return l.code + ':' + lineTitle(l); }).join('|'); } catch (e) { key = ''; }
    if (key && !(COC && COC.key === key)) { var r0 = codeOptsRaw(p, ''); COC = { key: key, h: r0.h, known: r0.known }; }
    if (key && COC && (!v || COC.known.indexOf(v) >= 0)) return (v ? COC.h.replace('<option value="' + v + '">', '<option value="' + v + '" selected>') : COC.h) + ownOpts(p, 'code', v, COC.known.slice());
    var r = codeOptsRaw(p, v); return r.h + ownOpts(p, 'code', v, r.known);
  }
  function codeOptsRaw(p, v) {
    var L = codeList(p), names = {}, groups = [];
    var NN = Object.assign({}, LP && LP.ownMap ? LP.ownMap() : {}, nsNames()); owns(p, 'code').forEach(function (y) { if (y[1]) NN[y[0]] = NN[y[0]] || y[1]; });
    L.forEach(function (c) { names[c[0]] = c[1]; if (c[0].length === 2) groups.push(c[0]); });
    Object.keys(NN).forEach(function (c) { if (c.length >= 3 && !names[c]) L.push([c, NN[c]]); names[c] = names[c] || NN[c]; });
    L.forEach(function (c) { var g = c[0].slice(0, 2); if (c[0].length >= 3 && groups.indexOf(g) < 0) groups.push(g); });
    groups.sort();
    var known = [], h = '<option value="">' + esc(k('ui.dcn-choose-code', 'Choose a code')) + '</option>';
    var anyName = Object.keys(NN).filter(function (c) { return c.length >= 3; }).length >= 20;   /* a real list of names was imported */
    groups.forEach(function (g) {
      var gn = names[g] || (CGRP[g[0]] ? (nb() ? CGRP[g[0]][0] : CGRP[g[0]][1]) : ''), list = [];
      for (var d = 0; d <= 9; d++) list.push(g + d);
      L.forEach(function (c) { if (c[0].length > 3 && c[0].slice(0, 2) === g && list.indexOf(c[0]) < 0) list.push(c[0]); });
      /* once names are known (anywhere), a code without one is reserved in the standard – left out (JP 11:25, 12:53: 747, 791–799);
         x0 (the group itself) only when it has a name; 4-digit codes right after their 3-digit code (JP 12:53 "not properly sorted") */
      var named = anyName || list.some(function (c) { return names[c]; });
      list = list.filter(function (c) { return named ? names[c] || c === v : c.slice(-1) !== '0' || c.length > 3 || c === v; });
      list.sort(function (a, b) { return a.slice(0, 3) === b.slice(0, 3) ? a.length - b.length || (a < b ? -1 : 1) : a < b ? -1 : 1; });
      if (!list.length) return;
      h += '<optgroup label="' + esc(g + (gn ? ' ' + gn : '')) + '">' + list.map(function (c) { known.push(c); return '<option value="' + c + '"' + (c === v ? ' selected' : '') + '>' + (c.length > 3 ? '\u2003\u2003' : '') + esc(c + (names[c] ? ' ' + names[c] : '')) + '</option>'; }).join('') + '</optgroup>';
    });
    return { h: h, known: known };
  }
  function codeList(p) {
    var m = {}, add = function (c, n) { c = String(c); if (/^\d{2,4}$/.test(c) && !m[c]) m[c] = n || codeName(c) || ''; };
    (p.lines || []).forEach(function (l) { add(String(l.code).split('.')[0], lineTitle(l)); });
    var own = LP && LP.ownMap ? LP.ownMap() : {}; Object.keys(own).forEach(function (c) { add(c, own[c]); });
    (window.NS3451 || (LP && LP.NS) || []).forEach(function (q) { add(q[0], nb() ? q[2] : q[1]); });
    return Object.keys(m).sort().map(function (c) { return [c, m[c]]; });
  }
  function typeOpts(p, f) {
    var c3 = String(f.p.code || '').slice(0, 3), fit = {};
    (p.lines || []).forEach(function (l) { if (String(l.code).slice(0, 3) !== c3) return; CATN.forEach(function (x) { var L = ABBR[x[0]] || ''; if ((L && l.t && L.split('').some(function (y) { return l.t.indexOf(y) >= 0; })) || (l.planned && new RegExp('^\\d{3}\\S*\\s+' + x[0] + '\\b').test(l.planned))) fit[x[0]] = 1; }); });
    var o = function (x) { return '<option value="' + x[0] + '"' + (x[0] === f.p.abbr ? ' selected' : '') + '>' + esc(x[0] + ' · ' + (nb() ? x[1] : x[2])) + '</option>'; };
    var a = CATN.filter(function (x) { return fit[x[0]]; }), bt = CATN.filter(function (x) { return !fit[x[0]] && x[3] === 't'; }), ba = CATN.filter(function (x) { return !fit[x[0]] && x[3] === 'a'; });
    var grp = function (lab, L) { return L.length ? '<optgroup label="' + esc(lab) + '">' + L.map(o).join('') + '</optgroup>' : ''; };
    return '<option value="">' + esc(k('ui.dcn-choose-type', 'Choose type')) + '</option>' + grp(k('ui.dcn-in-plan', 'In the plan for {c}', { c: c3 }), a) + grp(k('ui.dcn-types-tech', 'Technical documentation'), bt) + grp(k('ui.dcn-types-adm', 'Administrative documents'), ba) +
      ownOpts(p, 'type', f.p.abbr || '', CATN.map(function (x) { return x[0]; }));
  }
  function tag(c, t) { return '<span class="dc-st" style="--c:' + c + '">' + esc(t) + '</span>'; }
  function nfield(p, f, key, need) {
    var id = 'dcn-' + f.id + '-' + key, v = nval(p, f, { k: key }), lab = '<label class="dcn-fl" for="' + id + '"><span>' + esc(partName(key)) + '</span>', nc = need ? ' class="dcn-need"' : '';   /* an empty part the name still needs gets an orange edge (JP 2026-11-24) */
    if (key === 'floor' || key === 'dtype' || key === 'disc') { var L = key === 'floor' ? FLOORS : key === 'dtype' ? DTYPES : FAG; return lab + '<select id="' + id + '"' + nc + ' data-dcnv="' + esc(f.id) + ':' + key + '"><option value="">' + esc(key === 'floor' ? k('ui.dcn-pick-floor', 'Choose floor') : key === 'disc' ? k('ui.dcn-pick-disc', 'Choose discipline') : k('ui.dcn-pick-dtype', 'Choose drawing type')) + '</option>' + (function () { var op = function (x) { var m = mean(key, x); return '<option value="' + x + '"' + (x === v ? ' selected' : '') + '>' + esc(x + (m ? ' – ' + m : '')) + '</option>'; }; if (key !== 'disc') return L.map(op).join(''); var GEN = ['G', 'L', 'M', 'R', 'W']; return '<optgroup label="' + esc(k('ui.dcn-fag-bld', 'Per building')) + '">' + L.filter(function (x) { return GEN.indexOf(x) < 0; }).map(op).join('') + '</optgroup><optgroup label="' + esc(k('ui.dcn-fag-all', 'The whole property (general drawings)')) + '">' + L.filter(function (x) { return GEN.indexOf(x) >= 0; }).map(op).join('') + '</optgroup>'; })() + ownOpts(p, key, v, L) + '</select>' + (v && mean(key, v) && !(f.nv && f.nv[key] != null) && !drawn(f)[key] ? '<small class="dcn-gs">' + esc(k('ui.dcn-guess', 'Suggested – check it')) + '</small>' : '') + '</label>' + (nown === f.id + ':' + key ? ownForm(f.id, key) : ''); }
    if (key === 'rev') v = (f.nv || {}).rev || '';
    return lab + '<input id="' + id + '"' + nc + ' data-dcnv="' + esc(f.id) + ':' + key + '" value="' + esc(v) + '" maxlength="80"></label>';
  }
  var nopk = false;   /* set while Ready / Done are drawn: rows without a pick box */
  function nrow(p, f, compact, headLine) {
    var r = ruleFor(p, f), b = nbuild(p, f, r), e = ext(f.orig || f.name), l = f.line && lineOf(p, f.line), kd = fkind(f), tags = [], lvl = 'ok';
    if (compact) {
      var st = fstate(p, f), ic = st === 'done' ? 'check2-circle' : st === 'ready' ? 'arrow-right-circle' : 'exclamation-circle', open = !!nexp[f.id];
      var line = '<button type="button" class="dcn-sumb" data-dcnexp="' + esc(f.id) + '" aria-expanded="' + open + '"><i class="bi bi-' + ic + ' dcn-s-' + st + '"></i><span class="dcn-sumt"><b data-noi18n>' + esc(f.name) + '</b>' +
        (st === 'done' ? '' : '<small data-noi18n>' + (st === 'ready' ? '→ ' + esc(b.plain + e) : esc(!f.p.code && f.sg && f.sg.alt ? k('ui.dcn-alt-short', 'Choose code: {a}', { a: f.sg.alt.map(function (a) { return a[0]; }).join(k('ui.dcn-or', ' or ')) }) : k('ui.dcn-fill', 'Fill in: {w}', { w: (b.miss.length ? b.miss : ['code']).map(function (x) { return lc1(partName(x)); }).join(', ') }))) + '</small>') + '</span><i class="bi bi-chevron-right"></i></button>';
      if (!open) return '<li class="dcn-row dcn-c dcn-' + (st === 'todo' ? 'warn' : 'ok') + (pkOn(f.id) && !nopk ? ' dcn-pkd' : '') + '" data-dcnc="' + esc(f.id) + '">' + (nopk ? '' : '<label class="dcn-pkc"><input type="checkbox" data-dcnpk="' + esc(f.id) + '"' + (pkOn(f.id) ? ' checked' : '') + ' aria-label="' + esc(k('ui.dcn-pk-one', 'Select {f}', { f: f.name })) + '"></label>') + line + '</li>';
      return nrow(p, f, false, line);
    }
    if (!f.p.code && kd !== 'photo') { tags.push(tag('var(--warn)', k('ui.dcn-needs-code', 'Needs a code'))); lvl = 'warn'; }
    else if (f.p.code && !f.p.abbr && kd === 'doc') { tags.push(tag('var(--warn)', k('ui.dcn-needs-type', 'Needs a type'))); lvl = 'warn'; }
    if (l) tags.push(tag('var(--ok)', k('ui.dcn-on-line', 'On line {c}', { c: l.code + (f.p.abbr ? ' ' + f.p.abbr : '') })));
    else if (f.p.code && !f.nf && !p.tool) { tags.push(tag('var(--violet)', k('ui.dcn-not-plan', 'Not in the plan'))); if (lvl === 'ok') lvl = 'odd'; }
    if (f.sg && (f.sg.c || (f.sg.t && kd === 'doc'))) tags.push(tag('var(--blue)', k('ui.dcn-suggested', 'Suggested – check it')));
    if (f.kdw && kd === 'drawing' && !f.nk) tags.push(tag('var(--blue)', k('ui.dcn-kdw', 'Recognised as a drawing from the PDF')));
    /* the card (JP 2026-11-24, from the preview): a head with the file, then Code and type · Name parts · New name, each marked;
       what's missing is said once – on the head and on the button – and an empty field has an orange edge */
    var gaps = b.miss.filter(function (x) { return x !== 'code' && x !== 'type'; }), same = !b.miss.length && b.plain === splitStem(f.name);
    if (gaps.length && lvl === 'ok') lvl = 'warn';
    var stt = b.miss.length ? tag('var(--warn)', k(b.miss.length === 1 ? 'ui.dcn-miss1' : 'ui.dcn-missn', b.miss.length === 1 ? '1 field missing' : '{n} fields missing', { n: b.miss.length })) : same ? tag('var(--ok)', k('ui.dcn-follows', 'Name follows the rule')) : tag('var(--blue)', k('ui.dcn-ready', 'Ready-made'));
    var head = headLine || '<div class="dcn-head"><i class="bi bi-' + (kd === 'photo' ? 'image' : kd === 'drawing' ? 'rulers' : 'file-earmark-text') + '" aria-hidden="true"></i><span class="dcn-hn"><b data-noi18n>' + esc(f.name) + '</b><small>' + esc(kd === 'photo' ? k('ui.dcn-k-photo', 'Photo') : kd === 'drawing' ? k('ui.dcn-k-drawing', 'Drawing') : k('ui.dcn-k-doc', 'Document')) + (f.orig && f.orig !== f.name ? ' · <span data-noi18n>' + esc(k('ui.dcn-sent-as', 'Sent as: {n}', { n: f.orig })) + '</span>' : '') + '</small></span>' + stt +
      (f.nf ? '' : '<button type="button" class="pill-btn sm ghost dcn-open" data-dcview="' + esc(f.id) + '"><i class="bi bi-eye"></i> ' + esc(k('ui.dcn-open', 'Open')) + '</button>') + '</div>';
    var code = f.p.code ? f.p.code + ' ' + (codeName(f.p.code) || '') : '', seen = {};
    /* the whole card a light red while something is wrong, a light green when it's right (JP 2026-11-26 10:17; 11:36 "I cannot see it"):
       right = the file already has its final name and nothing is said against it */
    var iss0 = (f.iss || []).filter(function (x) { return !(b.plain === splitStem(f.name) && !b.miss.length && r.id !== 'bby-doc' && PAIR.indexOf(x[1]) < 0); });
    var good = fstate(p, f) === 'done' && lvl !== 'warn' && !iss0.length;
    var h = '<li class="dcn-row dcn-card dcn-' + lvl + ' ' + (good ? 'dcn-good' : 'dcn-bad') + '" data-dcnf="' + esc(f.id) + '">' + head + '<div class="dcn-part"><p class="dcn-sec">' + esc(k('ui.dcn-sec-code', 'Code and type')) + '</p><div class="dcn-g">' +
      '<label class="dcn-c dcn-kind"><span>' + esc(k('ui.dcn-kind', 'Kind of file')) + '</span><select data-dcnk="' + esc(f.id) + '">' + [['doc', 'ui.dcn-k-doc', 'Document'], ['photo', 'ui.dcn-k-photo', 'Photo'], ['drawing', 'ui.dcn-k-drawing', 'Drawing']].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === kd ? ' selected' : '') + '>' + esc(k(x[1], x[2])) + '</option>'; }).join('') + '</select></label>' +
      '<label class="dcn-c"><span>' + esc(kd === 'photo' ? k('ui.dcn-code-opt', 'NS 3451 code (optional)') : k('ui.dcn-code', 'NS 3451 code')) + '</span><select data-dcncode="' + esc(f.id) + '" title="' + esc(code.trim()) + '" class="dcn-hsel" tabindex="-1" aria-hidden="true">' + codeOpts(p, f) + '</select>' +
        '<button type="button" class="dcn-cbtn" data-dcncpick="' + esc(f.id) + '"><span>' + esc(f.p.code ? f.p.code + (codeName(f.p.code) ? ' ' + codeName(f.p.code) : '') : k('ui.dcn-choose-code', 'Choose a code')) + '</span><i class="bi bi-search"></i></button></label>' + (nown === f.id + ':code' ? ownForm(f.id, 'code') : '') +
      (!f.p.code && f.sg && f.sg.alt ? '<div class="dcn-alt"><span>' + esc(k('ui.dcn-alt', 'Not sure – choose one:')) + '</span>' + f.sg.alt.map(function (a) { return '<button type="button" class="pill-btn sm ghost dcn-altb" data-dcnalt="' + esc(f.id + '|' + a[0]) + '"><b data-noi18n>' + esc(a[0] + (codeName(a[0]) ? ' ' + codeName(a[0]) : '')) + '</b><small>' + esc(a[1]) + '</small></button>'; }).join('') + '</div>' : '') +
      (kd === 'doc' ? '<label class="dcn-c"><span>' + esc(k('ui.dcn-type', 'Document type')) + '</span><select data-dcntype="' + esc(f.id) + '">' + typeOpts(p, f) + '</select></label>' + (nown === f.id + ':type' ? ownForm(f.id, 'type') : '') : '') +
      (tags.length || (f.sg && (f.sg.c || f.sg.t)) ? '<div class="dcn-t">' + tags.join('') + (f.sg && (f.sg.c || f.sg.t) ? '<button type="button" class="text-btn" data-dcnok="' + esc(f.id) + '">' + esc(k('ui.dcn-looks-right', 'Looks right')) + '</button>' : '') + '</div>' : '') + '</div></div>';   /* closes the grid and the Code and type part */
    if (f.sg && (f.sg.c || (f.sg.t && kd === 'doc'))) h += '<p class="dcn-why"><i class="bi bi-lightbulb"></i> ' + esc([f.sg.c ? k('ui.dcn-code', 'NS 3451 code') + ': ' + f.sg.c : '', f.sg.t && kd === 'doc' ? k('ui.dcn-type', 'Document type') + ': ' + f.sg.t : ''].filter(Boolean).join(' · ')) + '</p>';
    var hs = '';
    /* a project value (building, property, project) the name uses stays in the file's popup too – a change here is for all the files (JP 2026-11-26 10:17: the building vanished from the popup once it was set) */
    r.parts.forEach(function (q) { if (PV[q.k]) hs += pvField(p, q.k, true, !!p[PV[q.k][0]], true); });
    r.parts.forEach(function (q) { if (NPART[q.k] && NPART[q.k][2] && !seen[q.k]) { seen[q.k] = 1; hs += nfield(p, f, q.k, b.miss.indexOf(q.k) >= 0); } });
    if (hs) h += '<div class="dcn-s dcn-part"><p class="dcn-sec">' + esc(k('ui.dcn-sec-parts', 'Name parts')) + '</p>' + hs + '</div>';
    var mw = b.miss.map(function (x) { return x === 'code' ? lc1(k('ui.dcn-code', 'NS 3451 code')) : x === 'type' ? lc1(k('ui.dcn-type', 'Document type')) : x === 'room' ? k('ui.dcn-short-room', 'room') : lc1(partName(x)); }), mws = mw.length > 1 ? mw.slice(0, -1).join(', ') + k('ui.dcn-and', ' and ') + mw[mw.length - 1] : mw[0];
    h += '<div class="dcn-new dcn-part"><p class="dcn-sec">' + esc(k('ui.dcn-sec-new', 'New name')) + ' <span>· ' + esc(k('ui.dcn-name-from', 'Name from “{r}”', { r: rname(r) })) + '</span></p><div class="dcn-nb"><div class="dcn-sug"><code data-noi18n>' + b.html + esc(e) + '</code></div>' +
      '<div class="dcn-b">' + (b.miss.length ? '<button type="button" class="pill-btn dcn-fillb" data-dcnfill="' + esc(f.id) + '"><i class="bi bi-arrow-up"></i> ' + esc(k('ui.dcn-fill-first', 'Fill in {w} first', { w: mws })) + '</button>'
        : '<button type="button" class="pill-btn" data-dcnuse="' + esc(f.id) + '"' + (b.plain + e === f.name ? ' disabled' : '') + '><i class="bi bi-pencil"></i> ' + esc(k('ui.dcn-use', 'Use this name')) + '</button>') +
      (f.orig && f.orig !== f.name ? '<button type="button" class="text-btn" data-dcnorig="' + esc(f.id) + '">' + esc(k('ui.dcn-orig', 'Back to the name it came with')) + '</button>' : '') +
      '<button type="button" class="icon-btn sm" data-dcfdel="' + esc(f.id) + '" aria-label="' + esc(k('ui.delete', 'Delete')) + '"><i class="bi bi-trash3"></i></button></div></div></div>';
    var iss = (f.iss || []).filter(function (x) { return !(b.plain === splitStem(f.name) && !b.miss.length && r.id !== 'bby-doc' && PAIR.indexOf(x[1]) < 0); });   /* a name that follows your own rule isn't wrong for not looking like Boligbygg's */
    if (iss.length) h += '<ul class="dc-iss">' + iss.map(function (x) { return '<li class="' + x[0] + '"><i class="bi bi-' + (x[0] === 'err' ? 'x-octagon' : 'exclamation-triangle') + '"></i> ' + esc(issueText(x, f)) + '</li>'; }).join('') + '</ul>';
    var lk = '<select class="dc-link" data-dcflink="' + esc(f.id) + '"><option value="">' + esc(k('ui.dc-not-in-plan', 'Not in the plan – link it to a line …')) + '</option>' + linkOpts(p, f) + '</select>';
    if (!l && !f.nf && !p.tool) h += kd === 'photo' ? '<details class="dcn-lk"><summary>' + esc(k('ui.dcn-lk-photo', 'Link to a line (optional)')) + '</summary>' + lk + '</details>' : lk;   /* a photo seldom has a line of its own (JP 2026-11-24) */
    h += ccHtml(p, f);
    return h + '</li>';
  }
  function ccHtml(p, f) {
    if (f.nf || ext(f.name) !== '.pdf') return '';
    var c = f.cc, run = '<button type="button" class="text-btn" data-dcncc="' + esc(f.id) + '"><i class="bi bi-search"></i> ' + esc(c ? k('ui.dcn-cc-again', 'Check again') : k('ui.dcn-cc-run', 'Check the content')) + '</button>';
    if (ccBusy[f.id]) return '<div class="dcn-cc" aria-live="polite"><b>' + esc(k('ui.dcn-cc', 'Content check')) + '</b> <span class="muted">' + esc(k('ui.dcn-cc-reading', 'Reading the PDF on this device …')) + '</span></div>';
    if (!c) return '<div class="dcn-cc"><b>' + esc(k('ui.dcn-cc', 'Content check')) + '</b> <span class="muted">' + esc(k('ui.dcn-cc-help', 'Reads the PDF here to suggest code, type and description and to spot problems. Nothing is sent.')) + '</span> ' + run + '</div>';
    if (c.e) return '<div class="dcn-cc"><b>' + esc(k('ui.dcn-cc', 'Content check')) + '</b> ' + tag('var(--warn)', k('ui.dcn-cc-bad', 'Could not read')) + '<p>' + esc({ locked: k('ui.dcn-cc-locked', 'The PDF is locked with a password, so its text can’t be read. Ask for an open file.'), broken: k('ui.dcn-cc-broken', 'This doesn’t look like a working PDF – it may be damaged.') }[c.e] || k('ui.dcn-cc-read', 'The file could not be read.')) + '</p>' + run + '</div>';
    var li = [], bad = c.w.length;
    c.w.forEach(function (w) { li.push('<li class="w">' + esc(w === 'notext' ? k('ui.dcn-cc-notext', 'No text found – the pages are probably scanned pictures, so nothing can be searched or checked.') : k('ui.dcn-cc-little', 'Very little text – it is probably scanned pictures.')) + '</li>'); });
    if (c.t) { var tm = f.p.abbr && f.p.abbr !== c.t[0]; bad = bad || tm; li.push('<li>' + esc(k('ui.dcn-cc-looks', 'Looks like {t}', { t: c.t[0] + ' · ' + catName(c.t[0]) })) + ' <span class="muted">(' + esc(c.t[1]) + ')</span>' + (tm ? ' <span class="w">' + esc(k('ui.dcn-cc-row-says', 'The row says {v}.', { v: f.p.abbr })) + '</span> <button type="button" class="text-btn" data-dcnuset="' + esc(f.id) + '">' + esc(k('ui.dcn-use-v', 'Use {v}', { v: c.t[0] })) + '</button>' : '') + '</li>'); }
    else li.push('<li class="muted">' + (c.tt.length ? esc(k('ui.dcn-cc-type-pick', 'Type unclear – pick one:')) + pick(f, 'type', c.tt) : esc(k('ui.dcn-cc-no-type', 'No words that point to a document type.'))) + '</li>');
    if (c.c) { var cm = f.p.code && String(f.p.code).slice(0, 3) !== c.c[0]; bad = bad || cm; li.push('<li>' + esc(k('ui.dcn-cc-about', 'About {c}', { c: c.c[0] + ' ' + (codeName(c.c[0]) || '') })) + ' <span class="muted">(' + esc(c.c[1]) + ')</span>' + (cm ? ' <span class="w">' + esc(k('ui.dcn-cc-row-says', 'The row says {v}.', { v: f.p.code })) + '</span> <button type="button" class="text-btn" data-dcnusec="' + esc(f.id) + '">' + esc(k('ui.dcn-use-v', 'Use {v}', { v: c.c[0] })) + '</button>' : '') + '</li>'); }
    else li.push('<li class="muted">' + (c.cs.length ? esc(k('ui.dcn-cc-code-pick', 'System unclear – pick one:')) + pick(f, 'code', c.cs) : esc(k('ui.dcn-cc-no-code', 'No words that point to an NS 3451 code.'))) + '</li>');
    if (c.d) li.push('<li>' + esc(k('ui.dcn-cc-title', 'Product or title on page 1: {d}', { d: c.d })) + '</li>');
    if (c.lang) { var ln = { nb: k('ui.dcn-l-nb', 'Norwegian'), en: k('ui.dcn-l-en', 'English'), sv: k('ui.dcn-l-sv', 'Swedish'), de: k('ui.dcn-l-de', 'German') }[c.lang]; li.push('<li>' + esc(k('ui.dcn-cc-lang', 'Language: {l}', { l: ln })) + (c.lang !== 'nb' ? ' <span class="w">' + esc(k('ui.dcn-cc-nb', 'Check whether a Norwegian version is needed.')) + '</span>' : '') + '</li>'); }
    li.push(c.mk.length ? '<li>' + esc(k('ui.dcn-cc-mk', 'Marked for (Bruker, Drift, Prosjekt): {m}', { m: c.mk.join(', ') })) + '</li>' : '<li class="w">' + esc(k('ui.dcn-cc-nomk', 'No marking for user, operation or project found (Bruker, Drift, Prosjekt – spec 4.5)')) + '</li>');
    return '<div class="dcn-cc"><b>' + esc(k('ui.dcn-cc', 'Content check')) + '</b> ' + tag(bad ? 'var(--warn)' : 'var(--ok)', bad ? k('ui.dcn-cc-check', 'Check this') : k('ui.dcn-cc-fine', 'Nothing odd found')) + ' <span class="muted tnum">' + esc(k('ui.dcn-cc-size', '{n} pages · {c} characters', { n: c.pg, c: c.ch })) + '</span><ul>' + li.join('') + '</ul>' +
      (ccText[f.id] ? '<details><summary>' + esc(k('ui.dcn-cc-show', 'Show the text that was read')) + '</summary><pre data-noi18n>' + esc(ccText[f.id]) + '</pre></details>' : '') + run + '</div>';
  }
  /* the naming rules (JP 2026-11-16 22:00 "making a rule was lackluster … messy with a lot of rules"): which rule each kind of file
     uses, then the rules as a short list (Boligbygg's folded away), and an editor that builds the name from parts you tap, with the
     result shown as you go */
  var npi = -1;
  var EXF = { id: '_ex', name: 'x.pdf', p: { code: '442', abbr: 'DA', text: 'taklampe korridor C20', kind: 'doc' }, nv: { floor: 'H02', disc: 'E', dtype: 'P', room: '0204', free: 'kjøkken', rev: '01', contractor: 'Eksempel Elektro AS' } };
  function exName(p, r) { return nbuild(Object.assign({}, p, { files: [EXF], bid: p.bid || '11621', no: p.no || '23200', pid: p.pid || '2010' }), EXF, r); }
  function rulesHtml(p) {
    if (HOST && HOST.can && !HOST.can('rules')) return '';   /* in Team only those allowed «Sjekklister og navneregler» (admins by default) see and set the rules (JP 2026-11-23 "except me") */
    var use = p.nuse || {}, R = nrules(p), own = R.filter(function (r) { return !r.b; }), sel = nsel ? nrule(p, nsel) : null;
    var opts = function (cur) { var o = function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === cur ? ' selected' : '') + '>' + esc(rname(r)) + '</option>'; };
      return '<optgroup label="' + esc(k('ui.dcn-ready', 'Ready-made')) + '">' + R.filter(function (r) { return r.b; }).map(o).join('') + '</optgroup>' + (own.length ? '<optgroup label="' + esc(k('ui.dcn-own', 'Your rules')) + '">' + own.map(o).join('') + '</optgroup>' : ''); };
    var KINDS = [['doc', 'ui.dcn-use-doc', 'Documents'], ['photo', 'ui.dcn-use-photo', 'Photos'], ['drawing', 'ui.dcn-use-dwg', 'Drawings']];
    var h = '<details class="dcn-rules"' + (nopen ? ' open' : '') + ' data-dcnrules><summary><i class="bi bi-sliders"></i> <b>' + esc(p.tool ? k('ui.dcn-rules-tool', 'Naming rules') : k('ui.dcn-rules', 'Naming rules for this project')) + '</b><small>' +
      esc((function () {   /* "Documents: Documents" said nothing once the rules got neutral names (review 22): only rules that differ from their kind */
        var bits = KINDS.map(function (x) { var r = nrule(p, use[x[0]] || NDEF[x[0]]), kn = k(x[1], x[2]), rn = r ? rname(r) : '–'; return rn === kn ? '' : kn + ': ' + rn; }).filter(Boolean);
        return bits.length ? bits.join(' · ') : k('ui.dcn-rules-std', 'The ready-made rules for documents, photos and drawings'); })()) + '</small></summary>';
    h += '<p class="dcn-h">' + esc(k('ui.dcn-used-for', 'Used for')) + '</p><div class="dcn-usegrid">' + KINDS.map(function (x) { return '<label><span>' + esc(k(x[1], x[2])) + '</span><select data-dcnuse-k="' + x[0] + '">' + opts(use[x[0]] || NDEF[x[0]]) + '</select></label>'; }).join('') + '</div>';
    var row = function (r) {
      var on = sel && sel.id === r.id, ex = exName(p, r);
      return '<li class="dcn-rrow' + (on ? ' on' : '') + '"><div class="dcn-rhead"><span class="dcn-rn"><b>' + esc(rname(r)) + '</b>' + (r.b ? ' <span class="dcn-bb">Boligbygg</span>' : '') + '<code data-noi18n>' + ex.html + '</code></span><span class="dcn-ract">' +
        (r.b ? '' : '<button type="button" class="icon-btn sm" data-dcnedit="' + esc(r.id) + '" aria-pressed="' + on + '" aria-label="' + esc(k('ui.dcn-edit', 'Change the rule')) + '" title="' + esc(k('ui.dcn-edit', 'Change the rule')) + '"><i class="bi bi-pencil"></i></button>') +
        '<button type="button" class="icon-btn sm" data-dcncopy="' + esc(r.id) + '" aria-label="' + esc(k('ui.dcn-copy', 'Copy this rule')) + '" title="' + esc(k('ui.dcn-copy', 'Copy this rule')) + '"><i class="bi bi-copy"></i></button>' +
        (r.b ? '' : '<button type="button" class="icon-btn sm" data-dcndel="' + esc(r.id) + '" aria-label="' + esc(k('ui.dcn-del', 'Delete the rule')) + '" title="' + esc(k('ui.dcn-del', 'Delete the rule')) + '"><i class="bi bi-trash3"></i></button>') + '</span></div>' + ('') + '</li>';
    };
    h += '<div class="dcn-b dcn-newb"><button type="button" class="pill-btn" data-dcnnew><i class="bi bi-plus-lg"></i> ' + esc(k('ui.dcn-new', 'New rule')) + '</button></div>' +
      '<p class="dcn-h">' + esc(k('ui.dcn-own', 'Your rules')) + ' <span class="muted">' + own.length + '</span></p>' +
      (own.length ? '<ul class="dcn-rlist">' + own.map(row).join('') + '</ul>' : '<p class="muted dc-help">' + esc(k('ui.dcn-own-none', 'None yet – make one, or copy a ready-made one and change it.')) + '</p>') +
      
      ownCodes(p) + lrnBox() +
      '<details class="dcn-bbl"><summary>' + esc(k('ui.dcn-bb-rules', 'Ready-made rules ({n}) – copy one to start from it', { n: R.length - own.length })) + '</summary><ul class="dcn-rlist">' + R.filter(function (r) { return r.b; }).map(row).join('') + '</ul></details>';
    if (sel && !sel.b) h += '</details><div class="dcn-ov dc-host" data-dcnov><div class="dcn-sheet" role="dialog" aria-modal="true" aria-label="' + esc(k('ui.dcn-edit', 'Change the rule')) + '"><div class="dcn-shead"><b>' + esc(rname(sel)) + '</b><button type="button" class="icon-btn" data-dcndone aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' + editor(p, sel) + '</div></div>';
    else h += '</details>';
    return h;
  }
  /* where the code names live: Team – one record for the whole team (admins import); cmd – your own codes in the vault (synced to your devices);
     else this device only (JP 2026-11-17 09:37 "saved … to my colleagues") */
  function nsWhere() { return HOST && HOST.nsShared ? 'team' : !HOST && window.Features && window.Features.tools ? 'me' : 'here'; }
  function nsCount() { var o = Object.assign({}, nsNames(), LP && LP.ownMap ? LP.ownMap() : {}); return Object.keys(o).length; }
  function nsBox() {
    var n = nsCount(), w = nsWhere(), can = w !== 'team' || (HOST.nsCan && HOST.nsCan());
    var where = w === 'team' ? k('ui.dcn-ns-team', 'Shared with everyone in the team') : w === 'me' ? k('ui.dcn-ns-me', 'Saved with your codes – on all your devices') : k('ui.dcn-ns-here', 'Kept on this device only');
    return '<div class="dcn-nsimp"><span><b>' + esc(k('ui.dcn-ns-names', 'Names for the NS 3451 codes')) + '</b><small class="muted">' + esc((n ? k('ui.dcn-ns-n2', '{n} names', { n: n }) + ' · ' : k('ui.dcn-ns-from', 'From your own copy of the standard – a file, or lines like “231 Bærende yttervegger”.') + ' ') + where + (can ? '' : ' · ' + k('ui.dcn-ns-admin', 'an admin imports them'))) + '</small></span>' +
      (can ? '<span class="dcn-b"><label class="dc-chip"><i class="bi bi-upload"></i> ' + esc(k('ui.dcn-ns-file', 'Import from a file')) + '<input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" data-dcnnsf hidden></label>' +
      '<button type="button" class="pill-btn sm ghost" data-dcnnsp><i class="bi bi-clipboard"></i> ' + esc(k('ui.dcn-ns-paste', 'Paste')) + '</button>' + (n && w !== 'me' ? '<button type="button" class="pill-btn sm ghost" data-dcnnsx><i class="bi bi-trash3"></i> ' + esc(k('ui.dcn-ns-clear', 'Remove the names')) + '</button>' : '') + '</span>' : '') +
      (nsp && can ? '<textarea data-dcnnst rows="6" maxlength="300000" placeholder="231 Bærende yttervegger&#10;232 Ikke-bærende yttervegger" aria-label="' + esc(k('ui.dcn-ns-names', 'Names for the NS 3451 codes')) + '"></textarea><span class="dcn-b"><button type="button" class="pill-btn" data-dcnnss><i class="bi bi-check2"></i> ' + esc(k('ui.dcn-ns-save', 'Save the names')) + '</button></span>' : '') + '</div>';
  }
  var nsp = false;
  function nsSave(m) {
    var n = Object.keys(m).length, w = nsWhere(), done = function () { toast('<i class="bi bi-check2"></i> ' + esc(n ? k('ui.dcn-ns-saved', '{n} code names saved', { n: n }) : k('ui.dcn-ns-nothing', 'No codes with names found'))); draw(); };
    if (!n) { done(); return; }
    if (w === 'team') { Promise.resolve(HOST.nsSave(m)).then(done); return; }
    if (w === 'me') { var Fe0 = window.Features, t = Fe0.tools(), mm = {}; (Array.isArray(t.fdvcodes) ? t.fdvcodes : []).forEach(function (c) { if (c && c.c) mm[c.c] = c; }); Object.keys(m).forEach(function (c) { mm[c] = { c: c, n: m[c] }; });
      t.fdvcodes = Object.keys(mm).sort().map(function (c) { return mm[c]; }).slice(0, 3000); Fe0.saveTools(t); done(); return; }
    var o = nsNames(); Object.keys(m).forEach(function (c) { o[c] = m[c]; }); try { localStorage.setItem(NSK, JSON.stringify(o)); } catch (e) {} done();
  }
  function nsClear() { if (nsWhere() === 'team') { Promise.resolve(HOST.nsSave(null)).then(function () { draw(); }); return; } try { localStorage.removeItem(NSK); } catch (e) {} draw(); }
  /* "Learned from corrections" – only for JP (whoever keeps the code template); the others never see what it learned (JP 16:34, 16:56) */
  function lrnBox() {
    if (!seeWhy()) return '';
    var L = lrnGet(), d = LDAY(), all = Object.keys(L.w || {}), pct = L.k + L.x ? Math.round(100 * L.k / (L.k + L.x)) : null;
    var bestOf = function (m) { var o = Object.keys(m || {}).sort(function (a, b) { return m[b] - m[a]; }); return o[0] ? [o[0], Math.round(m[o[0]])] : null; };
    var W = all.map(function (x) { var e = L.w[x]; return { x: x, c: bestOf(e.c), t: bestOf(e.t), a: e.a || d }; }).filter(function (r) { return (r.c && r.c[1] >= 1) || (r.t && r.t[1] >= 1); })
      .sort(function (a, b) { return ((b.c ? b.c[1] : 0) + (b.t ? b.t[1] : 0)) - ((a.c ? a.c[1] : 0) + (a.t ? a.t[1] : 0)); });
    var nm = function (x) { return x.charAt(0) === '#' ? x.slice(1) : x.charAt(0) === '.' ? k('ui.dcn-lrn-ext', '{e} files', { e: x }) : x; };
    return '<details class="dcn-bbl dcn-lrn"><summary>' + esc(k('ui.dcn-lrn-t2', 'Learned from corrections')) + ' <span class="muted">' + esc(k('ui.dcn-lrn-sum', 'from {n} files', { n: L.n || 0 }) + (pct != null ? ' · ' + k('ui.dcn-lrn-pct', '{p} % of the suggestions kept', { p: pct }) : '') + (L.sc ? ' · ' + k('ui.dcn-lrn-sc', '{n} scanned files read', { n: L.sc }) : '')) + '</span></summary>' +
      '<p class="muted dc-help">' + esc(k('ui.dcn-lrn-help2', 'Every file that gets its final name teaches the suggestions: its words, its maker and the kind of document → the code and type it ended with. One choice is only a hint; a few make it the suggestion, and the newest wins. Only you see this list – remove anything learned wrong.')) + '</p>' +
      (W.length ? '<ul class="dcn-lrnl">' + W.slice(0, 300).map(function (r) { return '<li><span><b data-noi18n>' + esc(nm(r.x)) + '</b> → <span data-noi18n>' + esc([r.c ? r.c[0] + (codeName(r.c[0]) ? ' ' + codeName(r.c[0]) : '') + ' (' + r.c[1] + '×)' : '', r.t ? r.t[0] + ' (' + r.t[1] + '×)' : ''].filter(Boolean).join(' · ')) + '</span></span><button type="button" class="icon-btn sm" data-dcnlrx="' + esc(r.x) + '" aria-label="' + esc(k('ui.dcn-lrn-x', 'Forget this')) + '" title="' + esc(k('ui.dcn-lrn-x', 'Forget this')) + '"><i class="bi bi-trash3"></i></button></li>'; }).join('') + '</ul>' : '<p class="muted dc-help">' + esc(k('ui.dcn-lrn-none', 'Nothing learned yet.')) + '</p>') + '</details>';
  }
  function ownCodes(p) {
    var h = nsBox() + '<p class="dcn-h">' + esc(k('ui.dcn-own-codes', 'Your codes')) + ' <span class="muted">' + esc(k('ui.dcn-own-codes-s', 'extra choices in the lists – or pick “+ Own code” in a list')) + '</span></p>', any = 0;
    var chips = function (w, x) { var O = clist(w, x[0], p), ed = w === 'm' || canT(); if (!O.length) return ''; any = 1; return '<div class="dcn-oc"><span>' + esc(k(x[1], x[2])) + (cstore() === 'team' ? ' · ' + esc(w === 't' ? k('ui.dcn-codes-team', 'The team’s codes') : k('ui.dcn-codes-mine', 'My codes')) : '') + '</span>' + O.map(function (y) { return '<span class="dc-chip dcn-ochip"><b data-noi18n>' + esc(y[0]) + '</b>' + (y[1] ? ' <span data-noi18n>' + esc(y[1]) + '</span>' : '') + (ed ? '<button type="button" data-dcnodel="' + esc(w + ':' + x[0] + ':' + y[0]) + '" aria-label="' + esc(k('ui.delete', 'Delete')) + '"><i class="bi bi-x-lg"></i></button>' : '') + '</span>'; }).join('') + '</div>'; };
    OWNK.forEach(function (x) { h += chips('t', x) + (cstore() === 'team' ? chips('m', x) : ''); });
    return h + '<div class="dcn-oadd"><select data-dcnoa aria-label="' + esc(k('ui.dcn-own-for', 'For')) + '">' + OWNK.map(function (x) { return '<option value="' + x[0] + '">' + esc(k(x[1], x[2])) + '</option>'; }).join('') + '</select>' +
      '<input data-dcnoc maxlength="40" placeholder="' + esc(k('ui.dcn-own-c', 'Code or text, e.g. E2')) + '" aria-label="' + esc(k('ui.dcn-own-c', 'Code or text, e.g. E2')) + '"><input data-dcnom maxlength="60" placeholder="' + esc(k('ui.dcn-own-m', 'What it means (optional)')) + '" aria-label="' + esc(k('ui.dcn-own-m', 'What it means (optional)')) + '">' +
      '<button type="button" class="pill-btn" data-dcnoadd><i class="bi bi-plus-lg"></i> ' + esc(k('ui.dcn-own-addb', 'Add')) + '</button></div>';
  }
  /* the rule editor is a popup (JP 2026-11-17 "pop up a screen instead of … scroll all the way down"): drawn with the rules, then moved to <body> so no card clips it */
  function lift() { setTimeout(function () { var L = document.querySelectorAll('body > .dcn-ov.dcn-lifted'), F = [].filter.call(document.querySelectorAll('.dcn-ov'), function (x) { return x.parentNode !== document.body; });
    if (!F.length && (nsel || nfo) && document.querySelector('#wkDocCtl .dcn-files, #wkDocCtl .dcn-rules, #dcPopHold .dcn-files')) return; [].forEach.call(L, function (x) { x.remove(); }); F.forEach(function (x) { x.classList.add('dcn-lifted'); document.body.appendChild(x); }); document.documentElement.classList.toggle('dcn-modal', !!F.length); }, 0); }
  function editor(p, r) {
    var b = exName(p, r), seg = function (attr, list, cur) { return '<span class="dcn-seg" role="group">' + list.map(function (x) { return '<button type="button" ' + attr + '="' + esc(x[0]) + '" aria-pressed="' + (x[0] === cur) + '">' + esc(x[1]) + '</button>'; }).join('') + '</span>'; };
    var h = '<div class="dcn-ed2"><label class="dcn-fl"><span>' + esc(k('ui.dcn-rname', 'Rule name')) + '</span><input data-dcnr="n" value="' + esc(r.n) + '" maxlength="60"></label>' +
      '<div class="dcn-prev"><span>' + esc(k('ui.dcn-example', 'Example (a made-up datasheet, 442 DA)')) + '</span><code data-noi18n>' + (b.html || '‹' + esc(k('ui.dcn-empty-rule', 'add a part below')) + '›') + '.pdf</code></div>' +
      '<p class="dcn-h">' + esc(k('ui.dcn-parts', 'The parts, in order')) + ' <span class="muted">' + esc(k('ui.dcn-parts-s', 'tap one to move, remove or set it')) + '</span></p><div class="dcn-pills">';
    r.parts.forEach(function (q, i) {
      var on = i === npi;   /* arrows only on the part you tapped – fewer buttons (JP 22:30 "got worse") */
      h += '<span class="dcn-pill' + (on ? ' on' : '') + (q.req === false ? ' opt' : '') + '">' + (on && i ? '<button type="button" data-dcnpm="' + i + ':-1" aria-label="' + esc(k('ui.dcn-up', 'Move up')) + '"><i class="bi bi-chevron-left"></i></button>' : '') +
        '<button type="button" class="dcn-pname" data-dcnpsel="' + i + '" aria-pressed="' + on + '">' + esc(partName(q.k) + (q.k === 'text' && q.text ? ' «' + q.text + '»' : '')) + (q.req === false ? ' ?' : '') + '</button>' +
        (on && i < r.parts.length - 1 ? '<button type="button" data-dcnpm="' + i + ':1" aria-label="' + esc(k('ui.dcn-down', 'Move down')) + '"><i class="bi bi-chevron-right"></i></button>' : '') +
        (on ? '<button type="button" data-dcnpd="' + i + '" aria-label="' + esc(k('ui.dcn-remove-part', 'Remove the part')) + '"><i class="bi bi-x-lg"></i></button>' : '') + '</span>';
    });
    h += '<select class="dcn-padd" data-dcnpa aria-label="' + esc(k('ui.dcn-add-part', 'Add a part')) + '"><option value="">' + esc(k('ui.dcn-add-part2', '+ Add a part …')) + '</option>' + Object.keys(NPART).map(function (x) { return '<option value="' + x + '">' + esc(partName(x)) + '</option>'; }).join('') + '</select>';
    h += '</div>';
    var q = r.parts[npi];
    if (q) h += '<div class="dcn-popt"><b>' + esc(partName(q.k)) + '</b>' +
      '<label class="dcn-req"><input type="checkbox" data-dcnpr="' + npi + '"' + (q.req === false ? '' : ' checked') + '> ' + esc(k('ui.dcn-required', 'Required')) + '</label>' +
      (npi ? '<label class="dcn-fl"><span>' + esc(k('ui.dcn-joined', 'Joined to the part before with')) + '</span><select data-dcnpp="' + npi + '"><option value="">' + esc(k('ui.dcn-as-rule', 'As the rule')) + '</option>' + NSEP.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (q.pre === x[0] ? ' selected' : '') + '>' + esc(k(x[1], x[2])) + '</option>'; }).join('') + '</select></label>' : '') +
      (q.k === 'text' ? '<label class="dcn-fl"><span>' + esc(partName('text')) + '</span><input data-dcnpt="' + npi + '" value="' + esc(q.text || '') + '" maxlength="30"></label>' : '') +
      (q.k === 'date' ? '<label class="dcn-fl"><span>' + esc(partName('date')) + '</span><select data-dcnpf="' + npi + '">' + [['iso', '2026-11-16'], ['compact', '20261116'], ['no', '16.11.2026']].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === (q.fmt || 'iso') ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' : '') + '</div>';
    h += '<div class="dcn-segs"><div><span>' + esc(k('ui.dcn-sep', 'Between the parts')) + '</span>' + seg('data-dcnsepb', NSEP.map(function (x) { return [x[0], x[0] === ' ' ? '␣' : x[0].trim() === '–' && x[0].length > 1 ? '␣–␣' : x[0]]; }), r.sep) + '</div>' +
      '<div><span>' + esc(k('ui.dcn-case', 'Letters')) + '</span>' + seg('data-dcncsb', [['keep', k('ui.dcn-cs-keep', 'As typed')], ['upper', 'ABC'], ['lower', 'abc']], r.cs || 'keep') + '</div></div>' +
      '<div class="dcn-b"><button type="button" class="pill-btn dx-pri" data-dcndone><i class="bi bi-check2"></i> ' + esc(k('ui.dx-done', 'Done')) + '</button></div></div>';
    return h;
  }
  var PV = { bno: ['bid', 'ui.dx-bno', 'Building number (for drawings)', 'ui.dx-bno-ph', 'e.g. 11621', 'numeric'], unit: ['pid', 'ui.dx-pid', 'Property ID', 'ui.dx-pid-ph', 'e.g. 3-1234', ''],
    pname: ['pname', 'ui.dx-pname', 'Property name', 'ui.dx-pname-ph', 'e.g. Made-up school', ''], proj: ['no', 'ui.dx-pno', 'Project number', 'ui.dx-pno-ph', 'e.g. P-123', ''] };
  function pvField(p, key, needed, big, inFile) {
    var d = PV[key], v = p[d[0]] || '';
    return '<label class="dcn-fl dcn-bno"><span>' + esc(k(d[1], d[2])) + '</span><input data-dcnpv="' + d[0] + '"' + (key === 'bno' ? ' data-dcnbid' : '') + ' value="' + esc(v) + '" maxlength="60"' + (d[5] ? ' inputmode="' + d[5] + '"' : '') + ' placeholder="' + esc(k(d[3], d[4])) + '"' + (needed && !v ? ' class="dcn-need"' : '') + '>' +
      (big ? '<small>' + esc(inFile ? k('ui.dcn-pv-all', 'The same for all the files') : k('ui.dcn-pv-s', 'Used in every name that has it, and kept for the next files')) + '</small>' : '') + '</label>';
  }
  /* ---------- several files at once (JP 2026-11-19): a checkbox on each line, a bar with the changes, one popup per change, Undo ---------- */
  var PKS = {}, pkP = '', pvOpen = false;
  function pkOn(id) { return pkP === cur() && !!PKS[id]; }
  function pkN() { return pkP === cur() ? Object.keys(PKS).length : 0; }
  function pkFix(p) { if (pkP !== cur()) { PKS = {}; pkP = cur(); } var have = {}; (p.files || []).forEach(function (f) { have[f.id] = 1; }); Object.keys(PKS).forEach(function (id) { if (!have[id]) delete PKS[id]; }); }
  function pkSet(ids, on) { if (pkP !== cur()) { PKS = {}; pkP = cur(); } ids.forEach(function (id) { if (on) PKS[id] = 1; else delete PKS[id]; }); }
  function picked() { var p = proj(cur()) || {}; pkFix(p); return (p.files || []).filter(function (f) { return PKS[f.id]; }).map(function (f) { return f.id; }); }
  /* choose by kind (JP 2026-11-24 "the danger is the tegning also get named"): Documents (n) · Drawings (n) · Photos (n), shown when the list has more than one kind */
  function kindChips(G) { var c = { doc: 0, drawing: 0, photo: 0 }; G.forEach(function (f) { if (!f.nf) c[fkind(f)]++; }); if ((c.doc ? 1 : 0) + (c.drawing ? 1 : 0) + (c.photo ? 1 : 0) < 2) return '';
    return [['doc', k('ui.dcn-pk-docs', 'Documents ({n})', { n: c.doc })], ['drawing', k('ui.dcn-pk-dwgs', 'Drawings ({n})', { n: c.drawing })], ['photo', k('ui.dcn-pk-pics', 'Photos ({n})', { n: c.photo })]].filter(function (x) { return c[x[0]]; }).map(function (x) { return '<button type="button" class="pill-btn sm ghost" data-dcnpks="kind:' + x[0] + '">' + esc(x[1]) + '</button>'; }).join(''); }
  function bulkPop(kind) {
    var p = proj(cur()); if (!p) return; var F = (p.files || []).filter(function (f) { return PKS[f.id] && !f.nf; }); if (!F.length) return;
    var old = document.querySelector('.dcn-bulk'); if (old) { if (old.__close) old.__close(); else old.remove(); }   /* a popup opened again closes the old one properly (its Escape listener too) */
    /* drawings and photos stay out of code and name changes unless you take them in (JP 2026-11-24); a type is only for documents; removing takes all */
    var odd = F.filter(function (f) { return fkind(f) !== 'doc'; }), inc = false, nDw = odd.filter(function (f) { return fkind(f) === 'drawing'; }).length, nPh = odd.length - nDw;
    var docsOf = function () { return kind === 'type' || ((kind === 'code' || kind === 'name') && !inc) ? F.filter(function (f) { return fkind(f) === 'doc'; }) : F; }, docs = docsOf();
    var own = kind === 'code' ? docs.filter(function (f) { return f.p.code && !(f.sg && f.sg.c); }) : kind === 'type' ? docs.filter(function (f) { return f.p.abbr && !(f.sg && f.sg.t); }) : [];
    var readyOf = function () { return kind === 'name' ? docs.filter(function (f) { var b = nbuild(p, f); return !b.miss.length && b.plain + ext(f.orig || f.name) !== f.name; }) : []; }, ready = readyOf();
    var oddBox = function () { if ((kind !== 'code' && kind !== 'name') || !odd.length) return ''; var w = [nDw ? k(nDw === 1 ? 'ui.dcn-bk-dw1' : 'ui.dcn-bk-dwn', nDw === 1 ? '1 drawing' : '{n} drawings', { n: nDw }) : '', nPh ? k(nPh === 1 ? 'ui.dcn-bk-ph1' : 'ui.dcn-bk-phn', nPh === 1 ? '1 photo' : '{n} photos', { n: nPh }) : ''].filter(Boolean).join(k('ui.dcn-and', ' and '));
      return '<label class="dcn-bkown dcn-bkodd"><input type="checkbox" data-bkodd' + (inc ? ' checked' : '') + '><span><b>' + esc(k('ui.dcn-bk-odd', '{w} are among them – left out', { w: w })) + '</b><small>' + esc(k('ui.dcn-bk-odd-in', 'Take them in too – they keep their own naming rule')) + '</small></span></label>'; };
    var val = '', over = false, ov = document.createElement('div'); ov.className = 'dcn-ov dc-host dcn-bulk';
    var title = { code: k('ui.dcn-bk-code-t', 'Change the code for {n} files', { n: F.length }), type: k('ui.dcn-bk-type-t', 'Change the type for {n} files', { n: F.length }), name: k('ui.dcn-bk-name-t', 'Use the new name on {n} files', { n: F.length }), rm: k('ui.dcn-bk-rm-t', 'Remove {n} files from the list', { n: F.length }) }[kind];
    var names = function (L) { return esc(L.slice(0, 3).map(function (f) { return f.name; }).join(' · ')) + (L.length > 3 ? ' ' + esc(k('ui.dcn-bk-more', 'and {n} more', { n: L.length - 3 })) : ''); };
    var render = function () {
      var tgt = docs.filter(function (f) { return over || own.indexOf(f) < 0; }), label = val ? (kind === 'code' ? val + (codeName(val) ? ' ' + codeName(val) : '') : val + (catName(val) ? ' ' + catName(val) : '')) : '';
      var h = '<div class="dcn-sheet dcn-bksheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="dcn-shead"><b>' + esc(title) + '</b><button type="button" class="icon-btn" data-bkx aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>';
      if (kind === 'code') h += '<label class="dcn-c"><span>' + esc(k('ui.dcn-code', 'NS 3451 code')) + '</span><select data-bksel class="dcn-hsel" tabindex="-1" aria-hidden="true">' + codeOpts(p, { p: { code: val } }) + '</select><button type="button" class="dcn-cbtn" data-bkpick><span>' + esc(label || k('ui.dcn-choose-code', 'Choose a code')) + '</span><i class="bi bi-search"></i></button></label>';
      if (kind === 'type') h += '<label class="dcn-c"><span>' + esc(k('ui.dcn-type', 'Document type')) + '</span><select data-bksel>' + typeOpts(p, { p: { abbr: val } }) + '</select></label>';
      if (kind === 'code' || kind === 'type') {
        h += '<div class="dcn-bkbox">' + (val ? '<b>' + esc(k('ui.dcn-bk-get', 'These {n} get {v}:', { n: tgt.length, v: label })) + '</b><span>' + names(tgt) + '</span>' : '<span class="muted">' + esc(kind === 'code' ? k('ui.dcn-bk-pickc', 'Choose the code first.') : k('ui.dcn-bk-pickt', 'Choose the type first.')) + '</span>') +
          '<small class="muted">' + esc(kind === 'code' ? k('ui.dcn-bk-only-c', 'Only the code changes – the type and the description stay as they are.') : k('ui.dcn-bk-only-t', 'Only the type changes – the code and the description stay as they are.')) + (kind === 'type' && docs.length < F.length ? ' ' + esc(k('ui.dcn-bk-notdoc', '{n} are photos or drawings and are left out.', { n: F.length - docs.length })) : '') + '</small></div>';
        h += oddBox();
        if (own.length) h += '<label class="dcn-bkown"><input type="checkbox" data-bkover' + (over ? ' checked' : '') + '><span><b>' + esc(k('ui.dcn-bk-own', '{n} have one you set yourself', { n: own.length })) + '</b><small>' + esc(k('ui.dcn-bk-over', 'Overwrite them too ({v})', { v: own.slice(0, 4).map(function (f) { return kind === 'code' ? f.p.code : f.p.abbr; }).join(', ') + (own.length > 4 ? ' …' : '') })) + '</small></span></label>';
        h += '<div class="dcn-b dcn-bkbtns"><button type="button" class="pill-btn sm ghost" data-bkx>' + esc(k('ui.cancel', 'Cancel')) + '</button><button type="button" class="pill-btn" data-bkgo' + (val && tgt.length ? '' : ' disabled') + '>' + esc(val ? k('ui.dcn-bk-go', 'Set {v} on {n} files', { v: val, n: tgt.length }) : k('ui.dcn-bk-go0', 'Set it')) + '</button></div>';
      }
      if (kind === 'name') h += oddBox() + '<div class="dcn-bkbox"><b>' + esc(k('ui.dcn-bk-name', '{r} of the {n} are ready and get the new name.', { r: ready.length, n: docs.length })) + '</b>' + (ready.length ? '<span>' + names(ready) + '</span>' : '') + (docs.length > ready.length ? '<small class="muted">' + esc(k('ui.dcn-bk-name-no', 'The others still miss something, or already have it.')) + '</small>' : '') + '</div><div class="dcn-b dcn-bkbtns"><button type="button" class="pill-btn sm ghost" data-bkx>' + esc(k('ui.cancel', 'Cancel')) + '</button><button type="button" class="pill-btn" data-bkgo' + (ready.length ? '' : ' disabled') + '>' + esc(k('ui.dcn-bk-name-go', 'Rename {n}', { n: ready.length })) + '</button></div>';
      if (kind === 'rm') h += '<div class="dcn-bkbox"><span>' + names(F) + '</span><small class="muted">' + esc(k('ui.dcn-bk-rm', 'They only leave this list and the download – the files on your computer are not touched.')) + '</small></div><div class="dcn-b dcn-bkbtns"><button type="button" class="pill-btn sm ghost" data-bkx>' + esc(k('ui.cancel', 'Cancel')) + '</button><button type="button" class="pill-btn" data-bkgo>' + esc(k('ui.dcn-bk-rm-go', 'Remove {n}', { n: F.length })) + '</button></div>';
      ov.innerHTML = h + '</div>';
    };
    render();
    var close = function () { ov.remove(); document.removeEventListener('keydown', ek, true); document.documentElement.classList.toggle('dcn-modal', !!document.querySelector('.dcn-ov')); };
    ov.__close = close;
    var ek = function (e) { if (e.key === 'Escape' && !document.querySelector('.dcn-cpk')) { e.stopPropagation(); close(); } };
    var dn = null; ov.addEventListener('pointerdown', function (e) { dn = e.target; });
    ov.addEventListener('change', function (e) { if (e.target.matches('[data-bksel]')) { val = /^\s*([0-9A-Za-z.]+)/.exec(e.target.value || '') ? /^\s*([0-9A-Za-z.]+)/.exec(e.target.value)[1] : ''; render(); } else if (e.target.matches('[data-bkover]')) { over = e.target.checked; render(); } else if (e.target.matches('[data-bkodd]')) { inc = e.target.checked; docs = docsOf(); ready = readyOf(); own = kind === 'code' ? docs.filter(function (f) { return f.p.code && !(f.sg && f.sg.c); }) : own; render(); } });
    ov.addEventListener('click', function (e) {
      var t = e.target;
      if ((t === ov && dn === ov) || t.closest('[data-bkx]')) { close(); return; }
      if (t.closest('[data-bkpick]')) { cpick(ov.querySelector('[data-bksel]')); return; }
      var go = t.closest('[data-bkgo]'); if (!go || go.disabled) return;
      var ids = (kind === 'name' ? ready : kind === 'rm' ? F : docs.filter(function (f) { return over || own.indexOf(f) < 0; })).map(function (f) { return f.id; }), before = {}, n = 0;
      saveP(cur(), function (p2) {
        if (kind === 'rm') { before.__files = (p2.files || []).slice(); p2.files = (p2.files || []).filter(function (f) { return ids.indexOf(f.id) < 0; }); n = ids.length; return; }
        (p2.files || []).forEach(function (f) { if (ids.indexOf(f.id) < 0) return; before[f.id] = JSON.stringify({ p: f.p, sg: f.sg, name: f.name, orig: f.orig, iss: f.iss });
          if (kind === 'code') { f.p.code = val; if (f.sg) { delete f.sg.c; delete f.sg.alt; } learn(f, val); relink(p2, f); }
          else if (kind === 'type') { f.p.abbr = val; if (f.sg) delete f.sg.t; learnT(f, val); relink(p2, f); }
          else if (kind === 'name') { var b = nbuild(p2, f); rename(p2, f, b.plain + ext(f.orig || f.name)); teach(f); }
          n++; });
      });
      if (kind === 'rm') { pkSet(ids, false); if (I.removed) I.removed(ids); }
      close(); draw();
      var undo = function () { saveP(cur(), function (p3) { if (before.__files) { p3.files = before.__files; return; } (p3.files || []).forEach(function (f) { if (!before[f.id]) return; var o = JSON.parse(before[f.id]); f.p = o.p; if (o.sg) f.sg = o.sg; else delete f.sg; f.name = o.name; if (o.orig) f.orig = o.orig; else delete f.orig; f.iss = o.iss; relink(p3, f); }); }); draw(); };
      toast('<i class="bi bi-check2"></i> ' + esc(kind === 'rm' ? k('ui.dcn-bk-rm-done', '{n} removed from the list', { n: n }) : k('ui.dcn-bk-done', '{n} files changed', { n: n })), undo);
    });
    document.addEventListener('keydown', ek, true);
    document.body.appendChild(ov); document.documentElement.classList.add('dcn-modal');
  }
  function nfiles(p, F) {
    var h = rulesHtml(p);
    var todo = sugTodo(p).length;
    /* values for the whole batch (building number, property ID, property name, project number) – asked once, right here, where the names are
       (JP 2026-11-16 21:50 building number; 2026-11-17 09:18 "I cannot put the eiendoms-id") */
    var need = {}; F.forEach(function (f) { if (!f.nf) ruleFor(p, f).parts.forEach(function (q) { if (PV[q.k]) need[q.k] = 1; }); });
    /* shared by all the files (JP 2026-11-24): one calm line with Change; the fields open while one the names need is missing, or on Change – two per row, number beside name */
    var pk = ['bno', 'proj', 'unit', 'pname'].filter(function (key) { return need[key] || p[PV[key][0]]; }), pmiss = pk.filter(function (key) { return need[key] && !p[PV[key][0]]; });
    if (pk.length && (pvOpen || pmiss.length)) h += '<div class="dcn-pvbox"><div class="dcn-pvg">' + pk.map(function (key) { return pvField(p, key, !!need[key], false); }).join('') + '</div><p class="dcn-pvf"><small>' + esc(k('ui.dcn-pv-s', 'Used in every name that has it, and kept for the next files')) + '</small>' + (pmiss.length ? '' : '<button type="button" class="pill-btn sm ghost" data-dcnpvo>' + esc(k('ui.done', 'Done')) + '</button>') + '</p></div>';
    else if (pk.length) { var sh = []; if (p.bid) sh.push(k('ui.dcn-sh-b', 'Building {v}', { v: p.bid })); if (p.pid || p.pname) sh.push(k('ui.dcn-sh-p', 'Property {v}', { v: [p.pid, p.pname].filter(Boolean).join(' ') })); if (p.no) sh.push(k('ui.dcn-sh-n', 'Project {v}', { v: p.no }));
      h += '<div class="dcn-shared"><i class="bi bi-building" aria-hidden="true"></i><span><small>' + esc(k('ui.dcn-shared', 'Shared by all the files')) + '</small><span data-noi18n>' + esc(sh.join(' · ')) + '</span></span><button type="button" class="pill-btn sm ghost" data-dcnpvo>' + esc(k('ui.dcn-change', 'Change')) + '</button></div>'; }
    if (SUG[p.id]) h += '<p class="dc-facts"><button type="button" class="pill-btn" disabled aria-busy="true"><i class="bi bi-magic"></i> ' + esc(k('ui.dcn-reading', 'Reading the files …')) + '</button></p>';
    else if (todo) h += '<p class="dc-facts"><button type="button" class="pill-btn" data-dcnall><i class="bi bi-magic"></i> ' + esc(todo === 1 ? k('ui.dcn-all1', 'Suggest a code and check the file') : k('ui.dcn-all', 'Suggest codes and check {n} files', { n: todo })) + '</button></p>';
    h += sugBox(p);
    var many = F.length > 1, cnt = { todo: 0, ready: 0, done: 0 }; if (many) F.forEach(function (f) { cnt[fstate(p, f)]++; });
    if (many) h += '<div class="dcn-flt" role="group">' + [['', k('ui.dcn-f-all', 'All {n}', { n: F.length })], ['todo', k('ui.dcn-f-todo', 'Needs you {n}', { n: cnt.todo })], ['ready', k('ui.dcn-f-ready', 'Ready {n}', { n: cnt.ready })], ['done', k('ui.dcn-f-done', 'Done {n}', { n: cnt.done })]].map(function (c) { return '<button type="button" class="dc-chip" aria-pressed="' + (nflt === c[0]) + '" data-dcnflt="' + c[0] + '">' + esc(c[1]) + '</button>'; }).join('') + '</div>';
    var G = many && nflt ? F.filter(function (f) { return fstate(p, f) === nflt; }) : F;
    pkFix(p);
    /* Ready and Done are lists to look through, not to pick from – choosing what to download is in the download sheet (JP 2026-11-23) */
    var pick = many && nflt !== 'ready' && nflt !== 'done'; nopk = !pick;
    if (pick) { var nNo = F.filter(function (f) { return !f.nf && !f.p.code; }).length, nPk = pkN(), allOn = G.length && G.every(function (f) { return pkOn(f.id); });
      /* one box for all / none, with its words beside it (JP 2026-11-19 21:39: the box and "All" did the same) */
      h += '<div class="dcn-pkh"><label class="dcn-pkc dcn-pkall"><input type="checkbox" data-dcnpkall' + (allOn ? ' checked' : '') + '><span>' + esc(k('ui.dcn-pk-all-n', 'Select all ({n})', { n: G.length })) + '</span></label>' +
        (nNo ? '<button type="button" class="pill-btn sm ghost" data-dcnpks="nocode">' + esc(k('ui.dcn-pk-nocode2', 'Only those without a code ({n})', { n: nNo })) + '</button>' : '') + kindChips(G) + '</div>'; }
    h += '<ul class="dcn-files' + (pick ? '' : ' dcn-nopk') + '">' + G.map(function (f) { return nrow(p, f, many); }).join('') + '</ul>' + (many && !G.length ? '<p class="muted">' + esc(k('ui.dcn-f-none', 'None here.')) + '</p>' : '');
    nopk = false;
    var pkOdd = pick && pkN() ? (p.files || []).filter(function (f) { return pkOn(f.id) && !f.nf && fkind(f) !== 'doc'; }) : [], pkDw = pkOdd.filter(function (f) { return fkind(f) === 'drawing'; }).length;
    if (pick && pkN()) h += '<div class="dcn-pkact" role="toolbar" aria-label="' + esc(k('ui.dcn-pk-bar', 'Selected files')) + '"><b>' + esc(k('ui.dcn-pk-n', '{n} selected', { n: pkN() })) + '</b>' +
      (pkOdd.length ? '<span class="dcn-pkodd"><i class="bi bi-exclamation-circle"></i> ' + esc(pkDw ? (pkDw === 1 ? k('ui.dcn-pk-dwin1', 'incl. 1 drawing – left out unless you take it in') : k('ui.dcn-pk-dwin', 'incl. {n} drawings – left out unless you take them in', { n: pkDw })) : (pkOdd.length === 1 ? k('ui.dcn-pk-phin1', 'incl. 1 photo – left out unless you take it in') : k('ui.dcn-pk-phin', 'incl. {n} photos – left out unless you take them in', { n: pkOdd.length }))) + '</span>' : '') +
      '<button type="button" class="pill-btn" data-dcnpka="code">' + esc(k('ui.dcn-pk-code', 'Change code')) + '</button><button type="button" class="pill-btn sm ghost" data-dcnpka="type">' + esc(k('ui.dcn-pk-type', 'Change type')) + '</button>' +
      '<button type="button" class="pill-btn sm ghost" data-dcnpka="name">' + esc(k('ui.dcn-pk-name', 'Use the new name')) + '</button>' + (p.tool ? '<button type="button" class="pill-btn sm ghost dcn-danger" data-dcnpka="rm">' + esc(k('ui.dcn-pk-rm', 'Remove from the list')) + '</button>' : '') +
      '<button type="button" class="icon-btn" data-dcnpks="none" aria-label="' + esc(k('ui.dcn-pk-clear', 'Clear the selection')) + '"><i class="bi bi-x-lg"></i></button></div>';
    /* one file at a time in a popup over the list, with the one before / after (JP 2026-11-17 08:07: "lose control what is what") */
    LASTP = p.id; LASTF = F.map(function (f) { return f.id; });
    var ph = popHtml(p, F, G, many); if (ph) h += ph;
    else nfo = '';
    return h;
  }
  /* the file card's HTML on its own, so it can open without drawing the page again (JP 2026-11-27: one 42 ms frame) */
  var LASTP = '', LASTF = [];
  function popHtml(p, F, G, many) {
    var L2 = G.some(function (f) { return f.id === nfo; }) ? G : F, ix = -1; L2.forEach(function (f, i) { if (f.id === nfo) ix = i; });
    if (!(many && ix > -1)) return ''; var f0 = L2[ix], pv = L2[ix - 1], nx = L2[ix + 1];
    return '<div class="dcn-ov dc-host dcn-fpop" data-dcnov2><div class="dcn-sheet dcn-fsheet" role="dialog" aria-modal="true" aria-label="' + esc(f0.name) + '"><div class="dcn-shead">' +
        '<button type="button" class="icon-btn" data-dcnfgo="' + esc(pv ? pv.id : '') + '"' + (pv ? '' : ' disabled') + ' aria-label="' + esc(k('ui.dcn-prev', 'The file before')) + '"><i class="bi bi-chevron-left"></i></button>' +
        '<b class="dcn-fpos">' + esc(k('ui.dcn-fpos', 'File {i} of {n}', { i: ix + 1, n: L2.length })) + '</b>' +
        '<button type="button" class="icon-btn" data-dcnfgo="' + esc(nx ? nx.id : '') + '"' + (nx ? '' : ' disabled') + ' aria-label="' + esc(k('ui.dcn-next', 'The next file')) + '"><i class="bi bi-chevron-right"></i></button>' +
        '<span class="spacer"></span><button type="button" class="icon-btn" data-dcnfx aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
        '<ul class="dcn-files">' + nrow(p, f0) + '</ul></div></div>';
  }
  /* open / switch / close the card straight on the page: only the card is built (the list behind is as it was); the next real draw lays the
     same card in again and lift() swaps it without a replay */
  function quickPop() {
    var p = LASTP && proj(LASTP); if (!p || !nfo) return false;
    var byId = {}; (p.files || []).forEach(function (f) { byId[f.id] = f; }); var F = LASTF.map(function (id) { return byId[id]; }).filter(Boolean); if (F.length !== LASTF.length) return false;
    var many = F.length > 1, G = many && nflt ? F.filter(function (f) { return fstate(p, f) === nflt; }) : F, html = popHtml(p, F, G, many); if (!html) return false;
    var tmp = document.createElement('div'); tmp.innerHTML = html; var o = tmp.firstElementChild;
    if (window.I18N && I18N.walk) try { I18N.walk(o); } catch (e) {}
    var cur = document.querySelectorAll('.dcn-fpop:not(.ov-ghost)');
    /* moving to the file before / after: the card stays and only its sheet is swapped – replacing the whole full-screen card made the
       browser paint the entire screen again (50–100 ms on a laptop at 2× pixels, 2026-11-27) */
    if (cur.length === 1 && cur[0].parentNode === document.body && cur[0].firstElementChild && o.firstElementChild) { cur[0].classList.add('ov-still'); cur[0].replaceChild(o.firstElementChild, cur[0].firstElementChild); }   /* ov-still: the new sheet doesn't slide in again */
    else { [].forEach.call(cur, function (x) { x.remove(); }); o.classList.add('dcn-lifted'); document.body.appendChild(o); }
    document.documentElement.classList.add('dcn-modal');
    [].forEach.call(document.querySelectorAll('[data-dcnexp]'), function (x) { if (!x.closest('.dcn-fpop')) x.setAttribute('aria-expanded', String(x.dataset.dcnexp === nfo)); });
    return true;
  }
  function quickShut() {
    var had = false; [].forEach.call(document.querySelectorAll('.dcn-fpop:not(.ov-ghost)'), function (x) { x.remove(); had = true; });
    [].forEach.call(document.querySelectorAll('[data-dcnexp][aria-expanded="true"]'), function (x) { if (!x.closest('.dcn-fpop')) x.setAttribute('aria-expanded', 'false'); });
    if (!document.querySelector('.dcn-ov:not(.ov-ghost), .dx-tov:not(.ov-ghost)')) document.documentElement.classList.remove('dcn-modal');
    return had;
  }
  /* suggest a code and type from the name for every file, then read every PDF that hasn't been read (one at a time) */
  function suggestAll(pid, only, noSet) {   /* only: just these file ids (the files just uploaded to a project – JP 2026-11-24) */
    var pdfs = [], pics = []; saveP(pid, function (p) { (p.files || []).forEach(function (f) { if (f.nf || (only && only.indexOf(f.id) < 0)) return; if (!f.p.code || !f.p.abbr) { guessName(f, p); relink(p, f); } if (ext(f.name) === '.pdf' && !f.cc) pdfs.push(f.id); if (fkind(f) === 'photo' && !f.dt && !f.orig) pics.push(f); }); }); draw();
    pics.forEach(function (f) { getBlob(f.id).then(function (bl) { return bl ? photoDate(bl) : ''; }).then(function (d) { d = d || f.lm || ''; if (d) { saveP(pid, function (p) { var g = (p.files || []).filter(function (x) { return x.id === f.id; })[0]; if (g && !g.dt) g.dt = d; }); draw(); } }).catch(function () {}); });
    var run = pdfs.reduce(function (pr, id5) { return pr.then(function () { return new Promise(function (res) { ccRun(pid, id5); var w = setInterval(function () { if (!ccBusy[id5]) { clearInterval(w); res(); } }, 200); }); }); }, Promise.resolve());
    return run.then(function () { if (!noSet) saveP(pid, function (p) { sets(p, only); }); drawBg(); });
  }
  /* the button "Suggest codes and check the files" says what it does and what it found (JP 2026-11-25 "I tried pressing it but it does not work") */
  var SUG = {}, SUGM = {};
  function needsHelp(f) { return !f.nf && fkind(f) !== 'photo' && (!f.p.code || (fkind(f) === 'doc' && !f.p.abbr)); }
  function sugTodo(p) { return ((p && p.files) || []).filter(function (f) { return (needsHelp(f) && !f.tried) || (!f.nf && ext(f.name) === '.pdf' && !f.cc); }); }
  function sugRun(pid) {
    var p0 = proj(pid); if (!p0 || SUG[pid]) return; var ids = sugTodo(p0).map(function (f) { return f.id; }); if (!ids.length) return;
    SUG[pid] = 1; delete SUGM[pid]; draw();
    suggestAll(pid, ids, 1).then(function () {
      var miss = [];
      saveP(pid, function (p) { (p.files || []).forEach(function (f) { if (ids.indexOf(f.id) < 0) return; f.tried = 1; if (needsHelp(f) && !(f.sg && f.sg.alt)) miss.push([f.id, f.name, !f.p.code ? 'c' : 't']); }); });
      SUGM[pid] = { n: ids.length, miss: miss }; delete SUG[pid]; draw();
    }).catch(function () { delete SUG[pid]; draw(); });
  }
  function sugBox(p) {
    var m = SUGM[p.id]; if (!m || SUG[p.id]) return '';
    if (!m.miss.length) return '<p class="dc-note dcn-sugok"><i class="bi bi-check2-circle"></i> ' + esc(k('ui.dcn-sug-all', 'Every file got a suggestion – check them below.')) + ' <button type="button" class="text-btn" data-dcnsugx>' + esc(k('ui.dcn-sug-ok', 'OK')) + '</button></p>';
    return '<div class="dcn-sugm"><p><b>' + esc(m.miss.length === 1 ? k('ui.dcn-sug-none1', 'No suggestion for 1 file') : k('ui.dcn-sug-none', 'No suggestion for {n} files', { n: m.miss.length })) + '</b> <button type="button" class="text-btn" data-dcnsugx>' + esc(k('ui.dcn-sug-ok', 'OK')) + '</button></p><ul>' +
      m.miss.slice(0, 12).map(function (x) { return '<li><button type="button" class="text-btn" data-dcnexp="' + esc(x[0]) + '"><span data-noi18n>' + esc(x[1]) + '</span></button><small>' + esc(x[2] === 'c' ? k('ui.dcn-sug-nocode', 'Found no code in the name or the text – choose one yourself') : k('ui.dcn-sug-notype', 'Found no document type – choose one yourself')) + '</small></li>'; }).join('') +
      (m.miss.length > 12 ? '<li class="muted">' + esc(k('ui.dcn-sug-more', '… and {n} more', { n: m.miss.length - 12 })) + '</li>' : '') + '</ul></div>';
  }
  /* "Use this name" for every file whose rule has nothing missing – returns how many got a new name */
  function useAll(pid) { var n = 0; saveP(pid, function (p) { (p.files || []).forEach(function (f) { if (f.nf) return; var b = nbuild(p, f), nm = b.plain + ext(f.orig || f.name); if (!b.miss.length && nm !== f.name) { rename(p, f, nm); teach(f); n++; } }); }); draw(); return n; }
  function ready(p, f) { var b = nbuild(p, f); return !b.miss.length; }
  /* the name a file leaves with: the rule's name when nothing is missing, else the name it has (download in the rename tool – JP 22:30) */
  function newName(p, f) { var b = nbuild(p, f); return b.miss.length ? f.name : b.plain + ext(f.orig || f.name); }
  function busy() { return Object.keys(ccBusy).length; }
  function ruleEdit(fn) { saveP(cur(), function (p) { var r = (p.nrules || []).filter(function (x) { return x.id === nsel; })[0]; if (r) fn(r, p); }); draw(); }
  var downAt = null;
  function bgClick(t) { return t && t.classList && t.classList.contains('dcn-ov') && downAt === t; }
  function listen() {
    on('pointerdown', function (e) { downAt = e.target; }, true);
    on('keydown', function (e) { if (e.key !== 'Escape' || !document.querySelector('.dcn-ov')) return; if (nsel) { nsel = ''; npi = -1; draw(); } else if (nfo) { nfo = ''; draw(); } });
    /* naming events (the Files tab) */
    on('change', function (e) {
      var t = e.target; if (!t.matches || !t.closest('#wkDocCtl, .dcn-ov, #dcPopHold')) return; var v = t.value, fid;
      if (v === '__ownedit') { var ek0 = t.dataset.dcncode ? 'code' : t.dataset.dcntype ? 'type' : String(t.dataset.dcnv || '').split(':')[1]; t.value = t.dataset.prev || ''; draw(); if (ek0) codesPop(ek0); return; }
      if (v === '__own' && t.dataset.dcncode) { nown = t.dataset.dcncode + ':code'; draw(); setTimeout(function () { var i = document.querySelector('[data-dcnownf] [data-dcnoc]'); if (i) i.focus(); }, 30); return; }
      if (t.matches && t.matches('[data-dcnpk]')) { pkSet([t.dataset.dcnpk], t.checked); draw(); return; }
      if (t.matches && t.matches('[data-dcnpkall]')) { var pq = proj(cur()) || {}, FQ = (pq.files || []).filter(function (f) { return !f.nf && (!nflt || fstate(pq, f) === nflt); }); pkSet(FQ.map(function (f) { return f.id; }), t.checked); draw(); return; }
      if ((fid = t.dataset.dcncode)) { var m = /^\s*(\d{3,4}(?:\.\d+)?)\b/.exec(v) || (v.trim() ? [0, v.trim()] : null); if (!m) return; saveP(cur(), function (p) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (!f) return; f.p.code = m[1]; if (f.sg) { delete f.sg.c; delete f.sg.alt; } learn(f, m[1]); relink(p, f); }); draw(); return; }
      if (v === '__own' && (t.dataset.dcntype || t.dataset.dcnv)) { nown = t.dataset.dcntype ? t.dataset.dcntype + ':type' : t.dataset.dcnv; draw(); setTimeout(function () { var i = document.querySelector('[data-dcnownf] [data-dcnoc]'); if (i) i.focus(); }, 30); return; }
      if (t.hasAttribute('data-dcnoa')) return;
      if (t.hasAttribute('data-dcnnsf') && t.files && t.files[0]) { var rd = new FileReader(); rd.onload = function () { nsSave(parseNS(String(rd.result || ''))); }; rd.readAsText(t.files[0]); t.value = ''; return; }
      if ((fid = t.dataset.dcntype)) { saveP(cur(), function (p) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (!f) return; f.p.abbr = v; if (f.sg) delete f.sg.t; learnT(f, v); relink(p, f); }); draw(); return; }
      if ((fid = t.dataset.dcnk)) { saveP(cur(), function (p) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (f) f.nk = v; }); draw(); return; }
      if (t.dataset.dcnv) { var a = t.dataset.dcnv.split(':'); if (a[1] === 'floor' && v) try { localStorage.setItem('dcn.floor', v); } catch (e) {} saveP(cur(), function (p) { var f = (p.files || []).filter(function (x) { return x.id === a[0]; })[0]; if (f) { f.nv = f.nv || {}; f.nv[a[1]] = v.slice(0, 80); } }); draw(); return; }
      if (t.dataset.dcnpv) { var pf = t.dataset.dcnpv; saveP(cur(), function (p) { p[pf] = v.trim().slice(0, 60); }); if (document.activeElement === t) t.blur(); draw(); return; }
      if (t.dataset.dcnuseK) { saveP(cur(), function (p) { p.nuse = Object.assign({}, p.nuse); p.nuse[t.dataset.dcnuseK] = v; }); draw(); return; }
      if (t.dataset.dcnr) { ruleEdit(function (r) { r[t.dataset.dcnr] = t.dataset.dcnr === 'n' ? v.slice(0, 60) || r.n : v; }); return; }
      if (t.dataset.dcnpr) { ruleEdit(function (r) { r.parts[+t.dataset.dcnpr].req = t.checked ? undefined : false; }); return; }
      if (t.dataset.dcnpp) { ruleEdit(function (r) { var q = r.parts[+t.dataset.dcnpp]; if (v === '' && t.selectedIndex === 0) delete q.pre; else q.pre = v; }); return; }
      if (t.dataset.dcnpt) { ruleEdit(function (r) { r.parts[+t.dataset.dcnpt].text = v.slice(0, 30); }); return; }
      if (t.dataset.dcnpf) { ruleEdit(function (r) { r.parts[+t.dataset.dcnpf].fmt = v; }); return; }
      if (t.matches('[data-dcnpa]') && v) { ruleEdit(function (r) { r.parts.push(v === 'date' ? { k: v, fmt: 'iso' } : { k: v }); npi = r.parts.length - 1; }); return; }
    });
    on('toggle', function (e) { if (e.target.matches && e.target.matches('[data-dcnrules]')) nopen = e.target.open; }, true);
    on('click', function (e) {
      var t = e.target, b; if (!t.closest || !t.closest('#wkDocCtl, .dcn-ov, #dcPopHold')) return;
      var fileOf = function (p, id) { return (p.files || []).filter(function (x) { return x.id === id; })[0]; };
      if ((b = t.closest('[data-dcnuse]'))) { var id = b.dataset.dcnuse; saveP(cur(), function (p) { var f = fileOf(p, id); if (!f) return; var nb2 = nbuild(p, f); if (!nb2.miss.length) { rename(p, f, nb2.plain + ext(f.orig || f.name)); teach(f); } }); if (nfo === id) { var PF = ((proj(cur()) || {}).files || []).filter(function (x) { return !x.nf; }), j = -1; PF.forEach(function (x, i) { if (x.id === id) j = i; }); var P2 = proj(cur()), left = function (x) { return x.id !== id && fstate(P2, x) !== 'done'; }, nxf = PF.slice(j + 1).filter(left)[0] || PF.filter(left)[0];   /* renamed – on to the next file that still needs it */
        if (nxf) nfo = nxf.id; else { nfo = ''; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); toast('<i class="bi bi-check2-circle"></i> ' + esc(k('ui.dcn-all-done', 'All the files have their new names'))); } }   /* none left: the popup closes (JP 2026-11-26 10:17) */ draw(); return; }
      /* "Fill in floor and room first": takes you to the first empty field of that file (JP 2026-11-24) */
      if ((b = t.closest('[data-dcnfill]'))) { var card = b.closest('.dcn-row'), nd = card && (card.querySelector('.dcn-s .dcn-need, .dcn-s input:not([value]), .dcn-s input[value=""]') || card.querySelector('[data-dcncpick]')); if (nd) { nd.scrollIntoView({ block: 'center', behavior: 'smooth' }); nd.focus(); if (nd.matches('[data-dcncpick]')) nd.click(); } return; }
      if ((b = t.closest('[data-dcnpvo]'))) { pvOpen = !pvOpen; draw(); if (pvOpen) setTimeout(function () { var i = document.querySelector('.dcn-pvbox input'); if (i) i.focus(); }, 30); return; }
      if ((b = t.closest('[data-dcnorig]'))) { var id2 = b.dataset.dcnorig; saveP(cur(), function (p) { var f = fileOf(p, id2); if (f && f.orig) { rename(p, f, f.orig); delete f.orig; } }); draw(); return; }
      if ((b = t.closest('[data-dcnalt]'))) { var pa = b.dataset.dcnalt.split('|'); saveP(cur(), function (p) { var f = fileOf(p, pa[0]); if (!f) return; f.p.code = pa[1]; if (f.sg) { delete f.sg.alt; delete f.sg.c; } learn(f, pa[1]); relink(p, f); }); draw(); return; }
      if ((b = t.closest('[data-dcnlrx]'))) { var L0 = lrnGet(), x0 = b.dataset.dcnlrx, e0 = L0.w[x0]; delete L0.w[x0]; lrnSave(); draw(); if (e0) toast('<i class="bi bi-trash3"></i> ' + esc(k('ui.dcn-lrn-gone', 'Forgotten')), function () { lrnGet().w[x0] = e0; lrnSave(); draw(); }); return; }
      if ((b = t.closest('[data-dcnok]'))) { var id3 = b.dataset.dcnok; saveP(cur(), function (p) { var f = fileOf(p, id3); if (f) { teach(f); delete f.sg; } }); draw(); return; }
      if ((b = t.closest('[data-dcncc]'))) { ccRun(cur(), b.dataset.dcncc); return; }
      if ((b = t.closest('[data-dcnuset], [data-dcnusec]'))) { var id4 = b.dataset.dcnuset || b.dataset.dcnusec, isT = !!b.dataset.dcnuset; saveP(cur(), function (p) { var f = fileOf(p, id4); if (!f || !f.cc) return; if (isT && f.cc.t) f.p.abbr = f.cc.t[0]; if (!isT && f.cc.c) f.p.code = f.cc.c[0]; relink(p, f); }); draw(); return; }
      var unfocus = function () { var a = document.activeElement; if (a && a.blur && a !== document.body) a.blur(); };   /* a page draw waits while a field has focus */
      if (t.closest('[data-dcnnsp]')) { nsp = !nsp; draw(); return; }
      if (t.closest('[data-dcnnss]')) { var ta = document.querySelector('[data-dcnnst]'); nsp = false; unfocus(); nsSave(parseNS(ta ? ta.value : '')); return; }
      if (t.closest('[data-dcnnsx]')) { nsClear(); return; }
      if ((b = t.closest('[data-dcncpick]'))) { var sel0 = b.parentNode.querySelector('select[data-dcncode]'); if (sel0) cpick(sel0); return; }
      if ((b = t.closest('[data-dcnpick]'))) { var pk = b.dataset.dcnpick.split('|'); saveP(cur(), function (p) { var f = fileOf(p, pk[0]); if (!f) return; if (pk[1] === 'code') { f.p.code = pk[2]; if (f.sg) delete f.sg.c; } else { f.p.abbr = pk[2]; if (f.sg) delete f.sg.t; } relink(p, f); }); draw(); return; }
      if (t.closest('[data-dcnocan]')) { nown = ''; unfocus(); draw(); return; }
      if ((b = t.closest('[data-dcnosave]'))) { var fw = b.closest('[data-dcnownf]'), oa = fw.dataset.dcnownf.split(':'), oc = nclean(fw.querySelector('[data-dcnoc]').value).slice(0, 40), om = fw.querySelector('[data-dcnom]').value.trim().slice(0, 60), keep = fw.querySelector('[data-dcnor]').checked;
        if (!oc) { fw.querySelector('[data-dcnoc]').focus(); return; }
        if (keep) addCode(oa[1], oc, om); saveP(cur(), function (p) { var f = fileOf(p, oa[0]); if (!f) return; if (oa[1] === 'type') { f.p.abbr = oc; if (f.sg) delete f.sg.t; relink(p, f); } else if (oa[1] === 'code') { f.p.code = oc; if (f.sg) delete f.sg.c; relink(p, f); } else { f.nv = f.nv || {}; f.nv[oa[1]] = oc; } }); nown = ''; unfocus(); draw(); return; }
      if ((b = t.closest('[data-dcnodel]'))) { var od = b.dataset.dcnodel.split(':'); codeDel(od[0], od[1], od.slice(2).join(':')); return; }
      if ((b = t.closest('[data-dcnoadd]'))) { var fa = b.closest('.dcn-oadd'), ak = fa.querySelector('[data-dcnoa]').value, ac = nclean(fa.querySelector('[data-dcnoc]').value).slice(0, 40), am = fa.querySelector('[data-dcnom]').value.trim().slice(0, 60);
        if (!ac) { fa.querySelector('[data-dcnoc]').focus(); return; } addCode(ak, ac, am); unfocus(); draw(); return; }
      if (t.closest('[data-dcnall]')) { sugRun(cur()); return; }
      if (t.closest('[data-dcnsugx]')) { delete SUGM[cur()]; draw(); return; }
      if ((b = t.closest('[data-dcnpks]'))) { var pp = proj(cur()) || {}, FF = (pp.files || []).filter(function (f) { return !f.nf; }), wk = b.dataset.dcnpks; pkFix(pp);
        if (wk.indexOf('kind:') === 0) { var kk = wk.slice(5); PKS = {}; pkSet((nflt ? FF.filter(function (f) { return fstate(pp, f) === nflt; }) : FF).filter(function (f) { return fkind(f) === kk; }).map(function (f) { return f.id; }), true); draw(); return; }   /* only that kind – the rest is unticked */
        if (wk === 'none') PKS = {}; else pkSet((wk === 'nocode' ? FF.filter(function (f) { return !f.p.code; }) : (nflt ? FF.filter(function (f) { return fstate(pp, f) === nflt; }) : FF)).map(function (f) { return f.id; }), true); draw(); return; }
      if ((b = t.closest('[data-dcnpka]'))) { bulkPop(b.dataset.dcnpka); return; }
      if ((b = t.closest('[data-dcnexp]'))) { nfo = b.dataset.dcnexp; if (!quickPop()) draw(); return; }   /* only the card is built (2026-11-27) */
      if ((b = t.closest('[data-dcnfgo]'))) { if (b.dataset.dcnfgo) { nfo = b.dataset.dcnfgo; unfocus(); if (!quickPop()) draw(); } return; }
      if (t.closest('[data-dcnfx]') || (t.matches && t.matches('[data-dcnov2]') && bgClick(t))) { nfo = ''; unfocus(); if (!quickShut()) draw(); return; }
      if ((b = t.closest('[data-dcnflt]'))) { nflt = b.dataset.dcnflt; draw(); return; }
      if ((b = t.closest('[data-dcnsel]'))) { nsel = b.dataset.dcnsel; nopen = true; draw(); return; }
      if ((b = t.closest('[data-dcnedit]'))) { nfo = ''; nsel = nsel === b.dataset.dcnedit ? '' : b.dataset.dcnedit; npi = -1; nopen = true; draw(); return; }
      if (t.closest('[data-dcndone]') || (t.matches && t.matches('[data-dcnov]') && bgClick(t))) { nsel = ''; npi = -1; draw(); return; }
      if ((b = t.closest('[data-dcnpsel]'))) { npi = npi === +b.dataset.dcnpsel ? -1 : +b.dataset.dcnpsel; draw(); return; }
      if ((b = t.closest('[data-dcnpadd]'))) { var pk = b.dataset.dcnpadd; ruleEdit(function (r) { r.parts.push(pk === 'date' ? { k: pk, fmt: 'iso' } : { k: pk }); npi = r.parts.length - 1; }); return; }
      if ((b = t.closest('[data-dcnsepb]'))) { var sv = b.dataset.dcnsepb; ruleEdit(function (r) { r.sep = sv; }); return; }
      if ((b = t.closest('[data-dcncsb]'))) { var cv = b.dataset.dcncsb; ruleEdit(function (r) { r.cs = cv; }); return; }
      if (t.closest('[data-dcnnew], [data-dcncopy]')) { nfo = ''; var cb = t.closest('[data-dcncopy]'), src = cb ? nrule(proj(cur()), cb.dataset.dcncopy) || NRULES[0] : { sep: ' ', cs: 'keep', parts: [{ k: 'code' }, { k: 'type' }, { k: 'desc' }] }, nr = JSON.parse(JSON.stringify(src)); nr.id = 'own-' + uid(); nr.n = cb ? k('ui.dcn-copy-of', 'Copy of {r}', { r: rname(src) }) : k('ui.dcn-my-rule', 'My rule'); delete nr.b; nsel = nr.id; npi = -1; nopen = true;
        saveP(cur(), function (p) { p.nrules = (p.nrules || []).concat([nr]).slice(0, 20); }); draw(); return; }
      if ((b = t.closest('[data-dcndel]'))) { var gone = b.dataset.dcndel || nsel; saveP(cur(), function (p) { p.nrules = (p.nrules || []).filter(function (r) { return r.id !== gone; }); Object.keys(p.nuse || {}).forEach(function (x) { if (p.nuse[x] === gone) delete p.nuse[x]; }); }); nsel = ''; draw(); return; }
      if ((b = t.closest('[data-dcnpm]'))) { var mv = b.dataset.dcnpm.split(':').map(Number); ruleEdit(function (r) { var j = mv[0] + mv[1], x = r.parts[mv[0]]; r.parts[mv[0]] = r.parts[j]; r.parts[j] = x; }); return; }
      if ((b = t.closest('[data-dcnpd]'))) { ruleEdit(function (r) { r.parts.splice(+b.dataset.dcnpd, 1); }); return; }
    });
  }
  window.DocNaming = { approved: approved, teach: function (f) { teach(f); }, learnState: function () { return JSON.parse(JSON.stringify(lrnGet())); }, picked: picked, view: view, use: use, files: nfiles, guess: guessName, suggestAll: suggestAll, useAll: useAll, ready: ready, newName: newName, busy: busy };
})();
