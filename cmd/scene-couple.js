/* The two of you in 2.5D (Phase F2b, the shared home's Today) – ported from the preview JP picked ("Scenes in 2.5D"):
   eight moments (hold, hi5, hug, kiss, selfie, dance, cook, sofa) picked by the day; data: { kind, me, them } – both looks
   come from the shared box, so each app shows its own person as "me".
   var CK = ['hold', 'hi5', 'hug', 'kiss', 'selfie', 'dance', 'cook', 'sofa'];.
   Built on scene25.js (the runner, helpers, your look) and Fig25 (the body). */
(function () {
  'use strict';
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.couple = function (svg, data) {
    var S = window.Scene25; if (!S || !window.Fig25 || !svg) return null;
    var add = S.add, el = S.el, E = S.E, CL = S.CL, SEG = S.SEG, LERP = S.LERP, MIX = S.MIX, AT = S.AT, B = S.B, GO = S.GO, HOLD = S.HOLD, SIDE = S.SIDE, LEG = S.LEG,
      REST = S.REST, grp = S.grp, CLOCK = S.CLOCK, FLOOR = S.FLOOR, STAR = S.STAR, CHEER = S.CHEER;
    data = data || {};
    return S.run(svg, { id: 'couple-' + (data.kind || 'hold'), gen: false, len: 6, data: data, render: function (sv, t, st) {
      var now = st.now || 0, LIFE = window.Scene25.LIFE;   /* (a scene may use S for its own things) */
      function FIG(par, o) { o.st = st; o.k = o.k || .5; if (o.look === 'iago') o.look = 'partner'; o.who = o.look; if (o.look === 'me' && data.me) o.look = data.me; else if (o.look === 'partner' && data.them) o.look = data.them; return window.Scene25.FIG(par, o); }
      var kind = /^(hold|hi5|hug|kiss|selfie|dance|cook|sofa)$/.test(data.kind || '') ? data.kind : 'hold', g = add(sv, 'g', {}), K6 = .6, me = { cx: 176, face: 0, w: 0, pose: {}, gy: 200 }, pa = { cx: 224, face: 0, w: 0, pose: {}, gy: 200 };
      /* the shared pet sits by them (picked in either app) */
      if (data.pet && data.pet !== 'none') { var pg = add(g, 'g', { class: 'av-pet' }); pg.innerHTML = Fig25.petG(data.pet, -50, 336, 200, .6); }
      var idle = !st.playing, hearts = [], spark = -1, flash = 0, notes = false, steam = false, salt = false, extra = null, tfMe = null, tfPa = null;
      /* the room: a window with the night, a lamp, a plant, the floor */
      add(g, 'rect', { x: 44, y: 36, width: 70, height: 62, rx: 6, fill: '#1b2338', stroke: 'rgba(255,240,220,.45)', 'stroke-width': 2 }); add(g, 'circle', { cx: 96, cy: 54, r: 6, fill: '#eef0f4' }); add(g, 'circle', { cx: 99.5, cy: 51.5, r: 5, fill: '#1b2338' });
      add(g, 'rect', { x: 330, y: 92, width: 3, height: 106, fill: '#5b636c' }); add(g, 'path', { d: 'M318 92 L346 92 L340 72 L324 72 Z', fill: '#f2c94c', opacity: .85 }); add(g, 'ellipse', { cx: 332, cy: 120, rx: 40, ry: 50, fill: 'rgba(255,214,150,.06)' });
      add(g, 'path', { d: 'M52 200 L68 200 L66 184 L54 184 Z', fill: '#c96a3c' }); [[-8, -10, -30], [8, -12, 30], [0, -20, 0]].forEach(function (lf) { add(g, 'ellipse', { cx: 60 + lf[0], cy: 184 + lf[1], rx: 4, ry: 9, fill: '#2f8a52', transform: 'rotate(' + lf[2] + ' ' + (60 + lf[0]) + ' ' + (184 + lf[1]) + ')' }); });
      FLOOR(g);
      function walkIn(P, from, to, t0, t1) { if (t < t1) { P.cx = LERP(from, to, SEG(t, t0, t1)); P.w = Math.min(1, (t - t0) / .2, (t1 - t) / .2); P.face = to > from ? 90 : -90; return true; } P.cx = to; return false; }
      function wave(P, sd, t0, t1) { var k2 = SIDE(sd, P.face), WV = B(44, 10); if (t >= t0 && t < t1) P.pose[k2] = t < t0 + .3 ? GO(REST, WV, SEG(t, t0, t0 + .3)) : t < t1 - .3 ? HOLD(B(44, 10 + 9 * Math.sin((t - t0) * 16))) : GO(WV, REST, SEG(t, t1 - .3, t1)); }
      function cheer(P, t0) { if (t >= t0 && t < t0 + 1.2) { var ch = CHEER(t, t0, 1.2); P.pose.lift = ch.lift; if (ch.on) { P.pose.near = { m: ch.on, s: 2.6, f: 3.0 }; P.pose.far = { m: ch.on, s: 2.6, f: 3.0 }; } } }   /* arms rise and fall, never snap */
      if (kind === 'hold') {
        /* in from each side, take hands, swing them a little, a heart */
        var inM = walkIn(me, 80, 176, 0, 1.4), inP = walkIn(pa, 320, 224, 0, 1.4);
        if (!inM) { var tn = idle ? 1 : E(SEG(t, 1.4, 1.75)); me.face = 90 - 40 * tn; pa.face = -90 + 40 * tn;   /* they turn to each other, then take hands */ var sw = Math.sin(now / 1000 * 2.4) * 3, MID = [200 + sw, 150];
          var f = SEG(t, 1.4, 1.9); me.pose[SIDE(1, 50)] = t < 1.9 && !idle ? GO(REST, AT(MID), f, 2) : HOLD(AT(MID)); pa.pose[SIDE(-1, -50)] = t < 1.9 && !idle ? GO(REST, AT(MID), f, 2) : HOLD(AT(MID)); }
        if (t > 2.2 || idle) hearts.push([200, 120, idle ? (now / 2600) % 1 : SEG(t, 2.2, 3.8)]);
      } else if (kind === 'hi5') {
        walkIn(me, 80, 174, 0, 1.4); walkIn(pa, 320, 226, 0, 1.4);
        if (t >= 1.4) { me.face = 90; pa.face = -90; var M2 = [200, 96];
          [[me, -1, 90], [pa, 1, -90]].forEach(function (q) { var k2 = SIDE(q[1], q[2]), WV = B(44, 10); if (t < 2.6) q[0].pose[k2] = t < 1.8 ? GO(REST, WV, SEG(t, 1.4, 1.8)) : t < 2.05 ? GO(WV, AT(M2), SEG(t, 1.8, 2.05)) : t < 2.25 ? HOLD(AT(M2)) : GO(AT(M2), REST, SEG(t, 2.25, 2.6)); q[0].pose.lean = .2 * E(SEG(t, 1.8, 2.05)) * (1 - E(SEG(t, 2.25, 2.6))); });
          if (t >= 2.05 && t < 2.6) spark = SEG(t, 2.05, 2.6);
          if (t >= 2.6) { me.face = 90 * (1 - E(SEG(t, 2.6, 3.0))); pa.face = -90 * (1 - E(SEG(t, 2.6, 3.0))); }
          cheer(me, 3.0); cheer(pa, 3.15); }
      } else if (kind === 'hug') {
        walkIn(me, 80, 186, 0, 1.4); walkIn(pa, 320, 214, 0, 1.4);
        if (t >= 1.4) { me.face = 90; pa.face = -90; var f2 = SEG(t, 1.4, 1.9), rk = idle ? 1 : f2;
          var mA = [[224, 128], [222, 146]], pA = [[176, 128], [178, 146]];
          [-1, 1].forEach(function (sd, i) { me.pose[SIDE(sd, 90)] = rk < 1 ? GO(REST, AT(mA[i]), rk, 3) : HOLD(AT(mA[i])); pa.pose[SIDE(sd, -90)] = rk < 1 ? GO(REST, AT(pA[i]), rk, 3) : HOLD(AT(pA[i])); });
          me.pose.lean = pa.pose.lean = .22 * E(rk); var rock = 2.2 * Math.sin(now / 1000 * 2.2); tfMe = tfPa = 'rotate(' + rock.toFixed(2) + ' 200 200)';
          if (t > 2.0 || idle) hearts.push([200, 82, idle ? (now / 2600) % 1 : SEG(t, 2.0, 3.6)]); }
      } else if (kind === 'kiss') {
        walkIn(me, 80, 177, 0, 1.4); walkIn(pa, 320, 223, 0, 1.4);
        if (t >= 1.4) { me.face = 90; pa.face = -90; var lk = idle ? 0 : t < 1.9 ? E(SEG(t, 1.4, 1.9)) : t < 3.0 ? 1 : 1 - E(SEG(t, 3.0, 3.4)); me.pose.lean = pa.pose.lean = .12 * lk; tfMe = 'rotate(' + (3 * lk).toFixed(2) + ' 177 200)'; tfPa = 'rotate(' + (-3 * lk).toFixed(2) + ' 223 200)';
          if (t >= 1.9 && t < 3.6) hearts.push([200, 76, SEG(t, 1.9, 3.6)]);
          if (t >= 3.4 || idle) { var tf = idle ? 1 : E(SEG(t, 3.4, 3.8)); me.face = 90 - 60 * tf; pa.face = -90 + 60 * tf; } }
      } else if (kind === 'selfie') {
        me.cx = 176; pa.cx = 224; me.face = 20; pa.face = -20; var up = idle ? 1 : E(SEG(t, .3, .9)), PH = B(34, 34);
        var LOOK = B(104, 26), dn = idle ? 1 : E(SEG(t, 3.1, 3.7));
        me.pose[SIDE(-1, 20)] = up < 1 ? GO(REST, PH, up) : dn > 0 ? GO(PH, LOOK, dn, 2) : HOLD(PH);
        if (dn > 0) { var lk2 = idle ? 1 : E(SEG(t, 3.4, 3.9)); me.face = 20 + 25 * lk2; pa.face = -20 - 10 * lk2; }
        if (!idle && t >= 4.2) hearts.push([200, 84, SEG(t, 4.2, 5.8)]);
        var lean2 = idle ? 1 : E(SEG(t, .9, 1.4)); tfMe = 'rotate(' + (5 * lean2).toFixed(2) + ' 176 200)'; tfPa = 'rotate(' + (-5 * lean2).toFixed(2) + ' 224 200)';
        if (t >= 2.4 && t < 3.0 && !idle) flash = 1 - SEG(t, 2.4, 3.0);
        extra = function (H) { return H.sm ? [[H.sm.z - .15, (function () { var p2 = grp(H.sm.X, H.sm.Y - 2, 6); add(p2, 'rect', { x: -5, y: -9, width: 10, height: 17, rx: 2, fill: '#1b1f27' }); add(p2, 'circle', { cx: -2, cy: -6, r: 1.3, fill: '#5b636c' }); return p2; })()]] : []; };
      } else if (kind === 'dance') {
        /* they take turns: first she twirls under his raised hand, then he twirls under hers; then hands down, both to you */
        me.cx = 182; pa.cx = 224; notes = true;
        var done = idle || t >= 4.2, UPH = B(40, 4);
        if (!done) { me.face = 60; pa.face = -60;
          var turnB = t >= 2.6, spin = t >= 1.3 && t < 2.35 ? SEG(t, 1.3, 2.35) : t >= 3.0 && t < 4.0 ? SEG(t, 3.0, 4.0) : 0;   /* each twirl about a second – faster made the hands whip round */
          var S = turnB ? me : pa, Hd = turnB ? pa : me, sSd = turnB ? 1 : -1, sFace = turnB ? 60 : -60;
          var upF = turnB ? E(SEG(t, 2.6, 3.0)) : E(SEG(t, .2, .8));
          S.pose[SIDE(sSd, sFace)] = upF < 1 ? GO(turnB ? AT(st.heldAt || [200, 92]) : REST, UPH, upF) : HOLD(UPH);   /* his hand rises from where it held hers */
          if (spin > 0) { S.face = sFace + 360 * E(spin) * (turnB ? -1 : 1); S.pose.lift = 3 * Math.sin(Math.PI * spin); delete S.pose.near; delete S.pose.far; S.pose[SIDE(sSd, S.face)] = { m: 1, b: [40, 4] }; S.pose[SIDE(-sSd, S.face)] = { m: E(Math.min(1, spin / .25, (1 - spin) / .35)), b: [40, 4] }; }   /* the held hand stays up; the other joins it for the twirl, eased in and out – by side, as he turns */
          var beat = Math.sin(now / 1000 * 6); if (!spin) { me.pose.lift = 1.5 * Math.max(0, beat); pa.pose.lift = 1.5 * Math.max(0, -beat); } else Hd.pose.lift = 1.5 * Math.max(0, beat);
          extra = { spinner: S === me ? 'me' : 'pa', holdSd: turnB ? -1 : 1, holdFace: turnB ? -60 : 60, grab: turnB ? E(SEG(t, 2.7, 3.0)) : E(SEG(t, .5, 1.0)) };
        } else {
          var fin = idle ? 1 : E(SEG(t, 4.2, 4.7)); me.face = 60 * (1 - fin); pa.face = -60 * (1 - fin);
          if (!idle) { me.pose[SIDE(1, me.face)] = GO(UPH, REST, SEG(t, 4.2, 4.6)); pa.pose[SIDE(-1, pa.face)] = GO(st.heldAt2 ? AT(st.heldAt2) : B(42, 12), REST, SEG(t, 4.2, 4.6)); }
          var bow = !idle && t >= 4.7 && t < 5.5 ? Math.sin(Math.PI * SEG(t, 4.7, 5.5)) : 0; me.pose.lean = pa.pose.lean = .22 * bow;
          var sett = st.endNow ? Math.min(1, (now - st.endNow) / 1500) : 0, bt2 = Math.sin(now / 1000 * 3); me.pose.lift = .8 * sett * Math.max(0, bt2); pa.pose.lift = .8 * sett * Math.max(0, -bt2);
        }
      } else if (kind === 'cook') {
        me.cx = 168; pa.cx = 232; me.face = 30; pa.face = -25; steam = true;
        var ang = now / 1000 * 5.2, SP = [194 + 3.5 * Math.cos(ang), 121 + 1.2 * Math.sin(ang)];
        var rs = idle ? 1 : E(SEG(t, .2, .7)); me.pose[SIDE(1, 30)] = rs < 1 ? GO(REST, AT(SP), rs) : HOLD(AT(SP)); me.pose.lean = .12;
        var sh = !idle && t >= 1.2 && t < 3.2, SH = [210, 118 + (sh ? 3 * Math.abs(Math.sin(t * 12)) : 0)]; salt = sh;
        pa.pose[SIDE(-1, -25)] = idle ? REST : t < 1.2 ? GO(REST, AT(SH), SEG(t, .6, 1.2)) : t < 3.2 ? HOLD(AT(SH)) : GO(AT(SH), REST, SEG(t, 3.2, 3.6));
        if (t >= 3.6 || idle) { var lf = idle ? 1 : E(SEG(t, 3.6, 4.0)); me.face = 30 + 30 * lf; pa.face = -25 - 35 * lf; }
        if (t >= 4.0 && !idle) hearts.push([200, 80, SEG(t, 4.0, 5.6)]);
        extra = function (H) { return (pa.pose[SIDE(-1, -25)] && pa.pose[SIDE(-1, -25)].at || sh) && H.sm ? [[H.sm.z - .15, (function () { var s2 = grp(H.sm.X, H.sm.Y - 3, 160); add(s2, 'rect', { x: -3, y: -5, width: 6, height: 10, rx: 2, fill: '#f4f1ea' }); add(s2, 'rect', { x: -3, y: -6.5, width: 6, height: 2.6, rx: 1, fill: '#9aa3ad' }); return s2; })()]] : []; };
      } else if (kind === 'sofa') {
        /* sit down together, lean in, a blanket over the knees */
        me.cx = 182; pa.cx = 218; var sit = idle ? 1 : E(SEG(t, .2, 1.0)), drop = 15 * sit; me.gy = pa.gy = 200 + drop;
        [me, pa].forEach(function (P) { [-1, 1].forEach(function (sd) { P.pose[LEG(sd, 0)] = { m: 1, at: [P.cx + sd * 10 * .6, 198] }; }); });
        var ln = idle ? 1 : E(SEG(t, 1.4, 2.0)); tfMe = 'rotate(' + (6 * ln).toFixed(2) + ' 182 170)'; tfPa = 'rotate(' + (-6 * ln).toFixed(2) + ' 218 170)';
        if (t >= 2.4 || idle) hearts.push([200, 88, idle ? (now / 3000) % 1 : SEG(t, 2.4, 4.0)]);
      }
      if (!st.playing && kind !== 'sofa' && kind !== 'selfie' && kind !== 'cook' && kind !== 'dance') { me.face = me.face || 0; }
      var phm = LIFE(st, me.pose, me.w, 'me'), php = LIFE(st, pa.pose, pa.w, 'pa');
      /* the sofa / the counter behind them */
      if (kind === 'sofa') { add(g, 'rect', { x: 120, y: 120, width: 160, height: 52, rx: 10, fill: '#5a6b8a' }); add(g, 'rect', { x: 112, y: 150, width: 18, height: 46, rx: 6, fill: '#4b5a76' }); add(g, 'rect', { x: 270, y: 150, width: 18, height: 46, rx: 6, fill: '#4b5a76' }); }
      if (kind === 'cook') { add(g, 'rect', { x: 200 - 13, y: 128, width: 26, height: 18, rx: 3, fill: '#8e99a4' }); add(g, 'ellipse', { cx: 200, cy: 128, rx: 13, ry: 3.4, fill: '#f6f2e8' }); }
      var oPa = { look: 'partner', cx: pa.cx, gy: pa.gy, ground: 200, k: K6, face: pa.face, ph: php, w: pa.w, pose: pa.pose, tf: tfPa, items: kind === 'cook' ? extra : null, noShadow: kind === 'sofa' },
        oMe = { look: 'me', cx: me.cx, gy: me.gy, ground: 200, k: K6, face: me.face, ph: phm, w: me.w, pose: me.pose, tf: tfMe, items: kind === 'selfie' ? extra : null, noShadow: kind === 'sofa' };
      if (kind === 'dance' && extra) {
        var first = extra.spinner === 'me' ? oMe : oPa, second = extra.spinner === 'me' ? oPa : oMe, Hs = FIG(g, first), rh = extra.spinner === 'me' ? Hs.s1 : Hs.sm;
        if (rh) st[extra.spinner === 'pa' ? 'heldAt' : 'heldAt2'] = [rh.X, rh.Y + 2];
        if (rh) second.pose[SIDE(extra.holdSd, extra.holdFace)] = extra.grab < 1 ? GO(extra.spinner === 'me' ? UPH : REST, AT([rh.X, rh.Y + 2]), extra.grab)   /* the second time her hand comes down from her own twirl */ : HOLD(AT([rh.X, rh.Y + 2]));
        FIG(g, second);
      } else { FIG(g, oPa); FIG(g, oMe); }
      /* in front of them: the counter with the hob, the sofa's seat and the blanket */
      if (kind === 'cook') { var sp0 = me.pose[SIDE(1, 25)]; add(g, 'line', { x1: 200, y1: 140, x2: (Fig25.hand().s1 ? Fig25.hand().s1.X : 196), y2: (Fig25.hand().s1 ? Fig25.hand().s1.Y - 4 : 126), stroke: '#c58b5a', 'stroke-width': 2.2, 'stroke-linecap': 'round' });
        add(g, 'path', { d: 'M187 128 L188 144 Q188 148 192 148 L208 148 Q212 148 212 144 L213 128 Q200 133 187 128 Z', fill: '#8e99a4' }); add(g, 'rect', { x: 140, y: 150, width: 120, height: 6, rx: 2, fill: '#c9b48e' }); add(g, 'rect', { x: 146, y: 156, width: 108, height: 44, fill: '#5d7f8f' }); add(g, 'rect', { x: 182, y: 146, width: 36, height: 4, rx: 1.5, fill: '#2a2d33' });
        if (salt) for (var sd2 = 0; sd2 < 5; sd2++) { var q3 = ((now / 1000) * 3 + sd2 / 5) % 1; add(g, 'circle', { cx: 205 + (sd2 % 3) - 1, cy: 120 + q3 * 10, r: .7, fill: '#fff', opacity: 1 - q3 }); } }
      if (kind === 'sofa') {
        /* the seat cushion's front edge, the sofa's feet on the floor, and the blanket laid over both laps: it follows their knees,
           falls over the front of the seat in soft folds and stops above the floor; their shoes stand on the floor under it */
        add(g, 'rect', { x: 128, y: 170, width: 144, height: 20, rx: 6, fill: '#6a7c9c' }); [134, 266].forEach(function (x) { add(g, 'rect', { x: x - 3, y: 190, width: 6, height: 8, rx: 1.5, fill: '#3a2a20' }); });
        add(g, 'ellipse', { cx: 200, cy: 199, rx: 82, ry: 3, fill: 'rgba(0,0,0,.25)' });
        var bl = 'M152 172 Q166 163 182 166 Q200 170 218 166 Q234 163 248 172 L252 191 Q245 195 238 191 Q228 196 218 191 Q209 196 200 191 Q191 196 182 191 Q172 196 162 191 Q155 195 148 191 Z';
        add(g, 'path', { d: bl, fill: '#e8743b' }); add(g, 'path', { d: 'M152 172 Q166 163 182 166 Q200 170 218 166 Q234 163 248 172', fill: 'none', stroke: '#f2a066', 'stroke-width': 2, 'stroke-linecap': 'round' });
        [[170, 172, 168, 190], [200, 172, 200, 190], [230, 172, 232, 190]].forEach(function (f) { add(g, 'path', { d: 'M' + f[0] + ' ' + f[1] + ' Q' + (f[0] + 2) + ' ' + ((f[1] + f[3]) / 2) + ' ' + f[2] + ' ' + f[3], fill: 'none', stroke: 'rgba(0,0,0,.14)', 'stroke-width': 1.6 }); });
        [[176, 'me'], [218, 'pa']].forEach(function (q) { [-4, 4].forEach(function (dx) { add(g, 'ellipse', { cx: q[0] + dx + (q[0] < 200 ? 6 : 0), cy: 197, rx: 5.5, ry: 3, fill: q[1] === 'me' ? '#2a2420' : '#7a5234' }); }); }); }
      if (steam) for (var si = 0; si < 3; si++) { var p0 = ((now / 1000) * .6 + si / 3) % 1; add(g, 'path', { d: 'M' + (193 + si * 7) + ' ' + (122 - p0 * 24) + ' q-3 -5 0 -9 q3 -4 0 -8', fill: 'none', stroke: '#fff', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: (.5 * Math.sin(Math.PI * p0)).toFixed(2) }); }
      if (notes) for (var ni = 0; ni < 3; ni++) { var q4 = ((now / 1000) * .45 + ni / 3) % 1; var nt = add(g, 'text', { x: 150 + ni * 50 + 8 * Math.sin(q4 * 6), y: 110 - q4 * 60, 'font-size': 14, fill: '#f2c94c', opacity: (Math.sin(Math.PI * q4)).toFixed(2) }); nt.textContent = ni % 2 ? '♪' : '♫'; }
      hearts.forEach(function (hq) { var q = hq[2]; if (q <= 0 || q >= 1) return; var hx = hq[0] + 4 * Math.sin(q * 7), hy = hq[1] - 30 * q, sc = .6 + .6 * Math.min(1, q * 4);
        add(g, 'path', { d: 'M0 3 C-6 -3 -3 -8 0 -4 C3 -8 6 -3 0 3 Z', fill: '#e5484d', transform: 'translate(' + hx.toFixed(1) + ' ' + hy.toFixed(1) + ') scale(' + (sc * 1.4).toFixed(2) + ')', opacity: (1 - q).toFixed(2) }); });
      if (spark >= 0) for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, r = 4 + 16 * spark; add(g, 'line', { x1: 200 + Math.cos(a) * r, y1: 92 + Math.sin(a) * r, x2: 200 + Math.cos(a) * (r + 5), y2: 92 + Math.sin(a) * (r + 5), stroke: '#f2c94c', 'stroke-width': 1.8, 'stroke-linecap': 'round', opacity: (1 - spark).toFixed(2) }); }
      if (flash > 0) add(g, 'rect', { x: 0, y: 0, width: 400, height: 240, fill: '#fff', opacity: (.7 * flash).toFixed(2) });
    } });
  };
})();
