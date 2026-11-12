/* The 2.5D living scenes (Phase F2): the engine every page scene uses. A page scene (scene-<page>.js) registers
   SceneLive[page] = function (svg, data) { return Scene25.run(svg, { … }) } – scenes.js calls it with the page's own
   numbers after drawing the still picture, and the 2.5D scene takes the picture over (viewBox 0 0 400 240).

   What it does for every scene:
   - one clock per scene: plays when the picture comes into view, again now and then (22–37 s), and when you tap it;
     only while it is on screen and the tab is visible; stops for good when the picture leaves the page (page changes);
   - still pictures (reduced motion, "Still pictures", animations off, safe mode): the last frame, drawn once;
   - you: your own look (Avatar.dressed), drawn by Fig25 every frame – breathing, blinking, the walk phase (LIFE);
   - the frame time is measured (Scene25.ms) so the tests can hold it under 4 ms.
   The helpers (E, SEG, MIX, swing, FIG, CHEER …) are the ones from the previews JP picked. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  /* while a frame is drawn (SP set), elements come from the scene's pool in the order they're asked for: the same call
     next frame gets the same element back. The frame is built off the page with its attributes kept in _a only, then
     patch() writes just the differences into the live picture – see paint */
  var SP = null;
  function el(n, a) {
    if (SP) {
      var e = SP.l[SP.i], sig = n; for (var k0 in a) sig += ' ' + k0;
      if (e && e._sig === sig) { e._a = a; if (e.firstChild) e.textContent = ''; SP.i++; return e; }
      e = document.createElementNS(NS, n); e.__sc = 1; e._a = a; e._sig = sig; SP.l[SP.i++] = e; return e;   /* the attributes live in _a only: this copy is never shown, patch() writes them into the picture */
    }
    var x = document.createElementNS(NS, n); x.__sc = 1; for (var k in a) x.setAttribute(k, a[k]); return x;   /* __sc: page observers skip changes in scenes (diag.js) */
  }
  /* the live picture L made equal to the frame V just built off the page: attributes only where they changed (L._v
     remembers what L has), children matched in order (same tag and attribute names), new ones inserted, leftovers removed.
     A node marked __static (cached art made with innerHTML) is copied once and then only its own attributes follow. */
  function patch(L, V) {
    var a = V._a, c = L._v || (L._v = {}), k, v;
    if (a) { for (k in a) { v = a[k]; if (c[k] !== v) { L.setAttribute(k, v); c[k] = v; } } }
    else { var at = V.attributes; for (var i = 0; i < at.length; i++) { k = at[i].name; v = at[i].value; if (c[k] !== v) { L.setAttribute(k, v); c[k] = v; } } }
    if (V.__static) { if (L.__src !== V) { L.innerHTML = V.innerHTML; L.__src = V; } return; }
    var vc = V.firstChild;
    if (vc && vc.nodeType === 3 && !vc.nextSibling) { if (L._t !== vc.data) { L.textContent = vc.data; L._t = vc.data; } return; }
    if (L._t != null) { L.textContent = ''; L._t = null; }
    var lc = L.firstChild;
    for (; vc; vc = vc.nextSibling) {
      if (vc.nodeType !== 1) continue;
      if (!lc || lc.nodeName !== vc.nodeName || lc._sig !== vc._sig) { var n = document.createElementNS(NS, vc.nodeName); n.__sc = 1; n._sig = vc._sig; L.insertBefore(n, lc || null); patch(n, vc); }
      else { patch(lc, vc); lc = lc.nextSibling; }
    }
    while (lc) { var nx = lc.nextSibling; L.removeChild(lc); lc = nx; }
  }
  function add(par, n, a) { var x = el(n, a); par.appendChild(x); return x; }
  function txt(par, a, s) { var x = add(par, 'text', a); x.textContent = s; return x; }
  function E(f) { f = Math.max(0, Math.min(1, f)); return f * f * (3 - 2 * f); }
  function CL(f) { return Math.max(0, Math.min(1, f)); }
  function SEG(t, a, b) { return CL((t - a) / (b - a)); }
  function LERP(a, b, f) { return a + (b - a) * f; }
  function MIX(A, B, f) { return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]; }
  /* a hand or foot moving from A to B: it lifts off (out sideways, up) and lands */
  function swing(A, B, f, out, up) { var q = E(f), m = MIX(A, B, q), s = Math.sin(Math.PI * CL(f)); return [m[0] + (out || 0) * s, m[1] - (up || 0) * s]; }
  function CHEER(t, t0, len) { var hp = (t - t0) / len; return { lift: hp < .2 ? -3 * Math.sin(hp / .2 * Math.PI) : hp < .65 ? 10 * Math.sin((hp - .2) / .45 * Math.PI) : 0, on: E(CL(hp / .3)) * (1 - E(CL((hp - .7) / .3))) }; }   /* on: how far the arms are up, 0..1 – they rise and come down, never snap */
  function STAR(par, x, y, r, fill, op) { var d = ''; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; d += (i ? 'L' : 'M') + (x + Math.cos(a) * rr).toFixed(1) + ' ' + (y + Math.sin(a) * rr).toFixed(1); }
    return add(par, 'path', { d: d + 'Z', fill: fill || '#f2c94c', opacity: op == null ? 1 : op }); }
  /* hands and feet: a point on the screen (AT), a place by the body (B: height, forward), a move between two (GO, lifted
     a little on the way), held still (HOLD); REST is the hand hanging by the side. SIDE/LEG: which pose key is the
     hand/leg on side sd (1 = his right) when he faces deg – near or far changes as he turns. */
  var REST = { b: [143, 8] };
  function AT(p) { return { at: p }; }
  function B(y, z) { return { b: [y, z] }; }
  function GO(A, B2, f, up) { return { m: 1, path: [A, B2], f: E(f), up: up || 0 }; }
  function HOLD(p) { return { m: 1, at: p.at, b: p.b }; }
  function SIDE(sd, deg) { var zz = -sd * Math.sin(deg * Math.PI / 180); return zz > 1e-6 || (Math.abs(zz) <= 1e-6 && sd < 0) ? 'near' : 'far'; }
  function LEG(sd, deg) { return SIDE(sd, deg) === 'near' ? 'legNear' : 'legFar'; }
  function grp(x, y, deg, sc) { return el('g', { transform: 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')' + (deg ? ' rotate(' + deg.toFixed(1) + ')' : '') + (sc ? ' scale(' + sc.toFixed(3) + ')' : '') }); }
  /* the wall clock: the real time */
  /* part: 'face' (drawn once into the still layer), 'hands' (each frame), or both */
  function CLOCK(par, x, y, r, part) {
    var d = new Date(), hh = (d.getHours() % 12 + d.getMinutes() / 60) * 30, mm = (d.getMinutes() + d.getSeconds() / 60) * 6, ss = d.getSeconds() * 6;
    if (part !== 'hands') { add(par, 'circle', { cx: x, cy: y, r: r, fill: '#f4f1ea', stroke: '#3a3f4a', 'stroke-width': 2.4 });
    for (var i = 0; i < 12; i++) { var a0 = i * Math.PI / 6; add(par, 'circle', { cx: (x + Math.sin(a0) * r * .8).toFixed(1), cy: (y - Math.cos(a0) * r * .8).toFixed(1), r: .9, fill: '#8a8f99' }); }
    } if (part === 'face') return;
    [[hh, r * .5, 2.4, '#2a2d33'], [mm, r * .76, 1.6, '#2a2d33'], [ss, r * .8, .8, '#d93a3a']].forEach(function (q) { var a = q[0] * Math.PI / 180; add(par, 'line', { x1: x, y1: y, x2: (x + Math.sin(a) * q[1]).toFixed(1), y2: (y - Math.cos(a) * q[1]).toFixed(1), stroke: q[3], 'stroke-width': q[2], 'stroke-linecap': 'round' }); });
    add(par, 'circle', { cx: x, cy: y, r: 1.6, fill: '#2a2d33' });
  }
  function FLOOR(par, col) { add(par, 'rect', { x: 0, y: 200, width: 400, height: 40, fill: col || 'rgba(0,0,0,.22)' }); }
  function kr(n) { return (n < 0 ? '−' : '') + Math.abs(Math.round(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' kr'; }

  function lively() { var d = window.Delight && window.Delight.get ? window.Delight.get() : {}; return d.avLive || 'normal'; }
  function still() { var c = document.documentElement.classList; return lively() === 'still' || c.contains('mo-off') || c.contains('mo-reduced') || !!window.__safeMode || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function myLook() { var A = window.Avatar; if (!A) return {}; var L = A.look(); try { if (A.dressed) L = A.dressed(L); } catch (e) {} return L; }

  /* without a partner in the shared home: the first of your people (their seeded look) */
  function firstPerson() { var A = window.Avatar, F = window.Features; try { var p = F && F.list('people')[0]; return p && A && A.personLook ? A.personLook(p) : null; } catch (e) { return null; } }
  /* the people a scene can draw by name: you, and the one you live with (their look from the shared home) */
  var LOOKS = { me: myLook, partner: function () { var Sp = window.ShareSpace; try { return (Sp && Sp.partnerLook && Sp.partnerLook()) || firstPerson() || { hair: 'long', hairC: '#4a2f1d', skin: '#e3b893', top: 'knit', bottom: 'jeans' }; } catch (e) { return {}; } } };
  /* breathing, blinking and the walk phase, kept per person in the scene's state */
  function LIFE(st, pose, w, who) {
    who = who || 'me'; w = Math.max(0, Math.min(1, w || 0));
    if (st.still) return st['ph' + who] || 0;
    pose.breath = Math.round(11 * Math.sin(st.now / 700 + (who === 'me' ? 0 : 1.7))) / 10;   /* in steps of 0.1 (a twentieth of a pixel): frames where nothing moves are then the same and cost nothing (Fig25.draw keeps them) */
    var b = 'bl' + who; if (st[b] == null) st[b] = 1.5 + Math.random() * 3; st[b] -= st.dt;
    if (st[b] < 0) { pose.blink = true; if (st[b] < -.13) st[b] = 2.5 + Math.random() * 3; }
    st['ph' + who] = (st['ph' + who] || 0) + st.dt * 6.2 * w; return st['ph' + who];
  }
  /* ---------- everyday actions (F3): played by you on any page, where you rest after the page's own action ----------
     Each starts and ends in the rest pose at the spot the page left you (no teleport); only the arms, the turn and a
     prop in the hand change. Picked with the page's own action, never the same twice in a row: a tap on you waves;
     the morning brings a coffee, rain an umbrella, 17 May a flag; at rest he looks round now and then. */
  function cupG(x, y, deg) { var m = grp(x, y, deg); add(m, 'rect', { x: -4.4, y: -5.5, width: 8.8, height: 11, rx: 2, fill: '#f2f2f2' }); add(m, 'path', { d: 'M4.2 -3 q4.2 0 4.2 3 q0 3 -4.2 3', fill: 'none', stroke: '#f2f2f2', 'stroke-width': 1.6 }); add(m, 'rect', { x: -3.8, y: -5.5, width: 7.6, height: 1.5, fill: '#5a3424', opacity: .7 }); return m; }
  function umbrellaG(x, y, s, open) { var u = el('g', {}), r = 34 * s * (.25 + .75 * open), top = y - 46 * s;
    add(u, 'line', { x1: x, y1: y + 4 * s, x2: x, y2: top, stroke: '#3a3f4a', 'stroke-width': 1.8 * s, 'stroke-linecap': 'round' });
    add(u, 'path', { d: 'M' + (x - r) + ' ' + (top + 10 * s * open) + ' Q' + x + ' ' + (top - 16 * s * open) + ' ' + (x + r) + ' ' + (top + 10 * s * open) + ' Q' + (x + r / 2) + ' ' + (top + 5 * s) + ' ' + x + ' ' + (top + 10 * s * open) + ' Q' + (x - r / 2) + ' ' + (top + 5 * s) + ' ' + (x - r) + ' ' + (top + 10 * s * open) + ' Z', fill: '#e8743b' });
    return u; }
  function flagG(x, y, s, wave) { var f = el('g', {}), top = y - 30 * s; add(f, 'line', { x1: x, y1: y + 4 * s, x2: x, y2: top, stroke: '#d7dee3', 'stroke-width': 1.2 * s });
    var w = 16 * s, h = 11 * s, x0 = x, y0 = top; add(f, 'path', { d: 'M' + x0 + ' ' + y0 + ' q' + (w / 2) + ' ' + (-2 * s + wave) + ' ' + w + ' 0 v' + h + ' q' + (-w / 2) + ' ' + (-2 * s - wave) + ' ' + (-w) + ' 0 Z', fill: '#ba0c2f' });
    add(f, 'path', { d: 'M' + (x0 + 5 * s) + ' ' + y0 + ' v' + h + ' M' + x0 + ' ' + (y0 + h / 2) + ' h' + w, stroke: '#fff', 'stroke-width': 3 * s }); add(f, 'path', { d: 'M' + (x0 + 5 * s) + ' ' + y0 + ' v' + h + ' M' + x0 + ' ' + (y0 + h / 2) + ' h' + w, stroke: '#00205b', 'stroke-width': 1.5 * s }); return f; }
  /* ---------- seasons (F3): a small Christmas tree in December, a pumpkin from 20 October to Halloween ----------
     Each page that has room says where it stands (spec.season = { x, y, s }: the foot of the prop on the floor, a
     little behind his walking line, and its size). The prop is drawn first in the moving layer, so he passes in front
     of it. What he does to it stays for the day: the baubles he hung, the pumpkin he lit (DECOR). */
  function season() { if (window.__season != null) return window.__season; var d = new Date(), m = d.getMonth(); return m === 11 ? 'xmas' : m === 9 && d.getDate() >= 20 ? 'halloween' : ''; }
  var DECOR = {};
  function decor(st) { var k = (st.sid || '') + '|' + new Date().toDateString(); return DECOR[k] || (DECOR[k] = { n: 0, lit: false }); }
  var HANG = [[8, -36, '#f2c94c'], [-7, -32, '#d93a3a'], [5, -46, '#3987e5'], [-5, -44, '#e8743b'], [11, -27, '#f2c94c']];   /* hung at chest height, where his hand reaches */
  function treeG(par, x, y, s, n) {
    var g = add(par, 'g', { class: 'sc25-season' });
    add(g, 'ellipse', { cx: x, cy: y + .5, rx: 15 * s, ry: 2.4 * s, fill: 'rgba(0,0,0,.22)' });
    add(g, 'rect', { x: x - 7 * s, y: y - 7 * s, width: 14 * s, height: 7 * s, rx: 1.6 * s, fill: '#a0673a' }); add(g, 'rect', { x: x + 1 * s, y: y - 7 * s, width: 6 * s, height: 7 * s, rx: 1.6 * s, fill: '#7a4b2e' });
    add(g, 'rect', { x: x - 2.4 * s, y: y - 12 * s, width: 4.8 * s, height: 5.5 * s, fill: '#5a3a26' });
    [[10, 22, 21], [24, 20, 16.5], [37, 19, 12]].forEach(function (q) {   /* three tiers, the shade on the far (right) side */
      var b = y - q[0] * s, tp = b - q[1] * s, w = q[2] * s;
      add(g, 'path', { d: 'M' + (x - w).toFixed(1) + ' ' + b.toFixed(1) + ' Q' + x + ' ' + (b + 2.4 * s).toFixed(1) + ' ' + (x + w).toFixed(1) + ' ' + b.toFixed(1) + ' L' + x + ' ' + tp.toFixed(1) + ' Z', fill: '#2f7a4a', 'stroke-linejoin': 'round', stroke: '#2f7a4a', 'stroke-width': 1.6 * s });
      add(g, 'path', { d: 'M' + x + ' ' + (b + 1.2 * s).toFixed(1) + ' Q' + (x + w * .5).toFixed(1) + ' ' + (b + 1.4 * s).toFixed(1) + ' ' + (x + w).toFixed(1) + ' ' + b.toFixed(1) + ' L' + x + ' ' + tp.toFixed(1) + ' Z', fill: '#24603a' });
    });
    add(g, 'path', { d: 'M' + (x - 15 * s).toFixed(1) + ' ' + (y - 17 * s).toFixed(1) + ' Q' + x + ' ' + (y - 12 * s).toFixed(1) + ' ' + (x + 15 * s).toFixed(1) + ' ' + (y - 21 * s).toFixed(1), fill: 'none', stroke: '#f2c94c', 'stroke-width': .9 * s, opacity: .8 });   /* a garland */
    [[-8, -15, '#d93a3a'], [6, -28, '#f2c94c'], [-4, -42, '#3987e5']].forEach(function (b) { add(g, 'circle', { cx: (x + b[0] * s).toFixed(1), cy: (y + b[1] * s).toFixed(1), r: 2.1 * s, fill: b[2] }); });
    for (var i = 0; i < Math.min(n, HANG.length); i++) { var h = HANG[i]; add(g, 'line', { x1: (x + h[0] * s).toFixed(1), y1: (y + h[1] * s - 3.4 * s).toFixed(1), x2: (x + h[0] * s).toFixed(1), y2: (y + h[1] * s - 2 * s).toFixed(1), stroke: '#c9b48e', 'stroke-width': .5 * s }); add(g, 'circle', { cx: (x + h[0] * s).toFixed(1), cy: (y + h[1] * s).toFixed(1), r: 2.2 * s, fill: h[2] }); }
    STAR(g, x, y - 57 * s, 4.4 * s, '#f2c94c');
    return g;
  }
  function baubleG(x, y, s, c) { var b = el('g', {}); add(b, 'circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 2.2 * s, fill: c }); add(b, 'rect', { x: (x - .9 * s).toFixed(1), y: (y - 3.2 * s).toFixed(1), width: 1.8 * s, height: 1.3 * s, fill: '#c9b48e' }); return b; }
  function pumpkinG(par, x, y, s, lit) {
    var g = add(par, 'g', { class: 'sc25-season' });
    if (lit > 0) add(g, 'circle', { cx: x, cy: y - 7 * s, r: 19 * s, fill: '#ffd56b', opacity: (.16 * lit).toFixed(2) });
    add(g, 'ellipse', { cx: x, cy: y + .5, rx: 12 * s, ry: 2 * s, fill: 'rgba(0,0,0,.22)' });
    add(g, 'rect', { x: x - 1.3 * s, y: y - 17 * s, width: 2.6 * s, height: 5 * s, rx: 1 * s, fill: '#5a7a3a' });
    add(g, 'ellipse', { cx: x - 5.5 * s, cy: y - 7 * s, rx: 6.6 * s, ry: 7 * s, fill: '#e8743b' });
    add(g, 'ellipse', { cx: x + 5.5 * s, cy: y - 7 * s, rx: 6.6 * s, ry: 7 * s, fill: '#c95f2c' });
    add(g, 'ellipse', { cx: x - .5 * s, cy: y - 7.2 * s, rx: 6.4 * s, ry: 7.4 * s, fill: '#f08a45' });
    var fc = lit > 0 ? '#ffd56b' : '#5a2a14', o2 = lit > 0 ? (.45 + .55 * lit).toFixed(2) : 1;
    add(g, 'path', { d: 'M' + (x - 5 * s) + ' ' + (y - 9 * s) + ' l' + (2 * s) + ' ' + (-3 * s) + ' l' + (2 * s) + ' ' + (3 * s) + ' Z M' + (x + 1 * s) + ' ' + (y - 9 * s) + ' l' + (2 * s) + ' ' + (-3 * s) + ' l' + (2 * s) + ' ' + (3 * s) + ' Z', fill: fc, opacity: o2 });
    add(g, 'path', { d: 'M' + (x - 5 * s) + ' ' + (y - 6 * s) + ' Q' + x + ' ' + (y - 1.5 * s) + ' ' + (x + 5 * s) + ' ' + (y - 6 * s) + ' Q' + x + ' ' + (y - 3.6 * s) + ' ' + (x - 5 * s) + ' ' + (y - 6 * s) + ' Z', fill: fc, opacity: o2 });
    return g;
  }
  /* drawn first in each frame (behind him): the tree with the baubles hung so far, or the pumpkin, lit once he's lit it */
  function seasonDraw(par, st) {
    var sp = st.season, sn = season(); if (!sp || !sn) return;
    var D = decor(st), g = st.gen;
    if (sn === 'xmas') treeG(par, sp.x, sp.y, sp.s || 1, D.n + (g && g.id === 'tree' && g.t >= 3.1 ? 1 : 0));
    else pumpkinG(par, sp.x, sp.y, sp.s || 1, D.lit ? 1 : g && g.id === 'pumpkin' && g.t >= 2.9 ? CL((g.t - 2.9) / .5) : 0);
  }
  /* walking to the season's prop and back, from wherever the page left him: where to stand, which way, how far */
  var PHR = .0337;   /* walk phase per unit walked at size 1: the steps match the speed, so the feet never slide */
  function trip(o, st, gap) { var sp = st.season, s = (sp && sp.s) || 1, from = o.cx, dir = sp && sp.x < from ? -1 : 1, stand = sp ? sp.x - dir * (gap || 27) * s : from; return { from: from, stand: stand, dir: dir, s: s, d: Math.abs(stand - from), sp: sp }; }
  /* where the page plants his feet or a hand (screen points), they go with him: shifted by how far he walked, and the
     planted feet let go while he walks (a normal step) */
  function carry(o, from) { var dx = o.cx - from, P = o.pose; ['legNear', 'legFar', 'near', 'far'].forEach(function (k2) { var q = P[k2]; if (!q || !q.at || q.path) return; P[k2] = Object.assign({}, q, { at: [q.at[0] + dx, q.at[1]], m: (q.m == null ? 1 : q.m) * (k2.indexOf('leg') === 0 ? 1 - (o.w || 0) : 1) }); }); }
  function walkOn(o, T, t, a, b, t0, t1) { var f = SEG(t, t0, t1), q = E(f); o.cx = LERP(a, b, q); var on = t > t0 && t < t1; o.w = on ? Math.min(1, (t - t0) / .25, (t1 - t) / .25) : 0;
    o.ph = (o.ph || 0) + Math.abs(o.cx - a) * PHR / (o.k || .47); }
  var GEN = {
    /* a wave to you: turn to the front, the right hand up, three waves */
    wave: { len: 2.2, f: function (t, o, it, k, sd, fr) { var hd = sd(1), R0 = fr(hd), WV = B(44, 10); o.pose[hd] = t < .45 ? GO(R0, WV, SEG(t, .2, .45)) : t < 1.75 ? HOLD(B(44, 10 + 9 * Math.sin((t - .45) * 15))) : GO(WV, R0, SEG(t, 1.75, 2.15)); } },
    /* a long stretch, both arms up, up on the toes */
    stretch: { len: 2.6, f: function (t, o, it, k, sd, fr) { var UP = B(28, 4); ['near', 'far'].forEach(function (k2) { var R0 = fr(k2); o.pose[k2] = t < .7 ? GO(R0, UP, SEG(t, .2, .7)) : t < 1.7 ? HOLD(UP) : GO(UP, R0, SEG(t, 1.7, 2.3)); }); o.pose.lift = (o.pose.lift || 0) + 2.4 * Math.sin(Math.PI * SEG(t, .7, 1.7)); } },
    /* checks the time: the left wrist up in front, a look, down again */
    watch: { len: 2.2, f: function (t, o, it, k, sd, fr) { var hd = sd(-1), R0 = fr(hd), W = B(86, 40); o.pose[hd] = t < .55 ? GO(R0, W, SEG(t, .15, .55)) : t < 1.6 ? HOLD(W) : GO(W, R0, SEG(t, 1.6, 2.0)); o.pose.lean = (o.pose.lean || 0) + .08 * Math.sin(Math.PI * SEG(t, .4, 1.7)); } },
    /* looks round the room: a slow turn left and right */
    look: { len: 3.0, turn: function (t) { return 40 * Math.sin(Math.PI * 2 * SEG(t, .3, 2.6)); }, f: function () {} },
    /* outdoors: looks out over the view, a hand over the eyes, turning slowly left and right */
    gaze: { len: 3.4, f: function (t, o, it, k, sd, fr) { var hd = sd(1), R0 = fr(hd), SH = B(40, 34); o.pose[hd] = t < .5 ? GO(R0, SH, SEG(t, .1, .5)) : t < 2.8 ? HOLD(SH) : GO(SH, R0, SEG(t, 2.8, 3.3)); }, turn: function (t) { return 32 * Math.sin(Math.PI * 2 * SEG(t, .6, 2.7)); } },
    /* the morning: a coffee from nowhere you can see – the cup comes up from his side, a sip, down again */
    coffee: { len: 3.2, f: function (t, o, it, k, sd, fr) { var hd = sd(1), R0 = fr(hd), CUP = B(112, 24), MOUTH = B(66, 24); o.pose[hd] = t < .5 ? GO(R0, CUP, SEG(t, .1, .5)) : t < 1.0 ? GO(CUP, MOUTH, SEG(t, .5, 1.0), 2) : t < 2.0 ? HOLD(MOUTH) : t < 2.5 ? GO(MOUTH, CUP, SEG(t, 2.0, 2.5), 2) : GO(CUP, R0, SEG(t, 2.5, 3.0));
      it.push(function (H) { var h = H.s1; if (!h || t < .2 || t > 2.9) return null; var tl = t > 1.0 && t < 2.0 ? 38 * Math.sin(Math.PI * SEG(t, 1.0, 2.0)) : 0; return [h.z - .15, cupG(h.X, h.Y, tl)]; }); } },
    /* rain: the umbrella goes up over the head, he looks up at the sky, it comes down again */
    umbrella: { len: 3.6, f: function (t, o, it, k, sd, fr) { var hd = sd(1), R0 = fr(hd), UPH = B(70, 18); o.pose[hd] = t < .6 ? GO(R0, UPH, SEG(t, .1, .6)) : t < 3.0 ? HOLD(UPH) : GO(UPH, R0, SEG(t, 3.0, 3.5));
      it.push(function (H) { var h = H.s1; if (!h || t < .3 || t > 3.4) return null; var op = E(SEG(t, .6, 1.0)) * (1 - E(SEG(t, 2.6, 3.0))); return [9, umbrellaG(h.X, h.Y, k / .5, op)]; }); } },
    /* 17 May: the flag waves */
    flag: { len: 3.0, f: function (t, o, it, k, sd, fr) { var hd = sd(1), R0 = fr(hd), FL = B(60, 16); o.pose[hd] = t < .4 ? GO(R0, FL, SEG(t, .1, .4)) : t < 2.5 ? HOLD(B(60 + 10 * Math.sin((t - .4) * 9), 16)) : GO(FL, R0, SEG(t, 2.5, 2.9));
      it.push(function (H) { var h = H.s1; if (!h || t < .2 || t > 2.8) return null; return [h.z - .15, flagG(h.X, h.Y, k / .5, 2 * Math.sin(t * 9))]; }); } }
  };
  /* a long press: a little dance (an easter egg – never picked by itself) */
  /* at night (22–05): a big yawn – one arm up, the other hand to the mouth, then sleepy eyes */
  GEN.yawn = { len: 3.8, f: function (t, o, it, k, sd, fr) { var up = sd(-1), mh = sd(1), R0 = fr(up), R1 = fr(mh), UP = B(30, 6), MOUTH = B(66, 24);   /* the hand that holds a cup to the mouth covers the yawn */
      o.pose[up] = t < .6 ? GO(R0, UP, SEG(t, .1, .6)) : t < 1.7 ? HOLD(UP) : GO(UP, R0, SEG(t, 1.7, 2.4));
      o.pose[mh] = t < .7 ? GO(R1, MOUTH, SEG(t, .3, .7), 2) : t < 1.6 ? HOLD(MOUTH) : GO(MOUTH, R1, SEG(t, 1.6, 2.1));
      o.pose.lean = (o.pose.lean || 0) - .07 * Math.sin(Math.PI * SEG(t, .3, 1.8)); o.pose.lift = (o.pose.lift || 0) + 1.4 * Math.sin(Math.PI * SEG(t, .5, 1.6));
      o.expr = t > .5 && t < 1.7 ? 'wow' : t >= 1.7 && t < 3.4 ? 'calm' : null; } };
  GEN.dance = { len: 3.2, f: function (t, o, it, k, sd, fr) { var on = E(SEG(t, 0, .4)) * (1 - E(SEG(t, 2.7, 3.2))), s2 = Math.sin(t * 9);
    ['near', 'far'].forEach(function (k2, i) { o.pose[k2] = GO(fr(k2), B(60 + 22 * s2 * (i ? 1 : -1), 30), on); }); o.pose.lift = (o.pose.lift || 0) + 3 * on * Math.abs(Math.sin(t * 9)); o.pose.lean = (o.pose.lean || 0) + .05 * on * s2; }, turn: function (t) { return 25 * Math.sin(t * 4.5) * E(SEG(t, 0, .4)) * (1 - E(SEG(t, 2.7, 3.2))); } };
  /* December: he walks to the little tree, takes a bauble from his pocket, hangs it, steps back to look, and walks back */
  GEN.tree = { len: 7.4, walk: 1, turn: function (t, o, st) { var T = trip(o, st), d = T.dir; if (!T.sp) return 0;
      return t < 2.0 ? d * 90 * E(SEG(t, .1, .45)) : t < 4.2 ? d * LERP(90, 70, E(SEG(t, 2.0, 2.3))) : t < 4.6 ? LERP(d * 70, -d * 90, E(SEG(t, 4.2, 4.6))) : t < 6.6 ? -d * 90 : -d * 90 * (1 - E(SEG(t, 6.6, 7.0))); },
    f: function (t, o, it, k, sd, fr, st) { var T = trip(o, st); if (!T.sp) return;
      if (t < 4.65) walkOn(o, T, t, T.from, T.stand, .35, 2.0); else walkOn(o, T, t, T.stand, T.from, 4.65, 6.6);
      carry(o, T.from);
      var D = decor(st), h = HANG[D.n % HANG.length], P0 = [T.sp.x + h[0] * T.s, T.sp.y + h[1] * T.s], hd = 'near', R0 = fr(hd);
      if (t >= 2.2 && t < 4.0) o.pose[hd] = t < 2.85 ? GO(R0, AT([P0[0], P0[1] + 2.4 * T.s]), SEG(t, 2.2, 2.85), 4) : t < 3.4 ? HOLD(AT([P0[0], P0[1] + 2.4 * T.s])) : GO(AT([P0[0], P0[1] + 2.4 * T.s]), R0, SEG(t, 3.4, 4.0));
      if (t >= 2.1 && t < 3.1) it.push(function (H) { var n = H.near; if (!n) return null; return [n.z + .05, baubleG(n.X, n.Y + 3.2 * T.s, T.s, h[2])];   /* hanging from his fingers, in front of the hand */ });
      if (t > 4.0 && t < 4.5) o.pose.lift = (o.pose.lift || 0) + 1.6 * Math.sin(Math.PI * SEG(t, 4.0, 4.5));   /* a small happy bounce */
    }, done: function (st) { if (st.season) decor(st).n++; } };
  /* Halloween: he walks to the pumpkin, crouches, lights it (it glows), stands up and walks back */
  GEN.pumpkin = { len: 6.8, walk: 1, turn: function (t, o, st) { var T = trip(o, st, 21), d = T.dir; if (!T.sp) return 0;
      return t < 2.0 ? d * 90 * E(SEG(t, .1, .45)) : t < 3.9 ? d * LERP(90, 60, E(SEG(t, 2.0, 2.3))) : t < 4.3 ? LERP(d * 60, -d * 90, E(SEG(t, 3.9, 4.3))) : t < 6.1 ? -d * 90 : -d * 90 * (1 - E(SEG(t, 6.1, 6.5))); },
    f: function (t, o, it, k, sd, fr, st) { var T = trip(o, st, 21); if (!T.sp) return;
      if (t < 4.2) walkOn(o, T, t, T.from, T.stand, .35, 2.0); else walkOn(o, T, t, T.stand, T.from, 4.3, 6.1);
      carry(o, T.from);
      var c = t < 2.1 ? 0 : t < 2.6 ? E(SEG(t, 2.1, 2.6)) : t < 3.4 ? 1 : 1 - E(SEG(t, 3.4, 3.9));   /* the crouch */
      if (c > 0 && o.aid === 'chair') o.pose.lean = (o.pose.lean || 0) + .3 * c;   /* in the wheelchair: he leans down to it from the seat */
      else if (c > 0 && o.aid === 'crutches') { o.pose.lean = (o.pose.lean || 0) + .62 * c; o.pose.legNear = { m: c, th: .5, kn: 1.0 }; o.pose.legFar = { m: c, th: .5, kn: 1.0 }; o.pose.lift = (o.pose.lift || 0) - 12 * c; }   /* on crutches: a small bend at the knees and a lean, no deep crouch */
      else if (c > 0) { o.pose.lean = (o.pose.lean || 0) + .42 * c; o.pose.legNear = { m: c, th: .85, kn: 1.7 }; o.pose.legFar = { m: c, th: .85, kn: 1.7 }; o.pose.lift = (o.pose.lift || 0) - 20 * c; }   /* a crouch: hips back, knees forward, the back leaning over */
      var top = [T.sp.x - T.dir * 2 * T.s, T.sp.y - 16 * T.s], hd = 'near', R0 = fr(hd);
      if (t >= 2.3 && t < 3.8) o.pose[hd] = t < 2.85 ? GO(R0, AT(top), SEG(t, 2.3, 2.85), 2) : t < 3.25 ? HOLD(AT(top)) : GO(AT(top), R0, SEG(t, 3.25, 3.8));
    }, done: function (st) { if (st.season) decor(st).lit = true; } };
  function wearNow() { try { return window.Avatar && Avatar.wear ? Avatar.wear() : {}; } catch (e) { return {}; } }
  /* which everyday actions fit right now (the page's own come first; these fill in between) */
  /* spec.gen: false (none), or { out: true } for a picture outdoors (the hand over the eyes, the umbrella in rain),
     { no: ['coffee'] } for what doesn't fit there (a page with its own mug) */
  function gens(g, spec) {
    g = g || {}; var d = new Date(), h = d.getHours(), W = wearNow(), l = ['wave', 'stretch', 'watch', g.out ? 'gaze' : 'look'], sn = season();
    if (sn && spec && spec.season && spec.season.act !== false) l.push(sn === 'xmas' ? 'tree' : 'pumpkin');   /* the season's own, where the page has room to walk to it */
    if (h >= 6 && h < 11) l.push('coffee');
    if (h >= 22 || h < 5) l.push('yawn');
    if (W.rain && g.out) l.push('umbrella');
    if (d.getMonth() === 4 && d.getDate() === 17) l.push('flag');
    return l.filter(function (x) { return (g.no || []).indexOf(x) < 0; });
  }
  /* one person: the shadow, the body (depth-sorted parts), things held drawn at the hand's own depth (o.items(H)) */
  function FIG(par, o) {
    var k = o.k || .47, gy = o.gy, H;
    var who = o.who || (typeof o.look === 'string' ? o.look : 'me'), pk = 'pool' + who, st = o.st;   /* each person their own pool */ if (st && !st[pk]) st[pk] = Fig25.pool();
    var lk = o.look && typeof o.look !== 'string' ? o.look : null;
    if (!lk) { var lkey = o.look || 'me', mem = st && SP ? (st.__lk = st.__lk || {}) : null, tn = Date.now();   /* inside a frame the look is read once a second, not 60 times (it parses the saved settings) */
      if (mem && mem[lkey] && tn - mem[lkey].t < 1000) lk = mem[lkey].v;
      else { lk = LOOKS[lkey] ? LOOKS[lkey]() : myLook(); if (mem) mem[lkey] = { v: lk, t: tn }; } }
    /* an everyday action (F3) on you: from where the page left you, turned to the front, arms and a prop; at rest a look round now and then */
    var gx = [], face = o.face || 0;
    if (st && who === 'me' && !o.noGen && st.gen && GEN[st.gen.id]) {
      var gd = GEN[st.gen.id], gt = st.gen.t, ft = E(SEG(gt, 0, .35)) * (1 - E(SEG(gt, gd.len - .4, gd.len)));
      var p0 = o.pose || {}; o = Object.assign({}, o, { pose: Object.assign({}, p0) });
      o.aid = lk && lk.aid;   /* the wheelchair or crutches: an action can choose its own way */
      var fr = function (key) { var q = p0[key]; return q && !q.path && (q.at || q.b) ? (q.at ? { at: q.at } : { b: q.b }) : REST; };   /* each hand starts and ends where the page holds it */
      face = LERP(face, 0, ft) + (gd.turn ? gd.turn(gt, o, st) : 0) * ft;
      var fNow = face; gd.f(gt, o, gx, k, function (sd) { return SIDE(sd, fNow); }, fr, st);   /* the hand on his right/left side whichever way he faces now */
      if (o.expr && lk) { var mx = st.__lkx || (st.__lkx = {}); if (!mx[o.expr] || mx[o.expr].b !== lk) mx[o.expr] = { b: lk, v: Object.assign({}, lk, { expr: o.expr }) }; lk = mx[o.expr].v; }   /* an action's face (a yawn), kept as one look object so the figure's cache holds */
    } else if (st && who === 'me' && !o.noGen && !st.playing && !st.still && st.restT > 0) {
      var rp = (st.restT % 11) / 11; face += 26 * Math.sin(Math.PI * 2 * SEG(rp, .55, .8)) * (Math.abs(face) < 30 ? 1 : 0);   /* a slow look round, then back */
      if (st.lookAt != null && Math.abs(face) < 40 && performance.now() - st.lookT < 1500) { var want = CL((st.lookAt - o.cx) / 160 + .5) * 60 - 30; st.lookF = LERP(st.lookF || 0, want, .15); face += st.lookF; }   /* he turns a little toward your finger or pointer */
      else if (st.lookF) { st.lookF = LERP(st.lookF, 0, .1); face += st.lookF; if (Math.abs(st.lookF) < .3) st.lookF = 0; }
    }
    if (!o.noShadow) add(par, 'ellipse', { cx: o.shX != null && !(st && st.gen && GEN[st.gen.id] && GEN[st.gen.id].walk) ? o.shX : o.cx, cy: (o.ground != null ? o.ground : gy) + .5, rx: 15 * k / .5 * (o.shS || 1), ry: 3 * k / .5, fill: 'rgba(0,0,0,.25)' });   /* after an everyday action may have moved him (a walk to the tree) */
    var parts = Fig25.draw(lk, face * Math.PI / 180, o.cx, gy, k, o.ph || 0, Math.max(0, Math.min(1, o.w || 0)), o.pose || {}, st && SP ? st[pk] : null);   /* the pool only inside a frame (paint): its copies are patched into the picture */
    var hd = Fig25.hand(); H = { near: hd.near, far: hd.far, s1: hd.s1, sm: hd['s-1'] };
    if (st) (st.figs = st.figs || {})[who] = { t: st.t, cx: o.cx, gy: gy, near: hd.near && [hd.near.X, hd.near.Y], far: hd.far && [hd.far.X, hd.far.Y], R: hd.s1 && [hd.s1.X, hd.s1.Y], L: hd['s-1'] && [hd['s-1'].X, hd['s-1'].Y] };   /* R/L: the same hand whichever way he faces */   /* for the flow test */
    if (o.items) parts = parts.concat(o.items(H) || []);
    gx.forEach(function (f) { var x = f(H); if (x) parts.push(x); });
    if (o.extra) parts = parts.concat(o.extra);
    var tgt = o.tf ? add(par, 'g', { transform: o.tf }) : par;
    parts.sort(function (p, q) { return p[0] - q[0]; }).forEach(function (p) { tgt.appendChild(p[1]); });
    return H;
  }

  /* ---------- the runner ---------- */
  var ALL = [];
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (en) { var r = ALL.filter(function (x) { return x.svg === en.target; })[0]; if (r) { r.vis = en.isIntersecting; if (r.vis) r.wake(); } }); }, { rootMargin: '60px' }) : null;
  var MS = { n: 0, sum: 0, max: 0 };
  function run(svg, spec) {
    if (!svg || !window.Fig25) return null;
    var prevSt = null; ALL.forEach(function (x) { if (x.id === (spec.id || location.pathname) && performance.now() - (x.lp || 0) < 1500) prevSt = x.st; });   /* only a redraw just now – coming back to the page starts it fresh */
    ALL = ALL.filter(function (x) { if (x.svg === svg || !x.svg.isConnected || x.id === (spec.id || location.pathname)) { x.dead = true; if (io) io.unobserve(x.svg); return false; } return true; });
    svg.setAttribute('viewBox', '0 0 400 240'); svg.classList.add('sc25');
    /* the page's own actions (F3): spec.acts = [{ id, len, w: function (data) → how well it fits now (0 = not now) }];
       render() sees st.pact (null = the main action, spec.len). Each starts and ends where the page's rest is. */
    var len0 = spec.len, idle = spec.idle || [22, 37], ACTS = {};
    (spec.acts || []).forEach(function (a) { ACTS[a.id] = a; });
    function LEN() { return st.pact && ACTS[st.pact] ? ACTS[st.pact].len : len0; }
    var id = spec.id || location.pathname;
    var st = { t: 0, ll: 0, playing: true, idle: 0, next: idle[0] + Math.random() * (idle[1] - idle[0]), now: 0, dt: 0, still: still(), data: spec.data || {}, gen: null, last: 'main', restT: 0, pact: null };
    /* the picture was drawn again (new numbers, a tick on the list): carry on where it was instead of starting over */
    if (prevSt && !st.still) ['t', 'playing', 'idle', 'next', 'endNow', 'from', 'phme', 'blme', 'gen', 'last', 'restT', 'pact'].forEach(function (k) { if (prevSt[k] != null) st[k] = prevSt[k]; });
    st.season = spec.season || null; st.sid = id;
    var R = { svg: svg, vis: !io, dead: false, raf: 0, st: st, id: id };
    function frame(now) {
      R.raf = 0;
      if (R.dead || !svg.isConnected) { R.dead = true; return; }
      var t0 = performance.now(), dt = Math.min(50, now - (st.ll || now)) / 1000, sp = window.__sceneSpeed || 1; st.ll = now; st.dt = dt * sp; st.now = now;
      if (st.gen) { st.gen.t += dt * sp; if (st.gen.t >= GEN[st.gen.id].len) { if (GEN[st.gen.id].done) GEN[st.gen.id].done(st); st.gen = null; st.playing = false; st.endNow = now; st.restT = 0; } }
      else if (st.playing) st.t += dt * sp;
      st.idle += dt; if (!st.playing) st.restT += dt * sp;
      if (!st.playing && st.queue) play(true, st.queue);
      else if (!st.playing && st.idle > st.next) { st.next = idle[0] + Math.random() * (idle[1] - idle[0]); play(); }
      if (!st.gen && st.t >= LEN()) { if (st.playing) { st.endNow = now; st.restT = 0; } st.t = LEN(); st.playing = false; }
      /* resting (breathing, a blink, a slow look round) is drawn at 30 frames a second – half the work, the same look */
      if (!st.playing && (st.skip = (st.skip || 0) + 1) % 2) { wake(); return; }
      paint();
      var ms = performance.now() - t0; MS.n++; MS.sum += ms; MS.max = Math.max(MS.max, ms);
      wake();
    }
    /* what never moves (the room, the furniture) is drawn once into its own layer (spec.back); only the front layer
       is drawn again each frame – that keeps a frame under 4 ms on a slow phone */
    var back = null, front = null;
    function paint() {
      R.lp = performance.now();
      if (!back || !back.isConnected) { while (svg.firstChild) svg.removeChild(svg.firstChild); back = add(svg, 'g', { class: 'sc25-back' }); if (spec.back) spec.back(back, st); front = add(svg, 'g', { class: 'sc25-front' }); }
      /* the frame is built off the page from pooled elements, then only what changed is written into the picture */
      var vf = st.__vf || (st.__vf = document.createElementNS(NS, 'g')); vf.textContent = '';
      SP = st.__sp || (st.__sp = { l: [], i: 0 }); SP.i = 0;
      try { seasonDraw(vf, st); spec.render(vf, st.t, st); if (spec.hits) spec.hits.forEach(function (h) { var ha = { x: h[0], y: h[1], width: h[2], height: h[3], fill: 'transparent', class: 'hs-part sc25-hit', 'data-scgo': h[4] }; if (h[5]) ha['data-scact'] = h[5]; add(vf, 'rect', ha); }); SP = null; patch(front, vf); }   /* tap areas over the things that open a card */ catch (e) { SP = null; R.dead = true; if (window.Diag && Diag.log) Diag.log('scene', 'scene25: ' + (e && e.message), 'scene25.js'); throw e; }
    }
    function wake() { if (R.dead || R.raf || st.still) return; if (R.vis && !document.hidden) R.raf = requestAnimationFrame(frame); }
    /* what plays next: the page's own action and the everyday ones take turns, never the same twice in a row */
    function choose() {
      /* weighted: the page's main action 2, its own actions as much as the data says (a strong fit 3–4), everyday ones 1 */
      var pool = [['main', 2]];
      Object.keys(ACTS).forEach(function (k) { var w = 0; try { w = +ACTS[k].w(st.data, st) || 0; } catch (e) {} if (w > 0) pool.push([k, w]); });
      (spec.gen === false ? [] : gens(spec.gen, spec)).forEach(function (g) { pool.push([g, g === 'tree' || g === 'pumpkin' ? 2 : 1]); });
      pool = pool.filter(function (x) { return x[0] !== st.last; }); if (!pool.length) return 'main';
      var sum = pool.reduce(function (a, x) { return a + x[1]; }, 0), r = Math.random() * sum;
      for (var i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i][0]; }
      return pool[pool.length - 1][0];
    }
    function play(force, which) {
      if (st.playing && (st.gen || st.t < LEN() - .01)) { if (which) st.queue = which; return; }   /* busy: it finishes, then does what you asked */
      var nx = which || choose(); st.queue = null; st.last = nx; st.idle = 0; st.restT = 0;
      if (GEN[nx]) { st.t = LEN(); st.gen = { id: nx, t: 0 }; }
      else if (ACTS[nx]) { st.pact = nx; st.t = 0; st.gen = null; }
      else { st.pact = null; if (spec.pick) spec.pick(st); st.t = 0; st.gen = null; }
      st.playing = true; wake();
    }
    R.wake = wake;
    /* a tap on the picture: he waves (or, after a wave, the next action) */
    var lp = 0, longDone = false;
    svg.addEventListener('click', function (e) { if (longDone) { longDone = false; return; } var hg = e.target.closest('[data-scgo]'); if (hg) { var ta = hg.getAttribute('data-scact'); if (ta && !st.still && (ta === 'main' || ACTS[ta] || (GEN[ta] && spec.gen !== false))) play(false, ta); return; }   /* a tap on a thing: he goes and uses it (data-scact), and the card opens as before */ play(false, spec.gen === false ? 'main' : st.last === 'wave' ? choose() : 'wave'); });
    /* a long press: a little dance; moving over the picture: he looks your way (at rest) */
    svg.addEventListener('pointerdown', function () { if (spec.gen === false) return; clearTimeout(lp); lp = setTimeout(function () { longDone = true; play(false, 'dance'); }, 650); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { svg.addEventListener(ev, function () { clearTimeout(lp); }); });
    svg.addEventListener('pointermove', function (e) { var r2 = svg.getBoundingClientRect(); if (!r2.width) return; st.lookAt = (e.clientX - r2.left) / r2.width * 400; st.lookT = performance.now(); if (!st.playing) wake(); });
    if (spec.pick) spec.pick(st);
    if (st.still) { st.t = LEN(); st.playing = false; st.now = 0; paint(); }
    else { paint(); if (io) io.observe(svg); wake(); }
    R.api = { play: play, at: function (t) { st.gen = null; st.pact = null; st.t = t; st.playing = t < len0; st.ll = 0; paint(); },
      act: function (id, t) { st.t = LEN(); st.gen = GEN[id] ? { id: id, t: t || 0 } : null; st.playing = !!st.gen; st.ll = 0; paint(); },
      /* a page action at time t (tests and contact sheets) */
      pact: function (id, t) { st.gen = null; st.pact = ACTS[id] ? id : null; st.t = t; st.playing = t < LEN(); st.ll = 0; paint(); },
      acts: function () { return Object.keys(ACTS).map(function (k) { return { id: k, len: ACTS[k].len, w: +ACTS[k].w(st.data, st) || 0 }; }); },
      state: st, len: len0, stop: function () { R.dead = true; } };
    ALL.push(R);
    return R.api;
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) ALL.forEach(function (r) { r.wake(); }); });

  window.Scene25 = { run: run, still: still, look: myLook, el: el, add: add, txt: txt, E: E, CL: CL, SEG: SEG, LERP: LERP, MIX: MIX, swing: swing, CHEER: CHEER, STAR: STAR, LIFE: LIFE, FIG: FIG, kr: kr, GEN: GEN, gens: gens, season: season, decor: decor,
    /* for the tests and contact sheets: every live scene to time t (seconds) */
    REST: REST, AT: AT, B: B, GO: GO, HOLD: HOLD, SIDE: SIDE, LEG: LEG, grp: grp, CLOCK: CLOCK, FLOOR: FLOOR, LOOKS: LOOKS,
    seek: function (t) { ALL.forEach(function (r) { if (!r.dead) r.api.at(t); }); }, list: function () { return ALL.filter(function (r) { return !r.dead; }).map(function (r) { return r.api; }); },
    ms: function () { return { avg: MS.n ? MS.sum / MS.n : 0, max: MS.max, n: MS.n }; }, reset: function () { MS.n = 0; MS.sum = 0; MS.max = 0; } };
})();
