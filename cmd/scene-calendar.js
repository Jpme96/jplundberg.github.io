/* The Calendar picture in 2.5D (Phase F2) – ported from the preview JP picked ("Scenes in 2.5D"):
   CALENDAR: tear off yesterday, into the bin; look at the clock; thumbs up.
   Built on scene25.js (the runner, helpers, your look) and Fig25 (the body). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.calendar = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, CL = S.CL, SEG = S.SEG, LERP = S.LERP, MIX = S.MIX, AT = S.AT, B = S.B, GO = S.GO, HOLD = S.HOLD, SIDE = S.SIDE, LEG = S.LEG,
      REST = S.REST, grp = S.grp, CLOCK = S.CLOCK, FLOOR = S.FLOOR, STAR = S.STAR, CHEER = S.CHEER;
    data = data || {};
    return S.run(svg, { hits: [[148, 80, 56, 72, 'clToday'], [232, 46, 54, 54, 'clToday'], [310, 44, 40, 40, 'clToday']], len: 7.4, data: data, render: function (sv, t, st) {
      var now = st.now || 0, LIFE = window.Scene25.LIFE;   /* (a scene may use S for its own things) */
      function FIG(par, o) { o.st = st; o.k = o.k || .5; if (o.look === 'iago') o.look = 'partner'; return window.Scene25.FIG(par, o); }
      var g = add(sv, 'g', {}), d = new Date(), today = d.getDate(), yday = new Date(d - 864e5).getDate(), WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      var cx = 260, face = 0, w = 0, pose = {}, lean = 0, lift = 0, C0 = [196, 145], PULL = [214, 156], CH = B(116, 22), TOSS = [194, 112], BIN = [118, 184];
      /* sticky notes, the clock, the bin, the floor */
      [['#f2c94c', 236, 52, -4], ['#f2a3c4', 262, 58, 5], ['#9ad0e8', 246, 82, -2]].forEach(function (n) { var s = grp(n[1], n[2], n[3]); g.appendChild(s); add(s, 'rect', { x: 0, y: 0, width: 20, height: 18, rx: 1.5, fill: n[0] }); add(s, 'line', { x1: 4, y1: 6, x2: 16, y2: 6, stroke: 'rgba(0,0,0,.25)', 'stroke-width': 1.2 }); add(s, 'line', { x1: 4, y1: 11, x2: 13, y2: 11, stroke: 'rgba(0,0,0,.25)', 'stroke-width': 1.2 }); });
      CLOCK(g, 330, 64, 17); FLOOR(g);
      add(g, 'path', { d: 'M106 178 L130 178 L127 200 L109 200 Z', fill: '#5b636c' }); add(g, 'rect', { x: 104, y: 175, width: 28, height: 4, rx: 1.5, fill: '#6c757e' });
      if (t < .4) face = -90 * E(SEG(t, 0, .4)); else if (t < 1.2) { face = -90; cx = LERP(260, 220, SEG(t, .4, 1.2)); w = Math.min(1, (t - .4) / .2, (1.2 - t) / .2); }
      else if (t < 3.6) { face = -90; cx = 220; var nr = SIDE(1, -90);
        pose[nr] = t < 1.6 ? GO(REST, AT(C0), SEG(t, 1.2, 1.6), 2) : t < 2.2 ? HOLD(AT(MIX(C0, PULL, E(SEG(t, 1.6, 2.2))))) : t < 2.7 ? GO(AT(PULL), CH, SEG(t, 2.2, 2.7)) : t < 3.0 ? GO(CH, AT(TOSS), SEG(t, 2.7, 3.0), 3) : GO(AT(TOSS), REST, SEG(t, 3.0, 3.4));
        lean = .25 * E(SEG(t, 1.2, 1.6)) * (1 - E(SEG(t, 3.0, 3.4))); }
      else if (t < 4.0) { cx = 220; face = -90 + 145 * E(SEG(t, 3.6, 4.0)); }
      else if (t < 5.0) { cx = 220; face = 55; lift = -1.2 * Math.sin(Math.PI * 2 * SEG(t, 4.3, 4.9)); }
      else if (t < 5.4) { cx = 220; face = 55 * (1 - E(SEG(t, 5.0, 5.4))); }
      else { cx = 220; face = 0; var tu = SIDE(-1, 0), TU = B(96, 26); pose[tu] = t < 5.8 ? GO(REST, TU, SEG(t, 5.4, 5.8)) : t < 6.8 ? HOLD(TU) : GO(TU, REST, SEG(t, 6.8, 7.2)); }
      pose.lean = lean; pose.lift = lift; var ph = LIFE(st, pose, w);
      /* the calendar pad: today's page under yesterday's; yesterday's peels from its lower corner, tears off and is crumpled */
      add(g, 'line', { x1: 175, y1: 84, x2: 175, y2: 96, stroke: '#8a8f99', 'stroke-width': 1.4 }); add(g, 'circle', { cx: 175, cy: 84, r: 1.8, fill: '#8a8f99' });
      add(g, 'rect', { x: 151, y: 96, width: 48, height: 52, rx: 3, fill: '#f4f1ea' });
      function pageText(par, num, wd) { add(par, 'rect', { x: 151, y: 96, width: 48, height: 11, rx: 3, fill: '#d96b6b' }); var tw = add(par, 'text', { x: 175, y: 104.5, 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 700, fill: '#fff', 'font-family': 'Inter, system-ui, sans-serif' }); tw.textContent = wd;
        var tn = add(par, 'text', { x: 175, y: 136, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: '#2a2d33', 'font-family': 'Inter, system-ui, sans-serif' }); tn.textContent = num; }
      pageText(g, today, WD[d.getDay()]);
      var torn = t >= 2.2 && st.playing || (t >= 2.2), pulling = t >= 1.6 && t < 2.2;
      if (t < 1.6 || (!st.playing && t < .01)) { var pg = add(g, 'g', {}); add(pg, 'rect', { x: 151, y: 96, width: 48, height: 52, rx: 3, fill: '#f8f6f0', stroke: 'rgba(0,0,0,.08)' }); pageText(pg, yday, WD[(d.getDay() + 6) % 7]); }
      else if (pulling) { var cn = MIX(C0, PULL, E(SEG(t, 1.6, 2.2))); add(g, 'path', { d: 'M151 107 L199 107 L' + (cn[0] + 3).toFixed(1) + ' ' + (cn[1] + 3).toFixed(1) + ' L151 148 Z', fill: '#f8f6f0', stroke: 'rgba(0,0,0,.12)' }); add(g, 'rect', { x: 151, y: 96, width: 48, height: 11, rx: 3, fill: '#d96b6b' }); }
      var sheet = null;
      if (t >= 2.2 && t < 3.0) sheet = 1 - .78 * E(SEG(t, 2.2, 2.7));
      function paper(x, y, s) { var p2 = grp(x, y, 0); if (s > .4) { add(p2, 'path', { d: 'M' + (-14 * s) + ' ' + (-2 * s) + ' L' + (12 * s) + ' ' + (-6 * s) + ' L' + (14 * s) + ' ' + (20 * s) + ' L' + (-10 * s) + ' ' + (22 * s) + ' Z', fill: '#f8f6f0', stroke: 'rgba(0,0,0,.15)' }); } else { add(p2, 'circle', { cx: 0, cy: 0, r: 4.2, fill: '#f1ede4', stroke: 'rgba(0,0,0,.2)' }); add(p2, 'path', { d: 'M-2 -1 L1 1 L-1 3 M1 -3 L2 0', fill: 'none', stroke: 'rgba(0,0,0,.25)', 'stroke-width': .7 }); } return p2; }
      FIG(g, { cx: cx, gy: 200, face: face, ph: ph, w: w, pose: pose, items: function (H) { return sheet != null && H.s1 ? [[H.s1.z - .15, paper(H.s1.X, H.s1.Y, sheet)]] : []; } });
      /* the ball flies into the bin */
      if (t >= 3.0 && t < 3.75) { var q = SEG(t, 3.0, 3.75), bp = MIX(TOSS, [118, 190], q); g.appendChild(paper(bp[0], bp[1] - 40 * Math.sin(Math.PI * Math.min(1, q * 1.08)), .2)); }
      /* the bin's front, drawn over the ball so it falls in and disappears */
      add(g, 'path', { d: 'M106 178 L130 178 L127 200 L109 200 Z', fill: '#5b636c' }); add(g, 'rect', { x: 104, y: 175, width: 28, height: 4, rx: 1.5, fill: '#6c757e' });
    } });
  };
})();
