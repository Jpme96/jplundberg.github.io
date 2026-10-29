/* Built by cmd/build.py from: habits/habits.js, kit.js, tools.js, profile.js, links.js – edit those files, not this one. */
/* ===== habits/habits.js ===== */
try {
/* Habits page: streaks, consistency and a 26-week calendar per habit.
   Reads the same synced, encrypted data as the dashboard's "This week" card. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var WEEKS = 26;
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }

  var hb = null;
  function load() {
    try { hb = JSON.parse(localStorage.getItem('dash.habits')) || null; } catch (e) { hb = null; }
    hb = hb || { list: [], log: {} };
    hb.log = hb.log || {};
  }
  function save() {
    try { localStorage.setItem('dash.habits', JSON.stringify(hb)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));   // lock.js puts it in the encrypted, synced vault
  }
  function done(id, k) { return (hb.log[k] || []).indexOf(id) > -1; }
  function countWeek(id, mon) {
    var n = 0;
    for (var i = 0; i < 7; i++) if (done(id, dkey(addDays(mon, i)))) n++;
    return n;
  }

  /* Weeks in a row where the target was met. This week counts once it's met. */
  function streaks(h) {
    var thisMon = monday(new Date());
    var cur = 0, best = 0, run = 0;
    var first = Object.keys(hb.log).sort()[0];
    var start = first ? monday(new Date(first + 'T12:00')) : thisMon;
    for (var m = new Date(start); m <= thisMon; m = addDays(m, 7)) {
      var met = countWeek(h.id, m) >= h.target;
      if (met) { run++; best = Math.max(best, run); }
      else if (m < thisMon) run = 0;
    }
    cur = run;
    return { cur: cur, best: best };
  }

  /* ---------- tooltip ---------- */
  var tip = $('fpTip');
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(Math.max(8, x + 14), innerWidth - w - 8) + 'px';
    tip.style.top = (y - h - 12 < 8 ? y + 16 : y - h - 12) + 'px';
  }
  function hideTip() { tip.hidden = true; }

  /* date formatting is slow when done hundreds of times – make the formatters once */
  var F_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  var F_MON = new Intl.DateTimeFormat('en-GB', { month: 'short' });
  function render() {
    var list = hb.list || [];
    var stCache = {};
    var streaksOf = function (h) { return stCache[h.id] || (stCache[h.id] = streaks(h)); };
    $('hpEmpty').hidden = list.length > 0;
    var today = new Date(), tk = dkey(today), thisMon = monday(today);

    /* key numbers across all habits */
    var weekDone = 0, weekTarget = 0, yearTotal = 0, last30 = 0, y = String(today.getFullYear());
    list.forEach(function (h) { weekDone += Math.min(countWeek(h.id, thisMon), h.target); weekTarget += h.target; });
    Object.keys(hb.log).forEach(function (k) {
      var n = hb.log[k].filter(function (id) { return list.some(function (h) { return h.id === id; }); }).length;
      if (k.slice(0, 4) === y) yearTotal += n;
      if (k > dkey(addDays(today, -30))) last30 += n;
    });
    var bestCur = list.reduce(function (a, h) { var s = streaksOf(h); return s.cur > a.v ? { v: s.cur, n: h.name } : a; }, { v: 0, n: '' });
    var T = [
      { i: 'calendar-week', l: 'This week', v: weekTarget ? weekDone + '<small>/ ' + weekTarget + '</small>' : '–', s: weekTarget ? (weekDone >= weekTarget ? 'All targets hit 🎉' : weekDone ? Math.round(weekDone / weekTarget * 100) + ' % of this week’s targets so far' : 'of this week’s targets so far') : 'Add a habit on the dashboard' },
      { i: 'fire', l: 'Longest current streak', v: bestCur.v + '<small>week' + (bestCur.v === 1 ? '' : 's') + '</small>', s: bestCur.v ? esc(bestCur.n) : 'Hit a weekly target to start one' },
      { i: 'clock-history', l: 'Last 30 days', v: String(last30), s: 'times in total' },
      { i: 'trophy', l: 'This year', v: String(yearTotal), s: 'times in ' + y }
    ];
    $('hpTiles').innerHTML = T.map(function (t) {
      return '<div class="fp-tile" data-tk="' + t.l.replace(/\b(19|20)\d\d\b/g, 'Y') + '"><div class="lbl"><i class="bi bi-' + t.i + '"></i>' + t.l + '</div><div class="val">' + t.v + '</div><div class="sub">' + t.s + '</div></div>';
    }).join('');

    /* one card per habit */
    var start = addDays(thisMon, -7 * (WEEKS - 1));
    $('hpHabits').innerHTML = list.map(function (h) {
      var st = streaksOf(h);
      var wk = countWeek(h.id, thisMon);
      var met12 = 0;
      for (var w = 1; w <= 12; w++) if (countWeek(h.id, addDays(thisMon, -7 * w)) >= h.target) met12++;
      var stats = [
        ['This week', wk + '<small>/ ' + h.target + '</small>'],
        ['Current streak', st.cur + '<small>week' + (st.cur === 1 ? '' : 's') + '</small>'],
        ['Best streak', st.best + '<small>week' + (st.best === 1 ? '' : 's') + '</small>'],
        ['Last 12 weeks', Math.round(met12 / 12 * 100) + '<small>% on target</small>']
      ].map(function (s) { return '<div class="hp-stat"><div class="k">' + s[0] + '</div><div class="v">' + s[1] + '</div></div>'; }).join('');

      var weeks = '', lastMonth = -1;
      for (var c = 0; c < WEEKS; c++) {
        var mon = addDays(start, 7 * c);
        var m = mon.getMonth();
        var label = m !== lastMonth ? F_MON.format(mon) : '';
        lastMonth = m;
        var cells = '';
        for (var r = 0; r < 7; r++) {
          var d = addDays(mon, r), k = dkey(d), on = done(h.id, k);
          cells += '<button type="button" class="hp-cell' + (on ? ' on' : '') + (k === tk ? ' today' : '') + (k > tk ? ' future' : '') + '"' +
            ' data-h="' + h.id + '" data-d="' + k + '" aria-pressed="' + on + '"' + (k > tk ? ' disabled tabindex="-1"' : '') +
            ' aria-label="' + esc(h.name) + ', ' + F_LONG.format(d) + (on ? ', done' : '') + '"></button>';
        }
        weeks += '<div class="hp-week"><span class="hp-month">' + label + '</span>' + cells + '</div>';
      }
      /* the last two weeks as big tappable days – the easy way to fill in on a phone */
      var recent = '';
      [addDays(thisMon, -7), thisMon].forEach(function (wm, wi) {
        var cells = '';
        for (var r = 0; r < 7; r++) {
          var d = addDays(wm, r), k = dkey(d), on = done(h.id, k), fut = k > tk;
          cells += '<button type="button" class="hp-day' + (on ? ' on' : '') + (k === tk ? ' today' : '') + (fut ? ' future' : '') + '" data-h="' + h.id + '" data-d="' + k + '" aria-pressed="' + on + '"' + (fut ? ' disabled' : '') +
            ' aria-label="' + esc(h.name) + ', ' + F_LONG.format(d) + (on ? ', done' : '') + '"><small>' + 'MTWTFSS'[r] + '</small><b>' + d.getDate() + '</b><i class="bi bi-check-lg"></i></button>';
        }
        recent += '<div class="hp-recent-row"><span class="hp-recent-lbl">' + (wi ? 'This week' : 'Last week') + '<b>' + countWeek(h.id, wm) + '<small>/' + h.target + '</small></b></span><div class="hp-recent-days">' + cells + '</div></div>';
      });
      return '<section class="card hp-card"><div class="card-head"><h2><i class="bi bi-activity"></i> ' + esc(h.name) + '<small>' + h.target + '× per week</small></h2></div>' +
        '<div class="hp-stats">' + stats + '</div>' +
        '<div class="hp-recent">' + recent + '</div>' +
        '<div class="hp-heat"><div class="hp-heat-inner"><div class="hp-days"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span></div>' +
        '<div class="hp-weeks">' + weeks + '</div></div></div>' +
        '<div class="hp-sub"><span>Last 26 weeks</span><span class="key"><span><i class="sw" style="background:rgba(var(--ink-rgb),.08)"></i>Not done</span><span><i class="sw" style="background:var(--accent)"></i>Done</span></span></div>' +
        '</section>';
    }).join('');
  }

  /* Tap a day to fill in or undo */
  $('hpHabits').addEventListener('click', function (e) {
    var c = e.target.closest('.hp-cell, .hp-day');
    if (!c || c.disabled) return;
    var l = hb.log[c.dataset.d] || (hb.log[c.dataset.d] = []);
    var i = l.indexOf(c.dataset.h);
    if (i > -1) l.splice(i, 1); else l.push(c.dataset.h);
    if (!l.length) delete hb.log[c.dataset.d];
    save();
    render();
  });
  $('hpHabits').addEventListener('pointerover', function (e) {
    var c = e.target.closest('.hp-cell');
    if (!c) return;
    var d = new Date(c.dataset.d + 'T12:00');
    showTip('<b>' + d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '</b><div>' + (c.classList.contains('on') ? 'Done ✓' : 'Not done') + '</div>',
      e.clientX, e.clientY);
  });
  $('hpHabits').addEventListener('pointerout', function (e) { if (e.target.closest('.hp-cell')) hideTip(); });

  /* Show the newest weeks first on narrow screens */
  function scrollToEnd() { document.querySelectorAll('.hp-heat').forEach(function (h) { h.scrollLeft = h.scrollWidth; }); }

  var prevReload = window.Dash && window.Dash.reload;      // newer data from another device (other parts hook in too)
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); load(); render(); scrollToEnd(); };
  window.Vault.onUnlock(function () { load(); render(); requestAnimationFrame(scrollToEnd); });
  window.Vault.onLock(function () { $('hpTiles').innerHTML = ''; $('hpHabits').innerHTML = ''; hideTip(); });
})();
} catch (e) { console.error("habits/habits.js", e); }
/* ===== kit.js ===== */
try {
/* Kit: one building block for the smaller tools – a card with a summary, a list and an
   add/edit sheet generated from a list of fields. Data lives in Features.tools()[key]. */
(function () {
  "use strict";
  var F = window.Features;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function today() { return F.dkey(new Date()); }
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function fmt(k, o) { return k ? F.fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

  /* ---------- one shared sheet ---------- */
  var sheet = null;
  function ensureSheet() {
    if (sheet) return sheet;
    var bg = document.createElement('div');
    bg.className = 'cl-sheet-bg kit-bg'; bg.hidden = true;
    bg.innerHTML = '<form class="cl-sheet kit-sheet" role="dialog" aria-modal="true" autocomplete="off">' +
      '<div class="cl-sheet-head"><button class="text-btn" type="button" data-close>Cancel</button><h2></h2><button class="pill-btn" type="submit">Save</button></div>' +
      '<div class="cl-edit kit-fields"></div><div class="cl-del kit-del" hidden><button class="text-btn danger" type="button"><i class="bi bi-trash3"></i> <span>Delete</span></button></div></form>';
    document.body.appendChild(bg);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bg.hidden) close(); });
    sheet = { bg: bg, form: bg.querySelector('form'), fields: bg.querySelector('.kit-fields'), title: bg.querySelector('h2'), del: bg.querySelector('.kit-del') };
    return sheet;
  }
  function open() {
    var s = ensureSheet();
    s.bg.hidden = false;
    requestAnimationFrame(function () { s.bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
  }
  function close() {
    if (!sheet) return;
    sheet.bg.classList.remove('open');
    document.documentElement.classList.remove('cl-modal');
    setTimeout(function () { sheet.bg.hidden = true; }, 220);
  }

  function input(f, v) {
    var id = 'kf-' + f.k, req = f.req ? ' required' : '', ph = f.ph ? ' placeholder="' + esc(f.ph) + '"' : '';
    var val = v == null ? '' : v;
    if (f.type === 'textarea') return '<textarea id="' + id + '" rows="' + (f.rows || 3) + '"' + ph + req + ' maxlength="' + (f.max || 2000) + '">' + esc(val) + '</textarea>';
    if (f.type === 'select') return '<select id="' + id + '" class="st-wide">' + (typeof f.options === 'function' ? f.options() : f.options).map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select>';
    if (f.type === 'check') return '<input type="checkbox" class="switch" id="' + id + '"' + (val ? ' checked' : '') + '>';
    var t = f.type === 'number' ? 'text" inputmode="decimal' : (f.type || 'text');
    return '<input id="' + id + '" type="' + t + '"' + ph + req + ' maxlength="' + (f.max || 200) + '" value="' + esc(val) + '">';
  }
  function edit(cfg, item) {
    var s = ensureSheet(), isNew = !item;
    item = item ? JSON.parse(JSON.stringify(item)) : {};
    s.title.textContent = isNew ? (cfg.addTitle || 'Add') : (cfg.editTitle || 'Edit');
    var rows = '', inline = '';
    cfg.fields.forEach(function (f) {
      var v = item[f.k] != null ? item[f.k] : (isNew && f.def != null ? (typeof f.def === 'function' ? f.def() : f.def) : '');
      if (f.type === 'title') { rows += '<input class="cl-in-title" id="kf-' + f.k + '" placeholder="' + esc(f.ph || f.label) + '"' + (f.req ? ' required' : '') + ' maxlength="' + (f.max || 120) + '" value="' + esc(v) + '">'; return; }
      var line = '<label class="st-row kit-row' + (f.type === 'textarea' ? ' kit-tall' : '') + '"><span>' + esc(f.label) + '</span>' + input(f, v) + (f.suffix ? '<em>' + esc(f.suffix) + '</em>' : '') + '</label>';
      if (f.type === 'textarea') rows += '<div class="cl-group cl-group-text kit-text"><span class="kit-lbl">' + esc(f.label) + '</span>' + input(f, v) + (f.help ? '<small class="kit-help">' + esc(f.help) + '</small>' : '') + '</div>';
      else rows += '<div class="cl-group">' + line + (f.help ? '<small class="kit-help">' + esc(f.help) + '</small>' : '') + '</div>';
    });
    s.fields.innerHTML = rows;
    s.del.hidden = isNew;
    var delArmed = false;
    s.del.querySelector('span').textContent = 'Delete';
    s.del.querySelector('button').onclick = function () {
      if (!delArmed) { delArmed = true; s.del.querySelector('span').textContent = 'Tap again to delete'; return; }
      var t = F.tools(); t[cfg.key] = (t[cfg.key] || []).filter(function (x) { return x.id !== item.id; });
      if (cfg.onDelete) cfg.onDelete(item);
      F.saveTools(t); close();
    };
    s.form.onsubmit = function (e) {
      e.preventDefault();
      var bad = null;
      cfg.fields.forEach(function (f) {
        var el = document.getElementById('kf-' + f.k);
        if (!el) return;
        var v = f.type === 'check' ? el.checked : el.value.trim();
        if (f.type === 'number') v = v === '' ? '' : (num(v) == null ? (bad = bad || el, '') : num(v));
        if (f.req && (v === '' || v == null)) bad = bad || el;
        item[f.k] = v;
      });
      if (bad) { bad.focus(); bad.classList.add('kit-bad'); return; }
      if (!item.id) item.id = uid();
      if (cfg.beforeSave) cfg.beforeSave(item, isNew);
      var t = F.tools(), l = Array.isArray(t[cfg.key]) ? t[cfg.key] : [];
      var i = l.findIndex(function (x) { return x.id === item.id; });
      if (i > -1) l[i] = item; else l.push(item);
      t[cfg.key] = l;
      F.saveTools(t);
      if (cfg.afterSave) cfg.afterSave(item, isNew);
      close();
    };
    open();
    if (isNew && innerWidth >= 700) setTimeout(function () { var first = s.fields.querySelector('input,textarea'); if (first) first.focus(); }, 60);
  }

  /* ---------- a collection card ---------- */
  function collection(cfg) {
    var el = cfg.mount, showAll = false, openId = null, scrolled = false;
    if (!el) return null;
    function render() {
      var on = F.on(cfg.feature);
      el.hidden = !on;
      if (!on) { el.innerHTML = ''; return; }
      var items = F.list(cfg.key).slice();
      if (cfg.sort) items.sort(cfg.sort);
      var lim = cfg.limit || 8, shown = showAll ? items : items.slice(0, lim);
      el.innerHTML = '<section class="card kit-card" id="' + cfg.key + '">' +
        '<div class="card-head"><h2><i class="bi bi-' + cfg.icon + '"></i> ' + esc(cfg.title) + '</h2>' +
        '<div class="head-actions">' + (cfg.headExtra ? cfg.headExtra(items) : '') + '<button class="text-btn" type="button" data-kit-add><i class="bi bi-plus-lg"></i> ' + esc(cfg.addLabel || 'Add') + '</button></div></div>' +
        (cfg.summary ? '<div class="kit-sum">' + cfg.summary(items) + '</div>' : '') +
        (cfg.above ? cfg.above(items) : '') +
        (items.length ? '<ul class="kit-list">' + shown.map(function (it) {
          var r = cfg.row(it);
          return '<li class="kit-item' + (r.cls ? ' ' + r.cls : '') + (openId === it.id ? ' open' : '') + '" data-id="' + esc(it.id) + '">' +
            '<button type="button" class="kit-main" data-kit-' + (cfg.detail ? 'toggle' : 'edit') + '="' + esc(it.id) + '">' +
            (r.icon ? '<span class="kit-ic" style="--c:' + (r.color || 'var(--accent)') + '"><i class="bi bi-' + r.icon + '"></i></span>' : '') +
            '<span class="kit-x"><b>' + esc(r.title) + '</b>' + (r.sub ? '<small>' + r.sub + '</small>' : '') + '</span>' +
            (r.right ? '<span class="kit-r">' + r.right + '</span>' : '') + '</button>' +
            (cfg.detail && openId === it.id ? '<div class="kit-detail">' + cfg.detail(it) + '<button type="button" class="text-btn" data-kit-edit="' + esc(it.id) + '"><i class="bi bi-pencil"></i> Edit</button></div>' : '') +
            '</li>';
        }).join('') + '</ul>' : '<p class="empty kit-empty">' + esc(cfg.empty || 'Nothing here yet.') + '</p>') +
        (items.length > lim ? '<button class="text-btn kit-more" type="button" data-kit-more>' + (showAll ? 'Show less' : 'Show all ' + items.length) + '</button>' : '') +
        '</section>';
      if (cfg.afterRender) cfg.afterRender(el, items);
      /* arriving from a calendar reminder (…/#subs): scroll to the card once */
      if (!scrolled && location.hash === '#' + cfg.key && document.documentElement.classList.contains('unlocked')) {
        scrolled = true;
        /* wait until the rest of the page has drawn (charts, lists), then scroll */
        setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 450);
      }
    }
    el.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-kit-add]')) return edit(cfg, null);
      if ((b = e.target.closest('[data-kit-edit]'))) return edit(cfg, F.list(cfg.key).filter(function (x) { return x.id === b.dataset.kitEdit; })[0]);
      if ((b = e.target.closest('[data-kit-toggle]'))) { openId = openId === b.dataset.kitToggle ? null : b.dataset.kitToggle; return render(); }
      if (e.target.closest('[data-kit-more]')) { showAll = !showAll; return render(); }
      if (cfg.onClick) cfg.onClick(e, render);
    });
    window.addEventListener('tools:change', render);
    window.addEventListener('features:change', render);
    var prevReload = window.Dash && window.Dash.reload;
    window.Dash = window.Dash || {};
    window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
    if (window.Vault) window.Vault.onUnlock(render);
    return { render: render, edit: function (it) { edit(cfg, it); } };
  }

  window.Kit = { collection: collection, edit: edit, close: close, esc: esc, uid: uid, num: num, kr: kr, fmt: fmt, today: today };
})();
} catch (e) { console.error("kit.js", e); }
/* ===== tools.js ===== */
try {
/* The optional tools (Settings → Features). Each one mounts into a [data-tool="…"]
   container on the page where it belongs:
   Work page:      flex time, meeting notes, courses & certificates
   Habits page:    training log, journal
   Travel page:    places to visit
   Finance page:   subscriptions, warranties & receipts
   Dashboard:      a small "Work today" card for flex time */
(function () {
  "use strict";
  var F = window.Features, K = window.Kit;
  if (!F || !K) return;
  var esc = K.esc, today = K.today, fmt = K.fmt, kr = K.kr;
  function $t(name) { return document.querySelector('[data-tool="' + name + '"]'); }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
  function addDays(k, n) { var d = F.fromKey(k); d.setDate(d.getDate() + n); return F.dkey(d); }
  function tile(label, value, sub) { return '<div class="kit-tile" data-tk="' + String(label).replace(/\b(19|20)\d\d\b/g, 'Y').replace(/"/g, '') + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function hm(min) {
    var neg = min < 0; min = Math.abs(Math.round(min));
    var h = Math.floor(min / 60), m = min % 60;
    return (neg ? '−' : '') + (h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min');
  }
  /* short form for the number tiles: 15 h 26 → "15h 26m" */
  function hms(min) {
    var neg = min < 0; min = Math.abs(Math.round(min));
    var h = Math.floor(min / 60), m = min % 60;
    return (neg ? '−' : '') + (h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm');
  }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function nowHM() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  /* ================= WORK: flex time ================= */
  var FLEX_TYPES = { work: 'Work', vacation: 'Holiday (ferie)', sick: 'Sick', flexoff: 'Flex day off (avspasering)', holiday: 'Public holiday', course: 'Course / travel' };
  function flexCfg() { var c = F.tools().flexcfg || {}; return { norm: +c.norm || 7.5, vacation: +c.vacation || 25 }; }
  function worked(e, isToday) {
    if (e.type !== 'work' && e.type !== 'course') return 0;
    var a = toMin(e.in), b = toMin(e.out);
    if (a == null) return 0;
    if (b == null) { if (!isToday) return 0; b = toMin(nowHM()); }
    var w = b - a; if (w < 0) w += 1440;
    return Math.max(0, w - (+e.brk || 0));
  }
  function flexDays() {
    var by = {}, td = today();
    F.list('flex').forEach(function (e) { (by[e.date] = by[e.date] || []).push(e); });
    var norm = flexCfg().norm * 60;
    return Object.keys(by).sort().map(function (k) {
      var es = by[k], open = es.some(function (e) { return (e.type === 'work' || e.type === 'course') && e.in && !e.out; });
      var w = es.reduce(function (a, e) { return a + worked(e, k === td); }, 0);
      var free = es.some(function (e) { return e.type === 'vacation' || e.type === 'sick' || e.type === 'holiday'; });
      var hol = F.holiday(k) && F.fromKey(k).getDay() % 6 !== 0;   // public holiday on a weekday: all work is extra
      var delta = free ? 0 : hol ? w : w - norm;
      return { date: k, entries: es, worked: w, delta: delta, open: open, free: free };
    });
  }
  function flexStats() {
    var days = flexDays(), td = today(), y = td.slice(0, 4), mon = F.dkey(monday(new Date()));
    var balance = days.filter(function (d) { return d.date < td || (d.date === td && !d.open); }).reduce(function (a, d) { return a + d.delta; }, 0);
    var t = days.filter(function (d) { return d.date === td; })[0];
    var week = days.filter(function (d) { return d.date >= mon && d.date <= td; });
    var weekWorked = week.reduce(function (a, d) { return a + d.worked; }, 0);
    var wd = Math.min(5, ((new Date().getDay() + 6) % 7) + 1), off = {};
    week.forEach(function (d) { if (d.free) off[d.date] = 1; });
    for (var i = 0; i < wd; i++) { var hk = addDays(mon, i); if (F.holiday(hk)) off[hk] = 1; }
    var weekFree = Object.keys(off).filter(function (k) { var g = F.fromKey(k).getDay(); return g > 0 && g < 6; }).length;
    var weekTarget = Math.max(0, wd - weekFree) * flexCfg().norm * 60;
    var vac = F.list('flex').filter(function (e) { return e.type === 'vacation' && String(e.date).slice(0, 4) === y; }).length;
    var openE = F.list('flex').filter(function (e) { return e.date === td && (e.type === 'work' || e.type === 'course') && e.in && !e.out; })[0];
    return { balance: balance, today: t ? t.worked : 0, open: openE, week: weekWorked, weekTarget: weekTarget, vac: vac };
  }
  function clock() {
    var t = F.tools(), l = Array.isArray(t.flex) ? t.flex : [], td = today();
    var open = l.filter(function (e) { return e.date === td && e.in && !e.out && e.type === 'work'; })[0];
    if (open) open.out = nowHM();
    else l.push({ id: K.uid(), date: td, type: 'work', in: nowHM(), out: '', brk: l.some(function (e) { return e.date === td && e.type === 'work'; }) ? 0 : (+(t.flexcfg || {}).brk || 0) });
    t.flex = l;
    F.saveTools(t);
  }
  function clockBlock(s) {
    return '<div class="flex-clock">' +
      '<div class="fc-now"><span class="fc-dot' + (s.open ? ' on' : '') + '"></span><span>' + (s.open ? 'Clocked in at <b>' + esc(s.open.in) + '</b>' : 'Not clocked in') + '</span></div>' +
      '<b class="fc-time" data-flex-live>' + hm(s.today) + '</b><small>today</small>' +
      '<button type="button" class="pill-btn fc-btn' + (s.open ? ' out' : '') + '" data-flex-clock><i class="bi bi-' + (s.open ? 'stop-fill' : 'play-fill') + '"></i> ' + (s.open ? 'Clock out' : 'Clock in') + '</button></div>';
  }
  var flex = K.collection({
    mount: $t('flex'), feature: 'flex', key: 'flex', title: 'Flex time', icon: 'stopwatch', addLabel: 'Add day',
    addTitle: 'Add a day', editTitle: 'Edit day', limit: 6,
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'type', label: 'Type', type: 'select', options: Object.keys(FLEX_TYPES).map(function (k) { return [k, FLEX_TYPES[k]]; }), def: 'work' },
      { k: 'in', label: 'In', type: 'time' }, { k: 'out', label: 'Out', type: 'time' },
      { k: 'brk', label: 'Unpaid break', type: 'number', suffix: 'min', def: 0, help: 'Only if lunch is not part of your paid time.' },
      { k: 'note', label: 'Note', type: 'textarea', rows: 2 }
    ],
    sort: function (a, b) { return (b.date + (b.in || '')) > (a.date + (a.in || '')) ? 1 : -1; },
    summary: function () {
      var s = flexStats(), c = flexCfg();
      return clockBlock(s) + '<div class="kit-tiles">' +
        tile('Flex balance', '<span class="' + (s.balance < 0 ? 'neg' : 'pos') + '">' + (s.balance > 0 ? '+' : '') + hms(s.balance) + '</span>', 'logged days') +
        tile('This week', hms(s.week), 'of ' + hms(s.weekTarget)) +
        tile('Holiday ' + today().slice(0, 4), s.vac + ' <small>/ ' + c.vacation + '</small>', 'days used') + '</div>';
    },
    row: function (e) {
      var isT = e.date === today(), w = worked(e, isT), lbl = FLEX_TYPES[e.type] || 'Work';
      return { icon: e.type === 'vacation' ? 'sun' : e.type === 'sick' ? 'thermometer-half' : e.type === 'flexoff' ? 'cup-hot' : e.type === 'holiday' ? 'flag' : 'briefcase',
        color: e.type === 'work' || e.type === 'course' ? '#e8743b' : '#7a8794',
        title: fmt(e.date, { weekday: 'short', day: 'numeric', month: 'short' }) + (e.type !== 'work' ? ' · ' + lbl : ''),
        sub: (e.in ? esc(e.in) + '–' + (e.out ? esc(e.out) : 'now') : '') + (e.brk ? ' · ' + e.brk + ' min break' : '') + (e.note ? ' · ' + esc(e.note) : ''),
        right: e.type === 'work' || e.type === 'course' ? hm(w) : '' };
    },
    empty: 'Tap “Clock in” when you start, “Clock out” when you leave. Holidays and flex days off go in with “Add day”.',
    afterRender: function (el) {
      var c = flexCfg();
      el.querySelector('.kit-card').insertAdjacentHTML('beforeend', '<p class="kit-foot">Normal day ' + String(c.norm).replace('.', ',') + ' h · ' + c.vacation + ' holiday days a year · <a href="/cmd/?settings=work">Change</a></p>' +
        '<div class="fr-bar"><span class="muted"><i class="bi bi-file-earmark-text"></i> Monthly report</span><select class="fr-month" aria-label="Month for the report">' + reportMonths() + '</select>' +
        '<button type="button" class="text-btn" data-frcsv>CSV</button><button type="button" class="text-btn" data-frpdf>PDF</button></div>');
    },
    onClick: function (e) {
      if (e.target.closest('[data-flex-clock]')) clock();
      var m = e.target.closest('.kit-card') && e.target.closest('.kit-card').querySelector('.fr-month');
      if (e.target.closest('[data-frcsv]') && m) reportCsv(m.value);
      if (e.target.closest('[data-frpdf]') && m) reportPdf(m.value);
    }
  });

  /* ---------- monthly report: every day, hours, flex and days off – CSV or a printable page (Save as PDF) ---------- */
  function reportMonths() {
    var out = '', d = new Date(), have = {};
    F.list('flex').forEach(function (e) { have[String(e.date).slice(0, 7)] = 1; });
    for (var i = 0; i < 13; i++) {
      var x = new Date(d.getFullYear(), d.getMonth() - i, 1), k = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
      if (i > 0 && !have[k]) continue;
      out += '<option value="' + k + '">' + x.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + '</option>';
    }
    return out;
  }
  function report(ym) {
    var c = flexCfg(), days = flexDays(), inM = days.filter(function (d) { return d.date.slice(0, 7) === ym; });
    var end = ym + '-31', bal = days.filter(function (d) { return d.date <= end && !d.open; }).reduce(function (a, d) { return a + d.delta; }, 0);
    var rows = [];
    inM.forEach(function (d) {
      d.entries.forEach(function (e) {
        rows.push({ date: d.date, wd: F.fromKey(d.date).toLocaleDateString('en-GB', { weekday: 'short' }), type: FLEX_TYPES[e.type] || 'Work', in: e.in || '', out: e.out || '', brk: +e.brk || 0, worked: worked(e, false), note: e.note || '' });
      });
    });
    var tot = inM.reduce(function (a, d) { return a + d.worked; }, 0), delta = inM.reduce(function (a, d) { return a + d.delta; }, 0);
    var count = function (t) { return F.list('flex').filter(function (e) { return e.type === t && String(e.date).slice(0, 7) === ym; }).length; };
    return { ym: ym, name: new Date(ym + '-15').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), rows: rows, total: tot, delta: delta, balance: bal, norm: c.norm,
      vacation: count('vacation'), sick: count('sick'), flexoff: count('flexoff'), days: inM.filter(function (d) { return d.worked > 0; }).length };
  }
  function hmPlain(m) { var s = m < 0 ? '-' : ''; m = Math.abs(Math.round(m)); return s + Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }
  function download(name, type, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function reportCsv(ym) {
    var r = report(ym), q = function (v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['Date', 'Day', 'Type', 'In', 'Out', 'Break (min)', 'Worked (h:mm)', 'Note'].join(';')]
      .concat(r.rows.map(function (x) { return [x.date, x.wd, x.type, x.in, x.out, x.brk, hmPlain(x.worked), x.note].map(q).join(';'); }))
      .concat(['', 'Total worked;' + hmPlain(r.total), 'Flex this month;' + hmPlain(r.delta), 'Flex balance at month end;' + hmPlain(r.balance),
        'Holiday days;' + r.vacation, 'Sick days;' + r.sick, 'Flex days off;' + r.flexoff, 'Normal day (h);' + String(r.norm).replace('.', ',')]);
    download('flex-' + ym + '.csv', 'text/csv;charset=utf-8', '\ufeff' + lines.join('\r\n'));
  }
  function reportPdf(ym) {
    var r = report(ym), me = (function () { try { return JSON.parse(localStorage.getItem('dash.profile')) || {}; } catch (e) { return {}; } })();
    var html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Flex time ' + esc(r.name) + '</title><style>' +
      'body{font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:32px auto;max-width:760px;padding:0 20px}h1{font-size:22px;margin:0 0 2px}p.s{color:#555;margin:0 0 18px}' +
      'table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd}th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#555}td.n{text-align:right;font-variant-numeric:tabular-nums}' +
      '.sum{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.sum div{border:1px solid #ddd;border-radius:8px;padding:10px}.sum b{display:block;font-size:18px}.sum span{font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.04em}' +
      '.tip{color:#555;font-size:12px;margin-top:24px}.wrap{overflow-x:auto}@media (max-width:600px){body{margin:20px auto}th,td{padding:5px 4px;font-size:12px}.sum b{font-size:16px}}@media print{.tip{display:none}body{margin:0 auto}}</style></head><body>' +
      '<h1>Flex time – ' + esc(r.name) + '</h1><p class="s">' + esc(me.name || 'John Paul Lundberg') + (me.employer ? ' · ' + esc(me.employer) : '') + ' · normal day ' + String(r.norm).replace('.', ',') + ' h</p>' +
      '<div class="sum"><div><span>Worked</span><b>' + hmPlain(r.total) + '</b>' + r.days + ' days</div><div><span>Flex this month</span><b>' + (r.delta > 0 ? '+' : '') + hmPlain(r.delta) + '</b>balance ' + (r.balance > 0 ? '+' : '') + hmPlain(r.balance) + '</div>' +
      '<div><span>Days off</span><b>' + r.vacation + '</b>holiday · ' + r.sick + ' sick · ' + r.flexoff + ' flex</div></div>' +
      '<div class="wrap"><table><thead><tr><th>Date</th><th>Type</th><th>In</th><th>Out</th><th class="n">Break</th><th class="n">Worked</th><th>Note</th></tr></thead><tbody>' +
      (r.rows.length ? r.rows.map(function (x) { return '<tr><td>' + esc(x.wd + ' ' + x.date.slice(8) + '.' + x.date.slice(5, 7)) + '</td><td>' + esc(x.type) + '</td><td>' + esc(x.in) + '</td><td>' + esc(x.out) + '</td><td class="n">' + (x.brk ? x.brk + ' min' : '') + '</td><td class="n">' + (x.worked ? hmPlain(x.worked) : '') + '</td><td>' + esc(x.note) + '</td></tr>'; }).join('') : '<tr><td colspan="7">Nothing logged this month.</td></tr>') +
      '</tbody></table></div><p class="tip">Use Print → Save as PDF (on iPhone: Share → Print, then pinch out on the preview to get the PDF).</p>' +
      '<script>setTimeout(function(){try{window.print()}catch(e){}},400)<\/script></body></html>';
    var w = null;
    try { w = window.open('', '_blank'); } catch (e) {}
    if (w && w.document) { w.document.open(); w.document.write(html); w.document.close(); }
    else download('flex-' + ym + '.html', 'text/html;charset=utf-8', html);
  }
  document.addEventListener('change', function (e) {
    var k = e.target.dataset && e.target.dataset.flexcfg;
    if (!k) return;
    var v = K.num(e.target.value);
    if (v == null || v <= 0) return;
    var t = F.tools(); t.flexcfg = t.flexcfg || {}; t.flexcfg[k] = v; F.saveTools(t);
  });
  /* keep the running time fresh */
  setInterval(function () {
    if (!F.on('flex')) return;
    var s = flexStats();
    if (!s.open) return;
    document.querySelectorAll('[data-flex-live]').forEach(function (el) { el.textContent = hm(s.today); });
  }, 30000);

  /* Dashboard card: Work today */
  var home = document.getElementById('flexCard');
  function renderHome() {
    if (!home) return;
    var on = F.on('flex');
    home.hidden = !on;
    if (!on) return;
    var s = flexStats();
    home.innerHTML = '<div class="card-head"><h2><i class="bi bi-stopwatch"></i> Work today</h2><a class="text-btn" href="work/">Details</a></div>' +
      clockBlock(s) + '<p class="fc-bal">Flex balance <b class="' + (s.balance < 0 ? 'neg' : 'pos') + '">' + (s.balance > 0 ? '+' : '') + hm(s.balance) + '</b> · this week ' + hm(s.week) + '</p>';
  }
  if (home) {
    home.addEventListener('click', function (e) { if (e.target.closest('[data-flex-clock]')) clock(); });
    window.addEventListener('tools:change', renderHome);
    window.addEventListener('features:change', renderHome);
    if (window.Vault) window.Vault.onUnlock(renderHome);
  }

  /* ================= WORK: meeting notes ================= */
  K.collection({
    mount: $t('meetings'), feature: 'meetings', key: 'meetings', title: 'Meeting notes', icon: 'people', addLabel: 'New',
    addTitle: 'New meeting note', editTitle: 'Edit meeting note',
    fields: [
      { k: 'title', type: 'title', label: 'Title', ph: 'Meeting, e.g. Status FDVU handover', req: true },
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'who', label: 'With', ph: 'Who was there' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 6 },
      { k: 'actions', label: 'Action points', type: 'textarea', rows: 3, help: 'One per line. Tick them off here or send them to your to-do list.' }
    ],
    beforeSave: function (it) { it.done = it.done || {}; },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    row: function (m) {
      var acts = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); }), done = acts.filter(function (_, i) { return (m.done || {})[i]; }).length;
      return { icon: 'people', color: '#3987e5', title: m.title || 'Meeting', sub: fmt(m.date) + (m.who ? ' · ' + esc(m.who) : '') + (acts.length ? ' · ' + done + '/' + acts.length + ' actions' : ''),
        cls: acts.length && done < acts.length ? 'has-open' : '' };
    },
    detail: function (m) {
      var acts = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); });
      return (m.notes ? '<p class="kit-notes">' + esc(m.notes) + '</p>' : '') +
        (acts.length ? '<ul class="kit-checks">' + acts.map(function (a, i) {
          var d = (m.done || {})[i];
          return '<li class="' + (d ? 'done' : '') + '"><label><input type="checkbox" data-mact="' + esc(m.id) + ':' + i + '"' + (d ? ' checked' : '') + '><span>' + esc(a) + '</span></label>' +
            '<button type="button" class="text-btn" data-mtodo="' + esc(m.id) + ':' + i + '"><i class="bi bi-box-arrow-in-right"></i> To-do</button></li>';
        }).join('') + '</ul>' : '');
    },
    empty: 'Write down what was decided and who does what. Action points can go straight to your to-do list.',
    onClick: function (e, render) {
      var b = e.target.closest('[data-mtodo]');
      if (!b) return;
      var p = b.dataset.mtodo.split(':'), m = F.list('meetings').filter(function (x) { return x.id === p[0]; })[0];
      if (!m) return;
      var text = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); })[+p[1]];
      var todos = readJSON('dash.todos') || [];
      todos.push({ id: K.uid(), text: text.trim() + (m.title ? ' (' + m.title + ')' : ''), done: false });
      writeJSON('dash.todos', todos);
      b.innerHTML = '<i class="bi bi-check2"></i> Added';
      b.disabled = true;
    }
  });
  document.addEventListener('change', function (e) {
    var a = e.target.dataset && e.target.dataset.mact;
    if (!a) return;
    var p = a.split(':'), t = F.tools();
    (t.meetings || []).forEach(function (m) { if (m.id === p[0]) { m.done = m.done || {}; if (e.target.checked) m.done[p[1]] = true; else delete m.done[p[1]]; } });
    F.saveTools(t);
  });

  /* ================= WORK: courses & certificates ================= */
  var KINDS = [['course', 'Course'], ['certificate', 'Certificate'], ['book', 'Book'], ['standard', 'Standard / regulation'], ['other', 'Other']];
  var KIND_ICON = { course: 'mortarboard', certificate: 'award', book: 'book', standard: 'file-earmark-text', other: 'lightbulb' };
  var STATUS = [['planned', 'Planned'], ['progress', 'In progress'], ['done', 'Done']];
  function expiryBadge(k) {
    if (!k) return '';
    var days = Math.round((F.fromKey(k) - F.fromKey(today())) / 864e5);
    if (days < 0) return '<span class="kit-badge bad">Expired</span>';
    if (days < 183) return '<span class="kit-badge warn">Expires ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
    return '<span class="kit-badge">Until ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
  }
  K.collection({
    mount: $t('learning'), feature: 'learning', key: 'learning', title: 'Courses & certificates', icon: 'mortarboard',
    addTitle: 'Add course or certificate',
    fields: [
      { k: 'title', type: 'title', label: 'Title', ph: 'e.g. Varme arbeider, NS 3456, Plania advanced', req: true },
      { k: 'kind', label: 'Type', type: 'select', options: KINDS, def: 'course' },
      { k: 'provider', label: 'From', ph: 'Provider or author' },
      { k: 'status', label: 'Status', type: 'select', options: STATUS, def: 'planned' },
      { k: 'date', label: 'Date', type: 'date', help: 'When you took it or plan to.' },
      { k: 'expires', label: 'Expires', type: 'date', help: 'For certificates that must be renewed – you get a reminder in your calendar 2 months before.' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
    ],
    sort: function (a, b) { var o = { progress: 0, planned: 1, done: 2 }; return (o[a.status] - o[b.status]) || ((b.date || '') > (a.date || '') ? 1 : -1); },
    summary: function (items) {
      var y = today().slice(0, 4);
      var done = items.filter(function (c) { return c.status === 'done' && String(c.date || '').slice(0, 4) === y; }).length;
      var prog = items.filter(function (c) { return c.status === 'progress'; }).length;
      var soon = items.filter(function (c) { return c.expires && c.expires < F.addMonths(today(), 6); }).length;
      return items.length ? '<div class="kit-tiles">' + tile('Done in ' + y, done) + tile('In progress', prog) + tile('Expiring soon', '<span class="' + (soon ? 'neg' : '') + '">' + soon + '</span>', 'within 6 months') + '</div>' : '';
    },
    row: function (c) {
      return { icon: KIND_ICON[c.kind] || 'lightbulb', color: '#8a6fdf', title: c.title, cls: c.status === 'done' ? 'is-done' : '',
        sub: [c.provider ? esc(c.provider) : '', (STATUS.filter(function (s) { return s[0] === c.status; })[0] || ['', ''])[1], c.date ? fmt(c.date, { month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · '),
        right: expiryBadge(c.expires) };
    },
    empty: 'Courses you want to take, certificates that need renewing (like varme arbeider or first aid), and standards you’re reading up on.'
  });

  /* ================= HABITS: training log ================= */
  var SPORTS = [['strength', 'Strength', 'trophy'], ['run', 'Running', 'person-walking'], ['walk', 'Walking', 'person-walking'], ['bike', 'Cycling', 'bicycle'],
    ['swim', 'Swimming', 'water'], ['ball', 'Ball sports', 'dribbble'], ['yoga', 'Yoga / mobility', 'person-arms-up'], ['other', 'Other', 'heart-pulse']];
  var EFFORT = [['1', 'Easy'], ['2', 'Light'], ['3', 'Moderate'], ['4', 'Hard'], ['5', 'All out']];
  function habitOptions() {
    var hb = readJSON('dash.habits') || { list: [] };
    return [['', 'Don’t tick a habit']].concat((hb.list || []).map(function (h) { return [h.id, 'Tick “' + h.name + '”']; }));
  }
  function defaultHabit() {
    var hb = readJSON('dash.habits') || { list: [] };
    var h = (hb.list || []).filter(function (x) { return /train|trening|gym|workout|løp|run|exercise/i.test(x.name); })[0];
    return h ? h.id : '';
  }
  K.collection({
    mount: $t('training'), feature: 'training', key: 'training', title: 'Training log', icon: 'heart-pulse', addLabel: 'Log workout',
    addTitle: 'Log a workout', editTitle: 'Edit workout',
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'kind', label: 'Type', type: 'select', options: SPORTS.map(function (s) { return [s[0], s[1]]; }), def: 'strength' },
      { k: 'min', label: 'Time', type: 'number', suffix: 'min', req: true, def: 60 },
      { k: 'km', label: 'Distance', type: 'number', suffix: 'km' },
      { k: 'effort', label: 'How hard', type: 'select', options: EFFORT, def: '3' },
      { k: 'habit', label: 'Habit', type: 'select', options: habitOptions, def: defaultHabit },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, help: 'Exercises, weights, how it felt.' }
    ],
    afterSave: function (w) {
      if (!w.habit) return;
      var hb = readJSON('dash.habits') || { list: [], log: {} };
      hb.log = hb.log || {};
      var l = hb.log[w.date] = hb.log[w.date] || [];
      if (l.indexOf(w.habit) < 0) { l.push(w.habit); writeJSON('dash.habits', hb); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
    },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    summary: function (items) {
      var mon = F.dkey(monday(new Date())), m = today().slice(0, 7);
      var wk = items.filter(function (w) { return w.date >= mon; }), mo = items.filter(function (w) { return String(w.date).slice(0, 7) === m; });
      var sum = function (l, k) { return l.reduce(function (a, w) { return a + (+w[k] || 0); }, 0); };
      return '<div class="kit-tiles">' + tile('This week', wk.length + ' <small>sessions</small>', hms(sum(wk, 'min'))) +
        tile('This month', mo.length + ' <small>sessions</small>', hms(sum(mo, 'min'))) +
        tile('Distance this month', (Math.round(sum(mo, 'km') * 10) / 10).toString().replace('.', ',') + ' <small>km</small>') + '</div>';
    },
    row: function (w) {
      var s = SPORTS.filter(function (x) { return x[0] === w.kind; })[0] || SPORTS[7];
      return { icon: s[2], color: '#d55181', title: s[1], sub: fmt(w.date, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + hm(+w.min || 0) + (w.km ? ' · ' + String(w.km).replace('.', ',') + ' km' : '') + (w.notes ? ' · ' + esc(String(w.notes).slice(0, 60)) : ''),
        right: '<span class="kit-dots">' + [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= +w.effort ? 'on' : '') + '"></i>'; }).join('') + '</span>' };
    },
    empty: 'Log a workout and it also ticks your training habit for that day.'
  });

  /* ================= HEALTH: check-ups, vaccines, medicine ================= */
  var HKINDS = [['checkup', 'Appointment / check-up'], ['vaccine', 'Vaccine'], ['medicine', 'Medicine / prescription']];
  var HICON = { checkup: 'clipboard2-pulse', vaccine: 'shield-plus', medicine: 'capsule' };
  var HNEXT = { checkup: 'Next check-up', vaccine: 'Booster due', medicine: 'Renew by' };
  function dueBadge(k, word) {
    if (!k) return '';
    var days = Math.round((F.fromKey(k) - F.fromKey(today())) / 864e5);
    if (days < 0) return '<span class="kit-badge bad">' + word + ' overdue</span>';
    if (days <= 60) return '<span class="kit-badge warn">' + word + ' ' + fmt(k, { day: 'numeric', month: 'short' }) + '</span>';
    return '<span class="kit-badge">' + word + ' ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
  }
  K.collection({
    mount: $t('health'), feature: 'health', key: 'health', title: 'Check-ups & medicine', icon: 'clipboard2-pulse',
    addTitle: 'Add to health', editTitle: 'Edit',
    fields: [
      { k: 'title', type: 'title', label: 'What', ph: 'e.g. Dentist, Tetanus booster, Allergy pills', req: true },
      { k: 'kind', label: 'Type', type: 'select', options: HKINDS, def: 'checkup' },
      { k: 'date', label: 'Date', type: 'date', def: today, help: 'The appointment, when you took the vaccine, or when it was prescribed.' },
      { k: 'time', label: 'Time', type: 'time', help: 'For appointments – it goes in your calendar.' },
      { k: 'where', label: 'Where / who', ph: 'Clinic, doctor, pharmacy' },
      { k: 'next', label: 'Next / renew by', type: 'date', help: 'Next check-up, when a booster is due, or when the prescription runs out. You get a reminder in your calendar.' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, help: 'Dose, what was said, questions for next time …' }
    ],
    sort: function (a, b) {
      var ka = a.kind === 'checkup' && a.date >= today() ? a.date : (a.next || '9999'), kb = b.kind === 'checkup' && b.date >= today() ? b.date : (b.next || '9999');
      return ka > kb ? 1 : ka < kb ? -1 : 0;
    },
    summary: function (items) {
      if (!items.length) return '';
      var td = today();
      var up = items.filter(function (h) { return h.kind === 'checkup' && h.date >= td; }).sort(function (a, b) { return a.date > b.date ? 1 : -1; })[0];
      var due = items.filter(function (h) { return h.next && h.next <= F.addMonths(td, 2); }).length;
      var vac = items.filter(function (h) { return h.kind === 'vaccine'; }).length;
      return '<div class="kit-tiles">' + tile('Next appointment', up ? fmt(up.date, { weekday: 'short', day: 'numeric', month: 'short' }) : '–', up ? esc(up.title) + (up.time ? ' · ' + esc(up.time) : '') : 'nothing booked') +
        tile('Due soon', '<span class="' + (due ? 'neg' : '') + '">' + due + '</span>', 'within 2 months') + tile('Vaccines', vac, 'on record') + '</div>';
    },
    row: function (h) {
      var past = h.kind === 'checkup' && h.date && h.date < today();
      return { icon: HICON[h.kind] || 'clipboard2-pulse', color: '#e66767', title: h.title,
        sub: [{ checkup: 'Check-up', vaccine: 'Vaccine', medicine: 'Medicine' }[h.kind] || '', h.date ? fmt(h.date) + (h.time && !past ? ' ' + esc(h.time) : '') : '', h.where ? esc(h.where) : ''].filter(Boolean).join(' · '),
        right: dueBadge(h.next, h.kind === 'medicine' ? 'Renew' : h.kind === 'vaccine' ? 'Booster' : 'Next') };
    },
    empty: 'Doctor and dentist appointments, vaccines (useful before trips) and prescriptions. You get reminders in your calendar before things are due.'
  });

  /* ================= HABITS: journal ================= */
  var MOODS = [['1', 'Bad', 'emoji-frown', '#e66767'], ['2', 'Meh', 'emoji-neutral', '#e8743b'], ['3', 'OK', 'emoji-smile', '#c9a227'], ['4', 'Good', 'emoji-laughing', '#22b35e'], ['5', 'Great', 'emoji-heart-eyes', '#14b8a6']];
  function mood(v) { return MOODS.filter(function (m) { return m[0] === String(v); })[0] || MOODS[2]; }
  K.collection({
    mount: $t('journal'), feature: 'journal', key: 'journal', title: 'Journal', icon: 'journal-bookmark', addLabel: 'Today',
    addTitle: 'Journal', editTitle: 'Journal', limit: 7,
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'mood', label: 'Mood', type: 'select', options: MOODS.map(function (m) { return [m[0], m[1]]; }), def: '4' },
      { k: 'line', type: 'title', label: 'Today in one line', ph: 'Today in one sentence', req: true, max: 200 },
      { k: 'notes', label: 'More (optional)', type: 'textarea', rows: 4 }
    ],
    beforeSave: function (it) {    /* one entry per day */
      var t = F.tools();
      t.journal = (t.journal || []).filter(function (x) { return x.date !== it.date || x.id === it.id; });
      F.saveTools(t);
    },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    summary: function (items) {
      var by = {}; items.forEach(function (j) { by[j.date] = j; });
      var cells = '', t = today();
      for (var i = 27; i >= 0; i--) {
        var k = addDays(t, -i), j = by[k];
        cells += '<i title="' + fmt(k, { weekday: 'short', day: 'numeric', month: 'short' }) + (j ? ': ' + mood(j.mood)[1] : '') + '" style="' + (j ? 'background:' + mood(j.mood)[3] : '') + '"></i>';
      }
      var streak = 0; for (var d = 0; d < 400; d++) { if (by[addDays(t, -d)]) streak++; else if (d > 0) break; }
      var last7 = items.filter(function (j) { return j.date > addDays(t, -7); });
      var avg = last7.length ? last7.reduce(function (a, j) { return a + (+j.mood || 0); }, 0) / last7.length : 0;
      return '<div class="kit-mood">' + cells + '</div><p class="kit-moodlbl">Last 4 weeks' + (streak ? ' · ' + streak + ' day' + (streak > 1 ? 's' : '') + ' in a row' : '') + (avg ? ' · this week: ' + mood(Math.round(avg))[1].toLowerCase() : '') + '</p>';
    },
    row: function (j) { var m = mood(j.mood); return { icon: m[2], color: m[3], title: j.line, sub: fmt(j.date, { weekday: 'long', day: 'numeric', month: 'short' }) + (j.notes ? ' · ' + esc(String(j.notes).slice(0, 70)) : '') }; },
    empty: 'One line a day is enough. Over time you’ll see how your weeks really were.'
  });

  /* ================= TRAVEL: places to visit ================= */
  K.collection({
    mount: $t('bucket'), feature: 'bucket', key: 'bucket', title: 'Places to visit', icon: 'pin-map',
    addTitle: 'A place you want to visit',
    fields: [
      { k: 'place', type: 'title', label: 'Place', ph: 'City or place, e.g. Lisbon', req: true },
      { k: 'notes', label: 'Why / what to do', type: 'textarea', rows: 3 },
      { k: 'visited', label: 'Been there', type: 'check' }
    ],
    afterSave: function (it) {      /* find it on the map */
      if (!window.World || (it.geo && it.geo.q === it.place)) return;
      window.World.search(it.place).then(function (l) {
        if (!l || !l[0]) return;
        var t = F.tools();
        (t.bucket || []).forEach(function (x) { if (x.id === it.id) x.geo = Object.assign({ q: it.place }, l[0]); });
        F.saveTools(t);
      }).catch(function () {});
    },
    sort: function (a, b) { return (a.visited ? 1 : 0) - (b.visited ? 1 : 0) || (a.place > b.place ? 1 : -1); },
    summary: function (items) {
      var v = items.filter(function (x) { return x.visited; }).length;
      return items.length ? '<p class="kit-moodlbl">' + items.length + ' place' + (items.length > 1 ? 's' : '') + ' · ' + v + ' visited · they show on the map under History</p>' : '';
    },
    row: function (b) { return { icon: b.visited ? 'check-circle-fill' : 'pin-map', color: b.visited ? '#22b35e' : '#0891b2', title: b.place, cls: b.visited ? 'is-done' : '', sub: [b.geo ? esc(b.geo.country) : '', b.notes ? esc(String(b.notes).slice(0, 70)) : ''].filter(Boolean).join(' · ') }; },
    detail: function (b) {
      return (b.notes ? '<p class="kit-notes">' + esc(b.notes) + '</p>' : '') +
        (b.visited ? '' : '<span class="kit-acts"><button type="button" class="text-btn" data-plantrip="' + esc(b.id) + '"><i class="bi bi-suitcase-lg"></i> Plan a trip</button>' +
          (window.World ? '<a class="text-btn" href="' + esc(window.World.flightsLink((b.geo && b.geo.name) || b.place)) + '" target="_blank" rel="noopener"><i class="bi bi-airplane"></i> Flight prices</a>' : '') + '</span>');
    },
    empty: 'Cities and places you want to see. Turn one into a trip when you’re ready.',
    onClick: function (e) {
      var b = e.target.closest('[data-plantrip]');
      if (!b || !window.Flow) return;
      var it = F.list('bucket').filter(function (x) { return x.id === b.dataset.plantrip; })[0];
      if (!it) return;
      var tr = window.Flow.travel(), start = F.addMonths(today(), 1);
      var trip = { id: K.uid(), name: it.place, dest: it.geo ? it.geo.name : it.place, start: start, end: addDays(start, 3), items: [], pack: [], notes: it.notes || '' };
      if (it.geo) trip.place = { name: it.geo.name, region: it.geo.region, country: it.geo.country, cc: it.geo.cc, lat: it.geo.lat, lon: it.geo.lon, tz: it.geo.tz };
      tr.trips.push(trip);
      window.Flow.saveTravel(tr);
      location.href = '/cmd/travel/#trip=' + trip.id;
    }
  });

  /* ================= FINANCE: subscriptions ================= */
  var PERIODS = [['monthly', 'Every month'], ['quarterly', 'Every 3 months'], ['yearly', 'Every year']];
  var PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  var SUB_CATS = [['streaming', 'Streaming & music'], ['software', 'Apps & software'], ['phone', 'Phone & internet'], ['training', 'Training'], ['news', 'News & magazines'], ['insurance', 'Insurance'], ['other', 'Other']];
  K.collection({
    mount: $t('subs'), feature: 'subs', key: 'subs', title: 'Subscriptions', icon: 'arrow-repeat',
    addTitle: 'Add subscription', editTitle: 'Edit subscription',
    fields: [
      { k: 'name', type: 'title', label: 'Name', ph: 'e.g. Spotify, iCloud+, SATS', req: true },
      { k: 'amount', label: 'Price', type: 'number', suffix: 'kr', req: true },
      { k: 'period', label: 'Paid', type: 'select', options: PERIODS, def: 'monthly' },
      { k: 'renews', label: 'Next payment', type: 'date', req: true, def: today, help: 'It shows in your calendar every time it renews.' },
      { k: 'cat', label: 'Category', type: 'select', options: SUB_CATS, def: 'streaming' },
      { k: 'paused', label: 'Paused / cancelled', type: 'check' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'e.g. how to cancel, or the account it’s on.' }
    ],
    sort: function (a, b) { return (a.paused ? 1 : 0) - (b.paused ? 1 : 0) || (F.nextRenewal(a) > F.nextRenewal(b) ? 1 : -1); },
    summary: function (items) {
      var act = items.filter(function (s) { return !s.paused; });
      var m = act.reduce(function (a, s) { return a + (+s.amount || 0) * (PER_MONTH[s.period] || 1); }, 0);
      var next = act.slice().sort(function (a, b) { return F.nextRenewal(a) > F.nextRenewal(b) ? 1 : -1; })[0];
      return items.length ? '<div class="kit-tiles">' + tile('Per month', kr(m)) + tile('Per year', kr(m * 12)) +
        (next ? tile('Next', esc(next.name), fmt(F.nextRenewal(next), { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</div>' : '';
    },
    row: function (s) {
      var per = { monthly: '/ month', quarterly: '/ 3 months', yearly: '/ year' }[s.period] || '';
      return { icon: 'arrow-repeat', color: '#11a597', title: s.name, cls: s.paused ? 'is-done' : '',
        sub: kr(+s.amount) + ' ' + per + (s.paused ? ' · paused' : ' · next ' + fmt(F.nextRenewal(s), { day: 'numeric', month: 'short' })),
        right: s.period !== 'monthly' && !s.paused ? '<small class="muted">' + kr((+s.amount || 0) * (PER_MONTH[s.period] || 1)) + '/mo</small>' : '' };
    },
    empty: 'Streaming, apps, phone, gym … see what it all costs per month and year, and get a reminder before each payment.'
  });

  /* ================= FINANCE: warranties & receipts ================= */
  K.collection({
    mount: $t('warranty'), feature: 'warranty', key: 'warranty', title: 'Warranties & receipts', icon: 'receipt-cutoff',
    addTitle: 'Add a purchase', editTitle: 'Edit purchase',
    fields: [
      { k: 'item', type: 'title', label: 'What', ph: 'e.g. MacBook Air, washing machine', req: true },
      { k: 'store', label: 'Store', ph: 'Where you bought it' },
      { k: 'bought', label: 'Bought', type: 'date', req: true, def: today },
      { k: 'price', label: 'Price', type: 'number', suffix: 'kr' },
      { k: 'years', label: 'Complaint period', type: 'select', def: '2', options: [['2', '2 years (most things)'], ['5', '5 years (meant to last: phone, PC, white goods…)'], ['1', '1 year'], ['3', '3 years']],
        help: 'In Norway you can complain (reklamere) for 2 years, or 5 years for things meant to last much longer.' },
      { k: 'receipt', label: 'Receipt', ph: 'Where it is, e.g. email, Vipps, folder' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'Serial number, model, insurance …' }
    ],
    sort: function (a, b) { return F.warrantyEnd(a) > F.warrantyEnd(b) ? 1 : -1; },
    summary: function (items) {
      var td = today(), act = items.filter(function (w) { return F.warrantyEnd(w) >= td; });
      var soon = act.filter(function (w) { return F.warrantyEnd(w) < F.addMonths(td, 3); }).length;
      var val = act.reduce(function (a, w) { return a + (+w.price || 0); }, 0);
      return items.length ? '<div class="kit-tiles">' + tile('Covered', act.length, 'things still under warranty') + tile('Ending soon', '<span class="' + (soon ? 'neg' : '') + '">' + soon + '</span>', 'within 3 months') + tile('Value covered', kr(val)) + '</div>' : '';
    },
    row: function (w) {
      var end = F.warrantyEnd(w), over = end < today();
      return { icon: 'receipt-cutoff', color: '#c98500', title: w.item, cls: over ? 'is-done' : '',
        sub: [w.store ? esc(w.store) : '', fmt(w.bought), w.price ? kr(+w.price) : '', w.receipt ? 'receipt: ' + esc(w.receipt) : ''].filter(Boolean).join(' · '),
        right: over ? '<span class="kit-badge">Ended</span>' : expiryBadge(end).replace('Until', 'Until').replace('Expires', 'Ends') };
    },
    empty: 'Keep track of what you bought, where the receipt is, and when you can no longer complain. You get a reminder in your calendar.'
  });

  /* Work page with nothing switched on */
  var wkEmpty = document.getElementById('wkEmpty');
  function workEmpty() { if (wkEmpty) wkEmpty.hidden = F.on('work'); }
  if (wkEmpty) { window.addEventListener('features:change', workEmpty); workEmpty(); }
})();
} catch (e) { console.error("tools.js", e); }
/* ===== profile.js ===== */
try {
/* Your profile: photo, details you use across the dashboard, and your socials.
   Stored in "dash.profile" (synced and encrypted with your passcode).
   - the avatar in the top corner opens Profile & settings
   - home and office address become Home / Work in Travel
   - normal working day is the one Flex time uses
   - your birthday goes in the calendar
   - socials you mark as public can be published to jplundberg.com */
(function () {
  "use strict";
  var KEY = 'dash.profile';
  var $ = function (id) { return document.getElementById(id); };
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var NETS = {
    linkedin: { name: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/{h}/', host: 'linkedin.com' },
    instagram: { name: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/{h}/', host: 'instagram.com' },
    facebook: { name: 'Facebook', icon: 'facebook', url: 'https://www.facebook.com/{h}', host: 'facebook.com' },
    tiktok: { name: 'TikTok', icon: 'tiktok', url: 'https://www.tiktok.com/@{h}', host: 'tiktok.com' },
    x: { name: 'X', icon: 'twitter-x', url: 'https://x.com/{h}', host: 'x.com' },
    threads: { name: 'Threads', icon: 'threads', url: 'https://www.threads.net/@{h}', host: 'threads.net' },
    youtube: { name: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com/@{h}', host: 'youtube.com' },
    snapchat: { name: 'Snapchat', icon: 'snapchat', url: 'https://www.snapchat.com/add/{h}', host: 'snapchat.com' },
    strava: { name: 'Strava', icon: 'strava', url: 'https://www.strava.com/athletes/{h}', host: 'strava.com' },
    github: { name: 'GitHub', icon: 'github', url: 'https://github.com/{h}', host: 'github.com' }
  };
  /* the two already on jplundberg.com */
  var START_SOCIALS = [
    { net: 'linkedin', handle: 'john-paul-lundberg-8a804623b', pub: true },
    { net: 'instagram', handle: 'jp.lundberg.official', pub: true }
  ];
  function socialUrl(s) {
    var N = NETS[s.net], h = String(s.handle || '').trim();
    if (!N || !h) return '';
    if (/^https:\/\//i.test(h)) {
      try { var u = new URL(h); return (u.hostname === N.host || u.hostname.slice(-N.host.length - 1) === '.' + N.host) ? u.href : ''; } catch (e) { return ''; }
    }
    h = h.replace(/^@/, '').replace(/[^\w.\-]/g, '');
    return h ? N.url.replace('{h}', h) : '';
  }

  function load() {
    var p = readJSON(KEY);
    p = p && typeof p === 'object' ? p : {};
    if (!Array.isArray(p.socials)) {
      p.socials = START_SOCIALS.map(function (s) { return Object.assign({ id: uid() }, s); });
      if (window.Vault && document.documentElement.classList.contains('unlocked')) {      /* keep the same ids from now on */
        try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
      }
    }
    return p;
  }
  function save(p) {
    var before = null;
    try { before = JSON.stringify((JSON.parse(localStorage.getItem(KEY)) || {}).socials || null); } catch (e) {}
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));
    window.dispatchEvent(new Event('profile:change'));
    if (before !== JSON.stringify(p.socials || null)) window.dispatchEvent(new Event('socials:change'));
  }
  function initials(p) {
    var n = String(p.name || (readJSON('dash.settings') || {}).name || '').trim().split(/\s+/).filter(Boolean);
    return n.length ? (n[0][0] + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase() : '';
  }
  function avatar(p, cls) {
    p = p || load();
    return '<span class="me-av ' + (cls || '') + '">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="">' :
      (initials(p) ? '<b>' + esc(initials(p)) + '</b>' : '<i class="bi bi-person"></i>')) + '</span>';
  }
  function age(k) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k || '')) return null;
    var b = k.split('-').map(Number), t = new Date(), a = t.getFullYear() - b[0];
    if (t.getMonth() + 1 < b[1] || (t.getMonth() + 1 === b[1] && t.getDate() < b[2])) a--;
    return a;
  }

  /* ---------- the avatar button(s) ---------- */
  function paintButtons() {
    var p = load();
    document.querySelectorAll('[data-me]').forEach(function (b) { b.innerHTML = avatar(p); });
  }
  /* other pages: a small avatar in the top corner that opens Profile & settings */
  var main = $('fp');
  if (main && !$('settingsBtn')) {
    var a = document.createElement('a');
    a.className = 'me-btn me-sub'; a.href = '/cmd/?settings'; a.setAttribute('data-me', '');
    a.addEventListener('click', function () { try { sessionStorage.setItem('dash.stFrom', location.pathname); } catch (e) {} });
    a.setAttribute('aria-label', 'Profile and settings');
    /* in the page's top row (same height as on the dashboard, below the iPhone status bar) */
    var host = document.querySelector('#fp > .fp-top');
    if (host) { a.classList.add('me-in'); host.appendChild(a); } else document.body.appendChild(a);
  }
  window.addEventListener('profile:change', paintButtons);
  if (window.Vault) window.Vault.onUnlock(paintButtons);
  paintButtons();

  /* the links that should be on jplundberg.com (switched on, with a valid address) */
  function publicSocials() {
    return load().socials.filter(function (s) { return s.pub && socialUrl(s); }).map(function (s) { return { net: s.net, url: socialUrl(s) }; });
  }
  /* Undo on the Socials page: back to what's live */
  function resetSocials(live) {
    if (!Array.isArray(live)) return;
    var p = load(), used = {};
    p.socials.forEach(function (s) { var u = socialUrl(s); s.pub = live.some(function (l) { return l.url === u; }); used[u] = 1; });
    live.forEach(function (l) { if (!used[l.url]) p.socials.push({ id: uid(), net: l.net, handle: l.url, pub: true }); });
    save(p);
    window.dispatchEvent(new Event('socials:reset'));
  }
  window.Profile = { load: load, save: save, avatar: avatar, NETS: NETS, socialUrl: socialUrl, age: age, publicSocials: publicSocials, resetSocials: resetSocials };

  /* ---------- Health page: medical info card ---------- */
  var med = $('meHealth');
  function renderMed() {
    if (!med) return;
    var p = load(), rows = [['GP (fastlege)', p.gp], ['Blood type', p.blood], ['Allergies', p.allergies], ['Medicines', p.meds]].filter(function (r) { return r[1]; });
    var ice = p.iceName ? esc(p.iceName) + (p.iceRel ? ' (' + esc(p.iceRel) + ')' : '') + (p.icePhone ? ' · <a href="tel:' + esc(p.icePhone.replace(/\s/g, '')) + '">' + esc(p.icePhone) + '</a>' : '') : '';
    med.hidden = !rows.length && !ice;
    med.innerHTML = '<div class="card-head"><h2><i class="bi bi-person-vcard"></i> Medical info</h2><a class="text-btn" href="/cmd/?settings=profile">Edit</a></div>' +
      '<dl class="me-dl">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') +
      (ice ? '<dt>Emergency contact</dt><dd>' + ice + '</dd>' : '') + '</dl>';
  }
  /* Travel page: emergency contact under travel documents */
  var docs = $('tpDocsCard');
  function renderIce() {
    if (!docs) return;
    var p = load(), el = $('meIce');
    if (!el) { el = document.createElement('p'); el.id = 'meIce'; el.className = 'me-ice'; docs.appendChild(el); }
    el.hidden = !p.iceName;
    el.innerHTML = p.iceName ? '<i class="bi bi-telephone"></i> Emergency contact: <b>' + esc(p.iceName) + '</b>' + (p.iceRel ? ' (' + esc(p.iceRel) + ')' : '') +
      (p.icePhone ? ' · <a href="tel:' + esc(p.icePhone.replace(/\s/g, '')) + '">' + esc(p.icePhone) + '</a>' : '') : '';
  }
  [renderMed, renderIce].forEach(function (fn) {
    window.addEventListener('profile:change', fn);
    if (window.Vault) window.Vault.onUnlock(fn);
  });

  /* ---------- Profile & settings panel (dashboard only) ---------- */
  var head = $('stProfile'), box = $('meBox'), soBox = $('soBox');
  var area = box && (box.closest('.st-panel') || box);     // profile and socials pages share the handlers below
  if (!head || !box) return;

  function renderHead() {
    var p = load(), F = window.Features, sub = [p.role, p.employer].filter(Boolean).join(' · ');
    head.innerHTML = avatar(p, 'lg') + '<span class="st-label"><b>' + esc(p.name || 'Your profile') + '</b><small>' +
      esc(sub || 'Your details and photo – private') + '</small></span><i class="bi bi-chevron-right"></i>';
  }

  var FIELDS = [
    { sec: 'About you', icon: 'person', rows: [
      ['name', 'Name', 'text', 'Full name'], ['birthday', 'Birthday', 'date'], ['phone', 'Phone', 'tel', '+47'], ['email', 'Email', 'email', 'you@example.com'],
      ['city', 'City', 'text', 'Oslo']] },
    { sec: 'Home', icon: 'house-door', rows: [['home', 'Address', 'place', 'Search for your address', 'home']],
      note: 'Becomes “Home” in Travel, so departures and “leave by” start from here.' },
    { sec: 'Work', icon: 'briefcase', rows: [['employer', 'Employer', 'text', 'Company'], ['role', 'Role', 'text', 'Job title'],
      ['office', 'Office', 'place', 'Search for the office address', 'work'], ['norm', 'Normal working day', 'hours']],
      note: 'The office becomes “Work” in Travel. The working day is what Flex time counts against.' },
    { sec: 'Emergency contact', icon: 'telephone', rows: [['iceName', 'Name', 'text'], ['iceRel', 'Relation', 'text', 'e.g. Mother, partner'], ['icePhone', 'Phone', 'tel']],
      note: 'Shown with your travel documents and on the Health page.' },
    { sec: 'Health', icon: 'heart-pulse', rows: [['gp', 'GP (fastlege)', 'text', 'Name and clinic'],
      ['blood', 'Blood type', 'select', ['', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', '0+', '0−']], ['allergies', 'Allergies', 'text', 'None'], ['meds', 'Medicines', 'text', 'Anything you take regularly']] },
    { sec: 'Sizes', icon: 'rulers', rows: [['sizeTop', 'Shirts & jackets', 'text', 'M'], ['sizeBottom', 'Trousers', 'text', '32/32'], ['sizeShoe', 'Shoes', 'text', '43'], ['sizeOther', 'Other', 'text', 'Ring, hat …']] }
  ];

  function travelPlace(k) { return window.Flow ? (window.Flow.travel().places || {})[k] : null; }
  function flexNorm() { return window.Features ? +((window.Features.tools().flexcfg || {}).norm) || 7.5 : 7.5; }

  function render() {
    renderSocials();
    var p = load();
    var photo = '<div class="me-photo">' + avatar(p, 'xl') + '<div><button type="button" class="pill-btn" id="mePick"><i class="bi bi-camera"></i> ' + (p.photo ? 'Change photo' : 'Add photo') + '</button>' +
      (p.photo ? '<button type="button" class="text-btn danger" id="meNoPhoto">Remove</button>' : '') +
      '<p class="st-note">' + (p.birthday && age(p.birthday) != null ? age(p.birthday) + ' years · ' : '') + 'Saved encrypted, only for you.</p></div>' +
      '<input type="file" id="meFile" accept="image/*" hidden></div>';
    var secs = FIELDS.map(function (S) {
      return '<p class="st-sub"><i class="bi bi-' + S.icon + '"></i> ' + S.sec + '</p><section class="st-group">' + S.rows.map(function (r) {
        var k = r[0], v = p[k], ph = typeof r[3] === 'string' ? ' placeholder="' + esc(r[3]) + '"' : '';
        var input;
        if (r[2] === 'place') {
          var tp = travelPlace(r[4]);
          input = '<span class="ps-wrap me-place"><input data-mplace="' + k + '" data-tp="' + r[4] + '" value="' + esc((tp && tp.name) || (p[k] && p[k].name) || '') + '"' + ph + ' aria-label="' + r[1] + '"></span>';
        } else if (r[2] === 'select') {
          input = '<select class="st-select" data-mk="' + k + '">' + r[3].map(function (o) { return '<option' + (o === (v || '') ? ' selected' : '') + ' value="' + o + '">' + (o || '–') + '</option>'; }).join('') + '</select>';
        } else if (r[2] === 'hours') {
          input = '<span class="me-hours"><input data-mnorm inputmode="decimal" value="' + String(flexNorm()).replace('.', ',') + '" aria-label="Normal working day in hours"> h</span>';
        } else {
          input = '<input class="st-input" type="' + r[2] + '" data-mk="' + k + '" value="' + esc(v || '') + '"' + ph + ' maxlength="120" aria-label="' + r[1] + '">';
        }
        return '<label class="st-row me-row"><span>' + r[1] + '</span>' + input + '</label>';
      }).join('') + '</section>' + (S.note ? '<p class="st-note me-note">' + S.note + '</p>' : '');
    }).join('');
    box.innerHTML = '<p class="me-private"><i class="bi bi-lock"></i><span><b>Private.</b> Only you see this – nothing here is shown on jplundberg.com. What’s public is under Settings → jplundberg.com.</span></p>' + photo + secs +
      '<p class="st-sub"><i class="bi bi-pencil"></i> Notes</p><section class="st-group"><textarea class="me-notes" data-mk="notes" rows="3" maxlength="2000" placeholder="Anything else you want to keep handy">' + esc(p.notes || '') + '</textarea></section>';
    if (window.Places) box.querySelectorAll('[data-mplace]').forEach(function (inp) {
      window.Places.field(inp, { onPick: function (pl) {
        if (!pl) return;
        var q = load(), plain = { id: pl.id || '', name: pl.name, sub: pl.sub || '', lat: pl.lat, lon: pl.lon, stop: !!pl.stop };
        q[inp.dataset.mplace] = plain; save(q);
        if (window.Flow) { var t = window.Flow.travel(); t.places = t.places || {}; t.places[inp.dataset.tp] = plain; window.Flow.saveTravel(t); }
        flash(inp);
      } });
    });
  }
  function flash(el) { var row = el.closest('.st-row'); if (!row) return; row.classList.add('me-saved'); setTimeout(function () { row.classList.remove('me-saved'); }, 900); }

  /* ---------- socials ---------- */
  var pubMsg = '';
  function renderSocials() { if (soBox) soBox.innerHTML = socialsHtml(load()); }
  window.addEventListener('socials:reset', renderSocials);
  function socialsHtml(p) {
    var opts = function (cur) { return Object.keys(NETS).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + NETS[k].name + '</option>'; }).join(''); };
    return '<p class="st-sub"><i class="bi bi-share"></i> Your profiles <span class="st-hint">Username or link. The switch decides if it’s shown on jplundberg.com</span></p>' +
      '<section class="st-group me-socials">' + p.socials.map(function (s) {
        var url = socialUrl(s), N = NETS[s.net] || NETS.linkedin;
        return '<div class="st-row me-soc" data-sid="' + esc(s.id) + '">' +
          '<span class="me-soc-ic"><i class="bi bi-' + N.icon + '"></i></span>' +
          '<select class="me-soc-net" data-snet aria-label="Network">' + opts(s.net) + '</select>' +
          '<input class="me-soc-h" data-shandle value="' + esc(s.handle || '') + '" placeholder="username" maxlength="200" aria-label="' + N.name + ' username or link" spellcheck="false" autocapitalize="off">' +
          '<a class="icon-btn me-soc-open" href="' + esc(url || '#') + '"' + (url ? '' : ' hidden') + ' target="_blank" rel="noopener" aria-label="Open ' + N.name + '"><i class="bi bi-box-arrow-up-right"></i></a>' +
          '<input type="checkbox" class="switch" data-spub' + (s.pub ? ' checked' : '') + ' aria-label="Show ' + N.name + ' on jplundberg.com">' +
          '<button type="button" class="text-btn danger me-soc-del" data-sdel aria-label="Remove"><i class="bi bi-x-lg"></i></button></div>';
      }).join('') +
      (p.socials.length < 10 ? '<button type="button" class="st-row st-btn cs-add" data-sadd><span><i class="bi bi-plus-lg"></i> Add social</span></button>' : '') +
      '</section>';
  }
  /* ---------- editing ---------- */
  var timer = null;
  area.addEventListener('input', function (e) {
    var t = e.target, k = t.dataset.mk;
    if (k) {
      clearTimeout(timer);
      timer = setTimeout(function () { var p = load(); p[k] = t.value.trim().slice(0, k === 'notes' ? 2000 : 120); save(p); renderHead(); }, 350);
    }
    if (t.hasAttribute('data-shandle')) {
      var p2 = load(), id = t.closest('[data-sid]').dataset.sid;
      var link = t.closest('[data-sid]').querySelector('.me-soc-open');
      p2.socials.forEach(function (s) {
        if (s.id !== id) return;
        s.handle = t.value.trim().slice(0, 200);
        var u = socialUrl(s); link.hidden = !u; link.href = u || '#';
      });
      save(p2);
    }
  });
  area.addEventListener('change', function (e) {
    var t = e.target, p = load(), row = t.closest('[data-sid]');
    if (t.dataset.mk) { p[t.dataset.mk] = t.value.trim(); save(p); flash(t); renderHead(); return; }
    if (t.hasAttribute('data-mnorm') && window.Features) {
      var n = parseFloat(t.value.replace(',', '.'));
      if (n > 0 && n < 16) { var tl = window.Features.tools(); tl.flexcfg = tl.flexcfg || {}; tl.flexcfg.norm = n; window.Features.saveTools(tl); flash(t); }
      return;
    }
    if (row) {
      p.socials.forEach(function (s) {
        if (s.id !== row.dataset.sid) return;
        if (t.hasAttribute('data-snet')) s.net = t.value;
        if (t.hasAttribute('data-spub')) s.pub = t.checked;
      });
      save(p);
      if (t.hasAttribute('data-snet')) render();
    }
  });
  area.addEventListener('click', function (e) {
    var p;
    if (e.target.closest('#mePick')) return $('meFile').click();
    if (e.target.closest('#meNoPhoto')) { p = load(); delete p.photo; save(p); render(); renderHead(); return; }
    if (e.target.closest('[data-sadd]')) {
      p = load(); var used = p.socials.map(function (s) { return s.net; });
      p.socials.push({ id: uid(), net: Object.keys(NETS).filter(function (k) { return used.indexOf(k) < 0; })[0] || 'instagram', handle: '', pub: false });
      save(p); render();
      var last = area.querySelectorAll('[data-shandle]'); if (last.length) last[last.length - 1].focus();
      return;
    }
    var del = e.target.closest('[data-sdel]');
    if (del) {
      var id = del.closest('[data-sid]').dataset.sid;
      if (!del.classList.contains('armed')) { del.classList.add('armed'); del.innerHTML = 'Remove?'; return; }
      p = load(); p.socials = p.socials.filter(function (s) { return s.id !== id; }); save(p); render();
    }
  });
  /* photo: cropped to a square and made small (about 20 KB) so it syncs quickly */
  area.addEventListener('change', function (e) {
    if (e.target.id !== 'meFile' || !e.target.files[0]) return;
    var img = new Image(), url = URL.createObjectURL(e.target.files[0]);
    img.onload = function () {
      var s = Math.min(img.width, img.height), c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      var p = load(); p.photo = c.toDataURL('image/jpeg', 0.82); save(p); render(); renderHead();
    };
    img.src = url;
  });

  window.addEventListener('st:page', function (e) { if (e.detail === 'profile' || e.detail === 'socials') render(); if (e.detail === 'home') renderHead(); });
  window.addEventListener('profile:change', renderHead);
  if (window.Vault) window.Vault.onUnlock(renderHead);
  renderHead();
})();
} catch (e) { console.error("profile.js", e); }
/* ===== links.js ===== */
try {
/* Connections: when you change something in one place, the places that depend on it follow.
   Runs on every dashboard page, after the vault is unlocked.
   - Subscriptions → Monthly budget: each active subscription is a fixed cost (per month;
     yearly and quarterly ones spread out), monthly ones also get a due day in Upcoming bills
   - Trips → Finances: booking costs and a trip's other costs are spending (Travel), old trips too
   - Trips → Places to visit: a place you've now been to is ticked off as visited
   - Workouts → your training habit: a logged workout ticks the habit that day
   (workouts, courses and health → calendar in features.js) */
(function () {
  "use strict";
  var F = window.Features;
  if (!F || !window.Vault) return;
  var PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

  /* ---------- subscriptions → budget fixed costs ---------- */
  function syncSubs() {
    var d = window.Vault.get();
    if (!d) return;
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = F.on('subs') ? F.list('subs').filter(function (s) { return !s.paused && +s.amount > 0; }).map(function (s) {
      var monthly = (s.period || 'monthly') === 'monthly', old = fixed.filter(function (f) { return f.id === 'sub-' + s.id; })[0];
      var day = monthly && /^\d{4}-\d{2}-\d{2}$/.test(s.renews || '') ? +s.renews.slice(8, 10) : null;
      return { id: 'sub-' + s.id, name: s.name + (monthly ? '' : ' (' + (s.period === 'yearly' ? 'yearly' : 'every 3 months') + ')'),
        amount: Math.round((+s.amount) * (PER_MONTH[s.period] || 1)), day: day, src: 'sub' };
    }) : [];
    var mine = fixed.filter(function (f) { return f.src !== 'sub'; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'sub'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = mine.concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }

  /* ---------- savings goals → budget: "set aside every month" becomes a fixed cost ---------- */
  function syncSave() {
    var d = window.Vault.get(), B = window.Budget;
    if (!d || !B || !B.saveMonthly) return;
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = (d.savings || []).filter(function (g) { return g.aside; }).map(function (g) {
      return { id: 'save-' + g.id, name: 'Savings: ' + (g.name || 'goal'), amount: B.saveMonthly(g), day: null, src: 'save' };
    }).filter(function (f) { return f.amount > 0; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'save'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = fixed.filter(function (f) { return f.src !== 'save'; }).concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }
  window.Links = { syncSave: syncSave };

  /* ---------- trips → places to visit ---------- */
  function near(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return false;
    var dx = (a.lat - b.lat) * 111, dy = (a.lon - b.lon) * 111 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy) < 30;                 // within 30 km counts as the same place
  }
  function syncBucket() {
    if (!window.Flow || !F.on('bucket')) return;
    var today = F.dkey(new Date()), been = window.Flow.travel().trips.filter(function (t) { return t.start && t.start <= today && t.place; });
    if (!been.length) return;
    var t = F.tools(), changed = false;
    (t.bucket || []).forEach(function (b) {
      if (b.visited) return;
      var hit = been.filter(function (tr) {
        return near(tr.place, b.geo) || String(tr.place.name).toLowerCase() === String(b.place).toLowerCase();
      })[0];
      if (hit) { b.visited = true; b.visitedTrip = hit.id; changed = true; }
    });
    if (changed) F.saveTools(t);
  }

  /* ---------- trips → Finances ----------
     Every booking cost and a trip's "other costs" are spending in Finances (category Travel).
     Older trips and bookings made before this was automatic are added too: past ones on
     their own date, upcoming ones today (that's when you paid). Removed in Finances = left out. */
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) && n > 0 ? n : 0;
  }
  var syncingTrips = false;
  function syncTrips() {
    var d = window.Vault.get(), Fl = window.Flow;
    if (!d || !Fl || syncingTrips) return;
    d.expenses = Array.isArray(d.expenses) ? d.expenses : [];
    var byId = {}; d.expenses.forEach(function (e) { byId[e.id] = e; });
    var today = F.dkey(new Date()), tr = Fl.travel(), finChanged = false, travelChanged = false;
    function want(owner, idKey, amount, date, note, keepOutKey) {
      var ex = owner[idKey] && byId[owner[idKey]];
      if (owner[idKey] && !ex) { delete owner[idKey]; owner[keepOutKey] = true; travelChanged = true; return; }   // deleted in Finances
      if (!amount) { if (ex) { d.expenses = d.expenses.filter(function (x) { return x !== ex; }); delete owner[idKey]; finChanged = travelChanged = true; } return; }
      if (ex) {
        if (ex.amount !== amount || ex.note !== note) { ex.amount = amount; ex.note = note; finChanged = true; }
        return;
      }
      if (owner[keepOutKey]) return;
      var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      d.expenses.push({ id: id, t: Date.now(), date: date, amount: Math.round(amount * 100) / 100, cat: 'travel', note: note, src: 'trip' });
      owner[idKey] = id; finChanged = travelChanged = true;
    }
    tr.trips.forEach(function (t) {
      var name = t.name || t.dest || 'Trip', past = (t.end || t.start || today) < today;
      (t.items || []).forEach(function (it) {
        var label = it.title || ({ flight: 'Flight', train: 'Train', bus: 'Bus', boat: 'Boat', car: 'Car', hotel: 'Hotel', activity: 'Activity' }[it.type] || 'Booking');
        want(it, 'spendId', num(it.cost), past && /^\d{4}-\d{2}-\d{2}$/.test(it.date || '') ? it.date : today, (name + ': ' + label).slice(0, 80), 'noFin');
      });
      want(t, 'spentId', num(t.spent), past ? (t.start || today) : today, (name + ': other costs').slice(0, 80), 'noFinSpent');
    });
    if (!finChanged && !travelChanged) return;
    syncingTrips = true;
    try {
      if (finChanged) { window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
      if (travelChanged) Fl.saveTravel(tr);
    } finally { syncingTrips = false; }
  }

  /* ---------- workouts → the training habit ----------
     A logged workout ticks its habit that day (the one picked when logging, else your
     training/gym habit). Only adds ticks – ticking a day by hand still works as before. */
  function syncWorkouts() {
    if (!F.on('training')) return;
    var hb = null; try { hb = JSON.parse(localStorage.getItem('dash.habits')); } catch (e) {}
    if (!hb || !Array.isArray(hb.list) || !hb.list.length) return;
    var def = hb.list.filter(function (h) { return /train|trening|gym|workout|løp|run|exercise|økt/i.test(h.name); })[0];
    var ids = {}; hb.list.forEach(function (h) { ids[h.id] = 1; });
    hb.log = hb.log || {};
    var changed = false;
    F.list('training').forEach(function (w) {
      var hid = w.habit === '' ? null : (w.habit && ids[w.habit] ? w.habit : def && def.id);
      if (!hid || !/^\d{4}-\d{2}-\d{2}$/.test(w.date || '')) return;
      var day = hb.log[w.date] = hb.log[w.date] || [];
      if (day.indexOf(hid) < 0) { day.push(hid); changed = true; }
    });
    if (!changed) return;
    try { localStorage.setItem('dash.habits', JSON.stringify(hb)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));
    window.dispatchEvent(new Event('habits:change'));
    if (window.Dash && window.Dash.reload) window.Dash.reload();
  }

  function run() {
    try { syncWorkouts(); } catch (e) { console.error(e); }
    try { syncSubs(); } catch (e) { console.error(e); }
    try { syncSave(); } catch (e) { console.error(e); }
    try { syncTrips(); } catch (e) { console.error(e); }
    try { syncBucket(); } catch (e) { console.error(e); }
  }
  window.Vault.onUnlock(function () { setTimeout(run, 0); });
  window.addEventListener('tools:change', function () { if (window.Vault.get()) { syncSubs(); syncWorkouts(); } });
  window.addEventListener('features:change', function () { if (window.Vault.get()) run(); });
  window.addEventListener('travel:change', function () { if (window.Vault.get()) { syncTrips(); syncBucket(); } });
})();
} catch (e) { console.error("links.js", e); }
