/**
 * Language switch (EN | NO): slide the highlight like an iPhone
 * segmented control, then open the page in the other language.
 */
(function () {
  "use strict";

  var switches = document.querySelectorAll('.lang-switch, .lang-switch-mobile');
  if (!switches.length) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var startsNb = document.documentElement.lang === 'nb';

  function show(nb) {
    switches.forEach(function (sw) {
      sw.classList.toggle('is-nb', nb);
      sw.querySelectorAll('a').forEach(function (a) {
        var on = (a.getAttribute('hreflang') === 'nb') === nb;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
    });
  }

  switches.forEach(function (sw) {
    sw.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (a.classList.contains('active')) return;
        var toNb = a.getAttribute('hreflang') === 'nb';
        show(toNb);
        // Keep the reader in the same section (e.g. #resume) on the home page
        var url = a.href + (location.hash && !a.href.includes('/articles') ? location.hash : '');
        setTimeout(function () { location.href = url; }, reduceMotion ? 0 : 280);
      });
    });
  });

  // Coming back with the browser's back button: put the highlight where it belongs
  window.addEventListener('pageshow', function () { show(startsNb); });
})();
