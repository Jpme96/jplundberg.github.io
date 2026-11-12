/* The Habits picture in 2.5D (Phase F2) – ported from the preview JP picked ("Scenes in 2.5D"):
   HEALTH: dumbbells picked up from the floor, three curls, wiping the brow, arms up.
   Built on scene25.js (the runner, helpers, your look) and Fig25 (the body). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.habits = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, CL = S.CL, SEG = S.SEG, LERP = S.LERP, MIX = S.MIX, AT = S.AT, B = S.B, GO = S.GO, HOLD = S.HOLD, SIDE = S.SIDE, LEG = S.LEG,
      REST = S.REST, grp = S.grp, CLOCK = S.CLOCK, FLOOR = S.FLOOR, STAR = S.STAR, CHEER = S.CHEER;
    data = data || {};
    return S.run(svg, { hits: [[42, 40, 98, 62, 'training'], [150, 168, 96, 32, 'training'], [252, 166, 18, 34, 'ahealth'], [290, 108, 90, 92, 'training']], len: 9.6, data: data, render: function (sv, t, st) {
      var now = st.now || 0, LIFE = window.Scene25.LIFE;   /* (a scene may use S for its own things) */
      function FIG(par, o) { o.st = st; o.k = o.k || .5; if (o.look === 'iago') o.look = 'partner'; return window.Scene25.FIG(par, o); }
      var g = add(sv, 'g', {}), cx = 200, face = 35, pose = {}, cr = 0, held = false, lift = 0, cs = Math.cos(face * Math.PI / 180);
      function DB(sd) { return [cx + sd * 13 + 9, 193]; }
      /* the room: a streak chart on the wall, the rack with the barbell, the mat, a bottle */
      add(g, 'rect', { x: 46, y: 44, width: 92, height: 58, rx: 6, fill: 'rgba(255,255,255,.08)', stroke: 'rgba(255,255,255,.25)' });
      [14, 22, 18, 30, 26, 38, 44].forEach(function (v, i) { add(g, 'rect', { x: 56 + i * 11, y: 94 - v, width: 7, height: v, rx: 2, fill: i > 3 ? '#2fae6a' : 'rgba(255,255,255,.35)' }); });
      [312, 368].forEach(function (x) { add(g, 'rect', { x: x - 2, y: 116, width: 4, height: 84, fill: '#5b636c' }); });
      add(g, 'line', { x1: 296, y1: 126, x2: 384, y2: 126, stroke: '#9aa3ad', 'stroke-width': 3, 'stroke-linecap': 'round' });
      [300, 380].forEach(function (x) { add(g, 'rect', { x: x - 3, y: 114, width: 6, height: 24, rx: 2, fill: '#2a2d33' }); });
      FLOOR(g); add(g, 'ellipse', { cx: cx, cy: 199, rx: 52, ry: 7, fill: '#3a7d6b', opacity: .55 });
      add(g, 'rect', { x: 262, y: 180, width: 9, height: 19, rx: 3, fill: '#3987e5', opacity: .85 }); add(g, 'rect', { x: 263.5, y: 176, width: 6, height: 5, rx: 1.5, fill: '#e9eef2' });
      /* crouch, take both dumbbells, stand; three curls; put them down; wipe the brow; arms up */
      if (t < .7) cr = E(SEG(t, 0, .7)); else if (t < 1.3) cr = 1 - E(SEG(t, .7, 1.3)); else if (t >= 4.3 && t < 5.0) cr = E(SEG(t, 4.3, 5.0)); else if (t >= 5.0 && t < 5.6) cr = 1 - E(SEG(t, 5.0, 5.6));
      held = t >= .7 && t < 5.0;
      var gy = 200 + 24 * cr;
      [-1, 1].forEach(function (sd) {
        var k2 = SIDE(sd, face); pose[LEG(sd, face)] = { m: 1, at: [cx + sd * 10 * cs * .5, 198] };
        var DN = B(150, 10), cu = t >= 1.3 && t < 4.3 ? (1 - Math.cos(2 * Math.PI * (t - 1.3))) / 2 : 0;
        if (t < .7) pose[k2] = GO(REST, AT(DB(sd)), SEG(t, 0, .7), 2);
        else if (t < 1.3) pose[k2] = GO(AT(DB(sd)), DN, SEG(t, .7, 1.3));
        else if (t < 4.3) pose[k2] = HOLD(B(150 - 50 * cu, 10 + 16 * cu));
        else if (t < 5.0) pose[k2] = GO(DN, AT(DB(sd)), SEG(t, 4.3, 5.0));
        else if (t < 5.6) pose[k2] = GO(AT(DB(sd)), REST, SEG(t, 5.0, 5.6));
        else if (t >= 6.9 && t < 8.7) { var U = B(38, 6); pose[k2] = t < 7.3 ? GO(REST, U, SEG(t, 6.9, 7.3)) : t < 8.3 ? HOLD(U) : GO(U, REST, SEG(t, 8.3, 8.7)); }
      });
      if (t >= 5.6 && t < 6.9) { var nr = SIDE(-1, face), BR = B(46, 24 - 12 * Math.sin(Math.PI * SEG(t, 6.0, 6.5))); pose[nr] = t < 6.0 ? GO(REST, B(46, 24), SEG(t, 5.6, 6.0)) : t < 6.5 ? HOLD(BR) : GO(B(46, 24), REST, SEG(t, 6.5, 6.9)); }
      if (t >= 7.3 && t < 8.3) lift = CHEER(t, 7.3, 1.0).lift;
      pose.lean = .6 * cr; pose.lift = lift; LIFE(st, pose, 0);
      function dumb(x, y) { var d = grp(x, y, 0); add(d, 'line', { x1: -7, y1: 0, x2: 7, y2: 0, stroke: '#8f9ba5', 'stroke-width': 2.2 }); [-1, 1].forEach(function (s) { add(d, 'rect', { x: s * 7 - 2.5, y: -4.5, width: 5, height: 9, rx: 1.6, fill: '#2a2d33' }); }); return d; }
      if (!held) [-1, 1].forEach(function (sd) { var p = DB(sd); g.appendChild(dumb(p[0], p[1] + 2)); });
      FIG(g, { cx: cx, gy: gy, ground: 200, face: face, pose: pose, items: function (H) { return held ? [H.s1, H.sm].filter(Boolean).map(function (h) { return [h.z - .15, dumb(h.X, h.Y)]; }) : []; } });
      if (t >= 6.1 && t < 7.0) { var q = SEG(t, 6.1, 7.0); add(g, 'path', { d: 'M' + (cx + 10) + ' ' + (126 + q * 50) + ' q-2.5 4 0 5.5 q2.5 -1.5 0 -5.5', fill: '#9ad0e8', opacity: (1 - q).toFixed(2) }); }
    } });
  };
})();
