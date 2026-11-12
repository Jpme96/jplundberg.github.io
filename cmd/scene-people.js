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
    var PET = ''; try { PET = window.ShareSpace && ShareSpace.sharedPet ? ShareSpace.sharedPet() : ''; } catch (e) {} if (PET === 'none' || !window.Fig25.pet) PET = '';
    var HRp = new Date().getHours(), SLK = null, SLT = 0;
    function sleepLook() { var n = Date.now(); if (!SLK || n - SLT > 1000) { SLK = Object.assign({}, S.look(), { expr: 'calm' }); SLT = n; } return SLK; }   /* his eyes closed while he dozes (one look object a second, so the figure's cache holds) */
    return S.run(svg, {
      back: function (bg) { var g = bg;   /* the still scenery: drawn once (F4 – faster frames) */
      add(g, 'rect', { x: 0, y: 190, width: 400, height: 50, fill: '#2f5a3c' });
      add(g, 'rect', { x: 66, y: 120, width: 8, height: 74, fill: '#5a3a26' }); add(g, 'circle', { cx: 70, cy: 104, r: 30, fill: '#2f7a4a' }); add(g, 'circle', { cx: 50, cy: 118, r: 18, fill: '#2a6e43' }); add(g, 'circle', { cx: 92, cy: 116, r: 20, fill: '#2a6e43' });
      add(g, 'rect', { x: 334, y: 170, width: 52, height: 5, rx: 2, fill: '#a87652' }); add(g, 'rect', { x: 334, y: 158, width: 52, height: 4, rx: 2, fill: '#a87652' }); [338, 382].forEach(function (x) { add(g, 'rect', { x: x - 1.5, y: 175, width: 3, height: 20, fill: '#5b636c' }); });
      add(g, 'rect', { x: 166, y: 70, width: 3, height: 124, fill: '#5b636c' }); add(g, 'circle', { cx: 167.5, cy: 68, r: 6, fill: '#ffe2a8' }); add(g, 'circle', { cx: 167.5, cy: 68, r: 18, fill: 'rgba(255,226,168,.12)' });
      },
      /* the page's own actions (F3): a heart floats up between you, and – in the evening most – a sit on the bench together */
      acts: [{ id: 'heart', len: 4.6, w: function () { return 2; } }, { id: 'bench', len: 10.4, w: function () { return HRp >= 17 && HRp < 22 ? 3 : HRp >= 22 || HRp < 5 ? .3 : .8; } }, { id: 'doze', len: 12.4, w: function () { return HRp >= 22 || HRp < 5 ? 3 : 0; } },
        { id: 'call', len: 6.2, w: function () { return 1; } }, { id: 'ball', len: 7.4, w: function () { return PET ? 2.5 : 0; } }],
      hits: [[300, 150, 90, 50, 'people', 'bench'], [20, 60, 90, 140, 'people']],   /* the bench: you sit on it together */
      season: { x: 122, y: 196, s: .95 }, len: 7.2, data: data, render: function (sv, t, st) {
      var now = st.now || 0, LIFE = window.Scene25.LIFE;   /* (a scene may use S for its own things) */
      function FIG(par, o) { o.st = st; o.k = o.k || .5; if (o.look === 'iago') o.look = 'partner'; return window.Scene25.FIG(par, o); }
      var g = add(sv, 'g', {}), me = { cx: 30, face: 90, w: 0, pose: {} }, pa = { cx: 283, face: 0, w: 0, pose: {} }, MID = [258, 116], spark = -1;
      /* a park at dusk: a tree, a bench, a lamp */
      var heart = -1, sleepy = 0, phone = null, ball = null, petX = 200, petW = 0, petA = 60, petHop = 0;
      function walkP(P, a, b, t0, t1) { var f = SEG(t, t0, t1); P.cx = LERP(a, b, f); P.face = b > a ? 90 : -90; P.w = Math.min(1, (t - t0) / .2, (t1 - t) / .2); }
      function sitP(P, f, sd) { if (f <= 0) return; P.pose.legNear = { m: f, th: 1.5, kn: 1.5 }; P.pose.legFar = { m: f, th: 1.5, kn: 1.5 }; P.pose.lift = -20 * f; P.pose[SIDE(sd, P.face)] = { m: f, b: [134, 22] }; P.pose[SIDE(-sd, P.face)] = { m: f, b: [134, 22] }; }
      if (st.pact === 'heart') {   /* they turn to each other, a heart floats up between them, back to the front */
        me.cx = 232; pa.cx = 283; var tf = t < .5 ? E(SEG(t, 0, .5)) : t < 3.8 ? 1 : 1 - E(SEG(t, 3.8, 4.4));
        me.face = 90 * tf; pa.face = -90 * tf; heart = t > .6 && t < 3.6 ? SEG(t, .6, 3.6) : -1;
        me.pose.lean = pa.pose.lean = .08 * Math.sin(Math.PI * SEG(t, .6, 2.2));
      } else if (st.pact === 'bench' || st.pact === 'doze') {   /* over to the bench, sit side by side a while, back again; late at night (doze) he nods off against her shoulder */
        var dz = st.pact === 'doze', T0 = t; if (dz) t = t < 4.0 ? t : t < 6.0 ? 4.0 : t - 2.0;   /* the doze sits two seconds longer */
        if (dz) { sleepy = T0 > 3.4 && T0 < 8.6 ? E(SEG(T0, 3.4, 4.2)) * (1 - E(SEG(T0, 8.0, 8.6))) : 0; }
        if (t < .4) { me.cx = 232; pa.cx = 283; me.face = 90 * E(SEG(t, 0, .4)); pa.face = 90 * E(SEG(t, 0, .4)); }
        else if (t < 2.4) { walkP(me, 232, 348, .4, 2.4); walkP(pa, 283, 372, .4, 2.2); if (t >= 2.2) { pa.cx = 372; pa.w = 0; } }
        else if (t < 7.6) { me.cx = 348; pa.cx = 372; var sf = t < 2.8 ? E(SEG(t, 2.4, 2.8)) : t < 3.4 ? E(SEG(t, 2.8, 3.4)) : t < 7.0 ? 1 : 1 - E(SEG(t, 7.0, 7.6));
          me.face = pa.face = t < 2.8 ? 90 - 90 * E(SEG(t, 2.4, 2.8)) : t < 7.0 ? (t > 4 && t < 6.4 ? 18 * Math.sin((t - 4) * 1.3) : 0) : -90 * E(SEG(t, 7.0, 7.4));
          if (t >= 2.8) { sitP(me, sf, 1); sitP(pa, sf, -1); }
          if (sleepy > 0) { me.face = LERP(me.face, 34, sleepy) + 3 * sleepy * Math.sin(T0 * 2.2); me.pose.lean = (me.pose.lean || 0) + .1 * sleepy; } }   /* his head drifts toward her, a slow nod */
        else if (t < 9.6) { walkP(me, 348, 232, 7.6, 9.6); walkP(pa, 372, 283, 7.8, 9.6); if (t < 7.8) { pa.cx = 372; pa.face = -90; pa.w = 0; } }
        else { me.cx = 232; pa.cx = 283; me.face = -90 * (1 - E(SEG(t, 9.6, 10.2))); pa.face = -90 * (1 - E(SEG(t, 9.6, 10.2))); }
      } else if (st.pact === 'call') {
        me.cx = 232; pa.cx = 283; me.face = -14 * E(SEG(t, 1.0, 1.5)) * (1 - E(SEG(t, 4.4, 5.0))) + (t > 1.5 && t < 4.4 ? 3 * Math.sin(t * 3) : 0) - .01;
        var hk = SIDE(1, me.face), POCK = B(150, 6), EAR = B(60, 14), wk = SIDE(-1, me.face), WV0 = B(46, 10);   /* the same hand whichever way he leans his head */
        me.pose[hk] = t < .6 ? GO(REST, POCK, SEG(t, .1, .6)) : t < 1.3 ? GO(POCK, EAR, SEG(t, .6, 1.3), 2) : t < 4.6 ? HOLD(EAR) : t < 5.3 ? GO(EAR, POCK, SEG(t, 4.6, 5.3), 2) : GO(POCK, REST, SEG(t, 5.3, 5.9));
        if (t > 2.6 && t < 4.2) me.pose[wk] = t < 2.95 ? GO(REST, WV0, SEG(t, 2.6, 2.95)) : t < 3.8 ? HOLD(B(46, 10 + 8 * Math.sin((t - 2.95) * 14))) : GO(WV0, REST, SEG(t, 3.8, 4.2));
        phone = t > .6 && t < 5.3 ? hk : null;
        pa.face = -30 * E(SEG(t, 1.2, 1.8)) * (1 - E(SEG(t, 4.8, 5.4)));   /* she looks over while he talks */
      } else if (st.pact === 'ball') {
        me.cx = 232; pa.cx = 283; var bk = SIDE(1, -90), BH = B(110, 20), BACK = B(96, -26), FWD = B(70, 36);
        me.face = t < .4 ? -90 * E(SEG(t, 0, .4)) : t < 6.6 ? -90 : -90 * (1 - E(SEG(t, 6.6, 7.1)));
        me.pose[bk] = t < .5 ? GO(REST, BH, SEG(t, .1, .5)) : t < 1.1 ? GO(BH, BACK, SEG(t, .5, 1.1)) : t < 1.4 ? GO(BACK, FWD, SEG(t, 1.1, 1.4)) : t < 2.0 ? GO(FWD, REST, SEG(t, 1.4, 2.0)) : t < 5.4 ? REST : t < 5.9 ? GO(REST, B(138, 26), SEG(t, 5.4, 5.9)) : GO(B(138, 26), REST, SEG(t, 5.9, 6.5));
        me.pose.lean = .12 * E(SEG(t, 1.1, 1.4)) * (1 - E(SEG(t, 1.4, 2.0))) + .3 * E(SEG(t, 5.4, 5.9)) * (1 - E(SEG(t, 5.9, 6.5)));
        pa.face = -40 * E(SEG(t, 1.0, 1.6)) * (1 - E(SEG(t, 6.4, 7.0)));
        /* the ball: in his hand, a throw in an arc that lands and rolls, then in the pet's mouth on the way back */
        var bq = SEG(t, 1.3, 2.5), bx0 = 205, bx1 = 118;
        ball = t < 1.3 ? 'hand' : t < 2.5 ? [LERP(bx0, bx1, bq), 150 + 46 * bq - 70 * Math.sin(Math.PI * Math.min(1, bq * 1.15)) * (1 - bq * .3)] : t < 3.6 ? [bx1 - 6 * E(SEG(t, 2.5, 3.2)), 196] : t < 5.6 ? 'pet' : null;
        petX = t < 1.5 ? 196 : t < 3.6 ? LERP(196, 116, E(SEG(t, 1.5, 3.6))) : t < 5.4 ? LERP(116, 200, E(SEG(t, 3.8, 5.4))) : 200;
        petW = (t > 1.5 && t < 3.6) || (t > 3.8 && t < 5.4) ? 1 : 0; petA = t < 3.7 ? -90 : 90; petHop = t > 5.6 && t < 6.4 ? 5 * Math.abs(Math.sin((t - 5.6) * 7.8)) : 0;
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
      /* your shared pet waits by you (only when one is chosen), and plays in the ball action */
      if (PET) { var pp = window.Fig25.pet(PET, petA * Math.PI / 180, petX, 200 - petHop, .5, (st.now || 0) / 90 * petW, petW); add(g, 'ellipse', { cx: petX, cy: 200.5, rx: 9, ry: 1.8, fill: 'rgba(0,0,0,.22)' }); pp.sort(function (a2, b2) { return a2[0] - b2[0]; }).forEach(function (q) { g.appendChild(q[1]); });
        if (ball === 'pet') add(g, 'circle', { cx: petX + (petA > 0 ? 9 : -9), cy: 189 - petHop, r: 2.6, fill: '#e8743b' }); }
      if (ball && typeof ball === 'object') { add(g, 'ellipse', { cx: ball[0], cy: 200.5, rx: 3, ry: .9, fill: 'rgba(0,0,0,.2)' }); add(g, 'circle', { cx: ball[0].toFixed(1), cy: Math.min(197.4, ball[1]).toFixed(1), r: 2.6, fill: '#e8743b' }); }
      FIG(g, { look: sleepy > .3 ? sleepLook() : 'me', cx: me.cx, gy: 200, face: me.face, ph: phm, w: me.w, pose: me.pose, items: function (H) { var out = [], ph0 = phone && H[phone], bh = ball === 'hand' && H.s1;
        if (ph0) { var pg2 = grp(ph0.X, ph0.Y - 3, -8); add(pg2, 'rect', { x: -2.6, y: -5, width: 5.2, height: 10, rx: 1.3, fill: '#1b1f27' }); out.push([ph0.z + .05, pg2]); }
        if (bh) { var bg2 = el('g', {}); add(bg2, 'circle', { cx: bh.X.toFixed(1), cy: (bh.Y + 2).toFixed(1), r: 2.6, fill: '#e8743b' }); out.push([bh.z + .05, bg2]); }
        return out; } });
      if (sleepy > 0) for (var zi = 0; zi < 3; zi++) { var zq = ((st.now || 0) / 1800 + zi / 3) % 1; S.txt(g, { x: (me.cx - 10 - 12 * zq + 3 * Math.sin(zq * 6)).toFixed(1), y: (118 - 30 * zq).toFixed(1), 'font-size': (7 + 5 * zq).toFixed(1), 'font-weight': 700, fill: '#c9d4e6', opacity: (sleepy * Math.sin(Math.PI * zq)).toFixed(2), 'font-family': 'Inter, system-ui, sans-serif' }, 'z'); }   /* z's float up while he dozes */
      if (heart >= 0) { var hy = 118 - 50 * heart, hs = 6 + 4 * Math.sin(Math.PI * Math.min(1, heart * 2)), hx = 257.5 + 4 * Math.sin(heart * 9); add(g, 'path', { d: 'M' + hx + ' ' + (hy + hs) + ' C' + (hx - hs * 1.6) + ' ' + (hy - hs * .2) + ' ' + (hx - hs * .6) + ' ' + (hy - hs * 1.3) + ' ' + hx + ' ' + (hy - hs * .4) + ' C' + (hx + hs * .6) + ' ' + (hy - hs * 1.3) + ' ' + (hx + hs * 1.6) + ' ' + (hy - hs * .2) + ' ' + hx + ' ' + (hy + hs) + ' Z', fill: '#e5484d', opacity: (1 - Math.pow(heart, 3)).toFixed(2) }); }
      if (spark >= 0) for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, r = 4 + 16 * spark; add(g, 'line', { x1: MID[0] + Math.cos(a) * r, y1: MID[1] - 4 + Math.sin(a) * r, x2: MID[0] + Math.cos(a) * (r + 5), y2: MID[1] - 4 + Math.sin(a) * (r + 5), stroke: '#f2c94c', 'stroke-width': 1.8, 'stroke-linecap': 'round', opacity: (1 - spark).toFixed(2) }); }
    } });
  };
})();
