/* The living Wish picture (Phase L6) – your avatar's actions on this page, built from the rig, the scene engine
   and the shared props (scene-common.js), on top of the still picture from scenes.js. */
(function () {
  'use strict';
  /* made on first use: the engine and the shared props load after this page's own code */
  function make() {
  var L = window.Live, K = window.SceneCommon; if (!L || !K) return null;
  var el = L.el, rnd = L.rnd, ease = L.ease, lerp = L.lerp, T = K.T, fit = K.fit, seq = K.seq, mid = K.mid, mount = K.mount, look = K.look, O = K.O, take = K.take, tipOf = K.tipOf, common = K.common, start = K.start, spin = K.spin, fall = K.fall, drip = K.drip;
  /* ================= WISH LIST: the cart, the gift into the cart, the list from the bag ================= */
  return function (svg, data) {
    var m = mount(svg); if (!m) return null; data = data || {};
    var cart = svg.querySelector('.sc-cart'), gift = svg.querySelector('[data-scgo="wbought"]'), bag = svg.querySelector('[data-scgo="wbuy"]');
    m.me.remove();
    var H = L.Hero(svg, null, m.box), R = L.Run(), C = common(R, H, svg), base = H.pos.slice();
    svg.appendChild(cart.parentNode); svg.appendChild(bag);    /* the cart and the bag are in front of you */
    var inCart = el('g', { class: 'incart', style: 'opacity:0' }, '<g transform="translate(55 104) scale(.55) translate(-165 -112)">' + gift.innerHTML + '</g>'); cart.appendChild(inCart);
    function cartAt(dx) { cart.setAttribute('transform', 'translate(' + dx.toFixed(2) + ' 0)'); }
    var pushing = false; H.onStep = function () { if (pushing) cartAt(H.pos[0] - base[0]); };
    var ACTS = [
      { n: 'push', t: 'pushing the cart', f: function () {
        return seq([function () { L.face(H, 'grin'); look(H, [60, 110]); return L.turnTo(R, H, .7, 300); },
          function () { return L.both(R, H, [31, 104], [35, 104], 400); },
          function () { pushing = true; L.say(H, T('Shopping!', 'Handletur!'), 1400); return L.walk(R, H, [base[0] + 30, base[1]], 16, null, .7); },
          function () { return L.walk(R, H, base, 16, null, .7, 1); },
          function () { pushing = false; cartAt(0); look(H, null); }]);
      } },
      { n: 'gift', t: 'putting the gift in the cart', f: function () {
        var g0 = [165, 112], carrying = false;
        (function fr() { if (carrying) { var c = mid(H); gift.setAttribute('transform', 'translate(' + (c[0] - g0[0]).toFixed(2) + ' ' + (c[1] - g0[1] + 3).toFixed(2) + ')'); } if (carrying !== null) requestAnimationFrame(fr); })();
        return seq([function () { L.face(H, 'starry'); return L.walk(R, H, [143, base[1]], 22, null, .7); },
          function () { look(H, g0); return Promise.all([L.prop(R, H, 'bob', 10, 450), L.legs(R, H, .6, .6, -12, 12, 450), L.both(R, H, [151, 113], [179, 113], 500)]); },
          function () { svg.appendChild(gift); carrying = true; return Promise.all([L.prop(R, H, 'bob', 0, 500), L.legs(R, H, 0, 0, 0, 0, 500), L.both(R, H, fit(H, -16, -58), fit(H, 16, -58), 500)]); },
          function () { return L.turnTo(R, H, 'front', 300); },
          function () { look(H, null); L.say(H, T('Bought it!', 'Kjøpt!'), 1400); L.burst(svg, mid(H), 6); return L.both(R, H, fit(H, -16, -120), fit(H, 16, -120), 450); },
          function () { return L.wait(R, 700); },
          function () { return L.both(R, H, fit(H, -16, -58), fit(H, 16, -58), 400); },
          function () { return L.walk(R, H, [74, base[1]], 22, null, -.7); },
          function () { look(H, [55, 104]); return L.both(R, H, [47, 100], [63, 100], 450); },
          function () { carrying = null; gift.style.opacity = 0; gift.setAttribute('transform', ''); inCart.style.opacity = 1; return L.settle(R, H, 400); },
          function () { look(H, null); return L.walk(R, H, base, 22); },
          function () { /* a few seconds later the shop puts a new one out */ setTimeout(function () { inCart.style.opacity = 0; svg.insertBefore(gift, H.layB); gift.style.opacity = ''; gift.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600 }); }, 4000); }]);
      } },
      { n: 'bag', t: 'taking the list from the bag', f: function () {
        var o;
        return seq([function () { L.face(H, 'calm'); return L.walk(R, H, [82, base[1]], 22, null, .7); },
          function () { look(H, [115, 86]); return Promise.all([L.prop(R, H, 'lean', 8, 400), L.reach(R, H, 'R', [108, 92], 450)]); },
          function () { L.wob(bag, 4, 400); return L.reach(R, H, 'R', [110, 100], 250); },
          function () { o = take(H, 'R', 'paperBack'); return L.reach(R, H, 'R', [108, 84], 300); },
          function () { return Promise.all([L.prop(R, H, 'lean', 0, 400), L.turnTo(R, H, 'front', 350), L.reach(R, H, 'R', fit(H, 8, -58), 450)]); },
          function () { look(H, L.handAt(H, 'R')); return L.headTo(R, H, 6, 1.5, 300); },
          function () { return L.wait(R, 900); },
          function () { look(H, null); L.face(H, 'love'); L.say(H, T('What’s next?', 'Hva blir det neste?'), 1700); return L.wait(R, 1300); },
          function () { look(H, [115, 86]); return Promise.all([L.turnTo(R, H, .7, 300), L.prop(R, H, 'lean', 8, 400), L.reach(R, H, 'R', [110, 100], 500)]); },
          function () { L.letGo(H, 'R'); look(H, null); return Promise.all([L.prop(R, H, 'lean', 0, 400), L.reach(R, H, 'R', null, 400)]); },
          function () { return L.walk(R, H, base, 22); }]);
      } },
      { n: 'dream', t: 'daydreaming', f: function () {
        var b = el('g', {}, '<circle cx="-14" cy="14" r="1.8" fill="#fff"/><circle cx="-9" cy="9" r="2.6" fill="#fff"/><ellipse rx="15" ry="10" fill="#fff"/><path d="M-5 1a5 5 0 0 1 10 0" stroke="#5b6b8c" stroke-width="1.6" fill="none"/><rect x="-6.5" y="0" width="3.4" height="5" rx="1.2" fill="#e5484d"/><rect x="3.1" y="0" width="3.4" height="5" rx="1.2" fill="#e5484d"/>');
        b.setAttribute('transform', 'translate(' + (H.pos[0] + 26) + ' ' + (H.pos[1] - 76) + ')');
        return seq([function () { L.face(H, 'love'); look(H, [H.pos[0] + 26, H.pos[1] - 76]); return Promise.all([L.reach(R, H, 'R', fit(H, 7, -80), 500), L.headTo(R, H, -8, -1, 500)]); },
          function () { svg.appendChild(b); b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); return L.wait(R, 2200); }, function () { b.remove(); look(H, null); }]);
      } },
      C.think(T('Should I buy it?', 'Skal jeg kjøpe den?'))
    ];
    return start(svg, H, R, ACTS, 'wish');
  };

  }
  var real = null; window.SceneLive = window.SceneLive || {};
  window.SceneLive.wish = function (svg, data) { real = real || make(); return real ? real(svg, data) : null; };
})();
