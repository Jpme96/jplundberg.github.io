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
  window.I18N = { lang: lang, t: function (s) { return s; } };
  if (lang !== 'nb') return;
  document.documentElement.lang = 'nb';
  /* right after the head bundle, before the page's own scripts (build.py stamps the version) */
  document.write('<script src="/cmd/dist/nb.js?v=__NBV__"><\/script>');
})();
