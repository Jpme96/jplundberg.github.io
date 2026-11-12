/* The Goals picture in 2.5D (Phase F2) – ported from the preview JP picked ("Scenes in 2.5D"):
   GOALS: up the trail with the flag (smaller higher up – it's further away), plant it at the top.
   Built on scene25.js (the runner, helpers, your look) and Fig25 (the body). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.goals = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, CL = S.CL, SEG = S.SEG, LERP = S.LERP, MIX = S.MIX, AT = S.AT, B = S.B, GO = S.GO, HOLD = S.HOLD, SIDE = S.SIDE, LEG = S.LEG,
      REST = S.REST, grp = S.grp, CLOCK = S.CLOCK, FLOOR = S.FLOOR, STAR = S.STAR, CHEER = S.CHEER;
    data = data || {};
    return S.run(svg, { gen: { out: true }, hits: [[150, 80, 250, 120, 'glActive']], len: 10.6, data: data, render: function (sv, t, st) {
      var now = st.now || 0, LIFE = window.Scene25.LIFE;   /* (a scene may use S for its own things) */
      function FIG(par, o) { o.st = st; o.k = o.k || .5; if (o.look === 'iago') o.look = 'partner'; return window.Scene25.FIG(par, o); }
      var g = add(sv, 'g', {}), cx = 60, face = 0, w = 0, pose = {}, lift = 0, planted = false;
      function YG(x) { return 200 - 92 * E(CL((x - 110) / 220)); }
      function KS(x) { return .5 - .17 * E(CL((x - 110) / 220)); }
      /* far mountains, the trail hill, little flags for the other goals */
      add(g, 'path', { d: 'M-10 170 L70 90 L120 130 L190 60 L260 140 L300 110 L410 170 Z', fill: 'rgba(255,255,255,.07)' });
      add(g, 'path', { d: 'M176 74 L190 60 L204 74 L197 72 L190 76 L183 72 Z', fill: 'rgba(255,255,255,.35)' });
      var hp = 'M0 200 L110 200'; for (var x = 110; x <= 330; x += 10) hp += ' L' + x + ' ' + YG(x).toFixed(1); hp += ' L400 108 L400 240 L0 240 Z';
      add(g, 'path', { d: hp, fill: '#2f5a3c' });
      var tr = 'M0 200 L110 200'; for (var x2 = 110; x2 <= 330; x2 += 10) tr += ' L' + x2 + ' ' + (YG(x2) + .5).toFixed(1); tr += ' L370 108';
      add(g, 'path', { d: tr, fill: 'none', stroke: '#c9b48e', 'stroke-width': 2, 'stroke-dasharray': '4 4', opacity: .7 });
      [[176, '#3987e5'], [252, '#e8743b']].forEach(function (m) { var yy = YG(m[0]) + .5, ms = KS(m[0]) / .5; add(g, 'line', { x1: m[0], y1: yy, x2: m[0], y2: yy - 62 * ms, stroke: '#d7dee3', 'stroke-width': 1.8 * ms }); add(g, 'path', { d: 'M' + m[0] + ' ' + (yy - 62 * ms) + ' l' + (16 * ms) + ' ' + (6 * ms) + ' l' + (-16 * ms) + ' ' + (6 * ms) + ' Z', fill: m[1] }); add(g, 'ellipse', { cx: m[0], cy: yy, rx: 4 * ms, ry: 1.2 * ms, fill: 'rgba(0,0,0,.25)' }); });
      if (t < .4) face = 90 * E(SEG(t, 0, .4)); else if (t < 7.0) { face = 90; cx = LERP(60, 335, SEG(t, .4, 7.0)); w = Math.min(1, (t - .4) / .2, (7.0 - t) / .2); } else { face = 90; cx = 335; }
      var gy = YG(cx), k = KS(cx), s = k / .5, nh = SIDE(1, 90), CARRY = B(96, 18),   /* the flag in his far hand: the pole rests behind him, not across his chest */ UPP = [cx + 15 * s, gy - 74 * s], DN = [cx + 15 * s, gy - 30 * s], pf = 0;
      if (t < 7.0) pose[nh] = HOLD(CARRY);
      else if (t < 7.5) { pose[nh] = GO(CARRY, AT(UPP), SEG(t, 7.0, 7.5), 4); pf = E(SEG(t, 7.0, 7.5)); }
      else if (t < 8.0) { pose[nh] = HOLD(AT(MIX(UPP, DN, E(SEG(t, 7.5, 8.0))))); pf = 1; }
      else if (t < 8.4) { pose[nh] = GO(AT(DN), REST, SEG(t, 8.0, 8.4)); planted = true; }
      else planted = true;
      if (t >= 8.4 && t < 8.8) face = 90 * (1 - E(SEG(t, 8.4, 8.8))); else if (t >= 8.8) face = 0;
      var ch = t >= 8.8 && t < 10.0 ? CHEER(t, 8.8, 1.2) : null;
      if (ch) { lift = ch.lift; if (ch.on) { pose.near = { m: ch.on, s: 2.6, f: 3.0 }; pose.far = { m: ch.on, s: 2.6, f: 3.0 }; } }
      pose.lean = .12 * E(SEG(t, .2, .6)) * (1 - E(SEG(t, 6.8, 7.2)));   /* leaning into the climb, eased in and out */ pose.lift = lift; var ph = LIFE(st, pose, w);
      function flag(par, top, ss, wave) { add(par, 'path', { d: 'M' + top[0].toFixed(1) + ' ' + top[1].toFixed(1) + ' q' + (8 * ss) + ' ' + (-3 * ss + wave) + ' ' + (16 * ss) + ' ' + (1 * ss) + ' l0 ' + (12 * ss) + ' q' + (-8 * ss) + ' ' + (-3 * ss - wave) + ' ' + (-16 * ss) + ' ' + (1 * ss) + ' Z', fill: '#d93a3a' }); }
      var PX = 335 + 15 * KS(335) / .5, PY = YG(335);
      if (planted) { var s2 = KS(335) / .5; add(g, 'line', { x1: PX, y1: PY + 1, x2: PX, y2: PY - 62 * s2, stroke: '#d7dee3', 'stroke-width': 1.8 * s2 }); flag(g, [PX, PY - 62 * s2], s2, 2 * Math.sin(now / 160)); }
      FIG(g, { cx: cx, gy: gy, k: k, face: face, ph: ph, w: w, pose: pose, items: function (H) { if (planted || !H.s1) return [];
        var hx = H.s1.X, hy = H.s1.Y, carryB = [hx + 6 * s, hy + 12 * s], carryT = [hx - 26 * s, hy - 44 * s], vB = [hx, hy + 30 * s], vT = [hx, hy - 34 * s];
        var b2 = MIX(carryB, vB, pf), t2 = MIX(carryT, vT, pf), fg = el('g', {});
        add(fg, 'line', { x1: b2[0], y1: b2[1], x2: t2[0], y2: t2[1], stroke: '#d7dee3', 'stroke-width': 1.8 * s, 'stroke-linecap': 'round' });
        if (pf > .6) flag(fg, t2, s * (pf - .6) / .4, 1.5 * Math.sin(now / 160)); else add(fg, 'path', { d: 'M' + t2[0] + ' ' + t2[1] + ' l' + (-3 * s) + ' ' + (10 * s) + ' l' + (5 * s) + ' ' + (2 * s) + ' Z', fill: '#d93a3a' });
        return [[H.s1.z - .15, fg]]; } });
    } });
  };
})();
