/* Page menu: tab bar at the bottom on phones, a floating pill at the top on larger screens. */
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
  function visible() {
    return items.filter(function (it) { return it[0] === 'home' || it[0] === page || !Fe || Fe.on(it[0] === 'habits' ? 'healthpage' : it[0]); });
  }
  var nav = document.createElement('nav');
  nav.className = 'tabbar';
  nav.setAttribute('aria-label', 'Pages');
  function draw() {
    var list = visible();
    nav.classList.toggle('tb-many', list.length > 5);
    nav.innerHTML = list.map(function (it) {
      var on = it[0] === page;
      return '<a href="' + base + it[1] + '"' + (on ? ' aria-current="page"' : '') + '><i class="bi bi-' + it[2] + '"></i><span>' + it[3] + '</span></a>';
    }).join('') + '<a href="' + base + (page === 'home' ? '#settings' : '?settings') + '" data-settings><i class="bi bi-gear"></i><span>Settings</span></a>';
  }
  draw();
  window.addEventListener('features:change', draw);
  document.body.appendChild(nav);
  document.documentElement.classList.add('has-tabbar');

  nav.addEventListener('click', function (e) {
    var s = e.target.closest('[data-settings]');
    if (s && page === 'home' && document.getElementById('settingsBtn')) { e.preventDefault(); document.getElementById('settingsBtn').click(); }
  });
  /* Arriving from another page via "Settings": open the panel once unlocked */
  if (page === 'home' && /[?&]settings/.test(location.search) && window.Vault) {
    window.Vault.onUnlock(function () {
      history.replaceState(null, '', location.pathname);
      setTimeout(function () { var b = document.getElementById('settingsBtn'); if (b) b.click(); }, 300);
    });
  }
})();
