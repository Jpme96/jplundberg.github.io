/* Search everything: calendar, trips and bookings, to-dos, notes, goals, links, spending,
   subscriptions, meetings, courses, health, journal, places, warranties, people and gifts, recipes,
   Good to know (never codes or passwords), FDV inspections and findings – and the settings.
   Opens with the magnifier, "/" or Ctrl/⌘ K. Nothing leaves this browser. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var Fe = window.Features;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function fmt(k) { return /^\d{4}-\d{2}-\d{2}/.test(k || '') ? new Date(k.slice(0, 10) + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(+n || 0)) + ' kr'; }
  var home = location.pathname.replace(/[a-z]+\/$/, '').replace(/index\.html$/, '');
  if (!/\/cmd\/$/.test(home)) home = '/cmd/';

  /* ---------- everything you can find ---------- */
  var SETTINGS = [['appearance', 'Appearance', 'Theme, colours, background, cards, glass, motion'], ['dashboard', 'Dashboard', 'Greeting, cards and their order'],
    ['features', 'Features', 'Switch parts on or off'], ['calendar', 'Calendar settings', 'Categories, week numbers, holidays'], ['profile', 'Your profile', 'Photo, details, home, work, health'],
    ['security', 'Security', 'Passcode, auto-lock'], ['data', 'Data & sync', 'Backup, sync'], ['notify', 'Notifications', 'Reminders on this device'], ['ahealth', 'Apple Health', 'Steps, sleep, heart rate from your iPhone'], ['shortcuts', 'Siri & Shortcuts', 'Links for Siri, Shortcuts, Back Tap'], ['socials', 'Socials', 'Links on jplundberg.com'],
    ['announce', 'Announcement', 'Banner on jplundberg.com'], ['sections', 'Front page', 'Sections on jplundberg.com'], ['texts', 'Texts', 'Website texts'],
    ['featured', 'Featured', 'Pinned article and project'], ['content', 'Articles & projects', 'Show or hide'], ['visitors', 'Visitors', 'Website statistics']];
  function index() {
    var out = commands().filter(function (c) { return c.g === 'Commands'; });
    function add(group, icon, title, sub, href, date, extra) { out.push({ g: group, i: icon, t: String(title || ''), s: sub || '', h: href, d: date || '', x: String(extra || '').toLowerCase() }); }
    var cal = readJSON('dash.calendar') || {};
    (cal.events || []).forEach(function (e) { add('Calendar', 'calendar-event', e.title, fmt(e.date) + (e.start && !e.allDay ? ' ' + e.start : '') + (e.location ? ' · ' + e.location : ''), home + 'calendar/#d=' + e.date, e.date, (e.location || '') + ' ' + (e.notes || '')); });
    var tr = readJSON('dash.travel') || {};
    (tr.trips || []).forEach(function (t) {
      add('Trips', 'suitcase-lg', t.name || t.dest, [t.dest, fmt(t.start)].filter(Boolean).join(' · '), home + 'travel/#trip=' + t.id, t.start, (t.dest || '') + ' ' + (t.notes || '') + ' ' + ((t.place || {}).country || ''));
      (t.items || []).forEach(function (it) { add('Trips', 'ticket-perforated', it.title || it.type, (t.name || '') + ' · ' + fmt(it.date) + (it.ref ? ' · ' + it.ref : ''), home + 'travel/#trip=' + t.id, it.date, (it.from || '') + ' ' + (it.to || '') + ' ' + (it.ref || '') + ' ' + (it.notes || '')); });
    });
    (tr.docs || []).forEach(function (d) { add('Trips', 'person-vcard', d.name || d.kind, 'Expires ' + fmt(d.expires), home + 'travel/#docs', d.expires, d.note); });
    (readJSON('dash.todos') || []).forEach(function (t) { add('To-do', t.done ? 'check2-square' : 'square', t.text, t.done ? 'Done' : 'To-do', home + '#c=todo'); });
    (readJSON('dash.notes') || []).forEach(function (n) { var x = String(n.text || ''); add('Notes', 'sticky', x.split('\n')[0].slice(0, 80), x.length > 80 ? x.slice(80, 160) : 'Note', home + '#c=notes', '', x); });
    (readJSON('dash.goals') || []).forEach(function (g) { add('Goals', 'bullseye', g.name, (g.value || 0) + ' / ' + g.target, home + '#c=goals'); });
    (readJSON('dash.links') || []).forEach(function (l) { add('Links', 'link-45deg', l.name, l.url, l.url, '', l.url); });
    var hb = readJSON('dash.habits') || {};
    (hb.list || []).forEach(function (h) { add('Health', 'activity', h.name, h.target + '× per week', home + 'habits/'); });
    var d = window.Vault.get();
    if (d) (d.expenses || []).forEach(function (e) { add('Spending', 'receipt', e.note || e.cat, kr(e.amount) + ' · ' + fmt(e.date) + ' · ' + e.cat, home + 'finance/#c=spending', e.date, e.cat); });
    if (d && d.budget) (d.budget.fixed || []).concat(d.budget.income || []).forEach(function (b) { add('Budget', 'pie-chart', b.name, kr(b.amount) + ' a month', home + 'finance/#c=budget'); });
    if (Fe) {
      var T = Fe.tools();
      var tool = function (key, group, icon, title, sub, href, date, extra) { if (Fe.on(key)) (T[key] || []).forEach(function (x) { add(group, icon, title(x), sub(x), home + href, date ? x[date] : '', extra ? extra(x) : ''); }); };
      tool('meetings', 'Work', 'people', function (m) { return m.title; }, function (m) { return 'Meeting · ' + fmt(m.date) + (m.who ? ' · ' + m.who : ''); }, 'work/#meetings', 'date', function (m) { return (m.notes || '') + ' ' + (m.actions || '') + ' ' + (m.who || ''); });
      tool('learning', 'Work', 'mortarboard', function (c) { return c.title; }, function (c) { return [c.provider, c.expires ? 'expires ' + fmt(c.expires) : ''].filter(Boolean).join(' · ') || 'Course'; }, 'work/#learning', 'date', function (c) { return c.notes; });
      tool('flex', 'Work', 'stopwatch', function (f) { return 'Work day ' + fmt(f.date); }, function (f) { return (f.in || '') + '–' + (f.out || '') + (f.note ? ' · ' + f.note : ''); }, 'work/#flex', 'date', function (f) { return f.note; });
      tool('training', 'Health', 'heart-pulse', function (w) { return 'Workout ' + fmt(w.date); }, function (w) { return (w.kind || '') + ' · ' + (w.min || 0) + ' min'; }, 'habits/#training', 'date', function (w) { return (w.kind || '') + ' ' + (w.notes || ''); });
      tool('health', 'Health', 'clipboard2-pulse', function (h) { return h.title; }, function (h) { return [fmt(h.date), h.where].filter(Boolean).join(' · '); }, 'habits/#health', 'date', function (h) { return (h.notes || '') + ' ' + (h.where || ''); });
      tool('journal', 'Health', 'journal-bookmark', function (j) { return j.line; }, function (j) { return 'Journal · ' + fmt(j.date); }, 'habits/#journal', 'date', function (j) { return j.notes; });
      tool('bucket', 'Trips', 'pin-map', function (b) { return b.place; }, function (b) { return b.visited ? 'Visited' : 'Want to visit'; }, 'travel/#bucket', '', function (b) { return b.notes; });
      tool('subs', 'Finances', 'arrow-repeat', function (s) { return s.name; }, function (s) { return kr(s.amount) + ' · ' + (s.period || 'monthly'); }, 'finance/#subs', '', function (s) { return s.notes; });
      /* Home life and FDV: people, recipes, Good to know, inspections and their findings */
      if (Fe.on('people')) (T.people || []).forEach(function (pp) {
        var bd = window.HomeLife && window.HomeLife.bday(pp);
        add('People', 'person', pp.name, [bd ? 'Birthday ' + fmt(bd.next).replace(/ \d{4}$/, '') : '', pp.phone].filter(Boolean).join(' · ') || 'Person', home + 'people/#people=' + pp.id, '',
          [pp.rel, pp.notes, pp.gifts, pp.phone, pp.dates, (pp.log || []).map(function (x) { return x.t || ''; }).join(' ')].join(' '));
      });
      if (Fe.on('people')) (T.gifts || []).forEach(function (g) {
        var who = (T.people || []).filter(function (pp) { return pp.id === g.pid; })[0];
        add('People', 'gift', g.what, 'Gift' + (who ? ' to ' + who.name : '') + ' · ' + fmt(g.date) + (+g.cost ? ' · ' + kr(g.cost) : ''), home + 'people/#pgifts', g.date, (who ? who.name : '') + ' gift gave');
      });
      if (Fe.on('food')) (T.recipes || []).forEach(function (r) {
        var ing = String(r.ingr || '').split('\n').filter(Boolean);
        add('Recipes', 'journal-text', r.title, [r.mins ? r.mins + ' min' : '', ing.length ? ing.length + ' ingredients' : ''].filter(Boolean).join(' · ') || 'Recipe', home + 'food/#recipes=' + r.id, '', ing.join(' ') + ' ' + (r.steps || '').slice(0, 400) + ' oppskrift recipe');
      });
      if (Fe.on('house')) (T.hinfo || []).forEach(function (x) {
        /* codes and passwords are never put in the index */
        var vis = Object.keys(x).filter(function (k) { return !/^(id|kind|title|pass|code|guest)$/.test(k) && typeof x[k] === 'string'; }).map(function (k) { return x[k]; });
        add('Good to know', 'info-circle', x.title, vis.filter(function (v) { return v && v.length < 80 && !/^\d{4}-\d{2}-\d{2}$/.test(v); }).slice(0, 2).join(' · ') || 'House', home + 'house/#hinfo=' + x.id, '', vis.join(' ') + ' ' + (x.kind || ''));
      });
      if (Fe.on('fdv')) (T.fdv || []).forEach(function (r) {
        add('FDV', 'building-check', r.building, ['Inspection ' + fmt(r.date), r.address, r.client].filter(Boolean).join(' · '), home + 'work/#fdv=' + r.id, r.date, (r.address || '') + ' ' + (r.client || '') + ' ' + (r.notes || '') + ' fdv befaring inspection');
        (r.findings || []).forEach(function (f) {
          add('FDV', 'clipboard-check', (f.part ? f.part + ': ' : '') + f.text, [String(f.tg).toUpperCase() === 'IU' ? 'TG IU' : 'TG' + f.tg, r.building, fmt(r.date)].filter(Boolean).join(' · '), home + 'work/#fdv=' + r.id, r.date, (f.action || '') + ' ' + r.building + ' funn finding');
        });
      });
      tool('warranty', 'Finances', 'receipt-cutoff', function (w) { return w.item; }, function (w) { return [w.store, fmt(w.bought), w.receipt ? 'receipt: ' + w.receipt : ''].filter(Boolean).join(' · '); }, 'finance/#warranty', 'bought', function (w) { return (w.store || '') + ' ' + (w.notes || '') + ' ' + (w.receipt || ''); });
    }
    add('Reviews', 'clipboard-check', 'Weekly check-in', 'Spending, the week ahead, focus and habits', home + '#checkin', '', 'review week weekly sunday plan uke');
    add('Do', 'upload', 'Import from bank', 'CSV or Excel from your bank or credit card', home + 'finance/#import', '', 'import bank csv excel kort sparebank dnb nordea');
    add('Reviews', 'calendar-heart', 'Monthly check-in', 'Last month and the month ahead', home + '#review=month', '', 'review month summary');
    add('Reviews', 'stars', 'Year in review', 'Trips, money, workouts and habits', home + '#review=year', '', 'review year summary annual');
    SETTINGS.forEach(function (s) { add('Settings', 'gear', s[1], s[2], home + '?settings=' + s[0], '', s[2]); });
    return out;
  }
  /* things to do, not find: shown when the box is empty, and found by name ("plan", "focus", "dark") */
  function commands() {
    var K = window.Keys || {}, Q = window.Quick, out = [];
    function cmd(i, t, s, k, run, x) { out.push({ g: 'Commands', i: i, t: t, s: s, k: k, run: run, h: '#', x: (x || '').toLowerCase(), d: '' }); }
    cmd('sunrise', 'Plan my day', 'Pick your top 3 and put them in the calendar', 'P', function () { K.plan ? K.plan() : (location.href = home + '#plan'); }, 'plan day top 3 schedule planlegg dagen');
    cmd('check2-square', 'New task', 'Add something to your to-do list', 'N', function () { K.newTask ? K.newTask() : Q && Q.open('todo'); }, 'todo task oppgave');
    if (Q) cmd('plus-lg', 'Quick add', 'Expense, event, workout, task or note', 'A', function () { Q.open(); }, 'add expense event note utgift');
    if (window.Focus) cmd('stopwatch', window.Focus.running() ? 'Pause or resume the focus timer' : 'Start a focus timer', '25 minutes on one task, then a break', 'F', function () { window.Focus.pick(); }, 'focus pomodoro timer fokus');
    (K.pages ? K.pages() : []).forEach(function (a, n) { var nm = (a.textContent || '').trim(); out.push({ g: 'Go to', i: (((a.querySelector('i.bi') || {}).className || '').match(/bi-([a-z0-9-]+)/) || [0, 'arrow-right'])[1], t: nm, s: '', k: String(n + 1), h: a.getAttribute('href'), x: 'go page ' + nm.toLowerCase(), d: '' }); });
    if (K.theme) cmd(document.documentElement.getAttribute('data-theme') === 'light' ? 'moon-stars' : 'sun', document.documentElement.getAttribute('data-theme') === 'light' ? 'Dark mode' : 'Light mode', 'Switch the look', 'D', K.theme, 'theme dark light mørk lys');
    cmd('lock', 'Lock now', 'Lock the dashboard on this device', 'L', function () { window.Vault.lock(); }, 'lock lås');
    if (K.help) cmd('keyboard', 'Keyboard shortcuts', 'All the keys', '?', K.help, 'keys shortcuts hurtigtaster');
    (window.CommandExtra || []).forEach(function (f) { try { f().forEach(function (c) { cmd(c.i, c.t, c.s, c.k || '', c.run, c.x); }); } catch (e) {} });
    return out;
  }
  /* one or two letters wrong, missing or extra (two only for longer words) */
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var low = i;
      for (j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < low) low = cur[j]; }
      if (low > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function near(w, hay) {
    if (w.length < 4) return false;
    var max = w.length >= 7 ? 2 : 1, toks = hay.split(/[^\p{L}\p{N}]+/u);
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i]; if (!tk || Math.abs(tk.length - w.length) > max && tk.length < w.length) continue;
      if (dist(w, tk.slice(0, w.length + max), max) <= max || dist(w, tk, max) <= max) return true;
    }
    return false;
  }
  function search(q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return index().map(function (r) {
      var hay = (r.t + ' ' + r.s + ' ' + r.x + ' ' + r.g).toLowerCase(), t = r.t.toLowerCase(), score = 0;
      for (var i = 0; i < words.length; i++) {
        if (hay.indexOf(words[i]) < 0) {
          if (!near(words[i], hay)) return null;      // a typo ("tannlge") still finds tannlege
          score += .5; continue;
        }
        score += t.indexOf(words[i]) === 0 ? 6 : t.indexOf(words[i]) > -1 ? 4 : 1;
      }
      if (r.g === 'Settings') score -= .5;
      return { r: r, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score || (b.r.d > a.r.d ? 1 : -1); }).slice(0, 40).map(function (x) { return x.r; });
  }

  /* ---------- the search window ---------- */
  var bg = document.createElement('div');
  bg.className = 'sr-bg'; bg.hidden = true;
  bg.innerHTML = '<div class="sr-box" role="dialog" aria-modal="true" aria-label="Search"><div class="sr-top"><i class="bi bi-search"></i>' +
    '<input id="srIn" type="search" placeholder="Search everything – people, recipes, trips, notes, spending…" autocomplete="off" spellcheck="false" aria-label="Search">' +
    '<button type="button" class="text-btn" data-srclose>Close</button></div><div class="sr-res" id="srRes"></div></div>';
  document.body.appendChild(bg);
  var input = bg.querySelector('#srIn'), res = bg.querySelector('#srRes'), active = -1, results = [];
  /* typed something that reads like a thing to add ("149 rema", "fre 18 middag")? offer it */
  function addRow(q) {
    var S = window.Smart; if (!S || !window.Quick || !window.Quick.add) return null;
    var p = S.parse(q, { memory: ((window.Vault.get() || {}).catMemory) || {} });
    if (!p || !p.strong || p.kind === 'note') return null;
    var dsc = S.describe(p);
    return { g: 'Add', i: dsc.icon, t: 'Add ' + dsc.label.toLowerCase() + ': ' + dsc.bits[0], s: dsc.bits.slice(1).join(' · '), h: '#', act: p };
  }
  var kbd = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function draw() {
    var q = input.value.trim();
    results = search(q);
    var ad = q ? addRow(q) : null;
    if (ad) { if (results.length) results.push(ad); else results = [ad]; }
    if (!q) results = commands();
    active = results.length ? 0 : -1;
    var hint = q ? '' : '<p class="sr-hint">Search everything – or type something to add: “149 rema”, “fre 18 middag”, “løp 5 km”.</p>';
    if (!results.length) { res.innerHTML = '<p class="sr-hint">Nothing found for “' + esc(q) + '”.</p>'; return; }
    var last = '', html = '';
    results.forEach(function (r, i) {
      if (r.g !== last) { html += '<p class="sr-g">' + esc(r.g) + '</p>'; last = r.g; }
      html += '<a class="sr-item' + (i === active ? ' on' : '') + '" data-i="' + i + '" href="' + esc(r.h) + '"' + (/^https?:/.test(r.h) && r.h.indexOf(location.host) < 0 ? ' target="_blank" rel="noopener"' : '') + '>' +
        '<span class="sr-ic"><i class="bi bi-' + r.i + '"></i></span><span class="sr-x"><b>' + esc(r.t) + '</b>' + (r.s ? '<small>' + esc(r.s) + '</small>' : '') + '</span>' + (r.k && kbd ? '<kbd class="sr-k">' + esc(r.k) + '</kbd>' : '') + '</a>';
    });
    res.innerHTML = hint + html;
  }
  function mark() { res.querySelectorAll('.sr-item').forEach(function (a) { a.classList.toggle('on', +a.dataset.i === active); }); var on = res.querySelector('.sr-item.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
  function open() {
    if (!document.documentElement.classList.contains('unlocked')) return;
    bg.hidden = false; requestAnimationFrame(function () { bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
    input.value = ''; draw(); setTimeout(function () { input.focus(); }, 30);
  }
  function close() { bg.classList.remove('open'); document.documentElement.classList.remove('cl-modal'); setTimeout(function () { bg.hidden = true; }, 180); }
  input.addEventListener('input', draw);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (results.length) { active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length; mark(); } }
    else if (e.key === 'Enter' && active > -1) { e.preventDefault(); var a = res.querySelector('.sr-item.on'); if (a) a.click(); }
    else if (e.key === 'Escape') close();
  });
  bg.addEventListener('click', function (e) {
    if (e.target === bg || e.target.closest('[data-srclose]')) return close();
    var a = e.target.closest('.sr-item');
    if (a && results[+a.dataset.i] && results[+a.dataset.i].run) { e.preventDefault(); var fn = results[+a.dataset.i].run; close(); setTimeout(fn, 200); return; }
    if (a && results[+a.dataset.i] && results[+a.dataset.i].act) {
      e.preventDefault();
      if (window.Quick.add(results[+a.dataset.i].act)) { close(); setTimeout(function () { if (window.Dash && window.Dash.reload) window.Dash.reload(); }, 0); }
      return;
    }
    if (a) {
      var h = a.getAttribute('href');
      if (/[?&]settings=/.test(h)) { try { if (location.pathname !== '/cmd/') sessionStorage.setItem('dash.stFrom', location.pathname); } catch (x) {} }
      if (h.split('#')[0] === location.pathname && h.indexOf('#') > -1) { e.preventDefault(); close(); location.hash = h.split('#')[1]; goHash(); }
      else close();
    }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '') && !e.target.isContentEditable)) {
      if (bg.hidden) { e.preventDefault(); open(); }
    }
  });
  document.addEventListener('click', function (e) { if (e.target.closest('[data-search]')) open(); });

  /* the magnifier: next to the avatar in the top corner */
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'icon-btn sr-btn'; btn.setAttribute('data-search', ''); btn.setAttribute('aria-label', 'Search (/)');
  btn.innerHTML = '<i class="bi bi-search"></i>';
  var acts = document.querySelector('.top-actions');
  if (acts && document.getElementById('settingsBtn')) acts.insertBefore(btn, acts.firstChild);
  else {
    var host = document.querySelector('#fp > .fp-top');
    if (host) { btn.classList.add('sr-in'); var me = host.querySelector('[data-me]'); host.insertBefore(btn, me || null); }
    else { btn.classList.add('sr-sub'); document.body.appendChild(btn); }
  }

  /* arriving from a search on another page: the dashboard cards */
  function goHash() {
    var m = location.hash.match(/^#c=([a-z]+)$/);
    if (!m) return;
    var card = document.querySelector('.card.' + m[1]);
    if (!card) return;
    setTimeout(function () {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('sr-flash'); setTimeout(function () { card.classList.remove('sr-flash'); }, 1600);
    }, 350);
    history.replaceState(null, '', location.pathname + location.search);
  }
  window.Vault.onUnlock(goHash);
  window.addEventListener('hashchange', goHash);
})();
