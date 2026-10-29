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
    var byPay = d && d.budget && d.budget.period === 'payday' && hasPayday(d);
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
    return Math.ceil(left / months / 10) * 10;
  }
  function spent(d, per) { return ((d && d.expenses) || []).filter(function (e) { return per.has(e.date); }).reduce(function (a, e) { return a + (+e.amount || 0); }, 0); }

  return { saveMonthly: saveMonthly, period: period, spent: spent, pace: pace, slip: slip, yearSoFar: yearSoFar, rowFor: rowFor, ordinary: ordinary, incomeOf: incomeOf, income: income, paydays: paydays, nextPayday: nextPayday, hasPayday: hasPayday, ym: ym };
})();
