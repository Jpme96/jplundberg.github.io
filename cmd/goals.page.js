/* Goals (/cmd/goals/): the same goals as the Goals card on Home (dash.goals), with more room – a kind,
   a date to reach it by, steps to tick off, and goals that keep their own number up to date from the
   rest of the dashboard: an account balance, your savings, a loan paid off, debt left, house projects
   done, trips taken, wishes bought.
   Updates itself: the number follows its source; the page shows if you're on pace for the date and what
   it takes per week; a goal you reach is marked done (and can go to "Done" after a while by itself);
   At a glance reminds you when a dated goal is behind, or a number you type yourself hasn't moved in a while.
   A goal: { id, name, value, target, habit?, ah?, cat, due, start, from, src, steps:[{t,d}], done, arch }
   Settings: dash.tools.goalcfg (Settings → Pages → Goals). */
/* The page part of goals.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is goals.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["goals"]; if (!__c) return;
  var GREEN = __c.GREEN, RED = __c.RED, AMBER = __c.AMBER, PAGE = __c.PAGE, esc = __c.esc, pct = __c.pct, lower = __c.lower, show = __c.show, src = __c.src, pace = __c.pace, fmtD = __c.fmtD, isKey = __c.isKey, GREY = __c.GREY, cfg = __c.cfg, on = __c.on, refresh = __c.refresh, goals = __c.goals, days = __c.days, today = __c.today, year = __c.year, sources = __c.sources, fin = __c.fin, kr = __c.kr, n2 = __c.n2, saveGoals = __c.saveGoals, toast = __c.toast, srcValue = __c.srcValue;
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, ''); if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var x = parseFloat(s.replace(',', '.')); return isFinite(x) ? x : null; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var BLUE = '#3987e5';
  var PURPLE = '#8a6fdf';
  var CATS = [['money', 'Money', 'piggy-bank', GREEN], ['health', 'Health', 'heart-pulse', RED], ['home', 'Home', 'house-heart', AMBER], ['work', 'Work', 'briefcase', BLUE], ['learn', 'Learning', 'mortarboard', '#0891b2'], ['me', 'Personal', 'person', PURPLE]];
  function catOf(k) { return CATS.filter(function (c) { return c[0] === k; })[0] || null; }
  var root = PAGE ? document.getElementById('glRoot') : null;
  var openId = null;
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
        '<div class="hl-acts">' + (!auto ? '<span class="stepper"><button type="button" data-glstepv="-1" aria-label="Less" data-t-aria-label="ui.less">−</button><button type="button" data-glstepv="1" aria-label="More" data-t-aria-label="ui.more">+</button></span>' : '') +
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
      : '<p class="empty kit-empty" data-t="ui.something-you-want-to-reach-save-50-000">Something you want to reach – save 50 000 kr, pay off the car loan, run 10 km, finish three house projects. Link it to your accounts or loans and it keeps itself up to date.</p>';
    var h = '<section class="fp-tiles hl-tiles" aria-label="Key numbers" data-t-aria-label="ui.key-numbers">' + tiles + '</section>' +
      '<div class="kit-grid gl-grid">' +
      '<div class="kit-wide"><section class="card kit-card" id="glActive"><div class="card-head"><h2><i class="bi bi-bullseye"></i> Goals</h2><div class="head-actions"><a class="text-btn" href="/cmd/?settings=goals" aria-label="Settings" data-t-aria-label="ui.settings"><i class="bi bi-sliders"></i> Settings</a><button type="button" class="text-btn" data-gladd><i class="bi bi-plus-lg"></i> Add</button></div></div>' + list + '</section></div>' +
      (arch.length ? '<div class="kit-wide"><section class="card kit-card" id="glDone"><div class="card-head"><h2><i class="bi bi-trophy"></i> Done</h2></div><ul class="gl-list">' + arch.slice().sort(function (a, b) { return String(b.done || '').localeCompare(String(a.done || '')); }).map(item).join('') + '</ul></section></div>' : '') +
      '</div>';
    if (root.innerHTML !== h) root.innerHTML = h;
  }
  function sheet(g) {
    var isNew = !g, srcs = sources(), d = fin();
    g = g ? JSON.parse(JSON.stringify(g)) : { cat: 'money', src: '' };
    var mode = g.habit ? 'habit' : g.ah ? 'ah' : g.src || '';
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    var grp = {}; srcs.forEach(function (s) { (grp[s.grp] = grp[s.grp] || []).push(s); });
    bg.innerHTML = '<form class="fo-box lf-box hl-box gl-box" role="dialog" aria-modal="true" aria-label="Goal" data-t-aria-label="ui.goal" autocomplete="off"><div class="lf-head"><h3><i class="bi bi-bullseye"></i> ' + (isNew ? 'New goal' : 'Edit goal') + '</h3><button type="button" class="icon-btn sm" data-x aria-label="Close" data-t-aria-label="ui.close"><i class="bi bi-x-lg"></i></button></div>' +
      '<label class="gl-f"><span data-t="ui.goal">Goal</span><input name="name" required maxlength="120" value="' + esc(g.name || '') + '" placeholder="e.g. Save for the sofa, pay off the car loan"></label>' +
      '<div class="mp-grid"><label><span data-t="ui.kind">Kind</span><select name="cat"><option value="" data-t="ui.none-2">None</option>' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (g.cat === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></label>' +
      '<label><span data-t="ui.reach-it-by">Reach it by</span><input type="date" name="due" value="' + esc(g.due || '') + '"></label></div>' +
      (mode === 'habit' || mode === 'ah' ? '<p class="muted hl-small"><i class="bi bi-link-45deg"></i> ' + (mode === 'habit' ? 'Follows a habit' : 'Follows Apple Health') + ' – change that on the Goals card on Home.</p>' :
        '<label class="gl-f"><span data-t="ui.its-number">Its number</span><select name="src"><option value="" data-t="ui.i-type-it-in-myself">I type it in myself</option><option value="steps"' + (mode === 'steps' ? ' selected' : '') + '>The steps below (ticked off)</option>' +
        Object.keys(grp).map(function (k) { return '<optgroup label="' + esc(k) + ' – updates by itself">' + grp[k].map(function (s) { return '<option value="' + esc(s.id) + '"' + (mode === s.id ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></label>' +
        '<div class="mp-grid" data-glnums><label><span data-t="ui.goal">Goal</span><input name="target" inputmode="decimal" value="' + (g.target != null && mode !== 'steps' ? esc(String(g.target)) : '') + '"></label><label data-glnow><span data-t="ui.now">Now</span><input name="value" inputmode="decimal" value="' + (g.value != null ? esc(String(g.value)) : '') + '"></label></div>' +
        '<p class="muted hl-small" data-glsrcnow></p>') +
      '<label class="gl-f"><span>Steps <small class="muted" data-t="ui.one-per-line-optional">one per line – optional</small></span><textarea name="steps" rows="3" maxlength="2000" placeholder="Get three quotes&#10;Pick one&#10;Book it">' + esc((g.steps || []).map(function (s) { return s.t; }).join('\n')) + '</textarea></label>' +
      '<label class="gl-f"><span data-t="ui.notes">Notes</span><textarea name="notes" rows="2" maxlength="1000">' + esc(g.notes || '') + '</textarea></label>' +
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
  (window.__ui = window.__ui || {})["goals"] = { root: root, sheet: sheet };
})();
