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
  /* a lighter shade (the top of a dark shoe catching the light): mixed toward white, worked out once per colour */
  function lt(h) { var key = h + '|lt', m = DK[key]; if (m) return m; var c = /^#[0-9a-f]{6}$/i.test(h || '') ? h : '#888888', n = parseInt(c.slice(1), 16), mix = function (v) { return Math.round(v + (255 - v) * .32); }; return (DK[key] = 'rgb(' + mix(n >> 16) + ',' + mix((n >> 8) & 255) + ',' + mix(n & 255) + ')'); }
  /* two colours mixed (t of the second), worked out once – the short sides of a fade: the hair over the skin */
  function mix(h1, h2, t) { var key = h1 + '|' + h2 + '|' + t, m = DK[key]; if (m) return m; var hx = function (h) { h = /^#[0-9a-f]{6}$/i.test(h || '') ? h : '#888888'; var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }, A = hx(h1), Bq = hx(h2);
    return (DK[key] = '#' + A.map(function (v, i) { return ('0' + Math.round(v + (Bq[i] - v) * t).toString(16)).slice(-2); }).join('')); }
  function cst(h) { var c = /^#[0-9a-f]{6}$/i.test(h || '') ? h : '#888888', n = parseInt(c.slice(1), 16), lum = (.3 * (n >> 16) + .59 * ((n >> 8) & 255) + .11 * (n & 255)) / 255; return lum < .32 ? mix(c, '#ffffff', .24) : dk(c, .78); }   /* seams, cuffs and pockets you can see on any colour */
  function dk0(h, f) { h = /^#[0-9a-f]{6}$/i.test(h || '') ? h : '#888888'; var n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; f = f || .82; return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')'; }
  function colours() { C = { skin: L.skin, skin2: dk(L.skin, .87), hair: L.hairC, top: L.topC, top2: dk(L.topC, .8), legs: L.legsC, legs2: dk(L.legsC, .82), shoe: L.shoeC, eye: /^#[0-9a-f]{6}$/i.test(L.eyeC || '') ? L.eyeC : '#4a3426', mouth: '#8a4a3a' }; }
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
  /* an ellipse turned by deg round its middle, as a path (so several can share one element) */
  function oval(cx, cy, rx, ry, deg) { var t = deg * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t), r = rx.toFixed(1) + ' ' + ry.toFixed(1) + ' ' + deg.toFixed(0) + ' 1 0 '; var x1 = (cx - ry * sn).toFixed(1), y1 = (cy + ry * c).toFixed(1), x2 = (cx + ry * sn).toFixed(1), y2 = (cy - ry * c).toFixed(1); return 'M' + x1 + ' ' + y1 + ' A' + r + x2 + ' ' + y2 + ' A' + r + x1 + ' ' + y1 + ' Z'; }
  /* the light: from the upper left – a soft highlight and a shade, the same whichever way he faces. One copy per page. */
  var DEFS_HTML = '<radialGradient id="shHead" cx="34%" cy="30%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>' +
    '<linearGradient id="shBody" x1="0" y1="0" x2="1" y2=".25"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>';
  var DEFS = null;   /* the defs element once made: checking .isConnected is much cheaper than a lookup by id every frame */
  function ensureDefs() { if (DEFS && DEFS.isConnected) return; DEFS = document.getElementById('shHead'); if (DEFS) return; var s = document.createElementNS(NS, 'svg'); s.setAttribute('width', '0'); s.setAttribute('height', '0'); s.setAttribute('aria-hidden', 'true'); s.style.position = 'absolute'; var d = document.createElementNS(NS, 'defs'); d.innerHTML = DEFS_HTML; s.appendChild(d); (document.body || document.documentElement).appendChild(s); DEFS = d.firstChild; }

  /* a cmd look → what the 2.5D body needs. Choices that share a shape are drawn by the same part. */
  var TOPS = { tee: { bare: 'short' }, tank: { bare: 'arms' }, polo: { collar: 1, bare: 'short' }, sweater: {}, knit: {}, hoodie: {}, shirt: {}, jersey: { stripe: 1 }, kit: { bare: 'short' },
    varsity: { sleeve: '#f4f1ea' }, suit: { jacket: '#2e3340' }, puffer: { quilt: 1 }, rain: { hood: 1, zip: 1 }, jacket: { zip: 1 }, dress: { bare: 'short', skirt: 'knee' }, bunad: { band: 1, sleeve: '#f4f4f2' },
    scrubs: { vneck: 1, bare: 'short' }, chef: { buttons2: 1 }, pjs: { stripes: 1 }, robe: { wrap: 1 }, none: { bare: 'arms' },
    turtle: {}, cardigan: { btns: 1 } };   /* 2026-11-21 (JP: more outfits): a turtleneck and a knitted cardigan over a shirt collar */
  /* how each top is cut (JP 2026-11-15: clothes must fit the body, not be drawn on it): e = how loose round the body, hem = where it ends
     (146 the hips, 170 mid-thigh, 182 the knee), neck = crew, v, stand (a collar band), hood, open; rib = a knitted band at the hem and cuffs;
     se = how much fuller the sleeve is than the arm; pk = pockets (kanga, hip, chest) */
  var GARM = { tee: { e: 1.02, neck: 'crew' }, tank: { e: 1.0, neck: 'crew' }, polo: { e: 1.03, placket: 1, polo: 1 }, sweater: { e: 1.05, hem: 148, neck: 'crew', rib: 1, se: .6, shirtCol: 1 }, knit: { e: 1.07, hem: 148, neck: 'crew', rib: 1, se: 1 },
    hoodie: { e: 1.08, hem: 150, neck: 'hood', rib: 1, se: 1.2, pk: 'kanga' }, shirt: { e: 1.03, hem: 149, cuff: 1 }, jersey: { e: 1.03, neck: 'crew', cuff: 1 }, kit: { e: 1.03, neck: 'v', shoulder: 1 },
    varsity: { e: 1.08, hem: 148, neck: 'stand', rib: 1, se: 1, pk: 'hip' }, suit: { e: 1.04, hem: 157, pk: 'hip', cuff: 1 }, puffer: { e: 1.18, hem: 151, neck: 'stand', se: 2.6, rib: 1 },
    rain: { e: 1.12, hem: 171, neck: 'hood', se: 1.6, pk: 'hip' }, jacket: { e: 1.1, hem: 151, neck: 'stand', se: 1.2, pk: 'hip', rib: 1 }, dress: { e: 1.02, neck: 'crew' }, bunad: { e: 1.03, hem: 150 },
    scrubs: { e: 1.05, pk: 'chest' }, chef: { e: 1.07, hem: 153, neck: 'stand', cuff: 1 }, pjs: { e: 1.05, hem: 149, neck: 'crew', cuff: 1 }, robe: { e: 1.1, hem: 183, se: 1.8 }, none: { e: 1 },
    turtle: { e: 1.04, hem: 148, neck: 'turtle', rib: 1, se: .6 }, cardigan: { e: 1.07, hem: 150, neck: 'v', vdeep: 1, vfill: '#f4f1ea', rib: 1, se: 1, pk: 'hip', shirtCol: 1 } };
  var SHOES = { sneakers: '#1a1a1a', hightops: '#d93a3a', boots: '#5b3a1e', sandals: '#8a5e44', slippers: '#e0559a', cleats: '#1a1a1a' };
  /* the build changes the whole body, not only its width (JP, 2026-11-12: "the composition does not fit the body"):
     w = body width, d = depth (front to back), sh = shoulders, wa = waist, hp = hips, arm / leg = how thick */
  var BUILD = {
    slim:     { w: .9,  d: .88, sh: .92, wa: .86, hp: .9,  arm: .8,  leg: .82 },
    regular:  { w: 1,   d: 1,   sh: 1,   wa: 1,   hp: 1,   arm: 1,   leg: 1 },
    athletic: { w: 1.04, d: 1.04, sh: 1.2, wa: .84, hp: .98, arm: 1.06, leg: 1.16, mus: 1 },   /* mus: muscles are drawn (shoulders, upper arms, thighs, calves; chest and stomach when bare) */
    muscular: { w: 1.1, d: 1.14, sh: 1.34, wa: .88, hp: 1.04, arm: 1.12, leg: 1.3, mus: 2 },
    broad:    { w: 1.2, d: 1.28, sh: 1.1, wa: 1.22, hp: 1.16, arm: 1.16, leg: 1.2 }   /* JP: the build changed too little – the spread is bigger and athletic/muscular have muscles */
  };
  function look25(l) {
    l = l || {}; if (window.Avatar && Avatar.trimLook) l = Avatar.trimLook(l);
    var top = TOPS[l.top] ? l.top : 'sweater', t = TOPS[top], bottom = l.bottom || 'trousers';
    var o = { skin: l.skin || '#c99a73', hairC: l.hairC || '#1e140d', hair: { ponytail: 'pony', topknot: 'bun' }[l.hair] || l.hair || 'short',
      beard: l.beard || 'none', glasses: l.glasses || 'none', expr: l.expr || 'smile', makeup: l.makeup || 'none', cheeks: l.cheeks || 'none', faceS: l.faceS || 'oval', eyeC: l.eyeC || '',
      top: top, topC: top === 'chef' ? '#f4f4f2' : (/^#[0-9a-f]{6}$/i.test(l.topC || '') ? l.topC : TOP_STD), bottom: bottom, legsC: l.legs || '#2a2f3a', shoes: l.shoes || 'sneakers',
      hat: l.hat || 'none', hatC: l.hatC || '#e8743b', neck: l.wxScarf ? 'scarf' : 'none', neckC: l.hatC || '#e8743b', aid: l.aid || 'none',
      bare: t.bare || '', sleeve: t.sleeve || '', skirt: t.skirt || (bottom === 'skirt' ? 'knee' : ''), legsOn: bottom === 'shorts' ? 'thigh' : bottom === 'swim' ? 'swim' : top === 'dress' ? 'none' : 'full',
      bw: (BUILD[l.build] || BUILD.regular).w, bp: BUILD[l.build] || BUILD.regular, hs: { short: .975, tall: 1.02 }[l.height] || 1, lf: { short: .9, tall: 1.1 }[l.height] || 1 };   /* height: mostly the legs (lf), a little overall (hs) */
    o.shoeC = SHOES[o.shoes] || '#1a1a1a';
    if (top === 'dress') o.legsC = o.skin;
    if (o.hair === 'bald') o.hair = 'none';
    return o;
  }
  /* the details that make each top what it is (the colour is the same standard for all since F0) */
  function topDetails(parts, a, k, t1, t2, hw, bob, P, TD, topY, botY) {
    var BWs = function () { return L.bw || 1; };
    var t = TOPS[L.top] || {}, fr = Math.cos(a), front = fr > .15, line = function (p, q, col, wd, z) { parts.push([z || .02, el('line', { x1: p.X, y1: p.Y, x2: q.X, y2: q.Y, stroke: col, 'stroke-width': wd * k, 'stroke-linecap': 'round' })]); };
    var clipId = POOL ? POOL.id + 't' : 'f25t' + (function (str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); })(TD + L.top),   /* the same drawing gets the same id (a counter made every drawing different) */ wrap = el('g', {}), cp = el('clipPath', { id: clipId }); cp.appendChild(el('path', { d: TD })); wrap.appendChild(cp); var g = el('g', { 'clip-path': 'url(#' + clipId + ')' }); wrap.appendChild(g);
    var add = function (n, at) { g.appendChild(el(n, at)); }, W = hw * k;
    if (t.jacket) { add('path', { d: TD, fill: t.jacket }); if (front) { var v1 = P(-9, 80 + bob, 15), v2 = P(0, 112 + bob, 16), v3 = P(9, 80 + bob, 15); add('path', { d: 'M' + v1.X + ' ' + v1.Y + ' L' + v2.X + ' ' + v2.Y + ' L' + v3.X + ' ' + v3.Y + ' Z', fill: '#f4f4f2' }); var ti = P(0, 84 + bob, 16), tb = P(0, 108 + bob, 17); add('path', { d: 'M' + (ti.X - 2 * k) + ' ' + ti.Y + ' L' + (ti.X + 2 * k) + ' ' + ti.Y + ' L' + (tb.X + 2.4 * k) + ' ' + tb.Y + ' L' + tb.X + ' ' + (tb.Y + 3 * k) + ' L' + (tb.X - 2.4 * k) + ' ' + tb.Y + ' Z', fill: '#d42a2f' }); } }
    if (t.quilt) for (var qy = 1; qy <= 4; qy++) { var yy = t1.Y + (t2.Y - t1.Y) * qy / 5; add('path', { d: 'M' + (t1.X - W) + ' ' + yy + ' L' + (t1.X + W) + ' ' + yy, stroke: dk(L.topC, .75), 'stroke-width': 1.4 * k }); }
    if (t.btns && front) [104, 116, 128, 140].forEach(function (y) { var bp = P(0, y + bob, 16.5); add('circle', { cx: bp.X, cy: bp.Y, r: 1.25 * k, fill: dk(L.topC, .55) }); });   /* the cardigan's buttons down the front */
    if (t.zip && front) { var z1 = P(0, 82 + bob, 16), z2 = P(0, 146 + bob, 17); add('path', { d: 'M' + z1.X + ' ' + z1.Y + ' L' + z2.X + ' ' + z2.Y, stroke: dk(L.topC, .65), 'stroke-width': 1.6 * k }); }
    if (t.stripe) { var sy = t1.Y + 20 * k; add('rect', { x: t1.X - W, y: sy, width: W * 2, height: 6 * k, fill: '#f4f1ea', opacity: .9 }); }
    if (t.band) { var by = t1.Y + 16 * k; add('rect', { x: t1.X - W, y: by, width: W * 2, height: 9 * k, fill: '#d42a2f' }); add('rect', { x: t1.X - W, y: by + 3 * k, width: W * 2, height: 3 * k, fill: '#f2c94c' }); }
    if (t.stripes) for (var sx = -5; sx <= 5; sx++) { var stt = sx * .3, s1p = P(Math.sin(stt) * 24 * BWs(), 82 + bob, Math.cos(stt) * 14), s2p = P(Math.sin(stt) * 25 * BWs(), botY, Math.cos(stt) * 13); if (Math.cos(stt + a) > .12) add('path', { d: 'M' + s1p.X + ' ' + s1p.Y + ' L' + s2p.X + ' ' + s2p.Y, stroke: '#f4f1ea', 'stroke-width': 2 * k * Math.cos(stt + a), opacity: .55 }); }   /* the stripes wrap round the body as he turns */
    if (t.wrap && front) { var w1 = P(-12, 80 + bob, 14), w2 = P(10, 132 + bob, 16); add('path', { d: 'M' + w1.X + ' ' + w1.Y + ' L' + w2.X + ' ' + w2.Y, stroke: dk(L.topC, .65), 'stroke-width': 2 * k }); var bl = t1.Y + 50 * k; add('rect', { x: t1.X - W, y: bl, width: W * 2, height: 5 * k, fill: dk(L.topC, .7) }); }
    if (t.vneck && front) { var n1 = P(-7, 80 + bob, 14), n2 = P(0, 94 + bob, 16), n3 = P(7, 80 + bob, 14); add('path', { d: 'M' + n1.X + ' ' + n1.Y + ' L' + n2.X + ' ' + n2.Y + ' L' + n3.X + ' ' + n3.Y, fill: L.skin, stroke: dk(L.topC, .7), 'stroke-width': 1.2 * k }); }
    if (t.collar && front) { var c1 = P(-8, 79 + bob, 12), c2 = P(0, 88 + bob, 13), c3 = P(8, 79 + bob, 12); add('path', { d: 'M' + c1.X + ' ' + c1.Y + ' L' + c2.X + ' ' + c2.Y + ' L' + c3.X + ' ' + c3.Y, fill: 'none', stroke: dk(L.topC, .65), 'stroke-width': 2.2 * k }); }
    if (t.buttons2 && front) [96, 110, 124].forEach(function (yy2) { [-5, 5].forEach(function (bx) { var bt = P(bx, yy2 + bob, 15); add('circle', { cx: bt.X, cy: bt.Y, r: 1.3 * k, fill: '#9aa3ad' }); }); });
    if (L.top === 'none' && front) { [-6, 6].forEach(function (nx) { var nb = P(nx, 100 + bob, 15); add('circle', { cx: nb.X, cy: nb.Y, r: .9 * k, fill: dk(L.skin, .7) }); }); }
    var GMt = GARM[L.top] || {}, dc = dk(L.topC, .8), around = function (r, y, t0, t1b, dz) { var pp = [], n = 14; for (var i = 0; i <= n; i++) { var tt = t0 + (t1b - t0) * i / n; if (Math.cos(tt + a) < -0.05) continue; var q = P(Math.sin(tt) * r, y + bob + (1 - Math.cos(tt)) * (dz || 0), Math.cos(tt) * r * .8 + 1); pp.push(q.X.toFixed(1) + ' ' + q.Y.toFixed(1)); } return pp.length > 1 ? 'M' + pp.join(' L') : ''; };

    if (GMt.pk === 'kanga' && front) { var kq = [P(-9, 118 + bob, 15.5), P(9, 118 + bob, 15.5), P(12, 136 + bob, 14.5), P(-12, 136 + bob, 14.5)]; add('path', { d: 'M' + kq.map(function (q) { return q.X.toFixed(1) + ' ' + q.Y.toFixed(1); }).join(' L') + ' Z', fill: dk(L.topC, .9), stroke: dk(L.topC, .72), 'stroke-width': 1 * k }); }   /* the front pocket */
    if (GMt.pk === 'hip' && fr > -0.3) [-1, 1].forEach(function (sd) { var h1 = P(sd * 12, 128 + bob, 14), h2 = P(sd * 18, 140 + bob, 12); if (rot(sd * 15, 13, a).z > 0) add('path', { d: 'M' + h1.X + ' ' + h1.Y + ' L' + h2.X + ' ' + h2.Y, stroke: dk(L.topC, .66), 'stroke-width': 1.4 * k, 'stroke-linecap': 'round' }); });   /* slanted hip pockets */
    if (GMt.pk === 'chest' && front) { var cp1 = P(-12, 96 + bob, 15.5), cp2 = P(-4, 96 + bob, 16); add('rect', { x: Math.min(cp1.X, cp2.X), y: cp1.Y, width: Math.abs(cp2.X - cp1.X), height: 8 * k, fill: 'none', stroke: dk(L.topC, .7), 'stroke-width': 1 * k }); }   /* a chest pocket */
    if (GMt.placket && front) { var pl1 = P(0, 81 + bob, 14), pl2 = P(0, 96 + bob, 15.5); add('path', { d: 'M' + pl1.X + ' ' + pl1.Y + ' L' + pl2.X + ' ' + pl2.Y, stroke: dk(L.topC, .7), 'stroke-width': 1.2 * k }); [86, 92].forEach(function (yb) { var bt2 = P(0, yb + bob, 15); add('circle', { cx: bt2.X, cy: bt2.Y, r: .9 * k, fill: dk(L.topC, .6) }); }); }   /* the polo's buttons */
    if (GMt.shoulder) [-1, 1].forEach(function (sd) { var so = P(sd * 20, 86 + bob, 4), so2 = P(sd * 26, 96 + bob, 3); add('path', { d: 'M' + so.X + ' ' + so.Y + ' L' + so2.X + ' ' + so2.Y, stroke: '#f4f1ea', 'stroke-width': 3 * k, 'stroke-linecap': 'round' }); });   /* the kit's shoulder stripes */
    if (g.childNodes.length) parts.push([0.018, wrap]);
    /* the neckline, round the neck itself – it turns with him */
    if (GMt.neck === 'crew' && L.top !== 'none' && k >= .8) {   /* a thin line – only where it can be seen (scene-speed) */ var cn = around(9.5, 81.2, -1.5, 1.5, 1.6); if (cn) parts.push([0.021, el('path', { d: cn, fill: 'none', stroke: dc, 'stroke-width': 1.8 * k, 'stroke-linecap': 'round' })]); }
    if (GMt.polo && front) { var pc1 = P(-10, 80 + bob, 9), pc2 = P(-3, 88 + bob, 13.5), pc3 = P(0, 81.5 + bob, 13), pc4 = P(10, 80 + bob, 9), pc5 = P(3, 88 + bob, 13.5); parts.push([0.022, el('path', { d: 'M' + pc1.X + ' ' + pc1.Y + ' L' + pc2.X + ' ' + pc2.Y + ' L' + pc3.X + ' ' + pc3.Y + ' Z M' + pc4.X + ' ' + pc4.Y + ' L' + pc5.X + ' ' + pc5.Y + ' L' + pc3.X + ' ' + pc3.Y + ' Z', fill: dk(L.topC, .84), stroke: dk(L.topC, .7), 'stroke-width': .8 * k, 'stroke-linejoin': 'round' })]); }   /* the polo's collar points */
    if (GMt.shirtCol && front && k >= .8) { var sc1 = P(-7, 80.5 + bob, 11.5), sc2 = P(-1, 86.5 + bob, 13.5), sc3 = P(0, 82 + bob, 13), sc4 = P(7, 80.5 + bob, 11.5), sc5 = P(1, 86.5 + bob, 13.5); parts.push([0.022, el('path', { d: 'M' + sc1.X + ' ' + sc1.Y + ' L' + sc2.X + ' ' + sc2.Y + ' L' + sc3.X + ' ' + sc3.Y + ' Z M' + sc4.X + ' ' + sc4.Y + ' L' + sc5.X + ' ' + sc5.Y + ' L' + sc3.X + ' ' + sc3.Y + ' Z', fill: '#f4f1ea' })]); }   /* the shirt's collar over the sweater's neck */
    if (GMt.neck === 'v' && front) { var vv1 = P(GMt.vdeep ? -7.5 : -6, 80.5 + bob, 12), vv2 = P(0, (GMt.vdeep ? 101 : 90) + bob, GMt.vdeep ? 16 : 14.5), vv3 = P(GMt.vdeep ? 7.5 : 6, 80.5 + bob, 12); parts.push([0.021, el('path', { d: 'M' + vv1.X + ' ' + vv1.Y + ' L' + vv2.X + ' ' + vv2.Y + ' L' + vv3.X + ' ' + vv3.Y, fill: GMt.vfill || L.skin, stroke: dc, 'stroke-width': 1.4 * k, 'stroke-linejoin': 'round' })]); }
    /* the turtleneck's collar is drawn with the neck (it has to cover it): see below */
    if (GMt.neck === 'stand') { var sn = around(10, 79.4, -3.2, 3.2, 0); if (sn) parts.push([0.021, el('path', { d: sn, fill: 'none', stroke: dk(L.topC, .9), 'stroke-width': 4 * k, 'stroke-linecap': 'round' })]); }   /* a collar band standing round the neck */
    if (GMt.neck === 'hood') {   /* the hood lies round the neck and down the back: its rim shows over the shoulders from the front, the hood itself from behind */
      var hf = around(12, 80.5, -1.7, 1.7, 1.2), hbk = around(12.5, 79, 1.5, 4.8, -1.2); if (hbk) parts.push([-0.25, el('path', { d: hbk, fill: 'none', stroke: dk(L.topC, .85), 'stroke-width': 6.5 * k, 'stroke-linecap': 'round' })]);
      if (hf) parts.push([0.021, el('path', { d: hf, fill: 'none', stroke: dk(L.topC, .86), 'stroke-width': 4.5 * k, 'stroke-linecap': 'round' })]); }
    /* the hood: see GARM neck 'hood' above */
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
    function taper(p1, p2, r1, r2, col, z) {
      r1 *= k; r2 *= k; var dx = p2.X - p1.X, dy = p2.Y - p1.Y, d = Math.hypot(dx, dy) || .001, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
      var sn = Math.max(-.95, Math.min(.95, (r1 - r2) / d)), cs = Math.sqrt(1 - sn * sn);
      var ax = nx * cs + ux * sn, ay = ny * cs + uy * sn, bx = -nx * cs + ux * sn, by = -ny * cs + uy * sn;
      var r1s = r1.toFixed(1), r2s = r2.toFixed(1), s1 = (p1.X + ax * r1).toFixed(1) + ' ' + (p1.Y + ay * r1).toFixed(1);
      var dd = 'M' + s1 + ' L' + (p2.X + ax * r2).toFixed(1) + ' ' + (p2.Y + ay * r2).toFixed(1) + ' A' + r2s + ' ' + r2s + ' 0 0 0 ' + (p2.X + bx * r2).toFixed(1) + ' ' + (p2.Y + by * r2).toFixed(1) +
        ' L' + (p1.X + bx * r1).toFixed(1) + ' ' + (p1.Y + by * r1).toFixed(1) + ' A' + r1s + ' ' + r1s + ' 0 0 0 ' + s1 + ' Z';
      /* the next piece of the same limb (same colour, same depth, nothing drawn between) goes into the last piece's
         path: an arm is one shape, not four (fewer elements and attribute writes a frame – scene-speed) */
      if (LT && LT.col === col && LT.z === z && LT.n === parts.length) { if (LT.a) LT.a.d += ' ' + dd; else LT.e.setAttribute('d', LT.e.getAttribute('d') + ' ' + dd); return; }
      var te = el('path', { d: dd, fill: col }); parts.push([z, te]); LT = { e: te, a: POOL ? te._a : null, col: col, z: z, n: parts.length };
    }
    var LT = null;
    var CHAIR = L.aid === 'chair', SEAT = CHAIR ? 38 : 0, CRUTCH = L.aid === 'crutches';
    var bob = (CHAIR ? 0 : w * (Math.cos(2 * ph) * 1.6 - 1.2)) - (pose.lift || 0) - (pose.breath || 0) + SEAT; HY = 140 + bob;
    var hb6 = (bob - SEAT) * .6 + SEAT;
    /* legs: thigh swings forward/back (z), the knee bends on the way forward, the foot points where he faces */
    [-1, 1].forEach(function (sd) {
      var q = ph + (sd < 0 ? 0 : Math.PI), th = CHAIR ? Math.PI / 2 : w * 0.34 * Math.sin(q), kn = CHAIR ? Math.PI / 2 : w * 0.58 * Math.max(0, Math.cos(q - 0.35));   /* a calmer step (JP 2026-11-15: the legs swung too far apart, a back leg kicked out) – PHR in scene25.js follows it */
      if (CRUTCH) { th *= .7; kn *= .8; }   /* a shorter, careful step between the crutches */   /* the knee bends while the leg swings forward (lifted), straight while it pushes back on the ground */
      var lo = pose[nearSide(sd) ? 'legNear' : 'legFar'];
      if (lo && lo.at) { var tb = toBody(lo.at, sd * 10), sl = ik(tb.y - (140 + bob), tb.z, 38, 36, 1); lo = { m: lo.m == null ? 1 : lo.m, th: sl[0], kn: sl[0] - sl[1] }; }   /* the foot goes where it must stand (a rung) */
      if (lo) { th = th * (1 - lo.m) + lo.th * lo.m; kn = kn * (1 - lo.m) + lo.kn * lo.m; }   /* a keyed leg pose */
      var LW = L.bp.leg, hip = [sd * 10 * L.bp.hp, 140 + bob, 0], knee = [hip[0], hip[1] + 38 * Math.cos(th), hip[2] + 38 * Math.sin(th)];
      var ank = [hip[0], knee[1] + 36 * Math.cos(th - kn), knee[2] + 36 * Math.sin(th - kn)];
      var lift = Math.max(0, 218 - 4 - ank[1]); /* stays on the ground */
      if (ank[1] > 214) { var d = ank[1] - 214; knee[1] -= d; ank[1] = 214; hip[1] -= 0; }
      var a1 = P(hip[0], hip[1], hip[2]), a2 = P(knee[0], knee[1], knee[2]), a3 = P(ank[0], ank[1], ank[2]), toe = P(ank[0], ank[1] + 3, ank[2] + 18);   /* a foot about as long as the forearm */
      var far = rot(sd * 8, 0, a).z < 0, z = -0.02 + rot(sd * 8, 0, a).z * 0.0005;
      if (knee[2] > 14 && Math.abs(Math.cos(a)) > .5) z = 0.006 + rot(sd * 8, 0, a).z * 0.0005;   /* a deep squat or sitting, seen from the front: the thighs come toward you, in front of the body – they were hidden behind it */   /* the legs always go under the seat and the top (the near thigh used to poke over the waist when seen from the side); near leg still in front of the far one */
      /* a human leg: full at the hip, narrower at the knee, the calf swells a little below it, slim at the ankle */
      var lc = shade(far, C.legs2, C.legs), skc = shade(far, C.skin2, C.skin), calf = P(knee[0], knee[1] + (ank[1] - knee[1]) * .32, knee[2] + (ank[2] - knee[2]) * .32);
      var thighC = L.legsOn === 'none' || L.legsOn === 'swim' ? skc : lc, shinC = L.legsOn === 'full' ? lc : skc;
      var MUL = 1 + .07 * (L.bp.mus || 0);   /* athletic/muscular: fuller thighs and calves */
      taper(a1, a2, 10.5 * LW * MUL, 8.2 * LW, thighC, z); taper(a2, calf, 8.2 * LW, 8.4 * LW * MUL, shinC, z); taper(calf, a3, 8.4 * LW * MUL, 7.2 * LW, shinC, z);
      if (L.legsOn === 'thigh') {   /* shorts: a leg as wide as the thigh inside it, hanging straight to a flat hem (JP 2026-11-13: they looked drawn in) */
        var kb = P(knee[0], knee[1] - 4, knee[2]), sr1 = (Math.max(10.8, 10.5 * LW * MUL + 1.2) - 1.2) * k, sr2 = (Math.max(9.6, 10.5 * LW * MUL + .6) - 1.2) * k, sdx = kb.X - a1.X, sdy = kb.Y - a1.Y, sdl = Math.hypot(sdx, sdy) || 1, snx = -sdy / sdl, sny = sdx / sdl;
        var sq = [[a1.X + snx * sr1, a1.Y + sny * sr1], [kb.X + snx * sr2, kb.Y + sny * sr2], [kb.X - snx * sr2, kb.Y - sny * sr2], [a1.X - snx * sr1, a1.Y - sny * sr1]];
        parts.push([z + .001, el('path', { d: 'M' + sq.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' L') + ' Z', fill: lc, stroke: lc, 'stroke-width': (2.4 * k).toFixed(1), 'stroke-linejoin': 'round' })]);   /* the round join softens the hem's corners */
        parts.push([z + .0011, el('circle', { cx: a1.X.toFixed(1), cy: a1.Y.toFixed(1), r: (sr1 + 1.2 * k).toFixed(1), fill: lc })]); }
      if (L.legsOn === 'swim') { var sb = P(hip[0], hip[1] + 13, hip[2] + (knee[2] - hip[2]) * .3); taper(a1, sb, 11, 10.4, lc, z + .001); }
      if (L.bottom === 'jeans') limb(P(hip[0] + sd * 4, hip[1] + 6, hip[2] + 8), P(knee[0] + sd * 4, knee[1], knee[2] + 6), .9, 'rgba(242,201,76,.55)', z + .002);
      if (L.bottom === 'joggers') { var jc = P(knee[0], knee[1] + (ank[1] - knee[1]) * .78, knee[2] + (ank[2] - knee[2]) * .78); taper(jc, a3, 7.6 * LW, 7 * LW, cst(L.legsC), z + .002); }   /* gathered cuffs at the ankle */
      if (L.bottom === 'trousers' && L.legsOn === 'full' && k >= .8) limb(P(hip[0], hip[1] + 8, hip[2] + 9), P(ank[0], ank[1] - 3, ank[2] + 7), .8, cst(L.legsC), z + .002);   /* the crease down the front */
      if (L.bottom === 'jeans') [[.5, -1.5], [.56, 2]].forEach(function (rp) { var rk = P(knee[0] + rp[1] * .6, hip[1] + (knee[1] - hip[1]) * (rp[0] + .44), hip[2] + (knee[2] - hip[2]) * (rp[0] + .44) + 8.5); if (rot(sd * 8, 9, a).z > -2) parts.push([z + .003, el('ellipse', { cx: rk.X, cy: rk.Y, rx: 3.8 * k * Math.max(.4, Math.abs(Math.cos(a))), ry: 1.5 * k, fill: L.skin })]); });   /* the rips at the knee */
      if (L.bottom === 'cargo') { var cpk = P(knee[0] + sd * 6, hip[1] + (knee[1] - hip[1]) * .55, hip[2] + (knee[2] - hip[2]) * .55 + 5); if (rot(sd * 7, 5, a).z > -6) { parts.push([z + .003, el('rect', { x: cpk.X - 4.6 * k, y: cpk.Y - 5 * k, width: 9.2 * k, height: 10.5 * k, rx: 1.4 * k, fill: mix(L.legsC, cst(L.legsC), .55) })]); parts.push([z + .0031, el('rect', { x: cpk.X - 4.8 * k, y: cpk.Y - 5.6 * k, width: 9.6 * k, height: 3 * k, rx: 1 * k, fill: cst(L.legsC) })]); } }   /* a pocket with a flap on the side of the thigh */
      var mid2 = P(ank[0], ank[1] + 3, ank[2] + 5); parts.push([z + 0.49, el('ellipse', { cx: mid2.X, cy: mid2.Y, rx: (8.6 * Math.abs(Math.cos(a)) + 4.4) * k, ry: 5.6 * k, fill: L.shoes === 'sandals' ? skc : C.shoe })]);   /* the shoe's width, seen from the front */
      taper(P(ank[0], ank[1] + 2.5, ank[2] - 5), toe, 6.6, 6, L.shoes === 'sandals' ? skc : C.shoe, z + 0.5);
      if (L.shoes === 'sandals') limb(P(ank[0], ank[1] + 4, ank[2] + 3), P(ank[0], ank[1] + 4, ank[2] + 9), 3, '#8a5e44', z + .51);
      if (L.shoes === 'sneakers' || L.shoes === 'hightops' || L.shoes === 'cleats') limb(P(ank[0], ank[1] + 7, ank[2] - 3), P(ank[0], ank[1] + 7, ank[2] + 20), L.shoes === 'cleats' ? 1.3 : 2.4, L.shoes === 'cleats' ? '#aeb6bf' : '#e6e1d6', z + .52);   /* a thin sole – it read as a white stripe */
      if (L.shoes !== 'sandals') limb(P(ank[0], ank[1] + .5, ank[2] + 2), P(ank[0], ank[1] + 2.5, ank[2] + 15), 1.1, lt(C.shoe), z + .515);   /* the top of the shoe catches the light, so a dark shoe has a shape */
      if (L.shoes === 'cleats') [-2, 6, 14, 20].forEach(function (cz) { var st = P(ank[0], ank[1] + 8.4, ank[2] + cz); parts.push([z + .53, el('rect', { x: st.X - 1.4 * k, y: st.Y, width: 2.8 * k, height: 3.4 * k, rx: .6 * k, fill: '#cdd3d9' })]); });
      if (L.shoes === 'hightops' || L.shoes === 'boots') taper(P(ank[0], ank[1] - 8, ank[2]), P(ank[0], ank[1] + 1, ank[2]), 7.4, 7, C.shoe, z + .5);
    });
    /* the seat: a rounded pelvis in the trousers' colour where the legs meet the body, fuller at the back –
       from the side you see the bottom, from the front the hips */
    var pw = Math.sqrt(Math.pow(18 * L.bp.hp * Math.cos(a), 2) + Math.pow(12.5 * L.bp.d * Math.sin(a), 2)), pc = P(0, 144 + bob, -5);
    parts.push([-0.005, el('ellipse', { cx: pc.X, cy: pc.Y, rx: pw * k, ry: 11 * k, fill: L.legsOn === 'none' ? C.skin2 : C.legs })]);
    if (L.skirt) { var sk1 = P(0, 136 + bob, 0), sk2 = P(0, L.skirt === 'long' ? 196 : 176, 0), skw1 = BW * Math.sqrt(Math.pow(26 * Math.cos(a), 2) + Math.pow(17 * Math.sin(a), 2)) * k, skw2 = skw1 * 1.32, skc2 = L.top === 'dress' ? C.top : C.legs;
      parts.push([0.004, el('path', { d: 'M' + (sk1.X - skw1) + ' ' + sk1.Y + ' L' + (sk1.X + skw1) + ' ' + sk1.Y + ' L' + (sk2.X + skw2) + ' ' + sk2.Y + ' Q' + sk2.X + ' ' + (sk2.Y + 4 * k) + ' ' + (sk2.X - skw2) + ' ' + sk2.Y + ' Z', fill: skc2 })]); }
    /* torso: an oval tube – its width depends on which way he faces; the side towards the back is darker */
    var BP = L.bp, wid = function (f) { return Math.sqrt(Math.pow(30 * BW * f * Math.cos(a), 2) + Math.pow(17 * BP.d * Math.sin(a), 2)); };
    var hw = wid(BP.wa), hwT = wid(BP.sh) * .92, topY = 80 + bob, botY = 146 + bob;   /* hw: at the waist (details use it); hwT: across the shoulders */
    var t1 = P(0, topY, 0), t2 = P(0, botY, 0);
    /* a human trunk (phase 1 of the avatar brief): the neck's base, sloping to round shoulders, a chest, a waist that narrows
       and hips – each level has its width from the front, its depth from the side and how far forward it sits (the chest
       forward, the bottom back), so the outline changes properly as he turns */
    var MUT = BP.mus || 0, LV = [[81 - 1.6 * MUT, 8.5 + 2.4 * MUT, 8, 0], [91, 26 * BP.sh, 13.5 * BP.d, 0], [100, 15.5 * (BP.sh + BP.wa), 17 * BP.d, 2.6], [124, 25 * BP.wa, 12 * BP.d * (.5 + .5 * BP.wa), .8], [146, 26.5 * BP.hp, 12.5 * BP.d, -1.2]];
    if (!MUT) LV.splice(1, 0, [84.5, 19 * BP.sh, 10.5 * BP.d, 0], [87.2, 24 * BP.sh, 12.5 * BP.d, 0]);   /* the slope from the neck down to the shoulder (the trapezius), so the shoulder is a curve, not a ball (JP 2026-11-15) */
    if (MUT) { LV.splice(1, 0, [84 - .8 * MUT, 17 + 5 * MUT, 11 * BP.d, -1]); LV[LV.length - 1][1] = 25 * BP.wa * (1.04 + .02 * MUT); }   /* the hips no wider than the waist goes on: a V down into the shorts, no flare that reads as belly fat (JP 2026-11-13) */   /* athletic and muscular: the traps – a full slope from the neck out to the shoulders */
    var GM = GARM[L.top] || { e: 1 }, GE = GM.e || 1;   /* the garment over the body: every level but the neck a little wider and deeper, and a long one goes on down */
    if (GE !== 1) LV.forEach(function (q, qi) { if (qi) { q[1] *= GE; q[2] *= GE; } });
    if (GM.hem && GM.hem > 147) { var lq = LV[LV.length - 1]; LV.push([GM.hem + bob - bob, lq[1] * (1 + (GM.hem - 146) * .006), lq[2] * (1 + (GM.hem - 146) * .004), lq[3]]); botY = GM.hem + bob; t2 = P(0, botY, 0); }
    var TL = [], TR = [], ca = Math.cos(a), sa0 = Math.sin(a), LN2 = LV.length - 1;
    LV.forEach(function (q) { var c0 = P(0, q[0] + bob, q[3] * (ca >= 0 ? 1 : 1)), hwq = Math.sqrt(Math.pow(q[1] * BW * ca, 2) + Math.pow(q[2] * sa0, 2)) * k; TL.push([c0.X - hwq, c0.Y]); TR.push([c0.X + hwq, c0.Y]); });
    function f1(v) { return v.toFixed(1); }
    function side2(pts) { var d = ''; for (var i = 1; i < pts.length; i++) { var p0 = pts[i - 1], p1 = pts[i], my = (p0[1] + p1[1]) / 2; d += ' C' + f1(p0[0]) + ' ' + f1(my) + ' ' + f1(p1[0]) + ' ' + f1(my) + ' ' + f1(p1[0]) + ' ' + f1(p1[1]); } return d; }
    var TLr = TL.slice().reverse();
    var TD = 'M' + f1(TR[0][0]) + ' ' + f1(TR[0][1]) + side2(TR) + ' Q' + f1(t2.X) + ' ' + f1(t2.Y + 5 * k) + ' ' + f1(TL[LN2][0]) + ' ' + f1(TL[LN2][1]) + side2(TLr) + ' Q' + f1(t1.X) + ' ' + f1(TL[0][1] - 2 * k) + ' ' + f1(TR[0][0]) + ' ' + f1(TR[0][1]) + ' Z';
    parts.push([0, el('path', { d: TD, fill: L.top === 'none' ? C.skin : C.top })]);
    topDetails(parts, a, k, t1, t2, hw, bob, P, TD, topY, botY);
    if ((GARM[L.top] || {}).rib) { var rbu = TL.length - 2, ruL = [TL[LN2][0] + (TL[rbu][0] - TL[LN2][0]) * .22, TL[LN2][1] + (TL[rbu][1] - TL[LN2][1]) * .22], ruR = [TR[LN2][0] + (TR[rbu][0] - TR[LN2][0]) * .22, TR[LN2][1] + (TR[rbu][1] - TR[LN2][1]) * .22];   /* the knitted band at the hem: along the trunk's own lower edge, no clip (scene-speed) */
      parts.push([0.017, el('path', { d: 'M' + f1(ruL[0]) + ' ' + f1(ruL[1]) + ' Q' + f1(t2.X) + ' ' + f1(ruL[1] + 3 * k) + ' ' + f1(ruR[0]) + ' ' + f1(ruR[1]) + ' L' + f1(TR[LN2][0]) + ' ' + f1(TR[LN2][1]) + ' Q' + f1(t2.X) + ' ' + f1(t2.Y + 5 * k) + ' ' + f1(TL[LN2][0]) + ' ' + f1(TL[LN2][1]) + ' Z', fill: dk(L.topC, .84) })]); }
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
      [-1, 1].forEach(function (sd) { var o1 = P(sd * 19 * BP.wa, 130 + bob, 12), o2 = P(sd * 6, 146 + bob, 13.5); parts.push([0.012, el('path', { d: 'M' + o1.X.toFixed(1) + ' ' + o1.Y.toFixed(1) + ' Q' + ((o1.X + o2.X) / 2 - sd * 1.5 * k).toFixed(1) + ' ' + ((o1.Y + o2.Y) / 2).toFixed(1) + ' ' + o2.X.toFixed(1) + ' ' + o2.Y.toFixed(1), fill: 'none', stroke: mc, 'stroke-width': (.9 * k).toFixed(2), opacity: mo })]); });
    }
    if (shadeOn) parts.push([0.015, el('path', { d: TD, fill: 'url(#shBody)' })]);
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
      var aidRest = CHAIR ? { m: 1, b: [134 - 6 * Math.cos(ph * 1.2) * w, 4 + 14 * Math.sin(ph * 1.2) * w] } : CRUTCH ? { m: 1, b: [148, 10 + 9 * Math.sin(ph) * w] } : null;   /* where the hand rests in the wheelchair (the rim) or on crutches (the grip) */
      if (CHAIR && !ov) ov = aidRest;
      var cbusy = CRUTCH && !!ov && (ov.m == null || ov.m > .25);   /* the hand is doing something else: its crutch stays standing by his side */
      if (CRUTCH && !ov) ov = aidRest;
      var fb = sv + 0.28 + w * 0.25 * Math.max(0, Math.sin(q));   /* a soft bend at the elbow when the arm hangs (JP 2026-11-15: they hung stiff) */
      var place = function (q) { if (q.rest && aidRest) q = aidRest; return q.at ? unlean(toBody(q.at, sd * 32)) : { y: q.b[0] + bob, z: q.b[1] }; };
      if (ov && ov.path) { var A0 = place(ov.path[0]), B0 = place(ov.path[1]), fq = ov.f; ov = { m: 1, b: null, at: null, hb: { y: A0.y + (B0.y - A0.y) * fq - ov.up / k * Math.sin(Math.PI * fq), z: A0.z + (B0.z - A0.z) * fq } }; }
      var solve = function (o) { var hb = o.hb || place(o), sa = ik(hb.y - (88 + bob), hb.z, UA, FA, -1), rel = sa[1] - sa[0]; while (rel < -1.8) rel += 2 * Math.PI; while (rel > 2 * Math.PI - 1.8) rel -= 2 * Math.PI; return { m: o.m == null ? 1 : o.m, s: sa[0], f: sa[0] + rel }; };   /* the turn-over point sits in the middle of the angles an elbow can't make, so a near-straight arm never flips between frames */
      if (ov && ov !== aidRest && aidRest && ov.m != null && ov.m < 1) { var ar = solve(aidRest); sv = ar.s; fb = ar.f; }   /* a pose only partly on starts from the rim or the grip, not from a hanging arm – no jump as it fades in or out (2026-11-16) */
      if (ov && (ov.at || ov.b || ov.hb)) { ov = solve(ov); }   /* an elbow only bends forward: the forearm's angle is taken that way round, so a hand rising to the chin comes up in front, never swings back over the top (JP 2026-11-15) */   /* a pose without m (like a plain resting place) is fully on */   /* the hand goes where it must hold (a rail, the slot) */
      if (ov) { sv = sv * (1 - ov.m) + ov.s * ov.m; fb = fb * (1 - ov.m) + ov.f * ov.m; }   /* a keyed pose, blended in */
      var AW = L.bp.arm, SHW = BW * (L.bp.mus ? 1 + .55 * (L.bp.sh - 1) : L.bp.sh),   /* athletic/muscular: the width is in the shoulders' muscle, the arms still hang at the trunk's side (JP 2026-11-13: they stood out like balls) */ sh = [sd * 31 * SHW, 88 + bob, 0], elb = [sd * 33.5 * SHW, sh[1] + UA * Math.cos(sv), UA * Math.sin(sv)];
      var hand = [sd * 29.5 * SHW, elb[1] + FA * Math.cos(fb), elb[2] + FA * Math.sin(fb)];   /* the hand comes in toward the thigh, not out to the side (JP 2026-11-15: "gorilla arms") */
      var zz = rot(sd * 25, 0, a).z, far = zz < -2, z = far ? zz - 1 : zz + 1;
      var p1 = P(sh[0] - sd * (1.2 * (L.bp.mus || 0) + 4 + 9 * Math.max(0, SHW - 1)), sh[1] + 2.4 * (L.bp.mus || 0) + 8 - 4 * Math.max(0, SHW - 1), sh[2], 1)   /* the top of the arm tucks in under the shoulder's slope; the wide start (rS) is the deltoid: a long round curve from the slope down the outside of the arm */, p2 = P(elb[0], elb[1], elb[2], 1), p3 = P(hand[0], hand[1], hand[2], 1);
      var MU = L.bp.mus || 0, CAPX = -sd * 1.6 * MU * k;   /* the cap leans in onto the trunk */
      /* a human arm: a round shoulder, the upper arm fullest at the biceps, a forearm that swells below the elbow and narrows to the wrist.
         Athletic and muscular (MU) get a bigger shoulder cap, biceps and forearm */
      var skA = shade(far, C.skin2, C.skin), fm = P(elb[0] + (hand[0] - elb[0]) * .3, elb[1] + (hand[1] - elb[1]) * .3, elb[2] + (hand[2] - elb[2]) * .3, 1), bi2 = P(sh[0] + (elb[0] - sh[0]) * .42, sh[1] + (elb[1] - sh[1]) * .42, sh[2] + (elb[2] - sh[2]) * .42, 1);
      var rS = (7.4 + .4 * MU) * AW, rB = (6.3 + .7 * MU) * AW, rE = 5 * AW, rF = (5.3 + .5 * MU) * AW, rW = 3.9 * AW;
      function bareArm() { taper(p1, bi2, rS, rB, skA, z); taper(bi2, p2, rB, rE, skA, z); taper(p2, fm, rE, rF, skA, z); taper(fm, p3, rF, rW, skA, z);
        if (MU) parts.push([z + .001, el('ellipse', { cx: (p1.X + CAPX).toFixed(1), cy: (p1.Y + 1 * k).toFixed(1), rx: ((6.6 + .6 * MU) * AW * k).toFixed(1), ry: ((7.2 + .8 * MU) * AW * k).toFixed(1), fill: skA })]); }   /* the shoulder muscle */
      var PROS = function () { if (L.aid === 'arm' && sd > 0) taper(P(elb[0] + (hand[0] - elb[0]) * .35, elb[1] + (hand[1] - elb[1]) * .35, elb[2] + (hand[2] - elb[2]) * .35, 1), p3, 5, 4.4, shade(far, '#6f7781', '#8e97a1'), z + .02); };   /* the prosthetic forearm, whatever the sleeve */
      if (L.bare === 'arms' || L.top === 'none') { bareArm(); PROS(); }
      else if (L.bare === 'short') { var mid = P(sh[0] + (elb[0] - sh[0]) * .55, sh[1] + (elb[1] - sh[1]) * .55, sh[2] + (elb[2] - sh[2]) * .55, 1);
        taper(p1, bi2, rS, rB, skA, z); taper(bi2, p2, rB, rE, skA, z); taper(p2, fm, rE, rF, skA, z); taper(fm, p3, rF, rW, skA, z);
        PROS();
        taper(p1, mid, rS + 1.6 - .05 * MU, rB + 1, shade(far, C.top2, C.top), z + .01);
        if (MU) parts.push([z + .011, el('ellipse', { cx: (p1.X + CAPX).toFixed(1), cy: (p1.Y + 1 * k).toFixed(1), rx: ((7.4 + .4 * MU) * AW * k).toFixed(1), ry: ((8 + .6 * MU) * AW * k).toFixed(1), fill: shade(far, C.top2, C.top) })]); }   /* the short sleeve sits round the shoulder and the biceps */
      else { var slc = L.sleeve || C.top, slc2 = L.sleeve ? dk(L.sleeve, .82) : C.top2, GS = (GARM[L.top] || {}).se || 0, scol = shade(far, slc2, slc); taper(p1, bi2, rS + 2.2 + GS, rB + 2 + GS, scol, z); taper(bi2, p2, rB + 2 + GS, rE + 2.4 + GS, scol, z); taper(p2, fm, rE + 2.4 + GS, rF + 2 + GS, scol, z); taper(fm, p3, rF + 2 + GS, rW + 2.6 + GS * .8, scol, z);   /* a sleeve follows the arm inside it – fuller for a knit, a hoodie, a puffer (GARM se) */
        if (((GARM[L.top] || {}).rib || (GARM[L.top] || {}).cuff) && k >= .8) {   /* cuffs only on a big figure – small, their ends read as grey rings round the wrist */ var cf = P(elb[0] + (hand[0] - elb[0]) * .86, elb[1] + (hand[1] - elb[1]) * .86, elb[2] + (hand[2] - elb[2]) * .86, 1); taper(cf, P(elb[0] + (hand[0] - elb[0]) * .985, elb[1] + (hand[1] - elb[1]) * .985, elb[2] + (hand[2] - elb[2]) * .985, 1), rW + 2.5 + GS * .8, rW + 2.45 + GS * .8, shade(far, dk(slc2, .95), dk(slc, .93)), z + .002); }   /* the cuff at the wrist */
        if (L.aid === 'arm' && sd > 0) taper(P(elb[0] + (hand[0] - elb[0]) * .35, elb[1] + (hand[1] - elb[1]) * .35, elb[2] + (hand[2] - elb[2]) * .35, 1), p3, 5, 4.4, shade(far, '#7d8894', '#9aa3ad'), z + .02); }
      /* the hand: a mitten turned along the forearm, the thumb on the side toward the front, a cuff at the wrist */
      var fdx = p3.X - p2.X, fdy = p3.Y - p2.Y, fl = Math.hypot(fdx, fdy) || 1, ux = fdx / fl, uy = fdy / fl, ang = Math.atan2(uy, ux) * 180 / Math.PI - 90;
      var fwd = Math.abs(Math.sin(a)) > .3 ? (Math.sin(a) > 0 ? 1 : -1) : -sd * (Math.cos(a) >= 0 ? 1 : -1), pxv = -uy, pyv = ux; if (pxv * fwd < 0) { pxv = -pxv; pyv = -pyv; }
      var hc2 = shade(far, C.skin2, C.skin), HG = el('g', {});
      if (!L.bare && L.top !== 'none') HG.appendChild(el('line', { x1: (p3.X - ux * 3.4 * k).toFixed(1), y1: (p3.Y - uy * 3.4 * k).toFixed(1), x2: (p3.X - ux * .6 * k).toFixed(1), y2: (p3.Y - uy * .6 * k).toFixed(1), stroke: dk(L.sleeve || L.topC, far ? .7 : .8), 'stroke-width': (8.2 * k).toFixed(1), 'stroke-linecap': 'round' }));
      var tx = p3.X + ux * 2.4 * k + pxv * 5.8 * k, ty = p3.Y + uy * 2.4 * k + pyv * 5.8 * k;   /* the thumb a little further out, so the hand reads as a hand */
      var mx = p3.X + ux * 4 * k, my = p3.Y + uy * 4 * k;
      /* the thumb and the mitten as one shape (two turned ellipses as arcs): one element and one attribute a frame instead of two of each with a transform (scene-speed) */
      HG.appendChild(el('path', { d: oval(tx, ty, 3.1 * k, 4.6 * k, ang + (pxv * uy - pyv * ux > 0 ? -34 : 34)) + ' ' + oval(mx, my, 5.9 * k, 8.2 * k, ang), fill: hc2 }));
      parts.push([z + 0.1, HG]);
      HAND[nearSide(sd) ? 'near' : 'far'] = HAND['s' + sd] = { X: p3.X, Y: p3.Y, z: z + 0.2, busy: cbusy };
    });
    /* neck and head: a ball; eyes, nose, mouth, ears, glasses and beard sit on it and come round as he turns */
    /* the neck: its own part, from under the chin down into the shoulders (the head itself is drawn smaller, see HSC) */
    var nk1 = P(0, 66 + hb6, 0), nk2 = P(0, 85 + bob, 0), nkw = (5.2 + .8 * Math.abs(Math.sin(a))) * BW * (1 + .1 * (L.bp.mus || 0)) * k;
    parts.push([0.4, el('path', { d: 'M' + (nk1.X - nkw).toFixed(1) + ' ' + nk1.Y.toFixed(1) + ' L' + (nk1.X + nkw).toFixed(1) + ' ' + nk1.Y.toFixed(1) + ' L' + (nk2.X + nkw * 1.25).toFixed(1) + ' ' + nk2.Y.toFixed(1) + ' L' + (nk2.X - nkw * 1.25).toFixed(1) + ' ' + nk2.Y.toFixed(1) + ' Z', fill: C.skin2 })]);
    if ((GARM[L.top] || {}).neck === 'turtle') {   /* the turtleneck: a tall folded collar round the neck up under the jaw, its fold showing (2026-11-21) */
      var tc1 = P(0, 69.5 + hb6 * .4, 0), tc2 = P(0, 84 + bob, 0), tw1 = nkw * 1.32, tw2 = nkw * 1.5, tf = P(0, 76.5 + bob * .6, 0);
      parts.push([0.405, el('path', { d: 'M' + (tc1.X - tw1).toFixed(1) + ' ' + tc1.Y.toFixed(1) + ' Q' + tc1.X.toFixed(1) + ' ' + (tc1.Y + 2.4 * k).toFixed(1) + ' ' + (tc1.X + tw1).toFixed(1) + ' ' + tc1.Y.toFixed(1) + ' L' + (tc2.X + tw2).toFixed(1) + ' ' + tc2.Y.toFixed(1) + ' Q' + tc2.X.toFixed(1) + ' ' + (tc2.Y + 2 * k).toFixed(1) + ' ' + (tc2.X - tw2).toFixed(1) + ' ' + tc2.Y.toFixed(1) + ' Z', fill: dk(L.topC, .84) })]);
      if (k >= .8) parts.push([0.406, el('path', { d: 'M' + (tf.X - tw1 * 1.04).toFixed(1) + ' ' + tf.Y.toFixed(1) + ' Q' + tf.X.toFixed(1) + ' ' + (tf.Y + 2.4 * k).toFixed(1) + ' ' + (tf.X + tw1 * 1.04).toFixed(1) + ' ' + tf.Y.toFixed(1), fill: 'none', stroke: dk(L.topC, .7), 'stroke-width': 1 * k })]);
    }
    /* the head kept between frames (scene-speed, 2026-11-16): everything from here to the wrap below only moves with
       the head while the turn, the size, the lean, the face and the look are the same – walking or breathing just
       moves it. A frame like that re-uses the same pooled elements and only shifts their wrapper (translate). */
    var HKEY = null, HM = null, hpv0 = P(0, 74 + hb6, 0);
    if (POOL) {
      HM = (POOL.memo || (POOL.memo = {})).head;
      var lks = HM && HM.lref === look ? HM.lstr : JSON.stringify(look);
      HKEY = [a.toFixed(4), k >= .8 ? 1 : 0, (pose.lean || 0).toFixed(3), pose.mouth || '', pose.brow || '', pose.blink ? 1 : 0, CHAIR ? 1 : 0, L.hair === 'pony' ? ph.toFixed(3) + '|' + w : '', shadeOn ? 1 : 0, lks].join('|');
      var hr = HM ? k / HM.k : 1;   /* a little bigger or smaller (walking toward you, climbing): the same head, scaled round its own point – P() is even in k */
      if (HM && HM.key === HKEY && HM.i0 === POOL.i && Math.abs(hr - 1) < .2) {
        var htr = Math.abs(hr - 1) < 1e-4 ? 'translate(' + (hpv0.X - HM.x).toFixed(1) + ' ' + (hpv0.Y - HM.y).toFixed(1) + ') ' : 'translate(' + hpv0.X.toFixed(1) + ' ' + hpv0.Y.toFixed(1) + ') scale(' + hr.toFixed(4) + ') translate(' + (-HM.x).toFixed(1) + ' ' + (-HM.y).toFixed(1) + ') ';
        for (var hq = 0; hq < HM.parts.length; hq++) { var hp = HM.parts[hq]; hp[1]._a = { transform: htr + hp[2] }; parts.push([hp[0], hp[1]]); }
        POOL.i = HM.i0 + HM.n; HM.lref = look;
      } else HM = { key: HKEY, i0: POOL.i, lref: look, lstr: lks, miss: true };
    }
    if (!HM || HM.miss) {
    var hStart = parts.length;   /* everything of the head from here is drawn smaller round the chin: he is about 5.5 heads tall (JP chose between real proportions and the larger head) */
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
    head.appendChild(el('rect', { x: hc.X - 6.6 * k, y: hc.Y + 14 * k, width: 13.2 * k, height: 23 * k, rx: 5 * k, fill: C.skin2 }));   /* a neck you can see, down into the shoulders */
    var FS = { oval: [.96, 1.05, 1], round: [1.16, .97, 0], long: [.87, 1.17, 3.6] }[L.faceS] || [1, 1, 0];   /* face shape: oval a little taller than wide, round full and wide, long narrow with the chin lower (JP: the shapes looked the same) */
    var HW = R * FS[0], HHh = R * FS[1], HD = R * .98, HCX = hc.X, HCY = hc.Y + FS[2] * k, HCA = Math.cos(a), HSA = Math.sin(a), HSL = [];
    function hPt(yr, phi) {   /* a point on the 3D head's surface: yr down the face (0 middle, 1.05 chin), phi round it (0 the front of the face) */
      var r0 = HSL[0], r1 = HSL[HSL.length - 1];
      for (var q = 1; q < HSL.length; q++) if (HSL[q][0] >= yr) { r0 = HSL[q - 1]; r1 = HSL[q]; break; }
      var u = r1[0] > r0[0] ? Math.max(0, Math.min(1, (yr - r0[0]) / (r1[0] - r0[0]))) : 0, rx = r0[1] + (r1[1] - r0[1]) * u, rz = r0[2] + (r1[2] - r0[2]) * u, cz = r0[3] + (r1[3] - r0[3]) * u;
      var x = rx * HW * Math.sin(phi), z = (cz + rz * Math.cos(phi)) * HD; return { x: HCX + x * HCA + z * HSA, y: HCY + yr * HHh, f: Math.cos(phi + a) };
    }
    (function () {   /* the head in 3D (JP 2026-11-15: a jawline like his reference, and the side view must follow the face): slices from the top of the
       skull down to the chin, each a half-width (of W), a half-depth (of D) and how far forward it sits; the outline is each slice's edges seen from
       this side, so the front shows the jaw corners and the profile shows the jaw running from under the ear to the chin. Straight lines below the
       cheekbone keep it angular in the flat style. */
      var W = R * FS[0], Hh = R * FS[1], D = R * .98, cx = hc.X, cy = hc.Y + FS[2] * k, ca = Math.cos(a), sa = Math.sin(a);
      var SL = HSL;
      for (var q = 0; q <= 9; q++) { var t = -Math.PI / 2 + q * (Math.PI / 2 + .2) / 9, yy = Math.sin(t), cc = Math.cos(t); SL.push([yy, Math.max(.04, cc), Math.max(.04, cc * .99), -.04 * cc]); }   /* the round skull, down to the cheekbones */
      SL.push([.42, .95, .9, .05], [.62, .9, .76, .12], [.84, .55, .5, .26], [.99, .24, .3, .4], [1.05, .15, .16, .46]);   /* the jaw: corner under the ear, a straight line to the chin, a short flat chin */
      head.appendChild(el('path', Object.assign(headPath('skull', 'sk|' + L.faceS + '|' + a.toFixed(4) + '|' + k.toFixed(4), function () {   /* kept from frame to frame while the turn, the size and the face shape are the same (scene-speed) */
        var Rt = [], Lt = [];
        SL.forEach(function (sl) { var c = sl[3] * D * sa, e = Math.sqrt(Math.pow(sl[1] * W * ca, 2) + Math.pow(sl[2] * D * sa, 2)), y = cy + sl[0] * Hh; Rt.push([cx + c + e, y]); Lt.unshift([cx + c - e, y]); });
        return Rt.concat(Lt); }), { fill: C.skin, 'stroke-linejoin': 'round' })));
    })();
    function onHead(phi, y) { var c = Math.cos(phi + a), sq = Math.sqrt(Math.max(0, 1 - Math.pow((y - 52) / 22, 2)));   /* a point on the head's surface: the same width (face shape) and depth as the 3D head */
      return { x: hc.X + (R * FS[0] * Math.sin(phi) * Math.cos(a) + R * .98 * Math.cos(phi) * Math.sin(a)) * sq, y: hc.Y + FS[2] * k + (y - 52) * k * FS[1], f: c }; }
    function sstep(e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
    function poly(pts) { var s = 'M'; for (var i = 0; i < pts.length; i++) s += (i ? ' L' : '') + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1); return s + ' Z'; }
    /* beards (JP 2026-11-15: they looked like a mask, a blob, a wedge, an open mouth): drawn on the 3D head's surface in the hair colour – the lower
       edge follows the jaw and the chin, the upper edge runs from the sideburn under the cheekbone to the moustache; the mouth is drawn over it.
       Stubble is a light shading (the hair mixed into the skin), short is close, full a little fuller below the jaw */
    function band(ph0, ph1, yTop, yBot, grow) {   /* a patch between two lines round the face, only the part that faces you */
      var up = [], lo = [], N = 22;
      for (var bi = 0; bi <= N; bi++) { var ph = ph0 + (ph1 - ph0) * bi / N; if (Math.cos(ph + a) < -0.02) continue; var u = hPt(yTop(ph), ph), b = hPt(yBot(ph), ph);
        if (grow) { b.x = HCX + (b.x - HCX) * grow; b.y = HCY + (b.y - HCY) * (1 + (grow - 1) * .8); }
        up.push([u.x, u.y]); lo.unshift([b.x, b.y]); }
      return up.length > 1 ? poly(up.concat(lo)) : '';
    }
    var JAW = function (ph) { var q = Math.abs(ph); return q < .35 ? 1.05 : q < 1.2 ? 1.05 - (q - .35) / .85 * .45 : .6 - (q - 1.2) / .38 * .32; };   /* chin, along the jaw line, up to the ear */
    var BC = { stubble: mix(C.skin, C.hair, .26), short: C.hair, full: C.hair, goatee: C.hair, moustache: C.hair }[L.beard];
    if (L.beard === 'full' || L.beard === 'short' || L.beard === 'stubble') {   /* upper edge round the face; lower edge down the jaw from the ear, under the chin and back up – the head's own sides, so it meets the outline */
      var cheek = L.beard === 'full' ? .2 : .32, g2 = L.beard === 'full' ? 1.05 : 1.0;
      [-1, 1].forEach(function (sd) {   /* each half: the edge from the sideburn to the middle, down the middle of the chin, under the chin and back up the jaw – so the front of the chin is covered from the side too */
        var bp = [], push = function (yr, ph, gr) { if (Math.cos(ph + a) < -0.08) return; var q = hPt(yr, ph); if (gr && gr !== 1) { q.x = HCX + (q.x - HCX) * gr; q.y = HCY + (q.y - HCY) * (1 + (gr - 1) * .9); } bp.push([q.x, q.y]); };
        for (var bi = 0; bi <= 12; bi++) { var qa = 1.55 * (1 - bi / 12); push(qa > 1.3 ? .1 + (1.55 - qa) * .4 : qa > .55 ? cheek + (1.3 - qa) * .28 : .5 - .02 * Math.cos(qa * 3), sd * qa, 1); }
        [.62, .78, .92, 1.05].forEach(function (yr) { push(yr, 0, yr > .9 ? g2 : 1); });
        for (var bj = 1; bj <= 6; bj++) push(1.05, sd * 1.57 * bj / 6, g2);
        [.95, .84, .72, .6, .45, .3].forEach(function (yr) { push(yr, sd * 1.57, g2); });
        if (bp.length > 4) head.appendChild(el('path', { d: poly(bp), fill: BC, stroke: BC, 'stroke-width': (.5 * k).toFixed(2), 'stroke-linejoin': 'round' }));
      });
      if (L.beard !== 'stubble') { var mo2 = band(-.52, .52, function () { return .27; }, function (ph) { return .42 - .05 * Math.abs(ph); }); if (mo2) head.appendChild(el('path', { d: mo2, fill: BC })); }   /* the moustache joins it */
    }
    if (L.beard === 'goatee' || L.beard === 'moustache') {
      var mst = band(-.5, .5, function () { return .26; }, function (ph) { return .42 - .08 * Math.abs(ph); }); if (mst) head.appendChild(el('path', { d: mst, fill: BC }));   /* above the lip */
      if (L.beard === 'goatee') { var gch = band(-.38, .38, function () { return .58; }, function (ph) { return 1.05 - .1 * Math.abs(ph); }); if (gch) head.appendChild(el('path', { d: gch, fill: BC })); }   /* the chin, below the lip */
    }
    var eyes = [];
    [-0.62, 0.62].forEach(function (phi) { var e = onHead(phi * -1, 51); eyes.push(e); if (e.f > 0.05) { var ew = 4.6 * k * Math.max(.3, e.f);
      var wink = L.expr === 'wink' && phi > 0, open = !pose.blink && !wink && L.expr !== 'laugh';   /* open by default (JP 2026-11-15: eye colour never showed); laugh keeps the happy closed eyes */
      if (open && k < .8) { var ery = 2.4 * k, erx = Math.max(1 * k, 2.6 * k * e.f); head.appendChild(el('ellipse', { cx: e.x + Math.sin(a) * .5 * k * e.f, cy: e.y, rx: erx * .8, ry: ery, fill: mix(C.eye, '#1d2128', .45) })); }   /* small, in the page pictures: one dark eye in the eye colour (the white and the iris can't be seen at that size – scene-speed) */
      else if (open) { var ery = ({ wow: 3.4, cool: 1.7, calm: 1.9, smile: 2.45, shy: 2.3 }[L.expr] || 2.65) * k, erx = Math.max(1 * k, 3.6 * k * e.f), sx = Math.sin(a) * .9 * k * e.f, dy = L.expr === 'shy' ? .5 * k : 0;
        head.appendChild(el('ellipse', { cx: e.x, cy: e.y, rx: erx, ry: ery, fill: '#f4f1ea', stroke: '#2a2e36', 'stroke-width': .8 * k }));   /* the white with its outline (one shape – scene-speed) */
        head.appendChild(el('ellipse', { cx: e.x + sx, cy: e.y + dy, rx: Math.min(erx * .7, 2.3 * k * Math.max(.45, e.f)), ry: Math.min(ery * .95, 2.3 * k), fill: C.eye }));
        head.appendChild(el('circle', { cx: e.x + sx * 1.2, cy: e.y + dy, r: Math.min(ery * .5, .95 * k), fill: '#1d2128' }));
}
      else if (pose.blink || wink) head.appendChild(el('path', { d: 'M' + (e.x - ew) + ' ' + e.y + ' L' + (e.x + ew) + ' ' + e.y, stroke: C.eye, 'stroke-width': 1.8 * k, 'stroke-linecap': 'round' }));
      else head.appendChild(el('path', { d: 'M' + (e.x - ew) + ' ' + (e.y + 1 * k) + ' Q' + e.x + ' ' + (e.y - 3.4 * k) + ' ' + (e.x + ew) + ' ' + (e.y + 1 * k), fill: 'none', stroke: C.eye, 'stroke-width': 2 * k, 'stroke-linecap': 'round' }));   /* happy closed eyes, like your avatars */
      var br = onHead(phi * -1 * 1.05, 44), BM = BROWS[pose.brow || (L.expr === 'wow' ? 'up' : L.expr === 'shy' ? 'sad' : '')] || BROWS.none, inn = (hc.X - e.x) >= 0 ? 1 : -1, bo = BM[0] * k, bi = BM[1] * k;   /* the brow's mood (F6): both ends up (surprised), the inner end down (set on something), the inner end up (sorry, shy) */
      var bL = inn > 0 ? bo : bi, bR = inn > 0 ? bi : bo;   /* left and right end (no mood: both 0, the brow drawn exactly as before) */
      head.appendChild(el('path', { d: 'M' + (br.x - ew * 1.1) + ' ' + (bL ? br.y + .6 * k + bL : br.y + .6 * k) + ' Q' + br.x + ' ' + (bL || bR ? br.y - 1.6 * k + (bo + bi) / 2 : br.y - 1.6 * k) + ' ' + (br.x + ew * 1.1) + ' ' + (bR ? br.y + .6 * k + bR : br.y + .6 * k), fill: 'none', stroke: dk(L.hairC, .9), 'stroke-width': 1.8 * k, 'stroke-linecap': 'round', opacity: .85 }));
      if ((L.makeup === 'lashes' || L.makeup === 'both') && open) { var lsd = (e.x > hc.X ? 1 : -1); [.35, .65, .95].forEach(function (lx) { var lx0 = e.x + lsd * lx * erx, ly0 = e.y - ery * (1.05 - lx * .55); head.appendChild(el('line', { x1: lx0, y1: ly0, x2: lx0 + lsd * 1.6 * k, y2: ly0 - 1.8 * k, stroke: '#1d2128', 'stroke-width': 1.1 * k, 'stroke-linecap': 'round' })); }); }   /* lashes on the open eye's outer lid */
      if ((L.makeup === 'lashes' || L.makeup === 'both') && !open) [-.7, 0, .7].forEach(function (lx) { head.appendChild(el('line', { x1: e.x + lx * ew, y1: e.y - 1.6 * k, x2: e.x + lx * ew * 1.25, y2: e.y - 3.6 * k, stroke: C.eye, 'stroke-width': .9 * k, 'stroke-linecap': 'round' })); });
      if (e.f > .3 && (L.cheeks === 'blush' || L.expr === 'shy')) head.appendChild(el('ellipse', { cx: e.x + (phi < 0 ? -1 : 1) * 1.5 * k, cy: e.y + 7 * k, rx: 4.2 * k * e.f, ry: 2.4 * k, fill: '#e8707a', opacity: .85 }));
      if (L.cheeks === 'freckles' && e.f > .3) [[-2.2, 5.6], [-.6, 7.2], [1.2, 6], [2.6, 7.6], [.4, 8.8]].forEach(function (fq) { head.appendChild(el('circle', { cx: e.x + fq[0] * k * e.f, cy: e.y + fq[1] * k, r: .95 * k, fill: dk(L.skin, .6) })); }); } });
    var mo = onHead(0, L.beard === 'full' ? 61 : 62); if (mo.f > 0.1) { var mw = (L.expr === 'grin' || L.expr === 'laugh' ? 7.4 : L.expr === 'calm' || L.expr === 'shy' ? 4.6 : 6) * k * mo.f, mcol = L.makeup === 'lips' || L.makeup === 'both' ? '#c23a4a' : L.beard === 'full' ? '#f0d0c0' : C.mouth;
      var VS = pose.mouth && VIS[pose.mouth];   /* talking (F6): the mouth takes the shape of the sound – open (a), round (o), wide with teeth (e); "m" is the closed mouth of his mood */
      if (VS) { head.appendChild(el('ellipse', { cx: mo.x, cy: mo.y + 1 * k, rx: VS[0] * k * mo.f + .4, ry: VS[1] * k, fill: '#7a3a30', stroke: mcol, 'stroke-width': .8 * k }));
        if (VS[2]) head.appendChild(el('path', { d: 'M' + (mo.x - VS[0] * k * mo.f * .8) + ' ' + (mo.y + .3 * k) + ' Q' + mo.x + ' ' + (mo.y - .1 * k) + ' ' + (mo.x + VS[0] * k * mo.f * .8) + ' ' + (mo.y + .3 * k) + ' Q' + mo.x + ' ' + (mo.y + 1.3 * k) + ' ' + (mo.x - VS[0] * k * mo.f * .8) + ' ' + (mo.y + .3 * k) + ' Z', fill: '#f7f3ee' })); }
      else if (L.expr === 'wow') head.appendChild(el('ellipse', { cx: mo.x, cy: mo.y + 1 * k, rx: 2.6 * k * mo.f + .4, ry: 3.2 * k, fill: '#7a3a30' }));
      else if (L.expr === 'laugh' || L.expr === 'grin') head.appendChild(el('path', { d: 'M' + (mo.x - mw) + ' ' + mo.y + ' Q' + mo.x + ' ' + (mo.y + 7 * k) + ' ' + (mo.x + mw) + ' ' + mo.y + ' Z', fill: '#7a3a30', stroke: mcol, 'stroke-width': 1 * k }));
      else if (L.expr === 'cool') head.appendChild(el('path', { d: 'M' + (mo.x - mw) + ' ' + (mo.y + 1 * k) + ' Q' + (mo.x + mw * .3) + ' ' + (mo.y + 2 * k) + ' ' + (mo.x + mw) + ' ' + (mo.y - 1.2 * k), fill: 'none', stroke: mcol, 'stroke-width': 1.6 * k, 'stroke-linecap': 'round' }));
      else head.appendChild(el('path', { d: 'M' + (mo.x - mw) + ' ' + mo.y + ' Q' + mo.x + ' ' + (mo.y + 4 * k) + ' ' + (mo.x + mw) + ' ' + mo.y, fill: 'none', stroke: mcol, 'stroke-width': 1.6 * k, 'stroke-linecap': 'round' })); }
    var no = onHead(0, 56); if (no.f > -0.2) { var nx = Math.sin(a) * 5 * k; head.appendChild(el('ellipse', { cx: no.x + nx * .45, cy: no.y, rx: (2.1 + Math.abs(Math.sin(a)) * 2.2) * k, ry: 2.5 * k, fill: dk(L.skin, .95) })); if (no.f > .2) head.appendChild(el('path', { d: 'M' + (no.x - 1.6 * k) + ' ' + (no.y + 1.8 * k) + ' Q' + no.x + ' ' + (no.y + 2.8 * k) + ' ' + (no.x + 1.6 * k) + ' ' + (no.y + 1.8 * k), fill: 'none', stroke: dk(L.skin, .78), 'stroke-width': .9 * k, 'stroke-linecap': 'round', opacity: .6 })); }
    var ears = [];
    [-Math.PI / 2, Math.PI / 2].forEach(function (phi) { var e = onHead(phi * -1, 53); ears.push(e); if (e.f > -0.35) { head.appendChild(el('ellipse', { cx: e.x, cy: e.y, rx: 3.5 * k * Math.max(.4, Math.abs(Math.sin(phi * -1 + a))), ry: 5.5 * k, fill: C.skin2 }));
      if (L.aid === 'hearing') { head.appendChild(el('path', { d: 'M' + e.x + ' ' + (e.y - 6 * k) + ' q' + (3.6 * k) + ' ' + (2.4 * k) + ' ' + (1.2 * k) + ' ' + (9 * k), fill: 'none', stroke: '#8e97a1', 'stroke-width': 3.2 * k, 'stroke-linecap': 'round' })); head.appendChild(el('circle', { cx: e.x + .6 * k, cy: e.y + 1 * k, r: 1.4 * k, fill: '#555c66' })); }   /* the hearing aid behind the ear, its tip in the ear – you can see it */ } });
    /* hair */
    var H = { short: [37, 30, 1.07, 1.16], quiff: [37, 30, 1.07, 1.16], fade: [39, 28, 1.03, 1.08], side: [36, 31, 1.05, 1.09], undercut: [36, 14, 1.06, 1.14], waves: [36, 31, 1.08, 1.11], bangs: [42, 26, 1.07, 1.12], curly: [35, 28, 1.16, 1.2], afro: [34, 26, 1.1, 1.16],
      long: [37, 32, 1.06, 1.09], braids: [38, 31, 1.04, 1.07], dreads: [37, 32, 1.1, 1.12], pony: [38, 30, 1.02, 1.04], pigtails: [38, 30, 1.03, 1.05], bun: [38, 30, 1.02, 1.04], mohawk: [44, 22, 1.0, 1.0] }[L.hair];
    var hatCovers = L.hat === 'beanie' || L.hat === 'chef' || L.hat === 'bandana' || L.hat === 'santa' || L.hat === 'wizard' || L.hat === 'witch' || L.hat === 'cowboy';
    if (H && L.hair === 'mohawk' && !hatCovers) { var mh = []; for (var mi = 0; mi <= 12; mi++) { var mt = Math.PI * (.2 + .6 * mi / 12), mfz = Math.cos(mt) * 26, mfy = 52 - Math.sin(mt) * 24 - 6, mp = P(0, mfy + hb6, -mfz); mh.push([mp.X, mp.Y]); }
      for (var mj = 12; mj >= 0; mj--) { var mt2 = Math.PI * (.2 + .6 * mj / 12), mp2 = P(0, 52 - Math.sin(mt2) * 21 + hb6, -Math.cos(mt2) * 22); mh.push([mp2.X, mp2.Y]); }
      head.appendChild(el('path', { d: poly(capPts([37, 30, 1.01, 1.02], 45)), fill: mix(C.hair, C.skin, .66) }));   /* shaved sides */
      parts.push([0.52, el('path', { d: poly(mh), fill: C.hair, stroke: C.hair, 'stroke-width': (9.5 * k).toFixed(1), 'stroke-linejoin': 'round' })]); H = null; }
    /* the hair (JP 2026-11-15: styles looked the same and it came down the cheek like a helmet): a cap on the 3D head whose hairline sits at the
       forehead in front, at the top of the ear at the side and at the nape behind (long styles cover the ear); every style has its own outline –
       fade and undercut have short sides (a lighter band of the hair over the skin) under a fuller top, the side part has its volume on one side,
       the quiff rises at the front, waves and curls bump along the top */
    var SIDE_Y = { long: 60, braids: 58, dreads: 60, pigtails: 52, pony: 47, bun: 47, bangs: 47, afro: 50, curly: 47 }[L.hair] || 45;
    /* rounded corners: the cap's outline cut twice at each corner (Chaikin), so where the hairline meets the crown in profile it
       curves instead of making a sharp point (JP 2026-11-16: the profile's top and back edge looked angular) */
    function soft(pts, n) { for (var it = 0; it < (n || 2); it++) { var o = [], L2 = pts.length; for (var i = 0; i < L2; i++) { var p0 = pts[i], p1 = pts[(i + 1) % L2]; o.push([p0[0] * .75 + p1[0] * .25, p0[1] * .75 + p1[1] * .25], [p0[0] * .25 + p1[0] * .75, p0[1] * .25 + p1[1] * .75]); } pts = o; } return pts; }
    function capPts(Hx, yS, top) {
      var pts = [], N = 32, RR = Math.sqrt(Math.pow(R * FS[0] * Math.cos(a), 2) + Math.pow(R * .98 * Math.sin(a), 2)) * Hx[2], HY0 = hc.Y + FS[2] * k, VS = FS[1];
      var qc = Math.acos(Math.max(-1, Math.min(1, Math.sin(a) * .8)));   /* where the front of the head is along the top arc, from this side */
      for (var i = 0; i <= N; i++) {
        var X = -1 + 2 * i / N, phi = Math.asin(X), facing = Math.cos(phi - a), side = Math.sin(phi - a);
        var LONGH = yS > 50, y = Hx[0] + (yS - Hx[0]) * (LONGH ? sstep(.55, .12, facing) : sstep(.9, .5, facing)) + (Hx[0] + Hx[1] - yS) * sstep(-.3, -.78, facing) + 2 * X * X + (L.hair === 'side' || L.hair === 'waves' ? 4 * Math.max(0, side) * Math.max(0, facing) : 0);
        if (top) y = Math.min(y, top);
        var sq = Math.sqrt(Math.max(0, 1 - X * X));
        y = Math.max(52 - 22 * sq + 1, Math.min(y, 52 + 22 * sq - 1.5));
        pts.push([hc.X + X * RR, HY0 + (y - 52) * k * VS]);
      }
      for (var j = 1; j < N; j++) { var t = Math.PI * j / N, bump = L.hair === 'waves' ? 1 + .09 * Math.abs(Math.sin(t * 6)) : L.hair === 'afro' ? 1.03 + .03 * Math.cos(t * 14) : L.hair === 'curly' ? 1 + .05 * Math.abs(Math.sin(t * 9)) : L.hair === 'dreads' ? 1 + .04 * Math.abs(Math.sin(t * 14)) : 1;
        if (L.hair === 'side') bump *= 1 + .13 * Math.max(0, Math.cos(t - .55));   /* the volume swept to one side of the parting */
        if (L.hair === 'quiff' || (L.hair === 'undercut' && top)) bump *= 1 + (L.hair === 'quiff' ? .15 : .1) * Math.exp(-Math.pow((t - qc) / .55, 2));   /* rises at the front */
        pts.push([hc.X + Math.cos(t) * RR * bump, HY0 - Math.sin(t) * R * VS * Hx[3] * bump]); }
      return pts;
    }
    if (H && !hatCovers) {
      var hkey = L.hair + '|' + L.faceS + '|' + a.toFixed(4) + '|' + k.toFixed(4) + '|' + H.join(',');
      var HY0c = hc.Y + FS[2] * k;
      /* the afro (JP 2026-11-16: make it rounder): a round cloud of hair round the whole head, behind the face, its edge a soft
         scallop; the cap on top only frames the forehead */
      if (L.hair === 'afro') { var af = headPath('afro', hkey, function () { var ap = [], AN = 48, ax = R * 1.42 * FS[0], ay = R * 1.36, acy = HY0c - 6 * k; for (var ai = 0; ai < AN; ai++) { var at = Math.PI * 2 * ai / AN, wob = 1 + .028 * Math.cos(at * 12); ap.push([hc.X + Math.cos(at) * ax * wob, acy + Math.sin(at) * ay * wob]); } return ap; });
        parts.push([behind(0, 52, -10) > 4 ? 0.56 : 0.49, el('path', Object.assign(af, { fill: C.hair }))]); }   /* seen from behind it covers the head */
      var SHORT = L.hair === 'fade' || L.hair === 'undercut';
      head.appendChild(el('path', Object.assign(headPath('hair', hkey, function () { return soft(capPts(SHORT ? [H[0], H[1] + 6, 1.02, 1.03] : H, SHORT ? 47 : SIDE_Y)); }), { fill: SHORT ? mix(C.hair, C.skin, L.hair === 'undercut' ? .62 : .42) : C.hair })));
      if (SHORT) head.appendChild(el('path', Object.assign(headPath('hairTop', hkey, function () { return soft(capPts(H, 38, L.hair === 'undercut' ? 37 : 39)); }), { fill: C.hair })));   /* the top over the short sides */
      /* a swept fringe: the hair falls a little over the forehead on one side, wrapping round as he turns */
      /* the quiff is the cap's own rise at the front (capPts) */
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
        var ear = ears[n]; if (Math.abs(ear.x - e.x) > 4 * k && ear.f > -.3) head.appendChild(el('line', { x1: e.x + (ear.x > e.x ? rw : -rw), y1: e.y - 1 * k, x2: ear.x, y2: ear.y - 2 * k, stroke: gc, 'stroke-width': 1.4 * k })); });
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
    /* a bucket hat and a beret (2026-11-21, JP: more looks): the bucket's soft brim slopes down all round; the beret sits
       flat on the crown, pulled a little to the side he faces away from, with its small stalk */
    if (L.hat === 'bucket') { var bky = hc.Y - R * .42;   /* a wide soft brim sloping down, a tall rounded crown with a band */
      head.appendChild(el('path', { d: 'M' + (hc.X - R * 1.62) + ' ' + (bky + 7 * k) + ' Q' + (hc.X - R * 1.2) + ' ' + (bky - 4 * k) + ' ' + hc.X + ' ' + (bky - 4 * k) + ' Q' + (hc.X + R * 1.2) + ' ' + (bky - 4 * k) + ' ' + (hc.X + R * 1.62) + ' ' + (bky + 7 * k) + ' Q' + hc.X + ' ' + (bky + 6 * k) + ' ' + (hc.X - R * 1.62) + ' ' + (bky + 7 * k) + ' Z', fill: dk(L.hatC, .82) }));
      head.appendChild(el('path', { d: 'M' + (hc.X - R * 1.0) + ' ' + (bky - 1 * k) + ' L' + (hc.X - R * .86) + ' ' + (bky - 21 * k) + ' Q' + hc.X + ' ' + (bky - 27 * k) + ' ' + (hc.X + R * .86) + ' ' + (bky - 21 * k) + ' L' + (hc.X + R * 1.0) + ' ' + (bky - 1 * k) + ' Q' + hc.X + ' ' + (bky + 2 * k) + ' ' + (hc.X - R * 1.0) + ' ' + (bky - 1 * k) + ' Z', fill: L.hatC }));
      head.appendChild(el('path', { d: 'M' + (hc.X - R * .97) + ' ' + (bky - 5 * k) + ' Q' + hc.X + ' ' + (bky - 2 * k) + ' ' + (hc.X + R * .97) + ' ' + (bky - 5 * k), fill: 'none', stroke: dk(L.hatC, .62), 'stroke-width': 3 * k })); }
    if (L.hat === 'beret') { var bry = hc.Y - R * .95, bsh = -Math.sin(a) * R * .3 + R * .18;   /* a wide flat disc pulled over to one side, its stalk on top */
      head.appendChild(el('path', { d: 'M' + (hc.X - R * 1.05) + ' ' + (bry + 6 * k) + ' Q' + (hc.X - R * 1.25 + bsh) + ' ' + (bry - 9 * k) + ' ' + (hc.X + bsh) + ' ' + (bry - 10 * k) + ' Q' + (hc.X + R * 1.45 + bsh) + ' ' + (bry - 8 * k) + ' ' + (hc.X + R * 1.32 + bsh) + ' ' + (bry + 4 * k) + ' Q' + hc.X + ' ' + (bry + 10 * k) + ' ' + (hc.X - R * 1.05) + ' ' + (bry + 6 * k) + ' Z', fill: L.hatC }));
      head.appendChild(el('path', { d: 'M' + (hc.X - R * 1.0) + ' ' + (bry + 5.5 * k) + ' Q' + hc.X + ' ' + (bry + 9.5 * k) + ' ' + (hc.X + R * 1.28 + bsh) + ' ' + (bry + 3.5 * k), fill: 'none', stroke: dk(L.hatC, .7), 'stroke-width': 1.8 * k }));
      head.appendChild(el('rect', { x: hc.X + bsh - 1.3 * k, y: bry - 14 * k, width: 2.6 * k, height: 5 * k, rx: 1.3 * k, fill: dk(L.hatC, .78) })); }
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
    if ((L.hair === 'long' || L.hair === 'dreads') && !hatCoversLong()) { box(-26, 26, 42, 100, -16, 2, C.hair, behind(0, 52, -10) > 0 ? 0.55 : -0.5, 10);   /* falls past the shoulders, wider than the face so it frames it */
      if (L.hair === 'dreads') [-22, -16, 16, 22].forEach(function (dx) { var d1 = P(dx, 50 + hb6, -2), d2 = P(dx, 100 + hb6, -2); parts.push([behind(dx, 52, -10) > 0 ? 0.551 : -0.49, el('line', { x1: d1.X, y1: d1.Y, x2: d2.X, y2: d2.Y, stroke: dk(C.hair, .7), 'stroke-width': 1.4 * k, 'stroke-dasharray': (3 * k) + ' ' + (1.4 * k) })]); }); }   /* locks */
    if (L.hair === 'braids' && !hatCoversLong()) [-20, 20].forEach(function (bx2) { var b1 = P(bx2, 52 + hb6, -6), b2 = P(bx2 * 1.12, 100 + hb6, 0); parts.push([behind(bx2, 52, -6) > 0 ? 0.55 : -0.5, el('line', { x1: b1.X, y1: b1.Y, x2: b2.X, y2: b2.Y, stroke: C.hair, 'stroke-width': 7.5 * k, 'stroke-linecap': 'round', 'stroke-dasharray': (4.6 * k) + ' ' + (1.6 * k) })]); });   /* two plaits behind the ears, down over the shoulders, the twists showing */
    if (L.hair === 'pigtails' && !hatCoversLong()) [-1, 1].forEach(function (sd2) { var p1 = P(sd2 * 21, 46 + hb6, -6), p2 = P(sd2 * 26, 74 + hb6, -8); parts.push([behind(sd2 * 21, 46, -6) > 0 ? 0.56 : -0.4, el('line', { x1: p1.X, y1: p1.Y, x2: p2.X, y2: p2.Y, stroke: C.hair, 'stroke-width': 8 * k, 'stroke-linecap': 'round' })]); });
    if (L.hair === 'pony' && !hatCoversLong()) { var sw2 = w * 3 * Math.sin(ph * 2), b1 = P(0, 42 + hb6, -21), b2 = P(sw2, 80 + hb6, -27); parts.push([behind(0, 42, -21) > 0 ? 0.56 : -0.4, el('line', { x1: b1.X, y1: b1.Y, x2: b2.X, y2: b2.Y, stroke: C.hair, 'stroke-width': 10 * k, 'stroke-linecap': 'round' })]); }
    if (L.hair === 'bun' && !hatCovers) { var bb = P(0, 32 + hb6, -12); parts.push([behind(0, 32, -12) > 0 ? 0.56 : 0.45, el('circle', { cx: bb.X, cy: bb.Y, r: 9 * k, fill: C.hair })]); }
    if (L.top === 'hoodie') box(-17, 17, 70, 94, -15, -5, C.top2, behind(0, 80, -10) > 0 ? 0.3 : -0.3, 8);
    if (L.hat === 'cap') { var bz = rot(0, 22, a).z, br = [[-13, 14], [13, 14], [-13, 33], [13, 33]].map(function (q) { return rot(q[0], q[1], a).x; }), b0 = Math.min.apply(null, br), b9 = Math.max.apply(null, br), byy = P(0, 41 + hb6, 0).Y;
      parts.push([bz > 0 ? 0.57 : 0.45, el('ellipse', { cx: hc.X + (b0 + b9) / 2 * k, cy: byy, rx: Math.max(3, (b9 - b0) / 2) * k, ry: 3.2 * k, fill: dk(L.hatC, .85) })]); }
    var HSC = .73, pv = P(0, 74 + hb6, 0), HT = 'translate(' + pv.X.toFixed(1) + ' ' + pv.Y.toFixed(1) + ') scale(' + HSC + ') translate(' + (-pv.X).toFixed(1) + ' ' + (-pv.Y).toFixed(1) + ')';
    for (var hi = hStart; hi < parts.length; hi++) { var hwr = el('g', { transform: HT }); hwr.appendChild(parts[hi][1]); parts[hi][1] = hwr; }
    if (HM && HM.miss) { HM.miss = false; HM.n = POOL.i - HM.i0; HM.x = hpv0.X; HM.y = hpv0.Y; HM.k = k; HM.parts = parts.slice(hStart).map(function (q) { return [q[0], q[1], q[1]._a.transform]; }); POOL.memo.head = HM; }
    }
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
      [-1, 1].forEach(function (sd) { var hd = HAND['s' + sd]; if (!hd) return; if (hd.busy) { var hr = P(sd * 30 * BW * L.bp.sh, 148 + bob, 8); hd = { X: hr.X, Y: hr.Y, z: hd.z }; }   /* a busy hand lets go: the crutch stays where it stood (it used to stretch up to the hand) */
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
    if (kind === 'book') { add('rect', { x: f(x - 15 * k), y: f(y - 12 * k), width: f(30 * k), height: f(21 * k), rx: f(1.8 * k), fill: '#d6453f' }); add('rect', { x: f(x - 14 * k), y: f(y - 12 * k), width: f(28 * k), height: f(3 * k), fill: '#f4f1ea' });   /* a red cover with the pages showing – a blue one vanished against a blue top (JP 2026-11-15: empty hands on Home) */ add('line', { x1: f(x), y1: f(y - 12 * k), x2: f(x), y2: f(y + 9 * k), stroke: '#883635', 'stroke-width': f(1.2 * k) }); }
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
  var VIS = { a: [2.6, 2.7, 0], o: [1.7, 2.1, 0], e: [3.3, 1.6, 1] }, VSEQ = ['a', 'm', 'e', 'o', 'a', 'e', 'm', 'o'], BROWS = { none: [0, 0], up: [-1.5, -1.8], down: [-.4, 1.5], sad: [.9, -1.4] };
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
