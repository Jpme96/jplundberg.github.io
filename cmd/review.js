/* Reviews: a monthly check-in (last month + the month ahead) and a year in review.
   Everything is worked out here from your own data – nothing is stored or sent.
   Open from "At a glance" (it offers them on the 1st–7th, and from mid-December), or the
   Reviews button on that card, or search "review". */
(function () {
  "use strict";
  if (!window.Vault) return;
  var Fe = window.Features, C = window.Cal, Fl = window.Flow;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function ymOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function shiftYm(k, n) { var p = k.split('-'); return ymOf(new Date(+p[0], +p[1] - 1 + n, 1)); }
  function mName(k, o) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('en-GB', o || { month: 'long' }); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function sum(l, f) { return (l || []).reduce(function (a, x) { return a + (+(f ? f(x) : x.amount) || 0); }, 0); }
  function hm(min) { var h = Math.floor(Math.abs(min) / 60), m = Math.round(Math.abs(min) % 60); return (min < 0 ? '−' : '') + (h ? h + 'h ' : '') + m + 'm'; }
  var CATNAME = { groceries: 'Groceries', eating: 'Eating out', transport: 'Transport', shopping: 'Shopping', fun: 'Fun', health: 'Health', travel: 'Travel', other: 'Other' };

  /* ---------- the numbers ---------- */
  function money(keyOf, test) {
    var d = window.Vault.get() || {}, ex = (d.expenses || []).filter(function (e) { return test(String(e.date)); });
    var by = {}; ex.forEach(function (e) { var c = CATNAME[e.cat] ? e.cat : 'other'; by[c] = (by[c] || 0) + (+e.amount || 0); });
    var cats = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
    /* income for the month (a year: the ordinary monthly net – June and December differ, so the year uses the sum) */
    var Bu = window.Budget, income, yearNet = 0;
    if (Bu && /^\d{4}-\d{2}$/.test(keyOf)) income = Bu.income(d, keyOf);
    else if (Bu) { for (var i = 1; i <= 12; i++) yearNet += Bu.income(d, keyOf + '-' + String(i).padStart(2, '0')); income = yearNet / 12; }
    else income = sum((d.budget || {}).income);
    var fixed = sum((d.budget || {}).fixed);
    return { spent: sum(ex), by: by, cats: cats, income: income, fixed: fixed, list: ex };
  }
  function habitsIn(from, to) {          /* weeks on target and ticks between two day keys */
    var hb = readJSON('dash.habits') || { list: [], log: {} }, out = [];
    (hb.list || []).forEach(function (h) {
      var ticks = 0, weeks = 0, met = 0;
      Object.keys(hb.log || {}).forEach(function (k) { if (k >= from && k <= to && hb.log[k].indexOf(h.id) > -1) ticks++; });
      var d = new Date(from + 'T12:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
      for (; dkey(d) <= to; d.setDate(d.getDate() + 7)) {
        var n = 0; for (var i = 0; i < 7; i++) { var x = new Date(d); x.setDate(d.getDate() + i); var k = dkey(x); if ((hb.log[k] || []).indexOf(h.id) > -1) n++; }
        weeks++; if (n >= h.target) met++;
      }
      out.push({ name: h.name, ticks: ticks, weeks: weeks, met: met, target: h.target });
    });
    return out;
  }
  function list(key) { return Fe && Fe.on(key) ? Fe.list(key) : []; }
  function tripsIn(from, to) {
    if (!Fl) return [];
    return Fl.travel().trips.filter(function (t) { return t.start && t.start <= to && (t.end || t.start) >= from; });
  }
  function flexMinutes(from, to) {
    var norm = ((Fe && Fe.tools().flexcfg) || {}).norm || 7.5, days = {};
    list('flex').forEach(function (e) {
      if (e.date < from || e.date > to) return;
      var r = days[e.date] = days[e.date] || { w: 0, free: false };
      if (e.type === 'vacation' || e.type === 'sick' || e.type === 'holiday') r.free = true;
      if ((e.type === 'work' || e.type === 'course') && e.in && e.out) {
        var a = e.in.split(':'), b = e.out.split(':'), m = (+b[0] * 60 + +b[1]) - (+a[0] * 60 + +a[1]); if (m < 0) m += 1440;
        r.w += Math.max(0, m - (+e.brk || 0));
      }
    });
    var worked = 0, delta = 0;
    Object.keys(days).forEach(function (k) { worked += days[k].w; if (!days[k].free) delta += days[k].w - (Fe && Fe.holiday(k) ? 0 : norm * 60); });
    return { worked: worked, delta: delta, days: Object.keys(days).length };
  }

  /* ---------- building blocks ---------- */
  function big(icon, color, value, label, sub) {
    return '<div class="rv-big" style="--c:' + color + '"><i class="bi bi-' + icon + '"></i><b>' + value + '</b><span>' + esc(label) + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
  }
  function section(title, icon, body) { return body ? '<section class="rv-sec"><h3><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h3>' + body + '</section>' : ''; }
  function bars(rows, max) {
    return '<ul class="rv-bars">' + rows.map(function (r) {
      return '<li><span class="n">' + esc(r[0]) + '</span><span class="b"><i style="width:' + Math.max(3, Math.round(r[1] / (max || 1) * 100)) + '%;--c:' + (r[3] || 'var(--accent)') + '"></i></span><span class="v">' + r[2] + '</span></li>';
    }).join('') + '</ul>';
  }

  /* ---------- monthly check-in ---------- */
  function monthHtml(ym) {
    var from = ym + '-01', last = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0), to = dkey(last);
    var M = money(ym, function (k) { return k.slice(0, 7) === ym; });
    var prev3 = [1, 2, 3].map(function (i) { var k = shiftYm(ym, -i); return money(k, function (x) { return x.slice(0, 7) === k; }); });
    var avg = sum(prev3, function (m) { return m.spent; }) / 3;
    var left = M.income - M.fixed - M.spent;
    var html = '<p class="rv-kicker">Monthly check-in</p><h2>' + esc(mName(ym, { month: 'long', year: 'numeric' })) + '</h2>';
    var tiles = '';
    if (M.income || M.spent) tiles += big('wallet2', '#11a597', kr(M.spent), 'spent', avg ? (M.spent > avg ? '<span class="dn">' : '<span class="up">') + Math.round(Math.abs(M.spent - avg) / Math.max(avg, 1) * 100) + '% ' + (M.spent > avg ? 'more' : 'less') + '</span> than usual' : '');
    if (M.income) tiles += big('piggy-bank', left >= 0 ? '#22b35e' : '#e66767', kr(Math.abs(left)), left >= 0 ? 'left over' : 'over budget', left >= 0 ? Math.round(left / M.income * 100) + '% of income' : '');
    var trips = tripsIn(from, to);
    if (trips.length) tiles += big('suitcase-lg', '#0891b2', trips.length, 'trip' + (trips.length > 1 ? 's' : ''), esc(trips.map(function (t) { return t.name; }).join(', ')));
    var wo = list('training').filter(function (w) { return w.date >= from && w.date <= to; });
    if (wo.length) tiles += big('heart-pulse', '#d55181', wo.length, 'workouts', hm(sum(wo, function (w) { return w.min; })) + (sum(wo, function (w) { return w.km; }) ? ' · ' + Math.round(sum(wo, function (w) { return w.km; })) + ' km' : ''));
    var fx = flexMinutes(from, to);
    if (fx.worked) tiles += big('stopwatch', '#e8743b', (fx.delta >= 0 ? '+' : '') + hm(fx.delta), 'flex', hm(fx.worked) + ' worked');
    /* Apple Health: steps and sleep for the month */
    var AH = window.AHealth;
    if (AH && (!Fe || Fe.on('ahealth'))) {
      var ah = AH.stats(from, to);
      if (ah.steps.n) tiles += big('person-walking', '#22b35e', AH.fmt('steps', ah.steps.avg), 'steps a day', ah.sleep.n ? AH.fmt('sleep', ah.sleep.avg) + ' sleep a night' : '');
      else if (ah.sleep.n) tiles += big('moon-stars', '#8a6fdf', AH.fmt('sleep', ah.sleep.avg), 'sleep a night', '');
    }
    html += tiles ? '<div class="rv-grid">' + tiles + '</div>' : '<p class="muted">Not much logged this month yet.</p>';
    if (M.cats.length) html += section('Where the money went', 'pie-chart', bars(M.cats.slice(0, 5).map(function (c) {
      var p = sum(prev3, function (m) { return m.by[c] || 0; }) / 3, diff = p ? Math.round((M.by[c] - p) / p * 100) : null;
      return [CATNAME[c], M.by[c], kr(M.by[c]) + (diff !== null && Math.abs(diff) >= 15 ? ' <small class="' + (diff > 0 ? 'dn' : 'up') + '">' + (diff > 0 ? '+' : '') + diff + '%</small>' : '')];
    }), M.by[M.cats[0]]));
    var hb = habitsIn(from, to);
    if (hb.length) html += section('Habits', 'activity', bars(hb.map(function (h) { return [h.name, h.met, h.met + ' of ' + h.weeks + ' weeks on target', '#d55181']; }), Math.max.apply(null, hb.map(function (h) { return h.weeks; }))));
    var jr = list('journal').filter(function (j) { return j.date >= from && j.date <= to; });
    if (jr.length) {
      var avgMood = sum(jr, function (j) { return j.mood; }) / jr.length, best = jr.slice().sort(function (a, b) { return b.mood - a.mood; })[0];
      html += section('How it felt', 'emoji-smile', '<p>' + jr.length + ' day' + (jr.length > 1 ? 's' : '') + ' written · average mood <b>' + ['', 'bad', 'meh', 'OK', 'good', 'great'][Math.round(avgMood)] + '</b></p>' + (best ? '<p class="rv-quote">“' + esc(best.line) + '” <small>' + esc(new Date(best.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</small></p>' : ''));
    }
    /* the month ahead (only for the month that just ended) */
    if (ym === shiftYm(ymOf(new Date()), -1)) {
      var nf0 = new Date(), n0 = new Date(nf0.getFullYear(), nf0.getMonth(), 1), n1 = new Date(nf0.getFullYear(), nf0.getMonth() + 1, 1), ahead = [];
      if (C) {
        var occ = C.occurrences(n0, n1).filter(function (o) { return o.ev.own || o.ev.src; });
        if (occ.length) ahead.push('<li><i class="bi bi-calendar3"></i>' + occ.length + ' event' + (occ.length > 1 ? 's' : '') + ' in your calendar</li>');
        var hol = Fe ? Fe.holidays(n0.getFullYear()).filter(function (h) { return h.date.slice(0, 7) === ymOf(n0); }) : [];
        if (hol.length) ahead.push('<li><i class="bi bi-flag"></i>' + esc(hol.map(function (h) { return h.name; }).join(', ')) + '</li>');
      }
      tripsIn(dkey(n0), dkey(new Date(n1 - 864e5))).forEach(function (t) { ahead.push('<li><i class="bi bi-suitcase-lg"></i>' + esc(t.name) + ' · ' + esc(new Date(t.start + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</li>'); });
      var d = window.Vault.get() || {}, bills = ((d.budget || {}).fixed || []).filter(function (f) { return f.day; });
      if (bills.length) ahead.push('<li><i class="bi bi-receipt"></i>' + bills.length + ' bills · ' + kr(sum(bills)) + '</li>');
      if (Fe) Fe.events().forEach(function (ev) {
        if (ev.cat || ev.rule) return;
        if (dkey(ev.start).slice(0, 7) === ymOf(n0)) ahead.push('<li><i class="bi bi-bell"></i>' + esc(ev.title) + '</li>');
      });
      if (ahead.length) html += section(mName(ymOf(n0)) + ' ahead', 'arrow-right-circle', '<ul class="rv-ahead">' + ahead.slice(0, 8).join('') + '</ul>');
    }
    return html;
  }

  /* ---------- year in review ---------- */
  function yearHtml(y) {
    y = String(y);
    var from = y + '-01-01', to = y + '-12-31';
    var M = money(y, function (k) { return k.slice(0, 4) === y; });
    var html = '<p class="rv-kicker">Year in review</p><h2>' + esc(y) + '</h2>', tiles = '';
    var trips = tripsIn(from, to), countries = {}, daysAway = 0;
    trips.forEach(function (t) {
      if (t.place && t.place.cc && t.place.cc !== 'NO') countries[t.place.cc] = t.place.country;
      var a = new Date((t.start < from ? from : t.start) + 'T12:00'), b = new Date(((t.end || t.start) > to ? to : (t.end || t.start)) + 'T12:00');
      daysAway += Math.round((b - a) / 864e5) + 1;
    });
    if (trips.length) tiles += big('globe-europe-africa', '#0891b2', trips.length, 'trips', daysAway + ' days away' + (Object.keys(countries).length ? ' · ' + Object.keys(countries).length + ' countr' + (Object.keys(countries).length > 1 ? 'ies' : 'y') : ''));
    if (M.spent) tiles += big('wallet2', '#11a597', kr(M.spent), 'spent', M.cats[0] ? 'most on ' + CATNAME[M.cats[0]].toLowerCase() : '');
    /* only months where you actually logged spending count – the rest would be guesses */
    var logged = {}; M.list.forEach(function (e) { logged[String(e.date).slice(0, 7)] = 1; });
    var months = Object.keys(logged).filter(function (k) { return k <= ymOf(new Date()); }).length;
    if (M.income && months) { var saved = M.income * months - M.fixed * months - M.spent; tiles += big('piggy-bank', saved >= 0 ? '#22b35e' : '#e66767', kr(Math.abs(saved)), saved >= 0 ? 'left over' : 'over budget', 'after fixed costs, over the ' + months + ' month' + (months > 1 ? 's' : '') + ' you logged'); }
    var wo = list('training').filter(function (w) { return w.date >= from && w.date <= to; });
    if (wo.length) tiles += big('heart-pulse', '#d55181', wo.length, 'workouts', hm(sum(wo, function (w) { return w.min; })) + (sum(wo, function (w) { return w.km; }) ? ' · ' + Math.round(sum(wo, function (w) { return w.km; })) + ' km' : ''));
    var done = list('learning').filter(function (c) { return c.status === 'done' && String(c.date || '').slice(0, 4) === y; });
    if (done.length) tiles += big('mortarboard', '#8a6fdf', done.length, 'courses done', esc(done.slice(0, 2).map(function (c) { return c.title; }).join(', ')));
    var fx = flexMinutes(from, to), vac = list('flex').filter(function (e) { return e.type === 'vacation' && String(e.date).slice(0, 4) === y; }).length;
    if (fx.worked) tiles += big('stopwatch', '#e8743b', hm(fx.worked).replace(/ \d+m$/, ''), 'worked', vac ? vac + ' holiday days' : '');
    else if (vac) tiles += big('sun', '#e8743b', vac, 'holiday days', '');
    html += tiles ? '<div class="rv-grid">' + tiles + '</div>' : '<p class="muted">Nothing logged for ' + esc(y) + ' yet.</p>';
    /* money per month */
    var per = []; for (var i = 1; i <= 12; i++) { var key = y + '-' + pad(i); per.push([mName(key, { month: 'short' }), sum(M.list.filter(function (e) { return String(e.date).slice(0, 7) === key; }))]); }
    var maxM = Math.max.apply(null, per.map(function (p) { return p[1]; }));
    if (maxM) {
      var top = per.slice().sort(function (a, b) { return b[1] - a[1]; })[0];
      html += section('Spending through the year', 'bar-chart', '<div class="rv-cols">' + per.map(function (p) {
        return '<span title="' + esc(p[0] + ': ' + kr(p[1])) + '"><i style="height:' + Math.max(2, Math.round(p[1] / maxM * 100)) + '%"></i><small>' + esc(p[0].charAt(0)) + '</small></span>';
      }).join('') + '</div><p class="muted">Biggest month: <b>' + esc(top[0]) + '</b> · ' + kr(top[1]) + '</p>');
    }
    if (M.cats.length) html += section('Where the money went', 'pie-chart', bars(M.cats.slice(0, 6).map(function (c) { return [CATNAME[c], M.by[c], kr(M.by[c])]; }), M.by[M.cats[0]]));
    if (trips.length) html += section('Trips', 'suitcase-lg', '<ul class="rv-ahead">' + trips.map(function (t) { return '<li><i class="bi bi-geo-alt"></i>' + esc(t.name) + (t.place ? ' · ' + esc(t.place.country) : '') + ' · ' + esc(new Date(t.start + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</li>'; }).join('') + '</ul>');
    var hb = habitsIn(from, to < dkey(new Date()) ? to : dkey(new Date()));
    if (hb.length) html += section('Habits', 'activity', bars(hb.map(function (h) { return [h.name, h.met, h.met + ' of ' + h.weeks + ' weeks · ' + h.ticks + ' times', '#d55181']; }), Math.max.apply(null, hb.map(function (h) { return h.weeks; }))));
    var jr = list('journal').filter(function (j) { return String(j.date).slice(0, 4) === y; });
    if (jr.length) {
      var best = jr.slice().sort(function (a, b) { return b.mood - a.mood || (a.date < b.date ? 1 : -1); }).slice(0, 3);
      html += section('Best days', 'stars', best.map(function (j) { return '<p class="rv-quote">“' + esc(j.line) + '” <small>' + esc(new Date(j.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</small></p>'; }).join(''));
    }
    return html;
  }

  /* ---------- the sheet ---------- */
  var bg = document.createElement('div');
  bg.className = 'sr-bg rv-bg'; bg.hidden = true;
  bg.innerHTML = '<div class="sr-box rv-box" role="dialog" aria-modal="true" aria-label="Review"><div class="rv-top">' +
    '<div class="seg" id="rvKind"><button type="button" data-rk="month">Month</button><button type="button" data-rk="year">Year</button></div>' +
    '<select id="rvPick" aria-label="Which"></select><button type="button" class="text-btn" data-rvclose>Close</button></div><div class="rv-body" id="rvBody"></div></div>';
  document.body.appendChild(bg);
  var kind = 'month', key = '';
  function years() {
    var ys = {}, d = window.Vault.get() || {}; ys[new Date().getFullYear()] = 1;
    (d.expenses || []).forEach(function (e) { ys[String(e.date).slice(0, 4)] = 1; });
    if (Fl) Fl.travel().trips.forEach(function (t) { if (t.start) ys[t.start.slice(0, 4)] = 1; });
    return Object.keys(ys).filter(function (y) { return /^\d{4}$/.test(y); }).sort().reverse();
  }
  function draw() {
    bg.querySelectorAll('[data-rk]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.rk === kind)); });
    var opts = [];
    if (kind === 'month') { var cur = ymOf(new Date()); for (var i = 0; i < 24; i++) { var k = shiftYm(cur, -i); opts.push([k, mName(k, { month: 'long', year: 'numeric' })]); } }
    else years().forEach(function (y) { opts.push([y, y]); });
    if (!opts.some(function (o) { return o[0] === key; })) key = kind === 'month' ? shiftYm(ymOf(new Date()), -1) : String(new Date().getFullYear());
    bg.querySelector('#rvPick').innerHTML = opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === key ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    bg.querySelector('#rvBody').innerHTML = kind === 'month' ? monthHtml(key) : yearHtml(key);
    bg.querySelector('#rvBody').scrollTop = 0;
  }
  function open(k, which) {
    if (!window.Vault.get()) return;
    kind = k || 'month'; key = which || '';
    draw();
    bg.hidden = false; requestAnimationFrame(function () { bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
    try { localStorage.setItem('dash.reviewSeen.' + kind + '.' + key, '1'); } catch (e) {}
    window.dispatchEvent(new Event('review:seen'));
  }
  function close() { bg.classList.remove('open'); document.documentElement.classList.remove('cl-modal'); setTimeout(function () { bg.hidden = true; }, 180); }
  bg.addEventListener('click', function (e) {
    var b;
    if (e.target === bg || e.target.closest('[data-rvclose]')) return close();
    if ((b = e.target.closest('[data-rk]'))) { kind = b.dataset.rk; key = ''; draw(); }
  });
  bg.querySelector('#rvPick').addEventListener('change', function () { key = this.value; draw(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bg.hidden) close(); });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-review]'); if (b) { e.preventDefault(); var p = b.dataset.review.split(':'); open(p[0], p[1]); } });
  /* arriving from search (…/#review=month) */
  function fromHash() { var m = location.hash.match(/^#review=(month|year)$/); if (m) { history.replaceState(null, '', location.pathname); setTimeout(function () { open(m[1]); }, 300); } }
  window.Vault.onUnlock(fromHash);
  window.addEventListener('hashchange', fromHash);

  /* what At a glance should offer right now */
  function due() {
    var now = new Date(), out = [];
    if (now.getDate() <= 7) {
      var last = shiftYm(ymOf(now), -1);
      if (!readJSON('dash.reviewSeen.month.' + last)) out.push({ kind: 'month', key: last, title: 'Your ' + mName(last) + ' check-in', sub: 'Last month at a glance – and the month ahead' });
    }
    var y = now.getMonth() === 11 && now.getDate() >= 15 ? now.getFullYear() : now.getMonth() === 0 && now.getDate() <= 15 ? now.getFullYear() - 1 : null;
    if (y && !readJSON('dash.reviewSeen.year.' + y)) out.push({ kind: 'year', key: String(y), title: 'Your ' + y + ' in review', sub: 'Trips, money, workouts and habits' });
    return out;
  }
  window.Review = { open: open, due: due };
})();
