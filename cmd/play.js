/* Play (Nov 2026): the pictures on every page and your avatar on Home come alive a bit more.
   Pictures (House, People, Food, Work, Health, Finances, Travel, Wishlist, Goals, Papers, Calendar):
     · tilt slightly as you move the mouse – or the phone (where the phone allows it)
     · a part you tap bounces and sends up a few sparkles (it still takes you to its card)
     · tap the sky or the grass and something falls: snowflakes in winter, petals in spring, sun sparkles in
       summer, leaves in autumn
     · now and then one part gives a little wiggle, so the picture never looks frozen
   You in the pictures: tap yourself for a hop and a heart; your eyes follow the finger there too.
   Avatar (Home):
     · the eyes follow your finger or the mouse
     · tap: the next line, with a different move each time (jump, wave, spin, a laugh)
     · hold: a little dance with music notes · double-tap: a heart · stroke it: hearts
     · cheers when you tick off a to-do or a habit
   Off with Settings → Pictures & touches → Play with the pictures, and always off with reduced motion. */
(function () {
  "use strict";
  var root = document.documentElement;
  function on() { if (root.classList.contains('mo-off') || root.classList.contains('mo-reduced') || root.classList.contains('mo-saver')) return false; if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return false; return window.Delight ? window.Delight.on('play') !== false : true; }
  var SEL = '#scIllu svg, #hsIllu svg';
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function season() { var m = new Date().getMonth(); return m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn'; }

  /* ---------- particles: drawn in a fixed layer over the page, so they're never clipped by a card ---------- */
  var layer = null;
  function lay() { if (!layer) { layer = document.createElement('div'); layer.className = 'pl-layer'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer); } return layer; }
  function burst(x, y, kind, n) {
    return;    /* the sparkles, hearts and falling leaves are switched off (Nov 8) – the bounces and moves stay */
    if (!on()) return;
    var L = lay(), glyph = { spark: '✦', heart: '❤', note: '♪', snow: '❄', petal: '✿', sun: '✧', leaf: '❦' }[kind] || '✦';
    for (var i = 0; i < (n || 6); i++) {
      var s = document.createElement('i'); s.className = 'pl-p pl-' + kind; s.textContent = kind === 'note' && i % 2 ? '♫' : glyph;
      var fall = kind === 'snow' || kind === 'petal' || kind === 'leaf' || kind === 'sun';
      s.style.left = (x + (fall ? rnd(-60, 60) : rnd(-6, 6))) + 'px'; s.style.top = (y + (fall ? rnd(-40, 0) : 0)) + 'px';
      s.style.setProperty('--dx', (fall ? rnd(-30, 30) : rnd(-40, 40)).toFixed(0) + 'px');
      s.style.setProperty('--dy', (fall ? rnd(70, 130) : rnd(-60, -24)).toFixed(0) + 'px');
      s.style.setProperty('--r', rnd(-120, 120).toFixed(0) + 'deg');
      s.style.animationDuration = (fall ? rnd(1.6, 2.6) : rnd(.7, 1.1)).toFixed(2) + 's';
      s.style.animationDelay = (fall ? rnd(0, .5) : rnd(0, .08)).toFixed(2) + 's';
      L.appendChild(s);
      setTimeout(function (el) { el.remove(); }.bind(null, s), 3400);
    }
  }
  window.Play = { burst: burst };

  /* ---------- pictures: tilt ---------- */
  var tx = 0, ty = 0, raf = 0;
  function tilt() {
    raf = 0;
    document.querySelectorAll(SEL).forEach(function (s) {
      if (!on()) { s.style.transform = ''; return; }
      s.style.transform = 'perspective(600px) rotateY(' + (tx * 6).toFixed(2) + 'deg) rotateX(' + (-ty * 4).toFixed(2) + 'deg) translate(' + (tx * 3).toFixed(1) + 'px,' + (ty * 2).toFixed(1) + 'px)';
    });
  }
  function aim(nx, ny) { tx = Math.max(-1, Math.min(1, nx)); ty = Math.max(-1, Math.min(1, ny)); if (!raf) raf = requestAnimationFrame(tilt); eyes(); }
  document.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') aim(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }, { passive: true });
  document.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') aim(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }, { passive: true });
  /* the phone: Android gives it straight away; iPhone only after asking, so we don't ask – tapping still works */
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', function (e) { if (e.gamma == null) return; aim(e.gamma / 30, (e.beta - 45) / 30); }, { passive: true });
  }

  /* ---------- pictures: tap a part → bounce + sparkles; tap the sky or grass → the season falls ---------- */
  document.addEventListener('click', function (e) {
    if (!on()) return;
    var svg = e.target.closest && e.target.closest(SEL); if (!svg) return;
    var me = e.target.closest('[data-scme]');
    if (me) { me.classList.remove('pl-hop'); void me.getBoundingClientRect(); me.classList.add('pl-hop'); setTimeout(function () { me.classList.remove('pl-hop'); }, 800); burst(e.clientX, e.clientY - 20, Math.random() < .5 ? 'heart' : 'spark', 5); return; }
    var p = e.target.closest('.hs-part, [data-scgo], [data-hsgo]');
    if (p) {
      p.classList.remove('pl-pop'); void p.getBoundingClientRect(); p.classList.add('pl-pop');
      setTimeout(function () { p.classList.remove('pl-pop'); }, 600);
      burst(e.clientX, e.clientY, 'spark', 7);
    } else {
      var k = { winter: 'snow', spring: 'petal', summer: 'sun', autumn: 'leaf' }[season()];
      burst(e.clientX, e.clientY, k, 10);
    }
  });
  /* now and then one part wiggles */
  setInterval(function () {
    if (!on() || document.hidden) return;
    var parts = document.querySelectorAll('#scIllu .hs-part, #hsIllu .hs-part'); if (!parts.length) return;
    var p = parts[Math.floor(Math.random() * parts.length)];
    if (p.getBoundingClientRect().bottom < 0) return;
    p.classList.add('pl-wig'); setTimeout(function () { p.classList.remove('pl-wig'); }, 900);
  }, 7000);

  /* ---------- avatar: eyes follow, moves, hold, double-tap, stroke ---------- */
  var lastPt = null;
  document.addEventListener('pointermove', function (e) { lastPt = [e.clientX, e.clientY]; }, { passive: true });
  function eyes() {
    if (eyes.busy) return; eyes.busy = true; requestAnimationFrame(function () { eyes.busy = false; eyes2(); });
  }
  function eyes2() {
    /* your avatar on Home and you in the pictures */
    document.querySelectorAll('#avHome .av-fig, [data-scme]').forEach(function (f) {
      var ey = f.querySelectorAll('.eyes'); if (!ey.length) return;
      if (!on() || !lastPt) { ey.forEach(function (x) { x.style.translate = ''; }); return; }
      var r = f.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * .32;
      var dx = lastPt[0] - cx, dy = lastPt[1] - cy, d = Math.max(1, Math.hypot(dx, dy)), k = Math.min(1, d / 220);
      ey.forEach(function (x) { x.style.translate = (dx / d * 1.6 * k).toFixed(2) + 'px ' + (dy / d * 1.2 * k).toFixed(2) + 'px'; });
    });
  }
  document.addEventListener('pointerdown', function (e) { lastPt = [e.clientX, e.clientY]; eyes(); }, { passive: true });
  var MOVES = ['pl-jump', 'pl-wave', 'pl-spin', 'pl-laugh'], mi = 0;
  function act(f, cls, ms) { f.classList.remove.apply(f.classList, MOVES.concat(['pl-dance', 'pl-cheer'])); void f.offsetWidth; f.classList.add(cls); clearTimeout(f._pl); f._pl = setTimeout(function () { f.classList.remove(cls); }, ms || 1000); }
  var hold = null, lastTap = 0, rub = null;
  document.addEventListener('pointerdown', function (e) {
    var f = e.target.closest && e.target.closest('#avHome .av-fig'); if (!f || !on()) return;
    rub = { x: e.clientX, y: e.clientY, d: 0, n: 0 };
    hold = setTimeout(function () { hold = 'done'; act(f, 'pl-dance', 3000); var r = f.getBoundingClientRect(); var k = 0, iv = setInterval(function () { burst(r.left + r.width * rnd(.3, .7), r.top + r.height * .3, 'note', 1); if (++k > 8) clearInterval(iv); }, 330); }, 600);
  });
  document.addEventListener('pointermove', function (e) {
    if (!rub || !on()) return;
    var f = e.target.closest && e.target.closest('#avHome .av-fig'); if (!f) return;
    rub.d += Math.hypot(e.clientX - rub.x, e.clientY - rub.y); rub.x = e.clientX; rub.y = e.clientY;
    if (rub.d > 40) { if (hold && hold !== 'done') { clearTimeout(hold); hold = null; } rub.d = 0; if (rub.n++ < 8) burst(e.clientX, e.clientY, 'heart', 1); }
  }, { passive: true });
  function up() { if (hold && hold !== 'done') clearTimeout(hold); rub = null; }
  document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  /* tap: runs before avatar.js's own click (which shows the next line) – here only the move */
  document.addEventListener('click', function (e) {
    var f = e.target.closest && e.target.closest('#avHome .av-fig'); if (!f || !on()) return;
    if (hold === 'done') { hold = null; e.stopPropagation(); e.preventDefault(); return; }   /* it was a hold – keep dancing, no next line */
    var now = Date.now();
    if (now - lastTap < 320) { var r = f.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height * .25, 'heart', 5); lastTap = 0; return; }
    lastTap = now;
    setTimeout(function () { var f2 = document.querySelector('#avHome .av-fig'); if (f2) act(f2, MOVES[mi++ % MOVES.length], 1000); }, 20);
  }, true);
  /* cheers when you get something done */
  function count(k, test) { try { var v = JSON.parse(localStorage.getItem(k)); return v; } catch (er) { return null; } }
  function doneTodos() { var l = count('dash.todos') || []; return Array.isArray(l) ? l.filter(function (t) { return t && t.done; }).length : 0; }
  function ticks() { var h = count('dash.habits') || {}, k = Fe() ? window.Features.dkey(new Date()) : ''; return ((h.log || {})[k] || []).length; }
  function Fe() { return !!window.Features; }
  var was = { t: doneTodos(), h: ticks() };
  function cheer() {
    var f = document.querySelector('#avHome .av-fig'); if (!f || !on()) return;
    act(f, 'pl-cheer', 1400); var r = f.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height * .2, 'spark', 10);
  }
  ['todos:change', 'habits:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () {
    setTimeout(function () { var n = { t: doneTodos(), h: ticks() }; if (n.t > was.t || n.h > was.h) cheer(); was = n; }, 60);
  }); });
  if (window.Vault) window.Vault.onUnlock(function () { was = { t: doneTodos(), h: ticks() }; });
})();
