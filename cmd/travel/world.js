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
      /* CARTO's basemaps (free, no key): a clean dark map in dark mode, a light one in light mode */
      el.classList.toggle('map-dark', dark);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/' + (dark ? 'dark_all' : 'light_all') + '/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
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
    locate: locate, map: map, osmLink: osmLink, gmapsLink: gmapsLink, flightsLink: flightsLink, exploreLink: exploreLink, homeCity: homeCity,
    inEEA: function (cc) { return EEA.indexOf(String(cc || '').toUpperCase()) > -1; },
    abroad: function (cc) { return !!cc && String(cc).toUpperCase() !== 'NO'; },
    addDays: addDays
  };
})();
