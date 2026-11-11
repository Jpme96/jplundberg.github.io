/* Language: English (as written) or Norwegian (Settings → Appearance → Language).
   In Norwegian, this translates what's on screen as it appears – texts, buttons, placeholders,
   labels – and makes every date Norwegian. Your own words (to-dos, notes, events, names) are
   never touched: only texts the dashboard itself writes are in the list below.
   Loaded first on every page, so the rest of the dashboard doesn't need to know about it.
   The Norwegian words (300 kB, i18n-nb.js → dist/nb.js) load only in Norwegian: in English nothing more is fetched. */
(function () {
  "use strict";
  var lang = 'en';
  try { lang = (JSON.parse(localStorage.getItem('dash.settings')) || {}).lang === 'nb' ? 'nb' : 'en'; } catch (e) {}
  /* Texts by name (Phase D 24): I18N.k('home.plan', 'Plan my day') gives the English as written, or the Norwegian kept under
     that name (words/*.nb.js, in dist/nb.js); {n} in a text is filled from the third argument. In HTML the same with
     data-t="ui.plan" (and data-t-aria-label / data-t-placeholder / data-t-title for attributes). Never match on
     the English sentence for new texts – the old sentence list (i18n-nb.js) only shrinks. In a module:
     var K = window.I18N.k;  …  K('home.plan', 'Plan my day') */
  var NB = {};
  function fill(s, v) { return v ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }) : s; }
  window.I18N = { lang: lang, t: function (s) { return s; }, nb: NB,
    add: function (o) { for (var k in o) NB[k] = o[k]; },
    k: function (key, en, v) { var w = lang === 'nb' ? NB[key] : null; return fill(w != null ? (typeof w === 'string' ? w : w[1]) : en, v); } };
  if (lang !== 'nb') return;
  document.documentElement.lang = 'nb';
  /* right after the head bundle, before the page's own scripts (build.py stamps the version) */
  document.write('<script src="/cmd/dist/nb.js?v=__NBV__"><\/script>');
})();
