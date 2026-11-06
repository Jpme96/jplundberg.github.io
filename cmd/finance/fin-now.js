/* Finances → Now: the one number, what needs you, the next 14 days, and how the last period went.
   Everything comes from the same engine as the rest (budget.js: Budget.real / payPlan / cardBills / pace,
   Accts.money; money-plus.js: MoneyPlus.detect for repeating charges). */
(function () {
  "use strict";
  if (!window.Vault || !document.getElementById('fnHero')) return;
  var $ = function (id) { return document.getElementById(id); };
  var B = window.Budget, A = window.Accts;
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)); }
  function money(n, cls) { return '<span class="money' + (cls ? ' ' + cls : '') + '">' + esc(kr(n)) + '</span>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dk(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function ymk(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function sum(l, f) { return l.reduce(function (a, x) { return a + (+(f ? f(x) : x.amount) || 0); }, 0); }
  function today0() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  function dkOf(d) { return ymk(d) + "-" + pad(d.getDate()); }
  function daysAgo(k) { return k ? Math.round((today0() - new Date(k + 'T00:00')) / 864e5) : null; }
  function data() { var d = window.Vault.get(); if (!d) return null; d.budget = d.budget || { income: [], fixed: [] }; d.budget.fixed = d.budget.fixed || []; d.budget.income = d.budget.income || []; return d; }
  function save(d) { window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
  function go(sel) { if (window.FinTabs) window.FinTabs.go(sel); }

  /* ================= the one number ================= */
  function hero(d) {
    var box = $('fnHero'), per = B.period(d), real = B.real(d), p = B.payPlan(d);
    var plan = per.income - p.fixed - p.spent, has = per.income > 0 || p.fixed > 0;
    if (!has && !real) {
      box.innerHTML = '<div class="fh-empty"><i class="bi bi-wallet2"></i><h2>Your money, in one place</h2><p class="muted">Add your accounts, your salary and what goes out each month – 4 short steps. Then this shows what you can really use until payday, what’s coming, and where it all goes.</p>' +
        '<button type="button" class="pill-btn wide" data-fsopen="0"><i class="bi bi-magic"></i> Set up Finances</button></div>';
      return;
    }
    var v = real ? real.free : plan, perDay = v > 0 ? v / Math.max(1, per.daysLeft) : 0;
    var pay = B.nextPayday(d), pc = B.pace ? B.pace(d) : null, m = A.money(d);
    var age = daysAgo(m.oldest), imp = daysAgo(d.lastImport);
    var parts = real ? [['In your accounts', real.cash, ''], ['Owed on cards', -real.owed, 'neg'], ['Bills before payday', -real.bills, 'neg'], ['Savings to move', -real.saveLeft, 'neg']]
      : [['Income', per.income, ''], ['Fixed costs', -p.fixed, 'neg'], ['Spent', -p.spent, 'neg']];
    parts = parts.filter(function (x) { return x[1]; });
    var paceLine = '';
    if (pc) {
      var endAt = real ? v - Math.max(0, pc.projected - pc.spent) : pc.end;
      paceLine = pc.ok && endAt >= 0 ? '<p class="fh-pace ok"><i class="bi bi-check2-circle"></i> On track – about ' + money(endAt) + ' left at payday at the pace you spend (' + money(pc.perDay) + '/day)</p>'
        : '<p class="fh-pace warn"><i class="bi bi-exclamation-triangle"></i> At this pace you end ' + money(Math.abs(endAt)) + (endAt < 0 ? ' short' : ' left') + ' – keep to ' + money(Math.max(0, perDay)) + ' a day</p>';
    }
    var trust = [];
    if (real && age != null) trust.push(age <= 1 ? 'balances up to date' : '<span class="' + (age > 7 ? 'soon' : '') + '">balances ' + age + ' days old</span>');
    if (!real) trust.push('<button type="button" class="text-btn" data-fnupd>Add your balances</button> for the real number');
    trust.push(imp == null ? 'no import yet' : imp === 0 ? 'imported today' : 'last import ' + imp + ' day' + (imp === 1 ? '' : 's') + ' ago');
    box.innerHTML =
      '<p class="fh-k">' + (real ? 'Free to use ' : 'Left in your budget ') + (per.byPayday ? 'until payday' : 'this month') + '</p>' +
      '<div class="fh-big ' + (v < 0 ? 'neg' : '') + '">' + money(v) + '</div>' +
      '<p class="fh-sub">' + (v > 0 ? '<b>' + money(perDay) + '</b> a day · ' : v < 0 ? '<b class="neg">short</b> · ' : '') + per.daysLeft + ' day' + (per.daysLeft === 1 ? '' : 's') + ' left' +
        (pay ? ' · payday ' + esc(pay.days === 0 ? 'today' : pay.days === 1 ? 'tomorrow' : pay.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</p>' +
      '<div class="fh-parts">' + parts.map(function (x) { return '<span><small>' + x[0] + '</small>' + money(x[1], x[2]) + '</span>'; }).join('') + '</div>' +
      paceLine +
      '<div class="fh-foot"><span class="muted">' + trust.join(' · ') + '</span><span class="fh-acts"><button type="button" class="icon-btn sm" data-fnupd aria-label="Update balances" title="Update balances"><i class="bi bi-pencil"></i></button>' +
        '<a class="icon-btn sm" href="#import" aria-label="Import from your bank" title="Import from your bank"><i class="bi bi-upload"></i></a>' +
        '<button type="button" class="icon-btn sm" data-qascan aria-label="Scan a receipt" title="Scan a receipt"><i class="bi bi-camera"></i></button></span></div>';
  }

  /* ================= Needs you: what the dashboard noticed ================= */
  function needs(d) {
    var box = $('fnNeeds'), card = $('fnNeedsCard'); if (!box) return;
    var out = [], m = A.money(d), per = B.period(d), list = A.list(d), dis = d.budget.needsOff || {};
    var off = function (k) { return dis[k] && dis[k] > Date.now(); };
    /* repeating charges that aren't bills yet */
    if (window.MoneyPlus) {
      try {
        window.MoneyPlus.detect(d).filter(function (r) { return r.active && !r.sub && !r.fixed && !r.ignored && r.amount >= 50 && ['groceries', 'eating', 'transport', 'shopping'].indexOf(r.cat) < 0; }).slice(0, 3).forEach(function (r) {
          var a = r.acct && A.get(d, r.acct);
          out.push({ k: 'rc:' + r.key, icon: 'arrow-repeat', c: '#3987e5', t: esc(r.name) + ' comes every month', s: money(r.amount) + ' around the ' + r.day + '.' + (a ? ' from ' + esc(a.label) : '') + ' · ' + r.n + ' months in a row',
            acts: '<button type="button" class="pill-btn sm" data-fnbill="' + esc(r.key) + '">Make it a bill</button><button type="button" class="text-btn" data-fnnotbill="' + esc(r.key) + '">Not a bill</button>' });
        });
      } catch (e) {}
    }
    if (!m.known && (d.budget.income.length || d.budget.fixed.length)) out.push({ k: 'bal', icon: 'bank2', c: '#8a6fdf', t: 'Add what’s in your accounts', s: 'Then the number above is what you can really use, not just the plan', acts: '<button type="button" class="pill-btn sm" data-fnupd>Add balances</button>' });
    else if (m.known && m.oldest && daysAgo(m.oldest) > 7) out.push({ k: 'old', icon: 'clock-history', c: '#c98500', t: 'Your balances are ' + daysAgo(m.oldest) + ' days old', s: 'Import your bank files or type the new balances', acts: '<a class="pill-btn sm" href="#import">Import</a><button type="button" class="text-btn" data-fnupd>Update</button>' });
    if (m.missing && m.missing.length && m.known) out.push({ k: 'miss', icon: 'question-circle', c: '#6b6d73', t: 'No balance for ' + esc(m.missing.map(function (a) { return a.label; }).join(', ')), s: 'They’re left out of the number above and your net worth', acts: '<button type="button" class="text-btn" data-fnupd>Add</button>' });
    list.filter(function (a) { return a.kind === 'credit' && !a.due; }).slice(0, 1).forEach(function (a) { out.push({ k: 'due:' + a.id, icon: 'credit-card', c: '#d95926', t: 'When is the ' + esc(a.label) + ' bill due?', s: 'Then you get a reminder and it shows in the next 14 days', acts: '<button type="button" class="text-btn" data-fsopen="0">Set the day</button>' }); });
    if (d.budget.income.length && !B.hasPayday(d)) out.push({ k: 'payday', icon: 'cash-stack', c: '#11a597', t: 'Give your salary a payday', s: 'The budget then runs from payday to payday', acts: '<button type="button" class="text-btn" data-fsopen="1">Set payday</button>' });
    var other = (d.expenses || []).filter(function (e) { return per.has(e.date) && (e.cat || 'other') === 'other'; });
    if (other.length >= 3) out.push({ k: 'other:' + per.startKey, icon: 'tags', c: '#c98500', t: other.length + ' expenses are filed under Other', s: money(sum(other)) + ' this period – sort them to see where the money goes', acts: '<button type="button" class="text-btn" data-fnsort>Sort them</button>' });
    var lim = d.budget.limits || {}, sp = {};
    (d.expenses || []).forEach(function (e) { if (per.has(e.date)) sp[e.cat] = (sp[e.cat] || 0) + (+e.amount || 0); });
    Object.keys(lim).filter(function (c) { return +lim[c] > 0 && sp[c] > lim[c]; }).slice(0, 1).forEach(function (c) {
      out.push({ k: 'lim:' + c + ':' + per.startKey, icon: 'exclamation-octagon', c: '#e66767', t: (CATN[c] || c) + ' is over its limit', s: money(sp[c] - lim[c]) + ' over ' + money(lim[c]) + ' this period', acts: '<button type="button" class="text-btn" data-fngo=".card.limits">See limits</button>' });
    });
    out = out.filter(function (x) { return !off(x.k); }).slice(0, 4);
    card.hidden = !out.length;
    $('fnNeedsN').textContent = out.length ? out.length : '';
    box.innerHTML = '<ul class="fn-needs">' + out.map(function (x) {
      return '<li data-fnk="' + esc(x.k) + '"><span class="kit-ic" style="--c:' + x.c + '"><i class="bi bi-' + x.icon + '"></i></span><span class="fn-nt"><b>' + x.t + '</b><small>' + x.s + '</small><span class="fn-na">' + x.acts + '</span></span>' +
        '<button type="button" class="icon-btn sm fn-x" data-fnoff="' + esc(x.k) + '" aria-label="Not now"><i class="bi bi-x"></i></button></li>';
    }).join('') + '</ul>';
  }
  var CATN = { groceries: 'Groceries', eating: 'Eating out', transport: 'Transport', shopping: 'Shopping', home: 'Home', fun: 'Fun', health: 'Health', travel: 'Travel', other: 'Other' };

  /* ================= the next 14 days ================= */
  function next(d) {
    var box = $('fnNext'); if (!box) return;
    var t0 = today0(), end = new Date(t0); end.setDate(end.getDate() + 14);
    var ev = [], list = A.list(d), ids = {}; list.forEach(function (a) { ids[a.id] = a; });
    var main = list.filter(function (a) { return a.kind === 'salary'; })[0];
    /* bills: overdue ones this month first, then each due day in the window */
    for (var mo = -1; mo <= 1; mo++) {
      var base = new Date(t0.getFullYear(), t0.getMonth() + mo, 1), k = ymk(base), dim = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate(), paid = (d.paid && d.paid[k]) || [];
      d.budget.fixed.concat(d.budget.later || []).forEach(function (f) {
        if (!f.day || f.src === 'save' || f.src === 'year') return;
        if (B.activeIn && !B.activeIn(f, k)) return;            /* a bill that hasn't started yet, or has ended, that month */
        var dt = new Date(base.getFullYear(), base.getMonth(), Math.min(+f.day, dim));
        if (f.start && ymk(dt) <= String(f.start).slice(0, 7)) return;     /* a loan pays from the month after its start/balance date */
        var isPaid = paid.indexOf(f.id) > -1, auto = f.src === 'sub' && dt <= t0;
        var late = dt < t0 && !isPaid && !auto && mo === 0;
        if (!(late || (dt >= t0 && dt <= end))) return;
        var a = ids[f.acct] || main;
        var own = f.vary && f.months && f.months[k] != null && f.months[k] !== '';
        ev.push({ dt: late ? t0 : dt, real: dt, kind: 'bill', id: f.id, ym: k, paid: isPaid || auto, late: late, name: f.name, amt: -(B.fixedAmt ? B.fixedAmt(f, k) : +f.amount || 0), open: !f.src, vary: !!f.vary && !own,
          sub: (a ? (a.kind === 'credit' ? 'on ' : 'from ') + a.label : '') + (f.src === 'loan' ? ' · loan' : f.src === 'sub' ? ' · subscription' : '') + (f.vary ? (own ? ' · this month’s amount' : ' · varies, estimate') : '') + (f.split && B.fixedWhole ? ' · your part of ' + kr(B.fixedWhole(f, k)) : '') });
      });
    }
    /* credit card bills */
    B.cardBills(d).forEach(function (c) {
      if (!c.due || !c.date) return;
      var late = c.days < 0 && !c.paid;
      if (!(late || (c.date >= t0 && c.date <= end))) return;
      ev.push({ dt: late ? t0 : c.date, real: c.date, kind: 'card', id: c.acct.id, paid: c.paid, late: late, name: c.acct.label + ' bill', amt: -c.amount, sub: c.paid ? 'paid in full' : 'pay the whole bill' + (c.owedNow ? ' · what you owe now' : '') });
    });
    /* paydays (with the checklist) */
    B.paydays(d, t0, end).forEach(function (x) {
      var p = B.payPlan(d, new Date(x.date.getTime() + 864e5 / 2));
      ev.push({ dt: x.date, real: x.date, kind: 'pay', name: x.title, amt: x.net, sub: (x.src.name || 'Salary') + (p.moves.length ? ' · ' + p.moves.length + ' move' + (p.moves.length === 1 ? '' : 's') + ' on the checklist' : '') });
    });
    /* yearly costs that fall in this month / next month inside the window */
    (d.budget.yearly || []).forEach(function (y) {
      var dt = new Date(t0.getFullYear() + (y.month - 1 < t0.getMonth() ? 1 : 0), y.month - 1, 1);
      if (dt < new Date(t0.getFullYear(), t0.getMonth(), 1) || dt > end) return;
      ev.push({ dt: dt < t0 ? t0 : dt, real: dt, kind: 'year', name: y.name, amt: -(+y.amount || 0), sub: 'yearly cost · ' + dt.toLocaleDateString('en-GB', { month: 'long' }) + ' – from what you set aside' });
    });
    ev.sort(function (a, b) { return (b.late - a.late) || (a.dt - b.dt) || (a.kind === 'pay' ? -1 : 1); });
    var out = sum(ev.filter(function (e) { return e.amt < 0 && !e.paid; }), function (e) { return -e.amt; }), inn = sum(ev.filter(function (e) { return e.amt > 0; }), function (e) { return e.amt; });
    $('fnNextNote').innerHTML = ev.length ? money(-out, 'neg') + (inn ? ' · ' + money(inn) : '') : '';
    if (!ev.length) { box.innerHTML = '<p class="empty">Nothing due in the next 14 days. Give your fixed costs a due day (Setup → Income &amp; fixed costs) and they show up here.</p>'; return; }
    var label = function (e) {
      var n = Math.round((e.real - t0) / 864e5);
      return e.late ? '<span class="late">' + (-n) + ' day' + (n === -1 ? '' : 's') + ' late</span>' : n === 0 ? '<span class="soon">Today</span>' : n === 1 ? 'Tomorrow' : e.real.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    };
    box.innerHTML = '<ul class="fn-next">' + ev.map(function (e) {
      var tick = e.kind === 'bill' ? '<button type="button" class="check" data-fnpaid="' + esc(e.id) + '" data-ym="' + e.ym + '" aria-pressed="' + e.paid + '" aria-label="' + esc(e.name) + (e.paid ? ' – paid' : ' – mark as paid') + '"><i class="bi bi-check-lg"></i></button>'
        : e.kind === 'card' ? '<button type="button" class="check" data-pfcc="' + esc(e.id) + '" aria-pressed="' + e.paid + '" aria-label="' + esc(e.name) + (e.paid ? ' – paid' : ' – mark as paid in full') + '"><i class="bi bi-check-lg"></i></button>'
        : '<span class="fn-ic ' + e.kind + '"><i class="bi bi-' + (e.kind === 'pay' ? 'cash-stack' : 'calendar2-range') + '"></i></span>';
      return '<li class="fn-e ' + e.kind + (e.paid ? ' paid' : '') + (e.late ? ' late' : '') + '">' + tick + (e.open ? '<button type="button" class="fn-t fn-open" data-fbopen="' + esc(e.id) + '" aria-label="Change ' + esc(e.name) + '">' : '<span class="fn-t">') + '<b>' + esc(e.name) + '</b><small>' + label(e) + (e.sub ? ' · ' + esc(e.sub) : '') + '</small>' + (e.open ? '</button>' : '</span>') + (e.vary ? '<span class="fn-approx" title="Estimate">≈</span>' : '') + money(e.amt, e.amt < 0 ? '' : 'up') + '</li>';
    }).join('') + '</ul>';
  }

  /* ================= how the last period went (the first days after payday) ================= */
  function review(d) {
    var card = $('fnReviewCard'), box = $('fnReview'); if (!card) return;
    var per = B.period(d), into = per.days - per.daysLeft;
    var prevEnd = new Date(per.start); prevEnd.setDate(prevEnd.getDate() - 1);
    var prev = B.period(d, prevEnd), done = (d.budget.reviewDone || {})[prev.startKey];
    if (into > 6 || done || !(prev.income > 0) || !(d.expenses || []).some(function (e) { return prev.has(e.date); })) { card.hidden = true; return; }
    var fixed = sum(d.budget.fixed), spent = B.spent(d, prev), kept = prev.income - fixed - spent;
    var lim = d.budget.limits || {}, sp = {};
    (d.expenses || []).forEach(function (e) { if (prev.has(e.date)) sp[e.cat] = (sp[e.cat] || 0) + (+e.amount || 0); });
    var over = Object.keys(lim).filter(function (c) { return +lim[c] > 0 && (sp[c] || 0) > lim[c]; }), under = Object.keys(lim).filter(function (c) { return +lim[c] > 0 && (sp[c] || 0) <= lim[c]; });
    var top = Object.keys(sp).sort(function (a, b) { return sp[b] - sp[a]; }).slice(0, 3);
    var goals = (d.savings || []).filter(function (g) { return (+g.target || 0) > (+g.saved || 0); });
    var g0 = goals.filter(function (g) { return g.buffer; })[0] || goals[0];
    card.hidden = false;
    $('fnReviewNote').textContent = prev.name;
    box.innerHTML =
      '<ul class="pf-wf">' +
        '<li><i class="dot" style="background:#8a6fdf"></i><span>Income</span><b>' + money(prev.income) + '</b></li>' +
        '<li><i class="dot" style="background:#3987e5"></i><span>− Fixed costs</span><b>' + money(fixed) + '</b></li>' +
        '<li><i class="dot" style="background:#d95926"></i><span>− Spent<small>' + esc(top.map(function (c) { return (CATN[c] || c) + ' ' + kr(sp[c]); }).join(' · ')) + '</small></span><b>' + money(spent) + '</b></li>' +
        '<li class="pf-eq' + (kept < 0 ? ' neg' : '') + '"><i class="dot" style="background:var(--accent)"></i><span>= ' + (kept < 0 ? 'Over' : 'Kept') + '</span><b>' + money(kept) + '</b></li></ul>' +
      (over.length || under.length ? '<p class="muted fr-lim">' + (under.length ? '<i class="bi bi-check2-circle" style="color:var(--accent)"></i> Within the limit: ' + esc(under.map(function (c) { return CATN[c] || c; }).join(', ')) + '. ' : '') +
        (over.length ? '<i class="bi bi-exclamation-triangle" style="color:#c98500"></i> Over: ' + esc(over.map(function (c) { return (CATN[c] || c) + ' +' + kr(sp[c] - lim[c]); }).join(', ')) + '.' : '') + '</p>' : '') +
      '<div class="form-actions">' + '<button type="button" class="text-btn" data-fnrevok>Done</button><span class="spacer"></span>' +
        (kept > 0 && g0 ? '<button type="button" class="pill-btn" data-fnkeep="' + esc(g0.id) + '" data-amt="' + Math.round(kept) + '">Put ' + esc(kr(kept)) + ' into ' + esc(g0.name) + '</button>' : '') + '</div>';
  }

  /* ================= actions ================= */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t.closest || !t.closest('#fp')) return;
    var d;
    if (t.closest('[data-fnupd]')) { var ed = $('fpMoneyEdit'); go('.card.myaccts'); if (ed && ed.textContent.trim() !== 'Done') setTimeout(function () { ed.click(); }, 120); return; }
    var pd = t.closest('[data-fnpaid]');
    if (pd) { d = data(); if (!d) return; var k = pd.dataset.ym, l = (d.paid = d.paid || {})[k] = (d.paid[k] || []), i = l.indexOf(pd.dataset.fnpaid); if (i > -1) l.splice(i, 1); else l.push(pd.dataset.fnpaid); save(d); return; }
    var bl = t.closest('[data-fnbill]');
    if (bl && window.MoneyPlus) { var r = window.MoneyPlus.detect().filter(function (x) { return x.key === bl.dataset.fnbill; })[0]; if (r) window.MoneyPlus.addAs(r, 'fixed'); return; }
    var nb = t.closest('[data-fnnotbill]'); if (nb && window.MoneyPlus) { window.MoneyPlus.setIgnore(nb.dataset.fnnotbill, true); setTimeout(render, 50); return; }
    var off = t.closest('[data-fnoff]');
    if (off) { d = data(); if (!d) return; d.budget.needsOff = d.budget.needsOff || {}; d.budget.needsOff[off.dataset.fnoff] = Date.now() + 7 * 864e5; Object.keys(d.budget.needsOff).forEach(function (x) { if (d.budget.needsOff[x] < Date.now()) delete d.budget.needsOff[x]; }); save(d); return; }
    if (t.closest('[data-fnsort]')) { go('.card.spending'); setTimeout(function () { var b = document.querySelector('#spMore'); if (b && !b.hidden) b.click(); }, 300); return; }
    var g = t.closest('[data-fngo]'); if (g) { go(g.dataset.fngo); return; }
    if (t.closest('[data-fnrevok]')) { d = data(); if (!d) return; var per = B.period(d), pe = new Date(per.start); pe.setDate(pe.getDate() - 1); (d.budget.reviewDone = d.budget.reviewDone || {})[B.period(d, pe).startKey] = 1; save(d); return; }
    var kp = t.closest('[data-fnkeep]');
    if (kp) {
      d = data(); if (!d) return; var amt = +kp.dataset.amt;
      (d.savings || []).forEach(function (x) { if (x.id === kp.dataset.fnkeep) { x.saved = (+x.saved || 0) + amt; var y = String(new Date().getFullYear()); x.yr = x.yr || {}; x.yr[y] = (+x.yr[y] || 0) + amt; } });
      var per2 = B.period(d), pe2 = new Date(per2.start); pe2.setDate(pe2.getDate() - 1); (d.budget.reviewDone = d.budget.reviewDone || {})[B.period(d, pe2).startKey] = 1;
      save(d); if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-piggy-bank"></i> ' + esc(kr(amt)) + ' added to your goal'); return;
    }
  });

  function render() { var d = data(); if (!d) return; try { hero(d); needs(d); next(d); review(d); } catch (e) { console.error(e); } }
  window.addEventListener('fin:change', function () { setTimeout(render, 0); });
  window.addEventListener('tools:change', function () { setTimeout(render, 0); });
  window.Vault.onUnlock(render);
  window.Vault.onLock(function () { ['fnHero', 'fnNeeds', 'fnNext', 'fnReview'].forEach(function (id) { if ($(id)) $(id).innerHTML = ''; }); });
  window.FinNow = { render: render };
})();
