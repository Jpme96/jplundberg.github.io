/* The Papers picture in 2.5D (Phase F2) – ported from the preview JP picked ("Scenes in 2.5D"):
   PAPERS: open the drawer, the floating letter goes in, close it; water the plant.
   Built on scene25.js (the runner, helpers, your look) and Fig25 (the body). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.papers = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, CL = S.CL, SEG = S.SEG, LERP = S.LERP, MIX = S.MIX, AT = S.AT, B = S.B, GO = S.GO, HOLD = S.HOLD, SIDE = S.SIDE, LEG = S.LEG,
      REST = S.REST, grp = S.grp, CLOCK = S.CLOCK, FLOOR = S.FLOOR, STAR = S.STAR, CHEER = S.CHEER;
    data = data || {};
    return S.run(svg, {
      /* the page's own actions (F3): dusting the cabinet, and a folder out of the drawer to read (a frown), back in */
      acts: [{ id: 'dust', len: 7.8, w: function () { return 1.5; } }, { id: 'folder', len: 9.4, w: function () { return 2; } }],
      hits: [[106, 100, 74, 100, 'papers'], [226, 44, 52, 40, 'papers']], len: 11.6, data: data, render: function (sv, t, st) {
      var now = st.now || 0, LIFE = window.Scene25.LIFE;   /* (a scene may use S for its own things) */
      function FIG(par, o) { o.st = st; o.k = o.k || .5; if (o.look === 'iago') o.look = 'partner'; return window.Scene25.FIG(par, o); }
      var g = add(sv, 'g', {}), cx = 205, face = -90, w = 0, pose = {}, p = 0, lean = 0, tilt = 0, canIn = false, grow = 0, water = 0;
      var L0 = [140, 86 + 3 * Math.sin(now / 600)], LT = [192, 118], OVER = [197, 115], CAN0 = [325, 147], POUR2 = [338, 138];
      function HD(pp) { return [178 + pp, 131]; }
      /* the room: a framed certificate, the floor */
      add(g, 'rect', { x: 230, y: 50, width: 44, height: 34, rx: 3, fill: '#f4f1ea', stroke: '#c9b48e', 'stroke-width': 3 }); [60, 66, 72].forEach(function (y) { add(g, 'line', { x1: 238, y1: y, x2: 266, y2: y, stroke: '#b9b2a2', 'stroke-width': 1.4 }); });
      FLOOR(g);
      var cloth = false, folderIn = false, expr = null, puffs = 0;
      function walkTo(a, b, t0, t1) { var f = SEG(t, t0, t1); cx = LERP(a, b, f); face = b > a ? 90 : -90; w = Math.min(1, (t - t0) / .2, (t1 - t) / .2); }
      if (st.pact) {
        var T1 = st.pact === 'dust' ? 6.4 : 8.0;   /* when he heads back */
        if (t < .3) { cx = 272; face = -90 * E(SEG(t, 0, .3)); } else if (t < 1.3) walkTo(272, 205, .3, 1.3); else if (t < T1) { cx = 205; face = -90; }
        else if (t < T1 + .3) { cx = 205; face = -90 + 180 * E(SEG(t, T1, T1 + .3)); } else if (t < T1 + 1.0) walkTo(205, 272, T1 + .3, T1 + 1.0); else { cx = 272; face = 90 * (1 - E(SEG(t, T1 + 1.0, T1 + 1.4))); }
        var nr2 = SIDE(1, -90), fr2 = SIDE(-1, -90);
        if (st.pact === 'dust') {   /* a cloth over the top and down the side, a puff of dust */
          var WIPE = function (u) { return u < .5 ? [LERP(126, 170, (1 - Math.cos(u * 2 * Math.PI * 3)) / 2), 108] : [172, LERP(116, 180, (1 - Math.cos((u - .5) * 2 * Math.PI * 2)) / 2)]; };
          pose[nr2] = t < 1.3 ? REST : t < 1.7 ? GO(REST, AT(WIPE(0)), SEG(t, 1.3, 1.7), 2) : t < 5.7 ? HOLD(AT(WIPE(SEG(t, 1.7, 5.7)))) : t < 6.2 ? GO(AT(WIPE(1)), REST, SEG(t, 5.7, 6.2)) : REST;
          cloth = t >= 1.5 && t < 6.0; lean = .2 * Math.sin(Math.PI * SEG(t, 1.3, 6.2)); puffs = t > 1.8 && t < 5.8 ? 1 : 0;
        } else {   /* the drawer out, a folder up to read – a frown – back in, drawer shut */
          p = t < 1.7 ? 0 : t < 2.3 ? 34 * E(SEG(t, 1.7, 2.3)) : t < 6.6 ? 34 : t < 7.3 ? 34 * (1 - E(SEG(t, 6.6, 7.3))) : 0;
          pose[nr2] = t < 1.7 ? (t < 1.3 ? REST : GO(REST, AT(HD(0)), SEG(t, 1.3, 1.7), 2)) : t < 2.3 ? HOLD(AT(HD(p))) : t < 2.6 ? GO(AT(HD(34)), REST, SEG(t, 2.3, 2.6)) : t < 6.3 ? REST : t < 6.6 ? GO(REST, AT(HD(34)), SEG(t, 6.3, 6.6), 2) : t < 7.3 ? HOLD(AT(HD(p))) : t < 7.7 ? GO(AT(HD(0)), REST, SEG(t, 7.3, 7.7)) : REST;
          var F0 = [196, 116], RD = B(68, 36);
          pose[fr2] = t < 2.4 ? REST : t < 2.8 ? GO(REST, AT(F0), SEG(t, 2.4, 2.8), 2) : t < 3.3 ? GO(AT(F0), RD, SEG(t, 2.8, 3.3), 3) : t < 5.4 ? HOLD(RD) : t < 5.9 ? GO(RD, AT(F0), SEG(t, 5.4, 5.9), 3) : t < 6.3 ? GO(AT(F0), REST, SEG(t, 5.9, 6.3)) : REST;
          folderIn = t >= 2.8 && t < 5.9; expr = t > 3.6 && t < 5.4 ? 'calm' : null; lean = .15 * Math.sin(Math.PI * SEG(t, 1.3, 7.7));
        }
      } else {
      if (t < .4) cx = 205; else if (t < 1.2) { cx = LERP(205, 230, E(SEG(t, .4, 1.2))); w = .35; } else if (t < 3.7) cx = 230; else if (t < 4.4) { cx = LERP(230, 205, E(SEG(t, 3.7, 4.4))); w = .35; } else cx = 205;
      p = t < .4 ? 0 : t < 1.2 ? 34 * E(SEG(t, .4, 1.2)) : t < 3.7 ? 34 : 34 * (1 - E(SEG(t, 3.7, 4.4)));
      if (t < 4.8) {
        var nr = SIDE(1, -90), fr = SIDE(-1, -90);
        /* his right hand works the drawer */
        if (t < .4) pose[nr] = GO(REST, AT(HD(0)), SEG(t, 0, .4), 2); else if (t < 1.2) pose[nr] = HOLD(AT(HD(p))); else if (t < 1.6) pose[nr] = GO(AT(HD(34)), REST, SEG(t, 1.2, 1.6));
        else if (t >= 3.3 && t < 3.7) pose[nr] = GO(REST, AT(HD(34)), SEG(t, 3.3, 3.7), 2); else if (t >= 3.7 && t < 4.4) pose[nr] = HOLD(AT(HD(p))); else if (t >= 4.4) pose[nr] = GO(AT(HD(0)), REST, SEG(t, 4.4, 4.8));
        /* his left hand takes the letter as it floats down and drops it in */
        if (t >= 1.8 && t < 2.2) pose[fr] = GO(REST, AT(LT), SEG(t, 1.8, 2.2), 2); else if (t >= 2.2 && t < 2.8) pose[fr] = GO(AT(LT), AT(OVER), SEG(t, 2.2, 2.8), 4); else if (t >= 2.8 && t < 3.2) pose[fr] = GO(AT(OVER), REST, SEG(t, 2.8, 3.2));
        lean = .2 * E(SEG(t, 0, .4)) * (1 - E(SEG(t, 4.4, 4.8)));
      } else if (t < 5.2) face = -90 + 180 * E(SEG(t, 4.8, 5.2));
      else if (t < 6.4) { face = 90; cx = LERP(205, 300, SEG(t, 5.2, 6.4)); w = Math.min(1, (t - 5.2) / .2, (6.4 - t) / .2); }
      else if (t < 9.8) {
        face = 90; var nh = SIDE(-1, 90); cx = t < 6.8 ? 300 : t < 7.2 ? LERP(300, 308, E(SEG(t, 6.8, 7.2))) : t < 8.8 ? 308 : t < 9.4 ? LERP(308, 300, E(SEG(t, 8.8, 9.4))) : 300;
        if (t >= 6.8 && t < 7.2 || t >= 8.8 && t < 9.4) w = .3;
        pose[nh] = t < 6.8 ? GO(REST, AT(CAN0), SEG(t, 6.4, 6.8), 2) : t < 7.2 ? GO(AT(CAN0), AT(POUR2), SEG(t, 6.8, 7.2), 3) : t < 8.8 ? HOLD(AT(POUR2)) : t < 9.4 ? GO(AT(POUR2), AT(CAN0), SEG(t, 8.8, 9.4), 3) : GO(AT(CAN0), REST, SEG(t, 9.4, 9.8));
        canIn = t >= 6.8 && t < 9.4; tilt = t < 7.2 ? 0 : t < 7.6 ? 42 * E(SEG(t, 7.2, 7.6)) : t < 8.4 ? 42 : t < 8.8 ? 42 * (1 - E(SEG(t, 8.4, 8.8))) : 0;
        water = t > 7.5 && t < 8.6 ? 1 : 0; lean = .3 * E(SEG(t, 6.4, 6.8)) * (1 - E(SEG(t, 9.4, 9.8)));
      } else if (t < 10.2) { cx = LERP(300, 272, E(SEG(t, 9.8, 10.2))); w = .3; face = 90 - 90 * E(SEG(t, 9.8, 10.2)); }   /* steps back from the stool as he turns, so nothing stands in him */
      else { cx = 272; face = 0; var nw = SIDE(-1, 0), WV = B(44, 10); pose[nw] = t < 10.5 ? GO(REST, WV, SEG(t, 10.2, 10.5)) : t < 11.2 ? HOLD(B(44, 10 + 9 * Math.sin((t - 10.5) * 16))) : GO(WV, REST, SEG(t, 11.2, 11.6)); }
      }
      grow = st.pact ? 1 : t < 7.9 ? 0 : E(SEG(t, 7.9, 8.9)); if (!st.playing && t >= 11.6) grow = 1;
      pose.lean = lean; var ph = LIFE(st, pose, w);
      /* the cabinet, seen from the side: its front faces you on the right */
      add(g, 'rect', { x: 110, y: 112, width: 58, height: 88, fill: '#7d8894' });
      add(g, 'path', { d: 'M110 112 L168 112 L176 108 L118 108 Z', fill: '#a3adb7' });
      add(g, 'path', { d: 'M168 112 L176 108 L176 197 L168 200 Z', fill: '#c3ccd5' });
      [140, 170].forEach(function (y) { add(g, 'line', { x1: 168, y1: y, x2: 176, y2: y - 3, stroke: '#8f9ba5', 'stroke-width': 1 }); });
      [154, 184].forEach(function (y) { add(g, 'rect', { x: 171, y: y - 3, width: 3, height: 6, rx: 1.2, fill: '#5b636c' }); });
      /* the top drawer: it slides out toward him; you see the folders in it */
      add(g, 'rect', { x: 168, y: 114, width: 8 + p, height: 24, fill: '#b5bec8' });
      if (p > 2) { add(g, 'rect', { x: 170, y: 113, width: 4 + p, height: 4, fill: '#3a3f4a' }); ['#e8743b', '#3987e5', '#f2c94c', '#2fae6a'].forEach(function (c2, i) { var fx = 172 + i * 7; if (fx < 170 + p) add(g, 'rect', { x: fx, y: 109, width: 5, height: 5, rx: 1, fill: c2 }); }); }
      add(g, 'rect', { x: 172 + p, y: 112, width: 6, height: 27, rx: 1, fill: '#d5dde4' }); add(g, 'rect', { x: 176 + p, y: 128, width: 3, height: 7, rx: 1.2, fill: '#5b636c' });
      /* the plant and the stool with the watering can */
      add(g, 'rect', { x: 312, y: 162, width: 26, height: 4, rx: 1.5, fill: '#a87652' }); [315, 335].forEach(function (x) { add(g, 'rect', { x: x - 1.5, y: 166, width: 3, height: 34, fill: '#8a5e44' }); });
      var lg = grp(364, 182, 0, 1 + .14 * grow); g.appendChild(lg);
      [[-10, -14, -40], [9, -16, 35], [-2, -26, -6], [-14, -6, -70], [13, -6, 70]].forEach(function (lf) { add(lg, 'ellipse', { cx: lf[0], cy: lf[1], rx: 4.6, ry: 10, fill: '#2f8a52', transform: 'rotate(' + lf[2] + ' ' + lf[0] + ' ' + lf[1] + ')' }); });
      if (grow > 0) { add(lg, 'ellipse', { cx: 4, cy: -34, rx: 3.4 * grow, ry: 8 * grow, fill: '#47b06c', transform: 'rotate(20 4 -34)' }); add(lg, 'circle', { cx: -6, cy: -36, r: 3.2 * grow, fill: '#f2a3c4' }); }
      add(g, 'path', { d: 'M352 180 L376 180 L373 200 L355 200 Z', fill: '#c96a3c' });
      function can(x, y, deg) { var c = grp(x, y, deg); add(c, 'path', { d: 'M-6 6 Q0 -4 6 6', fill: 'none', stroke: '#2f6e52', 'stroke-width': 2 }); add(c, 'rect', { x: -8, y: 5, width: 16, height: 13, rx: 3, fill: '#3e8f6b' }); add(c, 'line', { x1: 7, y1: 12, x2: 18, y2: 3, stroke: '#3e8f6b', 'stroke-width': 2.6, 'stroke-linecap': 'round' }); add(c, 'circle', { cx: 18.5, cy: 2.5, r: 2, fill: '#2f6e52' }); return c; }
      if (!canIn) g.appendChild(can(CAN0[0], CAN0[1], 0));
      /* the letter: floating above the cabinet, then down to his hand, then into the drawer */
      var lp = null, la = 1, inH = t >= 2.2 && t < 2.8;
      if (t < 1.0 || t >= 11.55 && !st.playing && false) lp = L0; else if (t < 2.2) lp = MIX(L0, LT, E(SEG(t, 1.0, 2.2))); else if (t >= 2.8 && t < 3.15) { lp = [OVER[0], OVER[1] + 14 * SEG(t, 2.8, 3.15)]; la = 1 - SEG(t, 2.95, 3.15); }
      if (!st.playing && t >= 11.6 || st.pact) lp = null;
      function letter(x, y, op) { var l = grp(x, y, 4 * Math.sin(now / 500)); l.setAttribute('opacity', op.toFixed(2)); add(l, 'rect', { x: -8, y: -5.5, width: 16, height: 11, rx: 1.5, fill: '#f7f4ec' }); add(l, 'path', { d: 'M-8 -5 L0 1 L8 -5', fill: 'none', stroke: '#c9b48e', 'stroke-width': 1.2 }); add(l, 'circle', { cx: 0, cy: 1.5, r: 1.6, fill: '#d93a3a' }); return l; }
      if (lp && !inH) g.appendChild(letter(lp[0], lp[1], la));
      if (puffs) for (var pi = 0; pi < 3; pi++) { var q2 = ((now / 900) + pi / 3) % 1; add(g, 'circle', { cx: 150 + 20 * pi - 6 * q2, cy: 104 - 14 * q2, r: 2 + 3 * q2, fill: 'rgba(220,220,210,' + (.35 * (1 - q2)).toFixed(2) + ')' }); }
      function folder(x, y) { var f = grp(x, y, -8); add(f, 'rect', { x: -10, y: -8, width: 20, height: 15, rx: 1.5, fill: '#e8743b' }); add(f, 'rect', { x: -10, y: -10, width: 8, height: 3, rx: 1, fill: '#e8743b' }); add(f, 'rect', { x: -7, y: -5, width: 14, height: 2, fill: '#f4f1ea', opacity: .8 }); return f; }
      var H = FIG(g, { cx: cx, gy: 200, face: face, ph: ph, w: w, pose: pose, look: expr ? Object.assign({}, S.look(), { expr: expr }) : undefined, items: function (H2) { var out = [];
        var ch = H2[SIDE(1, -90)], fh = H2[SIDE(-1, -90)];
        if (cloth && ch) out.push([ch.z - .15, (function () { var c = grp(ch.X, ch.Y, 10); add(c, 'rect', { x: -5, y: -3, width: 10, height: 6, rx: 1.5, fill: '#f2c94c' }); return c; })()]);
        if (folderIn && fh) out.push([fh.z - .15, folder(fh.X, fh.Y - 6)]); if (inH && H2.sm) out.push([H2.sm.z - .15, letter(H2.sm.X, H2.sm.Y - 2, 1)]); if (canIn && H2.sm) out.push([H2.sm.z - .15, can(H2.sm.X, H2.sm.Y, tilt)]); return out; } });
      if (water && H.sm) { var r2 = tilt * Math.PI / 180, tx = H.sm.X + 18.5 * Math.cos(r2) - 2.5 * Math.sin(r2), ty = H.sm.Y + 18.5 * Math.sin(r2) + 2.5 * Math.cos(r2);
        for (var di = 0; di < 6; di++) { var q = ((now / 1000) * 2.2 + di / 6) % 1; add(g, 'ellipse', { cx: LERP(tx, 364, q) + 2 * Math.sin(di), cy: LERP(ty, 182, q * q), rx: 1.2, ry: 2, fill: '#9ad0e8', opacity: .9 }); } }
    } });
  };
})();
