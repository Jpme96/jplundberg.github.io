/* The living Trips picture (Phase L6, round 4) – your next trip drives what you do: pack the clothes still on the
   packing list into the suitcase, check the tag (the real days left), point to where the plane is going, check your
   passport, roll the suitcase when it's packed; no trip planned: dream about the next one.
   The Journey tab: your everyday ride, lived – out of the door, to the stop, on when it pulls in, off at each change,
   the last bit on foot to the door (the rides of your last search, scenes.js journey()). Built from the rig, the scene
   engine, the shared props (scene-common.js) and the journey's own drawings (SceneArt in scenes.js). */
(function () {
  'use strict';
  function make() {
  var L = window.Live, K = window.SceneCommon; if (!L || !K) return null;
  var el = L.el, T = K.T, fit = K.fit, seq = K.seq, mount = K.mount, look = K.look, common = K.common, start = K.start, fall = K.fall;
  /* things to pack and the passport, at the size of the hand (like scene-common's props) */
  var SHIRT = '<path d="M-5 -3.5h3l2 1.4 2-1.4h3l2.4 3-2 1.4-1-1v6.6h-8.8v-6.6l-1 1-2-1.4z" fill="#3987e5"/>', SOCK = '<path d="M-1.8 -5h3.6v6.4l3 1.6q1 1.6-.6 2.4l-5.2-1.6q-.8-.4-.8-1.4z" fill="#e8743b"/>';
  var PASS = '<rect x="-3.4" y="-4.6" width="6.8" height="9.2" rx=".8" fill="#7a1f2b"/><circle cx="0" cy="-.6" r="1.8" fill="none" stroke="#f2c94c" stroke-width=".6"/><path d="M-1.8 2.6h3.6" stroke="#f2c94c" stroke-width=".5"/>';
  /* ================= JOURNEY: home → the rides → work, and back the next time ================= */
  function journey(svg, data) {
    var A = window.SceneArt; if (!A || L.still() || !window.Rig || !window.Avatar) return null;
    var legs = (data.legs || []).filter(function (x) { return A.VEH[x]; }); if (!legs.length) legs = ['bus'];
    /* the film's own layers go; ground and sky stay */
    svg.querySelectorAll('style').forEach(function (e) { e.remove(); }); svg.querySelectorAll('g[clip-path]').forEach(function (e) { e.remove(); });
    var cid = 'lj' + Math.random().toString(36).slice(2, 7), defs = el('defs', {}, '<clipPath id="' + cid + '"><rect x="0" y="0" width="240" height="150"/></clipPath>');
    var stage = el('g', { 'clip-path': 'url(#' + cid + ')' }), bg = el('g', {}), veh = el('g', {}), cover = el('rect', { x: 0, y: 0, width: 240, height: 150, fill: '#0b0d12', opacity: 0, 'pointer-events': 'none' });
    stage.appendChild(bg); stage.appendChild(veh); svg.appendChild(defs); svg.appendChild(stage);
    var H = L.Hero(svg, null, { x: 59, y: 91, w: 22, h: 27 }), R = L.Run(), C = common(R, H, svg), Y = H.pos[1];   /* near life size next to the rides (a bus about 1.4× your height), still easy to see on a phone */
    svg.appendChild(cover);
    var goWork = data.toWork !== false, OFF = { tram: -18, metro: -18, rail: -28 }, DOOR = { bus: 84, coach: 84, rail: 62, tram: 60, metro: 60, water: 48 };
    var WAIT = 192, STOP = 56;                                         /* where you wait by the pole; where a ride stops */
    function lights(on) { bg.querySelectorAll('.lj-win').forEach(function (e) { e.setAttribute('fill', on ? '#ffd56b' : '#1d2a3b'); }); }
    function place(work, dx, mo) { var h = A.place(work, dx, 'none'); bg.innerHTML = A.track(mo ? A.kindOf(mo) : 'road') + h; bg.querySelectorAll('rect[fill="#1d2a3b"]').forEach(function (e) { e.setAttribute('class', 'lj-win'); e.removeAttribute('style'); }); }
    function cut(build) { return L.tw(R, 260, function (u) { cover.setAttribute('opacity', u.toFixed(2)); }).then(function () { build(); return L.tw(R, 300, function (u) { cover.setAttribute('opacity', (1 - u).toFixed(2)); }); }); }
    function ride(mo) { veh.innerHTML = '<g class="lj-veh"><g transform="translate(' + (OFF[mo] || 0) + ' 0)">' + A.vehicle(mo, A.VEH[mo][0]) + '</g></g>'; vAt(-180); }
    function vAt(x) { var g = veh.firstChild; if (g) g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' 0)'); }
    function drive(a, b, ms, arrive) { return L.tw(R, ms, function (u) { var e = arrive ? 1 - (1 - u) * (1 - u) : u * u; vAt(a + (b - a) * e); }); }
    function doorX(mo) { return STOP + (OFF[mo] || 0) + (DOOR[mo] || 70); }
    function hide(v) { return L.prop(R, H, 'op', v ? 0 : 1, 260); }
    function board(mo) {
      return seq([function () { ride(mo); look(H, [STOP, 90]); return drive(-180, STOP, 1500, true); },
        function () { return L.walk(R, H, [doorX(mo), Y], 18, null, -.7); },
        function () { return L.turnTo(R, H, 'back', 220); }, function () { return hide(true); },
        function () { look(H, null); return drive(STOP, 300, 1300); }]);
    }
    function getOff(mo, next) {
      return seq([function () { return cut(function () { bg.innerHTML = A.track(A.kindOf(mo)) + (next ? A.stop(next) : ''); ride(mo); }); },
        function () { return drive(-180, STOP, 1400, true); },
        function () { H.pos = [doorX(mo), Y]; return L.turnTo(R, H, 'front', 10); }, function () { return hide(false); },
        function () { return Promise.all([drive(STOP, 300, 1300), next ? L.walk(R, H, [WAIT, Y], 18, null, -.7) : L.walk(R, H, [250, Y], 22, null, .7)]); }]);
    }
    function leaveScene(work) { var first = work ? legs[legs.length - 1] : legs[0];   /* from work the rides go in reverse */
      place(work, -146, first); lights(true); bg.insertAdjacentHTML('beforeend', A.stop(first)); veh.innerHTML = ''; H.pos = [70, Y]; H.op = 1; }
    leaveScene(!goWork);
    var trip = { n: 'trip', t: 'on the way', f: function () {
      var from = !goWork, to = goWork, list = goWork ? legs : legs.slice().reverse(), steps = [];
      steps.push(function () { return cut(function () { leaveScene(from); H.pos = [48, Y]; H.op = 0; }); },
        function () { return hide(false); },
        function () { L.face(H, 'grin'); L.say(H, to ? T('Off to work!', 'Til jobben!') : T('Heading home!', 'Hjem nå!'), 1400); lights(false); return L.walk(R, H, [WAIT, Y], 22, null, -.7); },
        function () { L.face(H, 'calm'); look(H, [20, 90]); return L.wait(R, 500); });
      list.forEach(function (mo, i) {
        steps.push(function () { return board(mo); });
        steps.push(function () { if (list[i + 1]) L.say(H, T('Change!', 'Bytte!'), 1100); return getOff(mo, list[i + 1]); });
      });
      steps.push(function () { return cut(function () { place(to, 0); lights(false); veh.innerHTML = ''; H.pos = [96, Y]; H.op = 1; }); },
        function () { return L.walk(R, H, [194, Y], 22, null, .7); },
        function () { lights(true); L.face(H, 'laugh'); L.say(H, to ? T('At work!', 'På jobb!') : T('Home!', 'Hjemme!'), 1400); return L.turnTo(R, H, 'back', 220); },
        function () { return hide(true); }, function () { return L.wait(R, 700); },
        /* next time the other way – you're standing by this door, ready */
        function () { goWork = !goWork; return cut(function () { leaveScene(!goWork); }); },
        function () { look(H, null); return L.turnTo(R, H, 'front', 200); });
      return seq(steps);
    } };
    return start(svg, H, R, [trip, C.wave], 'travel');
  }
  return function (svg, data) {
    data = data || {}; if (data.journey) return journey(svg, data);
    var m = mount(svg); if (!m) return null;
    var parts = svg.querySelectorAll('[data-scgo="trips"]'), cs = parts[0], plane = parts[1];
    if (!cs) return null;
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
          function () { rolling = true; roll0 = H.pos[0]; L.say(H, T('Ready to go!', 'Klar for avreise!'), 1500); return L.walk(R, H, [H.pos[0] + 26, base[1]], 18, null, .7); },
          function () { return L.walk(R, H, [roll0, base[1]], 18, null, .7, 1); },
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
