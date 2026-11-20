/* "What if?" – the maths (2026-11-19, plan Part 2). No page, no DOM: WhatIf.base(d) reads today's numbers from your
   finances, WhatIf.project(base, changes, months) runs them month by month. Finances → Insights draws it (whatif.page.js).
   Kept simple on purpose, in today's kroner (no price growth or pay rises):
   - money in  = your net pay for that calendar month (Budget.income – June and December follow your tax card)
   - money out = your fixed costs without the loans (Budget.fixedAmt, your part of shared ones) + everyday spending
                 (the average of the last three whole months, one-offs left out) + your part of each loan payment
   - loans     = your part of each debt in Net worth, paid down month by month at its rate; the payment stops when it's paid
   - assets    = the assets in Net worth (savings, funds …); what's left each month is added, a shortfall is taken
   A change: { type, from: 'YYYY-MM', … }
     rate   { delta }                 the rate on every loan goes up (or down) by delta %-points; payments follow
     buy    { amount, loan, rate, years }  a big purchase that month, paid in cash or with a new loan
     income { pct }                   your pay becomes pct % of today's
     extra  { amount }                extra paid on the loan with the highest rate, every month
     cost   { amount, until }         a new monthly cost (or a negative one: a cost that stops)
     child  { amount }                monthly costs for a child (a rough default – change it)
     custom { label, once, monthly, until }  anything else: a one-off amount and/or a monthly one (+ money in, − money out)
   Assets = savings and other assets + your part of a home's value (kept with its mortgage); the warning looks at money only.
   The starting numbers (pay, fixed costs, everyday spending) can be set by hand – the card passes them in b. */
(function () {
  'use strict';
  function ym(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function addM(k, n) { var p = k.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1); return ym(d); }
  function pmt(bal, rate, months) { var i = (+rate || 0) / 1200; months = Math.max(1, Math.round(months)); return i > 0 ? bal * i / (1 - Math.pow(1 + i, -months)) : bal / months; }
  function monthsLeft(bal, rate, pay) {
    var i = (+rate || 0) / 1200; if (pay <= bal * i + 0.5) return 600;
    return Math.min(600, Math.ceil(i > 0 ? -Math.log(1 - bal * i / pay) / Math.log(1 + i) : bal / pay));
  }

  /* today's numbers from the vault data */
  function base(d, now) {
    now = now || new Date();
    var B = window.Budget, L = window.Loans, k = ym(now);
    /* pay for each calendar month of the next year (holiday pay in June, half tax in December, a payslip that's
       already logged) – the plan uses the right one for each month; the average is what's shown (20 Nov: this month
       alone was 21 173 kr against a normal 66 343 kr) */
    var incomeBy = {}, isum = 0;
    for (var q = 1; q <= 12; q++) { var mk = addM(k, q), iv = B && B.income ? Math.max(0, +B.income(d, mk) || 0) : 0; incomeBy[mk.slice(5)] = Math.round(iv); isum += iv; }
    var income = isum / 12;
    var fixed = ((d && d.budget && d.budget.fixed) || []).filter(function (f) { return f && f.src !== 'loan' && !/^loan-/.test(f.id || ''); });
    var fixedNow = fixed.reduce(function (a, f) { return a + (B && B.activeIn && !B.activeIn(f, k) ? 0 : (B && B.fixedAmt ? +B.fixedAmt(f, k) || 0 : +f.amount || 0)); }, 0);
    /* everyday spending: the last three whole months, one-offs out */
    var months = [1, 2, 3].map(function (n) { return addM(k, -n); });
    var ex = (d && d.expenses) || [], tot = 0, used = 0;
    months.forEach(function (m) {
      var l = ex.filter(function (e) { return e && typeof e.date === 'string' && e.date.slice(0, 7) === m; });
      if (!l.length) return;
      var big = B && B.oneOffs ? B.oneOffs(l, income - fixedNow) : [];
      tot += l.reduce(function (a, e) { return a + (big.indexOf(e) >= 0 ? 0 : (+e.amount || 0)); }, 0); used++;
    });
    var spend = used ? tot / used : 0;
    var loans = ((d && d.accounts) || []).filter(function (a) { return a && a.kind === 'debt'; }).map(function (a) {
      var part = L && L.part ? L.part(a) : 1, bal = (L && L.owedNow ? L.owedNow(a, now) : +a.balance || 0) * part;
      var pay = L && L.myPay ? +L.myPay(a, now) || 0 : (+a.pay || 0) * part;
      return { id: a.id, name: a.name || 'Loan', bal: Math.max(0, bal), rate: +a.rate || 0, pay: Math.max(0, pay) };
    }).filter(function (l) { return l.bal > 0.5; });
    var assets = ((d && d.accounts) || []).filter(function (a) { return a && a.kind !== 'debt'; }).reduce(function (s, a) { return s + (+a.balance || 0); }, 0);
    /* your part of a home is kept with its mortgage (a.home = { value, own % }) – it counts as an asset, like on Net worth (20 Nov, JP) */
    var home = ((d && d.accounts) || []).filter(function (a) { return a && a.kind === 'debt' && a.home && +a.home.value > 0; }).reduce(function (s, a) { return s + (+a.home.value) * (+a.home.own || 50) / 100; }, 0);
    return { start: k, income: Math.round(income), incomeBy: incomeBy, fixed: Math.round(fixedNow), fixedRows: fixed, spend: Math.round(spend), loans: loans, assets: Math.round(assets), home: Math.round(home) };
  }

  /* month by month; returns { rows: [{ m, assets, debt, net, left, costs }], low: first month the assets are under one month's costs } */
  function project(b, changes, n) {
    changes = (changes || []).filter(Boolean); n = Math.max(1, Math.min(240, n || 60));
    var B = window.Budget;
    var loans = (b.loans || []).map(function (l) { return { id: l.id, name: l.name, bal: l.bal, rate: l.rate, pay: l.pay }; });
    var assets = b.assets || 0, rows = [], low = null;
    var on = function (c, m) { return (!c.from || c.from <= m) && (!c.until || c.until >= m); };
    for (var i = 1; i <= n; i++) {
      var m = addM(b.start, i);
      /* fixed costs without the loans, for that month (rows that start or stop later follow their dates) */
      var fixed = b.fixedRows ? b.fixedRows.reduce(function (a, f) { return a + (B && B.activeIn && !B.activeIn(f, m) ? 0 : (B && B.fixedAmt ? +B.fixedAmt(f, m) || 0 : +f.amount || 0)); }, 0) : (b.fixed || 0);
      var pay = b.incomeBy && b.incomeBy[m.slice(5)] != null ? b.incomeBy[m.slice(5)] : (b.income || 0), income = pay, extra = 0, more = 0;
      changes.forEach(function (c) {
        if (c.type === 'income' && on(c, m)) income = pay * (Math.max(0, +c.pct || 0) / 100);
        if ((c.type === 'cost' || c.type === 'child') && on(c, m)) more += +c.amount || 0;
        if (c.type === 'custom') {
          if (on(c, m)) more -= +c.monthly || 0;                                   /* + money in, − money out */
          if (+c.once && (c.from === m || (i === 1 && c.from < m))) assets += +c.once;
        }
        if (c.type === 'extra' && on(c, m)) extra += Math.max(0, +c.amount || 0);
        if (c.type === 'buy' && (c.from === m || (i === 1 && c.from < m))) {
          var amt = Math.max(0, +c.amount || 0);
          if (c.loan) loans.push({ id: 'wi-' + i, name: 'New loan', bal: amt, rate: +c.rate || 0, pay: pmt(amt, +c.rate || 0, (+c.years || 5) * 12) });
          else assets -= amt;
        }
        if (c.type === 'rate' && (c.from === m || (i === 1 && c.from < m))) loans.forEach(function (l) {
          var left = monthsLeft(l.bal, l.rate, l.pay); l.rate = Math.max(0, l.rate + (+c.delta || 0)); l.pay = pmt(l.bal, l.rate, left);
        });
      });
      /* the loans this month; extra goes to the highest rate first */
      var pays = 0;
      loans.sort(function (x, y) { return y.rate - x.rate; });
      loans.forEach(function (l) {
        if (l.bal <= 0.5) { l.bal = 0; return; }
        var r = l.bal * l.rate / 1200, p = Math.min(l.pay, l.bal + r);
        if (extra > 0) { var e = Math.min(extra, l.bal + r - p); p += e; extra -= e; }
        l.bal = Math.max(0, l.bal + r - p); pays += p;
      });
      var costs = fixed + (b.spend || 0) + more + pays;
      var left = income - costs; assets += left;
      var debt = loans.reduce(function (a, l) { return a + l.bal; }, 0);
      if (low == null && assets < costs) low = m;
      rows.push({ m: m, assets: Math.round(assets), home: Math.round(b.home || 0), debt: Math.round(debt), net: Math.round(assets + (b.home || 0) - debt), left: Math.round(left), costs: Math.round(costs) });
    }
    return { rows: rows, low: low };
  }
  window.WhatIf = { base: base, project: project, addM: addM, pmt: pmt };
})();
