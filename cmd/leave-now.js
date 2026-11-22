/* "Leave now" (2026-11-22, JP: everyday conveniences): for appointments with an address in the next day and a half, when to
   leave home by public transport to be there 5 minutes early – Entur's journey planner (open data, already used for your
   commute), from Home in your saved places (Travel → places). Worked out while the dashboard is open and kept on this
   device (dash.leave); a push 10 minutes before (Settings → Notifications → "Time to leave"), a line in At a glance, and
   the leave time in the evening wrap-up. No home saved, no address, or no trip found: nothing is shown. */
(function () {
  'use strict';
  var JP = 'https://api.entur.io/journey-planner/v3/graphql', GEO = 'https://api.entur.io/geocoder/v3/autocomplete', CLIENT = 'jplundberg-dashboard';
  var K = function (k, e, o) { return window.I18N ? I18N.k(k, e, o) : e; };
  function rj(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function wj(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function pad(n) { return ('0' + n).slice(-2); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function home() { var t = rj('dash.travel', {}) || {}, h = t.places && t.places.home; return h && (h.id || (h.lat != null && h.lon != null)) ? h : null; }
  function loc(p) { return p.stop && p.id ? { place: p.id, name: p.name } : { name: p.name || 'Home', coordinates: { latitude: +p.lat, longitude: +p.lon } }; }
  function keyOf(o) { return String((o.ev && o.ev.id) || o.title || '') + '@' + (o.start instanceof Date ? o.start.getTime() : +o.start); }
  function upcoming() {
    var C = window.Cal; if (!C || !C.occurrences) return [];
    var now = new Date(), end = new Date(now.getTime() + 36 * 36e5);
    try { return C.occurrences(now, end, { card: true }).filter(function (o) { var l = o.ev && (o.ev.location || o.location); return !o.allDay && l && String(l).trim().length > 3 && !(o.ev && (o.ev.reminder || o.ev.holiday)) && o.start > now; }).slice(0, 5); } catch (e) { return []; }
  }
  function geocode(text) {
    var cache = rj('dash.leave.geo', {}) || {}, k = text.toLowerCase().trim();
    if (cache[k]) return Promise.resolve(cache[k]);
    return fetch(GEO + '?size=1&lang=no&text=' + encodeURIComponent(text), { headers: { 'ET-Client-Name': CLIENT } }).then(function (r) { return r.json(); }).then(function (j) {
      var f = j && j.features && j.features[0]; if (!f) return null;
      var c = { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], name: (f.properties && (f.properties.label || f.properties.name)) || text };
      cache[k] = c; var keys = Object.keys(cache); if (keys.length > 60) delete cache[keys[0]]; wj('dash.leave.geo', cache); return c;
    });
  }
  function plan(o, h) {
    var where = String((o.ev && o.ev.location) || o.location).trim(), arrive = new Date(o.start.getTime() - 5 * 6e4);
    return geocode(where).then(function (c) {
      if (!c) return null;
      var q = 'query($from: Location!, $to: Location!, $dt: DateTime!) { trip(from: $from, to: $to, dateTime: $dt, arriveBy: true, numTripPatterns: 3) { tripPatterns { expectedStartTime expectedEndTime duration } } }';
      return fetch(JP, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ET-Client-Name': CLIENT }, body: JSON.stringify({ query: q, variables: { from: loc(h), to: { name: c.name, coordinates: { latitude: c.lat, longitude: c.lon } }, dt: arrive.toISOString() } }) })
        .then(function (r) { return r.json(); }).then(function (j) {
          var tp = j && j.data && j.data.trip && j.data.trip.tripPatterns || [], ok = tp.filter(function (p) { return new Date(p.expectedEndTime) <= o.start; }).sort(function (a, b) { return new Date(b.expectedStartTime) - new Date(a.expectedStartTime); })[0];
          if (!ok) return null; var s = new Date(ok.expectedStartTime);
          if (o.start - s > 4 * 36e5) return null;   /* more than four hours away: not a "leave now" */
          return { at: hm(s), ts: s.getTime(), title: o.title || '', where: where, mins: Math.round(ok.duration / 60) };
        });
    }).catch(function () { return null; });
  }
  var busy = false;
  function refresh() {
    if (busy || !window.Vault || !Vault.get() || document.hidden) return;
    var h = home(); if (!h) return;
    var ev = upcoming(); if (!ev.length) return;
    var cache = rj('dash.leave', {}) || {}, now = Date.now(), todo = ev.filter(function (o) { var c = cache[keyOf(o)]; return !c || now - (c.got || 0) > 20 * 6e4; });
    if (!todo.length) return;
    busy = true;
    Promise.all(todo.map(function (o) { return plan(o, h).then(function (r) { return [keyOf(o), r]; }); })).then(function (res) {
      var c2 = rj('dash.leave', {}) || {}; Object.keys(c2).forEach(function (k) { if ((c2[k].ts || 0) < now - 36e5) delete c2[k]; });
      res.forEach(function (x) { if (x[1]) c2[x[0]] = Object.assign(x[1], { got: now }); else c2[x[0]] = { none: 1, got: now }; });
      wj('dash.leave', c2); busy = false; window.dispatchEvent(new Event('leave:change'));
    }).catch(function () { busy = false; });
  }
  window.LeaveNow = {
    at: function (o) { var c = (rj('dash.leave', {}) || {})[keyOf(o)]; return c && c.at ? c.at : null; },
    list: function () { var c = rj('dash.leave', {}) || {}, now = Date.now(); return Object.keys(c).map(function (k) { return c[k]; }).filter(function (x) { return x.ts && x.ts > now - 15 * 6e4; }).sort(function (a, b) { return a.ts - b.ts; }); },
    refresh: refresh, plan: plan
  };
  /* the push 10 minutes before you should leave */
  (window.NotifyExtra = window.NotifyExtra || []).push(function (add, o) {
    if (o.k && o.k.leave === false) return;
    window.LeaveNow.list().forEach(function (x) { var t = x.ts - 10 * 6e4; if (t > Date.now()) add('leave:' + x.ts + ':' + x.title.slice(0, 20), t, K('ui.lv-push', 'Leave in 10 minutes'), [x.title, x.where, K('ui.lv-mins', '{n} min by public transport', { n: x.mins })].filter(Boolean).join(' · '), '/cmd/calendar/'); });
  });
  /* At a glance: within the next two hours */
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    window.LeaveNow.list().forEach(function (x) { var m = Math.round((x.ts - Date.now()) / 6e4); if (m > 120 || m < -10) return;
      add(m <= 15 ? 20 : 45, 'signpost-split', m <= 15 ? 'var(--warn)' : 'var(--blue)', m <= 0 ? K('ui.lv-now', 'Leave now for {t}', { t: x.title }) : K('ui.lv-at', 'Leave {at} for {t}', { at: x.at, t: x.title }), [x.where, K('ui.lv-mins', '{n} min by public transport', { n: x.mins })].filter(Boolean).join(' · '), '/cmd/calendar/', { key: 'leave:' + x.ts }); });
  });
  if (window.Vault) Vault.onUnlock(function () { setTimeout(refresh, 2500); });
  setInterval(refresh, 10 * 6e4);
  window.addEventListener('cal:change', function () { setTimeout(refresh, 1500); });
})();
