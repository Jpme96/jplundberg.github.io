/* Calendar page: month, week and list views, an event editor and phone calendars.
   Data and repeats come from cal-core.js (window.Cal). */
(function () {
  "use strict";

  var C = window.Cal;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc, dkey = C.dkey, hm = C.hm, day0 = C.day0, addDays = C.addDays;
  var HOUR = 48;                       // px per hour in the week view
  var unlocked = false;

  var view = 'month';
  try { view = localStorage.getItem('dash.calView') || 'month'; } catch (e) {}
  if (['month', 'week', 'list'].indexOf(view) < 0) view = 'month';
  var cur = day0(new Date());          // the day the views are built around
  var sel = dkey(cur);                 // selected day in the month view
  var shown = [];                      // occurrences on screen, by index
  var listDays = 42;
  var weekScrolled = false;

  function data() { return C.load(); }
  function nWeekDays() { return innerWidth < 700 ? 3 : 7; }
  function weekStart() { return nWeekDays() === 7 ? C.monday(cur) : day0(cur); }

  /* ---------- rows used in the day panel and the list ---------- */
  function row(o, onDay) {
    shown.push(o);
    var sub = [];
    if (o.ev.location) sub.push(esc(o.ev.location));
    if (o.ev.trip) sub.push('<i class="bi bi-suitcase-lg"></i> Travel');
    else if (o.ev.src) sub.push('<i class="bi bi-phone"></i> ' + esc(o.ev.src));
    else if (o.ev.rule) sub.push('<i class="bi bi-arrow-repeat"></i> Repeats');
    return '<li><button type="button" class="cl-ev" data-occ="' + (shown.length - 1) + '" style="--c:' + o.color + '">' +
      '<span class="t">' + C.timeLabel(o, onDay) + '</span><span class="bar"></span>' +
      '<span class="x"><b>' + esc(o.title) + '</b>' + (sub.length ? '<small>' + sub.join(' · ') + '</small>' : '') + '</span></button></li>';
  }
  /* which days (keys) an occurrence touches, within [from, to) */
  function daysOf(o, from, to) {
    var out = [], d = day0(o.start < from ? from : o.start);
    do { out.push(dkey(d)); d = addDays(d, 1); } while (d < to && d < o.end);
    return out;
  }
  function bucket(list, from, to) {
    var by = {};
    list.forEach(function (o) { daysOf(o, from, to).forEach(function (k) { (by[k] = by[k] || []).push(o); }); });
    return by;
  }

  /* ---------- category / calendar filter ---------- */
  function renderCats() {
    var d = data();
    var items = Object.keys(C.CATS).map(function (k) { return { id: k, name: C.CATS[k].name, color: C.CATS[k].color }; })
      .concat([{ id: 'travel', name: 'Travel', color: C.TRAVEL_COLOR, icon: 'suitcase-lg' }])
      .concat(d.feeds.map(function (f) { return { id: 'feed:' + f.id, name: f.name, color: f.color, feed: true }; }));
    $('clCats').innerHTML = items.map(function (it) {
      return '<button type="button" class="cl-cat" data-cat="' + esc(it.id) + '" aria-pressed="' + !d.hidden[it.id] + '" style="--c:' + it.color + '">' +
        '<i class="dot"></i>' + (it.feed ? '<i class="bi bi-phone"></i>' : it.icon ? '<i class="bi bi-' + it.icon + '"></i>' : '') + esc(it.name) + '</button>';
    }).join('');
  }

  /* ---------- month ---------- */
  function renderMonth() {
    var first = new Date(cur.getFullYear(), cur.getMonth(), 1);
    var start = C.monday(first), last = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    var end = addDays(C.monday(last), 7);
    var by = bucket(C.occurrences(start, end), start, end);
    var today = dkey(new Date());
    $('clTitle').textContent = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    var h = '<div class="cl-month">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (w) {
      return '<div class="cl-wd">' + w + '</div>';
    }).join('');
    for (var d = start; d < end; d = addDays(d, 1)) {
      var k = dkey(d), list = by[k] || [];
      var cls = 'cl-cell' + (d.getMonth() !== first.getMonth() ? ' out' : '') + (k === today ? ' today' : '') + (k === sel ? ' sel' : '');
      var label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + (list.length ? ', ' + list.length + ' event' + (list.length > 1 ? 's' : '') : '');
      h += '<button type="button" class="' + cls + '" data-day="' + k + '" aria-label="' + label + '"' + (k === sel ? ' aria-pressed="true"' : '') + '>' +
        '<span class="cl-num">' + d.getDate() + '</span>' +
        '<span class="cl-chips">' + list.slice(0, 3).map(function (o) {
          var t = o.allDay || !C.sameDay(o.start, d) ? '' : '<b>' + hm(o.start) + '</b> ';
          return '<span class="cl-chip' + (o.allDay ? ' full' : '') + '" style="--c:' + o.color + '">' + t + esc(o.title) + '</span>';
        }).join('') + (list.length > 3 ? '<span class="cl-more">+' + (list.length - 3) + ' more</span>' : '') + '</span>' +
        '<span class="cl-dots">' + list.slice(0, 4).map(function (o) { return '<i style="--c:' + o.color + '"></i>'; }).join('') + '</span>' +
        '</button>';
    }
    $('clView').innerHTML = h + '</div>';
    renderDay(by);
  }

  function renderDay(by) {
    var box = $('clDay');
    box.hidden = view !== 'month';
    if (box.hidden) return;
    var d = C.fromKey(sel), list = by && by[sel];
    if (!list) list = C.occurrences(d, addDays(d, 1));
    box.innerHTML = '<div class="card-head"><h2>' + esc(C.dayLabel(d, true)) + '</h2>' +
      '<button class="text-btn" type="button" data-new-day="' + sel + '"><i class="bi bi-plus-lg"></i> Add</button></div>' +
      (list.length ? '<ul class="cl-agenda">' + list.map(function (o) { return row(o, d); }).join('') + '</ul>'
        : '<p class="empty">Nothing planned.</p>');
  }

  /* ---------- week (or 3 days on a phone) ---------- */
  function renderWeek() {
    var n = nWeekDays(), start = weekStart(), end = addDays(start, n);
    var list = C.occurrences(start, end), today = dkey(new Date()), now = new Date();
    var endShown = addDays(start, n - 1);
    $('clTitle').textContent = start.getMonth() === endShown.getMonth()
      ? start.getDate() + '–' + endShown.getDate() + ' ' + endShown.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      : start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – ' + endShown.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    var days = [];
    for (var i = 0; i < n; i++) days.push(addDays(start, i));
    var allDay = days.map(function () { return []; }), timed = days.map(function () { return []; });
    list.forEach(function (o) {
      days.forEach(function (d, i) {
        var a = d, b = addDays(d, 1);
        if (!(o.start < b && (o.end > a || (+o.end === +o.start && o.start >= a)))) return;
        var s = o.start < a ? a : o.start, e = o.end > b ? b : o.end;
        if (o.allDay || (s <= a && e >= b)) allDay[i].push(o);
        else timed[i].push({ o: o, s: s, e: e });
      });
    });

    var head = '<div class="cl-gut"></div>' + days.map(function (d) {
      var k = dkey(d);
      return '<button type="button" class="cl-wk-day' + (k === today ? ' today' : '') + '" data-goto="' + k + '"><span>' +
        d.toLocaleDateString('en-GB', { weekday: 'short' }) + '</span><b>' + d.getDate() + '</b></button>';
    }).join('');
    var hasAll = allDay.some(function (x) { return x.length; });
    var all = !hasAll ? '' : '<div class="cl-wk-all"><div class="cl-gut">all-day</div>' + allDay.map(function (x) {
      return '<div class="cl-wk-allcol">' + x.map(function (o) {
        shown.push(o);
        return '<button type="button" class="cl-chip full" data-occ="' + (shown.length - 1) + '" style="--c:' + o.color + '">' + esc(o.title) + '</button>';
      }).join('') + '</div>';
    }).join('') + '</div>';

    var hours = '';
    for (var hh = 0; hh < 24; hh++) hours += '<span style="top:' + hh * HOUR + 'px">' + (hh ? String(hh).padStart(2, '0') + ':00' : '') + '</span>';
    var cols = timed.map(function (segs, i) {
      layout(segs);
      var k = dkey(days[i]);
      var h = '<div class="cl-wk-col' + (k === today ? ' today' : '') + '" data-col="' + k + '">';
      segs.forEach(function (x) {
        shown.push(x.o);
        var top = (x.s - days[i]) / 36e5 * HOUR, ht = Math.max((x.e - x.s) / 36e5 * HOUR, 22);
        h += '<button type="button" class="cl-blk' + (ht < 40 ? ' short' : '') + '" data-occ="' + (shown.length - 1) + '" style="--c:' + x.o.color +
          ';top:' + top + 'px;height:' + (ht - 2) + 'px;left:calc(' + x.col / x.cols * 100 + '% + 2px);width:calc(' + 100 / x.cols + '% - 4px)">' +
          '<b>' + esc(x.o.title) + '</b><span class="tm">' + C.timeLabel(x.o, days[i]) + (x.o.ev.location ? ' · ' + esc(x.o.ev.location) : '') + '</span></button>';
      });
      if (k === today) h += '<div class="cl-now" style="top:' + ((now - days[i]) / 36e5 * HOUR) + 'px"></div>';
      return h + '</div>';
    }).join('');

    var sc = $('clWkScroll'), keep = sc ? sc.scrollTop : null;
    $('clView').innerHTML = '<div class="cl-week" style="--n:' + n + '">' +
      '<div class="cl-wk-head">' + head + '</div>' + all +
      '<div class="cl-wk-scroll" id="clWkScroll"><div class="cl-wk-grid" style="height:' + 24 * HOUR + 'px">' +
      '<div class="cl-gut cl-hours">' + hours + '</div>' + cols + '</div></div></div>';
    sc = $('clWkScroll');
    if (keep !== null && weekScrolled) sc.scrollTop = keep;
    else {
      var inView = list.length ? Math.min.apply(null, timed.reduce(function (a, s) { return a.concat(s.map(function (x) { return x.s.getHours(); })); }, [24])) : 24;
      var showNow = days.some(function (d) { return dkey(d) === today; }) ? now.getHours() - 1 : 24;
      sc.scrollTop = Math.max(0, Math.max(0, Math.min(7, inView, showNow)) * HOUR - 10);
      weekScrolled = true;
    }
  }
  /* side by side when events overlap */
  function layout(segs) {
    segs.sort(function (a, b) { return a.s - b.s || b.e - a.e; });
    var group = [], ends = [], groupEnd = 0;
    function close() { group.forEach(function (x) { x.cols = ends.length; }); group = []; ends = []; }
    segs.forEach(function (x) {
      var e = Math.max(+x.e, +x.s + 30 * 60e3);
      if (group.length && +x.s >= groupEnd) close();
      var c = ends.findIndex(function (t) { return t <= +x.s; });
      if (c < 0) { c = ends.length; ends.push(e); } else ends[c] = e;
      x.col = c; group.push(x); groupEnd = Math.max(groupEnd, e);
    });
    close();
  }

  /* ---------- list ---------- */
  function renderList() {
    var start = day0(cur), end = addDays(start, listDays);
    var by = bucket(C.occurrences(start, end), start, end);
    var keys = Object.keys(by).sort();
    $('clTitle').textContent = C.sameDay(start, new Date()) ? 'Upcoming' : 'From ' + start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    $('clView').innerHTML = (keys.length ? keys.map(function (k) {
      var d = C.fromKey(k);
      return '<section class="cl-lday"><h3>' + esc(C.dayLabel(d, true)) + '</h3><ul class="cl-agenda">' +
        by[k].map(function (o) { return row(o, d); }).join('') + '</ul></section>';
    }).join('') : '<p class="empty cl-none">Nothing planned in the next ' + Math.round(listDays / 7) + ' weeks.</p>') +
      '<button type="button" class="text-btn cl-more-btn" id="clMore">Show ' + (keys.length ? 'more' : '6 more weeks') + '</button>';
  }

  function render() {
    if (!unlocked) return;
    shown = [];
    document.querySelectorAll('#clViews [data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
    $('fp').setAttribute('data-cl-view', view);
    renderCats();
    if (view === 'month') renderMonth();
    else if (view === 'week') renderWeek();
    else renderList();
    if (view !== 'month') $('clDay').hidden = true;
    renderFeeds();
  }

  /* ---------- navigation ---------- */
  function step(dir) {
    if (view === 'month') {
      cur = new Date(cur.getFullYear(), cur.getMonth() + dir, 1);
      var s = C.fromKey(sel);
      if (s.getMonth() !== cur.getMonth() || s.getFullYear() !== cur.getFullYear()) {
        var t = new Date();
        sel = dkey(t.getMonth() === cur.getMonth() && t.getFullYear() === cur.getFullYear() ? t : cur);
      }
    } else if (view === 'week') cur = addDays(cur, dir * nWeekDays());
    else cur = addDays(cur, dir * 7);
    render();
  }
  function setView(v) {
    view = v;
    try { localStorage.setItem('dash.calView', v); } catch (e) {}
    cur = C.fromKey(sel);
    weekScrolled = false;
    render();
  }
  $('clPrev').addEventListener('click', function () { step(-1); });
  $('clNext').addEventListener('click', function () { step(1); });
  $('clToday').addEventListener('click', function () { cur = day0(new Date()); sel = dkey(cur); weekScrolled = false; listDays = 42; render(); });
  $('clViews').addEventListener('click', function (e) { var b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  $('clNew').addEventListener('click', function () { openEditor(null, { date: view === 'month' ? sel : dkey(view === 'week' ? (sameWeekToday() ? new Date() : weekStart()) : new Date()) }); });
  function sameWeekToday() { var s = weekStart(), t = new Date(); return t >= s && t < addDays(s, nWeekDays()); }

  $('clCats').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (!b) return;
    var d = data();
    if (d.hidden[b.dataset.cat]) delete d.hidden[b.dataset.cat]; else d.hidden[b.dataset.cat] = 1;
    C.save(d);
  });

  $('clView').addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-occ]'))) return openEditor(shown[+t.dataset.occ]);
    if ((t = e.target.closest('[data-day]'))) {
      if (t.dataset.day === sel && e.detail === 2) return openEditor(null, { date: sel });   // double click: new event
      sel = t.dataset.day;
      var d = C.fromKey(sel);
      if (d.getMonth() !== cur.getMonth()) cur = new Date(d.getFullYear(), d.getMonth(), 1);
      render();
      if (innerWidth < 700) $('clDay').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    if ((t = e.target.closest('[data-goto]'))) { sel = t.dataset.goto; cur = C.fromKey(sel); return setView('month'); }
    if (e.target.id === 'clMore') { listDays += 42; return render(); }
    if ((t = e.target.closest('[data-col]'))) {
      var y = e.clientY - t.getBoundingClientRect().top;
      return openEditor(null, { date: t.dataset.col, hour: Math.max(0, Math.min(23, Math.floor(y / HOUR))) });
    }
  });
  $('clDay').addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-occ]'))) return openEditor(shown[+t.dataset.occ]);
    if ((t = e.target.closest('[data-new-day]'))) return openEditor(null, { date: t.dataset.newDay });
  });

  /* swipe left/right on a phone */
  var touch = null;
  $('clView').addEventListener('touchstart', function (e) { var p = e.touches[0]; touch = { x: p.clientX, y: p.clientY, t: Date.now() }; }, { passive: true });
  $('clView').addEventListener('touchend', function (e) {
    if (!touch || view === 'list') return;
    var p = e.changedTouches[0], dx = p.clientX - touch.x, dy = p.clientY - touch.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - touch.t < 600) step(dx < 0 ? 1 : -1);
    touch = null;
  }, { passive: true });

  document.addEventListener('keydown', function (e) {
    if (!unlocked) return;
    if (e.key === 'Escape' && !$('clSheetBg').hidden) return closeEditor();
    if (!$('clSheetBg').hidden || /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 't') $('clToday').click();
    else if (e.key === 'n') { e.preventDefault(); $('clNew').click(); }
  });

  /* ---------- editor ---------- */
  var editing = null;        // { own event object or null, occDate, readOnly }
  var routeFor = null;       // the occurrence the "Get there" button is for

  /* Calendar -> journey planner: arrive in time for this event */
  function routeTo(o, place) {
    if (!window.Flow || !o) return;
    var buffer = (o.ev.buffer || 0) * 60e3;
    window.Flow.route({ toText: place || o.ev.location, arriveBy: new Date(o.start.getTime() - buffer),
      context: { title: o.title, note: buffer ? 'be there ' + (o.ev.buffer) + ' min before ' + hm(o.start) : 'starts ' + hm(o.start) } });
  }
  $('clRead').addEventListener('click', function (e) { if (e.target.closest('[data-route]')) routeTo(routeFor); });
  $('clRoute').addEventListener('click', function () {
    var place = $('clLoc').value.trim();
    if (!place) return;
    var o = routeFor;
    if (!o || !o.ev.own) {          // a new, unsaved event: use what's in the form
      var t = ($('clStart').value || '09:00').split(':'), d = C.fromKey($('clDate').value || dkey(new Date()));
      o = { start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), +t[0], +t[1]), title: $('clTitleIn').value.trim() || place, ev: {} };
    }
    routeTo(o, place);
  });
  $('clLoc').addEventListener('input', function () { $('clRoute').hidden = !this.value.trim() || $('clAllDay').checked; });
  $('clRepeat').innerHTML = Object.keys(C.REPEAT_NAMES).map(function (k) { return '<option value="' + k + '">' + C.REPEAT_NAMES[k] + '</option>'; }).join('');
  $('clCatSeg').innerHTML = Object.keys(C.CATS).map(function (k) {
    return '<button type="button" data-ecat="' + k + '" style="--c:' + C.CATS[k].color + '"><i class="dot"></i>' + C.CATS[k].name + '</button>';
  }).join('');
  var ecat = 'work';
  function setCat(k) {
    ecat = k;
    document.querySelectorAll('[data-ecat]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.ecat === k)); });
  }
  $('clCatSeg').addEventListener('click', function (e) { var b = e.target.closest('[data-ecat]'); if (b) setCat(b.dataset.ecat); });

  function syncFields() {
    var all = $('clAllDay').checked;
    $('clStart').hidden = all; $('clStop').hidden = all; $('clEndDate').hidden = !all;
    $('clStart').required = !all;
    $('clUntilRow').hidden = !$('clRepeat').value;
  }
  $('clAllDay').addEventListener('change', syncFields);
  $('clRepeat').addEventListener('change', syncFields);
  $('clUntilClear').addEventListener('click', function () { $('clUntil').value = ''; });
  /* keep the length when the start moves */
  var lastStart = '';
  $('clStart').addEventListener('focus', function () { lastStart = this.value; });
  $('clStart').addEventListener('change', function () {
    var a = toMin(lastStart), b = toMin($('clStop').value), s = toMin(this.value);
    if (a !== null && b !== null && s !== null) $('clStop').value = fromMin(s + ((b - a + 1440) % 1440 || 60));
    lastStart = this.value;
  });
  $('clDate').addEventListener('change', function () {
    if (!$('clEndDate').value || $('clEndDate').value < this.value) $('clEndDate').value = this.value;
  });
  function toMin(v) { var m = /^(\d{2}):(\d{2})$/.exec(v || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function fromMin(n) { n = ((n % 1440) + 1440) % 1440; return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }

  function openEditor(o, preset) {
    preset = preset || {};
    var bg = $('clSheetBg');
    $('clDelAsk').hidden = true;
    if (o && o.ev.readOnly) {
      editing = { readOnly: true };
      $('clEdit').hidden = true; $('clRead').hidden = false; $('clSave').hidden = true;
      $('clCancel').textContent = 'Close';
      $('clSheetTitle').textContent = 'Event';
      $('clRead').innerHTML = '<h3 style="--c:' + o.color + '"><i class="dot"></i>' + esc(o.title) + '</h3>' +
        '<p><i class="bi bi-clock"></i> ' + esc(C.dayLabel(o.start, true)) + '<br><span class="muted">' + C.timeLabel(o) +
        (o.allDay && o.ev.days > 1 ? ' · ' + o.ev.days + ' days' : '') + (o.ev.rule ? ' · repeats' : '') + '</span></p>' +
        (o.ev.location ? '<p><i class="bi bi-geo-alt"></i> ' + esc(o.ev.location) + '</p>' : '') +
        (o.ev.notes ? '<p class="cl-notes">' + esc(o.ev.notes) + '</p>' : '') +
        '<div class="cl-acts">' + (o.ev.location && !o.allDay ? '<button type="button" class="pill-btn" data-route>' +
          '<i class="bi bi-signpost-split"></i> Get there on time</button>' : '') +
        (o.ev.trip ? '<a class="pill-btn ghost" href="../travel/#trip=' + encodeURIComponent(o.ev.trip) + '"><i class="bi bi-suitcase-lg"></i> Open trip</a>' : '') + '</div>' +
        (o.ev.trip ? '<p class="muted cl-src"><i class="bi bi-suitcase-lg"></i> Planned on the Travel page.</p>'
          : '<p class="muted cl-src"><i class="bi bi-phone"></i> From “' + esc(o.ev.src) + '”. Change it in that calendar.</p>');
      routeFor = o;
    } else {
      var e = o ? o.ev.own : null;
      editing = { own: e, occDate: o ? dkey(o.start) : null };
      routeFor = o;
      $('clEdit').hidden = false; $('clRead').hidden = true; $('clSave').hidden = false;
      $('clCancel').textContent = 'Cancel';
      $('clSheetTitle').textContent = e ? 'Edit event' : 'New event';
      var date = preset.date || dkey(new Date());
      var startH = preset.hour != null ? preset.hour
        : (date === dkey(new Date()) ? Math.min(new Date().getHours() + 1, 23) : 9);
      var last = 'work';
      try { last = localStorage.getItem('dash.calLastCat') || 'work'; } catch (x) {}
      $('clTitleIn').value = e ? e.title : '';
      setCat(e ? (C.CATS[e.cat] ? e.cat : 'life') : (C.CATS[last] ? last : 'work'));
      $('clAllDay').checked = e ? !!e.allDay : false;
      $('clDate').value = e ? e.date : date;
      $('clEndDate').value = e ? (e.end || e.date) : date;
      $('clStart').value = e ? (e.start || '09:00') : fromMin(startH * 60);
      $('clStop').value = e ? (e.stop || fromMin(toMin(e.start || '09:00') + 60)) : fromMin(startH * 60 + 60);
      $('clRepeat').value = e ? (e.repeat || '') : '';
      $('clUntil').value = e ? (e.until || '') : '';
      $('clLoc').value = e ? (e.location || '') : '';
      $('clNotes').value = e ? (e.notes || '') : '';
      $('clDelBox').hidden = !e;
      syncFields();
      $('clRoute').hidden = !$('clLoc').value.trim() || $('clAllDay').checked;
    }
    bg.hidden = false;
    requestAnimationFrame(function () { bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
    if (!o && innerWidth >= 700) setTimeout(function () { $('clTitleIn').focus(); }, 60);
  }
  function closeEditor() {
    var bg = $('clSheetBg');
    bg.classList.remove('open');
    document.documentElement.classList.remove('cl-modal');
    setTimeout(function () { bg.hidden = true; }, 220);
    editing = null;
  }
  $('clCancel').addEventListener('click', closeEditor);
  $('clSheetBg').addEventListener('click', function (e) { if (e.target === this) closeEditor(); });

  $('clSheet').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!editing || editing.readOnly) return closeEditor();
    var title = $('clTitleIn').value.trim();
    if (!title) { $('clTitleIn').focus(); return; }
    var all = $('clAllDay').checked, date = $('clDate').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('clDate').focus(); return; }
    var ev = {
      id: editing.own ? editing.own.id : C.uid(), title: title.slice(0, 120), cat: ecat, date: date, allDay: all,
      repeat: $('clRepeat').value, location: $('clLoc').value.trim().slice(0, 160), notes: $('clNotes').value.trim().slice(0, 2000)
    };
    if (all) {
      var end = $('clEndDate').value;
      if (end && end > date) ev.end = end;
    } else {
      ev.start = /^\d{2}:\d{2}$/.test($('clStart').value) ? $('clStart').value : '09:00';
      ev.stop = /^\d{2}:\d{2}$/.test($('clStop').value) ? $('clStop').value : fromMin(toMin(ev.start) + 60);
    }
    if (ev.repeat && $('clUntil').value >= date) ev.until = $('clUntil').value;
    if (!ev.repeat) { delete ev.repeat; }
    if (editing.own && editing.own.skip && ev.repeat) ev.skip = editing.own.skip;
    var d = data();
    var i = d.events.findIndex(function (x) { return x.id === ev.id; });
    if (i > -1) d.events[i] = ev; else d.events.push(ev);
    try { localStorage.setItem('dash.calLastCat', ecat); } catch (x) {}
    if (d.hidden[ecat]) delete d.hidden[ecat];       // don't let a new event vanish behind a filter
    sel = editing.occDate && editing.own && editing.own.date === date ? editing.occDate : date;
    if (view === 'month') { var s = C.fromKey(sel); cur = new Date(s.getFullYear(), s.getMonth(), 1); }
    closeEditor();
    C.save(d);
  });

  $('clDelete').addEventListener('click', function () {
    if (!editing || !editing.own) return;
    if (editing.own.repeat) { $('clDelAsk').hidden = false; return; }
    removeEvent(false);
  });
  $('clDelOne').addEventListener('click', function () { removeEvent(true); });
  $('clDelAll').addEventListener('click', function () { removeEvent(false); });
  function removeEvent(onlyThis) {
    var d = data(), id = editing.own.id, occ = editing.occDate;
    var i = d.events.findIndex(function (x) { return x.id === id; });
    if (i > -1) {
      if (onlyThis && occ) {
        var e = d.events[i];
        e.skip = (e.skip || []).filter(function (k) { return k >= dkey(addDays(new Date(), -400)); });
        if (e.skip.indexOf(occ) < 0) e.skip.push(occ);
      } else d.events.splice(i, 1);
    }
    closeEditor();
    C.save(d);
  }

  /* ---------- phone calendars ---------- */
  function ago(t) {
    if (!t) return '';
    var m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  var removing = null;
  function renderFeeds() {
    var d = data();
    $('clFeedList').innerHTML = d.feeds.map(function (f) {
      var st = C.feedState(f.id) || {};
      var status = st.loading ? '<span class="muted"><i class="bi bi-arrow-repeat spin-i"></i> Loading…</span>'
        : st.error ? '<span class="cl-err"><i class="bi bi-exclamation-circle"></i> ' + esc(st.error) + '</span>'
        : st.events ? '<span class="muted">' + st.events.length + ' event' + (st.events.length === 1 ? '' : 's') + ' · updated ' + ago(st.at) + '</span>'
        : '<span class="muted">Not loaded yet</span>';
      return '<li><button type="button" class="cl-swatch" data-recolor="' + f.id + '" style="--c:' + f.color + '" aria-label="Change colour"></button>' +
        '<div class="x"><b>' + esc(f.name) + '</b>' + status + '</div>' +
        '<button type="button" class="text-btn danger" data-remove="' + f.id + '">' + (removing === f.id ? 'Remove?' : 'Remove') + '</button></li>';
    }).join('');
    $('clFeedRefresh').hidden = !d.feeds.length;
  }
  $('clFeedList').addEventListener('click', function (e) {
    var t, d = data();
    if ((t = e.target.closest('[data-recolor]'))) {
      var f = d.feeds.find(function (x) { return x.id === t.dataset.recolor; });
      if (!f) return;
      var i = C.FEED_COLORS.indexOf(f.color);
      f.color = C.FEED_COLORS[(i + 1) % C.FEED_COLORS.length];
      C.save(d);
    } else if ((t = e.target.closest('[data-remove]'))) {
      if (removing !== t.dataset.remove) { removing = t.dataset.remove; renderFeeds(); return; }
      d.feeds = d.feeds.filter(function (x) { return x.id !== removing; });
      delete d.hidden['feed:' + removing];
      try { sessionStorage.removeItem('dash.calfeed.' + removing); } catch (x) {}
      removing = null;
      C.save(d);
    }
  });
  $('clFeedRefresh').addEventListener('click', function () { C.refreshFeeds(true); });
  $('clFeedForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var url = $('clFeedUrl').value.trim(), msg = $('clFeedMsg');
    if (!/^(webcals?|https):\/\/\S+$/i.test(url)) { msg.textContent = 'Paste the whole link. It starts with webcal:// or https://'; return; }
    var host = '';
    try { host = new URL(url.replace(/^webcals?:/i, 'https:')).hostname; } catch (x) {}
    if (!/(icloud\.com|google\.com|outlook\.(office365|office|live)\.com)$/i.test(host)) { msg.textContent = 'Only iCloud, Google and Outlook calendar links work here.'; return; }
    var d = data();
    if (d.feeds.some(function (f) { return f.url === url; })) { msg.textContent = 'That calendar is already added.'; return; }
    var used = d.feeds.map(function (f) { return f.color; });
    var f = {
      id: C.uid(), url: url,
      name: $('clFeedName').value.trim().slice(0, 40) || (/icloud/i.test(host) ? 'iPhone' : /google/i.test(host) ? 'Google' : 'Outlook'),
      color: C.FEED_COLORS.find(function (c) { return used.indexOf(c) < 0; }) || C.FEED_COLORS[d.feeds.length % C.FEED_COLORS.length]
    };
    d.feeds.push(f);
    C.save(d);
    $('clFeedName').value = ''; $('clFeedUrl').value = '';
    msg.textContent = 'Loading “' + f.name + '”…';
    C.fetchFeed(f).then(function () {
      var st = C.feedState(f.id) || {};
      msg.textContent = st.error ? '' : 'Added “' + f.name + '” with ' + (st.events || []).length + ' events.';
      window.dispatchEvent(new Event('cal:change'));
    });
    renderFeeds();
  });

  /* ---------- wiring ---------- */
  window.addEventListener('cal:change', render);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); C.refreshFeeds(false); };
  var lastW = innerWidth;
  window.addEventListener('resize', function () {
    if ((lastW < 700) !== (innerWidth < 700) && view === 'week') { weekScrolled = false; render(); }
    lastW = innerWidth;
  });
  /* keep "today" and the now-line current */
  setInterval(function () { if (unlocked && $('clSheetBg').hidden) render(); }, 60000);

  function fromHash() {
    var h = location.hash;
    if (!h) return;
    var m = h.match(/^#d=(\d{4}-\d{2}-\d{2})$/);
    history.replaceState(null, '', location.pathname);
    if (m) { sel = m[1]; cur = C.fromKey(sel); if (view !== 'month') { cur = C.fromKey(sel); } render(); }
    if (h === '#new') openEditor(null, { date: sel });
  }
  window.addEventListener('hashchange', fromHash);

  if (window.Vault) {
    window.Vault.onUnlock(function () { unlocked = true; render(); fromHash(); C.refreshFeeds(false); });
    window.Vault.onLock(function () { unlocked = false; closeEditor(); });
  }
})();
