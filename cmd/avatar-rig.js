/* The rig (Phase L2): poses the real avatar drawing (avatar.js) – one component, used by the living scenes and the
   avatar page. It never redraws the look; it moves the parts avatar.js already drew:
     arms   .av-limb (upper arm, forearm, elbow; data-s shoulder, data-e elbow, data-w wrist, data-h where the hand
            was drawn, data-l the two lengths) and .av-hand (the mitten .av-mit plus anything held)
     legs   .av-legL / .av-legR (redrawn once as thigh + shin with a knee, same colour and width, shoe on the ankle)
     turn   the torso narrows, legs and arms move in, the far arm goes behind; features (.av-feat) and front hair
            (.av-hairf) shift the way it faces
     back   features and the chest print hidden, the back of the head in hair colour (skin when bald), arms behind
   Rig(svg) returns handles; Rig.reach / rot / leg / stride / turn / back pose them. Coordinates are the avatar's own
   (0–200 picture), each arm in its group's space. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', D = 180 / Math.PI;
  function E(tag, at) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); return e; }
  function pt(s) { var a = String(s || '').split(' ').map(Number); return [a[0] || 0, a[1] || 0]; }
  function f2(n) { return (Math.round(n * 100) / 100).toString(); }

  function armRig(g, side) {
    if (!g) return null;
    var limb = g.querySelector('.av-limb'), hand = g.querySelector('.av-hand'); if (!limb || !hand) return null;
    var S = pt(limb.getAttribute('data-s')), El = pt(limb.getAttribute('data-e')), W = pt(limb.getAttribute('data-w')), Hd = pt(limb.getAttribute('data-h')), ls = pt(limb.getAttribute('data-l'));
    var paths = limb.querySelectorAll('path'), circles = limb.querySelectorAll('circle'), joint = circles[circles.length - 1];
    var A = { g: g, limb: limb, hand: hand, S: S, El: El, W: W, Hd: Hd, L1: ls[0] || 23, L2: ls[1] || 21, side: side === 'R' ? 1 : -1,
      out: paths[0], up: paths[1], lo: paths[2], mus: paths[3] || null, joint: joint };
    A.r1 = Math.atan2(El[1] - S[1], El[0] - S[0]); A.r2 = Math.atan2(W[1] - El[1], W[0] - El[0]);
    A.cur = { El: El.slice(), W: W.slice() };
    return A;
  }
  /* draw the arm with the elbow at e and the wrist at w */
  function pose(A, e, w) {
    var S = A.S, up = 'M' + f2(S[0]) + ' ' + f2(S[1]) + 'L' + f2(e[0]) + ' ' + f2(e[1]), lo = 'M' + f2(e[0]) + ' ' + f2(e[1]) + 'L' + f2(w[0]) + ' ' + f2(w[1]);
    A.out.setAttribute('d', 'M' + f2(S[0] + (e[0] - S[0]) * .35) + ' ' + f2(S[1] + (e[1] - S[1]) * .35) + 'L' + f2(e[0]) + ' ' + f2(e[1]) + 'L' + f2(w[0]) + ' ' + f2(w[1])); A.up.setAttribute('d', up); A.lo.setAttribute('d', lo); if (A.mus) A.mus.setAttribute('d', up);
    if (A.joint) { A.joint.setAttribute('cx', f2(e[0])); A.joint.setAttribute('cy', f2(e[1])); }
    /* the hand (and what it holds) follows the wrist and turns with the forearm */
    var da = (Math.atan2(w[1] - e[1], w[0] - e[0]) - A.r2) * D, h = A.Hd;
    A.hand.setAttribute('transform', 'translate(' + f2(w[0]) + ' ' + f2(w[1]) + ') rotate(' + f2(da) + ') translate(' + f2(-h[0]) + ' ' + f2(-h[1]) + ')');
    A.cur = { El: e, W: w };
  }
  function legRig(g, side) {
    if (!g) return null;
    var scg = g.querySelector(':scope > g'); if (!scg) return null;
    var path = scg.querySelector('path'), bb = path.getBBox(), col = path.getAttribute('fill');
    var m = scg.transform.baseVal.consolidate(), my = m ? m.matrix : { d: 1, f: 0 };
    var Y = function (y) { return my.d * y + my.f; };
    var shoe = [].slice.call(g.childNodes).filter(function (n) { return n !== scg; });
    var top = Y(bb.y), bot = Y(bb.y + bb.height), knee = (top + bot) / 2 + 1, a = bb.x, LW = bb.width, LB = LW * .8, cx = a + LW / 2;
    g.innerHTML = '';
    var th = E('g', {}), sh = E('g', {});
    th.appendChild(E('path', { d: 'M' + f2(a) + ' ' + f2(top) + 'H' + f2(a + LW) + 'L' + f2(cx + LW * .46) + ' ' + f2(knee + 1) + 'H' + f2(cx - LW * .46) + 'Z', fill: col }));
    sh.appendChild(E('path', { d: 'M' + f2(cx - LW * .46) + ' ' + f2(knee - 1) + 'H' + f2(cx + LW * .46) + 'L' + f2(cx + LB / 2) + ' ' + f2(bot) + 'H' + f2(cx - LB / 2) + 'Z', fill: col }));
    sh.appendChild(E('ellipse', { cx: f2(cx), cy: f2(knee), rx: f2(LW * .46), ry: '1.6', fill: col }));
    var sg = E('g', {}); shoe.forEach(function (n) { sg.appendChild(n); }); sh.appendChild(sg);
    g.appendChild(th); g.appendChild(sh);
    return { g: g, th: th, sh: sh, shoe: sg, cx: cx, hip: [cx, top], knee: [cx, knee], len: knee - top, side: side === 'R' ? 1 : -1 };
  }

  function Rig(fig) {
    return { fig: fig, R: armRig(fig.querySelector('.av-armR'), 'R'), L: armRig(fig.querySelector('.av-armL'), 'L'),
      LR: legRig(fig.querySelector('.av-legR'), 'R'), LL: legRig(fig.querySelector('.av-legL'), 'L'), head: fig.querySelector('.bob'), t: 0 };
  }
  /* a hand to point T (in the arm's own coordinates); bend picks the elbow side (1 = outward) */
  Rig.reach = function (A, T, bend) {
    if (!A) return;
    var P = A.S, dx = T[0] - P[0], dy = T[1] - P[1], d = Math.hypot(dx, dy), L1 = A.L1, L2 = A.L2;
    /* a hand close to the body: a person's elbow goes back or forward (in depth), it doesn't flare out sideways.
       Seen from the front that makes the arm look shorter, so both parts are drawn shorter (down to 55 %) and the
       elbow keeps a soft bend */
    var f = Math.max(.55, Math.min(1, d / (.82 * (L1 + L2)))); L1 *= f; L2 *= f;
    d = Math.max(Math.abs(L1 - L2) + .5, Math.min(L1 + L2 - .05, d));
    var th = Math.atan2(dy, dx), al = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    var a1 = th - (bend || 1) * A.side * al, e = [P[0] + L1 * Math.cos(a1), P[1] + L1 * Math.sin(a1)];
    pose(A, e, [P[0] + d * Math.cos(th), P[1] + d * Math.sin(th)]);
  };
  /* turn the upper arm by r1 degrees and the forearm by r2 more, from how it was drawn */
  Rig.rot = function (A, r1, r2) {
    if (!A) return;
    var a1 = A.r1 + (r1 || 0) / D, a2 = A.r2 + ((r1 || 0) + (r2 || 0)) / D, e = [A.S[0] + A.L1 * Math.cos(a1), A.S[1] + A.L1 * Math.sin(a1)];
    var l2 = Math.hypot(A.W[0] - A.El[0], A.W[1] - A.El[1]);
    pose(A, e, [e[0] + l2 * Math.cos(a2), e[1] + l2 * Math.sin(a2)]);
  };
  /* where the wrist is now, in the arm's coordinates */
  Rig.wrist = function (A) { return A ? A.cur.W.slice() : [0, 0]; };
  /* a leg seen from the front: lift 0–1 brings the knee toward you; splay turns it out */
  Rig.leg = function (G, lift, splay) {
    if (!G) return;
    lift = Math.max(0, Math.min(1, lift || 0)); splay = splay || 0;
    var k = 1 - .55 * lift, h = G.hip, a = splay / D;
    G.th.setAttribute('transform', 'translate(' + f2(h[0]) + ' ' + f2(h[1]) + ') rotate(' + f2(splay) + ') scale(1 ' + f2(k) + ') translate(' + f2(-h[0]) + ' ' + f2(-h[1]) + ')');
    var kx = h[0] - Math.sin(a) * G.len * k, ky = h[1] + Math.cos(a) * G.len * k;
    G.sh.setAttribute('transform', 'translate(' + f2(kx - G.knee[0]) + ' ' + f2(ky - G.knee[1]) + ') rotate(' + f2(-splay * .6 + G.side * lift * 6) + ' ' + f2(G.knee[0]) + ' ' + f2(G.knee[1]) + ')');
  };
  /* a leg seen from the side: the hip swings the thigh, the knee bends the shin back */
  Rig.stride = function (G, hip, knee) {
    if (!G) return;
    var h = G.hip, a = hip / D, L = G.len;
    G.th.setAttribute('transform', 'rotate(' + f2(hip) + ' ' + f2(h[0]) + ' ' + f2(h[1]) + ')');
    var kx = h[0] - Math.sin(a) * L, ky = h[1] + Math.cos(a) * L;
    G.sh.setAttribute('transform', 'translate(' + f2(kx - G.knee[0]) + ' ' + f2(ky - G.knee[1]) + ') rotate(' + f2(hip + knee) + ' ' + f2(G.knee[0]) + ' ' + f2(G.knee[1]) + ')');
  };

  /* turning: t from −1 (three-quarter to our left) through 0 (facing us) to 1 (to our right) */
  function prep(r) {
    var gs = r.fig.querySelectorAll('g'), torso = null;
    for (var i = 0; i < gs.length; i++) if (/^translate\(101 -9\) scale\(/.test(gs[i].getAttribute('transform') || '')) { torso = gs[i]; break; }
    if (!torso || !r.L || !r.R) return false;
    var w = E('g', { class: 'rig-torso' }); torso.parentNode.insertBefore(w, torso); w.appendChild(torso); r.torso = w;
    r.wL = r.L.g.parentNode; r.wR = r.R.g.parentNode; r.home = r.wL.parentNode; r.tL = r.wL.getAttribute('transform') || ''; r.tR = r.wR.getAttribute('transform') || '';
    r.back = E('g', { class: 'rig-behind', transform: r.home.getAttribute('transform') || '' }); w.parentNode.insertBefore(r.back, w);
    r.legParent = r.LL && r.LL.g.parentNode;
    return true;
  }
  function armsHome(r) { var hb = r.home.querySelector('.bob'); r.home.insertBefore(r.wL, hb); r.home.insertBefore(r.wR, hb); }
  Rig.turn = function (r, t) {
    if (!r.torso && !prep(r)) return;
    var k = Math.abs(t);
    r.torso.setAttribute('transform', 'translate(101 0) scale(' + f2(1 - .28 * k) + ' 1) translate(-101 0)');
    if (r.LL) r.LL.g.setAttribute('transform', 'translate(' + f2(8 * k) + ' 0)');
    if (r.LR) r.LR.g.setAttribute('transform', 'translate(' + f2(-8 * k) + ' 0)');
    var far = t > 0 ? 'R' : 'L', near = far === 'R' ? 'L' : 'R', s = far === 'R' ? -1 : 1;
    r['w' + near].setAttribute('transform', r['t' + near] + ' translate(' + f2(s * 5 * k) + ' 0)');
    r['w' + far].setAttribute('transform', r['t' + far] + ' translate(' + f2(s * 7 * k) + ' 0)');
    /* only in a true side view does the far arm go behind the body; half-turned you see both */
    if (!r.isBack) { if (k > .8) { if (r['w' + far].parentNode !== r.back) r.back.appendChild(r['w' + far]); } else armsHome(r); }
    if (r.legParent && r.LL && r.LR) { if (t > .35) r.legParent.insertBefore(r.LR.g, r.LL.g); else r.legParent.insertBefore(r.LL.g, r.LR.g); }
    r.fig.querySelectorAll('.av-feat').forEach(function (e) { e.setAttribute('transform', 'translate(' + f2(5.5 * t + (r.look ? r.look[0] : 0)) + ' ' + f2(r.look ? r.look[1] : 0) + ')'); });
    r.fig.querySelectorAll('.av-hairf').forEach(function (e) { e.setAttribute('transform', 'translate(' + f2(2.6 * t) + ' 0)'); });
    /* from the side the far ear is behind the head */
    var ears = r.fig.querySelectorAll('.bob ellipse[cx="82.5"], .bob ellipse[cx="119.5"]');
    ears.forEach(function (e) { var far2 = (e.getAttribute('cx') === '82.5') === (t > 0); e.style.display = k > .8 && far2 ? 'none' : ''; });
    /* both toes point the way it faces */
    if (r.LL) r.LL.shoe.setAttribute('transform', t > .35 ? 'translate(' + f2(2 * r.LL.cx) + ' 0) scale(-1 1)' : '');
    if (r.LR) r.LR.shoe.setAttribute('transform', t < -.35 ? 'translate(' + f2(2 * r.LR.cx) + ' 0) scale(-1 1)' : '');
    r.t = t;
  };
  /* seen from behind: no face, the back of the head in hair colour (skin when bald or buzzed), no chest print */
  var SHORT = /^(bald|buzz)$/, LONG = /^(long|bun|ponytail|braids|dreads|afro|curly)$/;
  Rig.back = function (r, on, look) {
    var fig = r.fig; look = look || {};
    /* from behind you still see both arms (their backs), so they stay in front of the torso – hiding them left a stray hand */
    if (r.L && r.R) { if (!r.torso) prep(r); r.isBack = on; if (r.back) armsHome(r); }
    fig.querySelectorAll('.av-feat, .av-chest').forEach(function (e) { e.style.display = on ? 'none' : ''; });
    fig.querySelectorAll('.rig-nape').forEach(function (e) { e.remove(); });
    if (!on) return;
    var fs = fig.querySelector('.av-faceshape'); if (!fs) return;
    var hair = look.hair || 'short', c = fs.cloneNode(); c.setAttribute('class', 'rig-nape');
    c.setAttribute('fill', (SHORT.test(hair) ? look.skin : look.hairC) || '#1e140d');
    if (!SHORT.test(hair) && !LONG.test(hair)) {   /* short hair ends above the neck: the nape stays skin */
      var id = 'nape' + Math.random().toString(36).slice(2, 8), cp = E('clipPath', { id: id, class: 'rig-nape' });
      cp.appendChild(E('path', { d: 'M60 0H142V77.5Q101 79.5 60 77.5Z' })); fs.parentNode.insertBefore(cp, fs.nextSibling); c.setAttribute('clip-path', 'url(#' + id + ')');
    }
    fs.parentNode.insertBefore(c, fs.nextSibling);
    if (hair === 'bald') fs.parentNode.insertBefore(E('path', { class: 'rig-nape', d: 'M88 50q13 -6 26 0', stroke: 'rgba(255,255,255,.15)', 'stroke-width': '2', fill: 'none' }), c.nextSibling);
  };
  /* things it holds from the maker (coffee, flowers…) are put away while it uses a prop, and come back after */
  Rig.stow = function (r, on) { ['R', 'L'].forEach(function (k) { var A = r[k]; if (!A) return; [].forEach.call(A.hand.children, function (c) { if (!c.classList.contains('av-mit')) c.style.display = on ? 'none' : ''; }); }); };
  window.Rig = Rig;
})();
