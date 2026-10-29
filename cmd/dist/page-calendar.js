/* Built by cmd/build.py from: budget.js, places.js, flow.js, calendar/cal-core.js, calendar/cal-settings.js, calendar/cal.js, profile.js, links.js – edit those files, not this one. */
/* ===== budget.js ===== */
try {
/* Budget maths shared by the dashboard, the Finances page, the calendar and the reviews.
   An income can be entered as the net amount that lands in your account, or as the gross
   salary with the tax (skattetrekk) and other deductions – pension, union fees and so on –
   and the dashboard works out what you're actually paid, month by month:
     · June: holiday pay (feriepenger) instead of salary, no tax taken
     · December: half tax
   Each income can have a payday, so you also see when the next one comes. */
window.Budget = (function () {
  "use strict";
  function pad(n) { return String(n).padStart(2, '0'); }
  function ym(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function daysIn(y, m) { return new Date(y, m, 0).getDate(); }

  /* one income row → what it pays out in the month 'YYYY-MM'
     r: { amount (net, ordinary month) | gross, taxPct, taxExtra (kr), benefits (taxable, not paid out),
          deductions [{name, amount|pct}], payYear, holidayPay (kr, earned last year), holidayWeeks (4|5), day } */
  function rowFor(r, key) {
    var out = { name: r.name, net: +r.amount || 0, gross: 0, tax: 0, extra: 0, items: [], note: '', day: r.day || null, holiday: false };
    if (!(r.gross > 0)) return out;
    var m = +key.slice(5, 7), gross = +r.gross, pct = +r.taxPct || 0, benefits = +r.benefits || 0, taxExtra = +r.taxExtra || 0;
    var ded = (r.deductions || []).map(function (x) {
      var v = x.pct ? gross * (+x.pct || 0) / 100 : +x.amount || 0;
      return { name: x.name, amount: v };
    });
    var extra = ded.reduce(function (a, x) { return a + x.amount; }, 0);
    out.items = ded; out.extra = extra;
    var salary = gross, tax, note = '';
    if (r.payYear && m === 6) {
      /* June: holiday pay (earned last year, not taxed) is paid, and the salary for the holiday
         weeks is held back – 30/26 of a month for 5 weeks, 25/26 for 4 */
      var hol = r.holidayPay != null && r.holidayPay !== '' ? +r.holidayPay || 0 : gross * 12 * 0.12;
      if (hol > 0) {
        var held = gross * ((+r.holidayWeeks || 5) === 4 ? 25 : 30) / 26;
        salary = gross - held;
        tax = Math.max(0, (salary + benefits) * pct / 100);
        out.gross = hol + salary; out.tax = tax; out.net = hol + salary - tax - extra; out.holiday = true; out.note = 'Holiday pay, no tax';
        return out;
      }
      note = 'No holiday pay earned last year – a normal month';
    }
    tax = (salary + benefits) * pct / 100 + taxExtra;
    if (r.payYear && m === 12) { tax = tax / 2; note = 'Half tax in December'; }
    out.gross = salary; out.tax = tax; out.net = salary - tax - extra; out.note = note;
    return out;
  }
  /* the net amount in an ordinary month (what's stored as r.amount) */
  function ordinary(r) {
    var g = +r.gross || 0;
    if (!(g > 0)) return +r.amount || 0;
    var extra = (r.deductions || []).reduce(function (a, x) { return a + (x.pct ? g * (+x.pct || 0) / 100 : +x.amount || 0); }, 0);
    return g - (g + (+r.benefits || 0)) * (+r.taxPct || 0) / 100 - (+r.taxExtra || 0) - extra;
  }
  /* a logged payslip for a month overrides the model (d.budget.payslips['YYYY-MM'] = {net, gross, tax}) */
  function slip(d, key) { var p = d && d.budget && d.budget.payslips; return p && p[key] && p[key].net > 0 ? p[key] : null; }
  /* all incomes for a month */
  function incomeOf(d, key) {
    var rows = ((d && d.budget && d.budget.income) || []).map(function (r) { return rowFor(r, key); });
    var t = { net: 0, gross: 0, tax: 0, extra: 0, rows: rows, note: '', logged: false };
    rows.forEach(function (r) { t.net += r.net; t.gross += r.gross; t.tax += r.tax; t.extra += r.extra; if (r.note && !t.note) t.note = r.note; });
    var s = slip(d, key);
    if (s) {
      var others = rows.filter(function (r) { return !r.gross; }).reduce(function (a, r) { return a + r.net; }, 0);   // plain net incomes stay
      t.net = (+s.net || 0) + others; t.logged = true;
      if (s.gross > 0) { t.gross = +s.gross; t.tax = +s.tax || 0; t.extra = Math.max(0, +s.gross - (+s.tax || 0) - +s.net); }
      t.note = 'From your payslip';
    }
    return t;
  }
  /* this year so far: logged payslips where you have them, the model for the other months up to now */
  function yearSoFar(d, now) {
    now = now || new Date();
    var y = now.getFullYear(), out = { gross: 0, tax: 0, net: 0, months: 0, logged: 0 };
    for (var m = 1; m <= now.getMonth() + 1; m++) {
      var key = y + '-' + pad(m), t = incomeOf(d, key);
      if (!t.net) continue;
      out.gross += t.gross; out.tax += t.tax; out.net += t.net; out.months++; if (t.logged) out.logged++;
    }
    return out;
  }
  function income(d, key) { return incomeOf(d, key || ym(new Date())).net; }

  /* paydays: the date of each income's payday in a month (weekend → the Friday before, as banks do) */
  function paydayIn(r, y, m) {
    if (!r.day) return null;
    var dt = new Date(y, m - 1, Math.min(+r.day, daysIn(y, m)));
    if (r.day === 'last' || +r.day > 28) dt = new Date(y, m - 1, Math.min(r.day === 'last' ? 31 : +r.day, daysIn(y, m)));
    while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() - 1);
    return dt;
  }
  function paydays(d, from, to) {
    var out = [], rows = (d && d.budget && d.budget.income) || [];
    for (var y = from.getFullYear(); y <= to.getFullYear(); y++) {
      for (var m = 1; m <= 12; m++) rows.forEach(function (r) {
        var dt = paydayIn(r, y, m);
        if (!dt || dt < from || dt > to) return;
        var row = rowFor(r, y + '-' + pad(m));
        out.push({ date: dt, row: row, src: r, title: row.holiday ? 'Holiday pay' : 'Payday' + (rows.length > 1 ? ' · ' + r.name : ''), net: row.net });
      });
    }
    return out.sort(function (a, b) { return a.date - b.date; });
  }
  /* the next payday from today (today counts if it hasn't passed) */
  function nextPayday(d, from) {
    from = from || new Date();
    var start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    var end = new Date(start); end.setMonth(end.getMonth() + 2);
    var list = paydays(d, start, end);
    if (!list.length) return null;
    var p = list[0], days = Math.round((p.date - start) / 864e5);
    return { date: p.date, days: days, title: p.title, net: p.net, name: p.src.name };
  }
  function hasPayday(d) { return ((d && d.budget && d.budget.income) || []).some(function (r) { return r.day; }); }

  /* The budget period: a calendar month, or – when d.budget.period is 'payday' and an income has a
     payday – from one payday up to the day before the next. */
  function dk(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function period(d, now) {
    now = now || new Date();
    var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var byPay = d && d.budget && d.budget.period === 'payday' && hasPayday(d);
    var start, end, label, income;
    if (byPay) {
      var back = new Date(t0); back.setMonth(back.getMonth() - 2);
      var fwd = new Date(t0); fwd.setMonth(fwd.getMonth() + 2);
      /* boundaries follow the main income (the biggest one) */
      var rows = d.budget.income.filter(function (r) { return r.day; });
      var main = rows.slice().sort(function (a, b) { return ordinary(b) - ordinary(a); })[0];
      var all = paydays(d, back, fwd), mine = all.filter(function (p) { return p.src === main; });
      var prev = mine.filter(function (p) { return p.date <= t0; }).pop(), next = mine.filter(function (p) { return p.date > t0; })[0];
      if (prev && next) {
        start = prev.date; end = new Date(next.date); end.setDate(end.getDate() - 1);
        income = all.filter(function (p) { return p.date >= start && p.date <= end; }).reduce(function (a, p) { return a + p.net; }, 0);
        label = 'until payday';
      }
    }
    if (!start) {
      start = new Date(t0.getFullYear(), t0.getMonth(), 1); end = new Date(t0.getFullYear(), t0.getMonth() + 1, 0);
      income = incomeOf(d, ym(t0)).net; label = 'this month'; byPay = false;
    }
    var sk = dk(start), ek = dk(end);
    /* money in that isn't salary – refunds, Vipps from friends, things you sold (from bank imports) */
    var extra = ((d && d.extra) || []).filter(function (e) { var k = String(e.date || '').slice(0, 10); return k >= sk && k <= ek; }).reduce(function (a, e) { return a + (+e.amount || 0); }, 0);
    return {
      byPayday: byPay, start: start, end: end, startKey: sk, endKey: ek, income: income + extra, salary: income, extra: extra, label: label,
      days: Math.round((end - start) / 864e5) + 1, daysLeft: Math.round((end - t0) / 864e5) + 1,
      has: function (dateStr) { var k = String(dateStr).slice(0, 10); return k >= sk && k <= ek; },
      name: byPay ? start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – ' + end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : t0.toLocaleDateString('en-GB', { month: 'long' })
    };
  }
  /* pace: where this period ends up if you keep spending like you have so far
     { projected, room, end (what's left at the end), perDay, elapsed, ok } – null early in the period */
  function pace(d, now) {
    now = now || new Date();
    var per = period(d, now), fixed = ((d && d.budget && d.budget.fixed) || []).reduce(function (a, f) { return a + (+f.amount || 0); }, 0);
    if (!(per.income > 0)) return null;
    var elapsed = per.days - per.daysLeft + 1, sp = spent(d, per), room = per.income - fixed;
    if (elapsed < 5 || per.daysLeft < 2) return null;
    var projected = sp / elapsed * per.days;
    return { per: per, spent: sp, room: room, projected: projected, end: room - projected, perDay: sp / elapsed, elapsed: elapsed, ok: projected <= room };
  }
  /* a savings goal: what to put aside each month – your own amount, or worked out from "reach it by" */
  function saveMonthly(g, now) {
    now = now || new Date();
    var left = (+g.target || 0) - (+g.saved || 0);
    if (!(left > 0)) return 0;
    if (+g.monthly > 0) return Math.min(+g.monthly, left);
    if (!/^\d{4}-\d{2}/.test(g.by || '')) return 0;
    var y = +g.by.slice(0, 4), m = +g.by.slice(5, 7) - 1;
    var months = Math.max(1, (y - now.getFullYear()) * 12 + (m - now.getMonth()) + 1);
    return Math.ceil(left / months / 10) * 10;
  }
  function spent(d, per) { return ((d && d.expenses) || []).filter(function (e) { return per.has(e.date); }).reduce(function (a, e) { return a + (+e.amount || 0); }, 0); }

  return { saveMonthly: saveMonthly, period: period, spent: spent, pace: pace, slip: slip, yearSoFar: yearSoFar, rowFor: rowFor, ordinary: ordinary, incomeOf: incomeOf, income: income, paydays: paydays, nextPayday: nextPayday, hasPayday: hasPayday, ym: ym };
})();
} catch (e) { console.error("budget.js", e); }
/* ===== places.js ===== */
try {
/* Shared place search (Entur Geocoder v3) and trip search (Entur Journey Planner v3).
   Used by the dashboard's travel card and by /cmd/travel. Open data, no account needed. */
(function () {
  "use strict";

  var CLIENT = 'jplundberg-dashboard';
  var GEO = 'https://api.entur.io/geocoder/v3/autocomplete';
  var JP = 'https://api.entur.io/journey-planner/v3/graphql';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- geocoder ---------- */
  function search(q, opts) {
    opts = opts || {};
    var url = GEO + '?q=' + encodeURIComponent(q) + '&lang=no&limit=' + (opts.limit || 7) + (opts.layers ? '&layers=' + opts.layers : '');
    return fetch(url, { headers: { 'ET-Client-Name': CLIENT } }).then(function (r) { return r.json(); }).then(function (j) {
      return (j.features || []).map(function (f) {
        var p = f.properties || {}, names = p.names || {}, c = (f.geometry && f.geometry.coordinates) || [];
        var modes = (p.transportModes || []).map(function (m) { return m.mode || m; });
        return {
          id: p.id || '', name: names.default || p.name || names.display || p.label || '',
          sub: [(p.address && p.address.locality) || p.locality || ''].concat(modes.slice(0, 3)).filter(Boolean).join(' · '),
          lon: c[0], lat: c[1], stop: /^NSR:StopPlace/.test(p.id || '')
        };
      }).filter(function (x) { return x.name; });
    });
  }

  /* Where a trip starts or ends, in the form the journey planner wants */
  function toLocation(p) {
    if (p.stop && p.id) return { place: p.id, name: p.name };
    return { name: p.name, coordinates: { latitude: p.lat, longitude: p.lon } };
  }

  /* ---------- trips ---------- */
  var RICH = 'tripPatterns { expectedStartTime aimedStartTime expectedEndTime duration walkDistance ' +
    'legs { mode distance duration realtime aimedStartTime expectedStartTime expectedEndTime ' +
    'fromPlace { name quay { publicCode } } toPlace { name } ' +
    'line { publicCode name transportMode presentation { colour textColour } } ' +
    'fromEstimatedCall { destinationDisplay { frontText } } } } nextPageCursor';
  var PLAIN = 'tripPatterns { expectedStartTime expectedEndTime duration ' +
    'legs { mode duration expectedStartTime expectedEndTime fromPlace { name } toPlace { name } line { publicCode transportMode } } }';
  var rich = true;

  function trips(from, to, when, cursor) {
    var vars = { from: toLocation(from), to: toLocation(to), dateTime: (when && when.time) || new Date().toISOString(), arriveBy: !!(when && when.arriveBy) };
    var args = 'from: $from, to: $to, dateTime: $dateTime, arriveBy: $arriveBy, numTripPatterns: 6' + (cursor && rich ? ', pageCursor: $cursor' : '');
    var q = 'query($from: Location!, $to: Location!, $dateTime: DateTime, $arriveBy: Boolean' + (cursor && rich ? ', $cursor: String' : '') + ') { trip(' + args + ') { ' + (rich ? RICH : PLAIN) + ' } }';
    if (cursor && rich) vars.cursor = cursor;
    return fetch(JP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ET-Client-Name': CLIENT },
      body: JSON.stringify({ query: q, variables: vars })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.errors && rich) { rich = false; return trips(from, to, when, null); }   // retry with fewer fields
      if (!j.data || !j.data.trip) throw new Error('no trips');
      return j.data.trip;
    });
  }

  /* ---------- autocomplete field ---------- */
  function field(input, opts) {
    opts = opts || {};
    var wrap = input.closest('.ps-wrap');
    var list = document.createElement('ul');
    list.className = 'ps-list';
    list.hidden = true;
    list.setAttribute('role', 'listbox');
    wrap.appendChild(list);
    var items = [], seq = 0, timer = null, active = -1;

    function show(rows, msg) {
      items = rows;
      active = -1;
      var mine = opts.myLocation && navigator.geolocation ? '<li><button type="button" data-i="me" role="option"><i class="bi bi-crosshair"></i><span>My location</span></button></li>' : '';
      list.innerHTML = (msg ? '' : mine) + (msg ? '<li class="ps-msg">' + msg + '</li>' : rows.map(function (x, i) {
        return '<li><button type="button" data-i="' + i + '" role="option"><i class="bi bi-' + (x.stop ? 'signpost' : 'geo-alt') + '"></i><span>' + esc(x.name) + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + '</span></button></li>';
      }).join(''));
      list.hidden = false;
    }
    function hide() { list.hidden = true; }
    function pick(p) {
      input.value = p.name;
      input.dataset.picked = '1';
      hide();
      if (opts.onPick) opts.onPick(p);
    }

    input.setAttribute('autocomplete', 'off');
    input.addEventListener('focus', function () {
      if (!input.value && opts.myLocation && navigator.geolocation) show([]);
      if (opts.recent && !input.value) { var r = opts.recent(); if (r.length) show(r); }
    });
    input.addEventListener('input', function () {
      input.dataset.picked = '';
      if (opts.onPick) opts.onPick(null);
      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { if (!q && opts.myLocation) show([]); else hide(); return; }
      timer = setTimeout(function () {
        var s = ++seq;
        (opts.search || search)(q, { layers: opts.layers }).then(function (rows) {
          if (s !== seq) return;
          rows.length ? show(rows) : show([], 'No places found');
        }).catch(function () { if (s === seq) show([], 'Couldn’t search right now'); });
      }, 220);
    });
    input.addEventListener('keydown', function (e) {
      var btns = list.querySelectorAll('button');
      if (list.hidden || !btns.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
        btns.forEach(function (b, i) { b.classList.toggle('on', i === active); });
      } else if (e.key === 'Enter' && active > -1) {
        e.preventDefault(); btns[active].click();
      } else if (e.key === 'Escape') hide();
    });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });   // keep focus while choosing
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (!b) return;
      if (b.dataset.i === 'me') {
        input.value = 'Finding you…';
        navigator.geolocation.getCurrentPosition(function (pos) {
          pick({ name: 'My location', lat: pos.coords.latitude, lon: pos.coords.longitude, stop: false, mine: true });
        }, function () { input.value = ''; show([], 'Location isn’t available. Allow it in the browser, or type a place.'); }, { timeout: 10000, maximumAge: 60000 });
        return;
      }
      pick(items[+b.dataset.i]);
    });
    input.addEventListener('blur', function () { setTimeout(hide, 150); });
    return { set: function (p) { input.value = p ? p.name : ''; input.dataset.picked = p ? '1' : ''; }, hide: hide };
  }

  window.Places = { search: search, trips: trips, field: field, esc: esc };
})();
} catch (e) { console.error("places.js", e); }
/* ===== flow.js ===== */
try {
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

  window.Flow = {
    TRAVEL_COLOR: TRAVEL_COLOR, TYPES: TYPES, DOCS: DOCS,
    travel: travel, saveTravel: saveTravel, when: when,
    route: route, addEvent: addEvent, logSpend: logSpend, unlogSpend: unlogSpend, leaveBy: leaveBy,
    uid: uid, dkey: dkey, hm: hm
  };
})();
} catch (e) { console.error("flow.js", e); }
/* ===== calendar/cal-core.js ===== */
try {
/* Calendar engine, shared by the calendar page and the dashboard card.
   - Your own events live in "dash.calendar" and are synced in the encrypted vault.
   - Phone calendars (iCloud, Google, Outlook links) are read through the Worker
     (/cmd/api/calendar) and shown read-only. The links are kept in the vault too. */
(function () {
  "use strict";

  var KEY = 'dash.calendar';
  var API = '/cmd/api/calendar';
  var FRESH_MS = 10 * 60 * 1000;
  /* Your categories (Calendar settings). These are the defaults; "Life" from before became "Personal". */
  var DEFAULT_CATS = [
    { id: 'work', name: 'Work', color: '#3987e5' },
    { id: 'study', name: 'Study', color: '#8a6fdf' },
    { id: 'training', name: 'Training', color: '#d55181' },
    { id: 'social', name: 'Social', color: '#e8743b' },
    { id: 'personal', name: 'Personal', color: '#22b35e' }
  ];
  var CATS = {};                 // id → {name, color}, kept up to date by load()
  var CAT_ORDER = [];
  function setCats(list) {
    Object.keys(CATS).forEach(function (k) { delete CATS[k]; });
    CAT_ORDER.length = 0;
    list.forEach(function (c) { CATS[c.id] = { name: c.name, color: c.color }; CAT_ORDER.push(c.id); });
  }
  setCats(DEFAULT_CATS);
  function catOf(id) {
    if (CATS[id]) return id;
    if (id === 'life' && CATS.personal) return 'personal';
    return CATS.personal ? 'personal' : CAT_ORDER[CAT_ORDER.length - 1];
  }
  var HOLIDAY_COLOR = '#e66767';
  var PREFS = { weekNums: true, holidays: true, view: 'last', dur: 60, cat: 'last', dayStart: 7, cardHide: {} };
  function prefs(d) {
    var p = (d || load()).prefs || {}, out = {};
    Object.keys(PREFS).forEach(function (k) { out[k] = p[k] == null ? PREFS[k] : p[k]; });
    if (!out.cardHide || typeof out.cardHide !== 'object') out.cardHide = {};
    return out;
  }
  /* ISO week number (uke) */
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var n = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - n);
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  }
  var FEED_COLORS = ['#e8743b', '#d55181', '#14b8a6', '#c9a227', '#7a8794'];
  var WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function day0(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds()); }
  function monday(d) { var x = day0(d); return addDays(x, -((x.getDay() + 6) % 7)); }
  function occKey(d) { return dkey(d) + 'T' + hm(d); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- your own events ---------- */
  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    d = d && typeof d === 'object' ? d : {};
    d.events = Array.isArray(d.events) ? d.events : [];
    d.feeds = Array.isArray(d.feeds) ? d.feeds : [];
    d.hidden = d.hidden && typeof d.hidden === 'object' ? d.hidden : {};
    var ok = Array.isArray(d.cats) && d.cats.length && d.cats.every(function (c) { return c && c.id && c.name && /^#[0-9a-f]{6}$/i.test(c.color || ''); });
    setCats(ok ? d.cats : DEFAULT_CATS);
    if (d.hidden.life && !CATS.life) { d.hidden.personal = 1; delete d.hidden.life; }
    return d;
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));      // lock.js puts it in the synced vault
    window.dispatchEvent(new Event('cal:change'));
  }

  var REPEATS = {
    '': null,
    daily: { freq: 'DAILY', interval: 1 },
    weekdays: { freq: 'WEEKLY', interval: 1, byday: [1, 2, 3, 4, 5].map(function (w) { return { wd: w, n: 0 }; }) },
    weekly: { freq: 'WEEKLY', interval: 1 },
    '2weeks': { freq: 'WEEKLY', interval: 2 },
    monthly: { freq: 'MONTHLY', interval: 1 },
    quarterly: { freq: 'MONTHLY', interval: 3 },
    yearly: { freq: 'YEARLY', interval: 1 }
  };
  var REPEAT_NAMES = { '': 'Never', daily: 'Every day', weekdays: 'Every weekday (Mon–Fri)', weekly: 'Every week', '2weeks': 'Every 2 weeks', monthly: 'Every month', quarterly: 'Every 3 months', yearly: 'Every year' };

  /* Turns a stored event into the common shape used for both sources */
  function fromOwn(e) {
    var base = fromKey(e.date);
    var ev = { id: e.id, own: e, title: e.title || 'Untitled', cat: catOf(e.cat), allDay: !!e.allDay,
               location: e.location || '', notes: e.notes || '', exDays: {} };
    ev.color = CATS[ev.cat].color;
    if (ev.allDay) {
      ev.start = base;
      var end = e.end ? fromKey(e.end) : base;
      ev.days = Math.max(1, Math.round((day0(end) - base) / 864e5) + 1);
    } else {
      var a = String(e.start || '09:00').split(':'), b = String(e.stop || '').split(':');
      ev.start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), +a[0] || 0, +a[1] || 0);
      var stop = b.length === 2 ? new Date(base.getFullYear(), base.getMonth(), base.getDate(), +b[0] || 0, +b[1] || 0) : null;
      if (!stop || stop <= ev.start) stop = stop && stop < ev.start ? addDays(stop, 1) : new Date(ev.start.getTime() + 3600e3);
      ev.dur = stop - ev.start;
    }
    var r = REPEATS[e.repeat || ''];
    if (r) {
      ev.rule = Object.assign({}, r, { clamp: true });
      if (e.until) { var u = fromKey(e.until); ev.rule.until = new Date(u.getFullYear(), u.getMonth(), u.getDate(), 23, 59, 59); }
    }
    (e.skip || []).forEach(function (k) { ev.exDays[k] = 1; });
    return ev;
  }

  /* ---------- repeats (RFC 5545 subset: the rules phones actually use) ---------- */
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function monthDays(y, m, r, s0) {
    var dim = daysInMonth(y, m), out = [];
    if (r.bymonthday) {
      r.bymonthday.forEach(function (n) { var d = n > 0 ? n : dim + 1 + n; if (d >= 1 && d <= dim) out.push(d); });
    } else if (r.byday && r.byday.length) {
      r.byday.forEach(function (b) {
        var first = (b.wd - new Date(y, m, 1).getDay() + 7) % 7 + 1, all = [];
        for (var d = first; d <= dim; d += 7) all.push(d);
        if (!b.n) out = out.concat(all);
        else { var pick = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (pick) out.push(pick); }
      });
    } else if (s0.getDate() <= dim) out.push(s0.getDate());
    else if (r.clamp) out.push(dim);                    // your own "every month" on the 31st: last day
    out = out.filter(function (d, i) { return out.indexOf(d) === i; }).sort(function (a, b) { return a - b; });
    if (r.setpos && out.length) {
      out = r.setpos.map(function (p) { return p > 0 ? out[p - 1] : out[out.length + p]; }).filter(Boolean);
    }
    return out;
  }

  /* Start times of every occurrence of ev that overlaps [from, to) */
  function expand(ev, from, to) {
    var out = [], s0 = ev.start, r = ev.rule;
    function endOf(s) { return ev.allDay ? addDays(day0(s), ev.days || 1) : new Date(s.getTime() + (ev.dur || 0)); }
    function take(s) {
      if (ev.exDays && ev.exDays[dkey(s)]) return;
      if (ev.exTimes && ev.exTimes[occKey(s)]) return;
      var e = endOf(s);
      if ((e > from || (+e === +s && s >= from)) && s < to) out.push(s);
    }
    if (!r) { take(s0); return out; }

    var n = 0, count = r.count || Infinity, until = r.until, iv = r.interval || 1, guard = 0, stop = false;
    var H = s0.getHours(), M = s0.getMinutes(), S = s0.getSeconds();
    function at(y, m, d) { return new Date(y, m, d, H, M, S); }
    function emit(s) {
      if (s < s0) return;
      if ((until && s > until) || n >= count || s >= to) { stop = true; return; }
      n++; take(s);
    }
    /* Without a count we can jump close to the window instead of walking from the start */
    var lookBack = ev.allDay ? (ev.days || 1) : Math.ceil((ev.dur || 0) / 864e5) + 1;
    var jumpTo = !r.count && from > s0 ? addDays(day0(from), -lookBack - 1) : null;

    if (r.freq === 'DAILY') {
      var d = day0(s0);
      if (jumpTo) { var k = Math.floor((jumpTo - d) / (864e5 * iv)); if (k > 0) d = addDays(d, k * iv); }
      for (; !stop && guard++ < 40000; d = addDays(d, iv)) {
        if (r.byday && !r.byday.some(function (b) { return b.wd === d.getDay(); })) continue;
        if (r.bymonth && r.bymonth.indexOf(d.getMonth()) < 0) continue;
        emit(at(d.getFullYear(), d.getMonth(), d.getDate()));
      }
    } else if (r.freq === 'WEEKLY') {
      var wds = (r.byday && r.byday.length ? r.byday.map(function (b) { return b.wd; }) : [s0.getDay()])
        .map(function (w) { return (w + 6) % 7; }).sort();
      var w = monday(s0);
      if (jumpTo) { var kw = Math.floor((monday(jumpTo) - w) / (7 * 864e5 * iv)); if (kw > 0) w = addDays(w, kw * 7 * iv); }
      for (; !stop && guard++ < 6000; w = addDays(w, 7 * iv)) {
        for (var i = 0; i < wds.length && !stop; i++) emit(at(w.getFullYear(), w.getMonth(), w.getDate() + wds[i]));
      }
    } else if (r.freq === 'MONTHLY') {
      for (var mi = 0; !stop && guard++ < 2400; mi += iv) {
        var first = new Date(s0.getFullYear(), s0.getMonth() + mi, 1);
        if (first >= to) break;
        var ds = monthDays(first.getFullYear(), first.getMonth(), r, s0);
        for (var j = 0; j < ds.length && !stop; j++) emit(at(first.getFullYear(), first.getMonth(), ds[j]));
      }
    } else if (r.freq === 'YEARLY') {
      var months = r.bymonth && r.bymonth.length ? r.bymonth.slice().sort(function (a, b) { return a - b; }) : [s0.getMonth()];
      for (var yi = 0; !stop && guard++ < 400; yi += iv) {
        var y = s0.getFullYear() + yi;
        if (new Date(y, 0, 1) >= to) break;
        for (var q = 0; q < months.length && !stop; q++) {
          var mdays = monthDays(y, months[q], r, s0);
          for (var z = 0; z < mdays.length && !stop; z++) emit(at(y, months[q], mdays[z]));
        }
      }
    }
    return out;
  }

  /* ---------- phone calendar files (.ics) ---------- */
  var WIN_TZ = {
    'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris',
    'Central Europe Standard Time': 'Europe/Budapest', 'Central European Standard Time': 'Europe/Warsaw',
    'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
    'FLE Standard Time': 'Europe/Helsinki', 'E. Europe Standard Time': 'Europe/Chisinau',
    'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago',
    'Pacific Standard Time': 'America/Los_Angeles', 'UTC': 'UTC', 'Coordinated Universal Time': 'UTC'
  };
  var tzOk = {}, fmts = {};
  function tzName(raw) {
    var tz = String(raw || '').replace(/^"|"$/g, '').replace(/^\/[^/]*\/[^/]*\//, '');   // also "/mozilla.org/20050126_1/Europe/Oslo"
    tz = WIN_TZ[tz] || tz;
    if (!(tz in tzOk)) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); tzOk[tz] = true; } catch (e) { tzOk[tz] = false; } }
    return tzOk[tz] ? tz : null;
  }
  function tzOffset(ms, tz) {
    var f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    var p = {};
    f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
  }
  function parseDT(v, params) {
    var m = String(v || '').trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
    if (!m) return null;
    var Y = +m[1], Mo = m[2] - 1, D = +m[3];
    if (!m[4]) return { d: new Date(Y, Mo, D), allDay: true };
    var h = +m[4], mi = +m[5], s = +(m[6] || 0);
    if (m[7]) return { d: new Date(Date.UTC(Y, Mo, D, h, mi, s)), allDay: false };
    var tz = params && params.TZID ? tzName(params.TZID) : null;
    if (tz) {
      var g = Date.UTC(Y, Mo, D, h, mi, s), t = g - tzOffset(g, tz);
      t = g - tzOffset(t, tz);
      return { d: new Date(t), allDay: false };
    }
    return { d: new Date(Y, Mo, D, h, mi, s), allDay: false };
  }
  function parseDuration(v) {
    var m = String(v || '').match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!m) return 0;
    var ms = (((+m[2] || 0) * 7 + (+m[3] || 0)) * 86400 + (+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000;
    return m[1] === '-' ? -ms : ms;
  }
  function parseRule(v) {
    var r = {};
    String(v).split(';').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) r[kv.slice(0, i).toUpperCase()] = kv.slice(i + 1); });
    if (!/^(DAILY|WEEKLY|MONTHLY|YEARLY)$/.test(r.FREQ)) return null;
    var out = { freq: r.FREQ, interval: Math.max(1, +r.INTERVAL || 1) };
    if (r.COUNT) out.count = +r.COUNT;
    if (r.UNTIL) {
      var u = parseDT(r.UNTIL, {});
      if (u) out.until = u.allDay ? new Date(u.d.getFullYear(), u.d.getMonth(), u.d.getDate(), 23, 59, 59) : u.d;
    }
    if (r.BYDAY) out.byday = r.BYDAY.split(',').map(function (x) {
      var m = x.trim().match(/^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/);
      return m ? { n: +(m[1] || 0), wd: WD.indexOf(m[2]) } : null;
    }).filter(Boolean);
    if (r.BYMONTHDAY) out.bymonthday = r.BYMONTHDAY.split(',').map(Number).filter(Boolean);
    if (r.BYMONTH) out.bymonth = r.BYMONTH.split(',').map(function (n) { return n - 1; });
    if (r.BYSETPOS) out.setpos = r.BYSETPOS.split(',').map(Number).filter(Boolean);
    return out;
  }
  function unescapeText(s) {
    return String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  }

  function parseICS(text, feed) {
    var lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    var raw = [], cur = null, depth = 0;
    lines.forEach(function (line) {
      if (/^BEGIN:VEVENT$/i.test(line)) { cur = { p: {}, ex: [] }; depth = 0; return; }
      if (!cur) return;
      if (/^END:VEVENT$/i.test(line)) { raw.push(cur); cur = null; return; }
      if (/^BEGIN:/i.test(line)) { depth++; return; }           // VALARM and friends
      if (/^END:/i.test(line)) { depth--; return; }
      if (depth > 0) return;
      var m = line.match(/^([A-Za-z0-9-]+)((?:;[^:;=]+=(?:"[^"]*"|[^:;]*))*):([\s\S]*)$/);
      if (!m) return;
      var name = m[1].toUpperCase(), params = {};
      (m[2].match(/;[^:;=]+=(?:"[^"]*"|[^:;]*)/g) || []).forEach(function (kv) {
        var i = kv.indexOf('='); params[kv.slice(1, i).toUpperCase()] = kv.slice(i + 1).replace(/^"|"$/g, '');
      });
      if (name === 'EXDATE') cur.ex.push({ v: m[3], params: params });
      else cur.p[name] = { v: m[3], params: params };
    });

    var events = [], masters = {}, overrides = [];
    raw.forEach(function (x, i) {
      var P = x.p;
      if (!P.DTSTART) return;
      var st = parseDT(P.DTSTART.v, P.DTSTART.params);
      if (!st) return;
      var allDay = st.allDay || (P.DTSTART.params.VALUE || '').toUpperCase() === 'DATE';
      var ev = {
        id: feed.id + ':' + (P.UID ? P.UID.v : i) + (P['RECURRENCE-ID'] ? ':' + P['RECURRENCE-ID'].v : ''),
        title: unescapeText(P.SUMMARY ? P.SUMMARY.v : '') || 'Busy',
        location: unescapeText(P.LOCATION ? P.LOCATION.v : ''),
        notes: unescapeText(P.DESCRIPTION ? P.DESCRIPTION.v : '').slice(0, 2000),
        allDay: allDay, start: allDay ? day0(st.d) : st.d, color: feed.color, feed: feed.id, src: feed.name, readOnly: true,
        exDays: {}, exTimes: {}, cancelled: P.STATUS && /CANCELLED/i.test(P.STATUS.v)
      };
      var en = P.DTEND ? parseDT(P.DTEND.v, P.DTEND.params) : null;
      var dur = P.DURATION ? parseDuration(P.DURATION.v) : null;
      if (allDay) {
        var endD = en ? day0(en.d) : (dur ? addDays(ev.start, Math.round(dur / 864e5)) : addDays(ev.start, 1));
        ev.days = Math.max(1, Math.round((endD - ev.start) / 864e5));
      } else {
        ev.dur = Math.max(0, en ? en.d - ev.start : (dur || 0));
      }
      if (P.RRULE) ev.rule = parseRule(P.RRULE.v);
      x.ex.forEach(function (e) {
        e.v.split(',').forEach(function (v) {
          var t = parseDT(v, e.params);
          if (!t) return;
          if (t.allDay || allDay) ev.exDays[dkey(t.d)] = 1; else ev.exTimes[occKey(t.d)] = 1;
        });
      });
      if (P['RECURRENCE-ID']) {
        var rid = parseDT(P['RECURRENCE-ID'].v, P['RECURRENCE-ID'].params);
        if (rid) overrides.push({ uid: P.UID ? P.UID.v : '', rid: rid, ev: ev });
        return;
      }
      if (ev.cancelled) return;
      if (P.UID) masters[P.UID.v] = ev;
      events.push(ev);
    });
    /* A moved or cancelled single occurrence replaces that day in the series */
    overrides.forEach(function (o) {
      var m = masters[o.uid];
      if (m) { if (o.rid.allDay || m.allDay) m.exDays[dkey(o.rid.d)] = 1; else m.exTimes[occKey(o.rid.d)] = 1; }
      if (!o.ev.cancelled) { delete o.ev.rule; events.push(o.ev); }
    });
    return events;
  }

  /* ---------- fetching phone calendars ---------- */
  var feedState = {};          // id -> { events, at, error, loading }
  function cacheKey(id) { return 'dash.calfeed.' + id; }
  function fromCache(f) {
    if (feedState[f.id]) return feedState[f.id];
    var c = null;
    try { c = JSON.parse(sessionStorage.getItem(cacheKey(f.id))); } catch (e) {}
    if (c && c.url === f.url && c.text) {
      feedState[f.id] = { events: parseICS(c.text, f), at: c.at };
      return feedState[f.id];
    }
    return null;
  }
  var ERRORS = {
    'unsupported link': 'This isn’t an iCloud, Google or Outlook calendar link.',
    'not a link': 'That doesn’t look like a link.',
    'calendar not found': 'The calendar wasn’t found. The link may have been turned off or changed.',
    'not a calendar': 'The link didn’t return a calendar.',
    'not found': 'Update the Worker code to use phone calendars.',
    'unauthorized': 'Not signed in. Reload the page.'
  };
  function fetchFeed(f) {
    var st = feedState[f.id] = feedState[f.id] || {};
    st.loading = true;
    return fetch(API, { method: 'POST', cache: 'no-store', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: f.url }) })
      .then(function (r) {
        if (r.ok) return r.text();
        return r.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(ERRORS[j.error] || (j.error ? 'Couldn’t load it (' + j.error + ').' : 'Couldn’t load it (' + r.status + ').'));
        });
      })
      .then(function (text) {
        st.events = parseICS(text, f); st.at = Date.now(); st.error = ''; st.loading = false;
        try { sessionStorage.setItem(cacheKey(f.id), JSON.stringify({ url: f.url, at: st.at, text: text })); } catch (e) {}
      })
      .catch(function (e) {
        st.loading = false;
        st.error = e && e.message && !/fetch|network/i.test(e.message) ? e.message : 'No connection to the calendar right now.';
      });
  }
  function refreshFeeds(force) {
    var d = load();
    var jobs = d.feeds.map(function (f) {
      var c = fromCache(f);
      if (!force && c && c.at && Date.now() - c.at < FRESH_MS) return null;
      return fetchFeed(f);
    }).filter(Boolean);
    if (!jobs.length) return Promise.resolve();
    window.dispatchEvent(new Event('cal:change'));
    return Promise.all(jobs).then(function () { window.dispatchEvent(new Event('cal:change')); });
  }
  function clearFeeds() {
    feedState = {};
    try {
      Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('dash.calfeed.') === 0) sessionStorage.removeItem(k); });
    } catch (e) {}
  }

  /* ---------- trips and bookings from the Travel page ---------- */
  function travelEvents() {
    if (!window.Flow) return [];
    var F = window.Flow, out = [];
    F.travel().trips.forEach(function (tr) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(tr.start || '')) {
        var s = fromKey(tr.start), e = tr.end && tr.end >= tr.start ? fromKey(tr.end) : s;
        out.push({ id: 'trip:' + tr.id, title: tr.name || tr.dest || 'Trip', allDay: true, start: s,
          days: Math.round((e - s) / 864e5) + 1, color: F.TRAVEL_COLOR, readOnly: true, trip: tr.id,
          location: '', notes: tr.dest ? 'Trip to ' + tr.dest : '', exDays: {} });
      }
      (tr.items || []).forEach(function (it) {
        var w = F.when(it), T = F.TYPES[it.type] || F.TYPES.other;
        if (!w) return;
        var title = it.title || T.name;
        if (T.move && it.from && it.to) title += ' · ' + it.from + ' → ' + it.to;
        var ev = { id: 'trip:' + tr.id + ':' + it.id, title: title, color: F.TRAVEL_COLOR, readOnly: true, trip: tr.id, item: it,
          location: it.from || it.to || '', notes: it.ref ? 'Booking reference: ' + it.ref : '', exDays: {}, buffer: T.buffer };
        if (w.timed) { ev.allDay = false; ev.start = w.start; ev.dur = w.end ? w.end - w.start : 3600e3; }
        else { ev.allDay = true; ev.start = w.start; ev.days = 1; }
        out.push(ev);
        /* online check-in opens 24 h before a flight */
        if (it.type === 'flight' && w.timed && !(tr.done && tr.done['checkin:' + it.id])) {
          out.push({ id: ev.id + ':checkin', title: 'Check-in opens: ' + (it.title || 'flight'), color: F.TRAVEL_COLOR, readOnly: true,
            trip: tr.id, allDay: false, start: new Date(w.start.getTime() - 864e5), dur: 15 * 60e3, location: '',
            notes: 'Check in online for ' + (it.title || 'your flight') + (it.ref ? ' (booking reference ' + it.ref + ')' : '') + '.', exDays: {} });
        }
      });
    });
    /* travel documents: the expiry date, and a reminder to renew */
    F.travel().docs.forEach(function (d) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.expires || '')) return;
      var K = (F.DOCS[d.kind] || F.DOCS.other), name = d.name || K.name, exp = fromKey(d.expires);
      out.push({ id: 'doc:' + d.id, title: name + ' expires', allDay: true, start: exp, days: 1, color: F.TRAVEL_COLOR, readOnly: true,
        doc: d.id, location: '', notes: d.note || '', exDays: {} });
      var months = +d.remind || 6, rem = new Date(exp.getFullYear(), exp.getMonth() - months, exp.getDate());
      out.push({ id: 'doc:' + d.id + ':renew', title: 'Renew ' + name.charAt(0).toLowerCase() + name.slice(1), allDay: true, start: rem, days: 1,
        color: F.TRAVEL_COLOR, readOnly: true, doc: d.id, location: '',
        notes: name + ' expires ' + exp.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '.', exDays: {} });
    });
    return out;
  }

  /* ---------- everything in a time window ---------- */
  function occurrences(from, to, opts) {
    opts = opts || {};
    var d = load(), list = [];
    function add(ev) {
      expand(ev, from, to).forEach(function (s) {
        var end = ev.allDay ? addDays(day0(s), ev.days || 1) : new Date(s.getTime() + (ev.dur || 0));
        list.push({ ev: ev, start: s, end: end, allDay: ev.allDay, title: ev.title, color: ev.color, key: ev.id + '@' + occKey(s) });
      });
    }
    d.events.forEach(function (e) {
      var ev = fromOwn(e);
      if (!opts.all && d.hidden[ev.cat]) return;
      add(ev);
    });
    d.feeds.forEach(function (f) {
      if (!opts.all && d.hidden['feed:' + f.id]) return;
      var st = fromCache(f) || feedState[f.id];
      if (st && st.events) st.events.forEach(function (ev) { ev.color = f.color; ev.src = f.name; ev.feedId = f.id; add(ev); });
    });
    var Fe = window.Features;
    if ((opts.all || !d.hidden.travel) && (!Fe || Fe.on('travel'))) travelEvents().forEach(add);
    /* reminders from the tools in Settings → Features (renewals, warranties, certificates) */
    /* from your tools: workouts and courses go in their category, the rest under Reminders */
    if (Fe) Fe.events().forEach(function (ev) {
      if (ev.cat) {
        var cid = catOf(ev.cat);
        if (!opts.all && d.hidden[cid]) return;
        ev.color = CATS[cid].color;
      } else if (!opts.all && d.hidden.reminders) return;
      add(ev);
    });
    /* paydays from your budget (under Reminders) */
    var Bu = window.Budget, vault = window.Vault && window.Vault.get();
    if (Bu && vault && (!Fe || Fe.on('finance')) && (opts.all || !d.hidden.reminders)) Bu.paydays(vault, from, to).forEach(function (p) {
      add({ id: 'pay:' + p.date.getTime(), title: p.title, allDay: true, start: p.date, days: 1, color: '#11a597', readOnly: true, reminder: true,
        link: '/cmd/#fin', location: '', notes: (p.net ? 'About ' + Math.round(p.net).toLocaleString('nb-NO') + ' kr' + (p.row.note ? ' · ' + p.row.note : '') + '. ' : '') + 'From your budget on the dashboard.', exDays: {} });
    });
    /* Norwegian public holidays */
    var p = prefs(d);
    if (Fe && p.holidays && (opts.all || !d.hidden.holidays)) {
      for (var y = from.getFullYear(); y <= to.getFullYear(); y++) Fe.holidays(y).forEach(function (h) {
        add({ id: 'hol:' + h.date, title: h.name, allDay: true, start: fromKey(h.date), days: 1, color: HOLIDAY_COLOR, readOnly: true,
          holiday: true, location: '', notes: h.no + ' – a public holiday in Norway.', exDays: {} });
      });
    }
    if (opts.card) list = list.filter(function (o) {
      var ch = p.cardHide;
      if (o.ev.own) return !ch[o.ev.cat];
      if (o.ev.src) return !ch['feed:' + o.ev.feedId];
      if (o.ev.holiday) return !ch.holidays;
      if (o.ev.tool) return !ch[catOf(o.ev.cat)];
      if (o.ev.reminder) return !ch.reminders;
      return !ch.travel;
    });
    list.sort(function (a, b) {
      if (a.allDay !== b.allDay && dkey(a.start) === dkey(b.start)) return a.allDay ? -1 : 1;
      return a.start - b.start || b.end - a.end || (a.title > b.title ? 1 : -1);
    });
    return list;
  }

  /* ---------- small display helpers ---------- */
  function sameDay(a, b) { return dkey(a) === dkey(b); }
  function dayLabel(d, long) {
    var t = day0(new Date()), diff = Math.round((day0(d) - t) / 864e5);
    var date = d.toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
    if (diff === 0) return 'Today · ' + date;
    if (diff === 1) return 'Tomorrow · ' + date;
    if (diff === -1) return 'Yesterday · ' + date;
    return date;
  }
  function timeLabel(o, onDay) {
    if (o.allDay) return 'All day';
    var s = o.start, e = o.end;
    if (onDay && !sameDay(s, onDay)) return sameDay(e, onDay) ? 'Until ' + hm(e) : 'All day';
    return hm(s) + (o.end > o.start ? '–' + hm(e) : '');
  }

  window.Cal = {
    CATS: CATS, CAT_ORDER: CAT_ORDER, DEFAULT_CATS: DEFAULT_CATS, catOf: catOf, prefs: prefs, isoWeek: isoWeek, HOLIDAY_COLOR: HOLIDAY_COLOR, TRAVEL_COLOR: '#0891b2', FEED_COLORS: FEED_COLORS, REPEAT_NAMES: REPEAT_NAMES,
    load: load, save: save, uid: uid, esc: esc,
    occurrences: occurrences, expand: expand, fromOwn: fromOwn, parseICS: parseICS,
    refreshFeeds: refreshFeeds, fetchFeed: fetchFeed, clearFeeds: clearFeeds,
    feedState: function (id) { return feedState[id] || null; },
    dkey: dkey, hm: hm, fromKey: fromKey, day0: day0, addDays: addDays, monday: monday, sameDay: sameDay,
    dayLabel: dayLabel, timeLabel: timeLabel
  };

  if (window.Vault) window.Vault.onLock(clearFeeds);
})();
} catch (e) { console.error("calendar/cal-core.js", e); }
/* ===== calendar/cal-settings.js ===== */
try {
/* Calendar settings: views, week numbers, holidays, defaults for new events, your own
   categories and what the dashboard card shows. Used in Settings → Calendar on the
   dashboard and in the gear sheet on the calendar page. Saved in dash.calendar (synced). */
(function () {
  "use strict";
  var C = window.Cal;
  if (!C) return;
  var esc = C.esc;
  var SWATCHES = ['#3987e5', '#8a6fdf', '#d55181', '#e8743b', '#22b35e', '#14b8a6', '#c98500', '#7a8794'];

  function update(fn) { var d = C.load(); d.prefs = C.prefs(d); fn(d, d.prefs); C.save(d); }
  function cats() { return C.CAT_ORDER.map(function (id) { return { id: id, name: C.CATS[id].name, color: C.CATS[id].color }; }); }
  function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function sw(key, on, label, sub) {
    return '<label class="st-row"><span class="st-label"><span class="cs-l">' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' +
      '<input type="checkbox" class="switch" data-cs="' + key + '"' + (on ? ' checked' : '') + '></label>';
  }

  function mount(box) {
    var armed = null;
    function render() {
      var d = C.load(), p = C.prefs(d), cs = cats();
      var hours = ''; for (var h = 5; h <= 10; h++) hours += opt(h, String(h).padStart(2, '0') + ':00', p.dayStart);
      var feeds = d.feeds || [];
      box.innerHTML =
        '<p class="st-sub"><i class="bi bi-eye"></i> View</p><section class="st-group">' +
        '<label class="st-row"><span>Open in</span><select class="st-select" data-cs="view">' +
          opt('last', 'Last used', p.view) + opt('month', 'Month', p.view) + opt('week', 'Week', p.view) + opt('list', 'List', p.view) + '</select></label>' +
        sw('weekNums', p.weekNums, 'Week numbers', 'Like “Week 44” in the month and week views') +
        '<label class="st-row"><span class="st-label">Day starts<small>Where the week view opens</small></span><select class="st-select" data-cs="dayStart">' + hours + '</select></label>' +
        sw('holidays', p.holidays, 'Norwegian public holidays', '17. mai, Easter, Christmas … also counted in Flex time') +
        '</section>' +

        '<p class="st-sub"><i class="bi bi-plus-circle"></i> New events</p><section class="st-group">' +
        '<label class="st-row"><span>Length</span><select class="st-select" data-cs="dur">' +
          [15, 30, 45, 60, 90, 120].map(function (m) { return opt(m, m < 60 ? m + ' min' : (m / 60) + ' hour' + (m > 60 ? 's' : ''), p.dur); }).join('') + '</select></label>' +
        '<label class="st-row"><span>Category</span><select class="st-select" data-cs="cat">' + opt('last', 'Last used', p.cat) +
          cs.map(function (c) { return opt(c.id, c.name, p.cat); }).join('') + '</select></label>' +
        '</section>' +

        '<p class="st-sub"><i class="bi bi-tags"></i> Categories <span class="st-hint">Tap the colour to change it</span></p><section class="st-group cs-cats">' +
        cs.map(function (c) {
          return '<div class="st-row cs-cat" data-cid="' + esc(c.id) + '">' +
            '<label class="cs-col" style="--c:' + c.color + '" title="Colour"><input type="color" value="' + c.color + '" data-ccol="' + esc(c.id) + '" aria-label="Colour for ' + esc(c.name) + '"></label>' +
            '<input class="cs-name" value="' + esc(c.name) + '" maxlength="24" data-cname="' + esc(c.id) + '" aria-label="Category name">' +
            (cs.length > 1 ? '<button type="button" class="text-btn danger cs-del" data-cdel="' + esc(c.id) + '">' + (armed === c.id ? 'Delete?' : '<i class="bi bi-trash3"></i>') + '</button>' : '') +
            '</div>';
        }).join('') +
        (cs.length < 8 ? '<button type="button" class="st-row st-btn cs-add" data-cadd><span><i class="bi bi-plus-lg"></i> Add category</span></button>' : '') +
        '</section><p class="st-note">Events in a deleted category move to ' + esc((C.CATS.personal || C.CATS[C.CAT_ORDER[C.CAT_ORDER.length - 1]]).name) + '.</p>' +

        '<p class="st-sub"><i class="bi bi-grid-1x2"></i> Dashboard card <span class="st-hint">What the calendar card on the dashboard shows</span></p><section class="st-group">' +
        cs.map(function (c) { return sw('card:' + c.id, !p.cardHide[c.id], '<i class="dot" style="--c:' + c.color + '"></i> ' + esc(c.name)); }).join('') +
        feeds.map(function (f) { return sw('card:feed:' + f.id, !p.cardHide['feed:' + f.id], '<i class="bi bi-phone"></i> ' + esc(f.name)); }).join('') +
        sw('card:travel', !p.cardHide.travel, '<i class="bi bi-suitcase-lg"></i> Travel') +
        sw('card:reminders', !p.cardHide.reminders, '<i class="bi bi-bell"></i> Reminders') +
        sw('card:holidays', !p.cardHide.holidays, '<i class="bi bi-flag"></i> Holidays') +
        '</section>';
    }
    box.addEventListener('change', function (e) {
      var t = e.target, k = t.dataset.cs;
      if (k) {
        update(function (d, p) {
          if (k.indexOf('card:') === 0) { var id = k.slice(5); if (t.checked) delete p.cardHide[id]; else p.cardHide[id] = 1; }
          else if (t.type === 'checkbox') p[k] = t.checked;
          else p[k] = /^(dur|dayStart)$/.test(k) ? +t.value : t.value;
          if (k === 'holidays' && t.checked) delete d.hidden.holidays;
        });
        return;
      }
      if (t.dataset.ccol || t.dataset.cname) {
        var id = t.dataset.ccol || t.dataset.cname;
        update(function (d) {
          d.cats = cats().map(function (c) {
            if (c.id !== id) return c;
            if (t.dataset.ccol && /^#[0-9a-f]{6}$/i.test(t.value)) c.color = t.value;
            if (t.dataset.cname && t.value.trim()) c.name = t.value.trim().slice(0, 24);
            return c;
          });
        });
        render();
      }
    });
    box.addEventListener('input', function (e) {    /* live colour preview */
      if (e.target.dataset.ccol) e.target.parentNode.style.setProperty('--c', e.target.value);
    });
    box.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-cdel]'))) {
        var id = b.dataset.cdel;
        if (armed !== id) { armed = id; render(); return; }
        armed = null;
        update(function (d) { d.cats = cats().filter(function (c) { return c.id !== id; }); delete d.hidden[id]; });
        render();
      } else if (e.target.closest('[data-cadd]')) {
        var used = cats().map(function (c) { return c.color; });
        var color = SWATCHES.filter(function (c) { return used.indexOf(c) < 0; })[0] || SWATCHES[0];
        var nid = 'c' + C.uid();
        update(function (d) { d.cats = cats().concat([{ id: nid, name: 'New category', color: color }]); });
        render();
        var inp = box.querySelector('[data-cname="' + nid + '"]');
        if (inp) { inp.focus(); inp.select(); }
      }
    });
    return { render: render };
  }

  window.CalSettings = { mount: mount };

  /* Settings → Calendar on the dashboard */
  var home = document.getElementById('csHome');
  if (home) {
    var m = mount(home);
    window.addEventListener('st:page', function (e) { if (e.detail === 'calendar') m.render(); if (e.detail === 'home') summary(); });
    function summary() {
      var s = document.getElementById('sumCalendar');
      if (!s) return;
      var p = C.prefs();
      s.textContent = C.CAT_ORDER.length + ' categories' + (p.weekNums ? ' · week numbers' : '') + (p.holidays ? ' · holidays' : '');
    }
    window.addEventListener('cal:change', summary);
    if (window.Vault) window.Vault.onUnlock(summary);
  }
})();
} catch (e) { console.error("calendar/cal-settings.js", e); }
/* ===== calendar/cal.js ===== */
try {
/* Calendar page: month, week and list views, an event editor and phone calendars.
   Data and repeats come from cal-core.js (window.Cal). */
(function () {
  "use strict";

  var C = window.Cal;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc, dkey = C.dkey, hm = C.hm, day0 = C.day0, addDays = C.addDays;
  var HOUR = 48;                       // px per hour in the week view
  var unlocked = false;

  var view = 'month';
  try { view = localStorage.getItem('dash.calView') || 'month'; } catch (e) {}
  if (['month', 'week', 'list'].indexOf(view) < 0) view = 'month';
  var cur = day0(new Date());          // the day the views are built around
  var sel = dkey(cur);                 // selected day in the month view
  var shown = [];                      // occurrences on screen, by index
  var listDays = 42;
  var weekScrolled = false;

  function data() { return C.load(); }
  function nWeekDays() { return innerWidth < 700 ? 3 : 7; }
  function weekStart() { return nWeekDays() === 7 ? C.monday(cur) : day0(cur); }

  /* ---------- rows used in the day panel and the list ---------- */
  function row(o, onDay) {
    shown.push(o);
    var sub = [];
    if (o.ev.location) sub.push(esc(o.ev.location));
    if (o.ev.trip || o.ev.doc) sub.push('<i class="bi bi-suitcase-lg"></i> Travel');
    else if (o.ev.reminder) sub.push('<i class="bi bi-bell"></i> Reminder');
    else if (o.ev.tool) sub.push('<i class="bi bi-link-45deg"></i> ' + esc(o.ev.tool));
    else if (o.ev.holiday) sub.push('<i class="bi bi-flag"></i> Public holiday');
    else if (o.ev.src) sub.push('<i class="bi bi-phone"></i> ' + esc(o.ev.src));
    else if (o.ev.rule) sub.push('<i class="bi bi-arrow-repeat"></i> Repeats');
    return '<li><button type="button" class="cl-ev" data-occ="' + (shown.length - 1) + '" style="--c:' + o.color + '">' +
      '<span class="t">' + C.timeLabel(o, onDay) + '</span><span class="bar"></span>' +
      '<span class="x"><b>' + esc(o.title) + '</b>' + (sub.length ? '<small>' + sub.join(' · ') + '</small>' : '') + '</span></button></li>';
  }
  /* which days (keys) an occurrence touches, within [from, to) */
  function daysOf(o, from, to) {
    var out = [], d = day0(o.start < from ? from : o.start);
    do { out.push(dkey(d)); d = addDays(d, 1); } while (d < to && d < o.end);
    return out;
  }
  function bucket(list, from, to) {
    var by = {};
    list.forEach(function (o) { daysOf(o, from, to).forEach(function (k) { (by[k] = by[k] || []).push(o); }); });
    return by;
  }

  /* ---------- category / calendar filter ---------- */
  function renderCats() {
    var d = data();
    var items = C.CAT_ORDER.map(function (k) { return { id: k, name: C.CATS[k].name, color: C.CATS[k].color }; })
      .concat(!window.Features || window.Features.on('travel') ? [{ id: 'travel', name: 'Travel', color: C.TRAVEL_COLOR, icon: 'suitcase-lg' }] : [])
      .concat(window.Features && window.Features.events().some(function (e) { return !e.cat; }) ? [{ id: 'reminders', name: 'Reminders', color: window.Features.REMIND_COLOR, icon: 'bell' }] : [])
      .concat(C.prefs(d).holidays ? [{ id: 'holidays', name: 'Holidays', color: C.HOLIDAY_COLOR, icon: 'flag' }] : [])
      .concat(d.feeds.map(function (f) { return { id: 'feed:' + f.id, name: f.name, color: f.color, feed: true }; }));
    /* one row: a Filter button that says what's shown, and the hidden calendars as chips to bring back.
       Everything else lives in the filter panel (switches, "Only" and Show all / Hide all). */
    var shown = items.filter(function (it) { return !d.hidden[it.id]; }), off = items.filter(function (it) { return d.hidden[it.id]; });
    var label = !off.length ? 'All calendars' : shown.length === 1 ? 'Only ' + shown[0].name : !shown.length ? 'Nothing shown' : shown.length + ' of ' + items.length;
    var row = function (it) {
      return '<div class="clf-row' + (d.hidden[it.id] ? ' off' : '') + '" style="--c:' + it.color + '"><i class="dot"></i>' + (it.feed ? '<i class="bi bi-phone"></i>' : it.icon ? '<i class="bi bi-' + it.icon + '"></i>' : '') +
        '<span class="clf-name">' + esc(it.name) + '</span><button type="button" class="text-btn clf-only" data-only="' + esc(it.id) + '">Only</button>' +
        '<input type="checkbox" class="switch" data-catsw="' + esc(it.id) + '"' + (d.hidden[it.id] ? '' : ' checked') + ' aria-label="Show ' + esc(it.name) + '"></div>';
    };
    var groups = [['Your calendars', items.filter(function (it) { return C.CATS[it.id]; })], ['From the dashboard', items.filter(function (it) { return /^(travel|reminders|holidays)$/.test(it.id); })], ['Phone calendars', items.filter(function (it) { return it.feed; })]];
    $('clCats').innerHTML = '<button type="button" class="cl-filter' + (off.length ? ' on' : '') + '" data-clfilter aria-expanded="' + filterOpen + '"><i class="bi bi-funnel' + (off.length ? '-fill' : '') + '"></i> ' + esc(label) + ' <i class="bi bi-chevron-' + (filterOpen ? 'up' : 'down') + '"></i></button>' +
      off.map(function (it) { return '<button type="button" class="cl-cat" data-cat="' + esc(it.id) + '" aria-pressed="false" style="--c:' + it.color + '" title="Show ' + esc(it.name) + '"><i class="dot"></i>' + esc(it.name) + '</button>'; }).join('') +
      (filterOpen ? '<div class="clf-panel" role="group" aria-label="Filter calendars"><div class="clf-top"><button type="button" class="text-btn" data-clall="show">Show all</button><button type="button" class="text-btn" data-clall="hide">Hide all</button></div>' +
        groups.filter(function (g) { return g[1].length; }).map(function (g) { return '<p class="clf-h">' + g[0] + '</p>' + g[1].map(row).join(''); }).join('') + '</div>' : '');
    renderCats.items = items;
  }
  var filterOpen = false;

  /* ---------- month ---------- */
  var F_DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  function renderMonth() {
    var first = new Date(cur.getFullYear(), cur.getMonth(), 1);
    var start = C.monday(first), last = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    var end = addDays(C.monday(last), 7);
    var by = bucket(C.occurrences(start, end), start, end);
    var today = dkey(new Date()), wn = C.prefs().weekNums;
    $('clTitle').textContent = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    var h = '<div class="cl-month' + (wn ? ' has-wk' : '') + '">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (w) {
      return '<div class="cl-wd">' + w + '</div>';
    }).join('');
    for (var d = start; d < end; d = addDays(d, 1)) {
      var k = dkey(d), list = by[k] || [];
      var cls = 'cl-cell' + (d.getMonth() !== first.getMonth() ? ' out' : '') + (k === today ? ' today' : '') + (k === sel ? ' sel' : '');
      var label = F_DAY.format(d) + (list.length ? ', ' + list.length + ' event' + (list.length > 1 ? 's' : '') : '');
      h += '<button type="button" class="' + cls + '" data-day="' + k + '" aria-label="' + label + '"' + (k === sel ? ' aria-pressed="true"' : '') + '>' +
        '<span class="cl-num">' + d.getDate() + '</span>' + (wn && d.getDay() === 1 ? '<span class="cl-wkno" aria-hidden="true">W' + C.isoWeek(d) + '</span>' : '') +
        '<span class="cl-chips">' + list.slice(0, 3).map(function (o) {
          var t = o.allDay || !C.sameDay(o.start, d) ? '' : '<b>' + hm(o.start) + '</b> ';
          return '<span class="cl-chip' + (o.allDay ? ' full' : '') + '" style="--c:' + o.color + '">' + t + esc(o.title) + '</span>';
        }).join('') + (list.length > 3 ? '<span class="cl-more">+' + (list.length - 3) + ' more</span>' : '') + '</span>' +
        '<span class="cl-dots">' + list.slice(0, 4).map(function (o) { return '<i style="--c:' + o.color + '"></i>'; }).join('') + '</span>' +
        '</button>';
    }
    $('clView').innerHTML = h + '</div>';
    renderDay(by);
  }

  function renderDay(by) {
    var box = $('clDay');
    box.hidden = view !== 'month';
    if (box.hidden) return;
    var d = C.fromKey(sel), list = by && by[sel];
    if (!list) list = C.occurrences(d, addDays(d, 1));
    box.innerHTML = '<div class="card-head"><h2>' + esc(C.dayLabel(d, true)) + '</h2>' +
      '<button class="text-btn" type="button" data-new-day="' + sel + '"><i class="bi bi-plus-lg"></i> Add</button></div>' +
      (list.length ? '<ul class="cl-agenda">' + list.map(function (o) { return row(o, d); }).join('') + '</ul>'
        : '<p class="empty">Nothing planned.</p>');
  }

  /* ---------- week (or 3 days on a phone) ---------- */
  function renderWeek() {
    var n = nWeekDays(), start = weekStart(), end = addDays(start, n);
    var list = C.occurrences(start, end), today = dkey(new Date()), now = new Date();
    var endShown = addDays(start, n - 1);
    $('clTitle').textContent = start.getMonth() === endShown.getMonth()
      ? start.getDate() + '–' + endShown.getDate() + ' ' + endShown.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      : start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – ' + endShown.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (C.prefs().weekNums) {
      var w1 = C.isoWeek(start), w2 = C.isoWeek(endShown);
      $('clTitle').innerHTML = esc($('clTitle').textContent) + ' <span class="cl-wk-tag">Week ' + w1 + (w2 !== w1 ? '–' + w2 : '') + '</span>';
    }

    var days = [];
    for (var i = 0; i < n; i++) days.push(addDays(start, i));
    var allDay = days.map(function () { return []; }), timed = days.map(function () { return []; });
    list.forEach(function (o) {
      days.forEach(function (d, i) {
        var a = d, b = addDays(d, 1);
        if (!(o.start < b && (o.end > a || (+o.end === +o.start && o.start >= a)))) return;
        var s = o.start < a ? a : o.start, e = o.end > b ? b : o.end;
        if (o.allDay || (s <= a && e >= b)) allDay[i].push(o);
        else timed[i].push({ o: o, s: s, e: e });
      });
    });

    var head = '<div class="cl-gut"></div>' + days.map(function (d) {
      var k = dkey(d);
      return '<button type="button" class="cl-wk-day' + (k === today ? ' today' : '') + '" data-goto="' + k + '"><span>' +
        d.toLocaleDateString('en-GB', { weekday: 'short' }) + '</span><b>' + d.getDate() + '</b></button>';
    }).join('');
    var hasAll = allDay.some(function (x) { return x.length; });
    var all = !hasAll ? '' : '<div class="cl-wk-all"><div class="cl-gut">all-day</div>' + allDay.map(function (x) {
      return '<div class="cl-wk-allcol">' + x.map(function (o) {
        shown.push(o);
        return '<button type="button" class="cl-chip full" data-occ="' + (shown.length - 1) + '" style="--c:' + o.color + '">' + esc(o.title) + '</button>';
      }).join('') + '</div>';
    }).join('') + '</div>';

    var hours = '';
    for (var hh = 0; hh < 24; hh++) hours += '<span style="top:' + hh * HOUR + 'px">' + (hh ? String(hh).padStart(2, '0') + ':00' : '') + '</span>';
    var cols = timed.map(function (segs, i) {
      layout(segs);
      var k = dkey(days[i]);
      var h = '<div class="cl-wk-col' + (k === today ? ' today' : '') + '" data-col="' + k + '">';
      segs.forEach(function (x) {
        shown.push(x.o);
        var top = (x.s - days[i]) / 36e5 * HOUR, ht = Math.max((x.e - x.s) / 36e5 * HOUR, 22);
        h += '<button type="button" class="cl-blk' + (ht < 40 ? ' short' : '') + '" data-occ="' + (shown.length - 1) + '" style="--c:' + x.o.color +
          ';top:' + top + 'px;height:' + (ht - 2) + 'px;left:calc(' + x.col / x.cols * 100 + '% + 2px);width:calc(' + 100 / x.cols + '% - 4px)">' +
          '<b>' + esc(x.o.title) + '</b><span class="tm">' + C.timeLabel(x.o, days[i]) + (x.o.ev.location ? ' · ' + esc(x.o.ev.location) : '') + '</span></button>';
      });
      if (k === today) h += '<div class="cl-now" style="top:' + ((now - days[i]) / 36e5 * HOUR) + 'px"></div>';
      return h + '</div>';
    }).join('');

    var sc = $('clWkScroll'), keep = sc ? sc.scrollTop : null;
    $('clView').innerHTML = '<div class="cl-week" style="--n:' + n + '">' +
      '<div class="cl-wk-head">' + head + '</div>' + all +
      '<div class="cl-wk-scroll" id="clWkScroll"><div class="cl-wk-grid" style="height:' + 24 * HOUR + 'px">' +
      '<div class="cl-gut cl-hours">' + hours + '</div>' + cols + '</div></div></div>';
    sc = $('clWkScroll');
    if (keep !== null && weekScrolled) sc.scrollTop = keep;
    else {
      var inView = list.length ? Math.min.apply(null, timed.reduce(function (a, s) { return a.concat(s.map(function (x) { return x.s.getHours(); })); }, [24])) : 24;
      var showNow = days.some(function (d) { return dkey(d) === today; }) ? now.getHours() - 1 : 24;
      sc.scrollTop = Math.max(0, Math.max(0, Math.min(C.prefs().dayStart, inView, showNow)) * HOUR - 10);
      weekScrolled = true;
    }
  }
  /* side by side when events overlap */
  function layout(segs) {
    segs.sort(function (a, b) { return a.s - b.s || b.e - a.e; });
    var group = [], ends = [], groupEnd = 0;
    function close() { group.forEach(function (x) { x.cols = ends.length; }); group = []; ends = []; }
    segs.forEach(function (x) {
      var e = Math.max(+x.e, +x.s + 30 * 60e3);
      if (group.length && +x.s >= groupEnd) close();
      var c = ends.findIndex(function (t) { return t <= +x.s; });
      if (c < 0) { c = ends.length; ends.push(e); } else ends[c] = e;
      x.col = c; group.push(x); groupEnd = Math.max(groupEnd, e);
    });
    close();
  }

  /* ---------- list ---------- */
  function renderList() {
    var start = day0(cur), end = addDays(start, listDays);
    var by = bucket(C.occurrences(start, end), start, end);
    var keys = Object.keys(by).sort();
    $('clTitle').textContent = C.sameDay(start, new Date()) ? 'Upcoming' : 'From ' + start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    $('clView').innerHTML = (keys.length ? keys.map(function (k) {
      var d = C.fromKey(k);
      return '<section class="cl-lday"><h3>' + esc(C.dayLabel(d, true)) + '</h3><ul class="cl-agenda">' +
        by[k].map(function (o) { return row(o, d); }).join('') + '</ul></section>';
    }).join('') : '<p class="empty cl-none">Nothing planned in the next ' + Math.round(listDays / 7) + ' weeks.</p>') +
      '<button type="button" class="text-btn cl-more-btn" id="clMore">Show ' + (keys.length ? 'more' : '6 more weeks') + '</button>';
  }

  function render() {
    if (!unlocked) return;
    shown = [];
    document.querySelectorAll('#clViews [data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
    $('fp').setAttribute('data-cl-view', view);
    renderCats();
    if (view === 'month') renderMonth();
    else if (view === 'week') renderWeek();
    else renderList();
    if (view !== 'month') $('clDay').hidden = true;
    renderFeeds();
  }

  /* ---------- navigation ---------- */
  function step(dir) {
    if (view === 'month') {
      cur = new Date(cur.getFullYear(), cur.getMonth() + dir, 1);
      var s = C.fromKey(sel);
      if (s.getMonth() !== cur.getMonth() || s.getFullYear() !== cur.getFullYear()) {
        var t = new Date();
        sel = dkey(t.getMonth() === cur.getMonth() && t.getFullYear() === cur.getFullYear() ? t : cur);
      }
    } else if (view === 'week') cur = addDays(cur, dir * nWeekDays());
    else cur = addDays(cur, dir * 7);
    render();
  }
  function setView(v) {
    view = v;
    try { localStorage.setItem('dash.calView', v); } catch (e) {}
    cur = C.fromKey(sel);
    weekScrolled = false;
    render();
  }
  $('clPrev').addEventListener('click', function () { step(-1); });
  $('clNext').addEventListener('click', function () { step(1); });
  $('clToday').addEventListener('click', function () { cur = day0(new Date()); sel = dkey(cur); weekScrolled = false; listDays = 42; render(); });
  $('clViews').addEventListener('click', function (e) { var b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  $('clNew').addEventListener('click', function () { openEditor(null, { date: view === 'month' ? sel : dkey(view === 'week' ? (sameWeekToday() ? new Date() : weekStart()) : new Date()) }); });
  function sameWeekToday() { var s = weekStart(), t = new Date(); return t >= s && t < addDays(s, nWeekDays()); }

  $('clCats').addEventListener('click', function (e) {
    var d = data(), b;
    if (e.target.closest('[data-clfilter]')) { filterOpen = !filterOpen; renderCats(); return; }
    if ((b = e.target.closest('[data-only]'))) {
      var id = b.dataset.only, items = renderCats.items || [], solo = items.every(function (it) { return it.id === id ? !d.hidden[it.id] : d.hidden[it.id]; });
      d.hidden = {}; if (!solo) items.forEach(function (it) { if (it.id !== id) d.hidden[it.id] = 1; });   // tap again: everything back
      C.save(d); return;
    }
    if ((b = e.target.closest('[data-clall]'))) { d.hidden = {}; if (b.dataset.clall === 'hide') (renderCats.items || []).forEach(function (it) { d.hidden[it.id] = 1; }); C.save(d); return; }
    if ((b = e.target.closest('[data-cat]'))) { if (d.hidden[b.dataset.cat]) delete d.hidden[b.dataset.cat]; else d.hidden[b.dataset.cat] = 1; C.save(d); }
  });
  $('clCats').addEventListener('change', function (e) {
    var sw = e.target.closest('[data-catsw]'); if (!sw) return;
    var d = data(); if (sw.checked) delete d.hidden[sw.dataset.catsw]; else d.hidden[sw.dataset.catsw] = 1; C.save(d);
  });
  document.addEventListener('click', function (e) { if (filterOpen && e.target.isConnected && !e.target.closest('#clCats')) { filterOpen = false; renderCats(); } });
  document.addEventListener('keydown', function (e) { if (filterOpen && e.key === 'Escape') { filterOpen = false; renderCats(); var f = document.querySelector('[data-clfilter]'); if (f) f.focus(); } });

  $('clView').addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-occ]'))) return openEditor(shown[+t.dataset.occ]);
    if ((t = e.target.closest('[data-day]'))) {
      if (t.dataset.day === sel && e.detail === 2) return openEditor(null, { date: sel });   // double click: new event
      sel = t.dataset.day;
      var d = C.fromKey(sel);
      if (d.getMonth() !== cur.getMonth()) cur = new Date(d.getFullYear(), d.getMonth(), 1);
      render();
      if (innerWidth < 700) $('clDay').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    if ((t = e.target.closest('[data-goto]'))) { sel = t.dataset.goto; cur = C.fromKey(sel); return setView('month'); }
    if (e.target.id === 'clMore') { listDays += 42; return render(); }
    if ((t = e.target.closest('[data-col]'))) {
      var y = e.clientY - t.getBoundingClientRect().top;
      return openEditor(null, { date: t.dataset.col, hour: Math.max(0, Math.min(23, Math.floor(y / HOUR))) });
    }
  });
  $('clDay').addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-occ]'))) return openEditor(shown[+t.dataset.occ]);
    if ((t = e.target.closest('[data-new-day]'))) return openEditor(null, { date: t.dataset.newDay });
  });

  /* swipe left/right on a phone */
  var touch = null;
  $('clView').addEventListener('touchstart', function (e) { var p = e.touches[0]; touch = { x: p.clientX, y: p.clientY, t: Date.now() }; }, { passive: true });
  $('clView').addEventListener('touchend', function (e) {
    if (!touch || view === 'list') return;
    var p = e.changedTouches[0], dx = p.clientX - touch.x, dy = p.clientY - touch.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - touch.t < 600) step(dx < 0 ? 1 : -1);
    touch = null;
  }, { passive: true });

  document.addEventListener('keydown', function (e) {
    if (!unlocked) return;
    if (e.key === 'Escape' && !$('clSheetBg').hidden) return closeEditor();
    if (!$('clSheetBg').hidden || /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 't') $('clToday').click();
    else if (e.key === 'n') { e.preventDefault(); $('clNew').click(); }
  });

  /* ---------- editor ---------- */
  var editing = null;        // { own event object or null, occDate, readOnly }
  var routeFor = null;       // the occurrence the "Get there" button is for

  /* Calendar -> journey planner: arrive in time for this event */
  function routeTo(o, place) {
    if (!window.Flow || !o) return;
    var buffer = (o.ev.buffer || 0) * 60e3;
    window.Flow.route({ toText: place || o.ev.location, arriveBy: new Date(o.start.getTime() - buffer),
      context: { title: o.title, note: buffer ? 'be there ' + (o.ev.buffer) + ' min before ' + hm(o.start) : 'starts ' + hm(o.start) } });
  }
  $('clRead').addEventListener('click', function (e) { if (e.target.closest('[data-route]')) routeTo(routeFor); });
  $('clRoute').addEventListener('click', function () {
    var place = $('clLoc').value.trim();
    if (!place) return;
    var o = routeFor;
    if (!o || !o.ev.own) {          // a new, unsaved event: use what's in the form
      var t = ($('clStart').value || '09:00').split(':'), d = C.fromKey($('clDate').value || dkey(new Date()));
      o = { start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), +t[0], +t[1]), title: $('clTitleIn').value.trim() || place, ev: {} };
    }
    routeTo(o, place);
  });
  $('clLoc').addEventListener('input', function () { $('clRoute').hidden = !this.value.trim() || $('clAllDay').checked; });
  $('clRepeat').innerHTML = Object.keys(C.REPEAT_NAMES).map(function (k) { return '<option value="' + k + '">' + C.REPEAT_NAMES[k] + '</option>'; }).join('');
  function catButtons() {
    $('clCatSeg').innerHTML = C.CAT_ORDER.map(function (k) {
      return '<button type="button" data-ecat="' + esc(k) + '" style="--c:' + C.CATS[k].color + '"><i class="dot"></i>' + esc(C.CATS[k].name) + '</button>';
    }).join('');
  }
  var ecat = 'work';
  function setCat(k) {
    ecat = k;
    document.querySelectorAll('[data-ecat]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.ecat === k)); });
  }
  $('clCatSeg').addEventListener('click', function (e) { var b = e.target.closest('[data-ecat]'); if (b) setCat(b.dataset.ecat); });

  function syncFields() {
    var all = $('clAllDay').checked;
    $('clStart').hidden = all; $('clStop').hidden = all; $('clEndDate').hidden = !all;
    $('clStart').required = !all;
    $('clUntilRow').hidden = !$('clRepeat').value;
  }
  $('clAllDay').addEventListener('change', syncFields);
  $('clRepeat').addEventListener('change', syncFields);
  $('clUntilClear').addEventListener('click', function () { $('clUntil').value = ''; });
  /* keep the length when the start moves */
  var lastStart = '';
  $('clStart').addEventListener('focus', function () { lastStart = this.value; });
  $('clStart').addEventListener('change', function () {
    var a = toMin(lastStart), b = toMin($('clStop').value), s = toMin(this.value);
    if (a !== null && b !== null && s !== null) $('clStop').value = fromMin(s + ((b - a + 1440) % 1440 || 60));
    lastStart = this.value;
  });
  $('clDate').addEventListener('change', function () {
    if (!$('clEndDate').value || $('clEndDate').value < this.value) $('clEndDate').value = this.value;
  });
  function toMin(v) { var m = /^(\d{2}):(\d{2})$/.exec(v || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function fromMin(n) { n = ((n % 1440) + 1440) % 1440; return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }

  function openEditor(o, preset) {
    preset = preset || {};
    var bg = $('clSheetBg');
    $('clDelAsk').hidden = true;
    if (o && o.ev.readOnly) {
      editing = { readOnly: true };
      $('clEdit').hidden = true; $('clRead').hidden = false; $('clSave').hidden = true;
      $('clCancel').textContent = 'Close';
      $('clSheetTitle').textContent = 'Event';
      $('clRead').innerHTML = '<h3 style="--c:' + o.color + '"><i class="dot"></i>' + esc(o.title) + '</h3>' +
        '<p><i class="bi bi-clock"></i> ' + esc(C.dayLabel(o.start, true)) + '<br><span class="muted">' + C.timeLabel(o) +
        (o.allDay && o.ev.days > 1 ? ' · ' + o.ev.days + ' days' : '') + (o.ev.rule ? ' · repeats' : '') + '</span></p>' +
        (o.ev.location ? '<p><i class="bi bi-geo-alt"></i> ' + esc(o.ev.location) + '</p>' : '') +
        (o.ev.notes ? '<p class="cl-notes">' + esc(o.ev.notes) + '</p>' : '') +
        '<div class="cl-acts">' + (o.ev.location && !o.allDay ? '<button type="button" class="pill-btn" data-route>' +
          '<i class="bi bi-signpost-split"></i> Get there on time</button>' : '') +
        (o.ev.trip ? '<a class="pill-btn ghost" href="../travel/#trip=' + encodeURIComponent(o.ev.trip) + '"><i class="bi bi-suitcase-lg"></i> Open trip</a>' : '') +
        (o.ev.doc ? '<a class="pill-btn ghost" href="../travel/#docs"><i class="bi bi-person-vcard"></i> Travel documents</a>' : '') +
        ((o.ev.reminder || o.ev.tool) && o.ev.link ? '<a class="pill-btn ghost" href="' + esc(o.ev.link) + '"><i class="bi bi-box-arrow-up-right"></i> Open</a>' : '') + '</div>' +
        (o.ev.tool ? '<p class="muted cl-src"><i class="bi bi-link-45deg"></i> From your ' + esc(o.ev.tool) + ' – change it there.</p>'
          : o.ev.holiday ? '<p class="muted cl-src"><i class="bi bi-flag"></i> Norwegian public holiday. Turn off in Calendar settings.</p>'
          : o.ev.reminder ? '<p class="muted cl-src"><i class="bi bi-bell"></i> A reminder from your tools (Settings → Features).</p>'
          : o.ev.trip || o.ev.doc ? '<p class="muted cl-src"><i class="bi bi-suitcase-lg"></i> Planned on the Travel page.</p>'
          : '<p class="muted cl-src"><i class="bi bi-phone"></i> From “' + esc(o.ev.src) + '”. Change it in that calendar.</p>');
      routeFor = o;
    } else {
      var e = o ? o.ev.own : null;
      editing = { own: e, occDate: o ? dkey(o.start) : null };
      routeFor = o;
      $('clEdit').hidden = false; $('clRead').hidden = true; $('clSave').hidden = false;
      $('clCancel').textContent = 'Cancel';
      $('clSheetTitle').textContent = e ? 'Edit event' : 'New event';
      var date = preset.date || dkey(new Date());
      var startH = preset.hour != null ? preset.hour
        : (date === dkey(new Date()) ? Math.min(new Date().getHours() + 1, 23) : 9);
      var pf = C.prefs(), last = pf.cat;
      if (last === 'last') { try { last = localStorage.getItem('dash.calLastCat') || ''; } catch (x) {} }
      catButtons();
      $('clTitleIn').value = e ? e.title : '';
      setCat(e ? C.catOf(e.cat) : (C.CATS[last] ? last : C.CAT_ORDER[0]));
      $('clAllDay').checked = e ? !!e.allDay : false;
      $('clDate').value = e ? e.date : date;
      $('clEndDate').value = e ? (e.end || e.date) : date;
      $('clStart').value = e ? (e.start || '09:00') : fromMin(startH * 60);
      $('clStop').value = e ? (e.stop || fromMin(toMin(e.start || '09:00') + 60)) : fromMin(Math.min(startH * 60 + pf.dur, 23 * 60 + 55));
      $('clRepeat').value = e ? (e.repeat || '') : '';
      $('clUntil').value = e ? (e.until || '') : '';
      $('clLoc').value = e ? (e.location || '') : '';
      $('clNotes').value = e ? (e.notes || '') : '';
      $('clDelBox').hidden = !e;
      syncFields();
      $('clRoute').hidden = !$('clLoc').value.trim() || $('clAllDay').checked;
    }
    bg.hidden = false;
    requestAnimationFrame(function () { bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
    if (!o && innerWidth >= 700) setTimeout(function () { $('clTitleIn').focus(); }, 60);
  }
  function closeEditor() {
    var bg = $('clSheetBg');
    bg.classList.remove('open');
    document.documentElement.classList.remove('cl-modal');
    setTimeout(function () { bg.hidden = true; }, 220);
    editing = null;
  }
  $('clCancel').addEventListener('click', closeEditor);
  $('clSheetBg').addEventListener('click', function (e) { if (e.target === this) closeEditor(); });

  $('clSheet').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!editing || editing.readOnly) return closeEditor();
    var title = $('clTitleIn').value.trim();
    if (!title) { $('clTitleIn').focus(); return; }
    var all = $('clAllDay').checked, date = $('clDate').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('clDate').focus(); return; }
    var ev = {
      id: editing.own ? editing.own.id : C.uid(), title: title.slice(0, 120), cat: ecat, date: date, allDay: all,
      repeat: $('clRepeat').value, location: $('clLoc').value.trim().slice(0, 160), notes: $('clNotes').value.trim().slice(0, 2000)
    };
    if (all) {
      var end = $('clEndDate').value;
      if (end && end > date) ev.end = end;
    } else {
      ev.start = /^\d{2}:\d{2}$/.test($('clStart').value) ? $('clStart').value : '09:00';
      ev.stop = /^\d{2}:\d{2}$/.test($('clStop').value) ? $('clStop').value : fromMin(toMin(ev.start) + 60);
    }
    if (ev.repeat && $('clUntil').value >= date) ev.until = $('clUntil').value;
    if (!ev.repeat) { delete ev.repeat; }
    if (editing.own && editing.own.skip && ev.repeat) ev.skip = editing.own.skip;
    var d = data();
    var i = d.events.findIndex(function (x) { return x.id === ev.id; });
    if (i > -1) d.events[i] = ev; else d.events.push(ev);
    try { localStorage.setItem('dash.calLastCat', ecat); } catch (x) {}
    if (d.hidden[ecat]) delete d.hidden[ecat];       // don't let a new event vanish behind a filter
    sel = editing.occDate && editing.own && editing.own.date === date ? editing.occDate : date;
    if (view === 'month') { var s = C.fromKey(sel); cur = new Date(s.getFullYear(), s.getMonth(), 1); }
    closeEditor();
    C.save(d);
  });

  $('clDelete').addEventListener('click', function () {
    if (!editing || !editing.own) return;
    if (editing.own.repeat) { $('clDelAsk').hidden = false; return; }
    removeEvent(false);
  });
  $('clDelOne').addEventListener('click', function () { removeEvent(true); });
  $('clDelAll').addEventListener('click', function () { removeEvent(false); });
  function removeEvent(onlyThis) {
    var d = data(), id = editing.own.id, occ = editing.occDate;
    var i = d.events.findIndex(function (x) { return x.id === id; });
    if (i > -1) {
      if (onlyThis && occ) {
        var e = d.events[i];
        e.skip = (e.skip || []).filter(function (k) { return k >= dkey(addDays(new Date(), -400)); });
        if (e.skip.indexOf(occ) < 0) e.skip.push(occ);
      } else d.events.splice(i, 1);
    }
    closeEditor();
    C.save(d);
  }

  /* ---------- phone calendars ---------- */
  function ago(t) {
    if (!t) return '';
    var m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  var removing = null;
  function renderFeeds() {
    var d = data();
    $('clFeedList').innerHTML = d.feeds.map(function (f) {
      var st = C.feedState(f.id) || {};
      var status = st.loading ? '<span class="muted"><i class="bi bi-arrow-repeat spin-i"></i> Loading…</span>'
        : st.error ? '<span class="cl-err"><i class="bi bi-exclamation-circle"></i> ' + esc(st.error) + '</span>'
        : st.events ? '<span class="muted">' + st.events.length + ' event' + (st.events.length === 1 ? '' : 's') + ' · updated ' + ago(st.at) + '</span>'
        : '<span class="muted">Not loaded yet</span>';
      return '<li><button type="button" class="cl-swatch" data-recolor="' + f.id + '" style="--c:' + f.color + '" aria-label="Change colour"></button>' +
        '<div class="x"><b>' + esc(f.name) + '</b>' + status + '</div>' +
        '<button type="button" class="text-btn danger" data-remove="' + f.id + '">' + (removing === f.id ? 'Remove?' : 'Remove') + '</button></li>';
    }).join('');
    $('clFeedRefresh').hidden = !d.feeds.length;
  }
  $('clFeedList').addEventListener('click', function (e) {
    var t, d = data();
    if ((t = e.target.closest('[data-recolor]'))) {
      var f = d.feeds.find(function (x) { return x.id === t.dataset.recolor; });
      if (!f) return;
      var i = C.FEED_COLORS.indexOf(f.color);
      f.color = C.FEED_COLORS[(i + 1) % C.FEED_COLORS.length];
      C.save(d);
    } else if ((t = e.target.closest('[data-remove]'))) {
      if (removing !== t.dataset.remove) { removing = t.dataset.remove; renderFeeds(); return; }
      d.feeds = d.feeds.filter(function (x) { return x.id !== removing; });
      delete d.hidden['feed:' + removing];
      try { sessionStorage.removeItem('dash.calfeed.' + removing); } catch (x) {}
      removing = null;
      C.save(d);
    }
  });
  $('clFeedRefresh').addEventListener('click', function () { C.refreshFeeds(true); });
  $('clFeedForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var url = $('clFeedUrl').value.trim(), msg = $('clFeedMsg');
    if (!/^(webcals?|https):\/\/\S+$/i.test(url)) { msg.textContent = 'Paste the whole link. It starts with webcal:// or https://'; return; }
    var host = '';
    try { host = new URL(url.replace(/^webcals?:/i, 'https:')).hostname; } catch (x) {}
    if (!/(icloud\.com|google\.com|outlook\.(office365|office|live)\.com)$/i.test(host)) { msg.textContent = 'Only iCloud, Google and Outlook calendar links work here.'; return; }
    var d = data();
    if (d.feeds.some(function (f) { return f.url === url; })) { msg.textContent = 'That calendar is already added.'; return; }
    var used = d.feeds.map(function (f) { return f.color; });
    var f = {
      id: C.uid(), url: url,
      name: $('clFeedName').value.trim().slice(0, 40) || (/icloud/i.test(host) ? 'iPhone' : /google/i.test(host) ? 'Google' : 'Outlook'),
      color: C.FEED_COLORS.find(function (c) { return used.indexOf(c) < 0; }) || C.FEED_COLORS[d.feeds.length % C.FEED_COLORS.length]
    };
    d.feeds.push(f);
    C.save(d);
    $('clFeedName').value = ''; $('clFeedUrl').value = '';
    msg.textContent = 'Loading “' + f.name + '”…';
    C.fetchFeed(f).then(function () {
      var st = C.feedState(f.id) || {};
      msg.textContent = st.error ? '' : 'Added “' + f.name + '” with ' + (st.events || []).length + ' events.';
      window.dispatchEvent(new Event('cal:change'));
    });
    renderFeeds();
  });

  /* ---------- calendar settings (gear) ---------- */
  var csBox = $('csBox'), cs = csBox && window.CalSettings ? window.CalSettings.mount(csBox) : null;
  function openSettings() {
    if (!cs) return;
    cs.render();
    var bg = $('csBg'); bg.hidden = false;
    requestAnimationFrame(function () { bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
  }
  function closeSettings() {
    var bg = $('csBg'); if (!bg || bg.hidden) return;
    bg.classList.remove('open');
    document.documentElement.classList.remove('cl-modal');
    setTimeout(function () { bg.hidden = true; }, 220);
  }
  if (cs) {
    $('clSettings').addEventListener('click', openSettings);
    $('csDone').addEventListener('click', closeSettings);
    $('csBg').addEventListener('click', function (e) { if (e.target === this) closeSettings(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSettings(); });
  }

  /* ---------- wiring ---------- */
  window.addEventListener('cal:change', render);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); C.refreshFeeds(false); };
  var lastW = innerWidth;
  window.addEventListener('resize', function () {
    if ((lastW < 700) !== (innerWidth < 700) && view === 'week') { weekScrolled = false; render(); }
    lastW = innerWidth;
  });
  /* keep "today" and the now-line current */
  setInterval(function () { if (unlocked && $('clSheetBg').hidden) render(); }, 60000);

  function fromHash() {
    var h = location.hash;
    if (!h) return;
    var m = h.match(/^#d=(\d{4}-\d{2}-\d{2})$/);
    history.replaceState(null, '', location.pathname);
    if (m) { sel = m[1]; cur = C.fromKey(sel); if (view !== 'month') { cur = C.fromKey(sel); } render(); }
    if (h === '#new') openEditor(null, { date: sel });
  }
  window.addEventListener('hashchange', fromHash);

  if (window.Vault) {
    window.Vault.onUnlock(function () {
      unlocked = true;
      var pv = C.prefs().view;
      if (pv !== 'last' && !location.hash) view = pv;
      render(); fromHash(); C.refreshFeeds(false);
    });
    window.Vault.onLock(function () { unlocked = false; closeEditor(); });
  }
})();
} catch (e) { console.error("calendar/cal.js", e); }
/* ===== profile.js ===== */
try {
/* Your profile: photo, details you use across the dashboard, and your socials.
   Stored in "dash.profile" (synced and encrypted with your passcode).
   - the avatar in the top corner opens Profile & settings
   - home and office address become Home / Work in Travel
   - normal working day is the one Flex time uses
   - your birthday goes in the calendar
   - socials you mark as public can be published to jplundberg.com */
(function () {
  "use strict";
  var KEY = 'dash.profile';
  var $ = function (id) { return document.getElementById(id); };
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var NETS = {
    linkedin: { name: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/{h}/', host: 'linkedin.com' },
    instagram: { name: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/{h}/', host: 'instagram.com' },
    facebook: { name: 'Facebook', icon: 'facebook', url: 'https://www.facebook.com/{h}', host: 'facebook.com' },
    tiktok: { name: 'TikTok', icon: 'tiktok', url: 'https://www.tiktok.com/@{h}', host: 'tiktok.com' },
    x: { name: 'X', icon: 'twitter-x', url: 'https://x.com/{h}', host: 'x.com' },
    threads: { name: 'Threads', icon: 'threads', url: 'https://www.threads.net/@{h}', host: 'threads.net' },
    youtube: { name: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com/@{h}', host: 'youtube.com' },
    snapchat: { name: 'Snapchat', icon: 'snapchat', url: 'https://www.snapchat.com/add/{h}', host: 'snapchat.com' },
    strava: { name: 'Strava', icon: 'strava', url: 'https://www.strava.com/athletes/{h}', host: 'strava.com' },
    github: { name: 'GitHub', icon: 'github', url: 'https://github.com/{h}', host: 'github.com' }
  };
  /* the two already on jplundberg.com */
  var START_SOCIALS = [
    { net: 'linkedin', handle: 'john-paul-lundberg-8a804623b', pub: true },
    { net: 'instagram', handle: 'jp.lundberg.official', pub: true }
  ];
  function socialUrl(s) {
    var N = NETS[s.net], h = String(s.handle || '').trim();
    if (!N || !h) return '';
    if (/^https:\/\//i.test(h)) {
      try { var u = new URL(h); return (u.hostname === N.host || u.hostname.slice(-N.host.length - 1) === '.' + N.host) ? u.href : ''; } catch (e) { return ''; }
    }
    h = h.replace(/^@/, '').replace(/[^\w.\-]/g, '');
    return h ? N.url.replace('{h}', h) : '';
  }

  function load() {
    var p = readJSON(KEY);
    p = p && typeof p === 'object' ? p : {};
    if (!Array.isArray(p.socials)) {
      p.socials = START_SOCIALS.map(function (s) { return Object.assign({ id: uid() }, s); });
      if (window.Vault && document.documentElement.classList.contains('unlocked')) {      /* keep the same ids from now on */
        try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
      }
    }
    return p;
  }
  function save(p) {
    var before = null;
    try { before = JSON.stringify((JSON.parse(localStorage.getItem(KEY)) || {}).socials || null); } catch (e) {}
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));
    window.dispatchEvent(new Event('profile:change'));
    if (before !== JSON.stringify(p.socials || null)) window.dispatchEvent(new Event('socials:change'));
  }
  function initials(p) {
    var n = String(p.name || (readJSON('dash.settings') || {}).name || '').trim().split(/\s+/).filter(Boolean);
    return n.length ? (n[0][0] + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase() : '';
  }
  function avatar(p, cls) {
    p = p || load();
    return '<span class="me-av ' + (cls || '') + '">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="">' :
      (initials(p) ? '<b>' + esc(initials(p)) + '</b>' : '<i class="bi bi-person"></i>')) + '</span>';
  }
  function age(k) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k || '')) return null;
    var b = k.split('-').map(Number), t = new Date(), a = t.getFullYear() - b[0];
    if (t.getMonth() + 1 < b[1] || (t.getMonth() + 1 === b[1] && t.getDate() < b[2])) a--;
    return a;
  }

  /* ---------- the avatar button(s) ---------- */
  function paintButtons() {
    var p = load();
    document.querySelectorAll('[data-me]').forEach(function (b) { b.innerHTML = avatar(p); });
  }
  /* other pages: a small avatar in the top corner that opens Profile & settings */
  var main = $('fp');
  if (main && !$('settingsBtn')) {
    var a = document.createElement('a');
    a.className = 'me-btn me-sub'; a.href = '/cmd/?settings'; a.setAttribute('data-me', '');
    a.addEventListener('click', function () { try { sessionStorage.setItem('dash.stFrom', location.pathname); } catch (e) {} });
    a.setAttribute('aria-label', 'Profile and settings');
    /* in the page's top row (same height as on the dashboard, below the iPhone status bar) */
    var host = document.querySelector('#fp > .fp-top');
    if (host) { a.classList.add('me-in'); host.appendChild(a); } else document.body.appendChild(a);
  }
  window.addEventListener('profile:change', paintButtons);
  if (window.Vault) window.Vault.onUnlock(paintButtons);
  paintButtons();

  /* the links that should be on jplundberg.com (switched on, with a valid address) */
  function publicSocials() {
    return load().socials.filter(function (s) { return s.pub && socialUrl(s); }).map(function (s) { return { net: s.net, url: socialUrl(s) }; });
  }
  /* Undo on the Socials page: back to what's live */
  function resetSocials(live) {
    if (!Array.isArray(live)) return;
    var p = load(), used = {};
    p.socials.forEach(function (s) { var u = socialUrl(s); s.pub = live.some(function (l) { return l.url === u; }); used[u] = 1; });
    live.forEach(function (l) { if (!used[l.url]) p.socials.push({ id: uid(), net: l.net, handle: l.url, pub: true }); });
    save(p);
    window.dispatchEvent(new Event('socials:reset'));
  }
  window.Profile = { load: load, save: save, avatar: avatar, NETS: NETS, socialUrl: socialUrl, age: age, publicSocials: publicSocials, resetSocials: resetSocials };

  /* ---------- Health page: medical info card ---------- */
  var med = $('meHealth');
  function renderMed() {
    if (!med) return;
    var p = load(), rows = [['GP (fastlege)', p.gp], ['Blood type', p.blood], ['Allergies', p.allergies], ['Medicines', p.meds]].filter(function (r) { return r[1]; });
    var ice = p.iceName ? esc(p.iceName) + (p.iceRel ? ' (' + esc(p.iceRel) + ')' : '') + (p.icePhone ? ' · <a href="tel:' + esc(p.icePhone.replace(/\s/g, '')) + '">' + esc(p.icePhone) + '</a>' : '') : '';
    med.hidden = !rows.length && !ice;
    med.innerHTML = '<div class="card-head"><h2><i class="bi bi-person-vcard"></i> Medical info</h2><a class="text-btn" href="/cmd/?settings=profile">Edit</a></div>' +
      '<dl class="me-dl">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') +
      (ice ? '<dt>Emergency contact</dt><dd>' + ice + '</dd>' : '') + '</dl>';
  }
  /* Travel page: emergency contact under travel documents */
  var docs = $('tpDocsCard');
  function renderIce() {
    if (!docs) return;
    var p = load(), el = $('meIce');
    if (!el) { el = document.createElement('p'); el.id = 'meIce'; el.className = 'me-ice'; docs.appendChild(el); }
    el.hidden = !p.iceName;
    el.innerHTML = p.iceName ? '<i class="bi bi-telephone"></i> Emergency contact: <b>' + esc(p.iceName) + '</b>' + (p.iceRel ? ' (' + esc(p.iceRel) + ')' : '') +
      (p.icePhone ? ' · <a href="tel:' + esc(p.icePhone.replace(/\s/g, '')) + '">' + esc(p.icePhone) + '</a>' : '') : '';
  }
  [renderMed, renderIce].forEach(function (fn) {
    window.addEventListener('profile:change', fn);
    if (window.Vault) window.Vault.onUnlock(fn);
  });

  /* ---------- Profile & settings panel (dashboard only) ---------- */
  var head = $('stProfile'), box = $('meBox'), soBox = $('soBox');
  var area = box && (box.closest('.st-panel') || box);     // profile and socials pages share the handlers below
  if (!head || !box) return;

  function renderHead() {
    var p = load(), F = window.Features, sub = [p.role, p.employer].filter(Boolean).join(' · ');
    head.innerHTML = avatar(p, 'lg') + '<span class="st-label"><b>' + esc(p.name || 'Your profile') + '</b><small>' +
      esc(sub || 'Your details and photo – private') + '</small></span><i class="bi bi-chevron-right"></i>';
  }

  var FIELDS = [
    { sec: 'About you', icon: 'person', rows: [
      ['name', 'Name', 'text', 'Full name'], ['birthday', 'Birthday', 'date'], ['phone', 'Phone', 'tel', '+47'], ['email', 'Email', 'email', 'you@example.com'],
      ['city', 'City', 'text', 'Oslo']] },
    { sec: 'Home', icon: 'house-door', rows: [['home', 'Address', 'place', 'Search for your address', 'home']],
      note: 'Becomes “Home” in Travel, so departures and “leave by” start from here.' },
    { sec: 'Work', icon: 'briefcase', rows: [['employer', 'Employer', 'text', 'Company'], ['role', 'Role', 'text', 'Job title'],
      ['office', 'Office', 'place', 'Search for the office address', 'work'], ['norm', 'Normal working day', 'hours']],
      note: 'The office becomes “Work” in Travel. The working day is what Flex time counts against.' },
    { sec: 'Emergency contact', icon: 'telephone', rows: [['iceName', 'Name', 'text'], ['iceRel', 'Relation', 'text', 'e.g. Mother, partner'], ['icePhone', 'Phone', 'tel']],
      note: 'Shown with your travel documents and on the Health page.' },
    { sec: 'Health', icon: 'heart-pulse', rows: [['gp', 'GP (fastlege)', 'text', 'Name and clinic'],
      ['blood', 'Blood type', 'select', ['', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', '0+', '0−']], ['allergies', 'Allergies', 'text', 'None'], ['meds', 'Medicines', 'text', 'Anything you take regularly']] },
    { sec: 'Sizes', icon: 'rulers', rows: [['sizeTop', 'Shirts & jackets', 'text', 'M'], ['sizeBottom', 'Trousers', 'text', '32/32'], ['sizeShoe', 'Shoes', 'text', '43'], ['sizeOther', 'Other', 'text', 'Ring, hat …']] }
  ];

  function travelPlace(k) { return window.Flow ? (window.Flow.travel().places || {})[k] : null; }
  function flexNorm() { return window.Features ? +((window.Features.tools().flexcfg || {}).norm) || 7.5 : 7.5; }

  function render() {
    renderSocials();
    var p = load();
    var photo = '<div class="me-photo">' + avatar(p, 'xl') + '<div><button type="button" class="pill-btn" id="mePick"><i class="bi bi-camera"></i> ' + (p.photo ? 'Change photo' : 'Add photo') + '</button>' +
      (p.photo ? '<button type="button" class="text-btn danger" id="meNoPhoto">Remove</button>' : '') +
      '<p class="st-note">' + (p.birthday && age(p.birthday) != null ? age(p.birthday) + ' years · ' : '') + 'Saved encrypted, only for you.</p></div>' +
      '<input type="file" id="meFile" accept="image/*" hidden></div>';
    var secs = FIELDS.map(function (S) {
      return '<p class="st-sub"><i class="bi bi-' + S.icon + '"></i> ' + S.sec + '</p><section class="st-group">' + S.rows.map(function (r) {
        var k = r[0], v = p[k], ph = typeof r[3] === 'string' ? ' placeholder="' + esc(r[3]) + '"' : '';
        var input;
        if (r[2] === 'place') {
          var tp = travelPlace(r[4]);
          input = '<span class="ps-wrap me-place"><input data-mplace="' + k + '" data-tp="' + r[4] + '" value="' + esc((tp && tp.name) || (p[k] && p[k].name) || '') + '"' + ph + ' aria-label="' + r[1] + '"></span>';
        } else if (r[2] === 'select') {
          input = '<select class="st-select" data-mk="' + k + '">' + r[3].map(function (o) { return '<option' + (o === (v || '') ? ' selected' : '') + ' value="' + o + '">' + (o || '–') + '</option>'; }).join('') + '</select>';
        } else if (r[2] === 'hours') {
          input = '<span class="me-hours"><input data-mnorm inputmode="decimal" value="' + String(flexNorm()).replace('.', ',') + '" aria-label="Normal working day in hours"> h</span>';
        } else {
          input = '<input class="st-input" type="' + r[2] + '" data-mk="' + k + '" value="' + esc(v || '') + '"' + ph + ' maxlength="120" aria-label="' + r[1] + '">';
        }
        return '<label class="st-row me-row"><span>' + r[1] + '</span>' + input + '</label>';
      }).join('') + '</section>' + (S.note ? '<p class="st-note me-note">' + S.note + '</p>' : '');
    }).join('');
    box.innerHTML = '<p class="me-private"><i class="bi bi-lock"></i><span><b>Private.</b> Only you see this – nothing here is shown on jplundberg.com. What’s public is under Settings → jplundberg.com.</span></p>' + photo + secs +
      '<p class="st-sub"><i class="bi bi-pencil"></i> Notes</p><section class="st-group"><textarea class="me-notes" data-mk="notes" rows="3" maxlength="2000" placeholder="Anything else you want to keep handy">' + esc(p.notes || '') + '</textarea></section>';
    if (window.Places) box.querySelectorAll('[data-mplace]').forEach(function (inp) {
      window.Places.field(inp, { onPick: function (pl) {
        if (!pl) return;
        var q = load(), plain = { id: pl.id || '', name: pl.name, sub: pl.sub || '', lat: pl.lat, lon: pl.lon, stop: !!pl.stop };
        q[inp.dataset.mplace] = plain; save(q);
        if (window.Flow) { var t = window.Flow.travel(); t.places = t.places || {}; t.places[inp.dataset.tp] = plain; window.Flow.saveTravel(t); }
        flash(inp);
      } });
    });
  }
  function flash(el) { var row = el.closest('.st-row'); if (!row) return; row.classList.add('me-saved'); setTimeout(function () { row.classList.remove('me-saved'); }, 900); }

  /* ---------- socials ---------- */
  var pubMsg = '';
  function renderSocials() { if (soBox) soBox.innerHTML = socialsHtml(load()); }
  window.addEventListener('socials:reset', renderSocials);
  function socialsHtml(p) {
    var opts = function (cur) { return Object.keys(NETS).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + NETS[k].name + '</option>'; }).join(''); };
    return '<p class="st-sub"><i class="bi bi-share"></i> Your profiles <span class="st-hint">Username or link. The switch decides if it’s shown on jplundberg.com</span></p>' +
      '<section class="st-group me-socials">' + p.socials.map(function (s) {
        var url = socialUrl(s), N = NETS[s.net] || NETS.linkedin;
        return '<div class="st-row me-soc" data-sid="' + esc(s.id) + '">' +
          '<span class="me-soc-ic"><i class="bi bi-' + N.icon + '"></i></span>' +
          '<select class="me-soc-net" data-snet aria-label="Network">' + opts(s.net) + '</select>' +
          '<input class="me-soc-h" data-shandle value="' + esc(s.handle || '') + '" placeholder="username" maxlength="200" aria-label="' + N.name + ' username or link" spellcheck="false" autocapitalize="off">' +
          '<a class="icon-btn me-soc-open" href="' + esc(url || '#') + '"' + (url ? '' : ' hidden') + ' target="_blank" rel="noopener" aria-label="Open ' + N.name + '"><i class="bi bi-box-arrow-up-right"></i></a>' +
          '<input type="checkbox" class="switch" data-spub' + (s.pub ? ' checked' : '') + ' aria-label="Show ' + N.name + ' on jplundberg.com">' +
          '<button type="button" class="text-btn danger me-soc-del" data-sdel aria-label="Remove"><i class="bi bi-x-lg"></i></button></div>';
      }).join('') +
      (p.socials.length < 10 ? '<button type="button" class="st-row st-btn cs-add" data-sadd><span><i class="bi bi-plus-lg"></i> Add social</span></button>' : '') +
      '</section>';
  }
  /* ---------- editing ---------- */
  var timer = null;
  area.addEventListener('input', function (e) {
    var t = e.target, k = t.dataset.mk;
    if (k) {
      clearTimeout(timer);
      timer = setTimeout(function () { var p = load(); p[k] = t.value.trim().slice(0, k === 'notes' ? 2000 : 120); save(p); renderHead(); }, 350);
    }
    if (t.hasAttribute('data-shandle')) {
      var p2 = load(), id = t.closest('[data-sid]').dataset.sid;
      var link = t.closest('[data-sid]').querySelector('.me-soc-open');
      p2.socials.forEach(function (s) {
        if (s.id !== id) return;
        s.handle = t.value.trim().slice(0, 200);
        var u = socialUrl(s); link.hidden = !u; link.href = u || '#';
      });
      save(p2);
    }
  });
  area.addEventListener('change', function (e) {
    var t = e.target, p = load(), row = t.closest('[data-sid]');
    if (t.dataset.mk) { p[t.dataset.mk] = t.value.trim(); save(p); flash(t); renderHead(); return; }
    if (t.hasAttribute('data-mnorm') && window.Features) {
      var n = parseFloat(t.value.replace(',', '.'));
      if (n > 0 && n < 16) { var tl = window.Features.tools(); tl.flexcfg = tl.flexcfg || {}; tl.flexcfg.norm = n; window.Features.saveTools(tl); flash(t); }
      return;
    }
    if (row) {
      p.socials.forEach(function (s) {
        if (s.id !== row.dataset.sid) return;
        if (t.hasAttribute('data-snet')) s.net = t.value;
        if (t.hasAttribute('data-spub')) s.pub = t.checked;
      });
      save(p);
      if (t.hasAttribute('data-snet')) render();
    }
  });
  area.addEventListener('click', function (e) {
    var p;
    if (e.target.closest('#mePick')) return $('meFile').click();
    if (e.target.closest('#meNoPhoto')) { p = load(); delete p.photo; save(p); render(); renderHead(); return; }
    if (e.target.closest('[data-sadd]')) {
      p = load(); var used = p.socials.map(function (s) { return s.net; });
      p.socials.push({ id: uid(), net: Object.keys(NETS).filter(function (k) { return used.indexOf(k) < 0; })[0] || 'instagram', handle: '', pub: false });
      save(p); render();
      var last = area.querySelectorAll('[data-shandle]'); if (last.length) last[last.length - 1].focus();
      return;
    }
    var del = e.target.closest('[data-sdel]');
    if (del) {
      var id = del.closest('[data-sid]').dataset.sid;
      if (!del.classList.contains('armed')) { del.classList.add('armed'); del.innerHTML = 'Remove?'; return; }
      p = load(); p.socials = p.socials.filter(function (s) { return s.id !== id; }); save(p); render();
    }
  });
  /* photo: cropped to a square and made small (about 20 KB) so it syncs quickly */
  area.addEventListener('change', function (e) {
    if (e.target.id !== 'meFile' || !e.target.files[0]) return;
    var img = new Image(), url = URL.createObjectURL(e.target.files[0]);
    img.onload = function () {
      var s = Math.min(img.width, img.height), c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      var p = load(); p.photo = c.toDataURL('image/jpeg', 0.82); save(p); render(); renderHead();
    };
    img.src = url;
  });

  window.addEventListener('st:page', function (e) { if (e.detail === 'profile' || e.detail === 'socials') render(); if (e.detail === 'home') renderHead(); });
  window.addEventListener('profile:change', renderHead);
  if (window.Vault) window.Vault.onUnlock(renderHead);
  renderHead();
})();
} catch (e) { console.error("profile.js", e); }
/* ===== links.js ===== */
try {
/* Connections: when you change something in one place, the places that depend on it follow.
   Runs on every dashboard page, after the vault is unlocked.
   - Subscriptions → Monthly budget: each active subscription is a fixed cost (per month;
     yearly and quarterly ones spread out), monthly ones also get a due day in Upcoming bills
   - Trips → Finances: booking costs and a trip's other costs are spending (Travel), old trips too
   - Trips → Places to visit: a place you've now been to is ticked off as visited
   - Workouts → your training habit: a logged workout ticks the habit that day
   (workouts, courses and health → calendar in features.js) */
(function () {
  "use strict";
  var F = window.Features;
  if (!F || !window.Vault) return;
  var PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

  /* ---------- subscriptions → budget fixed costs ---------- */
  function syncSubs() {
    var d = window.Vault.get();
    if (!d) return;
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = F.on('subs') ? F.list('subs').filter(function (s) { return !s.paused && +s.amount > 0; }).map(function (s) {
      var monthly = (s.period || 'monthly') === 'monthly', old = fixed.filter(function (f) { return f.id === 'sub-' + s.id; })[0];
      var day = monthly && /^\d{4}-\d{2}-\d{2}$/.test(s.renews || '') ? +s.renews.slice(8, 10) : null;
      return { id: 'sub-' + s.id, name: s.name + (monthly ? '' : ' (' + (s.period === 'yearly' ? 'yearly' : 'every 3 months') + ')'),
        amount: Math.round((+s.amount) * (PER_MONTH[s.period] || 1)), day: day, src: 'sub' };
    }) : [];
    var mine = fixed.filter(function (f) { return f.src !== 'sub'; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'sub'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = mine.concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }

  /* ---------- savings goals → budget: "set aside every month" becomes a fixed cost ---------- */
  function syncSave() {
    var d = window.Vault.get(), B = window.Budget;
    if (!d || !B || !B.saveMonthly) return;
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = (d.savings || []).filter(function (g) { return g.aside; }).map(function (g) {
      return { id: 'save-' + g.id, name: 'Savings: ' + (g.name || 'goal'), amount: B.saveMonthly(g), day: null, src: 'save' };
    }).filter(function (f) { return f.amount > 0; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'save'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = fixed.filter(function (f) { return f.src !== 'save'; }).concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }
  window.Links = { syncSave: syncSave };

  /* ---------- trips → places to visit ---------- */
  function near(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return false;
    var dx = (a.lat - b.lat) * 111, dy = (a.lon - b.lon) * 111 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy) < 30;                 // within 30 km counts as the same place
  }
  function syncBucket() {
    if (!window.Flow || !F.on('bucket')) return;
    var today = F.dkey(new Date()), been = window.Flow.travel().trips.filter(function (t) { return t.start && t.start <= today && t.place; });
    if (!been.length) return;
    var t = F.tools(), changed = false;
    (t.bucket || []).forEach(function (b) {
      if (b.visited) return;
      var hit = been.filter(function (tr) {
        return near(tr.place, b.geo) || String(tr.place.name).toLowerCase() === String(b.place).toLowerCase();
      })[0];
      if (hit) { b.visited = true; b.visitedTrip = hit.id; changed = true; }
    });
    if (changed) F.saveTools(t);
  }

  /* ---------- trips → Finances ----------
     Every booking cost and a trip's "other costs" are spending in Finances (category Travel).
     Older trips and bookings made before this was automatic are added too: past ones on
     their own date, upcoming ones today (that's when you paid). Removed in Finances = left out. */
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) && n > 0 ? n : 0;
  }
  var syncingTrips = false;
  function syncTrips() {
    var d = window.Vault.get(), Fl = window.Flow;
    if (!d || !Fl || syncingTrips) return;
    d.expenses = Array.isArray(d.expenses) ? d.expenses : [];
    var byId = {}; d.expenses.forEach(function (e) { byId[e.id] = e; });
    var today = F.dkey(new Date()), tr = Fl.travel(), finChanged = false, travelChanged = false;
    function want(owner, idKey, amount, date, note, keepOutKey) {
      var ex = owner[idKey] && byId[owner[idKey]];
      if (owner[idKey] && !ex) { delete owner[idKey]; owner[keepOutKey] = true; travelChanged = true; return; }   // deleted in Finances
      if (!amount) { if (ex) { d.expenses = d.expenses.filter(function (x) { return x !== ex; }); delete owner[idKey]; finChanged = travelChanged = true; } return; }
      if (ex) {
        if (ex.amount !== amount || ex.note !== note) { ex.amount = amount; ex.note = note; finChanged = true; }
        return;
      }
      if (owner[keepOutKey]) return;
      var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      d.expenses.push({ id: id, t: Date.now(), date: date, amount: Math.round(amount * 100) / 100, cat: 'travel', note: note, src: 'trip' });
      owner[idKey] = id; finChanged = travelChanged = true;
    }
    tr.trips.forEach(function (t) {
      var name = t.name || t.dest || 'Trip', past = (t.end || t.start || today) < today;
      (t.items || []).forEach(function (it) {
        var label = it.title || ({ flight: 'Flight', train: 'Train', bus: 'Bus', boat: 'Boat', car: 'Car', hotel: 'Hotel', activity: 'Activity' }[it.type] || 'Booking');
        want(it, 'spendId', num(it.cost), past && /^\d{4}-\d{2}-\d{2}$/.test(it.date || '') ? it.date : today, (name + ': ' + label).slice(0, 80), 'noFin');
      });
      want(t, 'spentId', num(t.spent), past ? (t.start || today) : today, (name + ': other costs').slice(0, 80), 'noFinSpent');
    });
    if (!finChanged && !travelChanged) return;
    syncingTrips = true;
    try {
      if (finChanged) { window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
      if (travelChanged) Fl.saveTravel(tr);
    } finally { syncingTrips = false; }
  }

  /* ---------- workouts → the training habit ----------
     A logged workout ticks its habit that day (the one picked when logging, else your
     training/gym habit). Only adds ticks – ticking a day by hand still works as before. */
  function syncWorkouts() {
    if (!F.on('training')) return;
    var hb = null; try { hb = JSON.parse(localStorage.getItem('dash.habits')); } catch (e) {}
    if (!hb || !Array.isArray(hb.list) || !hb.list.length) return;
    var def = hb.list.filter(function (h) { return /train|trening|gym|workout|løp|run|exercise|økt/i.test(h.name); })[0];
    var ids = {}; hb.list.forEach(function (h) { ids[h.id] = 1; });
    hb.log = hb.log || {};
    var changed = false;
    F.list('training').forEach(function (w) {
      var hid = w.habit === '' ? null : (w.habit && ids[w.habit] ? w.habit : def && def.id);
      if (!hid || !/^\d{4}-\d{2}-\d{2}$/.test(w.date || '')) return;
      var day = hb.log[w.date] = hb.log[w.date] || [];
      if (day.indexOf(hid) < 0) { day.push(hid); changed = true; }
    });
    if (!changed) return;
    try { localStorage.setItem('dash.habits', JSON.stringify(hb)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));
    window.dispatchEvent(new Event('habits:change'));
    if (window.Dash && window.Dash.reload) window.Dash.reload();
  }

  function run() {
    try { syncWorkouts(); } catch (e) { console.error(e); }
    try { syncSubs(); } catch (e) { console.error(e); }
    try { syncSave(); } catch (e) { console.error(e); }
    try { syncTrips(); } catch (e) { console.error(e); }
    try { syncBucket(); } catch (e) { console.error(e); }
  }
  window.Vault.onUnlock(function () { setTimeout(run, 0); });
  window.addEventListener('tools:change', function () { if (window.Vault.get()) { syncSubs(); syncWorkouts(); } });
  window.addEventListener('features:change', function () { if (window.Vault.get()) run(); });
  window.addEventListener('travel:change', function () { if (window.Vault.get()) { syncTrips(); syncBucket(); } });
})();
} catch (e) { console.error("links.js", e); }
