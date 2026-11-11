/* Chores (House → Upkeep), Nov 2026: bins, bathroom, vacuuming … taking turns with the person you live with
   (who that is: Settings → Finances → Shared expenses, the partner – nobody is hard-coded). Each chore has a day
   and how often; whose turn it is changes by itself each time. Tick it off when it's done; At a glance tells you
   on the day when it's your turn.
   Data: dash.tools.chores [{id, name, every: 1w|2w|1m, day: 0–6 (Mon–Sun), who: rotate|me|them, start, room?}],
         dash.tools.rooms [{id, name, icon, size}] (rooms of the home – shared with the person you live with),
         dash.tools.choreDone { '<period>|<id>': 'me'|'them' }, dash.tools.chorecfg (Settings → House). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, K = window.Kit || null;
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var dkey = Fe.dkey, fromKey = Fe.fromKey;
  function today() { return dkey(new Date()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function monday(k) { var d = fromKey(k); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dkey(d); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function chip(t, c) { return '<span class="hl-chip" style="--c:' + c + '">' + t + '</span>'; }
  function on() { return Fe.on('house'); }
  function cfg() { var c = Fe.tools().chorecfg; return Object.assign({ brief: true, both: false }, c && typeof c === 'object' ? c : {}); }
  function partner() { var S = window.Shared; var p = S && S.partner ? S.partner() : null; return p && p.name ? p : null; }
  var DAYS = [[0, 'Monday'], [1, 'Tuesday'], [2, 'Wednesday'], [3, 'Thursday'], [4, 'Friday'], [5, 'Saturday'], [6, 'Sunday']];
  var EVERY = [['1w', 'Every week'], ['2w', 'Every 2 weeks'], ['1m', 'Once a month']];
  var USUAL = [['Take out the bins', '1w', 6, 'trash'], ['Clean the bathroom', '1w', 5, 'droplet'], ['Vacuum and mop', '1w', 5, 'stars'], ['Change the bed sheets', '2w', 6, 'moon'], ['Clean the kitchen properly', '2w', 4, 'cup-hot'], ['Water the plants', '1w', 2, 'flower1'], ['Clean the fridge', '1m', 6, 'snow2']];
  function icon(n) { var u = USUAL.filter(function (x) { return x[0] === n; })[0]; return u ? u[3] : /bin|søppel|trash/i.test(n) ? 'trash' : /bath|bad|toalett/i.test(n) ? 'droplet' : /vacuum|støvsug|mop/i.test(n) ? 'stars' : /laundry|vask|klær/i.test(n) ? 'basket' : 'check2-square'; }

  /* this time: the period it belongs to, the day it's on, and whose turn */
  function period(c, k) {
    k = k || today(); var st = isKey(c.start) ? c.start : k;
    if (c.every === '1m') {
      var d = fromKey(k), first = new Date(d.getFullYear(), d.getMonth(), 1); first.setDate(1 + ((+c.day || 0) - (first.getDay() + 6) % 7 + 7) % 7);
      var n = (d.getFullYear() - fromKey(st).getFullYear()) * 12 + d.getMonth() - fromKey(st).getMonth();
      if (dkey(first) < st && n === 0) { var nx = new Date(d.getFullYear(), d.getMonth() + 1, 1); nx.setDate(1 + ((+c.day || 0) - (nx.getDay() + 6) % 7 + 7) % 7); return { key: dkey(nx).slice(0, 7), day: dkey(nx), n: 1 }; }
      return { key: k.slice(0, 7), day: dkey(first), n: n };
    }
    var w = Math.round((fromKey(monday(k)) - fromKey(monday(st))) / 6048e5), step = c.every === '2w' ? 2 : 1;
    var wn = Math.floor(w / step) * step, mon = fromKey(monday(st)); mon.setDate(mon.getDate() + wn * 7);
    var day = new Date(mon); day.setDate(mon.getDate() + (+c.day || 0));
    /* added after this time's day: the first time is the next one */
    if (dkey(day) < st) { mon.setDate(mon.getDate() + step * 7); day.setDate(day.getDate() + step * 7); return { key: dkey(mon), day: dkey(day), n: Math.floor(w / step) + 1 }; }
    return { key: dkey(mon), day: dkey(day), n: Math.floor(w / step) };
  }
  function turn(c, p) { if (c.who === 'me' || !partner()) return 'me'; if (c.who === 'them') return 'them'; return ((p.n % 2) + 2) % 2 === 0 ? 'me' : 'them'; }
  function done(c, p) { return (Fe.tools().choreDone || {})[p.key + '|' + c.id] || null; }
  function whoName(w) { var p = partner(); return w === 'me' ? 'You' : p ? p.name : 'Them'; }
  /* the log: every time a chore is ticked off – which, who and the day (dash.tools.choreLog, last 12 months) */
  function logOf() { var l = Fe.tools().choreLog; return Array.isArray(l) ? l : []; }
  function lastOf(cid) { return logOf().filter(function (x) { return x.cid === cid; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; })[0] || null; }
  function addLog(t, c, k, who, at) {
    var l = Array.isArray(t.choreLog) ? t.choreLog : (t.choreLog = []);
    if (l.some(function (x) { return x.k === k; })) return;
    l.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), k: k, cid: c.id, name: c.name, who: who, at: at || today() });
    var cut = dkey(new Date(Date.now() - 366 * 864e5)); t.choreLog = l.filter(function (x) { return x.at >= cut; }).slice(-600);
  }
  function setDone(c, who) {
    var p = period(c), t = Fe.tools(), m = t.choreDone = Object.assign({}, t.choreDone || {}), k = p.key + '|' + c.id, was = m[k];
    if (was) { delete m[k]; t.choreLog = logOf().filter(function (x) { return x.k !== k; }); } else { m[k] = who || turn(c, p); addLog(t, c, k, m[k]); }
    Object.keys(m).forEach(function (x) { if (x.slice(0, 10) < dkey(new Date(Date.now() - 120 * 864e5))) delete m[x]; });
    Fe.saveTools(t);
    if (!was) toast('<i class="bi bi-check2"></i> ' + esc(c.name) + ' done', function () { var t2 = Fe.tools(); delete (t2.choreDone || {})[k]; Fe.saveTools(t2); });
  }
  /* rooms: chores can belong to one; the list can show by room and only one room ("clean one room") */
  function nb() { return !!(window.I18N && window.I18N.lang === 'nb'); }
  function rooms() { return Fe.list('rooms'); }
  function roomOf(c) { return c && c.room ? rooms().filter(function (r) { return r.id === c.room; })[0] || null : null; }
  var ROOM_ICONS = [['door-open', /entr|inng|hall door/i], ['tv', /living|stue|kitchen|kjøkken/i], ['moon', /bed|sov/i], ['droplet', /bath|bad|wc|toil/i], ['signpost', /hall|gang/i], ['flower1', /balc|balk|terr|garden|hage/i], ['basket', /laundry|vask/i], ['box-seam', /stor|bod/i], ['briefcase', /office|kontor/i]];
  function roomIcon(n) { var m = ROOM_ICONS.filter(function (x) { return x[1].test(n || ''); })[0]; return m ? m[0] : 'house'; }
  var USUAL_ROOMS = function () { return nb() ? ['Entré', 'Stue/kjøkken', 'Soverom 1', 'Soverom 2', 'Bad', 'Gang', 'Balkong'] : ['Entrance', 'Living room & kitchen', 'Bedroom 1', 'Bedroom 2', 'Bathroom', 'Hallway', 'Balcony']; };
  var view = 'day', inRoom = '', editRooms = false;
  try { var vs = JSON.parse(localStorage.getItem('dash.chview') || '{}'); view = vs.v === 'room' ? 'room' : 'day'; inRoom = vs.r || ''; } catch (e) {}
  function keepView() { try { localStorage.setItem('dash.chview', JSON.stringify({ v: view, r: inRoom })); } catch (e) {} }
  window.Chores = { period: period, turn: turn, done: done, addLog: addLog, log: logOf, setDone: setDone, whoName: whoName, icon: icon, rooms: rooms, roomOf: roomOf, roomIcon: roomIcon };
  var showLog = false;
  function fair(l) { var ym = today().slice(0, 7), me = 0, them = 0; logOf().forEach(function (x) { if (x.at.slice(0, 7) !== ym) return; if (x.who === 'me') me++; else them++; }); return { me: me, them: them }; }

  var col = K && $t('hchores') ? K.collection({
    mount: $t('hchores'), feature: 'house', key: 'chores', icon: 'arrow-repeat', title: 'Chores', addLabel: 'Add', limit: 8,
    addTitle: 'New chore', editTitle: 'Edit chore', fields: [
      { k: 'name', type: 'title', label: 'Chore', ph: 'e.g. Take out the bins, clean the bathroom', req: true },
      { k: 'every', label: 'How often', type: 'select', options: EVERY, def: '1w' },
      { k: 'day', label: 'On', type: 'select', options: DAYS, def: 5 },
      { k: 'who', label: 'Who', type: 'select', options: function () { var p = partner(); return [['rotate', p ? 'Take turns with ' + p.name : 'Take turns'], ['me', 'Always me'], ['them', p ? 'Always ' + p.name : 'Always the other one']]; }, def: 'rotate' },
      { k: 'room', label: 'Room', type: 'select', options: function () { return [['', 'No room']].concat(rooms().map(function (r) { return [r.id, r.name]; })); }, def: function () { return inRoom || ''; }, when: function () { return rooms().length > 0; } }],
    beforeSave: function (it, isNew) { if (isNew || !isKey(it.start)) it.start = today(); it.day = +it.day || 0; if (!it.room) delete it.room; },
    filter: function (c) { return !inRoom || c.room === inRoom; },
    headExtra: function () { return '<a class="text-btn" href="/cmd/?settings=house" aria-label="Settings" data-t-aria-label="ui.settings"><i class="bi bi-sliders"></i></a>'; },
    above: function (l) {
      var rl = rooms(), all = Fe.list('chores');
      if (!all.length) return '<button type="button" class="pill-btn hl-seed" data-chseed><i class="bi bi-magic"></i> Pick from the usual ones</button>';
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

  /* At a glance: your turn today (or late) */
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!on() || !cfg().brief) return;
    var tk = today();
    Fe.list('chores').forEach(function (c) {
      var p = period(c), w = turn(c, p); if (done(c, p) || (w !== 'me' && !cfg().both) || p.day > tk) return;
      var late = p.day < tk;
      add(late ? 36 : 48, icon(c.name), w === 'me' ? '#22b35e' : '#3987e5', (w === 'me' ? 'Your turn: ' : whoName(w) + '’s turn: ') + c.name, late ? 'From ' + fromKey(p.day).toLocaleDateString('en-GB', { weekday: 'long' }) : 'Today', '/cmd/house/#hchores',
        { main: true, act: { id: 'ch:' + p.key + ':' + c.id, label: 'Done' }, run: function () { setDone(c, w); } });
    });
  });

  /* Settings → House */
  function setFill() {
    var box = document.getElementById('hlSet-house3'); if (!box || box.contains(document.activeElement)) return;
    if (!on()) { box.innerHTML = ''; return; }
    var c = cfg(), sw = function (f, l, s) { return '<label class="st-row"><span>' + esc(l) + '<small class="st-rsub">' + esc(s) + '</small></span><input type="checkbox" class="switch" data-chcfg="' + f + '"' + (c[f] ? ' checked' : '') + '></label>'; };
    box.innerHTML = '<p class="st-sub ap-sub"><i class="bi bi-arrow-repeat"></i> Chores</p><div class="st-group">' + sw('brief', 'Chores in At a glance', 'On the day it’s your turn, with Done') + sw('both', 'Also show the other one’s turn', 'Handy if you share one phone or remind each other') + '</div>';
  }
  document.addEventListener('change', function (e) { var i = e.target.closest('[data-chcfg]'); if (!i) return; var t = Fe.tools(); t.chorecfg = Object.assign({}, t.chorecfg || {}); t.chorecfg[i.dataset.chcfg] = i.checked; Fe.saveTools(t); toast('<i class="bi bi-check2"></i> Saved'); });
  window.addEventListener('st:page', function (e) { if (e.detail === 'house') setTimeout(setFill, 0); });
  if (col) window.addEventListener('shared:change', function () { col.render(); });
})();
