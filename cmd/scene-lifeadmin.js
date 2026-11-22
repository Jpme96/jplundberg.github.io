/* The Life admin picture in 2.5D (2026-11-22 – JP saw the preview and said "You can do them"):
   a home-office corner – binders on a shelf, a wall calendar on a nail, a desk with the laptop and a lamp, a plant.
   LIFE ADMIN: he comes in with a letter, files it in a binder, and ticks the day off on the calendar.
   Actions: type (at the laptop – a padlock pops up: passwords sorted), lamp (switches the lamp off – a leaf for the climate),
   water (the small can from the desk, the plant watered, the can back). The calendar's ticks are your yearly tasks done this year.
   Built on scene25.js (the runner, helpers, your look) and Fig25 (the body). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.lifeadmin = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, SEG = S.SEG, LERP = S.LERP, AT = S.AT, B = S.B, GO = S.GO, HOLD = S.HOLD, SIDE = S.SIDE, REST = S.REST, FLOOR = S.FLOOR, CHEER = S.CHEER;
    data = data || {};
    var FKEYS = { type: [[0, 0], [.2, 90], [4.4, 90], [4.65, -90], [5.55, -90], [5.8, 0]], lamp: [[0, 0], [.2, 90], [3.7, 90], [3.95, -90], [4.95, -90], [5.2, 0]], water: [[0, 0], [.15, 90], [4.45, 90], [4.7, -90], [5.6, -90], [5.85, 90], [6.5, 90], [6.7, -90], [7.15, -90], [7.35, 0]] };
    var SHELF = [70, 112], CAL = [196, 72], DESK = 300, REST_X = 196, BIND = ['#3d85dc', '#2f9d62', '#e57a3c', '#8a6fdf', '#d6453f'];
    function calendar(g, ticks, pen) {
      add(g, 'circle', { cx: CAL[0], cy: CAL[1] - 24, r: 1.2, fill: '#555c66' });
      add(g, 'line', { x1: CAL[0], y1: CAL[1] - 24, x2: CAL[0] - 10, y2: CAL[1] - 20, stroke: '#8e97a1', 'stroke-width': .6 }); add(g, 'line', { x1: CAL[0], y1: CAL[1] - 24, x2: CAL[0] + 10, y2: CAL[1] - 20, stroke: '#8e97a1', 'stroke-width': .6 });
      add(g, 'rect', { x: CAL[0] - 22, y: CAL[1] - 20, width: 44, height: 46, rx: 2, fill: '#f4f1ea' });
      add(g, 'rect', { x: CAL[0] - 22, y: CAL[1] - 20, width: 44, height: 9, rx: 2, fill: '#d6453f' });
      for (var r = 0; r < 4; r++) for (var c = 0; c < 5; c++) {
        var x = CAL[0] - 18 + c * 8, y = CAL[1] - 7 + r * 8, n = r * 5 + c, done = n < ticks;
        add(g, 'rect', { x: x, y: y, width: 6, height: 6, rx: .8, fill: done ? '#82c09b' : '#cdd3d9' });
        if (done) add(g, 'path', { d: 'M' + (x + 1.2) + ' ' + (y + 3.2) + ' l1.6 1.6 l2.6 -3', fill: 'none', stroke: '#27694a', 'stroke-width': 1, 'stroke-linecap': 'round' });
      }
      if (pen > 0) { var n2 = ticks, x2 = CAL[0] - 18 + (n2 % 5) * 8, y2 = CAL[1] - 7 + Math.floor(n2 / 5) * 8; add(g, 'path', { d: 'M' + (x2 + 1.2) + ' ' + (y2 + 3.2) + ' l' + (1.6 * Math.min(1, pen * 2)) + ' ' + (1.6 * Math.min(1, pen * 2)) + (pen > .5 ? ' l' + (2.6 * (pen - .5) * 2) + ' ' + (-3 * (pen - .5) * 2) : ''), fill: 'none', stroke: '#27694a', 'stroke-width': 1.2, 'stroke-linecap': 'round' }); }
    }
    return S.run(svg, {
      back: function (g) {   /* the still scenery: drawn once */
        /* the shelf with binders, on two brackets */
        add(g, 'rect', { x: SHELF[0] - 46, y: SHELF[1], width: 92, height: 4, rx: 1.5, fill: '#9a7258' });
        [SHELF[0] - 36, SHELF[0] + 36].forEach(function (x) { add(g, 'path', { d: 'M' + x + ' ' + (SHELF[1] + 4) + ' l0 10 l6 -10 Z', fill: '#7a5a44' }); });
        add(g, 'path', { d: 'M' + (SHELF[0] + 24) + ' ' + SHELF[1] + ' l10 -14 l6 0 l-6 14 Z', fill: '#e6e1d6' });   /* a leaning folder */
        /* the window behind the desk */
        add(g, 'rect', { x: 268, y: 40, width: 64, height: 50, rx: 3, fill: '#1f2a40' }); add(g, 'rect', { x: 268, y: 40, width: 64, height: 50, rx: 3, fill: 'none', stroke: '#c09a74', 'stroke-width': 3 });
        add(g, 'line', { x1: 300, y1: 40, x2: 300, y2: 90, stroke: '#c09a74', 'stroke-width': 2 }); add(g, 'circle', { cx: 318, cy: 54, r: 5, fill: '#f3da8e' });
        FLOOR(g);
        /* the plant on the floor */
        add(g, 'path', { d: 'M360 198 L376 198 L374 178 L362 178 Z', fill: '#c4875e' });
        [[-26, 160], [-8, 166], [10, 162], [28, 158], [-40, 172], [40, 170]].forEach(function (l, i) { add(g, 'ellipse', { cx: 368 + l[0] / 4, cy: l[1], rx: 3.6, ry: 10, fill: i % 2 ? '#4a6a39' : '#6a9e45', transform: 'rotate(' + l[0] + ' 368 178)' }); });
      },
      acts: [{ id: 'type', len: 5.8, w: function () { return 2; } }, { id: 'lamp', len: 5.2, w: function () { return 1; } }, { id: 'water', len: 7.4, w: function () { return 1; } }],
      hits: [[20, 80, 100, 40, 'lp-ladmin'], [352, 150, 34, 50, 'lp-climate', 'water'], [170, 46, 52, 54, 'lp-ladmin'], [260, 120, 90, 40, 'lp-digital', 'type'], [330, 100, 40, 50, 'lp-climate', 'lamp']],
      season: { x: 130, y: 196, s: .8 }, len: 7.4, data: data, render: function (sv, t, st) {
        var now = st.now || 0, LIFE = S.LIFE;
        function FIG(par, o) { o.st = st; o.k = o.k || .5; return S.FIG(par, o); }
        var g = add(sv, 'g', {}), cx = -70, face = 90, w = 0, pose = {}, lift = 0, letter = 'none', pull = 0, ticks = st.ticks != null ? st.ticks : Math.min(19, +data.done || 0), can = 'desk', drops = 0, pen = 0, holdPen = false, lock = st.lock || 0, lampOn = st.lampOff ? 0 : 1, leaf = st.lampOff ? 1 : 0, keys = 0;
        var FKF = face; if (st.pact && FKEYS[st.pact]) { var fk0 = FKEYS[st.pact], fj = 0; while (fj < fk0.length - 1 && t > fk0[fj + 1][0]) fj++; FKF = fj >= fk0.length - 1 ? fk0[fk0.length - 1][1] : LERP(fk0[fj][1], fk0[fj + 1][1], E(SEG(t, fk0[fj][0], fk0[fj + 1][0]))); }   /* the hands pick their side from the same facing */
        if (st.pact === 'type') {
          cx = LERP(REST_X, DESK - 40, E(SEG(t, .2, 1.3))); face = 90; w = (t > .2 && t < 1.3) ? Math.min(1, (t - .2) / .2, (1.3 - t) / .2) : (t > 4.6 && t < 5.6) ? Math.min(1, (t - 4.6) / .2, (5.6 - t) / .2) : 0;
          if (t > 4.4) { face = 90 - 180 * E(SEG(t, 4.4, 4.7)); cx = LERP(DESK - 40, REST_X, E(SEG(t, 4.6, 5.6))); if (t > 5.5) face = -90 * (1 - E(SEG(t, 5.5, 5.8))); }
          var K1 = [DESK - 20, 153], K2 = [DESK - 12, 153], ty = t > 2.0 && t < 4.0, bob = function (o) { return ty ? 1.6 * Math.max(0, Math.sin((t - 2) * 14 + o)) : 0; };
          pose.near = t < 1.8 ? REST : t < 2.1 ? GO(REST, AT(K1), SEG(t, 1.8, 2.1), 2) : t < 4.0 ? HOLD(AT([K1[0], K1[1] - bob(0)])) : t < 4.4 ? GO(AT(K1), REST, SEG(t, 4.0, 4.4)) : REST;
          pose.far = t < 1.8 ? REST : t < 2.1 ? GO(REST, AT(K2), SEG(t, 1.8, 2.1), 2) : t < 4.0 ? HOLD(AT([K2[0], K2[1] - bob(1.6)])) : t < 4.4 ? GO(AT(K2), REST, SEG(t, 4.0, 4.4)) : REST;
          pose.lean = .15 * E(SEG(t, 1.8, 2.1)) * (1 - E(SEG(t, 4.0, 4.4))); keys = ty ? 1 : 0; lock = Math.max(lock, E(SEG(t, 3.4, 3.9))); if (t > 3.9) st.lock = 1;
        } else if (st.pact === 'lamp') {
          cx = LERP(REST_X, 312, E(SEG(t, .2, 1.3))); face = 90; w = (t > .2 && t < 1.3) ? Math.min(1, (t - .2) / .2, (1.3 - t) / .2) : (t > 3.9 && t < 5.0) ? Math.min(1, (t - 3.9) / .2, (5.0 - t) / .2) : 0;
          if (t > 3.7) { face = 90 - 180 * E(SEG(t, 3.7, 3.95)); cx = LERP(312, REST_X, E(SEG(t, 3.9, 5.0))); if (t > 4.95) face = -90 * (1 - E(SEG(t, 4.95, 5.2))); }
          var SW = [DESK + 34, 128], nh = SIDE(-1, 90);
          pose[nh] = t < 1.4 ? REST : t < 1.9 ? GO(REST, AT(SW), SEG(t, 1.4, 1.9), 2) : t < 2.4 ? HOLD(AT([SW[0], SW[1] + (t > 2.1 ? 1.5 : 0)])) : t < 2.9 ? GO(AT(SW), REST, SEG(t, 2.4, 2.9)) : REST;
          lampOn = t < 2.15 ? lampOn : 0; if (t >= 2.15) st.lampOff = 1; leaf = Math.max(leaf, E(SEG(t, 2.3, 3.0)));
        } else if (st.pact === 'water') {   /* the can from the desk, over to the plant, a pour, the can back on the desk */
          var CAN = [DESK - 34, 154], PL = 346, wp = function (a2, b2, t0, t1) { return LERP(a2, b2, E(SEG(t, t0, t1))); };
          cx = t < 1.1 ? wp(REST_X, DESK - 50, .1, 1.1) : t < 1.9 ? DESK - 50 : t < 3.0 ? wp(DESK - 50, PL, 1.9, 3.0) : t < 4.6 ? PL : t < 5.6 ? wp(PL, DESK - 50, 4.6, 5.6) : t < 6.7 ? DESK - 50 : wp(DESK - 50, REST_X, 6.7, 7.15);
          var walking = (t > .1 && t < 1.1) || (t > 1.9 && t < 3.0) || (t > 4.6 && t < 5.6) || (t > 6.7 && t < 7.15);
          var rw = function (a3, b3) { return t > a3 && t < b3 ? Math.min(1, (t - a3) / .2, (b3 - t) / .2) : 0; }; w = walking ? Math.max(rw(.1, 1.1), rw(1.9, 3.0), rw(4.6, 5.6), rw(6.7, 7.15)) : 0; face = (t > 4.5 && t < 5.7) || t > 6.2 ? -90 : 90; if (t > 7.0) face = -90 * (1 - E(SEG(t, 7.0, 7.2)));
          var nh3 = SIDE(-1, FKF), POUR = [PL + 14, 150];
          pose[nh3] = t < 1.1 ? REST : t < 1.5 ? GO(REST, AT(CAN), SEG(t, 1.1, 1.5), 2) : t < 1.85 ? GO(AT(CAN), B(150, 10), SEG(t, 1.5, 1.85)) : t < 3.0 ? HOLD(B(150, 10)) : t < 3.4 ? GO(B(150, 10), AT(POUR), SEG(t, 3.0, 3.4)) : t < 4.3 ? HOLD(AT(POUR)) : t < 4.6 ? GO(AT(POUR), B(150, 10), SEG(t, 4.3, 4.6)) : t < 5.85 ? HOLD(B(150, 10)) : t < 6.15 ? GO(B(150, 10), AT(CAN), SEG(t, 5.85, 6.15), 2) : t < 6.5 ? GO(AT(CAN), REST, SEG(t, 6.15, 6.5)) : REST;
          can = t > 1.45 && t < 6.15 ? 'hand' : 'desk'; drops = t > 3.4 && t < 4.3 ? SEG(t, 3.4, 4.3) : 0; if (t > 3.4) pose.lean = .2 * E(SEG(t, 3.0, 3.4)) * (1 - E(SEG(t, 4.3, 4.6)));
        } else if (t < 2.0) { cx = LERP(-70, SHELF[0] + 4, SEG(t, 0, 2.0)); w = Math.min(1, t / .2, (2.0 - t) / .2); letter = 'hand'; }
        else if (t < 3.6) {   /* face the shelf, the letter into a binder */
          cx = SHELF[0] + 4; face = t < 2.3 ? 90 - 90 * E(SEG(t, 2.0, 2.3)) : t < 3.3 ? 0 : 90 * E(SEG(t, 3.3, 3.6));
          var BX = [SHELF[0] - 6, SHELF[1] - 12], fh = SIDE(1, face);
          pose[fh] = t < 2.3 ? REST : t < 2.8 ? GO(REST, AT(BX), SEG(t, 2.3, 2.8), 3) : t < 3.1 ? HOLD(AT(BX)) : t < 3.5 ? GO(AT(BX), REST, SEG(t, 3.1, 3.5)) : REST;
          letter = t < 2.95 ? 'hand' : 'binder'; pull = t > 2.6 && t < 3.2 ? Math.sin(Math.PI * SEG(t, 2.6, 3.2)) : 0;
        } else if (t < 4.8) { cx = LERP(SHELF[0] + 4, REST_X, E(SEG(t, 3.6, 4.8))); w = Math.min(1, (t - 3.6) / .2, (4.8 - t) / .2); letter = 'binder'; }
        else {   /* the calendar: a tick for today */
          cx = REST_X; face = t < 5.1 ? 90 - 60 * E(SEG(t, 4.8, 5.1)) : t < 6.3 ? 30 : 30 * (1 - E(SEG(t, 6.3, 6.6)));
          var CT = [CAL[0] - 18 + (ticks % 5) * 8 + 3, CAL[1] - 7 + Math.floor(ticks / 5) * 8 + 3], nh2 = SIDE(-1, face);
          pose[nh2] = t < 5.1 ? REST : t < 5.5 ? GO(REST, AT(CT), SEG(t, 5.1, 5.5), 2) : t < 6.0 ? HOLD(AT([CT[0] + 3 * SEG(t, 5.5, 6.0), CT[1] - 2 * Math.sin(Math.PI * SEG(t, 5.5, 6.0))])) : t < 6.4 ? GO(AT(CT), REST, SEG(t, 6.0, 6.4)) : REST;
          pen = SEG(t, 5.5, 6.0); holdPen = t > 5.2 && t < 6.3; letter = 'binder';
          if (t >= 6.0) { if (!st.tickedNow) st.ticks = Math.min(19, ticks + 1); ticks = st.ticks; st.tickedNow = 1; pen = 0; }
          if (t > 6.6) { face = 0; var ch = CHEER(t, 6.6, .8); lift = ch.lift * .6; }
        }
        /* where he faces through each action: eased between these moments, from the front and back to it (no snaps) */
        if (st.pact && FKEYS[st.pact]) { var fk = FKEYS[st.pact], fi = 0; while (fi < fk.length - 1 && t > fk[fi + 1][0]) fi++; face = fi >= fk.length - 1 ? fk[fk.length - 1][1] : LERP(fk[fi][1], fk[fi + 1][1], E(SEG(t, fk[fi][0], fk[fi + 1][0]))); }
        if (t < 1 && !st.pact) st.tickedNow = 0;
        /* binders on the shelf: one slides out a little when the letter goes in */
        BIND.forEach(function (c, i) { var bx = SHELF[0] - 40 + i * 12, out = i === 2 ? pull * 6 : 0; add(g, 'rect', { x: bx, y: SHELF[1] - 26 - out, width: 10, height: 26, rx: 1.2, fill: c }); add(g, 'rect', { x: bx + 2.5, y: SHELF[1] - 18 - out, width: 5, height: 7, rx: 1, fill: '#f4f1ea', opacity: .85 }); add(g, 'circle', { cx: bx + 5, cy: SHELF[1] - 6 - out, r: 1.6, fill: '#1d2128', opacity: .5 }); });
        calendar(g, ticks, pen);
        /* the desk, the laptop, the lamp */
        add(g, 'rect', { x: DESK - 46, y: 156, width: 92, height: 5, rx: 1.5, fill: '#9a7258' }); add(g, 'rect', { x: DESK - 42, y: 161, width: 3, height: 37, fill: '#7a5a44' }); add(g, 'rect', { x: DESK + 39, y: 161, width: 3, height: 37, fill: '#7a5a44' });
        add(g, 'rect', { x: DESK + 14, y: 161, width: 24, height: 22, rx: 1.5, fill: '#7a5a44' });   /* a drawer */
        add(g, 'path', { d: 'M' + (DESK - 22) + ' 155 L' + (DESK + 12) + ' 155 L' + (DESK + 8) + ' 132 L' + (DESK - 18) + ' 132 Z', fill: '#3b414b' });
        add(g, 'path', { d: 'M' + (DESK - 19) + ' 152 L' + (DESK + 9) + ' 152 L' + (DESK + 6) + ' 135 L' + (DESK - 16) + ' 135 Z', fill: keys || lock ? '#305b90' : '#2a2e36' });
        add(g, 'rect', { x: DESK - 26, y: 155, width: 42, height: 2, rx: 1, fill: '#6f7781' });
        if (lock > 0) { var lx = DESK - 5, ly = 143, s2 = lock; add(g, 'rect', { x: lx - 4 * s2, y: ly - 2 * s2, width: 8 * s2, height: 6 * s2, rx: 1, fill: '#f2c94c' }); add(g, 'path', { d: 'M' + (lx - 2.6 * s2) + ' ' + (ly - 2 * s2) + ' v' + (-2.4 * s2) + ' a' + (2.6 * s2) + ' ' + (2.6 * s2) + ' 0 0 1 ' + (5.2 * s2) + ' 0 v' + (2.4 * s2), fill: 'none', stroke: '#f2c94c', 'stroke-width': 1.1 }); }
        /* the lamp: arm, shade, the light when it's on */
        add(g, 'rect', { x: DESK + 26, y: 153, width: 14, height: 3, rx: 1, fill: '#3b414b' }); add(g, 'path', { d: 'M' + (DESK + 33) + ' 153 L' + (DESK + 30) + ' 132 L' + (DESK + 20) + ' 124', fill: 'none', stroke: '#3b414b', 'stroke-width': 1.8 });
        add(g, 'path', { d: 'M' + (DESK + 12) + ' 128 L' + (DESK + 24) + ' 118 L' + (DESK + 28) + ' 126 Z', fill: '#c8901e' });
        if (lampOn) add(g, 'path', { d: 'M' + (DESK + 14) + ' 128 L' + (DESK + 27) + ' 125 L' + (DESK + 10) + ' 155 L' + (DESK - 20) + ' 155 Z', fill: '#ffe2a8', opacity: .16 });
        if (leaf > 0) { var lx2 = DESK + 46, ly2 = 112 - 6 * leaf; add(g, 'path', { d: 'M' + lx2 + ' ' + ly2 + ' q' + (8 * leaf) + ' ' + (-10 * leaf) + ' ' + (16 * leaf) + ' ' + (-4 * leaf) + ' q' + (-6 * leaf) + ' ' + (10 * leaf) + ' ' + (-16 * leaf) + ' ' + (4 * leaf) + ' Z', fill: '#6a9e45', opacity: .9 }); }
        function wcan(par, x, y, tilt) { var cg = add(par, 'g', { transform: 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (tilt || 0).toFixed(1) + ')' }); add(cg, 'path', { d: 'M-5 0 L5 0 L4 -9 L-4 -9 Z', fill: '#3a8a78' }); add(cg, 'path', { d: 'M4 -6 L11 -11', stroke: '#3a8a78', 'stroke-width': 1.6, 'stroke-linecap': 'round' }); add(cg, 'path', { d: 'M-4 -9 q4 -6 8 0', fill: 'none', stroke: '#2e5e56', 'stroke-width': 1.1 }); return cg; }
        if (can === 'desk') wcan(g, DESK - 34, 156, 0);
        if (drops > 0) for (var dq = 0; dq < 4; dq++) { var dz = (drops * 3 + dq * .25) % 1; add(g, 'circle', { cx: (346 + 22 + dz * 2).toFixed(1), cy: (146 + 22 * dz).toFixed(1), r: 1.1, fill: '#8ab2e2', opacity: (1 - dz).toFixed(2) }); }
        pose.lift = lift; var ph = LIFE(st, pose, w);
        FIG(g, { cx: cx, gy: 200, face: face, ph: ph, w: w, pose: pose, items: function (H) {
          var out = [];
          if (letter === 'hand' && H.s1) { var lg = el('g', {}); add(lg, 'rect', { x: H.s1.X - 6, y: H.s1.Y - 5, width: 12, height: 8, rx: 1, fill: '#f4f1ea' }); add(lg, 'path', { d: 'M' + (H.s1.X - 6) + ' ' + (H.s1.Y - 5) + ' l6 4.5 l6 -4.5', fill: 'none', stroke: '#aeb6bf', 'stroke-width': .7 }); out.push([9, lg]); }
          if (can === 'hand' && H.sm) { var cg2 = el('g', {}); wcan(cg2, H.sm.X + 2, H.sm.Y + 8, drops > 0 ? 35 : 0); out.push([9, cg2]); }
          if (holdPen && H.sm) { var pg = el('g', {}); add(pg, 'line', { x1: H.sm.X, y1: H.sm.Y, x2: H.sm.X + 3, y2: H.sm.Y - 6, stroke: '#2c5ea8', 'stroke-width': 1.6, 'stroke-linecap': 'round' }); out.push([9, pg]); }
          return out; } });
      } });
  };
})();
