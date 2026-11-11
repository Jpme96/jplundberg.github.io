/* The living Work picture (Phase L6) – your avatar's actions on this page, built from the rig, the scene engine
   and the shared props (scene-common.js), on top of the still picture from scenes.js. */
(function () {
  'use strict';
  /* made on first use: the engine and the shared props load after this page's own code */
  function make() {
  var L = window.Live, K = window.SceneCommon; if (!L || !K) return null;
  var el = L.el, rnd = L.rnd, ease = L.ease, lerp = L.lerp, T = K.T, fit = K.fit, seq = K.seq, mid = K.mid, mount = K.mount, look = K.look, O = K.O, take = K.take, tipOf = K.tipOf, common = K.common, start = K.start, spin = K.spin, fall = K.fall, drip = K.drip;
  /* ================= WORK: you behind the desk, the laptop facing you (we see its lid), the cup by its handle ================= */
  return function (svg, data) {
    var m = mount(svg); if (!m) return null; data = data || {};
    var nxt = m.me.nextSibling; m.me.remove();
    var cup = svg.querySelectorAll('[data-scgo="flex"]')[1], screen = svg.querySelector('.sc-screen'), kbd = svg.querySelector('.sc-kbd');
    /* the laptop faces you, so we see the back of its lid */
    screen.setAttribute('class', ''); screen.setAttribute('fill', '#9aa3b2'); screen.setAttribute('stroke', '#6b7385'); screen.setAttribute('stroke-width', '.8');
    screen.insertAdjacentHTML('afterend', '<circle cx="76" cy="83" r="2.4" fill="#c9ced8"/>');
    if (kbd) kbd.style.opacity = .45;
    var H = L.Hero(svg, nxt, { x: 81.2, y: 19.5, w: 83.6, h: 105.6 }), R = L.Run(), C = common(R, H, svg), base = H.pos.slice();
    /* the screen lights up your face while you type */
    var glow = el('g', { class: 'glow', style: 'opacity:0;transition:opacity .4s' }, '<radialGradient id="scrGlow"><stop offset="0" stop-color="#bfe1ff" stop-opacity=".35"/><stop offset="1" stop-color="#bfe1ff" stop-opacity="0"/></radialGradient><ellipse cx="80" cy="50" rx="13" ry="14" fill="url(#scrGlow)"/>'); svg.insertBefore(glow, H.layF.nextSibling);
    var ACTS = [
      { n: 'type', t: 'typing', f: function () {
        return seq([function () { L.face(H, 'calm'); return L.walk(R, H, [80, base[1]], 20, null, 0); },
          function () { look(H, [76, 70]); glow.style.opacity = 1; return Promise.all([L.both(R, H, [70, 92], [84, 92], 450), L.headTo(R, H, 5, 1, 400)]); },
          function () { return L.tw(R, 2800, function (u) { var a = u * 40; H.hand.L = [70 + Math.sin(a) * 2, 92 - Math.abs(Math.sin(a * 1.3)) * 1.4]; H.hand.R = [84 + Math.sin(a + 2) * 2, 92 - Math.abs(Math.sin(a * 1.1 + 1)) * 1.4]; }); },
          function () { glow.style.opacity = 0; look(H, null); L.face(H, 'grin'); L.say(H, T('Sent!', 'Sendt!'), 1200); return L.settle(R, H, 400); }, function () { return L.walk(R, H, base, 20); }]);
      } },
      { n: 'sip', t: 'coffee break', f: function () {
        var c0 = [168, 88];
        function carry() { var o = H.objs.R; cup.setAttribute('transform', 'translate(' + (L.handAt(H, 'R')[0] - c0[0]).toFixed(2) + ' ' + (L.handAt(H, 'R')[1] - c0[1]).toFixed(2) + ')'); }
        return seq([function () { L.face(H, 'calm'); return L.walk(R, H, [140, base[1]], 20, null, .6); },
          function () { look(H, [158, 88]); return L.reach(R, H, 'R', c0, 450); },
          function () { return Promise.all([L.reach(R, H, 'R', fit(H, 14, -86), 550), L.headTo(R, H, -8, -1, 500), L.tw(R, 560, carry)]); },
          function () { return L.tw(R, 1000, carry); },
          function () { look(H, null); L.face(H, 'love'); L.say(H, T('Ahh', 'Ahh'), 1300); return L.wait(R, 500); },
          function () { look(H, [158, 88]); return Promise.all([L.reach(R, H, 'R', c0, 550), L.headTo(R, H, 0, 0, 400), L.tw(R, 560, carry)]); },
          function () { cup.setAttribute('transform', ''); look(H, null); return L.settle(R, H, 400); }, function () { return L.walk(R, H, base, 20); }]);
      } },
      { n: 'clock', t: 'checking the flex', f: function () {
        return seq([function () { L.face(H, 'calm'); look(H, [200, 38]); return L.turnTo(R, H, .6, 300); },
          function () { spin('.sc-mh, .sc-hh', svg, 1400, 1); return L.wait(R, 1500); },
          function () { look(H, null); return L.turnTo(R, H, 'front', 300); }, function () { L.face(H, 'starry'); L.say(H, T('Right on time!', 'Akkurat i tide!'), 1500); return L.wait(R, 1200); }]);
      } },
      { n: 'done', t: 'task done', f: function () { look(H, null); L.face(H, 'laugh'); L.say(H, T('Done!', 'Ferdig!'), 1300); L.burst(svg, fit(H, 0, -140), 6); return L.both(R, H, fit(H, -18, -150), fit(H, 18, -150), 450).then(function () { return L.tw(R, 900, function (u) { H.bob = -Math.abs(Math.sin(u * Math.PI * 2)) * 4; }); }); } },
      C.think(T('Hmm…', 'Hmm …')), C.phone(T('Haha', 'Haha')), C.stretch
    ];
    return start(svg, H, R, ACTS, 'work');
  };
  }
  var real = null; window.SceneLive = window.SceneLive || {};
  window.SceneLive.work = function (svg, data) { real = real || make(); return real ? real(svg, data) : null; };
})();
