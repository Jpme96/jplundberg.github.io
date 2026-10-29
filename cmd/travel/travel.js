/* Travel page, part 1: the journey planner (Entur Journey Planner v3), saved places,
   the "coming up" strip and the tabs. Trips live in trips.js. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var esc = window.Places.esc, F = window.Flow, C = window.Cal;
  var MODE = {
    bus: ['#e60000', 'bus-front', 'Bus'], coach: ['#75a300', 'bus-front', 'Coach'], metro: ['#ec700c', 'train-lightrail-front', 'Metro'],
    tram: ['#0b91ef', 'train-lightrail-front', 'Tram'], rail: ['#003087', 'train-front', 'Train'], water: ['#682c88', 'water', 'Boat'],
    air: ['#6b6d73', 'airplane', 'Flight'], foot: ['#6b6d73', 'person-walking', 'Walk']
  };
  function pad(n) { return String(n).padStart(2, '0'); }
  function hm(s) { var d = new Date(s); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dur(sec) {
    var m = Math.round(sec / 60);
    return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
  }
  function plain(p) { return p ? { id: p.id || '', name: p.name, sub: p.sub || '', lat: p.lat, lon: p.lon, stop: !!p.stop } : null; }
  var unlocked = false;

  var h = new Date().getHours();
  $('tvHello').textContent = (h < 6 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ',';

  /* ================= tabs ================= */
  var tab = 'journey';
  function setTab(t, keepScroll) {
    tab = t;
    document.querySelectorAll('#tvTabs [data-tab]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.tab === t)); b.setAttribute('aria-selected', String(b.dataset.tab === t));
    });
    $('paneJourney').hidden = t !== 'journey';
    $('paneTrips').hidden = t !== 'trips';
    $('paneHistory').hidden = t !== 'history';
    $('tvHead').textContent = t === 'trips' ? 'where are you going next?' : t === 'history' ? 'where have you been?' : 'where do you want to go?';
    try { sessionStorage.setItem('dash.travelTab', t); } catch (e) {}
    if (!keepScroll) window.scrollTo({ top: 0 });
    window.dispatchEvent(new CustomEvent('travel:tab', { detail: t }));
  }
  $('tvTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab, true); });

  /* ================= journey planner ================= */
  var from = null, to = null, when = 'now', cursor = null, shown = [], context = null;
  var fromField = window.Places.field($('tvFrom'), { myLocation: true, onPick: function (p) { from = p; if (p && to) go(); else if (p) $('tvTo').focus(); } });
  var toField = window.Places.field($('tvTo'), { onPick: function (p) { to = p; if (p && from) go(); } });

  $('tvSwap').addEventListener('click', function () {
    var a = from; from = to; to = a;
    fromField.set(from); toField.set(to);
    this.classList.remove('spin'); void this.offsetWidth; this.classList.add('spin');
    if (from && to) go();
  });

  /* Leave now / Leave at / Arrive by */
  function localISO(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  function setWhen(w, time) {
    when = w;
    $('tvWhen').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.when === w)); });
    $('tvTime').hidden = w === 'now';
    if (time) $('tvTime').value = localISO(time);
    else if (w !== 'now' && !$('tvTime').value) $('tvTime').value = localISO(new Date());
  }
  $('tvWhen').addEventListener('click', function (e) {
    var b = e.target.closest('[data-when]');
    if (!b) return;
    setWhen(b.dataset.when);
    renderContext();
    if (from && to) go();
  });
  $('tvTime').addEventListener('change', function () { renderContext(); if (from && to) go(); });

  $('tvForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!from) { $('tvMsg').textContent = 'Choose where you’re travelling from.'; $('tvFrom').focus(); return; }
    if (!to) { $('tvMsg').textContent = 'Choose where you’re going.'; $('tvTo').focus(); return; }
    go();
  });

  function whenObj() {
    if (when === 'now' || !$('tvTime').value) return { time: new Date().toISOString(), arriveBy: false };
    return { time: new Date($('tvTime').value).toISOString(), arriveBy: when === 'arrive' };
  }

  var seq = 0;
  function go(more) {
    var s = ++seq;
    $('tvMsg').innerHTML = '<i class="bi bi-arrow-repeat spin-i"></i> Finding trips…';
    if (!more) { cursor = null; shown = []; $('tvTrips').innerHTML = ''; }
    $('tvMore').hidden = true;
    $('tvRecent').hidden = true;
    remember();
    window.Places.trips(from, to, whenObj(), more ? cursor : null).then(function (t) {
      if (s !== seq) return;
      var list = (t.tripPatterns || []).filter(function (p) {
        return !shown.some(function (x) { return x.expectedStartTime === p.expectedStartTime && x.duration === p.duration; });
      });
      shown = shown.concat(list);
      cursor = t.nextPageCursor || null;
      $('tvMsg').textContent = shown.length ? '' : 'No trips found. Try another time or a nearby stop.';
      render();
      $('tvMore').hidden = !cursor || !shown.length;
    }).catch(function () {
      if (s !== seq) return;
      $('tvMsg').textContent = 'Couldn’t reach the travel planner right now. Check your connection and try again.';
    });
  }
  $('tvMore').addEventListener('click', function () { go(true); });

  function badge(leg) {
    var line = leg.line || {}, m = MODE[leg.mode] || MODE[line.transportMode] || MODE.bus;
    if (leg.mode === 'foot') return '<span class="tv-walk" title="Walk"><i class="bi bi-person-walking"></i>' + Math.max(1, Math.round(leg.duration / 60)) + '</span>';
    var col = line.presentation && line.presentation.colour ? '#' + line.presentation.colour : m[0];
    var txt = line.presentation && line.presentation.textColour ? '#' + line.presentation.textColour : '#fff';
    return '<span class="tv-line" style="background:' + col + ';color:' + txt + '" title="' + m[2] + '"><i class="bi bi-' + m[1] + '"></i>' + esc(line.publicCode || '') + '</span>';
  }

  var added = {};          // journeys already put in the calendar
  function render() {
    var open = Array.prototype.map.call(document.querySelectorAll('.tv-trip.open'), function (li) { return li.dataset.i; });
    var deadline = context && when === 'arrive' && $('tvTime').value ? new Date($('tvTime').value) : null;
    $('tvTrips').innerHTML = shown.map(function (p, i) {
      var legs = p.legs || [];
      var rides = legs.filter(function (l) { return l.mode !== 'foot'; });
      var first = rides[0];
      var late = first && first.aimedStartTime ? Math.round((new Date(first.expectedStartTime) - new Date(first.aimedStartTime)) / 60000) : 0;
      var changes = Math.max(0, rides.length - 1);
      var leaveIn = Math.round((new Date(p.expectedStartTime) - Date.now()) / 60000);
      var spare = deadline ? Math.round((deadline - new Date(p.expectedEndTime)) / 60000) : null;
      var sub = first
        ? 'From ' + esc(first.fromPlace.name) + (first.fromPlace.quay && first.fromPlace.quay.publicCode ? ', ' + (first.mode === 'rail' || first.mode === 'metro' ? 'platform ' : 'stop ') + esc(first.fromPlace.quay.publicCode) : '') + ' at ' + hm(first.expectedStartTime)
        : 'Walk all the way';
      var key = p.expectedStartTime + '|' + p.expectedEndTime;
      return '<li class="tv-trip" data-i="' + i + '"><button type="button" class="tv-sum" aria-expanded="false">' +
        '<span class="tv-times"><b>' + hm(p.expectedStartTime) + ' – ' + hm(p.expectedEndTime) + '</b><span class="tv-dur">' + dur(p.duration) + '</span></span>' +
        '<span class="tv-legs">' + legs.map(badge).join('<i class="bi bi-chevron-right tv-sep"></i>') + '</span>' +
        '<span class="tv-meta">' + sub + ' · ' + (changes ? changes + ' change' + (changes > 1 ? 's' : '') : 'direct') +
        (leaveIn >= 0 && leaveIn < 60 ? ' · <span class="tv-soon">leave in ' + (leaveIn ? leaveIn + ' min' : 'now') + '</span>' : '') +
        (spare !== null && spare >= 0 ? ' · ' + (spare ? spare + ' min to spare' : 'just in time') : '') +
        (late >= 2 ? ' · <span class="tv-late">' + late + ' min late</span>' : '') + '</span>' +
        '</button><div class="tv-detail" hidden>' + detail(legs) +
        '<div class="tv-acts">' + (added[key]
          ? '<a class="text-btn" href="../calendar/#d=' + F.dkey(new Date(p.expectedStartTime)) + '"><i class="bi bi-check2"></i> In your calendar</a>'
          : '<button type="button" class="text-btn" data-cal="' + i + '"><i class="bi bi-calendar-plus"></i> Add to calendar</button>') +
        '</div></div></li>';
    }).join('');
    open.forEach(function (i) {
      var li = document.querySelector('.tv-trip[data-i="' + i + '"]');
      if (li) { li.classList.add('open'); li.querySelector('.tv-detail').hidden = false; li.querySelector('.tv-sum').setAttribute('aria-expanded', 'true'); }
    });
  }

  function detail(legs) {
    return '<ol class="tv-steps">' + legs.map(function (l) {
      var line = l.line || {};
      var m = MODE[l.mode] || MODE.bus;
      var late = l.aimedStartTime ? Math.round((new Date(l.expectedStartTime) - new Date(l.aimedStartTime)) / 60000) : 0;
      var head = l.mode === 'foot'
        ? 'Walk ' + dur(l.duration) + (l.distance ? ' · ' + (l.distance >= 1000 ? (l.distance / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(l.distance) + ' m') : '')
        : badge(l) + ' ' + esc(m[2]) + (l.fromEstimatedCall && l.fromEstimatedCall.destinationDisplay ? ' towards ' + esc(l.fromEstimatedCall.destinationDisplay.frontText) : (line.name ? ' ' + esc(line.name) : '')) +
          ' · ' + dur(l.duration) + (late >= 2 ? ' · <span class="tv-late">' + late + ' min late</span>' : '') + (l.realtime ? ' <i class="tr-rt" title="Real time"></i>' : '');
      var plat = l.fromPlace && l.fromPlace.quay && l.fromPlace.quay.publicCode && l.mode !== 'foot' ? ' <small>' + (l.mode === 'rail' || l.mode === 'metro' ? 'Platform ' : 'Stop ') + esc(l.fromPlace.quay.publicCode) + '</small>' : '';
      return '<li class="' + (l.mode === 'foot' ? 'walk' : 'ride') + '" style="--lc:' + (l.mode === 'foot' ? 'var(--line)' : ((line.presentation && line.presentation.colour) ? '#' + line.presentation.colour : m[0])) + '">' +
        '<span class="t">' + hm(l.expectedStartTime) + '</span><span class="p"><b>' + esc(l.fromPlace.name) + '</b>' + plat + '</span>' +
        '<span class="how">' + head + '</span></li>';
    }).join('') + (legs.length ? '<li class="end"><span class="t">' + hm(legs[legs.length - 1].expectedEndTime) + '</span><span class="p"><b>' + esc(legs[legs.length - 1].toPlace.name) + '</b></span></li>' : '') + '</ol>';
  }

  $('tvTrips').addEventListener('click', function (e) {
    var c = e.target.closest('[data-cal]');
    if (c) return addToCalendar(shown[+c.dataset.cal]);
    var b = e.target.closest('.tv-sum');
    if (!b) return;
    var d = b.nextElementSibling, open = d.hidden;
    d.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
    b.parentNode.classList.toggle('open', open);
  });

  /* Journey -> calendar */
  function addToCalendar(p) {
    if (!p) return;
    var s = new Date(p.expectedStartTime), e = new Date(p.expectedEndTime);
    var lines = (p.legs || []).filter(function (l) { return l.mode !== 'foot'; })
      .map(function (l) { return (MODE[l.mode] || MODE.bus)[2] + ' ' + ((l.line && l.line.publicCode) || '') + ' from ' + l.fromPlace.name + ' ' + hm(l.expectedStartTime); });
    F.addEvent({
      title: context && context.title ? 'Travel: ' + context.title : 'Travel to ' + (to ? to.name : ''),
      cat: (context && context.cat) || 'life', date: F.dkey(s), start: F.hm(s), stop: F.hm(e),
      location: from ? from.name : '', notes: (lines.length ? lines.join('\n') : 'Walk') + '\nArrive ' + hm(e) + (to ? ' at ' + to.name : '')
    });
    added[p.expectedStartTime + '|' + p.expectedEndTime] = 1;
    render();
  }

  /* ---------- recent journeys (synced) ---------- */
  function remember() {
    if (!from || !to || from.mine || to.mine) return;
    var t = F.travel();
    t.recent = [{ from: plain(from), to: plain(to) }].concat((t.recent || []).filter(function (r) {
      return !(r.from.name === from.name && r.to.name === to.name);
    })).slice(0, 5);
    F.saveTravel(t);
  }
  function renderRecent() {
    var r = F.travel().recent;
    $('tvRecent').hidden = !r.length || shown.length > 0;
    $('tvRecent').innerHTML = r.length ? '<p class="tv-label">Recent</p>' + r.map(function (x, i) {
      return '<button type="button" class="tv-chip" data-r="' + i + '"><i class="bi bi-clock-history"></i><span class="tv-rn">' + esc(x.from.name) + '</span><i class="bi bi-arrow-right"></i><span class="tv-rn">' + esc(x.to.name) + '</span></button>';
    }).join('') : '';
  }
  $('tvRecent').addEventListener('click', function (e) {
    var b = e.target.closest('[data-r]');
    if (!b) return;
    var r = F.travel().recent[+b.dataset.r];
    from = r.from; to = r.to;
    fromField.set(from); toField.set(to);
    go();
  });

  /* ---------- saved places: Home and Work ---------- */
  var PLACES = { home: ['house-door', 'Home'], work: ['briefcase', 'Work'] };
  var settingPlace = null, placeEdit = false;
  var placeField = window.Places.field($('tvPlaceIn'), { onPick: function (p) {
    if (!p || !settingPlace) return;
    var t = F.travel();
    t.places[settingPlace] = plain(p);
    F.saveTravel(t);
    if (settingPlace === 'home' && !from) { from = t.places.home; fromField.set(from); }
    settingPlace = null; $('tvPlaceSet').hidden = true; placeField.set(null);
    renderPlaces();
  } });
  function renderPlaces() {
    var pl = F.travel().places;
    $('tvPlaces').innerHTML = Object.keys(PLACES).map(function (k) {
      var p = pl[k], P = PLACES[k];
      if (!p) return '<button type="button" class="tv-chip tv-chip-add" data-setplace="' + k + '"><i class="bi bi-plus-lg"></i>Set ' + P[1].toLowerCase() + '</button>';
      return '<span class="tv-chip tv-chip-place"><button type="button" data-place="' + k + '" title="' + esc(p.name) + '"><i class="bi bi-' + P[0] + '"></i>' + P[1] + '</button>' +
        (placeEdit ? '<button type="button" class="tv-chip-x" data-unplace="' + k + '" aria-label="Forget ' + P[1] + '"><i class="bi bi-x"></i></button>' : '') + '</span>';
    }).join('') + (pl.home || pl.work ? '<button type="button" class="text-btn tv-place-edit" id="tvPlaceEdit">' + (placeEdit ? 'Done' : 'Edit') + '</button>' : '');
  }
  $('tvPlaces').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-place]'))) {
      var p = F.travel().places[b.dataset.place];
      if (to && !from) { from = p; fromField.set(from); }
      else { to = p; toField.set(to); if (!from) $('tvFrom').focus(); }
      if (from && to) go();
    } else if ((b = e.target.closest('[data-setplace]'))) {
      settingPlace = b.dataset.setplace;
      $('tvPlaceIco').className = 'bi bi-' + PLACES[settingPlace][0];
      $('tvPlaceIn').placeholder = 'Search for your ' + PLACES[settingPlace][1].toLowerCase() + ' address or stop';
      $('tvPlaceSet').hidden = false; $('tvPlaceIn').focus();
    } else if ((b = e.target.closest('[data-unplace]'))) {
      var t = F.travel(); delete t.places[b.dataset.unplace]; F.saveTravel(t); renderPlaces();
    } else if (e.target.closest('#tvPlaceEdit')) { placeEdit = !placeEdit; renderPlaces(); }
  });
  $('tvPlaceCancel').addEventListener('click', function () { settingPlace = null; $('tvPlaceSet').hidden = true; });

  /* ---------- "getting to …" (arrived from the calendar or a trip) ---------- */
  function renderContext() {
    $('tvContext').hidden = !context;
    if (!context) return;
    var t = when === 'arrive' && $('tvTime').value ? new Date($('tvTime').value) : null;
    $('tvContext').innerHTML = '<i class="bi bi-flag"></i><span>Getting to <b>' + esc(context.title || (to ? to.name : '')) + '</b>' +
      (t ? ' · arrive by ' + hm(t) + (context.note ? ' (' + esc(context.note) + ')' : '') : '') + '</span>' +
      '<button type="button" class="tv-context-x" id="tvContextX" aria-label="Clear"><i class="bi bi-x-lg"></i></button>';
  }
  $('tvContext').addEventListener('click', function (e) {
    if (!e.target.closest('#tvContextX')) return;
    context = null; renderContext(); setWhen('now'); if (from && to) go();
  });

  /* A hand-off from another page (dashboard card, calendar, a trip booking) */
  function fromHandoff() {
    var q = null;
    try { q = JSON.parse(sessionStorage.getItem('dash.tripQuery')); sessionStorage.removeItem('dash.tripQuery'); } catch (e) {}
    if (!q) return false;
    setTab('journey');
    context = q.context || null;
    if (q.arriveBy) setWhen('arrive', new Date(q.arriveBy));
    else if (q.departAt) setWhen('depart', new Date(q.departAt));
    if (q.from) { from = q.from; fromField.set(from); }
    if (q.to) { to = q.to; toField.set(to); }
    renderContext();
    var jobs = [];
    if (!q.to && q.toText) {
      $('tvTo').value = q.toText;
      $('tvMsg').innerHTML = '<i class="bi bi-arrow-repeat spin-i"></i> Looking up “' + esc(q.toText) + '”…';
      jobs.push(window.Places.search(q.toText, { limit: 1 }).then(function (l) {
        if (l && l[0]) { to = l[0]; toField.set(to); $('tvMsg').textContent = ''; }
        else $('tvMsg').textContent = 'Couldn’t find “' + q.toText + '”. Pick the place in “To”.';
      }).catch(function () { $('tvMsg').textContent = 'Couldn’t look up the place right now.'; }));
    }
    if (!from) { var home = F.travel().places.home; if (home) { from = home; fromField.set(from); } }
    Promise.all(jobs).then(function () {
      if (from && to) go();
      else if (!from) { $('tvMsg').textContent = 'Where are you starting from? Tip: set Home below and it’s filled in for you.'; $('tvFrom').focus(); }
    });
    return true;
  }

  /* ================= coming up: trips + calendar ================= */
  var nextSeq = 0, nextEvents = [];
  function rangeLabel(t) {
    var a = C.fromKey(t.start), b = C.fromKey(t.end || t.start), o = { day: 'numeric', month: 'short' };
    return a.toLocaleDateString('en-GB', o) + (t.end && t.end !== t.start ? ' – ' + b.toLocaleDateString('en-GB', o) : '') + (t.dest ? ' · ' + t.dest : '');
  }
  function renderNext() {
    if (!unlocked) return;
    var box = $('tvNext'), cards = [], now = new Date(), tr = F.travel(), home = tr.places.home;
    /* the next (or current) trip */
    var trip = tr.trips.filter(function (t) { return (t.end || t.start) >= F.dkey(now); })
      .sort(function (a, b) { return a.start < b.start ? -1 : 1; })[0];
    if (trip) {
      var days = Math.round((C.fromKey(trip.start) - C.day0(now)) / 864e5);
      var pack = trip.pack || [], packed = pack.filter(function (x) { return x.done; }).length;
      cards.push('<button type="button" class="tv-nx tv-nx-trip" data-opentrip="' + esc(trip.id) + '">' +
        '<span class="k"><i class="bi bi-suitcase-lg"></i> ' + (days > 0 ? 'In ' + days + ' day' + (days > 1 ? 's' : '') : 'Travelling now') + '</span>' +
        '<b>' + esc(trip.name) + '</b><span class="s">' + esc(rangeLabel(trip)) + (pack.length ? ' · packed ' + packed + '/' + pack.length : '') + '</span></button>');
    }
    /* the next calendar events with a place, today and tomorrow */
    var evs = C ? C.occurrences(now, C.addDays(C.day0(now), 2)).filter(function (o) {
      if (o.allDay || !o.ev.location || o.start <= now) return false;
      return !(o.ev.item && o.ev.item.type === 'hotel');
    }).slice(0, 2) : [];
    evs.forEach(function (o, i) {
      cards.push('<button type="button" class="tv-nx" data-nx="' + i + '" style="--c:' + o.color + '">' +
        '<span class="k"><i class="bi bi-calendar3"></i> ' + (C.sameDay(o.start, now) ? 'Today' : 'Tomorrow') + ' ' + C.hm(o.start) + '</span>' +
        '<b>' + esc(o.title) + '</b><span class="s" data-lb="' + i + '"><i class="bi bi-geo-alt"></i> ' + esc(o.ev.location) + '</span></button>');
    });
    nextEvents = evs;
    box.hidden = !cards.length;
    box.innerHTML = cards.join('');
    /* when to leave home, if Home is set */
    var s = ++nextSeq;
    if (home) evs.forEach(function (o, i) {
      var buffer = (o.ev.buffer || 0) * 60e3;
      F.leaveBy(o.ev.location, new Date(o.start.getTime() - buffer), home).then(function (r) {
        if (s !== nextSeq || !r) return;
        var el = box.querySelector('[data-lb="' + i + '"]');
        if (el) el.innerHTML = '<i class="bi bi-signpost-split"></i> Leave ' + hm(r.leave) + ' · ' + r.minutes + ' min' + (r.lines.length ? ' · ' + esc(r.lines.join(', ')) : '');
      });
    });
  }
  $('tvNext').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-opentrip]'))) { location.hash = 'trip=' + b.dataset.opentrip; return; }
    if ((b = e.target.closest('[data-nx]'))) {
      var o = nextEvents[+b.dataset.nx];
      if (!o) return;
      var buffer = (o.ev.buffer || 0) * 60e3;
      try {
        sessionStorage.setItem('dash.tripQuery', JSON.stringify({ toText: o.ev.location, arriveBy: new Date(o.start.getTime() - buffer).toISOString(),
          context: { title: o.title, note: buffer ? o.ev.buffer + ' min before ' + C.hm(o.start) : 'starts ' + C.hm(o.start), cat: o.ev.cat } }));
      } catch (x) {}
      fromHandoff();
    }
  });

  /* Keep "leave in 4 min" honest */
  setInterval(function () { if (shown.length && !document.hidden) render(); }, 60000);

  window.TravelPage = { setTab: setTab, handoff: fromHandoff, rangeLabel: rangeLabel };
  window.addEventListener('travel:change', renderNext);
  window.addEventListener('cal:change', renderNext);

  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); if (!shown.length) renderRecent(); renderPlaces(); renderNext(); };
  window.Vault.onUnlock(function () {
    unlocked = true;
    renderPlaces();
    var t = 'journey';
    try { t = sessionStorage.getItem('dash.travelTab') || 'journey'; } catch (e) {}
    if (/^#(trip=|docs)/.test(location.hash)) t = 'trips';
    setTab(t, true);
    if (!fromHandoff()) {
      /* your routine: Home → Work in the morning, Work → Home from midday (weekdays), as soon as both are set */
      var pl = F.travel().places, home = pl.home, work = pl.work, now = new Date(), wd = now.getDay() % 6 !== 0;
      if (home && work && wd && !from && !to && t === 'journey') {
        var morning = now.getHours() < 12;
        from = morning ? home : work; to = morning ? work : home;
        fromField.set(from); toField.set(to);
        go();
      } else if (home && !from) { from = home; fromField.set(from); }
      renderRecent();
    }
    renderNext();
    if (C) C.refreshFeeds(false);
  });
  window.Vault.onLock(function () { unlocked = false; shown = []; $('tvTrips').innerHTML = ''; });
})();
