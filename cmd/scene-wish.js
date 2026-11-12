/* The Wish picture in 2.5D (Phase F2) – ported from the preview JP picked ("Scenes in 2.5D"):
   WISH LIST: push the cart in, take the gift from the shelf, into the cart – a wish comes true.
   Built on scene25.js (the runner, helpers, your look) and Fig25 (the body). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.wish = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, CL = S.CL, SEG = S.SEG, LERP = S.LERP, MIX = S.MIX, AT = S.AT, B = S.B, GO = S.GO, HOLD = S.HOLD, SIDE = S.SIDE, LEG = S.LEG,
      REST = S.REST, grp = S.grp, CLOCK = S.CLOCK, FLOOR = S.FLOOR, STAR = S.STAR, CHEER = S.CHEER;
    data = data || {};
    return S.run(svg, { hits: [[200, 96, 112, 42, 'wishes'], [206, 140, 66, 60, 'wbuy']], len: 6.6, data: data, render: function (sv, t, st) {
      var now = st.now || 0, LIFE = window.Scene25.LIFE;   /* (a scene may use S for its own things) */
      function FIG(par, o) { o.st = st; o.k = o.k || .5; if (o.look === 'iago') o.look = 'partner'; return window.Scene25.FIG(par, o); }
      var g = add(sv, 'g', {}), cx = -70, face = 90, w = 0, pose = {}, lift = 0, gift = 'shelf', GIFT0 = [232, 120], INTO = [240, 146];
      /* wishes floating as stars, the shelf, the floor */
      [[70, 52], [120, 34], [330, 46]].forEach(function (s, i) { STAR(g, s[0], s[1] + 3 * Math.sin(now / 700 + i), 7, '#f2c94c', .55 + .35 * Math.sin(now / 400 + i * 2)); });
      add(g, 'rect', { x: 206, y: 128, width: 100, height: 4, rx: 1.5, fill: '#a87652' }); [212, 300].forEach(function (x) { add(g, 'path', { d: 'M' + x + ' 132 l0 10 l6 -10 Z', fill: '#8a5e44' }); });
      add(g, 'rect', { x: 262, y: 112, width: 6, height: 16, fill: '#3987e5' }); add(g, 'rect', { x: 269, y: 114, width: 5, height: 14, fill: '#e8743b' }); add(g, 'rect', { x: 275, y: 110, width: 6, height: 18, fill: '#2fae6a' });
      add(g, 'path', { d: 'M286 128 L294 128 L293 118 L287 118 Z', fill: '#c96a3c' }); add(g, 'ellipse', { cx: 290, cy: 114, rx: 6, ry: 5, fill: '#2f8a52' });
      FLOOR(g);
      if (t < 2.6) { cx = LERP(-70, 200, SEG(t, 0, 2.6)); w = Math.min(1, t / .2, (2.6 - t) / .2); } else cx = 200;
      var HDL = [cx + 16, 147], nh = SIDE(-1, 90), fh = SIDE(1, 90);
      if (t < 2.6) { pose[nh] = HOLD(AT(HDL)); pose[fh] = HOLD(AT(HDL)); }
      else if (t < 4.4) { pose[fh] = HOLD(AT(HDL));
        pose[nh] = t < 3.0 ? GO(AT(HDL), AT(GIFT0), SEG(t, 2.6, 3.0), 3) : t < 3.6 ? GO(AT(GIFT0), AT(INTO), SEG(t, 3.0, 3.6), 6) : t < 4.0 ? GO(AT(INTO), AT(HDL), SEG(t, 3.6, 4.0)) : HOLD(AT(HDL));
        if (t >= 4.0) { pose[fh] = GO(AT(HDL), REST, SEG(t, 4.0, 4.4)); pose[nh] = GO(AT(HDL), REST, SEG(t, 4.0, 4.4)); }
        pose.lean = .3 * E(SEG(t, 2.6, 3.0)) * (1 - E(SEG(t, 3.6, 4.0))); }
      else if (t < 4.8) face = 90 * (1 - E(SEG(t, 4.4, 4.8)));
      else { face = 0; var ch = CHEER(t, 4.8, 1.2); lift = ch.lift; if (ch.on) { pose.near = { m: ch.on, s: 2.6, f: 3.0 }; pose.far = { m: ch.on, s: 2.6, f: 3.0 }; } }
      gift = t < 3.0 ? 'shelf' : t < 3.6 ? 'hand' : 'cart';
      pose.lift = lift; var ph = LIFE(st, pose, w);
      function box(x, y) { var b2 = grp(x, y, 0); add(b2, 'rect', { x: -8, y: -7, width: 16, height: 14, rx: 2, fill: '#d93a3a' }); add(b2, 'rect', { x: -1.5, y: -7, width: 3, height: 14, fill: '#f2c94c' }); add(b2, 'rect', { x: -8, y: -1.5, width: 16, height: 3, fill: '#f2c94c' }); add(b2, 'path', { d: 'M0 -7 q-6 -6 -6 0 Z M0 -7 q6 -6 6 0 Z', fill: '#f2c94c' }); return b2; }
      if (gift === 'shelf') g.appendChild(box(GIFT0[0], GIFT0[1] + 1));
      /* the cart: the gift sits in its basket, behind the wire front */
      var c0 = cx + 20;
      if (gift === 'cart') g.appendChild(box(c0 + 22, 156));
      add(g, 'path', { d: 'M' + c0 + ' 148 L' + (c0 + 48) + ' 148 L' + (c0 + 42) + ' 176 L' + (c0 + 6) + ' 176 Z', fill: 'rgba(200,210,220,.18)', stroke: '#b9c1ca', 'stroke-width': 1.6, 'stroke-linejoin': 'round' });
      for (var i = 1; i < 5; i++) add(g, 'line', { x1: c0 + i * 9.6, y1: 148, x2: c0 + 6 + i * 7.2, y2: 176, stroke: '#b9c1ca', 'stroke-width': .8, opacity: .7 });
      add(g, 'line', { x1: c0 + 3, y1: 162, x2: c0 + 45, y2: 162, stroke: '#b9c1ca', 'stroke-width': .8, opacity: .7 });
      add(g, 'path', { d: 'M' + (c0 - 6) + ' 146 L' + c0 + ' 148 M' + (c0 + 8) + ' 176 L' + (c0 + 8) + ' 194 M' + (c0 + 40) + ' 176 L' + (c0 + 40) + ' 194 M' + (c0 + 2) + ' 192 L' + (c0 + 46) + ' 192', fill: 'none', stroke: '#9aa3ad', 'stroke-width': 1.8, 'stroke-linecap': 'round' });
      [c0 + 8, c0 + 40].forEach(function (wx) { add(g, 'circle', { cx: wx, cy: 196.5, r: 3.5, fill: '#2a2d33' }); });
      FIG(g, { cx: cx, gy: 200, face: face, ph: ph, w: w, pose: pose, items: function (H) { return gift === 'hand' && H.sm ? [[H.sm.z - .15, box(H.sm.X, H.sm.Y)]] : []; } });
      /* the wish: a star rises from the cart and joins the others */
      if (t >= 3.6) { var q = SEG(t, 3.6, 4.8), sp = [LERP(c0 + 22, 250, E(q)), LERP(150, 40, E(q))]; STAR(g, sp[0], sp[1], 5 + 3 * E(q), '#f2c94c', q < 1 ? 1 : .55 + .35 * Math.sin(now / 400 + 4));
        if (q < .5) for (var r3 = 0; r3 < 6; r3++) { var a3 = r3 * Math.PI / 3, rr = 6 + 26 * q; add(g, 'circle', { cx: c0 + 22 + Math.cos(a3) * rr, cy: 152 + Math.sin(a3) * rr * .7, r: 1.4, fill: '#f2c94c', opacity: (1 - 2 * q).toFixed(2) }); } }
    } });
  };
})();
