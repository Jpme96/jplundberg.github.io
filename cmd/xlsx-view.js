/* See and edit an Excel file on the device (JP 2026-11-14: "preview the file and edit it myself – any cell, like Excel").
   Used by Document control (Excel with colours) in cmd and in Team (copied there by _team/build.py).
   XlsxView.read(buf, Z)        → Promise<book>: the sheets with their cells, colours, bold, widths and merged cells
   XlsxView.apply(buf, edits, Z) → Promise<Blob>: the same file with your edits written in ({ sheetPath: { A5: 'text' } });
                                   cell styles stay, a formula you typed over becomes your text
   XlsxView.open(opt)            → shows the file full screen: sheet tabs, the cells, a bar to type in, Download
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

  /* ---------- writing your edits back ---------- */
  function apply(buf, edits, Z) {
    var paths = Object.keys(edits || {}).filter(function (p) { return Object.keys(edits[p] || {}).length; });
    if (!paths.length) return Promise.resolve(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    var ents = Z.zipEntries(buf), E = {}, xs = new XMLSerializer(), dropCalc = false;
    ents.forEach(function (z) { E[z.name] = z; });
    paths = paths.filter(function (p) { return E[p]; });
    return Promise.all(paths.map(function (p) { return Z.inflate(E[p]).then(function (u) { return new TextDecoder('utf-8').decode(u); }); })).then(function (xml) {
      var out = {};
      paths.forEach(function (p, i) {
        var doc = xp.parseFromString(xml[i], 'application/xml'), NS = doc.documentElement.namespaceURI, data = one(doc, 'sheetData'); if (!data) return;
        var rows = {}; kids(data, 'row').forEach(function (r) { rows[+r.getAttribute('r')] = r; });
        Object.keys(edits[p]).forEach(function (ref) {
          var m = ref.match(/^([A-Z]+)(\d+)$/); if (!m) return;
          var n = +m[2], col = colNum(m[1]), r = rows[n];
          if (!r) { r = doc.createElementNS(NS, 'row'); r.setAttribute('r', n); var after = kids(data, 'row').filter(function (x) { return +x.getAttribute('r') > n; })[0]; data.insertBefore(r, after || null); rows[n] = r; }
          var c = null, cs = kids(r, 'c');
          for (var j = 0; j < cs.length && !c; j++) { var c0 = colNum(cs[j].getAttribute('r')); if (c0 === col) c = cs[j]; else if (c0 > col) { c = doc.createElementNS(NS, 'c'); c.setAttribute('r', ref); r.insertBefore(c, cs[j]); } }
          if (!c) { c = doc.createElementNS(NS, 'c'); c.setAttribute('r', ref); r.appendChild(c); }
          var v = String(edits[p][ref]), wasNum = !c.getAttribute('t') || c.getAttribute('t') === 'n';
          if (one(c, 'f')) dropCalc = true;
          while (c.firstChild) c.removeChild(c.firstChild); c.removeAttribute('t');
          if (v === '') return;
          if (wasNum && /^-?\d+([.,]\d+)?$/.test(v.trim()) && !/^0\d/.test(v.trim())) { var vv = doc.createElementNS(NS, 'v'); vv.textContent = v.trim().replace(',', '.'); c.appendChild(vv); return; }
          c.setAttribute('t', 'inlineStr'); var is = doc.createElementNS(NS, 'is'), t = doc.createElementNS(NS, 't'); t.setAttribute('xml:space', 'preserve'); t.textContent = v; is.appendChild(t); c.appendChild(is);
        });
        out[p] = XDECL + xs.serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
      });
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
  function cellHtml(sh, X, rn, cn, span) {
    var ref = colName(cn) + rn, c = sh.cells[ref], x = c ? X[c.s] || {} : {}, st = [];
    if (x.bg) st.push('background:' + x.bg); if (x.fg && x.fg.toLowerCase() !== '#000000') st.push('color:' + x.fg);
    if (x.b) st.push('font-weight:700'); if (x.i) st.push('font-style:italic');
    var al = x.al || (c && c.num && c.v !== '' && isFinite(+c.v) ? 'right' : ''); if (al === 'center' || al === 'right' || al === 'left') st.push('text-align:' + al);
    return '<td data-xvr="' + ref + '"' + (span || '') + (x.wrap ? ' class="w"' : '') + (st.length ? ' style="' + st.join(';') + '"' : '') + '>' + esc(c ? c.v : '') + '</td>';
  }
  function sheetHtml(sh, X) {
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
      for (c = 1; c <= C; c++) { if (sh.hideC[c]) continue; var ref = colName(c) + r; if (skip[ref]) continue; h += cellHtml(sh, X, r, c, span[ref]); }
      h += '</tr>';
    }
    return h + '</tbody></table>';
  }
  function open(opt) {
    /* opt: { blob, title, edits, Z, start, onEdits(edits), download(blob) } */
    var box = document.createElement('div'); box.className = 'xv'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<div class="xv-top"><button type="button" class="xv-x" data-xv="close" aria-label="' + esc(k('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button><b class="xv-title">' + esc(opt.title || '') + '</b>' +
      '<button type="button" class="pill-btn xv-dl" data-xv="dl"><i class="bi bi-download"></i> <span>' + esc(k('ui.xv-download', 'Download')) + '</span></button></div>' +
      '<div class="xv-tabs" role="tablist"></div><div class="xv-bar"><span class="xv-ref">–</span><textarea class="xv-in" rows="1" disabled placeholder="' + esc(k('ui.xv-tap', 'Tap a cell to change it')) + '"></textarea></div>' +
      '<div class="xv-grid"><p class="xv-wait">' + esc(k('ui.xv-reading', 'Reading the file …')) + '</p></div><p class="xv-foot"></p>';
    document.body.appendChild(box); document.documentElement.classList.add('xv-on');
    var edits = JSON.parse(JSON.stringify(opt.edits || {})), book = null, cur = 0, sel = null, saveT = 0;
    var grid = box.querySelector('.xv-grid'), inp = box.querySelector('.xv-in'), refEl = box.querySelector('.xv-ref'), foot = box.querySelector('.xv-foot'), tabs = box.querySelector('.xv-tabs');
    function nEdits() { return Object.keys(edits).reduce(function (a, p) { return a + Object.keys(edits[p] || {}).length; }, 0); }
    function showFoot() { var n = nEdits(); foot.innerHTML = n ? esc(k(n === 1 ? 'ui.xv-n-edits1' : 'ui.xv-n-edits', n === 1 ? '1 change of your own – kept on this device and in every download' : '{n} changes of your own – kept on this device and in every download', { n: n })) + ' <button type="button" class="text-btn" data-xv="reset">' + esc(k('ui.xv-reset', 'Undo all')) + '</button>' : esc(k('ui.xv-hint', 'Your changes are kept on this device and go into every download.')); }
    function drawTabs() { tabs.innerHTML = book.sheets.map(function (s, i) { return '<button type="button" role="tab" data-xvs="' + i + '" aria-selected="' + (i === cur) + '">' + esc(s.name) + '</button>'; }).join(''); }
    function drawSheet() { var sh = book.sheets[cur]; grid.innerHTML = sheetHtml(sh, book.X); grid.scrollTop = 0; grid.scrollLeft = 0; pick(null); }
    function pick(td) {
      if (sel) sel.classList.remove('on'); sel = td;
      if (!td) { refEl.textContent = '–'; inp.value = ''; inp.disabled = true; return; }
      td.classList.add('on'); var ref = td.dataset.xvr, c = book.sheets[cur].cells[ref];
      refEl.textContent = ref; inp.disabled = false; inp.value = c ? c.v : ''; inp.title = c && c.f ? k('ui.xv-formula', 'This cell has a formula – what you type replaces it') : '';
      if (!/Mobi/.test(navigator.userAgent)) { inp.focus(); inp.select(); }
    }
    function setVal(v) {
      if (!sel) return; var sh = book.sheets[cur], ref = sel.dataset.xvr, c = sh.cells[ref] || (sh.cells[ref] = { v: '', s: 0, num: true });
      c.v = v; c.f = false; (edits[sh.path] || (edits[sh.path] = {}))[ref] = v; sel.textContent = v;
      clearTimeout(saveT); saveT = setTimeout(function () { if (opt.onEdits) opt.onEdits(edits); showFoot(); }, 400);
    }
    function move(dr, dc) {
      if (!sel) return; var ref = sel.dataset.xvr, m = ref.match(/^([A-Z]+)(\d+)$/), c = colNum(m[1]) + dc, r = +m[2] + dr;
      var nx = grid.querySelector('[data-xvr="' + colName(Math.max(1, c)) + Math.max(1, r) + '"]'); if (nx) { pick(nx); nx.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    }
    function close() { clearTimeout(saveT); if (opt.onEdits) opt.onEdits(edits); box.remove(); document.documentElement.classList.remove('xv-on'); document.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape' && document.activeElement !== inp) { e.preventDefault(); close(); } }
    document.addEventListener('keydown', onKey, true);
    inp.addEventListener('input', function () { setVal(inp.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.altKey) { e.preventDefault(); move(1, 0); }
      else if (e.key === 'Tab') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') { e.preventDefault(); inp.blur(); }
    });
    box.addEventListener('click', function (e) {
      var t = e.target, b;
      if ((b = t.closest('[data-xvr]'))) { pick(b); return; }
      if ((b = t.closest('[data-xvs]'))) { cur = +b.dataset.xvs; drawTabs(); drawSheet(); return; }
      if ((b = t.closest('[data-xv]'))) {
        var a = b.dataset.xv;
        if (a === 'close') return close();
        if (a === 'reset') { if (!confirm(k('ui.xv-reset-q', 'Undo all your own changes in this file?'))) return; edits = {}; if (opt.onEdits) opt.onEdits(edits); book = null; load(); return; }
        if (a === 'dl') { clearTimeout(saveT); if (opt.onEdits) opt.onEdits(edits); b.disabled = true; opt.blob.arrayBuffer().then(function (buf) { return apply(buf, edits, opt.Z); }).then(function (bl) { b.disabled = false; opt.download(bl); }, function (er) { b.disabled = false; foot.textContent = k('ui.dc-x-failed', 'The Excel file could not be made.'); try { console.warn('[xv]', er); } catch (e2) {} }); }
      }
    });
    function load() {
      opt.blob.arrayBuffer().then(function (buf) { return apply(buf, edits, opt.Z).then(function (bl) { return bl.arrayBuffer(); }); }).then(function (b2) { return read(b2, opt.Z); }).then(function (bk) {
        book = bk; if (!book.sheets.length) { grid.innerHTML = '<p class="xv-wait">' + esc(k('ui.dc-x-failed', 'The Excel file could not be made.')) + '</p>'; return; }
        var st = book.sheets.map(function (s) { return s.path; }).indexOf(opt.start); cur = st >= 0 ? st : 0; drawTabs(); drawSheet(); showFoot();
      }).catch(function (er) { grid.innerHTML = '<p class="xv-wait">' + esc(k('ui.dc-x-failed', 'The Excel file could not be made.')) + '</p>'; try { console.warn('[xv]', er); } catch (e2) {} });
    }
    load();
    return { close: close, box: box };
  }
  window.XlsxView = { read: read, apply: apply, open: open };
})();
