/* Plan my day: one place in the morning for what today holds – and what you'll get done.

   - Top 3: pick up to three tasks for today (they get 1 2 3 in To-do and lead At a glance)
   - Your day: today's events with the free time between them; put a task in a free slot
     (tap the task's clock, then a slot – or drag it there on a computer) and it becomes a
     calendar block. "Fill my day" puts all three in the first free slots.
   - Habits still open today, ticked with one tap.
   Open it from At a glance (Plan day), the morning tip, P on a keyboard, ⌘K, or …/#plan.
   Everything is stored in your to-dos and calendar, so it syncs like the rest. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var $ = function (id) { return document.getElementById(id); };
  var C = window.Cal;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function mins(d) { return d.getHours() * 60 + d.getMinutes(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var DAY_END = 22 * 60, armed = null, open_ = false;

  /* ---------- data ---------- */
  function todos() { return readJSON('dash.todos', []); }
  function saveTodos(l) { writeJSON('dash.todos', l); window.dispatchEvent(new Event('todos:change')); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
  function top3(list) { var t = dkey(new Date()); return (list || todos()).filter(function (x) { return x.today === t && !x.done; }).sort(function (a, b) { return (a.rank || 9) - (b.rank || 9); }); }
  function topDone() { var t = dkey(new Date()); return todos().filter(function (x) { return x.today === t && x.done; }); }
  function candidates() {
    var t = dkey(new Date()), big = '9999';
    return todos().filter(function (x) { return !x.done && x.today !== t; }).sort(function (a, b) {
      var da = a.due || big, db = b.due || big;
      if (!!a.focus !== !!b.focus && (da > t && db > t)) return a.focus ? -1 : 1;
      return da < db ? -1 : da > db ? 1 : 0;
    });
  }
  function events() {
    if (!C) return [];
    var t0 = new Date(); t0.setHours(0, 0, 0, 0); var t1 = new Date(t0.getTime() + 864e5);
    return C.occurrences(t0, t1).filter(function (o) { return o.start < t1 && o.end > t0; });
  }
  /* free time between now (or the start of the day) and 22:00, at least 15 minutes */
  function gaps(evs) {
    var p = C ? C.prefs() : { dayStart: 7 }, now = new Date(), from = Math.max((p.dayStart || 7) * 60, Math.ceil(mins(now) / 15) * 15);
    var busy = evs.filter(function (o) { return !o.allDay; }).map(function (o) { return [mins(o.start), o.end.getDate() !== o.start.getDate() ? 24 * 60 : mins(o.end)]; }).sort(function (a, b) { return a[0] - b[0]; });
    var out = [], at = from;
    busy.forEach(function (b) { if (b[0] - at >= 15) out.push([at, Math.min(b[0], DAY_END)]); at = Math.max(at, b[1]); });
    if (DAY_END - at >= 15) out.push([at, DAY_END]);
    return out.filter(function (g) { return g[1] - g[0] >= 15; });
  }
  function habits() {
    var hb = readJSON('dash.habits', { list: [], log: {} }), t = dkey(new Date()), done = (hb.log && hb.log[t]) || [];
    return (hb.list || []).map(function (h) { return { id: h.id, name: h.name, done: done.indexOf(h.id) > -1 }; });
  }
  function block(t) { if (!t.block || !C) return null; var d = C.load(); return d.events.filter(function (e) { return e.id === t.block && e.date === dkey(new Date()); })[0] || null; }

  /* ---------- actions ---------- */
  function setTop(id, on) {
    var l = todos(), t = dkey(new Date()), cur = top3(l);
    l.forEach(function (x) {
      if (x.id !== id) return;
      if (on) { if (cur.length >= 3) return; x.today = t; x.rank = cur.length + 1; }
      else { delete x.today; delete x.rank; }
    });
    top3(l).forEach(function (x, i) { x.rank = i + 1; });
    saveTodos(l); draw();
  }
  function addTask(text) {
    var p = window.Smart ? window.Smart.todo(text) : { text: text }, l = todos(), cur = top3(l);
    var item = { id: uid(), text: p.text || text, done: false };
    if (p.due) item.due = p.due;
    if (cur.length < 3) { item.today = dkey(new Date()); item.rank = cur.length + 1; }
    l.push(item); saveTodos(l); draw();
  }
  function schedule(id, start, len) {
    if (!C) return;
    var l = todos(), t = l.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    var d = C.load(), old = t.block && d.events.findIndex(function (e) { return e.id === t.block; });
    if (old > -1) d.events.splice(old, 1);
    var ev = { id: C.uid(), title: t.text.slice(0, 120), cat: guessCat(t.text), date: dkey(new Date()), allDay: false, start: hm(start), stop: hm(Math.min(start + len, 24 * 60 - 1)), todo: t.id };
    d.events.push(ev); if (d.hidden[ev.cat]) delete d.hidden[ev.cat];
    t.block = ev.id; if (!t.due) t.due = ev.date;
    C.save(d); saveTodos(l); armed = null; draw();
    if (window.Quick) window.Quick.toast('<i class="bi bi-calendar-check"></i> ' + esc(t.text) + ' · ' + hm(start) + '–' + hm(start + len), function () {
      var d2 = C.load(); d2.events = d2.events.filter(function (e) { return e.id !== ev.id; }); C.save(d2);
      var l2 = todos(); l2.forEach(function (x) { if (x.id === id) delete x.block; }); saveTodos(l2); draw();
    });
  }
  function unschedule(id) {
    var l = todos(), t = l.filter(function (x) { return x.id === id; })[0]; if (!t || !C) return;
    var d = C.load(); d.events = d.events.filter(function (e) { return e.id !== t.block; }); delete t.block; C.save(d); saveTodos(l); draw();
  }
  function guessCat(text) { var w = /\b(møte|meeting|rapport|report|kunde|client|fdv|dokument|e-?post|email|jobb|work|prosjekt|project)\b/i; return w.test(text) && C.CATS.work ? 'work' : (C.CATS.personal ? 'personal' : C.CAT_ORDER[0]); }
  function fillDay() {
    var free = gaps(events()).map(function (g) { return g.slice(); });
    top3().filter(function (t) { return !block(t); }).forEach(function (t) {
      for (var i = 0; i < free.length; i++) { var g = free[i], len = Math.min(60, g[1] - g[0]); if (len >= 30) { schedule(t.id, g[0], len); g[0] += len + 15; return; } }
    });
  }
  function tickHabit(id) {
    var hb = readJSON('dash.habits', { list: [], log: {} }), t = dkey(new Date()); hb.log = hb.log || {};
    var l = hb.log[t] = hb.log[t] || [], i = l.indexOf(id); if (i > -1) l.splice(i, 1); else l.push(id);
    writeJSON('dash.habits', hb); window.dispatchEvent(new Event('habits:change')); if (window.Dash && window.Dash.reload) window.Dash.reload(); draw();
  }

  /* ---------- the sheet ---------- */
  var bg = document.createElement('div'); bg.className = 'qa-bg pl-bg'; bg.id = 'planSheet'; bg.hidden = true;
  bg.innerHTML = '<div class="qa-box pl-box" role="dialog" aria-modal="true" aria-labelledby="plTitle"><div class="qa-handle"></div><div id="plBody"></div></div>';
  document.body.appendChild(bg);
  function draw() {
    if (!open_) return;
    var now = new Date(), tops = top3(), evs = events(), free = gaps(evs), hs = habits(), cands = candidates(), doneTop = topDone();
    var allDay = evs.filter(function (o) { return o.allDay; }), timed = evs.filter(function (o) { return !o.allDay; });
    var h = '<div class="pl-head"><div><p class="pl-date">' + esc(now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })) + '</p><h2 id="plTitle">Plan your day</h2></div>' +
      '<button type="button" class="icon-btn" data-plclose aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' +
      '<p class="pl-sum">' + [timed.length + ' event' + (timed.length === 1 ? '' : 's'), cands.filter(function (t) { return t.due && t.due <= dkey(now); }).length + ' task' + (cands.filter(function (t) { return t.due && t.due <= dkey(now); }).length === 1 ? '' : 's') + ' due', hs.filter(function (x) { return !x.done; }).length + ' habit' + (hs.filter(function (x) { return !x.done; }).length === 1 ? '' : 's') + ' left'].map(esc).join(' · ') + '</p>';
    /* top 3 */
    h += '<section class="pl-sec"><h3><i class="bi bi-trophy"></i> Top 3 today</h3><ol class="pl-top">';
    for (var i = 0; i < 3; i++) {
      var t = tops[i];
      if (!t) { h += '<li class="pl-slot empty"><span class="pl-n">' + (i + 1) + '</span><span class="muted">' + (i === tops.length ? 'Pick a task below, or type a new one' : '') + '</span></li>'; continue; }
      var b = block(t);
      h += '<li class="pl-slot' + (armed === t.id ? ' armed' : '') + '" draggable="true" data-pltask="' + esc(t.id) + '"><span class="pl-n">' + (i + 1) + '</span><span class="pl-t">' + esc(t.text) + '</span>' +
        (b ? '<button type="button" class="pl-time on" data-plunsched="' + esc(t.id) + '" title="Take it out of the calendar"><i class="bi bi-calendar-check"></i> ' + esc(b.start) + '</button>'
           : '<button type="button" class="pl-time" data-plarm="' + esc(t.id) + '" aria-pressed="' + (armed === t.id) + '"><i class="bi bi-clock"></i> ' + (armed === t.id ? 'Pick a slot' : 'Schedule') + '</button>') +
        (window.Focus ? '<button type="button" class="icon-btn sm" data-focus="' + esc(t.id) + '" data-focus-text="' + esc(t.text) + '" aria-label="Focus timer – 25 min" title="Focus timer – 25 min"><i class="bi bi-stopwatch"></i></button>' : '') +
        '<button type="button" class="icon-btn sm" data-pltop="' + esc(t.id) + '" data-on="0" aria-label="Remove from top 3"><i class="bi bi-x"></i></button></li>';
    }
    h += '</ol>' + (doneTop.length ? '<p class="pl-done"><i class="bi bi-check2-circle"></i> Done today: ' + doneTop.map(function (x) { return esc(x.text); }).join(' · ') + '</p>' : '') + '</section>';
    /* tasks to pick from */
    h += '<section class="pl-sec"><h3><i class="bi bi-list-check"></i> Tasks</h3><form class="pl-add" id="plAdd"><input id="plNew" placeholder="New task – it goes straight into your top 3" autocomplete="off" enterkeyhint="done"><button class="pill-btn" type="submit" aria-label="Add task"><i class="bi bi-plus-lg"></i></button></form>' +
      (cands.length ? '<ul class="pl-cands">' + cands.slice(0, 8).map(function (t) {
        var late = t.due && t.due < dkey(now), due = t.due === dkey(now);
        return '<li><button type="button" data-pltop="' + esc(t.id) + '" data-on="1"' + (tops.length >= 3 ? ' disabled' : '') + '><i class="bi bi-plus-circle"></i><span>' + esc(t.text) + '</span>' +
          (late ? '<em class="late">overdue</em>' : due ? '<em class="due">today</em>' : t.focus ? '<em><i class="bi bi-star-fill"></i></em>' : t.due ? '<em>' + esc(new Date(t.due + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</em>' : '') + '</button></li>';
      }).join('') + '</ul>' + (cands.length > 8 ? '<p class="muted pl-more">' + (cands.length - 8) + ' more in To-do</p>' : '') : '<p class="muted">No other open tasks.</p>') + '</section>';
    /* the day */
    h += '<section class="pl-sec"><h3><i class="bi bi-calendar-day"></i> Your day' + (tops.some(function (t) { return !block(t); }) && free.length ? '<button type="button" class="text-btn pl-fill" data-plfill><i class="bi bi-magic"></i> Fill my day</button>' : '') + '</h3>' +
      (allDay.length ? '<p class="pl-allday">' + allDay.map(function (o) { return '<span style="--c:' + (o.color || 'var(--accent)') + '">' + esc(o.title) + '</span>'; }).join('') + '</p>' : '');
    var rows = timed.map(function (o) { return { s: mins(o.start), e: o.end.getDate() !== o.start.getDate() ? 24 * 60 : mins(o.end), ev: o }; })
      .concat(free.map(function (g) { return { s: g[0], e: g[1], free: true }; })).sort(function (a, b) { return a.s - b.s; });
    h += (rows.length ? '<ul class="pl-day' + (armed ? ' arming' : '') + '">' + rows.map(function (r) {
      if (r.free) return '<li class="pl-free" data-plslot="' + r.s + '" data-end="' + r.e + '"><span class="pl-hm">' + hm(r.s) + '</span><button type="button" class="pl-gap" data-plslot="' + r.s + '" data-end="' + r.e + '">' +
        (armed ? '<i class="bi bi-plus-lg"></i> Put it here' : 'Free') + ' <small>' + hm(r.s) + '–' + hm(r.e) + ' · ' + fmtLen(r.e - r.s) + '</small></button></li>';
      var mine = r.ev.ev && r.ev.ev.own && r.ev.ev.own.todo;
      return '<li class="pl-ev' + (mine ? ' mine' : '') + (r.e <= mins(now) ? ' past' : '') + '" style="--c:' + (r.ev.color || 'var(--accent)') + '"><span class="pl-hm">' + hm(r.s) + '</span><span class="pl-evb">' + (mine ? '<i class="bi bi-check2-square"></i> ' : '') + esc(r.ev.title) + ' <small>' + hm(r.s) + '–' + hm(r.e) + '</small></span></li>';
    }).join('') + '</ul>' : '<p class="muted">Nothing left of today.</p>') + '</section>';
    /* habits */
    if (hs.length) h += '<section class="pl-sec"><h3><i class="bi bi-repeat"></i> Habits today</h3><div class="pl-habits">' + hs.map(function (x) { return '<button type="button" data-plhabit="' + esc(x.id) + '" aria-pressed="' + x.done + '"><i class="bi bi-' + (x.done ? 'check-circle-fill' : 'circle') + '"></i> ' + esc(x.name) + '</button>'; }).join('') + '</div></section>';
    h += '<div class="qa-acts pl-foot"><span class="muted">' + (tops.length ? tops.length + ' of 3 picked' + (tops.filter(block).length ? ' · ' + tops.filter(block).length + ' in the calendar' : '') : '') + '</span><span class="spacer"></span><button type="button" class="pill-btn wide" data-plclose>Done</button></div>';
    var keep = document.activeElement && document.activeElement.id === 'plNew';
    $('plBody').innerHTML = h;
    if (keep) $('plNew').focus();
  }
  function fmtLen(m) { return m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min'; }

  function openPlan() {
    if (!window.Vault.get()) return;
    open_ = true; armed = null; bg.hidden = false; document.body.classList.add('qa-open');
    draw();
    requestAnimationFrame(function () { bg.classList.add('open'); });
    try { localStorage.setItem('dash.planSeen', dkey(new Date())); } catch (e) {}
  }
  function closePlan() {
    open_ = false; bg.classList.remove('open'); document.body.classList.remove('qa-open');
    setTimeout(function () { if (!bg.classList.contains('open')) bg.hidden = true; }, 320);
    window.dispatchEvent(new Event('plan:change'));
  }
  bg.addEventListener('click', function (e) {
    var b;
    if (e.target === bg || e.target.closest('[data-plclose]')) return closePlan();
    if ((b = e.target.closest('[data-pltop]'))) return setTop(b.dataset.pltop, b.dataset.on === '1');
    if ((b = e.target.closest('[data-plarm]'))) { armed = armed === b.dataset.plarm ? null : b.dataset.plarm; draw(); var g = bg.querySelector('.pl-gap'); if (armed && g) g.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    if ((b = e.target.closest('[data-plunsched]'))) return unschedule(b.dataset.plunsched);
    if ((b = e.target.closest('.pl-gap'))) {
      var s = +b.dataset.plslot, en = +b.dataset.end, id = armed || (top3().filter(function (t) { return !block(t); })[0] || {}).id;
      if (id) schedule(id, s, Math.min(60, en - s)); return;
    }
    if (e.target.closest('[data-plfill]')) return fillDay();
    if ((b = e.target.closest('[data-plhabit]'))) return tickHabit(b.dataset.plhabit);
  });
  bg.addEventListener('submit', function (e) { if (e.target.id !== 'plAdd') return; e.preventDefault(); var v = $('plNew').value.trim(); if (v) { $('plNew').value = ''; addTask(v); } });
  /* drag a top-3 task onto a free slot (computer) */
  bg.addEventListener('dragstart', function (e) { var t = e.target.closest('[data-pltask]'); if (!t) return; e.dataTransfer.setData('text/plain', 'pl:' + t.dataset.pltask); e.dataTransfer.effectAllowed = 'move'; armed = t.dataset.pltask; setTimeout(function () { bg.querySelector('.pl-day') && bg.querySelector('.pl-day').classList.add('arming'); }, 0); });
  bg.addEventListener('dragover', function (e) { var g = e.target.closest('.pl-free'); if (g) { e.preventDefault(); g.classList.add('over'); } });
  bg.addEventListener('dragleave', function (e) { var g = e.target.closest('.pl-free'); if (g) g.classList.remove('over'); });
  bg.addEventListener('drop', function (e) {
    var g = e.target.closest('.pl-free'), v = e.dataTransfer.getData('text/plain'); if (!g || !/^pl:/.test(v)) return; e.preventDefault();
    schedule(v.slice(3), +g.dataset.plslot, Math.min(60, +g.dataset.end - +g.dataset.plslot));
  });
  bg.addEventListener('dragend', function () { if (armed) { armed = null; draw(); } });
  document.addEventListener('keydown', function (e) { if (open_ && e.key === 'Escape') { if (armed) { armed = null; draw(); } else closePlan(); } });
  ['todos:change', 'cal:change', 'habits:change'].forEach(function (ev) { window.addEventListener(ev, function () { if (open_) setTimeout(draw, 0); }); });

  /* ---------- ways in ---------- */
  document.addEventListener('click', function (e) { var a = e.target.closest('a[href="#plan"], [data-plan]'); if (!a) return; e.preventDefault(); openPlan(); });
  function fromHash() { if (location.hash === '#plan') { history.replaceState(null, '', location.pathname + location.search); setTimeout(openPlan, 300); } }
  window.addEventListener('hashchange', fromHash);
  window.Vault.onUnlock(function () { setTimeout(fromHash, 200); });
  /* the button on At a glance */
  var head = document.querySelector('.card.brief .card-head');
  if (head && !head.querySelector('[data-plan]')) {
    var pb = document.createElement('button'); pb.type = 'button'; pb.className = 'text-btn'; pb.setAttribute('data-plan', ''); pb.innerHTML = '<i class="bi bi-sunrise"></i> Plan day';
    var rv = head.querySelector('[data-review]'); var wrap = document.createElement('span'); wrap.className = 'head-actions';
    head.insertBefore(wrap, rv || null); wrap.appendChild(pb); if (rv) wrap.appendChild(rv);
  }
  window.Plan = { open: openPlan, close: closePlan, top3: top3, isOpen: function () { return open_; } };
})();
