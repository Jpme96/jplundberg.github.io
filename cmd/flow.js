/* Flow: small hand-offs between the parts of the dashboard.
   - route():    open the journey planner with a destination and "arrive by" time
   - addEvent(): put something in your calendar
   - logSpend(): put a cost in Finances (needs the vault to be unlocked)
   - travel():   trips, saved places and recent journeys ("dash.travel", synced)
   - leaveBy():  when to leave home to reach a place on time (Entur) */
(function () {
  "use strict";

  var TRAVEL_COLOR = '#0891b2';
  var TYPES = {
    flight: { name: 'Flight', icon: 'airplane', buffer: 90, move: true },
    train: { name: 'Train', icon: 'train-front', buffer: 10, move: true },
    bus: { name: 'Bus', icon: 'bus-front', buffer: 10, move: true },
    boat: { name: 'Ferry', icon: 'water', buffer: 30, move: true },
    car: { name: 'Car', icon: 'car-front', buffer: 10, move: true },
    hotel: { name: 'Stay', icon: 'building', buffer: 0 },
    activity: { name: 'Activity', icon: 'ticket-perforated', buffer: 10 },
    other: { name: 'Other', icon: 'pin-map', buffer: 10 }
  };

  var DOCS = {
    passport: { name: 'Passport', icon: 'passport' }, id: { name: 'National ID', icon: 'person-vcard' },
    ehic: { name: 'EU health card', icon: 'heart-pulse' }, insurance: { name: 'Travel insurance', icon: 'shield-check' },
    license: { name: 'Driving licence', icon: 'car-front' }, visa: { name: 'Visa', icon: 'globe2' }, other: { name: 'Other', icon: 'file-earmark-text' }
  };

  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));      // lock.js puts it in the synced vault
  }

  /* ---------- trips, places, recent ---------- */
  function travel() {
    var t = readJSON('dash.travel');
    t = t && typeof t === 'object' ? t : {};
    t.recent = Array.isArray(t.recent) ? t.recent : [];
    t.trips = Array.isArray(t.trips) ? t.trips : [];
    t.places = t.places && typeof t.places === 'object' ? t.places : {};
    t.docs = Array.isArray(t.docs) ? t.docs : [];
    return t;
  }
  function saveTravel(t) {
    writeJSON('dash.travel', t);
    window.dispatchEvent(new Event('cal:change'));
    window.dispatchEvent(new Event('travel:change'));
  }

  /* A booking's start and end as dates (time optional) */
  function when(item) {
    if (!item || !/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')) return null;
    var p = item.date.split('-'), t = /^\d{2}:\d{2}$/.test(item.time || '') ? item.time.split(':') : null;
    var start = new Date(+p[0], p[1] - 1, +p[2], t ? +t[0] : 0, t ? +t[1] : 0);
    var end = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(item.endDate || '') || /^\d{2}:\d{2}$/.test(item.endTime || '')) {
      var q = (item.endDate || item.date).split('-'), u = /^\d{2}:\d{2}$/.test(item.endTime || '') ? item.endTime.split(':') : null;
      end = new Date(+q[0], q[1] - 1, +q[2], u ? +u[0] : (t ? +t[0] : 0), u ? +u[1] : (t ? +t[1] : 0));
      if (t && end <= start) end = new Date(end.getTime() + 864e5);     // lands after midnight
    }
    return { start: start, end: end, timed: !!t };
  }

  /* ---------- hand-offs ---------- */
  /* q: { to: place | toText, from: place | fromText, arriveBy: Date|ISO, departAt: Date|ISO,
          context: { title, note, cat } } */
  function route(q) {
    q = Object.assign({}, q);
    ['arriveBy', 'departAt'].forEach(function (k) { if (q[k] instanceof Date) q[k] = q[k].toISOString(); });
    try { sessionStorage.setItem('dash.tripQuery', JSON.stringify(q)); } catch (e) {}
    location.href = '/cmd/travel/';
  }

  function addEvent(e) {
    var d = readJSON('dash.calendar') || {};
    d.events = Array.isArray(d.events) ? d.events : [];
    var ev = Object.assign({ id: uid(), cat: 'life' }, e);
    d.events.push(ev);
    writeJSON('dash.calendar', d);
    window.dispatchEvent(new Event('cal:change'));
    return ev.id;
  }

  function logSpend(x) {
    if (!window.Vault || !window.Vault.get()) return false;
    var d = window.Vault.get();
    d.expenses = Array.isArray(d.expenses) ? d.expenses : [];
    var id = uid();
    d.expenses.push({ id: id, t: Date.now(), date: x.date || dkey(new Date()), amount: Math.round(x.amount * 100) / 100,
      cat: x.cat || 'travel', note: String(x.note || '').slice(0, 80) });
    window.Vault.save(d);
    return id;
  }
  function unlogSpend(id) {
    if (!id || !window.Vault || !window.Vault.get()) return;
    var d = window.Vault.get();
    d.expenses = (d.expenses || []).filter(function (e) { return e.id !== id; });
    window.Vault.save(d);
  }

  /* ---------- "leave by" for a place and a time ---------- */
  var LB_KEY = 'dash.leaveBy';
  function leaveBy(placeText, arrive, home) {
    if (!window.Places || !home || !placeText) return Promise.resolve(null);
    var key = home.name + '|' + placeText + '|' + new Date(arrive).toISOString();
    var cache = {};
    try { cache = JSON.parse(sessionStorage.getItem(LB_KEY)) || {}; } catch (e) {}
    var c = cache[key];
    if (c && Date.now() - c.at < 10 * 60e3) return Promise.resolve(c.r);
    return window.Places.search(placeText, { limit: 1 }).then(function (list) {
      var to = list && list[0];
      if (!to) return null;
      return window.Places.trips(home, to, { time: new Date(arrive).toISOString(), arriveBy: true }).then(function (t) {
        var best = (t.tripPatterns || []).filter(function (p) { return new Date(p.expectedEndTime) <= new Date(arrive); })
          .sort(function (a, b) { return new Date(b.expectedStartTime) - new Date(a.expectedStartTime); })[0];
        if (!best) return null;
        var rides = (best.legs || []).filter(function (l) { return l.mode !== 'foot'; });
        var r = { leave: best.expectedStartTime, arrive: best.expectedEndTime, minutes: Math.round(best.duration / 60), to: to,
          lines: rides.map(function (l) { return (l.line && l.line.publicCode) || ''; }).filter(Boolean).slice(0, 3) };
        cache[key] = { at: Date.now(), r: r };
        try { sessionStorage.setItem(LB_KEY, JSON.stringify(cache)); } catch (e) {}
        return r;
      });
    }).catch(function () { return null; });
  }

  /* ---------- "leave by" blocks before events with a place (next 3 days) ----------
     Worked out here (Entur), kept in localStorage dash.leaveBlocks, and shown by Features.events()
     in the calendar, on Today and in the plan of your day. Calendar settings → "When to leave". */
  var LV_KEY = 'dash.leaveBlocks', lvBusy = false, lvLast = 0;
  function leaveBlocks() { try { return JSON.parse(localStorage.getItem(LV_KEY)) || {}; } catch (e) { return {}; } }
  function planLeaves(force) {
    var C = window.Cal, pl = travel().places || {};
    if (!C || !C.occurrences || !window.Places || !pl.home || lvBusy || (!force && Date.now() - lvLast < 90e3)) return;
    if (C.prefs && C.prefs().leave === false) { if (localStorage.getItem(LV_KEY)) { localStorage.removeItem(LV_KEY); window.dispatchEvent(new Event('cal:change')); } return; }
    lvBusy = true; lvLast = Date.now();
    var now = new Date(), end = new Date(now.getTime() + 3 * 864e5), old = leaveBlocks(), keep = {}, jobs = [];
    var occ = [];
    try { occ = C.occurrences(now, end, {}); } catch (e) {}
    occ.filter(function (o) { return !o.allDay && o.start > now && o.ev.location && !o.ev.reminder && !o.ev.holiday && !o.ev.trip && !o.ev.leave &&
        !/\b(teams|zoom|meet|skype|webex|online|digital|telefon|phone)\b|https?:/i.test(o.ev.location); })
      .slice(0, 8).forEach(function (o) {
        var key = o.ev.id + '@' + o.start.getTime(), c = old[key];
        var h = o.start.getHours(), wd = o.start.getDay() % 6 !== 0, from = wd && h >= 9 && h < 16 && pl.work ? 'work' : 'home';
        if (c && c.loc === o.ev.location && c.from === from && Date.now() - c.at < 3 * 3600e3) { keep[key] = c; return; }
        jobs.push(leaveBy(o.ev.location, new Date(o.start.getTime() - 5 * 60e3), pl[from]).then(function (r) {
          if (r && r.minutes >= 6) keep[key] = { at: Date.now(), loc: o.ev.location, leave: r.leave, mins: r.minutes, title: o.title, from: from, lines: r.lines || [] };
        }));
      });
    Promise.all(jobs).then(function () {
      lvBusy = false;
      var sig = function (x) { return JSON.stringify(Object.keys(x).sort().map(function (k) { return [k, x[k].leave, x[k].mins]; })); };
      try { localStorage.setItem(LV_KEY, JSON.stringify(keep)); } catch (e) {}
      if (sig(keep) !== sig(old)) window.dispatchEvent(new Event('cal:change'));
    });
  }
  if (window.Vault) {
    window.Vault.onUnlock(function () { setTimeout(planLeaves, 1500); });
    window.addEventListener('cal:change', function () { clearTimeout(planLeaves.t); planLeaves.t = setTimeout(planLeaves, 4000); });
    setInterval(function () { if (!document.hidden) planLeaves(true); }, 30 * 60e3);
  }

  window.Flow = {
    leaveBlocks: leaveBlocks, planLeaves: planLeaves,
    TRAVEL_COLOR: TRAVEL_COLOR, TYPES: TYPES, DOCS: DOCS,
    travel: travel, saveTravel: saveTravel, when: when,
    route: route, addEvent: addEvent, logSpend: logSpend, unlogSpend: unlogSpend, leaveBy: leaveBy,
    uid: uid, dkey: dkey, hm: hm
  };
})();
