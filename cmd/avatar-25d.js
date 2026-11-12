/* The 2.5D avatar (Phase F1, 2026-11-12): one body that can be drawn from any angle – a ball head, an oval torso,
   tapered limbs with knees and elbows, a seat – with the parts sorted by depth so the side towards you is in front.
   Hands and feet can be put on things (a rail, a handle, a rung): a two-bone solver bends the elbow or knee to reach,
   a reach moves the hand along a short path, the upper body can lean from the hips. Things held are drawn at the
   hand's own depth.

   It draws a cmd look (the avatar maker's keys, after Avatar.trimLook) – every choice that's left after F0.
   Fig25.draw(look, angle, cx, ground, scale, walkPhase, walkAmount, pose) → [[depth, svgElement], …] (back to front)
   Fig25.svg(look, {a, w, h, k, ...}) → a standalone <svg> string (tiles, still pictures, the Home avatar)
   Fig25.hand() → where each hand ended up in the last drawing ({near, far, s1, 's-1'}: X, Y, z)
   The preview this is built from: "Scenes in 2.5D" (see claude/plan-rebuilds-2026-11.md, Phase F). */
(function () {
  'use strict';
  if (window.Fig25) return;
  var NS = 'http://www.w3.org/2000/svg';
  var TOP_STD = '#2f7a55';
  var L = {}, C = {}, shadeOn = true;
  var DK = {};   /* darker shades, worked out once per colour */
  function dk(h, f) { var key = h + '|' + f, m = DK[key]; if (m) return m; return (DK[key] = dk0(h, f)); }
  function dk0(h, f) { h = /^#[0-9a-f]{6}$/i.test(h || '') ? h : '#888888'; var n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; f = f || .82; return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')'; }
  function colours() { C = { skin: L.skin, skin2: dk(L.skin, .87), hair: L.hairC, top: L.topC, top2: dk(L.topC, .8), legs: L.legsC, legs2: dk(L.legsC, .82), shoe: L.shoeC, eye: '#1b1f27', mouth: '#8a4a3a' }; }
  /* a pool keeps one figure's elements from the last frame: the next frame reuses them in the same order. Pooled
     elements are a copy built off the page (their attributes only in _a); Scene25's patch() writes what changed into
     the live picture – a living scene draws you 60 times a second, and making or re-adding ~80 elements every frame
     was most of the time. A pool is only for Scene25 frames (FIG inside render). */
  var POOL = null, PN = 0;
  function el(n, a) {
    if (POOL) {
      var e = POOL.l[POOL.i], sig = n; for (var k0 in a) sig += ' ' + k0;
      if (e && e._sig === sig) { e._a = a; if (e.firstChild) e.textContent = ''; POOL.i++; return e; }
      e = document.createElementNS(NS, n); e.__sc = 1; e._a = a; e._sig = sig; POOL.l[POOL.i++] = e; return e;   /* __sc: a live-scene node (page observers skip it, diag.js); the attributes live in _a – Scene25's patch() writes them into the picture */
    }
    var x = document.createElementNS(NS, n); for (var k3 in a) x.setAttribute(k3, a[k3]); return x;
  }
  function rot(x, z, a) { return { x: x * Math.cos(a) + z * Math.sin(a), z: -x * Math.sin(a) + z * Math.cos(a) }; }
  function shade(on, a, b) { return on ? a : b; }
  /* the light: from the upper left – a soft highlight and a shade, the same whichever way he faces. One copy per page. */
  var DEFS_HTML = '<radialGradient id="shHead" cx="34%" cy="30%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>' +
    '<linearGradient id="shBody" x1="0" y1="0" x2="1" y2=".25"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>';
  var DEFS = null;   /* the defs element once made: checking .isConnected is much cheaper than a lookup by id every frame */
  function ensureDefs() { if (DEFS && DEFS.isConnected) return; DEFS = document.getElementById('shHead'); if (DEFS) return; var s = document.createElementNS(NS, 'svg'); s.setAttribute('width', '0'); s.setAttribute('height', '0'); s.setAttribute('aria-hidden', 'true'); s.style.position = 'absolute'; var d = document.createElementNS(NS, 'defs'); d.innerHTML = DEFS_HTML; s.appendChild(d); (document.body || document.documentElement).appendChild(s); DEFS = d.firstChild; }

  /* a cmd look → what the 2.5D body needs. Choices that share a shape are drawn by the same part. */
  var TOPS = { tee: { bare: 'short' }, tank: { bare: 'arms' }, polo: { collar: 1, bare: 'short' }, sweater: {}, knit: {}, hoodie: {}, shirt: {}, jersey: { bare: 'short', stripe: 1 }, kit: { bare: 'short', stripe: 1 },
    varsity: { sleeve: '#f4f1ea' }, suit: { jacket: '#2e3340' }, puffer: { quilt: 1 }, rain: { hood: 1, zip: 1 }, jacket: { zip: 1 }, dress: { bare: 'short', skirt: 'knee' }, bunad: { band: 1, sleeve: '#f4f4f2' },
    scrubs: { vneck: 1, bare: 'short' }, chef: { buttons2: 1 }, pjs: { stripes: 1 }, robe: { wrap: 1 }, none: { bare: 'arms' } };
  var SHOES = { sneakers: '#1a1a1a', hightops: '#d93a3a', boots: '#5b3a1e', sandals: '#8a5e44', slippers: '#e0559a', cleats: '#1a1a1a' };
  /* the build changes the whole body, not only its width (JP, 2026-11-12: "the composition does not fit the body"):
     w = body width, d = depth (front to back), sh = shoulders, wa = waist, hp = hips, arm / leg = how thick */
  var BUILD = {
    slim:     { w: .9,  d: .88, sh: .92, wa: .86, hp: .9,  arm: .8,  leg: .82 },
    regular:  { w: 1,   d: 1,   sh: 1,   wa: 1,   hp: 1,   arm: 1,   leg: 1 },
    athletic: { w: 1.04, d: 1.04, sh: 1.2, wa: .84, hp: .98, arm: 1.22, leg: 1.16, mus: 1 },   /* mus: muscles are drawn (shoulders, upper arms, thighs, calves; chest and stomach when bare) */
    muscular: { w: 1.1, d: 1.12, sh: 1.34, wa: .88, hp: 1.04, arm: 1.46, leg: 1.3, mus: 2 },
    broad:    { w: 1.2, d: 1.28, sh: 1.1, wa: 1.22, hp: 1.16, arm: 1.16, leg: 1.2 }   /* JP: the build changed too little – the spread is bigger and athletic/muscular have muscles */
  };
  function look25(l) {
    l = l || {}; if (window.Avatar && Avatar.trimLook) l = Avatar.trimLook(l);
    var top = TOPS[l.top] ? l.top : 'sweater', t = TOPS[top], bottom = l.bottom || 'trousers';
    var o = { skin: l.skin || '#c99a73', hairC: l.hairC || '#1e140d', hair: { ponytail: 'pony', topknot: 'bun' }[l.hair] || l.hair || 'short',
      beard: l.beard || 'none', glasses: l.glasses || 'none', expr: l.expr || 'smile', makeup: l.makeup || 'none', cheeks: l.cheeks || 'none', faceS: l.faceS || 'oval',
      top: top, topC: top === 'chef' ? '#f4f4f2' : (/^#[0-9a-f]{6}$/i.test(l.topC || '') ? l.topC : TOP_STD), bottom: bottom, legsC: l.legs || '#2a2f3a', shoes: l.shoes || 'sneakers',
      hat: l.hat || 'none', hatC: l.hatC || '#e8743b', neck: l.wxScarf ? 'scarf' : 'none', neckC: l.hatC || '#e8743b', aid: l.aid || 'none',
      bare: t.bare || '', sleeve: t.sleeve || '', skirt: t.skirt || (bottom === 'skirt' ? 'knee' : ''), legsOn: bottom === 'shorts' ? 'thigh' : bottom === 'swim' ? 'swim' : top === 'dress' ? 'none' : 'full',
      bw: (BUILD[l.build] || BUILD.regular).w, bp: BUILD[l.build] || BUILD.regular, hs: { short: .94, tall: 1.05 }[l.height] || 1 };
    o.shoeC = SHOES[o.shoes] || '#1a1a1a';
    if (top === 'dress') o.legsC = o.skin;
    if (o.hair === 'bald') o.hair = 'none';
    return o;
  }
  /* the details that make each top what it is (the colour is the same standard for all since F0) */
  function topDetails(parts, a, k, t1, t2, hw, bob, P, TD, topY, botY) {
    var t = TOPS[L.top] || {}, fr = Math.cos(a), front = fr > .15, line = function (p, q, col, wd, z) { parts.push([z || .02, el('line', { x1: p.X, y1: p.Y, x2: q.X, y2: q.Y, stroke: col, 'stroke-width': wd * k, 'stroke-linecap': 'round' })]); };
    var clipId = POOL ? POOL.id + 't' : 'f25t' + (draw.n = (draw.n || 0) + 1), wrap = el('g', {}), cp = el('clipPath', { id: clipId }); cp.appendChild(el('path', { d: TD })); wrap.appendChild(cp); var g = el('g', { 'clip-path': 'url(#' + clipId + ')' }); wrap.appendChild(g);
    var add = function (n, at) { g.appendChild(el(n, at)); }, W = hw * k;
    if (t.jacket) { add('path', { d: TD, fill: t.jacket }); if (front) { var v1 = P(-9, 80 + bob, 15), v2 = P(0, 112 + bob, 16), v3 = P(9, 80 + bob, 15); add('path', { d: 'M' + v1.X + ' ' + v1.Y + ' L' + v2.X + ' ' + v2.Y + ' L' + v3.X + ' ' + v3.Y + ' Z', fill: '#f4f4f2' }); var ti = P(0, 84 + bob, 16), tb = P(0, 108 + bob, 17); add('path', { d: 'M' + (ti.X - 2 * k) + ' ' + ti.Y + ' L' + (ti.X + 2 * k) + ' ' + ti.Y + ' L' + (tb.X + 2.4 * k) + ' ' + tb.Y + ' L' + tb.X + ' ' + (tb.Y + 3 * k) + ' L' + (tb.X - 2.4 * k) + ' ' + tb.Y + ' Z', fill: '#d42a2f' }); } }
    if (t.quilt) for (var qy = 1; qy <= 4; qy++) { var yy = t1.Y + (t2.Y - t1.Y) * qy / 5; add('path', { d: 'M' + (t1.X - W) + ' ' + yy + ' L' + (t1.X + W) + ' ' + yy, stroke: dk(L.topC, .75), 'stroke-width': 1.4 * k }); }
    if (t.zip && front) { var z1 = P(0, 82 + bob, 16), z2 = P(0, 146 + bob, 17); add('path', { d: 'M' + z1.X + ' ' + z1.Y + ' L' + z2.X + ' ' + z2.Y, stroke: dk(L.topC, .65), 'stroke-width': 1.6 * k }); }
    if (t.stripe) { var sy = t1.Y + 20 * k; add('rect', { x: t1.X - W, y: sy, width: W * 2, height: 6 * k, fill: '#f4f1ea', opacity: .9 }); }
    if (t.band) { var by = t1.Y + 16 * k; add('rect', { x: t1.X - W, y: by, width: W * 2, height: 9 * k, fill: '#d42a2f' }); add('rect', { x: t1.X - W, y: by + 3 * k, width: W * 2, height: 3 * k, fill: '#f2c94c' }); }
    if (t.stripes) for (var sx = -3; sx <= 3; sx++) { var px = t1.X + sx / 3.4 * W; add('path', { d: 'M' + px + ' ' + t1.Y + ' L' + px + ' ' + t2.Y, stroke: '#f4f1ea', 'stroke-width': 2 * k, opacity: .55 }); }
    if (t.wrap && front) { var w1 = P(-12, 80 + bob, 14), w2 = P(10, 132 + bob, 16); add('path', { d: 'M' + w1.X + ' ' + w1.Y + ' L' + w2.X + ' ' + w2.Y, stroke: dk(L.topC, .65), 'stroke-width': 2 * k }); var bl = t1.Y + 50 * k; add('rect', { x: t1.X - W, y: bl, width: W * 2, height: 5 * k, fill: dk(L.topC, .7) }); }
    if (t.vneck && front) { var n1 = P(-7, 80 + bob, 14), n2 = P(0, 94 + bob, 16), n3 = P(7, 80 + bob, 14); add('path', { d: 'M' + n1.X + ' ' + n1.Y + ' L' + n2.X + ' ' + n2.Y + ' L' + n3.X + ' ' + n3.Y, fill: L.skin, stroke: dk(L.topC, .7), 'stroke-width': 1.2 * k }); }
    if (t.collar && front) { var c1 = P(-8, 79 + bob, 12), c2 = P(0, 88 + bob, 13), c3 = P(8, 79 + bob, 12); add('path', { d: 'M' + c1.X + ' ' + c1.Y + ' L' + c2.X + ' ' + c2.Y + ' L' + c3.X + ' ' + c3.Y, fill: 'none', stroke: dk(L.topC, .65), 'stroke-width': 2.2 * k }); }
    if (t.buttons2 && front) [96, 110, 124].forEach(function (yy2) { [-5, 5].forEach(function (bx) { var bt = P(bx, yy2 + bob, 15); add('circle', { cx: bt.X, cy: bt.Y, r: 1.3 * k, fill: '#9aa3ad' }); }); });
    if (L.top === 'none' && front) { [-6, 6].forEach(function (nx) { var nb = P(nx, 100 + bob, 15); add('circle', { cx: nb.X, cy: nb.Y, r: .9 * k, fill: dk(L.skin, .7) }); }); }
    if (g.childNodes.length) parts.push([0.018, wrap]);
    if (t.hood) { var hb = P(0, 82 + bob, -8); parts.push([Math.cos(a) > 0 ? -0.2 : 0.3, el('ellipse', { cx: hb.X, cy: hb.Y, rx: Math.max(6, 16 * Math.abs(Math.cos(a)) + 8 * Math.abs(Math.sin(a))) * k, ry: 7 * k, fill: dk(L.topC, .85) })]); }
  }

  function draw(look, a, cx, gy, k, ph, w, pose) {
    pose = pose || {}; var lc = look && look.__f25; if (lc) { L = lc.L; C = lc.C; } else { L = look25(look); colours(); if (look && typeof look === 'object') try { Object.defineProperty(look, '__f25', { value: { L: L, C: C } }); } catch (e) {} }   /* the same look object next frame: worked out once */
    k *= L.hs; w = Math.max(0, Math.min(1, w || 0)); ph = ph || 0;
    var BW = L.bw;   /* build: how wide the body and arms are */
    function nearSide(sd) { var zz = -sd * Math.sin(a); return zz > 1e-6 || (Math.abs(zz) <= 1e-6 && sd < 0); }
    var parts = [];   /* [depth, element] – drawn back to front */
    /* lean: the upper body tips forward round the hips (climbing, reaching); arms always go with it */
    var LN = pose.lean || 0, LC = Math.cos(LN), LS = Math.sin(LN), HY = 0;
    function P(x, y, z, up) { if (LN && (up || y < HY - 4)) { var dy = y - HY; y = HY + dy * LC + z * LS; z = z * LC - dy * LS; }
      var r = rot(x, z, a); return { X: cx + r.x * k, Y: gy + (y - 218) * k, Z: r.z }; }
    /* a point on the screen back to the body's own (height, forward) – for hands and feet that must land on something */
    function toBody(S, xl) { return { y: 218 + (S[1] - gy) / k, z: (S[0] - cx - (xl || 0) * Math.cos(a) * k) / (k * (Math.abs(Math.sin(a)) < .2 ? (Math.sin(a) < 0 ? -.2 : .2) : Math.sin(a))) }; }
    function unlean(b) { if (!LN) return b; var dy = b.y - HY; return { y: HY + dy * LC - b.z * LS, z: b.z * LC + dy * LS }; }
    /* two-bone reach: the angles (from straight down, forward positive) of the upper and lower part to touch (dy, dz) */
    function ik(dy, dz, l1, l2, bend) { var D = Math.hypot(dy, dz), D2 = Math.max(Math.abs(l1 - l2) + .5, Math.min(l1 + l2 - .3, D)), ph0 = Math.atan2(dz, dy);
      var al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + D2 * D2 - l2 * l2) / (2 * l1 * D2)))), a1 = ph0 + bend * al;
      var ty = Math.cos(ph0) * D2, tz = Math.sin(ph0) * D2; return [a1, Math.atan2(tz - l1 * Math.sin(a1), ty - l1 * Math.cos(a1))]; }
    function limb(p1, p2, wid, col, z) { parts.push([z, el('line', { x1: p1.X.toFixed(1), y1: p1.Y.toFixed(1), x2: p2.X.toFixed(1), y2: p2.Y.toFixed(1), stroke: col, 'stroke-width': (wid * k).toFixed(1), 'stroke-linecap': 'round' })]); }
    /* a limb that is thicker at one end (thigh to knee, calf to ankle): two round ends joined by their tangents */
    function taper(p1, p2, r1, r2, col, z) {
      r1 *= k; r2 *= k; var dx = p2.X - p1.X, dy = p2.Y - p1.Y, d = Math.hypot(dx, dy) || .001, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
      var sn = Math.max(-.95, Math.min(.95, (r1 - r2) / d)), cs = Math.sqrt(1 - sn * sn);
      var ax = nx * cs + ux * sn, ay = ny * cs + uy * sn, bx = -nx * cs + ux * sn, by = -ny * cs + uy * sn;
      var r1s = r1.toFixed(1), r2s = r2.toFixed(1), s1 = (p1.X + ax * r1).toFixed(1) + ' ' + (p1.Y + ay * r1).toFixed(1);
      var dd = 'M' + s1 + ' L' + (p2.X + ax * r2).toFixed(1) + ' ' + (p2.Y + ay * r2).toFixed(1) + ' A' + r2s + ' ' + r2s + ' 0 0 0 ' + (p2.X + bx * r2).toFixed(1) + ' ' + (p2.Y + by * r2).toFixed(1) +
        ' L' + (p1.X + bx * r1).toFixed(1) + ' ' + (p1.Y + by * r1).toFixed(1) + ' A' + r1s + ' ' + r1s + ' 0 0 0 ' + s1 + ' Z';
      parts.push([z, el('path', { d: dd, fill: col })]);
    }
    var CHAIR = L.aid === 'chair', SEAT = CHAIR ? 38 : 0, CRUTCH = L.aid === 'crutches';
    var bob = (CHAIR ? 0 : w * (Math.cos(2 * ph) * 1.6 - 1.2)) - (pose.lift || 0) - (pose.breath || 0) + SEAT; HY = 140 + bob;
    var hb6 = (bob - SEAT) * .6 + SEAT;
    /* legs: thigh swings forward/back (z), the knee bends on the way forward, the foot points where he faces */
    [-1, 1].forEach(function (sd) {
      var q = ph + (sd < 0 ? 0 : Math.PI), th = CHAIR ? Math.PI / 2 : w * 0.42 * Math.sin(q), kn = CHAIR ? Math.PI / 2 : w * 0.72 * Math.max(0, Math.cos(q - 0.35));
      if (CRUTCH) { th *= .7; kn *= .8; }   /* a shorter, careful step between the crutches */   /* the knee bends while the leg swings forward (lifted), straight while it pushes back on the ground */
      var lo = pose[nearSide(sd) ? 'legNear' : 'legFar'];
      if (lo && lo.at) { var tb = toBody(lo.at, sd * 10), sl = ik(tb.y - (140 + bob), tb.z, 38, 36, 1); lo = { m: lo.m == null ? 1 : lo.m, th: sl[0], kn: sl[0] - sl[1] }; }   /* the foot goes where it must stand (a rung) */
      if (lo) { th = th * (1 - lo.m) + lo.th * lo.m; kn = kn * (1 - lo.m) + lo.kn * lo.m; }   /* a keyed leg pose */
      var LW = L.bp.leg, hip = [sd * 10 * L.bp.hp, 140 + bob, 0], knee = [hip[0], hip[1] + 38 * Math.cos(th), hip[2] + 38 * Math.sin(th)];
      var ank = [hip[0], knee[1] + 36 * Math.cos(th - kn), knee[2] + 36 * Math.sin(th - kn)];
      var lift = Math.max(0, 218 - 4 - ank[1]); /* stays on the ground */
      if (ank[1] > 214) { var d = ank[1] - 214; knee[1] -= d; ank[1] = 214; hip[1] -= 0; }
      var a1 = P(hip[0], hip[1], hip[2]), a2 = P(knee[0], knee[1], knee[2]), a3 = P(ank[0], ank[1], ank[2]), toe = P(ank[0], ank[1] + 3, ank[2] + 14);
      var far = rot(sd * 8, 0, a).z < 0, z = -0.02 + rot(sd * 8, 0, a).z * 0.0005;
      if (knee[2] > 14 && Math.abs(Math.cos(a)) > .5) z = 0.006 + rot(sd * 8, 0, a).z * 0.0005;   /* a deep squat or sitting, seen from the front: the thighs come toward you, in front of the body – they were hidden behind it */   /* the legs always go under the seat and the top (the near thigh used to poke over the waist when seen from the side); near leg still in front of the far one */
      /* a human leg: full at the hip, narrower at the knee, the calf swells a little below it, slim at the ankle */
      var lc = shade(far, C.legs2, C.legs), skc = shade(far, C.skin2, C.skin), calf = P(knee[0], knee[1] + (ank[1] - knee[1]) * .32, knee[2] + (ank[2] - knee[2]) * .32);
      var thighC = L.legsOn === 'none' || L.legsOn === 'swim' ? skc : lc, shinC = L.legsOn === 'full' ? lc : skc;
      var MUL = 1 + .07 * (L.bp.mus || 0);   /* athletic/muscular: fuller thighs and calves */
      taper(a1, a2, 10.5 * LW * MUL, 8.2 * LW, thighC, z); taper(a2, calf, 8.2 * LW, 8.4 * LW * MUL, shinC, z); taper(calf, a3, 8.4 * LW * MUL, 7.2 * LW, shinC, z);
      if (L.legsOn === 'thigh') { var kb = P(knee[0], knee[1] - 4, knee[2]); taper(a1, kb, 10.8, 9, lc, z + .001); }
      if (L.legsOn === 'swim') { var sb = P(hip[0], hip[1] + 13, hip[2] + (knee[2] - hip[2]) * .3); taper(a1, sb, 11, 10.4, lc, z + .001); }
      if (L.bottom === 'jeans') limb(P(hip[0] + sd * 4, hip[1] + 6, hip[2] + 8), P(knee[0] + sd * 4, knee[1], knee[2] + 6), .9, 'rgba(242,201,76,.55)', z + .002);
      if (L.bottom === 'joggers') parts.push([z + .002, el('circle', { cx: a3.X, cy: a3.Y - 1.5 * k, r: 4.6 * k, fill: dk(L.legsC, .78) })]);
      if (L.bottom === 'cargo') { var cpk = P(knee[0] + sd * 2, hip[1] + (knee[1] - hip[1]) * .55, hip[2] + (knee[2] - hip[2]) * .55 + 6); parts.push([z + .003, el('rect', { x: cpk.X - 4 * k, y: cpk.Y - 4 * k, width: 8 * k, height: 8 * k, rx: 1.5 * k, fill: dk(L.legsC, .85) })]); }
      var mid2 = P(ank[0], ank[1] + 3, ank[2] + 5); parts.push([z + 0.49, el('ellipse', { cx: mid2.X, cy: mid2.Y, rx: (8 * Math.abs(Math.cos(a)) + 4) * k, ry: 5.4 * k, fill: L.shoes === 'sandals' ? skc : C.shoe })]);   /* the shoe's width, seen from the front */
      taper(P(ank[0], ank[1] + 2.5, ank[2] - 5), toe, 6.6, 6, L.shoes === 'sandals' ? skc : C.shoe, z + 0.5);
      if (L.shoes === 'sandals') limb(P(ank[0], ank[1] + 4, ank[2] + 3), P(ank[0], ank[1] + 4, ank[2] + 9), 3, '#8a5e44', z + .51);
      if (L.shoes === 'sneakers' || L.shoes === 'hightops' || L.shoes === 'cleats') limb(P(ank[0], ank[1] + 6.4, ank[2] - 4), P(ank[0], ank[1] + 6.4, ank[2] + 17), 2.2, '#f4f4f2', z + .52);
      if (L.shoes === 'cleats') [-2, 6, 14].forEach(function (cz) { var st = P(ank[0], ank[1] + 8.6, ank[2] + cz); parts.push([z + .53, el('rect', { x: st.X - 1 * k, y: st.Y, width: 2 * k, height: 2.4 * k, fill: '#9aa3ad' })]); });
      if (L.shoes === 'hightops' || L.shoes === 'boots') taper(P(ank[0], ank[1] - 8, ank[2]), P(ank[0], ank[1] + 1, ank[2]), 7.4, 7, C.shoe, z + .5);
    });
    /* the seat: a rounded pelvis in the trousers' colour where the legs meet the body, fuller at the back –
       from the side you see the bottom, from the front the hips */
    var pw = Math.sqrt(Math.pow(18 * L.bp.hp * Math.cos(a), 2) + Math.pow(10 * L.bp.d * Math.sin(a), 2)), pc = P(0, 144 + bob, -6);
    parts.push([-0.005, el('ellipse', { cx: pc.X, cy: pc.Y, rx: pw * k, ry: 11 * k, fill: L.legsOn === 'none' ? C.skin2 : C.legs })]);
    if (L.skirt) { var sk1 = P(0, 136 + bob, 0), sk2 = P(0, L.skirt === 'long' ? 196 : 176, 0), skw1 = BW * Math.sqrt(Math.pow(26 * Math.cos(a), 2) + Math.pow(17 * Math.sin(a), 2)) * k, skw2 = skw1 * 1.32, skc2 = L.top === 'dress' ? C.top : C.legs;
      parts.push([0.004, el('path', { d: 'M' + (sk1.X - skw1) + ' ' + sk1.Y + ' L' + (sk1.X + skw1) + ' ' + sk1.Y + ' L' + (sk2.X + skw2) + ' ' + sk2.Y + ' Q' + sk2.X + ' ' + (sk2.Y + 4 * k) + ' ' + (sk2.X - skw2) + ' ' + sk2.Y + ' Z', fill: skc2 })]); }
    /* torso: an oval tube – its width depends on which way he faces; the side towards the back is darker */
    var BP = L.bp, wid = function (f) { return Math.sqrt(Math.pow(30 * BW * f * Math.cos(a), 2) + Math.pow(17 * BP.d * Math.sin(a), 2)); };
    var hw = wid(BP.wa), hwT = wid(BP.sh) * .92, topY = 80 + bob, botY = 146 + bob;   /* hw: at the waist (details use it); hwT: across the shoulders */
    var t1 = P(0, topY, 0), t2 = P(0, botY, 0);
    var TD = 'M' + (t1.X - hwT * k) + ' ' + (t1.Y + 3 * k) + ' Q' + t1.X + ' ' + (t1.Y - 5 * k) + ' ' + (t1.X + hwT * k) + ' ' + (t1.Y + 3 * k) + ' L' + (t2.X + hw * k) + ' ' + t2.Y + ' Q' + t2.X + ' ' + (t2.Y + 5 * k) + ' ' + (t2.X - hw * k) + ' ' + t2.Y + ' Z';
    parts.push([0, el('path', { d: TD, fill: L.top === 'none' ? C.skin : C.top })]);
    topDetails(parts, a, k, t1, t2, hw, bob, P, TD, topY, botY);
    if (L.top === 'none' && BP.mus && Math.cos(a) > .3) {   /* bare and fit: the chest and the stomach are drawn as soft lines that turn with him */
      var mc = dk(L.skin, .8), mo = (Math.min(1, (Math.cos(a) - .3) * 2) * (.35 + .15 * BP.mus)).toFixed(2), pecY = 98 + bob;
      [-1, 1].forEach(function (sd) { var pa1 = P(sd * 2, pecY, 15), pa2 = P(sd * 15 * BP.sh, pecY + 1, 13), pa3 = P(sd * 22 * BP.sh, pecY - 7, 10);
        parts.push([0.012, el('path', { d: 'M' + pa1.X.toFixed(1) + ' ' + pa1.Y.toFixed(1) + ' Q' + pa2.X.toFixed(1) + ' ' + (pa2.Y + 3 * k).toFixed(1) + ' ' + pa3.X.toFixed(1) + ' ' + pa3.Y.toFixed(1), fill: 'none', stroke: mc, 'stroke-width': (1.1 * k).toFixed(2), 'stroke-linecap': 'round', opacity: mo })]); });
      /* the stomach: a six-pack – three rows of two soft blocks either side of the middle line – and the V of the obliques down to the hips */
      var abA = (BP.mus > 1 ? .55 : .42) * Math.min(1, (Math.cos(a) - .3) * 2), abf = dk(L.skin, .86);
      [[106, 115], [117, 126], [128, 137]].forEach(function (r) { [-1, 1].forEach(function (sd) { var c1 = P(sd * 1.4, r[0] + bob, 15), c2 = P(sd * 9.2, r[1] + bob, 14.2);
        var x0 = Math.min(c1.X, c2.X), w0 = Math.abs(c2.X - c1.X); if (w0 < .6 * k) return;
        parts.push([0.012, el('rect', { x: x0.toFixed(1), y: c1.Y.toFixed(1), width: w0.toFixed(1), height: (c2.Y - c1.Y).toFixed(1), rx: (2.6 * k).toFixed(2), fill: 'none', stroke: abf, 'stroke-width': (.9 * k).toFixed(2), opacity: abA.toFixed(2) })]); }); });
      var ab1 = P(0, pecY + 6, 15), ab2 = P(0, 138 + bob, 14); parts.push([0.012, el('line', { x1: ab1.X.toFixed(1), y1: ab1.Y.toFixed(1), x2: ab2.X.toFixed(1), y2: ab2.Y.toFixed(1), stroke: mc, 'stroke-width': (1 * k).toFixed(2), opacity: mo })]);
      [-1, 1].forEach(function (sd) { var o1 = P(sd * 16 * BP.wa, 118 + bob, 12), o2 = P(sd * 6, 146 + bob, 13.5); parts.push([0.012, el('path', { d: 'M' + o1.X.toFixed(1) + ' ' + o1.Y.toFixed(1) + ' Q' + ((o1.X + o2.X) / 2 + sd * 2 * k).toFixed(1) + ' ' + ((o1.Y + o2.Y) / 2).toFixed(1) + ' ' + o2.X.toFixed(1) + ' ' + o2.Y.toFixed(1), fill: 'none', stroke: mc, 'stroke-width': (.9 * k).toFixed(2), opacity: mo })]); });
    }
    if (shadeOn) parts.push([0.015, el('path', { d: 'M' + (t1.X - hwT * k) + ' ' + (t1.Y + 3 * k) + ' Q' + t1.X + ' ' + (t1.Y - 5 * k) + ' ' + (t1.X + hwT * k) + ' ' + (t1.Y + 3 * k) + ' L' + (t2.X + hw * k) + ' ' + t2.Y + ' Q' + t2.X + ' ' + (t2.Y + 5 * k) + ' ' + (t2.X - hw * k) + ' ' + t2.Y + ' Z', fill: 'url(#shBody)' })]);
    /* a Nordic knit: a band of white zigzag across the chest and rows of small crosses, wrapping round the body */
    if (L.top === 'knit') {
      var KNID = 'kn' + (draw.n = (draw.n || 0) + 1), KW = el('g', {}), KC = el('clipPath', { id: KNID }); KC.appendChild(el('path', { d: TD })); KW.appendChild(KC); var KN = el('g', { 'clip-path': 'url(#' + KNID + ')' }); KW.appendChild(KN); parts.push([0.02, KW]);
      var bandY = t1.Y + 18 * k, zz = 'M', n = 14;
      for (var zi = 0; zi <= n; zi++) { var xx = t1.X - hw * k * .97 + (2 * hw * k * .97) * zi / n; zz += (zi ? ' L' : '') + xx.toFixed(1) + ' ' + (bandY + (zi % 2 ? 5 : -1) * k).toFixed(1); }
      KN.appendChild(el('path', { d: zz, fill: 'none', stroke: '#f4f1ea', 'stroke-width': 2.6 * k, 'stroke-linejoin': 'round' }));
      KN.appendChild(el('path', { d: 'M' + (t1.X - hw * k) + ' ' + (bandY + 11 * k) + ' L' + (t1.X + hw * k) + ' ' + (bandY + 11 * k), stroke: '#f4f1ea', 'stroke-width': 2 * k }));
      for (var ry2 = 0; ry2 < 2; ry2++) for (var cx2 = -3; cx2 <= 3; cx2++) { var off = cx2 / 3.5 + (ry2 ? .08 : -.06), px = t1.X + off * hw * k, py = bandY + (21 + ry2 * 12) * k;
        if (Math.abs(off) < .95) KN.appendChild(el('path', { d: 'M' + (px - 2.4 * k) + ' ' + py + ' L' + (px + 2.4 * k) + ' ' + py + ' M' + px + ' ' + (py - 2.4 * k) + ' L' + px + ' ' + (py + 2.4 * k), stroke: '#f4f1ea', 'stroke-width': 1.5 * k })); }
      KN.appendChild(el('path', { d: 'M' + (t2.X - hw * k) + ' ' + (t2.Y - 6 * k) + ' L' + (t2.X + hw * k) + ' ' + (t2.Y - 6 * k), stroke: '#f4f1ea', 'stroke-width': 2.4 * k }));
    }
    /* overalls: the bib and straps on whichever side faces you, the buckles at the front */
    if (L.bottom === 'overalls') {
      var fr = Math.cos(a), bw = 13 * Math.abs(fr) * k + 3 * k, bt = P(0, 104 + bob, 15), oc = C.legs;
      if (fr > -0.2) { parts.push([0.03, el('rect', { x: bt.X - bw, y: bt.Y, width: bw * 2, height: (146 - 104) * k, rx: 3 * k, fill: oc })]);
        parts.push([0.031, el('rect', { x: bt.X - bw * .45, y: bt.Y + 10 * k, width: bw * .9, height: 9 * k, rx: 2 * k, fill: 'none', stroke: dk(L.legsC, .7), 'stroke-width': 1.4 * k })]); }
      [-1, 1].forEach(function (sd) { var s1 = P(sd * 12, 82 + bob, fr >= 0 ? 15 : -15), s2 = P(sd * 10, 106 + bob, fr >= 0 ? 15 : -15); parts.push([0.031, el('line', { x1: s1.X, y1: s1.Y, x2: s2.X, y2: s2.Y, stroke: oc, 'stroke-width': 4 * k, 'stroke-linecap': 'round' })]);
        if (fr > 0.2) parts.push([0.032, el('circle', { cx: s2.X, cy: s2.Y, r: 1.8 * k, fill: '#d9a400' })]); });
    }
    if (L.neck === 'scarf') {
      var sc = P(0, 79 + bob, 0), scw = Math.sqrt(Math.pow(14 * Math.cos(a), 2) + Math.pow(11 * Math.sin(a), 2)) * k;
      parts.push([0.6, el('rect', { x: sc.X - scw, y: sc.Y - 4 * k, width: scw * 2, height: 9 * k, rx: 4.5 * k, fill: L.neckC })]);
      var tl = P(-6, 84 + bob, 15); if (rot(-6, 15, a).z > -2 && Math.abs(Math.sin(a)) < .82) parts.push([0.61, el('rect', { x: tl.X - 3.5 * k, y: tl.Y, width: 7 * k, height: 26 * k, rx: 3 * k, fill: dk(L.neckC, .92) })]);
    }
    var side = Math.sin(a), sw = Math.abs(side) * 12 * k;
    if (sw > .5) { var sx = side > 0 ? t1.X - hw * k + 1 : t1.X + hw * k - sw - 1; parts.push([0.01, el('rect', { x: sx, y: t1.Y + 6 * k, width: sw, height: (botY - topY - 8) * k, rx: sw / 2, fill: L.top === 'none' ? C.skin2 : C.top2, opacity: .55 })]); }   /* no top: the shade on his side is skin, not the top's colour (the green strip on a bare back) */
    if (Math.cos(a) > 0.15) {
      if (L.top === 'hoodie') [-5, 5].forEach(function (x) { var q1 = P(x, 86 + bob, 13), q2 = P(x, 104 + bob, 13); parts.push([0.02, el('line', { x1: q1.X, y1: q1.Y, x2: q2.X, y2: q2.Y, stroke: '#f2f2f2', 'stroke-width': 1.6 * k, 'stroke-linecap': 'round', opacity: Math.min(1, Math.cos(a) * 1.5) })]); });
      if (L.top === 'shirt') { var c1 = P(-8, 79 + bob, 12), c2 = P(0, 90 + bob, 13), c3 = P(8, 79 + bob, 12), c4 = P(0, 82 + bob, 13);
        parts.push([0.02, el('path', { d: 'M' + c1.X + ' ' + c1.Y + ' L' + c2.X + ' ' + c2.Y + ' L' + c4.X + ' ' + c4.Y + ' Z M' + c3.X + ' ' + c3.Y + ' L' + c2.X + ' ' + c2.Y + ' L' + c4.X + ' ' + c4.Y + ' Z', fill: '#f4f4f2' })]);
        [96, 110, 124].forEach(function (yy) { var bt = P(0, yy + bob, 13); parts.push([0.02, el('circle', { cx: bt.X, cy: bt.Y, r: 1.3 * k, fill: dk(L.topC, .6) })]); }); }
    }
    /* arms: from the shoulders, swinging against the legs */
    [-1, 1].forEach(function (sd) {
      var q = ph + (sd < 0 ? Math.PI : 0), sv = w * 0.38 * Math.sin(q), ov = pose[nearSide(sd) ? 'near' : 'far'];
      if (CHAIR && !ov) ov = { m: 1, b: [134 - 6 * Math.cos(ph * 1.2) * w, 4 + 14 * Math.sin(ph * 1.2) * w] };
      if (CRUTCH && !ov) ov = { m: 1, b: [148, 10 + 9 * Math.sin(ph) * w] };
      var fb = sv + 0.15 + w * 0.25 * Math.max(0, Math.sin(q));
      var place = function (q) { return q.at ? unlean(toBody(q.at, sd * 32)) : { y: q.b[0] + bob, z: q.b[1] }; };
      if (ov && ov.path) { var A0 = place(ov.path[0]), B0 = place(ov.path[1]), fq = ov.f; ov = { m: 1, b: null, at: null, hb: { y: A0.y + (B0.y - A0.y) * fq - ov.up / k * Math.sin(Math.PI * fq), z: A0.z + (B0.z - A0.z) * fq } }; }
      if (ov && (ov.at || ov.b || ov.hb)) { var hb = ov.hb || place(ov), sa = ik(hb.y - (88 + bob), hb.z, 29, 27, -1); ov = { m: ov.m == null ? 1 : ov.m, s: sa[0], f: sa[1] }; }   /* a pose without m (like a plain resting place) is fully on */   /* the hand goes where it must hold (a rail, the slot) */
      if (ov) { sv = sv * (1 - ov.m) + ov.s * ov.m; fb = fb * (1 - ov.m) + ov.f * ov.m; }   /* a keyed pose, blended in */
      var AW = L.bp.arm, SHW = BW * L.bp.sh, sh = [sd * 30 * SHW, 88 + bob, 0], elb = [sd * 32 * SHW, sh[1] + 29 * Math.cos(sv), 29 * Math.sin(sv)];
      var hand = [sd * 32 * SHW, elb[1] + 27 * Math.cos(fb), elb[2] + 27 * Math.sin(fb)];
      var zz = rot(sd * 25, 0, a).z, far = zz < -2, z = far ? zz - 1 : zz + 1;
      var p1 = P(sh[0], sh[1], sh[2], 1), p2 = P(elb[0], elb[1], elb[2], 1), p3 = P(hand[0], hand[1], hand[2], 1);
      var MU = L.bp.mus || 0, bic = MU ? P(sh[0] + (elb[0] - sh[0]) * .45, sh[1] + (elb[1] - sh[1]) * .45, sh[2] + (elb[2] - sh[2]) * .45, 1) : null;   /* athletic/muscular: a fuller shoulder and upper arm */
      if (L.bare === 'arms' || L.top === 'none') { taper(p1, p2, 5.6 * AW, 4.6 * AW, shade(far, C.skin2, C.skin), z); taper(p2, p3, 4.6 * AW, 3.6 * AW, shade(far, C.skin2, C.skin), z);
        if (MU) { taper(p1, bic, (6.4 + .5 * MU) * AW, (5.6 + .6 * MU) * AW, shade(far, C.skin2, C.skin), z + .002); taper(bic, p2, (5.6 + .6 * MU) * AW, 4.4 * AW, shade(far, C.skin2, C.skin), z + .002); } }
      else if (L.bare === 'short') { var mid = P(sh[0] + (elb[0] - sh[0]) * .55, sh[1] + (elb[1] - sh[1]) * .55, sh[2] + (elb[2] - sh[2]) * .55, 1);
        taper(p1, p2, 5.6 * AW, 4.6 * AW, shade(far, C.skin2, C.skin), z); taper(p2, p3, 4.6 * AW, 3.6 * AW, shade(far, C.skin2, C.skin), z); taper(p1, mid, 7.2 * AW, 6.4 * AW, shade(far, C.top2, C.top), z + .01); }
      else { var slc = L.sleeve || C.top, slc2 = L.sleeve ? dk(L.sleeve, .82) : C.top2; taper(p1, p2, 9 * AW, 8 * AW, shade(far, slc2, slc), z); taper(p2, p3, 8 * AW, 7.4 * AW, shade(far, slc2, slc), z);
        if (L.aid === 'arm' && sd > 0) taper(P(elb[0] + (hand[0] - elb[0]) * .35, elb[1] + (hand[1] - elb[1]) * .35, elb[2] + (hand[2] - elb[2]) * .35, 1), p3, 5, 4.4, shade(far, '#7d8894', '#9aa3ad'), z + .02); }
      /* the hand: a mitten turned along the forearm, the thumb on the side toward the front, a cuff at the wrist */
      var fdx = p3.X - p2.X, fdy = p3.Y - p2.Y, fl = Math.hypot(fdx, fdy) || 1, ux = fdx / fl, uy = fdy / fl, ang = Math.atan2(uy, ux) * 180 / Math.PI - 90;
      var fwd = Math.abs(Math.sin(a)) > .3 ? (Math.sin(a) > 0 ? 1 : -1) : -sd * (Math.cos(a) >= 0 ? 1 : -1), pxv = -uy, pyv = ux; if (pxv * fwd < 0) { pxv = -pxv; pyv = -pyv; }
      var hc2 = shade(far, C.skin2, C.skin), HG = el('g', {});
      if (!L.bare && L.top !== 'none') HG.appendChild(el('line', { x1: (p3.X - ux * 3.4 * k).toFixed(1), y1: (p3.Y - uy * 3.4 * k).toFixed(1), x2: (p3.X - ux * .6 * k).toFixed(1), y2: (p3.Y - uy * .6 * k).toFixed(1), stroke: dk(L.sleeve || L.topC, far ? .7 : .8), 'stroke-width': (8.2 * k).toFixed(1), 'stroke-linecap': 'round' }));
      var tx = p3.X + ux * 1.6 * k + pxv * 4.4 * k, ty = p3.Y + uy * 1.6 * k + pyv * 4.4 * k;
      HG.appendChild(el('ellipse', { cx: tx.toFixed(1), cy: ty.toFixed(1), rx: (2.3 * k).toFixed(1), ry: (3.6 * k).toFixed(1), fill: hc2, transform: 'rotate(' + (ang + (pxv * uy - pyv * ux > 0 ? -28 : 28)).toFixed(0) + ' ' + tx.toFixed(1) + ' ' + ty.toFixed(1) + ')' }));
      var mx = p3.X + ux * 3.2 * k, my = p3.Y + uy * 3.2 * k;
      HG.appendChild(el('ellipse', { cx: mx.toFixed(1), cy: my.toFixed(1), rx: (5.4 * k).toFixed(1), ry: (6.6 * k).toFixed(1), fill: hc2, transform: 'rotate(' + ang.toFixed(0) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1) + ')' }));
      parts.push([z + 0.1, HG]);
      HAND[nearSide(sd) ? 'near' : 'far'] = HAND['s' + sd] = { X: p3.X, Y: p3.Y, z: z + 0.2 };
    });
    /* neck and head: a ball; eyes, nose, mouth, ears, glasses and beard sit on it and come round as he turns */
    var hc = P(0, 52 + hb6, 0), R = 22 * k;
    /* a shape that only moves with the head (the hair): its path is built round the head's middle and kept from the last
       frame while the turn, the size and the hair are the same; only its place (a translate) changes as he breathes or walks */
    var MEMO = POOL ? (POOL.memo || (POOL.memo = {})) : null;
    function headPath(name, key, mk) {
      if (!MEMO) return { d: poly(mk()) };   /* a still picture: drawn as before, in place */
      var m = MEMO && MEMO[name], d;
      if (m && m.key === key) d = m.d;
      else { var pts = mk(), s = 'M'; for (var i = 0; i < pts.length; i++) s += (i ? ' L' : '') + (pts[i][0] - hc.X).toFixed(1) + ' ' + (pts[i][1] - hc.Y).toFixed(1); d = s + ' Z'; if (MEMO) MEMO[name] = { key: key, d: d }; }
      return { d: d, transform: 'translate(' + hc.X.toFixed(1) + ' ' + hc.Y.toFixed(1) + ')' };
    }
    function behind(x, y, z) { return rot(x, z, a).z; }
    /* a box (x, y, z ranges) seen from this side, as a rounded shape: long hair, a hood */
    function box(x0, x1, y0, y1, z0, z1, fill, depth, rr) {
      var xs = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(function (q) { return rot(q[0], q[1], a).x; });
      var mn = Math.min.apply(null, xs), mx = Math.max.apply(null, xs), top = P(0, y0 + hb6, 0).Y, bot = P(0, y1 + hb6, 0).Y;
      parts.push([depth, el('rect', { x: hc.X + mn * k, y: top, width: (mx - mn) * k, height: bot - top, rx: (rr || 10) * k, fill: fill })]);
    }
    var head = el('g', {});
    function hatCoversLong() { return L.hat === 'beanie' && false; }
    head.appendChild(el('rect', { x: hc.X - 6 * k, y: hc.Y + 14 * k, width: 12 * k, height: 16 * k, rx: 5 * k, fill: C.skin2 }));
    var FS = { oval: [.96, 1.05, 1], round: [1.16, .97, 0], long: [.87, 1.17, 3.6] }[L.faceS] || [1, 1, 0];   /* face shape: oval a little taller than wide, round full and wide, long narrow with the chin lower (JP: the shapes looked the same) */
    head.appendChild(el('ellipse', { cx: hc.X, cy: hc.Y + FS[2] * k, rx: R * FS[0], ry: R * FS[1], fill: C.skin }));
    function onHead(phi, y) { var s = Math.sin(phi + a), c = Math.cos(phi + a); return { x: hc.X + s * R * Math.sqrt(Math.max(0, 1 - Math.pow((y - 52) / 22, 2))), y: hc.Y + (y - 52) * k, f: c }; }
    function sstep(e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
    function poly(pts) { var s = 'M'; for (var i = 0; i < pts.length; i++) s += (i ? ' L' : '') + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1); return s + ' Z'; }
    /* beard: a band round the lower face, only where the face looks your way */
    if (L.beard === 'full' || L.beard === 'short' || L.beard === 'stubble') {
      var up = [], lo = [], top0 = L.beard === 'full' ? 57 : L.beard === 'short' ? 59 : 60;
      for (var bi = 0; bi <= 20; bi++) { var ph2 = -1.5 + 3 * bi / 20, u = onHead(ph2, top0 + 5 * (1 - Math.cos(ph2))), dxh = u.x - hc.X; if (u.f > -0.02) { up.push([u.x, u.y]); lo.unshift([u.x, Math.max(u.y + 2 * k, hc.Y + Math.sqrt(Math.max(0, R * R - dxh * dxh)) * .97 + (L.beard === 'full' ? 3 * k * Math.max(0, u.f) : 0))]); } }   /* the lower edge follows the jaw (the head's outline at the same x), so it never sticks out as a point when he turns */
      if (up.length > 1) head.appendChild(el('path', { d: poly(up.concat(lo)), fill: C.hair, opacity: L.beard === 'full' ? 1 : L.beard === 'short' ? .85 : .3 }));
    }
    if (L.beard === 'goatee' || L.beard === 'moustache') { var gt = [], gN = 8, gy0 = L.beard === 'goatee' ? 63 : 59.5, gy1 = L.beard === 'goatee' ? 72 : 62.5, gw2 = L.beard === 'goatee' ? .32 : .42;
      for (var gi = 0; gi <= gN; gi++) { var gp = onHead(-gw2 + 2 * gw2 * gi / gN, gy0); if (gp.f > .05) gt.push([gp.x, gp.y]); }
      for (var gj = gN; gj >= 0; gj--) { var gq = onHead(-gw2 * .8 + 1.6 * gw2 * gj / gN, gy1 - (L.beard === 'goatee' ? 0 : 1.5 * Math.abs(gj / gN - .5))); if (gq.f > .05) gt.push([gq.x, gq.y]); }
      if (gt.length > 4) head.appendChild(el('path', { d: poly(gt), fill: C.hair })); }
    var eyes = [];
    [-0.62, 0.62].forEach(function (phi) { var e = onHead(phi * -1, 51); eyes.push(e); if (e.f > 0.05) { var ew = 4.6 * k * Math.max(.3, e.f);
      var wink = L.expr === 'wink' && phi > 0, open = !pose.blink && !wink && (L.expr === 'grin' || L.expr === 'wow' || L.expr === 'cool');
      if (open) head.appendChild(el('ellipse', { cx: e.x, cy: e.y, rx: Math.max(.9 * k, (L.expr === 'wow' ? 2.6 : 2.1) * k * e.f), ry: (L.expr === 'wow' ? 3.2 : L.expr === 'cool' ? 1.5 : 2.6) * k, fill: C.eye }));
      else if (pose.blink || wink) head.appendChild(el('path', { d: 'M' + (e.x - ew) + ' ' + e.y + ' L' + (e.x + ew) + ' ' + e.y, stroke: C.eye, 'stroke-width': 1.8 * k, 'stroke-linecap': 'round' }));
      else head.appendChild(el('path', { d: 'M' + (e.x - ew) + ' ' + (e.y + 1 * k) + ' Q' + e.x + ' ' + (e.y - 3.4 * k) + ' ' + (e.x + ew) + ' ' + (e.y + 1 * k), fill: 'none', stroke: C.eye, 'stroke-width': 2 * k, 'stroke-linecap': 'round' }));   /* happy closed eyes, like your avatars */
      var br = onHead(phi * -1 * 1.05, 44); head.appendChild(el('path', { d: 'M' + (br.x - ew * 1.1) + ' ' + (br.y + .6 * k) + ' Q' + br.x + ' ' + (br.y - 1.6 * k) + ' ' + (br.x + ew * 1.1) + ' ' + (br.y + .6 * k), fill: 'none', stroke: dk(L.hairC, .9), 'stroke-width': 1.8 * k, 'stroke-linecap': 'round', opacity: .85 }));
      if ((L.makeup === 'lashes' || L.makeup === 'both') && !open) [-.7, 0, .7].forEach(function (lx) { head.appendChild(el('line', { x1: e.x + lx * ew, y1: e.y - 1.6 * k, x2: e.x + lx * ew * 1.25, y2: e.y - 3.6 * k, stroke: C.eye, 'stroke-width': .9 * k, 'stroke-linecap': 'round' })); });
      if (e.f > .3) head.appendChild(el('ellipse', { cx: e.x + (phi < 0 ? -1 : 1) * 1.5 * k, cy: e.y + 7 * k, rx: 3.6 * k * e.f, ry: 2 * k, fill: '#e58a7a', opacity: L.cheeks === 'blush' || L.expr === 'shy' ? .6 : .3 }));
      if (L.cheeks === 'freckles' && e.f > .3) [[-1.6, 6], [0, 7.4], [1.8, 6.2]].forEach(function (fq) { head.appendChild(el('circle', { cx: e.x + fq[0] * k * e.f, cy: e.y + fq[1] * k, r: .7 * k, fill: dk(L.skin, .6) })); }); } });
    var mo = onHead(0, L.beard === 'full' ? 61 : 62); if (mo.f > 0.1) { var mw = (L.expr === 'grin' || L.expr === 'laugh' ? 7.4 : L.expr === 'calm' || L.expr === 'shy' ? 4.6 : 6) * k * mo.f, mcol = L.makeup === 'lips' || L.makeup === 'both' ? '#c23a4a' : L.beard === 'full' ? '#f0d0c0' : C.mouth;
      if (L.expr === 'wow') head.appendChild(el('ellipse', { cx: mo.x, cy: mo.y + 1 * k, rx: 2.6 * k * mo.f + .4, ry: 3.2 * k, fill: '#7a3a30' }));
      else if (L.expr === 'laugh' || L.expr === 'grin') head.appendChild(el('path', { d: 'M' + (mo.x - mw) + ' ' + mo.y + ' Q' + mo.x + ' ' + (mo.y + 7 * k) + ' ' + (mo.x + mw) + ' ' + mo.y + ' Z', fill: '#7a3a30', stroke: mcol, 'stroke-width': 1 * k }));
      else if (L.expr === 'cool') head.appendChild(el('path', { d: 'M' + (mo.x - mw) + ' ' + (mo.y + 1 * k) + ' Q' + (mo.x + mw * .3) + ' ' + (mo.y + 2 * k) + ' ' + (mo.x + mw) + ' ' + (mo.y - 1.2 * k), fill: 'none', stroke: mcol, 'stroke-width': 1.6 * k, 'stroke-linecap': 'round' }));
      else head.appendChild(el('path', { d: 'M' + (mo.x - mw) + ' ' + mo.y + ' Q' + mo.x + ' ' + (mo.y + 4 * k) + ' ' + (mo.x + mw) + ' ' + mo.y, fill: 'none', stroke: mcol, 'stroke-width': 1.6 * k, 'stroke-linecap': 'round' })); }
    var no = onHead(0, 56); if (no.f > -0.2) { var nx = Math.sin(a) * 5 * k; head.appendChild(el('ellipse', { cx: no.x + nx * .45, cy: no.y, rx: (2.1 + Math.abs(Math.sin(a)) * 2.2) * k, ry: 2.5 * k, fill: dk(L.skin, .95) })); if (no.f > .2) head.appendChild(el('path', { d: 'M' + (no.x - 1.6 * k) + ' ' + (no.y + 1.8 * k) + ' Q' + no.x + ' ' + (no.y + 2.8 * k) + ' ' + (no.x + 1.6 * k) + ' ' + (no.y + 1.8 * k), fill: 'none', stroke: dk(L.skin, .78), 'stroke-width': .9 * k, 'stroke-linecap': 'round', opacity: .6 })); }
    var ears = [];
    [-Math.PI / 2, Math.PI / 2].forEach(function (phi) { var e = onHead(phi * -1, 53); ears.push(e); if (e.f > -0.35) { head.appendChild(el('ellipse', { cx: e.x, cy: e.y, rx: 3.5 * k * Math.max(.4, Math.abs(Math.sin(phi * -1 + a))), ry: 5.5 * k, fill: C.skin2 }));
      if (L.aid === 'hearing' && phi > 0) head.appendChild(el('path', { d: 'M' + e.x + ' ' + (e.y - 5 * k) + ' q' + (3 * k) + ' ' + (2 * k) + ' ' + (1 * k) + ' ' + (8 * k), fill: 'none', stroke: '#d9c7a8', 'stroke-width': 2.6 * k, 'stroke-linecap': 'round' })); } });
    /* hair */
    var H = { short: [37, 30, 1.07, 1.16], quiff: [37, 30, 1.07, 1.16], fade: [39, 28, 1.03, 1.08], side: [36, 31, 1.05, 1.09], undercut: [36, 14, 1.06, 1.14], waves: [36, 31, 1.08, 1.11], bangs: [42, 26, 1.07, 1.12], curly: [35, 28, 1.16, 1.2], afro: [34, 26, 1.34, 1.42],
      long: [37, 32, 1.06, 1.09], braids: [38, 31, 1.04, 1.07], dreads: [37, 32, 1.1, 1.12], pony: [38, 30, 1.02, 1.04], pigtails: [38, 30, 1.03, 1.05], bun: [38, 30, 1.02, 1.04], mohawk: [44, 22, 1.0, 1.0] }[L.hair];
    var hatCovers = L.hat === 'beanie' || L.hat === 'chef' || L.hat === 'bandana' || L.hat === 'santa' || L.hat === 'wizard' || L.hat === 'witch' || L.hat === 'cowboy';
    if (H && L.hair === 'mohawk' && !hatCovers) { var mh = []; for (var mi = 0; mi <= 12; mi++) { var mt = Math.PI * (.2 + .6 * mi / 12), mfz = Math.cos(mt) * 26, mfy = 52 - Math.sin(mt) * 24 - 6, mp = P(0, mfy + hb6, -mfz); mh.push([mp.X, mp.Y]); }
      for (var mj = 12; mj >= 0; mj--) { var mt2 = Math.PI * (.2 + .6 * mj / 12), mp2 = P(0, 52 - Math.sin(mt2) * 21 + hb6, -Math.cos(mt2) * 22); mh.push([mp2.X, mp2.Y]); }
      parts.push([0.52, el('path', { d: poly(mh), fill: C.hair, stroke: C.hair, 'stroke-width': (7 * k).toFixed(1), 'stroke-linejoin': 'round' })]); H = null; }
    if (H && !hatCovers) {
      var hkey = L.hair + '|' + a.toFixed(4) + '|' + k.toFixed(4) + '|' + H.join(',');
      head.appendChild(el('path', Object.assign(headPath('hair', hkey, function () {
      var pts = [], N = 32, RR = R * H[2];
      for (var i = 0; i <= N; i++) {
        var X = -1 + 2 * i / N, phi = Math.asin(X), facing = Math.cos(phi - a), side = Math.sin(phi - a);
        var y = H[0] + 5 * X * X + H[1] * sstep(0.32, -0.3, facing) + (L.hair === 'side' || L.hair === 'waves' || L.hair === 'undercut' ? 4 * Math.max(0, side) * Math.max(0, facing) : 0);
        var sq = Math.sqrt(Math.max(0, 1 - X * X));
        y = Math.max(52 - 22 * sq + 1, Math.min(y, 52 + 22 * sq - 1.5));
        pts.push([hc.X + X * RR, hc.Y + (y - 52) * k]);
      }
      for (var j = 1; j < N; j++) { var t = Math.PI * j / N, bump = L.hair === 'waves' ? 1 + .035 * Math.abs(Math.sin(t * 6)) : L.hair === 'curly' || L.hair === 'afro' ? 1 + (L.hair === 'afro' ? .07 : .05) * Math.abs(Math.sin(t * 9)) : L.hair === 'dreads' ? 1 + .04 * Math.abs(Math.sin(t * 14)) : 1; pts.push([hc.X + Math.cos(t) * RR * bump, hc.Y - Math.sin(t) * R * H[3] * bump]); }
      return pts; }), { fill: C.hair })));
      /* a swept fringe: the hair falls a little over the forehead on one side, wrapping round as he turns */
      if (L.hair === 'quiff') { var qf = P(0, 26 + hb6, 14), qb = P(0, 30 + hb6, -2); head.appendChild(el('ellipse', { cx: (qf.X + qb.X) / 2, cy: (qf.Y + qb.Y) / 2, rx: Math.max(4 * k, Math.abs(qf.X - qb.X) / 2 + 8 * k * Math.abs(Math.cos(a))), ry: 7 * k, fill: C.hair })); }
      if (L.hair === 'short' || L.hair === 'side' || L.hair === 'bangs' || L.hair === 'waves' || L.hair === 'undercut') { var fN = 10, fr = headPath('fringe', hkey, function () { var fp = [];
        for (var fi = 0; fi <= fN; fi++) { var fph = -.9 + 1.5 * fi / fN, top = onHead(fph, 33), low = onHead(fph, 39 + 5 * Math.sin(Math.PI * fi / fN)); if (top.f > -.1) fp.push([top.x, top.y]); }
        for (var fj = fN; fj >= 0; fj--) { var fph2 = -.9 + 1.5 * fj / fN, low2 = onHead(fph2, 38.5 + 6 * Math.sin(Math.PI * fj / fN) * (fj / fN)); if (low2.f > -.1) fp.push([low2.x, low2.y]); }
        return fp.length > 4 ? fp : []; }); if (fr.d !== 'M Z') head.appendChild(el('path', Object.assign(fr, { fill: C.hair }))); }
    }
    /* glasses: a frame round each eye that can be seen, the bridge between them, the arm back to the ear */
    if (L.glasses !== 'none') {
      var gc = '#202430';
      eyes.forEach(function (e, n) { if (e.f <= 0.05) return; var rw = 6 * k * Math.max(.3, e.f), rh = 5.4 * k;
        var lens = L.glasses === 'sun' || L.glasses === 'aviator' ? 'rgba(20,24,32,.88)' : 'rgba(255,255,255,.18)', fc = L.glasses === 'aviator' ? '#c9a24a' : gc;
        head.appendChild(L.glasses === 'round' ? el('ellipse', { cx: e.x, cy: e.y, rx: rw, ry: rh, fill: lens, stroke: fc, 'stroke-width': 1.5 * k })
          : L.glasses === 'aviator' ? el('path', { d: 'M' + (e.x - rw) + ' ' + (e.y - rh * .7) + ' L' + (e.x + rw) + ' ' + (e.y - rh * .7) + ' Q' + (e.x + rw) + ' ' + (e.y + rh * 1.1) + ' ' + e.x + ' ' + (e.y + rh) + ' Q' + (e.x - rw) + ' ' + (e.y + rh * 1.1) + ' ' + (e.x - rw) + ' ' + (e.y - rh * .7) + ' Z', fill: lens, stroke: fc, 'stroke-width': 1.3 * k })
          : L.glasses === 'cateye' ? el('path', { d: 'M' + (e.x - rw * 1.1) + ' ' + (e.y - rh) + ' L' + (e.x + rw * 1.1) + ' ' + (e.y - rh) + ' Q' + (e.x + rw) + ' ' + (e.y + rh) + ' ' + e.x + ' ' + (e.y + rh * .8) + ' Q' + (e.x - rw) + ' ' + (e.y + rh) + ' ' + (e.x - rw * 1.1) + ' ' + (e.y - rh) + ' Z', fill: lens, stroke: fc, 'stroke-width': 1.7 * k })
          : el('rect', { x: e.x - rw, y: e.y - rh * .85, width: rw * 2, height: rh * 1.7, rx: (L.glasses === 'sun' ? 2.4 : 1.6) * k, fill: lens, stroke: fc, 'stroke-width': 1.7 * k }));
        var ear = ears[n]; if (Math.abs(ear.x - e.x) > 4 * k && ear.f < .6) head.appendChild(el('line', { x1: e.x + (ear.x > e.x ? rw : -rw), y1: e.y - 1 * k, x2: ear.x, y2: ear.y - 2 * k, stroke: gc, 'stroke-width': 1.4 * k })); });
      if (eyes[0].f > .05 && eyes[1].f > .05) { var l0 = eyes[0].x < eyes[1].x ? eyes[0] : eyes[1], r0 = l0 === eyes[0] ? eyes[1] : eyes[0];
        head.appendChild(el('line', { x1: l0.x + 6 * k * Math.max(.3, l0.f), y1: l0.y - 1 * k, x2: r0.x - 6 * k * Math.max(.3, r0.f), y2: r0.y - 1 * k, stroke: gc, 'stroke-width': 1.4 * k })); }
    }
    /* hats */
    if (L.hat === 'beanie' || L.hat === 'bandana') {
      var hp = [], bandY = 43;
      for (var hi = 0; hi <= 24; hi++) { var tt = Math.PI * hi / 24; hp.push([hc.X - Math.cos(tt) * R * 1.07, hc.Y - Math.sin(tt) * R * 1.16 + (bandY - 52) * k * (1 - Math.sin(tt)) ]); }
      hp.push([hc.X + R * 1.07, hc.Y + (bandY - 52) * k]); hp.push([hc.X - R * 1.07, hc.Y + (bandY - 52) * k]);
      head.appendChild(el('path', { d: poly(hp), fill: L.hatC }));
      if (L.hat === 'bandana') [-.5, .5].forEach(function (dx) { head.appendChild(el('circle', { cx: hc.X + dx * R * Math.cos(a), cy: hc.Y - R * .55, r: 1.3 * k, fill: '#f4f1ea', opacity: Math.cos(a) > .2 ? .9 : 0 })); });
      if (L.hat === 'beanie') head.appendChild(el('rect', { x: hc.X - R * 1.09, y: hc.Y + (bandY - 58) * k, width: R * 2.18, height: 8 * k, rx: 4 * k, fill: dk(L.hatC, .85) }));
    }
    if (L.hat === 'party' || L.hat === 'santa' || L.hat === 'wizard' || L.hat === 'witch') {
      /* a cone on the crown of the head: the tip leans back a little; santa's flops, the witch's has a brim */
      var tall = { party: 26, santa: 24, wizard: 40, witch: 38 }[L.hat], base = R * (L.hat === 'party' ? .62 : 1.02), by = hc.Y - R * (L.hat === 'party' ? .9 : .62), tipP = P(0, 52 - 22 - tall + hb6, L.hat === 'santa' ? -14 : -4), tipX = L.hat === 'santa' ? tipP.X + 10 * k : tipP.X;
      if (L.hat === 'witch') head.appendChild(el('ellipse', { cx: hc.X, cy: by + 2 * k, rx: R * 1.5, ry: 4.5 * k, fill: dk(L.hatC, .7) }));
      head.appendChild(el('path', { d: 'M' + (hc.X - base) + ' ' + by + ' Q' + hc.X + ' ' + (by + 3 * k) + ' ' + (hc.X + base) + ' ' + by + ' L' + tipX + ' ' + tipP.Y + ' Z', fill: L.hat === 'santa' ? '#d42a2f' : L.hatC }));
      if (L.hat === 'santa') { head.appendChild(el('rect', { x: hc.X - base * 1.04, y: by - 3 * k, width: base * 2.08, height: 7 * k, rx: 3.5 * k, fill: '#f4f1ea' })); head.appendChild(el('circle', { cx: tipX, cy: tipP.Y, r: 4 * k, fill: '#f4f1ea' })); }
      if (L.hat === 'party') [.3, .6].forEach(function (f) { head.appendChild(el('circle', { cx: hc.X + (tipX - hc.X) * f, cy: by + (tipP.Y - by) * f, r: 1.6 * k, fill: '#f2c94c' })); });
      if (L.hat === 'wizard') [.35, .7].forEach(function (f, i) { head.appendChild(el('circle', { cx: hc.X + (tipX - hc.X) * f + (i ? -3 : 3) * k, cy: by + (tipP.Y - by) * f, r: 1.5 * k, fill: '#f2c94c' })); });
    }
    if (L.hat === 'chef') { var cy1 = hc.Y - R * .6; head.appendChild(el('rect', { x: hc.X - R * .95, y: cy1 - 9 * k, width: R * 1.9, height: 11 * k, rx: 2 * k, fill: '#f4f4f2' }));
      head.appendChild(el('ellipse', { cx: hc.X, cy: cy1 - 16 * k, rx: R * 1.15, ry: 12 * k, fill: '#ffffff' })); }
    if (L.hat === 'cowboy') { var cby = hc.Y - R * .62; head.appendChild(el('ellipse', { cx: hc.X, cy: cby, rx: R * 1.75, ry: (4 + 4 * Math.abs(Math.sin(a)) * 0) * k + 3 * k, fill: dk(L.hatC, .8) }));
      head.appendChild(el('path', { d: 'M' + (hc.X - R * .82) + ' ' + cby + ' Q' + (hc.X - R * .9) + ' ' + (cby - 18 * k) + ' ' + hc.X + ' ' + (cby - 15 * k) + ' Q' + (hc.X + R * .9) + ' ' + (cby - 18 * k) + ' ' + (hc.X + R * .82) + ' ' + cby + ' Z', fill: L.hatC })); }
    if (L.hat === 'crown') {
      var cw = R * .95, cy0 = hc.Y - R * 1.18, ch = 14 * k, pts2 = [[hc.X - cw * .82, cy0 + ch]];
      for (var ci2 = 0; ci2 <= 8; ci2++) pts2.push([hc.X - cw * .82 + cw * 1.64 * ci2 / 8, cy0 + (ci2 % 2 ? ch * .45 : 0)]);
      pts2.push([hc.X + cw * .82, cy0 + ch]);
      head.appendChild(el('path', { d: poly(pts2), fill: L.hatC, stroke: dk(L.hatC, .8), 'stroke-width': 1 * k }));
      [['#e5484d', -.4], ['#3987e5', 0], ['#2fae6a', .4]].forEach(function (g) { var gx = hc.X + g[1] * cw * Math.cos(a); if (Math.cos(a) > .25) head.appendChild(el('circle', { cx: gx, cy: cy0 + ch * .68, r: 2 * k, fill: g[0] })); });
    }
    if (L.hat === 'phones') {
      head.appendChild(el('path', { d: 'M' + (hc.X - R * 1.02) + ' ' + (hc.Y + 2 * k) + ' A' + (R * 1.04) + ' ' + (R * 1.1) + ' 0 0 1 ' + (hc.X + R * 1.02) + ' ' + (hc.Y + 2 * k), fill: 'none', stroke: '#3a3540', 'stroke-width': 3.2 * k }));
      ears.forEach(function (e) { if (e.f > -0.6) head.appendChild(el('ellipse', { cx: e.x, cy: e.y + 1 * k, rx: 6.5 * k * Math.max(.45, Math.abs(Math.sin(Math.acos(Math.max(-1, Math.min(1, e.f)))))), ry: 9 * k, fill: '#c46a9a' })); });
    }
    if (L.hat === 'cap') {
      var cp = [];
      for (var ci = 0; ci <= 24; ci++) { var t2 = Math.PI * ci / 24; cp.push([hc.X - Math.cos(t2) * R * 1.05, hc.Y - Math.sin(t2) * R * 1.1 + (41 - 52) * k * (1 - Math.sin(t2))]); }
      head.appendChild(el('path', { d: poly(cp), fill: L.hatC }));
    }
    if (shadeOn) head.insertBefore(el('circle', { cx: hc.X, cy: hc.Y, r: R, fill: 'url(#shHead)' }), head.childNodes[2]);
    parts.push([0.5, head]);
    /* things behind or round the head that change sides: long hair, ponytail, bun, hood, a cap's brim */
    if ((L.hair === 'long' || L.hair === 'dreads') && !hatCoversLong()) box(-19, 19, 44, 96, -16, -4, C.hair, behind(0, 52, -10) > 0 ? 0.55 : -0.5, 9);
    if (L.hair === 'braids' && !hatCoversLong()) [-12, 12].forEach(function (bx2) { var b1 = P(bx2, 50 + hb6, -14), b2 = P(bx2, 98 + hb6, -12); parts.push([behind(bx2, 50, -14) > 0 ? 0.55 : -0.5, el('line', { x1: b1.X, y1: b1.Y, x2: b2.X, y2: b2.Y, stroke: C.hair, 'stroke-width': 6 * k, 'stroke-linecap': 'round', 'stroke-dasharray': (4 * k) + ' ' + (1.2 * k) })]); });
    if (L.hair === 'pigtails' && !hatCoversLong()) [-1, 1].forEach(function (sd2) { var p1 = P(sd2 * 21, 46 + hb6, -6), p2 = P(sd2 * 26, 74 + hb6, -8); parts.push([behind(sd2 * 21, 46, -6) > 0 ? 0.56 : -0.4, el('line', { x1: p1.X, y1: p1.Y, x2: p2.X, y2: p2.Y, stroke: C.hair, 'stroke-width': 8 * k, 'stroke-linecap': 'round' })]); });
    if (L.hair === 'pony' && !hatCoversLong()) { var sw2 = w * 3 * Math.sin(ph * 2), b1 = P(0, 42 + hb6, -21), b2 = P(sw2, 80 + hb6, -27); parts.push([behind(0, 42, -21) > 0 ? 0.56 : -0.4, el('line', { x1: b1.X, y1: b1.Y, x2: b2.X, y2: b2.Y, stroke: C.hair, 'stroke-width': 10 * k, 'stroke-linecap': 'round' })]); }
    if (L.hair === 'bun' && !hatCovers) { var bb = P(0, 32 + hb6, -12); parts.push([behind(0, 32, -12) > 0 ? 0.56 : 0.45, el('circle', { cx: bb.X, cy: bb.Y, r: 9 * k, fill: C.hair })]); }
    if (L.top === 'hoodie') box(-17, 17, 70, 94, -15, -5, C.top2, behind(0, 80, -10) > 0 ? 0.3 : -0.3, 8);
    if (L.hat === 'cap') { var bz = rot(0, 22, a).z, br = [[-13, 14], [13, 14], [-13, 33], [13, 33]].map(function (q) { return rot(q[0], q[1], a).x; }), b0 = Math.min.apply(null, br), b9 = Math.max.apply(null, br), byy = P(0, 41 + hb6, 0).Y;
      parts.push([bz > 0 ? 0.57 : 0.45, el('ellipse', { cx: hc.X + (b0 + b9) / 2 * k, cy: byy, rx: Math.max(3, (b9 - b0) / 2) * k, ry: 3.2 * k, fill: dk(L.hatC, .85) })]); }
    if (CHAIR) {
      /* a manual wheelchair: big wheels with hand rims at his sides, a seat, a backrest behind him, small front wheels */
      var whR = 30, spin = ph * 1.2;
      [-1, 1].forEach(function (sd) { var wc = P(sd * 25, 218 - whR, 0), dz = rot(sd * 25, 0, a).z, rx = Math.max(2, whR * Math.abs(Math.sin(a))) * k, ry = whR * k, wz = dz > 0 ? dz + 2 : dz - 30, g = el('g', {});
        g.appendChild(el('ellipse', { cx: wc.X, cy: wc.Y, rx: rx, ry: ry, fill: 'none', stroke: '#2a2d33', 'stroke-width': 3.6 * k }));
        g.appendChild(el('ellipse', { cx: wc.X, cy: wc.Y, rx: rx * .82, ry: ry * .82, fill: 'none', stroke: '#9aa3ad', 'stroke-width': 1.4 * k }));
        for (var si = 0; si < 4; si++) { var sa = spin + si * Math.PI / 4; g.appendChild(el('line', { x1: wc.X - Math.cos(sa) * rx * .8, y1: wc.Y - Math.sin(sa) * ry * .8, x2: wc.X + Math.cos(sa) * rx * .8, y2: wc.Y + Math.sin(sa) * ry * .8, stroke: '#9aa3ad', 'stroke-width': .9 * k })); }
        g.appendChild(el('circle', { cx: wc.X, cy: wc.Y, r: 2.4 * k, fill: '#5b636c' })); parts.push([wz, g]);
        var cw = P(sd * 16, 212, 30); parts.push([dz > 0 ? dz : dz - 30, el('ellipse', { cx: cw.X, cy: cw.Y, rx: Math.max(1.5, 5 * Math.abs(Math.sin(a))) * k, ry: 5 * k, fill: '#2a2d33' })]); });
      var s0 = P(0, 180, -8), s1 = P(0, 180, 30), sw2 = Math.sqrt(Math.pow(24 * Math.cos(a), 2) + Math.pow(4 * Math.sin(a), 2)) * k;
      parts.push([-0.03, el('path', { d: 'M' + (s0.X - sw2) + ' ' + s0.Y + ' L' + (s0.X + sw2) + ' ' + s0.Y + ' L' + (s1.X + sw2) + ' ' + s1.Y + ' L' + (s1.X - sw2) + ' ' + s1.Y + ' Z', fill: '#3a3f4a', stroke: '#3a3f4a', 'stroke-width': 3 * k, 'stroke-linejoin': 'round' })]);
      var b0 = P(0, 176, -20), b1 = P(0, 112 + SEAT, -20), bz = rot(0, -20, a).z > 0 ? 0.7 : -0.5;
      parts.push([bz, el('path', { d: 'M' + (b0.X - sw2) + ' ' + b0.Y + ' L' + (b0.X + sw2) + ' ' + b0.Y + ' L' + (b1.X + sw2) + ' ' + b1.Y + ' L' + (b1.X - sw2) + ' ' + b1.Y + ' Z', fill: '#2f3440', stroke: '#2f3440', 'stroke-width': 3 * k, 'stroke-linejoin': 'round' })]);
    }
    if (CRUTCH) {
      /* forearm crutches: the cuff round the forearm, the handle in the hand, the tip on the ground a little ahead */
      [-1, 1].forEach(function (sd) { var hd = HAND['s' + sd]; if (!hd) return; var tip = P(sd * 34 * BW * L.bp.sh, 216, 10 + 9 * Math.sin(ph + (sd < 0 ? Math.PI : 0)) * w), cuff = { X: hd.X + (hd.X - tip.X) * .32, Y: hd.Y + (hd.Y - tip.Y) * .32 };
        var z2 = hd.z - .15, g2 = el('g', {});
        g2.appendChild(el('line', { x1: cuff.X, y1: cuff.Y, x2: tip.X, y2: tip.Y, stroke: '#9aa3ad', 'stroke-width': 2.6 * k, 'stroke-linecap': 'round' }));
        g2.appendChild(el('circle', { cx: tip.X, cy: tip.Y, r: 2.2 * k, fill: '#2a2d33' }));
        g2.appendChild(el('ellipse', { cx: cuff.X, cy: cuff.Y, rx: 4 * k, ry: 2.4 * k, fill: 'none', stroke: '#5b636c', 'stroke-width': 1.6 * k }));
        parts.push([z2, g2]); });
    }
    parts.sort(function (p, q) { return p[0] - q[0]; });
    return parts;
  }

  /* pets (the sidekick): a dog, a cat, a bunny or a bird, drawn the same 2.5D way – body, head toward where it faces,
     legs that trot when it walks, a tail behind. Fig25.pet(kind, angle, x, ground, scale, phase, walk) → [[depth, el]] */
  var PETS = { dog: { c: '#b07a45', len: 16, h: 22, r: 7, head: 7.5 }, cat: { c: '#5b5f6a', len: 13, h: 18, r: 5.6, head: 6.2 }, bunny: { c: '#e9e4dc', len: 9, h: 9, r: 7.5, head: 6 }, bird: { c: '#3987e5', len: 6, h: 6, r: 5, head: 3.6 } };
  function pet(kind, a, x, gy, k, ph, w) {
    var P0 = PETS[kind]; if (!P0) return []; var out = [], c2 = dk(P0.c, .82), hop = kind === 'bunny' || kind === 'bird' ? Math.abs(Math.sin(ph)) * 6 * (w || 0) : 0;
    function Q(dx, y, dz) { var r = rot(dx, dz, a); return { X: x + r.x * k, Y: gy - (y + hop) * k, Z: r.z }; }
    var body = Q(0, P0.h, 0), head = Q(0, P0.h + P0.head * .8, P0.len), tail = Q(0, P0.h + 2, -P0.len), hz = rot(0, P0.len, a).z;
    var brx = Math.max(P0.r, Math.sqrt(Math.pow(P0.len * Math.sin(a), 2) + Math.pow(P0.r * Math.cos(a), 2))) * k;
    if (kind !== 'bird' && kind !== 'bunny') [-1, 1].forEach(function (sd) { [-1, 1].forEach(function (fb) { var sw = Math.sin(ph + (fb * sd > 0 ? 0 : Math.PI)) * 4 * (w || 0), top = Q(sd * P0.r * .5, P0.h - 2, fb * P0.len * .6), ft = Q(sd * P0.r * .5, 0, fb * P0.len * .6 + sw);
      out.push([rot(sd * 4, fb * 10, a).z * .01 - .5, el('line', { x1: top.X, y1: top.Y, x2: ft.X, y2: ft.Y, stroke: c2, 'stroke-width': 3.4 * k, 'stroke-linecap': 'round' })]); }); });
    var tz = rot(0, -P0.len, a).z * .01 - .2;
    if (kind === 'dog') out.push([tz, el('path', { d: 'M' + tail.X + ' ' + tail.Y + ' q' + (Math.sin(ph * 3) * 4 * k) + ' ' + (-8 * k) + ' ' + (2 * k) + ' ' + (-12 * k), fill: 'none', stroke: P0.c, 'stroke-width': 3 * k, 'stroke-linecap': 'round' })]);
    if (kind === 'cat') out.push([tz, el('path', { d: 'M' + tail.X + ' ' + tail.Y + ' q' + (-6 * k) + ' ' + (-10 * k) + ' ' + (2 * k) + ' ' + (-20 * k), fill: 'none', stroke: P0.c, 'stroke-width': 2.6 * k, 'stroke-linecap': 'round' })]);
    if (kind === 'bunny') out.push([tz, el('circle', { cx: tail.X, cy: tail.Y, r: 3 * k, fill: '#ffffff' })]);
    out.push([0, el('ellipse', { cx: body.X, cy: body.Y, rx: brx, ry: P0.r * k, fill: P0.c })]);
    if (kind === 'bird') { var wg = Q(0, P0.h + 1, -1); out.push([.05, el('ellipse', { cx: wg.X, cy: wg.Y, rx: brx * .7, ry: P0.r * .55 * k, fill: c2 })]); }
    var hg = el('g', {}); hg.appendChild(el('circle', { cx: head.X, cy: head.Y, r: P0.head * k, fill: P0.c }));
    var face = Math.cos(a) > -.2;
    if (kind === 'dog') [-1, 1].forEach(function (sd) { var e = Q(sd * 5, P0.h + P0.head * 1.1, P0.len - 1); hg.appendChild(el('ellipse', { cx: e.X, cy: e.Y + 3 * k, rx: 2.6 * k, ry: 5 * k, fill: c2 })); });
    if (kind === 'cat') [-1, 1].forEach(function (sd) { var e = Q(sd * 4, P0.h + P0.head * 1.6, P0.len); hg.appendChild(el('path', { d: 'M' + (e.X - 2.6 * k) + ' ' + (e.Y + 3 * k) + ' L' + e.X + ' ' + (e.Y - 3.4 * k) + ' L' + (e.X + 2.6 * k) + ' ' + (e.Y + 3 * k) + ' Z', fill: P0.c })); });
    if (kind === 'bunny') [-1, 1].forEach(function (sd) { var e = Q(sd * 2.6, P0.h + P0.head * 2.2, P0.len - 2); hg.appendChild(el('ellipse', { cx: e.X, cy: e.Y, rx: 2.2 * k, ry: 7 * k, fill: P0.c })); });
    if (kind === 'bird') { var bk = Q(0, P0.h + P0.head * .8, P0.len + 4); hg.appendChild(el('path', { d: 'M' + head.X + ' ' + (head.Y - 1 * k) + ' L' + bk.X + ' ' + bk.Y + ' L' + head.X + ' ' + (head.Y + 1.4 * k) + ' Z', fill: '#f2a93b' })); }
    if (face) [-1, 1].forEach(function (sd) { var e = Q(sd * P0.head * .42, P0.h + P0.head * .95, P0.len + P0.head * .7); if (rot(sd * P0.head * .42, P0.len + P0.head * .7, a).z > 0) hg.appendChild(el('circle', { cx: e.X, cy: e.Y, r: 1 * k, fill: '#1b1f27' })); });
    out.push([hz * .01 + .1, hg]);
    return out.sort(function (p, q) { return p[0] - q[0]; });
  }
  /* things held in the moments (Home avatar, still pictures): the hand goes to its grip, the thing is drawn there */
  var HOLDS = { cup: { b: [112, 24] }, umbrella: { b: [100, 18] }, gift: { b: [124, 22], both: 1 }, trophy: { b: [58, 18] }, suitcase: { b: [150, 4] }, dumbbell: { b: [102, 24] }, book: { b: [114, 26], both: 1 }, phone: { b: [56, 34] } };
  function holdPose(kind, a) { var h = HOLDS[kind]; if (!h) return {}; var pz = {}, near = { m: 1, b: h.b }; pz.near = near; if (h.both) pz.far = { m: 1, b: h.b }; return pz; }
  function holdItem(kind, H, k) {
    if (!H) return null; var g = el('g', {}), x = H.X, y = H.Y, f = function (v) { return v.toFixed(1); };
    var add = function (n, at) { g.appendChild(el(n, at)); };
    if (kind === 'cup') { add('rect', { x: f(x - 5 * k), y: f(y - 7 * k), width: f(10 * k), height: f(11 * k), rx: f(2 * k), fill: '#f4f1ea' }); add('path', { d: 'M' + f(x + 5 * k) + ' ' + f(y - 4 * k) + ' q' + f(5 * k) + ' 0 ' + f(5 * k) + ' ' + f(3 * k) + ' q0 ' + f(3 * k) + ' ' + f(-5 * k) + ' ' + f(3 * k), fill: 'none', stroke: '#f4f1ea', 'stroke-width': f(2 * k) });
      [0, 1].forEach(function (i) { add('path', { d: 'M' + f(x - 2 * k + i * 4 * k) + ' ' + f(y - 10 * k) + ' q' + f(-2 * k) + ' ' + f(-3 * k) + ' 0 ' + f(-6 * k), fill: 'none', stroke: 'rgba(255,255,255,.5)', 'stroke-width': f(1.2 * k), 'stroke-linecap': 'round' }); }); }
    if (kind === 'umbrella') { var top = y - 78 * k; add('line', { x1: f(x), y1: f(y + 2 * k), x2: f(x), y2: f(top), stroke: '#3a3f4a', 'stroke-width': f(2 * k) });
      add('path', { d: 'M' + f(x - 46 * k) + ' ' + f(top + 18 * k) + ' Q' + f(x) + ' ' + f(top - 22 * k) + ' ' + f(x + 46 * k) + ' ' + f(top + 18 * k) + ' Q' + f(x + 30 * k) + ' ' + f(top + 12 * k) + ' ' + f(x + 15 * k) + ' ' + f(top + 18 * k) + ' Q' + f(x) + ' ' + f(top + 12 * k) + ' ' + f(x - 15 * k) + ' ' + f(top + 18 * k) + ' Q' + f(x - 30 * k) + ' ' + f(top + 12 * k) + ' ' + f(x - 46 * k) + ' ' + f(top + 18 * k) + ' Z', fill: '#e8743b' });
      add('path', { d: 'M' + f(x) + ' ' + f(y + 2 * k) + ' q0 ' + f(5 * k) + ' ' + f(-4 * k) + ' ' + f(5 * k), fill: 'none', stroke: '#3a3f4a', 'stroke-width': f(2 * k), 'stroke-linecap': 'round' }); }
    if (kind === 'gift') { add('rect', { x: f(x - 11 * k), y: f(y - 10 * k), width: f(22 * k), height: f(18 * k), rx: f(2 * k), fill: '#d93a3a' }); add('rect', { x: f(x - 2 * k), y: f(y - 10 * k), width: f(4 * k), height: f(18 * k), fill: '#f2c94c' }); add('path', { d: 'M' + f(x) + ' ' + f(y - 10 * k) + ' q' + f(-8 * k) + ' ' + f(-8 * k) + ' ' + f(-8 * k) + ' 0 Z M' + f(x) + ' ' + f(y - 10 * k) + ' q' + f(8 * k) + ' ' + f(-8 * k) + ' ' + f(8 * k) + ' 0 Z', fill: '#f2c94c' }); }
    if (kind === 'trophy') { add('path', { d: 'M' + f(x - 8 * k) + ' ' + f(y - 22 * k) + ' h' + f(16 * k) + ' q0 ' + f(14 * k) + ' ' + f(-8 * k) + ' ' + f(15 * k) + ' q' + f(-8 * k) + ' ' + f(-1 * k) + ' ' + f(-8 * k) + ' ' + f(-15 * k) + ' Z', fill: '#f2c94c' }); add('rect', { x: f(x - 2 * k), y: f(y - 7 * k), width: f(4 * k), height: f(5 * k), fill: '#d9a400' }); add('rect', { x: f(x - 6 * k), y: f(y - 2 * k), width: f(12 * k), height: f(4 * k), rx: f(1 * k), fill: '#d9a400' }); }
    if (kind === 'suitcase') { add('line', { x1: f(x), y1: f(y), x2: f(x), y2: f(y + 8 * k), stroke: '#3a3f4a', 'stroke-width': f(2 * k) }); add('rect', { x: f(x - 12 * k), y: f(y + 8 * k), width: f(24 * k), height: f(32 * k), rx: f(4 * k), fill: '#3987e5' }); add('rect', { x: f(x - 12 * k), y: f(y + 20 * k), width: f(24 * k), height: f(3 * k), fill: 'rgba(0,0,0,.18)' }); }
    if (kind === 'dumbbell') { add('line', { x1: f(x - 8 * k), y1: f(y), x2: f(x + 8 * k), y2: f(y), stroke: '#8f9ba5', 'stroke-width': f(2.4 * k) }); [-1, 1].forEach(function (sd) { add('rect', { x: f(x + sd * 8 * k - 2.6 * k), y: f(y - 5 * k), width: f(5.2 * k), height: f(10 * k), rx: f(1.6 * k), fill: '#2a2d33' }); }); }
    if (kind === 'phone') { add('rect', { x: f(x - 3.4 * k), y: f(y - 11 * k), width: f(6.8 * k), height: f(12 * k), rx: f(1.4 * k), fill: '#2b2f3a' }); }
    if (kind === 'book') { add('rect', { x: f(x - 10 * k), y: f(y - 8 * k), width: f(20 * k), height: f(14 * k), rx: f(1.5 * k), fill: '#3987e5' }); add('line', { x1: f(x), y1: f(y - 8 * k), x2: f(x), y2: f(y + 6 * k), stroke: '#f4f1ea', 'stroke-width': f(1.2 * k) }); }
    return g;
  }
  /* the figure (and what it holds, and its pet) as an SVG group string, for pictures that have their own frame */
  function group(look, o) {
    o = o || {}; var a = (o.a == null ? 18 : o.a) * Math.PI / 180, k = o.k || .6, pose = Object.assign(holdPose(o.hold, a), o.pose || {}), g = el('g', { class: o.cls || 'av-all' });
    if (o.shadow !== false) g.appendChild(el('ellipse', { cx: o.cx, cy: o.gy + 1, rx: 16 * k / .5, ry: 3.2 * k / .5, fill: 'rgba(0,0,0,.25)' }));
    var pk = look && look.pet && look.pet !== 'none' && o.pet !== false ? look.pet : '';
    if (pk) { var pg = el('g', { class: 'av-pet' }); pet(pk, a + 1.1, o.cx - 52 * k, o.gy, k, 0, 0).forEach(function (p) { pg.appendChild(p[1]); });   /* the pet turned toward you, seen from its side */ g.appendChild(pg); }
    HAND = {}; var parts = draw(look, a, o.cx, o.gy, k, o.ph || 0, o.w || 0, pose);
    if (o.hold && HOLDS[o.hold]) { var it = holdItem(o.hold, HAND.near, k * (L.hs || 1)); if (it) parts.push([HAND.near.z - .15, it]); parts.sort(function (p, q) { return p[0] - q[0]; }); }
    parts.forEach(function (p) { g.appendChild(p[1]); });
    return g.outerHTML;
  }
  var HAND = {};
  /* a whole picture as a string: tiles in the maker, still pictures, the Home avatar */
  function svg(look, o) {
    o = o || {}; var W = o.w || 120, Hh = o.h || 140, s = el('svg', { viewBox: '0 0 ' + W + ' ' + Hh, xmlns: NS, role: 'img' });
    var d = el('defs', {}); d.innerHTML = DEFS_HTML; s.appendChild(d);
    if (o.shadow !== false) s.appendChild(el('ellipse', { cx: W / 2, cy: Hh - 6, rx: W * .16, ry: 3, fill: 'rgba(0,0,0,.22)' }));
    var a = (o.a == null ? 18 : o.a) * Math.PI / 180, k = o.k || (Hh - 12) / 200;
    var pk = look && look.pet && look.pet !== 'none' && o.pet !== false ? look.pet : '';
    if (pk) pet(pk, a, W / 2 + W * .3, Hh - 6, k, 0, 0).forEach(function (p) { s.appendChild(p[1]); });
    draw(look, a, W / 2 - (pk ? W * .08 : 0), Hh - 6, k, o.ph || 0, o.w2 || 0, o.pose || {}).forEach(function (p) { s.appendChild(p[1]); });
    return s.outerHTML;
  }
  window.Fig25 = {
    /* pool: from Fig25.pool() – the same figure drawn again each frame reuses its elements (see el) */
    draw: function (look, a, cx, gy, k, ph, w, pose, pool) {
      ensureDefs();
      /* with a pool: the same look and the same pose as last frame (he's resting between breaths) – the same parts again, nothing worked out */
      var key = pool ? a + '|' + cx + '|' + gy + '|' + k + '|' + ph + '|' + w + '|' + JSON.stringify(pose || {}) : null;
      if (pool && pool.key === key && pool.look === look && pool.parts) { HAND = pool.hand; return pool.parts.slice(); }
      HAND = {}; POOL = pool || null; if (POOL) POOL.i = 0;
      try { var parts = draw(look, a, cx, gy, k, ph, w, pose); if (pool) { pool.key = key; pool.look = look; pool.parts = parts.slice(); pool.hand = HAND; } return parts; } finally { POOL = null; } },
    pool: function () { return { l: [], i: 0, id: 'f25p' + (++PN) }; },
    petG: function (kind, a, x, gy, k) { ensureDefs(); return pet(kind, a * Math.PI / 180, x, gy, k, 0, 0).map(function (p) { return p[1].outerHTML; }).join(''); },
    svg: svg, group: group, pet: pet, look: look25, HOLDS: HOLDS, hand: function () { return HAND; }, TOP_STD: TOP_STD
  };
})();
