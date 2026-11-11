/* The living Calendar picture (Phase L6) – your avatar's actions on this page, built from the rig, the scene engine
   and the shared props (scene-common.js), on top of the still picture from scenes.js. */
(function () {
  'use strict';
  /* made on first use: the engine and the shared props load after this page's own code */
  function make() {
  var L = window.Live, K = window.SceneCommon; if (!L || !K) return null;
  var el = L.el, rnd = L.rnd, ease = L.ease, lerp = L.lerp, T = K.T, fit = K.fit, seq = K.seq, mid = K.mid, mount = K.mount, look = K.look, O = K.O, take = K.take, tipOf = K.tipOf, common = K.common, start = K.start, spin = K.spin, fall = K.fall, drip = K.drip;
  /* ================= CALENDAR: tear off yesterday, look at the clock, read the notes ================= */
  return function (svg, data) {
    var m = mount(svg); if (!m) return null; data = data || {};
    m.me.remove();
    svg.querySelector('.hs-part').parentNode.insertBefore(el('g', { class: 'bin' }, '<path d="M8 118h12l-1.4 12h-9.2z" fill="#4a5568"/><path d="M7 118h14" stroke="#6b7385" stroke-width="1.6" stroke-linecap="round"/>'), null);
    var H = L.Hero(svg, null, m.box), R = L.Run(), C = common(R, H, svg), base = H.pos.slice();
    var cal = svg.querySelector('[data-scgo="clToday"]'), body = cal.querySelector('.sc-cal'), page = el('g', { class: 'page' }); cal.appendChild(page);
    var hasPage = true;
    function newPage() { page.getAnimations().forEach(function (a) { a.cancel(); }); page.style.opacity = ''; hasPage = true; page.setAttribute('transform', ''); page.innerHTML = '<rect x="78.6" y="58" width="62.8" height="55.4" rx="3" fill="' + getComputedStyle(body).fill + '" stroke="rgba(255,255,255,.18)" stroke-width=".6"/><text x="110" y="94" text-anchor="middle" class="sc-cald"></text><text x="110" y="107" text-anchor="middle" class="sc-calw"></text>';
      /* today's real date and weekday, as the still picture shows them */
      var d0 = cal.querySelector(':scope > .sc-cald, :scope > text.sc-cald') || svg.querySelector('.sc-cald'), w0 = svg.querySelector('.sc-calw'), pt = page.querySelectorAll('text');
      pt[0].textContent = d0 && d0 !== pt[0] ? d0.textContent : String(new Date().getDate()); pt[1].textContent = w0 && w0 !== pt[1] ? w0.textContent : ''; }
    newPage();
    var notes = [].slice.call(svg.querySelectorAll('.sc-note'));
    function wiggle(g) { var base = g.getAttribute('transform') || '', bb = g.getBBox(), t0 = performance.now(); (function fr(now) { var u = Math.min(1, (now - t0) / 600); g.setAttribute('transform', base + ' rotate(' + (Math.sin(u * Math.PI * 3) * 7 * (1 - u)).toFixed(2) + ' ' + (bb.x + bb.width / 2) + ' ' + bb.y + ')'); if (u < 1) requestAnimationFrame(fr); else g.setAttribute('transform', base); })(t0); }
    var ACTS = [
      { n: 'tear', t: 'tearing off yesterday', f: function () {
        var g0 = [82, 111], ball;
        return seq([function () { L.face(H, 'grin'); return L.walk(R, H, [63, base[1]], 20, null, .7); },
          function () { look(H, g0); return L.reach(R, H, 'R', g0, 450); },
          function () { return L.tw(R, 700, function (u) { var e = ease(u); H.hand.R = [lerp(82, 74, e), lerp(111, 124, e)]; page.setAttribute('transform', 'rotate(' + (-34 * e) + ' 141 58)'); look(H, H.hand.R); }); },
          function () { page.innerHTML = ''; ball = L.Obj(H, 'R', '<circle r="3.2" fill="#d9dce4"/><path d="M-2 -1l3 1-1 2" stroke="#9aa3b2" stroke-width=".6" fill="none"/>', [0, 0]); return L.reach(R, H, 'R', fit(H, 12, -66), 300); },
          function () { look(H, [14, 118]); return L.turnTo(R, H, -.6, 300); },
          function () { return L.reach(R, H, 'R', fit(H, 6, -100), 260); },
          function () { var a = L.handAt(H, 'R'); L.letGo(H, 'R'); var b = el('g', {}, '<circle r="3.2" fill="#d9dce4"/>'); svg.insertBefore(b, svg.querySelector('.bin')); return L.tw(R, 650, function (u) { b.setAttribute('transform', 'translate(' + lerp(a[0], 14, u) + ' ' + (lerp(a[1], 120, u) - Math.sin(u * Math.PI) * 26) + ')'); }).then(function () { b.remove(); L.wob(svg.querySelector('.bin'), 5, 300); }); },
          function () { look(H, null); L.face(H, 'laugh'); L.say(H, T('New day!', 'Ny dag!'), 1500); return Promise.all([L.reach(R, H, 'R', null, 400), L.turnTo(R, H, 'front', 300)]); },
          function () { return L.walk(R, H, base, 20); },
          function () { hasPage = false; setTimeout(function () { newPage(); page.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1200 }); }, 20000); }]);
      } },
      { n: 'clock', t: 'checking the clock', f: function () {
        return seq([function () { return L.turnTo(R, H, 'back', 320); }, function () { return L.headTo(R, H, -9, -2, 400); },
          function () { spin('.sc-hand', svg, 1500, 1); return L.wait(R, 1600); },
          function () { return L.turnTo(R, H, 'front', 320); }, function () { look(H, null); L.face(H, 'wow'); L.say(H, T('Already?!', 'Allerede?!'), 1500); return L.both(R, H, fit(H, -12, -100), fit(H, 12, -100), 400); },
          function () { return L.wait(R, 900); }]);
      } },
      { n: 'notes', t: 'reading today’s notes', f: function () {
        return seq([function () { L.face(H, 'calm'); return L.walk(R, H, [174, base[1]], 22); }, function () { return L.turnTo(R, H, 'back', 320); },
          function () { var p = Promise.resolve(); notes.forEach(function (n, i) { p = p.then(function () { var bb = n.getBBox(), m = n.parentNode.getCTM(), pt = svg.createSVGPoint(); pt.x = bb.x + 4; pt.y = bb.y + bb.height / 2; var q = pt.matrixTransform(n.getCTM()); return L.reach(R, H, 'R', [q.x, q.y], 420).then(function () { wiggle(n.parentNode); return L.wait(R, 350); }); }); }); return p; },
          function () { return L.reach(R, H, 'R', null, 300); }, function () { return L.turnTo(R, H, 'front', 320); },
          function () { L.face(H, 'wow'); L.say(H, (nNotes > 1 ? T('Busy day!', 'Travel dag!') : T('One thing today', 'Én ting i dag')), 1600); return L.wait(R, 1400); },
          function () { return L.walk(R, H, base, 22); }]);
      } },
      { n: 'rush', t: 'in a hurry', f: function () { look(H, null); L.face(H, 'wow'); L.say(H, T('So much to do!', 'Så mye å gjøre!'), 1600); L.drops(svg, fit(H, 12, -106), 3); return L.tw(R, 1800, function (u) { var a = u * Math.PI * 10; H.rot.R = [-60 + Math.sin(a) * 60, -20]; H.rot.L = [60 - Math.sin(a + 1) * 60, 20]; H.pos = [base[0] + Math.sin(a * .5) * 1.5, base[1]]; }); } },
      C.coffee, C.wave, C.think(T('What shall I plan?', 'Hva skal jeg planlegge?'))
    ];
    /* what's in today's picture decides: the notes only when today has notes, the rush only when it has several,
       the clock check otherwise; no coffee here (there's no cup in this picture) */
    var nNotes = notes.length;
    return start(svg, H, R, function () { return ACTS.filter(function (a) { return a.n === 'coffee' ? false : a.n === 'tear' ? hasPage : a.n === 'notes' ? nNotes > 0 : a.n === 'rush' ? nNotes >= 2 : true; }); }, 'calendar');
  };

  }
  var real = null; window.SceneLive = window.SceneLive || {};
  window.SceneLive.calendar = function (svg, data) { real = real || make(); return real ? real(svg, data) : null; };
})();
