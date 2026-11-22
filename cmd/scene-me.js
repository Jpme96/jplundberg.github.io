/* The Me picture in 2.5D (2026-11-22 – JP saw the preview and said "You can do them"):
   a quiet evening corner – the window with the moon, a bookshelf on brackets, the armchair under a floor lamp, a mat on the floor.
   ME: he takes a book from the shelf, sits down in the armchair and reads a while, then gets up and leaves the book on the chair.
   Actions: breathe (on the mat: arms up slowly and down, a ring that grows and shrinks), phone (the phone goes into the basket –
   a phone-free evening; the stars stay when you ticked tonight in Screen time), tea (the mug from the shelf, two sips, back).
   Built on scene25.js (the runner, helpers, your look) and Fig25 (the body). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.me = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, SEG = S.SEG, LERP = S.LERP, AT = S.AT, B = S.B, GO = S.GO, HOLD = S.HOLD, SIDE = S.SIDE, REST = S.REST, FLOOR = S.FLOOR, STAR = S.STAR;
    data = data || {};
    var FKEYS = { breathe: [[0, 0], [.2, -90], [1.5, -90], [1.8, 0], [5.6, 0], [5.85, 90], [6.8, 90], [7.0, 0]], phone: [[0, 0], [.3, 30], [1.3, 30], [1.5, 90], [4.1, 90], [4.35, -90], [5.2, -90], [5.5, 0]], tea: [[0, 0], [.1, -90], [1.6, -90], [1.9, 0], [4.0, 0], [4.3, -90], [4.9, -90], [5.15, 90], [5.85, 90], [6.0, 0]] };
    var SHELF = [176, 104], SILL = [98, 100], CHAIR = 304, MAT = 94, BASKET = [226, 196], REST_X = 196, BOOKS = ['#2c5ea8', '#e57a3c', '#2f9d62', '#8a6fdf', '#d6453f', '#f2c94c', '#3a8a78'];
    function book(g, x, y, s, open) {
      if (open) { add(g, 'path', { d: 'M' + x + ' ' + y + ' q' + (-6 * s) + ' ' + (-3 * s) + ' ' + (-12 * s) + ' 0 l0 ' + (-9 * s) + ' q' + (6 * s) + ' ' + (-3 * s) + ' ' + (12 * s) + ' 0 Z', fill: '#f4f1ea' }); add(g, 'path', { d: 'M' + x + ' ' + y + ' q' + (6 * s) + ' ' + (-3 * s) + ' ' + (12 * s) + ' 0 l0 ' + (-9 * s) + ' q' + (-6 * s) + ' ' + (-3 * s) + ' ' + (-12 * s) + ' 0 Z', fill: '#e6e1d6' }); add(g, 'line', { x1: x, y1: y, x2: x, y2: y - 9 * s, stroke: '#aeb6bf', 'stroke-width': .6 }); }
      else add(g, 'rect', { x: x - 6 * s, y: y - 8 * s, width: 12 * s, height: 8 * s, rx: 1, fill: '#e57a3c' });
    }
    return S.run(svg, {
      back: function (g) {   /* the still scenery: drawn once */
        /* the window and the moon */
        add(g, 'rect', { x: 36, y: 36, width: 70, height: 64, rx: 4, fill: '#1f2a40' }); add(g, 'circle', { cx: 86, cy: 54, r: 8, fill: '#f3da8e' }); add(g, 'circle', { cx: 90, cy: 51, r: 7, fill: '#1f2a40' });
        add(g, 'rect', { x: 36, y: 36, width: 70, height: 64, rx: 4, fill: 'none', stroke: '#c09a74', 'stroke-width': 3 }); add(g, 'line', { x1: 71, y1: 36, x2: 71, y2: 100, stroke: '#c09a74', 'stroke-width': 2 });
        add(g, 'rect', { x: 32, y: 100, width: 78, height: 4, rx: 1.5, fill: '#9a7258' });
        /* the shelf on two brackets */
        add(g, 'rect', { x: SHELF[0] - 36, y: SHELF[1], width: 72, height: 4, rx: 1.5, fill: '#9a7258' });
        [SHELF[0] - 28, SHELF[0] + 28].forEach(function (x) { add(g, 'path', { d: 'M' + x + ' ' + (SHELF[1] + 4) + ' l0 10 l6 -10 Z', fill: '#7a5a44' }); });
        add(g, 'ellipse', { cx: SHELF[0] + 26, cy: SHELF[1] - 4, rx: 6, ry: 4, fill: '#6a9e45' }); add(g, 'path', { d: 'M' + (SHELF[0] + 21) + ' ' + SHELF[1] + ' l10 0 l-1 -5 l-8 0 Z', fill: '#c4875e' });
        /* the floor lamp behind the chair */
        add(g, 'line', { x1: CHAIR + 40, y1: 198, x2: CHAIR + 40, y2: 92, stroke: '#3b414b', 'stroke-width': 2 }); add(g, 'ellipse', { cx: CHAIR + 40, cy: 198, rx: 9, ry: 2.4, fill: '#3b414b' });
        add(g, 'path', { d: 'M' + (CHAIR + 28) + ' 98 L' + (CHAIR + 52) + ' 98 L' + (CHAIR + 46) + ' 80 L' + (CHAIR + 34) + ' 80 Z', fill: '#f3da8e' });
        add(g, 'path', { d: 'M' + (CHAIR + 28) + ' 98 L' + (CHAIR + 52) + ' 98 L' + (CHAIR + 80) + ' 198 L' + (CHAIR - 30) + ' 198 Z', fill: '#ffe2a8', opacity: .07 });   /* the lamp's light */
        FLOOR(g);
        /* the mat */
        add(g, 'path', { d: 'M' + (MAT - 34) + ' 202 L' + (MAT + 34) + ' 202 L' + (MAT + 28) + ' 194 L' + (MAT - 28) + ' 194 Z', fill: '#5c4e92' });
        /* the basket for the phone */
        add(g, 'path', { d: 'M' + (BASKET[0] - 9) + ' ' + (BASKET[1] - 10) + ' L' + (BASKET[0] + 9) + ' ' + (BASKET[1] - 10) + ' L' + (BASKET[0] + 7) + ' ' + BASKET[1] + ' L' + (BASKET[0] - 7) + ' ' + BASKET[1] + ' Z', fill: '#c09a74' });
        add(g, 'line', { x1: BASKET[0] - 8, y1: BASKET[1] - 5, x2: BASKET[0] + 8, y2: BASKET[1] - 5, stroke: '#9a7258', 'stroke-width': .8 });
      },
      acts: [{ id: 'breathe', len: 7.0, w: function () { return 2; } }, { id: 'phone', len: 5.6, w: function (d, st) { return st && st.phoneAway ? 0 : 1; } }, { id: 'tea', len: 6.0, w: function () { return 1.2; } }],
      hits: [[130, 70, 92, 40, 'lp-media'], [84, 86, 30, 18, 'lp-calm', 'tea'], [270, 130, 90, 70, 'lp-sleep'], [50, 186, 90, 20, 'lp-calm', 'breathe'], [206, 180, 40, 24, 'lp-screen', 'phone']],
      season: { x: 128, y: 196, s: .8 }, len: 9.8, data: data, render: function (sv, t, st) {
        var now = st.now || 0, LIFE = S.LIFE;
        function FIG(par, o) { o.st = st; o.k = o.k || .5; return S.FIG(par, o); }
        var g = add(sv, 'g', {}), cx = -70, face = 90, w = 0, pose = {}, lift = 0, bk = st.bookChair ? 'chair' : 'shelf', sitF = 0, ring = 0, ph1 = 'none', inBasket = st.phoneAway || data.phoneFree ? 1 : 0, stars = inBasket, page = 0, mug = 'shelf', sip = 0;
        var FKF = face; if (st.pact && FKEYS[st.pact]) { var fk0 = FKEYS[st.pact], fj = 0; while (fj < fk0.length - 1 && t > fk0[fj + 1][0]) fj++; FKF = fj >= fk0.length - 1 ? fk0[fk0.length - 1][1] : LERP(fk0[fj][1], fk0[fj + 1][1], E(SEG(t, fk0[fj][0], fk0[fj + 1][0]))); }   /* the hands pick their side from the same facing */
        if (st.pact === 'breathe') {
          cx = LERP(REST_X, MAT, E(SEG(t, .2, 1.4))); face = t < 1.5 ? -90 : t < 1.8 ? -90 + 90 * E(SEG(t, 1.5, 1.8)) : 0; w = (t > .2 && t < 1.4) ? Math.min(1, (t - .2) / .2, (1.4 - t) / .2) : (t > 5.8 && t < 6.9) ? Math.min(1, (t - 5.8) / .2, (6.9 - t) / .2) : 0;
          if (t > 5.6) { face = 90 * E(SEG(t, 5.6, 5.9)) * (1 - E(SEG(t, 6.8, 7.0))); cx = LERP(MAT, REST_X, E(SEG(t, 5.8, 6.9))); }
          var br = t > 1.9 && t < 5.5 ? (1 - Math.cos((t - 1.9) / 1.8 * Math.PI * 2)) / 2 : 0, UP = B(24, 28);
          if (t > 1.9 && t < 5.5) { pose.near = GO(REST, UP, br); pose.far = GO(REST, UP, br); }
          ring = br; lift = 1.5 * br;
        } else if (st.pact === 'phone') {
          cx = LERP(REST_X, BASKET[0] - 22, E(SEG(t, 1.4, 2.4))); face = 90; w = (t > 1.4 && t < 2.4) ? Math.min(1, (t - 1.4) / .2, (2.4 - t) / .2) : (t > 4.3 && t < 5.2) ? Math.min(1, (t - 4.3) / .2, (5.2 - t) / .2) : 0;
          if (t < 1.4) face = 30;
          var LOOK = AT([REST_X + 8, 146]), DROP = [BASKET[0] - 2, BASKET[1] - 14], nh = SIDE(-1, FKF);
          pose[nh] = t < .2 ? GO(REST, LOOK, SEG(t, 0, .2)) : t < 1.3 ? HOLD(LOOK) : t < 2.6 ? GO(LOOK, REST, SEG(t, 1.3, 1.6)) : t < 3.1 ? GO(REST, AT(DROP), SEG(t, 2.6, 3.1), 3) : t < 3.4 ? HOLD(AT(DROP)) : t < 3.8 ? GO(AT(DROP), REST, SEG(t, 3.4, 3.8)) : REST;
          pose.lean = .5 * E(SEG(t, 2.6, 3.1)) * (1 - E(SEG(t, 3.4, 3.8)));
          ph1 = t < 1.4 ? 'look' : t < 3.2 ? 'hand' : 'none'; if (t >= 3.2) { inBasket = 1; st.phoneAway = 1; } stars = Math.max(stars, E(SEG(t, 3.4, 4.2)));
          if (t > 4.2) { face = 90 - 180 * E(SEG(t, 4.1, 4.3)); cx = LERP(BASKET[0] - 22, REST_X, E(SEG(t, 4.3, 5.2))); if (t > 5.2) face = -90 * (1 - E(SEG(t, 5.2, 5.5))); }
        } else if (st.pact === 'tea') {   /* the mug from the window sill, two sips, back on the sill */
          var TX = 128, MG = [SILL[0], SILL[1] - 2], UPM = AT([TX + 9, 150]), MOUTH = AT([TX + 5, 121]);
          cx = t < 1.0 ? LERP(REST_X, TX, E(SEG(t, .1, 1.0))) : t < 5.1 ? TX : LERP(TX, REST_X, E(SEG(t, 5.1, 5.85)));
          w = (t > .1 && t < 1.0) ? Math.min(1, (t - .1) / .2, (1.0 - t) / .2) : (t > 5.1 && t < 5.85) ? Math.min(1, (t - 5.1) / .2, (5.85 - t) / .2) : 0;
          face = t < 1.6 ? -90 : t < 1.9 ? -90 * (1 - E(SEG(t, 1.6, 1.9))) : t < 4.0 ? 0 : t < 4.3 ? -90 * E(SEG(t, 4.0, 4.3)) : t < 5.0 ? -90 : t < 5.9 ? 90 : 90 * (1 - E(SEG(t, 5.8, 6.0)));
          var mh = SIDE(-1, FKF), s1 = Math.sin(Math.PI * SEG(t, 2.0, 2.7)), s2 = Math.sin(Math.PI * SEG(t, 3.0, 3.7)), sp = Math.max(s1, s2);
          pose[mh] = t < 1.0 ? REST : t < 1.4 ? GO(REST, AT(MG), SEG(t, 1.0, 1.4), 2) : t < 1.9 ? GO(AT(MG), UPM, SEG(t, 1.4, 1.9)) : t < 4.0 ? GO(UPM, MOUTH, sp) : t < 4.4 ? GO(UPM, AT(MG), SEG(t, 4.0, 4.4), 2) : t < 4.8 ? GO(AT(MG), REST, SEG(t, 4.4, 4.8)) : REST;
          mug = t > 1.35 && t < 4.4 ? 'hand' : 'shelf'; sip = sp > .5 ? 1 : 0;
        } else if (t < 2.0) { cx = LERP(-70, SHELF[0], SEG(t, 0, 2.0)); w = Math.min(1, t / .2, (2.0 - t) / .2); bk = 'shelf'; }
        else if (t < 3.2) {   /* take a book from the shelf */
          cx = SHELF[0]; face = t < 2.3 ? 90 - 90 * E(SEG(t, 2.0, 2.3)) : t < 2.9 ? 0 : 90 * E(SEG(t, 2.9, 3.2));
          var BT = [SHELF[0] - 4, SHELF[1] - 8], fh = SIDE(1, face);
          pose[fh] = t < 2.3 ? REST : t < 2.6 ? GO(REST, AT(BT), SEG(t, 2.3, 2.6), 3) : t < 3.0 ? GO(AT(BT), REST, SEG(t, 2.6, 3.0)) : REST;
          bk = t < 2.6 ? 'shelf' : 'hand';
        } else if (t < 4.4) { cx = LERP(SHELF[0], CHAIR, E(SEG(t, 3.2, 4.4))); w = Math.min(1, (t - 3.2) / .2, (4.4 - t) / .2); bk = 'hand'; }
        else {   /* turn, sit, read; up again and the book stays on the arm of the chair */
          cx = CHAIR; face = t < 4.7 ? 90 - 90 * E(SEG(t, 4.4, 4.7)) : 0;
          sitF = t < 4.7 ? 0 : t < 5.3 ? E(SEG(t, 4.7, 5.3)) : t < 7.8 ? 1 : t < 8.4 ? 1 - E(SEG(t, 7.8, 8.4)) : 0;
          if (sitF > 0) { pose.legNear = { m: sitF, th: 1.5, kn: 1.5 }; pose.legFar = { m: sitF, th: 1.5, kn: 1.5 }; lift = -30 * sitF; }
          var RD = { m: 1, b: [114, 26] }, rd = t < 5.0 ? 0 : t < 5.5 ? E(SEG(t, 5.0, 5.5)) : t < 7.4 ? 1 : t < 7.8 ? 1 - E(SEG(t, 7.4, 7.8)) : 0;
          if (rd > 0) { pose.near = { m: rd, b: [114, 26] }; pose.far = { m: rd, b: [114, 26] }; }
          bk = t < 7.8 ? 'hand' : 'chair'; if (t >= 7.8) st.bookChair = 1; page = t > 6.2 && t < 6.7 ? SEG(t, 6.2, 6.7) : 0;
          if (t > 8.4) { cx = LERP(CHAIR, REST_X, E(SEG(t, 8.5, 9.5))); face = t < 8.5 ? -90 * E(SEG(t, 8.4, 8.5)) : t < 9.5 ? -90 : -90 * (1 - E(SEG(t, 9.5, 9.8))); w = (t > 8.5 && t < 9.5) ? Math.min(1, (t - 8.5) / .2, (9.5 - t) / .2) : 0; }   /* back to his spot */
        }
        /* where he faces through each action: eased between these moments, from the front and back to it (no snaps) */
        if (st.pact && FKEYS[st.pact]) { var fk = FKEYS[st.pact], fi = 0; while (fi < fk.length - 1 && t > fk[fi + 1][0]) fi++; face = fi >= fk.length - 1 ? fk[fk.length - 1][1] : LERP(fk[fi][1], fk[fi + 1][1], E(SEG(t, fk[fi][0], fk[fi + 1][0]))); }
        /* the books on the shelf (one gap once he has taken it) */
        BOOKS.forEach(function (c, i) { if (i === 3 && bk !== 'shelf') return; var bx = SHELF[0] - 32 + i * 7, h = 16 + (i * 5 % 7); add(g, 'rect', { x: bx, y: SHELF[1] - h, width: 6, height: h, rx: .8, fill: c }); });
        function mugAt(par, x, y) { add(par, 'rect', { x: (x - 3.5).toFixed(1), y: (y - 7).toFixed(1), width: 7, height: 7, rx: 1.4, fill: '#d6453f' }); add(par, 'path', { d: 'M' + (x + 3.5).toFixed(1) + ' ' + (y - 5.5).toFixed(1) + ' q3 0 3 2.5 q0 2.5 -3 2.5', fill: 'none', stroke: '#d6453f', 'stroke-width': 1.1 }); }
        if (mug === 'shelf') mugAt(g, SILL[0], SILL[1]);
        /* the armchair */
        add(g, 'rect', { x: CHAIR - 26, y: 140, width: 52, height: 38, rx: 10, fill: '#5a6f8f' });
        add(g, 'rect', { x: CHAIR - 30, y: 164, width: 60, height: 22, rx: 7, fill: '#404e64' });
        add(g, 'rect', { x: CHAIR - 34, y: 156, width: 12, height: 28, rx: 5, fill: '#5a6f8f' }); add(g, 'rect', { x: CHAIR + 22, y: 156, width: 12, height: 28, rx: 5, fill: '#5a6f8f' });
        add(g, 'rect', { x: CHAIR - 26, y: 186, width: 3, height: 12, fill: '#3a2a20' }); add(g, 'rect', { x: CHAIR + 23, y: 186, width: 3, height: 12, fill: '#3a2a20' });
        if (bk === 'chair') book(g, CHAIR + 28, 157, .8, false);
        /* the phone in the basket; stars when it's a phone-free evening */
        if (inBasket) add(g, 'rect', { x: BASKET[0] - 3, y: BASKET[1] - 15, width: 6, height: 9, rx: 1.2, fill: '#1d2128' });
        if (stars > 0) [[50, 58], [62, 74], [98, 80]].forEach(function (p, i) { STAR(g, p[0], p[1], 2.2 * stars, '#f3da8e', (.5 + .4 * Math.sin(now / 500 + i)) * stars); });
        /* the breathing ring */
        if (ring > 0) add(g, 'circle', { cx: MAT, cy: 140, r: (14 + 26 * ring).toFixed(1), fill: 'none', stroke: '#b7a6e4', 'stroke-width': 1.4, opacity: (.25 + .45 * ring).toFixed(2) });
        pose.lift = lift; var ph = LIFE(st, pose, w);
        FIG(g, { cx: cx, gy: 200, face: face, ph: ph, w: w, pose: pose, items: function (H) {
          var out = [];
          if (bk === 'hand' && sitF > .5 && H.near && H.far) { var bg2 = el('g', {}); book(bg2, (H.near.X + H.far.X) / 2, (H.near.Y + H.far.Y) / 2 + 2, 1.1, true); if (page > 0) add(bg2, 'path', { d: 'M' + ((H.near.X + H.far.X) / 2) + ' ' + ((H.near.Y + H.far.Y) / 2 + 2) + ' q' + (8 - 16 * page) + ' -6 0 -10', fill: '#f4f1ea', stroke: '#cdd3d9', 'stroke-width': .4 }); out.push([9, bg2]); }
          else if (bk === 'hand' && H.s1) { var bg3 = el('g', {}); book(bg3, H.s1.X, H.s1.Y + 4, .8, false); out.push([9, bg3]); }
          if (mug === 'hand' && H.sm) { var mg2 = el('g', {}); mugAt(mg2, H.sm.X, H.sm.Y + 4); if (!sip) for (var sq = 0; sq < 2; sq++) add(mg2, 'path', { d: 'M' + (H.sm.X - 1 + sq * 2.5).toFixed(1) + ' ' + (H.sm.Y - 4).toFixed(1) + ' q-2 -3 0 -6 q2 -3 0 -6', fill: 'none', stroke: '#cdd3d9', 'stroke-width': .7, opacity: (.3 + .2 * Math.sin(now / 300 + sq)).toFixed(2) }); out.push([9, mg2]); }
          if ((ph1 === 'look' || ph1 === 'hand') && H.sm) { var pg = el('g', {}); add(pg, 'rect', { x: H.sm.X - 3, y: H.sm.Y - 8, width: 6, height: 10, rx: 1.2, fill: '#1d2128' }); if (ph1 === 'look') add(pg, 'rect', { x: H.sm.X - 2.2, y: H.sm.Y - 7, width: 4.4, height: 7.6, rx: .8, fill: '#8ab2e2' }); out.push([9, pg]); }
          return out; } });
      } });
  };
})();
