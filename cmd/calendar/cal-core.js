/* Calendar engine, shared by the calendar page and the dashboard card.
   - Your own events live in "dash.calendar" and are synced in the encrypted vault.
   - Phone calendars (iCloud, Google, Outlook links) are read through the Worker
     (/cmd/api/calendar) and shown read-only. The links are kept in the vault too. */
(function () {
  "use strict";

  var KEY = 'dash.calendar';
  var API = '/cmd/api/calendar';
  var FRESH_MS = 10 * 60 * 1000;
  var CATS = {
    work: { name: 'Work', color: '#3987e5', icon: 'briefcase' },
    study: { name: 'Study', color: '#8a6fdf', icon: 'mortarboard' },
    life: { name: 'Life', color: '#22b35e', icon: 'heart' }
  };
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
    yearly: { freq: 'YEARLY', interval: 1 }
  };
  var REPEAT_NAMES = { '': 'Never', daily: 'Every day', weekdays: 'Every weekday (Mon–Fri)', weekly: 'Every week', '2weeks': 'Every 2 weeks', monthly: 'Every month', yearly: 'Every year' };

  /* Turns a stored event into the common shape used for both sources */
  function fromOwn(e) {
    var base = fromKey(e.date);
    var ev = { id: e.id, own: e, title: e.title || 'Untitled', cat: CATS[e.cat] ? e.cat : 'life', allDay: !!e.allDay,
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
      if (st && st.events) st.events.forEach(function (ev) { ev.color = f.color; ev.src = f.name; add(ev); });
    });
    var Fe = window.Features;
    if ((opts.all || !d.hidden.travel) && (!Fe || Fe.on('travel'))) travelEvents().forEach(add);
    /* reminders from the tools in Settings → Features (renewals, warranties, certificates) */
    if (Fe && (opts.all || !d.hidden.reminders)) Fe.events().forEach(add);
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
    CATS: CATS, TRAVEL_COLOR: '#0891b2', FEED_COLORS: FEED_COLORS, REPEAT_NAMES: REPEAT_NAMES,
    load: load, save: save, uid: uid, esc: esc,
    occurrences: occurrences, expand: expand, fromOwn: fromOwn, parseICS: parseICS,
    refreshFeeds: refreshFeeds, fetchFeed: fetchFeed, clearFeeds: clearFeeds,
    feedState: function (id) { return feedState[id] || null; },
    dkey: dkey, hm: hm, fromKey: fromKey, day0: day0, addDays: addDays, monday: monday, sameDay: sameDay,
    dayLabel: dayLabel, timeLabel: timeLabel
  };

  if (window.Vault) window.Vault.onLock(clearFeeds);
})();
