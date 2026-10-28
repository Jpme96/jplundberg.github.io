/* Travel page, part 3: history – where you've been, days away, countries and what trips cost. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var F = window.Flow, C = window.Cal, W = window.World, esc = C.esc;
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  var shown = false, mapSig = '';

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
      return '<div class="fp-tile"><div class="lbl"><i class="bi bi-' + x.i + '"></i>' + x.l + '</div><div class="val">' + x.v + '</div><div class="sub">' + x.s + '</div></div>';
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

    /* past trips */
    $('tpPast').innerHTML = past.map(window.TripCard).join('');
    $('hsEmpty').hidden = past.length > 0;

    /* map: been (accent) and coming up (teal) */
    var upcoming = t.trips.filter(function (x) { return x.start > td && x.place; });
    var pts = taken.filter(function (x) { return x.place; }).map(function (x) {
      return { lat: x.place.lat, lon: x.place.lon, label: '<b>' + esc(x.name) + '</b><br>' + esc(x.place.name + ', ' + x.place.country) + '<br><small>' + esc(x.start) + '</small>', color: 'var(--accent)' };
    }).concat(upcoming.map(function (x) {
      return { lat: x.place.lat, lon: x.place.lon, label: '<b>' + esc(x.name) + '</b> (coming up)<br>' + esc(x.place.name + ', ' + x.place.country), color: '#0891b2' };
    }));
    var places = {};
    pts.forEach(function (p) { places[p.lat + ',' + p.lon] = 1; });
    $('hsPlaces').textContent = Object.keys(places).length ? Object.keys(places).length + ' place' + (Object.keys(places).length > 1 ? 's' : '') : '';
    var sig = JSON.stringify(pts.map(function (p) { return [p.lat, p.lon, p.color]; })) + document.documentElement.getAttribute('data-theme');
    if (sig !== mapSig || !$('hsMap')._map) {
      mapSig = sig;
      W.map($('hsMap'), pts, { zoom: 4, maxZoom: 6 }).catch(function () {});
    } else setTimeout(function () { $('hsMap')._map.invalidateSize(); }, 50);
  }

  window.addEventListener('travel:tab', function (e) { shown = e.detail === 'history'; render(); });
  window.addEventListener('travel:change', render);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
})();
