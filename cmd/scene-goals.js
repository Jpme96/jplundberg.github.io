/* The living Goals picture (Phase L6) – your avatar's actions on this page, built from the rig, the scene engine
   and the shared props (scene-common.js), on top of the still picture from scenes.js. */
(function () {
  'use strict';
  /* made on first use: the engine and the shared props load after this page's own code */
  function make() {
  var L = window.Live, K = window.SceneCommon; if (!L || !K) return null;
  var el = L.el, rnd = L.rnd, ease = L.ease, lerp = L.lerp, T = K.T, fit = K.fit, seq = K.seq, mid = K.mid, mount = K.mount, look = K.look, O = K.O, take = K.take, tipOf = K.tipOf, common = K.common, start = K.start, spin = K.spin, fall = K.fall, drip = K.drip;
  /* ================= GOALS: on the trail (smaller higher up – it's further away) ================= */
  return function (svg, data) {
    var m = mount(svg); if (!m) return null; data = data || {};
    m.me.remove();
    var trail = svg.querySelector('.sc-trail'), len = trail.getTotalLength();
    /* the trail sits in a moved group in the picture: its points are taken into the picture's own coordinates */
    var P = function (u) { var p = trail.getPointAtLength(Math.max(0, Math.min(1, u)) * len), a = trail.getScreenCTM(), b = svg.getScreenCTM(); if (!a || !b) return [p.x, p.y]; var q = svg.createSVGPoint(); q.x = p.x; q.y = p.y; q = q.matrixTransform(a).matrixTransform(b.inverse()); return [q.x, q.y]; };
    var H = L.Hero(svg, null, { x: 0, y: 0, w: 31, h: 44 })   /* small against the mountain */, R = L.Run(), C = common(R, H, svg), u0 = .42, cu = u0;
    function at(u) { cu = u; H.pos = P(u); H.k = 1 - .25 * u; }
    at(u0);
    function along(a, b, sp, end) { return L.walk(R, H, P(b), sp || 14, function (u) { var v = lerp(a, b, u); H.k = 1 - .25 * v; return P(v); }, end).then(function () { at(b); }); }
    var ACTS = [
      { n: 'climb', t: 'climbing', f: function () {
        return seq([function () { L.face(H, 'calm'); return along(u0, u0 + .14, 12); },
          function () { return L.turnTo(R, H, 'back', 300); },
          function () { return Promise.all([L.reach(R, H, 'R', fit(H, 4, -112), 450), L.headTo(R, H, -9, -1.5, 450)]); },
          function () { L.say(H, T('Still far!', 'Fortsatt langt!'), 1600); return L.wait(R, 1300); },
          function () { return L.settle(R, H, 350); }, function () { L.face(H, 'grin'); return along(u0 + .14, u0, 16); }]);
      } },
      { n: 'rest', t: 'taking a break', f: function () {
        var o;
        return seq([function () { L.face(H, 'calm'); return Promise.all([L.prop(R, H, 'bob', 7, 500), L.legs(R, H, .7, .7, -18, 18, 500)]); },
          function () { return L.reach(R, H, 'R', fit(H, 14, -46), 350); },
          function () { o = take(H, 'R', 'bottle'); return L.drink(R, H, 'R', o, 900, 70); },   /* to the mouth, tipped up */
          function () { return L.reach(R, H, 'R', fit(H, 14, -46), 400); },
          function () { L.letGo(H, 'R'); L.face(H, 'grin'); return L.reach(R, H, 'R', null, 300); },
          function () { return L.reach(R, H, 'L', fit(H, -8, -106), 400); }, function () { return L.reach(R, H, 'L', fit(H, 8, -108), 350); },
          function () { L.drops(svg, fit(H, 10, -104), 3); L.say(H, T('Phew', 'Puh'), 1300); return L.wait(R, 700); }]);
      } },
      { n: 'map', t: 'reading the map', f: function () {
        var o;
        return seq([function () { L.face(H, 'calm'); return L.both(R, H, fit(H, -14, -64), fit(H, 14, -64), 500); },
          /* you read it: we see the back of the map */
          function () { o = L.Obj(H, 'L', O.mapBack[0], [-6, 1]); look(H, mid(H)); return L.tw(R, 1500, function (u) { H.head = [5 + Math.sin(u * 9) * 2, 2]; }); },
          /* then turn it round to show us */
          function () { L.letGo(H, 'L'); o = L.Obj(H, 'L', O.map[0], [-6, 1]); look(H, null); L.face(H, 'starry'); return L.headTo(R, H, 0, 0, 300); },
          function () { return L.wait(R, 800); },
          function () { L.letGo(H, 'L'); return Promise.all([L.reach(R, H, 'L', null, 300), L.turnTo(R, H, .5, 300), L.reach(R, H, 'R', [120, 14], 500)]); },
          function () { look(H, [120, 14]); L.say(H, T('This way!', 'Denne veien!'), 1500); return L.wait(R, 1300); }]);
      } },
      { n: 'selfie', t: 'trail selfie', f: function () {
        return seq([function () { L.face(H, 'silly'); return L.reach(R, H, 'R', fit(H, 14, -44), 300); },
          function () { take(H, 'R', 'phone'); return Promise.all([L.reach(R, H, 'R', fit(H, 30, -132), 600), L.headTo(R, H, 8, 0, 500), L.reach(R, H, 'L', fit(H, -16, -90), 600)]); },
          function () { look(H, L.handAt(H, 'R')); return L.wait(R, 700); }, function () { L.flash(svg); L.face(H, 'wink'); return L.wait(R, 900); },
          function () { look(H, null); L.letGo(H, 'R'); L.say(H, T('Getting there!', 'På god vei!'), 1400); return L.wait(R, 600); }]);
      } },
      { n: 'slip', t: 'oops, slipping', f: function () {
        return seq([function () { L.face(H, 'calm'); return along(u0, u0 + .06, 12, .9); },
          function () { L.face(H, 'wow'); L.say(H, T('Whoa!', 'Oi!'), 1300); var A = u0 + .06, B = u0 - .015; return L.tw(R, 700, function (u) { at(lerp(A, B, ease(u))); var w = u * Math.PI * 4; H.rot.R = [-90 + Math.sin(w) * 70, -30]; H.rot.L = [90 - Math.sin(w + 1) * 70, 30]; H.lean = -8 * Math.sin(u * Math.PI); }); },
          function () { H.rot.R = [0, 0]; H.rot.L = [0, 0]; return L.turnTo(R, H, 'front', 300); },
          function () { L.face(H, 'shy'); return L.reach(R, H, 'L', fit(H, 6, -108), 400); },
          function () { L.drops(svg, fit(H, 8, -104), 2); L.say(H, T('Phew', 'Puh'), 1200); return along(u0 - .015, u0, 10); }]);
      } },
      C.cheer(T('Keep going!', 'Fortsett!')), C.wave
    ];
    return start(svg, H, R, ACTS, 'goals');
  };

  }
  var real = null; window.SceneLive = window.SceneLive || {};
  window.SceneLive.goals = function (svg, data) { real = real || make(); return real ? real(svg, data) : null; };
})();
