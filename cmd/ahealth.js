/* Apple Health: steps, sleep, resting heart rate, exercise and weight from your iPhone.

   An iPhone Shortcut sends the day's numbers to your server (/cmd/api/health, with an Access
   service token that can do nothing else). The next time the dashboard opens it takes them,
   puts them in your encrypted vault (d.health.days) and deletes them from the server.
   A link works too: /cmd/?health=1&date=2026-10-28&steps=8234&sleep=7.2 …

   Connected to: Health page (card + habit ticks), At a glance (short nights), the weekly
   check-in, the monthly review, search. Switch on/off in Settings → Features → Apple Health. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var $ = function (id) { return document.getElementById(id); };
  var Fe = window.Features;
  var API = '/cmd/api/health';
  var F = ['steps', 'sleep', 'exercise', 'active', 'stand', 'distance', 'flights', 'hr', 'rhr', 'hrv', 'vo2', 'weight', 'mindful', 'water', 'daylight'];
  var LABEL = { steps: 'Steps', sleep: 'Sleep', rhr: 'Resting heart rate', active: 'Active energy', exercise: 'Exercise', weight: 'Weight', distance: 'Walking + running', flights: 'Flights climbed',
    hr: 'Heart rate', stand: 'Stand hours', hrv: 'Heart rate variability', vo2: 'Cardio fitness', mindful: 'Mindfulness', water: 'Water', daylight: 'Time in daylight' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(k, n) { var d = new Date(k + 'T12:00'); d.setDate(d.getDate() + n); return dkey(d); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function num(v) { if (v == null || v === '') return null; var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) && n >= 0 ? n : null; }
  /* sleep can arrive as hours, minutes or seconds – whatever the Shortcut produced */
  function hours(v) { v = num(v); if (v == null) return null; return v > 1440 ? v / 3600 : v > 24 ? v / 60 : v; }
  /* units differ between iPhones – metres or km, ml or litres */
  function norm(f, v) { if (v == null) return v; if (f === 'distance' && v > 300) return v / 1000; if (f === 'water' && v > 20) return v / 1000; return v; }
  function hm(h) { var m = Math.round(h * 60); return Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min'; }
  function fmt(f, v) {
    if (v == null) return '–';
    if (f === 'sleep') return hm(v);
    if (f === 'rhr' || f === 'hr') return Math.round(v) + ' bpm';
    if (f === 'active') return nf.format(v) + ' kcal';
    if (f === 'exercise') return Math.round(v) + ' min';
    if (f === 'weight') return nf1.format(v) + ' kg';
    if (f === 'distance') return nf1.format(v) + ' km';
    if (f === 'stand') return Math.round(v) + ' h';
    if (f === 'hrv') return Math.round(v) + ' ms';
    if (f === 'vo2') return nf1.format(v);
    if (f === 'mindful' || f === 'daylight') return Math.round(v) + ' min';
    if (f === 'water') return nf1.format(v) + ' l';
    if (f === 'flights') return Math.round(v) + ' floors';
    return nf.format(v);
  }

  /* 0 h sleep, 0 bpm or 0 kg means the Shortcut found nothing – treat it as no number, not a real one */
  var ZERO_IS_EMPTY = { sleep: 1, hr: 1, rhr: 1, weight: 1, hrv: 1, vo2: 1 };
  function days() {
    var d = window.Vault.get() || {}, D = (d.health && d.health.days) || {}, out = {};
    Object.keys(D).forEach(function (k) { var x = {}; Object.keys(D[k]).forEach(function (f) { if (!(ZERO_IS_EMPTY[f] && D[k][f] === 0)) x[f] = D[k][f]; }); out[k] = x; });
    return out;
  }
  /* put days in the vault, tick habits that follow a number, tell the rest of the dashboard */
  function merge(list, source) {
    var d = window.Vault.get(); if (!d || !list.length) return 0;
    d.health = d.health || {}; d.health.days = d.health.days || {};
    var n = 0;
    list.forEach(function (x) {
      var k = /^\d{4}-\d{2}-\d{2}/.test(String(x.date || '')) ? String(x.date).slice(0, 10) : dkey(new Date());
      var cur = d.health.days[k] || {}, ch = false;
      F.forEach(function (f) { var v = f === 'sleep' ? hours(x[f]) : norm(f, num(x[f])); if (v === 0 && ZERO_IS_EMPTY[f]) v = null; if (v != null) { cur[f] = Math.round(v * 100) / 100; ch = true; } });
      if (ch) { cur.t = Date.now(); d.health.days[k] = cur; n++; }
    });
    var keys = Object.keys(d.health.days).sort(); if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(function (k) { delete d.health.days[k]; });
    d.health.last = Date.now();
    window.Vault.save(d);
    if (Fe && !Fe.on('ahealth')) Fe.set('ahealth', true);          // first numbers: show the card
    tickHabits();
    window.dispatchEvent(new Event('health:change'));
    if (n && window.Quick) {
      var last = list[list.length - 1], bits = [];
      if (last.steps != null) bits.push(fmt('steps', num(last.steps)) + ' steps');
      if (hours(last.sleep)) bits.push(fmt('sleep', hours(last.sleep)) + ' sleep');
      window.Quick.toast('<i class="bi bi-heart-pulse"></i> Apple Health' + (n > 1 ? ': ' + n + ' days' : bits.length ? ': ' + esc(bits.join(' · ')) : ' updated'));
    }
    return n;
  }
  /* habits can follow a number: "Exercise ≥ 30 min" ticks Training that day */
  function tickHabits() {
    var hb = readJSON('dash.habits', null); if (!hb || !hb.list) return;
    var D = days(), ch = false; hb.log = hb.log || {};
    hb.list.forEach(function (h) {
      if (!h.auto || !h.auto.m || !(+h.auto.min > 0)) return;
      Object.keys(D).forEach(function (k) {
        var v = D[k][h.auto.m]; if (v == null || v < +h.auto.min) return;
        var l = hb.log[k] = hb.log[k] || [];
        if (l.indexOf(h.id) < 0) { l.push(h.id); ch = true; }
      });
    });
    if (ch) { writeJSON('dash.habits', hb); window.dispatchEvent(new Event('habits:change')); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
  }

  /* ---------- picking up what the Shortcut sent ---------- */
  function pull() {
    if (!window.Vault.get()) return;
    fetch(API, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.items || !j.items.length) return;
      merge(j.items, 'server');
      return fetch(API, { method: 'DELETE', credentials: 'same-origin' });
    }).catch(function () {});
  }
  /* …or a link: ?health=1&steps=…&sleep=… */
  (function () {
    var q = new URLSearchParams(location.search);
    if (!q.has('health')) return;
    var x = { date: q.get('date') || '' };
    F.forEach(function (f) { if (q.has(f)) x[f] = q.get(f); });
    ['health', 'date'].concat(F).forEach(function (f) { q.delete(f); });
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    var pend = readJSON('dash.healthPending', []); pend.push(x); try { localStorage.setItem('dash.healthPending', JSON.stringify(pend.slice(-30))); } catch (e) {}
  })();
  function pending() {
    var p = readJSON('dash.healthPending', []);
    if (!p.length) return;
    try { localStorage.removeItem('dash.healthPending'); } catch (e) {}
    merge(p, 'link');
  }
  window.Vault.onUnlock(function () { setTimeout(function () { pending(); pull(); }, 600); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && window.Vault.get()) pull(); });

  /* ---------- summaries other parts use ---------- */
  function stats(from, to) {
    var D = days(), out = { n: 0 };
    F.forEach(function (f) { out[f] = { sum: 0, n: 0 }; });
    Object.keys(D).forEach(function (k) {
      if (k < from || k > to) return; out.n++;
      F.forEach(function (f) { if (D[k][f] != null) { out[f].sum += D[k][f]; out[f].n++; } });
    });
    F.forEach(function (f) { out[f].avg = out[f].n ? out[f].sum / out[f].n : null; });
    return out;
  }
  function latest(f) { var D = days(), ks = Object.keys(D).sort().reverse(); for (var i = 0; i < ks.length; i++) if (D[ks[i]][f] != null) return { date: ks[i], v: D[ks[i]][f] }; return null; }

  /* ---------- the card on the Health page ---------- */
  var METRICS = [['steps', 'Steps', 'person-walking', '#22b35e'], ['sleep', 'Sleep', 'moon-stars', '#8a6fdf'], ['exercise', 'Exercise', 'activity', '#e8743b'],
    ['active', 'Energy', 'fire', '#c98500'], ['stand', 'Stand', 'person-standing', '#2aa7c9'], ['distance', 'Distance', 'signpost-split', '#3fa36b'], ['flights', 'Flights', 'bar-chart-steps', '#9b7b4f'],
    ['hr', 'Heart rate', 'heart-pulse-fill', '#e0475b'], ['rhr', 'Resting HR', 'heart', '#e66767'], ['hrv', 'HRV', 'heart-pulse', '#d0568f'], ['vo2', 'Fitness', 'lungs', '#e0577a'], ['weight', 'Weight', 'speedometer', '#3987e5'],
    ['mindful', 'Mindful', 'flower1', '#5bb5a2'], ['water', 'Water', 'droplet', '#3b9de0'], ['daylight', 'Daylight', 'sun', '#d9a400']];
  /* lower is better for these */
  var LOWER = { rhr: 1, weight: 1 };
  /* no better or worse direction: the change is shown without colour */
  var NEUTRAL = { hr: 1 };
  var chartM = 'steps', range = 14, selDay = null, editGoal = false;
  try { range = +localStorage.getItem('dash.ahRange') || 14; } catch (e) {}
  /* goals: the dashed line, the tile progress and "Goal reached" – change them on the card */
  var GOAL_DEF = { steps: 10000, sleep: 7, exercise: 30, active: 500, stand: 12, distance: 5, flights: 10, mindful: 10, water: 2, daylight: 30 };
  function goals() { var g = (readJSON('dash.settings', {}) || {}).ahGoals || {}, out = {}; Object.keys(GOAL_DEF).forEach(function (k) { out[k] = g[k] != null ? g[k] : GOAL_DEF[k]; }); return out; }
  function setGoal(m, v) { var st = readJSON('dash.settings', {}) || {}; st.ahGoals = st.ahGoals || {}; if (v) st.ahGoals[m] = v; else delete st.ahGoals[m]; writeJSON('dash.settings', st); }
  function dayName(k, today) {
    if (k === today) return 'Today';
    if (k === addDays(today, -1)) return 'Yesterday';
    return new Date(k + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  }
  function card() {
    var host = document.querySelector('.kit-grid'), box = $('ahCard');
    var onP = Fe ? Fe.on('ahealth') : true;
    if (!host || !/\/habits\//.test(location.pathname)) return;
    if (!box) { box = document.createElement('section'); box.className = 'card ah-card kit-wide'; box.id = 'ahCard'; host.insertBefore(box, host.firstChild); }
    box.hidden = !onP; if (!onP) return;
    var D = days(), keys = Object.keys(D).sort(), today = dkey(new Date()), G = goals();
    var head = '<div class="card-head"><h2><i class="bi bi-apple"></i> Apple Health</h2><a class="text-btn" href="../?settings=ahealth">' + (keys.length ? 'Settings' : 'Set up') + '</a></div>';
    if (!keys.length) { box.innerHTML = head + '<p class="muted ah-empty">Steps, sleep, resting heart rate and exercise from your iPhone – sent by a Shortcut every evening, kept encrypted with the rest. <a href="../?settings=ahealth">Set it up</a> (about 10 minutes, once).</p>'; return; }
    var w = stats(addDays(today, -6), today), pw = stats(addDays(today, -13), addDays(today, -7));
    var have = METRICS.filter(function (m) { return keys.some(function (k) { return D[k][m[0]] != null; }); });
    if (!have.some(function (m) { return m[0] === chartM; })) chartM = have[0] ? have[0][0] : 'steps';
    var M = METRICS.filter(function (m) { return m[0] === chartM; })[0], goal = G[chartM] || null;

    /* tiles: latest number, progress to the goal, 7-day average and the change from the week before */
    var tiles = have.map(function (m) {
      var l = latest(m[0]), a = w[m[0]].avg, pa = pw[m[0]].avg, diff = a != null && pa ? (a - pa) / pa : null, g = G[m[0]];
      var pct = g && l ? Math.min(100, l.v / g * 100) : null;
      return '<button type="button" class="ah-tile' + (m[0] === chartM ? ' on' : '') + '" data-ahm="' + m[0] + '" aria-pressed="' + (m[0] === chartM) + '" style="--c:' + m[3] + '"><span class="ah-l"><i class="bi bi-' + m[2] + '"></i> ' + m[1] + (l && l.date !== today ? ' <em>· ' + esc(l.date === addDays(today, -1) ? 'yesterday' : new Date(l.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</em>' : '') + '</span>' +
        '<b>' + esc(l ? fmt(m[0], l.v) : '–') + '</b>' +
        (pct != null ? '<span class="ah-prog' + (pct >= 100 ? ' full' : '') + '" title="' + Math.round(pct) + '% of ' + esc(fmt(m[0], g)) + '"><i style="width:' + pct.toFixed(1) + '%"></i></span>' : '') +
        '<small>' + (a != null ? '7-day avg ' + esc(fmt(m[0], a)) : '') +
        (diff != null && Math.abs(diff) >= .05 ? ' <span class="' + (NEUTRAL[m[0]] ? 'nt' : (diff > 0) === !LOWER[m[0]] ? 'up' : 'dn') + '">' + (diff > 0 ? '+' : '−') + Math.round(Math.abs(diff) * 100) + '%</span>' : '') + '</small></button>';
    }).join('');

    /* the chart: 7, 14 or 30 days; tap a bar to see that day */
    var vals = [], max = 0;
    for (var i = range - 1; i >= 0; i--) { var k = addDays(today, -i), v = D[k] ? D[k][chartM] : null; if (v == null) v = null; vals.push({ k: k, v: v }); if (v > max) max = v; }
    var withData = vals.filter(function (x) { return x.v != null; });
    if (!selDay || selDay < vals[0].k || selDay > today) selDay = withData.length ? withData[withData.length - 1].k : today;
    var top = Math.max(max, goal || 0) * 1.08 || 1;
    var ctl = '<div class="ah-ctl"><span class="seg ah-range" role="group" aria-label="Days shown">' + [7, 14, 30].map(function (n) { return '<button type="button" data-ahrange="' + n + '" aria-pressed="' + (n === range) + '">' + n + ' days</button>'; }).join('') + '</span></div>';
    var bars = '<div class="ah-chart" style="--c:' + M[3] + '"><div class="ah-bars r' + range + '" role="group" aria-label="' + esc(LABEL[chartM]) + ', last ' + range + ' days">' + vals.map(function (x, idx) {
      var dd = new Date(x.k + 'T12:00'), hgt = x.v != null ? Math.max(3, x.v / top * 100) : 0;
      var lab = range === 30 ? (idx % 5 === 4 || x.k === today ? String(dd.getDate()) : '') : dd.toLocaleDateString('en-GB', { weekday: range === 7 ? 'short' : 'narrow' });
      return '<button type="button" class="ah-bar' + (x.v == null ? ' none' : '') + (goal && x.v >= goal ? ' hit' : '') + (x.k === selDay ? ' sel' : '') + (x.k === today ? ' today' : '') + '" data-ahday="' + x.k + '" aria-pressed="' + (x.k === selDay) + '" aria-label="' + esc(dayName(x.k, today) + ': ' + (x.v == null ? 'no data' : fmt(chartM, x.v))) + '"><span class="ah-col"><i style="height:' + hgt.toFixed(1) + '%"></i></span><small>' + esc(lab) + '</small></button>';
    }).join('') + (goal ? '<em class="ah-goal" style="bottom:calc(18px + (100% - 18px) * ' + (goal / top).toFixed(3) + ')"><span>' + esc(fmt(chartM, goal)) + '</span></em>' : '') + '</div></div>';

    /* the chosen day: every number from it, the goal and what it ticked */
    var day = D[selDay] || {}, hb = readJSON('dash.habits', { list: [] }), sv = day[chartM];
    var chips = have.map(function (m) { return day[m[0]] != null ? '<button type="button" class="ah-chip' + (m[0] === chartM ? ' on' : '') + '" data-ahm="' + m[0] + '" style="--c:' + m[3] + '"><i class="bi bi-' + m[2] + '"></i> ' + esc(fmt(m[0], day[m[0]])) + '</button>' : ''; }).join('');
    var status = '';
    if (sv != null && goal) status = sv >= goal ? '<span class="ah-ok"><i class="bi bi-check-circle-fill"></i> Goal reached</span>' : '<span class="ah-left">' + esc(fmt(chartM, goal - sv)) + ' ' + (selDay === today && chartM !== 'sleep' ? 'to go' : 'short of the goal') + '</span>';
    var ticks = (hb.list || []).filter(function (h) { return h.auto && day[h.auto.m] != null && (h.auto.m === 'sleep' ? day.sleep : day[h.auto.m]) >= h.auto.min; }).map(function (h) { return '<span class="ah-tick"><i class="bi bi-check2"></i> ' + esc(h.name) + '</span>'; }).join('');
    var di = vals.map(function (x) { return x.k; }).indexOf(selDay);
    var dayBox = '<div class="ah-day"><div class="ah-day-h"><button type="button" class="icon-btn" data-ahstep="-1" aria-label="Day before"' + (di <= 0 ? ' disabled' : '') + '><i class="bi bi-chevron-left"></i></button><b>' + esc(dayName(selDay, today)) + '</b><button type="button" class="icon-btn" data-ahstep="1" aria-label="Day after"' + (di >= vals.length - 1 ? ' disabled' : '') + '><i class="bi bi-chevron-right"></i></button>' + status + '</div>' +
      (chips ? '<div class="ah-chips">' + chips + '</div>' : '<p class="muted ah-nodata">Nothing from Apple Health this day.</p>') + (ticks ? '<div class="ah-ticks">Ticked: ' + ticks + '</div>' : '') + '</div>';

    /* a line that says something about the period */
    var ins = [];
    if (withData.length) {
      var avg = withData.reduce(function (t, x) { return t + x.v; }, 0) / withData.length;
      var best = withData.reduce(function (b2, x) { return LOWER[chartM] ? (x.v < b2.v ? x : b2) : (x.v > b2.v ? x : b2); });
      if (goal) ins.push('Goal reached ' + withData.filter(function (x) { return x.v >= goal; }).length + ' of ' + withData.length + ' day' + (withData.length === 1 ? '' : 's'));
      ins.push('average ' + fmt(chartM, avg));
      if (withData.length > 1) ins.push((LOWER[chartM] ? 'lowest ' : 'best ') + new Date(best.k + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) + ' ' + fmt(chartM, best.v));
    }
    var short = keys.length < range ? '<p class="muted ah-grow"><i class="bi bi-hourglass-split"></i> History builds up by itself – one more day every evening (since ' + esc(new Date(keys[0] + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + ').</p>' : '';
    var lastT = (window.Vault.get().health || {}).last;
    var goalCtl = GOAL_DEF[chartM] != null ? (editGoal ? '<span class="ah-goaledit">Goal <input id="ahGoalIn" inputmode="decimal" value="' + esc(goal) + '" aria-label="Goal for ' + esc(LABEL[chartM]) + '">' + ({ sleep: ' h', exercise: ' min', active: ' kcal', stand: ' h', distance: ' km', mindful: ' min', water: ' l', daylight: ' min', flights: ' floors' }[chartM] || '') + ' <button type="button" class="text-btn" data-ahgoalsave>Save</button></span>' : '<button type="button" class="text-btn ah-goalbtn" data-ahgoal><i class="bi bi-flag"></i> Goal ' + esc(fmt(chartM, goal)) + '</button>') : '';
    box.innerHTML = head + '<div class="ah-tiles' + (have.length > 6 ? ' many' : '') + '">' + tiles + '</div>' + ctl + bars + dayBox +
      (ins.length ? '<p class="ah-ins">' + esc(ins.join(' · ')) + '</p>' : '') + short +
      '<div class="ah-foot muted"><span>' + (lastT ? 'Updated ' + esc(new Date(lastT).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : '') + '</span>' + goalCtl + '</div>';
    if (editGoal && $('ahGoalIn')) { $('ahGoalIn').focus(); $('ahGoalIn').select(); }
  }
  function saveGoal() { var v = num(($('ahGoalIn') || {}).value); setGoal(chartM, v && v > 0 ? v : null); editGoal = false; card(); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ahm]'); if (b) { chartM = b.dataset.ahm; editGoal = false; card(); return; }
    var r = e.target.closest('[data-ahrange]'); if (r) { range = +r.dataset.ahrange; try { localStorage.setItem('dash.ahRange', range); } catch (x) {} card(); return; }
    var d = e.target.closest('[data-ahday]'); if (d) { selDay = d.dataset.ahday; card(); var nb = document.querySelector('[data-ahday="' + selDay + '"]'); if (nb) nb.focus(); return; }
    var st = e.target.closest('[data-ahstep]'); if (st) { selDay = addDays(selDay, +st.dataset.ahstep); card(); var nb2 = document.querySelector('[data-ahstep="' + st.dataset.ahstep + '"]'); if (nb2 && !nb2.disabled) nb2.focus(); return; }
    if (e.target.closest('[data-ahgoal]')) { editGoal = true; card(); return; }
    if (e.target.closest('[data-ahgoalsave]')) { saveGoal(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.id === 'ahGoalIn') { if (e.key === 'Enter') { e.preventDefault(); saveGoal(); } else if (e.key === 'Escape') { editGoal = false; card(); } return; }
    var d = e.target.closest && e.target.closest('[data-ahday]'); if (!d || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault(); var n = addDays(d.dataset.ahday, e.key === 'ArrowLeft' ? -1 : 1), t = document.querySelector('[data-ahday="' + n + '"]');
    if (t) { selDay = n; card(); document.querySelector('[data-ahday="' + n + '"]').focus(); }
  });

  /* ---------- Settings → Apple Health ---------- */
  function settingsPage() {
    var box = $('ahSet'); if (!box) return;
    if ($('ahUrl')) $('ahUrl').textContent = location.origin + API;
    var hb = readJSON('dash.habits', { list: [] }), D = days(), n = Object.keys(D).length;
    $('ahStatus').textContent = n ? n + ' day' + (n === 1 ? '' : 's') + ' from Apple Health · last ' + new Date(((window.Vault.get() || {}).health || {}).last || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Nothing received yet';
    $('ahOn').checked = Fe ? Fe.on('ahealth') : true;
    $('ahHabits').innerHTML = (hb.list || []).length ? hb.list.map(function (h) {
      var a = h.auto || {};
      return '<div class="st-row ah-rule"><span class="st-label">' + esc(h.name) + '<small>Tick it automatically when…</small></span><span class="ah-rule-in">' +
        '<select data-ahrule="' + esc(h.id) + '" aria-label="Number for ' + esc(h.name) + '"><option value="">Never</option>' +
        [['steps', 'Steps ≥'], ['exercise', 'Exercise min ≥'], ['sleep', 'Sleep hours ≥'], ['active', 'Active kcal ≥'], ['stand', 'Stand hours ≥'], ['distance', 'Km walked ≥'], ['flights', 'Floors ≥'], ['mindful', 'Mindful min ≥'], ['water', 'Water litres ≥'], ['daylight', 'Daylight min ≥']].map(function (o) { return '<option value="' + o[0] + '"' + (a.m === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select><input data-ahmin="' + esc(h.id) + '" inputmode="decimal" value="' + esc(a.min || '') + '" placeholder="' + (a.m === 'steps' ? '10000' : a.m === 'sleep' ? '7' : '30') + '" aria-label="Threshold"' + (a.m ? '' : ' disabled') + '></span></div>';
    }).join('') : '<p class="muted st-pad">Add a habit on the dashboard first.</p>';
  }
  function saveRule(id) {
    var hb = readJSON('dash.habits', null); if (!hb) return;
    var sel = document.querySelector('[data-ahrule="' + id + '"]'), inp = document.querySelector('[data-ahmin="' + id + '"]');
    hb.list.forEach(function (h) { if (h.id !== id) return; if (sel.value) h.auto = { m: sel.value, min: num(inp.value) || (sel.value === 'steps' ? 10000 : sel.value === 'sleep' ? 7 : 30) }; else delete h.auto; });
    writeJSON('dash.habits', hb); tickHabits(); settingsPage();
  }
  document.addEventListener('change', function (e) {
    var s = e.target.closest('[data-ahrule]'); if (s) { saveRule(s.dataset.ahrule); return; }
    var m = e.target.closest('[data-ahmin]'); if (m) { saveRule(m.dataset.ahmin); return; }
    if (e.target.id === 'ahOn' && Fe) { Fe.set('ahealth', e.target.checked); }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('#ahCopy')) { var t = location.origin + API; if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { $('ahCopy').innerHTML = '<i class="bi bi-check-lg"></i> Copied'; }); else window.prompt('Copy', t); return; }
    if (e.target.closest('#ahClear')) {
      var dd = window.Vault.get(); if (dd && dd.health) { var keep = dd.health; delete dd.health; window.Vault.save(dd); window.dispatchEvent(new Event('health:change')); settingsPage(); card();
        if (window.Quick) window.Quick.toast('<i class="bi bi-trash3"></i> Apple Health data removed', function () { var x = window.Vault.get(); x.health = keep; window.Vault.save(x); window.dispatchEvent(new Event('health:change')); settingsPage(); card(); }); }
    }
  });

  window.Vault.onUnlock(function () { setTimeout(function () { card(); settingsPage(); }, 50); });
  ['health:change', 'features:change', 'habits:change'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(function () { card(); settingsPage(); }, 0); }); });
  window.AHealth = { days: days, stats: stats, latest: latest, fmt: fmt, merge: merge, pull: pull };
})();
