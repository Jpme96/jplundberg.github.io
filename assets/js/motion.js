/**
 * Site motion: opening animation, calm scroll reveals and the title rotator.
 * Replaces the template's animation library. Respects "reduce motion".
 * Whether to animate is decided early in the page <head> (the "motion" class).
 */
(function () {
  "use strict";

  // main.js still calls the old library; give it a harmless stand-in
  window.AOS = window.AOS || { init: function () {}, refresh: function () {} };

  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var animate = root.classList.contains('motion');
  try { sessionStorage.removeItem('jpl-skip-intro'); } catch (e) {}

  var GROUPS = '.timeline .resume-item, .article-cards .article-card, .highlights > div, .system-tags li, ' +
               '.project-cards .project-card-link, .project-stats > div, .project-parts .project-part';

  if (animate) setupReveals();
  setupRotator();

  if (animate) {
    // Start the opening on the next frame so the starting state is painted first
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { root.classList.add('motion-ready'); });
    });
  }

  function reveal(el, delay) {
    el.style.transitionDelay = delay + 'ms';
    el.classList.add('shown');
    setTimeout(function () {
      el.classList.add('done');          // back to normal styles (hover effects etc.)
      el.style.transitionDelay = '';
    }, 950 + delay);
  }

  /* ---------- Scroll reveals ---------- */
  function setupReveals() {
    var targets = Array.prototype.slice.call(document.querySelectorAll(GROUPS));

    document.querySelectorAll('[data-aos]').forEach(function (el) {
      if (el.closest('.hero, .page-hero')) return;
      // A block that holds items appearing one by one shows instantly; its items do the animating
      if (el.querySelector(GROUPS)) { el.classList.add('shown', 'done'); return; }
      targets.push(el);
    });

    var io = new IntersectionObserver(function (entries) {
      entries.filter(function (e) { return e.isIntersecting; })
        .map(function (e) { return e.target; })
        .sort(function (a, b) { return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1; })
        .forEach(function (el, i) {
          io.unobserve(el);
          reveal(el, Math.min(i, 6) * 70);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    targets.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Title rotator ---------- */
  function setupRotator() {
    var box = document.querySelector('.role-rotator');
    if (!box) return;
    var roles = box.querySelectorAll('.role');
    if (roles.length < 2 || reduce) return;
    var i = 0;
    setInterval(function () {
      if (document.hidden) return;
      var current = roles[i];
      i = (i + 1) % roles.length;
      var next = roles[i];
      current.classList.remove('is-active');
      current.classList.add('is-leaving');
      next.classList.add('is-active');
      setTimeout(function () { current.classList.remove('is-leaving'); }, 700);
    }, 3200);
  }
})();
