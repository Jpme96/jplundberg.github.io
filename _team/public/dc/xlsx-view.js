/* Copied from cmd/xlsx-view.js by _team/build.py – edit it there, not here. */
/* See and edit an Excel file on the device (JP 2026-11-14: "preview the file and edit it myself – any cell, like Excel").
   Used by Document control (Excel with colours) in cmd and in Team (copied there by _team/build.py).
   XlsxView.read(buf, Z)        → Promise<book>: the sheets with their cells, colours, bold, widths and merged cells
   XlsxView.apply(buf, edits, Z) → Promise<Blob>: the same file with your edits written in ({ sheetPath: { A5: 'text' or
                                   { v, bg, b } } }); cell styles stay (a fill or bold makes a copy of the style), a formula
                                   you typed over becomes your text
   XlsxView.open(opt)            → shows the file full screen: sheet tabs, the cells, a bar to type in, select with Shift or
                                   by dragging, arrow keys, start typing to replace, Delete, undo/redo, copy/paste (also to and
                                   from Excel), bold, fill colours, Download
   Z = { zipEntries, inflate, packAll } from Document control (the zip is read and written without a library). */
(function () {
  'use strict';
  if (window.XlsxView) return;
  function k(key, en, o) { return window.I18N && I18N.k ? I18N.k(key, en, o) : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function colName(n) { var x = ''; while (n > 0) { var m = (n - 1) % 26; x = String.fromCharCode(65 + m) + x; n = Math.floor((n - 1) / 26); } return x; }
  function colNum(ref) { var m = String(ref || '').match(/^[A-Z]+/), n = 0; if (!m) return 0; for (var i = 0; i < m[0].length; i++) n = n * 26 + m[0].charCodeAt(i) - 64; return n; }
  function kids(el, tag) { return el ? [].filter.call(el.childNodes, function (x) { return x.nodeType === 1 && x.localName === tag; }) : []; }
  function one(el, tag) { return el ? el.getElementsByTagNameNS('*', tag)[0] : null; }
  function all(el, tag) { return el ? [].slice.call(el.getElementsByTagNameNS('*', tag)) : []; }
  var XDECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  var xp = new DOMParser();

  /* ---------- colours: rgb, theme (with tint) or the old indexed palette ---------- */
  var IDX = ['000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080', '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF', '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF', '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99', '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696', '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333'];
  function tint(hex, t) {
    if (!t) return hex; var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    var f = function (c) { return Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t); };
    return [f(r), f(g), f(b)].map(function (c) { return ('0' + c.toString(16)).slice(-2); }).join('');
  }
  function colour(el, theme) {
    if (!el) return '';
    var rgb = el.getAttribute('rgb'), th = el.getAttribute('theme'), ix = el.getAttribute('indexed'), t = +el.getAttribute('tint') || 0;
    if (rgb) return '#' + tint(rgb.slice(-6), t);
    if (th != null && theme[+th]) return '#' + tint(theme[+th], t);
    if (ix != null && IDX[+ix]) return '#' + tint(IDX[+ix], t);
    return '';
  }

  /* ---------- reading ---------- */
  function read(buf, Z) {
    var E = {}; Z.zipEntries(buf).forEach(function (z) { E[z.name] = z; });
    function text(nm) { return E[nm] ? Z.inflate(E[nm]).then(function (u) { return new TextDecoder('utf-8').decode(u); }) : Promise.resolve(''); }
    return Promise.all([text('xl/workbook.xml'), text('xl/_rels/workbook.xml.rels'), text('xl/sharedStrings.xml'), text('xl/styles.xml'), text('xl/theme/theme1.xml')]).then(function (r) {
      var rel = {}, ss = [], list = [], theme = [];
      if (r[1]) all(xp.parseFromString(r[1], 'application/xml'), 'Relationship').forEach(function (x) { rel[x.getAttribute('Id')] = x.getAttribute('Target'); });
      if (r[2]) all(xp.parseFromString(r[2], 'application/xml'), 'si').forEach(function (si) { ss.push(all(si, 't').map(function (t) { return t.textContent; }).join('')); });
      if (r[4]) { var cs = one(xp.parseFromString(r[4], 'application/xml'), 'clrScheme'), ord = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
        ord.forEach(function (nm, i) { var n = cs && one(cs, nm), c = n && (one(n, 'srgbClr') || one(n, 'sysClr')); theme[i] = c ? (c.getAttribute('val') && c.localName === 'srgbClr' ? c.getAttribute('val') : c.getAttribute('lastClr') || (i % 2 ? '000000' : 'FFFFFF')) : ''; }); }
      var X = [];   /* one entry per cell style: background, text colour, bold, italic, alignment, wrap, date */
      if (r[3]) {
        var sd = xp.parseFromString(r[3], 'application/xml'), fills = kids(one(sd, 'fills'), 'fill'), fonts = kids(one(sd, 'fonts'), 'font'), nf = {};
        kids(one(sd, 'numFmts'), 'numFmt').forEach(function (n) { nf[n.getAttribute('numFmtId')] = n.getAttribute('formatCode') || ''; });
        kids(one(sd, 'cellXfs'), 'xf').forEach(function (x) {
          var f = fills[+x.getAttribute('fillId') || 0], pf = f && one(f, 'patternFill'), fo = fonts[+x.getAttribute('fontId') || 0], al = one(x, 'alignment'), id = x.getAttribute('numFmtId') || '0';
          X.push({ bg: pf && pf.getAttribute('patternType') === 'solid' ? colour(one(pf, 'fgColor'), theme) : '', fg: fo ? colour(one(fo, 'color'), theme) : '', b: !!(fo && one(fo, 'b') && one(fo, 'b').getAttribute('val') !== '0'), i: !!(fo && one(fo, 'i')),
            al: al ? al.getAttribute('horizontal') || '' : '', wrap: !!(al && al.getAttribute('wrapText') === '1'), date: (+id >= 14 && +id <= 22) || /[dy]/i.test((nf[id] || '').replace(/"[^"]*"|\[[^\]]*\]/g, '')) });
        });
      }
      if (r[0]) all(xp.parseFromString(r[0], 'application/xml'), 'sheet').forEach(function (s) {
        var id = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'), t = rel[id];
        if (t && s.getAttribute('state') !== 'hidden' && s.getAttribute('state') !== 'veryHidden') list.push({ name: s.getAttribute('name') || '', path: t.charAt(0) === '/' ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '') });
      });
      return Promise.all(list.map(function (sh) {
        return text(sh.path).then(function (x) {
          var doc = xp.parseFromString(x || '<worksheet/>', 'application/xml'), cells = {}, maxR = 0, maxC = 0, cols = {}, hideC = {}, rows = {}, merges = [];
          kids(one(doc, 'cols'), 'col').forEach(function (c) { for (var i = +c.getAttribute('min'); i <= Math.min(+c.getAttribute('max'), 200); i++) { cols[i] = +c.getAttribute('width') || 0; if (c.getAttribute('hidden') === '1') hideC[i] = 1; } });
          all(doc, 'row').forEach(function (row) {
            var rn = +row.getAttribute('r'); if (!rn) return;
            rows[rn] = { ht: +row.getAttribute('ht') || 0, hidden: row.getAttribute('hidden') === '1' };
            kids(row, 'c').forEach(function (c) {
              var ref = c.getAttribute('r'); if (!ref) return;
              var t = c.getAttribute('t'), v = one(c, 'v'), is = one(c, 'is'), s = +c.getAttribute('s') || 0, val = '';
              if (t === 's' && v) val = ss[+v.textContent] || ''; else if (t === 'inlineStr' && is) val = all(is, 't').map(function (q) { return q.textContent; }).join(''); else if (t === 'b' && v) val = v.textContent === '1' ? 'TRUE' : 'FALSE'; else if (v) val = v.textContent;
              var num = !t || t === 'n';
              if (num && val !== '' && X[s] && X[s].date && isFinite(+val)) { var d = new Date(Math.round((+val - 25569) * 864e5)); val = d.getUTCDate() + '.' + (d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }
              else if (num && val !== '' && isFinite(+val) && /\.\d{6,}/.test(val)) val = String(Math.round(+val * 1e6) / 1e6);
              var cn = colNum(ref);
              cells[ref] = { v: val, s: s, f: !!one(c, 'f'), num: num };
              if (val !== '' || (X[s] && X[s].bg)) { maxR = Math.max(maxR, rn); maxC = Math.max(maxC, cn); }
            });
          });
          all(doc, 'mergeCell').forEach(function (m) { var p = String(m.getAttribute('ref') || '').split(':'); if (p.length === 2) merges.push([colNum(p[0]), +p[0].replace(/^[A-Z]+/, ''), colNum(p[1]), +p[1].replace(/^[A-Z]+/, '')]); });
          return { name: sh.name, path: sh.path, cells: cells, maxR: Math.min(maxR, 3000), maxC: Math.min(maxC, 60), cols: cols, hideC: hideC, rows: rows, merges: merges };
        });
      })).then(function (sheets) { return { sheets: sheets, X: X }; });
    });
  }

  /* ---------- writing your edits back ----------
     an edit is text (the old shape) or { v: text, bg: '#rrggbb' or '' (no fill), b: true/false (bold) } */
  function norm(e) { return e == null ? null : typeof e === 'object' ? e : { v: String(e) }; }
  function apply(buf, edits, Z) {
    var paths = Object.keys(edits || {}).filter(function (p) { return Object.keys(edits[p] || {}).length; });
    if (!paths.length) return Promise.resolve(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    var ents = Z.zipEntries(buf), E = {}, xs = new XMLSerializer(), dropCalc = false, fmt = false;
    ents.forEach(function (z) { E[z.name] = z; });
    paths = paths.filter(function (p) { return E[p]; });
    paths.forEach(function (p) { Object.keys(edits[p]).forEach(function (r) { var e = norm(edits[p][r]); if (e && ('bg' in e || 'b' in e)) fmt = true; }); });
    var names = paths.concat(fmt && E['xl/styles.xml'] ? ['xl/styles.xml'] : []);
    return Promise.all(names.map(function (p) { return Z.inflate(E[p]).then(function (u) { return new TextDecoder('utf-8').decode(u); }); })).then(function (xml) {
      var out = {}, sd = null, SN = '', xfFor = null;
      if (fmt && E['xl/styles.xml']) {
        sd = xp.parseFromString(xml[xml.length - 1], 'application/xml'); SN = sd.documentElement.namespaceURI;
        var fills = one(sd, 'fills'), fonts = one(sd, 'fonts'), xfs = one(sd, 'cellXfs'), memo = {}, fillMemo = {}, fontMemo = {};
        xfFor = function (old, e) {
          var key = old + '|' + ('bg' in e ? e.bg : '~') + '|' + ('b' in e ? e.b : '~'); if (key in memo) return memo[key];
          var list = kids(xfs, 'xf'), x = (list[old] || list[0]).cloneNode(true);
          if ('bg' in e) {
            var fid = 0;
            if (e.bg) { if (!(e.bg in fillMemo)) { var f = sd.createElementNS(SN, 'fill'), pf = sd.createElementNS(SN, 'patternFill'), fg = sd.createElementNS(SN, 'fgColor'), bgc = sd.createElementNS(SN, 'bgColor'); pf.setAttribute('patternType', 'solid'); fg.setAttribute('rgb', 'FF' + e.bg.replace('#', '').toUpperCase()); bgc.setAttribute('indexed', '64'); pf.appendChild(fg); pf.appendChild(bgc); f.appendChild(pf); fills.appendChild(f); fills.setAttribute('count', kids(fills, 'fill').length); fillMemo[e.bg] = kids(fills, 'fill').length - 1; } fid = fillMemo[e.bg]; }
            x.setAttribute('fillId', fid); x.setAttribute('applyFill', '1');
          }
          if ('b' in e && fonts) {
            var fk = (+x.getAttribute('fontId') || 0) + '|' + e.b;
            if (!(fk in fontMemo)) { var fl = kids(fonts, 'font'), fo = (fl[+x.getAttribute('fontId') || 0] || fl[0]).cloneNode(true); kids(fo, 'b').forEach(function (b) { fo.removeChild(b); }); if (e.b) fo.insertBefore(sd.createElementNS(SN, 'b'), fo.firstChild); fonts.appendChild(fo); fonts.setAttribute('count', kids(fonts, 'font').length); fontMemo[fk] = kids(fonts, 'font').length - 1; }
            x.setAttribute('fontId', fontMemo[fk]); x.setAttribute('applyFont', '1');
          }
          xfs.appendChild(x); xfs.setAttribute('count', list.length + 1); return (memo[key] = list.length);
        };
      }
      paths.forEach(function (p, i) {
        var doc = xp.parseFromString(xml[i], 'application/xml'), NS = doc.documentElement.namespaceURI, data = one(doc, 'sheetData'); if (!data) return;
        var rows = {}; kids(data, 'row').forEach(function (r) { rows[+r.getAttribute('r')] = r; });
        Object.keys(edits[p]).forEach(function (ref) {
          var m = ref.match(/^([A-Z]+)(\d+)$/), e = norm(edits[p][ref]); if (!m || !e) return;
          var n = +m[2], col = colNum(m[1]), r = rows[n];
          if (!r) { r = doc.createElementNS(NS, 'row'); r.setAttribute('r', n); var after = kids(data, 'row').filter(function (x) { return +x.getAttribute('r') > n; })[0]; data.insertBefore(r, after || null); rows[n] = r; }
          var c = null, cs = kids(r, 'c');
          for (var j = 0; j < cs.length && !c; j++) { var c0 = colNum(cs[j].getAttribute('r')); if (c0 === col) c = cs[j]; else if (c0 > col) { c = doc.createElementNS(NS, 'c'); c.setAttribute('r', ref); r.insertBefore(c, cs[j]); } }
          if (!c) { c = doc.createElementNS(NS, 'c'); c.setAttribute('r', ref); r.appendChild(c); }
          if (xfFor && ('bg' in e || 'b' in e)) c.setAttribute('s', xfFor(+c.getAttribute('s') || 0, e));
          if (!('v' in e)) return;
          var v = String(e.v), wasNum = !c.getAttribute('t') || c.getAttribute('t') === 'n';
          if (one(c, 'f')) dropCalc = true;
          while (c.firstChild) c.removeChild(c.firstChild); c.removeAttribute('t');
          if (v === '') return;
          if (wasNum && /^-?\d+([.,]\d+)?$/.test(v.trim()) && !/^0\d/.test(v.trim())) { var vv = doc.createElementNS(NS, 'v'); vv.textContent = v.trim().replace(',', '.'); c.appendChild(vv); return; }
          c.setAttribute('t', 'inlineStr'); var is = doc.createElementNS(NS, 'is'), t = doc.createElementNS(NS, 't'); t.setAttribute('xml:space', 'preserve'); t.textContent = v; is.appendChild(t); c.appendChild(is);
        });
        out[p] = XDECL + xs.serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
      });
      if (sd) out['xl/styles.xml'] = XDECL + xs.serializeToString(sd).replace(/^<\?xml[^>]*\?>\s*/, '');
      /* a formula typed over: Excel's list of formulas (calcChain) is dropped, Excel rebuilds it */
      var list = ents.filter(function (z) { return !(dropCalc && z.name === 'xl/calcChain.xml'); });
      var fix = dropCalc && E['xl/calcChain.xml'] ? ['[Content_Types].xml', 'xl/_rels/workbook.xml.rels'].filter(function (x) { return E[x]; }) : [];
      return Promise.all(fix.map(function (x) { return Z.inflate(E[x]).then(function (u) { return new TextDecoder('utf-8').decode(u); }); })).then(function (fx) {
        fix.forEach(function (x, i) { out[x] = fx[i].replace(/<Override[^>]*calcChain[^>]*\/>/g, '').replace(/<Relationship[^>]*calcChain[^>]*\/>/g, ''); });
        return Z.packAll(list.map(function (z) { return z.name in out ? { name: z.name, text: out[z.name] } : { keep: z }; }));
      });
    });
  }

  /* ---------- the view ---------- */
  var SW = [['', 'ui.xv-nofill', 'No fill'], ['#D9EAD3', 'ui.xv-green', 'Green'], ['#FFF2CC', 'ui.xv-yellow', 'Yellow'], ['#FCE4D6', 'ui.xv-orange', 'Orange'], ['#F4CCCC', 'ui.xv-red', 'Red'], ['#D9D9D9', 'ui.xv-grey', 'Grey'], ['#DDEBF7', 'ui.xv-blue', 'Blue']];
  function look(sh, X, edits, ref) {
    var c = sh.cells[ref], x = c ? X[c.s] || {} : {}, e = norm((edits[sh.path] || {})[ref]) || {};
    var v = 'v' in e ? e.v : c ? c.v : '', bg = 'bg' in e ? e.bg : x.bg, b = 'b' in e ? e.b : x.b, st = [];
    if (bg) st.push('background:' + bg); if (x.fg && x.fg.toLowerCase() !== '#000000') st.push('color:' + x.fg);
    if (b) st.push('font-weight:700'); if (x.i) st.push('font-style:italic');
    var al = x.al || (c && c.num && v !== '' && isFinite(+v) && !('v' in e) ? 'right' : ''); if (al === 'center' || al === 'right' || al === 'left') st.push('text-align:' + al);
    return { v: v, b: !!b, bg: bg || '', st: st.join(';'), wrap: !!x.wrap, f: !!(c && c.f && !('v' in e)) };
  }
  function sheetHtml(sh, X, edits) {
    var R = Math.max(sh.maxR, 1) + 3, C = Math.max(sh.maxC, 1) + 1, skip = {}, span = {};
    sh.merges.forEach(function (m) { span[colName(m[0]) + m[1]] = ' colspan="' + (m[2] - m[0] + 1) + '" rowspan="' + (m[3] - m[1] + 1) + '"'; for (var r = m[1]; r <= m[3]; r++) for (var c = m[0]; c <= m[2]; c++) if (r !== m[1] || c !== m[0]) skip[colName(c) + r] = 1; });
    var h = '<table class="xv-t"><colgroup><col style="width:38px">';
    for (var c = 1; c <= C; c++) if (!sh.hideC[c]) h += '<col style="width:' + Math.round(Math.max(28, Math.min(480, (sh.cols[c] || 8.43) * 7 + 5))) + 'px">';
    h += '</colgroup><thead><tr><th></th>';
    for (c = 1; c <= C; c++) if (!sh.hideC[c]) h += '<th>' + colName(c) + '</th>';
    h += '</tr></thead><tbody>';
    for (var r = 1; r <= R; r++) {
      var row = sh.rows[r] || {}; if (row.hidden) continue;
      h += '<tr' + (row.ht ? ' style="height:' + Math.round(row.ht * 1.333) + 'px"' : '') + '><th>' + r + '</th>';
      for (c = 1; c <= C; c++) {
        if (sh.hideC[c]) continue; var ref = colName(c) + r; if (skip[ref]) continue;
        var L = look(sh, X, edits, ref);
        h += '<td data-xvr="' + ref + '"' + (span[ref] || '') + (L.wrap ? ' class="w"' : '') + (L.st ? ' style="' + L.st + '"' : '') + '>' + esc(L.v) + '</td>';
      }
      h += '</tr>';
    }
    return h + '</tbody></table>';
  }
  function tsv(text) {   /* what Excel puts on the clipboard: rows by line, cells by tab, "quoted" when they hold a line break */
    var rows = [[]], cur = '', q = false, s = String(text || '').replace(/\r\n?/g, '\n').replace(/\n$/, '');
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (q) { if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"' && cur === '') q = true; else if (ch === '\t') { rows[rows.length - 1].push(cur); cur = ''; } else if (ch === '\n') { rows[rows.length - 1].push(cur); rows.push([]); cur = ''; } else cur += ch;
    }
    rows[rows.length - 1].push(cur); return rows;
  }
  function open(opt) {
    /* opt: { blob, title, edits, Z, start, cls, note, actions: [{ icon, label, run(close) }], onEdits(edits), download(blob) } */
    var box = document.createElement('div'); box.className = 'xv' + (opt.cls ? ' ' + opt.cls : '');   /* Team: dc-host, so its colours apply */
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    var tb = function (a, icon, label, more) { return '<button type="button" class="xv-tb" data-xv="' + a + '" title="' + esc(label) + '" aria-label="' + esc(label) + '"' + (more || '') + '><i class="bi bi-' + icon + '"></i></button>'; };
    box.innerHTML = '<div class="xv-top"><button type="button" class="xv-x" data-xv="close" aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button><b class="xv-title">' + esc(opt.title || '') + '</b>' +
      (opt.actions || []).map(function (a, i) { return '<button type="button" class="text-btn xv-act" data-xva="' + i + '"><i class="bi bi-' + a.icon + '"></i> <span>' + esc(a.label) + '</span></button>'; }).join('') +
      '<button type="button" class="pill-btn xv-dl" data-xv="dl"><i class="bi bi-download"></i> <span>' + esc(k('ui.xv-download', 'Download')) + '</span></button></div>' +
      (opt.note ? '<p class="xv-note">' + opt.note + '</p>' : '') +
      '<div class="xv-tabs" role="tablist"></div>' +
      '<div class="xv-tools" role="toolbar">' + tb('undo', 'arrow-counterclockwise', k('ui.xv-undo', 'Undo'), ' disabled') + tb('redo', 'arrow-clockwise', k('ui.xv-redo', 'Redo'), ' disabled') + '<span class="xv-sep"></span>' +
        tb('bold', 'type-bold', k('ui.xv-bold', 'Bold')) + tb('fill', 'paint-bucket', k('ui.xv-fill', 'Fill colour'), ' aria-haspopup="true"') + tb('clear', 'backspace', k('ui.xv-clear', 'Clear the cells')) + '<span class="xv-sep"></span>' +
        tb('copy', 'copy', k('ui.xv-copy', 'Copy')) + tb('paste', 'clipboard', k('ui.xv-paste', 'Paste')) +
        '<div class="xv-sw" hidden>' + SW.map(function (w) { return '<button type="button" data-xvfill="' + w[0] + '" title="' + esc(k(w[1], w[2])) + '" aria-label="' + esc(k(w[1], w[2])) + '" style="--sw:' + (w[0] || 'transparent') + '"></button>'; }).join('') + '</div></div>' +
      '<div class="xv-bar"><span class="xv-ref">–</span><textarea class="xv-in" rows="1" disabled placeholder="' + esc(k('ui.xv-tap', 'Tap a cell to change it')) + '"></textarea></div>' +
      '<div class="xv-grid" tabindex="0"><p class="xv-wait">' + esc(k('ui.xv-reading', 'Reading the file …')) + '</p></div><p class="xv-foot"></p>';
    document.body.appendChild(box); document.documentElement.classList.add('xv-on');
    var edits = JSON.parse(JSON.stringify(opt.edits || {})), book = null, cur = 0, saveT = 0, undo = [], redo = [], A = null, F = null, typing = null, drag = false;
    var grid = box.querySelector('.xv-grid'), inp = box.querySelector('.xv-in'), refEl = box.querySelector('.xv-ref'), foot = box.querySelector('.xv-foot'), tabs = box.querySelector('.xv-tabs'), sw = box.querySelector('.xv-sw');
    var touch = matchMedia('(pointer: coarse)').matches;
    function sh() { return book.sheets[cur]; }
    function td(ref) { return grid.querySelector('[data-xvr="' + ref + '"]'); }
    function nEdits() { return Object.keys(edits).reduce(function (a, p) { return a + Object.keys(edits[p] || {}).length; }, 0); }
    function showFoot() {
      var n = nEdits();
      if (!opt.onEdits) { foot.innerHTML = esc(n ? k(n === 1 ? 'ui.xv-n-temp1' : 'ui.xv-n-temp', n === 1 ? '1 change – it goes into the download, nothing is saved here' : '{n} changes – they go into the download, nothing is saved here', { n: n }) : k('ui.xv-temp', 'Nothing is saved here – your changes go into the download.')) + (n ? ' <button type="button" class="text-btn" data-xv="reset">' + esc(k('ui.xv-reset', 'Undo all')) + '</button>' : ''); return; }   /* a plan check keeps nothing */
      foot.innerHTML = n ? esc(k(n === 1 ? 'ui.xv-n-edits1' : 'ui.xv-n-edits', n === 1 ? '1 change of your own – kept on this device and in every download' : '{n} changes of your own – kept on this device and in every download', { n: n })) + ' <button type="button" class="text-btn" data-xv="reset">' + esc(k('ui.xv-reset', 'Undo all')) + '</button>' : esc(k('ui.xv-hint', 'Your changes are kept on this device and go into every download.'));
    }
    function save() { clearTimeout(saveT); saveT = setTimeout(function () { if (opt.onEdits) opt.onEdits(edits); showFoot(); }, 400); box.querySelector('[data-xv="undo"]').disabled = !undo.length; box.querySelector('[data-xv="redo"]').disabled = !redo.length; }
    function paint(ref) { var t = td(ref); if (!t) return; var L = look(sh(), book.X, edits, ref); t.textContent = L.v; t.setAttribute('style', L.st); }
    /* every change goes through here: a list of { ref, e } with the new edit for each cell; one step on the undo list */
    function change(list, keep) {
      var p = sh().path, ed = edits[p] || (edits[p] = {}), step = { p: p, cells: [] };
      list.forEach(function (x) {
        var before = ed[x.ref] === undefined ? undefined : JSON.parse(JSON.stringify(ed[x.ref])), now = Object.assign({}, norm(ed[x.ref]) || {}, x.e);
        step.cells.push({ ref: x.ref, before: before, after: now }); ed[x.ref] = now; paint(x.ref);
      });
      if (keep && undo.length && undo[undo.length - 1].p === p && undo[undo.length - 1].keep === keep) {   /* typing in one cell = one step */
        var last = undo[undo.length - 1]; step.cells.forEach(function (c) { var o = last.cells.filter(function (q) { return q.ref === c.ref; })[0]; if (o) o.after = c.after; else last.cells.push(c); });
      } else { step.keep = keep; undo.push(step); if (undo.length > 200) undo.shift(); }
      redo = []; save();
    }
    function back(fromList, toList, side) {
      var step = fromList.pop(); if (!step) return; toList.push(step);
      var si = book.sheets.map(function (s) { return s.path; }).indexOf(step.p); if (si >= 0 && si !== cur) { cur = si; drawTabs(); drawSheet(); }
      var ed = edits[step.p] || (edits[step.p] = {});
      step.cells.forEach(function (c) { var v = c[side]; if (v === undefined) delete ed[c.ref]; else ed[c.ref] = JSON.parse(JSON.stringify(v)); paint(c.ref); });
      typing = null; pickRef(step.cells[0].ref); save();
    }
    function rng() { if (!A) return null; var a = A.match(/^([A-Z]+)(\d+)$/), f = (F || A).match(/^([A-Z]+)(\d+)$/); return { c0: Math.min(colNum(a[1]), colNum(f[1])), c1: Math.max(colNum(a[1]), colNum(f[1])), r0: Math.min(+a[2], +f[2]), r1: Math.max(+a[2], +f[2]) }; }
    function refs() { var g = rng(), out = []; if (!g) return out; for (var r = g.r0; r <= g.r1; r++) for (var c = g.c0; c <= g.c1; c++) { var ref = colName(c) + r; if (td(ref)) out.push(ref); } return out; }
    function showSel() {
      [].forEach.call(grid.querySelectorAll('td.on, td.in'), function (t) { t.classList.remove('on', 'in'); });
      if (!A) return; var g = rng();
      if (g.r1 - g.r0 < 400 && g.c1 - g.c0 < 60) for (var r = g.r0; r <= g.r1; r++) for (var c = g.c0; c <= g.c1; c++) { var t = td(colName(c) + r); if (t) t.classList.add('in'); }
      var a = td(A); if (a) a.classList.add('on');
      var L = look(sh(), book.X, edits, A), n = refs().length;
      refEl.textContent = n > 1 ? A + ':' + (F || A) : A; inp.disabled = false; inp.value = L.v;
      inp.title = L.f ? k('ui.xv-formula', 'This cell has a formula – what you type replaces it') : '';
      box.querySelector('[data-xv="bold"]').setAttribute('aria-pressed', L.b);
    }
    function pickRef(ref, extend) { typing = null; if (extend && A) F = ref; else { A = ref; F = null; } showSel(); var t = td(F || A); if (t) t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    function move(dr, dc, extend) {
      var from = extend ? (F || A) : A; if (!from) return; var m = from.match(/^([A-Z]+)(\d+)$/), c = colNum(m[1]), r = +m[2], s0 = sh(), R = Math.max(s0.maxR, 1) + 3, C = Math.max(s0.maxC, 1) + 1;
      for (var i = 0; i < 400; i++) { c = Math.min(C, Math.max(1, c + dc)); r = Math.min(R, Math.max(1, r + dr)); if (td(colName(c) + r) || (dr === 0 && dc === 0)) break; if ((dc && (c === 1 || c === C)) || (dr && (r === 1 || r === R))) break; }
      if (td(colName(c) + r)) pickRef(colName(c) + r, extend);
    }
    function drawTabs() { tabs.innerHTML = book.sheets.map(function (s, i) { return '<button type="button" role="tab" data-xvs="' + i + '" aria-selected="' + (i === cur) + '">' + esc(s.name) + '</button>'; }).join(''); }
    function drawSheet() { grid.innerHTML = sheetHtml(sh(), book.X, edits); grid.scrollTop = 0; grid.scrollLeft = 0; A = F = null; typing = null; refEl.textContent = '–'; inp.value = ''; inp.disabled = true; }
    function copyText() { var g = rng(); if (!g) return ''; var out = []; for (var r = g.r0; r <= g.r1; r++) { var row = []; for (var c = g.c0; c <= g.c1; c++) { var v = look(sh(), book.X, edits, colName(c) + r).v; row.push(/[\t\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v); } out.push(row.join('\t')); } return out.join('\n'); }
    function pasteText(text) {
      if (!A) return; var rows = tsv(text), g = rng(), list = [];
      if (rows.length === 1 && rows[0].length === 1) refs().forEach(function (ref) { list.push({ ref: ref, e: { v: rows[0][0] } }); });   /* one value into every selected cell */
      else rows.forEach(function (row, i) { row.forEach(function (v, j) { var ref = colName(g.c0 + j) + (g.r0 + i); if (td(ref)) list.push({ ref: ref, e: { v: v } }); }); });
      if (list.length) change(list); showSel();
    }
    function flash(t) { foot.textContent = t; clearTimeout(flash.t); flash.t = setTimeout(showFoot, 2500); }
    function close() { clearTimeout(saveT); if (opt.onEdits) opt.onEdits(edits); box.remove(); document.documentElement.classList.remove('xv-on'); document.removeEventListener('keydown', onKey, true); }
    function onKey(e) {
      if (!book) return; var mod = e.ctrlKey || e.metaKey, inBar = document.activeElement === inp;
      if (e.key === 'Escape') { if (!sw.hidden) { sw.hidden = true; e.preventDefault(); return; } if (!inBar) { e.preventDefault(); close(); } return; }
      if (mod && (e.key === 'z' || e.key === 'Z') && !inBar) { e.preventDefault(); if (e.shiftKey) back(redo, undo, 'after'); else back(undo, redo, 'before'); return; }
      if (mod && (e.key === 'y' || e.key === 'Y') && !inBar) { e.preventDefault(); back(redo, undo, 'after'); return; }
      if (inBar || !A || !box.contains(document.activeElement)) return;
      if (mod && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); act('bold'); return; }
      if (mod) return;   /* copy and paste come as events */
      var keys = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (keys[e.key]) { e.preventDefault(); move(keys[e.key][0], keys[e.key][1], e.shiftKey); return; }
      if (e.key === 'Tab') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); return; }
      if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); act('clear'); return; }
      if (e.key.length === 1 && !e.altKey) { e.preventDefault(); inp.focus(); inp.value = e.key; typed(); }   /* start typing = replace the cell, as in Excel */
    }
    function typed() { if (!A) return; change([{ ref: A, e: { v: inp.value } }], 'type:' + A + ':' + (typing || (typing = Date.now()))); }
    function act(a) {
      if (a === 'undo') return back(undo, redo, 'before');
      if (a === 'redo') return back(redo, undo, 'after');
      if (!A) { flash(k('ui.xv-pick', 'Pick a cell first')); return; }
      if (a === 'bold') { var b = !look(sh(), book.X, edits, A).b; change(refs().map(function (r) { return { ref: r, e: { b: b } }; })); showSel(); return; }
      if (a === 'clear') { change(refs().map(function (r) { return { ref: r, e: { v: '' } }; })); showSel(); return; }
      if (a === 'fill') { if (sw.hidden) { var rb = box.querySelector('[data-xv="fill"]').getBoundingClientRect(); sw.style.top = Math.round(rb.bottom + 6) + 'px'; sw.style.left = Math.round(Math.max(8, Math.min(innerWidth - 290, rb.left - 8))) + 'px'; } sw.hidden = !sw.hidden; return; }   /* fixed, so the scrolling toolbar doesn't cut it off */
      if (a === 'copy') { var t = copyText(); (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { flash(k('ui.xv-copied', 'Copied')); }, function () { flash(k('ui.xv-no-clip', 'The browser did not allow it – use Ctrl+C / Ctrl+V')); }); return; }
      if (a === 'paste') { (navigator.clipboard && navigator.clipboard.readText ? navigator.clipboard.readText() : Promise.reject()).then(pasteText, function () { flash(k('ui.xv-no-clip', 'The browser did not allow it – use Ctrl+C / Ctrl+V')); }); }
    }
    document.addEventListener('keydown', onKey, true);
    box.addEventListener('copy', function (e) { if (document.activeElement === inp || !A) return; e.preventDefault(); e.clipboardData.setData('text/plain', copyText()); flash(k('ui.xv-copied', 'Copied')); });
    box.addEventListener('cut', function (e) { if (document.activeElement === inp || !A) return; e.preventDefault(); e.clipboardData.setData('text/plain', copyText()); act('clear'); });
    box.addEventListener('paste', function (e) { if (document.activeElement === inp || !A) return; e.preventDefault(); pasteText(e.clipboardData.getData('text/plain')); });
    inp.addEventListener('input', typed);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.altKey) { e.preventDefault(); typing = null; grid.focus({ preventScroll: true }); move(1, 0); }
      else if (e.key === 'Tab') { e.preventDefault(); typing = null; grid.focus({ preventScroll: true }); move(0, e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') { e.preventDefault(); if (typing) back(undo, redo, 'before'); typing = null; grid.focus({ preventScroll: true }); }
    });
    grid.addEventListener('pointerdown', function (e) { var t = e.target.closest('[data-xvr]'); if (!t || e.button) return; pickRef(t.dataset.xvr, e.shiftKey); if (!touch) { drag = e.pointerType === 'mouse'; grid.focus({ preventScroll: true }); e.preventDefault(); } sw.hidden = true; });
    grid.addEventListener('pointermove', function (e) { if (!drag) return; var t = document.elementFromPoint(e.clientX, e.clientY); t = t && t.closest && t.closest('[data-xvr]'); if (t && t.dataset.xvr !== (F || A)) { F = t.dataset.xvr; showSel(); } });
    document.addEventListener('pointerup', function () { drag = false; });
    box.addEventListener('click', function (e) {
      var t = e.target, b;
      if ((b = t.closest('[data-xvs]'))) { cur = +b.dataset.xvs; drawTabs(); drawSheet(); return; }
      if ((b = t.closest('[data-xvfill]'))) { var bg = b.dataset.xvfill; sw.hidden = true; if (A) { change(refs().map(function (r) { return { ref: r, e: { bg: bg } }; })); showSel(); } return; }
      if ((b = t.closest('[data-xva]'))) { var ac = (opt.actions || [])[+b.dataset.xva]; if (ac) ac.run(close, edits); return; }
      if ((b = t.closest('[data-xv]'))) {
        var a = b.dataset.xv;
        if (a === 'close') return close();
        if (a === 'reset') { if (!confirm(k('ui.xv-reset-q', 'Undo all your own changes in this file?'))) return; edits = {}; undo = []; redo = []; if (opt.onEdits) opt.onEdits(edits); save(); drawSheet(); showFoot(); return; }
        if (a === 'dl') { clearTimeout(saveT); if (opt.onEdits) opt.onEdits(edits); b.disabled = true; opt.blob.arrayBuffer().then(function (buf) { return apply(buf, edits, opt.Z); }).then(function (bl) { b.disabled = false; opt.download(bl); }, function (er) { b.disabled = false; foot.textContent = k('ui.dc-x-failed', 'The Excel file could not be made.'); try { console.warn('[xv]', er); } catch (e2) {} }); return; }
        act(a);
      }
    });
    opt.blob.arrayBuffer().then(function (buf) { return read(buf, opt.Z); }).then(function (bk) {
      book = bk; if (!book.sheets.length) { grid.innerHTML = '<p class="xv-wait">' + esc(k('ui.dc-x-failed', 'The Excel file could not be made.')) + '</p>'; return; }
      var st = book.sheets.map(function (s) { return s.path; }).indexOf(opt.start); cur = st >= 0 ? st : 0; drawTabs(); drawSheet(); showFoot();
    }).catch(function (er) { grid.innerHTML = '<p class="xv-wait">' + esc(k('ui.dc-x-failed', 'The Excel file could not be made.')) + '</p>'; try { console.warn('[xv]', er); } catch (e2) {} });
    return { close: close, box: box, edits: function () { return edits; } };
  }
  window.XlsxView = { read: read, apply: apply, open: open };
})();
