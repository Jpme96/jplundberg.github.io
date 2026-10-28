/* Dashboard card: the next 7 days from your calendar (own events + phone calendars). */
(function () {
  "use strict";
  var C = window.Cal;
  if (!C || !document.getElementById('calCard')) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc, unlocked = false;

  function render() {
    if (!unlocked) return;
    var now = new Date(), t0 = C.day0(now), end = C.addDays(t0, 7);
    var list = C.occurrences(t0, end, { card: true });
    var by = {};
    list.forEach(function (o) {
      for (var d = C.day0(o.start < t0 ? t0 : o.start); d < end; d = C.addDays(d, 1)) {
        (by[C.dkey(d)] = by[C.dkey(d)] || []).push(o);
        if (C.addDays(d, 1) >= o.end) break;
      }
    });
    var strip = '';
    for (var i = 0; i < 7; i++) {
      var d = C.addDays(t0, i), k = C.dkey(d), evs = by[k] || [];
      strip += '<a class="cc-day' + (i === 0 ? ' today' : '') + '" href="calendar/#d=' + k + '" aria-label="' +
        esc(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })) + ', ' + evs.length + ' events">' +
        '<span>' + d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2) + '</span><b>' + d.getDate() + '</b>' +
        '<i class="cc-dots">' + evs.slice(0, 3).map(function (o) { return '<i style="--c:' + o.color + '"></i>'; }).join('') + '</i></a>';
    }
    /* upcoming: skip what's already over today */
    var next = list.filter(function (o) { return o.allDay ? o.end > now : o.end > now || (+o.end === +o.start && o.start >= t0 && o.start > now); }).slice(0, 5);
    var html = '', lastDay = '';
    next.forEach(function (o) {
      var s = o.start < t0 ? t0 : o.start, k = C.dkey(s);
      if (k !== lastDay) { html += '<li class="cc-h">' + esc(C.dayLabel(s)) + '</li>'; lastDay = k; }
      var sub = o.ev.location ? esc(o.ev.location) : (o.ev.src ? '<i class="bi bi-phone"></i> ' + esc(o.ev.src) : '');
      html += '<li><a class="cc-ev" href="calendar/#d=' + k + '" style="--c:' + o.color + '"><span class="t">' + (o.allDay || !C.sameDay(o.start, s) ? C.timeLabel(o, s) : C.hm(o.start)) + '</span>' +
        '<span class="bar"></span><span class="x"><b>' + esc(o.title) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></a></li>';
    });
    $('ccStrip').innerHTML = strip;
    var h2 = document.querySelector('#calCard .card-head h2'), wk = h2 && h2.querySelector('.cc-wk');
    if (h2 && !wk) { wk = document.createElement('span'); wk.className = 'cc-wk'; h2.appendChild(wk); }
    if (wk) wk.textContent = C.prefs().weekNums ? 'Week ' + C.isoWeek(now) : '';
    $('ccList').innerHTML = html;
    $('ccEmpty').hidden = next.length > 0;
  }

  window.addEventListener('cal:change', render);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
  var shownDay = C.dkey(new Date());
  setInterval(function () { if (C.dkey(new Date()) !== shownDay) shownDay = C.dkey(new Date()); render(); }, 60000);
  if (window.Vault) {
    window.Vault.onUnlock(function () { unlocked = true; render(); C.refreshFeeds(false); });
    window.Vault.onLock(function () { unlocked = false; });
  }
})();
