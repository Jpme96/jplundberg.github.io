/* Chores (House → Upkeep), Nov 2026: bins, bathroom, vacuuming … taking turns with the person you live with
   (who that is: Settings → Finances → Shared expenses, the partner – nobody is hard-coded). Each chore has a day
   and how often; whose turn it is changes by itself each time. Tick it off when it's done; At a glance tells you
   on the day when it's your turn.
   Data: dash.tools.chores [{id, name, every: 1w|2w|1m, day: 0–6 (Mon–Sun), who: rotate|me|them, start, room?}],
         dash.tools.rooms [{id, name, icon, size}] (rooms of the home – shared with the person you live with),
         dash.tools.choreDone { '<period>|<id>': 'me'|'them' }, dash.tools.chorecfg (Settings → House). */
/* The page part of chores.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is chores.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["chores"]; if (!__c) return;
  var logOf = __c.logOf, Fe = __c.Fe, today = __c.today, partner = __c.partner, isKey = __c.isKey, period = __c.period, done = __c.done, esc = __c.esc, fromKey = __c.fromKey, whoName = __c.whoName, turn = __c.turn, icon = __c.icon, setDone = __c.setDone, on = __c.on, toast = __c.toast, USUAL = __c.USUAL;
  var K = window.Kit || null;
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function chip(t, c) { return '<span class="hl-chip" style="--c:' + c + '">' + t + '</span>'; }
  var DAYS = [[0, I18N.k('ui.monday', 'Monday')], [1, I18N.k('ui.tuesday', 'Tuesday')], [2, I18N.k('ui.wednesday', 'Wednesday')], [3, I18N.k('ui.thursday', 'Thursday')], [4, I18N.k('ui.friday', 'Friday')], [5, I18N.k('ui.saturday', 'Saturday')], [6, I18N.k('ui.sunday', 'Sunday')]];
  var EVERY = [['1w', I18N.k('ui.every-week', 'Every week')], ['2w', I18N.k('ui.every-2-weeks', 'Every 2 weeks')], ['1m', I18N.k('ui.once-a-month', 'Once a month')]];
  function lastOf(cid) { return logOf().filter(function (x) { return x.cid === cid; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; })[0] || null; }
  function nb() { return !!(window.I18N && window.I18N.lang === 'nb'); }
  function rooms() { return Fe.list('rooms'); }
  function roomOf(c) { return c && c.room ? rooms().filter(function (r) { return r.id === c.room; })[0] || null : null; }
  var ROOM_ICONS = [['door-open', /entr|inng|hall door/i], ['tv', /living|stue|kitchen|kjøkken/i], ['moon', /bed|sov/i], ['droplet', /bath|bad|wc|toil/i], ['signpost', /hall|gang/i], ['flower1', /balc|balk|terr|garden|hage/i], ['basket', /laundry|vask/i], ['box-seam', /stor|bod/i], ['briefcase', /office|kontor/i]];
  function roomIcon(n) { var m = ROOM_ICONS.filter(function (x) { return x[1].test(n || ''); })[0]; return m ? m[0] : 'house'; }
  var USUAL_ROOMS = function () { return nb() ? ['Entré', 'Stue/kjøkken', 'Soverom 1', 'Soverom 2', 'Bad', 'Gang', 'Balkong'] : ['Entrance', 'Living room & kitchen', 'Bedroom 1', 'Bedroom 2', 'Bathroom', 'Hallway', 'Balcony']; };
  var view = 'day';
  var inRoom = '';
  var editRooms = false;
  try { var vs = JSON.parse(localStorage.getItem('dash.chview') || '{}'); view = vs.v === 'room' ? 'room' : 'day'; inRoom = vs.r || ''; } catch (e) {}
  function keepView() { try { localStorage.setItem('dash.chview', JSON.stringify({ v: view, r: inRoom })); } catch (e) {} }
  var showLog = false;
  function fair(l) { var ym = today().slice(0, 7), me = 0, them = 0; logOf().forEach(function (x) { if (x.at.slice(0, 7) !== ym) return; if (x.who === 'me') me++; else them++; }); return { me: me, them: them }; }
  var col = K && $t('hchores') ? K.collection({
    mount: $t('hchores'), feature: 'house', key: 'chores', icon: 'arrow-repeat', title: 'Chores', addLabel: 'Add', limit: 8,
    addTitle: 'New chore', editTitle: 'Edit chore', fields: [
      { k: 'name', type: 'title', label: 'Chore', ph: 'e.g. Take out the bins, clean the bathroom', req: true },
      { k: 'every', label: 'How often', type: 'select', options: EVERY, def: '1w' },
      { k: 'day', label: 'On', type: 'select', options: DAYS, def: 5 },
      { k: 'who', label: 'Who', type: 'select', options: function () { var p = partner(); return [['rotate', p ? 'Take turns with ' + p.name : 'Take turns'], ['me', I18N.k('ui.always-me', 'Always me')], ['them', p ? 'Always ' + p.name : 'Always the other one']]; }, def: 'rotate' },
      { k: 'room', label: 'Room', type: 'select', options: function () { return [['', 'No room']].concat(rooms().map(function (r) { return [r.id, r.name]; })); }, def: function () { return inRoom || ''; }, when: function () { return rooms().length > 0; } }],
    beforeSave: function (it, isNew) { if (isNew || !isKey(it.start)) it.start = today(); it.day = +it.day || 0; if (!it.room) delete it.room; },
    filter: function (c) { return !inRoom || c.room === inRoom; },
    headExtra: function () { return '<a class="text-btn" href="/cmd/?settings=house" aria-label="Settings" data-t-aria-label="ui.settings"><i class="bi bi-sliders"></i></a>'; },
    above: function (l) {
      var rl = rooms(), all = Fe.list('chores');
      if (!all.length) return '<button type="button" class="pill-btn hl-seed" data-chseed><i class="bi bi-magic"></i> <span data-t="ui.pick-from-the-usual-ones">Pick from the usual ones</span></button>';
      /* rooms: By day / By room, one room at a time, and the rooms themselves */
      var dueIn = function (rid) { return all.filter(function (c) { var p = period(c); return (rid === '' ? true : c.room === rid) && !done(c, p) && p.day <= today(); }).length; };
      var bar = '<div class="ch-bar">' + (rl.length ? '<div class="seg ch-seg" role="group"><button type="button" data-chview="day" aria-pressed="' + (view === 'day') + '">By day</button><button type="button" data-chview="room" aria-pressed="' + (view === 'room') + '">By room</button></div>' +
        '<div class="ch-rooms"><button type="button" class="ch-room' + (inRoom ? '' : ' on') + '" data-chroom="">All rooms</button>' + rl.map(function (r) { var n = dueIn(r.id); return '<button type="button" class="ch-room' + (inRoom === r.id ? ' on' : '') + '" data-chroom="' + esc(r.id) + '"><i class="bi bi-' + esc(r.icon || roomIcon(r.name)) + '"></i> ' + esc(r.name) + (n ? ' <b>' + n + '</b>' : '') + '</button>'; }).join('') + '</div>' : '') +
        '<button type="button" class="text-btn ch-roomsbtn" data-chrooms aria-expanded="' + editRooms + '"><i class="bi bi-door-open"></i> ' + (rl.length ? 'Rooms' : 'Add rooms') + '</button></div>';
      if (editRooms) bar += '<div class="ch-redit">' + (rl.length ? '<ul>' + rl.map(function (r) { return '<li><i class="bi bi-' + esc(r.icon || roomIcon(r.name)) + '"></i><input data-chrname="' + esc(r.id) + '" value="' + esc(r.name) + '" maxlength="40" aria-label="Room name"><input data-chrsize="' + esc(r.id) + '" value="' + esc(r.size || '') + '" maxlength="10" placeholder="m²" inputmode="decimal" aria-label="Size in m²"><button type="button" class="icon-btn sm" data-chrdel="' + esc(r.id) + '" aria-label="Remove ' + esc(r.name) + '"><i class="bi bi-x"></i></button></li>'; }).join('') + '</ul>' : '<button type="button" class="pill-btn" data-chrseed><i class="bi bi-magic"></i> Add the usual rooms</button>') +
        '<form class="add-row ch-radd" data-chradd><input name="n" placeholder="New room, e.g. Storage" maxlength="40" autocomplete="off"><button class="pill-btn" type="submit" aria-label="Add room"><i class="bi bi-plus-lg"></i></button></form>' +
        '<p class="muted ch-rnote">Shared with the person you live with, so you both see the same rooms.</p></div>';
      if (inRoom) { var rm = rl.filter(function (r) { return r.id === inRoom; })[0], left = dueIn(inRoom); if (rm) { var ym = today().slice(0, 7), me = 0, th = 0; logOf().forEach(function (x) { var ch = all.filter(function (c) { return c.id === x.cid; })[0]; if (!ch || ch.room !== inRoom || String(x.at).slice(0, 7) !== ym) return; if (x.who === 'me') me++; else th++; }); var pn = partner();
        bar += '<p class="ch-inroom"><i class="bi bi-' + esc(rm.icon || roomIcon(rm.name)) + '"></i> <b>' + esc(rm.name) + '</b> – ' + (left ? left + ' to do now' : l.length ? 'all done for now' : 'no chores here yet') + (me + th ? '<small class="muted"> · this month: you ' + me + (pn ? ' · ' + esc(pn.name) + ' ' + th : '') + '</small>' : '') + '</p>'; } }
      if (!showLog) return bar;
      var lg = logOf().slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 40);
      return bar + '<ul class="ch-log">' + lg.map(function (x) { return '<li><span>' + esc(x.name) + '</span><small>' + esc(fromKey(x.at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + (x.who === 'me' ? 'You' : whoName('them'))) + '</small></li>'; }).join('') + '</ul>';
    },
    empty: 'Bins, bathroom, vacuuming – with whose turn it is this week, changing by itself. Tick them off as you go.',
    summary: function (l) {
      if (!l.length) return '';
      var mine = 0, theirs = 0, open = 0; l.forEach(function (c) { var p = period(c); if (!done(c, p)) { open++; if (turn(c, p) === 'me') mine++; else theirs++; } });
      var pn = partner(), fr = fair();
      return '<span>' + (open ? open + ' left this time' + (pn ? ' · you ' + mine + ', ' + esc(pn.name) + ' ' + theirs : '') : 'All done this time') + '</span>' +
        (fr.me + fr.them ? '<span class="ch-fair">' + esc('This month: you ' + fr.me + (pn ? ' · ' + pn.name + ' ' + fr.them : '')) + '</span>' : '') +
        (logOf().length ? '<button type="button" class="text-btn ch-logbtn" data-chlog aria-expanded="' + showLog + '"><i class="bi bi-clock-history"></i> ' + (showLog ? 'Hide history' : 'History') + '</button>' : '');
    },
    sort: function (a, b) {
      if (view === 'room' && !inRoom) { var ri = function (c) { var i = rooms().findIndex(function (r) { return r.id === c.room; }); return i < 0 ? 999 : i; }, d = ri(a) - ri(b); if (d) return d; }
      return period(a).day < period(b).day ? -1 : 1; },
    row: function (c) {
      var p = period(c), w = turn(c, p), dn = done(c, p), n = Math.round((fromKey(p.day) - fromKey(today())) / 864e5);
      var when = n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? (dn ? '' : (-n) + (n === -1 ? ' day late' : ' days late')) : fromKey(p.day).toLocaleDateString('en-GB', { weekday: 'long' });
      var rm = roomOf(c);
      return { icon: icon(c.name), color: w === 'me' ? '#22b35e' : '#3987e5', title: c.name, cls: dn ? 'is-done' : '',
        sub: esc([rm && !inRoom ? rm.name : '', whoName(w) === 'You' ? 'Your turn' : whoName(w) + '’s turn', (EVERY.filter(function (x) { return x[0] === c.every; })[0] || EVERY[0])[1].toLowerCase(), when, (function () { var ls = lastOf(c.id); return ls ? 'last ' + fromKey(ls.at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' by ' + (ls.who === 'me' ? 'you' : whoName('them')) : ''; })()].filter(Boolean).join(' · ')),
        right: '<span role="button" tabindex="0" class="ch-pen" data-kit-edit="' + esc(c.id) + '" aria-label="' + esc('Edit or delete ' + c.name) + '"><i class="bi bi-pencil"></i></span><span role="button" tabindex="0" class="check ch-check" data-chdone="' + esc(c.id) + '" aria-pressed="' + !!dn + '" aria-label="' + esc(c.name) + (dn ? ' – done' : ' – mark as done') + '"><i class="bi bi-check-lg"></i></span>' };   /* a span: it sits inside the row's button */
    }
  }) : null;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-chdone]');
    if (b) { e.preventDefault(); e.stopPropagation(); var c = Fe.list('chores').filter(function (x) { return x.id === b.dataset.chdone; })[0]; if (c) setDone(c); return; }
    if (e.target.closest('[data-chlog]')) { e.preventDefault(); e.stopPropagation(); showLog = !showLog; if (col) col.render(); return; }
    var rb;
    if ((rb = e.target.closest('[data-chview]'))) { e.preventDefault(); e.stopPropagation(); view = rb.dataset.chview; keepView(); if (col) col.render(); return; }
    if ((rb = e.target.closest('[data-chroom]'))) { e.preventDefault(); e.stopPropagation(); inRoom = inRoom === rb.dataset.chroom ? '' : rb.dataset.chroom; keepView(); if (col) col.render(); requestAnimationFrame(function () { var on = document.querySelector('.ch-room.on'); if (on && on.parentElement) on.parentElement.scrollLeft = Math.max(0, on.offsetLeft - 40); }); return; }
    if (e.target.closest('[data-chrooms]')) { e.preventDefault(); e.stopPropagation(); editRooms = !editRooms; if (col) col.render(); return; }
    if (e.target.closest('[data-chrseed]')) { e.preventDefault(); e.stopPropagation(); var t1 = Fe.tools(); t1.rooms = USUAL_ROOMS().map(function (n, i) { return { id: 'r' + Date.now().toString(36) + i, name: n, icon: roomIcon(n), size: '' }; }); Fe.saveTools(t1); toast('<i class="bi bi-door-open"></i> Rooms added – rename or remove any'); return; }
    if ((rb = e.target.closest('[data-chrdel]'))) { e.preventDefault(); e.stopPropagation(); var t2 = Fe.tools(), id = rb.dataset.chrdel, was = JSON.parse(JSON.stringify(t2.rooms || [])), wasC = JSON.parse(JSON.stringify(t2.chores || []));
      t2.rooms = (t2.rooms || []).filter(function (r) { return r.id !== id; }); (t2.chores || []).forEach(function (c) { if (c.room === id) delete c.room; }); if (inRoom === id) { inRoom = ''; keepView(); } Fe.saveTools(t2);
      toast('<i class="bi bi-trash3"></i> Room removed – its chores stay', function () { var t3 = Fe.tools(); t3.rooms = was; t3.chores = wasC; Fe.saveTools(t3); }); return; }

    if (e.target.closest('[data-chseed]')) {
      var t = Fe.tools(), k = today();
      t.chores = USUAL.slice(0, 5).map(function (u, i) { return { id: Date.now().toString(36) + i, name: u[0], every: u[1], day: u[2], who: 'rotate', start: k }; });
      Fe.saveTools(t); toast('<i class="bi bi-magic"></i> 5 usual chores added – change or remove any');
    }
  }, true);
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-chrname], [data-chrsize]'); if (!i) return;
    var t = Fe.tools(), id = i.dataset.chrname || i.dataset.chrsize;
    (t.rooms || []).forEach(function (r) { if (r.id !== id) return; if (i.dataset.chrname) { var n = i.value.trim(); if (n) { r.name = n; r.icon = roomIcon(n); } } else r.size = i.value.trim().replace(/[^\d.,]/g, '').slice(0, 6); });
    Fe.saveTools(t);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-chradd]'); if (!f) return; e.preventDefault();
    var n = f.n.value.trim(); if (!n) return; var t = Fe.tools(); t.rooms = (Array.isArray(t.rooms) ? t.rooms : []).concat([{ id: 'r' + Date.now().toString(36), name: n.slice(0, 40), icon: roomIcon(n), size: '' }]); Fe.saveTools(t);
  });
  if (col) window.addEventListener('shared:change', function () { col.render(); });
  Object.assign(window.Chores, { rooms: rooms, roomOf: roomOf, roomIcon: roomIcon });
})();
