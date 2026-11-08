/* Goals (/cmd/goals/): the same goals as the Goals card on Home (dash.goals), with more room – a kind,
   a date to reach it by, steps to tick off, and goals that keep their own number up to date from the
   rest of the dashboard: an account balance, your savings, a loan paid off, debt left, house projects
   done, trips taken, wishes bought.
   Updates itself: the number follows its source; the page shows if you're on pace for the date and what
   it takes per week; a goal you reach is marked done (and can go to "Done" after a while by itself);
   At a glance reminds you when a dated goal is behind, or a number you type yourself hasn't moved in a while.
   A goal: { id, name, value, target, habit?, ah?, cat, due, start, from, src, steps:[{t,d}], done, arch }
   Settings: dash.tools.goalcfg (Settings → Pages → Goals). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  var PAGE = /\/cmd\/goals\/$/.test(location.pathname);
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, ''); if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var x = parseFloat(s.replace(',', '.')); return isFinite(x) ? x : null; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var dkey = Fe.dkey, fromKey = Fe.fromKey;
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
  var GREEN = '#22b35e', AMBER = '#c98500', RED = '#e66767', BLUE = '#3987e5', PURPLE = '#8a6fdf', GREY = '#7a8794';

  var DEF = { brief: true, lead: 30, stale: 14, archive: 30, celebrate: true, sort: 'due' };
  function cfg() { var c = Fe.tools().goalcfg; return Object.assign({}, DEF, c && typeof c === 'object' ? c : {}); }
  function setCfg(p) { var t = Fe.tools(); t.goalcfg = Object.assign({}, t.goalcfg || {}, p); Fe.saveTools(t); }

  var CATS = [['money', 'Money', 'piggy-bank', GREEN], ['health', 'Health', 'heart-pulse', RED], ['home', 'Home', 'house-heart', AMBER], ['work', 'Work', 'briefcase', BLUE], ['learn', 'Learning', 'mortarboard', '#0891b2'], ['me', 'Personal', 'person', PURPLE]];
  function catOf(k) { return CATS.filter(function (c) { return c[0] === k; })[0] || null; }

  /* ---------- where a goal can take its number from ---------- */
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
  /* how far it is: 0–1 */
  function pct(g) {
    var v = +g.value || 0, t = +g.target || 0;
    if (g.src === 'steps') { var n = (g.steps || []).length; return n ? v / n : 0; }
    if (lower(g)) { var f = g.from != null ? +g.from : null; if (f == null || f <= t) return v <= t ? 1 : 0; return Math.max(0, Math.min(1, (f - v) / (f - t))); }
    if (!(t > 0)) return 0;
    var f0 = g.from != null && +g.from < t && g.src ? +g.from : 0;
    return Math.max(0, Math.min(1, (v - f0) / (t - f0)));
  }
  /* are you on pace for the date? */
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
  /* bring the self-updating numbers up to date, and mark goals done (or not any more) */
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

  window.GoalSrc = {
    list: sources, value: srcValue, pct: pct, lower: lower, show: show, pace: pace,
    /* Home's Goals card calls this before it draws */
    sync: function (l) { return refresh(l, !PAGE); }
  };

  /* ---------- the page ---------- */
  var root = PAGE ? document.getElementById('glRoot') : null, openId = null;
  function ring(p, c) {
    var R = 2 * Math.PI * 24;
    return '<svg class="ring gl-ring" viewBox="0 0 56 56" aria-hidden="true" style="--c:' + c + '"><circle class="track" cx="28" cy="28" r="24"></circle><circle class="val" cx="28" cy="28" r="24" stroke-dasharray="' + R + '" stroke-dashoffset="' + (R * (1 - p)) + '"></circle></svg>';
  }
  function chip(t, c) { return '<span class="hl-chip" style="--c:' + c + '">' + esc(t) + '</span>'; }
  function line(g) {
    var p = pct(g);
    if (g.src === 'steps') return (+g.value || 0) + ' of ' + (g.steps || []).length + ' steps';
    if (lower(g)) return show(g, g.value) + ' · goal ' + show(g, g.target) + (g.from != null ? ' · from ' + show(g, g.from) : '');
    return show(g, g.value) + ' / ' + show(g, g.target) + ' · ' + Math.round(p * 100) + ' %';
  }
  function how(g) {
    if (g.habit) return '<i class="bi bi-link-45deg"></i> Follows a habit (this week)';
    if (g.ah) return '<i class="bi bi-apple"></i> Apple Health';
    if (g.src === 'steps') return '<i class="bi bi-list-check"></i> Steps';
    var s = g.src && src(g.src); return s ? '<i class="bi bi-arrow-repeat"></i> ' + esc(s.label) : '';
  }
  function item(g) {
    var c = catOf(g.cat), col = c ? c[3] : 'var(--accent)', p = pct(g), pc = pace(g), auto = g.src || g.habit || g.ah;
    var right = g.done ? chip('Done ' + fmtD(g.done), GREEN) : pc && pc.late ? chip(pc.t, pc.c) : pc && pc.t ? chip(pc.t, pc.c) : isKey(g.due) ? chip('By ' + fmtD(g.due), GREY) : '';
    var st = g.steps || [], open = openId === g.id;
    return '<li class="gl-item' + (g.done ? ' done' : '') + (open ? ' open' : '') + '" data-gid="' + esc(g.id) + '">' +
      '<button type="button" class="gl-main" data-gltoggle="' + esc(g.id) + '">' + ring(p, col) +
      '<span class="gl-x"><b>' + esc(g.name) + '</b><small>' + esc(line(g)) + (how(g) ? ' · ' + how(g) : '') + '</small>' +
      (pc && pc.per && !g.done ? '<small class="gl-per">' + esc(pc.per) + (isKey(g.due) ? ' until ' + esc(fmtD(g.due)) : '') + '</small>' : '') + '</span>' +
      '<span class="gl-r">' + right + '</span></button>' +
      (open ? '<div class="gl-detail">' +
        (pc && pc.frac != null ? '<div class="gl-bar" role="img" aria-label="' + Math.round(p * 100) + ' % done, ' + Math.round(pc.frac * 100) + ' % of the time gone"><i style="width:' + (p * 100).toFixed(1) + '%;background:' + col + '"></i><em style="left:' + (pc.frac * 100).toFixed(1) + '%"></em></div><p class="muted hl-small">' + Math.round(p * 100) + ' % done · ' + Math.round(pc.frac * 100) + ' % of the time gone · ' + pc.left + ' days left</p>' : '') +
        (st.length ? '<ul class="gl-steps">' + st.map(function (s, i) { return '<li><button type="button" class="check" data-glstep="' + i + '" aria-pressed="' + !!s.d + '" aria-label="' + esc(s.t) + '"><i class="bi bi-check-lg"></i></button><span' + (s.d ? ' class="gl-sdone"' : '') + '>' + esc(s.t) + '</span></li>'; }).join('') + '</ul>' : '') +
        (g.notes ? '<p class="kit-notes">' + esc(g.notes) + '</p>' : '') +
        '<div class="hl-acts">' + (!auto ? '<span class="stepper"><button type="button" data-glstepv="-1" aria-label="Less">−</button><button type="button" data-glstepv="1" aria-label="More">+</button></span>' : '') +
        '<button type="button" class="text-btn" data-gledit><i class="bi bi-pencil"></i> Edit</button>' +
        (g.done && !g.arch ? '<button type="button" class="text-btn" data-glarch><i class="bi bi-archive"></i> Move to Done</button>' : '') +
        (g.arch ? '<button type="button" class="text-btn" data-glunarch><i class="bi bi-arrow-counterclockwise"></i> Back to active</button>' : '') + '</div></div>' : '') + '</li>';
  }
  function sorted(l) {
    var s = cfg().sort;
    return l.slice().sort(function (a, b) {
      if (s === 'pct') return pct(b) - pct(a);
      if (s === 'cat') return String(a.cat || 'zz').localeCompare(String(b.cat || 'zz'));
      return String(a.due || '9999').localeCompare(String(b.due || '9999'));
    });
  }
  function tile(icon, label, val, sub, c) { return '<div class="fp-tile hl-tile" style="--c:' + c + '"><div class="lbl"><i class="bi bi-' + icon + '"></i>' + label + '</div><div class="val">' + val + '</div><div class="sub">' + (sub || '&nbsp;') + '</div></div>'; }
  function render() {
    if (!root) return;
    var e = document.querySelector('[data-pgempty="goals"]'); if (e) e.hidden = on();
    if (!on()) { root.hidden = true; return; }
    root.hidden = false;
    if (root.contains(document.activeElement) && document.activeElement.matches('input, textarea, select')) return;
    var l = refresh(goals(), false), act = l.filter(function (g) { return !g.arch; }), arch = l.filter(function (g) { return g.arch; });
    var live = act.filter(function (g) { return !g.done; }), behind = live.filter(function (g) { var p = pace(g); return p && (p.behind || p.late); });
    var soon = live.filter(function (g) { return isKey(g.due) && days(today(), g.due) >= 0 && days(today(), g.due) <= 30; });
    var doneY = l.filter(function (g) { return String(g.done || '').slice(0, 4) === year(); });
    var tiles = tile('bullseye', 'Active', live.length, live.length ? Math.round(live.reduce(function (a, g) { return a + pct(g); }, 0) / live.length * 100) + ' % on average' : 'add your first', BLUE) +
      tile('speedometer2', 'Behind', behind.length, behind.length ? esc(behind[0].name) : 'all on pace', behind.length ? AMBER : GREEN) +
      tile('calendar-event', 'Due in 30 days', soon.length, soon.length ? esc(soon[0].name) : 'nothing soon', PURPLE) +
      tile('trophy', 'Reached in ' + year(), doneY.length, doneY.length ? esc(doneY[0].name) : '&nbsp;', GREEN);
    var groups = {}, order = [];
    sorted(act).forEach(function (g) { var k = cfg().sort === 'cat' ? (g.cat || '') : ''; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(g); });
    var list = act.length ? order.map(function (k) { var c = catOf(k); return (k && c ? '<p class="gl-grp"><i class="bi bi-' + c[2] + '" style="color:' + c[3] + '"></i> ' + esc(c[1]) + '</p>' : '') + '<ul class="gl-list">' + groups[k].map(item).join('') + '</ul>'; }).join('')
      : '<p class="empty kit-empty">Something you want to reach – save 50 000 kr, pay off the car loan, run 10 km, finish three house projects. Link it to your accounts or loans and it keeps itself up to date.</p>';
    var h = '<section class="fp-tiles hl-tiles" aria-label="Key numbers">' + tiles + '</section>' +
      '<div class="kit-grid gl-grid">' +
      '<div class="kit-wide"><section class="card kit-card" id="glActive"><div class="card-head"><h2><i class="bi bi-bullseye"></i> Goals</h2><div class="head-actions"><a class="text-btn" href="/cmd/?settings=goals" aria-label="Settings"><i class="bi bi-sliders"></i> Settings</a><button type="button" class="text-btn" data-gladd><i class="bi bi-plus-lg"></i> Add</button></div></div>' + list + '</section></div>' +
      (arch.length ? '<div class="kit-wide"><section class="card kit-card" id="glDone"><div class="card-head"><h2><i class="bi bi-trophy"></i> Done</h2></div><ul class="gl-list">' + arch.slice().sort(function (a, b) { return String(b.done || '').localeCompare(String(a.done || '')); }).map(item).join('') + '</ul></section></div>' : '') +
      '</div>';
    if (root.innerHTML !== h) root.innerHTML = h;
  }

  /* ---------- the add / edit sheet ---------- */
  function sheet(g) {
    var isNew = !g, srcs = sources(), d = fin();
    g = g ? JSON.parse(JSON.stringify(g)) : { cat: 'money', src: '' };
    var mode = g.habit ? 'habit' : g.ah ? 'ah' : g.src || '';
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    var grp = {}; srcs.forEach(function (s) { (grp[s.grp] = grp[s.grp] || []).push(s); });
    bg.innerHTML = '<form class="fo-box lf-box hl-box gl-box" role="dialog" aria-modal="true" aria-label="Goal" autocomplete="off"><div class="lf-head"><h3><i class="bi bi-bullseye"></i> ' + (isNew ? 'New goal' : 'Edit goal') + '</h3><button type="button" class="icon-btn sm" data-x aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' +
      '<label class="gl-f"><span>Goal</span><input name="name" required maxlength="120" value="' + esc(g.name || '') + '" placeholder="e.g. Save for the sofa, pay off the car loan"></label>' +
      '<div class="mp-grid"><label><span>Kind</span><select name="cat"><option value="">None</option>' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (g.cat === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></label>' +
      '<label><span>Reach it by</span><input type="date" name="due" value="' + esc(g.due || '') + '"></label></div>' +
      (mode === 'habit' || mode === 'ah' ? '<p class="muted hl-small"><i class="bi bi-link-45deg"></i> ' + (mode === 'habit' ? 'Follows a habit' : 'Follows Apple Health') + ' – change that on the Goals card on Home.</p>' :
        '<label class="gl-f"><span>Its number</span><select name="src"><option value="">I type it in myself</option><option value="steps"' + (mode === 'steps' ? ' selected' : '') + '>The steps below (ticked off)</option>' +
        Object.keys(grp).map(function (k) { return '<optgroup label="' + esc(k) + ' – updates by itself">' + grp[k].map(function (s) { return '<option value="' + esc(s.id) + '"' + (mode === s.id ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></label>' +
        '<div class="mp-grid" data-glnums><label><span>Goal</span><input name="target" inputmode="decimal" value="' + (g.target != null && mode !== 'steps' ? esc(String(g.target)) : '') + '"></label><label data-glnow><span>Now</span><input name="value" inputmode="decimal" value="' + (g.value != null ? esc(String(g.value)) : '') + '"></label></div>' +
        '<p class="muted hl-small" data-glsrcnow></p>') +
      '<label class="gl-f"><span>Steps <small class="muted">one per line – optional</small></span><textarea name="steps" rows="3" maxlength="2000" placeholder="Get three quotes&#10;Pick one&#10;Book it">' + esc((g.steps || []).map(function (s) { return s.t; }).join('\n')) + '</textarea></label>' +
      '<label class="gl-f"><span>Notes</span><textarea name="notes" rows="2" maxlength="1000">' + esc(g.notes || '') + '</textarea></label>' +
      '<div class="lf-foot">' + (isNew ? '' : '<button type="button" class="text-btn danger" data-gldel><i class="bi bi-trash3"></i> Delete</button>') + '<span class="spacer"></span><button type="submit" class="pill-btn wide"><i class="bi bi-check2"></i> Save</button></div></form>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var f = bg.querySelector('form'), close = function () { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 180); };
    function upd() {
      if (!f.src) return;
      var v = f.src.value, s = v && v !== 'steps' ? src(v) : null, nums = bg.querySelector('[data-glnums]'), now = bg.querySelector('[data-glnow]'), note = bg.querySelector('[data-glsrcnow]');
      nums.hidden = v === 'steps'; now.hidden = !!v;
      if (s) {
        var x = null; try { x = s.get(d); } catch (e) {}
        note.textContent = x != null ? 'Now: ' + (s.unit === 'kr' ? kr(x) : n2(x)) + (s.lower ? ' – it’s reached when it’s down to the goal' : '') : 'No number yet';
        if (!f.target.value && s.def != null) { var dv = typeof s.def === 'function' ? s.def(d) : s.def; if (dv != null) f.target.value = dv; }
      } else note.textContent = v === 'steps' ? 'Done when every step is ticked off.' : '';
    }
    if (f.src) { f.src.addEventListener('change', upd); upd(); }
    bg.addEventListener('click', function (e) {
      if (e.target === bg || e.target.closest('[data-x]')) return close();
      var del = e.target.closest('[data-gldel]'); if (!del) return;
      if (!del.dataset.armed) { del.dataset.armed = 1; del.innerHTML = '<i class="bi bi-trash3"></i> Tap again to delete'; return; }
      var all = goals(), at = all.findIndex(function (x) { return x.id === g.id; }), gone = all[at];
      saveGoals(all.filter(function (x) { return x.id !== g.id; })); close(); render();
      toast('<i class="bi bi-trash3"></i> Goal deleted', function () { var l2 = goals(); l2.splice(Math.min(at, l2.length), 0, gone); saveGoals(l2); render(); });
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = f.name.value.trim(); if (!name) return f.name.focus();
      var v = f.src ? f.src.value : null, old = {}; (g.steps || []).forEach(function (s) { old[s.t] = s.d; });
      g.name = name; g.cat = f.cat.value || undefined; g.due = isKey(f.due.value) ? f.due.value : undefined;
      g.steps = f.steps.value.split('\n').map(function (t) { return t.trim(); }).filter(Boolean).map(function (t) { return { t: t, d: old[t] ? 1 : 0 }; });
      if (!g.steps.length) delete g.steps;
      g.notes = f.notes.value.trim() || undefined;
      if (f.src) {
        if (v === 'steps' && !g.steps) { f.steps.focus(); f.steps.classList.add('kit-bad'); return; }
        var tg = num(f.target.value);
        if (v !== 'steps' && !(tg != null && (tg > 0 || (src(v) && src(v).lower)))) { f.target.focus(); f.target.classList.add('kit-bad'); return; }
        var was = g.src;
        g.src = v || undefined;
        if (v === 'steps') { g.target = g.steps.length; g.value = g.steps.filter(function (s) { return s.d; }).length; }
        else { g.target = tg; if (!v) g.value = num(f.value.value) || 0; }
        if (v && v !== 'steps' && (isNew || was !== v)) { var x = srcValue(g); g.value = x != null ? x : 0; g.from = g.value; }
        if (!v) delete g.from;
      }
      if (isNew) { g.id = uid(); g.start = today(); }
      else if (!isKey(g.start)) g.start = today();
      var all = goals(), i = all.findIndex(function (x) { return x.id === g.id; });
      if (i > -1) all[i] = g; else all.push(g);
      saveGoals(all); close(); openId = g.id; render();
    });
    setTimeout(function () { if (!matchMedia('(pointer: coarse)').matches) f.name.focus(); }, 60);
  }

  if (root) {
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-gladd]')) return sheet(null);
      var li = e.target.closest('.gl-item'); if (!li) return;
      var all = goals(), g = all.filter(function (x) { return x.id === li.dataset.gid; })[0]; if (!g) return;
      var b;
      if ((b = e.target.closest('[data-gltoggle]'))) { openId = openId === g.id ? null : g.id; return render(); }
      if (e.target.closest('[data-gledit]')) return sheet(g);
      if ((b = e.target.closest('[data-glstep]'))) { var s = (g.steps || [])[+b.dataset.glstep]; if (s) { s.d = s.d ? 0 : 1; saveGoals(all); render(); } return; }
      if ((b = e.target.closest('[data-glstepv]'))) { var stp = g.target >= 1000 ? 100 : g.target >= 100 ? 5 : 1; g.value = Math.max(0, Math.round(((+g.value || 0) + stp * +b.dataset.glstepv) * 100) / 100); saveGoals(all); render(); return; }
      if (e.target.closest('[data-glarch]')) { g.arch = 1; g.done = g.done || today(); saveGoals(all); openId = null; render(); toast('<i class="bi bi-trophy"></i> Moved to Done'); return; }
      if (e.target.closest('[data-glunarch]')) { delete g.arch; delete g.done; saveGoals(all); render(); }
    });
    ['tools:change', 'features:change', 'fin:change', 'dash:local', 'habits:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(render.t); render.t = setTimeout(render, 40); }); });
    window.Vault.onUnlock(function () { setTimeout(render, 30); });
    if (/[?&]add\b/.test(location.search)) window.Vault.onUnlock(function () { setTimeout(function () { sheet(null); history.replaceState(null, '', location.pathname); }, 200); });
    render();
  }

  /* ---------- At a glance ---------- */
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
    if (won) add(40, 'trophy', GREEN, 'Goal reached: ' + won.name, 'Well done', '/cmd/goals/');
  });
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    if (!on()) return;
    goals().forEach(function (g) { add('Goals', 'bullseye', g.name, Math.round(pct(g) * 100) + ' %' + (isKey(g.due) ? ' · by ' + fmtD(g.due) : ''), '/cmd/goals/'); });
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() ? [{ i: 'bullseye', t: 'New goal', s: 'Goals', run: function () { if (root) sheet(null); else location.href = '/cmd/goals/?add'; }, x: 'goal mål target sparemål' }] : [];
  });

  /* ---------- Settings → Pages → Goals ---------- */
  (function () {
    function sel(f, label, opts, sub) { var v = String(cfg()[f]); return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><select class="st-select" data-glcfg="' + f + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
    function sw(f, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-glcfg="' + f + '"' + (cfg()[f] ? ' checked' : '') + '></label>'; }
    function sub(icon, t) { return '<p class="st-sub ap-sub"><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</p>'; }
    function fill() {
      var box = document.getElementById('hlSet-goals'); if (!box || box.contains(document.activeElement)) return;
      box.innerHTML = '<p class="st-intro">The same goals as the Goals card on Home – here with dates, steps and numbers that update themselves.</p>' +
        sub('bell', 'Reminders') + '<div class="st-group">' + sw('brief', 'Goals in At a glance', 'When a dated goal is behind, or the date has passed') +
        sel('lead', 'Warn about a goal that’s behind', [[7, 'In its last week'], [14, 'In its last 2 weeks'], [30, 'In its last month'], [90, 'In its last 3 months'], [3650, 'Any time']]) +
        sel('stale', 'Ask to update a number you type in', [[0, 'Never'], [7, 'After a week without a change'], [14, 'After 2 weeks'], [30, 'After a month']]) + '</div>' +
        sub('trophy', 'When you reach one') + '<div class="st-group">' + sw('celebrate', 'Celebrate', 'A note and a bit of confetti') +
        sel('archive', 'Move it to Done', [[0, 'When I say so'], [1, 'The day after'], [7, 'After a week'], [30, 'After a month']], 'Done goals leave the card on Home too') + '</div>' +
        sub('sort-down', 'Order') + '<div class="st-group">' + sel('sort', 'Goals', [['due', 'By date'], ['pct', 'Closest to done first'], ['cat', 'By kind']]) + '</div>' +
        '<div class="st-group"><a class="st-row st-btn" href="/cmd/goals/"><span><i class="bi bi-bullseye"></i> Open Goals</span><i class="bi bi-chevron-right"></i></a></div>';
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

  /* Home's card may have drawn before this file loaded */
  setTimeout(function () { window.dispatchEvent(new Event('goals:refresh')); }, 0);
})();
