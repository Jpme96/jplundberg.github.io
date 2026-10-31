/* Steady pages: no jumping while a page fills in.
   Each card's height from the last visit (this tab only, sessionStorage "dash.heights") is kept as its
   minimum height while the page unlocks and draws, so cards below don't move when the one above gets
   its content. A moment after unlocking the minimums are taken off and the new heights remembered.
   Heights only – no content, numbers or names. Cleared when the dashboard locks. Last in the tail bundle. */
(function () {
  "use strict";
  var KEY = 'dash.heights', page = (location.pathname.match(/\/cmd\/([a-z]+)\//) || [])[1] || 'home';
  var SEL = 'main .card[id], #dash .card[id], .mhero .mh-txt, .mhero .mh-top3, [data-pk] > [id]';
  function key(e) { return e.id || (e.classList.contains('mh-txt') ? 'mh-txt' : e.classList.contains('mh-top3') ? 'mh-top3' : ''); }
  function load() { try { var o = JSON.parse(sessionStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function els() { return Array.prototype.filter.call(document.querySelectorAll(SEL), function (e) { return !!key(e) && !e.closest('#settings'); }); }
  function save() {
    if (!document.documentElement.classList.contains('unlocked')) return;
    var all = load(), mine = {};
    els().forEach(function (e) { var h = e.offsetHeight; if (h > 40 && !e.style.minHeight) mine[key(e)] = h; });
    all[page] = { w: innerWidth, h: mine };
    try { sessionStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
  }
  var held = [];
  (function hold() {
    var s = load()[page]; if (!s || Math.abs(s.w - innerWidth) > 30) return;   // only for the same width (phone turned = new layout)
    els().forEach(function (e) { var h = s.h[key(e)]; if (h) { e.style.minHeight = h + 'px'; held.push(e); } });
  })();
  function release() { held.forEach(function (e) { e.style.minHeight = ''; }); held = []; setTimeout(save, 200); }
  if (window.Vault) {
    window.Vault.onUnlock(function () { setTimeout(function () { requestAnimationFrame(release); }, 2200); });
    window.Vault.onLock(function () { held.forEach(function (e) { e.style.minHeight = ''; }); held = []; try { sessionStorage.removeItem(KEY); } catch (e) {} });
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden && !held.length) save(); });
  window.addEventListener('pagehide', function () { if (!held.length) save(); });
})();
