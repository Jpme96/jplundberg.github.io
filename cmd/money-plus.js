/* Finances, batch 3 (Oct 2026):
     Recurring payments – charges that come back every month, found in your bank imports and in what
                          you log yourself; add them as a subscription or a fixed cost in one tap.
     Shared expenses    – split a payment with someone, see who owes what, settle up.
   Cards mount into [data-tool="recur"] and [data-tool="shared"] on the Finances page; the At a glance
   lines and Settings → Pages → Finances work on every page. Data: dash.tools.shared,
   dash.tools.recurIgnore, dash.tools.fincfg (all inside the encrypted vault). */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in money-plus.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["moneyplus"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function dayN(k) { return Math.round(fromKey(k) / 864e5); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function norm(s) { return window.Smart ? window.Smart.norm(s) : String(s || '').toLowerCase().replace(/[^a-zæøå ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
  var DEF = { months: 6, recurGlance: true, sharedGlance: true, sharedMin: 200, split: 'equal', partner: '', pct: 50 };
  function cfg() { var c = Fe.tools().fincfg; return Object.assign({}, DEF, c && typeof c === 'object' ? c : {}); }
  function setCfg(p) { var t = Fe.tools(); t.fincfg = Object.assign({}, t.fincfg || {}, p); Fe.saveTools(t); }
  function ignored() { var l = Fe.tools().recurIgnore; return Array.isArray(l) ? l : []; }
  function detect(d, now) {
    d = d || window.Vault.get() || {}; now = now || new Date();
    var since = dkey(new Date(now.getFullYear(), now.getMonth() - cfg().months, 1)), by = {};
    (d.expenses || []).forEach(function (e) {
      if (!e || !e.note || String(e.date) < since || e.cat === 'travel' || e.shared) return;
      var k = norm(e.note); if (k.length < 3) return;
      (by[k] = by[k] || []).push(e);
    });
    var subs = Fe.list('subs'), fixed = (d.budget && d.budget.fixed) || [], ign = ignored(), out = [];
    var match = function (k, l) { return l.filter(function (x) { var n = norm(x.name); return n && (k.indexOf(n) > -1 || n.indexOf(k) > -1); })[0]; };
    Object.keys(by).forEach(function (k) {
      var l = by[k].sort(function (a, b) { return a.date > b.date ? 1 : -1; });
      if (l.length < 2) return;
      /* gaps between charges: 25–35 days each (so the 30th → the 2nd still counts) */
      var gaps = []; for (var i = 1; i < l.length; i++) gaps.push(dayN(l[i].date) - dayN(l[i - 1].date));
      if (gaps.some(function (g) { return g < 24 || g > 36; })) return;
      var amts = l.map(function (e) { return +e.amount || 0; }), lo = Math.min.apply(null, amts), hi = Math.max.apply(null, amts);
      var last = l[l.length - 1], prev = l[l.length - 2];
      var steady = hi - lo <= Math.max(10, lo * .1);
      var priceUp = !steady && last.amount > prev.amount * 1.03 && l.slice(0, -1).every(function (e) { return Math.abs(e.amount - prev.amount) <= prev.amount * .03; });
      if (!steady && !priceUp) return;
      if (l.length < 3 && !(hi === lo || last.cat === 'fun')) return;          // two charges are enough only for the obvious ones
      var days = l.map(function (e) { return +String(e.date).slice(8, 10); }).sort(function (a, b) { return a - b; });
      var day = days[Math.floor(days.length / 2)];
      var nx = fromKey(last.date); nx.setMonth(nx.getMonth() + 1);
      var sub = match(k, subs), fx = sub ? null : match(k, fixed);
      out.push({ key: k, name: last.note, amount: +last.amount, prev: +prev.amount, avg: amts.reduce(function (a, x) { return a + x; }, 0) / amts.length, day: day, n: l.length, last: last.date, next: dkey(nx),
        cat: last.cat || 'other', acct: last.acct || null, bank: l.some(function (e) { return e.src === 'bank'; }), up: priceUp, sub: sub || null, fixed: fx || null, ignored: ign.indexOf(k) > -1,
        active: dayN(dkey(now)) - dayN(last.date) <= 40 });
    });
    return out.sort(function (a, b) { return (a.sub || a.fixed ? 1 : 0) - (b.sub || b.fixed ? 1 : 0) || b.amount - a.amount; });
  }
  function addAs(r, kind) {
    var now = new Date(), dd = window.Vault.get(); if (!dd) return;
    var per = window.Budget && window.Budget.period ? window.Budget.period(dd, now) : null;
    /* from now on it's counted by the subscription / fixed cost – don't count this period's charge twice */
    if (per) dd.expenses = (dd.expenses || []).filter(function (e) { return !(e.note && norm(e.note) === r.key && per.has(e.date)); });
    if (kind === 'sub') {
      window.Vault.save(dd);
      var nx = new Date(now.getFullYear(), now.getMonth() + (r.day <= now.getDate() ? 1 : 0), Math.min(r.day, 28));
      var t = Fe.tools(); t.subs = t.subs || [];
      t.subs.push({ id: uid(), name: r.name, amount: r.amount, period: 'monthly', renews: dkey(nx), cat: r.cat === 'fun' ? 'streaming' : 'other', notes: r.bank ? 'Found in your bank import' : 'Found in your spending' });
      Fe.saveTools(t);
    } else {
      dd.budget = dd.budget || { income: [], fixed: [] }; dd.budget.fixed = dd.budget.fixed || [];
      var fid = uid(); dd.budget.fixed.push({ id: fid, name: r.name, amount: Math.round(r.amount), day: Math.min(r.day, 28), acct: r.acct || undefined });
      var ym = dkey(now).slice(0, 7);
      if (String(r.last).slice(0, 7) === ym) { dd.paid = dd.paid || {}; (dd.paid[ym] = dd.paid[ym] || []).push(fid); }
      window.Vault.save(dd);
    }
    window.dispatchEvent(new Event('fin:change'));
    toast('<i class="bi bi-check2"></i> ' + esc(r.name) + (kind === 'sub' ? ' added to subscriptions' : ' is now a fixed cost'));
  }
  function setIgnore(k, on) {
    var t = Fe.tools(), l = Array.isArray(t.recurIgnore) ? t.recurIgnore.slice() : [];
    l = l.filter(function (x) { return x !== k; }); if (on) l.push(k);
    t.recurIgnore = l.slice(-200); Fe.saveTools(t);
  }
  function sh() {
    var s = Fe.tools().shared; s = s && typeof s === 'object' ? s : {};
    return { people: Array.isArray(s.people) ? s.people : [], items: Array.isArray(s.items) ? s.items : [], pays: Array.isArray(s.pays) ? s.pays : [] };
  }
  function saveSh(s) { var t = Fe.tools(); t.shared = s; Fe.saveTools(t); }
  function person(s, id) { return s.people.filter(function (p) { return p.id === id; })[0]; }
  function balance(s, pid) {
    var b = 0;
    s.items.forEach(function (x) { var sh = x.shares || {}; if (x.payer === 'me') b += +sh[pid] || 0; else if (x.payer === pid) b -= +sh.me || 0; });
    s.pays.forEach(function (p) { if (p.from === 'me' && p.to === pid) b += +p.amount || 0; if (p.from === pid && p.to === 'me') b -= +p.amount || 0; });
    planPays(null, pid).forEach(function (x) { if (x.payer === 'me') b += x.them; else if (x.payer === pid) b -= x.mine; });
    billClaims(null, pid).forEach(function (x) { if (x.payer === 'me') b += x.them; else if (x.payer === pid) b -= x.mine; });
    owePays(null, pid).forEach(function (x) { b += x.amount; });
    return Math.round(b * 100) / 100;
  }
  function owePays(until, pid) {
    var d = window.Vault.get(), out = []; if (!d) return out;
    var end = until || dkey(new Date());
    (d.accounts || []).forEach(function (a) {
      var ow = a && a.kind === 'debt' && a.owe; if (!ow || !ow.pid || (pid && ow.pid !== pid) || !(+a.pay > 0) || !a.asOf) return;
      var bal = +a.balance || 0, p = +a.pay, st = fromKey(a.asOf), day = +a.day || st.getDate(), of = Math.ceil(bal / p);
      var ex = (Array.isArray(a.extra) ? a.extra : []).filter(function (e) { return e && +e.amount > 0 && e.date > a.asOf; }).sort(function (x, y) { return x.date < y.date ? -1 : 1; }), xi = 0;
      function extrasTo(k) { while (xi < ex.length && ex[xi].date <= k && ex[xi].date <= end && bal > 0.5) { var v = Math.min(bal, +ex[xi].amount); bal -= v; out.push({ loan: a.id, n: 0, of: of, date: ex[xi].date, amount: Math.round(v * 100) / 100, pid: ow.pid, name: a.name || 'Paying back', extra: true }); xi++; } }
      for (var n = 1; n <= 600 && bal > 0.5; n++) {
        var dt = new Date(st.getFullYear(), st.getMonth() + n, 1); dt.setDate(Math.min(day, new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()));
        var k = dkey(dt); extrasTo(k); if (k > end || bal <= 0.5) break;
        var v = Math.min(p, bal); bal -= v;
        out.push({ loan: a.id, n: n, of: of, date: k, amount: Math.round(v * 100) / 100, pid: ow.pid, name: a.name || 'Paying back' });
      }
      extrasTo(end);
    });
    return out.sort(function (x, y) { return x.date < y.date ? -1 : 1; });
  }
  function sides(pid) {
    var s = sh(), they = 0, you = 0;
    s.items.forEach(function (x) { var q = x.shares || {}; if (x.payer === 'me') they += +q[pid] || 0; else if (x.payer === pid) you += +q.me || 0; });
    planPays(null, pid).forEach(function (x) { if (x.payer === 'me') they += x.them; else if (x.payer === pid) you += x.mine; });
    billClaims(null, pid).forEach(function (x) { if (x.payer === 'me') they += x.them; else if (x.payer === pid) you += x.mine; });
    s.pays.forEach(function (p) {
      if (p.from === pid && p.to === 'me') { if (p.lend) you += +p.amount || 0; else they -= +p.amount || 0; }
      if (p.from === 'me' && p.to === pid) you -= +p.amount || 0;
    });
    owePays(null, pid).forEach(function (x) { you -= x.amount; });
    /* paid back more than owed one way: the rest counts on the other side */
    if (they < 0) { you -= they; they = 0; } if (you < 0) { they -= you; you = 0; }
    var r = function (v) { return Math.round(v * 100) / 100; };
    return { they: r(they), you: r(you), net: r(they - you) };
  }
  function owePlans(pid) { var d = window.Vault.get() || {}; return (d.accounts || []).filter(function (a) { return a && a.kind === 'debt' && a.owe && (!pid || a.owe.pid === pid); }); }
  function billClaims(until, pid) {
    var d = window.Vault.get(), B = window.Budget, out = []; if (!d || !B || !B.fixedWhole) return out;
    var end = until || dkey(new Date());
    ((d.budget && d.budget.fixed) || []).forEach(function (f) {
      var sp = f && f.split; if (!sp || !sp.pid || (pid && sp.pid !== pid) || !/^\d{4}-\d{2}$/.test(sp.from || '')) return;
      if (sp.payer !== 'me' && sp.payer !== sp.pid) return;          /* each pays their own part: nothing between you */
      var part = B.splitPart(f);
      for (var y = +sp.from.slice(0, 4), m = +sp.from.slice(5, 7) - 1, g = 0; g < 240; g++, m++) {
        var first = new Date(y, m, 1); if (dkey(first) > end) break;
        var dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), dt = new Date(first.getFullYear(), first.getMonth(), Math.min(+f.day || 1, dim)), k = dkey(dt);
        if (k > end) break;
        var ym = k.slice(0, 7), whole = B.fixedWhole(f, ym); if (!(whole > 0)) continue;
        var mine = Math.round(whole * part * 100) / 100;
        out.push({ bill: f.id, ym: ym, date: k, amount: whole, mine: mine, them: Math.round((whole - mine) * 100) / 100, payer: sp.payer, pid: sp.pid, name: f.name || 'Bill' });
      }
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  function ledger(pid) {
    var s = sh(), rows = [];
    s.items.forEach(function (x) {
      var sh2 = x.shares || {};
      if (x.payer === 'me' && +sh2[pid] > 0) rows.push({ key: 'i:' + x.id, kind: 'item', id: x.id, date: x.date, amount: +sh2[pid], dir: 1, note: x.note || 'Shared', sub: !!x.sub, loan: x.loan || null });
      else if (x.payer === pid && +sh2.me > 0) rows.push({ key: 'i:' + x.id, kind: 'item', id: x.id, date: x.date, amount: +sh2.me, dir: -1, note: x.note || 'Shared', sub: !!x.sub, loan: x.loan || null });
    });
    planPays(null, pid).forEach(function (q) { if (q.payer === 'me' && q.them > 0) rows.push({ key: 'l:' + q.loan + ':' + q.n, kind: 'plan', id: q.loan, date: q.date, amount: q.them, dir: 1, note: q.name + ' · payment ' + q.n }); else if (q.payer === pid && q.mine > 0) rows.push({ key: 'l:' + q.loan + ':' + q.n, kind: 'plan', id: q.loan, date: q.date, amount: q.mine, dir: -1, note: q.name + ' · payment ' + q.n }); });
    billClaims(null, pid).forEach(function (q) { if (q.payer === 'me' && q.them > 0) rows.push({ key: 'b:' + q.bill + ':' + q.ym, kind: 'bill', id: q.bill, date: q.date, amount: q.them, dir: 1, note: q.name + ' · ' + q.ym, ym: q.ym }); else if (q.payer === pid && q.mine > 0) rows.push({ key: 'b:' + q.bill + ':' + q.ym, kind: 'bill', id: q.bill, date: q.date, amount: q.mine, dir: -1, note: q.name + ' · ' + q.ym, ym: q.ym }); });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    /* credit each way: repayments in that direction + what's owed the other way (it cancels out) */
    var credit = { 1: [], '-1': [] }, last = { in: null, out: null };
    s.pays.forEach(function (p) {
      if (p.from === pid && p.to === 'me') { credit[1].push({ date: p.date, amount: +p.amount || 0 }); if (!p.lend && (!last.in || p.date >= last.in.date)) last.in = p; }
      if (p.from === 'me' && p.to === pid) { credit[-1].push({ date: p.date, amount: +p.amount || 0 }); if (!last.out || p.date >= last.out.date) last.out = p; }
    });
    owePays(null, pid).forEach(function (q) { credit[-1].push({ date: q.date, amount: q.amount }); });
    rows.forEach(function (r) { credit[-r.dir].push({ date: r.date, amount: r.amount }); });
    [1, -1].forEach(function (dir) {
      var cs = credit[dir].sort(function (a, b) { return a.date < b.date ? -1 : 1; }), ci = 0, have = 0, at = null;
      rows.filter(function (r) { return r.dir === dir; }).forEach(function (r) {
        var need = r.amount;
        while (need > 0.005) {
          if (have <= 0.005) { if (ci >= cs.length) break; have = cs[ci].amount; at = cs[ci].date; ci++; continue; }
          var use = Math.min(have, need); have -= use; need -= use;
        }
        r.left = Math.max(0, Math.round(need * 100) / 100);
        r.state = r.left <= 0.005 ? 'paid' : r.left < r.amount - 0.005 ? 'part' : 'open';
        r.paidAt = r.state === 'paid' ? (at && at > r.date ? at : r.date) : null;
      });
    });
    return { rows: rows, last: last };
  }
  function planPays(until, pid) {
    var d = window.Vault.get(), Lo = window.Loans, out = []; if (!d || !Lo) return out;
    var end = until || dkey(new Date());
    (d.accounts || []).forEach(function (a) {
      var pl = a && a.kind === 'debt' && a.plan; if (!pl || !(+a.pay > 0) || !a.asOf) return;
      if (pid && pl.pid !== pid) return;
      var bal = +a.balance || 0, i = (+a.rate || 0) / 1200, p = +a.pay, fee = +a.fee || 0, part = Lo.part(a), day = +a.day || +a.asOf.slice(8, 10);
      var st = fromKey(a.asOf), total = monthsFor(a);
      for (var n = 1; n <= total && bal > 0.5; n++) {
        var dt = new Date(st.getFullYear(), st.getMonth() + n, 1); dt.setDate(Math.min(day, new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()));
        var dk = dkey(dt); if (dk > end) break;
        var r = bal * i, pay = Math.min(p, bal + r); bal = bal + r - pay;
        var amt = Math.round((pay + fee) * 100) / 100;
        out.push({ loan: a.id, n: n, of: total, date: dk, amount: amt, mine: Math.round(amt * part * 100) / 100, them: Math.round(amt * (1 - part) * 100) / 100, payer: pl.payer || 'each', pid: pl.pid, name: a.name || 'Payment' });
      }
    });
    return out.sort(function (x, y) { return x.date < y.date ? -1 : 1; });
  }
  function monthsFor(a) {     /* how many payments the plan has (from the loan maths, at most 600) */
    var bal = +a.balance || 0, i = (+a.rate || 0) / 1200, p = +a.pay || 0, n = 0;
    while (bal > 0.5 && n < 600 && p > 0) { bal = bal * (1 + i) - p; n++; }
    return n;
  }
  function save(x, old, s) {
    var d = window.Vault.get(); if (!d) return;
    d.expenses = d.expenses || [];
    var me = +x.shares.me || 0;
    if (old && old.exp && old.exp !== x.exp) d.expenses.forEach(function (e) { if (e.id === old.exp && e.full != null) { e.amount = e.full; delete e.full; delete e.shared; } });
    var linked = x.exp ? d.expenses.filter(function (e) { return e.id === x.exp; })[0] : null;
    if (linked) {
      if (linked.full == null) linked.full = +linked.amount;
      linked.amount = me; linked.shared = x.id; linked.note = linked.note || x.note; linked.date = x.date; linked.cat = x.cat;
    } else if (x.payer !== 'me' && x.add !== false && me > 0) {
      var e = old && old.made ? d.expenses.filter(function (q) { return q.id === old.made; })[0] : null;
      if (!e) { e = { id: uid(), t: Date.now() }; d.expenses.push(e); }
      e.date = x.date; e.amount = me; e.cat = x.cat; e.note = x.note || 'Shared'; e.shared = x.id; x.made = e.id;
    } else if (old && old.made) {
      d.expenses = d.expenses.filter(function (q) { return q.id !== old.made; }); delete x.made;
    }
    delete x.add;
    window.Vault.save(d);
    s = s || sh(); s.items = s.items.filter(function (q) { return q.id !== x.id; }); s.items.push(x); saveSh(s);
    window.dispatchEvent(new Event('fin:change'));
    toast('<i class="bi bi-people"></i> ' + (old ? 'Saved' : 'Split saved') + ' – your share ' + esc(kr(me)));
  }
  function remove(item) {
    var s = sh(), d = window.Vault.get(); if (!d || !item) return;
    var before = JSON.parse(JSON.stringify(d.expenses || [])), beforeS = JSON.parse(JSON.stringify(s));
    (d.expenses || []).forEach(function (e) { if (e.id === item.exp && e.full != null) { e.amount = e.full; delete e.full; delete e.shared; } });
    if (item.made) d.expenses = (d.expenses || []).filter(function (e) { return e.id !== item.made; });
    window.Vault.save(d);
    s.items = s.items.filter(function (q) { return q.id !== item.id; }); saveSh(s);
    window.dispatchEvent(new Event('fin:change'));
    toast('<i class="bi bi-trash3"></i> Removed', function () { var d2 = window.Vault.get(); d2.expenses = before; window.Vault.save(d2); saveSh(beforeS); window.dispatchEvent(new Event('fin:change')); });
  }
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!Fe.on('shared') || !Fe.on('finance') || !cfg().sharedGlance) return;
    var s = sh(), min = +cfg().sharedMin || 0, href = /\/cmd\/finance\//.test(location.pathname) ? '#shared' : '/cmd/finance/#shared';
    s.people.forEach(function (p) {
      var b = balance(s, p.id); if (Math.abs(b) < Math.max(1, min)) return;
      add(62, 'people', b > 0 ? '#22b35e' : '#e8743b', b > 0 ? p.name + ' owes you ' + kr(b) : 'You owe ' + p.name + ' ' + kr(-b), 'Shared expenses · settle up when it suits', href, { key: 'shared:' + p.id + ':' + Math.round(b / 50), tip: true });
    });
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () { return Fe.on('shared') && Fe.on('finance') ? [{ i: 'people', t: 'Split a payment', s: 'Shared expenses', run: function () { if (__ui().boxes && __ui().boxes.shared) __ui().splitSheet(null); else location.href = '/cmd/finance/#shared'; }, x: 'split share del dele skylder owe' }] : []; });
  (function () {
    var pg = document.querySelector('.st-page[data-page="finance"]'); if (!pg) return;
    function sel(f, label, opts, sub) { var v = String(cfg()[f]); return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><select class="st-select" data-fcfg="' + f + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
    function sw(f, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-fcfg="' + f + '"' + (cfg()[f] ? ' checked' : '') + '></label>'; }
    function feat(id, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-ffeat="' + id + '"' + (Fe.on(id) ? ' checked' : '') + '></label>'; }
    function subh(icon, t) { return '<p class="st-sub ap-sub"><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</p>'; }
    function fill() {
      var box = document.getElementById('mpSet'); if (!box || (box.contains(document.activeElement) && document.activeElement.tagName === 'SELECT')) return;
      var ni = ignored().length;
      box.innerHTML = '<p class="st-intro" data-t="ui.extras-on-the-finances-page-everything-i">Extras on the Finances page. Everything is worked out on this device from your own entries.</p>' +
        subh('arrow-repeat', I18N.k('ui.recurring-payments', 'Recurring payments')) + '<div class="st-group">' + feat('recur', I18N.k('ui.show-the-card', 'Show the card'), I18N.k('ui.charges-that-come-back-every-month', 'Charges that come back every month')) + sel('months', I18N.k('ui.look-back', 'Look back'), [[3, '3 months'], [6, '6 months'], [12, '12 months']]) +
        sw('recurGlance', I18N.k('ui.suggest-new-ones-in-at-a-glance', 'Suggest new ones in At a glance')) + (ni ? '<button type="button" class="st-row st-btn" data-funign><span><i class="bi bi-arrow-counterclockwise"></i> Suggest the ' + ni + ' I waved away again</span></button>' : '') + '</div>' +
        subh('people', I18N.k('ui.shared-expenses', 'Shared expenses')) + '<div class="st-group">' + feat('shared', I18N.k('ui.show-the-card', 'Show the card'), I18N.k('ui.split-payments-and-see-who-owes-what', 'Split payments and see who owes what')) + sel('split', I18N.k('ui.new-splits-start', 'New splits start'), [['equal', 'Equally'], ['pct', 'By your usual %'], ['amount', 'By amount']]) +
        (sh().people.length ? sel('partner', 'Usually split with', [['', 'Nobody in particular']].concat(sh().people.map(function (p) { return [p.id, p.name]; })), 'Picked for you on every new split') : '') +
        sel('pct', I18N.k('ui.your-usual-share', 'Your usual share'), [[50, '50 % (half)'], [60, '60 %'], [40, '40 %'], [70, '70 %'], [30, '30 %'], [55, '55 %'], [45, '45 %'], [65, '65 %'], [35, '35 %']].concat([50, 60, 40, 70, 30, 55, 45, 65, 35].indexOf(+cfg().pct) < 0 ? [[cfg().pct, cfg().pct + ' %']] : []), I18N.k('ui.for-by-your-usual', 'For “By your usual %”')) +
        sw('sharedGlance', I18N.k('ui.remind-me-in-at-a-glance', 'Remind me in At a glance'), I18N.k('ui.when-someone-owes-you-or-you-owe-them', 'When someone owes you, or you owe them')) + sel('sharedMin', 'From', [[1, 'Any amount'], [100, '100 kr'], [200, '200 kr'], [500, '500 kr'], [1000, '1 000 kr']]) + '</div>' +
        '<div class="st-group"><a class="st-row st-btn" href="/cmd/finance/"><span><i class="bi bi-wallet2"></i> <span data-t="ui.open-finances">Open Finances</span></span><i class="bi bi-chevron-right"></i></a><a class="st-row st-btn" href="/cmd/finance/?customize"><span><i class="bi bi-grid-1x2"></i> <span data-t="ui.order-and-hide-cards">Order and hide cards</span></span><i class="bi bi-chevron-right"></i></a></div>';
    }
    function row() {
      var r = document.getElementById('stRow-finance'); if (r) r.hidden = !Fe.on('finance');
      var s = document.getElementById('sum-finance');
      if (s) { var on = ['recur', 'shared'].filter(Fe.on).map(function (k) { return k === 'recur' ? 'Recurring payments' : 'Shared expenses'; }); s.textContent = on.length ? on.join(' · ') : 'Recurring payments, shared expenses'; }
    }
    pg.addEventListener('change', function (e) {
      var i = e.target;
      if (i.dataset.ffeat) { Fe.set(i.dataset.ffeat, i.checked); return; }
      if (!i.dataset.fcfg) return;
      var p = {}; p[i.dataset.fcfg] = i.type === 'checkbox' ? i.checked : /^\d+$/.test(i.value) ? +i.value : i.value; setCfg(p);
      toast('<i class="bi bi-check2"></i> Saved');
    });
    pg.addEventListener('click', function (e) { if (e.target.closest('[data-funign]')) { var t = Fe.tools(); t.recurIgnore = []; Fe.saveTools(t); fill(); toast('<i class="bi bi-check2"></i> They can be suggested again'); } });
    window.addEventListener('st:page', function (e) { if (e.detail === 'finance') fill(); if (e.detail === 'home') row(); });
    ['features:change', 'tools:change'].forEach(function (ev) { window.addEventListener(ev, function () { row(); if (!pg.hidden) fill(); }); });
    window.Vault.onUnlock(function () { row(); fill(); });
  })();
  window.MoneyPlus = { detect: detect, addAs: addAs, setIgnore: setIgnore, balance: function (pid) { return balance(sh(), pid); }, ignored: ignored, cfg: cfg };
  window.Shared = { data: sh, save: saveSh, balance: function (pid) { return balance(sh(), pid); }, planPays: planPays, sides: function (pid) { return sides(pid); }, owePays: owePays, owePlans: owePlans, monthsFor: monthsFor, billClaims: billClaims, ledger: ledger, person: function (id) { return person(sh(), id); }, saveItem: save, removeItem: remove, cfg: cfg, setCfg: setCfg, partner: function () { var c = cfg(), s = sh(); return (c.partner && person(s, c.partner)) || null; } };
  (window.__core = window.__core || {})["moneyplus"] = { toast: toast, setCfg: setCfg, Fe: Fe, sh: sh, ignored: ignored, esc: esc, cfg: cfg, DEF: DEF, kr: kr, nf: nf, balance: balance, owePays: owePays, fromKey: fromKey, dkey: dkey, pad: pad, billClaims: billClaims, planPays: planPays, monthsFor: monthsFor, person: person, remove: remove, saveSh: saveSh, save: save, uid: uid, ledger: ledger, owePlans: owePlans, sides: sides, setIgnore: setIgnore, addAs: addAs, norm: norm, detect: detect, dayN: dayN };
})();
