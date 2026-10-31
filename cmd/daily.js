/* Dashboard, every day:
     Today      one line through the day – events, tasks for today, bins, birthdays, dinner,
                the running timer – with a "now" marker. (Settings → Dashboard: "Today")
     Commute    in the Travel card on weekdays: Home → Work in the morning, Work → Home in the
                afternoon, the next departures counting down; late in amber, cancelled in red. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var C = window.Cal, Fe = window.Features;
  if (!window.Vault) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function on(k) { return !Fe || Fe.on(k); }
  var unlocked = false;

  /* ============================== Today ============================== */
  var card = $('tlCard');
  function at(h, m) { var d = new Date(); d.setHours(h, m || 0, 0, 0); return d; }
  function items() {
    var now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), t1 = new Date(t0); t1.setDate(t1.getDate() + 1);
    var tk = dkey(now), out = [], allDay = [], HL = window.HomeLife;
    function push(time, icon, color, title, sub, href, kind) { out.push({ t: time, icon: icon, c: color, title: title, sub: sub || '', href: href || '', kind: kind || '' }); }
    /* the calendar: events, and the reminders the tools put there (bins, birthdays, upkeep, tasks, renewals …) */
    if (C && C.occurrences && on('calendar')) {
      try {
        C.occurrences(t0, t1, { card: true }).forEach(function (o) {
          if (o.ev.holiday) { allDay.push({ icon: 'flag', c: '#e66767', title: o.title, href: 'calendar/#d=' + tk }); return; }
          var href = o.ev.link ? o.ev.link.replace(/^\/cmd\//, '') : 'calendar/#d=' + tk;
          if (o.allDay) {
            var ic = /^rem:pb:/.test(o.ev.id) ? 'balloon' : /^rem:bin:/.test(o.ev.id) ? 'trash3' : /^rem:hm:/.test(o.ev.id) ? 'tools' : /^todo:/.test(o.ev.id) ? 'check2-square' : /^rem:ml:/.test(o.ev.id) ? 'egg-fried' : o.ev.trip ? 'suitcase-lg' : o.ev.reminder ? 'bell' : 'calendar-check';
            if (/^rem:ml:/.test(o.ev.id)) return;                                   // dinner gets its own place at 18:00
            allDay.push({ icon: ic, c: o.color || 'var(--accent)', title: String(o.title).replace(/^(?:☐|🎈|🔧|🍽️?)\s*/, ''), href: href });
            return;
          }
          if (o.ev.leave) { push(o.start, 'signpost-split', '#7a8794', o.title, hm(o.start) + ' · ' + (o.ev.location || ''), 'travel/', 'leave'); return; }
          push(o.start, 'calendar-event', o.color, o.title, hm(o.start) + '–' + hm(o.end) + (o.ev.location ? ' · ' + o.ev.location : ''), href, 'event');
        });
      } catch (e) {}
    }
    /* flex: when you clocked in */
    if (Fe && Fe.on('flex')) Fe.list('flex').filter(function (e) { return e.date === tk && e.in; }).forEach(function (e) {
      var p = e.in.split(':'); push(at(+p[0], +p[1]), 'stopwatch', '#e8743b', e.out ? 'Worked ' + e.in + '–' + e.out : 'Clocked in', e.out ? '' : 'Still at work', 'work/', 'flex');
      if (e.out) { /* shown as one line */ }
    });
    /* the client timer that's running */
    var run = Fe && Fe.on('ptime') && (Fe.tools().ptrun || null);
    if (run) { var pj = Fe.list('pproj').filter(function (x) { return x.id === run.pid; })[0]; push(new Date(run.start), 'hourglass-split', '#e8743b', 'Timer: ' + (pj ? pj.name : 'client'), 'Running since ' + hm(new Date(run.start)), 'work/#ptime', 'timer'); }
    /* bins out tonight */
    if (HL && Fe.on('house')) {
      var tm = new Date(t1), tmk = dkey(tm), hc = HL.cfg('housecfg');
      var bins = Fe.list('hbins').filter(function (b) { return b.night !== false && HL.nextPickup(b, tmk) === tmk; }).map(function (b) { return b.title; });
      if (bins.length) push(at(Math.max(18, +hc.binHour || 18)), 'trash3', '#c98500', 'Put out ' + bins.join(' + '), 'Picked up tomorrow', 'house/', 'bins');
    }
    /* dinner */
    if (HL && Fe.on('food')) {
      var m = HL.meals()[tk];
      push(at(18), 'egg-fried', '#c98500', m ? 'Dinner: ' + m : 'Dinner', m ? '' : 'Nothing planned yet', 'food/', 'dinner');
    }
    out.sort(function (a, b) { return a.t - b.t; });
    return { list: out, allDay: allDay, now: now };
  }
  /* evenings: what got done, and how tomorrow starts */
  function evening(now) {
    var tk = dkey(now), t1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), t2 = new Date(t1); t2.setDate(t2.getDate() + 1);
    var todos = readJSON('dash.todos', []) || [], done = todos.filter(function (t) { return t.done && t.doneAt === tk; }).length;
    var FT = window.FlexTime, worked = FT && Fe && Fe.on('flex') ? FT.stats().today : 0, bits = [];
    if (done) bits.push('<span><i class="bi bi-check2-circle"></i><b>' + done + '</b> task' + (done === 1 ? '' : 's') + ' done</span>');
    if (worked) bits.push('<span><i class="bi bi-stopwatch"></i><b>' + Math.floor(worked / 60) + ' h ' + pad(Math.round(worked % 60)) + '</b> at work</span>');
    var fm = (readJSON('dash.focusLog', []) || []).filter(function (x) { return x.d === tk; }).reduce(function (s, x) { return s + (+x.m || 0); }, 0);
    if (fm) bits.push('<span><i class="bi bi-bullseye"></i><b>' + fm + ' min</b> focus</span>');
    var tm = [];
    if (C && C.occurrences && on('calendar')) try {
      C.occurrences(t1, t2, { card: true }).forEach(function (o) {
        if (o.ev.holiday) return;
        tm.push({ t: o.allDay ? null : o.start, title: String(o.title).replace(/^(?:☐|🎈|🔧|🍽️?)\s*/, ''), icon: o.ev.leave ? 'signpost-split' : o.allDay ? 'calendar-check' : 'calendar-event', c: o.color });
      });
    } catch (e) {}
    var top = todos.filter(function (t) { return !t.done && t.due === dkey(t1); }).slice(0, 3);
    tm.sort(function (a, b) { return (a.t ? +a.t : 0) - (b.t ? +b.t : 0); });
    var list = tm.slice(0, 4).map(function (x) { return '<li style="--c:' + esc(x.c || 'var(--accent)') + '"><span class="tl-t">' + (x.t ? hm(x.t) : 'All day') + '</span><i class="bi bi-' + x.icon + '"></i><span>' + esc(x.title) + '</span></li>'; }).join('') +
      top.map(function (t) { return '<li style="--c:#22b35e"><span class="tl-t">Task</span><i class="bi bi-check2-square"></i><span>' + esc(t.text) + '</span></li>'; }).join('');
    return '<div class="tl-eve">' + (bits.length ? '<p class="tl-done">' + bits.join('') + '</p>' : '') +
      '<p class="tl-sub"><i class="bi bi-sunrise"></i> Tomorrow, ' + esc(t1.toLocaleDateString('en-GB', { weekday: 'long' })) + '</p>' +
      (list ? '<ul class="tl-tm">' + list + '</ul>' : '<p class="muted tl-free">Nothing planned yet.</p>') + '</div>';
  }
  function drawToday() {
    if (!card || !unlocked) return;
    var r = items(), now = r.now, html = '', placed = false;
    r.list.forEach(function (x) {
      if (!placed && x.t > now) { html += '<li class="tl-now"><span class="tl-t">' + hm(now) + '</span><span class="tl-nowline"></span></li>'; placed = true; }
      var past = x.t < now && !(x.kind === 'timer' || (x.kind === 'flex' && /Clocked in/.test(x.title)));
      html += '<li class="tl-it' + (past ? ' past' : '') + '" style="--c:' + esc(x.c || 'var(--accent)') + '"><span class="tl-t">' + hm(x.t) + '</span><span class="tl-dot"><i class="bi bi-' + x.icon + '"></i></span>' +
        '<a class="tl-x" href="' + esc(x.href || '#') + '"><b>' + esc(x.title) + '</b>' + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + '</a></li>';
    });
    if (!placed) html += '<li class="tl-now"><span class="tl-t">' + hm(now) + '</span><span class="tl-nowline"></span></li>';
    var empty = !r.list.length && !r.allDay.length, eve = now.getHours() >= 17 ? evening(now) : '';
    card.innerHTML = '<div class="card-head"><h2><i class="bi bi-list-columns-reverse"></i> Today</h2><span class="muted tl-date">' + esc(now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })) + '</span></div>' +
      (r.allDay.length ? '<div class="tl-all">' + r.allDay.map(function (x) { return '<a class="tl-chip" href="' + esc(x.href) + '" style="--c:' + esc(x.c) + '"><i class="bi bi-' + x.icon + '"></i>' + esc(x.title) + '</a>'; }).join('') + '</div>' : '') +
      (empty ? '<p class="empty">A free day – nothing in the calendar, no bins, no birthdays.</p>' : '<ol class="tl">' + html + '</ol>') + eve;
    clearTimeout(keepSnap.t); keepSnap.t = setTimeout(keepSnap, 500);
  }
  /* coming back to an open session: paint the last Today straight away (this tab only, no amounts in it) */
  if (card && document.documentElement.classList.contains('resuming')) {
    try { var snap = JSON.parse(sessionStorage.getItem('dash.tlSnap') || 'null'); if (snap && snap.d === dkey(new Date())) card.innerHTML = snap.h; } catch (e) {}
  }
  function keepSnap() { try { sessionStorage.setItem('dash.tlSnap', JSON.stringify({ d: dkey(new Date()), h: card.innerHTML })); } catch (e) {} }
  if (card) {
    ['cal:change', 'tools:change', 'todos:change', 'features:change', 'plan:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(drawToday.t); drawToday.t = setTimeout(drawToday, 60); }); });
    setInterval(function () { if (!document.hidden) drawToday(); }, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) drawToday(); });
  }

  /* ============================== Commute ============================== */
  var cm = $('trCommute'), JP = 'https://api.entur.io/journey-planner/v3/graphql', CLIENT = 'jplundberg-dashboard';
  var CM = { key: '', list: null, at: 0, err: false, busy: false };
  function loc(p) { return p.stop && p.id ? { place: p.id, name: p.name } : { name: p.name, coordinates: { latitude: p.lat, longitude: p.lon } }; }
  function route() {
    var pl = window.Flow && window.Flow.travel().places, now = new Date(), h = now.getHours();
    if (!pl || !pl.home || !pl.work || now.getDay() % 6 === 0 || (Fe && Fe.holiday && Fe.holiday(dkey(now)))) return null;
    if ((Fe && Fe.on('flex')) && Fe.list('flex').some(function (e) { return e.date === dkey(now) && e.type && e.type !== 'work' && e.type !== 'course'; })) return null;   // holiday, sick, day off
    if (h >= 5 && h < 11) return { a: pl.home, b: pl.work, from: 'Home', to: 'Work', i: ['house-door', 'briefcase'] };
    if (h >= 14 && h < 20) return { a: pl.work, b: pl.home, from: 'Work', to: 'Home', i: ['briefcase', 'house-door'] };
    return null;
  }
  function fetchCommute(r) {
    if (CM.busy) return;
    CM.busy = true;
    var q = 'query($from: Location!, $to: Location!) { trip(from: $from, to: $to, numTripPatterns: 5) { tripPatterns { expectedStartTime aimedStartTime expectedEndTime duration ' +
      'legs { mode expectedStartTime aimedStartTime realtime line { publicCode transportMode presentation { colour } } fromPlace { name } fromEstimatedCall { cancellation destinationDisplay { frontText } } } } } }';
    fetch(JP, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ET-Client-Name': CLIENT }, body: JSON.stringify({ query: q, variables: { from: loc(r.a), to: loc(r.b) } }) })
      .then(function (x) { return x.json(); }).then(function (j) {
        if (!j.data || !j.data.trip) throw new Error('no trips');
        CM.list = j.data.trip.tripPatterns || []; CM.at = Date.now(); CM.err = false;
        if (r.from === 'Home' && CM.list[0]) try { localStorage.setItem('dash.commuteMins', String(Math.round(CM.list[0].duration / 60))); } catch (e) {}   // for the "time to leave" notification
      }).catch(function () {
        /* no answer: try again by itself after 15 s, then 45 s, then the normal minute */
        CM.err = true; CM.fails = (CM.fails || 0) + 1; CM.at = Date.now() - (CM.fails < 3 ? (CM.fails === 1 ? 45000 : 15000) : 0);
      }).then(function () { if (!CM.err) CM.fails = 0; CM.busy = false; drawCommute(); });
  }
  function drawCommute() {
    if (!cm) return;
    var r = unlocked && on('travel') ? route() : null, rt = $('trRoutine');
    if (!r) { cm.hidden = true; cm.innerHTML = ''; if (rt) rt.classList.remove('tr-off'); return; }
    var key = r.from + r.to;
    if (key !== CM.key) { CM.key = key; CM.list = null; }
    if (!CM.busy && (!CM.at || Date.now() - CM.at > 60000 || key !== CM.lastKey)) { CM.lastKey = key; fetchCommute(r); }
    if (rt) rt.classList.add('tr-off');
    cm.hidden = false;
    var now = Date.now(), rows = (CM.list || []).map(function (p) {
      var first = (p.legs || []).filter(function (l) { return l.mode !== 'foot'; })[0], leave = new Date(p.expectedStartTime);
      var cancel = first && first.fromEstimatedCall && first.fromEstimatedCall.cancellation;
      var late = first && first.aimedStartTime ? Math.round((new Date(first.expectedStartTime) - new Date(first.aimedStartTime)) / 60000) : 0;
      return { p: p, first: first, leave: leave, cancel: cancel, late: late, mins: Math.round((leave - now) / 60000) };
    }).filter(function (x) { return x.leave - now > -60000; }).slice(0, 3);
    var head = '<div class="cm-head"><i class="bi bi-' + r.i[0] + '"></i> ' + r.from + ' <i class="bi bi-arrow-right"></i> <i class="bi bi-' + r.i[1] + '"></i> ' + r.to +
      '<button type="button" class="link-btn cm-plan" data-cmplan>All trips</button></div>';
    var body;
    if (!CM.list && !CM.err) body = '<p class="muted cm-msg">Finding departures …</p>';
    else if (!rows.length) body = '<p class="muted cm-msg">' + (CM.err ? 'No connection to Entur right now. <button type="button" class="link-btn" data-cmretry>Try again</button>' : 'No trips found.') + '</p>';
    else body = '<ul class="cm-list">' + rows.map(function (x, i) {
      var l = x.first, line = l && l.line, col = line && line.presentation && line.presentation.colour ? '#' + line.presentation.colour : 'var(--accent)';
      var dest = l && l.fromEstimatedCall && l.fromEstimatedCall.destinationDisplay ? l.fromEstimatedCall.destinationDisplay.frontText : '';
      var when = x.mins <= 0 ? 'Now' : x.mins < 60 ? x.mins + ' min' : hm(x.leave);
      var state = x.cancel ? '<span class="cm-bad">Cancelled</span>' : x.late >= 2 ? '<span class="cm-late">+' + x.late + ' min</span>' : (l && l.realtime ? '<span class="cm-ok">On time</span>' : '');
      return '<li class="' + (x.cancel ? 'cancel' : '') + (i === 0 ? ' first' : '') + '"><span class="cm-when" data-cmleave="' + x.leave.getTime() + '">' + when + '</span>' +
        '<span class="cm-x"><b>' + (line ? '<span class="cm-line" style="--lc:' + esc(col) + '">' + esc(line.publicCode || '') + '</span> ' : '') + esc(dest || (l && l.fromPlace ? l.fromPlace.name : 'Walk')) + '</b>' +
        '<small>Leave ' + hm(x.leave) + ' · there ' + hm(new Date(x.p.expectedEndTime)) + (l && l.fromPlace ? ' · from ' + esc(l.fromPlace.name) : '') + '</small></span>' + state + '</li>';
    }).join('') + '</ul>';
    cm.innerHTML = head + body;
  }
  if (cm) {
    cm.addEventListener('click', function (e) {
      if (e.target.closest('[data-cmretry]')) { var rr = route(); CM.fails = 0; if (rr) { CM.list = null; CM.err = false; drawCommute(); fetchCommute(rr); } return; }
      if (!e.target.closest('[data-cmplan]')) return;
      var r = route(); if (!r) return;
      try { sessionStorage.setItem('dash.tripQuery', JSON.stringify({ from: r.a, to: r.b })); } catch (x) {}
      location.href = 'travel/';
    });
    /* the countdown ticks without asking Entur again; a new search every minute while you look */
    setInterval(function () {
      if (document.hidden || cm.hidden) return;
      if (Date.now() - CM.at > 60000) return drawCommute();
      cm.querySelectorAll('[data-cmleave]').forEach(function (s) { var m = Math.round((+s.dataset.cmleave - Date.now()) / 60000); s.textContent = m <= 0 ? 'Now' : m < 60 ? m + ' min' : s.textContent; });
    }, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) drawCommute(); });
    window.addEventListener('travel:change', function () { CM.at = 0; drawCommute(); });
  }

  window.Vault.onUnlock(function () { unlocked = true; setTimeout(function () { drawToday(); drawCommute(); }, 80); });
  window.Vault.onLock(function () { unlocked = false; try { sessionStorage.removeItem('dash.tlSnap'); } catch (e) {} if (card) card.innerHTML = ''; if (cm) { cm.hidden = true; cm.innerHTML = ''; } });
  window.Daily = { today: drawToday, commute: drawCommute };
})();
