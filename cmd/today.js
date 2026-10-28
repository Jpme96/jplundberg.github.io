/* "Today" section: real-time departures (Entur, open data) and the habits week view.
   Your stops and habit log are synced in the encrypted vault like your to-dos. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  }
  function save(key, value) {
    try {
      var s = JSON.stringify(value);
      if (localStorage.getItem(key) === s) return;
      localStorage.setItem(key, s);
      window.dispatchEvent(new Event('dash:local'));   // lock.js adds it to the synced vault
    } catch (e) {}
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  var unlocked = false;

  /* ================= Departures (Entur) ================= */
  var CLIENT = 'jplundberg-dashboard';
  var GEO = 'https://api.entur.io/geocoder/v3/autocomplete';
  var JP = 'https://api.entur.io/journey-planner/v3/graphql';
  var MODE = {
    bus: ['#e60000', 'bus-front'], coach: ['#75a300', 'bus-front'], metro: ['#ec700c', 'train-lightrail-front'],
    tram: ['#0b91ef', 'train-lightrail-front'], rail: ['#003087', 'train-front'], water: ['#682c88', 'water'],
    air: ['#6b6d73', 'airplane']
  };
  var tr = load('dash.transit', null) || { stops: [], active: 0 };
  var calls = [], lastFetch = 0, fetchTimer = null, tickTimer = null, failed = false, rich = true;

  function activeStop() { return tr.stops[Math.min(tr.active || 0, tr.stops.length - 1)] || null; }

  function query(id) {
    return '{ stopPlace(id: ' + JSON.stringify(id) + ') { name estimatedCalls(timeRange: 7200, numberOfDepartures: 12) { ' +
      'realtime cancellation aimedDepartureTime expectedDepartureTime quay { publicCode } destinationDisplay { frontText } ' +
      'serviceJourney { line { publicCode transportMode' + (rich ? ' presentation { colour textColour }' : '') + ' } } } } }';
  }

  function fetchDepartures() {
    var stop = activeStop();
    clearTimeout(fetchTimer);
    if (!stop || !unlocked) return;
    fetch(JP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ET-Client-Name': CLIENT },
      body: JSON.stringify({ query: query(stop.id) })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.errors && rich) { rich = false; return fetchDepartures(); }   // retry without optional fields
      if (!j.data || !j.data.stopPlace) throw new Error('no data');
      calls = j.data.stopPlace.estimatedCalls || [];
      failed = false;
      lastFetch = Date.now();
      renderDepartures();
    }).catch(function () {
      failed = true;
      renderDepartures();
    }).then(function () {
      fetchTimer = setTimeout(fetchDepartures, document.hidden ? 120000 : 30000);
    });
  }

  function renderDepartures() {
    var stop = activeStop();
    planHint();
    $('trEmpty').hidden = !!stop;
    $('trTabs').hidden = tr.stops.length < 2;
    $('trTabs').innerHTML = tr.stops.map(function (s, i) {
      return '<button type="button" data-tab="' + i + '" aria-pressed="' + (s === stop) + '">' + esc(s.name) + '</button>';
    }).join('');
    if (!stop) { $('trList').innerHTML = ''; $('trFoot').textContent = ''; return; }

    var now = Date.now();
    var upcoming = calls.filter(function (c) { return new Date(c.expectedDepartureTime).getTime() > now - 30000; }).slice(0, 6);
    if (!upcoming.length) {
      $('trList').innerHTML = '<li class="empty">' + (failed ? 'Couldn’t reach Entur right now. Trying again shortly.' : lastFetch ? 'No departures in the next two hours.' : 'Loading departures…') + '</li>';
    } else {
      $('trList').innerHTML = upcoming.map(function (c) {
        var line = (c.serviceJourney && c.serviceJourney.line) || {};
        var mode = MODE[line.transportMode] || MODE.bus;
        var col = line.presentation && line.presentation.colour ? '#' + line.presentation.colour : mode[0];
        var txt = line.presentation && line.presentation.textColour ? '#' + line.presentation.textColour : '#fff';
        var exp = new Date(c.expectedDepartureTime), aim = new Date(c.aimedDepartureTime);
        var mins = Math.round((exp - now) / 60000);
        var late = Math.round((exp - aim) / 60000);
        var when = mins <= 0 ? 'Now' : mins < 15 ? mins + ' min' : hm(exp);
        var sub = c.cancellation ? 'Cancelled' : late >= 2 ? hm(aim) + ' · ' + late + ' min late' : (mins >= 15 ? '' : hm(exp));
        var plat = c.quay && c.quay.publicCode ? (line.transportMode === 'rail' || line.transportMode === 'metro' ? 'Platform ' : 'Stop ') + esc(c.quay.publicCode) : '';
        return '<li' + (c.cancellation ? ' class="tr-cancel"' : '') + '>' +
          '<span class="tr-line" style="--lc:' + col + ';color:' + txt + '" title="' + esc(line.transportMode || '') + '">' + esc(line.publicCode || '·') + '</span>' +
          '<span class="tr-dest">' + esc((c.destinationDisplay && c.destinationDisplay.frontText) || '') + (plat ? '<small>' + plat + '</small>' : '') + '</span>' +
          '<span class="tr-time' + (mins <= 1 ? ' now' : '') + '">' + (c.realtime ? '<i class="tr-rt" title="Real time"></i>' : '') + when +
          (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></li>';
      }).join('');
    }
    $('trFoot').innerHTML = (tr.stops.length < 2 ? esc(stop.name) + ' · ' : '') + 'Real time from Entur' +
      (lastFetch ? ' · updated ' + hm(new Date(lastFetch)) : '');
  }

  /* Stop search and saved stops */
  var searchTimer = null, searchSeq = 0;
  function renderSaved() {
    $('trSaved').innerHTML = tr.stops.map(function (s, i) {
      return '<li>' + esc(s.name) + '<button type="button" data-rm="' + i + '" aria-label="Remove ' + esc(s.name) + '"><i class="bi bi-x"></i></button></li>';
    }).join('');
    $('trSearch').placeholder = tr.stops.length >= 3 ? 'You can save up to 3 stops' : 'Search for a stop, e.g. Jernbanetorget';
    $('trSearch').disabled = tr.stops.length >= 3;
  }
  $('trEdit').addEventListener('click', function () {
    var box = $('trEditBox');
    box.hidden = !box.hidden;
    $('trEdit').textContent = box.hidden ? 'Stops' : 'Done';
    if (!box.hidden) { renderSaved(); $('trSearch').value = ''; $('trResults').innerHTML = ''; $('trSearch').focus(); }
  });
  $('trSearch').addEventListener('input', function () {
    var q = this.value.trim();
    clearTimeout(searchTimer);
    if (q.length < 2) { $('trResults').innerHTML = ''; return; }
    searchTimer = setTimeout(function () {
      var seq = ++searchSeq;
      fetch(GEO + '?q=' + encodeURIComponent(q) + '&lang=no&limit=6&layers=stopPlace', { headers: { 'ET-Client-Name': CLIENT } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (seq !== searchSeq) return;
          var f = (j.features || []).map(function (x) {
            var p = x.properties || {};
            var names = p.names || {};
            var modes = (p.transportModes || []).map(function (m) { return m.mode || m; });
            return { id: p.id, name: names.default || p.name || names.display || p.label, place: (p.address && p.address.locality) || p.locality || '', modes: modes };
          }).filter(function (x) { return x.id && x.name; });
          $('trResults').innerHTML = f.length ? f.map(function (x, i) {
            return '<li><button type="button" data-pick="' + i + '">' + esc(x.name) + '<small>' + esc([x.place].concat(x.modes.slice(0, 3)).filter(Boolean).join(' · ')) + '</small></button></li>';
          }).join('') : '<li class="empty">No stops found.</li>';
          $('trResults').__items = f;
        })
        .catch(function () { if (seq === searchSeq) $('trResults').innerHTML = '<li class="empty">Couldn’t search right now.</li>'; });
    }, 250);
  });
  $('trResults').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pick]');
    if (!b) return;
    var x = this.__items[+b.dataset.pick];
    if (!tr.stops.some(function (s) { return s.id === x.id; })) tr.stops.push({ id: x.id, name: x.name });
    tr.active = tr.stops.length - 1;
    save('dash.transit', tr);
    $('trSearch').value = ''; $('trResults').innerHTML = '';
    renderSaved();
    calls = []; lastFetch = 0;
    renderDepartures(); fetchDepartures();
  });
  $('trSaved').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (!b) return;
    tr.stops.splice(+b.dataset.rm, 1);
    tr.active = 0;
    save('dash.transit', tr);
    renderSaved();
    calls = []; lastFetch = 0;
    renderDepartures(); fetchDepartures();
  });
  $('trTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b) return;
    tr.active = +b.dataset.tab;
    save('dash.transit', tr);
    calls = []; lastFetch = 0;
    renderDepartures(); fetchDepartures();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && unlocked && Date.now() - lastFetch > 20000) fetchDepartures();
  });

  /* Compact from/to: picking both opens the travel page with the trips */
  var pf = null, pt = null;
  function openTrip() {
    var home = window.Flow && window.Flow.travel().places.home;
    var from = pf || home || (activeStop() ? { id: activeStop().id, name: activeStop().name, stop: true } : null);
    if (!from || !pt) return;
    try { sessionStorage.setItem('dash.tripQuery', JSON.stringify({ from: from, to: pt })); } catch (e) {}
    location.href = 'travel/';
  }
  if (window.Places) {
    var fromF = window.Places.field($('trFrom'), { myLocation: true, onPick: function (p) { pf = p; if (p) { if (pt) openTrip(); else $('trTo').focus(); } } });
    var toF = window.Places.field($('trTo'), { onPick: function (p) { pt = p; if (p) openTrip(); } });
    $('trSwap').addEventListener('click', function () {
      var a = pf; pf = pt; pt = a; fromF.set(pf); toF.set(pt);
      this.classList.remove('spin'); void this.offsetWidth; this.classList.add('spin');
    });
    $('trPlan').addEventListener('submit', function (e) { e.preventDefault(); openTrip(); });
  }
  function planHint() {
    var s = activeStop();
    $('trFrom').placeholder = s ? 'From ' + s.name : 'From';
    $('trSub').hidden = !s;
  }

  /* ================= Habits (this week) ================= */
  var hb = load('dash.habits', null) || { list: [{ id: uid(), name: 'Training', target: 3 }], log: {} };
  var editingHabit = null;
  var DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  function monday(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - (x.getDay() + 6) % 7);
    return x;
  }
  function renderHabits() {
    save('dash.habits', hb);
    var today = new Date(), mon = monday(today), tk = dkey(today);
    var days = [];
    for (var i = 0; i < 7; i++) { var d = new Date(mon); d.setDate(mon.getDate() + i); days.push(d); }
    var head = '<div class="hb-days hb-heads">' + days.map(function (d, i) {
      return '<span class="hb-head' + (dkey(d) === tk ? ' today' : '') + '" title="' + d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) + '">' + DAYS[i] + '</span>';
    }).join('') + '</div>';
    if (!hb.list.length) { $('hbWeek').innerHTML = '<p class="empty">Add a habit, like training three times a week.</p>'; return; }
    $('hbWeek').innerHTML = head + hb.list.map(function (h) {
      var n = 0;
      var cells = days.map(function (d) {
        var k = dkey(d), on = (hb.log[k] || []).indexOf(h.id) > -1, future = k > tk;
        if (on) n++;
        return '<button type="button" class="hb-day' + (on ? ' on' : '') + (k === tk ? ' today' : '') + (future ? ' future' : '') + '" data-h="' + h.id + '" data-d="' + k + '"' +
          (future ? ' disabled' : '') + ' aria-pressed="' + on + '" aria-label="' + esc(h.name) + ', ' + d.toLocaleDateString('en-GB', { weekday: 'long' }) + '"><i class="bi bi-check-lg"></i></button>';
      }).join('');
      return '<div class="hb-item"><div class="hb-top"><button type="button" class="hb-name" data-edit="' + h.id + '" title="Edit ' + esc(h.name) + '">' + esc(h.name) + '</button>' +
        '<span class="hb-count' + (n >= h.target ? ' met' : '') + '">' + (n >= h.target ? '<i class="bi bi-check-circle-fill"></i> ' : '') + n + ' of ' + h.target + '</span></div>' +
        '<div class="hb-days">' + cells + '</div></div>';
    }).join('');
  }
  $('hbWeek').addEventListener('click', function (e) {
    var d = e.target.closest('.hb-day');
    if (d && !d.disabled) {
      var list = hb.log[d.dataset.d] || (hb.log[d.dataset.d] = []);
      var i = list.indexOf(d.dataset.h);
      if (i > -1) list.splice(i, 1); else list.push(d.dataset.h);
      if (!list.length) delete hb.log[d.dataset.d];
      renderHabits();
      window.dispatchEvent(new Event('habits:change'));
      return;
    }
    var n = e.target.closest('[data-edit]');
    if (n) openHabit(hb.list.filter(function (h) { return h.id === n.dataset.edit; })[0]);
  });
  function openHabit(h) {
    editingHabit = h || null;
    $('hbForm').hidden = false;
    $('hbName').value = h ? h.name : '';
    $('hbTarget').value = String(h ? h.target : 3);
    $('hbDelete').hidden = !h;
    $('hbName').focus();
  }
  function closeHabit() { $('hbForm').hidden = true; editingHabit = null; }
  $('hbAddBtn').addEventListener('click', function () { $('hbForm').hidden ? openHabit(null) : closeHabit(); });
  $('hbCancel').addEventListener('click', closeHabit);
  $('hbDelete').addEventListener('click', function () {
    var id = editingHabit && editingHabit.id;
    hb.list = hb.list.filter(function (h) { return h.id !== id; });
    Object.keys(hb.log).forEach(function (k) {
      hb.log[k] = hb.log[k].filter(function (x) { return x !== id; });
      if (!hb.log[k].length) delete hb.log[k];
    });
    closeHabit(); renderHabits();
    window.dispatchEvent(new Event('habits:change'));
  });
  $('hbForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('hbName').value.trim(), t = +$('hbTarget').value;
    if (!name) return;
    if (editingHabit) { editingHabit.name = name; editingHabit.target = t; }
    else hb.list.push({ id: uid(), name: name, target: t });
    closeHabit(); renderHabits();
    window.dispatchEvent(new Event('habits:change'));
  });
  /* the Goals card changed a habit (linked goal) */
  window.addEventListener('habits:change', function (e) {
    var fresh = load('dash.habits', hb);
    if (JSON.stringify(fresh) !== JSON.stringify(hb)) { hb = fresh; renderHabits(); }
  });

  /* A new day or a new week: redraw at midnight */
  var dayShown = dkey(new Date());
  setInterval(function () {
    if (dkey(new Date()) !== dayShown) { dayShown = dkey(new Date()); renderHabits(); }
    if (unlocked) renderDepartures();   // keeps "3 min" counting down between fetches
  }, 20000);

  /* Newer data from another device */
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () {
    if (prevReload) prevReload();
    hb = load('dash.habits', hb);
    var t = load('dash.transit', tr);
    var changed = JSON.stringify(t) !== JSON.stringify(tr);
    tr = t;
    renderHabits();
    if (changed) { calls = []; lastFetch = 0; fetchDepartures(); }
    renderDepartures();
  };

  renderHabits(); window.dispatchEvent(new Event("habits:change"));
  renderDepartures();
  if (window.Vault) {
    window.Vault.onUnlock(function () { unlocked = true; renderHabits(); window.dispatchEvent(new Event('habits:change')); fetchDepartures(); });
    window.Vault.onLock(function () { unlocked = false; clearTimeout(fetchTimer); calls = []; });
  }
})();
