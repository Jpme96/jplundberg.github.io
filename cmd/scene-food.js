/* The living Food picture (Phase L6) – your avatar's actions on this page, built from the rig, the scene engine
   and the shared props (scene-common.js), on top of the still picture from scenes.js. */
(function () {
  'use strict';
  /* made on first use: the engine and the shared props load after this page's own code */
  function make() {
  var L = window.Live, K = window.SceneCommon; if (!L || !K) return null;
  var el = L.el, rnd = L.rnd, ease = L.ease, lerp = L.lerp, T = K.T, fit = K.fit, seq = K.seq, mid = K.mid, mount = K.mount, look = K.look, O = K.O, take = K.take, tipOf = K.tipOf, common = K.common, start = K.start, spin = K.spin, fall = K.fall, drip = K.drip;
  /* ================= FOOD: stove beside you, fridge opened from the side, milk into the pot ================= */
  return function (svg, data) {
    var m = mount(svg); if (!m) return null; data = data || {};
    m.me.remove();
    var fridge = svg.querySelector('.sc-fridge'), bag = svg.querySelector('[data-scgo="shop"]');
    var inside = el('rect', { x: 11, y: 73, width: 42, height: 54, rx: 3, fill: '#fff6cf' }); fridge.parentNode.insertBefore(inside, fridge.nextSibling);
    inside.insertAdjacentHTML('afterend', '<g class="fr-items"><g class="fr-milk"><path d="M17 100h6v9h-6z" fill="#f2f2f2"/><path d="M17 100l3 -2.4 3 2.4z" fill="#dfe3ea"/><rect x="17" y="103" width="6" height="2.4" fill="#3987e5"/></g><circle cx="34" cy="105" r="4" fill="#e5484d"/><rect x="40" y="100" width="7" height="10" rx="1.5" fill="#f2c94c"/><path d="M13 109.5h38" stroke="#d9cfa0" stroke-width="1"/></g>');
    var door = el('g', { class: 'frdoor' }, '<rect x="10" y="72" width="44" height="56" rx="4" style="fill:' + getComputedStyle(fridge).fill + ';stroke:' + getComputedStyle(fridge).stroke + '" stroke-width="1.2"/><rect x="47" y="80" width="2.5" height="16" rx="1" class="sc-handle"/>'); svg.querySelector('[data-scgo="meals"]').appendChild(door);
    function doorAt(k) { door.setAttribute('transform', 'translate(10 0) scale(' + (1 - .82 * k).toFixed(3) + ' 1) translate(-10 0)'); return 10 + 38.5 * (1 - .82 * k); }
    var H = L.Hero(svg, null, m.box), R = L.Run(), C = common(R, H, svg), base = H.pos.slice();
    svg.appendChild(bag);   /* the bag stands in front of you when you reach into it */
    function steam(n) { for (var i = 0; i < n; i++) (function (i) { setTimeout(function () { var g = el('g', {}, '<path d="M0 0q-3-4 0-8t0-8" stroke="rgba(255,255,255,.7)" stroke-width="1.8" fill="none" stroke-linecap="round"/>'); svg.appendChild(g); var x = 196 + rnd(-6, 12); g.animate([{ transform: 'translate(' + x + 'px,80px)', opacity: 0 }, { opacity: .9, offset: .25 }, { transform: 'translate(' + (x + rnd(-3, 3)) + 'px,58px)', opacity: 0 }], { duration: 1400 }).onfinish = function () { g.remove(); }; }, i * 420); })(i); }
    var ACTS = [
      { n: 'stir', t: 'stirring the pot', f: function () {
        var o;
        return seq([function () { L.face(H, 'calm'); return L.walk(R, H, [178, base[1]], 20, null, .7); },
          function () { o = take(H, 'R', 'spoon'); look(H, [203, 84]); return L.reach(R, H, 'R', [203, 74], 450); },
          function () { steam(5); return L.tw(R, 2400, function (u) { var a = u * Math.PI * 7; H.hand.R = [203 + Math.cos(a) * 6, 75 + Math.sin(a) * 1.2]; }); },
          function () { return L.reach(R, H, 'R', [203, 70], 200); },
          function () {   /* taste: turn the spoon bowl-up and bring the bowl (not the fist) to the mouth */
            var mo = L.mouth(H), hd = L.handAt(H, 'R'), r0 = o.rot; o.rot = 150; var b = L.objPoint(H, o, [0, 3.6]); o.rot = r0;
            var to = [mo[0] - (b[0] - hd[0]), mo[1] - (b[1] - hd[1])];
            return Promise.all([L.reach(R, H, 'R', to, 450), L.tw(R, 450, function (u) { o.rot = r0 + (150 - r0) * L.ease(u); }), L.headTo(R, H, 3, -1, 400)]); },
          function () { look(H, null); L.face(H, 'love'); L.say(H, T('Mmm!', 'Mmm!'), 1400); return L.wait(R, 1100); },
          function () { L.tw(R, 300, function (u) { o.rot = 150 * (1 - L.ease(u)); }); return L.reach(R, H, 'R', fit(H, 16, -50), 300); },
          function () { L.letGo(H, 'R'); return Promise.all([L.settle(R, H, 350), L.headTo(R, H, 0, 0, 300)]); }, function () { return L.walk(R, H, base, 20); }]);
      } },
      { n: 'fridge', t: 'getting milk', f: function () {
        var o, milkInFridge = svg.querySelector('.fr-milk');
        return seq([function () { L.face(H, 'calm'); return L.walk(R, H, [66, base[1]], 24, null, -.7); },
          function () { look(H, [48.5, 88]); return L.reach(R, H, 'L', [48.5, 88], 400); },
          function () { return L.tw(R, 650, function (u) { H.hand.L = [doorAt(ease(u)), 88]; }); },
          function () { return L.reach(R, H, 'L', null, 250); },
          function () { return L.walk(R, H, [42, base[1]], 14, null, -.7); },
          function () { return L.turnTo(R, H, 'back', 300); },
          function () { return Promise.all([L.prop(R, H, 'bob', 3, 300), L.reach(R, H, 'L', [20, 103], 450)]); },
          function () { milkInFridge.style.opacity = 0; o = take(H, 'L', 'milk'); return Promise.all([L.prop(R, H, 'bob', 0, 300), L.reach(R, H, 'L', fit(H, -10, -64), 400)]); },
          /* the hand with the milk nudges the door shut */
          function () { return L.reach(R, H, 'L', [doorAt(1), 92], 350); },
          function () { return L.tw(R, 450, function (u) { H.hand.L = [doorAt(1 - ease(u)), 92]; }); },
          function () { return L.reach(R, H, 'L', fit(H, -10, -64), 300); },
          function () { return L.turnTo(R, H, 'front', 300); },
          function () { look(H, null); L.face(H, 'grin'); L.say(H, T('Milk!', 'Melk!'), 1200); return L.wait(R, 700); },
          function () { return L.reach(R, H, 'L', fit(H, 8, -62), 300); },
          function () { return L.walk(R, H, [178, base[1]], 24, null, .7); },
          /* hand it over to the right hand, nearest the pot, and pour */
          function () { return L.both(R, H, fit(H, 4, -66), fit(H, 6, -66), 300); },
          function () { L.letGo(H, 'L'); o = take(H, 'R', 'milk'); return Promise.all([L.reach(R, H, 'L', null, 300), L.reach(R, H, 'R', [200, 70], 450)]); },
          function () { look(H, [203, 84]); return L.tw(R, 1300, function (u) { o.rot = 105 * Math.min(1, u * 3) * (u > .8 ? (1 - u) * 5 : 1); if (u > .3 && u < .8 && Math.random() < .5) { var t = tipOf(H, o, 'milk'); drip(svg, t, '#f2f2f2'); } }); },
          function () { steam(3); o.rot = 0; return L.reach(R, H, 'R', [226, 92], 400); },
          function () { /* set it down beside the pot */ L.letGo(H, 'R'); var c = el('g', { class: 'carton' }, '<g transform="translate(226 92.5) scale(' + (H.s / .5).toFixed(3) + ') translate(0 -1.5)">' + O.milk[0] + '</g>'); svg.insertBefore(c, H.wrap); setTimeout(function () { c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: 'forwards' }).onfinish = function () { c.remove(); milkInFridge.style.opacity = 1; }; }, 4000); look(H, null); return L.settle(R, H, 350); },
          function () { return L.walk(R, H, base, 22); }]);
      } },
      { n: 'pantry', t: 'checking the pantry', f: function () {
        return seq([function () { L.face(H, 'calm'); return L.walk(R, H, [104, base[1]], 22, null, -.7); },
          function () { return L.turnTo(R, H, 'back', 300); },
          function () { return Promise.all([L.reach(R, H, 'R', [114, 70], 500), L.headTo(R, H, -6, -1, 400)]); },
          function () { return L.tw(R, 1200, function (u) { H.hand.R = [114 - u * 26, 70 + Math.sin(u * 9) * 1]; H.head = [-6 + u * 10, -1]; }); },
          function () { return L.reach(R, H, 'R', null, 300); }, function () { return L.turnTo(R, H, 'front', 300); },
          function () { look(H, null); L.face(H, 'shy'); L.say(H, T('Running low!', 'Snart tomt!'), 1500); return L.both(R, H, fit(H, -24, -74), fit(H, 24, -74), 350); },
          function () { return L.wait(R, 900); }, function () { return L.settle(R, H, 350); }, function () { return L.walk(R, H, base, 22); }]);
      } },
      { n: 'bag', t: 'checking the shopping list', f: function () {
        var o;
        return seq([function () { L.face(H, 'calm'); return L.walk(R, H, [148, base[1]], 22, null, -.7); },
          function () { look(H, [128, 110]); return Promise.all([L.prop(R, H, 'bob', 8, 450), L.legs(R, H, .6, .6, -12, 12, 450), L.reach(R, H, 'L', [129, 114], 500)]); },
          function () { L.wob(bag, 5, 400); return L.wait(R, 300); },
          function () { o = take(H, 'L', 'paperBack'); return Promise.all([L.prop(R, H, 'bob', 0, 450), L.legs(R, H, 0, 0, 0, 0, 450), L.reach(R, H, 'L', fit(H, -8, -58), 450)]); },
          function () { return L.turnTo(R, H, 'front', 300); },
          function () { look(H, L.handAt(H, 'L')); return L.headTo(R, H, 6, 1.5, 300); },
          function () { return L.wait(R, 900); },
          function () { look(H, null); L.face(H, 'wow'); L.say(H, T('What do we need?', 'Hva trenger vi?'), 1600); return L.wait(R, 1200); },
          function () { return L.turnTo(R, H, -.7, 300); },
          function () { look(H, [128, 110]); return Promise.all([L.prop(R, H, 'bob', 8, 400), L.legs(R, H, .6, .6, -12, 12, 400), L.reach(R, H, 'L', [129, 114], 450)]); },
          function () { L.letGo(H, 'L'); look(H, null); return Promise.all([L.prop(R, H, 'bob', 0, 400), L.legs(R, H, 0, 0, 0, 0, 400), L.reach(R, H, 'L', null, 400)]); },
          function () { return L.walk(R, H, base, 22); }]);
      } },
      C.think(T('Taco or pasta?', 'Taco eller pasta?')), C.wave
    ];
    return start(svg, H, R, ACTS, 'food');
  };

  }
  var real = null; window.SceneLive = window.SceneLive || {};
  window.SceneLive.food = function (svg, data) { real = real || make(); return real ? real(svg, data) : null; };
})();
