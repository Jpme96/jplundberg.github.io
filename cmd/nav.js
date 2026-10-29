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

  /* ---------- your own menu order (Settings → Dashboard → Menu). Home stays first. ----------
     The head script sets --nav-<page> before the first frame; here the links are also put in that
     order, so keyboard and screen readers follow what you see. */
  function navOrder() { try { var o = (JSON.parse(localStorage.getItem('dash.settings')) || {}).navOrder; return Array.isArray(o) ? o : null; } catch (e) { return null; } }
  function pages() { return Array.prototype.map.call(nav ? nav.querySelectorAll('a[data-pg]') : [], function (a) { return a.dataset.pg; }).filter(function (k) { return k !== 'home'; }); }
  function sortedPages() {
    var o = navOrder() || [], def = ['calendar', 'travel', 'finance', 'habits', 'work'];
    return pages().sort(function (a, b) { var ia = o.indexOf(a), ib = o.indexOf(b); return (ia < 0 ? 50 + def.indexOf(a) : ia) - (ib < 0 ? 50 + def.indexOf(b) : ib); });
  }
  function applyOrder() {
    if (!nav) return;
    var r = document.documentElement, list = sortedPages();
    list.forEach(function (k, i) { r.style.setProperty('--nav-' + k, i + 1); var a = nav.querySelector('a[data-pg="' + k + '"]'); if (a) nav.appendChild(a); });
    var box = document.getElementById('stNav'); if (!box) return;
    var name = function (k) { var a = nav.querySelector('a[data-pg="' + k + '"] span:last-child'); return a ? a.textContent : k; };
    var icon = function (k) { var i = nav.querySelector('a[data-pg="' + k + '"] .bi'); return i ? i.className : 'bi bi-circle'; };
    var ico = function (k) { return '<span class="st-ico" style="--c:var(--accent)"><i class="' + icon(k) + '"></i></span>'; };
    box.innerHTML = '<div class="st-row st-nav-row is-fixed">' + ico('home') + '<span class="st-label">' + name('home') + '<small>Always first</small></span></div>' +
      list.map(function (k, i) {
        return '<div class="st-row st-nav-row">' + ico(k) + '<span class="st-label">' + name(k) + '</span><span class="pk-mv">' +
          '<button type="button" class="icon-btn" data-navmove="' + k + '" data-d="-1" aria-label="Move ' + name(k) + ' left"' + (i ? '' : ' disabled') + '><i class="bi bi-arrow-up"></i></button>' +
          '<button type="button" class="icon-btn" data-navmove="' + k + '" data-d="1" aria-label="Move ' + name(k) + ' right"' + (i < list.length - 1 ? '' : ' disabled') + '><i class="bi bi-arrow-down"></i></button></span></div>';
      }).join('');
  }
  applyOrder();
  window.addEventListener('dash:local', function () { var o = JSON.stringify(navOrder()); if (o !== applyOrder.last) { applyOrder.last = o; applyOrder(); } });
  applyOrder.last = JSON.stringify(navOrder());
  if (window.Vault) window.Vault.onUnlock(function () { setTimeout(applyOrder, 0); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-navmove]'); if (!b) return;
    var list = sortedPages(), ix = list.indexOf(b.dataset.navmove), to = ix + (+b.dataset.d);
    if (to < 0 || to >= list.length) return;
    list.splice(to, 0, list.splice(ix, 1)[0]);
    try { var st = JSON.parse(localStorage.getItem('dash.settings')) || {}; st.navOrder = list; localStorage.setItem('dash.settings', JSON.stringify(st)); } catch (x) {}
    applyOrder.last = JSON.stringify(list); applyOrder(); window.dispatchEvent(new Event('dash:local'));
    var nb = document.querySelector('[data-navmove="' + b.dataset.navmove + '"][data-d="' + b.dataset.d + '"]'); if (nb && !nb.disabled) nb.focus();
  });
  document.documentElement.classList.add('has-tabbar');

  /* ---------- the highlight: one continuous slide to the page you tap ----------
     Browsers that animate between pages (Safari 18.2+, Chrome) move the highlight themselves,
     from the old tab to the new one, while the page changes (view-transition-name: tb-pill).
     Older browsers: it slides first, then the page changes. */
  var crossDoc = 'onpagereveal' in window || typeof window.PageRevealEvent === 'function';
  try { sessionStorage.removeItem('dash.tbFrom'); } catch (e) {}
  /* While pages swap, the menu is drawn solid: a frosted (blurred) background can't be carried
     through the animation and turned into a smear. */
  /* (the pagereveal listener that adds vt-active/vt-in lives in each page's head script) */
  /* Only one page change at a time: extra taps while a page is on its way are ignored
     (each tap used to start loading again, which made the change stutter). */
  var leaving = false;
  window.addEventListener('pageshow', function (e) {
    leaving = false;
    if (e.persisted) { document.documentElement.classList.remove('vt-active'); var pl = nav.querySelector('.tb-pill'); if (pl) { pl.style.transform = ''; pl.style.width = ''; } nav.querySelectorAll('a.going').forEach(function (x) { x.classList.remove('going'); }); }
  });
  /* Instant answer to a tap: the highlight starts moving the moment your finger touches the tab,
     while the next page loads – so the menu never feels like it's waiting. */
  function slideTo(a) {
    var pill = nav.querySelector('.tb-pill'), home = pill && pill.parentNode; if (!pill) return;
    var h = home.getBoundingClientRect(), r = a.getBoundingClientRect();
    pill.style.transition = 'transform .26s cubic-bezier(.3,.7,.2,1), width .26s cubic-bezier(.3,.7,.2,1)';
    pill.style.transform = 'translateX(' + (r.left - h.left) + 'px)'; pill.style.width = r.width + 'px';
    nav.querySelectorAll('a').forEach(function (x) { x.classList.toggle('going', x === a); });
  }
  function unslide() { var pill = nav.querySelector('.tb-pill'); if (pill) { pill.style.transform = ''; pill.style.width = ''; } nav.querySelectorAll('a.going').forEach(function (x) { x.classList.remove('going'); }); }
  var pressed = null;
  nav.addEventListener('pointerdown', function (e) {
    var a = e.target.closest('a[data-pg]'); if (!a || a.getAttribute('aria-current') || leaving || e.button > 0) return;
    pressed = a; slideTo(a);
  });
  nav.addEventListener('pointercancel', function () { if (pressed && !leaving) unslide(); pressed = null; });
  nav.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-pg]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (leaving) { e.preventDefault(); return; }
    /* the page you're on: back to the top instead of loading it again */
    if (a.getAttribute('aria-current')) {
      e.preventDefault();
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: document.documentElement.classList.contains('mo-off') ? 'auto' : 'smooth' });
      return;
    }
    leaving = true;
    var off = document.documentElement.classList.contains('mo-off');
    if (pressed !== a) slideTo(a);              // keyboard or a click without a press first
    pressed = null;
    if (crossDoc || off) { document.documentElement.classList.add('vt-active'); return; }   // the browser does the rest
    e.preventDefault();
    setTimeout(function () { location.href = a.href; }, 160);
  });

  /* Slide your finger along the menu: the highlight follows, let go to open that page */
  var drag = null;
  function tabs() { return Array.prototype.filter.call(nav.querySelectorAll('a[data-pg]'), function (a) { return a.offsetWidth; }).sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; }); }
  function tabAt(x) { var l = tabs(); for (var i = 0; i < l.length; i++) { var r = l[i].getBoundingClientRect(); if (x < r.right) return l[i]; } return l[l.length - 1]; }
  nav.addEventListener('touchstart', function (e) {
    var t = e.touches[0], pill = nav.querySelector('.tb-pill');
    if (!pill || leaving) return;
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
    if (!a || a.getAttribute('aria-current') || leaving) { d.pill.style.transform = ''; d.pill.style.width = ''; nav.querySelectorAll('a.going').forEach(function (x) { x.classList.remove('going'); }); return; }
    leaving = true;
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
