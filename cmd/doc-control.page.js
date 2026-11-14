/* Work → Document control (JP 2026-11-14): check that a building project's FDV documentation is all delivered.
   A project gets a document plan (Excel, NS 3456 document types per NS 3451 system code – e.g. Boligbygg's Dokumentplan
   4-siffer), and the delivered files (several files, a folder or a .zip). Each file is matched to its line in the plan by its
   name (3-digit code + document code, or the planned name), and the name is checked against the naming rules (Boligbygg:
   "442 DA taklampe korridor", as-built drawings "11621-H02-V-332-P-01 – Rørplan"). Each line gets a status and a comment;
   the overview shows what is missing per NS 3451 group, and the report (PDF) lists what is missing, what has comments and
   the naming errors. The plan and the statuses are in dash.tools.dctl (synced, encrypted); the files stay on this device
   (IndexedDB dash-dctl). The page is #dc=<id> in the address, so the phone's back gesture closes it. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, LP = window.__core && window.__core.lifepages;
  var el0 = document.getElementById('wkDocCtl'); if (!el0) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function k(key, en, o) { return I18N.k(key, en, o); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function readJSON(key, d) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? d : v; } catch (e) { return d; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmt(s) { if (!s) return ''; var p = String(s).split('-'); return p.length === 3 ? +p[2] + '.' + +p[1] + '.' + p[0] : s; }
  function size(n) { return n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB'; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });

  /* ---------- NS 3456 document types (A–L) and the document codes in file names (Boligbygg, Tillegg A) ---------- */
  var TYPES = [['A', 'Kravoppnåelse', 'Compliance'], ['B', 'Drift', 'Operation'], ['C', 'Vedlikehold', 'Maintenance'], ['D', 'Identifikasjon', 'Identification'], ['E', 'Produktinformasjon', 'Product information'], ['F', 'Attestasjon', 'Attestation'],
    ['G', 'Bruksanvisning', 'User instructions'], ['H', 'Beskrivelse', 'Description'], ['I', 'Protokoll', 'Protocol'], ['K', 'Tegning', 'Drawing'], ['L', 'Bilde', 'Picture']];
  function typeName(l) { var t = TYPES.filter(function (q) { return q[0] === l; })[0]; return t ? (I18N.lang === 'nb' ? t[1] : t[2]) : l; }
  /* the type text in a plan → letters ("Drift, Vedlikehold" → BC, "E" → E, "Produktinformasjon" → E) */
  function letters(s) {
    s = String(s || '').trim(); if (!s) return '';
    if (/^[A-L](\s*[,/&+]\s*[A-L])*$/i.test(s)) return s.toUpperCase().replace(/[^A-L]/g, '');
    if (s.length > 30) return '';   /* a document title (e.g. Kjøpskontrakter in sheet 1), not a type */
    var low = s.toLowerCase(), out = '';
    TYPES.forEach(function (t) { if (low.indexOf(t[1].toLowerCase()) >= 0 || low.indexOf(t[2].toLowerCase()) >= 0) out += t[0]; });
    if (!out && /fdv|drift|vedlikehold/.test(low)) out = 'BC';
    if (!out && /samsvar|sluttkontroll|kontrollerkl/.test(low)) out = 'A';
    if (!out && /datablad|dataark|produktdata/.test(low)) out = 'E';
    if (!out && /tegning|som bygget|as.?built/.test(low)) out = 'K';
    return out;
  }
  /* the two letters after the code in a file name, and the NS 3456 types each fits */
  var ABBR = { SE: 'A', KR: 'A', PU: 'AI', RA: 'A', BR: 'A', AT: 'F', DV: 'BC', PR: 'BC', SA: 'BC', ID: 'D', DA: 'E', PD: 'E', SP: 'E', BA: 'G', BE: 'H', FB: 'H', NO: 'H', PK: 'I', PT: 'I', SK: 'I', BI: 'L',
    LI: '', RI: '', BM: '', BF: '', SH: '', MR: '', OK: '', PA: '', PL: '', PP: '', RF: '', ST: '', SD: '' };
  var TEG = /^(\d{3,6})-([KUHLT]\d\d|000)-([A-Z])-(\d{3})-([BDFOPSTU])-(\d\d)\b\s*[–-]?\s*(.*)$/;

  /* ---------- a file name: its code, document code and text, and what is wrong with it ---------- */
  function parseName(name) {
    var stem = String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim(), ext = (String(name).match(/\.([a-z0-9]{2,5})$/i) || ['', ''])[1].toLowerCase();
    var r = { stem: stem, ext: ext, code: '', abbr: '', text: stem, kind: 'doc', issues: [] }, m;
    var pic = /^(jpe?g|png|heic|heif|webp|gif|mp4|mov)$/.test(ext);
    if ((m = String(name).replace(/\.[a-z0-9]{2,5}$/i, '').match(TEG))) {
      r.kind = 'drawing'; r.code = m[4]; r.abbr = 'K'; r.text = m[7] || ''; r.build = m[1]; r.floor = m[2]; r.fag = m[3]; r.dtype = m[5]; r.no = m[6];
      if (/\b(rev|ver|versjon|v)\.?\s*[0-9a-z]{1,3}\b|\bR\d{2}\b|[-_]r\d+$/i.test(r.text)) r.issues.push(['warn', 'version']);
      return r;
    }
    if ((m = stem.match(/^(\d{3})(?:[.,](\d{1,3}))?(?:\s+|-)([A-Za-zÆØÅæøå]{2})(?=\s|-|$)\s*-?\s*(.*)$/))) {
      r.code = m[1] + (m[2] && !/^0+$/.test(m[2]) ? '.' + m[2] : ''); r.abbr = m[3].toUpperCase(); r.text = m[4] || '';
      if (!(r.abbr in ABBR)) r.issues.push(['warn', 'abbr']);
    } else if ((m = stem.match(/^(\d{3})(?:[.,]\d{1,3})?(?:\s+|-|$)(.*)$/))) {
      r.code = m[1]; r.text = m[2] || ''; if (!pic) r.issues.push(['warn', 'noabbr']);
    } else if (/^\d{3,6}-/.test(stem) && /-[A-Z]-\d{3}-/.test(stem)) { r.kind = 'drawing'; r.issues.push(['err', 'drawing']); var c = stem.match(/-[A-Z]-(\d{3})-/); r.code = c ? c[1] : ''; }
    else if (!pic) r.issues.push(['err', 'nocode']);
    if (!pic && r.kind === 'doc' && stem.length > 30) r.issues.push(['warn', 'long']);
    if (r.kind === 'doc' && !r.text && r.code && !pic) r.issues.push(['warn', 'notext']);
    return r;
  }
  function issueText(q, f) {
    var p = f && f.p || {};
    return { version: k('ui.dc-iss-version', 'An as-built drawing has a version number in the name'), abbr: k('ui.dc-iss-abbr', 'Unknown document code “{a}”', { a: p.abbr }), noabbr: k('ui.dc-iss-noabbr', 'No document code after the system code (e.g. DA, DV, SE)'),
      drawing: k('ui.dc-iss-drawing', 'The drawing name doesn’t follow building-floor-discipline-code-type-number'), nocode: k('ui.dc-iss-nocode', 'Doesn’t start with a 3-digit NS 3451 code'), long: k('ui.dc-iss-long', 'Longer than 30 characters ({n})', { n: (p.stem || '').length }),
      notext: k('ui.dc-iss-notext', 'No describing text after the codes') }[q[1]] || q[1];
  }

  /* ---------- the plan: Excel with one sheet per main group (or one sheet); the header row is found by its words ---------- */
  var COLS = [['code', /anleggs?n(umme)?r|system ?kode|^kode$|ns ?3451|bygningsdel(skode)?$|^nr\.?$|tfm/i], ['sys', /anleggsnavn|system ?navn|bygningsdel ?navn|^navn$|anlegg$|beskrivelse/i], ['type', /dokument ?typ|informasjonstype|^dokumentasjon(stype)?$|^type$/i],
    ['planned', /planlagt|filnavn|dokumentnavn|navngiv|dokumenttittel|tittel/i], ['note', /kommentar|merknad|^note/i], ['fire', /brannbok/i], ['resp', /ansvarlig|entrepren|leverand|utførende|^fag$|kontrakt/i], ['due', /frist|leveranse ?dato|^dato$/i], ['status', /^status$|levert/i]];
  function findHeader(rows) {
    for (var i = 0; i < Math.min(rows.length, 20); i++) {
      var row = rows[i] || [], map = {}, hits = 0;
      row.forEach(function (c, j) { c = String(c || '').trim(); if (!c || c.length > 60) return; for (var q = 0; q < COLS.length; q++) if (!(COLS[q][0] in map) && COLS[q][1].test(c)) { map[COLS[q][0]] = j; hits++; break; } });
      if ('code' in map && ('type' in map || 'planned' in map || 'sys' in map) && hits >= 2) return { at: i, map: map };
    }
    return null;
  }
  function normCode(v) {
    var s = String(v == null ? '' : v).trim(), m = s.match(/^(\d{1,4})(?:[.,](\d{1,3}))?/); if (!m) return '';
    var c = m[1], sub = m[2] || '';
    if (c.length === 3 && /^0*$/.test(sub)) return c;
    if (c.length === 3 && sub) return c + '.' + sub.replace(/0+$/, '').padEnd(1, '0');
    return c;
  }
  function stMap(v) { v = String(v || '').toLowerCase().trim(); return !v ? '' : /ikke relevant|n\/?a|utgår/.test(v) ? 'na' : /anmerk|kommentar/.test(v) ? 'cmt' : /godkjent|ok/.test(v) ? 'ok' : /avvist|retur/.test(v) ? 'rej' : /^(j|ja|x|levert|mottatt|yes|y)$/.test(v) ? 'recv' : /^(n|nei|no|mangler)$/.test(v) ? 'missing' : ''; }
  function parsePlan(sheets) {
    var lines = [], seen = 0;
    sheets.forEach(function (sh) {
      var h = findHeader(sh.rows); if (!h) return; seen++;
      var M = h.map, last = null;
      for (var i = h.at + 1; i < sh.rows.length; i++) {
        var r = sh.rows[i] || [], g = function (key) { return key in M ? String(r[M[key]] == null ? '' : r[M[key]]).trim() : ''; };
        var code = normCode(g('code')), sys = g('sys'), type = g('type'), planned = g('planned'), note = g('note');
        if (code) last = { code: code, sys: sys, fire: /^(ja|j|x|yes)$/i.test(g('fire')), resp: g('resp') };
        else if (!last || sys) continue;   /* a row of its own without a code is a heading or a note */
        if (/^navngivning ref|^dokumentnavnet skal/i.test(planned)) { note = note || ''; planned = ''; }   /* the general naming instruction in the template */
        var L = letters(type);
        if (!type && !planned) continue;
        lines.push({ id: uid() + lines.length, code: last.code, sys: (code ? sys : last.sys).slice(0, 160), type: type.slice(0, 80), t: L, planned: planned.replace(/^eksempel:\s*/i, '').slice(0, 160), ex: /^eksempel:/i.test(planned) || undefined,
          note: note.slice(0, 400), fire: last.fire || undefined, resp: (g('resp') || last.resp || '').slice(0, 80), due: g('due').slice(0, 10), st: stMap(g('status')) || 'missing', files: [] });
      }
    });
    return { lines: lines, sheets: seen };
  }

  /* ---------- Excel and zip, read without a library (an .xlsx is a zip of XML) ---------- */
  function zipEntries(buf) {
    var v = new DataView(buf), u8 = new Uint8Array(buf), n = buf.byteLength, eocd = -1;
    for (var i = n - 22; i >= Math.max(0, n - 70000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip');
    var count = v.getUint16(eocd + 10, true), off = v.getUint32(eocd + 16, true), out = [];
    for (var q = 0; q < count && off + 46 <= n; q++) {
      if (v.getUint32(off, true) !== 0x02014b50) break;
      var flags = v.getUint16(off + 8, true), method = v.getUint16(off + 10, true), csize = v.getUint32(off + 20, true), usize = v.getUint32(off + 24, true);
      var nl = v.getUint16(off + 28, true), xl = v.getUint16(off + 30, true), cl = v.getUint16(off + 32, true), loc = v.getUint32(off + 42, true), nb = u8.subarray(off + 46, off + 46 + nl), name;
      try { name = new TextDecoder('utf-8', { fatal: !(flags & 0x800) }).decode(nb); } catch (e) { name = Array.prototype.map.call(nb, function (b) { return String.fromCharCode(b === 0x91 ? 230 : b === 0x9B ? 248 : b === 0x86 ? 229 : b === 0x92 ? 198 : b === 0x9D ? 216 : b === 0x8F ? 197 : b < 128 ? b : 95); }).join(''); }
      off += 46 + nl + xl + cl;
      var start = loc + 30 + v.getUint16(loc + 26, true) + v.getUint16(loc + 28, true);
      out.push({ name: name, method: method, data: u8.subarray(start, start + csize), size: usize });
    }
    return out;
  }
  function inflate(z) {
    if (z.method === 0) return Promise.resolve(z.data);
    if (z.method !== 8 || typeof DecompressionStream === 'undefined') return Promise.reject(new Error('method'));
    return new Response(new Blob([z.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function readBook(buf) {
    var E = {}; zipEntries(buf).forEach(function (z) { E[z.name] = z; });
    function text(nm) { return E[nm] ? inflate(E[nm]).then(function (u) { return new TextDecoder('utf-8').decode(u); }) : Promise.resolve(''); }
    var xp = new DOMParser();
    return Promise.all([text('xl/workbook.xml'), text('xl/_rels/workbook.xml.rels'), text('xl/sharedStrings.xml')]).then(function (r) {
      var rel = {}, ss = [], list = [];
      if (r[1]) [].forEach.call(xp.parseFromString(r[1], 'application/xml').getElementsByTagName('Relationship'), function (x) { rel[x.getAttribute('Id')] = x.getAttribute('Target'); });
      if (r[2]) [].forEach.call(xp.parseFromString(r[2], 'application/xml').getElementsByTagName('si'), function (si) { ss.push([].map.call(si.getElementsByTagName('t'), function (t) { return t.textContent; }).join('')); });
      if (r[0]) [].forEach.call(xp.parseFromString(r[0], 'application/xml').getElementsByTagName('sheet'), function (s) {
        var id = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'), t = rel[id];
        if (t) list.push({ name: s.getAttribute('name') || '', path: t.charAt(0) === '/' ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '') });
      });
      if (!list.length) Object.keys(E).filter(function (x) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(x); }).sort().forEach(function (x) { list.push({ name: x, path: x }); });
      return Promise.all(list.map(function (sh) {
        return text(sh.path).then(function (x) {
          var rows = [];
          if (x) [].forEach.call(xp.parseFromString(x, 'application/xml').getElementsByTagName('row'), function (row) {
            var cells = [], ri = (+row.getAttribute('r') || rows.length + 1) - 1;
            [].forEach.call(row.getElementsByTagName('c'), function (c) {
              var ref = c.getAttribute('r') || '', col = 0, m = ref.match(/^[A-Z]+/);
              if (m) for (var j = 0; j < m[0].length; j++) col = col * 26 + (m[0].charCodeAt(j) - 64); else col = cells.length + 1;
              var t = c.getAttribute('t'), vv = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('is')[0], val = '';
              if (t === 's' && vv) val = ss[+vv.textContent] || ''; else if (t === 'inlineStr' && is) val = is.textContent; else if (vv) val = vv.textContent;
              cells[col - 1] = String(val).trim();
            });
            for (var q = 0; q < cells.length; q++) if (cells[q] == null) cells[q] = '';
            rows[ri] = cells;
          });
          for (var q = 0; q < rows.length; q++) if (!rows[q]) rows[q] = [];
          return { name: sh.name, rows: rows };
        });
      }));
    });
  }
  function readCsv(txt) {
    var sep = (txt.split('\n')[0].match(/;/g) || []).length >= (txt.split('\n')[0].match(/,/g) || []).length ? ';' : txt.indexOf('\t') >= 0 ? '\t' : ',';
    return [{ name: 'csv', rows: txt.replace(/^﻿/, '').split(/\r?\n/).map(function (l) { var out = [], cur = '', q = false; for (var i = 0; i < l.length; i++) { var ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === sep) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(function (s) { return s.trim(); }); }) }];
  }

  /* ---------- matching a file to a line ---------- */
  function words(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9æøå]+/g, ' ').split(' ').filter(function (w) { return w.length > 2 && !/^\d+$/.test(w); }); }
  function score(p, line) {
    var lc = String(line.code), c3 = lc.slice(0, 3), s = 0;
    if (!p.code || p.code.slice(0, 3) !== c3) return 0;
    s += 4; if (lc.length > 3 && p.code === lc) s += 1;
    var pl = String(line.planned || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (pl && !line.ex && pl === p.stem.toLowerCase()) s += 20;
    var ft = p.kind === 'drawing' ? 'K' : ABBR[p.abbr] || '';
    if (ft && line.t && ft.split('').some(function (x) { return line.t.indexOf(x) >= 0; })) s += 3;
    else if (p.abbr && line.planned && new RegExp('^\\d{3}\\S*\\s+' + p.abbr + '\\b', 'i').test(line.planned)) s += 3;
    else if (ft && line.t) s -= 2;
    var w = words(p.text), lw = words(line.planned + ' ' + line.sys + ' ' + line.type);
    s += Math.min(3, w.filter(function (x) { return lw.some(function (y) { return y === x || (x.length > 4 && (y.indexOf(x) === 0 || x.indexOf(y) === 0)); }); }).length);
    return s;
  }
  function bestLine(pr, p) {
    var best = null, bs = 3.5;
    pr.lines.forEach(function (l) { var s = score(p, l); if (s > bs || (s === bs && best && !l.files.length && best.files.length)) { bs = s; best = l; } });
    return best;
  }

  /* ---------- storage ---------- */
  function projects() { return Fe.list('dctl'); }
  function proj(id) { return projects().filter(function (x) { return x.id === id; })[0] || null; }
  function saveP(id, fn) { var t = Fe.tools(); (t.dctl || []).forEach(function (r) { if (r && r.id === id) fn(r); }); Fe.saveTools(t); }
  var idb = null;
  function db() { return idb || (idb = new Promise(function (res, rej) { var r = indexedDB.open('dash-dctl', 1); r.onupgradeneeded = function () { r.result.createObjectStore('files'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { idb = null; rej(r.error); }; })); }
  function putBlob(id, b) { return db().then(function (d) { return new Promise(function (res) { var t = d.transaction('files', 'readwrite'); t.objectStore('files').put(b, id); t.oncomplete = function () { res(true); }; t.onerror = t.onabort = function () { res(false); }; }); }).catch(function () { return false; }); }
  function getBlob(id) { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('files').objectStore('files').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function delBlob(id) { return db().then(function (d) { d.transaction('files', 'readwrite').objectStore('files').delete(id); }).catch(function () {}); }

  /* ---------- statuses ---------- */
  var ST = [['missing', 'ui.dc-st-missing', 'Missing', '#8a94a3', 'circle'], ['recv', 'ui.dc-st-recv', 'Received – to check', '#3b6fb6', 'inbox'], ['ok', 'ui.dc-st-ok', 'Approved', '#2f8a57', 'check-circle'],
    ['cmt', 'ui.dc-st-cmt', 'Approved with comments', '#b7791f', 'chat-square-text'], ['rej', 'ui.dc-st-rej', 'Not approved – send back', '#b4443c', 'x-circle'], ['na', 'ui.dc-st-na', 'Not relevant', '#a0a7b1', 'dash-circle']];
  function st(s) { return ST.filter(function (q) { return q[0] === s; })[0] || ST[0]; }
  function stName(s) { var q = st(s); return k(q[1], q[2]); }
  function chip(s) { var q = st(s); return '<span class="dc-st" style="--c:' + q[3] + '"><i class="bi bi-' + q[4] + '"></i> ' + esc(stName(s)) + '</span>'; }
  function counts(lines) { var c = { all: lines.length }; ST.forEach(function (q) { c[q[0]] = 0; }); lines.forEach(function (l) { c[l.st] = (c[l.st] || 0) + 1; }); c.done = c.ok + c.cmt + c.na; return c; }
  function grpName(d) { return LP && LP.nsName ? LP.nsName(d) : d; }
  function codeName(c) { c = String(c || ''); var n = LP && LP.nsName ? LP.nsName(c.slice(0, 3)) || LP.nsName(c.slice(0, 2)) : ''; return n; }
  function lineTitle(l) { return l.sys || codeName(l.code) || ''; }
  function typeLabel(l) { return l.t ? l.t.split('').map(typeName).join(', ') : l.type; }

  /* ---------- the page ---------- */
  var open = null, tab = 'over', filt = 'all', q = '', openLine = null, adding = false, editing = false, pasting = false, quick = false, picking = false;
  try { quick = sessionStorage.getItem('dash.dcQuick') === '1'; } catch (e) {}
  try { tab = sessionStorage.getItem('dash.dcTab') || 'over'; } catch (e) {}
  function hashId() { var m = location.hash.match(/^#dc=([\w-]+)$/); return m ? m[1] : null; }
  open = hashId();
  function go(id) { open = id; openLine = null; editing = false; if (hashId() !== id) history.pushState({ dc: id }, '', location.pathname + location.search + '#dc=' + id); draw(); window.scrollTo(0, 0); }
  function back() { if (hashId() && history.state && history.state.dc) { history.back(); return; } open = null; history.replaceState(null, '', location.pathname + location.search); draw(); }
  window.addEventListener('popstate', function () { var id = hashId(); if (id !== open) { open = id; openLine = null; draw(); } });
  function setTab(t) { tab = t; try { sessionStorage.setItem('dash.dcTab', t); } catch (e) {} }

  function projForm(p) {
    p = p || {};
    return '<form class="dc-pform" data-dcpform="' + esc(p.id || '') + '">' +
      '<label><span>' + esc(k('ui.dc-project', 'Project')) + '</span><input name="name" maxlength="120" required value="' + esc(p.name || '') + '" placeholder="' + esc(k('ui.dc-project-ph', 'e.g. Made-up school, new building')) + '"></label>' +
      '<label><span>' + esc(k('ui.dc-project-no', 'Project no.')) + '</span><input name="no" maxlength="40" value="' + esc(p.no || '') + '"></label>' +
      '<label><span>' + esc(k('ui.dc-contractor', 'Contractor')) + '</span><input name="who" maxlength="120" value="' + esc(p.who || '') + '" placeholder="' + esc(k('ui.dc-contractor-ph', 'Who delivers, e.g. the sprinkler contractor')) + '"></label>' +
      '<label><span>' + esc(k('ui.dc-trade', 'Trade / delivery')) + '</span><input name="trade" maxlength="80" value="' + esc(p.trade || '') + '" placeholder="' + esc(k('ui.dc-trade-ph', 'e.g. Sprinkler, Facade, Windows')) + '"></label>' +
      '<label><span>' + esc(k('ui.dc-due', 'Deadline')) + '</span><input name="due" type="date" value="' + esc(p.due || '') + '"></label>' +
      '<div class="dc-facts"><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> ' + esc(k('ui.save', 'Save')) + '</button><button type="button" class="text-btn" data-dccancel>' + esc(k('ui.cancel', 'Cancel')) + '</button></div></form>';
  }
  function list() {
    var L = projects().slice().sort(function (a, b) { return (b.made || '') < (a.made || '') ? -1 : 1; });
    var body = adding ? projForm(null) : '';
    body += L.length ? '<ul class="kit-list">' + L.map(function (p) {
      var c = counts(p.lines || []), pc = c.all ? Math.round(c.done / c.all * 100) : 0;
      return '<li class="kit-item"><button type="button" class="kit-main" data-dcopen="' + esc(p.id) + '"><span class="kit-ic" style="--c:#3b6fb6"><i class="bi bi-folder-check"></i></span>' +
        '<span class="kit-x"><b data-noi18n>' + esc(p.name) + '</b><small data-noi18n>' + esc([p.no, p.trade, p.who, c.all ? k('ui.dc-n-docs', '{n} documents', { n: c.all }) : k('ui.dc-no-plan', 'No plan yet'), c.missing ? k('ui.dc-n-missing', '{n} missing', { n: c.missing }) : ''].filter(Boolean).join(' · ')) + '</small></span>' +
        (c.all ? '<span class="kit-r"><b class="dc-pc">' + pc + ' %</b></span>' : '') + '<i class="bi bi-chevron-right fdv-go"></i></button></li>';
    }).join('') + '</ul>' : (adding ? '' : '<p class="empty kit-empty">' + esc(k('ui.dc-empty', 'Add a project, import its document plan (Excel) and the delivered files – you see at once what is missing, and check each document.')) + '</p>');
    return '<div class="card-head"><h2><i class="bi bi-folder-check"></i> ' + esc(k('ui.doc-control', 'Document control')) + '</h2>' + (adding ? '' : '<div class="head-actions"><button type="button" class="text-btn" data-dcnew><i class="bi bi-plus-lg"></i> ' + esc(k('ui.new', 'New')) + '</button></div>') + '</div>' + body;
  }
  function full(p) {
    var T = [['over', k('ui.dc-tab-over', 'Overview'), 'speedometer2'], ['docs', k('ui.dc-tab-docs', 'Documents'), 'list-check'], ['files', k('ui.dc-tab-files', 'Files'), 'files'], ['report', k('ui.fdv-tab-report', 'Report'), 'file-earmark-text']];
    if (!T.some(function (t) { return t[0] === tab; })) tab = 'over';
    var c = counts(p.lines || []);
    var head = '<div class="fdv-top"><button type="button" class="fdv-back" data-dcback><i class="bi bi-chevron-left"></i> ' + esc(k('ui.doc-control', 'Document control')) + '</button>' +
      '<div class="fdv-title"><h2 data-noi18n>' + esc(p.name) + '</h2><small data-noi18n>' + esc([p.no, p.trade, p.who].filter(Boolean).join(' · ')) + '</small></div>' + (c.all ? '<b class="dc-pc">' + Math.round(c.done / c.all * 100) + ' %</b>' : '') + '</div>' +
      '<nav class="fdv-tabs" role="tablist">' + T.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (t[0] === tab) + '" data-dctab="' + t[0] + '"><i class="bi bi-' + t[2] + '"></i> ' + esc(t[1]) + '</button>'; }).join('') + '</nav>';
    var body = tab === 'over' ? over(p) : tab === 'docs' ? docs(p) : tab === 'files' ? files(p) : reportTab(p);
    return '<div class="fdv-page dc-page">' + head + '<div class="fdv-body">' + body + '</div></div>';
  }
  function bar(c) {
    var seg = [['ok', c.ok + c.na], ['cmt', c.cmt], ['recv', c.recv], ['rej', c.rej], ['missing', c.missing]].filter(function (s) { return s[1]; });
    return '<div class="dc-bar" role="img" aria-label="' + esc(seg.map(function (s) { return stName(s[0]) + ' ' + s[1]; }).join(', ')) + '">' + seg.map(function (s) { return '<i style="flex:' + s[1] + ';--c:' + st(s[0])[3] + '"></i>'; }).join('') + '</div>';
  }
  function byGroup(lines) {
    var g = {}; lines.forEach(function (l) { var d = String(l.code).charAt(0) || '–'; (g[d] = g[d] || []).push(l); });
    return Object.keys(g).sort().map(function (d) { return [d, g[d]]; });
  }
  function planBtns(p) {
    return '<div class="dc-facts"><button type="button" class="pill-btn" data-dcpick><i class="bi bi-ui-checks"></i> ' + esc((p.lines || []).length ? k('ui.dc-pick-more', 'Add from the checklist') : k('ui.dc-pick', 'Make the plan from the checklist')) + '</button><label class="pill-btn dc-file"><i class="bi bi-file-earmark-spreadsheet"></i> ' + esc((p.lines || []).length ? k('ui.dc-plan-again', 'Import the plan again') : k('ui.dc-plan-import', 'Import document plan')) +
      '<input type="file" accept=".xlsx,.xlsm,.csv,.txt" data-dcplan="' + esc(p.id) + '" hidden></label>' +
      '<label class="pill-btn dc-file"><i class="bi bi-upload"></i> ' + esc(k('ui.dc-files-import', 'Import delivered files')) + '<input type="file" multiple data-dcfiles="' + esc(p.id) + '" hidden></label></div>';
  }
  function over(p) {
    if (editing) return projForm(p);
    if (picking) return picker(p);
    var L = p.lines || [], c = counts(L), F = p.files || [], bad = F.filter(function (f) { return (f.iss || []).length; }).length, loose = F.filter(function (f) { return !f.line; }).length;
    var h = '';
    if (!L.length) h += '<p class="muted dc-help">' + esc(k('ui.dc-plan-help2', 'Got a document plan from the project? Import it (Excel – a column for the NS 3451 code and one for the NS 3456 document type or the planned name). No plan? Make it from the checklist: pick the project type and tick the systems the project has.')) + '</p>';
    else {
      h += '<div class="kit-tiles dc-tiles">' + [['all', k('ui.dc-documents', 'Documents'), c.all], ['missing', stName('missing'), c.missing], ['recv', k('ui.dc-to-check', 'To check'), c.recv], ['done', k('ui.dc-approved', 'Approved'), c.done], ['rej', k('ui.dc-not-approved', 'Not approved'), c.rej]].map(function (t) {
        return '<button type="button" class="kit-tile dc-tile" data-dcfilt="' + t[0] + '"><span>' + esc(t[1]) + '</span><b>' + nf.format(t[2]) + '</b></button>'; }).join('') + '</div>' + bar(c) +
        '<p class="dc-legend">' + ['ok', 'cmt', 'recv', 'rej', 'missing'].map(function (s) { return '<span><i style="--c:' + st(s)[3] + '"></i>' + esc(stName(s)) + '</span>'; }).join('') + '</p>';
      h += '<h3 class="fdv-h">' + esc(k('ui.dc-per-group', 'Per NS 3451 group')) + '</h3><div class="dc-groups">' + byGroup(L).map(function (g) {
        var cg = counts(g[1]); return '<button type="button" class="dc-grp" data-dcgrp="' + g[0] + '"><span class="dc-gn"><b>' + esc(g[0]) + '</b> ' + esc(grpName(g[0]) || '') + '</span><span class="dc-gc">' + cg.done + '/' + cg.all + (cg.missing ? ' · <em>' + esc(k('ui.dc-n-missing', '{n} missing', { n: cg.missing })) + '</em>' : '') + '</span>' + bar(cg) + '</button>';
      }).join('') + '</div>';
      var fire = L.filter(function (l) { return l.fire; }); if (fire.length) { var cf = counts(fire); h += '<p class="dc-note"><i class="bi bi-fire"></i> ' + esc(k('ui.dc-firebook', 'Fire book: {d} of {n} approved, {m} missing', { d: cf.done, n: cf.all, m: cf.missing })) + '</p>'; }
      var resp = {}; L.forEach(function (l) { if (l.resp) (resp[l.resp] = resp[l.resp] || []).push(l); });
      if (Object.keys(resp).length > 1) h += '<h3 class="fdv-h">' + esc(k('ui.dc-per-resp', 'Per contractor')) + '</h3><div class="dc-groups">' + Object.keys(resp).sort().map(function (r) { var cr = counts(resp[r]); return '<div class="dc-grp"><span class="dc-gn" data-noi18n>' + esc(r) + '</span><span class="dc-gc">' + cr.done + '/' + cr.all + (cr.missing ? ' · <em>' + esc(k('ui.dc-n-missing', '{n} missing', { n: cr.missing })) + '</em>' : '') + '</span>' + bar(cr) + '</div>'; }).join('') + '</div>';
      if (F.length) h += '<p class="dc-note"><i class="bi bi-files"></i> ' + esc(k('ui.dc-files-sum', '{n} files delivered · {u} not in the plan · {b} with name problems', { n: F.length, u: loose, b: bad })) + '</p>';
      if (p.planName) h += '<p class="muted dc-src">' + esc(k('ui.dc-plan-from', 'Plan: {f}, imported {d}', { f: p.planName, d: fmt(p.planAt) })) + '</p>';
    }
    h += planBtns(p);
    h += '<h3 class="fdv-h">' + esc(k('ui.dc-the-project', 'The project')) + '</h3><table class="fdv-kv">' + [[k('ui.dc-project-no', 'Project no.'), p.no], [k('ui.dc-contractor', 'Contractor'), p.who], [k('ui.dc-trade', 'Trade / delivery'), p.trade], [k('ui.dc-due', 'Deadline'), fmt(p.due)]].filter(function (r) { return r[1]; }).map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td data-noi18n>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>' +
      '<div class="fdv-acts"><button type="button" class="pill-btn" data-dcedit><i class="bi bi-pencil"></i> ' + esc(k('ui.edit', 'Edit')) + '</button><button type="button" class="text-btn dc-del" data-dcdel="' + esc(p.id) + '"><i class="bi bi-trash3"></i> ' + esc(k('ui.dc-delete', 'Delete project')) + '</button></div>';
    return h;
  }
  function matchesFilt(l) {
    if (filt === 'all') return true; if (filt === 'done') return l.st === 'ok' || l.st === 'cmt' || l.st === 'na';
    if (/^g\d$/.test(filt)) return String(l.code).charAt(0) === filt.slice(1);
    if (filt === 'fire') return !!l.fire;
    return l.st === filt;
  }
  function docs(p) {
    var L = p.lines || []; if (!L.length) return '<p class="muted dc-help">' + esc(k('ui.dc-no-plan-yet', 'No document plan yet – import it under Overview.')) + '</p>' + planBtns(p);
    var F = {}; (p.files || []).forEach(function (f) { F[f.id] = f; });
    var c = counts(L), chips = [['all', k('ui.all', 'All'), c.all], ['missing', stName('missing'), c.missing], ['recv', k('ui.dc-to-check', 'To check'), c.recv], ['cmt', k('ui.dc-comments', 'Comments'), c.cmt], ['rej', k('ui.dc-not-approved', 'Not approved'), c.rej], ['done', k('ui.dc-approved', 'Approved'), c.done]];
    if (L.some(function (l) { return l.fire; })) chips.push(['fire', k('ui.dc-fire', 'Fire book'), L.filter(function (l) { return l.fire; }).length]);
    if (/^g\d$/.test(filt)) chips.unshift([filt, filt.slice(1) + ' ' + (grpName(filt.slice(1)) || ''), L.filter(matchesFilt).length]);
    var ql = q.toLowerCase(), shown = L.filter(function (l) { return matchesFilt(l) && (!ql || (l.code + ' ' + l.sys + ' ' + l.type + ' ' + l.planned + ' ' + (l.cmt || '')).toLowerCase().indexOf(ql) >= 0); });
    var h = '<div class="dc-chips" role="tablist">' + chips.map(function (x) { return '<button type="button" class="dc-chip" aria-pressed="' + (x[0] === filt) + '" data-dcfilt="' + x[0] + '">' + esc(x[1]) + ' <b>' + x[2] + '</b></button>'; }).join('') + '</div>' +
      '<label class="dc-quick"><input type="checkbox" data-dcquick' + (quick ? ' checked' : '') + '> ' + esc(k('ui.dc-quick', 'Quick check – buttons on every line')) + '</label>' +
      '<input type="search" class="dc-q" data-dcq placeholder="' + esc(k('ui.dc-search', 'Search code, system or name')) + '" value="' + esc(q) + '">';
    if (!shown.length) return h + '<p class="muted dc-help">' + esc(k('ui.dc-none-here', 'Nothing here.')) + '</p>' + addLineForm(p);
    h += byGroup(shown).map(function (g) {
      return '<h3 class="fdv-h dc-gh">' + esc(g[0] + ' ' + (grpName(g[0]) || '')) + '</h3><ul class="dc-lines">' + g[1].map(function (l) {
        var fs = (l.files || []).map(function (id) { return F[id]; }).filter(Boolean), isOpen = openLine === l.id;
        var h2 = '<li class="dc-line' + (isOpen ? ' open' : '') + '"><button type="button" class="dc-lmain" data-dcline="' + esc(l.id) + '" aria-expanded="' + isOpen + '"><span class="dc-code">' + esc(l.code) + '</span>' +
          '<span class="dc-lx"><b data-noi18n>' + esc(lineTitle(l)) + (l.fire ? ' <i class="bi bi-fire dc-fi" title="' + esc(k('ui.dc-fire', 'Fire book')) + '"></i>' : '') + '</b><small data-noi18n>' + esc([typeLabel(l), l.planned && !l.ex ? l.planned : '', fs.length ? k('ui.dc-n-files', '{n} files', { n: fs.length }) : ''].filter(Boolean).join(' · ')) + '</small>' +
          (l.cmt && !isOpen ? '<small class="dc-cmt" data-noi18n>' + esc(l.cmt) + '</small>' : '') + '</span>' + chip(l.st) + '</button>';
        if (quick && !isOpen) h2 += '<div class="dc-qk">' + [['ok', 'check-lg', 'ui.dc-q-ok', 'Approved'], ['rej', 'x-lg', 'ui.dc-q-rej', 'Not approved'], ['na', 'dash-lg', 'ui.dc-q-na', 'Not relevant']].map(function (x) { return '<button type="button" class="dc-qb" style="--c:' + st(x[0])[3] + '" aria-pressed="' + (l.st === x[0]) + '" data-dcst="' + esc(l.id) + ':' + x[0] + '" data-dctoggle><i class="bi bi-' + x[1] + '"></i> ' + esc(k(x[2], x[3])) + '</button>'; }).join('') + '</div>';
        if (isOpen) {
          h2 += '<div class="dc-ledit">' + (l.note ? '<p class="muted dc-pnote" data-noi18n>' + esc(l.note) + '</p>' : '') + (l.planned ? '<p class="dc-pnote"><span class="muted">' + esc(l.ex ? k('ui.dc-example-name', 'Example name') : k('ui.dc-planned-name', 'Planned name')) + ':</span> <span data-noi18n>' + esc(l.planned) + '</span></p>' : '') +
            (l.hint ? '<p class="dc-hint"><span class="muted">' + esc(k('ui.dc-should-contain', 'Should contain')) + ':</span> <span data-noi18n>' + esc(l.hint).replace(/\n/g, '<br>') + '</span></p>' : '') + (l.opt ? '<p class="muted dc-pnote">' + esc(k('ui.dc-if-contract', 'Only if it is in the contract')) + '</p>' : '') +
            '<div class="dc-sts">' + ST.map(function (s) { return '<button type="button" class="dc-sb" style="--c:' + s[3] + '" aria-pressed="' + (l.st === s[0]) + '" data-dcst="' + esc(l.id) + ':' + s[0] + '"><i class="bi bi-' + s[4] + '"></i> ' + esc(k(s[1], s[2])) + '</button>'; }).join('') + '</div>' +
            '<textarea class="dc-ctext" data-dccmt="' + esc(l.id) + '" rows="2" maxlength="1000" placeholder="' + esc(k('ui.dc-comment-ph', 'Comment to the contractor, e.g. Missing the signed declaration')) + '">' + esc(l.cmt || '') + '</textarea>' +
            (fs.length ? '<ul class="dc-flist">' + fs.map(function (f) { return '<li>' + (f.nf ? '<span class="dc-nf"><i class="bi bi-list-ul"></i> <span data-noi18n>' + esc(f.name) + '</span></span>' : '<button type="button" class="text-btn" data-dcview="' + esc(f.id) + '"><i class="bi bi-file-earmark"></i> <span data-noi18n>' + esc(f.name) + '</span></button>') + ((f.iss || []).length ? '<i class="bi bi-exclamation-triangle dc-warn" title="' + esc(f.iss.map(function (x) { return issueText(x, f); }).join('; ')) + '"></i>' : '') + '<button type="button" class="icon-btn sm" data-dcunlink="' + esc(l.id) + ':' + esc(f.id) + '" aria-label="' + esc(k('ui.dc-unlink', 'Not this document')) + '"><i class="bi bi-x-lg"></i></button></li>'; }).join('') + '</ul>' : '') +
            (looseFiles(p).length ? '<select class="dc-link" data-dclink="' + esc(l.id) + '"><option value="">' + esc(k('ui.dc-link-file', 'Link a file that wasn’t matched …')) + '</option>' + looseFiles(p).map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.name) + '</option>'; }).join('') + '</select>' : '') +
            '<div class="dc-lrm"><button type="button" class="text-btn dc-del" data-dcldel="' + esc(l.id) + '"><i class="bi bi-trash3"></i> ' + esc(k('ui.dc-remove-line', 'Remove the line')) + '</button></div></div>';
        }
        return h2 + '</li>';
      }).join('') + '</ul>';
    }).join('');
    return h + addLineForm(p);
  }
  function addLineForm(p) {
    var o = [['', k('ui.dc-type-any', 'Document type …')]].concat(TYPES.map(function (t) { return [t[0], t[0] + ' ' + typeName(t[0])]; })).concat([['BC', 'B, C ' + typeName('B') + ', ' + typeName('C')]]);
    return '<form class="dc-addl" data-dcaddl="' + esc(p.id) + '"><h3 class="fdv-h">' + esc(k('ui.dc-add-line', 'Add a line')) + '</h3><div class="dc-addr"><input name="code" inputmode="decimal" maxlength="7" placeholder="' + esc(k('ui.dc-code', 'Code')) + '" required><select name="t">' + o.map(function (x) { return '<option value="' + x[0] + '">' + esc(x[1]) + '</option>'; }).join('') + '</select></div>' +
      '<input name="name" maxlength="160" placeholder="' + esc(k('ui.dc-add-line-ph', 'What it is, e.g. Samsvarserklæring membran')) + '"><button type="submit" class="text-btn"><i class="bi bi-plus-lg"></i> ' + esc(k('ui.add', 'Add')) + '</button></form>';
  }
  function looseFiles(p) { return (p.files || []).filter(function (f) { return !f.line; }); }
  function lineOf(p, id) { return (p.lines || []).filter(function (l) { return l.id === id; })[0]; }
  function files(p) {
    var F = (p.files || []).slice(), h = planBtns(p).replace('<label class="pill-btn dc-file"><i class="bi bi-file-earmark-spreadsheet"></i>', '<label class="pill-btn dc-file" hidden><i class="bi bi-file-earmark-spreadsheet"></i>').replace('data-dcpick>', 'data-dcpick hidden>');
    h = h.replace('</div>', '<label class="pill-btn dc-file"><i class="bi bi-list-ul"></i> ' + esc(k('ui.dc-names-import', 'Import a list of names')) + '<input type="file" accept=".xlsx,.xlsm,.csv,.txt" data-dcnames="' + esc(p.id) + '" hidden></label>' +
      '<button type="button" class="pill-btn" data-dcpastebtn><i class="bi bi-clipboard"></i> ' + esc(k('ui.dc-names-paste', 'Paste names')) + '</button></div>');
    if (pasting) h += '<form class="dc-paste" data-dcpaste="' + esc(p.id) + '"><textarea name="t" rows="6" placeholder="' + esc(k('ui.dc-names-ph', 'One document name per line, as in the FDV system – e.g. 332 SE Sprinkleranlegg')) + '"></textarea><div class="dc-facts"><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> ' + esc(k('ui.dc-names-add', 'Check the names')) + '</button><button type="button" class="text-btn" data-dcpastebtn>' + esc(k('ui.cancel', 'Cancel')) + '</button></div></form>';
    h += '<p class="muted dc-help">' + esc(k('ui.dc-names-help', 'Is the documentation in the FDV system (e.g. Plania)? Export or copy the list of documents there – the names are matched and checked the same way.')) + '</p>';
    h += '<p class="muted dc-help">' + esc(k('ui.dc-files-help', 'Pick the files, or one .zip with everything. Each file is matched to the plan by its name, and the name is checked: 3-digit NS 3451 code, a document code (DA, DV, SE …) and a describing text – drawings as building-floor-discipline-code-type-number.')) + '</p>';
    if (!F.length) return h;
    var rank = function (f) { return !f.line ? 0 : (f.iss || []).length ? 1 : 2; };
    F.sort(function (a, b) { return rank(a) - rank(b) || (a.name < b.name ? -1 : 1); });
    var u = F.filter(function (f) { return !f.line; }).length, bad = F.filter(function (f) { return (f.iss || []).length; }).length;
    h += '<p class="dc-note">' + esc(k('ui.dc-files-sum', '{n} files delivered · {u} not in the plan · {b} with name problems', { n: F.length, u: u, b: bad })) + '</p>';
    h += '<ul class="dc-files">' + F.map(function (f) {
      var l = f.line && lineOf(p, f.line);
      return '<li class="dc-frow' + (!f.line ? ' loose' : '') + '"><div class="dc-fh">' + (f.nf ? '<span class="dc-fn dc-nf"><i class="bi bi-list-ul"></i> <span data-noi18n>' + esc(f.name) + '</span></span><small class="muted">' + esc(k('ui.dc-in-fdv', 'In the FDV system')) + '</small>' : '<button type="button" class="text-btn dc-fn" data-dcview="' + esc(f.id) + '"><i class="bi bi-file-earmark"></i> <span data-noi18n>' + esc(f.name) + '</span></button><small class="muted">' + esc(size(f.size || 0)) + '</small>') +
        '<button type="button" class="icon-btn sm" data-dcfdel="' + esc(f.id) + '" aria-label="' + esc(k('ui.delete', 'Delete')) + '"><i class="bi bi-trash3"></i></button></div>' +
        ((f.iss || []).length ? '<ul class="dc-iss">' + f.iss.map(function (x) { return '<li class="' + x[0] + '"><i class="bi bi-' + (x[0] === 'err' ? 'x-octagon' : 'exclamation-triangle') + '"></i> ' + esc(issueText(x, f)) + '</li>'; }).join('') + '</ul>' : '') +
        (l ? '<p class="dc-to"><i class="bi bi-arrow-return-right"></i> <b>' + esc(l.code) + '</b> <span data-noi18n>' + esc(lineTitle(l)) + '</span> · ' + esc(typeLabel(l)) + '</p>' :
          '<select class="dc-link" data-dcflink="' + esc(f.id) + '"><option value="">' + esc(k('ui.dc-not-in-plan', 'Not in the plan – link it to a line …')) + '</option>' + linkOpts(p, f) + '</select>') + '</li>';
    }).join('') + '</ul>';
    return h;
  }
  function linkOpts(p, f) {
    var c3 = f.p && f.p.code ? f.p.code.slice(0, 3) : '', L = (p.lines || []).slice().sort(function (a, b) { var x = String(a.code).slice(0, 3) === c3 ? 0 : 1, y = String(b.code).slice(0, 3) === c3 ? 0 : 1; return x - y || (a.code < b.code ? -1 : 1); });
    return L.slice(0, 400).map(function (l) { return '<option value="' + esc(l.id) + '">' + esc(l.code + ' ' + lineTitle(l) + ' · ' + typeLabel(l)) + '</option>'; }).join('');
  }

  /* ---------- the report ---------- */
  function report(p) {
    var me = readJSON('dash.profile', {}) || {}, L = p.lines || [], c = counts(L), F = p.files || [];
    var row = function (l) { return '<tr><td>' + esc(l.code) + '</td><td>' + esc(lineTitle(l)) + '</td><td>' + esc(typeLabel(l)) + '</td><td>' + esc(l.planned && !l.ex ? l.planned : '') + '</td></tr>'; };
    var h = '<header class="rp-head"><div><p class="rp-kick">' + esc(k('ui.doc-control', 'Document control')) + (p.trade ? ' · ' + esc(p.trade) : '') + '</p><h1>' + esc(p.name) + '</h1></div></header>' +
      '<table class="rp-cvt">' + [[k('ui.dc-project-no', 'Project no.'), p.no], [k('ui.dc-contractor', 'Contractor'), p.who], [k('ui.dc-due', 'Deadline'), fmt(p.due)], [k('ui.date', 'Date'), fmt(today())], [k('ui.dc-checked-by', 'Checked by'), [me.name, me.role].filter(Boolean).join(', ')], [k('ui.dc-plan', 'Document plan'), p.planName]].filter(function (r) { return r[1]; }).map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>';
    h += '<h2>1 ' + esc(k('ui.dc-summary', 'Summary')) + '</h2><p>' + esc(k('ui.dc-summary-text', '{d} of {n} documents are approved or not relevant ({pc} %). Missing: {m}. Received, not yet checked: {r}. Not approved: {x}.', { d: c.done, n: c.all, pc: c.all ? Math.round(c.done / c.all * 100) : 0, m: c.missing, r: c.recv, x: c.rej })) + '</p>';
    var nc = function (v) { return '<td class="n">' + v + '</td>'; };
    h += '<table class="rp-grid dc-sumt"><thead><tr><th>NS 3451</th><th class="n">' + esc(k('ui.dc-documents', 'Documents')) + '</th><th class="n">' + esc(k('ui.dc-approved', 'Approved')) + '</th><th class="n">' + esc(stName('missing')) + '</th></tr></thead><tbody>' +
      byGroup(L).map(function (g) { var x = counts(g[1]); return '<tr><td>' + esc(g[0] + ' ' + (grpName(g[0]) || '')) + '</td>' + nc(x.all) + nc(x.done) + nc(x.missing) + '</tr>'; }).join('') +
      '<tr class="dc-tot"><td><b>' + esc(k('ui.total', 'Total')) + '</b></td>' + nc('<b>' + c.all + '</b>') + nc('<b>' + c.done + '</b>') + nc('<b>' + c.missing + '</b>') + '</tr></tbody></table>';
    var miss = L.filter(function (l) { return l.st === 'missing'; }), back = L.filter(function (l) { return l.st === 'rej' || l.st === 'cmt'; }), badF = F.filter(function (f) { return (f.iss || []).length; }), looseF = F.filter(function (f) { return !f.line; });
    var head4 = '<thead><tr><th>' + esc(k('ui.dc-code', 'Code')) + '</th><th>' + esc(k('ui.dc-system', 'System')) + '</th><th>' + esc(k('ui.dc-type', 'Document type')) + '</th><th>' + esc(k('ui.dc-planned-name', 'Planned name')) + '</th></tr></thead>';
    h += '<h2>2 ' + esc(k('ui.dc-missing-docs', 'Missing documents')) + '</h2>' + (miss.length ? '<table class="rp-grid dc-rt">' + head4 + '<tbody>' + miss.map(row).join('') + '</tbody></table>' : '<p>' + esc(k('ui.dc-none-missing', 'Nothing is missing.')) + '</p>');
    h += '<h2>3 ' + esc(k('ui.dc-with-comments', 'Not approved and comments')) + '</h2>' + (back.length ? '<table class="rp-grid dc-rt"><thead><tr><th>' + esc(k('ui.dc-code', 'Code')) + '</th><th>' + esc(k('ui.dc-system', 'System')) + '</th><th>' + esc(k('ui.status', 'Status')) + '</th><th>' + esc(k('ui.dc-comment', 'Comment')) + '</th></tr></thead><tbody>' +
      back.map(function (l) { return '<tr><td>' + esc(l.code) + '</td><td>' + esc(lineTitle(l) + ' · ' + typeLabel(l)) + '</td><td>' + esc(stName(l.st)) + '</td><td>' + esc(l.cmt || '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>' + esc(k('ui.dc-none-comments', 'No comments.')) + '</p>');
    h += '<h2>4 ' + esc(k('ui.dc-naming', 'File names')) + '</h2>' + (badF.length || looseF.length ? '<table class="rp-grid dc-rt"><thead><tr><th>' + esc(k('ui.dc-file', 'File')) + '</th><th>' + esc(k('ui.dc-problem', 'Problem')) + '</th></tr></thead><tbody>' +
      badF.concat(looseF.filter(function (f) { return !(f.iss || []).length; })).map(function (f) { return '<tr><td>' + esc(f.name) + '</td><td>' + esc((f.iss || []).map(function (x) { return issueText(x, f); }).concat(f.line ? [] : [k('ui.dc-not-in-plan-short', 'Not in the document plan')]).join('; ')) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>' + esc(k('ui.dc-names-ok', 'All file names follow the rules.')) + '</p>');
    return h;
  }
  function reportTab(p) {
    return '<div class="fdv-rbar"><span class="spacer"></span><button type="button" class="pill-btn" data-dcpdf="' + esc(p.id) + '"><i class="bi bi-file-earmark-pdf"></i> <span>' + esc(k('ui.fdv-make-pdf', 'Make PDF')) + '</span></button></div>' +
      '<p class="fdv-pdfnote muted" hidden></p><article class="rp-doc rp-inline">' + report(p) + '</article>';
  }

  function draw() {
    var el = document.getElementById('wkDocCtl'); if (!el) return;
    var ae = document.activeElement; if (ae && el.contains(ae) && ae.matches('textarea[data-dccmt], .dc-pform input, .dc-paste textarea, .dc-tsave input, .dc-addl input, [data-dcpq]')) return;   /* never redraw under the finger */
    var p = open && proj(open);
    if (open && !p && document.documentElement.classList.contains('unlocked')) open = null;
    document.body.classList.toggle('dc-full', !!p);
    el.innerHTML = p ? full(p) : list();
    if (window.I18N && I18N.apply) try { I18N.apply(el); } catch (e) {}
  }

  /* ---------- the requirements checklist and project types (JP 2026-11-14) ----------
     The checklist (e.g. Boligbygg's "Sjekkliste for leveranse av FDVU-dokumentasjon", Vedlegg 2) says which NS 3456 types each
     3-digit NS 3451 code needs, with examples. It is imported once and kept in your encrypted data (dash.tools.dcreq) – never in
     the code: it is the client's document, built on the standard. A project type is a set of codes to tick in one go: the
     built-in ones below (only NS 3451 code numbers), and your own (dash.tools.dctypes). */
  var PTYPES = [
    ['new', 'New building – everything', 'Nybygg – alt', '*'],
    ['bath', 'Bathroom renovation', 'Rehabilitering av bad', '242 244 246 253 255 256 274 291 312 314 315 316 322 324 362 364 411 412 433 442 453'],
    ['kitchen', 'Kitchen renovation', 'Rehabilitering av kjøkken', '242 246 255 256 273 312 314 315 362 364 411 433 442'],
    ['pods', 'Prefabricated bathrooms', 'Prefabrikkerte bad', '613 312 314 315 362 364 433 442 453'],
    ['inner', 'Interior refurbishment', 'Innvendig oppussing', '242 243 244 246 253 255 256 257 275 291 442'],
    ['floor', 'Floors', 'Gulv', '252 253 254 255'],
    ['facade', 'Facade renovation', 'Fasaderehabilitering', '231 232 233 234 235 236 237 238 239 265 284 287'],
    ['windows', 'Windows and doors', 'Vinduer og dører', '234 235 236 237 238 244'],
    ['roof', 'Roof', 'Tak', '261 262 263 264 265 266 267 268 269 413'],
    ['balcony', 'Balconies', 'Balkonger', '282 284 286 287 288'],
    ['stairs', 'Stairs and railings', 'Trapper og rekkverk', '281 282 283 287'],
    ['structure', 'Load-bearing structure', 'Bærende konstruksjoner', '221 222 223 224 225 226'],
    ['ground', 'Groundwork, foundations and drainage', 'Grunnarbeid, fundamenter og drenering', '211 212 213 214 215 216 217 218'],
    ['fixed', 'Fixed fittings', 'Fast inventar', '271 272 273 275 276 277'],
    ['fire', 'Fire safety upgrade', 'Brannsikring', '225 244 263 291 330 332 337 443 542 546'],
    ['sprinkler', 'Sprinkler', 'Sprinkler', '330 331 332 337 339 434'],
    ['firealarm', 'Fire alarm', 'Brannalarm', '511 515 542 546'],
    ['plumbing', 'Plumbing / pipe renewal', 'Sanitær / rørfornying', '310 311 312 314 315 316 319'],
    ['heating', 'Heating and heat pumps', 'Varme og varmepumper', '320 321 322 324 325 326 329 350 356 359 434 562 563'],
    ['vent', 'Ventilation', 'Ventilasjon', '360 361 362 364 365 366 369 434 562 563'],
    ['cooling', 'Cooling', 'Kjøling', '350 351 352 353 370 372 374 375 376'],
    ['gas', 'Gas and compressed air', 'Gass og trykkluft', '341 342 345 349'],
    ['el', 'Electrical installation', 'Elektroinstallasjon', '410 411 412 413 414 431 432 433 434 442 443 452 453'],
    ['light', 'Lighting and emergency lighting', 'Belysning og nødlys', '440 442 443 449 563'],
    ['ev', 'EV charging', 'Elbillading', '411 412 431 432 436'],
    ['solar', 'Solar panels', 'Solceller', '411 412 432 471'],
    ['reserve', 'Reserve power and UPS', 'Reservekraft og UPS', '461 462 463'],
    ['lift', 'Lifts', 'Heis', '620 621 625 434 546'],
    ['security', 'Access control and security', 'Adgangskontroll og sikring', '515 521 534 543 553'],
    ['tele', 'Telecom and data', 'Tele og data', '510 511 512 514 515 520 521 522 523 524 552'],
    ['bms', 'Building automation (BMS)', 'Byggautomasjon (SD-anlegg)', '560 562 563 564 565'],
    ['waste', 'Waste and central vacuum', 'Avfall og sentralstøvsuger', '651 652 653'],
    ['outdoor', 'Outdoor areas', 'Utomhus', '711 712 721 722 725 744 761 762 763 771 772 773'],
    ['outva', 'Outdoor pipes and connections', 'Utvendig VA og tilknytning', '712 714 726 727 731 733 783 784 785']
  ];
  function req() { var r = Fe.tools().dcreq; return r && r.codes ? r : null; }
  function ownTypes() { return Fe.list('dctypes'); }
  function allTypes() { var nbx = I18N.lang === 'nb'; return PTYPES.map(function (t) { return { id: t[0], name: nbx ? t[2] : t[1], codes: t[3] }; }).concat(ownTypes().map(function (t) { return { id: t.id, name: t.name, codes: (t.codes || []).join(' '), own: true }; })); }
  /* codes to pick from: the checklist's, else your own NS 3451 list, else the codes the project types use */
  function pickCodes() {
    var r = req(), out = {};
    if (r) { Object.keys(r.codes).forEach(function (c) { out[c] = { n: r.codes[c].n, t: r.codes[c].t || '' }; }); return out; }
    var own = LP && LP.ownMap ? LP.ownMap() : {}; Object.keys(own).forEach(function (c) { if (/^\d{3}$/.test(c)) out[c] = { n: own[c], t: '' }; });
    PTYPES.forEach(function (t) { if (t[3] !== '*') t[3].split(' ').forEach(function (c) { if (!out[c]) out[c] = { n: codeName(c) || '', t: '' }; }); });
    return out;
  }
  function parseReq(sheets) {
    var codes = {};
    sheets.forEach(function (sh) {
      var rows = sh.rows, hi = -1, L = {}, exCol = -1, mustCol = -1, maybeCol = -1;
      for (var i = 0; i < Math.min(rows.length, 15) && hi < 0; i++) {
        var m = {}; (rows[i] || []).forEach(function (c, j) { var x = String(c || '').trim().match(/^([A-L])\s*[-–]\s*\S/); if (x && !(x[1] in m)) m[x[1]] = j; });
        if (Object.keys(m).length >= 5) { hi = i; L = m; }
        (rows[i] || []).forEach(function (c, j) { c = String(c || ''); if (/eksempl/i.test(c)) exCol = j; if (/^\s*skal leveres\s*$/i.test(c)) mustCol = j; if (/kontraktsfest/i.test(c)) maybeCol = j; });
        if (hi < 0 && (mustCol >= 0 || maybeCol >= 0)) hi = i;
      }
      if (hi < 0) return;
      var first = Object.keys(L).length ? Math.min.apply(null, Object.keys(L).map(function (k) { return L[k]; })) : 99;
      for (var r = hi + 1; r < rows.length; r++) {
        var row = rows[r] || [], cj = -1;
        for (var j = 0; j < Math.min(first, row.length); j++) if (/^\d{3}$/.test(String(row[j] || '').trim())) cj = j;
        if (cj < 0) continue;
        var code = String(row[cj]).trim(), name = '';
        for (var q = cj + 1; q < Math.min(first, row.length + 1); q++) { var v = String(row[q] || '').trim(); if (v && !/^\d+$/.test(v)) { name = v; break; } }
        if (!name || /skal ikke benyttes/i.test(name)) continue;
        var t = Object.keys(L).sort().filter(function (k) { return String(row[L[k]] || '').trim(); }).join('');
        var ex = {}, txt = exCol >= 0 ? String(row[exCol] || '') : '';
        txt.split(/•\s*(?=[A-L]\s*:)/).forEach(function (part) { var mm = part.match(/^([A-L])\s*:\s*([\s\S]*)$/); if (mm && t.indexOf(mm[1]) >= 0) ex[mm[1]] = mm[2].replace(/\s+/g, ' ').trim().slice(0, 400); });
        var opt = mustCol >= 0 && !String(row[mustCol] || '').trim() && maybeCol >= 0 && String(row[maybeCol] || '').trim() ? 1 : undefined;
        if (!Object.keys(L).length && mustCol >= 0 && !String(row[mustCol] || '').trim() && !(maybeCol >= 0 && String(row[maybeCol] || '').trim())) continue;   /* the general sheet: only what should be delivered */
        codes[code] = { n: name.slice(0, 120), t: t, ex: Object.keys(ex).length ? ex : undefined, opt: opt };
      }
    });
    return codes;
  }
  function importReq(file) {
    (/\.xls[xm]$/i.test(file.name) ? file.arrayBuffer().then(readBook) : file.text().then(readCsv)).then(function (sh) {
      var c = parseReq(sh), n = Object.keys(c).length;
      if (!n) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-req-none', 'No codes found – the checklist needs a column with the 3-digit code and columns “A - …” to “L - …” for the document types.'))); return; }
      var t = Fe.tools(); t.dcreq = { name: file.name.slice(0, 120), at: today(), codes: c }; Fe.saveTools(t);
      toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dc-req-read', 'Checklist saved: {n} codes', { n: n }))); draw();
    }).catch(function () { toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.dc-plan-bad', 'The file could not be read – use .xlsx or .csv.'))); });
  }
  /* the lines for the ticked codes: one per document type, Drift and Vedlikehold together (as in the document plans) */
  function linesFor(codesList) {
    var r = req(), out = [];
    codesList.slice().sort().forEach(function (c) {
      var q = r && r.codes[c], t = q ? q.t || '' : '', groups = [];
      if (!t) groups = [''];
      else { var bc = t.replace(/[^BC]/g, ''); t.split('').forEach(function (x) { if (x === 'B' || x === 'C') { if (groups.indexOf(bc) < 0) groups.push(bc); } else groups.push(x); }); }
      groups.forEach(function (g) {
        out.push({ id: uid() + out.length, code: c, sys: (q && q.n || codeName(c) || '').slice(0, 160), type: g ? g.split('').map(function (x) { return TYPES.filter(function (y) { return y[0] === x; })[0][1]; }).join(', ') : '', t: g,
          hint: q && q.ex ? g.split('').map(function (x) { return q.ex[x] ? x + ': ' + q.ex[x] : ''; }).filter(Boolean).join('\n').slice(0, 800) || undefined : undefined, opt: q && q.opt, planned: '', note: '', st: 'missing', files: [] });
      });
    });
    return out;
  }
  var ticks = {};
  function picker(p) {
    var r = req(), C = pickCodes(), keys = Object.keys(C).sort(), nbx = I18N.lang === 'nb';
    var h = '<div class="dc-pick">';
    h += r ? '<p class="muted dc-help">' + esc(k('ui.dc-req-from', 'Checklist: {f} ({n} codes)', { f: r.name, n: keys.length })) + ' · <label class="text-btn dc-file">' + esc(k('ui.dc-req-replace', 'Replace')) + '<input type="file" accept=".xlsx,.xlsm,.csv" data-dcreq hidden></label></p>'
      : '<p class="muted dc-help">' + esc(k('ui.dc-req-help', 'Import the client’s checklist once (e.g. Boligbygg’s Vedlegg 2 – which NS 3456 document types each NS 3451 code needs). Without it you get one line per code, without the types.')) + '</p><div class="dc-facts"><label class="pill-btn dc-file"><i class="bi bi-file-earmark-spreadsheet"></i> ' + esc(k('ui.dc-req-import', 'Import checklist')) + '<input type="file" accept=".xlsx,.xlsm,.csv" data-dcreq hidden></label></div>';
    h += '<h3 class="fdv-h">' + esc(k('ui.dc-ptype', 'Project type')) + '</h3><div class="dc-chips dc-wrap">' + allTypes().map(function (t) { return '<button type="button" class="dc-chip" data-dcptype="' + esc(t.id) + '">' + esc(t.name) + (t.own ? ' <i class="bi bi-person"></i>' : '') + '</button>'; }).join('') + '</div>';
    h += '<p class="muted dc-help">' + esc(k('ui.dc-ptype-help', 'A type ticks its systems – then tick more or untick what the project doesn’t have.')) + '</p>';
    h += '<input type="search" class="dc-q" data-dcpq placeholder="' + esc(k('ui.dc-search-codes', 'Search code or system')) + '">';
    var groups = {}; keys.forEach(function (c) { (groups[c.slice(0, 2)] = groups[c.slice(0, 2)] || []).push(c); });
    var lastMain = '';
    Object.keys(groups).sort().forEach(function (g) {
      if (g[0] !== lastMain) { lastMain = g[0]; h += '<h3 class="fdv-h dc-gh">' + esc(g[0] + ' ' + (grpName(g[0]) || '')) + '</h3>'; }
      var n = groups[g].filter(function (c) { return ticks[c]; }).length;
      h += '<details class="dc-pg"' + (n ? ' open' : '') + '><summary><b>' + esc(g) + '</b> ' + esc(grpName(g) || '') + ' <span class="dc-pn" data-dcpn="' + g + '">' + (n ? n : '') + '</span></summary><ul>' + groups[g].map(function (c) {
        return '<li data-dcpc="' + c + '"><label><input type="checkbox" data-dctick="' + c + '"' + (ticks[c] ? ' checked' : '') + '><span><b>' + c + '</b> <span data-noi18n>' + esc(C[c].n) + '</span>' + (C[c].t ? ' <small class="dc-lt">' + esc(C[c].t.split('').join(' ')) + '</small>' : '') + '</span></label></li>';
      }).join('') + '</ul></details>';
    });
    h += '<div class="dc-pbar"><span data-dcpcount>' + pickCount() + '</span><button type="button" class="pill-btn" data-dcmake><i class="bi bi-check2"></i> ' + esc(k('ui.dc-make', 'Make the plan')) + '</button><button type="button" class="text-btn" data-dccancel>' + esc(k('ui.cancel', 'Cancel')) + '</button></div>';
    h += '<form class="dc-tsave" data-dctsave><input name="n" maxlength="60" placeholder="' + esc(k('ui.dc-type-name', 'Save the ticks as a type, e.g. Bathroom, small')) + '"><button type="submit" class="text-btn"><i class="bi bi-bookmark-plus"></i> ' + esc(k('ui.save', 'Save')) + '</button></form>';
    if (ownTypes().length) h += '<p class="muted dc-help">' + ownTypes().map(function (t) { return '<button type="button" class="text-btn" data-dctdel="' + esc(t.id) + '"><i class="bi bi-x"></i> ' + esc(t.name) + '</button>'; }).join(' ') + '</p>';
    return h + '</div>';
  }
  function pickCount() {
    var cs = Object.keys(ticks).filter(function (c) { return ticks[c]; }), n = linesFor(cs).length;
    return esc(k('ui.dc-pick-count', '{c} systems · {n} documents', { c: cs.length, n: n }));
  }
  function updPick() {
    var el = document.querySelector('[data-dcpcount]'); if (el) el.innerHTML = pickCount();
    document.querySelectorAll('[data-dcpn]').forEach(function (s) { var g = s.dataset.dcpn, n = Object.keys(ticks).filter(function (c) { return ticks[c] && c.slice(0, 2) === g; }).length; s.textContent = n || ''; });
  }

  /* ---------- importing ---------- */
  function importPlan(id, file) {
    var isX = /\.xls[xm]$/i.test(file.name);
    (isX ? file.arrayBuffer().then(readBook) : file.text().then(readCsv)).then(function (sheets) {
      var res = parsePlan(sheets);
      if (!res.lines.length) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-plan-none', 'No document lines found – the plan needs a column for the system code and one for the document type or the planned name.'))); return; }
      var kept = 0;
      saveP(id, function (p) {
        var old = {}; (p.lines || []).forEach(function (l) { old[l.code + '|' + l.t + '|' + l.planned + '|' + l.type] = l; });
        res.lines.forEach(function (l) { var o = old[l.code + '|' + l.t + '|' + l.planned + '|' + l.type]; if (o) { kept++; l.id = o.id; l.st = o.st; l.cmt = o.cmt; l.files = o.files || []; } });
        var ids = {}; res.lines.forEach(function (l) { ids[l.id] = 1; });
        (p.files || []).forEach(function (f) { if (f.line && !ids[f.line]) f.line = ''; });
        p.lines = res.lines; p.planName = file.name.slice(0, 120); p.planAt = today();
        rematch(p);
      });
      toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dc-plan-read', '{n} documents in the plan', { n: res.lines.length })) + (kept ? ' · ' + esc(k('ui.dc-plan-kept', '{n} kept their status', { n: kept })) : ''));
      draw();
    }).catch(function (e) { toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.dc-plan-bad', 'The file could not be read – use .xlsx or .csv.'))); try { console.warn('[dc] plan', e); } catch (e2) {} });
  }
  /* files with no line are matched again (after a new plan); a file you linked by hand stays */
  function rematch(p) {
    (p.files || []).forEach(function (f) {
      if (f.line) return; var l = bestLine(p, f.p || parseName(f.name)); if (!l) return;
      f.line = l.id; l.files = (l.files || []).concat([f.id]); if (l.st === 'missing') l.st = 'recv';
    });
  }
  var OKX = /\.(pdf|jpe?g|png|heic|heif|webp|gif|docx?|xlsx?|xlsm|odt|ods|txt|rtf|dwg|dxf|ifc|csv|msg|eml|mp4|mov|zip)$/i;
  function mime(n) { n = n.toLowerCase(); return /\.pdf$/.test(n) ? 'application/pdf' : /\.jpe?g$/.test(n) ? 'image/jpeg' : /\.png$/.test(n) ? 'image/png' : 'application/octet-stream'; }
  function importFiles(id, list, names) {
    var got = (names || []).map(function (n) { return { name: n, size: 0, blob: null, nf: true }; });
    list.reduce(function (pr, f) {
      return pr.then(function () {
        if (/\.zip$/i.test(f.name)) return f.arrayBuffer().then(function (buf) {
          var Z = zipEntries(buf).filter(function (z) { return !/\/$/.test(z.name) && !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)/i.test(z.name) && !/(^|\/)\._/.test(z.name); });
          return Z.reduce(function (p2, z) { return p2.then(function () { var nm = z.name.split('/').pop(); if (!OKX.test(nm) || /\.zip$/i.test(nm)) return; return inflate(z).then(function (u) { got.push({ name: nm, path: z.name.split('/').slice(0, -1).join('/'), size: z.size, blob: new Blob([u], { type: mime(nm) }) }); }).catch(function () { got.push({ name: nm, size: z.size, blob: null }); }); }); }, Promise.resolve());
        });
        if (OKX.test(f.name)) got.push({ name: f.name, path: (f.webkitRelativePath || '').split('/').slice(0, -1).join('/'), size: f.size, blob: f });
      });
    }, Promise.resolve()).then(function () {
      var p0 = proj(id); if (!p0) return;
      var have = {}; (p0.files || []).forEach(function (f) { have[f.name.toLowerCase() + '|' + (f.nf ? 0 : f.size)] = 1; });
      var add = got.filter(function (g) { var key = g.name.toLowerCase() + '|' + g.size; if (have[key]) return false; have[key] = 1; return true; }).map(function (g) { var pn = parseName(g.name); return { id: uid() + Math.random().toString(36).slice(2, 4), name: g.name.slice(0, 160), path: (g.path || '').slice(0, 160), size: g.size, at: today(), p: { code: pn.code, abbr: pn.abbr, text: pn.text.slice(0, 80), stem: pn.stem.slice(0, 120), kind: pn.kind }, iss: pn.issues, blob: g.blob, nf: g.nf || undefined }; });
      return add.reduce(function (pr, f) { return pr.then(function () { if (f.blob) return putBlob(f.id, f.blob); }); }, Promise.resolve()).then(function () {
        var matched = 0;
        saveP(id, function (p) {
          p.files = (p.files || []).concat(add.map(function (f) { var o = Object.assign({}, f); delete o.blob; return o; }));
          add.forEach(function (f) { var x = p.files.filter(function (y) { return y.id === f.id; })[0], l = (p.lines || []).length && bestLine(p, x.p); if (l) { x.line = l.id; l.files = (l.files || []).concat([x.id]); if (l.st === 'missing') l.st = 'recv'; matched++; } });
        });
        toast('<i class="bi bi-check2"></i> ' + esc(names && !list.length ? k('ui.dc-names-read', '{n} new names · {m} matched to the plan', { n: add.length, m: matched }) : k('ui.dc-files-read', '{n} new files · {m} matched to the plan', { n: add.length, m: matched })) + (got.length > add.length ? ' · ' + esc(k('ui.dc-files-dupe', '{n} already there', { n: got.length - add.length })) : ''));
        setTab('files'); draw();
      });
    }).catch(function (e) { toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.dc-files-bad', 'Some files could not be read.'))); try { console.warn('[dc] files', e); } catch (e2) {} });
  }
  /* document names from the FDV system (Plania etc.): pasted text or an export (Excel/CSV) – every cell that looks like a document name */
  function looksLikeName(c) { c = String(c || '').trim(); return c.length >= 4 && c.length <= 200 && (/^\d{3}(?:[.,]\d{1,3})?[\s_-]+\S/.test(c) || /^\d{3,6}-[A-Z0-9]{3}-[A-Z]-\d{3}-/.test(c) || /\.(pdf|docx?|xlsx?|dwg|dxf|ifc|jpe?g|png)$/i.test(c)); }
  function namesFrom(sheets) { var out = [], seen = {}; sheets.forEach(function (sh) { sh.rows.forEach(function (r) { r.forEach(function (c) { c = String(c || '').trim(); if (looksLikeName(c) && !seen[c.toLowerCase()]) { seen[c.toLowerCase()] = 1; out.push(c); } }); }); }); return out; }
  function namesText(t) { return namesFrom([{ rows: String(t || '').split(/\r?\n/).map(function (l) { l = l.replace(/^[\s\-*•·\d]+[.)]\s+(?=\d{3})/, '').trim(); return l.indexOf('\t') >= 0 ? l.split('\t') : [l]; }) }]); }
  function importNames(id, file) {
    (/\.xls[xm]$/i.test(file.name) ? file.arrayBuffer().then(readBook) : file.text().then(function (t) { return t.indexOf(';') >= 0 || t.indexOf('\t') >= 0 ? readCsv(t) : [{ rows: t.split(/\r?\n/).map(function (l) { return [l]; }) }]; })).then(function (sh) {
      var n = namesFrom(sh); if (!n.length) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-names-none', 'No document names found – a name starts with the 3-digit code, like “332 SE Sprinkler”.'))); return; }
      importFiles(id, [], n);
    }).catch(function () { toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.dc-plan-bad', 'The file could not be read – use .xlsx or .csv.'))); });
  }
  function link(p, lineId, fileId) {
    var f = (p.files || []).filter(function (x) { return x.id === fileId; })[0], l = lineOf(p, lineId); if (!f || !l) return;
    if (f.line) { var o = lineOf(p, f.line); if (o) o.files = (o.files || []).filter(function (x) { return x !== fileId; }); }
    f.line = l.id; f.hand = true; l.files = (l.files || []).filter(function (x) { return x !== fileId; }).concat([fileId]); if (l.st === 'missing') l.st = 'recv';
  }
  function unlink(p, lineId, fileId) {
    var l = lineOf(p, lineId), f = (p.files || []).filter(function (x) { return x.id === fileId; })[0];
    if (l) { l.files = (l.files || []).filter(function (x) { return x !== fileId; }); if (!l.files.length && l.st === 'recv') l.st = 'missing'; }
    if (f) { f.line = ''; f.hand = true; }
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var b, t = e.target; if (!t.closest || !t.closest('#wkDocCtl')) return;
    if (t.closest('[data-dcnew]')) { adding = true; draw(); var i = document.querySelector('.dc-pform input'); if (i) i.focus(); return; }
    if (t.closest('[data-dccancel]')) { adding = false; editing = false; picking = false; draw(); return; }
    if (t.closest('[data-dcpick]')) { picking = true; ticks = {}; setTab('over'); draw(); window.scrollTo(0, 0); return; }
    if ((b = t.closest('[data-dcptype]'))) { var ty = allTypes().filter(function (x) { return x.id === b.dataset.dcptype; })[0]; if (!ty) return; var CC = pickCodes();
      (ty.codes === '*' ? Object.keys(CC).filter(function (c) { return CC[c].t || !req(); }) : ty.codes.split(' ')).forEach(function (c) { if (CC[c]) ticks[c] = true; }); var y = window.scrollY; draw(); window.scrollTo(0, y); return; }
    if (t.closest('[data-dcmake]')) {
      var cs = Object.keys(ticks).filter(function (c) { return ticks[c]; }); if (!cs.length) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-tick-first', 'Tick the systems first – or tap a project type.'))); return; }
      var added = 0; saveP(open, function (p) { var have = {}; (p.lines || []).forEach(function (l) { have[l.code + '|' + l.t] = 1; }); var nl = linesFor(cs).filter(function (l) { return !have[l.code + '|' + l.t]; }); added = nl.length; p.lines = (p.lines || []).concat(nl); if (!p.planName) { p.planName = k('ui.dc-from-checklist', 'From the checklist'); p.planAt = today(); } rematch(p); });
      picking = false; ticks = {}; toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dc-plan-read', '{n} documents in the plan', { n: added }))); setTab('docs'); filt = 'all'; draw(); window.scrollTo(0, 0); return;
    }
    if ((b = t.closest('[data-dctdel]'))) { var tid = b.dataset.dctdel, tt = Fe.tools(), old = JSON.parse(JSON.stringify(tt.dctypes || [])); tt.dctypes = (tt.dctypes || []).filter(function (x) { return x.id !== tid; }); Fe.saveTools(tt); draw(); toast('<i class="bi bi-trash3"></i> ' + esc(k('ui.dc-type-removed', 'Project type removed')), function () { var t5 = Fe.tools(); t5.dctypes = old; Fe.saveTools(t5); draw(); }); return; }
    if ((b = t.closest('[data-dcldel]'))) { var lid = b.dataset.dcldel, keep2 = JSON.parse(JSON.stringify(proj(open))); saveP(open, function (p) { var l = lineOf(p, lid); (l && l.files || []).forEach(function (fid) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (f) f.line = ''; }); p.lines = (p.lines || []).filter(function (x) { return x.id !== lid; }); }); openLine = null; draw();
      toast('<i class="bi bi-trash3"></i> ' + esc(k('ui.dc-line-removed', 'Line removed')), function () { var t6 = Fe.tools(); t6.dctl = (t6.dctl || []).map(function (x) { return x.id === keep2.id ? keep2 : x; }); Fe.saveTools(t6); draw(); }); return; }
    if ((b = t.closest('[data-dcopen]'))) { go(b.dataset.dcopen); return; }
    if (t.closest('[data-dcback]')) { back(); return; }
    if ((b = t.closest('[data-dctab]'))) { setTab(b.dataset.dctab); openLine = null; editing = false; draw(); return; }
    if (t.closest('[data-dcedit]')) { editing = true; draw(); return; }
    if ((b = t.closest('[data-dcfilt]'))) { filt = b.dataset.dcfilt; if (tab !== 'docs') setTab('docs'); openLine = null; draw(); return; }
    if ((b = t.closest('[data-dcgrp]'))) { filt = 'g' + b.dataset.dcgrp; setTab('docs'); openLine = null; draw(); return; }
    if ((b = t.closest('[data-dcline]'))) { openLine = openLine === b.dataset.dcline ? null : b.dataset.dcline; draw(); return; }
    if ((b = t.closest('[data-dcst]'))) { var s = b.dataset.dcst.split(':'), tg = b.hasAttribute('data-dctoggle'); saveP(open, function (p) { var l = lineOf(p, s[0]); if (l) l.st = tg && l.st === s[1] ? ((l.files || []).length ? 'recv' : 'missing') : s[1]; }); draw(); return; }   /* a quick button tapped again undoes it */
    if (t.closest('[data-dcpastebtn]')) { pasting = !pasting; draw(); var ta = document.querySelector('.dc-paste textarea'); if (ta) ta.focus(); return; }
    if ((b = t.closest('[data-dcunlink]'))) { var u = b.dataset.dcunlink.split(':'); saveP(open, function (p) { unlink(p, u[0], u[1]); }); draw(); return; }
    if ((b = t.closest('[data-dcview]'))) { var fid = b.dataset.dcview, w = null; try { w = window.open('', '_blank'); } catch (e2) {}
      getBlob(fid).then(function (bl) { if (!bl) { if (w) w.close(); toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-file-elsewhere', 'The file is on the device it was imported on.'))); return; } var url = URL.createObjectURL(bl); if (w) w.location = url; else location.href = url; setTimeout(function () { URL.revokeObjectURL(url); }, 60000); }); return; }
    if ((b = t.closest('[data-dcfdel]'))) {
      var id = b.dataset.dcfdel, pr = proj(open), keep = JSON.parse(JSON.stringify(pr));
      saveP(open, function (p) { var f = (p.files || []).filter(function (x) { return x.id === id; })[0]; if (f && f.line) unlink(p, f.line, id); p.files = (p.files || []).filter(function (x) { return x.id !== id; }); });
      draw(); toast('<i class="bi bi-trash3"></i> ' + esc(k('ui.dc-file-removed', 'File removed')), function () { var t2 = Fe.tools(); t2.dctl = (t2.dctl || []).map(function (x) { return x.id === keep.id ? keep : x; }); Fe.saveTools(t2); draw(); });
      setTimeout(function () { var p = proj(open); if (!p || !(p.files || []).some(function (x) { return x.id === id; })) delBlob(id); }, 9000); return;
    }
    if ((b = t.closest('[data-dcdel]'))) {
      var pid = b.dataset.dcdel, all = JSON.parse(JSON.stringify(Fe.tools().dctl || [])), gone = proj(pid);
      var t3 = Fe.tools(); t3.dctl = (t3.dctl || []).filter(function (x) { return x.id !== pid; }); Fe.saveTools(t3); back();
      toast('<i class="bi bi-trash3"></i> ' + esc(k('ui.dc-deleted', 'Project deleted')), function () { var t4 = Fe.tools(); t4.dctl = all; Fe.saveTools(t4); draw(); });
      setTimeout(function () { if (!proj(pid) && gone) (gone.files || []).forEach(function (f) { delBlob(f.id); }); }, 9000); return;
    }
    if ((b = t.closest('[data-dcpdf]'))) {
      if (b._pdf) { window.FdvPdf.share(b._pdf); return; }
      var p2 = proj(b.dataset.dcpdf); if (!p2 || b.disabled || !window.FdvPdf || !window.FdvPdf.html) return;
      var note = document.querySelector('#wkDocCtl .fdv-pdfnote'), lbl = b.querySelector('span'), me = readJSON('dash.profile', {}) || {};
      b.disabled = true; lbl.textContent = k('ui.fdv-making-pdf', 'Making the PDF …');
      var foot = [[me.name, me.role].filter(Boolean).join(', '), me.employer, k('ui.doc-control', 'Document control'), p2.no, p2.name].filter(Boolean).join('  ·  ');
      var nm = ([p2.no, k('ui.doc-control', 'Document control'), p2.name].filter(Boolean).join(' ')).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() + '.pdf';
      window.FdvPdf.html(report(p2), foot, nm).then(function (file) {
        b.disabled = false; b._pdf = file; lbl.textContent = k('ui.fdv-share-pdf', 'Share or save the PDF'); b.querySelector('i').className = 'bi bi-box-arrow-up';
        if (note) { note.hidden = false; note.textContent = k('ui.fdv-pdf-ready', 'Ready: {f} ({n} pages). Tap the button to share it, save it to Files or mail it.', { f: file.name, n: file._pages }); }
        if (!(navigator.canShare && navigator.canShare({ files: [file] }))) window.FdvPdf.share(file);
      }).catch(function (err) { b.disabled = false; lbl.textContent = k('ui.fdv-make-pdf', 'Make PDF'); toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.fdv-pdf-failed', 'The PDF could not be made – check the connection the first time (the PDF tool is fetched once).'))); try { console.warn('[dc] pdf', err); } catch (e3) {} });
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.closest || !t.closest('#wkDocCtl')) return;
    if (t.dataset.dcplan && t.files && t.files[0]) { importPlan(t.dataset.dcplan, t.files[0]); t.value = ''; return; }
    if (t.dataset.dcfiles && t.files && t.files.length) { importFiles(t.dataset.dcfiles, [].slice.call(t.files)); t.value = ''; return; }
    if (t.matches('[data-dcreq]') && t.files && t.files[0]) { importReq(t.files[0]); t.value = ''; return; }
    if (t.dataset.dctick) { ticks[t.dataset.dctick] = t.checked; updPick(); return; }
    if (t.dataset.dcnames && t.files && t.files[0]) { importNames(t.dataset.dcnames, t.files[0]); t.value = ''; return; }
    if (t.matches('[data-dcquick]')) { quick = t.checked; try { sessionStorage.setItem('dash.dcQuick', quick ? '1' : ''); } catch (e) {} openLine = null; draw(); return; }
    if (t.dataset.dclink && t.value) { var a = t.dataset.dclink, v = t.value; saveP(open, function (p) { link(p, a, v); }); draw(); return; }
    if (t.dataset.dcflink && t.value) { var f = t.dataset.dcflink, l = t.value; saveP(open, function (p) { link(p, l, f); }); draw(); return; }
  });
  document.addEventListener('input', function (e) { var t = e.target;
    if (t.matches && t.matches('[data-dcpq]')) { var qq = t.value.toLowerCase().trim(); document.querySelectorAll('.dc-pg').forEach(function (d) { var any = false; d.querySelectorAll('li[data-dcpc]').forEach(function (li) { var on = !qq || li.textContent.toLowerCase().indexOf(qq) >= 0; li.hidden = !on; any = any || on; }); d.hidden = !any; if (qq && any) d.open = true; }); return; }
    if (t.matches && t.matches('[data-dcq]')) { q = t.value; clearTimeout(t._t); t._t = setTimeout(function () { draw(); var i = document.querySelector('[data-dcq]'); if (i) { i.focus(); i.setSelectionRange(q.length, q.length); } }, 250); } });
  document.addEventListener('focusout', function (e) {
    var t = e.target; if (!t.matches || !t.matches('textarea[data-dccmt]')) return;
    var id = t.dataset.dccmt, v = t.value.trim().slice(0, 1000);
    saveP(open, function (p) { var l = lineOf(p, id); if (l) { l.cmt = v; if (v && l.st === 'ok') l.st = 'cmt'; } }); setTimeout(draw, 300);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f.matches) return;
    if (f.matches('form[data-dcpaste]')) { e.preventDefault(); var nn = namesText(f.t.value); if (!nn.length) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-names-none', 'No document names found – a name starts with the 3-digit code, like “332 SE Sprinkler”.'))); return; } pasting = false; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); importFiles(f.dataset.dcpaste, [], nn); return; }
    if (f.matches('form[data-dctsave]')) { e.preventDefault(); var tn = f.n.value.trim().slice(0, 60), cs = Object.keys(ticks).filter(function (c) { return ticks[c]; }); if (!tn || !cs.length) return; var t7 = Fe.tools(); t7.dctypes = (t7.dctypes || []).concat([{ id: uid(), name: tn, codes: cs.sort() }]); Fe.saveTools(t7); toast('<i class="bi bi-bookmark-check"></i> ' + esc(k('ui.dc-type-saved', 'Saved as a project type'))); f.n.blur(); draw(); return; }
    if (f.matches('form[data-dcaddl]')) { e.preventDefault(); var code = normCode(f.code.value), tl = f.t.value, nm = f.name.value.trim().slice(0, 160); if (!code) return;
      saveP(f.dataset.dcaddl, function (p) { var q = req() && req().codes[code.slice(0, 3)]; p.lines = (p.lines || []).concat([{ id: uid(), code: code, sys: nm || (q && q.n) || codeName(code) || '', type: tl ? tl.split('').map(function (x) { return TYPES.filter(function (y) { return y[0] === x; })[0][1]; }).join(', ') : '', t: tl, hint: q && q.ex && tl ? tl.split('').map(function (x) { return q.ex[x] ? x + ': ' + q.ex[x] : ''; }).filter(Boolean).join('\n') || undefined : undefined, planned: '', note: '', st: 'missing', files: [], hand: 1 }]); rematch(p); });
      f.reset(); document.activeElement && document.activeElement.blur && document.activeElement.blur(); draw(); return; }
    if (!f.matches('form[data-dcpform]')) return; e.preventDefault();
    var v = { name: f.name.value.trim().slice(0, 120), no: f.no.value.trim().slice(0, 40), who: f.who.value.trim().slice(0, 120), trade: f.trade.value.trim().slice(0, 80), due: f.due.value };
    if (!v.name) return;
    var id = f.dataset.dcpform;
    if (id) saveP(id, function (p) { Object.assign(p, v); });
    else { var t = Fe.tools(); id = uid(); t.dctl = (t.dctl || []).concat([Object.assign({ id: id, made: new Date().toISOString(), lines: [], files: [] }, v)]); Fe.saveTools(t); }
    adding = false; editing = false; document.activeElement && document.activeElement.blur && document.activeElement.blur();
    if (open !== id) go(id); else draw();
  });
  window.addEventListener('tools:change', function () { var ae = document.activeElement; if (ae && ae.matches && ae.matches('[data-dcq]')) return; draw(); });
  window.Vault.onUnlock(function () { setTimeout(draw, 80); });
  window.DocCtl = { parseReq: parseReq, linesFor: linesFor, PTYPES: PTYPES, namesText: namesText, parseName: parseName, parsePlan: parsePlan, readBook: readBook, letters: letters, score: score };
  draw();
})();
