/* The Finances picture in 2.5D (Phase F2, page 1 – the preview JP picked, "Finances"). The glass jar holds what is
   left this month (its level and the amount), the calendar tile counts the days left, a metal ladder leans on the
   jar. What he does follows your money:
   - money on track (or payday): he walks in, climbs the ladder (hands on the rails, a foot on each rung), takes a coin
     from his pocket, drops it through the slot in the lid, climbs down, steps back, turns to you and cheers;
   - spending too fast or below zero: no coin – he walks to the jar, looks up at the level, a hand to his chin, shakes
     his head and turns to you, worried.
   Both end in the same rest (facing you, breathing, a look round now and then), so a replay or a tap never jumps.
   Tapping the jar or the calendar opens the budget card (data-scgo, scenes.js); tapping anywhere else plays it again.
   Built on scene25.js (the runner and helpers) and Fig25 (the body). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.finance = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, CL = S.CL, swing = S.swing;
    data = data || {};
    var GY = 168, K = .47, JX0 = 180, JW = 76, JT = 72, JB = 166, RUNG = 19;
    var LB = [268, 166], LT = [254, 72];                       /* the ladder leans on the jar's shoulder, its top above the lid */
    function lx(h) { return LB[0] + (LT[0] - LB[0]) * (h / (LB[1] - LT[1])); }
    function rail(y, sd) { return [lx(LB[1] - y) + sd * 3, y]; }
    function onRung(r) { return [lx(r * RUNG) + 3, LB[1] - r * RUNG - 5]; }
    var SL = JX0 + JW - 22, CLIMB = 2.3, T0 = 2.0, T1 = T0 + CLIMB, TC = T1 + .3, TD = TC + 1.7, T2 = TD + .5, T3 = T2 + CLIMB, T4 = T3 + .5, T5 = T4 + .5, T6 = T5 + 1.0, LEN = T6 + 2.0;
    var HOME = 300, BASE = lx(0) + 8;
    var AID = /chair|crutches/.test((S.look() || {}).aid || ''), idle = data.state === 'none' || data.state == null, ok = !idle && data.state !== 'neg' && data.state !== 'warn';
    var ratio = data.ratio == null ? .5 : Math.max(0, Math.min(1, data.ratio));
    function climbAt(u) {
      var gb = E(CL(u / .35)), fA = CL(u / .7), fB = CL((u - .7) / .8), fC = CL((u - 1.5) / .8);
      var h = 17 * E(fB) + 21 * E(fC), ground = [lx(0) + 4, LB[1]];
      var nearFoot = fC > 0 ? swing(onRung(1), onRung(2), fC, 7, 3) : fA < 1 ? swing(ground, onRung(1), fA, 6, 4) : onRung(1);
      var farFoot = fB > 0 ? swing(ground, onRung(2), fB, 8, 6) : ground;
      var nearHand = swing(rail(114, -1), rail(92, -1), fB, 4, 2), farHand = swing(rail(114, 1), rail(94, 1), fC, 4, 2);
      return { h: h, pose: { lean: .25 * gb, legNear: { m: fA > 0 ? 1 : 0, at: nearFoot }, legFar: { m: fB > 0 ? 1 : 0, at: farFoot }, near: { m: gb, at: nearHand }, far: { m: gb, at: farHand } } };
    }
    /* the rest every action ends in: facing you by the ladder's foot, a look round now and then */
    function rest(st) { var it = st.still ? 0 : (st.now - (st.endNow || st.now)) / 1000; return { cx: HOME, face: Math.sin(it * .35) * 22 * Math.max(0, Math.sin(it * .13)), pose: {} }; }
    /* he walks in from the right edge (or from where he rested, after the first time) */
    function walkIn(t, st, to) { var from = st.from || 420, f = from > 400 ? CL(t / 1.8) : E(CL(t / 1.8)); return { cx: from + (to - from) * f, face: -90 + (from > 400 ? 0 : 90 * (1 - E(CL(t / .4)))), w: t < 1.8 ? Math.min(1, t / .3) : 0 }; }   /* from where he rests: he turns first, then walks off gently */
    /* the coin action */
    function coin(t, st) {
      var r = { h: 0, w: 0, face: -90, pose: {}, coin: null };
      if (t < 1.8) Object.assign(r, walkIn(t, st, BASE));
      else if (t < T0) { r.cx = BASE; r.w = Math.max(0, 1 - (t - 1.8) / .2); }
      else if (t < T1) { var c = climbAt(t - T0); r.h = c.h; r.pose = c.pose; r.cx = lx(c.h) + 8; }
      else if (t < T2) { var top = climbAt(CLIMB); r.h = top.h; r.pose = top.pose; r.cx = lx(top.h) + 8;
        var u = t - TC, G = rail(92, -1), Pk = [r.cx - 14 * K, GY - r.h + (146 - 218) * K], Sl = [SL + 3, JT - 6], hp = G, ln = .25;
        if (u > 0) { if (u < .35) hp = swing(G, Pk, u / .35, 3, 0); else if (u < .5) hp = Pk;
          else if (u < .92) { hp = swing(Pk, Sl, (u - .5) / .42, 0, 7); ln = .25 + .25 * E((u - .5) / .42); }
          else if (u < 1.25) { hp = Sl; ln = .5; } else { var fr = CL((u - 1.25) / .45); hp = swing(Sl, G, fr, 0, 3); ln = .5 - .25 * E(fr); } }
        r.pose.near = { m: 1, at: hp }; r.pose.lean = ln;
        if (u > .4 && u < .92) r.coin = 'hand'; else if (u >= .92 && u < 1.2) r.coin = (u - .92) / .28; }
      else if (t < T3) { var d = climbAt(CLIMB - (t - T2)); r.h = d.h; r.pose = d.pose; r.cx = lx(d.h) + 8; }
      else if (t < T4) { r.cx = BASE + (HOME - BASE) * E((t - T3) / .5); r.w = .6 * Math.sin(Math.PI * (t - T3) / .5); }   /* the step starts and ends still – the arms don't snap into a swing */
      else if (t < T5) { r.cx = HOME; r.face = -90 + 90 * E((t - T4) / .5); }
      else if (t < T6) { r.cx = HOME; r.face = 0; var hp2 = (t - T5) / 1.0, on = E(CL(hp2 / .32)) * (1 - E(CL((hp2 - .7) / .3)));   /* the arms go up and come down, never snap */
        r.pose = { lift: hp2 < .2 ? -3 * Math.sin(hp2 / .2 * Math.PI) : hp2 < .65 ? 12 * Math.sin((hp2 - .2) / .45 * Math.PI) : 0, far: { m: on, b: [40, 10] }, near: { m: on, b: [40, 10] } }; r.expr = 'laugh'; }
      else Object.assign(r, rest(st));
      return r;
    }
    /* the worried look: to the jar, eyes on the level, a hand to the chin, a slow shake of the head, back to you */
    var W0 = 1.8, W1 = W0 + .4, W2 = W1 + 1.4, W3 = W2 + 1.1, W4 = W3 + .7, W5 = W4 + .5, WLEN = W5 + 1.2;
    function worry(t, st) {
      var r = { h: 0, w: 0, face: -90, pose: {}, expr: 'calm' }, AT = 292;   /* just past the ladder, eyes on the jar */
      if (t < W0) Object.assign(r, walkIn(t, st, AT));
      else if (t < W1) { r.cx = AT; r.w = Math.max(0, 1 - (t - W0) / .2); }
      else if (t < W2) { r.cx = AT; var f = E((t - W1) / .6); r.pose = { near: { m: f, b: [76, 18] }, lean: -.06 * f }; r.expr = 'shy'; }
      else if (t < W3) { r.cx = AT; r.face = -90 + 18 * Math.sin((t - W2) / 1.1 * Math.PI * 3) * Math.sin((t - W2) / 1.1 * Math.PI); r.pose = { near: { m: 1, b: [76, 18] }, lean: -.06 }; r.expr = 'shy'; }
      else if (t < W4) { var g = E((t - W3) / .7); r.cx = AT + (HOME - AT) * g; r.w = .6 * Math.sin(Math.PI * (t - W3) / .7); r.pose = { near: { m: 1 - g, b: [76, 18] }, lean: -.06 * (1 - g) }; }
      else if (t < W5) { r.cx = HOME; r.face = -90 + 90 * E((t - W4) / .5); }
      else Object.assign(r, rest(st));
      return r;
    }
    var nearRail = null;
    /* in the wheelchair or on crutches the ladder is out: he goes to the jar's side, takes the coin from his pocket and
       tosses it up through the slot – a little wind-up, the coin's arc, it drops in – then turns to you and cheers */
    var X0 = 1.8, X1 = X0 + .25, X2 = X1 + .4, X3 = X2 + .3, X4 = X3 + .22, X5 = X4 + .65, X6 = X5 + .5, X7 = X6 + .5, X8 = X7 + 1.0, XLEN = X8 + 1.4, TX = 288;
    function toss(t, st) {
      var r = { h: 0, w: 0, face: -90, pose: {} }, Pk = [TX - 14 * K, GY + (146 - 218) * K];
      if (t < X0) Object.assign(r, walkIn(t, st, TX));
      else if (t < X1) { r.cx = TX; r.w = Math.max(0, 1 - (t - X0) / .2); }
      else if (t < X2) { r.cx = TX; r.pose.near = { m: E((t - X1) / .4), at: Pk }; }
      else if (t < X3) { r.cx = TX; r.pose.near = { m: 1, at: swing(Pk, [TX - 12, GY - 50], (t - X2) / .3, 0, -4) }; r.coin = 'hand'; }
      else if (t < X4) { r.cx = TX; var f = (t - X3) / .22; r.pose.near = { m: 1, at: swing([TX - 12, GY - 50], [TX - 22, GY - 92], f, 0, 0) }; r.coin = f < .8 ? 'hand' : null; r.expr = 'grin';
        if (f >= .8) r.fly = (f - .8) / .2 * .05; }
      else if (t < X5) { r.cx = TX; r.pose.near = { m: 1 - E((t - X4) / .65), at: [TX - 22, GY - 92] }; r.fly = .05 + .95 * (t - X4) / .65; r.expr = 'grin'; }
      else if (t < X6) { r.cx = TX + (HOME - TX) * E((t - X5) / .5); r.w = .6 * Math.sin(Math.PI * (t - X5) / .5); }
      else if (t < X7) { r.cx = HOME; r.face = -90 + 90 * E((t - X6) / .5); }
      else if (t < X8) { r.cx = HOME; r.face = 0; var hp = (t - X7) / 1.0, on = E(CL(hp / .32)) * (1 - E(CL((hp - .7) / .3))); r.pose = { lift: st.aid ? 0 : hp < .65 && hp > .2 ? 6 * Math.sin((hp - .2) / .45 * Math.PI) : 0, far: { m: on, b: [40, 10] }, near: { m: on, b: [40, 10] } }; r.expr = 'laugh'; }
      else Object.assign(r, rest(st));
      return r;
    }
    /* no budget yet: he walks in and turns to you – nothing to save or worry about */
    var CLEN = 3.6;
    function calm(t, st) { var r = { h: 0, w: 0, face: -90, pose: {} };
      if (t < 1.8) Object.assign(r, walkIn(t, st, HOME)); else if (t < 2.0) { r.cx = HOME; r.w = Math.max(0, 1 - (t - 1.8) / .2); } else if (t < 2.5) { r.cx = HOME; r.face = -90 + 90 * E((t - 2) / .5); } else Object.assign(r, rest(st));
      return r; }
    /* his own small actions (F3), from the rest and back to it:
       polish – over to the jar, a cloth in circles on the glass, a look at the amount;
       piggy  – over to the piggy bank on the calendar block, a shake, a coin rolls out, he picks it up and puts it back in */
    var SEG = S.SEG, GO = S.GO, AT2 = S.AT, B = S.B, HOLD = S.HOLD, REST = S.REST, SIDE = S.SIDE, PIG = [139, 121];
    function walkP(r, t, a, b, t0, t1) { r.cx = a + (b - a) * SEG(t, t0, t1); r.face = b > a ? 90 : -90; r.w = Math.min(1, (t - t0) / .22, (t1 - t) / .22); }
    function polish(t, st) { var r = { h: 0, w: 0, face: 0, cx: HOME, pose: {} }, X1 = 285, hk = SIDE(1, -90);
      if (t < .4) r.face = -90 * E(t / .4); else if (t < 1.2) walkP(r, t, HOME, X1, .4, 1.2); else if (t < 5.4) { r.cx = X1; r.face = -90; }
      else if (t < 5.7) { r.cx = X1; r.face = -90 + 180 * E(SEG(t, 5.4, 5.7)); } else if (t < 6.5) walkP(r, t, X1, HOME, 5.7, 6.5); else r.face = 90 * (1 - E(SEG(t, 6.5, 6.9)));
      var W = function (u) { return [249 - 5 * Math.cos(u * Math.PI * 6), 124 + 8 * Math.sin(u * Math.PI * 6) + 10 * u]; };
      if (t >= 1.2 && t < 5.4) { r.pose[hk] = t < 1.7 ? GO(REST, AT2(W(0)), SEG(t, 1.2, 1.7), 3) : t < 4.0 ? HOLD(AT2(W(SEG(t, 1.7, 4.0)))) : t < 4.5 ? GO(AT2(W(1)), REST, SEG(t, 4.0, 4.5)) : REST;
        r.cloth = t >= 1.5 && t < 4.3 ? hk : null; r.pose.lean = .16 * Math.sin(Math.PI * SEG(t, 1.2, 4.5)) + .1 * Math.sin(Math.PI * SEG(t, 4.5, 5.4)); if (t > 4.5) r.expr = ok ? 'grin' : 'shy'; }
      return r; }
    function piggy(t, st) { var r = { h: 0, w: 0, face: 0, cx: HOME, pose: {}, pig: 'home' }, X1 = 166, hk = SIDE(1, -90), UP = B(104, 22), CO = [154, GY - 3];
      if (t < .4) r.face = -90 * E(t / .4); else if (t < 2.6) walkP(r, t, HOME, X1, .4, 2.6); else if (t < 7.6) { r.cx = X1; r.face = -90; }
      else if (t < 7.9) { r.cx = X1; r.face = -90 + 180 * E(SEG(t, 7.6, 7.9)); } else if (t < 10.1) walkP(r, t, X1, HOME, 7.9, 10.1); else r.face = 90 * (1 - E(SEG(t, 10.1, 10.5)));
      if (t >= 2.6 && t < 7.6) {
        r.pose[hk] = t < 3.1 ? GO(REST, AT2(PIG), SEG(t, 2.6, 3.1), 3) : t < 3.5 ? GO(AT2(PIG), UP, SEG(t, 3.1, 3.5)) : t < 4.5 ? HOLD(B(104 + 5 * Math.sin((t - 3.5) * 19), 22)) : t < 4.9 ? GO(UP, AT2(PIG), SEG(t, 4.5, 4.9)) :
          t < 5.5 ? GO(AT2(PIG), AT2(CO), SEG(t, 4.9, 5.5), 2) : t < 6.2 ? GO(AT2(CO), AT2([PIG[0] + 2, PIG[1] - 9]), SEG(t, 5.5, 6.2), 4) : t < 6.6 ? HOLD(AT2([PIG[0] + 2, PIG[1] - 9])) : GO(AT2([PIG[0] + 2, PIG[1] - 9]), REST, SEG(t, 6.6, 7.2));
        r.pig = t >= 3.1 && t < 4.9 ? hk : 'home';
        r.pose.lean = .34 * E(SEG(t, 5.0, 5.5)) * (1 - E(SEG(t, 5.5, 6.0))) + .1 * Math.sin(Math.PI * SEG(t, 2.6, 4.9));
        /* the coin: falls from the shaken pig, rolls along the floor, lies there, then in his hand and into the slot */
        var cq = SEG(t, 4.0, 4.4), rq = E(SEG(t, 4.4, 5.2));
        r.pcoin = t < 4.0 ? null : t < 4.4 ? [148 + 2 * cq, 112 + (GY - 3 - 112) * cq * cq] : t < 5.5 ? [150 + (CO[0] - 150) * rq, GY - 3] : t < 6.6 ? 'hand' : null; r.pk = hk; r.expr = t > 3.5 && t < 4.6 ? 'wow' : t > 6.6 ? 'grin' : null; }
      return r; }
    function pigG(x, y, deg) { var c = S.grp(x, y, deg || 0); add(c, 'ellipse', { cx: 0, cy: 0, rx: 9, ry: 6.5, fill: '#f2a3c4' }); add(c, 'ellipse', { cx: 2.5, cy: 1.5, rx: 6, ry: 4.4, fill: '#e58fb3' }); add(c, 'circle', { cx: -8.2, cy: .5, r: 2.6, fill: '#e58fb3' }); add(c, 'path', { d: 'M-5 -5.5 l1.5 -3.5 l2.5 3 Z', fill: '#e58fb3' }); add(c, 'circle', { cx: -5.4, cy: -1.6, r: .8, fill: '#3a2a2a' }); add(c, 'rect', { x: -1.5, y: -6.8, width: 5, height: 1.1, rx: .5, fill: '#7a3a55' }); [-4.5, 4.5].forEach(function (lx2) { add(c, 'rect', { x: lx2 - 1.2, y: 5, width: 2.4, height: 3, rx: 1, fill: '#e58fb3' }); }); return c; }
    var run = S.run(svg, {
      acts: [{ id: 'polish', len: 7.0, w: function () { return idle ? 2.5 : 1; } }, { id: 'piggy', len: 10.6, w: function (d) { return !ok ? 2.5 : .8; } }],
      len: ok ? (AID ? XLEN : LEN) : idle ? CLEN : WLEN, data: data,
      pick: function (st) { st.from = st.t > 0 ? HOME : 420; },
      season: { x: 352, y: 165, s: .9 },   /* a replay starts from where he rests – no teleport */
      back: function (sv) {
        /* the room: a soft floor glow, the moon, the calendar tile with the days left */
        var bg = add(sv, 'g', {});
        add(bg, 'ellipse', { cx: 215, cy: 176, rx: 150, ry: 22, class: 'sc25-floor' });
        add(bg, 'circle', { cx: 112, cy: 50, r: 9, class: 'sc25-moon' }); add(bg, 'circle', { cx: 117, cy: 46, r: 7.5, class: 'sc25-moonc' });
        var cal = add(bg, 'g', { class: 'hs-part', 'data-scgo': 'fin' });
        add(cal, 'rect', { x: 120, y: 127, width: 38, height: 38, rx: 5, class: 'sc-cal' });
        add(cal, 'path', { d: 'M120 132 Q120 127 125 127 L153 127 Q158 127 158 132 L158 136 L120 136 Z', fill: '#d96b6b' });
        if (data.daysLeft != null) S.txt(cal, { x: 139, y: 157, 'text-anchor': 'middle', class: 'sc-calt' }, String(data.daysLeft));
        /* the jar: glass, the money level (its colour says how it goes), coins in the bottom, the lid with the slot, the amount */
        var jar = add(sv, 'g', { class: 'hs-part' + (ok ? '' : ' hot'), 'data-scgo': 'fin', 'data-scact': 'main' });   /* a tap on the jar: he goes to it (a coin in, or a worried look when money is short) */
        var path = 'M' + (JX0 + 6) + ' ' + (JT + 12) + ' Q' + JX0 + ' ' + (JT + 16) + ' ' + JX0 + ' ' + (JT + 26) + ' L' + JX0 + ' ' + (JB - 10) + ' Q' + JX0 + ' ' + JB + ' ' + (JX0 + 10) + ' ' + JB + ' L' + (JX0 + JW - 10) + ' ' + JB + ' Q' + (JX0 + JW) + ' ' + JB + ' ' + (JX0 + JW) + ' ' + (JB - 10) + ' L' + (JX0 + JW) + ' ' + (JT + 26) + ' Q' + (JX0 + JW) + ' ' + (JT + 16) + ' ' + (JX0 + JW - 6) + ' ' + (JT + 12) + ' Z';
        var lvl = 6 + 66 * ratio, top = JB - lvl;
        if (ratio > 0) add(jar, 'path', { d: 'M' + (JX0 + 2) + ' ' + top.toFixed(1) + ' L' + (JX0 + JW - 2) + ' ' + top.toFixed(1) + ' L' + (JX0 + JW - 2) + ' ' + (JB - 10) + ' Q' + (JX0 + JW - 2) + ' ' + (JB - 2) + ' ' + (JX0 + JW - 10) + ' ' + (JB - 2) + ' L' + (JX0 + 10) + ' ' + (JB - 2) + ' Q' + (JX0 + 2) + ' ' + (JB - 2) + ' ' + (JX0 + 2) + ' ' + (JB - 10) + ' Z', class: 'sc-money ' + (data.state || 'ok') });
        /* a small pile of coins on the bottom (three rows, the top one shorter), under the amount */
        for (var row = 0; row < 3; row++) for (var ci = 0; ci < 5 - row; ci++) { var cy = JB - 7 - row * 3.6; if (JB - cy < lvl - 3) add(jar, 'ellipse', { cx: JX0 + JW / 2 + (ci - (4 - row) / 2) * 11 + (row % 2) * 2, cy: cy, rx: 4.6, ry: 1.7, fill: '#f2c94c', stroke: '#c99a1a', 'stroke-width': .6 }); }
        add(jar, 'path', { d: path, class: 'sc-jarg' });
        add(jar, 'rect', { x: JX0 + 13, y: JT, width: JW - 26, height: 13, rx: 4, class: 'sc-lid' });
        add(jar, 'rect', { x: SL - 8, y: JT + 4, width: 16, height: 3.2, rx: 1.6, fill: '#2a1a12' });
        if (data.left != null) S.txt(jar, { x: JX0 + JW / 2, y: JT + 46, 'text-anchor': 'middle', class: 'sc25-amt' }, S.kr(data.left));
        /* the ladder: far rail and rungs behind him, the near rail in front once he is on it */
        var lg = add(sv, 'g', {});
        add(lg, 'line', { x1: LB[0] + 3, y1: LB[1], x2: LT[0] + 3, y2: LT[1], stroke: '#7d8690', 'stroke-width': 2.6, 'stroke-linecap': 'round' });
        for (var rr = 1; rr <= 4; rr++) { var hy = rr * RUNG, x = lx(hy); add(lg, 'line', { x1: x - 3, y1: LB[1] - hy, x2: x + 3, y2: LB[1] - hy, stroke: '#b9c1ca', 'stroke-width': 2.2, 'stroke-linecap': 'round' }); }
        nearRail = el('line', { x1: LB[0] - 3, y1: LB[1], x2: LT[0] - 3, y2: LT[1], stroke: '#a7b0ba', 'stroke-width': 2.6, 'stroke-linecap': 'round' });
      },
      render: function (sv, t, st) {
        st.aid = AID; var r = st.pact === 'polish' ? polish(t, st) : st.pact === 'piggy' ? piggy(t, st) : ok ? (AID ? toss(t, st) : coin(t, st)) : idle ? calm(t, st) : worry(t, st);
        if (!r.pig || r.pig === 'home') sv.appendChild(pigG(PIG[0], PIG[1]));   /* the piggy bank lives on the calendar block */
        if (r.pcoin && typeof r.pcoin === 'object') add(sv, 'ellipse', { cx: r.pcoin[0].toFixed(1), cy: r.pcoin[1].toFixed(1), rx: 2.6, ry: 2.6 * Math.abs(Math.cos(r.pcoin[0] / 3)) + .5, fill: '#f2c94c', stroke: '#c99a1a', 'stroke-width': .7 });
        /* him: the near rail goes in front of his far side, behind his near side */
        var gg = add(sv, 'g', { class: 'sc25-me' }), pose = r.pose, ph = S.LIFE(st, pose, r.w);
        var look = S.look(); if (r.expr) look = Object.assign({}, look, { expr: r.expr });
        var H = S.FIG(gg, { st: st, look: look, face: r.face, cx: r.cx, gy: GY - r.h, k: K, ph: ph, w: r.w, pose: pose, shX: r.h > 0 ? lx(0) + 12 : r.cx, ground: GY, shS: 1 - Math.min(.4, r.h / 120),
          extra: [[.45, nearRail]], items: function (H2) { var o2 = [], ph2 = r.pig && r.pig !== 'home' && H2[r.pig], ch2 = r.cloth && H2[r.cloth], kh = r.pcoin === 'hand' && H2[r.pk];
            if (ph2) o2.push([ph2.z + .05, pigG(ph2.X - 2, ph2.Y + 1, 8 * Math.sin(t * 19))]);
            if (ch2) o2.push([ch2.z + .05, (function () { var c = S.grp(ch2.X, ch2.Y, 12); add(c, 'rect', { x: -5, y: -3.4, width: 10, height: 6.8, rx: 1.6, fill: '#9ad0e8' }); return c; })()]);
            if (kh) o2.push([kh.z + .05, (function () { var c = el('g', {}); add(c, 'circle', { cx: kh.X.toFixed(1), cy: (kh.Y - 1).toFixed(1), r: 2.6, fill: '#f2c94c', stroke: '#c99a1a', 'stroke-width': .7 }); return c; })()]);
            return o2; } });
        if (r.coin === 'hand' && H.near && r.fly == null && data.payday && !AID) { var bx = H.near.X - 1, by = H.near.Y + 5; add(sv, 'path', { d: 'M' + (bx - 6) + ' ' + (by + 5) + ' Q' + (bx - 8) + ' ' + (by - 4) + ' ' + (bx - 2.5) + ' ' + (by - 8) + ' L' + (bx + 2.5) + ' ' + (by - 8) + ' Q' + (bx + 8) + ' ' + (by - 4) + ' ' + (bx + 6) + ' ' + (by + 5) + ' Q' + bx + ' ' + (by + 8) + ' ' + (bx - 6) + ' ' + (by + 5) + ' Z', fill: '#c9a46a' }); add(sv, 'rect', { x: bx - 3, y: by - 9.4, width: 6, height: 2, rx: 1, fill: '#7a5a2e' }); add(sv, 'circle', { cx: bx, cy: by - 1, r: 2.2, fill: '#f2c94c' }); }   /* payday: a whole bag of coins hangs from his hand up the ladder */
        else if (r.coin === 'hand' && H.near && r.fly == null) add(sv, 'ellipse', { cx: H.near.X - 1, cy: H.near.Y - 3, rx: 3, ry: 3, fill: '#f2c94c', stroke: '#c99a1a', 'stroke-width': .8 });
        /* the tossed coin: from where it left the hand, up over the lid and down through the slot */
        if (r.fly != null) { if (!st.rel && H.near) st.rel = [H.near.X, H.near.Y]; var A = st.rel || [TX - 22, GY - 92], q2 = Math.min(1, r.fly), cxp = A[0] + (SL - A[0]) * q2, cyp = A[1] + (JT + 2 - A[1]) * q2 - 46 * Math.sin(Math.PI * Math.min(1, q2 * 1.05));
          if (q2 < 1) add(sv, 'ellipse', { cx: cxp.toFixed(1), cy: cyp.toFixed(1), rx: 3, ry: 3 * Math.abs(Math.cos(q2 * 9)) + .6, fill: '#f2c94c', stroke: '#c99a1a', 'stroke-width': .8 }); }
        else st.rel = null;
        st.H = H; st.r = r;
        if (typeof r.coin === 'number') { (data.payday && !AID ? [0, .18, .36] : [0]).forEach(function (dl) { var q = Math.max(0, Math.min(1, r.coin * 1.36 - dl)); if (q > 0 && q < 1) add(sv, 'ellipse', { cx: SL, cy: JT - 5 + 9 * q * q, rx: 3 * (1 - q * .5), ry: 2, fill: '#f2c94c', stroke: '#c99a1a', 'stroke-width': .8 }); else if (!dl && !(data.payday && !AID)) add(sv, 'ellipse', { cx: SL, cy: JT - 5 + 9 * r.coin * r.coin, rx: 3 * (1 - r.coin * .5), ry: 2, fill: '#f2c94c', stroke: '#c99a1a', 'stroke-width': .8 }); }); }   /* payday: three coins pour in, one after the other */
      }
    });
    return run;
  };
})();
