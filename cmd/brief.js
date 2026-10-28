/* "Today at a glance": one card that pulls the important things from every part of the
   dashboard – what's next, money left today, bills and renewals, things that expire,
   habits that need you this week, your next trip. Each line opens where it came from. */
(function () {
  "use strict";
  var box = document.getElementById('briefList');
  if (!box || !window.Vault) return;
  var Fe = window.Features, C = window.Cal, Fl = window.Flow;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function daysTo(k) { var t = new Date(); return Math.round((fromKey(k) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5); }
  function inDays(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? (-n) + ' day' + (n === -1 ? '' : 's') + ' ago' : 'in ' + n + ' days'; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n)) + ' kr'; }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /* suggestions you've waved away stay away (on this device) */
  function dismissed(k) { var d = readJSON('dash.dismiss') || {}; return d[k] && d[k] > Date.now(); }
  function dismiss(k, days) {
    var d = readJSON('dash.dismiss') || {};
    Object.keys(d).forEach(function (x) { if (d[x] < Date.now()) delete d[x]; });
    d[k] = Date.now() + (days || 60) * 864e5;
    try { localStorage.setItem('dash.dismiss', JSON.stringify(d)); } catch (e) {}
  }
  var ACTIONS = {};

  function items() {
    var out = [], now = new Date(), today = dkey(now);
    function add(pri, icon, color, title, sub, href, opt) {
      var it = { pri: pri, icon: icon, color: color, title: title, sub: sub, href: href };
      if (opt) { if (opt.key && dismissed(opt.key)) return; it.key = opt.key; it.act = opt.act; it.review = opt.review; it.tip = opt.tip; }
      out.push(it);
    }
    ACTIONS = {};

    /* reviews: the monthly check-in (1st–7th) and the year in review (mid-December) */
    if (window.Review) window.Review.due().forEach(function (r) {
      add(r.kind === 'year' ? 3 : 4, r.kind === 'year' ? 'stars' : 'calendar-heart', '#8a6fdf', r.title, r.sub, '#', { review: r.kind + ':' + r.key });
    });

    /* public holiday today / tomorrow */
    if (Fe) {
      var h0 = Fe.holiday(today), h1 = Fe.holiday(dkey(new Date(now.getTime() + 864e5)));
      if (h0) add(5, 'flag', '#e66767', h0.name, 'Public holiday today', 'calendar/');
      else if (h1) add(40, 'flag', '#e66767', h1.name + ' tomorrow', 'Public holiday', 'calendar/');
    }

    /* what's next in the calendar (rest of today and tomorrow morning) */
    if (C && (!Fe || Fe.on('calendar'))) {
      var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
      var occ = C.occurrences(new Date(now.getFullYear(), now.getMonth(), now.getDate()), end, { card: true })
        .filter(function (o) { return !o.ev.holiday && !o.ev.reminder; });
      var timed = occ.filter(function (o) { return !o.allDay && o.end > now; });
      var next = timed[0];
      if (next) {
        var mins = Math.round((next.start - now) / 60000), when;
        if (mins <= 0) when = 'now, until ' + hm(next.end);
        else if (C.sameDay(next.start, now)) when = mins < 60 ? 'in ' + mins + ' min' : 'at ' + hm(next.start);
        else when = 'tomorrow at ' + hm(next.start);
        add(mins <= 120 ? 10 : 30, 'calendar-event', next.color, next.title, when.charAt(0).toUpperCase() + when.slice(1) +
          (next.ev.location ? ' · ' + next.ev.location : '') + (timed.length > 1 && C.sameDay(timed[1].start, now) ? ' · then ' + timed[1].title + ' ' + hm(timed[1].start) : ''),
          'calendar/#d=' + dkey(next.start));
      }
      var allDay = occ.filter(function (o) { return o.allDay && C.sameDay(o.start, now) && !o.ev.trip; });
      if (allDay.length && !next) add(35, 'calendar-check', allDay[0].color, allDay[0].title + (allDay.length > 1 ? ' + ' + (allDay.length - 1) + ' more' : ''), 'Today', 'calendar/#d=' + today);
    }

    /* money: what you can spend today, bills coming up */
    var d = window.Vault.get();
    if (d && d.budget && (!Fe || Fe.on('finance'))) {
      var sum = function (l) { return (l || []).reduce(function (a, x) { return a + (+x.amount || 0); }, 0); };
      var Bu = window.Budget;
      var ym = today.slice(0, 7), income = Bu ? Bu.income(d, ym) : sum(d.budget.income), fixed = sum(d.budget.fixed);
      var pay = Bu ? Bu.nextPayday(d, now) : null;
      if (income > 0) {
        var spent = sum((d.expenses || []).filter(function (e) { return String(e.date).slice(0, 7) === ym; }));
        var dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = income - fixed - spent;
        var untilPay = pay && pay.days > 0 && pay.days <= dim;
        var perDay = left / (untilPay ? pay.days : dim - now.getDate() + 1);
        add(left < 0 ? 8 : 50, 'wallet2', left < 0 ? '#e66767' : '#11a597', left < 0 ? kr(-left) + ' over budget' : kr(perDay) + ' to spend today',
          left < 0 ? 'This month, after fixed costs' : kr(left) + ' left' + (untilPay ? ' until payday' : ' this month'), '#fin');
      }
      if (pay && pay.days <= 2) add(pay.days === 0 ? 12 : 40, 'cash-stack', '#11a597', pay.days === 0 ? pay.title + ' today' : pay.title + ' ' + inDays(pay.days),
        (pay.net ? kr(pay.net) + ' · ' : '') + pay.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }), '#fin', { key: 'pay:' + ym });
      var paid = (d.paid && d.paid[ym]) || [];
      (d.budget.fixed || []).forEach(function (f) {
        if (!f.day || f.src === 'sub' || paid.indexOf(f.id) > -1) return;
        var dd = Math.min(f.day, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) - now.getDate();
        if (dd < 0) add(6, 'exclamation-circle', '#e66767', f.name + ' is overdue', kr(f.amount) + ' · was due ' + (-dd) + ' day' + (dd === -1 ? '' : 's') + ' ago', '#fin');
        else if (dd <= 3) add(15, 'calendar-check', '#c98500', f.name + ' due ' + inDays(dd), kr(f.amount), '#fin');
      });
    }

    /* reminders from your tools: renewals, expiring certificates, warranties, health, birthday */
    if (Fe) Fe.events().forEach(function (ev) {
      if (ev.cat) return;
      var start = ev.start, k = dkey(start), n = daysTo(k);
      if (ev.rule) { var nx = ev.id.indexOf('sub:') > -1 ? Fe.nextRenewal(Fe.list('subs').filter(function (s) { return 'rem:sub:' + s.id === ev.id; })[0] || {}) : null;
        if (ev.id === 'rem:bday') { var b = new Date(now.getFullYear(), start.getMonth(), start.getDate()); if (b < new Date(now.getFullYear(), now.getMonth(), now.getDate())) b.setFullYear(b.getFullYear() + 1); nx = dkey(b); }
        if (!nx) return; k = nx; n = daysTo(k); }
      if (n < 0 || n > (ev.id === 'rem:bday' ? 0 : ev.id.indexOf('sub:') > -1 ? 3 : 14)) return;
      add(n <= 2 ? 12 : 45, ev.id === 'rem:bday' ? 'balloon' : 'bell', '#c9a227', ev.id === 'rem:bday' ? 'Happy birthday!' : ev.title,
        ev.id === 'rem:bday' ? 'Have a great day' : inDays(n).charAt(0).toUpperCase() + inDays(n).slice(1), (ev.link || '').replace(/^\/cmd\//, ''));
    });

    /* travel: documents that run out, the next trip */
    if (Fl && (!Fe || Fe.on('travel'))) {
      var t = Fl.travel();
      var trip = t.trips.filter(function (x) { return (x.end || x.start) >= today; }).sort(function (a, b) { return a.start > b.start ? 1 : -1; })[0];
      if (trip) {
        var n2 = daysTo(trip.start), name = trip.name || trip.dest;
        if (n2 <= 0) {
          var day = -n2 + 1, total = daysTo(trip.end || trip.start) - n2 + 1;
          add(20, 'suitcase-lg', '#0891b2', name, 'Day ' + day + ' of ' + total, 'travel/#trip=' + trip.id);
        } else if (n2 <= 60) add(n2 <= 7 ? 18 : 55, 'suitcase-lg', '#0891b2', name + ' ' + inDays(n2), new Date(fromKey(trip.start)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
          (n2 <= 14 && !(trip.pack || []).length ? ' · no packing list yet' : ''), 'travel/#trip=' + trip.id);
      }
      t.docs.forEach(function (doc) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.expires || '')) return;
        var n3 = daysTo(doc.expires), beforeTrip = trip && doc.expires <= (trip.end || trip.start);
        if (n3 < 0) add(7, 'person-vcard', '#e66767', (doc.name || 'A travel document') + ' has expired', 'Renew it', 'travel/#docs');
        else if (beforeTrip) add(9, 'person-vcard', '#e66767', (doc.name || 'A travel document') + ' runs out before ' + (trip.name || 'your trip'), 'Expires ' + inDays(n3), 'travel/#docs');
        else if (n3 <= 60) add(42, 'person-vcard', '#c98500', (doc.name || 'Document') + ' expires ' + inDays(n3), 'Time to renew', 'travel/#docs');
      });
    }

    /* habits: which ones need you this week */
    var hb = readJSON('dash.habits');
    if (hb && hb.list && (!Fe || Fe.on('habits'))) {
      var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7), daysLeft = 7 - (now.getDay() + 6) % 7;
      hb.list.forEach(function (h) {
        var n4 = 0, doneToday = ((hb.log || {})[today] || []).indexOf(h.id) > -1;
        for (var i = 0; i < 7; i++) { var k2 = dkey(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i)); if (((hb.log || {})[k2] || []).indexOf(h.id) > -1) n4++; }
        var need = h.target - n4;
        if (need <= 0) return;
        var tight = need >= daysLeft - (doneToday ? 1 : 0);
        if (tight || daysLeft <= 3) add(tight ? 16 : 48, 'activity', '#d55181', h.name + ': ' + n4 + ' of ' + h.target + ' this week',
          need + ' more · ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' left' + (doneToday ? '' : ' – today counts'), 'habits/');
      });
    }

    /* work: clocked in */
    if (Fe && Fe.on('flex')) {
      var open = Fe.list('flex').filter(function (e) { return e.date === today && e.in && !e.out; })[0];
      if (open) add(25, 'stopwatch', '#e8743b', 'Clocked in at ' + open.in, 'Remember to clock out', 'work/');
    }
    suggestions(add, now, today);
    return out.sort(function (a, b) { return a.pri - b.pri; });
  }

  /* ---------- smart suggestions: noticed from your own data, each can be waved away ---------- */
  function suggestions(add, now, today) {
    var d = window.Vault.get(), ym = today.slice(0, 7), day = now.getDate(), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var sum = function (l) { return (l || []).reduce(function (a, x) { return a + (+x.amount || 0); }, 0); };
    var shiftYm = function (n) { var x = new Date(now.getFullYear(), now.getMonth() + n, 1); return x.getFullYear() + '-' + pad(x.getMonth() + 1); };
    var NAMES = { groceries: 'Groceries', eating: 'Eating out', transport: 'Transport', shopping: 'Shopping', fun: 'Fun', health: 'Health', other: 'Other' };

    if (d && (!Fe || Fe.on('finance'))) {
      var ex = d.expenses || [], income = window.Budget ? window.Budget.income(d, ym) : sum((d.budget || {}).income), fixed = sum((d.budget || {}).fixed);
      /* a category well above your usual pace (not counting travel) */
      if (day >= 7) Object.keys(NAMES).forEach(function (c) {
        var now_ = sum(ex.filter(function (e) { return e.cat === c && String(e.date).slice(0, 7) === ym; }));
        var prev = [1, 2, 3].map(function (i) { var k = shiftYm(-i); return sum(ex.filter(function (e) { return e.cat === c && String(e.date).slice(0, 7) === k; })); });
        var avg = prev.reduce(function (a, x) { return a + x; }, 0) / 3, expected = avg * day / dim;
        if (avg > 0 && now_ > expected * 1.3 && now_ - expected > 500)
          add(58, 'graph-up-arrow', '#e8743b', NAMES[c] + ': ' + Math.round((now_ / expected - 1) * 100) + '% more than usual', kr(now_) + ' so far this month · usually about ' + kr(expected) + ' by now', '#fin', { key: 'sp:' + c + ':' + ym, tip: true });
      });
      /* at this pace … */
      if (income > 0 && day >= 10 && day < dim) {
        var spent = sum(ex.filter(function (e) { return String(e.date).slice(0, 7) === ym && e.cat !== 'travel'; }));
        var pace = spent / day * dim, room = income - fixed;
        if (pace > room && room > 0) add(54, 'speedometer2', '#e66767', 'At this pace: ' + kr(pace - room) + ' over budget', 'By the end of ' + now.toLocaleDateString('en-GB', { month: 'long' }) + ' (travel not counted)', '#fin', { key: 'pace:' + ym, tip: true });
      }
      if (!income && !(d.expenses || []).length) add(90, 'pie-chart', '#11a597', 'Set up your monthly budget', 'Then you’ll see what you can spend each day', '#fin', { key: 'setup:budget', tip: true });
    }

    if (Fl) {
      var trips = Fl.travel().trips.filter(function (t) { return t.start > today; }).sort(function (a, b) { return a.start > b.start ? 1 : -1; });
      /* workdays during a trip → holiday in Flex time */
      if (Fe && Fe.on('flex')) trips.filter(function (t) { return daysTo(t.start) <= 90; }).forEach(function (t) {
        var logged = {}; Fe.list('flex').forEach(function (e) { logged[e.date] = 1; });
        var days = [], x = fromKey(t.start), end = fromKey(t.end || t.start);
        for (var i = 0; x <= end && i < 60; i++, x.setDate(x.getDate() + 1)) { var k = dkey(x), wd = x.getDay(); if (wd && wd < 6 && !Fe.holiday(k) && !logged[k]) days.push(k); }
        if (!days.length) return;
        var id = 'flex:' + t.id;
        ACTIONS[id] = function () {
          var tl = Fe.tools(); tl.flex = tl.flex || [];
          days.forEach(function (k) { tl.flex.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: k, type: 'vacation', note: t.name }); });
          Fe.saveTools(tl);
        };
        add(52, 'sun', '#e8743b', days.length + ' workday' + (days.length > 1 ? 's' : '') + ' during ' + (t.name || 'your trip'), 'Mark ' + (days.length > 1 ? 'them' : 'it') + ' as holiday (ferie) in Flex time?', 'work/', { key: id, act: { id: id, label: 'Mark as holiday' } });
      });
    }

    /* habits going well */
    var hb = readJSON('dash.habits');
    if (hb && hb.list) hb.list.forEach(function (h) {
      var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7), streak = 0;
      for (var w = 1; w < 60; w++) {
        var n = 0;
        for (var i = 0; i < 7; i++) { var k = dkey(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - 7 * w + i)); if (((hb.log || {})[k] || []).indexOf(h.id) > -1) n++; }
        if (n >= h.target) streak++; else break;
      }
      if (streak >= 3) add(70, 'fire', '#d55181', h.name + ': ' + streak + ' weeks in a row', 'Keep it going this week', 'habits/', { key: 'streak:' + h.id + ':' + streak, tip: true });
    });

    /* journal in the evening */
    if (Fe && Fe.on('journal') && now.getHours() >= 19 && !Fe.list('journal').some(function (j) { return j.date === today; }))
      add(65, 'journal-bookmark', '#c9a227', 'How was today?', 'One line in your journal', 'habits/#journal', { key: 'journal:' + today, tip: true });
  }

  var unlocked = false, showAll = false;
  function render() {
    if (!unlocked) return;
    var list = items(), shown = showAll ? list : list.slice(0, 5);
    box.innerHTML = list.length ? shown.map(function (x) {
      return '<li class="br-li' + (x.tip || x.act ? ' br-tip' : '') + '"><a class="br-item" href="' + esc(x.href) + '"' + (x.review ? ' data-review="' + esc(x.review) + '"' : '') + ' style="--c:' + x.color + '"><span class="br-ic"><i class="bi bi-' + x.icon + '"></i></span>' +
        '<span class="br-x"><b>' + esc(x.title) + '</b><small>' + esc(x.sub) + '</small></span>' + (x.act || x.key ? '' : '<i class="bi bi-chevron-right br-go"></i>') + '</a>' +
        (x.act ? '<button type="button" class="pill-btn br-act" data-bract="' + esc(x.act.id) + '">' + esc(x.act.label) + '</button>' : '') +
        (x.key ? '<button type="button" class="br-x-btn" data-brx="' + esc(x.key) + '" aria-label="Not now" title="Not now"><i class="bi bi-x"></i></button>' : '') + '</li>';
    }).join('') + (list.length > 5 ? '<li><button type="button" class="text-btn br-more" data-brmore>' + (showAll ? 'Show less' : 'Show all ' + list.length) + '</button></li>' : '')
      : '<li class="br-calm"><i class="bi bi-check2-circle"></i> Nothing needs you right now. Enjoy the day.</li>';
  }
  box.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-brmore]')) { showAll = !showAll; render(); return; }
    if ((b = e.target.closest('[data-brx]'))) { dismiss(b.dataset.brx); var li = b.closest('li'); li.classList.add('br-gone'); setTimeout(render, 220); return; }
    if ((b = e.target.closest('[data-bract]'))) { if (ACTIONS[b.dataset.bract]) ACTIONS[b.dataset.bract](); dismiss(b.dataset.bract, 365); b.textContent = 'Done ✓'; setTimeout(render, 700); return; }
    var a = e.target.closest('a[href="#fin"]');
    if (a) { e.preventDefault(); var f = document.getElementById('fin'); if (f) f.scrollIntoView({ behavior: 'smooth' }); }
  });
  ['review:seen', 'cal:change', 'tools:change', 'travel:change', 'fin:change', 'habits:change', 'features:change', 'profile:change'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(render, 0); }); });
  setInterval(render, 60000);
  window.Vault.onUnlock(function () { unlocked = true; setTimeout(render, 50); });
  window.Vault.onLock(function () { unlocked = false; box.innerHTML = ''; });
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
})();
