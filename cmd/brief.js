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
      if (opt) { if (opt.key && dismissed(opt.key)) return; it.key = opt.key; it.act = opt.act; it.review = opt.review; it.tip = opt.tip; it.badge = opt.badge; it.checkin = opt.checkin; if (opt.run && opt.act) ACTIONS[opt.act.id] = opt.run; }
      /* anything can be put away for today (hover ×, or swipe it left on a phone) */
      it.day = 'd:' + today + ':' + title; if (!it.key && dismissed(it.day)) return;
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
        var per = Bu ? Bu.period(d, now) : null;
        var spent = per ? Bu.spent(d, per) : sum((d.expenses || []).filter(function (e) { return String(e.date).slice(0, 7) === ym; }));
        var dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = (per ? per.income : income) - fixed - spent;
        var untilPay = (per && per.byPayday) || (pay && pay.days > 0 && pay.days <= dim);
        var perDay = left / (per && per.byPayday ? per.daysLeft : untilPay ? pay.days : dim - now.getDate() + 1);
        add(left < 0 ? 8 : 50, 'wallet2', left < 0 ? '#e66767' : '#11a597', left < 0 ? kr(-left) + ' over budget' : kr(perDay) + ' to spend today',
          left < 0 ? (per && per.byPayday ? 'Until payday' : 'This month') + ', after fixed costs' : kr(left) + ' left' + (untilPay ? ' until payday' : ' this month'), '#fin');
      }
      if (pay && pay.days <= 2) add(pay.days === 0 ? 12 : 40, 'cash-stack', '#11a597', pay.days === 0 ? pay.title + ' today' : pay.title + ' ' + inDays(pay.days),
        (pay.net ? kr(pay.net) + ' · ' : '') + pay.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }), '#fin', { key: 'pay:' + ym });
      var paid = (d.paid && d.paid[ym]) || [];
      (d.budget.fixed || []).forEach(function (f) {
        if (!f.day || f.src === 'sub' || paid.indexOf(f.id) > -1) return;
        var dd = Math.min(f.day, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) - now.getDate();
        if (dd < 0) add(6, 'exclamation-circle', '#e66767', f.name + ' is overdue', kr(f.amount) + ' · was due ' + (-dd) + ' day' + (dd === -1 ? '' : 's') + ' ago', '#fin', { badge: true });
        else if (dd <= 3) add(15, 'calendar-check', '#c98500', f.name + ' due ' + inDays(dd), kr(f.amount), '#fin', { badge: dd === 0 });
      });
    }

    /* reminders from your tools: renewals, expiring certificates, warranties, health, birthday */
    if (Fe) Fe.events().forEach(function (ev) {
      if (ev.cat || ev.noBrief || ev.id.indexOf('todo:') === 0) return;
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
        if (n3 < 0) add(7, 'person-vcard', '#e66767', (doc.name || 'A travel document') + ' has expired', 'Renew it', 'travel/#docs', { badge: true });
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

    /* to-dos with a day: overdue, today – and tomorrow's in the evening */
    (readJSON('dash.todos') || []).forEach(function (t) {
      if (window.Plan && t.today === dkey(now) && !t.done) return;      // already in today's top 3 line
      if (!t || t.done || !/^\d{4}-\d{2}-\d{2}$/.test(t.due || '')) return;
      var n5 = daysTo(t.due);
      if (n5 < 0) add(13, 'exclamation-square', '#e66767', t.text, 'To-do · was due ' + inDays(n5), '#c=todo');
      else if (n5 === 0) add(22, 'check2-square', '#22b35e', t.text, 'To-do · today', '#c=todo');
      else if (n5 === 1 && now.getHours() >= 17) add(44, 'check2-square', '#22b35e', t.text, 'To-do · tomorrow', '#c=todo');
    });

    /* the weekly check-in: Sunday afternoon and Monday */
    if (window.Checkin) { var ci = window.Checkin.due(now); if (ci) add(26, 'clipboard-check', '#8a6fdf', 'Weekly check-in', ci.sub, '#checkin', { checkin: true }); }
    /* Plan my day: in the morning until you've planned; after that, today's top 3 */
    if (window.Plan) {
      var tk = dkey(now), all3 = (readJSON('dash.todos', []) || []).filter(function (t) { return t.today === tk; }), open3 = all3.filter(function (t) { return !t.done; });
      if (all3.length) add(open3.length ? 12 : 40, open3.length ? 'trophy' : 'trophy-fill', '#c98500', open3.length ? 'Today: ' + open3.sort(function (a, b) { return (a.rank || 9) - (b.rank || 9); }).map(function (t) { return t.text; }).join(' · ') : 'Top 3 done 🎉',
        (all3.length - open3.length) + ' of ' + all3.length + ' done' + (open3.some(function (t) { return t.block; }) ? ' · in your calendar' : ''), '#plan');
      else if (now.getHours() >= 5 && now.getHours() < 13) { var seen = ''; try { seen = localStorage.getItem('dash.planSeen'); } catch (e) {} if (seen !== tk) add(14, 'sunrise', '#c98500', 'Plan your day', 'Pick your top 3 and give them a time – 1 minute', '#plan'); }
    }

    /* work: clocked in */
    if (Fe && Fe.on('flex')) {
      var open = Fe.list('flex').filter(function (e) { return e.date === today && e.in && !e.out; })[0];
      if (open) add(25, 'stopwatch', '#e8743b', 'Clocked in at ' + open.in, 'Remember to clock out', 'work/');
    }
    /* lines from the optional features (Meeting prep, Trip budget, Rest day, Strømpris …) */
    (window.BriefExtra || []).forEach(function (fn) { try { fn(add, now, today); } catch (e) {} });
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
      /* at this pace … (the same period as the Money card: the month, or payday to payday) */
      var pc = window.Budget && window.Budget.pace ? window.Budget.pace(d, now) : null;
      if (pc && !pc.ok && pc.room > 0) add(24, 'speedometer2', '#e8743b', 'At this pace: ' + kr(-pc.end) + ' over by ' + (pc.per.byPayday ? 'payday' : 'the end of the month'),
        'You spend about ' + kr(pc.perDay) + ' a day – ' + kr(Math.max(0, (pc.room - pc.spent) / pc.per.daysLeft)) + ' a day keeps you on budget', '#fin', { key: 'pace:' + pc.per.startKey + ':' + Math.round(-pc.end / 500) });
      recurring(add, d, now);
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

    /* Apple Health: a short night, or the Shortcut has gone quiet */
    if (window.AHealth && Fe && Fe.on('ahealth')) {
      var AH = window.AHealth, sl = AH.latest('sleep'), lastH = ((d || {}).health || {}).last;
      if (sl && sl.date >= dkey(new Date(now.getTime() - 864e5)) && sl.v < 6 && sl.v > 0)
        add(57, 'moon-stars', '#8a6fdf', 'Short night: ' + AH.fmt('sleep', sl.v), 'Go easy today – and maybe to bed a bit earlier', 'habits/', { key: 'sleep:' + sl.date, tip: true });
      if (lastH && Date.now() - lastH > 3 * 864e5)
        add(64, 'apple', '#e66767', 'Nothing from Apple Health for ' + Math.floor((Date.now() - lastH) / 864e5) + ' days', 'Check that the Shortcut automation still runs', '?settings=ahealth', { key: 'ahstale:' + today, tip: true });
    }

    /* a backup once a month (the encrypted file, kept wherever you like) */
    if (d) {
      var lb = d.lastBackup || +localStorage.getItem('dash.lastBackup') || 0, age = lb ? Math.floor((Date.now() - lb) / 864e5) : null;
      var much = (d.expenses || []).length + (readJSON('dash.todos') || []).length > 8;
      if ((age === null && much) || age >= 30) {
        ACTIONS['backup:' + ym] = function () { window.Vault.backup(); };
        add(56, 'shield-check', '#11a597', 'Time for a backup', age === null ? 'You haven’t downloaded one yet – it takes a second' : 'Last one ' + age + ' days ago', '?settings=data',
          { key: 'backupx:' + ym, act: { id: 'backup:' + ym, label: 'Download' } });
      }
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

  /* charges that come back every month: a subscription you haven't added – or one whose price went up */
  function recurring(add, d, now) {
    var S = window.Smart; if (!S) return;
    var since = dkey(new Date(now.getFullYear(), now.getMonth() - 3, 1)), by = {};
    (d.expenses || []).forEach(function (e) {
      if (!e.note || String(e.date) < since || e.cat === 'groceries' || e.cat === 'travel') return;
      var k = S.norm(e.note); if (k.length < 3) return;
      (by[k] = by[k] || []).push(e);
    });
    var subs = Fe && Fe.on('subs') ? Fe.list('subs') : [], fixed = (d.budget && d.budget.fixed) || [];
    var known = function (k) { return subs.concat(fixed).some(function (x) { var n = S.norm(x.name); return n && (k.indexOf(n) > -1 || n.indexOf(k) > -1); }); };
    var subOf = function (k) { return subs.filter(function (x) { var n = S.norm(x.name); return n && !x.paused && (k.indexOf(n) > -1 || n.indexOf(k) > -1); })[0]; };
    Object.keys(by).forEach(function (k) {
      var l = by[k].sort(function (a, b) { return a.date > b.date ? 1 : -1; }), months = {};
      l.forEach(function (e) { var m = String(e.date).slice(0, 7); months[m] = (months[m] || 0) + 1; });
      var ms = Object.keys(months);
      if (ms.length < 2 || ms.some(function (m) { return months[m] > 1; })) return;          // once a month, at least twice
      var last = l[l.length - 1], prev = l[l.length - 2], days = l.map(function (e) { return +String(e.date).slice(8, 10); });
      if (Math.max.apply(null, days) - Math.min.apply(null, days) > 6) return;               // around the same day
      var amts = l.map(function (e) { return +e.amount; }), lo = Math.min.apply(null, amts), hi = Math.max.apply(null, amts);
      var sub = subOf(k), name = last.note;
      if (sub) {
        if (Math.abs(+sub.amount - last.amount) >= 5 && Math.abs(+sub.amount - last.amount) / last.amount > .03) {
          var id1 = 'subprice:' + sub.id + ':' + Math.round(last.amount);
          ACTIONS[id1] = function () { var t = Fe.tools(); (t.subs || []).forEach(function (x) { if (x.id === sub.id) x.amount = last.amount; }); Fe.saveTools(t); };
          add(46, 'tags', '#e8743b', sub.name + ' now costs ' + kr(last.amount), 'Your subscription says ' + kr(+sub.amount) + ' – your bank says ' + kr(last.amount), '#fin', { key: id1, act: { id: id1, label: 'Update price' } });
        }
        return;
      }
      if (known(k)) return;
      if (ms.length < 3 && !(last.cat === 'fun' || hi === lo)) return;                     // two months is enough only for the obvious ones
      if (hi - lo > lo * .1 && hi - lo >= 10) {
        /* not steady enough for a subscription – but did it just get more expensive? */
        if (l.length >= 2 && last.amount > prev.amount * 1.03 && last.amount - prev.amount >= 5 && Math.abs(prev.amount - l[0].amount) <= prev.amount * .03)
          add(60, 'tags', '#e8743b', name + ' went up', kr(prev.amount) + ' → ' + kr(last.amount) + ' a month', '#fin', { key: 'up:' + k + ':' + Math.round(last.amount), tip: true });
        return;
      }
      var id = 'recur:' + k, day = +String(last.date).slice(8, 10);
      ACTIONS[id] = function () {
        var dd = window.Vault.get(), per = window.Budget ? window.Budget.period(dd, now) : null;
        /* from now on it's a fixed cost: this period's charge is already counted by it */
        if (per) dd.expenses = (dd.expenses || []).filter(function (e) { return !(e.note && S.norm(e.note) === k && per.has(e.date)); });
        if (Fe && Fe.on('subs')) {
          var nx = new Date(now.getFullYear(), now.getMonth() + (day <= now.getDate() ? 1 : 0), day);
          window.Vault.save(dd);
          var t = Fe.tools(); t.subs = t.subs || [];
          t.subs.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, amount: last.amount, period: 'monthly', renews: dkey(nx), cat: last.cat === 'fun' ? 'streaming' : 'other', notes: 'Found in your bank import' });
          Fe.saveTools(t);
        } else {
          dd.budget = dd.budget || { income: [], fixed: [] }; dd.budget.fixed = dd.budget.fixed || [];
          var fid = Date.now().toString(36);
          dd.budget.fixed.push({ id: fid, name: name, amount: Math.round(last.amount), day: day });
          /* this month's charge has been paid already */
          if (String(last.date).slice(0, 7) === dkey(now).slice(0, 7)) { dd.paid = dd.paid || {}; var pk = dkey(now).slice(0, 7); (dd.paid[pk] = dd.paid[pk] || []).push(fid); }
          window.Vault.save(dd);
        }
        window.dispatchEvent(new Event('fin:change'));
      };
      add(47, 'arrow-repeat', '#11a597', name + ' looks like a subscription', kr(last.amount) + ' around the ' + day + '. every month · ' + ms.length + ' months so far', '#fin',
        { key: id, act: { id: id, label: Fe && Fe.on('subs') ? 'Add to subscriptions' : 'Make it a fixed cost' } });
    });
  }

  var unlocked = false, showAll = false, tipsOpen = false;
  /* tips (streaks, unusual spending, suggestions): shown, folded into one line, or off – Settings → Dashboard */
  function tipsMode() { var s = readJSON('dash.settings') || {}; return s.tips === 'show' || s.tips === 'off' ? s.tips : 'fold'; }
  function render() {
    if (!unlocked) return;
    var all = items(), mode = tipsMode(), folding = mode !== 'show';
    var tips = folding ? all.filter(function (x) { return x.tip || x.act; }) : [];
    var main = folding ? all.filter(function (x) { return !(x.tip || x.act); }) : all;
    var shown = showAll ? main.slice() : main.slice(0, 5);
    if (mode === 'fold' && tips.length) {
      shown.push({ fold: true, icon: 'lightbulb', color: '#c9a227', title: tips.length + ' tip' + (tips.length === 1 ? '' : 's'),
        sub: tips.slice(0, 2).map(function (x) { return x.title; }).join(' · ') + (tips.length > 2 ? ' …' : '') });
      if (tipsOpen) shown = shown.concat(tips);
    }
    /* the app icon shows how many things need you right now (overdue bills, bills due today, expired documents) */
    var urgent = all.filter(function (x) { return x.badge; }).length;
    try { if (navigator.setAppBadge) { if (urgent) navigator.setAppBadge(urgent); else navigator.clearAppBadge(); } } catch (e) {}
    box.innerHTML = shown.length ? shown.map(function (x) {
      if (x.fold) return '<li class="br-li br-fold"><button type="button" class="br-item" data-brfold aria-expanded="' + tipsOpen + '" style="--c:' + x.color + '"><span class="br-ic"><i class="bi bi-' + x.icon + '"></i></span>' +
        '<span class="br-x"><b>' + esc(x.title) + '</b><small>' + esc(tipsOpen ? 'Tap to fold them away' : x.sub) + '</small></span><i class="bi bi-chevron-' + (tipsOpen ? 'up' : 'down') + ' br-go"></i></button></li>';
      return '<li class="br-li' + (x.tip || x.act ? ' br-tip' : '') + '"><a class="br-item" href="' + esc(x.href) + '"' + (x.review ? ' data-review="' + esc(x.review) + '"' : '') + ' style="--c:' + x.color + '"><span class="br-ic"><i class="bi bi-' + x.icon + '"></i></span>' +
        '<span class="br-x"><b>' + esc(x.title) + '</b><small>' + esc(x.sub) + '</small></span>' + (x.act || x.key ? '' : '<i class="bi bi-chevron-right br-go"></i>') + '</a>' +
        (x.act ? '<button type="button" class="pill-btn br-act" data-bract="' + esc(x.act.id) + '">' + esc(x.act.label) + '</button>' : '') +
        (x.key ? '<button type="button" class="br-x-btn" data-brx="' + esc(x.key) + '" aria-label="Not now" title="Not now"><i class="bi bi-x"></i></button>'
          : x.day && !x.badge ? '<button type="button" class="br-x-btn br-soft" data-brx="' + esc(x.day) + '" aria-label="Hide for today" title="Hide for today"><i class="bi bi-x"></i></button>' : '') + '</li>';
    }).join('') + (main.length > 5 ? '<li><button type="button" class="text-btn br-more" data-brmore>' + (showAll ? 'Show less' : 'Show all ' + main.length) + '</button></li>' : '')
      : '<li class="br-calm"><i class="bi bi-check2-circle"></i> Nothing needs you right now. Enjoy the day.</li>';
  }
  box.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-brmore]')) { showAll = !showAll; render(); return; }
    if (e.target.closest('[data-brfold]')) { tipsOpen = !tipsOpen; render(); return; }
    if ((b = e.target.closest('[data-brx]'))) { dismiss(b.dataset.brx, /^d:/.test(b.dataset.brx) ? 1 : undefined); var li = b.closest('li'); li.classList.add('br-gone'); setTimeout(render, 220); return; }
    if ((b = e.target.closest('[data-bract]'))) { if (ACTIONS[b.dataset.bract]) ACTIONS[b.dataset.bract](); dismiss(b.dataset.bract, 365); b.textContent = 'Done ✓'; setTimeout(render, 700); return; }
    var ck = e.target.closest('a[href="#checkin"]');
    if (ck) { e.preventDefault(); if (window.Checkin) window.Checkin.open(); return; }
    var td = e.target.closest('a[href="#c=todo"]');
    if (td) { e.preventDefault(); var tc = document.querySelector('.card.todo'); if (tc) { tc.scrollIntoView({ behavior: 'smooth', block: 'center' }); tc.classList.add('sr-flash'); setTimeout(function () { tc.classList.remove('sr-flash'); }, 1600); } return; }
    var a = e.target.closest('a[href="#fin"]');
    if (a) { e.preventDefault(); var f = document.getElementById('fin'); if (f) f.scrollIntoView({ behavior: 'smooth' }); }
  });
  /* phone: swipe a line to the left to hide it for today */
  (function () {
    var sw = null;
    box.addEventListener('touchstart', function (e) { var li = e.target.closest('.br-li'); if (!li || !li.querySelector('[data-brx]') || e.touches.length > 1) { sw = null; return; } sw = { li: li, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, on: false }; }, { passive: true });
    box.addEventListener('touchmove', function (e) {
      if (!sw) return; var dx = e.touches[0].clientX - sw.x, dy = e.touches[0].clientY - sw.y;
      if (!sw.on) { if (Math.abs(dy) > 10) { sw = null; return; } if (dx < -12) sw.on = true; else return; }
      sw.dx = Math.min(0, dx); sw.li.style.transform = 'translateX(' + sw.dx + 'px)'; sw.li.style.opacity = String(1 + sw.dx / 260);
    }, { passive: true });
    box.addEventListener('touchend', function () {
      if (!sw) return; var s = sw; sw = null;
      if (s.dx < -90) { var b = s.li.querySelector('[data-brx]'); dismiss(b.dataset.brx, /^d:/.test(b.dataset.brx) ? 1 : undefined); s.li.classList.add('br-gone'); setTimeout(render, 200); }
      else { s.li.style.transform = ''; s.li.style.opacity = ''; }
    });
  })();
  ['brief:refresh', 'review:seen', 'plan:change', 'checkin:done', 'tips:change', 'dash:backup', 'todos:change', 'cal:change', 'tools:change', 'travel:change', 'fin:change', 'habits:change', 'features:change', 'profile:change'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(render, 0); }); });
  setInterval(render, 60000);
  window.Vault.onUnlock(function () { unlocked = true; setTimeout(render, 50); });
  window.Vault.onLock(function () { unlocked = false; box.innerHTML = ''; });
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
})();
