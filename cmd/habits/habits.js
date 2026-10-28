/* Habits page: streaks, consistency and a 26-week calendar per habit.
   Reads the same synced, encrypted data as the dashboard's "This week" card. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var WEEKS = 26;
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }

  var hb = null;
  function load() {
    try { hb = JSON.parse(localStorage.getItem('dash.habits')) || null; } catch (e) { hb = null; }
    hb = hb || { list: [], log: {} };
    hb.log = hb.log || {};
  }
  function save() {
    try { localStorage.setItem('dash.habits', JSON.stringify(hb)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));   // lock.js puts it in the encrypted, synced vault
  }
  function done(id, k) { return (hb.log[k] || []).indexOf(id) > -1; }
  function countWeek(id, mon) {
    var n = 0;
    for (var i = 0; i < 7; i++) if (done(id, dkey(addDays(mon, i)))) n++;
    return n;
  }

  /* Weeks in a row where the target was met. This week counts once it's met. */
  function streaks(h) {
    var thisMon = monday(new Date());
    var cur = 0, best = 0, run = 0;
    var first = Object.keys(hb.log).sort()[0];
    var start = first ? monday(new Date(first + 'T12:00')) : thisMon;
    for (var m = new Date(start); m <= thisMon; m = addDays(m, 7)) {
      var met = countWeek(h.id, m) >= h.target;
      if (met) { run++; best = Math.max(best, run); }
      else if (m < thisMon) run = 0;
    }
    cur = run;
    return { cur: cur, best: best };
  }

  /* ---------- tooltip ---------- */
  var tip = $('fpTip');
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(Math.max(8, x + 14), innerWidth - w - 8) + 'px';
    tip.style.top = (y - h - 12 < 8 ? y + 16 : y - h - 12) + 'px';
  }
  function hideTip() { tip.hidden = true; }

  /* date formatting is slow when done hundreds of times – make the formatters once */
  var F_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  var F_MON = new Intl.DateTimeFormat('en-GB', { month: 'short' });
  function render() {
    var list = hb.list || [];
    var stCache = {};
    var streaksOf = function (h) { return stCache[h.id] || (stCache[h.id] = streaks(h)); };
    $('hpEmpty').hidden = list.length > 0;
    var today = new Date(), tk = dkey(today), thisMon = monday(today);

    /* key numbers across all habits */
    var weekDone = 0, weekTarget = 0, yearTotal = 0, last30 = 0, y = String(today.getFullYear());
    list.forEach(function (h) { weekDone += Math.min(countWeek(h.id, thisMon), h.target); weekTarget += h.target; });
    Object.keys(hb.log).forEach(function (k) {
      var n = hb.log[k].filter(function (id) { return list.some(function (h) { return h.id === id; }); }).length;
      if (k.slice(0, 4) === y) yearTotal += n;
      if (k > dkey(addDays(today, -30))) last30 += n;
    });
    var bestCur = list.reduce(function (a, h) { var s = streaksOf(h); return s.cur > a.v ? { v: s.cur, n: h.name } : a; }, { v: 0, n: '' });
    var T = [
      { i: 'calendar-week', l: 'This week', v: weekTarget ? weekDone + '<small>/ ' + weekTarget + '</small>' : '–', s: weekTarget ? (weekDone >= weekTarget ? 'All targets hit 🎉' : weekDone ? Math.round(weekDone / weekTarget * 100) + ' % of this week’s targets so far' : 'of this week’s targets so far') : 'Add a habit on the dashboard' },
      { i: 'fire', l: 'Longest current streak', v: bestCur.v + '<small>week' + (bestCur.v === 1 ? '' : 's') + '</small>', s: bestCur.v ? esc(bestCur.n) : 'Hit a weekly target to start one' },
      { i: 'clock-history', l: 'Last 30 days', v: String(last30), s: 'times in total' },
      { i: 'trophy', l: 'This year', v: String(yearTotal), s: 'times in ' + y }
    ];
    $('hpTiles').innerHTML = T.map(function (t) {
      return '<div class="fp-tile"><div class="lbl"><i class="bi bi-' + t.i + '"></i>' + t.l + '</div><div class="val">' + t.v + '</div><div class="sub">' + t.s + '</div></div>';
    }).join('');

    /* one card per habit */
    var start = addDays(thisMon, -7 * (WEEKS - 1));
    $('hpHabits').innerHTML = list.map(function (h) {
      var st = streaksOf(h);
      var wk = countWeek(h.id, thisMon);
      var met12 = 0;
      for (var w = 1; w <= 12; w++) if (countWeek(h.id, addDays(thisMon, -7 * w)) >= h.target) met12++;
      var stats = [
        ['This week', wk + '<small>/ ' + h.target + '</small>'],
        ['Current streak', st.cur + '<small>week' + (st.cur === 1 ? '' : 's') + '</small>'],
        ['Best streak', st.best + '<small>week' + (st.best === 1 ? '' : 's') + '</small>'],
        ['Last 12 weeks', Math.round(met12 / 12 * 100) + '<small>% on target</small>']
      ].map(function (s) { return '<div class="hp-stat"><div class="k">' + s[0] + '</div><div class="v">' + s[1] + '</div></div>'; }).join('');

      var weeks = '', lastMonth = -1;
      for (var c = 0; c < WEEKS; c++) {
        var mon = addDays(start, 7 * c);
        var m = mon.getMonth();
        var label = m !== lastMonth ? F_MON.format(mon) : '';
        lastMonth = m;
        var cells = '';
        for (var r = 0; r < 7; r++) {
          var d = addDays(mon, r), k = dkey(d), on = done(h.id, k);
          cells += '<button type="button" class="hp-cell' + (on ? ' on' : '') + (k === tk ? ' today' : '') + (k > tk ? ' future' : '') + '"' +
            ' data-h="' + h.id + '" data-d="' + k + '" aria-pressed="' + on + '"' + (k > tk ? ' disabled tabindex="-1"' : '') +
            ' aria-label="' + esc(h.name) + ', ' + F_LONG.format(d) + (on ? ', done' : '') + '"></button>';
        }
        weeks += '<div class="hp-week"><span class="hp-month">' + label + '</span>' + cells + '</div>';
      }
      return '<section class="card hp-card"><div class="card-head"><h2><i class="bi bi-activity"></i> ' + esc(h.name) + '<small>' + h.target + '× per week</small></h2></div>' +
        '<div class="hp-stats">' + stats + '</div>' +
        '<div class="hp-heat"><div class="hp-heat-inner"><div class="hp-days"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span></div>' +
        '<div class="hp-weeks">' + weeks + '</div></div></div>' +
        '<div class="hp-sub"><span>Last 26 weeks</span><span class="key"><span><i class="sw" style="background:rgba(var(--ink-rgb),.08)"></i>Not done</span><span><i class="sw" style="background:var(--accent)"></i>Done</span></span></div>' +
        '</section>';
    }).join('');
  }

  /* Tap a day to fill in or undo */
  $('hpHabits').addEventListener('click', function (e) {
    var c = e.target.closest('.hp-cell');
    if (!c || c.disabled) return;
    var l = hb.log[c.dataset.d] || (hb.log[c.dataset.d] = []);
    var i = l.indexOf(c.dataset.h);
    if (i > -1) l.splice(i, 1); else l.push(c.dataset.h);
    if (!l.length) delete hb.log[c.dataset.d];
    save();
    render();
  });
  $('hpHabits').addEventListener('pointerover', function (e) {
    var c = e.target.closest('.hp-cell');
    if (!c) return;
    var d = new Date(c.dataset.d + 'T12:00');
    showTip('<b>' + d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '</b><div>' + (c.classList.contains('on') ? 'Done ✓' : 'Not done') + '</div>',
      e.clientX, e.clientY);
  });
  $('hpHabits').addEventListener('pointerout', function (e) { if (e.target.closest('.hp-cell')) hideTip(); });

  /* Show the newest weeks first on narrow screens */
  function scrollToEnd() { document.querySelectorAll('.hp-heat').forEach(function (h) { h.scrollLeft = h.scrollWidth; }); }

  var prevReload = window.Dash && window.Dash.reload;      // newer data from another device (other parts hook in too)
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); load(); render(); scrollToEnd(); };
  window.Vault.onUnlock(function () { load(); render(); requestAnimationFrame(scrollToEnd); });
  window.Vault.onLock(function () { $('hpTiles').innerHTML = ''; $('hpHabits').innerHTML = ''; hideTip(); });
})();
