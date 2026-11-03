/* Budget maths shared by the dashboard, the Finances page, the calendar and the reviews.
   An income can be entered as the net amount that lands in your account, or as the gross
   salary with the tax (skattetrekk) and other deductions – pension, union fees and so on –
   and the dashboard works out what you're actually paid, month by month:
     · June: holiday pay (feriepenger) instead of salary, no tax taken
     · December: half tax
   Each income can have a payday, so you also see when the next one comes. */
window.Budget = (function () {
  "use strict";
  function pad(n) { return String(n).padStart(2, '0'); }
  function ym(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function daysIn(y, m) { return new Date(y, m, 0).getDate(); }

  /* one income row → what it pays out in the month 'YYYY-MM'
     r: { amount (net, ordinary month) | gross, taxPct, taxExtra (kr), benefits (taxable, not paid out),
          deductions [{name, amount|pct}], payYear, holidayPay (kr, earned last year), holidayWeeks (4|5), day } */
  function rowFor(r, key) {
    var out = { name: r.name, net: +r.amount || 0, gross: 0, tax: 0, extra: 0, items: [], note: '', day: r.day || null, holiday: false };
    if (!(r.gross > 0)) return out;
    var m = +key.slice(5, 7), gross = +r.gross, pct = +r.taxPct || 0, benefits = +r.benefits || 0, taxExtra = +r.taxExtra || 0;
    var ded = (r.deductions || []).map(function (x) {
      var v = x.pct ? gross * (+x.pct || 0) / 100 : +x.amount || 0;
      return { name: x.name, amount: v };
    });
    var extra = ded.reduce(function (a, x) { return a + x.amount; }, 0);
    out.items = ded; out.extra = extra;
    var salary = gross, tax, note = '';
    if (r.payYear && m === 6) {
      /* June: holiday pay (earned last year, not taxed) is paid, and the salary for the holiday
         weeks is held back – 30/26 of a month for 5 weeks, 25/26 for 4 */
      var hol = r.holidayPay != null && r.holidayPay !== '' ? +r.holidayPay || 0 : gross * 12 * 0.12;
      if (hol > 0) {
        var held = gross * ((+r.holidayWeeks || 5) === 4 ? 25 : 30) / 26;
        salary = gross - held;
        tax = Math.max(0, (salary + benefits) * pct / 100);
        out.gross = hol + salary; out.tax = tax; out.net = hol + salary - tax - extra; out.holiday = true; out.note = 'Holiday pay, no tax';
        return out;
      }
      note = 'No holiday pay earned last year – a normal month';
    }
    tax = (salary + benefits) * pct / 100 + taxExtra;
    if (r.payYear && m === 12) { tax = tax / 2; note = 'Half tax in December'; }
    out.gross = salary; out.tax = tax; out.net = salary - tax - extra; out.note = note;
    return out;
  }
  /* the net amount in an ordinary month (what's stored as r.amount) */
  function ordinary(r) {
    var g = +r.gross || 0;
    if (!(g > 0)) return +r.amount || 0;
    var extra = (r.deductions || []).reduce(function (a, x) { return a + (x.pct ? g * (+x.pct || 0) / 100 : +x.amount || 0); }, 0);
    return g - (g + (+r.benefits || 0)) * (+r.taxPct || 0) / 100 - (+r.taxExtra || 0) - extra;
  }
  /* a logged payslip for a month overrides the model (d.budget.payslips['YYYY-MM'] = {net, gross, tax}) */
  function slip(d, key) { var p = d && d.budget && d.budget.payslips; return p && p[key] && p[key].net > 0 ? p[key] : null; }
  /* all incomes for a month */
  function incomeOf(d, key) {
    var rows = ((d && d.budget && d.budget.income) || []).map(function (r) { return rowFor(r, key); });
    var t = { net: 0, gross: 0, tax: 0, extra: 0, rows: rows, note: '', logged: false };
    rows.forEach(function (r) { t.net += r.net; t.gross += r.gross; t.tax += r.tax; t.extra += r.extra; if (r.note && !t.note) t.note = r.note; });
    var s = slip(d, key);
    if (s) {
      var others = rows.filter(function (r) { return !r.gross; }).reduce(function (a, r) { return a + r.net; }, 0);   // plain net incomes stay
      t.net = (+s.net || 0) + others; t.logged = true;
      if (s.gross > 0) { t.gross = +s.gross; t.tax = +s.tax || 0; t.extra = Math.max(0, +s.gross - (+s.tax || 0) - +s.net); }
      t.note = 'From your payslip';
    }
    return t;
  }
  /* this year so far: logged payslips where you have them, the model for the other months up to now */
  function yearSoFar(d, now) {
    now = now || new Date();
    var y = now.getFullYear(), out = { gross: 0, tax: 0, net: 0, months: 0, logged: 0 };
    for (var m = 1; m <= now.getMonth() + 1; m++) {
      var key = y + '-' + pad(m), t = incomeOf(d, key);
      if (!t.net) continue;
      out.gross += t.gross; out.tax += t.tax; out.net += t.net; out.months++; if (t.logged) out.logged++;
    }
    return out;
  }
  function income(d, key) { return incomeOf(d, key || ym(new Date())).net; }

  /* paydays: the date of each income's payday in a month (weekend → the Friday before, as banks do) */
  function paydayIn(r, y, m) {
    if (!r.day) return null;
    var dt = new Date(y, m - 1, Math.min(+r.day, daysIn(y, m)));
    if (r.day === 'last' || +r.day > 28) dt = new Date(y, m - 1, Math.min(r.day === 'last' ? 31 : +r.day, daysIn(y, m)));
    while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() - 1);
    return dt;
  }
  function paydays(d, from, to) {
    var out = [], rows = (d && d.budget && d.budget.income) || [];
    for (var y = from.getFullYear(); y <= to.getFullYear(); y++) {
      for (var m = 1; m <= 12; m++) rows.forEach(function (r) {
        var dt = paydayIn(r, y, m);
        if (!dt || dt < from || dt > to) return;
        var row = rowFor(r, y + '-' + pad(m));
        out.push({ date: dt, row: row, src: r, title: row.holiday ? 'Holiday pay' : 'Payday' + (rows.length > 1 ? ' · ' + r.name : ''), net: row.net });
      });
    }
    return out.sort(function (a, b) { return a.date - b.date; });
  }
  /* the next payday from today (today counts if it hasn't passed) */
  function nextPayday(d, from) {
    from = from || new Date();
    var start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    var end = new Date(start); end.setMonth(end.getMonth() + 2);
    var list = paydays(d, start, end);
    if (!list.length) return null;
    var p = list[0], days = Math.round((p.date - start) / 864e5);
    return { date: p.date, days: days, title: p.title, net: p.net, name: p.src.name };
  }
  function hasPayday(d) { return ((d && d.budget && d.budget.income) || []).some(function (r) { return r.day; }); }

  /* The budget period: a calendar month, or – when d.budget.period is 'payday' and an income has a
     payday – from one payday up to the day before the next. */
  function dk(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function period(d, now) {
    now = now || new Date();
    var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    /* default: when your salary has a payday, the budget runs payday → payday (you live on last month's salary until the next one);
       "Calendar month" in Edit switches it back */
    var byPay = d && d.budget && (d.budget.period === 'payday' || d.budget.period == null) && hasPayday(d);
    var start, end, label, income;
    if (byPay) {
      var back = new Date(t0); back.setMonth(back.getMonth() - 2);
      var fwd = new Date(t0); fwd.setMonth(fwd.getMonth() + 2);
      /* boundaries follow the main income (the biggest one) */
      var rows = d.budget.income.filter(function (r) { return r.day; });
      var main = rows.slice().sort(function (a, b) { return ordinary(b) - ordinary(a); })[0];
      var all = paydays(d, back, fwd), mine = all.filter(function (p) { return p.src === main; });
      var prev = mine.filter(function (p) { return p.date <= t0; }).pop(), next = mine.filter(function (p) { return p.date > t0; })[0];
      if (prev && next) {
        start = prev.date; end = new Date(next.date); end.setDate(end.getDate() - 1);
        income = all.filter(function (p) { return p.date >= start && p.date <= end; }).reduce(function (a, p) { return a + p.net; }, 0);
        label = 'until payday';
      }
    }
    if (!start) {
      start = new Date(t0.getFullYear(), t0.getMonth(), 1); end = new Date(t0.getFullYear(), t0.getMonth() + 1, 0);
      income = incomeOf(d, ym(t0)).net; label = 'this month'; byPay = false;
    }
    var sk = dk(start), ek = dk(end);
    /* money in that isn't salary – refunds, Vipps from friends, things you sold (from bank imports) */
    var extra = ((d && d.extra) || []).filter(function (e) { var k = String(e.date || '').slice(0, 10); return k >= sk && k <= ek; }).reduce(function (a, e) { return a + (+e.amount || 0); }, 0);
    return {
      byPayday: byPay, start: start, end: end, startKey: sk, endKey: ek, income: income + extra, salary: income, extra: extra, label: label,
      days: Math.round((end - start) / 864e5) + 1, daysLeft: Math.round((end - t0) / 864e5) + 1,
      has: function (dateStr) { var k = String(dateStr).slice(0, 10); return k >= sk && k <= ek; },
      name: byPay ? start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – ' + end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : t0.toLocaleDateString('en-GB', { month: 'long' })
    };
  }
  /* pace: where this period ends up if you keep spending like you have so far
     { projected, room, end (what's left at the end), perDay, elapsed, ok } – null early in the period */
  function pace(d, now) {
    now = now || new Date();
    var per = period(d, now), fixed = ((d && d.budget && d.budget.fixed) || []).reduce(function (a, f) { return a + (+f.amount || 0); }, 0);
    if (!(per.income > 0)) return null;
    var elapsed = per.days - per.daysLeft + 1, sp = spent(d, per), room = per.income - fixed;
    if (elapsed < 5 || per.daysLeft < 2) return null;
    var projected = sp / elapsed * per.days;
    return { per: per, spent: sp, room: room, projected: projected, end: room - projected, perDay: sp / elapsed, elapsed: elapsed, ok: projected <= room };
  }
  /* a savings goal: what to put aside each month – your own amount, or worked out from "reach it by" */
  function saveMonthly(g, now) {
    now = now || new Date();
    var left = (+g.target || 0) - (+g.saved || 0);
    if (!(left > 0)) return 0;
    if (+g.monthly > 0) return Math.min(+g.monthly, left);
    if (!/^\d{4}-\d{2}/.test(g.by || '')) return 0;
    var y = +g.by.slice(0, 4), m = +g.by.slice(5, 7) - 1;
    var months = Math.max(1, (y - now.getFullYear()) * 12 + (m - now.getMonth()) + 1);
    var i = (+g.rate || 0) / 100 / 12;
    if (i > 0) {          // with interest: what grows on what you have, plus a fixed amount each month
      var f = Math.pow(1 + i, months), need = (+g.target || 0) - (+g.saved || 0) * f;
      return need > 0 ? Math.ceil(need * i / (f - 1) / 10) * 10 : 0;
    }
    return Math.ceil(left / months / 10) * 10;
  }
  /* a goal with an amount a month: when you get there (with interest, if it earns any) */
  function saveForecast(g, now) {
    now = now || new Date();
    var p = +g.monthly || 0, have = +g.saved || 0, t = +g.target || 0, i = (+g.rate || 0) / 100 / 12, n = 0;
    if (!(t > have) || !(p > 0)) return null;
    while (have < t && n < 600) { have = have * (1 + i) + p; n++; }
    var d = new Date(now.getFullYear(), now.getMonth() + n, 1);
    return { months: n, date: d, label: n >= 600 ? '' : 'in ' + n + ' month' + (n === 1 ? '' : 's') + ' (' + d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) + ')' };
  }
  function spent(d, per) { return ((d && d.expenses) || []).filter(function (e) { return per.has(e.date); }).reduce(function (a, e) { return a + (+e.amount || 0); }, 0); }

  return { saveMonthly: saveMonthly, saveForecast: saveForecast, period: period, spent: spent, pace: pace, slip: slip, yearSoFar: yearSoFar, rowFor: rowFor, ordinary: ordinary, incomeOf: incomeOf, income: income, paydays: paydays, nextPayday: nextPayday, hasPayday: hasPayday, ym: ym };
})();

/* Loans (annuity – the same payment every month, as most Norwegian mortgages and car loans):
   l = { balance, rate (% a year), pay (kr a month, without the fee), fee, asOf (YYYY-MM-DD the balance was entered) } */
window.Loans = (function () {
  "use strict";
  var TAX = 0.22;        // rentefradrag: interest is deducted from ordinary income, taxed at 22 %
  function payment(bal, ratePct, months) {
    var i = (+ratePct || 0) / 1200; months = Math.max(1, Math.round(months));
    return i > 0 ? bal * i / (1 - Math.pow(1 + i, -months)) : bal / months;
  }
  function run(bal, i, p, max) {        // month by month until it's paid: months and the interest paid
    var n = 0, paid = 0, year = 0;
    while (bal > 0.5 && n < (max || 1200)) { var r = bal * i; if (n < 12) year += r; paid += r; bal = bal + r - p; n++; }
    return { months: n, interest: paid, year: year, done: bal <= 0.5 };
  }
  function label(n, now) {
    var d = new Date(now.getFullYear(), now.getMonth() + n, 1), y = Math.floor(n / 12), m = n % 12;
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) + ' (in ' + (y ? y + ' yr' + (y === 1 ? '' : 's') + (m ? ' ' : '') : '') + (m || !y ? m + ' mo' : '') + ')';
  }
  /* where the loan is now, from the balance you entered and the payments since */
  function balanceNow(l, now) {
    now = now || new Date();
    var bal = +l.balance || 0, i = (+l.rate || 0) / 1200, p = +l.pay || 0;
    if (!l.asOf || !(p > 0)) return bal;
    var a = new Date(l.asOf + 'T12:00'), m = (now.getFullYear() - a.getFullYear()) * 12 + now.getMonth() - a.getMonth();
    if (l.day && now.getDate() < +l.day) m--;
    for (var k = 0; k < m && bal > 0; k++) bal = bal * (1 + i) - p;
    return Math.max(0, bal);
  }
  function calc(l, extra, now) {
    now = now || new Date();
    var bal = balanceNow(l, now), i = (+l.rate || 0) / 1200, p = (+l.pay || 0) + (+extra || 0);
    if (!(bal > 0) || !(p > 0)) return null;
    var interest = bal * i, principal = p - interest;
    if (principal <= 0) return { balance: bal, never: true, interest: interest };
    var r = run(bal, i, p);
    return { balance: bal, interest: interest, principal: principal, months: r.months, interestLeft: r.interest, yearInterest: r.year,
      taxBack: r.year * TAX, end: new Date(now.getFullYear(), now.getMonth() + r.months, 1), endLabel: label(r.months, now), never: false };
  }
  return { payment: payment, calc: calc, balanceNow: balanceNow, label: label, TAX: TAX };
})();

/* Your bank accounts (Finances → Plan → Accounts) and the payday plan worked out from them.
   The first three always exist (ids salary / credit / card – older data uses these ids); you can add more
   (another card, a savings or bills account, a shared account) – d.budget.acctList = [{ id, kind, name, due?, buffer? }].
   kind: salary (salary lands here and is spread out) · credit (credit card – a bill each month) ·
         card (an account with a card that pays some bills) · savings (money you move away and keep). */
window.Accts = (function () {
  "use strict";
  var KINDS = {
    salary: { name: 'Salary account', icon: 'cash-stack', c: '#8a6fdf' },
    credit: { name: 'Credit card', icon: 'credit-card', c: '#d95926' },
    card: { name: 'Card account', icon: 'credit-card-2-front', c: '#3987e5' },
    savings: { name: 'Savings account', icon: 'piggy-bank', c: '#22b35e' }
  };
  var EXTRA_C = ['#0891b2', '#c98500', '#d55181', '#6b6d73', '#11a597'];
  function list(d) {
    var b = (d && d.budget) || {}, names = b.accts || {}, own = Array.isArray(b.acctList) ? b.acctList : [];
    var base = ['salary', 'credit', 'card'].map(function (id) {
      var o = own.filter(function (a) { return a.id === id; })[0] || {};
      return { id: id, kind: id, name: o.name || names[id] || '', due: o.due || (id === 'credit' ? b.ccDue : null) || null, buffer: id === 'card' ? (o.buffer != null ? +o.buffer : +b.cardBuffer || 0) : +o.buffer || 0, builtin: true };
    });
    var more = own.filter(function (a) { return a && a.id && ['salary', 'credit', 'card'].indexOf(a.id) < 0; }).map(function (a, i) {
      return { id: a.id, kind: KINDS[a.kind] ? a.kind : 'card', name: a.name || '', due: a.due || null, buffer: +a.buffer || 0, extra: true, ci: i };
    });
    return base.concat(more).map(function (a) {
      var k = KINDS[a.kind];
      a.label = a.name || (a.extra ? k.name + ' ' + (a.ci + 2) : k.name);
      a.icon = k.icon; a.c = a.extra ? EXTRA_C[a.ci % EXTRA_C.length] : k.c;
      return a;
    });
  }
  function get(d, id) { return list(d).filter(function (a) { return a.id === id; })[0] || null; }
  function kind(d, id) { var a = get(d, id); return a ? a.kind : null; }
  return { KINDS: KINDS, list: list, get: get, kind: kind };
})();

/* The payday plan: where this period's income goes, account by account, and what to move on payday.
   Moves are ticked off per budget period in d.budget.payDone[<period start>] = { <move id>: true }. */
window.Budget.payPlan = function (d, now) {
  "use strict";
  var B = window.Budget, A = window.Accts, per = B.period(d, now), fixed = (d.budget && d.budget.fixed) || [], list = A.list(d);
  var ids = {}; list.forEach(function (a) { ids[a.id] = a; });
  var main = list.filter(function (a) { return a.kind === 'salary'; })[0];
  var by = {}, save = 0, yearly = 0, loans = 0;
  list.forEach(function (a) { by[a.id] = 0; });
  fixed.forEach(function (f) {
    var v = +f.amount || 0;
    if (f.src === 'save') { save += v; return; }
    if (f.src === 'year') { yearly += v; return; }
    if (f.src === 'loan') loans += v;
    var id = ids[f.acct] ? f.acct : main.id; by[id] += v;
  });
  var fixedAll = fixed.reduce(function (a, f) { return a + (+f.amount || 0); }, 0);
  var spent = B.spent(d, per), room = per.income - fixedAll, left = room - spent;
  var perAcct = { hand: 0 }; list.forEach(function (a) { perAcct[a.id] = 0; });
  ((d && d.expenses) || []).forEach(function (e) { if (per.has(e.date)) perAcct[e.acct && perAcct[e.acct] != null ? e.acct : 'hand'] += +e.amount || 0; });
  var daily = ids[d.budget && d.budget.daily] ? d.budget.daily : 'credit';
  var saveTo = ids[d.budget && d.budget.saveAcct] ? ids[d.budget.saveAcct] : list.filter(function (a) { return a.kind === 'savings'; })[0] || null;
  /* moves on payday: to every account that pays bills (not the credit card – that's a bill of its own), to savings */
  var moves = [], buffers = 0;
  list.forEach(function (a) {
    if (a.kind === 'salary' || a.kind === 'credit') return;
    var amt = by[a.id] + (a.buffer || 0) + (saveTo && saveTo.id === a.id ? save + yearly : 0);
    buffers += a.buffer || 0;
    if (amt > 0) moves.push({ id: 'to:' + a.id, to: a.id, label: 'Move to ' + a.label, amount: amt, sub: [by[a.id] ? 'bills ' + Math.round(by[a.id]) + ' kr' : '', a.buffer ? 'buffer ' + Math.round(a.buffer) + ' kr' : '', saveTo && saveTo.id === a.id && save + yearly ? 'savings ' + Math.round(save + yearly) + ' kr' : ''].filter(Boolean).join(' + ') });
  });
  if (!saveTo) {
    if (save > 0) moves.push({ id: 'save', label: 'Move to savings', amount: save, sub: 'your savings goals' });
    if (yearly > 0) moves.push({ id: 'year', label: 'Put aside for yearly costs', amount: yearly, sub: 'insurance and the like' });
  }
  var done = ((d.budget && d.budget.payDone) || {})[per.startKey] || {};
  moves.forEach(function (m) { m.done = !!done[m.id]; });
  return { per: per, list: list, main: main, by: by, save: save, yearly: yearly, loans: loans, fixed: fixedAll, room: room, spent: spent, left: left,
    buffers: buffers, daily: daily, saveTo: saveTo, perAcct: perAcct, moves: moves, open: moves.filter(function (m) { return !m.done; }),
    perDay: left > 0 ? left / Math.max(1, per.daysLeft) : 0 };
};

/* Credit card bills: what's due this month on each credit card – last month's purchases on it (from
   imports) + the fixed costs it pays – the due day, and whether you've marked it paid in full
   (d.budget.ccPaid[<acct>:<YYYY-MM>] = true; an import of the payment from another account sets it too). */
window.Budget.cardBills = function (d, now) {
  "use strict";
  now = now || new Date();
  var A = window.Accts, pad = function (n) { return String(n).padStart(2, '0'); };
  var ymk = now.getFullYear() + '-' + pad(now.getMonth() + 1), prev = new Date(now.getFullYear(), now.getMonth() - 1, 1), pk = prev.getFullYear() + '-' + pad(prev.getMonth() + 1);
  var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return A.list(d).filter(function (a) { return a.kind === 'credit'; }).map(function (a) {
    var buys = ((d && d.expenses) || []).filter(function (e) { return e.acct === a.id && String(e.date).slice(0, 7) === pk; }).reduce(function (s, e) { return s + (+e.amount || 0); }, 0);
    var bills = ((d.budget && d.budget.fixed) || []).filter(function (f) { return f.acct === a.id; }).reduce(function (s, f) { return s + (+f.amount || 0); }, 0);
    var dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), day = a.due ? Math.min(+a.due, dim) : null;
    var dt = day ? new Date(now.getFullYear(), now.getMonth(), day) : null, days = dt ? Math.round((dt - t0) / 864e5) : null;
    var paid = !!(((d.budget && d.budget.ccPaid) || {})[a.id + ':' + ymk]);
    var amount = buys + bills;
    return { acct: a, month: ymk, from: pk, buys: buys, bills: bills, amount: amount, due: day, date: dt, days: days, paid: paid,
      interest: amount * 0.22 / 12, known: buys > 0 };
  });
};

/* At a glance: the payday checklist (the first days of a period while moves are open) and credit card bills
   due within 3 days or overdue, not yet marked paid. */
(function () {
  "use strict";
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  window.BriefExtra = window.BriefExtra || [];
  window.BriefExtra.push(function (add) {
    var d = window.Vault && window.Vault.get && window.Vault.get(); if (!d || !d.budget) return;
    if (window.Features && !window.Features.on('finance')) return;
    var fin = /\/cmd\/(?:index\.html)?$/.test(location.pathname) ? 'finance/' : '/cmd/finance/';
    var p = window.Budget.payPlan(d), into = p.per.days - p.per.daysLeft;
    if (p.per.income > 0 && p.open.length && into <= 6)
      add(into <= 1 ? 11 : 19, 'list-check', '#11a597', 'Payday: ' + p.open.length + ' move' + (p.open.length === 1 ? '' : 's') + ' to do',
        p.open.slice(0, 2).map(function (m) { return nf.format(Math.round(m.amount)) + ' → ' + m.label.replace(/^Move to |^Put aside for /, ''); }).join(' · ') + (p.open.length > 2 ? ' …' : ''),
        fin + '#c=flow', { key: 'paymv:' + p.per.startKey + ':' + p.open.length, badge: into <= 1 });
    window.Budget.cardBills(d).forEach(function (c) {
      if (!c.due || c.paid || c.days > 3) return;
      var late = c.days < 0;
      add(late ? 5 : c.days === 0 ? 8 : 16, 'credit-card', late ? '#e66767' : '#c98500',
        c.acct.label + ' bill ' + (late ? 'is ' + (-c.days) + ' day' + (c.days === -1 ? '' : 's') + ' overdue' : c.days === 0 ? 'is due today' : 'due in ' + c.days + ' day' + (c.days === 1 ? '' : 's')),
        (c.amount ? 'About ' + nf.format(Math.round(c.amount)) + ' – ' : '') + 'pay it in full to avoid card interest', fin + '#c=flow', { key: 'cc:' + c.acct.id + ':' + c.month + (late ? ':late' : ''), badge: late || c.days === 0 });
    });
  });
})();
