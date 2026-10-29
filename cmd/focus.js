/* Focus timer: 25 minutes on one task, then a 5-minute break (Pomodoro).
   Start it from a task's menu (long-press or right-click), from Plan my day, from search/⌘K or with F.
   A small pill floats above the menu bar on every page and keeps counting when you change page,
   because the timer is a start time saved on this device (dash.focus), not a ticking script.
   Finished sessions are kept in dash.focusLog (this device only) so the pill can say how long
   you focused today. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var KEY = 'dash.focus', LOG = 'dash.focusLog', WORK = 25, REST = 5;
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function toast(h) { if (window.Quick && window.Quick.toast) window.Quick.toast(h); }

  /* state: { text, id, mode: 'work'|'rest', end (ms), paused (ms left) } */
  function st() { return readJSON(KEY, null); }
  function left(s) { return s.paused != null ? s.paused : Math.max(0, s.end - Date.now()); }
  function minsToday() { return (readJSON(LOG, []) || []).filter(function (x) { return x.d === today(); }).reduce(function (a, x) { return a + (x.m || 0); }, 0); }

  function start(text, id, mins) {
    writeJSON(KEY, { text: text || '', id: id || null, mode: 'work', mins: mins || WORK, end: Date.now() + (mins || WORK) * 60000 });
    if (window.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
    draw(); tick();
  }
  function stop(logIt) {
    var s = st(); if (!s) return;
    if (logIt && s.mode === 'work') { var done = Math.round(((s.mins || WORK) * 60000 - left(s)) / 60000); if (done >= 1) logMins(done, s.text); }
    writeJSON(KEY, null); draw();
  }
  function logMins(m, text) { var l = readJSON(LOG, []) || []; l.push({ d: today(), m: m, t: text || '' }); writeJSON(LOG, l.slice(-300)); }
  function pause() { var s = st(); if (!s) return; if (s.paused != null) { s.end = Date.now() + s.paused; delete s.paused; } else s.paused = left(s); writeJSON(KEY, s); draw(); }

  function ring(msg) {
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    try { if (window.Notification && Notification.permission === 'granted' && document.hidden) new Notification('Focus', { body: msg, icon: '/cmd/assets/icons/icon-192.png', tag: 'focus' }); } catch (e) {}
    toast('<i class="bi bi-stopwatch"></i> ' + esc(msg));
  }
  /* one step forward when a session runs out: work → break → done */
  function roll() {
    var s = st(); if (!s || s.paused != null || s.end > Date.now()) return;
    if (s.mode === 'work') {
      logMins(s.mins || WORK, s.text);
      writeJSON(KEY, { text: s.text, id: s.id, mode: 'rest', mins: REST, end: s.end + REST * 60000 });
      if (Date.now() < s.end + REST * 60000) ring('Well done – take a ' + REST + '-minute break.');
      roll();
    } else { writeJSON(KEY, null); if (Date.now() - s.end < 60000) ring('Break over – ready for the next one?'); }
  }

  /* ---------- the pill ---------- */
  var pill = document.createElement('div'); pill.className = 'fo-pill'; pill.hidden = true; pill.setAttribute('role', 'timer');
  document.body.appendChild(pill);
  function mmss(ms) { var t = Math.ceil(ms / 1000), m = Math.floor(t / 60), x = t % 60; return m + ':' + String(x).padStart(2, '0'); }
  function draw() {
    roll();
    var s = st(), unlocked = document.documentElement.classList.contains('unlocked');
    pill.hidden = !s || !unlocked;
    document.documentElement.classList.toggle('fo-on', !pill.hidden);
    if (!s) { pill.innerHTML = ''; return; }
    var ms = left(s), tot = (s.mins || (s.mode === 'rest' ? REST : WORK)) * 60000, pct = Math.max(0, Math.min(1, 1 - ms / tot));
    var label = s.mode === 'rest' ? 'Break' : (s.text || 'Focus');
    var html = '<span class="fo-ring" style="--p:' + pct.toFixed(3) + '"><i class="bi bi-' + (s.mode === 'rest' ? 'cup-hot' : 'stopwatch') + '"></i></span>' +
      '<span class="fo-x"><b class="fo-time">' + mmss(ms) + '</b><small>' + esc(label) + '</small></span>' +
      '<button type="button" class="icon-btn" data-fopause aria-label="' + (s.paused != null ? 'Resume' : 'Pause') + '"><i class="bi bi-' + (s.paused != null ? 'play-fill' : 'pause-fill') + '"></i></button>' +
      '<button type="button" class="icon-btn" data-fostop aria-label="Stop"><i class="bi bi-stop-fill"></i></button>';
    if (pill.dataset.k !== s.mode + (s.paused != null) + label) { pill.innerHTML = html; pill.dataset.k = s.mode + (s.paused != null) + label; pill.classList.toggle('rest', s.mode === 'rest'); pill.classList.toggle('paused', s.paused != null); }
    else { pill.querySelector('.fo-time').textContent = mmss(ms); pill.querySelector('.fo-ring').style.setProperty('--p', pct.toFixed(3)); }
    pill.setAttribute('aria-label', label + ' – ' + mmss(ms) + ' left');
  }
  var timer = null;
  function tick() { clearInterval(timer); if (st()) timer = setInterval(function () { draw(); if (!st()) clearInterval(timer); }, 1000); }
  pill.addEventListener('click', function (e) {
    if (e.target.closest('[data-fopause]')) return pause();
    if (e.target.closest('[data-fostop]')) { var s = st(); stop(true); var m = minsToday(); toast('<i class="bi bi-stopwatch"></i> Stopped' + (m ? ' · ' + m + ' min focused today' : '')); return; }
  });
  window.addEventListener('storage', function (e) { if (e.key === KEY) { draw(); tick(); } });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) draw(); });
  window.Vault.onUnlock(function () { draw(); tick(); });
  if (window.Vault.onLock) window.Vault.onLock(function () { pill.hidden = true; });

  /* ---------- choose what to focus on ---------- */
  function pick() {
    var s = st(); if (s) { pause(); return; }
    var td = today(), list = (readJSON('dash.todos', []) || []).filter(function (t) { return !t.done; });
    list.sort(function (a, b) { var ra = a.today === td ? (a.rank || 4) : 9, rb = b.today === td ? (b.rank || 4) : 9; return ra - rb; });
    var top = list.slice(0, 5);
    var bg = document.createElement('div'); bg.className = 'fo-bg';
    bg.innerHTML = '<div class="fo-box" role="dialog" aria-modal="true" aria-label="Start a focus timer"><h3><i class="bi bi-stopwatch"></i> Focus for ' + WORK + ' minutes</h3>' +
      '<p class="muted">Pick a task – or just start.</p>' +
      top.map(function (t) { return '<button type="button" class="fo-opt" data-fotask="' + esc(t.id) + '">' + (t.today === td && t.rank ? '<span class="td-rank">' + t.rank + '</span> ' : '') + esc(t.text) + '</button>'; }).join('') +
      '<button type="button" class="fo-opt" data-fotask=""><i class="bi bi-play-fill"></i> Just start</button>' +
      '<div class="fo-foot"><button type="button" class="text-btn" data-foclose>Cancel</button></div></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var first = bg.querySelector('.fo-opt'); if (first) first.focus();
    function close() { bg.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    bg.addEventListener('click', function (e) {
      if (e.target === bg || e.target.closest('[data-foclose]')) return close();
      var b = e.target.closest('[data-fotask]'); if (!b) return;
      var t = top.filter(function (x) { return x.id === b.dataset.fotask; })[0];
      close(); start(t ? t.text : '', t ? t.id : null);
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-focus]'); if (!b) return;
    e.preventDefault(); if (window.Plan && window.Plan.isOpen()) window.Plan.close();
    if (b.dataset.focus) start(b.dataset.focusText || '', b.dataset.focus); else pick();
  });
  window.Focus = { start: start, stop: stop, pause: pause, pick: pick, running: function () { return !!st(); }, minsToday: minsToday };
  draw(); tick();
})();
