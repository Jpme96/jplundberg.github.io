/* Home page: no empty gaps between cards.
   On two or three columns every card gets exactly the height it needs, and the next card moves
   up into the space below a short one (a "masonry" layout). It keeps the cards in the grid –
   your order, the wide cards and Settings → Dashboard → Cards all work as before – and it
   follows every change: a card folding, a list growing, a new day. Phones keep one column. */
(function () {
  "use strict";
  var grids = document.querySelectorAll('.dash-sec .grid'); if (!grids.length || !window.ResizeObserver) return;
  var ROW = 2, queued = false;
  function layout() {
    queued = false;
    var wide = matchMedia('(min-width: 760px)').matches;
    grids.forEach(function (g) {
      g.classList.toggle('masonry', wide);
      var gap = parseFloat(getComputedStyle(g).columnGap) || 14;
      Array.prototype.forEach.call(g.children, function (c) {
        if (!wide || c.hidden || !c.getClientRects().length) { c.style.gridRowEnd = ''; return; }
        var h = c.getBoundingClientRect().height;
        var want = 'span ' + Math.max(1, Math.ceil((h + gap) / ROW));
        c.classList.remove('msn-fill');
        if (c.style.gridRowEnd !== want) c.style.gridRowEnd = want;
      });
      if (!wide) return;
      /* the lowest card in each column reaches down to the others when it's only a little short,
         so the section ends on one line instead of a ragged edge */
      var cards = Array.prototype.filter.call(g.children, function (c) { return !c.hidden && c.getClientRects().length; });
      var bottom = 0, lastIn = {};
      cards.forEach(function (c) { var r = c.getBoundingClientRect(); bottom = Math.max(bottom, r.bottom); var k = Math.round(r.left); if (!lastIn[k] || r.bottom > lastIn[k].getBoundingClientRect().bottom) lastIn[k] = c; });
      Object.keys(lastIn).forEach(function (k) {
        var c = lastIn[k], r = c.getBoundingClientRect(), short = bottom - r.bottom;
        if (short > 1 && short <= 180) { c.style.gridRowEnd = 'span ' + Math.ceil((r.height + short + gap) / ROW); c.classList.add('msn-fill'); }
      });
    });
  }
  function soon() { if (!queued) { queued = true; requestAnimationFrame(layout); } }
  var ro = new ResizeObserver(soon);
  function watch() { grids.forEach(function (g) { Array.prototype.forEach.call(g.children, function (c) { if (!c._msn) { c._msn = 1; ro.observe(c); } }); }); soon(); }
  grids.forEach(function (g) { new MutationObserver(watch).observe(g, { childList: true, attributes: true, subtree: false, attributeFilter: ['hidden', 'class'] }); });
  window.addEventListener('resize', soon);
  if (window.Vault) window.Vault.onUnlock(function () { setTimeout(watch, 50); });
  watch();
})();
