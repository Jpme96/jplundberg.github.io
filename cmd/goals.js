/* Goals (/cmd/goals/): the same goals as the Goals card on Home (dash.goals), with more room – a kind,
   a date to reach it by, steps to tick off, and goals that keep their own number up to date from the
   rest of the dashboard: an account balance, your savings, a loan paid off, debt left, house projects
   done, trips taken, wishes bought.
   Updates itself: the number follows its source; the page shows if you're on pace for the date and what
   it takes per week; a goal you reach is marked done (and can go to "Done" after a while by itself);
   At a glance reminds you when a dated goal is behind, or a number you type yourself hasn't moved in a while.
   A goal: { id, name, value, target, habit?, ah?, cat, due, start, from, src, steps:[{t,d}], done, arch }
   Settings: dash.tools.goalcfg (Settings → Pages → Goals). */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in goals.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["goals"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  var PAGE = /\/cmd\/goals\/$/.test(location.pathname);
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var dkey = Fe.dkey;
  var fromKey = Fe.fromKey;
  function today() { return dkey(new Date()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function days(a, b) { return Math.round((fromKey(b) - fromKey(a)) / 864e5); }
  function fmtD(k) { return isKey(k) ? fromKey(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: fromKey(k).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : ''; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(+n || 0)) + ' kr'; }
  function n2(n) { return (Math.round((+n || 0) * 100) / 100).toLocaleString('en-GB'); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function on() { return Fe.on('goals'); }
  function readJSON(k, f) { try { var v = localStorage.getItem(k); return v === null ? f : JSON.parse(v); } catch (e) { return f; } }
  function writeJSON(k, v) { try { var s = JSON.stringify(v); if (localStorage.getItem(k) === s) return; localStorage.setItem(k, s); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function goals() { var g = readJSON('dash.goals', []); return Array.isArray(g) ? g.filter(function (x) { return x && typeof x === 'object'; }) : []; }
  function saveGoals(l) { writeJSON('dash.goals', l); window.dispatchEvent(new Event('goals:refresh')); }
  var GREEN = '#22b35e';
  var AMBER = '#c98500';
  var RED = '#e66767';
  var GREY = '#7a8794';
  var DEF = { brief: true, lead: 30, stale: 14, archive: 30, celebrate: true, sort: 'due' };
  function cfg() { var c = Fe.tools().goalcfg; return Object.assign({}, DEF, c && typeof c === 'object' ? c : {}); }
  function setCfg(p) { var t = Fe.tools(); t.goalcfg = Object.assign({}, t.goalcfg || {}, p); Fe.saveTools(t); }
  function fin() { return window.Vault.get() || null; }
  function year() { return String(new Date().getFullYear()); }
  function sources() {
    var d = fin(), out = [], A = window.Accts, L = window.Loans;
    if (d && A) {
      out.push({ id: 'saved', label: 'Savings in total', unit: 'kr', grp: 'Money', get: function (d) { return A.money(d).saved; } });
      A.list(d).forEach(function (a) { out.push({ id: 'acct:' + a.id, label: 'Balance on ' + a.label, unit: 'kr', grp: 'Money', get: function (d) { var x = A.get(d, a.id); return x && x.bal != null ? (x.kind === 'credit' ? -x.bal : x.bal) : null; } }); });
    }
    if (d && L) {
      var debts = (d.accounts || []).filter(function (a) { return a.kind === 'debt'; });
      if (debts.length) out.push({ id: 'debt', label: 'Debt left in total', unit: 'kr', lower: true, grp: 'Money', def: 0, get: function (d) { return (d.accounts || []).filter(function (a) { return a.kind === 'debt'; }).reduce(function (s, l) { return s + L.owedNow(l) * L.part(l); }, 0); } });
      debts.forEach(function (l) {
        out.push({ id: 'loan:' + l.id, label: 'Paid off on ' + (l.name || 'the loan'), unit: 'kr', grp: 'Money', def: function (d) { var x = (d.accounts || []).filter(function (a) { return a.id === l.id; })[0], p = x && L.paid(x); return p ? Math.round(p.start) : null; },
          get: function (d) { var x = (d.accounts || []).filter(function (a) { return a.id === l.id; })[0], p = x && L.paid(x); return p ? p.principal : null; } });
      });
    }
    /* Health: training, medicine, steps and sleep */
    var ym = today().slice(0, 7), mon = (function () { var d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dkey(d); })();
    var sessions = function (from, to) { var T = Fe.tools(), seen = {}; (T.training || []).concat((T.gym || []).map(function (g) { return { date: String(g.date || '').slice(0, 10) }; })).forEach(function (w) { if (w.date >= from && w.date <= to) seen[w.date + (w.kind || '')] = 1; }); return Object.keys(seen).length; };
    if (Fe.on('training') || Fe.on('gym')) {
      out.push({ id: 'trainM', label: 'Training sessions this month', unit: '', grp: 'Health', get: function () { return sessions(ym + '-01', ym + '-31'); } });
      out.push({ id: 'trainW', label: 'Training sessions this week', unit: '', grp: 'Health', get: function () { return sessions(mon, today()); } });
    }
    if (Fe.on('health')) out.push({ id: 'medM', label: 'Medicine taken this month', unit: '', grp: 'Health', get: function () { var t = Fe.tools().htaken || {}, n = 0; Object.keys(t).forEach(function (k) { if (k.slice(0, 7) === ym) n += Object.keys(t[k] || {}).length; }); return n; } });
    if (Fe.on('ahealth')) {
      var days = function () { var d = fin(); return (d && d.health && d.health.days) || {}; };
      out.push({ id: 'stepsW', label: 'Steps this week', unit: '', grp: 'Health', get: function () { var D = days(), n = 0; Object.keys(D).forEach(function (k) { if (k >= mon && k <= today()) n += +D[k].steps || 0; }); return n; } });
      out.push({ id: 'sleep7', label: 'Sleep, 7-night average (h)', unit: '', grp: 'Health', get: function () { var D = days(), v = []; for (var i = 0; i < 7; i++) { var dd = new Date(); dd.setDate(dd.getDate() - i); var x = D[dkey(dd)]; if (x && x.sleep) v.push(+x.sleep); } return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length * 10) / 10 : null; } });
    }
    if (Fe.on('house') && Fe.on('hproj')) out.push({ id: 'hproj', label: 'House projects done this year', unit: '', grp: 'Home', get: function () { return Fe.list('hproj').filter(function (p) { return p.status === 'done' && String(p.end || p.start || '').slice(0, 4) === year(); }).length; } });
    if (Fe.on('wish')) out.push({ id: 'wish', label: 'Wishes bought this year', unit: '', grp: 'Home', get: function () { return Fe.list('wbought').filter(function (x) { return String(x.bought || '').slice(0, 4) === year(); }).length; } });
    if (Fe.on('travel')) out.push({ id: 'trips', label: 'Trips this year', unit: '', grp: 'Life', get: function () { var t = readJSON('dash.travel', {}) || {}; return (t.trips || []).filter(function (x) { return String(x.start || '').slice(0, 4) === year() && x.start <= today(); }).length; } });
    return out;
  }
  function src(id) { return id ? sources().filter(function (s) { return s.id === id; })[0] || null : null; }
  function srcValue(g) {
    if (g.src === 'steps') { var st = g.steps || []; return st.filter(function (s) { return s.d; }).length; }
    var s = src(g.src), d = fin(); if (!s) return null;
    try { var v = s.get(d); return v == null || !isFinite(v) ? null : Math.round(v * 100) / 100; } catch (e) { return null; }
  }
  function lower(g) { var s = g.src && g.src !== 'steps' ? src(g.src) : null; return !!(s && s.lower) || /^(weight|rhr):/.test(g.ah || ''); }
  function unit(g) { var s = g.src && src(g.src); return s ? s.unit : g.unit || ''; }
  function show(g, v) { return unit(g) === 'kr' ? kr(v) : n2(v); }
  function pct(g) {
    var v = +g.value || 0, t = +g.target || 0;
    if (g.src === 'steps') { var n = (g.steps || []).length; return n ? v / n : 0; }
    if (lower(g)) { var f = g.from != null ? +g.from : null; if (f == null || f <= t) return v <= t ? 1 : 0; return Math.max(0, Math.min(1, (f - v) / (f - t))); }
    if (!(t > 0)) return 0;
    var f0 = g.from != null && +g.from < t && g.src ? +g.from : 0;
    return Math.max(0, Math.min(1, (v - f0) / (t - f0)));
  }
  function pace(g) {
    if (!isKey(g.due) || g.done) return null;
    var st = isKey(g.start) ? g.start : null, left = days(today(), g.due), p = pct(g);
    if (left < 0) return { late: true, t: 'Date passed ' + fmtD(g.due), c: RED };
    var weeks = Math.max(1 / 7, left / 7), out = { left: left };
    var rest = g.src === 'steps' ? (g.steps || []).length - (+g.value || 0) : lower(g) ? (+g.value || 0) - (+g.target || 0) : (+g.target || 0) - (+g.value || 0);
    if (rest > 0) out.per = (g.src === 'steps' ? Math.ceil(rest / weeks) + (Math.ceil(rest / weeks) === 1 ? ' step' : ' steps') : show(g, rest / weeks)) + ' a week';
    if (st && days(st, g.due) > 0) {
      var frac = Math.max(0, Math.min(1, days(st, today()) / days(st, g.due)));
      out.frac = frac;
      out.behind = p < frac - 0.05;
      out.t = out.behind ? 'Behind' : p > frac + 0.1 ? 'Ahead' : 'On pace';
      out.c = out.behind ? AMBER : GREEN;
    }
    return out;
  }
  function refresh(l, quiet) {
    var ch = false, reached = [], c = cfg(), seen = readJSON('dash.goalseen', {}) || {}, sch = false;
    l.forEach(function (g) {
      if (g.src) { var v = srcValue(g); if (v != null && v !== g.value) { g.value = v; ch = true; } }
      if (g.src === 'steps') { var n = (g.steps || []).length; if (g.target !== n) { g.target = n; ch = true; } }
      var p = pct(g), weekly = g.habit || g.ah || /^(trainW|stepsW|sleep7)$/.test(g.src || '');      /* habit, Apple Health and this-week goals start over */
      if (weekly) { if (g.done || g.arch) { delete g.done; delete g.arch; ch = true; } }
      else if (p >= 1 && !g.done) { g.done = today(); ch = true; reached.push(g); }
      else if (p < 1 && g.done && !g.arch) { delete g.done; ch = true; }
      if (!weekly && g.done && !g.arch && +c.archive > 0 && days(g.done, today()) >= +c.archive) { g.arch = 1; ch = true; }
      var s = seen[g.id]; if (!s || s.v !== g.value) { seen[g.id] = { v: g.value, at: today() }; sch = true; }
    });
    if (sch) try { localStorage.setItem('dash.goalseen', JSON.stringify(seen)); } catch (e) {}
    if (ch) saveGoals(l);
    if (reached.length && !quiet && c.celebrate) {
      toast('<i class="bi bi-trophy"></i> Goal reached: ' + esc(reached[0].name));
      if (window.Delight && window.Delight.confetti) try { window.Delight.confetti(); } catch (e) {}
    }
    return l;
  }
  function sinceMoved(g) { var s = (readJSON('dash.goalseen', {}) || {})[g.id]; return s && isKey(s.at) ? days(s.at, today()) : 0; }
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!on() || !cfg().brief) return;
    var c = cfg(), l = goals().filter(function (g) { return !g.arch; });
    l.filter(function (g) { return !g.done; }).forEach(function (g) {
      var p = pace(g); if (!p || !isKey(g.due)) return;
      if (p.late) add(52, 'bullseye', RED, g.name + ': the date has passed', Math.round(pct(g) * 100) + ' % done – move the date or finish it', '/cmd/goals/');
      else if (p.behind && p.left <= +c.lead) add(58, 'bullseye', AMBER, g.name + ' is behind', (p.per ? p.per + ' to reach it' : Math.round(pct(g) * 100) + ' % done') + ' by ' + fmtD(g.due), '/cmd/goals/');
    });
    if (+c.stale > 0) {
      var st = l.filter(function (g) { return !g.done && !g.src && !g.habit && !g.ah && sinceMoved(g) >= +c.stale && sinceMoved(g) % 7 === 0; })[0];
      if (st) add(72, 'pencil', GREY, 'Update ' + st.name + '?', 'It’s said ' + n2(st.value) + ' for ' + sinceMoved(st) + ' days', '/cmd/goals/');
    }
    var won = l.filter(function (g) { return g.done === today(); })[0];
    if (won) add(40, 'trophy', GREEN, 'Goal reached: ' + won.name, I18N.k('ui.well-done', 'Well done'), '/cmd/goals/');
  });
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    if (!on()) return;
    goals().forEach(function (g) { add('Goals', 'bullseye', g.name, Math.round(pct(g) * 100) + ' %' + (isKey(g.due) ? ' · by ' + fmtD(g.due) : ''), '/cmd/goals/'); });
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() ? [{ i: 'bullseye', t: 'New goal', s: 'Goals', run: function () { if (__ui().root) __ui().sheet(null); else location.href = '/cmd/goals/?add'; }, x: 'goal mål target sparemål' }] : [];
  });
  (function () {
    function sel(f, label, opts, sub) { var v = String(cfg()[f]); return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><select class="st-select" data-glcfg="' + f + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
    function sw(f, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-glcfg="' + f + '"' + (cfg()[f] ? ' checked' : '') + '></label>'; }
    function sub(icon, t) { return '<p class="st-sub ap-sub"><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</p>'; }
    function fill() {
      var box = document.getElementById('hlSet-goals'); if (!box || box.contains(document.activeElement)) return;
      box.innerHTML = '<p class="st-intro" data-t="ui.the-same-goals-as-the-goals-card-on-home">The same goals as the Goals card on Home – here with dates, steps and numbers that update themselves.</p>' +
        sub('bell', 'Reminders') + '<div class="st-group">' + sw('brief', I18N.k('ui.goals-in-at-a-glance', 'Goals in At a glance'), I18N.k('ui.when-a-dated-goal-is-behind-or-the-date', 'When a dated goal is behind, or the date has passed')) +
        sel('lead', I18N.k('ui.warn-about-a-goal-thats-behind', 'Warn about a goal that’s behind'), [[7, I18N.k('ui.in-its-last-week', 'In its last week')], [14, I18N.k('ui.in-its-last-2-weeks', 'In its last 2 weeks')], [30, I18N.k('ui.in-its-last-month', 'In its last month')], [90, I18N.k('ui.in-its-last-3-months', 'In its last 3 months')], [3650, I18N.k('ui.any-time', 'Any time')]]) +
        sel('stale', I18N.k('ui.ask-to-update-a-number-you-type-in', 'Ask to update a number you type in'), [[0, I18N.k('ui.never', 'Never')], [7, I18N.k('ui.after-a-week-without-a-change', 'After a week without a change')], [14, I18N.k('ui.after-2-weeks', 'After 2 weeks')], [30, I18N.k('ui.after-a-month', 'After a month')]]) + '</div>' +
        sub('trophy', I18N.k('ui.when-you-reach-one', 'When you reach one')) + '<div class="st-group">' + sw('celebrate', 'Celebrate', I18N.k('ui.a-note-and-a-bit-of-confetti', 'A note and a bit of confetti')) +
        sel('archive', I18N.k('ui.move-it-to-done', 'Move it to Done'), [[0, I18N.k('ui.when-i-say-so', 'When I say so')], [1, I18N.k('ui.the-day-after', 'The day after')], [7, I18N.k('ui.after-a-week', 'After a week')], [30, I18N.k('ui.after-a-month', 'After a month')]], I18N.k('ui.done-goals-leave-the-card-on-home-too', 'Done goals leave the card on Home too')) + '</div>' +
        sub('sort-down', 'Order') + '<div class="st-group">' + sel('sort', 'Goals', [['due', I18N.k('ui.by-date', 'By date')], ['pct', I18N.k('ui.closest-to-done-first', 'Closest to done first')], ['cat', I18N.k('ui.by-kind', 'By kind')]]) + '</div>' +
        '<div class="st-group"><a class="st-row st-btn" href="/cmd/goals/"><span><i class="bi bi-bullseye"></i> <span data-t="ui.open-goals">Open Goals</span></span><i class="bi bi-chevron-right"></i></a></div>';
    }
    function summary() { var c = cfg(), r = document.getElementById('sum-goals'); if (r) r.textContent = (c.brief ? 'Reminders on' : 'No reminders') + ' · to Done ' + (+c.archive ? 'after ' + c.archive + (+c.archive === 1 ? ' day' : ' days') : 'by hand'); var row = document.getElementById('stRow-goals'); if (row) row.hidden = !on(); }
    document.addEventListener('change', function (e) {
      var i = e.target.closest('[data-glcfg]'); if (!i) return;
      var v = i.type === 'checkbox' ? i.checked : /^\d+$/.test(i.value) ? +i.value : i.value;
      var p = {}; p[i.dataset.glcfg] = v; setCfg(p); summary(); toast('<i class="bi bi-check2"></i> Saved');
    });
    window.addEventListener('st:page', function (e) { if (e.detail === 'goals') fill(); if (e.detail === 'home' || e.detail === 'layout') summary(); });
    ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, summary); });
    window.Vault.onUnlock(summary);
  })();
  window.GoalSrc = { list: sources, value: srcValue, pct: pct, lower: lower, show: show, pace: pace, sync: function (l) { return refresh(l, !PAGE); } };
  /* Home's Goals card (script.js) draws again once GoalSrc is here – on every page, as before the split */
  setTimeout(function () { window.dispatchEvent(new Event('goals:refresh')); }, 0);
  (window.__core = window.__core || {})["goals"] = { toast: toast, setCfg: setCfg, Fe: Fe, on: on, esc: esc, cfg: cfg, DEF: DEF, fmtD: fmtD, fromKey: fromKey, isKey: isKey, pct: pct, lower: lower, src: src, sources: sources, readJSON: readJSON, year: year, days: days, dkey: dkey, today: today, fin: fin, goals: goals, GREEN: GREEN, n2: n2, GREY: GREY, sinceMoved: sinceMoved, AMBER: AMBER, RED: RED, pace: pace, show: show, kr: kr, nf: nf, unit: unit, PAGE: PAGE, refresh: refresh, saveGoals: saveGoals, writeJSON: writeJSON, srcValue: srcValue };
})();
