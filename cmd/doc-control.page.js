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
    var stem = String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_¤]+/g, ' ').replace(/\s+/g, ' ').trim(), ext = (String(name).match(/\.([a-z0-9]{2,5})$/i) || ['', ''])[1].toLowerCase();
    var r = { stem: stem, ext: ext, code: '', abbr: '', text: stem, kind: 'doc', issues: [] }, m;
    var pic = /^(jpe?g|png|heic|heif|webp|gif|mp4|mov)$/.test(ext);
    if ((m = String(name).replace(/\.[a-z0-9]{2,5}$/i, '').match(TEG))) {
      r.kind = 'drawing'; r.code = m[4]; r.abbr = 'K'; r.text = m[7] || ''; r.build = m[1]; r.floor = m[2]; r.fag = m[3]; r.dtype = m[5]; r.no = m[6];
      if (/\b(rev|ver|versjon|v)\.?\s*[0-9a-z]{1,3}\b|\bR\d{2}\b|[-_]r\d+$/i.test(r.text)) r.issues.push(['warn', 'version']);
      if (FAG.indexOf(r.fag) < 0) r.issues.push(['warn', 'fag']);
      return r;
    }
    if ((m = stem.match(/^(\d{3})(?:[.,](\d{1,3}))?(?:\s+|-)([A-Za-zÆØÅæøå]{2})(?=\s|-|$)\s*-?\s*(.*)$/))) {
      r.code = m[1] + (m[2] && !/^0+$/.test(m[2]) ? '.' + m[2] : ''); r.abbr = m[3].toUpperCase(); r.text = m[4] || '';
      if (!(r.abbr in ABBR)) r.issues.push(['warn', 'abbr']);
    } else if ((m = stem.match(/^(\d{3})(?:[.,]\d{1,3})?(?:\s+|-|$)(.*)$/))) {
      r.code = m[1]; r.text = m[2] || ''; if (!pic) r.issues.push(['warn', 'noabbr']);
    } else if (/^\d{4,6}-/.test(stem) || (/^\d{3,6}-/.test(stem) && /-[A-Z]-\d{3}-/.test(stem))) { r.kind = 'drawing'; r.why = tegWhy(stem); r.issues.push(['err', 'drawing']); var c = stem.match(/-[A-Z]-?(\d{3})-/) || stem.match(/-(\d{3})-[A-Z]-/); r.code = c ? c[1] : ''; }   /* starts with a building number: a drawing name that breaks the template – say which part (JP 23:13) */
    else if (!pic) r.issues.push(['err', 'nocode']);
    /* no 30-character limit: JP's team doesn't follow BBY's 30 rule (JP 23:30) */
    if (r.kind === 'doc' && !r.text && r.code && !pic) r.issues.push(['warn', 'notext']);
    return r;
  }
  /* BBY's drawing template (Coda 05 Spesifikke krav til tegninger): building-floor-discipline-part-type-number-text */
  var FAG = ['A', 'B', 'C', 'E', 'F', 'I', 'H', 'K', 'T', 'V', 'G', 'L', 'M', 'R', 'W'];
  function tegWhy(stem) {
    var p = String(stem).split('-');
    if (!/^([KUHLT]\d\d|000)$/.test(p[1] || '')) return k('ui.dc-teg-floor', 'floor “{v}” – use K01, U01, H01, L01, T01 or 000', { v: p[1] || '' });
    if (!/^[A-Z]$/.test(p[2] || '')) return k('ui.dc-teg-fag', 'discipline “{v}” – one letter, e.g. A, B, E, V', { v: p[2] || '' });
    if (!/^\d{3}$/.test(p[3] || '')) return k('ui.dc-teg-part', 'building part “{v}” – 3 digits after NS 3451', { v: p[3] || '' });
    if (!/^[BDFOPSTU]$/.test(p[4] || '')) return k('ui.dc-teg-type', 'drawing type “{v}” – B, D, F, O, P, S, T or U', { v: p[4] || '' });
    if (!/^\d\d/.test(p[5] || '')) return k('ui.dc-teg-no', 'number “{v}” – 2 digits', { v: p[5] || '' });
    return '';
  }
  function issueText(q, f) {
    var p = f && f.p || {};
    return { version: k('ui.dc-iss-version', 'An as-built drawing has a version number in the name'), abbr: k('ui.dc-iss-abbr', 'Unknown document code “{a}”', { a: p.abbr }), noabbr: k('ui.dc-iss-noabbr', 'No document code after the system code (e.g. DA, DV, SE)'),
      drawing: k('ui.dc-iss-drawing', 'The drawing name doesn’t follow building-floor-discipline-code-type-number') + (p.why ? ': ' + p.why : ''), fag: k('ui.dc-iss-fag', 'Unknown discipline letter “{a}” in the drawing name', { a: p.fag }), nodwg: k('ui.dc-iss-nodwg', 'The drawing is here as PDF – the DWG is missing'), nopdf: k('ui.dc-iss-nopdf', 'The drawing is here as DWG – the PDF is missing'), notpdf: k('ui.dc-iss-notpdf', 'Not a PDF – documents are delivered as PDF'), nocode: k('ui.dc-iss-nocode', 'Doesn’t start with a 3-digit NS 3451 code'), 
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
    var lines = [], seen = 0, heads = [];
    sheets.forEach(function (sh) {
      var h = findHeader(sh.rows); if (!h) return; seen++;
      var si = heads.length, hrow = sh.rows[h.at] || [], last = 0;
      hrow.forEach(function (c, j) { if (String(c || '').trim()) last = j + 1; });
      var hd = { path: sh.path || '', at: h.at, last: last, w: sh.rows.reduce(function (a, r) { return Math.max(a, (r || []).length); }, last), none: [], nc: {} }; heads.push(hd);
      var M = h.map, last = null;
      for (var i = h.at + 1; i < sh.rows.length; i++) {
        var r = sh.rows[i] || [], g = function (key) { return key in M ? String(r[M[key]] == null ? '' : r[M[key]]).trim() : ''; };
        var code = normCode(g('code')), sys = g('sys'), type = g('type'), planned = g('planned'), note = g('note');
        if (code) { if (last && !last.n) { hd.none.push(last.ri); hd.nc[last.ri] = last.code; } last = { code: code, sys: sys, fire: /^(ja|j|x|yes)$/i.test(g('fire')), resp: g('resp'), ri: i, n: 0 }; }
        else if (!last || sys) continue;   /* a row of its own without a code is a heading or a note */
        if (/^navngivning ref|^dokumentnavnet skal/i.test(planned)) { note = note || ''; planned = ''; }   /* the general naming instruction in the template */
        var L = letters(type);
        if (!type && !planned) continue;
        last.n++;
        lines.push({ id: uid() + lines.length, code: last.code, sys: (code ? sys : last.sys).slice(0, 160), type: type.slice(0, 80), t: L, planned: planned.replace(/^eksempel:\s*/i, '').slice(0, 160), ex: /^eksempel:/i.test(planned) || undefined,
          note: note.slice(0, 400), fire: last.fire || undefined, resp: (g('resp') || last.resp || '').slice(0, 80), due: g('due').slice(0, 10), st: stMap(g('status')) || 'missing', files: [], src: [si, i] });
      }
      if (last && !last.n) { hd.none.push(last.ri); hd.nc[last.ri] = last.code; }   /* a system in the plan with no document type chosen (JP 21:47: those rows stayed white) */
    });
    return { lines: lines, sheets: seen, heads: heads };
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
      out.push({ name: name, method: method, data: u8.subarray(start, start + csize), size: usize, crc: v.getUint32(off - 46 - nl - xl - cl + 16, true) });
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
          return { name: sh.name, path: sh.path, rows: rows };
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
  /* the plan file and your Excel edits: in Team they are shared records (encrypted with the team key), so everyone gets
     the same coloured plan and the same edits (JP 23:46); elsewhere they stay on this device */
  function shared(id) { return HOST && HOST.store && /^(plan|xedit):/.test(id); }
  function putBlob(id, b) { if (shared(id)) return HOST.store.put(id, b); return putBlobLocal(id, b); }
  function getBlob(id) { if (shared(id)) return HOST.store.get(id).then(function (v) { return v || getBlobLocal(id).then(function (b) { if (b) HOST.store.put(id, b); return b; }); }); return getBlobLocal(id); }   /* one imported before sharing: shared now, from the device that has it */
  function delBlob(id) { if (shared(id)) return HOST.store.del(id); return delBlobLocal(id); }
  function putBlobLocal(id, b) { return db().then(function (d) { return new Promise(function (res) { var t = d.transaction('files', 'readwrite'); t.objectStore('files').put(b, id); t.oncomplete = function () { res(true); }; t.onerror = t.onabort = function () { res(false); }; }); }).catch(function () { return false; }); }
  function getBlobLocal(id) { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('files').objectStore('files').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function delBlobLocal(id) { return db().then(function (d) { d.transaction('files', 'readwrite').objectStore('files').delete(id); }).catch(function () {}); }

  /* ---------- statuses ---------- */
  /* ST's hex colours are also the Excel fills (export and reading a status from a cell's colour) – they stay as they are.
     On screen the chips, bars and buttons use the one set of status colours (Phase G): missing and not approved red,
     received yellow, comments orange, approved green, not relevant grey; Team, which lacks the tokens, falls back to the hex. */
  var STC = { missing: 'var(--danger, #b4443c)', recv: 'var(--warn, #b7791f)', ok: 'var(--ok, #2f8a57)', cmt: 'var(--orange, #c4581f)', rej: 'var(--danger, #b4443c)', na: 'var(--slate, #8a94a3)' };
  function stc(s) { var q = st(s); return STC[q[0]] || q[3]; }
  var ST = [['missing', 'ui.dc-st-missing', 'Missing', '#8a94a3', 'circle'], ['recv', 'ui.dc-st-recv', 'Received – to check', '#3b6fb6', 'inbox'], ['ok', 'ui.dc-st-ok', 'Approved', '#2f8a57', 'check-circle'],
    ['cmt', 'ui.dc-st-cmt', 'Approved with comments', '#b7791f', 'chat-square-text'], ['rej', 'ui.dc-st-rej', 'Not approved – send back', '#b4443c', 'x-circle'], ['na', 'ui.dc-st-na', 'Not relevant', '#a0a7b1', 'dash-circle']];
  function st(s) { return ST.filter(function (q) { return q[0] === s; })[0] || ST[0]; }
  function stName(s) { var q = st(s); return k(q[1], q[2]); }
  /* deadline and responsible per line (JP 2026-11-15): the row says "Frist 1. des. · Rørlegger"; past the deadline and not
     approved (missing, received, not approved) the deadline is red. Saved on the line (due: 'YYYY-MM-DD', who: text). */
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function overdue(l) { return !!(l.due && l.due < ymd(new Date()) && ['missing', 'recv', 'rej'].indexOf(l.st || 'missing') > -1); }
  function dueWho(l) {
    if (!l.due && !l.who) return '';
    var d = l.due ? new Date(l.due + 'T12:00:00') : null, dt = d && !isNaN(d) ? d.toLocaleDateString(k('ui.dc-loc', 'en-GB'), { day: 'numeric', month: 'short' }) : '';
    return '<small class="dc-dwl">' + (dt ? '<span class="' + (overdue(l) ? 'dc-late' : '') + '">' + esc(k(overdue(l) ? 'ui.dc-due-late' : 'ui.dc-due-on', overdue(l) ? 'Overdue {d}' : 'Deadline {d}', { d: dt })) + '</span>' : '') + (dt && l.who ? ' · ' : '') + (l.who ? '<span data-noi18n>' + esc(l.who) + '</span>' : '') + '</small>';
  }
  function chip(s) { var q = st(s); return '<span class="dc-st" style="--c:' + stc(s) + '"><i class="bi bi-' + q[4] + '"></i> ' + esc(stName(s)) + '</span>'; }
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
  function go(id) { open = id; openLine = null; editing = false; ropen = null; if (hashId() !== id) history.pushState({ dc: id, from: hashId() || rHash() ? 'step' : 'list' }, '', location.pathname + location.search + '#dc=' + id); draw(); window.scrollTo(0, 0); }
  /* "‹ Documentation" always goes to the list (one tab: the step before may be the project's Requirements) – a step back in the
     browser's history only when that is where it leads */
  function home0() { open = null; ropen = null; openLine = null; rpicking = false; editing = false; redit = false; }
  function back() { var prev = history.state && history.state.from; if (hashId() && history.state && history.state.dc && prev === 'list') { history.back(); return; } home0(); history.pushState({ list: 1 }, '', location.pathname + location.search); draw(); window.scrollTo(0, 0); }
  window.addEventListener('popstate', function () { var id = hashId(), r = rHash(); if (id !== open || r !== ropen) { open = id; ropen = r; openLine = null; rpicking = false; if (window.PageTabs && PageTabs.show) { if (r || id) PageTabs.show('doc', true); } draw(); } });
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
      (reqs().length > 1 ? '<label><span>' + esc(k('ui.dc-req-which', 'Client checklist')) + '</span>' + reqPick('name="req"', p.req || '') + '</label>' : '') +
      '<label><span>' + esc(k('ui.dc-contractor', 'Contractor')) + '</span><input name="who" maxlength="120" value="' + esc(p.who || '') + '" placeholder="' + esc(k('ui.dc-contractor-ph', 'Who delivers, e.g. the sprinkler contractor')) + '"></label>' +
      '<label><span>' + esc(k('ui.dc-trade', 'Trade / delivery')) + '</span><input name="trade" maxlength="80" value="' + esc(p.trade || '') + '" placeholder="' + esc(k('ui.dc-trade-ph', 'e.g. Sprinkler, Facade, Windows')) + '"></label>' +
      '<label><span>' + esc(k('ui.dc-due', 'Deadline')) + '</span><input name="due" type="date" value="' + esc(p.due || '') + '"></label>' +
      '<div class="dc-facts"><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> ' + esc(k('ui.save', 'Save')) + '</button><button type="button" class="text-btn" data-dccancel>' + esc(k('ui.cancel', 'Cancel')) + '</button></div></form>';
  }
  /* ---------- one Documentation tab (JP 2026-11-16 15:19): one project list, a project goes Requirements → Received → Report;
     a project is a control project (dctl) with its requirements (dckrav, linked by `krav`), or requirements not started yet.
     Nothing is copied or joined in the data – the list and the steps read both. One-off tools sit on top. ---------- */
  function kravOf(p) { return p && p.krav ? krav(p.krav) : null; }
  function ctlOf(r) { return r ? projects().filter(function (x) { return x && x.krav === r.id; })[0] || null : null; }
  function steps(cur, r, p) {
    var c = p ? counts(p.lines || []) : null, S = [
      ['krav', 1, k('ui.dx-krav', 'Requirements'), r ? k('ui.dc-n-docs', '{n} documents', { n: (r.lines || []).length }) : k('ui.dx-no-krav', 'Started from a plan'), r ? 'data-dxkrav="' + esc(r.id) + '"' : ''],
      ['mot', 2, k('ui.dx-mot', 'Received'), p ? k('ui.dx-recv', '{a} of {b} received', { a: c.all - c.missing, b: c.all }) : k('ui.dx-mot-next', 'When the list is ready'), p ? 'data-dxmot="' + esc(p.id) + '"' : r ? 'data-drstart' : ''],
      ['rap', 3, k('ui.fdv-tab-report', 'Report'), p ? k('ui.dx-appr', '{a} of {b} approved', { a: c.done, b: c.all }) : k('ui.dx-last', 'At the end'), p ? 'data-dxrap="' + esc(p.id) + '"' : '']];
    var at = ['krav', 'mot', 'rap'].indexOf(cur);
    return '<nav class="dx-steps" aria-label="' + esc(k('ui.dx-steps', 'Steps')) + '">' + S.map(function (q, i) {
      var on = q[0] === cur, done = i < at || (i === 0 && !!p);
      return '<button type="button" class="dx-step' + (done ? ' done' : '') + '"' + (on ? ' aria-current="step"' : q[4] ? ' ' + q[4] : ' disabled') + '><b><span class="dx-n">' + (done && !on ? '<i class="bi bi-check2"></i>' : q[1]) + '</span>' + esc(q[2]) + '</b><small>' + esc(q[3]) + '</small></button>';
    }).join('') + '</nav>';
  }
  function rowsAll() {
    var used = {}, out = [];
    projects().forEach(function (p) { if (p.krav) used[p.krav] = 1; out.push({ p: p, r: kravOf(p), at: p.made || '' }); });
    kravs().forEach(function (r) { if (!used[r.id]) out.push({ r: r, at: r.made || '' }); });
    return out.sort(function (a, b) { return b.at < a.at ? -1 : 1; });
  }
  /* ---------- one-off tools (JP 14:39 – "a one time thing"): nothing is saved, everything stays on this device ---------- */
  var xtool = null, fdvRes = null;
  /* Give files the right names (JP 2026-11-16 20:43 – "we had an automatic namer earlier"): the files sit in a project of their own that
     only lives here (`TOOL.p`, never saved), so the file naming – suggestions from the name and the PDF's text, the naming rules for
     documents, photos and drawings – works on them as it does in Received; you download them renamed as a .zip */
  var TOOL = { p: null, blobs: {} };
  /* the tool's own rules, codes and building number stay on this device between visits (localStorage – no files, no names of files) */
  var TKEY = 'dcn.tool';
  function toolKeep() { var p = TOOL.p; try { localStorage.setItem(TKEY, JSON.stringify({ nrules: p.nrules, nuse: p.nuse, ncodes: p.ncodes, bid: p.bid, pid: p.pid, pname: p.pname, no: p.no })); } catch (e) {} }
  function toolP() { if (!TOOL.p) { var st = {}; try { st = JSON.parse(localStorage.getItem(TKEY) || '{}') || {}; } catch (e) {}
    var R = [], seen = {}, C = {}; (st.nrules || []).concat.apply(st.nrules || [], projects().map(function (p) { return p.nrules || []; })).forEach(function (r) { if (r && r.id && !seen[r.id]) { seen[r.id] = 1; R.push(JSON.parse(JSON.stringify(r))); } });
    [st].concat(projects()).forEach(function (p) { Object.keys(p.ncodes || {}).forEach(function (key) { C[key] = C[key] || []; (p.ncodes[key] || []).forEach(function (y) { if (y && y[0] && !C[key].some(function (z) { return z[0] === y[0]; })) C[key].push([y[0], y[1] || '']); }); }); });
    TOOL.p = { id: '__ren', name: '', tool: 1, files: [], lines: [], nrules: R.slice(0, 20), nuse: st.nuse || {}, ncodes: C, bid: st.bid || '', pid: st.pid || '', pname: st.pname || '', no: st.no || '' }; } return TOOL.p; }
  var TAPI = null;
  function toolApi() { if (!TAPI) TAPI = Object.assign({}, DCN_API, { saveP: function (id, fn, key) { if (id === '__ren') { fn(toolP()); toolKeep(); return; } saveP(id, fn, key); }, proj: function (id) { return id === '__ren' ? toolP() : proj(id); },
    getBlob: function (id) { return TOOL.blobs[id] ? Promise.resolve(TOOL.blobs[id]) : getBlob(id); }, cur: function () { return '__ren'; }, removed: function (ids) { (ids || []).forEach(function (id) { delete TOOL.blobs[id]; }); } }); return TAPI; }
  function renOn() { return xtool === 'ren' && !open; }
  /* Duplicates (JP 2026-11-19): only files with exactly the same content (a SHA-256 fingerprint made in the browser) are grouped.
     Nothing is removed by itself and there is no "clean up all": a person looks at each group, may open the files, picks the one to keep
     and presses Remove – or Keep all. Removing only takes them out of this list and the .zip; the files on the computer are untouched. */
  function fingerprint(b) { try { return b.arrayBuffer().then(function (buf) { return crypto.subtle.digest('SHA-256', buf); }).then(function (d) { return [].map.call(new Uint8Array(d).slice(0, 16), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }).catch(function () { return ''; }); } catch (e) { return Promise.resolve(''); } }
  function dupGroups() { var p = toolP(), by = {}; p.files.forEach(function (f) { if (f.h && !(p.dupOk || {})[f.h]) (by[f.h] = by[f.h] || []).push(f); }); return Object.keys(by).filter(function (h) { return by[h].length > 1; }).map(function (h) { return by[h]; }); }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB'; }
  function dupPop(gi) {
    var old = document.querySelector('.dx-dupov'); if (old) old.remove();
    var G = dupGroups(); if (!G.length) return;
    gi = Math.max(0, Math.min(G.length - 1, gi || 0));
    var g = G[gi], keep = g[0].id, ov = document.createElement('div'); ov.className = 'dcn-ov dc-host dx-dupov';
    var close = function () { ov.remove(); document.removeEventListener('keydown', key, true); }, key = function (e) { if (e.key === 'Escape' && document.querySelector('.dx-dupov') && !document.querySelector('.dx-fv')) { e.stopPropagation(); close(); } };
    var render = function () {
      ov.innerHTML = '<div class="dcn-sheet dx-dupsheet" role="dialog" aria-modal="true"><div class="dcn-shead"><b>' + esc(k('ui.dx-dup-t', 'Same content – group {i} of {n}', { i: gi + 1, n: G.length })) + '</b><button type="button" class="icon-btn" data-dupx aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
        '<p class="muted dc-help">' + esc(k('ui.dx-dup-help', 'These files have exactly the same content. Look at them, choose the one to keep, then remove the others from the list. The files on your computer are not touched.')) + '</p>' +
        '<ul class="dx-duplist">' + g.map(function (f) { return '<li><label class="dx-dupk"><input type="radio" name="dupkeep" value="' + esc(f.id) + '"' + (f.id === keep ? ' checked' : '') + '><span><b data-noi18n>' + esc(f.name) + '</b><small>' + esc((f.dir ? f.dir + ' · ' : '') + kb(f.size)) + '</small></span><span class="stt ' + (f.id === keep ? 'stt-ok' : 'stt-soon') + '">' + esc(f.id === keep ? k('ui.dx-dup-keep', 'Keep') : k('ui.dx-dup-out', 'Removed from the list')) + '</span></label><button type="button" class="dc-chip" data-dupview="' + esc(f.id) + '"><i class="bi bi-eye"></i> ' + esc(k('ui.dx-dup-open', 'Open')) + '</button></li>'; }).join('') + '</ul>' +
        '<div class="dx-dupbtns"><button type="button" class="pill-btn" data-duprm><i class="bi bi-trash3"></i> ' + esc(k('ui.dx-dup-rm', 'Remove the other {n}', { n: g.length - 1 })) + '</button><button type="button" class="dc-chip" data-dupok>' + esc(k('ui.dx-dup-ok', 'They are different – keep all')) + '</button>' +
        (G.length > 1 ? '<span class="dx-dupnav"><button type="button" class="icon-btn" data-dupgo="-1" aria-label="' + esc(k('ui.dx-dup-prev', 'Previous group')) + '"' + (gi ? '' : ' disabled') + '><i class="bi bi-chevron-left"></i></button><button type="button" class="icon-btn" data-dupgo="1" aria-label="' + esc(k('ui.dx-dup-next', 'Next group')) + '"' + (gi < G.length - 1 ? '' : ' disabled') + '><i class="bi bi-chevron-right"></i></button></span>' : '') + '</div></div>';
    };
    render();
    var dn = null; ov.addEventListener('pointerdown', function (e) { dn = e.target; });
    ov.addEventListener('change', function (e) { if (e.target.name === 'dupkeep') { keep = e.target.value; render(); } });
    ov.addEventListener('click', function (e) {
      var t = e.target, b;
      if ((t === ov && dn === ov) || t.closest('[data-dupx]')) { close(); return; }
      if ((b = t.closest('[data-dupview]'))) { var f = g.filter(function (x) { return x.id === b.dataset.dupview; })[0], N = naming(); if (f && N && N.view) N.view(TOOL.blobs[f.id], f.name); return; }
      if ((b = t.closest('[data-dupgo]'))) { close(); dupPop(gi + +b.dataset.dupgo); return; }
      if (t.closest('[data-dupok]')) { var p0 = toolP(); (p0.dupOk = p0.dupOk || {})[g[0].h] = 1; close(); draw(); if (dupGroups().length) dupPop(gi); return; }
      if (t.closest('[data-duprm]')) {
        var p = toolP(), out = g.filter(function (x) { return x.id !== keep; }).map(function (x) { return x.id; });
        p.files = p.files.filter(function (x) { return out.indexOf(x.id) < 0; }); out.forEach(function (id) { delete TOOL.blobs[id]; });
        toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dx-dup-done', '{n} removed from the list – {m} files left. The files on your computer are untouched.', { n: out.length, m: p.files.length })));
        close(); draw(); if (dupGroups().length) dupPop(gi); return;
      }
    });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(ov);
  }
  function renPanel() {
    var N = naming(), p = toolP(), F = p.files, ok = 0, moved = 0;
    if (N) F.forEach(function (f) { if (f.orig && f.orig !== f.name) moved++; else if (N.ready(p, f)) ok++; });
    var h = '<section class="dx-panel dx-ren"><div class="dx-ph"><h3 class="fdv-h">' + esc(k('ui.dx-t-ren', 'Give files the right names')) + '</h3><button type="button" class="icon-btn sm" data-dxtool="" aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
      '<p class="muted dc-help">' + esc(k('ui.dx-ren-help2', 'Pick the files or one .zip. Each file gets a suggested NS 3451 code and document type from its name and – for PDFs – its text; the naming rules (documents, photos, drawings) build the new name. Check, fix, then download them renamed. Nothing is saved or sent.')) + '</p>' +
      '<div class="dc-facts"><button type="button" class="pill-btn dc-file" data-dxrenopen><i class="bi bi-files"></i> ' + esc(F.length ? k('ui.dx-ren-more', 'Add more files') : k('ui.dx-ren-pick', 'Pick files or a .zip')) + '</button><input type="file" multiple data-dxrenf hidden>' + (F.length ? '<button type="button" class="dc-chip dx-clr" data-dxrenclr><i class="bi bi-arrow-counterclockwise"></i> ' + esc(k('ui.dx-clear', 'Start again')) + '</button>' : '') + '</div>';
    if (!F.length) return h + '</section>';
    if (!N) return h + '<p class="muted">' + esc(k('ui.dx-ren-loading', 'Loading the file naming …')) + '</p></section>';
    var busy = N.busy(), DG = dupGroups(), dn = DG.reduce(function (a, g) { return a + g.length; }, 0);
    if (DG.length) h += '<div class="dx-dupbar" role="status"><i class="bi bi-files"></i><span>' + esc(k('ui.dx-dup-bar', '{n} files are here more than once (same content) – {g} groups to check', { n: dn, g: DG.length })) + '</span><button type="button" class="pill-btn sm" data-dxdups>' + esc(k('ui.dx-dup-go', 'Check them')) + '</button></div>';
    h += '<div class="dx-rsum"><span>' + (busy ? '<i class="bi bi-hourglass-split"></i> ' + esc(k('ui.dx-ren-reading', 'reading the PDFs …')) : '') + '</span>' +   /* the counts line went (JP 2026-11-19) – the filters below show them */
      '<span class="dx-rbtn">' + (ok ? '<button type="button" class="pill-btn" data-dxrenuse><i class="bi bi-pencil"></i> ' + esc(k('ui.dx-ren-useall', 'Use the new name on {n} ready', { n: ok })) + '</button>' : '') +
      '<button type="button" class="pill-btn dx-pri" data-dxrendl><i class="bi bi-download"></i> <span data-dxrenn>' + esc(F.length === 1 ? k('ui.dx-dl-go1', 'Download the file') : k('ui.dx-ren-dl4', 'Download …')) + '</span></button></span></div>';
    return h + N.files(p, F) + '</section>';
  }
  /* a popup to drop files on, or pick them (JP 2026-11-17 07:50); the panel itself takes dropped files too */
  function renDrop(o) {
    o = o || {};
    if (document.querySelector('.dx-drop')) return;
    var ov = document.createElement('div'); ov.className = 'dcn-ov dc-host dx-drop';
    ov.innerHTML = '<div class="dcn-sheet" role="dialog" aria-modal="true" aria-label="' + esc(o.label || k('ui.dx-t-ren', 'Give files the right names')) + '"><div class="dcn-shead"><b>' + esc(o.title || k('ui.dx-drop-t', 'Add files')) + '</b><button type="button" class="icon-btn" data-dxdx aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
      '<label class="dx-dz"><i class="bi bi-cloud-arrow-up"></i><b>' + esc(o.here || k('ui.dx-drop-here', 'Drop the files or a .zip here')) + '</b><small class="muted">' + esc(k('ui.dx-drop-or', 'or')) + '</small><span class="pill-btn"><i class="bi bi-folder2-open"></i> ' + esc(k('ui.dx-drop-pick', 'Choose files')) + '</span><input type="file" multiple' + (o.accept ? ' accept="' + esc(o.accept) + '"' : '') + ' hidden></label>' +
      '<p class="muted dc-help">' + esc(o.help || k('ui.dx-drop-help', 'PDFs, drawings (.dwg), Office files, photos – or one .zip. Nothing is uploaded; everything stays on this device.')) + '</p></div>';
    var close = function () { ov.remove(); document.removeEventListener('keydown', esc1); document.documentElement.classList.remove('dcn-modal'); };
    var esc1 = function (e) { if (e.key === 'Escape') close(); };
    var take = function (fl) { fl = [].slice.call(fl || []); if (fl.length) { close(); (o.take || renAdd)(fl); } };
    var dn = null; ov.addEventListener('pointerdown', function (e) { dn = e.target; });   /* a press that starts in the box and ends outside it doesn't close it */
    ov.addEventListener('click', function (e) { if ((e.target === ov && dn === ov) || e.target.closest('[data-dxdx]')) close(); });
    ov.addEventListener('change', function (e) { if (e.target.type === 'file') take(e.target.files); });
    ['dragenter', 'dragover'].forEach(function (ev) { ov.addEventListener(ev, function (e) { e.preventDefault(); ov.querySelector('.dx-dz').classList.add('on'); }); });
    ov.addEventListener('dragleave', function (e) { if (!ov.contains(e.relatedTarget)) ov.querySelector('.dx-dz').classList.remove('on'); });
    ov.addEventListener('drop', function (e) { e.preventDefault(); take(e.dataTransfer && e.dataTransfer.files); });
    document.addEventListener('keydown', esc1);
    document.body.appendChild(ov); document.documentElement.classList.add('dcn-modal');
    var bt = ov.querySelector('[data-dxdx]'); if (bt) bt.focus();
  }
  function renAdd(list) {
    var got = [];
    return list.reduce(function (pr, f) { return pr.then(function () {
      if (/\.zip$/i.test(f.name)) return f.arrayBuffer().then(function (buf) { var Z = zipEntries(buf).filter(function (z) { return !/\/$/.test(z.name) && !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)/i.test(z.name) && !/(^|\/)\._/.test(z.name); });
        return Z.reduce(function (p2, z) { return p2.then(function () { var nm = z.name.split('/').pop(); if (!nm || /\.zip$/i.test(nm)) return; return inflate(z).then(function (u) { got.push({ name: nm, size: z.size, blob: new Blob([u]), dir: f.name + (z.name.indexOf('/') > 0 ? ' › ' + z.name.split('/').slice(0, -1).join(' › ') : '') }); }); }); }, Promise.resolve()); })
        .catch(function () { toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.dx-zip-bad', 'Could not read {f}', { f: f.name }))); });
      got.push({ name: f.name, size: f.size, blob: f });
    }); }, Promise.resolve()).then(function () { return Promise.all(got.map(function (g) { return fingerprint(g.blob).then(function (h) { g.h = h; }); })); }).then(function () {
      /* the content decides (JP 2026-11-19): the very same file added again (same name, same content) is skipped; files with the same content but another name stay, marked for a person to check */
      var p = toolP(), have = {}; p.files.forEach(function (f) { have[f.name.toLowerCase() + '|' + (f.h || f.size)] = 1; });
      got.forEach(function (g) { var key = g.name.toLowerCase() + '|' + (g.h || g.size); if (have[key]) return; have[key] = 1; var pn = parseName(g.name), id = uid() + Math.random().toString(36).slice(2, 4);
        TOOL.blobs[id] = g.blob; p.files.push({ id: id, name: g.name.slice(0, 160), size: g.size, h: g.h || '', dir: (g.dir || '').slice(0, 200), p: { code: pn.code, abbr: pn.abbr, text: pn.text.slice(0, 80), stem: pn.stem.slice(0, 120), kind: pn.kind }, iss: pn.issues }); });
      draw(); var N = naming(); if (N) N.suggestAll('__ren').then(function () { draw(); });
    });
  }
  /* what to download, shown before it happens (JP 2026-11-19): all, the selected ones or the finished ones – with the list of names; one file comes as itself, not a .zip */
  function dlPop() {
    var N = naming(), p = toolP(), F = p.files, sel = N && N.picked ? N.picked() : [], mode = sel.length ? 'sel' : 'all';
    var old = document.querySelector('.dx-dlpop'); if (old) old.remove();
    var nn = function (f) { return N ? N.newName(p, f) : f.name; }, isNew = function (f) { return nn(f) !== (f.orig || f.name); };
    var fin = F.filter(function (f) { return N && (N.ready(p, f) || (f.orig && f.orig !== f.name)); });
    var list = function () { return mode === 'sel' ? F.filter(function (f) { return sel.indexOf(f.id) >= 0; }) : mode === 'ready' ? fin : F; };
    var ov = document.createElement('div'); ov.className = 'dcn-ov dc-host dx-dlpop';
    var opt = function (m, label, n) { return n ? '<label class="dx-dlopt' + (mode === m ? ' on' : '') + '"><input type="radio" name="dxdl" value="' + m + '"' + (mode === m ? ' checked' : '') + '> ' + esc(label) + ' (' + n + ')</label>' : ''; };
    var render = function () {
      var L = list(), nw = L.filter(isNew).length, mb = L.reduce(function (a, f) { return a + (f.size || 0); }, 0) / 1048576;
      ov.innerHTML = '<div class="dcn-sheet dx-dlsheet" role="dialog" aria-modal="true" aria-label="' + esc(k('ui.dx-dl-t', 'Download with the new names')) + '"><div class="dcn-shead"><span class="dx-dlh"><b>' + esc(k('ui.dx-dl-t', 'Download with the new names')) + '</b><small class="muted">' + esc(k('ui.dx-dl-one', 'One file comes as the file itself – not a .zip')) + '</small></span><button type="button" class="icon-btn" data-dlx aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
        '<div class="dx-dlopts" role="radiogroup" aria-label="' + esc(k('ui.dx-dl-which', 'Which files')) + '">' + opt('all', k('ui.dx-dl-all', 'All'), F.length) + opt('sel', k('ui.dx-dl-sel', 'Only the selected'), sel.length) + opt('ready', k('ui.dx-dl-ready', 'Only the finished'), fin.length) + '</div>' +
        '<div class="dx-dlsum"><b>' + esc(L.length === 1 ? k('ui.dx-dl-sum1', '1 file') : k('ui.dx-dl-sum', '{n} files in the .zip', { n: L.length })) + '</b>' + (nw ? '<span class="stt stt-ok">' + esc(k('ui.dx-dl-new', '{n} get a new name', { n: nw })) + '</span>' : '') + (L.length - nw ? '<span class="stt stt-soon">' + esc(k('ui.dx-dl-keep', '{n} keep the name they came with', { n: L.length - nw })) + '</span>' : '') + '<span class="spacer"></span><span class="muted">' + esc((mb >= 1 ? mb.toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(mb * 1024)) + ' kB')) + '</span></div>' +
        '<p class="muted dx-dlcap">' + esc(k('ui.dx-dl-what', 'This is downloaded:')) + '</p><ul class="dx-dllist">' + L.slice(0, 400).map(function (f) { var n2 = nn(f), nwf = isNew(f); return '<li><span><b data-noi18n>' + esc(n2) + '</b>' + (nwf ? '<small class="muted" data-noi18n>' + esc(k('ui.dx-dl-was', 'was: {f}', { f: f.orig || f.name })) + '</small>' : '') + '</span><span class="stt ' + (nwf ? 'stt-ok' : 'stt-soon') + '">' + esc(nwf ? k('ui.dx-dl-tnew', 'New name') : k('ui.dx-dl-tkeep', 'Keeps the name')) + '</span></li>'; }).join('') + (L.length > 400 ? '<li class="muted">' + esc(k('ui.dcn-bk-more', 'and {n} more', { n: L.length - 400 })) + '</li>' : '') + '</ul>' +
        '<div class="dcn-b dx-dlbtns"><button type="button" class="dc-chip" data-dlx>' + esc(k('ui.cancel', 'Cancel')) + '</button><button type="button" class="pill-btn" data-dlgo' + (L.length ? '' : ' disabled') + '><i class="bi bi-download"></i> ' + esc(L.length === 1 ? k('ui.dx-dl-go1', 'Download the file') : k('ui.dx-dl-go', 'Download {n} files (.zip)', { n: L.length })) + '</button></div></div>';
    };
    render();
    var close = function () { ov.remove(); document.removeEventListener('keydown', ek, true); document.documentElement.classList.toggle('dcn-modal', !!document.querySelector('.dcn-ov')); };
    var ek = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    var dn = null; ov.addEventListener('pointerdown', function (e) { dn = e.target; });
    ov.addEventListener('change', function (e) { if (e.target.name === 'dxdl') { mode = e.target.value; render(); } });
    ov.addEventListener('click', function (e) {
      var t = e.target; if ((t === ov && dn === ov) || t.closest('[data-dlx]')) { close(); return; }
      var b = t.closest('[data-dlgo]'); if (!b || b.disabled) return; b.disabled = true;
      renDownload(list().map(function (f) { return f.id; })).then(close, function () { b.disabled = false; toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.dx-ren-fail', 'The files could not be packed – try fewer at a time.'))); });
    });
    document.addEventListener('keydown', ek, true);
    document.body.appendChild(ov); document.documentElement.classList.add('dcn-modal');
  }
  function renDownload(only) {
    var N = naming(), p = toolP(), F = only ? p.files.filter(function (f) { return only.indexOf(f.id) >= 0; }) : p.files, used = {};
    return Promise.all(F.map(function (f) { return Promise.resolve(TOOL.blobs[f.id]).then(function (b) { return b ? b.arrayBuffer() : null; }).then(function (buf) { if (!buf) return null; var n = N ? N.newName(p, f) : f.name, base = n, i = 2; while (used[n.toLowerCase()]) n = base.replace(/(\.[^.]+)?$/, ' (' + i++ + ')$1'); used[n.toLowerCase()] = 1; return [n, new Uint8Array(buf)]; }); }))
      .then(function (files) { files = files.filter(Boolean); var one = files.length === 1, blob = one ? new Blob([files[0][1]]) : zipStore(files), f = one ? new File([blob], files[0][0], { type: (F[0] && TOOL.blobs[F[0].id] && TOOL.blobs[F[0].id].type) || 'application/octet-stream' }) : new File([blob], k('ui.dx-ren-zip', 'Renamed files') + ' ' + today() + '.zip', { type: 'application/zip' }); if (window.FdvPdf && window.FdvPdf.share) window.FdvPdf.share(f); else { var a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); } return f; });
  }
  function fdvPanel() {
    var R = fdvRes || [], bad = R.filter(function (x) { return x.iss.length; });
    return '<section class="dx-panel"><div class="dx-ph"><h3 class="fdv-h">' + esc(k('ui.dx-t-fdv', 'Check names from the FDV system')) + '</h3><button type="button" class="icon-btn sm" data-dxtool="" aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
      '<form class="dx-fdvf" data-dxfdv><textarea name="t" rows="5" placeholder="' + esc(k('ui.dx-fdv-ph', 'Paste the document names, one per line (e.g. from Plania)')) + '"></textarea><div class="dc-facts"><button type="submit" class="pill-btn"><i class="bi bi-check2-square"></i> ' + esc(k('ui.dx-fdv-check', 'Check the names')) + '</button><label class="dc-chip dc-file"><i class="bi bi-file-earmark-arrow-up"></i> ' + esc(k('ui.dx-fdv-import', 'Or import a list (.xlsx, .csv)')) + '<input type="file" accept=".xlsx,.xlsm,.csv,.txt" data-dxfdvf hidden></label></div></form>' +
      (fdvRes ? '<p class="dx-sum"><b>' + esc(k('ui.dx-fdv-sum', '{a} of {b} names follow the rules', { a: R.length - bad.length, b: R.length })) + '</b>' + (bad.length ? ' · <button type="button" class="text-btn" data-dxfdvcopy>' + esc(k('ui.dx-fdv-copy', 'Copy the ones to fix')) + '</button>' : '') + '</p><ul class="dx-flist">' + R.slice().sort(function (a, b) { return b.iss.length - a.iss.length; }).map(function (x) {
        return '<li class="' + (x.iss.length ? 'dx-bad' : '') + '"><i class="bi bi-' + (x.iss.length ? 'exclamation-circle' : 'check2') + '"></i><span><b data-noi18n>' + esc(x.n) + '</b>' + (x.iss.length ? '<small>' + esc(x.iss.join(' · ')) + '</small>' : '') + '</span></li>'; }).join('') + '</ul>' : '') + '</section>';
  }
  function fdvCheck(names) { fdvRes = names.map(function (n) { var q = parseName(n); return { n: n, iss: q.issues.map(function (x) { return issueText(x, { p: q }); }) }; }); draw(); }
  /* the one-off tools open in a popup over the list instead of pushing it down – less scrolling (JP 2026-11-17 20:11) */
  function toolPop(h) { return h ? '<div class="dx-tov" data-dxtov><div class="dx-tsheet" role="dialog" aria-modal="true">' + h + '</div></div>' : ''; }
  function home() {
    var moved = !HOST && !!Fe.tools().dcTeamAt, L = rowsAll();
    var body = adding ? projForm(null) : radding ? kravForm() : '';
    if (!adding && !radding) body += '<div class="dx-tools"><button type="button" class="dx-tool" data-dxtool="plan" aria-pressed="' + (xtool === 'plan') + '"><i class="bi bi-clipboard2-check"></i><span><b>' + esc(k('ui.dx-t-plans', 'Document plans')) + '</b><small>' + esc(k('ui.dx-t-plans-s', 'The contractors’ plans checked against the checklist – kept until you delete them')) + '</small></span></button>' +
      '<button type="button" class="dx-tool" data-dxtool="ren" aria-pressed="' + (xtool === 'ren') + '"><i class="bi bi-input-cursor-text"></i><span><b>' + esc(k('ui.dx-t-ren', 'Give files the right names')) + '</b><small>' + esc(k('ui.dx-t-ren-s', 'NS code and document code per file, download them renamed')) + '</small></span></button>' +
      '<button type="button" class="dx-tool" data-dxtool="fdv" aria-pressed="' + (xtool === 'fdv') + '"><i class="bi bi-list-check"></i><span><b>' + esc(k('ui.dx-t-fdv', 'Check names from the FDV system')) + '</b><small>' + esc(k('ui.dx-t-fdv-s', 'Paste or import names and see which break the rules')) + '</small></span></button></div>' + toolPop(xtool === 'ren' ? renPanel() : xtool === 'fdv' ? fdvPanel() : xtool === 'plan' ? planPanel() : '');
    var nmN = {}; L.forEach(function (x) { var nm = String((x.p || x.r).name || '').trim().toLowerCase(); nmN[nm] = (nmN[nm] || 0) + 1; });   /* two with the same name: say which part each is (JP's list, point 13) */
    body += L.length ? '<ul class="kit-list dx-list">' + L.map(function (x) {
      var p = x.p, r = x.r, c = p ? counts(p.lines || []) : null, o = p || r, tag;
      if (!p) tag = ['plan', (r.lines || []).length === 1 ? k('ui.dx-st-krav1', 'Requirements · 1 document') : k('ui.dx-st-krav', 'Requirements · {n} documents', { n: (r.lines || []).length })];
      else if (c.all && c.done === c.all) tag = ['ok', k('ui.dx-st-done', 'Report · all approved')];
      else tag = ['recv', c.all ? k('ui.dx-st-mot', 'Received · {a} of {b}', { a: c.all - c.missing, b: c.all }) : k('ui.dc-no-plan', 'No plan yet')];
      return '<li class="kit-item"><button type="button" class="kit-main" ' + (p ? 'data-dcopen="' + esc(p.id) + '"' : 'data-dropen="' + esc(r.id) + '"') + '><span class="kit-ic" style="--c:' + (p ? '#3b6fb6' : '#2f8a57') + '"><i class="bi bi-' + (p ? 'folder-check' : 'clipboard2-check') + '"></i></span>' +
        '<span class="kit-x"><b data-noi18n>' + esc(o.name) + '</b>' + (nmN[String(o.name || '').trim().toLowerCase()] > 1 ? ' <span class="dx-part">' + esc(p ? k('ui.dx-part-mot', '(received)') : k('ui.dx-part-krav', '(requirements)')) + '</span>' : '') + '<small data-noi18n>' + esc([o.no, siteLine(o), p ? p.trade || (r && r.type) : r.type, p && p.who].filter(Boolean).join(' · ')) + '</small>' +
        '<span class="dc-st" style="--c:' + (tag[0] === 'plan' ? 'var(--violet, #8a63d2)' : stc(tag[0])) + '">' + esc(tag[1]) + '</span></span><i class="bi bi-chevron-right fdv-go"></i></button></li>';
    }).join('') + '</ul>' : (adding || radding ? '' : '<p class="empty kit-empty">' + esc(k('ui.dx-empty', 'One project per building: pick what it should deliver (Requirements), take in what is delivered (Received) and see what is missing (Report).')) + '</p>');
    if (!adding && !radding && reqs().length > 1) body += '<p class="muted dc-help">' + esc(k('ui.dc-chk-with', 'Check a plan against:')) + ' ' + reqPick('data-dcreqpick', (req() || {}).id) + '</p>';
    /* cmd only: Team is the home for team projects and requirements (JP 08:06 / 23:46) – the same cards as before */
    if (!HOST && !adding && !radding) body += moved
      ? '<a class="dc-teamlink" href="https://work.jplundberg.com/#docs" rel="noopener"><i class="bi bi-people"></i><span><b>' + esc(k('ui.dr-in-team', 'Document requirements are in Team now')) + '</b><small>' + esc(k('ui.dr-in-team-s', 'Make and change lists there – the whole team uses the same ones')) + '</small></span><i class="bi bi-box-arrow-up-right"></i></a>' +
        (kravs().length ? '<p class="muted dc-help">' + esc(k('ui.dr-old-copies', 'Your old copies here (not updated):')) + ' <button type="button" class="text-btn" data-drmove>' + esc(k('ui.dr-move-again', 'Make the file for Team again')) + '</button></p>' : '')
      : '<div class="dc-teamlink dr-move"><i class="bi bi-people"></i><span><b>' + esc(k('ui.dr-move-h', 'Use Document requirements in Team')) + '</b><small>' + esc(k('ui.dr-move-s', 'Everyone works on the same lists, client checklists and project types. One file takes all of yours there.')) + '</small></span><button type="button" class="pill-btn" data-drmove>' + esc(k('ui.dr-move', 'Move to Team')) + '</button></div>';
    return '<div class="card-head"><h2><i class="bi bi-folder-check"></i> ' + esc(k('ui.docu', 'Documentation')) + '</h2>' + (adding || radding || !can('newp') ? '' : '<div class="head-actions"><button type="button" class="text-btn" ' + (moved ? 'data-dcnew' : 'data-drnew') + '><i class="bi bi-plus-lg"></i> ' + esc(k('ui.dx-new', 'New project')) + '</button></div>') + '</div>' + body;
  }
  function full(p) {
    var T = [['over', k('ui.dc-tab-over', 'Overview'), 'speedometer2'], ['docs', k('ui.dc-tab-docs', 'Documents'), 'list-check'], ['files', k('ui.dc-tab-files', 'Files'), 'files']];
    if (tab !== 'report' && !T.some(function (t) { return t[0] === tab; })) tab = 'over';
    var c = counts(p.lines || []);
    var head = '<div class="fdv-top"><button type="button" class="fdv-back" data-dcback><i class="bi bi-chevron-left"></i> ' + esc(k('ui.docu', 'Documentation')) + '</button>' +
      '<div class="fdv-title"><h2 data-noi18n>' + esc(p.name) + '</h2><small data-noi18n>' + esc([p.no, siteLine(p), p.trade, p.who].filter(Boolean).join(' · ')) + '</small></div>' + (c.all ? '<b class="dc-pc">' + Math.round(c.done / c.all * 100) + ' %</b>' : '') + '</div>' +
      steps(tab === 'report' ? 'rap' : 'mot', kravOf(p), p) + (tab === 'report' ? '' : '<nav class="fdv-tabs" role="tablist">' + T.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (t[0] === tab) + '" data-dctab="' + t[0] + '"><i class="bi bi-' + t[2] + '"></i> ' + esc(t[1]) + '</button>'; }).join('') + '</nav>');
    var body = tab === 'over' ? over(p) : tab === 'docs' ? docs(p) : tab === 'files' ? files(p) : reportTab(p);
    return '<div class="fdv-page dc-page">' + head + '<div class="fdv-body">' + body + '</div></div>';
  }
  function bar(c) {
    var seg = [['ok', c.ok + c.na], ['cmt', c.cmt], ['recv', c.recv], ['rej', c.rej], ['missing', c.missing]].filter(function (s) { return s[1]; });
    return '<div class="dc-bar" role="img" aria-label="' + esc(seg.map(function (s) { return stName(s[0]) + ' ' + s[1]; }).join(', ')) + '">' + seg.map(function (s) { return '<i style="flex:' + s[1] + ';--c:' + stc(s[0]) + '"></i>'; }).join('') + '</div>';
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
      (can('import', gOf(p, 'dctl')) ? '<label class="pill-btn dc-file"><i class="bi bi-upload"></i> ' + esc(k('ui.dc-files-import', 'Import delivered files')) + '<input type="file" multiple data-dcfiles="' + esc(p.id) + '" hidden></label>' : '') + '</div>';
  }
  function over(p) {
    if (editing) return projForm(p);
    var L = p.lines || [], c = counts(L), F = p.files || [], bad = F.filter(function (f) { return (f.iss || []).length; }).length, loose = F.filter(function (f) { return !f.line; }).length;
    var h = '';
    if (!L.length) h += '<p class="muted dc-help">' + esc(k('ui.dc-plan-help3', 'Import the project’s document plan (Excel – a column for the NS 3451 code and one for the NS 3456 document type or the planned name), or use document requirements you made for the project.')) + '</p>';
    else {
      h += '<div class="kit-tiles dc-tiles">' + [['all', k('ui.dc-documents', 'Documents'), c.all], ['missing', stName('missing'), c.missing], ['recv', k('ui.dc-to-check', 'To check'), c.recv], ['done', k('ui.dc-approved', 'Approved'), c.done], ['rej', k('ui.dc-not-approved', 'Not approved'), c.rej]].map(function (t) {
        return '<button type="button" class="kit-tile dc-tile" data-dcfilt="' + t[0] + '"><span>' + esc(t[1]) + '</span><b>' + nf.format(t[2]) + '</b></button>'; }).join('') + '</div>' + bar(c) +
        '<p class="dc-legend">' + ['ok', 'cmt', 'recv', 'rej', 'missing'].map(function (s) { return '<span><i style="--c:' + stc(s) + '"></i>' + esc(stName(s)) + '</span>'; }).join('') + '</p>';
      h += '<h3 class="fdv-h">' + esc(k('ui.dc-per-group', 'Per NS 3451 group')) + '</h3><div class="dc-groups">' + byGroup(L).map(function (g) {
        var cg = counts(g[1]); return '<button type="button" class="dc-grp" data-dcgrp="' + g[0] + '"><span class="dc-gn"><b>' + esc(g[0]) + '</b> ' + esc(grpName(g[0]) || '') + '</span><span class="dc-gc">' + cg.done + '/' + cg.all + (cg.missing ? ' · <em>' + esc(k('ui.dc-n-missing', '{n} missing', { n: cg.missing })) + '</em>' : '') + '</span>' + bar(cg) + '</button>';
      }).join('') + '</div>';
      var fire = L.filter(function (l) { return l.fire; }); if (fire.length) { var cf = counts(fire); h += '<p class="dc-note"><i class="bi bi-fire"></i> ' + esc(k('ui.dc-firebook', 'Fire book: {d} of {n} approved, {m} missing', { d: cf.done, n: cf.all, m: cf.missing })) + '</p>'; }
      var resp = {}; L.forEach(function (l) { if (l.resp) (resp[l.resp] = resp[l.resp] || []).push(l); });
      if (Object.keys(resp).length > 1) h += '<h3 class="fdv-h">' + esc(k('ui.dc-per-resp', 'Per contractor')) + '</h3><div class="dc-groups">' + Object.keys(resp).sort().map(function (r) { var cr = counts(resp[r]); return '<div class="dc-grp"><span class="dc-gn" data-noi18n>' + esc(r) + '</span><span class="dc-gc">' + cr.done + '/' + cr.all + (cr.missing ? ' · <em>' + esc(k('ui.dc-n-missing', '{n} missing', { n: cr.missing })) + '</em>' : '') + '</span>' + bar(cr) + '</div>'; }).join('') + '</div>';
      if (F.length) h += '<p class="dc-note"><i class="bi bi-files"></i> ' + esc(k('ui.dc-files-sum', '{n} files delivered · {u} not in the plan · {b} with name problems', { n: F.length, u: loose, b: bad })) + '</p>';
      if (p.planName) h += '<p class="muted dc-src">' + esc(k('ui.dc-plan-from', 'Plan: {f}, imported {d}', { f: p.planName, d: fmt(p.planAt) })) + '</p>';
    }
    if (L.length) h += '<div class="fdv-acts dc-xrow"><button type="button" class="pill-btn" data-dcxcol="' + esc(p.id) + '"><i class="bi bi-file-earmark-excel"></i> <span>' + esc(k('ui.dc-x-btn', 'Excel with colours')) + '</span></button></div>';   /* the main way to work with the plan – also here, not only under Report (JP 23:46) */
    h += planBtns(p);
    h += '<h3 class="fdv-h">' + esc(k('ui.dc-the-project', 'The project')) + '</h3><table class="fdv-kv">' + [[k('ui.dc-project-no', 'Project no.'), p.no]].concat(siteRows(p), [[k('ui.dc-contractor', 'Contractor'), p.who], [k('ui.dc-trade', 'Trade / delivery'), p.trade], [k('ui.dc-due', 'Deadline'), fmt(p.due)]]).filter(function (r) { return r[1]; }).map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td data-noi18n>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>' +
      '<div class="fdv-acts"><button type="button" class="pill-btn" data-dcedit><i class="bi bi-pencil"></i> ' + esc(k('ui.edit', 'Edit')) + '</button>' + (HOST ? '' : '<button type="button" class="pill-btn" data-dcteam="' + esc(p.id) + '"><i class="bi bi-people"></i> ' + esc(k('ui.dc-send-team', 'Send to Team')) + '</button>') + (can('delp', gOf(p, 'dctl')) ? '<button type="button" class="text-btn dc-del" data-dcdel="' + esc(p.id) + '"><i class="bi bi-trash3"></i> ' + esc(k('ui.dc-delete', 'Delete project')) + '</button>' : '') + '</div>';
    return h;
  }
  function matchesFilt(l) {
    if (filt === 'all') return true; if (filt === 'done') return l.st === 'ok' || l.st === 'cmt' || l.st === 'na';
    if (/^g\d$/.test(filt)) return String(l.code).charAt(0) === filt.slice(1);
    if (filt === 'fire') return !!l.fire;
    return l.st === filt;
  }
  /* folded NS groups in long lists: the group's heading with its counts; its lines are drawn only when it is open */
  var gopen = {};
  function foldHead(big, key, op, g, sub) {
    var head = esc(g + ' ' + (grpName(g) || ''));
    return big ? '<details class="dc-fold" data-dcg="' + esc(key) + '"' + (op ? ' open' : '') + '><summary class="fdv-h dc-gh">' + head + ' <small class="muted tnum">' + esc(sub) + '</small></summary>' : '<h3 class="fdv-h dc-gh">' + head + '</h3>';
  }
  function foldBar(pre, gs) { var all = gs.every(function (g) { return gopen[pre + ':' + g]; }); return '<div class="dc-foldbar"><button type="button" class="text-btn" data-dcgall="' + esc(pre) + '" data-gs="' + esc(gs.join(' ')) + '" data-on="' + (all ? '' : '1') + '"><i class="bi bi-arrows-' + (all ? 'collapse' : 'expand') + '"></i> ' + esc(all ? k('ui.dc-close-all', 'Close all groups') : k('ui.dc-open-all', 'Open all groups')) + '</button></div>'; }
  function docs(p) {
    var L = p.lines || []; if (!L.length) return '<p class="muted dc-help">' + esc(k('ui.dc-no-plan-yet', 'No document plan yet – import it under Overview.')) + '</p>' + planBtns(p);
    var F = {}; (p.files || []).forEach(function (f) { F[f.id] = f; });
    var c = counts(L), chips = [['all', k('ui.all', 'All'), c.all], ['missing', stName('missing'), c.missing], ['recv', k('ui.dc-to-check', 'To check'), c.recv], ['cmt', k('ui.dc-comments', 'Comments'), c.cmt], ['rej', k('ui.dc-not-approved', 'Not approved'), c.rej], ['done', k('ui.dc-approved', 'Approved'), c.done]];
    if (L.some(function (l) { return l.fire; })) chips.push(['fire', k('ui.dc-fire', 'Fire book'), L.filter(function (l) { return l.fire; }).length]);
    if (/^g\d$/.test(filt)) chips.unshift([filt, filt.slice(1) + ' ' + (grpName(filt.slice(1)) || ''), L.filter(matchesFilt).length]);
    var ql = q.toLowerCase(), shown = L.filter(function (l) { return matchesFilt(l) && (!ql || (l.code + ' ' + l.sys + ' ' + l.type + ' ' + l.planned + ' ' + (l.cmt || '')).toLowerCase().indexOf(ql) >= 0); });
    var h = '<div class="dc-chips" role="tablist">' + chips.map(function (x) { return '<button type="button" class="dc-chip" aria-pressed="' + (x[0] === filt) + '" data-dcfilt="' + x[0] + '">' + esc(x[1]) + ' <b>' + x[2] + '</b></button>'; }).join('') + '</div>' +
      '<div class="dc-selrow"><label class="dc-quick"><input type="checkbox" data-dcquick' + (quick ? ' checked' : '') + '> ' + esc(k('ui.dc-quick', 'Quick check – buttons on every line')) + '</label>' + selBtn('d', p.id) + '</div>' +
      '<input type="search" class="dc-q" data-dcq placeholder="' + esc(k('ui.dc-search', 'Search code, system or name')) + '" value="' + esc(q) + '">';
    if (!shown.length) return h + '<p class="muted dc-help">' + esc(k('ui.dc-none-here', 'Nothing here.')) + '</p>' + addLineForm(p);
    var big = shown.length > 40 && !ql;   /* a long plan opens folded per NS group; only open groups are drawn (JP 13:48 – 800+ lines were one long page) */
    if (big) h += foldBar('c:' + p.id, byGroup(shown).map(function (g) { return g[0]; }));
    h += byGroup(shown).map(function (g) {
      var seen = {}, key = 'c:' + p.id + ':' + g[0], cg = counts(g[1]), op = !big || !!gopen[key] || g[1].some(function (l) { return l.id === openLine; });
      return foldHead(big, key, op, g[0], k('ui.dc-gsum', '{n} documents · {m} missing', { n: cg.all, m: cg.missing })) + (!op ? '' : '<ul class="dc-lines">' + g[1].slice().sort(lineOrder).map(function (l) {
        var sel = selOn('d', p.id);
        var sub = seen[l.code] ? '' : '<li class="dc-csub"><span class="dc-code">' + esc(l.code) + '</span><b data-noi18n>' + esc(lineTitle(l)) + (l.fire ? ' <i class="bi bi-fire dc-fi"></i>' : '') + '</b></li>'; seen[l.code] = 1;
        var fs = (l.files || []).map(function (id) { return F[id]; }).filter(Boolean), isOpen = openLine === l.id;
        if (sel) isOpen = false;
        var h2 = sub + '<li class="dc-line' + (isOpen ? ' open' : '') + (sel ? ' selm' : '') + (sel && SEL.ids[l.id] ? ' picked' : '') + '"><button type="button" class="dc-lmain" ' + (sel ? 'data-dcpick="' + esc(l.id) + '" aria-pressed="' + !!SEL.ids[l.id] + '"' : 'data-dcline="' + esc(l.id) + '" aria-expanded="' + isOpen + '"') + '>' + (sel ? selBox(l.id) : '') + '<span class="dc-code"></span>' +
          '<span class="dc-lx"><b data-noi18n>' + esc(typeLabel(l) || k('ui.dc-documentation', 'Documentation')) + '</b><small data-noi18n>' + esc([l.planned && !l.ex ? l.planned : '', fs.length ? k('ui.dc-n-files', '{n} files', { n: fs.length }) : ''].filter(Boolean).join(' · ')) + '</small>' + dueWho(l) +
          (l.cmt && !isOpen ? '<small class="dc-cmt" data-noi18n>' + esc(l.cmt) + '</small>' : '') + '</span>' + chip(l.st) + '</button>';
        if (quick && !isOpen && !sel) h2 += '<div class="dc-qk">' + [['ok', 'check-lg', 'ui.dc-q-ok', 'Approved'], ['rej', 'x-lg', 'ui.dc-q-rej', 'Not approved'], ['na', 'dash-lg', 'ui.dc-q-na', 'Not relevant']].filter(function (x) { return can(stAct(x[0]), gOf(p, 'dctl')); }).map(function (x) { return '<button type="button" class="dc-qb" style="--c:' + stc(x[0]) + '" aria-pressed="' + (l.st === x[0]) + '" data-dcst="' + esc(l.id) + ':' + x[0] + '" data-dctoggle><i class="bi bi-' + x[1] + '"></i> ' + esc(k(x[2], x[3])) + '</button>'; }).join('') + '</div>';
        if (isOpen) {
          h2 += '<div class="dc-ledit">' + (l.note ? '<p class="muted dc-pnote" data-noi18n>' + esc(l.note) + '</p>' : '') + (l.planned ? '<p class="dc-pnote"><span class="muted">' + esc(l.ex ? k('ui.dc-example-name', 'Example name') : k('ui.dc-planned-name', 'Planned name')) + ':</span> <span data-noi18n>' + esc(l.planned) + '</span></p>' : '') +
            (l.hint ? '<p class="dc-hint"><span class="muted">' + esc(k('ui.dc-should-contain', 'Should contain')) + ':</span> <span data-noi18n>' + esc(l.hint).replace(/\n/g, '<br>') + '</span></p>' : '') + (l.opt ? '<p class="muted dc-pnote">' + esc(k('ui.dc-if-contract', 'Only if it is in the contract')) + '</p>' : '') +
            '<div class="dc-sts">' + ST.filter(function (s) { return s[0] === l.st || can(stAct(s[0]), gOf(p, 'dctl')); }).map(function (s) { return '<button type="button" class="dc-sb" style="--c:' + stc(s[0]) + '" aria-pressed="' + (l.st === s[0]) + '" data-dcst="' + esc(l.id) + ':' + s[0] + '"><i class="bi bi-' + s[4] + '"></i> ' + esc(k(s[1], s[2])) + '</button>'; }).join('') + '</div>' +
            '<div class="dc-dw"><label><span>' + esc(k('ui.dc-due', 'Deadline')) + '</span><input type="date" data-dcdue="' + esc(l.id) + '" value="' + esc(l.due || '') + '"></label><label><span>' + esc(k('ui.dc-who', 'Responsible')) + '</span><input data-dcwho="' + esc(l.id) + '" maxlength="60" value="' + esc(l.who || '') + '" placeholder="' + esc(k('ui.dc-who-ph', 'e.g. the plumber')) + '" autocomplete="off"></label></div>' +
            '<textarea class="dc-ctext" data-dccmt="' + esc(l.id) + '" rows="2" maxlength="1000" placeholder="' + esc(k('ui.dc-comment-ph', 'Comment to the contractor, e.g. Missing the signed declaration')) + '">' + esc(l.cmt || '') + '</textarea>' +
            (fs.length ? '<ul class="dc-flist">' + fs.map(function (f) { return '<li>' + (f.nf ? '<span class="dc-nf"><i class="bi bi-list-ul"></i> <span data-noi18n>' + esc(f.name) + '</span></span>' : '<button type="button" class="text-btn" data-dcview="' + esc(f.id) + '"><i class="bi bi-file-earmark"></i> <span data-noi18n>' + esc(f.name) + '</span></button>') + ((f.iss || []).length ? '<i class="bi bi-exclamation-triangle dc-warn" title="' + esc(f.iss.map(function (x) { return issueText(x, f); }).join('; ')) + '"></i>' : '') + '<button type="button" class="icon-btn sm" data-dcunlink="' + esc(l.id) + ':' + esc(f.id) + '" aria-label="' + esc(k('ui.dc-unlink', 'Not this document')) + '"><i class="bi bi-x-lg"></i></button></li>'; }).join('') + '</ul>' : '') +
            (looseFiles(p).length ? '<select class="dc-link" data-dclink="' + esc(l.id) + '"><option value="">' + esc(k('ui.dc-link-file', 'Link a file that wasn’t matched …')) + '</option>' + looseFiles(p).map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.name) + '</option>'; }).join('') + '</select>' : '') +
            '<div class="dc-lrm"><button type="button" class="text-btn dc-del" data-dcldel="' + esc(l.id) + '"><i class="bi bi-trash3"></i> ' + esc(k('ui.dc-remove-line', 'Remove the line')) + '</button></div></div>';
        }
        return h2 + '</li>';
      }).join('') + '</ul>') + (big ? '</details>' : '');
    }).join('');
    if (selOn('d', p.id)) {
      var g0 = gOf(p, 'dctl'), acts = [['ok', 'check-lg', 'ui.dc-q-ok', 'Approved'], ['rej', 'x-lg', 'ui.dc-q-rej', 'Not approved'], ['na', 'dash-lg', 'ui.dc-q-na', 'Not relevant'], ['missing', 'arrow-counterclockwise', 'ui.dc-sel-reset', 'Not checked']].filter(function (x) { return can(stAct(x[0]), g0); })
        .map(function (x) { return '<button type="button" class="dc-qb" style="--c:' + stc(x[0]) + '" data-dcselst="' + x[0] + '"><i class="bi bi-' + x[1] + '"></i> ' + esc(k(x[2], x[3])) + '</button>'; }).join('') +
        '<label class="dc-seldue"><span>' + esc(k('ui.dc-due', 'Deadline')) + '</span><input type="date" data-dcseldue></label>';
      h += selBar('d', p.id, shown.filter(function (l) { return !big || gopen['c:' + p.id + ':' + String(l.code).charAt(0)]; }).map(function (l) { return l.id; }), acts);
    }
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
    if (!HOST || namingOn()) h += nswitch();
    if (!F.length) return h;
    var rank = function (f) { return !f.line ? 0 : (f.iss || []).length ? 1 : 2; };
    F.sort(function (a, b) { return rank(a) - rank(b) || (a.name < b.name ? -1 : 1); });
    var u = F.filter(function (f) { return !f.line; }).length, bad = F.filter(function (f) { return (f.iss || []).length; }).length;
    h += '<p class="dc-note">' + esc(k('ui.dc-files-sum', '{n} files delivered · {u} not in the plan · {b} with name problems', { n: F.length, u: u, b: bad })) + '</p>';
    if (namingOn()) { var N = naming(); return h + (N ? N.files(p, F) : '<p class="muted">' + esc(k('ui.dcn-loading', 'Loading the new file naming …')) + '</p>'); }
    var fsel = selOn('f', p.id);
    h += '<div class="dc-selrow">' + selBtn('f', p.id) + '</div>';
    h += '<ul class="dc-files">' + F.map(function (f) {
      var l = f.line && lineOf(p, f.line);
      return '<li class="dc-frow' + (!f.line ? ' loose' : '') + (fsel && SEL.ids[f.id] ? ' picked' : '') + '"' + (fsel ? ' data-dcpick="' + esc(f.id) + '"' : '') + '><div class="dc-fh">' + (fsel ? selBox(f.id) : '') + (f.nf ? '<span class="dc-fn dc-nf"><i class="bi bi-list-ul"></i> <span data-noi18n>' + esc(f.name) + '</span></span><small class="muted">' + esc(k('ui.dc-in-fdv', 'In the FDV system')) + '</small>' : '<button type="button" class="text-btn dc-fn" data-dcview="' + esc(f.id) + '"><i class="bi bi-file-earmark"></i> <span data-noi18n>' + esc(f.name) + '</span></button><small class="muted">' + esc(size(f.size || 0)) + '</small>') +
        '<button type="button" class="icon-btn sm" data-dcfdel="' + esc(f.id) + '" aria-label="' + esc(k('ui.delete', 'Delete')) + '"><i class="bi bi-trash3"></i></button></div>' +
        ((f.iss || []).length ? '<ul class="dc-iss">' + f.iss.map(function (x) { return '<li class="' + x[0] + '"><i class="bi bi-' + (x[0] === 'err' ? 'x-octagon' : 'exclamation-triangle') + '"></i> ' + esc(issueText(x, f)) + '</li>'; }).join('') + '</ul>' : '') +
        (l ? '<p class="dc-to"><i class="bi bi-arrow-return-right"></i> <b>' + esc(l.code) + '</b> <span data-noi18n>' + esc(lineTitle(l)) + '</span> · ' + esc(typeLabel(l)) + '</p>' :
          (fsel ? '' : '<select class="dc-link" data-dcflink="' + esc(f.id) + '"><option value="">' + esc(k('ui.dc-not-in-plan', 'Not in the plan – link it to a line …')) + '</option>' + linkOpts(p, f) + '</select>')) + '</li>';
    }).join('') + '</ul>';
    if (fsel) h += selBar('f', p.id, F.map(function (f) { return f.id; }), '<button type="button" class="dc-qb" style="--c:' + stc('rej') + '" data-dcselfdel><i class="bi bi-trash3"></i> ' + esc(k('ui.dc-sel-del-files', 'Remove the files')) + '</button>');
    return h;
  }
  function linkOpts(p, f) {
    var c3 = f.p && f.p.code ? f.p.code.slice(0, 3) : '', L = (p.lines || []).slice().sort(function (a, b) { var x = String(a.code).slice(0, 3) === c3 ? 0 : 1, y = String(b.code).slice(0, 3) === c3 ? 0 : 1; return x - y || (a.code < b.code ? -1 : 1); });
    return L.slice(0, 400).map(function (l) { return '<option value="' + esc(l.id) + '">' + esc(l.code + ' ' + lineTitle(l) + ' · ' + typeLabel(l)) + '</option>'; }).join('');
  }

  /* ---------- file naming (JP 2026-11-16, a test, on only where switched on): cmd/doc-naming.js, loaded the first time ---------- */
  function namingOn() { try { if (/[?&]naming=1\b/.test(location.search)) localStorage.setItem('dash.dcNaming', '1'); return localStorage.getItem('dash.dcNaming') === '1'; } catch (e) { return false; } }
  function nswitch() { return '<label class="dcn-sw"><input type="checkbox" data-dcnon' + (namingOn() ? ' checked' : '') + '> ' + esc(k('ui.dcn-switch', 'New file naming (test, only on this device)')) + '</label>'; }
  var DCN_V = '55fc52490c';   /* stamped by cmd/build.py from doc-naming.js */
  var PAIR = ['nodwg', 'nopdf', 'notpdf'];   /* before DCN_API: the file naming read it as undefined (a drawing that followed its rule threw) */
  var DCN_API = { esc: esc, k: k, toast: toast, uid: uid, saveP: saveP, proj: proj, draw: function () { draw(); }, getBlob: getBlob, lineOf: lineOf, unlink: unlink, bestLine: bestLine, parseName: parseName, pairs: function (p) { pairs(p); }, issueText: issueText,
    linkOpts: linkOpts, codeName: codeName, lineTitle: lineTitle, ABBR: ABBR, TEG: TEG, FAG: FAG, PAIR: PAIR, today: today, pad: pad, LP: LP, HOST: HOST, cur: function () { return open; } };
  var dcnLoading = null;
  function naming() {
    var want = renOn() ? toolApi() : DCN_API;
    if (window.DocNaming) { if (window.DocNaming._api !== want) { window.DocNaming.use(want); window.DocNaming._api = want; } return window.DocNaming; }
    if (!dcnLoading) dcnLoading = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = (HOST ? '/dc/' : '/cmd/') + 'doc-naming.js?v=' + DCN_V; s.onload = res; s.onerror = rej; document.head.appendChild(s); })
      .then(function () { draw(); }, function () { dcnLoading = null; toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.dcn-load', 'The new file naming could not be loaded – check the connection.'))); });
    return null;
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
    var dw = miss.some(function (l) { return l.due || l.who; }), dloc = k('ui.dc-loc', 'en-GB'), dfmt = function (l) { var d = l.due ? new Date(l.due + 'T12:00:00') : null; return d && !isNaN(d) ? d.toLocaleDateString(dloc, { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };   /* deadline and responsible, when any missing line has them */
    h += '<h2>2 ' + esc(k('ui.dc-missing-docs', 'Missing documents')) + '</h2>' + (miss.length ? '<table class="rp-grid dc-rt dr-rt"><thead><tr><th>' + esc(k('ui.dc-type', 'Document type')) + '</th><th>' + esc(k('ui.dc-planned-name', 'Planned name')) + '</th>' + (dw ? '<th>' + esc(k('ui.dc-due', 'Deadline')) + '</th><th>' + esc(k('ui.dc-who', 'Responsible')) + '</th>' : '') + '</tr></thead><tbody>' +
      byCode(miss).map(function (c) { return '<tr class="dr-crow"><td colspan="' + (dw ? 4 : 2) + '"><b>' + esc(c[0]) + '</b> ' + esc(c[1]) + '</td></tr>' + c[2].map(function (l) { return '<tr><td>' + esc(typeLabel(l) || k('ui.dc-documentation', 'Documentation')) + '</td><td>' + esc(l.planned && !l.ex ? l.planned : '') + '</td>' + (dw ? '<td' + (overdue(l) ? ' class="dc-late"' : '') + '>' + esc(dfmt(l)) + '</td><td>' + esc(l.who || '') + '</td>' : '') + '</tr>'; }).join(''); }).join('') + '</tbody></table>' : '<p>' + esc(k('ui.dc-none-missing', 'Nothing is missing.')) + '</p>');
    h += '<h2>3 ' + esc(k('ui.dc-with-comments', 'Not approved and comments')) + '</h2>' + (back.length ? '<table class="rp-grid dc-rt"><thead><tr><th>' + esc(k('ui.dc-code', 'Code')) + '</th><th>' + esc(k('ui.dc-system', 'System')) + '</th><th>' + esc(k('ui.status', 'Status')) + '</th><th>' + esc(k('ui.dc-comment', 'Comment')) + '</th></tr></thead><tbody>' +
      back.map(function (l) { return '<tr><td>' + esc(l.code) + '</td><td>' + esc(lineTitle(l) + ' · ' + typeLabel(l)) + '</td><td>' + esc(stName(l.st)) + '</td><td>' + esc(l.cmt || '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>' + esc(k('ui.dc-none-comments', 'No comments.')) + '</p>');
    h += '<h2>4 ' + esc(k('ui.dc-naming', 'File names')) + '</h2>' + (badF.length || looseF.length ? '<table class="rp-grid dc-rt"><thead><tr><th>' + esc(k('ui.dc-file', 'File')) + '</th><th>' + esc(k('ui.dc-problem', 'Problem')) + '</th></tr></thead><tbody>' +
      badF.concat(looseF.filter(function (f) { return !(f.iss || []).length; })).map(function (f) { return '<tr><td>' + esc(f.name) + '</td><td>' + esc((f.iss || []).map(function (x) { return issueText(x, f); }).concat(f.line ? [] : [k('ui.dc-not-in-plan-short', 'Not in the document plan')]).join('; ')) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>' + esc(k('ui.dc-names-ok', 'All file names follow the rules.')) + '</p>');
    return h;
  }
  function reportTab(p) {
    return '<div class="fdv-rbar"><span class="spacer"></span><button type="button" class="pill-btn ghost" data-dchand="' + esc(p.id) + '"><i class="bi bi-box-seam"></i> <span>' + esc(k('ui.dc-hand-btn', 'Handover package')) + '</span></button><button type="button" class="pill-btn ghost" data-dcxcol="' + esc(p.id) + '"><i class="bi bi-file-earmark-excel"></i> <span>' + esc(k('ui.dc-x-btn', 'Excel with colours')) + '</span></button><button type="button" class="pill-btn" data-dcpdf="' + esc(p.id) + '"><i class="bi bi-file-earmark-pdf"></i> <span>' + esc(k('ui.fdv-make-pdf', 'Make PDF')) + '</span></button></div>' +
      '<p class="fdv-pdfnote muted" hidden></p><article class="rp-doc rp-inline">' + report(p) + '</article>';
  }

  /* a redraw from elsewhere (a sync, another person's change) waits while you are in a field or an open list of a file or a popup –
     it used to close the list you were choosing from (JP 2026-11-17 12:54 "boxes close so fast"); what you do yourself draws at once */
  var drawLater = false;
  function busyField() { var ae = document.activeElement; return !!(ae && /^(SELECT|INPUT|TEXTAREA)$/.test(ae.tagName) && ae.closest('.dcn-ov, .dcn-files, .dcn-rules, .dx-ren') && Date.now() - (window.__dcUser || 0) > 400); }
  document.addEventListener('focusout', function () { if (drawLater) setTimeout(function () { if (drawLater && !busyField()) { drawLater = false; draw(); } }, 60); });
  /* redraws that come by themselves (each saved file, each finished check, a sync) are gathered: at most one every 0.8 s, the last one always
     comes – uploading many files made the page flicker (JP 2026-11-17 13:32); what you do yourself still draws at once */
  var lastDraw = 0, drawT = 0;
  var tovDown = null;
  document.addEventListener('pointerdown', function (e) { tovDown = e.target; }, true);
  document.addEventListener('click', function (e) { var o = e.target; if (o && o.matches && o.matches('[data-dxtov]') && tovDown === o && xtool) { xtool = null; draw(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && xtool && document.querySelector('[data-dxtov]') && !document.querySelector('.dcn-ov, .xv')) { xtool = null; draw(); } });
  ['pointerdown', 'click', 'keydown', 'change', 'input', 'drop'].forEach(function (ev) { document.addEventListener(ev, function () { window.__dcUser = Date.now(); }, true); });
  function draw() {
    var el = document.getElementById('wkDocCtl'); if (!el) return;
    if (busyField()) { drawLater = true; return; }
    var now = Date.now(), mine = now - (window.__dcUser || 0) < 400;
    if (!mine && now - lastDraw < 800) { if (!drawT) drawT = setTimeout(function () { drawT = 0; draw(); }, 800 - (now - lastDraw)); return; }
    if (drawT) { clearTimeout(drawT); drawT = 0; }
    lastDraw = now;
    var ae = document.activeElement; if (ae && (el.contains(ae) || (document.getElementById('wkDocReq') || el).contains(ae)) && ae.matches('textarea[data-dccmt], [data-dcwho], [data-dcdue], .dc-pform input, [data-dredit] input, [data-drform] input, .dc-paste textarea, .dc-tsave input, .dc-addl input, [data-dcpq], .dx-panel input, .dx-panel textarea, .dx-tform input, .dx-send input')) return;   /* never redraw under the finger */
    var p = open && proj(open);
    if (open && !p && document.documentElement.classList.contains('unlocked')) open = null;
    if (p && p.req !== undefined && reqs().some(function (r) { return r.id === p.req; })) curReq = p.req; else if (p) curReq = ''; else { try { curReq = sessionStorage.getItem('dash.dcReq') || ''; } catch (e) {} }   /* an open project is checked against its own checklist */
    var er = document.getElementById('wkDocReq'), rp = !p && ropen && krav(ropen);
    if (ropen && !p && !rp && document.documentElement.classList.contains('unlocked')) ropen = null;
    document.body.classList.toggle('dc-full', !!p);
    document.body.classList.toggle('dr-full', !!rp);
    el.classList.toggle('dc-gone', !!rp && !!er);
    var ts0 = el.querySelector('.dx-tsheet'), tsTop = ts0 ? ts0.scrollTop : 0;
    el.innerHTML = p ? full(p) : rp && er ? '' : home();
    var ts1 = el.querySelector('.dx-tsheet'); if (ts1 && tsTop) ts1.scrollTop = tsTop;   /* a redraw keeps the popup where you were */
    document.documentElement.classList.toggle('dcn-modal', !!ts1 || !!document.querySelector('.dcn-ov'));
    if (window.I18N && I18N.apply) try { I18N.apply(el); } catch (e) {}
    clampHelp(el);
    if (!er) return;
    er.classList.toggle('dc-gone', !rp);
    er.innerHTML = rp ? kravFull(rp) : '';
    if (window.I18N && I18N.apply) try { I18N.apply(er); } catch (e) {}
    clampHelp(er);
  }
  /* help texts: one line until tapped, unless they hold a button or a field (JP 13:48 – too many words) */
  function clampHelp(root) { if (root) root.querySelectorAll('.dc-help').forEach(function (p) { if (!p.querySelector('button, label, select, a, input') && p.textContent.length > 70) p.classList.add('dc-clamp'); }); }
  document.addEventListener('click', function (e) { var p = e.target.closest && e.target.closest('.dc-clamp'); if (p) p.classList.toggle('dc-more'); });

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
  /* client checklists (JP 23:46): dcreq is the first (default), dcreqs any others ({ id, name, at, codes }); a project picks
     one (p.req), Check a plan uses the one picked in the list. */
  var curReq = ''; try { curReq = sessionStorage.getItem('dash.dcReq') || ''; } catch (e) {}
  function reqs() { var t = Fe.tools(), out = []; if (t.dcreq && t.dcreq.codes) out.push(Object.assign({ id: '' }, t.dcreq)); (t.dcreqs || []).forEach(function (r) { if (r && r.codes) out.push(r); }); return out; }
  function req() { var L = reqs(); return L.filter(function (r) { return r.id === curReq; })[0] || L[0] || null; }
  function useReq(id) { curReq = id || ''; try { sessionStorage.setItem('dash.dcReq', curReq); } catch (e) {} }
  function reqPick(attr, sel) { var L = reqs(); if (L.length < 2) return ''; return '<select class="dc-link" ' + attr + '>' + L.map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === sel ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') + '</select>'; }
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
  function importReq(file, add) {
    (/\.xls[xm]$/i.test(file.name) ? file.arrayBuffer().then(readBook) : file.text().then(readCsv)).then(function (sh) {
      var c = parseReq(sh), n = Object.keys(c).length;
      if (!n) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-req-none', 'No codes found – the checklist needs a column with the 3-digit code and columns “A - …” to “L - …” for the document types.'))); return; }
      var t = Fe.tools(), nr = { name: file.name.slice(0, 120), at: today(), codes: c };
      if (add && t.dcreq) { nr.id = uid(); t.dcreqs = (t.dcreqs || []).concat([nr]); useReq(nr.id); }   /* another client's checklist */
      else if (curReq && (t.dcreqs || []).some(function (r) { return r.id === curReq; })) t.dcreqs = t.dcreqs.map(function (r) { return r.id === curReq ? Object.assign(nr, { id: r.id }) : r; });
      else t.dcreq = nr;
      Fe.saveTools(t);
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
    h += r ? '<p class="muted dc-help">' + (reqs().length > 1 ? reqPick('data-dcreqpick', r.id) + ' ' : '') + esc(k('ui.dc-req-from', 'Checklist: {f} ({n} codes)', { f: r.name, n: keys.length })) + (can('rules') ? ' · <label class="text-btn dc-file">' + esc(k('ui.dc-req-replace', 'Replace')) + '<input type="file" accept=".xlsx,.xlsm,.csv" data-dcreq hidden></label> · <label class="text-btn dc-file">' + esc(k('ui.dc-req-add', 'Another client’s checklist')) + '<input type="file" accept=".xlsx,.xlsm,.csv" data-dcreqadd hidden></label>' : '') + '</p>'
      : '<p class="muted dc-help">' + esc(k('ui.dc-req-help', 'Import the client’s checklist once (e.g. Boligbygg’s Vedlegg 2 – which NS 3456 document types each NS 3451 code needs). Without it you get one line per code, without the types.')) + '</p>' + (can('rules') ? '<div class="dc-facts"><label class="pill-btn dc-file"><i class="bi bi-file-earmark-spreadsheet"></i> ' + esc(k('ui.dc-req-import', 'Import checklist')) + '<input type="file" accept=".xlsx,.xlsm,.csv" data-dcreq hidden></label></div>' : '');
    h += '<div class="dc-psum" data-dcpsum>' + sumHtml() + '</div>';
    h += '<input type="search" class="dc-q" data-dcpq placeholder="' + esc(k('ui.dc-search-types', 'Search a project type, code or system')) + '">';
    h += '<h3 class="fdv-h">' + esc(k('ui.dc-ptype', 'Project type')) + '</h3><div class="dc-ptg">' + typeGroups().map(function (g) {
      return '<div class="dc-ptrow" data-dcptg><span class="dc-ptl">' + esc(g[0]) + '</span><div class="dc-chips dc-wrap">' + g[1].map(function (t) { return tpen && t.own ? '<button type="button" class="dc-chip dx-tedit" data-dctedit="' + esc(t.id) + '"><i class="bi bi-pencil"></i> ' + esc(t.name) + '</button>' : '<button type="button" class="dc-chip" aria-pressed="' + !!xsel[t.id] + '" data-dcptype="' + esc(t.id) + '">' + esc(t.name) + (t.own ? ' <i class="bi bi-person"></i>' : '') + '</button>'; }).join('') + '</div></div>';
    }).join('') + '</div>';
    if (canAdmin()) h += '<div class="dx-trow"><button type="button" class="dc-chip dx-tnew" data-dctnew><i class="bi bi-plus-lg"></i> ' + esc(k('ui.dx-type-new-b', 'New type')) + '</button>' + (ownTypes().length ? '<button type="button" class="dc-chip dx-pen" aria-pressed="' + tpen + '" data-dctpen title="' + esc(k('ui.dx-type-pen', 'Change your own types')) + '"><i class="bi bi-pencil"></i> ' + esc(tpen ? k('ui.dx-done', 'Done') : k('ui.dx-own-types', 'Your own types')) + '</button>' : '') + '</div>';
    if (tform) h += typeForm();
    h += '<div data-dcxs>' + xsHtml() + '</div>';
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
    if (canAdmin()) h += '<form class="dc-tsave" data-dctsave><input name="n" maxlength="60" placeholder="' + esc(k('ui.dc-type-name', 'Save the ticks as a type, e.g. Bathroom, small')) + '"><button type="submit" class="text-btn"><i class="bi bi-bookmark-plus"></i> ' + esc(k('ui.save', 'Save')) + '</button></form>';
    return h + '</div>';
  }
  /* the project types in groups, so 35 equal chips read as six short rows (JP 13:32 – heavy to use) */
  var TGRP = [['whole', 'ui.dc-tg-whole', 'Whole building', 'new one'], ['rooms', 'ui.dc-tg-rooms', 'Rooms and interior', 'bath kitchen pods inner floor fixed'], ['body', 'ui.dc-tg-body', 'Building envelope and structure', 'facade windows roof balcony stairs structure ground'],
    ['fire', 'ui.dc-tg-fire', 'Fire and security', 'fire sprinkler firealarm security'], ['hvac', 'ui.dc-tg-hvac', 'Plumbing, heating and ventilation', 'plumbing heating vent cooling gas'], ['el', 'ui.dc-tg-el', 'Electrical and automation', 'el light ev solar reserve tele bms'], ['other', 'ui.dc-tg-other', 'Lifts, waste and outdoors', 'lift waste outdoor outva']];
  function typeGroups() {
    var T = allTypes(), used = {}, out = TGRP.map(function (g) { var L = g[3].split(' ').map(function (id) { return T.filter(function (t) { return t.id === id; })[0]; }).filter(Boolean); L.forEach(function (t) { used[t.id] = 1; }); return [k(g[1], g[2]), L]; }).filter(function (g) { return g[1].length; });
    var rest = T.filter(function (t) { return !used[t.id]; }); if (rest.length) out.push([k('ui.dc-tg-own', 'Your own and others'), rest]);
    return out;
  }
  /* what is picked, in one line – each type with an × */
  function sumHtml() {
    var on = allTypes().filter(function (t) { return xsel[t.id]; });
    return on.length ? '<span class="muted">' + esc(k('ui.dc-picked', 'Picked:')) + '</span> ' + on.map(function (t) { return '<button type="button" class="dc-chip dc-on" data-dcptype="' + esc(t.id) + '" aria-label="' + esc(k('ui.dc-unpick', 'Remove {t}', { t: t.name })) + '">' + esc(t.name) + ' <i class="bi bi-x"></i></button>'; }).join('') + ' <span class="dc-pc" data-dcpcount2>' + pickCount() + '</span>'
      : '<span class="muted">' + esc(k('ui.dc-ptype-help', 'A type ticks its systems – then tick more or untick what the project doesn’t have.')) + '</span>';
  }
  function xsHtml() {
    var XS = xtras(); if (!XS.length) return '';
    return '<h3 class="fdv-h">' + esc(k('ui.dc-specific', 'Specific to this kind of project')) + '</h3><p class="muted dc-help">' + esc(k('ui.dc-specific-help', 'Documents the project needs besides the NS 3456 types – untick what doesn’t apply.')) + '</p><ul class="dc-xs">' + XS.map(function (x) {
      return '<li><label><input type="checkbox" data-dcxtick="' + esc(xKey(x)) + '"' + (xoff[xKey(x)] ? '' : ' checked') + '><span><b>' + esc(x[0]) + '</b> ' + esc(I18N.lang === 'nb' ? x[2] : x[3]) + (x[1] ? ' <small class="dc-lt">' + esc(typeName(x[1])) + '</small>' : '') + '</span></label></li>'; }).join('') + '</ul>';
  }
  /* a tap on a type changes only what it touches – no redraw of the 700+ boxes (250–380 ms a tap on JP's PC before) */
  function pickSync() {
    var root = document.querySelector('.dc-pick'); if (!root) { draw(); return; }
    root.querySelectorAll('.dc-ptg [data-dcptype]').forEach(function (b) { b.setAttribute('aria-pressed', String(!!xsel[b.dataset.dcptype])); });
    root.querySelectorAll('[data-dctick]').forEach(function (i) { var on = !!ticks[i.dataset.dctick]; if (i.checked !== on) i.checked = on; });
    root.querySelectorAll('details.dc-pg').forEach(function (d) { var on = !!d.querySelector('[data-dctick]:checked'); if (d.open !== on) d.open = on; });   /* open what has ticks, close what has none (JP 14:30 – a type taken off left its groups open) */
    var xs = root.querySelector('[data-dcxs]'); if (xs) xs.innerHTML = xsHtml();
    var sm = root.querySelector('[data-dcpsum]'); if (sm) sm.innerHTML = sumHtml();
    updPick();
  }
  function pickCount() {
    var cs = Object.keys(ticks).filter(function (c) { return ticks[c]; }), n = linesFor(cs).length + xtras().filter(function (x) { return !xoff[xKey(x)]; }).length;
    return esc(k('ui.dc-pick-count', '{c} systems · {n} documents', { c: cs.length, n: n }));
  }
  function updPick() {
    var el = document.querySelector('[data-dcpcount]'), el2 = document.querySelector('[data-dcpcount2]'); if (el) el.innerHTML = pickCount(); if (el2) el2.innerHTML = pickCount();
    document.querySelectorAll('[data-dcpn]').forEach(function (s) { var g = s.dataset.dcpn, n = Object.keys(ticks).filter(function (c) { return ticks[c] && c.slice(0, 2) === g; }).length; s.textContent = n || ''; });
  }

  /* ---------- Document requirements (Dokumentkrav, JP 2026-11-14): at the start of a project – which documentation it should
     have (NS 3456 types per NS 3451 system, from the client's checklist), shared as PDF or Excel (laid out like a document
     plan, so the contractor's filled-in copy imports straight into Document control), and "Start document control" copies it
     over. Kept in dash.tools.dckrav. ---------- */
  var ropen = null, rpicking = false, radding = false, redit = false;
  /* the Requirements step as approved in the preview (JP 15:03–15:19): the list is calm until the pen ✎ is on; "Send to the
     contractor" makes the PDF / the Excel here and remembers what was sent, so a change afterwards shows; own project types get
     "+ New type" and a pen – admin only in Team */
  var rpen = false, rsend = false, tpen = false, tform = null, kpdf = null;
  /* Tick several (2026-11-21, JP): a "Select" button on Received's Documents and Files and on the Requirements list;
     ticked rows get one bar with what can be done to all of them at once. Only this screen's memory – nothing saved. */
  var SEL = { k: '', ids: {} };
  function selOn(kind, pid) { return SEL.k === kind + ':' + pid; }
  function selN() { return Object.keys(SEL.ids).length; }
  function selIds() { return Object.keys(SEL.ids); }
  function selBtn(kind, pid) { var on = selOn(kind, pid); return '<button type="button" class="text-btn dc-selbtn" aria-pressed="' + on + '" data-dcsel="' + kind + ':' + esc(pid) + '"><i class="bi bi-' + (on ? 'x-lg' : 'check2-square') + '"></i> ' + esc(on ? k('ui.dc-sel-done', 'Done selecting') : k('ui.dc-sel', 'Select several')) + '</button>'; }
  function selBox(id) { var on = !!SEL.ids[id]; return '<span class="dc-ck" role="checkbox" aria-checked="' + on + '" data-dcpick="' + esc(id) + '"><i class="bi bi-check-lg"></i></span>'; }
  function selBar(kind, pid, shown, acts) {
    var n = selN(), all = shown.length && shown.every(function (id) { return SEL.ids[id]; });
    return '<div class="dc-selbar" role="toolbar" aria-label="' + esc(k('ui.dc-sel', 'Select several')) + '"><div class="dc-selh"><b class="tnum">' + esc(k('ui.dc-sel-n', '{n} selected', { n: n })) + '</b>' +
      '<button type="button" class="text-btn" data-dcselall="' + (all ? '' : '1') + '" data-ids="' + esc(shown.join(' ')) + '">' + esc(all ? k('ui.dc-sel-none', 'None') : k('ui.dc-sel-all', 'All shown ({n})', { n: shown.length })) + '</button>' +
      '<button type="button" class="icon-btn sm" data-dcsel="' + kind + ':' + esc(pid) + '" aria-label="' + esc(k('ui.dc-sel-done', 'Done selecting')) + '"><i class="bi bi-x-lg"></i></button></div>' +
      (n ? '<div class="dc-selacts">' + acts + '</div>' : '<p class="muted dc-selhint">' + esc(k('ui.dc-sel-hint', 'Tap the rows you want')) + '</p>') + '</div><div class="dc-selpad" aria-hidden="true"></div>';   /* room so the last rows can scroll up past the bar */
  }
  function blurIn() { var a = document.activeElement; if (a && a.blur && a !== document.body) a.blur(); }
  /* the access matrix (Team, JP 2026-11-16): an action, on a project's group id – cmd is yours alone, so everything */
  function can(a, g) { return !HOST || !HOST.can || HOST.can(a, g); }
  function gOf(p, key) { return p ? (key === 'dctl' && p.krav ? p.krav : p.id) : ''; }
  function stAct(s) { return s === 'ok' || s === 'cmt' || s === 'rej' ? 'approve' : s === 'na' ? 'na' : 'edit'; }
  function canAdmin() { return can('types'); }
  function linesKey(p) { var u = new TextEncoder().encode((p.lines || []).map(function (l) { return l.code + '|' + (l.t || '') + '|' + (l.name || ''); }).sort().join(';')); return crc(u).toString(36); }
  function markSent(id, what) { var to = document.querySelector('form[data-drsendf] [name="to"]'); saveP(id, function (p) { var s0 = p.sent && p.sent.at === today() ? p.sent : {}; var w = (s0.what || '').split(',').filter(Boolean); if (w.indexOf(what) < 0) w.push(what);
    p.sent = { to: (to ? to.value.trim() : (p.sent || {}).to || '').slice(0, 120), at: today(), n: (p.lines || []).length, key: linesKey(p), what: w.join(',') }; }, 'dckrav'); draw(); }
  function sentHtml(p) {
    var s = p.sent; if (!s) return ''; var ch = s.key !== linesKey(p), what = (s.what || '').split(',').filter(Boolean).map(function (w) { return w === 'pdf' ? 'PDF' : 'Excel'; }).join(', ');
    return '<p class="dx-sent' + (ch ? ' dx-ch' : '') + '"><i class="bi bi-' + (ch ? 'exclamation-circle' : 'send-check') + '"></i> ' + esc(ch ? k('ui.dx-sent-ch', 'Changed after it was sent on {d} – send it again so {w} has the latest.', { d: fmt(s.at), w: s.to || k('ui.dx-contractor', 'the contractor') }) : k('ui.dx-sent', 'Sent to {w} on {d} ({x}) · {n} documents', { w: s.to || k('ui.dx-contractor', 'the contractor'), d: fmt(s.at), x: what, n: s.n })) + '</p>';
  }
  function sendForm(p) {
    return '<form class="dc-pform dx-send" data-drsendf><h3 class="fdv-h">' + esc(k('ui.dx-send-h', 'Send the requirements to the contractor')) + '</h3>' +
      '<label><span>' + esc(k('ui.dx-to', 'To')) + '</span><input name="to" maxlength="120" value="' + esc((p.sent || {}).to || '') + '" placeholder="' + esc(k('ui.dc-contractor-ph', 'Who delivers, e.g. the sprinkler contractor')) + '"></label>' +
      '<div class="dc-facts"><button type="button" class="pill-btn" data-drpdf><i class="bi bi-file-earmark-pdf"></i> <span>' + esc(k('ui.dx-send-pdf', 'PDF – the requirements')) + '</span></button>' +
      '<button type="button" class="pill-btn" data-drxlsx><i class="bi bi-file-earmark-spreadsheet"></i> ' + esc(k('ui.dx-send-xlsx', 'Excel – a document plan to fill in')) + '</button>' +
      '<button type="button" class="pill-btn" data-drxbby><i class="bi bi-file-earmark-spreadsheet"></i> ' + esc(k('ui.dx-send-bby', 'Excel – like Boligbygg’s Vedlegg 7')) + '</button></div>' +
      '<p class="fdv-pdfnote muted" hidden></p><p class="muted dc-help">' + esc(k('ui.dx-send-help', 'Made on this device and shared from here (e-mail, Teams …) – nothing is sent from the server. The Excel is laid out like a document plan: the contractor fills in the planned names, and you check it with Check a document plan or import it in Received.')) + '</p>' +
      '<div class="dc-facts"><button type="button" class="text-btn" data-drsendx>' + esc(k('ui.close', 'Close')) + '</button></div></form>';
  }
  /* + New type / a type to change (admin): name, start from, the systems (folded per group) and own documents */
  function typeForm() {
    var F = tform, C = pickCodes(), keys = Object.keys(C).filter(function (c) { return /^\d{3}$/.test(c); }).sort(), g = {}, n = Object.keys(F.codes).length;
    keys.forEach(function (c) { (g[c[0]] = g[c[0]] || []).push(c); });
    var from = '<option value="">' + esc(k('ui.dx-from-empty', 'Empty – I tick them myself')) + '</option>' + allTypes().filter(function (t) { return t.id !== F.id; }).map(function (t) { return '<option value="' + esc(t.id) + '"' + (F.from === t.id ? ' selected' : '') + '>' + esc((t.own ? '★ ' : '') + t.name) + '</option>'; }).join('');
    return '<form class="dc-pform dx-tform" data-dctform><h3 class="fdv-h">' + esc(F.id ? k('ui.dx-type-edit', 'Change the project type') : k('ui.dx-type-new', 'New project type')) + '</h3>' +
      '<label><span>' + esc(k('ui.dx-type-name', 'Name')) + '</span><input name="n" maxlength="60" required value="' + esc(F.name || '') + '" placeholder="' + esc(k('ui.dc-type-name-ph', 'e.g. Bathroom, small')) + '"></label>' +
      '<label><span>' + esc(k('ui.dx-from', 'Start from')) + '</span><select name="from" data-dctfrom>' + from + '</select></label>' +
      '<p class="dx-th"><b>' + esc(k('ui.dx-systems', 'Systems')) + '</b> <span class="muted" data-dctn>' + esc(k('ui.dx-n-picked', '{n} picked', { n: n })) + '</span></p>' +
      Object.keys(g).sort().map(function (m) { var on = g[m].filter(function (c) { return F.codes[c]; }).length;
        return '<details class="dc-pg"' + (on ? ' open' : '') + '><summary><b>' + esc(m) + '</b> ' + esc(grpName(m) || '') + ' <span class="dc-pn">' + (on || '') + '</span></summary><ul>' + g[m].map(function (c) {
          return '<li><label><input type="checkbox" data-dctc="' + c + '"' + (F.codes[c] ? ' checked' : '') + '><span><b>' + c + '</b> <span data-noi18n>' + esc(C[c].n) + '</span>' + (C[c].t ? ' <small class="dc-lt">' + esc(C[c].t.split('').join(' ')) + '</small>' : '') + '</span></label></li>'; }).join('') + '</ul></details>'; }).join('') +
      '<p class="dx-th"><b>' + esc(k('ui.dx-own-docs', 'Own documents')) + '</b> <span class="muted">' + esc(k('ui.dx-own-docs-s', '– what this kind of project always needs besides the NS 3456 types')) + '</span></p>' +
      (F.x.length ? '<ul class="dc-xs">' + F.x.map(function (x, i) { return '<li><span><b>' + esc(x[0]) + '</b> ' + esc(I18N.lang === 'nb' ? x[2] : x[3] || x[2]) + '</span> <button type="button" class="icon-btn sm" data-dctxrm="' + i + '" aria-label="' + esc(k('ui.dc-remove-line', 'Remove the line')) + '"><i class="bi bi-x-lg"></i></button></li>'; }).join('') + '</ul>' : '') +
      '<div class="dx-xadd"><input name="xc" inputmode="numeric" maxlength="4" placeholder="' + esc(k('ui.dc-code', 'Code')) + '" aria-label="' + esc(k('ui.dc-code', 'Code')) + '"><input name="xt" maxlength="80" placeholder="' + esc(k('ui.dx-own-doc-ph', 'e.g. Wet room documentation')) + '" aria-label="' + esc(k('ui.dx-own-doc', 'The document')) + '"><button type="button" class="text-btn" data-dctxadd><i class="bi bi-plus-lg"></i> ' + esc(k('ui.add', 'Add')) + '</button></div>' +
      '<p class="muted dc-help">' + esc(HOST ? k('ui.dx-type-team', 'Saved under your own types and shared with the team. Only admins make and change types. Projects already made from it don’t change.') : k('ui.dx-type-own', 'Saved under your own types. Projects already made from it don’t change.')) + '</p>' +
      '<div class="dc-facts"><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> ' + esc(k('ui.dx-type-save', 'Save the type')) + '</button><button type="button" class="text-btn" data-dctcancel>' + esc(k('ui.cancel', 'Cancel')) + '</button>' +
      (F.id ? '<button type="button" class="text-btn dc-del" data-dctdel="' + esc(F.id) + '"><i class="bi bi-trash3"></i> ' + esc(k('ui.dx-type-del', 'Delete the type')) + '</button>' : '') + '</div></form>';
  }
  function tformFrom(id) { var C = pickCodes(), ty = allTypes().filter(function (t) { return t.id === id; })[0], o = {}; if (ty) (ty.codes === '*' ? Object.keys(C) : String(ty.codes || '').split(/[ ,]+/).concat(Array.isArray(ty.codes) ? ty.codes : [])).forEach(function (c) { if (C[c] && /^\d{3}$/.test(c)) o[c] = 1; }); return { codes: o, x: ty ? (ty.own ? (ty.x || []) : XTRA[id] || []).map(function (x) { return x.slice(); }) : [] }; }
  function tformRead() { var f = document.querySelector('form[data-dctform]'); if (f && tform) tform.name = f.n.value; }
  function rHash() { var m = location.hash.match(/^#dr=([\w-]+)$/); return m ? m[1] : null; }
  ropen = rHash();
  function rgo(id) { ropen = id; open = null; rpen = false; rsend = false; openLine = null; rpicking = false; if (rHash() !== id) history.pushState({ dr: id, from: hashId() || rHash() ? 'step' : 'list' }, '', location.pathname + location.search + '#dr=' + id); draw(); window.scrollTo(0, 0); }
  function rback() { var prev = history.state && history.state.from; if (rHash() && history.state && history.state.dr && prev === 'list') { history.back(); return; } home0(); history.pushState({ list: 1 }, '', location.pathname + location.search); draw(); window.scrollTo(0, 0); }
  function kravs() { return Fe.list('dckrav'); }
  function krav(id) { return kravs().filter(function (x) { return x.id === id; })[0] || null; }
  function kravForm() {
    return '<form class="dc-pform" data-drform><label><span>' + esc(k('ui.dc-project', 'Project')) + '</span><input name="name" maxlength="120" required placeholder="' + esc(k('ui.dc-project-ph', 'e.g. Made-up school, new building')) + '"></label>' +
      '<label><span>' + esc(k('ui.dc-project-no', 'Project no.')) + '</span><input name="no" maxlength="40"></label>' + siteFields(null) +
      '<div class="dc-facts"><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> ' + esc(k('ui.dr-next', 'Next: pick the systems')) + '</button><button type="button" class="text-btn" data-drcancel>' + esc(k('ui.cancel', 'Cancel')) + '</button></div><p class="muted dc-help">' + esc(k('ui.dx-have-plan', 'Already have the contractor\u2019s document plan?')) + ' <button type="button" class="text-btn" data-dcnew>' + esc(k('ui.dx-start-plan', 'Start at Received')) + '</button></p></form>';
  }
  function kravFull(p) {
    var L = p.lines || [], sys = {}; L.forEach(function (l) { sys[l.code] = 1; });
    var h = '<div class="fdv-page dc-page"><div class="fdv-top"><button type="button" class="fdv-back" data-drback><i class="bi bi-chevron-left"></i> ' + esc(k('ui.docu', 'Documentation')) + '</button>' +
      '<div class="fdv-title"><h2 data-noi18n>' + esc(p.name) + '</h2><small data-noi18n>' + esc([p.no, siteLine(p), p.type, L.length ? k('ui.dc-pick-count', '{c} systems · {n} documents', { c: Object.keys(sys).length, n: L.length }) : ''].filter(Boolean).join(' · ')) + '</small></div></div>' + steps('krav', p, ctlOf(p)) + '<div class="fdv-body">';
    if (rpicking || !L.length) return h + picker(p, 'req') + '</div></div>';
    if (L.some(function (l) { return !l.t && defTypes(l.code) && !/^1/.test(l.code); })) h += '<p class="dc-note dr-fillnote"><i class="bi bi-info-circle"></i> ' + esc(k('ui.dr-fill-help', 'Some systems have no document types yet.')) + ' <button type="button" class="text-btn" data-drfill>' + esc(k('ui.dr-fill', 'Fill in the document types')) + '</button></p>';
    h += '<div class="dc-facts">' + (can('send', gOf(p, 'dckrav')) ? '<button type="button" class="pill-btn dx-pri" data-drsend><i class="bi bi-send"></i> ' + esc(p.sent && p.sent.key !== linesKey(p) ? k('ui.dx-send-again', 'Send again') : k('ui.dx-send', 'Send to the contractor')) + '</button>' : '') +
      '<button type="button" class="pill-btn" data-drstart><i class="bi bi-arrow-right"></i> ' + esc(ctlOf(p) ? k('ui.dx-to-mot', 'To Received') : k('ui.dx-start-mot', 'Next: Received')) + '</button></div>';
    h += rsend ? sendForm(p) : '';
    h += sentHtml(p);
    h += '<div class="dx-lh"><h3 class="fdv-h">' + esc(k('ui.dx-the-list', 'The list')) + '</h3>' + (can('edit', gOf(p, 'dckrav')) ? '<button type="button" class="icon-btn sm dx-pen" aria-pressed="' + rpen + '" data-drpen aria-label="' + esc(rpen ? k('ui.dx-pen-done', 'Done changing the list') : k('ui.dx-pen', 'Change the list')) + '" title="' + esc(rpen ? k('ui.dx-pen-done', 'Done changing the list') : k('ui.dx-pen', 'Change the list')) + '"><i class="bi bi-' + (rpen ? 'check2' : 'pencil') + '"></i></button>' : '') + (can('edit', gOf(p, 'dckrav')) ? selBtn('r', p.id) : '') + (rpen ? '<span class="muted dc-help">' + esc(k('ui.dx-pen-help', 'Remove lines or add new ones')) + '</span>' : '') + '</div>';
    var big = L.length > 40;
    if (big) h += foldBar('r:' + p.id, byGroup(L).map(function (g) { return g[0]; }));
    h += byGroup(L).map(function (g) {
      var key = 'r:' + p.id + ':' + g[0], op = !big || !!gopen[key], ns = byCode(g[1]).length;
      return foldHead(big, key, op, g[0], k('ui.dc-gsum2', '{c} systems · {n} documents', { c: ns, n: g[1].length })) + (!op ? '' : '<ul class="dr-syss">' + byCode(g[1]).map(function (c) {
        return '<li class="dr-sys"><div class="dr-sh"><span class="dc-code">' + esc(c[0]) + '</span><b data-noi18n>' + esc(c[1]) + '</b></div><ul class="dr-types">' + c[2].map(function (l) {
          var rs = selOn('r', p.id);
          return '<li class="dr-line' + (rs && SEL.ids[l.id] ? ' picked' : '') + '"' + (rs ? ' data-dcpick="' + esc(l.id) + '"' : '') + '>' + (rs ? selBox(l.id) : '') + '<span class="dc-lx"><b data-noi18n>' + esc(typeLabel(l) || k('ui.dc-documentation', 'Documentation')) + (l.opt ? ' <small>· ' + esc(k('ui.dc-if-contract', 'Only if it is in the contract')) + '</small>' : '') + '</b>' +
            (l.hint ? '<small class="dr-hint" data-noi18n>' + esc(hintText(l)).replace(/\n/g, '<br>') + '</small>' : '') + '</span>' + (rpen && !selOn('r', p.id) ? '<button type="button" class="icon-btn sm" data-drldel="' + esc(l.id) + '" aria-label="' + esc(k('ui.dc-remove-line', 'Remove the line')) + '"><i class="bi bi-x-lg"></i></button>' : '') + '</li>';
        }).join('') + '</ul></li>';
      }).join('') + '</ul>') + (big ? '</details>' : '');
    }).join('');
    if (selOn('r', p.id)) h += selBar('r', p.id, L.filter(function (l) { return !big || gopen['r:' + p.id + ':' + String(l.code).charAt(0)]; }).map(function (l) { return l.id; }),
      '<button type="button" class="dc-qb" style="--c:var(--blue)" data-drselopt><i class="bi bi-file-earmark-text"></i> ' + esc(k('ui.dc-sel-opt', 'Only if in the contract')) + '</button><button type="button" class="dc-qb" style="--c:' + stc('rej') + '" data-drseldel><i class="bi bi-trash3"></i> ' + esc(k('ui.dc-sel-del-lines', 'Remove the lines')) + '</button>');
    h += (rpen ? '<div class="dc-facts"><button type="button" class="pill-btn" data-drpick><i class="bi bi-ui-checks"></i> ' + esc(k('ui.dc-pick-more', 'Add from the checklist')) + '</button></div>' + addLineForm(p, 'req') : '') +
      '<h3 class="fdv-h">' + esc(k('ui.dc-the-project', 'The project')) + '</h3>' + (redit ? '<form class="dc-pform" data-dredit>' + '<label><span>' + esc(k('ui.dc-project', 'Project')) + '</span><input name="name" maxlength="120" required value="' + esc(p.name) + '"></label><label><span>' + esc(k('ui.dc-project-no', 'Project no.')) + '</span><input name="no" maxlength="40" value="' + esc(p.no || '') + '"></label>' + siteFields(p) +
        '<div class="dc-facts"><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> ' + esc(k('ui.save', 'Save')) + '</button><button type="button" class="text-btn" data-dreditx>' + esc(k('ui.cancel', 'Cancel')) + '</button></div></form>' :
        '<table class="fdv-kv">' + [[k('ui.dc-project-no', 'Project no.'), p.no]].concat(siteRows(p)).filter(function (r) { return r[1]; }).map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td data-noi18n>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table><div class="fdv-acts"><button type="button" class="pill-btn" data-dredit><i class="bi bi-pencil"></i> ' + esc(k('ui.edit', 'Edit')) + '</button>' + (HOST ? '' : '<button type="button" class="pill-btn" data-dcteam="r:' + esc(p.id) + '"><i class="bi bi-people"></i> ' + esc(k('ui.dc-send-team', 'Send to Team')) + '</button>') + '</div>') +
      '<div class="fdv-acts"><button type="button" class="text-btn" data-drreset><i class="bi bi-arrow-counterclockwise"></i> ' + esc(k('ui.dr-reset', 'Reset the list')) + '</button>' + (can('delp', gOf(p, 'dckrav')) ? '<button type="button" class="text-btn dc-del" data-drdel="' + esc(p.id) + '"><i class="bi bi-trash3"></i> ' + esc(k('ui.dr-delete', 'Delete the requirements')) + '</button>' : '') + '</div>';
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
  /* The handover package (2026-11-20, plan Part 4): one .zip for the client – every approved file, sorted into a folder
     per NS 3451 code and named by its planned name where the plan has one, the report as a PDF, the plan as Excel with
     colours (delivered vs missing) and a contents list. Made on the device; nothing is uploaded. */
  function safeName(s) { return String(s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120); }
  function handover(btn) {
    var p = proj(btn.dataset.dchand); if (!p || btn.disabled) return;
    var lbl = btn.querySelector('span'), F = {}; (p.files || []).forEach(function (f) { F[f.id] = f; });
    var lines = (p.lines || []).slice().sort(lineOrder), okL = lines.filter(function (l) { return l.st === 'ok' && (l.files || []).some(function (id) { return F[id] && !F[id].nf; }); });
    if (!okL.length) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-hand-none', 'No approved files with a file on this device yet – approve lines first.'))); return; }
    btn.disabled = true; lbl.textContent = k('ui.dc-hand-making', 'Making the package …');
    var out = [], used = {}, listed = [], me = profile();
    var uniq = function (path) { var p0 = path, i = 2; while (used[path.toLowerCase()]) { path = p0.replace(/(\.[^.\/]+)?$/, ' (' + (i++) + ')$1'); } used[path.toLowerCase()] = 1; return path; };
    var jobs = [];
    okL.forEach(function (l) {
      var dir = safeName((l.code || '000') + ' ' + lineTitle(l)) || 'Andre';
      l.files.forEach(function (id, n) {
        var f = F[id]; if (!f || f.nf) return;
        var ext = (f.name.match(/\.[a-z0-9]{1,6}$/i) || [''])[0], base = l.name ? safeName(l.name) + (l.files.length > 1 ? ' ' + (n + 1) : '') + ext : safeName(f.name);
        jobs.push(getBlob(id).then(function (bl) { if (!bl) return; return bl.arrayBuffer().then(function (ab) { var path = uniq(dir + '/' + base); out.push([path, new Uint8Array(ab)]); listed.push(path); }); }).catch(function () {}));
      });
    });
    var nm = safeName([p.no, k('ui.dc-hand', 'Handover'), p.name].filter(Boolean).join(' ')) || 'Handover';
    var foot = [[me.name, me.role].filter(Boolean).join(', '), me.employer, k('ui.doc-control', 'Document control'), p.no, p.name].filter(Boolean).join('  ·  ');
    if (window.FdvPdf && window.FdvPdf.html) jobs.push(window.FdvPdf.html(report(p), foot, nm + '.pdf').then(function (file) { return file.arrayBuffer().then(function (ab) { out.push([uniq(k('ui.dc-hand-report', 'Report') + ' – ' + nm + '.pdf'), new Uint8Array(ab)]); }); }).catch(function () {}));
    jobs.push(planXlsx(p, true).then(function (f) { return f && f.arrayBuffer().then(function (ab) { out.push([uniq(k('ui.dc-hand-plan', 'Document plan') + ' – ' + nm + '.xlsx'), new Uint8Array(ab)]); }); }).catch(function () {}));
    Promise.all(jobs).then(function () {
      var miss = lines.filter(function (l) { return l.st !== 'ok' && l.st !== 'na'; });
      var txt = [nm, siteLine(p), k('ui.dc-hand-date', 'Made') + ': ' + new Date().toLocaleDateString(I18N.lang === 'nb' ? 'nb-NO' : 'en-GB'), [me.name, me.employer].filter(Boolean).join(', '), '',
        k('ui.dc-hand-incl', 'Approved files ({n})', { n: listed.length }) + ':'].concat(listed.sort().map(function (x) { return '  ' + x; }), ['', k('ui.dc-hand-miss', 'Not approved or missing ({n})', { n: miss.length }) + ':'],
        miss.map(function (l) { return '  ' + (l.code || '') + ' ' + (l.name || lineTitle(l)) + ' – ' + stName(l.st); })).join('\r\n');
      out.unshift([k('ui.dc-hand-contents', 'Contents') + '.txt', '﻿' + txt]);
      var z = zipStore(out), file = new File([z], nm + '.zip', { type: 'application/zip' });
      btn.disabled = false; lbl.textContent = k('ui.dc-hand-btn', 'Handover package');
      toast('<i class="bi bi-box-seam"></i> ' + esc(k('ui.dc-hand-done', '{n} approved files in the package', { n: listed.length })));
      if (window.FdvPdf && window.FdvPdf.share) window.FdvPdf.share(file); else { var a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
    }).catch(function () { btn.disabled = false; lbl.textContent = k('ui.dc-hand-btn', 'Handover package'); toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.dc-hand-failed', 'The package could not be made.'))); });
  }
  function zipStore(files) {
    var enc = new TextEncoder(), parts = [], cen = [], off = 0;
    files.forEach(function (f) {
      var nm = enc.encode(f[0]), d = typeof f[1] === 'string' ? enc.encode(f[1]) : f[1], c = crc(d), h = new DataView(new ArrayBuffer(30));
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
  /* "Som Boligbyggs vedlegg 7" (2026-11-21, JP): the same requirements laid out like Boligbygg's Dokumentplan 4-siffer – a
     "Generelt" sheet (project, who delivers, how to fill it in, the NS 3456 types) and one sheet per NS 3451 main group with
     their columns, three rows per system (the code row shaded, the document types under it), the code as 310.000. The text
     is our own; only the layout follows theirs. It reads back in Received like any document plan. */
  var BBY_G = { 1: ['1 - Øvrig dokumentasjon', '1 Øvrig dokumentasjon'], 2: ['2 - Bygning', '2 Bygningsmessig informasjon'], 3: ['3 - VVS-installasjoner', '3 VVS'], 4: ['4 - Elkraftinstallasjoner', '4 Elektro'],
    5: ['5 - Tele og automatisering', '5 Tele og automasjon'], 6: ['6 - Andre installasjoner', '6 Andre installasjoner'], 7: ['7 - Utendørs', '7 Utendørs'] };
  var BBY_T = { A: 'Dokumentasjon på at kravene er oppfylt – samsvarserklæringer, ytelseserklæringer, kontroll- og testrapporter.', B: 'Hvordan anlegget driftes, brukes og rengjøres.', C: 'Hva som skal vedlikeholdes, hvordan og hvor ofte.',
    D: 'Hvilket produkt det er og hvem som leverte det – merking, typebetegnelse, leverandør.', E: 'Produktets egenskaper – datablad, sertifikater, monteringsanvisning.', F: 'Uavhengig kontroll – sertifikater og godkjenninger fra tredjepart.',
    G: 'Hvordan brukeren bruker anlegget riktig og trygt.', H: 'Hvordan systemet er bygget opp og virker.', I: 'Innstillinger, innreguleringer og målte verdier ved overlevering.', K: 'Oppdaterte «som bygget»-tegninger.', L: 'Bilder og video, f.eks. av skjulte installasjoner.' };
  function bbyCode(c) { c = String(c || ''); var m = c.match(/^(\d{3})(?:\.(\d{1,3}))?$/); return m ? m[1] + '.' + (m[2] || '').padEnd(3, '0') : c; }
  function kravXlsxBby(p) {
    var FIRE = /^(225|23[1-3]|244|263|291|33\d|443|542|546|733)$/, L = (p.lines || []).slice().sort(lineOrder), by = {};
    L.forEach(function (l) { var g = String(l.code || '').charAt(0); if (!BBY_G[g]) return; ((by[g] = by[g] || {})[l.code] = by[g][l.code] || []).push(l); });
    var col = function (i) { return String.fromCharCode(65 + i); };
    var cell = function (r, j, v, st) { return v === '' || v == null ? (st ? '<c r="' + col(j) + r + '" s="' + st + '"/>' : '') : '<c r="' + col(j) + r + '" t="inlineStr"' + (st ? ' s="' + st + '"' : '') + '><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>'; };
    var row = function (r, cells, ht) { return '<row r="' + r + '"' + (ht ? ' ht="' + ht + '" customHeight="1"' : '') + '>' + cells.join('') + '</row>'; };
    var ws = function (cols, view, rows, merge) { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">' + view + '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>' +
      cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>' + rows.join('') + '</sheetData>' + (merge.length ? '<mergeCells count="' + merge.length + '">' + merge.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>' : '') + '</worksheet>'; };
    var sheets = [], who = (p.sent && p.sent.to) || '';
    /* Generelt */
    var gr = [row(2, [cell(2, 1, 'Prosjektnavn/-nr', 5), cell(2, 3, [p.name, p.no].filter(Boolean).join(' – ')), cell(2, 6, 'Utførende', 5), cell(2, 7, who, 8)]),
      row(4, [cell(4, 1, 'Slik fyller du ut dokumentplanen', 6)].concat([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (j) { return cell(4, j, '', 6); })))];
    ['Hver fane er en hovedgruppe i NS 3451. Systemene som gjelder for prosjektet står allerede der, med kode og navn.', 'Kolonne F viser hvilke dokumenttyper (NS 3456) som skal leveres for systemet.', 'Skriv det planlagte filnavnet i kolonne G: kode, dokumentkode og en beskrivende tekst – f.eks. 320 DA Samsvarserklæring varmeanlegg.', 'Send planen tilbake før dokumentasjonen leveres. Kolonne H er til kommentarer.']
      .forEach(function (t, i) { gr.push(row(5 + i, [cell(5 + i, 1, (i + 1) + '.'), cell(5 + i, 2, t)])); });
    gr.push(row(11, [cell(11, 1, 'Leveranse av FDVU-dokumentasjon', 1), cell(11, 2, '', 1), cell(11, 3, '', 1)]));
    gr.push(row(12, [cell(12, 1, 'Kode', 7), cell(12, 2, 'Type', 7), cell(12, 3, 'Beskrivelse', 7)]));
    [['A', 'Kravoppnåelse'], ['B, C', 'Drift, Vedlikehold'], ['D', 'Identifikasjon'], ['E', 'Produktinformasjon'], ['F', 'Attestasjon'], ['G', 'Bruksanvisning'], ['H', 'Beskrivelse'], ['I', 'Protokoll'], ['K', 'Tegning'], ['L', 'Bilde']].forEach(function (t, i) {
      var r = 13 + i; gr.push(row(r, [cell(r, 1, t[0], 8), cell(r, 2, t[1], 8), cell(r, 3, t[0] === 'B, C' ? BBY_T.B + ' ' + BBY_T.C : BBY_T[t[0]], 8)]));
    });
    sheets.push(['Generelt', ws([1.3, 7, 18.3, 44.5, 8.7, 8.7, 10.3, 24, 8.7, 8.7, 8.7, 8.7, 8.7], '', gr, ['B2:C2', 'D2:F2', 'H2:M2', 'B4:M4', 'C5:M5', 'C6:M6', 'C7:M7', 'C8:M8', 'B11:D11'])]);
    /* one sheet per main group */
    Object.keys(by).sort().forEach(function (g) {
      var G = BBY_G[g], rows = [row(1, [cell(1, 0, G[0], 1)].concat([1, 2, 3, 4, 5, 6, 7].map(function (j) { return cell(1, j, '', 1); })), 21),
        row(2, [cell(2, 0, G[0], 2), cell(2, 1, 'Anleggsnummer', 2), cell(2, 2, 'Anleggsnavn', 2), cell(2, 3, 'Kategori anlegg', 2), cell(2, 4, 'Brannbok', 2), cell(2, 5, 'Dokument typer som skal leveres', 2), cell(2, 6, 'Planlagt navngivning', 2), cell(2, 7, 'Kommentar', 2)], 23)], r = 3;
      Object.keys(by[g]).sort().forEach(function (c) {
        var ls = by[g][c], n = Math.max(3, ls.length);
        for (var i = 0; i < n; i++) {
          var l = ls[i], st = i ? 4 : 3, tp = l ? (l.t ? l.t.split('').map(function (x) { var q = TYPES.filter(function (y) { return y[0] === x; })[0]; return q ? q[1] : x; }).join(', ') : (l.type || l.name || '')) : '';
          var note = l ? [l.name && l.t ? l.name : '', hintText(l), l.opt ? 'Hvis kontraktsfestet' : ''].filter(Boolean).join(' – ') : '';
          rows.push(row(r, i ? [cell(r, 0, '', st), cell(r, 1, '', st), cell(r, 2, '', st), cell(r, 3, '', st), cell(r, 4, '', st), cell(r, 5, tp, st), cell(r, 6, '', st), cell(r, 7, note, st)]
            : [cell(r, 0, g, st), cell(r, 1, bbyCode(c), st), cell(r, 2, lineTitle(ls[0]), st), cell(r, 3, G[1], st), cell(r, 4, FIRE.test(String(c).slice(0, 3)) ? 'Ja' : 'Nei', st), cell(r, 5, tp, st), cell(r, 6, '', st), cell(r, 7, note, st)]));
          r++;
        }
      });
      sheets.push([G[0], ws([25.5, 16.5, 40.5, 30.5, 11.5, 40.5, 55.5, 55.5], '<pane xSplit="2" ySplit="2" topLeftCell="C3" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="G3" sqref="G3"/>', rows, ['A1:H1'])]);
    });
    var ST = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="3"><font><sz val="10"/><color rgb="FF2C2C2C"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FF2C2C2C"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FF2C2C2C"/><name val="Arial"/></font></fonts>' +
      '<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF9C66B"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD0BFAE"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8F0DD"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9DFD3"/></patternFill></fill></fills>' +
      '<borders count="3"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border><border><left style="medium"/><right style="medium"/><top style="medium"/><bottom style="medium"/></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>' +
      '<cellXfs count="9"><xf/><xf fontId="2" fillId="2" borderId="2" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf><xf fontId="1" fillId="5" borderId="2" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>' +
      '<xf fontId="0" fillId="3" borderId="1" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" applyFont="1"/>' +
      '<xf fontId="1" fillId="4" applyFont="1" applyFill="1"/><xf fontId="1" fillId="3" borderId="2" applyFont="1" applyFill="1" applyBorder="1"/><xf fontId="0" borderId="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    var parts = [['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map(function (x, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(function (x, i) { return '<sheet name="' + xmlEsc(x[0]) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (x, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', ST]].concat(sheets.map(function (x, i) { return ['xl/worksheets/sheet' + (i + 1) + '.xml', x[1]]; }));
    return zipStore(parts);
  }
  /* ---------- the plan back as Excel, coloured by status (JP 2026-11-14): your own file when this device has it, else a new one ---------- */
  var FILL = { missing: 'FFF4CCCC', rej: 'FFF4CCCC', recv: 'FFFFF2CC', cmt: 'FFFCE4D6', ok: 'FFD9EAD3', na: 'FFD9D9D9' };   /* grey 15 % – visible next to white rows (JP 22:17) */
  function colName(n) { var x = ''; while (n > 0) { var m = (n - 1) % 26; x = String.fromCharCode(65 + m) + x; n = Math.floor((n - 1) / 26); } return x; }
  function colNum(ref) { var m = String(ref || '').match(/^[A-Z]+/), n = 0; if (!m) return 0; for (var i = 0; i < m[0].length; i++) n = n * 26 + m[0].charCodeAt(i) - 64; return n; }
  /* what the check says on a line: its status, your comment and any file-name problems */
  function checkText(p, l) {
    if (l._chk != null) return l._chk;
    var out = stName(l.st) + (l.cmt ? ': ' + l.cmt : '');
    (p.files || []).filter(function (f) { return f.line === l.id && (f.iss || []).length; }).forEach(function (f) { out += ' · ' + f.name + ': ' + f.iss.map(function (x) { return issueText(x, f); }).join('; '); });
    return out.slice(0, 2000);
  }
  /* a zip: unchanged parts are copied as they were, changed ones are packed again (or stored when the browser can't) */
  function packAll(list) {
    var cs = typeof CompressionStream !== 'undefined';
    return Promise.all(list.map(function (e) {
      if (e.keep) return e.keep;
      var d = typeof e.text === 'string' ? new TextEncoder().encode(e.text) : e.text, c = crc(d);
      if (!cs) return { name: e.name, method: 0, data: d, size: d.length, crc: c };
      return new Response(new Blob([d]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer().then(function (b) { return { name: e.name, method: 8, data: new Uint8Array(b), size: d.length, crc: c }; });
    })).then(function (es) {
      var enc = new TextEncoder(), parts = [], cen = [], off = 0;
      es.forEach(function (z) {
        var nm = enc.encode(z.name), h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(8, z.method, true); h.setUint16(12, 0x21, true); h.setUint32(14, z.crc, true); h.setUint32(18, z.data.length, true); h.setUint32(22, z.size, true); h.setUint16(26, nm.length, true);
        parts.push(new Uint8Array(h.buffer), nm, z.data);
        var e = new DataView(new ArrayBuffer(46)); e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true); e.setUint16(8, 0x800, true); e.setUint16(10, z.method, true); e.setUint16(14, 0x21, true); e.setUint32(16, z.crc, true); e.setUint32(20, z.data.length, true); e.setUint32(24, z.size, true); e.setUint16(28, nm.length, true); e.setUint32(42, off, true);
        cen.push(new Uint8Array(e.buffer), nm); off += 30 + nm.length + z.data.length;
      });
      var size = cen.reduce(function (a, x) { return a + x.length; }, 0), end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, es.length, true); end.setUint16(10, es.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true);
      return new Blob(parts.concat(cen, [new Uint8Array(end.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    });
  }
  var XDECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  /* colour your own plan: each line's row gets its status colour (your cell styles kept, only the fill changes) and a new
     "Check" column says what is wrong. Nothing else in the file changes. */
  function colourOwn(p, buf) {
    var ents = zipEntries(buf), E = {}, xp = new DOMParser(), xs = new XMLSerializer(), H = p.planSheets;
    ents.forEach(function (z) { E[z.name] = z; });
    var txt = function (nm) { return inflate(E[nm]).then(function (u) { return new TextDecoder('utf-8').decode(u); }); };
    var paths = H.map(function (h) { return h.path; });
    if (!E['xl/styles.xml'] || paths.some(function (x) { return !E[x]; })) return Promise.reject(new Error('changed'));
    return Promise.all([txt('xl/styles.xml')].concat(paths.map(txt))).then(function (xml) {
      var sd = xp.parseFromString(xml[0], 'application/xml'), NS = sd.documentElement.namespaceURI;
      var one = function (doc, tag) { return doc.getElementsByTagNameNS(NS, tag)[0]; }, kids = function (el, tag) { return [].filter.call(el.childNodes, function (x) { return x.nodeType === 1 && x.localName === tag; }); };
      var fills = one(sd, 'fills'), xfs = one(sd, 'cellXfs');
      if (!fills || !xfs) throw new Error('styles');
      var fillId = {}, xfMemo = {};
      Object.keys(FILL).forEach(function (st) {
        if (FILL[st] in fillId) { fillId[st] = fillId[FILL[st]]; return; }
        var f = sd.createElementNS(NS, 'fill'), pf = sd.createElementNS(NS, 'patternFill'), fg = sd.createElementNS(NS, 'fgColor'), bg = sd.createElementNS(NS, 'bgColor');
        pf.setAttribute('patternType', 'solid'); fg.setAttribute('rgb', FILL[st]); bg.setAttribute('indexed', '64'); pf.appendChild(fg); pf.appendChild(bg); f.appendChild(pf); fills.appendChild(f);
        fillId[st] = fillId[FILL[st]] = kids(fills, 'fill').length - 1;
      });
      fills.setAttribute('count', kids(fills, 'fill').length);
      var xfFor = function (old, st) {
        var key = old + '|' + fillId[st]; if (key in xfMemo) return xfMemo[key];
        var list = kids(xfs, 'xf'), src = list[old] || list[0], x = src ? src.cloneNode(true) : sd.createElementNS(NS, 'xf');
        x.setAttribute('fillId', fillId[st]); x.setAttribute('applyFill', '1'); xfs.appendChild(x);
        xfs.setAttribute('count', list.length + 1); return (xfMemo[key] = list.length);
      };
      var hdrXf = null;
      var out = {};
      H.forEach(function (h, si) {
        var doc = xp.parseFromString(xml[si + 1], 'application/xml'), data = one(doc, 'sheetData'); if (!data) return;
        var rows = {}; kids(data, 'row').forEach(function (r) { rows[+r.getAttribute('r')] = r; });
        var rowEl = function (n) {
          if (rows[n]) return rows[n];
          var r = doc.createElementNS(NS, 'row'); r.setAttribute('r', n);
          var after = kids(data, 'row').filter(function (x) { return +x.getAttribute('r') > n; })[0];
          data.insertBefore(r, after || null); return (rows[n] = r);
        };
        var cell = function (r, n, col) {
          var cs = kids(r, 'c'), ref = colName(col) + n;
          for (var i = 0; i < cs.length; i++) { var c0 = colNum(cs[i].getAttribute('r')); if (c0 === col) return cs[i]; if (c0 > col) { var nc = doc.createElementNS(NS, 'c'); nc.setAttribute('r', ref); r.insertBefore(nc, cs[i]); return nc; } }
          var c = doc.createElementNS(NS, 'c'); c.setAttribute('r', ref); r.appendChild(c); return c;
        };
        var write = function (c, text) {
          while (c.firstChild) c.removeChild(c.firstChild); c.removeAttribute('t');
          if (!text) return; c.setAttribute('t', 'inlineStr');
          var is = doc.createElementNS(NS, 'is'), t = doc.createElementNS(NS, 't'); t.setAttribute('xml:space', 'preserve'); t.textContent = text; is.appendChild(t); c.appendChild(is);
        };
        /* the Check column goes right after the last column that has anything in it (empty formatted cells don't count) */
        var used = h.last; [].forEach.call(doc.getElementsByTagNameNS(NS, 'c'), function (c) { if (c.firstElementChild) used = Math.max(used, colNum(c.getAttribute('r'))); });
        var ncol = used + 1, any = false;
        (p.lines || []).forEach(function (l) {
          if (!l.src || l.src[0] !== si) return; any = true;
          var n = l.src[1] + 1, r = rowEl(n), st = FILL[l.st] ? l.st : 'missing';
          for (var col = 1; col <= h.last; col++) { var c = cell(r, n, col); c.setAttribute('s', xfFor(+c.getAttribute('s') || 0, st)); }
          var cc = cell(r, n, ncol); cc.setAttribute('s', xfFor(+cc.getAttribute('s') || 0, st)); write(cc, checkText(p, l));
        });
        (h.none || []).forEach(function (ri) {   /* a system with no document type chosen: grey, and the Check column says so */
          any = true; var n = ri + 1, r = rowEl(n);
          for (var col = 1; col <= h.last; col++) { var c = cell(r, n, col); c.setAttribute('s', xfFor(+c.getAttribute('s') || 0, 'na')); }
          var cc = cell(r, n, ncol); cc.setAttribute('s', xfFor(+cc.getAttribute('s') || 0, 'na')); write(cc, k('ui.dc-x-notype', 'No document type chosen'));
        });
        if (!any) return;
        var hr = rowEl(h.at + 1), hc = cell(hr, h.at + 1, ncol), near = cell(hr, h.at + 1, h.last);
        if (hdrXf == null) hdrXf = near.getAttribute('s'); if (hdrXf) hc.setAttribute('s', hdrXf);
        write(hc, k('ui.dc-x-check', 'Check'));
        var cols = one(doc, 'cols');
        if (!cols) { cols = doc.createElementNS(NS, 'cols'); data.parentNode.insertBefore(cols, data); }
        if (!kids(cols, 'col').some(function (c) { return +c.getAttribute('min') <= ncol && +c.getAttribute('max') >= ncol; })) {
          var cw = doc.createElementNS(NS, 'col'); cw.setAttribute('min', ncol); cw.setAttribute('max', ncol); cw.setAttribute('width', '48'); cw.setAttribute('customWidth', '1'); cols.appendChild(cw);
        }
        var dim = one(doc, 'dimension'), m = dim && String(dim.getAttribute('ref') || '').match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (m && colNum(m[3]) < ncol) dim.setAttribute('ref', m[1] + m[2] + ':' + colName(ncol) + m[4]);
        out[h.path] = XDECL + xs.serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
      });
      out['xl/styles.xml'] = XDECL + xs.serializeToString(sd).replace(/^<\?xml[^>]*\?>\s*/, '');
      return packAll(ents.map(function (z) { return z.name in out ? { name: z.name, text: out[z.name] } : { keep: z }; }));
    });
  }
  /* a new workbook: the plan's lines in rows, coloured the same way (for a plan from the checklist, a .csv, or another device) */
  function colourNew(p) {
    var ST8 = Object.keys(FILL), hd = [k('ui.dc-code', 'Code'), k('ui.dc-system', 'System'), k('ui.dc-type', 'Document type'), k('ui.dc-planned-name', 'Planned name'), k('ui.dc-x-check', 'Check')];
    var rows = (p.lines || []).slice().sort(lineOrder);
    var sx = function (st) { return 2 + ST8.indexOf(FILL[st] ? st : 'missing'); };
    var cellX = function (ref, v, s) { return '<c r="' + ref + '" t="inlineStr" s="' + s + '"><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>'; };
    var title = p.name + (p.no ? ' – ' + p.no : '');
    var sheet = XDECL + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/><col min="3" max="3" width="24" customWidth="1"/><col min="4" max="4" width="38" customWidth="1"/><col min="5" max="5" width="60" customWidth="1"/></cols><sheetData>' +
      '<row r="1">' + cellX('A1', title, 1) + '</row><row r="3">' + hd.map(function (v, j) { return cellX(colName(j + 1) + 3, v, 1); }).join('') + '</row>' +
      rows.map(function (l, i) { var n = i + 4, s0 = sx(l.st); return '<row r="' + n + '">' + [l.code, lineTitle(l), typeLabel(l), l.planned && !l.ex ? l.planned : '', checkText(p, l)].map(function (v, j) { return cellX(colName(j + 1) + n, v, s0); }).join('') + '</row>'; }).join('') + '</sheetData></worksheet>';
    var fills = ST8.map(function (st) { return '<fill><patternFill patternType="solid"><fgColor rgb="' + FILL[st] + '"/><bgColor indexed="64"/></patternFill></fill>'; }).join('');
    var styles = XDECL + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="' + (2 + ST8.length) + '"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' + fills + '</fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="' + (2 + ST8.length) + '"><xf fontId="0"/><xf fontId="1" applyFont="1"/>' +
      ST8.map(function (st, i) { return '<xf fontId="0" fillId="' + (2 + i) + '" applyFill="1"><alignment vertical="top" wrapText="1"/></xf>'; }).join('') + '</cellXfs></styleSheet>';
    var R = 'http://schemas.openxmlformats.org/', CT = 'application/vnd.openxmlformats-officedocument.spreadsheetml.';
    return packAll([
      { name: '[Content_Types].xml', text: XDECL + '<Types xmlns="' + R + 'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="' + CT + 'sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="' + CT + 'worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="' + CT + 'styles+xml"/></Types>' },
      { name: '_rels/.rels', text: XDECL + '<Relationships xmlns="' + R + 'package/2006/relationships"><Relationship Id="rId1" Type="' + R + 'officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', text: XDECL + '<workbook xmlns="' + R + 'spreadsheetml/2006/main" xmlns:r="' + R + 'officeDocument/2006/relationships"><sheets><sheet name="' + xmlEsc(k('ui.dc-x-sheet', 'Document check')).slice(0, 31) + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', text: XDECL + '<Relationships xmlns="' + R + 'package/2006/relationships"><Relationship Id="rId1" Type="' + R + 'officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + R + 'officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', text: styles }, { name: 'xl/worksheets/sheet1.xml', text: sheet }]);
  }
  var XZ = { zipEntries: zipEntries, inflate: inflate, packAll: packAll };
  /* the Excel editor loads the first time it is used, not with the Work page (JP 23:46: Work was the heaviest page) */
  var xvP = null;
  function needXV() {
    if (window.XlsxView) return Promise.resolve(window.XlsxView);
    return xvP || (xvP = new Promise(function (ok, no) { var sc = document.createElement('script'); sc.src = HOST ? '/dc/xlsx-view.js' : '/cmd/xlsx-view.js'; sc.onload = function () { ok(window.XlsxView); }; sc.onerror = function () { xvP = null; no(new Error('xlsx-view')); }; document.head.appendChild(sc); }));
  }
  /* raw = the coloured file without your own cell edits (the viewer writes them in); else with them */
  /* ---------- check a document plan without making a project (JP 22:30): the plan against the client's checklist and the naming rules ---------- */
  function planIssues(l, R, have) {
    var err = [], warn = [], c3 = String(l.code).slice(0, 3), q = R && R.codes[c3], nm = function (x) { return x.split('').map(typeName).join(', '); };
    if (q && q.t && !q.opt && have[c3] && !have[c3].done) {   /* the types the checklist asks for at this code, said once (on its first line) */
      have[c3].done = 1; var miss = q.t.split('').filter(function (x) { return have[c3].t.indexOf(x) < 0; }).join('');
      if (miss) err.push(k('ui.dc-chk-miss', 'The checklist asks for: {t}', { t: nm(miss) }));
    }
    if (q && q.t && l.t) { var extra = l.t.split('').filter(function (x) { return q.t.indexOf(x) < 0; }).join(''); if (extra) warn.push(k('ui.dc-chk-extra', 'Not in the checklist for {c}: {t}', { c: c3, t: nm(extra) })); }
    if (R && !q && /^[2-7]\d\d$/.test(c3)) warn.push(k('ui.dc-chk-nocode', '{c} is not in the checklist', { c: c3 }));
    if (!codeName(l.code) && !l.sys && !(have.named && have.named[String(l.code).slice(0, 3)])) warn.push(k('ui.dc-chk-unknown', 'Unknown NS 3451 code'));   /* a code the plan names itself (160 Tegninger, planer og kart) is the client's own */
    if (!l.t && l.type) warn.push(k('ui.dc-chk-type', 'Unknown document type “{t}”', { t: l.type }));
    if (!l.t && !l.type) warn.push(k('ui.dc-chk-notype', 'No document type chosen'));
    if (l.planned && !l.ex) {
      var f = parseName(l.planned + '.pdf'); f.p = f;
      f.issues.forEach(function (x) { (x[0] === 'err' ? err : warn).push(issueText(x, f)); });
    }
    return { err: err, warn: warn };
  }
  function copyText(t) { (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('<i class="bi bi-clipboard-check"></i> ' + esc(k('ui.dc-chk-copied', 'The file is saved and the message copied – paste it into your email.'))); }, function () {}); }
  function checkPlan(file, quiet) {
    if (!/\.xls[xm]$/i.test(file.name)) { if (quiet) return Promise.resolve(null); toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-chk-xlsx', 'Pick the plan as an Excel file (.xlsx).'))); return; }
    var R = req(), buf0;
    return file.arrayBuffer().then(function (buf) { buf0 = buf; return readBook(buf.slice(0)); }).then(function (sheets) {
      var res = parsePlan(sheets);
      if (!res.lines.length && !res.heads.some(function (h) { return h.none.length; })) { if (quiet) return null; toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-plan-none', 'No document lines found – the plan needs a column for the system code and one for the document type or the planned name.'))); return; }
      var have = { named: {} }; res.lines.forEach(function (l) { var c3 = String(l.code).slice(0, 3); (have[c3] || (have[c3] = { t: '' })).t += l.t || ''; if (l.sys) have.named[c3] = 1; });   /* a code named anywhere in the plan is the client's own */
      var n = { err: 0, warn: 0, ok: 0, none: 0 };
      res.lines.forEach(function (l) {
        var is = planIssues(l, R, have);
        l.st = is.err.length ? 'rej' : is.warn.length ? 'recv' : 'ok'; n[is.err.length ? 'err' : is.warn.length ? 'warn' : 'ok']++;
        l._chk = is.err.concat(is.warn).join(' · ') || k('ui.dc-chk-ok', 'OK');
      });
      res.heads.forEach(function (h, si) {   /* systems with no document type: an error when the checklist asks for types there */
        h.none.forEach(function (ri) {
          var c3 = String(h.nc[ri] || '').slice(0, 3), q = R && R.codes[c3], miss = q && q.t && !q.opt ? q.t.split('').filter(function (x) { return !have[c3] || have[c3].t.indexOf(x) < 0; }).join('') : '';
          if (miss && have[c3] && have[c3].done) miss = '';   /* already said on the code's first line */
          if (miss) { (have[c3] || (have[c3] = { t: '' })).done = 1; n.err++; } else n.none++;
          res.lines.push({ id: 'n' + si + '-' + ri, code: h.nc[ri] || '', st: miss ? 'rej' : 'na', src: [si, ri], files: [], _chk: miss ? k('ui.dc-chk-notype', 'No document type chosen') + ' · ' + k('ui.dc-chk-miss', 'The checklist asks for: {t}', { t: miss.split('').map(typeName).join(', ') }) : k('ui.dc-x-notype', 'No document type chosen') });
        });
        h.none = [];
      });
      /* the last check of the same plan (most lines in common): what is fixed and what is new since then (JP 23:46) */
      var lk = function (l) { return String(l.code) + '|' + (l.planned || '') + '|' + (l.type || '') + (l.id && /^n\d/.test(l.id) ? '|none' : ''); }, bad = function (st0) { return st0 === 'rej' || st0 === 'recv'; };
      var cur = {}; res.lines.forEach(function (l) { cur[lk(l)] = l.st; });
      var H = readJSON('dash.dcchks', []), prev = null, best = 0;
      H.forEach(function (h) { var n0 = 0, keys = Object.keys(h.keys || {}); keys.forEach(function (x) { if (x in cur) n0++; }); var sc = keys.length ? n0 / Math.max(keys.length, Object.keys(cur).length) : 0; if (sc > best) { best = sc; prev = h; } });
      if (best < .5) prev = null;
      H.forEach(function (h) { if (h.name === file.name) prev = h; });   /* the same file name wins */
      var diff = null;
      if (prev) {
        diff = { fixed: 0, fresh: 0, at: prev.at };
        Object.keys(prev.keys).forEach(function (x) { if (bad(prev.keys[x]) && x in cur && !bad(cur[x])) diff.fixed++; });
        res.lines.forEach(function (l) { var x = lk(l); if (bad(l.st) && !(x in prev.keys && bad(prev.keys[x]))) { diff.fresh++; l._chk = k('ui.dc-chk-new', 'New:') + ' ' + l._chk; } });
      }
      H = H.filter(function (h) { return h.name !== file.name; }); H.unshift({ name: file.name, at: today(), keys: cur }); H = H.slice(0, 6);
      try { localStorage.setItem('dash.dcchks', JSON.stringify(H)); } catch (e) {}
      if (quiet) return { e: n.err, w: n.warn, o: n.ok, x: n.none, diff: diff ? { f: diff.fixed, n: diff.fresh, at: diff.at } : null, R: !!R };
      var pseudo = { id: 'check', name: file.name.replace(/\.xls[xm]$/i, ''), lines: res.lines, files: [], planSheets: res.heads };
      return colourOwn(pseudo, buf0).then(function (bl) {
        var title = k('ui.dc-chk-title', 'Check: {f}', { f: file.name });
        var note = '<b>' + esc(k('ui.dc-chk-sum', '{e} to fix · {w} to look at · {o} OK · {x} with no document type', { e: n.err, w: n.warn, o: n.ok, x: n.none })) + '</b>' + (diff ? ' · ' + esc(k('ui.dc-chk-diff', 'Since the check on {d}: {f} fixed, {n} new', { d: fmt(diff.at), f: diff.fixed, n: diff.fresh })) : '') + (R ? ' · ' + esc(k('ui.dc-chk-against', 'Checked against {f}', { f: R.name })) : ' · ' + esc(k('ui.dc-chk-noreq', 'No client checklist yet – import one under Document requirements to check the document types too.')));
        var start = res.heads.filter(function (h, i) { return res.lines.some(function (l) { return l.src && l.src[0] === i; }); }).map(function (h) { return h.path; })[0];
        return needXV().catch(function () { return null; }).then(function () {
        if (!window.XlsxView) { window.FdvPdf.share(new File([bl], file.name.replace(/\.xls[xm]$/i, '') + ' – ' + k('ui.dc-chk-file', 'checked') + '.xlsx', { type: bl.type })); return; }
        XlsxView.open({ blob: bl, title: title, edits: {}, Z: XZ, start: start, cls: HOST ? 'dc-host' : '', note: note,
          actions: [{ icon: 'send', label: k('ui.dc-chk-send', 'Send to the contractor'), run: function (close, edits) {
            var probs = res.lines.filter(function (l) { return l.st === 'rej' || l.st === 'recv'; }).sort(function (a, b) { return (a.st === 'rej' ? 0 : 1) - (b.st === 'rej' ? 0 : 1) || (String(a.code) < String(b.code) ? -1 : 1); });
            var text = k('ui.dc-chk-mail', 'Check of the document plan {f}', { f: file.name }) + '\n' + k('ui.dc-chk-sum', '{e} to fix · {w} to look at · {o} OK · {x} with no document type', { e: n.err, w: n.warn, o: n.ok, x: n.none }) + '\n\n' +
              probs.slice(0, 25).map(function (l) { return '• ' + l.code + (l.planned && !l.ex ? ' ' + l.planned : l.type ? ' – ' + l.type : '') + ': ' + l._chk; }).join('\n') + (probs.length > 25 ? '\n' + k('ui.dc-chk-more', '… and {n} more', { n: probs.length - 25 }) : '') +
              '\n\n' + k('ui.dc-chk-see', 'See the attached Excel – each row is coloured and the Check column says what to fix.');
            var nm = file.name.replace(/\.xls[xm]$/i, '') + ' – ' + k('ui.dc-chk-file', 'checked') + '.xlsx';
            bl.arrayBuffer().then(function (buf) { return XlsxView.apply(buf, edits || {}, XZ); }).then(function (b3) {
              var f3 = new File([b3], nm, { type: b3.type });
              if (navigator.canShare && navigator.canShare({ files: [f3] })) return navigator.share({ files: [f3], title: k('ui.dc-chk-mail', 'Check of the document plan {f}', { f: file.name }), text: text }).catch(function (e) { if (!e || e.name !== 'AbortError') { window.FdvPdf.share(f3); copyText(text); } });
              window.FdvPdf.share(f3); copyText(text);
            });
          } }, { icon: 'folder-plus', label: k('ui.dc-chk-make', 'Make a project'), run: function (close) {
            var t = Fe.tools(), id = uid(); t.dctl = (t.dctl || []).concat([{ id: id, made: new Date().toISOString(), name: pseudo.name.slice(0, 120), lines: [], files: [] }]); Fe.saveTools(t);
            close(); importPlan(id, file); go(id);
          } }],
          download: function (b2) { window.FdvPdf.share(new File([b2], file.name.replace(/\.xls[xm]$/i, '') + ' – ' + k('ui.dc-chk-file', 'checked') + '.xlsx', { type: b2.type })); } });
        });
      });
    }).catch(function (e) { if (quiet) return null; toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.dc-plan-bad', 'The file could not be read – use .xlsx or .csv.'))); try { console.warn('[dc] check', e); } catch (e2) {} });
  }
  /* Document plans that stay (JP 2026-11-17 15:25): several at once, each with its summary (to fix · to look at · OK · no type) in the list,
     opened in the viewer only when you ask, kept until you delete them. The list and the files are 'plan:' keys – shared with the team in Team
     (encrypted records), on this device in cmd. A plan bigger than Team's record limit stays on the device that added it. */
  var PLS = null, plBusy = 0;
  function plList() { return PLS || []; }
  window.addEventListener('tools:change', function () { if (PLS && xtool === 'plan') plLoad().then(function () { draw(); }); });
  function plLoad() { return getBlob('plan:index').then(function (v) { PLS = v && Array.isArray(v.list) ? v.list : []; return PLS; }).catch(function () { PLS = PLS || []; return PLS; }); }
  function plSave() { return putBlob('plan:index', { list: PLS || [] }); }
  function plAdd(list) {
    var F = [].slice.call(list || []).filter(function (f) { return /\.xls[xm]$/i.test(f.name); });
    if (!F.length) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-chk-xlsx', 'Pick the plan as an Excel file (.xlsx).'))); return Promise.resolve(); }
    plBusy += F.length; draw();
    var who = HOST && HOST.profile ? (HOST.profile() || {}).name || '' : '';
    return plLoad().then(function () { return F.reduce(function (pr, f) { return pr.then(function () {
      return checkPlan(f, true).then(function (sum) {
        var id = uid(), e = { id: id, name: f.name, at: new Date().toISOString(), by: who, size: f.size, sum: sum || null };
        return putBlob('plan:f:' + id, f).then(function (ok) { if (ok === false) { e.here = 1; return putBlobLocal('plan:f:' + id, f); } }).then(function () { PLS = [e].concat(plList().filter(function (x) { return x.name !== f.name || x.at.slice(0, 10) !== e.at.slice(0, 10); })); });
      }).then(function () { plBusy--; draw(); }, function () { plBusy--; draw(); });
    }); }, Promise.resolve()); }).then(function () { return plSave(); }).then(function () { toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dx-pl-added', '{n} plans checked and kept', { n: F.length }))); draw(); });
  }
  function plFile(e) { return getBlob('plan:f:' + e.id).then(function (b) { return b || getBlobLocal('plan:f:' + e.id); }).then(function (b) { return b ? new File([b], e.name, { type: b.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) : null; }); }
  function plOpen(id) { var e = plList().filter(function (x) { return x.id === id; })[0]; if (!e) return;
    plFile(e).then(function (f) { if (!f) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dx-pl-gone', 'This plan’s file is only on the device that added it.'))); return; }
      checkPlan(f, true).then(function (sum) { if (sum) { e.sum = sum; e.chk = new Date().toISOString(); plSave(); draw(); } checkPlan(f); }); }); }
  function plDel(id) { PLS = plList().filter(function (x) { return x.id !== id; }); delBlob('plan:f:' + id); delBlobLocal('plan:f:' + id); return plSave().then(function () { draw(); }); }
  function plSumHtml(s0) {
    if (!s0) return '<span class="dx-tag na">' + esc(k('ui.dx-pl-nosum', 'Not checked – open it')) + '</span>';
    return (s0.e ? '<span class="dx-tag bad">' + esc(k('ui.dx-pl-e', '{n} to fix', { n: s0.e })) + '</span>' : '') + (s0.w ? '<span class="dx-tag soon">' + esc(k('ui.dx-pl-w', '{n} to look at', { n: s0.w })) + '</span>' : '') +
      '<span class="dx-tag ok">' + esc(k('ui.dx-pl-o', '{n} OK', { n: s0.o })) + '</span>' + (s0.x ? '<span class="dx-tag na">' + esc(k('ui.dx-pl-x', '{n} with no document type', { n: s0.x })) + '</span>' : '') +
      (s0.diff ? '<small class="muted">' + esc(k('ui.dc-chk-diff', 'Since the check on {d}: {f} fixed, {n} new', { d: fmt(s0.diff.at), f: s0.diff.f, n: s0.diff.n })) + '</small>' : '') +
      (!s0.R ? '<small class="muted">' + esc(k('ui.dx-pl-nor', 'No checklist from the client yet – the document types aren’t checked')) + '</small>' : '');
  }
  function planPanel() {
    if (!PLS) { plLoad().then(function () { draw(); }); }
    var L0 = plList();
    var h = '<section class="dx-panel dx-plans"><div class="dx-ph"><h3 class="fdv-h">' + esc(k('ui.dx-t-plans', 'Document plans')) + '</h3><button type="button" class="icon-btn sm" data-dxtool="" aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
      '<p class="muted dc-help">' + esc(HOST && HOST.team ? k('ui.dx-pl-help-t', 'Each plan is checked against the client’s checklist when you add it. They stay here for the whole team until someone deletes them.') : k('ui.dx-pl-help', 'Each plan is checked against the client’s checklist when you add it. They stay here until you delete them.')) + '</p>' +
      '<div class="dc-facts"><button type="button" class="pill-btn dc-file" data-dxplanadd><i class="bi bi-files"></i> ' + esc(L0.length ? k('ui.dx-pl-more', 'Add more plans') : k('ui.dx-pl-pick', 'Pick document plans (.xlsx)')) + '</button><input type="file" multiple accept=".xlsx,.xlsm" data-dxplanf hidden>' + (plBusy ? '<span class="muted"><i class="bi bi-hourglass-split"></i> ' + esc(k('ui.dx-pl-busy', 'Checking {n} …', { n: plBusy })) + '</span>' : '') + '</div>';
    if (!L0.length) return h + '<p class="muted">' + esc(PLS ? k('ui.dx-pl-none', 'No plans yet – add one or more, or drop them here.') : k('ui.loading', 'Loading …')) + '</p></section>';
    h += '<ul class="dx-pl">' + L0.map(function (e) {
      return '<li class="dx-pli"><div class="dx-pln"><b data-noi18n>' + esc(e.name) + '</b><small class="muted">' + esc(fmt(String(e.chk || e.at).slice(0, 10))) + (e.by ? ' · ' + esc(e.by) : '') + (e.here ? ' · ' + esc(k('ui.dx-pl-here', 'file on the device that added it')) : '') + '</small></div>' +
        '<div class="dx-pls">' + plSumHtml(e.sum) + '</div>' +
        '<div class="dx-plb"><button type="button" class="pill-btn" data-dxplopen="' + esc(e.id) + '"><i class="bi bi-table"></i> ' + esc(k('ui.dx-pl-open', 'Open the check')) + '</button>' +
        '<button type="button" class="dc-chip" data-dxpldl="' + esc(e.id) + '"><i class="bi bi-download"></i> ' + esc(k('ui.download', 'Download')) + '</button>' +
        '<button type="button" class="dc-chip dx-clr" data-dxpldel="' + esc(e.id) + '"><i class="bi bi-trash3"></i> ' + esc(k('ui.delete', 'Delete')) + '</button></div></li>';
    }).join('') + '</ul>';
    return h + '</section>';
  }
  function planXlsx(p, raw) {
    if (!raw) return Promise.all([planXlsx(p, true), needXV().catch(function () { return null; })]).then(function (x) { var f = x[0]; if (!x[1]) return f;
      return getBlob('xedit:' + p.id + (f._own ? '' : ':new')).then(function (ed) {
        if (!ed || !Object.keys(ed).length) return f;
        return f.arrayBuffer().then(function (buf) { return XlsxView.apply(buf, ed, XZ); }).then(function (bl) { var g = new File([bl], f.name, { type: f.type }); g._own = f._own; return g; });
      });
    });
    var nm = fileName(p, k('ui.dc-x-file', 'Document check'), '.xlsx');
    var mk = function (b) { return new File([b], nm, { type: b.type }); };
    var fresh = function () { return colourNew(p).then(function (b) { var f = mk(b); f._own = false; return f; }); };
    if (!p.planSheets || !p.planSheets.length) return fresh();
    return getBlob('plan:' + p.id).then(function (b) {
      if (!b) return fresh();
      return (b.arrayBuffer ? b.arrayBuffer() : new Response(b).arrayBuffer()).then(function (buf) { return colourOwn(p, buf); }).then(function (x) { var f = mk(x); f._own = true; return f; }, function (e) { try { console.warn('[dc] own plan', e); } catch (e2) {} return fresh(); });
    });
  }
  function fileName(p, what, ext) { return ([p.no, what, p.name].filter(Boolean).join(' ')).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() + ext; }

  /* ---------- importing ---------- */
  function importPlan(id, file) {
    var isX = /\.xls[xm]$/i.test(file.name);
    (isX ? file.arrayBuffer().then(readBook) : file.text().then(readCsv)).then(function (sheets) {
      var res = parsePlan(sheets);
      if (!res.lines.length) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-plan-none', 'No document lines found – the plan needs a column for the system code and one for the document type or the planned name.'))); return; }
      var kept = 0;
      if (isX) putBlob('plan:' + id, file); else delBlob('plan:' + id);
      saveP(id, function (p) {
        var old = {}; (p.lines || []).forEach(function (l) { old[l.code + '|' + l.t + '|' + l.planned + '|' + l.type] = l; });
        res.lines.forEach(function (l) { var o = old[l.code + '|' + l.t + '|' + l.planned + '|' + l.type]; if (o) { kept++; l.id = o.id; l.st = o.st; l.cmt = o.cmt; l.files = o.files || []; } });
        var ids = {}; res.lines.forEach(function (l) { ids[l.id] = 1; });
        (p.files || []).forEach(function (f) { if (f.line && !ids[f.line]) f.line = ''; });
        p.lines = res.lines; p.planName = file.name.slice(0, 120); p.planAt = today();
        p.planSheets = isX && res.heads.every(function (h) { return h.path; }) ? res.heads : undefined;   /* the original stays on this device, for "Excel with colours" */
        rematch(p);
      });
      toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dc-plan-read', '{n} documents in the plan', { n: res.lines.length })) + (kept ? ' · ' + esc(k('ui.dc-plan-kept', '{n} kept their status', { n: kept })) : ''));
      draw();
    }).catch(function (e) { toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.dc-plan-bad', 'The file could not be read – use .xlsx or .csv.'))); try { console.warn('[dc] plan', e); } catch (e2) {} });
  }
  /* files with no line are matched again (after a new plan); a file you linked by hand stays */
  /* BBY wants drawings as both DWG and PDF, and documents as PDF (JP 23:46): checked across the delivered files */
  function pairs(p) {
    var F = p.files || [], by = {};
    F.forEach(function (f) { var m = String(f.name).match(/^(.*)\.([a-z0-9]{2,5})$/i); if (!m) return; (by[m[1].toLowerCase()] = by[m[1].toLowerCase()] || {})[m[2].toLowerCase()] = 1; });
    F.forEach(function (f) {
      if (f.nf) return; var m = String(f.name).match(/^(.*)\.([a-z0-9]{2,5})$/i); f.iss = (f.iss || []).filter(function (x) { return PAIR.indexOf(x[1]) < 0; }); if (!m) return;
      var stem = m[1], ext = m[2].toLowerCase(), set = by[stem.toLowerCase()] || {}, drawing = TEG.test(stem) || /^\d{4,6}-/.test(stem);
      if (drawing && ext === 'pdf' && !set.dwg) f.iss.push(['warn', 'nodwg']);
      else if (drawing && ext === 'dwg' && !set.pdf) f.iss.push(['warn', 'nopdf']);
      else if (!drawing && /^(docx?|xlsx?|xlsm|odt|ods|rtf|txt|msg|eml)$/.test(ext)) f.iss.push(['warn', 'notpdf']);
    });
  }
  function rematch(p) {
    pairs(p);
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
          add.forEach(function (f) { var x = p.files.filter(function (y) { return y.id === f.id; })[0]; if (namingOn() && naming()) naming().guess(x); var l = (p.lines || []).length && bestLine(p, x.p); if (l) { x.line = l.id; l.files = (l.files || []).concat([x.id]); if (l.st === 'missing') l.st = 'recv'; matched++; } });
          pairs(p);
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
    var sb;
    if ((sb = e.target.closest('[data-dcsel]'))) { SEL = SEL.k === sb.dataset.dcsel ? { k: '', ids: {} } : { k: sb.dataset.dcsel, ids: {} }; if (SEL.k) { openLine = null; rpen = false; } draw(); return; }
    if (SEL.k && (sb = e.target.closest('[data-dcpick]')) && !e.target.closest('[data-dcview], select, input, a')) { var pi = sb.dataset.dcpick; if (SEL.ids[pi]) delete SEL.ids[pi]; else SEL.ids[pi] = 1; draw(); return; }
    if (SEL.k && (sb = e.target.closest('[data-dcselall]'))) { var on1 = !!sb.dataset.dcselall; SEL.ids = {}; if (on1) (sb.dataset.ids || '').split(' ').filter(Boolean).forEach(function (x) { SEL.ids[x] = 1; }); draw(); return; }
    if (SEL.k && (sb = e.target.closest('[data-dcselst]'))) {   /* the same status on every ticked line; "Not checked" puts each back to received or missing */
      var sv = sb.dataset.dcselst, ids1 = selIds(), pr1 = proj(open); if (!pr1 || !can(stAct(sv), gOf(pr1, 'dctl'))) return;
      var keep1 = JSON.parse(JSON.stringify(pr1));
      saveP(open, function (p) { ids1.forEach(function (id) { var l = lineOf(p, id); if (l) l.st = sv === 'missing' ? ((l.files || []).length ? 'recv' : 'missing') : sv; }); });
      SEL.ids = {}; draw();
      toast('<i class="bi bi-check2-all"></i> ' + esc(k('ui.dc-sel-st-done', '{n} lines: {s}', { n: ids1.length, s: sv === 'missing' ? k('ui.dc-sel-reset', 'Not checked') : stName(sv) })), function () { var t1 = Fe.tools(); t1.dctl = (t1.dctl || []).map(function (x) { return x.id === keep1.id ? keep1 : x; }); Fe.saveTools(t1); draw(); });
      return;
    }
    if (SEL.k && e.target.closest('[data-dcselfdel]')) {
      var ids2 = selIds(), pr2 = proj(open); if (!pr2 || !ids2.length) return; var keep2 = JSON.parse(JSON.stringify(pr2));
      saveP(open, function (p) { (p.files || []).forEach(function (f) { if (ids2.indexOf(f.id) >= 0 && f.line) unlink(p, f.line, f.id); }); p.files = (p.files || []).filter(function (x) { return ids2.indexOf(x.id) < 0; }); });
      SEL.ids = {}; draw();
      toast('<i class="bi bi-trash3"></i> ' + esc(k('ui.dc-sel-files-gone', '{n} files removed', { n: ids2.length })), function () { var t2 = Fe.tools(); t2.dctl = (t2.dctl || []).map(function (x) { return x.id === keep2.id ? keep2 : x; }); Fe.saveTools(t2); draw(); });
      var op2 = open; setTimeout(function () { var p = proj(op2); ids2.forEach(function (id) { if (!p || !(p.files || []).some(function (x) { return x.id === id; })) delBlob(id); }); }, 9000);
      return;
    }
    if (SEL.k && (e.target.closest('[data-drseldel]') || e.target.closest('[data-drselopt]'))) {
      var del3 = !!e.target.closest('[data-drseldel]'), ids3 = selIds(), kp3 = krav(ropen); if (!kp3 || !ids3.length || !can('edit', gOf(kp3, 'dckrav'))) return; kp3 = JSON.parse(JSON.stringify(kp3));
      var allOpt = (kp3.lines || []).filter(function (l) { return ids3.indexOf(l.id) >= 0; }).every(function (l) { return l.opt; });
      saveP(ropen, function (p) { if (del3) p.lines = (p.lines || []).filter(function (x) { return ids3.indexOf(x.id) < 0; }); else (p.lines || []).forEach(function (l) { if (ids3.indexOf(l.id) >= 0) { if (allOpt) delete l.opt; else l.opt = 1; } }); }, 'dckrav');
      SEL.ids = {}; draw();
      toast('<i class="bi bi-' + (del3 ? 'trash3' : 'check2-all') + '"></i> ' + esc(del3 ? k('ui.dc-sel-lines-gone', '{n} lines removed', { n: ids3.length }) : allOpt ? k('ui.dc-sel-opt-off', '{n} lines: always needed', { n: ids3.length }) : k('ui.dc-sel-opt-on', '{n} lines: only if in the contract', { n: ids3.length })),
        function () { var t3 = Fe.tools(); t3.dckrav = (t3.dckrav || []).map(function (x) { return x.id === kp3.id ? kp3 : x; }); Fe.saveTools(t3); draw(); });
      return;
    }
    /* Send to Team (work.jplundberg.com): the project as a file you import there – the plan, statuses and comments, never
       the files themselves (they stay on this device). Nothing goes from this dashboard's storage to Team's. */
    if (e.target.closest('[data-drmove]') && !HOST) {   /* every list, the client checklists and your own project types in one file for Team's "Import from /cmd" */
      var tt0 = Fe.tools(), kl = JSON.parse(JSON.stringify(kravs())); kl.forEach(function (p) { delete p.files; (p.lines || []).forEach(function (l) { delete l.files; }); });
      var bundle = { team: 'dcbundle', v: 1, at: new Date().toISOString(), krav: kl, dcreq: tt0.dcreq || null, dcreqs: tt0.dcreqs || [], dctypes: tt0.dctypes || [] };
      var bf = new File([JSON.stringify(bundle)], k('ui.dr-bundle-name', 'Document requirements for Team') + '.json', { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [bf] })) navigator.share({ files: [bf], title: bf.name }).catch(function () {});
      else { var ba = document.createElement('a'); ba.href = URL.createObjectURL(bf); ba.download = bf.name; document.body.appendChild(ba); ba.click(); setTimeout(function () { URL.revokeObjectURL(ba.href); ba.remove(); }, 4000); }
      var tt1 = Fe.tools(); tt1.dcTeamAt = new Date().toISOString(); Fe.saveTools(tt1); draw();
      toast('<i class="bi bi-people"></i> ' + esc(k('ui.dr-moved', 'Saved. In Team: Documents → Import from /cmd – {n} lists come along.', { n: kl.length })) + ' <a href="https://work.jplundberg.com/#docs">' + esc(k('ui.open-team', 'Open Team')) + '</a>');
      return;
    }
    var tb = e.target.closest('[data-dcteam]');
    if (tb) {
      var isKrav = /^r:/.test(tb.dataset.dcteam), tid = tb.dataset.dcteam.replace(/^r:/, ''), tp = isKrav ? krav(tid) : proj(tid); if (!tp) return;   /* r:<id> = document requirements */
      var cp = JSON.parse(JSON.stringify(tp)); delete cp.files; (cp.lines || []).forEach(function (l) { delete l.files; });
      var tf = new File([JSON.stringify({ team: isKrav ? 'dckrav' : 'dctl', v: 1, at: new Date().toISOString(), p: cp })], fileName(tp, k('ui.dc-for-team', 'for Team'), '.json'), { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [tf] })) navigator.share({ files: [tf], title: tf.name }).catch(function () {});
      else { var ta = document.createElement('a'); ta.href = URL.createObjectURL(tf); ta.download = tf.name; document.body.appendChild(ta); ta.click(); setTimeout(function () { URL.revokeObjectURL(ta.href); ta.remove(); }, 4000); }
      toast('<i class="bi bi-people"></i> ' + esc(k('ui.dc-sent-team', 'Saved. In Team: Documents → Import from /cmd.')) + ' <a href="https://work.jplundberg.com/#docs">' + esc(k('ui.open-team', 'Open Team')) + '</a>');
      return;
    }
    var b, t = e.target; if (!t.closest || !t.closest('#wkDocCtl, #wkDocReq, .dcn-ov')) return;
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
    if (t.closest('[data-drxbby]')) { var pb = krav(ropen); if (!pb) return; if (rsend) markSent(pb.id, 'xlsx'); var fb = new File([kravXlsxBby(pb)], fileName(pb, 'Dokumentplan', '.xlsx'), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); if (window.FdvPdf && window.FdvPdf.share) window.FdvPdf.share(fb); return; }
    if (t.closest('[data-drxlsx]')) { var px = krav(ropen); if (!px) return; if (rsend) markSent(px.id, 'xlsx'); var fx = new File([kravXlsx(px)], fileName(px, 'Dokumentkrav', '.xlsx'), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); if (window.FdvPdf && window.FdvPdf.share) window.FdvPdf.share(fx); return; }
    if (t.closest('[data-drstart]')) { var ps = krav(ropen); if (!ps) return; var nid = uid(), tt2 = Fe.tools(), had = (tt2.dctl || []).filter(function (x) { return x && x.krav === ps.id; })[0];
      if (had) {   /* started before: open that one and add what is new in the requirements (JP 13:05 – a second tap made a second project) */
        var add0 = 0; saveP(had.id, function (p) { var hv = {}; (p.lines || []).forEach(function (l) { hv[l.code + '|' + l.t + '|' + (l.name || '')] = 1; }); (ps.lines || []).forEach(function (l, i) { if (!hv[l.code + '|' + l.t + '|' + (l.name || '')]) { add0++; p.lines.push(Object.assign({}, l, { id: uid() + i, st: 'missing', files: [], cmt: '' })); } }); ['bid', 'bname', 'pname', 'pid', 'no'].forEach(function (f) { if (ps[f]) p[f] = ps[f]; }); rematch(p); });
        if (add0) toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dc-plan-read', '{n} documents in the plan', { n: add0 })));
        rpicking = false; if (window.PageTabs && PageTabs.show) PageTabs.show('doc', true); setTab('docs'); go(had.id); return; }
      tt2.dctl = (tt2.dctl || []).concat([{ id: nid, name: ps.name, no: ps.no || '', bid: ps.bid || '', bname: ps.bname || '', pname: ps.pname || '', pid: ps.pid || '', trade: ps.type || '', made: new Date().toISOString(), planName: k('ui.doc-req', 'Document requirements') + ': ' + ps.name, planAt: today(), krav: ps.id,
        lines: (ps.lines || []).map(function (l, i) { return Object.assign({}, l, { id: uid() + i, st: 'missing', files: [], cmt: '' }); }), files: [] }]); Fe.saveTools(tt2);
      rpicking = false; if (window.PageTabs && PageTabs.show) PageTabs.show('doc', true); setTab('docs'); go(nid); return; }
    if ((b = t.closest('[data-drpdf]'))) {
      var pc0 = krav(ropen); if (!b._pdf && kpdf && pc0 && kpdf.id === pc0.id && kpdf.key === linesKey(pc0)) b._pdf = kpdf.file;   /* made already (the button was drawn again): show it again */
      if (b._pdf) { window.PagedPdf.view(b._pdf); return; }   /* made already: show it again */
      var pp = krav(ropen); if (!pp || b.disabled || !window.FdvPdf || !window.FdvPdf.html) return;
      var note0 = document.querySelector('#wkDocReq .fdv-pdfnote'), lb = b.querySelector('span'), me0 = profile();
      b.disabled = true; lb.textContent = k('ui.fdv-making-pdf', 'Making the PDF …');
      window.FdvPdf.html(kravReport(pp), [[me0.name, me0.role].filter(Boolean).join(', '), me0.employer, k('ui.doc-req', 'Document requirements'), pp.no, pp.name].filter(Boolean).join('  ·  '), fileName(pp, k('ui.doc-req', 'Document requirements'), '.pdf')).then(function (file) {
        b.disabled = false; b._pdf = file; lb.textContent = k('ui.fdv-show-pdf', 'Show the PDF'); b.querySelector('i').className = 'bi bi-file-earmark-pdf';
        if (note0) { note0.hidden = false; note0.textContent = k('ui.fdv-pdf-ready2', 'Ready: {f} ({n} pages).', { f: file.name, n: file._pages }); }
        kpdf = { id: pp.id, key: linesKey(pp), file: file }; window.PagedPdf.view(file);   /* shown first – Share and Save are in the viewer (JP 2026-11-16) */ if (rsend) markSent(pp.id, 'pdf');
      }).catch(function () { b.disabled = false; lb.textContent = k('ui.fdv-make-pdf', 'Make PDF'); toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.fdv-pdf-failed', 'The PDF could not be made – check the connection the first time (the PDF tool is fetched once).'))); }); return;
    }
    if (t.closest('[data-dcnew]')) { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); adding = true; radding = false; draw(); var i = document.querySelector('.dc-pform input'); if (i) i.focus(); return; }
    if (t.closest('[data-dccancel]')) { adding = false; editing = false; picking = false; if (rpicking && ropen && krav(ropen) && !(krav(ropen).lines || []).length) { rpicking = false; rback(); return; } rpicking = false; draw(); return; }
    if (t.closest('[data-drpick]')) { rpicking = true; ticks = {}; xsel = {}; xoff = {}; draw(); window.scrollTo(0, 0); return; }
    if ((b = t.closest('[data-dcptype]'))) { var ty = allTypes().filter(function (x) { return x.id === b.dataset.dcptype; })[0]; if (!ty) return; var CC = pickCodes();
      var tcodes = function (q) { return (q.codes === '*' ? Object.keys(CC).filter(function (c) { return CC[c].t || !req() || /^1/.test(c); }) : String(q.codes || '').split(' ')).filter(function (c) { return CC[c]; }); };
      if (xsel[ty.id]) {   /* tapped again: the type is off, and the systems only it ticked are unticked (JP 13:08 – it stayed on) */
        delete xsel[ty.id]; var keep = {}; allTypes().forEach(function (q) { if (xsel[q.id]) tcodes(q).forEach(function (c) { keep[c] = 1; }); });
        tcodes(ty).forEach(function (c) { if (!keep[c]) delete ticks[c]; });
        var still = allTypes().filter(function (q) { return xsel[q.id] && q.id !== 'new'; }); lastType = still.length ? still[still.length - 1].name : '';
      } else { lastType = ty.id === 'new' ? '' : ty.name; xsel[ty.id] = true; tcodes(ty).forEach(function (c) { ticks[c] = true; }); }
      pickSync(); return; }
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
    if ((b = t.closest('[data-dctdel]'))) { if (!canAdmin()) return; tform = null; blurIn(); var tid = b.dataset.dctdel, tt = Fe.tools(), old = JSON.parse(JSON.stringify(tt.dctypes || [])); tt.dctypes = (tt.dctypes || []).filter(function (x) { return x.id !== tid; }); Fe.saveTools(tt); draw(); toast('<i class="bi bi-trash3"></i> ' + esc(k('ui.dc-type-removed', 'Project type removed')), function () { var t5 = Fe.tools(); t5.dctypes = old; Fe.saveTools(t5); draw(); }); return; }
    if ((b = t.closest('[data-dcldel]'))) { var lid = b.dataset.dcldel, keep2 = JSON.parse(JSON.stringify(proj(open))); saveP(open, function (p) { var l = lineOf(p, lid); (l && l.files || []).forEach(function (fid) { var f = (p.files || []).filter(function (x) { return x.id === fid; })[0]; if (f) f.line = ''; }); p.lines = (p.lines || []).filter(function (x) { return x.id !== lid; }); }); openLine = null; draw();
      toast('<i class="bi bi-trash3"></i> ' + esc(k('ui.dc-line-removed', 'Line removed')), function () { var t6 = Fe.tools(); t6.dctl = (t6.dctl || []).map(function (x) { return x.id === keep2.id ? keep2 : x; }); Fe.saveTools(t6); draw(); }); return; }
    if ((b = t.closest('[data-dxtool]'))) { blurIn(); var nt = b.dataset.dxtool || null; xtool = xtool === nt ? null : nt; draw(); return; }
    if (t.closest('[data-dxrenopen]')) { renDrop(); return; }
    if (t.closest('[data-dxdups]')) { dupPop(0); return; }
    if (t.closest('[data-dxplanadd]')) { renDrop({ label: k('ui.dx-t-plans', 'Document plans'), title: k('ui.dx-pl-drop-t', 'Add document plans'), here: k('ui.dx-pl-drop-here', 'Drop the document plans here'), accept: '.xlsx,.xlsm', help: k('ui.dx-pl-drop-help', 'Excel files (.xlsx) – as many as you like. Each is checked against the client’s checklist and kept until it is deleted.'), take: function (fl) { plAdd(fl.filter(function (f) { return /\.xls[xm]$/i.test(f.name); })); } }); return; }
    if ((b = t.closest('[data-dxplopen]'))) { plOpen(b.dataset.dxplopen); return; }
    if ((b = t.closest('[data-dxpldl]'))) { var pe = plList().filter(function (x) { return x.id === b.dataset.dxpldl; })[0]; if (pe) plFile(pe).then(function (f) { if (f) window.FdvPdf.share(f); }); return; }
    var pd = t.closest('[data-dxpldel]'); if (pd) { if (!pd.classList.contains('sure')) { pd.classList.add('sure'); pd.innerHTML = '<i class="bi bi-exclamation-circle"></i> ' + esc(k('ui.dx-pl-sure', 'Delete the plan? Tap again')); setTimeout(function () { if (pd.isConnected) { pd.classList.remove('sure'); pd.innerHTML = '<i class="bi bi-trash3"></i> ' + esc(k('ui.delete', 'Delete')); } }, 4000); return; } plDel(pd.dataset.dxpldel); return; }
    var b0 = t.closest('[data-dxrenclr]'); if (b0) { if (!b0.classList.contains('sure')) { b0.classList.add('sure'); b0.innerHTML = '<i class="bi bi-exclamation-circle"></i> ' + esc(k('ui.dx-clear-sure', 'Remove all files? Tap again')); setTimeout(function () { if (b0.isConnected) { b0.classList.remove('sure'); b0.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i> ' + esc(k('ui.dx-clear', 'Start again')); } }, 4000); return; }
      TOOL = { p: null, blobs: {} }; draw(); return; }
    if (t.closest('[data-dxrenuse]')) { var N9 = naming(); if (N9) { var nn9 = N9.useAll('__ren'); toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dx-ren-used', '{n} files have their new name', { n: nn9 }))); } return; }
    if ((b = t.closest('[data-dxrendl]'))) { if (b.disabled) return; if (toolP().files.length === 1) { b.disabled = true; renDownload().then(function () { b.disabled = false; }, function () { b.disabled = false; }); return; } dlPop(); return; }   /* more than one file: choose what to download first */
    if (t.closest('[data-dxfdvcopy]')) { copyText((fdvRes || []).filter(function (x) { return x.iss.length; }).map(function (x) { return x.n + '\t' + x.iss.join(' · '); }).join('\n')); return; }
    if ((b = t.closest('[data-dcopen]'))) { go(b.dataset.dcopen); return; }
    if (t.closest('[data-drsend]')) { rsend = !rsend; draw(); var to0 = document.querySelector('form[data-drsendf] [name="to"]'); if (to0 && rsend) to0.focus(); return; }
    if (t.closest('[data-drsendx]')) { blurIn(); rsend = false; draw(); return; }
    if (t.closest('[data-drpen]')) { rpen = !rpen; draw(); return; }
    if (t.closest('[data-dctnew]')) { if (!canAdmin()) return; blurIn(); tpen = false; tform = { id: '', name: '', from: '', codes: {}, x: [] }; draw(); var tn0 = document.querySelector('form[data-dctform] [name="n"]'); if (tn0) tn0.focus(); return; }
    if (t.closest('[data-dctpen]')) { blurIn(); tpen = !tpen; tform = null; draw(); return; }
    if ((b = t.closest('[data-dctedit]'))) { var ot = ownTypes().filter(function (x) { return x.id === b.dataset.dctedit; })[0]; if (!ot || !canAdmin()) return; var o0 = tformFrom(ot.id); tform = { id: ot.id, name: ot.name, from: '', codes: o0.codes, x: o0.x }; draw(); return; }
    if (t.closest('[data-dctcancel]')) { blurIn(); tform = null; draw(); return; }
    if (t.closest('[data-dctxadd]')) { var tf = t.closest('form'), xc = tf.xc.value.trim(), xt = tf.xt.value.trim().slice(0, 80); if (!/^\d{3,4}$/.test(xc) || !xt) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dx-own-doc-need', 'Write a code (3 digits) and what the document is'))); return; } tformRead(); blurIn(); tform.x.push([xc, '', xt, xt, '', '']); tform.codes[xc.slice(0, 3)] = 1; draw(); return; }
    if ((b = t.closest('[data-dctxrm]'))) { tformRead(); blurIn(); tform.x.splice(+b.dataset.dctxrm, 1); draw(); return; }
    if ((b = t.closest('[data-dxkrav]'))) { if (window.PageTabs && PageTabs.show) PageTabs.show('doc', true); rgo(b.dataset.dxkrav); return; }
    if ((b = t.closest('[data-dxmot]'))) { if (tab === 'report') setTab('docs'); if (open === b.dataset.dxmot) draw(); else go(b.dataset.dxmot); return; }
    if ((b = t.closest('[data-dxrap]'))) { setTab('report'); if (open === b.dataset.dxrap) draw(); else go(b.dataset.dxrap); return; }
    if (t.closest('[data-dcback]')) { back(); return; }
    if ((b = t.closest('[data-dctab]'))) { setTab(b.dataset.dctab); openLine = null; editing = false; draw(); return; }
    if (t.closest('[data-dcedit]')) { editing = true; draw(); return; }
    if ((b = t.closest('[data-dcfilt]'))) { filt = b.dataset.dcfilt; if (tab !== 'docs') setTab('docs'); openLine = null; draw(); return; }
    if ((b = t.closest('[data-dcgrp]'))) { filt = 'g' + b.dataset.dcgrp; setTab('docs'); openLine = null; draw(); return; }
    if ((b = t.closest('[data-dcline]'))) { openLine = openLine === b.dataset.dcline ? null : b.dataset.dcline; draw(); return; }
    if ((b = t.closest('[data-dcst]'))) { var s = b.dataset.dcst.split(':'), tg = b.hasAttribute('data-dctoggle'); if (!can(stAct(s[1]), gOf(proj(open), 'dctl'))) return; saveP(open, function (p) { var l = lineOf(p, s[0]); if (l) l.st = tg && l.st === s[1] ? ((l.files || []).length ? 'recv' : 'missing') : s[1]; }); draw(); return; }   /* a quick button tapped again undoes it */
    if (t.closest('[data-dcpastebtn]')) { pasting = !pasting; draw(); var ta = document.querySelector('.dc-paste textarea'); if (ta) ta.focus(); return; }
    if ((b = t.closest('[data-dcunlink]'))) { var u = b.dataset.dcunlink.split(':'); saveP(open, function (p) { unlink(p, u[0], u[1]); }); draw(); return; }
    if ((b = t.closest('[data-dcview]'))) { var fid = b.dataset.dcview, w = null, NV = window.DocNaming && window.DocNaming.view;
      /* opens in a popup over the page (JP 2026-11-17 07:53); a new tab only if the viewer isn't loaded */
      var fnm = (function () { var pp = renOn() ? toolP() : proj(open), ff = pp && (pp.files || []).filter(function (x) { return x.id === fid; })[0]; return ff ? ff.name : 'file'; })();
      if (!NV) { try { w = window.open('', '_blank'); } catch (e2) {} }
      (renOn() && TOOL.blobs[fid] ? Promise.resolve(TOOL.blobs[fid]) : getBlob(fid)).then(function (bl) { if (bl && NV) { NV(bl, fnm); return; } if (!bl) { if (w) w.close(); toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-file-elsewhere', 'The file is on the device it was imported on.'))); return; } var url = URL.createObjectURL(bl); if (w) w.location = url; else location.href = url; setTimeout(function () { URL.revokeObjectURL(url); }, 60000); }); return; }
    if ((b = t.closest('[data-dcfdel]')) && renOn()) { var rid = b.dataset.dcfdel; toolP().files = toolP().files.filter(function (x) { return x.id !== rid; }); delete TOOL.blobs[rid]; draw(); return; }
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
      setTimeout(function () { if (!proj(pid) && gone) { (gone.files || []).forEach(function (f) { delBlob(f.id); }); delBlob('plan:' + pid); delBlob('xedit:' + pid); delBlob('xedit:' + pid + ':new'); } }, 9000); return;
    }
    if ((b = t.closest('[data-dchand]'))) { handover(b); return; }
    if ((b = t.closest('[data-dcxcol]'))) {   /* Excel with colours: see it, change any cell, download (JP 21:47) */
      var px2 = proj(b.dataset.dcxcol); if (!px2 || b.disabled) return; b.disabled = true;
      Promise.all([planXlsx(px2, true), needXV().catch(function () { return null; })]).then(function (x) {
        var f = x[0]; b.disabled = false;
        var ek = 'xedit:' + px2.id + (f._own ? '' : ':new');
        return getBlob(ek).then(function (ed) {
          if (!window.XlsxView) { window.FdvPdf.share(f); return; }
          if (!f._own) toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-x-new', 'A new Excel with colours (the original plan is not on this device)')));
          var ST4 = {}; Object.keys(FILL).forEach(function (s0) { if (s0 !== 'missing') ST4['#' + FILL[s0].slice(2).toUpperCase()] = s0; });   /* rej and missing share red: red = not approved */
          var rowLine = function (path, row, eds) { if (eds && window.XlsxView.origRow) row = window.XlsxView.origRow(eds[path], row); if (row == null) return null; var si = (px2.planSheets || []).map(function (h) { return h.path; }).indexOf(path); if (si < 0) return null; return (proj(px2.id).lines || []).filter(function (l) { return l.src && l.src[0] === si && l.src[1] + 1 === row; })[0] || null; };
          ed = ed || {}; Object.keys(ed).forEach(function (pa) { Object.keys(ed[pa] || {}).forEach(function (ref) { var e = ed[pa][ref]; if (e && typeof e === 'object' && e.bg && ST4[String(e.bg).toUpperCase()] && rowLine(pa, +ref.replace(/^[A-Z]+/, ''), ed)) { delete e.bg; if (!Object.keys(e).length) delete ed[pa][ref]; } }); });   /* the file shows the current status already */
          XlsxView.open({ blob: f, title: f.name, edits: ed, Z: XZ, cls: HOST ? 'dc-host' : '', shared: !!(HOST && HOST.store),
            onFill: f._own ? function (path, refs, bg, eds) {
              var st0 = ST4[String(bg).toUpperCase()]; if (!st0) return '';
              var rows = {}; refs.forEach(function (r) { rows[+r.replace(/^[A-Z]+/, '')] = 1; });
              var ids = Object.keys(rows).map(function (r) { return rowLine(path, +r, eds); }).filter(Boolean).map(function (l) { return l.id; }); if (!ids.length) return '';
              saveP(px2.id, function (p) { (p.lines || []).forEach(function (l) { if (ids.indexOf(l.id) >= 0) l.st = st0; }); });
              return k(ids.length === 1 ? 'ui.dc-x-st1' : 'ui.dc-x-st', ids.length === 1 ? '1 line is now: {s}' : '{n} lines are now: {s}', { n: ids.length, s: stName(st0) });
            } : null, start: (px2.planSheets || []).filter(function (h, i) { return (h.none || []).length || (px2.lines || []).some(function (l) { return l.src && l.src[0] === i; }); }).map(function (h) { return h.path; })[0],
            onEdits: function (e) { putBlob(ek, e); }, download: function (bl) { window.FdvPdf.share(new File([bl], f.name, { type: f.type })); } });
        });
      }).catch(function (e) { b.disabled = false; toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.dc-x-failed', 'The Excel file could not be made.'))); try { console.warn('[dc] xlsx', e); } catch (e2) {} });
      return;
    }
    if ((b = t.closest('[data-dcpdf]'))) {
      if (b._pdf) { window.PagedPdf.view(b._pdf); return; }   /* made already: show it again */
      var p2 = proj(b.dataset.dcpdf); if (!p2 || b.disabled || !window.FdvPdf || !window.FdvPdf.html) return;
      var note = document.querySelector('#wkDocCtl .fdv-pdfnote'), lbl = b.querySelector('span'), me = profile();
      b.disabled = true; lbl.textContent = k('ui.fdv-making-pdf', 'Making the PDF …');
      var foot = [[me.name, me.role].filter(Boolean).join(', '), me.employer, k('ui.doc-control', 'Document control'), p2.no, p2.name].filter(Boolean).join('  ·  ');
      var nm = ([p2.no, k('ui.doc-control', 'Document control'), p2.name].filter(Boolean).join(' ')).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() + '.pdf';
      window.FdvPdf.html(report(p2), foot, nm).then(function (file) {
        b.disabled = false; b._pdf = file; lbl.textContent = k('ui.fdv-show-pdf', 'Show the PDF'); b.querySelector('i').className = 'bi bi-file-earmark-pdf';
        if (note) { note.hidden = false; note.textContent = k('ui.fdv-pdf-ready2', 'Ready: {f} ({n} pages).', { f: file.name, n: file._pages }); }
        window.PagedPdf.view(file);   /* shown first – Share and Save are in the viewer (JP 2026-11-16) */
      }).catch(function (err) { b.disabled = false; lbl.textContent = k('ui.fdv-make-pdf', 'Make PDF'); toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(k('ui.fdv-pdf-failed', 'The PDF could not be made – check the connection the first time (the PDF tool is fetched once).'))); try { console.warn('[dc] pdf', err); } catch (e3) {} });
    }
  });
  /* files dropped straight on the rename panel */
  document.addEventListener('dragover', function (e) { var r = e.target.closest && e.target.closest('.dx-ren'); if (r) { e.preventDefault(); r.classList.add('dx-dragon'); } });
  document.addEventListener('dragleave', function (e) { var r = e.target.closest && e.target.closest('.dx-ren'); if (r && !r.contains(e.relatedTarget)) r.classList.remove('dx-dragon'); });
  document.addEventListener('drop', function (e) { var pp = e.target.closest && e.target.closest('.dx-plans'); if (pp) { e.preventDefault(); pp.classList.remove('dx-dragon'); plAdd((e.dataTransfer && e.dataTransfer.files) || []); return; } });
  document.addEventListener('dragover', function (e) { var pp = e.target.closest && e.target.closest('.dx-plans'); if (pp) { e.preventDefault(); pp.classList.add('dx-dragon'); } });
  document.addEventListener('dragleave', function (e) { var pp = e.target.closest && e.target.closest('.dx-plans'); if (pp && !pp.contains(e.relatedTarget)) pp.classList.remove('dx-dragon'); });
  document.addEventListener('drop', function (e) { var r = e.target.closest && e.target.closest('.dx-ren'); if (!r || (e.target.closest && e.target.closest('.dx-drop'))) return; e.preventDefault(); r.classList.remove('dx-dragon'); var fl = [].slice.call((e.dataTransfer && e.dataTransfer.files) || []); if (fl.length) renAdd(fl); });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.closest || !t.closest('#wkDocCtl, #wkDocReq, .dcn-ov')) return;
    if (t.hasAttribute('data-dctfrom') && tform) { tformRead(); var fr = tformFrom(t.value); tform.from = t.value; tform.codes = fr.codes; tform.x = fr.x; blurIn(); draw(); return; }
    if (t.dataset.dctc && tform) { if (t.checked) tform.codes[t.dataset.dctc] = 1; else delete tform.codes[t.dataset.dctc]; var cn = document.querySelector('[data-dctn]'); if (cn) cn.textContent = k('ui.dx-n-picked', '{n} picked', { n: Object.keys(tform.codes).length }); var dd = t.closest('details'), sp = dd && dd.querySelector('.dc-pn'); if (sp) sp.textContent = dd.querySelectorAll('[data-dctc]:checked').length || ''; return; }
    if (t.hasAttribute('data-dxrenf')) { var fl = [].slice.call(t.files || []); t.value = ''; if (fl.length) renAdd(fl); return; }
    if (t.hasAttribute('data-dxfdvf')) { var ff = t.files && t.files[0]; t.value = ''; if (ff) (/\.xls[xm]$/i.test(ff.name) ? ff.arrayBuffer().then(readBook) : ff.text().then(function (x) { return x.indexOf(';') >= 0 || x.indexOf('\t') >= 0 ? readCsv(x) : [{ rows: x.split(/\r?\n/).map(function (l) { return [l]; }) }]; })).then(function (sh) { var nn = namesFrom(sh); if (!nn.length) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-names-none', 'No document names found – a name starts with the 3-digit code, like “332 SE Sprinkler”.'))); return; } fdvCheck(nn); }); return; }
    if (t.hasAttribute('data-dxplanf')) { var pf = [].slice.call(t.files || []); t.value = ''; plAdd(pf); return; }
    if (t.hasAttribute('data-dcchk')) { var cf = t.files && t.files[0]; t.value = ''; if (cf) checkPlan(cf); return; }
    if (t.dataset.dcfromkrav && t.value) { var kk = krav(t.value), pid = t.dataset.dcfromkrav; if (!kk) return; var addk = 0;
      saveP(pid, function (p) { var have = {}; (p.lines || []).forEach(function (l) { have[l.code + '|' + l.t] = 1; }); var nl = (kk.lines || []).filter(function (l) { return !have[l.code + '|' + l.t]; }).map(function (l, i) { return Object.assign({}, l, { id: uid() + i, st: 'missing', files: [], cmt: '' }); }); addk = nl.length; p.lines = (p.lines || []).concat(nl); if (!p.planName) { p.planName = k('ui.doc-req', 'Document requirements') + ': ' + kk.name; p.planAt = today(); } p.krav = kk.id; rematch(p); });
      toast('<i class="bi bi-check2"></i> ' + esc(k('ui.dc-plan-read', '{n} documents in the plan', { n: addk }))); draw(); return; }
    if (t.dataset.dcplan && t.files && t.files[0]) { importPlan(t.dataset.dcplan, t.files[0]); t.value = ''; return; }
    if (t.dataset.dcfiles && t.files && t.files.length) { importFiles(t.dataset.dcfiles, [].slice.call(t.files)); t.value = ''; return; }
    if (t.matches('[data-dcreq]') && t.files && t.files[0]) { importReq(t.files[0]); t.value = ''; return; }
    if (t.matches('[data-dcreqadd]') && t.files && t.files[0]) { importReq(t.files[0], true); t.value = ''; return; }
    if (t.matches('[data-dcreqpick]')) { useReq(t.value); draw(); return; }
    if (t.dataset.dctick) { ticks[t.dataset.dctick] = t.checked; updPick(); return; }
    if (t.dataset.dcxtick) { xoff[t.dataset.dcxtick] = !t.checked; updPick(); return; }
    if (t.dataset.dcnames && t.files && t.files[0]) { importNames(t.dataset.dcnames, t.files[0]); t.value = ''; return; }
    if (t.matches('[data-dcquick]')) { quick = t.checked; try { sessionStorage.setItem('dash.dcQuick', quick ? '1' : ''); } catch (e) {} openLine = null; draw(); return; }
    if (t.dataset.dclink && t.value) { var a = t.dataset.dclink, v = t.value; saveP(open, function (p) { link(p, a, v); }); draw(); return; }
    if (t.matches('[data-dcnon]')) { try { localStorage.setItem('dash.dcNaming', t.checked ? '1' : ''); } catch (e1) {} draw(); return; }
    if (t.dataset.dcflink && t.value) { var f = t.dataset.dcflink, l = t.value; saveP(open, function (p) { link(p, l, f); }); draw(); return; }
  });
  document.addEventListener('input', function (e) { var t = e.target;
    if (t.matches && t.matches('[data-dcpq]')) { var qq = t.value.toLowerCase().trim();
      document.querySelectorAll('.dc-ptg [data-dcptg]').forEach(function (row) { var any2 = false; row.querySelectorAll('[data-dcptype]').forEach(function (b) { var on2 = !qq || b.textContent.toLowerCase().indexOf(qq) >= 0; b.hidden = !on2; any2 = any2 || on2; }); row.hidden = !any2; }); document.querySelectorAll('.dc-pg').forEach(function (d) { var any = false; d.querySelectorAll('li[data-dcpc]').forEach(function (li) { var on = !qq || li.textContent.toLowerCase().indexOf(qq) >= 0; li.hidden = !on; any = any || on; }); d.hidden = !any; if (qq && any) d.open = true; }); return; }
    if (t.matches && t.matches('[data-dcq]')) { q = t.value; clearTimeout(t._t); t._t = setTimeout(function () { draw(); var i = document.querySelector('[data-dcq]'); if (i) { i.focus(); i.setSelectionRange(q.length, q.length); } }, 250); } });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('[data-dcseldue]') && SEL.k) { var dv = /^\d{4}-\d{2}-\d{2}$/.test(t.value) ? t.value : '', ids4 = selIds(), pr4 = proj(open); if (!dv || !pr4 || !ids4.length) return; var keep4 = JSON.parse(JSON.stringify(pr4));
      saveP(open, function (p) { ids4.forEach(function (id) { var l = lineOf(p, id); if (l) l.due = dv; }); }); SEL.ids = {}; setTimeout(draw, 50);
      toast('<i class="bi bi-calendar-check"></i> ' + esc(k('ui.dc-sel-due-done', '{n} lines: deadline {d}', { n: ids4.length, d: fmt(dv) })), function () { var t5 = Fe.tools(); t5.dctl = (t5.dctl || []).map(function (x) { return x.id === keep4.id ? keep4 : x; }); Fe.saveTools(t5); draw(); }); return; }
    if (!t.matches || !t.matches('[data-dcdue], [data-dcwho]')) return;
    var id = t.dataset.dcdue || t.dataset.dcwho, due = !!t.dataset.dcdue, v = due ? (/^\d{4}-\d{2}-\d{2}$/.test(t.value) ? t.value : '') : t.value.trim().slice(0, 60);
    saveP(open, function (p) { var l = lineOf(p, id); if (l) { if (v) l[due ? 'due' : 'who'] = v; else delete l[due ? 'due' : 'who']; } }); setTimeout(draw, 300);
  });
  document.addEventListener('focusout', function (e) {
    var t = e.target; if (!t.matches || !t.matches('textarea[data-dccmt]')) return;
    var id = t.dataset.dccmt, v = t.value.trim().slice(0, 1000);
    saveP(open, function (p) { var l = lineOf(p, id); if (l) { l.cmt = v; if (v && l.st === 'ok') l.st = 'cmt'; } }); setTimeout(draw, 300);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f.matches) return;
    if (f.matches('form[data-dxfdv]')) { e.preventDefault(); var pn = String(f.t.value || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); if (!pn.length) return; f.t.blur(); fdvCheck(pn.slice(0, 2000)); return; }
    if (f.matches('form[data-dctform]')) { e.preventDefault(); if (!tform || !canAdmin()) return; var nm = f.n.value.trim().slice(0, 60), cs2 = Object.keys(tform.codes).sort(); if (!nm) return; if (!cs2.length && !tform.x.length) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dx-type-need', 'Tick at least one system'))); return; }
      var tt9 = Fe.tools(), rec = { name: nm, codes: cs2, x: tform.x }; if (tform.id) tt9.dctypes = (tt9.dctypes || []).map(function (x) { return x.id === tform.id ? Object.assign({}, x, rec) : x; }); else tt9.dctypes = (tt9.dctypes || []).concat([Object.assign({ id: uid() }, rec)]);
      Fe.saveTools(tt9); blurIn(); tform = null; tpen = false; draw(); toast('<i class="bi bi-bookmark-check"></i> ' + esc(k('ui.dx-type-saved', '“{n}” is under your own types', { n: nm }))); return; }
    if (f.matches('form[data-dcpaste]')) { e.preventDefault(); var nn = namesText(f.t.value); if (!nn.length) { toast('<i class="bi bi-info-circle"></i> ' + esc(k('ui.dc-names-none', 'No document names found – a name starts with the 3-digit code, like “332 SE Sprinkler”.'))); return; } pasting = false; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); importFiles(f.dataset.dcpaste, [], nn); return; }
    if (f.matches('form[data-dredit]')) { e.preventDefault(); var ev = siteRead(f, { name: f.name.value.trim().slice(0, 120) || 'Project', no: f.no.value.trim().slice(0, 40) }); saveP(ropen, function (p) { Object.assign(p, ev); }, 'dckrav'); redit = false; document.activeElement && document.activeElement.blur && document.activeElement.blur(); draw(); return; }
    if (f.matches('form[data-drform]')) { e.preventDefault(); var rn = f.name.value.trim().slice(0, 120); if (!rn) return; var rid = uid(), t11 = Fe.tools(); xsel = {}; xoff = {}; t11.dckrav = (t11.dckrav || []).concat([siteRead(f, { id: rid, name: rn, no: f.no.value.trim().slice(0, 40), made: new Date().toISOString(), lines: [] })]); Fe.saveTools(t11); radding = false; f.name.blur(); ticks = {}; lastType = ''; rgo(rid); return; }
    if (f.matches('form[data-dctsave]')) { e.preventDefault(); var tn = f.n.value.trim().slice(0, 60), cs = Object.keys(ticks).filter(function (c) { return ticks[c]; }); if (!tn || (!cs.length && !xtras().length)) return; var t7 = Fe.tools(); t7.dctypes = (t7.dctypes || []).concat([{ id: uid(), name: tn, codes: cs.sort(), x: xtras().filter(function (x) { return !xoff[xKey(x)]; }) }]); Fe.saveTools(t7); toast('<i class="bi bi-bookmark-check"></i> ' + esc(k('ui.dc-type-saved', 'Saved as a project type'))); f.n.blur(); draw(); return; }
    if (f.matches('form[data-dcaddl]')) { e.preventDefault(); var code = normCode(f.code.value), tl = f.t.value, nm = f.name.value.trim().slice(0, 160), aid = f.dataset.dcaddl, akey = /^r:/.test(aid) ? 'dckrav' : 'dctl'; aid = aid.replace(/^r:/, ''); if (!code) return;
      saveP(aid, function (p) { var q = req() && req().codes[code.slice(0, 3)]; p.lines = (p.lines || []).concat([{ id: uid(), code: code, sys: nm || (q && q.n) || codeName(code) || '', type: tl ? tl.split('').map(function (x) { return TYPES.filter(function (y) { return y[0] === x; })[0][1]; }).join(', ') : '', t: tl, hint: tl ? tl.split('').map(function (x) { var v = q && q.ex && q.ex[x] || defHint(x); return v ? x + ': ' + v : ''; }).filter(Boolean).join('\n') || undefined : undefined, planned: '', note: '', st: 'missing', files: [], hand: 1 }]); if (akey === 'dctl') rematch(p); }, akey);
      f.reset(); document.activeElement && document.activeElement.blur && document.activeElement.blur(); draw(); return; }
    if (!f.matches('form[data-dcpform]')) return; e.preventDefault();
    var v = siteRead(f, { name: f.name.value.trim().slice(0, 120), no: f.no.value.trim().slice(0, 40), who: f.who.value.trim().slice(0, 120), trade: f.trade.value.trim().slice(0, 80), due: f.due.value });
    if (f.req) v.req = f.req.value || undefined;
    if (!v.name) return;
    var id = f.dataset.dcpform;
    if (id) saveP(id, function (p) { Object.assign(p, v); });
    else { var t = Fe.tools(); id = uid(); t.dctl = (t.dctl || []).concat([Object.assign({ id: id, made: new Date().toISOString(), lines: [], files: [] }, v)]); Fe.saveTools(t); }
    adding = false; editing = false; document.activeElement && document.activeElement.blur && document.activeElement.blur();
    if (open !== id) go(id); else draw();
  });
  document.addEventListener('toggle', function (e) {
    var d = e.target; if (!d.matches || !d.matches('details[data-dcg]')) return; var key = d.dataset.dcg;
    if (!!gopen[key] === d.open) return; gopen[key] = d.open;
    if (d.open && !d.querySelector('ul')) { var y = window.scrollY; draw(); window.scrollTo(0, y); }   /* drawn now that it is open */
  }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-dcgall]'); if (!b) return;
    var on = !!b.dataset.on; b.dataset.gs.split(' ').forEach(function (g) { gopen[b.dataset.dcgall + ':' + g] = on; }); var y = window.scrollY; draw(); window.scrollTo(0, y);
  });
  window.addEventListener('tools:change', function () { var ae = document.activeElement; if (ae && ae.matches && ae.matches('[data-dcq]')) return; draw(); });
  if (window.Vault && window.Vault.onUnlock) window.Vault.onUnlock(function () { setTimeout(draw, 80); });
  window.DocCtl = { parseReq: parseReq, linesFor: linesFor, PTYPES: PTYPES, namesText: namesText, parseName: parseName, parsePlan: parsePlan, readBook: readBook, letters: letters, score: score, planXlsx: planXlsx, checkPlan: checkPlan, XZ: XZ, pairs: pairs, zipEntries: zipEntries, draw: function () { draw(); } };
  draw();
})();
