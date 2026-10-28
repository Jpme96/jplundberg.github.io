/* Page menu: a floating pill – at the bottom on phones, at the top on larger screens.
   The highlight slides to the page you tap, on every device (and from the last page on arrival). */
(function () {
  "use strict";
  var path = location.pathname.replace(/index\.html$/, '');
  var base = path.replace(/(finance|habits|travel|calendar|work)\/$/, '');          // the /cmd/ folder
  var page = (path.match(/(finance|habits|travel|calendar|work)\/$/) || [, 'home'])[1];
  var items = [
    ['home', '', 'house-door', 'Home'],
    ['calendar', 'calendar/', 'calendar3', 'Calendar'],
    ['travel', 'travel/', 'signpost-split', 'Travel'],
    ['finance', 'finance/', 'wallet2', 'Finances'],
    ['habits', 'habits/', 'heart-pulse', 'Health'],
    ['work', 'work/', 'briefcase', 'Work']
  ];
  /* only the parts switched on in Settings → Features (the page you're on always shows) */
  var Fe = window.Features;
  /* a page stays in the menu while anything on it is switched on */
  var SHOWS = { habits: ['healthpage'], finance: ['finance', 'subs', 'warranty'], travel: ['travel', 'bucket'] };
  function visible() {
    return items.filter(function (it) { return it[0] === 'home' || it[0] === page || !Fe || (SHOWS[it[0]] || [it[0]]).some(Fe.on); });
  }
  var nav = document.createElement('nav');
  nav.className = 'tabbar';
  nav.setAttribute('aria-label', 'Pages');
  function draw() {
    var list = visible();
    nav.classList.toggle('tb-many', list.length > 6);
    nav.innerHTML = '<span class="tb-ind" aria-hidden="true"></span>' + list.map(function (it) {
      var on = it[0] === page;
      return '<a href="' + base + it[1] + '" data-pg="' + it[0] + '"' + (on ? ' aria-current="page"' : '') + '><i class="bi bi-' + it[2] + '"></i><span>' + it[3] + '</span></a>';
    }).join('');
    whenShown(function () { slide(nav.querySelector('[aria-current]'), true); });
  }
  /* the menu only shows once unlocked: measure it then */
  function whenShown(fn) {
    requestAnimationFrame(function () {
      if (nav.offsetWidth) fn();
      else if (window.Vault) window.Vault.onUnlock(function () { requestAnimationFrame(fn); });
    });
  }

  /* ---------- the sliding highlight ---------- */
  function slide(a, instant) {
    var ind = nav.querySelector('.tb-ind');
    if (!ind || !a) return;
    if (instant) ind.classList.add('no-anim');
    ind.style.width = a.offsetWidth + 'px';
    ind.style.height = a.offsetHeight + 'px';
    ind.style.transform = 'translate(' + a.offsetLeft + 'px,' + a.offsetTop + 'px)';
    ind.classList.add('on');
    if (instant) { void ind.offsetWidth; ind.classList.remove('no-anim'); }
  }
  draw();
  window.addEventListener('features:change', draw);
  document.body.appendChild(nav);
  document.documentElement.classList.add('has-tabbar');
  window.addEventListener('resize', function () { slide(nav.querySelector('[aria-current]'), true); });

  /* arriving from another page: start at that page's tab, then glide here */
  var from = null;
  try { from = sessionStorage.getItem('dash.tbFrom'); sessionStorage.removeItem('dash.tbFrom'); } catch (e) {}
  if (from && from !== page) {
    var start = function () {
      var a = nav.querySelector('[data-pg="' + from + '"]'), cur = nav.querySelector('[aria-current]');
      if (!a || !cur) return;
      slide(a, true);
      requestAnimationFrame(function () { requestAnimationFrame(function () { slide(cur); }); });
    };
    whenShown(start);
  }
  /* tapping a tab: the highlight moves first, then the page changes */
  nav.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-pg]');
    if (!a || a.getAttribute('aria-current') || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    try { sessionStorage.setItem('dash.tbFrom', page); } catch (x) {}
    nav.querySelectorAll('a').forEach(function (x) { x.classList.toggle('going', x === a); });
    slide(a);
    var off = document.documentElement.classList.contains('mo-off');
    setTimeout(function () { location.href = a.href; }, off ? 0 : 170);
  });

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
