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
    var table = r.taxCard !== 'pct';          // tabelltrekk (most employees) – prosenttrekk has no tax-free June and no half tax in December
    var ded = (r.deductions || []).map(function (x) {
      var v = x.pct ? gross * (+x.pct || 0) / 100 : +x.amount || 0;
      return { name: x.name, amount: v };
    });
    var extra = ded.reduce(function (a, x) { return a + x.amount; }, 0);
    out.items = ded; out.extra = extra;
    var salary = gross, tax, note = '';
    if (r.payYear && m === 6) {
      /* June: holiday pay (earned last year) is paid, and the salary for the holiday days is held back
         (5 weeks = 25 days ≈ 25/21.67 of a month, 4 weeks + 1 day = 21 days) */
      var weeks = (+r.holidayWeeks || 5) === 4 ? 4 : 5;
      var hol = r.holidayPay != null && r.holidayPay !== '' ? +r.holidayPay || 0 : gross * 12 * (weeks === 4 ? 0.102 : 0.12);
      if (hol > 0) {
        var held = gross / 21.67 * (weeks === 4 ? 21 : 25);
        salary = gross - held;
        /* tabelltrekk: no tax on holiday pay, and the June table takes nothing from the rest; prosenttrekk: the % of everything */
        tax = table ? taxExtra : Math.max(0, (hol + salary + benefits) * pct / 100) + taxExtra;
        out.gross = hol + salary; out.tax = tax; out.net = hol + salary - tax - extra; out.holiday = true;
        out.held = held; out.holPay = hol; out.salaryLeft = salary;
        out.note = table ? 'Holiday pay, no tax' : 'Holiday pay, taxed (percentage card)';
        return out;
      }
      note = 'No holiday pay earned last year – a normal month';
    }
    var base = (salary + benefits) * pct / 100;
    if (r.payYear && m === 12 && table) { base = base / 2; note = 'Half tax in December'; }
    tax = base + taxExtra;
    out.gross = salary; out.tax = tax; out.net = salary - tax - extra; out.note = note; out.baseTax = base; out.extraTax = taxExtra;
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
  /* the main income (the biggest) – a payslip or the salary seen in a bank import replaces its amount for that month */
  function mainIncome(d) { return ((d && d.budget && d.budget.income) || []).slice().sort(function (a, b) { return ordinary(b) - ordinary(a); })[0] || null; }
  /* all incomes for a month */
  function incomeOf(d, key) {
    var src = ((d && d.budget && d.budget.income) || []), main = mainIncome(d);
    var rows = src.map(function (r) { var o = rowFor(r, key); o.main = r === main; return o; });
    var t = { net: 0, gross: 0, tax: 0, extra: 0, rows: rows, note: '', logged: false };
    rows.forEach(function (r) { t.net += r.net; t.gross += r.gross; t.tax += r.tax; t.extra += r.extra; if (r.note && !t.note) t.note = r.note; });
    var s = slip(d, key);
    if (s) {
      var others = rows.filter(function (r) { return !r.main; }).reduce(function (a, r) { return a + r.net; }, 0);   // the other incomes stay
      t.net = (+s.net || 0) + others; t.logged = true;
      rows.forEach(function (r) { if (r.main) { r.planned = r.net; r.net = +s.net || 0; r.note = s.src === 'bank' ? 'From your bank' : 'From your payslip'; } });
      if (s.gross > 0) { t.gross = +s.gross; t.tax = +s.tax || 0; t.extra = Math.max(0, +s.gross - (+s.tax || 0) - +s.net); }
      t.note = s.src === 'bank' ? 'Salary from your bank import' : 'From your payslip';
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
    var out = [], rows = (d && d.budget && d.budget.income) || [], main = mainIncome(d);
    for (var y = from.getFullYear(); y <= to.getFullYear(); y++) {
      for (var m = 1; m <= 12; m++) rows.forEach(function (r) {
        var dt = paydayIn(r, y, m);
        if (!dt || dt < from || dt > to) return;
        var key = y + '-' + pad(m), row = rowFor(r, key), s = r === main ? slip(d, key) : null;
        var net = s ? +s.net : row.net;            // the real amount for that month, when you have it
        out.push({ date: dt, row: row, src: r, title: row.holiday ? 'Holiday pay' : 'Payday' + (rows.length > 1 ? ' · ' + r.name : ''), net: net, real: !!s });
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
  /* a fixed cost whose amount changes from month to month (power, phone bill …): f.vary = true,
     f.months = { 'YYYY-MM': kr } (what it was / will be – typed in or seen in a bank import), f.usual = the normal amount.
     The amount for a month: that month's own amount, else the usual one, else the average of the last three known months.
     f.amount always holds this month's amount (Links.syncVary), so everything that adds up fixed costs just works. */
  function fixedAmt(f, k) {
    if (!f) return 0;
    if (!f.vary && !f.split) return +f.amount || 0;
    return fixedWhole(f, k) * splitPart(f);
  }
  /* a bill you share with someone (running costs of a joint home): f.split = { pid, pct (your %), payer: 'me' | pid | 'each',
     from: 'YYYY-MM' }, f.full = the whole bill (when it doesn't vary). f.amount is your part, so budgets count only that. */
  function splitPart(f) { var p = f && f.split ? +f.split.pct : 100; return p > 0 && p < 100 ? p / 100 : f && f.split && p === 0 ? 0 : 1; }
  function fixedWhole(f, k) {
    if (!f) return 0;
    if (!f.vary) return f.split && f.full != null ? +f.full || 0 : +f.amount || 0;
    k = k || ym(new Date());
    var m = f.months || {};
    if (m[k] != null && m[k] !== '' && isFinite(+m[k])) return +m[k];
    if (+f.usual > 0) return +f.usual;
    var avg = varyAvg(f, k);
    return avg != null ? avg : f.split && f.full != null ? +f.full : +f.amount || 0;
  }
  function varyAvg(f, k) {     /* the average of the last three months with an amount, before month k (or any if none before) */
    var m = f.months || {}, keys = Object.keys(m).filter(function (x) { return /^\d{4}-\d{2}$/.test(x) && isFinite(+m[x]) && m[x] !== '' && m[x] != null; }).sort();
    var before = keys.filter(function (x) { return !k || x < k; }), use = (before.length ? before : keys).slice(-3);
    if (!use.length) return null;
    return Math.round(use.reduce(function (a, x) { return a + (+m[x]); }, 0) / use.length);
  }

  /* a bill with a first and a last month (f.from / f.until, 'YYYY-MM'): rent that stops when you move, a contract that ends.
     Bills outside their months wait in d.budget.later or rest in d.budget.ended (Links.syncDates), so nothing adds them up. */
  function activeIn(f, k) { return !!f && (!f.from || f.from <= k) && (!f.until || f.until >= k); }
  return { activeIn: activeIn, fixedAmt: fixedAmt, fixedWhole: fixedWhole, splitPart: splitPart, varyAvg: varyAvg, mainIncome: mainIncome, saveMonthly: saveMonthly, saveForecast: saveForecast, period: period, spent: spent, pace: pace, slip: slip, yearSoFar: yearSoFar, rowFor: rowFor, ordinary: ordinary, incomeOf: incomeOf, income: income, paydays: paydays, nextPayday: nextPayday, hasPayday: hasPayday, ym: ym };
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
  function run(bal, i, p, max, payAt) {        // month by month until it's paid: months and the interest paid (payAt(n, bal, r) = that month's payment, when months differ)
    var n = 0, paid = 0, year = 0;
    while (bal > 0.5 && n < (max || 1200)) { var r = bal * i, pp = payAt ? payAt(n, bal, r) : p; if (n < 12) year += r; paid += r; bal = bal + r - pp; n++; }
    return { months: n, interest: paid, year: year, done: bal <= 0.5 };
  }
  /* months that are different (l.payRules = [{ m: 1–12, mode: 'interest' | 'amount', amount }]): December interest only
     (avdragsfri), or a set amount for the whole loan that month – every year */
  function rule(l, d) { var m = d.getMonth() + 1, r = (Array.isArray(l && l.payRules) ? l.payRules : []).filter(function (x) { return x && +x.m === m && (x.mode === 'interest' || +x.amount > 0); })[0]; return r || null; }
  function rulePay(r, normal, interest) { return !r ? normal : r.mode === 'interest' ? interest : Math.max(interest, Math.min(+r.amount, normal * 3)); }
  function payDay(l, a, k) { var day = +l.day || a.getDate(), d = new Date(a.getFullYear(), a.getMonth() + k, 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return d; }
  function dkey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function extras(l) { return (Array.isArray(l && l.extra) ? l.extra : []).filter(function (e) { return e && +e.amount > 0 && e.date; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }
  /* a loan with one payment: from the balance on l.asOf, every payment since (with the months that differ and extra payments) */
  function walk(l, now) {
    var bal = +l.balance || 0, i = (+l.rate || 0) / 1200, p = +l.pay || 0, out = { bal: bal, interest: 0, m: 0, extra: 0 };
    if (!l.asOf || !(p > 0)) return out;
    var a = new Date(l.asOf + 'T12:00'), m = (now.getFullYear() - a.getFullYear()) * 12 + now.getMonth() - a.getMonth();
    if (l.day && now.getDate() < +l.day) m--;
    var ex = extras(l), xi = 0, key = function (d) { while (xi < ex.length && ex[xi].date <= dkey(d)) { if (ex[xi].date > l.asOf) { bal = Math.max(0, bal - (+ex[xi].amount)); out.extra += +ex[xi].amount; } xi++; } };
    for (var k = 1; k <= m && bal > 0; k++) { var d = payDay(l, a, k); key(d); var r = bal * i; out.interest += r; bal = bal + r - rulePay(rule(l, d), p, r); }
    key(now);
    out.bal = Math.max(0, bal); out.m = Math.max(0, m); return out;
  }
  function label(n, now) {
    var d = new Date(now.getFullYear(), now.getMonth() + n, 1), y = Math.floor(n / 12), m = n % 12;
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) + ' (in ' + (y ? y + ' yr' + (y === 1 ? '' : 's') + (m ? ' ' : '') : '') + (m || !y ? m + ' mo' : '') + ')';
  }
  /* where the loan is now, from the balance you entered and the payments since */
  function balanceNow(l, now) {
    now = now || new Date();
    if (l && l.inner) { var q = inner(l, now); return q ? q.me.bal + q.them.bal : +l.balance || 0; }
    return walk(l, now).bal;
  }
  function calc(l, extra, now) {
    now = now || new Date();
    var q = l && l.inner ? inner(l, now) : null;
    var bal = balanceNow(l, now), i = (+l.rate || 0) / 1200, p = (q ? q.me.pay + q.them.pay : +l.pay || 0) + (+extra || 0);
    if (!(bal > 0) || !(p > 0)) return null;
    var interest = bal * i, principal = p - interest;
    if (principal <= 0) return { balance: bal, never: true, interest: interest };
    /* the months ahead, with the months that differ (no extra payments assumed) */
    var nx = new Date(now.getFullYear(), now.getMonth() + (l.day && now.getDate() >= +l.day ? 1 : 0), 1);
    var r = run(bal, i, p, 1200, (l.payRules || []).length ? function (n, b, ri) { return rulePay(rule(l, new Date(nx.getFullYear(), nx.getMonth() + n, 1)), p, ri); } : null);
    return { balance: bal, interest: interest, principal: principal, months: r.months, interestLeft: r.interest, yearInterest: r.year,
      taxBack: r.year * TAX, end: new Date(now.getFullYear(), now.getMonth() + r.months, 1), endLabel: label(r.months, now), never: false };
  }
  /* a loan you share (with a partner): l.share = your part in %, l.with = who has the rest.
     The bank sees one loan; your budget, net worth and tax deduction see your part. */
  function part(l) {
    if (l && l.inner) { var q = inner(l); return q && q.me.bal + q.them.bal > 0 ? q.me.bal / (q.me.bal + q.them.bal) : 1; }
    var s = +(l && l.share); return s > 0 && s < 100 ? s / 100 : 1;
  }
  /* A mortgage split into two internal parts (samboerkontrakt): l.inner = { mine (your part when the loan started, l.asOf),
     months (the term in months at l.asOf), pid (the other person in Shared expenses) }, l.balance = the whole loan then,
     l.extra = [{ id, date, amount, who: 'me' | 'them' }]. Each part is its own annuity over the same remaining term;
     an extra payment lowers only the payer's part and that person's next instalments (same term). The bank's fee is
     split equally (all of it once the other part is paid). Works out, as of `now`:
     { me: { bal, pay, interest (this month), year (interest in the calendar year), next12 }, them: { … }, left (months), fee: { me, them } } */
  function inner(l, now) {
    if (!l || !l.inner || !l.asOf) return null;
    now = now || new Date();
    var i = (+l.rate || 0) / 1200, n = Math.max(1, Math.round(+l.inner.months || 360)), A = Math.max(0, +l.inner.mine || 0), Bv = Math.max(0, (+l.balance || 0) - A);
    var st = new Date(l.asOf + 'T12:00'), day = +l.day || st.getDate(), yr = now.getFullYear();
    var m = (now.getFullYear() - st.getFullYear()) * 12 + now.getMonth() - st.getMonth(); if (now.getDate() < day) m--; m = Math.max(0, Math.min(n, m));
    var ex = (Array.isArray(l.extra) ? l.extra : []).filter(function (e) { return e && +e.amount > 0 && e.date; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }), xi = 0;
    var P = { me: { bal: A, year: 0, next12: 0, sofar: 0, start: A }, them: { bal: Bv, year: 0, next12: 0, sofar: 0, start: Bv } }, NOW = null;
    function payDate(k) { var d = new Date(st.getFullYear(), st.getMonth() + k, 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return d; }
    function dk(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function extrasTo(key) { while (xi < ex.length && ex[xi].date <= key) { var w = ex[xi].who === 'them' ? P.them : P.me; w.bal = Math.max(0, w.bal - (+ex[xi].amount)); xi++; } }
    function snap() { extrasTo(dk(now)); NOW = { me: P.me.bal, them: P.them.bal }; }
    /* every payment from the start, then on into the future (no extra payments assumed) far enough for
       this calendar year and the next 12 months */
    var horizon = Math.min(n, Math.max(m + 12, (yr - st.getFullYear()) * 12 + 12 - st.getMonth()));
    if (m === 0) snap();
    for (var k = 1; k <= horizon; k++) {
      var d = payDate(k), future = k > m;
      if (!future) extrasTo(dk(d));
      var rl = rule(l, d), nm = P.me.bal > 0.5 ? payment(P.me.bal, l.rate, n - k + 1) : 0, nt = P.them.bal > 0.5 ? payment(P.them.bal, l.rate, n - k + 1) : 0;
      ['me', 'them'].forEach(function (w) {
        var x = P[w]; if (x.bal <= 0.5) { x.bal = 0; return; }
        var r = x.bal * i, pay = payment(x.bal, l.rate, n - k + 1);
        if (rl) pay = rl.mode === 'interest' ? r : Math.max(r, (+rl.amount) * (nm + nt > 0 ? pay / (nm + nt) : .5));
        if (d.getFullYear() === yr) { x.year += r; x.yp = (x.yp || 0) + 1; }
        if (future && k <= m + 12) x.next12 += r;
        if (!future) x.sofar += r;
        x.bal = Math.max(0, x.bal + r - pay);
      });
      if (k === m) snap();
    }
    if (!NOW) snap();
    P.me.bal = NOW.me; P.them.bal = NOW.them;
    var left = n - m, fee = +l.fee || 0, meOn = P.me.bal > 0.5, thOn = P.them.bal > 0.5;
    var feeMe = meOn && thOn ? fee / 2 : meOn ? fee : 0, feeThem = meOn && thOn ? fee / 2 : thOn ? fee : 0;
    function out(x) { return { bal: x.bal, pay: x.bal > 0.5 ? payment(x.bal, l.rate, left) : 0, interest: x.bal * i, year: x.year, yearPays: x.yp || 0, next12: x.next12, start: x.start, paidOff: Math.max(0, x.start - x.bal), interestSoFar: x.sofar }; }
    return { me: out(P.me), them: out(P.them), left: left, fee: { me: feeMe, them: feeThem }, paidMonths: m };
  }
  /* your tax deduction on a loan over the next 12 months (rentefradrag, 22 %): your own internal part's interest and your
     share of the fees, or your % of the whole loan's */
  function myTaxBack(l) {
    if (l && l.inner) { var q = inner(l); return q ? (q.me.next12 + q.fee.me * 12) * TAX : 0; }
    var c = calc(l); return c && !c.never ? c.taxBack * part(l) : 0;
  }
  /* the payment in a given month (a month that differs, or the usual one): { total, me, them, fee, rule } – whole loan, your part, theirs */
  function monthPay(l, when) {
    when = when || new Date();
    var r = rule(l, when);
    if (l && l.inner) {
      var q = inner(l, when); if (!q) return { total: 0, me: 0, them: 0, fee: 0, rule: r };
      var nm = q.me.pay, nt = q.them.pay, me = nm, th = nt;
      if (r) { if (r.mode === 'interest') { me = q.me.interest; th = q.them.interest; } else { var t = +r.amount; me = nm + nt > 0 ? t * nm / (nm + nt) : t / 2; th = t - me; } }
      return { total: me + th, me: me + q.fee.me, them: th + q.fee.them, fee: q.fee.me + q.fee.them, rule: r };
    }
    var p = +l.pay || 0, i = (+l.rate || 0) / 1200, pay = rulePay(r, p, owedNow(l, when) * i), fee = +l.fee || 0, pt = part(l);
    return { total: pay, me: (pay + fee) * pt, them: (pay + fee) * (1 - pt), fee: fee, rule: r };
  }
  /* what you pay each month on it: your instalment (+ your part of the fee) – this month's, when the month differs */
  function myPay(l, when) {
    if (l && (l.payRules || []).length) return monthPay(l, when).me;
    if (l && l.inner) { var q = inner(l); return q ? q.me.pay + q.fee.me : 0; }
    return ((+l.pay || 0) + (+l.fee || 0)) * part(l);
  }
  /* what's already paid: of the loan (the amount borrowed at the start – l.orig, or the balance on l.asOf) and the
     interest since l.asOf. Two internal parts: per part, from the start of the loan. */
  function paid(l, now) {
    if (!l) return null;
    now = now || new Date();
    if (l.inner) { var q = inner(l, now); if (!q) return null; return { start: q.me.start + q.them.start, owed: q.me.bal + q.them.bal, principal: q.me.paidOff + q.them.paidOff, interest: q.me.interestSoFar + q.them.interestSoFar, payments: q.paidMonths, since: l.asOf, me: q.me, them: q.them }; }
    var owed = owedNow(l, now), start = +l.orig > 0 ? Math.max(+l.orig, owed) : +l.balance || 0, w = walk(l, now);
    return { start: start, owed: owed, principal: Math.max(0, start - owed), interest: w.interest, payments: w.m, extra: w.extra, since: l.asOf, fromOrig: +l.orig > 0 };
  }
  function shared(l) { return !!(l && l.inner) || part(l) < 1; }
  /* what's owed on a debt today: worked out from the payments when it has them, else the balance you typed */
  function owedNow(l, now) { return l && +l.pay > 0 && l.asOf ? balanceNow(l, now) : +(l && l.balance) || 0; }
  return { payment: payment, calc: calc, balanceNow: balanceNow, owedNow: owedNow, label: label, TAX: TAX, part: part, shared: shared, inner: inner, myTaxBack: myTaxBack, myPay: myPay, paid: paid, monthPay: monthPay, rule: rule };
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
    savings: { name: 'Savings account', icon: 'piggy-bank', c: '#22b35e' },
    fund: { name: 'Fund account', icon: 'graph-up-arrow', c: '#0891b2' }
  };
  var EXTRA_C = ['#0891b2', '#c98500', '#d55181', '#6b6d73', '#11a597'];
  function list(d) {
    var b = (d && d.budget) || {}, names = b.accts || {}, own = Array.isArray(b.acctList) ? b.acctList : [];
    /* the three you start with can be renamed, given another type or removed (o.off) like any other */
    var base = ['salary', 'credit', 'card'].map(function (id) {
      var o = own.filter(function (a) { return a.id === id; })[0] || {};
      if (o.off) return null;
      return { id: id, kind: KINDS[o.kind] ? o.kind : id, name: o.name || names[id] || '', due: o.due || (id === 'credit' ? b.ccDue : null) || null, buffer: id === 'card' ? (o.buffer != null ? +o.buffer : +b.cardBuffer || 0) : +o.buffer || 0, builtin: true,
        bal: o.bal != null && o.bal !== '' ? +o.bal : null, balAt: o.balAt || null, balSrc: o.balSrc || null, limit: +o.limit || 0, nw: o.nw !== false };
    }).filter(Boolean);
    var more = own.filter(function (a) { return a && a.id && !a.off && ['salary', 'credit', 'card'].indexOf(a.id) < 0; }).map(function (a, i) {
      return { id: a.id, kind: KINDS[a.kind] ? a.kind : 'card', name: a.name || '', due: a.due || null, buffer: +a.buffer || 0, extra: true, ci: i,
        bal: a.bal != null && a.bal !== '' ? +a.bal : null, balAt: a.balAt || null, balSrc: a.balSrc || null, limit: +a.limit || 0, nw: a.nw !== false };
    });
    var all = base.concat(more);
    if (!all.some(function (a) { return a.kind === 'salary'; })) all.unshift({ id: 'salary', kind: 'salary', name: names.salary || '', builtin: true, buffer: 0 });   // the salary has to land somewhere
    var seen = {};
    return all.map(function (a) {
      var k = KINDS[a.kind], n = seen[a.kind] = (seen[a.kind] || 0) + 1;
      a.label = a.name || (n > 1 ? k.name + ' ' + n : k.name);
      a.icon = k.icon; a.c = a.extra ? EXTRA_C[a.ci % EXTRA_C.length] : k.c;
      return a;
    });
  }
  function get(d, id) { return list(d).filter(function (a) { return a.id === id; })[0] || null; }
  /* what's in the accounts right now (the balances you typed in, moved on by imports):
     cash = salary + card accounts (money you can use), owed = credit cards, saved = savings + funds */
  function money(d) {
    var out = { cash: 0, owed: 0, saved: 0, limit: 0, known: false, cashKnown: false, oldest: null, worth: 0, counted: 0, missing: [], left: [] };
    list(d).forEach(function (a) {
      if (a.limit && a.kind === 'credit') out.limit += a.limit;
      if (a.bal == null) { if (a.nw) out.missing.push(a); return; }
      /* net worth: the accounts you've said count (all of them unless you switched one off) */
      if (a.nw) { out.worth += a.kind === 'credit' ? -Math.max(0, a.bal) : a.bal; out.counted++; } else out.left.push(a);
      out.known = true;
      if (!out.oldest || (a.balAt && a.balAt < out.oldest)) out.oldest = a.balAt;
      if (a.kind === 'credit') out.owed += Math.max(0, a.bal);
      else if (a.kind === 'savings' || a.kind === 'fund') out.saved += a.bal;
      else { out.cash += a.bal; out.cashKnown = true; }
    });
    out.net = out.worth;
    return out;
  }
  /* the accounts you have, the first time: salary, credit card, bills account, savings, fund, a second credit card */
  var STARTER = [
    { id: 'salary', kind: 'salary', name: 'Lønnskonto' }, { id: 'credit', kind: 'credit', name: 'Kredittkort' }, { id: 'card', kind: 'card', name: 'Regningskonto' },
    { id: 'acsav', kind: 'savings', name: 'Sparekonto' }, { id: 'acfund', kind: 'fund', name: 'Fondskonto' }, { id: 'acbn', kind: 'credit', name: 'Bank Norwegian' }
  ];
  function kind(d, id) { var a = get(d, id); return a ? a.kind : null; }
  return { KINDS: KINDS, list: list, get: get, kind: kind, money: money, STARTER: STARTER };
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
    if (f.src === 'loan' || /\blån|lån\b|\bloan|boliglån|billån|studielån|lånekassen/i.test(f.name || '')) loans += v;
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
  /* each savings goal is its own move, to the account it goes to (the goal's own, else "Savings and yearly costs go to") */
  var goals = fixed.filter(function (f) { return f.src === 'save' && +f.amount > 0; }).map(function (f) {
    var to = ids[f.to] || saveTo || null, g = ((d && d.savings) || []).filter(function (x) { return x.id === f.goal || 'save-' + x.id === f.id; })[0];
    return { id: 'sv:' + (f.goal || f.id), goal: g ? g.id : null, to: to ? to.id : null, label: (to ? 'Move to ' + to.label : 'Move to savings') + ' · ' + String(f.name || '').replace(/^Savings: /, ''), amount: +f.amount, sub: 'savings goal' + (g && g.target ? ' · ' + Math.round(g.saved || 0).toLocaleString('nb-NO') + ' of ' + Math.round(g.target).toLocaleString('nb-NO') + ' kr' : ''), kind: 'save' };
  });
  list.forEach(function (a) {
    if (a.kind === 'salary' || a.kind === 'credit') return;
    var amt = by[a.id] + (a.buffer || 0) + (saveTo && saveTo.id === a.id ? yearly : 0);
    buffers += a.buffer || 0;
    if (amt > 0) moves.push({ id: 'to:' + a.id, to: a.id, label: 'Move to ' + a.label, amount: amt, sub: [by[a.id] ? 'bills ' + Math.round(by[a.id]) + ' kr' : '', a.buffer ? 'buffer ' + Math.round(a.buffer) + ' kr' : '', saveTo && saveTo.id === a.id && yearly ? 'yearly costs ' + Math.round(yearly) + ' kr' : ''].filter(Boolean).join(' + ') });
  });
  moves = moves.concat(goals);
  if (!saveTo && yearly > 0) moves.push({ id: 'year', label: 'Put aside for yearly costs', amount: yearly, sub: 'insurance and the like' });
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
    var owedNow = a.bal != null, amount = owedNow ? Math.max(0, a.bal) : buys + bills;      // what you said you owe beats the estimate
    return { acct: a, month: ymk, from: pk, buys: buys, bills: bills, amount: amount, due: day, date: dt, days: days, paid: paid, owedNow: owedNow,
      interest: amount * 0.22 / 12, known: owedNow || buys > 0, limit: a.limit || 0 };
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

/* The budget, checked against your accounts: what you can actually use until payday.
   free = money in the salary and card accounts − what you owe on credit cards − bills still due before payday
          (paid from those accounts; card-paid bills land on the card) − savings moves not done yet. */
window.Budget.real = function (d, now) {
  "use strict";
  now = now || new Date();
  var A = window.Accts, B = window.Budget, m = A.money(d);
  if (!m.cashKnown) return null;
  var p = B.payPlan(d, now), per = p.per, list = A.list(d), ids = {}; list.forEach(function (a) { ids[a.id] = a; });
  var pad = function (n) { return String(n).padStart(2, '0'); }, t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var due = [], seen = {};
  /* each fixed cost with a due day, from today up to the end of the period, not ticked as paid */
  for (var dt = new Date(t0); dt <= per.end; dt.setDate(dt.getDate() + 1)) {
    var ymk = dt.getFullYear() + '-' + pad(dt.getMonth() + 1), dim = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate(), paid = (d.paid && d.paid[ymk]) || [];
    ((d.budget && d.budget.fixed) || []).forEach(function (f) {
      if (!f.day || f.src === 'save' || f.src === 'year' || paid.indexOf(f.id) > -1) return;
      if (Math.min(+f.day, dim) !== dt.getDate() || seen[f.id + ymk]) return;
      var a = ids[f.acct] || p.main;
      if (a.kind === 'credit') return;                                       // goes on the card – already counted when you pay the card
      if (f.src === 'sub' && dt <= t0) return;
      seen[f.id + ymk] = 1; due.push({ name: f.name, amount: +f.amount || 0, date: new Date(dt) });
    });
  }
  var bills = due.reduce(function (s, x) { return s + x.amount; }, 0);
  var saveLeft = p.moves.filter(function (mv) { return !mv.done && (mv.kind === 'save' || mv.id === 'year' || (mv.to && ids[mv.to] && (ids[mv.to].kind === 'savings' || ids[mv.to].kind === 'fund'))); })
    .reduce(function (s, mv) { return s + mv.amount; }, 0);
  var free = m.cash - m.owed - bills - saveLeft;
  return { cash: m.cash, owed: m.owed, bills: bills, billList: due, saveLeft: saveLeft, free: free, perDay: free > 0 ? free / Math.max(1, per.daysLeft) : 0,
    per: per, oldest: m.oldest, money: m };
};

/* things bought in parts (delbetaling – a loan with a.plan) show in the calendar on each due day until they're paid off */
(function () {
  "use strict";
  if (!window.Vault) return;
  (window.EventsExtra = window.EventsExtra || []).push(function () {
    var d = window.Vault.get(), L = window.Loans, out = []; if (!d || !L) return out;
    (d.accounts || []).forEach(function (a) {
      if (!a || a.kind !== 'debt' || !a.plan || !(+a.pay > 0) || !a.asOf) return;
      var c = L.calc(a); if (!c || c.never) return;
      var st = new Date(a.asOf + 'T12:00'), day = +a.day || st.getDate(), now = new Date(), part = L.part(a);
      var first = new Date(now.getFullYear(), now.getMonth(), Math.min(day, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()));
      var firstPay = new Date(st.getFullYear(), st.getMonth() + 1, Math.min(day, new Date(st.getFullYear(), st.getMonth() + 2, 0).getDate()));
      if (first < new Date(now.getFullYear(), now.getMonth(), now.getDate())) first = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(day, new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()));   /* this month's is behind us */
      if (first < firstPay) first = firstPay;
      var amt = Math.round((+a.pay) + (+a.fee || 0));
      out.push({ id: 'rem:plan:' + a.id, title: 'Pay: ' + (a.name || 'part payment') + ' · ' + amt.toLocaleString('nb-NO') + ' kr' + (part < 1 ? ' (your part ' + Math.round(amt * part).toLocaleString('nb-NO') + ' kr)' : ''),
        allDay: true, start: first, days: 1, color: '#a0673a', readOnly: true, reminder: true, link: '/cmd/house/#hshared', location: '',
        notes: 'Bought in parts – ' + c.months + ' payment' + (c.months === 1 ? '' : 's') + ' left', exDays: {},
        rule: { freq: 'MONTHLY', interval: 1, clamp: true, count: c.months } });
    });
    return out;
  });
})();

/* Norges Bank's policy rate (styringsrenten), for loans with a floating rate that follows it (l.float).
   From the Worker (/cmd/api/rate, Norges Bank's open data), or straight from Norges Bank if the browser may, kept 12 hours
   in localStorage dash.policy; until then the last known decision built in below. */
window.Policy = (function () {
  "use strict";
  var SEED = { now: 4.5, asOf: '2026-11-05', changes: [{ date: '2026-09-25', rate: 4.5 }], source: 'built in (Norges Bank, 5 Nov 2026)' };
  /* Norges Bank's meeting dates (rentemøter) */
  var MEET = ['2026-12-17', '2027-01-21', '2027-03-18', '2027-05-05', '2027-06-17', '2027-08-19', '2027-09-23', '2027-11-04', '2027-12-16'];
  var busy = null, subs = [];
  function cached() { try { var c = JSON.parse(localStorage.getItem('dash.policy')); return c && isFinite(+c.now) ? c : null; } catch (e) { return null; } }
  function data() { var c = cached(); return c || SEED; }
  function fresh() { var c = cached(); return c && c.at && Date.now() - c.at < 12 * 3600e3; }
  function keep(j, src) {
    if (!j || !isFinite(+j.now)) return false;
    var c = { now: +j.now, asOf: j.asOf, changes: (j.changes || []).filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && isFinite(+x.rate); }), source: src, at: Date.now() };
    /* keep the built-in change too, if the feed starts later */
    SEED.changes.forEach(function (x) { if (!c.changes.some(function (y) { return y.date === x.date; }) && (!c.changes.length || x.date < c.changes[0].date)) c.changes.unshift(x); });
    try { localStorage.setItem('dash.policy', JSON.stringify(c)); } catch (e) {}
    return true;
  }
  function parseCsv(txt) {
    var lines = String(txt || '').trim().split(/\r?\n/); if (lines.length < 2) return null;
    var sep = lines[0].split(';').length > lines[0].split(',').length ? ';' : ',';
    var cells = function (l) { return l.split(sep).map(function (c) { return c.replace(/^"|"$/g, '').trim(); }); };
    var head = cells(lines[0]), ti = head.indexOf('TIME_PERIOD'), vi = head.indexOf('OBS_VALUE'); if (ti < 0 || vi < 0) return null;
    var rows = lines.slice(1).map(cells).map(function (c) { return { date: c[ti], rate: Math.round(parseFloat(String(c[vi]).replace(',', '.')) * 1000) / 1000 }; }).filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x.date) && isFinite(x.rate); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (!rows.length) return null;
    var ch = []; rows.forEach(function (x) { if (!ch.length || ch[ch.length - 1].rate !== x.rate) ch.push(x); });
    return { now: rows[rows.length - 1].rate, asOf: rows[rows.length - 1].date, changes: ch.slice(1) };
  }
  /* get the newest; cb() when it's in (whether or not anything changed) */
  function update(cb) {
    if (cb) subs.push(cb);
    if (fresh()) { var s0 = subs; subs = []; s0.forEach(function (f) { try { f(data()); } catch (e) {} }); return; }
    if (busy) return;
    var done = function () { busy = null; var s = subs; subs = []; s.forEach(function (f) { try { f(data()); } catch (e) {} }); };
    busy = fetch('/cmd/api/rate', { headers: { 'X-Diag-Probe': '1' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && keep(j, 'Norges Bank')) return;
      var from = new Date(Date.now() - 3 * 365 * 864e5).toISOString().slice(0, 10);
      return fetch('https://data.norges-bank.no/api/data/IR/B.KPRA.SD.R?format=csv&locale=en&startPeriod=' + from).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) { var p = parseCsv(t); if (p) keep(p, 'Norges Bank'); });
    }).catch(function () {}).then(done, done);
  }
  function now() { return +data().now; }
  /* the policy rate on a day */
  function at(k) { var r = null, d = data(); (d.changes || []).forEach(function (x) { if (x.date <= k) r = +x.rate; }); return r == null ? +d.now : r; }
  function nextMeeting() { var t = new Date().toISOString().slice(0, 10); return MEET.filter(function (x) { return x >= t; })[0] || null; }
  return { data: data, now: now, at: at, update: update, nextMeeting: nextMeeting, fresh: fresh, MEET: MEET };
})();
