/* Fold any card down to its heading, on every page – a small chevron at the end of the card's heading.
   What you fold stays folded on all your devices (dash.tools.fold, synced with the rest).
   A few cards start folded because something else on the same page already shows the same
   (DEF below); unfold one and it stays open. */
(function () {
  "use strict";
  var main = document.getElementById('dash') || document.getElementById('fp') || document.querySelector('main');
  if (!main || !window.Features) return;
  var Fe = window.Features;
  var page = (location.pathname.match(/\/cmd\/([a-z]+)\//) || [])[1] || 'home';
  /* folded until you open them: duplicates of something else on the page */
  var DEF = {
    'home:calCard': 1,    /* the Today card already shows today and tomorrow; the week strip is on the Calendar page */
    /* the take-over guide opens by itself in the last two weeks before the day and the first month after */
    'house:htake': function () {
      var M = window.HouseMove, d = M && M.date && M.date(); if (!d) return 0;
      var n = Math.round((new Date(d + 'T12:00') - new Date(new Date().toDateString() + ' 12:00')) / 864e5);
      return n > 14 || n < -30 ? 1 : 0;
    }
  };
  function def(k) { var v = DEF[k]; try { return typeof v === 'function' ? !!v() : !!v; } catch (e) { return false; } }
  function map() { var t = Fe.tools(); return t.fold && typeof t.fold === 'object' ? t.fold : {}; }
  function save(k, v) { var t = Fe.tools(); t.fold = t.fold && typeof t.fold === 'object' ? t.fold : {}; t.fold[k] = v; Fe.saveTools(t); }
  /* the element that survives a redraw (the [data-tool] mount) and a stable key for it */
  function host(card) { var w = card.parentElement && card.parentElement.closest('[data-tool]'); return w && w.firstElementChild === card ? w : card; }
  function key(card) {
    var w = card.parentElement && card.parentElement.closest('[data-tool]');
    if (w) return page + ':' + w.getAttribute('data-tool');
    if (card.id) return page + ':' + card.id;
    var c = [].slice.call(card.classList).filter(function (x) { return x !== 'card' && !/^(card-|kit-|is-|ufold)/.test(x); })[0];
    return c ? page + ':' + c : null;
  }
  function folded(k) { var m = map(); return m[k] != null ? !!m[k] : def(k); }
  function pass() {
    var m = map();
    main.querySelectorAll('.card > .card-head').forEach(function (h) {
      var card = h.parentElement;
      if (card.parentElement.closest('.card, .lf-box, .fo-box, .st-backdrop')) return;     /* not cards inside cards or sheets */
      if (card.children.length < 2 && !card.classList.contains('ufold')) return;           /* nothing to fold */
      /* empty cards already fold to one line by themselves (tidy.js) */
      if (card.classList.contains('card-folded')) { var ob = h.querySelector(':scope > .fold-btn'); if (ob) ob.remove(); if (card.classList.contains('ufold')) card.classList.remove('ufold'); return; }
      var k = key(card); if (!k) return;
      var on = m[k] != null ? !!m[k] : def(k), hs = host(card);
      var b = h.querySelector(':scope > .fold-btn');
      if (!b) {
        b = document.createElement('button'); b.type = 'button'; b.className = 'icon-btn sm fold-btn'; b.setAttribute('data-fold', '');
        h.appendChild(b);
      }
      b.dataset.fk = k;
      var lbl = on ? 'Open' : 'Fold';
      if (b.getAttribute('aria-label') !== lbl) { b.setAttribute('aria-label', lbl); b.setAttribute('aria-expanded', String(!on)); b.innerHTML = '<i class="bi bi-chevron-' + (on ? 'down' : 'up') + '"></i>'; }
      if (card.classList.contains('ufold') !== on) card.classList.toggle('ufold', on);
      if (hs !== card && hs.classList.contains('ufold-host') !== on) hs.classList.toggle('ufold-host', on);
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.fold-btn[data-fold]');
    var h = !b && e.target.closest('.card.ufold > .card-head');
    if (h && e.target.closest('a, input, select, label')) return;
    if (h) b = h.querySelector(':scope > .fold-btn');
    if (!b || !b.dataset.fk) return;
    e.preventDefault(); e.stopPropagation();
    var k = b.dataset.fk, now = !folded(k);
    save(k, now ? 1 : 0); pass();
    if (window.Masonry && window.Masonry.layout) try { window.Masonry.layout(); } catch (er) {}
    window.dispatchEvent(new Event('resize'));
  }, true);
  var t = null;
  new MutationObserver(function (ms) {
    /* our own button changes don't need another pass */
    if (ms.every(function (m) { return m.target.closest && m.target.closest('.fold-btn'); })) return;
    clearTimeout(t); t = setTimeout(pass, 80);
  }).observe(main, { childList: true, subtree: true });
  window.addEventListener('tools:change', function () { clearTimeout(t); t = setTimeout(pass, 30); });
  if (window.Vault) window.Vault.onUnlock(function () { setTimeout(pass, 150); });
  setTimeout(pass, 0);
  window.Fold = { pass: pass, folded: folded, set: save };
})();
