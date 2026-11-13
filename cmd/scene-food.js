/* The Food picture in 2.5D (Phase F2 – the preview JP picked, "Food"). The fridge on the left (freezer drawer, the
   door hinged on its left), a counter with the hob and the pot on the right, a window, the lamp, a shelf of jars.
   What he does follows the day:
   - dinner planned tonight: he walks to the fridge, opens it, takes the milk, pushes the door shut, carries the milk
     to the pot, pours, puts the carton down, takes the spoon and stirs, then walks back and gives a happy hop;
   - nothing planned: he opens the fridge, looks in, a hand to his chin, shuts it again and turns to you.
   A shopping bag by the counter when there's something on the shopping list; the jars on the shelf run low with the
   pantry. Tapping the fridge or the pot opens the dinner plan, the jars the pantry, the bag the shopping list
   (data-scgo, scenes.js); tapping anywhere else plays it again. Built on scene25.js and Fig25. */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.food = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, CL = S.CL, SEG = S.SEG, MIX = S.MIX;
    data = data || {};
    var GY = 200, K = .5, HOME = 215, CT = 160, CX0 = 250, CX1 = 392, PX = 300, PT = 141, PB = 158, PR = 14;
    var cook = !!data.dinner;
    /* the fridge door, hinged on the left: th = 0 shut, 75° open, seen a little from above and the right */
    function doorEdge(th, f) { f = f == null ? 1 : f; return [40 + f * (72 * Math.cos(th) + 14 * Math.sin(th)), 6 * f * Math.sin(th)]; }
    function handle(th) { var d = doorEdge(th, .89); return [d[0], 140 + d[1]]; }
    var REST = { b: [156, 5] };   /* where a hanging hand rests (mid-thigh) */
    function AT(p) { return { at: p }; }
    function reach(A, B, f, up) { return { m: 1, path: [A, B], f: E(f), up: up || 0 }; }
    function key(sd, deg) { var zz = -sd * Math.sin(deg * Math.PI / 180); return zz > 1e-6 || (Math.abs(zz) <= 1e-6 && sd < 0) ? 'near' : 'far'; }
    var D = 75 * Math.PI / 180, D50 = 50 * Math.PI / 180, D20 = 20 * Math.PI / 180;
    var MILK0 = [101, 131], CARRY = [118, 22], POUR = [299, 132], DOWN = [285, 151], SPOON = [304, 132];
    var LEN = 17.6, LLEN = 8.9;
    function rest(st) { var it = st.still ? 0 : (st.now - (st.endNow || st.now)) / 1000; return Math.sin(it * .35) * 22 * Math.max(0, Math.sin(it * .13)); }
    /* the door: pulled to 50°, swings on to 75°; later pushed back to 20° and it shuts with a little bump */
    function door(t, o, c) { if (t < o) return 0; if (t < o + .7) return D50 * E(SEG(t, o, o + .7)); if (t < c) return D50 + (D - D50) * (1 - Math.pow(1 - SEG(t, o + .7, o + 1.4), 2));
      if (t < c + .8) return D + (D20 - D) * E(SEG(t, c, c + .8)); var q = SEG(t, c + .8, c + 1.02); return D20 * (1 - q * q) + (q >= 1 ? Math.sin(SEG(t, c + 1.02, c + 1.1) * Math.PI) * .02 : 0); }
    function cookAt(t, st) {
      var r = { cx: HOME, face: 0, w: 0, pose: {}, th: 0, milk: 'fridge', tilt: 0, fill: 0, stir: -1, flow: 0 }, pose = r.pose;
      if (t >= 3.5) r.milk = 'hand'; if (t >= 10.3) r.milk = 'counter';
      r.fill = t < .01 ? 0 : E(SEG(t, 8.6, 9.4));
      if (t < .4) r.face = -90 * E(t / .4);
      else if (t < 1.6) { r.face = -90; r.cx = HOME + (128 - HOME) * SEG(t, .4, 1.6); r.w = Math.min(1, (t - .4) / .2, (1.6 - t) / .2); }
      else if (t < 5.7) { r.face = -90; r.cx = 128; r.th = door(t, 1.9, 4.6);
        if (t >= 3.9 && t < 4.5) { r.cx = 128 + (100 - 128) * E(SEG(t, 3.9, 4.5)); r.w = .5 * Math.sin(Math.PI * SEG(t, 3.9, 4.5)); } else if (t >= 4.5 && t < 5.4) r.cx = 100 + (125 - 100) * E(SEG(t, 4.6, 5.4)); else if (t >= 5.4) r.cx = 125;
        var nr = key(1, -90), fr = key(-1, -90), edge = doorEdge(r.th, .85); edge = [edge[0] + 2, 142 + edge[1]];
        if (t < 1.9) pose[nr] = reach(REST, AT(handle(r.th)), SEG(t, 1.6, 1.9), 2);
        else if (t < 2.6) pose[nr] = { m: 1, at: handle(r.th) };
        else if (t < 3.0) pose[nr] = reach(AT(handle(r.th)), REST, SEG(t, 2.6, 3.0), 0);
        else if (t >= 4.2 && t < 4.6) pose[nr] = reach(REST, AT(edge), SEG(t, 4.2, 4.6), 3);
        else if (t >= 4.6 && t < 5.4) pose[nr] = { m: 1, at: edge };
        else if (t >= 5.4) pose[nr] = reach(AT(edge), REST, SEG(t, 5.4, 5.75), 0);
        if (t >= 3.0) pose[fr] = t < 3.45 ? reach(REST, AT(MILK0), SEG(t, 3.0, 3.45), 3) : t < 3.5 ? { m: 1, at: MILK0 } : t < 3.95 ? reach(AT(MILK0), { b: CARRY }, SEG(t, 3.5, 3.95), 2) : { m: 1, b: CARRY };
        pose.lean = .15 * E(SEG(t, 1.6, 1.9)) * (1 - E(SEG(t, 5.4, 5.7))); }
      else if (t < 6.3) { r.cx = 125; r.face = -90 + 180 * E(SEG(t, 5.7, 6.3)); pose[key(-1, r.face)] = { m: 1, b: CARRY }; }
      else if (t < 7.7) { r.face = 90; r.cx = 125 + (268 - 125) * SEG(t, 6.3, 7.7); r.w = Math.min(1, (t - 6.3) / .2, (7.7 - t) / .2); pose[key(-1, 90)] = { m: 1, b: CARRY }; }
      else if (t < 12.7) { r.face = 90; r.cx = 268; var nh = key(-1, 90), sp2 = SPOON;
        if (t >= 10.6 && t < 12.4) { var ang = (t - 10.6) / 1.8 * Math.PI * 2 * 3; r.stir = ang; sp2 = [SPOON[0] - 3 + 6 * Math.cos(ang), SPOON[1] + 1.8 * Math.sin(ang)]; }
        pose[nh] = t < 8.15 ? reach({ b: CARRY }, AT(POUR), SEG(t, 7.7, 8.15), 3) : t < 9.8 ? { m: 1, at: POUR }
          : t < 10.3 ? reach(AT(POUR), AT(DOWN), SEG(t, 9.8, 10.3), 4) : t < 10.6 ? reach(AT(DOWN), AT(SPOON), SEG(t, 10.3, 10.6), 3)
          : t < 12.4 ? { m: 1, at: sp2 } : reach(AT(SPOON), REST, SEG(t, 12.4, 12.7), 0);
        r.tilt = t < 8.1 ? 0 : t < 8.5 ? 115 * E(SEG(t, 8.1, 8.5)) : t < 9.4 ? 115 + 6 * Math.sin((t - 8.5) * 9) * .3 : t < 9.8 ? 115 * (1 - E(SEG(t, 9.4, 9.8))) : 0;
        r.flow = t > 8.45 && t < 9.45 ? Math.min(1, (t - 8.45) / .1, (9.45 - t) / .1) : 0;
        pose.lean = .3 * E(SEG(t, 7.7, 8.1)) * (1 - E(SEG(t, 12.4, 12.7))); r.spoonHand = t >= 10.55 && t < 12.45; }
      else if (t < 13.1) { r.cx = 268; r.face = 90 - 180 * E(SEG(t, 12.7, 13.1)); }
      else if (t < 14.0) { r.face = -90; r.cx = 268 + (HOME - 268) * SEG(t, 13.1, 14.0); r.w = Math.min(1, (t - 13.1) / .2, (14.0 - t) / .2); }
      else if (t < 14.4) { r.face = -90 + 90 * E(SEG(t, 14.0, 14.4)); }
      else if (t < 15.6) { var hp = (t - 14.4) / 1.2, on = E(CL(hp / .32)) * (1 - E(CL((hp - .7) / .3)));   /* a happy hop, both hands up */
        r.pose = { lift: hp < .2 ? -3 * Math.sin(hp / .2 * Math.PI) : hp < .65 ? 10 * Math.sin((hp - .2) / .45 * Math.PI) : 0, far: { m: on, b: [40, 10] }, near: { m: on, b: [40, 10] } }; r.expr = 'laugh'; }
      else r.face = rest(st);
      if (t >= LEN) { r.milk = 'counter'; r.fill = 1; }
      return r;
    }
    /* nothing planned: open, look in, a hand to the chin, a slow shake of the head, shut it, back to you */
    function lookAt(t, st) {
      var r = { cx: HOME, face: 0, w: 0, pose: {}, th: 0, milk: 'fridge', tilt: 0, fill: 0, stir: -1, flow: 0 }, pose = r.pose;
      var nr = key(1, -90), fr = key(-1, -90);
      if (t < .4) r.face = -90 * E(t / .4);
      else if (t < 1.6) { r.face = -90; r.cx = HOME + (128 - HOME) * SEG(t, .4, 1.6); r.w = Math.min(1, (t - .4) / .2, (1.6 - t) / .2); }
      else if (t < 5.7) { r.face = -90; r.cx = 128; r.th = door(t, 1.9, 4.6); var edge = doorEdge(r.th, .85); edge = [edge[0] + 2, 142 + edge[1]];
        if (t < 1.9) pose[nr] = reach(REST, AT(handle(r.th)), SEG(t, 1.6, 1.9), 2);
        else if (t < 2.6) pose[nr] = { m: 1, at: handle(r.th) };
        else if (t < 3.0) pose[nr] = reach(AT(handle(r.th)), REST, SEG(t, 2.6, 3.0), 0);
        else if (t >= 4.2 && t < 4.6) pose[nr] = reach(REST, AT(edge), SEG(t, 4.2, 4.6), 3);
        else if (t >= 4.6 && t < 5.4) pose[nr] = { m: 1, at: edge };
        else if (t >= 5.4) pose[nr] = reach(AT(edge), REST, SEG(t, 5.4, 5.75), 0);
        var chin = E(SEG(t, 2.8, 3.2)) * (1 - E(SEG(t, 4.0, 4.4)));
        if (chin > 0) pose[fr] = { m: chin, b: [76, 18] };
        if (t > 3.2 && t < 4.0) r.face = -90 + 14 * Math.sin((t - 3.2) / .8 * Math.PI * 2) * Math.sin((t - 3.2) / .8 * Math.PI);
        pose.lean = .2 * E(SEG(t, 1.6, 2.4)) * (1 - E(SEG(t, 5.0, 5.6))); r.expr = t > 2.8 && t < 4.6 ? 'shy' : null; }
      else if (t < 7.0) { r.face = 90; r.cx = 128 + (HOME - 128) * E(SEG(t, 5.7, 7.0)); r.w = Math.sin(Math.PI * SEG(t, 5.7, 7.0)); if (t < 5.95) r.face = -90 + 180 * E(SEG(t, 5.7, 5.95)); }
      else if (t < 7.4) r.face = 90 - 90 * E(SEG(t, 7.0, 7.4));
      else r.face = rest(st);
      return r;
    }
    /* the page's own action (F3): over to the fridge, a word on the shopping list on its door, back again – from the rest the main action left */
    function listAt(t, st) {
      var r = (cook ? cookAt : lookAt)(cook ? LEN : LLEN, st), pose = r.pose = {}; r.w = 0; r.expr = null;
      var nr = key(1, -90), NOTE = [98, 132];
      if (t < .4) r.face = -90 * E(t / .4);
      else if (t < 1.6) { r.face = -90; r.cx = HOME + (134 - HOME) * SEG(t, .4, 1.6); r.w = Math.min(1, (t - .4) / .2, (1.6 - t) / .2); }
      else if (t < 4.8) { r.face = -90; r.cx = 134;
        pose[nr] = t < 2.0 ? reach(REST, AT(NOTE), SEG(t, 1.6, 2.0), 2) : t < 4.2 ? { m: 1, at: [NOTE[0] + 3 * Math.sin((t - 2) * 9), NOTE[1] + 2 * Math.floor((t - 2) / .75)] } : reach(AT(NOTE), REST, SEG(t, 4.2, 4.6), 0);
        pose.lean = .12 * Math.sin(Math.PI * SEG(t, 1.6, 4.6)); r.pen = t >= 2.0 && t < 4.2 ? 1 + Math.floor((t - 2) / .75) : t >= 4.2 ? 4 : 0; }
      else if (t < 6.1) { r.face = 90; r.cx = 134 + (HOME - 134) * E(SEG(t, 4.8, 6.1)); r.w = Math.sin(Math.PI * SEG(t, 4.8, 6.1)); if (t < 5.05) r.face = -90 + 180 * E(SEG(t, 4.8, 5.05)); }
      else r.face = 90 - 90 * E(SEG(t, 6.1, 6.5));
      return r;
    }
    /* dinner's on: over to the pot, a taste from a spoon – mm – a shake of salt, back again */
    var SHK = [264, CT - 7];
    function tasteAt(t, st) {
      var r = cookAt(LEN, st), pose = r.pose = {}; r.w = 0; r.expr = null; var X1 = 272, POTP = [PX - 3, PT - 4], OVER = [PX - 6, PT - 15], MO = { b: [66, 26] };
      r.face = t < .4 ? 90 * E(t / .4) : t < 6.7 ? 90 : t < 6.95 ? 90 - 180 * E(SEG(t, 6.7, 6.95)) : t < 7.9 ? -90 : -90 * (1 - E(SEG(t, 7.9, 8.3)));
      r.cx = t < .4 ? HOME : t < 1.4 ? HOME + (X1 - HOME) * SEG(t, .4, 1.4) : t < 6.9 ? X1 : t < 7.9 ? X1 + (HOME - X1) * SEG(t, 6.9, 7.9) : HOME;
      r.w = t > .4 && t < 1.4 ? Math.min(1, (t - .4) / .2, (1.4 - t) / .2) : t > 6.9 && t < 7.9 ? Math.min(1, (t - 6.9) / .2, (7.9 - t) / .2) : 0;
      var hk = key(-1, 90);
      if (t >= 1.4 && t < 6.7) pose[hk] = t < 1.9 ? reach(REST, AT(POTP), SEG(t, 1.4, 1.9), 3) : t < 2.5 ? reach(AT(POTP), MO, SEG(t, 1.9, 2.5), 2) : t < 3.3 ? { m: 1, b: MO.b } : t < 3.7 ? reach(MO, AT(POTP), SEG(t, 3.3, 3.7), 2) : t < 4.1 ? reach(AT(POTP), AT(SHK), SEG(t, 3.7, 4.1), 4) : t < 4.6 ? reach(AT(SHK), AT(OVER), SEG(t, 4.1, 4.6), 3) :
        t < 5.8 ? { m: 1, at: [OVER[0] + 2 * Math.sin(t * 22), OVER[1] + Math.abs(Math.sin(t * 22))] } : t < 6.3 ? reach(AT(OVER), AT(SHK), SEG(t, 5.8, 6.3), 3) : reach(AT(SHK), REST, SEG(t, 6.3, 6.7), 2);
      r.tspoon = t >= 1.9 && t < 3.7; r.salt = t >= 4.1 && t < 6.3 ? 'hand' : 'counter'; r.grains = t > 4.7 && t < 5.8; r.expr = t > 2.5 && t < 2.9 ? 'wow' : t >= 2.9 && t < 3.7 ? 'grin' : null;
      pose.lean = .1 * Math.sin(Math.PI * SEG(t, 1.4, 2.2)) + .1 * Math.sin(Math.PI * SEG(t, 3.5, 6.5));
      return r;
    }
    /* the pantry is running low: a look up at the shelf, counting the jars with a finger, a shake of the head */
    function shelfAt(t, st) {
      var r = (cook ? cookAt : lookAt)(cook ? LEN : LLEN, st), pose = r.pose = {}; r.w = 0; r.expr = null; var hk = key(-1, 55);
      r.face = t < .5 ? 55 * E(t / .5) : t < 3.2 ? 55 : t < 4.0 ? 55 + 12 * Math.sin((t - 3.2) * 15.7) : 55 * (1 - E(SEG(t, 4.2, 4.8)));
      pose[hk] = t < .5 ? REST : t < 1.0 ? reach(REST, { b: [34, 36] }, SEG(t, .5, 1.0), 0) : t < 3.0 ? { m: 1, b: [34 + 2.5 * Math.abs(Math.sin((t - 1) * 6.3)), 36] } : t < 3.6 ? reach({ b: [34, 36] }, REST, SEG(t, 3.0, 3.6), 0) : REST;
      pose.lean = -.05 * Math.sin(Math.PI * SEG(t, .5, 3.4));
      return r;
    }
    function shaker(x, y, deg) { var c = el('g', { transform: 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (deg || 0) + ')' }); add(c, 'rect', { x: -2.6, y: -4, width: 5.2, height: 10, rx: 1.6, fill: '#eef0f2' }); add(c, 'rect', { x: -2.8, y: -6.4, width: 5.6, height: 3, rx: 1.2, fill: '#9aa3ad' }); return c; }
    /* the milk carton: white with a blue band, a gable top, the spout on its right */
    function carton(x, y, deg) { var g = el('g', { transform: 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + deg.toFixed(1) + ')' });
      add(g, 'rect', { x: -4.5, y: -8, width: 9, height: 17, rx: 1.2, fill: '#f7f7f4' }); add(g, 'rect', { x: -4.5, y: -1, width: 9, height: 5, fill: '#3987e5' });
      add(g, 'path', { d: 'M-4.5 -8 L0 -12 L4.5 -8 Z', fill: '#e4e4df' }); add(g, 'rect', { x: 2, y: -12.5, width: 3, height: 2.4, rx: .6, fill: '#3987e5' }); return g; }
    function spout(x, y, deg) { var r = deg * Math.PI / 180, px = 3.5, py = -12; return [x + px * Math.cos(r) - py * Math.sin(r), y + px * Math.sin(r) + py * Math.cos(r)]; }
    var steamA = 0;
    return S.run(svg, {
      len: cook ? LEN : LLEN, data: data,
      season: { x: 160, y: 194, s: .95 },
      acts: [{ id: 'list', len: 6.6, w: function (d) { return d.shop ? 3 : .6; } }, { id: 'taste', len: 8.4, w: function () { return cook ? 2 : 0; } }, { id: 'shelf', len: 5.0, w: function (d) { return d.low ? 2.5 : 0; } }],
      back: function (bg) {
        /* the room: the floor, a window with the night, the hanging lamp, a shelf of jars (the pantry) */
        add(bg, 'rect', { x: 0, y: GY, width: 400, height: 40, fill: 'rgba(0,0,0,.22)' });
        add(bg, 'ellipse', { cx: 210, cy: GY + 4, rx: 190, ry: 16, fill: 'rgba(255,190,120,.10)' });
        add(bg, 'rect', { x: 160, y: 40, width: 62, height: 58, rx: 6, fill: '#1b2338', stroke: 'rgba(var(--ink-rgb), .45)', 'stroke-width': 2.4 });
        add(bg, 'line', { x1: 191, y1: 40, x2: 191, y2: 98, stroke: 'rgba(var(--ink-rgb), .45)', 'stroke-width': 2 });
        add(bg, 'circle', { cx: 206, cy: 58, r: 6, fill: '#eef0f4' }); add(bg, 'circle', { cx: 209.5, cy: 55.5, r: 5, fill: '#1b2338' });
        [[170, 52], [180, 76], [200, 84], [214, 74]].forEach(function (s) { add(bg, 'circle', { cx: s[0], cy: s[1], r: .9, fill: '#fff', opacity: .7 }); });
        add(bg, 'line', { x1: 330, y1: 0, x2: 330, y2: 30, stroke: '#2a1d16', 'stroke-width': 1.4 });
        add(bg, 'path', { d: 'M316 42 Q316 30 330 30 Q344 30 344 42 Z', fill: '#e8743b' }); add(bg, 'ellipse', { cx: 330, cy: 43, rx: 9, ry: 2.5, fill: '#ffe2a8' });
        add(bg, 'path', { d: 'M318 44 L290 118 L370 118 L342 44 Z', fill: 'rgba(255,214,150,.06)' });
        var sh = add(bg, 'g', { class: 'hs-part' + (data.low ? ' hot' : ''), 'data-scgo': 'pantry' }), low = Math.min(4, data.low || 0);
        add(sh, 'rect', { x: 340, y: 92, width: 50, height: 3, rx: 1, fill: '#8a5a3c' });
        [['#c98500', 344], ['#e8743b', 356], ['#8a6fdf', 368], ['#22b35e', 380]].forEach(function (j, i) { var hh = 12 + (i % 2) * 3, f = i < low ? .25 : .65;   /* a jar running low: nearly empty */
          add(sh, 'rect', { x: j[1], y: 92 - hh, width: 8, height: hh, rx: 2, fill: 'rgba(255,255,255,.18)', stroke: 'rgba(var(--ink-rgb), .4)', 'stroke-width': .7 });
          add(sh, 'rect', { x: j[1] + 1, y: 92 - hh * f, width: 6, height: hh * f - 1, rx: 1.4, fill: j[0] });
          add(sh, 'rect', { x: j[1] - .5, y: 92 - hh - 2, width: 9, height: 2.6, rx: 1, fill: '#5a3a26' }); });
        /* the counter: cabinet fronts, the top, the hob */
        var ct = add(bg, 'g', { class: 'hs-part', 'data-scgo': 'meals' });
        add(ct, 'rect', { x: CX0, y: CT + 2, width: CX1 - CX0, height: GY - CT - 2, fill: '#5d7f8f' });
        [CX0 + 6, CX0 + 52, CX0 + 98].forEach(function (x) { add(ct, 'rect', { x: x, y: CT + 9, width: 40, height: GY - CT - 16, rx: 3, fill: '#6c90a0' }); add(ct, 'rect', { x: x + 16, y: CT + 14, width: 8, height: 2.4, rx: 1.2, fill: '#d7dee3' }); });
        add(ct, 'rect', { x: CX0 - 4, y: CT - 2, width: CX1 - CX0 + 8, height: 6, rx: 2, fill: '#c9b48e' });
        add(ct, 'rect', { x: PX - 24, y: CT - 4, width: 48, height: 3, rx: 1.4, fill: '#2a2d33' });
        /* the shopping bag on the floor by the counter, when there is something on the list */
        if (data.shop) { var bag = add(bg, 'g', { class: 'hs-part', 'data-scgo': 'shop' });
          add(bag, 'path', { d: 'M140 200 L144 176 L164 176 L168 200 Z', fill: '#c9a26a' }); add(bag, 'path', { d: 'M148 176 Q154 166 160 176', fill: 'none', stroke: '#8a6a3c', 'stroke-width': 1.6 });
          add(bag, 'rect', { x: 147, y: 170, width: 5, height: 8, rx: 1.4, fill: '#22b35e' }); add(bag, 'circle', { cx: 159, cy: 173, r: 3.4, fill: '#e8743b' }); }
      },
      render: function (sv, t, st) {
        var r = st.pact === 'list' ? listAt(t, st) : st.pact === 'taste' ? tasteAt(t, st) : st.pact === 'shelf' ? shelfAt(t, st) : cook ? cookAt(t, st) : lookAt(t, st), th = r.th;
        var hot = cook && (t > 9 || !st.playing); steamA += ((hot ? (r.stir >= 0 ? 1 : .75) : 0) - steamA) * (st.still ? 1 : Math.min(1, st.dt * 1.5));
        var now = st.now || 0;
        if (hot) add(sv, 'ellipse', { cx: PX, cy: CT - 3, rx: 18, ry: 1.6, fill: '#ff6a3d', opacity: (.55 + .25 * Math.sin(now / 160)).toFixed(2) });
        /* the pot, its milk, the spoon (bowl in the pot, handle on the rim or in his hand), steam */
        var pot = add(sv, 'g', { class: 'hs-part', 'data-scgo': 'meals' });
        add(pot, 'ellipse', { cx: PX, cy: PT, rx: PR, ry: 4, fill: '#3b4148' });
        if (r.fill > 0) add(pot, 'ellipse', { cx: PX, cy: PT + 1, rx: ((PR - 1.5) * (.6 + .4 * r.fill)).toFixed(1), ry: (3 * (.6 + .4 * r.fill)).toFixed(1), fill: '#f6f2e8', opacity: (.4 + .6 * r.fill).toFixed(2) });
        var spoonTop = st.spoonTop || SPOON, bowl = [PX + (r.stir >= 0 ? -4 * Math.cos(r.stir) : 2), PT + 8];
        add(pot, 'line', { x1: bowl[0].toFixed(1), y1: bowl[1], x2: (r.spoonHand ? spoonTop[0] : SPOON[0]).toFixed(1), y2: ((r.spoonHand ? spoonTop[1] : SPOON[1]) - 4).toFixed(1), stroke: '#c58b5a', 'stroke-width': 2.4, 'stroke-linecap': 'round' });
        add(pot, 'path', { d: 'M' + (PX - PR) + ' ' + PT + ' L' + (PX - PR + 1) + ' ' + (PB - 3) + ' Q' + (PX - PR + 1) + ' ' + PB + ' ' + (PX - PR + 5) + ' ' + PB + ' L' + (PX + PR - 5) + ' ' + PB + ' Q' + (PX + PR - 1) + ' ' + PB + ' ' + (PX + PR - 1) + ' ' + (PB - 3) + ' L' + (PX + PR) + ' ' + PT + ' Z', fill: '#4a5058' });
        add(pot, 'path', { d: 'M' + (PX - PR + 2) + ' ' + (PT + 4) + ' L' + (PX - PR + 3) + ' ' + (PB - 4), stroke: 'rgba(255,255,255,.35)', 'stroke-width': 2, 'stroke-linecap': 'round' });
        [-1, 1].forEach(function (s) { add(pot, 'rect', { x: PX + s * (PR + 3) - 3, y: PT + 3, width: 6, height: 2.6, rx: 1.3, fill: '#5b636c' }); });
        if (steamA > .02) for (var si = 0; si < 3; si++) { var ph0 = ((now / 1000) * .6 + si / 3) % 1, sx = PX - 8 + si * 8, sy = PT - 4 - ph0 * 26;
          add(sv, 'path', { d: 'M' + sx + ' ' + sy.toFixed(1) + ' q-3 -5 0 -9 q3 -4 0 -8', fill: 'none', stroke: '#fff', 'stroke-width': 1.8, 'stroke-linecap': 'round', opacity: (steamA * .55 * Math.sin(Math.PI * ph0)).toFixed(2) }); }
        /* the fridge: freezer drawer on top, the door below, its inside lit when open */
        var fr2 = add(sv, 'g', { class: 'hs-part', 'data-scgo': 'meals', 'data-scact': 'main' });   /* a tap on the fridge: he goes to it */
        add(fr2, 'path', { d: 'M112 80 L121 86 L121 199 L112 199 Z', fill: '#a9b4bd' });
        add(fr2, 'rect', { x: 40, y: 78, width: 72, height: 121, rx: 6, fill: '#dfe5ea' });
        add(fr2, 'rect', { x: 48, y: 96, width: 22, height: 3, rx: 1.5, fill: '#9aa6b0' });
        if (th > .01) {
          add(fr2, 'rect', { x: 43, y: 111, width: 66, height: 84, rx: 3, fill: '#fbf3dc' });
          add(fr2, 'rect', { x: 43, y: 111, width: 66, height: 84, rx: 3, fill: 'rgba(255,230,160,' + (.35 * th / D).toFixed(2) + ')' });
          [140, 168].forEach(function (y) { add(fr2, 'rect', { x: 43, y: y, width: 66, height: 2, fill: '#d8d0bc' }); });
          add(fr2, 'rect', { x: 56, y: 126, width: 10, height: 14, rx: 2.5, fill: '#e8743b' }); add(fr2, 'rect', { x: 55, y: 124, width: 12, height: 3, rx: 1, fill: '#7a5038' });
          add(fr2, 'circle', { cx: 80, cy: 163, r: 4.6, fill: '#d94a4a' }); add(fr2, 'circle', { cx: 89, cy: 164, r: 4, fill: '#7fbf4a' });
          add(fr2, 'rect', { x: 64, y: 176, width: 26, height: 14, rx: 3, fill: '#9ad0e8', opacity: .8 });
          if (r.milk === 'fridge') fr2.appendChild(carton(MILK0[0], MILK0[1], 0));
        }
        var fe = doorEdge(th), ftop = 110 + fe[1], fbot = 197 + fe[1], shadeD = Math.round(223 - 40 * Math.sin(th));
        add(fr2, 'path', { d: 'M40 110 L' + fe[0].toFixed(1) + ' ' + ftop.toFixed(1) + ' L' + fe[0].toFixed(1) + ' ' + fbot.toFixed(1) + ' L40 197 Z', fill: 'rgb(' + shadeD + ',' + (shadeD + 6) + ',' + (shadeD + 11) + ')', stroke: 'rgba(0,0,0,.12)', 'stroke-width': .8, 'stroke-linejoin': 'round' });
        if (th > .05) add(fr2, 'path', { d: 'M' + fe[0].toFixed(1) + ' ' + ftop.toFixed(1) + ' L' + (fe[0] + 3 * Math.cos(th)).toFixed(1) + ' ' + (ftop - 1).toFixed(1) + ' L' + (fe[0] + 3 * Math.cos(th)).toFixed(1) + ' ' + (fbot - 1).toFixed(1) + ' L' + fe[0].toFixed(1) + ' ' + fbot.toFixed(1) + ' Z', fill: '#b9c3cb' });
        var hd = handle(th); add(fr2, 'rect', { x: (hd[0] - 1.6).toFixed(1), y: (hd[1] - 15).toFixed(1), width: 3.2, height: 30, rx: 1.6, fill: '#8f9ba5' });
        if (th < .01) add(fr2, 'line', { x1: 40, y1: 110, x2: 112, y2: 110, stroke: '#b7c1c9', 'stroke-width': 1.2 });
        if (r.milk === 'counter') sv.appendChild(carton(DOWN[0], DOWN[1], 0));
        /* the shopping list on the fridge door: a line more each time he writes */
        if (th < .01) { var nl = add(fr2, 'g', { class: 'hs-part', 'data-scgo': 'shop' }); add(nl, 'rect', { x: 86, y: 120, width: 20, height: 26, rx: 1.5, fill: '#f4f1ea', stroke: 'rgba(0,0,0,.15)', transform: 'rotate(3 96 133)' }); add(nl, 'circle', { cx: 96, cy: 121, r: 1.6, fill: '#d93a3a' });
          var nlines = Math.min(4, (data.shop ? 2 : 1) + (r.pen || 0)); for (var li = 0; li < nlines; li++) add(nl, 'rect', { x: 89, y: 126 + li * 4.5, width: li % 2 ? 10 : 14, height: 1.3, fill: '#5b636c', opacity: .7 }); }
        if (cook && r.salt !== 'hand') sv.appendChild(shaker(SHK[0], SHK[1] + 1));   /* the salt lives on the counter */
        /* him, with the carton at his hand's depth while he holds it */
        var gg = add(sv, 'g', { class: 'sc25-me' }), ph = S.LIFE(st, r.pose, r.w), look = S.look(); if (r.expr) look = Object.assign({}, look, { expr: r.expr });
        var H = S.FIG(gg, { st: st, look: look, face: r.face, cx: r.cx, gy: GY, k: K, ph: ph, w: r.w, pose: r.pose,
          items: function (H) { var h = Fig25.hand()['s-1'];
            if (r.tspoon && h) { var ts = el('g', {}); add(ts, 'line', { x1: h.X.toFixed(1), y1: (h.Y + 2).toFixed(1), x2: (h.X + 7).toFixed(1), y2: (h.Y - 5).toFixed(1), stroke: '#c9ced6', 'stroke-width': 1.3, 'stroke-linecap': 'round' }); add(ts, 'ellipse', { cx: (h.X + 8).toFixed(1), cy: (h.Y - 6).toFixed(1), rx: 2.4, ry: 1.6, fill: '#c9ced6' }); return [[h.z + .05, ts]]; }
            if (r.salt === 'hand' && h) return [[h.z + .05, shaker(h.X, h.Y - 2, r.grains ? 150 : 0)]];
            return r.milk === 'hand' && h ? [[h.z - .15, carton(h.X, h.Y, r.tilt)]] : []; } });
        if (r.grains && Fig25.hand()['s-1']) { var gh = Fig25.hand()['s-1']; for (var gi = 0; gi < 4; gi++) { var gq = ((now / 300) + gi / 4) % 1; add(sv, 'circle', { cx: (gh.X + (gi - 1.5) * 1.6).toFixed(1), cy: (gh.Y + 6 + gq * (PT - gh.Y - 6)).toFixed(1), r: .7, fill: '#fff', opacity: (1 - gq).toFixed(2) }); } }
        var hm = Fig25.hand()['s-1']; st.spoonTop = hm ? [hm.X, hm.Y] : SPOON; st.r = r;
        if (r.flow > 0 && hm) { var sp = spout(hm.X, hm.Y, r.tilt), wob = Math.sin(now / 60) * .8;
          add(sv, 'path', { d: 'M' + sp[0].toFixed(1) + ' ' + sp[1].toFixed(1) + ' Q' + (sp[0] + 2 + wob).toFixed(1) + ' ' + ((sp[1] + PT) / 2).toFixed(1) + ' ' + (sp[0] + 1).toFixed(1) + ' ' + (PT + 1), fill: 'none', stroke: '#f6f2e8', 'stroke-width': (2.4 * r.flow).toFixed(2), 'stroke-linecap': 'round' }); }
      }
    });
  };
})();
