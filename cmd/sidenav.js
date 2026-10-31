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
  function on() { var s = settings(); return s.nav === 'side' && s.look !== 'classic'; }
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
    vt.finished.then(done, done);
    function done() { root.classList.remove('sn-vt'); settle(); }
  }
  /* cards that measure themselves (masonry, the menu fitting) get told the room changed */
  function settle() { requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); }); }

  /* ---------- the buttons ---------- */
  var fold, hide, open;
  function btn(cls, icon) { var b = document.createElement('button'); b.type = 'button'; b.className = cls; b.innerHTML = '<i class="bi bi-' + icon + '"></i>'; return b; }
  function labels() {
    var m = mode();
    if (fold) { var l = t(m === 'icons' ? 'Show page names' : 'Icons only'); fold.setAttribute('aria-label', l); fold.title = l; }
    if (hide) { var h = t('Hide the side bar'); hide.setAttribute('aria-label', h); hide.title = h + ' ( [ )'; }
    if (open) { var o = t('Show the side bar'); open.setAttribute('aria-label', o); open.title = o + ' ( [ )'; }
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
    if (note) note.textContent = t(s.look === 'classic' ? 'The side bar needs the Modern look'
      : side ? 'On wider screens – iPad across and computers. Phones keep the bottom bar.' : 'At the top on a computer, at the bottom on a phone');
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
  function refresh() { var had = root.classList.contains('side-nav'); classes(mode()); sync(); if (had !== root.classList.contains('side-nav')) settle(); }
  window.addEventListener('dash:local', function () { clearTimeout(refresh.t); refresh.t = setTimeout(refresh, 60); });
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === ST) refresh(); });
  window.addEventListener('st:page', function (e) { if (e.detail === 'appearance') sync(); });

  /* synced settings arrive after unlocking, and with every pull from another device */
  if (window.Vault && window.Vault.onUnlock) window.Vault.onUnlock(function () { setTimeout(refresh, 0); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.SideNav = { mode: mode, set: go, on: active };
})();
