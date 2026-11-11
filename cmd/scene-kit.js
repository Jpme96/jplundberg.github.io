/* The living scenes' engine (Phase L3–L5): your avatar (avatar.js, posed by avatar-rig.js) in a page picture, moved by
   short scripts – walk (side-on, or toward/away from us), turn, reach, hold a prop, look, say – and a brain that picks
   the next action, rests in between and reacts to a tap. One requestAnimationFrame loop for all heroes; it stops when
   none is on the page, pauses in a hidden tab, and nothing starts with reduced motion / animations off / safe mode
   (Live.still() – the page keeps its still picture). Props (Live.Obj) are drawn at the size of the hand. */
(function () {
  'use strict';
  if (window.Live) return;
  var NS = 'http://www.w3.org/2000/svg';
  function lively() { var d = window.Delight && window.Delight.get ? window.Delight.get() : {}; return d.avLive || 'normal'; }
  function still() { var c = document.documentElement.classList; return lively() === 'still' || c.contains('mo-off') || c.contains('mo-reduced') || !!window.__safeMode || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  var reduce = false, NB = window.I18N && window.I18N.lang === 'nb';
  function el(tag, at, html) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); if (html) e.innerHTML = html; return e; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function ease(u) { return u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  var HEROES = [];

  /* ---------- the avatar in a scene ---------- */
  function Hero(svg, before, box, look) {
    var H = { svg: svg, look: Object.assign({}, window.Avatar && Avatar.look ? Avatar.look() : {}, look || {}), faces: {} };
    var s = Math.min(box.w / 114, box.h / 144), ox = box.x + (box.w - 114 * s) / 2, oy = box.y + box.h - 144 * s;
    H.s = s; H.feet0 = [ox + 57 * s, oy + 140 * s];
    var f = Avatar.figure({ k: 'plain', plain: true, bg: '#000', sky: 'none' }, H.look).replace(/<ellipse cx="101" cy="160"[^>]*>/, '')
      .replace('<svg viewBox="0 0 200 200"', '<svg viewBox="44 20 114 144" preserveAspectRatio="xMidYMax meet" x="' + box.x + '" y="' + box.y + '" width="' + box.w + '" height="' + box.h + '"');
    H.wrap = el('g', { class: 'hero' }); H.wrap.innerHTML = '<ellipse class="hero-sh" cx="' + H.feet0[0] + '" cy="' + H.feet0[1] + '" rx="' + 15 * s / .5 + '" ry="' + 2.4 * s / .5 + '" fill="rgba(0,0,0,.28)"/><g class="hero-body">' + f + '</g>';
    if (before) svg.insertBefore(H.wrap, before); else svg.appendChild(H.wrap);
    H.body = H.wrap.querySelector('.hero-body'); H.sh = H.wrap.querySelector('.hero-sh'); H.fig = H.wrap.querySelector('.hero-body > svg');
    H.rig = Rig(H.fig);
    H.pos = H.feet0.slice(); H.lean = 0; H.bob = 0; H.lift = 0; H.op = 1;
    H.hand = { R: null, L: null }; H.rot = { R: [0, 0], L: [0, 0] }; H.legs = { R: 0, L: 0, sR: 0, sL: 0 }; H.head = [0, 0];
    H.held = { R: null, L: null }; H.bend = { R: 1, L: 1 }; H.turn = 0; H.str = null; H.view = 'front'; H.sq = 1; H.hold = {}; H.k = 1;
    H.layB = el('g', { class: 'held-back' }); H.layF = el('g', { class: 'held-front' }); svg.insertBefore(H.layB, H.wrap); svg.insertBefore(H.layF, H.wrap.nextSibling);
    H.gaze = null; H.objs = {};
    H.bounce = H.look.walk === 'bouncy' ? 1.8 : H.look.walk === 'calm' ? .7 : 1; H.speed = H.look.walk === 'quick' ? 1.4 : H.look.walk === 'calm' ? .8 : 1; H.main = H.look.hand === 'left' ? 'L' : 'R';
    HEROES.push(H); wake(); return H;
  }
  /* things in a hand: drawn so the grip sits in the hand; rot tilts it, flip mirrors it (a can facing left);
     with your back to us it's in front of you, so it's hidden behind your body */
  function Obj(H, side, html, grip, opt) {
    var g = el('g', { class: 'obj' }, html); opt = opt || {};
    var o = { g: g, side: side, grip: grip || [0, 0], rot: opt.rot || 0, flip: !!opt.flip, sc: opt.sc || 1, layer: opt.layer || null, free: null };
    H.objs[side] = o; H.layF.appendChild(g); return o;
  }
  function objXf(H, o, P) { var k = H.s / .5 * (H.k || 1) * o.sc; return 'translate(' + P[0].toFixed(2) + ' ' + P[1].toFixed(2) + ') scale(' + k.toFixed(3) + ') rotate(' + o.rot.toFixed(2) + ') scale(' + (o.flip ? -1 : 1) + ' 1) translate(' + (-o.grip[0]) + ' ' + (-o.grip[1]) + ')'; }
  /* a point on a held thing (like the tip of a spout), in the picture */
  function objPoint(H, o, lp) { var P = o.free || handAt(H, o.side), k = H.s / .5 * (H.k || 1) * o.sc, x = (lp[0] - o.grip[0]) * (o.flip ? -1 : 1), y = lp[1] - o.grip[1], a = o.rot * Math.PI / 180; return [P[0] + k * (x * Math.cos(a) - y * Math.sin(a)), P[1] + k * (x * Math.sin(a) + y * Math.cos(a))]; }
  function letGo(H, side) { var o = H.objs[side]; if (o) { o.g.remove(); delete H.objs[side]; } }
  /* an interrupted action puts everything down: props out of the hands, the maker's own things back */
  function clear(H) { letGo(H, 'R'); letGo(H, 'L'); H.gaze = null; if (window.Rig && Rig.stow) Rig.stow(H.rig, false); }
  function toLocal(H, g, P) { var a = H.svg.getScreenCTM(), b = g.getScreenCTM(); if (!a || !b) return P; var pt = H.svg.createSVGPoint(); pt.x = P[0]; pt.y = P[1]; var q = pt.matrixTransform(a).matrixTransform(b.inverse()); return [q.x, q.y]; }
  function toScene(H, g, P) { var a = H.svg.getScreenCTM(), b = g.getScreenCTM(); if (!a || !b) return P; var pt = H.svg.createSVGPoint(); pt.x = P[0]; pt.y = P[1]; var q = pt.matrixTransform(b).matrixTransform(a.inverse()); return [q.x, q.y]; }
  function grip(A) { var w = Rig.wrist(A), e = A.cur.El, d = Math.hypot(w[0] - e[0], w[1] - e[1]) || 1; return [w[0] + (w[0] - e[0]) / d * 3.5, w[1] + (w[1] - e[1]) / d * 3.5]; }
  function handAt(H, side) { var A = H.rig[side]; return A ? toScene(H, A.g, grip(A)) : H.pos.slice(); }
  function restHand(H, side) { var A = H.rig[side]; if (!A) return H.pos.slice(); Rig.rot(A, 0, 0); return toScene(H, A.g, grip(A)); }
  function aim(A, P) { var e = A.cur.El, w = Rig.wrist(A), d = Math.hypot(w[0] - e[0], w[1] - e[1]) || 1; return [P[0] - (w[0] - e[0]) / d * 3.5, P[1] - (w[1] - e[1]) / d * 3.5]; }
  function render(H, t) {
    var br = reduce ? 0 : Math.sin(t / 560 + H.feet0[0]) * .22;
    var dx = H.pos[0] - H.feet0[0], dy = H.pos[1] - H.feet0[1] + H.bob;
    H.body.setAttribute('transform', 'translate(' + dx.toFixed(2) + ' ' + (dy + br * .3).toFixed(2) + ') rotate(' + H.lean.toFixed(2) + ' ' + H.feet0[0] + ' ' + H.feet0[1] + ') translate(' + H.feet0[0] + ' ' + H.feet0[1] + ') scale(' + H.k.toFixed(3) + ') translate(' + (-H.feet0[0]) + ' ' + (-H.feet0[1]) + ') translate(0 ' + (-H.lift) + ')');
    H.fig.setAttribute('transform', H.sq !== 1 ? 'translate(' + H.feet0[0] + ' 0) scale(' + H.sq.toFixed(3) + ' 1) translate(' + (-H.feet0[0]) + ' 0)' : '');
    H.body.style.opacity = H.op; H.sh.style.opacity = H.op;
    var air = Math.max(0, -H.bob - H.lift * 0);
    H.sh.setAttribute('transform', 'translate(' + dx.toFixed(2) + ' ' + (H.pos[1] - H.feet0[1] + (H.groundOff || 0)).toFixed(2) + ') translate(' + H.feet0[0] + ' ' + H.feet0[1] + ') scale(' + (Math.max(.5, 1 - air * .03) * H.k).toFixed(2) + ') translate(' + (-H.feet0[0]) + ' ' + (-H.feet0[1]) + ')');
    ['R', 'L'].forEach(function (k) {
      var A = H.rig[k];
      if (!A) return;
      if (H.hand[k]) Rig.reach(A, aim(A, toLocal(H, A.g, H.hand[k])), H.bend[k]); else Rig.rot(A, H.rot[k][0], H.rot[k][1]);
      if (H.held[k]) { var p = handAt(H, k); H.held[k].setAttribute('transform', 'translate(' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + ')'); }
    });
    if (Math.abs(H.turn) > .01 || H.rig.t) Rig.turn(H.rig, Math.abs(H.turn) > .01 ? H.turn : 0);
    if (H.str) { Rig.stride(H.rig.LR, H.str[0], H.str[1]); Rig.stride(H.rig.LL, H.str[2], H.str[3]); }
    else { Rig.leg(H.rig.LR, H.legs.R, H.legs.sR); Rig.leg(H.rig.LL, H.legs.L, H.legs.sL); }
    /* eyes and face follow what you're doing */
    var lx = 0, ly = 0, ht = 0;
    if (H.gaze && H.view !== 'back') { var hc = [H.pos[0], H.pos[1] - 100 * H.s * (H.k || 1)], dx = H.gaze[0] - hc[0], dy = H.gaze[1] - hc[1], d = Math.hypot(dx, dy) || 1; lx = dx / d * 2.4; ly = dy / d * 1.6; ht = dx / d * 3; }
    H.lk = H.lk || [0, 0, 0]; H.lk = [lerp(H.lk[0], lx, .15), lerp(H.lk[1], ly, .15), lerp(H.lk[2], ht, .15)];
    var tt = Math.abs(H.turn) > .01 ? H.turn : 0;
    H.fig.querySelectorAll('.av-feat').forEach(function (e) { e.setAttribute('transform', 'translate(' + (5.5 * tt + H.lk[0]).toFixed(2) + ' ' + H.lk[1].toFixed(2) + ')'); });
    if (H.rig.head) H.rig.head.setAttribute('transform', 'rotate(' + (H.head[0] + H.lk[2]).toFixed(2) + ' 101 80) translate(0 ' + H.head[1].toFixed(2) + ')');
    /* held things */
    Object.keys(H.objs).forEach(function (k) { var o = H.objs[k], want = o.layer === 'front' ? H.layF : o.layer === 'back' ? H.layB : (H.view === 'back' ? H.layB : H.layF); if (o.g.parentNode !== want) want.appendChild(o.g); o.g.style.opacity = H.op; o.g.setAttribute('transform', objXf(H, o, o.free || handAt(H, k))); });
  }
  var running = false;
  function loop(t) {
    HEROES = HEROES.filter(function (H) { return H.svg.isConnected && !H.dead; });
    if (!HEROES.length) { running = false; return; }
    if (!document.hidden) HEROES.forEach(function (H) { try { render(H, t); } catch (e) { H.dead = true; if (window.Diag && Diag.log) Diag.log('error', 'scene: ' + (e && e.message), 'scene-kit.js'); } });
    requestAnimationFrame(loop);
  }
  function wake() { if (!running) { running = true; requestAnimationFrame(loop); } }

  /* ---------- scripting ---------- */
  function Run(scene) { return { sc: scene, tok: 0 }; }
  function tw(R, ms, f) { var tok = R.tok; return new Promise(function (res) { var t0 = performance.now(); (function fr(now) { if (R.tok !== tok || (R.alive && !R.alive())) return; if (document.hidden) { t0 += 16; requestAnimationFrame(fr); return; } var u = Math.min(1, (now - t0) / ms); f(u); if (u < 1) requestAnimationFrame(fr); else res(); })(t0); }); }
  function wait(R, ms) { return tw(R, ms, function () {}); }
  /* walk: knees lift in turn, a little bob, arms swing; pathFn(u) can give the ground to walk on (a trail) */
  function walk(R, H, to, speed, pathFn, endTurn, faceDir) {
    var from = H.pos.slice(), dist = Math.hypot(to[0] - from[0], to[1] - from[1]), step = 7 * H.s / .5 * (H.k || 1), ms = Math.max(300, dist / ((speed || 24) * (H.speed || 1)) * 1000), dir = to[0] >= from[0] ? 1 : -1, t0 = H.turn;
    var last = from.slice();
    return tw(R, ms, function (u) {
      var p = pathFn ? pathFn(u) : [lerp(from[0], to[0], u), lerp(from[1], to[1], u)], ph = dist * u / step * Math.PI / 2, sn = Math.sin(ph), cs = Math.cos(ph);
      var fade = Math.min(1, u * ms / 220, (1 - u) * ms / 260), dd = [p[0] - last[0], p[1] - last[1]]; last = p.slice();
      ['R', 'L'].forEach(function (k) { if (H.hand[k] && !H.fixHand) H.hand[k] = [H.hand[k][0] + dd[0], H.hand[k][1] + dd[1]]; });
      if (faceDir === 'front') {   /* walking toward you: knees lift in turn, no side stride */
        H.pos = p; H.str = null; var ph2 = dist * u / step * Math.PI, s2 = Math.sin(ph2); H.legs.R = Math.max(0, s2) * .7 * fade; H.legs.L = Math.max(0, -s2) * .7 * fade; H.bob = -Math.abs(s2) * 1.1 * (H.bounce || 1) * H.s / .5 * fade; H.turn = lerp(t0, endTurn || 0, u);
        if (!H.hand.R) H.rot.R = [-s2 * 12 * fade, -8 * fade]; if (!H.hand.L) H.rot.L = [-s2 * 12 * fade, 8 * fade]; if (H.onStep) H.onStep(); return;
      }
      H.pos = p; H.turn = lerp(u < .5 ? t0 : (endTurn || 0), faceDir || dir, fade);
      H.str = [-dir * 24 * sn * fade, dir * 42 * Math.max(0, cs) * fade, dir * 24 * sn * fade, dir * 42 * Math.max(0, -cs) * fade];
      H.bob = Math.abs(sn) * 1.3 * (H.bounce || 1) * H.s / .5 * fade;
      if (!H.hand.R) H.rot.R = [dir * 22 * sn * fade, -dir * 18 * fade]; if (!H.hand.L) H.rot.L = [-dir * 22 * sn * fade, -dir * 18 * fade];
      H.lean = (faceDir || dir) * 3 * fade; if (H.onStep) H.onStep();
    }).then(function () { H.str = null; H.turn = endTurn || 0; H.legs.R = H.legs.L = 0; H.bob = 0; H.lean = 0; H.rot.R = [0, 0]; H.rot.L = [0, 0]; });
  }
  function turnTo(R, H, v, ms) {   /* v: 'front' | 'back' | a number −1…1 (three-quarter toward left/right) */
    ms = ms || 320; var t0 = H.turn, t1 = typeof v === 'number' ? v : 0, swap = (v === 'back') !== (H.view === 'back');
    return tw(R, ms, function (u) {
      H.turn = lerp(t0, t1, ease(u));
      if (swap) { H.sq = 1 - .45 * Math.sin(u * Math.PI); if (u >= .5 && (v === 'back') !== (H.view === 'back')) { H.view = v === 'back' ? 'back' : 'front'; Rig.back(H.rig, H.view === 'back', H.look); } }
    }).then(function () { H.sq = 1; H.turn = t1; if (Math.abs(t1) < .01) H.turn = 0; });
  }
  /* move a hand to a point in the picture (or back to rest with null) */
  function reach(R, H, side, P, ms) {
    var from = H.hand[side] || handAt(H, side), to = P || restHand(H, side);
    if (!P) Rig.rot(H.rig[side], H.rot[side][0], H.rot[side][1]);
    return tw(R, ms || 500, function (u) { var e = ease(u); H.hand[side] = [lerp(from[0], to[0], e), lerp(from[1], to[1], e)]; }).then(function () { if (!P) H.hand[side] = null; });
  }
  function both(R, H, a, b, ms) { return Promise.all([reach(R, H, 'L', a, ms), reach(R, H, 'R', b, ms)]); }
  function headTo(R, H, r, y, ms) { var a = H.head.slice(); return tw(R, ms || 350, function (u) { var e = ease(u); H.head = [lerp(a[0], r, e), lerp(a[1], y || 0, e)]; }); }
  function prop(R, H, k, v, ms) { var a = H[k]; return tw(R, ms || 400, function (u) { H[k] = lerp(a, v, ease(u)); }); }
  function pos(R, H, to, ms) { var a = H.pos.slice(); return tw(R, ms || 400, function (u) { var e = ease(u); H.pos = [lerp(a[0], to[0], e), lerp(a[1], to[1], e)]; }); }
  function legs(R, H, r, l, sr, sl, ms) { var a = Object.assign({}, H.legs); return tw(R, ms || 400, function (u) { var e = ease(u); H.legs.R = lerp(a.R, r, e); H.legs.L = lerp(a.L, l, e); H.legs.sR = lerp(a.sR, sr || 0, e); H.legs.sL = lerp(a.sL, sl || 0, e); }); }
  function face(H, e) {
    var b = H.rig.head; if (!b) return; H.faceNow = e; if (!H.faces[e]) { var d = document.createElement('div'); d.innerHTML = Avatar.figure({ k: 'plain', plain: true, bg: '#000', sky: 'none' }, Object.assign({}, H.look, { expr: e })); var x = d.querySelector('.bob'); H.faces[e] = x ? x.innerHTML : ''; }
    if (H.faces[e]) b.innerHTML = H.faces[e];
    if (H.rig.t) Rig.turn(H.rig, H.rig.t);
    if (H.view === 'back') Rig.back(H.rig, true, H.look);
  }
  /* rest: everything back to standing */
  function settle(R, H, ms) { return Promise.all([turnTo(R, H, 'front', ms), reach(R, H, 'R', null, ms), reach(R, H, 'L', null, ms), headTo(R, H, 0, 0, ms), legs(R, H, 0, 0, 0, 0, ms), prop(R, H, 'lean', 0, ms), prop(R, H, 'bob', 0, ms)]); }
  /* speech bubble above the head */
  function say(H, txt, ms) {
    var hx = H.pos[0], hy = H.pos[1] - 150 * H.s - 4, w = Math.max(24, txt.length * 4.6 + 12), x = Math.max(3, Math.min(237 - w, hx - w / 2)), y = Math.max(2, hy - 14);
    var g = el('g', { class: 'bub' }, '<rect width="' + w + '" height="14" rx="7" fill="#fff"/><path d="M' + Math.min(w - 6, Math.max(6, hx - x)) + ' 13l-1 5 6-5z" fill="#fff"/><text x="' + (w / 2) + '" y="10" text-anchor="middle" font-size="7.6" font-weight="800" fill="#1d2030" font-family="Inter,system-ui,sans-serif"></text>');
    g.querySelector('text').textContent = txt; g.setAttribute('transform', 'translate(' + x + ' ' + y + ')'); H.svg.appendChild(g);
    g.animate([{ opacity: 0 }, { opacity: 1, offset: .1 }, { opacity: 1, offset: .88 }, { opacity: 0 }], { duration: ms || 1600 }).onfinish = function () { g.remove(); };
  }
  function star() { return '<path d="M0 -4l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2z" fill="' + ['#ffd34d', '#ff8fb1', '#8fd0ff'][Math.floor(Math.random() * 3)] + '"/>'; }
  function burst(svg, P, n, inner) { for (var i = 0; i < (n || 6); i++) (function () { var g = el('g', {}, (inner || star)()); svg.appendChild(g); var dx = rnd(-14, 14), dy = rnd(-18, -6); g.animate([{ transform: 'translate(' + P[0] + 'px,' + P[1] + 'px) scale(.3)', opacity: 1 }, { transform: 'translate(' + (P[0] + dx) + 'px,' + (P[1] + dy) + 'px) scale(1)', opacity: 1, offset: .55 }, { transform: 'translate(' + (P[0] + dx * 1.2) + 'px,' + (P[1] + dy + 8) + 'px)', opacity: 0 }], { duration: 850, easing: 'ease-out' }).onfinish = function () { g.remove(); }; })(); }
  function drops(svg, P, n) { for (var i = 0; i < n; i++) (function (i) { setTimeout(function () { var g = el('g', {}, '<path d="M0 0q-2 3 0 4.5q2-1.5 0-4.5z" fill="#8fd0ff"/>'); svg.appendChild(g); g.animate([{ transform: 'translate(' + P[0] + 'px,' + P[1] + 'px)', opacity: 1 }, { transform: 'translate(' + (P[0] + rnd(2, 6)) + 'px,' + (P[1] + 12) + 'px)', opacity: 0 }], { duration: 700, easing: 'ease-in' }).onfinish = function () { g.remove(); }; }, i * 260); })(i); }
  function flash(svg) { var r = el('rect', { width: 240, height: 150, fill: '#fff' }); svg.appendChild(r); r.animate([{ opacity: .55 }, { opacity: 0 }], { duration: 350 }).onfinish = function () { r.remove(); }; }
  function wob(e, deg, ms, origin) { if (!e) return; e.style.transformBox = 'fill-box'; e.style.transformOrigin = origin || '50% 100%'; e.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(' + -deg + 'deg)' }, { transform: 'rotate(' + deg + 'deg)' }, { transform: 'rotate(0)' }], { duration: ms || 300, easing: 'ease-in-out' }); }

  /* the brain: pick an action, play it, settle, rest, pick another; tapping you interrupts */
  function brain(R, H, acts, poke, label) {
    var last = null; label = label || function () {};
    function go() {
      if (still() || (R.alive && !R.alive())) return;
      var all = acts(), pool = all.filter(function (a) { return a.n !== last; }); if (!pool.length) pool = all; if (!pool.length) return;
      /* actions can weigh more when the data makes them fitting (payday close, …) */
      var tot = pool.reduce(function (s, a) { return s + (a.w || 1); }, 0), r = Math.random() * tot, a = pool[0];
      for (var i = 0; i < pool.length; i++) { r -= pool[i].w || 1; if (r <= 0) { a = pool[i]; break; } }
      last = a.n;
      label(a.t); var tok = R.tok;
      a.f().then(function () { if (R.tok !== tok) return; label('looking around'); face(H, 'smile'); return settle(R, H, 450).then(function () { var lv = lively(); return idle(R, H, lv === 'calm' ? rnd(4000, 8000) : lv === 'lively' ? rnd(400, 1000) : rnd(900, 2200)); }); }).then(function () { if (R.tok === tok) go(); });
    }
    H.wrap.addEventListener('click', function (ev) { ev.stopPropagation(); R.tok++; clear(H); var tok = R.tok; label('giggling'); poke().then(function () { if (R.tok !== tok) return; return settle(R, H, 400); }).then(function () { if (R.tok === tok) { label('looking around'); face(H, 'smile'); setTimeout(function () { if (R.tok === tok) go(); }, 900); } }); });
    setTimeout(go, rnd(300, 1200));
  }
  /* resting: look around a bit, shift weight */
  function idle(R, H, ms) { return tw(R, ms, function (u) { var t = u * ms / 1000; H.head = [Math.sin(t * 1.3) * 3, 0]; H.legs.R = Math.max(0, Math.sin(t * .9)) * .08; }); }
  function jump(R, H) { face(H, 'laugh'); say(H, NB ? 'Hihi!' : 'Hehe!', 1200); return Promise.all([tw(R, 700, function (u) { var j = Math.sin(u * Math.PI); H.bob = -j * 12 * H.s / .5; H.legs.R = H.legs.L = j * .55; H.rot.R = [-150 * j, -20 * j]; H.rot.L = [150 * j, 20 * j]; })]); }

  window.Live = { clear: clear, still: still, Hero: Hero, Run: Run, tw: tw, wait: wait, walk: walk, reach: reach, both: both, headTo: headTo, prop: prop, pos: pos, legs: legs, face: face, settle: settle, say: say, burst: burst, drops: drops, flash: flash, wob: wob, brain: brain, idle: idle, turnTo: turnTo, Obj: Obj, objPoint: objPoint, letGo: letGo, jump: jump, handAt: handAt, el: el, ease: ease, lerp: lerp, rnd: rnd };
})();
