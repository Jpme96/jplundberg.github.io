/* Health, batch 3 (Oct 2026): the weekly health report.
   Every Sunday (or Monday – Settings → Pages → Health) the week's sleep, steps, exercise, training,
   mood and habits are compared with the week before: a card on the Health page and a line in
   At a glance. Worked out on this device from Apple Health, the training and gym logs, the journal
   and habits – nothing is stored. Settings → Pages → Health also holds the habit calendar range,
   the tile mini charts and the gym templates. Settings in dash.tools.healthcfg (synced). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function fmt(k, o) { return fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }); }

  var DEF = { day: 0, hour: 12, glance: true, heat: '26', spark: true };
  function cfg() { var c = Fe.tools().healthcfg; return Object.assign({}, DEF, c && typeof c === 'object' ? c : {}); }
  function setCfg(p) { var t = Fe.tools(); t.healthcfg = Object.assign({}, t.healthcfg || {}, p); Fe.saveTools(t); }
  function monday(k) { var d = fromKey(k); return addDays(k, -((d.getDay() + 6) % 7)); }

  /* the week the report is about right now: on report day the week that ends today, otherwise the last whole week */
  function reportWeek(now) {
    now = now || new Date(); var tk = dkey(now), mon = monday(tk), c = cfg();
    if (+c.day === 0 && now.getDay() === 0 && now.getHours() >= +c.hour) return mon;
    return addDays(mon, -7);
  }
  /* is it the time to bring it up in At a glance? Sunday from the hour → Monday, or Monday from the hour → Tuesday morning */
  function due(now) {
    now = now || new Date(); var c = cfg(), d = now.getDay(), h = now.getHours();
    if (+c.day === 0) return (d === 0 && h >= +c.hour) || d === 1;
    return (d === 1 && h >= +c.hour) || (d === 2 && h < 10);
  }

  function week(mon) {
    var end = addDays(mon, 6), out = { mon: mon, end: end }, AH = window.AHealth;
    var ahOn = AH && Fe.on('ahealth');
    if (ahOn) {
      var st = AH.stats(mon, end);
      out.sleep = st.sleep && st.sleep.n ? st.sleep.avg : null;
      out.steps = st.steps && st.steps.n ? st.steps.avg : null;
      out.exercise = st.exercise && st.exercise.n ? st.exercise.sum : null;
      out.rhr = st.rhr && st.rhr.n ? st.rhr.avg : null;
    }
    var inW = function (x) { return x && x.date >= mon && x.date <= end; };
    var tr = Fe.on('training') ? Fe.list('training').filter(inW) : [], gym = Fe.on('gym') ? Fe.list('gym').filter(inW) : [];
    /* a gym session also logged in the training log on the same day counts once */
    var trDays = {}; tr.forEach(function (w) { if (w.kind === 'strength') trDays[w.date] = 1; });
    var gymOnly = gym.filter(function (g) { return !trDays[g.date]; });
    out.workouts = Fe.on('training') || Fe.on('gym') ? tr.length + gymOnly.length : null;
    out.trainMin = tr.reduce(function (a, w) { return a + (+w.min || 0); }, 0);
    out.km = tr.reduce(function (a, w) { return a + (+w.km || 0); }, 0);
    var moods = Fe.on('journal') ? Fe.list('journal').filter(inW).map(function (j) { return +j.mood; }).filter(function (m) { return m >= 1 && m <= 5; }) : [];
    out.mood = moods.length ? moods.reduce(function (a, m) { return a + m; }, 0) / moods.length : null;
    out.moodN = moods.length;
    var hb = readJSON('dash.habits', null);
    if (hb && hb.list && hb.list.length) {
      var met = 0;
      hb.list.forEach(function (h) { var n = 0; for (var i = 0; i < 7; i++) if (((hb.log || {})[addDays(mon, i)] || []).indexOf(h.id) > -1) n++; if (n >= (+h.target || 1)) met++; });
      out.habits = met; out.habitsOf = hb.list.length;
    } else out.habits = null;
    return out;
  }
  function hm(h) { var m = Math.round(h * 60); return Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min'; }
  function hmShort(mins) { mins = Math.round(Math.abs(mins)); return mins >= 60 ? Math.floor(mins / 60) + ' h ' + pad(mins % 60) : mins + ' min'; }
  /* [key, label, icon, colour, value text, delta text, better?] */
  var ROWS = [
    ['sleep', 'Sleep', 'moon-stars', '#8a6fdf', function (v) { return hm(v); }, function (d) { return (d > 0 ? '+' : '−') + hmShort(d * 60); }, 1, 'a night'],
    ['steps', 'Steps', 'person-walking', '#22b35e', function (v) { return nf.format(Math.round(v)); }, function (d, a, b) { return (d > 0 ? '+' : '−') + Math.round(Math.abs(d / b) * 100) + '%'; }, 1, 'a day'],
    ['exercise', 'Exercise', 'activity', '#e8743b', function (v) { return Math.round(v) + ' min'; }, function (d) { return (d > 0 ? '+' : '−') + Math.round(Math.abs(d)) + ' min'; }, 1, 'in total'],
    ['workouts', 'Workouts', 'heart-pulse', '#d55181', function (v) { return String(v); }, function (d) { return (d > 0 ? '+' : '−') + Math.abs(d); }, 1, ''],
    ['rhr', 'Resting HR', 'heart', '#e66767', function (v) { return Math.round(v) + ' bpm'; }, function (d) { return (d > 0 ? '+' : '−') + Math.round(Math.abs(d)); }, -1, 'average'],
    ['mood', 'Mood', 'emoji-smile', '#c9a227', function (v) { return nf1.format(v) + ' / 5'; }, function (d) { return (d > 0 ? '+' : '−') + nf1.format(Math.abs(d)); }, 1, 'average'],
    ['habits', 'Habits on target', 'check2-circle', '#11a597', function (v, w) { return v + ' / ' + w.habitsOf; }, function (d) { return (d > 0 ? '+' : '−') + Math.abs(d); }, 1, '']
  ];
  function compare(w, p) {
    return ROWS.filter(function (r) { return w[r[0]] != null; }).map(function (r) {
      var v = w[r[0]], pv = p[r[0]], d = pv != null ? v - pv : null;
      var small = d == null || (r[0] === 'sleep' && Math.abs(d) < .15) || (r[0] === 'steps' && pv && Math.abs(d / pv) < .05) || (r[0] === 'exercise' && Math.abs(d) < 10) || (r[0] === 'rhr' && Math.abs(d) < 1) || (r[0] === 'mood' && Math.abs(d) < .2) || ((r[0] === 'workouts' || r[0] === 'habits') && d === 0);
      return { r: r, v: v, pv: pv, d: d, flat: small, good: d != null && !small ? (d > 0) === (r[6] > 0) : null };
    });
  }
  function headline(rows) {
    var up = rows.filter(function (x) { return x.good === true; }), dn = rows.filter(function (x) { return x.good === false; });
    var name = function (x) { return { sleep: 'more sleep', steps: 'more steps', exercise: 'more exercise', workouts: 'more workouts', rhr: 'a lower resting pulse', mood: 'a better mood', habits: 'more habits on target' }[x.r[0]]; };
    var bad = function (x) { return { sleep: 'less sleep', steps: 'fewer steps', exercise: 'less exercise', workouts: 'fewer workouts', rhr: 'a higher resting pulse', mood: 'a lower mood', habits: 'fewer habits on target' }[x.r[0]]; };
    if (!rows.some(function (x) { return x.pv != null; })) return 'Your first week – next week shows how it compares.';
    if (up.length && !dn.length) return 'A good week: ' + up.slice(0, 2).map(name).join(' and ') + '.';
    if (dn.length && !up.length) return 'A quieter week: ' + dn.slice(0, 2).map(bad).join(' and ') + '.';
    if (up.length) return 'Better: ' + up.slice(0, 2).map(name).join(', ') + ' · Watch: ' + dn.slice(0, 1).map(bad).join('') + '.';
    return 'Much the same as the week before.';
  }
  function line(rows) {
    return rows.filter(function (x) { return ['sleep', 'steps', 'workouts', 'mood'].indexOf(x.r[0]) > -1; }).map(function (x) {
      var t = x.r[0] === 'sleep' ? hmShort(x.v * 60) + ' sleep' : x.r[0] === 'steps' ? nf.format(Math.round(x.v)) + ' steps' : x.r[0] === 'workouts' ? x.v + ' workout' + (x.v === 1 ? '' : 's') : 'mood ' + nf1.format(x.v);
      return t + (x.d != null && !x.flat ? ' (' + x.r[5](x.d, x.v, x.pv) + ')' : '');
    }).join(' · ');
  }
  function weekName(mon) { var e = addDays(mon, 6); return fmt(mon, { day: 'numeric', month: 'short' }) + ' – ' + fmt(e, { day: 'numeric', month: 'short' }); }

  /* ---------- the card on the Health page ---------- */
  var host = document.querySelector('[data-tool="hreport"]'), shown = null;
  function card() {
    if (!host || !window.Vault.get()) return;
    var on = Fe.on('hreport'); host.hidden = !on; if (host.parentNode && host.parentNode.classList.contains('hr-wrap')) host.parentNode.hidden = !on;
    if (!on) { host.innerHTML = ''; return; }
    var cur = reportWeek(); if (!shown || shown > cur) shown = cur;
    var w = week(shown), p = week(addDays(shown, -7)), rows = compare(w, p), live = shown === monday(dkey(new Date()));
    var body = rows.length ? '<p class="hr-lead">' + esc(headline(rows)) + '</p><div class="hr-grid">' + rows.map(function (x) {
        return '<div class="hr-m" style="--c:' + x.r[3] + '" data-tk="' + esc(x.r[1]) + '"><span class="hr-l"><i class="bi bi-' + x.r[2] + '"></i> ' + esc(x.r[1]) + '</span><b>' + esc(x.r[4](x.v, w)) + '</b>' +
          '<small>' + (x.r[7] ? esc(x.r[7]) + ' · ' : '') + (x.d == null ? 'no week before' : x.flat ? '<span class="nt">same as last week</span>' : '<span class="' + (x.good ? 'up' : 'dn') + '">' + esc(x.r[5](x.d, x.v, x.pv)) + '</span> vs last week') + '</small></div>';
      }).join('') + '</div>' + (w.km ? '<p class="muted hr-foot">' + esc(nf1.format(w.km) + ' km and ' + hmShort(w.trainMin) + ' of training logged') + '</p>' : '')
      : '<p class="empty kit-empty">Nothing logged this week. With Apple Health, the training log, the journal or habits, the report fills itself.</p>';
    host.innerHTML = '<section class="card kit-card hr-card" id="hreport"><div class="card-head"><h2><i class="bi bi-clipboard2-heart"></i> Weekly report<small>' + esc((live ? 'This week · ' : '') + weekName(shown)) + '</small></h2><div class="head-actions">' +
      '<button type="button" class="icon-btn sm" data-hrnav="-1" aria-label="Week before"><i class="bi bi-chevron-left"></i></button><button type="button" class="icon-btn sm" data-hrnav="1" aria-label="Week after"' + (shown >= cur ? ' disabled' : '') + '><i class="bi bi-chevron-right"></i></button>' +
      (rows.length ? '<button type="button" class="text-btn" data-hrshare aria-label="Share the report"><i class="bi bi-box-arrow-up"></i></button>' : '') + '</div></div>' + body + '</section>';
  }
  if (host) {
    var t = null;
    ['tools:change', 'features:change', 'habits:change', 'health:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(t); t = setTimeout(card, 60); }); });
    var prevReload = window.Dash && window.Dash.reload; window.Dash = window.Dash || {};
    window.Dash.reload = function () { if (prevReload) prevReload(); clearTimeout(t); t = setTimeout(card, 60); };
    window.Vault.onUnlock(function () { setTimeout(function () { card(); if (location.hash === '#hreport') { var c = document.getElementById('hreport'); if (c) c.scrollIntoView({ block: 'start' }); } }, 150); });
    host.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-hrnav]'))) { shown = addDays(shown, 7 * +b.dataset.hrnav); card(); return; }
      if (e.target.closest('[data-hrshare]')) {
        var w = week(shown), rows = compare(w, week(addDays(shown, -7)));
        var txt = 'Health ' + weekName(shown) + '\n' + headline(rows) + '\n' + rows.map(function (x) { return '• ' + x.r[1] + ': ' + x.r[4](x.v, w) + (x.d != null && !x.flat ? ' (' + x.r[5](x.d, x.v, x.pv) + ')' : ''); }).join('\n');
        if (window.I18N && window.I18N.lang === 'nb') txt = txt.split('\n').map(function (l) { return window.I18N.t(l); }).join('\n');
        if (navigator.share) navigator.share({ text: txt }).catch(function () {}); else try { navigator.clipboard.writeText(txt).then(function () { toast('<i class="bi bi-clipboard-check"></i> Copied'); }); } catch (er) {}
      }
    });
  }

  /* ---------- At a glance ---------- */
  (window.BriefExtra = window.BriefExtra || []).push(function (add, now) {
    if (!Fe.on('hreport') || !Fe.on('healthpage') || !cfg().glance || !due(now)) return;
    var mon = reportWeek(now), rows = compare(week(mon), week(addDays(mon, -7)));
    if (!rows.length) return;
    add(30, 'clipboard2-heart', '#d55181', 'Your week in health: ' + headline(rows).replace(/\.$/, ''), line(rows) || weekName(mon), /\/cmd\/habits\//.test(location.pathname) ? '#hreport' : '/cmd/habits/#hreport', { key: 'hrep:' + mon });
  });
  /* ⌘K */
  (window.CommandExtra = window.CommandExtra || []).push(function () { return Fe.on('hreport') && Fe.on('healthpage') ? [{ i: 'clipboard2-heart', t: 'Weekly health report', s: 'Sleep, steps, training and mood vs last week', run: function () { location.href = '/cmd/habits/#hreport'; }, x: 'health report week uke helse rapport' }] : []; });

  /* ---------- Settings → Pages → Health ---------- */
  (function () {
    var pg = document.querySelector('.st-page[data-page="health"]'); if (!pg) return;
    function sel(f, label, opts, sub) { var v = String(cfg()[f]); return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><select class="st-select" data-hcfg="' + f + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
    function sw(f, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-hcfg="' + f + '"' + (cfg()[f] ? ' checked' : '') + '></label>'; }
    function feat(id, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-hfeat="' + id + '"' + (Fe.on(id) ? ' checked' : '') + '></label>'; }
    function subh(icon, t) { return '<p class="st-sub ap-sub"><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</p>'; }
    function fill() {
      var box = document.getElementById('hpSet'); if (!box) return;
      var tpl = (Fe.tools().gymtpl || []).length;
      box.innerHTML = '<p class="st-intro">The Health page: the weekly report, the habit calendar and the gym log.</p>' +
        subh('clipboard2-heart', 'Weekly report') + '<div class="st-group">' + feat('hreport', 'Show the weekly report', 'Sleep, steps, training and mood vs last week') +
        sel('day', 'Report day', [[0, 'Sunday'], [1, 'Monday']]) + sel('hour', 'From', [8, 12, 16, 18, 20].map(function (h) { return [h, pad(h) + ':00']; })) + sw('glance', 'Show it in At a glance') + '</div>' +
        subh('calendar3', 'Habit calendar') + '<div class="st-group">' + sel('heat', 'Each habit shows', [['26', 'The last 26 weeks'], ['year', 'The whole year']], 'Change it on a habit too') + '</div>' +
        subh('apple', 'Apple Health') + '<div class="st-group">' + sw('spark', 'Mini charts on the number tiles', 'The last 7 days') + '</div>' +
        (Fe.on('gym') ? subh('person-arms-up', 'Gym log') + '<div class="st-group"><a class="st-row st-btn" href="/cmd/habits/#gym"><span><i class="bi bi-collection"></i> ' + (tpl ? tpl + ' workout template' + (tpl === 1 ? '' : 's') : 'Workout templates') + '<small class="st-rsub">Save Push, Pull, Legs … and start one with a tap</small></span><i class="bi bi-chevron-right"></i></a>' +
          (tpl ? '' : '<button type="button" class="st-row st-btn" data-hppl><span><i class="bi bi-plus-lg"></i> Add Push, Pull and Legs</span></button>') + '</div>' : '') +
        '<div class="st-group"><a class="st-row st-btn" href="/cmd/habits/"><span><i class="bi bi-heart-pulse"></i> Open Health</span><i class="bi bi-chevron-right"></i></a><a class="st-row st-btn" href="/cmd/habits/?customize"><span><i class="bi bi-grid-1x2"></i> Order and hide cards</span><i class="bi bi-chevron-right"></i></a></div>';
    }
    function row() {
      var r = document.getElementById('stRow-health'); if (r) r.hidden = !Fe.on('healthpage');
      var s = document.getElementById('sum-health'), c = cfg();
      if (s) s.textContent = (Fe.on('hreport') ? 'Report on ' + (+c.day ? 'Mondays' : 'Sundays') : 'No weekly report') + ' · habits ' + (c.heat === 'year' ? 'by year' : '26 weeks');
    }
    pg.addEventListener('change', function (e) {
      var i = e.target;
      if (i.dataset.hfeat) { Fe.set(i.dataset.hfeat, i.checked); return; }
      if (!i.dataset.hcfg) return;
      var p = {}; p[i.dataset.hcfg] = i.type === 'checkbox' ? i.checked : /^\d+$/.test(i.value) ? +i.value : i.value; setCfg(p);
      if (i.dataset.hcfg === 'heat') try { localStorage.removeItem('dash.hpRange'); } catch (er) {}
      if (i.dataset.hcfg === 'spark') window.dispatchEvent(new Event('health:change'));
      toast('<i class="bi bi-check2"></i> Saved');
    });
    pg.addEventListener('click', function (e) { if (e.target.closest('[data-hppl]') && window.GymTpl) { window.GymTpl.starter(); fill(); } });
    window.addEventListener('st:page', function (e) { if (e.detail === 'health') fill(); if (e.detail === 'home') row(); });
    ['features:change', 'tools:change'].forEach(function (ev) { window.addEventListener(ev, function () { row(); if (!pg.hidden && !pg.contains(document.activeElement)) fill(); }); });
    window.Vault.onUnlock(function () { row(); fill(); });
  })();

  window.HealthPlus = { cfg: cfg, week: week, compare: compare, reportWeek: reportWeek, due: due };
})();
