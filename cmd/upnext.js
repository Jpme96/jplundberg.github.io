/* Dashboard: "up next" in the Travel card. Ties the calendar, trips and Entur together:
   your next event with a place (and when to leave home), and your next trip. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var F = window.Flow, C = window.Cal;
  if (!F || !C || !$('trNext')) return;
  var esc = C.esc, unlocked = false, seq = 0, ev = null;

  function render() {
    if (!unlocked) return;
    var now = new Date(), t = F.travel(), rows = [];
    /* online check-in is open (24 h before a flight) */
    t.trips.forEach(function (tr) {
      (tr.items || []).forEach(function (it) {
        var w = F.when(it);
        if (it.type !== 'flight' || !w || !w.timed || (tr.done && tr.done['checkin:' + it.id])) return;
        if (now >= new Date(w.start.getTime() - 864e5) && now < w.start) {
          rows.push('<a class="un-row un-alert" href="travel/#trip=' + encodeURIComponent(tr.id) + '" style="--c:#e8b43b"><i class="bi bi-airplane un-ic"></i>' +
            '<span class="x"><b>Check in for ' + esc(it.title || 'your flight') + '</b><span class="s">Departs ' + C.hm(w.start) +
            (C.sameDay(w.start, now) ? ' today' : ' tomorrow') + (it.ref ? ' · ref ' + esc(it.ref) : '') + '</span></span><i class="bi bi-chevron-right un-go"></i></a>');
        }
      });
    });
    /* a travel document that has run out or runs out soon */
    t.docs.forEach(function (d) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.expires || '')) return;
      var exp = C.fromKey(d.expires), soon = new Date(exp.getFullYear(), exp.getMonth() - 1, exp.getDate());
      if (now < soon) return;
      rows.push('<a class="un-row un-alert" href="travel/#docs" style="--c:var(--danger)"><i class="bi bi-person-vcard un-ic"></i>' +
        '<span class="x"><b>' + esc(d.name || 'Document') + (exp < now ? ' has expired' : ' expires soon') + '</b><span class="s">' +
        esc(exp.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })) + '</span></span><i class="bi bi-chevron-right un-go"></i></a>');
    });
    ev = C.occurrences(now, C.addDays(C.day0(now), 2)).filter(function (o) {
      return !o.allDay && o.ev.location && o.start > now && !(o.ev.item && o.ev.item.type === 'hotel');
    })[0] || null;
    if (ev) rows.push('<button type="button" class="un-row" data-go style="--c:' + ev.color + '"><i class="bi bi-signpost-split un-ic"></i>' +
      '<span class="x"><b>' + esc(ev.title) + '</b><span class="s" id="unLeave">' + (C.sameDay(ev.start, now) ? 'Today ' : 'Tomorrow ') + C.hm(ev.start) +
      ' · ' + esc(ev.ev.location) + '</span></span><span class="un-cta">Route</span></button>');
    var trip = t.trips.filter(function (x) { return (x.end || x.start) >= F.dkey(now); }).sort(function (a, b) { return a.start < b.start ? -1 : 1; })[0];
    if (trip) {
      var d = Math.round((C.fromKey(trip.start) - C.day0(now)) / 864e5), pack = trip.pack || [];
      var packed = pack.filter(function (p) { return p.done; }).length;
      rows.push('<a class="un-row" href="travel/#trip=' + encodeURIComponent(trip.id) + '" style="--c:' + F.TRAVEL_COLOR + '"><i class="bi bi-suitcase-lg un-ic"></i>' +
        '<span class="x"><b>' + esc(trip.name) + '</b><span class="s">' + (d > 0 ? 'In ' + d + ' day' + (d > 1 ? 's' : '') : 'Travelling now') +
        (pack.length ? ' · packed ' + packed + '/' + pack.length : '') + '</span></span><i class="bi bi-chevron-right un-go"></i></a>');
    }
    $('trNext').innerHTML = rows.join('');
    $('trNext').hidden = !rows.length;
    var home = t.places.home, s = ++seq;
    if (ev && home) {
      var buf = (ev.ev.buffer || 0) * 60e3;
      F.leaveBy(ev.ev.location, new Date(ev.start.getTime() - buf), home).then(function (r) {
        if (s !== seq || !r || !$('unLeave')) return;
        var mins = Math.round((new Date(r.leave) - Date.now()) / 60000);
        $('unLeave').innerHTML = '<span class="un-leave">Leave ' + C.hm(new Date(r.leave)) + '</span>' +
          (mins >= 0 && mins <= 90 ? ' (in ' + mins + ' min)' : '') + ' · ' + r.minutes + ' min' + (r.lines.length ? ' · ' + esc(r.lines.join(', ')) : '');
      });
    }
  }
  $('trNext').addEventListener('click', function (e) {
    if (!e.target.closest('[data-go]') || !ev) return;
    var buf = (ev.ev.buffer || 0) * 60e3;
    F.route({ toText: ev.ev.location, arriveBy: new Date(ev.start.getTime() - buf),
      context: { title: ev.title, note: buf ? ev.ev.buffer + ' min before ' + C.hm(ev.start) : 'starts ' + C.hm(ev.start), cat: ev.ev.cat } });
  });
  window.addEventListener('cal:change', render);
  window.addEventListener('travel:change', render);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
  setInterval(function () { if (!document.hidden) render(); }, 5 * 60e3);
  if (window.Vault) {
    window.Vault.onUnlock(function () { unlocked = true; render(); });
    window.Vault.onLock(function () { unlocked = false; });
  }
})();
