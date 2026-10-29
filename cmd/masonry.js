/* Home page: no empty gaps between cards.
   On two or three columns every card gets exactly the height it needs, and the next card moves
   up into the space below a short one (a "masonry" layout). It keeps the cards in the grid –
   your order, the wide cards and Settings → Dashboard → Cards all work as before – and it
   follows every change: a card folding, a list growing, a new day. Phones keep one column. */
(function () {
  "use strict";
  var grids = document.querySelectorAll('.dash-sec .grid'); if (!grids.length || !window.ResizeObserver) return;
  var ROW = 2, queued = false;
  /* where each card goes. Every card to the shortest column, in your order. When that still leaves one
     column far longer than the others (a tall card last), the arrangement that ends the run of cards
     most evenly, moving as few cards as possible. Cards as wide as the grid split the runs. */
  function balance(hs, start) {
    var n = start.length, greedy = [], h = start.slice(), i, k, even = start.every(function (x) { return x === start[0]; });
    hs.forEach(function (x) { var m = 0; for (k = 1; k < n; k++) if (h[k] < h[m] - 1) m = k; greedy.push(m); h[m] += x; });
    if (Math.max.apply(null, h) - Math.min.apply(null, h) < 120 || hs.length > 11 || Math.pow(n, hs.length) > 200000) return greedy;
    var best = greedy, bestScore = Math.max.apply(null, h) * 1000, cur = [], col = start.slice();
    (function go(j) {
      if (j === hs.length) {
        var moved = 0; for (i = 0; i < cur.length; i++) if (cur[i] !== greedy[i]) moved++;
        var sc = Math.max.apply(null, col) * 1000 + moved;
        if (sc < bestScore) { bestScore = sc; best = cur.slice(); }
        return;
      }
      for (var c = 0; c < n; c++) {
        if (even && j < n && c > j) continue;        // the first cards start the columns left to right
        col[c] += hs[j]; cur.push(c);
        if (Math.max.apply(null, col) * 1000 < bestScore) go(j + 1);
        cur.pop(); col[c] -= hs[j];
      }
    })(0);
    var hb = start.slice(); best.forEach(function (c, j) { hb[c] += hs[j]; });
    return Math.max.apply(null, h) - Math.max.apply(null, hb) > 30 ? best : greedy;   // only when it really ends shorter
  }
  /* rows and columns for every card, in grid lines (1-based); spans in 2 px rows */
  function place(cards, hs, n, g) {
    var colW = g.clientWidth / n, col = [], out = [], run = [];
    for (var k = 0; k < n; k++) col.push(0);
    function flush() {
      if (!run.length) return;
      var where = balance(run.map(function (j) { return hs[j]; }), col);
      run.forEach(function (j, x) { var c = where[x]; out[j] = { c: c + 1, w: 1, r: col[c] + 1 }; col[c] += hs[j]; });
      run = [];
    }
    cards.forEach(function (c, j) {
      var w = Math.min(n, Math.max(1, Math.round(c.getBoundingClientRect().width / colW)));
      if (w === 1) { run.push(j); return; }
      flush();
      var bestC = 0, bestTop = Infinity;
      for (var s = 0; s + w <= n; s++) { var top = Math.max.apply(null, col.slice(s, s + w)); if (top < bestTop) { bestTop = top; bestC = s; } }
      out[j] = { c: bestC + 1, w: w, r: bestTop + 1 };
      for (var t = bestC; t < bestC + w; t++) col[t] = bestTop + hs[j];
    });
    flush();
    return out;
  }
  function layout() {
    queued = false;
    var wide = matchMedia('(min-width: 760px)').matches;
    grids.forEach(function (g) {
      g.classList.toggle('masonry', wide);
      var gap = parseFloat(getComputedStyle(g).columnGap) || 14;
      var cards = Array.prototype.filter.call(g.children, function (c) { return !c.hidden && c.getClientRects().length; });
      var ix = cards.map(function (c, i) { return { c: c, o: parseInt(getComputedStyle(c).order, 10) || 0, i: i }; });   // your card order (CSS order), then the page's
      cards = ix.sort(function (a, b) { return a.o - b.o || a.i - b.i; }).map(function (x) { return x.c; });
      Array.prototype.forEach.call(g.children, function (c) {
        c.classList.remove('msn-fill');
        if (!wide || c.hidden || !c.getClientRects().length) { c.style.gridRowEnd = ''; c.style.gridRow = ''; c.style.gridColumn = ''; }
      });
      if (!wide) return;
      var n = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length;
      var hs = cards.map(function (c) { return Math.max(1, Math.ceil((c.getBoundingClientRect().height + gap) / ROW)); });
      var pos = place(cards, hs, n, g);
      cards.forEach(function (c, i) {
        var p = pos[i], gr = p.r + ' / span ' + hs[i], gc = p.c + ' / span ' + p.w;
        if (c.dataset.msnR !== gr) { c.style.gridRow = gr; c.dataset.msnR = gr; }
        if (c.dataset.msnC !== gc) { c.style.gridColumn = gc; c.dataset.msnC = gc; }
      });
      /* the lowest card in each column reaches down to the others when it's only a little short,
         so the section ends on one line instead of a ragged edge */
      var bottom = 0, lastIn = {};
      cards.forEach(function (c, i) { var e = pos[i].r + hs[i]; bottom = Math.max(bottom, e); for (var t = pos[i].c; t < pos[i].c + pos[i].w; t++) if (!lastIn[t] || e > lastIn[t].e) lastIn[t] = { i: i, e: e }; });
      var done = {};
      Object.keys(lastIn).forEach(function (k) {
        var L = lastIn[k], c = cards[L.i], short = (bottom - L.e) * ROW;
        if (done[L.i] || pos[L.i].w > 1) return; done[L.i] = 1;
        if (short > 1 && short <= 180) { c.style.gridRow = pos[L.i].r + ' / span ' + (bottom - pos[L.i].r); c.dataset.msnR = ''; c.classList.add('msn-fill'); }
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
