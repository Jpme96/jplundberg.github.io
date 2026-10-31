/* Little touches (batch 6, Oct 2026) – every one can be switched off in Settings → Pictures & touches:
     time of day     – the windows in the page pictures light up in the evening, sun or moon in the sky
     weather         – soft rain, snow, sun or fog behind the page, from the forecast (Home or every page)
     seasons         – an Advent star in December, flags on 17 May, falling leaves in October …
     celebrations    – a short confetti burst when a season checklist, the Christmas gift list or a
                       habit's weekly target is done
     streak flames   – a flame next to habits (weeks in a row) and people you keep in touch with on time
     morning/evening – one or two plain sentences at the top of At a glance
     app icon badge  – also overdue house jobs and birthdays today (read by home-life.js)
     year poster     – one shareable picture of your year (from the Year in review, December–January)
     swipe           – on a phone, swipe left/right to the next page in your menu order
   Settings in dash.settings.touch (synced). The pictures themselves are in scenes.js. */
(function () {
  "use strict";
  var NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return dkey(new Date()); }
  var root = document.documentElement;
  var reduce = function () { return root.classList.contains('mo-off') || matchMedia('(prefers-reduced-motion: reduce)').matches; };

  /* ---------- settings ---------- */
  var DEF = { scPeople: true, scFood: true, scWork: true, scHealth: true, scFin: true, scTravel: true, tod: true, wx: 'home', season: true, confetti: true,
    flames: true, morning: true, evening: true, badgeHouse: true, badgeBday: true, poster: true, swipe: true };
  function all() { var s = readJSON('dash.settings', {}) || {}; return Object.assign({}, DEF, s.touch || {}); }
  function on(k) { return !!all()[k]; }
  function set(patch) {
    var s = readJSON('dash.settings', {}) || {};
    s.touch = Object.assign({}, s.touch || {}, patch);
    try { localStorage.setItem('dash.settings', JSON.stringify(s)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));
    window.dispatchEvent(new Event('touch:change'));
  }
  window.Delight = { on: on, get: all, set: set };

  /* ---------- time of day ---------- */
  function tod() {
    var h = new Date().getHours(), t = h >= 5 && h < 10 ? 'morning' : h < 17 && h >= 10 ? 'day' : h >= 17 && h < 22 ? 'evening' : 'night';
    ['morning', 'day', 'evening', 'night'].forEach(function (x) { root.classList.toggle('tod-' + x, on('tod') && x === t); });
    root.classList.toggle('tod-on', on('tod'));
  }
  tod(); setInterval(tod, 5 * 60e3);

  /* ---------- seasons: small things in the page pictures ---------- */
  function easter(y) {      // Gregorian Easter Sunday (Anonymous algorithm)
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, mo - 1, da);
  }
  function occasion(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    if (m === 12 && day <= 26) return 'xmas';
    if ((m === 12 && day === 31) || (m === 1 && day === 1)) return 'newyear';
    if (m === 5 && day === 17) return 'may17';
    if (m === 6 && day === 23) return 'midsummer';
    var e = easter(d.getFullYear()), diff = Math.round((new Date(d.getFullYear(), d.getMonth(), day) - e) / 864e5);
    if (diff >= -3 && diff <= 1) return 'easter';
    if (m === 10) return 'leaves';
    if (m === 1 || m === 2) return 'winter';
    return '';
  }
  /* extra SVG for a 240 × 150 picture: sun/moon (CSS shows the one that fits the hour) and the season */
  window.SceneDeco = function (kind) {
    var out = '';
    if (on('tod')) out += '<g class="sc-sky"><circle class="sc-sun" cx="22" cy="20" r="9"/><g class="sc-moon"><circle cx="22" cy="20" r="8"/><circle cx="26" cy="17" r="7" class="sc-moon-cut"/></g>' +
      '<g class="sc-stars"><circle cx="44" cy="12" r="1"/><circle cx="62" cy="26" r=".8"/><circle cx="12" cy="40" r=".8"/></g></g>';
    if (!on('season')) return out;
    var o = occasion();
    if (o === 'xmas') out += kind === 'house' ? '<g class="sc-xmas"><path d="M112 14 l2.4 5 5.4.6 -4 3.6 1.2 5.4 -5-2.8 -5 2.8 1.2-5.4 -4-3.6 5.4-.6z" class="sc-star"/>' +
      [60, 76, 92, 108, 124, 140, 156, 170].map(function (x, i) { return '<circle cx="' + x + '" cy="70" r="2" class="sc-bulb b' + (i % 3) + '"/>'; }).join('') + '</g>'
      : '<path d="M226 22 l2 4.2 4.6.5 -3.4 3.1 1 4.6 -4.2-2.4 -4.2 2.4 1-4.6 -3.4-3.1 4.6-.5z" class="sc-star"/>';
    if (o === 'may17') out += '<g class="sc-flag"><line x1="214" y1="8" x2="214" y2="44" class="sc-pole"/><rect x="214" y="8" width="20" height="14" fill="#ba0c2f"/><rect x="219" y="8" width="3.5" height="14" fill="#fff"/><rect x="214" y="13.2" width="20" height="3.5" fill="#fff"/><rect x="219.9" y="8" width="1.7" height="14" fill="#00205b"/><rect x="214" y="14.1" width="20" height="1.7" fill="#00205b"/></g>';
    if (o === 'newyear') out += '<g class="sc-fire"><circle cx="200" cy="22" r="1.6"/><circle cx="208" cy="16" r="1.4"/><circle cx="216" cy="24" r="1.6"/><circle cx="206" cy="28" r="1.2"/></g>';
    if (o === 'easter') out += '<g class="sc-egg"><ellipse cx="228" cy="122" rx="5" ry="6.5" fill="#f2c94c"/><ellipse cx="218" cy="124" rx="4" ry="5" fill="#9b8cf0"/></g>';
    if (o === 'midsummer') out += '<g class="sc-bonfire"><path d="M222 128 l6-14 6 14z" fill="#e8743b"/><path d="M225 128 l3-8 3 8z" fill="#f2c94c"/></g>';
    if (o === 'leaves') out += '<g class="sc-leaves"><ellipse cx="40" cy="30" rx="3" ry="1.6" class="l1"/><ellipse cx="120" cy="18" rx="3" ry="1.6" class="l2"/><ellipse cx="190" cy="40" rx="3" ry="1.6" class="l3"/></g>';
    if (o === 'winter' && kind !== 'house') out += '<g class="sc-flakes"><circle cx="40" cy="20" r="1.4"/><circle cx="110" cy="10" r="1.2"/><circle cx="180" cy="26" r="1.4"/><circle cx="215" cy="12" r="1"/></g>';
    return out;
  };

  /* ---------- weather behind the page ---------- */
  var WX_KIND = function (c) { return c == null ? '' : c >= 95 ? 'storm' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : c === 45 || c === 48 ? 'fog' : c === 3 ? 'cloud' : c <= 1 ? 'sun' : ''; };
  function wxLayer(kind) {
    var el = document.getElementById('dlWx');
    if (!kind) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'dlWx'; el.setAttribute('aria-hidden', 'true'); var bg = document.querySelector('.bg'); if (bg && bg.parentNode) bg.parentNode.insertBefore(el, bg.nextSibling); else document.body.insertBefore(el, document.body.firstChild); }
    el.className = 'dl-wx dl-wx-' + kind;
  }
  function weather() {
    var mode = all().wx, home = /\/cmd\/(index\.html)?$/.test(location.pathname);
    if (mode === 'off' || (mode === 'home' && !home)) return wxLayer('');
    var c = readJSON('dash.wxNow', null), place = readJSON('dash.weatherPlace', null) || { lat: 59.91, lon: 10.75 };
    var night = new Date().getHours() < 6 || new Date().getHours() >= 21;
    var show = function (code) { var k = WX_KIND(code); if (k === 'sun' && night) k = ''; wxLayer(k); };
    if (c && Date.now() - c.at < 30 * 60e3) return show(c.code);
    if (c) show(c.code);
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + place.lat + '&longitude=' + place.lon + '&current=weather_code&timezone=auto')
      .then(function (r) { return r.json(); }).then(function (j) {
        var code = j && j.current && j.current.weather_code; if (code == null) return;
        try { localStorage.setItem('dash.wxNow', JSON.stringify({ code: code, at: Date.now() })); } catch (e) {}
        show(code);
      }).catch(function () {});
  }

  /* ---------- confetti ---------- */
  function confetti() {
    if (!on('confetti') || reduce()) return;
    var cv = document.createElement('canvas'); cv.className = 'dl-confetti'; cv.setAttribute('aria-hidden', 'true');
    var w = cv.width = innerWidth * (devicePixelRatio || 1), h = cv.height = innerHeight * (devicePixelRatio || 1); document.body.appendChild(cv);
    var ctx = cv.getContext('2d'), cols = ['#14b8a6', '#d55181', '#f2c94c', '#3987e5', '#e8743b', '#8a6fdf'], P = [], s = devicePixelRatio || 1;
    for (var i = 0; i < 110; i++) P.push({ x: w / 2 + (Math.random() - .5) * w * .3, y: h * .35, vx: (Math.random() - .5) * 16 * s, vy: (-Math.random() * 14 - 4) * s, r: (3 + Math.random() * 4) * s, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - .5) * .4 });
    var t0 = performance.now();
    (function frame(t) {
      var k = (t - t0) / 1600; ctx.clearRect(0, 0, w, h);
      P.forEach(function (p) { p.vy += .45 * s; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); });
      if (k < 1) requestAnimationFrame(frame); else cv.remove();
    })(t0);
    try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
  }
  window.Delight.confetti = confetti;
  function monday(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
  /* what is "done" right now – a key that wasn't done before → confetti */
  function doneKeys() {
    var out = [], F = window.Features, mk = dkey(monday(new Date()));
    var hb = readJSON('dash.habits', {}) || {}, log = hb.log || {};
    (hb.list || []).forEach(function (h) {
      var n = 0; for (var i = 0; i < 7; i++) { var d = monday(new Date()); d.setDate(d.getDate() + i); if ((log[dkey(d)] || []).indexOf(h.id) > -1) n++; }
      if (h.target && n >= h.target) out.push('habit:' + h.id + ':' + mk);
    });
    if (F && F.on('house') && window.HousePlus && window.HousePlus.seasonLeft) {
      try { var sl = window.HousePlus.seasonLeft(); if (sl && sl.all.length && !sl.left.length) out.push('season:' + today().slice(0, 4) + '-' + sl.s[0]); } catch (e) {}
    }
    if (F && F.on('people')) {
      var y = today().slice(0, 4), list = F.list('people').filter(function (p) { return p.xmas; }), g = F.list('gifts').filter(function (x) { return x.occ === 'xmas' && String(x.date || '').slice(0, 4) === y; });
      if (list.length && list.every(function (p) { return g.some(function (x) { return x.pid === p.id; }); })) out.push('xmas:' + y);
    }
    return out;
  }
  function checkDone() {
    if (!root.classList.contains('unlocked')) return;
    var cur = doneKeys(), seen = readJSON('dash.dlDone', null), fresh = false;
    if (!seen) { seen = {}; cur.forEach(function (k) { seen[k] = 1; }); }
    else cur.forEach(function (k) { if (!seen[k]) { seen[k] = 1; fresh = true; } });
    Object.keys(seen).forEach(function (k) { if (cur.indexOf(k) < 0 && /^habit:/.test(k) && k.slice(-10) < dkey(monday(new Date(Date.now() - 21 * 864e5)))) delete seen[k]; });
    try { localStorage.setItem('dash.dlDone', JSON.stringify(seen)); } catch (e) {}
    if (fresh) setTimeout(confetti, 250);
  }

  /* ---------- streak flames ---------- */
  function habitStreak(h, log) {
    var thisMon = monday(new Date()), first = Object.keys(log).sort()[0]; if (!first) return 0;
    var run = 0;
    for (var m = monday(new Date(first + 'T12:00')); m <= thisMon; m.setDate(m.getDate() + 7)) {
      var n = 0; for (var i = 0; i < 7; i++) { var d = new Date(m); d.setDate(d.getDate() + i); if ((log[dkey(d)] || []).indexOf(h.id) > -1) n++; }
      if (n >= h.target) run++; else if (m < thisMon) run = 0;
    }
    return run;
  }
  /* people: talks in a row, each within "keep in touch" (+25 %), the last one not overdue */
  function talkStreak(p) {
    var e = +p.every || 0, l = (p.log || []).map(function (x) { return x.d; }).filter(Boolean); if (!e || !l.length) return 0;
    var gap = function (a, b) { return Math.round((new Date(a + 'T12:00') - new Date(b + 'T12:00')) / 864e5); };
    if (gap(today(), l[0]) > e) return 0;
    var n = 1; for (var i = 1; i < l.length; i++) { if (gap(l[i - 1], l[i]) <= e * 1.25) n++; else break; }
    return n;
  }
  function flame(n, title) { return '<span class="dl-flame" title="' + esc(title) + '" aria-label="' + esc(title) + '"><i class="bi bi-fire"></i>' + n + '</span>'; }
  var flameBusy = false;
  function flames() {
    if (flameBusy) return; flameBusy = true;
    try {
      var show = on('flames');
      document.querySelectorAll('.dl-flame').forEach(function (x) { if (!show) x.remove(); });
      if (!show || !root.classList.contains('unlocked')) return;
      var hb = readJSON('dash.habits', {}) || {}, log = hb.log || {}, byId = {}, byName = {};
      (hb.list || []).forEach(function (h) { var s = habitStreak(h, log); byId[h.id] = s; byName[h.name] = s; });
      document.querySelectorAll('.hb-name[data-edit]').forEach(function (b) {
        var s = byId[b.dataset.edit] || 0, f = b.parentNode.querySelector('.dl-flame');
        if (s >= 2 && !f) b.insertAdjacentHTML('afterend', flame(s, L(s + ' weeks in a row', s + ' uker på rad')));
        else if (f && s < 2) f.remove();
      });
      document.querySelectorAll('.hp-card .card-head h2').forEach(function (h2) {
        var name = (h2.firstChild && h2.childNodes[1] ? h2.childNodes[1].textContent : h2.textContent).trim(), s = byName[name] || 0;
        if (s >= 2 && !h2.querySelector('.dl-flame')) { var sm = h2.querySelector('small'); var span = document.createElement('span'); span.innerHTML = flame(s, L(s + ' weeks in a row', s + ' uker på rad')); h2.insertBefore(span.firstChild, sm); }
      });
      if (window.Features && window.Features.on('people')) {
        var ppl = {}; window.Features.list('people').forEach(function (p) { ppl[p.id] = talkStreak(p); });
        document.querySelectorAll('[data-tool="people"] .kit-item[data-id]').forEach(function (li) {
          var s = ppl[li.dataset.id] || 0, b = li.querySelector('.kit-x b'); if (!b) return;
          var f = b.querySelector('.dl-flame');
          if (s >= 2 && !f) b.insertAdjacentHTML('beforeend', ' ' + flame(s, L(s + ' talks in a row, on time', s + ' samtaler på rad, i tide')));
          else if (f && s < 2) f.remove();
        });
      }
    } finally { flameBusy = false; }
  }
  var flq = false;
  new MutationObserver(function () { if (flameBusy || flq) return; flq = true; requestAnimationFrame(function () { flq = false; flames(); }); }).observe(document.documentElement, { childList: true, subtree: true });

  /* ---------- morning briefing and evening wrap-up (Home, top of At a glance) ---------- */
  function joinAnd(l) { return l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + L(' and ', ' og ') + l[l.length - 1]; }
  function lower1(s) { return s && /^[A-ZÆØÅ][a-zæøå]/.test(s) && !/^(I|Kari|[A-ZÆØÅ][a-zæøå]+ [A-ZÆØÅ])/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function tr(s) { return window.I18N && window.I18N.t ? window.I18N.t(s) : s; }
  function briefLine() {
    var card = document.getElementById('briefCard'); if (!card) return;
    var el = document.getElementById('dlLine'), h = new Date().getHours(), txt = '';
    var mode = h >= 5 && h < 11 && on('morning') ? 'm' : h >= 17 && on('evening') ? 'e' : '';
    if (mode === 'm') {
      var items = (window.BriefItems || []).filter(function (x) { return !x.fold && !x.review && x.title && !/^(Plan your day|Planlegg dagen)/.test(x.title); }).slice(0, 3);
      var bits = items.map(function (x) { return lower1(tr(x.title)); });
      txt = '<b>' + L('Good morning', 'God morgen') + '</b> – ' + (bits.length ? esc(joinAnd(bits)) + '.' : L('nothing pressing today. Enjoy it.', 'ingenting som haster i dag. Nyt det.'));
    } else if (mode === 'e') {
      var td = today(), t2 = new Date(); t2.setDate(t2.getDate() + 1); var tk = dkey(t2);
      var todos = readJSON('dash.todos', []) || [], done = todos.filter(function (t) { return t.done && t.doneAt && dkey(new Date(t.doneAt)) === td; }).length;
      var hb = readJSON('dash.habits', {}) || {}, ticks = ((hb.log || {})[td] || []).length;
      var got = [];
      if (done) got.push(done + L(done === 1 ? ' task done' : ' tasks done', done === 1 ? ' oppgave gjort' : ' oppgaver gjort'));
      if (ticks) got.push(ticks + L(ticks === 1 ? ' habit ticked' : ' habits ticked', ticks === 1 ? ' vane krysset av' : ' vaner krysset av'));
      var next = '';
      try {
        if (window.Cal && window.Cal.occurrences) {
          var a = new Date(t2.getFullYear(), t2.getMonth(), t2.getDate()), b = new Date(a); b.setDate(b.getDate() + 1);
          var ev = window.Cal.occurrences(a, b).filter(function (o) { return !o.leave; }).sort(function (x, y) { return (x.allDay ? 1 : 0) - (y.allDay ? 1 : 0) || x.start - y.start; })[0];
          if (ev) next = (ev.allDay ? '' : pad(ev.start.getHours()) + ':' + pad(ev.start.getMinutes()) + ' ') + ev.title;
        }
      } catch (e) {}
      if (!next) { var tt = todos.filter(function (t) { return !t.done && (t.due === tk || t.today); })[0]; if (tt) next = tt.text; }
      txt = '<b>' + L('Today', 'I dag') + '</b> – ' + (got.length ? esc(joinAnd(got)) : L('a quiet one', 'en rolig dag')) + '. ' + (next ? '<b>' + L('Tomorrow', 'I morgen') + '</b> – <span data-noi18n>' + esc(next) + '</span>.' : L('Nothing planned for tomorrow yet.', 'Ingenting planlagt i morgen ennå.'));
    }
    if (!txt) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('p'); el.id = 'dlLine'; el.className = 'dl-line'; el.setAttribute('data-noi18n', ''); var head = card.querySelector('.card-head'); if (head) head.insertAdjacentElement('afterend', el); else card.insertBefore(el, card.firstChild); }
    if (el.innerHTML !== txt) el.innerHTML = txt;
  }
  window.addEventListener('brief:items', function () { clearTimeout(briefLine.t); briefLine.t = setTimeout(briefLine, 30); });

  /* ---------- swipe between pages (phones) ---------- */
  (function () {
    var sx = 0, sy = 0, st = 0, ok = false;
    function blocked(el) {
      for (var a = el; a && a !== document.body; a = a.parentElement) {
        if (a.matches && a.matches('input,textarea,select,[contenteditable],.leaflet-container,.cl-month,.cl-week,.todo-item,.tk-track,.st-backdrop,.cl-sheet-bg,.kit-bg,.fo-bg,.sr-bg,.tabbar,[data-noswipe],svg,canvas,.rp-sheet')) return true;
        var cs = getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 2) return true;
      }
      return false;
    }
    document.addEventListener('touchstart', function (e) {
      ok = false; if (!on('swipe') || e.touches.length !== 1 || root.classList.contains('cl-modal') || !root.classList.contains('unlocked') || innerWidth > 760) return;
      var t = e.touches[0]; if (t.clientX < 28 || t.clientX > innerWidth - 28) return;     // leave the edges to the browser's own back gesture
      if (blocked(e.target)) return;
      sx = t.clientX; sy = t.clientY; st = Date.now(); ok = true;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (!ok) return; ok = false;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st > 650 || Math.abs(dx) < 90 || Math.abs(dy) > 45 || Math.abs(dx) < Math.abs(dy) * 2.5) return;
      var links = [].slice.call(document.querySelectorAll('.tabbar a[data-pg]')).filter(function (a) { return !root.classList.contains('tab-off-' + a.dataset.pg); });      // every page that's switched on, also the ones folded under More
      links.sort(function (a, b) { return (+getComputedStyle(a).order || 0) - (+getComputedStyle(b).order || 0); });
      var i = links.findIndex(function (a) { return a.getAttribute('aria-current') === 'page'; }); if (i < 0) return;
      var nx = links[i + (dx < 0 ? 1 : -1)]; if (!nx) return;
      root.classList.add('dl-swipe-' + (dx < 0 ? 'l' : 'r'));
      location.href = nx.getAttribute('href');
    }, { passive: true });
  })();

  /* ---------- year poster ---------- */
  function yearData(y) {
    var F = window.Features, d = (window.Vault && window.Vault.get()) || {}, ys = String(y);
    var tv = readJSON('dash.travel', {}) || {}, trips = (tv.trips || []).filter(function (t) { return String(t.start || '').slice(0, 4) === ys && t.start <= today(); });
    var countries = {}, days = 0, pts = [];
    trips.forEach(function (t) { var p = t.place || {}; if (p.cc) countries[p.cc] = 1; if (p.lat != null) pts.push([+p.lon, +p.lat]); if (t.start && t.end) days += Math.round((new Date(t.end) - new Date(t.start)) / 864e5) + 1; });
    var T = F ? F.tools() : {}, wo = (T.training || []).filter(function (w) { return String(w.date).slice(0, 4) === ys; });
    var gym = (T.gym || []).filter(function (g) { return String(g.date || '').slice(0, 4) === ys; });
    var km = wo.reduce(function (a, w) { return a + (parseFloat(String(w.km || 0).replace(',', '.')) || 0); }, 0);
    var hb = readJSON('dash.habits', {}) || {}, ticks = 0; Object.keys(hb.log || {}).forEach(function (k) { if (k.slice(0, 4) === ys) ticks += (hb.log[k] || []).length; });
    var spent = (d.expenses || []).filter(function (e) { return String(e.date).slice(0, 4) === ys; }).reduce(function (a, e) { return a + (+e.amount || 0); }, 0);
    var talks = 0; (T.people || []).forEach(function (p) { (p.log || []).forEach(function (x) { if (String(x.d).slice(0, 4) === ys) talks++; }); });
    var meals = Object.keys(T.meals || {}).filter(function (k) { return k.slice(0, 4) === ys; }).length;
    var steps = 0, stepDays = 0, hd = (d.health && d.health.days) || {}; Object.keys(hd).forEach(function (k) { if (k.slice(0, 4) === ys && +hd[k].steps) { steps += +hd[k].steps; stepDays++; } });
    return { y: y, trips: trips.length, countries: Object.keys(countries).length, days: days, pts: pts, workouts: wo.length + gym.length, km: km, ticks: ticks, spent: spent, talks: talks, meals: meals, steps: steps, stepDays: stepDays };
  }
  function poster(y) {
    var D = yearData(y), W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d'), acc = getComputedStyle(root).getPropertyValue('--accent').trim() || '#14b8a6';
    var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#10241f'); g.addColorStop(.55, '#151625'); g.addColorStop(1, '#2a1f3d'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    var font = function (w, s) { return w + ' ' + s + 'px Inter, system-ui, -apple-system, sans-serif'; };
    c.fillStyle = acc; c.font = font(600, 34); c.fillText(L('MY YEAR', 'ÅRET MITT'), 80, 120);
    c.fillStyle = '#fff'; c.font = font(700, 190); c.fillText(String(y), 70, 300);
    /* the globe: a circle with a graticule and a dot per trip */
    var cx = 790, cy = 230, R = 170; c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fillStyle = 'rgba(255,255,255,.05)'; c.fill(); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2;
    for (var la = -60; la <= 60; la += 30) { c.beginPath(); c.ellipse(cx, cy - Math.sin(la * Math.PI / 180) * R, R * Math.cos(la * Math.PI / 180), 6, 0, 0, 7); c.stroke(); }
    for (var lo = -60; lo <= 60; lo += 30) { c.beginPath(); c.ellipse(cx, cy, Math.abs(Math.sin(lo * Math.PI / 180)) * R + 1, R, 0, 0, 7); c.stroke(); }
    var lon0 = 10;     // centred on Norway
    D.pts.forEach(function (p) {
      var l = (p[0] - lon0) * Math.PI / 180, f = p[1] * Math.PI / 180; if (Math.cos(l) < 0) return;
      var x = cx + R * Math.cos(f) * Math.sin(l), yy = cy - R * Math.sin(f) + R * .35;
      c.beginPath(); c.arc(x, yy, 9, 0, 7); c.fillStyle = acc; c.fill(); c.beginPath(); c.arc(x, yy, 18, 0, 7); c.fillStyle = 'rgba(255,255,255,.15)'; c.fill();
    });
    c.beginPath(); c.arc(cx, cy + R * .35 - R * Math.sin(59.9 * Math.PI / 180), 7, 0, 7); c.fillStyle = '#fff'; c.fill();
    c.restore(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 3; c.stroke();
    var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
    var stats = [
      [D.trips, L(D.trips === 1 ? 'trip' : 'trips', D.trips === 1 ? 'reise' : 'reiser'), D.countries ? D.countries + L(D.countries === 1 ? ' country' : ' countries', D.countries === 1 ? ' land' : ' land') + ' · ' + D.days + L(' days away', ' dager borte') : ''],
      [D.workouts, D.workouts === 1 ? L('workout', 'treningsøkt') : L('workouts', 'treningsøkter'), D.km ? nf.format(D.km) + ' km' : ''],
      [D.ticks, D.ticks === 1 ? L('habit tick', 'vane krysset av') : L('habit ticks', 'vaner krysset av'), ''],
      [D.steps ? nf.format(D.steps / 1000) + 'k' : '–', L('steps', 'skritt'), D.steps ? nf.format(D.steps / Math.max(1, D.stepDays)) + L(' a day', ' om dagen') : ''],
      [D.talks, D.talks === 1 ? L('catch-up noted', 'samtale notert') : L('catch-ups noted', 'samtaler notert'), ''],
      [D.meals, D.meals === 1 ? L('dinner planned', 'middag planlagt') : L('dinners planned', 'middager planlagt'), ''],
      [nf.format(D.spent) + ' kr', L('spent, all logged', 'brukt, alt ført'), '']
    ].filter(function (s) { return s[0] && s[0] !== '–' && s[0] !== '0 kr'; }).slice(0, 6);
    stats.forEach(function (s, i) {
      var col = i % 2, row = Math.floor(i / 2), x = 80 + col * 470, y0 = 520 + row * 250;
      c.fillStyle = 'rgba(255,255,255,.06)'; if (c.roundRect) { c.beginPath(); c.roundRect(x, y0, 440, 220, 34); c.fill(); } else c.fillRect(x, y0, 440, 220);
      c.fillStyle = '#fff'; c.font = font(700, String(s[0]).length > 7 ? 64 : 92); c.fillText(String(s[0]), x + 36, y0 + 112);
      c.fillStyle = 'rgba(255,255,255,.75)'; c.font = font(500, 34); c.fillText(s[1], x + 36, y0 + 160);
      if (s[2]) { c.fillStyle = acc; c.font = font(500, 28); c.fillText(s[2], x + 36, y0 + 198); }
    });
    if (!stats.length) { c.fillStyle = 'rgba(255,255,255,.7)'; c.font = font(500, 40); c.fillText(L('A quiet year on the dashboard.', 'Et rolig år på dashbordet.'), 80, 640); }
    c.fillStyle = 'rgba(255,255,255,.45)'; c.font = font(500, 28); c.fillText('jplundberg.com', 80, H - 70);
    return cv;
  }
  function posterYear() { var d = new Date(); return d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear(); }
  function openPoster(y) {
    y = y || posterYear();
    var cv = poster(y), url = cv.toDataURL('image/png');
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg dl-pbg';
    bg.innerHTML = '<div class="fo-box lf-box dl-pbox" role="dialog" aria-modal="true" data-noi18n><div class="lf-head"><h3><i class="bi bi-stars"></i> ' + L('Your year', 'Året ditt') + ' ' + y + '</h3><button type="button" class="icon-btn sm" data-dlpx aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' +
      '<img class="dl-pimg" alt="" src="' + url + '"><div class="qa-acts"><button type="button" class="text-btn" data-dlpy="' + (y - 1) + '">‹ ' + (y - 1) + '</button><span class="spacer"></span>' +
      '<button type="button" class="pill-btn" data-dlpshare><i class="bi bi-' + (navigator.share ? 'share' : 'download') + '"></i> ' + (navigator.share ? L('Share', 'Del') : L('Save the picture', 'Lagre bildet')) + '</button></div>' +
      '<p class="muted hl-small">' + L('Made on this device from your own data – nothing is uploaded.', 'Laget på denne enheten fra dine egne data – ingenting lastes opp.') + '</p></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var close = function () { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 180); };
    bg.addEventListener('click', function (e) {
      if (e.target === bg || e.target.closest('[data-dlpx]')) return close();
      var b = e.target.closest('[data-dlpy]'); if (b) { close(); setTimeout(function () { openPoster(+b.dataset.dlpy); }, 200); return; }
      if (e.target.closest('[data-dlpshare]')) cv.toBlob(function (blob) {
        var f = new File([blob], 'my-year-' + y + '.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: L('My year ', 'Året mitt ') + y }).catch(function () {});
        else { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
      });
    });
  }
  window.Delight.poster = openPoster; window.Delight.yearData = yearData;
  /* a button in the Year in review */
  new MutationObserver(function () {
    var body = document.getElementById('rvBody'); if (!body || body.querySelector('.dl-pbtn') || !on('poster')) return;
    var yr = document.querySelector('#rvKind [data-rk="year"][aria-pressed="true"]'); if (!yr) return;
    var pick = document.getElementById('rvPick'), y = pick && /^\d{4}$/.test(pick.value) ? +pick.value : posterYear();
    body.insertAdjacentHTML('afterbegin', '<button type="button" class="pill-btn dl-pbtn" data-dlposter="' + y + '" data-noi18n><i class="bi bi-image"></i> ' + L('Make a poster of ', 'Lag en plakat av ') + y + '</button>');
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-dlposter]'); if (b) openPoster(+b.dataset.dlposter); });
  window.CommandExtra = window.CommandExtra || [];
  window.CommandExtra.push(function () { return on('poster') ? [{ i: 'image', t: L('Year poster', 'Årsplakat'), s: L('One picture of your year', 'Ett bilde av året ditt'), run: function () { openPoster(); }, x: 'year poster share review plakat år' }] : []; });
  window.BriefExtra = window.BriefExtra || [];
  window.BriefExtra.push(function (add, now) {
    var m = now.getMonth(), d = now.getDate();
    if (on('poster') && ((m === 11 && d >= 15) || (m === 0 && d <= 15))) add(70, 'image', '#8a6fdf', L('Your year as one picture', 'Året ditt som ett bilde'), L('Make the poster and share it', 'Lag plakaten og del den'), '#', { tip: true, key: 'poster:' + posterYear(), act: { id: 'poster:' + posterYear(), label: L('Make it', 'Lag den') }, run: function () { openPoster(); } });
  });

  /* ---------- Settings → Pictures & touches ---------- */
  function row(k, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-dltouch="' + k + '"' + (on(k) ? ' checked' : '') + '></label>'; }
  function sub(icon, t) { return '<p class="st-sub ap-sub"><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</p>'; }
  function fill() {
    var box = document.getElementById('dlSet'); if (!box) return;
    var hl = window.HomeLife, house = hl ? !!hl.cfg('housecfg').illu : true, wx = all().wx;
    box.innerHTML = '<div data-noi18n><p class="st-intro">' + L('Small things that make the dashboard feel alive. Each one can be switched off.', 'Små ting som gjør dashbordet levende. Alt kan slås av.') + '</p>' +
      sub('image', L('A picture at the top of each page', 'Et bilde øverst på hver side')) + '<div class="st-group">' +
      '<label class="st-row"><span>' + L('House', 'Bolig') + '<small class="st-rsub">' + L('What’s due lights up', 'Det som må gjøres lyser opp') + '</small></span><input type="checkbox" class="switch" data-dlhouse' + (house ? ' checked' : '') + '></label>' +
      row('scPeople', L('People', 'Personer'), L('A table: birthdays, gifts, who to call', 'Et bord: bursdager, gaver, hvem du bør ringe')) +
      row('scFood', L('Food', 'Mat'), L('Fridge, pantry shelf and tonight’s pot', 'Kjøleskap, matskaphylle og kveldens gryte')) +
      row('scWork', L('Work', 'Jobb'), L('Desk: flex clock, papers, hard hat, coffee', 'Pult: fleksiklokke, papirer, hjelm, kaffe')) +
      row('scHealth', L('Health', 'Helse'), L('Rested or tired, steps, training day', 'Uthvilt eller trøtt, skritt, treningsdag')) +
      row('scFin', L('Finances', 'Økonomi'), L('A jar with what’s left this month', 'En krukke med det som er igjen denne måneden')) +
      row('scTravel', L('Travel', 'Reise'), L('Suitcase, countdown tag and a plane on its way', 'Koffert, nedtellingslapp og et fly på vei')) + '</div>' +
      sub('brightness-alt-high', L('Living details', 'Levende detaljer')) + '<div class="st-group">' +
      row('tod', L('Time of day', 'Tid på døgnet'), L('Lit windows in the evening, sun or moon', 'Lys i vinduene om kvelden, sol eller måne')) +
      '<label class="st-row"><span>' + L('Weather in the background', 'Været i bakgrunnen') + '<small class="st-rsub">' + L('Soft rain, snow, sun or fog from the forecast', 'Myk regn, snø, sol eller tåke fra varselet') + '</small></span><select class="st-select" data-dlwx>' +
        [['off', L('Off', 'Av')], ['home', L('Home only', 'Bare Hjem')], ['all', L('Every page', 'Alle sider')]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === wx ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      row('season', L('Seasons and holidays', 'Årstider og høytider'), L('Advent star, 17 May flags, autumn leaves …', 'Adventsstjerne, 17. mai-flagg, høstløv …')) +
      row('confetti', L('Celebrations', 'Feiring'), L('A little confetti when a list or a weekly target is done', 'Litt konfetti når en liste eller et ukemål er nådd')) +
      row('flames', L('Streak flames', 'Strekk-flammer'), L('Next to habits and people you keep in touch with', 'Ved vaner og folk du holder kontakten med')) + '</div>' +
      sub('sunrise', L('At a glance', 'Kort fortalt')) + '<div class="st-group">' +
      row('morning', L('Morning briefing', 'Morgenoppsummering'), L('One sentence about the day, 05–11', 'Én setning om dagen, 05–11')) +
      row('evening', L('Evening wrap-up', 'Kveldsoppsummering'), L('What you got done, and tomorrow’s first thing, from 17:00', 'Hva du fikk gjort, og det første i morgen, fra 17:00')) +
      row('poster', L('Year poster', 'Årsplakat'), L('Offered mid-December to mid-January, and in the Year in review', 'Foreslås fra midten av desember til midten av januar, og i Året som gikk')) + '</div>' +
      sub('app-indicator', L('App icon badge', 'Merke på app-ikonet')) + '<div class="st-group">' +
      row('badgeHouse', L('Overdue house jobs', 'Forfalte jobber i huset')) + row('badgeBday', L('Birthdays today', 'Bursdager i dag')) + '</div>' +
      sub('phone', L('On a phone', 'På telefon')) + '<div class="st-group">' + row('swipe', L('Swipe between pages', 'Sveip mellom sider'), L('Left and right, in your menu order', 'Til venstre og høyre, i menyrekkefølgen')) + '</div></div>';
  }
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-dltouch]');
    if (i) { var p = {}; p[i.dataset.dltouch] = i.checked; set(p); }
    else if (e.target.closest('[data-dlwx]')) set({ wx: e.target.value });
    else if (e.target.closest('[data-dlhouse]') && window.HomeLife) window.HomeLife.setCfg('housecfg', { illu: e.target.checked });
    else return;
    if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-check2"></i> ' + L('Saved', 'Lagret'));
  });
  window.addEventListener('st:page', function (e) { if (e.detail === 'touches') fill(); });

  /* ---------- wiring ---------- */
  function refresh() { tod(); weather(); flames(); briefLine(); }
  window.addEventListener('touch:change', refresh);
  window.addEventListener('dash:local', function () { clearTimeout(refresh.t); refresh.t = setTimeout(function () { tod(); flames(); }, 60); });
  ['tools:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(checkDone.t); checkDone.t = setTimeout(checkDone, 400); }); });
  if (window.Vault) window.Vault.onUnlock(function () { setTimeout(function () { refresh(); checkDone(); }, 300); });
  setInterval(briefLine, 10 * 60e3);
  window.addEventListener('pageshow', function () { root.classList.remove('dl-swipe-l', 'dl-swipe-r'); });
})();
