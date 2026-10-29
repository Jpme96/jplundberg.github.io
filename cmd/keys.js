/* Keyboard shortcuts on a computer. Press ? to see them all.
     ⌘K or /   search and commands        1–6   go to a page (in menu order)
     N         new task                    P     plan my day
     A         quick add                   F     focus timer (start / pause)
     ,         settings                    D     dark / light
     L         lock                        ?     this list
   Single keys only work when you are not typing in a field and no window is open.
   The calendar keeps its own keys (← → T N). */
(function () {
  "use strict";
  if (!window.Vault) return;
  var page = (location.pathname.match(/\/cmd\/([a-z]+)\//) || [])[1] || 'home';
  var home = '/cmd/';
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }

  function pages() {
    var nav = document.querySelector('nav'); if (!nav) return [];
    return Array.prototype.filter.call(nav.querySelectorAll('a[data-pg]'), function (a) { return a.offsetWidth || a.offsetHeight; })
      .sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); });
  }
  function plan() { if (window.Plan) window.Plan.open(); else location.href = home + '#plan'; }
  function newTask() {
    var i = document.getElementById('todoInput');
    if (i && i.offsetParent) { i.scrollIntoView({ block: 'center', behavior: 'smooth' }); i.focus({ preventScroll: true }); }
    else if (window.Quick) window.Quick.open('todo');
  }
  function settings() { var b = document.getElementById('settingsBtn'); if (b) b.click(); else location.href = home + '?settings'; }
  function theme() {
    var s = readJSON('dash.settings', {}) || {}, cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var b = document.querySelector('[data-theme-opt="' + (cur === 'light' ? 'dark' : 'light') + '"]');
    if (b) { b.click(); return; }
    s.theme = cur === 'light' ? 'dark' : 'light'; writeJSON('dash.settings', s); document.documentElement.setAttribute('data-theme', s.theme);
  }
  var ACT = { n: newTask, p: plan, a: function () { if (window.Quick) window.Quick.open(); }, f: function () { if (window.Focus) window.Focus.pick(); },
    ',': settings, d: theme, l: function () { window.Vault.lock(); }, '?': help };

  /* is a window open on top of the page? then single keys are left alone */
  function busy() {
    var r = document.documentElement;
    if (r.classList.contains('cl-modal')) return true;
    if (document.querySelector('.qa-bg:not([hidden]), .fo-bg, .kb-bg, .td-menu')) return true;
    if (document.body.classList.contains('st-open') || (window.Plan && window.Plan.isOpen())) return true;
    return false;
  }
  document.addEventListener('keydown', function (e) {
    if (!document.documentElement.classList.contains('unlocked')) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    var t = e.target; if (/INPUT|TEXTAREA|SELECT/.test(t.tagName || '') || t.isContentEditable) return;
    if (busy()) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (page === 'calendar' && (k === 'n' || k === 't')) return;            // the calendar's own keys
    if (/^[1-9]$/.test(k)) { var l = pages()[+k - 1]; if (l) { e.preventDefault(); l.click(); } return; }
    if (ACT[k]) { e.preventDefault(); ACT[k](); }
  });

  /* ---------- the list (?) ---------- */
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  function help() {
    if (document.querySelector('.kb-bg')) return;
    var names = pages().map(function (a, i) { return [String(i + 1), (a.textContent || '').trim()]; });
    var rows = [[(mac ? '⌘' : 'Ctrl') + ' K', 'Search and commands'], ['/', 'Search'], ['N', 'New task'], ['A', 'Quick add – expense, event, note …'], ['P', 'Plan my day'], ['F', 'Focus timer – start or pause'], [',', 'Settings'], ['D', 'Dark or light'], ['L', 'Lock'], ['?', 'Keyboard shortcuts']];
    var cal = [['← →', 'Previous / next'], ['T', 'Today'], ['N', 'New event']];
    var kb = function (r) { return '<div class="kb-row"><span>' + r[1] + '</span><span>' + r[0].split(' ').map(function (x) { return '<kbd>' + x + '</kbd>'; }).join('') + '</span></div>'; };
    var bg = document.createElement('div'); bg.className = 'kb-bg';
    bg.innerHTML = '<div class="kb-box" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><div class="kb-head"><h3><i class="bi bi-keyboard"></i> Keyboard shortcuts</h3><button type="button" class="icon-btn" data-kbclose aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' +
      '<div class="kb-cols"><div><p class="st-sub">Everywhere</p>' + rows.map(kb).join('') + '</div><div><p class="st-sub">Go to</p>' + names.map(function (n) { return kb([n[0], n[1]]); }).join('') +
      '<p class="st-sub">Calendar</p>' + cal.map(kb).join('') + '<p class="st-sub">To-do</p>' + kb(['Right-click', 'Task menu – top 3, move, focus']) + '</div></div></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var x = bg.querySelector('[data-kbclose]'); x.focus();
    function close() { bg.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-kbclose]')) close(); });
  }
  window.Keys = { help: help, plan: plan, newTask: newTask, theme: theme, settings: settings, pages: pages };
})();
