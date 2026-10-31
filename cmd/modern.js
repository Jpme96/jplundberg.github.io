/* The Modern look (Settings → Appearance → Look; the styles are in modern.css).
   - One bar: you on the left, the menu in the middle, search and buttons on the right. On a computer
     it floats at the top and slides away while you scroll down; on a phone you and the buttons sit at
     the top of the page and the menu stays at the bottom.
   - More pages than fit: names fold to icons, then the rest go under "More" (a list on a computer,
     app icons on a phone – 4 pages + More). Which pages come first is Settings → Menu & pages.
   - Card buttons become small icons (the words stay as labels for screen readers and on hover).
   - Home: a short sentence about your day, the key numbers as chips, and today's top 3.
   Classic turns all of this off without a reload. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var root = document.documentElement, nav = document.getElementById('tabbar');
  if (/[?&]fresh=/.test(location.search)) history.replaceState(null, '', location.pathname + location.search.replace(/[?&]fresh=\d+/, '').replace(/^&/, '?') + location.hash);
  var page = (location.pathname.match(/\/cmd\/([a-z]+)\//) || [])[1] || 'home';
  var wideMQ = matchMedia('(min-width: 760px)');
  function modern() { return root.classList.contains('modern'); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function week(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n)) + ' kr'; }

  /* ================= the bar ================= */
  var bar = document.createElement('div'); bar.className = 'mbar'; bar.setAttribute('role', 'banner');
  bar.innerHTML = '<div class="mb-me"><span class="mb-av"></span><span class="mb-who"><b></b><small></small></span></div><div class="mb-acts"></div>';
  var meBox = bar.querySelector('.mb-av'), acts = bar.querySelector('.mb-acts');
  var host = document.querySelector('header.top') || document.getElementById('fp');
  if (host) host.insertBefore(bar, host.firstChild);
  function who() {
    var s = readJSON('dash.settings', {}) || {}, p = readJSON('dash.profile', {}) || {}, d = new Date();
    bar.querySelector('.mb-who b').textContent = p.first || s.name || 'Lundberg';
    bar.querySelector('.mb-who small').textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · week ' + week(d);
  }
  /* the buttons that used to sit in the top corner of each page move into the bar (and back for Classic) */
  var moved = [];
  function gather() {
    var src = document.querySelector('.top-actions') || document.querySelector('#fp > .fp-top');
    if (!src) return;
    Array.prototype.slice.call(src.children).forEach(function (el) {
      if (el.classList.contains('fp-back') || el === bar) return;
      moved.push({ el: el, from: src });
      if (el.hasAttribute('data-me')) meBox.appendChild(el); else acts.appendChild(el);
    });
  }
  function scatter() { moved.forEach(function (m) { m.from.appendChild(m.el); }); moved = []; }
  /* the menu goes into the bar on a computer, and back to the bottom of the screen on a phone */
  var navHome = nav && { parent: nav.parentNode, next: nav.nextSibling };
  function placeNav() {
    if (!nav) return;
    var inBar = modern() && wideMQ.matches;
    if (inBar && nav.parentNode !== bar) bar.insertBefore(nav, acts);
    else if (!inBar && nav.parentNode === bar) navHome.parent.insertBefore(nav, navHome.next && navHome.next.parentNode === navHome.parent ? navHome.next : null);
    fit();
  }
  function build() {
    if (modern()) { if (!moved.length) gather(); who(); }
    else scatter();
    placeNav();
  }

  /* ---------- More: pages that don't fit ---------- */
  var more = null;
  if (nav) {
    more = document.createElement('a'); more.className = 'tb-more'; more.href = '#'; more.setAttribute('role', 'button');
    more.setAttribute('aria-haspopup', 'true'); more.innerHTML = '<i class="bi bi-grid-3x3-gap-fill"></i><span>More</span>';
    nav.appendChild(more);
  }
  function tabs() { return Array.prototype.filter.call(nav.querySelectorAll('a[data-pg]'), function (a) { return getComputedStyle(a).display !== 'none' || a.classList.contains('tb-hide'); }); }
  function fit() {
    if (!nav || !more) return;
    if (more.nextSibling) nav.appendChild(more);          // More is always last (the menu order may have moved the tabs)
    var all = tabs(); all.forEach(function (a) { a.classList.remove('tb-hide'); });
    nav.classList.remove('has-more'); bar.classList.remove('tb-icons');
    if (!modern()) return;
    var cur = all.filter(function (a) { return a.getAttribute('aria-current'); })[0];
    function keep(n) {          // the first n pages stay, the page you're on always stays
      var shown = all.slice(0, n);
      if (cur && shown.indexOf(cur) < 0) shown[n - 1] = cur;
      all.forEach(function (a) { a.classList.toggle('tb-hide', shown.indexOf(a) < 0); });
      nav.classList.add('has-more');
    }
    if (!wideMQ.matches) { if (all.length > 5) keep(4); return; }
    /* computer: names → icons → More, until the menu fits between you and the buttons */
    var room = function () { var me = bar.querySelector('.mb-me').getBoundingClientRect(), ac = acts.getBoundingClientRect(), n = nav.getBoundingClientRect(); return n.left > me.right + 12 && n.right < ac.left - 12; };
    if (room()) return;
    bar.classList.add('tb-icons'); if (room()) return;
    for (var n = all.length - 1; n >= 2; n--) { keep(n); if (room()) return; }
  }
  function openMore(e) {
    e.preventDefault(); e.stopPropagation();
    if (closeMore()) return;
    var all = tabs(), hidden = all.filter(function (a) { return a.classList.contains('tb-hide'); });
    var item = function (a, i) { var ic = a.querySelector('.bi'); return '<a href="' + a.getAttribute('href') + '"' + (a.getAttribute('aria-current') ? ' aria-current="page"' : '') + '><i class="' + (ic ? ic.className : 'bi bi-circle') + '"></i><span>' + esc((a.textContent || '').trim()) + '</span>' + (wideMQ.matches ? '<kbd>' + (i + 1) + '</kbd>' : '') + '</a>'; };
    var edit = '<a class="mut" href="/cmd/?settings=layout"><i class="bi bi-sliders"></i> Choose what’s in the bar</a>';
    if (wideMQ.matches) {
      var m = document.createElement('div'); m.className = 'tb-menu'; m.id = 'tbMenu'; m.setAttribute('role', 'menu');
      m.innerHTML = '<p>More pages</p>' + hidden.map(function (a) { return item(a, all.indexOf(a)); }).join('') + '<hr>' + edit;
      document.body.appendChild(m);
      var r = more.getBoundingClientRect(); m.style.top = (r.bottom + 10) + 'px'; m.style.left = Math.min(innerWidth - 262, Math.max(12, r.right - 250)) + 'px';
      var f = m.querySelector('a'); if (f) f.focus();
    } else {
      var bg = document.createElement('div'); bg.className = 'tb-sheet-bg'; bg.id = 'tbSheetBg';
      var s = document.createElement('div'); s.className = 'tb-sheet'; s.id = 'tbMenu'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', 'All pages');
      s.innerHTML = '<div class="grab"></div><p>All pages</p><div class="tb-grid">' + all.map(function (a, i) { return item(a, i); }).join('') + '</div>' + edit.replace('class="mut"', 'class="tb-edit"').replace('what’s in the bar', 'your 4 in the bar');
      document.body.appendChild(bg); document.body.appendChild(s);
      requestAnimationFrame(function () { bg.classList.add('open'); s.classList.add('open'); });
      bg.addEventListener('click', closeMore);
    }
    more.setAttribute('aria-expanded', 'true');
  }
  function closeMore() {
    var m = document.getElementById('tbMenu'), bg = document.getElementById('tbSheetBg');
    if (!m) return false;
    m.remove(); if (bg) bg.remove(); if (more) more.setAttribute('aria-expanded', 'false');
    return true;
  }
  if (more) more.addEventListener('click', openMore);
  /* the menu order can change (Settings, another device): keep More last and fit again */
  if (nav) new MutationObserver(function () { if (more.nextSibling) requestAnimationFrame(fit); }).observe(nav, { childList: true });
  document.addEventListener('click', function (e) { if (!e.target.closest('#tbMenu, .tb-more')) closeMore(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMore(); });
  window.addEventListener('resize', function () { closeMore(); requestAnimationFrame(fit); });
  wideMQ.addEventListener('change', placeNav);

  /* ---------- the bar slides away while you scroll down (computer) ---------- */
  var lastY = scrollY, ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = scrollY, down = y > lastY + 4, up = y < lastY - 4;
      if (wideMQ.matches && modern() && !document.getElementById('tbMenu')) {
        if (down && y > 140) bar.classList.add('away'); else if (up || y < 80) bar.classList.remove('away');
      }
      if (down || up) lastY = y;
    });
  }, { passive: true });
  bar.addEventListener('focusin', function () { bar.classList.remove('away'); });

  /* ================= card buttons → icons ================= */
  var ICON = { open: 'arrow-up-right', details: 'arrow-up-right', all: 'arrow-up-right', 'see all': 'arrow-up-right', edit: 'pencil', add: 'plus-lg', new: 'plus-lg',
    'clear done': 'check2-all', stops: 'geo-alt', reviews: 'calendar-heart', import: 'upload', export: 'download', settings: 'sliders', customize: 'grid-1x2', history: 'clock-history', map: 'map', more: 'three-dots' };
  function iconify(scope) {
    if (!modern()) {          /* Classic: the words come back */
      document.querySelectorAll('.card-head .text-btn.mi').forEach(function (b) { b.classList.remove('mi'); b.querySelectorAll('.mi-i').forEach(function (x) { x.remove(); }); });
      return;
    }
    (scope || document).querySelectorAll('.card-head .text-btn:not(.mp):not(.fold-hint):not(.danger)').forEach(function (b) {
      if (b.closest('.fp-hero, .tk-bar, .pk-bar')) return;
      if (b.classList.contains('mi')) { if (b.querySelector('.bi')) return; b.classList.remove('mi'); }   // redrawn by its card: do it again
      var label = (b.textContent || '').replace(/\s+/g, ' ').trim();
      if (!label) return;
      if (b.hasAttribute('data-plan')) { b.classList.add('mp'); return; }   // the one that stays words
      var key = (b.dataset.i18nSrc || label).toLowerCase().replace(/[^a-z ]/g, '').trim();
      var have = b.querySelector('.bi:not(.bi-chevron-right):not(.bi-chevron-down)');
      var ic = have ? null : ICON[key] || ICON[key.split(' ')[0]] || null;
      if (!have && !ic) return;                       // nothing sensible to show: keep the word
      if (ic) b.insertAdjacentHTML('afterbegin', '<i class="bi bi-' + ic + ' mi-i"></i>');
      b.querySelectorAll('.bi-chevron-right, .bi-chevron-down').forEach(function (x) { x.remove(); });
      if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', label);
      if (!b.title) b.title = label;
      b.classList.add('mi');
    });
  }
  var iq = false;
  /* only when a card's heading changed (the clock and lists change all the time – those are skipped) */
  function headChange(recs) {
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i], t = r.target;
      if (t.nodeType === 1 && t.closest('.card-head')) return true;
      for (var j = 0; j < r.addedNodes.length; j++) { var n = r.addedNodes[j]; if (n.nodeType === 1 && (n.matches('.card-head, .card') || n.querySelector('.card-head'))) return true; }
    }
    return false;
  }
  new MutationObserver(function (recs) { if (!iq && headChange(recs)) { iq = true; requestAnimationFrame(function () { iq = false; iconify(); }); } }).observe(document.body, { childList: true, subtree: true });

  /* ================= home: the hero ================= */
  var hero = null;
  if (page === 'home' && document.querySelector('header.top')) {
    hero = document.createElement('section'); hero.className = 'mhero'; hero.setAttribute('aria-label', 'Your day');
    hero.innerHTML = '<div class="mh-txt"><div class="mh-when"></div><h1 class="mh-line"></h1><p class="mh-sub"></p><div class="mh-chips"></div></div>' +
      '<section class="card mh-top3"><div class="card-head"><h2><i class="bi bi-trophy"></i> Today’s top 3</h2><button type="button" class="text-btn mh-planbtn" data-plan><i class="bi bi-sunrise"></i> Plan day</button></div><div class="mh-body"></div></section>';
    document.querySelector('header.top').appendChild(hero);
  }
  function part(h) { return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function moneyToday() {
    var d = window.Vault.get(), Bu = window.Budget, now = new Date(), today = dkey(now);
    if (!d || !d.budget || (window.Features && !window.Features.on('finance'))) return null;
    var sum = function (l) { return (l || []).reduce(function (a, x) { return a + (+x.amount || 0); }, 0); };
    var ym = today.slice(0, 7), income = Bu ? Bu.income(d, ym) : sum(d.budget.income), fixed = sum(d.budget.fixed);
    if (!(income > 0)) return null;
    var pay = Bu ? Bu.nextPayday(d, now) : null, per = Bu ? Bu.period(d, now) : null;
    var spent = per ? Bu.spent(d, per) : sum((d.expenses || []).filter(function (e) { return String(e.date).slice(0, 7) === ym; }));
    var dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = (per ? per.income : income) - fixed - spent;
    var untilPay = (per && per.byPayday) || (pay && pay.days > 0 && pay.days <= dim);
    var perDay = left / (per && per.byPayday ? per.daysLeft : untilPay ? pay.days : dim - now.getDate() + 1);
    return { left: left, perDay: perDay };
  }
  /* the same rule as At a glance: a fixed cost with a day that has passed this month and isn't ticked as paid */
  function overdueBills(now) {
    var d = window.Vault && window.Vault.get ? window.Vault.get() : null; if (!d || !d.budget || (window.Features && !window.Features.on('finance'))) return [];
    var ym = now.getFullYear() + '-' + pad(now.getMonth() + 1), paid = (d.paid && d.paid[ym]) || [], last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return (d.budget.fixed || []).filter(function (f) { return f.day && f.src !== 'sub' && paid.indexOf(f.id) < 0 && Math.min(f.day, last) < now.getDate(); }).map(function (f) { return f.name || 'A bill'; });
  }
  function nextEvents(now) {
    var C = window.Cal; if (!C || !C.occurrences || (window.Features && !window.Features.on('calendar'))) return [];
    var to = new Date(now); to.setDate(to.getDate() + 2); to.setHours(23, 59);
    try { return C.occurrences(now, to).filter(function (o) { return !o.allDay && o.start > now && !(o.ev && o.ev.trip); }).sort(function (a, b) { return a.start - b.start; }); } catch (e) { return []; }
  }
  function drawHero() {
    if (!hero || !modern()) return;
    var now = new Date(), tk = dkey(now), hh = pad(now.getHours()) + ':' + pad(now.getMinutes());
    var todos = readJSON('dash.todos', []) || [];
    var top = todos.filter(function (t) { return t.today === tk; }).sort(function (a, b) { return (a.rank || 9) - (b.rank || 9); });
    var openTop = top.filter(function (t) { return !t.done; });
    var due = todos.filter(function (t) { return !t.done && t.due && t.due <= tk; });
    var openToday = openTop.length + due.filter(function (t) { return t.today !== tk; }).length;
    var evs = nextEvents(now), tom = new Date(now); tom.setDate(tom.getDate() + 1);
    var nextToday = evs.filter(function (o) { return o.start.toDateString() === now.toDateString() && !(o.ev && o.ev.todo); })[0];
    var firstTom = evs.filter(function (o) { return o.start.toDateString() === tom.toDateString(); })[0];
    var tr = window.Flow && window.Flow.travel ? (window.Flow.travel().trips || []).filter(function (t) { return t.start > tk; }).sort(function (a, b) { return a.start > b.start ? 1 : -1; })[0] : null;
    var tripDays = tr ? Math.round((new Date(tr.start + 'T12:00') - new Date(tk + 'T12:00')) / 864e5) : null;
    var tm = function (o) { return pad(o.start.getHours()) + ':' + pad(o.start.getMinutes()); };
    /* the sentence */
    var a = openToday === 0 ? (top.length ? 'Top 3 done today,' : 'A clear day,') : openToday === 1 ? 'One task left today,' : (openToday < 10 ? ['', '', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'][openToday] : openToday) + ' tasks left today,';
    var b = nextToday ? 'next up: ' + nextToday.title + ' at ' + tm(nextToday) + '.'
      : firstTom && firstTom.start.getHours() < 10 ? 'and an early start tomorrow.'
      : tripDays != null && tripDays <= 14 ? (tr.name || tr.dest) + ' in ' + tripDays + ' day' + (tripDays === 1 ? '' : 's') + '.'
      : now.getHours() >= 17 ? 'enjoy the evening.' : now.getHours() < 12 ? 'make it a good one.' : 'keep it going.';
    var sub = [];
    if (firstTom) sub.push(firstTom.title + ' at ' + tm(firstTom) + ' tomorrow.');
    var m = moneyToday(), late = overdueBills(now);
    /* an overdue bill comes first – never "on track" while something is unpaid (names only, no amounts on the big headline) */
    if (late.length === 1) sub.unshift(late[0] + ' is overdue – pay it when you can.');
    else if (late.length > 1) sub.unshift(late.length + ' bills are overdue: ' + late.slice(0, 3).join(', ') + '.');
    if (m && !late.length) sub.push(m.left < 0 ? 'You’re over budget this month – take it easy on spending.' : 'You’re on track with money this month.');
    else if (m && m.left < 0) sub.push('You’re over budget this month – take it easy on spending.');
    var hb = readJSON('dash.habits', { list: [], log: {} }) || {}, mon = new Date(now); mon.setDate(mon.getDate() - (mon.getDay() + 6) % 7);
    var habitLine = '';
    (hb.list || []).some(function (h) {
      var n = 0; for (var i = 0; i < 7; i++) { var d = new Date(mon); d.setDate(mon.getDate() + i); if (((hb.log || {})[dkey(d)] || []).indexOf(h.id) > -1) n++; }
      var left = (h.target || 0) - n;
      if (left === 1) { habitLine = 'One more ' + String(h.name).toLowerCase() + ' session hits your weekly goal.'; return true; }
      if (left > 1 && left <= 7 - ((now.getDay() + 6) % 7)) { habitLine = left + ' more ' + String(h.name).toLowerCase() + ' sessions this week to hit your goal.'; return true; }
      return false;
    });
    if (habitLine) sub.push(habitLine);
    hero.querySelector('.mh-when').innerHTML = '<i class="bi bi-' + (now.getHours() >= 18 || now.getHours() < 6 ? 'moon-stars' : 'sun') + '"></i> ' + hh + ' · ' + part(now.getHours());
    var line = a + ' <span>' + esc(b) + '</span>';
    if (hero.querySelector('.mh-line').innerHTML !== line) hero.querySelector('.mh-line').innerHTML = line;
    var subH = (sub.length ? sub.slice(0, 2) : ['Everything is in order.']).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join(' ');
    if (hero.querySelector('.mh-sub').innerHTML !== subH) hero.querySelector('.mh-sub').innerHTML = subH;
    /* the chips */
    var chips = [], hide = readJSON('dash.finHide', '0') === '1' || localStorage.getItem('dash.finHide') === '1';
    if (m && m.left >= 0) chips.push('<a class="mh-chip" href="#fin"><i class="bi bi-wallet2"></i><b>' + (hide ? '•••' : kr(m.perDay)) + '</b> left today</a>');
    var wt = document.getElementById('wTemp'), wd = document.getElementById('wDesc'), wi = document.getElementById('wIcon');
    if (wt && /\d/.test(wt.textContent) && !document.documentElement.classList.contains('hide-weather')) chips.push('<a class="mh-chip" href="#weatherCard"><i class="' + (wi ? wi.className : 'bi bi-cloud') + '"></i><b>' + esc(wt.textContent) + '</b> ' + esc(((wd && wd.textContent) || '').split(' · ')[0].toLowerCase()) + '</a>');
    if (tr && tripDays <= 60) chips.push('<a class="mh-chip" href="travel/"><i class="bi bi-suitcase-lg"></i><b>' + esc(tr.name || tr.dest) + '</b> in ' + tripDays + ' day' + (tripDays === 1 ? '' : 's') + '</a>');
    var H = ((window.Vault.get() || {}).health || {}).days || {}, ht = H[tk];
    if (ht && ht.steps) chips.push('<a class="mh-chip" href="habits/"><i class="bi bi-activity"></i><b>' + nf.format(ht.steps) + '</b> steps</a>');
    var fm = window.Focus && window.Focus.minsToday ? window.Focus.minsToday() : 0;
    if (fm) chips.push('<span class="mh-chip"><i class="bi bi-stopwatch"></i><b>' + fm + ' min</b> focused</span>');
    var ch = chips.join('');
    if (hero.querySelector('.mh-chips').innerHTML !== ch) hero.querySelector('.mh-chips').innerHTML = ch;
    /* today's top 3 */
    var body;
    if (top.length) {
      var done = top.length - openTop.length;
      body = '<ul>' + top.map(function (t, i) {
        var ev = window.Cal && t.block ? (window.Cal.load().events || []).filter(function (e) { return e.id === t.block; })[0] : null;
        return '<li class="' + (t.done ? 'dn' : '') + '" data-id="' + esc(t.id) + '"><span class="mh-rk">' + (t.rank || i + 1) + '</span><span class="mh-tx">' + esc(t.text) + '</span>' +
          (ev && ev.start && !t.done ? '<span class="mh-tm">' + esc(ev.start) + '</span>' : '') +
          '<button type="button" class="mh-ck" data-mhdone="' + esc(t.id) + '" aria-label="' + (t.done ? 'Mark as not done' : 'Mark as done') + '"><i class="bi bi-check-lg"></i></button></li>';
      }).join('') + '</ul><div class="mh-prog"><div class="mh-bar"><i style="width:' + Math.round(done / top.length * 100) + '%"></i></div>' + done + ' of ' + top.length + ' done' + (fm ? ' · ' + fm + ' min focused' : '') + '</div>';
    } else {
      var n = todos.filter(function (t) { return !t.done; }).length;
      /* nothing picked yet: one compact row, so At a glance and Today stay on the first screen of a phone */
      body = '<div class="mh-erow"><i class="bi bi-trophy"></i><p class="mh-empty">' + (n ? 'Pick today’s top 3 and give them a time.' : 'Nothing on your list – enjoy the free time.') + '</p>' +
        '<button type="button" class="pill-btn mh-plan" data-plan><i class="bi bi-sunrise"></i> Plan my day</button></div>';
    }
    hero.querySelector('.mh-top3').classList.toggle('mh-e', !top.length);
    var bx = hero.querySelector('.mh-body'); if (bx.innerHTML !== body) bx.innerHTML = body;
    hero.querySelector('.mh-planbtn').hidden = !top.length;
  }
  if (hero) {
    hero.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mhdone]'); if (!b) return;
      var real = document.querySelector('#todoList .todo-item[data-id="' + b.dataset.mhdone + '"] .check');
      if (real) { real.click(); return; }
      var l = readJSON('dash.todos', []); l.forEach(function (t) { if (t.id === b.dataset.mhdone) t.done = !t.done; });
      writeJSON('dash.todos', l); window.dispatchEvent(new Event('todos:change')); if (window.Dash && window.Dash.reload) window.Dash.reload();
    });
    var dq = false, soon = function () { if (!dq) { dq = true; setTimeout(function () { dq = false; drawHero(); }, 40); } };
    ['todos:change', 'plan:change', 'cal:change', 'habits:change', 'fin:change', 'travel:change', 'health:change', 'dash:local', 'features:change', 'storage'].forEach(function (ev) { window.addEventListener(ev, soon); });
    var w = document.getElementById('weatherCard'); if (w) new MutationObserver(soon).observe(w, { childList: true, subtree: true, characterData: true });
    var tl = document.getElementById('todoList'); if (tl) new MutationObserver(soon).observe(tl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    setInterval(drawHero, 30000);
  }

  /* ================= a card left alone on the last row takes the full width (Work, Health, Finances) ================= */
  function lone() {
    document.querySelectorAll('.kit-grid').forEach(function (g) {
      var vis = Array.prototype.filter.call(g.children, function (c) { return !c.hidden && c.offsetParent !== null && !c.classList.contains('pk-off') && c.firstElementChild; });
      var cols = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length, used = 0;
      var want = [];
      if (cols >= 2) vis.forEach(function (c, i) {
        if (c.classList.contains('kit-wide')) { used = 0; return; }
        if (used === 0 && (i === vis.length - 1 || vis[i + 1].classList.contains('kit-wide'))) want.push(c);
        used = (used + 1) % cols;
      });
      Array.prototype.forEach.call(g.children, function (c) { var w = want.indexOf(c) > -1; if (c.classList.contains('kit-span') !== w) c.classList.toggle('kit-span', w); });   // only real changes (no loop)
    });
  }
  var lq = false; function loneSoon() { if (!lq) { lq = true; setTimeout(function () { lq = false; lone(); }, 60); } }
  ['tools:change', 'features:change', 'resize', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, loneSoon); });
  document.querySelectorAll('.kit-grid').forEach(function (g) { new MutationObserver(loneSoon).observe(g, { childList: true, attributes: true, attributeFilter: ['hidden', 'class'] }); });

  /* ================= switching between Modern and Classic ================= */
  var was = modern();
  new MutationObserver(function () { var m = modern(); if (m !== was) { was = m; build(); iconify(); drawHero(); } }).observe(root, { attributes: true, attributeFilter: ['class'] });
  window.Vault.onUnlock(function () { setTimeout(function () { build(); iconify(); drawHero(); loneSoon(); }, 30); setTimeout(fit, 400); });
  window.addEventListener('profile:change', who);
  build(); iconify();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  window.Modern = { fit: fit, hero: drawHero };
})();
