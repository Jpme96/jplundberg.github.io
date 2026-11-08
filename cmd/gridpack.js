/* No gaps between cards in plain card grids (Admin's cards, the System tab): on two or more columns each
   card spans exactly as many 4 px rows as it is tall, so the next card moves up into the space under a
   short one – a "masonry" layout that keeps the cards in their order. Phones (one column) are left alone.
   Home has its own (masonry.js); Finances and the kit pages use rows of equal height. */
(function () {
  "use strict";
  if (!window.ResizeObserver) return;
  var SEL = '.cr-grid:not(.cr-eq), .cr-sys', ROW = 4, queued = false;
  function cols(g) { var cs = getComputedStyle(g); return cs.display === 'grid' ? cs.gridTemplateColumns.split(' ').filter(Boolean).length : 0; }
  /* the grid's items: its children, looking through wrappers that are display: contents */
  function items(g) {
    var out = [];
    (function walk(el) { [].forEach.call(el.children, function (k) { var d = getComputedStyle(k).display; if (d === 'contents') walk(k); else if (d !== 'none' && !k.hidden) out.push(k); }); })(g);
    return out;
  }
  function pack() {
    queued = false;
    document.querySelectorAll(SEL).forEach(function (g) {
      if (g.closest('.cr-sys') && g !== g.closest('.cr-sys')) return;     /* inside the System grid: packed as part of it */
      var on = g.offsetParent !== null && cols(g) > 1, kids = items(g);
      if (!on) { if (g.classList.contains('gp-on')) { g.classList.remove('gp-on'); kids.forEach(function (k) { k.style.gridRowEnd = ''; }); } return; }
      var gap = parseFloat(getComputedStyle(g).rowGap) || 0;
      g.classList.add('gp-on');
      kids.forEach(function (k) {
        /* the card's own height, not the stretched one */
        var h = k.firstElementChild && k.children.length === 1 && !k.matches('.card, section') ? k.firstElementChild.getBoundingClientRect().height : k.scrollHeight;
        var span = Math.max(1, Math.ceil((h + gap) / (ROW + gap)));
        var v = 'span ' + span; if (k.style.gridRowEnd !== v) k.style.gridRowEnd = v;
      });
    });
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(pack); } }
  var ro = new ResizeObserver(queue), seen = new WeakSet();
  function watch() {
    document.querySelectorAll(SEL).forEach(function (g) {
      if (!seen.has(g)) { seen.add(g); ro.observe(g); }
      items(g).forEach(function (k) { if (!seen.has(k)) { seen.add(k); ro.observe(k); } });
    });
    queue();
  }
  new MutationObserver(function () { watch(); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', queue);
  watch();
  window.GridPack = { pack: pack };
})();
