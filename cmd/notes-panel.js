/* The notification panel (2026-11-20, JP): a bell in the top bar with a count of what you've been told since you last
   looked; a tap opens a popup with "Earlier" (the last three days) and "Coming up" (the next 24 hours) – the same
   reminders the phone gets (Notify.recent), worked out on this device from your data, nothing stored in plain text.
   A row opens where the reminder points. Seen = localStorage dash.ntSeen (a time). */
(function () {
  'use strict';
  var K = function (n, e, o) { return window.I18N && I18N.k ? I18N.k(n, e, o) : e; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function seen() { return +localStorage.getItem('dash.ntSeen') || 0; }
  function items() { try { return window.Notify && Notify.recent ? Notify.recent(72, 24) : []; } catch (e) { return []; } }
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
  function count() { var s = seen(), n = Date.now(); return items().filter(function (x) { return x.at <= n && x.at > s; }).length; }
  function badge() {
    if (!btn) return; var c = count(), b = btn.querySelector('.nt-badge');
    b.textContent = c > 9 ? '9+' : c; b.hidden = !c;
    btn.setAttribute('aria-label', c ? K('ui.nt-label-n', 'Notifications, {n} new', { n: c }) : K('ui.nt-label', 'Notifications'));
  }
  function row(x, isNew) {
    return '<a class="nt-row' + (isNew ? ' nt-new' : '') + '" href="' + esc(x.url || '/cmd/') + '"><span class="nt-ic"><i class="bi bi-' + icon(x.id) + '"></i></span><span class="nt-tx"><b>' + esc(x.title) + '</b>' + (x.body ? '<small>' + esc(x.body) + '</small>' : '') + '</span><time>' + esc(when(x.at)) + '</time></a>';
  }
  function open() {
    /* the popup's look lives in filedrop.js and is only added on first use – add it here too (JP 2026-11-20: it opened unstyled at the bottom of Finances) */
    if (window.FileDrop && FileDrop.style) FileDrop.style();
    var n = Date.now(), s = seen(), l = items();
    var past = l.filter(function (x) { return x.at <= n; }).reverse(), next = l.filter(function (x) { return x.at > n; });
    var ov = document.createElement('div'); ov.className = 'fdz-ov nt-ov';
    ov.innerHTML = '<div class="fdz-sh nt-sh" role="dialog" aria-modal="true" aria-label="' + esc(K('ui.nt-label', 'Notifications')) + '"><div class="fdz-hd"><b><i class="bi bi-bell"></i> ' + esc(K('ui.nt-label', 'Notifications')) + '</b><button type="button" class="icon-btn sm" data-ntclose aria-label="' + esc(K('ui.close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div>' +
      (past.length || next.length ? '' : '<p class="nt-empty">' + esc(K('ui.nt-empty', 'Nothing in the last three days or the next 24 hours.')) + '</p>') +
      (next.length ? '<p class="nt-h">' + esc(K('ui.nt-next', 'Coming up')) + '</p>' + next.map(function (x) { return row(x, false); }).join('') : '') +
      (past.length ? '<p class="nt-h">' + esc(K('ui.nt-past', 'Earlier')) + '</p>' + past.map(function (x) { return row(x, x.at > s); }).join('') : '') +
      '<p class="nt-foot"><a href="#" data-ntset>' + esc(K('ui.nt-settings', 'Which notifications you get')) + ' <i class="bi bi-chevron-right"></i></a></p></div>';
    var close = function () { ov.remove(); document.removeEventListener('keydown', key, true); if (!document.querySelector('.fdz-ov')) document.documentElement.classList.remove('fdz-modal'); };
    var key = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-ntclose]')) { close(); return; }
      if (e.target.closest('[data-ntset]')) { e.preventDefault(); close(); var sb = document.getElementById('settingsBtn'); if (sb) { sb.click(); setTimeout(function () { var g = document.querySelector('[data-go="notify"]'); if (g) g.click(); }, 80); } return; }
      if (e.target.closest('.nt-row')) close();
    });
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
  window.addEventListener('tools:change', badge);
  window.addEventListener('dash:local', function () { setTimeout(place, 50); });
  window.addEventListener('resize', function () { clearTimeout(place.t); place.t = setTimeout(place, 200); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') badge(); });
  setInterval(badge, 5 * 60e3);
  place(); setTimeout(place, 0);
  window.NotesPanel = { open: open, count: count };
})();
