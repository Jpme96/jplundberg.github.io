/* The living Papers picture (Phase L6) – your avatar's actions on this page, built from the rig, the scene engine
   and the shared props (scene-common.js), on top of the still picture from scenes.js. */
(function () {
  'use strict';
  /* made on first use: the engine and the shared props load after this page's own code */
  function make() {
  var L = window.Live, K = window.SceneCommon; if (!L || !K) return null;
  var el = L.el, rnd = L.rnd, ease = L.ease, lerp = L.lerp, T = K.T, fit = K.fit, seq = K.seq, mid = K.mid, mount = K.mount, look = K.look, O = K.O, take = K.take, tipOf = K.tipOf, common = K.common, start = K.start, spin = K.spin, fall = K.fall, drip = K.drip;
  /* ================= PAPERS: the cabinet (back to us), the floating letter, the plant and its can ================= */
  return function (svg, data) {
    var m = mount(svg); if (!m) return null; data = data || {};
    m.me.remove();
    var drawers = svg.querySelectorAll('[data-scgo="papers"]'), top = drawers[0], fl = svg.querySelector('.sc-float'), plant = svg.querySelector('.sc-plant');
    var canHome = el('g', { class: 'can-home' }); svg.insertBefore(canHome, svg.querySelector('.sc-plant').nextSibling);
    var H = L.Hero(svg, null, m.box), R = L.Run(), C = common(R, H, svg), base = H.pos.slice();
    var CANP = [66, 126];
    function canDown() { canHome.innerHTML = '<g transform="translate(' + CANP[0] + ' ' + CANP[1] + ') scale(' + (H.s / .5).toFixed(3) + ') scale(-1 1) translate(0 -4.5)">' + O.can[0] + '</g>'; }
    canDown();
    function drawerOut(k) { top.setAttribute('transform', 'translate(0 ' + (3 * k) + ') translate(126 80) scale(' + (1 + .08 * k) + ') translate(-126 -80)'); }
    var ACTS = [
      { n: 'file', t: 'filing a letter', f: function () {
        var o;
        return seq([function () { L.face(H, 'calm'); return L.reach(R, H, 'R', fit(H, 14, -44), 300); },
          function () { o = take(H, 'R', 'paperBack'); return L.walk(R, H, [140, base[1]], 22, null, -.6); },
          function () { return L.turnTo(R, H, 'back', 300); },
          function () { return L.reach(R, H, 'L', [126, 80], 420); },
          function () { return L.tw(R, 500, function (u) { var e = ease(u); drawerOut(e); H.hand.L = [126, 80 + 3 * e]; }); },
          function () { return L.reach(R, H, 'R', [128, 70], 420); },
          function () { L.letGo(H, 'R'); return fall(svg, O.paper[0], [128, 70], [128, 82], 380, top.firstChild); },
          function () { return L.tw(R, 420, function (u) { var e = 1 - ease(u); drawerOut(e); H.hand.L = [126, 80 + 3 * e]; H.hand.R = null; }); },
          function () { top.setAttribute('transform', ''); return L.reach(R, H, 'L', null, 300); },
          function () { return L.turnTo(R, H, 'front', 300); },
          function () { L.face(H, 'grin'); L.say(H, T('Filed!', 'Arkivert!'), 1300); return L.wait(R, 900); },
          function () { return L.walk(R, H, base, 22); }]);
      } },
      { n: 'catch', t: 'catching a letter', f: function () {
        var o;
        return seq([function () { L.face(H, 'starry'); look(H, [222, 69]); return L.turnTo(R, H, .6, 300); },
          function () { return L.reach(R, H, 'R', [218, 72], 550); },
          function () { fl.style.visibility = 'hidden'; o = take(H, 'R', 'paperBack'); return Promise.all([L.turnTo(R, H, 'front', 300), L.reach(R, H, 'R', fit(H, 8, -58), 450)]); },
          function () { look(H, L.handAt(H, 'R')); return L.headTo(R, H, 6, 1.5, 300); },
          function () { return L.wait(R, 1000); },
          function () { look(H, null); L.face(H, 'wow'); L.say(H, T('A letter!', 'Et brev!'), 1400); return L.wait(R, 1100); },
          function () { return Promise.all([L.turnTo(R, H, .6, 300), L.reach(R, H, 'R', [218, 72], 450)]); },
          function () { L.letGo(H, 'R'); fl.style.visibility = ''; return L.settle(R, H, 350); }]);
      } },
      { n: 'water', t: 'watering the plant', f: function () {
        var o;
        return seq([function () { L.face(H, 'calm'); return L.walk(R, H, [CANP[0] + 8, base[1]], 24, null, -.7); },
          function () { look(H, CANP); return Promise.all([L.prop(R, H, 'bob', 12, 400), L.legs(R, H, .6, .6, -12, 12, 400), L.reach(R, H, 'L', [CANP[0] - 2, CANP[1] - 5], 450)]); },
          function () { canHome.innerHTML = ''; o = take(H, 'L', 'can', { flip: true }); return Promise.all([L.prop(R, H, 'bob', 0, 400), L.legs(R, H, 0, 0, 0, 0, 400)]); },
          function () { look(H, [45, 96]); return L.reach(R, H, 'L', [60, 86], 450); },
          function () { return L.tw(R, 1600, function (u) { o.rot = -38 * Math.min(1, u * 4) * (u > .85 ? (1 - u) / .15 : 1); if (u > .2 && u < .85 && Math.random() < .45) drip(svg, tipOf(H, o, 'can')); }); },
          function () { plant.style.transformBox = 'fill-box'; plant.style.transformOrigin = '50% 100%'; plant.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06,1.14)', offset: .6 }, { transform: 'scale(1.03,1.08)' }], { duration: 1000, fill: 'forwards' }); look(H, null); return L.turnTo(R, H, -.2, 300); },
          function () { L.face(H, 'love'); L.say(H, T('Grow!', 'Voks!'), 1300); return L.wait(R, 800); },
          function () { look(H, CANP); return L.turnTo(R, H, -.7, 300); },
          function () { return Promise.all([L.prop(R, H, 'bob', 12, 400), L.legs(R, H, .6, .6, -12, 12, 400), L.reach(R, H, 'L', [CANP[0] - 2, CANP[1] - 5], 450)]); },
          function () { L.letGo(H, 'L'); canDown(); look(H, null); return Promise.all([L.prop(R, H, 'bob', 0, 400), L.legs(R, H, 0, 0, 0, 0, 400)]); },
          function () { return L.walk(R, H, base, 24); }]);
      } },
      { n: 'stamp', t: 'stamping a bill', f: function () {
        var o, sheet;
        return seq([function () { L.face(H, 'cool'); return L.reach(R, H, 'L', fit(H, -14, -44), 300); },
          function () { o = take(H, 'L', 'paper'); return L.walk(R, H, [164, base[1]], 22, null, -.6); },
          function () { look(H, [140, 66]); return L.reach(R, H, 'L', [140, 64], 450); },
          function () { L.letGo(H, 'L'); sheet = el('g', {}, '<g transform="translate(140 64) scale(' + (H.s / .5).toFixed(3) + ') translate(0 -4)"><g transform="rotate(90)">' + O.paper[0] + '</g></g>'); svg.insertBefore(sheet, H.layB); return Promise.all([L.reach(R, H, 'L', null, 300), L.reach(R, H, 'R', fit(H, 14, -44), 300)]); },
          function () { take(H, 'R', 'stamp'); return L.reach(R, H, 'R', [143, 52], 450); },
          function () { return L.reach(R, H, 'R', [143, 62], 160); },
          function () { sheet.insertAdjacentHTML('beforeend', '<rect x="140" y="62" width="6" height="3" rx=".6" fill="none" stroke="#e5484d" stroke-width=".8"/>'); L.burst(svg, [143, 62], 4); return L.reach(R, H, 'R', [143, 52], 250); },
          function () { L.letGo(H, 'R'); look(H, null); L.say(H, T('Paid!', 'Betalt!'), 1300); return Promise.all([L.reach(R, H, 'R', null, 300), L.turnTo(R, H, -.2, 300)]); },
          function () { return L.wait(R, 900); },
          function () { return L.turnTo(R, H, -.6, 300); }, function () { return L.reach(R, H, 'L', [140, 64], 400); },
          function () { sheet.remove(); take(H, 'L', 'paper'); return L.reach(R, H, 'L', fit(H, -12, -46), 400); },
          function () { L.letGo(H, 'L'); return L.walk(R, H, base, 22); }]);
      } },
      { n: 'sigh', t: 'so many papers', f: function () { look(H, null); L.face(H, 'shy'); L.say(H, T('So many…', 'Så mange …'), 1500); return L.both(R, H, fit(H, -26, -76), fit(H, 26, -76), 400).then(function () { return L.headTo(R, H, 8, 2, 400); }).then(function () { return L.wait(R, 1000); }); } },
      C.stretch
    ];
    return start(svg, H, R, ACTS, 'papers');
  };

  }
  var real = null; window.SceneLive = window.SceneLive || {};
  window.SceneLive.papers = function (svg, data) { real = real || make(); return real ? real(svg, data) : null; };
})();
