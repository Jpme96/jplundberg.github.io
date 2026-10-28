/**
 * Home page spotlight: the section you are reading is shown at full strength,
 * the others fade gently. The menu highlights the same section.
 * Turned off for "reduce motion".
 */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  var sections = Array.prototype.slice.call(document.querySelectorAll('.index-page .main > section:not(.hero)'));
  if (sections.length < 2) return;
  var hero = document.querySelector('.index-page .main > section.hero');
  document.body.classList.add('spot-on');

  // Menu link for each section: "#about"-style links, or the Projects/Articles pages
  function menuLink(id) {
    var nav = document.querySelector('#navmenu');
    if (!nav) return null;
    if (id === 'projects') return nav.querySelector('a[href*="/projects/"]');
    if (id === 'articles') return nav.querySelector('a[href*="/articles/"]');
    return nav.querySelector('a[href$="#' + id + '"]');
  }

  var current;
  function markMenu() {
    var link = menuLink(current ? current.id : 'hero');
    if (!link) return;
    document.querySelectorAll('#navmenu a.active').forEach(function (a) { if (a !== link) a.classList.remove('active'); });
    link.classList.add('active');
  }

  function focus(sec) {
    if (sec === current) return;
    current = sec;
    sections.forEach(function (s) { s.classList.toggle('is-focus', s === sec); });
    document.body.classList.toggle('spot-hero', !sec);
    markMenu();
  }

  // A thin band across the middle of the screen decides which section is in focus
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) focus(e.target === hero ? null : e.target); });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  sections.forEach(function (s) { io.observe(s); });
  if (hero) io.observe(hero);

  window.addEventListener('scroll', function () {
    // At the very bottom, the last section (Contact) takes focus even if it is short
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) focus(sections[sections.length - 1]);
    // Runs after the template's own menu highlighting, so both always agree
    markMenu();
  }, { passive: true });
})();
