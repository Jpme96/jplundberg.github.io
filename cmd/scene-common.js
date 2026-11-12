/* What the living page pictures share (Phase L3–L5): the props (drawing, grip point, named points – at the size of
   the hand), the everyday actions every page can use (wave, phone, stretch, cheer, think, coffee) and the helpers
   that mount a scene on the still picture from scenes.js and start its brain. One file per page (scene-<page>.js)
   holds that page's objects and actions and registers itself as SceneLive.<page>. */
(function () {
  'use strict';
  var L = window.Live; if (!L || window.SceneCommon) return;
  var el = L.el, rnd = L.rnd, ease = L.ease, lerp = L.lerp, NB = window.I18N && window.I18N.lang === 'nb';
  function T(en, nb) { return NB ? nb : en; }
  function fit(H, fx, fy) { var k = H.s * (H.k || 1); return [H.pos[0] + fx * k, H.pos[1] + fy * k]; }
  function seq(fns) { return fns.reduce(function (p, f) { return p.then(f); }, Promise.resolve()); }
  function boxOf(me) { var s = me.querySelector('svg'); return { x: +s.getAttribute('x'), y: +s.getAttribute('y'), w: +s.getAttribute('width'), h: +s.getAttribute('height') }; }
  function mid(H) { var a = L.handAt(H, 'L'), b = L.handAt(H, 'R'); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  /* the still picture is already drawn (scenes.js): find your still avatar in it – no avatar (switched off), no living scene */
  function oldLive() { try { return localStorage.getItem('cmd.oldLive') === '1'; } catch (e) { return false; } }
  /* F1b: with the 2.5D figure the old living scenes (flat rig) stay off until F2 redoes each page in 2.5D; tests of the old engine set cmd.oldLive */
  function mount(svg) { if (!svg || L.still() || !window.Rig || !window.Avatar || (window.Fig25 && !oldLive())) return null; var me = svg.querySelector('.sc-me'); if (!me || !me.querySelector('svg')) return null; return { svg: svg, me: me, box: boxOf(me) }; }
  function look(H, P) { H.gaze = P; }
  /* props, drawn at the size of a 0.5-scale avatar; [drawing, grip point, named points] */
  var O = {
    phone: ['<rect x="-3.2" y="-5" width="6.4" height="10" rx="1.4" fill="#2b2f3a"/><circle cx="-1.3" cy="-3.1" r=".9" fill="#0d0f14"/><circle cx="-1.3" cy="-3.1" r=".4" fill="#4a5a7b"/>', [0, 2.5]],
    mug: ['<rect x="-3" y="-3.6" width="6" height="7.2" rx="1.4" fill="#f2f2f2"/><path d="M3 -2q3.2 0 3.2 2.2t-3.2 2.2" stroke="#f2f2f2" stroke-width="1.2" fill="none"/><rect x="-3" y="-3.6" width="6" height="1.3" fill="#6b4a35"/>', [5.8, .2]],
    bottle: ['<rect x="-1.8" y="-5" width="3.6" height="9" rx="1.3" fill="#3987e5"/><rect x="-1.1" y="-6.6" width="2.2" height="1.8" rx=".5" fill="#e8eaf0"/>', [0, 1]],
    can: ['<path d="M-4 -3h8v7.5q0 1-1 1h-6q-1 0-1-1z" fill="#4fb3a9"/><path d="M-4 -2q-4.2 1.6 0 5.2" stroke="#2f8f86" stroke-width="1.3" fill="none"/><path d="M3.5 1l7 -5" stroke="#4fb3a9" stroke-width="1.7" stroke-linecap="round"/><ellipse cx="10.7" cy="-4.2" rx="1.3" ry=".8" fill="#2f8f86"/>', [-6.2, .6], { tip: [10.9, -4.2] }],
    milk: ['<path d="M-3 -4h6v9h-6z" fill="#f2f2f2"/><path d="M-3 -4l3 -2.4 3 2.4z" fill="#dfe3ea"/><rect x="-3" y="-1" width="6" height="2.4" fill="#3987e5"/>', [0, 1.5], { tip: [0, -6.4] }],
    coin: ['<circle r="2.8" fill="#f2c94c" stroke="#c98500" stroke-width=".8"/>', [0, 0]],
    spoon: ['<path d="M0 -9v11" stroke="#b07a45" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="0" cy="3.6" rx="2" ry="2.6" fill="#b07a45"/>', [0, -7]],
    salt: ['<rect x="-2.2" y="-3.5" width="4.4" height="7" rx="1.2" fill="#f2f2f2"/><rect x="-2.2" y="-4.6" width="4.4" height="1.8" rx=".6" fill="#9aa3b2"/>', [0, 1.5], { tip: [0, -4.8] }],
    bell: ['<rect x="-6" y="-1.2" width="12" height="2.4" rx=".8" fill="#bbb"/><rect x="-7.4" y="-4" width="2.2" height="8" rx=".8" fill="#666"/><rect x="5.2" y="-4" width="2.2" height="8" rx=".8" fill="#666"/>', [0, 0]],
    paperBack: ['<rect x="-5" y="-6.5" width="10" height="13" rx=".8" fill="#ece7dc"/><path d="M-3 -3.5h6M-3 -1h6M-3 1.5h4" stroke="#d6d0c2" stroke-width=".7"/>', [0, 4]],
    paper: ['<rect x="-5" y="-6.5" width="10" height="13" rx=".8" fill="#f8f5ee"/><path d="M-3 -3.5h6M-3 -1h6M-3 1.5h4" stroke="#9aa3b2" stroke-width=".8"/>', [0, 4]],
    stamp: ['<rect x="-1.4" y="-6" width="2.8" height="5" rx="1" fill="#8a5a2b"/><rect x="-3.4" y="-1.2" width="6.8" height="2.6" rx=".8" fill="#e5484d"/>', [0, -4.5], { face: [0, 1.4] }],
    lighter: ['<rect x="-1.2" y="-2" width="2.4" height="5" rx=".6" fill="#e5484d"/><rect x="-.9" y="-3.2" width="1.8" height="1.4" fill="#9aa3b2"/><ellipse cx="0" cy="-4.8" rx=".9" ry="1.5" fill="#ffb300"/>', [0, 1.5], { tip: [0, -4.8] }],
    cloth: ['<path d="M-3.5 -2.5q3.5 -1.5 7 0l-.6 5q-3 1.2-5.8 0z" fill="#8fd0ff"/>', [0, 0]],
    mapBack: ['<rect x="-7" y="-5" width="14" height="10" rx="1" fill="#e6dab8"/><path d="M-2.3 -5v10M2.3 -5v10" stroke="#d6c69a" stroke-width=".6"/>', [-6, 1]],
    map: ['<rect x="-7" y="-5" width="14" height="10" rx="1" fill="#f2e6c4"/><path d="M-2.3 -5v10M2.3 -5v10" stroke="#d6c69a" stroke-width=".6"/><path d="M-5.5 3q3-5 6-2t4-4" stroke="#e5484d" stroke-width=".9" fill="none" stroke-dasharray="1.4 1.2"/><circle cx="4.6" cy="-3.2" r="1" fill="#e5484d"/>', [-6, 1]],
    gift: ['<rect x="-6" y="-4" width="12" height="9" rx="1" fill="#3987e5"/><rect x="-1.2" y="-4" width="2.4" height="9" fill="#f2c94c"/><path d="M0 -4q-3-3-4-.5q1 1 4 .5q3-3 4-.5q-1 1-4 .5" fill="#f2c94c"/>', [0, 0]]
  };
  function take(H, side, k, opt) { return L.Obj(H, side, O[k][0], O[k][1], opt); }
  function tipOf(H, o, k) { return L.objPoint(H, o, O[k][2].tip || O[k][2].face); }
  function common(R, H, svg) {
    return {
      wave: { n: 'wave', t: 'waving', f: function () { look(H, null); L.face(H, 'grin'); L.say(H, T('Hi!', 'Hei!'), 1400); return L.wave(R, H); } },
      phone: function (txt) { return { n: 'phone', t: 'reading messages', f: function () { var o; L.face(H, 'calm'); return seq([function () { return L.reach(R, H, 'R', fit(H, 14, -44), 350); }, function () { o = take(H, 'R', 'phone'); return L.reach(R, H, 'R', fit(H, 7, -66), 450); }, function () { look(H, L.handAt(H, 'R')); return L.headTo(R, H, 5, 1.5, 300); }, function () { return L.wait(R, 1100); }, function () { L.face(H, 'laugh'); look(H, null); L.say(H, txt || 'Haha', 1400); return L.wait(R, 1100); }, function () { return L.reach(R, H, 'R', fit(H, 14, -44), 350); }, function () { L.letGo(H, 'R'); }]); } }; },
      stretch: { n: 'stretch', t: 'stretching', f: function () { look(H, null); L.face(H, 'calm'); L.say(H, T('Aaah', 'Aaah'), 1300); return L.both(R, H, fit(H, -14, -152), fit(H, 14, -152), 600).then(function () { return L.tw(R, 1100, function (u) { H.lean = Math.sin(u * Math.PI * 2) * 4; }); }); } },
      cheer: function (txt) { return { n: 'cheer', t: 'cheering', f: function () { look(H, null); L.face(H, 'laugh'); L.say(H, txt, 1500); L.burst(svg, fit(H, 0, -130), 6); return L.tw(R, 1200, function (u) { var j = Math.abs(Math.sin(u * Math.PI * 2)); H.bob = -j * 7 * H.s / .5; H.rot.R = [-160, -10]; H.rot.L = [160, 10]; H.legs.R = H.legs.L = j * .4; }); } }; },
      think: function (txt) { return { n: 'think', t: 'thinking', f: function () { L.face(H, 'calm'); look(H, fit(H, -40, -170)); return L.reach(R, H, 'R', fit(H, 7, -80), 500).then(function () { L.say(H, txt, 1500); return L.tw(R, 1500, function (u) { H.head = [-4 + Math.sin(u * 6) * 2, -1]; }); }).then(function () { look(H, null); }); } }; },
      /* a coffee break, for pictures that have a cup: pick it up by the handle, drink at the mouth, put it back */
      coffee: { n: 'coffee', t: 'coffee break', f: function () { var o; L.face(H, 'calm'); return seq([function () { return L.reach(R, H, 'R', L.chest(H), 350); }, function () { o = take(H, 'R', 'mug'); return L.drink(R, H, 'R', o, 900); }, function () { L.face(H, 'love'); L.say(H, T('Ahh', 'Ahh'), 1300); return L.reach(R, H, 'R', L.chest(H).map(function (v, i) { return v + (i ? 6 : 9) * H.s; }), 400); }, function () { return L.wait(R, 600); }, function () { L.letGo(H, 'R'); }]); } }
    };
  }
  window.SceneLive = window.SceneLive || {};
  function start(svg, H, R, ACTS, key) {
    R.alive = function () { return svg.isConnected; };
    var list = function () { return (typeof ACTS === 'function' ? ACTS() : ACTS).filter(function (a) { return !a.bad && a.w !== 0; }); };
    L.brain(R, H, list, function () { look(H, null); return L.jump(R, H); });
    var all = function () { return typeof ACTS === 'function' ? ACTS() : ACTS; };
    var api = { H: H, R: R, acts: all, run: function (n) { var a = all().filter(function (x) { return x.n === n; })[0]; R.paused = true; return Promise.resolve(R.cur).then(function () { R.tok++; L.clear(H); return L.settle(R, H, 200); }).then(function () { return a ? a.f() : null; }).then(function () { return L.settle(R, H, 300); }); } };
    window.SceneLive['_' + key] = api; return api;
  }
  function spin(sel, svg, ms, turns) { svg.querySelectorAll(sel).forEach(function (h) { var t = h.getAttribute('transform') || '', m = t.match(/rotate\((\S+) (\S+) (\S+)\)/), c = m ? [m[2], m[3]] : [h.getAttribute('x1'), h.getAttribute('y1')], a0 = m ? +m[1] : 0, t0 = performance.now(); (function fr(now) { var u = Math.min(1, (now - t0) / ms); h.setAttribute('transform', 'rotate(' + (a0 + 360 * turns * ease(u)) + ' ' + c[0] + ' ' + c[1] + ')'); if (u < 1) requestAnimationFrame(fr); else h.setAttribute('transform', t); })(t0); }); }
  function fall(svg, inner, a, b, ms, before) { var g = el('g', {}, inner); if (before) before.parentNode.insertBefore(g, before); else svg.appendChild(g); return new Promise(function (res) { var t0 = performance.now(); (function fr(now) { var u = Math.min(1, (now - t0) / ms); g.setAttribute('transform', 'translate(' + lerp(a[0], b[0], u).toFixed(2) + ' ' + lerp(a[1], b[1], u * u).toFixed(2) + ')'); if (u < 1) requestAnimationFrame(fr); else { g.remove(); res(); } })(t0); }); }
  function drip(svg, P, col) { fall(svg, '<path d="M0 0q-1.2 1.8 0 2.7q1.2-.9 0-2.7z" fill="' + (col || '#8fd0ff') + '"/>', P, [P[0] + rnd(-1, 1), P[1] + 14], 420); }
  /* real sizes (Phase L4): each object in the page pictures, as a share of your height (you ≈ 1.75 m), with the range it
     must stay in – the scene-sizes test measures them. [selector, nth match, min, max, what]. Big symbols (the money jar,
     the wall calendar, the mountain) are left out on purpose: they're made reachable instead (the ladder). */
  var SIZES = {
    food: [['[data-scgo="meals"]', 0, .9, 1.25, 'fridge – about your height'], ['[data-scgo="meals"]', 1, .4, .75, 'stove – at hip height'], ['[data-scgo="shop"]', 0, .2, .55, 'bag – knee to waist']],
    wish: [['[data-scgo="wishes"]', 0, .4, .7, 'cart – handle at the hip'], ['[data-scgo="wbuy"]', 0, .3, .62, 'shopping bag – knee to waist'], ['[data-scgo="wbought"]', 0, .25, .6, 'gift – knee to waist']],
    travel: [['.sc-caseo', 0, .3, .62, 'suitcase – up to the hip']],
    people: [['.sc-mingle > .hs-part', -1, .85, 1.25, 'your people – your size']]
  };
  window.SceneCommon = { SIZES: SIZES, T: T, fit: fit, seq: seq, mid: mid, mount: mount, look: look, O: O, take: take, tipOf: tipOf, common: common, start: start, spin: spin, fall: fall, drip: drip };
})();
