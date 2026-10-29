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
