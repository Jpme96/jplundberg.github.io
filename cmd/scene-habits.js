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
    return S.run(svg, {
      back: function (bg) { var g = bg;   /* the still scenery: drawn once (F4 – faster frames) */
      add(g, 'rect', { x: 46, y: 44, width: 92, height: 58, rx: 6, fill: 'rgba(255,255,255,.08)', stroke: 'rgba(255,255,255,.25)' });
      [14, 22, 18, 30, 26, 38, 44].forEach(function (v, i) { add(g, 'rect', { x: 56 + i * 11, y: 94 - v, width: 7, height: v, rx: 2, fill: i > 3 ? '#2fae6a' : 'rgba(255,255,255,.35)' }); });
      [312, 368].forEach(function (x) { add(g, 'rect', { x: x - 2, y: 116, width: 4, height: 84, fill: '#5b636c' }); });
      add(g, 'line', { x1: 296, y1: 126, x2: 384, y2: 126, stroke: '#9aa3ad', 'stroke-width': 3, 'stroke-linecap': 'round' });
      [300, 380].forEach(function (x) { add(g, 'rect', { x: x - 3, y: 114, width: 6, height: 24, rx: 2, fill: '#2a2d33' }); });
      FLOOR(g); add(g, 'ellipse', { cx: 200, cy: 199, rx: 52, ry: 7, fill: '#3a7d6b', opacity: .55 });
      },
      /* the page's own actions (F3): a drink from the bottle and a big sigh, jogging on the spot then a look at the watch, a stretch down to the toes */
      acts: [{ id: 'bottle', len: 8.2, w: function () { return 2; } }, { id: 'jog', len: 5.6, w: function () { return 1.5; } }, { id: 'toes', len: 5.2, w: function () { return 1.5; } }],
      hits: [[42, 40, 98, 62, 'training'], [150, 168, 96, 32, 'training', 'toes'], [252, 166, 18, 34, 'ahealth', 'bottle'], [290, 108, 90, 92, 'training', 'main']],   /* the mat: a toe stretch; the bottle: a drink; the rack: the curls */
      season: { x: 112, y: 194, s: .95 }, len: 9.6, data: data, render: function (sv, t, st) {
      var now = st.now || 0, LIFE = window.Scene25.LIFE;   /* (a scene may use S for its own things) */
      function FIG(par, o) { o.st = st; o.k = o.k || .5; if (o.look === 'iago') o.look = 'partner'; return window.Scene25.FIG(par, o); }
      var g = add(sv, 'g', {}), cx = 200, face = 35, pose = {}, cr = 0, held = false, lift = 0, cs = Math.cos(face * Math.PI / 180);
      function DB(sd) { return [200 + sd * 13 + 9, 193]; }   /* the dumbbells stay by the mat */
      /* the room: a streak chart on the wall, the rack with the barbell, the mat, a bottle */
      function bottle(x, y, deg) { var b = grp(x, y, deg || 0); add(b, 'rect', { x: -4.5, y: -9.5, width: 9, height: 19, rx: 3, fill: '#3987e5', opacity: .85 }); add(b, 'rect', { x: -3, y: -13.5, width: 6, height: 5, rx: 1.5, fill: '#e9eef2' }); return b; }
      var bIn = false, bTilt = 0, w = 0, expr = null, BOT = [266.5, 189.5];
      if (st.pact === 'bottle') {   /* over to the bottle, down for it, a long drink, a big sigh, put it back, back on the mat */
        var BX = 248, hd2;
        if (t < .4) face = 35 + 55 * E(SEG(t, 0, .4)); else if (t < 1.6) { face = 90; cx = LERP(200, BX, SEG(t, .4, 1.6)); w = Math.min(1, (t - .4) / .2, (1.6 - t) / .2); }
        else if (t < 6.2) { cx = BX; face = 90; }
        else if (t < 6.5) { cx = BX; face = 90 + 180 * E(SEG(t, 6.2, 6.5)); }
        else if (t < 7.7) { face = 270; cx = LERP(BX, 200, SEG(t, 6.5, 7.7)); w = Math.min(1, (t - 6.5) / .2, (7.7 - t) / .2); }
        else { cx = 200; face = 270 - 235 * E(SEG(t, 7.7, 8.2)); }
        hd2 = SIDE(-1, face);
        cr = t < 1.6 ? 0 : t < 2.2 ? E(SEG(t, 1.6, 2.2)) * .7 : t < 2.8 ? .7 * (1 - E(SEG(t, 2.2, 2.8))) : t < 5.0 ? 0 : t < 5.6 ? .7 * E(SEG(t, 5.0, 5.6)) : t < 6.2 ? .7 * (1 - E(SEG(t, 5.6, 6.2))) : 0;
        var MOU = B(66, 24), LOW = B(112, 26);
        if (t >= 1.6 && t < 6.2) pose[hd2] = t < 2.2 ? GO(REST, AT(BOT), SEG(t, 1.6, 2.2), 2) : t < 2.8 ? GO(AT(BOT), LOW, SEG(t, 2.2, 2.8)) : t < 3.3 ? GO(LOW, MOU, SEG(t, 2.8, 3.3), 2) : t < 4.3 ? HOLD(MOU) : t < 4.7 ? GO(MOU, LOW, SEG(t, 4.3, 4.7), 2) : t < 5.6 ? GO(LOW, AT(BOT), SEG(t, 4.7, 5.6), 2) : GO(AT(BOT), REST, SEG(t, 5.6, 6.2));
        bIn = t >= 2.2 && t < 5.6; bTilt = t >= 3.3 && t < 4.3 ? -110 * Math.sin(Math.PI * SEG(t, 3.3, 4.3)) * .8 : 0;
        if (t >= 4.4 && t < 5.0) { lift = -1.5 * Math.sin(Math.PI * SEG(t, 4.4, 5.0)); expr = 'calm'; }   /* the sigh */
        gy = 200 + 24 * cr; pose.lean = .55 * cr; var cs2 = Math.cos(face * Math.PI / 180);
        if (cr > 0) [-1, 1].forEach(function (sd) { pose[LEG(sd, face)] = { m: 1, at: [cx + sd * 10 * cs2 * .5, 198] }; });   /* feet stay on the floor while he bends his knees */
      } else if (st.pact === 'jog') {   /* jogging on the spot, arms pumping; then a look at the watch */
        face = t < .4 ? 35 * (1 - E(SEG(t, 0, .4))) : t < 4.6 ? 0 : 35 * E(SEG(t, 4.9, 5.4));
        var jg = t >= .5 && t < 3.6 ? Math.min(1, (t - .5) / .3, (3.6 - t) / .3) : 0;
        w = jg; lift = jg * 3 * Math.abs(Math.sin((t - .5) * Math.PI * 3.1));
        [-1, 1].forEach(function (sd) { var k2 = SIDE(sd, face), sw2 = Math.sin((t - .5) * Math.PI * 3.1) * sd; if (jg > 0) pose[k2] = { m: jg, b: [118 - 24 * sw2, 30] };   /* the arms ease into pumping and out of it */ });
        if (t >= 3.6 && t < 5.2) { var wh = SIDE(-1, face), WW = B(86, 40); pose[wh] = t < 4.0 ? GO(REST, WW, SEG(t, 3.6, 4.0)) : t < 4.8 ? HOLD(WW) : GO(WW, REST, SEG(t, 4.8, 5.2));  }
        gy = 200;
      } else if (st.pact === 'toes') {   /* a rest-day stretch: down to the toes, hold, up with the arms high */
        face = t < .4 ? 35 + 35 * E(SEG(t, 0, .4)) : t < 4.6 ? 70 : 70 - 35 * E(SEG(t, 4.6, 5.2));   /* side on, so the bend shows */
        var dn = t < .6 ? 0 : t < 1.4 ? E(SEG(t, .6, 1.4)) : t < 2.4 ? 1 : t < 3.2 ? 1 - E(SEG(t, 2.4, 3.2)) : 0;
        [-1, 1].forEach(function (sd) { var k2 = SIDE(sd, face), TOE = B(178, 14), UPT = B(26, 4);
          pose[k2] = t < .6 ? REST : t < 1.4 ? GO(REST, TOE, SEG(t, .6, 1.4)) : t < 2.4 ? HOLD(TOE) : t < 3.2 ? GO(TOE, UPT, SEG(t, 2.4, 3.2)) : t < 4.0 ? HOLD(UPT) : t < 4.6 ? GO(UPT, REST, SEG(t, 4.0, 4.6)) : REST; });
        pose.lean = 1.1 * dn; lift = t >= 3.2 && t < 4.0 ? 2 * Math.sin(Math.PI * SEG(t, 3.2, 4.0)) : 0; gy = 200;
      }
      /* crouch, take both dumbbells, stand; three curls; put them down; wipe the brow; arms up */
      if (st.pact) {} else if (t < .7) cr = E(SEG(t, 0, .7)); else if (t < 1.3) cr = 1 - E(SEG(t, .7, 1.3)); else if (t >= 4.3 && t < 5.0) cr = E(SEG(t, 4.3, 5.0)); else if (t >= 5.0 && t < 5.6) cr = 1 - E(SEG(t, 5.0, 5.6));
      var gy;
      if (!st.pact) {
      held = t >= .7 && t < 5.0;
      gy = 200 + 24 * cr;
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
      pose.lean = .6 * cr;
      }
      pose.lift = lift; var ph = LIFE(st, pose, w);
      function dumb(x, y) { var d = grp(x, y, 0); add(d, 'line', { x1: -7, y1: 0, x2: 7, y2: 0, stroke: '#8f9ba5', 'stroke-width': 2.2 }); [-1, 1].forEach(function (s) { add(d, 'rect', { x: s * 7 - 2.5, y: -4.5, width: 5, height: 9, rx: 1.6, fill: '#2a2d33' }); }); return d; }
      if (!held) [-1, 1].forEach(function (sd) { var p = DB(sd); g.appendChild(dumb(p[0], p[1] + 2)); });
      if (!bIn) g.appendChild(bottle(BOT[0], BOT[1]));
      FIG(g, { cx: cx, gy: gy, ground: 200, face: face, ph: ph, w: w, pose: pose, look: expr ? Object.assign({}, S.look(), { expr: expr }) : undefined, items: function (H) {
        if (bIn) { var bh = H[SIDE(-1, face)]; return bh ? [[bh.z - .15, bottle(bh.X, bh.Y, bTilt)]] : []; }
        return held ? [H.s1, H.sm].filter(Boolean).map(function (h) { return [h.z - .15, dumb(h.X, h.Y)]; }) : []; } });
      if (t >= 6.1 && t < 7.0) { var q = SEG(t, 6.1, 7.0); add(g, 'path', { d: 'M' + (cx + 10) + ' ' + (126 + q * 50) + ' q-2.5 4 0 5.5 q2.5 -1.5 0 -5.5', fill: '#9ad0e8', opacity: (1 - q).toFixed(2) }); }
    } });
  };
})();
