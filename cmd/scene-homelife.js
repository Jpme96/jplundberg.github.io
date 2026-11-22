/* The Family picture in 2.5D (2026-11-22 – JP saw the preview and said "You can do them"):
   a living room on a party day – bunting from two nails, family photos on the wall, the sofa, the dog in its bed.
   FAMILY: he comes in, lights the candles on the cake and cheers.
   Actions: pet (over to the dog, a pat, the tail goes – only with a pet in Pets, and that pet's kind), frame (a crooked photo
   put straight), sofa (a sit on the sofa, a look round, up again).
   Built on scene25.js (the runner, helpers, your look) and Fig25 (the body, the pet). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.homelife = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, SEG = S.SEG, LERP = S.LERP, AT = S.AT, B = S.B, GO = S.GO, HOLD = S.HOLD, SIDE = S.SIDE, REST = S.REST, grp = S.grp, FLOOR = S.FLOOR, CHEER = S.CHEER;
    data = data || {};
    var FKEYS = { pet: [[0, 0], [.3, -90], [4.6, -90], [4.85, 90], [5.9, 90], [6.2, 0]], frame: [[0, 0], [.2, -90], [1.6, -90], [2.0, 0], [4.0, 0], [4.2, 90], [5.15, 90], [5.4, 0]], sofa: [[0, 0], [.2, 90], [1.2, 90], [1.5, 0], [2.6, 0], [3.6, -25], [4.6, 0], [5.6, 0], [5.85, -90], [6.8, -90], [7.0, 0]] };
    var TABLE = 240, CAKE = [TABLE, 156], DOG = 62, REST_X = 206, FR = [[120, 100, 26, 20, '#3d85dc'], [152, 96, 20, 26, '#e895b7'], [184, 102, 28, 18, '#2f9d62']];
    function frame(g, f, rot) {
      var fg = add(g, 'g', { transform: 'rotate(' + (rot || 0).toFixed(1) + ' ' + f[0] + ' ' + (f[1] - f[3] / 2 - 4) + ')' });
      add(fg, 'line', { x1: f[0], y1: f[1] - f[3] / 2 - 4, x2: f[0] - f[2] / 3, y2: f[1] - f[3] / 2, stroke: '#8e97a1', 'stroke-width': .6 });
      add(fg, 'line', { x1: f[0], y1: f[1] - f[3] / 2 - 4, x2: f[0] + f[2] / 3, y2: f[1] - f[3] / 2, stroke: '#8e97a1', 'stroke-width': .6 });
      add(fg, 'rect', { x: f[0] - f[2] / 2, y: f[1] - f[3] / 2, width: f[2], height: f[3], rx: 1.5, fill: '#9a7258' });
      add(fg, 'rect', { x: f[0] - f[2] / 2 + 2.5, y: f[1] - f[3] / 2 + 2.5, width: f[2] - 5, height: f[3] - 5, fill: f[4], opacity: .55 });
      add(fg, 'circle', { cx: f[0] - 3, cy: f[1] + 1, r: 2.6, fill: '#f4f1ea', opacity: .8 }); add(fg, 'circle', { cx: f[0] + 3.5, cy: f[1] + 2, r: 2.2, fill: '#f4f1ea', opacity: .8 });
      add(g, 'circle', { cx: f[0], cy: f[1] - f[3] / 2 - 4, r: 1.1, fill: '#555c66' });   /* the nail */
    }
    function cake(g, lit, now) {
      var x = CAKE[0], y = CAKE[1];
      add(g, 'rect', { x: x - 15, y: y - 12, width: 30, height: 12, rx: 3, fill: '#f4f1ea' });
      add(g, 'path', { d: 'M' + (x - 15) + ' ' + (y - 8) + ' q5 4 10 0 t10 0 t10 0', fill: 'none', stroke: '#e895b7', 'stroke-width': 2 });
      add(g, 'rect', { x: x - 18, y: y - 1, width: 36, height: 2.4, rx: 1.2, fill: '#cdd3d9' });
      [-8, 0, 8].forEach(function (dx, i) {
        add(g, 'rect', { x: x + dx - 1, y: y - 20, width: 2, height: 8, fill: ['#3d85dc', '#f2c94c', '#2f9d62'][i] });
        if (lit > 0) { var fl = 1 + .15 * Math.sin(now / 90 + i * 2); add(g, 'ellipse', { cx: x + dx, cy: y - 23, rx: 1.8 * lit, ry: 3.2 * lit * fl, fill: '#ffd56b' }); add(g, 'circle', { cx: x + dx, cy: y - 23, r: 6 * lit, fill: '#ffe2a8', opacity: .18 }); }
      });
    }
    return S.run(svg, {
      back: function (g) {   /* the still scenery: drawn once */
        add(g, 'circle', { cx: 46, cy: 22, r: 1.4, fill: '#555c66' }); add(g, 'circle', { cx: 354, cy: 22, r: 1.4, fill: '#555c66' });
        add(g, 'path', { d: 'M46 22 Q200 50 354 22', fill: 'none', stroke: '#cdd3d9', 'stroke-width': .8 });
        var cols = ['#d6453f', '#f2c94c', '#3d85dc', '#2f9d62', '#e895b7', '#e57a3c'];
        for (var i = 0; i < 13; i++) { var u = (i + .5) / 13, x = 46 + 308 * u, y = 22 + 4 * 14 * u * (1 - u); add(g, 'path', { d: 'M' + (x - 7) + ' ' + y + ' L' + (x + 7) + ' ' + (y + 1) + ' L' + x + ' ' + (y + 13) + ' Z', fill: cols[i % 6] }); }
        frame(g, FR[0], 0); frame(g, FR[2], 0);
        /* the sofa */
        add(g, 'rect', { x: 286, y: 132, width: 100, height: 40, rx: 10, fill: '#3a8a78' });
        add(g, 'rect', { x: 280, y: 158, width: 112, height: 30, rx: 8, fill: '#2e5e56' });
        add(g, 'rect', { x: 294, y: 150, width: 42, height: 14, rx: 6, fill: '#88b5a8' }); add(g, 'rect', { x: 338, y: 150, width: 42, height: 14, rx: 6, fill: '#88b5a8' });
        add(g, 'rect', { x: 286, y: 188, width: 4, height: 10, fill: '#3a2a20' }); add(g, 'rect', { x: 382, y: 188, width: 4, height: 10, fill: '#3a2a20' });
        add(g, 'rect', { x: 352, y: 140, width: 18, height: 14, rx: 4, fill: '#f2c94c', transform: 'rotate(-12 361 147)' });   /* a cushion */
        FLOOR(g);
        /* the pet's bed (only when there is a pet) */
        
        /* the side table */
        add(g, 'rect', { x: TABLE - 24, y: 156, width: 48, height: 4, rx: 1.5, fill: '#9a7258' });
        add(g, 'rect', { x: TABLE - 20, y: 160, width: 3, height: 38, fill: '#7a5a44' }); add(g, 'rect', { x: TABLE + 17, y: 160, width: 3, height: 38, fill: '#7a5a44' });
      },
      acts: [{ id: 'pet', len: 6.2, w: function (d) { return d && d.pet ? 2 : 0; } }, { id: 'frame', len: 5.4, w: function () { return 1; } }, { id: 'sofa', len: 7.0, w: function () { return 1.2; } }],
      hits: [[30, 170, 70, 44, 'lp-pets', 'pet'], [280, 130, 112, 60, 'lp-moments', 'sofa'], [104, 82, 96, 34, 'lp-family', 'frame'], [214, 130, 52, 30, 'lp-parties']],
      season: { x: 270, y: 196, s: .8 }, len: 6.6, data: data, render: function (sv, t, st) {
        var now = st.now || 0, LIFE = S.LIFE;
        function FIG(par, o) { o.st = st; o.k = o.k || .5; return S.FIG(par, o); }
        var g = add(sv, 'g', {}), cx = -70, face = 90, w = 0, pose = {}, lift = 0, lit = st.lit ? 1 : 0, match = false, wag = 1, tilt = st.straight ? 0 : -9, hearts = 0, conf = 0;
        var FKF = face; if (st.pact && FKEYS[st.pact]) { var fk0 = FKEYS[st.pact], fj = 0; while (fj < fk0.length - 1 && t > fk0[fj + 1][0]) fj++; FKF = fj >= fk0.length - 1 ? fk0[fk0.length - 1][1] : LERP(fk0[fj][1], fk0[fj + 1][1], E(SEG(t, fk0[fj][0], fk0[fj + 1][0]))); }   /* the hands pick their side from the same facing */
        if (st.pact === 'pet') {
          cx = LERP(REST_X, 100, E(SEG(t, .3, 1.4))); face = -90; w = (t > .3 && t < 1.4) ? Math.min(1, (t - .3) / .2, (1.4 - t) / .2) : (t > 4.8 && t < 5.9) ? Math.min(1, (t - 4.8) / .2, (5.9 - t) / .2) : 0;
          if (t > 4.8) cx = LERP(100, REST_X, E(SEG(t, 4.8, 5.9)));
          var HD = [DOG + 14, 182], nh = SIDE(-1, FKF), pat = t > 2.0 && t < 4.0 ? 3 * Math.abs(Math.sin((t - 2) * 6)) : 0;
          pose[nh] = t < 1.5 ? REST : t < 2.0 ? GO(REST, AT(HD), SEG(t, 1.5, 2.0), 3) : t < 4.0 ? HOLD(AT([HD[0], HD[1] - pat])) : t < 4.6 ? GO(AT(HD), REST, SEG(t, 4.0, 4.6)) : REST;
          pose.lean = .45 * E(SEG(t, 1.4, 2.0)) * (1 - E(SEG(t, 4.0, 4.6))); wag = t > 1.8 && t < 4.6 ? 3 : 1; hearts = t > 2.2 && t < 4.6 ? SEG(t, 2.2, 4.6) : 0;
          if (t > 5.9) face = -90 * (1 - E(SEG(t, 5.9, 6.2)));
        } else if (st.pact === 'frame') {
          cx = LERP(REST_X, 152, E(SEG(t, .2, 1.4))); face = t < 1.6 ? -90 : t < 2.0 ? -90 + 90 * E(SEG(t, 1.6, 2.0)) : t < 4.0 ? 0 : 0; w = (t > .2 && t < 1.4) ? Math.min(1, (t - .2) / .2, (1.4 - t) / .2) : (t > 4.2 && t < 5.2) ? Math.min(1, (t - 4.2) / .2, (5.2 - t) / .2) : 0;
          if (t > 4.2) { cx = LERP(152, REST_X, E(SEG(t, 4.2, 5.2))); face = 90 * E(SEG(t, 4.0, 4.3)) * (1 - E(SEG(t, 5.1, 5.4))); }
          var FT = [FR[1][0] + 9, FR[1][1] + 8], fh = SIDE(1, FKF);
          pose[fh] = t < 2.0 ? REST : t < 2.5 ? GO(REST, AT(FT), SEG(t, 2.0, 2.5), 2) : t < 3.4 ? HOLD(AT(FT)) : t < 3.9 ? GO(AT(FT), REST, SEG(t, 3.4, 3.9)) : REST;
          tilt = t < 2.6 ? -9 : t < 3.3 ? -9 * (1 - E(SEG(t, 2.6, 3.3))) : 0; if (t >= 3.3) st.straight = 1;
        } else if (st.pact === 'sofa') {   /* over to the sofa, sit, lean back and look round, up again */
          var SX = 316; cx = t < 1.2 ? LERP(REST_X, SX, E(SEG(t, .2, 1.2))) : t < 5.8 ? SX : LERP(SX, REST_X, E(SEG(t, 5.9, 6.8)));
          w = (t > .2 && t < 1.2) ? Math.min(1, (t - .2) / .2, (1.2 - t) / .2) : (t > 5.9 && t < 6.8) ? Math.min(1, (t - 5.9) / .2, (6.8 - t) / .2) : 0;
          face = t < 1.2 ? 90 : t < 1.5 ? 90 * (1 - E(SEG(t, 1.2, 1.5))) : t < 5.6 ? (t > 2.6 && t < 4.6 ? -25 * Math.sin(Math.PI * SEG(t, 2.6, 4.6)) : 0) : t < 5.9 ? -90 * E(SEG(t, 5.6, 5.9)) : t < 6.8 ? -90 : -90 * (1 - E(SEG(t, 6.8, 7.0)));
          var sf = t < 1.5 ? 0 : t < 2.1 ? E(SEG(t, 1.5, 2.1)) : t < 5.0 ? 1 : t < 5.6 ? 1 - E(SEG(t, 5.0, 5.6)) : 0;
          if (sf > 0) { pose.legNear = { m: sf, th: 1.5, kn: 1.5 }; pose.legFar = { m: sf, th: 1.5, kn: 1.5 }; [-1, 1].forEach(function (sd) { pose[SIDE(sd, FKF)] = { m: sf, b: [134, 22] }; }); lift = -30 * sf; }
        } else if (t < 2.4) { cx = LERP(-70, REST_X, SEG(t, 0, 2.4)); w = Math.min(1, t / .2, (2.4 - t) / .2); }
        else {
          cx = REST_X; var LT = [CAKE[0] - 6, CAKE[1] - 22], nh2 = SIDE(-1, 90);
          pose[nh2] = t < 2.6 ? REST : t < 3.1 ? GO(REST, AT(LT), SEG(t, 2.6, 3.1), 3) : t < 4.0 ? HOLD(AT([LT[0] + 8 * SEG(t, 3.1, 4.0), LT[1]])) : t < 4.4 ? GO(AT([LT[0] + 8, LT[1]]), REST, SEG(t, 4.0, 4.4)) : REST;
          pose.lean = .2 * E(SEG(t, 2.6, 3.1)) * (1 - E(SEG(t, 4.0, 4.4))); match = t > 2.9 && t < 4.1; lit = Math.max(lit, E(SEG(t, 3.2, 3.8))); if (t > 3.8) st.lit = 1;
          if (t > 4.4) face = 90 * (1 - E(SEG(t, 4.4, 4.8)));
          if (t > 4.8) { face = 0; var ch = CHEER(t, 4.8, 1.4); lift = ch.lift; if (ch.on) { pose.near = { m: ch.on, s: 2.6, f: 3.0 }; pose.far = { m: ch.on, s: 2.6, f: 3.0 }; } conf = SEG(t, 4.8, 6.4); }
        }
        /* where he faces through each action: eased between these moments, from the front and back to it (no snaps) */
        if (st.pact && FKEYS[st.pact]) { var fk = FKEYS[st.pact], fi = 0; while (fi < fk.length - 1 && t > fk[fi + 1][0]) fi++; face = fi >= fk.length - 1 ? fk[fk.length - 1][1] : LERP(fk[fi][1], fk[fi + 1][1], E(SEG(t, fk[fi][0], fk[fi + 1][0]))); }
        frame(g, FR[1], tilt);
        cake(g, lit, now);
        /* confetti when the candles are lit */
        if (conf > 0 && conf < 1) for (var i = 0; i < 16; i++) { var a = i * 2.4, r = 18 + 70 * conf, x = CAKE[0] + Math.cos(a) * r, y = CAKE[1] - 40 + Math.sin(a) * r * .5 + 60 * conf * conf; add(g, 'rect', { x: x.toFixed(1), y: y.toFixed(1), width: 3, height: 2, fill: ['#d6453f', '#f2c94c', '#3d85dc', '#e895b7'][i % 4], opacity: (1 - conf).toFixed(2), transform: 'rotate(' + (a * 40 + now / 5) % 360 + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')' }); }
        /* the pet: in its bed a little in front of his path (drawn after him – he passes behind it), up when he comes over */
        if (hearts > 0) for (var h = 0; h < 3; h++) { var q = (hearts * 1.6 + h * .33) % 1, hx = DOG + 10 + h * 7, hy = 170 - 30 * q; add(g, 'path', { d: 'M' + hx + ' ' + hy + ' c-3 -3 -6 0 0 4 c6 -4 3 -7 0 -4 Z', fill: '#e895b7', opacity: (1 - q).toFixed(2) }); }
        pose.lift = lift; var ph = LIFE(st, pose, w);
        FIG(g, { cx: cx, gy: 200, face: face, ph: ph, w: w, pose: pose, items: function (H) {
          if (!match || !H.sm) return []; var mg = el('g', {}); add(mg, 'line', { x1: H.sm.X, y1: H.sm.Y, x2: H.sm.X + 7, y2: H.sm.Y - 4, stroke: '#d8c8a8', 'stroke-width': 1.2 }); add(mg, 'circle', { cx: H.sm.X + 8, cy: H.sm.Y - 5, r: 1.8, fill: '#ffd56b' }); return [[9, mg]]; } });   /* the match's flame */
        if (data.pet) { add(g, 'ellipse', { cx: DOG, cy: 209, rx: 30, ry: 7, fill: '#915534' }); add(g, 'ellipse', { cx: DOG, cy: 207, rx: 24, ry: 4.6, fill: '#ebac85' }); }
        var up = st.pact === 'pet' ? E(SEG(t, 1.0, 1.6)) * (1 - E(SEG(t, 4.6, 5.2))) : 0;
        if (data.pet) Fig25.pet(data.pet, (st.pact === 'pet' ? 30 : -20) * Math.PI / 180, DOG, 207, (data.pet === 'bird' ? 1.4 : 1.0) + .06 * up, now / 1000 * wag * 6, 0).forEach(function (pt) { g.appendChild(pt[1]); });
      } });
  };
})();
