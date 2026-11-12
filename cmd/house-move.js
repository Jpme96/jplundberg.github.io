/* Take-over day (Nov 2026): a step-by-step guide for the day you get the keys – House → Shared.
     1 Before the day   – what to bring and have ready
     2 Meter readings   – electricity (also saved in Electricity meter), water, heating … each with a photo
     3 Keys and codes   – how many you should get and how many you got
     4 Walk-through     – what to test, and faults with photos; a fault can become a reklamasjon claim in one tap
     5 Sign the protocol – check the agent's protocol has it all, make your own record (PDF), keep the signed one
     6 After            – the moving checklist, and how to report what you find later
   The date is the take-over date from the Shared home card (dash.tools.hmove.date).
   Data: dash.tools.htake = { prep:{id:1}, meters:[{id,kind,label,value,unit,photo}], keys:[{id,label,want,got}],
     checks:{id:1}, faults:[{id,room,text,big,photos:[],claim}], seller, agent, addr, kind 'used'|'new', notes,
     signed, protocol (FDV binder doc id), open (step), hide }. Photos: house-files.js (tk-…). */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in house-move.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["move"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  var HF = window.HouseFiles;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +(p[2] || 1)); }
  function today() { return dkey(new Date()); }
  function daysTo(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function fmt(k, o) { return isKey(k) ? fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : null; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 });
  function past(hid) { return !!(hid && window.Homes && window.Homes.isPast(hid)); }
  function T(hid) { if (past(hid)) { var h = window.Homes.get(hid); return h && h.take && typeof h.take === 'object' ? h.take : {}; } var t = Fe.tools().htake; return t && typeof t === 'object' && !Array.isArray(t) ? t : {}; }
  function move() { var m = Fe.tools().hmove; return m && typeof m === 'object' && isKey(m.date) ? m : null; }
  function date(hid) { if (past(hid)) { var h = window.Homes.get(hid); return h && isKey(h.from) ? h.from : null; } var m = move(); return m ? m.date : null; }
  function arr(x) { return Array.isArray(x) ? x.filter(function (y) { return y && typeof y === 'object'; }) : []; }
  HF && HF.uses(function () { var t = T(), ids = []; if (window.Homes) window.Homes.list().forEach(function (h) { if (h.take) { arr(h.take.meters).forEach(function (m) { ids.push(m.photo); }); arr(h.take.faults).forEach(function (f) { ids = ids.concat(f.photos || []); }); } }); arr(t.meters).forEach(function (m) { ids.push(m.photo); }); arr(t.faults).forEach(function (f) { ids = ids.concat(f.photos || []); }); return ids; });
  var METERS = { power: ['Electricity', 'kWh', 'lightning-charge', '#c98500'], water: ['Water', 'm³', 'droplet', '#3987e5'], heat: ['District heating', 'kWh', 'thermometer-half', '#e8743b'], oil: ['Oil or gas tank', 'litres', 'fuel-pump', '#7a8794'], other: ['Other meter', '', 'speedometer2', '#7a8794'] };
  var CHECKS = [['taps', 'Run every tap, hot and cold, and flush the toilets – look for leaks under the sinks', 'droplet'],
    ['drains', 'Drains (sluk) are clean and the water runs away', 'water'],
    ['wet', 'Bathroom: no cracked tiles or sealant, no damp marks', 'bucket'],
    ['fuse', 'Fuse box: labelled, and the earth-fault breaker’s test button works', 'lightning'],
    ['sockets', 'Sockets and lights work', 'plug'],
    ['fire', 'Smoke alarms and the fire extinguisher are there and work', 'alarm'],
    ['windows', 'Windows and doors open, close and lock', 'door-closed'],
    ['appliances', 'What comes with the home is there and works (white goods, heat pump …)', 'box-seam'],
    ['clean', 'Cleaned and emptied as agreed – storage room, attic and garden too', 'stars'],
    ['damage', 'Nothing has been damaged since the viewing', 'eye']];
  function record(hid) {
    var t = T(hid), d = date(hid), prof = (function () { try { return JSON.parse(localStorage.getItem('dash.profile')) || {}; } catch (e) { return {}; } })();
    var pt = window.Shared && window.Shared.partner && window.Shared.partner();
    var bg = document.createElement('div'); bg.className = 'rp-bg';
    bg.innerHTML = '<div class="rp-bar"><button type="button" class="text-btn" data-tkrclose><i class="bi bi-x-lg"></i> <span data-t="ui.close">Close</span></button><span class="spacer"></span><button type="button" class="pill-btn" data-tkrprint><i class="bi bi-file-earmark-pdf"></i> <span data-t="ui.save-as-pdf">Save as PDF</span></button></div>' +
      '<p class="rp-hint"><span data-t="ui.your-own-record-of-the-take-over-next-to">Your own record of the take-over, next to the agent’s protocol. In the print window, choose</span> <b data-t="ui.save-as-pdf"><span data-t="ui.save-as-pdf">Save as PDF</span></b>.</p><article class="rp-doc"></article>';
    document.body.appendChild(bg); document.body.classList.add('rp-open');
    var doc = bg.querySelector('.rp-doc'), meters = arr(t.meters).filter(function (m) { return num(m.value) != null || m.photo; }), keys = arr(t.keys).filter(function (k) { return +k.want > 0 || num(k.got) != null; }), faults = arr(t.faults);
    var checked = CHECKS.filter(function (c) { return (t.checks || {})[c[0]]; });
    doc.innerHTML = '<header class="rp-head"><div><p class="rp-kick" data-t="ui.take-over-overtakelse">Take-over · Overtakelse</p><h1>' + esc(t.addr || 'The new home') + '</h1><p class="rp-addr">' + esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) + '</p></div></header>' +
      '<table class="rp-meta"><tr><th data-t="ui.buyer"><span data-t="ui.buyer">Buyer</span></th><td>' + esc([prof.name, window.HouseClaims ? window.HouseClaims.co() : pt ? pt.name : ''].filter(Boolean).join(' and ') || '–') + '</td><th data-t="ui.seller"><span data-t="ui.seller">Seller</span></th><td>' + esc(t.seller || '–') + '</td></tr><tr><th data-t="ui.estate-agent"><span data-t="ui.estate-agent">Estate agent</span></th><td>' + esc(t.agent || '–') + '</td><th data-t="ui.protocol-signed"><span data-t="ui.protocol-signed">Protocol signed</span></th><td>' + esc(t.signed ? fmt(t.signed) : 'not yet') + '</td></tr></table>' +
      '<h2 data-t="ui.meter-readings"><span data-t="ui.meter-readings">Meter readings</span></h2>' + (meters.length ? meters.map(function (m) { var M = METERS[m.kind] || METERS.other; return '<div class="rp-f hx-rf">' + (m.photo ? '<img class="rp-ph" data-hfimg="' + esc(m.photo) + '" alt="">' : '<span></span>') + '<div class="rp-ft"><p><b>' + esc(m.label || M[0]) + '</b></p><p class="rp-act">' + (num(m.value) != null ? esc(nf.format(num(m.value)) + ' ' + (m.unit || M[1])) : 'see the photo') + '</p></div><span></span></div>'; }).join('') : '<p data-t="ui.no-readings-noted">No readings noted.</p>') +
      '<h2 data-t="ui.keys"><span data-t="ui.keys">Keys</span></h2>' + (keys.length ? '<table class="rp-todo"><thead><tr><th data-t="ui.key"><span data-t="ui.key">Key</span></th><th data-t="ui.should-get"><span data-t="ui.should-get">Should get</span></th><th data-t="ui.got"><span data-t="ui.got">Got</span></th></tr></thead><tbody>' + keys.map(function (k) { return '<tr><td>' + esc(k.label) + '</td><td>' + esc(k.want) + '</td><td>' + esc(num(k.got) != null ? k.got : '–') + (num(k.got) != null && +k.got < +k.want ? ' (missing ' + (k.want - k.got) + ')' : '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p data-t="ui.not-counted"><span data-t="ui.not-counted">Not counted.</span></p>') +
      '<h2>Faults found (' + faults.length + ')</h2>' + (faults.length ? faults.map(function (f, i) { return '<div class="rp-part"><h3>' + (i + 1) + '. ' + esc(f.room ? f.room + ': ' : '') + esc(String(f.text).split('\n')[0]) + (f.big ? ' – serious' : '') + '</h3>' + (String(f.text).indexOf('\n') > 0 ? '<p class="rp-notes">' + esc(f.text) + '</p>' : '') + ((f.photos || []).length ? '<div class="hx-rph">' + f.photos.map(function (p) { return '<img class="rp-ph" data-hfimg="' + esc(p) + '" alt="">'; }).join('') + '</div>' : '') + '</div>'; }).join('') : '<p data-t="ui.none"><span data-t="ui.none">None.</span></p>') +
      '<h2 data-t="ui.checked-on-the-walk-through">Checked on the walk-through</h2><ul class="hx-rl">' + (checked.length ? checked.map(function (c) { return '<li>' + esc(c[1]) + '</li>'; }).join('') : '<li data-t="ui.nothing-ticked"><span data-t="ui.nothing-ticked">Nothing ticked.</span></li>') + '</ul>' +
      '<footer class="rp-foot">Take-over record · ' + esc(t.addr || '') + ' · made ' + esc(today()) + '</footer>';
    HF.fill(doc);
    function close() { bg.remove(); document.body.classList.remove('rp-open'); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    bg.addEventListener('click', function (e) {
      if (e.target.closest('[data-tkrclose]')) return close();
      if (e.target.closest('[data-tkrprint]')) { var tt = document.title; document.title = 'Take-over ' + (d || today()); var done = function () { document.title = tt; window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(function () { window.print(); }, 400); setTimeout(done, 60000); }
    });
  }
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!Fe.on('house') || T().hide) return;
    var d = date(); if (!d) return;
    var n = daysTo(d), href = /\/cmd\/house\//.test(location.pathname) ? '#htake' : '/cmd/house/#htake';
    if (n === 1) add(8, 'key', '#a0673a', I18N.k('ui.take-over-tomorrow', 'Take-over tomorrow'), I18N.k('ui.open-the-guide-what-to-bring-meters-keys', 'Open the guide: what to bring, meters, keys and the walk-through'), href, { key: 'tk:eve:' + d });
    if (n === 0) add(4, 'key', '#a0673a', I18N.k('ui.take-over-today', 'Take-over today'), I18N.k('ui.step-by-step-meters-with-photos-keys-fau', 'Step by step: meters with photos, keys, faults, the protocol'), href, { key: 'tk:day:' + d });
    var open = arr(T().faults).filter(function (f) { return !f.claim; });
    if (n < 0 && n >= -21 && open.length && Fe.on('hclaim')) add(30, 'exclamation-diamond', '#e66767', open.length + (open.length === 1 ? ' fault' : ' faults') + ' from the take-over', I18N.k('ui.make-a-claim-so-the-seller-hears-about-i', 'Make a claim so the seller hears about it in writing'), href, { key: 'tk:fl:' + open.length });
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return Fe.on('house') ? [{ i: 'key', t: 'Take-over day guide', s: 'House', run: function () { if (__ui().el) { __ui().save(function (x) { delete x.hide; }); __ui().go('htake'); } else location.href = '/cmd/house/#htake'; }, x: 'take-over overtakelse keys nøkler protokoll meter moving flytte' }] : [];
  });
  window.HouseMove = { date: date, data: T, record: record };
  (window.__core = window.__core || {})["move"] = { Fe: Fe, arr: arr, daysTo: daysTo, today: today, dkey: dkey, pad: pad, fromKey: fromKey, date: date, move: move, isKey: isKey, past: past, T: T, HF: HF, record: record, nf: nf, METERS: METERS, fmt: fmt, esc: esc, CHECKS: CHECKS, num: num };
})();
