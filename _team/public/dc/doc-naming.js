/* Copied from cmd/doc-naming.js by _team/build.py – edit it there, not here. */
/* Document control → file naming (JP 2026-11-16, a test – loaded only where it is switched on, dash.dcNaming = '1'; in Team
   open once with ?naming=1). Each file gets an NS 3451 code and a document type (Boligbygg's Tillegg A letters), a name from
   the project's naming rule (Boligbygg's documents / photos / drawings, or your own), and a content check of PDFs read in this
   browser (pdf.js from vendor/, fetched the first time; nothing is sent). Saved on the file (f.p.code/abbr, f.nv the parts you
   typed, f.orig the name it came with, f.sg what was suggested, f.cc the check's findings – never the text) and on the project
   (p.nrules own rules, p.nuse the rule per kind of file), so Team keeps them in the project.
   doc-control.page.js loads this file (cmd and Team's copy) and hands it its helpers with DocNaming.use(api). */
(function () {
  "use strict";
  var I, esc, k, toast, uid, saveP, proj, draw, getBlob, lineOf, unlink, bestLine, parseName, pairs, issueText, linkOpts, codeName, lineTitle, ABBR, TEG, FAG, PAIR, today, pad, LP, HOST;
  var ON = [];
  function on(t, f, c) { document.addEventListener(t, f, c); ON.push([t, f, c]); }
  function cur() { return I.cur(); }
  function use(api) {
    I = api; esc = api.esc; k = api.k; toast = api.toast; uid = api.uid; saveP = api.saveP; proj = api.proj; draw = function () { window.__dcUser = Date.now(); var r = api.draw.apply(this, arguments); lift(); return r; }; drawBg = function () { var r = api.draw.apply(this, arguments); lift(); return r; }; getBlob = api.getBlob; lineOf = api.lineOf; unlink = api.unlink; bestLine = api.bestLine;
    parseName = api.parseName; pairs = api.pairs; issueText = api.issueText; linkOpts = api.linkOpts; codeName = function (c) { var c3 = String(c || '').slice(0, 3), own = LP && LP.ownMap ? LP.ownMap() : {}, n = nsNames()[c3] || own[c3]; return n || api.codeName(c); }; lineTitle = api.lineTitle; ABBR = api.ABBR; TEG = api.TEG; FAG = api.FAG; PAIR = api.PAIR; today = api.today; pad = api.pad; LP = api.LP; HOST = api.HOST;
    ON.forEach(function (x) { document.removeEventListener(x[0], x[1], x[2]); }); ON = []; listen();   /* the page may run again (instant page changes): one set of listeners, on its newest helpers */
  }
  function nb() { return window.I18N && I18N.lang === 'nb'; }
  var CATN = [['DA', 'Dataark', 'Datasheet'], ['SE', 'Samsvarserklæring', 'Declaration of conformity'], ['DV', 'Instrukser og anvisninger (FDV)', 'Operation and maintenance'], ['FB', 'Funksjonsbeskrivelse', 'Function description'],
    ['SP', 'Spesifikasjoner', 'Specifications'], ['PK', 'Protokoller, garanti', 'Protocols, warranty'], ['PR', 'Prosedyrer for drift og vedlikehold', 'Procedures'], ['PL', 'Planer, KS, opplæring', 'Plans, quality, training'],
    ['LI', 'Lister, dokumentplan', 'Lists, document plan'], ['NO', 'Notat', 'Note'], ['RA', 'Rapporter, beregninger', 'Reports, calculations'], ['SK', 'Skjema', 'Form'], ['BM', 'BIM-strategi', 'BIM strategy'], ['BF', 'BIM følgeskriv', 'BIM cover letter'],
    ['OK', 'Avtaledokument', 'Agreement'], ['RF', 'Referat', 'Minutes'], ['MR', 'Månedsrapport', 'Monthly report'], ['PA', 'Prosjekteringsanvisning', 'Design guideline'], ['PD', 'Premissdokument', 'Premise document'], ['PP', 'Presentasjon', 'Presentation'], ['ST', 'Strategidokument', 'Strategy'], ['SD', 'Styringsdokument', 'Governing document']];
  function catName(a) { var c = CATN.filter(function (x) { return x[0] === a; })[0]; return c ? (nb() ? c[1] : c[2]) : ''; }
  var FLOORS = ['K02', 'K01', 'U02', 'U01', 'H01', 'H02', 'H03', 'H04', 'H05', 'L01', 'T01', '000'], DTYPES = ['B', 'D', 'F', 'O', 'P', 'S', 'T', 'U'];
  /* what the letters mean – Boligbygg's FDVU specification, tables 8–11 (JP 2026-11-16 21:21 "make it easier to pick") */
  var MEAN = {
    floor: { K02: ['2. kjelleretasje', '2nd basement'], K01: ['1. kjelleretasje', '1st basement'], U02: ['2. underetasje', '2nd lower floor'], U01: ['1. underetasje', '1st lower floor'], H01: ['1. hovedetasje', '1st main floor'], H02: ['2. hovedetasje', '2nd main floor'], H03: ['3. hovedetasje', '3rd main floor'], H04: ['4. hovedetasje', '4th main floor'], H05: ['5. hovedetasje', '5th main floor'], L01: ['1. loftsetasje', '1st attic floor'], T01: ['Takplan (utvendig)', 'Roof plan (outside)'], '000': ['Generelt', 'General'] },
    disc: { A: ['Arkitekt', 'Architect'], B: ['Byggeteknikk (RIB)', 'Structural (RIB)'], C: ['Akustikk', 'Acoustics'], E: ['Elektro (RIE)', 'Electrical (RIE)'], F: ['Brannrådgiver (RIBr)', 'Fire consultant (RIBr)'], I: ['Interiørarkitekt', 'Interior architect'], H: ['Heis', 'Lifts'], K: ['Konsulent (spesial)', 'Consultant (special)'], T: ['Tele og automatisering', 'Telecom and automation'], V: ['VVS – varme, ventilasjon, sanitær (RIV)', 'HVAC and plumbing (RIV)'],
      G: ['Geoteknikk og grunnarbeider (RIG) – generell', 'Geotechnics and groundworks (RIG) – general'], L: ['Landskapsarkitekt (LARK) – generell', 'Landscape architect (LARK) – general'], M: ['Miljørådgiver (RIM) – generell', 'Environmental (RIM) – general'], R: ['Reguleringsarkitekt – generell', 'Zoning architect – general'], W: ['Vei og trafikk – generell', 'Roads and traffic – general'] },
    dtype: { B: ['Bygningsmessige / utsparingstegninger', 'Builder’s work / openings'], D: ['Detalj(er)', 'Detail(s)'], F: ['Fasade', 'Facade'], O: ['Oppriss', 'Elevation'], P: ['Plan', 'Plan'], S: ['Snitt', 'Section'], T: ['Skjema', 'Schematic'], U: ['Utendørs / terrengarbeider', 'Outdoor / site works'] } };
  function mean(key, x, p) { var m = MEAN[key] && MEAN[key][x]; return m ? (nb() ? m[0] : m[1]) : p ? ownMean(p, key, x) : ''; }
  /* your own codes (JP 2026-11-16 22:30 "custom code in the drop down … or free text"): p.ncodes[part] = [[code, meaning]] – shown in the lists under "Your codes" */
  var OWNK = [['code', 'ui.dcn-code', 'NS 3451 code'], ['type', 'ui.dcn-type', 'Document type'], ['floor', 'ui.dcn-p-floor', 'Floor'], ['disc', 'ui.dcn-p-disc', 'Discipline'], ['dtype', 'ui.dcn-p-dtype', 'Drawing type']];
  function owns(p, key) { return ((p && p.ncodes) || {})[key] || []; }
  function ownMean(p, key, x) { var o = owns(p, key).filter(function (y) { return y[0] === x; })[0]; return o ? o[1] || '' : ''; }
  var nown = '';
  function ownOpts(p, key, v, known) {
    var O = owns(p, key).filter(function (y) { return known.indexOf(y[0]) < 0; }), free = v && known.indexOf(v) < 0 && !O.some(function (y) { return y[0] === v; }), o = function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === v ? ' selected' : '') + '>' + esc(x[0] + (x[1] ? ' – ' + x[1] : '')) + '</option>'; };
    return (O.length ? '<optgroup label="' + esc(k('ui.dcn-own-codes', 'Your codes')) + '">' + O.map(o).join('') + '</optgroup>' : '') + (free ? '<option value="' + esc(v) + '" selected>' + esc(v) + '</option>' : '') +
      '<option value="__own">' + esc(k('ui.dcn-own-add', '+ Own code or free text …')) + '</option>';
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
  var NRULES = [{ id: 'bby-doc', b: 1, n: ['ui.dcn-r-doc', 'Boligbygg – documents'], sep: ' ', cs: 'keep', parts: [{ k: 'code' }, { k: 'type' }, { k: 'desc' }] },
    { id: 'bby-photo', b: 1, n: ['ui.dcn-r-photo', 'Boligbygg – photos'], sep: '–', cs: 'keep', parts: [{ k: 'unit' }, { k: 'floor' }, { k: 'room' }, { k: 'free' }, { k: 'date', fmt: 'iso' }] },
    { id: 'bby-dwg', b: 1, n: ['ui.dcn-r-dwg', 'Boligbygg – drawings as built'], sep: '-', cs: 'keep', parts: [{ k: 'bno' }, { k: 'floor' }, { k: 'disc' }, { k: 'code' }, { k: 'dtype' }, { k: 'run' }, { k: 'desc', pre: ' – ' }] }];
  var NDEF = { doc: 'bby-doc', photo: 'bby-photo', drawing: 'bby-dwg' };
  function nrules(p) { return NRULES.concat((p && p.nrules) || []); }
  function nrule(p, id) { return nrules(p).filter(function (r) { return r.id === id; })[0] || null; }
  function rname(r) { return r.b ? k(r.n[0], r.n[1]) : r.n; }
  function fkind(f) { if (f.nk) return f.nk; var e = (String(f.name).match(/\.([a-z0-9]{2,5})$/i) || ['', ''])[1].toLowerCase(); if (/^(jpe?g|png|heic|heif|webp|gif)$/.test(e)) return 'photo'; return f.p && f.p.kind === 'drawing' || /^(dwg|dxf|ifc)$/.test(e) ? 'drawing' : 'doc'; }
  function ruleFor(p, f) { var u = (p.nuse || {})[fkind(f)]; return nrule(p, u) || nrule(p, NDEF[fkind(f)]); }
  function ext(n) { return (String(n).match(/(\.[a-z0-9]{2,5})$/i) || ['', ''])[1].toLowerCase(); }
  function drawn(f) { var m = String(f.orig || f.name).replace(/\.[a-z0-9]{2,5}$/i, '').match(TEG); return m ? { floor: m[2], disc: m[3], dtype: m[5] } : {}; }
  function nval(p, f, part) {
    var v = f.nv || {}, d = drawn(f), x;
    switch (part.k) {
      case 'code': return f.p && f.p.code || ''; case 'type': return f.p && f.p.abbr || ''; case 'typename': return catName(f.p && f.p.abbr) || ownMean(p, 'type', f.p && f.p.abbr);
      case 'proj': return p.no || ''; case 'bno': return p.bid || ''; case 'unit': return p.pid || ''; case 'pname': return p.pname || '';
      case 'contractor': return v.contractor != null ? v.contractor : p.who || '';
      case 'desc': return v.desc != null ? v.desc : f.p && f.p.text || '';
      case 'floor': case 'disc': case 'dtype': return v[part.k] != null ? v[part.k] : d[part.k] || (part.k === 'disc' ? guessDisc(f.p && f.p.code) : part.k === 'dtype' ? guessDtype(f.orig || f.name) : '');
      case 'rev': x = String(v.rev || '').trim(); return x ? 'Rev' + x : '';
      case 'date': var t = new Date(), y = t.getFullYear(), mo = pad(t.getMonth() + 1), da = pad(t.getDate()); return part.fmt === 'compact' ? '' + y + mo + da : part.fmt === 'no' ? da + '.' + mo + '.' + y : y + '-' + mo + '-' + da;
      case 'run': var n = 0, kd = fkind(f), c = f.p && f.p.code; (p.files || []).some(function (o) { if (fkind(o) === kd && (o.p && o.p.code) === c) n++; return o.id === f.id; }); return pad(Math.max(1, n));
      case 'text': return part.text || '';
      default: return v[part.k] || '';
    }
  }
  /* the closest codes / types from the text as buttons you can pick (JP 2026-11-17) */
  function pick(f, key, L) { return ' ' + L.map(function (x) { var on = key === 'code' ? String(f.p.code || '').slice(0, 3) === x : f.p.abbr === x; return '<button type="button" class="dc-chip dcn-pk' + (on ? ' on' : '') + '" data-dcnpick="' + esc(f.id + '|' + key + '|' + x) + '" aria-pressed="' + on + '">' + esc(x + (key === 'code' ? ' ' + (codeName(x) || '') : ' · ' + catName(x))) + '</button>'; }).join(''); }
  function addOwn(p, key, c, m) { p.ncodes = Object.assign({}, p.ncodes); var L = (p.ncodes[key] || []).filter(function (y) { return y[0] !== c; }); L.push([c, m || '']); p.ncodes[key] = L.slice(-60); }
  function nclean(s) { return String(s).replace(/[\/\\:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim(); }
  /* the name a rule gives this file: plain text, the parts still missing, and HTML with the gaps marked */
  function nbuild(p, f, r) {
    r = r || ruleFor(p, f); var segs = [], miss = [];
    r.parts.forEach(function (q) {
      var v = nclean(nval(p, f, q)); if (v && r.cs === 'upper') v = v.toUpperCase(); else if (v && r.cs === 'lower') v = v.toLowerCase();
      if (!v) { if (q.req === false) return; miss.push(q.k); segs.push({ q: q, v: '‹' + partName(q.k).toLowerCase() + '›', gap: 1 }); return; }
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
  /* learned codes: words from the file names you corrected → the code you chose. Team: one shared record (DStore 'nslearn'); cmd: your tools (synced); else this device */
  var LKEY = 'dcn.nslearn', LRN = null, LRNat = 0;
  var NOTW = /^(pdf|docx?|xlsx?|dwg|nor|nob|eng|tds|fdv|fdvu|datablad|teknisk|technical|data|sheet|produkt|product|dokument|document|versjon|version|norsk|english|final|ferdig|kopi|copy|scan|skann)$/;
  function lrnWhere() { return HOST && HOST.team && HOST.store ? 'team' : !HOST && window.Features && window.Features.tools ? 'me' : 'here'; }
  function lrnGet() {
    var w = lrnWhere();
    if (w === 'team') { if (!LRN || Date.now() - LRNat > 10000) { LRNat = Date.now(); LRN = LRN || { w: {} }; Promise.resolve(HOST.store.get('nslearn')).then(function (o) { if (o && o.w) LRN = o; }).catch(function () {}); } return LRN; }
    if (LRN) return LRN;
    LRN = { w: {} };
    try { if (w === 'me') { var t = window.Features.tools(); if (t.fdvlearn && t.fdvlearn.w) LRN = JSON.parse(JSON.stringify(t.fdvlearn)); } else { var o = JSON.parse(localStorage.getItem(LKEY) || 'null'); if (o && o.w) LRN = o; } } catch (e) {}
    return LRN;
  }
  function lrnSave() {
    var L = lrnGet(), W = Object.keys(L.w); if (W.length > 3000) W.slice(0, W.length - 3000).forEach(function (x) { delete L.w[x]; });
    var w = lrnWhere();
    if (w === 'team') { HOST.store.put('nslearn', L); return; }
    if (w === 'me') { var Fe0 = window.Features, t = Fe0.tools(); t.fdvlearn = L; Fe0.saveTools(t); return; }
    try { localStorage.setItem(LKEY, JSON.stringify(L)); } catch (e) {}
  }
  function lwords(name) { var seen = {}; return String(name || '').toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '').split(/[^a-zæøåäöü]+/).filter(function (w) { if (w.length < 4 || NOTW.test(w) || STOPW.indexOf(' ' + w + ' ') >= 0 || seen[w]) return false; seen[w] = 1; return true; }).slice(0, 8); }
  function learn(f, code) {
    if (!f || !/^\d{3}/.test(code || '')) return;
    var L = lrnGet(); lwords(f.orig || f.name).forEach(function (w) { var e = L.w[w] = L.w[w] || {}; e[code] = (e[code] || 0) + 1; });
    lrnSave();
  }
  function learnedFor(name) {
    var L = lrnGet(), sc = {}, hit = {};
    lwords(name).forEach(function (w) { var e = L.w[w]; if (!e) return; Object.keys(e).forEach(function (c) { sc[c] = (sc[c] || 0) + e[c]; if (!hit[c] || e[c] > hit[c][1]) hit[c] = [w, e[c]]; }); });
    var o = Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a]; });
    if (!o.length || (o[1] && sc[o[0]] < sc[o[1]] * 2)) return null;
    return { k: o[0], s: sc[o[0]], w: hit[o[0]][0] };
  }
  function whyL(x) { return k('ui.dcn-why-learned', 'learned from earlier choices (“{w}”)', { w: x.w }); }
  function strong(l) { return l[0] && l[0].s >= 5 && (!l[1] || l[0].s >= l[1].s * 1.5) ? l[0] : null; }
  function why(x, src) { var h = x.h[0]; return (src === 'n' ? k('ui.dcn-why-name', 'the file name has “{w}”', { w: h[0] }) : k('ui.dcn-why-text', 'found “{w}” {n}× in the text', { w: h[0], n: h[1] })) + (h[2] ? ' · ' + k('ui.dcn-why-p1', 'also on page 1') : ''); }
  /* a file without a code or type: guess from words in its name (marked as suggested until you say it looks right) */
  function guessName(f) {
    if (fkind(f) === 'photo') return; var low = String(f.p && f.p.stem || f.name).toLowerCase().replace(/[_]+/g, ' ');
    if (!f.p.code) { var lc = learnedFor(f.orig || f.name), cs = lc ? [] : scoreCodes(low, ''), c = lc || strong(cs) || (cs[0] && (!cs[1] || cs[0].s >= cs[1].s * 2) ? cs[0] : null);
      if (c) { f.p.code = c.k; f.sg = Object.assign({}, f.sg, { c: lc ? whyL(lc) : why(c, 'n') }); if (f.sg.alt) delete f.sg.alt; }
      else if (cs.length > 1) f.sg = Object.assign({}, f.sg, { alt: cs.slice(0, 2).map(function (x) { return [x.k, why(x, 'n')]; }) }); }
    if (f.p.code && !f.p.abbr) { var t = scoreKw(TKW, low, '')[0]; if (t && t.s >= 3) { f.p.abbr = t.k; f.sg = Object.assign({}, f.sg, { t: why(t, 'n') }); } }
  }
  /* keep every word of the file name, add only what the content adds (K200 EC is already in K200EC – JP 11:43) */
  function mergeDesc(a, b) { var sq = function (x) { return x.toLowerCase().replace(/[^a-z0-9æøå]+/g, ''); }, have = sq(a), add = []; String(b || '').split(/\s+/).forEach(function (w) { var q = sq(w); if (q && have.indexOf(q) < 0) { add.push(w); have += q; } }); return (a + ' ' + add.join(' ')).replace(/\s+/g, ' ').trim(); }

  /* ---------- the content check: the PDF's text read here with pdf.js (main thread; the first 40 pages) ---------- */
  var PDFJS = null, ccText = {}, ccBusy = {};
  function pdfLib() {
    var base = HOST ? '/dc/vendor/' : '/cmd/vendor/';
    var load = function (src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load')); }; document.head.appendChild(s); }); };
    if (!PDFJS) PDFJS = (window.pdfjsLib ? Promise.resolve() : load(base + 'pdf.min.js?v=3.11.174')).then(function () { return window.pdfjsWorker ? 1 : load(base + 'pdf.worker.min.js?v=3.11.174'); }).then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js?v=3.11.174'; return window.pdfjsLib; });   /* the worker script loaded first = pdf.js runs it here (Team's strict CSP allows only its own scripts) */
    PDFJS.catch(function () { PDFJS = null; });
    return PDFJS;
  }
  /* see a file in a popup over the page instead of a new tab (JP 2026-11-17 07:53): PDF pages drawn with pdf.js (first 40), pictures, text; others offer Download */
  function view(blob, name) {
    var old = document.querySelector('.dx-fv'); if (old) old.remove();
    var url = URL.createObjectURL(blob), e0 = ext(name), pdf = e0 === '.pdf' || blob.type === 'application/pdf', img = /^\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/.test(e0) || /^image\//.test(blob.type), txt = /^\.(txt|csv|tsv|xml|json|md)$/.test(e0);
    var ov = document.createElement('div'); ov.className = 'dcn-ov dc-host dx-fv';
    ov.innerHTML = '<div class="dcn-sheet dx-fvs" role="dialog" aria-modal="true" aria-label="' + esc(name) + '"><div class="dcn-shead"><b data-noi18n>' + esc(name) + '</b><span class="dcn-b"><a class="dc-chip" href="' + url + '" download="' + esc(name) + '"><i class="bi bi-download"></i> ' + esc(k('ui.download', 'Download')) + '</a>' +
      '<button type="button" class="icon-btn" data-dxfvx aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></span></div><div class="dx-fvb">' +
      (img ? '<img src="' + url + '" alt="">' : pdf || txt ? '<p class="muted">' + esc(k('ui.dx-fv-loading', 'Opening …')) + '</p>' : '<p class="muted">' + esc(k('ui.dx-fv-none', 'No preview for this kind of file – download it to open it.')) + '</p>') + '</div></div>';
    var close = function () { ov.remove(); URL.revokeObjectURL(url); document.removeEventListener('keydown', ek, true); document.documentElement.classList.remove('dcn-modal'); };
    var ek = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    var dn = null; ov.addEventListener('pointerdown', function (e) { dn = e.target; });
    ov.addEventListener('click', function (e) { if ((e.target === ov && dn === ov) || e.target.closest('[data-dxfvx]')) close(); });
    document.addEventListener('keydown', ek, true); document.body.appendChild(ov); document.documentElement.classList.add('dcn-modal');
    var body = ov.querySelector('.dx-fvb'), bt = ov.querySelector('[data-dxfvx]'); if (bt) bt.focus();
    if (txt) blob.text().then(function (t) { var pre = document.createElement('pre'); pre.textContent = t.slice(0, 200000); body.innerHTML = ''; body.appendChild(pre); });
    if (pdf) blob.arrayBuffer().then(function (buf) { return pdfLib().then(function (lib) { return lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise; }); }).then(function (doc) {
      body.innerHTML = ''; var W = Math.min(body.clientWidth || 800, 900), n = Math.min(doc.numPages, 40), chain = Promise.resolve();
      for (var i = 1; i <= n; i++) (function (i) { chain = chain.then(function () { if (!ov.isConnected) return; return doc.getPage(i).then(function (pg) {
        var v1 = pg.getViewport({ scale: 1 }), dpr = Math.min(window.devicePixelRatio || 1, 2), sc = W / v1.width, vp = pg.getViewport({ scale: sc * dpr }), c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height; c.style.width = Math.round(vp.width / dpr) + 'px'; body.appendChild(c); return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; }); }); })(i);
      chain.then(function () { if (doc.numPages > n && ov.isConnected) { var m = document.createElement('p'); m.className = 'muted'; m.textContent = k('ui.dx-fv-more', 'Showing the first {n} of {t} pages – download for the rest.', { n: n, t: doc.numPages }); body.appendChild(m); } });
    }).catch(function () { body.innerHTML = '<p class="muted">' + esc(k('ui.dx-fv-bad', 'Could not show this PDF – download it to open it.')) + '</p>'; });
    return ov;
  }
  function pdfText(blob) {
    return blob.arrayBuffer().then(function (buf) { return pdfLib().then(function (lib) { return lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise; }); }).then(function (pdf) {
      var n = Math.min(pdf.numPages, 40), pages = [], title = '', th = 0, chain = Promise.resolve();
      for (var i = 1; i <= n; i++) (function (i) { chain = chain.then(function () { return pdf.getPage(i).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
        var lines = [], cur = '', ly = null;
        tc.items.forEach(function (it) { if (!('str' in it)) return; var y = Math.round(it.transform[5]); if (ly !== null && Math.abs(y - ly) > 2) { lines.push(cur); cur = ''; } cur += (cur && !/\s$/.test(cur) ? ' ' : '') + it.str; ly = y; if (it.hasEOL) { lines.push(cur); cur = ''; ly = null; }
          if (i === 1) { var h = Math.abs(it.height || it.transform[3] || 0), s = it.str.trim(); if (s.length >= 3 && /[A-Za-zÆØÅæøå]/.test(s)) { if (h > th + 0.5) { th = h; title = s; } else if (Math.abs(h - th) <= 0.5 && title.length < 60 && title.indexOf(s) < 0) title += ' ' + s; } } });
        if (cur) lines.push(cur); pages.push(lines.map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean).join('\n'));
      }); }); })(i);
      return chain.then(function () { return { n: pdf.numPages, pages: pages, title: title }; });
    });
  }
  function langOf(t) {
    var w = ' ' + t.replace(/[^a-zæøåäö]+/g, ' ') + ' ', sum = function (l) { return l.reduce(function (a, x) { return a + cnt(w, ' ' + x + ' '); }, 0); };
    var L = [['nb', sum(['og', 'ikke', 'skal', 'med', 'til', 'av', 'som', 'eller', 'må', 'ved'])], ['en', sum(['the', 'and', 'with', 'must', 'shall', 'of', 'or', 'to', 'be', 'is'])], ['sv', sum(['och', 'inte', 'ska', 'för', 'eller', 'med'])], ['de', sum(['und', 'die', 'der', 'nicht', 'mit', 'für', 'das'])]].sort(function (a, b) { return b[1] - a[1]; });
    return L[0][1] >= 5 ? L[0][0] : '';
  }
  function ccRun(pid, fid) {
    if (ccBusy[fid]) return; ccBusy[fid] = 1; draw();
    getBlob(fid).then(function (bl) {
      if (!bl) throw { here: 1 };
      return pdfText(bl);
    }).then(function (r) {
      var all = r.pages.join('\n'), low = all.toLowerCase(), first = (r.pages[0] || '').toLowerCase(), chars = all.replace(/\s/g, '').length;
      var ty = scoreKw(TKW, low, first), co = scoreCodes(low, first).filter(function (x) { return x.h.reduce(function (a, h) { return a + h[1]; }, 0) >= 2 || /^TFM/.test(x.h[0][0]); }), st = strong(ty), sc = strong(co);   /* a code from the text needs the word at least twice (or a TFM tag) – one mention in a long datasheet is not what the document is about */
      var pl = /^(?:produkt(?:navn)?|product(?: name)?|modell?|model|typebetegnelse)\s*[:\-–]\s*(.{3,80})$/im.exec(all), d = (pl ? pl[1] : r.title || '').replace(/\s+/g, ' ').trim();
      [].concat(TKW.SE, TKW.DA, TKW.DV, TKW.FB).forEach(function (e) { d = d.replace(new RegExp('\\S*' + e[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\S*', 'ig'), '');   /* the whole word: EU-samsvarserklæring goes, not just its middle */ });
      d = d.replace(/[-–:|]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
      var mm = /\b([A-ZÆØÅ][\wÆØÅæøå&.-]{1,25}(?:\s[A-ZÆØÅ][\wÆØÅæøå&.-]{1,25})?)\s(AS|ASA|AB|GmbH|Oy|A\/S|Ltd|Inc)\b/.exec(all); if (mm && d.toLowerCase().indexOf(mm[1].toLowerCase()) < 0) d = (d ? d + ' ' : '') + mm[1];
      ccText[fid] = all.slice(0, 1500);
      var cc = { at: today(), pg: r.n, ch: chars, t: st ? [st.k, why(st, 't')] : null, c: sc ? [sc.k, why(sc, 't')] : null, ca: !sc && co.length > 1 ? co.slice(0, 2).map(function (x) { return [x.k, why(x, 't')]; }) : null, tt: ty.slice(0, 3).map(function (x) { return x.k; }), cs: co.slice(0, 3).map(function (x) { return x.k; }), d: d.slice(0, 80),
        lang: chars > 200 ? langOf(low) : '', mk: ['Bruker', 'Drift', 'Prosjekt'].filter(function (w) { return new RegExp('(^|[^A-Za-zæøå])' + w + '([^a-zæøå]|$)').test(all); }), w: [] };
      if (chars < 40 * Math.min(r.n, 40)) cc.w.push(chars ? 'little' : 'notext');
      saveP(pid, function (p) {
        var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (!f) return; f.cc = cc;
        var weak = k('ui.dcn-closest', 'closest match in the text – check it');
        if (!f.p.code) { var lc = learnedFor(f.orig || f.name);   /* your earlier choices first, then a clear match in the text; close calls are two options to choose from */
          if (lc) { f.p.code = lc.k; f.sg = Object.assign({}, f.sg, { c: whyL(lc) }); }
          else if (cc.c) { f.p.code = cc.c[0]; f.sg = Object.assign({}, f.sg, { c: cc.c[1] }); }
          else if (cc.ca) f.sg = Object.assign({}, f.sg, { alt: cc.ca });
          else if (cc.cs.length) { f.p.code = cc.cs[0]; f.sg = Object.assign({}, f.sg, { c: weak }); }
          if (f.p.code && f.sg && f.sg.alt) delete f.sg.alt; }
        if (!f.p.abbr && (cc.t || cc.tt.length)) { f.p.abbr = cc.t ? cc.t[0] : cc.tt[0]; f.sg = Object.assign({}, f.sg, { t: cc.t ? cc.t[1] : weak }); }
        if (cc.d && splitStem(f.name) !== nbuild(p, f).plain) { f.nv = Object.assign({}, f.nv, { desc: mergeDesc(nval(p, f, { k: 'desc' }), cc.d) }); }
        relink(p, f);
      });
    }).catch(function (e) {
      var code = e && e.here ? 'here' : e && e.name === 'PasswordException' ? 'locked' : e && e.name === 'InvalidPDFException' ? 'broken' : e && e.message === 'load' ? 'lib' : 'read';
      if (code === 'here' || code === 'lib') toast('<i class="bi bi-info-circle"></i> ' + esc(code === 'here' ? k('ui.dc-file-elsewhere', 'The file is on the device it was imported on.') : k('ui.dcn-lib', 'The PDF reader could not be loaded – check the connection (it is fetched the first time).')));
      else saveP(pid, function (p) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (f) f.cc = { at: today(), e: code }; });
    }).then(function () { delete ccBusy[fid]; drawBg(); });   /* a check finishing in the background must not close a list you have open */
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
  var CGRP = { '0': ['Felles', 'Common'], '1': ['Felleskostnader', 'Shared costs'], '2': ['Bygning', 'Building'], '3': ['VVS-installasjoner', 'HVAC and plumbing'], '4': ['Elkraftinstallasjoner', 'Electrical power'], '5': ['Ekom og automatisering', 'Telecom and automation'], '6': ['Andre installasjoner', 'Other installations'], '7': ['Utendørs', 'Outdoor'], '8': ['Andre', 'Other'], '9': ['Andre', 'Other'] };
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
    var old = document.querySelector('.dcn-cpk'); if (old) old.remove();
    var items = [], grp = '';
    [].forEach.call(sel.querySelectorAll('option, optgroup'), function (n) { if (n.tagName === 'OPTGROUP') { grp = n.label; return; } if (n.value) items.push({ v: n.value, t: n.textContent, g: n.parentNode.tagName === 'OPTGROUP' ? n.parentNode.label : '', on: n.value === sel.value }); });
    var ov = document.createElement('div'); ov.className = 'dcn-ov dc-host dcn-cpk';
    ov.innerHTML = '<div class="dcn-sheet dcn-cpks" role="dialog" aria-modal="true" aria-label="' + esc(k('ui.dcn-code', 'NS 3451 code')) + '"><div class="dcn-shead"><b>' + esc(k('ui.dcn-code', 'NS 3451 code')) + '</b><button type="button" class="icon-btn" data-cpx aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
      '<input type="search" class="dcn-cpq" placeholder="' + esc(k('ui.dcn-cp-q', 'Search a number or a word – e.g. 36 or ventilasjon')) + '" aria-label="' + esc(k('ui.dcn-cp-q', 'Search a number or a word – e.g. 36 or ventilasjon')) + '" autocomplete="off"><ul class="dcn-cpl"></ul></div>';
    var q = ov.querySelector('.dcn-cpq'), ul = ov.querySelector('.dcn-cpl'), dn = null;
    var close = function () { ov.remove(); document.removeEventListener('keydown', ek, true); document.documentElement.classList.toggle('dcn-modal', !!document.querySelector('.dcn-ov')); };
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
  function codeOpts(p, f) {
    var v = String(f.p.code || ''), L = codeList(p), names = {}, groups = [];
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
    return h + ownOpts(p, 'code', v, known);
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
    var a = CATN.filter(function (x) { return fit[x[0]]; }), b = CATN.filter(function (x) { return !fit[x[0]]; });
    return '<option value="">' + esc(k('ui.dcn-choose-type', 'Choose type')) + '</option>' + (a.length ? '<optgroup label="' + esc(k('ui.dcn-in-plan', 'In the plan for {c}', { c: c3 })) + '">' + a.map(o).join('') + '</optgroup><optgroup label="' + esc(k('ui.dcn-other-types', 'Other types')) + '">' : '') + b.map(o).join('') + (a.length ? '</optgroup>' : '') +
      ownOpts(p, 'type', f.p.abbr || '', CATN.map(function (x) { return x[0]; }));
  }
  function tag(c, t) { return '<span class="dc-st" style="--c:' + c + '">' + esc(t) + '</span>'; }
  function nfield(p, f, key) {
    var id = 'dcn-' + f.id + '-' + key, v = nval(p, f, { k: key }), lab = '<label class="dcn-fl" for="' + id + '"><span>' + esc(partName(key)) + '</span>';
    if (key === 'floor' || key === 'dtype' || key === 'disc') { var L = key === 'floor' ? FLOORS : key === 'dtype' ? DTYPES : FAG; return lab + '<select id="' + id + '" data-dcnv="' + esc(f.id) + ':' + key + '"><option value=""></option>' + L.map(function (x) { var m = mean(key, x); return '<option value="' + x + '"' + (x === v ? ' selected' : '') + '>' + esc(x + (m ? ' – ' + m : '')) + '</option>'; }).join('') + ownOpts(p, key, v, L) + '</select>' + (v && mean(key, v) && !(f.nv && f.nv[key] != null) && !drawn(f)[key] ? '<small class="dcn-gs">' + esc(k('ui.dcn-guess', 'Suggested – check it')) + '</small>' : '') + '</label>' + (nown === f.id + ':' + key ? ownForm(f.id, key) : ''); }
    if (key === 'rev') v = (f.nv || {}).rev || '';
    return lab + '<input id="' + id + '" data-dcnv="' + esc(f.id) + ':' + key + '" value="' + esc(v) + '" maxlength="80"></label>';
  }
  function nrow(p, f, compact) {
    var r = ruleFor(p, f), b = nbuild(p, f, r), e = ext(f.orig || f.name), l = f.line && lineOf(p, f.line), kd = fkind(f), tags = [], lvl = 'ok';
    if (compact) {
      var st = fstate(p, f), ic = st === 'done' ? 'check2-circle' : st === 'ready' ? 'arrow-right-circle' : 'exclamation-circle', open = !!nexp[f.id];
      var line = '<button type="button" class="dcn-sumb" data-dcnexp="' + esc(f.id) + '" aria-expanded="' + open + '"><i class="bi bi-' + ic + ' dcn-s-' + st + '"></i><span class="dcn-sumt"><b data-noi18n>' + esc(f.name) + '</b>' +
        (st === 'done' ? '' : '<small data-noi18n>' + (st === 'ready' ? '→ ' + esc(b.plain + e) : esc(!f.p.code && f.sg && f.sg.alt ? k('ui.dcn-alt-short', 'Choose code: {a}', { a: f.sg.alt.map(function (a) { return a[0]; }).join(k('ui.dcn-or', ' or ')) }) : k('ui.dcn-fill', 'Fill in: {w}', { w: (b.miss.length ? b.miss : ['code']).map(function (x) { return partName(x).toLowerCase(); }).join(', ') }))) + '</small>') + '</span><i class="bi bi-chevron-right"></i></button>';
      if (!open) return '<li class="dcn-row dcn-c dcn-' + (st === 'todo' ? 'warn' : 'ok') + (pkOn(f.id) ? ' dcn-pkd' : '') + '" data-dcnc="' + esc(f.id) + '"><label class="dcn-pkc"><input type="checkbox" data-dcnpk="' + esc(f.id) + '"' + (pkOn(f.id) ? ' checked' : '') + ' aria-label="' + esc(k('ui.dcn-pk-one', 'Select {f}', { f: f.name })) + '"></label>' + line + '</li>';
      return nrow(p, f).replace('<div class="dcn-g">', line + '<div class="dcn-g">');
    }
    if (!f.p.code && kd !== 'photo') { tags.push(tag('var(--warn)', k('ui.dcn-needs-code', 'Needs a code'))); lvl = 'warn'; }
    else if (f.p.code && !f.p.abbr && kd === 'doc') { tags.push(tag('var(--warn)', k('ui.dcn-needs-type', 'Needs a type'))); lvl = 'warn'; }
    if (l) tags.push(tag('var(--ok)', k('ui.dcn-on-line', 'On line {c}', { c: l.code + (f.p.abbr ? ' ' + f.p.abbr : '') })));
    else if (f.p.code && !f.nf && !p.tool) { tags.push(tag('var(--violet)', k('ui.dcn-not-plan', 'Not in the plan'))); if (lvl === 'ok') lvl = 'odd'; }
    if (f.sg && (f.sg.c || (f.sg.t && kd === 'doc'))) tags.push(tag('var(--blue)', k('ui.dcn-suggested', 'Suggested – check it')));
    var gaps = b.miss.filter(function (x) { return x !== 'code' && x !== 'type'; });
    if (gaps.length) tags.push(tag('var(--warn)', k('ui.dcn-fill', 'Fill in: {w}', { w: gaps.map(function (x) { return partName(x).toLowerCase(); }).join(', ') })));
    else if (!b.miss.length && b.plain === splitStem(f.name)) tags.push(tag('var(--ok)', k('ui.dcn-follows', 'Name follows the rule')));
    var code = f.p.code ? f.p.code + ' ' + (codeName(f.p.code) || '') : '', seen = {};
    var h = '<li class="dcn-row dcn-' + lvl + '" data-dcnf="' + esc(f.id) + '"><div class="dcn-g">' +
      '<label class="dcn-c dcn-kind"><span>' + esc(k('ui.dcn-kind', 'Kind of file')) + '</span><select data-dcnk="' + esc(f.id) + '">' + [['doc', 'ui.dcn-k-doc', 'Document'], ['photo', 'ui.dcn-k-photo', 'Photo'], ['drawing', 'ui.dcn-k-drawing', 'Drawing']].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === kd ? ' selected' : '') + '>' + esc(k(x[1], x[2])) + '</option>'; }).join('') + '</select></label>' +
      '<label class="dcn-c"><span>' + esc(k('ui.dcn-code', 'NS 3451 code')) + '</span><select data-dcncode="' + esc(f.id) + '" title="' + esc(code.trim()) + '" class="dcn-hsel" tabindex="-1" aria-hidden="true">' + codeOpts(p, f) + '</select>' +
        '<button type="button" class="dcn-cbtn" data-dcncpick="' + esc(f.id) + '"><span>' + esc(f.p.code ? f.p.code + (codeName(f.p.code) ? ' ' + codeName(f.p.code) : '') : k('ui.dcn-choose-code', 'Choose a code')) + '</span><i class="bi bi-search"></i></button></label>' + (nown === f.id + ':code' ? ownForm(f.id, 'code') : '') +
      (!f.p.code && f.sg && f.sg.alt ? '<div class="dcn-alt"><span>' + esc(k('ui.dcn-alt', 'Not sure – choose one:')) + '</span>' + f.sg.alt.map(function (a) { return '<button type="button" class="dc-chip dcn-altb" data-dcnalt="' + esc(f.id + '|' + a[0]) + '"><b data-noi18n>' + esc(a[0] + (codeName(a[0]) ? ' ' + codeName(a[0]) : '')) + '</b><small>' + esc(a[1]) + '</small></button>'; }).join('') + '</div>' : '') +
      (kd === 'doc' ? '<label class="dcn-c"><span>' + esc(k('ui.dcn-type', 'Document type')) + '</span><select data-dcntype="' + esc(f.id) + '">' + typeOpts(p, f) + '</select></label>' + (nown === f.id + ':type' ? ownForm(f.id, 'type') : '') : '') +
      '<div class="dcn-t">' + tags.join('') + (f.sg && (f.sg.c || f.sg.t) ? '<button type="button" class="text-btn" data-dcnok="' + esc(f.id) + '">' + esc(k('ui.dcn-looks-right', 'Looks right')) + '</button>' : '') + '</div></div>';
    if (f.sg && (f.sg.c || (f.sg.t && kd === 'doc'))) h += '<p class="dcn-why"><i class="bi bi-lightbulb"></i> ' + esc([f.sg.c ? k('ui.dcn-code', 'NS 3451 code') + ': ' + f.sg.c : '', f.sg.t && kd === 'doc' ? k('ui.dcn-type', 'Document type') + ': ' + f.sg.t : ''].filter(Boolean).join(' · ')) + '</p>';
    h += '<div class="dcn-s">';
    r.parts.forEach(function (q) { if (PV[q.k] && !p[PV[q.k][0]]) h += pvField(p, q.k, true, false); });
    r.parts.forEach(function (q) { if (NPART[q.k] && NPART[q.k][2] && !seen[q.k]) { seen[q.k] = 1; h += nfield(p, f, q.k); } });
    var cur0 = '<div class="dcn-n"><span>' + esc(k('ui.dcn-current', 'Current file name')) + '</span><span class="dcn-nrow"><b data-noi18n>' + esc(f.name) + '</b>' + (f.nf ? '' : '<button type="button" class="dc-chip dcn-open" data-dcview="' + esc(f.id) + '"><i class="bi bi-eye"></i> ' + esc(k('ui.dcn-open', 'Open')) + '</button>') + '</span>' + (f.orig && f.orig !== f.name ? '<small class="muted" data-noi18n>' + esc(k('ui.dcn-sent-as', 'Sent as: {n}', { n: f.orig })) + '</small>' : '') + '</div>';
    h += cur0 + '<div class="dcn-sug"><span>' + esc(k('ui.dcn-name-from', 'Name from “{r}”', { r: rname(r) })) + '</span><code data-noi18n>' + b.html + esc(e) + '</code></div>' +
      '<div class="dcn-b"><button type="button" class="pill-btn" data-dcnuse="' + esc(f.id) + '"' + (b.miss.length || b.plain + e === f.name ? ' disabled' : '') + '><i class="bi bi-pencil"></i> ' + esc(k('ui.dcn-use', 'Use this name')) + '</button>' +
      (f.orig && f.orig !== f.name ? '<button type="button" class="text-btn" data-dcnorig="' + esc(f.id) + '">' + esc(k('ui.dcn-orig', 'Back to the name it came with')) + '</button>' : '') +
      '<button type="button" class="icon-btn sm" data-dcfdel="' + esc(f.id) + '" aria-label="' + esc(k('ui.delete', 'Delete')) + '"><i class="bi bi-trash3"></i></button></div></div>';
    var iss = (f.iss || []).filter(function (x) { return !(b.plain === splitStem(f.name) && !b.miss.length && r.id !== 'bby-doc' && PAIR.indexOf(x[1]) < 0); });   /* a name that follows your own rule isn't wrong for not looking like Boligbygg's */
    if (iss.length) h += '<ul class="dc-iss">' + iss.map(function (x) { return '<li class="' + x[0] + '"><i class="bi bi-' + (x[0] === 'err' ? 'x-octagon' : 'exclamation-triangle') + '"></i> ' + esc(issueText(x, f)) + '</li>'; }).join('') + '</ul>';
    if (!l && !f.nf && !p.tool) h += '<select class="dc-link" data-dcflink="' + esc(f.id) + '"><option value="">' + esc(k('ui.dc-not-in-plan', 'Not in the plan – link it to a line …')) + '</option>' + linkOpts(p, f) + '</select>';
    h += ccHtml(p, f);
    return h + '</li>';
  }
  function ccHtml(p, f) {
    if (f.nf || ext(f.name) !== '.pdf') return '';
    var c = f.cc, run = '<button type="button" class="text-btn" data-dcncc="' + esc(f.id) + '"><i class="bi bi-search"></i> ' + esc(c ? k('ui.dcn-cc-again', 'Check again') : k('ui.dcn-cc-run', 'Check the content')) + '</button>';
    if (ccBusy[f.id]) return '<div class="dcn-cc" aria-live="polite"><b>' + esc(k('ui.dcn-cc', 'Content check')) + '</b> <span class="muted">' + esc(k('ui.dcn-cc-reading', 'Reading the PDF on this device …')) + '</span></div>';
    if (!c) return '<div class="dcn-cc"><b>' + esc(k('ui.dcn-cc', 'Content check')) + '</b> <span class="muted">' + esc(k('ui.dcn-cc-help', 'Reads the PDF here to suggest code, type and description and to spot problems. Nothing is sent.')) + '</span> ' + run + '</div>';
    if (c.e) return '<div class="dcn-cc"><b>' + esc(k('ui.dcn-cc', 'Content check')) + '</b> ' + tag('var(--warn)', k('ui.dcn-cc-bad', 'Could not read')) + '<p>' + esc({ locked: k('ui.dcn-cc-locked', 'The PDF is locked with a password, so its text can’t be read. Boligbygg needs open files.'), broken: k('ui.dcn-cc-broken', 'This doesn’t look like a working PDF – it may be damaged.') }[c.e] || k('ui.dcn-cc-read', 'The file could not be read.')) + '</p>' + run + '</div>';
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
    var use = p.nuse || {}, R = nrules(p), own = R.filter(function (r) { return !r.b; }), sel = nsel ? nrule(p, nsel) : null;
    var opts = function (cur) { var o = function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === cur ? ' selected' : '') + '>' + esc(rname(r)) + '</option>'; };
      return '<optgroup label="Boligbygg">' + R.filter(function (r) { return r.b; }).map(o).join('') + '</optgroup>' + (own.length ? '<optgroup label="' + esc(k('ui.dcn-own', 'Your rules')) + '">' + own.map(o).join('') + '</optgroup>' : ''); };
    var KINDS = [['doc', 'ui.dcn-use-doc', 'Documents'], ['photo', 'ui.dcn-use-photo', 'Photos'], ['drawing', 'ui.dcn-use-dwg', 'Drawings']];
    var h = '<details class="dcn-rules"' + (nopen ? ' open' : '') + ' data-dcnrules><summary><i class="bi bi-sliders"></i> <b>' + esc(p.tool ? k('ui.dcn-rules-tool', 'Naming rules') : k('ui.dcn-rules', 'Naming rules for this project')) + '</b><small>' +
      esc(KINDS.map(function (x) { var r = nrule(p, use[x[0]] || NDEF[x[0]]); return k(x[1], x[2]) + ': ' + (r ? rname(r) : '–'); }).join(' · ')) + '</small></summary>';
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
      (own.length ? '<ul class="dcn-rlist">' + own.map(row).join('') + '</ul>' : '<p class="muted dc-help">' + esc(k('ui.dcn-own-none', 'None yet – make one, or copy one of Boligbygg’s and change it.')) + '</p>') +
      
      ownCodes(p) + lrnBox() +
      '<details class="dcn-bbl"><summary>' + esc(k('ui.dcn-bb-rules', 'Boligbygg’s rules ({n}) – copy one to start from it', { n: R.length - own.length })) + '</summary><ul class="dcn-rlist">' + R.filter(function (r) { return r.b; }).map(row).join('') + '</ul></details>';
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
      '<button type="button" class="dc-chip" data-dcnnsp><i class="bi bi-clipboard"></i> ' + esc(k('ui.dcn-ns-paste', 'Paste')) + '</button>' + (n && w !== 'me' ? '<button type="button" class="dc-chip" data-dcnnsx><i class="bi bi-trash3"></i> ' + esc(k('ui.dcn-ns-clear', 'Remove the names')) + '</button>' : '') + '</span>' : '') +
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
  function lrnBox() {
    var L = lrnGet(), W = Object.keys(L.w || {}), w = lrnWhere();
    var best = function (x) { var e = L.w[x], c = Object.keys(e).sort(function (a, b) { return e[b] - e[a]; })[0]; return c; };
    return '<details class="dcn-bbl dcn-lrn"><summary>' + esc(k('ui.dcn-lrn-t', 'Learned codes ({n})', { n: W.length })) + '</summary><p class="muted dc-help">' + esc(k('ui.dcn-lrn-help', 'When you change a suggested code, the words in the file name are remembered with the code you chose, and similar files get it first next time. Remove anything that was learned wrong.')) + ' ' +
      esc(w === 'team' ? k('ui.dcn-ns-team', 'Shared with everyone in the team') : w === 'me' ? k('ui.dcn-ns-me', 'Saved with your codes – on all your devices') : k('ui.dcn-ns-here', 'Kept on this device only')) + '</p>' +
      (W.length ? '<ul class="dcn-lrnl">' + W.sort().slice(0, 300).map(function (x) { var c = best(x); return '<li><span><b data-noi18n>' + esc(x) + '</b> → <span data-noi18n>' + esc(c + (codeName(c) ? ' ' + codeName(c) : '')) + '</span></span><button type="button" class="icon-btn sm" data-dcnlrx="' + esc(x) + '" aria-label="' + esc(k('ui.dcn-lrn-x', 'Forget this')) + '" title="' + esc(k('ui.dcn-lrn-x', 'Forget this')) + '"><i class="bi bi-x-lg"></i></button></li>'; }).join('') + '</ul>' : '<p class="muted dc-help">' + esc(k('ui.dcn-lrn-none', 'Nothing learned yet.')) + '</p>') + '</details>';
  }
  function ownCodes(p) {
    var h = nsBox() + '<p class="dcn-h">' + esc(k('ui.dcn-own-codes', 'Your codes')) + ' <span class="muted">' + esc(k('ui.dcn-own-codes-s', 'extra choices in the lists – or pick “+ Own code” in a list')) + '</span></p>', any = 0;
    OWNK.forEach(function (x) { var O = owns(p, x[0]); if (!O.length) return; any = 1; h += '<div class="dcn-oc"><span>' + esc(k(x[1], x[2])) + '</span>' + O.map(function (y) { return '<span class="dc-chip dcn-ochip"><b data-noi18n>' + esc(y[0]) + '</b>' + (y[1] ? ' <span data-noi18n>' + esc(y[1]) + '</span>' : '') + '<button type="button" data-dcnodel="' + esc(x[0] + ':' + y[0]) + '" aria-label="' + esc(k('ui.delete', 'Delete')) + '"><i class="bi bi-x-lg"></i></button></span>'; }).join('') + '</div>'; });
    return h + '<div class="dcn-oadd"><select data-dcnoa aria-label="' + esc(k('ui.dcn-own-for', 'For')) + '">' + OWNK.map(function (x) { return '<option value="' + x[0] + '">' + esc(k(x[1], x[2])) + '</option>'; }).join('') + '</select>' +
      '<input data-dcnoc maxlength="40" placeholder="' + esc(k('ui.dcn-own-c', 'Code or text, e.g. E2')) + '" aria-label="' + esc(k('ui.dcn-own-c', 'Code or text, e.g. E2')) + '"><input data-dcnom maxlength="60" placeholder="' + esc(k('ui.dcn-own-m', 'What it means (optional)')) + '" aria-label="' + esc(k('ui.dcn-own-m', 'What it means (optional)')) + '">' +
      '<button type="button" class="pill-btn" data-dcnoadd><i class="bi bi-plus-lg"></i> ' + esc(k('ui.dcn-own-addb', 'Add')) + '</button></div>';
  }
  /* the rule editor is a popup (JP 2026-11-17 "pop up a screen instead of … scroll all the way down"): drawn with the rules, then moved to <body> so no card clips it */
  function lift() { setTimeout(function () { var L = document.querySelectorAll('body > .dcn-ov.dcn-lifted'), F = [].filter.call(document.querySelectorAll('.dcn-ov'), function (x) { return x.parentNode !== document.body; });
    if (!F.length && (nsel || nfo) && document.querySelector('#wkDocCtl .dcn-files, #wkDocCtl .dcn-rules')) return; [].forEach.call(L, function (x) { x.remove(); }); F.forEach(function (x) { x.classList.add('dcn-lifted'); document.body.appendChild(x); }); document.documentElement.classList.toggle('dcn-modal', !!F.length); }, 0); }
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
  function pvField(p, key, needed, big) {
    var d = PV[key], v = p[d[0]] || '';
    return '<label class="dcn-fl dcn-bno"><span>' + esc(k(d[1], d[2])) + '</span><input data-dcnpv="' + d[0] + '"' + (key === 'bno' ? ' data-dcnbid' : '') + ' value="' + esc(v) + '" maxlength="60"' + (d[5] ? ' inputmode="' + d[5] + '"' : '') + ' placeholder="' + esc(k(d[3], d[4])) + '"' + (needed && !v ? ' class="dcn-need"' : '') + '>' +
      (big ? '<small>' + esc(k('ui.dcn-pv-s', 'Used in every name that has it, and kept for the next files')) + '</small>' : '') + '</label>';
  }
  /* ---------- several files at once (JP 2026-11-19): a checkbox on each line, a bar with the changes, one popup per change, Undo ---------- */
  var PKS = {}, pkP = '';
  function pkOn(id) { return pkP === cur() && !!PKS[id]; }
  function pkN() { return pkP === cur() ? Object.keys(PKS).length : 0; }
  function pkFix(p) { if (pkP !== cur()) { PKS = {}; pkP = cur(); } var have = {}; (p.files || []).forEach(function (f) { have[f.id] = 1; }); Object.keys(PKS).forEach(function (id) { if (!have[id]) delete PKS[id]; }); }
  function pkSet(ids, on) { if (pkP !== cur()) { PKS = {}; pkP = cur(); } ids.forEach(function (id) { if (on) PKS[id] = 1; else delete PKS[id]; }); }
  function picked() { var p = proj(cur()) || {}; pkFix(p); return (p.files || []).filter(function (f) { return PKS[f.id]; }).map(function (f) { return f.id; }); }
  function bulkPop(kind) {
    var p = proj(cur()); if (!p) return; var F = (p.files || []).filter(function (f) { return PKS[f.id] && !f.nf; }); if (!F.length) return;
    var old = document.querySelector('.dcn-bulk'); if (old) old.remove();
    var docs = kind === 'type' ? F.filter(function (f) { return fkind(f) === 'doc'; }) : F;
    var own = kind === 'code' ? docs.filter(function (f) { return f.p.code && !(f.sg && f.sg.c); }) : kind === 'type' ? docs.filter(function (f) { return f.p.abbr && !(f.sg && f.sg.t); }) : [];
    var ready = kind === 'name' ? F.filter(function (f) { var b = nbuild(p, f); return !b.miss.length && b.plain + ext(f.orig || f.name) !== f.name; }) : [];
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
        if (own.length) h += '<label class="dcn-bkown"><input type="checkbox" data-bkover' + (over ? ' checked' : '') + '><span><b>' + esc(k('ui.dcn-bk-own', '{n} have one you set yourself', { n: own.length })) + '</b><small>' + esc(k('ui.dcn-bk-over', 'Overwrite them too ({v})', { v: own.slice(0, 4).map(function (f) { return kind === 'code' ? f.p.code : f.p.abbr; }).join(', ') + (own.length > 4 ? ' …' : '') })) + '</small></span></label>';
        h += '<div class="dcn-b dcn-bkbtns"><button type="button" class="dc-chip" data-bkx>' + esc(k('ui.cancel', 'Cancel')) + '</button><button type="button" class="pill-btn" data-bkgo' + (val && tgt.length ? '' : ' disabled') + '>' + esc(val ? k('ui.dcn-bk-go', 'Set {v} on {n} files', { v: val, n: tgt.length }) : k('ui.dcn-bk-go0', 'Set it')) + '</button></div>';
      }
      if (kind === 'name') h += '<div class="dcn-bkbox"><b>' + esc(k('ui.dcn-bk-name', '{r} of the {n} are ready and get the new name.', { r: ready.length, n: F.length })) + '</b>' + (ready.length ? '<span>' + names(ready) + '</span>' : '') + (F.length > ready.length ? '<small class="muted">' + esc(k('ui.dcn-bk-name-no', 'The others still miss something, or already have it.')) + '</small>' : '') + '</div><div class="dcn-b dcn-bkbtns"><button type="button" class="dc-chip" data-bkx>' + esc(k('ui.cancel', 'Cancel')) + '</button><button type="button" class="pill-btn" data-bkgo' + (ready.length ? '' : ' disabled') + '>' + esc(k('ui.dcn-bk-name-go', 'Rename {n}', { n: ready.length })) + '</button></div>';
      if (kind === 'rm') h += '<div class="dcn-bkbox"><span>' + names(F) + '</span><small class="muted">' + esc(k('ui.dcn-bk-rm', 'They only leave this list and the download – the files on your computer are not touched.')) + '</small></div><div class="dcn-b dcn-bkbtns"><button type="button" class="dc-chip" data-bkx>' + esc(k('ui.cancel', 'Cancel')) + '</button><button type="button" class="pill-btn" data-bkgo>' + esc(k('ui.dcn-bk-rm-go', 'Remove {n}', { n: F.length })) + '</button></div>';
      ov.innerHTML = h + '</div>';
    };
    render();
    var close = function () { ov.remove(); document.removeEventListener('keydown', ek, true); document.documentElement.classList.toggle('dcn-modal', !!document.querySelector('.dcn-ov')); };
    var ek = function (e) { if (e.key === 'Escape' && !document.querySelector('.dcn-cpk')) { e.stopPropagation(); close(); } };
    var dn = null; ov.addEventListener('pointerdown', function (e) { dn = e.target; });
    ov.addEventListener('change', function (e) { if (e.target.matches('[data-bksel]')) { val = /^\s*([0-9A-Za-z.]+)/.exec(e.target.value || '') ? /^\s*([0-9A-Za-z.]+)/.exec(e.target.value)[1] : ''; render(); } else if (e.target.matches('[data-bkover]')) { over = e.target.checked; render(); } });
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
          else if (kind === 'type') { f.p.abbr = val; if (f.sg) delete f.sg.t; relink(p2, f); }
          else if (kind === 'name') { var b = nbuild(p2, f); rename(p2, f, b.plain + ext(f.orig || f.name)); }
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
    var todo = F.filter(function (f) { return !f.nf && (!f.p.code || (ext(f.name) === '.pdf' && !f.cc)); }).length;
    /* values for the whole batch (building number, property ID, property name, project number) – asked once, right here, where the names are
       (JP 2026-11-16 21:50 building number; 2026-11-17 09:18 "I cannot put the eiendoms-id") */
    var need = {}; F.forEach(function (f) { if (!f.nf) ruleFor(p, f).parts.forEach(function (q) { if (PV[q.k]) need[q.k] = 1; }); });
    Object.keys(PV).forEach(function (key) { if (need[key] || p[PV[key][0]]) h += pvField(p, key, !!need[key], true); });
    if (todo) h += '<p class="dc-facts"><button type="button" class="pill-btn" data-dcnall><i class="bi bi-magic"></i> ' + esc(k('ui.dcn-all', 'Suggest codes and check {n} files', { n: todo })) + '</button></p>';
    var many = F.length > 1, cnt = { todo: 0, ready: 0, done: 0 }; if (many) F.forEach(function (f) { cnt[fstate(p, f)]++; });
    if (many) h += '<div class="dcn-flt" role="group">' + [['', k('ui.dcn-f-all', 'All {n}', { n: F.length })], ['todo', k('ui.dcn-f-todo', 'Needs you {n}', { n: cnt.todo })], ['ready', k('ui.dcn-f-ready', 'Ready {n}', { n: cnt.ready })], ['done', k('ui.dcn-f-done', 'Done {n}', { n: cnt.done })]].map(function (c) { return '<button type="button" class="dc-chip" aria-pressed="' + (nflt === c[0]) + '" data-dcnflt="' + c[0] + '">' + esc(c[1]) + '</button>'; }).join('') + '</div>';
    var G = many && nflt ? F.filter(function (f) { return fstate(p, f) === nflt; }) : F;
    pkFix(p);
    if (many) { var nNo = F.filter(function (f) { return !f.nf && !f.p.code; }).length, nPk = pkN(), allOn = G.length && G.every(function (f) { return pkOn(f.id); });
      /* one box for all / none, with its words beside it (JP 2026-11-19 21:39: the box and "All" did the same) */
      h += '<div class="dcn-pkh"><label class="dcn-pkc dcn-pkall"><input type="checkbox" data-dcnpkall' + (allOn ? ' checked' : '') + '><span>' + esc(k('ui.dcn-pk-all-n', 'Select all ({n})', { n: G.length })) + '</span></label>' +
        (nNo ? '<button type="button" class="dc-chip" data-dcnpks="nocode">' + esc(k('ui.dcn-pk-nocode2', 'Only those without a code ({n})', { n: nNo })) + '</button>' : '') + '</div>'; }
    h += '<ul class="dcn-files">' + G.map(function (f) { return nrow(p, f, many); }).join('') + '</ul>' + (many && !G.length ? '<p class="muted">' + esc(k('ui.dcn-f-none', 'None here.')) + '</p>' : '');
    if (many && pkN()) h += '<div class="dcn-pkact" role="toolbar" aria-label="' + esc(k('ui.dcn-pk-bar', 'Selected files')) + '"><b>' + esc(k('ui.dcn-pk-n', '{n} selected', { n: pkN() })) + '</b>' +
      '<button type="button" class="pill-btn" data-dcnpka="code">' + esc(k('ui.dcn-pk-code', 'Change code')) + '</button><button type="button" class="dc-chip" data-dcnpka="type">' + esc(k('ui.dcn-pk-type', 'Change type')) + '</button>' +
      '<button type="button" class="dc-chip" data-dcnpka="name">' + esc(k('ui.dcn-pk-name', 'Use the new name')) + '</button>' + (p.tool ? '<button type="button" class="dc-chip" data-dcnpka="rm">' + esc(k('ui.dcn-pk-rm', 'Remove from the list')) + '</button>' : '') +
      '<button type="button" class="icon-btn" data-dcnpks="none" aria-label="' + esc(k('ui.dcn-pk-clear', 'Clear the selection')) + '"><i class="bi bi-x-lg"></i></button></div>';
    /* one file at a time in a popup over the list, with the one before / after (JP 2026-11-17 08:07: "lose control what is what") */
    var L2 = G.some(function (f) { return f.id === nfo; }) ? G : F, ix = -1; L2.forEach(function (f, i) { if (f.id === nfo) ix = i; });
    if (many && ix > -1) { var f0 = L2[ix], pv = L2[ix - 1], nx = L2[ix + 1];
      h += '<div class="dcn-ov dc-host dcn-fpop" data-dcnov2><div class="dcn-sheet dcn-fsheet" role="dialog" aria-modal="true" aria-label="' + esc(f0.name) + '"><div class="dcn-shead">' +
        '<button type="button" class="icon-btn" data-dcnfgo="' + esc(pv ? pv.id : '') + '"' + (pv ? '' : ' disabled') + ' aria-label="' + esc(k('ui.dcn-prev', 'The file before')) + '"><i class="bi bi-chevron-left"></i></button>' +
        '<b class="dcn-fpos">' + esc(k('ui.dcn-fpos', 'File {i} of {n}', { i: ix + 1, n: L2.length })) + '</b>' +
        '<button type="button" class="icon-btn" data-dcnfgo="' + esc(nx ? nx.id : '') + '"' + (nx ? '' : ' disabled') + ' aria-label="' + esc(k('ui.dcn-next', 'The next file')) + '"><i class="bi bi-chevron-right"></i></button>' +
        '<span class="spacer"></span><button type="button" class="icon-btn" data-dcnfx aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
        '<ul class="dcn-files">' + nrow(p, f0) + '</ul></div></div>'; }
    else nfo = '';
    return h;
  }
  /* suggest a code and type from the name for every file, then read every PDF that hasn't been read (one at a time) */
  function suggestAll(pid) {
    var pdfs = []; saveP(pid, function (p) { (p.files || []).forEach(function (f) { if (f.nf) return; if (!f.p.code || !f.p.abbr) { guessName(f); relink(p, f); } if (ext(f.name) === '.pdf' && !f.cc) pdfs.push(f.id); }); }); draw();
    return pdfs.reduce(function (pr, id5) { return pr.then(function () { return new Promise(function (res) { ccRun(pid, id5); var w = setInterval(function () { if (!ccBusy[id5]) { clearInterval(w); res(); } }, 200); }); }); }, Promise.resolve());
  }
  /* "Use this name" for every file whose rule has nothing missing – returns how many got a new name */
  function useAll(pid) { var n = 0; saveP(pid, function (p) { (p.files || []).forEach(function (f) { if (f.nf) return; var b = nbuild(p, f), nm = b.plain + ext(f.orig || f.name); if (!b.miss.length && nm !== f.name) { rename(p, f, nm); n++; } }); }); draw(); return n; }
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
      var t = e.target; if (!t.matches || !t.closest('#wkDocCtl, .dcn-ov')) return; var v = t.value, fid;
      if (v === '__own' && t.dataset.dcncode) { nown = t.dataset.dcncode + ':code'; draw(); setTimeout(function () { var i = document.querySelector('[data-dcnownf] [data-dcnoc]'); if (i) i.focus(); }, 30); return; }
      if (t.matches && t.matches('[data-dcnpk]')) { pkSet([t.dataset.dcnpk], t.checked); draw(); return; }
      if (t.matches && t.matches('[data-dcnpkall]')) { var pq = proj(cur()) || {}, FQ = (pq.files || []).filter(function (f) { return !f.nf && (!nflt || fstate(pq, f) === nflt); }); pkSet(FQ.map(function (f) { return f.id; }), t.checked); draw(); return; }
      if ((fid = t.dataset.dcncode)) { var m = /^\s*(\d{3,4}(?:\.\d+)?)\b/.exec(v) || (v.trim() ? [0, v.trim()] : null); if (!m) return; saveP(cur(), function (p) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (!f) return; f.p.code = m[1]; if (f.sg) { delete f.sg.c; delete f.sg.alt; } learn(f, m[1]); relink(p, f); }); draw(); return; }
      if (v === '__own' && (t.dataset.dcntype || t.dataset.dcnv)) { nown = t.dataset.dcntype ? t.dataset.dcntype + ':type' : t.dataset.dcnv; draw(); setTimeout(function () { var i = document.querySelector('[data-dcnownf] [data-dcnoc]'); if (i) i.focus(); }, 30); return; }
      if (t.hasAttribute('data-dcnoa')) return;
      if (t.hasAttribute('data-dcnnsf') && t.files && t.files[0]) { var rd = new FileReader(); rd.onload = function () { nsSave(parseNS(String(rd.result || ''))); }; rd.readAsText(t.files[0]); t.value = ''; return; }
      if ((fid = t.dataset.dcntype)) { saveP(cur(), function (p) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (!f) return; f.p.abbr = v; if (f.sg) delete f.sg.t; relink(p, f); }); draw(); return; }
      if ((fid = t.dataset.dcnk)) { saveP(cur(), function (p) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (f) f.nk = v; }); draw(); return; }
      if (t.dataset.dcnv) { var a = t.dataset.dcnv.split(':'); saveP(cur(), function (p) { var f = (p.files || []).filter(function (x) { return x.id === a[0]; })[0]; if (f) { f.nv = f.nv || {}; f.nv[a[1]] = v.slice(0, 80); } }); draw(); return; }
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
      var t = e.target, b; if (!t.closest || !t.closest('#wkDocCtl, .dcn-ov')) return;
      var fileOf = function (p, id) { return (p.files || []).filter(function (x) { return x.id === id; })[0]; };
      if ((b = t.closest('[data-dcnuse]'))) { var id = b.dataset.dcnuse; saveP(cur(), function (p) { var f = fileOf(p, id); if (!f) return; var nb2 = nbuild(p, f); if (!nb2.miss.length) rename(p, f, nb2.plain + ext(f.orig || f.name)); }); if (nfo === id) { var PF = ((proj(cur()) || {}).files || []).filter(function (x) { return !x.nf; }), j = -1; PF.forEach(function (x, i) { if (x.id === id) j = i; }); var nxf = PF[j + 1] || PF.filter(function (x) { return x.id !== id && fstate(proj(cur()), x) !== 'done'; })[0]; if (nxf) nfo = nxf.id; }   /* renamed – on to the next file */ draw(); return; }
      if ((b = t.closest('[data-dcnorig]'))) { var id2 = b.dataset.dcnorig; saveP(cur(), function (p) { var f = fileOf(p, id2); if (f && f.orig) { rename(p, f, f.orig); delete f.orig; } }); draw(); return; }
      if ((b = t.closest('[data-dcnalt]'))) { var pa = b.dataset.dcnalt.split('|'); saveP(cur(), function (p) { var f = fileOf(p, pa[0]); if (!f) return; f.p.code = pa[1]; if (f.sg) { delete f.sg.alt; delete f.sg.c; } learn(f, pa[1]); relink(p, f); }); draw(); return; }
      if ((b = t.closest('[data-dcnlrx]'))) { var L0 = lrnGet(); delete L0.w[b.dataset.dcnlrx]; lrnSave(); draw(); return; }
      if ((b = t.closest('[data-dcnok]'))) { var id3 = b.dataset.dcnok; saveP(cur(), function (p) { var f = fileOf(p, id3); if (f) delete f.sg; }); draw(); return; }
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
        saveP(cur(), function (p) { var f = fileOf(p, oa[0]); if (keep) addOwn(p, oa[1], oc, om); if (!f) return; if (oa[1] === 'type') { f.p.abbr = oc; if (f.sg) delete f.sg.t; relink(p, f); } else if (oa[1] === 'code') { f.p.code = oc; if (f.sg) delete f.sg.c; relink(p, f); } else { f.nv = f.nv || {}; f.nv[oa[1]] = oc; } }); nown = ''; unfocus(); draw(); return; }
      if ((b = t.closest('[data-dcnodel]'))) { var od = b.dataset.dcnodel.split(':'); saveP(cur(), function (p) { if (p.ncodes && p.ncodes[od[0]]) p.ncodes[od[0]] = p.ncodes[od[0]].filter(function (y) { return y[0] !== od.slice(1).join(':'); }); }); draw(); return; }
      if ((b = t.closest('[data-dcnoadd]'))) { var fa = b.closest('.dcn-oadd'), ak = fa.querySelector('[data-dcnoa]').value, ac = nclean(fa.querySelector('[data-dcnoc]').value).slice(0, 40), am = fa.querySelector('[data-dcnom]').value.trim().slice(0, 60);
        if (!ac) { fa.querySelector('[data-dcnoc]').focus(); return; } saveP(cur(), function (p) { addOwn(p, ak, ac, am); }); unfocus(); draw(); return; }
      if (t.closest('[data-dcnall]')) { suggestAll(cur()); return; }
      if ((b = t.closest('[data-dcnpks]'))) { var pp = proj(cur()) || {}, FF = (pp.files || []).filter(function (f) { return !f.nf; }), wk = b.dataset.dcnpks; pkFix(pp);
        if (wk === 'none') PKS = {}; else pkSet((wk === 'nocode' ? FF.filter(function (f) { return !f.p.code; }) : (nflt ? FF.filter(function (f) { return fstate(pp, f) === nflt; }) : FF)).map(function (f) { return f.id; }), true); draw(); return; }
      if ((b = t.closest('[data-dcnpka]'))) { bulkPop(b.dataset.dcnpka); return; }
      if ((b = t.closest('[data-dcnexp]'))) { nfo = b.dataset.dcnexp; draw(); return; }
      if ((b = t.closest('[data-dcnfgo]'))) { if (b.dataset.dcnfgo) { nfo = b.dataset.dcnfgo; unfocus(); draw(); } return; }
      if (t.closest('[data-dcnfx]') || (t.matches && t.matches('[data-dcnov2]') && bgClick(t))) { nfo = ''; unfocus(); draw(); return; }
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
  window.DocNaming = { picked: picked, view: view, use: use, files: nfiles, guess: guessName, suggestAll: suggestAll, useAll: useAll, ready: ready, newName: newName, busy: busy };
})();
