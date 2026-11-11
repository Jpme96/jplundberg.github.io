/* The living Finances picture (Phase L6, page 1). Your avatar lives by the money jar: it climbs the ladder (always
   three points on it) and drops a coin in the slot, knocks on the jar, polishes it, counts the days to payday on the
   little calendar, flips a coin, checks the bank on its phone, waves. What it does follows your money: payday close →
   the payday countdown more often; spending too fast or below zero → no saving, a worried look instead.
   Built only from the components: avatar-rig.js (the body), scene-kit.js (Live: walk, reach, props, brain).
   The still picture from scenes.js stays underneath: with reduced motion / animations off it's all you see, and
   tapping the jar or the calendar still opens the card. Speech bubbles never say amounts (they're on screen for anyone nearby). */
(function () {
  'use strict';
  var NB = window.I18N && window.I18N.lang === 'nb';
  function T(en, nb) { return NB ? nb : en; }
  /* props: drawing, grip point, named points – at the size of the hand (a 0.5-scale avatar) */
  var O = {
    phone: ['<rect x="-3.2" y="-5" width="6.4" height="10" rx="1.4" fill="#2b2f3a"/><circle cx="-1.3" cy="-3.1" r=".9" fill="#0d0f14"/><circle cx="-1.3" cy="-3.1" r=".4" fill="#4a5a7b"/>', [0, 2.5]],
    coin: ['<circle r="2.8" fill="#f2c94c" stroke="#c98500" stroke-width=".8"/>', [0, 0]],
    cloth: ['<path d="M-3.5 -2.5q3.5 -1.5 7 0l-.6 5q-3 1.2-5.8 0z" fill="#8fd0ff"/>', [0, 0]]
  };
  window.SceneLive = window.SceneLive || {};
  window.SceneLive.finance = function (svg, data) {
    var L = window.Live; if (!L || !window.Rig || !window.Avatar || L.still() || !svg) return null;
    var el = L.el, ease = L.ease, lerp = L.lerp;
    var me = svg.querySelector('.sc-me'), jar = svg.querySelectorAll('[data-scgo="fin"]')[0], pay = svg.querySelectorAll('[data-scgo="fin"]')[1];
    var moneyEl = svg.querySelector('.sc-money'), glass = svg.querySelector('.sc-jarg');
    if (!me || !jar || !pay || !moneyEl || !glass) return null;
    var meSvg = me.querySelector('svg'), box = { x: +meSvg.getAttribute('x'), y: +meSvg.getAttribute('y'), w: +meSvg.getAttribute('width'), h: +meSvg.getAttribute('height') };
    me.remove();
    data = data || {};
    /* the slot in the lid, and a ladder leaning on the jar (about shoulder-wide, rungs a step apart) */
    jar.appendChild(el('rect', { x: 134, y: 39.4, width: 10, height: 2.6, rx: 1.3, fill: '#2a1d12' }));
    /* the ladder reaches the lid: you stand two rungs up and hold the rails at head height, as on a real ladder */
    var rx = function (rail, y) { return rail ? 181 - (126 - y) / 82 * 3 : 147 + (126 - y) / 82 * 3; };   /* a little wider than the shoulders, so the hands on the rails sit outside the body */
    svg.appendChild(el('g', { class: 'sc-ladder' }, '<path d="M147 126L150 44M181 126L178 44" stroke="#9aa3b2" stroke-width="2.2" stroke-linecap="round"/>' + [112, 96, 80, 64].map(function (y) { return '<path d="M' + rx(0, y) + ' ' + y + 'H' + rx(1, y) + '" stroke="#9aa3b2" stroke-width="1.8" stroke-linecap="round"/>'; }).join('')));
    var H = L.Hero(svg, null, box), R = L.Run(), base = H.pos.slice(), GY = 30;
    R.alive = function () { return svg.isConnected; };
    function fit(fx, fy) { var k = H.s * (H.k || 1); return [H.pos[0] + fx * k, H.pos[1] + fy * k]; }
    function seq(fns) { return fns.reduce(function (p, f) { return p.then(f); }, Promise.resolve()); }
    function look(P) { H.gaze = P; }
    function take(side, k) { Rig.stow(H.rig, true); return L.Obj(H, side, O[k][0], O[k][1]); }
    function drop(side) { L.letGo(H, side); if (!H.objs.R && !H.objs.L) Rig.stow(H.rig, false); }
    function fall(inner, a, b, ms, before) { var g = el('g', {}, inner); if (before) before.parentNode.insertBefore(g, before); else svg.appendChild(g); return L.tw(R, ms, function (u) { g.setAttribute('transform', 'translate(' + lerp(a[0], b[0], u).toFixed(2) + ' ' + lerp(a[1], b[1], u * u).toFixed(2) + ')'); }).then(function () { g.remove(); }); }
    function hands(y) { return [[rx(0, y - GY), y - GY], [rx(1, y - GY), y - GY]]; }
    /* one rung, the way people climb: one hand up, that foot up, body up, the other hand up – three points on the ladder */
    function rung(y0, y1, up) {
      var a = up ? 'R' : 'L', b = up ? 'L' : 'R';
      return seq([function () { var t = hands(y1); return L.reach(R, H, a, a === 'L' ? t[0] : t[1], 260); },
        function () { return L.tw(R, 260, function (u) { H.legs[a] = (up ? u : 1 - u * .2) * .75; }); },
        function () { return L.tw(R, 520, function (u) { var e = ease(u); H.pos = [164, lerp(y0, y1, e)]; H.legs[a] = .75 * (1 - e); H.legs[b] = Math.sin(e * Math.PI) * .5; var t = hands(y0); H.hand[b] = b === 'L' ? t[0] : t[1]; }); },
        function () { var t = hands(y1); return L.reach(R, H, b, b === 'L' ? t[0] : t[1], 260); }]);
    }
    var y00 = +moneyEl.getAttribute('y');
    function dropIn(x) {
      var top = +moneyEl.getAttribute('y'); look([x, top]);
      return fall(O.coin[0], [x, 44], [x, top - 3], 560, glass).then(function () {
        var y0 = +moneyEl.getAttribute('y'); L.burst(svg, [x, y0 - 2], 5);
        /* the money rises a little for the coin, then settles back to what's really there */
        return L.tw(R, 450, function (u) { moneyEl.setAttribute('y', (y0 - 3 * ease(u)).toFixed(2)); }).then(function () { setTimeout(function () { if (svg.isConnected) moneyEl.setAttribute('y', y00); }, 2500); });
      });
    }
    var days = data.daysToPay, payLine = days == null ? '' : days === 0 ? T('Payday!', 'Lønning!') : days === 1 ? T('Payday tomorrow', 'Lønning i morgen') : T('Payday in ' + days + ' days', 'Lønning om ' + days + ' dager');
    var ACTS = [
      { n: 'save', w: data.state === 'ok' ? 2 : data.state === 'none' || !data.state ? 1 : 0, f: function () {
        var o;
        return seq([function () { L.face(H, 'grin'); return L.walk(R, H, [164, 126], 22, null, -.6); },
          function () { return L.turnTo(R, H, 'back', 300); },
          function () { var t = hands(126); return L.both(R, H, t[0], t[1], 400); },
          function () { return rung(126, 112, true); }, function () { return rung(112, 96, true); },
          /* at the top: right hand stays on the ladder, turn to the jar, a coin from the pocket, into the slot */
          function () { return L.turnTo(R, H, -.55, 320); },
          function () { return L.reach(R, H, 'L', fit(-12, -46), 350); },
          function () { o = take('L', 'coin'); look([139, 40]); L.face(H, 'starry'); return L.reach(R, H, 'L', [139, 35.5], 520); },
          function () { return L.reach(R, H, 'L', [139, 38.8], 220); },
          function () { drop('L'); var d = dropIn(139); return L.reach(R, H, 'L', hands(96)[0], 380).then(function () { return d; }); },
          function () { look(null); return L.turnTo(R, H, -.2, 250); },
          function () { L.face(H, 'laugh'); L.say(H, T('Saved!', 'Spart!'), 1400); return L.wait(R, 900); },
          function () { return L.turnTo(R, H, 'back', 300); },
          function () { return rung(96, 112, false); }, function () { return rung(112, 126, false); },
          function () { return L.settle(R, H, 350); }, function () { return L.walk(R, H, base, 22); }]);
      } },
      { n: 'knock', f: function () {
        /* in front of the jar, turned toward it (the ladder leans on its side) – the knuckles on the glass */
        return seq([function () { L.face(H, 'silly'); return L.walk(R, H, [136, 127], 22, null, -.65); },
          function () { look([116, 94]); return L.reach(R, H, 'L', [119, 94], 400); },
          function () { L.say(H, T('Grow, little jar!', 'Voks, lille krukke!'), 1800); var p = Promise.resolve(); [0, 1, 2].forEach(function () { p = p.then(function () { return L.reach(R, H, 'L', [115.6, 94], 130); }).then(function () { L.wob(jar, 1.3, 260); return L.reach(R, H, 'L', [119, 94], 160); }); }); return p; },
          function () { look(null); return L.settle(R, H, 350); }, function () { return L.walk(R, H, base, 22); }]);
      } },
      { n: 'polish', f: function () {
        /* the cloth on the front of the jar, in circles */
        return seq([function () { L.face(H, 'calm'); return L.walk(R, H, [136, 127], 22, null, -.65); },
          function () { take('L', 'cloth'); look([114, 96]); return L.reach(R, H, 'L', [117.5, 96], 400); },
          function () { return L.tw(R, 2000, function (u) { var a = u * Math.PI * 5; H.hand.L = [114 + Math.cos(a) * 3.6, 96 + Math.sin(a) * 3.6]; look(H.hand.L); }); },
          function () { drop('L'); look(null); return L.turnTo(R, H, 'front', 300); },
          function () { L.face(H, 'love'); L.say(H, T('Shiny!', 'Skinnende!'), 1400); [[128, 66], [116, 92], [140, 108]].forEach(function (p, i) { setTimeout(function () { if (svg.isConnected) L.burst(svg, p, 3); }, i * 200); }); return L.wait(R, 900); },
          function () { return L.settle(R, H, 350); }, function () { return L.walk(R, H, base, 22); }]);
      } },
      { n: 'payday', w: days != null && days <= 3 ? 3 : payLine ? 1 : 0, f: function () {
        var t = pay.querySelector('.sc-calt');
        return seq([function () { L.face(H, 'starry'); look([47, 108]); return L.turnTo(R, H, -.55, 300); },
          function () { return L.reach(R, H, 'L', [47, 104], 550); },
          function () { if (payLine) L.say(H, payLine, 1900); if (t) { t.style.transformBox = 'fill-box'; t.style.transformOrigin = 'center'; t.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)', offset: .4 }, { transform: 'scaleY(1.2)', offset: .75 }, { transform: 'scaleY(1)' }], { duration: 700 }); } L.wob(pay, 5, 600); return L.wait(R, 1600); },
          function () { look(null); }]);
      } },
      { n: 'count', f: function () {
        var c;
        return seq([function () { L.face(H, 'grin'); return L.both(R, H, fit(-15, -66), fit(15, -66), 450); },
          function () { L.say(H, T('Heads or tails?', 'Mynt eller kron?'), 2000); c = el('g', {}, O.coin[0]); svg.appendChild(c); var p = Promise.resolve();
            [0, 1, 2, 3].forEach(function (i) { p = p.then(function () { var a = L.handAt(H, i % 2 ? 'R' : 'L'), b = L.handAt(H, i % 2 ? 'L' : 'R'); return L.tw(R, 520, function (u) { var P = [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - Math.sin(u * Math.PI) * 14]; c.setAttribute('transform', 'translate(' + P[0].toFixed(2) + ' ' + P[1].toFixed(2) + ') scale(' + Math.cos(u * Math.PI * 3).toFixed(2) + ' 1)'); }); }); }); return p; },
          function () { c.remove(); look(null); L.face(H, 'laugh'); return L.wait(R, 400); }]);
      } },
      { n: 'phone', f: function () {
        return seq([function () { L.face(H, 'calm'); return L.reach(R, H, 'R', fit(14, -44), 350); },
          function () { take('R', 'phone'); return L.reach(R, H, 'R', fit(7, -70), 450); },
          function () { look(L.handAt(H, 'R')); return L.headTo(R, H, 5, 1.5, 300); },
          function () { return L.wait(R, 1300); },
          function () { var bad = data.state === 'neg' || data.state === 'warn'; L.face(H, bad ? 'wow' : 'grin'); L.say(H, data.state === 'ok' ? T('All good in the bank', 'Alt fint i banken') : bad ? T('Hmm, careful now', 'Hmm, forsiktig nå') : T('Checking the bank', 'Sjekker banken'), 1600); return L.wait(R, 1300); },
          function () { drop('R'); look(null); return L.headTo(R, H, 0, 0, 250); }]);
      } },
      { n: 'worry', w: data.state === 'neg' || data.state === 'warn' ? 2 : 0, f: function () {
        return seq([function () { L.face(H, 'calm'); look([120, 100]); return L.turnTo(R, H, -.5, 300); },
          function () { return L.reach(R, H, 'R', fit(6, -96), 450); },
          function () { L.say(H, data.state === 'neg' ? T('Tight this month', 'Stramt denne måneden') : T('Spending a bit fast', 'Bruker litt fort'), 1800); return L.tw(R, 1600, function (u) { H.head = [-4 + Math.sin(u * 6) * 2, -1]; }); },
          function () { look(null); }]);
      } },
      { n: 'wave', f: function () { look(null); L.face(H, 'grin'); L.say(H, T('Hi!', 'Hei!'), 1400); return L.wave(R, H); } }
    ];
    function acts() { return ACTS.filter(function (a) { return a.w !== 0; }); }
    L.brain(R, H, acts, function () { look(null); return L.jump(R, H); });
    var api = { H: H, R: R, acts: function () { return ACTS; }, run: function (n) { var a = ACTS.filter(function (x) { return x.n === n; })[0]; R.paused = true; return Promise.resolve(R.cur).then(function () { R.tok++; L.clear(H); return L.settle(R, H, 200); }).then(function () { return a ? a.f() : null; }).then(function () { return L.settle(R, H, 300); }); } };
    window.SceneLive._finance = api;
    return api;
  };
})();
