/* Write articles and projects for jplundberg.com (Admin → Website → Write).
   - English and Norwegian versions side by side (same `ref`, so the language switch on the site finds the other one).
   - Simple fields (title, summary, date, category / role, organisation, period, cover image) + the text in Markdown with a
     toolbar; everything else in the front matter (stats, charts …) is kept exactly as it is under "Advanced".
   - Preview: the article in the site's own styles, drawn here – nothing is public until you press Publish.
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

  /* ---------- front matter: simple keys parsed, the rest kept verbatim ---------- */
  function parse(text) {
    var m = String(text || '').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/), out = { fm: {}, rest: '', body: '' };
    if (!m) { out.body = text || ''; return out; }
    var lines = m[1].split('\n'), rest = [], i = 0;
    while (i < lines.length) {
      var ln = lines[i], km = ln.match(/^([A-Za-z_]+):\s?(.*)$/);
      if (km && SIMPLE.indexOf(km[1]) > -1) {
        var v = km[2], j = i + 1;
        while (j < lines.length && /^\s+\S/.test(lines[j]) && !/^\s*-\s/.test(lines[j])) { v += ' ' + lines[j].trim(); j++; }
        v = v.trim(); if (/^".*"$/.test(v)) { try { v = JSON.parse(v); } catch (e) { v = v.slice(1, -1); } } else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
        out.fm[km[1]] = v; i = j;
      } else { rest.push(ln); i++; }
    }
    out.rest = rest.join('\n').trim(); out.body = m[2].replace(/^\n/, '');
    return out;
  }
  function yv(v) { v = String(v); return v === '' || /[:#\[\]{}&*!|>'"%@`]|^\s|\s$|^(true|false|yes|no|null|-)$/i.test(v) ? JSON.stringify(v) : v; }
  function build(d) {
    var fm = ['title', 'lang', 'ref', 'date', 'category', 'summary', 'image', 'role', 'organisation', 'period'].filter(function (k) { return d.fm[k] != null && String(d.fm[k]).trim() !== ''; })
      .map(function (k) { return k + ': ' + (k === 'date' ? String(d.fm[k]).trim() : yv(String(d.fm[k]).trim())); });
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
    String(src || '').split('\n').forEach(function (ln) {
      var h = ln.match(/^(#{1,4})\s+(.*)$/), ul = ln.match(/^\s*[-*]\s+(.*)$/), ol = ln.match(/^\s*\d+[.)]\s+(.*)$/), q = ln.match(/^>\s?(.*)$/);
      if (/^\s*<(figure|div|table|iframe|section|p|img)/i.test(ln)) { flushP(); flushL(); flushQ(); out.push('<div class="wr-raw">' + L('[HTML block – shown on the site]', '[HTML-blokk – vises på nettstedet]') + '</div>'); return; }
      if (h) { flushP(); flushL(); flushQ(); var n = Math.max(2, h[1].length); out.push('<h' + n + '>' + inline(h[2]) + '</h' + n + '>'); return; }
      if (ul || ol) { flushP(); flushQ(); var t = ul ? 'ul' : 'ol'; if (!list || list.t !== t) { flushL(); list = { t: t, items: [] }; } list.items.push((ul || ol)[1]); return; }
      if (q) { flushP(); flushL(); quote.push(q[1]); return; }
      if (!ln.trim()) { flushP(); flushL(); flushQ(); return; }
      if (/^---+$/.test(ln.trim())) { flushP(); flushL(); flushQ(); out.push('<hr>'); return; }
      flushL(); flushQ(); para.push(ln.trim());
    });
    flushP(); flushL(); flushQ();
    return out.join('\n');
  }

  /* ---------- state ---------- */
  var W = null;   /* { col, ref, isNew, lang, en: {path, sha, d}, nb: {...} } */
  function blank(col, lang) { return { path: null, sha: null, d: { fm: { title: '', lang: lang, ref: '', date: new Date().toISOString().slice(0, 10), category: col === 'articles' ? 'Work' : '', summary: '' }, rest: '', body: '' } }; }
  function key() { return 'dash.writer:' + W.col + '|' + (W.ref || 'new'); }
  function autosave() { if (!W) return; try { localStorage.setItem(key(), JSON.stringify({ at: Date.now(), en: W.en.d, nb: W.nb.d })); } catch (e) {} }
  function restore() { try { var v = JSON.parse(localStorage.getItem(key())); if (v && v.en && v.nb) { W.en.d = v.en; W.nb.d = v.nb; return v.at; } } catch (e) {} return null; }
  function api(method, body, q) {
    return fetch('/cmd/api/article' + (q || ''), { method: method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { j._s = r.status; return j; }, function () { return { _s: r.status, error: r.status === 404 ? 'old-worker' : 'bad answer' }; }); });
  }

  /* ---------- open ---------- */
  function open(detail) {
    var col = detail.col === 'projects' ? 'projects' : 'articles';
    W = { col: col, ref: detail.isNew ? '' : detail.ref, isNew: !!detail.isNew, lang: NB ? 'nb' : 'en', en: blank(col, 'en'), nb: blank(col, 'nb'), loading: !detail.isNew };
    show();
    if (detail.isNew) { var at = restore(); if (at) toast('<i class="bi bi-arrow-counterclockwise"></i> ' + L('Your unsaved draft is back', 'Det ulagrede utkastet ditt er tilbake')); draw(); return; }
    var items = (window.WebsiteItems && window.WebsiteItems.list()) || [];
    var go = function (items) {
      var mine = items.filter(function (x) { return x.collection === col && x.ref === detail.ref; });
      if (!mine.length) { W.loading = false; W.err = L('Couldn’t find it – reload the list.', 'Fant den ikke – last inn listen på nytt.'); draw(); return; }
      Promise.all(mine.map(function (x) { return api('GET', null, '?path=' + encodeURIComponent(x.path)).then(function (j) { return { x: x, j: j }; }); })).then(function (res) {
        W.loading = false;
        res.forEach(function (r) {
          if (r.j.error) { W.err = r.j.error === 'old-worker' || r.j._s === 404 && r.j.error === 'not found' && !r.j.path ? 'worker' : r.j.error; return; }
          var lg = r.x.lang === 'nb' ? 'nb' : 'en'; W[lg] = { path: r.j.path, sha: r.j.sha, d: parse(r.j.text) };
        });
        var at = restore(); if (at) toast('<i class="bi bi-arrow-counterclockwise"></i> ' + L('Unsaved changes from ', 'Ulagrede endringer fra ') + new Date(at).toLocaleString(NB ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + L(' are back', ' er tilbake'));
        if (!W.en.path && W.nb.path) W.lang = 'nb'; if (!W.nb.path && W.en.path && !NB) W.lang = 'en';
        draw();
      });
    };
    if (items.length) go(items); else fetch('/cmd/api/content', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { go(j.items || []); }).catch(function () { W.loading = false; W.err = L('No connection', 'Ingen forbindelse'); draw(); });
  }
  /* where to draw: the Website workspace in Admin (its editor area + preview frame) */
  function show() {
    if (window.CrWorkspace && window.CrWorkspace.open) window.CrWorkspace.open('write');
    setTimeout(draw, 80);
  }

  /* ---------- draw ---------- */
  function field(k, label, opts) {
    var v = (W[W.lang].d.fm[k] || '');
    opts = opts || {};
    return '<label class="wr-f' + (opts.wide ? ' wide' : '') + '"><span>' + esc(label) + '</span>' + (opts.area ? '<textarea data-wrk="' + k + '" rows="' + (opts.rows || 2) + '" maxlength="' + (opts.max || 300) + '">' + esc(v) + '</textarea>'
      : '<input data-wrk="' + k + '" type="' + (opts.type || 'text') + '" value="' + esc(k === 'date' ? String(v).slice(0, 10) : v) + '" maxlength="' + (opts.max || 160) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>') + '</label>';
  }
  function draw() {
    var host = document.getElementById('crWrite'); if (!host || !W) return;
    if (W.loading) { host.innerHTML = '<p class="muted">' + L('Opening …', 'Åpner …') + '</p>'; return; }
    if (W.err === 'worker') { host.innerHTML = '<div class="wr-warn"><b>' + L('One step left: update the Worker', 'Ett steg igjen: oppdater Workeren') + '</b><p>' + L('Writing needs the newest server code. In Cloudflare → Workers → dashboard-sync → Edit code, paste the newest _cloudflare/worker.js and press Deploy.', 'Skriving trenger den nyeste serverkoden. I Cloudflare → Workers → dashboard-sync → Edit code, lim inn den nyeste _cloudflare/worker.js og trykk Deploy.') + '</p></div>'; return; }
    var cur = W[W.lang], d = cur.d, pubd = !(d.fm.published === 'false' || d.fm.published === false) && !!cur.path;
    var other = W[W.lang === 'en' ? 'nb' : 'en'];
    host.innerHTML = '<div class="wr">' +
      '<div class="wr-top"><span class="wr-kind"><i class="bi bi-' + (W.col === 'projects' ? 'kanban' : 'journal-text') + '"></i> ' + (W.isNew ? (W.col === 'projects' ? L('New project', 'Nytt prosjekt') : L('New article', 'Ny artikkel')) : (W.col === 'projects' ? L('Project', 'Prosjekt') : L('Article', 'Artikkel'))) + '</span>' +
        '<span class="aw-lang wr-lang"><button type="button" data-wrlang="en" aria-pressed="' + (W.lang === 'en') + '">EN' + (W.en.d.fm.title ? '' : ' ·') + '</button><button type="button" data-wrlang="nb" aria-pressed="' + (W.lang === 'nb') + '">NO' + (W.nb.d.fm.title ? '' : ' ·') + '</button></span>' +
        '<span class="wr-state ' + (cur.path ? (pubd ? 'on' : 'draft') : 'new') + '">' + (cur.path ? (pubd ? L('Live', 'Live') : L('Draft', 'Utkast')) : L('Not saved yet', 'Ikke lagret ennå')) + '</span></div>' +
      (!other.d.fm.title && !W.isNew ? '<p class="wr-hint"><i class="bi bi-translate"></i> ' + (W.lang === 'en' ? L('No Norwegian version yet – switch to NO to write it.', 'Ingen norsk versjon ennå – bytt til NO for å skrive den.') : L('No English version yet – switch to EN to write it.', 'Ingen engelsk versjon ennå – bytt til EN for å skrive den.')) + '</p>' : '') +
      '<div class="wr-grid">' + field('title', L('Title', 'Tittel'), { wide: true, max: 140 }) + field('summary', L('Summary – shown under the title and in link previews', 'Sammendrag – vises under tittelen og i lenkeforhåndsvisninger'), { wide: true, area: true, rows: 2, max: 320 }) +
        field('date', L('Date', 'Dato'), { type: 'date' }) +
        (W.col === 'articles' ? field('category', L('Category', 'Kategori'), { ph: 'Work, Training …' }) : field('period', L('Period', 'Periode'), { ph: '2025 – ongoing' }) + field('role', L('Role', 'Rolle')) + field('organisation', L('Organisation', 'Organisasjon'))) +
        '<label class="wr-f wide"><span>' + L('Cover image', 'Forsidebilde') + '</span><span class="wr-img"><input data-wrk="image" value="' + esc(d.fm.image || '') + '" placeholder="/assets/img/…"><button type="button" class="text-btn" data-wrup="cover"><i class="bi bi-upload"></i> ' + L('Upload', 'Last opp') + '</button></span></label></div>' +
      '<div class="wr-tools" role="toolbar">' + [['h2', 'type-h2', L('Heading', 'Overskrift')], ['h3', 'type-h3', L('Subheading', 'Underoverskrift')], ['b', 'type-bold', L('Bold', 'Fet')], ['i', 'type-italic', L('Italic', 'Kursiv')], ['ul', 'list-ul', L('List', 'Liste')], ['ol', 'list-ol', L('Numbered list', 'Nummerert liste')], ['q', 'quote', L('Quote', 'Sitat')], ['a', 'link-45deg', L('Link', 'Lenke')], ['img', 'image', L('Image', 'Bilde')]].map(function (t) {
        return '<button type="button" class="icon-btn sm" data-wrt="' + t[0] + '" aria-label="' + esc(t[2]) + '" title="' + esc(t[2]) + '"><i class="bi bi-' + t[1] + '"></i></button>'; }).join('') +
        '<span class="wr-count">' + String(d.body || '').trim().split(/\s+/).filter(Boolean).length + L(' words', ' ord') + ' · ' + Math.max(1, Math.round(String(d.body || '').split(/\s+/).length / 200)) + ' min</span></div>' +
      '<textarea class="wr-body" data-wrk="__body" rows="18" placeholder="' + esc(L('Write here. ## for a heading, **bold**, - for a list …', 'Skriv her. ## for overskrift, **fet**, - for liste …')) + '">' + esc(d.body) + '</textarea>' +
      '<details class="wr-adv"><summary>' + L('Advanced – the rest of the front matter (stats, charts …)', 'Avansert – resten av front matter (tall, diagrammer …)') + '</summary><textarea data-wrk="__rest" rows="8" spellcheck="false">' + esc(d.rest) + '</textarea>' +
        '<p class="ad-sub cr-sub">ref: <b>' + esc(d.fm.ref || W.ref || L('(from the title)', '(fra tittelen)')) + '</b>' + (cur.path ? ' · ' + esc(cur.path) : '') + '</p></details>' +
      '<div class="wr-bar"><span class="wr-msg" id="wrMsg">' + L('Autosaved on this device', 'Lagres automatisk på denne enheten') + '</span>' +
        '<button type="button" class="text-btn" data-wrsave="draft"><i class="bi bi-file-earmark"></i> ' + (pubd ? L('Unpublish (draft)', 'Avpubliser (utkast)') : L('Save draft', 'Lagre utkast')) + '</button>' +
        '<button type="button" class="pill-btn" data-wrsave="pub"><i class="bi bi-cloud-upload"></i> ' + (pubd ? L('Publish changes', 'Publiser endringer') : L('Publish', 'Publiser')) + '</button></div></div>';
    preview();
  }

  /* preview: the article in the site's own styles – drawn here, never public */
  var pvT = null, CSS = '', CSS_FILES = ['/assets/vendor/bootstrap/css/bootstrap.site.min.css?v=1', '/assets/vendor/bootstrap-icons/bootstrap-icons.css', '/assets/css/main.css', '/assets/css/articles.css', '/assets/css/projects.css'], cssLoading = false;
  /* the site's styles are fetched once and written into the preview itself (Safari doesn't always load linked styles in a srcdoc frame) */
  function loadCss() {
    if (CSS || cssLoading) return; cssLoading = true;
    Promise.all(CSS_FILES.map(function (u) { return fetch(u, { cache: 'force-cache' }).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; }); })).then(function (a) {
      var t = a.map(function (x, i) { var dir = CSS_FILES[i].replace(/[^/]*$/, ''); return x.replace(/url\((['"]?)(?!data:|https?:|\/)([^'")]+)\1\)/g, function (m, q, path) { return 'url(' + location.origin + dir + path + ')'; }).replace(/url\((['"]?)\//g, 'url($1' + location.origin + '/'); }).join('\n');
      if (t.length > 1000) { CSS = t; if (W) preview(); } cssLoading = false;
    });
  }
  function preview() {
    loadCss();
    clearTimeout(pvT); pvT = setTimeout(function () {
      var f = document.getElementById('awFrame'); if (!f || !W) return;
      var d = W[W.lang].d, fm = d.fm, nbx = W.lang === 'nb';
      var date = fm.date ? new Date(String(fm.date).slice(0, 10) + 'T12:00').toLocaleDateString(nbx ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      var html = '<!doctype html><html lang="' + (nbx ? 'nb' : 'en') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="' + location.origin + '/">' +
        '<style>html,body{background:#0e0f11;color:#e7e7ea;margin:0}</style>' + (CSS ? '<style>' + CSS + '</style>' : CSS_FILES.map(function (u) { return '<link href="' + location.origin + u + '" rel="stylesheet">'; }).join('')) +
        '<style>.wr-raw{padding:12px;border:1px dashed #888;border-radius:8px;color:#999;font-size:13px;margin:1em 0}.wr-draftbadge{position:fixed;top:10px;right:10px;z-index:9;background:#d9a400;color:#111;font:600 12px/1 system-ui;padding:6px 10px;border-radius:99px}</style></head><body class="' + (W.col === 'projects' ? 'project-page' : 'article-page') + '">' +
        '<span class="wr-draftbadge">' + (nbx ? 'Forhåndsvisning – ikke publisert' : 'Preview – not published') + '</span><main class="main">' +
        '<section class="page-hero dark-background">' + (fm.image ? '<img src="' + esc(fm.image) + '" alt="">' : '<picture><img src="/assets/img/hero-bg.jpg" alt=""></picture>') + '<div class="container">' +
        (fm.category ? '<span class="tag">' + esc(fm.category) + '</span>' : '') + '<h1>' + esc(fm.title || (nbx ? 'Uten tittel' : 'Untitled')) + '</h1><div class="meta">' + esc(date) + (W.col === 'projects' && fm.organisation ? ' · ' + esc(fm.organisation) : '') + '</div></div></section>' +
        '<section class="section"><div class="container"><article class="article-body">' + (fm.summary ? '<p class="lead">' + esc(fm.summary) + '</p>' : '') + md(d.body) + '</article></div></section></main></body></html>';
      f.removeAttribute('src'); f.srcdoc = html;
      var note = document.getElementById('awNote'); if (note) note.textContent = L('Preview of this ' + (W.col === 'projects' ? 'project' : 'article') + ' in the site’s styles – only you see it until you publish.', 'Forhåndsvisning av ' + (W.col === 'projects' ? 'prosjektet' : 'artikkelen') + ' i nettstedets stil – bare du ser den til du publiserer.');
    }, 250);
  }

  /* ---------- editing ---------- */
  document.addEventListener('input', function (e) {
    var t = e.target; if (!W || !t.closest || !t.closest('#crWrite') || !t.dataset.wrk) return;
    var d = W[W.lang].d, k = t.dataset.wrk;
    if (k === '__body') d.body = t.value; else if (k === '__rest') d.rest = t.value; else d.fm[k] = t.value;
    autosave(); preview();
    if (k === '__body') { var c = document.querySelector('#crWrite .wr-count'); if (c) c.textContent = t.value.trim().split(/\s+/).filter(Boolean).length + L(' words', ' ord') + ' · ' + Math.max(1, Math.round(t.value.split(/\s+/).length / 200)) + ' min'; }
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
  function upload(cb) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var m = document.getElementById('wrMsg'); if (m) m.textContent = L('Uploading …', 'Laster opp …');
      var img = new Image(), url = URL.createObjectURL(f);
      img.onload = function () {   /* shrink to max 1800 px wide, JPEG */
        var w = Math.min(1800, img.width), h = Math.round(img.height * w / img.width), c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
        var b64 = c.toDataURL('image/jpeg', .84);
        api('POST', { name: slug(f.name.replace(/\.[^.]+$/, '')).slice(0, 50) + '.jpg', b64: b64 }).then(function (j) {
          if (j.ok) { if (m) m.textContent = L('Image uploaded – live with the next publish', 'Bildet er lastet opp – vises når du publiserer'); cb(j.url); }
          else if (m) m.textContent = j.error === 'old-worker' ? L('Update the Worker first', 'Oppdater Workeren først') : L('Upload failed: ', 'Opplasting feilet: ') + (j.error || j._s);
        });
      };
      img.src = url;
    };
    inp.click();
  }
  document.addEventListener('click', function (e) {
    if (!W || !e.target.closest) return;
    var b = e.target.closest('#crWrite [data-wrlang], #crWrite [data-wrt], #crWrite [data-wrsave], #crWrite [data-wrup]'); if (!b) return;
    var ta = document.querySelector('#crWrite .wr-body');
    if (b.dataset.wrlang) { W.lang = b.dataset.wrlang; draw(); return; }
    if (b.dataset.wrup) { upload(function (u) { W[W.lang].d.fm.image = u; autosave(); draw(); }); return; }
    if (b.dataset.wrt && ta) {
      var t = b.dataset.wrt;
      if (t === 'h2') line(ta, '## '); else if (t === 'h3') line(ta, '### '); else if (t === 'ul') line(ta, '- '); else if (t === 'ol') line(ta, '1. '); else if (t === 'q') line(ta, '> ');
      else if (t === 'b') wrap(ta, '**', '**', L('bold', 'fet')); else if (t === 'i') wrap(ta, '*', '*', L('italic', 'kursiv'));
      else if (t === 'a') { var u = prompt(L('Link address', 'Lenkeadresse'), 'https://'); if (u) wrap(ta, '[', '](' + u + ')', L('link text', 'lenketekst')); }
      else if (t === 'img') upload(function (u) { wrap(ta, '![', '](' + u + ')', L('description', 'beskrivelse')); });
      return;
    }
    if (b.dataset.wrsave) save(b.dataset.wrsave === 'pub');
  });

  /* ---------- save / publish: every language that has a title is written ---------- */
  function save(pub) {
    var m = document.getElementById('wrMsg'), langs = ['en', 'nb'].filter(function (l) { return String(W[l].d.fm.title || '').trim(); });
    if (!langs.length) { if (m) m.textContent = L('Give it a title first.', 'Gi den en tittel først.'); return; }
    var ref = W.ref || W.en.d.fm.ref || W.nb.d.fm.ref || slug(W.en.d.fm.title || W.nb.d.fm.title);
    if (m) m.textContent = pub ? L('Publishing …', 'Publiserer …') : L('Saving …', 'Lagrer …');
    document.querySelectorAll('#crWrite [data-wrsave]').forEach(function (x) { x.disabled = true; });
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
      if (!errs.length) {
        W.ref = ref; W.isNew = false; try { localStorage.removeItem('dash.writer:' + W.col + '|new'); } catch (x) {} autosave(); try { localStorage.removeItem(key()); } catch (x) {}
        toast('<i class="bi bi-' + (pub ? 'cloud-check' : 'file-earmark-check') + '"></i> ' + (pub ? L('Published – live on jplundberg.com in about a minute', 'Publisert – live på jplundberg.com om ca. ett minutt') : L('Saved as a draft – not visible on the site', 'Lagret som utkast – ikke synlig på nettstedet')));
        try { window.dispatchEvent(new CustomEvent('site:published', { detail: (pub ? '' : L('draft: ', 'utkast: ')) + (W.en.d.fm.title || W.nb.d.fm.title) })); } catch (x) {}
        if (window.WebsiteItems) window.WebsiteItems.reload();
      }
      draw();
      var m2 = document.getElementById('wrMsg'); if (m2 && errs.length) m2.textContent = L('Not saved – ', 'Ikke lagret – ') + errs.join(' · ');
    });
  }

  window.addEventListener('article:open', function (e) { open(e.detail || {}); });
  window.ArticleWriter = { open: open, redraw: draw, preview: preview };
  /* links from other pages: /cmd/admin/#write=articles|ref or #write=new-articles */
  function fromHash() {
    var m = location.hash.match(/^#write=(new-)?(articles|projects)(?:\|([a-z0-9-]+))?$/); if (!m) return;
    history.replaceState(null, '', location.pathname); setTimeout(function () { open({ col: m[2], ref: m[3], isNew: !!m[1] }); }, 600);
  }
  window.Vault.onUnlock(function () { setTimeout(fromHash, 400); });
})();
