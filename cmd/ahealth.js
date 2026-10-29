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
  var F = ['steps', 'sleep', 'rhr', 'active', 'exercise', 'weight', 'distance', 'flights'];
  var LABEL = { steps: 'Steps', sleep: 'Sleep', rhr: 'Resting heart rate', active: 'Active energy', exercise: 'Exercise', weight: 'Weight', distance: 'Walking + running', flights: 'Flights climbed' };
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
  function hm(h) { var m = Math.round(h * 60); return Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min'; }
  function fmt(f, v) {
    if (v == null) return '–';
    if (f === 'sleep') return hm(v);
    if (f === 'rhr') return Math.round(v) + ' bpm';
    if (f === 'active') return nf.format(v) + ' kcal';
    if (f === 'exercise') return Math.round(v) + ' min';
    if (f === 'weight') return nf1.format(v) + ' kg';
    if (f === 'distance') return nf1.format(v) + ' km';
    return nf.format(v);
  }

  /* 0 h sleep, 0 bpm or 0 kg means the Shortcut found nothing – treat it as no number, not a real one */
  var ZERO_IS_EMPTY = { sleep: 1, rhr: 1, weight: 1 };
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
      F.forEach(function (f) { var v = f === 'sleep' ? hours(x[f]) : num(x[f]); if (v === 0 && ZERO_IS_EMPTY[f]) v = null; if (v != null) { cur[f] = Math.round(v * 100) / 100; ch = true; } });
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
  var METRICS = [['steps', 'Steps', 'person-walking', '#22b35e'], ['sleep', 'Sleep', 'moon-stars', '#8a6fdf'], ['exercise', 'Exercise', 'activity', '#e8743b'], ['rhr', 'Resting HR', 'heart', '#e66767'], ['weight', 'Weight', 'speedometer', '#3987e5'], ['active', 'Active energy', 'fire', '#c98500']];
  var chartM = 'steps';
  function card() {
    var host = document.querySelector('.kit-grid'), box = $('ahCard');
    var onP = Fe ? Fe.on('ahealth') : true;
    if (!host || !/\/habits\//.test(location.pathname)) return;
    if (!box) { box = document.createElement('section'); box.className = 'card ah-card kit-wide'; box.id = 'ahCard'; host.insertBefore(box, host.firstChild); }
    box.hidden = !onP; if (!onP) return;
    var D = days(), keys = Object.keys(D).sort(), today = dkey(new Date());
    var head = '<div class="card-head"><h2><i class="bi bi-apple"></i> Apple Health</h2><a class="text-btn" href="../?settings=ahealth">' + (keys.length ? 'Settings' : 'Set up') + '</a></div>';
    if (!keys.length) { box.innerHTML = head + '<p class="muted ah-empty">Steps, sleep, resting heart rate and exercise from your iPhone – sent by a Shortcut every evening, kept encrypted with the rest. <a href="../?settings=ahealth">Set it up</a> (about 10 minutes, once).</p>'; return; }
    var w = stats(addDays(today, -6), today), pw = stats(addDays(today, -13), addDays(today, -7));
    var have = METRICS.filter(function (m) { return keys.some(function (k) { return D[k][m[0]] != null; }); });
    if (!have.some(function (m) { return m[0] === chartM; })) chartM = have[0] ? have[0][0] : 'steps';
    var tiles = have.slice(0, 6).map(function (m) {
      var l = latest(m[0]), a = w[m[0]].avg, pa = pw[m[0]].avg, diff = a != null && pa ? (a - pa) / pa : null;
      return '<button type="button" class="ah-tile' + (m[0] === chartM ? ' on' : '') + '" data-ahm="' + m[0] + '" style="--c:' + m[3] + '"><span class="ah-l"><i class="bi bi-' + m[2] + '"></i> ' + m[1] + '</span>' +
        '<b>' + esc(l ? fmt(m[0], l.v) : '–') + '</b><small>' + (a != null ? '7-day avg ' + esc(fmt(m[0], a)) : '') +
        (diff != null && Math.abs(diff) >= .05 ? ' <span class="' + ((diff > 0) === (m[0] !== 'rhr' && m[0] !== 'weight') ? 'up' : 'dn') + '">' + (diff > 0 ? '+' : '−') + Math.round(Math.abs(diff) * 100) + '%</span>' : '') + '</small></button>';
    }).join('');
    /* the last 14 days of the chosen number */
    var vals = [], max = 0;
    for (var i = 13; i >= 0; i--) { var k = addDays(today, -i), v = D[k] ? D[k][chartM] : null; vals.push({ k: k, v: v }); if (v > max) max = v; }
    var goal = chartM === 'steps' ? 10000 : chartM === 'sleep' ? 7 : chartM === 'exercise' ? 30 : null;
    var bars = '<div class="ah-bars" role="img" aria-label="' + esc(LABEL[chartM]) + ', last 14 days">' + vals.map(function (x) {
      var hgt = x.v != null && max ? Math.max(4, x.v / Math.max(max, goal || 0) * 100) : 0, dd = new Date(x.k + 'T12:00');
      return '<span title="' + esc(dd.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ': ' + fmt(chartM, x.v)) + '"><i style="height:' + hgt.toFixed(1) + '%"' + (goal && x.v >= goal ? ' class="hit"' : '') + '></i><small>' + dd.toLocaleDateString('en-GB', { weekday: 'narrow' }) + '</small></span>';
    }).join('') + (goal ? '<em class="ah-goal" style="bottom:calc(' + (goal / Math.max(max, goal) * 100).toFixed(1) + '% * .82 + 18px)"></em>' : '') + '</div>';
    var lastT = (window.Vault.get().health || {}).last;
    box.innerHTML = head + '<div class="ah-tiles">' + tiles + '</div>' + bars +
      '<p class="muted ah-foot">' + esc(LABEL[chartM]) + ', last 14 days' + (goal ? ' · line: ' + fmt(chartM, goal) : '') + (lastT ? ' · updated ' + esc(new Date(lastT).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : '') + '</p>';
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-ahm]'); if (b) { chartM = b.dataset.ahm; card(); } });

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
        [['steps', 'Steps ≥'], ['exercise', 'Exercise min ≥'], ['sleep', 'Sleep hours ≥'], ['active', 'Active kcal ≥'], ['distance', 'Km walked ≥']].map(function (o) { return '<option value="' + o[0] + '"' + (a.m === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
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
