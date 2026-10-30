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

  /* which range each habit's calendar shows: picked on the card (this device), else Settings → Pages → Health */
  function rangeOf(id) {
    var r = null; try { r = (JSON.parse(localStorage.getItem('dash.hpRange')) || {})[id]; } catch (e) {}
    if (r === '26' || /^\d{4}$/.test(r || '')) return r;
    var c = window.Features ? (window.Features.tools().healthcfg || {}) : {};
    return c.heat === 'year' ? String(new Date().getFullYear()) : '26';
  }
  function setRange(id, v) {
    var o = {}; try { o = JSON.parse(localStorage.getItem('dash.hpRange')) || {}; } catch (e) {}
    o[id] = v; try { localStorage.setItem('dash.hpRange', JSON.stringify(o)); } catch (e) {}
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
      return '<div class="fp-tile" data-tk="' + t.l.replace(/\b(19|20)\d\d\b/g, 'Y') + '"><div class="lbl"><i class="bi bi-' + t.i + '"></i>' + t.l + '</div><div class="val">' + t.v + '</div><div class="sub">' + t.s + '</div></div>';
    }).join('');

    /* one card per habit */
    var ys = {}; ys[y] = 1; Object.keys(hb.log).forEach(function (k) { if (/^\d{4}-/.test(k)) ys[k.slice(0, 4)] = 1; });
    var yearList = Object.keys(ys).sort().reverse();
    $('hpHabits').innerHTML = list.map(function (h) {
      /* the calendar: the last 26 weeks, or a whole year (Settings → Pages → Health, or the picker on the card) */
      var rg = rangeOf(h.id), yr = rg === '26' ? null : rg, start, nW;
      if (yr) { var j1 = new Date(+yr, 0, 1), d31 = new Date(+yr, 11, 31); start = monday(j1); nW = Math.round((monday(d31) - start) / (7 * 864e5)) + 1; }
      else { start = addDays(thisMon, -7 * (WEEKS - 1)); nW = WEEKS; }
      var yearDone = 0;
      if (yr) Object.keys(hb.log).forEach(function (k) { if (k.slice(0, 4) === yr && hb.log[k].indexOf(h.id) > -1) yearDone++; });
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
      for (var c = 0; c < nW; c++) {
        var mon = addDays(start, 7 * c);
        /* a year: the month starts in the week that holds its 1st */
        var lblDay = yr ? (function () { for (var q = 0; q < 7; q++) { var z = addDays(mon, q); if (z.getDate() === 1 && String(z.getFullYear()) === yr) return z; } return c === 0 ? new Date(+yr, 0, 1) : null; })() : mon;
        var m = lblDay ? lblDay.getMonth() : lastMonth;
        var label = lblDay && m !== lastMonth ? F_MON.format(lblDay) : '';
        lastMonth = m;
        var cells = '';
        for (var r = 0; r < 7; r++) {
          var d = addDays(mon, r), k = dkey(d), on = done(h.id, k), out = yr && String(d.getFullYear()) !== yr;
          cells += '<button type="button" class="hp-cell' + (on ? ' on' : '') + (k === tk ? ' today' : '') + (k > tk ? ' future' : '') + (out ? ' out' : '') + '"' +
            ' data-h="' + h.id + '" data-d="' + k + '" aria-pressed="' + on + '"' + (k > tk || out ? ' disabled tabindex="-1"' : '') +
            ' aria-label="' + esc(h.name) + ', ' + F_LONG.format(d) + (on ? ', done' : '') + '"></button>';
        }
        weeks += '<div class="hp-week"><span class="hp-month">' + label + '</span>' + cells + '</div>';
      }
      /* the last two weeks as big tappable days – the easy way to fill in on a phone */
      var recent = '';
      [addDays(thisMon, -7), thisMon].forEach(function (wm, wi) {
        var cells = '';
        for (var r = 0; r < 7; r++) {
          var d = addDays(wm, r), k = dkey(d), on = done(h.id, k), fut = k > tk;
          cells += '<button type="button" class="hp-day' + (on ? ' on' : '') + (k === tk ? ' today' : '') + (fut ? ' future' : '') + '" data-h="' + h.id + '" data-d="' + k + '" aria-pressed="' + on + '"' + (fut ? ' disabled' : '') +
            ' aria-label="' + esc(h.name) + ', ' + F_LONG.format(d) + (on ? ', done' : '') + '"><small>' + 'MTWTFSS'[r] + '</small><b>' + d.getDate() + '</b><i class="bi bi-check-lg"></i></button>';
        }
        recent += '<div class="hp-recent-row"><span class="hp-recent-lbl">' + (wi ? 'This week' : 'Last week') + '<b>' + countWeek(h.id, wm) + '<small>/' + h.target + '</small></b></span><div class="hp-recent-days">' + cells + '</div></div>';
      });
      return '<section class="card hp-card"><div class="card-head"><h2><i class="bi bi-activity"></i> ' + esc(h.name) + '<small>' + h.target + '× per week</small></h2></div>' +
        '<div class="hp-stats">' + stats + '</div>' +
        '<div class="hp-recent">' + recent + '</div>' +
        '<div class="hp-heat"><div class="hp-heat-inner' + (yr ? ' year' : '') + '"><div class="hp-days"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span></div>' +
        '<div class="hp-weeks">' + weeks + '</div></div></div>' +
        '<div class="hp-sub"><label class="hp-range"><select data-hprange="' + h.id + '" aria-label="Show">' + '<option value="26"' + (!yr ? ' selected' : '') + '>Last 26 weeks</option>' +
          yearList.map(function (yy) { return '<option value="' + yy + '"' + (yr === yy ? ' selected' : '') + '>' + yy + '</option>'; }).join('') + '</select></label>' +
          (yr ? '<span class="hp-ytot">' + yearDone + ' day' + (yearDone === 1 ? '' : 's') + ' in ' + yr + '</span>' : '') + '<span class="key"><span><i class="sw" style="background:rgba(var(--ink-rgb),.08)"></i>Not done</span><span><i class="sw" style="background:var(--accent)"></i>Done</span></span></div>' +
        '</section>';
    }).join('');
  }

  /* Tap a day to fill in or undo */
  $('hpHabits').addEventListener('click', function (e) {
    var c = e.target.closest('.hp-cell, .hp-day');
    if (!c || c.disabled) return;
    var l = hb.log[c.dataset.d] || (hb.log[c.dataset.d] = []);
    var i = l.indexOf(c.dataset.h);
    if (i > -1) l.splice(i, 1); else l.push(c.dataset.h);
    if (!l.length) delete hb.log[c.dataset.d];
    save();
    render();
  });
  $('hpHabits').addEventListener('change', function (e) {
    var sel = e.target.closest('[data-hprange]'); if (!sel) return;
    setRange(sel.dataset.hprange, sel.value); render();
    var card = $('hpHabits').querySelector('[data-hprange="' + sel.dataset.hprange + '"]');
    var heat = card && card.closest('.hp-card').querySelector('.hp-heat');
    if (heat) heat.scrollLeft = sel.value === '26' || sel.value === String(new Date().getFullYear()) ? heat.scrollWidth : 0;
  });
  var lastHeat = null;
  window.addEventListener('tools:change', function () {
    var h = ((window.Features && window.Features.tools().healthcfg) || {}).heat || '26'; if (h === lastHeat) return; lastHeat = h;
    if (hb && window.Vault.get()) { render(); scrollToEnd(); }
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
