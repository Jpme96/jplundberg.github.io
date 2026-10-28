/* Page menu: a floating pill – at the bottom on phones, at the top on larger screens.
   The highlight slides to the page you tap, on every device (and from the last page on arrival). */
(function () {
  "use strict";
  var path = location.pathname.replace(/index\.html$/, '');
  var base = path.replace(/(finance|habits|travel|calendar|work)\/$/, '');          // the /cmd/ folder
  var page = (path.match(/(finance|habits|travel|calendar|work)\/$/) || [, 'home'])[1];
  var Fe = window.Features;
  /* The menu is written into every page (so it's there from the very first frame and the
     highlight can glide between pages). Here it only follows Settings → Features. */
  var SHOWS = { calendar: ['calendar'], travel: ['travel', 'bucket'], finance: ['finance', 'subs', 'warranty'], habits: ['healthpage'], work: ['work'] };
  var nav = document.getElementById('tabbar');
  function draw() {
    if (!Fe) return;
    Object.keys(SHOWS).forEach(function (k) { document.documentElement.classList.toggle('tab-off-' + k, !SHOWS[k].some(Fe.on)); });
  }
  draw();
  window.addEventListener('features:change', draw);
  document.documentElement.classList.add('has-tabbar');

  /* ---------- the highlight: one continuous slide to the page you tap ----------
     Browsers that animate between pages (Safari 18.2+, Chrome) move the highlight themselves,
     from the old tab to the new one, while the page changes (view-transition-name: tb-pill).
     Older browsers: it slides first, then the page changes. */
  var crossDoc = 'onpagereveal' in window || typeof window.PageRevealEvent === 'function';
  try { sessionStorage.removeItem('dash.tbFrom'); } catch (e) {}
  /* While pages swap, the menu is drawn solid: a frosted (blurred) background can't be carried
     through the animation and turned into a smear. */
  window.addEventListener('pagereveal', function (e) {
    var root = document.documentElement;
    if (!e.viewTransition) { root.classList.remove('vt-active'); return; }
    root.classList.add('vt-active');
    e.viewTransition.finished.then(function () { root.classList.remove('vt-active'); }, function () { root.classList.remove('vt-active'); });
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) document.documentElement.classList.remove('vt-active'); });
  nav.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-pg]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (a.getAttribute('aria-current')) { e.preventDefault(); return; }
    nav.querySelectorAll('a').forEach(function (x) { x.classList.toggle('going', x === a); });
    var off = document.documentElement.classList.contains('mo-off');
    if (crossDoc || off) { document.documentElement.classList.add('vt-active'); return; }   // the browser does the rest
    e.preventDefault();
    var pill = nav.querySelector('.tb-pill'), cur = pill && pill.parentNode;
    if (pill) {
      pill.style.transform = 'translateX(' + (a.offsetLeft - cur.offsetLeft) + 'px)';
      pill.style.width = a.offsetWidth + 'px';
    }
    setTimeout(function () { location.href = a.href; }, 400);
  });

  /* Slide your finger along the menu: the highlight follows, let go to open that page */
  var drag = null;
  function tabs() { return Array.prototype.filter.call(nav.querySelectorAll('a[data-pg]'), function (a) { return a.offsetWidth; }); }
  function tabAt(x) { var l = tabs(); for (var i = 0; i < l.length; i++) { var r = l[i].getBoundingClientRect(); if (x < r.right) return l[i]; } return l[l.length - 1]; }
  nav.addEventListener('touchstart', function (e) {
    var t = e.touches[0], pill = nav.querySelector('.tb-pill');
    if (!pill) return;
    drag = { x0: t.clientX, moved: false, pill: pill, home: pill.parentNode, target: null };
  }, { passive: true });
  nav.addEventListener('touchmove', function (e) {
    if (!drag) return;
    var t = e.touches[0];
    if (!drag.moved && Math.abs(t.clientX - drag.x0) < 12) return;
    drag.moved = true;
    var a = tabAt(t.clientX), h = drag.home.getBoundingClientRect(), r = a.getBoundingClientRect();
    drag.pill.style.transition = 'transform .24s cubic-bezier(.45,0,.2,1), width .24s cubic-bezier(.45,0,.2,1)';
    drag.pill.style.transform = 'translateX(' + (r.left - h.left) + 'px)';
    drag.pill.style.width = r.width + 'px';
    nav.querySelectorAll('a').forEach(function (x) { x.classList.toggle('going', x === a && !a.getAttribute('aria-current')); });
    if (drag.target !== a && navigator.vibrate) navigator.vibrate(6);
    drag.target = a;
  }, { passive: true });
  nav.addEventListener('touchend', function (e) {
    if (!drag) return;
    var d = drag; drag = null;
    if (!d.moved) return;                       // a normal tap: the click does the rest
    e.preventDefault();
    var a = d.target;
    if (!a || a.getAttribute('aria-current')) { d.pill.style.transform = ''; d.pill.style.width = ''; nav.querySelectorAll('a.going').forEach(function (x) { x.classList.remove('going'); }); return; }
    document.documentElement.classList.add('vt-active');
    setTimeout(function () { location.href = a.href; }, 120);
  });
  nav.addEventListener('touchcancel', function () { if (drag) { drag.pill.style.transform = ''; drag.pill.style.width = ''; drag = null; } });

  nav.addEventListener('click', function (e) {
    var s = e.target.closest('[data-settings]');
    if (s && page === 'home' && document.getElementById('settingsBtn')) { e.preventDefault(); document.getElementById('settingsBtn').click(); }
  });
  /* Arriving from another page via "Settings": open the panel once unlocked */
  if (page === 'home' && /[?&]settings/.test(location.search) && window.Vault) {
    window.Vault.onUnlock(function () {
      var m = location.search.match(/[?&]settings=([a-z]+)/);
      history.replaceState(null, '', location.pathname);
      setTimeout(function () {
        var b = document.getElementById('settingsBtn'); if (b) b.click();
        if (m) setTimeout(function () { var g = document.querySelector('[data-go="' + m[1] + '"]'); if (g) g.click(); }, 80);
      }, 300);
    });
  }
})();
