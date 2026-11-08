/* Tabs on long pages (Health, House, Work) – the same bar as Finances (Now · Spending · Insights · Setup).
   Each card or slot is given a tab by a selector; cards drawn later (Kit, Apple Health) are picked up as they appear.
   The last tab is remembered per page (localStorage dash.ptab.<page>); a link to #<data-tool> or #<id> opens the
   tab that holds it; ?customize shows everything. At the end of a tab, features that belong there but are off
   can be switched on in one tap.
   Also two overview cards: Health → Today (#hsToday) and Work → Today (#wkToday). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, main = document.getElementById('fp');
  var page = (location.pathname.match(/\/cmd\/(habits|house|work)\//) || [])[1];
  if (!main || !page) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }

  var CONF = {
    habits: {
      tabs: [['today', 'Today', 'sun'], ['training', 'Training', 'heart-pulse'], ['body', 'Body', 'apple'], ['care', 'Care', 'clipboard2-pulse']],
      map: [['#hpTiles', 'today'], ['#hsToday', 'today'], ['.hr-wrap', 'today'], ['#hpHabits', 'today'], ['#hpEmpty', 'today'],
        ['[data-tool="training"]', 'training'], ['[data-tool="gym"]', 'training'], ['[data-tool="rest"]', 'training'],
        ['#ahCard', 'body'], ['[data-tool="health"]', 'care'], ['#meHealth', 'care'], ['[data-tool="journal"]', 'care']],
      feats: { today: ['habits', 'hreport'], training: ['training', 'gym', 'rest'], body: ['ahealth'], care: ['health', 'journal'] }
    },
    house: {
      /* a 4th value: the tab only shows while that feature (or one of a list) is on · Docs holds the FDV binder and Claims */
      /* a 5th value (true): only while you look at the home you live in now (not an earlier one – house-homes.js) */
      tabs: [['shared', 'Shared', 'people', null, true], ['upkeep', 'Upkeep', 'tools', null, true], ['energy', 'Energy', 'lightning-charge', null, true], ['things', 'Things', 'box-seam', null, true],
        ['projects', 'Projects', 'hammer', null], ['docs', 'Docs', 'journal-bookmark', ['hdocs', 'hclaim']], ['history', 'History', 'clock-history']],
      map: [['#hlTiles', 'upkeep'], ['[data-tool="htake"]', 'shared'], ['[data-tool="hshared"]', 'shared'], ['[data-tool="hproj"]', 'projects'], ['[data-tool="hdocs"]', 'docs'], ['[data-tool="hclaim"]', 'docs'], ['[data-tool="hhist"]', 'history'], ['[data-tool="hmaint"]', 'upkeep'], ['[data-tool="hfdvup"]', 'upkeep'], ['[data-tool="henergy"]', 'energy'], ['[data-tool="hpros"]', 'projects'], ['[data-tool="hseason"]', 'upkeep'], ['[data-tool="hbins"]', 'upkeep'],
        ['[data-tool="hmeter"]', 'energy'], ['[data-tool="hpower"]', 'energy'], ['[data-tool="power"]', 'energy'],
        ['[data-tool="hinv"]', 'things'], ['[data-tool="hinfo"]', 'things'], ['[data-tool="warranty"]', 'things']],
      feats: { shared: ['shared'], energy: ['power'], things: ['warranty', 'hdocs', 'hclaim', 'hproj'] }
    },
    work: {
      tabs: [['today', 'Today', 'briefcase'], ['notes', 'Notes', 'journal-text'], ['plan', 'Plan', 'calendar-range']],
      map: [['#hlTiles', 'today'], ['#wkToday', 'today'], ['[data-tool="flex"]', 'today'], ['[data-tool="wkday"]', 'today'], ['[data-tool="ptime"]', 'today'],
        ['[data-tool="meetings"]', 'notes'], ['[data-tool="fdv"]', 'notes'], ['[data-tool="holiday"]', 'plan'], ['[data-tool="learning"]', 'plan'], ['#wkEmpty', 'today']],
      feats: { today: ['flex', 'ptime', 'shutdown'], notes: ['meetings', 'fdv', 'prep'], plan: ['holiday', 'learning'] }
    }
  };
  var C = CONF[page], KEY = 'dash.ptab.' + page, all = /[?&]customize/.test(location.search);
  var cur = (function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } })();
  /* tabs that belong to a feature that's off aren't shown */
  function past() { var H = window.Homes; return !!(H && H.isPast(H.view())); }
  function fon(f) { return !f || (Array.isArray(f) ? f.some(function (x) { return Fe.on(x); }) : Fe.on(f)); }
  function tabs() { var p = past(); return C.tabs.filter(function (t) { return fon(t[3]) && !(t[4] && p); }); }
  /* tabs that were merged into another */
  var ALIAS = { claims: 'docs' };
  if (ALIAS[cur]) cur = ALIAS[cur];
  function has(t) { return tabs().some(function (x) { return x[0] === t; }); }
  if (!has(cur)) cur = (tabs()[0] || C.tabs[0])[0];

  /* the bar */
  var nav = document.createElement('nav');
  nav.className = 'fp-tabs pt-tabs'; nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', 'Views');
  function bar() {
    var l = tabs(), h = l.map(function (t) { return '<button type="button" role="tab" data-ptab-go="' + t[0] + '"><i class="bi bi-' + t[2] + '"></i><span>' + esc(t[1]) + '</span></button>'; }).join('');
    nav.style.setProperty('--n', l.length); nav.classList.toggle('pt-many', l.length > 5);
    if (nav._h !== h) { nav._h = h; nav.innerHTML = h; }
  }
  bar();
  var anchor = main.querySelector('.fp-tiles, .kit-grid, #hpHabits');
  main.insertBefore(nav, anchor || main.firstChild);
  var tail = document.createElement('div'); tail.className = 'pt-tail'; main.insertBefore(tail, main.querySelector('.foot') || null);

  function tabFor(el) {
    for (var i = 0; i < C.map.length; i++) { var m = C.map[i]; if (el.matches(m[0])) return m[1]; }
    return null;
  }
  var assigning = false;
  function assign() {
    if (assigning) return; assigning = true;
    C.map.forEach(function (m) { main.querySelectorAll(m[0]).forEach(function (el) { if (el.dataset.ptab !== m[1]) el.dataset.ptab = m[1]; var off = !all && m[1] !== cur; if (el.classList.contains('pt-hide') !== off) el.classList.toggle('pt-hide', off); }); });
    assigning = false;
  }
  function draw() {
    bar();
    if (!has(cur)) { cur = (tabs()[0] || C.tabs[0])[0]; }
    nav.querySelectorAll('[data-ptab-go]').forEach(function (b) { var on = b.dataset.ptabGo === cur; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    /* many tabs on a phone scroll sideways: keep the one you're on in view */
    if (nav.classList.contains('pt-many') && nav.scrollWidth > nav.clientWidth + 2) { var sel = nav.querySelector('[aria-selected="true"]'); if (sel) { var l = sel.offsetLeft - 8, r = sel.offsetLeft + sel.offsetWidth + 8; if (l < nav.scrollLeft) nav.scrollLeft = l; else if (r > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = r - nav.clientWidth; } }
    main.dataset.ptab = cur;
    assign(); suggest();
  }
  function show(t, keep) {
    if (ALIAS[t]) t = ALIAS[t];
    if (!has(t)) return;
    cur = t; try { localStorage.setItem(KEY, t); } catch (e) {}
    draw();
    if (!keep) { var top = nav.getBoundingClientRect().top + scrollY - 70; if (scrollY > top) scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); }
  }
  nav.addEventListener('click', function (e) { var b = e.target.closest('[data-ptab-go]'); if (b) show(b.dataset.ptabGo); });
  nav.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var ids = tabs().map(function (t) { return t[0]; }), i = (ids.indexOf(cur) + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
    show(ids[i], true); var b = nav.querySelector('[data-ptab-go="' + ids[i] + '"]'); if (b) b.focus();
  });
  /* features that belong on this tab but are off: one tap to switch on */
  function suggest() {
    var ids = (C.feats[cur] || []).filter(function (id) { return Fe.byId && Fe.byId(id) && !Fe.on(id) && !(Fe.simple && Fe.simple() && (Fe.ADV || []).indexOf(id) > -1); });
    var shown = [].some.call(main.querySelectorAll('[data-ptab="' + cur + '"]'), function (el) { return !el.hidden && el.offsetHeight > 30 && !el.matches('#hlTiles, #hpTiles'); });
    var html = (!shown && !all ? '<p class="pt-empty">Nothing here yet' + (ids.length ? ' – switch something on below.' : '.') + '</p>' : '') +
      (ids.length && !all ? '<div class="pt-sug"><p>' + (shown ? 'Also fits here' : 'Fits here') + '</p><div class="pt-chips">' + ids.map(function (id) {
        var f = Fe.byId(id); return '<button type="button" class="pt-chip" data-ptfeat="' + esc(id) + '"><i class="bi bi-' + esc(f.icon) + '" style="color:' + esc(f.c) + '"></i><span><b>' + esc(f.name) + '</b><small>' + esc(f.desc) + '</small></span><i class="bi bi-plus-lg"></i></button>';
      }).join('') + '</div></div>' : '');
    if (tail._h !== html) { tail._h = html; tail.innerHTML = html; }      /* only when it changed – a tap must not land on a redrawn chip */
  }
  tail.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ptfeat]'); if (!b) return;
    var f = Fe.byId(b.dataset.ptfeat); Fe.set(b.dataset.ptfeat, true);
    if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-check2"></i> ' + esc(f ? f.name : 'Feature') + ' is on', function () { Fe.set(b.dataset.ptfeat, false); });
    setTimeout(draw, 60);
  });
  /* links to a card: open its tab */
  function fromHash() {
    var h = location.hash.replace(/^#/, '').split('=')[0]; if (!/^[a-z][\w-]*$/i.test(h)) return;
    var el = main.querySelector('[data-tool="' + h + '"]') || document.getElementById(h);
    var t = el && (el.dataset.ptab || tabFor(el) || (el.closest('[data-ptab]') || {}).dataset && el.closest('[data-ptab]').dataset.ptab);
    if (t && t !== cur) show(t, true);
  }
  window.addEventListener('hashchange', fromHash);
  var tm = null;
  new MutationObserver(function () { if (assigning) return; clearTimeout(tm); tm = setTimeout(function () { assign(); suggest(); }, 40); }).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('features:change', function () { setTimeout(draw, 80); });
  window.addEventListener('homes:view', function () { setTimeout(draw, 30); });
  window.Vault.onUnlock(function () { setTimeout(function () { draw(); fromHash(); }, 60); });
  draw(); fromHash();
  window.PageTabs = { show: show, current: function () { return cur; } };

  /* ======================= Health → Today ======================= */
  if (page === 'habits') {
    var ht = document.createElement('section'); ht.className = 'card pt-today'; ht.id = 'hsToday'; ht.hidden = true;
    var tiles = document.getElementById('hpTiles'); main.insertBefore(ht, tiles ? tiles.nextSibling : main.firstChild);
    var drawH = function () {
      if (!window.Vault.get()) { ht.hidden = true; return; }
      var A = window.AHealth, td = dkey(new Date()), D = A && Fe.on('ahealth') ? A.days() : {}, day = D[td] || {}, rows = [];
      var g = (readJSON('dash.settings', {}) || {}).ahGoals || {}, stepGoal = +g.steps || 10000, sleepGoal = +g.sleep || 7, exGoal = +g.exercise || 30;
      var bar = function (v, goal) { return '<span class="pt-bar"><i style="width:' + Math.min(100, (v || 0) / goal * 100).toFixed(1) + '%"></i></span>'; };
      if (A && Fe.on('ahealth')) {
        var ln = A.lastNight();
        rows.push(['moon-stars', '#8a6fdf', 'Last night', ln ? A.fmt('sleep', ln.v) : '–', ln ? bar(ln.v, sleepGoal) : '<small>no sleep sent yet</small>', '#ahCard']);
        rows.push(['person-walking', '#22b35e', 'Steps today', day.steps != null ? A.fmt('steps', day.steps) : '–', day.steps != null ? bar(day.steps, stepGoal) : '<small>arrives with the evening Shortcut</small>', '#ahCard']);
        if (day.exercise != null) rows.push(['activity', '#e8743b', 'Exercise', A.fmt('exercise', day.exercise), bar(day.exercise, exGoal), '#ahCard']);
      }
      var hb = readJSON('dash.habits', null), hl = hb && Array.isArray(hb.list) ? hb.list : [];
      if (Fe.on('habits') && hl.length) {
        var doneT = ((hb.log || {})[td] || []).filter(function (id) { return hl.some(function (h) { return h.id === id; }); }).length;
        rows.push(['check2-circle', '#d55181', 'Habits today', doneT + ' of ' + hl.length, bar(doneT, hl.length), '#hpHabits']);
      }
      if (Fe.on('training')) {
        var m0 = dkey(monday(new Date())), wk = Fe.list('training').filter(function (w) { return w && w.date >= m0 && w.date <= td; }), today = wk.filter(function (w) { return w.date === td; });
        var mins = wk.reduce(function (a, w) { return a + (+w.min || 0); }, 0);
        rows.push(['heart-pulse', '#d55181', 'Training this week', wk.length + ' workout' + (wk.length === 1 ? '' : 's'), '<small>' + (mins ? mins + ' min' : 'none yet') + (today.length ? ' · today ✓' : '') + '</small>', '[data-tool="training"]']);
      }
      if (Fe.on('journal')) {
        var j = Fe.list('journal').filter(function (x) { return x && x.date === td; })[0];
        rows.push(['journal-bookmark', '#c9a227', 'Journal', j ? 'Written' : 'Not yet', '<small>' + (j && j.line ? esc(String(j.line).slice(0, 60)) : 'one line about today') + '</small>', '[data-tool="journal"]']);
      }
      if (Fe.on('health')) {
        var nx = Fe.list('health').filter(function (h) { return h && h.kind === 'checkup' && /^\d{4}-\d{2}-\d{2}$/.test(h.date || '') && h.date >= td; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
        if (nx) { var dd = Math.round((new Date(nx.date + 'T12:00') - new Date(td + 'T12:00')) / 864e5); rows.push(['clipboard2-pulse', '#e66767', 'Next appointment', dd === 0 ? 'Today' : dd === 1 ? 'Tomorrow' : 'In ' + dd + ' days', '<small>' + esc(nx.title || 'Check-up') + (nx.time ? ' · ' + esc(nx.time) : '') + '</small>', '[data-tool="health"]']); }
      }
      ht.hidden = !rows.length;
      ht.innerHTML = '<div class="card-head"><h2><i class="bi bi-sun"></i> Today</h2></div><ul class="pt-rows">' + rows.map(function (r) {
        return '<li><button type="button" class="pt-row" data-ptjump="' + esc(r[5]) + '"><span class="pt-ic" style="--c:' + r[1] + '"><i class="bi bi-' + r[0] + '"></i></span><span class="pt-t"><small>' + esc(r[2]) + '</small><b>' + esc(r[3]) + '</b></span><span class="pt-x">' + r[4] + '</span></button></li>';
      }).join('') + '</ul>';
    };
    ['health:change', 'habits:change', 'tools:change', 'dash:local', 'features:change'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(drawH, 30); }); });
    window.Vault.onUnlock(function () { setTimeout(drawH, 120); });
    window.Vault.onLock(function () { ht.innerHTML = ''; ht.hidden = true; });
  }

  /* ======================= Work → Today ======================= */
  if (page === 'work') {
    var wt = document.createElement('section'); wt.className = 'card pt-today kit-wide'; wt.id = 'wkToday'; wt.hidden = true;
    var grid = main.querySelector('.kit-grid'); if (grid) grid.insertBefore(wt, grid.firstChild); else main.appendChild(wt);
    var hmS = function (min) { min = Math.max(0, Math.round(min)); return Math.floor(min / 60) + ' h ' + pad(min % 60) + ' min'; };
    var drawW = function () {
      if (!window.Vault.get()) { wt.hidden = true; return; }
      var rows = [], now = new Date(), td = dkey(now);
      if (Fe.on('flex') && window.FlexTime) {
        var st = window.FlexTime.stats(), norm = ((Fe.tools().flexcfg || {}).norm || 7.5) * 60, worked = st.today || 0;
        if (st.open) {
          var p = String(st.open.in || '').split(':'), started = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +p[0] || 0, +p[1] || 0);
          var brk = +st.open.brk || +(Fe.tools().flexcfg || {}).brk || 0, left = norm - worked, home = new Date(now.getTime() + Math.max(0, left) * 6e4);
          rows.push(['stopwatch', '#e8743b', 'Clocked in ' + esc(st.open.in), hmS(worked) + ' so far', '<small>' + (left > 0 ? 'a normal day ends about ' + pad(home.getHours()) + ':' + pad(home.getMinutes()) : 'a full day done – the rest is flex') + (brk ? ' · ' + brk + ' min break counted' : '') + '</small>', '[data-tool="flex"]']);
        } else rows.push(['stopwatch', '#e8743b', 'Flex time', worked ? hmS(worked) + ' today' : 'Not clocked in', '<small>this week ' + esc(window.FlexTime.dur(st.week)) + (st.weekTarget ? ' of ' + esc(window.FlexTime.dur(st.weekTarget)) : '') + '</small>', '[data-tool="flex"]']);
      }
      /* today's work events from the calendar (own events in the Work category, and phone calendars) */
      if (window.Cal && window.Cal.occurrences) {
        var from = new Date(now.getFullYear(), now.getMonth(), now.getDate()), to = new Date(from.getTime() + 864e5), evs = [];
        try { evs = window.Cal.occurrences(from, to) || []; } catch (e) { evs = []; }
        evs = evs.filter(function (o) { var e = o && o.ev; return e && !o.allDay && !e.reminder && !e.leave && (e.cat === 'work' || e.feedId) && o.end > now; }).sort(function (a, b) { return a.start - b.start; });
        if (evs.length) { var e0 = evs[0]; rows.push(['calendar-event', '#3987e5', 'Next', pad(e0.start.getHours()) + ':' + pad(e0.start.getMinutes()) + ' ' + String(e0.title || 'Event').slice(0, 40), '<small>' + (evs.length > 1 ? (evs.length - 1) + ' more today' : 'the last one today') + (e0.ev.location ? ' · ' + esc(String(e0.ev.location).slice(0, 30)) : '') + '</small>', '']); }
      }
      if (Fe.on('meetings')) {
        var open = []; Fe.list('meetings').forEach(function (m) { String(m.actions || '').split('\n').forEach(function (x, i) { if (x.trim() && !(m.done || {})[i]) open.push(x.trim()); }); });
        if (open.length) rows.push(['list-check', '#3987e5', 'Action points', open.length + ' open', '<small>' + esc(open.slice(0, 2).join(' · ').slice(0, 80)) + '</small>', '[data-tool="meetings"]']);
      }
      if (Fe.on('ptime')) {
        var run = Fe.tools().ptrun, pr = run && (Fe.list('pproj').filter(function (x) { return x.id === run.pid; })[0] || {});
        var mins = Fe.list('ptime').filter(function (x) { return x && x.date === td; }).reduce(function (a, x) { return a + (+x.mins || 0); }, 0);
        rows.push(['hourglass-split', '#e8743b', run ? 'Timer running' : 'Client time today', run ? esc(pr.name || 'client') : hmS(mins), '<small>' + (run ? 'since ' + new Date(run.start || Date.now()).toTimeString().slice(0, 5) : mins ? 'logged today' : 'start a timer below') + '</small>', '[data-tool="ptime"]']);
      }
      if (Fe.on('holiday')) {
        var y = String(now.getFullYear()), used = Fe.list('flex').filter(function (e) { return e && e.type === 'vacation' && String(e.date).slice(0, 4) === y; }).length, days = +((Fe.tools().flexcfg || {}).vacation || 25);
        rows.push(['sun', '#e8743b', 'Holiday ' + y, (days - used) + ' days left', '<small>' + used + ' of ' + days + ' used</small>', '[data-tool="holiday"]']);
      }
      wt.hidden = !rows.length;
      wt.innerHTML = '<div class="card-head"><h2><i class="bi bi-briefcase"></i> Today at work</h2></div><ul class="pt-rows">' + rows.map(function (r) {
        return '<li><button type="button" class="pt-row"' + (r[5] ? ' data-ptjump="' + esc(r[5]) + '"' : ' data-ptcal') + '><span class="pt-ic" style="--c:' + r[1] + '"><i class="bi bi-' + r[0] + '"></i></span><span class="pt-t"><small>' + r[2] + '</small><b>' + esc(r[3]) + '</b></span><span class="pt-x">' + r[4] + '</span></button></li>';
      }).join('') + '</ul>';
    };
    ['tools:change', 'dash:local', 'features:change', 'cal:change'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(drawW, 30); }); });
    window.Vault.onUnlock(function () { setTimeout(drawW, 120); });
    window.Vault.onLock(function () { wt.innerHTML = ''; wt.hidden = true; });
    setInterval(function () { if (!document.hidden && window.Vault.get()) drawW(); }, 60000);
  }
  /* a row on Today: go to that card (switching tab if needed) */
  main.addEventListener('click', function (e) {
    var r = e.target.closest('[data-ptjump]'); if (r) { var el = main.querySelector(r.dataset.ptjump); if (!el) return; var t = el.dataset.ptab || tabFor(el); if (t && t !== cur) show(t, true); setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); return; }
    if (e.target.closest('[data-ptcal]')) location.href = '/cmd/calendar/';
  });
})();
