/* The Work picture in 2.5D (Phase F2) – ported from the preview JP picked ("Scenes in 2.5D"):
   WORK: you behind the desk, the laptop facing you (we see its lid), the mug, the clock.
   Built on scene25.js (the runner, helpers, your look) and Fig25 (the body). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.work = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, CL = S.CL, SEG = S.SEG, LERP = S.LERP, MIX = S.MIX, AT = S.AT, B = S.B, GO = S.GO, HOLD = S.HOLD, SIDE = S.SIDE, LEG = S.LEG,
      REST = S.REST, grp = S.grp, CLOCK = S.CLOCK, FLOOR = S.FLOOR, STAR = S.STAR, CHEER = S.CHEER;
    data = data || {};
    var HR = new Date().getHours();
    return S.run(svg, {
      back: function (bg) { var g = bg;   /* the still scenery: drawn once (F4 – faster frames) */
      add(g, 'rect', { x: 34, y: 34, width: 76, height: 66, rx: 6, fill: '#1c2740', stroke: 'rgba(255,255,255,.4)', 'stroke-width': 2 });
      [[42, 70, 11, 30], [56, 58, 13, 42], [72, 74, 10, 26], [85, 63, 15, 37]].forEach(function (b2) { add(g, 'rect', { x: b2[0], y: b2[1], width: b2[2], height: 100 - b2[1], fill: '#2c3a5a' });
        for (var wy = b2[1] + 4; wy < 96; wy += 7) for (var wx = b2[0] + 2; wx < b2[0] + b2[2] - 2; wx += 5) if ((wx * 7 + wy * 3) % 5 < 3) add(g, 'rect', { x: wx, y: wy, width: 2.2, height: 2.4, fill: '#f2c94c', opacity: .7 }); });
      CLOCK(g, 330, 62, 17, 'face'); FLOOR(g);
      }, gen: { no: ['coffee'] },
      /* the page's own actions (F3): a video call in work hours, ticking off a sheet from the pile, a yawn late in the day */
      acts: [{ id: 'call', len: 5.2, w: function () { return HR >= 8 && HR < 16 ? 3 : .4; } }, { id: 'tick', len: 5.8, w: function () { return 1.5; } }, { id: 'yawn', len: 4.4, w: function () { return HR >= 15 || HR < 6 ? 3 : .4; } }, { id: 'done', len: 6.6, w: function () { return HR >= 16 || HR < 6 ? 2.5 : .3; } }], hits: [[196, 124, 50, 32, 'ptime', 'call'], [180, 136, 22, 22, 'flex', 'main'], [310, 42, 40, 40, 'flex', 'watch'], [128, 154, 184, 46, 'flex', 'tick']],   /* the laptop: a video call; the mug: a sip; the clock: the time; the desk: a sheet ticked off */
      season: { x: 362, y: 196, s: .95, act: false }, len: 12, data: data, render: function (sv, t, st) {
      var now = st.now || 0, LIFE = window.Scene25.LIFE;   /* (a scene may use S for its own things) */
      function FIG(par, o) { o.st = st; o.k = o.k || .5; if (o.look === 'iago') o.look = 'partner'; return window.Scene25.FIG(par, o); }
      var g = add(sv, 'g', {}), cx = 220, face = 0, pose = {}, lean = 0, lift = 0, mugIn = false, tilt = 0, MUG = [194, 151], MOUTH = B(66, 24), UP = B(34, 4);
      function TYPE(sd) { return B(118 + 1.4 * Math.sin(now / 75 + (sd > 0 ? 1.6 : 0)), 26); }
      /* the room: a window with the city at night, the clock, the floor */
      CLOCK(g, 330, 62, 17, 'hands');
      var lid = 0, sheetIn = false, ticks = 0, talk = false, expr = null, PILE = [266, 150];
      if (st.pact === 'call') {   /* a wave at the laptop's camera, then nodding along while the others talk */
        var wv = SIDE(1, 0), WAVE = B(54, 34);
        pose[SIDE(-1, 0)] = HOLD(TYPE(-1));
        pose[wv] = t < .5 ? GO(TYPE(1), WAVE, SEG(t, .1, .5)) : t < 1.8 ? HOLD(B(54 + 8 * Math.sin((t - .5) * 14), 34)) : t < 2.3 ? GO(WAVE, TYPE(1), SEG(t, 1.8, 2.3)) : HOLD(TYPE(1));
        lean = t > 2.3 && t < 4.8 ? .05 * Math.sin((t - 2.3) * 5) * Math.sin(Math.PI * SEG(t, 2.3, 4.8)) : 0; talk = t > 2.0 && t < 4.6; expr = t < 2 ? 'grin' : null;
      } else if (st.pact === 'tick') {   /* a sheet from the pile, ticks with the other hand, back on the pile */
        var lh = SIDE(1, 0), rh = SIDE(-1, 0), HOLDP = B(92, 40), PEN = function (k2) { return B(96 + 3 * Math.sin(k2), 42); };
        pose[lh] = t < .3 ? HOLD(TYPE(1)) : t < .8 ? GO(TYPE(1), AT(PILE), SEG(t, .3, .8), 2) : t < 1.2 ? GO(AT(PILE), HOLDP, SEG(t, .8, 1.2), 2) : t < 4.2 ? HOLD(HOLDP) : t < 4.7 ? GO(HOLDP, AT(PILE), SEG(t, 4.2, 4.7), 2) : t < 5.2 ? GO(AT(PILE), TYPE(1), SEG(t, 4.7, 5.2), 2) : HOLD(TYPE(1));
        pose[rh] = t < 1.3 ? HOLD(TYPE(-1)) : t < 1.7 ? GO(TYPE(-1), PEN(0), SEG(t, 1.3, 1.7)) : t < 3.7 ? HOLD(PEN((t - 1.7) * 9)) : t < 4.1 ? GO(PEN(0), TYPE(-1), SEG(t, 3.7, 4.1)) : HOLD(TYPE(-1));
        sheetIn = t >= .8 && t < 4.7; ticks = Math.floor(CL((t - 1.8) / 1.8) * 3 + .001); lean = .12 * Math.sin(Math.PI * SEG(t, .3, 5.2));
      } else if (st.pact === 'yawn') {   /* a long day: arms up in a big yawn, rubs the eyes, back to the keys */
        var UPY = B(30, 4), EYE = B(64, 26);
        [-1, 1].forEach(function (sd) { var k2 = SIDE(sd, 0); pose[k2] = t < .6 ? GO(TYPE(sd), UPY, SEG(t, .1, .6)) : t < 1.6 ? HOLD(UPY) : t < 2.1 ? GO(UPY, EYE, SEG(t, 1.6, 2.1)) : t < 3.2 ? HOLD(B(64 + 3 * Math.sin((t - 2.1) * 18) * sd, 26)) : t < 3.8 ? GO(EYE, TYPE(sd), SEG(t, 3.2, 3.8)) : HOLD(TYPE(sd)); });
        lean = -.08 * Math.sin(Math.PI * SEG(t, .2, 1.8)); lift = 2 * Math.sin(Math.PI * SEG(t, .4, 1.6)); expr = t > .4 && t < 1.8 ? 'wow' : t > 1.8 && t < 3.4 ? 'calm' : null;
      } else if (st.pact === 'done') {   /* after hours: the lid down, a lean back with the hands behind the head – then one more thing, and the lid is up again */
        var rk = SIDE(1, 0), lk2 = SIDE(-1, 0), LT = function () { return AT([220, 131 + 19 * lid]); }, HEAD = function (sd) { return B(50, -8); };
        lid = t < .7 ? 0 : t < 1.3 ? E(SEG(t, .7, 1.3)) : t < 5.0 ? 1 : t < 5.6 ? 1 - E(SEG(t, 5.0, 5.6)) : 0;
        pose[rk] = t < .7 ? GO(TYPE(1), AT([220, 131]), SEG(t, .2, .7), 2) : t < 1.3 ? HOLD(LT()) : t < 2.0 ? GO(AT([220, 150]), HEAD(1), SEG(t, 1.4, 2.0), 3) : t < 4.0 ? HOLD(HEAD(1)) : t < 5.0 ? GO(HEAD(1), AT([220, 150]), SEG(t, 4.0, 5.0), 3) : t < 5.6 ? HOLD(LT()) : GO(AT([220, 131]), TYPE(1), SEG(t, 5.6, 6.2), 2);
        pose[lk2] = t < 1.4 ? HOLD(TYPE(-1)) : t < 2.0 ? GO(TYPE(-1), HEAD(-1), SEG(t, 1.4, 2.0), 3) : t < 4.0 ? HOLD(HEAD(-1)) : t < 4.8 ? GO(HEAD(-1), TYPE(-1), SEG(t, 4.0, 4.8), 3) : HOLD(TYPE(-1));
        lean = -.14 * E(SEG(t, 1.5, 2.1)) * (1 - E(SEG(t, 3.9, 4.6))); expr = t > 1.9 && t < 4.2 ? 'calm' : null;
      } else if (t < 2.8 || t >= 7.8) { pose[SIDE(-1, 0)] = HOLD(TYPE(-1)); pose[SIDE(1, 0)] = HOLD(TYPE(1)); }
      else if (t < 6.3) {
        face = t < 3.2 ? -70 * E(SEG(t, 2.8, 3.2)) : t < 5.9 ? -70 : -70 * (1 - E(SEG(t, 5.9, 6.3)));
        var mh = SIDE(1, face), oh = SIDE(-1, face);
        if (t < 3.2) pose[oh] = GO(TYPE(-1), REST, SEG(t, 2.8, 3.2));
        /* the mug: reach, to the mouth, a sip, back down, let go */
        pose[mh] = t < 3.2 ? HOLD(TYPE(1)) : t < 3.7 ? GO(TYPE(1), AT(MUG), SEG(t, 3.2, 3.7), 3) : t < 4.2 ? GO(AT(MUG), MOUTH, SEG(t, 3.7, 4.2), 2)
          : t < 5.0 ? HOLD(MOUTH) : t < 5.5 ? GO(MOUTH, AT(MUG), SEG(t, 5.0, 5.5), 2) : GO(AT(MUG), REST, SEG(t, 5.5, 5.9));
        mugIn = t >= 3.7 && t < 5.5; tilt = t >= 4.2 && t < 5.0 ? 38 * Math.sin(Math.PI * SEG(t, 4.2, 5.0)) : 0;
        lean = .3 * E(SEG(t, 3.2, 3.7)) * (1 - E(SEG(t, 3.7, 4.2))) + .3 * E(SEG(t, 5.0, 5.5)) * (1 - E(SEG(t, 5.5, 5.9)));
      } else {   /* a long stretch, arms up */
        [-1, 1].forEach(function (sd) { var k2 = SIDE(sd, 0); pose[k2] = t < 6.8 ? GO(REST, UP, SEG(t, 6.3, 6.8)) : t < 7.3 ? HOLD(UP) : GO(UP, TYPE(sd), SEG(t, 7.3, 7.8)); });
        lift = t >= 6.8 && t < 7.3 ? 2.5 * Math.sin(Math.PI * SEG(t, 6.8, 7.3)) : 0;
      }
      pose.lean = lean; pose.lift = lift; LIFE(st, pose, 0);
      function mug(x, y, deg) { var m = grp(x, y, deg); add(m, 'rect', { x: -4.8, y: -5.5, width: 9.6, height: 11, rx: 2, fill: '#e8743b' }); add(m, 'path', { d: 'M4.6 -3 q4.5 0 4.5 3 q0 3 -4.5 3', fill: 'none', stroke: '#e8743b', 'stroke-width': 1.8 }); add(m, 'rect', { x: -4.2, y: -5.5, width: 8.4, height: 1.6, fill: '#5a3424', opacity: .7 }); return m; }
      if (talk) { var bp = 200 - 112; add(g, 'rect', { x: cx + 22, y: bp - 12, width: 26, height: 14, rx: 7, fill: 'rgba(255,255,255,.9)' }); [0, 1, 2].forEach(function (i) { add(g, 'circle', { cx: cx + 29 + i * 6, cy: bp - 5, r: 1.6, fill: '#2a2d33', opacity: .35 + .65 * (Math.floor(now / 250) % 3 === i ? 1 : 0) }); }); }
      function sheet(x, y, n) { var sh = grp(x, y, -6); add(sh, 'rect', { x: -9, y: -11, width: 18, height: 22, rx: 1.5, fill: '#f4f1ea', stroke: 'rgba(0,0,0,.15)' }); for (var i = 0; i < 3; i++) { add(sh, 'rect', { x: -5, y: -7 + i * 6, width: 9, height: 1.4, fill: '#b9bcc4' }); if (i < n) add(sh, 'path', { d: 'M-8 ' + (-7 + i * 6) + ' l1.6 1.8 l2.6 -3.4', fill: 'none', stroke: '#22b35e', 'stroke-width': 1.3, 'stroke-linecap': 'round' }); } return sh; }
      FIG(g, { cx: cx, gy: 200, face: face, pose: pose, look: expr ? Object.assign({}, S.look(), { expr: expr }) : undefined, items: function (H) {
        var sh0 = H[SIDE(1, 0)]; if (sheetIn && sh0) return [[sh0.z - .15, sheet(sh0.X, sh0.Y - 8, ticks)]];   /* the hand that took it (by pose key – at face 0 the side names tie) */ return mugIn && H.s1 ? [[H.s1.z - .15, mug(H.s1.X, H.s1.Y, tilt)]] : []; } });
      /* the desk in front of you (it hides your legs), the laptop's lid facing you, the mug */
      add(g, 'rect', { x: 128, y: 154, width: 184, height: 6, rx: 2, fill: '#a87652' });
      add(g, 'rect', { x: 136, y: 160, width: 168, height: 40, fill: '#7a5038' }); add(g, 'rect', { x: 146, y: 166, width: 60, height: 14, rx: 3, fill: '#8a5e44' }); add(g, 'rect', { x: 170, y: 172, width: 12, height: 2.4, rx: 1.2, fill: '#d7c2a8' });
      [0, 1, 2].forEach(function (i) { if (i === 2 && sheetIn) return; add(g, 'rect', { x: PILE[0] - 10 + i * .6, y: PILE[1] - 1.6 - i * 1.6, width: 20, height: 1.8, rx: .6, fill: i % 2 ? '#e9e5dc' : '#f4f1ea', stroke: 'rgba(0,0,0,.12)', 'stroke-width': .4 }); });   /* the pile of action points; the top sheet is the one he takes */
      add(g, 'rect', { x: 198, y: 150, width: 44, height: 4, rx: 1.5, fill: '#3a3f4a' });
      var ly = 131 + 19 * lid; add(g, 'path', { d: 'M201 151 L239 151 L' + (238 + lid).toFixed(1) + ' ' + ly.toFixed(1) + ' L' + (202 - lid).toFixed(1) + ' ' + ly.toFixed(1) + ' Z', fill: '#c9ced6' }); if (lid < .8) add(g, 'circle', { cx: 220, cy: (141 + 9.5 * lid).toFixed(1), r: 3 * (1 - lid), fill: '#eef0f4', opacity: .9 });   /* the lid folds down when he's done */
      if (!mugIn) { var m0 = mug(MUG[0], MUG[1], 0); g.appendChild(m0); for (var si = 0; si < 2; si++) { var ph0 = ((now / 1000) * .5 + si / 2) % 1; add(g, 'path', { d: 'M' + (MUG[0] - 2 + si * 4) + ' ' + (MUG[1] - 8 - ph0 * 12) + ' q-2 -3 0 -6', fill: 'none', stroke: '#fff', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: (.45 * Math.sin(Math.PI * ph0)).toFixed(2) }); } }
    } });
  };
})();
