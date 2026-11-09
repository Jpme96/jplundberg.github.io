/* Home map (House → Map tab, feature 'hmap', off until switched on in Settings → Features → Home life).
   Your own floor plan – the drawing itself, cropped to the plan – with the rooms marked on it, and on each room
   its chores (whose turn), upkeep, things from Home inventory and pins (stopcock, fuse box, router …) that open
   the Good to know details. Phones: tap → a sheet from the bottom, pinch to zoom, hold to add a pin.
   Computers: a details panel beside the map, ctrl/⌘ + scroll or the buttons to zoom.
   Data: dash.tools.hmap = { plan: {fid, w, h, mono}, rooms: [{id, name, area, r: [[x, y, w, h] …]}] (0–1 of the plan),
         pins: [{id, k, x, y, t, note, info, link, photo}], put: {'c:<chore id>' | 'u:<upkeep id>' | 'i:<item id>': room id | 'all'},
         share }  ·  the plan image and pin photos: IndexedDB "dash-map" (this device) + filesync.js (encrypted, other devices). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  var box = $t('hmap');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  var dkey = Fe.dkey, fromKey = Fe.fromKey;
  function today() { return dkey(new Date()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function days(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function when(k) { var n = days(k); return n === 0 ? L('today', 'i dag') : n === 1 ? L('tomorrow', 'i morgen') : n === -1 ? L('yesterday', 'i går') : n < 0 ? L(-n + ' days late', -n + ' dager over tiden') : n < 14 ? L('in ' + n + ' days', 'om ' + n + ' dager') : fromKey(k).toLocaleDateString(NB ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short' }); }
  function on() { return Fe.on('house') && Fe.on('hmap'); }
  function kr(n) { return new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(Math.round(+n || 0)) + ' kr'; }

  /* ---------------- data ---------------- */
  function norm(m) {
    m = m && typeof m === 'object' ? m : {};
    return { plan: m.plan && m.plan.fid ? m.plan : null, rooms: Array.isArray(m.rooms) ? m.rooms.filter(function (r) { return r && r.id && Array.isArray(r.r); }) : [],
      pins: Array.isArray(m.pins) ? m.pins.filter(function (p) { return p && p.id && isFinite(p.x) && isFinite(p.y); }) : [], put: m.put && typeof m.put === 'object' ? m.put : {},
      share: !!m.share, dark: m.dark === 'paper' ? 'paper' : 'match', shareInfo: !!m.shareInfo };
  }
  function data() { return norm(Fe.tools().hmap); }
  function save(fn) { var t = Fe.tools(), m = norm(t.hmap); fn(m); t.hmap = m; quiet = true; Fe.saveTools(t); quiet = false; draw(); }
  var quiet = false;

  /* ---------------- files on this device (+ synced) ---------------- */
  var idb = null;
  function db() { return idb || (idb = new Promise(function (res, rej) { var r = indexedDB.open('dash-map', 1); r.onupgradeneeded = function () { r.result.createObjectStore('files'); }; r.onsuccess = function () { res(r.result); }; r.onerror = rej; })); }
  function keepF(id, b) { return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('files', 'readwrite'); t.objectStore('files').put(b, id); t.oncomplete = res; t.onerror = function () { rej(t.error); }; }); }); }
  function putF(id, b) { return keepF(id, b).then(function () { if (window.FileSync) window.FileSync.up(id, b); }); }
  function localF(id) { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('files').objectStore('files').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function getF(id) { return localF(id).then(function (b) { if (b || !window.FileSync) return b; return window.FileSync.down(id).then(function (nb) { if (nb) keepF(id, nb); return nb; }); }); }
  function delF(id) { if (!id) return; if (window.FileSync) window.FileSync.del(id); db().then(function (d) { d.transaction('files', 'readwrite').objectStore('files').delete(id); }).catch(function () {}); }
  var urls = {};
  function urlOf(id) { if (urls[id]) return Promise.resolve(urls[id]); return getF(id).then(function (b) { if (!b) return null; return (urls[id] = URL.createObjectURL(b)); }); }

  /* ---------------- rooms: what kind of room a name is, and where things belong ---------------- */
  var RT = [['bath', /bad\b|^bad|bath|wc|toalett|dusj/i], ['kitchen', /kj[øo]kken|kitchen/i], ['living', /stue|living|lounge/i], ['bed', /sov|bed|soverom/i],
    ['hall', /entr|gang|hall|vindfang|corridor/i], ['balcony', /balkong|balcony|terrasse|veranda|uteplass|patio/i], ['office', /kontor|office|studio/i],
    ['storage', /bod\b|storage|lager|loft|kjeller|attic|garage|garasje/i], ['laundry', /vaskerom|laundry/i]];
  function typesOf(name) { return RT.filter(function (t) { return t[1].test(name || ''); }).map(function (t) { return t[0]; }); }
  var GC = [[/vacuum|støvsug|mop|vask gulv|gulvvask|dust|støvtørk|whole|hele/i, 'all'], [/bath|\bbad|toalett|dusj|sluk|\bwc\b/i, 'bath'], [/kitchen|kj[øo]kken|dish|oppvask|komfyr|stove|oven|fridge|kjøleskap|vifte|\bhood\b/i, 'kitchen'],
    [/sheet|sengetøy|laken|\bbed\b|seng/i, 'bed'], [/\bbin|søppel|trash|garbage|\bpant\b|panting|shoe|sko\b/i, 'hall'], [/plant|blomst|balcony|balkong/i, 'balcony'], [/laundry|klesvask|vaske klær|washing/i, 'laundry']];
  var GU = [[/smoke|røyk/i, 'all'], [/extinguisher|brannslukk|slukkeapparat/i, 'hall'], [/drain|sluk|toilet|toalett|\bwc\b|silikon|silicone|shower|dusj|washing machine|vaskemaskin|bathroom|\bbad\b/i, 'bath'],
    [/\bhood\b|vifte|fridge|kjøleskap|dishwasher|oppvaskmaskin|oven|stove|komfyr|kitchen|kj[øo]kken/i, 'kitchen'], [/balcony|balkong|terrasse/i, 'balcony'], [/heat pump|varmepumpe|ventilat|filter|radiator|panelovn/i, 'all']];
  var INVT = { living: 'living', kitchen: 'kitchen', bedroom: 'bed', office: 'office', bathroom: 'bath', hall: 'hall', storage: 'storage', garage: 'storage' };
  function guess(list, text) { for (var i = 0; i < list.length; i++) if (list[i][0].test(text || '')) return list[i][1]; return null; }
  function roomFor(type, rooms) {
    if (!type) return null; if (type === 'all') return 'all';
    /* several of a kind (two bedrooms): the biggest one – the main bedroom gets the sheets */
    var size = function (x) { var a = +String(x.area || '').replace(',', '.'); return a > 0 ? a : x.r.reduce(function (s, q) { return s + q[2] * q[3] * 100; }, 0); };
    var r = rooms.filter(function (x) { return typesOf(x.name).indexOf(type) > -1; }).sort(function (a, b) { return size(b) - size(a); })[0];
    if (!r && type === 'laundry') r = rooms.filter(function (x) { return typesOf(x.name).indexOf('bath') > -1; })[0];
    if (!r && type === 'hall') r = rooms.filter(function (x) { return /entr/i.test(x.name); })[0];
    return r ? r.id : null;
  }
  /* everything that can sit in a room: chores, upkeep, things – with the room it's in (yours first, else a guess) */
  function things(m) {
    var out = [], put = m.put, rooms = m.rooms, C = window.Chores, H = window.HomeLife;
    if (Fe.on('house')) {
      (Fe.tools().chores || []).forEach(function (c) {
        if (!c || !c.id) return; var key = 'c:' + c.id, rid = put[key] || roomFor(guess(GC, c.name), rooms);
        var p = C ? C.period(c) : null, done = C && p ? C.done(c, p) : null, who = C && p ? C.turn(c, p) : 'me';
        out.push({ key: key, kind: 'c', id: c.id, name: c.name || L('Chore', 'Husarbeid'), room: rid, guessed: !put[key], due: p ? p.day : null, done: !!done, who: who, late: !!(p && !done && p.day < today()), icon: C && C.icon ? C.icon(c.name || '') : 'arrow-repeat' });
      });
      (Fe.tools().hmaint || []).forEach(function (u) {
        if (!u || !u.id) return; var key = 'u:' + u.id, rid = put[key] || roomFor(guess(GU, u.title), rooms), nd = H && H.nextDue ? H.nextDue(u) : today();
        out.push({ key: key, kind: 'u', id: u.id, name: u.title || L('Upkeep', 'Vedlikehold'), room: rid, guessed: !put[key], due: nd, late: nd < today(), icon: 'tools' });
      });
      (Fe.tools().hinv || []).forEach(function (i) {
        if (!i || !i.id) return; var key = 'i:' + i.id, rid = put[key] || roomFor(INVT[i.room] || null, rooms);
        out.push({ key: key, kind: 'i', id: i.id, name: i.name || L('Item', 'Ting'), room: rid, guessed: !put[key], price: i.price, receipt: !!i.receipt, icon: 'box-seam' });
      });
    }
    return out;
  }
  /* due soon: chores in the next 2 days, upkeep in the next 14 */
  function soon(x) { if (x.kind === 'c') return !x.done && x.due && days(x.due) <= 2; if (x.kind === 'u') return x.due && days(x.due) <= 14; return false; }
  function partnerName() { var S = window.Shared, p = S && S.partner ? S.partner() : null; return p && p.name ? p.name : L('Them', 'De'); }
  function initial(who) { var n = who === 'me' ? (((window.Vault.get() || {}).profile || {}).name || L('You', 'Du')) : partnerName(); return String(n).replace(/[^A-Za-zÆØÅæøåÀ-ÿ]/g, '').charAt(0).toUpperCase() || '?'; }

  /* ---------------- pins ---------------- */
  var PK = [
    ['water', L('Stopcock', 'Stoppekran'), 'droplet', '#0891b2', 'water'], ['power', L('Fuse box', 'Sikringsskap'), 'lightning-charge', '#c98500', 'power'],
    ['wifi', L('Router', 'Ruter'), 'wifi', '#3987e5', 'wifi'], ['smoke', L('Smoke alarm', 'Røykvarsler'), 'alarm', '#e05555', null],
    ['fire', L('Fire extinguisher', 'Brannslukker'), 'fire', '#e8743b', null], ['key', L('Keys and codes', 'Nøkler og koder'), 'key', '#7a8794', 'code'],
    ['heat', L('Thermostat', 'Termostat'), 'thermometer-half', '#d55181', null], ['heater', L('Water heater', 'Varmtvannsbereder'), 'water', '#0891b2', 'water'],
    ['app', L('Appliance', 'Hvitevare'), 'plug', '#8a6fdf', 'appliance'], ['chore', L('A chore', 'Husarbeid'), 'check2-square', '#1f9d55', null],
    ['up', L('An upkeep job', 'Vedlikehold'), 'tools', '#e05555', null], ['note', L('Something else', 'Noe annet'), 'pin-map', '#6b6f76', null]];
  function pk(k) { return PK.filter(function (x) { return x[0] === k; })[0] || PK[PK.length - 1]; }
  function infoOf(p) { return p.info ? (Fe.tools().hinfo || []).filter(function (x) { return x && x.id === p.info; })[0] || null : null; }
  function linkOf(p, list) { return p.link ? list.filter(function (x) { return x.key === p.link; })[0] || null : null; }
  function pinTitle(p, list) { var i = infoOf(p), l = linkOf(p, list); return p.t || (l ? l.name : i ? i.title : pk(p.k)[1]); }
  function inRect(x, y, r) { return x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]; }
  function roomAt(x, y, rooms) { var best = null, ba = 9; rooms.forEach(function (rm) { rm.r.forEach(function (r) { if (inRect(x, y, r) && r[2] * r[3] < ba) { ba = r[2] * r[3]; best = rm; } }); }); return best; }

  /* ---------------- view state ---------------- */
  var LAY = (function () { try { return Object.assign({ pins: true, chores: true, upkeep: true }, JSON.parse(localStorage.getItem('dash.hmLayers')) || {}); } catch (e) { return { pins: true, chores: true, upkeep: true }; } })();
  var Z = { s: 1, x: 0, y: 0 }, mode = 'view', arm = null, sel = null, editRoom = null;
  var wide = window.matchMedia('(min-width: 900px)');

  /* ---------------- drawing ---------------- */
  function draw() {
    if (!box) return;
    if (!on()) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var m = data();
    if (!m.plan) { box.innerHTML = emptyCard(); return; }
    if (!box.querySelector('.hm-card') || box.dataset.fid !== m.plan.fid) { box.innerHTML = shell(m); box.dataset.fid = m.plan.fid; loadImg(m); bindView(); }
    paint(m);
  }
  function emptyCard() {
    return '<section class="card kit-card hm-card hm-empty" id="hmap"><div class="card-head"><h2><i class="bi bi-map"></i> ' + L('Map', 'Kart') + '</h2></div>' +
      '<div class="hm-start"><span class="hm-start-ic"><i class="bi bi-house-door"></i></span><p><b>' + L('Add the floor plan of your home', 'Legg inn plantegningen av boligen') + '</b>' +
      L('The drawing from the seller or the architect – a PDF or a photo. You choose the part with the plan next, so the address and the rest of the sheet stay out.', 'Tegningen fra selger eller arkitekt – en PDF eller et bilde. Du velger delen med planen etterpå, så adressen og resten av arket holdes utenfor.') + '</p>' +
      '<label class="pill-btn"><i class="bi bi-upload"></i> ' + L('Choose the drawing', 'Velg tegningen') + '<input type="file" accept="application/pdf,.pdf,image/*" hidden data-hmfile></label>' +
      '<small class="muted">' + L('Kept encrypted on your devices, like your Papers.', 'Lagres kryptert på enhetene dine, som Papirer.') + '</small></div></section>';
  }
  function shell(m) {
    var H = m.plan.h / m.plan.w;
    return '<section class="card kit-card hm-card" id="hmap"><div class="card-head"><h2><i class="bi bi-map"></i> ' + L('Map', 'Kart') + '</h2>' +
      '<div class="hm-acts"><button type="button" class="pill-btn sm ghost" data-hmmode="rooms"><i class="bi bi-bounding-box"></i> <span>' + L('Rooms', 'Rom') + '</span></button>' +
      '<button type="button" class="pill-btn sm ghost" data-hmaddpin><i class="bi bi-geo-alt"></i> <span>' + L('Add a pin', 'Ny nål') + '</span></button></div></div>' +
      '<div class="hm-chips" role="group" aria-label="' + L('Show on the map', 'Vis på kartet') + '">' +
      [['pins', 'geo-alt', L('Pins', 'Nåler')], ['chores', 'arrow-repeat', L('Chores', 'Husarbeid')], ['upkeep', 'tools', L('Upkeep', 'Vedlikehold')]].map(function (c) { return '<button type="button" class="hm-chip" data-hmlay="' + c[0] + '" aria-pressed="' + !!LAY[c[0]] + '"><i class="bi bi-' + c[1] + '"></i> ' + c[2] + '</button>'; }).join('') + '</div>' +
      '<p class="hm-hint" data-hmhint></p>' +
      '<div class="hm-wrap"><div class="hm-col"><div class="hm-view" data-hmview style="aspect-ratio:' + m.plan.w + ' / ' + m.plan.h + ';width:min(100%, calc((100vh - 220px) * ' + (m.plan.w / m.plan.h).toFixed(4) + '))">' +
      '<div class="hm-stage" data-hmstage><img class="hm-img" alt="' + L('Floor plan', 'Plantegning') + '" draggable="false">' +
      '<svg class="hm-svg" viewBox="0 0 1000 ' + Math.round(1000 * H) + '" preserveAspectRatio="none" aria-hidden="true"><g data-hmrooms></g><rect data-hmdraft class="hm-draft" x="0" y="0" width="0" height="0" hidden></rect></svg>' +
      '<div class="hm-layer" data-hmlayer></div></div>' +
      '<div class="hm-zoom"><button type="button" data-hmz="in" aria-label="' + L('Zoom in', 'Zoom inn') + '"><i class="bi bi-plus-lg"></i></button><button type="button" data-hmz="out" aria-label="' + L('Zoom out', 'Zoom ut') + '"><i class="bi bi-dash-lg"></i></button><button type="button" data-hmz="fit" aria-label="' + L('Fit the whole plan', 'Vis hele planen') + '"><i class="bi bi-arrows-angle-contract"></i></button></div>' +
      '</div></div><aside class="hm-side" data-hmside aria-live="polite"></aside></div></section>';
  }
  function loadImg(m) {
    var img = box.querySelector('.hm-img'); if (!img) return;
    urlOf(m.plan.fid).then(function (u) {
      if (u) { img.src = u; return; }
      img.removeAttribute('src'); var v = box.querySelector('[data-hmview]'); if (v && !v.querySelector('.hm-miss')) v.insertAdjacentHTML('beforeend', '<p class="hm-miss"><i class="bi bi-cloud-arrow-down"></i> ' + L('The drawing is on its way from your other device – open House there once if it doesn’t come.', 'Tegningen er på vei fra den andre enheten – åpne Hus der én gang hvis den ikke kommer.') + '</p>');
    });
  }
  function paint(m) {
    if (!box) return;
    var view = box.querySelector('[data-hmview]'); if (!view) return;
    view.classList.toggle('dk', m.dark === 'match' && !!m.plan.mono);
    view.classList.toggle('editing', mode === 'rooms'); view.classList.toggle('arming', !!arm);
    box.querySelectorAll('[data-hmmode]').forEach(function (b) { b.setAttribute('aria-pressed', String(mode === b.dataset.hmmode)); b.querySelector('span').textContent = mode === 'rooms' ? L('Done', 'Ferdig') : L('Rooms', 'Rom'); });
    box.querySelectorAll('[data-hmlay]').forEach(function (b) { b.setAttribute('aria-pressed', String(!!LAY[b.dataset.hmlay])); });
    var hint = box.querySelector('[data-hmhint]');
    hint.innerHTML = arm && arm.t === 'pin' ? '<i class="bi bi-hand-index"></i> ' + L('Tap where the pin goes', 'Trykk der nålen skal stå') + ' <button type="button" class="text-btn" data-hmcancel>' + L('Cancel', 'Avbryt') + '</button>'
      : arm && arm.t === 'move' ? '<i class="bi bi-arrows-move"></i> ' + L('Tap the new spot', 'Trykk på det nye stedet') + ' <button type="button" class="text-btn" data-hmcancel>' + L('Cancel', 'Avbryt') + '</button>'
      : arm && arm.t === 'part' ? '<i class="bi bi-plus-square-dotted"></i> ' + L('Drag over the rest of ', 'Dra over resten av ') + esc(arm.name) + ' <button type="button" class="text-btn" data-hmcancel>' + L('Cancel', 'Avbryt') + '</button>'
      : mode === 'rooms' ? '<i class="bi bi-bounding-box"></i> ' + L('Drag a box over a room to mark it. Tap a marked room to rename it or add another part (for L-shaped rooms).', 'Dra en boks over et rom for å merke det. Trykk på et merket rom for å endre navnet eller legge til en del (for L-formede rom).')
      : !m.rooms.length ? '<i class="bi bi-info-circle"></i> ' + L('Next: tap Rooms and drag a box over each room, so chores, upkeep and things find their place.', 'Neste: trykk Rom og dra en boks over hvert rom, så husarbeid, vedlikehold og ting finner plassen sin.')
      : (wide.matches ? L('Tap a room or a pin · hold a spot to add a pin · ⌘/ctrl + scroll to zoom', 'Trykk på et rom eller en nål · hold inne for å legge til en nål · ⌘/ctrl + rull for å zoome') : L('Tap a room or a pin · hold a spot to add a pin · pinch to zoom', 'Trykk på et rom eller en nål · hold inne for en ny nål · knip for å zoome'));
    var list = things(m), H = 1000 * m.plan.h / m.plan.w;
    box.querySelector('[data-hmrooms]').innerHTML = m.rooms.map(function (rm) {
      return rm.r.map(function (r) { return '<rect class="hm-room' + (sel && sel.room === rm.id ? ' on' : '') + (mode === 'rooms' ? ' ed' : '') + '" data-hmroom="' + esc(rm.id) + '" x="' + (r[0] * 1000).toFixed(1) + '" y="' + (r[1] * H).toFixed(1) + '" width="' + (r[2] * 1000).toFixed(1) + '" height="' + (r[3] * H).toFixed(1) + '"></rect>'; }).join('');
    }).join('');
    var lay = box.querySelector('[data-hmlayer]'), h = '';
    m.rooms.forEach(function (rm) {
      var big = rm.r.slice().sort(function (a, b) { return b[2] * b[3] - a[2] * a[3]; })[0], here = list.filter(function (x) { return x.room === rm.id; });
      var due = here.filter(function (x) { return ((x.kind === 'c' && LAY.chores) || (x.kind === 'u' && LAY.upkeep)) && soon(x); }), late = due.some(function (x) { return x.late; });
      var ch = LAY.chores ? here.filter(function (x) { return x.kind === 'c' && !x.done && x.due; }).sort(function (a, b) { return a.due < b.due ? -1 : 1; })[0] : null;
      if (mode === 'rooms') h += '<span class="hm-tag" style="left:' + ((big[0] + big[2] / 2) * 100) + '%;top:' + ((big[1] + big[3] / 2) * 100) + '%">' + esc(rm.name) + '</span>';
      else if (due.length || ch) h += '<span class="hm-badge' + (late ? ' late' : '') + '" style="left:' + ((big[0] + big[2]) * 100) + '%;top:' + (big[1] * 100) + '%">' + (ch ? '<b class="hm-face ' + (ch.who === 'me' ? 'me' : 'them') + '">' + esc(initial(ch.who)) + '</b>' : '') + (due.length ? '<i>' + due.length + '</i>' : '') + '</span>';
    });
    if (LAY.pins && mode !== 'rooms') m.pins.forEach(function (p) {
      var k = pk(p.k), l = linkOf(p, list), due = l && soon(l), late = l && l.late;
      h += '<button type="button" class="hm-pin' + (sel && sel.pin === p.id ? ' on' : '') + (late ? ' late' : due ? ' due' : '') + '" data-hmpin="' + esc(p.id) + '" style="left:' + (p.x * 100) + '%;top:' + (p.y * 100) + '%;--c:' + k[3] + '" aria-label="' + esc(pinTitle(p, list)) + '"><i class="bi bi-' + k[2] + '"></i></button>';
    });
    if (lay.innerHTML !== h) lay.innerHTML = h;
    applyZ();
    if (wide.matches) side(m, list); else if (sheetOpen()) refreshSheet(m, list);
  }

  /* ---------------- zoom and pan ---------------- */
  function applyZ() {
    if (!box) return;
    var st = box.querySelector('[data-hmstage]'), v = box.querySelector('[data-hmview]'); if (!st || !v) return;
    var W = v.clientWidth, Hh = v.clientHeight;
    Z.s = Math.min(6, Math.max(1, Z.s)); Z.x = Math.min(0, Math.max(W - W * Z.s, Z.x)); Z.y = Math.min(0, Math.max(Hh - Hh * Z.s, Z.y));
    st.style.transform = 'translate(' + Z.x + 'px,' + Z.y + 'px) scale(' + Z.s + ')'; st.style.setProperty('--s', Z.s);
    v.style.touchAction = Z.s > 1.01 || mode === 'rooms' || arm ? 'none' : 'pan-y';
    v.classList.toggle('zoomed', Z.s > 1.01);
  }
  function zoomAt(f, cx, cy) { var v = box.querySelector('[data-hmview]'), r = v.getBoundingClientRect(); cx = cx == null ? r.width / 2 : cx - r.left; cy = cy == null ? r.height / 2 : cy - r.top; var ns = Math.min(6, Math.max(1, Z.s * f)); Z.x = cx - (cx - Z.x) * ns / Z.s; Z.y = cy - (cy - Z.y) * ns / Z.s; Z.s = ns; applyZ(); }
  function at(e) { var st = box.querySelector('[data-hmstage]').getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - st.left) / st.width)), y: Math.min(1, Math.max(0, (e.clientY - st.top) / st.height)) }; }

  function bindView() {
    var v = box.querySelector('[data-hmview]'), pts = {}, start = null, pinch = null, hold = null, draft = null, lastTap = 0;
    v.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.hm-zoom') || e.button > 0) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2) { clearTimeout(hold); draft = null; hideDraft(); var a = pts[ids[0]], b = pts[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: Z.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, x: Z.x, y: Z.y }; start = null; return; }
      if (e.target.closest('.hm-pin') && !arm && mode !== 'rooms') { start = null; return; }
      start = { x: e.clientX, y: e.clientY, zx: Z.x, zy: Z.y, t: Date.now(), moved: false, p: at(e), id: e.pointerId };
      try { v.setPointerCapture(e.pointerId); } catch (x) {}
      if (mode === 'rooms' || (arm && arm.t === 'part')) { draft = { x0: start.p.x, y0: start.p.y }; return; }
      if (!arm) hold = setTimeout(function () { if (start && !start.moved) { var p = start.p; start = null; addPinAt(p.x, p.y); } }, 550);
    });
    v.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return; pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (pinch && ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y), r = v.getBoundingClientRect(), ns = Math.min(6, Math.max(1, pinch.s * d / pinch.d)), cx = pinch.mx - r.left, cy = pinch.my - r.top, mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        Z.x = mx - (cx - pinch.x) * ns / pinch.s; Z.y = my - (cy - pinch.y) * ns / pinch.s; Z.s = ns; applyZ(); return; }
      if (!start || start.id !== e.pointerId) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) { start.moved = true; clearTimeout(hold); }
      if (draft) { var p = at(e); showDraft(draft.x0, draft.y0, p.x, p.y); return; }
      if (start.moved && Z.s > 1.01) { Z.x = start.zx + dx; Z.y = start.zy + dy; applyZ(); }
    });
    function end(e) {
      delete pts[e.pointerId]; clearTimeout(hold);
      if (pinch) { if (Object.keys(pts).length < 2) pinch = null; start = null; return; }
      if (!start || start.id !== e.pointerId) return;
      var s0 = start; start = null;
      if (draft) { var p = at(e), d0 = draft; draft = null; hideDraft();
        var r = [Math.min(d0.x0, p.x), Math.min(d0.y0, p.y), Math.abs(p.x - d0.x0), Math.abs(p.y - d0.y0)];
        if (r[2] > .02 && r[3] > .02) { newPart(r); return; }
        if (!s0.moved) tap(s0.p, e); return; }
      if (!s0.moved && e.type === 'pointerup') { var now = Date.now(); if (!arm && mode === 'view' && now - lastTap < 300 && !wide.matches) { lastTap = 0; if (Z.s > 1.5) { Z = { s: 1, x: 0, y: 0 }; applyZ(); } else zoomAt(2.2, e.clientX, e.clientY); return; } lastTap = now; tap(s0.p, e); }
    }
    v.addEventListener('pointerup', end); v.addEventListener('pointercancel', end);
    v.addEventListener('wheel', function (e) { if (!(e.ctrlKey || e.metaKey) && Z.s <= 1.01) return; e.preventDefault(); if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * .01), e.clientX, e.clientY); else { Z.x -= e.deltaX; Z.y -= e.deltaY; applyZ(); } }, { passive: false });
    v.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    v.addEventListener('dblclick', function (e) { if (!wide.matches || mode !== 'view') return; if (Z.s > 1.5) { Z = { s: 1, x: 0, y: 0 }; applyZ(); } else zoomAt(2, e.clientX, e.clientY); });
  }
  function showDraft(x0, y0, x1, y1) { var d = box.querySelector('[data-hmdraft]'), m = data(), H = 1000 * m.plan.h / m.plan.w; d.hidden = false; d.setAttribute('x', Math.min(x0, x1) * 1000); d.setAttribute('y', Math.min(y0, y1) * H); d.setAttribute('width', Math.abs(x1 - x0) * 1000); d.setAttribute('height', Math.abs(y1 - y0) * H); }
  function hideDraft() { var d = box.querySelector('[data-hmdraft]'); if (d) d.hidden = true; }

  /* a tap on the plan (not on a pin) */
  function tap(p) {
    var m = data();
    if (arm && arm.t === 'pin') { var a = arm; arm = null; paint(m); addPinAt(p.x, p.y, a.k); return; }
    if (arm && arm.t === 'move') { var id = arm.id; arm = null; save(function (d) { d.pins.forEach(function (x) { if (x.id === id) { x.x = p.x; x.y = p.y; } }); }); sel = { pin: id }; openPin(id); return; }
    var rm = roomAt(p.x, p.y, m.rooms);
    if (mode === 'rooms') { if (rm) roomEdit(rm.id); return; }
    if (rm) { sel = { room: rm.id }; paint(m); openRoom(rm.id); }
    else { sel = null; paint(m); if (!wide.matches) closeSheet(); }
  }

  /* ---------------- details: side panel (computer) or bottom sheet (phone) ---------------- */
  var sheetEl = null;
  function sheetOpen() { return !!(sheetEl && sheetEl.isConnected); }
  function show(html) {
    if (wide.matches) { var s = box.querySelector('[data-hmside]'); if (s) { s.innerHTML = html; s.scrollTop = 0; } return; }
    if (!sheetOpen()) {
      sheetEl = document.createElement('div'); sheetEl.className = 'hm-sheetbg';
      sheetEl.innerHTML = '<div class="hm-sheet" role="dialog" aria-modal="true"><div class="hm-grab" data-hmclose aria-hidden="true"></div><div class="hm-sbody"></div></div>';
      /* keep the whole map in view above the sheet */
      document.documentElement.classList.add('hm-sheet-on');
      var v0 = box && box.querySelector('[data-hmview]'); if (v0) requestAnimationFrame(function () { var top = v0.getBoundingClientRect().top + window.scrollY - 12; if (Math.abs(window.scrollY - top) > 8) window.scrollTo({ top: top, behavior: 'smooth' }); });
      var el = sheetEl; el._at = Date.now();
      document.body.appendChild(el); requestAnimationFrame(function () { el.classList.add('open'); });
      /* a phone sends a click right after the tap that opened this – it mustn't close it again */
      el.addEventListener('click', function (e) { if (Date.now() - el._at < 450) return; if (e.target === el || e.target.closest('[data-hmclose]')) closeSheet(); });
      var sh = sheetEl.querySelector('.hm-sheet'), y0 = null;
      sh.addEventListener('touchstart', function (e) { if (sh.scrollTop <= 0 && e.target.closest('.hm-grab, .hm-shead')) y0 = e.touches[0].clientY; }, { passive: true });
      sh.addEventListener('touchmove', function (e) { if (y0 == null) return; var dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
      sh.addEventListener('touchend', function (e) { if (y0 == null) return; var dy = (e.changedTouches[0].clientY - y0); y0 = null; sh.style.transform = ''; if (dy > 90) closeSheet(); });
      document.addEventListener('keydown', escKey, true);
    }
    sheetEl._at = Date.now(); sheetEl.querySelector('.hm-sbody').innerHTML = html;
  }
  function escKey(e) { if (e.key === 'Escape' && sheetOpen()) { e.stopPropagation(); closeSheet(); } }
  function closeSheet() { if (!sheetOpen()) return; var s = sheetEl; sheetEl = null; document.documentElement.classList.remove('hm-sheet-on'); s.classList.remove('open'); setTimeout(function () { s.remove(); }, 220); document.removeEventListener('keydown', escKey, true); if (sel) { sel = null; var m = data(); if (m.plan) paint(m); } }
  var current = null;   /* what the panel/sheet shows: {t: 'room'|'pin'|'over', id} */
  function refreshSheet(m, list) { if (!current) return; if (current.t === 'room') openRoom(current.id, m, list); else if (current.t === 'pin') openPin(current.id, m, list); }
  function side(m, list) { if (!current || current.t === 'over') overview(m, list); else refreshSheet(m, list); }
  function row(x, extra) {
    var sub = x.kind === 'c' ? (x.who === 'me' ? L('You', 'Du') : esc(partnerName())) + (x.done ? ' · ' + L('done', 'gjort') : x.due ? ' · ' + when(x.due) : '') : x.kind === 'u' ? L('Upkeep', 'Vedlikehold') + ' · ' + when(x.due) : (x.price ? kr(x.price) : '') + (x.receipt ? ' · ' + L('receipt', 'kvittering') : '');
    var act = x.kind === 'c' ? '<button type="button" class="pill-btn sm" data-hmdone="' + esc(x.key) + '">' + (x.done ? L('Undo', 'Angre') : L('Done', 'Ferdig')) + '</button>' : x.kind === 'u' ? '<button type="button" class="pill-btn sm" data-hmdone="' + esc(x.key) + '">' + L('Done', 'Ferdig') + '</button>' : '<a class="icon-btn sm" href="#hinv=' + esc(x.id) + '" data-hminv="' + esc(x.id) + '" aria-label="' + L('Open in Home inventory', 'Åpne i innbo') + '"><i class="bi bi-chevron-right"></i></a>';
    return '<li class="hm-li' + (x.done ? ' done' : '') + '">' + (x.kind === 'c' ? '<b class="hm-face ' + (x.who === 'me' ? 'me' : 'them') + '">' + esc(initial(x.who)) + '</b>' : '<span class="hm-li-ic"><i class="bi bi-' + x.icon + '"></i></span>') +
      '<span class="hm-li-t">' + esc(x.name) + '<small class="' + (x.late ? 'late' : '') + '">' + sub + (extra || '') + '</small></span>' + act + '</li>';
  }
  function overview(m, list) {
    current = { t: 'over' };
    var due = list.filter(soon).sort(function (a, b) { return (a.due || '') < (b.due || '') ? -1 : 1; }), name = function (id) { var r = m.rooms.filter(function (x) { return x.id === id; })[0]; return id === 'all' ? L('Whole home', 'Hele boligen') : r ? r.name : L('No room yet', 'Uten rom'); };
    var area = m.rooms.reduce(function (a, r) { return a + (+String(r.area || '').replace(',', '.') || 0); }, 0);
    show('<div class="hm-shead"><h3>' + L('Your home', 'Boligen din') + '</h3><p class="muted">' + m.rooms.length + ' ' + L(m.rooms.length === 1 ? 'room' : 'rooms', 'rom') + (area ? ' · ' + String(Math.round(area * 10) / 10).replace('.', ',') + ' m²' : '') + ' · ' + m.pins.length + ' ' + L(m.pins.length === 1 ? 'pin' : 'pins', m.pins.length === 1 ? 'nål' : 'nåler') + '</p></div>' +
      (due.length ? '<p class="hm-sec">' + L('Coming up', 'Snart') + '</p><ul class="hm-list">' + due.slice(0, 8).map(function (x) { return row(x, ' · ' + esc(name(x.room))); }).join('') + '</ul>' : '<p class="muted hm-none">' + L('Nothing due in the next days.', 'Ingenting som haster de neste dagene.') + '</p>') +
      '<p class="muted hm-tip">' + L('Tap a room to see its chores, upkeep and things, or a pin for where things are.', 'Trykk på et rom for husarbeid, vedlikehold og ting, eller en nål for hvor ting er.') + '</p>');
  }
  function openRoom(id, m, list) {
    m = m || data(); list = list || things(m); var rm = m.rooms.filter(function (x) { return x.id === id; })[0]; if (!rm) { current = null; return; }
    current = { t: 'room', id: id }; sel = { room: id };
    var here = list.filter(function (x) { return x.room === id; }), all = list.filter(function (x) { return x.room === 'all' && x.kind !== 'i' && soon(x); });
    var ch = here.filter(function (x) { return x.kind === 'c'; }), up = here.filter(function (x) { return x.kind === 'u'; }), it = here.filter(function (x) { return x.kind === 'i'; });
    var pins = m.pins.filter(function (p) { var r = roomAt(p.x, p.y, m.rooms); return r && r.id === id; });
    function sec(t, l, empty) { return '<p class="hm-sec">' + t + '</p>' + (l.length ? '<ul class="hm-list">' + l.map(function (x) { return row(x); }).join('') + '</ul>' : '<p class="muted hm-none">' + empty + '</p>'); }
    show('<div class="hm-shead"><h3>' + esc(rm.name) + '</h3><p class="muted">' + (rm.area ? esc(rm.area) + ' m² · ' : '') + '<button type="button" class="text-btn" data-hmput="' + esc(id) + '"><i class="bi bi-plus-lg"></i> ' + L('Put things here', 'Legg ting her') + '</button></p></div>' +
      sec(L('Chores', 'Husarbeid'), ch, L('No chores here yet.', 'Ikke noe husarbeid her ennå.')) + sec(L('Upkeep', 'Vedlikehold'), up, L('No upkeep here.', 'Ikke noe vedlikehold her.')) +
      (it.length ? sec(L('Things here', 'Ting her'), it, '') : '') +
      (pins.length ? '<p class="hm-sec">' + L('Pins', 'Nåler') + '</p><ul class="hm-list">' + pins.map(function (p) { var k = pk(p.k); return '<li class="hm-li"><span class="hm-li-ic" style="--c:' + k[3] + '"><i class="bi bi-' + k[2] + '"></i></span><span class="hm-li-t">' + esc(pinTitle(p, list)) + '</span><button type="button" class="icon-btn sm" data-hmopenpin="' + esc(p.id) + '" aria-label="' + L('Open', 'Åpne') + '"><i class="bi bi-chevron-right"></i></button></li>'; }).join('') + '</ul>' : '') +
      (all.length ? '<p class="hm-sec">' + L('For the whole home', 'For hele boligen') + '</p><ul class="hm-list">' + all.map(function (x) { return row(x); }).join('') + '</ul>' : ''));
    var mm = data(); if (box.querySelector('[data-hmrooms]') && mm.plan) markSel();
  }
  function markSel() { if (!box) return; box.querySelectorAll('[data-hmroom]').forEach(function (r) { r.classList.toggle('on', !!(sel && sel.room === r.dataset.hmroom)); }); box.querySelectorAll('[data-hmpin]').forEach(function (b) { b.classList.toggle('on', !!(sel && sel.pin === b.dataset.hmpin)); }); }
  function openPin(id, m, list) {
    m = m || data(); list = list || things(m); var p = m.pins.filter(function (x) { return x.id === id; })[0]; if (!p) { current = null; return; }
    current = { t: 'pin', id: id }; sel = { pin: id }; markSel();
    var k = pk(p.k), info = infoOf(p), l = linkOf(p, list), rm = roomAt(p.x, p.y, m.rooms), H = window.HomeLife, h = '';
    h += '<div class="hm-shead"><h3><span class="hm-pin-ic" style="--c:' + k[3] + '"><i class="bi bi-' + k[2] + '"></i></span> ' + esc(pinTitle(p, list)) + '</h3><p class="muted">' + (rm ? esc(rm.name) : L('On the map', 'På kartet')) + (info && info.where ? ' · ' + esc(info.where) : '') + '</p></div>';
    if (p.photo) h += '<img class="hm-photo" data-hmph="' + esc(p.photo) + '" alt="">';
    if (l) h += '<ul class="hm-list">' + row(l) + '</ul>';
    if (info && H && H.INFO) {
      var spec = H.INFO[info.kind] || H.INFO.other, rows = spec.f.filter(function (f) { return f.k !== 'title' && f.k !== 'where' && info[f.k] != null && String(info[f.k]).trim() !== ''; });
      h += rows.length ? '<dl class="hm-facts">' + rows.map(function (f) {
        var v = String(info[f.k]), sec = !!f.secret;
        return '<div><dt>' + esc(L(f.label, f.label)) + '</dt><dd' + (f.type === 'textarea' ? ' class="pre"' : '') + '>' + (sec ? '<span data-hmsec="' + esc(v) + '">••••••••</span> <button type="button" class="text-btn" data-hmshow>' + L('Show', 'Vis') + '</button> <button type="button" class="text-btn" data-hmcopy="' + esc(v) + '">' + L('Copy', 'Kopier') + '</button>' : esc(v)) + '</dd></div>';
      }).join('') + '</dl>' : '<p class="muted hm-none">' + L('No details yet – add where it is, and the rest.', 'Ingen detaljer ennå – legg inn hvor den er, og resten.') + '</p>';
      h += '<button type="button" class="pill-btn sm hm-edinfo" data-hmedinfo="' + esc(info.id) + '"><i class="bi bi-pencil"></i> ' + L('Edit the details', 'Endre detaljene') + '</button>';
    } else if (p.k === 'note' || p.note) h += '<label class="hm-note"><span class="muted">' + L('Note', 'Notat') + '</span><textarea rows="3" maxlength="600" data-hmnote="' + esc(p.id) + '" placeholder="' + L('What it is, how it works …', 'Hva det er, hvordan det virker …') + '">' + esc(p.note || '') + '</textarea></label>';
    h += '<div class="hm-pacts"><label class="text-btn"><i class="bi bi-camera"></i> ' + (p.photo ? L('New photo', 'Nytt bilde') : L('Add a photo', 'Legg til bilde')) + '<input type="file" accept="image/*" hidden data-hmphoto="' + esc(p.id) + '"></label>' +
      '<button type="button" class="text-btn" data-hmmove="' + esc(p.id) + '"><i class="bi bi-arrows-move"></i> ' + L('Move', 'Flytt') + '</button>' +
      '<button type="button" class="text-btn" data-hmrename="' + esc(p.id) + '"><i class="bi bi-input-cursor-text"></i> ' + L('Rename', 'Gi nytt navn') + '</button>' +
      '<button type="button" class="text-btn danger" data-hmdelpin="' + esc(p.id) + '"><i class="bi bi-trash3"></i> ' + L('Remove', 'Fjern') + '</button></div>';
    show(h);
    var im = document.querySelector('img[data-hmph="' + p.photo + '"]'); if (im) urlOf(p.photo).then(function (u) { if (u) im.src = u; else im.remove(); });
  }

  /* ---------------- pins: add ---------------- */
  function addPinAt(x, y, k) {
    if (k) return makePin(x, y, k);
    var m = data(), rm = roomAt(x, y, m.rooms);
    show('<div class="hm-shead"><h3>' + L('Add a pin', 'Ny nål') + '</h3><p class="muted">' + (rm ? esc(rm.name) : L('Pick what it is', 'Velg hva det er')) + '</p></div><div class="hm-kinds">' +
      PK.map(function (k) { return '<button type="button" data-hmkind="' + k[0] + '" data-x="' + x + '" data-y="' + y + '" style="--c:' + k[3] + '"><i class="bi bi-' + k[2] + '"></i><span>' + esc(k[1]) + '</span></button>'; }).join('') + '</div>');
    current = { t: 'add' };
  }
  function makePin(x, y, k, extra) {
    var m = data(), kind = pk(k), rm = roomAt(x, y, m.rooms), list = things(m), p = Object.assign({ id: uid(), k: k, x: x, y: y }, extra || {});
    if (k === 'chore' || k === 'up') {
      var opts = list.filter(function (t) { return t.kind === (k === 'chore' ? 'c' : 'u'); });
      if (!extra || !extra.link) {
        show('<div class="hm-shead"><h3>' + esc(kind[1]) + '</h3><p class="muted">' + L('Which one goes here?', 'Hvilken hører hjemme her?') + '</p></div>' +
          (opts.length ? '<ul class="hm-list">' + opts.map(function (t) { return '<li class="hm-li"><span class="hm-li-ic"><i class="bi bi-' + t.icon + '"></i></span><span class="hm-li-t">' + esc(t.name) + '</span><button type="button" class="pill-btn sm" data-hmlink="' + esc(t.key) + '" data-x="' + x + '" data-y="' + y + '" data-k="' + k + '">' + L('Pick', 'Velg') + '</button></li>'; }).join('') + '</ul>'
            : '<p class="muted hm-none">' + (k === 'chore' ? L('Add chores on the Upkeep tab first.', 'Legg inn husarbeid på Vedlikehold-fanen først.') : L('Add upkeep jobs on the Upkeep tab first.', 'Legg inn vedlikehold på Vedlikehold-fanen først.')) + '</p>'));
        return;
      }
    }
    if ((k === 'smoke' || k === 'fire') && !p.link) { var re = k === 'smoke' ? /smoke|røyk/i : /extinguisher|brannslukk|slukke/i, u = list.filter(function (t) { return t.kind === 'u' && re.test(t.name); })[0]; if (u) p.link = u.key; }
    var ik = kind[4];
    if (ik && !p.info) {
      var have = (Fe.tools().hinfo || []).filter(function (x) { return x && x.kind === ik && !(k === 'heater' && !/bereder|heater/i.test((x.title || '') + ' ' + (x.heater || '')) && ik === 'water' && false); });
      var used = data().pins.map(function (q) { return q.info; }), free = have.filter(function (x) { return used.indexOf(x.id) < 0; });
      if (free.length) p.info = free[0].id;
      else {
        var H = window.HomeLife, spec = H && H.INFO && H.INFO[ik], t0 = spec ? (spec.f[0].def || kind[1]) : kind[1], it = { id: uid(), kind: ik, title: t0, where: rm ? rm.name : '' };
        if (k === 'heater') it.title = L('Water heater', 'Varmtvannsbereder');
        var t = Fe.tools(); t.hinfo = (Array.isArray(t.hinfo) ? t.hinfo : []).concat([it]); quiet = true; Fe.saveTools(t); quiet = false; p.info = it.id;
      }
    }
    if (k === 'note' && !p.t) p.t = '';
    save(function (d) { d.pins.push(p); if (p.link && rm && !d.put[p.link]) d.put[p.link] = rm.id; });
    sel = { pin: p.id }; openPin(p.id);
    toast('<i class="bi bi-geo-alt"></i> ' + L('Pinned', 'Festet'), function () { save(function (d) { d.pins = d.pins.filter(function (q) { return q.id !== p.id; }); }); if (wide.matches) overview(data(), things(data())); else closeSheet(); });
    if (k === 'note') setTimeout(function () { renamePin(p.id); }, 50);
  }
  function renamePin(id) {
    var m = data(), p = m.pins.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    show('<div class="hm-shead"><h3>' + L('Name the pin', 'Gi nålen et navn') + '</h3></div><form class="hm-form" data-hmrenameform="' + esc(id) + '"><input name="t" maxlength="60" value="' + esc(p.t || '') + '" placeholder="' + esc(pinTitle(p, things(m))) + '"><button type="submit" class="pill-btn">' + L('Save', 'Lagre') + '</button></form>');
    var i = document.querySelector('[data-hmrenameform] input'); if (i && wide.matches) i.focus();
  }

  /* ---------------- rooms: mark and edit ---------------- */
  var SUG = [L('Living room / kitchen', 'Stue / kjøkken'), L('Living room', 'Stue'), L('Kitchen', 'Kjøkken'), L('Bedroom 1', 'Soverom 1'), L('Bedroom 2', 'Soverom 2'), L('Bathroom', 'Bad'), L('Hallway', 'Gang'), L('Entrance', 'Entré'), L('Balcony', 'Balkong'), L('Office', 'Kontor'), L('Storage', 'Bod'), L('Laundry', 'Vaskerom')];
  function newPart(r) {
    if (arm && arm.t === 'part') { var id = arm.id; arm = null; save(function (d) { d.rooms.forEach(function (x) { if (x.id === id) x.r.push(r); }); }); toast('<i class="bi bi-check2"></i> ' + L('Part added', 'Delen er lagt til')); return; }
    var m = data(), used = m.rooms.map(function (x) { return x.name; });
    show('<div class="hm-shead"><h3>' + L('Which room is this?', 'Hvilket rom er dette?') + '</h3></div><div class="hm-sug">' + SUG.filter(function (s) { return used.indexOf(s) < 0; }).map(function (s) { return '<button type="button" class="hm-chip" data-hmsug="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
      '<form class="hm-form" data-hmroomform data-r="' + esc(JSON.stringify(r.map(function (v) { return Math.round(v * 10000) / 10000; }))) + '"><input name="n" maxlength="40" placeholder="' + L('Room name, as on the drawing', 'Navnet på rommet, som på tegningen') + '" required><input name="a" inputmode="decimal" maxlength="8" placeholder="m²"><button type="submit" class="pill-btn">' + L('Save', 'Lagre') + '</button></form>');
    current = { t: 'form' };
    var i = document.querySelector('[data-hmroomform] input'); if (i && wide.matches) i.focus();
  }
  function roomEdit(id) {
    var m = data(), rm = m.rooms.filter(function (x) { return x.id === id; })[0]; if (!rm) return; sel = { room: id }; markSel(); current = { t: 'form' };
    show('<div class="hm-shead"><h3>' + esc(rm.name) + '</h3><p class="muted">' + rm.r.length + ' ' + L(rm.r.length === 1 ? 'part' : 'parts', rm.r.length === 1 ? 'del' : 'deler') + '</p></div>' +
      '<form class="hm-form" data-hmroomedit="' + esc(id) + '"><input name="n" maxlength="40" value="' + esc(rm.name) + '" required><input name="a" inputmode="decimal" maxlength="8" value="' + esc(rm.area || '') + '" placeholder="m²"><button type="submit" class="pill-btn">' + L('Save', 'Lagre') + '</button></form>' +
      '<div class="hm-pacts"><button type="button" class="text-btn" data-hmpart="' + esc(id) + '"><i class="bi bi-plus-square-dotted"></i> ' + L('Add another part', 'Legg til en del') + '</button>' +
      (rm.r.length > 1 ? '<button type="button" class="text-btn" data-hmpartdel="' + esc(id) + '"><i class="bi bi-dash-square-dotted"></i> ' + L('Remove the last part', 'Fjern den siste delen') + '</button>' : '') +
      '<button type="button" class="text-btn danger" data-hmroomdel="' + esc(id) + '"><i class="bi bi-trash3"></i> ' + L('Remove the room', 'Fjern rommet') + '</button></div>');
  }
  function putSheet(id) {
    var m = data(), list = things(m).filter(function (x) { return x.kind !== 'i' || x.room === id || !x.room || x.guessed; }), rm = m.rooms.filter(function (x) { return x.id === id; })[0]; if (!rm) return;
    var name = function (rid) { var r = m.rooms.filter(function (x) { return x.id === rid; })[0]; return rid === 'all' ? L('whole home', 'hele boligen') : r ? r.name : ''; };
    function grp(t, kind) { var l = list.filter(function (x) { return x.kind === kind; }); return l.length ? '<p class="hm-sec">' + t + '</p><ul class="hm-list">' + l.map(function (x) { return '<li class="hm-li"><label class="hm-pick"><input type="checkbox" data-hmputk="' + esc(x.key) + '"' + (x.room === id ? ' checked' : '') + '><span>' + esc(x.name) + (x.room && x.room !== id ? '<small>' + esc(L('now: ', 'nå: ') + name(x.room)) + (x.guessed ? ' · ' + L('guessed', 'gjettet') : '') + '</small>' : '') + '</span></label></li>'; }).join('') + '</ul>' : ''; }
    show('<div class="hm-shead"><h3>' + L('Put things in ', 'Legg ting i ') + esc(rm.name) + '</h3><p class="muted">' + L('Ticked = here. Untick to take it back out.', 'Huket av = her. Fjern haken for å ta det ut igjen.') + '</p></div>' +
      grp(L('Chores', 'Husarbeid'), 'c') + grp(L('Upkeep', 'Vedlikehold'), 'u') + grp(L('Things from Home inventory', 'Ting fra innbo'), 'i') +
      '<div class="hm-pacts"><button type="button" class="pill-btn" data-hmputsave="' + esc(id) + '">' + L('Save', 'Lagre') + '</button></div>');
    current = { t: 'form' };
  }

  /* ---------------- the drawing: PDF or photo → pick the plan part → keep it ---------------- */
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js'; s.onload = function () { if (!window.pdfjsLib) return rej(); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); }; s.onerror = rej; document.head.appendChild(s); });
  }
  function fileToCanvas(f) {
    var pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
    if (pdf) return loadPdfJs().then(function (lib) { return f.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf }).promise; }); }).then(function (doc) { return doc.getPage(1); }).then(function (page) {
      var v0 = page.getViewport({ scale: 1 }), sc = Math.min(5, 3400 / Math.max(v0.width, v0.height)), vp = page.getViewport({ scale: sc }), c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      return page.render({ canvasContext: g, viewport: vp }).promise.then(function () { return c; });
    });
    return new Promise(function (res, rej) { var img = new Image(); img.onload = function () { var sc = Math.min(1, 3400 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); res(c); }; img.onerror = rej; img.src = URL.createObjectURL(f); });
  }
  /* a first guess at where the plan is: the thick walls (dark areas that survive thinning), then everything drawn around them */
  function guessCrop(c) {
    try {
      var S = 1000 / Math.max(c.width, c.height), w = Math.max(10, Math.round(c.width * S)), h = Math.max(10, Math.round(c.height * S)), t = document.createElement('canvas'); t.width = w; t.height = h;
      var g = t.getContext('2d'); g.drawImage(c, 0, 0, w, h); var d = g.getImageData(0, 0, w, h).data, dark = new Uint8Array(w * h), ink = new Uint8Array(w * h);
      for (var i = 0; i < w * h; i++) { var l = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3; dark[i] = l < 90 ? 1 : 0; ink[i] = l < 235 ? 1 : 0; }
      var cur = dark; for (var k = 0; k < 2; k++) { var nx = new Uint8Array(w * h); for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) { var j = y * w + x; nx[j] = cur[j] && cur[j - 1] && cur[j + 1] && cur[j - w] && cur[j + w] ? 1 : 0; } cur = nx; }
      var x0 = w, y0 = h, x1 = -1, y1 = -1; for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) if (cur[yy * w + xx]) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      if (x1 < 0 || (x1 - x0) < w * .08) return [.05, .05, .9, .9];
      /* grow from the walls through every line that touches them (balcony, doors, kitchen, furniture) – the white
         space around the plan stops it, so the site plan, sections and text further away stay out */
      var di = ink; for (var k2 = 0; k2 < 5; k2++) { var nd = new Uint8Array(w * h); for (var y3 = 1; y3 < h - 1; y3++) for (var x3 = 1; x3 < w - 1; x3++) { var q = y3 * w + x3; nd[q] = di[q] || di[q - 1] || di[q + 1] || di[q - w] || di[q + w] ? 1 : 0; } di = nd; }
      /* the walls: the connected thick-dark shape that encloses the most (a section's solid ground is heavier but flat) – joined over small gaps */
      var wl = new Int32Array(w * h).fill(-1), best = -1, bestN = 0, comps = [];
      for (var q0 = 0; q0 < w * h; q0++) if (cur[q0] && wl[q0] < 0) {
        var id = comps.length, sk = [q0], n0 = 0, bx0 = w, by0 = h, bx1 = 0, by1 = 0; wl[q0] = id;
        while (sk.length) { var qq = sk.pop(), qx0 = qq % w, qy0 = (qq - qx0) / w; n0++; if (qx0 < bx0) bx0 = qx0; if (qx0 > bx1) bx1 = qx0; if (qy0 < by0) by0 = qy0; if (qy0 > by1) by1 = qy0;
          for (var oy = -3; oy <= 3; oy++) for (var ox = -3; ox <= 3; ox++) { var nx2 = qx0 + ox, ny2 = qy0 + oy; if (nx2 < 0 || ny2 < 0 || nx2 >= w || ny2 >= h) continue; var nq = ny2 * w + nx2; if (cur[nq] && wl[nq] < 0) { wl[nq] = id; sk.push(nq); } } }
        comps.push([bx0, by0, bx1, by1]); var ba = (bx1 - bx0 + 1) * (by1 - by0 + 1); if (n0 > 20 && ba > bestN) { bestN = ba; best = id; } }
      if (best < 0) return [.05, .05, .9, .9];
      x0 = comps[best][0]; y0 = comps[best][1]; x1 = comps[best][2]; y1 = comps[best][3];
      var seen = new Uint8Array(w * h), st = [];
      for (var q2 = 0; q2 < w * h; q2++) if (wl[q2] === best) { seen[q2] = 1; st.push(q2); }
      var a = x0, b = y0, cc = x1, dd = y1;
      while (st.length) { var q1 = st.pop(), qx = q1 % w, qy = (q1 - qx) / w; if (qx < a) a = qx; if (qx > cc) cc = qx; if (qy < b) b = qy; if (qy > dd) dd = qy;
        [q1 - 1, q1 + 1, q1 - w, q1 + w].forEach(function (n) { if (n >= 0 && n < w * h && !seen[n] && di[n]) { seen[n] = 1; st.push(n); } }); }
      /* a plan that grew to most of the page has joined the frame or the text – fall back to the walls plus a margin */
      if ((cc - a) > w * .95 || (dd - b) > h * .95) { var pad = Math.round(Math.max(x1 - x0, y1 - y0) * .12); a = Math.max(0, x0 - pad); b = Math.max(0, y0 - pad); cc = Math.min(w, x1 + pad); dd = Math.min(h, y1 + pad); }
      var m = Math.round(Math.max(cc - a, dd - b) * .025) + 2; a = Math.max(0, a - m); b = Math.max(0, b - m); cc = Math.min(w, cc + m); dd = Math.min(h, dd + m);
      return [a / w, b / h, (cc - a) / w, (dd - b) / h];
    } catch (e) { return [.05, .05, .9, .9]; }
  }
  function importFile(f) {
    if (!f) return;
    toast('<i class="bi bi-hourglass-split"></i> ' + L('Reading the drawing …', 'Leser tegningen …'));
    fileToCanvas(f).then(function (c) { cropSheet(c, guessCrop(c)); }, function () { toast('<i class="bi bi-exclamation-triangle"></i> ' + L('Couldn’t read that file. Try a PDF or a photo (JPG, PNG).', 'Kunne ikke lese filen. Prøv en PDF eller et bilde (JPG, PNG).')); });
  }
  function cropSheet(c, r) {
    var bg = document.createElement('div'); bg.className = 'hm-cropbg';
    bg.innerHTML = '<div class="hm-crop" role="dialog" aria-modal="true"><div class="hm-crop-h"><h3><i class="bi bi-crop"></i> ' + L('Choose the floor plan', 'Velg plantegningen') + '</h3><p class="muted">' + L('Drag the corners so only the plan is inside – the address and the rest of the sheet aren’t kept.', 'Dra i hjørnene så bare planen er innenfor – adressen og resten av arket lagres ikke.') + '</p></div>' +
      '<div class="hm-crop-area"><div class="hm-crop-img"><img alt=""><div class="hm-crop-box"><span data-c="nw"></span><span data-c="ne"></span><span data-c="sw"></span><span data-c="se"></span></div></div></div>' +
      '<div class="hm-crop-acts"><button type="button" class="pill-btn ghost" data-crx>' + L('Cancel', 'Avbryt') + '</button><button type="button" class="text-btn" data-crall>' + L('Whole page', 'Hele siden') + '</button><button type="button" class="pill-btn" data-crok><i class="bi bi-check2"></i> ' + L('Use this part', 'Bruk denne delen') + '</button></div></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var img = bg.querySelector('img'), wrap = bg.querySelector('.hm-crop-img'), cb = bg.querySelector('.hm-crop-box'), R = r.slice();
    c.toBlob(function (b) { img.src = URL.createObjectURL(b); }, 'image/jpeg', .85);
    img.onload = function () { var area = bg.querySelector('.hm-crop-area'), aw = area.clientWidth, ah = area.clientHeight, sc = Math.min(aw / c.width, ah / c.height); wrap.style.width = Math.round(c.width * sc) + 'px'; wrap.style.height = Math.round(c.height * sc) + 'px'; place(); };
    function place() { cb.style.left = (R[0] * 100) + '%'; cb.style.top = (R[1] * 100) + '%'; cb.style.width = (R[2] * 100) + '%'; cb.style.height = (R[3] * 100) + '%'; }
    var drag = null;
    wrap.addEventListener('pointerdown', function (e) { var h = e.target.closest('[data-c]'), rr = wrap.getBoundingClientRect(); drag = { c: h ? h.dataset.c : e.target.closest('.hm-crop-box') ? 'move' : null, x: e.clientX, y: e.clientY, r: R.slice(), w: rr.width, h: rr.height }; if (!drag.c) { drag = null; return; } try { wrap.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); });
    wrap.addEventListener('pointermove', function (e) {
      if (!drag) return; var dx = (e.clientX - drag.x) / drag.w, dy = (e.clientY - drag.y) / drag.h, o = drag.r, n = o.slice(), MIN = .05;
      if (drag.c === 'move') { n[0] = Math.min(1 - o[2], Math.max(0, o[0] + dx)); n[1] = Math.min(1 - o[3], Math.max(0, o[1] + dy)); }
      else { var L0 = o[0], T0 = o[1], R0 = o[0] + o[2], B0 = o[1] + o[3];
        if (/w/.test(drag.c)) L0 = Math.min(R0 - MIN, Math.max(0, L0 + dx)); if (/e/.test(drag.c)) R0 = Math.max(L0 + MIN, Math.min(1, R0 + dx));
        if (/n/.test(drag.c)) T0 = Math.min(B0 - MIN, Math.max(0, T0 + dy)); if (/s/.test(drag.c)) B0 = Math.max(T0 + MIN, Math.min(1, B0 + dy));
        n = [L0, T0, R0 - L0, B0 - T0]; }
      R = n; place();
    });
    wrap.addEventListener('pointerup', function () { drag = null; }); wrap.addEventListener('pointercancel', function () { drag = null; });
    function close() { bg.classList.remove('open'); setTimeout(function () { bg.remove(); if (img.src) URL.revokeObjectURL(img.src); }, 200); }
    bg.querySelector('[data-crx]').onclick = close;
    bg.querySelector('[data-crall]').onclick = function () { R = [0, 0, 1, 1]; place(); };
    bg.querySelector('[data-crok]').onclick = function () {
      var sx = Math.round(R[0] * c.width), sy = Math.round(R[1] * c.height), sw = Math.max(20, Math.round(R[2] * c.width)), sh = Math.max(20, Math.round(R[3] * c.height));
      var k = Math.min(1, 2800 / Math.max(sw, sh)), o = document.createElement('canvas'); o.width = Math.round(sw * k); o.height = Math.round(sh * k);
      var g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, sx, sy, sw, sh, 0, 0, o.width, o.height);
      var mono = (function () { try { var d = g.getImageData(0, 0, o.width, o.height).data, n = 0, col = 0; for (var i = 0; i < d.length; i += 4 * 97) { n++; if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) col++; } return col / n < .03; } catch (e) { return false; } })();
      o.toBlob(function (b) {
        var go = function (blob) { keepPlan(blob, o.width, o.height, mono, R.map(function (v) { return Math.round(v * 10000) / 10000; })); close(); };
        if (b && b.size > 2.5e6) o.toBlob(go, 'image/jpeg', .9); else go(b);
      }, 'image/png');
    };
  }
  function keepPlan(blob, w, h, mono, crop) {
    if (!blob) { toast(L('Couldn’t save the drawing', 'Kunne ikke lagre tegningen')); return; }
    var old = data(), fid = 'hm-' + uid(), same = old.plan && Math.abs(old.plan.w / old.plan.h - w / h) < .03;
    putF(fid, blob).then(function () {
      if (old.plan) delF(old.plan.fid);
      save(function (d) { d.plan = { fid: fid, w: w, h: h, mono: mono, crop: crop }; if (!same) { d.rooms = []; d.pins = []; } });
      Z = { s: 1, x: 0, y: 0 }; current = null; sel = null;
      toast('<i class="bi bi-check2"></i> ' + (old.plan && !same ? L('New drawing – mark the rooms again', 'Ny tegning – merk rommene på nytt') : L('Floor plan saved. Now mark the rooms.', 'Plantegningen er lagret. Merk rommene nå.')));
      if (!old.plan || !same) { mode = 'rooms'; draw(); }
    }, function () { toast(L('Couldn’t save the drawing on this device', 'Kunne ikke lagre tegningen på denne enheten')); });
  }

  /* ---------------- taps ---------------- */
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-hmfile]'); if (i && i.files[0]) { var f = i.files[0]; i.value = ''; importFile(f); return; }
    var ph = e.target.closest('[data-hmphoto]');
    if (ph && ph.files[0]) {
      var pid = ph.dataset.hmphoto, file = ph.files[0]; ph.value = '';
      var img = new Image(); img.onload = function () { var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src);
        c.toBlob(function (b) { var fid = 'hmp-' + uid(); putF(fid, b).then(function () { var was = null; save(function (d) { d.pins.forEach(function (p) { if (p.id === pid) { was = p.photo; p.photo = fid; } }); }); if (was) delF(was); openPin(pid); }); }, 'image/jpeg', .85); };
      img.src = URL.createObjectURL(file); return;
    }
  });
  function onClick(e) {
    var b, m;
    if ((b = e.target.closest('[data-hmlay]'))) { LAY[b.dataset.hmlay] = !LAY[b.dataset.hmlay]; try { localStorage.setItem('dash.hmLayers', JSON.stringify(LAY)); } catch (x) {} draw(); return; }
    if ((b = e.target.closest('[data-hmmode]'))) { mode = mode === 'rooms' ? 'view' : 'rooms'; arm = null; sel = null; current = null; if (mode === 'view' && !wide.matches) closeSheet(); draw(); if (mode === 'view' && wide.matches) overview(data(), things(data())); return; }
    if (e.target.closest('[data-hmaddpin]')) { mode = 'view'; arm = { t: 'pin' }; draw(); return; }
    if (e.target.closest('[data-hmcancel]')) { arm = null; draw(); return; }
    if ((b = e.target.closest('[data-hmz]'))) { if (b.dataset.hmz === 'fit') { Z = { s: 1, x: 0, y: 0 }; applyZ(); } else zoomAt(b.dataset.hmz === 'in' ? 1.5 : 1 / 1.5); return; }
    if ((b = e.target.closest('[data-hmpin]'))) { if (arm || mode === 'rooms') return; openPin(b.dataset.hmpin); return; }
    if ((b = e.target.closest('[data-hmopenpin]'))) { openPin(b.dataset.hmopenpin); return; }
    if ((b = e.target.closest('[data-hmkind]'))) { makePin(+b.dataset.x, +b.dataset.y, b.dataset.hmkind); return; }
    if ((b = e.target.closest('[data-hmlink]'))) { makePin(+b.dataset.x, +b.dataset.y, b.dataset.k, { link: b.dataset.hmlink }); return; }
    if ((b = e.target.closest('[data-hmdone]'))) {
      var key = b.dataset.hmdone, id = key.slice(2);
      if (key[0] === 'c') { var c = (Fe.tools().chores || []).filter(function (x) { return x.id === id; })[0]; if (c && window.Chores && window.Chores.setDone) window.Chores.setDone(c); }
      else if (key[0] === 'u' && window.HomeLife && window.HomeLife.hmDone) window.HomeLife.hmDone(id);
      return;
    }
    if ((b = e.target.closest('[data-hminv]'))) { e.preventDefault(); if (wide.matches) { location.hash = 'hinv=' + b.dataset.hminv; } else { closeSheet(); setTimeout(function () { location.hash = 'hinv=' + b.dataset.hminv; }, 230); } var tb = document.querySelector('[data-ptab="things"], [data-tab="things"]'); if (tb) tb.click(); return; }
    if ((b = e.target.closest('[data-hmedinfo]'))) { var it = (Fe.tools().hinfo || []).filter(function (x) { return x.id === b.dataset.hmedinfo; })[0], H = window.HomeLife; if (it && H && H.infoCfg && window.Kit) { if (!wide.matches) closeSheet(); window.Kit.edit(H.infoCfg(it.kind), it); } return; }
    if ((b = e.target.closest('[data-hmshow]'))) { var s = b.previousElementSibling; if (s && s.dataset.hmsec != null) { var hid = s.textContent.charAt(0) === '•'; s.textContent = hid ? s.dataset.hmsec : '••••••••'; b.textContent = hid ? L('Hide', 'Skjul') : L('Show', 'Vis'); } return; }
    if ((b = e.target.closest('[data-hmcopy]'))) { try { navigator.clipboard.writeText(b.dataset.hmcopy).then(function () { toast('<i class="bi bi-clipboard-check"></i> ' + L('Copied', 'Kopiert')); }); } catch (x) {} return; }
    if ((b = e.target.closest('[data-hmmove]'))) { arm = { t: 'move', id: b.dataset.hmmove }; if (!wide.matches) closeSheet(); draw(); return; }
    if ((b = e.target.closest('[data-hmrename]'))) { renamePin(b.dataset.hmrename); return; }
    if ((b = e.target.closest('[data-hmdelpin]'))) {
      var pid = b.dataset.hmdelpin, keep = null; save(function (d) { keep = d.pins.filter(function (p) { return p.id === pid; })[0]; d.pins = d.pins.filter(function (p) { return p.id !== pid; }); });
      current = null; sel = null; if (wide.matches) overview(data(), things(data())); else closeSheet();
      toast('<i class="bi bi-trash3"></i> ' + L('Pin removed', 'Nålen er fjernet'), function () { if (keep) save(function (d) { d.pins.push(keep); }); }); return;
    }
    if ((b = e.target.closest('[data-hmsug]'))) { var f = b.closest('.hm-sbody, [data-hmside]').querySelector('[data-hmroomform] input[name=n]'); if (f) { f.value = b.dataset.hmsug; f.focus(); } return; }
    if ((b = e.target.closest('[data-hmput]'))) { putSheet(b.dataset.hmput); return; }
    if ((b = e.target.closest('[data-hmputsave]'))) {
      var rid = b.dataset.hmputsave, cont = b.closest('.hm-sbody, [data-hmside]'), m0 = data(), list0 = things(m0);
      save(function (d) { cont.querySelectorAll('[data-hmputk]').forEach(function (c) { var k = c.dataset.hmputk, x = list0.filter(function (q) { return q.key === k; })[0]; if (c.checked) d.put[k] = rid; else if (x && x.room === rid) d.put[k] = 'none'; }); });
      openRoom(rid); return;
    }
    if ((b = e.target.closest('[data-hmpart]'))) { var rr = data().rooms.filter(function (x) { return x.id === b.dataset.hmpart; })[0]; if (rr) { arm = { t: 'part', id: rr.id, name: rr.name }; if (!wide.matches) closeSheet(); draw(); } return; }
    if ((b = e.target.closest('[data-hmpartdel]'))) { var pd = b.dataset.hmpartdel; save(function (d) { d.rooms.forEach(function (x) { if (x.id === pd && x.r.length > 1) x.r.pop(); }); }); roomEdit(pd); return; }
    if ((b = e.target.closest('[data-hmroomdel]'))) {
      var rd = b.dataset.hmroomdel, kept = null; save(function (d) { kept = d.rooms.filter(function (x) { return x.id === rd; })[0]; d.rooms = d.rooms.filter(function (x) { return x.id !== rd; }); });
      current = null; sel = null; if (!wide.matches) closeSheet(); else show('');
      toast('<i class="bi bi-trash3"></i> ' + L('Room removed', 'Rommet er fjernet'), function () { if (kept) save(function (d) { d.rooms.push(kept); }); }); return;
    }
  }
  if (box) box.addEventListener('click', onClick);
  document.addEventListener('click', function (e) { if (sheetOpen() && sheetEl.contains(e.target)) onClick(e); });
  document.addEventListener('submit', function (e) {
    var f = e.target, m;
    if (f.matches('[data-hmroomform]')) { e.preventDefault(); var n = f.n.value.trim(); if (!n) return; var r = JSON.parse(f.dataset.r), id = uid(); save(function (d) { d.rooms.push({ id: id, name: n.slice(0, 40), area: f.a.value.trim().slice(0, 8), r: [r] }); }); sel = null; current = null; if (wide.matches) show('<div class="hm-shead"><h3>' + esc(n) + '</h3><p class="muted">' + L('Marked. Drag over the next room.', 'Merket. Dra over det neste rommet.') + '</p></div>'); else closeSheet(); return; }
    if (f.matches('[data-hmroomedit]')) { e.preventDefault(); var rid = f.dataset.hmroomedit, nn = f.n.value.trim(); if (!nn) return; save(function (d) { d.rooms.forEach(function (x) { if (x.id === rid) { x.name = nn.slice(0, 40); x.area = f.a.value.trim().slice(0, 8); } }); }); toast('<i class="bi bi-check2"></i> ' + L('Saved', 'Lagret')); if (!wide.matches) closeSheet(); else roomEdit(rid); return; }
    if (f.matches('[data-hmrenameform]')) { e.preventDefault(); var pid = f.dataset.hmrenameform, t = f.t.value.trim(); save(function (d) { d.pins.forEach(function (p) { if (p.id === pid) { if (t) p.t = t.slice(0, 60); else delete p.t; } }); }); openPin(pid); return; }
  });
  document.addEventListener('input', function (e) { var t = e.target.closest('[data-hmnote]'); if (!t) return; clearTimeout(t._t); t._t = setTimeout(function () { var id = t.dataset.hmnote, v = t.value.slice(0, 600); var tt = Fe.tools(), mm = norm(tt.hmap); mm.pins.forEach(function (p) { if (p.id === id) p.note = v; }); tt.hmap = mm; quiet = true; Fe.saveTools(tt); quiet = false; }, 500); });

  /* ---------------- keep it current ---------------- */
  var dt = null;
  function soonDraw() { clearTimeout(dt); dt = setTimeout(draw, 40); }
  ['tools:change', 'features:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () { if (!quiet) soonDraw(); }); });
  window.addEventListener('resize', function () { clearTimeout(dt); dt = setTimeout(function () { if (wide.matches && sheetOpen()) closeSheet(); applyZ(); draw(); }, 120); });
  window.Vault.onUnlock(function () { setTimeout(draw, 0); var m = data(); if (m.plan && window.FileSync) setTimeout(function () { var ids = [m.plan.fid].concat(m.pins.map(function (p) { return p.photo; }).filter(Boolean)); window.FileSync.sync({ ids: ids, getLocal: localF, putLocal: keepF, download: false }); }, 1500); });
  if (document.documentElement.classList.contains('unlocked')) setTimeout(draw, 0);

  /* ---------------- Settings → Pages → House → Home map ---------------- */
  function setFill() {
    var el = document.getElementById('hlSet-house3'); if (!el || el.contains(document.activeElement)) return;
    if (!Fe.on('house')) { el.innerHTML = ''; return; }
    var m = data(), S = window.ShareSpace, shared = !!(S && S.active && S.active());
    var h = '<p class="st-sub ap-sub"><i class="bi bi-map"></i> ' + L('Home map', 'Boligkart') + '</p><div class="st-group">' +
      '<label class="st-row"><span>' + L('Show the Map tab', 'Vis Kart-fanen') + '<small class="st-rsub">' + L('Your floor plan with rooms, chores, upkeep and pins', 'Plantegningen med rom, husarbeid, vedlikehold og nåler') + '</small></span><input type="checkbox" class="switch" data-hmset="on"' + (Fe.on('hmap') ? ' checked' : '') + '></label>';
    if (Fe.on('hmap')) {
      h += '<label class="st-row"><span>' + L('Dark mode', 'Mørk modus') + '<small class="st-rsub">' + L('A black-and-white drawing can turn dark with the rest', 'En svart-hvit tegning kan bli mørk med resten') + '</small></span><select class="st-input" data-hmset="dark"><option value="match"' + (m.dark === 'match' ? ' selected' : '') + '>' + L('Turn dark', 'Bli mørk') + '</option><option value="paper"' + (m.dark === 'paper' ? ' selected' : '') + '>' + L('Keep it white', 'Behold hvit') + '</option></select></label>' +
        '<label class="st-row"><span>' + L('Show to ', 'Vis til ') + esc(partnerName()) + '<small class="st-rsub">' + (shared ? L('In their Home app: the plan, rooms, pins and the chores – they can tick their chores there', 'I Hjem-appen deres: planen, rommene, nålene og husarbeidet – de kan krysse av husarbeidet sitt der') : L('Set up Shared space first (Settings → Shared space)', 'Sett opp delt område først (Innstillinger → Delt område)')) + '</small></span><input type="checkbox" class="switch" data-hmset="share"' + (m.share ? ' checked' : '') + (shared ? '' : ' disabled') + '></label>' +
        (m.share ? '<label class="st-row"><span>' + L('Share passwords and codes too', 'Del passord og koder også') + '<small class="st-rsub">' + L('Off: they see where the router and keys are, not the Wi-Fi password or door codes', 'Av: de ser hvor ruteren og nøklene er, ikke Wi-Fi-passordet eller dørkodene') + '</small></span><input type="checkbox" class="switch" data-hmset="shareInfo"' + (m.shareInfo ? ' checked' : '') + '></label>' : '') +
        (m.plan ? '<label class="st-row st-btn"><span><i class="bi bi-arrow-repeat"></i> ' + L('Replace the drawing', 'Bytt tegning') + '<small class="st-rsub">' + L('Rooms and pins stay if the new one has the same shape', 'Rom og nåler blir hvis den nye har samme form') + '</small></span><input type="file" accept="application/pdf,.pdf,image/*" hidden data-hmfile></label>' +
          '<button type="button" class="st-row st-btn" data-hmwipe><span class="danger-txt"><i class="bi bi-trash3"></i> ' + L('Remove the map', 'Fjern kartet') + '<small class="st-rsub">' + L('The drawing, rooms and pins – your chores, upkeep and Good to know stay', 'Tegningen, rommene og nålene – husarbeid, vedlikehold og Greit å vite blir') + '</small></span></button>' : '');
    }
    el.innerHTML = h + '</div>';
  }
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-hmset]'); if (!i) return; var k = i.dataset.hmset;
    if (k === 'on') { Fe.set('hmap', i.checked); setTimeout(setFill, 50); return; }
    var v = i.type === 'checkbox' ? i.checked : i.value; save(function (d) { d[k] = v; }); setFill(); toast('<i class="bi bi-check2"></i> ' + L('Saved', 'Lagret'));
    if (k === 'share' && window.ShareSpace && window.ShareSpace.sync) window.ShareSpace.sync();
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-hmwipe]')) return;
    var b = e.target.closest('[data-hmwipe]'); if (!b.classList.contains('armed')) { b.classList.add('armed'); b.querySelector('span').firstChild.nodeValue = ' '; b.querySelector('span').insertAdjacentHTML('afterbegin', '<b>' + L('Tap again to remove it', 'Trykk igjen for å fjerne') + '</b> '); setTimeout(setFill, 3500); return; }
    var m = data(); if (m.plan) delF(m.plan.fid); m.pins.forEach(function (p) { if (p.photo) delF(p.photo); });
    save(function (d) { d.plan = null; d.rooms = []; d.pins = []; d.put = {}; }); setFill(); toast('<i class="bi bi-check2"></i> ' + L('The map is removed', 'Kartet er fjernet'));
  });
  window.addEventListener('st:page', function (e) { if (e.detail === 'house') setTimeout(setFill, 0); });
  window.addEventListener('features:change', function () { setTimeout(setFill, 0); });

  /* for share.js (Show to …) and search */
  window.HomeMap = { data: data, things: things, pk: pk, getFile: getF, roomAt: roomAt };
})();
