/* The notification panel (2026-11-20, JP): a bell in the top bar with a count of what you've been told since you last
   looked; a tap opens a popup with "Earlier" (the last three days) and "Coming up" (the next 24 hours) – the same
   reminders the phone gets (Notify.recent), worked out on this device from your data, nothing stored in plain text.
   A row opens where the reminder points. Seen = localStorage dash.ntSeen (a time). */
(function () {
  'use strict';
  var K = function (n, e, o) { return window.I18N && I18N.k ? I18N.k(n, e, o) : e; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function seen() { return +localStorage.getItem('dash.ntSeen') || 0; }
  /* removed ones (JP 2026-11-20: "make so I can delete the notification"): dash.ntGone = { 'id@time': when removed },
     kept five days – past the panel's three – then dropped */
  function gone() { try { return JSON.parse(localStorage.getItem('dash.ntGone') || '{}') || {}; } catch (e) { return {}; } }
  function keyOf(x) { return x.id + '@' + x.at; }
  function forget(list) {
    var g = gone(), lim = Date.now() - 5 * 864e5;
    Object.keys(g).forEach(function (k) { if (g[k] < lim) delete g[k]; });
    list.forEach(function (k) { g[k] = Date.now(); });
    try { localStorage.setItem('dash.ntGone', JSON.stringify(g)); } catch (e) {}
  }
  function items() { try { var g = gone(); return (window.Notify && Notify.recent ? Notify.recent(72, 24) : []).filter(function (x) { return !g[keyOf(x)]; }); } catch (e) { return []; } }
  var ICON = { ev: 'calendar3', bill: 'receipt', todo: 'check2-square', task: 'check2-square', bday: 'gift', trip: 'suitcase', checkin: 'clipboard-check', summary: 'bar-chart', morning: 'sunrise', dc: 'folder2-open', paper: 'file-earmark-text', house: 'house', people: 'people', timer: 'stopwatch' };
  function icon(id) { var k = String(id || '').split(':')[0]; return ICON[k] || 'bell'; }
  var btn = null;
  function when(t) {
    var d = new Date(t), now = new Date(), day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    var diff = Math.round((day(d) - day(now)) / 864e5), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (diff === 0) return K('ui.nt-today', 'Today') + ' ' + hm;
    if (diff === -1) return K('ui.nt-yesterday', 'Yesterday') + ' ' + hm;
    if (diff === 1) return K('ui.nt-tomorrow', 'Tomorrow') + ' ' + hm;
    return d.toLocaleDateString(window.I18N && I18N.lang === 'nb' ? 'nb-NO' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + hm;
  }
  /* "Needs you": what the number on the app icon counts – overdue bills, expired documents (At a glance, brief.js).
     On Home the lines themselves; elsewhere only their number is known (dash.needN), as one line to Home. JP 2026-11-20:
     "it says I have two notifications, but it does not show up" */
  function needN() { return window.BriefItems ? window.BriefItems.filter(function (x) { return x.badge; }).length : (+localStorage.getItem('dash.needN') || 0); }
  function needRows() {
    if (window.BriefItems) return window.BriefItems.filter(function (x) { return x.badge; }).map(function (x) {
      var h = String(x.href || ''), url = /^\//.test(h) ? h : '/cmd/' + h;
      return '<div class="nt-item nt-need"><a draggable="false" class="nt-row" href="' + esc(url) + '"><span class="nt-ic" style="color:var(--danger)"><i class="bi bi-' + esc(x.icon || 'exclamation-circle') + '"></i></span><span class="nt-tx"><b>' + esc(window.I18N && I18N.t ? I18N.t(x.title) : x.title) + '</b>' + (x.sub ? '<small>' + esc(window.I18N && I18N.t ? I18N.t(x.sub) : x.sub) + '</small>' : '') + '</span></a></div>';
    }).join('');
    var n = needN(); if (!n) return '';
    return '<div class="nt-item nt-need"><a draggable="false" class="nt-row" href="/cmd/#c=brief"><span class="nt-ic" style="color:var(--danger)"><i class="bi bi-exclamation-circle"></i></span><span class="nt-tx"><b>' + esc(K(n === 1 ? 'ui.nt-need1' : 'ui.nt-needn', n === 1 ? '1 thing needs you' : '{n} things need you', { n: n })) + '</b><small>' + esc(K('ui.nt-need-sub', 'On At a glance')) + '</small></span></a></div>';
  }
  function count() { var s = seen(), n = Date.now(); return items().filter(function (x) { return x.at <= n && x.at > s; }).length + needN(); }
  function badge() {
    if (!btn) return; var c = count(), b = btn.querySelector('.nt-badge');
    b.textContent = c > 9 ? '9+' : c; b.hidden = !c;
    btn.setAttribute('aria-label', c ? K('ui.nt-label-n', 'Notifications, {n} new', { n: c }) : K('ui.nt-label', 'Notifications'));
  }
  function row(x, isNew) {
    return '<div class="nt-item" data-ntk="' + esc(keyOf(x)) + '"><a draggable="false" class="nt-row' + (isNew ? ' nt-new' : '') + '" href="' + esc(x.url || '/cmd/') + '"><span class="nt-ic"><i class="bi bi-' + icon(x.id) + '"></i></span><span class="nt-tx"><b>' + esc(x.title) + '</b>' + (x.body ? '<small>' + esc(x.body) + '</small>' : '') + '</span><time>' + esc(when(x.at)) + '</time></a><button type="button" class="nt-x" data-ntdel aria-label="' + esc(K('ui.nt-del', 'Remove')) + '"><i class="bi bi-x-lg"></i></button></div>';
  }
  function open() {
    /* the popup's look lives in filedrop.js and is only added on first use – add it here too (JP 2026-11-20: it opened unstyled at the bottom of Finances) */
    if (window.FileDrop && FileDrop.style) FileDrop.style();
    var n = Date.now(), s = seen(), l = items();
    var past = l.filter(function (x) { return x.at <= n; }).reverse(), next = l.filter(function (x) { return x.at > n; });
    var ov = document.createElement('div'); ov.className = 'fdz-ov nt-ov';
    ov.innerHTML = '<div class="fdz-sh nt-sh" role="dialog" aria-modal="true" aria-label="' + esc(K('ui.nt-label', 'Notifications')) + '"><div class="fdz-hd"><b><i class="bi bi-bell"></i> ' + esc(K('ui.nt-label', 'Notifications')) + '</b><button type="button" class="icon-btn sm" data-ntclose aria-label="' + esc(K('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
      (needN() ? '<p class="nt-h">' + esc(K('ui.nt-need', 'Needs you')) + '</p>' + needRows() : '') +
      (past.length || next.length || needN() ? '' : '<p class="nt-empty">' + esc(K('ui.nt-empty', 'Nothing in the last three days or the next 24 hours.')) + '</p>') +
      (next.length ? '<p class="nt-h">' + esc(K('ui.nt-next', 'Coming up')) + '</p>' + next.map(function (x) { return row(x, false); }).join('') : '') +
      (past.length ? '<p class="nt-h nt-hp"><span>' + esc(K('ui.nt-past', 'Earlier')) + '</span><button type="button" class="nt-clear" data-ntall>' + esc(K('ui.nt-clear', 'Clear all')) + '</button></p><div class="nt-past">' + past.map(function (x) { return row(x, x.at > s); }).join('') + '</div>' : '') +
      '<p class="nt-foot"><a href="#" data-ntset>' + esc(K('ui.nt-settings', 'Which notifications you get')) + ' <i class="bi bi-chevron-right"></i></a></p></div>';
    var close = function () { ov.remove(); document.removeEventListener('keydown', key, true); if (!document.querySelector('.fdz-ov')) document.documentElement.classList.remove('fdz-modal'); };
    var key = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-ntclose]')) { close(); return; }
      if (e.target.closest('[data-ntset]')) { e.preventDefault(); close(); var sb = document.getElementById('settingsBtn'); if (sb) { sb.click(); setTimeout(function () { var g = document.querySelector('[data-go="notify"]'); if (g) g.click(); }, 80); } return; }
      var del = e.target.closest('[data-ntdel]'), all = e.target.closest('[data-ntall]');
      if (del || all) {
        e.preventDefault();
        var els = del ? [del.closest('.nt-item')] : [].slice.call(ov.querySelectorAll('.nt-past .nt-item'));
        forget(els.map(function (el) { return el.getAttribute('data-ntk'); }));
        els.forEach(function (el) { el.remove(); });
        if (!ov.querySelector('.nt-past .nt-item')) { var h = ov.querySelector('.nt-hp'); if (h) h.remove(); }
        if (!ov.querySelector('.nt-item') && !ov.querySelector('.nt-empty')) { var p = document.createElement('p'); p.className = 'nt-empty'; p.textContent = K('ui.nt-empty', 'Nothing in the last three days or the next 24 hours.'); ov.querySelector('.fdz-hd').after(p); }
        badge(); return;
      }
      if (e.target.closest('.nt-row')) close();
    });
    /* swipe a row sideways to remove it (JP 2026-11-20); a short drag springs back, and the tap after a swipe is not a click */
    /* phones: touch events, and once the finger moves sideways the page doesn't scroll (iPhone cancelled the pointer and
       scrolled instead – JP 2026-11-20 "make it swipable on phone"); mouse and pen: pointer events */
    var sw = null;
    function swStart(it, x, y, tgt) { if (!it || it.classList.contains('nt-need') || tgt.closest('[data-ntdel]')) return;   /* "Needs you" goes when it's dealt with, not by a swipe */ sw = { it: it, x: x, y: y, dx: 0, on: false }; }
    function swMove(x, y) {
      if (!sw) return false;
      var dx = x - sw.x, dy = y - sw.y;
      if (!sw.on) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { sw = null; return false; } if (Math.abs(dx) < 8) return false; sw.on = true; sw.it.classList.add('nt-drag'); var a = sw.it.querySelector('.nt-row'); if (a && a.hasAttribute('href')) { a.dataset.href = a.getAttribute('href'); a.removeAttribute('href'); } }
      sw.dx = dx; sw.it.style.transform = 'translateX(' + dx + 'px)'; sw.it.style.opacity = String(Math.max(.25, 1 - Math.abs(dx) / 260));
      return true;
    }
    function swEnd() {
      if (!sw) return; var s0 = sw; sw = null; if (!s0.on) return;
      s0.it.classList.remove('nt-drag'); ov._swiped = Date.now();
      /* the link has no address while swiping, so the tap the phone sends at the end can't open it; it gets it back after */
      setTimeout(function () { var a = s0.it.querySelector('.nt-row'); if (a && a.dataset.href) { a.setAttribute('href', a.dataset.href); delete a.dataset.href; } }, 450);
      if (Math.abs(s0.dx) > Math.min(100, s0.it.offsetWidth * .3)) {
        s0.it.style.transform = 'translateX(' + (s0.dx > 0 ? '' : '-') + '110%)'; s0.it.style.opacity = '0';
        setTimeout(function () { var b = s0.it.querySelector('[data-ntdel]'); if (b) b.click(); }, 180);
      } else { s0.it.style.transform = ''; s0.it.style.opacity = ''; }
    }
    ov.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) { sw = null; return; } var t = e.touches[0]; swStart(e.target.closest('.nt-item'), t.clientX, t.clientY, e.target); }, { passive: true });
    ov.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t && swMove(t.clientX, t.clientY) && e.cancelable) e.preventDefault(); }, { passive: false });
    /* a swipe isn't a tap: cancelling the touch's end stops the click that would open the row */
    ov.addEventListener('touchend', function (e) { if (sw && sw.on && e.cancelable) e.preventDefault(); swEnd(); }, { passive: false }); ov.addEventListener('touchcancel', swEnd);
    ov.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch' || e.button > 0) return; swStart(e.target.closest('.nt-item'), e.clientX, e.clientY, e.target); });
    ov.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch') swMove(e.clientX, e.clientY); });
    ov.addEventListener('pointerup', function (e) { if (e.pointerType !== 'touch') swEnd(); });
    ov.addEventListener('dragstart', function (e) { if (e.target.closest && e.target.closest('.nt-item')) e.preventDefault(); });
    ov.addEventListener('click', function (e) { if (ov._swiped && Date.now() - ov._swiped < 400 && e.target.closest('.nt-row')) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    document.addEventListener('keydown', key, true);
    document.body.appendChild(ov); document.documentElement.classList.add('fdz-modal');
    try { localStorage.setItem('dash.ntSeen', String(n)); } catch (e) {}
    badge();
    var f = ov.querySelector('[data-ntclose]'); if (f) f.focus();
  }
  function place() {
    if (!document.documentElement.classList.contains('unlocked') || !window.Notify) return;
    if (!btn) {
      btn = document.createElement('button'); btn.type = 'button'; btn.className = 'icon-btn nt-btn'; btn.id = 'ntBtn';
      btn.innerHTML = '<i class="bi bi-bell"></i><span class="nt-badge" hidden></span>';
      btn.addEventListener('click', open);
    }
    /* with the side bar the bell sits in the profile row at the top, so the page list keeps its room (sidenav-fit);
       otherwise with the other buttons in the top bar */
    var side = document.documentElement.classList.contains('side-nav'), me = document.querySelector('.mbar .mb-me');
    var host = side && me ? me : (document.querySelector('.mb-acts') || document.querySelector('.top-actions') || document.querySelector('#fp > .fp-top'));
    if (!host) return;
    if (btn.parentNode !== host) { if (host === me) host.appendChild(btn); else host.insertBefore(btn, host.querySelector('.sr-btn, [data-search]') || null); }
    badge();
  }
  if (window.Vault && Vault.onUnlock) Vault.onUnlock(place);
  window.addEventListener('tools:change', badge); window.addEventListener('need:change', badge);
  window.addEventListener('dash:local', function () { setTimeout(place, 50); });
  window.addEventListener('resize', function () { clearTimeout(place.t); place.t = setTimeout(place, 200); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') badge(); });
  setInterval(badge, 5 * 60e3);
  place(); setTimeout(place, 0);
  window.NotesPanel = { open: open, count: count };
})();
