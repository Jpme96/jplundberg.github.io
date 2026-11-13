/* House, batch 4 (Oct 2026):
     Season checklists – autumn, winter, spring, summer: the usual jobs (gutters, outdoor taps, tyres …)
                         plus your own, ticked off per season and year.
     Power by month    – from the meter readings: kWh per month, next to the same month last year.
     Home inventory    – valuables with photo, receipt, price and room, the total value, and a list
                         for the insurance company (PDF / CSV).
     House picture     – a small drawing at the top of the House page that lights up what's due.
   Data in dash.tools: hseason ({'2026-autumn': {itemId: date}}), hseasonx (your own items),
   hseasonoff (usual items you've removed), hinv (inventory). Inventory photos are kept on the device and synced encrypted (filesync.js)
   (IndexedDB "dash-inv"). */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in house-plus.page.js, loaded only on its own page. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +(p[2] || 1)); }
  function today() { return dkey(new Date()); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function daysTo(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function on() { return Fe.on('house'); }
  function hcfg() { return window.HomeLife ? window.HomeLife.cfg('housecfg') : {}; }
  var SEASONS = [['spring', I18N.k('ui.spring', 'Spring'), 'flower1', '#22b35e', [2, 3, 4]], ['summer', I18N.k('ui.summer', 'Summer'), 'sun', '#d9a400', [5, 6, 7]], ['autumn', I18N.k('ui.autumn', 'Autumn'), 'tree', '#e8743b', [8, 9, 10]], ['winter', I18N.k('ui.winter', 'Winter'), 'snow', '#3b9de0', [11, 0, 1]]];
  var USUAL = {
    autumn: [['a1', I18N.k('ui.clean-the-gutters-and-downpipes', 'Clean the gutters and downpipes'), 'house'], ['a2', I18N.k('ui.turn-off-and-drain-the-outdoor-taps', 'Turn off and drain the outdoor taps'), 'droplet'], ['a3', I18N.k('ui.change-to-winter-tyres', 'Change to winter tyres'), 'car-front'], ['a4', I18N.k('ui.put-away-garden-furniture-and-the-hose', 'Put away garden furniture and the hose'), 'umbrella'],
      ['a5', I18N.k('ui.check-the-roof-for-loose-tiles', 'Check the roof for loose tiles'), 'house-exclamation'], ['a6', I18N.k('ui.rake-the-leaves-off-the-lawn', 'Rake the leaves off the lawn'), 'tree-fill'], ['a7', I18N.k('ui.find-the-snow-shovel-and-ice-grips', 'Find the snow shovel and ice grips'), 'snow'], ['a8', I18N.k('ui.check-the-seals-on-doors-and-windows', 'Check the seals on doors and windows'), 'door-closed'], ['a9', I18N.k('ui.bleed-the-radiators', 'Bleed the radiators'), 'thermometer-half']],
    winter: [['w1', I18N.k('ui.new-batteries-in-the-smoke-alarms-1-dece', 'New batteries in the smoke alarms (1 December)'), 'alarm'], ['w2', I18N.k('ui.keep-snow-and-ice-off-the-roof-edge', 'Keep snow and ice off the roof edge'), 'snow2'], ['w3', I18N.k('ui.keep-the-heat-pumps-outdoor-unit-free-of', 'Keep the heat pump’s outdoor unit free of snow'), 'fan'], ['w4', I18N.k('ui.clear-snow-from-vents-and-the-chimney', 'Clear snow from vents and the chimney'), 'wind'], ['w5', I18N.k('ui.check-pipes-in-cold-rooms-for-frost', 'Check pipes in cold rooms for frost'), 'thermometer-snow']],
    spring: [['s1', I18N.k('ui.change-to-summer-tyres', 'Change to summer tyres'), 'car-front'], ['s2', I18N.k('ui.clean-the-gutters-after-the-winter', 'Clean the gutters after the winter'), 'house'], ['s3', I18N.k('ui.look-for-winter-damage-on-the-roof-and-f', 'Look for winter damage on the roof and facade'), 'house-exclamation'], ['s4', I18N.k('ui.turn-the-outdoor-taps-back-on-and-check', 'Turn the outdoor taps back on and check for leaks'), 'droplet'],
      ['s5', I18N.k('ui.wash-the-windows', 'Wash the windows'), 'window'], ['s6', I18N.k('ui.service-the-lawnmower', 'Service the lawnmower'), 'scissors'], ['s7', I18N.k('ui.check-that-water-runs-away-from-the-hous', 'Check that water runs away from the house'), 'water'], ['s8', I18N.k('ui.clean-the-heat-pump-filters', 'Clean the heat pump filters'), 'fan']],
    summer: [['u1', I18N.k('ui.paint-or-stain-the-facade-or-deck-where', 'Paint or stain the facade or deck where needed'), 'brush'], ['u2', I18N.k('ui.wash-and-oil-the-deck', 'Wash and oil the deck'), 'grid-3x3'], ['u3', I18N.k('ui.clean-the-ventilation-valves', 'Clean the ventilation valves'), 'wind'], ['u4', I18N.k('ui.wash-the-facade', 'Wash the facade'), 'house'], ['u5', I18N.k('ui.check-the-roof-and-flashings', 'Check the roof and flashings'), 'house-check']]
  };
  function seasonOf(d) { d = d || new Date(); var m = d.getMonth(); return SEASONS.filter(function (s) { return s[4].indexOf(m) > -1; })[0]; }
  function sKey(id, d) { d = d || new Date(); var y = d.getFullYear(); if (id === 'winter' && d.getMonth() < 2) y--; return y + '-' + id; }
  function items(id) {
    var t = Fe.tools(), off = Array.isArray(t.hseasonoff) ? t.hseasonoff : [], mine = ((t.hseasonx || {})[id]) || [];
    return USUAL[id].filter(function (x) { return off.indexOf(x[0]) < 0; }).map(function (x) { return { id: x[0], text: x[1], icon: x[2], usual: true }; })
      .concat(mine.map(function (x) { return { id: x.id, text: x.text, icon: 'check2-square', mine: true }; }));
  }
  function doneMap(key) { var h = Fe.tools().hseason || {}; return h[key] || {}; }
  function seasonLeft() { var s = seasonOf(), key = sKey(s[0]), l = items(s[0]), dm = doneMap(key); return { s: s, left: l.filter(function (x) { return !dm[x.id]; }), all: l }; }
  (window.BriefExtra = window.BriefExtra || []).push(function (add, now) {
    if (!on() || !hcfg().seasonNudge) return;
    var s = seasonOf(now), m = now.getMonth(), first = s[4][0], inFirst = m === first || (m === s[4][1] && now.getDate() <= 15);
    if (!inFirst) return;
    var x = seasonLeft(); if (!x.left.length) return;
    add(66, s[2], s[3], I18N.k('ui.season-checklist-done', '{s} checklist: {a} of {b} done', { s: I18N.lang === 'nb' ? s[1].toLowerCase() : s[1], a: x.all.length - x.left.length, b: x.all.length }), x.left.slice(0, 2).map(function (y) { return y.text; }).join(' · '), '/cmd/house/#hseason', { key: 'season:' + sKey(s[0]) + ':' + (x.all.length - x.left.length), tip: true });
  });
  function readings() { return Fe.list('hmeter').filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') && typeof x.value === 'number'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }
  function perMonth() {
    var r = readings(), out = {};
    for (var i = 1; i < r.length; i++) {
      var a = r[i - 1], b = r[i], days = Math.round((fromKey(b.date) - fromKey(a.date)) / 864e5), use = b.value - a.value;
      if (days <= 0 || use < 0) continue;
      var perDay = use / days, d = fromKey(a.date);
      for (var k = 0; k < days; k++) { var m = dkey(d).slice(0, 7); out[m] = (out[m] || 0) + perDay; d.setDate(d.getDate() + 1); }
    }
    return { m: out, first: r.length ? r[0].date : null, last: r.length ? r[r.length - 1].date : null };
  }
  (window.CommandExtra = window.CommandExtra || []).push(function () { return on() ? [{ i: 'box-seam', t: 'Home inventory', s: 'House', run: function () { location.href = '/cmd/house/#hinv'; }, x: 'inventory insurance forsikring innbo valuables' }] : []; });
  function due() {
    var HL = window.HomeLife, out = { roof: [], bins: [], meter: [], door: [], garden: [], window: [] };
    if (!HL) return out;
    var lead = +hcfg().lead || 0;
    Fe.list('hmaint').forEach(function (x) {
      var n = daysTo(HL.nextDue(x)); if (n > lead) return;
      var t = (x.title || '').toLowerCase(), k = /gutter|takrenne|roof|tak/.test(t) ? 'roof' : /smoke|røyk|fire|brann|alarm/.test(t) ? 'door' : /drain|sluk|water|vann|bath|sealant|fuge/.test(t) ? 'window' : /heat pump|varmepumpe|filter|vent/.test(t) ? 'meter' : 'door';
      out[k].push({ t: x.title, href: '#hmaint', late: n < 0 });
    });
    var tm = addDays(today(), 1);
    Fe.list('hbins').forEach(function (b) { var nx = HL.nextPickup(b); if (nx === today() || nx === tm) out.bins.push({ t: (b.title || 'Bin') + (nx === today() ? ' – today' : ' – tomorrow'), href: '#hbins' }); });
    var r = readings(); if (hcfg().meterNudge && (!r.length || daysTo(r[r.length - 1].date) < -31)) out.meter.push({ t: 'Read the meter', href: '#hmeter' });
    var s = seasonLeft(); if (s.left.length) out.garden.push({ t: I18N.k('ui.season-checklist-left', '{s} checklist: {n} left', { s: I18N.lang === 'nb' ? s.s[1].toLowerCase() : s.s[1], n: s.left.length })   /* the season's name is already in the reader's language (I18N.k in SEASONS) */, href: '#hseason' });
    return out;
  }
  window.HousePlus = { perMonth: perMonth, seasonOf: seasonOf, seasonLeft: seasonLeft, due: due };
  (window.__core = window.__core || {})["plus"] = { on: on, Fe: Fe, sKey: sKey, seasonLeft: seasonLeft, doneMap: doneMap, items: items, USUAL: USUAL, seasonOf: seasonOf, SEASONS: SEASONS, hcfg: hcfg, due: due, readings: readings, today: today, dkey: dkey, pad: pad, addDays: addDays, fromKey: fromKey, daysTo: daysTo, perMonth: perMonth };
})();
