/* The Apple Health card on the Habits page (split out of ahealth.js 2026-11-21 – lighter pages: only Habits loads it).
   It takes the helpers from ahealth.js (window.__core.ahealth); ahealth.js calls it through window.__ahCard. */
(function () {
  "use strict";
  var __c = (window.__core || {}).ahealth; if (!__c || !window.Vault) return;
  var readJSON = __c.readJSON, writeJSON = __c.writeJSON, addDays = __c.addDays, $ = __c.$, Fe = __c.Fe, days = __c.days, dkey = __c.dkey, stats = __c.stats, latest = __c.latest, esc = __c.esc, fmt = __c.fmt, pad = __c.pad, LABEL = __c.LABEL, sleepCheck = __c.sleepCheck, lastIn = __c.lastIn, num = __c.num;
  var METRICS = [['steps', 'Steps', 'person-walking', 'var(--ok)'], ['sleep', 'Sleep', 'moon-stars', 'var(--violet)'], ['exercise', 'Exercise', 'activity', 'var(--orange)'],
    ['active', 'Energy', 'fire', 'var(--warn)'], ['stand', 'Stand', 'person-standing', '#2aa7c9'], ['distance', 'Distance', 'signpost-split', '#3fa36b'], ['flights', 'Flights', 'bar-chart-steps', '#9b7b4f'],
    ['hr', 'Heart rate', 'heart-pulse-fill', '#e0475b'], ['rhr', 'Resting HR', 'heart', 'var(--danger)'], ['hrv', 'HRV', 'heart-pulse', '#d0568f'], ['vo2', 'Fitness', 'lungs', '#e0577a'], ['weight', 'Weight', 'speedometer', 'var(--blue)'],
    ['mindful', 'Mindful', 'flower1', '#5bb5a2'], ['water', 'Water', 'droplet', '#3b9de0'], ['daylight', 'Daylight', 'sun', 'var(--gold)']];
  /* lower is better for these */
  var LOWER = { rhr: 1, weight: 1 };
  /* no better or worse direction: the change is shown without colour */
  var NEUTRAL = { hr: 1 };
  var chartM = 'steps', range = 14, selDay = null, editGoal = false, editLayout = false, dayOpen = false, stackIdx = 0;
  /* which numbers are main tiles, which sit in the swipeable stack and which are hidden – per person, synced */
  function layout(have) {
    var L = (readJSON('dash.settings', {}) || {}).ahLayout || {}, where = L.where || {}, order = L.order || [];
    var keys = have.map(function (m) { return m[0]; });
    keys.sort(function (a, b) { var ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 + keys.indexOf(a) : ia) - (ib < 0 ? 99 + keys.indexOf(b) : ib); });
    var out = { tile: [], stack: [], off: [], order: keys }, nTile = 0;
    keys.forEach(function (k) { var w = where[k] || (nTile < 4 ? 'tile' : 'stack'); if (!where[k] && w === 'tile') nTile++; out[w].push(k); });
    return out;
  }
  function saveLayout(fn) { var st = readJSON('dash.settings', {}) || {}; st.ahLayout = st.ahLayout || {}; fn(st.ahLayout); writeJSON('dash.settings', st); }
  try { range = +localStorage.getItem('dash.ahRange') || 14; } catch (e) {}
  /* goals: the dashed line, the tile progress and "Goal reached" – change them on the card */
  var GOAL_DEF = { steps: 10000, sleep: 7, exercise: 30, active: 500, stand: 12, distance: 5, flights: 10, mindful: 10, water: 2, daylight: 30 };
  var GOALABLE = { weight: 1, rhr: 1, hrv: 1, vo2: 1 };          // no default goal, but one can be set
  function reached(m, v, g) { return g != null && v != null && (LOWER[m] ? v <= g : v >= g); }
  /* chart kind: a line shows a trend (weight going down), bars show daily totals */
  var LINE_DEF = { weight: 1, rhr: 1, hrv: 1, vo2: 1, hr: 1 };
  function chartKind(m) { var c = ((readJSON('dash.settings', {}) || {}).ahChart || {})[m]; return c || (LINE_DEF[m] ? 'line' : 'bars'); }
  function goals() { var g = (readJSON('dash.settings', {}) || {}).ahGoals || {}, out = {}; Object.keys(GOAL_DEF).concat(Object.keys(g)).forEach(function (k) { out[k] = g[k] != null ? g[k] : GOAL_DEF[k]; }); if (__c.standMin() && g.stand == null) out.stand = 60; return out; }
  function setGoal(m, v) { var st = readJSON('dash.settings', {}) || {}; st.ahGoals = st.ahGoals || {}; if (v) st.ahGoals[m] = v; else delete st.ahGoals[m]; writeJSON('dash.settings', st); }
  function dayName(k, today) {
    if (k === today) return 'Today';
    if (k === addDays(today, -1)) return 'Yesterday';
    return new Date(k + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  }
  /* the last 7 days as a tiny line (bars for daily totals) – the newest day is the dot */
  function sparkOf(f, D, today) {
    var v = []; for (var i = 6; i >= 0; i--) { var x = D[addDays(today, -i)]; v.push(x && x[f] != null ? x[f] : null); }
    var have = v.filter(function (x) { return x != null; }); if (have.length < 2) return '';
    var lo = Math.min.apply(null, have), hi = Math.max.apply(null, have), W = 48, H = 18;
    var line = LINE_DEF[f];
    if (line) {
      var pts = [], last = null;
      v.forEach(function (x, i) { if (x == null) return; var px = (i / 6 * (W - 4) + 2), py = hi === lo ? H / 2 : H - 3 - (x - lo) / (hi - lo) * (H - 6); pts.push(px.toFixed(1) + ',' + py.toFixed(1)); last = [px, py]; });
      return '<svg class="ah-spark" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><polyline points="' + pts.join(' ') + '"/>' + (last ? '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2"/>' : '') + '</svg>';
    }
    var bw = W / 7;
    return '<svg class="ah-spark bars" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + v.map(function (x, i) {
      if (x == null) return ''; var h = hi > 0 ? Math.max(1.5, x / hi * (H - 2)) : 1.5;
      return '<rect x="' + (i * bw + 1).toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + (bw - 2).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1"' + (i === 6 ? ' class="now"' : '') + '/>';
    }).join('') + '</svg>';
  }
  function card() {
    var host = document.querySelector('.kit-grid'), box = $('ahCard');
    var onP = Fe ? Fe.on('ahealth') : true;
    if (!host || !/\/habits\//.test(location.pathname)) return;
    if (!box) { box = document.createElement('section'); box.className = 'card ah-card kit-wide'; box.id = 'ahCard'; box.setAttribute('data-owner', ''); host.insertBefore(box, host.firstChild); }
    box.hidden = !onP; if (!onP) return;
    var D = days(), keys = Object.keys(D).sort(), today = dkey(new Date()), G = goals();
    var head = '<div class="card-head"><h2><i class="bi bi-apple"></i> <span data-t="ui.apple-health">Apple Health</span></h2><span class="ah-head-btns">' + (keys.length ? '<button type="button" class="text-btn" data-ahlayout aria-pressed="' + editLayout + '"><i class="bi bi-grid-1x2"></i> ' + (editLayout ? 'Done' : 'Customize') + '</button>' : '') + '<a class="text-btn" href="../?settings=ahealth">' + (keys.length ? I18N.k('ui.settings', 'Settings') : I18N.k('ui.set-up', 'Set up')) + '</a></span></div>';
    if (!keys.length) { box.innerHTML = head + '<p class="muted ah-empty">Steps, sleep, resting heart rate and exercise from your iPhone – sent by a Shortcut every evening, kept encrypted with the rest. <a href="/cmd/?settings=ahealth" data-t="ui.set-it-up"><span data-t="ui.set-it-up">Set it up</span></a> (about 10 minutes, once).</p>'; return; }
    var w = stats(addDays(today, -6), today), pw = stats(addDays(today, -13), addDays(today, -7));
    var have = METRICS.filter(function (m) { return keys.some(function (k) { return D[k][m[0]] != null; }); });
    /* Energy waits until a real number comes in – the Shortcut sent only a few kcal (JP's list, point 22) */
    if (!keys.some(function (k) { return +D[k].active >= 50; })) have = have.filter(function (m) { return m[0] !== 'active'; });
    if (!have.some(function (m) { return m[0] === chartM; })) chartM = have[0] ? have[0][0] : 'steps';
    var M = METRICS.filter(function (m) { return m[0] === chartM; })[0], goal = G[chartM] || null;

    /* tiles: latest number, progress to the goal, 7-day average and the change from the week before */
    var LY = layout(have), byKey = {}; have.forEach(function (m) { byKey[m[0]] = m; });
    var visible = LY.tile.concat(LY.stack);
    if (visible.length && visible.indexOf(chartM) < 0) { chartM = visible[0]; M = byKey[chartM]; goal = G[chartM] || null; }
    var spark = ((Fe && Fe.tools().healthcfg) || {}).spark !== false;
    var tileOf = function (m) {
      var l = latest(m[0]), a = w[m[0]].avg, pa = pw[m[0]].avg, diff = a != null && pa ? (a - pa) / pa : null, g = G[m[0]];
      var pct = g && l ? Math.min(100, (LOWER[m[0]] ? g / l.v : l.v / g) * 100) : null;
      return '<button type="button" class="ah-tile' + (m[0] === chartM ? ' on' : '') + '" data-ahm="' + m[0] + '" aria-pressed="' + (m[0] === chartM) + '" style="--c:' + m[3] + '">' + (spark ? '<span class="ah-lrow">' : '') + '<span class="ah-l"><i class="bi bi-' + m[2] + '"></i> ' + m[1] + (l && l.date !== today ? ' <em>· ' + esc(l.date === addDays(today, -1) ? 'yesterday' : new Date(l.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</em>' : '') + '</span>' +
        (spark ? sparkOf(m[0], D, today) + '</span>' : '') + '<b>' + esc(l ? fmt(m[0], l.v) : '–') + '</b>' +
        (pct != null ? '<span class="ah-prog' + (pct >= 100 ? ' full' : '') + '" title="' + Math.round(pct) + '% of ' + esc(fmt(m[0], g)) + '"><i style="width:' + pct.toFixed(1) + '%"></i></span>' : '') +
        '<small>' + (a != null ? '7-day avg ' + esc(fmt(m[0], a)) : '') +
        (diff != null && Math.abs(diff) >= .05 ? ' <span class="' + (NEUTRAL[m[0]] ? 'nt' : (diff > 0) === !LOWER[m[0]] ? 'up' : 'dn') + '">' + (diff > 0 ? '+' : '−') + Math.round(Math.abs(diff) * 100) + '% ' + I18N.k('ui.ah-vs-week', 'vs last week') + '</span>' : '') + '</small></button>';
    };
    var tiles = LY.tile.map(function (k) { return tileOf(byKey[k]); }).join('');
    if (LY.stack.length) {
      var si = LY.stack.indexOf(chartM); if (si >= 0) stackIdx = si; if (stackIdx >= LY.stack.length) stackIdx = 0;
      tiles += '<div class="ah-stack" role="group" aria-label="More numbers – swipe" data-t-aria-label="ui.more-numbers-swipe">' +
        '<div class="ah-stack-track" id="ahStack">' + LY.stack.map(function (k) { return tileOf(byKey[k]); }).join('') + '</div>' +
        (LY.stack.length > 1 ? '<div class="ah-dots">' + LY.stack.map(function (k, i) { return '<button type="button" data-ahdot="' + i + '" aria-label="' + esc(byKey[k][1]) + '"' + (i === stackIdx ? ' class="on"' : '') + ' style="--c:' + byKey[k][3] + '"></button>'; }).join('') + '</div>' : '') + '</div>';
    }
    /* customize: tile / stack / hidden, and the order */
    if (editLayout) {
      tiles = '<div class="ah-edit"><p class="muted" data-t="ui.main-tiles-are-always-shown-the-stack-ho">Main tiles are always shown; the stack holds the rest – swipe it like an iPhone widget.</p>' + LY.order.map(function (k, i) {
        var m = byKey[k], wv = LY.tile.indexOf(k) >= 0 ? 'tile' : LY.stack.indexOf(k) >= 0 ? 'stack' : 'off';
        return '<div class="ah-edit-row" style="--c:' + m[3] + '"><span class="ah-l"><i class="bi bi-' + m[2] + '"></i> ' + m[1] + '</span>' +
          '<span class="seg" role="group" aria-label="' + esc(m[1]) + '">' + [['tile', I18N.k('ui.tile', 'Tile')], ['stack', I18N.k('ui.stack', 'Stack')], ['off', I18N.k('ui.hide', 'Hide')]].map(function (o) { return '<button type="button" data-ahwhere="' + k + '" data-v="' + o[0] + '" aria-pressed="' + (wv === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</span>' +
          '<span class="ah-edit-mv"><button type="button" class="icon-btn" data-ahmove="' + k + '" data-d="-1" aria-label="Move ' + esc(m[1]) + ' up"' + (i ? '' : ' disabled') + '><i class="bi bi-arrow-up"></i></button><button type="button" class="icon-btn" data-ahmove="' + k + '" data-d="1" aria-label="Move ' + esc(m[1]) + ' down"' + (i < LY.order.length - 1 ? '' : ' disabled') + '><i class="bi bi-arrow-down"></i></button></span></div>';
      }).join('') + '<div class="ah-edit-foot"><button type="button" class="text-btn" data-ahlayreset data-t="ui.reset"><span data-t="ui.reset">Reset</span></button><button type="button" class="pill-btn" data-ahlayout data-t="ui.done"><span data-t="ui.done">Done</span></button></div></div>';
    }

    /* the chart: 7, 14 or 30 days; tap a bar to see that day */
    var vals = [], max = 0;
    for (var i = range - 1; i >= 0; i--) { var k = addDays(today, -i), v = D[k] ? D[k][chartM] : null; if (v == null) v = null; vals.push({ k: k, v: v }); if (v > max) max = v; }
    var withData = vals.filter(function (x) { return x.v != null; });
    if (!selDay || selDay < vals[0].k || selDay > today) selDay = withData.length ? withData[withData.length - 1].k : today;
    var kind = chartKind(chartM), min = Infinity;
    withData.forEach(function (x) { if (x.v < min) min = x.v; });
    var bot = 0, top = Math.max(max, goal || 0) * 1.08 || 1;
    if (kind === 'line' && withData.length) {        // a line zooms in on the range, so small changes show
      var lo = Math.min(min, goal != null ? goal : min), hi = Math.max(max, goal != null ? goal : max), pad = Math.max((hi - lo) * .2, Math.abs(hi) * .01, .5);
      bot = lo - pad; top = hi + pad;
    }
    var yOf = function (v) { return (v - bot) / (top - bot) * 100; };
    var ctl = '<div class="ah-ctl"><span class="seg ah-kind" role="group" aria-label="Chart type" data-t-aria-label="ui.chart-type"><button type="button" data-ahkind="bars" aria-pressed="' + (kind === 'bars') + '" aria-label="Bars"><i class="bi bi-bar-chart-fill"></i></button><button type="button" data-ahkind="line" aria-pressed="' + (kind === 'line') + '" aria-label="Line"><i class="bi bi-graph-up"></i></button></span><span class="seg ah-range" role="group" aria-label="Days shown" data-t-aria-label="ui.days-shown">' + [7, 14, 30].map(function (n) { return '<button type="button" data-ahrange="' + n + '" aria-pressed="' + (n === range) + '">' + n + ' days</button>'; }).join('') + '</span></div>';
    var line = '';
    if (kind === 'line' && withData.length) {
      var pts = vals.map(function (x, i) { return x.v == null ? null : [((i + .5) / range * 100).toFixed(2), (100 - yOf(x.v)).toFixed(2)]; }).filter(Boolean);
      var poly = pts.map(function (q) { return q.join(','); }).join(' ');
      line = '<svg class="ah-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
        (pts.length > 1 ? '<polygon points="' + pts[0][0] + ',100 ' + poly + ' ' + pts[pts.length - 1][0] + ',100" /><polyline points="' + poly + '" />' : '') + '</svg>';
      /* the highest and lowest value as a scale, since the line doesn't start at zero */
      if (max > min) line += [max, min].map(function (v) { return '<span class="ah-yl" style="bottom:calc(18px + (100% - 18px) * ' + (yOf(v) / 100).toFixed(3) + ')">' + esc(fmt(chartM, v)) + '</span>'; }).join('');
    }
    var bars = '<div class="ah-chart" style="--c:' + M[3] + '"><div class="ah-bars r' + range + (kind === 'line' ? ' line' : '') + '" role="group" aria-label="' + esc(LABEL[chartM]) + ', last ' + range + ' days">' + vals.map(function (x, idx) {
      var dd = new Date(x.k + 'T12:00'), hgt = x.v != null ? Math.max(3, yOf(x.v)) : 0;
      var lab = range === 30 ? (idx % 5 === 4 || x.k === today ? String(dd.getDate()) : '') : dd.toLocaleDateString('en-GB', { weekday: range === 7 ? 'short' : 'narrow' });
      return '<button type="button" class="ah-bar' + (x.v == null ? ' none' : '') + (reached(chartM, x.v, goal) ? ' hit' : '') + (x.k === selDay ? ' sel' : '') + (x.k === today ? ' today' : '') + '" data-ahday="' + x.k + '" aria-pressed="' + (x.k === selDay) + '" aria-label="' + esc(dayName(x.k, today) + ': ' + (x.v == null ? 'no data' : fmt(chartM, x.v))) + '"><span class="ah-col"><i style="height:' + hgt.toFixed(1) + '%"></i>' + (kind === 'line' && x.v != null ? '<b class="ah-pt" style="bottom:' + yOf(x.v).toFixed(1) + '%"></b>' : '') + '</span><small>' + esc(lab) + '</small></button>';
    }).join('') + line + (goal ? '<em class="ah-goal" style="bottom:calc(18px + (100% - 18px) * ' + (yOf(goal) / 100).toFixed(3) + ')"><span>' + esc(fmt(chartM, goal)) + '</span></em>' : '') + '</div></div>';

    /* the chosen day: every number from it, the goal and what it ticked */
    var day = D[selDay] || {}, hb = readJSON('dash.habits', { list: [] }), sv = day[chartM];
    var chips = visible.map(function (k) { return byKey[k]; }).map(function (m) { return day[m[0]] != null && m[0] !== chartM ? '<button type="button" class="ah-chip' + (m[0] === chartM ? ' on' : '') + '" data-ahm="' + m[0] + '" style="--c:' + m[3] + '"><i class="bi bi-' + m[2] + '"></i> ' + esc(fmt(m[0], day[m[0]])) + '</button>' : ''; }).join('');
    var status = '';
    if (sv != null && goal) status = reached(chartM, sv, goal) ? '<span class="ah-ok"><i class="bi bi-check-circle-fill"></i> <span data-t="ui.goal-reached">Goal reached</span></span>' : '<span class="ah-left">' + esc(fmt(chartM, Math.abs(goal - sv))) + ' ' + (LOWER[chartM] ? 'above the goal' : selDay === today && chartM !== 'sleep' ? 'to go' : 'short of the goal') + '</span>';
    var ticks = (hb.list || []).filter(function (h) { return h.auto && day[h.auto.m] != null && (h.auto.m === 'sleep' ? day.sleep : day[h.auto.m]) >= h.auto.min; }).map(function (h) { return '<span class="ah-tick"><i class="bi bi-check2"></i> ' + esc(h.name) + ' ticked</span>'; }).join('');
    var di = vals.map(function (x) { return x.k; }).indexOf(selDay);
    var nOther = visible.filter(function (k) { return k !== chartM && day[k] != null; }).length;
    var dayBox = '<div class="ah-day" style="--c:' + M[3] + '"><div class="ah-day-h"><button type="button" class="icon-btn" data-ahstep="-1" aria-label="Day before"' + (di <= 0 ? ' disabled' : '') + '><i class="bi bi-chevron-left"></i></button><b>' + esc(dayName(selDay, today)) + '</b><button type="button" class="icon-btn" data-ahstep="1" aria-label="Day after"' + (di >= vals.length - 1 ? ' disabled' : '') + '><i class="bi bi-chevron-right"></i></button>' +
      '<span class="ah-dv"><i class="bi bi-' + M[2] + '"></i> ' + esc(sv != null ? fmt(chartM, sv) : '–') + '</span></div>' +
      (status || ticks ? '<div class="ah-day-s">' + status + (ticks ? '<span class="ah-ticks">' + ticks + '</span>' : '') + '</div>' : '') +
      (nOther ? '<details class="ah-more"' + (dayOpen ? ' open' : '') + '><summary>All numbers this day (' + nOther + ')</summary><div class="ah-chips">' + chips + '</div></details>' : (sv == null && !nOther ? '<p class="muted ah-nodata" data-t="ui.nothing-from-apple-health-this-day">Nothing from Apple Health this day.</p>' : '')) + '</div>';

    /* a line that says something about the period */
    var ins = [];
    if (withData.length) {
      var avg = withData.reduce(function (t, x) { return t + x.v; }, 0) / withData.length;
      var best = withData.reduce(function (b2, x) { return LOWER[chartM] ? (x.v < b2.v ? x : b2) : (x.v > b2.v ? x : b2); });
      if (goal) ins.push('Goal reached ' + withData.filter(function (x) { return reached(chartM, x.v, goal); }).length + ' of ' + withData.length + ' day' + (withData.length === 1 ? '' : 's'));
      if (kind === 'line' && withData.length > 1) {
        var ch = withData[withData.length - 1].v - withData[0].v;
        ins.push(Math.abs(ch) < 1e-9 ? 'no change in ' + range + ' days' : (ch > 0 ? 'up ' : 'down ') + fmt(chartM, Math.abs(ch)) + ' in ' + range + ' days');
      }
      ins.push('average ' + fmt(chartM, avg));
      if (withData.length > 1) ins.push(I18N.k(LOWER[chartM] ? 'ui.ah-lowest' : 'ui.ah-best', LOWER[chartM] ? 'lowest {v} ({d})' : 'best {v} ({d})', { v: fmt(chartM, best.v), d: new Date(best.k + 'T12:00').toLocaleDateString(I18N.lang === 'nb' ? 'nb-NO' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) }));   /* "best 23 878 (lør. 7. nov.)" – the date and the number ran together ("best lør. 7. 23 878", 2026-11-16) */
    }
    var short = keys.length < range ? '<p class="muted ah-grow"><i class="bi bi-hourglass-split"></i> History builds up by itself – one more day every evening (since ' + esc(new Date(keys[0] + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + ').</p>' : '';
    var lastT = (window.Vault.get().health || {}).last;
    var goalCtl = GOAL_DEF[chartM] != null || GOALABLE[chartM] ? (editGoal ? '<span class="ah-goaledit"><span data-t="ui.goal">Goal</span> <input id="ahGoalIn" inputmode="decimal" value="' + esc(goal == null ? '' : goal) + '" aria-label="Goal for ' + esc(LABEL[chartM]) + '">' + ({ weight: ' kg', rhr: ' bpm', hrv: ' ms', sleep: ' h', exercise: ' min', active: ' kcal', stand: ' h', distance: ' km', mindful: ' min', water: ' l', daylight: ' min', flights: ' floors' }[chartM] || '') + ' <button type="button" class="text-btn" data-ahgoalsave data-t="ui.save"><span data-t="ui.save">Save</span></button></span>' : '<button type="button" class="text-btn ah-goalbtn" data-ahgoal><i class="bi bi-flag"></i> Goal ' + esc(fmt(chartM, goal)) + '</button>') : '';
    /* sleep that's far too short on several days: usually the Shortcut only gets part of the night (Limit on in Find Health Samples) */
    var low = keys.filter(function (k) { var v = D[k].sleep; return v != null && v > 0 && v < 2; });
    var sc0 = sleepCheck(lastIn()), li0 = lastIn();
    var sleepNote = sc0 && sc0.bad && li0 && li0.t && Date.now() - li0.t < 3 * 864e5 ? '<div class="ah-warn"><i class="bi bi-moon-stars"></i><span><b>' + esc(sc0.title) + '.</b> <a href="../?settings=ahealth">See what your iPhone sent and how to fix it</a></span></div>' : '';
    var lowNote = low.length >= 2 ? '<div class="ah-warn"><i class="bi bi-exclamation-triangle"></i><span>' + I18N.k('ui.ah-low', '<b>Sleep under 2 hours on {n} days</b> – the Shortcut probably gets only part of the night. In the Shortcut’s sleep step (Find Health Samples, Type Sleep), switch <b>Limit</b> off.', { n: low.length }) + '</span>' +
      '<button type="button" class="text-btn" data-ahlowdel>' + I18N.k('ui.ah-low-del', 'Remove those {n} nights', { n: low.length }) + '</button></div>' : '';
    box.innerHTML = head + (lowNote || sleepNote) + '<div class="ah-tiles' + (editLayout ? ' editing' : '') + '">' + tiles + '</div>' + ctl + bars + dayBox +
      (ins.length ? '<p class="ah-ins">' + esc(ins.join(' · ')) + '</p>' : '') + short +
      '<div class="ah-foot muted"><span>' + (lastT ? 'Updated ' + esc(new Date(lastT).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : '') + '</span>' + goalCtl + '</div>';
    if (editGoal && $('ahGoalIn')) { $('ahGoalIn').focus(); $('ahGoalIn').select(); }
    var tr = $('ahStack');
    if (tr) {
      tr.scrollLeft = stackIdx * tr.clientWidth;
      tr.addEventListener('scroll', function () {
        var n = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)); if (n === stackIdx) return; stackIdx = n;
        box.querySelectorAll('[data-ahdot]').forEach(function (d, i) { d.classList.toggle('on', i === n); });
      }, { passive: true });
    }
    var det = box.querySelector('.ah-more'); if (det) det.addEventListener('toggle', function () { dayOpen = det.open; });
  }
  function saveGoal() { var v = num(($('ahGoalIn') || {}).value); setGoal(chartM, v && v > 0 ? v : null); editGoal = false; card(); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ahm]'); if (b) { chartM = b.dataset.ahm; editGoal = false; card(); return; }
    var r = e.target.closest('[data-ahrange]'); if (r) { range = +r.dataset.ahrange; try { localStorage.setItem('dash.ahRange', range); } catch (x) {} card(); return; }
    var d = e.target.closest('[data-ahday]'); if (d) { selDay = d.dataset.ahday; card(); var nb = document.querySelector('[data-ahday="' + selDay + '"]'); if (nb) nb.focus(); return; }
    var st = e.target.closest('[data-ahstep]'); if (st) { selDay = addDays(selDay, +st.dataset.ahstep); card(); var nb2 = document.querySelector('[data-ahstep="' + st.dataset.ahstep + '"]'); if (nb2 && !nb2.disabled) nb2.focus(); return; }
    if (e.target.closest('[data-ahgoal]')) { editGoal = true; card(); return; }
    var dt = e.target.closest('[data-ahdot]'); if (dt) { stackIdx = +dt.dataset.ahdot; var t = $('ahStack'); if (t) t.scrollTo({ left: stackIdx * t.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
    var kd = e.target.closest('[data-ahkind]'); if (kd) { var st = readJSON('dash.settings', {}) || {}; st.ahChart = st.ahChart || {}; st.ahChart[chartM] = kd.dataset.ahkind; writeJSON('dash.settings', st); card(); return; }
    if (e.target.closest('[data-ahlayout]')) { editLayout = !editLayout; card(); return; }
    if (e.target.closest('[data-ahlowdel]')) {
      var dd = window.Vault.get(); if (!dd || !dd.health || !dd.health.days) return;
      var gone = {}; Object.keys(dd.health.days).forEach(function (k) { var x = dd.health.days[k]; if (x && x.sleep != null && x.sleep > 0 && x.sleep < 2) { gone[k] = x.sleep; delete x.sleep; } });
      window.Vault.save(dd); window.dispatchEvent(new Event('health:change')); card();
      if (window.Quick) window.Quick.toast('<i class="bi bi-moon-stars"></i> ' + Object.keys(gone).length + ' short nights removed', function () { var x = window.Vault.get(); Object.keys(gone).forEach(function (k) { if (x.health.days[k]) x.health.days[k].sleep = gone[k]; }); window.Vault.save(x); window.dispatchEvent(new Event('health:change')); card(); });
      return;
    }
    if (e.target.closest('[data-ahlayreset]')) { saveLayout(function (L) { delete L.where; delete L.order; }); card(); return; }
    var wh = e.target.closest('[data-ahwhere]'); if (wh) { saveLayout(function (L) { L.where = L.where || {}; L.where[wh.dataset.ahwhere] = wh.dataset.v; }); card(); return; }
    var mv = e.target.closest('[data-ahmove]'); if (mv) { var D0 = days(), ks = Object.keys(D0), hv = METRICS.filter(function (m) { return ks.some(function (k) { return D0[k][m[0]] != null; }); }), ord = layout(hv).order, ix = ord.indexOf(mv.dataset.ahmove), to = ix + (+mv.dataset.d);
      if (to < 0 || to >= ord.length) return; ord.splice(to, 0, ord.splice(ix, 1)[0]); saveLayout(function (L) { L.order = ord; }); card(); var b2 = document.querySelector('[data-ahmove="' + mv.dataset.ahmove + '"][data-d="' + mv.dataset.d + '"]'); if (b2 && !b2.disabled) b2.focus(); return; }
    if (e.target.closest('[data-ahgoalsave]')) { saveGoal(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.id === 'ahGoalIn') { if (e.key === 'Enter') { e.preventDefault(); saveGoal(); } else if (e.key === 'Escape') { editGoal = false; card(); } return; }
    var d = e.target.closest && e.target.closest('[data-ahday]'); if (!d || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault(); var n = addDays(d.dataset.ahday, e.key === 'ArrowLeft' ? -1 : 1), t = document.querySelector('[data-ahday="' + n + '"]');
    if (t) { selDay = n; card(); document.querySelector('[data-ahday="' + n + '"]').focus(); }
  });

  window.__ahCard = card;
  if (window.Vault.get && window.Vault.get()) setTimeout(card, 0);
})();
