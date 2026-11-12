/* House page → "Shared home": what you and your partner pay for the home together.
   - one partner and your usual % (e.g. you 60, them 40) – every purchase starts there
   - purchases (furniture, appliances, anything) split by %, who paid, one running "who owes whom" + Settle up
   - bought in parts (delbetaling): down payment, monthly payments, interest and fees – the plan is a loan in
     Net worth with a.plan, so your part is a fixed cost, it shows in Next 14 days, the calendar and net worth,
     and each monthly payment one of you makes to the store counts in the balance between you
   - optionally into the Home inventory as owned together (your %)
   - a month at a glance: together, what each paid, and the one transfer that evens it out
   It uses the same data as Finances → Shared expenses (window.Shared from money-plus.js): one balance, not two.
   Mounts into [data-tool="hshared"]. */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in home-shared.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["homeshared"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function S() { return window.Shared; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2] || 1); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function partner() { return S() ? S().partner() : null; }
  function daysSince(k) { return Math.floor((fromKey(dkey(new Date())) - fromKey(k)) / 864e5); }
  function move() { var t = Fe.tools().hmove; return t && typeof t === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(t.date || '') ? t : null; }
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return Fe.on('house') ? [{ i: 'people', t: 'Bought something together', s: 'House · Shared home', run: function () { if (__ui().mount && partner()) __ui().buySheet(null); else location.href = '/cmd/house/#hshared'; }, x: 'shared home partner furniture møbler delbetaling avbetaling split felles' }] : [];
  });
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!Fe.on('house') || !S()) return;
    var p = partner(), href = /\/cmd\/house\//.test(location.pathname) ? '#hshared' : '/cmd/house/#hshared';
    if (p) S().ledger(p.id).rows.forEach(function (r) {
      if (r.state === 'paid' || !(r.kind === 'bill' || r.sub)) return;
      var age = daysSince(r.date); if (age < 30) return;
      var late = age > 40;
      add(late ? 9 : 22, r.sub ? 'arrow-left-right' : 'lightning-charge', late ? '#e66767' : '#c98500',
        (r.dir > 0 ? p.name + ' owes you ' : 'You owe ' + p.name + ' ') + kr(r.left) + (late ? ' – over 40 days' : ' – ' + (40 - age) + ' day' + (40 - age === 1 ? '' : 's') + ' left'),
        r.note + (r.sub && late ? ' · now a personal debt with overdue interest' : ' · settle within 40 days'), href, { key: 'hs40:' + r.key + (late ? ':late' : ''), badge: late });
    });
    var mv = move();
    if (mv) {
      var days = -daysSince(mv.date), items = mv.items || [], left = items.filter(function (x) { return !x.done; }).length;
      if (days >= 0 && days <= 45 && left) add(days <= 7 ? 14 : 45, 'house-door', '#a0673a', days === 0 ? 'Take-over day!' : 'Moving in ' + days + ' day' + (days === 1 ? '' : 's'), left + ' thing' + (left === 1 ? '' : 's') + ' left on the moving list', href, { key: 'move:' + mv.date + ':' + left, tip: days > 14 });
    }
  });
  (window.EventsExtra = window.EventsExtra || []).push(function () {
    var mv = Fe.on('house') && move(); if (!mv) return [];
    return [{ id: 'rem:move', title: 'Take-over: the new home', allDay: true, start: fromKey(mv.date), days: 1, color: '#a0673a', readOnly: true, reminder: true, link: '/cmd/house/#hshared', location: '', notes: 'Moving checklist on the House page', exDays: {} }];
  });
  window.SharedHome = { move: move };
  (window.__core = window.__core || {})["homeshared"] = { fromKey: fromKey, move: move, Fe: Fe, kr: kr, nf: nf, daysSince: daysSince, dkey: dkey, pad: pad, partner: partner, S: S };
})();
