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
      if (opts.route && ll.length > 1) L.polyline(ll, { color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#14b8a6', weight: 3, opacity: .75, dashArray: '6 8' }).addTo(m);
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
