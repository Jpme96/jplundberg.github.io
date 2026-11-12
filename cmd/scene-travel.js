/* The Travel picture in 2.5D (Phase F2) – ported from the preview JP picked ("Scenes in 2.5D"):
   waves from the window, off it goes – and later he comes back home..
   Built on scene25.js (the runner, helpers, your look) and Fig25 (the body). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.travel = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, CL = S.CL, SEG = S.SEG, LERP = S.LERP, MIX = S.MIX, AT = S.AT, B = S.B, GO = S.GO, HOLD = S.HOLD, SIDE = S.SIDE, LEG = S.LEG,
      REST = S.REST, grp = S.grp, CLOCK = S.CLOCK, FLOOR = S.FLOOR, STAR = S.STAR, CHEER = S.CHEER;
    data = data || {};
    if (data.journey) return journey(svg, data);
    if (!data.trip) return null;   /* no trip planned: the still picture */
    return S.run(svg, { hits: [[0, 120, 120, 80, 'trips']], len: 17, data: data, render: function (sv, t, st) {
      var now = st.now || 0, LIFE = window.Scene25.LIFE;   /* (a scene may use S for its own things) */
      function FIG(par, o) { o.st = st; o.k = o.k || .5; if (o.look === 'iago') o.look = 'partner'; return window.Scene25.FIG(par, o); }
      var V = /^(bus|train|plane|ferry)$/.test(data.veh || '') ? data.veh : 'plane', g = add(sv, 'g', {});
      var KIND = { bus: 'step', train: 'step', plane: 'stairs', ferry: 'ramp' }[V];
      /* ---- where things are for each vehicle ---- */
      var WAIT = { bus: 196, train: 170, plane: 112, ferry: 104 }[V];
      var vx = 0, door = 0, stx = 0, px = 0, py = 0, prot = 0, bob = 0;
      /* arrival 4.6–6.6, door 6.6–7.0 open, 12.2–12.5 shut, leaving 12.6–14.6 */
      var arr = Math.pow(1 - SEG(t, 4.6, 6.6), 2), lv = SEG(t, 12.6, 14.6);
      if (V === 'bus') vx = t < 12.6 ? 120 + 320 * arr : 120 - 600 * lv * lv;
      if (V === 'train') vx = t < 12.6 ? 70 + 420 * arr : 70 - 900 * lv * lv;
      if (V === 'ferry') { vx = t < 12.6 ? 150 + 300 * arr : 150 + 420 * lv * lv; bob = 1.2 * Math.sin(now / 700); }
      if (V === 'plane') { stx = t < 12.5 ? -260 * arr : -300 * E(SEG(t, 12.5, 13.3)); var tq = SEG(t, 13.0, 14.6); px = -520 * tq * tq; py = -150 * Math.pow(SEG(t, 13.7, 14.6), 2); prot = 10 * E(SEG(t, 13.6, 14.2)); }
      if (t >= 14.6 && V !== 'plane') vx = V === 'ferry' ? 900 : -900;
      door = t < 6.6 ? 0 : t < 7.0 ? E(SEG(t, 6.6, 7.0)) : t < 12.2 ? 1 : t < 12.5 ? 1 - E(SEG(t, 12.2, 12.5)) : 0;
      var DX = { bus: vx + 143, train: vx + 164, plane: 247, ferry: vx + 54 }[V];
      var FLOOR = { bus: 184, train: 180, plane: 140, ferry: 142 }[V];
      /* the ground he stands on: the pavement, the plane's stairs, the ferry's gangway */
      function groundAt(x) {
        if (V === 'plane' && t < 12.5) { var b0 = 168 + stx; if (x <= b0) return 198; if (x >= b0 + 60) return 140; return 198 - (x - b0) * 58 / 60; }
        if (V === 'ferry' && t < 12.6) { var g0 = vx - 30; if (x <= g0) return 198; if (x >= vx + 54) return 142; return 198 - (x - g0) * 56 / 84; }
        return 198;
      }
      /* ---- the place: houses / a station / the airport / the harbour ---- */
      if (V === 'bus' || V === 'train') [[20, 70, 50], [76, 54, 40], [122, 80, 46], [324, 62, 56]].forEach(function (b2) { add(g, 'rect', { x: b2[0], y: b2[1], width: b2[2], height: 160 - b2[1], fill: 'rgba(255,255,255,.06)' }); });
      if (V === 'bus') { add(g, 'rect', { x: 0, y: 160, width: 400, height: 34, fill: '#3a3f4a' }); add(g, 'rect', { x: 0, y: 176, width: 400, height: 2, fill: 'rgba(255,255,255,.25)' }); }
      if (V === 'train') { add(g, 'rect', { x: 0, y: 164, width: 400, height: 30, fill: '#2a2d33' }); for (var sx2 = 4; sx2 < 400; sx2 += 12) add(g, 'rect', { x: sx2, y: 186, width: 6, height: 4, fill: '#5a4636' }); [188, 192].forEach(function (ry) { add(g, 'line', { x1: 0, y1: ry, x2: 400, y2: ry, stroke: '#9aa3ad', 'stroke-width': 1.4 }); }); }
      if (V === 'plane') { add(g, 'rect', { x: 0, y: 70, width: 150, height: 92, fill: 'rgba(255,255,255,.07)' }); for (var tw = 8; tw < 146; tw += 14) add(g, 'rect', { x: tw, y: 80, width: 10, height: 50, fill: 'rgba(170,215,235,.12)' }); add(g, 'rect', { x: 0, y: 160, width: 400, height: 36, fill: '#3a3f4a' }); for (var lx2 = 10; lx2 < 400; lx2 += 40) add(g, 'rect', { x: lx2, y: 176, width: 20, height: 2, fill: '#f2c94c', opacity: .6 }); }
      if (V === 'ferry') { add(g, 'path', { d: 'M0 128 Q60 110 120 124 T260 118 T400 126 L400 140 L0 140 Z', fill: 'rgba(255,255,255,.08)' }); add(g, 'rect', { x: 0, y: 136, width: 400, height: 60, fill: '#16324a' });
        for (var wv = 0; wv < 6; wv++) { var wy = 146 + wv * 8, off = (now / 60 + wv * 23) % 40; add(g, 'path', { d: 'M' + (-40 + off) + ' ' + wy + ' q10 -3 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0', fill: 'none', stroke: 'rgba(255,255,255,.12)', 'stroke-width': 1 }); } }
      /* the near pavement / platform / apron / quay */
      add(g, 'rect', { x: 0, y: 194, width: 400, height: 46, fill: V === 'ferry' ? '#6b6f75' : '#6c757e' }); add(g, 'rect', { x: 0, y: 194, width: 400, height: 3, fill: V === 'train' ? '#f2c94c' : '#8f9ba5' });
      /* ---- the vehicles: each drawn as a back (inside, seen through the windows) and a wall with the windows and doors ---- */
      function holes(list) { return list.map(function (r) { return 'M' + r[0] + ' ' + r[1] + ' h' + r[2] + ' v' + r[3] + ' h' + (-r[2]) + ' Z'; }).join(' '); }
      function bus(layer) {
        var x = vx, W = [[x + 26, 78, 30, 48], [x + 60, 78, 30, 48], [x + 94, 78, 30, 48], [x + 162, 78, 28, 48], [x + 194, 78, 30, 48]], D = [x + 130, 76, 26, 110];
        if (layer === 'back') { add(g, 'rect', { x: x, y: 68, width: 232, height: 120, rx: 8, fill: '#3a1216' }); [x + 30, x + 64, x + 98, x + 166, x + 198].forEach(function (s) { add(g, 'rect', { x: s, y: 112, width: 18, height: 20, rx: 3, fill: '#2f4a7a' }); }); add(g, 'rect', { x: D[0], y: 182, width: 26, height: 6, fill: '#55595f' }); return; }
        add(g, 'path', { d: 'M' + (x + 8) + ' 66 H' + (x + 224) + ' Q' + (x + 232) + ' 66 ' + (x + 232) + ' 74 V188 H' + x + ' V74 Q' + x + ' 66 ' + (x + 8) + ' 66 Z ' + holes(W.concat([D])), fill: '#d42a2f', 'fill-rule': 'evenodd' });
        add(g, 'rect', { x: x, y: 174, width: 130, height: 14, fill: '#a81f24' }); add(g, 'rect', { x: x + 156, y: 174, width: 76, height: 14, fill: '#a81f24' });
        add(g, 'rect', { x: x + 1, y: 76, width: 18, height: 70, rx: 4, fill: 'rgba(30,40,55,.85)' }); add(g, 'rect', { x: x + 4, y: 69, width: 40, height: 7, rx: 1.5, fill: '#1b1f27' }); var nt = add(g, 'text', { x: x + 12, y: 75, 'font-size': 6.5, 'font-weight': 700, fill: '#f2a93b', 'font-family': 'Inter, system-ui, sans-serif' }); nt.textContent = '31';
        W.forEach(function (r) { add(g, 'rect', { x: r[0], y: r[1], width: r[2], height: r[3], rx: 2, fill: 'rgba(170,215,235,.2)' }); });
        var dw = 13 * (1 - door); if (dw > .3) { add(g, 'rect', { x: D[0], y: D[1], width: dw, height: D[3], fill: 'rgba(60,70,90,.6)', stroke: '#2a2d33', 'stroke-width': .8 }); add(g, 'rect', { x: D[0] + 26 - dw, y: D[1], width: dw, height: D[3], fill: 'rgba(60,70,90,.6)', stroke: '#2a2d33', 'stroke-width': .8 }); }
        add(g, 'rect', { x: x + 228, y: 150, width: 4, height: 12, fill: '#ff6a5a' });
        [x + 42, x + 196].forEach(function (wx) { add(g, 'path', { d: 'M' + (wx - 14) + ' 188 a14 14 0 0 1 28 0 Z', fill: '#2a1012' }); add(g, 'circle', { cx: wx, cy: 189, r: 10, fill: '#1b1f27' }); add(g, 'circle', { cx: wx, cy: 189, r: 4, fill: '#8f9ba5' }); });
      }
      function train(layer) {
        var x = vx, D = [x + 150, 72, 28, 110], W = []; for (var wx = x + 40; wx < x + 420; wx += 34) if (Math.abs(wx - (x + 150)) > 26 && wx + 26 < x + 470) W.push([wx, 82, 26, 38]);
        if (layer === 'back') { add(g, 'rect', { x: x, y: 64, width: 480, height: 122, rx: 10, fill: '#2a2f3a' }); W.forEach(function (r) { add(g, 'rect', { x: r[0] + 4, y: 104, width: 18, height: 18, rx: 3, fill: '#7a2a2f' }); }); return; }
        add(g, 'path', { d: 'M' + (x + 30) + ' 62 H' + (x + 480) + ' V186 H' + x + ' V100 Q' + x + ' 62 ' + (x + 30) + ' 62 Z ' + holes(W.concat([D])), fill: '#c8cdd4', 'fill-rule': 'evenodd' });
        add(g, 'rect', { x: x, y: 146, width: 150, height: 10, fill: '#d42a2f' }); add(g, 'rect', { x: x + 178, y: 146, width: 302, height: 10, fill: '#d42a2f' });
        add(g, 'path', { d: 'M' + (x + 4) + ' 104 Q' + (x + 4) + ' 74 ' + (x + 30) + ' 72 L' + (x + 30) + ' 112 L' + (x + 4) + ' 112 Z', fill: 'rgba(30,40,55,.85)' });
        W.forEach(function (r) { add(g, 'rect', { x: r[0], y: r[1], width: r[2], height: r[3], rx: 3, fill: 'rgba(170,215,235,.2)' }); });
        var dw = 14 * (1 - door); if (dw > .3) { add(g, 'rect', { x: D[0], y: D[1], width: dw, height: D[3], fill: '#9aa3ad', stroke: '#6c757e', 'stroke-width': .8 }); add(g, 'rect', { x: D[0] + 28 - dw, y: D[1], width: dw, height: D[3], fill: '#9aa3ad', stroke: '#6c757e', 'stroke-width': .8 }); }
        add(g, 'rect', { x: D[0] - 2, y: 182, width: 32, height: 4, fill: '#55595f' });
        [x + 50, x + 80, x + 380, x + 410].forEach(function (wx) { add(g, 'circle', { cx: wx, cy: 188, r: 6, fill: '#1b1f27' }); });
      }
      function plane(layer) {
        var pg = el('g', { transform: 'translate(' + px.toFixed(1) + ' ' + py.toFixed(1) + ') rotate(' + prot.toFixed(1) + ' 420 142)' }); g.appendChild(pg);
        if (layer === 'back') { add(pg, 'path', { d: 'M300 132 L470 168 L470 150 L330 122 Z', fill: '#9aa3ad' }); add(pg, 'ellipse', { cx: 380, cy: 156, rx: 22, ry: 9, fill: '#c8cdd4' }); add(pg, 'rect', { x: 232, y: 54, width: 30, height: 86, fill: '#2a2f3a' }); return; }
        add(pg, 'path', { d: 'M470 22 H232 Q190 22 186 70 Q184 118 216 142 H470 Z M232 54 h30 v86 h-30 Z', fill: '#eef1f4', 'fill-rule': 'evenodd' });
        add(pg, 'path', { d: 'M216 142 H470 V122 H196 Q204 136 216 142 Z', fill: '#c8cdd4' }); add(pg, 'rect', { x: 262, y: 74, width: 208, height: 6, fill: '#2a5a9a' }); add(pg, 'rect', { x: 186, y: 74, width: 46, height: 6, fill: '#2a5a9a' });
        add(pg, 'path', { d: 'M196 48 Q200 40 214 38 L222 38 L220 50 Z', fill: 'rgba(30,40,55,.85)' });
        for (var wx = 280; wx < 470; wx += 22) add(pg, 'rect', { x: wx, y: 56, width: 9, height: 12, rx: 4.5, fill: 'rgba(30,40,55,.7)' });
        if (door < 1) add(pg, 'rect', { x: 232, y: 54, width: 30, height: 86 * (1 - door), rx: 3, fill: '#e2e6ea', stroke: '#b9c1ca', 'stroke-width': 1 });
        add(pg, 'rect', { x: 232, y: 54, width: 30, height: 86, rx: 3, fill: 'none', stroke: '#b9c1ca', 'stroke-width': 1.2 });
      }
      function stairs() {
        if (stx < -250) return; var x = stx; add(g, 'rect', { x: x + 150, y: 184, width: 86, height: 10, rx: 2, fill: '#e8eaed' }); [x + 160, x + 226].forEach(function (wx) { add(g, 'circle', { cx: wx, cy: 195, r: 4, fill: '#1b1f27' }); });
        add(g, 'path', { d: 'M' + (x + 168) + ' 198 L' + (x + 228) + ' 140 L' + (x + 238) + ' 140 L' + (x + 238) + ' 184 L' + (x + 196) + ' 184 Z', fill: '#d7dee3' });
        for (var s = 0; s < 8; s++) { var sxx = x + 168 + s * 7.5, sy = 198 - s * 7.25; add(g, 'line', { x1: sxx, y1: sy, x2: sxx + 7.5, y2: sy, stroke: '#8f9ba5', 'stroke-width': 1.2 }); }
      }
      function stairsRail() { if (stx < -250) return; var x = stx; add(g, 'path', { d: 'M' + (x + 166) + ' 180 L' + (x + 228) + ' 120 L' + (x + 240) + ' 120', fill: 'none', stroke: '#9aa3ad', 'stroke-width': 1.8 }); add(g, 'line', { x1: x + 166, y1: 180, x2: x + 168, y2: 198, stroke: '#9aa3ad', 'stroke-width': 1.6 }); }
      function ferry(layer) {
        var x = vx, b = bob;
        if (layer === 'back') {
          add(g, 'rect', { x: x + 60, y: 82 + b, width: 200, height: 58, rx: 4, fill: '#eef1f4' }); for (var wx = x + 70; wx < x + 250; wx += 26) add(g, 'rect', { x: wx, y: 92 + b, width: 18, height: 18, rx: 3, fill: 'rgba(30,40,55,.75)' });
          add(g, 'rect', { x: x + 100, y: 62 + b, width: 80, height: 20, rx: 4, fill: '#dfe5ea' }); add(g, 'rect', { x: x + 108, y: 66 + b, width: 64, height: 9, rx: 2, fill: 'rgba(30,40,55,.8)' });
          add(g, 'rect', { x: x + 200, y: 44 + b, width: 16, height: 20, fill: '#d42a2f' });
          add(g, 'path', { d: 'M' + x + ' ' + (140 + b) + ' H' + (x + 330) + ' L' + (x + 310) + ' ' + (190 + b) + ' H' + (x + 16) + ' Z', fill: '#eef1f4' }); add(g, 'rect', { x: x + 8, y: 166 + b, width: 316, height: 7, fill: '#2a5a9a' });
          return;
        }
        /* the rail on the deck, in front of anyone standing there – with a gap at the gangway */
        add(g, 'line', { x1: x + 2, y1: 128 + b, x2: x + 48, y2: 128 + b, stroke: '#9aa3ad', 'stroke-width': 1.6 }); add(g, 'line', { x1: x + 62, y1: 128 + b, x2: x + 328, y2: 128 + b, stroke: '#9aa3ad', 'stroke-width': 1.6 });
        for (var pxx = x + 4; pxx < x + 328; pxx += 10) if (pxx < x + 48 || pxx > x + 62) add(g, 'line', { x1: pxx, y1: 128 + b, x2: pxx, y2: 141 + b, stroke: '#9aa3ad', 'stroke-width': 1 });
        if (t < 12.6) { add(g, 'path', { d: 'M' + (x - 30) + ' 199 L' + (x + 54) + ' 143 L' + (x + 60) + ' 143 L' + (x - 22) + ' 199 Z', fill: '#c8cdd4' }); add(g, 'line', { x1: x - 30, y1: 186, x2: x + 54, y2: 130, stroke: '#9aa3ad', 'stroke-width': 1.2 }); }
      }
      /* ---- him ---- */
      var cx = -30, face = 90, w = 0, pose = {}, h = 0, inside = false, gone = false, suit = 'pull', sx = WAIT - 22, sitIn = null, carry = false, GND = 198;
      var PASS = B(100, 24), nh90 = SIDE(-1, 90), fh90 = SIDE(1, 90);
      if (t < 2.4) { cx = LERP(-30, WAIT, SEG(t, 0, 2.4)); w = Math.min(1, t / .2, (2.4 - t) / .2); pose[fh90] = HOLD(B(150, -14)); }   /* pulling the suitcase by its handle all the way */
      else if (t < 7.4) { cx = WAIT; suit = t < 2.6 ? 'pull' : 'stand'; var SH = [WAIT - 20, 160];
        if (t < 2.8) pose[fh90] = GO(B(150, -14), AT(SH), SEG(t, 2.4, 2.8)); else if (t < 3.1) pose[fh90] = GO(AT(SH), REST, SEG(t, 2.8, 3.1));
        if (t >= 3.1 && t < 4.8) pose[nh90] = t < 3.5 ? GO(REST, PASS, SEG(t, 3.1, 3.5)) : t < 4.4 ? HOLD(PASS) : GO(PASS, REST, SEG(t, 4.4, 4.8));
        face = t < 4.8 ? 90 : t < 5.2 ? 90 * (1 - E(SEG(t, 4.8, 5.2))) : t < 7.0 ? 0 : 90 * E(SEG(t, 7.0, 7.4));
        if (t >= 7.0) { pose[SIDE(1, face)] = GO(REST, AT(SH), SEG(t, 7.0, 7.4)); suit = 'stand'; } }
      else {
        /* to the door / the stairs / the gangway */
        var BX = KIND === 'step' ? DX - 14 : KIND === 'stairs' ? 166 : vx - 36;
        if (t < 8.4) { cx = LERP(WAIT, BX, SEG(t, 7.4, 8.4)); w = Math.min(1, (t - 7.4) / .2, (8.4 - t) / .2); pose[fh90] = t < 7.7 ? GO(AT([WAIT - 20, 160]), B(150, -14), SEG(t, 7.4, 7.7)) : HOLD(B(150, -14)); }   /* from the handle where he took it into the pulling hold – no snap */
        else if (KIND === 'step') {
          /* the suitcase up first: stood upright in front of him, then lifted by its handle onto the floor inside the door */
          var UPR = [BX + 8, 151], INF = [DX + 6, FLOOR - 47];
          if (t < 9.6) { cx = BX; pose[fh90] = t < 8.8 ? GO(B(150, -14), AT(UPR), SEG(t, 8.4, 8.8)) : t < 9.3 ? GO(AT(UPR), AT(INF), SEG(t, 8.8, 9.3), 8) : GO(AT(INF), REST, SEG(t, 9.3, 9.6));
            suit = t < 8.8 ? 'hand' : t < 9.3 ? 'hand' : 'in'; pose.lean = .25 * E(SEG(t, 8.4, 8.8)) * (1 - E(SEG(t, 9.3, 9.6))); }
          else if (t < 10.5) { suit = 'in'; var q1 = SEG(t, 9.6, 10.1), q2 = SEG(t, 10.1, 10.5); cx = LERP(BX, DX + 2, E(SEG(t, 9.6, 10.5))); h = 8 * E(q1) + (198 - FLOOR - 8) * E(q2); w = .5; inside = t > 9.95; }
          else if (t < 11.5) { suit = 'in'; inside = true; h = 198 - FLOOR; face = t < 10.9 ? 90 - 180 * E(SEG(t, 10.5, 10.9)) : -90; var SEAT = DX - 40; cx = t < 10.9 ? DX + 2 : LERP(DX + 2, SEAT, SEG(t, 10.9, 11.5)); w = t < 10.9 ? 0 : 1; }
          else { suit = 'in'; inside = true; cx = DX - 40; var sq = E(SEG(t, 11.5, 11.8)); face = -90 + 90 * sq; h = 198 - FLOOR - 10 * sq; sitIn = true;
            var wvk = SIDE(-1, 0), WV = B(44, 10); if (t >= 11.8 && t < 12.9) pose[wvk] = t < 12.1 ? GO(REST, WV, SEG(t, 11.8, 12.1)) : t < 12.6 ? HOLD(B(44, 10 + 9 * Math.sin((t - 12.1) * 16))) : GO(WV, REST, SEG(t, 12.6, 12.9)); }
        } else if (KIND === 'stairs') {
          /* picks the suitcase up by its handle and carries it up the stairs, waves at the top, goes in */
          if (t < 8.8) { cx = BX; pose[fh90] = GO(B(150, -14), B(136, 12), SEG(t, 8.4, 8.8)); suit = 'carry'; }
          else if (t < 10.6) { suit = 'carry'; cx = LERP(BX, 244, SEG(t, 8.8, 10.6)); w = .85 * Math.min(1, (t - 8.8) / .2, (10.6 - t) / .2); pose[fh90] = HOLD(B(136, 12)); pose.lean = .12; }
          else if (t < 11.8) { suit = 'carry'; cx = 244; face = t < 11.0 ? 90 * (1 - E(SEG(t, 10.6, 11.0))) : 0; pose[SIDE(1, face)] = HOLD(B(136, 12));
            var wk2 = SIDE(-1, 0), WV2 = B(44, 10); if (t >= 11.0) pose[wk2] = t < 11.2 ? GO(REST, WV2, SEG(t, 11.0, 11.2)) : t < 11.6 ? HOLD(B(44, 10 + 9 * Math.sin((t - 11.2) * 16))) : GO(WV2, REST, SEG(t, 11.6, 11.8)); }
          else if (t < 12.2) { suit = 'carry'; face = 90 * E(SEG(t, 11.8, 12.2)); cx = LERP(244, 250, SEG(t, 12.0, 12.2)); inside = t > 12.1;   /* turns to the door (it was a quarter turn too far and too quick) */ pose[SIDE(1, face)] = HOLD(B(136, 12)); }
          else gone = true;
        } else {
          /* up the gangway pulling the suitcase, onto the deck, to the rail, a wave */
          if (t < 8.8) { cx = BX; pose[fh90] = GO(B(150, -14), B(136, 12), SEG(t, 8.4, 8.8)); suit = 'carry'; }
          else if (t < 10.0) { suit = 'carry'; cx = LERP(BX, vx + 58, SEG(t, 8.8, 10.0)); w = .85; pose[fh90] = HOLD(B(136, 12)); pose.lean = .1; }
          else if (t < 10.6) { suit = 'carry'; cx = LERP(vx + 58, vx + 100, SEG(t, 10.0, 10.6)); w = Math.min(1, (10.6 - t) / .2); inside = true; pose[fh90] = HOLD(B(136, 12)); }
          else { inside = true; cx = vx + 100; face = t < 11.0 ? 90 * (1 - E(SEG(t, 10.6, 11.0))) : 0; suit = 'deck';
            var wk3 = SIDE(-1, 0), WV3 = B(44, 10); if (t >= 11.0 && t < 12.4) pose[wk3] = t < 11.3 ? GO(REST, WV3, SEG(t, 11.0, 11.3)) : t < 12.1 ? HOLD(B(44, 10 + 9 * Math.sin((t - 11.3) * 16))) : GO(WV3, REST, SEG(t, 12.1, 12.4)); }
        }
        /* the journey: he goes with the vehicle; back home later */
        if (t >= 12.6 && KIND !== 'stairs' && inside) { cx = (KIND === 'step' ? DX - 40 : vx + 100); }
        if (t >= 14.6) { inside = false; gone = false; sitIn = null; h = 0; suit = 'pull'; cx = LERP(430, 200, SEG(t, 14.6, 16.6)); face = -90; w = Math.min(1, (t - 14.6) / .2, (16.6 - t) / .2); pose = {}; pose[SIDE(-1, -90)] = HOLD(B(150, -14));
          if (t >= 16.6) { cx = 200; face = -90 + 90 * E(SEG(t, 16.6, 17)); suit = 'stand'; sx = 222; pose = {}; if (t < 16.95) pose[SIDE(-1, face)] = GO(B(150, -14), REST, SEG(t, 16.6, 16.95)); } }   /* lets go of the handle, then turns to you */
      }
      if (t >= 14.6) gone = false;
      if (t < 7.4 || t >= 14.6 || (t >= 7.4 && t < 8.4)) { /* walking on the flat */ }
      GND = groundAt(cx); if (KIND === 'stairs' && t >= 8.8 && t < 12.2) h = 198 - GND; if (KIND === 'ramp' && t >= 8.4 && t < 14.6) h = inside ? 198 - (142 + bob) : 198 - groundAt(cx);
      var ph = LIFE(st, pose, w);
      function suitcase(x, y, deg, s) { var c = grp(x, y, deg, s || 1); add(c, 'rect', { x: -11, y: -33, width: 22, height: 31, rx: 4, fill: '#d96b6b' }); add(c, 'rect', { x: -11, y: -21, width: 22, height: 3, fill: 'rgba(0,0,0,.18)' }); add(c, 'line', { x1: 0, y1: -33, x2: 0, y2: -47, stroke: '#3a3f4a', 'stroke-width': 2 }); add(c, 'rect', { x: -4, y: -49, width: 8, height: 3, rx: 1.5, fill: '#3a3f4a' }); add(c, 'circle', { cx: -7, cy: -1, r: 2.3, fill: '#2a2d33' }); add(c, 'circle', { cx: 7, cy: -1, r: 2.3, fill: '#2a2d33' }); return c; }
      function carryCase(x, y) { var c = grp(x, y, 0); add(c, 'rect', { x: -4, y: -1, width: 8, height: 3, rx: 1.5, fill: '#3a3f4a' }); add(c, 'rect', { x: -10, y: 2, width: 20, height: 27, rx: 4, fill: '#d96b6b' }); add(c, 'rect', { x: -10, y: 13, width: 20, height: 3, fill: 'rgba(0,0,0,.18)' }); return c; }
      /* draw: the back of the vehicle, then (outside) its wall and him, or (inside) him and then the wall over him */
      var drawV = { bus: bus, train: train, plane: plane, ferry: ferry }[V], onScreen = V === 'plane' ? px > -700 && py > -260 : vx > -560 && vx < 430;
      if (V === 'plane') { if (onScreen) plane('back'); stairs(); }
      else if (onScreen) drawV('back');
      if (V !== 'plane' && onScreen && !inside) drawV('wall');
      if (V === 'plane' && onScreen && !inside) plane('wall');
      if (suit === 'stand') g.appendChild(suitcase(sx, 199, 0));
      if (suit === 'in' && KIND === 'step' && onScreen && t < 14.6) g.appendChild(suitcase(DX + 6, FLOOR, 0));
      var figPar = g;
      if (inside && onScreen && KIND !== 'ramp') { var cpd = add(g, 'defs', {}), cp = add(cpd, 'clipPath', { id: 'tvClip' });
        if (V === 'plane') add(cp, 'rect', { x: 190 + px, y: 22 + py, width: 280, height: 120 }); else add(cp, 'rect', { x: vx, y: 60, width: V === 'bus' ? 232 : 480, height: (V === 'bus' ? 188 : 186) - 60 });
        figPar = add(g, 'g', { 'clip-path': 'url(#tvClip)' }); }
      if (!gone) FIG(figPar, { cx: cx, gy: 200 - h, ground: 200 - h, face: face, ph: ph, w: w, pose: pose, noShadow: inside && KIND !== 'ramp', items: function (H) {
        var out = [], hs = face > 0 ? H.s1 : H.sm;
        if ((suit === 'pull') && hs) { var dir = face >= 0 ? 1 : -1, gw = groundAt(hs.X - dir * 30) + 1, c = Math.max(-1, Math.min(1, (gw - hs.Y) / 47)), th = Math.acos(c), wx = hs.X - dir * 47 * Math.sin(th); out.push([-100, suitcase(wx, gw, dir * th * 180 / Math.PI)]); }
        if (suit === 'hand' && H.s1) out.push([H.s1.z - .05, suitcase(H.s1.X, H.s1.Y + 48, 0)]);
        if (suit === 'carry' && H.s1) out.push([H.s1.z + (face > 100 ? -.05 : .05), carryCase(H.s1.X, H.s1.Y)]);
        if (t >= 3.4 && t < 4.5 && H.sm) { var ps = grp(H.sm.X, H.sm.Y - 3, -8); if (V === 'plane') { add(ps, 'rect', { x: -5, y: -7, width: 10, height: 13, rx: 1.5, fill: '#7a2e3a' }); add(ps, 'circle', { cx: 0, cy: -1, r: 2.4, fill: 'none', stroke: '#f2c94c', 'stroke-width': .8 }); } else { add(ps, 'rect', { x: -3.5, y: -6.5, width: 7, height: 13, rx: 1.5, fill: '#1b1f27' }); add(ps, 'rect', { x: -2.6, y: -5.5, width: 5.2, height: 10, rx: 1, fill: '#9ad0e8' }); } out.push([H.sm.z - .15, ps]); }
        return out; } });
      if (inside && onScreen) { if (V === 'plane') plane('wall'); else drawV('wall'); }
      if (V === 'plane') stairsRail();
      /* the stop sign stands on the near pavement, in front of the bus */
      if (V === 'bus' && t < 14.6 || V === 'bus' && t >= 16.6) { add(g, 'rect', { x: 148, y: 120, width: 3, height: 78, fill: '#9aa3ad' }); add(g, 'circle', { cx: 149.5, cy: 116, r: 9, fill: '#3987e5' }); add(g, 'rect', { x: 144.5, y: 111, width: 10, height: 8, rx: 2, fill: '#fff' }); add(g, 'rect', { x: 145.5, y: 112, width: 8, height: 3.4, rx: .8, fill: '#3987e5' }); }
      if (V === 'ferry' && t >= 10.6 && t < 14.6 && onScreen) g.appendChild(suitcase(vx + 82, 142 + bob, 0, .9));
    } });
  };

  /* ---------- the Journey (F3): the whole round trip as a film in 2.5D – out of the door, each ride of your last search
     pulls in at its stop and takes you, you arrive and the light goes on; then the opposite way home. 5 s a part.
     The rides and places are SceneArt's drawings (scenes.js) at life size: a bus about 1.7× your height, a door a bit
     taller than you. ---------- */
  var JOURNEY = { SC: 2.6, K: .32 };   /* the art's scale and your size on the Journey (scene-sizes measures them) */
  window.SceneLive.journeySize = JOURNEY;
  function journey(svg, data) {
    var S = window.Scene25, add = S.add, E = S.E, SEG = S.SEG, LERP = S.LERP, A = window.SceneArt; if (!A) return null;
    var legs = (data.legs || []).filter(function (m) { return A.VEH[m]; }); if (!legs.length) legs = ['bus'];
    var toWork = data.toWork !== false, PA = !toWork, PB = toWork;   /* true = work, false = home */
    var slots = [{ k: 'leave', w: PA }].concat(legs.map(function (m) { return { k: 'ride', m: m }; }), [{ k: 'arrive', w: PB }, { k: 'leave', w: PB }], legs.slice().reverse().map(function (m) { return { k: 'ride', m: m }; }), [{ k: 'arrive', w: PA }]);
    var SL = 5, SC = JOURNEY.SC, GY = 200, K = JOURNEY.K, cache = {};
    /* art drawn in the old 240-wide pictures, put on our ground at life size */
    function art(key, html, x, y) { var n = cache[key]; if (!n) { n = cache[key] = document.createElementNS('http://www.w3.org/2000/svg', 'g'); n.innerHTML = html; } n.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + SC + ')'); return n; }
    var Y0 = GY - 117 * SC;   /* the art's ground line (y 117) on ours */
    function place(g, work, cx, lit) {
      g.appendChild(art('pl' + work, A.place(work, 0, 'none'), cx - 191 * SC, Y0));
      if (lit) { var ws = work ? [[174, 50], [190, 61], [206, 72], [174, 83]] : [[170, 88]]; ws.forEach(function (w) { add(g, 'rect', { x: cx + (w[0] - 191) * SC, y: Y0 + w[1] * SC, width: (work ? 10 : 13) * SC, height: (work ? 7 : 11) * SC, rx: 2, fill: '#ffd56b', opacity: lit.toFixed(2) }); }); }
    }
    function doorX(work) { return (work ? 195 : 194) - 191; }   /* the door's middle, from the place's middle (art units) */
    return S.run(svg, { id: location.pathname + '#journey', gen: false, hits: [[0, 0, 400, 240, 'paneJourney']], len: slots.length * SL, data: data,
      back: function (bg) { add(bg, 'rect', { x: 0, y: GY, width: 400, height: 40, fill: 'rgba(255,255,255,.05)' }); },
      render: function (g, t, st) {
        var k = Math.min(slots.length - 1, Math.floor(t / SL)), u = (t - k * SL) / SL, sl = slots[k];
        var cx = 0, face = 0, w = 0, show = true, pose = {}, front = [];
        function walk(a, b, u0, u1) { var f = SEG(u, u0, u1); cx = LERP(a, b, f); face = b > a ? 90 : -90; w = Math.min(1, (u - u0) * SL / .2, (u1 - u) * SL / .2); }
        if (sl.k === 'leave') {
          g.appendChild(art('tr-road', A.track('road'), 0, Y0)); g.appendChild(art('tr-road2', A.track('road'), 240 * SC, Y0));
          var PX = 90, nx = (slots[k + 1] && slots[k + 1].m) || legs[0], dx = PX + doorX(sl.w) * SC;
          place(g, sl.w, PX, 1 - E(SEG(u, .1, .18)));
          g.appendChild(art('stop' + nx, A.stop(nx), 330 - 176 * SC, Y0));
          if (u < .12) { show = u > .02; cx = dx; face = 0; }
          else if (u < .2) { cx = dx; face = 90 * E(SEG(u, .12, .2)); }
          else if (u < .85) walk(dx, 312, .2, .85);
          else { cx = 312; face = 90 - 90 * E(SEG(u, .85, .95)); }
        } else if (sl.k === 'ride') {
          var m = sl.m, kind = A.kindOf(m), v = A.VEH[m], off = { tram: -18, metro: -18, rail: -28 }[m] || 0;
          g.appendChild(art('tr-' + kind, A.track(kind), 0, Y0)); g.appendChild(art('tr2-' + kind, A.track(kind), 240 * SC, Y0));
          g.appendChild(art('stop' + m, A.stop(m), 330 - 176 * SC, Y0));
          cx = 312; face = 0; show = u < .44;
          if (u > .3 && u < .44) { face = -90 * E(SEG(u, .3, .36)); w = .5; cx = LERP(312, 296, SEG(u, .34, .44)); }
          /* the ride pulls in (eases to a stop with its door at you), waits, then pulls away */
          var vx = u < .32 ? LERP(-560, 0, 1 - Math.pow(1 - SEG(u, 0, .32), 3)) : u < .56 ? 0 : 900 * Math.pow(SEG(u, .56, .9), 2);
          front.push(art('veh' + m, A.vehicle(m, v[0]), 300 - (72 + off) * SC + vx, Y0 + 3 * SC));
        } else {   /* arrive: walk in from the left to the door, in, the light comes on */
          g.appendChild(art('tr-road', A.track('road'), 0, Y0)); g.appendChild(art('tr-road2', A.track('road'), 240 * SC, Y0));
          var QX = 290, ax = QX + doorX(sl.w) * SC;
          place(g, sl.w, QX, E(SEG(u, .64, .72)));
          if (u < .55) walk(-20, ax, 0, .55); else { cx = ax; face = 90 + 90 * E(SEG(u, .55, .6)); show = u < .63; }
        }
        pose.breath = 0; var ph = S.LIFE(st, pose, w);
        if (show) S.FIG(g, { st: st, k: K, cx: cx, gy: GY, face: face, ph: ph, w: w, pose: pose });
        front.forEach(function (n) { g.appendChild(n); });
      } });
  }
})();
