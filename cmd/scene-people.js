/* The living People picture (Phase L6, round 4) – you with up to four of your people (scenes.js draws them with their
   own looks): you walk over and say hi, high-five, blow out a birthday candle, call someone you should catch up with,
   take a group photo. Your people react with a little hop. Built from the rig, the scene engine and the shared props
   (scene-common.js), on top of the still picture. Made-up nothing: who's there and their marks come from People. */
(function () {
  'use strict';
  function make() {
  var L = window.Live, K = window.SceneCommon; if (!L || !K) return null;
  var el = L.el, rnd = L.rnd, T = K.T, fit = K.fit, seq = K.seq, mount = K.mount, look = K.look, take = K.take, common = K.common, start = K.start;
  return function (svg, data) {
    var m = mount(svg); if (!m) return null; data = data || {};
    m.me.remove();
    var H = L.Hero(svg, null, m.box), R = L.Run(), C = common(R, H, svg), base = H.pos.slice();
    /* your people, from the still picture: where each one stands (centre, feet, size) */
    var folk = [].slice.call(svg.querySelectorAll('.sc-mingle > .hs-part')).map(function (g) {
      var s = g.querySelector('svg'); if (!s) return null;
      var x = +s.getAttribute('x'), y = +s.getAttribute('y'), w = +s.getAttribute('width'), h = +s.getAttribute('height');
      return { g: g, x: x + w / 2, feet: y + h * .972, w: w, h: h, cake: g.querySelector('.sc-cake'), talk: !!g.querySelector('.sc-say.on') };
    }).filter(Boolean).sort(function (a, b) { return a.x - b.x; });
    var HW = 30 * H.s * (H.k || 1);                                    /* half your width, shoulder to hand */
    function hop(p, d) { if (p && p.g.animate) p.g.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-5px)', offset: .4 }, { transform: 'translateY(0)' }], { duration: 480, delay: d || 0, easing: 'ease-out' }); }
    /* your people are drawn with the same body: the rig can lift their arm (the one toward you), 0–1 */
    function arm(p, a, joy) { try { p.rig = p.rig || Rig(p.g.querySelector('svg'), null);
      if (joy) { Rig.rot(p.rig.L, 160 * a, -18 * a); Rig.rot(p.rig.R, -160 * a, 18 * a); } else Rig.rot(p.rig.L, 140 * a, 12 * a); } catch (e) {} }
    /* to 0–1; joy: both arms up (a birthday), otherwise the arm toward you (a high five) */
    function lift(p, to, ms, joy) { var a0 = p.lv || 0; return L.tw(R, ms, function (u) { p.lv = a0 + (to - a0) * L.ease(u); arm(p, p.lv, joy); }); }
    function standBy(p) { return [Math.max(base[0], p.x - p.w * .3 - HW), base[1]]; }   /* just left of them, facing them */
    function pick(f) { var l = folk.filter(f || function () { return true; }); return l[Math.floor(Math.random() * l.length)] || null; }
    function back() { return seq([function () { look(H, null); return L.walk(R, H, base, 22); }, function () { return L.turnTo(R, H, 'front', 250); }]); }
    function go(p) { return L.walk(R, H, standBy(p), 22, null, .7); }
    var ACTS = function () {
      var a = [];
      if (folk.length) a.push(
        { n: 'greet', t: 'saying hi', f: function () { var p = folk[0];   /* the one next to you – walking further would stop on top of someone */
          return seq([function () { L.face(H, 'grin'); return go(p); },
            function () { look(H, [p.x, p.feet - p.h * .8]); L.say(H, T('Hi!', 'Hei!'), 1300); hop(p, 250); return L.wave(R, H, 'R', 1100); },
            back]); } },
        { n: 'highfive', t: 'high five', f: function () { var p = folk[0];
          return seq([function () { L.face(H, 'laugh'); return go(p); },
            function () { var meet = [(H.pos[0] + p.x) / 2, p.feet - p.h * .9]; look(H, meet); return Promise.all([L.reach(R, H, 'R', meet, 420), L.headTo(R, H, 4, -1.5, 350), lift(p, 1, 420)]); },
            function () { L.burst(svg, [(H.pos[0] + p.x) / 2, p.feet - p.h * .95], 6); hop(p); L.say(H, T('High five!', 'Gi meg fem!'), 1300); return L.wait(R, 600); },
            function () { return Promise.all([L.settle(R, H, 350), lift(p, 0, 380)]); }, back]); } },
        { n: 'photo', t: 'taking a group photo', f: function () { var o;
          return seq([function () { L.face(H, 'grin'); return L.turnTo(R, H, .7, 300); },
            function () { o = take(H, 'R', 'phone', { rot: 90 }); look(H, [folk[0].x, folk[0].feet - 40]); return Promise.all([L.reach(R, H, 'R', fit(H, 20, -94), 450), L.reach(R, H, 'L', fit(H, 12, -90), 450)]); },
            function () { L.say(H, T('Smile!', 'Smil!'), 1100); folk.forEach(function (p, i) { hop(p, 120 * i); }); return L.wait(R, 700); },
            function () { var f = el('rect', { x: 0, y: 0, width: 240, height: 150, fill: '#fff', 'pointer-events': 'none' }); svg.appendChild(f); var an = f.animate([{ opacity: .75 }, { opacity: 0 }], { duration: 380 }); an.onfinish = function () { f.remove(); }; return L.wait(R, 600); },
            function () { L.face(H, 'love'); L.say(H, T('Nice one!', 'Fint bilde!'), 1200); return L.wait(R, 900); },
            function () { L.letGo(H, 'R'); look(H, null); return Promise.all([L.settle(R, H, 350), L.turnTo(R, H, 'front', 300)]); }]); } }
      );
      /* a birthday: walk to the cake, blow the candle out, confetti, then it lights again */
      var bd = folk.filter(function (p) { return p.cake; })[0];
      if (bd) a.push({ n: 'cake', t: 'blowing out the candle', w: 3, f: function () {
        var cm = bd.cake.transform.baseVal.consolidate(), mx = cm ? cm.matrix : { a: 1, e: bd.x, f: bd.feet - 40 };
        var top = [mx.e, mx.f - 18.6 * mx.a], fl = bd.cake.querySelector('.sc-flame');
        return seq([function () { L.face(H, 'grin'); return go(bd); },
          function () { look(H, top); return Promise.all([L.prop(R, H, 'lean', 8, 400), L.headTo(R, H, 5, 2, 400)]); },
          function () { L.face(H, 'wow'); /* a puff of air from the mouth to the candle */
            var mo = L.mouth(H), pf = el('g', { 'pointer-events': 'none' }, '<path d="M0 -1.6q3 -1.4 6 0M0 0h7M0 1.6q3 1.4 6 0" stroke="#cfe8ff" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".9"/>'); svg.appendChild(pf);
            var an = pf.animate([{ transform: 'translate(' + mo[0] + 'px,' + mo[1] + 'px)', opacity: 1 }, { transform: 'translate(' + (top[0] - 6) + 'px,' + top[1] + 'px)', opacity: .2 }], { duration: 500, easing: 'ease-out' }); an.onfinish = function () { pf.remove(); };
            return L.wait(R, 480); },
          function () { if (fl) fl.style.visibility = 'hidden'; L.burst(svg, [top[0], top[1] - 4], 8); hop(bd); L.face(H, 'laugh'); L.say(H, T('Happy birthday!', 'Gratulerer med dagen!'), 1700); return Promise.all([L.prop(R, H, 'lean', 0, 400), L.headTo(R, H, 0, 0, 400), lift(bd, 1, 400, true)]); },
          function () { return L.wait(R, 1300); },
          function () { if (fl) fl.style.visibility = ''; return Promise.all([lift(bd, 0, 400, true), back()]); }]); } });
      /* someone you should catch up with: a call */
      if (folk.some(function (p) { return p.talk; })) a.push({ n: 'call', t: 'calling someone', w: 2, f: function () { var o, p = pick(function (q) { return q.talk; });
        return seq([function () { L.face(H, 'calm'); look(H, [p.x, p.feet - p.h * .8]); return L.reach(R, H, 'R', fit(H, 14, -44), 350); },
          function () { o = take(H, 'R', 'phone'); return Promise.all([L.reach(R, H, 'R', L.bodyAt(H, 21, 64), 500), L.headTo(R, H, 3, 1, 400)]); },
          function () { L.face(H, 'grin'); L.say(H, T('Long time no talk!', 'Lenge siden sist!'), 1700); hop(p, 300); return L.tw(R, 1900, function (u) { H.head = [3 + Math.sin(u * 9) * 1.4, 1]; }); },
          function () { return L.reach(R, H, 'R', fit(H, 14, -44), 400); }, function () { L.letGo(H, 'R'); look(H, null); return Promise.all([L.settle(R, H, 300), L.headTo(R, H, 0, 0, 300)]); }]); } });
      if (data.gift) a.push(C.think(T('What should I give?', 'Hva skal jeg gi?')));
      if (!folk.length) a.push(C.think(T('Who’s missing?', 'Hvem mangler?')));
      a.push(C.wave);
      return a;
    };
    return start(svg, H, R, ACTS, 'people');
  };
  }
  var real = null; window.SceneLive = window.SceneLive || {};
  window.SceneLive.people = function (svg, data) { real = real || make(); return real ? real(svg, data) : null; };
})();
