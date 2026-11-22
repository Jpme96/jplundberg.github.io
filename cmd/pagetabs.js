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
  var page = (location.pathname.match(/\/cmd\/(habits|house|work|homelife|lifeadmin|me|food|papers|people)\//) || [])[1];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }

  var CONF = {
    habits: {
      tabs: [['today', I18N.k('ui.today', 'Today'), 'sun'], ['training', I18N.k('ui.training', 'Training'), 'heart-pulse'], ['body', I18N.k('ui.tab-body', 'Body'), 'apple'], ['care', I18N.k('ui.tab-care', 'Care'), 'clipboard2-pulse']],
      map: [['#hpTiles', 'today'], ['#hsToday', 'today'], ['.hr-wrap', 'today'], ['#hpHabits', 'today'], ['#hpEmpty', 'today'],
        ['[data-tool="training"]', 'training'], ['[data-tool="gym"]', 'training'], ['[data-tool="rest"]', 'training'], ['[data-tool="hwater"]', 'today'],
        ['#ahCard', 'body'], ['[data-tool="health"]', 'care'], ['#meHealth', 'care']],
      feats: { today: ['habits', 'hreport'], training: ['training', 'gym', 'rest'], body: ['ahealth'], care: ['health'] }
    },
    house: {
      /* a 4th value: the tab only shows while that feature (or one of a list) is on · Docs holds the FDV binder and Claims */
      /* a 5th value (true): only while you look at the home you live in now (not an earlier one – house-homes.js) */
      tabs: [['shared', I18N.k('ui.shared', 'Shared'), 'people', null, true], ['upkeep', I18N.k('ui.upkeep', 'Upkeep'), 'tools', null, true], ['energy', I18N.k('ui.energy', 'Energy'), 'lightning-charge', null, true], ['things', I18N.k('ui.things', 'Things'), 'box-seam', null, true],
        ['projects', I18N.k('ui.projects', 'Projects'), 'hammer', null], ['docs', I18N.k('ui.docs', 'Docs'), 'journal-bookmark', ['hdocs', 'hclaim']], ['safe', I18N.k('ui.tab-safe', 'Safety'), 'shield-check', ['ready', 'hood'], true], ['history', I18N.k('ui.history', 'History'), 'clock-history']],
      map: [['#hlTiles', 'upkeep'], ['[data-tool="htake"]', 'shared'], ['[data-tool="hshared"]', 'shared'], ['[data-tool="hproj"]', 'projects'], ['[data-tool="hdocs"]', 'docs'], ['[data-tool="hclaim"]', 'docs'], ['[data-tool="hhist"]', 'history'], ['[data-tool="hmaint"]', 'upkeep'], ['[data-tool="hfdvup"]', 'upkeep'], ['[data-tool="hchores"]', 'upkeep'], ['[data-tool="hplants"]', 'upkeep'], ['[data-tool="henergy"]', 'energy'], ['[data-tool="hpros"]', 'projects'], ['[data-tool="hseason"]', 'upkeep'], ['[data-tool="hbins"]', 'upkeep'],
        ['[data-tool="hmeter"]', 'energy'], ['[data-tool="hpower"]', 'energy'], ['[data-tool="power"]', 'energy'],
        ['[data-tool="hinv"]', 'things'], ['[data-tool="hinfo"]', 'things'], ['[data-tool="warranty"]', 'things'], ['[data-tool="lp-ready"]', 'safe'], ['[data-tool="lp-hood"]', 'safe']],
      feats: { shared: ['shared'], energy: ['power'], things: ['warranty', 'hdocs', 'hclaim', 'hproj'], safe: ['ready', 'hood'] }
    },
    /* the life pages (2026-11-21, JP chose Home life · Life admin · Me): a tab shows only while one of its sections is on */
    homelife: {
      tabs: [['plans', I18N.k('ui.tab-plans', 'Plans'), 'balloon', ['parties', 'moments', 'family']], ['animals', I18N.k('ui.tab-pets-clubs', 'Pets & clubs'), 'heart', ['pets', 'clubs']]],
      map: [['[data-tool="lp-parties"]', 'plans'], ['[data-tool="lp-moments"]', 'plans'], ['[data-tool="lp-family"]', 'plans'], ['[data-tool="lp-pets"]', 'animals'], ['[data-tool="lp-clubs"]', 'animals']],
      feats: { plans: ['parties', 'moments', 'family'], animals: ['pets', 'clubs'] }
    },
    lifeadmin: {
      tabs: [['yearly', I18N.k('ui.tab-yearly', 'Yearly'), 'clipboard-check', ['ladmin', 'deals']], ['digital', I18N.k('ui.tab-digital', 'Digital'), 'shield-lock', ['digital']], ['climate', I18N.k('ui.tab-climate', 'Climate'), 'globe-europe-africa', ['climate']]],
      map: [['[data-tool="lp-ladmin"]', 'yearly'], ['[data-tool="lp-deals"]', 'yearly'], ['[data-tool="lp-digital"]', 'digital'], ['[data-tool="lp-climate"]', 'climate']],
      feats: { yearly: ['ladmin', 'deals'], digital: ['digital'], climate: ['climate'] }
    },
    me: {
      tabs: [['mind', I18N.k('ui.tab-mind', 'Mind'), 'emoji-smile', ['mood', 'journal', 'wins', 'wheel']], ['rest', I18N.k('ui.tab-rest', 'Rest'), 'moon-stars', ['sleep', 'calm', 'screen']], ['care', I18N.k('ui.tab-care-me', 'Care'), 'scissors', ['bodycare', 'style']], ['free', I18N.k('ui.tab-free', 'Free time'), 'collection-play', ['media', 'later', 'outdoor', 'hobbies']], ['career', I18N.k('ui.tab-career', 'Career'), 'graph-up-arrow', ['career', 'learning']]],
      map: [['[data-tool="lp-mood"]', 'mind'], ['[data-tool="journal"]', 'mind'], ['[data-tool="lp-wins"]', 'mind'], ['[data-tool="lp-wheel"]', 'mind'], ['[data-tool="lp-sleep"]', 'rest'], ['[data-tool="lp-calm"]', 'rest'], ['[data-tool="lp-screen"]', 'rest'], ['[data-tool="lp-bodycare"]', 'care'], ['[data-tool="lp-style"]', 'care'],
        ['[data-tool="lp-media"]', 'free'], ['[data-tool="lp-later"]', 'free'], ['[data-tool="lp-outdoor"]', 'free'], ['[data-tool="lp-hobbies"]', 'free'], ['[data-tool="lp-career"]', 'career'], ['[data-tool="learning"]', 'career']],
      feats: { mind: ['mood', 'journal', 'wins', 'wheel'], rest: ['sleep', 'calm', 'screen'], care: ['bodycare', 'style'], free: ['media', 'later', 'outdoor', 'hobbies'], career: ['career', 'learning'] }
    },

    /* Food, Papers, People (2026-11-22, JP: "Do all of it") */
    food: {
      tabs: [['meals', I18N.k('ui.tab-meals', 'Meals'), 'calendar-week'], ['shop', I18N.k('ui.tab-shop', 'Shopping'), 'cart3'], ['recipes', I18N.k('ui.recipes', 'Recipes'), 'journal-text'], ['pantry', I18N.k('ui.tab-pantry', 'Pantry'), 'box-seam']],
      map: [['[data-tool="meals"]', 'meals'], ['[data-tool="shop"]', 'shop'], ['[data-tool="recipes"]', 'recipes'], ['[data-tool="pantry"]', 'pantry'], ['[data-tool="lp-usefood"]', 'pantry'], ['[data-tool="lp-freezer"]', 'pantry']],
      feats: {}
    },
    papers: {
      tabs: [['docs', I18N.k('ui.tab-docs-all', 'Documents'), 'folder2-open'], ['receipts', I18N.k('ui.tab-receipts', 'Receipts'), 'receipt'], ['soon', I18N.k('ui.tab-expiring', 'Expiring'), 'hourglass-split']],
      map: [['[data-tool="papers"]', 'docs'], ['[data-tool="pins"]', 'docs'], ['[data-tool="paelse"]', 'docs'], ['[data-tool="parcpt"]', 'receipts'], ['[data-tool="warranty"]', 'receipts'], ['[data-tool="lp-returns"]', 'receipts'], ['[data-tool="pasoon"]', 'soon']],
      feats: { receipts: ['warranty', 'returns'] }
    },
    people: {
      tabs: [['people', I18N.k('ui.people', 'People'), 'people'], ['dates', I18N.k('ui.tab-dates', 'Dates'), 'calendar-heart'], ['gifts', I18N.k('ui.tab-gifts', 'Gifts'), 'gift']],
      map: [['[data-tool="people"]', 'people'], ['[data-tool="pdates"]', 'dates'], ['[data-tool="pgifts"]', 'gifts'], ['[data-tool="lp-thanks"]', 'gifts']],
      feats: { gifts: ['thanks'] }
    },
    work: {
      tabs: [['today', I18N.k('ui.today', 'Today'), 'briefcase'], ['insp', I18N.k('ui.tab-insp', 'Inspection'), 'building-check', 'fdv'], ['doc', I18N.k('ui.tab-docu', 'Docs'), 'folder-check'], ['notes', I18N.k('ui.notes', 'Notes'), 'journal-text'], ['plan', I18N.k('ui.plan', 'Plan'), 'calendar-range']],   /* Inspections: Work → its own menu (JP 2026-11-14) */
      map: [['#hlTiles', 'today'], ['#wkToday', 'today'], ['[data-tool="flex"]', 'today'], ['[data-tool="wkday"]', 'today'], ['[data-tool="ptime"]', 'today'],
        ['[data-tool="meetings"]', 'notes'], ['[data-tool="fdv"]', 'insp'], ['#wkDocReq', 'doc'], ['#wkDocCtl', 'doc'], ['[data-tool="holiday"]', 'plan'], ['#wkEmpty', 'today'], ['#wkTeam', 'today']],   /* the Team card only under Today (JP 20:38) */
      feats: { today: ['flex', 'ptime', 'shutdown'], insp: ['fdv'], notes: ['meetings', 'prep'], plan: ['holiday'] }
    }
  };
  /* tabs you switched off (Settings → Menu & pages): settings.tabOff = { work: ['insp', …] } – at least one tab always stays */
  function offList(pg) { var t = (readJSON('dash.settings', {}) || {}).tabOff || {}; return Array.isArray(t[pg]) ? t[pg] : []; }
  window.PageTabs = { show: function () {}, current: function () { return null; }, pages: Object.keys(CONF), list: function (pg) { return (CONF[pg] || { tabs: [] }).tabs.map(function (t) { return { id: t[0], name: t[1], icon: t[2], feat: t[3] || null }; }); }, off: offList };
  window.dispatchEvent(new Event('pagetabs:ready'));
  if (!main || !page) return;
  var C = CONF[page], KEY = 'dash.ptab.' + page, all = /[?&]customize/.test(location.search);
  var cur = (function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } })();
  /* tabs that belong to a feature that's off aren't shown */
  function past() { var H = window.Homes; return !!(H && H.isPast(H.view())); }
  function fon(f) { return !f || (Array.isArray(f) ? f.some(function (x) { return Fe.on(x); }) : Fe.on(f)); }
  function tabs() { var p = past(), off = offList(page), l = C.tabs.filter(function (t) { return fon(t[3]) && !(t[4] && p); }), k = l.filter(function (t) { return off.indexOf(t[0]) < 0; }); return k.length ? k : l; }
  /* tabs that were merged into another */
  var ALIAS = { claims: 'docs', req: 'doc' };   /* Requirements + Control → one Documentation tab (JP 2026-11-16) */
  if (ALIAS[cur]) cur = ALIAS[cur];
  function has(t) { return tabs().some(function (x) { return x[0] === t; }); }
  if (!has(cur)) cur = (tabs()[0] || C.tabs[0])[0];

  /* the bar */
  var nav = document.createElement('nav');
  nav.className = 'fp-tabs pt-tabs'; nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', 'Views');
  function bar() {
    var l = tabs(), h = l.map(function (t) { return '<button type="button" role="tab" data-ptab-go="' + t[0] + '"><i class="bi bi-' + t[2] + '"></i><span>' + esc(t[1]) + '</span></button>'; }).join('');
    nav.style.setProperty('--n', l.length); nav.style.setProperty('--c', Math.ceil(l.length / 2)); nav.classList.toggle('pt-many', l.length > 5);
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
    var html = (!shown && !all ? '<p class="pt-empty">' + esc(ids.length ? I18N.k('ui.pt-nothing-below', 'Nothing here yet – switch something on below.') : I18N.k('ui.pt-nothing', 'Nothing here yet.')) + '</p>' : '') +
      (ids.length && !all ? '<div class="pt-sug"><p>' + (shown ? I18N.k('ui.pt-also-fits', 'Also fits here') : I18N.k('ui.pt-fits', 'Fits here')) + '</p><div class="pt-chips">' + ids.map(function (id) {
        var f = Fe.byId(id); return '<button type="button" class="pt-chip" data-ptfeat="' + esc(id) + '"><i class="bi bi-' + esc(f.icon) + '" style="color:' + esc(f.c) + '"></i><span><b>' + esc(f.name) + '</b><small>' + esc(I18N.k('ui.ftd-' + f.id, f.desc)) + '</small></span><i class="bi bi-plus-lg"></i></button>';
      }).join('') + '</div></div>' : '');
    if (tail._h !== html) { tail._h = html; tail.innerHTML = html; }      /* only when it changed – a tap must not land on a redrawn chip */
  }
  tail.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ptfeat]'); if (!b) return;
    var f = Fe.byId(b.dataset.ptfeat); Fe.set(b.dataset.ptfeat, true);
    if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-check2"></i> ' + esc(I18N.k('ui.pt-is-on', '{x} is on', { x: f ? I18N.t(f.name) : '' })), function () { Fe.set(b.dataset.ptfeat, false); });
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
  var offWas = JSON.stringify(offList(page));
  window.addEventListener('dash:local', function () { var o = JSON.stringify(offList(page)); if (o !== offWas) { offWas = o; setTimeout(draw, 30); } });
  window.addEventListener('homes:view', function () { setTimeout(draw, 30); });
  window.Vault.onUnlock(function () { setTimeout(function () { draw(); fromHash(); }, 60); });
  draw(); fromHash();
  window.PageTabs.show = show; window.PageTabs.current = function () { return cur; };

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
        rows.push(['moon-stars', '#8a6fdf', I18N.k('ui.pt-last-night', 'Last night'), ln ? A.fmt('sleep', ln.v) : '–', ln ? bar(ln.v, sleepGoal) : '<small data-t="ui.no-sleep-sent-yet">no sleep sent yet</small>', '#ahCard']);
        rows.push(['person-walking', '#22b35e', I18N.k('ui.pt-steps-today', 'Steps today'), day.steps != null ? A.fmt('steps', day.steps) : '–', day.steps != null ? bar(day.steps, stepGoal) : '<small data-t="ui.arrives-with-the-evening-shortcut">arrives with the evening Shortcut</small>', '#ahCard']);
        if (day.exercise != null) rows.push(['activity', '#e8743b', I18N.k('ui.pt-exercise', 'Exercise'), A.fmt('exercise', day.exercise), bar(day.exercise, exGoal), '#ahCard']);
      }
      var hb = readJSON('dash.habits', null), hl = hb && Array.isArray(hb.list) ? hb.list : [];
      if (Fe.on('habits') && hl.length) {
        var doneT = ((hb.log || {})[td] || []).filter(function (id) { return hl.some(function (h) { return h.id === id; }); }).length;
        rows.push(['check2-circle', '#d55181', I18N.k('ui.pt-habits-today', 'Habits today'), I18N.k('ui.pt-n-of-m', '{n} of {m}', { n: doneT, m: hl.length }), bar(doneT, hl.length), '#hpHabits']);
      }
      if (Fe.on('training')) {
        var m0 = dkey(monday(new Date())), wk = Fe.list('training').filter(function (w) { return w && w.date >= m0 && w.date <= td; }), today = wk.filter(function (w) { return w.date === td; });
        var mins = wk.reduce(function (a, w) { return a + (+w.min || 0); }, 0);
        rows.push(['heart-pulse', '#d55181', I18N.k('ui.pt-training-this-week', 'Training this week'), wk.length === 1 ? I18N.k('ui.pt-1-workout', '1 workout') : I18N.k('ui.pt-n-workouts', '{n} workouts', { n: wk.length }), '<small>' + (mins ? mins + ' min' : I18N.k('ui.pt-none-yet', 'none yet')) + (today.length ? ' · today ✓' : '') + '</small>', '[data-tool="training"]']);
      }
      if (Fe.on('journal')) {
        var j = Fe.list('journal').filter(function (x) { return x && x.date === td; })[0];
        rows.push(['journal-bookmark', '#c9a227', I18N.k('ui.pt-journal', 'Journal'), j && j.line ? I18N.k('ui.pt-written', 'Written') : I18N.k('ui.pt-not-yet', 'Not yet'), '<small>' + (j && j.line ? esc(String(j.line).slice(0, 60)) : I18N.k('ui.pt-one-line-about-today', 'one line about today')) + '</small>', '/cmd/me/#journal']);
      }
      if (Fe.on('health')) {
        var nx = Fe.list('health').filter(function (h) { return h && h.kind === 'checkup' && /^\d{4}-\d{2}-\d{2}$/.test(h.date || '') && h.date >= td; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
        if (nx) { var dd = Math.round((new Date(nx.date + 'T12:00') - new Date(td + 'T12:00')) / 864e5); rows.push(['clipboard2-pulse', '#e66767', I18N.k('ui.pt-next-appointment', 'Next appointment'), dd === 0 ? 'Today' : dd === 1 ? 'Tomorrow' : 'In ' + dd + ' days', '<small>' + esc(nx.title || 'Check-up') + (nx.time ? ' · ' + esc(nx.time) : '') + '</small>', '[data-tool="health"]']); }
      }
      ht.hidden = !rows.length;
      ht.innerHTML = '<div class="card-head"><h2><i class="bi bi-sun"></i> <span data-t="ui.today">Today</span></h2></div><ul class="pt-rows">' + rows.map(function (r) {
        return '<li><button type="button" class="pt-row" data-ptjump="' + esc(r[5]) + '"><span class="pt-ic" style="--c:' + Tok(r[1]) + '"><i class="bi bi-' + r[0] + '"></i></span><span class="pt-t"><small>' + esc(r[2]) + '</small><b>' + esc(r[3]) + '</b></span><span class="pt-x">' + r[4] + '</span></button></li>';
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
          rows.push(['stopwatch', '#e8743b', 'Clocked in ' + esc(st.open.in), hmS(worked) + ' so far', '<small>' + (left > 0 ? I18N.k('ui.pt-day-ends', 'a normal day ends about {t}', { t: pad(home.getHours()) + ':' + pad(home.getMinutes()) }) : I18N.k('ui.pt-day-full', 'a full day done – the rest is flex')) + (brk ? ' · ' + I18N.k('ui.pt-break', '{n} min break counted', { n: brk }) : '') + '</small>', '[data-tool="flex"]']);
        } else if (worked) rows.push(['stopwatch', '#e8743b', I18N.k('ui.pt-flex-time', 'Flex time'), worked ? hmS(worked) + ' ' + I18N.k('ui.pt-today-lower', 'today') : I18N.k('ui.pt-not-clocked-in', 'Not clocked in'), '<small>' + esc(st.weekTarget ? I18N.k('ui.pt-week-of', 'this week {a} of {b}', { a: window.FlexTime.dur(st.week), b: window.FlexTime.dur(st.weekTarget) }) : I18N.k('ui.pt-week', 'this week {a}', { a: window.FlexTime.dur(st.week) })) + '</small>', '[data-tool="flex"]']);
      }
      /* today's work events from the calendar (own events in the Work category, and phone calendars) */
      if (window.Cal && window.Cal.occurrences) {
        var from = new Date(now.getFullYear(), now.getMonth(), now.getDate()), to = new Date(from.getTime() + 864e5), evs = [];
        try { evs = window.Cal.occurrences(from, to) || []; } catch (e) { evs = []; }
        evs = evs.filter(function (o) { var e = o && o.ev; return e && !o.allDay && !e.reminder && !e.leave && (e.cat === 'work' || e.feedId) && o.end > now; }).sort(function (a, b) { return a.start - b.start; });
        if (evs.length) { var e0 = evs[0]; rows.push(['calendar-event', '#3987e5', I18N.k('ui.pt-next', 'Next'), pad(e0.start.getHours()) + ':' + pad(e0.start.getMinutes()) + ' ' + String(e0.title || I18N.k('ui.pt-event', 'Event')).slice(0, 40), '<small>' + (evs.length > 1 ? I18N.k('ui.pt-more-today', '{n} more today', { n: evs.length - 1 }) : I18N.k('ui.pt-last-today', 'the last one today')) + (e0.ev.location ? ' · ' + esc(String(e0.ev.location).slice(0, 30)) : '') + '</small>', '']); }
      }
      if (Fe.on('meetings')) {
        var open = []; Fe.list('meetings').forEach(function (m) { String(m.actions || '').split('\n').forEach(function (x, i) { if (x.trim() && !(m.done || {})[i]) open.push(x.trim()); }); });
        if (open.length) rows.push(['list-check', '#3987e5', I18N.k('ui.pt-action-points', 'Action points'), I18N.k('ui.pt-n-open', '{n} open', { n: open.length }), '<small>' + esc(open.slice(0, 2).join(' · ').slice(0, 80)) + '</small>', '[data-tool="meetings"]']);
      }
      if (Fe.on('ptime')) {
        var run = Fe.tools().ptrun, pr = run && (Fe.list('pproj').filter(function (x) { return x.id === run.pid; })[0] || {});
        var mins = Fe.list('ptime').filter(function (x) { return x && x.date === td; }).reduce(function (a, x) { return a + (+x.mins || 0); }, 0);
        rows.push(['hourglass-split', '#e8743b', run ? I18N.k('ui.pt-timer-running', 'Timer running') : I18N.k('ui.pt-client-time-today', 'Client time today'), run ? esc(pr.name || I18N.k('ui.pt-client', 'client')) : hmS(mins), '<small>' + (run ? I18N.k('ui.pt-since', 'since {t}', { t: new Date(run.start || Date.now()).toTimeString().slice(0, 5) }) : mins ? I18N.k('ui.pt-logged-today', 'logged today') : I18N.k('ui.pt-start-a-timer-below', 'start a timer below')) + '</small>', '[data-tool="ptime"]']);
      }
      /* not clocked in, or the holiday count, is what the Flex time card right below already says (it said it three times,
         2026-11-10) – those rows only when that card isn't on */
      if (Fe.on('holiday') && !(Fe.on('flex') && window.FlexTime)) {
        var y = String(now.getFullYear()), used = Fe.list('flex').filter(function (e) { return e && e.type === 'vacation' && String(e.date).slice(0, 4) === y; }).length, days = +((Fe.tools().flexcfg || {}).vacation || 25);
        rows.push(['sun', '#e8743b', 'Holiday ' + y, (days - used) + ' days left', '<small>' + used + ' of ' + days + ' used</small>', '[data-tool="holiday"]']);
      }
      wt.hidden = !rows.length;
      wt.innerHTML = '<div class="card-head"><h2><i class="bi bi-briefcase"></i> <span data-t="ui.today-at-work">Today at work</span></h2></div><ul class="pt-rows">' + rows.map(function (r) {
        return '<li><button type="button" class="pt-row"' + (r[5] ? ' data-ptjump="' + esc(r[5]) + '"' : ' data-ptcal') + '><span class="pt-ic" style="--c:' + Tok(r[1]) + '"><i class="bi bi-' + r[0] + '"></i></span><span class="pt-t"><small>' + r[2] + '</small><b>' + esc(r[3]) + '</b></span><span class="pt-x">' + r[4] + '</span></button></li>';
      }).join('') + '</ul>';
    };
    ['tools:change', 'dash:local', 'features:change', 'cal:change'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(drawW, 30); }); });
    window.Vault.onUnlock(function () { setTimeout(drawW, 120); });
    window.Vault.onLock(function () { wt.innerHTML = ''; wt.hidden = true; });
    setInterval(function () { if (!document.hidden && window.Vault.get()) drawW(); }, 60000);
  }
  /* a row on Today: go to that card (switching tab if needed) */
  main.addEventListener('click', function (e) {
    var r = e.target.closest('[data-ptjump]'); if (r) { if (r.dataset.ptjump.charAt(0) === '/') { location.href = r.dataset.ptjump; return; } var el = main.querySelector(r.dataset.ptjump); if (!el) return; var t = el.dataset.ptab || tabFor(el); if (t && t !== cur) show(t, true); setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); return; }
    if (e.target.closest('[data-ptcal]')) location.href = '/cmd/calendar/';
  });
})();
