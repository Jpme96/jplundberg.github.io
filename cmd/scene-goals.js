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
    var KID = { skin: '#e3b893', hair: 'pony', hairC: '#6b4423', top: 'hoodie', topC: '#e8743b', bottom: 'shorts', legs: '#3a4a6a', build: 'slim', expr: 'grin' };   /* the smaller climber (another goal on its way) */
    return S.run(svg, {
      back: function (bg) { var g = bg;   /* the still scenery: drawn once (F4 – faster frames) */
      function YG(x) { return 200 - 92 * E(CL((x - 110) / 220)); }
      function KS(x) { return .5 - .17 * E(CL((x - 110) / 220)); }
      add(g, 'path', { d: 'M-10 170 L70 90 L120 130 L190 60 L260 140 L300 110 L410 170 Z', fill: 'rgba(255,255,255,.07)' });
      add(g, 'path', { d: 'M176 74 L190 60 L204 74 L197 72 L190 76 L183 72 Z', fill: 'rgba(255,255,255,.35)' });
      var hp = 'M8 204 Q8 200 24 200 L110 200'; for (var x = 110; x <= 330; x += 10) hp += ' L' + x + ' ' + YG(x).toFixed(1); hp += ' L362 108 Q388 108 393 150 Q397 200 386 204 Z';   /* a hill standing on the ground, rounded at both ends – no strip to the frame's edge (Phase G; it was cut off by the frame, 2026-11-15) */
      add(g, 'path', { d: hp, fill: '#27694a' });
      var tr = 'M0 200 L110 200'; for (var x2 = 110; x2 <= 330; x2 += 10) tr += ' L' + x2 + ' ' + (YG(x2) + .5).toFixed(1); tr += ' L356 108';
      add(g, 'path', { d: tr, fill: 'none', stroke: '#d8c8a8', 'stroke-width': 2, 'stroke-dasharray': '4 4', opacity: .7 });
      /* (the blue and orange milestone flags were removed – JP 2026-11-21: the gold goal flag and the savings pennant are enough) */
      /* a What if savings goal (2026-11-21, JP): the summit flag is the goal (gold, drawn with the planted flag); here a gold line
         fills the trail from the bottom up to where your savings have got, and a bright pennant with the % marks that point */
      if (data.wi) {
        var MX = 110 + 200 * CL(data.wi.pct || 0), ms2 = KS(MX) / .5, my = YG(MX) + .5;
        var pg = 'M0 200 L' + Math.min(110, MX).toFixed(1) + ' 200'; for (var x3 = 110; x3 <= MX; x3 += 5) pg += ' L' + x3 + ' ' + (YG(x3) + .5).toFixed(1); pg += ' L' + MX.toFixed(1) + ' ' + my.toFixed(1);
        add(g, 'path', { d: pg, fill: 'none', stroke: '#f2c94c', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: .85 });
        add(g, 'ellipse', { cx: MX, cy: my, rx: 4 * ms2, ry: 1.2 * ms2, fill: 'rgba(0,0,0,.25)' });
        add(g, 'line', { x1: MX, y1: my, x2: MX, y2: my - 34 * ms2, stroke: '#cdd3d9', 'stroke-width': 1.6 * ms2, 'stroke-linecap': 'round' });
        add(g, 'path', { d: 'M' + MX + ' ' + (my - 34 * ms2).toFixed(1) + ' l' + (22 * ms2).toFixed(1) + ' ' + (6 * ms2).toFixed(1) + ' l' + (-22 * ms2).toFixed(1) + ' ' + (6 * ms2).toFixed(1) + ' Z', fill: '#f2c94c' });
        S.txt(g, { x: (MX + 2 * ms2).toFixed(1), y: (my - 37 * ms2).toFixed(1), 'font-size': Math.max(9.5, 8 * ms2).toFixed(1), 'font-weight': 700, fill: '#f2c94c' }, Math.round((data.wi.pct || 0) * 100) + ' %');
      }
      }, gen: { out: true },
      /* the page's own action (F3): a rest on the rock at the top, looking out over the view */
      acts: [{ id: 'sit', len: 6.6, w: function () { return 2; } }, { id: 'help', len: 7.0, w: function () { return 1.2; } }, { id: 'wigoal', len: 10.6, w: function () { return data.wi ? 2.4 : 0; } }],
      hits: [[150, 80, 250, 120, 'glActive', 'gaze']], season: { out: 1, x: 379, y: 107.5, s: .6, act: false },   /* on the top, small with the distance; no walk on the slope */ len: 10.6, data: data, render: function (sv, t, st) {
      var now = st.now || 0, LIFE = window.Scene25.LIFE;   /* (a scene may use S for its own things) */
      function FIG(par, o) { o.st = st; o.k = o.k || .5; if (o.look === 'iago') o.look = 'partner'; return window.Scene25.FIG(par, o); }
      var g = add(sv, 'g', {}), cx = 60, face = 0, w = 0, pose = {}, lift = 0, planted = false;
      function YG(x) { return 200 - 92 * E(CL((x - 110) / 220)); }
      function KS(x) { return .5 - .17 * E(CL((x - 110) / 220)); }
      /* far mountains, the trail hill */
      if (st.pact) { cx = 335; face = 0; } else if (t < .4) face = 90 * E(SEG(t, 0, .4)); else if (t < 7.0) { face = 90; cx = LERP(60, 335, SEG(t, .4, 7.0)); w = Math.min(1, (t - .4) / .2, (7.0 - t) / .2); } else { face = 90; cx = 335; }
      var gy = YG(cx), k = KS(cx), s = k / .5, nh = SIDE(1, 90), CARRY = B(96, 18),   /* the flag in his far hand: the pole rests behind him, not across his chest */ UPP = [cx + 15 * s, gy - 74 * s], DN = [cx + 15 * s, gy - 30 * s], pf = 0;
      var sitF = 0, kid = null, helpLean = 0;
      if (st.pact === 'sit') {   /* down onto the rock, a long look out over the view, up again */
        planted = true; sitF = t < .3 ? 0 : t < 1.1 ? E(SEG(t, .3, 1.1)) : t < 5.4 ? 1 : 1 - E(SEG(t, 5.4, 6.2));
        face = t < 1.4 ? 0 : t < 2.0 ? -35 * E(SEG(t, 1.4, 2.0)) : t < 4.6 ? -35 + 10 * Math.sin((t - 2) * 1.2) : t < 5.2 ? -35 * (1 - E(SEG(t, 4.6, 5.2))) : 0;
        if (sitF > 0) { pose.legNear = { m: sitF, th: 1.5, kn: 1.5 }; pose.legFar = { m: sitF, th: 1.5, kn: 1.5 }; [-1, 1].forEach(function (sd) { pose[SIDE(sd, face)] = { m: sitF, b: [134, 22] }; }); lift = -36 * sitF; }
      } else if (st.pact === 'help') {   /* a smaller climber comes up the trail: he turns, reaches a hand down and helps them up the last step; a cheer together, and they head down again */
        planted = true; var kx = t < .6 ? 286 : t < 2.4 ? LERP(286, 314, E(SEG(t, .6, 2.4))) : t < 5.4 ? 314 : LERP(314, 286, E(SEG(t, 5.4, 6.6)));
        kid = { cx: kx, face: t < 3.5 ? 90 : t < 3.9 ? 90 * (1 - E(SEG(t, 3.5, 3.9))) : t < 5.1 ? 0 : t < 5.4 ? -90 * E(SEG(t, 5.1, 5.4)) : -90, w: (t > .6 && t < 2.4) ? Math.min(1, (t - .6) / .25, (2.4 - t) / .25) : (t > 5.4 && t < 6.6) ? Math.min(1, (t - 5.4) / .25, (6.6 - t) / .25) : 0,
          op: Math.min(1, E(SEG(t, .2, .8)), 1 - E(SEG(t, 6.2, 6.8))), pose: {} };
        face = t < .4 ? -90 * E(SEG(t, 0, .4)) : t < 3.5 ? -90 : t < 3.9 ? -90 * (1 - E(SEG(t, 3.5, 3.9))) : 0;
        var HK = [kx + 9, YG(kx) - 44 * KS(kx) / .5], mh = SIDE(1, face), khh = SIDE(1, 90);
        if (t >= 1.6 && t < 3.5) { pose[mh] = t < 2.3 ? GO(REST, AT(HK), SEG(t, 1.6, 2.3), 2) : t < 3.0 ? HOLD(AT(HK)) : GO(AT(HK), REST, SEG(t, 3.0, 3.5));
          kid.pose[khh] = t < 2.0 ? REST : t < 2.4 ? GO(REST, AT(HK), SEG(t, 2.0, 2.4), 2) : t < 3.0 ? HOLD(AT(HK)) : GO(AT(HK), REST, SEG(t, 3.0, 3.5)); helpLean = .2 * E(SEG(t, 1.6, 2.3)) * (1 - E(SEG(t, 3.0, 3.5))); }
        if (t >= 3.9 && t < 5.1) { var ch2 = CHEER(t, 3.9, 1.2); lift = ch2.lift; if (ch2.on) { pose.near = { m: ch2.on, s: 2.6, f: 3.0 }; pose.far = { m: ch2.on, s: 2.6, f: 3.0 }; kid.pose.near = { m: ch2.on, s: 2.6, f: 3.0 }; kid.pose.far = { m: ch2.on, s: 2.6, f: 3.0 }; kid.pose.lift = ch2.lift * .8; } }
      } else if (st.pact === 'wigoal' && !data.wi) { planted = true;   /* no savings goal: it never comes up – if asked, he just rests at the top */
      } else if (st.pact === 'wigoal') {   /* down past the pennant (where the savings have got), turn uphill, a tap on it, a long reach up at the gold
           goal flag, a fist pump (a full cheer when nearly there), and an unhurried climb back (JP's review 2026-11-21) */
        planted = true;
        var pc = CL(data.wi.pct || 0), MX2 = 110 + 200 * pc, stand = Math.max(96, MX2 - 16), dn = Math.min(2.4, Math.max(.7, (335 - stand) / 100));
        var T1 = .4 + dn, T2 = T1 + .5, T3 = T2 + 1.0, T4 = T3 + 1.4, T5 = T4 + 1.0, T6 = Math.min(10.0, T5 + dn * 1.4);
        var s3 = KS(stand) / .5, gy2 = YG(stand), PEN = [MX2 + 4 * s3, gy2 - 30 * s3], sF = KS(335) / .5, FT = [335 + 15 * sF, YG(335) - 58 * sF], SH = [stand, gy2 - 60 * s3], dl = Math.hypot(FT[0] - SH[0], FT[1] - SH[1]) || 1,
          ux = (FT[0] - SH[0]) / dl, uy = Math.min((FT[1] - SH[1]) / dl, -.6), ul = Math.hypot(ux, uy), UPT = [SH[0] + ux / ul * 34 * s3, SH[1] + uy / ul * 34 * s3];   /* an arm's length from his shoulder, straight towards the gold flag – the reach reads as aimed at it */
        cx = stand;
        if (t < .4) { cx = 335; face = -90 * E(SEG(t, 0, .4)); }
        else if (t < T1) { face = -90; cx = LERP(335, stand, SEG(t, .4, T1)); w = Math.min(1, (t - .4) / .2, (T1 - t) / .2); }
        else if (t < T2) face = -90 + 180 * E(SEG(t, T1, T2));
        else if (t < T3) { face = 90; var hT = SIDE(1, 90); pose[hT] = t < T2 + .4 ? GO(REST, AT(PEN), SEG(t, T2, T2 + .4), 2) : t < T2 + .7 ? HOLD(AT(PEN)) : GO(AT(PEN), REST, SEG(t, T2 + .7, T3)); }
        else if (t < T4) { face = 90; var hP = SIDE(1, 90); pose[hP] = t < T3 + .45 ? GO(REST, AT(UPT), SEG(t, T3, T3 + .45), 2) : t < T4 - .35 ? HOLD(AT(UPT)) : GO(AT(UPT), REST, SEG(t, T4 - .35, T4)); helpLean = -.08 * E(SEG(t, T3, T3 + .45)) * (1 - E(SEG(t, T4 - .35, T4))); }
        else if (t < T5) { face = 90; var chW = CHEER(t, T4, 1.0); if (pc >= .85) { lift = chW.lift; if (chW.on) { pose.near = { m: chW.on, s: 2.6, f: 3.0 }; pose.far = { m: chW.on, s: 2.6, f: 3.0 }; } } else { lift = chW.lift * .4; if (chW.on) pose[SIDE(1, 90)] = { m: chW.on, s: 2.6, f: 3.0 }; } }
        else if (t < T6) { face = 90; cx = LERP(stand, 335, SEG(t, T5, T6)); w = Math.min(1, (t - T5) / .25, (T6 - t) / .25); helpLean = .12 * E(SEG(t, T5, T5 + .4)) * (1 - E(SEG(t, T6 - .4, T6))); }
        else { cx = 335; face = 90 * (1 - E(SEG(t, T6, Math.min(10.5, T6 + .4)))); }
        gy = YG(cx); k = KS(cx); s = k / .5;   /* where he stands on the slope, and how small with the distance */
      } else if (t < 7.0) pose[nh] = HOLD(CARRY);
      else if (t < 7.5) { pose[nh] = GO(CARRY, AT(UPP), SEG(t, 7.0, 7.5), 4); pf = E(SEG(t, 7.0, 7.5)); }
      else if (t < 8.0) { pose[nh] = HOLD(AT(MIX(UPP, DN, E(SEG(t, 7.5, 8.0))))); pf = 1; }
      else if (t < 8.4) { pose[nh] = GO(AT(DN), REST, SEG(t, 8.0, 8.4)); planted = true; }
      else planted = true;
      if (st.pact) {} else if (t >= 8.4 && t < 8.8) face = 90 * (1 - E(SEG(t, 8.4, 8.8))); else if (t >= 8.8) face = 0;
      var ch = !st.pact && t >= 8.8 && t < 10.0 ? CHEER(t, 8.8, 1.2) : null;
      if (ch) { lift = ch.lift; if (ch.on) { pose.near = { m: ch.on, s: 2.6, f: 3.0 }; pose.far = { m: ch.on, s: 2.6, f: 3.0 }; } }
      pose.lean = st.pact ? helpLean : .12 * E(SEG(t, .2, .6)) * (1 - E(SEG(t, 6.8, 7.2)));   /* leaning into the climb, eased in and out */ pose.lift = lift; var ph = LIFE(st, pose, w);
      var FC = data.wi ? '#f2c94c' : '#d6453f';   /* with a savings goal the summit flag is the goal: gold */
      function flag(par, top, ss, wave) { add(par, 'path', { d: 'M' + top[0].toFixed(1) + ' ' + top[1].toFixed(1) + ' q' + (8 * ss) + ' ' + (-3 * ss + wave) + ' ' + (16 * ss) + ' ' + (1 * ss) + ' l0 ' + (12 * ss) + ' q' + (-8 * ss) + ' ' + (-3 * ss - wave) + ' ' + (-16 * ss) + ' ' + (1 * ss) + ' Z', fill: FC }); }
      var PX = 335 + 15 * KS(335) / .5, PY = YG(335);
      if (planted) { var s2 = KS(335) / .5; add(g, 'line', { x1: PX, y1: PY + 1, x2: PX, y2: PY - 62 * s2, stroke: '#cdd3d9', 'stroke-width': 1.8 * s2 }); flag(g, [PX, PY - 62 * s2], s2, 2 * Math.sin(now / 160)); if (data.wi && data.wi.target) { var amt = S.kr(data.wi.target), aw = amt.length * 5.9 + 10, ax = Math.min(PX + 4, 396 - aw / 2), ay = PY - 62 * s2 - 9;   /* the goal on a small dark sign over the flag – readable on a phone (JP 2026-11-21) */
          add(g, 'rect', { x: (ax - aw / 2).toFixed(1), y: (ay - 10).toFixed(1), width: aw.toFixed(1), height: 14, rx: 4, fill: '#1d2128', opacity: .82 });
          S.txt(g, { x: ax.toFixed(1), y: (ay + .5).toFixed(1), 'font-size': 10.5, 'font-weight': 700, fill: '#f2c94c', 'text-anchor': 'middle' }, amt); } }
      if (st.pact === 'sit') { var rs = 1.4 * k / .5; add(g, 'path', { d: 'M' + (cx - 16 * rs) + ' ' + (gy + 1) + ' Q' + (cx - 15 * rs) + ' ' + (gy - 15 * rs) + ' ' + cx + ' ' + (gy - 16 * rs) + ' Q' + (cx + 16 * rs) + ' ' + (gy - 14 * rs) + ' ' + (cx + 15 * rs) + ' ' + (gy + 1) + ' Z', fill: '#6f7781' }); }   /* the rock he sits on */
      if (kid) { var kg = add(g, 'g', { opacity: kid.op.toFixed(2) }), kph = LIFE(st, kid.pose, kid.w, 'kid'); FIG(kg, { who: 'kid', look: KID, cx: kid.cx, gy: YG(kid.cx), k: KS(kid.cx) * .74, face: kid.face, ph: kph, w: kid.w, pose: kid.pose }); }
      FIG(g, { cx: cx, gy: gy, k: k, face: face, ph: ph, w: w, pose: pose, items: function (H) { if (planted || !H.s1) return [];
        var hx = H.s1.X, hy = H.s1.Y, carryB = [hx + 6 * s, hy + 12 * s], carryT = [hx - 26 * s, hy - 44 * s], vB = [hx, hy + 30 * s], vT = [hx, hy - 34 * s];
        var b2 = MIX(carryB, vB, pf), t2 = MIX(carryT, vT, pf), fg = el('g', {});
        add(fg, 'line', { x1: b2[0], y1: b2[1], x2: t2[0], y2: t2[1], stroke: '#cdd3d9', 'stroke-width': 1.8 * s, 'stroke-linecap': 'round' });
        if (pf > .6) flag(fg, t2, s * (pf - .6) / .4, 1.5 * Math.sin(now / 160)); else add(fg, 'path', { d: 'M' + t2[0] + ' ' + t2[1] + ' l' + (-3 * s) + ' ' + (10 * s) + ' l' + (5 * s) + ' ' + (2 * s) + ' Z', fill: FC });
        return [[pf < .5 ? Math.min(H.s1.z - .15, -0.6) : H.s1.z - .15, fg]]; } });   /* carried: the pole lies behind his back and head, never across his face (JP 2026-11-15); raised to plant it, it is in his hand in front */
    } });
  };
})();
