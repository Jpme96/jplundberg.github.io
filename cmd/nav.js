/* Page menu: tab bar at the bottom on phones, a floating pill at the top on larger screens. */
(function () {
  "use strict";
  var path = location.pathname.replace(/index\.html$/, '');
  var base = path.replace(/(finance|habits)\/$/, '');          // the /cmd/ folder
  var page = /finance\/$/.test(path) ? 'finance' : /habits\/$/.test(path) ? 'habits' : 'home';
  var items = [
    ['home', '', 'house-door', 'Home'],
    ['finance', 'finance/', 'wallet2', 'Finances'],
    ['habits', 'habits/', 'activity', 'Habits']
  ];
  var nav = document.createElement('nav');
  nav.className = 'tabbar';
  nav.setAttribute('aria-label', 'Pages');
  nav.innerHTML = items.map(function (it) {
    var on = it[0] === page;
    return '<a href="' + base + it[1] + '"' + (on ? ' aria-current="page"' : '') + '><i class="bi bi-' + it[2] + '"></i><span>' + it[3] + '</span></a>';
  }).join('') + '<a href="' + base + (page === 'home' ? '#settings' : '?settings') + '" data-settings><i class="bi bi-gear"></i><span>Settings</span></a>';
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
