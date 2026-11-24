/* Documentation loads when it's needed (2026-11-20, JP: "splitting Documentation"): the ~240 kB of doc-control.page.js
   is no longer part of Work's page bundle. It's built on its own (dist/doc-control.js) and loaded:
   - at once when the address is a project (#dc=…) or a requirements list (#dr=…),
   - when the Documentation card comes into view (its tab is opened),
   - otherwise quietly a moment after the page has settled, so it's ready when you tap.
   It runs again on each visit to Work (instant page changes), like any page part. build.py writes DCP_V. */
(function () {
  'use strict';
  var DCP_V = '61e32887c7';
  var done = false;
  function load() {
    if (done) return; done = true;
    var s = document.createElement('script'); s.src = '/cmd/dist/doc-control.js?v=' + DCP_V; s.async = true;
    s.onerror = function () { done = false; };
    document.head.appendChild(s);
  }
  var card = document.getElementById('wkDocCtl');
  if (!card) return;
  if (/^#d[cr]=/.test(location.hash)) return load();
  window.addEventListener('hashchange', function () { if (/^#d[cr]=/.test(location.hash)) load(); });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting || x.target.offsetHeight > 0 && getComputedStyle(x.target).display !== 'none' && x.intersectionRatio > 0; })) { io.disconnect(); load(); } });
    io.observe(card);
  }
  var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 600); };
  setTimeout(function () { idle(load, { timeout: 2000 }); }, 400);
})();
