/* Writing studio for jplundberg.com articles and projects (opens full screen from Admin → Website → Articles & projects).
   - Its own full-screen view: the editor and the live preview each scroll on their own (on a phone: Write | Preview).
   - English and Norwegian versions share a `ref`, so the language switch on the site finds the other one.
   - No code: key figures, charts (ring, line, bars, donut, timeline) and project phases are made with simple forms
     and written to the front matter for you. "Insert chart" puts [chart 2] in the text, and the site shows the chart there.
   - Anything else in the front matter is kept exactly as it is (Advanced).
   - Save as draft (published: false) or Publish. Autosaves on this device while you type (localStorage dash.writer:*).
   Needs the Worker's /cmd/api/article (paste the newest _cloudflare/worker.js). */
(function () {
  "use strict";
  if (!window.Vault) return;
  var NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(h) { if (window.Quick && window.Quick.toast) window.Quick.toast(h); }
  function slug(t) { return String(t || '').toLowerCase().replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'untitled'; }
  var SIMPLE = ['title', 'lang', 'ref', 'date', 'category', 'summary', 'image', 'role', 'organisation', 'period', 'published'];
  var BLOCKS = ['stats', 'charts', 'parts'];

  /* ---------- a small YAML reader/writer for the lists in the front matter ---------- */
  function scalar(v) {
    v = String(v).trim();
    if (/^".*"$/.test(v)) { try { return JSON.parse(v); } catch (e) { return v.slice(1, -1); } }
    if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
    if (v === '[]') return [];
    return v;
  }
  function yparse(lines) {
    var Ls = lines.filter(function (l) { return l.trim() && !/^\s*#/.test(l); }).map(function (l) { var t = l.replace(/^\s+/, ''); return { ind: l.length - t.length, text: t.replace(/\s+$/, '') }; });
    if (!Ls.length) return null;
    var isItem = function (t) { return /^-( |$)/.test(t); };
    function P(i, ind) {
      if (isItem(Ls[i].text)) {
        var arr = [];
        while (i < Ls.length && Ls[i].ind === ind && isItem(Ls[i].text)) {
          var rest = Ls[i].text.replace(/^-\s*/, ''), itemInd = ind + (Ls[i].text.length - rest.length);
          if (!rest) { if (i + 1 < Ls.length && Ls[i + 1].ind > ind) { var r0 = P(i + 1, Ls[i + 1].ind); arr.push(r0[0]); i = r0[1]; } else { arr.push(''); i++; } }
          else if (/^[^\s:][^:]*:( |$)/.test(rest) && !/^["']/.test(rest)) { Ls[i] = { ind: itemInd, text: rest }; var r1 = P(i, itemInd); arr.push(r1[0]); i = r1[1]; }
          else { arr.push(scalar(rest)); i++; }
        }
        return [arr, i];
      }
      var obj = {};
      while (i < Ls.length && Ls[i].ind === ind && !isItem(Ls[i].text)) {
        var m = Ls[i].text.match(/^([^:]+?):(?:\s+(.*))?$/); i++;
        if (!m) continue;
        var k = m[1].trim(), v = m[2];
        if (v == null || v === '') {
          if (i < Ls.length && (Ls[i].ind > ind || (Ls[i].ind === ind && isItem(Ls[i].text)))) { var r2 = P(i, Ls[i].ind); obj[k] = r2[0]; i = r2[1]; } else obj[k] = '';
        } else if (v === '|' || v === '>' || v === '|-' || v === '>-') {
          var parts = []; while (i < Ls.length && Ls[i].ind > ind) { parts.push(Ls[i].text); i++; }
          obj[k] = parts.join(v[0] === '|' ? '\n' : ' ');
        } else {
          while (i < Ls.length && Ls[i].ind > ind && !/^[^\s:][^:]*:( |$)/.test(Ls[i].text) && !isItem(Ls[i].text)) { v += ' ' + Ls[i].text; i++; }
          obj[k] = scalar(v);
        }
      }
      return [obj, i];
    }
    return P(0, Ls[0].ind)[0];
  }
  var NUMK = { percent: 1, progress: 1 };
  function yv(v, k, parent) {
    var s = String(v).trim();
    if (/^-?\d+(\.\d+)?$/.test(s) && (NUMK[k] || (k === 'value' && parent === 'points'))) return s;
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(s) && (k === 'start' || k === 'end')) return s;
    return s === '' || /[:#\[\]{}&*!|>'"%@`,]|^\s|\s$|^[-?]/.test(s) || /^(true|false|yes|no|null|on|off|~)$/i.test(s) || /^[-+.\d][\d.,:\s-]*$/.test(s) ? JSON.stringify(s) : s;
  }
  function empty(v) { return v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).some(function (k) { return !empty(v[k]); })); }
  function ydump(k, v, ind, parent) {
    var pad = new Array(ind + 1).join(' ');
    if (Array.isArray(v)) {
      var items = v.filter(function (x) { return !empty(x); }); if (!items.length) return [];
      var out = [pad + k + ':'];
      items.forEach(function (it) {
        if (it && typeof it === 'object' && !Array.isArray(it)) {
          var lines = []; Object.keys(it).forEach(function (kk) { if (!empty(it[kk])) lines = lines.concat(ydump(kk, it[kk], ind + 4, k)); });
          if (lines.length) { lines[0] = pad + '  - ' + lines[0].slice(ind + 4); out = out.concat(lines); }
        } else out.push(pad + '  - ' + yv(it, '', k));
      });
      return out;
    }
    if (v && typeof v === 'object') { var o = [pad + k + ':']; Object.keys(v).forEach(function (kk) { if (!empty(v[kk])) o = o.concat(ydump(kk, v[kk], ind + 2, k)); }); return o.length > 1 ? o : []; }
    return empty(v) ? [] : [pad + k + ': ' + yv(v, k, parent)];
  }

  /* ---------- front matter: simple keys and the lists become forms; everything else is kept as it is ---------- */
  function parse(text) {
    var m = String(text || '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/), out = { fm: {}, stats: [], charts: [], parts: [], rest: '', body: '' };
    if (!m) { out.body = text || ''; return out; }
    var lines = m[1].split('\n'), rest = [], i = 0;
    while (i < lines.length) {
      var ln = lines[i], km = ln.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
      if (!km) { rest.push(ln); i++; continue; }
      var j = i + 1; while (j < lines.length && (/^\s/.test(lines[j]) || /^-( |$)/.test(lines[j]) || !lines[j].trim())) j++;
      var sub = lines.slice(i + 1, j), key = km[1];
      if (SIMPLE.indexOf(key) > -1) {
        var v = km[2]; sub.forEach(function (s) { if (s.trim()) v += ' ' + s.trim(); });
        out.fm[key] = scalar(v.trim());
      } else if (BLOCKS.indexOf(key) > -1 && !km[2].trim()) {
        var val = yparse(sub); out[key] = Array.isArray(val) ? val.filter(function (x) { return x && typeof x === 'object'; }) : [];
      } else rest = rest.concat(lines.slice(i, j));
      i = j;
    }
    while (rest.length && !rest[rest.length - 1].trim()) rest.pop();
    out.rest = rest.join('\n').trim(); out.body = m[2].replace(/^\n/, '');
    return out;
  }
  function build(d) {
    var fm = ['title', 'lang', 'ref', 'date', 'category', 'summary', 'image', 'role', 'organisation', 'period'].filter(function (k) { return d.fm[k] != null && String(d.fm[k]).trim() !== ''; })
      .map(function (k) { return k + ': ' + (k === 'date' ? String(d.fm[k]).trim() : yv(d.fm[k], k)); });
    BLOCKS.forEach(function (k) { fm = fm.concat(ydump(k, d[k] || [], 0, '')); });
    if (d.rest && d.rest.trim()) fm.push(d.rest.trim());
    if (d.fm.published === 'false' || d.fm.published === false) fm.push('published: false');
    return '---\n' + fm.join('\n') + '\n---\n\n' + String(d.body || '').trim() + '\n';
  }

  /* ---------- a small Markdown renderer for the preview ---------- */
  function inline(s) {
    return esc(s).replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function md(src) {
    var out = [], para = [], list = null, quote = [];
    var flushP = function () { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
    var flushL = function () { if (list) { out.push('<' + list.t + '>' + list.items.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</' + list.t + '>'); list = null; } };
    var flushQ = function () { if (quote.length) { out.push('<blockquote><p>' + inline(quote.join(' ')) + '</p></blockquote>'); quote = []; } };
    var flush = function () { flushP(); flushL(); flushQ(); };
    String(src || '').split('\n').forEach(function (ln) {
      var h = ln.match(/^(#{1,4})\s+(.*)$/), ul = ln.match(/^\s*[-*]\s+(.*)$/), ol = ln.match(/^\s*\d+[.)]\s+(.*)$/), q = ln.match(/^>\s?(.*)$/);
      if (/^\s*\[(?:chart|diagram|graf|figur) \d+\]\s*$/i.test(ln)) { flush(); out.push('<p>' + esc(ln.trim()) + '</p>'); return; }
      if (/^\s*<(figure|div|table|iframe|section|p|img)/i.test(ln)) { flush(); out.push('<div class="wr-raw">' + L('[HTML block – shown on the site]', '[HTML-blokk – vises på nettstedet]') + '</div>'); return; }
      if (h) { flush(); var n = Math.max(2, h[1].length); out.push('<h' + n + '>' + inline(h[2]) + '</h' + n + '>'); return; }
      if (ul || ol) { flushP(); flushQ(); var t = ul ? 'ul' : 'ol'; if (!list || list.t !== t) { flushL(); list = { t: t, items: [] }; } list.items.push((ul || ol)[1]); return; }
      if (q) { flushP(); flushL(); quote.push(q[1]); return; }
      if (!ln.trim()) { flush(); return; }
      if (/^---+$/.test(ln.trim())) { flush(); out.push('<hr>'); return; }
      flushL(); flushQ(); para.push(ln.trim());
    });
    flush();
    return out.join('\n');
  }

  /* ---------- state ---------- */
  var W = null;   /* { col, ref, isNew, lang, view, en: {path, sha, d}, nb: {...} } */
  function blank(col, lang) { return { path: null, sha: null, d: { fm: { title: '', lang: lang, ref: '', date: new Date().toISOString().slice(0, 10), category: col === 'articles' ? 'Work' : '', summary: '' }, stats: [], charts: [], parts: [], rest: '', body: '' } }; }
  function key() { return 'dash.writer:' + W.col + '|' + (W.ref || 'new'); }
  function autosave() { if (!W) return; try { localStorage.setItem(key(), JSON.stringify({ at: Date.now(), en: W.en.d, nb: W.nb.d })); } catch (e) {} msg(L('Autosaved on this device', 'Lagret automatisk på denne enheten')); }
  function fix(d) { d.stats = d.stats || []; d.charts = d.charts || []; d.parts = d.parts || []; d.fm = d.fm || {}; return d; }
  function restore() { try { var v = JSON.parse(localStorage.getItem(key())); if (v && v.en && v.nb) { W.en.d = fix(v.en); W.nb.d = fix(v.nb); return v.at; } } catch (e) {} return null; }
  function api(method, body, q) {
    return fetch('/cmd/api/article' + (q || ''), { method: method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { j._s = r.status; return j; }, function () { return { _s: r.status, error: r.status === 404 ? 'old-worker' : 'bad answer' }; }); });
  }
  function D() { return W[W.lang].d; }

  /* ---------- open ---------- */
  function open(detail) {
    var col = detail.col === 'projects' ? 'projects' : 'articles';
    W = { col: col, ref: detail.isNew ? '' : detail.ref, isNew: !!detail.isNew, lang: NB ? 'nb' : 'en', view: 'write', en: blank(col, 'en'), nb: blank(col, 'nb'), loading: !detail.isNew };
    shell();
    if (detail.isNew) { var at = restore(); if (at) toast('<i class="bi bi-arrow-counterclockwise"></i> ' + L('Your unsaved draft is back', 'Det ulagrede utkastet ditt er tilbake')); draw(); return; }
    draw();
    var items = (window.WebsiteItems && window.WebsiteItems.list()) || [];
    var go = function (items) {
      var mine = items.filter(function (x) { return x.collection === col && x.ref === detail.ref; });
      if (!mine.length) { W.loading = false; W.err = L('Couldn’t find it – reload the list.', 'Fant den ikke – last inn listen på nytt.'); draw(); return; }
      Promise.all(mine.map(function (x) { return api('GET', null, '?path=' + encodeURIComponent(x.path)).then(function (j) { return { x: x, j: j }; }); })).then(function (res) {
        if (!W) return;
        W.loading = false;
        res.forEach(function (r) {
          if (r.j.error) { W.err = r.j.error === 'old-worker' ? 'worker' : r.j.error; return; }
          var lg = r.x.lang === 'nb' ? 'nb' : 'en'; W[lg] = { path: r.j.path, sha: r.j.sha, d: parse(r.j.text) };
        });
        var at = restore(); if (at) toast('<i class="bi bi-arrow-counterclockwise"></i> ' + L('Unsaved changes from ', 'Ulagrede endringer fra ') + new Date(at).toLocaleString(NB ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + L(' are back', ' er tilbake'));
        if (!W.en.path && W.nb.path) W.lang = 'nb'; if (!W.nb.path && W.en.path) W.lang = 'en';
        draw();
      });
    };
    if (items.length) go(items); else fetch('/cmd/api/content', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { go(j.items || []); }).catch(function () { W.loading = false; W.err = L('No connection', 'Ingen forbindelse'); draw(); });
  }
  function close() {
    var s = document.getElementById('wrStudio'); if (s) s.remove();
    document.documentElement.classList.remove('wrs-open'); W = null;
    if (window.WebsiteItems) window.WebsiteItems.reload();
  }

  /* ---------- the full-screen studio ---------- */
  function shell() {
    var s = document.getElementById('wrStudio');
    if (!s) {
      s = document.createElement('div'); s.id = 'wrStudio'; s.className = 'wrs'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true');
      document.body.appendChild(s);
    }
    s.innerHTML = '<header class="wrs-top"></header><div class="wrs-main"><section class="wrs-ed" id="wrEd"></section><section class="wrs-pv"><div class="wrs-pvh"><b><i class="bi bi-eye"></i> ' + L('Preview', 'Forhåndsvisning') + '</b><small>' + L('Only you see this until you publish', 'Bare du ser dette til du publiserer') + '</small></div><div class="wrs-frame"><iframe id="wrFrame" title="' + L('Preview', 'Forhåndsvisning') + '"></iframe></div></section></div>';
    document.documentElement.classList.add('wrs-open');
  }
  function topbar() {
    var t = document.querySelector('#wrStudio .wrs-top'); if (!t || !W) return;
    var cur = W[W.lang], d = cur.d, pubd = !(d.fm.published === 'false' || d.fm.published === false) && !!cur.path;
    var kind = W.col === 'projects' ? (W.isNew ? L('New project', 'Nytt prosjekt') : L('Project', 'Prosjekt')) : (W.isNew ? L('New article', 'Ny artikkel') : L('Article', 'Artikkel'));
    t.innerHTML = '<button type="button" class="icon-btn" data-wrclose aria-label="' + esc(L('Close', 'Lukk')) + '"><i class="bi bi-x-lg"></i></button>' +
      '<div class="wrs-name"><b>' + esc(kind) + '</b><span class="wr-state ' + (cur.path ? (pubd ? 'on' : 'draft') : 'new') + '">' + (cur.path ? (pubd ? L('Live', 'Live') : L('Draft', 'Utkast')) : L('Not saved yet', 'Ikke lagret ennå')) + '</span></div>' +
      '<span class="aw-lang" role="group" aria-label="' + esc(L('Language', 'Språk')) + '"><button type="button" data-wrlang="en" aria-pressed="' + (W.lang === 'en') + '">EN' + (W.en.d.fm.title ? '' : ' ·') + '</button><button type="button" data-wrlang="nb" aria-pressed="' + (W.lang === 'nb') + '">NO' + (W.nb.d.fm.title ? '' : ' ·') + '</button></span>' +
      '<span class="aw-lang wrs-view" role="group"><button type="button" data-wrview="write" aria-pressed="' + (W.view === 'write') + '">' + L('Write', 'Skriv') + '</button><button type="button" data-wrview="preview" aria-pressed="' + (W.view === 'preview') + '">' + L('Preview', 'Forhåndsvis') + '</button></span>' +
      '<span class="wrs-msg" id="wrMsg"></span>' +
      '<span class="wrs-more"><button type="button" class="icon-btn" data-wrmore aria-label="' + esc(L('More', 'Mer')) + '" aria-expanded="false"><i class="bi bi-three-dots"></i></button><span class="wrs-menu" hidden>' +
        '<button type="button" class="wrs-mdraft" data-wrsave="draft"><i class="bi bi-file-earmark"></i> ' + (pubd ? L('Unpublish (make it a draft)', 'Avpubliser (gjør til utkast)') : L('Save draft', 'Lagre utkast')) + '</button>' + '<button type="button" data-wrreset><i class="bi bi-arrow-counterclockwise"></i> ' + (W.isNew ? L('Start over', 'Start på nytt') : L('Discard changes', 'Forkast endringer')) + '</button>' +
        (!W.isNew && (W.en.path || W.nb.path) ? '<button type="button" data-wrdel class="danger"><i class="bi bi-trash3"></i> ' + L('Delete', 'Slett') + '</button>' : '') + '</span></span>' +
      '<button type="button" class="text-btn" data-wrsave="draft">' + (pubd ? L('Unpublish', 'Avpubliser') : L('Save draft', 'Lagre utkast')) + '</button>' +
      '<button type="button" class="pill-btn" data-wrsave="pub" aria-label="' + esc(pubd ? L('Update', 'Oppdater') : L('Publish', 'Publiser')) + '"><i class="bi bi-cloud-upload"></i><span class="wrs-pl"> ' + (pubd ? L('Update', 'Oppdater') : L('Publish', 'Publiser')) + '</span></button>';
    document.getElementById('wrStudio').dataset.view = W.view;
  }
  function msg(t) { var m = document.getElementById('wrMsg'); if (m) m.textContent = t; }

  /* ---------- editor ---------- */
  var ICONS = ['bar-chart', 'graph-up-arrow', 'buildings', 'house', 'file-earmark-text', 'people', 'clock', 'calendar-check', 'check2-circle', 'cash-coin', 'lightning-charge', 'tools', 'geo-alt', 'diagram-3', 'clipboard-data', 'award', 'speedometer2', 'shield-check', 'recycle', 'tree'];
  var TYPES = [['ring', 'pie-chart', L('Ring – one percentage', 'Ring – én prosent')], ['line', 'graph-up', L('Line – over time', 'Linje – over tid')], ['bars', 'bar-chart', L('Bars – compare', 'Stolper – sammenlign')], ['donut', 'circle', L('Donut – shares of a whole', 'Smultring – deler av en helhet')], ['gantt', 'calendar-range', L('Timeline – periods', 'Tidslinje – perioder')]];
  function inp(path, val, o) {
    o = o || {};
    return '<input data-wb="' + path + '" value="' + esc(val == null ? '' : val) + '"' + (o.type ? ' type="' + o.type + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.step ? ' step="' + o.step + '"' : '') + (o.cls ? ' class="' + o.cls + '"' : '') + ' aria-label="' + esc(o.label || o.ph || path) + '">';
  }
  function field(k, label, o) {
    o = o || {}; var v = D().fm[k] || '';
    return '<label class="wr-f' + (o.wide ? ' wide' : '') + '"><span>' + esc(label) + '</span><input data-wrk="' + k + '" type="' + (o.type || 'text') + '" value="' + esc(k === 'date' ? String(v).slice(0, 10) : v) + '" maxlength="160"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '></label>';
  }
  function rowBtns(path, i, n) {
    return '<span class="wb-acts"><button type="button" class="icon-btn sm" data-wbmv="' + path + '" data-d="-1" aria-label="' + esc(L('Move up', 'Flytt opp')) + '"' + (i ? '' : ' disabled') + '><i class="bi bi-arrow-up"></i></button><button type="button" class="icon-btn sm" data-wbmv="' + path + '" data-d="1" aria-label="' + esc(L('Move down', 'Flytt ned')) + '"' + (i < n - 1 ? '' : ' disabled') + '><i class="bi bi-arrow-down"></i></button><button type="button" class="icon-btn sm wb-x" data-wbdel="' + path + '" aria-label="' + esc(L('Remove', 'Fjern')) + '"><i class="bi bi-x-lg"></i></button></span>';
  }
  function section(id, icon, title, sub, inner, open) {
    return '<details class="wr-sec" data-sec="' + id + '"' + (open ? ' open' : '') + '><summary><i class="bi bi-' + icon + '"></i><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></summary><div class="wr-secb">' + inner + '</div></details>';
  }
  function goals() { try { var s = window.SiteDraftSite && window.SiteDraftSite(); return ((s && (s.saved || s.draft) || {}).goals || []).map(function (g) { return g.name; }).filter(Boolean); } catch (e) { return []; } }
  function chartCard(c, i, n) {
    var p = 'charts.' + i, type = c.type || 'bars', g = goals();
    var h = '<div class="wb-card wb-chart"><div class="wb-head"><span class="wb-num">' + L('Chart', 'Diagram') + ' ' + (i + 1) + '</span>' + rowBtns(p, i, n) + '</div>' +
      '<div class="wb-types" role="radiogroup">' + TYPES.map(function (t) { return '<button type="button" role="radio" data-wbtype="' + p + '" data-t="' + t[0] + '" aria-checked="' + (type === t[0]) + '" title="' + esc(t[2]) + '"><i class="bi bi-' + t[1] + '"></i><span>' + esc(t[2].split(' – ')[0]) + '</span></button>'; }).join('') + '</div>' +
      '<p class="wb-hint">' + esc((TYPES.filter(function (t) { return t[0] === type; })[0] || TYPES[2])[2]) + '</p>' +
      '<div class="wb-grid">' + inp(p + '.title', c.title, { ph: L('Title', 'Tittel'), cls: 'wide' }) + inp(p + '.description', c.description, { ph: L('One line about what it shows (optional)', 'Én linje om hva det viser (valgfritt)'), cls: 'wide' }) + '</div>';
    if (type === 'ring') {
      h += '<div class="wb-grid"><label class="wr-f"><span>' + L('Percent', 'Prosent') + '</span>' + inp(p + '.percent', c.percent, { type: 'number', step: 'any', ph: '55' }) + '</label>' +
        (g.length || c.goal ? '<label class="wr-f"><span>' + L('Keep it current from a goal (optional)', 'Hold den oppdatert fra et mål (valgfritt)') + '</span><select data-wb="' + p + '.goal"><option value="">' + L('No – use the percent', 'Nei – bruk prosenten') + '</option>' + g.concat(c.goal && g.indexOf(c.goal) < 0 ? [c.goal] : []).map(function (x) { return '<option' + (x === c.goal ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>' : '') + '</div>';
    } else {
      var pts = c.points || [], gantt = type === 'gantt';
      h += '<div class="wb-pts"><div class="wb-pth' + (gantt ? ' g' : '') + '"><span>' + (gantt ? L('Name', 'Navn') : L('Label', 'Etikett')) + '</span><span>' + (gantt ? L('From', 'Fra') : L('Value', 'Verdi')) + '</span>' + (gantt ? '<span>' + L('To', 'Til') + '</span>' : '') + '<span></span></div>' +
        pts.map(function (pt, j) {
          var pp = p + '.points.' + j;
          return '<div class="wb-pt' + (gantt ? ' g' : '') + '">' + inp(pp + '.label', pt.label, { ph: gantt ? L('Phase', 'Fase') : (type === 'line' ? 'Jan' : L('Name', 'Navn')) }) +
            (gantt ? inp(pp + '.start', String(pt.start || '').slice(0, 10), { type: 'date', label: L('From', 'Fra') }) + inp(pp + '.end', String(pt.end || '').slice(0, 10), { type: 'date', label: L('To', 'Til') }) : inp(pp + '.value', pt.value, { type: 'number', step: 'any', ph: '0' })) +
            '<button type="button" class="icon-btn sm wb-x" data-wbdel="' + pp + '" aria-label="' + esc(L('Remove', 'Fjern')) + '"><i class="bi bi-x-lg"></i></button></div>';
        }).join('') +
        '<button type="button" class="text-btn wb-add" data-wbadd="' + p + '.points"><i class="bi bi-plus-lg"></i> ' + (gantt ? L('Add a period', 'Legg til periode') : L('Add a point', 'Legg til punkt')) + '</button></div>';
    }
    h += '<p class="wb-place"><i class="bi bi-geo"></i> ' + (String(D().body || '').indexOf('[chart ' + (i + 1) + ']') > -1 ? L('Shown in the text where it says [chart ' + (i + 1) + ']', 'Vises i teksten der det står [chart ' + (i + 1) + ']') : (W.col === 'projects' ? L('Shown with the charts at the top. ', 'Vises sammen med diagrammene øverst. ') : L('Shown under the summary. ', 'Vises under sammendraget. ')) + '<button type="button" class="link-btn" data-wbplace="' + (i + 1) + '">' + L('Put it in the text instead', 'Plasser den i teksten i stedet') + '</button>') + '</p></div>';
    return h;
  }
  function draw() {
    topbar();
    var host = document.getElementById('wrEd'); if (!host || !W) return;
    var keepScroll = host.scrollTop;
    if (W.loading) { host.innerHTML = '<div class="wrs-doc"><p class="muted">' + L('Opening …', 'Åpner …') + '</p></div>'; return; }
    if (W.err === 'worker') { host.innerHTML = '<div class="wrs-doc"><div class="wr-warn"><b>' + L('One step left: update the Worker', 'Ett steg igjen: oppdater Workeren') + '</b><p>' + L('Writing needs the newest server code. In Cloudflare → Workers → dashboard-sync → Edit code, paste the newest _cloudflare/worker.js and press Deploy.', 'Skriving trenger den nyeste serverkoden. I Cloudflare → Workers → dashboard-sync → Edit code, lim inn den nyeste _cloudflare/worker.js og trykk Deploy.') + '</p></div></div>'; return; }
    if (W.err) { host.innerHTML = '<div class="wrs-doc"><div class="wr-warn"><b>' + esc(W.err) + '</b></div></div>'; return; }
    var d = D(), proj = W.col === 'projects', other = W[W.lang === 'en' ? 'nb' : 'en'];
    var opened = {}; host.querySelectorAll('.wr-sec').forEach(function (s) { opened[s.dataset.sec] = s.open; });
    var isOpen = function (id, def) { return id in opened ? opened[id] : def; };
    var h = '<div class="wrs-doc">' +
      (!other.d.fm.title && (d.fm.title || !W.isNew) ? '<p class="wr-hint"><i class="bi bi-translate"></i> ' + (W.lang === 'en' ? L('No Norwegian version yet – switch to NO at the top to write it.', 'Ingen norsk versjon ennå – bytt til NO øverst for å skrive den.') : L('No English version yet – switch to EN at the top to write it.', 'Ingen engelsk versjon ennå – bytt til EN øverst for å skrive den.')) + '</p>' : '') +
      '<textarea class="wr-title" data-wrk="title" rows="1" maxlength="140" placeholder="' + esc(L('Title', 'Tittel')) + '" aria-label="' + esc(L('Title', 'Tittel')) + '">' + esc(d.fm.title || '') + '</textarea>' +
      '<textarea class="wr-sum" data-wrk="summary" rows="2" maxlength="320" placeholder="' + esc(L('A short summary – shown under the title and when the link is shared', 'Et kort sammendrag – vises under tittelen og når lenken deles')) + '" aria-label="' + esc(L('Summary', 'Sammendrag')) + '">' + esc(d.fm.summary || '') + '</textarea>';
    /* details */
    h += section('details', 'sliders', L('Details', 'Detaljer'), [String(d.fm.date || '').slice(0, 10), proj ? d.fm.organisation : d.fm.category, d.fm.image ? L('cover image', 'forsidebilde') : ''].filter(Boolean).join(' · '),
      '<div class="wr-grid">' + field('date', L('Date', 'Dato'), { type: 'date' }) +
        (proj ? field('period', L('Period', 'Periode'), { ph: '2025 – ongoing' }) + field('role', L('Your role', 'Din rolle')) + field('organisation', L('Organisation', 'Organisasjon'))
          : '<label class="wr-f"><span>' + L('Category', 'Kategori') + '</span><input data-wrk="category" list="wrCats" value="' + esc(d.fm.category || '') + '"><datalist id="wrCats"><option data-t="ui.work">Work</option><option data-t="ui.training">Training</option><option>Thoughts</option></datalist></label>') +
        '<div class="wr-f wide"><span>' + L('Cover image', 'Forsidebilde') + '</span><div class="wr-cover">' + (d.fm.image ? '<img src="' + esc(d.fm.image) + '" alt="">' : '<span class="wr-noimg"><i class="bi bi-image"></i></span>') +
          '<div><button type="button" class="text-btn" data-wrup="cover"><i class="bi bi-upload"></i> ' + (d.fm.image ? L('Change', 'Bytt') : L('Upload an image', 'Last opp et bilde')) + '</button>' + (d.fm.image ? '<button type="button" class="text-btn" data-wrimgx><i class="bi bi-x-lg"></i> ' + L('Remove', 'Fjern') + '</button>' : '') + '<small>' + L('Without one, the standard building photo is used.', 'Uten bilde brukes standardbildet av bygget.') + '</small></div></div></div></div>', isOpen('details', W.isNew));
    /* key figures */
    h += section('stats', '123', L('Key figures', 'Nøkkeltall'), d.stats.length ? d.stats.length + (d.stats.length === 1 ? L(' figure', ' tall') : L(' figures', ' tall')) : L('Big numbers at the top, e.g. “406 buildings”', 'Store tall øverst, f.eks. «406 bygg»'),
      d.stats.map(function (s, i) {
        var p = 'stats.' + i;
        return '<div class="wb-card wb-stat"><div class="wb-icon"><select data-wb="' + p + '.icon" aria-label="' + esc(L('Icon', 'Ikon')) + '">' + ICONS.concat(s.icon && ICONS.indexOf(s.icon) < 0 ? [s.icon] : []).map(function (ic) { return '<option value="' + ic + '"' + ((s.icon || 'bar-chart') === ic ? ' selected' : '') + '>' + ic.replace(/-/g, ' ') + '</option>'; }).join('') + '</select><i class="bi bi-' + esc(s.icon || 'bar-chart') + '"></i></div>' +
          inp(p + '.value', s.value, { ph: '406', cls: 'wb-big', label: L('Number', 'Tall') }) + inp(p + '.label', s.label, { ph: L('buildings restructured', 'bygg restrukturert'), label: L('What it is', 'Hva det er') }) + rowBtns(p, i, d.stats.length) + '</div>';
      }).join('') + '<button type="button" class="text-btn wb-add" data-wbadd="stats"><i class="bi bi-plus-lg"></i> ' + L('Add a key figure', 'Legg til nøkkeltall') + '</button>', isOpen('stats', d.stats.length > 0));
    /* charts */
    h += section('charts', 'graph-up', L('Charts', 'Diagrammer'), d.charts.length ? d.charts.length + (d.charts.length === 1 ? L(' chart', ' diagram') : L(' charts', ' diagrammer')) : L('Ring, line, bars, donut or timeline – no code', 'Ring, linje, stolper, smultring eller tidslinje – ingen kode'),
      d.charts.map(function (c, i) { return chartCard(c, i, d.charts.length); }).join('') + '<button type="button" class="text-btn wb-add" data-wbadd="charts"><i class="bi bi-plus-lg"></i> ' + L('Add a chart', 'Legg til diagram') + '</button>', isOpen('charts', d.charts.length > 0));
    /* phases (projects) */
    if (proj) h += section('parts', 'list-check', L('Phases', 'Faser'), d.parts.length ? d.parts.length + (d.parts.length === 1 ? L(' phase', ' fase') : L(' phases', ' faser')) : L('Parts of the project with status and progress', 'Deler av prosjektet med status og fremdrift'),
      d.parts.map(function (pt, i) {
        var p = 'parts.' + i, st = pt.status || 'planned';
        return '<div class="wb-card"><div class="wb-head">' + inp(p + '.title', pt.title, { ph: L('Phase name', 'Navn på fasen'), cls: 'wb-ttl' }) + rowBtns(p, i, d.parts.length) + '</div><div class="wb-grid">' +
          '<label class="wr-f"><span data-t="ui.status"><span data-t="ui.status">Status</span></span><select data-wb="' + p + '.status">' + [['planned', L('Planned', 'Planlagt')], ['ongoing', L('Ongoing', 'Pågår')], ['done', L('Done', 'Ferdig')]].map(function (o) { return '<option value="' + o[0] + '"' + (st === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
          '<label class="wr-f"><span>' + L('Progress %', 'Fremdrift %') + '</span>' + inp(p + '.progress', pt.progress, { type: 'number', ph: '0' }) + '</label>' +
          '<label class="wr-f"><span>' + L('From', 'Fra') + '</span>' + inp(p + '.start', String(pt.start || '').slice(0, 10), { type: 'date' }) + '</label><label class="wr-f"><span>' + L('To', 'Til') + '</span>' + inp(p + '.end', String(pt.end || '').slice(0, 10), { type: 'date' }) + '</label>' +
          inp(p + '.description', pt.description, { ph: L('What happens in this phase (optional)', 'Hva skjer i denne fasen (valgfritt)'), cls: 'wide' }) + '</div></div>';
      }).join('') + '<button type="button" class="text-btn wb-add" data-wbadd="parts"><i class="bi bi-plus-lg"></i> ' + L('Add a phase', 'Legg til fase') + '</button>', isOpen('parts', d.parts.length > 0));
    /* the text */
    var words = String(d.body || '').trim().split(/\s+/).filter(Boolean).length;
    h += '<div class="wr-text"><div class="wr-tools" role="toolbar">' + [['h2', 'type-h2', L('Heading', 'Overskrift')], ['h3', 'type-h3', L('Subheading', 'Underoverskrift')], ['b', 'type-bold', L('Bold', 'Fet')], ['i', 'type-italic', L('Italic', 'Kursiv')], ['ul', 'list-ul', L('List', 'Liste')], ['ol', 'list-ol', L('Numbered list', 'Nummerert liste')], ['q', 'quote', L('Quote', 'Sitat')], ['a', 'link-45deg', L('Link', 'Lenke')], ['img', 'image', L('Image', 'Bilde')], ['chart', 'graph-up', L('Insert chart', 'Sett inn diagram')], ['src', 'journal-bookmark', L('Add a source', 'Legg til kilde')]].map(function (t) {
        return '<button type="button" class="icon-btn sm" data-wrt="' + t[0] + '" aria-label="' + esc(t[2]) + '" title="' + esc(t[2]) + '"><i class="bi bi-' + t[1] + '"></i></button>'; }).join('') +
      '<span class="wr-count">' + words + L(' words', ' ord') + ' · ' + Math.max(1, Math.round(words / 200)) + ' min</span></div>' +
      '<textarea class="wr-body" data-wrk="__body" placeholder="' + esc(L('Start writing here …\n\nTip: use the buttons above for headings, bold, lists, links, images, charts and sources.', 'Begynn å skrive her …\n\nTips: bruk knappene over for overskrifter, fet skrift, lister, lenker, bilder, diagrammer og kilder.')) + '">' + esc(d.body) + '</textarea></div>';
    h += '<details class="wr-adv"><summary>' + L('Advanced – other front matter (for experts)', 'Avansert – annen front matter (for eksperter)') + '</summary><textarea data-wrk="__rest" rows="6" spellcheck="false">' + esc(d.rest) + '</textarea>' +
      '<p class="cr-sub">ref: <b>' + esc(d.fm.ref || W.ref || L('(from the title)', '(fra tittelen)')) + '</b>' + (W[W.lang].path ? ' · ' + esc(W[W.lang].path) : '') + '</p></details></div>';
    host.innerHTML = h;
    host.querySelectorAll('.wr-body, .wr-title, .wr-sum').forEach(grow);
    host.scrollTop = keepScroll;
    preview();
  }
  function grow(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }

  /* ---------- preview: the page in the site's own styles, with its charts, drawn here only ---------- */
  var pvT = null, CSS = '', JS = '', FILES = ['/assets/vendor/bootstrap/css/bootstrap.site.min.css?v=1', '/assets/vendor/bootstrap-icons/bootstrap-icons.css', '/assets/css/main.css', '/assets/css/articles.css', '/assets/css/projects.css'], loading = false;
  function loadAssets() {
    if ((CSS && JS) || loading) return; loading = true;
    var get = function (u) { return fetch(u, { cache: 'force-cache' }).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; }); };
    Promise.all(FILES.map(get).concat([get('/assets/js/charts.js')])).then(function (a) {
      JS = a.pop() || ' ';
      var t = a.map(function (x, i) { var dir = FILES[i].replace(/[^/]*$/, ''); return x.replace(/url\((['"]?)(?!data:|https?:|\/)([^'")]+)\1\)/g, function (m, q, path) { return 'url(' + location.origin + dir + path + ')'; }).replace(/url\((['"]?)\//g, 'url($1' + location.origin + '/'); }).join('\n');
      if (t.length > 1000) CSS = t; loading = false; if (W) preview(true);
    });
  }
  function preview(now) {
    clearTimeout(pvT); pvT = setTimeout(function () {
      loadAssets();
      var f = document.getElementById('wrFrame'); if (!f || !W || W.loading) return;
      var d = D(), fm = d.fm, nbx = W.lang === 'nb', proj = W.col === 'projects';
      var date = fm.date ? new Date(String(fm.date).slice(0, 10) + 'T12:00').toLocaleDateString(nbx ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      var stats = d.stats.filter(function (s) { return s.value || s.label; }), charts = d.charts.filter(function (c) { return c.title || c.percent || (c.points || []).length; });
      var statsH = stats.length ? '<div class="row gy-4 project-stats">' + stats.map(function (s) { return '<div class="col-md-4 project-stat-col"><div class="project-stat"><i class="bi bi-' + esc(s.icon || 'bar-chart') + '"></i><span class="value">' + esc(s.value) + '</span><span class="label">' + esc(s.label) + '</span></div></div>'; }).join('') + '</div>' : '';
      var chartsH = charts.length ? '<div class="project-charts">' + d.charts.map(function (c, i) {
        if (!(c.title || c.percent || (c.points || []).length)) return '';
        var cc = JSON.parse(JSON.stringify(c)); if (cc.percent !== '' && cc.percent != null) cc.percent = +cc.percent; (cc.points || []).forEach(function (p) { if (p.value !== '' && p.value != null) p.value = +p.value; });
        return '<figure class="project-card chart chart--' + esc(c.type || 'bars') + '" data-n="' + (i + 1) + '" data-chart="' + esc(JSON.stringify(cc)) + '" data-parts="[]" data-lang="' + (nbx ? 'nb' : 'en') + '" data-i18n="{}">' + (c.title ? '<figcaption><h4>' + esc(c.title) + '</h4>' + (c.description ? '<p>' + esc(c.description) + '</p>' : '') + '</figcaption>' : '') + '<div class="chart-body"></div></figure>';
      }).join('') + '</div>' : '';
      var partsH = proj && d.parts.length ? '<h3 class="project-subtitle">' + (nbx ? 'Faser' : 'Phases') + '</h3><div class="project-parts">' + d.parts.map(function (p) { var st = p.status || 'planned'; return '<div class="project-part"><div class="part-head"><h4>' + esc(p.title) + '</h4><span class="status status--' + st + '">' + esc({ planned: nbx ? 'Planlagt' : 'Planned', ongoing: nbx ? 'Pågår' : 'Ongoing', done: nbx ? 'Ferdig' : 'Done' }[st]) + '</span></div>' + (p.description ? '<p>' + esc(p.description) + '</p>' : '') + (p.progress ? '<div class="part-progress"><span class="part-track"><span class="part-fill" style="--p:' + esc(p.progress) + '%"></span></span><span class="part-pct">' + esc(p.progress) + '%</span></div>' : '') + '</div>'; }).join('') + '</div>' : '';
      var bodyH = String(d.body || '').trim() ? md(d.body) : '<p style="opacity:.45;font-style:italic">' + (nbx ? 'Teksten din vises her mens du skriver.' : 'Your text shows up here as you write.') + '</p>';
      var facts = proj && (fm.role || fm.organisation || fm.period) ? '<dl class="project-facts">' + [['role', nbx ? 'Rolle' : 'Role'], ['organisation', nbx ? 'Organisasjon' : 'Organisation'], ['period', nbx ? 'Periode' : 'Period']].map(function (x) { return fm[x[0]] ? '<div><dt>' + x[1] + '</dt><dd>' + esc(fm[x[0]]) + '</dd></div>' : ''; }).join('') + '</dl>' : '';
      var main = proj
        ? '<section class="section project"><div class="container">' + facts + (statsH ? '<h3 class="project-subtitle">' + (nbx ? 'Nøkkeltall' : 'Key figures') + '</h3>' + statsH : '') + chartsH + partsH + '<article class="article-body project-body">' + bodyH + '</article></div></section>'
        : '<section class="section"><div class="container"><article class="article-body">' + (fm.summary ? '<p class="lead">' + esc(fm.summary) + '</p>' : '') + statsH + chartsH + bodyH + '</article></div></section>';
      var html = '<!doctype html><html lang="' + (nbx ? 'nb' : 'en') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="' + location.origin + '/">' +
        '<style>html,body{background:#0e0f11;color:#e7e7ea;margin:0}</style>' + (CSS ? '<style>' + CSS + '</style>' : FILES.map(function (u) { return '<link href="' + location.origin + u + '" rel="stylesheet">'; }).join('')) +
        '<style>.wr-raw{padding:12px;border:1px dashed #888;border-radius:8px;color:#999;font-size:13px;margin:1em 0}.wr-badge{position:fixed;top:10px;right:10px;z-index:9;background:#d9a400;color:#111;font:600 12px/1 system-ui;padding:6px 10px;border-radius:99px}</style></head><body class="' + (proj ? 'project-page' : 'article-page') + '">' +
        '<span class="wr-badge">' + (nbx ? 'Forhåndsvisning – ikke publisert' : 'Preview – not published') + '</span><main class="main">' +
        '<section class="page-hero dark-background">' + (fm.image ? '<img src="' + esc(fm.image) + '" alt="">' : '<img src="/assets/img/hero-bg.jpg" alt="">') + '<div class="container">' +
        (proj ? '<span class="tag">' + (nbx ? 'Prosjekt' : 'Project') + '</span>' : fm.category ? '<span class="tag">' + esc(fm.category) + '</span>' : '') + '<h1>' + esc(fm.title || (nbx ? 'Uten tittel' : 'Untitled')) + '</h1>' +
        (proj ? (fm.summary ? '<p class="intro">' + esc(fm.summary) + '</p>' : '') : '<div class="meta">' + esc(date) + '</div>') + '</div></section>' + main + '</main>' +
        (JS && JS.length > 10 ? '<script>' + JS.replace(/<\/script/gi, '<\\/script') + '<\/script>' : '') + '</body></html>';
      var ed = f.contentWindow && f.contentDocument && f.contentDocument.scrollingElement, y = ed ? ed.scrollTop : 0;
      f.onload = function () { try { f.contentDocument.scrollingElement.scrollTop = y; } catch (e) {} };
      f.srcdoc = html;
    }, now ? 0 : 300);
  }

  /* ---------- editing ---------- */
  function getAt(path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, D()); }
  function setAt(path, v) { var ks = path.split('.'), last = ks.pop(), o = ks.reduce(function (o, k) { return o[k]; }, D()); if (o) o[last] = v; }
  document.addEventListener('input', function (e) {
    var t = e.target; if (!W || !t.closest || !t.closest('#wrStudio')) return;
    if (t.dataset.wrk) {
      var d = D(), k = t.dataset.wrk;
      if (k === '__body') d.body = t.value; else if (k === '__rest') d.rest = t.value; else d.fm[k] = t.value;
      if (t.tagName === 'TEXTAREA' && k !== '__rest') grow(t);
      if (k === '__body') { var c = document.querySelector('#wrStudio .wr-count'), n = t.value.trim().split(/\s+/).filter(Boolean).length; if (c) c.textContent = n + L(' words', ' ord') + ' · ' + Math.max(1, Math.round(n / 200)) + ' min'; }
      if (k === 'title') topbar();
    } else if (t.dataset.wb) setAt(t.dataset.wb, t.value);
    else return;
    autosave(); preview();
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!W || !t.closest || !t.closest('#wrStudio') || !t.dataset.wb) return;
    if (t.tagName === 'SELECT') { setAt(t.dataset.wb, t.value); autosave(); draw(); }
  });
  function wrap(ta, before, after, ph) {
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, sel = v.slice(s, e) || ph || '';
    ta.value = v.slice(0, s) + before + sel + (after || '') + v.slice(e); ta.focus(); ta.selectionStart = s + before.length; ta.selectionEnd = s + before.length + sel.length;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function line(ta, prefix) {
    var s = ta.selectionStart, v = ta.value, ls = v.lastIndexOf('\n', s - 1) + 1;
    ta.value = v.slice(0, ls) + prefix + v.slice(ls); ta.focus(); ta.selectionStart = ta.selectionEnd = s + prefix.length; ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function block(ta, text) {   /* a line of its own at the cursor */
    var s = ta.selectionStart, v = ta.value, pre = v.slice(0, s), post = v.slice(s);
    var ins = (pre && !/\n\n$/.test(pre) ? (/\n$/.test(pre) ? '\n' : '\n\n') : '') + text + (post && !/^\n\n/.test(post) ? (/^\n/.test(post) ? '\n' : '\n\n') : '');
    ta.value = pre + ins + post; ta.focus(); ta.selectionStart = ta.selectionEnd = pre.length + ins.length; ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function upload(cb) {
    var f0 = document.createElement('input'); f0.type = 'file'; f0.accept = 'image/jpeg,image/png,image/webp';
    f0.onchange = function () {
      var f = f0.files && f0.files[0]; if (!f) return;
      msg(L('Uploading …', 'Laster opp …'));
      var img = new Image(), url = URL.createObjectURL(f);
      img.onload = function () {   /* shrink to max 1800 px wide, JPEG */
        var w = Math.min(1800, img.width), h = Math.round(img.height * w / img.width), c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
        api('POST', { name: slug(f.name.replace(/\.[^.]+$/, '')).slice(0, 50) + '.jpg', b64: c.toDataURL('image/jpeg', .84) }).then(function (j) {
          if (j.ok) { msg(L('Image uploaded', 'Bildet er lastet opp')); cb(j.url); }
          else msg(j.error === 'old-worker' ? L('Update the Worker first', 'Oppdater Workeren først') : L('Upload failed: ', 'Opplasting feilet: ') + (j.error || j._s));
        });
      };
      img.src = url;
    };
    f0.click();
  }
  function newChart(type) { return type === 'ring' ? { type: 'ring', title: '', description: '', percent: '' } : { type: type || 'line', title: '', description: '', points: [{ label: '', value: '' }, { label: '', value: '' }] }; }
  function openSec(id) { var s = document.querySelector('#wrStudio .wr-sec[data-sec="' + id + '"]'); if (s) s.open = true; }
  document.addEventListener('click', function (e) {
    if (!W || !e.target.closest) return;
    var menu = document.querySelector('#wrStudio .wrs-menu');
    if (menu && !menu.hidden && !e.target.closest('.wrs-more')) menu.hidden = true;
    var b = e.target.closest('#wrStudio button'); if (!b) return;
    var ds = b.dataset, ta = document.querySelector('#wrStudio .wr-body');
    if ('wrclose' in ds) { close(); return; }
    if ('wrmore' in ds) { menu.hidden = !menu.hidden; b.setAttribute('aria-expanded', String(!menu.hidden)); return; }
    if ('wrreset' in ds) { reset(); return; }
    if ('wrdel' in ds) { del(); return; }
    if (ds.wrlang) { W.lang = ds.wrlang; draw(); return; }
    if (ds.wrview) { W.view = ds.wrview; topbar(); if (W.view === 'preview') preview(true); return; }
    if (ds.wrup) { upload(function (u) { D().fm.image = u; autosave(); draw(); }); return; }
    if ('wrimgx' in ds) { D().fm.image = ''; autosave(); draw(); return; }
    if (ds.wbadd) {
      var list = getAt(ds.wbadd); if (!Array.isArray(list)) { setAt(ds.wbadd, []); list = getAt(ds.wbadd); }
      var base = ds.wbadd.split('.').pop();
      list.push(base === 'stats' ? { value: '', label: '', icon: 'bar-chart' } : base === 'charts' ? newChart('line') : base === 'parts' ? { title: '', status: 'planned' } : (getAt(ds.wbadd.replace(/\.points$/, '.type')) === 'gantt' ? { label: '', start: '', end: '' } : { label: '', value: '' }));
      autosave(); draw(); openSec(ds.wbadd.split('.')[0]);
      var ins = document.querySelectorAll('#wrStudio [data-wb^="' + ds.wbadd + '.' + (list.length - 1) + '."]'); if (ins[0]) ins[0].focus();
      return;
    }
    if (ds.wbdel) {
      var ks = ds.wbdel.split('.'), idx = +ks.pop(), arr = getAt(ks.join('.'));
      var what = ks[ks.length - 1];
      if (what !== 'points' && !confirm(L('Remove this?', 'Fjerne denne?'))) return;
      arr.splice(idx, 1); autosave(); draw(); return;
    }
    if (ds.wbmv) { var k2 = ds.wbmv.split('.'), i2 = +k2.pop(), a2 = getAt(k2.join('.')), j2 = i2 + (+ds.d); if (j2 >= 0 && j2 < a2.length) { var x = a2[i2]; a2[i2] = a2[j2]; a2[j2] = x; autosave(); draw(); } return; }
    if (ds.wbtype) {
      var c = getAt(ds.wbtype), t = ds.t; c.type = t;
      if (t === 'ring') { if (c.percent == null || c.percent === '') { var last = (c.points || []).slice(-1)[0]; c.percent = last && last.value || ''; } }
      else { c.points = c.points && c.points.length ? c.points : [{ label: '', value: '' }, { label: '', value: '' }]; }
      autosave(); draw(); return;
    }
    if (ds.wbplace && ta) { block(ta, '[chart ' + ds.wbplace + ']'); draw(); msg(L('The chart now sits in the text – move the [chart …] line to where you want it', 'Diagrammet står nå i teksten – flytt [chart …]-linjen dit du vil ha det')); return; }
    if (ds.wrt && ta) {
      var w = ds.wrt;
      if (w === 'h2') line(ta, '## '); else if (w === 'h3') line(ta, '### '); else if (w === 'ul') line(ta, '- '); else if (w === 'ol') line(ta, '1. '); else if (w === 'q') line(ta, '> ');
      else if (w === 'b') wrap(ta, '**', '**', L('bold', 'fet')); else if (w === 'i') wrap(ta, '*', '*', L('italic', 'kursiv'));
      else if (w === 'a') { var u = prompt(L('Link address', 'Lenkeadresse'), 'https://'); if (u) wrap(ta, '[', '](' + u + ')', L('link text', 'lenketekst')); }
      else if (w === 'img') upload(function (u) { block(ta, '![' + L('description', 'beskrivelse') + '](' + u + ')'); });
      else if (w === 'chart') { var d = D(); d.charts.push(newChart('line')); block(ta, '[chart ' + d.charts.length + ']'); autosave(); draw(); openSec('charts'); var cards = document.querySelectorAll('#wrStudio .wb-chart'); if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); msg(L('Chart added – fill it in below the summary', 'Diagram lagt til – fyll det ut under sammendraget')); }
      else if (w === 'src') {
        var s = prompt(L('The source: author, year, title (or paste a link)', 'Kilden: forfatter, år, tittel (eller lim inn en lenke)')); if (!s) return;
        var v = ta.value, head = NB || W.lang === 'nb' ? '## Kilder' : '## Sources', re = /\n## (Kilder|Sources)\s*\n/;
        var nums = (v.split(re).pop().match(/^\d+\./gm) || []).length, n = re.test(v) ? nums + 1 : 1, entry = n + '. ' + (/^https?:\/\//.test(s) ? '[' + s.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] + '](' + s + ')' : s);
        var pos = ta.selectionStart; ta.value = v.slice(0, pos) + ' [' + n + ']' + v.slice(pos);
        ta.value = re.test(ta.value) ? ta.value.replace(/\s*$/, '') + '\n' + entry + '\n' : ta.value.replace(/\s*$/, '') + '\n\n' + head + '\n\n' + entry + '\n';
        ta.dispatchEvent(new Event('input', { bubbles: true })); msg(L('Source ' + n + ' added at the end', 'Kilde ' + n + ' lagt til nederst'));
      }
      return;
    }
    if (ds.wrsave) save(ds.wrsave === 'pub');
  });
  document.addEventListener('keydown', function (e) {
    if (!W || !document.getElementById('wrStudio')) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(false); }
    if (e.key === 'Escape' && !e.target.closest('input, textarea, select')) { var m = document.querySelector('#wrStudio .wrs-menu'); if (m && !m.hidden) m.hidden = true; else close(); }
  });

  /* ---------- start over (new) / discard changes (existing) ---------- */
  function reset() {
    var isNew = W.isNew;
    if (!confirm(isNew ? L('Start over? Everything you’ve written here (both languages) is cleared.', 'Starte på nytt? Alt du har skrevet her (begge språk) slettes.')
      : L('Discard your unpublished changes and go back to the saved version?', 'Forkaste de upubliserte endringene og gå tilbake til den lagrede versjonen?'))) return;
    try { localStorage.removeItem(key()); } catch (x) {}
    if (isNew) { var col = W.col, lang = W.lang; W = { col: col, ref: '', isNew: true, lang: lang, view: 'write', en: blank(col, 'en'), nb: blank(col, 'nb'), loading: false }; draw(); var t = document.querySelector('#wrStudio .wr-title'); if (t) t.focus(); }
    else open({ col: W.col, ref: W.ref });
    toast('<i class="bi bi-arrow-counterclockwise"></i> ' + (isNew ? L('Cleared – start fresh', 'Tømt – begynn på nytt') : L('Back to the saved version', 'Tilbake til den lagrede versjonen')));
  }
  function del() {
    if (!window.WebsiteItems || !window.WebsiteItems.remove) return;
    window.WebsiteItems.remove(W.col, W.ref, function (ok) { if (ok) close(); });
  }

  /* ---------- save / publish: every language that has a title is written ---------- */
  var saving = false;
  function save(pub) {
    if (saving || !W) return;
    var langs = ['en', 'nb'].filter(function (l) { return String(W[l].d.fm.title || '').trim(); });
    if (!langs.length) { msg(L('Give it a title first.', 'Gi den en tittel først.')); var t = document.querySelector('#wrStudio .wr-title'); if (t) t.focus(); return; }
    var ref = W.ref || W.en.d.fm.ref || W.nb.d.fm.ref || slug(W.en.d.fm.title || W.nb.d.fm.title);
    saving = true; msg(pub ? L('Publishing …', 'Publiserer …') : L('Saving …', 'Lagrer …'));
    document.querySelectorAll('#wrStudio [data-wrsave]').forEach(function (x) { x.disabled = true; });
    var chain = Promise.resolve(), errs = [];
    langs.forEach(function (l) {
      chain = chain.then(function () {
        var cur = W[l], d = JSON.parse(JSON.stringify(cur.d));
        d.fm.lang = l; d.fm.ref = ref; d.fm.published = pub ? '' : 'false';
        var file = cur.path ? cur.path.split('/').pop() : (W.col === 'projects' ? slug(W.nb.d.fm.title || W.en.d.fm.title) + (l === 'en' ? '-en' : '') : slug(d.fm.title)) + '.md';
        return api('PUT', { collection: W.col, file: file, text: build(d), sha: cur.sha || undefined }).then(function (j) {
          if (j.ok) { cur.path = j.path; cur.sha = j.sha; cur.d.fm.published = d.fm.published; cur.d.fm.ref = ref; cur.d.fm.lang = l; }
          else errs.push(l.toUpperCase() + ': ' + (j.error === 'old-worker' ? L('update the Worker', 'oppdater Workeren') : j.error === 'exists' ? L('a file with that name already exists – change the title', 'en fil med det navnet finnes – endre tittelen') : j._s === 409 ? L('changed somewhere else – reopen it', 'endret et annet sted – åpne på nytt') : (j.error || j._s)));
        });
      });
    });
    chain.then(function () {
      saving = false; if (!W) return;
      if (!errs.length) {
        var oldKey = key(); W.ref = ref; W.isNew = false; try { localStorage.removeItem(oldKey); localStorage.removeItem(key()); } catch (x) {}
        toast('<i class="bi bi-' + (pub ? 'cloud-check' : 'file-earmark-check') + '"></i> ' + (pub ? L('Published – live on jplundberg.com in about a minute', 'Publisert – live på jplundberg.com om ca. ett minutt') : L('Saved as a draft – not visible on the site', 'Lagret som utkast – ikke synlig på nettstedet')));
        try { window.dispatchEvent(new CustomEvent('site:published', { detail: (pub ? '' : L('draft: ', 'utkast: ')) + (W.en.d.fm.title || W.nb.d.fm.title) })); } catch (x) {}
      }
      draw();
      msg(errs.length ? L('Not saved – ', 'Ikke lagret – ') + errs.join(' · ') : pub ? L('Published ✓', 'Publisert ✓') : L('Draft saved ✓', 'Utkast lagret ✓'));
    });
  }

  window.addEventListener('article:open', function (e) { open(e.detail || {}); });
  window.ArticleWriter = { open: open, close: close, parse: parse, build: build };
  /* links from other pages: /cmd/admin/#write=articles|ref or #write=new-articles */
  function fromHash() {
    var m = location.hash.match(/^#write=(new-)?(articles|projects)(?:\|([a-z0-9-]+))?$/); if (!m) return;
    history.replaceState(null, '', location.pathname); setTimeout(function () { open({ col: m[2], ref: m[3], isNew: !!m[1] }); }, 600);
  }
  window.Vault.onUnlock(function () { setTimeout(fromHash, 400); });
})();
