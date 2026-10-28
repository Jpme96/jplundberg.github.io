/**
 * Home page spotlight: the section in the middle of the screen is shown at full
 * strength, and the others fade. The fade follows the scroll position
 * continuously, so it moves with your finger. The menu highlights the section
 * in focus. Turned off for "reduce motion".
 */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var sections = Array.prototype.slice.call(document.querySelectorAll('.index-page .main > section:not(.hero)'));
  if (sections.length < 2) return;
  var hero = document.querySelector('.index-page .main > section.hero');
  document.body.classList.add('spot-on');

  function menuLink(id) {
    var nav = document.querySelector('#navmenu');
    if (!nav) return null;
    if (id === 'projects') return nav.querySelector('a[href*="/projects/"]');
    if (id === 'articles') return nav.querySelector('a[href*="/articles/"]');
    return nav.querySelector('a[href$="#' + id + '"]');
  }

  var focusId = null;
  function markMenu() {
    var link = menuLink(focusId || 'hero');
    if (!link) return;
    document.querySelectorAll('#navmenu a.active').forEach(function (a) { if (a !== link) a.classList.remove('active'); });
    link.classList.add('active');
  }

  // Lowest strength comes from the stylesheet (lighter on large screens)
  function minLevel() {
    var v = parseFloat(getComputedStyle(document.body).getPropertyValue('--spot-min'));
    return isNaN(v) ? 0.42 : v;
  }

  var ticking = false;
  function update() {
    ticking = false;
    var vh = window.innerHeight;
    var mid = vh * 0.5;
    var range = vh * 0.38;            // distance over which a section fades out
    var min = minLevel();
    var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    var heroRect = hero ? hero.getBoundingClientRect() : null;
    var heroInView = heroRect && heroRect.bottom > mid;

    var best = null, bestDist = Infinity;
    sections.forEach(function (s, i) {
      var r = s.getBoundingClientRect();
      // 0 when the section covers the middle line, otherwise how far its edge is from it
      var dist = r.top > mid ? r.top - mid : (r.bottom < mid ? mid - r.bottom : 0);
      if (atBottom && i === sections.length - 1) dist = 0;
      var t = Math.min(1, dist / range);
      var eased = t * t * (3 - 2 * t);  // smoothstep: gentle start and end
      var level = heroInView ? 1 : 1 - (1 - min) * eased;
      s.style.setProperty('--spot', level.toFixed(3));
      if (dist < bestDist) { bestDist = dist; best = s; }
    });

    if (atBottom) best = sections[sections.length - 1];
    var id = heroInView ? null : (best ? best.id : null);
    if (id !== focusId) { focusId = id; }
    markMenu();
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', update);
  update();
})();
