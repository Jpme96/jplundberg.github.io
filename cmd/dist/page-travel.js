/* Built by cmd/build.py from: places.js, travel/world.js, flow.js, calendar/cal-core.js, travel/travel.js, travel/trips.js, travel/history.js, kit.js, tools.js, profile.js, links.js – edit those files, not this one. */
/* ===== places.js ===== */
try {
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
        (opts.search || search)(q, { layers: opts.layers }).then(function (rows) {
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
} catch (e) { console.error("places.js", e); }
/* ===== travel/world.js ===== */
try {
/* World: lookups for trips abroad. Open services, no accounts or keys:
   - Open-Meteo: place search, weather forecast, and last year's weather for the same dates
   - Frankfurter (European Central Bank rates): currency
   - OpenStreetMap: address lookup (Nominatim) and map tiles (Leaflet, loaded only when a map is shown)
   Only place names and addresses are sent – nothing else about you or your trips. */
(function () {
  "use strict";

  var HOME_TZ = 'Europe/Oslo';
  var WMO = {
    0: ['Clear sky', 'sun'], 1: ['Mostly clear', 'sun'], 2: ['Partly cloudy', 'cloud-sun'], 3: ['Overcast', 'clouds'],
    45: ['Fog', 'cloud-fog2'], 48: ['Freezing fog', 'cloud-fog2'], 51: ['Light drizzle', 'cloud-drizzle'], 53: ['Drizzle', 'cloud-drizzle'],
    55: ['Heavy drizzle', 'cloud-drizzle'], 56: ['Freezing drizzle', 'cloud-sleet'], 57: ['Freezing drizzle', 'cloud-sleet'],
    61: ['Light rain', 'cloud-rain'], 63: ['Rain', 'cloud-rain'], 65: ['Heavy rain', 'cloud-rain-heavy'], 66: ['Freezing rain', 'cloud-sleet'],
    67: ['Freezing rain', 'cloud-sleet'], 71: ['Light snow', 'cloud-snow'], 73: ['Snow', 'cloud-snow'], 75: ['Heavy snow', 'snow'],
    77: ['Snow grains', 'cloud-snow'], 80: ['Rain showers', 'cloud-rain'], 81: ['Rain showers', 'cloud-rain'], 82: ['Heavy showers', 'cloud-rain-heavy'],
    85: ['Snow showers', 'cloud-snow'], 86: ['Snow showers', 'cloud-snow'], 95: ['Thunderstorm', 'cloud-lightning-rain'],
    96: ['Thunderstorm', 'cloud-lightning-rain'], 99: ['Thunderstorm', 'cloud-lightning-rain']
  };
  function wmo(c) { return WMO[c] || ['–', 'cloud']; }

  /* Country -> currency (the ones people actually travel to; the rest just shows the code) */
  var EURO = 'AT BE HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES AD MC SM VA ME XK'.split(' ');
  var CUR = { NO: 'NOK', SE: 'SEK', DK: 'DKK', IS: 'ISK', GB: 'GBP', CH: 'CHF', LI: 'CHF', PL: 'PLN', CZ: 'CZK', HU: 'HUF',
    RO: 'RON', BG: 'BGN', TR: 'TRY', US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', JP: 'JPY', CN: 'CNY', HK: 'HKD', KR: 'KRW',
    SG: 'SGD', TH: 'THB', MY: 'MYR', ID: 'IDR', PH: 'PHP', IN: 'INR', AU: 'AUD', NZ: 'NZD', ZA: 'ZAR', IL: 'ILS', AE: 'AED',
    MA: 'MAD', EG: 'EGP', RS: 'RSD', BA: 'BAM', AL: 'ALL', MK: 'MKD', GE: 'GEL', VN: 'VND', LK: 'LKR', TZ: 'TZS', KE: 'KES',
    AR: 'ARS', CL: 'CLP', PE: 'PEN', CO: 'COP', QA: 'QAR', JO: 'JOD', TN: 'TND', CV: 'CVE', GL: 'DKK', FO: 'DKK' };
  EURO.forEach(function (c) { CUR[c] = 'EUR'; });
  var EEA = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH'.split(' ');

  function cache(key, ms, make) {
    var k = 'dash.world.' + key, c = null;
    try { c = JSON.parse(sessionStorage.getItem(k)); } catch (e) {}
    if (c && Date.now() - c.at < ms) return Promise.resolve(c.v);
    return make().then(function (v) {
      try { sessionStorage.setItem(k, JSON.stringify({ at: Date.now(), v: v })); } catch (e) {}
      return v;
    });
  }
  function getJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(k, n) { var p = k.split('-'); return dkey(new Date(+p[0], p[1] - 1, +p[2] + n)); }

  /* ---------- places (cities) ---------- */
  function search(q) {
    q = String(q || '').trim();
    if (q.length < 2) return Promise.resolve([]);
    var name = q.split(',')[0].trim();
    return cache('geo.' + q.toLowerCase(), 864e5, function () {
      return getJSON('https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=' + encodeURIComponent(name))
        .then(function (j) {
          var hint = q.split(',').slice(1).join(',').trim().toLowerCase();
          return (j.results || []).filter(function (r) {
            return !hint || (r.country || '').toLowerCase().indexOf(hint) === 0 || (r.admin1 || '').toLowerCase().indexOf(hint) === 0 || (r.country_code || '').toLowerCase() === hint;
          }).slice(0, 6).map(function (r) {
            return { name: r.name, region: r.admin1 || '', country: r.country || '', cc: (r.country_code || '').toUpperCase(),
              lat: r.latitude, lon: r.longitude, tz: r.timezone || '' };
          });
        });
    });
  }

  /* ---------- weather for the trip days ---------- */
  /* Forecast for the days within the next 16, and last year's weather for the rest ("typical") */
  function weather(place, start, end) {
    if (!place || place.lat == null) return Promise.resolve({});
    var today = dkey(new Date()), lastFc = addDays(today, 15);
    var from = start < today ? today : start, to = end || start;
    if (to < today) return Promise.resolve({});
    if (addDays(from, 30) < to) to = addDays(from, 30);
    var base = 'latitude=' + place.lat + '&longitude=' + place.lon + '&timezone=auto';
    var jobs = [];
    if (from <= lastFc) {
      var fcTo = to < lastFc ? to : lastFc;
      jobs.push(cache('fc.' + place.lat + ',' + place.lon + '.' + from + '.' + fcTo, 3 * 3600e3, function () {
        return getJSON('https://api.open-meteo.com/v1/forecast?' + base + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
          '&start_date=' + from + '&end_date=' + fcTo).then(function (j) { return daily(j, 'forecast', 0); });
      }));
    }
    if (to > lastFc) {
      var a = from > lastFc ? from : addDays(lastFc, 1);
      var ly = function (k) { return (+k.slice(0, 4) - 1) + k.slice(4); };
      jobs.push(cache('ar.' + place.lat + ',' + place.lon + '.' + a + '.' + to, 7 * 864e5, function () {
        return getJSON('https://archive-api.open-meteo.com/v1/archive?' + base + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum' +
          '&start_date=' + ly(a) + '&end_date=' + ly(to)).then(function (j) { return daily(j, 'typical', 1); });
      }));
    }
    return Promise.all(jobs.map(function (p) { return p.catch(function () { return {}; }); }))
      .then(function (parts) { return Object.assign.apply(null, [{}].concat(parts)); });
  }
  function daily(j, kind, yearShift) {
    var d = j.daily || {}, out = {};
    (d.time || []).forEach(function (t, i) {
      var key = yearShift ? (+t.slice(0, 4) + yearShift) + t.slice(4) : t;
      out[key] = { code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], kind: kind,
        rain: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
        mm: d.precipitation_sum ? d.precipitation_sum[i] : null };
    });
    return out;
  }

  /* ---------- currency ---------- */
  function currencyOf(cc) { return CUR[String(cc || '').toUpperCase()] || null; }
  function rate(cur) {
    if (!cur || cur === 'NOK') return Promise.resolve(null);
    return cache('fx.' + cur, 6 * 3600e3, function () {
      return getJSON('https://api.frankfurter.app/latest?from=' + cur + '&to=NOK').then(function (j) {
        return j.rates && j.rates.NOK ? { cur: cur, nok: j.rates.NOK, date: j.date } : null;
      });
    }).catch(function () { return null; });
  }

  /* ---------- time ---------- */
  function offsetMin(tz, at) {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        .formatToParts(at || new Date()).forEach(function (x) { p[x.type] = x.value; });
      var d = at || new Date();
      return Math.round((Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes())) / 60000);
    } catch (e) { return null; }
  }
  function timeInfo(tz) {
    if (!tz) return null;
    var a = offsetMin(tz), b = offsetMin(HOME_TZ);
    if (a === null || b === null) return null;
    var diff = a - b, now;
    try { now = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }); } catch (e) { now = ''; }
    var h = Math.abs(diff) / 60, txt = diff === 0 ? 'same time as Oslo'
      : (h % 1 ? h.toFixed(1) : h) + ' h ' + (diff > 0 ? 'ahead of' : 'behind') + ' Oslo';
    return { now: now, diff: diff, text: txt };
  }

  /* ---------- address lookup for the map (OpenStreetMap Nominatim, max 1 per second) ---------- */
  var queue = Promise.resolve();
  function locate(q) {
    q = String(q || '').trim();
    if (!q) return Promise.resolve(null);
    return cache('loc.' + q.toLowerCase(), 30 * 864e5, function () {
      var job = queue.then(function () {
        return getJSON('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=en&q=' + encodeURIComponent(q))
          .then(function (l) { return l && l[0] ? { lat: +l[0].lat, lon: +l[0].lon } : null; });
      });
      queue = job.catch(function () {}).then(function () { return new Promise(function (r) { setTimeout(r, 1100); }); });
      return job;
    }).catch(function () { return null; });
  }

  /* ---------- maps (Leaflet, loaded on first use) ---------- */
  var leaflet = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leaflet) return leaflet;
    leaflet = new Promise(function (ok, fail) {
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      s.onload = function () { ok(window.L); };
      s.onerror = function () { leaflet = null; fail(new Error('map')); };
      document.head.appendChild(s);
    });
    return leaflet;
  }
  /* points: [{ lat, lon, label, n (number shown), color }] */
  function map(el, points, opts) {
    opts = opts || {};
    return loadLeaflet().then(function (L) {
      if (el._map) { el._map.remove(); el._map = null; }
      var dark = document.documentElement.getAttribute('data-theme') !== 'light';
      var m = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, worldCopyJump: true });
      /* Esri's grey canvas maps (free, no key): dark in dark mode, light in light mode */
      el.classList.toggle('map-dark', dark);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/' + (dark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base') + '/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors'
      }).addTo(m);
      var ll = [];
      points.forEach(function (p) {
        if (p.lat == null || p.lon == null) return;
        var icon = L.divIcon({ className: 'mk', html: '<span style="--c:' + (p.color || 'var(--accent)') + '">' + (p.n != null ? p.n : '') + '</span>', iconSize: [26, 26], iconAnchor: [13, 13] });
        L.marker([p.lat, p.lon], { icon: icon, title: p.label || '' }).addTo(m).bindPopup(p.label || '');
        ll.push([p.lat, p.lon]);
      });
      if (ll.length > 1) m.fitBounds(ll, { padding: [36, 36], maxZoom: opts.maxZoom || 14 });
      else if (ll.length) m.setView(ll[0], opts.zoom || 12);
      else m.setView([59.91, 10.75], 4);
      el._map = m;
      setTimeout(function () { m.invalidateSize(); }, 60);
      return m;
    });
  }

  /* ---------- a globe you can spin ----------
     Drawn on a canvas without any map library: the countries are painted once onto a flat
     (equirectangular) picture, and each frame the visible half of the sphere is sampled from it.
     The country outlines come from Natural Earth (world-atlas on jsdelivr, ~100 kB, fetched once). */
  var worldData = null, worldLoad = null;
  function loadWorld() {
    if (worldData) return Promise.resolve(worldData);
    if (worldLoad) return worldLoad;
    worldLoad = fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json').then(function (r) { return r.json(); })
      .then(function (topo) { worldData = topoCountries(topo); return worldData; })
      .catch(function (e) { worldLoad = null; throw e; });
    return worldLoad;
  }
  /* TopoJSON → [{ id, rings: [[[lon, lat], …], …] }] */
  function topoCountries(topo) {
    var t = topo.transform, arcs = topo.arcs.map(function (arc) {
      var x = 0, y = 0;
      return arc.map(function (d) { x += d[0]; y += d[1]; return t ? [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]] : [x, y]; });
    });
    function ring(idx) {
      var out = [];
      idx.forEach(function (i) { var a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; out = out.concat(out.length ? a.slice(1) : a); });
      return out;
    }
    return topo.objects.countries.geometries.map(function (g) {
      var polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
      return { id: String(g.id), rings: polys.map(function (p) { return ring(p[0]); }) };   // outer rings only (110m has no holes that matter)
    });
  }
  /* points: as for map(); opts.countries: ISO numeric codes to shade as visited */
  function globe(el, points, opts) {
    opts = opts || {};
    return loadWorld().then(function (countries) {
      if (el._map) { el._map.remove(); el._map = null; }
      if (el._globe) { el._globe.stop(); el._globe = null; }
      el.innerHTML = '';
      var cs = getComputedStyle(document.documentElement);
      var accent = cs.getPropertyValue('--accent').trim() || '#14b8a6', ink = cs.getPropertyValue('--ink-rgb').trim() || '255, 255, 255', bg = cs.getPropertyValue('--bg-solid').trim() || '#17181b';
      var been = {}; (opts.countries || []).forEach(function (c) { been[String(c)] = 1; });
      /* 1. the flat picture: 2048 × 1024 */
      var FW = 2048, FH = 1024, flat = document.createElement('canvas'); flat.width = FW; flat.height = FH;
      var fx = flat.getContext('2d');
      fx.fillStyle = 'rgba(0,0,0,0)'; fx.clearRect(0, 0, FW, FH);
      function fp(ll) { return [(ll[0] + 180) / 360 * FW, (90 - ll[1]) / 180 * FH]; }
      countries.forEach(function (c) {
        fx.beginPath();
        c.rings.forEach(function (r) { r.forEach(function (ll, i) { var q = fp(ll); if (i) fx.lineTo(q[0], q[1]); else fx.moveTo(q[0], q[1]); }); fx.closePath(); });
        fx.fillStyle = been[c.id] ? accent : 'rgba(' + ink + ', .2)';
        fx.fill();
        fx.strokeStyle = bg; fx.lineWidth = 1.2; fx.stroke();
      });
      var flatData = fx.getImageData(0, 0, FW, FH).data;
      /* 2. the sphere */
      var W = el.clientWidth || 600, H = el.clientHeight || 380, dpr = Math.min(2, window.devicePixelRatio || 1);
      var cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.className = 'globe';
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Globe with the places you have been');
      el.appendChild(cv);
      var ctx = cv.getContext('2d');
      var R = Math.min(W, H) / 2 - 10, cx = W / 2, cy = H / 2;
      var pts = points.filter(function (p) { return p.lat != null && p.lon != null; });
      var lon0 = pts.length ? pts[0].lon : 10, lat0 = pts.length ? pts[0].lat * .6 : 40;   // what faces you first
      var sphere = ctx.createImageData(Math.ceil(R * 2 * dpr), Math.ceil(R * 2 * dpr)), SW = sphere.width;
      var accentRGB = (function () { var m = (cs.getPropertyValue('--accent-rgb').trim() || '20, 184, 166').split(',').map(Number); return m; })();
      function render() {
        var d = sphere.data, lam0 = lon0 * Math.PI / 180, phi0 = lat0 * Math.PI / 180, sp0 = Math.sin(phi0), cp0 = Math.cos(phi0);
        var Rp = R * dpr, size = SW;
        for (var yy = 0; yy < size; yy++) {
          var y = (size / 2 - yy) / Rp;
          for (var xx = 0; xx < size; xx++) {
            var x = (xx - size / 2) / Rp, o = (yy * size + xx) * 4, rho2 = x * x + y * y;
            if (rho2 > 1) { d[o + 3] = 0; continue; }
            var rho = Math.sqrt(rho2), c = Math.asin(rho), sc = Math.sin(c), cc = Math.cos(c);
            var phi = rho ? Math.asin(cc * sp0 + y * sc * cp0 / rho) : phi0;
            var lam = lam0 + (rho ? Math.atan2(x * sc, rho * cp0 * cc - y * sp0 * sc) : 0);
            var u = ((lam * 180 / Math.PI + 540) % 360) * FW / 360, v = (90 - phi * 180 / Math.PI) * FH / 180;
            var fo = ((Math.min(FH - 1, v | 0)) * FW + (u | 0)) * 4, a = flatData[fo + 3];
            var shade = 0.75 + 0.25 * cc;                              // a little darker towards the edge
            if (a) { d[o] = flatData[fo] * shade; d[o + 1] = flatData[fo + 1] * shade; d[o + 2] = flatData[fo + 2] * shade; d[o + 3] = a; }
            else { d[o] = accentRGB[0]; d[o + 1] = accentRGB[1]; d[o + 2] = accentRGB[2]; d[o + 3] = 22 + 16 * (1 - cc); }
          }
        }
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.putImageData(sphere, Math.round((cx - R) * dpr), Math.round((cy - R) * dpr));
        /* outline and markers */
        ctx.save(); ctx.scale(dpr, dpr);
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(' + ink + ', .18)'; ctx.lineWidth = 1; ctx.stroke();
        pts.forEach(function (p) {
          var lam = p.lon * Math.PI / 180, phi = p.lat * Math.PI / 180;
          var cosc = sp0 * Math.sin(phi) + cp0 * Math.cos(phi) * Math.cos(lam - lam0);
          if (cosc < 0.02) return;
          var x = cx + R * Math.cos(phi) * Math.sin(lam - lam0), y = cy - R * (cp0 * Math.sin(phi) - sp0 * Math.cos(phi) * Math.cos(lam - lam0));
          ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = p.color && p.color.charAt(0) === '#' ? p.color : accent; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = bg; ctx.stroke();
        });
        ctx.restore();
      }
      render();
      /* a slow turn, and drag to spin it yourself */
      var spinning = !document.documentElement.classList.contains('mo-off'), raf = null, last = performance.now(), alive = true;
      function tick(t) { if (!alive) return; if (spinning) { lon0 += (t - last) * 0.004; render(); } last = t; raf = requestAnimationFrame(tick); }
      raf = requestAnimationFrame(tick);
      var drag = null, resume = null;
      cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, lon: lon0, lat: lat0 }; spinning = false; clearTimeout(resume); cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', function (e) {
        if (!drag) return;
        lon0 = drag.lon + (e.clientX - drag.x) * 0.5; lat0 = Math.max(-80, Math.min(80, drag.lat + (e.clientY - drag.y) * 0.5)); render();
      });
      function up() { if (!drag) return; drag = null; resume = setTimeout(function () { spinning = true; }, 4000); }
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      el._globe = { stop: function () { alive = false; cancelAnimationFrame(raf); } };
      return el._globe;
    });
  }

  function osmLink(p) { return 'https://www.openstreetmap.org/?mlat=' + p.lat + '&mlon=' + p.lon + '#map=12/' + p.lat + '/' + p.lon; }
  function gmapsLink(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  /* Google Flights, filled in: from your city to the destination on the trip dates, prices in NOK */
  function homeCity() { try { return (JSON.parse(localStorage.getItem('dash.profile')) || {}).city || 'Oslo'; } catch (e) { return 'Oslo'; } }
  function flightsLink(to, start, end, from) {
    var q = 'Flights from ' + (from || homeCity()) + ' to ' + to + (start ? ' on ' + start : '') + (end && end !== start ? ' through ' + end : start ? ' one way' : '');
    return 'https://www.google.com/travel/flights?hl=en&curr=NOK&q=' + encodeURIComponent(q);
  }
  function exploreLink() { return 'https://www.google.com/travel/explore?hl=en&curr=NOK&q=' + encodeURIComponent('Flights from ' + homeCity()); }

  window.World = {
    search: search, weather: weather, wmo: wmo, currencyOf: currencyOf, rate: rate, timeInfo: timeInfo,
    locate: locate, map: map, globe: globe, osmLink: osmLink, gmapsLink: gmapsLink, flightsLink: flightsLink, exploreLink: exploreLink, homeCity: homeCity,
    inEEA: function (cc) { return EEA.indexOf(String(cc || '').toUpperCase()) > -1; },
    abroad: function (cc) { return !!cc && String(cc).toUpperCase() !== 'NO'; },
    addDays: addDays
  };
})();
} catch (e) { console.error("travel/world.js", e); }
/* ===== flow.js ===== */
try {
/* Flow: small hand-offs between the parts of the dashboard.
   - route():    open the journey planner with a destination and "arrive by" time
   - addEvent(): put something in your calendar
   - logSpend(): put a cost in Finances (needs the vault to be unlocked)
   - travel():   trips, saved places and recent journeys ("dash.travel", synced)
   - leaveBy():  when to leave home to reach a place on time (Entur) */
(function () {
  "use strict";

  var TRAVEL_COLOR = '#0891b2';
  var TYPES = {
    flight: { name: 'Flight', icon: 'airplane', buffer: 90, move: true },
    train: { name: 'Train', icon: 'train-front', buffer: 10, move: true },
    bus: { name: 'Bus', icon: 'bus-front', buffer: 10, move: true },
    boat: { name: 'Ferry', icon: 'water', buffer: 30, move: true },
    car: { name: 'Car', icon: 'car-front', buffer: 10, move: true },
    hotel: { name: 'Stay', icon: 'building', buffer: 0 },
    activity: { name: 'Activity', icon: 'ticket-perforated', buffer: 10 },
    other: { name: 'Other', icon: 'pin-map', buffer: 10 }
  };

  var DOCS = {
    passport: { name: 'Passport', icon: 'passport' }, id: { name: 'National ID', icon: 'person-vcard' },
    ehic: { name: 'EU health card', icon: 'heart-pulse' }, insurance: { name: 'Travel insurance', icon: 'shield-check' },
    license: { name: 'Driving licence', icon: 'car-front' }, visa: { name: 'Visa', icon: 'globe2' }, other: { name: 'Other', icon: 'file-earmark-text' }
  };

  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));      // lock.js puts it in the synced vault
  }

  /* ---------- trips, places, recent ---------- */
  function travel() {
    var t = readJSON('dash.travel');
    t = t && typeof t === 'object' ? t : {};
    t.recent = Array.isArray(t.recent) ? t.recent : [];
    t.trips = Array.isArray(t.trips) ? t.trips : [];
    t.places = t.places && typeof t.places === 'object' ? t.places : {};
    t.docs = Array.isArray(t.docs) ? t.docs : [];
    return t;
  }
  function saveTravel(t) {
    writeJSON('dash.travel', t);
    window.dispatchEvent(new Event('cal:change'));
    window.dispatchEvent(new Event('travel:change'));
  }

  /* A booking's start and end as dates (time optional) */
  function when(item) {
    if (!item || !/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')) return null;
    var p = item.date.split('-'), t = /^\d{2}:\d{2}$/.test(item.time || '') ? item.time.split(':') : null;
    var start = new Date(+p[0], p[1] - 1, +p[2], t ? +t[0] : 0, t ? +t[1] : 0);
    var end = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(item.endDate || '') || /^\d{2}:\d{2}$/.test(item.endTime || '')) {
      var q = (item.endDate || item.date).split('-'), u = /^\d{2}:\d{2}$/.test(item.endTime || '') ? item.endTime.split(':') : null;
      end = new Date(+q[0], q[1] - 1, +q[2], u ? +u[0] : (t ? +t[0] : 0), u ? +u[1] : (t ? +t[1] : 0));
      if (t && end <= start) end = new Date(end.getTime() + 864e5);     // lands after midnight
    }
    return { start: start, end: end, timed: !!t };
  }

  /* ---------- hand-offs ---------- */
  /* q: { to: place | toText, from: place | fromText, arriveBy: Date|ISO, departAt: Date|ISO,
          context: { title, note, cat } } */
  function route(q) {
    q = Object.assign({}, q);
    ['arriveBy', 'departAt'].forEach(function (k) { if (q[k] instanceof Date) q[k] = q[k].toISOString(); });
    try { sessionStorage.setItem('dash.tripQuery', JSON.stringify(q)); } catch (e) {}
    location.href = '/cmd/travel/';
  }

  function addEvent(e) {
    var d = readJSON('dash.calendar') || {};
    d.events = Array.isArray(d.events) ? d.events : [];
    var ev = Object.assign({ id: uid(), cat: 'life' }, e);
    d.events.push(ev);
    writeJSON('dash.calendar', d);
    window.dispatchEvent(new Event('cal:change'));
    return ev.id;
  }

  function logSpend(x) {
    if (!window.Vault || !window.Vault.get()) return false;
    var d = window.Vault.get();
    d.expenses = Array.isArray(d.expenses) ? d.expenses : [];
    var id = uid();
    d.expenses.push({ id: id, t: Date.now(), date: x.date || dkey(new Date()), amount: Math.round(x.amount * 100) / 100,
      cat: x.cat || 'travel', note: String(x.note || '').slice(0, 80) });
    window.Vault.save(d);
    return id;
  }
  function unlogSpend(id) {
    if (!id || !window.Vault || !window.Vault.get()) return;
    var d = window.Vault.get();
    d.expenses = (d.expenses || []).filter(function (e) { return e.id !== id; });
    window.Vault.save(d);
  }

  /* ---------- "leave by" for a place and a time ---------- */
  var LB_KEY = 'dash.leaveBy';
  function leaveBy(placeText, arrive, home) {
    if (!window.Places || !home || !placeText) return Promise.resolve(null);
    var key = home.name + '|' + placeText + '|' + new Date(arrive).toISOString();
    var cache = {};
    try { cache = JSON.parse(sessionStorage.getItem(LB_KEY)) || {}; } catch (e) {}
    var c = cache[key];
    if (c && Date.now() - c.at < 10 * 60e3) return Promise.resolve(c.r);
    return window.Places.search(placeText, { limit: 1 }).then(function (list) {
      var to = list && list[0];
      if (!to) return null;
      return window.Places.trips(home, to, { time: new Date(arrive).toISOString(), arriveBy: true }).then(function (t) {
        var best = (t.tripPatterns || []).filter(function (p) { return new Date(p.expectedEndTime) <= new Date(arrive); })
          .sort(function (a, b) { return new Date(b.expectedStartTime) - new Date(a.expectedStartTime); })[0];
        if (!best) return null;
        var rides = (best.legs || []).filter(function (l) { return l.mode !== 'foot'; });
        var r = { leave: best.expectedStartTime, arrive: best.expectedEndTime, minutes: Math.round(best.duration / 60), to: to,
          lines: rides.map(function (l) { return (l.line && l.line.publicCode) || ''; }).filter(Boolean).slice(0, 3) };
        cache[key] = { at: Date.now(), r: r };
        try { sessionStorage.setItem(LB_KEY, JSON.stringify(cache)); } catch (e) {}
        return r;
      });
    }).catch(function () { return null; });
  }

  window.Flow = {
    TRAVEL_COLOR: TRAVEL_COLOR, TYPES: TYPES, DOCS: DOCS,
    travel: travel, saveTravel: saveTravel, when: when,
    route: route, addEvent: addEvent, logSpend: logSpend, unlogSpend: unlogSpend, leaveBy: leaveBy,
    uid: uid, dkey: dkey, hm: hm
  };
})();
} catch (e) { console.error("flow.js", e); }
/* ===== calendar/cal-core.js ===== */
try {
/* Calendar engine, shared by the calendar page and the dashboard card.
   - Your own events live in "dash.calendar" and are synced in the encrypted vault.
   - Phone calendars (iCloud, Google, Outlook links) are read through the Worker
     (/cmd/api/calendar) and shown read-only. The links are kept in the vault too. */
(function () {
  "use strict";

  var KEY = 'dash.calendar';
  var API = '/cmd/api/calendar';
  var FRESH_MS = 10 * 60 * 1000;
  /* Your categories (Calendar settings). These are the defaults; "Life" from before became "Personal". */
  var DEFAULT_CATS = [
    { id: 'work', name: 'Work', color: '#3987e5' },
    { id: 'study', name: 'Study', color: '#8a6fdf' },
    { id: 'training', name: 'Training', color: '#d55181' },
    { id: 'social', name: 'Social', color: '#e8743b' },
    { id: 'personal', name: 'Personal', color: '#22b35e' }
  ];
  var CATS = {};                 // id → {name, color}, kept up to date by load()
  var CAT_ORDER = [];
  function setCats(list) {
    Object.keys(CATS).forEach(function (k) { delete CATS[k]; });
    CAT_ORDER.length = 0;
    list.forEach(function (c) { CATS[c.id] = { name: c.name, color: c.color }; CAT_ORDER.push(c.id); });
  }
  setCats(DEFAULT_CATS);
  function catOf(id) {
    if (CATS[id]) return id;
    if (id === 'life' && CATS.personal) return 'personal';
    return CATS.personal ? 'personal' : CAT_ORDER[CAT_ORDER.length - 1];
  }
  var HOLIDAY_COLOR = '#e66767';
  var PREFS = { weekNums: true, holidays: true, view: 'last', dur: 60, cat: 'last', dayStart: 7, cardHide: {} };
  function prefs(d) {
    var p = (d || load()).prefs || {}, out = {};
    Object.keys(PREFS).forEach(function (k) { out[k] = p[k] == null ? PREFS[k] : p[k]; });
    if (!out.cardHide || typeof out.cardHide !== 'object') out.cardHide = {};
    return out;
  }
  /* ISO week number (uke) */
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var n = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - n);
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  }
  var FEED_COLORS = ['#e8743b', '#d55181', '#14b8a6', '#c9a227', '#7a8794'];
  var WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function day0(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds()); }
  function monday(d) { var x = day0(d); return addDays(x, -((x.getDay() + 6) % 7)); }
  function occKey(d) { return dkey(d) + 'T' + hm(d); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- your own events ---------- */
  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    d = d && typeof d === 'object' ? d : {};
    d.events = Array.isArray(d.events) ? d.events : [];
    d.feeds = Array.isArray(d.feeds) ? d.feeds : [];
    d.hidden = d.hidden && typeof d.hidden === 'object' ? d.hidden : {};
    var ok = Array.isArray(d.cats) && d.cats.length && d.cats.every(function (c) { return c && c.id && c.name && /^#[0-9a-f]{6}$/i.test(c.color || ''); });
    setCats(ok ? d.cats : DEFAULT_CATS);
    if (d.hidden.life && !CATS.life) { d.hidden.personal = 1; delete d.hidden.life; }
    return d;
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));      // lock.js puts it in the synced vault
    window.dispatchEvent(new Event('cal:change'));
  }

  var REPEATS = {
    '': null,
    daily: { freq: 'DAILY', interval: 1 },
    weekdays: { freq: 'WEEKLY', interval: 1, byday: [1, 2, 3, 4, 5].map(function (w) { return { wd: w, n: 0 }; }) },
    weekly: { freq: 'WEEKLY', interval: 1 },
    '2weeks': { freq: 'WEEKLY', interval: 2 },
    monthly: { freq: 'MONTHLY', interval: 1 },
    quarterly: { freq: 'MONTHLY', interval: 3 },
    yearly: { freq: 'YEARLY', interval: 1 }
  };
  var REPEAT_NAMES = { '': 'Never', daily: 'Every day', weekdays: 'Every weekday (Mon–Fri)', weekly: 'Every week', '2weeks': 'Every 2 weeks', monthly: 'Every month', quarterly: 'Every 3 months', yearly: 'Every year' };

  /* Turns a stored event into the common shape used for both sources */
  function fromOwn(e) {
    var base = fromKey(e.date);
    var ev = { id: e.id, own: e, title: e.title || 'Untitled', cat: catOf(e.cat), allDay: !!e.allDay,
               location: e.location || '', notes: e.notes || '', exDays: {} };
    ev.color = CATS[ev.cat].color;
    if (ev.allDay) {
      ev.start = base;
      var end = e.end ? fromKey(e.end) : base;
      ev.days = Math.max(1, Math.round((day0(end) - base) / 864e5) + 1);
    } else {
      var a = String(e.start || '09:00').split(':'), b = String(e.stop || '').split(':');
      ev.start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), +a[0] || 0, +a[1] || 0);
      var stop = b.length === 2 ? new Date(base.getFullYear(), base.getMonth(), base.getDate(), +b[0] || 0, +b[1] || 0) : null;
      if (!stop || stop <= ev.start) stop = stop && stop < ev.start ? addDays(stop, 1) : new Date(ev.start.getTime() + 3600e3);
      ev.dur = stop - ev.start;
    }
    var r = REPEATS[e.repeat || ''];
    if (r) {
      ev.rule = Object.assign({}, r, { clamp: true });
      if (e.until) { var u = fromKey(e.until); ev.rule.until = new Date(u.getFullYear(), u.getMonth(), u.getDate(), 23, 59, 59); }
    }
    (e.skip || []).forEach(function (k) { ev.exDays[k] = 1; });
    return ev;
  }

  /* ---------- repeats (RFC 5545 subset: the rules phones actually use) ---------- */
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function monthDays(y, m, r, s0) {
    var dim = daysInMonth(y, m), out = [];
    if (r.bymonthday) {
      r.bymonthday.forEach(function (n) { var d = n > 0 ? n : dim + 1 + n; if (d >= 1 && d <= dim) out.push(d); });
    } else if (r.byday && r.byday.length) {
      r.byday.forEach(function (b) {
        var first = (b.wd - new Date(y, m, 1).getDay() + 7) % 7 + 1, all = [];
        for (var d = first; d <= dim; d += 7) all.push(d);
        if (!b.n) out = out.concat(all);
        else { var pick = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (pick) out.push(pick); }
      });
    } else if (s0.getDate() <= dim) out.push(s0.getDate());
    else if (r.clamp) out.push(dim);                    // your own "every month" on the 31st: last day
    out = out.filter(function (d, i) { return out.indexOf(d) === i; }).sort(function (a, b) { return a - b; });
    if (r.setpos && out.length) {
      out = r.setpos.map(function (p) { return p > 0 ? out[p - 1] : out[out.length + p]; }).filter(Boolean);
    }
    return out;
  }

  /* Start times of every occurrence of ev that overlaps [from, to) */
  function expand(ev, from, to) {
    var out = [], s0 = ev.start, r = ev.rule;
    function endOf(s) { return ev.allDay ? addDays(day0(s), ev.days || 1) : new Date(s.getTime() + (ev.dur || 0)); }
    function take(s) {
      if (ev.exDays && ev.exDays[dkey(s)]) return;
      if (ev.exTimes && ev.exTimes[occKey(s)]) return;
      var e = endOf(s);
      if ((e > from || (+e === +s && s >= from)) && s < to) out.push(s);
    }
    if (!r) { take(s0); return out; }

    var n = 0, count = r.count || Infinity, until = r.until, iv = r.interval || 1, guard = 0, stop = false;
    var H = s0.getHours(), M = s0.getMinutes(), S = s0.getSeconds();
    function at(y, m, d) { return new Date(y, m, d, H, M, S); }
    function emit(s) {
      if (s < s0) return;
      if ((until && s > until) || n >= count || s >= to) { stop = true; return; }
      n++; take(s);
    }
    /* Without a count we can jump close to the window instead of walking from the start */
    var lookBack = ev.allDay ? (ev.days || 1) : Math.ceil((ev.dur || 0) / 864e5) + 1;
    var jumpTo = !r.count && from > s0 ? addDays(day0(from), -lookBack - 1) : null;

    if (r.freq === 'DAILY') {
      var d = day0(s0);
      if (jumpTo) { var k = Math.floor((jumpTo - d) / (864e5 * iv)); if (k > 0) d = addDays(d, k * iv); }
      for (; !stop && guard++ < 40000; d = addDays(d, iv)) {
        if (r.byday && !r.byday.some(function (b) { return b.wd === d.getDay(); })) continue;
        if (r.bymonth && r.bymonth.indexOf(d.getMonth()) < 0) continue;
        emit(at(d.getFullYear(), d.getMonth(), d.getDate()));
      }
    } else if (r.freq === 'WEEKLY') {
      var wds = (r.byday && r.byday.length ? r.byday.map(function (b) { return b.wd; }) : [s0.getDay()])
        .map(function (w) { return (w + 6) % 7; }).sort();
      var w = monday(s0);
      if (jumpTo) { var kw = Math.floor((monday(jumpTo) - w) / (7 * 864e5 * iv)); if (kw > 0) w = addDays(w, kw * 7 * iv); }
      for (; !stop && guard++ < 6000; w = addDays(w, 7 * iv)) {
        for (var i = 0; i < wds.length && !stop; i++) emit(at(w.getFullYear(), w.getMonth(), w.getDate() + wds[i]));
      }
    } else if (r.freq === 'MONTHLY') {
      for (var mi = 0; !stop && guard++ < 2400; mi += iv) {
        var first = new Date(s0.getFullYear(), s0.getMonth() + mi, 1);
        if (first >= to) break;
        var ds = monthDays(first.getFullYear(), first.getMonth(), r, s0);
        for (var j = 0; j < ds.length && !stop; j++) emit(at(first.getFullYear(), first.getMonth(), ds[j]));
      }
    } else if (r.freq === 'YEARLY') {
      var months = r.bymonth && r.bymonth.length ? r.bymonth.slice().sort(function (a, b) { return a - b; }) : [s0.getMonth()];
      for (var yi = 0; !stop && guard++ < 400; yi += iv) {
        var y = s0.getFullYear() + yi;
        if (new Date(y, 0, 1) >= to) break;
        for (var q = 0; q < months.length && !stop; q++) {
          var mdays = monthDays(y, months[q], r, s0);
          for (var z = 0; z < mdays.length && !stop; z++) emit(at(y, months[q], mdays[z]));
        }
      }
    }
    return out;
  }

  /* ---------- phone calendar files (.ics) ---------- */
  var WIN_TZ = {
    'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris',
    'Central Europe Standard Time': 'Europe/Budapest', 'Central European Standard Time': 'Europe/Warsaw',
    'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
    'FLE Standard Time': 'Europe/Helsinki', 'E. Europe Standard Time': 'Europe/Chisinau',
    'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago',
    'Pacific Standard Time': 'America/Los_Angeles', 'UTC': 'UTC', 'Coordinated Universal Time': 'UTC'
  };
  var tzOk = {}, fmts = {};
  function tzName(raw) {
    var tz = String(raw || '').replace(/^"|"$/g, '').replace(/^\/[^/]*\/[^/]*\//, '');   // also "/mozilla.org/20050126_1/Europe/Oslo"
    tz = WIN_TZ[tz] || tz;
    if (!(tz in tzOk)) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); tzOk[tz] = true; } catch (e) { tzOk[tz] = false; } }
    return tzOk[tz] ? tz : null;
  }
  function tzOffset(ms, tz) {
    var f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    var p = {};
    f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
  }
  function parseDT(v, params) {
    var m = String(v || '').trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
    if (!m) return null;
    var Y = +m[1], Mo = m[2] - 1, D = +m[3];
    if (!m[4]) return { d: new Date(Y, Mo, D), allDay: true };
    var h = +m[4], mi = +m[5], s = +(m[6] || 0);
    if (m[7]) return { d: new Date(Date.UTC(Y, Mo, D, h, mi, s)), allDay: false };
    var tz = params && params.TZID ? tzName(params.TZID) : null;
    if (tz) {
      var g = Date.UTC(Y, Mo, D, h, mi, s), t = g - tzOffset(g, tz);
      t = g - tzOffset(t, tz);
      return { d: new Date(t), allDay: false };
    }
    return { d: new Date(Y, Mo, D, h, mi, s), allDay: false };
  }
  function parseDuration(v) {
    var m = String(v || '').match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!m) return 0;
    var ms = (((+m[2] || 0) * 7 + (+m[3] || 0)) * 86400 + (+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000;
    return m[1] === '-' ? -ms : ms;
  }
  function parseRule(v) {
    var r = {};
    String(v).split(';').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) r[kv.slice(0, i).toUpperCase()] = kv.slice(i + 1); });
    if (!/^(DAILY|WEEKLY|MONTHLY|YEARLY)$/.test(r.FREQ)) return null;
    var out = { freq: r.FREQ, interval: Math.max(1, +r.INTERVAL || 1) };
    if (r.COUNT) out.count = +r.COUNT;
    if (r.UNTIL) {
      var u = parseDT(r.UNTIL, {});
      if (u) out.until = u.allDay ? new Date(u.d.getFullYear(), u.d.getMonth(), u.d.getDate(), 23, 59, 59) : u.d;
    }
    if (r.BYDAY) out.byday = r.BYDAY.split(',').map(function (x) {
      var m = x.trim().match(/^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/);
      return m ? { n: +(m[1] || 0), wd: WD.indexOf(m[2]) } : null;
    }).filter(Boolean);
    if (r.BYMONTHDAY) out.bymonthday = r.BYMONTHDAY.split(',').map(Number).filter(Boolean);
    if (r.BYMONTH) out.bymonth = r.BYMONTH.split(',').map(function (n) { return n - 1; });
    if (r.BYSETPOS) out.setpos = r.BYSETPOS.split(',').map(Number).filter(Boolean);
    return out;
  }
  function unescapeText(s) {
    return String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  }

  function parseICS(text, feed) {
    var lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    var raw = [], cur = null, depth = 0;
    lines.forEach(function (line) {
      if (/^BEGIN:VEVENT$/i.test(line)) { cur = { p: {}, ex: [] }; depth = 0; return; }
      if (!cur) return;
      if (/^END:VEVENT$/i.test(line)) { raw.push(cur); cur = null; return; }
      if (/^BEGIN:/i.test(line)) { depth++; return; }           // VALARM and friends
      if (/^END:/i.test(line)) { depth--; return; }
      if (depth > 0) return;
      var m = line.match(/^([A-Za-z0-9-]+)((?:;[^:;=]+=(?:"[^"]*"|[^:;]*))*):([\s\S]*)$/);
      if (!m) return;
      var name = m[1].toUpperCase(), params = {};
      (m[2].match(/;[^:;=]+=(?:"[^"]*"|[^:;]*)/g) || []).forEach(function (kv) {
        var i = kv.indexOf('='); params[kv.slice(1, i).toUpperCase()] = kv.slice(i + 1).replace(/^"|"$/g, '');
      });
      if (name === 'EXDATE') cur.ex.push({ v: m[3], params: params });
      else cur.p[name] = { v: m[3], params: params };
    });

    var events = [], masters = {}, overrides = [];
    raw.forEach(function (x, i) {
      var P = x.p;
      if (!P.DTSTART) return;
      var st = parseDT(P.DTSTART.v, P.DTSTART.params);
      if (!st) return;
      var allDay = st.allDay || (P.DTSTART.params.VALUE || '').toUpperCase() === 'DATE';
      var ev = {
        id: feed.id + ':' + (P.UID ? P.UID.v : i) + (P['RECURRENCE-ID'] ? ':' + P['RECURRENCE-ID'].v : ''),
        title: unescapeText(P.SUMMARY ? P.SUMMARY.v : '') || 'Busy',
        location: unescapeText(P.LOCATION ? P.LOCATION.v : ''),
        notes: unescapeText(P.DESCRIPTION ? P.DESCRIPTION.v : '').slice(0, 2000),
        allDay: allDay, start: allDay ? day0(st.d) : st.d, color: feed.color, feed: feed.id, src: feed.name, readOnly: true,
        exDays: {}, exTimes: {}, cancelled: P.STATUS && /CANCELLED/i.test(P.STATUS.v)
      };
      var en = P.DTEND ? parseDT(P.DTEND.v, P.DTEND.params) : null;
      var dur = P.DURATION ? parseDuration(P.DURATION.v) : null;
      if (allDay) {
        var endD = en ? day0(en.d) : (dur ? addDays(ev.start, Math.round(dur / 864e5)) : addDays(ev.start, 1));
        ev.days = Math.max(1, Math.round((endD - ev.start) / 864e5));
      } else {
        ev.dur = Math.max(0, en ? en.d - ev.start : (dur || 0));
      }
      if (P.RRULE) ev.rule = parseRule(P.RRULE.v);
      x.ex.forEach(function (e) {
        e.v.split(',').forEach(function (v) {
          var t = parseDT(v, e.params);
          if (!t) return;
          if (t.allDay || allDay) ev.exDays[dkey(t.d)] = 1; else ev.exTimes[occKey(t.d)] = 1;
        });
      });
      if (P['RECURRENCE-ID']) {
        var rid = parseDT(P['RECURRENCE-ID'].v, P['RECURRENCE-ID'].params);
        if (rid) overrides.push({ uid: P.UID ? P.UID.v : '', rid: rid, ev: ev });
        return;
      }
      if (ev.cancelled) return;
      if (P.UID) masters[P.UID.v] = ev;
      events.push(ev);
    });
    /* A moved or cancelled single occurrence replaces that day in the series */
    overrides.forEach(function (o) {
      var m = masters[o.uid];
      if (m) { if (o.rid.allDay || m.allDay) m.exDays[dkey(o.rid.d)] = 1; else m.exTimes[occKey(o.rid.d)] = 1; }
      if (!o.ev.cancelled) { delete o.ev.rule; events.push(o.ev); }
    });
    return events;
  }

  /* ---------- fetching phone calendars ---------- */
  var feedState = {};          // id -> { events, at, error, loading }
  function cacheKey(id) { return 'dash.calfeed.' + id; }
  function fromCache(f) {
    if (feedState[f.id]) return feedState[f.id];
    var c = null;
    try { c = JSON.parse(sessionStorage.getItem(cacheKey(f.id))); } catch (e) {}
    if (c && c.url === f.url && c.text) {
      feedState[f.id] = { events: parseICS(c.text, f), at: c.at };
      return feedState[f.id];
    }
    return null;
  }
  var ERRORS = {
    'unsupported link': 'This isn’t an iCloud, Google or Outlook calendar link.',
    'not a link': 'That doesn’t look like a link.',
    'calendar not found': 'The calendar wasn’t found. The link may have been turned off or changed.',
    'not a calendar': 'The link didn’t return a calendar.',
    'not found': 'Update the Worker code to use phone calendars.',
    'unauthorized': 'Not signed in. Reload the page.'
  };
  function fetchFeed(f) {
    var st = feedState[f.id] = feedState[f.id] || {};
    st.loading = true;
    return fetch(API, { method: 'POST', cache: 'no-store', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: f.url }) })
      .then(function (r) {
        if (r.ok) return r.text();
        return r.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(ERRORS[j.error] || (j.error ? 'Couldn’t load it (' + j.error + ').' : 'Couldn’t load it (' + r.status + ').'));
        });
      })
      .then(function (text) {
        st.events = parseICS(text, f); st.at = Date.now(); st.error = ''; st.loading = false;
        try { sessionStorage.setItem(cacheKey(f.id), JSON.stringify({ url: f.url, at: st.at, text: text })); } catch (e) {}
      })
      .catch(function (e) {
        st.loading = false;
        st.error = e && e.message && !/fetch|network/i.test(e.message) ? e.message : 'No connection to the calendar right now.';
      });
  }
  function refreshFeeds(force) {
    var d = load();
    var jobs = d.feeds.map(function (f) {
      var c = fromCache(f);
      if (!force && c && c.at && Date.now() - c.at < FRESH_MS) return null;
      return fetchFeed(f);
    }).filter(Boolean);
    if (!jobs.length) return Promise.resolve();
    window.dispatchEvent(new Event('cal:change'));
    return Promise.all(jobs).then(function () { window.dispatchEvent(new Event('cal:change')); });
  }
  function clearFeeds() {
    feedState = {};
    try {
      Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('dash.calfeed.') === 0) sessionStorage.removeItem(k); });
    } catch (e) {}
  }

  /* ---------- trips and bookings from the Travel page ---------- */
  function travelEvents() {
    if (!window.Flow) return [];
    var F = window.Flow, out = [];
    F.travel().trips.forEach(function (tr) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(tr.start || '')) {
        var s = fromKey(tr.start), e = tr.end && tr.end >= tr.start ? fromKey(tr.end) : s;
        out.push({ id: 'trip:' + tr.id, title: tr.name || tr.dest || 'Trip', allDay: true, start: s,
          days: Math.round((e - s) / 864e5) + 1, color: F.TRAVEL_COLOR, readOnly: true, trip: tr.id,
          location: '', notes: tr.dest ? 'Trip to ' + tr.dest : '', exDays: {} });
      }
      (tr.items || []).forEach(function (it) {
        var w = F.when(it), T = F.TYPES[it.type] || F.TYPES.other;
        if (!w) return;
        var title = it.title || T.name;
        if (T.move && it.from && it.to) title += ' · ' + it.from + ' → ' + it.to;
        var ev = { id: 'trip:' + tr.id + ':' + it.id, title: title, color: F.TRAVEL_COLOR, readOnly: true, trip: tr.id, item: it,
          location: it.from || it.to || '', notes: it.ref ? 'Booking reference: ' + it.ref : '', exDays: {}, buffer: T.buffer };
        if (w.timed) { ev.allDay = false; ev.start = w.start; ev.dur = w.end ? w.end - w.start : 3600e3; }
        else { ev.allDay = true; ev.start = w.start; ev.days = 1; }
        out.push(ev);
        /* online check-in opens 24 h before a flight */
        if (it.type === 'flight' && w.timed && !(tr.done && tr.done['checkin:' + it.id])) {
          out.push({ id: ev.id + ':checkin', title: 'Check-in opens: ' + (it.title || 'flight'), color: F.TRAVEL_COLOR, readOnly: true,
            trip: tr.id, allDay: false, start: new Date(w.start.getTime() - 864e5), dur: 15 * 60e3, location: '',
            notes: 'Check in online for ' + (it.title || 'your flight') + (it.ref ? ' (booking reference ' + it.ref + ')' : '') + '.', exDays: {} });
        }
      });
    });
    /* travel documents: the expiry date, and a reminder to renew */
    F.travel().docs.forEach(function (d) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.expires || '')) return;
      var K = (F.DOCS[d.kind] || F.DOCS.other), name = d.name || K.name, exp = fromKey(d.expires);
      out.push({ id: 'doc:' + d.id, title: name + ' expires', allDay: true, start: exp, days: 1, color: F.TRAVEL_COLOR, readOnly: true,
        doc: d.id, location: '', notes: d.note || '', exDays: {} });
      var months = +d.remind || 6, rem = new Date(exp.getFullYear(), exp.getMonth() - months, exp.getDate());
      out.push({ id: 'doc:' + d.id + ':renew', title: 'Renew ' + name.charAt(0).toLowerCase() + name.slice(1), allDay: true, start: rem, days: 1,
        color: F.TRAVEL_COLOR, readOnly: true, doc: d.id, location: '',
        notes: name + ' expires ' + exp.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '.', exDays: {} });
    });
    return out;
  }

  /* ---------- everything in a time window ---------- */
  function occurrences(from, to, opts) {
    opts = opts || {};
    var d = load(), list = [];
    function add(ev) {
      expand(ev, from, to).forEach(function (s) {
        var end = ev.allDay ? addDays(day0(s), ev.days || 1) : new Date(s.getTime() + (ev.dur || 0));
        list.push({ ev: ev, start: s, end: end, allDay: ev.allDay, title: ev.title, color: ev.color, key: ev.id + '@' + occKey(s) });
      });
    }
    d.events.forEach(function (e) {
      var ev = fromOwn(e);
      if (!opts.all && d.hidden[ev.cat]) return;
      add(ev);
    });
    d.feeds.forEach(function (f) {
      if (!opts.all && d.hidden['feed:' + f.id]) return;
      var st = fromCache(f) || feedState[f.id];
      if (st && st.events) st.events.forEach(function (ev) { ev.color = f.color; ev.src = f.name; ev.feedId = f.id; add(ev); });
    });
    var Fe = window.Features;
    if ((opts.all || !d.hidden.travel) && (!Fe || Fe.on('travel'))) travelEvents().forEach(add);
    /* reminders from the tools in Settings → Features (renewals, warranties, certificates) */
    /* from your tools: workouts and courses go in their category, the rest under Reminders */
    if (Fe) Fe.events().forEach(function (ev) {
      if (ev.cat) {
        var cid = catOf(ev.cat);
        if (!opts.all && d.hidden[cid]) return;
        ev.color = CATS[cid].color;
      } else if (!opts.all && d.hidden.reminders) return;
      add(ev);
    });
    /* paydays from your budget (under Reminders) */
    var Bu = window.Budget, vault = window.Vault && window.Vault.get();
    if (Bu && vault && (!Fe || Fe.on('finance')) && (opts.all || !d.hidden.reminders)) Bu.paydays(vault, from, to).forEach(function (p) {
      add({ id: 'pay:' + p.date.getTime(), title: p.title, allDay: true, start: p.date, days: 1, color: '#11a597', readOnly: true, reminder: true,
        link: '/cmd/#fin', location: '', notes: (p.net ? 'About ' + Math.round(p.net).toLocaleString('nb-NO') + ' kr' + (p.row.note ? ' · ' + p.row.note : '') + '. ' : '') + 'From your budget on the dashboard.', exDays: {} });
    });
    /* Norwegian public holidays */
    var p = prefs(d);
    if (Fe && p.holidays && (opts.all || !d.hidden.holidays)) {
      for (var y = from.getFullYear(); y <= to.getFullYear(); y++) Fe.holidays(y).forEach(function (h) {
        add({ id: 'hol:' + h.date, title: h.name, allDay: true, start: fromKey(h.date), days: 1, color: HOLIDAY_COLOR, readOnly: true,
          holiday: true, location: '', notes: h.no + ' – a public holiday in Norway.', exDays: {} });
      });
    }
    if (opts.card) list = list.filter(function (o) {
      var ch = p.cardHide;
      if (o.ev.own) return !ch[o.ev.cat];
      if (o.ev.src) return !ch['feed:' + o.ev.feedId];
      if (o.ev.holiday) return !ch.holidays;
      if (o.ev.tool) return !ch[catOf(o.ev.cat)];
      if (o.ev.reminder) return !ch.reminders;
      return !ch.travel;
    });
    list.sort(function (a, b) {
      if (a.allDay !== b.allDay && dkey(a.start) === dkey(b.start)) return a.allDay ? -1 : 1;
      return a.start - b.start || b.end - a.end || (a.title > b.title ? 1 : -1);
    });
    return list;
  }

  /* ---------- small display helpers ---------- */
  function sameDay(a, b) { return dkey(a) === dkey(b); }
  function dayLabel(d, long) {
    var t = day0(new Date()), diff = Math.round((day0(d) - t) / 864e5);
    var date = d.toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
    if (diff === 0) return 'Today · ' + date;
    if (diff === 1) return 'Tomorrow · ' + date;
    if (diff === -1) return 'Yesterday · ' + date;
    return date;
  }
  function timeLabel(o, onDay) {
    if (o.allDay) return 'All day';
    var s = o.start, e = o.end;
    if (onDay && !sameDay(s, onDay)) return sameDay(e, onDay) ? 'Until ' + hm(e) : 'All day';
    return hm(s) + (o.end > o.start ? '–' + hm(e) : '');
  }

  window.Cal = {
    CATS: CATS, CAT_ORDER: CAT_ORDER, DEFAULT_CATS: DEFAULT_CATS, catOf: catOf, prefs: prefs, isoWeek: isoWeek, HOLIDAY_COLOR: HOLIDAY_COLOR, TRAVEL_COLOR: '#0891b2', FEED_COLORS: FEED_COLORS, REPEAT_NAMES: REPEAT_NAMES,
    load: load, save: save, uid: uid, esc: esc,
    occurrences: occurrences, expand: expand, fromOwn: fromOwn, parseICS: parseICS,
    refreshFeeds: refreshFeeds, fetchFeed: fetchFeed, clearFeeds: clearFeeds,
    feedState: function (id) { return feedState[id] || null; },
    dkey: dkey, hm: hm, fromKey: fromKey, day0: day0, addDays: addDays, monday: monday, sameDay: sameDay,
    dayLabel: dayLabel, timeLabel: timeLabel
  };

  if (window.Vault) window.Vault.onLock(clearFeeds);
})();
} catch (e) { console.error("calendar/cal-core.js", e); }
/* ===== travel/travel.js ===== */
try {
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
      return '<button type="button" class="tv-chip" data-r="' + i + '"><i class="bi bi-clock-history"></i>' + esc(x.from.name) + ' <i class="bi bi-arrow-right"></i> ' + esc(x.to.name) + '</button>';
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
} catch (e) { console.error("travel/travel.js", e); }
/* ===== travel/trips.js ===== */
try {
/* Travel page, part 2: trips and travel documents.
   A trip has four parts:
   - Overview: destination (weather, local time, currency), how far you've come, notes
   - Plan:     bookings or day by day, a map, and ideas for things to do
   - Prepare:  before-you-go checklist (documents, check-in, your own to-dos) and packing
   - Money:    costs vs budget (sent to Finances) and a currency converter
   Bookings, check-in and document expiry show up in the calendar; "Get there" opens Entur. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var F = window.Flow, C = window.Cal, W = window.World, esc = C.esc, T = F.TYPES, D = F.DOCS;
  var BASICS = ['Passport or ID', 'Phone charger', 'Wallet and cards', 'Headphones', 'Toothbrush', 'Medicine', 'Clothes for the days', 'Travel adapter'];
  var TODO_IDEAS = ['Buy an eSIM or check roaming prices', 'Download offline maps', 'Book transport to the airport', 'Ask someone to look after home', 'Set an out-of-office reply'];
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)); }
  function num(v) {
    var s = String(v || '').replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : null;
  }
  function today() { return F.dkey(new Date()); }
  function fmtD(k) { return new Date(k + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function fmt(k, o) { return C.fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }); }
  var openId = null, pane = 'overview', planView = 'list';
  try { planView = localStorage.getItem('dash.tpPlanView') || 'list'; } catch (e) {}

  function all() { return F.travel(); }
  function find(t, id) { return t.trips.filter(function (x) { return x.id === id; })[0] || null; }
  function current() { return openId ? find(all(), openId) : null; }
  function update(fn) {
    var t = all(), tr = find(t, openId);
    if (!tr) return;
    fn(tr, t);
    F.saveTravel(t);
  }
  function sortItems(items) {
    return items.slice().sort(function (a, b) { return (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1; });
  }
  function tripDays(tr) {
    var out = [], d = tr.start, end = tr.end || tr.start;
    for (var i = 0; d <= end && i < 60; i++) { out.push(d); d = W.addDays(d, 1); }
    return out;
  }
  function relDays(tr) {
    var n = Math.round((C.fromKey(tr.start) - C.day0(new Date())) / 864e5);
    var len = tripDays(tr).length;
    if ((tr.end || tr.start) < today()) {
      var ago = -Math.round((C.fromKey(tr.end || tr.start) - C.day0(new Date())) / 864e5);
      return ago < 14 ? ago + ' day' + (ago === 1 ? '' : 's') + ' ago' : ago < 60 ? Math.round(ago / 7) + ' weeks ago' : fmt(tr.start, { month: 'long', year: 'numeric' });
    }
    if (n <= 0) return 'Travelling now · day ' + (1 - n) + ' of ' + len;
    return (n === 1 ? 'Tomorrow' : 'In ' + n + ' days') + ' · ' + len + ' day' + (len > 1 ? 's' : '');
  }
  function planned(tr) { return (tr.items || []).reduce(function (a, it) { return a + (num(it.cost) || 0); }, 0) + (num(tr.spent) || 0); }
  function abroad(tr) { return tr.place ? W.abroad(tr.place.cc) : false; }

  /* ================= travel documents ================= */
  function docStatus(d, until) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.expires || '')) return { cls: 'none', text: 'No expiry date' };
    var td = today();
    if (d.expires < td) return { cls: 'bad', text: 'Expired ' + fmt(d.expires) };
    if (until && d.expires < until) return { cls: 'bad', text: 'Expires ' + fmt(d.expires) + ' – during the trip' };
    var exp = C.fromKey(d.expires), warnFrom = new Date(exp.getFullYear(), exp.getMonth() - (+d.remind || 6), exp.getDate());
    var months = Math.round((exp - new Date()) / (30.4 * 864e5));
    if (new Date() >= warnFrom) return { cls: 'warn', text: 'Expires in ' + (months <= 1 ? 'under a month' : months + ' months') + ' · ' + fmt(d.expires) };
    return { cls: 'ok', text: 'Valid until ' + fmt(d.expires, { month: 'short', year: 'numeric' }) };
  }
  function renderDocs() {
    var docs = all().docs.slice().sort(function (a, b) { return (a.expires || '9') < (b.expires || '9') ? -1 : 1; });
    $('docList').innerHTML = docs.map(function (d) {
      var K = D[d.kind] || D.other, st = docStatus(d);
      return '<li><button type="button" class="doc-row" data-doc="' + esc(d.id) + '"><span class="ic"><i class="bi bi-' + K.icon + '"></i></span>' +
        '<span class="x"><b>' + esc(d.name || K.name) + '</b><span class="st ' + st.cls + '">' + esc(st.text) + '</span></span><i class="bi bi-chevron-right"></i></button></li>';
    }).join('');
    $('docIntro').hidden = docs.length > 0;
  }
  /* What the documents mean for one trip */
  function docChecks(tr) {
    var out = [], docs = all().docs, end = tr.end || tr.start, cc = tr.place && tr.place.cc;
    if (!abroad(tr)) return out;
    var ids = docs.filter(function (d) { return d.kind === 'passport' || d.kind === 'id'; });
    var outsideEEA = !W.inEEA(cc);
    var pass = ids.filter(function (d) { return d.kind === 'passport'; });
    var best = (outsideEEA ? pass : ids).filter(function (d) { return docStatus(d, end).cls !== 'bad' && docStatus(d, end).cls !== 'none'; })[0];
    if (best) {
      var six = outsideEEA && best.expires < W.addDays(end, 182);
      out.push({ key: 'doc:pass', state: six ? 'warn' : 'ok', text: (D[best.kind] || D.other).name + ' is valid for the trip',
        sub: six ? 'Expires ' + fmt(best.expires) + '. Many countries outside Europe want 6 months left – check the entry rules.' : 'Valid until ' + fmt(best.expires), doc: best.id });
    } else {
      var bad = (outsideEEA ? pass : ids)[0];
      out.push({ key: 'doc:pass', state: 'bad', text: outsideEEA ? 'You need a passport for ' + tr.place.country : 'Bring a passport or national ID',
        sub: bad ? docStatus(bad, end).text : 'Add your passport under Travel documents to have it checked.', doc: bad ? bad.id : null, add: bad ? null : 'passport' });
    }
    var ins = docs.filter(function (d) { return d.kind === 'insurance'; })[0];
    out.push(ins && docStatus(ins, end).cls !== 'bad'
      ? { key: 'doc:ins', state: 'ok', text: 'Travel insurance', sub: docStatus(ins, end).text, doc: ins.id }
      : { key: 'doc:ins', state: 'todo', text: 'Travel insurance', sub: ins ? docStatus(ins, end).text : 'Add it under Travel documents (most bank cards include some cover).', doc: ins ? ins.id : null, add: ins ? null : 'insurance' });
    if (W.inEEA(cc)) {
      var ehic = docs.filter(function (d) { return d.kind === 'ehic'; })[0];
      out.push(ehic && docStatus(ehic, end).cls !== 'bad'
        ? { key: 'doc:ehic', state: 'ok', text: 'EU health card', sub: docStatus(ehic, end).text, doc: ehic.id }
        : { key: 'doc:ehic', state: 'todo', text: 'EU health card (Europeisk helsetrygdkort)', sub: ehic ? docStatus(ehic, end).text : 'Free from Helsenorge – covers necessary care in the EU/EEA.', doc: ehic ? ehic.id : null, add: ehic ? null : 'ehic' });
    }
    return out;
  }

  /* ================= list ================= */
  function card(tr) {
    var items = tr.items || [], pack = tr.pack || [];
    var moves = items.filter(function (i) { return (T[i.type] || {}).move; }).length;
    var stays = items.filter(function (i) { return i.type === 'hotel'; }).length;
    var packed = pack.filter(function (p) { return p.done; }).length, cost = planned(tr);
    var issues = (tr.end || tr.start) >= today() ? docChecks(tr).filter(function (c) { return c.state === 'bad'; }).length : 0;
    var bits = [];
    if (issues) bits.push('<span class="bad"><i class="bi bi-exclamation-triangle"></i>Check documents</span>');
    if (moves) bits.push('<span><i class="bi bi-airplane"></i>' + moves + '</span>');
    if (stays) bits.push('<span><i class="bi bi-building"></i>' + stays + '</span>');
    if (pack.length) bits.push('<span><i class="bi bi-luggage"></i>' + packed + '/' + pack.length + '</span>');
    if (cost) bits.push('<span><i class="bi bi-cash-coin"></i>' + esc(kr(cost)) + '</span>');
    return '<button type="button" class="tp-card" data-trip="' + esc(tr.id) + '">' +
      '<span class="k">' + esc(relDays(tr)) + '</span><b>' + esc(tr.name) + '</b>' +
      '<span class="s">' + esc(window.TravelPage.rangeLabel(tr)) + (tr.place && tr.place.country && tr.place.country !== tr.dest ? ', ' + esc(tr.place.country) : '') + '</span>' +
      (bits.length ? '<span class="tp-bits">' + bits.join('') + '</span>' : '') + '<i class="bi bi-chevron-right tp-go"></i></button>';
  }
  function renderList() {
    var t = all(), td = today();
    var up = t.trips.filter(function (x) { return (x.end || x.start) >= td; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    $('tpUpcoming').innerHTML = up.map(card).join('');
    $('tpEmpty').hidden = up.length > 0;
    $('tvTripCount').textContent = up.length ? up.length : '';
    renderDocs();
  }
  window.TripCard = card;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-trip]');
    if (b) location.hash = 'trip=' + b.dataset.trip;
  });

  /* ================= one trip ================= */
  function renderDetail() {
    var tr = current();
    if (!tr) { closeTrip(); return; }
    var range = fmt(tr.start, { weekday: 'short', day: 'numeric', month: 'short' }) +
      (tr.end && tr.end !== tr.start ? ' – ' + fmt(tr.end, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ', ' + tr.start.slice(0, 4));
    var where = tr.place ? [tr.place.name, tr.place.country].filter(Boolean).join(', ') : (tr.dest || '');
    $('tpHead').innerHTML = '<div class="tp-head-main"><p class="k">' + esc(relDays(tr)) + '</p><h2>' + esc(tr.name) + '</h2>' +
      '<p class="muted">' + esc(range) + (where ? ' · ' + esc(where) : '') + '</p></div>' +
      '<div class="tp-head-acts"><a class="text-btn" href="../calendar/#d=' + esc(tr.start) + '"><i class="bi bi-calendar3"></i> In calendar</a>' +
      '<button class="text-btn" type="button" id="tpEdit"><i class="bi bi-pencil"></i> Edit</button></div>';
    document.querySelectorAll('#tpTabs [data-tp]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tp === pane)); });
    document.querySelectorAll('#tpDetail .tp-pane').forEach(function (p) { p.hidden = p.dataset.pane !== pane; });
    var checks = checklist(tr), open = checks.filter(function (c) { return !c.done; }).length;
    $('tpPrepCount').textContent = open ? open : '';
    if (pane === 'overview') { renderDest(tr); renderGlance(tr, checks); if (document.activeElement !== $('tpNotes')) $('tpNotes').value = tr.notes || ''; }
    if (pane === 'plan') { renderPlan(tr); renderIdeas(tr); renderMap(tr); }
    if (pane === 'prepare') { renderChecks(tr, checks); renderPack(tr); }
    if (pane === 'money') { renderMoney(tr); renderFx(tr); }
    ensurePlace(tr);
  }
  $('tpTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tp]');
    if (!b) return;
    pane = b.dataset.tp;
    renderDetail();
  });
  function goPane(p) { pane = p; renderDetail(); window.scrollTo({ top: Math.max(0, $('tpTabs').offsetTop - 80), behavior: 'smooth' }); }

  /* Older trips (or a typed destination) get their place looked up once */
  var placing = {};
  function ensurePlace(tr) {
    /* no destination typed? try the trip's name ("Barcelona"), but only if it really is a place */
    var q = tr.dest || String(tr.name || '').replace(/\b(19|20)\d\d\b/g, '').replace(/\b(trip|holiday|vacation|ferie|tur)\b/gi, '').trim();
    if (tr.place || !q || placing[tr.id]) return;
    placing[tr.id] = true;
    W.search(q).then(function (l) {
      var hit = l[0];
      if (!hit) return;
      if (!tr.dest && hit.name.toLowerCase() !== q.toLowerCase() && hit.country.toLowerCase() !== q.toLowerCase()) return;
      var t = all(), x = find(t, tr.id);
      if (x && !x.place) { x.place = hit; if (!x.dest) x.dest = hit.name; F.saveTravel(t); }
    }).catch(function () {});
  }

  /* ---------- overview: destination ---------- */
  var wxCache = {};
  function wxFor(tr) {
    if (!tr.place) return Promise.resolve({});
    var k = tr.place.lat + ',' + tr.place.lon + tr.start + (tr.end || '');
    if (!wxCache[k]) wxCache[k] = W.weather(tr.place, tr.start, tr.end || tr.start).catch(function () { return {}; });
    return wxCache[k];
  }
  function wxChip(day, w, short) {
    var x = W.wmo(w.code);
    return '<div class="wx' + (w.kind === 'typical' ? ' typ' : '') + '" title="' + esc(x[0]) + '">' +
      (short ? '' : '<span class="d">' + esc(fmt(day, { weekday: 'short' })) + '<small>' + C.fromKey(day).getDate() + '</small></span>') +
      '<i class="bi bi-' + x[1] + '"></i><span class="t">' + Math.round(w.max) + '°<small>' + Math.round(w.min) + '°</small></span>' +
      (w.rain != null && w.rain >= 30 ? '<span class="r">' + w.rain + '%</span>' : w.mm != null && w.mm >= 1 ? '<span class="r">' + Math.round(w.mm) + ' mm</span>' : '') + '</div>';
  }
  function renderDest(tr) {
    var box = $('tpDest');
    if (!tr.place) {
      box.innerHTML = '<div class="card-head"><h2><i class="bi bi-geo-alt"></i> Destination</h2></div>' +
        (tr.dest ? '<p class="muted"><i class="bi bi-arrow-repeat spin-i"></i> Looking up ' + esc(tr.dest) + '…</p>'
          : '<p class="muted">Add a destination city to see the weather for your days, the local time and the currency.</p><button class="text-btn" type="button" data-editTrip><i class="bi bi-pencil"></i> Add destination</button>');
      return;
    }
    var p = tr.place, ti = W.timeInfo(p.tz), cur = W.currencyOf(p.cc);
    box.innerHTML = '<div class="card-head"><h2><i class="bi bi-geo-alt"></i> ' + esc(p.name) + '</h2><span class="muted">' + esc([p.region, p.country].filter(Boolean).join(', ')) + '</span></div>' +
      '<div class="tp-wx" id="tpWx"><p class="muted"><i class="bi bi-arrow-repeat spin-i"></i> Weather…</p></div>' +
      '<ul class="tp-facts">' +
      (ti ? '<li><i class="bi bi-clock"></i><span><b>' + esc(ti.now) + '</b> local time · ' + esc(ti.text) + '</span></li>' : '') +
      (cur && cur !== 'NOK' ? '<li><i class="bi bi-currency-exchange"></i><span id="tpRate">' + esc(cur) + '</span></li>' : '') +
      '<li><i class="bi bi-map"></i><span><a href="' + esc(W.osmLink(p)) + '" target="_blank" rel="noopener">Map</a> · <a href="' + esc(W.gmapsLink(p.name + ', ' + p.country)) + '" target="_blank" rel="noopener">Google Maps</a></span></li>' +
      ((tr.end || tr.start) >= today() ? '<li><i class="bi bi-airplane"></i><span><a href="' + esc(W.flightsLink(p.name, tr.start, tr.end)) + '" target="_blank" rel="noopener">' +
        ((tr.items || []).some(function (it) { return it.type === 'flight'; }) ? 'Compare flights' : 'Find flights') + '</a> on Google Flights · ' + esc(W.homeCity()) + ' → ' + esc(p.name) + '</span></li>' : '') +
      '</ul>';
    var id = tr.id;
    wxFor(tr).then(function (wx) {
      if (!$('tpWx') || openId !== id) return;
      var days = tripDays(tr).filter(function (d) { return wx[d]; }).slice(0, 14);
      if (!days.length) { $('tpWx').innerHTML = (tr.end || tr.start) < today() ? '' : '<p class="muted">No weather for these dates yet.</p>'; return; }
      var typ = days.some(function (d) { return wx[d].kind === 'typical'; }), fc = days.some(function (d) { return wx[d].kind === 'forecast'; });
      $('tpWx').innerHTML = '<div class="wx-row">' + days.map(function (d) { return wxChip(d, wx[d]); }).join('') + '</div>' +
        '<p class="muted wx-note">' + (fc && typ ? 'Forecast, then the same dates last year (faded)' : typ ? 'Same dates last year – the forecast comes 16 days before' : 'Forecast from Open-Meteo') + '</p>';
    });
    if (cur && cur !== 'NOK') W.rate(cur).then(function (r) {
      if (!$('tpRate') || !r) return;
      $('tpRate').innerHTML = '<b>1 ' + esc(cur) + ' = ' + esc(r.nok.toFixed(r.nok < 1 ? 3 : 2).replace('.', ',')) + ' kr</b> · <button type="button" class="link-btn" data-pane="money">Converter</button>';
    });
  }
  /* ---------- overview: at a glance ---------- */
  function renderGlance(tr, checks) {
    var items = sortItems(tr.items || []), pack = tr.pack || [], packed = pack.filter(function (p) { return p.done; }).length;
    var done = checks.filter(function (c) { return c.done; }).length, budget = num(tr.budget), cost = planned(tr);
    var now = new Date(), next = items.filter(function (it) { var w = F.when(it); return w && (w.timed ? w.start > now : it.date >= today()); })[0];
    var warn = checks.filter(function (c) { return c.state === 'bad' || c.state === 'warn'; });
    function row(icon, label, value, pct, go) {
      return '<button type="button" class="gl-row" data-pane="' + go + '"><i class="bi bi-' + icon + '"></i><span class="l">' + label + '</span><span class="v">' + value + '</span>' +
        (pct != null ? '<span class="gl-bar"><i style="width:' + Math.min(100, pct) + '%"></i></span>' : '') + '</button>';
    }
    var nw = next ? F.when(next) : null, NT = next ? (T[next.type] || T.other) : null;
    $('tpGlance').innerHTML = '<div class="card-head"><h2><i class="bi bi-speedometer2"></i> At a glance</h2></div>' +
      warn.map(function (c) { return '<button type="button" class="gl-warn ' + c.state + '" data-pane="prepare"><i class="bi bi-exclamation-triangle"></i><span><b>' + esc(c.text) + '</b><small>' + esc(c.sub || '') + '</small></span></button>'; }).join('') +
      (next ? '<div class="gl-next"><span class="ic"><i class="bi bi-' + NT.icon + '"></i></span><span class="x"><small>Next up</small><b>' + esc(next.title || NT.name) + '</b>' +
        '<span>' + esc(fmt(next.date, { weekday: 'short', day: 'numeric', month: 'short' })) + (next.time ? ' ' + esc(next.time) : '') + (next.from ? ' · ' + esc(next.from) : '') + '</span></span>' +
        (next.from && nw && nw.timed && next.type !== 'hotel' ? '<button type="button" class="tp-route" data-route="' + esc(next.id) + '"><i class="bi bi-signpost-split"></i><span>Get there</span></button>' : '') + '</div>' : '') +
      row('list-ol', 'Plan', items.length ? items.length + ' booking' + (items.length > 1 ? 's' : '') : 'Nothing yet', null, 'plan') +
      row('check2-square', 'Before you go', done + ' of ' + checks.length, checks.length ? done / checks.length * 100 : 0, 'prepare') +
      row('luggage', 'Packing', pack.length ? packed + ' of ' + pack.length : 'No list yet', pack.length ? packed / pack.length * 100 : null, 'prepare') +
      row('cash-coin', 'Booked', esc(kr(cost)) + (budget ? ' of ' + esc(kr(budget)) : ''), budget ? cost / budget * 100 : null, 'money');
  }
  $('tpDetail').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-route]'))) return routeItem(b.dataset.route);
    if ((b = e.target.closest('[data-pane]')) && !b.classList.contains('tp-pane')) return goPane(b.dataset.pane);
    if (e.target.closest('[data-edittrip]')) return openTripEditor(current());
  });

  /* ---------- plan: bookings / day by day ---------- */
  function itemLines(it) {
    var Ty = T[it.type] || T.other, line1 = [], line2 = [];
    if (it.time) line1.push(it.time + (it.endTime ? ' – ' + it.endTime + (it.endDate && it.endDate !== it.date ? ' (' + fmt(it.endDate, { day: 'numeric', month: 'short' }) + ')' : '') : ''));
    else if (it.type === 'hotel' && it.endDate) line1.push('until ' + fmt(it.endDate, { weekday: 'short', day: 'numeric', month: 'short' }));
    if (Ty.move && (it.from || it.to)) line1.push(esc(it.from || '?') + ' → ' + esc(it.to || '?'));
    else if (it.from) line1.push(esc(it.from));
    if (it.ref) line2.push('Ref <b class="tp-ref">' + esc(it.ref) + '</b>');
    if (num(it.cost)) line2.push(esc(kr(num(it.cost))));
    return { l1: line1.join(' · '), l2: line2.join(' · ') };
  }
  function itemRow(it, n) {
    var Ty = T[it.type] || T.other, w = F.when(it), L = itemLines(it);
    var canRoute = it.from && w && w.timed && it.date >= today() && it.type !== 'hotel';
    return '<div class="tp-item" data-item="' + esc(it.id) + '">' +
      '<span class="ic"><i class="bi bi-' + Ty.icon + '"></i>' + (n ? '<em>' + n + '</em>' : '') + '</span>' +
      '<button type="button" class="x" data-edit="' + esc(it.id) + '"><b>' + esc(it.title || Ty.name) + '</b>' +
      (L.l1 ? '<span class="s">' + L.l1 + '</span>' : '') + (L.l2 ? '<span class="s">' + L.l2 + '</span>' : '') + '</button>' +
      (canRoute ? '<button type="button" class="tp-route" data-route="' + esc(it.id) + '" title="Plan how to get to ' + esc(it.from) + ' in time"><i class="bi bi-signpost-split"></i><span>Get there</span></button>' : '') +
      '</div>';
  }
  var mapNo = {};    // item id -> number on the map
  function renderPlan(tr) {
    document.querySelectorAll('#tpPlanView [data-pv]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.pv === planView)); });
    var items = sortItems(tr.items || []);
    if (!items.length && planView === 'list') {
      $('tpItems').innerHTML = '<p class="empty">Add flights, trains, where you stay and what you’ll do. Everything with a date shows up in your calendar.</p>' +
        '<div class="tp-quick">' + ['flight', 'train', 'hotel', 'activity'].map(function (k) {
          return '<button type="button" class="tv-chip" data-quick="' + k + '"><i class="bi bi-' + T[k].icon + '"></i>' + T[k].name + '</button>';
        }).join('') + '</div>';
      return;
    }
    if (planView === 'list') {
      var html = '', last = '';
      items.forEach(function (it) {
        if (it.date !== last) { last = it.date; html += '<h3 class="tp-day">' + esc(fmt(it.date, { weekday: 'long', day: 'numeric', month: 'short' })) + '</h3>'; }
        html += itemRow(it, mapNo[it.id]);
      });
      $('tpItems').innerHTML = html;
      return;
    }
    /* day by day */
    var days = tripDays(tr), extra = items.map(function (i) { return i.date; }).filter(function (d) { return days.indexOf(d) < 0; });
    days = days.concat(extra.filter(function (d, i) { return extra.indexOf(d) === i; })).sort();
    var ideas = tr.ideas || [], id = tr.id;
    $('tpItems').innerHTML = '<div class="tp-days">' + days.map(function (d, i) {
      var its = items.filter(function (it) { return it.date === d; });
      var stay = items.filter(function (it) { return it.type === 'hotel' && it.date < d && (it.endDate || it.date) > d; })[0];
      var ids = ideas.filter(function (x) { return x.day === d; });
      return '<section class="tp-dd" data-day="' + d + '"><header><span class="n">Day ' + (i + 1) + '</span><b>' + esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'short' })) + '</b><span class="wxs" data-wx="' + d + '"></span></header>' +
        its.map(function (it) { return itemRow(it, mapNo[it.id]); }).join('') +
        ids.map(function (x) { return '<div class="tp-dd-idea' + (x.done ? ' done' : '') + '"><i class="bi bi-lightbulb"></i><span>' + esc(x.text) + '</span></div>'; }).join('') +
        (stay ? '<p class="tp-dd-stay"><i class="bi bi-building"></i> ' + esc(stay.title || 'Your stay') + '</p>' : '') +
        (!its.length && !ids.length && !stay ? '<p class="tp-dd-free">Free day – add an idea and pick this day.</p>' : '') + '</section>';
    }).join('') + '</div>';
    wxFor(tr).then(function (wx) {
      if (openId !== id) return;
      document.querySelectorAll('[data-wx]').forEach(function (el) { var w = wx[el.dataset.wx]; if (w) el.innerHTML = wxChip(el.dataset.wx, w, true); });
    });
  }
  $('tpPlanView').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pv]');
    if (!b) return;
    planView = b.dataset.pv;
    try { localStorage.setItem('dash.tpPlanView', planView); } catch (x) {}
    renderPlan(current());
  });
  $('tpItems').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-edit]'))) return openItem(b.dataset.edit);
    if ((b = e.target.closest('[data-quick]'))) return openItem(null, b.dataset.quick);
  });
  $('tpAddItem').addEventListener('click', function () { openItem(null); });

  /* Trip -> journey planner: be at the airport/station in time */
  function routeItem(id) {
    var tr = current(), it = tr && (tr.items || []).filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    var w = F.when(it), Ty = T[it.type] || T.other, buf = Ty.buffer;
    F.route({ toText: it.from, arriveBy: new Date(w.start.getTime() - buf * 60e3),
      context: { title: (it.title || Ty.name) + (Ty.move && it.to ? ' to ' + it.to : ''), note: buf ? buf + ' min before ' + it.time : 'starts ' + it.time, cat: 'life' } });
  }

  /* ---------- plan: map ---------- */
  function mapQuery(it, tr) {
    var Ty = T[it.type] || T.other, q = Ty.move ? it.to : it.from;
    if (!q) return '';
    if (!Ty.move && tr.place && q.toLowerCase().indexOf(tr.place.name.toLowerCase()) < 0) q += ', ' + tr.place.name;
    return q;
  }
  var mapSig = '', locating = {};
  function renderMap(tr) {
    var items = sortItems(tr.items || []), pts = [], n = 0, missing = 0;
    mapNo = {};
    items.forEach(function (it) {
      var q = mapQuery(it, tr);
      if (!q) return;
      if (it.geo && it.geo.q === q) { n++; mapNo[it.id] = n; pts.push({ lat: it.geo.lat, lon: it.geo.lon, n: n, label: esc(it.title || (T[it.type] || T.other).name) + '<br><small>' + esc(q) + '</small>', color: '#0891b2' }); }
      else if (!(it.geo && it.geo.q === q && it.geo.none)) { missing++; locateItem(tr.id, it.id, q); }
    });
    if (tr.place) pts.unshift({ lat: tr.place.lat, lon: tr.place.lon, label: esc(tr.place.name), color: 'var(--accent)' });
    $('tpMapOpen').hidden = !tr.place;
    if (tr.place) $('tpMapOpen').href = W.gmapsLink(tr.place.name + ', ' + tr.place.country);
    $('tpMapNote').textContent = missing ? 'Finding ' + missing + ' place' + (missing > 1 ? 's' : '') + ' on the map…'
      : n ? 'Numbers match the bookings in your plan.' : tr.place ? 'Addresses in your plan (hotel, activities, arrival station) are shown here.' : 'Add a destination to see a map.';
    var sig = JSON.stringify(pts.map(function (p) { return [p.lat, p.lon, p.n]; })) + document.documentElement.getAttribute('data-theme');
    if (!pts.length) { $('tpMap').hidden = true; mapSig = ''; return; }
    $('tpMap').hidden = false;
    if (sig === mapSig && $('tpMap')._map) { setTimeout(function () { $('tpMap')._map.invalidateSize(); }, 50); return; }
    mapSig = sig;
    W.map($('tpMap'), pts, { zoom: 11 }).catch(function () { $('tpMapNote').textContent = 'The map couldn’t load right now.'; });
  }
  function locateItem(tripId, itemId, q) {
    var key = itemId + '|' + q;
    if (locating[key]) return;
    locating[key] = true;
    W.locate(q).then(function (r) {
      var t = all(), tr = find(t, tripId), it = tr && (tr.items || []).filter(function (x) { return x.id === itemId; })[0];
      if (!it) return;
      it.geo = r ? { q: q, lat: r.lat, lon: r.lon } : { q: q, none: true };
      F.saveTravel(t);
    });
  }

  /* ---------- plan: ideas ---------- */
  function renderIdeas(tr) {
    var ideas = tr.ideas || [], days = tripDays(tr);
    $('tpIdeaCount').textContent = ideas.length ? ideas.filter(function (x) { return x.done; }).length + ' of ' + ideas.length + ' done' : '';
    $('tpIdeas').innerHTML = ideas.map(function (x) {
      return '<li class="' + (x.done ? 'done' : '') + '"><label><input type="checkbox" data-idea="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '><span>' + esc(x.text) + '</span></label>' +
        '<select data-ideaday="' + esc(x.id) + '" aria-label="Day for ' + esc(x.text) + '"><option value="">Any day</option>' + days.map(function (d, i) {
          return '<option value="' + d + '"' + (x.day === d ? ' selected' : '') + '>Day ' + (i + 1) + ' · ' + esc(fmt(d, { weekday: 'short', day: 'numeric' })) + '</option>';
        }).join('') + '</select>' +
        '<button type="button" class="tp-x" data-unidea="' + esc(x.id) + '" aria-label="Remove ' + esc(x.text) + '"><i class="bi bi-x"></i></button></li>';
    }).join('') || '<li class="tp-empty-li muted">Museums, restaurants, a view – collect them here and give them a day.</li>';
  }
  $('tpIdeaForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('tpIdeaIn').value.trim();
    if (!v) return;
    update(function (tr) { tr.ideas = tr.ideas || []; tr.ideas.push({ id: F.uid(), text: v.slice(0, 120), day: '', done: false }); });
    $('tpIdeaIn').value = '';
  });
  $('tpIdeas').addEventListener('change', function (e) {
    var id = e.target.dataset.idea, dd = e.target.dataset.ideaday;
    if (id) update(function (tr) { (tr.ideas || []).forEach(function (x) { if (x.id === id) x.done = e.target.checked; }); });
    if (dd) update(function (tr) { (tr.ideas || []).forEach(function (x) { if (x.id === dd) x.day = e.target.value; }); });
  });
  $('tpIdeas').addEventListener('click', function (e) {
    var b = e.target.closest('[data-unidea]');
    if (b) update(function (tr) { tr.ideas = (tr.ideas || []).filter(function (x) { return x.id !== b.dataset.unidea; }); });
  });

  /* ---------- prepare: before you go ---------- */
  function checklist(tr) {
    var done = tr.done || {}, out = [];
    docChecks(tr).forEach(function (c) { c.done = c.state === 'ok'; c.auto = true; out.push(c); });
    sortItems(tr.items || []).forEach(function (it) {
      var w = F.when(it);
      if (it.type !== 'flight' || !w || !w.timed) return;
      var opens = new Date(w.start.getTime() - 864e5);
      out.push({ key: 'checkin:' + it.id, text: 'Check in for ' + (it.title || 'your flight'), done: !!done['checkin:' + it.id],
        sub: (opens > new Date() ? 'Usually opens ' : 'Opened ') + opens.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + F.hm(opens) + ' (24 h before)' + (it.ref ? ' · ref ' + it.ref : '') });
    });
    var cur = tr.place && W.currencyOf(tr.place.cc);
    if (cur && cur !== 'NOK') out.push({ key: 'cash', text: 'Card that works in ' + cur + ', and a little cash', done: !!done.cash });
    (tr.todo || []).forEach(function (x) { out.push({ key: 'todo:' + x.id, text: x.text, done: !!x.done, own: x.id }); });
    return out;
  }
  function renderChecks(tr, checks) {
    var done = checks.filter(function (c) { return c.done; }).length;
    $('tpCheckCount').textContent = checks.length ? done + ' of ' + checks.length : '';
    $('tpChecks').innerHTML = checks.map(function (c) {
      var tick = c.auto
        ? '<span class="auto ' + c.state + '"><i class="bi bi-' + (c.state === 'ok' ? 'check-circle-fill' : c.state === 'todo' ? 'circle' : 'exclamation-triangle') + '"></i></span>'
        : '<input type="checkbox" data-check="' + esc(c.key) + '"' + (c.done ? ' checked' : '') + '>';
      var act = c.auto ? (c.doc ? '<button type="button" class="text-btn" data-doc="' + esc(c.doc) + '">View</button>'
        : c.add ? '<button type="button" class="text-btn" data-adddoc="' + esc(c.add) + '">Add</button>' : '')
        : c.own ? '<button type="button" class="tp-x" data-untodo="' + esc(c.own) + '" aria-label="Remove"><i class="bi bi-x"></i></button>' : '';
      return '<li class="' + (c.done ? 'done' : '') + (c.auto ? ' is-auto' : '') + '"><label>' + tick + '<span><b>' + esc(c.text) + '</b>' + (c.sub ? '<small>' + esc(c.sub) + '</small>' : '') + '</span></label>' + act + '</li>';
    }).join('') || '<li class="tp-empty-li muted">Add what you need to sort out before you leave.</li>';
    var have = (tr.todo || []).map(function (x) { return x.text.toLowerCase(); });
    $('tpTodoIdeas').hidden = TODO_IDEAS.every(function (x) { return have.indexOf(x.toLowerCase()) > -1; });
  }
  $('tpChecks').addEventListener('change', function (e) {
    var k = e.target.dataset.check;
    if (!k) return;
    update(function (tr) {
      if (k.indexOf('todo:') === 0) (tr.todo || []).forEach(function (x) { if ('todo:' + x.id === k) x.done = e.target.checked; });
      else { tr.done = tr.done || {}; if (e.target.checked) tr.done[k] = true; else delete tr.done[k]; }
    });
  });
  $('tpChecks').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-untodo]'))) update(function (tr) { tr.todo = (tr.todo || []).filter(function (x) { return x.id !== b.dataset.untodo; }); });
    else if ((b = e.target.closest('[data-adddoc]'))) openDoc(null, b.dataset.adddoc);
  });
  $('tpTodoForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('tpTodoIn').value.trim();
    if (!v) return;
    update(function (tr) { tr.todo = tr.todo || []; tr.todo.push({ id: F.uid(), text: v.slice(0, 100), done: false }); });
    $('tpTodoIn').value = '';
  });
  $('tpTodoIdeas').addEventListener('click', function () {
    update(function (tr) {
      tr.todo = tr.todo || [];
      var foreign = abroad(tr);
      TODO_IDEAS.forEach(function (x, i) {
        if (i === 0 && !foreign) return;
        if (!tr.todo.some(function (t) { return t.text.toLowerCase() === x.toLowerCase(); })) tr.todo.push({ id: F.uid(), text: x, done: false });
      });
    });
  });

  /* ---------- prepare: packing ---------- */
  function renderPack(tr) {
    var pack = tr.pack || [], done = pack.filter(function (p) { return p.done; }).length;
    $('tpPackCount').textContent = pack.length ? done + ' of ' + pack.length : '';
    $('tpPack').innerHTML = pack.map(function (p) {
      return '<li class="' + (p.done ? 'done' : '') + '"><label><input type="checkbox" data-pack="' + esc(p.id) + '"' + (p.done ? ' checked' : '') + '><span>' + esc(p.text) + '</span></label>' +
        '<button type="button" class="tp-x" data-unpack="' + esc(p.id) + '" aria-label="Remove ' + esc(p.text) + '"><i class="bi bi-x"></i></button></li>';
    }).join('');
    $('tpPackBasics').hidden = pack.length >= 3;
  }
  $('tpPackForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('tpPackIn').value.trim();
    if (!v) return;
    update(function (tr) { tr.pack = tr.pack || []; tr.pack.push({ id: F.uid(), text: v.slice(0, 80), done: false }); });
    $('tpPackIn').value = '';
  });
  $('tpPack').addEventListener('change', function (e) {
    var id = e.target.dataset.pack;
    if (id) update(function (tr) { (tr.pack || []).forEach(function (p) { if (p.id === id) p.done = e.target.checked; }); });
  });
  $('tpPack').addEventListener('click', function (e) {
    var b = e.target.closest('[data-unpack]');
    if (b) update(function (tr) { tr.pack = (tr.pack || []).filter(function (p) { return p.id !== b.dataset.unpack; }); });
  });
  $('tpPackBasics').addEventListener('click', function () {
    update(function (tr) {
      tr.pack = tr.pack || [];
      var list = BASICS.slice();
      if (!abroad(tr)) list = list.filter(function (x) { return x !== 'Travel adapter'; });
      list.forEach(function (x) { if (!tr.pack.some(function (p) { return p.text.toLowerCase() === x.toLowerCase(); })) tr.pack.push({ id: F.uid(), text: x, done: false }); });
    });
  });

  /* ---------- money: trip -> Finances ---------- */
  function renderMoney(tr) {
    var costs = sortItems(tr.items || []).filter(function (it) { return num(it.cost); });
    /* deleted in Finances? then it's not in Finances any more */
    var vd = window.Vault.get(), ids = {};
    ((vd && vd.expenses) || []).forEach(function (x) { ids[x.id] = 1; });
    costs.forEach(function (it) { if (it.spendId && vd && !ids[it.spendId]) { delete it.spendId; it.noFin = true; } });
    var total = planned(tr), budget = num(tr.budget), logged = costs.filter(function (it) { return it.spendId; });
    var pct = budget ? Math.min(100, Math.round(total / budget * 100)) : 0;
    var over = (tr.end || tr.start) < today();
    var html = over && !total && !budget ? '' : '<div class="tp-total"><div><span class="muted">' + (over ? 'Booked' : 'Booked so far') + '</span><b>' + esc(kr(total)) + '</b></div>' +
      (budget ? '<div class="r"><span class="muted">Budget</span><b>' + esc(kr(budget)) + '</b></div>' : '') + '</div>';
    if (budget) html += '<div class="tp-progress' + (total > budget ? ' over' : '') + '"><i style="width:' + pct + '%"></i></div>' +
      '<p class="muted tp-left">' + (total > budget ? esc(kr(total - budget)) + ' over budget' : esc(kr(budget - total)) + ' left to spend') +
      (budget > total && tripDays(tr).length ? ' · about ' + esc(kr((budget - total) / tripDays(tr).length)) + ' a day' : '') + '</p>';
    else if ((tr.end || tr.start) >= today()) html += '<p class="muted tp-left"><button type="button" class="link-btn" data-edittrip>Set a budget</button> to see what’s left per day.</p>';
    if (costs.length || num(tr.spent)) {
      html += '<ul class="tp-costs">' + costs.map(function (it) {
        var Ty = T[it.type] || T.other;
        return '<li><i class="bi bi-' + Ty.icon + '"></i><span class="n">' + esc(it.title || Ty.name) + '</span><span class="a">' + esc(kr(num(it.cost))) + '</span>' +
          (it.spendId ? '<button type="button" class="text-btn tp-logged" data-unlog="' + esc(it.id) + '" title="Keep this cost out of Finances"><i class="bi bi-link-45deg"></i> In Finances</button>'
            : '<button type="button" class="text-btn" data-log="' + esc(it.id) + '">Add to Finances</button>') + '</li>';
      }).join('') + (num(tr.spent) ? '<li><i class="bi bi-bag"></i><span class="n">Other costs</span><span class="a">' + esc(kr(num(tr.spent))) + '</span>' +
        '<span class="text-btn tp-logged"><i class="bi bi-link-45deg"></i> In Finances</span></li>' : '') + '</ul>';
      var open = costs.length - logged.length;
      html += '<div class="tp-money-acts">' + (open > 1 ? '<button type="button" class="text-btn" data-logall><i class="bi bi-box-arrow-in-right"></i> Add all ' + open + ' to Finances</button>' : '') +
        (logged.length ? '<a class="text-btn" href="../finance/"><i class="bi bi-wallet2"></i> See in Finances</a>' : '') + '</div>';
      html += '<p class="muted tp-hint">Costs go to your spending in Finances (category Travel) automatically, and follow when you change them. Tap “In Finances” to keep one out.</p>';
    } else if ((tr.end || tr.start) >= today()) html += '<p class="muted tp-hint">Put a cost on a booking and it adds up here – and goes to your spending in Finances (category Travel) automatically.</p>';
    /* what you spent while you were away – card purchases and the rest you logged on those days */
    if (tr.start && tr.start <= today() && vd) {
      var to = tr.end || tr.start, linked = {};
      costs.forEach(function (it) { if (it.spendId) linked[it.spendId] = 1; });
      if (tr.spentId) linked[tr.spentId] = 1;
      var during = (vd.expenses || []).filter(function (x) { return x.date >= tr.start && x.date <= to && !linked[x.id]; });
      if (during.length) {
        var NAMES = { groceries: 'Groceries', eating: 'Eating out', transport: 'Transport', shopping: 'Shopping', fun: 'Fun', health: 'Health', travel: 'Travel', other: 'Other' };
        var by = {}, all = 0; during.forEach(function (x) { by[x.cat] = (by[x.cat] || 0) + (+x.amount || 0); all += +x.amount || 0; });
        var cats = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }), nd = Math.max(1, Math.min(tripDays(tr).length || 1, Math.round((new Date(Math.min(new Date(to + 'T12:00'), new Date())) - new Date(tr.start + 'T12:00')) / 864e5) + 1));
        html += '<div class="tp-during"><div class="tp-total"><div><span class="muted">Spent during the trip</span><b>' + esc(kr(all)) + '</b></div><div class="r"><span class="muted">Per day</span><b>' + esc(kr(all / nd)) + '</b></div></div>' +
          '<ul class="tp-costs">' + cats.slice(0, 5).map(function (c) { return '<li><i class="bi bi-tag"></i><span class="n">' + esc(NAMES[c] || 'Other') + '</span><span class="a">' + esc(kr(by[c])) + '</span></li>'; }).join('') + '</ul>' +
          '<p class="muted tp-hint">Everything in Finances dated ' + esc(fmtD(tr.start)) + (to !== tr.start ? ' – ' + esc(fmtD(to)) : '') + ', bookings not counted twice. Grand total ' + esc(kr(all + total)) + '.</p></div>';
      }
    }
    if (!html) html = '<p class="muted tp-hint">No costs logged for this trip.</p>';
    $('tpMoney').innerHTML = html;
  }
  $('tpMoney').addEventListener('click', function (e) {
    var b = e.target.closest('[data-log], [data-unlog], [data-logall]');
    if (!b) return;
    update(function (tr) {
      (tr.items || []).forEach(function (it) {
        if (!num(it.cost)) return;
        if ((b.dataset.log === it.id || b.hasAttribute('data-logall')) && !it.spendId) {
          delete it.noFin;
          it.spendId = F.logSpend({ amount: num(it.cost), date: today(), cat: 'travel', note: tr.name + ': ' + (it.title || (T[it.type] || T.other).name) }) || undefined;
        } else if (b.dataset.unlog === it.id && it.spendId) { F.unlogSpend(it.spendId); delete it.spendId; it.noFin = true; }
      });
    });
  });

  /* ---------- money: currency converter ---------- */
  var fxRate = null;
  function renderFx(tr) {
    var cur = tr.place && W.currencyOf(tr.place.cc), box = $('tpFx');
    if (!tr.place) { box.innerHTML = '<div class="card-head"><h2><i class="bi bi-currency-exchange"></i> Currency</h2></div><p class="muted">Add a destination to get the exchange rate.</p>'; return; }
    if (!cur || cur === 'NOK') { box.innerHTML = '<div class="card-head"><h2><i class="bi bi-currency-exchange"></i> Currency</h2></div><p class="muted">' + (cur === 'NOK' ? 'Norwegian kroner – no exchange needed.' : 'No exchange rate available for ' + esc(tr.place.country) + '.') + '</p>'; return; }
    box.innerHTML = '<div class="card-head"><h2><i class="bi bi-currency-exchange"></i> ' + esc(cur) + '</h2><span class="muted" id="fxDate"></span></div><p class="muted" id="fxMsg"><i class="bi bi-arrow-repeat spin-i"></i> Getting the rate…</p>';
    W.rate(cur).then(function (r) {
      if (!r) { $('fxMsg').textContent = 'Couldn’t get the rate right now.'; return; }
      fxRate = r;
      var c = function (n) { return (Math.round(n * r.nok)).toLocaleString('nb-NO') + ' kr'; };
      var steps = r.nok < 0.05 ? [1000, 10000, 50000, 100000] : r.nok < 1 ? [100, 500, 1000, 5000] : [5, 10, 50, 100];
      box.innerHTML = '<div class="card-head"><h2><i class="bi bi-currency-exchange"></i> ' + esc(cur) + '</h2><span class="muted">ECB rate · ' + esc(fmt(r.date)) + '</span></div>' +
        '<div class="fx-conv"><label><input id="fxLocal" inputmode="decimal" placeholder="0"><span>' + esc(cur) + '</span></label>' +
        '<i class="bi bi-arrow-left-right"></i><label><input id="fxNok" inputmode="decimal" placeholder="0"><span>NOK</span></label></div>' +
        '<ul class="fx-table">' + steps.map(function (n) { return '<li><span>' + n.toLocaleString('nb-NO') + ' ' + esc(cur) + '</span><b>' + c(n) + '</b></li>'; }).join('') + '</ul>';
    });
  }
  $('tpFx').addEventListener('input', function (e) {
    if (!fxRate) return;
    var v = num(e.target.value);
    if (e.target.id === 'fxLocal') $('fxNok').value = v == null ? '' : (Math.round(v * fxRate.nok * 100) / 100).toLocaleString('nb-NO');
    if (e.target.id === 'fxNok') $('fxLocal').value = v == null ? '' : (Math.round(v / fxRate.nok * 100) / 100).toLocaleString('nb-NO');
  });

  /* ---------- notes ---------- */
  var noteTimer = null;
  $('tpNotes').addEventListener('input', function () {
    var v = this.value;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { update(function (tr) { tr.notes = v.slice(0, 4000); }); }, 500);
  });

  /* ================= open / close ================= */
  function openTrip(id) {
    var changed = openId !== id;
    openId = id;
    if (changed) { pane = 'overview'; mapSig = ''; }
    window.TravelPage.setTab('trips', true);
    $('tpList').hidden = true; $('tpDetail').hidden = false;
    renderDetail();
    if (changed) window.scrollTo({ top: Math.max(0, $('tvTabs').offsetTop - 80) });
  }
  function closeTrip() {
    openId = null;
    $('tpList').hidden = false; $('tpDetail').hidden = true;
    renderList();
  }
  function fromHash() {
    var m = location.hash.match(/^#trip=(.+)$/);
    if (m && find(all(), decodeURIComponent(m[1]))) return openTrip(decodeURIComponent(m[1]));
    closeTrip();
    if (location.hash === '#docs') {
      window.TravelPage.setTab('trips', true);
      setTimeout(function () { $('tpDocsCard').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      history.replaceState(null, '', location.pathname);
    }
  }
  window.addEventListener('hashchange', fromHash);
  $('tpBack').addEventListener('click', function () { history.replaceState(null, '', location.pathname); closeTrip(); });
  window.addEventListener('travel:tab', function (e) {
    if (e.detail !== 'trips' && openId) { history.replaceState(null, '', location.pathname); closeTrip(); }
  });

  /* ================= sheets ================= */
  function openSheet(bg) {
    bg.hidden = false;
    requestAnimationFrame(function () { bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
  }
  function closeSheet(bg) {
    bg.classList.remove('open');
    document.documentElement.classList.remove('cl-modal');
    setTimeout(function () { bg.hidden = true; }, 220);
  }
  ['tsBg', 'tiBg', 'docBg'].forEach(function (id) {
    var bg = $(id);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-close]')) closeSheet(bg); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['tsBg', 'tiBg', 'docBg'].forEach(function (id) { if (!$(id).hidden) closeSheet($(id)); });
  });

  /* ---------- trip editor ---------- */
  var editingTrip = null, delArmed = false, pickedPlace = null;
  var destField = window.Places.field($('tsDest'), {
    search: function (q) {
      return W.search(q).then(function (l) { return l.map(function (r) { return Object.assign({ sub: [r.region, r.country].filter(Boolean).join(', ') }, r); }); });
    },
    onPick: function (p) { pickedPlace = p; }
  });
  function openTripEditor(tr) {
    editingTrip = tr ? tr.id : null; delArmed = false; pickedPlace = tr && tr.place ? tr.place : null;
    $('tsTitle').textContent = tr ? 'Edit trip' : 'New trip';
    $('tsName').value = tr ? tr.name : '';
    $('tsDest').value = tr ? (tr.dest || '') : '';
    var start = F.dkey(C.addDays(new Date(), 14));
    $('tsStart').value = tr ? tr.start : start;
    $('tsEnd').value = tr ? (tr.end || tr.start) : F.dkey(C.addDays(C.fromKey(start), 3));
    $('tsBudget').value = tr && tr.budget ? tr.budget : '';
    $('tsSpent').value = tr && tr.spent ? tr.spent : '';
    $('tsDelBox').hidden = !tr;
    $('tsDelete').innerHTML = '<i class="bi bi-trash3"></i> Delete trip';
    openSheet($('tsBg'));
    if (!tr && innerWidth >= 700) setTimeout(function () { $('tsName').focus(); }, 60);
  }
  $('tpNew').addEventListener('click', function () { openTripEditor(null); });
  /* History tab: log a trip you've already been on */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-newpast]')) return;
    openTripEditor(null);
    $('tsStart').value = ''; $('tsEnd').value = '';
    setTimeout(function () { $('tsName').focus(); }, 60);
  });
  /* "Cheap flights": Google Flights Explore from your city (Profile → City, else Oslo) */
  $('tpExplore').addEventListener('click', function () { this.href = W.exploreLink(); });
  $('tpHead').addEventListener('click', function (e) { if (e.target.closest('#tpEdit')) openTripEditor(current()); });
  $('tsStart').addEventListener('change', function () { if (!$('tsEnd').value || $('tsEnd').value < this.value) $('tsEnd').value = this.value; });
  $('tsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('tsName').value.trim(), start = $('tsStart').value, end = $('tsEnd').value || start;
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
    if (end < start) end = start;
    var t = all(), tr = editingTrip ? find(t, editingTrip) : null;
    if (!tr) { tr = { id: F.uid(), items: [], pack: [], notes: '' }; t.trips.push(tr); }
    var dest = $('tsDest').value.trim().slice(0, 80);
    if (pickedPlace && pickedPlace.name === dest) tr.place = pickedPlace;
    else if (dest !== tr.dest) delete tr.place;          // looked up again when the trip opens
    if (!dest) delete tr.place;
    tr.name = name.slice(0, 80); tr.dest = dest; tr.start = start; tr.end = end;
    var sp = num($('tsSpent').value);
    if (sp) tr.spent = sp; else delete tr.spent;      // goes to Finances (links.js)
    var b = num($('tsBudget').value);
    if (b) tr.budget = b; else delete tr.budget;
    var cd = C.load();
    if (cd.hidden.travel) { delete cd.hidden.travel; C.save(cd); }   // make sure it shows in the calendar
    F.saveTravel(t);
    closeSheet($('tsBg'));
    if (!editingTrip) location.hash = 'trip=' + tr.id;
  });
  $('tsDelete').addEventListener('click', function () {
    if (!delArmed) { delArmed = true; this.innerHTML = '<i class="bi bi-trash3"></i> Tap again to delete the whole trip'; return; }
    var t = all();
    var gone = find(t, editingTrip) || { items: [] };
    (gone.items || []).forEach(function (it) { if (it.spendId) F.unlogSpend(it.spendId); });   // its costs leave Finances too
    if (gone.spentId) F.unlogSpend(gone.spentId);
    t.trips = t.trips.filter(function (x) { return x.id !== editingTrip; });
    F.saveTravel(t);
    closeSheet($('tsBg'));
    history.replaceState(null, '', location.pathname);
    closeTrip();
  });

  /* ---------- plan item editor ---------- */
  var editingItem = null, itype = 'flight';
  $('tiTypes').innerHTML = Object.keys(T).map(function (k) {
    return '<button type="button" data-type="' + k + '"><i class="bi bi-' + T[k].icon + '"></i><span>' + T[k].name + '</span></button>';
  }).join('');
  var LABELS = {
    move: ['Departs', 'Arrives', 'From, e.g. Oslo lufthavn', 'To, e.g. Berlin BER'],
    hotel: ['Check in', 'Check out', 'Address', ''],
    other: ['Starts', 'Ends', 'Place or address', '']
  };
  var TITLES = { flight: 'Flight number, e.g. SK 4035', train: 'e.g. Vy R10', bus: 'e.g. Flybussen', boat: 'e.g. Color Line', car: 'e.g. Rental car', hotel: 'Where you stay', activity: 'e.g. Museum, concert, dinner', other: 'Title' };
  function setType(k) {
    itype = k;
    document.querySelectorAll('#tiTypes [data-type]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.type === k)); });
    var L = T[k].move ? LABELS.move : k === 'hotel' ? LABELS.hotel : LABELS.other;
    $('tiStartLbl').textContent = L[0]; $('tiEndLbl').textContent = L[1];
    $('tiFrom').placeholder = L[2]; $('tiTo').placeholder = L[3]; $('tiTo').hidden = !L[3];
    $('tiName').placeholder = TITLES[k];
  }
  $('tiTypes').addEventListener('click', function (e) { var b = e.target.closest('[data-type]'); if (b) setType(b.dataset.type); });
  $('tiDate').addEventListener('change', function () { if ($('tiEndDate').value && $('tiEndDate').value < this.value) $('tiEndDate').value = this.value; });

  function openItem(id, type) {
    var tr = current();
    if (!tr) return;
    var it = id ? (tr.items || []).filter(function (x) { return x.id === id; })[0] : null;
    editingItem = it ? it.id : null;
    $('tiTitle').textContent = it ? 'Edit' : 'Add to plan';
    setType(it ? it.type : (type || 'flight'));
    var items = sortItems(tr.items || []);
    $('tiName').value = it ? (it.title || '') : '';
    $('tiDate').value = it ? it.date : (items.length ? items[items.length - 1].date : tr.start);
    $('tiTime').value = it ? (it.time || '') : '';
    $('tiEndDate').value = it ? (it.endDate || '') : (itype === 'hotel' ? (tr.end || '') : '');
    $('tiEndTime').value = it ? (it.endTime || '') : '';
    $('tiFrom').value = it ? (it.from || '') : '';
    $('tiTo').value = it ? (it.to || '') : '';
    $('tiRef').value = it ? (it.ref || '') : '';
    $('tiCost').value = it && it.cost ? it.cost : '';
    $('tiNotes').value = it ? (it.notes || '') : '';
    $('tiDelBox').hidden = !it;
    openSheet($('tiBg'));
  }
  $('tiForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var date = $('tiDate').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('tiDate').focus(); return; }
    update(function (tr) {
      tr.items = tr.items || [];
      var it = editingItem ? tr.items.filter(function (x) { return x.id === editingItem; })[0] : null;
      if (!it) { it = { id: F.uid() }; tr.items.push(it); }
      var cost = num($('tiCost').value);
      Object.assign(it, {
        type: itype, title: $('tiName').value.trim().slice(0, 100), date: date, time: $('tiTime').value || '',
        endDate: $('tiEndDate').value && $('tiEndDate').value >= date ? $('tiEndDate').value : '', endTime: $('tiEndTime').value || '',
        from: $('tiFrom').value.trim().slice(0, 120), to: $('tiTo').hidden ? '' : $('tiTo').value.trim().slice(0, 120),
        ref: $('tiRef').value.trim().slice(0, 40), cost: cost ? String(cost) : '', notes: $('tiNotes').value.trim().slice(0, 1000)
      });
      /* Finances follows automatically: a cost goes in as spending (Travel), changes follow,
         removing the cost takes it out. "Keep out of Finances" on the Money tab stops it. */
      var note = tr.name + ': ' + (it.title || (T[it.type] || T.other).name);
      var d = window.Vault.get(), ex = it.spendId && d ? (d.expenses || []).filter(function (x) { return x.id === it.spendId; })[0] : null;
      if (ex && cost) { ex.amount = cost; ex.note = note.slice(0, 80); window.Vault.save(d); }
      else if (ex && !cost) { F.unlogSpend(it.spendId); delete it.spendId; }
      else if (!ex && cost && !it.noFin) it.spendId = F.logSpend({ amount: cost, date: today(), cat: 'travel', note: note }) || undefined;
      /* a trip grows to fit what's planned */
      if (date < tr.start) tr.start = date;
      var last = it.endDate || date;
      if (last > (tr.end || tr.start)) tr.end = last;
    });
    closeSheet($('tiBg'));
  });
  $('tiDelete').addEventListener('click', function () {
    update(function (tr) {
      var it = (tr.items || []).filter(function (x) { return x.id === editingItem; })[0];
      if (it && it.spendId) F.unlogSpend(it.spendId);
      tr.items = (tr.items || []).filter(function (x) { return x.id !== editingItem; });
    });
    closeSheet($('tiBg'));
  });

  /* ---------- document editor ---------- */
  var editingDoc = null, dkind = 'passport';
  $('docKinds').innerHTML = Object.keys(D).map(function (k) {
    return '<button type="button" data-kind="' + k + '"><i class="bi bi-' + D[k].icon + '"></i><span>' + D[k].name + '</span></button>';
  }).join('');
  function setKind(k) {
    var prev = D[dkind] && D[dkind].name;
    dkind = k;
    document.querySelectorAll('#docKinds [data-kind]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.kind === k)); });
    if (!$('docName').value || $('docName').value === prev) $('docName').value = D[k].name;
  }
  $('docKinds').addEventListener('click', function (e) { var b = e.target.closest('[data-kind]'); if (b) setKind(b.dataset.kind); });
  function openDoc(id, kind) {
    var d = id ? all().docs.filter(function (x) { return x.id === id; })[0] : null;
    editingDoc = d ? d.id : null;
    $('docTitle').textContent = d ? 'Edit document' : 'Add document';
    $('docName').value = d ? (d.name || '') : '';
    dkind = null; setKind(d ? d.kind : (kind || 'passport'));
    if (d) $('docName').value = d.name || D[d.kind].name;
    $('docExp').value = d ? (d.expires || '') : '';
    $('docRemind').value = String(d && d.remind ? d.remind : (kind === 'insurance' || (d && d.kind === 'insurance') ? 1 : 6));
    $('docNote').value = d ? (d.note || '') : '';
    $('docDelBox').hidden = !d;
    openSheet($('docBg'));
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-doc]');
    if (b && !b.closest('.cl-sheet')) openDoc(b.dataset.doc);
  });
  $('docAdd').addEventListener('click', function () { openDoc(null); });
  $('docForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = all(), d = editingDoc ? t.docs.filter(function (x) { return x.id === editingDoc; })[0] : null;
    if (!d) { d = { id: F.uid() }; t.docs.push(d); }
    Object.assign(d, { kind: dkind, name: $('docName').value.trim().slice(0, 60) || D[dkind].name, expires: $('docExp').value || '',
      remind: +$('docRemind').value || 6, note: $('docNote').value.trim().slice(0, 120) });
    F.saveTravel(t);
    closeSheet($('docBg'));
  });
  $('docDelete').addEventListener('click', function () {
    var t = all();
    t.docs = t.docs.filter(function (x) { return x.id !== editingDoc; });
    F.saveTravel(t);
    closeSheet($('docBg'));
  });

  /* ================= wiring ================= */
  function refresh() { if (openId) renderDetail(); else renderList(); }
  window.addEventListener('travel:change', refresh);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash.reload = function () { if (prevReload) prevReload(); refresh(); };
  window.Trips = { docStatus: docStatus, tripDays: tripDays, planned: planned, ensurePlace: ensurePlace };
  window.Vault.onUnlock(function () { renderList(); fromHash(); });
  window.Vault.onLock(function () { closeTrip(); });
})();
} catch (e) { console.error("travel/trips.js", e); }
/* ===== travel/history.js ===== */
try {
/* Travel page, part 3: history – where you've been, days away, countries and what trips cost. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var F = window.Flow, C = window.Cal, W = window.World, esc = C.esc;
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  var shown = false, mapSig = '', openYears = {};
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d.classList && d.classList.contains('hs-year')) openYears[d.dataset.y] = d.open;
  }, true);

  function daysIn(tr, year, until) {
    var n = 0, d = tr.start, end = tr.end || tr.start;
    for (var i = 0; d <= end && i < 400; i++) {
      if ((!year || d.slice(0, 4) === String(year)) && d <= until) n++;
      d = W.addDays(d, 1);
    }
    return n;
  }
  function travelSpend(year) {
    var v = window.Vault && window.Vault.get();
    return ((v && v.expenses) || []).filter(function (e) { return e.cat === 'travel' && String(e.date).slice(0, 4) === String(year); })
      .reduce(function (a, e) { return a + (e.amount || 0); }, 0);
  }

  function render() {
    if (!shown) return;
    var t = F.travel(), td = F.dkey(new Date()), y = new Date().getFullYear();
    var taken = t.trips.filter(function (x) { return x.start <= td; }).sort(function (a, b) { return a.start > b.start ? -1 : 1; });
    /* trips without a looked-up place (typed long ago, or only a name) count once we know where */
    if (window.Trips && window.Trips.ensurePlace) t.trips.forEach(function (x) { if (!x.place) window.Trips.ensurePlace(x); });
    var past = taken.filter(function (x) { return (x.end || x.start) < td; });
    var thisYear = taken.filter(function (x) { return x.start.slice(0, 4) === String(y) || (x.end || x.start).slice(0, 4) === String(y); });
    var countries = {};
    taken.forEach(function (x) {
      if (!x.place || !x.place.cc) return;
      var c = countries[x.place.cc] = countries[x.place.cc] || { name: x.place.country, cc: x.place.cc, trips: 0, days: 0, last: '' };
      c.trips++; c.days += daysIn(x, null, td); if (x.start > c.last) c.last = x.start;
    });
    var abroad = Object.keys(countries).filter(function (k) { return k !== 'NO'; });
    var spent = travelSpend(y);
    var T = [
      { i: 'suitcase-lg', l: 'Trips in ' + y, v: String(thisYear.length), s: taken.length + ' in total' },
      { i: 'calendar-week', l: 'Days away in ' + y, v: String(thisYear.reduce(function (a, x) { return a + daysIn(x, y, td); }, 0)), s: 'counting today' },
      { i: 'globe-europe-africa', l: 'Countries visited', v: String(abroad.length), s: abroad.length ? 'outside Norway' : 'Add a destination to your trips' },
      { i: 'cash-coin', l: 'Spent on travel ' + y, v: esc(nf.format(spent)), s: 'Travel in Finances' }
    ];
    $('hsTiles').innerHTML = T.map(function (x) {
      return '<div class="fp-tile" data-tk="' + x.l.replace(/\b(19|20)\d\d\b/g, 'Y') + '"><div class="lbl"><i class="bi bi-' + x.i + '"></i>' + x.l + '</div><div class="val">' + x.v + '</div><div class="sub">' + x.s + '</div></div>';
    }).join('');

    /* year by year */
    var years = {};
    taken.forEach(function (x) {
      var yy = x.start.slice(0, 4);
      var r = years[yy] = years[yy] || { trips: 0, days: 0 };
      r.trips++; r.days += daysIn(x, null, td);
    });
    var ks = Object.keys(years).sort().reverse(), max = Math.max.apply(null, ks.map(function (k) { return years[k].days; }).concat([1]));
    $('hsYears').innerHTML = ks.length ? '<ul class="hs-years">' + ks.map(function (k) {
      return '<li><span class="y">' + k + '</span><span class="bar"><i style="width:' + Math.max(4, years[k].days / max * 100) + '%"></i></span>' +
        '<span class="v">' + years[k].days + ' day' + (years[k].days === 1 ? '' : 's') + ' · ' + years[k].trips + ' trip' + (years[k].trips === 1 ? '' : 's') + '</span></li>';
    }).join('') + '</ul>' : '<p class="muted">Nothing yet.</p>';

    /* countries */
    var cl = Object.keys(countries).map(function (k) { return countries[k]; }).sort(function (a, b) { return b.trips - a.trips || (a.last < b.last ? 1 : -1); });
    $('hsCountries').innerHTML = cl.length ? '<ul class="hs-countries">' + cl.map(function (c) {
      return '<li><span class="cc">' + esc(c.cc) + '</span><span class="n">' + esc(c.name) + '</span><span class="v">' + c.trips + ' trip' + (c.trips > 1 ? 's' : '') + ' · ' + c.days + ' d</span></li>';
    }).join('') + '</ul>' : '<p class="muted">Trips with a destination show up here.</p>';

    /* past trips, a year at a time (the newest year open) – so the list never gets long */
    var byYear = {};
    past.forEach(function (x) { (byYear[x.start.slice(0, 4)] = byYear[x.start.slice(0, 4)] || []).push(x); });
    var nf2 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
    $('tpPast').innerHTML = Object.keys(byYear).sort().reverse().map(function (yy, i) {
      var list = byYear[yy], days = list.reduce(function (a, x) { return a + daysIn(x, null, td); }, 0);
      var cost = list.reduce(function (a, x) { return a + (window.Trips ? window.Trips.planned(x) : 0); }, 0);
      var open = openYears[yy] != null ? openYears[yy] : i === 0;
      return '<details class="hs-year" data-y="' + yy + '"' + (open ? ' open' : '') + '><summary><b>' + yy + '</b><span class="muted">' + list.length + ' trip' + (list.length > 1 ? 's' : '') +
        ' · ' + days + ' day' + (days === 1 ? '' : 's') + (cost ? ' · ' + esc(nf2.format(cost)) + ' kr' : '') + '</span><i class="bi bi-chevron-down"></i></summary>' +
        '<ul class="hs-trips">' + list.map(function (x) {
          var c = window.Trips ? window.Trips.planned(x) : 0;
          return '<li><button type="button" class="hs-trip" data-trip="' + esc(x.id) + '"><span class="cc">' + esc(x.place && x.place.cc ? x.place.cc : '–') + '</span>' +
            '<span class="x"><b>' + esc(x.name) + '</b><small>' + esc(window.TravelPage.rangeLabel(x)) + (x.place && x.place.country ? ', ' + esc(x.place.country) : '') + '</small></span>' +
            (c ? '<span class="a">' + esc(nf2.format(c)) + ' kr</span>' : '') + '<i class="bi bi-chevron-right"></i></button></li>';
        }).join('') + '</ul></details>';
    }).join('');
    $('hsEmpty').hidden = past.length > 0;

    /* map: been (accent) and coming up (teal) */
    var upcoming = t.trips.filter(function (x) { return x.start > td && x.place; });
    var pts = taken.filter(function (x) { return x.place; }).map(function (x) {
      return { lat: x.place.lat, lon: x.place.lon, label: '<b>' + esc(x.name) + '</b><br>' + esc(x.place.name + ', ' + x.place.country) + '<br><small>' + esc(x.start) + '</small>', color: 'var(--accent)' };
    }).concat(upcoming.map(function (x) {
      return { lat: x.place.lat, lon: x.place.lon, label: '<b>' + esc(x.name) + '</b> (coming up)<br>' + esc(x.place.name + ', ' + x.place.country), color: '#0891b2' };
    }));
    /* Places to visit (Settings → Features) */
    var Fe = window.Features;
    if (Fe && Fe.on('bucket')) Fe.list('bucket').forEach(function (b) {
      if (b.visited || !b.geo || b.geo.lat == null) return;
      pts.push({ lat: b.geo.lat, lon: b.geo.lon, label: '<b>' + esc(b.place) + '</b> (want to visit)<br>' + esc(b.geo.country || ''), color: '#c9a227' });
    });
    var places = {};
    pts.forEach(function (p) { places[p.lat + ',' + p.lon] = 1; });
    $('hsPlaces').textContent = Object.keys(places).length ? Object.keys(places).length + ' place' + (Object.keys(places).length > 1 ? 's' : '') : '';
    var view = 'map';
    try { view = localStorage.getItem('dash.hsView') || 'map'; } catch (e) {}
    $('hsView').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
    var sig = view + JSON.stringify(pts.map(function (p) { return [p.lat, p.lon, p.color]; })) + document.documentElement.getAttribute('data-theme');
    if (view === 'globe') {
      if (sig !== mapSig || !$('hsMap')._globe) {
        mapSig = sig;
        /* countries you've been to are shaded; the globe uses numeric country codes */
        var been = Object.keys(countries).map(function (k) { return NUM[k]; }).filter(Boolean);
        W.globe($('hsMap'), pts, { countries: been }).catch(function () { mapSig = ''; });
      }
    } else if (sig !== mapSig || !$('hsMap')._map) {
      mapSig = sig;
      if ($('hsMap')._globe) { $('hsMap')._globe.stop(); $('hsMap')._globe = null; }
      W.map($('hsMap'), pts, { zoom: 4, maxZoom: 6 }).catch(function () {});
    } else setTimeout(function () { $('hsMap')._map.invalidateSize(); }, 50);
  }

  /* ISO alpha-2 → numeric, for shading countries on the globe */
  var NUM = { AF: 4, AL: 8, DZ: 12, AD: 20, AO: 24, AR: 32, AM: 51, AU: 36, AT: 40, AZ: 31, BS: 44, BH: 48, BD: 50, BY: 112, BE: 56, BZ: 84, BJ: 204, BT: 64, BO: 68, BA: 70, BW: 72, BR: 76, BN: 96, BG: 100, BF: 854, BI: 108, KH: 116, CM: 120, CA: 124, CF: 140, TD: 148, CL: 152, CN: 156, CO: 170, CG: 178, CD: 180, CR: 188, CI: 384, HR: 191, CU: 192, CY: 196, CZ: 203, DK: 208, DJ: 262, DO: 214, EC: 218, EG: 818, SV: 222, GQ: 226, ER: 232, EE: 233, ET: 231, FJ: 242, FI: 246, FR: 250, GA: 266, GM: 270, GE: 268, DE: 276, GH: 288, GR: 300, GL: 304, GT: 320, GN: 324, GW: 624, GY: 328, HT: 332, HN: 340, HU: 348, IS: 352, IN: 356, ID: 360, IR: 364, IQ: 368, IE: 372, IL: 376, IT: 380, JM: 388, JP: 392, JO: 400, KZ: 398, KE: 404, KP: 408, KR: 410, KW: 414, KG: 417, LA: 418, LV: 428, LB: 422, LS: 426, LR: 430, LY: 434, LT: 440, LU: 442, MK: 807, MG: 450, MW: 454, MY: 458, ML: 466, MT: 470, MR: 478, MX: 484, MD: 498, MN: 496, ME: 499, MA: 504, MZ: 508, MM: 104, NA: 516, NP: 524, NL: 528, NZ: 554, NI: 558, NE: 562, NG: 566, NO: 578, OM: 512, PK: 586, PA: 591, PG: 598, PY: 600, PE: 604, PH: 608, PL: 616, PT: 620, PR: 630, QA: 634, RO: 642, RU: 643, RW: 646, SA: 682, SN: 686, RS: 688, SL: 694, SG: 702, SK: 703, SI: 705, SB: 90, SO: 706, ZA: 710, SS: 728, ES: 724, LK: 144, SD: 729, SR: 740, SE: 752, CH: 756, SY: 760, TW: 158, TJ: 762, TZ: 834, TH: 764, TL: 626, TG: 768, TT: 780, TN: 788, TR: 792, TM: 795, UG: 800, UA: 804, AE: 784, GB: 826, US: 840, UY: 858, UZ: 860, VU: 548, VE: 862, VN: 704, EH: 732, YE: 887, ZM: 894, ZW: 716, XK: 383, PS: 275, LI: 438, MC: 492, SM: 674, VA: 336, KM: 174, MU: 480, CV: 132, ST: 678, SC: 690, MV: 462, BB: 52, LC: 662, VC: 670, GD: 308, AG: 28, DM: 212, KN: 659, WS: 882, TO: 776, KI: 296, FM: 583, MH: 584, PW: 585, NR: 520, TV: 798, SZ: 748, FK: 238, NC: 540, PF: 258, TF: 260, HK: 344, MO: 446 };
  $('hsView').addEventListener('click', function (e) {
    var b = e.target.closest('[data-view]'); if (!b) return;
    try { localStorage.setItem('dash.hsView', b.dataset.view); } catch (x) {}
    mapSig = ''; render();
  });
  window.addEventListener('travel:tab', function (e) { shown = e.detail === 'history'; render(); });
  window.addEventListener('travel:change', render);
  window.addEventListener('tools:change', render);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
})();
} catch (e) { console.error("travel/history.js", e); }
/* ===== kit.js ===== */
try {
/* Kit: one building block for the smaller tools – a card with a summary, a list and an
   add/edit sheet generated from a list of fields. Data lives in Features.tools()[key]. */
(function () {
  "use strict";
  var F = window.Features;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function today() { return F.dkey(new Date()); }
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function fmt(k, o) { return k ? F.fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

  /* ---------- one shared sheet ---------- */
  var sheet = null;
  function ensureSheet() {
    if (sheet) return sheet;
    var bg = document.createElement('div');
    bg.className = 'cl-sheet-bg kit-bg'; bg.hidden = true;
    bg.innerHTML = '<form class="cl-sheet kit-sheet" role="dialog" aria-modal="true" autocomplete="off">' +
      '<div class="cl-sheet-head"><button class="text-btn" type="button" data-close>Cancel</button><h2></h2><button class="pill-btn" type="submit">Save</button></div>' +
      '<div class="cl-edit kit-fields"></div><div class="cl-del kit-del" hidden><button class="text-btn danger" type="button"><i class="bi bi-trash3"></i> <span>Delete</span></button></div></form>';
    document.body.appendChild(bg);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bg.hidden) close(); });
    sheet = { bg: bg, form: bg.querySelector('form'), fields: bg.querySelector('.kit-fields'), title: bg.querySelector('h2'), del: bg.querySelector('.kit-del') };
    return sheet;
  }
  function open() {
    var s = ensureSheet();
    s.bg.hidden = false;
    requestAnimationFrame(function () { s.bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
  }
  function close() {
    if (!sheet) return;
    sheet.bg.classList.remove('open');
    document.documentElement.classList.remove('cl-modal');
    setTimeout(function () { sheet.bg.hidden = true; }, 220);
  }

  function input(f, v) {
    var id = 'kf-' + f.k, req = f.req ? ' required' : '', ph = f.ph ? ' placeholder="' + esc(f.ph) + '"' : '';
    var val = v == null ? '' : v;
    if (f.type === 'textarea') return '<textarea id="' + id + '" rows="' + (f.rows || 3) + '"' + ph + req + ' maxlength="' + (f.max || 2000) + '">' + esc(val) + '</textarea>';
    if (f.type === 'select') return '<select id="' + id + '" class="st-wide">' + (typeof f.options === 'function' ? f.options() : f.options).map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select>';
    if (f.type === 'check') return '<input type="checkbox" class="switch" id="' + id + '"' + (val ? ' checked' : '') + '>';
    var t = f.type === 'number' ? 'text" inputmode="decimal' : (f.type || 'text');
    return '<input id="' + id + '" type="' + t + '"' + ph + req + ' maxlength="' + (f.max || 200) + '" value="' + esc(val) + '">';
  }
  function edit(cfg, item) {
    var s = ensureSheet(), isNew = !item;
    item = item ? JSON.parse(JSON.stringify(item)) : {};
    s.title.textContent = isNew ? (cfg.addTitle || 'Add') : (cfg.editTitle || 'Edit');
    var rows = '', inline = '';
    cfg.fields.forEach(function (f) {
      var v = item[f.k] != null ? item[f.k] : (isNew && f.def != null ? (typeof f.def === 'function' ? f.def() : f.def) : '');
      if (f.type === 'title') { rows += '<input class="cl-in-title" id="kf-' + f.k + '" placeholder="' + esc(f.ph || f.label) + '"' + (f.req ? ' required' : '') + ' maxlength="' + (f.max || 120) + '" value="' + esc(v) + '">'; return; }
      var line = '<label class="st-row kit-row' + (f.type === 'textarea' ? ' kit-tall' : '') + '"><span>' + esc(f.label) + '</span>' + input(f, v) + (f.suffix ? '<em>' + esc(f.suffix) + '</em>' : '') + '</label>';
      if (f.type === 'textarea') rows += '<div class="cl-group cl-group-text kit-text"><span class="kit-lbl">' + esc(f.label) + '</span>' + input(f, v) + (f.help ? '<small class="kit-help">' + esc(f.help) + '</small>' : '') + '</div>';
      else rows += '<div class="cl-group">' + line + (f.help ? '<small class="kit-help">' + esc(f.help) + '</small>' : '') + '</div>';
    });
    s.fields.innerHTML = rows;
    s.del.hidden = isNew;
    var delArmed = false;
    s.del.querySelector('span').textContent = 'Delete';
    s.del.querySelector('button').onclick = function () {
      if (!delArmed) { delArmed = true; s.del.querySelector('span').textContent = 'Tap again to delete'; return; }
      var t = F.tools(); t[cfg.key] = (t[cfg.key] || []).filter(function (x) { return x.id !== item.id; });
      if (cfg.onDelete) cfg.onDelete(item);
      F.saveTools(t); close();
    };
    s.form.onsubmit = function (e) {
      e.preventDefault();
      var bad = null;
      cfg.fields.forEach(function (f) {
        var el = document.getElementById('kf-' + f.k);
        if (!el) return;
        var v = f.type === 'check' ? el.checked : el.value.trim();
        if (f.type === 'number') v = v === '' ? '' : (num(v) == null ? (bad = bad || el, '') : num(v));
        if (f.req && (v === '' || v == null)) bad = bad || el;
        item[f.k] = v;
      });
      if (bad) { bad.focus(); bad.classList.add('kit-bad'); return; }
      if (!item.id) item.id = uid();
      if (cfg.beforeSave) cfg.beforeSave(item, isNew);
      var t = F.tools(), l = Array.isArray(t[cfg.key]) ? t[cfg.key] : [];
      var i = l.findIndex(function (x) { return x.id === item.id; });
      if (i > -1) l[i] = item; else l.push(item);
      t[cfg.key] = l;
      F.saveTools(t);
      if (cfg.afterSave) cfg.afterSave(item, isNew);
      close();
    };
    open();
    if (isNew && innerWidth >= 700) setTimeout(function () { var first = s.fields.querySelector('input,textarea'); if (first) first.focus(); }, 60);
  }

  /* ---------- a collection card ---------- */
  function collection(cfg) {
    var el = cfg.mount, showAll = false, openId = null, scrolled = false;
    if (!el) return null;
    function render() {
      var on = F.on(cfg.feature);
      el.hidden = !on;
      if (!on) { el.innerHTML = ''; return; }
      var items = F.list(cfg.key).slice();
      if (cfg.sort) items.sort(cfg.sort);
      var lim = cfg.limit || 8, shown = showAll ? items : items.slice(0, lim);
      el.innerHTML = '<section class="card kit-card" id="' + cfg.key + '">' +
        '<div class="card-head"><h2><i class="bi bi-' + cfg.icon + '"></i> ' + esc(cfg.title) + '</h2>' +
        '<div class="head-actions">' + (cfg.headExtra ? cfg.headExtra(items) : '') + '<button class="text-btn" type="button" data-kit-add><i class="bi bi-plus-lg"></i> ' + esc(cfg.addLabel || 'Add') + '</button></div></div>' +
        (cfg.summary ? '<div class="kit-sum">' + cfg.summary(items) + '</div>' : '') +
        (cfg.above ? cfg.above(items) : '') +
        (items.length ? '<ul class="kit-list">' + shown.map(function (it) {
          var r = cfg.row(it);
          return '<li class="kit-item' + (r.cls ? ' ' + r.cls : '') + (openId === it.id ? ' open' : '') + '" data-id="' + esc(it.id) + '">' +
            '<button type="button" class="kit-main" data-kit-' + (cfg.detail ? 'toggle' : 'edit') + '="' + esc(it.id) + '">' +
            (r.icon ? '<span class="kit-ic" style="--c:' + (r.color || 'var(--accent)') + '"><i class="bi bi-' + r.icon + '"></i></span>' : '') +
            '<span class="kit-x"><b>' + esc(r.title) + '</b>' + (r.sub ? '<small>' + r.sub + '</small>' : '') + '</span>' +
            (r.right ? '<span class="kit-r">' + r.right + '</span>' : '') + '</button>' +
            (cfg.detail && openId === it.id ? '<div class="kit-detail">' + cfg.detail(it) + '<button type="button" class="text-btn" data-kit-edit="' + esc(it.id) + '"><i class="bi bi-pencil"></i> Edit</button></div>' : '') +
            '</li>';
        }).join('') + '</ul>' : '<p class="empty kit-empty">' + esc(cfg.empty || 'Nothing here yet.') + '</p>') +
        (items.length > lim ? '<button class="text-btn kit-more" type="button" data-kit-more>' + (showAll ? 'Show less' : 'Show all ' + items.length) + '</button>' : '') +
        '</section>';
      if (cfg.afterRender) cfg.afterRender(el, items);
      /* arriving from a calendar reminder (…/#subs): scroll to the card once */
      if (!scrolled && location.hash === '#' + cfg.key && document.documentElement.classList.contains('unlocked')) {
        scrolled = true;
        /* wait until the rest of the page has drawn (charts, lists), then scroll */
        setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 450);
      }
    }
    el.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-kit-add]')) return edit(cfg, null);
      if ((b = e.target.closest('[data-kit-edit]'))) return edit(cfg, F.list(cfg.key).filter(function (x) { return x.id === b.dataset.kitEdit; })[0]);
      if ((b = e.target.closest('[data-kit-toggle]'))) { openId = openId === b.dataset.kitToggle ? null : b.dataset.kitToggle; return render(); }
      if (e.target.closest('[data-kit-more]')) { showAll = !showAll; return render(); }
      if (cfg.onClick) cfg.onClick(e, render);
    });
    window.addEventListener('tools:change', render);
    window.addEventListener('features:change', render);
    var prevReload = window.Dash && window.Dash.reload;
    window.Dash = window.Dash || {};
    window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
    if (window.Vault) window.Vault.onUnlock(render);
    return { render: render, edit: function (it) { edit(cfg, it); } };
  }

  window.Kit = { collection: collection, edit: edit, close: close, esc: esc, uid: uid, num: num, kr: kr, fmt: fmt, today: today };
})();
} catch (e) { console.error("kit.js", e); }
/* ===== tools.js ===== */
try {
/* The optional tools (Settings → Features). Each one mounts into a [data-tool="…"]
   container on the page where it belongs:
   Work page:      flex time, meeting notes, courses & certificates
   Habits page:    training log, journal
   Travel page:    places to visit
   Finance page:   subscriptions, warranties & receipts
   Dashboard:      a small "Work today" card for flex time */
(function () {
  "use strict";
  var F = window.Features, K = window.Kit;
  if (!F || !K) return;
  var esc = K.esc, today = K.today, fmt = K.fmt, kr = K.kr;
  function $t(name) { return document.querySelector('[data-tool="' + name + '"]'); }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
  function addDays(k, n) { var d = F.fromKey(k); d.setDate(d.getDate() + n); return F.dkey(d); }
  function tile(label, value, sub) { return '<div class="kit-tile" data-tk="' + String(label).replace(/\b(19|20)\d\d\b/g, 'Y').replace(/"/g, '') + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function hm(min) {
    var neg = min < 0; min = Math.abs(Math.round(min));
    var h = Math.floor(min / 60), m = min % 60;
    return (neg ? '−' : '') + (h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min');
  }
  /* short form for the number tiles: 15 h 26 → "15h 26m" */
  function hms(min) {
    var neg = min < 0; min = Math.abs(Math.round(min));
    var h = Math.floor(min / 60), m = min % 60;
    return (neg ? '−' : '') + (h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm');
  }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function nowHM() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  /* ================= WORK: flex time ================= */
  var FLEX_TYPES = { work: 'Work', vacation: 'Holiday (ferie)', sick: 'Sick', flexoff: 'Flex day off (avspasering)', holiday: 'Public holiday', course: 'Course / travel' };
  function flexCfg() { var c = F.tools().flexcfg || {}; return { norm: +c.norm || 7.5, vacation: +c.vacation || 25 }; }
  function worked(e, isToday) {
    if (e.type !== 'work' && e.type !== 'course') return 0;
    var a = toMin(e.in), b = toMin(e.out);
    if (a == null) return 0;
    if (b == null) { if (!isToday) return 0; b = toMin(nowHM()); }
    var w = b - a; if (w < 0) w += 1440;
    return Math.max(0, w - (+e.brk || 0));
  }
  function flexDays() {
    var by = {}, td = today();
    F.list('flex').forEach(function (e) { (by[e.date] = by[e.date] || []).push(e); });
    var norm = flexCfg().norm * 60;
    return Object.keys(by).sort().map(function (k) {
      var es = by[k], open = es.some(function (e) { return (e.type === 'work' || e.type === 'course') && e.in && !e.out; });
      var w = es.reduce(function (a, e) { return a + worked(e, k === td); }, 0);
      var free = es.some(function (e) { return e.type === 'vacation' || e.type === 'sick' || e.type === 'holiday'; });
      var hol = F.holiday(k) && F.fromKey(k).getDay() % 6 !== 0;   // public holiday on a weekday: all work is extra
      var delta = free ? 0 : hol ? w : w - norm;
      return { date: k, entries: es, worked: w, delta: delta, open: open, free: free };
    });
  }
  function flexStats() {
    var days = flexDays(), td = today(), y = td.slice(0, 4), mon = F.dkey(monday(new Date()));
    var balance = days.filter(function (d) { return d.date < td || (d.date === td && !d.open); }).reduce(function (a, d) { return a + d.delta; }, 0);
    var t = days.filter(function (d) { return d.date === td; })[0];
    var week = days.filter(function (d) { return d.date >= mon && d.date <= td; });
    var weekWorked = week.reduce(function (a, d) { return a + d.worked; }, 0);
    var wd = Math.min(5, ((new Date().getDay() + 6) % 7) + 1), off = {};
    week.forEach(function (d) { if (d.free) off[d.date] = 1; });
    for (var i = 0; i < wd; i++) { var hk = addDays(mon, i); if (F.holiday(hk)) off[hk] = 1; }
    var weekFree = Object.keys(off).filter(function (k) { var g = F.fromKey(k).getDay(); return g > 0 && g < 6; }).length;
    var weekTarget = Math.max(0, wd - weekFree) * flexCfg().norm * 60;
    var vac = F.list('flex').filter(function (e) { return e.type === 'vacation' && String(e.date).slice(0, 4) === y; }).length;
    var openE = F.list('flex').filter(function (e) { return e.date === td && (e.type === 'work' || e.type === 'course') && e.in && !e.out; })[0];
    return { balance: balance, today: t ? t.worked : 0, open: openE, week: weekWorked, weekTarget: weekTarget, vac: vac };
  }
  function clock() {
    var t = F.tools(), l = Array.isArray(t.flex) ? t.flex : [], td = today();
    var open = l.filter(function (e) { return e.date === td && e.in && !e.out && e.type === 'work'; })[0];
    if (open) open.out = nowHM();
    else l.push({ id: K.uid(), date: td, type: 'work', in: nowHM(), out: '', brk: l.some(function (e) { return e.date === td && e.type === 'work'; }) ? 0 : (+(t.flexcfg || {}).brk || 0) });
    t.flex = l;
    F.saveTools(t);
  }
  function clockBlock(s) {
    return '<div class="flex-clock">' +
      '<div class="fc-now"><span class="fc-dot' + (s.open ? ' on' : '') + '"></span><span>' + (s.open ? 'Clocked in at <b>' + esc(s.open.in) + '</b>' : 'Not clocked in') + '</span></div>' +
      '<b class="fc-time" data-flex-live>' + hm(s.today) + '</b><small>today</small>' +
      '<button type="button" class="pill-btn fc-btn' + (s.open ? ' out' : '') + '" data-flex-clock><i class="bi bi-' + (s.open ? 'stop-fill' : 'play-fill') + '"></i> ' + (s.open ? 'Clock out' : 'Clock in') + '</button></div>';
  }
  var flex = K.collection({
    mount: $t('flex'), feature: 'flex', key: 'flex', title: 'Flex time', icon: 'stopwatch', addLabel: 'Add day',
    addTitle: 'Add a day', editTitle: 'Edit day', limit: 6,
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'type', label: 'Type', type: 'select', options: Object.keys(FLEX_TYPES).map(function (k) { return [k, FLEX_TYPES[k]]; }), def: 'work' },
      { k: 'in', label: 'In', type: 'time' }, { k: 'out', label: 'Out', type: 'time' },
      { k: 'brk', label: 'Unpaid break', type: 'number', suffix: 'min', def: 0, help: 'Only if lunch is not part of your paid time.' },
      { k: 'note', label: 'Note', type: 'textarea', rows: 2 }
    ],
    sort: function (a, b) { return (b.date + (b.in || '')) > (a.date + (a.in || '')) ? 1 : -1; },
    summary: function () {
      var s = flexStats(), c = flexCfg();
      return clockBlock(s) + '<div class="kit-tiles">' +
        tile('Flex balance', '<span class="' + (s.balance < 0 ? 'neg' : 'pos') + '">' + (s.balance > 0 ? '+' : '') + hms(s.balance) + '</span>', 'logged days') +
        tile('This week', hms(s.week), 'of ' + hms(s.weekTarget)) +
        tile('Holiday ' + today().slice(0, 4), s.vac + ' <small>/ ' + c.vacation + '</small>', 'days used') + '</div>';
    },
    row: function (e) {
      var isT = e.date === today(), w = worked(e, isT), lbl = FLEX_TYPES[e.type] || 'Work';
      return { icon: e.type === 'vacation' ? 'sun' : e.type === 'sick' ? 'thermometer-half' : e.type === 'flexoff' ? 'cup-hot' : e.type === 'holiday' ? 'flag' : 'briefcase',
        color: e.type === 'work' || e.type === 'course' ? '#e8743b' : '#7a8794',
        title: fmt(e.date, { weekday: 'short', day: 'numeric', month: 'short' }) + (e.type !== 'work' ? ' · ' + lbl : ''),
        sub: (e.in ? esc(e.in) + '–' + (e.out ? esc(e.out) : 'now') : '') + (e.brk ? ' · ' + e.brk + ' min break' : '') + (e.note ? ' · ' + esc(e.note) : ''),
        right: e.type === 'work' || e.type === 'course' ? hm(w) : '' };
    },
    empty: 'Tap “Clock in” when you start, “Clock out” when you leave. Holidays and flex days off go in with “Add day”.',
    afterRender: function (el) {
      var c = flexCfg();
      el.querySelector('.kit-card').insertAdjacentHTML('beforeend', '<p class="kit-foot">Normal day ' + String(c.norm).replace('.', ',') + ' h · ' + c.vacation + ' holiday days a year · <a href="/cmd/?settings=work">Change</a></p>' +
        '<div class="fr-bar"><span class="muted"><i class="bi bi-file-earmark-text"></i> Monthly report</span><select class="fr-month" aria-label="Month for the report">' + reportMonths() + '</select>' +
        '<button type="button" class="text-btn" data-frcsv>CSV</button><button type="button" class="text-btn" data-frpdf>PDF</button></div>');
    },
    onClick: function (e) {
      if (e.target.closest('[data-flex-clock]')) clock();
      var m = e.target.closest('.kit-card') && e.target.closest('.kit-card').querySelector('.fr-month');
      if (e.target.closest('[data-frcsv]') && m) reportCsv(m.value);
      if (e.target.closest('[data-frpdf]') && m) reportPdf(m.value);
    }
  });

  /* ---------- monthly report: every day, hours, flex and days off – CSV or a printable page (Save as PDF) ---------- */
  function reportMonths() {
    var out = '', d = new Date(), have = {};
    F.list('flex').forEach(function (e) { have[String(e.date).slice(0, 7)] = 1; });
    for (var i = 0; i < 13; i++) {
      var x = new Date(d.getFullYear(), d.getMonth() - i, 1), k = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
      if (i > 0 && !have[k]) continue;
      out += '<option value="' + k + '">' + x.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + '</option>';
    }
    return out;
  }
  function report(ym) {
    var c = flexCfg(), days = flexDays(), inM = days.filter(function (d) { return d.date.slice(0, 7) === ym; });
    var end = ym + '-31', bal = days.filter(function (d) { return d.date <= end && !d.open; }).reduce(function (a, d) { return a + d.delta; }, 0);
    var rows = [];
    inM.forEach(function (d) {
      d.entries.forEach(function (e) {
        rows.push({ date: d.date, wd: F.fromKey(d.date).toLocaleDateString('en-GB', { weekday: 'short' }), type: FLEX_TYPES[e.type] || 'Work', in: e.in || '', out: e.out || '', brk: +e.brk || 0, worked: worked(e, false), note: e.note || '' });
      });
    });
    var tot = inM.reduce(function (a, d) { return a + d.worked; }, 0), delta = inM.reduce(function (a, d) { return a + d.delta; }, 0);
    var count = function (t) { return F.list('flex').filter(function (e) { return e.type === t && String(e.date).slice(0, 7) === ym; }).length; };
    return { ym: ym, name: new Date(ym + '-15').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), rows: rows, total: tot, delta: delta, balance: bal, norm: c.norm,
      vacation: count('vacation'), sick: count('sick'), flexoff: count('flexoff'), days: inM.filter(function (d) { return d.worked > 0; }).length };
  }
  function hmPlain(m) { var s = m < 0 ? '-' : ''; m = Math.abs(Math.round(m)); return s + Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }
  function download(name, type, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function reportCsv(ym) {
    var r = report(ym), q = function (v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['Date', 'Day', 'Type', 'In', 'Out', 'Break (min)', 'Worked (h:mm)', 'Note'].join(';')]
      .concat(r.rows.map(function (x) { return [x.date, x.wd, x.type, x.in, x.out, x.brk, hmPlain(x.worked), x.note].map(q).join(';'); }))
      .concat(['', 'Total worked;' + hmPlain(r.total), 'Flex this month;' + hmPlain(r.delta), 'Flex balance at month end;' + hmPlain(r.balance),
        'Holiday days;' + r.vacation, 'Sick days;' + r.sick, 'Flex days off;' + r.flexoff, 'Normal day (h);' + String(r.norm).replace('.', ',')]);
    download('flex-' + ym + '.csv', 'text/csv;charset=utf-8', '\ufeff' + lines.join('\r\n'));
  }
  function reportPdf(ym) {
    var r = report(ym), me = (function () { try { return JSON.parse(localStorage.getItem('dash.profile')) || {}; } catch (e) { return {}; } })();
    var html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Flex time ' + esc(r.name) + '</title><style>' +
      'body{font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:32px auto;max-width:760px;padding:0 20px}h1{font-size:22px;margin:0 0 2px}p.s{color:#555;margin:0 0 18px}' +
      'table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd}th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#555}td.n{text-align:right;font-variant-numeric:tabular-nums}' +
      '.sum{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.sum div{border:1px solid #ddd;border-radius:8px;padding:10px}.sum b{display:block;font-size:18px}.sum span{font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.04em}' +
      '.tip{color:#555;font-size:12px;margin-top:24px}.wrap{overflow-x:auto}@media (max-width:600px){body{margin:20px auto}th,td{padding:5px 4px;font-size:12px}.sum b{font-size:16px}}@media print{.tip{display:none}body{margin:0 auto}}</style></head><body>' +
      '<h1>Flex time – ' + esc(r.name) + '</h1><p class="s">' + esc(me.name || 'John Paul Lundberg') + (me.employer ? ' · ' + esc(me.employer) : '') + ' · normal day ' + String(r.norm).replace('.', ',') + ' h</p>' +
      '<div class="sum"><div><span>Worked</span><b>' + hmPlain(r.total) + '</b>' + r.days + ' days</div><div><span>Flex this month</span><b>' + (r.delta > 0 ? '+' : '') + hmPlain(r.delta) + '</b>balance ' + (r.balance > 0 ? '+' : '') + hmPlain(r.balance) + '</div>' +
      '<div><span>Days off</span><b>' + r.vacation + '</b>holiday · ' + r.sick + ' sick · ' + r.flexoff + ' flex</div></div>' +
      '<div class="wrap"><table><thead><tr><th>Date</th><th>Type</th><th>In</th><th>Out</th><th class="n">Break</th><th class="n">Worked</th><th>Note</th></tr></thead><tbody>' +
      (r.rows.length ? r.rows.map(function (x) { return '<tr><td>' + esc(x.wd + ' ' + x.date.slice(8) + '.' + x.date.slice(5, 7)) + '</td><td>' + esc(x.type) + '</td><td>' + esc(x.in) + '</td><td>' + esc(x.out) + '</td><td class="n">' + (x.brk ? x.brk + ' min' : '') + '</td><td class="n">' + (x.worked ? hmPlain(x.worked) : '') + '</td><td>' + esc(x.note) + '</td></tr>'; }).join('') : '<tr><td colspan="7">Nothing logged this month.</td></tr>') +
      '</tbody></table></div><p class="tip">Use Print → Save as PDF (on iPhone: Share → Print, then pinch out on the preview to get the PDF).</p>' +
      '<script>setTimeout(function(){try{window.print()}catch(e){}},400)<\/script></body></html>';
    var w = null;
    try { w = window.open('', '_blank'); } catch (e) {}
    if (w && w.document) { w.document.open(); w.document.write(html); w.document.close(); }
    else download('flex-' + ym + '.html', 'text/html;charset=utf-8', html);
  }
  document.addEventListener('change', function (e) {
    var k = e.target.dataset && e.target.dataset.flexcfg;
    if (!k) return;
    var v = K.num(e.target.value);
    if (v == null || v <= 0) return;
    var t = F.tools(); t.flexcfg = t.flexcfg || {}; t.flexcfg[k] = v; F.saveTools(t);
  });
  /* keep the running time fresh */
  setInterval(function () {
    if (!F.on('flex')) return;
    var s = flexStats();
    if (!s.open) return;
    document.querySelectorAll('[data-flex-live]').forEach(function (el) { el.textContent = hm(s.today); });
  }, 30000);

  /* Dashboard card: Work today */
  var home = document.getElementById('flexCard');
  function renderHome() {
    if (!home) return;
    var on = F.on('flex');
    home.hidden = !on;
    if (!on) return;
    var s = flexStats();
    home.innerHTML = '<div class="card-head"><h2><i class="bi bi-stopwatch"></i> Work today</h2><a class="text-btn" href="work/">Details</a></div>' +
      clockBlock(s) + '<p class="fc-bal">Flex balance <b class="' + (s.balance < 0 ? 'neg' : 'pos') + '">' + (s.balance > 0 ? '+' : '') + hm(s.balance) + '</b> · this week ' + hm(s.week) + '</p>';
  }
  if (home) {
    home.addEventListener('click', function (e) { if (e.target.closest('[data-flex-clock]')) clock(); });
    window.addEventListener('tools:change', renderHome);
    window.addEventListener('features:change', renderHome);
    if (window.Vault) window.Vault.onUnlock(renderHome);
  }

  /* ================= WORK: meeting notes ================= */
  K.collection({
    mount: $t('meetings'), feature: 'meetings', key: 'meetings', title: 'Meeting notes', icon: 'people', addLabel: 'New',
    addTitle: 'New meeting note', editTitle: 'Edit meeting note',
    fields: [
      { k: 'title', type: 'title', label: 'Title', ph: 'Meeting, e.g. Status FDVU handover', req: true },
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'who', label: 'With', ph: 'Who was there' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 6 },
      { k: 'actions', label: 'Action points', type: 'textarea', rows: 3, help: 'One per line. Tick them off here or send them to your to-do list.' }
    ],
    beforeSave: function (it) { it.done = it.done || {}; },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    row: function (m) {
      var acts = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); }), done = acts.filter(function (_, i) { return (m.done || {})[i]; }).length;
      return { icon: 'people', color: '#3987e5', title: m.title || 'Meeting', sub: fmt(m.date) + (m.who ? ' · ' + esc(m.who) : '') + (acts.length ? ' · ' + done + '/' + acts.length + ' actions' : ''),
        cls: acts.length && done < acts.length ? 'has-open' : '' };
    },
    detail: function (m) {
      var acts = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); });
      return (m.notes ? '<p class="kit-notes">' + esc(m.notes) + '</p>' : '') +
        (acts.length ? '<ul class="kit-checks">' + acts.map(function (a, i) {
          var d = (m.done || {})[i];
          return '<li class="' + (d ? 'done' : '') + '"><label><input type="checkbox" data-mact="' + esc(m.id) + ':' + i + '"' + (d ? ' checked' : '') + '><span>' + esc(a) + '</span></label>' +
            '<button type="button" class="text-btn" data-mtodo="' + esc(m.id) + ':' + i + '"><i class="bi bi-box-arrow-in-right"></i> To-do</button></li>';
        }).join('') + '</ul>' : '');
    },
    empty: 'Write down what was decided and who does what. Action points can go straight to your to-do list.',
    onClick: function (e, render) {
      var b = e.target.closest('[data-mtodo]');
      if (!b) return;
      var p = b.dataset.mtodo.split(':'), m = F.list('meetings').filter(function (x) { return x.id === p[0]; })[0];
      if (!m) return;
      var text = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); })[+p[1]];
      var todos = readJSON('dash.todos') || [];
      todos.push({ id: K.uid(), text: text.trim() + (m.title ? ' (' + m.title + ')' : ''), done: false });
      writeJSON('dash.todos', todos);
      b.innerHTML = '<i class="bi bi-check2"></i> Added';
      b.disabled = true;
    }
  });
  document.addEventListener('change', function (e) {
    var a = e.target.dataset && e.target.dataset.mact;
    if (!a) return;
    var p = a.split(':'), t = F.tools();
    (t.meetings || []).forEach(function (m) { if (m.id === p[0]) { m.done = m.done || {}; if (e.target.checked) m.done[p[1]] = true; else delete m.done[p[1]]; } });
    F.saveTools(t);
  });

  /* ================= WORK: courses & certificates ================= */
  var KINDS = [['course', 'Course'], ['certificate', 'Certificate'], ['book', 'Book'], ['standard', 'Standard / regulation'], ['other', 'Other']];
  var KIND_ICON = { course: 'mortarboard', certificate: 'award', book: 'book', standard: 'file-earmark-text', other: 'lightbulb' };
  var STATUS = [['planned', 'Planned'], ['progress', 'In progress'], ['done', 'Done']];
  function expiryBadge(k) {
    if (!k) return '';
    var days = Math.round((F.fromKey(k) - F.fromKey(today())) / 864e5);
    if (days < 0) return '<span class="kit-badge bad">Expired</span>';
    if (days < 183) return '<span class="kit-badge warn">Expires ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
    return '<span class="kit-badge">Until ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
  }
  K.collection({
    mount: $t('learning'), feature: 'learning', key: 'learning', title: 'Courses & certificates', icon: 'mortarboard',
    addTitle: 'Add course or certificate',
    fields: [
      { k: 'title', type: 'title', label: 'Title', ph: 'e.g. Varme arbeider, NS 3456, Plania advanced', req: true },
      { k: 'kind', label: 'Type', type: 'select', options: KINDS, def: 'course' },
      { k: 'provider', label: 'From', ph: 'Provider or author' },
      { k: 'status', label: 'Status', type: 'select', options: STATUS, def: 'planned' },
      { k: 'date', label: 'Date', type: 'date', help: 'When you took it or plan to.' },
      { k: 'expires', label: 'Expires', type: 'date', help: 'For certificates that must be renewed – you get a reminder in your calendar 2 months before.' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
    ],
    sort: function (a, b) { var o = { progress: 0, planned: 1, done: 2 }; return (o[a.status] - o[b.status]) || ((b.date || '') > (a.date || '') ? 1 : -1); },
    summary: function (items) {
      var y = today().slice(0, 4);
      var done = items.filter(function (c) { return c.status === 'done' && String(c.date || '').slice(0, 4) === y; }).length;
      var prog = items.filter(function (c) { return c.status === 'progress'; }).length;
      var soon = items.filter(function (c) { return c.expires && c.expires < F.addMonths(today(), 6); }).length;
      return items.length ? '<div class="kit-tiles">' + tile('Done in ' + y, done) + tile('In progress', prog) + tile('Expiring soon', '<span class="' + (soon ? 'neg' : '') + '">' + soon + '</span>', 'within 6 months') + '</div>' : '';
    },
    row: function (c) {
      return { icon: KIND_ICON[c.kind] || 'lightbulb', color: '#8a6fdf', title: c.title, cls: c.status === 'done' ? 'is-done' : '',
        sub: [c.provider ? esc(c.provider) : '', (STATUS.filter(function (s) { return s[0] === c.status; })[0] || ['', ''])[1], c.date ? fmt(c.date, { month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · '),
        right: expiryBadge(c.expires) };
    },
    empty: 'Courses you want to take, certificates that need renewing (like varme arbeider or first aid), and standards you’re reading up on.'
  });

  /* ================= HABITS: training log ================= */
  var SPORTS = [['strength', 'Strength', 'trophy'], ['run', 'Running', 'person-walking'], ['walk', 'Walking', 'person-walking'], ['bike', 'Cycling', 'bicycle'],
    ['swim', 'Swimming', 'water'], ['ball', 'Ball sports', 'dribbble'], ['yoga', 'Yoga / mobility', 'person-arms-up'], ['other', 'Other', 'heart-pulse']];
  var EFFORT = [['1', 'Easy'], ['2', 'Light'], ['3', 'Moderate'], ['4', 'Hard'], ['5', 'All out']];
  function habitOptions() {
    var hb = readJSON('dash.habits') || { list: [] };
    return [['', 'Don’t tick a habit']].concat((hb.list || []).map(function (h) { return [h.id, 'Tick “' + h.name + '”']; }));
  }
  function defaultHabit() {
    var hb = readJSON('dash.habits') || { list: [] };
    var h = (hb.list || []).filter(function (x) { return /train|trening|gym|workout|løp|run|exercise/i.test(x.name); })[0];
    return h ? h.id : '';
  }
  K.collection({
    mount: $t('training'), feature: 'training', key: 'training', title: 'Training log', icon: 'heart-pulse', addLabel: 'Log workout',
    addTitle: 'Log a workout', editTitle: 'Edit workout',
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'kind', label: 'Type', type: 'select', options: SPORTS.map(function (s) { return [s[0], s[1]]; }), def: 'strength' },
      { k: 'min', label: 'Time', type: 'number', suffix: 'min', req: true, def: 60 },
      { k: 'km', label: 'Distance', type: 'number', suffix: 'km' },
      { k: 'effort', label: 'How hard', type: 'select', options: EFFORT, def: '3' },
      { k: 'habit', label: 'Habit', type: 'select', options: habitOptions, def: defaultHabit },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, help: 'Exercises, weights, how it felt.' }
    ],
    afterSave: function (w) {
      if (!w.habit) return;
      var hb = readJSON('dash.habits') || { list: [], log: {} };
      hb.log = hb.log || {};
      var l = hb.log[w.date] = hb.log[w.date] || [];
      if (l.indexOf(w.habit) < 0) { l.push(w.habit); writeJSON('dash.habits', hb); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
    },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    summary: function (items) {
      var mon = F.dkey(monday(new Date())), m = today().slice(0, 7);
      var wk = items.filter(function (w) { return w.date >= mon; }), mo = items.filter(function (w) { return String(w.date).slice(0, 7) === m; });
      var sum = function (l, k) { return l.reduce(function (a, w) { return a + (+w[k] || 0); }, 0); };
      return '<div class="kit-tiles">' + tile('This week', wk.length + ' <small>sessions</small>', hms(sum(wk, 'min'))) +
        tile('This month', mo.length + ' <small>sessions</small>', hms(sum(mo, 'min'))) +
        tile('Distance this month', (Math.round(sum(mo, 'km') * 10) / 10).toString().replace('.', ',') + ' <small>km</small>') + '</div>';
    },
    row: function (w) {
      var s = SPORTS.filter(function (x) { return x[0] === w.kind; })[0] || SPORTS[7];
      return { icon: s[2], color: '#d55181', title: s[1], sub: fmt(w.date, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + hm(+w.min || 0) + (w.km ? ' · ' + String(w.km).replace('.', ',') + ' km' : '') + (w.notes ? ' · ' + esc(String(w.notes).slice(0, 60)) : ''),
        right: '<span class="kit-dots">' + [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= +w.effort ? 'on' : '') + '"></i>'; }).join('') + '</span>' };
    },
    empty: 'Log a workout and it also ticks your training habit for that day.'
  });

  /* ================= HEALTH: check-ups, vaccines, medicine ================= */
  var HKINDS = [['checkup', 'Appointment / check-up'], ['vaccine', 'Vaccine'], ['medicine', 'Medicine / prescription']];
  var HICON = { checkup: 'clipboard2-pulse', vaccine: 'shield-plus', medicine: 'capsule' };
  var HNEXT = { checkup: 'Next check-up', vaccine: 'Booster due', medicine: 'Renew by' };
  function dueBadge(k, word) {
    if (!k) return '';
    var days = Math.round((F.fromKey(k) - F.fromKey(today())) / 864e5);
    if (days < 0) return '<span class="kit-badge bad">' + word + ' overdue</span>';
    if (days <= 60) return '<span class="kit-badge warn">' + word + ' ' + fmt(k, { day: 'numeric', month: 'short' }) + '</span>';
    return '<span class="kit-badge">' + word + ' ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
  }
  K.collection({
    mount: $t('health'), feature: 'health', key: 'health', title: 'Check-ups & medicine', icon: 'clipboard2-pulse',
    addTitle: 'Add to health', editTitle: 'Edit',
    fields: [
      { k: 'title', type: 'title', label: 'What', ph: 'e.g. Dentist, Tetanus booster, Allergy pills', req: true },
      { k: 'kind', label: 'Type', type: 'select', options: HKINDS, def: 'checkup' },
      { k: 'date', label: 'Date', type: 'date', def: today, help: 'The appointment, when you took the vaccine, or when it was prescribed.' },
      { k: 'time', label: 'Time', type: 'time', help: 'For appointments – it goes in your calendar.' },
      { k: 'where', label: 'Where / who', ph: 'Clinic, doctor, pharmacy' },
      { k: 'next', label: 'Next / renew by', type: 'date', help: 'Next check-up, when a booster is due, or when the prescription runs out. You get a reminder in your calendar.' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, help: 'Dose, what was said, questions for next time …' }
    ],
    sort: function (a, b) {
      var ka = a.kind === 'checkup' && a.date >= today() ? a.date : (a.next || '9999'), kb = b.kind === 'checkup' && b.date >= today() ? b.date : (b.next || '9999');
      return ka > kb ? 1 : ka < kb ? -1 : 0;
    },
    summary: function (items) {
      if (!items.length) return '';
      var td = today();
      var up = items.filter(function (h) { return h.kind === 'checkup' && h.date >= td; }).sort(function (a, b) { return a.date > b.date ? 1 : -1; })[0];
      var due = items.filter(function (h) { return h.next && h.next <= F.addMonths(td, 2); }).length;
      var vac = items.filter(function (h) { return h.kind === 'vaccine'; }).length;
      return '<div class="kit-tiles">' + tile('Next appointment', up ? fmt(up.date, { weekday: 'short', day: 'numeric', month: 'short' }) : '–', up ? esc(up.title) + (up.time ? ' · ' + esc(up.time) : '') : 'nothing booked') +
        tile('Due soon', '<span class="' + (due ? 'neg' : '') + '">' + due + '</span>', 'within 2 months') + tile('Vaccines', vac, 'on record') + '</div>';
    },
    row: function (h) {
      var past = h.kind === 'checkup' && h.date && h.date < today();
      return { icon: HICON[h.kind] || 'clipboard2-pulse', color: '#e66767', title: h.title,
        sub: [{ checkup: 'Check-up', vaccine: 'Vaccine', medicine: 'Medicine' }[h.kind] || '', h.date ? fmt(h.date) + (h.time && !past ? ' ' + esc(h.time) : '') : '', h.where ? esc(h.where) : ''].filter(Boolean).join(' · '),
        right: dueBadge(h.next, h.kind === 'medicine' ? 'Renew' : h.kind === 'vaccine' ? 'Booster' : 'Next') };
    },
    empty: 'Doctor and dentist appointments, vaccines (useful before trips) and prescriptions. You get reminders in your calendar before things are due.'
  });

  /* ================= HABITS: journal ================= */
  var MOODS = [['1', 'Bad', 'emoji-frown', '#e66767'], ['2', 'Meh', 'emoji-neutral', '#e8743b'], ['3', 'OK', 'emoji-smile', '#c9a227'], ['4', 'Good', 'emoji-laughing', '#22b35e'], ['5', 'Great', 'emoji-heart-eyes', '#14b8a6']];
  function mood(v) { return MOODS.filter(function (m) { return m[0] === String(v); })[0] || MOODS[2]; }
  K.collection({
    mount: $t('journal'), feature: 'journal', key: 'journal', title: 'Journal', icon: 'journal-bookmark', addLabel: 'Today',
    addTitle: 'Journal', editTitle: 'Journal', limit: 7,
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'mood', label: 'Mood', type: 'select', options: MOODS.map(function (m) { return [m[0], m[1]]; }), def: '4' },
      { k: 'line', type: 'title', label: 'Today in one line', ph: 'Today in one sentence', req: true, max: 200 },
      { k: 'notes', label: 'More (optional)', type: 'textarea', rows: 4 }
    ],
    beforeSave: function (it) {    /* one entry per day */
      var t = F.tools();
      t.journal = (t.journal || []).filter(function (x) { return x.date !== it.date || x.id === it.id; });
      F.saveTools(t);
    },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    summary: function (items) {
      var by = {}; items.forEach(function (j) { by[j.date] = j; });
      var cells = '', t = today();
      for (var i = 27; i >= 0; i--) {
        var k = addDays(t, -i), j = by[k];
        cells += '<i title="' + fmt(k, { weekday: 'short', day: 'numeric', month: 'short' }) + (j ? ': ' + mood(j.mood)[1] : '') + '" style="' + (j ? 'background:' + mood(j.mood)[3] : '') + '"></i>';
      }
      var streak = 0; for (var d = 0; d < 400; d++) { if (by[addDays(t, -d)]) streak++; else if (d > 0) break; }
      var last7 = items.filter(function (j) { return j.date > addDays(t, -7); });
      var avg = last7.length ? last7.reduce(function (a, j) { return a + (+j.mood || 0); }, 0) / last7.length : 0;
      return '<div class="kit-mood">' + cells + '</div><p class="kit-moodlbl">Last 4 weeks' + (streak ? ' · ' + streak + ' day' + (streak > 1 ? 's' : '') + ' in a row' : '') + (avg ? ' · this week: ' + mood(Math.round(avg))[1].toLowerCase() : '') + '</p>';
    },
    row: function (j) { var m = mood(j.mood); return { icon: m[2], color: m[3], title: j.line, sub: fmt(j.date, { weekday: 'long', day: 'numeric', month: 'short' }) + (j.notes ? ' · ' + esc(String(j.notes).slice(0, 70)) : '') }; },
    empty: 'One line a day is enough. Over time you’ll see how your weeks really were.'
  });

  /* ================= TRAVEL: places to visit ================= */
  K.collection({
    mount: $t('bucket'), feature: 'bucket', key: 'bucket', title: 'Places to visit', icon: 'pin-map',
    addTitle: 'A place you want to visit',
    fields: [
      { k: 'place', type: 'title', label: 'Place', ph: 'City or place, e.g. Lisbon', req: true },
      { k: 'notes', label: 'Why / what to do', type: 'textarea', rows: 3 },
      { k: 'visited', label: 'Been there', type: 'check' }
    ],
    afterSave: function (it) {      /* find it on the map */
      if (!window.World || (it.geo && it.geo.q === it.place)) return;
      window.World.search(it.place).then(function (l) {
        if (!l || !l[0]) return;
        var t = F.tools();
        (t.bucket || []).forEach(function (x) { if (x.id === it.id) x.geo = Object.assign({ q: it.place }, l[0]); });
        F.saveTools(t);
      }).catch(function () {});
    },
    sort: function (a, b) { return (a.visited ? 1 : 0) - (b.visited ? 1 : 0) || (a.place > b.place ? 1 : -1); },
    summary: function (items) {
      var v = items.filter(function (x) { return x.visited; }).length;
      return items.length ? '<p class="kit-moodlbl">' + items.length + ' place' + (items.length > 1 ? 's' : '') + ' · ' + v + ' visited · they show on the map under History</p>' : '';
    },
    row: function (b) { return { icon: b.visited ? 'check-circle-fill' : 'pin-map', color: b.visited ? '#22b35e' : '#0891b2', title: b.place, cls: b.visited ? 'is-done' : '', sub: [b.geo ? esc(b.geo.country) : '', b.notes ? esc(String(b.notes).slice(0, 70)) : ''].filter(Boolean).join(' · ') }; },
    detail: function (b) {
      return (b.notes ? '<p class="kit-notes">' + esc(b.notes) + '</p>' : '') +
        (b.visited ? '' : '<span class="kit-acts"><button type="button" class="text-btn" data-plantrip="' + esc(b.id) + '"><i class="bi bi-suitcase-lg"></i> Plan a trip</button>' +
          (window.World ? '<a class="text-btn" href="' + esc(window.World.flightsLink((b.geo && b.geo.name) || b.place)) + '" target="_blank" rel="noopener"><i class="bi bi-airplane"></i> Flight prices</a>' : '') + '</span>');
    },
    empty: 'Cities and places you want to see. Turn one into a trip when you’re ready.',
    onClick: function (e) {
      var b = e.target.closest('[data-plantrip]');
      if (!b || !window.Flow) return;
      var it = F.list('bucket').filter(function (x) { return x.id === b.dataset.plantrip; })[0];
      if (!it) return;
      var tr = window.Flow.travel(), start = F.addMonths(today(), 1);
      var trip = { id: K.uid(), name: it.place, dest: it.geo ? it.geo.name : it.place, start: start, end: addDays(start, 3), items: [], pack: [], notes: it.notes || '' };
      if (it.geo) trip.place = { name: it.geo.name, region: it.geo.region, country: it.geo.country, cc: it.geo.cc, lat: it.geo.lat, lon: it.geo.lon, tz: it.geo.tz };
      tr.trips.push(trip);
      window.Flow.saveTravel(tr);
      location.href = '/cmd/travel/#trip=' + trip.id;
    }
  });

  /* ================= FINANCE: subscriptions ================= */
  var PERIODS = [['monthly', 'Every month'], ['quarterly', 'Every 3 months'], ['yearly', 'Every year']];
  var PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  var SUB_CATS = [['streaming', 'Streaming & music'], ['software', 'Apps & software'], ['phone', 'Phone & internet'], ['training', 'Training'], ['news', 'News & magazines'], ['insurance', 'Insurance'], ['other', 'Other']];
  K.collection({
    mount: $t('subs'), feature: 'subs', key: 'subs', title: 'Subscriptions', icon: 'arrow-repeat',
    addTitle: 'Add subscription', editTitle: 'Edit subscription',
    fields: [
      { k: 'name', type: 'title', label: 'Name', ph: 'e.g. Spotify, iCloud+, SATS', req: true },
      { k: 'amount', label: 'Price', type: 'number', suffix: 'kr', req: true },
      { k: 'period', label: 'Paid', type: 'select', options: PERIODS, def: 'monthly' },
      { k: 'renews', label: 'Next payment', type: 'date', req: true, def: today, help: 'It shows in your calendar every time it renews.' },
      { k: 'cat', label: 'Category', type: 'select', options: SUB_CATS, def: 'streaming' },
      { k: 'paused', label: 'Paused / cancelled', type: 'check' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'e.g. how to cancel, or the account it’s on.' }
    ],
    sort: function (a, b) { return (a.paused ? 1 : 0) - (b.paused ? 1 : 0) || (F.nextRenewal(a) > F.nextRenewal(b) ? 1 : -1); },
    summary: function (items) {
      var act = items.filter(function (s) { return !s.paused; });
      var m = act.reduce(function (a, s) { return a + (+s.amount || 0) * (PER_MONTH[s.period] || 1); }, 0);
      var next = act.slice().sort(function (a, b) { return F.nextRenewal(a) > F.nextRenewal(b) ? 1 : -1; })[0];
      return items.length ? '<div class="kit-tiles">' + tile('Per month', kr(m)) + tile('Per year', kr(m * 12)) +
        (next ? tile('Next', esc(next.name), fmt(F.nextRenewal(next), { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</div>' : '';
    },
    row: function (s) {
      var per = { monthly: '/ month', quarterly: '/ 3 months', yearly: '/ year' }[s.period] || '';
      return { icon: 'arrow-repeat', color: '#11a597', title: s.name, cls: s.paused ? 'is-done' : '',
        sub: kr(+s.amount) + ' ' + per + (s.paused ? ' · paused' : ' · next ' + fmt(F.nextRenewal(s), { day: 'numeric', month: 'short' })),
        right: s.period !== 'monthly' && !s.paused ? '<small class="muted">' + kr((+s.amount || 0) * (PER_MONTH[s.period] || 1)) + '/mo</small>' : '' };
    },
    empty: 'Streaming, apps, phone, gym … see what it all costs per month and year, and get a reminder before each payment.'
  });

  /* ================= FINANCE: warranties & receipts ================= */
  K.collection({
    mount: $t('warranty'), feature: 'warranty', key: 'warranty', title: 'Warranties & receipts', icon: 'receipt-cutoff',
    addTitle: 'Add a purchase', editTitle: 'Edit purchase',
    fields: [
      { k: 'item', type: 'title', label: 'What', ph: 'e.g. MacBook Air, washing machine', req: true },
      { k: 'store', label: 'Store', ph: 'Where you bought it' },
      { k: 'bought', label: 'Bought', type: 'date', req: true, def: today },
      { k: 'price', label: 'Price', type: 'number', suffix: 'kr' },
      { k: 'years', label: 'Complaint period', type: 'select', def: '2', options: [['2', '2 years (most things)'], ['5', '5 years (meant to last: phone, PC, white goods…)'], ['1', '1 year'], ['3', '3 years']],
        help: 'In Norway you can complain (reklamere) for 2 years, or 5 years for things meant to last much longer.' },
      { k: 'receipt', label: 'Receipt', ph: 'Where it is, e.g. email, Vipps, folder' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'Serial number, model, insurance …' }
    ],
    sort: function (a, b) { return F.warrantyEnd(a) > F.warrantyEnd(b) ? 1 : -1; },
    summary: function (items) {
      var td = today(), act = items.filter(function (w) { return F.warrantyEnd(w) >= td; });
      var soon = act.filter(function (w) { return F.warrantyEnd(w) < F.addMonths(td, 3); }).length;
      var val = act.reduce(function (a, w) { return a + (+w.price || 0); }, 0);
      return items.length ? '<div class="kit-tiles">' + tile('Covered', act.length, 'things still under warranty') + tile('Ending soon', '<span class="' + (soon ? 'neg' : '') + '">' + soon + '</span>', 'within 3 months') + tile('Value covered', kr(val)) + '</div>' : '';
    },
    row: function (w) {
      var end = F.warrantyEnd(w), over = end < today();
      return { icon: 'receipt-cutoff', color: '#c98500', title: w.item, cls: over ? 'is-done' : '',
        sub: [w.store ? esc(w.store) : '', fmt(w.bought), w.price ? kr(+w.price) : '', w.receipt ? 'receipt: ' + esc(w.receipt) : ''].filter(Boolean).join(' · '),
        right: over ? '<span class="kit-badge">Ended</span>' : expiryBadge(end).replace('Until', 'Until').replace('Expires', 'Ends') };
    },
    empty: 'Keep track of what you bought, where the receipt is, and when you can no longer complain. You get a reminder in your calendar.'
  });

  /* Work page with nothing switched on */
  var wkEmpty = document.getElementById('wkEmpty');
  function workEmpty() { if (wkEmpty) wkEmpty.hidden = F.on('work'); }
  if (wkEmpty) { window.addEventListener('features:change', workEmpty); workEmpty(); }
})();
} catch (e) { console.error("tools.js", e); }
/* ===== profile.js ===== */
try {
/* Your profile: photo, details you use across the dashboard, and your socials.
   Stored in "dash.profile" (synced and encrypted with your passcode).
   - the avatar in the top corner opens Profile & settings
   - home and office address become Home / Work in Travel
   - normal working day is the one Flex time uses
   - your birthday goes in the calendar
   - socials you mark as public can be published to jplundberg.com */
(function () {
  "use strict";
  var KEY = 'dash.profile';
  var $ = function (id) { return document.getElementById(id); };
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var NETS = {
    linkedin: { name: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/{h}/', host: 'linkedin.com' },
    instagram: { name: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/{h}/', host: 'instagram.com' },
    facebook: { name: 'Facebook', icon: 'facebook', url: 'https://www.facebook.com/{h}', host: 'facebook.com' },
    tiktok: { name: 'TikTok', icon: 'tiktok', url: 'https://www.tiktok.com/@{h}', host: 'tiktok.com' },
    x: { name: 'X', icon: 'twitter-x', url: 'https://x.com/{h}', host: 'x.com' },
    threads: { name: 'Threads', icon: 'threads', url: 'https://www.threads.net/@{h}', host: 'threads.net' },
    youtube: { name: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com/@{h}', host: 'youtube.com' },
    snapchat: { name: 'Snapchat', icon: 'snapchat', url: 'https://www.snapchat.com/add/{h}', host: 'snapchat.com' },
    strava: { name: 'Strava', icon: 'strava', url: 'https://www.strava.com/athletes/{h}', host: 'strava.com' },
    github: { name: 'GitHub', icon: 'github', url: 'https://github.com/{h}', host: 'github.com' }
  };
  /* the two already on jplundberg.com */
  var START_SOCIALS = [
    { net: 'linkedin', handle: 'john-paul-lundberg-8a804623b', pub: true },
    { net: 'instagram', handle: 'jp.lundberg.official', pub: true }
  ];
  function socialUrl(s) {
    var N = NETS[s.net], h = String(s.handle || '').trim();
    if (!N || !h) return '';
    if (/^https:\/\//i.test(h)) {
      try { var u = new URL(h); return (u.hostname === N.host || u.hostname.slice(-N.host.length - 1) === '.' + N.host) ? u.href : ''; } catch (e) { return ''; }
    }
    h = h.replace(/^@/, '').replace(/[^\w.\-]/g, '');
    return h ? N.url.replace('{h}', h) : '';
  }

  function load() {
    var p = readJSON(KEY);
    p = p && typeof p === 'object' ? p : {};
    if (!Array.isArray(p.socials)) {
      p.socials = START_SOCIALS.map(function (s) { return Object.assign({ id: uid() }, s); });
      if (window.Vault && document.documentElement.classList.contains('unlocked')) {      /* keep the same ids from now on */
        try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
      }
    }
    return p;
  }
  function save(p) {
    var before = null;
    try { before = JSON.stringify((JSON.parse(localStorage.getItem(KEY)) || {}).socials || null); } catch (e) {}
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));
    window.dispatchEvent(new Event('profile:change'));
    if (before !== JSON.stringify(p.socials || null)) window.dispatchEvent(new Event('socials:change'));
  }
  function initials(p) {
    var n = String(p.name || (readJSON('dash.settings') || {}).name || '').trim().split(/\s+/).filter(Boolean);
    return n.length ? (n[0][0] + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase() : '';
  }
  function avatar(p, cls) {
    p = p || load();
    return '<span class="me-av ' + (cls || '') + '">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="">' :
      (initials(p) ? '<b>' + esc(initials(p)) + '</b>' : '<i class="bi bi-person"></i>')) + '</span>';
  }
  function age(k) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k || '')) return null;
    var b = k.split('-').map(Number), t = new Date(), a = t.getFullYear() - b[0];
    if (t.getMonth() + 1 < b[1] || (t.getMonth() + 1 === b[1] && t.getDate() < b[2])) a--;
    return a;
  }

  /* ---------- the avatar button(s) ---------- */
  function paintButtons() {
    var p = load();
    document.querySelectorAll('[data-me]').forEach(function (b) { b.innerHTML = avatar(p); });
  }
  /* other pages: a small avatar in the top corner that opens Profile & settings */
  var main = $('fp');
  if (main && !$('settingsBtn')) {
    var a = document.createElement('a');
    a.className = 'me-btn me-sub'; a.href = '/cmd/?settings'; a.setAttribute('data-me', '');
    a.addEventListener('click', function () { try { sessionStorage.setItem('dash.stFrom', location.pathname); } catch (e) {} });
    a.setAttribute('aria-label', 'Profile and settings');
    /* in the page's top row (same height as on the dashboard, below the iPhone status bar) */
    var host = document.querySelector('#fp > .fp-top');
    if (host) { a.classList.add('me-in'); host.appendChild(a); } else document.body.appendChild(a);
  }
  window.addEventListener('profile:change', paintButtons);
  if (window.Vault) window.Vault.onUnlock(paintButtons);
  paintButtons();

  /* the links that should be on jplundberg.com (switched on, with a valid address) */
  function publicSocials() {
    return load().socials.filter(function (s) { return s.pub && socialUrl(s); }).map(function (s) { return { net: s.net, url: socialUrl(s) }; });
  }
  /* Undo on the Socials page: back to what's live */
  function resetSocials(live) {
    if (!Array.isArray(live)) return;
    var p = load(), used = {};
    p.socials.forEach(function (s) { var u = socialUrl(s); s.pub = live.some(function (l) { return l.url === u; }); used[u] = 1; });
    live.forEach(function (l) { if (!used[l.url]) p.socials.push({ id: uid(), net: l.net, handle: l.url, pub: true }); });
    save(p);
    window.dispatchEvent(new Event('socials:reset'));
  }
  window.Profile = { load: load, save: save, avatar: avatar, NETS: NETS, socialUrl: socialUrl, age: age, publicSocials: publicSocials, resetSocials: resetSocials };

  /* ---------- Health page: medical info card ---------- */
  var med = $('meHealth');
  function renderMed() {
    if (!med) return;
    var p = load(), rows = [['GP (fastlege)', p.gp], ['Blood type', p.blood], ['Allergies', p.allergies], ['Medicines', p.meds]].filter(function (r) { return r[1]; });
    var ice = p.iceName ? esc(p.iceName) + (p.iceRel ? ' (' + esc(p.iceRel) + ')' : '') + (p.icePhone ? ' · <a href="tel:' + esc(p.icePhone.replace(/\s/g, '')) + '">' + esc(p.icePhone) + '</a>' : '') : '';
    med.hidden = !rows.length && !ice;
    med.innerHTML = '<div class="card-head"><h2><i class="bi bi-person-vcard"></i> Medical info</h2><a class="text-btn" href="/cmd/?settings=profile">Edit</a></div>' +
      '<dl class="me-dl">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') +
      (ice ? '<dt>Emergency contact</dt><dd>' + ice + '</dd>' : '') + '</dl>';
  }
  /* Travel page: emergency contact under travel documents */
  var docs = $('tpDocsCard');
  function renderIce() {
    if (!docs) return;
    var p = load(), el = $('meIce');
    if (!el) { el = document.createElement('p'); el.id = 'meIce'; el.className = 'me-ice'; docs.appendChild(el); }
    el.hidden = !p.iceName;
    el.innerHTML = p.iceName ? '<i class="bi bi-telephone"></i> Emergency contact: <b>' + esc(p.iceName) + '</b>' + (p.iceRel ? ' (' + esc(p.iceRel) + ')' : '') +
      (p.icePhone ? ' · <a href="tel:' + esc(p.icePhone.replace(/\s/g, '')) + '">' + esc(p.icePhone) + '</a>' : '') : '';
  }
  [renderMed, renderIce].forEach(function (fn) {
    window.addEventListener('profile:change', fn);
    if (window.Vault) window.Vault.onUnlock(fn);
  });

  /* ---------- Profile & settings panel (dashboard only) ---------- */
  var head = $('stProfile'), box = $('meBox'), soBox = $('soBox');
  var area = box && (box.closest('.st-panel') || box);     // profile and socials pages share the handlers below
  if (!head || !box) return;

  function renderHead() {
    var p = load(), F = window.Features, sub = [p.role, p.employer].filter(Boolean).join(' · ');
    head.innerHTML = avatar(p, 'lg') + '<span class="st-label"><b>' + esc(p.name || 'Your profile') + '</b><small>' +
      esc(sub || 'Your details and photo – private') + '</small></span><i class="bi bi-chevron-right"></i>';
  }

  var FIELDS = [
    { sec: 'About you', icon: 'person', rows: [
      ['name', 'Name', 'text', 'Full name'], ['birthday', 'Birthday', 'date'], ['phone', 'Phone', 'tel', '+47'], ['email', 'Email', 'email', 'you@example.com'],
      ['city', 'City', 'text', 'Oslo']] },
    { sec: 'Home', icon: 'house-door', rows: [['home', 'Address', 'place', 'Search for your address', 'home']],
      note: 'Becomes “Home” in Travel, so departures and “leave by” start from here.' },
    { sec: 'Work', icon: 'briefcase', rows: [['employer', 'Employer', 'text', 'Company'], ['role', 'Role', 'text', 'Job title'],
      ['office', 'Office', 'place', 'Search for the office address', 'work'], ['norm', 'Normal working day', 'hours']],
      note: 'The office becomes “Work” in Travel. The working day is what Flex time counts against.' },
    { sec: 'Emergency contact', icon: 'telephone', rows: [['iceName', 'Name', 'text'], ['iceRel', 'Relation', 'text', 'e.g. Mother, partner'], ['icePhone', 'Phone', 'tel']],
      note: 'Shown with your travel documents and on the Health page.' },
    { sec: 'Health', icon: 'heart-pulse', rows: [['gp', 'GP (fastlege)', 'text', 'Name and clinic'],
      ['blood', 'Blood type', 'select', ['', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', '0+', '0−']], ['allergies', 'Allergies', 'text', 'None'], ['meds', 'Medicines', 'text', 'Anything you take regularly']] },
    { sec: 'Sizes', icon: 'rulers', rows: [['sizeTop', 'Shirts & jackets', 'text', 'M'], ['sizeBottom', 'Trousers', 'text', '32/32'], ['sizeShoe', 'Shoes', 'text', '43'], ['sizeOther', 'Other', 'text', 'Ring, hat …']] }
  ];

  function travelPlace(k) { return window.Flow ? (window.Flow.travel().places || {})[k] : null; }
  function flexNorm() { return window.Features ? +((window.Features.tools().flexcfg || {}).norm) || 7.5 : 7.5; }

  function render() {
    renderSocials();
    var p = load();
    var photo = '<div class="me-photo">' + avatar(p, 'xl') + '<div><button type="button" class="pill-btn" id="mePick"><i class="bi bi-camera"></i> ' + (p.photo ? 'Change photo' : 'Add photo') + '</button>' +
      (p.photo ? '<button type="button" class="text-btn danger" id="meNoPhoto">Remove</button>' : '') +
      '<p class="st-note">' + (p.birthday && age(p.birthday) != null ? age(p.birthday) + ' years · ' : '') + 'Saved encrypted, only for you.</p></div>' +
      '<input type="file" id="meFile" accept="image/*" hidden></div>';
    var secs = FIELDS.map(function (S) {
      return '<p class="st-sub"><i class="bi bi-' + S.icon + '"></i> ' + S.sec + '</p><section class="st-group">' + S.rows.map(function (r) {
        var k = r[0], v = p[k], ph = typeof r[3] === 'string' ? ' placeholder="' + esc(r[3]) + '"' : '';
        var input;
        if (r[2] === 'place') {
          var tp = travelPlace(r[4]);
          input = '<span class="ps-wrap me-place"><input data-mplace="' + k + '" data-tp="' + r[4] + '" value="' + esc((tp && tp.name) || (p[k] && p[k].name) || '') + '"' + ph + ' aria-label="' + r[1] + '"></span>';
        } else if (r[2] === 'select') {
          input = '<select class="st-select" data-mk="' + k + '">' + r[3].map(function (o) { return '<option' + (o === (v || '') ? ' selected' : '') + ' value="' + o + '">' + (o || '–') + '</option>'; }).join('') + '</select>';
        } else if (r[2] === 'hours') {
          input = '<span class="me-hours"><input data-mnorm inputmode="decimal" value="' + String(flexNorm()).replace('.', ',') + '" aria-label="Normal working day in hours"> h</span>';
        } else {
          input = '<input class="st-input" type="' + r[2] + '" data-mk="' + k + '" value="' + esc(v || '') + '"' + ph + ' maxlength="120" aria-label="' + r[1] + '">';
        }
        return '<label class="st-row me-row"><span>' + r[1] + '</span>' + input + '</label>';
      }).join('') + '</section>' + (S.note ? '<p class="st-note me-note">' + S.note + '</p>' : '');
    }).join('');
    box.innerHTML = '<p class="me-private"><i class="bi bi-lock"></i><span><b>Private.</b> Only you see this – nothing here is shown on jplundberg.com. What’s public is under Settings → jplundberg.com.</span></p>' + photo + secs +
      '<p class="st-sub"><i class="bi bi-pencil"></i> Notes</p><section class="st-group"><textarea class="me-notes" data-mk="notes" rows="3" maxlength="2000" placeholder="Anything else you want to keep handy">' + esc(p.notes || '') + '</textarea></section>';
    if (window.Places) box.querySelectorAll('[data-mplace]').forEach(function (inp) {
      window.Places.field(inp, { onPick: function (pl) {
        if (!pl) return;
        var q = load(), plain = { id: pl.id || '', name: pl.name, sub: pl.sub || '', lat: pl.lat, lon: pl.lon, stop: !!pl.stop };
        q[inp.dataset.mplace] = plain; save(q);
        if (window.Flow) { var t = window.Flow.travel(); t.places = t.places || {}; t.places[inp.dataset.tp] = plain; window.Flow.saveTravel(t); }
        flash(inp);
      } });
    });
  }
  function flash(el) { var row = el.closest('.st-row'); if (!row) return; row.classList.add('me-saved'); setTimeout(function () { row.classList.remove('me-saved'); }, 900); }

  /* ---------- socials ---------- */
  var pubMsg = '';
  function renderSocials() { if (soBox) soBox.innerHTML = socialsHtml(load()); }
  window.addEventListener('socials:reset', renderSocials);
  function socialsHtml(p) {
    var opts = function (cur) { return Object.keys(NETS).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + NETS[k].name + '</option>'; }).join(''); };
    return '<p class="st-sub"><i class="bi bi-share"></i> Your profiles <span class="st-hint">Username or link. The switch decides if it’s shown on jplundberg.com</span></p>' +
      '<section class="st-group me-socials">' + p.socials.map(function (s) {
        var url = socialUrl(s), N = NETS[s.net] || NETS.linkedin;
        return '<div class="st-row me-soc" data-sid="' + esc(s.id) + '">' +
          '<span class="me-soc-ic"><i class="bi bi-' + N.icon + '"></i></span>' +
          '<select class="me-soc-net" data-snet aria-label="Network">' + opts(s.net) + '</select>' +
          '<input class="me-soc-h" data-shandle value="' + esc(s.handle || '') + '" placeholder="username" maxlength="200" aria-label="' + N.name + ' username or link" spellcheck="false" autocapitalize="off">' +
          '<a class="icon-btn me-soc-open" href="' + esc(url || '#') + '"' + (url ? '' : ' hidden') + ' target="_blank" rel="noopener" aria-label="Open ' + N.name + '"><i class="bi bi-box-arrow-up-right"></i></a>' +
          '<input type="checkbox" class="switch" data-spub' + (s.pub ? ' checked' : '') + ' aria-label="Show ' + N.name + ' on jplundberg.com">' +
          '<button type="button" class="text-btn danger me-soc-del" data-sdel aria-label="Remove"><i class="bi bi-x-lg"></i></button></div>';
      }).join('') +
      (p.socials.length < 10 ? '<button type="button" class="st-row st-btn cs-add" data-sadd><span><i class="bi bi-plus-lg"></i> Add social</span></button>' : '') +
      '</section>';
  }
  /* ---------- editing ---------- */
  var timer = null;
  area.addEventListener('input', function (e) {
    var t = e.target, k = t.dataset.mk;
    if (k) {
      clearTimeout(timer);
      timer = setTimeout(function () { var p = load(); p[k] = t.value.trim().slice(0, k === 'notes' ? 2000 : 120); save(p); renderHead(); }, 350);
    }
    if (t.hasAttribute('data-shandle')) {
      var p2 = load(), id = t.closest('[data-sid]').dataset.sid;
      var link = t.closest('[data-sid]').querySelector('.me-soc-open');
      p2.socials.forEach(function (s) {
        if (s.id !== id) return;
        s.handle = t.value.trim().slice(0, 200);
        var u = socialUrl(s); link.hidden = !u; link.href = u || '#';
      });
      save(p2);
    }
  });
  area.addEventListener('change', function (e) {
    var t = e.target, p = load(), row = t.closest('[data-sid]');
    if (t.dataset.mk) { p[t.dataset.mk] = t.value.trim(); save(p); flash(t); renderHead(); return; }
    if (t.hasAttribute('data-mnorm') && window.Features) {
      var n = parseFloat(t.value.replace(',', '.'));
      if (n > 0 && n < 16) { var tl = window.Features.tools(); tl.flexcfg = tl.flexcfg || {}; tl.flexcfg.norm = n; window.Features.saveTools(tl); flash(t); }
      return;
    }
    if (row) {
      p.socials.forEach(function (s) {
        if (s.id !== row.dataset.sid) return;
        if (t.hasAttribute('data-snet')) s.net = t.value;
        if (t.hasAttribute('data-spub')) s.pub = t.checked;
      });
      save(p);
      if (t.hasAttribute('data-snet')) render();
    }
  });
  area.addEventListener('click', function (e) {
    var p;
    if (e.target.closest('#mePick')) return $('meFile').click();
    if (e.target.closest('#meNoPhoto')) { p = load(); delete p.photo; save(p); render(); renderHead(); return; }
    if (e.target.closest('[data-sadd]')) {
      p = load(); var used = p.socials.map(function (s) { return s.net; });
      p.socials.push({ id: uid(), net: Object.keys(NETS).filter(function (k) { return used.indexOf(k) < 0; })[0] || 'instagram', handle: '', pub: false });
      save(p); render();
      var last = area.querySelectorAll('[data-shandle]'); if (last.length) last[last.length - 1].focus();
      return;
    }
    var del = e.target.closest('[data-sdel]');
    if (del) {
      var id = del.closest('[data-sid]').dataset.sid;
      if (!del.classList.contains('armed')) { del.classList.add('armed'); del.innerHTML = 'Remove?'; return; }
      p = load(); p.socials = p.socials.filter(function (s) { return s.id !== id; }); save(p); render();
    }
  });
  /* photo: cropped to a square and made small (about 20 KB) so it syncs quickly */
  area.addEventListener('change', function (e) {
    if (e.target.id !== 'meFile' || !e.target.files[0]) return;
    var img = new Image(), url = URL.createObjectURL(e.target.files[0]);
    img.onload = function () {
      var s = Math.min(img.width, img.height), c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      var p = load(); p.photo = c.toDataURL('image/jpeg', 0.82); save(p); render(); renderHead();
    };
    img.src = url;
  });

  window.addEventListener('st:page', function (e) { if (e.detail === 'profile' || e.detail === 'socials') render(); if (e.detail === 'home') renderHead(); });
  window.addEventListener('profile:change', renderHead);
  if (window.Vault) window.Vault.onUnlock(renderHead);
  renderHead();
})();
} catch (e) { console.error("profile.js", e); }
/* ===== links.js ===== */
try {
/* Connections: when you change something in one place, the places that depend on it follow.
   Runs on every dashboard page, after the vault is unlocked.
   - Subscriptions → Monthly budget: each active subscription is a fixed cost (per month;
     yearly and quarterly ones spread out), monthly ones also get a due day in Upcoming bills
   - Trips → Finances: booking costs and a trip's other costs are spending (Travel), old trips too
   - Trips → Places to visit: a place you've now been to is ticked off as visited
   - Workouts → your training habit: a logged workout ticks the habit that day
   (workouts, courses and health → calendar in features.js) */
(function () {
  "use strict";
  var F = window.Features;
  if (!F || !window.Vault) return;
  var PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

  /* ---------- subscriptions → budget fixed costs ---------- */
  function syncSubs() {
    var d = window.Vault.get();
    if (!d) return;
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = F.on('subs') ? F.list('subs').filter(function (s) { return !s.paused && +s.amount > 0; }).map(function (s) {
      var monthly = (s.period || 'monthly') === 'monthly', old = fixed.filter(function (f) { return f.id === 'sub-' + s.id; })[0];
      var day = monthly && /^\d{4}-\d{2}-\d{2}$/.test(s.renews || '') ? +s.renews.slice(8, 10) : null;
      return { id: 'sub-' + s.id, name: s.name + (monthly ? '' : ' (' + (s.period === 'yearly' ? 'yearly' : 'every 3 months') + ')'),
        amount: Math.round((+s.amount) * (PER_MONTH[s.period] || 1)), day: day, src: 'sub' };
    }) : [];
    var mine = fixed.filter(function (f) { return f.src !== 'sub'; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'sub'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = mine.concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }

  /* ---------- savings goals → budget: "set aside every month" becomes a fixed cost ---------- */
  function syncSave() {
    var d = window.Vault.get(), B = window.Budget;
    if (!d || !B || !B.saveMonthly) return;
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = (d.savings || []).filter(function (g) { return g.aside; }).map(function (g) {
      return { id: 'save-' + g.id, name: 'Savings: ' + (g.name || 'goal'), amount: B.saveMonthly(g), day: null, src: 'save' };
    }).filter(function (f) { return f.amount > 0; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'save'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = fixed.filter(function (f) { return f.src !== 'save'; }).concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }
  window.Links = { syncSave: syncSave };

  /* ---------- trips → places to visit ---------- */
  function near(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return false;
    var dx = (a.lat - b.lat) * 111, dy = (a.lon - b.lon) * 111 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy) < 30;                 // within 30 km counts as the same place
  }
  function syncBucket() {
    if (!window.Flow || !F.on('bucket')) return;
    var today = F.dkey(new Date()), been = window.Flow.travel().trips.filter(function (t) { return t.start && t.start <= today && t.place; });
    if (!been.length) return;
    var t = F.tools(), changed = false;
    (t.bucket || []).forEach(function (b) {
      if (b.visited) return;
      var hit = been.filter(function (tr) {
        return near(tr.place, b.geo) || String(tr.place.name).toLowerCase() === String(b.place).toLowerCase();
      })[0];
      if (hit) { b.visited = true; b.visitedTrip = hit.id; changed = true; }
    });
    if (changed) F.saveTools(t);
  }

  /* ---------- trips → Finances ----------
     Every booking cost and a trip's "other costs" are spending in Finances (category Travel).
     Older trips and bookings made before this was automatic are added too: past ones on
     their own date, upcoming ones today (that's when you paid). Removed in Finances = left out. */
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) && n > 0 ? n : 0;
  }
  var syncingTrips = false;
  function syncTrips() {
    var d = window.Vault.get(), Fl = window.Flow;
    if (!d || !Fl || syncingTrips) return;
    d.expenses = Array.isArray(d.expenses) ? d.expenses : [];
    var byId = {}; d.expenses.forEach(function (e) { byId[e.id] = e; });
    var today = F.dkey(new Date()), tr = Fl.travel(), finChanged = false, travelChanged = false;
    function want(owner, idKey, amount, date, note, keepOutKey) {
      var ex = owner[idKey] && byId[owner[idKey]];
      if (owner[idKey] && !ex) { delete owner[idKey]; owner[keepOutKey] = true; travelChanged = true; return; }   // deleted in Finances
      if (!amount) { if (ex) { d.expenses = d.expenses.filter(function (x) { return x !== ex; }); delete owner[idKey]; finChanged = travelChanged = true; } return; }
      if (ex) {
        if (ex.amount !== amount || ex.note !== note) { ex.amount = amount; ex.note = note; finChanged = true; }
        return;
      }
      if (owner[keepOutKey]) return;
      var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      d.expenses.push({ id: id, t: Date.now(), date: date, amount: Math.round(amount * 100) / 100, cat: 'travel', note: note, src: 'trip' });
      owner[idKey] = id; finChanged = travelChanged = true;
    }
    tr.trips.forEach(function (t) {
      var name = t.name || t.dest || 'Trip', past = (t.end || t.start || today) < today;
      (t.items || []).forEach(function (it) {
        var label = it.title || ({ flight: 'Flight', train: 'Train', bus: 'Bus', boat: 'Boat', car: 'Car', hotel: 'Hotel', activity: 'Activity' }[it.type] || 'Booking');
        want(it, 'spendId', num(it.cost), past && /^\d{4}-\d{2}-\d{2}$/.test(it.date || '') ? it.date : today, (name + ': ' + label).slice(0, 80), 'noFin');
      });
      want(t, 'spentId', num(t.spent), past ? (t.start || today) : today, (name + ': other costs').slice(0, 80), 'noFinSpent');
    });
    if (!finChanged && !travelChanged) return;
    syncingTrips = true;
    try {
      if (finChanged) { window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
      if (travelChanged) Fl.saveTravel(tr);
    } finally { syncingTrips = false; }
  }

  /* ---------- workouts → the training habit ----------
     A logged workout ticks its habit that day (the one picked when logging, else your
     training/gym habit). Only adds ticks – ticking a day by hand still works as before. */
  function syncWorkouts() {
    if (!F.on('training')) return;
    var hb = null; try { hb = JSON.parse(localStorage.getItem('dash.habits')); } catch (e) {}
    if (!hb || !Array.isArray(hb.list) || !hb.list.length) return;
    var def = hb.list.filter(function (h) { return /train|trening|gym|workout|løp|run|exercise|økt/i.test(h.name); })[0];
    var ids = {}; hb.list.forEach(function (h) { ids[h.id] = 1; });
    hb.log = hb.log || {};
    var changed = false;
    F.list('training').forEach(function (w) {
      var hid = w.habit === '' ? null : (w.habit && ids[w.habit] ? w.habit : def && def.id);
      if (!hid || !/^\d{4}-\d{2}-\d{2}$/.test(w.date || '')) return;
      var day = hb.log[w.date] = hb.log[w.date] || [];
      if (day.indexOf(hid) < 0) { day.push(hid); changed = true; }
    });
    if (!changed) return;
    try { localStorage.setItem('dash.habits', JSON.stringify(hb)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));
    window.dispatchEvent(new Event('habits:change'));
    if (window.Dash && window.Dash.reload) window.Dash.reload();
  }

  function run() {
    try { syncWorkouts(); } catch (e) { console.error(e); }
    try { syncSubs(); } catch (e) { console.error(e); }
    try { syncSave(); } catch (e) { console.error(e); }
    try { syncTrips(); } catch (e) { console.error(e); }
    try { syncBucket(); } catch (e) { console.error(e); }
  }
  window.Vault.onUnlock(function () { setTimeout(run, 0); });
  window.addEventListener('tools:change', function () { if (window.Vault.get()) { syncSubs(); syncWorkouts(); } });
  window.addEventListener('features:change', function () { if (window.Vault.get()) run(); });
  window.addEventListener('travel:change', function () { if (window.Vault.get()) { syncTrips(); syncBucket(); } });
})();
} catch (e) { console.error("links.js", e); }
