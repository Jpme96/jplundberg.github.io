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
        ex.slice(0, 3).map(function (x) { return x.name; }).join(', '), '/cmd/house/#lp-ready');
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
    if (on('usefood')) { var uf = list('usefood').filter(function (x) { return !x.done && isKey(x.by) && x.by <= addDays(t, 1) && x.by >= addDays(t, -2); }); if (uf.length) add(60, 'clock-history', 'var(--warn)', K('ui.lp-use-q', 'Use it up: {t}', { t: uf.map(function (x) { return x.title; }).slice(0, 3).join(', ') }), K('ui.lp-use-qs', 'Before it goes off'), '/cmd/food/#lp-usefood', { key: 'use:' + t }); }
    if (on('returns')) list('returns').forEach(function (x) {
      if ((x.state || 'open') !== 'open' || !isKey(x.got)) return; var d = addDays(x.got, +x.days || 14), n = days(t, d); if (n < 0 || n > 3) return;
      add(n <= 1 ? 52 : 62, 'arrow-return-left', 'var(--orange)', K('ui.lp-ret-q', 'Return {t}?', { t: x.title }), n === 0 ? K('ui.lp-ret-today', 'Today is the last day') : K('ui.lp-ret-in', 'Last day in {n} days', { n: n }), '/cmd/papers/#lp-returns', { key: 'ret:' + x.id });
    });
    if (on('thanks')) { var ty = list('thanks').filter(function (x) { return !x.done && isKey(x.date) && days(x.date, t) >= 2 && days(x.date, t) <= 60; }); if (ty.length) add(74, 'envelope-heart', 'var(--pink)', K('ui.lp-ty-q', 'Say thanks for {n} gifts', { n: ty.length }), ty.slice(0, 3).map(function (x) { return x.what; }).join(', '), '/cmd/people/#lp-thanks', { key: 'ty:' + t.slice(0, 7) + ':' + ty.length }); }
    if (on('freezer') && new Date().getHours() >= 15) { var dnr = dinnerFor(addDays(t, 1)); if (dnr && dnr.frz.length) add(56, 'snow', 'var(--blue)', K('ui.lp-thaw-q', 'Take {f} out of the freezer', { f: dnr.frz.join(', ') }), K('ui.lp-thaw-s', 'For tomorrow’s dinner: {d}', { d: dnr.text }), '/cmd/food/#lp-freezer', { key: 'thaw:' + t }); }
    if (on('thanks')) {   /* gifts to note: just after Christmas and your own birthday */
      var md = t.slice(5), pb = window.Profile && Profile.load ? (Profile.load() || {}).birthday : '', after = function (m) { if (!/^\d{2}-\d{2}$/.test(m)) return false; for (var i = 1; i <= 3; i++) if (addDays(yearDate(m), i) === t) return true; return false; };
      if ((md >= '12-25' && md <= '12-27') || (isKey(pb) && after(pb.slice(5)))) add(70, 'envelope-heart', 'var(--pink)', K('ui.lp-ty-note', 'Got gifts? Note who gave what'), K('ui.lp-ty-note-s', 'Then tick them off as you say thanks'), '/cmd/people/#lp-thanks', { key: 'tynote:' + t.slice(0, 7) + md.slice(0, 2), act: { id: 'tynote:' + t, label: K('ui.add', 'Add') }, run: function () { if (window.Quick) Quick.open('thanks'); } });
    }
    if (on('outdoor')) list('outdoor').forEach(function (x) {
      if (x.done || !isKey(x.date)) return; var n = days(t, x.date); if (n < 0 || n > 2) return;
      add(50, 'tree', 'var(--ok)', n === 0 ? K('ui.lp-trip-today', '{t} today – check the weather', { t: x.title }) : K('ui.lp-trip-in', '{t} in {n} days – check the weather', { t: x.title, n: n }), x.place || '', '/cmd/me/#lp-outdoor');
    });
  });

  /* ---------- the life sections in the calendar, phone reminders, search and ⌘K (2026-11-22, JP: "Do 1–6 from the gaps") ---------- */
  function dateOf(k) { return new Date(k + 'T00:00'); }
  function thisOrNext(md) { var y = new Date().getFullYear(), k = yearDate(md, y); return k < today() ? yearDate(md, y + 1) : k; }
  function lifeDates() {   /* every dated thing in the life sections: { id, k, title, icon, color, link, note, every } */
    var out = [], t = today(), yr = new Date().getFullYear();
    if (on('parties')) list('parties').forEach(function (x) { if (isKey(x.date)) out.push({ id: 'party:' + x.id, k: x.date, title: x.title, icon: 'balloon', color: 'var(--pink)', link: '/cmd/homelife/#lp-parties', note: x.budget ? K('ui.lp-cal-budget', 'Budget {b}', { b: kr(+x.budget) }) : '' }); });
    if (on('ladmin')) list('ladmin').forEach(function (x) { if (!/^\d{2}-\d{2}$/.test(x.md || '')) return; var k = +x.doneY === yr ? yearDate(x.md, yr + 1) : yearDate(x.md, yr); out.push({ id: 'ladmin:' + x.id, k: k, title: x.name, icon: 'clipboard-check', color: 'var(--warn)', link: '/cmd/lifeadmin/#lp-ladmin', lead: +x.lead || 14 }); });
    if (on('deals')) list('deals').forEach(function (x) { var k = nextDue(x.last, x.every); out.push({ id: 'deal:' + x.id, k: k < t ? t : k, title: K('ui.lp-cal-deal', 'Check the deal: {w}', { w: x.who }), icon: 'arrow-left-right', color: 'var(--blue)', link: '/cmd/lifeadmin/#lp-deals' }); });
    if (on('pets')) list('pets').forEach(function (p) { petJobs(p).forEach(function (j) { if (isKey(j[2])) out.push({ id: 'pet:' + p.id + ':' + j[0], k: j[2] < t ? t : j[2], title: (p.name ? p.name + ': ' : '') + j[1], icon: 'heart', color: 'var(--orange)', link: '/cmd/homelife/#lp-pets', pet: 1 }); }); });
    if (on('returns')) list('returns').forEach(function (x) { if ((x.state || 'open') !== 'open' || !isKey(x.got)) return; var k = addDays(x.got, +x.days || 14); if (k >= t) out.push({ id: 'ret:' + x.id, k: k, title: K('ui.lp-cal-ret', 'Last day to return {t}', { t: x.title }), icon: 'arrow-return-left', color: 'var(--orange)', link: '/cmd/papers/#lp-returns', ret: 1 }); });
    if (on('bodycare')) list('bodycare').forEach(function (x) { var k = bodyDue(x); if (k) out.push({ id: 'body:' + x.id, k: k < t ? t : k, title: x.title, icon: 'scissors', color: 'var(--blue)', link: '/cmd/me/#lp-bodycare' }); });
    if (on('ready')) list('ready').forEach(function (x) { if (isKey(x.exp)) out.push({ id: 'ready:' + x.id, k: x.exp, title: K('ui.lp-cal-best', '{t} – best before', { t: x.name || x.title }), icon: 'shield-check', color: 'var(--slate)', link: '/cmd/house/#lp-ready' }); });
    if (on('usefood')) list('usefood').forEach(function (x) { if (!x.done && isKey(x.by) && x.by >= t) out.push({ id: 'use:' + x.id, k: x.by, title: K('ui.lp-use-q', 'Use it up: {t}', { t: x.title }), icon: 'clock-history', color: 'var(--warn)', link: '/cmd/food/#lp-usefood' }); });
    return out;
  }
  window.LifePlus = window.LifePlus || {}; window.LifePlus.dates = lifeDates;
  /* dinner ↔ freezer (2026-11-22): the planned dinner on a day, and what in the freezer it needs – its recipe's ingredients or its name, word by word */
  function dinnerFor(k) {
    var m = (Fe.tools().meals || {})[k], text = m == null ? '' : typeof m === 'string' ? m : String(m.text || m.name || '');
    if (!text) return null;
    var rec = (Fe.tools().recipes || []).filter(function (r) { return String(r.title || r.name || '').trim().toLowerCase() === text.trim().toLowerCase(); })[0];
    var words = (text + ' ' + (rec ? rec.ingr || '' : '')).toLowerCase().split(/[^a-zæøåäöü]+/).filter(function (w) { return w.length >= 4; });
    var frz = on('freezer') ? list('freezer').filter(function (f) { var fw = String(f.title || '').toLowerCase().split(/[^a-zæøåäöü]+/).filter(function (w) { return w.length >= 4; }); return fw.some(function (w) { return words.some(function (x) { return x === w || x.indexOf(w) === 0 || w.indexOf(x) === 0; }); }); }).map(function (f) { return f.title; }) : [];
    return { text: text, frz: frz };
  }
  window.LifePlus.dinnerFor = dinnerFor;
  (window.EventsExtra = window.EventsExtra || []).push(function () {
    return lifeDates().map(function (x) { return { id: 'rem:lp:' + x.id, title: x.title, allDay: true, start: dateOf(x.k), days: 1, color: x.color, readOnly: true, reminder: true, link: x.link, location: '', notes: x.note || '', exDays: {} }; });
  });
  /* phone reminders: the day before at 18:00 for celebrations and pets, at 09:00 on the day for the rest; returns and yearly tasks also a few days ahead */
  (window.NotifyExtra = window.NotifyExtra || []).push(function (add, o) {
    if (o.k && o.k.life === false) return;
    var now = Date.now();
    lifeDates().forEach(function (x) {
      var d = dateOf(x.k), push = function (when, title, body) { if (when > now && when < now + 40 * 864e5) add('lp:' + x.id + ':' + when, when, title, body, x.link); };
      if (/^party:|^pet:/.test(x.id)) { var e = new Date(d); e.setDate(e.getDate() - 1); e.setHours(18, 0, 0, 0); push(e.getTime(), x.title, K('ui.lp-push-tomorrow', 'Tomorrow')); }
      var m = new Date(d); m.setHours(9, 0, 0, 0); push(m.getTime(), x.title, K('ui.lp-push-today', 'Today'));
      if (x.ret) { var r = new Date(d); r.setDate(r.getDate() - 3); r.setHours(9, 0, 0, 0); push(r.getTime(), x.title, K('ui.lp-ret-in', 'Last day in {n} days', { n: 3 })); }
      if (x.lead) { var l = new Date(d); l.setDate(l.getDate() - Math.min(x.lead, 30)); l.setHours(9, 0, 0, 0); push(l.getTime(), x.title, K('ui.lp-due-in', 'Due in {n} days', { n: Math.min(x.lead, 30) })); }
    });
  });
  /* search: the titles in the life sections */
  var SRCH = [['media', 'collection-play', 'ui.lp-media', 'Books, films and games', '/cmd/me/#lp-media', 'title'], ['later', 'bookmark', 'ui.lp-later', 'Read and watch later', '/cmd/me/#lp-later', 'title'],
    ['hobbies', 'palette', 'ui.lp-hobbies', 'Hobbies & projects', '/cmd/me/#lp-hobbies', 'title'], ['style', 'bag-heart', 'ui.lp-style', 'Style', '/cmd/me/#lp-style', 'title'], ['wins', 'trophy', 'ui.lp-wins', 'Wins & gratitude', '/cmd/me/#lp-wins', 'title'],
    ['career', 'graph-up-arrow', 'ui.lp-career', 'Career', '/cmd/me/#lp-career', 'title'], ['outdoor', 'tree', 'ui.lp-outdoor', 'Outdoors', '/cmd/me/#lp-outdoor', 'title'], ['bodycare', 'scissors', 'ui.lp-body', 'Body upkeep', '/cmd/me/#lp-bodycare', 'title'],
    ['parties', 'balloon', 'ui.lp-parties', 'Celebrations', '/cmd/homelife/#lp-parties', 'title'], ['pets', 'heart', 'ui.lp-pets', 'Pets', '/cmd/homelife/#lp-pets', 'name'], ['clubs', 'people', 'ui.lp-clubs', 'Clubs and volunteering', '/cmd/homelife/#lp-clubs', 'name'],
    ['ladmin', 'clipboard-check', 'ui.lp-ladmin', 'Yearly tasks', '/cmd/lifeadmin/#lp-ladmin', 'name'], ['deals', 'arrow-left-right', 'ui.lp-deals', 'Deal checks', '/cmd/lifeadmin/#lp-deals', 'who'], ['digital', 'shield-lock', 'ui.lp-digital', 'Digital life', '/cmd/lifeadmin/#lp-digital', 'title'],
    ['freezer', 'snow', 'ui.lp-frz', 'Freezer', '/cmd/food/#lp-freezer', 'title'], ['usefood', 'clock-history', 'ui.lp-use', 'Use it up', '/cmd/food/#lp-usefood', 'title'], ['returns', 'arrow-return-left', 'ui.lp-ret', 'Return deadlines', '/cmd/papers/#lp-returns', 'title'],
    ['thanks', 'envelope-heart', 'ui.lp-ty', 'Thank-yous', '/cmd/people/#lp-thanks', 'what'], ['ready', 'shield-check', 'ui.lp-ready', 'Emergency preparedness', '/cmd/house/#lp-ready', 'name'], ['hood', 'signpost-split', 'ui.lp-hood', 'Neighbourhood', '/cmd/house/#lp-hood', 'title']];
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    SRCH.forEach(function (c) { if (!on(c[0])) return; var lbl = K(c[2], c[3]); list(c[0]).forEach(function (x) { var t = x[c[5]] || x.title || x.name || x.what; if (t) add(lbl, c[1], String(t), [x.notes, x.val, x.shop, x.where].filter(Boolean).join(' · ').slice(0, 80), c[4]); }); });
  });
  /* ⌘K: add straight to a section (quick add's own forms) */
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    var go = function (k) { return function () { if (window.Quick && window.Quick.open) window.Quick.open(k); else location.href = '/cmd/?add=' + k; }; };
    return [['freezer', 'snow', 'ui.qa-k-freezer', 'Freezer', 'freezer fryser frys'], ['usefood', 'clock-history', 'ui.qa-k-usefood', 'Use it up', 'use up bruk opp spis'], ['returns', 'arrow-return-left', 'ui.qa-k-return', 'Return', 'return retur angrerett'], ['thanks', 'envelope-heart', 'ui.qa-k-thanks', 'Thank-you', 'thanks takk gave'], ['mood', 'emoji-smile', 'ui.qa-k-mood', 'Mood', 'mood humør dagbok']]
      .filter(function (c) { return on(c[0]); }).map(function (c) { return { i: c[1], t: K('ui.lp-cmd-add', 'Add: {t}', { t: K(c[2], c[3]) }), s: K('ui.qa-title', 'Quick add'), run: go(c[0] === 'returns' ? 'return' : c[0]), x: c[4] }; });
  });

  /* ---------- the evening push: time to wind down, half an hour before your bedtime ---------- */
  (window.NotifyExtra = window.NotifyExtra || []).push(function (add, o) {
    if (!on('sleep')) return; var c = sleepCfg(); if (!c.remind) return;
    var b = String(c.bed || '23:00').split(':');
    for (var i = 0; i < 7; i++) { var d = new Date(); d.setDate(d.getDate() + i); d.setHours(+b[0], +b[1] - 30, 0, 0); add('sleep:' + o.dkey(d), d.getTime(), K('ui.lp-wind', 'Time to wind down'), K('ui.lp-wind-sub', 'Bedtime in 30 minutes – screens away'), '/cmd/me/#lp-sleep'); }
  });

  /* the cards (life-plus.page.js) load only when a section is on and this page has its slot – most pages never need them */
  var LPP_V = '28ad4832e9';   /* stamped by cmd/build.py */
  var IDS = ['ready', 'hood', 'ladmin', 'deals', 'climate', 'parties', 'moments', 'family', 'pets', 'clubs', 'sleep', 'calm', 'media', 'later', 'digital', 'career', 'outdoor', 'mood', 'wheel', 'wins', 'hobbies', 'bodycare', 'screen', 'style', 'usefood', 'freezer', 'returns', 'thanks'];
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
  window.LifePlus = { dates: lifeDates, dinnerFor: dinnerFor, bodyDue: bodyDue, petJobs: petJobs, nextDue: nextDue, goalHours: goalHours, sleepCfg: sleepCfg, yearDate: yearDate, addDays: addDays, addMonths: addMonths, days: days, isKey: isKey, today: today, kr: kr };
})();
