/* The People picture in 2.5D (Phase F2) – ported from the preview JP picked ("Scenes in 2.5D"):
   PEOPLE: you walk over to your person; you both wave, a high five, then a happy hop.
   Built on scene25.js (the runner, helpers, your look) and Fig25 (the body). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.people = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, CL = S.CL, SEG = S.SEG, LERP = S.LERP, MIX = S.MIX, AT = S.AT, B = S.B, GO = S.GO, HOLD = S.HOLD, SIDE = S.SIDE, LEG = S.LEG,
      REST = S.REST, grp = S.grp, CLOCK = S.CLOCK, FLOOR = S.FLOOR, STAR = S.STAR, CHEER = S.CHEER;
    data = data || {};
    var HRp = new Date().getHours();
    return S.run(svg, {
      back: function (bg) { var g = bg;   /* the still scenery: drawn once (F4 – faster frames) */
      add(g, 'rect', { x: 0, y: 190, width: 400, height: 50, fill: '#2f5a3c' });
      add(g, 'rect', { x: 66, y: 120, width: 8, height: 74, fill: '#5a3a26' }); add(g, 'circle', { cx: 70, cy: 104, r: 30, fill: '#2f7a4a' }); add(g, 'circle', { cx: 50, cy: 118, r: 18, fill: '#2a6e43' }); add(g, 'circle', { cx: 92, cy: 116, r: 20, fill: '#2a6e43' });
      add(g, 'rect', { x: 334, y: 170, width: 52, height: 5, rx: 2, fill: '#a87652' }); add(g, 'rect', { x: 334, y: 158, width: 52, height: 4, rx: 2, fill: '#a87652' }); [338, 382].forEach(function (x) { add(g, 'rect', { x: x - 1.5, y: 175, width: 3, height: 20, fill: '#5b636c' }); });
      add(g, 'rect', { x: 166, y: 70, width: 3, height: 124, fill: '#5b636c' }); add(g, 'circle', { cx: 167.5, cy: 68, r: 6, fill: '#ffe2a8' }); add(g, 'circle', { cx: 167.5, cy: 68, r: 18, fill: 'rgba(255,226,168,.12)' });
      },
      /* the page's own actions (F3): a heart floats up between you, and – in the evening most – a sit on the bench together */
      acts: [{ id: 'heart', len: 4.6, w: function () { return 2; } }, { id: 'bench', len: 10.4, w: function () { return HRp >= 17 || HRp < 2 ? 3 : .8; } }],
      hits: [[300, 150, 90, 50, 'people', 'bench'], [20, 60, 90, 140, 'people']],   /* the bench: you sit on it together */
      season: { x: 122, y: 196, s: .95 }, len: 7.2, data: data, render: function (sv, t, st) {
      var now = st.now || 0, LIFE = window.Scene25.LIFE;   /* (a scene may use S for its own things) */
      function FIG(par, o) { o.st = st; o.k = o.k || .5; if (o.look === 'iago') o.look = 'partner'; return window.Scene25.FIG(par, o); }
      var g = add(sv, 'g', {}), me = { cx: 30, face: 90, w: 0, pose: {} }, pa = { cx: 283, face: 0, w: 0, pose: {} }, MID = [258, 116], spark = -1;
      /* a park at dusk: a tree, a bench, a lamp */
      var heart = -1;
      function walkP(P, a, b, t0, t1) { var f = SEG(t, t0, t1); P.cx = LERP(a, b, f); P.face = b > a ? 90 : -90; P.w = Math.min(1, (t - t0) / .2, (t1 - t) / .2); }
      function sitP(P, f, sd) { if (f <= 0) return; P.pose.legNear = { m: f, th: 1.5, kn: 1.5 }; P.pose.legFar = { m: f, th: 1.5, kn: 1.5 }; P.pose.lift = -20 * f; P.pose[SIDE(sd, P.face)] = { m: f, b: [134, 22] }; P.pose[SIDE(-sd, P.face)] = { m: f, b: [134, 22] }; }
      if (st.pact === 'heart') {   /* they turn to each other, a heart floats up between them, back to the front */
        me.cx = 232; pa.cx = 283; var tf = t < .5 ? E(SEG(t, 0, .5)) : t < 3.8 ? 1 : 1 - E(SEG(t, 3.8, 4.4));
        me.face = 90 * tf; pa.face = -90 * tf; heart = t > .6 && t < 3.6 ? SEG(t, .6, 3.6) : -1;
        me.pose.lean = pa.pose.lean = .08 * Math.sin(Math.PI * SEG(t, .6, 2.2));
      } else if (st.pact === 'bench') {   /* over to the bench, sit side by side a while, back again */
        if (t < .4) { me.cx = 232; pa.cx = 283; me.face = 90 * E(SEG(t, 0, .4)); pa.face = 90 * E(SEG(t, 0, .4)); }
        else if (t < 2.4) { walkP(me, 232, 348, .4, 2.4); walkP(pa, 283, 372, .4, 2.2); if (t >= 2.2) { pa.cx = 372; pa.w = 0; } }
        else if (t < 7.6) { me.cx = 348; pa.cx = 372; var sf = t < 2.8 ? E(SEG(t, 2.4, 2.8)) : t < 3.4 ? E(SEG(t, 2.8, 3.4)) : t < 7.0 ? 1 : 1 - E(SEG(t, 7.0, 7.6));
          me.face = pa.face = t < 2.8 ? 90 - 90 * E(SEG(t, 2.4, 2.8)) : t < 7.0 ? (t > 4 && t < 6.4 ? 18 * Math.sin((t - 4) * 1.3) : 0) : -90 * E(SEG(t, 7.0, 7.4));
          if (t >= 2.8) { sitP(me, sf, 1); sitP(pa, sf, -1); } }
        else if (t < 9.6) { walkP(me, 348, 232, 7.6, 9.6); walkP(pa, 372, 283, 7.8, 9.6); if (t < 7.8) { pa.cx = 372; pa.face = -90; pa.w = 0; } }
        else { me.cx = 232; pa.cx = 283; me.face = -90 * (1 - E(SEG(t, 9.6, 10.2))); pa.face = -90 * (1 - E(SEG(t, 9.6, 10.2))); }
      } else if (t < 2.2) { me.cx = LERP(30, 232, SEG(t, 0, 2.2)); me.w = Math.min(1, t / .2, (2.2 - t) / .2); } else me.cx = 232;
      if (!st.pact) {
      pa.face = t < 1.6 ? 0 : t < 2.0 ? -90 * E(SEG(t, 1.6, 2.0)) : t < 4.3 ? -90 : t < 4.7 ? -90 + 90 * E(SEG(t, 4.3, 4.7)) : 0;
      if (t >= 4.3 && t < 4.7) me.face = 90 - 90 * E(SEG(t, 4.3, 4.7)); else if (t >= 4.7) me.face = 0;
      [[me, -1, 90], [pa, 1, -90]].forEach(function (q) { var P = q[0], k2 = SIDE(q[1], q[2]), WV = B(44, 10);
        if (t >= 2.2 && t < 4.3) { P.pose[k2] = t < 2.5 ? GO(REST, WV, SEG(t, 2.2, 2.5)) : t < 3.4 ? HOLD(B(44, 10 + 9 * Math.sin((t - 2.5) * 16 + (q[1] > 0 ? 1 : 0)))) : t < 3.7 ? GO(WV, AT(MID), SEG(t, 3.4, 3.7), 2) : t < 3.9 ? HOLD(AT(MID)) : GO(AT(MID), REST, SEG(t, 3.9, 4.3));
          P.pose.lean = .22 * E(SEG(t, 3.4, 3.7)) * (1 - E(SEG(t, 3.9, 4.3))); } });
      if (t >= 3.7 && t < 4.2) spark = SEG(t, 3.7, 4.2);
      [[me, 4.7], [pa, 4.85]].forEach(function (q) { if (t >= q[1] && t < q[1] + 1.2) { var ch = CHEER(t, q[1], 1.2); q[0].pose.lift = ch.lift; if (ch.on) { q[0].pose.near = { m: ch.on, s: 2.6, f: 3.0 }; q[0].pose.far = { m: ch.on, s: 2.6, f: 3.0 }; } } });
      }
      if (!st.playing) { var fadeIn = st.endNow ? Math.min(1, (now - st.endNow) / 2000) : 1; pa.face = fadeIn * Math.sin(st.now / 3000 + 1) * 18 * Math.max(0, Math.sin(st.now / 7000)); me.face = fadeIn * Math.sin(st.now / 2800) * 18 * Math.max(0, Math.sin(st.now / 7700 + 2)); }
      var php = LIFE(st, pa.pose, pa.w, 'pa'), phm = LIFE(st, me.pose, me.w, 'me');
      FIG(g, { look: 'partner', cx: pa.cx, gy: 200, face: pa.face, ph: php, w: pa.w, pose: pa.pose });
      FIG(g, { look: 'me', cx: me.cx, gy: 200, face: me.face, ph: phm, w: me.w, pose: me.pose });
      if (heart >= 0) { var hy = 118 - 50 * heart, hs = 6 + 4 * Math.sin(Math.PI * Math.min(1, heart * 2)), hx = 257.5 + 4 * Math.sin(heart * 9); add(g, 'path', { d: 'M' + hx + ' ' + (hy + hs) + ' C' + (hx - hs * 1.6) + ' ' + (hy - hs * .2) + ' ' + (hx - hs * .6) + ' ' + (hy - hs * 1.3) + ' ' + hx + ' ' + (hy - hs * .4) + ' C' + (hx + hs * .6) + ' ' + (hy - hs * 1.3) + ' ' + (hx + hs * 1.6) + ' ' + (hy - hs * .2) + ' ' + hx + ' ' + (hy + hs) + ' Z', fill: '#e5484d', opacity: (1 - Math.pow(heart, 3)).toFixed(2) }); }
      if (spark >= 0) for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, r = 4 + 16 * spark; add(g, 'line', { x1: MID[0] + Math.cos(a) * r, y1: MID[1] - 4 + Math.sin(a) * r, x2: MID[0] + Math.cos(a) * (r + 5), y2: MID[1] - 4 + Math.sin(a) * (r + 5), stroke: '#f2c94c', 'stroke-width': 1.8, 'stroke-linecap': 'round', opacity: (1 - spark).toFixed(2) }); }
    } });
  };
})();
