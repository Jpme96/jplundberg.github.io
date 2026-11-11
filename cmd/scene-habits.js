/* The living Health picture (Phase L6) – your avatar's actions on this page, built from the rig, the scene engine
   and the shared props (scene-common.js), on top of the still picture from scenes.js. */
(function () {
  'use strict';
  /* made on first use: the engine and the shared props load after this page's own code */
  function make() {
  var L = window.Live, K = window.SceneCommon; if (!L || !K) return null;
  var el = L.el, rnd = L.rnd, ease = L.ease, lerp = L.lerp, T = K.T, fit = K.fit, seq = K.seq, mid = K.mid, mount = K.mount, look = K.look, O = K.O, take = K.take, tipOf = K.tipOf, common = K.common, start = K.start, spin = K.spin, fall = K.fall, drip = K.drip;
  /* ================= HEALTH: dumbbells picked up from the floor, the barbell in front of you ================= */
  return function (svg, data) {
    var m = mount(svg); if (!m) return null; data = data || {};
    m.me.remove();
    var bar = svg.querySelector('[data-scgo="training"]'), heart = svg.querySelector('.sc-heart');
    var H = L.Hero(svg, null, m.box, { top: 'tee', topC: '#2f7a55', hat: 'bandana', hatC: '#e5484d', extra: 'none', neck: 'none' }), R = L.Run(), C = common(R, H, svg), base = H.pos.slice();
    svg.appendChild(bar);   /* the barbell lies in front of you, wider than your shoulders */
    var barIn = el('g', {}); while (bar.firstChild) barIn.appendChild(bar.firstChild); bar.appendChild(barIn); barIn.setAttribute('transform', 'translate(193 124) scale(1.9 1.5) translate(-193 -124)');
    var ACTS = [
      { n: 'curl', t: 'curling', f: function () {
        var bells = el('g', { class: 'bells' }, [-1, 1].map(function (s) { return '<g transform="translate(' + (base[0] + s * 13 * H.s / .5) + ' ' + (base[1] - 2) + ') scale(' + (H.s / .5).toFixed(3) + ')">' + O.bell[0] + '</g>'; }).join('')); svg.appendChild(bells);
        return seq([function () { look(H, [base[0], base[1]]); L.face(H, 'calm'); return Promise.all([L.prop(R, H, 'bob', 16, 450), L.legs(R, H, .6, .6, -12, 12, 450), L.both(R, H, [base[0] - 13 * H.s / .5, base[1] - 2], [base[0] + 13 * H.s / .5, base[1] - 2], 450)]); },
          function () { bells.remove(); take(H, 'R', 'bell'); take(H, 'L', 'bell'); look(H, null); return Promise.all([L.prop(R, H, 'bob', 0, 450), L.legs(R, H, 0, 0, 0, 0, 450), L.both(R, H, fit(H, -16, -42), fit(H, 16, -42), 450)]); },
          function () { L.face(H, 'grin'); return L.tw(R, 3000, function (u) { var a = u * Math.PI * 6, r = Math.max(0, Math.sin(a)), l = Math.max(0, -Math.sin(a)); H.hand.R = fit(H, 16 - r * 4, -42 - r * 30); H.hand.L = fit(H, -16 + l * 4, -42 - l * 30); H.head = [Math.sin(a) * 2, 0]; }); },
          function () { L.face(H, 'cool'); L.say(H, T('One more!', 'Én til!'), 1300); return L.wait(R, 600); },
          function () { return Promise.all([L.prop(R, H, 'bob', 16, 450), L.legs(R, H, .6, .6, -12, 12, 450), L.both(R, H, [base[0] - 13 * H.s / .5, base[1] - 2], [base[0] + 13 * H.s / .5, base[1] - 2], 450)]); },
          function () { L.letGo(H, 'R'); L.letGo(H, 'L'); var b2 = el('g', {}, bells.innerHTML); svg.appendChild(b2); setTimeout(function () { b2.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).onfinish = function () { b2.remove(); }; }, 1500); return Promise.all([L.prop(R, H, 'bob', 0, 450), L.legs(R, H, 0, 0, 0, 0, 450)]); }]);
      } },
      { n: 'barbell', t: 'lifting the barbell', f: function () {
        var c0 = [193, 115.5], GX = 24;
        function carry() { var c = mid(H); bar.setAttribute('transform', 'translate(' + (c[0] - c0[0]).toFixed(2) + ' ' + (c[1] - c0[1]).toFixed(2) + ')'); }
        return seq([function () { L.face(H, 'calm'); return L.walk(R, H, [193, base[1] - 6], 20); },
          function () { look(H, c0); return Promise.all([L.prop(R, H, 'bob', 15, 500), L.legs(R, H, .6, .6, -14, 14, 500)]); },
          function () { return L.both(R, H, [193 - GX, 115.5], [193 + GX, 115.5], 450); },
          function () { L.face(H, 'wow'); look(H, null); return L.tw(R, 1100, function (u) { var e = ease(u), y = lerp(115.5, H.pos[1] - 64 * H.s, e); H.bob = 15 * (1 - e); H.legs.R = H.legs.L = .6 * (1 - e); H.legs.sR = -14 * (1 - e); H.legs.sL = 14 * (1 - e); H.hand.L = [193 - GX, y]; H.hand.R = [193 + GX, y]; carry(); }); },
          function () { return L.tw(R, 500, function (u) { var e = ease(u), y = lerp(H.pos[1] - 64 * H.s, H.pos[1] - 76 * H.s, e); H.hand.L = [193 - GX, y]; H.hand.R = [193 + GX, y]; carry(); }); },
          function () { L.face(H, 'cool'); L.say(H, T('Strong!', 'Sterk!'), 1300); return L.tw(R, 1100, function (u) { H.bob = -Math.abs(Math.sin(u * Math.PI * 2)) * 1.5; carry(); }); },
          function () { L.face(H, 'calm'); return L.tw(R, 1300, function (u) { var e = ease(u), y = u < .5 ? lerp(H.pos[1] - 76 * H.s, H.pos[1] - 64 * H.s, e * 2) : lerp(H.pos[1] - 64 * H.s, 115.5, (e - .5) * 2); if (u > .5) { H.bob = 15 * (u - .5) * 2; H.legs.R = H.legs.L = .6 * (u - .5) * 2; } H.hand.L = [193 - GX, y]; H.hand.R = [193 + GX, y]; carry(); }); },
          function () { bar.setAttribute('transform', ''); return L.settle(R, H, 450); },
          function () { return L.walk(R, H, base, 20); }]);
      } },
      { n: 'heart', t: 'checking the pulse', f: function () {
        return seq([function () { L.face(H, 'wow'); look(H, [50, 72]); return L.turnTo(R, H, -.6, 300); },
          function () { return L.reach(R, H, 'L', fit(H, -4, -70), 400); },
          function () { L.say(H, T('Heart’s pumping!', 'Pulsen går!'), 1600); heart.style.transformBox = 'fill-box'; heart.style.transformOrigin = 'center'; heart.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 300, iterations: 6 }); return L.wait(R, 1800); },
          function () { look(H, null); }]);
      } },
      { n: 'jacks', t: 'jumping jacks', f: function () { look(H, null); L.face(H, 'grin'); return L.tw(R, 3600, function (u) { var a = Math.sin(u * Math.PI * 6), up = (1 - Math.cos(u * Math.PI * 6)) / 2; H.bob = -Math.abs(a) * 6; H.legs.sR = -16 * up; H.legs.sL = 16 * up; H.rot.R = [-160 * up, -10 * up]; H.rot.L = [160 * up, 10 * up]; }); } },
      { n: 'drink', t: 'drinking water', f: function () {
        var o;
        return seq([function () { L.face(H, 'calm'); return L.reach(R, H, 'R', fit(H, 14, -44), 300); },
          function () { o = take(H, 'R', 'bottle'); return Promise.all([L.reach(R, H, 'R', fit(H, 8, -88), 600), L.headTo(R, H, -9, -1, 600), L.tw(R, 600, function (u) { o.rot = -70 * ease(u); })]); },
          function () { return L.wait(R, 1000); },
          function () { L.face(H, 'grin'); L.say(H, T('Water!', 'Vann!'), 1300); return Promise.all([L.reach(R, H, 'R', fit(H, 14, -44), 400), L.tw(R, 400, function (u) { o.rot = -70 * (1 - ease(u)); })]); },
          function () { L.letGo(H, 'R'); }]);
      } },
      C.stretch
    ];
    return start(svg, H, R, ACTS, 'habits');
  };

  }
  var real = null; window.SceneLive = window.SceneLive || {};
  window.SceneLive.habits = function (svg, data) { real = real || make(); return real ? real(svg, data) : null; };
})();
