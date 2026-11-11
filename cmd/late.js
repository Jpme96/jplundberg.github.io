/* Last in tail.js: runs the page parts of split modules (cmd/split-page.js) that this page's bundle queued –
   after the everywhere parts in tail.js, so what they build on is there. Runs again after each instant page change. */
(function () {
  "use strict";
  var q = window.__late || []; window.__late = [];
  window.__ui = {};          /* what the last page left there is gone with it */
  q.forEach(function (fn) { fn(); });
})();
