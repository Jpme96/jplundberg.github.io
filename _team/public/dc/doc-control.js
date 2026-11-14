/* Copied from cmd/doc-control.page.js by _team/build.py – edit it there, not here. */
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
  /* Team (work.jplundberg.com) runs this same file on its own encrypted storage: it sets window.DocHost = { Fe, LP,
     profile, team } before loading it (a copy made by cmd/build.py). In cmd the storage is your vault (dash.tools). */
  var HOST = window.DocHost || null;
  if (!HOST && (!window.Vault || !window.Features)) return;
  var Fe = HOST ? HOST.Fe : window.Features, LP = HOST ? HOST.LP : window.__core && window.__core.lifepages;
  var el0 = document.getElementById('wkDocCtl'); if (!el0 && !HOST) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function k(key, en, o) { return I18N.k(key, en, o); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function readJSON(key, d) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? d : v; } catch (e) { return d; } }
  function profile() { return HOST && HOST.profile ? HOST.profile() : readJSON('dash.profile', {}) || {}; }
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
    var w = words(p.text), lw = words(line.planned + ' ' + line.sys + ' ' + line.type + ' ' + (line.name || ''));
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
  function saveP(id, fn, key) { key = key || 'dctl'; var t = Fe.tools(); (t[key] || []).forEach(function (r) { if (r && r.id === id) fn(r); }); Fe.saveTools(t); }
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
  function grpName(d) { if (/^1\d?$/.test(String(d))) return oneName(d); return LP && LP.nsName ? LP.nsName(d) : d; }
  function codeName(c) { c = String(c || ''); if (/^1\d\d$/.test(c)) return oneName(c); var n = LP && LP.nsName ? LP.nsName(c.slice(0, 3)) || LP.nsName(c.slice(0, 2)) : ''; return n; }
  function lineTitle(l) { return l.sys || codeName(l.code) || ''; }
  function typeLabel(l) { return l.name ? l.name : l.t ? l.t.split('').map(typeName).join(', ') : l.type; }

  /* ---------- the page ---------- */
  var open = null, tab = 'over', filt = 'all', q = '', openLine = null, adding = false, editing = false, pasting = false, quick = false, picking = false;
  try { quick = sessionStorage.getItem('dash.dcQuick') === '1'; } catch (e) {}
  try { tab = sessionStorage.getItem('dash.dcTab') || 'over'; } catch (e) {}
  function hashId() { var m = location.hash.match(/^#dc=([\w-]+)$/); return m ? m[1] : null; }
  open = hashId();
  function go(id) { open = id; openLine = null; editing = false; ropen = null; if (hashId() !== id) history.pushState({ dc: id }, '', location.pathname + location.search + '#dc=' + id); draw(); window.scrollTo(0, 0); }
  function back() { if (hashId() && history.state && history.state.dc) { history.back(); return; } open = null; history.replaceState(null, '', location.pathname + location.search); draw(); }
  window.addEventListener('popstate', function () { var id = hashId(), r = rHash(); if (id !== open || r !== ropen) { open = id; ropen = r; openLine = null; rpicking = false; if (window.PageTabs && PageTabs.show) { if (r) PageTabs.show('req', true); else if (id) PageTabs.show('doc', true); } draw(); } });
  function setTab(t) { tab = t; try { sessionStorage.setItem('dash.dcTab', t); } catch (e) {} }

  /* the building and the property (JP 10:42): building ID and name, property name and ID – on the project, the requirements and the reports */
  var SITE = [['bid', 'ui.dc-bid', 'Building ID', 40], ['bname', 'ui.dc-bname', 'Building name', 120], ['pname', 'ui.dc-pname', 'Property name', 120], ['pid', 'ui.dc-pid', 'Property ID', 60]];
  function siteFields(p) { return '<div class="dc-site">' + SITE.map(function (q) { return '<label><span>' + esc(k(q[1], q[2])) + '</span><input name="' + q[0] + '" maxlength="' + q[3] + '" value="' + esc(p && p[q[0]] || '') + '"></label>'; }).join('') + '</div>'; }
  function siteRead(f, v) { SITE.forEach(function (q) { v[q[0]] = f[q[0]] ? f[q[0]].value.trim().slice(0, q[3]) : ''; }); return v; }
  function siteRows(p) { return SITE.map(function (q) { return [k(q[1], q[2]), p[q[0]]]; }); }
  function siteLine(p) { return [p.bid, p.bname].filter(Boolean).join(' ') || p.pname || ''; }
  function projForm(p) {
    p = p || {};
    return '<form class="dc-pform" data-dcpform="' + esc(p.id || '') + '">' +
      '<label><span>' + esc(k('ui.dc-project', 'Project')) + '</span><input name="name" maxlength="120" required value="' + esc(p.name || '') + '" placeholder="' + esc(k('ui.dc-project-ph', 'e.g. Made-up school, new building')) + '"></label>' +
      '<label><span>' + esc(k('ui.dc-project-no', 'Project no.')) + '</span><input name="no" maxlength="40" value="' + esc(p.no || '') + '"></label>' + siteFields(p) +
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
        '<span class="kit-x"><b data-noi18n>' + esc(p.name) + '</b><small data-noi18n>' + esc([p.no, siteLine(p), p.trade, p.who, c.all ? k('ui.dc-n-docs', '{n} documents', { n: c.all }) : k('ui.dc-no-plan', 'No plan yet'), c.missing ? k('ui.dc-n-missing', '{n} missing', { n: c.missing }) : ''].filter(Boolean).join(' · ')) + '</small></span>' +
        (c.all ? '<span class="kit-r"><b class="dc-pc">' + pc + ' %</b></span>' : '') + '<i class="bi bi-chevron-right fdv-go"></i></button></li>';
    }).join('') + '</ul>' : (adding ? '' : '<p class="empty kit-empty">' + esc(k('ui.dc-empty', 'Add a project, import its document plan (Excel) and the delivered files – you see at once what is missing, and check each document.')) + '</p>');
    return '<div class="card-head"><h2><i class="bi bi-folder-check"></i> ' + esc(k('ui.doc-control', 'Document control')) + '</h2>' + (adding ? '' : '<div class="head-actions"><button type="button" class="text-btn" data-dcnew><i class="bi bi-plus-lg"></i> ' + esc(k('ui.new', 'New')) + '</button></div>') + '</div>' + body;
  }
  function full(p) {
    var T = [['over', k('ui.dc-tab-over', 'Overview'), 'speedometer2'], ['docs', k('ui.dc-tab-docs', 'Documents'), 'list-check'], ['files', k('ui.dc-tab-files', 'Files'), 'files'], ['report', k('ui.fdv-tab-report', 'Report'), 'file-earmark-text']];
    if (!T.some(function (t) { return t[0] === tab; })) tab = 'over';
    var c = counts(p.lines || []);
    var head = '<div class="fdv-top"><button type="button" class="fdv-back" data-dcback><i class="bi bi-chevron-left"></i> ' + esc(k('ui.doc-control', 'Document control')) + '</button>' +
      '<div class="fdv-title"><h2 data-noi18n>' + esc(p.name) + '</h2><small data-noi18n>' + esc([p.no, siteLine(p), p.trade, p.who].filter(Boolean).join(' · ')) + '</small></div>' + (c.all ? '<b class="dc-pc">' + Math.round(c.done / c.all * 100) + ' %</b>' : '') + '</div>' +
      '<nav class="fdv-tabs" role="tablist">' + T.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (t[0] === tab) + '" data-dctab="' + t[0] + '"><i class="bi bi-' + t[2] + '"></i> ' + esc(t[1]) + '</button>'; }).join('') + '</nav>';
    var body = tab === 'over' ? over(p) : tab === 'docs' ? docs(p) : tab === 'files' ? files(p) : reportTab(p);
    return '<div class="fdv-page dc-page">' + head + '<div class="fdv-body">' + body + '</div></div>';
  }
  function bar(c) {
    var seg = [['ok', c.ok + c.na], ['cmt', c.cmt], ['recv', c.recv], ['rej', c.rej], ['missing', c.missing]].filter(function (s) { return s[1]; });
    return '<div class="dc-bar" role="img" aria-label="' + esc(seg.map(function (s) { return stName(s[0]) + ' ' + s[1]; }).join(', ')) + '">' + seg.map(function (s) { return '<i style="flex:' + s[1] + ';--c:' + st(s[0])[3] + '"></i>'; }).join('') + '</div>';
  }
  /* the lines of one system together: the code and its name once, the document types under it (JP 11:38) */
  function byCode(lines) { var m = {}, order = []; lines.forEach(function (l) { var c = String(l.code); if (!m[c]) { m[c] = []; order.push(c); } m[c].push(l); }); return order.map(function (c) { return [c, lineTitle(m[c][0]), m[c]]; }); }
  /* the description without the letters (JP 12:35): one type → just the text; Drift and Vedlikehold together → "Drift: … / Vedlikehold: …" */
  function hintText(l) { var h = l.hint || ''; return (l.t || '').length > 1 ? h.replace(/^([A-L]): /gm, function (m, x) { return typeName(x) + ': '; }) : h.replace(/^[A-L]: /gm, ''); }
  /* the order everywhere: by code, then the NS 3456 type (A, B/C, D … L) – also for lines added later */
  var TORD = 'ABCDEFGHIKL';
  function lineOrder(a, b) { var x = String(a.code), y = String(b.code); if (x !== y) return x < y ? -1 : 1; var p = TORD.indexOf((a.t || 'Z')[0]), q = TORD.indexOf((b.t || 'Z')[0]); return (p < 0 ? 99 : p) - (q < 0 ? 99 : q); }
  function byGroup(lines) {
    var g = {}; lines.slice().sort(lineOrder).forEach(function (l) { var d = String(l.code).charAt(0) || '–'; (g[d] = g[d] || []).push(l); });
    return Object.keys(g).sort().map(function (d) { return [d, g[d]]; });
  }
  function planBtns(p) {
    var K = kravs();
    return (K.length ? '<select class="dc-link dc-fromkrav" data-dcfromkrav="' + esc(p.id) + '"><option value="">' + esc(k('ui.dc-from-krav', 'Use document requirements …')) + '</option>' + K.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name + ' (' + (x.lines || []).length + ')') + '</option>'; }).join('') + '</select>' : '') + '<div class="dc-facts"><label class="pill-btn dc-file"><i class="bi bi-file-earmark-spreadsheet"></i> ' + esc((p.lines || []).length ? k('ui.dc-plan-again', 'Import the plan again') : k('ui.dc-plan-import', 'Import document plan')) +
      '<input type="file" accept=".xlsx,.xlsm,.csv,.txt" data-dcplan="' + esc(p.id) + '" hidden></label>' +
      '<label class="pill-btn dc-file"><i class="bi bi-upload"></i> ' + esc(k('ui.dc-files-import', 'Import delivered files')) + '<input type="file" multiple data-dcfiles="' + esc(p.id) + '" hidden></label></div>';
  }
  function over(p) {
    if (editing) return projForm(p);
    var L = p.lines || [], c = counts(L), F = p.files || [], bad = F.filter(function (f) { return (f.iss || []).length; }).length, loose = F.filter(function (f) { return !f.line; }).length;
    var h = '';
    if (!L.length) h += '<p class="muted dc-help">' + esc(k('ui.dc-plan-help3', 'Import the project’s document plan (Excel – a column for the NS 3451 code and one for the NS 3456 document type or the planned name), or use document requirements you made for the project.')) + '</p>';
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
    h += '<h3 class="fdv-h">' + esc(k('ui.dc-the-project', 'The project')) + '</h3><table class="fdv-kv">' + [[k('ui.dc-project-no', 'Project no.'), p.no]].concat(siteRows(p), [[k('ui.dc-contractor', 'Contractor'), p.who], [k('ui.dc-trade', 'Trade / delivery'), p.trade], [k('ui.dc-due', 'Deadline'), fmt(p.due)]]).filter(function (r) { return r[1]; }).map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td data-noi18n>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>' +
      '<div class="fdv-acts"><button type="button" class="pill-btn" data-dcedit><i class="bi bi-pencil"></i> ' + esc(k('ui.edit', 'Edit')) + '</button>' + (HOST ? '' : '<button type="button" class="pill-btn" data-dcteam="' + esc(p.id) + '"><i class="bi bi-people"></i> ' + esc(k('ui.dc-send-team', 'Send to Team')) + '</button>') + '<button type="button" class="text-btn dc-del" data-dcdel="' + esc(p.id) + '"><i class="bi bi-trash3"></i> ' + esc(k('ui.dc-delete', 'Delete project')) + '</button></div>';
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
      var seen = {};
      return '<h3 class="fdv-h dc-gh">' + esc(g[0] + ' ' + (grpName(g[0]) || '')) + '</h3><ul class="dc-lines">' + g[1].slice().sort(lineOrder).map(function (l) {
        var sub = seen[l.code] ? '' : '<li class="dc-csub"><span class="dc-code">' + esc(l.code) + '</span><b data-noi18n>' + esc(lineTitle(l)) + (l.fire ? ' <i class="bi bi-fire dc-fi"></i>' : '') + '</b></li>'; seen[l.code] = 1;
        var fs = (l.files || []).map(function (id) { return F[id]; }).filter(Boolean), isOpen = openLine === l.id;
        var h2 = sub + '<li class="dc-line' + (isOpen ? ' open' : '') + '"><button type="button" class="dc-lmain" data-dcline="' + esc(l.id) + '" aria-expanded="' + isOpen + '"><span class="dc-code"></span>' +
          '<span class="dc-lx"><b data-noi18n>' + esc(typeLabel(l) || k('ui.dc-documentation', 'Documentation')) + '</b><small data-noi18n>' + esc([l.planned && !l.ex ? l.planned : '', fs.length ? k('ui.dc-n-files', '{n} files', { n: fs.length }) : ''].filter(Boolean).join(' · ')) + '</small>' +
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
  function addLineForm(p, kind) {
    var o = [['', k('ui.dc-type-any', 'Document type …')]].concat(TYPES.map(function (t) { return [t[0], t[0] + ' ' + typeName(t[0])]; })).concat([['BC', 'B, C ' + typeName('B') + ', ' + typeName('C')]]);
    return '<form class="dc-addl" data-dcaddl="' + (kind === 'req' ? 'r:' : '') + esc(p.id) + '"><h3 class="fdv-h">' + esc(k('ui.dc-add-line', 'Add a line')) + '</h3><div class="dc-addr"><input name="code" inputmode="decimal" maxlength="7" placeholder="' + esc(k('ui.dc-code', 'Code')) + '" required><select name="t">' + o.map(function (x) { return '<option value="' + x[0] + '">' + esc(x[1]) + '</option>'; }).join('') + '</select></div>' +
      '<input name="name" maxlength="160" placeholder="' + esc(k('ui.dc-add-line-ph', 'What it is, e.g. Samsvarserklæring membran')) + '"><button type="submit" class="text-btn"><i class="bi bi-plus-lg"></i> ' + esc(k('ui.add', 'Add')) + '</button></form>';
  }
  function looseFiles(p) { return (p.files || []).filter(function (f) { return !f.line; }); }
  function lineOf(p, id) { return (p.lines || []).filter(function (l) { return l.id === id; })[0]; }
  function files(p) {
    var F = (p.files || []).slice(), h = planBtns(p).replace('<label class="pill-btn dc-file"><i class="bi bi-file-earmark-spreadsheet"></i>', '<label class="pill-btn dc-file" hidden><i class="bi bi-file-earmark-spreadsheet"></i>');
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
    var me = profile(), L = p.lines || [], c = counts(L), F = p.files || [];
    var row = function (l) { return '<tr><td>' + esc(l.code) + '</td><td>' + esc(lineTitle(l)) + '</td><td>' + esc(typeLabel(l)) + '</td><td>' + esc(l.planned && !l.ex ? l.planned : '') + '</td></tr>'; };
    var h = '<header class="rp-head"><div><p class="rp-kick">' + esc(k('ui.doc-control', 'Document control')) + (p.trade ? ' · ' + esc(p.trade) : '') + '</p><h1>' + esc(p.name) + '</h1></div></header>' +
      '<table class="rp-cvt">' + [[k('ui.dc-project-no', 'Project no.'), p.no]].concat(siteRows(p), [[k('ui.dc-contractor', 'Contractor'), p.who], [k('ui.dc-due', 'Deadline'), fmt(p.due)], [k('ui.date', 'Date'), fmt(today())], [k('ui.dc-checked-by', 'Checked by'), [me.name, me.role].filter(Boolean).join(', ')], [k('ui.dc-plan', 'Document plan'), p.planName]]).filter(function (r) { return r[1]; }).map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>';
    h += '<h2>1 ' + esc(k('ui.dc-summary', 'Summary')) + '</h2><p>' + esc(k('ui.dc-summary-text', '{d} of {n} documents are approved or not relevant ({pc} %). Missing: {m}. Received, not yet checked: {r}. Not approved: {x}.', { d: c.done, n: c.all, pc: c.all ? Math.round(c.done / c.all * 100) : 0, m: c.missing, r: c.recv, x: c.rej })) + '</p>';
    var nc = function (v) { return '<td class="n">' + v + '</td>'; };
    h += '<table class="rp-grid dc-sumt"><thead><tr><th>NS 3451</th><th class="n">' + esc(k('ui.dc-documents', 'Documents')) + '</th><th class="n">' + esc(k('ui.dc-approved', 'Approved')) + '</th><th class="n">' + esc(stName('missing')) + '</th></tr></thead><tbody>' +
      byGroup(L).map(function (g) { var x = counts(g[1]); return '<tr><td>' + esc(g[0] + ' ' + (grpName(g[0]) || '')) + '</td>' + nc(x.all) + nc(x.done) + nc(x.missing) + '</tr>'; }).join('') +
      '<tr class="dc-tot"><td><b>' + esc(k('ui.total', 'Total')) + '</b></td>' + nc('<b>' + c.all + '</b>') + nc('<b>' + c.done + '</b>') + nc('<b>' + c.missing + '</b>') + '</tr></tbody></table>';
    var miss = L.filter(function (l) { return l.st === 'missing'; }), back = L.filter(function (l) { return l.st === 'rej' || l.st === 'cmt'; }), badF = F.filter(function (f) { return (f.iss || []).length; }), looseF = F.filter(function (f) { return !f.line; });
    var head4 = '<thead><tr><th>' + esc(k('ui.dc-code', 'Code')) + '</th><th>' + esc(k('ui.dc-system', 'System')) + '</th><th>' + esc(k('ui.dc-type', 'Document type')) + '</th><th>' + esc(k('ui.dc-planned-name', 'Planned name')) + '</th></tr></thead>';
    h += '<h2>2 ' + esc(k('ui.dc-missing-docs', 'Missing documents')) + '</h2>' + (miss.length ? '<table class="rp-grid dc-rt dr-rt"><thead><tr><th>' + esc(k('ui.dc-type', 'Document type')) + '</th><th>' + esc(k('ui.dc-planned-name', 'Planned name')) + '</th></tr></thead><tbody>' +
      byCode(miss).map(function (c) { return '<tr class="dr-crow"><td colspan="2"><b>' + esc(c[0]) + '</b> ' + esc(c[1]) + '</td></tr>' + c[2].map(function (l) { return '<tr><td>' + esc(typeLabel(l) || k('ui.dc-documentation', 'Documentation')) + '</td><td>' + esc(l.planned && !l.ex ? l.planned : '') + '</td></tr>'; }).join(''); }).join('') + '</tbody></table>' : '<p>' + esc(k('ui.dc-none-missing', 'Nothing is missing.')) + '</p>');
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
    var ae = document.activeElement; if (ae && (el.contains(ae) || (document.getElementById('wkDocReq') || el).contains(ae)) && ae.matches('textarea[data-dccmt], .dc-pform input, [data-dredit] input, [data-drform] input, .dc-paste textarea, .dc-tsave input, .dc-addl input, [data-dcpq]')) return;   /* never redraw under the finger */
    var p = open && proj(open);
    if (open && !p && document.documentElement.classList.contains('unlocked')) open = null;
    document.body.classList.toggle('dc-full', !!p);
    el.innerHTML = p ? full(p) : list();
    if (window.I18N && I18N.apply) try { I18N.apply(el); } catch (e) {}
    var er = document.getElementById('wkDocReq'); if (!er) return;
    var rp = ropen && krav(ropen);
    if (ropen && !rp && document.documentElement.classList.contains('unlocked')) ropen = null;
    document.body.classList.toggle('dr-full', !!rp && !p);
    er.innerHTML = rp ? kravFull(rp) : kravList();
    if (window.I18N && I18N.apply) try { I18N.apply(er); } catch (e) {}
  }

  /* ---------- the requirements checklist and project types (JP 2026-11-14) ----------
     The checklist (e.g. Boligbygg's "Sjekkliste for leveranse av FDVU-dokumentasjon", Vedlegg 2) says which NS 3456 types each
     3-digit NS 3451 code needs, with examples. It is imported once and kept in your encrypted data (dash.tools.dcreq) – never in
     the code: it is the client's document, built on the standard. A project type is a set of codes to tick in one go: the
     built-in ones below (only NS 3451 code numbers), and your own (dash.tools.dctypes). */
  var PTYPES = [
    ['new', 'New building – everything', 'Nybygg – alt', '*'],
    ['one', 'General documents (1 series)', 'Øvrig dokumentasjon (1-serien)', '113 115 116 117 124 141 143 144 145 154 163 165 171 172 173 191 192 193 194'],
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
  /* built-in suggestion (JP 11:15 – "should have more of what type of documentation each of them should have"): when the client's
     checklist has no line for a code (or none is imported), the document types are suggested per NS 3451 group, with a short
     description of each type in this app's own words. The client's checklist always wins. */
  var DEF = { 21: 'AEK', 22: 'AEK', 23: 'ACEFK', 24: 'ACEK', 25: 'ACEK', 26: 'ACEFK', 27: 'CEG', 28: 'ACEK', 29: 'AE',
    31: 'ABCDEHIK', 32: 'ABCDEHIK', 33: 'ABCDEFHIK', 34: 'ABCDEFHIK', 35: 'ABCDEFHIK', 36: 'ABCDEHIK', 37: 'ABCDEHIK', 38: 'ABCDEHIK', 39: 'ABCDE',
    41: 'ACEIK', 42: 'ABCDEFIK', 43: 'ABCDEIK', 44: 'ACDEGK', 45: 'ACEG', 46: 'ABCDEIK', 47: 'ABCDEIK', 48: 'ACEI', 49: 'AE',
    51: 'AEK', 52: 'ABCDEHK', 53: 'ABCDEGHK', 54: 'ABCDEFGHIK', 55: 'ABCDEGK', 56: 'ABCDEGHIK', 57: 'ACEI', 59: 'AE',
    61: 'ABCDEGK', 62: 'ABCDEFGHIK', 63: 'ABCDEHK', 64: 'ABCDEHIK', 65: 'ABCDEGK', 66: 'BCEG', 67: 'EG', 68: 'EG', 69: 'E',
    71: 'AK', 72: 'ACEK', 73: 'ABCDEK', 74: 'ACDEK', 75: 'ACDEK', 76: 'ACEK', 77: 'CEG', 78: 'AK', 79: 'E' };
  var DEFX = {
    A: ['Declarations of conformity, final inspection and control declarations, test reports – that the requirements are met', 'Samsvarserklæringer, sluttkontroll og kontrollerklæringer, testrapporter – at kravene er oppfylt'],
    B: ['How it is run and used, routines for checks and inspections, what to do when something goes wrong', 'Hvordan det driftes og brukes, rutiner for kontroll og ettersyn, hva som gjøres ved feil'],
    C: ['Maintenance instructions with intervals, cleaning, spare parts and the warranty terms', 'Vedlikeholdsinstrukser med intervaller, renhold, reservedeler og garantivilkår'],
    D: ['List of delivered components with TFM label, location, type and supplier', 'Oversikt over leverte komponenter med TFM-merking, plassering, type og leverandør'],
    E: ['Product data sheets – properties, dimensions, materials and approvals', 'Produktdatablad – egenskaper, dimensjoner, materialer og godkjenninger'],
    F: ['Certificates and third-party approvals where required', 'Sertifikater og tredjepartsgodkjenninger der det kreves'],
    G: ['Instructions for residents and users', 'Bruksanvisning for beboere og brukere'],
    H: ['System and function description – how it is built up and works with other systems', 'System- og funksjonsbeskrivelse – oppbygging og samspill med andre anlegg'],
    I: ['Settings, measurements and adjustments at handover (commissioning protocol)', 'Innstillinger, målinger og innregulering ved overlevering (protokoll)'],
    K: ['As-built drawings – plans, sections, details or schematics', '«Som bygget»-tegninger – planer, snitt, detaljer eller skjema'],
    L: ['Photos of hidden work, with location', 'Bilder av skjulte arbeider, med plassering'] };
  function defTypes(c) { c = String(c || ''); if (c.length < 3) return ''; if (/^[2-7]\d0$/.test(c)) return 'HK'; return DEF[c.slice(0, 2)] || ''; }
  function defHint(x) { var q = DEFX[x]; return q ? (I18N.lang === 'nb' ? q[1] : q[0]) : ''; }
  /* NS 3456's own main group 1 – the documents for the whole property, not a building part (JP 12:09): headings only, in Norwegian
     and English; one line each, with a short description of what it is in this app's own words */
  var ONE = [['1', 'Øvrig dokumentasjon', 'General documentation'], ['11', 'Dokumenter for forvaltning', 'Documents for management'], ['111', 'Kjøpskontrakter', 'Purchase contracts'], ['112', 'Leiekontrakter', 'Lease contracts'],
    ['113', 'Drifts-, vedlikeholds- og serviceavtaler', 'Operation, maintenance and service agreements'], ['114', 'Vedtekter for boligselskap', 'Articles of the housing company'], ['115', 'Garantidokumenter (lovpålagt eller avtalt)', 'Warranty documents (by law or agreed)'],
    ['116', 'Protokoller (overtakelse, ettårsbefaring, garantitidens utløp)', 'Protocols (handover, one-year inspection, end of warranty)'], ['117', 'Adresselister (leverandører)', 'Address lists (suppliers)'], ['118', 'Forsikringer', 'Insurance'],
    ['12', 'Juridiske og offentlige dokumenter', 'Legal and public documents'], ['121', 'Matrikkelinformasjon', 'Land register information'], ['122', 'Seksjoneringsplan', 'Sectioning plan'], ['123', 'Offentligrettslige betingelser for drift', 'Public conditions for running the property'], ['124', 'Ferdigattest og midlertidig brukstillatelse', 'Completion certificate and temporary use permit'],
    ['13', 'Tomt', 'Site'], ['131', 'Tomtebefaring', 'Site inspection'], ['132', 'Beskyttelse av vegetasjon og vekstjord', 'Protection of vegetation and topsoil'], ['133', 'Målinger og rapporter', 'Measurements and reports'],
    ['14', 'Dimensjonering', 'Design calculations'], ['141', 'Energiberegninger', 'Energy calculations'], ['142', 'Bærekraftsberegninger', 'Sustainability calculations'], ['143', 'Statiske beregninger', 'Structural calculations'], ['144', 'Inneklima (lys, luft, lyd, temperatur)', 'Indoor climate (light, air, sound, temperature)'], ['145', 'Målinger (lys, radon, tetthet)', 'Measurements (light, radon, airtightness)'], ['146', 'Tilpasningsdyktighet', 'Adaptability'],
    ['15', 'Miljø', 'Environment'], ['151', 'Miljøkonsept', 'Environmental concept'], ['152', 'Miljøsertifisering', 'Environmental certification'], ['153', 'Klimaregnskap', 'Climate accounts'], ['154', 'Energiattest', 'Energy certificate'], ['155', 'Miljøkartlegging og sanering', 'Environmental survey and remediation'], ['156', 'Skadedyr', 'Pests'],
    ['16', 'Tegninger, planer og kart', 'Drawings, plans and maps'], ['161', 'Offentlige plan- og reguleringsdokumenter', 'Public planning and zoning documents'], ['162', 'Situasjonsplan', 'Site plan'], ['163', '«Som bygget»-tegninger', 'As-built drawings'], ['164', 'Tegninger til byggesak', 'Drawings for the building application'], ['165', 'Modeller (BIM)', 'Models (BIM)'],
    ['17', 'Branndokumentasjon', 'Fire documentation'], ['171', 'Brannkonsept «som bygget»', 'Fire concept as built'], ['172', 'Rømningsplan', 'Escape plan'], ['173', 'Orienteringsplan', 'Orientation plan'],
    ['18', 'Sikkerhet', 'Safety'], ['181', 'Sikkerhet mot naturpåkjenninger', 'Safety against natural hazards'], ['182', 'Graderingsspesifikasjon', 'Security classification'], ['183', 'Andre sikkerhetsvurderinger', 'Other safety assessments'],
    ['19', 'Drift og vedlikehold', 'Operation and maintenance'], ['191', 'Drifts- og vedlikeholdsplan for bygningen', 'Operation and maintenance plan for the building'], ['192', 'Opplæringsplaner (kvittert gjennomført)', 'Training plans (signed as done)'], ['193', 'Renholdsplaner', 'Cleaning plans'], ['194', 'Renovasjonsplan', 'Waste plan'], ['195', 'Prøvedrift', 'Trial operation'], ['196', 'Brøyteplan', 'Snow clearing plan'], ['197', 'Drifts- og vedlikeholdsplan utomhus', 'Operation and maintenance plan outdoors']];
  var ONEM = {}; ONE.forEach(function (q) { ONEM[q[0]] = q; });
  function oneName(c) { var q = ONEM[String(c)]; return q ? (I18N.lang === 'nb' ? q[1] : q[2]) : ''; }
  var ONEX = { 163: 'K', 165: 'K', 162: 'K', 164: 'K', 172: 'K', 173: 'K', 116: 'I', 192: 'I' };
  /* 4-digit codes (JP 11:49): from your own NS 3451 list (Settings → Work), under their 3-digit code; they take the 3-digit code's types */
  function own4() { var m = LP && LP.ownMap ? LP.ownMap() : {}, o = {}; Object.keys(m).forEach(function (c) { if (/^\d{4}$/.test(c)) o[c] = m[c]; }); return o; }
  function kids4(c3) { return Object.keys(own4()).filter(function (c) { return c.indexOf(c3) === 0; }).sort(); }
  /* documents a kind of project needs besides the NS 3456 types (JP 13:05 – "changing a facade, you need the ferdigattest and so
     on"): per built-in project type, [code, NS 3456 type, Norwegian name, English name, what it is (nb), (en)] – this app's own
     list from Norwegian practice (byggesak, TEK17, NEK 400, the wet-room rules), meant as a starting point to check */
  var BYGG = [['124', 'A', 'Ferdigattest / midlertidig brukstillatelse', 'Completion certificate / temporary use permit', 'Fra kommunen når tiltaket er søknadspliktig', 'From the municipality when the work needs a permit'],
    ['124', 'A', 'Ansvarsretter og gjennomføringsplan', 'Declarations of responsibility and implementation plan', 'Erklæringer om ansvarsrett (SØK, PRO, UTF, KONT) og siste gjennomføringsplan', 'Declarations of responsibility (applicant, design, works, control) and the latest implementation plan'],
    ['124', 'A', 'Kontrollerklæringer', 'Control declarations', 'Fra prosjekterende og utførende, og uavhengig kontroll der det kreves', 'From design and works, and independent control where required']];
  var MILJO = ['155', 'A', 'Miljøkartlegging og avfallsrapport', 'Environmental survey and waste report', 'Kartlegging av farlig avfall (PCB, asbest, bly) før riving og sluttrapport for avfallet', 'Survey of hazardous waste (PCB, asbestos, lead) before demolition and the final waste report'];
  var XTRA = {
    facade: BYGG.concat([['164', 'K', 'Fasadetegninger fra byggesaken', 'Facade drawings from the application', 'Fasadetegninger som godkjent av kommunen', 'Facade drawings as approved by the municipality'],
      ['171', 'A', 'Brannteknisk dokumentasjon for fasaden', 'Fire documentation for the facade', 'Brannklasse for kledning og isolasjon, brannstopp i hulrom', 'Fire class of cladding and insulation, fire stops in cavities'], MILJO,
      ['232', 'A', 'Fuktsikring og vindtetting', 'Moisture and wind protection', 'Dokumentasjon av vindsperre, lekting og luftespalte med bilder', 'Wind barrier, battens and ventilation gap documented with photos']]),
    windows: [BYGG[0], ['164', 'K', 'Fasadetegninger fra byggesaken', 'Facade drawings from the application', 'Hvis vindusendringen er søknadspliktig', 'If the window change needs a permit'], MILJO,
      ['141', 'A', 'Energidokumentasjon (U-verdier)', 'Energy documentation (U-values)', 'U-verdi for vinduer og dører etter TEK17', 'U-values of windows and doors after TEK17'],
      ['171', 'A', 'Brannklassifiserte vinduer og dører', 'Fire-rated windows and doors', 'Dokumentasjon der vinduer eller dører skal ha brannklasse', 'Where windows or doors must be fire rated']],
    roof: BYGG.concat([['143', 'A', 'Statiske beregninger (snølast)', 'Structural calculations (snow load)', 'Beregning av bæring og snølast for taket', 'Load-bearing and snow load for the roof'],
      ['171', 'A', 'Brannteknisk dokumentasjon for taket', 'Fire documentation for the roof', 'Brannklasse for takbelegg og isolasjon', 'Fire class of roofing and insulation'], MILJO,
      ['262', 'L', 'Bilder av taktekking og detaljer', 'Photos of roofing and details', 'Beslag, gjennomføringer, sluk og overganger før de dekkes', 'Flashings, penetrations, drains and joints before they are covered']]),
    balcony: BYGG.concat([['143', 'A', 'Statiske beregninger for balkongene', 'Structural calculations for the balconies', 'Bæring, innfesting og rekkverk', 'Load-bearing, fixing and railings']]),
    structure: [BYGG[1], BYGG[2], ['143', 'A', 'Statiske beregninger', 'Structural calculations', 'Beregninger for bæresystemet', 'Calculations for the load-bearing system']],
    ground: [['133', 'A', 'Geoteknisk rapport', 'Geotechnical report', 'Grunnundersøkelser og geoteknisk vurdering', 'Ground investigation and geotechnical assessment'], BYGG[2],
      ['217', 'L', 'Bilder av drenering og fuktsikring', 'Photos of drainage and damp-proofing', 'Før gjenfylling, med plassering', 'Before backfilling, with location']],
    bath: [['255', 'A', 'Våtromsdokumentasjon – tettesjikt og sluk', 'Wet-room documentation – membrane and drain', 'Samsvarserklæring etter våtromsreglene, produktsertifikat for membransystemet', 'Declaration after the wet-room rules, product certificate for the membrane system'],
      ['255', 'L', 'Bilder av membran og sluk', 'Photos of membrane and drain', 'Tatt før flislegging, med plassering', 'Taken before tiling, with location'],
      ['433', 'A', 'Samsvarserklæring for el-arbeidet (NEK 400)', 'Declaration of conformity for the electrical work (NEK 400)', 'Med risikovurdering og kursfortegnelse', 'With risk assessment and circuit list'],
      ['453', 'I', 'Varmekabler – målerapport og plassering', 'Heating cables – measurement report and layout', 'Isolasjonsmåling og tegning av plasseringen', 'Insulation measurement and a drawing of the layout'],
      ['312', 'I', 'Trykkprøving av rør', 'Pressure test of pipes', 'Protokoll for trykkprøving', 'Pressure test protocol'], MILJO,
      ['116', 'I', 'Overtakelsesprotokoll', 'Handover protocol', 'Signert ved overtakelse, med eventuelle mangler', 'Signed at handover, with any defects'], ['115', '', 'Garantidokumenter', 'Warranty documents', '', '']],
    kitchen: [['433', 'A', 'Samsvarserklæring for el-arbeidet (NEK 400)', 'Declaration of conformity for the electrical work (NEK 400)', 'Med kursfortegnelse', 'With circuit list'], ['312', 'I', 'Trykkprøving av rør', 'Pressure test of pipes', 'Protokoll for trykkprøving', 'Pressure test protocol'],
      ['364', 'E', 'Kjøkkenventilator – produktdata og montering', 'Cooker hood – product data and installation', '', ''], ['116', 'I', 'Overtakelsesprotokoll', 'Handover protocol', '', '']],
    pods: [['613', 'A', 'Våtromsdokumentasjon for baderomsmodulene', 'Wet-room documentation for the bathroom pods', 'Produktdokumentasjon og samsvarserklæring fra leverandøren', 'Product documentation and declaration from the supplier'], ['433', 'A', 'Samsvarserklæring for el-tilkoblingen', 'Declaration for the electrical connection', '', '']],
    inner: [MILJO, ['171', 'A', 'Brannteknisk dokumentasjon', 'Fire documentation', 'Der branncellebegrensende vegger, dører eller himlinger endres', 'Where fire-separating walls, doors or ceilings change'], ['291', 'L', 'Branntetting – bilder og oversikt', 'Fire stopping – photos and list', 'Merket og fotografert ved hver gjennomføring', 'Marked and photographed at each penetration']],
    fire: BYGG.concat([['171', 'A', 'Brannkonsept «som bygget»', 'Fire concept as built', 'Oppdatert etter tiltaket', 'Updated after the work'], ['163', 'K', 'Branntegninger', 'Fire drawings', 'Brannceller, rømningsveier, slokkeutstyr', 'Fire cells, escape routes, extinguishing equipment'],
      ['291', 'L', 'Branntetting – bilder og oversikt', 'Fire stopping – photos and list', 'Merket og fotografert ved hver gjennomføring', 'Marked and photographed at each penetration']]),
    sprinkler: [['332', 'I', 'Overleveringsprotokoll og akseptansetest', 'Handover protocol and acceptance test', 'Funksjonstest, trykkprøving og vannforsyning', 'Function test, pressure test and water supply'], ['332', 'F', 'Godkjenning av installatør og anlegg', 'Approval of installer and system', 'Sertifisert installatør og eventuell tredjepartskontroll', 'Certified installer and any third-party control'],
      ['332', 'C', 'Serviceavtale og kontrollbok', 'Service agreement and log book', '', ''], ['163', 'K', 'Sprinklertegninger «som bygget»', 'As-built sprinkler drawings', 'Med seksjonsventiler og soner', 'With section valves and zones'], ['171', 'A', 'Brannkonsept – sprinkler', 'Fire concept – sprinkler', 'At anlegget dekker det brannkonseptet krever', 'That the system covers what the fire concept requires']],
    firealarm: [['542', 'I', 'Overleveringsrapport og funksjonstest', 'Handover report and function test', 'Test av detektorer, sirener og styringer', 'Test of detectors, sounders and controls'], ['542', 'F', 'Godkjenning av installatør og anlegg', 'Approval of installer and system', '', ''],
      ['542', 'C', 'Kontrollbok og serviceavtale', 'Log book and service agreement', '', ''], ['542', 'K', 'Branntegninger med detektorer og soner', 'Fire drawings with detectors and zones', '', '']],
    vent: [['360', 'I', 'Innreguleringsprotokoll', 'Commissioning protocol', 'Luftmengder per rom og aggregat', 'Air flows per room and unit'], ['360', 'H', 'Funksjonsbeskrivelse og styring', 'Function description and controls', 'Driftstider, temperaturer, SD-punkter', 'Running times, temperatures, BMS points'],
      ['360', 'C', 'Filterliste og serviceplan', 'Filter list and service plan', '', ''], ['141', 'A', 'Energidokumentasjon (SFP, gjenvinning)', 'Energy documentation (SFP, heat recovery)', '', '']],
    heating: [['350', 'A', 'Kuldemedium – samsvar og lekkasjekontroll', 'Refrigerant – declaration and leak check', 'Etter F-gassreglene', 'After the F-gas rules'], ['320', 'I', 'Innregulering og trykkprøving', 'Balancing and pressure test', '', '']],
    el: [['433', 'A', 'Samsvarserklæring (NEK 400) med risikovurdering', 'Declaration of conformity (NEK 400) with risk assessment', '', ''], ['432', 'K', 'Kursfortegnelse og enlinjeskjema', 'Circuit list and single-line diagram', '', ''],
      ['410', 'I', 'Måleprotokoll', 'Measurement protocol', 'Isolasjonsmåling, kontinuitet, jordfeilbrytere', 'Insulation, continuity, RCD tests']],
    light: [['443', 'I', 'Nødlys – funksjonstest og kontrollbok', 'Emergency lighting – function test and log book', '', '']],
    ev: [['436', 'A', 'Samsvarserklæring for ladeanlegget (NEK 400)', 'Declaration for the charging system (NEK 400)', '', ''], ['436', 'H', 'Lastbalansering – systembeskrivelse', 'Load balancing – system description', '', '']],
    solar: [['471', 'A', 'Samsvarserklæring og melding til nettselskapet', 'Declaration and notice to the grid company', '', ''], ['471', 'K', 'Strengskjema og plassering', 'String diagram and layout', '', ''], ['171', 'A', 'Brannteknisk vurdering av solcelleanlegget', 'Fire assessment of the solar system', '', '']],
    lift: [['621', 'A', 'Samsvarserklæring og CE-merking', 'Declaration of conformity and CE marking', '', ''], ['621', 'F', 'Sakkyndig kontroll før bruk', 'Expert inspection before use', '', ''], ['621', 'C', 'Serviceavtale', 'Service agreement', '', '']],
    outdoor: [['161', '', 'Situasjonsplan og utomhusplan', 'Site plan and landscape plan', '', ''], ['731', 'K', 'VA-tegninger «som bygget»', 'As-built water and drainage drawings', '', '']],
    outva: [['731', 'K', 'VA-tegninger «som bygget»', 'As-built water and drainage drawings', '', ''], ['731', 'I', 'Trykkprøving og filming av ledninger', 'Pressure test and CCTV of pipes', '', '']],
    one: [], new: BYGG.concat([['141', 'A', 'Energiberegning', 'Energy calculation', '', ''], ['154', 'A', 'Energiattest', 'Energy certificate', '', ''], ['145', 'I', 'Tetthetsmåling', 'Airtightness test', '', ''], ['171', 'A', 'Brannkonsept «som bygget»', 'Fire concept as built', '', ''], ['191', '', 'FDV-dokumentasjon samlet (drifts- og vedlikeholdsplan)', 'Operation and maintenance plan', '', '']])
  };
  function xKey(x) { return x[0] + '|' + x[2]; }
  var xsel = {}, xoff = {};
  function xtras() { var seen = {}, out = []; Object.keys(xsel).forEach(function (id) { var ty = allTypes().filter(function (q) { return q.id === id; })[0], L = ty && ty.own ? ty.x || [] : XTRA[id] || []; L.forEach(function (x) { if (!seen[xKey(x)]) { seen[xKey(x)] = 1; out.push(x); } }); }); return out.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; }); }
  function xLine(x) { var nbx = I18N.lang === 'nb', hint = nbx ? x[4] : x[5]; return { id: uid() + Math.random().toString(36).slice(2, 5), code: x[0], sys: codeName(x[0]) || '', name: (nbx ? x[2] : x[3]).slice(0, 120), type: x[1] ? typeName(x[1]) : '', t: x[1] || '', hint: hint || (x[1] ? defHint(x[1]) : '') || undefined, planned: '', note: '', st: 'missing', files: [], spec: 1 }; }
  function req() { var r = Fe.tools().dcreq; return r && r.codes ? r : null; }
  function ownTypes() { return Fe.list('dctypes'); }
  function allTypes() { var nbx = I18N.lang === 'nb'; return PTYPES.map(function (t) { return { id: t[0], name: nbx ? t[2] : t[1], codes: t[3] }; }).concat(ownTypes().map(function (t) { return { id: t.id, name: t.name, codes: (t.codes || []).join(' '), own: true, x: t.x || [] }; })); }
  /* codes to pick from: the checklist's, else your own NS 3451 list, else the codes the project types use */
  function pickCodes() {
    var r = req(), out = {};
    ONE.forEach(function (q) { if (q[0].length === 3) out[q[0]] = { n: oneName(q[0]), t: ONEX[q[0]] || '' }; });
    if (r) { Object.keys(r.codes).forEach(function (c) { out[c] = { n: r.codes[c].n, t: r.codes[c].t || (/^1/.test(c) ? ONEX[c] || '' : defTypes(c)) }; }); return out; }
    var own = LP && LP.ownMap ? LP.ownMap() : {}; Object.keys(own).forEach(function (c) { if (/^\d{3}$/.test(c)) out[c] = { n: own[c], t: defTypes(c) }; });
    PTYPES.forEach(function (t) { if (t[3] !== '*') t[3].split(' ').forEach(function (c) { if (!out[c]) out[c] = { n: codeName(c) || '', t: defTypes(c) }; }); });
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
      var q = r && (r.codes[c] || (c.length === 4 && r.codes[c.slice(0, 3)])), t = q && q.t ? q.t : /^1/.test(c) ? ONEX[c] || '' : defTypes(c), groups = [];
      if (!t) groups = [''];
      else { var bc = t.replace(/[^BC]/g, ''); t.split('').forEach(function (x) { if (x === 'B' || x === 'C') { if (groups.indexOf(bc) < 0) groups.push(bc); } else groups.push(x); }); }
      groups.forEach(function (g) {
        out.push({ id: uid() + out.length, code: c, sys: ((c.length === 4 ? own4()[c] : '') || q && q.n || codeName(c) || '').slice(0, 160), type: g ? g.split('').map(function (x) { return TYPES.filter(function (y) { return y[0] === x; })[0][1]; }).join(', ') : '', t: g,
          hint: g.split('').map(function (x) { var v = q && q.ex && q.ex[x] || defHint(x); return v ? x + ': ' + v : ''; }).filter(Boolean).join('\n').slice(0, 800) || undefined, opt: q && q.opt, planned: '', note: '', st: 'missing', files: [] });
      });
    });
    return out;
  }
  var ticks = {}, lastType = '';
  function picker(p, kind) {
    var r = req(), C = pickCodes(), keys = Object.keys(C).sort(), nbx = I18N.lang === 'nb';
    var h = '<div class="dc-pick">';
    h += r ? '<p class="muted dc-help">' + esc(k('ui.dc-req-from', 'Checklist: {f} ({n} codes)', { f: r.name, n: keys.length })) + ' · <label class="text-btn dc-file">' + esc(k('ui.dc-req-replace', 'Replace')) + '<input type="file" accept=".xlsx,.xlsm,.csv" data-dcreq hidden></label></p>'
      : '<p class="muted dc-help">' + esc(k('ui.dc-req-help', 'Import the client’s checklist once (e.g. Boligbygg’s Vedlegg 2 – which NS 3456 document types each NS 3451 code needs). Without it you get one line per code, without the types.')) + '</p><div class="dc-facts"><label class="pill-btn dc-file"><i class="bi bi-file-earmark-spreadsheet"></i> ' + esc(k('ui.dc-req-import', 'Import checklist')) + '<input type="file" accept=".xlsx,.xlsm,.csv" data-dcreq hidden></label></div>';
    h += '<h3 class="fdv-h">' + esc(k('ui.dc-ptype', 'Project type')) + '</h3><div class="dc-chips dc-wrap">' + allTypes().map(function (t) { return '<button type="button" class="dc-chip" aria-pressed="' + !!xsel[t.id] + '" data-dcptype="' + esc(t.id) + '">' + esc(t.name) + (t.own ? ' <i class="bi bi-person"></i>' : '') + '</button>'; }).join('') + '</div>';
    h += '<p class="muted dc-help">' + esc(k('ui.dc-ptype-help', 'A type ticks its systems – then tick more or untick what the project doesn’t have.')) + '</p>';
    var XS = xtras();
    if (XS.length) h += '<h3 class="fdv-h">' + esc(k('ui.dc-specific', 'Specific to this kind of project')) + '</h3><p class="muted dc-help">' + esc(k('ui.dc-specific-help', 'Documents the project needs besides the NS 3456 types – untick what doesn’t apply.')) + '</p><ul class="dc-xs">' + XS.map(function (x) {
      return '<li><label><input type="checkbox" data-dcxtick="' + esc(xKey(x)) + '"' + (xoff[xKey(x)] ? '' : ' checked') + '><span><b>' + esc(x[0]) + '</b> ' + esc(I18N.lang === 'nb' ? x[2] : x[3]) + (x[1] ? ' <small class="dc-lt">' + esc(typeName(x[1])) + '</small>' : '') + '</span></label></li>'; }).join('') + '</ul>';
    h += '<input type="search" class="dc-q" data-dcpq placeholder="' + esc(k('ui.dc-search-codes', 'Search code or system')) + '">';
    var groups = {}; keys.forEach(function (c) { (groups[c.slice(0, 2)] = groups[c.slice(0, 2)] || []).push(c); });
    if (!Object.keys(own4()).length) h += '<p class="muted dc-help">' + esc(k('ui.dc-no4', 'For 4-digit codes (e.g. 3321), import your NS 3451 list in Settings → Work – they then show under their 3-digit code.')) + '</p>';
    var lastMain = '';
    Object.keys(groups).sort().forEach(function (g) {
      if (g[0] !== lastMain) { lastMain = g[0]; h += '<h3 class="fdv-h dc-gh">' + esc(g[0] + ' ' + (grpName(g[0]) || '')) + '</h3>'; }
      var n = groups[g].filter(function (c) { return ticks[c]; }).length;
      h += '<details class="dc-pg"' + (n ? ' open' : '') + '><summary><b>' + esc(g) + '</b> ' + esc(grpName(g) || '') + ' <span class="dc-pn" data-dcpn="' + g + '">' + (n ? n : '') + '</span></summary><ul>' + groups[g].map(function (c) {
        var K4 = kids4(c);
        return '<li data-dcpc="' + c + '"><label><input type="checkbox" data-dctick="' + c + '"' + (ticks[c] ? ' checked' : '') + '><span><b>' + c + '</b> <span data-noi18n>' + esc(C[c].n) + '</span>' + (C[c].t ? ' <small class="dc-lt">' + esc(C[c].t.split('').join(' ')) + '</small>' : '') + '</span></label>' +
          (K4.length ? '<ul class="dc-k4">' + K4.map(function (c4) { return '<li data-dcpc="' + c4 + '"><label><input type="checkbox" data-dctick="' + c4 + '"' + (ticks[c4] ? ' checked' : '') + '><span><b>' + c4 + '</b> <span data-noi18n>' + esc(own4()[c4]) + '</span></span></label></li>'; }).join('') + '</ul>' : '') + '</li>';
      }).join('') + '</ul></details>';
    });
    h += '<div class="dc-pbar"><span data-dcpcount>' + pickCount() + '</span><button type="button" class="pill-btn" data-dcmake="' + (kind || 'ctl') + '"><i class="bi bi-check2"></i> ' + esc(kind === 'req' ? k('ui.dr-make', 'Make the list') : k('ui.dc-make', 'Make the plan')) + '</button><button type="button" class="text-btn" data-dccancel>' + esc(k('ui.cancel', 'Cancel')) + '</button></div>';
    h += '<form class="dc-tsave" data-dctsave><input name="n" maxlength="60" placeholder="' + esc(k('ui.dc-type-name', 'Save the ticks as a type, e.g. Bathroom, small')) + '"><button type="submit" class="text-btn"><i class="bi bi-bookmark-plus"></i> ' + esc(k('ui.save', 'Save')) + '</button></form>';
    if (ownTypes().length) h += '<p class="muted dc-help">' + ownTypes().map(function (t) { return '<button type="button" class="text-btn" data-dctdel="' + esc(t.id) + '"><i class="bi bi-x"></i> ' + esc(t.name) + '</button>'; }).join(' ') + '</p>';
    return h + '</div>';
  }
  function pickCount() {
    var cs = Object.keys(ticks).filter(function (c) { return ticks[c]; }), n = linesFor(cs).length + xtras().filter(function (x) { return !xoff[xKey(x)]; }).length;
    return esc(k('ui.dc-pick-count', '{c} systems · {n} documents', { c: cs.length, n: n }));
  }
  function updPick() {
    var el = document.querySelector('[data-dcpcount]'); if (el) el.innerHTML = pickCount();
    document.querySelectorAll('[data-dcpn]').forEach(function (s) { var g = s.dataset.dcpn, n = Object.keys(ticks).filter(function (c) { return ticks[c] && c.slice(0, 2) === g; }).length; s.textContent = n || ''; });
  }

  /* ---------- Document requirements (Dokumentkrav, JP 2026-11-14): at the start of a project – which documentation it should
     have (NS 3456 types per NS 3451 system, from the client's checklist), shared as PDF or Excel (laid out like a document
     plan, so the contractor's filled-in copy imports straight into Document control), and "Start document control" copies it
     over. Kept in dash.tools.dckrav. ---------- */
  var ropen = null, rpicking = false, radding = false, redit = false;
  function rHash() { var m = location.hash.match(/^#dr=([\w-]+)$/); return m ? m[1] : null; }
  ropen = rHash();
  function rgo(id) { ropen = id; rpicking = false; if (rHash() !== id) history.pushState({ dr: id }, '', location.pathname + location.search + '#dr=' + id); draw(); window.scrollTo(0, 0); }
  function rback() { if (rHash() && history.state && history.state.dr) { history.back(); return; } ropen = null; rpicking = false; history.replaceState(null, '', location.pathname + location.search); draw(); }
  function kravs() { return Fe.list('dckrav'); }
  function krav(id) { return kravs().filter(function (x) { return x.id === id; })[0] || null; }
  function kravForm() {
    return '<form class="dc-pform" data-drform><label><span>' + esc(k('ui.dc-project', 'Project')) + '</span><input name="name" maxlength="120" required placeholder="' + esc(k('ui.dc-project-ph', 'e.g. Made-up school, new building')) + '"></label>' +
      '<label><span>' + esc(k('ui.dc-project-no', 'Project no.')) + '</span><input name="no" maxlength="40"></label>' + siteFields(null) +
      '<div class="dc-facts"><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> ' + esc(k('ui.dr-next', 'Next: pick the systems')) + '</button><button type="button" class="text-btn" data-drcancel>' + esc(k('ui.cancel', 'Cancel')) + '</button></div></form>';
  }
  function kravList() {
    var L = kravs().slice().sort(function (a, b) { return (b.made || '') < (a.made || '') ? -1 : 1; });
    var body = radding ? kravForm() : '';
    body += L.length ? '<ul class="kit-list">' + L.map(function (p) {
      var sys = {}; (p.lines || []).forEach(function (l) { sys[l.code] = 1; });
      return '<li class="kit-item"><button type="button" class="kit-main" data-dropen="' + esc(p.id) + '"><span class="kit-ic" style="--c:#2f8a57"><i class="bi bi-clipboard2-check"></i></span><span class="kit-x"><b data-noi18n>' + esc(p.name) + '</b><small data-noi18n>' +
        esc([p.no, siteLine(p), p.type, k('ui.dc-pick-count', '{c} systems · {n} documents', { c: Object.keys(sys).length, n: (p.lines || []).length })].filter(Boolean).join(' · ')) + '</small></span><i class="bi bi-chevron-right fdv-go"></i></button></li>';
    }).join('') + '</ul>' : (radding ? '' : '<p class="empty kit-empty">' + esc(k('ui.dr-empty', 'At the start of a project: pick the project type and the systems, and get the documentation it should have after NS 3456 – to share with the contractor as PDF or Excel, and to check against later in Document control.')) + '</p>');
    return '<div class="card-head"><h2><i class="bi bi-clipboard2-check"></i> ' + esc(k('ui.doc-req', 'Document requirements')) + '</h2>' + (radding ? '' : '<div class="head-actions"><button type="button" class="text-btn" data-drnew><i class="bi bi-plus-lg"></i> ' + esc(k('ui.new', 'New')) + '</button></div>') + '</div>' + body;
  }
  function kravFull(p) {
    var L = p.lines || [], sys = {}; L.forEach(function (l) { sys[l.code] = 1; });
    var h = '<div class="fdv-page dc-page"><div class="fdv-top"><button type="button" class="fdv-back" data-drback><i class="bi bi-chevron-left"></i> ' + esc(k('ui.doc-req', 'Document requirements')) + '</button>' +
      '<div class="fdv-title"><h2 data-noi18n>' + esc(p.name) + '</h2><small data-noi18n>' + esc([p.no, siteLine(p), p.type, L.length ? k('ui.dc-pick-count', '{c} systems · {n} documents', { c: Object.keys(sys).length, n: L.length }) : ''].filter(Boolean).join(' · ')) + '</small></div></div><div class="fdv-body">';
    if (rpicking || !L.length) return h + picker(p, 'req') + '</div></div>';
    if (L.some(function (l) { return !l.t && defTypes(l.code) && !/^1/.test(l.code); })) h += '<p class="dc-note dr-fillnote"><i class="bi bi-info-circle"></i> ' + esc(k('ui.dr-fill-help', 'Some systems have no document types yet.')) + ' <button type="button" class="text-btn" data-drfill>' + esc(k('ui.dr-fill', 'Fill in the document types')) + '</button></p>';
    h += '<div class="dc-facts"><button type="button" class="pill-btn" data-drstart><i class="bi bi-folder-check"></i> ' + esc(k('ui.dr-start', 'Start document control')) + '</button>' +
      '<button type="button" class="pill-btn" data-drpdf><i class="bi bi-file-earmark-pdf"></i> <span>' + esc(k('ui.fdv-make-pdf', 'Make PDF')) + '</span></button>' +
      '<button type="button" class="pill-btn" data-drxlsx><i class="bi bi-file-earmark-spreadsheet"></i> ' + esc(k('ui.dr-excel', 'Excel for the contractor')) + '</button></div>' +
      '<p class="fdv-pdfnote muted" hidden></p><p class="muted dc-help">' + esc(k('ui.dr-excel-help', 'The Excel file is laid out like a document plan: the contractor fills in the planned names, and you import it in Document control.')) + '</p>';
    h += byGroup(L).map(function (g) {
      return '<h3 class="fdv-h dc-gh">' + esc(g[0] + ' ' + (grpName(g[0]) || '')) + '</h3><ul class="dr-syss">' + byCode(g[1]).map(function (c) {
        return '<li class="dr-sys"><div class="dr-sh"><span class="dc-code">' + esc(c[0]) + '</span><b data-noi18n>' + esc(c[1]) + '</b></div><ul class="dr-types">' + c[2].map(function (l) {
          return '<li class="dr-line"><span class="dc-lx"><b data-noi18n>' + esc(typeLabel(l) || k('ui.dc-documentation', 'Documentation')) + (l.opt ? ' <small>· ' + esc(k('ui.dc-if-contract', 'Only if it is in the contract')) + '</small>' : '') + '</b>' +
            (l.hint ? '<small class="dr-hint" data-noi18n>' + esc(hintText(l)).replace(/\n/g, '<br>') + '</small>' : '') + '</span><button type="button" class="icon-btn sm" data-drldel="' + esc(l.id) + '" aria-label="' + esc(k('ui.dc-remove-line', 'Remove the line')) + '"><i class="bi bi-x-lg"></i></button></li>';
        }).join('') + '</ul></li>';
      }).join('') + '</ul>';
    }).join('');
    h += '<div class="dc-facts"><button type="button" class="pill-btn" data-drpick><i class="bi bi-ui-checks"></i> ' + esc(k('ui.dc-pick-more', 'Add from the checklist')) + '</button></div>' + addLineForm(p, 'req') +
      '<h3 class="fdv-h">' + esc(k('ui.dc-the-project', 'The project')) + '</h3>' + (redit ? '<form class="dc-pform" data-dredit>' + '<label><span>' + esc(k('ui.dc-project', 'Project')) + '</span><input name="name" maxlength="120" required value="' + esc(p.name) + '"></label><label><span>' + esc(k('ui.dc-project-no', 'Project no.')) + '</span><input name="no" maxlength="40" value="' + esc(p.no || '') + '"></label>' + siteFields(p) +
        '<div class="dc-facts"><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> ' + esc(k('ui.save', 'Save')) + '</button><button type="button" class="text-btn" data-dreditx>' + esc(k('ui.cancel', 'Cancel')) + '</button></div></form>' :
        '<table class="fdv-kv">' + [[k('ui.dc-project-no', 'Project no.'), p.no]].concat(siteRows(p)).filter(function (r) { return r[1]; }).map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td data-noi18n>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table><div class="fdv-acts"><button type="button" class="pill-btn" data-dredit><i class="bi bi-pencil"></i> ' + esc(k('ui.edit', 'Edit')) + '</button></div>') +
      '<div class="fdv-acts"><button type="button" class="text-btn" data-drreset><i class="bi bi-arrow-counterclockwise"></i> ' + esc(k('ui.dr-reset', 'Reset the list')) + '</button><button type="button" class="text-btn dc-del" data-drdel="' + esc(p.id) + '"><i class="bi bi-trash3"></i> ' + esc(k('ui.dr-delete', 'Delete the requirements')) + '</button></div>';
    return h + '</div></div>';
  }
  function kravReport(p) {
    var me = profile(), L = p.lines || [];
    var h = '<header class="rp-head"><div><p class="rp-kick">' + esc(k('ui.doc-req', 'Document requirements')) + (p.type ? ' · ' + esc(p.type) : '') + '</p><h1>' + esc(p.name) + '</h1></div></header>' +
      '<table class="rp-cvt">' + [[k('ui.dc-project-no', 'Project no.'), p.no]].concat(siteRows(p), [[k('ui.date', 'Date'), fmt(today())], [k('ui.dr-by', 'Made by'), [me.name, me.role].filter(Boolean).join(', ')], [k('ui.dc-documents', 'Documents'), String(L.length)]]).filter(function (r) { return r[1]; }).map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>' +
      '<p>' + esc(k('ui.dr-intro', 'The documentation to be delivered for FDV (forvaltning, drift og vedlikehold), with the document types of NS 3456 for each system after NS 3451. Name each file with the 3-digit code, a document code and a describing text.')) + '</p>';
    h += byGroup(L).map(function (g) {
      return '<h2>' + esc(g[0] + ' ' + (grpName(g[0]) || '')) + '</h2><table class="rp-grid dc-rt dr-rt"><thead><tr><th>' + esc(k('ui.dc-type', 'Document type')) + '</th><th>' + esc(k('ui.dc-should-contain', 'Should contain')) + '</th></tr></thead><tbody>' +
        byCode(g[1]).map(function (c) { return '<tr class="dr-crow"><td colspan="2"><b>' + esc(c[0]) + '</b> ' + esc(c[1]) + '</td></tr>' + c[2].map(function (l) { return '<tr><td>' + esc(typeLabel(l) || k('ui.dc-documentation', 'Documentation')) + '</td><td>' + esc(hintText(l)).replace(/\n/g, '<br>') + (l.opt ? ' <i>' + esc(k('ui.dc-if-contract', 'Only if it is in the contract')) + '</i>' : '') + '</td></tr>'; }).join(''); }).join('') + '</tbody></table>';
    }).join('');
    return h;
  }
  /* a small .xlsx (stored zip, inline strings): the same columns as a document plan, so it reads back in Document control */
  var CRCT = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRCT[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zipStore(files) {
    var enc = new TextEncoder(), parts = [], cen = [], off = 0;
    files.forEach(function (f) {
      var nm = enc.encode(f[0]), d = enc.encode(f[1]), c = crc(d), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint32(14, c, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(h.buffer), nm, d);
      var e = new DataView(new ArrayBuffer(46)); e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true); e.setUint16(8, 0x800, true); e.setUint32(16, c, true); e.setUint32(20, d.length, true); e.setUint32(24, d.length, true); e.setUint16(28, nm.length, true); e.setUint32(42, off, true);
      cen.push(new Uint8Array(e.buffer), nm); off += 30 + nm.length + d.length;
    });
    var cs = cen.reduce(function (a, x) { return a + x.length; }, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cs, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [new Uint8Array(end.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function xmlEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''); }
  function kravXlsx(p) {
    var rows = [[p.name + (p.no ? ' – ' + p.no : '')]].concat(SITE.filter(function (q) { return p[q[0]]; }).map(function (q) { return [{ bid: 'Bygningsnummer', bname: 'Bygningsnavn', pname: 'Eiendomsnavn', pid: 'Eiendomsnummer' }[q[0]], p[q[0]]]; }), [['Anleggsnummer', 'Anleggsnavn', 'Brannbok', 'Dokumenttype', 'Skal inneholde', 'Planlagt navngivning', 'Kommentar']]);
    var hdr = rows.length - 1, FIRE = /^(225|23[1-3]|244|263|291|33\d|443|542|546|733)$/;
    (p.lines || []).slice().sort(lineOrder).forEach(function (l) { rows.push([l.code, lineTitle(l), FIRE.test(String(l.code).slice(0, 3)) ? 'Ja' : 'Nei', l.t ? l.t.split('').map(function (x) { return TYPES.filter(function (y) { return y[0] === x; })[0][1]; }).join(', ') : l.type, (l.name ? l.name + (l.hint ? ': ' : '') : '') + hintText(l), '', l.opt ? 'Hvis kontraktsfestet' : '']); });
    var col = function (i) { return String.fromCharCode(65 + i); };
    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="2" width="38" customWidth="1"/><col min="3" max="3" width="10" customWidth="1"/><col min="4" max="4" width="22" customWidth="1"/><col min="5" max="5" width="60" customWidth="1"/><col min="6" max="6" width="38" customWidth="1"/><col min="7" max="7" width="30" customWidth="1"/></cols><sheetData>' +
      rows.map(function (r, i) { return '<row r="' + (i + 1) + '">' + r.map(function (v, j) { return v === '' ? '' : '<c r="' + col(j) + (i + 1) + '" t="inlineStr"' + (i === 0 || i === hdr ? ' s="1"' : '') + '><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>'; }).join('') + '</row>'; }).join('') + '</sheetData></worksheet>';
    return zipStore([
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Dokumentkrav" sheetId="1" r:id="rId1"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>'],
      ['xl/worksheets/sheet1.xml', sheet]]);
  }
  function fileName(p, what, ext) { return ([p.no, what, p.name].filter(Boolean).join(' ')).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() + ext; }

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
    /* Send to Team (work.jplundberg.com): the project as a file you import there – the plan, statuses and comments, never
       the files themselves (they stay on this device). Nothing goes from this dashboard's storage to Team's. */
    var tb = e.target.closest('[data-dcteam]');
    if (tb) {
      var tp = proj(tb.dataset.dcteam); if (!tp) return;
      var cp = JSON.parse(JSON.stringify(tp)); delete cp.files; (cp.lines || []).forEach(function (l) { delete l.files; });
      var tf = new File([JSON.stringify({ team: 'dctl', v: 1, at: new Date().toISOString(), p: cp })], fileName(tp, k('ui.dc-for-team', 'for Team'), '.json'), { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [tf] })) navigator.share({ files: [tf], title: tf.name }).catch(function () {});
      else { var ta = document.createElement('a'); ta.href = URL.createObjectURL(tf); ta.download = tf.name; document.body.appendChild(ta); ta.click(); setTimeout(function () { URL.revokeObjectURL(ta.href); ta.remove(); }, 4000); }
      toast('<i class="bi bi-people"></i> ' + esc(k('ui.dc-sent-team', 'Saved. In Team: Documents → Import from /cmd.')) + ' <a href="https://work.jplundberg.com/#docs">' + esc(k('ui.open-team', 'Open Team')) + '</a>');
      return;
    }
    var b, t = e.target; if (!t.closest || !t.closest('#wkDocCtl, #wkDocReq')) return;
    if (t.closest('[data-drnew]')) { radding = true; draw(); var i0 = document.querySelector('[data-drform] input'); if (i0) i0.focus(); return; }
    if (t.closest('[data-drcancel]')) { radding = false; draw(); return; }
    if ((b = t.closest('[data-dropen]'))) { rgo(b.dataset.dropen); return; }
    if (t.closest('[data-drback]')) { redit = false; rback(); return; }
    if (t.closest('[data-drreset]')) {   /* JP 15:18: start the list again – the project details stay, Undo brings the lines back */
      var kp0 = JSON.parse(JSON.stringify(krav(ropen))); saveP(ropen, function (p) { p.lines = []; p.type = ''; }, 'dckrav'); rpicking = true; ticks = {}; xsel = {}; xoff = {}; lastType = ''; draw(); window.scrollTo(0, 0);
      toast('<i class="bi bi-arrow-counterclockwise"></i> ' + esc(k('ui.dr-reset-done', 'The list is empty – pick the systems again')), function () { var t12 = Fe.tools(); t12.dckrav = (t12.dckrav || []).map(function (x) { return x.id === kp0.id ? kp0 : x; }); Fe.saveTools(t12); rpicking = false; draw(); }); return; }
    if (t.closest('[data-drfill]')) { var nf2 = 0; saveP(ropen, function (p) { var out = []; (p.lines || []).forEach(function (l) { if (!l.t && defTypes(l.code) && !/^1/.test(l.code)) { var nl = linesFor([l.code]); nf2 += nl.length; out = out.concat(nl); } else out.push(l); }); p.lines = out; }, 'dckrav'); toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dr-made', '{n} documents on the list', { n: nf2 }))); draw(); return; }
    if (t.closest('button[data-dredit]')) { redit = true; draw(); return; }
    if (t.closest('[data-dreditx]')) { redit = false; draw(); return; }
    if ((b = t.closest('[data-drldel]'))) { var rl = b.dataset.drldel, kp = JSON.parse(JSON.stringify(krav(ropen))); saveP(ropen, function (p) { p.lines = (p.lines || []).filter(function (x) { return x.id !== rl; }); }, 'dckrav'); draw();
      toast('<i class="bi bi-trash3"></i> ' + esc(k('ui.dc-line-removed', 'Line removed')), function () { var t8 = Fe.tools(); t8.dckrav = (t8.dckrav || []).map(function (x) { return x.id === kp.id ? kp : x; }); Fe.saveTools(t8); draw(); }); return; }
    if ((b = t.closest('[data-drdel]'))) { var did = b.dataset.drdel, allK = JSON.parse(JSON.stringify(Fe.tools().dckrav || [])); var t9 = Fe.tools(); t9.dckrav = (t9.dckrav || []).filter(function (x) { return x.id !== did; }); Fe.saveTools(t9); rback();
      toast('<i class="bi bi-trash3"></i> ' + esc(k('ui.dr-deleted', 'Requirements deleted')), function () { var t10 = Fe.tools(); t10.dckrav = allK; Fe.saveTools(t10); draw(); }); return; }
    if (t.closest('[data-drxlsx]')) { var px = krav(ropen); if (!px) return; var fx = new File([kravXlsx(px)], fileName(px, 'Dokumentkrav', '.xlsx'), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); if (window.FdvPdf && window.FdvPdf.share) window.FdvPdf.share(fx); return; }
    if (t.closest('[data-drstart]')) { var ps = krav(ropen); if (!ps) return; var nid = uid(), tt2 = Fe.tools(), had = (tt2.dctl || []).filter(function (x) { return x && x.krav === ps.id; })[0];
      if (had) {   /* started before: open that one and add what is new in the requirements (JP 13:05 – a second tap made a second project) */
        var add0 = 0; saveP(had.id, function (p) { var hv = {}; (p.lines || []).forEach(function (l) { hv[l.code + '|' + l.t + '|' + (l.name || '')] = 1; }); (ps.lines || []).forEach(function (l, i) { if (!hv[l.code + '|' + l.t + '|' + (l.name || '')]) { add0++; p.lines.push(Object.assign({}, l, { id: uid() + i, st: 'missing', files: [], cmt: '' })); } }); ['bid', 'bname', 'pname', 'pid', 'no'].forEach(function (f) { if (ps[f]) p[f] = ps[f]; }); rematch(p); });
        if (add0) toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dc-plan-read', '{n} documents in the plan', { n: add0 })));
        rpicking = false; if (window.PageTabs && PageTabs.show) PageTabs.show('doc', true); setTab('docs'); go(had.id); return; }
      tt2.dctl = (tt2.dctl || []).concat([{ id: nid, name: ps.name, no: ps.no || '', bid: ps.bid || '', bname: ps.bname || '', pname: ps.pname || '', pid: ps.pid || '', trade: ps.type || '', made: new Date().toISOString(), planName: k('ui.doc-req', 'Document requirements') + ': ' + ps.name, planAt: today(), krav: ps.id,
        lines: (ps.lines || []).map(function (l, i) { return Object.assign({}, l, { id: uid() + i, st: 'missing', files: [], cmt: '' }); }), files: [] }]); Fe.saveTools(tt2);
      rpicking = false; if (window.PageTabs && PageTabs.show) PageTabs.show('doc', true); setTab('docs'); go(nid); return; }
    if ((b = t.closest('[data-drpdf]'))) {
      if (b._pdf) { window.FdvPdf.share(b._pdf); return; }
      var pp = krav(ropen); if (!pp || b.disabled || !window.FdvPdf || !window.FdvPdf.html) return;
      var note0 = document.querySelector('#wkDocReq .fdv-pdfnote'), lb = b.querySelector('span'), me0 = profile();
      b.disabled = true; lb.textContent = k('ui.fdv-making-pdf', 'Making the PDF …');
      window.FdvPdf.html(kravReport(pp), [[me0.name, me0.role].filter(Boolean).join(', '), me0.employer, k('ui.doc-req', 'Document requirements'), pp.no, pp.name].filter(Boolean).join('  ·  '), fileName(pp, k('ui.doc-req', 'Document requirements'), '.pdf')).then(function (file) {
        b.disabled = false; b._pdf = file; lb.textContent = k('ui.fdv-share-pdf', 'Share or save the PDF'); b.querySelector('i').className = 'bi bi-box-arrow-up';
        if (note0) { note0.hidden = false; note0.textContent = k('ui.fdv-pdf-ready', 'Ready: {f} ({n} pages). Tap the button to share it, save it to Files or mail it.', { f: file.name, n: file._pages }); }
        if (!(navigator.canShare && navigator.canShare({ files: [file] }))) window.FdvPdf.share(file);
      }).catch(function () { b.disabled = false; lb.textContent = k('ui.fdv-make-pdf', 'Make PDF'); toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.fdv-pdf-failed', 'The PDF could not be made – check the connection the first time (the PDF tool is fetched once).'))); }); return;
    }
    if (t.closest('[data-dcnew]')) { adding = true; draw(); var i = document.querySelector('.dc-pform input'); if (i) i.focus(); return; }
    if (t.closest('[data-dccancel]')) { adding = false; editing = false; picking = false; if (rpicking && ropen && krav(ropen) && !(krav(ropen).lines || []).length) { rpicking = false; rback(); return; } rpicking = false; draw(); return; }
    if (t.closest('[data-drpick]')) { rpicking = true; ticks = {}; xsel = {}; xoff = {}; draw(); window.scrollTo(0, 0); return; }
    if ((b = t.closest('[data-dcptype]'))) { var ty = allTypes().filter(function (x) { return x.id === b.dataset.dcptype; })[0]; if (!ty) return; lastType = ty.id === 'new' ? '' : ty.name; xsel[ty.id] = true; var CC = pickCodes();
      (ty.codes === '*' ? Object.keys(CC).filter(function (c) { return CC[c].t || !req() || /^1/.test(c); }) : ty.codes.split(' ')).forEach(function (c) { if (CC[c]) ticks[c] = true; }); var y = window.scrollY; draw(); window.scrollTo(0, y); return; }
    if ((b = t.closest('[data-dcmake]')) && b.dataset.dcmake === 'req') {
      var cr = Object.keys(ticks).filter(function (c) { return ticks[c]; }); if (!cr.length && !xtras().length) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-tick-first', 'Tick the systems first – or tap a project type.'))); return; }
      var addr = 0; saveP(ropen, function (p) { var have = {}; (p.lines || []).forEach(function (l) { have[l.code + '|' + l.t] = 1; }); var nl = linesFor(cr).filter(function (l) { return !have[l.code + '|' + l.t]; }); (p.lines || []).forEach(function (l) { if (l.name) have[l.code + '|' + l.name] = 1; });
        xtras().forEach(function (x) { var xl = xLine(x); if (!xoff[xKey(x)] && !have[xl.code + '|' + xl.name]) { have[xl.code + '|' + xl.name] = 1; nl.push(xl); } }); addr = nl.length; p.lines = (p.lines || []).concat(nl); if (lastType && !p.type) p.type = lastType; }, 'dckrav');
      xsel = {}; xoff = {};
      rpicking = false; ticks = {}; toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dr-made', '{n} documents on the list', { n: addr }))); draw(); window.scrollTo(0, 0); return;
    }
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
      var note = document.querySelector('#wkDocCtl .fdv-pdfnote'), lbl = b.querySelector('span'), me = profile();
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
    var t = e.target; if (!t.closest || !t.closest('#wkDocCtl, #wkDocReq')) return;
    if (t.dataset.dcfromkrav && t.value) { var kk = krav(t.value), pid = t.dataset.dcfromkrav; if (!kk) return; var addk = 0;
      saveP(pid, function (p) { var have = {}; (p.lines || []).forEach(function (l) { have[l.code + '|' + l.t] = 1; }); var nl = (kk.lines || []).filter(function (l) { return !have[l.code + '|' + l.t]; }).map(function (l, i) { return Object.assign({}, l, { id: uid() + i, st: 'missing', files: [], cmt: '' }); }); addk = nl.length; p.lines = (p.lines || []).concat(nl); if (!p.planName) { p.planName = k('ui.doc-req', 'Document requirements') + ': ' + kk.name; p.planAt = today(); } p.krav = kk.id; rematch(p); });
      toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dc-plan-read', '{n} documents in the plan', { n: addk }))); draw(); return; }
    if (t.dataset.dcplan && t.files && t.files[0]) { importPlan(t.dataset.dcplan, t.files[0]); t.value = ''; return; }
    if (t.dataset.dcfiles && t.files && t.files.length) { importFiles(t.dataset.dcfiles, [].slice.call(t.files)); t.value = ''; return; }
    if (t.matches('[data-dcreq]') && t.files && t.files[0]) { importReq(t.files[0]); t.value = ''; return; }
    if (t.dataset.dctick) { ticks[t.dataset.dctick] = t.checked; updPick(); return; }
    if (t.dataset.dcxtick) { xoff[t.dataset.dcxtick] = !t.checked; updPick(); return; }
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
    if (f.matches('form[data-dredit]')) { e.preventDefault(); var ev = siteRead(f, { name: f.name.value.trim().slice(0, 120) || 'Project', no: f.no.value.trim().slice(0, 40) }); saveP(ropen, function (p) { Object.assign(p, ev); }, 'dckrav'); redit = false; document.activeElement && document.activeElement.blur && document.activeElement.blur(); draw(); return; }
    if (f.matches('form[data-drform]')) { e.preventDefault(); var rn = f.name.value.trim().slice(0, 120); if (!rn) return; var rid = uid(), t11 = Fe.tools(); xsel = {}; xoff = {}; t11.dckrav = (t11.dckrav || []).concat([siteRead(f, { id: rid, name: rn, no: f.no.value.trim().slice(0, 40), made: new Date().toISOString(), lines: [] })]); Fe.saveTools(t11); radding = false; f.name.blur(); ticks = {}; lastType = ''; rgo(rid); return; }
    if (f.matches('form[data-dctsave]')) { e.preventDefault(); var tn = f.n.value.trim().slice(0, 60), cs = Object.keys(ticks).filter(function (c) { return ticks[c]; }); if (!tn || (!cs.length && !xtras().length)) return; var t7 = Fe.tools(); t7.dctypes = (t7.dctypes || []).concat([{ id: uid(), name: tn, codes: cs.sort(), x: xtras().filter(function (x) { return !xoff[xKey(x)]; }) }]); Fe.saveTools(t7); toast('<i class="bi bi-bookmark-check"></i> ' + esc(k('ui.dc-type-saved', 'Saved as a project type'))); f.n.blur(); draw(); return; }
    if (f.matches('form[data-dcaddl]')) { e.preventDefault(); var code = normCode(f.code.value), tl = f.t.value, nm = f.name.value.trim().slice(0, 160), aid = f.dataset.dcaddl, akey = /^r:/.test(aid) ? 'dckrav' : 'dctl'; aid = aid.replace(/^r:/, ''); if (!code) return;
      saveP(aid, function (p) { var q = req() && req().codes[code.slice(0, 3)]; p.lines = (p.lines || []).concat([{ id: uid(), code: code, sys: nm || (q && q.n) || codeName(code) || '', type: tl ? tl.split('').map(function (x) { return TYPES.filter(function (y) { return y[0] === x; })[0][1]; }).join(', ') : '', t: tl, hint: tl ? tl.split('').map(function (x) { var v = q && q.ex && q.ex[x] || defHint(x); return v ? x + ': ' + v : ''; }).filter(Boolean).join('\n') || undefined : undefined, planned: '', note: '', st: 'missing', files: [], hand: 1 }]); if (akey === 'dctl') rematch(p); }, akey);
      f.reset(); document.activeElement && document.activeElement.blur && document.activeElement.blur(); draw(); return; }
    if (!f.matches('form[data-dcpform]')) return; e.preventDefault();
    var v = siteRead(f, { name: f.name.value.trim().slice(0, 120), no: f.no.value.trim().slice(0, 40), who: f.who.value.trim().slice(0, 120), trade: f.trade.value.trim().slice(0, 80), due: f.due.value });
    if (!v.name) return;
    var id = f.dataset.dcpform;
    if (id) saveP(id, function (p) { Object.assign(p, v); });
    else { var t = Fe.tools(); id = uid(); t.dctl = (t.dctl || []).concat([Object.assign({ id: id, made: new Date().toISOString(), lines: [], files: [] }, v)]); Fe.saveTools(t); }
    adding = false; editing = false; document.activeElement && document.activeElement.blur && document.activeElement.blur();
    if (open !== id) go(id); else draw();
  });
  window.addEventListener('tools:change', function () { var ae = document.activeElement; if (ae && ae.matches && ae.matches('[data-dcq]')) return; draw(); });
  if (window.Vault && window.Vault.onUnlock) window.Vault.onUnlock(function () { setTimeout(draw, 80); });
  window.DocCtl = { parseReq: parseReq, linesFor: linesFor, PTYPES: PTYPES, namesText: namesText, parseName: parseName, parsePlan: parsePlan, readBook: readBook, letters: letters, score: score };
  draw();
})();
