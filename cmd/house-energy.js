/* House, more (Nov 2026):
   · Power bill estimate (Energy tab) – how much you use (from the meter readings) × the price today and this month
     (hour by hour from hvakosterstrommen.no, via Strømpris), plus grid rent and the fixed part, minus strømstøtte –
     or Norgespris. Updates itself every day; the year view shows kWh and cost by calendar year and month.
   · Read the meter from a photo – take a picture of the meter, the numbers are read on your phone
     (Tesseract, loaded the first time you use it) and you check them before they're saved.
   · Upkeep from your FDV documents (Upkeep tab) – the manuals in the FDV binder suggest the upkeep they ask for
     (heat pump filters, ventilation, drains, the water heater …), one tap to add.
   · Handymen (Projects tab) – the electrician, the plumber and the rest: phone, what they did, would you use them again.
   Data: dash.tools.hpros, dash.tools.energycfg; daily prices kept in localStorage dash.powerAvg (only averages). */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in house-energy.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["energy"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  var dkey = Fe.dkey;
  var fromKey = Fe.fromKey;
  function today() { return dkey(new Date()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function days(a, b) { return Math.round((fromKey(b) - fromKey(a)) / 864e5); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(+n || 0)) + ' kr'; }
  function readJSON(k, f) { try { var v = localStorage.getItem(k); return v === null ? f : JSON.parse(v); } catch (e) { return f; } }
  function on() { return Fe.on('house'); }
  var AMBER = '#c98500';
  var GREY = '#7a8794';
  var DEF = { grid: 36, gridFixed: 415, markup: 0, norgespris: false, support: true, ocr: true, fdvSuggest: true, prosBrief: false };
  function cfg() { var c = Fe.tools().energycfg; var o = Object.assign({}, DEF, c && typeof c === 'object' ? c : {}); var pc = Fe.tools().powercfg; if (pc && pc.norgespris) o.norgespris = true; return o; }
  function readings() { return Fe.list('hmeter').filter(function (x) { return isKey(x.date) && typeof x.value === 'number'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }
  function perDay() {
    var r = readings(), out = {};
    for (var i = 1; i < r.length; i++) {
      var a = r[i - 1], b = r[i], n = days(a.date, b.date); if (n <= 0 || b.value < a.value) continue;
      var v = (b.value - a.value) / n; for (var j = 0; j < n; j++) out[addDays(a.date, j)] = v;
    }
    return out;
  }
  function recentDaily() {
    var r = readings(); if (r.length < 2) return null;
    var last = r[r.length - 1], first = r.filter(function (x) { return x.date >= addDays(last.date, -45); })[0];
    if (first === last) first = r[r.length - 2];
    var n = days(first.date, last.date); return n > 0 ? (last.value - first.value) / n : null;
  }
  function dailyFor(k, pd) { var y = addDays(k, -365); return pd[y] != null ? pd[y] : pd[k] != null ? pd[k] : recentDaily(); }
  function avgStore() { var a = readJSON('dash.powerAvg', {}); return a && typeof a === 'object' ? a : {}; }
  function recordToday() {
    var P = window.PowerPrice; if (!P) return null;
    var tk = today(), h = P.day(tk); if (!h) return null;
    var v = h.filter(function (x) { return x != null; }); if (!v.length) return null;
    var avg = v.reduce(function (s, x) { return s + x; }, 0) / v.length, a = avgStore();
    if (Math.abs((a[tk] || 0) - avg) > 0.01) { a[tk] = Math.round(avg * 10) / 10; Object.keys(a).forEach(function (k) { if (k < addDays(tk, -400)) delete a[k]; }); try { localStorage.setItem('dash.powerAvg', JSON.stringify(a)); } catch (e) {} }
    return avg;
  }
  function unitPrice(spot) {
    var c = cfg(), P = window.PowerPrice;
    var e = c.norgespris ? 50 : (spot == null ? null : (c.support && P ? P.support(spot) : spot));
    if (e == null) { var hp = +((Fe.tools().housecfg || {}).price) || 0; if (!hp) return null; return hp; }
    return e + (+c.markup || 0) + (+c.grid || 0);
  }
  function monthPrice(ym) {
    var a = avgStore(), l = Object.keys(a).filter(function (k) { return k.slice(0, 7) === ym; }).map(function (k) { return a[k]; });
    return l.length ? l.reduce(function (s, x) { return s + x; }, 0) / l.length : null;
  }
  function estimate() {
    var spotToday = recordToday(), now = new Date(), ym = today().slice(0, 7), pd = perDay();
    var dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), c = cfg();
    var mp = monthPrice(ym), spot = mp != null ? mp : spotToday, up = unitPrice(spot);
    var kwh = 0, known = 0;
    for (var d = 1; d <= dim; d++) { var k = ym + '-' + String(d).padStart(2, '0'), v = dailyFor(k, pd); if (v != null) { kwh += v; known++; } }
    if (!known) return { none: true, spot: spotToday, up: up };
    if (known < dim) kwh = kwh / known * dim;
    var energy = up != null ? kwh * up / 100 : null, fixed = +c.gridFixed || 0;
    return { kwh: kwh, spot: spot, spotToday: spotToday, up: up, energy: energy, fixed: fixed, total: energy != null ? energy + fixed : null, perDay: kwh / dim, monthAvg: mp };
  }
  function years() {
    var pd = perDay(), a = avgStore(), out = {}, c = cfg(), hp = +((Fe.tools().housecfg || {}).price) || 0;
    Object.keys(pd).forEach(function (k) {
      var y = k.slice(0, 4), m = +k.slice(5, 7) - 1, o = out[y] = out[y] || { kwh: 0, cost: 0, costDays: 0, months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], days: 0 };
      o.kwh += pd[k]; o.months[m] += pd[k]; o.days++;
      var sp = a[k] != null ? a[k] : null, up = sp != null ? unitPrice(sp) : (c.norgespris ? 50 + (+c.grid || 0) : hp || null);
      if (up != null) { o.cost += pd[k] * up / 100; o.costDays++; }
    });
    return out;
  }
  var TRADES = [['electric', 'Electrician', 'lightning-charge', '#d9a400'], ['plumber', 'Plumber', 'droplet', '#3b9de0'], ['carpenter', 'Carpenter', 'hammer', '#a0673a'], ['painter', 'Painter', 'paint-bucket', '#8a6fdf'],
    ['tiler', 'Tiler / wet rooms', 'grid-3x3', '#0891b2'], ['roofer', 'Roofer', 'house', '#7a6a58'], ['hvac', 'Heat pump / ventilation', 'fan', '#e66767'], ['cleaner', 'Cleaning', 'stars', '#11a597'],
    ['lock', 'Locksmith', 'key', '#6b6d73'], ['garden', 'Garden', 'tree', '#2f9e57'], ['mover', 'Moving / transport', 'truck', '#c98500'], ['other', 'Other', 'person-gear', GREY]];
  function trade(k) { return TRADES.filter(function (x) { return x[0] === k; })[0] || TRADES[TRADES.length - 1]; }
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    if (!on()) return;
    Fe.list('hpros').forEach(function (x) { add('Handymen', trade(x.trade)[2], x.name, [trade(x.trade)[1], x.phone].filter(Boolean).join(' · '), '/cmd/house/#hpros=' + x.id); });
  });
  (window.BriefExtra = window.BriefExtra || []).push(function (add, now) {
    if (!on() || !$t || now.getDate() !== 20) return;
    var e = estimate(); if (e.none || e.total == null) return;
    add(78, 'lightning', AMBER, 'Power this month: about ' + kr(e.total), nf.format(Math.round(e.kwh)) + ' kWh at ' + nf.format(Math.round(e.up)) + ' øre with grid rent', '/cmd/house/#henergy');
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() && cfg().ocr ? [{ i: 'camera', t: 'Read the meter from a photo', s: 'House', run: function () { if (__ui().ocrSheet) __ui().ocrSheet(); else location.href = '/cmd/house/#mocr'; }, x: 'meter måler strøm photo bilde avlesning kwh' }] : [];
  });
  window.HouseEnergy = { estimate: estimate, years: years };
  (window.__core = window.__core || {})["energy"] = { cfg: cfg, DEF: DEF, Fe: Fe, on: on, nf: nf, kr: kr, AMBER: AMBER, estimate: estimate, dailyFor: dailyFor, recentDaily: recentDaily, days: days, fromKey: fromKey, addDays: addDays, dkey: dkey, readings: readings, isKey: isKey, unitPrice: unitPrice, monthPrice: monthPrice, avgStore: avgStore, readJSON: readJSON, perDay: perDay, today: today, recordToday: recordToday, $t: $t, trade: trade, TRADES: TRADES, GREY: GREY, years: years };
})();
