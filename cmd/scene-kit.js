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
    H.body = H.wrap.querySelector('.hero-body');
    /* a pet from the maker stays on the ground where you started (it doesn't climb or jump with you) */
    var pet0 = H.wrap.querySelector('.hero-body .av-pet');
    if (pet0) { var ps = H.wrap.querySelector('.hero-body > svg').cloneNode(false); ps.setAttribute('class', 'hero-pet'); ps.setAttribute('overflow', 'visible'); ps.style.overflow = 'visible'; ps.appendChild(pet0); H.wrap.insertBefore(ps, H.body); H.pet = ps; } H.sh = H.wrap.querySelector('.hero-sh'); H.fig = H.wrap.querySelector('.hero-body > svg');
    H.rig = Rig(H.fig, H.look);
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
    /* the fingers close over the front of what it holds (round 3): a small grip in skin colour on top of the thing at
       its grip point, the same size whatever the thing's scale; hidden when it's put down or seen from behind */
    if (!opt.nogrip) { var sk = (H.look && H.look.skin) || '#c68a5a', w = 3.6 / o.sc, h = 2.8 / o.sc, gx = o.grip[0], gy = o.grip[1];
      o.fg = el('g', { class: 'obj-grip' }, '<rect x="' + (gx - w / 2).toFixed(2) + '" y="' + (gy - h / 2).toFixed(2) + '" width="' + w.toFixed(2) + '" height="' + h.toFixed(2) + '" rx="' + (h * .45).toFixed(2) + '" fill="' + sk + '" stroke="rgba(0,0,0,.22)" stroke-width="' + (.35 / o.sc).toFixed(2) + '"/><path d="M' + (gx - w / 6).toFixed(2) + ' ' + (gy - h * .3).toFixed(2) + 'v' + (h * .6).toFixed(2) + 'M' + (gx + w / 6).toFixed(2) + ' ' + (gy - h * .3).toFixed(2) + 'v' + (h * .6).toFixed(2) + '" stroke="rgba(0,0,0,.2)" stroke-width="' + (.3 / o.sc).toFixed(2) + '"/>'); g.appendChild(o.fg); }
    H.objs[side] = o; g.setAttribute('transform', objXf(H, o, handAt(H, side))); H.layF.appendChild(g);   /* in the hand from the first frame (it flashed in the corner for one frame) */ if (window.Rig && Rig.stow) Rig.stow(H.rig, true); return o;   /* the maker's own held things are put away meanwhile */
  }
  function objXf(H, o, P) { var k = H.s / .5 * (H.k || 1) * o.sc; return 'translate(' + P[0].toFixed(2) + ' ' + P[1].toFixed(2) + ') scale(' + k.toFixed(3) + ') rotate(' + o.rot.toFixed(2) + ') scale(' + (o.flip ? -1 : 1) + ' 1) translate(' + (-o.grip[0]) + ' ' + (-o.grip[1]) + ')'; }
  /* a point on a held thing (like the tip of a spout), in the picture */
  function objPoint(H, o, lp) { var P = o.free || handAt(H, o.side), k = H.s / .5 * (H.k || 1) * o.sc, x = (lp[0] - o.grip[0]) * (o.flip ? -1 : 1), y = lp[1] - o.grip[1], a = o.rot * Math.PI / 180; return [P[0] + k * (x * Math.cos(a) - y * Math.sin(a)), P[1] + k * (x * Math.sin(a) + y * Math.cos(a))]; }
  function letGo(H, side) { var o = H.objs[side]; if (o) { o.g.remove(); delete H.objs[side]; } if (!H.objs.R && !H.objs.L && window.Rig && Rig.stow) Rig.stow(H.rig, false); }
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
    /* the head leads a turn: it points where the body is going a moment before the body gets there */
    var tv = H.turn - (H.pt == null ? H.turn : H.pt); H.pt = H.turn;
    H.ht = H.ht == null ? H.turn : H.ht + (Math.max(-1, Math.min(1, H.turn + tv * 9)) - H.ht) * .35;
    if (Math.abs(H.turn) > .01 || Math.abs(H.ht) > .01 || H.rig.t) Rig.turn(H.rig, Math.abs(H.turn) > .01 ? H.turn : 0, Math.abs(H.ht) > .01 ? H.ht : 0);
    /* long hair and ponytails swing after you move, then settle */
    var vx = H.pos[0] - (H.px == null ? H.pos[0] : H.px), vy = H.pos[1] - (H.py == null ? H.pos[1] : H.py); H.px = H.pos[0]; H.py = H.pos[1];
    H.swv = (H.swv || 0) * .86 + (-vx * 9 - (H.bob - (H.pb || 0)) * 2) * .14; H.pb = H.bob; H.sw = (H.sw || 0) + (H.swv - (H.sw || 0)) * .2;
    if (H.rig.head) H.rig.head.querySelectorAll('.av-swing').forEach(function (e) { if (!e._piv) { try { var bb = e.getBBox(); e._piv = [bb.x + bb.width / 2, bb.y]; } catch (er) { e._piv = [101, 50]; } } e.setAttribute('transform', 'rotate(' + Math.max(-18, Math.min(18, H.sw)).toFixed(2) + ' ' + e._piv[0].toFixed(1) + ' ' + e._piv[1].toFixed(1) + ')'); });
    /* what hangs from the neck (card, medal, tie, pendant) stays upright when it leans and swings after a move; a
       skirt or dress hem sways the same way, less */
    if (!H.dg || (H.dg[0] && !H.dg[0].isConnected)) H.dg = [].slice.call(H.fig.querySelectorAll('.av-dangle, .av-hem'));
    H.dg.forEach(function (e) {
      if (!e._piv) { try { var bb = e.getBBox(); e._piv = [bb.x + bb.width / 2, bb.y]; } catch (er) { e._piv = [101, 88]; } }
      var hem = e.classList.contains('av-hem'), a = hem ? Math.max(-7, Math.min(7, H.sw * .35)) : Math.max(-24, Math.min(24, -H.lean * .85 + H.sw * .6));
      e.setAttribute('transform', Math.abs(a) < .05 ? '' : 'rotate(' + a.toFixed(2) + ' ' + e._piv[0].toFixed(1) + ' ' + e._piv[1].toFixed(1) + ')');
    });
    if (H.str) { Rig.stride(H.rig.LR, H.str[0], H.str[1]); Rig.stride(H.rig.LL, H.str[2], H.str[3]); }
    else { Rig.leg(H.rig.LR, H.legs.R, H.legs.sR); Rig.leg(H.rig.LL, H.legs.L, H.legs.sL); }
    /* eyes and face follow what you're doing */
    var lx = 0, ly = 0, ht = 0;
    if (H.gaze && H.view !== 'back') { var hc = [H.pos[0], H.pos[1] - 100 * H.s * (H.k || 1)], dx = H.gaze[0] - hc[0], dy = H.gaze[1] - hc[1], d = Math.hypot(dx, dy) || 1; lx = dx / d * 2.4; ly = dy / d * 1.6; ht = dx / d * 3; }
    H.lk = H.lk || [0, 0, 0]; H.lk = [lerp(H.lk[0], lx, .15), lerp(H.lk[1], ly, .15), lerp(H.lk[2], ht, .15)];
    var tt = Math.abs(H.turn) > .01 ? H.turn : 0;
    var vw = Rig.view ? Rig.view(H.rig) : 'front';
    if (vw === 'front' || /^q/.test(vw)) H.fig.querySelectorAll('.bob .av-feat').forEach(function (e) { e.setAttribute('transform', 'translate(' + (5.5 * (H.ht == null ? tt : H.ht) + H.lk[0]).toFixed(2) + ' ' + H.lk[1].toFixed(2) + ')'); });
    if (H.rig.head) H.rig.head.setAttribute('transform', 'rotate(' + (H.head[0] + H.lk[2]).toFixed(2) + ' 101 80) translate(0 ' + H.head[1].toFixed(2) + ')');
    /* held things */
    Object.keys(H.objs).forEach(function (k) { var o = H.objs[k], want = o.layer === 'front' ? H.layF : o.layer === 'back' ? H.layB : (H.view === 'back' || (Math.abs(H.turn) > .8 && k === (H.turn > 0 ? 'R' : 'L')) ? H.layB : H.layF);   /* side-on, the far arm is behind the body – and so is what that hand holds (the milk floated on the chest, 2026-11-11) */ if (o.g.parentNode !== want) want.appendChild(o.g); o.g.style.opacity = H.op; if (o.fg) o.fg.style.display = o.free || H.view === 'back' ? 'none' : ''; o.g.setAttribute('transform', objXf(H, o, o.free || handAt(H, k))); });
  }
  /* the loop can be stopped from outside: an instant page change drops the animation frames of the page you leave
     (softnav.js), and this engine outlives the page. So it notes when it last drew, and wake() starts it again
     whenever it has gone quiet – every tween calls wake(), so a frozen avatar can't happen */
  var running = false, lastFrame = 0;
  function loop(t) {
    lastFrame = performance.now();
    HEROES = HEROES.filter(function (H) { return H.svg.isConnected && !H.dead; });
    if (!HEROES.length) { running = false; return; }
    if (!document.hidden) HEROES.forEach(function (H) { try { render(H, t); } catch (e) { H.dead = true; if (window.Diag && Diag.log) Diag.log('error', 'scene: ' + (e && e.message), 'scene-kit.js'); } });
    requestAnimationFrame(loop);
  }
  function wake() { if (!running || performance.now() - lastFrame > 300) { running = true; lastFrame = performance.now(); requestAnimationFrame(loop); } }

  /* ---------- scripting ---------- */
  function Run(scene) { return { sc: scene, tok: 0 }; }
  /* PACE: how fast everything plays (1 = normal); the staging test plays the actions faster */
  var PACE = 1;
  function tw(R, ms, f) { ms = ms / PACE; var tok = R.tok; return new Promise(function (res) { var t0 = performance.now(); (function fr(now) { if (R.tok !== tok || (R.alive && !R.alive())) return; wake(); if (document.hidden) { t0 += 16; requestAnimationFrame(fr); return; } var u = Math.min(1, (now - t0) / ms); f(u); if (u < 1) requestAnimationFrame(fr); else res(); })(t0); }); }
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
      /* arms swing opposite the legs, relaxed: the forearm trails a little and bends more on the forward swing */
      var lagR = Math.sin(ph - .5), lagL = -lagR;
      if (!H.hand.R) H.rot.R = [dir * 20 * sn * fade, -dir * (10 + 10 * Math.max(0, lagR)) * fade]; if (!H.hand.L) H.rot.L = [-dir * 20 * sn * fade, -dir * (10 + 10 * Math.max(0, lagL)) * fade];
      H.lean = (faceDir || dir) * 3 * fade; if (H.onStep) H.onStep();
    }).then(function () { H.str = null; H.turn = endTurn || 0; H.legs.R = H.legs.L = 0; H.bob = 0; H.lean = 0; H.rot.R = [0, 0]; H.rot.L = [0, 0]; });
  }
  function turnTo(R, H, v, ms) {   /* v: 'front' | 'back' | a number −1…1 (three-quarter toward left/right) */
    ms = ms || 320; var t0 = H.turn, t1 = typeof v === 'number' ? v : 0, swap = (v === 'back') !== (H.view === 'back');
    /* turning around goes through the side, as a person does: front → three-quarter → side → back (or back again) */
    var via = t0 > .05 ? 1 : t0 < -.05 ? -1 : (H.lastDir || 1);
    if (swap) ms = Math.max(ms, 420);
    return tw(R, ms, function (u) {
      if (!swap) { H.turn = lerp(t0, t1, ease(u)); return; }
      if (u < .5) { var a = ease(u * 2); H.turn = lerp(t0, via, a); H.ht = lerp(t0, via, Math.min(1, a * 1.3)); }
      else {
        if ((v === 'back') !== (H.view === 'back')) { H.view = v === 'back' ? 'back' : 'front'; Rig.back(H.rig, H.view === 'back', H.look); }
        H.turn = lerp(via, t1, ease((u - .5) * 2));
      }
    }).then(function () { H.sq = 1; H.turn = t1; if (Math.abs(t1) < .01) H.turn = 0; if (t1) H.lastDir = t1 > 0 ? 1 : -1; });
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
    var was = Rig.view ? Rig.view(H.rig) : 'front';
    if (H.faces[e]) { if (was !== 'front') { b.innerHTML = H.faces[e]; Rig.refresh(H.rig); H.rig.hv = null; } else { b.innerHTML = H.faces[e]; Rig.refresh(H.rig); } }
    if (H.rig.t || H.ht) Rig.turn(H.rig, H.rig.t || 0, H.ht || 0);
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
      if (R.paused) return;
      label(a.t); var tok = R.tok, pr; R.busy = true;
      /* an action that fails (something it needs isn't in today's picture) is dropped, and the next one is picked */
      var failed = function (e) { a.bad = true; if (window.Diag && Diag.log) Diag.log('scene', 'action ' + a.n + ': ' + (e && e.message), 'scene-kit.js'); if (R.tok !== tok) return; clear(H); H.view === 'back' && Rig.back(H.rig, false, H.look); H.view = 'front'; };
      try { pr = Promise.resolve(a.f()); } catch (e) { pr = Promise.reject(e); }
      R.cur = pr.catch(failed).then(function () { R.busy = false; }); R.cur.then(function () { if (R.tok !== tok || R.paused) return; label('looking around'); face(H, 'smile'); return settle(R, H, 450).then(function () { var lv = lively(); return idle(R, H, lv === 'calm' ? rnd(4000, 8000) : lv === 'lively' ? rnd(400, 1000) : rnd(900, 2200)); }); }).then(function () { if (R.tok === tok) go(); });
    }
    /* a tap: busy with something → you laugh and say something, but keep hold of what you're doing (an action broken
       off halfway would leave a coin in the air or a door open); resting → you jump */
    H.wrap.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (R.busy || R.paused) { var was = H.faceNow; face(H, 'laugh'); say(H, NB ? 'Hihi!' : 'Hehe!', 1100); setTimeout(function () { if (H.faceNow === 'laugh') face(H, was || 'smile'); }, 900); return; }
      R.tok++; var tok = R.tok; label('giggling');
      poke().then(function () { if (R.tok !== tok) return; return settle(R, H, 400); }).then(function () { if (R.tok === tok) { label('looking around'); face(H, 'smile'); setTimeout(function () { if (R.tok === tok) go(); }, 900); } });
    });
    setTimeout(go, rnd(300, 1200));
  }
  /* points on the body, in the picture: where the mouth is (to drink), the chest (to hold something in front of you),
     the top of the head. Measured from the drawing (avatar units: feet at 160, mouth at 66 since the new body),
     scaled with the avatar and its depth, and shifted the way the head is turned */
  function bodyAt(H, ux, uy) { var k = H.s * (H.k || 1), t = H.ht == null ? H.turn : H.ht; return [H.pos[0] + (ux + 5.5 * t) * k, H.pos[1] + H.bob - H.lift + (uy - 160) * k]; }   /* bob > 0 is a crouch: the body goes down */
  function mouth(H) { return bodyAt(H, 0, 66); }
  function chest(H) { return bodyAt(H, 0, 98); }
  /* drink from what the hand holds: up to the mouth, tilt it, head back a little, down again */
  function drink(R, H, side, o, ms, tilt) {
    side = side || H.main || 'R'; var m = mouth(H), s = side === 'R' ? 1 : -1; tilt = tilt || 38;   /* a bottle tips further than a cup */
    return reach(R, H, side, [m[0] + s * 2 * H.s, m[1] + 3 * H.s], 500)
      .then(function () { return Promise.all([headTo(R, H, -s * 4, -1.5, 350), tw(R, 350, function (u) { if (o) o.rot = -s * tilt * ease(u); })]); })
      .then(function () { return wait(R, ms || 800); })
      .then(function () { return Promise.all([headTo(R, H, 0, 0, 300), tw(R, 300, function (u) { if (o) o.rot = -s * tilt * (1 - ease(u)); })]); });
  }
  /* a wave, the way people do it: the upper arm goes up and out to the side, the forearm points up, the hand is
     above the head and swings from the elbow; the head tilts a little toward it. side 'R'/'L', default the hand
     you use (the maker's left- or right-handed) */
  function wave(R, H, side, ms) {
    side = side || H.main || 'R'; ms = ms || 1600; var s = side === 'R' ? 1 : -1, other = side === 'R' ? 'L' : 'R';
    H.hand[side] = null;
    return tw(R, ms, function (u) {
      var up = Math.min(1, u / .18), down = Math.min(1, (1 - u) / .14), k = ease(Math.min(up, down));
      var sw = Math.sin((u * ms / 1000) * Math.PI * 4.2) * 24 * Math.min(1, up * 1.5) * down;
      H.rot[side] = [-s * 112 * k, -s * (62 * k + sw * k)];
      if (!H.hand[other]) H.rot[other] = [s * 4 * k, 0];
      H.head = [s * 5 * k, 0]; H.lean = -s * 1.5 * k;
    }).then(function () { H.rot[side] = [0, 0]; H.head = [0, 0]; H.lean = 0; });
  }
  /* resting: look around a bit, shift weight */
  function idle(R, H, ms) { return tw(R, ms, function (u) { var t = u * ms / 1000; H.head = [Math.sin(t * 1.3) * 3, 0]; H.legs.R = Math.max(0, Math.sin(t * .9)) * .08; }); }
  function jump(R, H) { face(H, 'laugh'); say(H, NB ? 'Hihi!' : 'Hehe!', 1200); return tw(R, 220, function (u) { var c = Math.sin(u * Math.PI / 2); H.bob = c * 3 * H.s / .5; H.legs.R = H.legs.L = c * .35; H.rot.R = [12 * c, 0]; H.rot.L = [-12 * c, 0]; })   /* crouch: bend before jumping */
      .then(function () { return tw(R, 620, function (u) { var j = Math.sin(u * Math.PI); H.bob = (3 * (1 - u) * (1 - u) - j * 12) * H.s / .5; H.legs.R = H.legs.L = j * .55; H.rot.R = [-150 * j, -20 * j]; H.rot.L = [150 * j, 20 * j]; }); })
      .then(function () { return tw(R, 200, function (u) { var c = Math.sin(u * Math.PI); H.bob = c * 2 * H.s / .5; H.legs.R = H.legs.L = c * .25; }); });   /* soft landing */ }

  window.Live = { pace: function (x) { PACE = Math.max(.25, Math.min(8, +x || 1)); }, bodyAt: bodyAt, mouth: mouth, chest: chest, drink: drink, wave: wave, clear: clear, still: still, Hero: Hero, Run: Run, tw: tw, wait: wait, walk: walk, reach: reach, both: both, headTo: headTo, prop: prop, pos: pos, legs: legs, face: face, settle: settle, say: say, burst: burst, drops: drops, flash: flash, wob: wob, brain: brain, idle: idle, turnTo: turnTo, Obj: Obj, objPoint: objPoint, letGo: letGo, jump: jump, handAt: handAt, el: el, ease: ease, lerp: lerp, rnd: rnd };
})();
