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
    I = api; esc = api.esc; k = api.k; toast = api.toast; uid = api.uid; saveP = api.saveP; proj = api.proj; draw = api.draw; getBlob = api.getBlob; lineOf = api.lineOf; unlink = api.unlink; bestLine = api.bestLine;
    parseName = api.parseName; pairs = api.pairs; issueText = api.issueText; linkOpts = api.linkOpts; codeName = api.codeName; lineTitle = api.lineTitle; ABBR = api.ABBR; TEG = api.TEG; FAG = api.FAG; PAIR = api.PAIR; today = api.today; pad = api.pad; LP = api.LP; HOST = api.HOST;
    ON.forEach(function (x) { document.removeEventListener(x[0], x[1], x[2]); }); ON = []; listen();   /* the page may run again (instant page changes): one set of listeners, on its newest helpers */
  }
  function nb() { return window.I18N && I18N.lang === 'nb'; }
  var CATN = [['DA', 'Dataark', 'Datasheet'], ['SE', 'Samsvarserklæring', 'Declaration of conformity'], ['DV', 'Instrukser og anvisninger (FDV)', 'Operation and maintenance'], ['FB', 'Funksjonsbeskrivelse', 'Function description'],
    ['SP', 'Spesifikasjoner', 'Specifications'], ['PK', 'Protokoller, garanti', 'Protocols, warranty'], ['PR', 'Prosedyrer for drift og vedlikehold', 'Procedures'], ['PL', 'Planer, KS, opplæring', 'Plans, quality, training'],
    ['LI', 'Lister, dokumentplan', 'Lists, document plan'], ['NO', 'Notat', 'Note'], ['RA', 'Rapporter, beregninger', 'Reports, calculations'], ['SK', 'Skjema', 'Form'], ['BM', 'BIM-strategi', 'BIM strategy'], ['BF', 'BIM følgeskriv', 'BIM cover letter'],
    ['OK', 'Avtaledokument', 'Agreement'], ['RF', 'Referat', 'Minutes'], ['MR', 'Månedsrapport', 'Monthly report'], ['PA', 'Prosjekteringsanvisning', 'Design guideline'], ['PD', 'Premissdokument', 'Premise document'], ['PP', 'Presentasjon', 'Presentation'], ['ST', 'Strategidokument', 'Strategy'], ['SD', 'Styringsdokument', 'Governing document']];
  function catName(a) { var c = CATN.filter(function (x) { return x[0] === a; })[0]; return c ? (nb() ? c[1] : c[2]) : ''; }
  var FLOORS = ['K02', 'K01', 'U02', 'U01', 'H01', 'H02', 'H03', 'H04', 'H05', 'L01', 'T01', '000'], DTYPES = ['B', 'D', 'F', 'O', 'P', 'S', 'T', 'U'];
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
      case 'code': return f.p && f.p.code || ''; case 'type': return f.p && f.p.abbr || ''; case 'typename': return catName(f.p && f.p.abbr);
      case 'proj': return p.no || ''; case 'bno': return p.bid || ''; case 'unit': return p.pid || ''; case 'pname': return p.pname || '';
      case 'contractor': return v.contractor != null ? v.contractor : p.who || '';
      case 'desc': return v.desc != null ? v.desc : f.p && f.p.text || '';
      case 'floor': case 'disc': case 'dtype': return v[part.k] != null ? v[part.k] : d[part.k] || '';
      case 'rev': x = String(v.rev || '').trim(); return x ? 'Rev' + x : '';
      case 'date': var t = new Date(), y = t.getFullYear(), mo = pad(t.getMonth() + 1), da = pad(t.getDate()); return part.fmt === 'compact' ? '' + y + mo + da : part.fmt === 'no' ? da + '.' + mo + '.' + y : y + '-' + mo + '-' + da;
      case 'run': var n = 0, kd = fkind(f), c = f.p && f.p.code; (p.files || []).some(function (o) { if (fkind(o) === kd && (o.p && o.p.code) === c) n++; return o.id === f.id; }); return pad(Math.max(1, n));
      case 'text': return part.text || '';
      default: return v[part.k] || '';
    }
  }
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
    262: ['takbelegg', 'taktekking', 'takpapp', 'roof membrane'], 263: ['røykluke', 'takluke', 'takvindu'], 273: ['kjøkkeninnredning'], 274: ['baderomsinnredning', 'våtromsinnredning'] };
  function cnt(t, w) { var n = 0, i = 0; if (!t) return 0; while ((i = t.indexOf(w, i)) >= 0) { n++; i += w.length; } return n; }
  function scoreKw(tab, text, first) {
    var out = []; Object.keys(tab).forEach(function (key) { var sc = 0, hits = [];
      tab[key].forEach(function (e) { var w = typeof e === 'string' ? e : e[0], wt = typeof e === 'string' ? 3 : e[1], n = cnt(text, w), p1 = cnt(first, w); if (n) { sc += wt * Math.min(n, 4) + (p1 ? wt * 2 : 0); hits.push([w, n, p1 > 0]); } });
      if (sc) out.push({ k: key, s: sc, h: hits.sort(function (a, b) { return b[1] - a[1]; }) }); });
    return out.sort(function (a, b) { return b.s - a.s; });
  }
  function scoreCodes(text, first) {
    var s = scoreKw(CKW, text, first), re = /(?:^|[\s=+])(\d{3})\.\d{3}\b/g, m, tf = {};   /* TFM tags (=332.001) */
    while ((m = re.exec(text))) tf[m[1]] = (tf[m[1]] || 0) + 1;
    Object.keys(tf).forEach(function (c) { var e = s.filter(function (x) { return x.k === c; })[0], hit = ['TFM ' + c + '.xxx', tf[c], false]; if (e) { e.s += 8 * Math.min(tf[c], 3); e.h.unshift(hit); } else s.push({ k: c, s: 8 * Math.min(tf[c], 3), h: [hit] }); });
    return s.sort(function (a, b) { return b.s - a.s; });
  }
  function strong(l) { return l[0] && l[0].s >= 5 && (!l[1] || l[0].s >= l[1].s * 1.5) ? l[0] : null; }
  function why(x, src) { var h = x.h[0]; return (src === 'n' ? k('ui.dcn-why-name', 'the file name has “{w}”', { w: h[0] }) : k('ui.dcn-why-text', 'found “{w}” {n}× in the text', { w: h[0], n: h[1] })) + (h[2] ? ' · ' + k('ui.dcn-why-p1', 'also on page 1') : ''); }
  /* a file without a code or type: guess from words in its name (marked as suggested until you say it looks right) */
  function guessName(f) {
    if (fkind(f) === 'photo') return; var low = String(f.p && f.p.stem || f.name).toLowerCase().replace(/[_]+/g, ' ');
    if (!f.p.code) { var c = scoreCodes(low, '')[0]; if (c) { f.p.code = c.k; f.sg = Object.assign({}, f.sg, { c: why(c, 'n') }); } }
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
      var ty = scoreKw(TKW, low, first), co = scoreCodes(low, first), st = strong(ty), sc = strong(co);
      var pl = /^(?:produkt(?:navn)?|product(?: name)?|modell?|model|typebetegnelse)\s*[:\-–]\s*(.{3,80})$/im.exec(all), d = (pl ? pl[1] : r.title || '').replace(/\s+/g, ' ').trim();
      [].concat(TKW.SE, TKW.DA, TKW.DV, TKW.FB).forEach(function (e) { d = d.replace(new RegExp('\\S*' + e[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\S*', 'ig'), '');   /* the whole word: EU-samsvarserklæring goes, not just its middle */ });
      d = d.replace(/[-–:|]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
      var mm = /\b([A-ZÆØÅ][\wÆØÅæøå&.-]{1,25}(?:\s[A-ZÆØÅ][\wÆØÅæøå&.-]{1,25})?)\s(AS|ASA|AB|GmbH|Oy|A\/S|Ltd|Inc)\b/.exec(all); if (mm && d.toLowerCase().indexOf(mm[1].toLowerCase()) < 0) d = (d ? d + ' ' : '') + mm[1];
      ccText[fid] = all.slice(0, 1500);
      var cc = { at: today(), pg: r.n, ch: chars, t: st ? [st.k, why(st, 't')] : null, c: sc ? [sc.k, why(sc, 't')] : null, tt: ty.slice(0, 3).map(function (x) { return x.k; }), cs: co.slice(0, 3).map(function (x) { return x.k; }), d: d.slice(0, 80),
        lang: chars > 200 ? langOf(low) : '', mk: ['Bruker', 'Drift', 'Prosjekt'].filter(function (w) { return new RegExp('(^|[^A-Za-zæøå])' + w + '([^a-zæøå]|$)').test(all); }), w: [] };
      if (chars < 40 * Math.min(r.n, 40)) cc.w.push(chars ? 'little' : 'notext');
      saveP(pid, function (p) {
        var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (!f) return; f.cc = cc;
        if (!f.p.code && cc.c) { f.p.code = cc.c[0]; f.sg = Object.assign({}, f.sg, { c: cc.c[1] }); }
        if (f.p.code && !f.p.abbr && cc.t) { f.p.abbr = cc.t[0]; f.sg = Object.assign({}, f.sg, { t: cc.t[1] }); }
        if (cc.d && splitStem(f.name) !== nbuild(p, f).plain) { f.nv = Object.assign({}, f.nv, { desc: mergeDesc(nval(p, f, { k: 'desc' }), cc.d) }); }
        relink(p, f);
      });
    }).catch(function (e) {
      var code = e && e.here ? 'here' : e && e.name === 'PasswordException' ? 'locked' : e && e.name === 'InvalidPDFException' ? 'broken' : e && e.message === 'load' ? 'lib' : 'read';
      if (code === 'here' || code === 'lib') toast('<i class="bi bi-info-circle"></i> ' + esc(code === 'here' ? k('ui.dc-file-elsewhere', 'The file is on the device it was imported on.') : k('ui.dcn-lib', 'The PDF reader could not be loaded – check the connection (it is fetched the first time).')));
      else saveP(pid, function (p) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (f) f.cc = { at: today(), e: code }; });
    }).then(function () { delete ccBusy[fid]; draw(); });
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
    return '<option value="">' + esc(k('ui.dcn-choose-type', 'Choose type')) + '</option>' + (a.length ? '<optgroup label="' + esc(k('ui.dcn-in-plan', 'In the plan for {c}', { c: c3 })) + '">' + a.map(o).join('') + '</optgroup><optgroup label="' + esc(k('ui.dcn-other-types', 'Other types')) + '">' : '') + b.map(o).join('') + (a.length ? '</optgroup>' : '');
  }
  function tag(c, t) { return '<span class="dc-st" style="--c:' + c + '">' + esc(t) + '</span>'; }
  function nfield(p, f, key) {
    var id = 'dcn-' + f.id + '-' + key, v = nval(p, f, { k: key }), lab = '<label class="dcn-fl" for="' + id + '"><span>' + esc(partName(key)) + '</span>';
    if (key === 'floor' || key === 'dtype' || key === 'disc') { var L = key === 'floor' ? FLOORS : key === 'dtype' ? DTYPES : FAG; return lab + '<select id="' + id + '" data-dcnv="' + esc(f.id) + ':' + key + '"><option value=""></option>' + L.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>'; }
    if (key === 'rev') v = (f.nv || {}).rev || '';
    return lab + '<input id="' + id + '" data-dcnv="' + esc(f.id) + ':' + key + '" value="' + esc(v) + '" maxlength="80"></label>';
  }
  function nrow(p, f) {
    var r = ruleFor(p, f), b = nbuild(p, f, r), e = ext(f.orig || f.name), l = f.line && lineOf(p, f.line), kd = fkind(f), tags = [], lvl = 'ok';
    if (!f.p.code && kd !== 'photo') { tags.push(tag('var(--warn)', k('ui.dcn-needs-code', 'Needs a code'))); lvl = 'warn'; }
    else if (f.p.code && !f.p.abbr && kd === 'doc') { tags.push(tag('var(--warn)', k('ui.dcn-needs-type', 'Needs a type'))); lvl = 'warn'; }
    if (l) tags.push(tag('var(--ok)', k('ui.dcn-on-line', 'On line {c}', { c: l.code + (f.p.abbr ? ' ' + f.p.abbr : '') })));
    else if (f.p.code && !f.nf && !p.tool) { tags.push(tag('var(--violet)', k('ui.dcn-not-plan', 'Not in the plan'))); if (lvl === 'ok') lvl = 'odd'; }
    if (f.sg && (f.sg.c || f.sg.t)) tags.push(tag('var(--blue)', k('ui.dcn-suggested', 'Suggested – check it')));
    var gaps = b.miss.filter(function (x) { return x !== 'code' && x !== 'type'; });
    if (gaps.length) tags.push(tag('var(--warn)', k('ui.dcn-fill', 'Fill in: {w}', { w: gaps.map(function (x) { return partName(x).toLowerCase(); }).join(', ') })));
    else if (!b.miss.length && b.plain === splitStem(f.name)) tags.push(tag('var(--ok)', k('ui.dcn-follows', 'Name follows the rule')));
    var code = f.p.code ? f.p.code + ' ' + (codeName(f.p.code) || '') : '', seen = {};
    var h = '<li class="dcn-row dcn-' + lvl + '" data-dcnf="' + esc(f.id) + '"><div class="dcn-g">' +
      '<label class="dcn-c"><span>' + esc(k('ui.dcn-code', 'NS 3451 code')) + '</span><input list="dcnCodes" data-dcncode="' + esc(f.id) + '" value="' + esc(code.trim()) + '" title="' + esc(code.trim()) + '" placeholder="' + esc(k('ui.dcn-code-ph', 'Type 332 or sprinkler')) + '" autocomplete="off"></label>' +
      '<label class="dcn-c"><span>' + esc(k('ui.dcn-type', 'Document type')) + '</span><select data-dcntype="' + esc(f.id) + '"' + (f.p.code ? '' : ' disabled') + '>' + (f.p.code ? typeOpts(p, f) : '<option>' + esc(k('ui.dcn-code-first', 'Pick a code first')) + '</option>') + '</select></label>' +
      '<div class="dcn-n"><span>' + esc(k('ui.dcn-current', 'Current file name')) + '</span>' + (f.nf ? '<b data-noi18n>' + esc(f.name) + '</b>' : '<button type="button" class="text-btn" data-dcview="' + esc(f.id) + '"><i class="bi bi-file-earmark"></i> <span data-noi18n>' + esc(f.name) + '</span></button>') + (f.orig && f.orig !== f.name ? '<small class="muted" data-noi18n>' + esc(k('ui.dcn-sent-as', 'Sent as: {n}', { n: f.orig })) + '</small>' : '') + '</div>' +
      '<div class="dcn-t">' + tags.join('') + (f.sg && (f.sg.c || f.sg.t) ? '<button type="button" class="text-btn" data-dcnok="' + esc(f.id) + '">' + esc(k('ui.dcn-looks-right', 'Looks right')) + '</button>' : '') + '</div></div>';
    if (f.sg && (f.sg.c || f.sg.t)) h += '<p class="dcn-why"><i class="bi bi-lightbulb"></i> ' + esc([f.sg.c ? k('ui.dcn-code', 'NS 3451 code') + ': ' + f.sg.c : '', f.sg.t ? k('ui.dcn-type', 'Document type') + ': ' + f.sg.t : ''].filter(Boolean).join(' · ')) + '</p>';
    h += '<div class="dcn-s"><label class="dcn-fl"><span>' + esc(k('ui.dcn-kind', 'Kind of file')) + '</span><select data-dcnk="' + esc(f.id) + '">' + [['doc', 'ui.dcn-k-doc', 'Document'], ['photo', 'ui.dcn-k-photo', 'Photo'], ['drawing', 'ui.dcn-k-drawing', 'Drawing']].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === kd ? ' selected' : '') + '>' + esc(k(x[1], x[2])) + '</option>'; }).join('') + '</select></label>';
    r.parts.forEach(function (q) { if (NPART[q.k] && NPART[q.k][2] && !seen[q.k]) { seen[q.k] = 1; h += nfield(p, f, q.k); } });
    h += '<div class="dcn-sug"><span>' + esc(k('ui.dcn-name-from', 'Name from “{r}”', { r: rname(r) })) + '</span><code data-noi18n>' + b.html + esc(e) + '</code></div>' +
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
    else li.push('<li class="muted">' + esc(c.tt.length ? k('ui.dcn-cc-type-unclear', 'Type unclear – closest: {l}', { l: c.tt.join(', ') }) : k('ui.dcn-cc-no-type', 'No words that point to a document type.')) + '</li>');
    if (c.c) { var cm = f.p.code && String(f.p.code).slice(0, 3) !== c.c[0]; bad = bad || cm; li.push('<li>' + esc(k('ui.dcn-cc-about', 'About {c}', { c: c.c[0] + ' ' + (codeName(c.c[0]) || '') })) + ' <span class="muted">(' + esc(c.c[1]) + ')</span>' + (cm ? ' <span class="w">' + esc(k('ui.dcn-cc-row-says', 'The row says {v}.', { v: f.p.code })) + '</span> <button type="button" class="text-btn" data-dcnusec="' + esc(f.id) + '">' + esc(k('ui.dcn-use-v', 'Use {v}', { v: c.c[0] })) + '</button>' : '') + '</li>'); }
    else li.push('<li class="muted">' + esc(c.cs.length ? k('ui.dcn-cc-code-unclear', 'System unclear – closest: {l}', { l: c.cs.join(', ') }) : k('ui.dcn-cc-no-code', 'No words that point to an NS 3451 code.')) + '</li>');
    if (c.d) li.push('<li>' + esc(k('ui.dcn-cc-title', 'Product or title on page 1: {d}', { d: c.d })) + '</li>');
    if (c.lang) { var ln = { nb: k('ui.dcn-l-nb', 'Norwegian'), en: k('ui.dcn-l-en', 'English'), sv: k('ui.dcn-l-sv', 'Swedish'), de: k('ui.dcn-l-de', 'German') }[c.lang]; li.push('<li>' + esc(k('ui.dcn-cc-lang', 'Language: {l}', { l: ln })) + (c.lang !== 'nb' ? ' <span class="w">' + esc(k('ui.dcn-cc-nb', 'Check whether a Norwegian version is needed.')) + '</span>' : '') + '</li>'); }
    li.push(c.mk.length ? '<li>' + esc(k('ui.dcn-cc-mk', 'Marked for (Bruker, Drift, Prosjekt): {m}', { m: c.mk.join(', ') })) + '</li>' : '<li class="w">' + esc(k('ui.dcn-cc-nomk', 'No marking for user, operation or project found (Bruker, Drift, Prosjekt – spec 4.5)')) + '</li>');
    return '<div class="dcn-cc"><b>' + esc(k('ui.dcn-cc', 'Content check')) + '</b> ' + tag(bad ? 'var(--warn)' : 'var(--ok)', bad ? k('ui.dcn-cc-check', 'Check this') : k('ui.dcn-cc-fine', 'Nothing odd found')) + ' <span class="muted tnum">' + esc(k('ui.dcn-cc-size', '{n} pages · {c} characters', { n: c.pg, c: c.ch })) + '</span><ul>' + li.join('') + '</ul>' +
      (ccText[f.id] ? '<details><summary>' + esc(k('ui.dcn-cc-show', 'Show the text that was read')) + '</summary><pre data-noi18n>' + esc(ccText[f.id]) + '</pre></details>' : '') + run + '</div>';
  }
  function rulesHtml(p) {
    var use = p.nuse || {}, R = nrules(p), sel = nrule(p, nsel) || R[0], ed = !sel.b;
    var opts = function (cur) { return R.map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === cur ? ' selected' : '') + '>' + esc(rname(r)) + '</option>'; }).join(''); };
    var h = '<details class="dcn-rules"' + (nopen ? ' open' : '') + ' data-dcnrules><summary><i class="bi bi-sliders"></i> ' + esc(p.tool ? k('ui.dcn-rules-tool', 'Naming rules') : k('ui.dcn-rules', 'Naming rules for this project')) + '</summary><div class="dcn-use">' +
      [['doc', 'ui.dcn-use-doc', 'Documents'], ['photo', 'ui.dcn-use-photo', 'Photos'], ['drawing', 'ui.dcn-use-dwg', 'Drawings']].map(function (x) { return '<label class="dcn-fl"><span>' + esc(k(x[1], x[2])) + '</span><select data-dcnuse-k="' + x[0] + '">' + opts(use[x[0]] || NDEF[x[0]]) + '</select></label>'; }).join('') + '</div>';
    h += '<div class="dcn-rl">' + R.map(function (r) { return '<button type="button" class="dc-chip" aria-pressed="' + (r.id === sel.id) + '" data-dcnsel="' + esc(r.id) + '">' + esc(rname(r)) + '</button>'; }).join('') + '<button type="button" class="dc-chip" data-dcnnew><i class="bi bi-plus-lg"></i> ' + esc(k('ui.dcn-new', 'New rule')) + '</button></div>';
    h += '<div class="dcn-ed">' + (ed ? '<label class="dcn-fl dcn-wide"><span>' + esc(k('ui.dcn-rname', 'Rule name')) + '</span><input data-dcnr="n" value="' + esc(sel.n) + '" maxlength="60"></label>' : '<p class="muted">' + esc(k('ui.dcn-builtin', 'Built in from Boligbygg’s FDVU specification – copy it to make your own.')) + '</p>') +
      '<div class="dcn-use"><label class="dcn-fl"><span>' + esc(k('ui.dcn-sep', 'Between the parts')) + '</span><select data-dcnr="sep"' + (ed ? '' : ' disabled') + '>' + NSEP.map(function (s) { return '<option value="' + esc(s[0]) + '"' + (s[0] === sel.sep ? ' selected' : '') + '>' + esc(k(s[1], s[2])) + '</option>'; }).join('') + '</select></label>' +
      '<label class="dcn-fl"><span>' + esc(k('ui.dcn-case', 'Letters')) + '</span><select data-dcnr="cs"' + (ed ? '' : ' disabled') + '>' + [['keep', 'ui.dcn-cs-keep', 'As typed'], ['upper', 'ui.dcn-cs-upper', 'ALL CAPITALS'], ['lower', 'ui.dcn-cs-lower', 'all small']].map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === sel.cs ? ' selected' : '') + '>' + esc(k(s[1], s[2])) + '</option>'; }).join('') + '</select></label></div><ol class="dcn-parts">';
    sel.parts.forEach(function (q, i) {
      h += '<li><span class="tnum">' + (i + 1) + '</span><span class="dcn-pn">' + esc(partName(q.k)) + (q.k === 'text' ? ' <input data-dcnpt="' + i + '" value="' + esc(q.text || '') + '" maxlength="30"' + (ed ? '' : ' disabled') + ' aria-label="' + esc(partName('text')) + '">' : '') + (q.k === 'date' ? ' <select data-dcnpf="' + i + '"' + (ed ? '' : ' disabled') + ' aria-label="' + esc(partName('date')) + '">' + [['iso', '2026-11-16'], ['compact', '20261116'], ['no', '16.11.2026']].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === (q.fmt || 'iso') ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' : '') + '</span>' +
        '<label class="dcn-req"><input type="checkbox" data-dcnpr="' + i + '"' + (q.req === false ? '' : ' checked') + (ed ? '' : ' disabled') + '> ' + esc(k('ui.dcn-required', 'Required')) + '</label>' +
        (i ? '<select data-dcnpp="' + i + '"' + (ed ? '' : ' disabled') + ' aria-label="' + esc(k('ui.dcn-joined', 'Joined to the part before with')) + '"><option value="">' + esc(k('ui.dcn-as-rule', 'As the rule')) + '</option>' + NSEP.map(function (s) { return '<option value="' + esc(s[0]) + '"' + (q.pre === s[0] ? ' selected' : '') + '>' + esc(k(s[1], s[2])) + '</option>'; }).join('') + '</select>' : '<span></span>') +
        (ed ? '<span class="dcn-mv"><button type="button" class="icon-btn sm" data-dcnpm="' + i + ':-1"' + (i ? '' : ' disabled') + ' aria-label="' + esc(k('ui.dcn-up', 'Move up')) + '"><i class="bi bi-arrow-up"></i></button><button type="button" class="icon-btn sm" data-dcnpm="' + i + ':1"' + (i < sel.parts.length - 1 ? '' : ' disabled') + ' aria-label="' + esc(k('ui.dcn-down', 'Move down')) + '"><i class="bi bi-arrow-down"></i></button><button type="button" class="icon-btn sm" data-dcnpd="' + i + '" aria-label="' + esc(k('ui.dcn-remove-part', 'Remove the part')) + '"><i class="bi bi-x-lg"></i></button></span>' : '<span></span>') + '</li>';
    });
    h += '</ol>' + (ed ? '<label class="dcn-fl"><span>' + esc(k('ui.dcn-add-part', 'Add a part')) + '</span><select data-dcnpa><option value=""></option>' + Object.keys(NPART).map(function (x) { return '<option value="' + x + '">' + esc(partName(x)) + '</option>'; }).join('') + '</select></label>' : '');
    var ex = { id: '_ex', name: 'x.pdf', p: { code: '442', abbr: 'DA', text: 'taklampe korridor C20', kind: 'doc' }, nv: { floor: 'H02', disc: 'E', dtype: 'P', room: '0204', free: 'kjøkken', rev: '01' } };
    h += '<p class="dcn-ex"><span>' + esc(k('ui.dcn-example', 'Example (a made-up datasheet, 442 DA)')) + '</span><code data-noi18n>' + nbuild(Object.assign({}, p, { files: [ex] }), ex, sel).html + '.pdf</code></p>' +
      '<div class="dcn-b"><button type="button" class="pill-btn" data-dcncopy><i class="bi bi-copy"></i> ' + esc(k('ui.dcn-copy', 'Copy this rule')) + '</button>' + (ed ? '<button type="button" class="text-btn" data-dcndel>' + esc(k('ui.dcn-del', 'Delete the rule')) + '</button>' : '') + '</div></div></details>';
    return h;
  }
  function nfiles(p, F) {
    var h = '<datalist id="dcnCodes">' + codeList(p).map(function (c) { return '<option value="' + esc(c[0] + ' ' + c[1]) + '"></option>'; }).join('') + '</datalist>' + rulesHtml(p);
    var todo = F.filter(function (f) { return !f.nf && (!f.p.code || (ext(f.name) === '.pdf' && !f.cc)); }).length;
    if (todo) h += '<p class="dc-facts"><button type="button" class="pill-btn" data-dcnall><i class="bi bi-magic"></i> ' + esc(k('ui.dcn-all', 'Suggest codes and check {n} files', { n: todo })) + '</button></p>';
    return h + '<ul class="dcn-files">' + F.map(function (f) { return nrow(p, f); }).join('') + '</ul>';
  }
  /* suggest a code and type from the name for every file, then read every PDF that hasn't been read (one at a time) */
  function suggestAll(pid) {
    var pdfs = []; saveP(pid, function (p) { (p.files || []).forEach(function (f) { if (f.nf) return; if (!f.p.code || !f.p.abbr) { guessName(f); relink(p, f); } if (ext(f.name) === '.pdf' && !f.cc) pdfs.push(f.id); }); }); draw();
    return pdfs.reduce(function (pr, id5) { return pr.then(function () { return new Promise(function (res) { ccRun(pid, id5); var w = setInterval(function () { if (!ccBusy[id5]) { clearInterval(w); res(); } }, 200); }); }); }, Promise.resolve());
  }
  /* "Use this name" for every file whose rule has nothing missing – returns how many got a new name */
  function useAll(pid) { var n = 0; saveP(pid, function (p) { (p.files || []).forEach(function (f) { if (f.nf) return; var b = nbuild(p, f), nm = b.plain + ext(f.orig || f.name); if (!b.miss.length && nm !== f.name) { rename(p, f, nm); n++; } }); }); draw(); return n; }
  function ready(p, f) { var b = nbuild(p, f); return !b.miss.length; }
  function busy() { return Object.keys(ccBusy).length; }
  function ruleEdit(fn) { saveP(cur(), function (p) { var r = (p.nrules || []).filter(function (x) { return x.id === nsel; })[0]; if (r) fn(r, p); }); draw(); }
  function listen() {
    /* naming events (the Files tab) */
    on('focusin', function (e) { var t = e.target; if (!t.matches || !t.matches('[data-dcncode]')) return; t.setAttribute('data-prev', t.value); if (t.value) { t.placeholder = k('ui.dcn-now', 'Now: {c} – type a code or a word', { c: t.value }); t.value = ''; } });   /* empty while picking, so the list shows every code (JP 11:54) */
    on('focusout', function (e) { var t = e.target; if (!t.matches || !t.matches('[data-dcncode]')) return; if (!t.value.trim()) t.value = t.getAttribute('data-prev') || ''; t.placeholder = k('ui.dcn-code-ph', 'Type 332 or sprinkler'); });
    on('change', function (e) {
      var t = e.target; if (!t.matches || !t.closest('#wkDocCtl')) return; var v = t.value, fid;
      if ((fid = t.dataset.dcncode)) { var m = /^\s*(\d{3,4})\b/.exec(v); if (!m) return; saveP(cur(), function (p) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (!f) return; f.p.code = m[1]; if (f.sg) delete f.sg.c; relink(p, f); }); draw(); return; }
      if ((fid = t.dataset.dcntype)) { saveP(cur(), function (p) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (!f) return; f.p.abbr = v; if (f.sg) delete f.sg.t; relink(p, f); }); draw(); return; }
      if ((fid = t.dataset.dcnk)) { saveP(cur(), function (p) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (f) f.nk = v; }); draw(); return; }
      if (t.dataset.dcnv) { var a = t.dataset.dcnv.split(':'); saveP(cur(), function (p) { var f = (p.files || []).filter(function (x) { return x.id === a[0]; })[0]; if (f) { f.nv = f.nv || {}; f.nv[a[1]] = v.slice(0, 80); } }); draw(); return; }
      if (t.dataset.dcnuseK) { saveP(cur(), function (p) { p.nuse = Object.assign({}, p.nuse); p.nuse[t.dataset.dcnuseK] = v; }); draw(); return; }
      if (t.dataset.dcnr) { ruleEdit(function (r) { r[t.dataset.dcnr] = t.dataset.dcnr === 'n' ? v.slice(0, 60) || r.n : v; }); return; }
      if (t.dataset.dcnpr) { ruleEdit(function (r) { r.parts[+t.dataset.dcnpr].req = t.checked ? undefined : false; }); return; }
      if (t.dataset.dcnpp) { ruleEdit(function (r) { var q = r.parts[+t.dataset.dcnpp]; if (v === '' && t.selectedIndex === 0) delete q.pre; else q.pre = v; }); return; }
      if (t.dataset.dcnpt) { ruleEdit(function (r) { r.parts[+t.dataset.dcnpt].text = v.slice(0, 30); }); return; }
      if (t.dataset.dcnpf) { ruleEdit(function (r) { r.parts[+t.dataset.dcnpf].fmt = v; }); return; }
      if (t.matches('[data-dcnpa]') && v) { ruleEdit(function (r) { r.parts.push(v === 'date' ? { k: v, fmt: 'iso' } : { k: v }); }); return; }
    });
    on('toggle', function (e) { if (e.target.matches && e.target.matches('[data-dcnrules]')) nopen = e.target.open; }, true);
    on('click', function (e) {
      var t = e.target, b; if (!t.closest || !t.closest('#wkDocCtl')) return;
      var fileOf = function (p, id) { return (p.files || []).filter(function (x) { return x.id === id; })[0]; };
      if ((b = t.closest('[data-dcnuse]'))) { var id = b.dataset.dcnuse; saveP(cur(), function (p) { var f = fileOf(p, id); if (!f) return; var nb2 = nbuild(p, f); if (!nb2.miss.length) rename(p, f, nb2.plain + ext(f.orig || f.name)); }); draw(); return; }
      if ((b = t.closest('[data-dcnorig]'))) { var id2 = b.dataset.dcnorig; saveP(cur(), function (p) { var f = fileOf(p, id2); if (f && f.orig) { rename(p, f, f.orig); delete f.orig; } }); draw(); return; }
      if ((b = t.closest('[data-dcnok]'))) { var id3 = b.dataset.dcnok; saveP(cur(), function (p) { var f = fileOf(p, id3); if (f) delete f.sg; }); draw(); return; }
      if ((b = t.closest('[data-dcncc]'))) { ccRun(cur(), b.dataset.dcncc); return; }
      if ((b = t.closest('[data-dcnuset], [data-dcnusec]'))) { var id4 = b.dataset.dcnuset || b.dataset.dcnusec, isT = !!b.dataset.dcnuset; saveP(cur(), function (p) { var f = fileOf(p, id4); if (!f || !f.cc) return; if (isT && f.cc.t) f.p.abbr = f.cc.t[0]; if (!isT && f.cc.c) f.p.code = f.cc.c[0]; relink(p, f); }); draw(); return; }
      if (t.closest('[data-dcnall]')) { suggestAll(cur()); return; }
      if ((b = t.closest('[data-dcnsel]'))) { nsel = b.dataset.dcnsel; nopen = true; draw(); return; }
      if (t.closest('[data-dcnnew], [data-dcncopy]')) { var src = t.closest('[data-dcncopy]') ? nrule(proj(cur()), nsel) || NRULES[0] : NRULES[0], nr = JSON.parse(JSON.stringify(src)); nr.id = 'own-' + uid(); nr.n = t.closest('[data-dcncopy]') ? k('ui.dcn-copy-of', 'Copy of {r}', { r: rname(src) }) : k('ui.dcn-my-rule', 'My rule'); delete nr.b; nsel = nr.id; nopen = true;
        saveP(cur(), function (p) { p.nrules = (p.nrules || []).concat([nr]).slice(0, 20); }); draw(); return; }
      if (t.closest('[data-dcndel]')) { var gone = nsel; saveP(cur(), function (p) { p.nrules = (p.nrules || []).filter(function (r) { return r.id !== gone; }); Object.keys(p.nuse || {}).forEach(function (x) { if (p.nuse[x] === gone) delete p.nuse[x]; }); }); nsel = ''; draw(); return; }
      if ((b = t.closest('[data-dcnpm]'))) { var mv = b.dataset.dcnpm.split(':').map(Number); ruleEdit(function (r) { var j = mv[0] + mv[1], x = r.parts[mv[0]]; r.parts[mv[0]] = r.parts[j]; r.parts[j] = x; }); return; }
      if ((b = t.closest('[data-dcnpd]'))) { ruleEdit(function (r) { r.parts.splice(+b.dataset.dcnpd, 1); }); return; }
    });
  }
  window.DocNaming = { use: use, files: nfiles, guess: guessName, suggestAll: suggestAll, useAll: useAll, ready: ready, busy: busy };
})();
