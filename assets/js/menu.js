/**
 * Phone/tablet menu: close by tapping the dimmed page or pressing Esc,
 * keep the page from scrolling while the menu is open.
 */
(function () {
  "use strict";

  var header = document.querySelector('#header');
  var toggle = document.querySelector('.header-toggle');
  var backdrop = document.querySelector('.nav-backdrop');
  if (!header || !toggle) return;

  function isOpen() { return header.classList.contains('header-show'); }

  function sync() {
    var open = isOpen();
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  // main.js opens/closes the menu; keep our state in step with it
  new MutationObserver(sync).observe(header, { attributes: true, attributeFilter: ['class'] });

  if (backdrop) backdrop.addEventListener('click', function () { if (isOpen()) toggle.click(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) toggle.click();
  });

  toggle.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle.click(); }
  });
})();
