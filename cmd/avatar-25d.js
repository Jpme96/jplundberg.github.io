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
  function mixc(h1, h2, f) { var p = parseInt(h1.slice(1), 16), q = parseInt(h2.slice(1), 16), m = function (sh) { return Math.round(((p >> sh) & 255) * (1 - f) + ((q >> sh) & 255) * f); }; return 'rgb(' + m(16) + ',' + m(8) + ',' + m(0) + ')'; }
  /* proper shading (JP, 2026-11-13): every part is filled with its own colour as a soft gradient across the part – a little
     lighter where the light falls (upper left), the plain colour in the middle, a darker band down the shaded right side.
     One gradient per colour, made when first used and kept in a hidden picture on the page; the plain colour is written
     after it as the fallback, so a part is never left unfilled. A whole picture made as a string carries its own copies (GUSE). */
  var GD = null, GR = {}, GUSE = null;
  function grad(col, dome) {
    if (!shadeOn || typeof col !== 'string') return col;
    var key = dome ? col + '|d' : col, g = GR[key];
    if (g === undefined) { var m = /^#([0-9a-f]{6})$/i.exec(col), r, gg, b;
      if (m) { var n = parseInt(m[1], 16); r = n >> 16; gg = (n >> 8) & 255; b = n & 255; } else { m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(col); if (m) { r = +m[1]; gg = +m[2]; b = +m[3]; } }
      if (!m) { GR[key] = null; return col; }
      var id = (dome ? 'd25' : 'g25') + ((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1), mk = function (f, w) { return 'rgb(' + Math.min(255, Math.round(r * f + w)) + ',' + Math.min(255, Math.round(gg * f + w)) + ',' + Math.min(255, Math.round(b * f + w)) + ')'; }, st = function (o, c) { return '<stop offset="' + o + '" stop-color="' + c + '"/>'; };
      /* a rounded form in the light (JP's reference picture, 2026-11-13): dim at the lit edge, a highlight a quarter of the way in, the plain colour, then falling away to the dark side; a dome (shoulder, hand, kneecap) is lit from its upper left */
      g = GR[key] = { id: id, on: null, html: dome ? '<radialGradient id="' + id + '" cx=".35" cy=".3" r=".8">' + st(0, mk(1, 34)) + st(.5, mk(1.02, 0)) + st(1, mk(.7, 0)) + '</radialGradient>'
        : '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0">' + st(0, mk(.94, 0)) + st(.25, mk(1, 27)) + st(.55, col) + st(.85, mk(.77, 0)) + st(1, mk(.67, 0)) + '</linearGradient>' }; }
    if (!g) return col;
    if (GUSE) GUSE[g.id] = g.html;
    else { if (!GD || !GD.isConnected) { var sv = document.createElementNS(NS, 'svg'); sv.setAttribute('width', '0'); sv.setAttribute('height', '0'); sv.setAttribute('aria-hidden', 'true'); sv.style.position = 'absolute'; GD = document.createElementNS(NS, 'defs'); sv.appendChild(GD); (document.body || document.documentElement).appendChild(sv); }
      if (g.on !== GD) { var t = document.createElementNS(NS, 'svg'); t.innerHTML = g.html; GD.appendChild(t.firstChild); g.on = GD; } }
    return 'url(#' + g.id + ') ' + col;
  }
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
    '<linearGradient id="shBody" x1="0" y1="0" x2="1" y2=".25"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>' +
    '<radialGradient id="f25sh"><stop offset="0" stop-color="#3a2212" stop-opacity=".4"/><stop offset="1" stop-color="#3a2212" stop-opacity="0"/></radialGradient><radialGradient id="f25hl"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>';   /* f25sh / f25hl: a soft shadow and a soft light, for the face */
  var DEFS = null;   /* the defs element once made: checking .isConnected is much cheaper than a lookup by id every frame */
  function ensureDefs() { if (DEFS && DEFS.isConnected) return; DEFS = document.getElementById('shHead'); if (DEFS) return; var s = document.createElementNS(NS, 'svg'); s.setAttribute('width', '0'); s.setAttribute('height', '0'); s.setAttribute('aria-hidden', 'true'); s.style.position = 'absolute'; var d = document.createElementNS(NS, 'defs'); d.innerHTML = DEFS_HTML; s.appendChild(d); (document.body || document.documentElement).appendChild(s); DEFS = d.firstChild; }

  /* a cmd look → what the 2.5D body needs. Choices that share a shape are drawn by the same part. */
  var TOPS = { tee: { bare: 'short' }, tank: { bare: 'arms' }, polo: { collar: 1, bare: 'short' }, sweater: {}, knit: {}, hoodie: {}, shirt: {}, jersey: { bare: 'short', stripe: 1 }, kit: { bare: 'short', stripe: 1 },
    varsity: { sleeve: '#f4f1ea' }, suit: { jacket: '#2e3340', sleeve: '#2e3340' }, puffer: { quilt: 1 }, rain: { hood: 1, zip: 1 }, jacket: { zip: 1 }, dress: { bare: 'short', skirt: 'knee' }, bunad: { band: 1, sleeve: '#f4f4f2' },
    scrubs: { vneck: 1, bare: 'short' }, chef: { buttons2: 1 }, pjs: { stripes: 1 }, robe: { wrap: 1 }, none: { bare: 'arms' } };
  var SHOES = { sneakers: '#1a1a1a', hightops: '#d93a3a', boots: '#5b3a1e', sandals: '#8a5e44', slippers: '#e0559a', cleats: '#1a1a1a' };
  /* the build changes the whole body, not only its width (JP, 2026-11-12: "the composition does not fit the body"):
     w = body width, d = depth (front to back), sh = shoulders, wa = waist, hp = hips, arm / leg = how thick */
  var BUILD = {
    slim:     { w: .9,  d: .88, sh: .92, wa: .86, hp: .9,  arm: .8,  leg: .82, sx: 20, ch: 15.5, wv: 12.3, hv: 13.6, ar: 3.7 },
    regular:  { w: 1,   d: 1,   sh: 1,   wa: 1,   hp: 1,   arm: 1,   leg: 1, sx: 22, ch: 17.5, wv: 14.3, hv: 15.6, ar: 4.3 },   /* sx: where the arm hangs, ch / wv / hv: half the chest, waist and hips seen from the front, ar: the upper arm's radius (JP's anatomy spec 2026-11-13) */
    athletic: { w: 1.04, d: 1.04, sh: 1.2, wa: .84, hp: .98, arm: 1.12, leg: 1.16, mus: 1, sx: 24.2, ch: 19.2, wv: 14.4, hv: 16, ar: 4.9 },   /* mus: muscles are drawn (shoulders, upper arms, thighs, calves; chest and stomach when bare) */
    muscular: { w: 1.1, d: 1.14, sh: 1.34, wa: .88, hp: 1.04, arm: 1.24, leg: 1.3, mus: 2, sx: 26.5, ch: 21.2, wv: 15.6, hv: 17.4, ar: 5.6 },
    broad:    { w: 1.2, d: 1.28, sh: 1.1, wa: 1.22, hp: 1.16, arm: 1.16, leg: 1.2, sx: 24.5, ch: 21.2, wv: 20.6, hv: 21, ar: 5.1 }   /* JP: the build changed too little – the spread is bigger and athletic/muscular have muscles */
  };
  function look25(l) {
    l = l || {}; if (window.Avatar && Avatar.trimLook) l = Avatar.trimLook(l);
    var top = TOPS[l.top] ? l.top : 'sweater', t = TOPS[top], bottom = l.bottom || 'trousers';
    var o = { skin: l.skin || '#c99a73', hairC: l.hairC || '#1e140d', hair: { ponytail: 'pony', topknot: 'bun' }[l.hair] || l.hair || 'short',
      beard: l.beard || 'none', glasses: l.glasses || 'none', expr: l.expr || 'smile', makeup: l.makeup || 'none', cheeks: l.cheeks || 'none', faceS: l.faceS || 'oval', eyeC: /^#[0-9a-f]{6}$/i.test(l.eyeC || '') ? l.eyeC : '#6b4a2b',
      top: top, topC: top === 'chef' ? '#f4f4f2' : (/^#[0-9a-f]{6}$/i.test(l.topC || '') ? l.topC : TOP_STD), bottom: bottom, legsC: l.legs || '#2a2f3a', shoes: l.shoes || 'sneakers',
      hat: l.hat || 'none', hatC: l.hatC || '#e8743b', neck: l.wxScarf ? 'scarf' : 'none', neckC: l.hatC || '#e8743b', aid: l.aid || 'none',
      bare: t.bare || '', sleeve: t.sleeve || '', skirt: t.skirt || (bottom === 'skirt' ? 'knee' : ''), legsOn: bottom === 'shorts' ? 'thigh' : bottom === 'swim' ? 'swim' : top === 'dress' ? 'none' : 'full',
      bw: (BUILD[l.build] || BUILD.regular).w, bp: BUILD[l.build] || BUILD.regular, hs: { short: .975, tall: 1.02 }[l.height] || 1, lf: { short: 1.05, tall: 1.27 }[l.height] || 1.16 };   /* the legs are half his height (JP's reference, 2026-11-13: a 7.5-head figure) */   /* height: mostly the legs (lf), a little overall (hs) */
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
    if (t.jacket) { add('path', { d: TD, fill: grad(t.jacket) }); if (front) { var v1 = P(-9, 80 + bob, 15), v2 = P(0, 112 + bob, 16), v3 = P(9, 80 + bob, 15); add('path', { d: 'M' + v1.X + ' ' + v1.Y + ' L' + v2.X + ' ' + v2.Y + ' L' + v3.X + ' ' + v3.Y + ' Z', fill: '#f4f4f2' }); var ti = P(0, 84 + bob, 16), tb = P(0, 108 + bob, 17); add('path', { d: 'M' + (ti.X - 2 * k) + ' ' + ti.Y + ' L' + (ti.X + 2 * k) + ' ' + ti.Y + ' L' + (tb.X + 2.4 * k) + ' ' + tb.Y + ' L' + tb.X + ' ' + (tb.Y + 3 * k) + ' L' + (tb.X - 2.4 * k) + ' ' + tb.Y + ' Z', fill: '#d42a2f' }); } }
    if (t.quilt) for (var qy = 1; qy <= 4; qy++) { var yy = t1.Y + (t2.Y - t1.Y) * qy / 5; add('path', { d: 'M' + (t1.X - W) + ' ' + yy + ' L' + (t1.X + W) + ' ' + yy, stroke: dk(L.topC, .75), 'stroke-width': 1.4 * k }); }
    if (t.zip && front) { var z1 = P(0, 82 + bob, 16), z2 = P(0, 146 + bob, 17); add('path', { d: 'M' + z1.X + ' ' + z1.Y + ' L' + z2.X + ' ' + z2.Y, stroke: dk(L.topC, .65), 'stroke-width': 1.6 * k }); }
    if (t.stripe) { var sy = t1.Y + 20 * k; add('rect', { x: t1.X - W, y: sy, width: W * 2, height: 6 * k, fill: '#f4f1ea', opacity: .9 }); }
    if (t.band) { var by = t1.Y + 16 * k; add('rect', { x: t1.X - W, y: by, width: W * 2, height: 9 * k, fill: '#d42a2f' }); add('rect', { x: t1.X - W, y: by + 3 * k, width: W * 2, height: 3 * k, fill: '#f2c94c' }); }
    if (t.stripes) for (var sx = -3; sx <= 3; sx++) { var px = t1.X + sx / 3.4 * W; add('path', { d: 'M' + px + ' ' + t1.Y + ' L' + px + ' ' + t2.Y, stroke: '#f4f1ea', 'stroke-width': 2 * k, opacity: .55 }); }
    if (t.wrap && front) { var w1 = P(-12, 80 + bob, 14), w2 = P(10, 132 + bob, 16); add('path', { d: 'M' + w1.X + ' ' + w1.Y + ' L' + w2.X + ' ' + w2.Y, stroke: dk(L.topC, .65), 'stroke-width': 2 * k }); var bl = t1.Y + 50 * k; add('rect', { x: t1.X - W, y: bl, width: W * 2, height: 5 * k, fill: dk(L.topC, .7) }); }
    if (L.top !== 'none' && !t.collar && !t.vneck && !t.jacket && !t.hood && !t.zip && !t.wrap && !t.buttons2 && L.top !== 'shirt' && L.top !== 'hoodie') {   /* a round neckline: the skin shows in a shallow scoop (deeper on a tank top), with the ribbed edge round it */
      var nwd = L.top === 'tank' ? 11 : 9.4, ndp = L.top === 'tank' ? 25 : 17;
      if (front) { var q1 = P(-nwd, 79 + bob, 7), q2 = P(0, 79 + ndp + bob, 13), q3 = P(nwd, 79 + bob, 7); parts.push([.0185, el('path', { d: 'M' + q1.X.toFixed(1) + ' ' + q1.Y.toFixed(1) + ' Q' + q2.X.toFixed(1) + ' ' + q2.Y.toFixed(1) + ' ' + q3.X.toFixed(1) + ' ' + q3.Y.toFixed(1) + ' Z', fill: L.skin, stroke: dk(L.topC, .7), 'stroke-width': (1.3 * k).toFixed(2), 'stroke-linejoin': 'round' })]); }
      else if (fr < -.15) { var r1 = P(-nwd, 80 + bob, -6), r2 = P(0, 84.5 + bob, -10), r3 = P(nwd, 80 + bob, -6); parts.push([.0185, el('path', { d: 'M' + r1.X.toFixed(1) + ' ' + r1.Y.toFixed(1) + ' Q' + r2.X.toFixed(1) + ' ' + r2.Y.toFixed(1) + ' ' + r3.X.toFixed(1) + ' ' + r3.Y.toFixed(1), fill: 'none', stroke: dk(L.topC, .7), 'stroke-width': (1.3 * k).toFixed(2), 'stroke-linecap': 'round' })]); } }
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
    /* height changes the legs: below the hips everything stretches from the ground up, above them it all moves up or down by the same amount */
    var LF = L.aid === 'chair' ? 1 : L.lf || 1;
    function wy(y) { if (LF === 1) return y; return y >= HY ? 218 - (218 - y) * LF : y - (218 - HY) * (LF - 1); }
    function uy(y) { if (LF === 1) return y; var hy2 = HY - (218 - HY) * (LF - 1); return y >= hy2 ? 218 - (218 - y) / LF : y + (218 - HY) * (LF - 1); }
    function P(x, y, z, up) { if (LN && (up || y < HY - 4)) { var dy = y - HY; y = HY + dy * LC + z * LS; z = z * LC - dy * LS; }
      var r = rot(x, z, a); return { X: cx + r.x * k, Y: gy + (wy(y) - 218) * k, Z: r.z }; }
    /* a point on the screen back to the body's own (height, forward) – for hands and feet that must land on something */
    function toBody(S, xl) { return { y: uy(218 + (S[1] - gy) / k), z: (S[0] - cx - (xl || 0) * Math.cos(a) * k) / (k * (Math.abs(Math.sin(a)) < .2 ? (Math.sin(a) < 0 ? -.2 : .2) : Math.sin(a))) }; }
    function unlean(b) { if (!LN) return b; var dy = b.y - HY; return { y: HY + dy * LC - b.z * LS, z: b.z * LC + dy * LS }; }
    /* two-bone reach: the angles (from straight down, forward positive) of the upper and lower part to touch (dy, dz) */
    function ik(dy, dz, l1, l2, bend) { var D = Math.hypot(dy, dz), D2 = Math.max(Math.abs(l1 - l2) + .5, Math.min(l1 + l2 - .3, D)), ph0 = Math.atan2(dz, dy);
      var al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + D2 * D2 - l2 * l2) / (2 * l1 * D2)))), a1 = ph0 + bend * al;
      var ty = Math.cos(ph0) * D2, tz = Math.sin(ph0) * D2; return [a1, Math.atan2(tz - l1 * Math.sin(a1), ty - l1 * Math.cos(a1))]; }
    function limb(p1, p2, wid, col, z) { parts.push([z, el('line', { x1: p1.X.toFixed(1), y1: p1.Y.toFixed(1), x2: p2.X.toFixed(1), y2: p2.Y.toFixed(1), stroke: col, 'stroke-width': (wid * k).toFixed(1), 'stroke-linecap': 'round' })]); }
    /* a limb that is thicker at one end (thigh to knee, calf to ankle): two round ends joined by their tangents */
    function taper(p1, p2, r1, r2, col, z, flat) {
      if (CHN) { CHN.push([p1, p2, r1 * k, r2 * k]); return; }
      r1 *= k; r2 *= k; var dx = p2.X - p1.X, dy = p2.Y - p1.Y, d = Math.hypot(dx, dy) || .001, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
      var sn = Math.max(-.95, Math.min(.95, (r1 - r2) / d)), cs = Math.sqrt(1 - sn * sn);
      var ax = nx * cs + ux * sn, ay = ny * cs + uy * sn, bx = -nx * cs + ux * sn, by = -ny * cs + uy * sn;
      var r1s = r1.toFixed(1), r2s = r2.toFixed(1), s1 = (p1.X + ax * r1).toFixed(1) + ' ' + (p1.Y + ay * r1).toFixed(1);
      var dd = 'M' + s1 + ' L' + (p2.X + ax * r2).toFixed(1) + ' ' + (p2.Y + ay * r2).toFixed(1) + (flat ? ' L' : ' A' + r2s + ' ' + r2s + ' 0 0 0 ') + (p2.X + bx * r2).toFixed(1) + ' ' + (p2.Y + by * r2).toFixed(1) +
        ' L' + (p1.X + bx * r1).toFixed(1) + ' ' + (p1.Y + by * r1).toFixed(1) + ' A' + r1s + ' ' + r1s + ' 0 0 0 ' + s1 + ' Z';
      if (ACC) ACC.push(dd); else parts.push([z, el('path', { d: dd, fill: grad(col) })]);
    }
    var CHN = null, RIM = '#A9BCD8';
    /* a whole limb as one shape (its pieces joined), so its shading runs unbroken from shoulder to wrist, hip to ankle */
    /* a cast shadow: the strip of a limb just below a hem (a sleeve, the shorts), darkened – only when he is big enough to see it */
    function hemShade(pA, pB, r1, r2, z) { if (k <= .85) return; var ux = pB.X - pA.X, uy = pB.Y - pA.Y, ul = Math.hypot(ux, uy) || 1, hx = -uy / ul, hy = ux / ul; r1 *= k; r2 *= k;
      parts.push([z, el('path', { d: 'M' + (pA.X + hx * r1).toFixed(1) + ' ' + (pA.Y + hy * r1).toFixed(1) + ' L' + (pB.X + hx * r2).toFixed(1) + ' ' + (pB.Y + hy * r2).toFixed(1) + ' L' + (pB.X - hx * r2).toFixed(1) + ' ' + (pB.Y - hy * r2).toFixed(1) + ' L' + (pA.X - hx * r1).toFixed(1) + ' ' + (pA.Y - hy * r1).toFixed(1) + ' Z', fill: '#000', opacity: .26 })]); }
    /* flat light and shade shapes (JP's reference, 2026-11-13): big enough to see, the muscles are shown as soft flat patches –
       lighter where the light from the upper left lands, darker on the turned-away side – on top of each part's own gradient */
    var CEL = k > .85, LTC = mixc(/^#[0-9a-f]{6}$/i.test(L.skin) ? L.skin : '#c99a73', '#ffffff', .42);   /* the light on skin is a lighter skin tone (white went chalky on dark skin) */
    function celE(px, py, pz, rxu, ryu, light, op, depth, rotd) { var c = P(px, py, pz), e1 = P(px - rxu, py, pz), e2 = P(px + rxu, py, pz), rxs = Math.abs(e2.X - e1.X) / 2; if (rxs < .6 * k || op < .02) return;
      var at = { cx: c.X.toFixed(1), cy: c.Y.toFixed(1), rx: rxs.toFixed(1), ry: (ryu * k).toFixed(1), fill: light ? LTC : '#000', opacity: (light ? Math.min(1, op * 1.7) : op).toFixed(2) }; if (rotd) at.transform = 'rotate(' + rotd + ' ' + at.cx + ' ' + at.cy + ')'; parts.push([depth, el('ellipse', at)]); }
    function celL(pA, pB, t, off, rw, rl, light, op, depth) { var x = pA.X + (pB.X - pA.X) * t + off * k, y = pA.Y + (pB.Y - pA.Y) * t, ang = Math.atan2(pB.Y - pA.Y, pB.X - pA.X) * 180 / Math.PI - 90;
      parts.push([depth, el('ellipse', { cx: x.toFixed(1), cy: y.toFixed(1), rx: (rw * k).toFixed(1), ry: (rl * k).toFixed(1), fill: light ? LTC : '#000', opacity: (light ? Math.min(1, op * 1.7) : op).toFixed(2), transform: 'rotate(' + ang.toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')' })]); }
    /* a whole limb as one flowing shape: its pieces (shoulder to wrist, hip to ankle) give a width at each joint, and the outline is
       a smooth line through them down one side and up the other – so the muscles swell and the joints narrow without corners, and
       the shading runs unbroken. rim: also a thin cool light down its dark edge (the parts on his far side from the light) */
    var ACC = null; function whole(col, z, fn, rim) { CHN = []; fn(); var ch = CHN; CHN = null; if (!ch.length) return;
      var J = [ch[0][0]], Rr = [ch[0][2]], i; for (i = 0; i < ch.length; i++) { J.push(ch[i][1]); Rr.push(ch[i][3]); }
      var A = [], B = [], n = J.length, lx = 0, ly = 1;
      for (i = 0; i < n; i++) { var p0 = J[Math.max(0, i - 1)], p9 = J[Math.min(n - 1, i + 1)], dx = p9.X - p0.X, dy = p9.Y - p0.Y, dl = Math.hypot(dx, dy); if (dl > .01) { lx = dx / dl; ly = dy / dl; }
        A.push([J[i].X - ly * Rr[i], J[i].Y + lx * Rr[i]]); B.push([J[i].X + ly * Rr[i], J[i].Y - lx * Rr[i]]); }
      var Br = B.slice().reverse(), r9 = Rr[n - 1].toFixed(1), r0 = Rr[0].toFixed(1);
      var dd = 'M' + A[0][0].toFixed(1) + ' ' + A[0][1].toFixed(1) + side2(A) + ' A' + r9 + ' ' + r9 + ' 0 0 0 ' + Br[0][0].toFixed(1) + ' ' + Br[0][1].toFixed(1) + side2(Br) + ' A' + r0 + ' ' + r0 + ' 0 0 0 ' + A[0][0].toFixed(1) + ' ' + A[0][1].toFixed(1) + ' Z';
      parts.push([z, el('path', { d: dd, fill: grad(col) })]);
      if (rim && k > .85) { var E = (B[0][0] + B[n - 1][0] >= A[0][0] + A[n - 1][0] ? B : A).map(function (q, qi) { var o = q === B[qi] ? -1 : 1; return q; });
        parts.push([z + .0016, el('path', { d: 'M' + E[0][0].toFixed(1) + ' ' + E[0][1].toFixed(1) + side2(E), fill: 'none', stroke: RIM, 'stroke-width': (.6 * k).toFixed(2), 'stroke-linecap': 'round', opacity: .5 })]); } }

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
      var LW = L.bp.leg, HX = L.bp.hv * .5, hip = [sd * HX, 140 + bob, 0], knee = [hip[0] * 1.05, hip[1] + 38 * Math.cos(th), hip[2] + 38 * Math.sin(th)];
      var ank = [hip[0] * 1.08, knee[1] + 36 * Math.cos(th - kn), knee[2] + 36 * Math.sin(th - kn)];
      var lift = Math.max(0, 218 - 4 - ank[1]); /* stays on the ground */
      if (ank[1] > 214) { var d = ank[1] - 214; knee[1] -= d; ank[1] = 214; hip[1] -= 0; }
      var a1 = P(hip[0], hip[1], hip[2]), a2 = P(knee[0], knee[1], knee[2]), a3 = P(ank[0], ank[1], ank[2]), toe = P(ank[0], ank[1] + 3.6, ank[2] + 14);   /* a foot about as long as the forearm */
      var far = rot(sd * 8, 0, a).z < 0, z = -0.02 + rot(sd * 8, 0, a).z * 0.0005;
      if (knee[2] > 14 && Math.abs(Math.cos(a)) > .5) z = 0.006 + rot(sd * 8, 0, a).z * 0.0005;   /* a deep squat or sitting, seen from the front: the thighs come toward you, in front of the body – they were hidden behind it */   /* the legs always go under the seat and the top (the near thigh used to poke over the waist when seen from the side); near leg still in front of the far one */
      /* a human leg: full at the hip, narrower at the knee, the calf swells a little below it, slim at the ankle */
      var lc = shade(far, C.legs2, C.legs), skc = shade(far, C.skin2, C.skin), calf = P(knee[0], knee[1] + (ank[1] - knee[1]) * .32, knee[2] + (ank[2] - knee[2]) * .32);
      var thighC = L.legsOn === 'none' || L.legsOn === 'swim' || L.legsOn === 'thigh' ? skc : lc, shinC = L.legsOn === 'full' ? lc : skc;
      var MUL = 1 + .07 * (L.bp.mus || 0);   /* athletic/muscular: fuller thighs and calves */
      var rT = HX * .97, rK = HX * .66, rC = HX * .72 * MUL, rA = HX * .46;   /* the thighs meet at the groin (as wide as half the hips) and narrow to the knee, so the legs part in a V with a small gap */
      whole(thighC, z, function () { taper(a1, a2, rT, rK, thighC, z); taper(a2, calf, rK, rC, shinC, z); taper(calf, a3, rC, rA, shinC, z); }, a1.X > cx + .5 * k);
      if (shinC === skc && Math.cos(a) > .3) { var kn1 = P(knee[0] - rK * .5, knee[1] + 1.6, knee[2] + rK), kn2 = P(knee[0], knee[1] + 3.9, knee[2] + rK), kn3 = P(knee[0] + rK * .5, knee[1] + 1.6, knee[2] + rK);
        if (CEL) { var lz = Math.min(1, (Math.cos(a) - .3) * 2), lm = 1 + .3 * (L.bp.mus || 0), dkc = dk(L.skin, .62);
          var q1 = { X: a1.X + (a2.X - a1.X) * .16 + sd * rT * .22 * k * Math.cos(a), Y: a1.Y + (a2.Y - a1.Y) * .16 }, q2 = { X: a1.X + (a2.X - a1.X) * .9, Y: a1.Y + (a2.Y - a1.Y) * .9 };
          parts.push([z + .0003, el('path', { d: 'M' + q1.X.toFixed(1) + ' ' + q1.Y.toFixed(1) + ' Q' + ((q1.X + q2.X) / 2 + sd * 1.2 * k).toFixed(1) + ' ' + ((q1.Y + q2.Y) / 2).toFixed(1) + ' ' + q2.X.toFixed(1) + ' ' + q2.Y.toFixed(1), fill: 'none', stroke: dkc, 'stroke-width': (.8 * k).toFixed(2), 'stroke-linecap': 'round', opacity: (.32 * lz * lm).toFixed(2) })]);   /* the line of the thigh muscle down to the knee */
          var kc = P(knee[0], knee[1] - 2.2, knee[2] + rK); parts.push([z + .0013, el('ellipse', { cx: kc.X.toFixed(1), cy: kc.Y.toFixed(1), rx: (rK * .4 * k).toFixed(1), ry: (4.3 * k).toFixed(1), fill: grad(skc, 1), opacity: (.9 * lz).toFixed(2) })]);   /* the kneecap */
          celL(a2, a3, .13, 0, rK * .6, 1.7, 0, .16 * lz, z + .0012); celL(a2, a3, .47, -rC * .34, rC * .2, 8, 1, .2 * lz, z + .0012); }   /* a soft shade under the kneecap, the light on the shin */
        parts.push([z + .0015, el('path', { d: 'M' + kn1.X.toFixed(1) + ' ' + kn1.Y.toFixed(1) + ' Q' + kn2.X.toFixed(1) + ' ' + kn2.Y.toFixed(1) + ' ' + kn3.X.toFixed(1) + ' ' + kn3.Y.toFixed(1), fill: 'none', stroke: dk(L.skin, .78), 'stroke-width': (.9 * k).toFixed(2), 'stroke-linecap': 'round', opacity: .45 })]); }   /* a small line under the knee */
      if (L.legsOn === 'thigh') { var kf = .6, kb = P(knee[0], hip[1] + (knee[1] - hip[1]) * kf, hip[2] + (knee[2] - hip[2]) * kf); taper(a1, kb, rT + .3, rT + (rK - rT) * kf + 1.5, lc, z + .001, 1);
        hemShade(kb, P(knee[0], hip[1] + (knee[1] - hip[1]) * (kf + .075), hip[2] + (knee[2] - hip[2]) * (kf + .075)), rT + (rK - rT) * kf + .2, rT + (rK - rT) * (kf + .075) + .2, z + .0005); }   /* shorts: a straight hem on each leg – with the gap between the legs that is the inverted V at the crotch */
      if (L.legsOn === 'swim') { var sb = P(hip[0] + (knee[0] - hip[0]) * .42, hip[1] + (knee[1] - hip[1]) * .42, hip[2] + (knee[2] - hip[2]) * .42); taper(a1, sb, rT + .3, rT + (rK - rT) * .42 + 1.1, lc, z + .001, 1); }
      if (L.bottom === 'jeans') limb(P(hip[0] + sd * 4, hip[1] + 6, hip[2] + 8), P(knee[0] + sd * 4, knee[1], knee[2] + 6), .9, 'rgba(242,201,76,.55)', z + .002);
      if (L.bottom === 'joggers') parts.push([z + .002, el('circle', { cx: a3.X, cy: a3.Y - 1.5 * k, r: 4.6 * k, fill: dk(L.legsC, .78) })]);
      if (L.bottom === 'cargo') { var cpk = P(knee[0] + sd * 2, hip[1] + (knee[1] - hip[1]) * .55, hip[2] + (knee[2] - hip[2]) * .55 + 6); parts.push([z + .003, el('rect', { x: cpk.X - 4 * k, y: cpk.Y - 4 * k, width: 8 * k, height: 8 * k, rx: 1.5 * k, fill: dk(L.legsC, .85) })]); }
      var mid2 = P(ank[0], ank[1] + 3.6, ank[2] + 4); parts.push([z + 0.49, el('ellipse', { cx: mid2.X, cy: mid2.Y, rx: (6.2 * Math.abs(Math.cos(a)) + 3.6) * k, ry: 4.3 * k, fill: L.shoes === 'sandals' ? skc : C.shoe })]);   /* the shoe's width, seen from the front */
      taper(P(ank[0], ank[1] + 3.2, ank[2] - 4), toe, 5, 4.4, L.shoes === 'sandals' ? skc : C.shoe, z + 0.5);
      if (L.shoes === 'sandals') limb(P(ank[0], ank[1] + 4, ank[2] + 3), P(ank[0], ank[1] + 4, ank[2] + 9), 3, '#8a5e44', z + .51);
      if (L.shoes === 'sneakers' || L.shoes === 'hightops' || L.shoes === 'cleats') limb(P(ank[0], ank[1] + 6.6, ank[2] - 3), P(ank[0], ank[1] + 6.6, ank[2] + 16.5), 1.8, '#f4f4f2', z + .52);
      if (L.shoes === 'cleats') [-1, 6.5, 14].forEach(function (cz) { var st = P(ank[0], ank[1] + 8.6, ank[2] + cz); parts.push([z + .53, el('rect', { x: st.X - 1 * k, y: st.Y, width: 2 * k, height: 2.4 * k, fill: '#9aa3ad' })]); });
      if (L.shoes === 'hightops' || L.shoes === 'boots') taper(P(ank[0], ank[1] - (L.shoes === 'boots' ? 9 : 5.5), ank[2]), P(ank[0], ank[1] + 1.5, ank[2]), rA + (L.shoes === 'boots' ? 1.4 : .9), rA + 1.6, C.shoe, z + .5);
    });
    /* the seat: a rounded pelvis in the trousers' colour where the legs meet the body, fuller at the back –
       from the side you see the bottom, from the front the hips */
    var pw = Math.sqrt(Math.pow(L.bp.hv * Math.cos(a), 2) + Math.pow(11.2 * L.bp.d * Math.sin(a), 2)) * k, pc = P(0, 144 + bob, -2.5 * Math.abs(Math.sin(a))), pT = pc.Y - 2 * k, pB = pc.Y + 9 * k, pV = pc.Y + (6 + 5 * Math.abs(Math.sin(a))) * k;
    /* the bottom edge rises to the groin in the middle (an inverted V); from the side it is the round of the bottom */
    parts.push([-0.005, el('path', { d: 'M' + (pc.X - pw).toFixed(1) + ' ' + pT.toFixed(1) + ' L' + (pc.X + pw).toFixed(1) + ' ' + pT.toFixed(1) + ' Q' + (pc.X + pw).toFixed(1) + ' ' + pB.toFixed(1) + ' ' + (pc.X + pw * .62).toFixed(1) + ' ' + (pB + 2 * k).toFixed(1) + ' L' + pc.X.toFixed(1) + ' ' + pV.toFixed(1) + ' L' + (pc.X - pw * .62).toFixed(1) + ' ' + (pB + 2 * k).toFixed(1) + ' Q' + (pc.X - pw).toFixed(1) + ' ' + pB.toFixed(1) + ' ' + (pc.X - pw).toFixed(1) + ' ' + pT.toFixed(1) + ' Z', fill: grad(L.legsOn === 'none' ? C.skin2 : C.legs) })]);
    if (L.skirt) { var skW = function (wu, du) { return Math.sqrt(Math.pow(wu * Math.cos(a), 2) + Math.pow(du * L.bp.d * Math.sin(a), 2)) * k; }, sk1 = P(0, 132 + bob, 0), skh = P(0, 147 + bob, -1), sk2 = P(0, L.skirt === 'long' ? 196 : 176, 0), skc2 = L.top === 'dress' ? C.top : C.legs;
      var skw1 = skW(L.bp.wv + (L.bp.hv - L.bp.wv) * .35 + .4, 10.8), skwh = skW(L.bp.hv + 1, 12), skw2 = skwh * (L.skirt === 'long' ? 1.5 : 1.34), sf = function (v) { return v.toFixed(1); };
      /* a skirt starts as wide as the waist it hangs from, rounds over the hips and flares to the hem (it used to start wider than the body: two corners stuck out at the hips) */
      parts.push([0.004, el('path', { d: 'M' + sf(sk1.X - skw1) + ' ' + sf(sk1.Y) + ' L' + sf(sk1.X + skw1) + ' ' + sf(sk1.Y) + ' Q' + sf(skh.X + skwh * 1.04) + ' ' + sf(skh.Y) + ' ' + sf(sk2.X + skw2) + ' ' + sf(sk2.Y) + ' Q' + sf(sk2.X) + ' ' + sf(sk2.Y + 4 * k) + ' ' + sf(sk2.X - skw2) + ' ' + sf(sk2.Y) + ' Q' + sf(skh.X - skwh * 1.04) + ' ' + sf(skh.Y) + ' ' + sf(sk1.X - skw1) + ' ' + sf(sk1.Y) + ' Z', fill: grad(skc2) })]); }
    /* torso: an oval tube – its width depends on which way he faces; the side towards the back is darker */
    var BP = L.bp, wid = function (f) { return Math.sqrt(Math.pow(30 * BW * f * Math.cos(a), 2) + Math.pow(12.6 * BP.d * Math.sin(a), 2)); };
    var hw = Math.sqrt(Math.pow((BP.ch + 1) * Math.cos(a), 2) + Math.pow(12.6 * BP.d * Math.sin(a), 2)), hwT = wid(BP.sh) * .92, topY = 80 + bob, botY = 146 + bob;   /* hw: at the waist (details use it); hwT: across the shoulders */
    var t1 = P(0, topY, 0), t2 = P(0, botY, 0);
    /* a human trunk (phase 1 of the avatar brief): the neck's base, sloping to round shoulders, a chest, a waist that narrows
       and hips – each level has its width from the front, its depth from the side and how far forward it sits (the chest
       forward, the bottom back), so the outline changes properly as he turns */
    var MUT = BP.mus || 0, NW = 5.4 + .5 * MUT, mixw = function (p, q, f) { return p + (q - p) * f; };
    /* the trunk, level by level (JP's anatomy spec): the traps slope from the neck to the shoulders, the lats are widest
       under the armpits, the sides run in to the waist (a V) and flare a little over the hips */
    /* from the side (JP 2026-11-13: the chest came to a sharp point and the trunk was as deep as it was wide): a chest about two thirds as deep as it is
       wide, its front a soft line – out a little to the chest, gently in to the stomach – and the back a slight S (shoulder blades, the small of the back, the seat) */
    var LV = [[79, NW, 6.4, 0], [82.5 - .6 * MUT, mixw(NW, BP.sx, .5), 8.2 * BP.d, -.8], [87.5, BP.sx - 1, 10.4 * BP.d, 0], [99, BP.ch + .8, (11.9 + .45 * MUT) * BP.d, .9 + .3 * MUT], [113, mixw(BP.ch, BP.wv, .6), 11.7 * BP.d, .9],
      [128, BP.wv, 10.4 * BP.d * (.5 + .5 * BP.wa), .6], [138, mixw(BP.wv, BP.hv, .7), 10.8 * BP.d, -.3], [146, BP.hv, 11.4 * BP.d, -1.2]];
    var TL = [], TR = [], ca = Math.cos(a), sa0 = Math.sin(a), LN2 = LV.length - 1;
    LV.forEach(function (q) { var c0 = P(0, q[0] + bob, q[3]), hwq = Math.sqrt(Math.pow(q[1] * ca, 2) + Math.pow(q[2] * sa0, 2)) * k; TL.push([c0.X - hwq, c0.Y]); TR.push([c0.X + hwq, c0.Y]); });
    function f1(v) { return v.toFixed(1); }
    /* a smooth line through the levels (no steps: the side is one flowing edge) */
    function side2(pts) { var d = '', n = pts.length; if (k <= .85) { for (var i0 = 1; i0 < n; i0++) d += ' L' + f1(pts[i0][0]) + ' ' + f1(pts[i0][1]); return d; }   /* drawn small, straight pieces between the points look the same and cost a third (a scene draws him 60 times a second) */
      for (var i = 1; i < n; i++) { var p0 = pts[Math.max(0, i - 2)], p1 = pts[i - 1], p2 = pts[i], p3 = pts[Math.min(n - 1, i + 1)];
      d += ' C' + f1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + f1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]); } return d; }
    var TLr = TL.slice().reverse();
    var TD = 'M' + f1(TR[0][0]) + ' ' + f1(TR[0][1]) + side2(TR) + ' Q' + f1(t2.X) + ' ' + f1(t2.Y + 5 * k) + ' ' + f1(TL[LN2][0]) + ' ' + f1(TL[LN2][1]) + side2(TLr) + ' Q' + f1(t1.X) + ' ' + f1(TL[0][1] - 2 * k) + ' ' + f1(TR[0][0]) + ' ' + f1(TR[0][1]) + ' Z';
    parts.push([0, el('path', { d: TD, fill: grad(L.top === 'none' ? C.skin : C.top) })]);
    if (k > .85) parts.push([.0102, el('path', { d: 'M' + f1(TR[3][0] - .5 * k) + ' ' + f1(TR[3][1]) + side2(TR.slice(3, L.skirt ? 6 : 9).map(function (q) { return [q[0] - .5 * k, q[1]]; })), fill: 'none', stroke: RIM, 'stroke-width': (.65 * k).toFixed(2), 'stroke-linecap': 'round', opacity: .5 })]);   /* the rim light down the trunk's dark side */
    if (k > .85 && !L.skirt) parts.push([-0.001, el('path', { d: 'M' + f1(TL[LN2][0]) + ' ' + f1(TL[LN2][1] - 2 * k) + ' L' + f1(TR[LN2][0]) + ' ' + f1(TR[LN2][1] - 2 * k) + ' L' + f1(TR[LN2][0]) + ' ' + f1(TR[LN2][1] + 2.6 * k) + ' Q' + f1(t2.X) + ' ' + f1(t2.Y + 8.4 * k) + ' ' + f1(TL[LN2][0]) + ' ' + f1(TL[LN2][1] + 2.6 * k) + ' Z', fill: '#000', opacity: .2 })]);   /* the top's shadow on the waistband */
    topDetails(parts, a, k, t1, t2, hw, bob, P, TD, topY, botY);
    if (CEL && L.top === 'none' && Math.cos(a) > .3) {   /* bare, big enough to see: the chest and stomach as light and dark shapes (after JP's reference picture) */
      var cz = Math.min(1, (Math.cos(a) - .3) * 2), cm = BP.mus ? .75 + .25 * BP.mus : .4, CH = BP.ch, d1 = dk(L.skin, .64), d2 = dk(L.skin, .5), pp = function (x, y, z) { var p = P(x, y + bob, z); return f1(p.X) + ' ' + f1(p.Y); };
      var shp = function (d, col, op) { if (op > .02) parts.push([.0107, el('path', { d: d, fill: col, opacity: op.toFixed(2) })]); };
      [-1, 1].forEach(function (sd) { var lit = sd < 0 ? 1 : .6, dc = sd < 0 ? d1 : d2;
        celE(sd * CH * .48, 95.5 + bob, 14, CH * .36, 5.6, 1, .24 * cz * cm * lit, .0105);   /* a pec catches the light */
        shp('M' + pp(sd * CH * .96, 96.5, 10) + ' Q' + pp(sd * CH * .5, 107.5, 13.5) + ' ' + pp(sd * .5, 101.5, 15) + ' L' + pp(sd * .5, 105.2, 15) + ' Q' + pp(sd * CH * .52, 112, 13.5) + ' ' + pp(sd * CH * .9, 101.5, 10) + ' Z', dc, .52 * cz * cm);   /* and throws a shadow under it */
        shp('M' + pp(sd * CH * .84, 108, 9) + ' Q' + pp(sd * CH * .6, 126, 11) + ' ' + pp(sd * 5.5, 146, 13) + ' L' + pp(sd * 10.5, 146, 12) + ' Q' + pp(sd * BP.wv * .86, 128, 9.5) + ' ' + pp(sd * (mixw(CH, BP.wv, .55) - 1), 114, 6) + ' Z', dc, (sd < 0 ? .24 : .34) * cz * cm);   /* the side of the stomach turns away, from under the chest down to the hip */
        if (BP.mus) { [109.5, 118, 126.5].forEach(function (ay, ai) { celE(sd * 4.6, ay + bob, 14.8, 3.6 - ai * .2, 3.2, 1, .28 * cz * lit, .0105); if (ai < 2) celE(sd * 4.6, ay + 4.3 + bob, 14.8, 4, .85, 0, .3 * cz, .0106); });   /* the stomach's blocks and the grooves between them */
          shp('M' + pp(sd * 11, 136, 12.5) + ' Q' + pp(sd * 6, 142, 13.5) + ' ' + pp(sd * 2.5, 146.5, 14) + ' L' + pp(sd * 5, 146.5, 13.8) + ' Q' + pp(sd * 8, 142, 13) + ' ' + pp(sd * 12.5, 138.5, 12) + ' Z', dc, .5 * cz * cm);   /* the V at the hips */
          if (sd < 0) [0, 1, 2].forEach(function (si) { celE(-(CH * .8 - si * 1.1), 105.5 + si * 4 + bob, 9.5, 1.7, .8, 0, .32 * cz, .0106); }); } });   /* the ribs' muscles under the lit arm */
      var st1 = P(0, 92.5 + bob, 15), st2 = P(0, 104 + bob, 15.2), st3 = P(0, 143 + bob, 14.5);
      parts.push([.0107, el('path', { d: 'M' + f1(st1.X) + ' ' + f1(st1.Y) + ' L' + f1(st2.X) + ' ' + f1(st2.Y) + (BP.mus ? ' L' + f1(st3.X) + ' ' + f1(st3.Y) : ''), fill: 'none', stroke: d1, 'stroke-width': (1.2 * k).toFixed(2), 'stroke-linecap': 'round', opacity: (.42 * cz * cm).toFixed(2) })]);   /* the breastbone, and the line down the stomach */
    }
    if (!CEL && L.top === 'none' && BP.mus && Math.cos(a) > .3) {   /* small, bare and fit: the chest and the stomach are drawn as soft lines that turn with him */
      var mc = dk(L.skin, .8), mo = (Math.min(1, (Math.cos(a) - .3) * 2) * (.4 + .15 * BP.mus)).toFixed(2), pecY = 101 + bob, ml = function (d, wd) { parts.push([0.012, el('path', { d: d, fill: 'none', stroke: mc, 'stroke-width': ((wd || 1) * k).toFixed(2), 'stroke-linecap': 'round', opacity: mo })]); };
      var hl = P(-BP.ch * .46, pecY - 6, 14); parts.push([0.011, el('ellipse', { cx: hl.X.toFixed(1), cy: hl.Y.toFixed(1), rx: (BP.ch * .3 * Math.cos(a) * k).toFixed(1), ry: (6.5 * k).toFixed(1), fill: '#fff', opacity: (.06 * Math.min(1, (Math.cos(a) - .3) * 2)).toFixed(2) })]);   /* the light catches the chest on the lit side */
      [-1, 1].forEach(function (sd) { var pa1 = P(sd * 1.5, pecY - 1, 15), pa2 = P(sd * BP.ch * .5, pecY + 4, 13.5), pa3 = P(sd * BP.ch * .9, pecY - 6, 10);
        ml('M' + f1(pa1.X) + ' ' + f1(pa1.Y) + ' Q' + f1(pa2.X) + ' ' + f1(pa2.Y) + ' ' + f1(pa3.X) + ' ' + f1(pa3.Y), 1.1); });
      /* the stomach: the middle line, three rows of short curves either side of it, and the V of the obliques down to the hips */
      var ab1 = P(0, pecY + 3, 15), ab2 = P(0, 141 + bob, 14); ml('M' + f1(ab1.X) + ' ' + f1(ab1.Y) + ' L' + f1(ab2.X) + ' ' + f1(ab2.Y), 1);
      [111, 120, 129].forEach(function (ry0) { [-1, 1].forEach(function (sd) { var c1 = P(sd * 1.3, ry0 + bob, 15), c2 = P(sd * 4.6, ry0 + 2 + bob, 14.6), c3 = P(sd * 8, ry0 - .6 + bob, 14);
        ml('M' + f1(c1.X) + ' ' + f1(c1.Y) + ' Q' + f1(c2.X) + ' ' + f1(c2.Y) + ' ' + f1(c3.X) + ' ' + f1(c3.Y), .9); }); });
      [-1, 1].forEach(function (sd) { var o1 = P(sd * BP.wv * .74, 117 + bob, 12), o2 = P(sd * 4.5, 146 + bob, 13.5); ml('M' + f1(o1.X) + ' ' + f1(o1.Y) + ' Q' + f1((o1.X + o2.X) / 2 + sd * 1.5 * k * Math.cos(a)) + ' ' + f1((o1.Y + o2.Y) / 2) + ' ' + f1(o2.X) + ' ' + f1(o2.Y), .9); });
    }
    if (L.top === 'none' && Math.cos(a) < -.3) {   /* bare, seen from behind: the spine, the shoulder blades and the small of the back; the fit builds also show the traps and the lats (JP: the back had no details) */
      var bo = Math.min(1, (-Math.cos(a) - .3) * 2), bc = dk(L.skin, .8), bl = function (d, wd, op) { parts.push([0.012, el('path', { d: d, fill: 'none', stroke: bc, 'stroke-width': ((wd || 1) * k).toFixed(2), 'stroke-linecap': 'round', opacity: (bo * (op || .4)).toFixed(2) })]); };
      var bq = function (x, y, z) { var p = P(x, y + bob, z); return f1(p.X) + ' ' + f1(p.Y); };
      bl('M' + bq(0, 90, -11) + ' Q' + bq(.6, 115, -14) + ' ' + bq(0, 141, -11.5), 1.1, .42 + .06 * MUT);
      [-1, 1].forEach(function (sd) {
        bl('M' + bq(sd * BP.ch * .3, 95, -14) + ' Q' + bq(sd * BP.ch * .78, 98, -13) + ' ' + bq(sd * BP.ch * .6, 110, -14.5) + ' Q' + bq(sd * BP.ch * .4, 112, -15) + ' ' + bq(sd * BP.ch * .3, 107, -15), .9, .3 + .06 * MUT);   /* a shoulder blade */
        var dm = P(sd * 5, 139 + bob, -11.5); parts.push([0.012, el('ellipse', { cx: f1(dm.X), cy: f1(dm.Y), rx: (1.3 * k).toFixed(1), ry: (1 * k).toFixed(1), fill: bc, opacity: (bo * .3).toFixed(2) })]);
        if (CEL) { var bli = sd > 0 ? 1 : .55;   /* big enough to see: light on each shoulder blade and beside the spine, shade under the blade and down the lat */
          celE(sd * BP.ch * .52, 101 + bob, -14.5, BP.ch * .3, 5, 1, (.1 + .04 * MUT) * bo * bli, .0118, sd * 14);
          celE(sd * BP.ch * .56, 111.5 + bob, -13.5, BP.ch * .32, 1.7, 0, (.06 + .025 * MUT) * bo, .0118, sd * 20);
          celE(sd * 4.4, 127 + bob, -12.8, 2.5, 8.5, 1, (.07 + .03 * MUT) * bo * bli, .0118); }   /* the dimples low on the back */
        if (MUT) { bl('M' + bq(sd * 2, 84, -8) + ' Q' + bq(sd * BP.sx * .45, 90, -11) + ' ' + bq(sd * BP.sx * .8, 89, -9), .9, .34);   /* the traps' edge out to the shoulder */
          bl('M' + bq(sd * BP.ch * .92, 104, -11) + ' Q' + bq(sd * BP.wv * .9, 120, -12.5) + ' ' + bq(sd * 3.5, 132, -12.5), 1, .32 + .06 * MUT); }   /* a lat, from under the arm in to the low spine */
      });
    }
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
    /* (the old side strip is gone: the trunk's own outline now shows the chest and back as he turns) */
    if (Math.cos(a) > 0.15) {
      if (L.top === 'hoodie') [-5, 5].forEach(function (x) { var q1 = P(x, 86 + bob, 13), q2 = P(x, 104 + bob, 13); parts.push([0.02, el('line', { x1: q1.X, y1: q1.Y, x2: q2.X, y2: q2.Y, stroke: '#f2f2f2', 'stroke-width': 1.6 * k, 'stroke-linecap': 'round', opacity: Math.min(1, Math.cos(a) * 1.5) })]); });
      if (L.top === 'shirt') { var c1 = P(-8, 79 + bob, 12), c2 = P(0, 90 + bob, 13), c3 = P(8, 79 + bob, 12), c4 = P(0, 82 + bob, 13);
        parts.push([0.02, el('path', { d: 'M' + c1.X + ' ' + c1.Y + ' L' + c2.X + ' ' + c2.Y + ' L' + c4.X + ' ' + c4.Y + ' Z M' + c3.X + ' ' + c3.Y + ' L' + c2.X + ' ' + c2.Y + ' L' + c4.X + ' ' + c4.Y + ' Z', fill: '#f4f4f2' })]);
        [96, 110, 124].forEach(function (yy) { var bt = P(0, yy + bob, 13); parts.push([0.02, el('circle', { cx: bt.X, cy: bt.Y, r: 1.3 * k, fill: dk(L.topC, .6) })]); }); }
    }
    /* arms: from the shoulders, swinging against the legs; long enough that a hanging hand reaches mid-thigh (the elbow at the waist) */
    var UA = 35, FA = 32;
    [-1, 1].forEach(function (sd) {
      var q = ph + (sd < 0 ? Math.PI : 0), sv = w * 0.38 * Math.sin(q), ov = pose[nearSide(sd) ? 'near' : 'far'];
      if (CHAIR && !ov) ov = { m: 1, b: [134 - 6 * Math.cos(ph * 1.2) * w, 4 + 14 * Math.sin(ph * 1.2) * w] };
      var cbusy = CRUTCH && !!ov && (ov.m == null || ov.m > .25);   /* the hand is doing something else: its crutch stays standing by his side */
      if (CRUTCH && !ov) ov = { m: 1, b: [148, 10 + 9 * Math.sin(ph) * w] };
      var fb = sv + 0.15 + w * 0.25 * Math.max(0, Math.sin(q));
      var place = function (q) { return q.at ? unlean(toBody(q.at, sd * 32)) : { y: q.b[0] + bob, z: q.b[1] }; };
      if (ov && ov.path) { var A0 = place(ov.path[0]), B0 = place(ov.path[1]), fq = ov.f; ov = { m: 1, b: null, at: null, hb: { y: A0.y + (B0.y - A0.y) * fq - ov.up / k * Math.sin(Math.PI * fq), z: A0.z + (B0.z - A0.z) * fq } }; }
      if (ov && (ov.at || ov.b || ov.hb)) { var hb = ov.hb || place(ov), sa = ik(hb.y - (88 + bob), hb.z, UA, FA, -1); ov = { m: ov.m == null ? 1 : ov.m, s: sa[0], f: sa[1] }; }   /* a pose without m (like a plain resting place) is fully on */   /* the hand goes where it must hold (a rail, the slot) */
      if (ov) { sv = sv * (1 - ov.m) + ov.s * ov.m; fb = fb * (1 - ov.m) + ov.f * ov.m; }   /* a keyed pose, blended in */
      var AR = L.bp.ar, SX = L.bp.sx, sh = [sd * SX, 88 + bob, 0], elb = [sd * (SX + 1.8), sh[1] + UA * Math.cos(sv), UA * Math.sin(sv)];
      var hand = [sd * (SX + 3.2), elb[1] + FA * Math.cos(fb), elb[2] + FA * Math.sin(fb)];
      var zz = rot(sd * 25, 0, a).z, far = zz < -2, z = far ? zz - 1 : zz + 1;
      var p1 = P(sh[0], sh[1], sh[2], 1), p2 = P(elb[0], elb[1], elb[2], 1), p3 = P(hand[0], hand[1], hand[2], 1);
      var MU = L.bp.mus || 0;
      /* a human arm (JP's anatomy spec): clearly narrower than the chest, fullest at the biceps, a slight taper to the wrist;
         it hangs from under a teardrop shoulder muscle that caps the shoulder and runs to a point a third of the way down
         the outside of the upper arm */
      var skA = shade(far, C.skin2, C.skin), fm = P(elb[0] + (hand[0] - elb[0]) * .3, elb[1] + (hand[1] - elb[1]) * .3, elb[2] + (hand[2] - elb[2]) * .3, 1), bi2 = P(sh[0] + (elb[0] - sh[0]) * .45, sh[1] + (elb[1] - sh[1]) * .45, sh[2] + (elb[2] - sh[2]) * .45, 1);
      var rS = AR * .86, rB = AR, rE = AR * .72, rF = AR * .78, rW = AR * .5;
      var adx = p2.X - p1.X, ady = p2.Y - p1.Y, adl = Math.hypot(adx, ady), aux = adl > 2 * k ? adx / adl : 0, auy = adl > 2 * k ? ady / adl : 1, oo = rot(sd, 0, a).x, anx = -auy, any = aux;
      if (anx * (oo || sd) < 0) { anx = -anx; any = -any; }   /* across the arm, pointing away from the body */
      var oa = Math.abs(oo), dT = 2.4 + .08 * AR;   /* the shoulder's top stays level with the shoulder line however big the arm is (JP: the deltoids stuck up) */
      var p1d = { X: p1.X + aux * Math.max(0, rS - dT + 1) * k, Y: p1.Y + auy * Math.max(0, rS - dT + 1) * k };
      function delt(grow, fill, zd, line) { var rD = (AR * (1.1 + .05 * MU) + grow * .6) * k, tipS = line ? Math.max(UA * .56 * k * Math.min(1, adl / (UA * k) + .25), rD * 1.9) : rD * 1.5;   /* under cloth the shoulder is a round cap, not a muscle with a point */
        var pt = function (sv2, tv) { return f1(p1.X + aux * sv2 + anx * tv) + ' ' + f1(p1.Y + auy * sv2 + any * tv); };
        /* a teardrop: a round cap over the joint, widest just below the top, then both sides run in to a point on the outside of the upper arm */
        var sT = -(dT + grow * .5) * k, tT = -.5 * rD * oa, sO = .85 * rD, tO = rD * (1 + .14 * oa), tI = -rD * (1 - .3 * oa), tP = line ? .6 * rB * k * oa : .1 * rB * k * oa, D = tipS - sO;
        var d = 'M' + pt(sT, tT) + ' C' + pt(sT + .08 * (sO - sT), tT + .55 * (tO - tT)) + ' ' + pt(sO - .62 * (sO - sT), tO) + ' ' + pt(sO, tO) + ' C' + pt(sO + .3 * D, tO) + ' ' + pt(tipS - .42 * D, tP + .7 * (tO - tP)) + ' ' + pt(tipS, tP) +
          ' C' + pt(tipS - .3 * D, tP - .45 * rD) + ' ' + pt(sO + .5 * D, tI) + ' ' + pt(sO, tI) + ' C' + pt(sO - .55 * (sO - sT), tI) + ' ' + pt(sT, tT - .4 * rD) + ' ' + pt(sT, tT) + ' Z';
        parts.push([zd, el('path', { d: d, fill: grad(fill, line ? 1 : 0) })]);
        if (line && k > .85) { parts.push([zd + .0005, el('path', { d: 'M' + pt(sO + .25 * D, tI * .96) + ' Q' + pt(tipS - .4 * D, tP - .2 * rD) + ' ' + pt(tipS, tP) + ' Q' + pt(tipS - .5 * D, tP - .62 * rD) + ' ' + pt(sO + .1 * D, tI * .62) + ' Z', fill: dk(L.skin, .55), opacity: .3 })]);   /* the muscle's inner edge turns under: a dark sliver down to its point */
 } }
      function skinArm() {
        whole(skA, z, function () { taper(p1d, bi2, rS, rB, skA, z); taper(bi2, p2, rB, rE, skA, z); taper(p2, fm, rE, rF, skA, z); taper(fm, p3, rF, rW, skA, z); }, p1.X > cx + .5 * k);
        parts.push([z + .0008, el('path', { d: 'M' + f1(p2.X - anx * rE * .75 * k) + ' ' + f1(p2.Y - any * rE * .75 * k) + ' L' + f1(p2.X - anx * rE * .1 * k) + ' ' + f1(p2.Y - any * rE * .1 * k), fill: 'none', stroke: dk(L.skin, .78), 'stroke-width': (.9 * k).toFixed(2), 'stroke-linecap': 'round', opacity: .5 })]); }   /* a subtle elbow line */
      if (L.bare === 'arms' || L.top === 'none') { skinArm(); delt(0, skA, z + .001, 1); }
      else if (L.bare === 'short') { var mid = P(sh[0] + (elb[0] - sh[0]) * .55, sh[1] + (elb[1] - sh[1]) * .55, sh[2] + (elb[2] - sh[2]) * .55, 1), tcs = shade(far, C.top2, C.top);
        skinArm(); taper(p1d, mid, rS + 1.2, rB + 1.2, tcs, z + .01, 1); delt(1.2, tcs, z + .011);
        hemShade(mid, P(sh[0] + (elb[0] - sh[0]) * .64, sh[1] + (elb[1] - sh[1]) * .64, sh[2] + (elb[2] - sh[2]) * .64, 1), rB * .97, rB * .93, z + .005); }
      else { var slc = L.sleeve || C.top, slc2 = L.sleeve ? dk(L.sleeve, .82) : C.top2, scs = shade(far, slc2, slc); whole(scs, z, function () { taper(p1d, bi2, rS + 1.8, rB + 1.8, scs, z); taper(bi2, p2, rB + 1.8, rE + 2.2, scs, z); taper(p2, fm, rE + 2.2, rF + 1.9, scs, z); taper(fm, p3, rF + 1.9, rW + 2.4, scs, z); }); delt(1.8, scs, z + .001);   /* a sleeve follows the arm inside it */
}
      var PRO = L.aid === 'arm' && sd > 0;   /* a prosthetic forearm and hand, whatever the sleeve (it used to show only with long sleeves – so with a T-shirt, never) */
      if (PRO) { taper(P(elb[0] + (hand[0] - elb[0]) * .12, elb[1] + (hand[1] - elb[1]) * .12, elb[2] + (hand[2] - elb[2]) * .12, 1), p3, rF + .5, rW + .7, shade(far, '#7d8894', '#9aa3ad'), z + .02); var pj = P(elb[0], elb[1], elb[2], 1); parts.push([z + .021, el('circle', { cx: pj.X.toFixed(1), cy: pj.Y.toFixed(1), r: ((rE + .3) * k).toFixed(1), fill: grad('#5f6975', 1) })]); }
      var HZ = Math.max(.72, Math.min(.9, AR / 6.2));   /* the hands grow with the arms */
      /* the hand: a mitten turned along the forearm, the thumb on the side toward the front, a cuff at the wrist */
      var fdx = p3.X - p2.X, fdy = p3.Y - p2.Y, fl = Math.hypot(fdx, fdy) || 1, ux = fdx / fl, uy = fdy / fl, ang = Math.atan2(uy, ux) * 180 / Math.PI - 90;
      var fwd = Math.abs(Math.sin(a)) > .3 ? (Math.sin(a) > 0 ? 1 : -1) : -sd * (Math.cos(a) >= 0 ? 1 : -1), pxv = -uy, pyv = ux; if (pxv * fwd < 0) { pxv = -pxv; pyv = -pyv; }
      var hc2 = PRO ? shade(far, '#7d8894', '#9aa3ad') : shade(far, C.skin2, C.skin), HG = el('g', {});
      if (!L.bare && L.top !== 'none') HG.appendChild(el('line', { x1: (p3.X - ux * 3.4 * k).toFixed(1), y1: (p3.Y - uy * 3.4 * k).toFixed(1), x2: (p3.X - ux * .6 * k).toFixed(1), y2: (p3.Y - uy * .6 * k).toFixed(1), stroke: dk(L.sleeve || L.topC, far ? .7 : .8), 'stroke-width': ((rW + 2.6) * 2 * k).toFixed(1), 'stroke-linecap': 'butt' }));
      var tx = p3.X + ux * 3 * k + pxv * 5.6 * HZ * k, ty = p3.Y + uy * 3 * k + pyv * 5.6 * HZ * k;
      HG.appendChild(el('ellipse', { cx: tx.toFixed(1), cy: ty.toFixed(1), rx: (2.3 * HZ * k).toFixed(1), ry: (4.2 * HZ * k).toFixed(1), fill: grad(hc2), transform: 'rotate(' + (ang + (pxv * uy - pyv * ux > 0 ? -28 : 28)).toFixed(0) + ' ' + tx.toFixed(1) + ' ' + ty.toFixed(1) + ')' }));
      var mx = p3.X + ux * 4.6 * HZ * k, my = p3.Y + uy * 4.6 * HZ * k;
      HG.appendChild(el('ellipse', { cx: mx.toFixed(1), cy: my.toFixed(1), rx: (6.6 * HZ * k).toFixed(1), ry: (9.2 * HZ * k).toFixed(1), fill: grad(hc2, 1), transform: 'rotate(' + ang.toFixed(0) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1) + ')' }));
      parts.push([z + 0.1, HG]);
      HAND[nearSide(sd) ? 'near' : 'far'] = HAND['s' + sd] = { X: p3.X, Y: p3.Y, z: z + 0.2, busy: cbusy };
    });
    /* neck and head: a ball; eyes, nose, mouth, ears, glasses and beard sit on it and come round as he turns */
    /* the neck: its own part, from under the chin down into the shoulders (the head itself is drawn smaller, see HSC) */
    var HBG = 1 + .22 * Math.max(0, Math.min(1, (1 - k) / .4)), HSC = .55 * HBG, HSX = .465 * HBG,   /* drawn small (the page scenes, tiles) the head is a little bigger, so the face stays readable */
        nk1 = P(0, 66 + hb6, 0), nk2 = P(0, 85 + bob, 0), nkw = (4 + .7 * Math.abs(Math.sin(a))) * BW * (1 + .08 * (L.bp.mus || 0)) * k;
    parts.push([0.4, el('path', { d: 'M' + (nk1.X - nkw).toFixed(1) + ' ' + nk1.Y.toFixed(1) + ' L' + (nk1.X + nkw).toFixed(1) + ' ' + nk1.Y.toFixed(1) + ' L' + (nk2.X + nkw * 1.25).toFixed(1) + ' ' + nk2.Y.toFixed(1) + ' L' + (nk2.X - nkw * 1.25).toFixed(1) + ' ' + nk2.Y.toFixed(1) + ' Z', fill: grad(C.skin) })]);
    var hStart = parts.length;   /* everything of the head from here is drawn smaller round the chin: he is about 5.5 heads tall (JP chose between real proportions and the larger head) */
    var HC = P(0, 52 + hb6, 0), hc = { X: 0, Y: 0 }, R = 22 * k, PH = function (x, y, z) { var p = P(x, y, z); return { X: p.X - HC.X, Y: p.Y - HC.Y }; };   /* everything in the head group is drawn round the head's middle (hc = 0, 0) and the group is moved into place: while he only bobs or breathes, nothing inside it changes, so a frame writes one attribute for the whole head */
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
      parts.push([depth, el('rect', { x: HC.X + mn * k, y: top, width: (mx - mn) * k, height: bot - top, rx: (rr || 10) * k, fill: fill })]);
    }
    function hatCoversLong() { return L.hat === 'beanie' && false; }
    function onHead(phi, y) { var s = Math.sin(phi + a), c = Math.cos(phi + a); return { x: hc.X + s * R * Math.sqrt(Math.max(0, 1 - Math.pow((y - 52) / 22, 2))), y: hc.Y + (y - 52) * k, f: c }; }
    function sstep(e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
    function poly(pts) { var s = 'M'; for (var i = 0; i < pts.length; i++) s += (i ? ' L' : '') + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1); return s + ' Z'; }
    var hatCovers = L.hat === 'beanie' || L.hat === 'chef' || L.hat === 'bandana' || L.hat === 'santa' || L.hat === 'wizard' || L.hat === 'witch' || L.hat === 'cowboy';
    /* the whole head is kept from the last frame while the turn, the size, the look and the blink are the same: it only moves
       (one transform), so walking, breathing and reaching don't rebuild a face 60 times a second */
    var HK = L.hair === 'mohawk' ? null : [a, k, LN, pose.blink ? 1 : 0, shadeOn ? 1 : 0, POOL ? POOL.i : 0, pose.mouth || '', pose.brow || ''].join('|'), HTR = 'translate(' + HC.X.toFixed(1) + ' ' + HC.Y.toFixed(1) + ')', head;
    if (POOL && HK && POOL.hk === HK && POOL.hL === L && POOL.hEl) { head = POOL.hEl; head._a = { transform: HTR }; POOL.i = POOL.hi1; }
    else { head = el('g', { transform: HTR });
    head.appendChild(el('rect', { x: hc.X - nkw / HSX, y: hc.Y + 12 * k, width: 2 * nkw / HSX, height: 16 * k, rx: 3 * k, fill: dk(L.skin, .8) }));   /* the chin's soft shadow on the neck */
    var FS = { oval: [.96, 1.05, 1], round: [1.14, .98, 0], long: [.86, 1.2, 4] }[L.faceS] || [1, 1, 0];   /* face shape: oval a little taller than wide, round full and wide, long narrow with the chin lower (JP: the shapes looked the same) */
    /* a face, not a ball (JP's anatomy spec): wide at the forehead and cheekbones, the sides curve in to an angled jaw and the chin narrows to a soft point – turned a little the way he looks */
    var frx = R * FS[0], fry = R * FS[1], fcy = hc.Y + FS[2] * k, fch = hc.X + Math.sin(a) * R * .24, jw = L.faceS === 'round' ? .92 : L.faceS === 'long' ? .78 : .8, cw0 = L.faceS === 'round' ? .42 : L.faceS === 'long' ? .22 : .25, fp = function (x, y) { return f1(x - hc.X) + ' ' + f1(fcy - hc.Y + y * fry); }, FT = 'translate(' + f1(hc.X) + ' ' + f1(hc.Y) + ')', FM = MEMO && MEMO.face, FK = a.toFixed(4) + '|' + k.toFixed(4) + '|' + L.faceS + '|' + L.skin;   /* built round the head's middle and kept while the turn and the size are the same: only its place changes as he breathes or walks */
    var FACE, JAWB;
    if (FM && FM.key === FK) { FACE = FM.f; JAWB = FM.j; } else {
      FACE = 'M' + fp(hc.X - frx, 0) + ' A' + f1(frx) + ' ' + f1(fry) + ' 0 0 1 ' + fp(hc.X + frx, 0) + ' C' + fp(hc.X + frx, .3) + ' ' + fp(fch + frx * (jw + .07), .36) + ' ' + fp(fch + frx * jw, .6) +
      ' C' + fp(fch + frx * (jw - .1), .78) + ' ' + fp(fch + frx * (cw0 + .2), 1.02) + ' ' + fp(fch + frx * cw0, 1.06) + ' Q' + fp(fch, 1.1) + ' ' + fp(fch - frx * cw0, 1.06) +
      ' C' + fp(fch - frx * (cw0 + .2), 1.02) + ' ' + fp(fch - frx * (jw - .1), .78) + ' ' + fp(fch - frx * jw, .6) + ' C' + fp(fch - frx * (jw + .07), .36) + ' ' + fp(hc.X - frx, .3) + ' ' + fp(hc.X - frx, 0) + ' Z';
      JAWB = 'M' + fp(hc.X + frx, -.05) + ' C' + fp(hc.X + frx, .3) + ' ' + fp(fch + frx * (jw + .07), .36) + ' ' + fp(fch + frx * jw, .6) + ' C' + fp(fch + frx * (jw - .1), .78) + ' ' + fp(fch + frx * (cw0 + .2), 1.02) + ' ' + fp(fch + frx * cw0, 1.06) +
      ' Q' + fp(fch + frx * .78, .62) + ' ' + fp(hc.X + frx * .93, -.05) + ' Z';
      if (Math.abs(Math.sin(a)) > .8) { var pf = (Math.abs(Math.sin(a)) - .8) / .2, psg = Math.sin(a) > 0 ? 1 : -1, bump = function (bx, yr, rx, ry) { return ' M' + fp(bx - rx, yr) + ' A' + f1(rx) + ' ' + f1(ry) + ' 0 1 1 ' + fp(bx + rx, yr) + ' A' + f1(rx) + ' ' + f1(ry) + ' 0 1 1 ' + fp(bx - rx, yr) + ' Z'; };   /* in profile the outline gets a brow ridge and lips that stand out a little – part of the face's own shape, so they take its shading */
        FACE += bump(hc.X + psg * (frx * .985 - (2.4 - 1.3 * pf) * k), -.17, 2.4 * k, 3.3 * k) + bump(fch + psg * (frx * jw - (2.2 - 1.2 * pf) * k), .67, 2.2 * k, 2.6 * k); }
      if (MEMO) MEMO.face = { key: FK, f: FACE, j: JAWB }; }
    head.appendChild(el('path', { d: FACE, fill: grad(C.skin), transform: FT }));
    /* a darker band along the jaw on the shadow side; the light on the cheekbone is the head's own highlight (shHead) */
    head.appendChild(el('path', { d: JAWB, fill: dk(L.skin, .72), opacity: .26, transform: FT }));
    /* facial hair, drawn over the nose's shading and under the lips (called between them): a beard runs from the sideburns down the
       cheek line – the upper cheeks stay clear – under the nose and round the jaw; a goatee sits under the lower lip and follows the
       chin; a moustache lies on the upper lip; stubble is a faint tone with fine dots, not a solid patch */
    function beards() { var B = L.beard, GOA = .5; if (!B || B === 'none') return;
      var jawY = function (x) { var jt = Math.abs(x - fch) / frx; return fcy + fry * (jt <= cw0 ? 1.07 : jt < jw ? 1.04 - (jt - cw0) / (jw - cw0) * .44 : .6 * Math.max(0, 1 - jt) / (1 - jw)); };
      if (B === 'full' || B === 'short' || B === 'stubble') { var up = [], lo = [], n = 26;
        for (var bi = 0; bi <= n; bi++) { var ph2 = -1.45 + 2.9 * bi / n, ap = Math.abs(ph2), ty = ap < .42 ? 62.4 + 1.2 * Math.pow(ap / .42, 2) : 63.6 - 13.1 * Math.pow((ap - .42) / 1.03, 1.9), u = onHead(ph2, ty);
          if (u.f > -0.02) { up.push([u.x, u.y]); var jp = fcy + fry * (1.07 - .6 * Math.pow(Math.min(1, ap / 1.5), 1.6)); lo.unshift([u.x, Math.max(u.y + 1.5 * k, Math.min(jawY(u.x), jp) + (B === 'full' ? 2.6 * k * Math.max(0, u.f) : B === 'short' ? .3 * k : -.3 * k))]); } }   /* the lower edge follows the jaw, so it never sticks out as a point when he turns */
        if (up.length > 1) head.appendChild(el('path', { d: poly(up.concat(lo)), fill: B === 'full' ? grad(C.hair) : C.hair, opacity: B === 'full' ? 1 : B === 'short' ? .88 : .2 }));
        if (B === 'stubble' && k > .85) { var sdot = ''; [[0, 72.4], [.24, 71.6], [-.24, 71.6], [.5, 69.6], [-.5, 69.6], [.8, 66.6], [-.8, 66.6], [1.05, 62], [-1.05, 62], [.2, 63.7], [-.2, 63.7], [.38, 64.5], [-.38, 64.5], [.3, 68.8], [-.3, 68.8], [.62, 67.4], [-.62, 67.4], [.92, 63.4], [-.92, 63.4], [.1, 69.9], [-.12, 70.6], [1.2, 58.5], [-1.2, 58.5]].forEach(function (q) { var d0 = onHead(q[0], q[1]); if (d0.f > .1) sdot += 'M' + d0.x.toFixed(1) + ' ' + d0.y.toFixed(1) + 'l0 0'; });
          if (sdot) head.appendChild(el('path', { d: sdot, fill: 'none', stroke: C.hair, 'stroke-width': (.75 * k).toFixed(2), 'stroke-linecap': 'round', opacity: .55 })); } }
      if (B === 'goatee') { var g1 = [], g2 = [], gsh = Math.sin(a) * Math.abs(Math.sin(a)) * R * .1;   /* a chin beard: from under the lower lip round the chin, rounded off at the sides */
        for (var gi = 0; gi <= 10; gi++) { var gu = gi / 5 - 1, gp = onHead(.2 * gu, 70.3 - .9 * (1 - gu * gu)); gp.y = Math.max(gp.y, jawY(fch) - (7.4 - .9 * gu * gu) * k); if (gp.f > .05) { g1.push([gp.x + gsh, gp.y]); var gxx = fch + (gp.x - fch) * (.95 - .25 * gu * gu); g2.unshift([gxx + gsh, jawY(gxx) - (GOA + 2.6 * gu * gu) * k]); } }
        if (g1.length > 2) head.appendChild(el('path', { d: poly(g1.concat(g2)), fill: C.hair, stroke: C.hair, 'stroke-width': (1.2 * k).toFixed(1), 'stroke-linejoin': 'round' })); }
      if (B === 'moustache') { var m1 = [], m2 = [];
        for (var mi2 = 0; mi2 <= 12; mi2++) { var mph = -.4 + .8 * mi2 / 12, mt3 = Math.abs(mph) / .4, mp1 = onHead(mph, 62.2 + 1.5 * Math.pow(mt3, 1.5)), mp3 = onHead(mph, 64.7 + .4 * Math.min(1, mt3 * 5) + 2 * Math.pow(mt3, 1.6)); if (mp1.f > .05) { m1.push([mp1.x, mp1.y]); m2.unshift([mp3.x, mp3.y]); } }
        if (m1.length > 2) head.appendChild(el('path', { d: poly(m1.concat(m2)), fill: C.hair })); }
    }
    /* the face (JP's face spec, 2026-11-13): eyes at half the head's height about an eye apart, the nose's bottom two thirds
       down, the mouth a third of the way from there to the chin. Big enough to see (DET) it has whites, a coloured iris, a
       pupil and one highlight in the same spot on both eyes, a lash line, a lid crease, a nose shaped by light and two lips;
       small (in the page scenes) the same face is drawn bolder with fewer parts */
    var eyes = [], DET = k > .85, sA = Math.sin(a), shc = dk(L.skin, .76), EXP = L.expr, fx = function (v) { return v.toFixed(1); };
    var midX = onHead(0, 53).x, add = function (n, at) { head.appendChild(el(n, at)); };
    [-0.44, 0.44].forEach(function (phi) { var e = onHead(phi * -1, 53); e.x = hc.X + (e.x - hc.X) * .9; eyes.push(e); if (e.f > 0.16) { var fw = Math.max(.3, e.f), ew = 4.7 * k * fw;   /* the features sit on the face, a little inside the skull's outline */
      var wink = EXP === 'wink' && phi > 0, st = pose.blink || wink ? 1 : EXP === 'laugh' || EXP === 'shy' ? 2 : 0, wide = EXP === 'wow', half = EXP === 'cool';
      var up = (wide ? 3 : 2.5) * k, dn = (wide ? 2.4 : 1.9) * k, lidY = half ? e.y - .1 * k : e.y - 2 * up;
      if (st === 0) {
        if (DET && e.f > .6) add('ellipse', { cx: fx(e.x), cy: fx(e.y - .4 * k), rx: fx(ew * 1.55), ry: fx(4.6 * k), fill: 'url(#f25sh) none', opacity: .8 });   /* the eye socket */
        add('path', { d: 'M' + fx(e.x - ew) + ' ' + fx(e.y) + ' Q' + fx(e.x) + ' ' + fx(e.y - 2 * up) + ' ' + fx(e.x + ew) + ' ' + fx(e.y) + ' Q' + fx(e.x) + ' ' + fx(e.y + 2 * dn) + ' ' + fx(e.x - ew) + ' ' + fx(e.y) + ' Z', fill: '#f7f3ee' });
        add('ellipse', { cx: fx(e.x + sA * .5 * k), cy: fx(e.y - .1 * k), rx: fx((DET ? 2.15 : 2.3) * k * fw), ry: fx((wide ? 2.3 : DET ? 2.15 : 2.3) * k), fill: DET ? L.eyeC : dk(L.eyeC, .7) });
        if (DET) { add('ellipse', { cx: fx(e.x + sA * .5 * k), cy: fx(e.y - .1 * k), rx: fx(1.05 * k * fw), ry: fx(1.05 * k), fill: C.eye });
          add('circle', { cx: fx(e.x + sA * .5 * k - .85 * k * fw), cy: fx(e.y - .95 * k), r: fx(.62 * k), fill: '#fff' }); }
        if (half) add('path', { d: 'M' + fx(e.x - ew * 1.05) + ' ' + fx(e.y) + ' Q' + fx(e.x) + ' ' + fx(e.y - 2 * up - .4 * k) + ' ' + fx(e.x + ew * 1.05) + ' ' + fx(e.y) + ' Q' + fx(e.x) + ' ' + fx(lidY) + ' ' + fx(e.x - ew * 1.05) + ' ' + fx(e.y) + ' Z', fill: C.skin });   /* a half-closed lid */
        add('path', { d: 'M' + fx(e.x - ew * 1.06) + ' ' + fx(e.y + .2 * k) + ' Q' + fx(e.x) + ' ' + fx(lidY - .3 * k) + ' ' + fx(e.x + ew * 1.06) + ' ' + fx(e.y + .2 * k), fill: 'none', stroke: C.eye, 'stroke-width': fx((DET ? 1.2 : 1.5) * k), 'stroke-linecap': 'round' });   /* the lash line */
        if (DET) { add('path', { d: 'M' + fx(e.x - ew * .8) + ' ' + fx(e.y - up - 1 * k) + ' Q' + fx(e.x) + ' ' + fx(e.y - 2 * up - 1.9 * k) + ' ' + fx(e.x + ew * .8) + ' ' + fx(e.y - up - 1 * k), fill: 'none', stroke: shc, 'stroke-width': fx(.55 * k), 'stroke-linecap': 'round', opacity: .45 });
          add('path', { d: 'M' + fx(e.x - ew * .62) + ' ' + fx(e.y + dn + .7 * k) + ' Q' + fx(e.x) + ' ' + fx(e.y + 2 * dn + .5 * k) + ' ' + fx(e.x + ew * .62) + ' ' + fx(e.y + dn + .7 * k), fill: 'none', stroke: shc, 'stroke-width': fx(.5 * k), 'stroke-linecap': 'round', opacity: .22 }); }
      } else if (st === 1) add('path', { d: 'M' + fx(e.x - ew) + ' ' + fx(e.y + .4 * k) + ' Q' + fx(e.x) + ' ' + fx(e.y + 1.4 * k) + ' ' + fx(e.x + ew) + ' ' + fx(e.y + .4 * k), fill: 'none', stroke: C.eye, 'stroke-width': fx(1.5 * k), 'stroke-linecap': 'round' });   /* closed: a blink, a wink */
      else add('path', { d: 'M' + fx(e.x - ew) + ' ' + fx(e.y + 1 * k) + ' Q' + fx(e.x) + ' ' + fx(e.y - 3.4 * k) + ' ' + fx(e.x + ew) + ' ' + fx(e.y + 1 * k), fill: 'none', stroke: C.eye, 'stroke-width': fx(1.8 * k), 'stroke-linecap': 'round' });   /* happy closed eyes: laughing, shy */
      /* the brow: thicker toward the nose, thinner at its outer end */
      var br = onHead(phi * -1 * 1.04, wide ? 45.4 : 46.8), inn = midX >= e.x ? 1 : -1, bx = br.x, by = br.y, bw = ew * 1.22, lift = half ? 0 : 1.5 * k, BM = BROWS[pose.brow || (EXP === 'wow' ? 'up' : EXP === 'shy' ? 'sad' : '')] || BROWS.none, bo = BM[0] * k, bi = BM[1] * k, bm = (bo + bi) / 2;   /* the brow's mood: both ends up (surprised), the inner end down (set on something), the inner end up (sorry, shy) */
      add('path', { d: 'M' + fx(bx - inn * bw) + ' ' + fx(by + 1 * k + bo) + ' Q' + fx(bx - inn * bw * .15) + ' ' + fx(by - lift - .9 * k + bm) + ' ' + fx(bx + inn * bw * .95) + ' ' + fx(by - .5 * k + bi) + ' L' + fx(bx + inn * bw * .98) + ' ' + fx(by + 1.3 * k + bi) + ' Q' + fx(bx - inn * bw * .15) + ' ' + fx(by - lift + .7 * k + bm) + ' ' + fx(bx - inn * bw) + ' ' + fx(by + 1 * k + bo) + ' Z', fill: dk(L.hairC, .8) });
      if ((L.makeup === 'lashes' || L.makeup === 'both')) [-.75, -.2, .35].forEach(function (lx) { var ls = phi < 0 ? -1 : 1, lx0 = e.x + ls * (lx + .45) * ew, ly0 = st === 0 ? e.y - up * (1 - Math.pow(lx + .2, 2)) * .9 : e.y - 1 * k; add('line', { x1: fx(lx0), y1: fx(ly0), x2: fx(lx0 + ls * .9 * k * fw), y2: fx(ly0 - 1.9 * k), stroke: C.eye, 'stroke-width': fx(.8 * k), 'stroke-linecap': 'round' }); });
      if (e.f > .3) add('ellipse', { cx: fx(e.x + (phi < 0 ? -1 : 1) * 2.2 * k), cy: fx(e.y + 7.4 * k), rx: fx(3.4 * k * e.f), ry: fx(1.9 * k), fill: '#e58a7a', opacity: L.cheeks === 'blush' || EXP === 'shy' ? .55 : .22 });
      if (L.cheeks === 'freckles' && e.f > .3) [[-1.6, 5.4], [0, 6.6], [1.8, 5.6]].forEach(function (fq) { add('circle', { cx: fx(e.x + fq[0] * k * e.f), cy: fx(e.y + fq[1] * k), r: fx(.6 * k), fill: dk(L.skin, .6) }); }); } });
    /* the nose: shaped by light – a shadow down its shaded side, a light on the tip, nostril curves, a soft shadow under it.
       As he turns it grows out of the face (a real profile), never a hook in the front view */
    var no = onHead(0, 59.5), nx = sA * 4.6 * k, nxc = no.x + nx * .5;
    if (Math.abs(sA) > .3) { var nb = onHead(0, 53.5), nbase = onHead(0, 62), tipX = hc.X + sA * R * 1.2, sg = sA > 0 ? 1 : -1;
      add('path', { d: 'M' + fx(nb.x - sg * 2.5 * k) + ' ' + fx(nb.y) + ' L' + fx(tipX - sg * 1.3 * k) + ' ' + fx(no.y - 1 * k) + ' Q' + fx(tipX + sg * .5 * k) + ' ' + fx(no.y + .3 * k) + ' ' + fx(tipX - sg * 1.5 * k) + ' ' + fx(no.y + 1.6 * k) + ' L' + fx(nbase.x - sg * 2.5 * k) + ' ' + fx(nbase.y) + ' Z', fill: C.skin }); }
    if (no.f > .15) { var sh = Math.abs(sA) > .15 ? (sA > 0 ? 1 : -1) : 1, nf = Math.min(1, no.f * 1.4);
      add('path', { d: 'M' + fx(nxc + sh * .5 * k) + ' ' + fx(no.y - 6.4 * k) + ' Q' + fx(nxc + sh * 2 * k) + ' ' + fx(no.y - 1.6 * k) + ' ' + fx(nxc + sh * 2.6 * k) + ' ' + fx(no.y + .5 * k) + ' Q' + fx(nxc + sh * 2 * k) + ' ' + fx(no.y + 1.7 * k) + ' ' + fx(nxc + sh * .7 * k) + ' ' + fx(no.y + 1.3 * k) + ' Q' + fx(nxc + sh * 1.3 * k) + ' ' + fx(no.y - 2 * k) + ' ' + fx(nxc + sh * .5 * k) + ' ' + fx(no.y - 6.4 * k) + ' Z', fill: shc, opacity: fx(.36 * nf) });
      if (DET) { add('ellipse', { cx: fx(nxc - .8 * k), cy: fx(no.y - .3 * k), rx: fx(1.3 * k), ry: fx(1.1 * k), fill: '#fff', opacity: .17 });
        add('ellipse', { cx: fx(nxc), cy: fx(no.y + 2.9 * k), rx: fx(3.6 * k * nf), ry: fx(1.5 * k), fill: 'url(#f25sh) none' }); }
      add('path', { d: 'M' + fx(nxc - 2.5 * k * nf) + ' ' + fx(no.y + .8 * k) + ' Q' + fx(nxc - 1.7 * k * nf) + ' ' + fx(no.y + 1.9 * k) + ' ' + fx(nxc - .7 * k * nf) + ' ' + fx(no.y + 1.3 * k) + ' M' + fx(nxc + .7 * k * nf) + ' ' + fx(no.y + 1.3 * k) + ' Q' + fx(nxc + 1.7 * k * nf) + ' ' + fx(no.y + 1.9 * k) + ' ' + fx(nxc + 2.5 * k * nf) + ' ' + fx(no.y + .8 * k), fill: 'none', stroke: dk(L.skin, .6), 'stroke-width': fx((DET ? .7 : .9) * k), 'stroke-linecap': 'round', opacity: .8 }); }
    beards();
    /* the mouth: an upper and a lower lip, a light on the lower one and a soft shadow below it */
    var mo = onHead(0, 65.8); if (mo.f > -0.05) { var mf = Math.max(.3, mo.f), mw = (EXP === 'grin' || EXP === 'laugh' ? 6.4 : EXP === 'calm' || EXP === 'shy' ? 4.4 : 5.4) * k * mf, mx0 = mo.x + nx * .2 + sA * Math.abs(sA) * R * .1, my0 = mo.y, MD = DET && Math.abs(sA) < .6, lips = L.makeup === 'lips' || L.makeup === 'both';
      var lipU = lips ? '#b02f40' : mixc(L.skin, '#9a4038', .6), lipL = lips ? '#d0485a' : mixc(L.skin, '#c0625a', .6);
      var VS = pose.mouth && VIS[pose.mouth];   /* talking: the mouth takes the shape of the sound – open (a), round (o), wide with teeth (e); "m" is the closed mouth of his mood */
      if (VS) { add('ellipse', { cx: fx(mx0), cy: fx(my0 + 1.2 * k), rx: fx(VS[0] * k * mf + .4), ry: fx(VS[1] * k), fill: '#6e2f28', stroke: lipL, 'stroke-width': fx(1 * k) });
        if (VS[2]) add('path', { d: 'M' + fx(mx0 - VS[0] * k * mf * .8) + ' ' + fx(my0 + .5 * k) + ' Q' + fx(mx0) + ' ' + fx(my0 + .1 * k) + ' ' + fx(mx0 + VS[0] * k * mf * .8) + ' ' + fx(my0 + .5 * k) + ' Q' + fx(mx0) + ' ' + fx(my0 + 1.5 * k) + ' ' + fx(mx0 - VS[0] * k * mf * .8) + ' ' + fx(my0 + .5 * k) + ' Z', fill: '#f7f3ee' }); }
      else if (EXP === 'wow') { add('ellipse', { cx: fx(mx0), cy: fx(my0 + 1.2 * k), rx: fx(2.4 * k * mf + .4), ry: fx(3 * k), fill: '#6e2f28', stroke: lipL, 'stroke-width': fx(1 * k) }); }
      else if (EXP === 'laugh' || EXP === 'grin') {
        add('path', { d: 'M' + fx(mx0 - mw) + ' ' + fx(my0 - .8 * k) + ' Q' + fx(mx0) + ' ' + fx(my0 + 8 * k) + ' ' + fx(mx0 + mw) + ' ' + fx(my0 - .8 * k) + ' Q' + fx(mx0) + ' ' + fx(my0 + 1 * k) + ' ' + fx(mx0 - mw) + ' ' + fx(my0 - .8 * k) + ' Z', fill: '#6e2f28', stroke: lipU, 'stroke-width': fx(.9 * k), 'stroke-linejoin': 'round' });
        add('path', { d: 'M' + fx(mx0 - mw * .78) + ' ' + fx(my0 - .1 * k) + ' Q' + fx(mx0) + ' ' + fx(my0 + 1.2 * k) + ' ' + fx(mx0 + mw * .78) + ' ' + fx(my0 - .1 * k) + ' Q' + fx(mx0) + ' ' + fx(my0 + 3.8 * k) + ' ' + fx(mx0 - mw * .78) + ' ' + fx(my0 - .1 * k) + ' Z', fill: '#f7f3ee' });   /* teeth */
        add('path', { d: 'M' + fx(mx0 - mw * .7) + ' ' + fx(my0 + 2.3 * k) + ' Q' + fx(mx0) + ' ' + fx(my0 + 5.4 * k) + ' ' + fx(mx0 + mw * .7) + ' ' + fx(my0 + 2.3 * k), fill: 'none', stroke: lipL, 'stroke-width': fx(1.3 * k), 'stroke-linecap': 'round' }); }
      else { var cu = (EXP === 'calm' ? .6 : 1.6) * k, cl = EXP === 'cool' ? -.2 * k : cu, cr = EXP === 'cool' ? cu * 1.8 : cu;
        if (MD) add('ellipse', { cx: fx(mx0), cy: fx(my0 + 4.9 * k), rx: fx(mw * .8), ry: fx(1.5 * k), fill: 'url(#f25sh) none' });
        add('path', { d: 'M' + fx(mx0 - mw * .86) + ' ' + fx(my0 - cl * .7 + .2 * k) + ' Q' + fx(mx0) + ' ' + fx(my0 + 5 * k) + ' ' + fx(mx0 + mw * .86) + ' ' + fx(my0 - cr * .7 + .2 * k) + ' Q' + fx(mx0) + ' ' + fx(my0 + 1.6 * k) + ' ' + fx(mx0 - mw * .86) + ' ' + fx(my0 - cl * .7 + .2 * k) + ' Z', fill: lipL });
        add('path', { d: 'M' + fx(mx0 - mw) + ' ' + fx(my0 - cl) + ' Q' + fx(mx0 - mw * .45) + ' ' + fx(my0 - 1.6 * k) + ' ' + fx(mx0) + ' ' + fx(my0 - .4 * k) + ' Q' + fx(mx0 + mw * .45) + ' ' + fx(my0 - 1.6 * k) + ' ' + fx(mx0 + mw) + ' ' + fx(my0 - cr) + ' Q' + fx(mx0) + ' ' + fx(my0 + 2 * k) + ' ' + fx(mx0 - mw) + ' ' + fx(my0 - cl) + ' Z', fill: lipU });
        if (MD) add('ellipse', { cx: fx(mx0 - .3 * k), cy: fx(my0 + 2.3 * k), rx: fx(mw * .3), ry: fx(.42 * k), fill: '#fff', opacity: .3 }); } }
    if (DET && Math.cos(a) > .2 && !/^(full|short|goatee)$/.test(L.beard)) { var cA = Math.min(1, (Math.cos(a) - .2) * 2);   /* the light on the chin (the hollows under the cheekbones are the jaw band's job: drawn as their own shapes they looked like patches) */
      add('ellipse', { cx: fx(fch - frx * .05), cy: fx(fcy + fry * .92), rx: fx(frx * .22), ry: fx(fry * .09), fill: 'url(#f25hl) none', opacity: fx(.7 * cA) }); }
    var ears = [];
    [-Math.PI / 2, Math.PI / 2].forEach(function (phi) { var e = onHead(phi * -1, 57); ears.push(e); if (e.f > -0.35) { head.appendChild(el('ellipse', { cx: e.x, cy: e.y, rx: 2.7 * k * Math.max(.45, Math.abs(Math.sin(phi * -1 + a))), ry: 4.3 * k, fill: C.skin2 }));
      if (L.aid === 'hearing' && phi > 0) head.appendChild(el('path', { d: 'M' + e.x + ' ' + (e.y - 5 * k) + ' q' + (3 * k) + ' ' + (2 * k) + ' ' + (1 * k) + ' ' + (8 * k), fill: 'none', stroke: '#d9c7a8', 'stroke-width': 2.6 * k, 'stroke-linecap': 'round' })); } });
    /* hair */
    var H = { short: [37, 30, 1.07, 1.16], quiff: [37, 30, 1.07, 1.16], fade: [39, 28, 1.03, 1.08], side: [36, 31, 1.05, 1.09], undercut: [36, 14, 1.06, 1.14], waves: [36, 31, 1.08, 1.11], bangs: [42, 26, 1.07, 1.12], curly: [35, 28, 1.16, 1.2], afro: [34, 26, 1.34, 1.42],
      long: [37, 32, 1.06, 1.09], braids: [38, 31, 1.04, 1.07], dreads: [37, 32, 1.1, 1.12], pony: [38, 30, 1.02, 1.04], pigtails: [38, 30, 1.03, 1.05], bun: [38, 30, 1.02, 1.04], mohawk: [44, 22, 1.0, 1.0] }[L.hair];
    /* the hair's outline: across the head from one side to the other along the hairline, back over the top. The hairline is high
       over the forehead, stays clear of the ear (the hair stops behind it) and drops at the back to a slightly pointed nape, so the
       neck shows (JP's spec: no brown ball) */
    /* the nape, so the short styles differ from behind too: [the point, how far the sides rise, the point's place, lower or higher, a wavy edge and how tight] */
    var NAPE = { quiff: [0, 8, 0, .5, 0, 0], side: [2.6, 12, .32, 0, 0, 0], waves: [0, 11, 0, .8, 1.1, 13], bangs: [0, 6, 0, 2.6, 0, 0], fade: [0, 9, 0, -4.5, 0, 0], curly: [0, 11, 0, .6, 1.2, 21] }, nk = NAPE[L.hair] || [2.8, 12, 0, 0, 0, 0];
    function hairPts(Hp, sweep, bumpy) { return function () { var pts = [], N = 32, RR = R * Hp[2];
      for (var i = 0; i <= N; i++) {
        var X = -1 + 2 * i / N, phi = Math.asin(X), facing = Math.cos(phi - a), side = Math.sin(phi - a), back = Math.max(0, Math.min(1, -facing * 1.5));
        var y = Hp[0] + (5 - nk[1] * back) * X * X + nk[0] * back * Math.max(0, 1 - Math.abs(X - nk[2]) * 3.5) + nk[3] * back + nk[4] * back * Math.sin(X * nk[5]) + Hp[1] * sstep(0.1, -0.5, facing) + (sweep ? 4 * Math.max(0, side) * Math.max(0, facing) : 0);
        var sq = Math.sqrt(Math.max(0, 1 - X * X));
        y = Math.max(52 - 22 * sq + 1, Math.min(y, 52 + 22 * sq - 1.5));
        pts.push([hc.X + X * RR, hc.Y + (y - 52) * k]);
      }
      for (var j = 1; j < N; j++) { var t = Math.PI * j / N, bump = bumpy ? 1 + bumpy[0] * Math.abs(Math.sin(t * bumpy[1])) : 1; pts.push([hc.X + Math.cos(t) * RR * bump, hc.Y - Math.sin(t) * R * Hp[3] * bump]); }
      return pts; }; }
    /* shaved sides (undercut, mohawk, fade): the scalp there is not bare skin but short stubble – a thin tone of the hair's colour */
    if (H && (L.hair === 'undercut' || L.hair === 'mohawk' || L.hair === 'fade')) head.appendChild(el('path', Object.assign(headPath('buzz', L.hair + '|' + a.toFixed(4) + '|' + k.toFixed(4), hairPts([38.5, 29, 1.0, 1.02])), { fill: C.hair, opacity: L.hair === 'fade' ? .45 : .3 })));
    if (H && L.hair === 'mohawk' && !hatCovers) {   /* a crest along the middle of the head: highest on top, down to the scalp at the forehead and at the nape – in two halves, so the half on the far side of the head goes behind it */
      [[0, 8, -1], [7, 16, 1]].forEach(function (hf) { var mh = [], mhI = [];
        for (var mi = hf[0]; mi <= hf[1]; mi++) { var mt = Math.PI * (.1 + .68 * mi / 16), mcr = 9.5 * Math.pow(Math.sin(Math.PI * mi / 16), .8) * (mi % 2 ? .72 : 1), mp = P(0, 52 - Math.sin(mt) * (21 + mcr) + hb6, -Math.cos(mt) * (22 + mcr * .8)), mp2 = P(0, 52 - Math.sin(mt) * 20 + hb6, -Math.cos(mt) * 21); mh.push([mp.X, mp.Y]); mhI.unshift([mp2.X, mp2.Y]); }
        parts.push([hf[2] * Math.cos(a) < -.25 ? 0.48 : 0.52, el('path', { d: poly(mh.concat(mhI)), fill: grad(C.hair), stroke: grad(C.hair), 'stroke-width': (3 * k).toFixed(1), 'stroke-linejoin': 'round' })]); });
      H = null; }
    if (H && hatCovers) H = L.hair === 'mohawk' ? null : [H[0], H[1], 1, 1];   /* under a hat the hair lies flat: the hat hides its top, the hair still shows below it at the sides and the back (it used to vanish – a bald head under every hat) */
    if (H) {
      var hkey = L.hair + '|' + a.toFixed(4) + '|' + k.toFixed(4) + '|' + H.join(','), SHORTC = /^(short|quiff|side|waves|undercut|fade|bangs|mohawk)$/.test(L.hair), fo = Math.cos(a);
      /* sideburns: the hair runs down in front of each ear */
      if (L.hair !== 'afro') [-1, 1].forEach(function (sg) { var sbl = L.beard === 'full' || L.beard === 'short' || L.beard === 'stubble' || !SHORTC ? 51.5 : 47.5, hp2 = Math.PI / 2, b1 = onHead(sg * (hp2 - .42), 37), b2 = onHead(sg * (hp2 - .03), 37), b3 = onHead(sg * (hp2 - .09), sbl - 1.6), b4 = onHead(sg * (hp2 - .17), sbl + .4), b5 = onHead(sg * (hp2 - .26), sbl - 1.6), bs = function (q) { return q.x.toFixed(1) + ' ' + q.y.toFixed(1); };
        if (b3.f > -.2 && Math.abs(b1.x - b2.x) > .5 * k) head.appendChild(el('path', { d: 'M' + bs(b1) + ' L' + bs(b2) + ' L' + bs(b3) + ' Q' + bs(b4) + ' ' + bs(b5) + ' Z', fill: mixc(L.hairC, '#ffffff', .2) })); });
      head.appendChild(el('path', Object.assign(headPath('hair', hkey, hairPts(H, L.hair === 'side' || L.hair === 'waves' || L.hair === 'undercut', hatCovers ? null : L.hair === 'waves' ? [.035, 6] : L.hair === 'curly' ? [.05, 9] : L.hair === 'afro' ? [.07, 9] : L.hair === 'dreads' ? [.04, 14] : null)), { fill: grad(C.hair) })));
      /* a swept fringe: the hair falls a little over the forehead on one side, wrapping round as he turns – darker, in the shade of the hair above it */
      if (L.hair === 'quiff' && !hatCovers) { var qf = PH(0, 26 + hb6, 14), qb = PH(0, 30 + hb6, -2); head.appendChild(el('ellipse', { cx: (qf.X + qb.X) / 2, cy: (qf.Y + qb.Y) / 2, rx: Math.max(4 * k, Math.abs(qf.X - qb.X) / 2 + 8 * k * Math.abs(Math.cos(a))), ry: 7 * k, fill: grad(C.hair, 1) })); }
      if (!hatCovers && (L.hair === 'short' || L.hair === 'side' || L.hair === 'bangs' || L.hair === 'waves' || L.hair === 'undercut' || L.hair === 'quiff')) { var fN = 10, fr = headPath('fringe', hkey, function () { var fp = [];
        for (var fi = 0; fi <= fN; fi++) { var fph = -.9 + 1.5 * fi / fN, top = onHead(fph, 33), low = onHead(fph, 39 + 5 * Math.sin(Math.PI * fi / fN)); if (top.f > -.1) fp.push([top.x, top.y]); }
        for (var fj = fN; fj >= 0; fj--) { var fph2 = -.9 + 1.5 * fj / fN, low2 = onHead(fph2, 38.5 + 6 * Math.sin(Math.PI * fj / fN) * (fj / fN)); if (low2.f > -.1) fp.push([low2.x, low2.y]); }
        return fp.length > 4 ? fp : []; }); if (fr.d !== 'M Z') head.appendChild(el('path', Object.assign(fr, { fill: k > .85 ? dk(L.hairC, .72) : C.hair }))); }
      /* big enough to see: lighter strands where the light catches the hair – swept across the top from the front, curving down to the nape from behind, small curls on curly hair */
      if (k > .85 && Math.abs(fo) > .12 && L.hat === 'none') { var RRs = R * H[2], RH = R * H[3], dm = function (u, v) { return (hc.X + (u + Math.sin(a) * .1) * RRs).toFixed(1) + ' ' + (hc.Y - v * RH).toFixed(1); }, sdd = '';
        if (L.hair === 'curly' || L.hair === 'afro') { if (fo > 0) [[-.56, .7], [-.2, .84], [.2, .86], [.56, .72], [0, .68], [-.36, .64], [.38, .64]].forEach(function (c) { sdd += 'M' + dm(c[0] - .09, c[1] - .02) + ' Q' + dm(c[0], c[1] + .13) + ' ' + dm(c[0] + .09, c[1] - .02) + ' '; });
          else [[-.5, .55], [-.15, .7], [.2, .62], [.52, .5], [-.3, .25], [.1, .3], [.4, .15], [-.1, -.05]].forEach(function (c) { sdd += 'M' + dm(c[0] - .09, c[1] - .02) + ' Q' + dm(c[0], c[1] + .13) + ' ' + dm(c[0] + .09, c[1] - .02) + ' '; }); }
        else if (fo > 0) sdd = 'M' + dm(-.6, .7) + ' Q' + dm(-.12, 1.0) + ' ' + dm(.5, .82) + ' M' + dm(-.38, .68) + ' Q' + dm(.02, .9) + ' ' + dm(.44, .7) + ' M' + dm(.46, .84) + ' Q' + dm(.6, .74) + ' ' + dm(.68, .58);
        else [-.52, -.18, .18, .52].forEach(function (u) { sdd += 'M' + dm(u * .5, .92) + ' Q' + dm(u * 1.12, .38) + ' ' + dm(u * .8, SHORTC ? -.28 : -.5) + ' '; });
        if (sdd) head.appendChild(el('path', { d: sdd, fill: 'none', stroke: mixc(L.hairC, '#ffffff', .24), 'stroke-width': (1.05 * k).toFixed(2), 'stroke-linecap': 'round', opacity: (.68 * Math.min(1, Math.abs(fo) * 2)).toFixed(2) })); }
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
        var ear = ears[n]; if (Math.abs(ear.x - e.x) > 4 * k && ear.f > -.3) head.appendChild(el('line', { x1: e.x + (ear.x > e.x ? rw : -rw), y1: e.y - 1 * k, x2: ear.x, y2: ear.y - 2 * k, stroke: gc, 'stroke-width': 1.4 * k })); });
      if (eyes[0].f > .05 && eyes[1].f > .05) { var l0 = eyes[0].x < eyes[1].x ? eyes[0] : eyes[1], r0 = l0 === eyes[0] ? eyes[1] : eyes[0];
        head.appendChild(el('line', { x1: l0.x + 6 * k * Math.max(.3, l0.f), y1: l0.y - 1 * k, x2: r0.x - 6 * k * Math.max(.3, r0.f), y2: r0.y - 1 * k, stroke: gc, 'stroke-width': 1.4 * k })); }
    }
    /* hats */
    if (L.hat === 'beanie' || L.hat === 'bandana') {
      var hp = [], bandY = L.hat === 'beanie' ? 47.5 : 43;
      for (var hi = 0; hi <= 24; hi++) { var tt = Math.PI * hi / 24; hp.push([hc.X - Math.cos(tt) * R * 1.07, hc.Y - Math.sin(tt) * R * 1.16 + (bandY - 52) * k * (1 - Math.sin(tt)) ]); }
      hp.push([hc.X + R * 1.07, hc.Y + (bandY - 52) * k]); hp.push([hc.X - R * 1.07, hc.Y + (bandY - 52) * k]);
      head.appendChild(el('path', { d: poly(hp), fill: grad(L.hatC) }));
      if (L.hat === 'bandana') [-.5, .5].forEach(function (dx) { head.appendChild(el('circle', { cx: hc.X + dx * R * Math.cos(a), cy: hc.Y - R * .55, r: 1.3 * k, fill: '#f4f1ea', opacity: Math.cos(a) > .2 ? .9 : 0 })); });
      if (L.hat === 'beanie') head.appendChild(el('rect', { x: hc.X - R * 1.1, y: hc.Y + (bandY - 58) * k, width: R * 2.2, height: 8.5 * k, rx: 4 * k, fill: grad(dk0(L.hatC, .85)) }));
    }
    if (L.hat === 'party' || L.hat === 'santa' || L.hat === 'wizard' || L.hat === 'witch') {
      /* a cone on the crown of the head: the tip leans back a little; santa's flops, the witch's has a brim */
      var tall = { party: 26, santa: 24, wizard: 40, witch: 38 }[L.hat], base = R * (L.hat === 'party' ? .62 : 1.02), by = hc.Y - R * (L.hat === 'party' ? .9 : .62), tipP = PH(0, 52 - 22 - tall + hb6, L.hat === 'santa' ? -14 : -4), tipX = L.hat === 'santa' ? tipP.X + 10 * k : tipP.X;
      if (L.hat === 'witch') head.appendChild(el('ellipse', { cx: hc.X, cy: by + 2 * k, rx: R * 1.5, ry: 4.5 * k, fill: dk(L.hatC, .7) }));
      head.appendChild(el('path', { d: 'M' + (hc.X - base) + ' ' + by + ' Q' + hc.X + ' ' + (by + 3 * k) + ' ' + (hc.X + base) + ' ' + by + ' L' + tipX + ' ' + tipP.Y + ' Z', fill: grad(L.hat === 'santa' ? '#d42a2f' : L.hatC) }));
      if (L.hat === 'santa') { head.appendChild(el('rect', { x: hc.X - base * 1.04, y: by - 3 * k, width: base * 2.08, height: 7 * k, rx: 3.5 * k, fill: '#f4f1ea' })); head.appendChild(el('circle', { cx: tipX, cy: tipP.Y, r: 4 * k, fill: '#f4f1ea' })); }
      if (L.hat === 'party') [.3, .6].forEach(function (f) { head.appendChild(el('circle', { cx: hc.X + (tipX - hc.X) * f, cy: by + (tipP.Y - by) * f, r: 1.6 * k, fill: '#f2c94c' })); });
      if (L.hat === 'wizard') [.35, .7].forEach(function (f, i) { head.appendChild(el('circle', { cx: hc.X + (tipX - hc.X) * f + (i ? -3 : 3) * k, cy: by + (tipP.Y - by) * f, r: 1.5 * k, fill: '#f2c94c' })); });
    }
    if (L.hat === 'chef') { var cy1 = hc.Y - R * .6; head.appendChild(el('rect', { x: hc.X - R * .95, y: cy1 - 9 * k, width: R * 1.9, height: 11 * k, rx: 2 * k, fill: '#f4f4f2' }));
      head.appendChild(el('ellipse', { cx: hc.X, cy: cy1 - 16 * k, rx: R * 1.15, ry: 12 * k, fill: '#ffffff' })); }
    if (L.hat === 'cowboy') { var cby = hc.Y - R * .62; head.appendChild(el('ellipse', { cx: hc.X, cy: cby, rx: R * 1.75, ry: (4 + 4 * Math.abs(Math.sin(a)) * 0) * k + 3 * k, fill: dk(L.hatC, .8) }));
      head.appendChild(el('path', { d: 'M' + (hc.X - R * .82) + ' ' + cby + ' Q' + (hc.X - R * .9) + ' ' + (cby - 18 * k) + ' ' + hc.X + ' ' + (cby - 15 * k) + ' Q' + (hc.X + R * .9) + ' ' + (cby - 18 * k) + ' ' + (hc.X + R * .82) + ' ' + cby + ' Z', fill: grad(L.hatC) })); }
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
      head.appendChild(el('path', { d: poly(cp), fill: grad(L.hatC) }));
    }
    if (shadeOn) head.insertBefore(el('ellipse', { cx: (hc.X - frx * .2).toFixed(1), cy: (fcy - fry * .5).toFixed(1), rx: (frx * .62).toFixed(1), ry: (fry * .36).toFixed(1), fill: 'url(#f25hl) none' }), head.childNodes[2]);   /* the light on the forehead */
      if (POOL) { POOL.hk = HK; POOL.hL = L; POOL.hEl = head; POOL.hi1 = POOL.i; } }
    parts.push([0.5, head]);
    /* things behind or round the head that change sides: long hair, ponytail, bun, hood, a cap's brim */
    if (L.hair === 'dreads' && !hatCoversLong()) box(-19, 19, 44, 96, -16, -4, grad(C.hair), behind(0, 52, -10) > 0 ? 0.55 : -0.5, 9);
    if (L.hair === 'long' && !hatCoversLong()) {   /* long hair down the back: it widens a little, ends in a soft curve and has strands (it was a plain slab) */
      var lxs = [[-19, -16], [19, -16], [-19, -4], [19, -4]].map(function (q) { return rot(q[0], q[1], a).x; }), lx0 = HC.X + Math.min.apply(null, lxs) * k, lx1 = HC.X + Math.max.apply(null, lxs) * k, lt = P(0, 44 + hb6, 0).Y, lb = P(0, 97 + hb6, 0).Y, lw = lx1 - lx0, lh = lb - lt, lbk = behind(0, 52, -10) > 0, lr = Math.min(16 * k, lw / 2), lfx = function (v) { return v.toFixed(1); };
      parts.push([lbk ? 0.55 : -0.5, el('path', { d: 'M' + lfx(lx0) + ' ' + lfx(lt + lr) + ' Q' + lfx(lx0) + ' ' + lfx(lt) + ' ' + lfx(lx0 + lr) + ' ' + lfx(lt) + ' L' + lfx(lx1 - lr) + ' ' + lfx(lt) + ' Q' + lfx(lx1) + ' ' + lfx(lt) + ' ' + lfx(lx1) + ' ' + lfx(lt + lr) + ' C' + lfx(lx1 + lw * .07) + ' ' + lfx(lt + lh * .55) + ' ' + lfx(lx1 + lw * .04) + ' ' + lfx(lb - lh * .08) + ' ' + lfx(lx1 - lw * .14) + ' ' + lfx(lb - 1.5 * k) + ' Q' + lfx((lx0 + lx1) / 2) + ' ' + lfx(lb + 4.5 * k) + ' ' + lfx(lx0 + lw * .14) + ' ' + lfx(lb - 1.5 * k) + ' C' + lfx(lx0 - lw * .04) + ' ' + lfx(lb - lh * .08) + ' ' + lfx(lx0 - lw * .07) + ' ' + lfx(lt + lh * .55) + ' ' + lfx(lx0) + ' ' + lfx(lt + lr) + ' Z', fill: grad(C.hair) })]);
      if (lbk && k > .85 && lw > 14 * k) { var lsd = ''; [.2, .4, .6, .8].forEach(function (u, ui) { var sx0 = lx0 + lw * u; lsd += 'M' + lfx(sx0) + ' ' + lfx(lt + lh * .3) + ' Q' + lfx(sx0 + (u - .5) * lw * .1) + ' ' + lfx(lt + lh * .7) + ' ' + lfx(sx0 + (u - .5) * lw * .04) + ' ' + lfx(lb - (3 + (ui % 2) * 3) * k) + ' '; });
        parts.push([0.551, el('path', { d: lsd, fill: 'none', stroke: mixc(L.hairC, '#ffffff', .24), 'stroke-width': (1.05 * k).toFixed(2), 'stroke-linecap': 'round', opacity: .5 })]); } }
    if (L.hair === 'braids' && !hatCoversLong()) [-12, 12].forEach(function (bx2) { var b1 = P(bx2, 50 + hb6, -14), b2 = P(bx2, 98 + hb6, -12); parts.push([behind(bx2, 50, -14) > 0 ? 0.55 : -0.5, el('line', { x1: b1.X, y1: b1.Y, x2: b2.X, y2: b2.Y, stroke: C.hair, 'stroke-width': 6 * k, 'stroke-linecap': 'round', 'stroke-dasharray': (4 * k) + ' ' + (1.2 * k) })]); });
    if (L.hair === 'pigtails' && !hatCoversLong()) [-1, 1].forEach(function (sd2) { var p1 = P(sd2 * 21, 46 + hb6, -6), p2 = P(sd2 * 26, 74 + hb6, -8); parts.push([behind(sd2 * 21, 46, -6) > 0 ? 0.56 : -0.4, el('line', { x1: p1.X, y1: p1.Y, x2: p2.X, y2: p2.Y, stroke: C.hair, 'stroke-width': 8 * k, 'stroke-linecap': 'round' })]); });
    if (L.hair === 'pony' && !hatCoversLong()) { var sw2 = w * 3 * Math.sin(ph * 2), b1 = P(0, 42 + hb6, -21), b2 = P(sw2, 80 + hb6, -27); parts.push([behind(0, 42, -21) > 0 ? 0.56 : -0.4, el('line', { x1: b1.X, y1: b1.Y, x2: b2.X, y2: b2.Y, stroke: C.hair, 'stroke-width': 10 * k, 'stroke-linecap': 'round' })]); }
    if (L.hair === 'bun' && !hatCovers) { var bb = P(0, 32 + hb6, -12); parts.push([behind(0, 32, -12) > 0 ? 0.56 : 0.45, el('circle', { cx: bb.X, cy: bb.Y, r: 9 * k, fill: C.hair })]); }
    if (L.top === 'hoodie') box(-17, 17, 70, 94, -15, -5, C.top2, behind(0, 80, -10) > 0 ? 0.3 : -0.3, 8);
    if (L.hat === 'cap') { var bz = rot(0, 22, a).z, br = [[-13, 14], [13, 14], [-13, 33], [13, 33]].map(function (q) { return rot(q[0], q[1], a).x; }), b0 = Math.min.apply(null, br), b9 = Math.max.apply(null, br), byy = P(0, 41 + hb6, 0).Y;
      parts.push([bz > 0 ? 0.57 : 0.45, el('ellipse', { cx: HC.X + (b0 + b9) / 2 * k, cy: byy, rx: Math.max(3, (b9 - b0) / 2) * k, ry: 3.2 * k, fill: dk(L.hatC, .85) })]); }
    var pv = P(0, 74 + hb6, 0), HT = 'translate(' + pv.X.toFixed(1) + ' ' + pv.Y.toFixed(1) + ') scale(' + HSX + ' ' + HSC + ') translate(' + (-pv.X).toFixed(1) + ' ' + (-pv.Y).toFixed(1) + ')';
    for (var hi = hStart; hi < parts.length; hi++) { var hwr = el('g', { transform: HT }); hwr.appendChild(parts[hi][1]); parts[hi][1] = hwr; }
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
      [-1, 1].forEach(function (sd) { var hd = HAND['s' + sd]; if (!hd) return; if (hd.busy) { var hr = P(sd * (L.bp.sx + 3.2), 148 + bob, 8); hd = { X: hr.X, Y: hr.Y, z: hd.z }; }   /* a busy hand lets go: the crutch stays where it stood (it used to stretch up to the hand) */
        var tip = P(sd * 34 * BW * L.bp.sh, 216, 10 + 9 * Math.sin(ph + (sd < 0 ? Math.PI : 0)) * w), cuff = { X: hd.X + (hd.X - tip.X) * .32, Y: hd.Y + (hd.Y - tip.Y) * .32 };
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
  var VIS = { a: [2.6, 2.7, 0], o: [1.7, 2.1, 0], e: [3.3, 1.6, 1] }, VSEQ = ['a', 'm', 'e', 'o', 'a', 'e', 'm', 'o'], BROWS = { none: [0, 0], up: [-1.5, -1.8], down: [-.4, 1.5], sad: [.9, -1.4] };
  var PETS = { dog: { c: '#b07a45', len: 16, h: 22, r: 7, head: 7.5 }, cat: { c: '#5b5f6a', len: 13, h: 18, r: 5.6, head: 6.2 }, bunny: { c: '#e9e4dc', len: 9, h: 9, r: 7.5, head: 6 }, bird: { c: '#3987e5', len: 6, h: 6, r: 5, head: 3.6 } };
  /* the pets, in the same look as the body (2026-11-13): every part a gradient of its own colour, the head a dome, legs that narrow
     to a paw, a lighter muzzle with a nose; the finest bits (inner ears, the light in the eyes) only when drawn big */
  function pet(kind, a, x, gy, k, ph, w) {
    var P0 = PETS[kind]; if (!P0) return []; var out = [], c2 = dk(P0.c, .82), c3 = mixc(P0.c, '#ffffff', .38), BIG = k > .85, hop = kind === 'bunny' || kind === 'bird' ? Math.abs(Math.sin(ph)) * 6 * (w || 0) : 0;
    function Q(dx, y, dz) { var r = rot(dx, dz, a); return { X: x + r.x * k, Y: gy - (y + hop) * k, Z: r.z }; }
    function n1(v) { return v.toFixed(1); }
    var body = Q(0, P0.h, 0), head = Q(0, P0.h + P0.head * .8, P0.len), tail = Q(0, P0.h + 2, -P0.len), hz = rot(0, P0.len, a).z;
    var brx = Math.max(P0.r, Math.sqrt(Math.pow(P0.len * Math.sin(a), 2) + Math.pow(P0.r * Math.cos(a), 2))) * k;
    if (kind !== 'bird' && kind !== 'bunny') [-1, 1].forEach(function (sd) { [-1, 1].forEach(function (fb) { var sw = Math.sin(ph + (fb * sd > 0 ? 0 : Math.PI)) * 4 * (w || 0), top = Q(sd * P0.r * .5, P0.h - 2, fb * P0.len * .6), ft = Q(sd * P0.r * .5, 1.2, fb * P0.len * .6 + sw), lz = rot(sd * 4, fb * 10, a).z, lc = lz > 0 ? P0.c : c2, wt = 2.3 * k, wb = 1.5 * k;
      out.push([lz * .01 - .5, el('path', { d: 'M' + n1(top.X - wt) + ' ' + n1(top.Y) + ' L' + n1(top.X + wt) + ' ' + n1(top.Y) + ' L' + n1(ft.X + wb) + ' ' + n1(ft.Y) + ' L' + n1(ft.X - wb) + ' ' + n1(ft.Y) + ' Z', fill: lc, stroke: lc, 'stroke-width': n1(.8 * k), 'stroke-linejoin': 'round' })]);
      var pw = Q(sd * P0.r * .5, .2, fb * P0.len * .6 + sw + 1.4); out.push([lz * .01 - .49, el('ellipse', { cx: n1(pw.X), cy: n1(ft.Y + .3 * k), rx: n1(2.5 * k), ry: n1(1.5 * k), fill: lz > 0 ? c3 : P0.c })]); }); });
    if (kind === 'bunny') [-1, 1].forEach(function (sd) { var bf = Q(sd * 4.2, .2, P0.len * .55); out.push([rot(sd * 4.2, P0.len * .55, a).z * .01 + .02, el('ellipse', { cx: n1(bf.X), cy: n1(bf.Y - 1.6 * k), rx: n1(3.2 * k), ry: n1(1.9 * k), fill: grad(P0.c, 1) })]); });
    if (kind === 'bird') [-1, 1].forEach(function (sd) { var bl1 = Q(sd * 1.6, P0.h - P0.r * .8, 0), bl2 = Q(sd * 1.6, 0, .6); out.push([-.3, el('line', { x1: n1(bl1.X), y1: n1(bl1.Y), x2: n1(bl2.X), y2: n1(bl2.Y), stroke: '#f2a93b', 'stroke-width': n1(.9 * k), 'stroke-linecap': 'round' })]); });
    var tz = rot(0, -P0.len, a).z * .01 - .2;
    if (kind === 'dog') out.push([tz, el('path', { d: 'M' + n1(tail.X) + ' ' + n1(tail.Y) + ' q' + n1(Math.sin(ph * 3) * 4 * k) + ' ' + n1(-8 * k) + ' ' + n1(2 * k) + ' ' + n1(-12 * k), fill: 'none', stroke: c2, 'stroke-width': n1(3.2 * k), 'stroke-linecap': 'round' })]);
    if (kind === 'cat') out.push([tz, el('path', { d: 'M' + n1(tail.X) + ' ' + n1(tail.Y) + ' q' + n1(-6 * k) + ' ' + n1(-10 * k) + ' ' + n1(2 * k) + ' ' + n1(-20 * k), fill: 'none', stroke: c2, 'stroke-width': n1(3 * k), 'stroke-linecap': 'round' })]);
    if (kind === 'bunny') out.push([tz, el('circle', { cx: n1(tail.X), cy: n1(tail.Y), r: n1(3 * k), fill: '#ffffff' })]);
    if (kind === 'bird') { var tf = Q(0, P0.h + 1, -P0.len - 4); out.push([tz, el('path', { d: 'M' + n1(body.X) + ' ' + n1(body.Y - 2 * k) + ' L' + n1(tf.X) + ' ' + n1(tf.Y - 1.5 * k) + ' L' + n1(tf.X) + ' ' + n1(tf.Y + 2 * k) + ' L' + n1(body.X) + ' ' + n1(body.Y + 2 * k) + ' Z', fill: c2 })]); }
    out.push([0, el('ellipse', { cx: n1(body.X), cy: n1(body.Y), rx: n1(brx), ry: n1(P0.r * k), fill: grad(P0.c) })]);
    if (kind !== 'bird') out.push([.01, el('ellipse', { cx: n1(body.X), cy: n1(body.Y + P0.r * .55 * k), rx: n1(brx * .72), ry: n1(P0.r * .34 * k), fill: c3, opacity: .45 })]);   /* a lighter belly */
    if (kind === 'bird') { var wg = Q(0, P0.h + 1, -1), bly = Q(0, P0.h - 1.4, 1.5); out.push([.04, el('ellipse', { cx: n1(bly.X), cy: n1(bly.Y), rx: n1(brx * .6), ry: n1(P0.r * .55 * k), fill: c3, opacity: .6 })]); out.push([.05, el('ellipse', { cx: n1(wg.X), cy: n1(wg.Y), rx: n1(brx * .7), ry: n1(P0.r * .55 * k), fill: grad(c2) })]); }
    var hg = el('g', {}), face = Math.cos(a) > -.2, hadd = function (n, at) { hg.appendChild(el(n, at)); };
    if (kind === 'dog') [-1, 1].forEach(function (sd) { var e = Q(sd * 5, P0.h + P0.head * 1.1, P0.len - 1); if (rot(sd * 5, P0.len - 1, a).z < hz) hadd('ellipse', { cx: n1(e.X), cy: n1(e.Y + 3 * k), rx: n1(2.6 * k), ry: n1(5 * k), fill: c2 }); });   /* the far ear behind the head */
    if (kind === 'cat') [-1, 1].forEach(function (sd) { var e = Q(sd * 4, P0.h + P0.head * 1.6, P0.len); hadd('path', { d: 'M' + n1(e.X - 2.8 * k) + ' ' + n1(e.Y + 3 * k) + ' L' + n1(e.X + sd * .4 * k) + ' ' + n1(e.Y - 3.6 * k) + ' L' + n1(e.X + 2.8 * k) + ' ' + n1(e.Y + 3 * k) + ' Z', fill: P0.c, stroke: P0.c, 'stroke-width': n1(.8 * k), 'stroke-linejoin': 'round' });
      if (BIG && face) hadd('path', { d: 'M' + n1(e.X - 1.3 * k) + ' ' + n1(e.Y + 2.4 * k) + ' L' + n1(e.X + sd * .3 * k) + ' ' + n1(e.Y - 1.6 * k) + ' L' + n1(e.X + 1.3 * k) + ' ' + n1(e.Y + 2.4 * k) + ' Z', fill: '#e7a6a6' }); });
    if (kind === 'bunny') [-1, 1].forEach(function (sd) { var e = Q(sd * 2.6, P0.h + P0.head * 2.2, P0.len - 2); hadd('ellipse', { cx: n1(e.X), cy: n1(e.Y), rx: n1(2.3 * k), ry: n1(7 * k), fill: grad(P0.c), transform: 'rotate(' + (sd * 7) + ' ' + n1(e.X) + ' ' + n1(e.Y + 6 * k) + ')' });
      if (face) hadd('ellipse', { cx: n1(e.X), cy: n1(e.Y + .6 * k), rx: n1(1 * k), ry: n1(4.8 * k), fill: '#f0b7b7', transform: 'rotate(' + (sd * 7) + ' ' + n1(e.X) + ' ' + n1(e.Y + 6 * k) + ')' }); });
    hadd('circle', { cx: n1(head.X), cy: n1(head.Y), r: n1(P0.head * k), fill: grad(P0.c, 1) });
    if (kind === 'bird') { var bk = Q(0, P0.h + P0.head * .8, P0.len + 4); hadd('path', { d: 'M' + n1(head.X) + ' ' + n1(head.Y - 1 * k) + ' L' + n1(bk.X) + ' ' + n1(bk.Y) + ' L' + n1(head.X) + ' ' + n1(head.Y + 1.4 * k) + ' Z', fill: '#f2a93b' }); }
    if (kind !== 'bird' && face) { var mzr = kind === 'dog' ? .5 : .36, mz = Q(0, P0.h + P0.head * (kind === 'dog' ? .5 : .56), P0.len + P0.head * (kind === 'dog' ? .95 : .78)), ns = Q(0, P0.h + P0.head * (kind === 'dog' ? .72 : .68), P0.len + P0.head * (kind === 'dog' ? 1.38 : 1.05));
      hadd('ellipse', { cx: n1(mz.X), cy: n1(mz.Y), rx: n1(P0.head * mzr * k), ry: n1(P0.head * mzr * .78 * k), fill: c3 });
      hadd('ellipse', { cx: n1(ns.X), cy: n1(ns.Y), rx: n1((kind === 'dog' ? 1.5 : .95) * k), ry: n1((kind === 'dog' ? 1.15 : .75) * k), fill: kind === 'dog' ? '#2a1c14' : '#d98a8a' }); }
    if (kind === 'dog') [-1, 1].forEach(function (sd) { var e = Q(sd * 5.6, P0.h + P0.head * 1.1, P0.len - 1); if (rot(sd * 5, P0.len - 1, a).z >= hz) hadd('ellipse', { cx: n1(e.X), cy: n1(e.Y + 3.4 * k), rx: n1(2.7 * k), ry: n1(5.2 * k), fill: grad(c2), transform: 'rotate(' + (sd * -8) + ' ' + n1(e.X) + ' ' + n1(e.Y - 1 * k) + ')' }); });   /* the near ear hangs over the head */
    if (face) [-1, 1].forEach(function (sd) { var e = Q(sd * P0.head * .42, P0.h + P0.head * .95, P0.len + P0.head * .7); if (rot(sd * P0.head * .42, P0.len + P0.head * .7, a).z > 0) { hadd('circle', { cx: n1(e.X), cy: n1(e.Y), r: n1((kind === 'bird' ? .8 : 1.1) * k), fill: '#1b1f27' }); if (BIG) hadd('circle', { cx: n1(e.X - .35 * k), cy: n1(e.Y - .35 * k), r: n1(.35 * k), fill: '#ffffff' }); } });
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
    var d = el('defs', {}); s.appendChild(d); GUSE = {};
    if (o.shadow !== false) s.appendChild(el('ellipse', { cx: W / 2, cy: Hh - 6, rx: W * .16, ry: 3, fill: 'rgba(0,0,0,.22)' }));
    var a = (o.a == null ? 18 : o.a) * Math.PI / 180, k = o.k || (Hh - 12) / 200;
    var pk = look && look.pet && look.pet !== 'none' && o.pet !== false ? look.pet : '';
    if (pk) pet(pk, a, W / 2 + W * .3, Hh - 6, k, 0, 0).forEach(function (p) { s.appendChild(p[1]); });
    try { draw(look, a, W / 2 - (pk ? W * .08 : 0), Hh - 6, k, o.ph || 0, o.w2 || 0, o.pose || {}).forEach(function (p) { s.appendChild(p[1]); }); var gh = DEFS_HTML; for (var gi in GUSE) gh += GUSE[gi]; d.innerHTML = gh; } finally { GUSE = null; }
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
    svg: svg, group: group, pet: pet, look: look25, viseme: function (t) { return VSEQ[Math.floor(Math.max(0, t) * 8) % 8]; }, HOLDS: HOLDS, hand: function () { return HAND; }, TOP_STD: TOP_STD
  };
})();
