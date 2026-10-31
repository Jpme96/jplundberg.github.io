/* Small action animations + battery saving.
   - Numbers count to their new value (Home chips, the Money card's big number, number tiles).
   - Ticking a to-do pops the check and sweeps a line through it; checkboxes pop.
   - Goal rings fill up the first time the page shows them.
   - Saving battery: animations pause while the app is in the background, pictures that are scrolled
     out of view stop moving, and on a low battery (where the browser tells us) the decorative motion stops.
   Everything respects Settings → Motion off and the phone's reduce-motion setting. */
(function () {
  "use strict";
  var root = document.documentElement;
  function still() { return root.classList.contains('mo-off') || root.classList.contains('mo-reduced') || root.classList.contains('mo-saver') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }

  /* ---------- numbers count up ---------- */
  var NUM = '.mh-chip b, .big-num, .tk-v, .hl-tile b, .stat-value';
  var nf = new Intl.NumberFormat('nb-NO');
  function parse(t) { var m = String(t).match(/^([^\d\u2212-]*)([\u2212-]?)(\d(?:[\d\s\u00a0\u202f]*\d)?)(.*)$/); if (!m) return null; var n = +m[3].replace(/[\s\u00a0\u202f]/g, ''); return isFinite(n) && m[3].replace(/\D/g, '').length <= 9 ? { pre: m[1], neg: m[2], n: n, post: m[4], grouped: /[\s\u00a0\u202f]/.test(m[3]) } : null; }
  function fmt(p, v) { var s = p.grouped || v >= 10000 ? nf.format(Math.round(v)) : String(Math.round(v)); return p.pre + p.neg + s + p.post; }
  function run(el, from, to) {
    var p = parse(el.textContent); if (!p) return;
    if (still() || from === to || Math.abs(to - from) < 2) return;
    var t0 = performance.now(), dur = Math.min(900, 380 + Math.log10(Math.abs(to - from) + 1) * 120);
    el.dataset.cuRun = '1';
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(p, from + (to - from) * e);
      if (k < 1 && el.isConnected) requestAnimationFrame(step); else { el.textContent = fmt(p, to); delete el.dataset.cuRun; }
    })(t0);
  }
  var lastVal = new WeakMap(), seenOnce = new WeakSet();
  function scanNums(scope) {
    (scope || document).querySelectorAll(NUM).forEach(function (el) {
      if (el.dataset.cuRun || el.closest('[data-cu-off]')) return;
      var p = parse(el.textContent); if (!p) return;
      var v = p.n, key = (el.closest('[id]') || {}).id + '|' + (el.className || '') + '|' + p.pre + '|' + p.post;
      var prev = lastVal.has(el) ? lastVal.get(el) : PREV[key];
      lastVal.set(el, v); PREV[key] = v;
      if (prev == null) { if (!seenOnce.has(el) && el.classList.contains('big-num')) run(el, 0, v); seenOnce.add(el); return; }
      if (prev !== v) run(el, prev, v);
    });
  }
  var PREV = {};   /* values by place, so a card that re-renders (new element, same spot) still counts from its last number */

  /* ---------- a to-do ticked: pop + a line sweeping through ---------- */
  var ticked = null;
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.todo-item .check');
    if (c) { var li = c.closest('.todo-item'); if (li && !li.classList.contains('done')) ticked = { id: li.dataset.id, at: Date.now() }; }
  }, true);
  function markTicked() {
    if (!ticked || Date.now() - ticked.at > 1500 || still()) return;
    var li = document.querySelector('.todo-item.done[data-id="' + ticked.id + '"]'); if (!li) return;
    li.classList.add('td-pop'); ticked = null; setTimeout(function () { li.classList.remove('td-pop'); }, 900);
  }
  document.addEventListener('change', function (e) {
    var cb = e.target; if (!cb || cb.type !== 'checkbox' || !cb.checked || still() || cb.classList.contains('switch')) return;
    cb.classList.remove('cb-pop'); void cb.offsetWidth; cb.classList.add('cb-pop');
  }, true);

  /* ---------- goal rings fill the first time ---------- */
  setTimeout(function () { root.classList.add('rings-done'); }, 4000);

  /* ---------- one observer for all of it (ignores its own number updates) ---------- */
  var pend = false;
  new MutationObserver(function (list) {
    if (list.every(function (m) { var t = m.target.nodeType === 3 ? m.target.parentElement : m.target; return t && t.dataset && t.dataset.cuRun; })) return;
    if (pend) return; pend = true;
    requestAnimationFrame(function () { pend = false; scanNums(); markTicked(); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  if (window.Vault && window.Vault.onUnlock) window.Vault.onUnlock(function () { setTimeout(scanNums, 300); });

  /* ---------- battery saving ---------- */
  /* background: pause every CSS animation (and the JS timers check document.hidden themselves) */
  function vis() { root.classList.toggle('mo-paused', document.hidden); }
  document.addEventListener('visibilitychange', vis); vis();
  /* pictures and the avatar stop moving when they're scrolled out of view */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('is-away', !e.isIntersecting); }); }, { rootMargin: '80px' });
    var watched = new WeakSet();
    var watch = function () { document.querySelectorAll('.hs-illu, #avHome, #dlWx').forEach(function (el) { if (!watched.has(el)) { watched.add(el); io.observe(el); } }); };
    new MutationObserver(function () { clearTimeout(watch.t); watch.t = setTimeout(watch, 200); }).observe(document.body, { childList: true, subtree: true });
    watch();
  }
  /* low battery (Chrome/Android/desktop – iPhone doesn't share this): no decorative motion below 20 % unless charging */
  if (navigator.getBattery) navigator.getBattery().then(function (b) {
    var upd = function () { root.classList.toggle('mo-saver', !b.charging && b.level <= 0.2); };
    upd(); b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd);
  }).catch(function () {});
})();
