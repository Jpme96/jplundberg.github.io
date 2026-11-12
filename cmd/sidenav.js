/* The side bar (Settings → Appearance → Menu: Bar / Side bar; the look is in sidenav.css).
   - The choice (settings.nav = 'side') is synced like the rest of Appearance. It needs the Modern look and
     shows on wide screens only; phones keep the bottom bar.
   - Open / icons / hidden is remembered per device (localStorage dash.sideNav): the arrow on the bar's edge
     folds it to icons and back, the sidebar button hides it, the corner button (or the [ key) brings it back.
   - Opening and closing is a view transition: the bar grows or slides, the page slides along – smooth even
     with a full dashboard, because nothing is re-laid out while it moves. Without view transitions it falls
     back to CSS transitions; with motion off it just switches.
   In the head bundle, so the page is laid out for the side bar before the first paint. */
(function () {
  "use strict";
  var root = document.documentElement, KEY = 'dash.settings', ST = 'dash.sideNav';
  var wide = window.matchMedia ? matchMedia('(min-width: 1024px)') : { matches: false, addEventListener: function () {} };
  function settings() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function mode() { var m = null; try { m = localStorage.getItem(ST); } catch (e) {} return m === 'icons' || m === 'hidden' ? m : 'open'; }
  function on() { var s = settings(); return s.nav === 'side'; }
  function classes(m) {
    var o = on();
    root.classList.toggle('side-nav', o);
    root.classList.toggle('sn-mini', o && m === 'icons');
    root.classList.toggle('sn-hide', o && m === 'hidden');
  }
  classes(mode());
  function t(s) { return window.I18N && I18N.t ? I18N.t(s) : s; }
  function active() { return on() && wide.matches; }

  /* ---------- switching state, smoothly ---------- */
  function ref() { return document.querySelector('.top') || document.getElementById('fp') || document.querySelector('main'); }
  function go(m) {
    var from = mode(); if (m === from) return;
    var el = ref(), a = el && el.getBoundingClientRect();
    function apply() {
      try { localStorage.setItem(ST, m); } catch (e) {}
      classes(m); labels();
      if (a) { var b = el.getBoundingClientRect(); root.style.setProperty('--sn-dx', (a.left - b.left) + 'px'); root.style.setProperty('--sn-dy', (a.top - b.top) + 'px'); }
    }
    var smooth = document.startViewTransition && active() && !root.classList.contains('mo-off') && !root.classList.contains('vt-active');
    if (!smooth) { apply(); settle(); return; }
    root.classList.add('sn-vt');
    var vt;
    try { vt = document.startViewTransition(apply); } catch (e) { root.classList.remove('sn-vt'); apply(); settle(); return; }
    vt.finished.then(done, done); if (vt.ready) vt.ready.catch(function () {});   /* a skipped transition (a quick second tap) rejects ready – not an error */
    function done() { root.classList.remove('sn-vt'); settle(); }
  }
  /* cards that measure themselves (masonry, the menu fitting) get told the room changed */
  function settle() { requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); }); }

  /* ---------- the buttons ---------- */
  var fold, hide, open, upB, downB;
  function btn(cls, icon) { var b = document.createElement('button'); b.type = 'button'; b.className = cls; b.innerHTML = '<i class="bi bi-' + icon + '"></i>'; return b; }
  function labels() {
    var m = mode();
    if (fold) { var l = t(m === 'icons' ? 'Show page names' : 'Icons only'); fold.setAttribute('aria-label', l); fold.title = l; }
    if (hide) { var h = t(I18N.k('ui.hide-the-side-bar', 'Hide the side bar')); hide.setAttribute('aria-label', h); hide.title = h + ' ( [ )'; }
    if (open) { var o = t(I18N.k('ui.show-the-side-bar', 'Show the side bar')); open.setAttribute('aria-label', o); open.title = o + ' ( [ )'; }
    if (upB) { upB.setAttribute('aria-label', t(I18N.k('ui.more-pages-above', 'More pages above'))); upB.title = t(I18N.k('ui.more-pages-above', 'More pages above')); }
    if (downB) { downB.setAttribute('aria-label', t(I18N.k('ui.more-pages-below', 'More pages below'))); downB.title = t(I18N.k('ui.more-pages-below', 'More pages below')); }
    document.querySelectorAll('.tabbar a[data-pg]').forEach(function (a) { var n = a.querySelector('span:last-child'); a.setAttribute('data-tip', ((n && n.textContent) || a.textContent || '').trim()); });
  }
  function mount() {
    var bar = document.querySelector('.mbar');
    if (bar && !bar.querySelector('.sn-fold')) {
      fold = btn('sn-fold', 'chevron-left'); bar.appendChild(fold);
      fold.addEventListener('click', function () { go(mode() === 'icons' ? 'open' : 'icons'); });
      var acts = bar.querySelector('.mb-acts');
      hide = btn('icon-btn sn-hidebtn', 'layout-sidebar-inset'); if (acts) acts.appendChild(hide);
      hide.addEventListener('click', function () { go('hidden'); });
    }
    /* "more pages" rows just above and below the list – only when it has to scroll (their own rows, so they never
       sit on top of a page icon); a click scrolls that way */
    if (bar && !bar.querySelector('.sn-more')) {
      upB = btn('sn-more sn-more-up', 'chevron-up'); downB = btn('sn-more sn-more-down', 'chevron-down');
      bar.appendChild(upB); bar.appendChild(downB);      /* put in place around the list by edges() */
      [[upB, -1], [downB, 1]].forEach(function (x) { x[0].addEventListener('click', function () { var l = bar.querySelector('.tabbar'); if (l) l.scrollBy({ top: x[1] * Math.max(80, l.clientHeight * .7), behavior: root.classList.contains('mo-off') ? 'auto' : 'smooth' }); }); });
    }
    if (!document.querySelector('.sn-open')) {
      open = btn('sn-open', 'layout-sidebar'); document.body.appendChild(open);
      open.addEventListener('click', function () { go('open'); });
    }
    labels(); sync();
  }

  /* ---------- the setting (Settings → Appearance → Menu) ---------- */
  function sync() {
    var s = settings(), side = s.nav === 'side';
    document.querySelectorAll('[data-nav-opt]').forEach(function (b) { b.setAttribute('aria-pressed', String((b.dataset.navOpt === 'side') === side)); });
    var note = document.getElementById('stNavNote');
    if (note) note.textContent = t(side ? 'On wider screens – iPad across and computers. Phones keep the bottom bar.' : 'At the top on a computer, at the bottom on a phone');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-nav-opt]'); if (!b) return;
    var s = settings(); if (b.dataset.navOpt === 'side') s.nav = 'side'; else delete s.nav;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (x) {}
    classes(mode()); sync(); settle();
    window.dispatchEvent(new Event('dash:local'));      // lock.js puts it in the synced vault
  });

  /* [ : open → icons → hidden → open (not while typing) */
  document.addEventListener('keydown', function (e) {
    if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey || !active()) return;
    var tg = e.target; if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
    if (document.querySelector('.st-backdrop.open, .fo-bg.open, .qa-sheet.open')) return;
    e.preventDefault();
    go({ open: 'icons', icons: 'hidden', hidden: 'open' }[mode()]);
  });

  /* another device or tab changed the setting, or the look changed */
  function refresh() { var had = root.classList.contains('side-nav'); classes(mode()); sync(); if (had !== root.classList.contains('side-nav')) settle(); fitSoon(); }
  window.addEventListener('dash:local', function () { clearTimeout(refresh.t); refresh.t = setTimeout(refresh, 60); });
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === ST) refresh(); });
  window.addEventListener('st:page', function (e) { if (e.detail === 'appearance') sync(); });

  /* synced settings arrive after unlocking, and with every pull from another device */
  if (window.Vault && window.Vault.onUnlock) window.Vault.onUnlock(function () { setTimeout(refresh, 0); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.addEventListener('softnav:swap', mount);
  /* instant page changes: the new page builds its menu bar (modern.js) only after the swap, so the arrow and the
     hide button are added again once it's done – otherwise they vanished after the first page change */
  window.addEventListener('softnav:done', function () { mount(); fitSoon(); });
  /* icons only: the page's name next to the icon you point at (floating, so the scrolling list doesn't cut it) */
  var tipEl = null;
  function tipHide() { if (tipEl) tipEl.classList.remove('on'); }
  function tipShow(a) {
    if (!root.classList.contains('sn-mini') || !active()) return tipHide();
    if (!tipEl || !tipEl.isConnected) { tipEl = document.createElement('div'); tipEl.className = 'sn-tip'; tipEl.setAttribute('aria-hidden', 'true'); document.body.appendChild(tipEl); }
    var r = a.getBoundingClientRect(), bar = a.closest('.tabbar').getBoundingClientRect();
    if (r.bottom < bar.top || r.top > bar.bottom) return tipHide();
    tipEl.textContent = a.getAttribute('data-tip') || '';
    tipEl.style.left = (r.right + 16) + 'px'; tipEl.style.top = (r.top + r.height / 2) + 'px';
    requestAnimationFrame(function () { tipEl.classList.add('on'); });
  }
  function tipFrom(e) { return e.target && e.target.closest ? e.target.closest('.mbar .tabbar a[data-tip]') : null; }
  document.addEventListener('mouseover', function (e) { var a = tipFrom(e); if (a) tipShow(a); else tipHide(); });
  document.addEventListener('focusin', function (e) { var a = tipFrom(e); if (a && a.matches(':focus-visible')) tipShow(a); else tipHide(); });
  document.addEventListener('scroll', tipHide, true);
  window.addEventListener('softnav:swap', tipHide);   /* a new page's menu came in without a reload */
  /* ---------- fit the pages in the window ----------
     Normal spacing if it fits; otherwise closer rows (sn-fit1), then smaller rows too (sn-fit2). Only if even that
     is too tall does the list scroll – with a fade at the edge that has more, and the page you're on kept in view. */
  function list() { return active() && !root.classList.contains('sn-hide') ? document.querySelector('.mbar .tabbar') : null; }
  function over(l) { return l.scrollHeight > l.clientHeight + 1; }
  function edges() {
    var l = document.querySelector('.mbar .tabbar'); if (!l) return;
    var on2 = !!list() && over(l), up = on2 && l.scrollTop > 2, down = on2 && l.scrollTop + l.clientHeight < l.scrollHeight - 2;
    l.classList.toggle('sn-up', up); l.classList.toggle('sn-down', down);
    /* the rows stay while it scrolls (dimmed at the end), so nothing jumps as you scroll */
    var bar = l.parentNode; if (!bar || !bar.classList || !bar.classList.contains('mbar')) return;
    var u = bar.querySelector('.sn-more-up'), dn = bar.querySelector('.sn-more-down');
    if (u && u.nextSibling !== l) bar.insertBefore(u, l);                 /* the list moves in and out of the bar (phone ↔ computer) */
    if (dn && l.nextSibling !== dn) bar.insertBefore(dn, l.nextSibling);
    if (u) { u.classList.toggle('on', on2); u.disabled = !up; }
    if (dn) { dn.classList.toggle('on', on2); dn.disabled = !down; }
  }
  /* The list stays where you left it: a page change brings a new list, which gets the same scroll as the old one, and
     it only moves if the page you're on would be hidden or under the fade – then just enough to show it. */
  var keepTop = 0, fitted = null, ro = null;
  function fit() {
    var l = list(), st = l && l === fitted ? l.scrollTop : keepTop;
    root.classList.remove('sn-fit1', 'sn-fit2');
    document.querySelectorAll('.mbar .sn-more.on').forEach(function (x) { x.classList.remove('on'); });
    if (!l) { edges(); return; }
    if (over(l)) { root.classList.add('sn-fit1'); if (over(l)) root.classList.add('sn-fit2'); }
    edges();                                    /* the "more" rows take their room before the list is measured */
    l.scrollTop = st;
    var cur = l.querySelector('a[aria-current="page"]');
    if (cur && over(l)) {
      var r = cur.getBoundingClientRect(), b = l.getBoundingClientRect(), m = 34;
      if (r.top < b.top + m) l.scrollTop -= b.top + m - r.top; else if (r.bottom > b.bottom - m) l.scrollTop += r.bottom - (b.bottom - m);
    }
    keepTop = l.scrollTop; fitted = l;
    /* buttons added to the bar later (by the page) leave the list less room: measure again when its room changes */
    if (window.ResizeObserver) { if (!ro) ro = new ResizeObserver(function () { fitSoon(); }); if (!l.__snRO) { ro.observe(l); l.__snRO = 1; } }
    edges();
  }
  function fitSoon() { clearTimeout(fitSoon.t); fitSoon.t = setTimeout(function () { requestAnimationFrame(fit); }, 60); }
  window.addEventListener('resize', fitSoon);
  window.addEventListener('softnav:swap', fitSoon);
  window.addEventListener('dash:local', fitSoon);           /* pages switched on/off, the bar opened or folded */
  wide.addEventListener && wide.addEventListener('change', fitSoon);
  if (window.Vault && window.Vault.onUnlock) window.Vault.onUnlock(fitSoon);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fitSoon); else fitSoon();
  document.addEventListener('scroll', function (e) { if (e.target && e.target.classList && e.target.classList.contains('tabbar')) { if (e.target === fitted) keepTop = e.target.scrollTop; edges(); } }, true);

  window.SideNav = { mode: mode, set: go, on: active, fit: fit };
})();
