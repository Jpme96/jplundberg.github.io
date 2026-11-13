/* Optional cards on the pages they belong to (Settings → Features):
     Finances   Strømpris (hour-by-hour price in NO1), Savings jars
     Work       FDV inspection notes (findings with TG, a summary to send), Holiday planner
     Health     Gym log (sets × reps × kg, progress, next weight), Rest-day advisor
     Travel     Smart packing (from the trip's length and weather)
   Each mounts into a [data-tool="…"] box in the page, like the other tools. */
/* The page part of life-pages.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is life-pages.js. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var __c = (window.__core || {})["lifepages"]; if (!__c) return;
  var nf = __c.nf, on = __c.on, mounts = __c.mounts, drawAll = __c.drawAll, dkey = __c.dkey, addDays = __c.addDays, prices = __c.prices, Fe = __c.Fe, pwLoading = __c.pwLoading, cheapest = __c.cheapest, pad = __c.pad, support = __c.support, TG = __c.TG, NS = __c.NS, nsName = __c.nsName, nsLabel = __c.nsLabel, partLabel = __c.partLabel, ownMap = __c.ownMap, KG = __c.KG, prio = __c.prio, PRIO = __c.PRIO, fmt = __c.fmt, toast = __c.toast, summary = __c.summary, readJSON = __c.readJSON, uid = __c.uid, fromKey = __c.fromKey, templates = __c.templates, saveTpls = __c.saveTpls, starter = __c.starter;
  var K = window.Kit;
  if (!Fe) return;
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : null; }
  var nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function card(id, icon, title, actions, body, cls) {
    return '<section class="card kit-card lp-card ' + (cls || '') + '" id="' + id + '"><div class="card-head"><h2><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h2>' +
      (actions ? '<div class="head-actions">' + actions + '</div>' : '') + '</div>' + body + '</section>';
  }
  function tile(label, value, sub) { return '<div class="kit-tile" data-tk="' + esc(label).replace(/\b(19|20)\d\d\b/g, 'Y') + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function mount(name, render) {
    var el = $t(name); if (!el) return;
    function draw() { var ok = on(name); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; } render(el); }
    mounts.push(draw);
  }
  ['tools:change', 'features:change', 'fin:change', 'habits:change', 'health:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(drawAll.t); drawAll.t = setTimeout(drawAll, 30); }); });
  window.Vault.onUnlock(function () { setTimeout(drawAll, 60); });
  var PW = { day: 'today' };
  function pwKey(k) { return 'pw:' + k; }
  mount('power', function (el) {
    var now = new Date(), tk = dkey(now), tom = addDays(tk, 1), k = PW.day === 'tomorrow' ? tom : tk;
    var h = prices(k), hTom = now.getHours() >= 13 ? prices(tom) : null;
    var cfg = (Fe.tools().powercfg) || {};
    var acts = '<div class="seg lp-seg"><button type="button" data-pwday="today" aria-pressed="' + (PW.day === 'today') + '"><span data-t="ui.today"><span data-t="ui.today">Today</span></span></button>' +
      (hTom || PW.day === 'tomorrow' ? '<button type="button" data-pwday="tomorrow" aria-pressed="' + (PW.day === 'tomorrow') + '"><span data-t="ui.tomorrow"><span data-t="ui.tomorrow">Tomorrow</span></span></button>' : '') + '</div>';
    if (!h) { el.innerHTML = card('power', 'lightning-charge', 'Strømpris', '', '<p class="muted">' + (pwLoading[k] === 'fail' ? I18N.k('ui.price-service-down', 'Couldn’t reach the price service right now – try again later.') : I18N.k('ui.getting-todays-prices', 'Getting today’s prices …')) + '</p>'); return; }
    var valid = h.filter(function (x) { return x != null; }), avg = valid.reduce(function (a, b) { return a + b; }, 0) / valid.length;
    var max = Math.max.apply(null, valid), min = Math.min.apply(null, valid), cur = k === tk ? h[now.getHours()] : null;
    var c3 = cheapest(h, 3, k === tk ? now.getHours() : 0), exp = h.indexOf(max);
    var lvl = function (p) { return p <= avg * .85 ? 'cheap' : p >= avg * 1.2 ? 'dear' : 'mid'; };
    var big = cur != null ? cur : avg;
    var body = '<div class="pw-now"><div><span class="muted">' + (cur != null ? 'Now, ' + pad(now.getHours()) + '–' + pad((now.getHours() + 1) % 24) : 'Average ' + (k === tom ? 'tomorrow' : 'today')) + '</span>' +
      '<b class="pw-big">' + nf.format(Math.round(big)) + ' <small>øre/kWh</small></b>' +
      '<span class="pw-lvl ' + lvl(big) + '">' + ({ cheap: 'Cheap', mid: 'Normal', dear: 'Expensive' })[lvl(big)] + '</span>' +
      (cfg.norgespris ? '<small class="muted" data-t="ui.you-pay-50-re-with-norgespris">You pay 50 øre with Norgespris</small>' : big > 93.75 ? '<small class="muted">≈ ' + nf.format(Math.round(support(big))) + ' øre after strømstøtte</small>' : '') + '</div>' +
      '<div class="pw-side"><span><i class="bi bi-arrow-down-circle"></i> Cheapest ' + (c3 ? pad(c3.h) + '–' + pad(c3.h + 3) + ' · ' + nf.format(Math.round(c3.avg)) + ' øre' : '–') + '</span>' +
      '<span><i class="bi bi-arrow-up-circle"></i> Most expensive ' + pad(exp) + '–' + pad((exp + 1) % 24) + ' · ' + nf.format(Math.round(max)) + ' øre</span>' +
      '<span><i class="bi bi-dash-circle"></i> Average ' + nf.format(Math.round(avg)) + ' øre</span></div></div>' +
      '<div class="pw-bars" role="img" aria-label="Price per hour">' + h.map(function (p, i) {
        var inC = c3 && i >= c3.h && i < c3.h + 3, isNow = k === tk && i === now.getHours();
        return '<i class="' + (p == null ? 'na ' : '') + lvl(p || avg) + (inC ? ' best' : '') + (isNow ? ' now' : '') + (k === tk && i < now.getHours() ? ' past' : '') + '" style="--h:' + (p == null ? 2 : Math.max(4, Math.round(p / max * 100))) + '%" title="' + pad(i) + ':00 · ' + (p == null ? '–' : nf.format(Math.round(p)) + ' øre') + '"></i>';
      }).join('') + '</div><div class="pw-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>' +
      '<p class="kit-foot"><span data-t="ui.spot-price-in-no1-with-vat-before-grid-r">Spot price in NO1 with VAT, before grid rent (nettleie). Prices from hvakosterstrommen.no.</span> <label class="lp-inl"><input type="checkbox" data-pwnorge' + (cfg.norgespris ? ' checked' : '') + '> <span data-t="ui.i-have-norgespris"><span data-t="ui.i-have-norgespris">I have Norgespris</span></span></label></p>';
    el.innerHTML = card('power', 'lightning-charge', 'Strømpris', acts, body, 'lp-power');
  });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-pwday]'); if (b) { PW.day = b.dataset.pwday; drawAll(); } });
  document.addEventListener('change', function (e) { if (e.target.matches('[data-pwnorge]')) { var t = Fe.tools(); t.powercfg = Object.assign({}, t.powercfg, { norgespris: e.target.checked }); Fe.saveTools(t); } });
  var svList = document.getElementById('svList');
  function jars() {
    if (!svList) return;
    var want = on('jars'); svList.classList.toggle('sv-jars', want);
    if (!want) return;
    var d = window.Vault.get() || {}, B = window.Budget;
    svList.querySelectorAll('li.goal[data-id]').forEach(function (li) {
      var g = (d.savings || []).filter(function (x) { return x.id === li.dataset.id; })[0]; if (!g) return;
      var pct = g.target > 0 ? Math.min(1, (+g.saved || 0) / g.target) : 0;
      var mo = B && B.saveMonthly ? B.saveMonthly(g) : 0, left = Math.max(0, (+g.target || 0) - (+g.saved || 0));
      var weeks = pct >= 1 ? 0 : mo > 0 ? Math.ceil(left / (mo / 4.345)) : null;
      var j = li.querySelector('.jar');
      var html = '<svg viewBox="0 0 60 76" aria-hidden="true"><defs><clipPath id="jc' + esc(g.id) + '"><path d="M12 14h36v6c6 3 8 8 8 14v30c0 6-4 10-10 10H14C8 74 4 70 4 64V34c0-6 2-11 8-14z"/></clipPath></defs>' +
        '<rect class="jar-lid" x="10" y="3" width="40" height="9" rx="3"/><g clip-path="url(#jc' + esc(g.id) + ')"><rect class="jar-glass" x="0" y="0" width="60" height="76"/><rect class="jar-fill" x="0" y="' + (74 - 60 * pct).toFixed(1) + '" width="60" height="76"/></g>' +
        '<path class="jar-edge" d="M12 14h36v6c6 3 8 8 8 14v30c0 6-4 10-10 10H14C8 74 4 70 4 64V34c0-6 2-11 8-14z"/><text x="30" y="52" text-anchor="middle">' + Math.round(pct * 100) + '%</text></svg>' +
        '<small class="jar-weeks">' + (pct >= 1 ? 'Full 🎉' : weeks != null ? weeks + ' week' + (weeks === 1 ? '' : 's') + ' to go' : kr(left) + ' to go') + '</small>';
      if (!j) { j = document.createElement('div'); j.className = 'jar'; li.insertBefore(j, li.firstChild); }
      if (j.innerHTML !== html) j.innerHTML = html;
    });
  }
  if (svList) { new MutationObserver(function () { if (on('jars') && svList.querySelector('li.goal:not(:has(.jar))')) jars(); }).observe(svList, { childList: true }); mounts.push(jars); }
  function offDay(k) { var d = fromKey(k).getDay(); return d === 0 || d === 6 || !!Fe.holiday(k); }
  function breaks() {
    var today = dkey(new Date()), out = [], seen = {};
    for (var i = 1; i < 380; i++) {
      var k = addDays(today, i), h = Fe.holiday(k);
      if (!h || fromKey(k).getDay() % 6 === 0 || seen[h.name + k.slice(0, 4)]) continue;
      if (out.length && k <= addDays(out[out.length - 1].b, 2)) continue;          // part of the break just found (Easter, Christmas)
      seen[h.name + k.slice(0, 4)] = 1;
      /* every way to use 1–5 work days next to this holiday; keep the best ratio, then the longest */
      var best = null;
      for (var s = -6; s <= 0; s++) for (var len = 1; len <= 9; len++) {
        var from = addDays(k, s), to = addDays(from, len - 1); if (from <= today) continue;
        if (to < k) continue;
        var used = 0, j; for (j = 0; j < len; j++) if (!offDay(addDays(from, j))) used++;
        if (!used || used > 5) continue;
        var a = from, b = to; while (offDay(addDays(a, -1))) a = addDays(a, -1); while (offDay(addDays(b, 1))) b = addDays(b, 1);
        var total = Math.round((fromKey(b) - fromKey(a)) / 864e5) + 1, sc = total / used;
        if (total < 4) continue;
        if (sc < 2.5) continue;
        var wd = workDays(from, to);
        /* the longest break that still gives 2,5+ days off per day used; equal length → fewer days used */
        if (!best || total > best.total || (total === best.total && used < best.used)) best = { sc: sc, total: total, used: used, a: a, b: b, take: wd[0], takeTo: wd[wd.length - 1], name: h.name };
      }
      if (best) out.push(best);
    }
    var uniq = {}; return out.filter(function (x) { var u = x.a + x.b; if (uniq[u]) return false; uniq[u] = 1; return true; }).slice(0, 6);
  }
  function workDays(a, b) { var l = [], k = a; while (k <= b) { if (!offDay(k)) l.push(k); k = addDays(k, 1); } return l; }
  mount('holiday', function (el) {
    var y = dkey(new Date()).slice(0, 4), cfg = Fe.tools().holidaycfg || {};
    var total = on('flex') ? (+((Fe.tools().flexcfg || {}).vacation) || 25) : (+cfg.total || 25);
    var used = on('flex') ? Fe.list('flex').filter(function (e) { return e.type === 'vacation' && String(e.date).slice(0, 4) === y; }).length : (+cfg.used || 0);
    var planned = (cfg.plans || []).filter(function (p) { return p.take.slice(0, 4) === y && p.take > dkey(new Date()); }).reduce(function (a, p) { return a + p.used; }, 0);
    var next = null; for (var i = 0; i < 370 && !next; i++) { var k = addDays(dkey(new Date()), i), h = Fe.holiday(k); if (h) next = { k: k, h: h }; }
    var br = breaks();
    var body = '<div class="kit-tiles">' + tile('Days left ' + y, (total - used - planned) + ' <small>/ ' + total + '</small>', used + ' used' + (planned ? ' · ' + planned + ' planned' : '')) +
      (next ? tile(I18N.k('ui.next-public-holiday', 'Next public holiday'), esc(next.h.name), fmt(next.k, { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</div>' +
      '<h3 class="lp-h3" data-t="ui.longest-breaks-for-the-fewest-days">Longest breaks for the fewest days</h3>' +
      (br.length ? '<ul class="hp-list">' + br.map(function (x) {
        var plannedAlready = (cfg.plans || []).some(function (p) { return p.take === x.take; });
        return '<li><div class="hp-ratio"><b>' + x.total + '</b><small data-t="ui.days-off"><span data-t="ui.days-off"><span data-t="ui.days-off">days off</span></span></small></div><div class="hp-x"><b>' + esc(x.name) + '</b><span>Take ' + x.used + ' day' + (x.used === 1 ? '' : 's') + ': ' + esc(fmt(x.take, { weekday: 'short', day: 'numeric', month: 'short' })) + (x.takeTo !== x.take ? ' – ' + esc(fmt(x.takeTo, { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</span><small>Off ' + esc(fmt(x.a, { weekday: 'short', day: 'numeric', month: 'short' })) + ' – ' + esc(fmt(x.b, { weekday: 'short', day: 'numeric', month: 'short' })) + '</small></div>' +
          (plannedAlready ? '<span class="kit-badge" data-t="ui.in-calendar"><span data-t="ui.in-calendar"><span data-t="ui.in-calendar">In calendar</span></span></span>' : '<button type="button" class="text-btn" data-hpplan="' + x.take + '|' + x.takeTo + '|' + x.a + '|' + x.b + '|' + x.used + '|' + esc(x.name) + '"><i class="bi bi-calendar-plus"></i> <span data-t="ui.plan-it"><span data-t="ui.plan-it">Plan it</span></span></button>') + '</li>';
      }).join('') + '</ul>' : '<p class="muted" data-t="ui.no-clever-breaks-in-the-next-12-months">No clever breaks in the next 12 months.</p>') +
      (on('flex') ? '' : '<p class="kit-foot">Holiday days a year: <input class="lp-num" type="number" min="0" max="60" value="' + total + '" data-hpcfg="total" aria-label="Holiday days a year"> · used so far: <input class="lp-num" type="number" min="0" max="60" value="' + used + '" data-hpcfg="used" aria-label="Holiday days used"></p>');
    el.innerHTML = card('holiday', 'sun', I18N.k('ui.holiday-planner', 'Holiday planner'), '', body, 'lp-holiday');
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hpplan]'); if (!b) return;
    var q = b.dataset.hpplan.split('|'), cal = readJSON('dash.calendar', null) || { events: [], hidden: {}, feeds: [] };
    cal.events = cal.events || [];
    var ev = { id: uid(), title: 'Ferie – ' + q[5], cat: 'personal', date: q[2], end: q[3], allDay: true };
    cal.events.push(ev); writeJSON('dash.calendar', cal); window.dispatchEvent(new Event('cal:change'));
    var t = Fe.tools(); t.holidaycfg = t.holidaycfg || {}; t.holidaycfg.plans = (t.holidaycfg.plans || []).concat([{ take: q[0], takeTo: q[1], used: +q[4], ev: ev.id }]);
    if (on('flex')) workDays(q[0], q[1]).forEach(function (k) { t.flex = t.flex || []; t.flex.push({ id: uid(), date: k, type: 'vacation' }); });
    Fe.saveTools(t);
    toast('<i class="bi bi-sun"></i> ' + esc(q[5]) + ' break in your calendar' + (on('flex') ? ' and flex time' : ''));
  });
  document.addEventListener('change', function (e) { var c = e.target.dataset && e.target.dataset.hpcfg; if (!c) return; var t = Fe.tools(); t.holidaycfg = t.holidaycfg || {}; t.holidaycfg[c] = +e.target.value || 0; Fe.saveTools(t); });
  var EX = ['Bench press', 'Squat', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-ups', 'Lat pulldown', 'Leg press', 'Lunges', 'Romanian deadlift', 'Biceps curl', 'Triceps pushdown', 'Dips', 'Seated row', 'Leg curl', I18N.k('ui.calf-raise', 'Calf raise'), 'Plank'];
  function sessions() { return (Fe.list('gym') || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }); }
  function e1rm(s) { return (+s.kg || 0) * (1 + (+s.r || 0) / 30); }
  function history(name) {
    var out = []; sessions().slice().reverse().forEach(function (s) { (s.ex || []).forEach(function (x) { if (x.n.toLowerCase() === name.toLowerCase() && x.sets && x.sets.length) out.push({ date: s.date, sets: x.sets, best: Math.max.apply(null, x.sets.map(e1rm)) }); }); });
    return out;
  }
  function suggest(name) {
    var h = history(name); if (!h.length) return null;
    var last = h[h.length - 1], top = Math.max.apply(null, last.sets.map(function (s) { return +s.kg || 0; }));
    var topSets = last.sets.filter(function (s) { return (+s.kg || 0) === top; }), reps = Math.min.apply(null, topSets.map(function (s) { return +s.r || 0; }));
    if (!top) return { last: last, text: topSets.length + '×' + reps, next: 0, reps: reps + 1, up: false, bw: true };   // body weight (dips, pull-ups …): one more rep
    var step = top >= 40 ? 2.5 : top >= 10 ? 1 : .5, up = reps >= 8;
    return { last: last, text: topSets.length + '×' + reps + ' @ ' + nf1.format(top) + ' kg', next: up ? top + step : top, reps: up ? Math.max(5, reps - 2) : reps + 1, up: up };
  }
  mount('gym', function (el) {
    var l = sessions(), tk = dkey(new Date()), mon = addDays(tk, -((new Date().getDay() + 6) % 7));
    var wk = l.filter(function (s) { return s.date >= mon; }), vol = 0;
    wk.forEach(function (s) { (s.ex || []).forEach(function (x) { (x.sets || []).forEach(function (t) { vol += (+t.r || 0) * (+t.kg || 0); }); }); });
    var names = {}; l.forEach(function (s) { (s.ex || []).forEach(function (x) { names[x.n] = (names[x.n] || 0) + 1; }); });
    var top = Object.keys(names).sort(function (a, b) { return names[b] - names[a]; }).slice(0, 5);
    var prs = 0; top.forEach(function (n) { var h = history(n); if (h.length > 1 && h[h.length - 1].best >= Math.max.apply(null, h.slice(0, -1).map(function (x) { return x.best; })) && h[h.length - 1].date >= addDays(tk, -30)) prs++; });
    var body = '<div class="kit-tiles">' + tile(I18N.k('ui.this-week', 'This week'), wk.length, 'session' + (wk.length === 1 ? '' : 's')) + tile('Volume', nf.format(Math.round(vol)) + ' <small>kg</small>', 'this week') + tile(I18N.k('ui.new-bests', 'New bests'), prs, 'last 30 days') + '</div>' +
      (top.length ? '<h3 class="lp-h3" data-t="ui.progress"><span data-t="ui.progress"><span data-t="ui.progress">Progress</span></span></h3><ul class="gym-prog">' + top.map(function (n) {
        var h = history(n).slice(-10), mx = Math.max.apply(null, h.map(function (x) { return x.best; })), mn = Math.min.apply(null, h.map(function (x) { return x.best; })), sg = suggest(n);
        var pts = h.map(function (x, i) { return (h.length === 1 ? 50 : i / (h.length - 1) * 100).toFixed(1) + ',' + (mx === mn ? 50 : 90 - (x.best - mn) / (mx - mn) * 80).toFixed(1); }).join(' ');
        var heavy = 0; history(n).forEach(function (x) { x.sets.forEach(function (t) { heavy = Math.max(heavy, +t.kg || 0); }); }); var isPr = h.length > 1 && h[h.length - 1].best >= Math.max.apply(null, h.slice(0, -1).map(function (x) { return x.best; }));
        return '<li><div class="gym-x"><b>' + esc(n) + (isPr ? ' <span class="hl-chip" style="--c:#e8743b"><i class="bi bi-trophy"></i> <span data-t="ui.best"><span data-t="ui.best">Best</span></span></span>' : '') + '</b><small>' + esc((sg ? 'Last ' + sg.text : '') + (heavy ? ' · record ' + nf1.format(heavy) + ' kg' : '')) + '</small></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" class="gym-spark" aria-hidden="true"><polyline points="' + pts + '"/></svg>' +
          '<div class="gym-next"><small data-t="ui.next"><span data-t="ui.next"><span data-t="ui.next">Next</span></span></small><b>' + (sg ? (sg.bw ? '' : nf1.format(sg.next) + ' kg ') + '× ' + sg.reps : '–') + '</b></div></li>';
      }).join('') + '</ul>' : '') +
      (l.length ? '<h3 class="lp-h3" data-t="ui.recent"><span data-t="ui.recent"><span data-t="ui.recent">Recent</span></span></h3><ul class="kit-list">' + l.slice(0, 4).map(function (s) { return '<li class="kit-item"><button type="button" class="kit-main" data-gymedit="' + esc(s.id) + '"><span class="kit-ic" style="--c:#d55181"><i class="bi bi-person-arms-up"></i></span><span class="kit-x"><b>' + esc(fmt(s.date, { weekday: 'long', day: 'numeric', month: 'short' })) + '</b><small>' + esc((s.ex || []).map(function (x) { return x.n + ' ' + (x.sets || []).length + '×'; }).join(' · ')) + '</small></span></button></li>'; }).join('') + '</ul>' :
        '<p class="empty kit-empty" data-t="ui.log-sets-reps-and-kilos-per-exercise-it">Log sets, reps and kilos per exercise. It shows your progress and suggests the weight for next time.</p>');
    var tpls = templates();
    var tplRow = '<div class="gym-tpls" aria-label="Workout templates" data-t-aria-label="ui.workout-templates"><span class="gym-tpl-l"><i class="bi bi-collection"></i> <span data-t="ui.start"><span data-t="ui.start">Start</span></span></span>' + (tpls.length ? tpls.map(function (t) {
        return '<span class="gym-tpl' + (tplEdit ? ' editing' : '') + '"><button type="button" class="lf-chip" data-gymtpl="' + esc(t.id) + '" title="' + esc(t.ex.map(function (x) { return x.n; }).join(', ')) + '">' + esc(t.name) + ' <small>' + t.ex.length + '</small></button>' +
          (tplEdit ? '<button type="button" class="icon-btn sm" data-gymtpldel="' + esc(t.id) + '" aria-label="Delete ' + esc(t.name) + '"><i class="bi bi-x"></i></button>' : '') + '</span>';
      }).join('') + '<button type="button" class="icon-btn sm" data-gymtpledit aria-pressed="' + tplEdit + '" aria-label="' + (tplEdit ? 'Done' : 'Edit templates') + '" title="' + (tplEdit ? 'Done' : 'Edit templates') + '"><i class="bi bi-' + (tplEdit ? 'check2' : 'pencil') + '"></i></button>'
      : '<button type="button" class="lf-chip" data-gymstarter><i class="bi bi-plus-lg"></i> Push · Pull · Legs</button><small class="muted" data-t="ui.or-save-any-workout-as-a-template">or save any workout as a template</small>') + '</div>';
    el.innerHTML = card('gym', 'person-arms-up', I18N.k('ui.gym-log', 'Gym log'), '<button type="button" class="text-btn" data-gymstart><i class="bi bi-play-fill"></i> <span data-t="ui.start-workout"><span data-t="ui.start-workout">Start workout</span></span></button>', tplRow + body, 'lp-gym');
  });
  var tplEdit = false;
  function fromTpl(t) {
    return { id: uid(), date: dkey(new Date()), tpl: t.id, ex: t.ex.map(function (x) {
      var sg = suggest(x.n), n = Math.max(1, Math.min(10, +x.sets || 3)), out = [];
      for (var i = 0; i < n; i++) out.push({ r: sg ? sg.reps : (+x.r || 8), kg: sg && !sg.bw ? sg.next : '' });
      return { n: x.n, sets: out };
    }) };
  }
  function tplOf(s) { return { n: s.n, sets: (s.sets || []).length || 3, r: Math.max.apply(null, (s.sets || [{ r: 8 }]).map(function (t) { return +t.r || 0; })) || 8 }; }
  function gymSheet(sess, tpl) {
    var s = sess ? JSON.parse(JSON.stringify(sess)) : tpl ? fromTpl(tpl) : { id: uid(), date: dkey(new Date()), ex: [] }, isNew = !sess, naming = false;
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<div class="fo-box lf-box gym-box" role="dialog" aria-modal="true" aria-label="Workout" data-t-aria-label="ui.workout"></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var box = bg.firstChild;
    function close() { bg.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape' && !e.target.closest('input')) { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    function draw() {
      var T = s.tpl ? templates().filter(function (t) { return t.id === s.tpl; })[0] : null;
      box.innerHTML = '<div class="lf-head"><h3><i class="bi bi-person-arms-up"></i> ' + (T ? esc(T.name) : isNew ? 'Workout' : 'Edit workout') + '</h3><button type="button" class="icon-btn sm" data-gclose aria-label="Close" data-t-aria-label="ui.close"><i class="bi bi-x-lg"></i></button></div>' +
        '<label class="gym-date"><span data-t="ui.date"><span data-t="ui.date">Date</span></span> <input type="date" data-gdate value="' + s.date + '"></label>' +
        s.ex.map(function (x, xi) {
          var sg = suggest(x.n);
          return '<section class="gym-ex"><div class="gym-exh"><b>' + esc(x.n) + '</b>' + (sg ? '<small>Last ' + esc(sg.text) + ' · try <b>' + (sg.bw ? '' : nf1.format(sg.next) + ' kg ') + '× ' + sg.reps + '</b>' + (sg.up ? ' ↑' : '') + '</small>' : '') + '<button type="button" class="icon-btn sm" data-gexdel="' + xi + '" aria-label="Remove ' + esc(x.n) + '"><i class="bi bi-trash3"></i></button></div>' +
            '<div class="gym-sets">' + x.sets.map(function (t, si) {
              return '<div class="gym-set"><span>' + (si + 1) + '</span><input inputmode="numeric" data-gs="' + xi + ':' + si + ':r" value="' + esc(t.r) + '" aria-label="Reps"><em data-t="ui.reps"><span data-t="ui.reps"><span data-t="ui.reps">reps</span></span></em><input inputmode="decimal" data-gs="' + xi + ':' + si + ':kg" value="' + esc(t.kg) + '" aria-label="Kilos"><em>kg</em><button type="button" class="icon-btn sm" data-gsdel="' + xi + ':' + si + '" aria-label="Remove set"><i class="bi bi-x"></i></button></div>';
            }).join('') + '</div><button type="button" class="text-btn" data-gsadd="' + xi + '"><i class="bi bi-plus-lg"></i> <span data-t="ui.set"><span data-t="ui.set">Set</span></span></button></section>';
        }).join('') +
        '<form class="gym-addex"><input list="gymEx" name="n" placeholder="Add exercise, e.g. Bench press" data-t-placeholder="ui.add-exercise-e-g-bench-press" autocomplete="off" maxlength="60"><datalist id="gymEx">' + Object.keys(EX.concat(sessions().reduce(function (a, q) { return a.concat((q.ex || []).map(function (x) { return x.n; })); }, [])).reduce(function (o, n) { o[n] = 1; return o; }, {})).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist><button class="pill-btn" type="submit" aria-label="Add exercise"><i class="bi bi-plus-lg"></i></button></form>' +
        (s.ex.length ? (naming ? '<div class="gym-tplname"><input data-gtplname placeholder="Template name, e.g. Push" maxlength="30" value="' + esc(T ? T.name : '') + '" autocomplete="off"><button type="button" class="pill-btn sm" data-gtplsave data-t="ui.save"><span data-t="ui.save"><span data-t="ui.save">Save</span></span></button><button type="button" class="icon-btn sm" data-gtplx aria-label="Cancel" data-t-aria-label="ui.cancel"><i class="bi bi-x"></i></button></div>'
          : '<div class="gym-tplbar">' + (T ? '<button type="button" class="text-btn" data-gtplupd><i class="bi bi-arrow-repeat"></i> Update “' + esc(T.name) + '”</button>' : '') + '<button type="button" class="text-btn" data-gtplnew><i class="bi bi-collection"></i> <span data-t="ui.save-as-template">Save as template</span></button></div>') : '') +
        '<div class="lf-foot">' + (isNew ? '<span class="spacer"></span>' : '<button type="button" class="text-btn danger" data-gdel><i class="bi bi-trash3"></i> <span data-t="ui.delete"><span data-t="ui.delete">Delete</span></span></button>') + '<button type="button" class="pill-btn wide" data-gsave><i class="bi bi-check2"></i> <span data-t="ui.save-workout"><span data-t="ui.save-workout">Save workout</span></span></button></div>';
    }
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('[data-gtplname]')) { e.preventDefault(); var b = box.querySelector('[data-gtplsave]'); if (b) b.click(); } });
    box.addEventListener('submit', function (e) {
      e.preventDefault(); var n = e.target.n.value.trim(); if (!n) return;
      var sg = suggest(n); s.ex.push({ n: n, sets: [{ r: sg ? sg.reps : 8, kg: sg && !sg.bw ? sg.next : '' }] }); draw();
      var last = box.querySelectorAll('[data-gs$=":kg"]'); if (last.length) last[last.length - 1].focus();
    });
    box.addEventListener('input', function (e) { var g = e.target.dataset.gs; if (g) { var q = g.split(':'); s.ex[+q[0]].sets[+q[1]][q[2]] = q[2] === 'kg' ? (num(e.target.value) == null ? '' : num(e.target.value)) : (parseInt(e.target.value, 10) || ''); } if (e.target.matches('[data-gdate]')) s.date = e.target.value || s.date; });
    box.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-gclose]')) return close();
      if (e.target.closest('[data-gtplnew]')) { naming = true; draw(); var ni = box.querySelector('[data-gtplname]'); if (ni) ni.focus(); return; }
      if (e.target.closest('[data-gtplx]')) { naming = false; draw(); return; }
      if (e.target.closest('[data-gtplsave]') || e.target.closest('[data-gtplupd]')) {
        var upd = !!e.target.closest('[data-gtplupd]'), nm = upd ? '' : (box.querySelector('[data-gtplname]').value || '').trim();
        if (!upd && !nm) { box.querySelector('[data-gtplname]').focus(); return; }
        var L = templates(), ex = s.ex.filter(function (x) { return x.n; }).map(tplOf), same = upd ? L.filter(function (t) { return t.id === s.tpl; })[0] : L.filter(function (t) { return String(t.name || '').toLowerCase() === nm.toLowerCase(); })[0];
        if (same) { same.ex = ex; if (nm) same.name = nm; } else { same = { id: uid(), name: nm.slice(0, 30), ex: ex }; L.push(same); }
        s.tpl = same.id; saveTpls(L); naming = false; draw();
        toast('<i class="bi bi-collection"></i> Template “' + esc(same.name) + '” saved – ' + ex.length + ' exercise' + (ex.length === 1 ? '' : 's')); return;
      }
      if ((b = e.target.closest('[data-gsadd]'))) { var x = s.ex[+b.dataset.gsadd], l = x.sets[x.sets.length - 1] || { r: 8, kg: '' }; x.sets.push({ r: l.r, kg: l.kg }); draw(); return; }
      if ((b = e.target.closest('[data-gsdel]'))) { var q = b.dataset.gsdel.split(':'); s.ex[+q[0]].sets.splice(+q[1], 1); if (!s.ex[+q[0]].sets.length) s.ex.splice(+q[0], 1); draw(); return; }
      if ((b = e.target.closest('[data-gexdel]'))) { s.ex.splice(+b.dataset.gexdel, 1); draw(); return; }
      if (e.target.closest('[data-gdel]')) { var t0 = Fe.tools(); t0.gym = (t0.gym || []).filter(function (x) { return x.id !== s.id; }); Fe.saveTools(t0); close(); toast('<i class="bi bi-trash3"></i> Workout deleted', function () { var t1 = Fe.tools(); t1.gym = (t1.gym || []).concat([sess]); Fe.saveTools(t1); }); return; }
      if (e.target.closest('[data-gsave]')) {
        s.ex = s.ex.filter(function (x) { x.sets = x.sets.filter(function (t) { return t.r || t.kg; }); return x.sets.length; });
        if (!s.ex.length) { close(); return; }
        var t = Fe.tools(); t.gym = (t.gym || []).filter(function (x) { return x.id !== s.id; }); t.gym.push(s); Fe.saveTools(t);
        /* tick the training habit for that day */
        var hb = readJSON('dash.habits', null);
        if (hb && hb.list) { var h = hb.list.filter(function (x) { return /train|gym|trening|styrke|strength/i.test(x.name); })[0]; if (h) { hb.log = hb.log || {}; var day = hb.log[s.date] = hb.log[s.date] || []; if (day.indexOf(h.id) < 0) { day.push(h.id); writeJSON('dash.habits', hb); window.dispatchEvent(new Event('habits:change')); } } }
        close(); toast('<i class="bi bi-person-arms-up"></i> Workout saved – ' + s.ex.length + ' exercise' + (s.ex.length === 1 ? '' : 's'));
      }
    });
    draw();
    var inp = box.querySelector('.gym-addex input'); if (inp && isNew) setTimeout(function () { inp.focus(); }, 40);
  }
  document.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-gymstart]')) return gymSheet(null);
    if ((b = e.target.closest('[data-gymtpl]'))) { var tp = templates().filter(function (t) { return t.id === b.dataset.gymtpl; })[0]; if (tp) gymSheet(null, tp); return; }
    if (e.target.closest('[data-gymstarter]')) return starter();
    if (e.target.closest('[data-gymtpledit]')) { tplEdit = !tplEdit; drawAll(); return; }
    if ((b = e.target.closest('[data-gymtpldel]'))) { var all = templates(), gone = all.filter(function (t) { return t.id === b.dataset.gymtpldel; })[0]; saveTpls(all.filter(function (t) { return t !== gone; })); if (gone) toast('<i class="bi bi-trash3"></i> Template “' + esc(gone.name) + '” deleted', function () { saveTpls(templates().concat([gone])); }); return; }
    if ((b = e.target.closest('[data-gymedit]'))) gymSheet(Fe.list('gym').filter(function (x) { return x.id === b.dataset.gymedit; })[0]);
  });
  mount('rest', function (el) {
    var r = window.Readiness ? window.Readiness() : null;
    if (!r || r.score == null) { el.innerHTML = card('rest', 'battery-half', I18N.k('ui.rest-day-advisor', 'Rest-day advisor'), '', '<p class="empty kit-empty" data-t="ui.needs-a-few-days-of-sleep-heart-rate-hrv">Needs a few days of sleep, heart rate (HRV, resting pulse) from Apple Health, or your training log, to know your normal.</p>'); return; }
    var col = { go: '#22b35e', easy: '#c98500', rest: '#e66767' }[r.level], C = 2 * Math.PI * 34;
    var title = { go: 'Ready to train', easy: 'Go easy today', rest: 'Take a rest day' }[r.level];
    var tip = { go: 'Your body is recovered – a good day for a hard session.', easy: 'Train light: technique, mobility, a walk or an easy run.', rest: 'Rest, sleep early and eat well – you’ll come back stronger.' }[r.level];
    el.innerHTML = card('rest', 'battery-half', I18N.k('ui.rest-day-advisor', 'Rest-day advisor'), '', '<div class="rd-row"><svg class="rd-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="trk"/><circle cx="40" cy="40" r="34" class="val" style="stroke:' + col + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - r.score / 100)).toFixed(1) + '"/><text x="40" y="46" text-anchor="middle">' + r.score + '</text></svg>' +
      '<div><b class="rd-t" style="color:' + col + '">' + title + '</b><p class="rd-tip">' + tip + '</p>' + (r.why.length ? '<ul class="rd-why">' + r.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') + '</div></div>', 'lp-rest');
  });
  var packBtn = document.getElementById('tpPackBasics');
  if (packBtn) {
    var sp = document.createElement('button'); sp.type = 'button'; sp.className = 'text-btn'; sp.id = 'tpSmartPack'; sp.innerHTML = '<i class="bi bi-bag-check"></i> Smart list';
    packBtn.parentNode.insertBefore(sp, packBtn.nextSibling);
    var spShow = function () { sp.hidden = !on('smartpack'); if (on('smartpack')) packBtn.hidden = true; };
    window.addEventListener('features:change', spShow); window.addEventListener('travel:change', spShow); spShow();
    sp.addEventListener('click', function () {
      var m = location.hash.match(/trip=([\w-]+)/), F = window.Flow; if (!m || !F) return;
      var data = F.travel(), tr = (data.trips || []).filter(function (t) { return t.id === m[1]; })[0]; if (!tr) return;
      sp.disabled = true; sp.innerHTML = '<i class="bi bi-hourglass-split"></i> Checking the weather …';
      var nights = Math.max(1, Math.round((fromKey(tr.end || tr.start) - fromKey(tr.start)) / 864e5)), days = nights + 1;
      var soon = (fromKey(tr.start) - new Date()) / 864e5 < 15, p = tr.place;
      var wx = soon && p && p.lat != null ? fetch('https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lon + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=' + tr.start + '&end_date=' + (tr.end || tr.start))
        .then(function (r) { return r.json(); }).then(function (d) { var dd = d.daily || {}; return { max: Math.max.apply(null, dd.temperature_2m_max || [20]), min: Math.min.apply(null, dd.temperature_2m_min || [10]), rain: Math.max.apply(null, dd.precipitation_probability_max || [0]) }; }).catch(function () { return null; }) : Promise.resolve(null);
      wx.then(function (w) {
        if (!w) { var mo = fromKey(tr.start).getMonth(), lat = p && p.lat != null ? Math.abs(p.lat) : 55, winter = mo <= 2 || mo >= 10, summer = mo >= 5 && mo <= 7;
          w = { max: lat < 45 ? (summer ? 30 : winter ? 15 : 22) : (summer ? 22 : winter ? 2 : 12), min: lat < 45 ? (winter ? 8 : 15) : (winter ? -4 : 6), rain: 40, guess: true }; }
        var L = ['Passport or ID', 'Phone charger', 'Wallet and cards', 'Toothbrush and toiletries', 'Medicine', 'Headphones'];
        var n = Math.min(days, 7); L.push(n + ' × underwear', n + ' × socks', Math.min(days, 5) + ' × T-shirts');
        if (w.max >= 24) L.push('Sunglasses', 'Sunscreen', 'Shorts', 'Swimwear', 'Sandals', 'Cap or hat'); else if (w.max >= 15) L.push('Light jacket', 'Sunglasses');
        if (w.min <= 10) L.push('Warm sweater', 'Long trousers'); if (w.min <= 3) L.push('Winter jacket', 'Hat and gloves', 'Warm shoes');
        if (w.rain >= 50) L.push('Umbrella', 'Rain jacket');
        if (nights >= 5) L.push('Laundry bag'); if (p && p.cc && p.cc !== 'NO') L.push('Travel adapter', 'EU health card', 'Travel insurance details');
        if (/work|jobb|kurs|conference|konferanse|møte/i.test((tr.name || '') + ' ' + (tr.notes || ''))) L.push('Laptop and charger', 'Smart clothes', 'Business cards');
        if (/ski|hytte|cabin|fjell/i.test((tr.name || '') + ' ' + (tr.dest || '') + ' ' + (tr.notes || ''))) L.push('Wool layer', 'Ski goggles', 'Thermos');
        tr.pack = tr.pack || []; var added = 0;
        L.forEach(function (x) { var base = x.replace(/^\d+ × /, '').toLowerCase(); if (!tr.pack.some(function (q) { return String(q.text || '').toLowerCase().replace(/^\d+ × /, '') === base; })) { tr.pack.push({ id: uid(), text: x, done: false }); added++; } });
        F.saveTravel(data); window.dispatchEvent(new Event('travel:change'));
        sp.disabled = false; sp.innerHTML = '<i class="bi bi-bag-check"></i> Smart list';
        toast('<i class="bi bi-bag-check"></i> ' + added + ' things added' + (w.guess ? ' (weather from the season – forecast comes 2 weeks before)' : ' · ' + Math.round(w.min) + '–' + Math.round(w.max) + '°' + (w.rain >= 50 ? ', rain likely' : '')));
      });
    });
  }
  drawAll();
})();
