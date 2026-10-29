/* Home page: no empty gaps between cards.
   On two or three columns every card gets exactly the height it needs, and the next card moves
   up into the space below a short one (a "masonry" layout). It keeps the cards in the grid –
   your order, the wide cards and Settings → Dashboard → Cards all work as before – and it
   follows every change: a card folding, a list growing, a new day. Phones keep one column. */
(function () {
  "use strict";
  var grids = document.querySelectorAll('.dash-sec .grid'); if (!grids.length || !window.ResizeObserver) return;
  var ROW = 2, queued = false;
  /* Where each card goes. Every card to the shortest column, in your order. When that still leaves
     one column far longer than the others, it tries the other arrangements of the same cards –
     moving a card to another column, or letting a card that reads well wide (Quick links, Notes,
     Goals, To-do, This week) take two columns – and keeps the one that ends the section most evenly, with as
     few changes as possible. Cards as wide as the grid (At a glance) split the cards into runs. */
  var STRETCH = ['links', 'notes', 'goals', 'todo', 'habits'];
  function segment(items, start, n) {
    var k, i, col, greedy = [];
    /* the plain way: every card in the shortest column */
    col = start.slice();
    items.forEach(function (it) {
      if (it.fixed) { var s = bestStart(col, it.fixed); greedy.push({ c: s, w: it.fixed }); setCols(col, s, it.fixed, it.h[it.fixed]); return; }
      var m = 0; for (k = 1; k < n; k++) if (col[k] < col[m] - 1) m = k; greedy.push({ c: m, w: 1 }); col[m] += it.h[1];
    });
    var gmax = Math.max.apply(null, col), spread = gmax - Math.min.apply(null, col);
    if (spread < 60 || items.length > 10) return greedy;     // even enough already (in 2 px rows: 120 px)
    var combos = 1; items.forEach(function (it) { combos *= it.fixed ? n : n + (it.h[2] ? n - 1 : 0); });
    if (combos > 250000) return greedy;
    var even = start.every(function (x) { return x === start[0]; });
    var best = greedy, bestScore = gmax * 1000, cur = [];
    col = start.slice();
    (function go(j, waste) {
      var top = Math.max.apply(null, col);
      if (top * 1000 >= bestScore) return;
      if (j === items.length) {
        var moved = 0, wide = 0;
        for (i = 0; i < cur.length; i++) { if (cur[i].c !== greedy[i].c || cur[i].w !== greedy[i].w) moved++; if (cur[i].w > 1 && !items[i].fixed) wide++; }
        var ragged = 0; for (k = 0; k < n; k++) ragged += top - col[k];      // empty space left at the bottom
        var sc = top * 1000 + (waste + ragged) * 20 + wide * 600 + moved;
        if (sc < bestScore) { bestScore = sc; best = cur.slice(); }
        return;
      }
      var it = items[j], opts = [];
      if (it.fixed) for (k = 0; k + it.fixed <= n; k++) opts.push({ c: k, w: it.fixed });
      else {
        for (k = 0; k < n; k++) if (!(even && j < n && k > j)) opts.push({ c: k, w: 1 });
        if (it.h[2]) for (k = 0; k + 2 <= n; k++) opts.push({ c: k, w: 2 });
      }
      opts.forEach(function (o) {
        var saved = col.slice(), st = Math.max.apply(null, col.slice(o.c, o.c + o.w)), w8 = 0;
        for (k = o.c; k < o.c + o.w; k++) w8 += st - col[k];
        setCols(col, o.c, o.w, st - Math.max.apply(null, col.slice(o.c, o.c + o.w)) + it.h[o.w]);
        cur.push(o); go(j + 1, waste + w8); cur.pop();
        for (k = 0; k < n; k++) col[k] = saved[k];
      });
    })(0, 0);
    /* only when it really ends shorter */
    var hb = start.slice(); best.forEach(function (o, x) { var st = Math.max.apply(null, hb.slice(o.c, o.c + o.w)); setCols(hb, o.c, o.w, items[x].h[o.w]); });
    return gmax - Math.max.apply(null, hb) > 30 ? best : greedy;
  }
  function bestStart(col, w) { var b = 0, bt = Infinity; for (var s = 0; s + w <= col.length; s++) { var t = Math.max.apply(null, col.slice(s, s + w)); if (t < bt) { bt = t; b = s; } } return b; }
  /* the columns s..s+w end at their highest point plus h */
  function setCols(col, s, w, h) { var t = Math.max.apply(null, col.slice(s, s + w)); for (var k = s; k < s + w; k++) col[k] = t + h; }

  function place(cards, info, n) {
    var col = [], out = [], run = [];
    for (var k = 0; k < n; k++) col.push(0);
    function flush() {
      if (!run.length) return;
      var where = segment(run.map(function (j) { return info[j]; }), col, n);
      run.forEach(function (j, x) {
        var o = where[x], st = Math.max.apply(null, col.slice(o.c, o.c + o.w));
        out[j] = { c: o.c + 1, w: o.w, r: st + 1, h: info[j].h[o.w] };
        setCols(col, o.c, o.w, info[j].h[o.w]);
      });
      run = [];
    }
    cards.forEach(function (c, j) {
      var w = info[j].fixed;
      if (w !== n) { run.push(j); return; }
      flush();
      var st = Math.max.apply(null, col);
      out[j] = { c: 1, w: n, r: st + 1, h: info[j].h[n] };
      setCols(col, 0, n, info[j].h[n]);
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
        c.classList.remove('msn-fill', 'msn-wide');
        c.style.gridRow = ''; c.style.gridRowEnd = '';
        c.style.gridColumn = wide && STRETCH.some(function (k) { return c.classList.contains(k); }) ? 'auto' : '';   // their own width is one column; two only when chosen
        delete c.dataset.msnR; delete c.dataset.msnC;
      });
      if (!wide) return;
      var n = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length, colW = (g.clientWidth + gap) / n;
      function rows(px) { return Math.max(1, Math.ceil((px + gap) / ROW)); }
      /* each card's natural width and height; for cards that may go wide, the height at two columns too */
      var info = cards.map(function (c) {
        var r = c.getBoundingClientRect(), w = Math.min(n, Math.max(1, Math.round((r.width + gap) / colW))), h = {};
        h[w] = rows(r.height);
        return { el: c, fixed: w > 1 ? w : 0, h: h, stretch: w === 1 && n > 2 && STRETCH.some(function (k) { return c.classList.contains(k); }) };
      });
      info.forEach(function (it) { if (it.fixed === 0) it.fixed = 0; });
      var trial = info.filter(function (it) { return it.stretch; });
      if (trial.length) {
        trial.forEach(function (it) { it.el.style.gridColumn = 'span 2'; });
        trial.forEach(function (it) { it.h[2] = rows(it.el.getBoundingClientRect().height); });
        trial.forEach(function (it) { it.el.style.gridColumn = 'auto'; });
      }
      info.forEach(function (it) { if (!it.fixed) it.fixed = 0; else if (it.fixed === 1) it.fixed = 0; });
      var pos = place(cards, info, n);
      cards.forEach(function (c, i) {
        var p = pos[i];
        c.style.gridRow = p.r + ' / span ' + p.h; c.style.gridColumn = p.c + ' / span ' + p.w;
        c.classList.toggle('msn-wide', p.w > 1 && !info[i].fixed);
      });
      /* the lowest card in each column reaches down to the others when it's only a little short,
         so the section ends on one line instead of a ragged edge */
      var bottom = 0, lastIn = {};
      pos.forEach(function (p, i) { var e = p.r + p.h; bottom = Math.max(bottom, e); for (var t = p.c; t < p.c + p.w; t++) if (!lastIn[t] || e > lastIn[t].e) lastIn[t] = { i: i, e: e }; });
      var done = {};
      Object.keys(lastIn).forEach(function (k) {
        var L = lastIn[k], p = pos[L.i], short = (bottom - L.e) * ROW;
        if (done[L.i]) return; done[L.i] = 1;
        for (var t = p.c; t < p.c + p.w; t++) if (lastIn[t].i !== L.i) return;     // a wide card only when it's last in all its columns
        if (cards[L.i].classList.contains('card-folded')) return;          // a folded card stays one line
        if (short > 1 && short <= 180 && p.w < n) { cards[L.i].style.gridRow = p.r + ' / span ' + (bottom - p.r); cards[L.i].classList.add('msn-fill'); }
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
