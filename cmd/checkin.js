/* Weekly check-in: five minutes on Sunday (or Monday) that keep the dashboard right.
     1. Money – what the week cost, expenses to sort, when you last imported from the bank
     2. The week ahead – day by day, with tasks that are due
     3. Focus – pick up to three tasks for the week (they go to the top of To-do)
     4. Habits – how last week went
   "Done" is remembered in the vault, so it's done on every device.
   Offered in At a glance from Sunday noon and on Monday; open any time from search. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var Fe = window.Features, C = window.Cal;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function day0(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { var x = day0(d); x.setDate(x.getDate() + n); return x; }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  var CATS = [['groceries', 'Groceries'], ['eating', 'Eating out'], ['transport', 'Transport'], ['shopping', 'Shopping'], ['fun', 'Fun'], ['health', 'Health'], ['travel', 'Travel'], ['other', 'Other']];

  /* weekOf(day): the Monday–Sunday week that day is in */
  function weekOf(ref) {
    var mon = addDays(ref, -((ref.getDay() + 6) % 7));
    var sun = addDays(mon, 6), thu = addDays(mon, 3);
    var y = thu.getFullYear(), w = 1 + Math.round(((thu - new Date(y, 0, 4)) / 864e5 - 3 + (new Date(y, 0, 4).getDay() + 6) % 7) / 7);
    return { mon: mon, sun: sun, key: y + '-W' + pad(w), n: w };
  }
  function doneSet() { var d = window.Vault.get() || {}; return d.checkins || []; }
  function due(now) {
    now = now || new Date();
    var sunday = now.getDay() === 0 && now.getHours() >= 12, monday = now.getDay() === 1;
    if (!sunday && !monday) return null;
    var wk = weekOf(sunday ? now : addDays(now, -1));
    if (doneSet().indexOf(wk.key) > -1) return null;
    return { key: wk.key, sub: '5 minutes: spending, the week ahead, focus and habits' };
  }

  /* ---------- the sheet ---------- */
  var bg = document.createElement('div');
  bg.className = 'sr-bg rv-bg ci-bg'; bg.hidden = true;
  bg.innerHTML = '<div class="sr-box rv-box ci-box" role="dialog" aria-modal="true" aria-label="Weekly check-in"><div class="rv-top">' +
    '<b class="ci-title"><i class="bi bi-clipboard-check"></i> Weekly check-in</b><span class="spacer"></span><button type="button" class="text-btn" data-ciclose>Close</button></div>' +
    '<div class="rv-body" id="ciBody"></div></div>';
  document.body.appendChild(bg);
  var wk = null;

  function sum(l) { return l.reduce(function (a, e) { return a + (+e.amount || 0); }, 0); }
  function moneyHtml(d) {
    var from = dkey(wk.mon), to = dkey(wk.sun), ex = d.expenses || [];
    var week = ex.filter(function (e) { return e.date >= from && e.date <= to; });
    var prev = [1, 2, 3, 4].map(function (i) { var a = dkey(addDays(wk.mon, -7 * i)), b = dkey(addDays(wk.sun, -7 * i)); return sum(ex.filter(function (e) { return e.date >= a && e.date <= b; })); });
    var avg = prev.reduce(function (a, x) { return a + x; }, 0) / 4, spent = sum(week);
    var sortFrom = dkey(addDays(wk.sun, -20));
    var unsorted = ex.filter(function (e) { return e.cat === 'other' && e.date >= sortFrom; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 12);
    var lastImp = d.lastImport || (ex.filter(function (e) { return e.src === 'bank'; }).map(function (e) { return e.t ? dkey(new Date(e.t)) : e.date; }).sort().pop());
    var impDays = lastImp ? Math.round((day0(new Date()) - new Date(lastImp + 'T00:00')) / 864e5) : null;
    var pc = window.Budget && window.Budget.pace ? window.Budget.pace(d) : null;
    var by = {}; week.forEach(function (e) { by[e.cat] = (by[e.cat] || 0) + (+e.amount || 0); });
    var top = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; })[0];
    return '<section class="rv-sec"><h3><span class="ci-n">1</span> Money</h3>' +
      '<div class="rv-grid ci-grid"><div class="rv-big" style="--c:#11a597"><i class="bi bi-receipt"></i><b class="money">' + esc(kr(spent)) + '</b><span>spent this week</span>' +
        (avg > 0 ? '<small class="' + (spent > avg * 1.15 ? 'dn' : spent < avg * .85 ? 'up' : '') + '">' + (spent > avg ? kr(spent - avg) + ' more' : kr(avg - spent) + ' less') + ' than usual</small>' : '<small>' + week.length + ' expense' + (week.length === 1 ? '' : 's') + '</small>') + '</div>' +
        (top ? '<div class="rv-big" style="--c:#e8743b"><i class="bi bi-pie-chart"></i><b>' + esc((CATS.filter(function (c) { return c[0] === top; })[0] || ['', 'Other'])[1]) + '</b><span>most of it</span><small class="money">' + esc(kr(by[top])) + '</small></div>' : '') +
        (pc ? '<div class="rv-big" style="--c:' + (pc.ok ? '#22b35e' : '#e66767') + '"><i class="bi bi-speedometer2"></i><b class="money">' + esc(kr(Math.abs(pc.end))) + '</b><span>' + (pc.ok ? 'left' : 'over') + ' at ' + (pc.per.byPayday ? 'payday' : 'month end') + '</span><small>at this pace</small></div>' : '') +
      '</div>' +
      '<div class="ci-imp"><i class="bi bi-bank"></i><span>' + (impDays == null ? 'You haven’t imported from your bank yet.' : 'Last bank import ' + (impDays === 0 ? 'today' : impDays === 1 ? 'yesterday' : impDays + ' days ago') + '.') + '</span>' +
        (impDays == null || impDays >= 3 ? '<a class="pill-btn" href="finance/#import"><i class="bi bi-upload"></i> Import</a>' : '<i class="bi bi-check-circle-fill ci-ok"></i>') + '</div>' +
      (unsorted.length ? '<p class="muted ci-p">These are filed under Other – pick a category and the bank import remembers the shop next time.</p><ul class="ci-sort">' + unsorted.map(function (e) {
        return '<li><span class="ci-x"><b>' + esc(e.note || 'Expense') + '</b><small>' + esc(new Date(e.date + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })) + ' · <span class="money">' + esc(kr(e.amount)) + '</span></small></span>' +
          '<select data-ciexp="' + esc(e.id) + '" aria-label="Category for ' + esc(e.note || 'expense') + '">' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === e.cat ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></li>';
      }).join('') + '</ul>' : '') + '</section>';
  }
  function aheadHtml() {
    var start = new Date().getDay() === 0 ? addDays(new Date(), 1) : day0(new Date()), rows = '';
    var todos = readJSON('dash.todos', []).filter(function (t) { return !t.done && t.due; });
    for (var i = 0; i < 7; i++) {
      var dd = addDays(start, i), k = dkey(dd), evs = [];
      if (C && (!Fe || Fe.on('calendar'))) evs = C.occurrences(dd, addDays(dd, 1), { card: true }).filter(function (o) { return !o.ev.holiday && String(o.ev.id).indexOf('todo:') !== 0 && dkey(o.start) === k; });
      var hol = Fe && Fe.holiday(k), tds = todos.filter(function (t) { return t.due === k; });
      var bits = evs.slice(0, 3).map(function (o) { return (o.allDay ? '' : '<b>' + pad(o.start.getHours()) + ':' + pad(o.start.getMinutes()) + '</b> ') + esc(o.title); })
        .concat(tds.map(function (t) { return '<span class="ci-td"><i class="bi bi-check2-square"></i> ' + esc(t.text) + '</span>'; }));
      if (evs.length > 3) bits.push('+' + (evs.length - 3) + ' more');
      rows += '<li' + (bits.length ? '' : ' class="free"') + '><span class="ci-day">' + esc(dd.toLocaleDateString('en-GB', { weekday: 'short' })) + '<small>' + dd.getDate() + '</small></span>' +
        '<span class="ci-evs">' + (hol ? '<span class="ci-hol">' + esc(hol.name) + '</span> ' : '') + (bits.length ? bits.join(' · ') : '<span class="muted">Free</span>') + '</span></li>';
    }
    var overdue = readJSON('dash.todos', []).filter(function (t) { return !t.done && t.due && t.due < dkey(new Date()); });
    return '<section class="rv-sec"><h3><span class="ci-n">2</span> The week ahead</h3><ul class="ci-week">' + rows + '</ul>' +
      (overdue.length ? '<p class="ci-warn"><i class="bi bi-exclamation-circle"></i> ' + overdue.length + ' task' + (overdue.length === 1 ? ' is' : 's are') + ' overdue – give ' + (overdue.length === 1 ? 'it' : 'them') + ' a new day or tick ' + (overdue.length === 1 ? 'it' : 'them') + ' off below.</p>' : '') + '</section>';
  }
  function focusHtml() {
    var open = readJSON('dash.todos', []).filter(function (t) { return !t.done; }), n = open.filter(function (t) { return t.focus; }).length;
    return '<section class="rv-sec"><h3><span class="ci-n">3</span> Focus this week</h3>' +
      (open.length ? '<p class="muted ci-p">Star up to three – they go to the top of your To-do.</p><ul class="ci-focus">' + open.slice(0, 15).map(function (t) {
        var late = t.due && t.due < dkey(new Date());
        return '<li><button type="button" class="ci-star' + (t.focus ? ' on' : '') + '" data-cistar="' + esc(t.id) + '" aria-pressed="' + !!t.focus + '" aria-label="Focus on ' + esc(t.text) + '"' + (!t.focus && n >= 3 ? ' disabled' : '') + '><i class="bi bi-star' + (t.focus ? '-fill' : '') + '"></i></button>' +
          '<span class="ci-x"><b>' + esc(t.text) + '</b>' + (t.due ? '<small' + (late ? ' class="late"' : '') + '>' + (late ? 'Overdue · ' : 'Due ') + esc(new Date(t.due + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })) + '</small>' : '') + '</span>' +
          '<label class="ci-cal' + (t.due ? ' set' : '') + '" title="' + (t.due ? 'Change the day' : 'Give it a day') + '"><i class="bi bi-calendar' + (t.due ? '-check' : '-plus') + '"></i><input type="date" data-cidue="' + esc(t.id) + '" value="' + esc(t.due || '') + '" aria-label="Day for ' + esc(t.text) + '"></label>' +
          '<button type="button" class="ci-tick" data-citick="' + esc(t.id) + '" aria-label="Done: ' + esc(t.text) + '"><i class="bi bi-check-lg"></i></button></li>';
      }).join('') + '</ul>' : '<p class="muted ci-p">No open tasks. Add one with + or in the To-do card.</p>') + '</section>';
  }
  function habitsHtml() {
    var hb = readJSON('dash.habits', { list: [], log: {} });
    if (!hb.list || !hb.list.length || (Fe && !Fe.on('habits'))) return '';
    return '<section class="rv-sec"><h3><span class="ci-n">4</span> Habits last week</h3><ul class="ci-hab">' + hb.list.map(function (h) {
      var n = 0;
      for (var i = 0; i < 7; i++) if (((hb.log || {})[dkey(addDays(wk.mon, i))] || []).indexOf(h.id) > -1) n++;
      var ok = n >= h.target;
      return '<li class="' + (ok ? 'ok' : '') + '"><i class="bi bi-' + (ok ? 'check-circle-fill' : 'circle') + '"></i><span>' + esc(h.name) + '</span><b>' + n + ' / ' + h.target + '</b></li>';
    }).join('') + '</ul></section>';
  }
  function draw() {
    var d = window.Vault.get() || {};
    $('ciBody').innerHTML = '<p class="rv-kicker">Week ' + wk.n + ' · ' + esc(wk.mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + ' – ' + esc(wk.sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</p>' +
      '<h2>How was the week?</h2>' + ((!Fe || Fe.on('finance')) ? moneyHtml(d) : '') + aheadHtml() + focusHtml() + habitsHtml() +
      '<div class="qa-acts ci-foot"><span class="spacer"></span>' + (doneSet().indexOf(wk.key) > -1 ? '<span class="muted"><i class="bi bi-check2-circle"></i> Done for this week</span>' : '<button type="button" class="pill-btn wide" data-cidone><i class="bi bi-check2-circle"></i> Done for this week</button>') + '</div>';
  }
  function $(id) { return document.getElementById(id); }
  function open() {
    if (!window.Vault.get()) return;
    var now = new Date();
    /* Sunday: this week; any other day: the week that ended last Sunday */
    wk = weekOf(now.getDay() === 0 ? now : addDays(now, -((now.getDay() + 6) % 7) - 1));
    draw();
    bg.hidden = false; requestAnimationFrame(function () { bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
    $('ciBody').scrollTop = 0;
  }
  function close() { bg.classList.remove('open'); document.documentElement.classList.remove('cl-modal'); setTimeout(function () { bg.hidden = true; }, 180); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
  function todos(fn) { var l = readJSON('dash.todos', []); fn(l); writeJSON('dash.todos', l); }

  bg.addEventListener('click', function (e) {
    var b;
    if (e.target === bg || e.target.closest('[data-ciclose]')) return close();
    if ((b = e.target.closest('[data-cistar]'))) { todos(function (l) { l.forEach(function (t) { if (t.id === b.dataset.cistar) t.focus = !t.focus; }); }); draw(); return; }
    if ((b = e.target.closest('[data-citick]'))) {
      var li = b.closest('li'); li.classList.add('gone');
      setTimeout(function () { todos(function (l) { l.forEach(function (t) {
        if (t.id !== b.dataset.citick) return;
        if (t.repeat && window.Smart) { var nx = window.Smart.nextDue(t.due || dkey(new Date()), t.repeat, t.rday); while (nx && nx < dkey(new Date())) nx = window.Smart.nextDue(nx, t.repeat, t.rday); t.due = nx; }   // repeating: on to the next time
        else { t.done = true; t.focus = false; }
      }); }); draw(); }, 220); return;
    }
    if (e.target.closest('[data-cidone]')) {
      var d = window.Vault.get(); d.checkins = (d.checkins || []).concat(wk.key).slice(-30); window.Vault.save(d);
      window.dispatchEvent(new Event('checkin:done'));
      close();
      if (window.Quick) window.Quick.toast('<i class="bi bi-check2-circle"></i> Week ' + wk.n + ' checked – have a good week');
    }
  });
  /* the calendar button: open the date picker where the browser lets us */
  bg.addEventListener('click', function (e) { var i = e.target.closest('.ci-cal input'); if (i && i.showPicker) { try { i.showPicker(); } catch (x) {} } });
  bg.addEventListener('change', function (e) {
    var s = e.target.closest('[data-ciexp]');
    if (s) {
      var d = window.Vault.get(), S = window.Smart;
      (d.expenses || []).forEach(function (x) { if (x.id === s.dataset.ciexp) { x.cat = s.value; if (S && x.note) { d.catMemory = d.catMemory || {}; d.catMemory[S.norm(x.note)] = s.value; } } });
      window.Vault.save(d); window.dispatchEvent(new Event('fin:change'));
      var li = s.closest('li'); li.classList.add('ci-done');
      return;
    }
    var dd = e.target.closest('[data-cidue]');
    if (dd) { todos(function (l) { l.forEach(function (t) { if (t.id === dd.dataset.cidue) { if (dd.value) t.due = dd.value; else delete t.due; } }); }); draw(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bg.hidden) close(); });
  /* from search: …/#checkin */
  function fromHash() { if (location.hash === '#checkin') { history.replaceState(null, '', location.pathname + location.search); setTimeout(open, 300); } }
  window.Vault.onUnlock(fromHash);
  window.addEventListener('hashchange', fromHash);
  window.Vault.onLock(function () { if (!bg.hidden) close(); });
  window.Checkin = { open: open, due: due, weekOf: weekOf };
})();
