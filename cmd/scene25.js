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
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
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
  function CLOCK(par, x, y, r) {
    var d = new Date(), hh = (d.getHours() % 12 + d.getMinutes() / 60) * 30, mm = (d.getMinutes() + d.getSeconds() / 60) * 6, ss = d.getSeconds() * 6;
    add(par, 'circle', { cx: x, cy: y, r: r, fill: '#f4f1ea', stroke: '#3a3f4a', 'stroke-width': 2.4 });
    for (var i = 0; i < 12; i++) { var a0 = i * Math.PI / 6; add(par, 'circle', { cx: (x + Math.sin(a0) * r * .8).toFixed(1), cy: (y - Math.cos(a0) * r * .8).toFixed(1), r: .9, fill: '#8a8f99' }); }
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
    pose.breath = 1.1 * Math.sin(st.now / 700 + (who === 'me' ? 0 : 1.7));
    var b = 'bl' + who; if (st[b] == null) st[b] = 1.5 + Math.random() * 3; st[b] -= st.dt;
    if (st[b] < 0) { pose.blink = true; if (st[b] < -.13) st[b] = 2.5 + Math.random() * 3; }
    st['ph' + who] = (st['ph' + who] || 0) + st.dt * 6.2 * w; return st['ph' + who];
  }
  /* one person: the shadow, the body (depth-sorted parts), things held drawn at the hand's own depth (o.items(H)) */
  function FIG(par, o) {
    var k = o.k || .47, gy = o.gy, H;
    if (!o.noShadow) add(par, 'ellipse', { cx: o.shX != null ? o.shX : o.cx, cy: (o.ground != null ? o.ground : gy) + .5, rx: 15 * k / .5 * (o.shS || 1), ry: 3 * k / .5, fill: 'rgba(0,0,0,.25)' });
    var who = o.who || (typeof o.look === 'string' ? o.look : 'me'), pk = 'pool' + who, st = o.st;   /* each person their own pool */ if (st && !st[pk]) st[pk] = Fig25.pool();
    var lk = typeof o.look === 'string' || !o.look ? (LOOKS[o.look || 'me'] ? LOOKS[o.look || 'me']() : myLook()) : o.look;
    var parts = Fig25.draw(lk, (o.face || 0) * Math.PI / 180, o.cx, gy, k, o.ph || 0, Math.max(0, Math.min(1, o.w || 0)), o.pose || {}, st ? st[pk] : null);
    var hd = Fig25.hand(); H = { near: hd.near, far: hd.far, s1: hd.s1, sm: hd['s-1'] };
    if (st) (st.figs = st.figs || {})[who] = { t: st.t, cx: o.cx, gy: gy, near: hd.near && [hd.near.X, hd.near.Y], far: hd.far && [hd.far.X, hd.far.Y], R: hd.s1 && [hd.s1.X, hd.s1.Y], L: hd['s-1'] && [hd['s-1'].X, hd['s-1'].Y] };   /* R/L: the same hand whichever way he faces */   /* for the flow test */
    if (o.items) parts = parts.concat(o.items(H) || []);
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
    var len = spec.len, idle = spec.idle || [22, 37];
    var id = spec.id || location.pathname;
    var st = { t: 0, ll: 0, playing: true, idle: 0, next: idle[0] + Math.random() * (idle[1] - idle[0]), now: 0, dt: 0, still: still(), data: spec.data || {} };
    /* the picture was drawn again (new numbers, a tick on the list): carry on where it was instead of starting over */
    if (prevSt && !st.still) ['t', 'playing', 'idle', 'next', 'endNow', 'from', 'phme', 'blme'].forEach(function (k) { if (prevSt[k] != null) st[k] = prevSt[k]; });
    var R = { svg: svg, vis: !io, dead: false, raf: 0, st: st, id: id };
    function frame(now) {
      R.raf = 0;
      if (R.dead || !svg.isConnected) { R.dead = true; return; }
      var t0 = performance.now(), dt = Math.min(50, now - (st.ll || now)) / 1000, sp = window.__sceneSpeed || 1; st.ll = now; st.dt = dt * sp; st.now = now;
      if (st.playing) st.t += dt * sp; st.idle += dt;
      if (!st.playing && st.idle > st.next) { st.next = idle[0] + Math.random() * (idle[1] - idle[0]); play(); }
      if (st.t >= len) { if (st.playing) st.endNow = now; st.t = len; st.playing = false; }
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
      while (front.firstChild) front.removeChild(front.firstChild);
      try { spec.render(front, st.t, st); if (spec.hits) spec.hits.forEach(function (h) { add(front, 'rect', { x: h[0], y: h[1], width: h[2], height: h[3], fill: 'transparent', class: 'hs-part sc25-hit', 'data-scgo': h[4] }); }); }   /* tap areas over the things that open a card */ catch (e) { R.dead = true; if (window.Diag && Diag.log) Diag.log('scene', 'scene25: ' + (e && e.message), 'scene25.js'); throw e; }
    }
    function wake() { if (R.dead || R.raf || st.still) return; if (R.vis && !document.hidden) R.raf = requestAnimationFrame(frame); }
    function play(force) { if (!force && st.playing && st.t < len - .01) return; if (spec.pick) spec.pick(st); st.t = 0; st.playing = true; st.idle = 0; wake(); }
    R.wake = wake;
    svg.addEventListener('click', function (e) { if (e.target.closest('[data-scgo]')) return; play(); });
    if (spec.pick) spec.pick(st);
    if (st.still) { st.t = len; st.playing = false; st.now = 0; paint(); }
    else { paint(); if (io) io.observe(svg); wake(); }
    R.api = { play: play, at: function (t) { st.t = t; st.playing = t < len; st.ll = 0; paint(); }, state: st, len: len, stop: function () { R.dead = true; } };
    ALL.push(R);
    return R.api;
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) ALL.forEach(function (r) { r.wake(); }); });

  window.Scene25 = { run: run, still: still, look: myLook, el: el, add: add, txt: txt, E: E, CL: CL, SEG: SEG, LERP: LERP, MIX: MIX, swing: swing, CHEER: CHEER, STAR: STAR, LIFE: LIFE, FIG: FIG, kr: kr,
    /* for the tests and contact sheets: every live scene to time t (seconds) */
    REST: REST, AT: AT, B: B, GO: GO, HOLD: HOLD, SIDE: SIDE, LEG: LEG, grp: grp, CLOCK: CLOCK, FLOOR: FLOOR, LOOKS: LOOKS,
    seek: function (t) { ALL.forEach(function (r) { if (!r.dead) r.api.at(t); }); }, list: function () { return ALL.filter(function (r) { return !r.dead; }).map(function (r) { return r.api; }); },
    ms: function () { return { avg: MS.n ? MS.sum / MS.n : 0, max: MS.max, n: MS.n }; }, reset: function () { MS.n = 0; MS.sum = 0; MS.max = 0; } };
})();
