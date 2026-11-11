/* The living Trips picture (Phase L6, round 4) – your next trip drives what you do: pack the clothes still on the
   packing list into the suitcase, check the tag (the real days left), point to where the plane is going, check your
   passport, roll the suitcase when it's packed; no trip planned: dream about the next one. Only the Trips tab – the
   Journey tab is its own little film. Built from the rig, the scene engine and the shared props (scene-common.js). */
(function () {
  'use strict';
  function make() {
  var L = window.Live, K = window.SceneCommon; if (!L || !K) return null;
  var el = L.el, T = K.T, fit = K.fit, seq = K.seq, mount = K.mount, look = K.look, common = K.common, start = K.start, fall = K.fall;
  /* things to pack and the passport, at the size of the hand (like scene-common's props) */
  var SHIRT = '<path d="M-5 -3.5h3l2 1.4 2-1.4h3l2.4 3-2 1.4-1-1v6.6h-8.8v-6.6l-1 1-2-1.4z" fill="#3987e5"/>', SOCK = '<path d="M-1.8 -5h3.6v6.4l3 1.6q1 1.6-.6 2.4l-5.2-1.6q-.8-.4-.8-1.4z" fill="#e8743b"/>';
  var PASS = '<rect x="-3.4" y="-4.6" width="6.8" height="9.2" rx=".8" fill="#7a1f2b"/><circle cx="0" cy="-.6" r="1.8" fill="none" stroke="#f2c94c" stroke-width=".6"/><path d="M-1.8 2.6h3.6" stroke="#f2c94c" stroke-width=".5"/>';
  return function (svg, data) {
    var m = mount(svg); if (!m) return null; data = data || {};
    var parts = svg.querySelectorAll('[data-scgo="trips"]'), cs = parts[0], plane = parts[1];
    if (!cs) return null;
    svg.querySelectorAll('.sc-pack').forEach(function (e) { e.remove(); });
    m.me.remove();
    var H = L.Hero(svg, null, m.box), R = L.Run(), C = common(R, H, svg), base = H.pos.slice();
    var mouthOfCase = [61, 90], handle = [61, 83], tag = [96, 104], pin = [222, 31];   /* the suitcase is drawn at 70 % around its wheels (scenes.js) */
    function caseAt(dx) { cs.setAttribute('transform', dx ? 'translate(' + dx.toFixed(2) + ' 0)' : ''); }
    var rolling = false, roll0 = 0; H.onStep = function () { if (rolling) caseAt(H.pos[0] - roll0); };
    function home() { return seq([function () { look(H, null); return L.walk(R, H, base, 22); }, function () { return L.turnTo(R, H, 'front', 250); }]); }
    function packOne(html, grip) {
      var o;
      return seq([function () { return L.reach(R, H, 'R', fit(H, 14, -46), 300); },
        function () { o = L.Obj(H, 'R', html, grip); look(H, mouthOfCase); return Promise.all([L.reach(R, H, 'R', [mouthOfCase[0] - 6, mouthOfCase[1] - 6], 450), L.prop(R, H, 'lean', 6, 400)]); },
        function () { var P = L.handAt(H, 'R'); L.letGo(H, 'R'); fall(svg, '<g transform="scale(' + (H.s / .5).toFixed(2) + ')">' + html + '</g>', P, [P[0] + 4, 108], 420, cs.nextSibling); L.wob(cs, 3, 400); return L.wait(R, 450); }]);
    }
    var ACTS = function () {
      var a = [], n = data.days;
      if (data.trip && data.packLeft > 0 && !data.away) a.push({ n: 'pack', t: 'packing', w: 3, f: function () {
        return seq([function () { L.face(H, 'grin'); return L.walk(R, H, [Math.max(base[0], 24), base[1]], 20, null, .7); },
          function () { return packOne(SHIRT, [0, -3]); }, function () { L.say(H, T('Packing!', 'Pakker!'), 1300); return packOne(SOCK, [0, -4]); },
          function () { return Promise.all([L.prop(R, H, 'lean', 0, 350), L.settle(R, H, 350)]); }, home]); } });
      if (data.trip) a.push(
        { n: 'tag', t: 'checking the tag', f: function () {
          var line = data.away ? T('Have a great trip!', 'God tur!') : n === 0 ? T('It’s today!', 'Det er i dag!') : n === 1 ? T('Tomorrow!', 'I morgen!') : T(n + ' days to go!', n + ' dager igjen!');
          return seq([function () { L.face(H, 'calm'); return L.walk(R, H, [tag[0] + 30, base[1]], 22, null, -.7); },   /* past the suitcase, to read the tag from its side */
            function () { look(H, tag); return L.reach(R, H, 'L', [tag[0] + 9, tag[1]], 450); },
            function () { L.wob(cs, 2, 300); L.face(H, n != null && n <= 3 ? 'starry' : 'grin'); L.say(H, line, 1700); return L.wait(R, 1400); },
            function () { return L.settle(R, H, 350); }, home]); } },
        { n: 'plane', t: 'pointing where we go', f: function () {
          return seq([function () { L.face(H, 'starry'); return L.walk(R, H, [128, base[1]], 22, null, .7); },
            function () { look(H, pin); return Promise.all([L.reach(R, H, 'R', fit(H, 30, -128), 450), L.headTo(R, H, 4, -2, 400)]); },
            function () { L.say(H, T('Off we go!', 'Snart drar vi!'), 1500); L.burst(svg, [pin[0], pin[1] - 8], 5); if (plane) L.wob(plane, 4, 500); return L.wait(R, 1300); },
            function () { return Promise.all([L.settle(R, H, 350), L.headTo(R, H, 0, 0, 300)]); }, home]); } }
      );
      if (data.trip && !data.away && n != null && n <= 7) a.push({ n: 'passport', t: 'checking the passport', w: n <= 3 ? 2 : 1, f: function () { var o;
        return seq([function () { L.face(H, 'calm'); return L.reach(R, H, 'R', fit(H, 12, -48), 350); },
          function () { o = L.Obj(H, 'R', PASS, [0, 3]); return L.reach(R, H, 'R', fit(H, 8, -70), 450); },
          function () { look(H, L.handAt(H, 'R')); return L.headTo(R, H, 4, 1.5, 300); },
          function () { L.face(H, 'grin'); L.say(H, T('Passport? Check!', 'Pass? Sjekk!'), 1500); return L.tw(R, 700, function (u) { o.rot = Math.sin(u * Math.PI) * -20; }); },
          function () { return L.wait(R, 600); },
          function () { return L.reach(R, H, 'R', fit(H, 12, -48), 350); }, function () { L.letGo(H, 'R'); look(H, null); return Promise.all([L.settle(R, H, 300), L.headTo(R, H, 0, 0, 300)]); }]); } });
      if (data.trip && !data.away && data.packN > 0 && data.packLeft === 0) a.push({ n: 'roll', t: 'ready to go', w: 2, f: function () {
        return seq([function () { L.face(H, 'grin'); return L.walk(R, H, [handle[0] - 16 * H.s * 2, base[1]], 20, null, .7); },
          function () { look(H, handle); return L.reach(R, H, 'R', handle, 400); },
          function () { rolling = true; roll0 = H.pos[0]; L.say(H, T('Ready to go!', 'Klar for avreise!'), 1500); return L.walk(R, H, [H.pos[0] + 26, base[1]], 14, null, .7); },
          function () { return L.walk(R, H, [roll0, base[1]], 14, null, .7, 1); },
          function () { rolling = false; caseAt(0); return L.settle(R, H, 300); }, home]); } });
      if (data.away) a.push(C.cheer(T('Holiday!', 'Ferie!')));
      if (!data.trip) a.push(C.think(T('Where to next?', 'Hvor skal jeg neste gang?')), { n: 'dream', t: 'dreaming of a trip', f: function () {
        return seq([function () { L.face(H, 'love'); look(H, pin); return Promise.all([L.reach(R, H, 'R', fit(H, 7, -80), 500), L.headTo(R, H, 6, -2, 500)]); },
          function () { if (plane) L.wob(plane, 3, 600); L.say(H, T('Somewhere warm…', 'Et sted varmt …'), 1600); return L.wait(R, 1800); },
          function () { look(H, null); return Promise.all([L.settle(R, H, 350), L.headTo(R, H, 0, 0, 300)]); }]); } });
      a.push(C.wave);
      return a;
    };
    return start(svg, H, R, ACTS, 'travel');
  };
  }
  var real = null; window.SceneLive = window.SceneLive || {};
  window.SceneLive.travel = function (svg, data) { real = real || make(); return real ? real(svg, data) : null; };
})();
