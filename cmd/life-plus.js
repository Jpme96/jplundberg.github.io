/* Life sections – the everywhere part (2026-11-21, JP: "do everything, but I don't have a car"). Seventeen small sections,
   each its own feature (off until you switch it on in Settings → Features), each a card on the page it belongs to
   (life-plus.page.js). This part holds what other pages need: the lines on At a glance and the evening push before bed.
   Data: Features.tools()[id] – lists, one per section (so each becomes its own vault piece). */
(function () {
  'use strict';
  if (!window.Features || !window.Vault) return;
  var Fe = window.Features, K = function (k, en, o) { return I18N.k(k, en, o); };
  var dkey = Fe.dkey, fromKey = Fe.fromKey;
  function today() { return dkey(new Date()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function days(a, b) { return Math.round((fromKey(b) - fromKey(a)) / 864e5); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function addMonths(k, n) { var d = fromKey(k), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return dkey(d); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(+n || 0)) + ' kr'; }
  function on(id) { return Fe.on(id); }
  function list(id) { return Fe.list(id) || []; }
  /* the next date a yearly "MM-DD" falls on, from today */
  function yearDate(md, y) { return (y || new Date().getFullYear()) + '-' + md; }
  /* when something that repeats every n months is next due */
  function bodyDue(x) { if (!isKey(x.last)) return ''; return x.unit === 'w' ? addDays(x.last, (+x.every || 6) * 7) : addMonths(x.last, +x.every || 12); }   /* Me → Body upkeep */
  function nextDue(last, months) { return isKey(last) ? addMonths(last, +months || 12) : today(); }
  /* the pets' next jobs, sorted */
  function petJobs(p) {
    var j = [];
    if (isKey(p.vet) || +p.vetEvery) j.push(['vet', K('ui.lp-pet-vet', 'Vet check'), nextDue(p.vet, p.vetEvery || 12)]);
    if (isKey(p.vacc)) j.push(['vacc', K('ui.lp-pet-vacc', 'Vaccine'), p.vacc]);
    if (isKey(p.worm) || +p.wormEvery) j.push(['worm', K('ui.lp-pet-worm', 'Worming / flea treatment'), nextDue(p.worm, p.wormEvery || 3)]);
    if (isKey(p.food)) j.push(['food', K('ui.lp-pet-food', 'Order food'), p.food]);
    return j.sort(function (a, b) { return a[2] < b[2] ? -1 : 1; });
  }
  /* sleep goal hours from bedtime and wake time ("23:00", "07:00") */
  function goalHours(c) { var b = String(c.bed || '23:00').split(':'), w = String(c.wake || '07:00').split(':'), m = (+w[0] * 60 + +w[1]) - (+b[0] * 60 + +b[1]); if (m <= 0) m += 1440; return m / 60; }
  function sleepCfg() { var c = Fe.tools().sleepcfg; return Object.assign({ bed: '23:00', wake: '07:00', remind: true }, c && typeof c === 'object' ? c : {}); }

  /* ---------- At a glance ---------- */
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    var t = today(), yr = new Date().getFullYear();
    if (on('ready')) {
      var ex = list('ready').filter(function (x) { return isKey(x.exp) && days(t, x.exp) <= 30; });
      if (ex.length) add(58, 'box2-heart', 'var(--warn)', ex.length === 1 ? K('ui.lp-ready-exp1', '{n} in your emergency kit runs out soon', { n: ex[0].name }) : K('ui.lp-ready-exp', '{n} things in your emergency kit run out soon', { n: ex.length }),
        ex.slice(0, 3).map(function (x) { return x.name; }).join(', '), '/cmd/homelife/#lp-ready');
    }
    if (on('ladmin')) list('ladmin').forEach(function (x) {
      if (!/^\d{2}-\d{2}$/.test(x.md || '') || +x.doneY === yr) return;
      var d = yearDate(x.md), n = days(t, d); if (n < -30 || n > (+x.lead || 14)) return;
      add(n < 0 ? 40 : 52, 'clipboard-check', n < 0 ? 'var(--danger)' : 'var(--warn)', x.name, n < 0 ? K('ui.lp-was-due', 'Was due {d}', { d: d.split('-').reverse().slice(0, 2).join('.') }) : n === 0 ? K('ui.lp-due-today', 'Due today') : K('ui.lp-due-in', 'Due in {n} days', { n: n }), '/cmd/lifeadmin/#lp-ladmin', { key: 'lad:' + x.id + ':' + yr });
    });
    if (on('deals')) list('deals').forEach(function (x) {
      var d = nextDue(x.last, x.every || 12); if (d > t) return;
      add(62, 'arrow-left-right', 'var(--blue)', K('ui.lp-deal-check', 'Time to compare: {w}', { w: x.who || x.kind || '' }), x.price ? K('ui.lp-deal-now', 'You pay {a} a month now', { a: kr(x.price) }) : '', '/cmd/lifeadmin/#lp-deals', { key: 'deal:' + x.id + ':' + d });
    });
    if (on('parties')) list('parties').forEach(function (x) {
      if (!isKey(x.date)) return; var n = days(t, x.date); if (n < 0 || n > 14) return;
      var open = String(x.todo || '').split('\n').filter(function (l) { return l.trim() && !/^\s*\[x\]/i.test(l); }).length;
      add(48, 'balloon', 'var(--pink)', n === 0 ? K('ui.lp-party-today', '{t} is today', { t: x.title }) : K('ui.lp-party-in', '{t} in {n} days', { t: x.title, n: n }), open ? K('ui.lp-party-open', '{n} things left to do', { n: open }) : '', '/cmd/homelife/#lp-parties');
    });
    if (on('pets')) list('pets').forEach(function (p) {
      petJobs(p).forEach(function (j) { var n = days(t, j[2]); if (n > 7 || n < -60) return; add(n < 0 ? 44 : 54, 'heart', 'var(--orange)', (p.name || '') + ': ' + j[1], n < 0 ? K('ui.lp-overdue', 'Overdue') : n === 0 ? K('ui.lp-due-today', 'Due today') : K('ui.lp-due-in', 'Due in {n} days', { n: n }), '/cmd/homelife/#lp-pets', { key: 'pet:' + p.id + ':' + j[0] + ':' + j[2] }); });
    });
    if (on('clubs')) list('clubs').forEach(function (c) {
      if (!isKey(c.feeDue)) return; var n = days(t, c.feeDue); if (n < 0 || n > 14) return;
      add(60, 'people', 'var(--violet)', K('ui.lp-club-fee', 'Membership fee: {c}', { c: c.name }), (c.fee ? kr(c.fee) + ' · ' : '') + (n === 0 ? K('ui.lp-due-today', 'Due today') : K('ui.lp-due-in', 'Due in {n} days', { n: n })), '/cmd/homelife/#lp-clubs', { key: 'club:' + c.id + ':' + c.feeDue });
    });
    if (on('digital')) {
      var dd = list('digital').filter(function (x) { return nextDue(x.last, x.every || 12) <= t; });
      if (dd.length) add(66, 'shield-lock', 'var(--slate)', dd.length === 1 ? dd[0].name : K('ui.lp-digital-n', '{n} digital chores are due', { n: dd.length }), dd.slice(0, 3).map(function (x) { return x.name; }).join(', '), '/cmd/lifeadmin/#lp-digital');
    }
    if (on('later') && new Date().getDay() === 0) {
      var un = list('later').filter(function (x) { return !x.read; });
      if (un.length) add(70, 'bookmark', 'var(--blue)', K('ui.lp-later-n', '{n} saved to read or watch', { n: un.length }), un.slice(0, 2).map(function (x) { return x.title || x.url; }).join(', '), '/cmd/me/#lp-later', { key: 'later:' + t });
    }
    if (on('bodycare')) list('bodycare').forEach(function (x) {
      var d = bodyDue(x); if (!d) return; var n = days(t, d); if (n > 7 || n < -90) return;
      add(n < 0 ? 58 : 64, 'scissors', 'var(--blue)', x.title, n < 0 ? K('ui.lp-overdue', 'Overdue') : n === 0 ? K('ui.lp-due-today', 'Due today') : K('ui.lp-due-in', 'Due in {n} days', { n: n }), '/cmd/me/#lp-bodycare', { key: 'body:' + x.id + ':' + d });
    });
    if (on('wins') && new Date().getDay() === 0) {
      var mon = addDays(t, -6), wn = list('wins').filter(function (x) { return (x.date || '') >= mon; }).length;
      if (wn < 3) add(72, 'trophy', 'var(--gold)', K('ui.lp-wins-q', 'Three good things this week?'), K('ui.lp-wins-qs', '{n} written so far', { n: wn }), '/cmd/me/#lp-wins', { key: 'wins:' + t });
    }
    if (on('wheel')) {
      var wl = list('wheel').filter(function (w) { return w && isKey(w.date); }).map(function (w) { return w.date; }).sort().pop();
      if (!wl || days(wl, t) > 90) add(78, 'bullseye', 'var(--accent)', K('ui.lp-wheel-due', 'Time to score your life wheel'), wl ? K('ui.lp-wheel-ago', 'Last time {n} days ago', { n: days(wl, t) }) : K('ui.lp-wheel-first', 'Takes a minute'), '/cmd/me/#lp-wheel', { key: 'wheel:' + t.slice(0, 7) });
    }
    if (on('outdoor')) list('outdoor').forEach(function (x) {
      if (x.done || !isKey(x.date)) return; var n = days(t, x.date); if (n < 0 || n > 2) return;
      add(50, 'tree', 'var(--ok)', n === 0 ? K('ui.lp-trip-today', '{t} today – check the weather', { t: x.title }) : K('ui.lp-trip-in', '{t} in {n} days – check the weather', { t: x.title, n: n }), x.place || '', '/cmd/me/#lp-outdoor');
    });
  });

  /* ---------- the evening push: time to wind down, half an hour before your bedtime ---------- */
  (window.NotifyExtra = window.NotifyExtra || []).push(function (add, o) {
    if (!on('sleep')) return; var c = sleepCfg(); if (!c.remind) return;
    var b = String(c.bed || '23:00').split(':');
    for (var i = 0; i < 7; i++) { var d = new Date(); d.setDate(d.getDate() + i); d.setHours(+b[0], +b[1] - 30, 0, 0); add('sleep:' + o.dkey(d), d.getTime(), K('ui.lp-wind', 'Time to wind down'), K('ui.lp-wind-sub', 'Bedtime in 30 minutes – screens away'), '/cmd/me/#lp-sleep'); }
  });

  /* the cards (life-plus.page.js) load only when a section is on and this page has its slot – most pages never need them */
  var LPP_V = '288ac7e01e';   /* stamped by cmd/build.py */
  var IDS = ['ready', 'hood', 'ladmin', 'deals', 'climate', 'parties', 'moments', 'family', 'pets', 'clubs', 'sleep', 'calm', 'media', 'later', 'digital', 'career', 'outdoor', 'mood', 'wheel', 'wins', 'hobbies', 'bodycare', 'screen', 'style'];
  /* the life pages (Home life · Life admin · Me): a note when none of their sections is on */
  function pgEmpty() {
    document.querySelectorAll('[data-pgempty]').forEach(function (e) {
      var ids = [].map.call(document.querySelectorAll('[data-tool^="lp-"]'), function (x) { return x.getAttribute('data-tool').slice(3); });
      if (ids.length && /^(homelife|lifeadmin|me)$/.test(e.getAttribute('data-pgempty'))) e.hidden = ids.some(on);
    });
  }
  function needCards() {
    pgEmpty();
    if (!document.querySelector('[data-tool^="lp-"]')) return;
    if (!IDS.some(function (i) { return on(i) && document.querySelector('[data-tool="lp-' + i + '"]'); })) return;
    if (needCards.loading === location.pathname) return; needCards.loading = location.pathname;
    var sc = document.createElement('script'); sc.src = '/cmd/dist/life-plus.page.js?v=' + LPP_V; sc.onerror = function () { needCards.loading = ''; }; document.head.appendChild(sc);
  }
  window.addEventListener('features:change', function () { setTimeout(needCards, 30); });
  if (window.Vault.onUnlock) window.Vault.onUnlock(function () { setTimeout(needCards, 40); });
  setTimeout(needCards, 0);
  window.LifePlus = { bodyDue: bodyDue, petJobs: petJobs, nextDue: nextDue, goalHours: goalHours, sleepCfg: sleepCfg, yearDate: yearDate, addDays: addDays, addMonths: addMonths, days: days, isKey: isKey, today: today, kr: kr };
})();
