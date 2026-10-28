/* Shared place search (Entur Geocoder v3) and trip search (Entur Journey Planner v3).
   Used by the dashboard's travel card and by /cmd/travel. Open data, no account needed. */
(function () {
  "use strict";

  var CLIENT = 'jplundberg-dashboard';
  var GEO = 'https://api.entur.io/geocoder/v3/autocomplete';
  var JP = 'https://api.entur.io/journey-planner/v3/graphql';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- geocoder ---------- */
  function search(q, opts) {
    opts = opts || {};
    var url = GEO + '?q=' + encodeURIComponent(q) + '&lang=no&limit=' + (opts.limit || 7) + (opts.layers ? '&layers=' + opts.layers : '');
    return fetch(url, { headers: { 'ET-Client-Name': CLIENT } }).then(function (r) { return r.json(); }).then(function (j) {
      return (j.features || []).map(function (f) {
        var p = f.properties || {}, names = p.names || {}, c = (f.geometry && f.geometry.coordinates) || [];
        var modes = (p.transportModes || []).map(function (m) { return m.mode || m; });
        return {
          id: p.id || '', name: names.default || p.name || names.display || p.label || '',
          sub: [(p.address && p.address.locality) || p.locality || ''].concat(modes.slice(0, 3)).filter(Boolean).join(' · '),
          lon: c[0], lat: c[1], stop: /^NSR:StopPlace/.test(p.id || '')
        };
      }).filter(function (x) { return x.name; });
    });
  }

  /* Where a trip starts or ends, in the form the journey planner wants */
  function toLocation(p) {
    if (p.stop && p.id) return { place: p.id, name: p.name };
    return { name: p.name, coordinates: { latitude: p.lat, longitude: p.lon } };
  }

  /* ---------- trips ---------- */
  var RICH = 'tripPatterns { expectedStartTime aimedStartTime expectedEndTime duration walkDistance ' +
    'legs { mode distance duration realtime aimedStartTime expectedStartTime expectedEndTime ' +
    'fromPlace { name quay { publicCode } } toPlace { name } ' +
    'line { publicCode name transportMode presentation { colour textColour } } ' +
    'fromEstimatedCall { destinationDisplay { frontText } } } } nextPageCursor';
  var PLAIN = 'tripPatterns { expectedStartTime expectedEndTime duration ' +
    'legs { mode duration expectedStartTime expectedEndTime fromPlace { name } toPlace { name } line { publicCode transportMode } } }';
  var rich = true;

  function trips(from, to, when, cursor) {
    var vars = { from: toLocation(from), to: toLocation(to), dateTime: (when && when.time) || new Date().toISOString(), arriveBy: !!(when && when.arriveBy) };
    var args = 'from: $from, to: $to, dateTime: $dateTime, arriveBy: $arriveBy, numTripPatterns: 6' + (cursor && rich ? ', pageCursor: $cursor' : '');
    var q = 'query($from: Location!, $to: Location!, $dateTime: DateTime, $arriveBy: Boolean' + (cursor && rich ? ', $cursor: String' : '') + ') { trip(' + args + ') { ' + (rich ? RICH : PLAIN) + ' } }';
    if (cursor && rich) vars.cursor = cursor;
    return fetch(JP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ET-Client-Name': CLIENT },
      body: JSON.stringify({ query: q, variables: vars })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.errors && rich) { rich = false; return trips(from, to, when, null); }   // retry with fewer fields
      if (!j.data || !j.data.trip) throw new Error('no trips');
      return j.data.trip;
    });
  }

  /* ---------- autocomplete field ---------- */
  function field(input, opts) {
    opts = opts || {};
    var wrap = input.closest('.ps-wrap');
    var list = document.createElement('ul');
    list.className = 'ps-list';
    list.hidden = true;
    list.setAttribute('role', 'listbox');
    wrap.appendChild(list);
    var items = [], seq = 0, timer = null, active = -1;

    function show(rows, msg) {
      items = rows;
      active = -1;
      var mine = opts.myLocation && navigator.geolocation ? '<li><button type="button" data-i="me" role="option"><i class="bi bi-crosshair"></i><span>My location</span></button></li>' : '';
      list.innerHTML = (msg ? '' : mine) + (msg ? '<li class="ps-msg">' + msg + '</li>' : rows.map(function (x, i) {
        return '<li><button type="button" data-i="' + i + '" role="option"><i class="bi bi-' + (x.stop ? 'signpost' : 'geo-alt') + '"></i><span>' + esc(x.name) + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + '</span></button></li>';
      }).join(''));
      list.hidden = false;
    }
    function hide() { list.hidden = true; }
    function pick(p) {
      input.value = p.name;
      input.dataset.picked = '1';
      hide();
      if (opts.onPick) opts.onPick(p);
    }

    input.setAttribute('autocomplete', 'off');
    input.addEventListener('focus', function () {
      if (!input.value && opts.myLocation && navigator.geolocation) show([]);
      if (opts.recent && !input.value) { var r = opts.recent(); if (r.length) show(r); }
    });
    input.addEventListener('input', function () {
      input.dataset.picked = '';
      if (opts.onPick) opts.onPick(null);
      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { if (!q && opts.myLocation) show([]); else hide(); return; }
      timer = setTimeout(function () {
        var s = ++seq;
        search(q, { layers: opts.layers }).then(function (rows) {
          if (s !== seq) return;
          rows.length ? show(rows) : show([], 'No places found');
        }).catch(function () { if (s === seq) show([], 'Couldn’t search right now'); });
      }, 220);
    });
    input.addEventListener('keydown', function (e) {
      var btns = list.querySelectorAll('button');
      if (list.hidden || !btns.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
        btns.forEach(function (b, i) { b.classList.toggle('on', i === active); });
      } else if (e.key === 'Enter' && active > -1) {
        e.preventDefault(); btns[active].click();
      } else if (e.key === 'Escape') hide();
    });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });   // keep focus while choosing
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (!b) return;
      if (b.dataset.i === 'me') {
        input.value = 'Finding you…';
        navigator.geolocation.getCurrentPosition(function (pos) {
          pick({ name: 'My location', lat: pos.coords.latitude, lon: pos.coords.longitude, stop: false, mine: true });
        }, function () { input.value = ''; show([], 'Location isn’t available. Allow it in the browser, or type a place.'); }, { timeout: 10000, maximumAge: 60000 });
        return;
      }
      pick(items[+b.dataset.i]);
    });
    input.addEventListener('blur', function () { setTimeout(hide, 150); });
    return { set: function (p) { input.value = p ? p.name : ''; input.dataset.picked = p ? '1' : ''; }, hide: hide };
  }

  window.Places = { search: search, trips: trips, field: field, esc: esc };
})();
