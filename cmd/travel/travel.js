/* Travel: from/to journey planner with real-time trips (Entur Journey Planner v3). */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var esc = window.Places.esc;
  var MODE = {
    bus: ['#e60000', 'bus-front', 'Bus'], coach: ['#75a300', 'bus-front', 'Coach'], metro: ['#ec700c', 'train-lightrail-front', 'Metro'],
    tram: ['#0b91ef', 'train-lightrail-front', 'Tram'], rail: ['#003087', 'train-front', 'Train'], water: ['#682c88', 'water', 'Boat'],
    air: ['#6b6d73', 'airplane', 'Flight'], foot: ['#6b6d73', 'person-walking', 'Walk']
  };
  function pad(n) { return String(n).padStart(2, '0'); }
  function hm(s) { var d = new Date(s); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dur(sec) {
    var m = Math.round(sec / 60);
    return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
  }
  function load() { try { return JSON.parse(localStorage.getItem('dash.travel')) || { recent: [] }; } catch (e) { return { recent: [] }; } }
  function save(t) {
    try { localStorage.setItem('dash.travel', JSON.stringify(t)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));   // synced in the encrypted vault
  }

  var h = new Date().getHours();
  $('tvHello').textContent = (h < 6 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ',';

  var from = null, to = null, when = 'now', cursor = null, shown = [];
  var fromField = window.Places.field($('tvFrom'), { myLocation: true, onPick: function (p) { from = p; if (p && to) go(); else if (p) $('tvTo').focus(); } });
  var toField = window.Places.field($('tvTo'), { onPick: function (p) { to = p; if (p && from) go(); } });

  $('tvSwap').addEventListener('click', function () {
    var a = from; from = to; to = a;
    fromField.set(from); toField.set(to);
    this.classList.remove('spin'); void this.offsetWidth; this.classList.add('spin');
    if (from && to) go();
  });

  /* Leave now / Leave at / Arrive by */
  function localNow() {
    var d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  }
  $('tvWhen').addEventListener('click', function (e) {
    var b = e.target.closest('[data-when]');
    if (!b) return;
    when = b.dataset.when;
    this.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    $('tvTime').hidden = when === 'now';
    if (when !== 'now' && !$('tvTime').value) $('tvTime').value = localNow();
    if (from && to) go();
  });
  $('tvTime').addEventListener('change', function () { if (from && to) go(); });

  $('tvForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!from) { $('tvMsg').textContent = 'Choose where you’re travelling from.'; $('tvFrom').focus(); return; }
    if (!to) { $('tvMsg').textContent = 'Choose where you’re going.'; $('tvTo').focus(); return; }
    go();
  });

  function whenObj() {
    if (when === 'now' || !$('tvTime').value) return { time: new Date().toISOString(), arriveBy: false };
    return { time: new Date($('tvTime').value).toISOString(), arriveBy: when === 'arrive' };
  }

  var seq = 0;
  function go(more) {
    var s = ++seq;
    $('tvMsg').innerHTML = '<i class="bi bi-arrow-repeat spin-i"></i> Finding trips…';
    if (!more) { cursor = null; shown = []; $('tvTrips').innerHTML = ''; }
    $('tvMore').hidden = true;
    $('tvRecent').hidden = true;
    remember();
    window.Places.trips(from, to, whenObj(), more ? cursor : null).then(function (t) {
      if (s !== seq) return;
      var list = (t.tripPatterns || []).filter(function (p) {
        return !shown.some(function (x) { return x.expectedStartTime === p.expectedStartTime && x.duration === p.duration; });
      });
      shown = shown.concat(list);
      cursor = t.nextPageCursor || null;
      $('tvMsg').textContent = shown.length ? '' : 'No trips found. Try another time or a nearby stop.';
      render(more);
      $('tvMore').hidden = !cursor || !shown.length;
    }).catch(function () {
      if (s !== seq) return;
      $('tvMsg').textContent = 'Couldn’t reach the travel planner right now. Check your connection and try again.';
    });
  }
  $('tvMore').addEventListener('click', function () { go(true); });

  function badge(leg) {
    var line = leg.line || {}, m = MODE[leg.mode] || MODE[line.transportMode] || MODE.bus;
    if (leg.mode === 'foot') return '<span class="tv-walk" title="Walk"><i class="bi bi-person-walking"></i>' + Math.max(1, Math.round(leg.duration / 60)) + '</span>';
    var col = line.presentation && line.presentation.colour ? '#' + line.presentation.colour : m[0];
    var txt = line.presentation && line.presentation.textColour ? '#' + line.presentation.textColour : '#fff';
    return '<span class="tv-line" style="background:' + col + ';color:' + txt + '" title="' + m[2] + '"><i class="bi bi-' + m[1] + '"></i>' + esc(line.publicCode || '') + '</span>';
  }

  function render() {
    var open = Array.prototype.map.call(document.querySelectorAll('.tv-trip.open'), function (li) { return li.dataset.i; });
    $('tvTrips').innerHTML = shown.map(function (p, i) {
      var legs = p.legs || [];
      var rides = legs.filter(function (l) { return l.mode !== 'foot'; });
      var first = rides[0];
      var late = first && first.aimedStartTime ? Math.round((new Date(first.expectedStartTime) - new Date(first.aimedStartTime)) / 60000) : 0;
      var changes = Math.max(0, rides.length - 1);
      var leaveIn = Math.round((new Date(p.expectedStartTime) - Date.now()) / 60000);
      var sub = first
        ? 'From ' + esc(first.fromPlace.name) + (first.fromPlace.quay && first.fromPlace.quay.publicCode ? ', ' + (first.mode === 'rail' || first.mode === 'metro' ? 'platform ' : 'stop ') + esc(first.fromPlace.quay.publicCode) : '') + ' at ' + hm(first.expectedStartTime)
        : 'Walk all the way';
      return '<li class="tv-trip" data-i="' + i + '"><button type="button" class="tv-sum" aria-expanded="false">' +
        '<span class="tv-times"><b>' + hm(p.expectedStartTime) + ' – ' + hm(p.expectedEndTime) + '</b><span class="tv-dur">' + dur(p.duration) + '</span></span>' +
        '<span class="tv-legs">' + legs.map(badge).join('<i class="bi bi-chevron-right tv-sep"></i>') + '</span>' +
        '<span class="tv-meta">' + sub + ' · ' + (changes ? changes + ' change' + (changes > 1 ? 's' : '') : 'direct') +
        (leaveIn >= 0 && leaveIn < 60 ? ' · <span class="tv-soon">leave in ' + (leaveIn ? leaveIn + ' min' : 'now') + '</span>' : '') +
        (late >= 2 ? ' · <span class="tv-late">' + late + ' min late</span>' : '') + '</span>' +
        '</button><div class="tv-detail" hidden>' + detail(legs) + '</div></li>';
    }).join('');
    open.forEach(function (i) {
      var li = document.querySelector('.tv-trip[data-i="' + i + '"]');
      if (li) { li.classList.add('open'); li.querySelector('.tv-detail').hidden = false; li.querySelector('.tv-sum').setAttribute('aria-expanded', 'true'); }
    });
  }

  function detail(legs) {
    return '<ol class="tv-steps">' + legs.map(function (l) {
      var line = l.line || {};
      var m = MODE[l.mode] || MODE.bus;
      var late = l.aimedStartTime ? Math.round((new Date(l.expectedStartTime) - new Date(l.aimedStartTime)) / 60000) : 0;
      var head = l.mode === 'foot'
        ? 'Walk ' + dur(l.duration) + (l.distance ? ' · ' + (l.distance >= 1000 ? (l.distance / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(l.distance) + ' m') : '')
        : badge(l) + ' ' + esc(m[2]) + (l.fromEstimatedCall && l.fromEstimatedCall.destinationDisplay ? ' towards ' + esc(l.fromEstimatedCall.destinationDisplay.frontText) : (line.name ? ' ' + esc(line.name) : '')) +
          ' · ' + dur(l.duration) + (late >= 2 ? ' · <span class="tv-late">' + late + ' min late</span>' : '') + (l.realtime ? ' <i class="tr-rt" title="Real time"></i>' : '');
      var plat = l.fromPlace && l.fromPlace.quay && l.fromPlace.quay.publicCode && l.mode !== 'foot' ? ' <small>' + (l.mode === 'rail' || l.mode === 'metro' ? 'Platform ' : 'Stop ') + esc(l.fromPlace.quay.publicCode) + '</small>' : '';
      return '<li class="' + (l.mode === 'foot' ? 'walk' : 'ride') + '" style="--lc:' + (l.mode === 'foot' ? 'var(--line)' : ((line.presentation && line.presentation.colour) ? '#' + line.presentation.colour : m[0])) + '">' +
        '<span class="t">' + hm(l.expectedStartTime) + '</span><span class="p"><b>' + esc(l.fromPlace.name) + '</b>' + plat + '</span>' +
        '<span class="how">' + head + '</span></li>';
    }).join('') + (legs.length ? '<li class="end"><span class="t">' + hm(legs[legs.length - 1].expectedEndTime) + '</span><span class="p"><b>' + esc(legs[legs.length - 1].toPlace.name) + '</b></span></li>' : '') + '</ol>';
  }

  $('tvTrips').addEventListener('click', function (e) {
    var b = e.target.closest('.tv-sum');
    if (!b) return;
    var d = b.nextElementSibling, open = d.hidden;
    d.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
    b.parentNode.classList.toggle('open', open);
  });

  /* Recent trips (synced) */
  function remember() {
    if (!from || !to || from.mine || to.mine) return;
    var t = load();
    t.recent = [{ from: from, to: to }].concat((t.recent || []).filter(function (r) {
      return !(r.from.name === from.name && r.to.name === to.name);
    })).slice(0, 5);
    save(t);
  }
  function renderRecent() {
    var r = load().recent || [];
    $('tvRecent').hidden = !r.length || shown.length > 0;
    $('tvRecent').innerHTML = r.length ? '<p class="tv-label">Recent trips</p>' + r.map(function (x, i) {
      return '<button type="button" class="tv-chip" data-r="' + i + '"><i class="bi bi-clock-history"></i>' + esc(x.from.name) + ' <i class="bi bi-arrow-right"></i> ' + esc(x.to.name) + '</button>';
    }).join('') : '';
  }
  $('tvRecent').addEventListener('click', function (e) {
    var b = e.target.closest('[data-r]');
    if (!b) return;
    var r = load().recent[+b.dataset.r];
    from = r.from; to = r.to;
    fromField.set(from); toField.set(to);
    go();
  });

  /* Arriving from the dashboard card with a trip already chosen */
  function fromDashboard() {
    var q = null;
    try { q = JSON.parse(sessionStorage.getItem('dash.tripQuery')); sessionStorage.removeItem('dash.tripQuery'); } catch (e) {}
    if (q && q.from && q.to) { from = q.from; to = q.to; fromField.set(from); toField.set(to); go(); return true; }
    if (q && q.from) { from = q.from; fromField.set(from); }
    if (q && q.to) { to = q.to; toField.set(to); }
    return false;
  }

  /* Keep "leave in 4 min" honest */
  setInterval(function () { if (shown.length && !document.hidden) render(); }, 60000);

  window.Dash = { reload: function () { if (!shown.length) renderRecent(); } };
  window.Vault.onUnlock(function () { if (!fromDashboard()) renderRecent(); });
  window.Vault.onLock(function () { shown = []; $('tvTrips').innerHTML = ''; });
})();
