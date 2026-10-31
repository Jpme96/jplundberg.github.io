/* Settings → jplundberg.com → Texts: edit the website's texts in English and Norwegian.
   Your versions are saved by the Worker to _data/texts.json in GitHub; an empty field
   means the original text (from _data/home.yml) is used. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* The originals contain a little HTML (&amp;, <strong>) – show them as plain text */
  function plain(s) { var d = document.createElement('div'); d.innerHTML = String(s || ''); return d.textContent.replace(/\s+/g, ' ').trim(); }

  var GROUPS = [
    { title: 'Front page', icon: 'house', fields: [
      { k: 'hero_items', label: 'Your roles', hint: 'Separated by commas. They rotate under your name.', max: 200, rows: 1 } ] },
    { title: 'About', icon: 'person', fields: [
      { k: 'about_intro', label: 'Introduction', max: 700, rows: 4 },
      { k: 'about_heading', label: 'Heading', max: 80, rows: 1 },
      { k: 'about_p1', label: 'First paragraph', max: 900, rows: 5 },
      { k: 'about_p2', label: 'Second paragraph', max: 900, rows: 5 },
      { k: 'fact_city', label: 'City', max: 60, rows: 1 },
      { k: 'fact_degree', label: 'Education', max: 120, rows: 1 } ] },
    { title: 'Experience', icon: 'briefcase', fields: [
      { k: 'exp_intro', label: 'Introduction', max: 300, rows: 2 } ] },
    { title: 'Contact', icon: 'envelope', fields: [
      { k: 'contact_intro', label: 'Text above the contact cards', max: 700, rows: 4 },
      { k: 'contact_form_note', label: 'Under “Send a message”', max: 200, rows: 2 } ] },
    { title: 'End of each article', icon: 'journal-text', fields: [
      { k: 'cta_title', label: 'Question', max: 140, rows: 2 },
      { k: 'cta_text', label: 'Text', max: 400, rows: 3 },
      { k: 'author_bio', label: 'Short bio', max: 200, rows: 2 } ] },
    { title: 'Footer', icon: 'layout-text-window', fields: [
      { k: 'footer_tagline', label: 'About you, in the footer', max: 300, rows: 3 } ] },
    { title: 'Google', icon: 'search', fields: [
      { k: 'description', label: 'Description in search results', hint: 'Best under 155 characters.', max: 200, rows: 3, warn: 155 } ] }
  ];
  var KEYS = [];
  GROUPS.forEach(function (g) { g.fields.forEach(function (f) { KEYS.push(f.k); }); });

  var lang = 'en', defaults = null, saved = null, draft = null, sha = null, loading = null, busy = false, problem = '';
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function dirty() { return saved && JSON.stringify(saved) !== JSON.stringify(draft); }
  function status(t, warn) { $('txStatus').textContent = t; $('txStatus').classList.toggle('warn', !!warn); }

  function load() {
    if (loading) return loading;
    status('Loading…');
    loading = Promise.all([
      fetch('/cmd/api/texts', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; });
      }),
      fetch('/cmd/texts-defaults.json', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); })
    ]).then(function (res) {
      var j = res[0];
      defaults = { en: {}, nb: {} };
      ['en', 'nb'].forEach(function (l) { KEYS.forEach(function (k) { defaults[l][k] = plain(res[1][l] && res[1][l][k]); }); });
      if (!j.texts) { problem = j._status === 404 ? 'worker' : j.error === 'github not configured' ? 'setup' : 'error'; throw new Error('load'); }
      problem = '';
      saved = { en: j.texts.en || {}, nb: j.texts.nb || {} }; sha = j.sha; draft = clone(saved);
      draw(); bar();
    }).catch(function (e) {
      if (window.Diag && e && e.message !== 'load' && e.message !== 'failed') window.Diag.log('website', e.message, 'texts.js');
      loading = null;
      $('txFields').innerHTML = '<p class="st-intro">' + (problem === 'worker'
        ? 'Update the Worker code to use this (Worker → Edit code → paste the new code → Deploy).'
        : problem === 'setup' ? 'Connect GitHub first: add GITHUB_TOKEN to the Worker.'
        : 'Couldn’t load the texts. Check your connection and try again.') + '</p>';
      status('');
    });
    return loading;
  }

  function value(k) { return draft[lang][k] != null ? draft[lang][k] : defaults[lang][k]; }
  function isOwn(k) { return draft[lang][k] != null && draft[lang][k] !== defaults[lang][k]; }

  function draw() {
    document.querySelectorAll('#txLang [data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    $('txFields').innerHTML = GROUPS.map(function (g) {
      return '<p class="st-sub tx-head"><i class="bi bi-' + g.icon + '"></i> ' + g.title + '</p><section class="st-group tx-group">' + g.fields.map(function (f) {
        var v = value(f.k);
        return '<div class="st-col tx-field' + (isOwn(f.k) ? ' own' : '') + '" data-k="' + f.k + '">' +
          '<span class="tx-label">' + f.label + '<button type="button" class="text-btn tx-reset" data-reset="' + f.k + '"' + (isOwn(f.k) ? '' : ' hidden') + '>Original</button></span>' +
          '<textarea class="st-wide tx-in" data-k="' + f.k + '" rows="' + f.rows + '" maxlength="' + f.max + '" placeholder="' + esc(defaults[lang][f.k]) + '">' + esc(v) + '</textarea>' +
          '<small class="tx-meta"><span>' + (f.hint || '') + '</span><span class="tx-count" data-count="' + f.k + '">' + count(f, v) + '</span></small></div>';
      }).join('') + '</section>';
    }).join('');
    document.querySelectorAll('.tx-in').forEach(grow);
  }
  function fieldOf(k) { var r = null; GROUPS.forEach(function (g) { g.fields.forEach(function (f) { if (f.k === k) r = f; }); }); return r; }
  function count(f, v) { var n = (v || '').length; return n + ' / ' + (f.warn || f.max) + (f.warn && n > f.warn ? ' · long' : ''); }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight, 44) + 'px'; }

  $('txFields').addEventListener('input', function (e) {
    var t = e.target.closest('.tx-in');
    if (!t) return;
    var k = t.dataset.k, v = t.value.replace(/\s+/g, ' ');
    if (!v.trim() || v.trim() === defaults[lang][k]) delete draft[lang][k]; else draft[lang][k] = v.trim();
    grow(t);
    var f = fieldOf(k), c = document.querySelector('[data-count="' + k + '"]');
    if (c) { c.textContent = count(f, t.value); c.classList.toggle('warn', !!(f.warn && t.value.length > f.warn)); }
    var box = t.closest('.tx-field');
    box.classList.toggle('own', isOwn(k));
    box.querySelector('.tx-reset').hidden = !isOwn(k);
    bar();
  });
  $('txFields').addEventListener('click', function (e) {
    var b = e.target.closest('[data-reset]');
    if (!b) return;
    delete draft[lang][b.dataset.reset];
    draw(); bar();
  });
  $('txLang').addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (!b || !draft) return;
    lang = b.dataset.lang; draw();
  });

  function bar() {
    $('txPublish').disabled = !dirty() || busy;
    $('txUndo').hidden = !dirty() || busy;
    if (!busy && saved) {
      var own = Object.keys(saved.en).length + Object.keys(saved.nb).length;
      status(dirty() ? 'Not published yet' : own ? 'Live · ' + own + ' text' + (own > 1 ? 's' : '') + ' changed' : 'Live · original texts');
    }
    var n = draft ? Object.keys(draft.en).length + Object.keys(draft.nb).length : 0;
    if ($('sumTexts')) $('sumTexts').textContent = n ? n + ' text' + (n > 1 ? 's' : '') + ' changed' : 'About, roles, contact, footer';
  }
  $('txUndo').addEventListener('click', function () { draft = clone(saved); draw(); bar(); });
  $('txPublish').addEventListener('click', function () {
    if (!dirty() || busy) return;
    busy = true; bar(); status('Publishing…');
    fetch('/cmd/api/texts', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts: draft, sha: sha }) })
      .then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }); })
      .then(function (j) {
        busy = false;
        if (j.ok) { saved = { en: j.texts.en, nb: j.texts.nb }; draft = clone(saved); sha = j.sha; draw(); bar(); status('Published · live on jplundberg.com in about a minute'); return; }
        if (j._status === 409) { status('Changed somewhere else. Reloading the latest version…', true); saved = null; loading = null; load(); return; }
        bar(); status('Couldn’t publish (' + (j.error || j._status) + ').', true);
      }).catch(function () { busy = false; bar(); status('Couldn’t publish. Check your connection.', true); });
  });

  window.addEventListener('st:page', function (e) {
    if (e.detail === 'texts') { if (!saved) load(); else { draw(); bar(); } }
  });
})();
