/* Built by cmd/build.py from: budget.js, finance.js, finance/fin.js, finance/import.js, kit.js, tools.js, profile.js, links.js – edit those files, not this one. */
/* ===== budget.js ===== */
try {
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
} catch (e) { console.error("budget.js", e); }
/* ===== finance.js ===== */
try {
/* Finances: budget, spending, savings goals and net worth.
   All numbers live in the encrypted vault (lock.js). Nothing is sent anywhere. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  if (!$('budgetBody')) return;           // the cards live on the Finances page
  var NS = 'http://www.w3.org/2000/svg';

  var CATS = [
    { id: 'groceries', name: 'Groceries', color: '#11a597' },
    { id: 'eating', name: 'Eating out', color: '#d95926' },
    { id: 'transport', name: 'Transport', color: '#3987e5' },
    { id: 'shopping', name: 'Shopping', color: '#c98500' },
    { id: 'fun', name: 'Fun', color: '#d55181' },
    { id: 'health', name: 'Health', color: '#8a6fdf' },
    { id: 'travel', name: 'Travel', color: '#0891b2' },
    { id: 'other', name: 'Other', color: '#6b6d73' }
  ];
  var catById = {};
  CATS.forEach(function (c) { catById[c.id] = c; });

  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  var nfShort = new Intl.NumberFormat('nb-NO', { notation: 'compact', maximumFractionDigits: 1 });
  function kr(n) { return nf.format(Math.round(n || 0)); }
  function money(n, cls) { return '<span class="money' + (cls ? ' ' + cls : '') + '">' + esc(kr(n)) + '</span>'; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* Accepts "12 500", "12500,50", "12.500" style input from a Norwegian keyboard. */
  function num(v) {
    var s = String(v || '').replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ym(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function today() { var d = new Date(); return ym(d) + '-' + pad(d.getDate()); }
  function monthName(key, short) {
    var p = key.split('-');
    return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('en-GB', short ? { month: 'short' } : { month: 'long', year: 'numeric' });
  }
  function shiftMonth(key, by) {
    var p = key.split('-');
    return ym(new Date(+p[0], +p[1] - 1 + by, 1));
  }
  function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
  function sum(list, f) { return list.reduce(function (a, x) { return a + ((f ? f(x) : x.amount) || 0); }, 0); }

  var D = null;            // decrypted data while unlocked
  var viewMonth = ym(new Date());
  var budgetEditing = false;

  function blank() {
    return { budget: { income: [], fixed: [] }, expenses: [], savings: [], accounts: [], history: {} };
  }
  function persist() { window.Vault.save(D); }

  /* ---------- Hide amounts (for when someone looks over your shoulder) ---------- */
  function setHidden(on) {
    document.body.classList.toggle('fin-hidden', on);
    if (!$('finHide')) return;
    $('finHide').innerHTML = '<i class="bi bi-eye' + (on ? '-slash' : '') + '"></i>';
    $('finHide').setAttribute('aria-label', on ? 'Show amounts' : 'Hide amounts');
    try { localStorage.setItem('dash.finHide', on ? '1' : '0'); } catch (e) {}
  }
  if ($('finHide') && !$('finHide').dataset.bound) {
    $('finHide').dataset.bound = '1';
    $('finHide').addEventListener('click', function () { setHidden(!document.body.classList.contains('fin-hidden')); });
    try { setHidden(localStorage.getItem('dash.finHide') === '1'); } catch (e) { setHidden(false); }
  }

  /* ================= Budget ================= */
  function monthSpent(key) {
    return sum(D.expenses.filter(function (e) { return e.date.slice(0, 7) === key; }));
  }

  var B = window.Budget;
  var payEditing = null;             // id of the income being edited (or 'new')

  function renderBudget() {
    var b = D.budget, key = ym(new Date()), per = B.period(D);
    var inc = B.incomeOf(D, key), income = per.income, fixed = sum(b.fixed), spent = B.spent(D, per);
    var left = income - fixed - spent;
    var box = $('budgetBody');

    if (budgetEditing) {
      box.innerHTML = incomeEditor() + budgetEditor('fixed', 'Fixed costs', 'e.g. Rent');
      $('budgetEdit').textContent = 'Done';
      var f = box.querySelector('.pay-form input[name="n"]');
      if (f && payEditing === 'new' && !f.value) f.focus();
      return;
    }
    $('budgetEdit').textContent = income || fixed ? 'Edit' : 'Set up';

    if (!income && !fixed) {
      box.innerHTML = '<p class="empty">Add your salary – net, or gross with tax and deductions – and your fixed costs (rent, loans, subscriptions). Spending you log below is counted automatically.</p>';
      return;
    }
    var base = Math.max(income, fixed + spent, 1);
    var w = function (v) { return Math.max(0, v / base * 100).toFixed(2) + '%'; };
    var next = B.nextPayday(D), now = new Date(), dim = daysInMonth(now);
    var until = per.byPayday ? per.daysLeft : next && next.days > 0 && next.days <= dim ? next.days : dim - now.getDate() + 1;
    var perDay = left > 0 ? left / until : 0;
    var payLine = next
      ? '<p class="pay-next"><i class="bi bi-cash-stack"></i>' + (next.days === 0 ? '<b>' + esc(next.title) + ' today</b>' : '<b>' + esc(next.title) + '</b> ' +
          next.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · in ' + next.days + ' day' + (next.days === 1 ? '' : 's')) +
          (next.net ? ' · ' + money(next.net) : '') + '</p>'
      : '';
    box.innerHTML =
      '<div class="big-num ' + (left < 0 ? 'neg' : '') + '">' + money(left) + '</div>' +
      '<div class="muted">' + (left < 0 ? 'over budget' : 'left ' + per.label) + ' · of ' + money(per.salary) + ' net income' + (per.extra ? ' + ' + money(per.extra) + ' in' : '') + (per.byPayday ? ' · ' + esc(per.name) : '') +
        (left > 0 ? ' · ' + money(perDay) + '/day' + (per.byPayday || (next && until === next.days) ? ' until payday' : '') : '') +
        (inc.note ? ' · ' + esc(inc.note) : '') + '</div>' +
      '<div class="stack" role="img" aria-label="Fixed ' + esc(kr(fixed)) + ', spent ' + esc(kr(spent)) + ', left ' + esc(kr(left)) + '">' +
        '<span class="s-fixed" style="width:' + w(fixed) + '"></span>' +
        '<span class="s-spent" style="width:' + w(spent) + '"></span>' +
        '<span class="s-left" style="width:' + w(Math.max(left, 0)) + '"></span>' +
      '</div>' +
      '<ul class="legend">' +
        (inc.gross ? '<li><i class="dot" style="background:#8a6fdf"></i>Gross salary<b>' + money(inc.gross) + '</b></li>' +
          '<li><i class="dot" style="background:#6b6d73"></i>Tax' + (inc.extra ? ' and deductions' : '') + '<b>' + money(inc.tax + inc.extra) + '</b></li>' : '') +
        (per.extra ? '<li><i class="dot" style="background:#22b35e"></i>Money in (refunds, Vipps)<b>+' + money(per.extra) + '</b></li>' : '') +
        '<li><i class="dot" style="background:#3987e5"></i>Fixed costs<b>' + money(fixed) + '</b></li>' +
        '<li><i class="dot" style="background:#d95926"></i>Spent ' + (per.byPayday ? 'since payday' : 'in ' + esc(monthName(key, true))) + '<b>' + money(spent) + '</b></li>' +
        '<li><i class="dot" style="background:var(--accent)"></i>Left<b>' + money(left) + '</b></li>' +
      '</ul>' + payLine;
  }

  /* ----- income: each row can be a plain net amount, or a payslip (gross, tax %, deductions, payday) ----- */
  function dayLabel(day) { return !day ? '' : day === 'last' ? 'last day' : 'the ' + day + (day == 1 || day == 21 || day == 31 ? 'st' : day == 2 || day == 22 ? 'nd' : day == 3 || day == 23 ? 'rd' : 'th'); }
  function incomeEditor() {
    var list = D.budget.income, key = ym(new Date());
    var rows = list.map(function (r) {
      if (payEditing === r.id) return payForm(r);
      var row = B.rowFor(r, key), bits = [];
      if (r.gross > 0) bits.push('gross ' + kr(r.gross) + ' − tax ' + kr(row.tax) + (row.extra ? ' − ' + kr(row.extra) : ''));
      if (r.day) bits.push('paid ' + dayLabel(r.day));
      if (row.note) bits.push(row.note.toLowerCase());
      return '<li class="b-row b-pay"><button type="button" class="b-open" data-pedit="' + r.id + '"><span>' + esc(r.name) + '</span>' +
        (bits.length ? '<small class="muted">' + esc(bits.join(' · ')) + '</small>' : '') + '</button>' + money(row.net) +
        '<button class="del" type="button" data-bdel="income:' + r.id + '" aria-label="Remove ' + esc(r.name) + '"><i class="bi bi-x"></i></button></li>';
    }).join('');
    var hasDay = B.hasPayday(D), mode = D.budget.period === 'payday' && hasDay ? 'payday' : 'month';
    return '<div class="b-edit"><h3>Income <span class="muted">' + money(B.income(D, key)) + ' net</span></h3><ul>' + rows + '</ul>' +
      (payEditing === 'new' ? payForm(null) : '<button type="button" class="text-btn b-new" data-pedit="new"><i class="bi bi-plus-lg"></i> Add income</button>') +
      (hasDay ? '<div class="b-period"><span>Budget runs</span><div class="seg"><button type="button" data-period-mode="month" aria-pressed="' + (mode === 'month') + '">Calendar month</button><button type="button" data-period-mode="payday" aria-pressed="' + (mode === 'payday') + '">Payday to payday</button></div></div>' : '') +
      (list.some(function (r) { return r.gross > 0; }) ? slipEditor() : '') + '</div>';
  }
  /* log what each payslip actually said – that month then uses the real numbers, and the year adds up */
  function slipEditor() {
    var ps = D.budget.payslips || {}, keys = Object.keys(ps).sort().reverse();
    var now = new Date(), opts = '';
    for (var i = 0; i < 12; i++) { var k = ym(new Date(now.getFullYear(), now.getMonth() - i, 1)); opts += '<option value="' + k + '"' + (ps[k] ? ' disabled' : '') + '>' + esc(monthName(k, true)) + ' ' + k.slice(2, 4) + (ps[k] ? ' ✓' : '') + '</option>'; }
    var y = B.yearSoFar(D), rows = keys.slice(0, 4).map(function (k) {
      var p = ps[k];
      return '<li class="pay-ded"><span>' + esc(monthName(k)) + '</span><span class="muted">net ' + esc(kr(p.net)) + (p.gross ? ' · gross ' + esc(kr(p.gross)) : '') + (p.tax ? ' · tax ' + esc(kr(p.tax)) : '') + '</span>' +
        '<button type="button" class="del" data-sdel="' + k + '" aria-label="Remove payslip"><i class="bi bi-x"></i></button></li>';
    }).join('');
    return '<div class="b-slips"><p class="pay-sub">Payslips logged' + (y.logged ? ' · this year: net ' + esc(kr(y.net)) + ' · tax ' + esc(kr(y.tax)) : '') + '</p>' +
      (rows ? '<ul class="pay-deds">' + rows + '</ul>' : '<p class="muted b-slip-hint">Type in the net, gross and tax from each payslip. That month then uses the real numbers (bonuses, overtime, a different tax table) and the year adds up correctly.</p>') +
      '<form class="slip-form"><div class="row2"><select name="m" aria-label="Month">' + opts + '</select><input name="net" class="amt" placeholder="Net paid (Netto)" inputmode="decimal" required autocomplete="off"></div>' +
      '<div class="add-row"><input name="g" placeholder="Gross (optional)" inputmode="decimal" autocomplete="off"><input name="t" placeholder="Tax (optional)" inputmode="decimal" autocomplete="off"><button class="pill-btn" type="submit" aria-label="Save payslip"><i class="bi bi-check-lg"></i></button></div></form></div>';
  }
  function payForm(r) {
    var gross = r && r.gross > 0, days = '<option value="">Payday…</option>';
    for (var d = 1; d <= 31; d++) days += '<option value="' + d + '"' + (r && +r.day === d ? ' selected' : '') + '>Paid on the ' + d + '.</option>';
    days += '<option value="last"' + (r && r.day === 'last' ? ' selected' : '') + '>Paid on the last day</option>';
    var ded = (r && r.deductions || []).map(function (x, i) {
      return '<li class="pay-ded"><span>' + esc(x.name) + '</span><span class="muted">' + (x.pct ? esc(x.pct) + ' %' : esc(kr(x.amount))) + '</span>' +
        '<button type="button" class="del" data-ddel="' + i + '" aria-label="Remove ' + esc(x.name) + '"><i class="bi bi-x"></i></button></li>';
    }).join('');
    var taxVal = r && r.taxKr > 0 ? String(Math.round(r.taxKr)) : (r && r.taxPct != null ? r.taxPct + ' %' : '');
    return '<li class="pay-wrap"><form class="pay-form" data-pid="' + (r ? r.id : 'new') + '">' +
      '<div class="add-row"><input name="n" placeholder="e.g. Salary" value="' + esc(r ? r.name : '') + '" required autocomplete="off">' +
        '<select name="mode" class="pay-mode" aria-label="Net or gross"><option value="net"' + (gross ? '' : ' selected') + '>Net (paid out)</option><option value="gross"' + (gross ? ' selected' : '') + '>Gross (payslip)</option></select></div>' +
      '<div class="pay-net"' + (gross ? ' hidden' : '') + '><input name="a" class="amt" placeholder="kr / month, after tax" inputmode="decimal" value="' + (r && !gross && r.amount ? r.amount : '') + '" autocomplete="off"></div>' +
      '<div class="pay-gross"' + (gross ? '' : ' hidden') + '>' +
        '<p class="pay-sub">From your payslip (lønnsslipp)</p>' +
        '<div class="row2"><label class="pay-field"><span>Monthly salary, gross (Månedslønn)</span><input name="g" placeholder="80 775" inputmode="decimal" value="' + (gross ? r.gross : '') + '" autocomplete="off"></label>' +
          '<label class="pay-field"><span>Tax (Skattetrekk): % or kr</span><input name="t" placeholder="37 % or 29 621" value="' + esc(taxVal) + '" autocomplete="off"></label></div>' +
        '<div class="row2"><label class="pay-field"><span>Extra tax, kr (Ekstra skattetrekk)</span><input name="tx" placeholder="0" inputmode="decimal" value="' + (r && r.taxExtra ? r.taxExtra : '') + '" autocomplete="off"></label>' +
          '<label class="pay-field"><span>Taxed benefits, not paid out (fordel)</span><input name="bf" placeholder="e.g. 90" inputmode="decimal" value="' + (r && r.benefits ? r.benefits : '') + '" autocomplete="off"></label></div>' +
        '<p class="pay-sub">Deductions (union, pension, insurance)</p>' +
        '<ul class="pay-deds">' + ded + '</ul>' +
        '<div class="add-row pay-dadd"><input name="dn" placeholder="e.g. Fagforening" autocomplete="off"><input name="da" class="amt" placeholder="681 or 2 %" inputmode="decimal" autocomplete="off">' +
          '<button type="button" class="pill-btn" data-dadd aria-label="Add deduction"><i class="bi bi-plus-lg"></i></button></div>' +
        '<label class="pay-check"><input type="checkbox" name="py"' + (!r || r.payYear ? ' checked' : '') + '> Norwegian pay year: holiday pay in June, half tax in December</label>' +
        '<div class="row2 pay-hol"' + (r && r.payYear === false ? ' hidden' : '') + '><label class="pay-field"><span>Holiday pay earned last year (Opptjente feriepenger i fjor)</span><input name="hp" placeholder="0 if you started this year" inputmode="decimal" value="' + (r && r.holidayPay != null && r.holidayPay !== '' ? r.holidayPay : '') + '" autocomplete="off"></label>' +
          '<label class="pay-field"><span>Holiday weeks</span><select name="hw"><option value="5"' + (!r || +r.holidayWeeks !== 4 ? ' selected' : '') + '>5 weeks</option><option value="4"' + (r && +r.holidayWeeks === 4 ? ' selected' : '') + '>4 weeks + 1 day</option></select></label></div>' +
      '</div>' +
      '<div class="add-row"><select name="day" class="pay-day" aria-label="Payday">' + days + '</select><span class="pay-prev muted" aria-live="polite"></span></div>' +
      '<div class="form-actions"><button type="button" class="text-btn" data-pcancel>Cancel</button><span class="spacer"></span>' +
        '<button class="pill-btn wide" type="submit">' + (r ? 'Save' : 'Add') + '</button></div></form></li>';
  }
  /* what the form adds up to, as you type */
  function readPay(f) {
    var r = { name: f.n.value.trim(), day: f.day.value === 'last' ? 'last' : (+f.day.value || null), deductions: f._ded || [] };
    if (f.mode.value === 'gross') {
      r.gross = num(f.g.value) || 0; r.taxExtra = num(f.tx.value) || 0; r.benefits = num(f.bf.value) || 0; r.payYear = f.py.checked;
      var t = String(f.t.value || '').trim();
      if (/%/.test(t) || (num(t) > 0 && num(t) <= 60)) { r.taxPct = num(t) || 0; r.taxKr = 0; }        // a percentage
      else { r.taxKr = num(t) || 0; r.taxPct = r.gross + r.benefits > 0 ? Math.round(r.taxKr / (r.gross + r.benefits) * 10000) / 100 : 0; }   // the amount from the payslip
      r.holidayPay = f.hp.value.trim() === '' ? null : num(f.hp.value) || 0; r.holidayWeeks = +f.hw.value || 5;
      r.amount = Math.max(0, Math.round(B.ordinary(r)));
    } else { r.amount = num(f.a.value) || 0; r.deductions = []; }
    return r;
  }
  function previewPay(f) {
    var r = readPay(f), p = f.querySelector('.pay-prev');
    if (!p) return;
    if (!(r.gross > 0)) { p.innerHTML = r.amount ? '<b>' + esc(kr(r.amount)) + '</b> per month' : ''; return; }
    var y = new Date().getFullYear(), now = B.rowFor(r, ym(new Date())), jun = B.rowFor(r, y + '-06'), dec = B.rowFor(r, y + '-12');
    p.innerHTML = '<b>' + esc(kr(now.net)) + '</b> net a month · tax ' + esc(kr(now.tax)) + (now.extra ? ' · deductions ' + esc(kr(now.extra)) : '') +
      (r.payYear ? '<br>June ' + esc(kr(jun.net)) + ' · December ' + esc(kr(dec.net)) : '');
  }
  function openPay(id) {
    payEditing = id; renderBudget();
    var f = $('budgetBody').querySelector('.pay-form');
    if (!f) return;
    var r = id === 'new' ? null : D.budget.income.filter(function (x) { return x.id === id; })[0];
    f._ded = r && r.deductions ? r.deductions.map(function (x) { return { name: x.name, amount: x.amount, pct: x.pct }; }) : [];
    previewPay(f);
  }
  function budgetEditor(kind, title, ph) {
    var rows = D.budget[kind].map(function (r) {
      if (r.src === 'sub') return '<li class="b-row b-linked"><span>' + esc(r.name) + '</span>' + money(r.amount) +
        '<a class="del" href="finance/#subs" title="From Subscriptions – change it there" aria-label="' + esc(r.name) + ' comes from Subscriptions"><i class="bi bi-link-45deg"></i></a></li>';
      if (r.src === 'save') return '<li class="b-row b-linked"><span>' + esc(r.name) + '</span>' + money(r.amount) +
        '<a class="del" href="finance/#c=savings" title="From Savings goals – change it there" aria-label="' + esc(r.name) + ' comes from Savings goals"><i class="bi bi-link-45deg"></i></a></li>';
      return '<li class="b-row"><span>' + esc(r.name) + '</span>' + money(r.amount) +
        '<button class="del" type="button" data-bdel="' + kind + ':' + r.id + '" aria-label="Remove ' + esc(r.name) + '"><i class="bi bi-x"></i></button></li>';
    }).join('');
    return '<div class="b-edit"><h3>' + title + ' <span class="muted">' + money(sum(D.budget[kind])) + '</span></h3>' +
      '<ul>' + rows + '</ul>' +
      '<form class="add-row b-add" data-kind="' + kind + '">' +
        '<input name="n" placeholder="' + ph + '" required autocomplete="off">' +
        '<input name="a" class="amt" placeholder="kr / month" inputmode="decimal" required autocomplete="off">' +
        '<button class="pill-btn" type="submit" aria-label="Add"><i class="bi bi-plus-lg"></i></button>' +
      '</form></div>';
  }

  $('budgetEdit').addEventListener('click', function () { budgetEditing = !budgetEditing; payEditing = null; renderBudget(); });
  $('budgetBody').addEventListener('submit', function (e) {
    var sf = e.target.closest('.slip-form');
    if (sf) {
      e.preventDefault();
      var net = num(sf.net.value); if (!(net > 0)) { sf.net.focus(); return; }
      D.budget.payslips = D.budget.payslips || {};
      D.budget.payslips[sf.m.value] = { net: net, gross: num(sf.g.value) || 0, tax: num(sf.t.value) || 0 };
      persist(); renderBudget(); window.dispatchEvent(new Event('fin:change'));
      return;
    }
    var pf = e.target.closest('.pay-form');
    if (pf) {
      e.preventDefault();
      var r = readPay(pf);
      if (!r.name) { pf.n.focus(); return; }
      if (!(r.amount > 0) && !(r.gross > 0)) { (pf.mode.value === 'gross' ? pf.g : pf.a).focus(); return; }
      if (pf.dataset.pid === 'new') { r.id = uid(); D.budget.income.push(r); }
      else D.budget.income = D.budget.income.map(function (x) { return x.id === pf.dataset.pid ? Object.assign({ id: x.id }, r) : x; });
      payEditing = null;
      persist(); renderBudget(); renderBills();
      window.dispatchEvent(new Event('fin:change'));
      return;
    }
    var f = e.target.closest('.b-add');
    if (!f) return;
    e.preventDefault();
    var a = num(f.a.value);
    if (!(a > 0)) { f.a.focus(); return; }
    D.budget[f.dataset.kind].push({ id: uid(), name: f.n.value.trim(), amount: a });
    persist();
    renderBudget();
    renderBills();
    var again = $('budgetBody').querySelector('.b-add[data-kind="' + f.dataset.kind + '"] input');
    if (again) again.focus();
  });
  $('budgetBody').addEventListener('click', function (e) {
    var pe = e.target.closest('[data-pedit]');
    if (pe) { openPay(pe.dataset.pedit); return; }
    var sd = e.target.closest('[data-sdel]');
    if (sd) { delete D.budget.payslips[sd.dataset.sdel]; persist(); renderBudget(); window.dispatchEvent(new Event('fin:change')); return; }
    var pm = e.target.closest('[data-period-mode]');
    if (pm) { D.budget.period = pm.dataset.periodMode; persist(); renderBudget(); window.dispatchEvent(new Event('fin:change')); return; }
    if (e.target.closest('[data-pcancel]')) { payEditing = null; renderBudget(); return; }
    var f = e.target.closest('.pay-form');
    if (f && e.target.closest('[data-dadd]')) {
      var n = f.dn.value.trim(), v = f.da.value.trim();
      if (!n || !v) { (n ? f.da : f.dn).focus(); return; }
      var d = /%/.test(v) ? { name: n, pct: num(v) } : { name: n, amount: num(v) };
      if (!(d.pct > 0 || d.amount > 0)) { f.da.focus(); return; }
      f._ded = (f._ded || []).concat([d]);
      var ul = f.querySelector('.pay-deds');
      ul.insertAdjacentHTML('beforeend', '<li class="pay-ded"><span>' + esc(d.name) + '</span><span class="muted">' + (d.pct ? esc(d.pct) + ' %' : esc(kr(d.amount))) + '</span>' +
        '<button type="button" class="del" data-ddel="' + (f._ded.length - 1) + '" aria-label="Remove"><i class="bi bi-x"></i></button></li>');
      f.dn.value = ''; f.da.value = ''; f.dn.focus(); previewPay(f);
      return;
    }
    if (f && e.target.closest('[data-ddel]')) {
      var i = +e.target.closest('[data-ddel]').dataset.ddel;
      f._ded.splice(i, 1);
      f.querySelector('.pay-deds').innerHTML = f._ded.map(function (x, j) {
        return '<li class="pay-ded"><span>' + esc(x.name) + '</span><span class="muted">' + (x.pct ? esc(x.pct) + ' %' : esc(kr(x.amount))) + '</span><button type="button" class="del" data-ddel="' + j + '" aria-label="Remove"><i class="bi bi-x"></i></button></li>';
      }).join('');
      previewPay(f);
      return;
    }
    var b = e.target.closest('[data-bdel]');
    if (!b) return;
    var p = b.dataset.bdel.split(':');
    D.budget[p[0]] = D.budget[p[0]].filter(function (r) { return r.id !== p[1]; });
    persist();
    renderBudget();
    renderBills();
    window.dispatchEvent(new Event('fin:change'));
  });
  $('budgetBody').addEventListener('input', function (e) { var f = e.target.closest('.pay-form'); if (f) previewPay(f); });
  $('budgetBody').addEventListener('change', function (e) {
    var f = e.target.closest('.pay-form');
    if (!f) return;
    if (e.target.name === 'mode') {
      var g = e.target.value === 'gross';
      f.querySelector('.pay-gross').hidden = !g; f.querySelector('.pay-net').hidden = g;
      (g ? f.g : f.a).focus();
    }
    if (e.target.name === 'py') f.querySelector('.pay-hol').hidden = !e.target.checked;
    previewPay(f);
  });

  /* ================= Spending ================= */
  var showAll = false;
  var spRows = 6;
  window.FinSpending = { rows: function (n) { n = Math.max(6, Math.min(20, n | 0)); if (n !== spRows) { spRows = n; if (D) renderSpending(); } return spRows; }, get: function () { return spRows; } };

  function renderSpending() {
    $('spMonth').textContent = monthName(viewMonth);
    $('spNext').disabled = viewMonth >= ym(new Date());
    var list = D.expenses.filter(function (e) { return e.date.slice(0, 7) === viewMonth; })
      .sort(function (a, b) { return b.date.localeCompare(a.date) || b.t - a.t; });
    var total = sum(list);

    var byCat = CATS.map(function (c) {
      return { c: c, v: sum(list.filter(function (e) { return e.cat === c.id; })) };
    }).filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; });

    var chart = $('spChart');
    if ($('spChartMonth')) $('spChartMonth').textContent = monthName(viewMonth, true);
    if (!total) {
      chart.innerHTML = '<p class="empty">No spending logged in ' + esc(monthName(viewMonth, true)) + '.</p>';
    } else {
      chart.innerHTML = '<div class="donut-wrap">' + donut(byCat, total) +
        '<div class="donut-mid"><span class="muted">Total</span>' + money(total) + '</div></div>' +
        '<ul class="legend">' + byCat.map(function (x) {
          return '<li><i class="dot" style="background:' + x.c.color + '"></i>' + esc(x.c.name) +
            '<span class="muted pct">' + Math.round(x.v / total * 100) + '\u00a0%</span><b>' + money(x.v) + '</b></li>';
        }).join('') + '</ul>';
    }

    /* the card shows the latest few; the whole month opens in a sheet (so the page never gets long) */
    var rows = spRows || 6, shown = list.slice(0, rows);      // wide screens: as many as fit next to the other cards (fin.js)
    $('spList').innerHTML = shown.map(function (e) { return txRow(e, true); }).join('');
    $('spMore').hidden = list.length <= rows;
    $('spMore').innerHTML = '<i class="bi bi-list-ul"></i> All ' + list.length + ' in ' + esc(monthName(viewMonth, true));
    if (sheetOpen) renderSheet(list);
  }
  function txRow(e, withDate) {
    var c = catById[e.cat] || catById.other, d = new Date(e.date + 'T12:00');
    return '<li class="tx" data-id="' + e.id + '"><i class="dot" style="background:' + c.color + '"></i>' +
      '<span class="tx-text"><strong>' + esc(e.note || c.name) + '</strong><span class="muted">' + esc(c.name) + (withDate ? ' · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '') + (e.src === 'bank' ? ' · <i class="bi bi-bank" title="From your bank"></i>' : '') + '</span></span>' +
      money(e.amount) + '<button class="del" type="button" data-xdel="' + e.id + '" aria-label="Delete"><i class="bi bi-x"></i></button></li>';
  }

  /* ---------- the month in a sheet: grouped by day, searchable, delete or re-categorise ---------- */
  var sheetOpen = false, sheetQ = '', sheetCat = '';
  var sheet = document.createElement('div');
  sheet.className = 'qa-bg sp-bg'; sheet.hidden = true;
  sheet.innerHTML = '<div class="qa-box sp-box" role="dialog" aria-modal="true" aria-label="Spending"><div class="qa-handle"></div>' +
    '<div class="sp-head"><h2 class="im-h"><i class="bi bi-receipt"></i> <span id="spSheetTitle"></span></h2><button type="button" class="icon-btn sm" data-close aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' +
    '<div class="sp-filter"><input id="spQ" type="search" placeholder="Search this month…" autocomplete="off"><select id="spCatF" aria-label="Category"><option value="">All categories</option>' + CATS.map(function (c) { return '<option value="' + c.id + '">' + c.name + '</option>'; }).join('') + '</select></div>' +
    '<p class="muted sp-sum" id="spSheetSum"></p><ul class="tx-list sp-sheet-list" id="spSheetList"></ul></div>';
  document.body.appendChild(sheet);
  function openSheet() {
    sheetOpen = true; sheetQ = ''; sheetCat = ''; $('spQ').value = ''; $('spCatF').value = '';
    renderSheet(D.expenses.filter(function (e) { return e.date.slice(0, 7) === viewMonth; }).sort(function (a, b) { return b.date.localeCompare(a.date) || b.t - a.t; }));
    sheet.hidden = false; document.body.classList.add('qa-open');
    requestAnimationFrame(function () { sheet.classList.add('open'); });
  }
  function closeSheet() {
    sheetOpen = false; sheet.classList.remove('open'); document.body.classList.remove('qa-open');
    setTimeout(function () { if (!sheet.classList.contains('open')) sheet.hidden = true; }, 320);
  }
  function renderSheet(list) {
    $('spSheetTitle').textContent = monthName(viewMonth);
    var q = sheetQ.toLowerCase(), rows = list.filter(function (e) { return (!sheetCat || e.cat === sheetCat) && (!q || (e.note || '').toLowerCase().indexOf(q) > -1 || (catById[e.cat] || catById.other).name.toLowerCase().indexOf(q) > -1); });
    $('spSheetSum').innerHTML = rows.length + ' expense' + (rows.length === 1 ? '' : 's') + ' · ' + money(sum(rows)) + (rows.length !== list.length ? ' <span class="muted">of ' + money(sum(list)) + '</span>' : '');
    var lastDay = '', html = '';
    rows.forEach(function (e) {
      if (e.date !== lastDay) {
        var d = new Date(e.date + 'T12:00'), dayTotal = sum(rows.filter(function (x) { return x.date === e.date; }));
        html += '<li class="tx-day"><span>' + esc(d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })) + '</span><span class="money">' + esc(kr(dayTotal)) + '</span></li>';
        lastDay = e.date;
      }
      var c = catById[e.cat] || catById.other;
      html += '<li class="tx" data-id="' + e.id + '"><i class="dot" style="background:' + c.color + '"></i>' +
        '<span class="tx-text"><strong>' + esc(e.note || c.name) + '</strong><select class="tx-cat" data-xcat="' + e.id + '" aria-label="Category">' + CATS.map(function (x) { return '<option value="' + x.id + '"' + (x.id === e.cat ? ' selected' : '') + '>' + x.name + '</option>'; }).join('') + '</select>' + (e.src === 'bank' ? ' <i class="bi bi-bank muted" title="From your bank"></i>' : '') + '</span>' +
        money(e.amount) + '<button class="del" type="button" data-xdel="' + e.id + '" aria-label="Delete"><i class="bi bi-x"></i></button></li>';
    });
    $('spSheetList').innerHTML = html || '<li class="empty">Nothing matches.</li>';
  }
  sheet.addEventListener('click', function (e) {
    if (e.target === sheet || e.target.closest('[data-close]')) { closeSheet(); return; }
    var b = e.target.closest('[data-xdel]');
    if (!b) return;
    var li = b.closest('li'); li.classList.add('removing');
    setTimeout(function () {
      D.expenses = D.expenses.filter(function (x) { return x.id !== b.dataset.xdel; });
      persist(); renderSpending(); renderBudget(); window.dispatchEvent(new Event('fin:change'));
    }, 250);
  });
  sheet.addEventListener('change', function (e) {
    var sel = e.target.closest('[data-xcat]');
    if (sel) {
      D.expenses.forEach(function (x) { if (x.id === sel.dataset.xcat) x.cat = sel.value; });
      D.catMemory = D.catMemory || {};
      var ex = D.expenses.filter(function (x) { return x.id === sel.dataset.xcat; })[0];
      if (ex && ex.note) D.catMemory[String(ex.note).toLowerCase().replace(/[^a-zæøå ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)] = sel.value;   // the importer learns from it
      persist(); renderSpending(); renderBudget(); window.dispatchEvent(new Event('fin:change'));
    }
    if (e.target.id === 'spCatF') { sheetCat = e.target.value; renderSpending(); }
  });
  sheet.addEventListener('input', function (e) { if (e.target.id === 'spQ') { sheetQ = e.target.value.trim(); renderSpending(); } });
  document.addEventListener('keydown', function (e) { if (sheetOpen && e.key === 'Escape') closeSheet(); });
  window.Vault.onLock(closeSheet);

  function donut(parts, total) {
    var r = 46, c = 2 * Math.PI * r, off = 0, gap = parts.length > 1 ? 2 : 0;
    var segs = parts.map(function (x) {
      var len = x.v / total * c;
      var s = '<circle r="' + r + '" cx="60" cy="60" stroke="' + x.c.color + '" stroke-dasharray="' +
        Math.max(len - gap, 0.01).toFixed(2) + ' ' + c.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"><title>' +
        esc(x.c.name + ': ' + kr(x.v)) + '</title></circle>';
      off += len;
      return s;
    }).join('');
    return '<svg class="donut" viewBox="0 0 120 120" aria-hidden="true"><circle class="track" r="' + r + '" cx="60" cy="60"></circle>' + segs + '</svg>';
  }

  $('spCat').innerHTML = CATS.map(function (c) { return '<option value="' + c.id + '">' + c.name + '</option>'; }).join('');
  $('spDate').value = today();

  $('spForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var a = num($('spAmount').value);
    if (!(a > 0)) { $('spAmount').focus(); return; }
    var date = $('spDate').value || today();
    D.expenses.push({ id: uid(), t: Date.now(), date: date, amount: a, cat: $('spCat').value, note: $('spNote').value.trim() });
    persist();
    $('spAmount').value = '';
    $('spNote').value = '';
    viewMonth = date.slice(0, 7);
    renderSpending();
    renderBudget();
  });
  $('spList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-xdel]');
    if (!b) return;
    var li = b.closest('li');
    li.classList.add('removing');
    setTimeout(function () {
      D.expenses = D.expenses.filter(function (x) { return x.id !== b.dataset.xdel; });
      persist();
      renderSpending();
      renderBudget();
    }, 250);
  });
  $('spPrev').addEventListener('click', function () { viewMonth = shiftMonth(viewMonth, -1); showAll = false; renderSpending(); });
  $('spNext').addEventListener('click', function () { viewMonth = shiftMonth(viewMonth, 1); showAll = false; renderSpending(); });
  $('spMore').addEventListener('click', openSheet);

  /* ================= Savings goals ================= */
  var editingSaving = null;

  function step(target) { return target >= 50000 ? 1000 : target >= 5000 ? 500 : 100; }

  function renderSavings() {
    var list = D.savings;
    $('svEmpty').hidden = list.length > 0;
    $('svList').innerHTML = list.map(function (g) {
      var pct = g.target > 0 ? Math.min(g.saved / g.target, 1) : 0;
      var C = 2 * Math.PI * 24;
      return '<li class="goal' + (pct >= 1 ? ' done' : '') + '" data-id="' + g.id + '">' +
        '<svg class="ring" viewBox="0 0 56 56" aria-hidden="true"><circle class="track" cx="28" cy="28" r="24"></circle>' +
        '<circle class="val" cx="28" cy="28" r="24" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + (C * (1 - pct)).toFixed(2) + '"></circle></svg>' +
        '<div class="goal-text"><strong>' + esc(g.name) + '</strong><span>' + money(g.saved) + ' of ' + money(g.target) +
        ' · ' + Math.round(pct * 100) + '\u00a0%</span>' + planLine(g) + '</div>' +
        '<div class="stepper"><button type="button" data-sv="-1" aria-label="Take out ' + step(g.target) + ' kr">−</button>' +
        '<button type="button" data-sv="1" aria-label="Add ' + step(g.target) + ' kr">+</button></div></li>';
    }).join('');
  }

  /* "1 200 kr a month until Mar 2027 · in the budget" */
  function planLine(g) {
    var B = window.Budget, mo = B && B.saveMonthly ? B.saveMonthly(g) : 0;
    if (!mo && !g.by) return '';
    var by = g.by ? new Date(g.by + 'T12:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '';
    return '<small class="sv-plan">' + (mo ? money(mo) + ' a month' : '') + (by ? (mo ? ' until ' : 'By ') + esc(by) : '') +
      (g.aside && mo ? ' · <i class="bi bi-link-45deg"></i> in the budget' : '') + '</small>';
  }
  function svHint() {
    var g = { target: num($('svTarget').value), saved: num($('svSaved').value) || 0, by: $('svBy').value, monthly: num($('svMonthly').value) };
    var mo = window.Budget && window.Budget.saveMonthly ? window.Budget.saveMonthly(g) : 0;
    $('svHint').textContent = mo ? 'About ' + nfK(mo) + ' a month' + ($('svAside').checked ? ' – counted as a fixed cost in your monthly budget' : '') : $('svAside').checked ? 'Give a date or an amount a month to set money aside' : '';
  }
  function nfK(n) { return Math.round(n).toLocaleString('nb-NO') + ' kr'; }
  ['svTarget', 'svSaved', 'svBy', 'svMonthly', 'svAside'].forEach(function (id) { $(id).addEventListener('input', svHint); $(id).addEventListener('change', svHint); });

  function openSaving(g) {
    editingSaving = g ? g.id : null;
    $('svForm').hidden = false;
    $('svName').value = g ? g.name : '';
    $('svSaved').value = g ? g.saved : '';
    $('svTarget').value = g ? g.target : '';
    $('svBy').value = g && g.by ? g.by : '';
    $('svMonthly').value = g && g.monthly ? g.monthly : '';
    $('svAside').checked = !!(g && g.aside);
    svHint();
    $('svDelete').hidden = !g;
    $('svName').focus();
  }
  function closeSaving() { $('svForm').hidden = true; editingSaving = null; }

  $('svAddBtn').addEventListener('click', function () { $('svForm').hidden ? openSaving(null) : closeSaving(); });
  $('svCancel').addEventListener('click', closeSaving);
  $('svForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = num($('svTarget').value), s = num($('svSaved').value) || 0;
    if (!(t > 0)) { $('svTarget').focus(); return; }
    var name = $('svName').value.trim(), extra = { by: /^\d{4}-\d{2}-\d{2}$/.test($('svBy').value) ? $('svBy').value : '', monthly: num($('svMonthly').value) || 0, aside: $('svAside').checked };
    if (editingSaving) {
      D.savings.forEach(function (g) { if (g.id === editingSaving) { g.name = name; g.saved = s; g.target = t; Object.assign(g, extra); } });
    } else {
      D.savings.push(Object.assign({ id: uid(), name: name, saved: s, target: t }, extra));
    }
    persist();
    if (window.Links) setTimeout(window.Links.syncSave, 0);
    closeSaving();
    renderSavings();
  });
  $('svDelete').addEventListener('click', function () {
    D.savings = D.savings.filter(function (g) { return g.id !== editingSaving; });
    persist();
    if (window.Links) setTimeout(window.Links.syncSave, 0);
    closeSaving();
    renderSavings();
  });
  $('svList').addEventListener('click', function (e) {
    var li = e.target.closest('.goal');
    if (!li) return;
    var g = D.savings.filter(function (x) { return x.id === li.dataset.id; })[0];
    if (!g) return;
    var b = e.target.closest('[data-sv]');
    if (b) {
      g.saved = Math.max(0, g.saved + step(g.target) * +b.dataset.sv);
      persist();
      if (window.Links) setTimeout(window.Links.syncSave, 0);
      renderSavings();
      return;
    }
    openSaving(g);
  });

  /* ================= Net worth ================= */
  var editingAcc = null;

  function netWorth() {
    return sum(D.accounts, function (a) { return a.kind === 'debt' ? -a.balance : a.balance; });
  }
  function snapshot() {
    if (D.accounts.length) D.history[ym(new Date())] = netWorth();
  }

  function renderNet() {
    var net = netWorth();
    var keys = Object.keys(D.history).sort();
    var prevKey = keys.filter(function (k) { return k < ym(new Date()); }).pop();
    var change = prevKey !== undefined ? net - D.history[prevKey] : null;

    $('nwBig').innerHTML = D.accounts.length ? money(net) : '';
    $('nwBig').className = 'big-num' + (net < 0 ? ' neg' : '');
    $('nwSub').innerHTML = !D.accounts.length ? '' :
      change === null ? 'Net worth · history builds month by month' :
      '<span class="' + (change >= 0 ? 'up' : 'down') + '"><i class="bi bi-arrow-' + (change >= 0 ? 'up' : 'down') + '-right"></i> ' +
      money(Math.abs(change)) + '</span> since ' + esc(monthName(prevKey, true));

    $('nwChart').innerHTML = keys.length >= 2 ? line(keys.slice(-12)) : '';

    $('nwEmpty').hidden = D.accounts.length > 0;
    $('nwList').innerHTML = D.accounts.slice().sort(function (a, b) {
      return (a.kind === 'debt') - (b.kind === 'debt') || b.balance - a.balance;
    }).map(function (a) {
      var debt = a.kind === 'debt';
      return '<li class="acc" data-id="' + a.id + '"><i class="bi bi-' + (debt ? 'credit-card' : 'bank') + ' acc-ico' + (debt ? ' debt' : '') + '"></i>' +
        '<span class="acc-name">' + esc(a.name) + '<span class="muted">' + (debt ? 'Debt' : 'Asset') + '</span></span>' +
        money(debt ? -a.balance : a.balance, debt ? 'neg' : '') + '</li>';
    }).join('');
  }

  function line(keys) {
    var vals = keys.map(function (k) { return D.history[k]; });
    var W = 300, H = 110, P = { l: 6, r: 6, t: 10, b: 20 };
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }
    var x = function (i) { return P.l + i / (keys.length - 1) * (W - P.l - P.r); };
    var y = function (v) { return P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b); };
    var pts = vals.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); });
    var area = 'M' + pts[0] + ' L' + pts.join(' L') + ' L' + x(keys.length - 1).toFixed(1) + ',' + (H - P.b) + ' L' + P.l + ',' + (H - P.b) + 'Z';
    var dots = vals.map(function (v, i) {
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3"><title>' + esc(monthName(keys[i]) + ': ' + kr(v)) + '</title></circle>';
    }).join('');
    var every = Math.ceil(keys.length / 6);
    var labels = keys.map(function (k, i) {
      if (i % every && i !== keys.length - 1) return '';
      return '<text x="' + x(i).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="' + (i === 0 ? 'start' : i === keys.length - 1 ? 'end' : 'middle') + '">' + esc(monthName(k, true)) + '</text>';
    }).join('');
    return '<svg class="line" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Net worth, last ' + keys.length + ' months, from ' +
      esc(nfShort.format(vals[0])) + ' to ' + esc(nfShort.format(vals[vals.length - 1])) + ' kr">' +
      '<defs><linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14b8a6" stop-opacity=".28"/><stop offset="1" stop-color="#14b8a6" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="area" d="' + area + '"></path><polyline points="' + pts.join(' ') + '"></polyline>' + dots + labels + '</svg>';
  }

  function openAcc(a) {
    editingAcc = a ? a.id : null;
    $('nwForm').hidden = false;
    $('nwName').value = a ? a.name : '';
    $('nwBal').value = a ? a.balance : '';
    $('nwKind').value = a ? a.kind : 'asset';
    $('nwDelete').hidden = !a;
    $('nwName').focus();
  }
  function closeAcc() { $('nwForm').hidden = true; editingAcc = null; }

  $('nwAddBtn').addEventListener('click', function () { $('nwForm').hidden ? openAcc(null) : closeAcc(); });
  $('nwCancel').addEventListener('click', closeAcc);
  $('nwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var bal = num($('nwBal').value);
    if (!isFinite(bal)) { $('nwBal').focus(); return; }
    var rec = { name: $('nwName').value.trim(), balance: Math.abs(bal), kind: $('nwKind').value };
    if (editingAcc) {
      D.accounts.forEach(function (a) { if (a.id === editingAcc) { a.name = rec.name; a.balance = rec.balance; a.kind = rec.kind; } });
    } else {
      rec.id = uid();
      D.accounts.push(rec);
    }
    snapshot();
    persist();
    closeAcc();
    renderNet();
  });
  $('nwDelete').addEventListener('click', function () {
    D.accounts = D.accounts.filter(function (a) { return a.id !== editingAcc; });
    snapshot();
    persist();
    closeAcc();
    renderNet();
  });
  $('nwList').addEventListener('click', function (e) {
    var li = e.target.closest('.acc');
    if (!li) return;
    openAcc(D.accounts.filter(function (a) { return a.id === li.dataset.id; })[0]);
  });

  /* ================= Lock / unlock ================= */

  /* ================= Upcoming bills ================= */
  var billsEditing = false;

  function renderBills() {
    var fixed = D.budget.fixed || [];
    var box = $('billsBody');
    $('billsEdit').hidden = !fixed.length;
    if (!fixed.length) {
      box.innerHTML = '<p class="empty">Add your fixed costs (rent, loans, subscriptions) under Monthly budget, then give them a due date here.</p>';
      return;
    }
    if (billsEditing) {
      $('billsEdit').textContent = 'Done';
      box.innerHTML = '<p class="bill-sum">Which day of the month is each one due?</p><ul>' + fixed.map(function (f) {
        var opts = '<option value="">No date</option>';
        for (var d = 1; d <= 31; d++) opts += '<option value="' + d + '"' + (f.day === d ? ' selected' : '') + '>' + d + '.</option>';
        return '<li class="bill"><span></span><span class="bill-text"><strong>' + esc(f.name) + '</strong><span>' + esc(kr(f.amount)) + '</span></span>' +
          '<select class="bill-day" data-day="' + f.id + '" aria-label="Due day for ' + esc(f.name) + '">' + opts + '</select></li>';
      }).join('') + '</ul>';
      return;
    }
    $('billsEdit').textContent = 'Due dates';

    var now = new Date(), key = ym(now), today = now.getDate(), dim = daysInMonth(now);
    var paid = (D.paid && D.paid[key]) || [];
    var dated = fixed.filter(function (f) { return f.day; });
    if (!dated.length) {
      box.innerHTML = '<p class="empty">Tap “Due dates” to tell the dashboard when each fixed cost is due.</p>';
      return;
    }
    var rows = dated.map(function (f) {
      var day = Math.min(f.day, dim), auto = f.src === 'sub' && day <= today;      // subscriptions are charged automatically
      var isPaid = paid.indexOf(f.id) > -1 || auto;
      return { f: f, day: day, paid: isPaid, auto: auto, diff: day - today };
    }).sort(function (a, b) { return (a.paid - b.paid) || (a.day - b.day); });
    var open = rows.filter(function (r) { return !r.paid; });
    var mon = now.toLocaleDateString('en-GB', { month: 'long' });

    var sum;
    if (open.length) {
      sum = '<b>' + open.length + '</b> left in ' + mon + ' · ' + money(open.reduce(function (a, r) { return a + r.f.amount; }, 0));
    } else {
      var next = dated.slice().sort(function (a, b) { return a.day - b.day; })[0];
      var nd = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(next.day, daysInMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1))));
      sum = 'All paid for ' + mon + ' 🎉 Next: <b>' + esc(next.name) + '</b> on ' + nd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
    box.innerHTML = '<p class="bill-sum">' + sum + '</p><ul>' + rows.map(function (r) {
      var date = new Date(now.getFullYear(), now.getMonth(), r.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      var when = r.auto ? 'Renewed automatically · ' + date
        : r.f.src === 'sub' && !r.paid ? (r.diff === 0 ? '<span class="soon">Renews today</span>' : 'Renews ' + date + ' · in ' + r.diff + ' day' + (r.diff === 1 ? '' : 's'))
        : r.paid ? 'Paid · due ' + date
        : r.diff < 0 ? '<span class="late">Overdue by ' + (-r.diff) + ' day' + (r.diff === -1 ? '' : 's') + '</span> · ' + date
        : r.diff === 0 ? '<span class="soon">Due today</span>'
        : r.diff <= 3 ? '<span class="soon">Due in ' + r.diff + ' day' + (r.diff === 1 ? '' : 's') + '</span> · ' + date
        : 'Due ' + date + ' · in ' + r.diff + ' days';
      return '<li class="bill' + (r.paid ? ' paid' : '') + '">' +
        '<button type="button" class="check" data-paid="' + r.f.id + '" aria-pressed="' + r.paid + '" aria-label="' + (r.paid ? 'Mark ' + esc(r.f.name) + ' as not paid' : 'Mark ' + esc(r.f.name) + ' as paid') + '"><i class="bi bi-check-lg"></i></button>' +
        '<span class="bill-text"><strong>' + esc(r.f.name) + '</strong><span>' + when + '</span></span>' + money(r.f.amount) + '</li>';
    }).join('') + '</ul>';
  }

  /* Subscriptions (Settings → Features) renewing in the next 30 days, under the bills */
  var drawBills = renderBills;
  renderBills = function () {
    drawBills();
    var Fe = window.Features, box = $('billsBody');
    if (!Fe || !Fe.on('subs') || billsEditing) return;
    var today = Fe.dkey(new Date()), until = Fe.addMonths(today, 1);
    var up = Fe.list('subs').filter(function (s) { return !s.paused && s.renews && (s.period || 'monthly') !== 'monthly'; })   // monthly ones are bills above
      .map(function (s) { return { s: s, k: Fe.nextRenewal(s) }; }).filter(function (x) { return x.k && x.k <= until; })
      .sort(function (a, b) { return a.k > b.k ? 1 : -1; });
    if (!up.length) return;
    var total = up.reduce(function (a, x) { return a + (+x.s.amount || 0); }, 0);
    var html = '<p class="bill-sum bill-subs"><i class="bi bi-arrow-repeat"></i> Yearly subscriptions next 30 days · ' + money(total) + ' <a href="finance/#subs">See all</a></p><ul>' +
      up.slice(0, 4).map(function (x) {
        var d = Fe.fromKey(x.k), diff = Math.round((d - Fe.fromKey(today)) / 864e5);
        return '<li class="bill sub"><span class="check sub-ic"><i class="bi bi-arrow-repeat"></i></span><span class="bill-text"><strong>' + esc(x.s.name) + '</strong><span>' +
          (diff === 0 ? '<span class="soon">Renews today</span>' : diff <= 3 ? '<span class="soon">Renews in ' + diff + ' day' + (diff === 1 ? '' : 's') + '</span>' : 'Renews ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) +
          '</span></span>' + money(+x.s.amount || 0) + '</li>';
      }).join('') + '</ul>';
    box.insertAdjacentHTML('beforeend', html);
  };
  window.addEventListener('tools:change', function () { if (D) renderBills(); });
  window.addEventListener('fin:change', function () { if (D) { D = window.Vault.get() || D; renderAll(); } });
  window.addEventListener('features:change', function () { if (D) renderBills(); });
  $('billsEdit').addEventListener('click', function () { billsEditing = !billsEditing; renderBills(); });
  $('billsBody').addEventListener('change', function (e) {
    var sel = e.target.closest('[data-day]');
    if (!sel) return;
    D.budget.fixed.forEach(function (f) { if (f.id === sel.dataset.day) f.day = sel.value ? +sel.value : null; });
    persist();
  });
  $('billsBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-paid]');
    if (!b) return;
    var key = ym(new Date());
    D.paid = D.paid || {};
    var list = D.paid[key] || (D.paid[key] = []);
    var i = list.indexOf(b.dataset.paid);
    if (i > -1) list.splice(i, 1); else list.push(b.dataset.paid);
    /* keep only the last few months of ticks */
    Object.keys(D.paid).forEach(function (k) { if (k < shiftMonth(key, -3)) delete D.paid[k]; });
    persist();
    renderBills();
  });

  function renderAll() { renderBudget(); renderBills(); renderSpending(); renderSavings(); renderNet(); }

  window.Vault.onUnlock(function (data) {
    /* Fill in any missing part (older data, or data from another device) */
    D = data || {};
    var b = blank();
    Object.keys(b).forEach(function (k) { if (!D[k] || typeof D[k] !== typeof b[k]) D[k] = b[k]; });
    D.budget.income = D.budget.income || [];
    D.budget.fixed = D.budget.fixed || [];
    viewMonth = ym(new Date());
    snapshot();
    renderAll();
  });

  window.Vault.onLock(function () {
    D = null;
    budgetEditing = false; payEditing = null;
    billsEditing = false;
    showAll = false;
    closeSaving();
    closeAcc();
    ['budgetBody', 'billsBody', 'spChart', 'spList', 'svList', 'nwBig', 'nwSub', 'nwChart', 'nwList'].forEach(function (id) { $(id).innerHTML = ''; });
  });
})();
} catch (e) { console.error("finance.js", e); }
/* ===== finance/fin.js ===== */
try {
/* Finance page: statistics and charts from the encrypted vault (../lock.js).
   Nothing here is stored in the page itself – the numbers only exist after you unlock. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var CATS = [
    { id: 'groceries', name: 'Groceries', color: '#11a597' },
    { id: 'eating', name: 'Eating out', color: '#d95926' },
    { id: 'transport', name: 'Transport', color: '#3987e5' },
    { id: 'shopping', name: 'Shopping', color: '#c98500' },
    { id: 'fun', name: 'Fun', color: '#d55181' },
    { id: 'health', name: 'Health', color: '#8a6fdf' },
    { id: 'travel', name: 'Travel', color: '#0891b2' },
    { id: 'other', name: 'Other', color: '#6b6d73' }
  ];
  var catById = {};
  CATS.forEach(function (c) { catById[c.id] = c; });

  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  var nfc = new Intl.NumberFormat('nb-NO', { notation: 'compact', maximumFractionDigits: 1 });
  function kr(n) { return nf.format(Math.round(n || 0)); }
  function money(n, cls) { return '<span class="money' + (cls ? ' ' + cls : '') + '">' + esc(kr(n)) + '</span>'; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function sum(list, f) { return list.reduce(function (a, x) { return a + ((f ? f(x) : x.amount) || 0); }, 0); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ym(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function shift(key, by) { var p = key.split('-'); return ym(new Date(+p[0], +p[1] - 1 + by, 1)); }
  function mName(key, long) {
    var p = key.split('-');
    return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('en-GB', long ? { month: 'long', year: 'numeric' } : { month: 'short' });
  }
  function daysIn(key) { var p = key.split('-'); return new Date(+p[0], +p[1], 0).getDate(); }

  var D = null;
  var period = 'month';
  try { period = localStorage.getItem('dash.finPeriod') || 'month'; } catch (e) {}
  var NOW = ym(new Date());

  /* Periods: this month, 3 or 12 months, this year, any earlier year ("y:2024") or all years */
  function firstMonth() {
    var first = NOW;
    (D && D.expenses || []).forEach(function (e) { var m = String(e.date).slice(0, 7); if (/^\d{4}-\d{2}$/.test(m) && m < first) first = m; });
    return first;
  }
  function monthsOf(p) {
    var out = [], i;
    if (/^y:\d{4}$/.test(p)) {
      var y = p.slice(2);
      for (i = 1; i <= 12; i++) { var k = y + '-' + pad(i); if (k <= NOW) out.push(k); }
      return out.length ? out : [y + '-01'];
    }
    if (p === 'all') {
      var start = firstMonth(), k2 = shift(NOW, -11) < start ? shift(NOW, -11) : start;
      for (; k2 <= NOW; k2 = shift(k2, 1)) out.push(k2);
      return out;
    }
    var n = p === 'month' ? 1 : p === '3m' ? 3 : p === '12m' ? 12 : new Date().getMonth() + 1;
    for (i = n - 1; i >= 0; i--) out.push(shift(NOW, -i));
    return out;
  }
  function periodName(months) {
    return period === 'month' ? mName(NOW, true) : /^y:/.test(period) ? period.slice(2) : period === 'all' ? 'All years' : months.length + ' months';
  }
  function years() {
    var ys = {}; ys[NOW.slice(0, 4)] = 1;
    (D && D.expenses || []).forEach(function (e) { var y = String(e.date).slice(0, 4); if (/^\d{4}$/.test(y)) ys[y] = 1; });
    return Object.keys(ys).sort().reverse();
  }
  function inMonths(list, months) {
    return list.filter(function (e) { return months.indexOf(e.date.slice(0, 7)) > -1; });
  }

  /* ---------- tooltip ---------- */
  var tip = $('fpTip');
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(Math.max(8, x + 14), innerWidth - w - 8);
    var top = y - h - 12 < 8 ? y + 16 : y - h - 12;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() { tip.hidden = true; }
  function dot(c) { return '<i class="dot" style="background:' + c + '"></i>'; }

  /* ---------- hide amounts (shared with the dashboard) ---------- */
  function setHidden(on) {
    document.body.classList.toggle('fin-hidden', on);
    $('finHide').innerHTML = '<i class="bi bi-eye' + (on ? '-slash' : '') + '"></i>';
    $('finHide').setAttribute('aria-label', on ? 'Show amounts' : 'Hide amounts');
    try { localStorage.setItem('dash.finHide', on ? '1' : '0'); } catch (e) {}
  }
  if (!$('finHide').dataset.bound) {
    $('finHide').dataset.bound = '1';
    $('finHide').addEventListener('click', function () { setHidden(!document.body.classList.contains('fin-hidden')); });
    try { setHidden(localStorage.getItem('dash.finHide') === '1'); } catch (e) { setHidden(false); }
  }

  /* ---------- period filter ---------- */
  function setPeriod(p) {
    period = p;
    try { localStorage.setItem('dash.finPeriod', period); } catch (e) {}
    render();
  }
  document.querySelectorAll('[data-period]').forEach(function (b) {
    b.addEventListener('click', function () { setPeriod(b.dataset.period); });
  });
  $('fpYear').addEventListener('change', function () { if (this.value) setPeriod(this.value); });

  /* ================= render ================= */
  function render() {
    if (!D) return;
    document.querySelectorAll('[data-period]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.period === period));
    });
    var ys = years();
    $('fpYear').innerHTML = '<option value="">Year…</option>' + ys.map(function (y) {
      return '<option value="y:' + y + '"' + (period === 'y:' + y ? ' selected' : '') + '>' + y + '</option>';
    }).join('');
    $('fpYear').classList.toggle('on', /^y:/.test(period));
    var months = monthsOf(period);
    var prevMonths = months.map(function (m) { return shift(m, -months.length); });
    var ex = D.expenses || [];
    var Bu = window.Budget, inc = Bu.incomeOf(D, NOW), income = inc.net, fixed = sum(D.budget.fixed);
    var spendable = income - fixed;             // the month's budget line in the charts

    tiles(months, ex, income, fixed, spendable, inc);
    monthly(period === 'month' ? last(6) : months, ex, spendable);   // a single month shows the last 6 for context
    pace(ex, spendable);
    cats(months, prevMonths, ex);
    net();
    goals();
    top(months, ex);
  }
  function last(n) { var out = []; for (var i = n - 1; i >= 0; i--) out.push(shift(NOW, -i)); return out; }

  /* Key numbers */
  function tiles(months, ex, income, fixed, spendable, inc) {
    var Bu = window.Budget, pay = Bu.nextPayday(D);
    var per = Bu.period(D), spentNow = Bu.spent(D, per);
    var left = per.income - fixed - spentNow;
    var spentP = sum(inMonths(ex, months));
    var avg = spentP / months.length;
    var rate = income > 0 ? (income - fixed - avg) / income : null;
    var nw = netWorth();
    var hist = D.history || {};
    var prevKey = Object.keys(hist).sort().filter(function (k) { return k < NOW; }).pop();
    var change = prevKey !== undefined && D.accounts.length ? nw - hist[prevKey] : null;
    var day = new Date().getDate(), dim = daysIn(NOW);
    var untilPay = per.byPayday || (pay && pay.days > 0 && pay.days <= dim);
    var perDayLeft = left > 0 ? left / (per.byPayday ? per.daysLeft : untilPay ? pay.days : dim - day + 1) : 0;
    var ded = inc.rows.reduce(function (a, r) { return a.concat(r.items); }, []);

    var T = [
      { i: 'wallet2', l: per.byPayday ? 'Left until payday' : 'Left this month', v: income || fixed ? money(left, left < 0 ? 'neg' : '') : '–',
        s: income || fixed ? (left >= 0 ? money(perDayLeft) + ' per day ' + (untilPay ? 'until payday' : 'for the rest of ' + esc(mName(NOW))) : 'Over budget') : 'Set up your budget above' },
      { i: 'cash-stack', l: 'Income in ' + esc(mName(NOW)), v: income ? money(income + (per.byPayday ? 0 : per.extra)) : '–',
        s: !income ? 'Add your salary under Monthly budget'
          : inc.gross ? (per.extra && !per.byPayday ? '+' + esc(kr(per.extra)) + ' refunds and other money in · ' : '') + 'Gross ' + esc(kr(inc.gross)) + ' − tax ' + esc(kr(inc.tax)) + (inc.extra ? ' − ' + (ded.length > 2 || inc.logged ? 'deductions ' + esc(kr(inc.extra)) : ded.map(function (x) { return esc(x.name.toLowerCase()) + ' ' + esc(kr(x.amount)); }).join(' − ')) : '') + (inc.note ? ' · ' + esc(inc.note) : '') +
            (function () { var y = Bu.yearSoFar(D); return y.months > 1 ? ' · This year: net ' + esc(kr(y.net)) + ', tax ' + esc(kr(y.tax)) : ''; })()
          : pay ? (pay.days === 0 ? esc(pay.title) + ' today' : esc(pay.title) + ' ' + pay.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · in ' + pay.days + ' day' + (pay.days === 1 ? '' : 's')) : 'Net, after tax' },
      { i: 'receipt', l: period === 'month' ? 'Spent this month' : 'Spent, ' + periodName(months).replace('All years', 'all years'), v: money(spentP),
        s: months.length > 1 ? money(avg) + ' per month on average' : (spendable > 0 ? Math.round(spentNow / spendable * 100) + ' % of what you can spend' : '') },
      { i: 'percent', l: 'Savings rate', v: rate === null ? '–' : Math.round(rate * 100) + ' %',
        s: rate === null ? 'Needs your income' : 'of net income left after fixed costs and spending' },
      { i: 'calendar-event', l: 'Next payday', v: pay ? (pay.days === 0 ? 'Today' : pay.days === 1 ? 'Tomorrow' : 'In ' + pay.days + ' days') : '–',
        s: pay ? esc(pay.title) + ' · ' + pay.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) + (pay.net ? ' · ' + esc(kr(pay.net)) : '') : 'Give your income a payday under Monthly budget' },
      { i: 'graph-up-arrow', l: 'Net worth', v: D.accounts.length ? money(nw, nw < 0 ? 'neg' : '') : '–',
        s: change === null ? (D.accounts.length ? 'History builds month by month' : 'Add accounts under Net worth')
          : '<span class="' + (change >= 0 ? 'up' : 'down') + '"><i class="bi bi-arrow-' + (change >= 0 ? 'up' : 'down') + '-right"></i> ' + money(Math.abs(change)) + '</span> since ' + esc(mName(prevKey)) }
    ];
    $('fpTiles').innerHTML = T.map(function (t) {
      return '<div class="fp-tile" data-tk="' + t.l.replace(/\b(19|20)\d\d\b/g, 'Y') + '"><div class="lbl"><i class="bi bi-' + t.i + '"></i>' + t.l + '</div><div class="val">' + t.v + '</div><div class="sub">' + t.s + '</div></div>';
    }).join('');
  }

  /* Spending per month: stacked bars by category, budget as a dashed reference line */
  function monthly(months, ex, spendable) {
    var el = $('fpMonths');
    var byYear = months.length > 24;              /* many years: one bar per year */
    $('fpMonthsTitle').innerHTML = '<i class="bi bi-bar-chart"></i> Spending per ' + (byYear ? 'year' : 'month');
    if (byYear) {
      var ys = {};
      months.forEach(function (m) { ys[m.slice(0, 4)] = 1; });
      months = Object.keys(ys).sort();
      spendable = 0;
    }
    var label = function (k, long) { return byYear ? k : mName(k, long); };
    var rows = months.map(function (m) {
      var list = byYear ? ex.filter(function (e) { return String(e.date).slice(0, 4) === m; }) : inMonths(ex, [m]);
      var by = {};
      CATS.forEach(function (c) { by[c.id] = sum(list.filter(function (e) { return (catById[e.cat] ? e.cat : 'other') === c.id; })); });
      return { m: m, by: by, total: sum(list) };
    });
    var used = CATS.filter(function (c) { return rows.some(function (r) { return r.by[c.id] > 0; }); });
    $('fpMonthsNote').textContent = label(months[0]) + ' – ' + label(months[months.length - 1]);
    $('fpMonthsLegend').innerHTML = used.length > 1 ? used.map(function (c) { return '<span>' + dot(c.color) + esc(c.name) + '</span>'; }).join('') +
      (spendable > 0 ? '<span><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" class="ref" stroke="currentColor" stroke-dasharray="4 4" stroke-width="1.5"/></svg>Budget</span>' : '') : '';

    if (!rows.some(function (r) { return r.total > 0; })) {
      el.innerHTML = '<p class="fp-empty">No spending logged in this period yet.</p>';
      $('fpMonthsTable').innerHTML = '';
      return;
    }
    var W = Math.max(300, el.clientWidth || 600), H = W < 500 ? 200 : 240;
    var P = { l: 44, r: 8, t: 12, b: 24 };
    var max = Math.max(spendable > 0 ? spendable : 0, Math.max.apply(null, rows.map(function (r) { return r.total; }))) * 1.08;
    var step = niceStep(max / 4);
    max = Math.ceil(max / step) * step;
    var y = function (v) { return P.t + (1 - v / max) * (H - P.t - P.b); };
    var bw = (W - P.l - P.r) / rows.length;
    var barW = Math.min(44, bw * .62);

    var g = '<g class="grid axis">';
    for (var v = 0; v <= max + 1; v += step) {
      g += '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"></line>' +
        '<text x="' + (P.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(nfc.format(v)) + '</text>';
    }
    g += '</g>';
    var bars = '', labels = '', hits = '';
    var every = Math.ceil(rows.length / (W < 500 ? 6 : 12));
    rows.forEach(function (r, i) {
      var x = P.l + i * bw + (bw - barW) / 2, acc = 0, segs = used.filter(function (c) { return r.by[c.id] > 0; });
      segs.forEach(function (c, j) {
        var h = r.by[c.id] / max * (H - P.t - P.b);
        var top = y(acc + r.by[c.id]);
        var gap = j < segs.length - 1 ? 2 : 0;           // 2px surface gap between stacked fills
        var isTop = j === segs.length - 1;
        bars += isTop
          ? '<path class="seg" data-i="' + i + '" fill="' + c.color + '" d="' + roundTop(x, top, barW, Math.max(h - gap, 1), 4) + '"></path>'
          : '<rect class="seg" data-i="' + i + '" x="' + x + '" y="' + (top + gap) + '" width="' + barW + '" height="' + Math.max(h - gap, 1) + '" fill="' + c.color + '"></rect>';
        acc += r.by[c.id];
      });
      if ((i % every === 0 && (rows.length - 1 - i >= every || i === rows.length - 1)) || i === rows.length - 1) {
        labels += '<text x="' + (x + barW / 2) + '" y="' + (H - 6) + '" text-anchor="middle"' + (r.m === NOW || r.m === NOW.slice(0, 4) ? ' class="cur-lbl"' : '') + '>' + esc(label(r.m)) + '</text>';
      }
      hits += '<rect class="hit" data-i="' + i + '" x="' + (P.l + i * bw) + '" y="' + P.t + '" width="' + bw + '" height="' + (H - P.t - P.b) + '"></rect>';
    });
    var ref = spendable > 0 ? '<line class="ref" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(spendable) + '" y2="' + y(spendable) + '"></line>' : '';
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Spending per ' + (byYear ? 'year' : 'month') + ', ' + esc(label(months[0], true)) + ' to ' +
      esc(label(months[months.length - 1], true)) + '. Table below.">' + g + bars + ref + '<g class="axis">' + labels + '</g>' + hits + '</svg>';

    el.querySelectorAll('.hit').forEach(function (h) {
      var r = rows[+h.dataset.i];
      var html = '<b>' + esc(label(r.m, true)) + '</b>' + used.filter(function (c) { return r.by[c.id] > 0; }).reverse().map(function (c) {
        return '<div class="row"><span>' + dot(c.color) + esc(c.name) + '</span><span>' + esc(kr(r.by[c.id])) + '</span></div>';
      }).join('') + '<div class="row"><span>Total</span><b>' + esc(kr(r.total)) + '</b></div>' +
        (spendable > 0 ? '<div class="row muted"><span>Budget</span><span>' + esc(kr(spendable)) + '</span></div>' : '');
      h.addEventListener('pointermove', function (e) {
        el.classList.add('dim');
        el.querySelectorAll('.seg').forEach(function (s) { s.classList.toggle('on', s.dataset.i === h.dataset.i); });
        showTip(html, e.clientX, e.clientY);
      });
      h.addEventListener('pointerleave', function () { el.classList.remove('dim'); hideTip(); });
    });

    $('fpMonthsTable').innerHTML = '<table><thead><tr><th>' + (byYear ? 'Year' : 'Month') + '</th>' + used.map(function (c) { return '<th>' + esc(c.name) + '</th>'; }).join('') +
      '<th>Total</th></tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><td>' + esc(label(r.m, true)) + '</td>' + used.map(function (c) { return '<td>' + money(r.by[c.id]) + '</td>'; }).join('') +
          '<td>' + money(r.total) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function roundTop(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) +
      'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }
  function niceStep(raw) {
    if (raw <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  /* This month's pace: cumulative spending vs an even pace to the budget */
  function pace(ex, spendable) {
    var el = $('fpPace');
    var dim = daysIn(NOW), today = new Date().getDate();
    var list = inMonths(ex, [NOW]);
    var cum = [], acc = 0;
    for (var d = 1; d <= today; d++) {
      acc += sum(list.filter(function (e) { return +e.date.slice(8, 10) === d; }));
      cum.push(acc);
    }
    var expected = spendable > 0 ? spendable * today / dim : null;
    $('fpPaceLead').innerHTML = spendable > 0
      ? (acc <= expected
        ? '<span class="up">' + money(expected - acc) + ' under</span> an even pace for ' + esc(mName(NOW, true).split(' ')[0]) + '.'
        : '<span class="down">' + money(acc - expected) + ' over</span> an even pace for ' + esc(mName(NOW, true).split(' ')[0]) + '.')
      : 'Add income and fixed costs under Monthly budget to compare with a budget.';
    if (!acc && !(spendable > 0)) { el.innerHTML = '<p class="fp-empty">No spending this month yet.</p>'; return; }

    var W = Math.max(280, el.clientWidth || 500), H = 190;
    var P = { l: 44, r: 10, t: 12, b: 24 };
    var max = Math.max(spendable > 0 ? spendable : 0, acc) * 1.08 || 1;
    var step = niceStep(max / 4);
    max = Math.ceil(max / step) * step;
    var x = function (day) { return P.l + (day - 1) / (dim - 1) * (W - P.l - P.r); };
    var y = function (v) { return P.t + (1 - v / max) * (H - P.t - P.b); };
    var g = '<g class="grid axis">';
    for (var v = 0; v <= max + 1; v += step) {
      g += '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"></line><text x="' + (P.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(nfc.format(v)) + '</text>';
    }
    g += '</g>';
    var ticks = [1, 8, 15, 22, dim].map(function (d) { return '<text x="' + x(d) + '" y="' + (H - 6) + '" text-anchor="' + (d === 1 ? 'start' : d === dim ? 'end' : 'middle') + '">' + d + '.</text>'; }).join('');
    var ref = spendable > 0 ? '<line class="ref" x1="' + x(1) + '" y1="' + y(0) + '" x2="' + x(dim) + '" y2="' + y(spendable) + '"></line>' +
      '<text class="ref-lbl" x="' + (x(dim) - 4) + '" y="' + (y(spendable) - 6) + '" text-anchor="end">Budget ' + esc(nfc.format(spendable)) + '</text>' : '';
    var pts = cum.map(function (v, i) { return x(i + 1).toFixed(1) + ',' + y(v).toFixed(1); });
    var line = pts.length > 1 ? '<path class="area" d="M' + x(1) + ',' + y(0) + ' L' + pts.join(' L') + ' L' + x(today) + ',' + y(0) + 'Z"></path><polyline class="ln" points="' + pts.join(' ') + '"></polyline>' : '';
    var end = '<circle class="dot" r="4.5" cx="' + x(today) + '" cy="' + y(acc) + '"></circle>';
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Spending so far this month: ' + esc(kr(acc)) + (spendable > 0 ? ' of a ' + esc(kr(spendable)) + ' budget' : '') + '">' +
      g + ref + line + end + '<g class="axis">' + ticks + '</g><line class="cross" id="paceX" visibility="hidden" y1="' + P.t + '" y2="' + (H - P.b) + '" x1="-10" x2="-10"></line>' +
      '<rect class="hit" x="' + P.l + '" y="' + P.t + '" width="' + (W - P.l - P.r) + '" height="' + (H - P.t - P.b) + '"></rect></svg>';
    var svg = el.querySelector('svg'), hit = el.querySelector('.hit'), cross = el.querySelector('#paceX');
    hit.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
      var day = Math.max(1, Math.min(dim, Math.round((px - P.l) / (W - P.l - P.r) * (dim - 1) + 1)));
      cross.setAttribute('x1', x(day)); cross.setAttribute('x2', x(day)); cross.setAttribute('visibility', 'visible');
      var html = '<b>' + day + '. ' + esc(mName(NOW, true)) + '</b>' +
        (day <= today ? '<div class="row"><span>' + dot('var(--accent)') + 'Spent so far</span><span>' + esc(kr(cum[day - 1])) + '</span></div>' : '<div class="row muted"><span>Not yet</span></div>') +
        (spendable > 0 ? '<div class="row muted"><span>Even pace</span><span>' + esc(kr(spendable * day / dim)) + '</span></div>' : '');
      showTip(html, e.clientX, e.clientY);
    });
    hit.addEventListener('pointerleave', function () { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  }

  /* Categories: sorted bars with change vs the previous period */
  function cats(months, prevMonths, ex) {
    var cur = inMonths(ex, months), prev = inMonths(ex, prevMonths);
    var total = sum(cur);
    var rows = CATS.map(function (c) {
      var f = function (e) { return (catById[e.cat] ? e.cat : 'other') === c.id; };
      return { c: c, v: sum(cur.filter(f)), p: sum(prev.filter(f)) };
    }).filter(function (r) { return r.v > 0; }).sort(function (a, b) { return b.v - a.v; });
    $('fpCatNote').textContent = period === 'all' ? 'all years' : /^y:/.test(period) ? 'vs ' + (+period.slice(2) - 1)
      : months.length > 1 ? 'vs previous ' + months.length + ' months' : 'vs ' + mName(prevMonths[0]);
    if (!rows.length) { $('fpCats').innerHTML = '<li class="fp-empty">Nothing logged in this period.</li>'; return; }
    /* a chart: one line per category – this period's bar, a tick where the previous period ended,
       and the change. Lower spending than before is green. */
    var cmp = period !== 'all', max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.v, cmp ? r.p : 0); }));
    var per = months.length > 1;
    $('fpCats').innerHTML = (cmp && rows.some(function (r) { return r.p > 0; }) ? '<li class="fc-key"><span><i class="fc-sw"></i> ' + esc(periodName(months)) + '</span><span><i class="fc-tk"></i> ' + esc(prevName(months)) + '</span></li>' : '') +
      rows.map(function (r) {
        var ch = r.p > 0 ? (r.v - r.p) / r.p : null, share = Math.round(r.v / total * 100);
        var tip = r.c.name + ': ' + kr(r.v) + ' · ' + share + ' % of spending' + (per ? ' · ' + kr(r.v / months.length) + '/month' : '') + (cmp && r.p > 0 ? ' · before ' + kr(r.p) : '');
        var chg = !cmp ? '<span class="fc-ch muted">' + share + ' %</span>' : ch === null ? '<span class="fc-ch muted">new</span>' : '<span class="fc-ch ' + (ch <= 0 ? 'up' : 'down') + '">' + (ch > 0 ? '+' : '−') + Math.abs(Math.round(ch * 100)) + ' %</span>';
        return '<li class="fc-row" title="' + esc(tip) + '"><span class="fc-name">' + dot(r.c.color) + esc(r.c.name) + '</span>' +
          '<span class="fc-track"><span class="fc-fill" style="width:' + (r.v / max * 100).toFixed(1) + '%;background:' + r.c.color + '"></span>' +
          (cmp && r.p > 0 ? '<span class="fc-prev" style="left:' + (r.p / max * 100).toFixed(1) + '%"></span>' : '') + '</span>' +
          '<span class="fc-amt">' + money(r.v) + '</span>' + chg + '</li>';
      }).join('');
  }
  function prevName(months) { return /^y:/.test(period) ? String(+period.slice(2) - 1) : period === 'month' ? 'Last month' : period === 'year' ? 'Last year' : 'The ' + months.length + ' months before'; }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fpcats]'); if (!b) return;
    var open = b.getAttribute('aria-expanded') !== 'true', n = b.dataset.fpcats;
    document.querySelectorAll('#fpCats .fp-cat-more').forEach(function (li) { li.hidden = !open; });
    b.setAttribute('aria-expanded', String(open));
    b.innerHTML = open ? '<i class="bi bi-chevron-up"></i> Show fewer' : '<i class="bi bi-chevron-down"></i> ' + n + ' more categor' + (n === '1' ? 'y' : 'ies');
  });

  /* Net worth */
  function netWorth() {
    return sum(D.accounts || [], function (a) { return a.kind === 'debt' ? -a.balance : a.balance; });
  }
  function net() {
    if (!$('fpNet')) return;               // the editable Net worth card is on the page instead
    var accs = D.accounts || [];
    var nw = netWorth();
    $('fpNet').innerHTML = accs.length ? money(nw, nw < 0 ? 'neg' : '') : '';
    var assets = sum(accs.filter(function (a) { return a.kind !== 'debt'; }), function (a) { return a.balance; });
    var debts = sum(accs.filter(function (a) { return a.kind === 'debt'; }), function (a) { return a.balance; });
    $('fpNetSub').innerHTML = accs.length ? 'Assets ' + money(assets) + ' · Debt ' + money(debts) : 'Add accounts and loans on the dashboard.';
    var hist = D.history || {}, keys = Object.keys(hist).sort();
    if (period !== 'all') keys = /^y:/.test(period) ? keys.filter(function (k) { return k.slice(0, 4) === period.slice(2); }) : keys.slice(-12);
    var long = keys.length > 12;
    var el = $('fpNetChart');
    if (keys.length < 2) { el.innerHTML = accs.length ? '<p class="fp-empty">The chart appears once you have two months of history.</p>' : ''; }
    else {
      var vals = keys.map(function (k) { return hist[k]; });
      var W = Math.max(280, el.clientWidth || 500), H = 170, P = { l: 44, r: 10, t: 14, b: 24 };
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      if (lo === hi) { lo -= 1; hi += 1; }
      var step = niceStep((hi - lo) / 3); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
      var x = function (i) { return P.l + i / (keys.length - 1) * (W - P.l - P.r); };
      var y = function (v) { return P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b); };
      var g = '<g class="grid axis">';
      for (var v = lo; v <= hi + 1; v += step) g += '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"></line><text x="' + (P.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(nfc.format(v)) + '</text>';
      g += '</g>';
      var pts = vals.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); });
      var every = Math.ceil(keys.length / 6);
      var lbl = keys.map(function (k, i) { var lastI = keys.length - 1; return (i % every || (i !== lastI && lastI - i < every)) && i !== lastI ? '' : '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === keys.length - 1 ? 'end' : 'middle') + '">' + esc(long ? mName(k) + ' ' + k.slice(2, 4) : mName(k)) + '</text>'; }).join('');
      var hits = keys.map(function (k, i) {
        var w = (W - P.l - P.r) / (keys.length - 1);
        return '<rect class="hit" data-i="' + i + '" x="' + (x(i) - w / 2) + '" y="' + P.t + '" width="' + w + '" height="' + (H - P.t - P.b) + '"></rect>';
      }).join('');
      el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Net worth over ' + keys.length + ' months, from ' + esc(kr(vals[0])) + ' to ' + esc(kr(vals[vals.length - 1])) + '">' +
        g + '<polyline class="ln" points="' + pts.join(' ') + '"></polyline><circle class="dot" r="4.5" cx="' + x(keys.length - 1) + '" cy="' + y(vals[vals.length - 1]) + '"></circle>' +
        '<line class="cross" id="nwX" visibility="hidden" y1="' + P.t + '" y2="' + (H - P.b) + '" x1="-10" x2="-10"></line><g class="axis">' + lbl + '</g>' + hits + '</svg>';
      var cross = el.querySelector('#nwX');
      el.querySelectorAll('.hit').forEach(function (h) {
        var i = +h.dataset.i;
        h.addEventListener('pointermove', function (e) {
          cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
          var d = i > 0 ? vals[i] - vals[i - 1] : null;
          showTip('<b>' + esc(mName(keys[i], true)) + '</b><div class="row"><span>Net worth</span><span>' + esc(kr(vals[i])) + '</span></div>' +
            (d === null ? '' : '<div class="row"><span>Change</span><span class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '−') + esc(kr(Math.abs(d))) + '</span></div>'), e.clientX, e.clientY);
        });
        h.addEventListener('pointerleave', function () { cross.setAttribute('visibility', 'hidden'); hideTip(); });
      });
    }
    $('fpAccs').innerHTML = accs.slice().sort(function (a, b) { return (a.kind === 'debt') - (b.kind === 'debt') || b.balance - a.balance; }).map(function (a) {
      var debt = a.kind === 'debt';
      return '<li><span>' + esc(a.name) + '<span class="muted">' + (debt ? 'Debt' : 'Asset') + '</span></span>' + money(debt ? -a.balance : a.balance, debt ? 'neg' : '') + '</li>';
    }).join('');
  }

  /* Savings goals */
  function goals() {
    if (!$('fpGoals')) return;
    var list = D.savings || [];
    if (!list.length) { $('fpGoals').innerHTML = '<li class="fp-empty">No savings goals yet. Add them on the dashboard.</li>'; return; }
    $('fpGoals').innerHTML = list.map(function (g) {
      var pct = g.target > 0 ? Math.min(g.saved / g.target, 1) : 0;
      return '<li><div class="g-top"><strong>' + esc(g.name) + '</strong><span>' + Math.round(pct * 100) + ' %</span></div>' +
        '<div class="bar"><span style="width:' + (pct * 100).toFixed(1) + '%"></span></div>' +
        '<div class="meta">' + money(g.saved) + ' of ' + money(g.target) + (pct < 1 ? ' · ' + money(g.target - g.saved) + ' to go' : ' · reached 🎉') + '</div></li>';
    }).join('');
  }

  /* Biggest expenses */
  function top(months, ex) {
    var list = inMonths(ex, months).slice().sort(function (a, b) { return b.amount - a.amount; }).slice(0, 5);
    $('fpTopNote').textContent = periodName(months);
    if (!list.length) { $('fpTop').innerHTML = '<li class="fp-empty">Nothing logged in this period.</li>'; return; }
    $('fpTop').innerHTML = list.map(function (e) {
      var c = catById[e.cat] || catById.other;
      var d = new Date(e.date + 'T12:00');
      return '<li class="tx">' + dot(c.color) + '<span class="tx-text"><strong>' + esc(e.note || c.name) + '</strong><span class="muted">' +
        esc(c.name) + ' · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) +
        '</span></span>' + money(e.amount) + '</li>';
    }).join('');
  }

  /* CSV export of all expenses (the file is unencrypted – keep it somewhere private) */
  $('fpExport').addEventListener('click', function () {
    if (!D) return;
    var rows = [['Date', 'Category', 'Note', 'Amount (NOK)']].concat((D.expenses || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).map(function (e) {
      return [e.date, (catById[e.cat] || catById.other).name, e.note || '', String(e.amount).replace('.', ',')];
    }));
    var csv = '﻿' + rows.map(function (r) { return r.map(function (v) { return /[;"\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'expenses-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });

  /* Redraw charts when the width changes (phone rotation, window resize) */
  var rt = null, lastW = innerWidth;
  addEventListener('resize', function () {
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    clearTimeout(rt); rt = setTimeout(render, 150);
  });

  window.Vault.onUnlock(function (data) {
    D = data || {};
    D.budget = D.budget || { income: [], fixed: [] };
    D.expenses = D.expenses || []; D.savings = D.savings || []; D.accounts = D.accounts || []; D.history = D.history || {};
    NOW = ym(new Date());
    requestAnimationFrame(render);
  });
  /* the budget changed elsewhere (e.g. a subscription) */
  window.addEventListener('fin:change', function () { if (D) { D = window.Vault.get() || D; render(); } });
  /* the statistics fold away: tap a heading to open or close it – remembered on this device.
     On phones they start folded, so the page is short; on larger screens they start open. */
  (function () {
    var cards = document.querySelectorAll('.fp-card'), store = {};
    try { store = JSON.parse(localStorage.getItem('dash.fpFold')) || {}; } catch (e) {}
    var small = matchMedia('(max-width: 759px)').matches;
    cards.forEach(function (c, i) {
      var id = 'c' + i, head = c.querySelector('.card-head'); if (!head) return;
      head.classList.add('fp-foldhead'); head.setAttribute('role', 'button'); head.setAttribute('tabindex', '0');
      head.insertAdjacentHTML('beforeend', '<i class="bi bi-chevron-down fp-chev" aria-hidden="true"></i>');
      var folded = id in store ? store[id] : small;
      function set(f, save) {
        c.classList.toggle('folded', f); head.setAttribute('aria-expanded', String(!f));
        if (save) { store[id] = f; try { localStorage.setItem('dash.fpFold', JSON.stringify(store)); } catch (e) {} }
        if (!f) setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 30);   // charts draw at their real width
      }
      set(folded, false);
      head.addEventListener('click', function (e) { if (e.target.closest('a, button, select, input')) return; set(!c.classList.contains('folded'), true); });
      head.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(!c.classList.contains('folded'), true); } });
    });
  })();
  window.Vault.onLock(function () {
    D = null;
    hideTip();
    ['fpTiles', 'fpMonths', 'fpMonthsTable', 'fpPace', 'fpCats', 'fpNet', 'fpNetSub', 'fpNetChart', 'fpAccs', 'fpGoals', 'fpTop'].forEach(function (id) { if ($(id)) $(id).innerHTML = ''; });
  });
})();

/* ---------- Even columns on wide screens ----------
   Budget, savings, bills, categories and net worth are shared between the two left columns so
   they end at about the same height as Spending; the last card in each column stretches the
   rest of the way, so the three columns end on one line however long a card gets. */
(function () {
  "use strict";
  var grid = document.querySelector('.fp-fin .fin-cols'); if (!grid) return;
  var cols = grid.querySelectorAll(':scope > .fin-col'); if (cols.length < 3) return;
  var ORDER = ['budget', 'savings', 'bills', 'spcats', 'networth'];
  var busy = false, timer = null;
  function cardsIn() { return ORDER.map(function (c) { return grid.querySelector('.card.' + c); }).filter(Boolean); }
  function balance() {
    if (busy) return; busy = true;
    var wide = matchMedia('(min-width: 1040px)').matches, cards = cardsIn();
    if (!wide) { grid.classList.remove('fin-even'); if (window.FinSpending) window.FinSpending.rows(6); busy = false; return; }
    grid.classList.remove('fin-even');                 // measure the cards at their own height, not stretched
    if (window.FinSpending && window.FinSpending.get() !== 6) window.FinSpending.rows(6);
    /* heights as they are now (the two left columns are the same width, so moving doesn't change them) */
    var h = cards.map(function (c) { return c.hidden ? 0 : c.getBoundingClientRect().height; });
    var gap = parseFloat(getComputedStyle(cols[0]).rowGap) || 14;
    var right = cols[2].getBoundingClientRect().height;
    /* try every split that keeps the order inside each column; pick the one with the lowest tallest column */
    var best = null;
    for (var mask = 0; mask < (1 << cards.length); mask++) {
      var a = 0, b = 0, na = 0, nb = 0;
      for (var i = 0; i < cards.length; i++) { if (mask & (1 << i)) { b += h[i]; nb++; } else { a += h[i]; na++; } }
      if (!na || !nb) continue;
      a += gap * (na - 1); b += gap * (nb - 1);
      var score = Math.max(a, b, right) * 10 + Math.abs(a - b) + (mask & 1 ? 1e6 : 0);   // budget stays top left
      if (!best || score < best.score) best = { score: score, mask: mask };
    }
    if (best) {
      var want = [[], []]; cards.forEach(function (c, i) { want[best.mask & (1 << i) ? 1 : 0].push(c); });
      var same = [0, 1].every(function (k) { var now = Array.prototype.filter.call(cols[k].children, function (x) { return cards.indexOf(x) >= 0; }); return now.length === want[k].length && now.every(function (x, j) { return x === want[k][j]; }); });
      if (!same) [0, 1].forEach(function (k) { want[k].forEach(function (c) { cols[k].appendChild(c); }); });   // only touch the page when something has to move
      /* …and Spending shows more of the month instead of ending early */
      var tallest = Math.max(cols[0].getBoundingClientRect().height, cols[1].getBoundingClientRect().height);
      var sp = grid.querySelector('.card.spending'), row = sp && sp.querySelector('#spList > li');
      if (sp && row && window.FinSpending) {
        var room = tallest - sp.getBoundingClientRect().height, rh = row.getBoundingClientRect().height || 60;
        if (room > rh * .8) window.FinSpending.rows(6 + Math.floor(room / rh));
      }
    }
    grid.classList.add('fin-even');
    busy = false;
  }
  function soon() { clearTimeout(timer); timer = setTimeout(balance, 120); }
  new ResizeObserver(soon).observe(grid);
  ['fin:change', 'features:change', 'resize'].forEach(function (e) { window.addEventListener(e, soon); });
  if (window.Vault) window.Vault.onUnlock(function () { setTimeout(balance, 300); });
})();
} catch (e) { console.error("finance/fin.js", e); }
/* ===== finance/import.js ===== */
try {
/* Import spending from your bank's CSV export (DNB, Sparebank 1, Nordea, Danske, Handelsbanken,
   Bulder and most others). Everything happens in the browser: the file is read here, nothing is
   uploaded. Columns are found by their headings, categories are guessed from the merchant name
   (and from what you've categorised before), and rows you already have are skipped. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var card = document.querySelector('.card.spending');
  if (!card || !window.Vault) return;

  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  var CATS = [['groceries', 'Groceries'], ['eating', 'Eating out'], ['transport', 'Transport'], ['shopping', 'Shopping'], ['fun', 'Fun'], ['health', 'Health'], ['travel', 'Travel'], ['other', 'Other']];
  /* merchant words → category (Norwegian everyday life first) */
  var RULES = [
    ['groceries', /rema|kiwi|coop|extra\b|meny|joker|bunnpris|spar\b|obs\b|prix|matkroken|europris|oda\.com|oda\b|kolonial|nærbutikken|narvesen|7-?eleven|mix\b|deli de luca|bakeri|baker|point\b/i],
    ['eating', /restaurant|cafe|café|kaffe|coffee|espresso|foodora|wolt|just eat|mcdonald|burger|pizza|sushi|kebab|bar\b|pub\b|bryggeri|vinmonopol|peppes|egon|olivia|starbucks|dominos|max\b|sesam|bistro|kantine|eurest|iss\b|lunsj|lunch|bakehuset|kaffebrenneri|nordvegan|eathappy|vegan|chicken|subway|favrit|bit\b|kam nydalen|syng\b|grill|taco|thai|ramen|poke|bakery/i],
    ['transport', /ruter|vy\b|vy app|vy\.no|flytoget|sas\b|norwegian|widerøe|wideroe|bolt\.eu|bolt\b|uber|taxi|circle k|shell|esso|uno-x|yx\b|bompeng|autopass|fjellinjen|parker|parkering|easypark|apcoa|q-park|onepark|bane nor|entur|kolumbus|skyss|atb\b|voi\b|tier\b|ryde|bilxtra|biltema|nsb/i],
    ['health', /apotek|vitus|boots|legesenter|lege\b|tannlege|tannhelse|sats|elixia|evo\b|fresh fitness|trening|fysio|kiropraktor|optiker|specsavers|brilleland|synsam|lensway|solotica|linser|helse|volvat|aleris|dr\.dropin|bassenget|svømme|life\b|sunkost|lean studio|yoga|pilates/i],
    ['shopping', /zara|h&m|hm\.com|elkj|power\b|ikea|clas ohlson|amazon|zalando|xxl|jernia|kid interiør|princess|dressmann|cubus|lindex|bik bok|jysk|komplett|apple|eplehuset|samsung|nille|normal\b|kitch'n|tilbords|bohus|skeidar|g-sport|intersport|stormberg|bergans|steen & strøm|steen & strom|klarna|volt\b|mestergr|kondomeriet|lego|boozt|asos|shein|temu|ebay|etsy|black ember|sniffer/i],
    ['fun', /kino|netflix|spotify|hbo|disney|viaplay|tv 2|steam|playstation|xbox|nintendo|ticketmaster|billett|konsert|teater|museum|bowling|tusenfryd|strawberry|youtube|apple\.com\/bill|patreon|twitch|karaoke/i],
    ['travel', /hotel|hotell|airbnb|booking\.com|hotels\.com|expedia|ryanair|lufthansa|klm|finnair|color line|fjord line|hurtigruten|avinor|gardermoen|scandic|thon|radisson|nordic choice|citybox|comfort hotel|quality|trip\.com|momondo|sixt|hertz|avis|europcar/i]
  ];
  var TRANSFER = /overføring|overforing|til konto|fra konto|egen konto|sparing|spare|nettbank|vipps\*[a-zæøå]+ [a-zæøå]+ [a-zæøå]+,|vipps.*(til|fra)|innskudd|lønn|lonn|salary|skatt|nav\b|bsu|fond|aksje|nordnet|kron\b|renter|kredittkort|credit ?card|innbetaling|betaling mottatt|takk for betalingen|nedbetaling|avtalegiro.*(kort|card)|revolut|svea|klarna\b.*faktura|penger tilbake/i;

  /* ---------- reading the file ---------- */
  function decode(buf) {
    var txt = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    if (/�/.test(txt)) txt = new TextDecoder('windows-1252').decode(buf);
    return txt.replace(/^﻿/, '');
  }
  function parseCSV(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var head = lines[0] || '', delim = [';', '\t', ','].sort(function (a, b) { return head.split(b).length - head.split(a).length; })[0];
    function split(line) {
      var out = [], cur = '', q = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (ch === delim && !q) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out.map(function (s) { return s.trim(); });
    }
    return lines.map(split);
  }
  function num(v) {
    var s = String(v || '').replace(/\s|kr|NOK/gi, '').replace(/−/g, '-');
    if (!s) return NaN;
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');        // 1.234,56
    else if (/\.\d{1,2}$/.test(s)) s = s.replace(/,/g, '');                      // 1,234.56
    else s = s.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.');
    var n = parseFloat(s); return isFinite(n) ? n : NaN;
  }
  function dateKey(v) {
    var s = String(v || '').trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/))) return m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
    if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/))) return '20' + m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return m[1] + '-' + m[2] + '-' + m[3];
    return null;
  }
  /* find the columns by their headings */
  function columns(head) {
    var h = head.map(function (x) { return x.toLowerCase(); });
    function find(res) { for (var r = 0; r < res.length; r++) for (var i = 0; i < h.length; i++) if (res[r].test(h[i])) return i; return -1; }
    return {
      date: find([/kjøpsdato|kjopsdato|transaksjonsdato|purchase date|transaction date/, /^bokf|bokføringsdato|bokføringsdag|posteringsdato|booking/, /^dato$|^date$|^dato\b|dato|date|dag$/]),
      desc: find([/beskrivelse|forklaring|^tekst|description|^text|tittel|mottaker|merchant|navn|melding/]),
      amount: find([/^beløp$|^belop$|^amount$|beløp|amount|^sum$/]),
      out: find([/^ut\b|ut fra konto|debet|utgående|withdraw|debit/]),
      inn: find([/^inn\b|inn på konto|kredit|innskudd|deposit|credit/])
    };
  }
  function guessCat(desc, memory) {
    if (window.Smart) return window.Smart.guessCat(desc, memory);       // the same shop rules as quick add
    var key = norm(desc);
    if (memory[key]) return memory[key];
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(desc)) return RULES[i][0];
    return 'other';
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/\d{2}[./]\d{2}([./]\d{2,4})?/g, '').replace(/[^a-zæøå ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function clean(desc) {
    var s = String(desc || '').replace(/^\*?\d{4}\s+\d{2}\.\d{2}\s+/, '').replace(/^(varekjøp|varekjop|betaling|visa|mastercard|kortkjøp|bruk av kort)\s*/i, '')
      .replace(/^vipps\*/i, '').replace(/,\s*[^,]*,\s*[A-Z]{3}\s*$/, '')          // "…, Oslo, NOR"
      .replace(/\s+\d{2,5}(\s|$)/g, ' ').replace(/[*\/]\s*[A-Z0-9]{6,}\s*$/i, '').replace(/\s+(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{6,}\s*$/i, '')  // shop numbers and booking codes
      .replace(/\s{2,}/g, ' ').replace(/\s+(nok|kurs).*$/i, '').replace(/[,\s]+$/, '').trim();
    if (s === s.toUpperCase() && /[A-ZÆØÅ]{3}/.test(s)) s = s.toLowerCase().replace(/(^|[\s\-&(])([a-zæøå])/g, function (m, a, b) { return a + b.toUpperCase(); });
    return s.slice(0, 60);
  }

  /* ---------- turning rows into candidate expenses ---------- */
  /* find the header line (banks sometimes put a title or the account above it) */
  function headerIndex(rows) {
    var best = -1, score = -1;
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var c = columns(rows[i]), sc = (c.date > -1) + (c.desc > -1) + (c.amount > -1 || c.out > -1);
      if (sc > score) { score = sc; best = i; }
      if (sc === 3) break;
    }
    return score >= 3 ? best : -1;
  }
  function analyse(rows, opts) {
    opts = opts || {};
    if (typeof rows === 'string') rows = parseCSV(rows);
    if (!rows || rows.length < 2) return { error: 'The file looks empty.' };
    var hi = headerIndex(rows);
    if (hi < 0) return { error: 'Couldn’t find the date, text and amount columns. The first line reads: “' + rows[0].join(' ; ').slice(0, 120) + '”. Send me that line and I’ll add the layout.' };
    var col = columns(rows[hi]);
    var d = window.Vault.get() || {}, have = {}, memory = d.catMemory || {}, fixed = (d.budget && d.budget.fixed) || [];
    /* expenses you logged yourself (quick add, the Spending form): the bank row for the same purchase
       shouldn't count twice – same amount, within three days */
    var manual = (d.expenses || []).filter(function (e) { return (!e.src || e.src === 'trip') && !e.ref && +e.amount > 0; }), claimed = {};
    function dayN(k) { return Math.round(new Date(k + 'T12:00') / 864e5); }
    (d.expenses || []).forEach(function (e) {
      if (e.ref) have[e.ref] = 1;
      have[e.date + '|' + Math.round(e.amount) + '|' + norm(e.note)] = 1;
      if (e.note && e.cat && !e.src) memory[norm(e.note)] = memory[norm(e.note)] || e.cat;
    });
    /* read every row first; then decide which sign means spending */
    var parsed = [];
    rows.slice(hi + 1).forEach(function (r) {
      var date = dateKey(r[col.date]), desc = r[col.desc] || '', amt = NaN;
      if (col.amount > -1 && !isNaN(num(r[col.amount]))) amt = num(r[col.amount]);
      else if (col.out > -1) { var o = num(r[col.out]), i = col.inn > -1 ? num(r[col.inn]) : NaN; amt = !isNaN(o) && o !== 0 ? -Math.abs(o) : !isNaN(i) ? Math.abs(i) : NaN; }
      parsed.push({ date: date, desc: desc, amt: amt, ok: !!(date && !isNaN(amt) && desc) });
    });
    var good = parsed.filter(function (x) { return x.ok && x.amt !== 0; });
    var pos = good.filter(function (x) { return x.amt > 0; }).length;
    /* a credit-card statement lists purchases as positive amounts (and the payments as negative) */
    var card = opts.card != null ? !!opts.card : (col.out < 0 && good.length >= 3 && pos / good.length >= 0.7);
    var haveIn = {};
    (d.extra || []).forEach(function (e) { if (e.ref) haveIn[e.ref] = 1; });
    var SALARY = /lønn|lonn|salary|feriepeng|utbetaling nav|skatteetaten|skatt til gode/i, OWN = /innbetaling|overføring|overforing|fra konto|egen konto|sparekonto|nettbank|revolut/i;
    var out = [], skipped = { income: 0, dup: 0, bad: 0 };
    parsed.forEach(function (x) {
      if (!x.ok) { skipped.bad++; return; }
      var spend = card ? x.amt > 0 : x.amt < 0;
      var amount = Math.round(Math.abs(x.amt) * 100) / 100, note = clean(x.desc);
      if (!spend) {
        /* money in: salary is in the budget already and payments from your own account are not income –
           refunds, Vipps from friends and the like count as extra money this month */
        var salary = SALARY.test(x.desc), own = (OWN.test(x.desc) && !/tilbake|refusjon|refund|retur|tilbakebet/i.test(x.desc)) || (card && x.amt < 0 && !/tilbake|refusjon|refund|retur/i.test(x.desc));
        var rin = 'bankin:' + x.date + '|' + amount + '|' + norm(x.desc);
        if (haveIn[rin]) { skipped.dup++; return; }
        if (salary) { skipped.income++; return; }
        out.push({ date: x.date, amount: amount, note: note, desc: x.desc, cat: 'in', ref: rin, on: !own, income: true, transfer: own });
        return;
      }
      var ref = 'bank:' + x.date + '|' + amount + '|' + norm(x.desc);
      if (have[ref] || have[x.date + '|' + Math.round(amount) + '|' + norm(note)]) { skipped.dup++; return; }
      var bill = fixed.filter(function (f) { return f.name && norm(x.desc).indexOf(norm(f.name)) > -1; })[0];
      var transfer = TRANSFER.test(x.desc);
      var mine = bill ? null : manual.filter(function (m) { return !claimed[m.id] && Math.abs(+m.amount - amount) < 1 && Math.abs(dayN(String(m.date).slice(0, 10)) - dayN(x.date)) <= 3; })
        .sort(function (a, b) { return Math.abs(dayN(a.date) - dayN(x.date)) - Math.abs(dayN(b.date) - dayN(x.date)); })[0] || null;
      if (mine) { claimed[mine.id] = 1; skipped.mine = (skipped.mine || 0) + 1; }
      out.push({ date: x.date, amount: amount, note: note, desc: x.desc, cat: bill ? 'fixed' : mine ? mine.cat : guessCat(x.desc, memory), ref: ref, on: !transfer && !mine, bill: bill || null, transfer: transfer, mine: mine });
    });
    out.sort(function (a, b) { return b.date.localeCompare(a.date); });
    return { rows: out, skipped: skipped, memory: memory, card: card, source: rows };
  }

  /* ---------- Excel files (.xlsx): a zip of XML, read without any library ---------- */
  function readXlsx(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf);
    function str(o, n) { return new TextDecoder('utf-8').decode(u8.subarray(o, o + n)); }
    var eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return Promise.reject(new Error('not a zip'));
    var n = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), entries = {};
    for (var k = 0; k < n; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true);
      var name = str(off + 46, nl), lho = dv.getUint32(off + 42, true);
      entries[name] = { method: method, csize: csize, lho: lho };
      off += 46 + nl + el + cl;
    }
    function get(name) {
      var e = entries[name]; if (!e) return Promise.resolve(null);
      var lnl = dv.getUint16(e.lho + 26, true), lel = dv.getUint16(e.lho + 28, true), start = e.lho + 30 + lnl + lel;
      var data = u8.subarray(start, start + e.csize);
      if (e.method === 0) return Promise.resolve(new TextDecoder('utf-8').decode(data));
      if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('This browser can’t open Excel files – export as CSV instead.'));
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }
    var sheet = Object.keys(entries).filter(function (k) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(k); }).sort()[0];
    return Promise.all([get('xl/sharedStrings.xml'), get(sheet)]).then(function (r) {
      var ss = [], xp = new DOMParser();
      if (r[0]) Array.prototype.forEach.call(xp.parseFromString(r[0], 'application/xml').getElementsByTagName('si'), function (si) { ss.push(Array.prototype.map.call(si.getElementsByTagName('t'), function (t) { return t.textContent; }).join('')); });
      if (!r[1]) throw new Error('no sheet');
      var rows = [];
      Array.prototype.forEach.call(xp.parseFromString(r[1], 'application/xml').getElementsByTagName('row'), function (row) {
        var cells = [];
        Array.prototype.forEach.call(row.getElementsByTagName('c'), function (c) {
          var ref = c.getAttribute('r') || '', colIdx = 0, m = ref.match(/^[A-Z]+/);
          if (m) for (var j = 0; j < m[0].length; j++) colIdx = colIdx * 26 + (m[0].charCodeAt(j) - 64);
          var t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('is')[0], val = '';
          if (t === 's' && v) val = ss[+v.textContent] || '';
          else if (t === 'inlineStr' && is) val = is.textContent;
          else if (v) val = v.textContent;
          /* Excel dates are day numbers since 1899-12-30 */
          if (t !== 's' && /^\d{5}(\.\d+)?$/.test(val) && +val > 30000 && +val < 80000) { var dt = new Date(Date.UTC(1899, 11, 30) + Math.round(+val) * 864e5); val = dt.toISOString().slice(0, 10); }
          cells[Math.max(0, colIdx - 1)] = String(val).trim();
        });
        for (var q = 0; q < cells.length; q++) if (cells[q] == null) cells[q] = '';
        if (cells.some(function (x) { return x; })) rows.push(cells);
      });
      return rows;
    });
  }

  /* ---------- the sheet ---------- */
  var bg = document.createElement('div');
  bg.className = 'qa-bg im-bg'; bg.hidden = true;
  bg.innerHTML = '<div class="qa-box im-box" role="dialog" aria-modal="true" aria-label="Import from bank"><div class="qa-handle"></div><div id="imBody"></div></div>';
  document.body.appendChild(bg);
  var file = document.createElement('input'); file.type = 'file'; file.accept = '.csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; file.hidden = true; document.body.appendChild(file);
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'icon-btn sm im-btn'; btn.innerHTML = '<i class="bi bi-upload"></i>';
  btn.setAttribute('aria-label', 'Import from your bank (CSV)'); btn.title = 'Import from your bank (CSV)';
  card.querySelector('.card-head').appendChild(btn);
  var found = null;

  function open(html) { $('imBody').innerHTML = html; bg.hidden = false; document.body.classList.add('qa-open'); requestAnimationFrame(function () { bg.classList.add('open'); }); }
  function close() { bg.classList.remove('open'); document.body.classList.remove('qa-open'); setTimeout(function () { if (!bg.classList.contains('open')) bg.hidden = true; }, 320); }
  function intro() {
    open('<h2 class="im-h"><i class="bi bi-bank"></i> Import from your bank</h2>' +
      '<p class="muted im-p">Export the transactions from your bank account <b>or credit card</b> as <b>CSV or Excel</b> (DNB, Sparebank 1, Nordea and the others have it under the account’s history) and pick the file here. ' +
      'Only what you spent is imported – salary, card payments and transfers are left out – and rows you already have are skipped. Nothing leaves your browser.</p>' +
      '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button type="button" class="pill-btn wide" data-pick><i class="bi bi-file-earmark-arrow-up"></i> Choose file</button></div>');
  }
  function preview(res) {
    found = res;
    var sk = res.skipped, note = [];
    if (sk.dup) note.push(sk.dup + ' already imported');
    if (sk.mine) note.push(sk.mine + ' you logged yourself (left unticked so they don’t count twice)');
    if (sk.income) note.push(sk.income + ' salary (already in your budget)');
    if (sk.bad) note.push(sk.bad + ' unreadable');
    var rows = res.rows, nIn = rows.filter(function (r) { return r.income; }).length, nOut = rows.length - nIn;
    var signRow = '<label class="qa-check im-sign"><input type="checkbox" data-card' + (res.card ? ' checked' : '') + '> Credit card statement (purchases are positive amounts)</label>';
    if (!rows.length) { open('<h2 class="im-h"><i class="bi bi-bank"></i> Nothing new</h2><p class="muted im-p">' + (sk.dup ? 'Every expense in that file is already in Spending' : 'No spending found in that file') + (note.length ? ' (' + note.join(', ') + ')' : '') + '.</p>' + signRow + '<div class="qa-acts"><span class="spacer"></span><button type="button" class="pill-btn wide" data-close>OK</button></div>'); return; }
    var total = rows.filter(function (r) { return r.on && !r.bill; }).reduce(function (a, r) { return a + (r.income ? -r.amount : r.amount); }, 0);
    open('<h2 class="im-h"><i class="bi bi-bank"></i> ' + nOut + ' new expense' + (nOut === 1 ? '' : 's') + (nIn ? ' · ' + nIn + ' in' : '') + '</h2>' +
      '<p class="muted im-p">Check the categories – they’re guessed from the shop’s name and from what you’ve chosen before. A fixed cost (rent, power) isn’t added twice – it ticks the bill as paid instead. Money in (refunds, Vipps from friends) is added to that month’s budget; your own transfers and card payments are left out unless you tick them.' + (note.length ? ' Skipped: ' + note.join(', ') + '.' : '') + '</p>' + signRow +
      '<ul class="im-list">' + rows.map(function (r, i) {
        return '<li class="im-row' + (r.on ? '' : ' off') + (r.income ? ' in' : '') + '"><input type="checkbox" data-i="' + i + '"' + (r.on ? ' checked' : '') + ' aria-label="Import ' + esc(r.note) + '">' +
          '<span class="im-x"><b>' + esc(r.note) + '</b><small>' + esc(new Date(r.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) +
          (r.mine ? ' · <i class="bi bi-person-check"></i> you logged it already: ' + esc(r.mine.note || 'expense') + ', ' + esc(new Date(String(r.mine.date).slice(0, 10) + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) : '') +
          (r.bill ? ' · <i class="bi bi-calendar-check"></i> ' + esc(r.bill.name) + ' – a fixed cost, ticks it as paid' : r.income ? (r.transfer ? ' · from your own account' : ' · adds to this month’s budget') : r.transfer ? ' · transfer' : '') + '</small></span>' +
          '<span class="money">' + (r.income ? '+' : '') + esc(nf.format(r.amount)) + '</span>' +
          (r.bill ? '<span class="im-fixed">Fixed cost</span>' : r.income ? '<span class="im-fixed im-in">Money in</span>' : '<select data-cat="' + i + '" aria-label="Category">' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === r.cat ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select>') + '</li>';
      }).join('') + '</ul>' +
      '<div class="qa-acts im-foot"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><span class="muted" id="imSum">' + esc(nf.format(total)) + '</span><button type="button" class="pill-btn wide" data-import>Import</button></div>');
  }
  function sumLine() {
    var t = 0; found.rows.forEach(function (r) { if (r.on && !r.bill) t += r.income ? -r.amount : r.amount; });
    var s = $('imSum'); if (s) s.textContent = nf.format(t);
  }
  function doImport() {
    var d = window.Vault.get(); d.expenses = d.expenses || []; d.catMemory = d.catMemory || {}; d.paid = d.paid || {}; d.extra = d.extra || [];
    var n = 0, bills = 0, nin = 0, t0 = Date.now();
    found.rows.forEach(function (r, i) {
      /* a purchase you logged yourself: remember the bank row on it, so the next file skips it too */
      if (r.mine && !r.on) { (d.expenses || []).forEach(function (e) { if (e.id === r.mine.id && !e.ref) e.ref = r.ref; }); return; }
      if (!r.on) return;
      if (r.income) { d.extra.push({ id: uid(), date: r.date, amount: r.amount, note: r.note, src: 'bank', ref: r.ref }); nin++; return; }
      if (r.bill) { var k = r.date.slice(0, 7), l = d.paid[k] = d.paid[k] || []; if (l.indexOf(r.bill.id) < 0) l.push(r.bill.id); bills++; return; }
      d.expenses.push({ id: uid(), t: t0 + i, date: r.date, amount: r.amount, cat: r.cat, note: r.note, src: 'bank', ref: r.ref });
      d.catMemory[norm(r.desc)] = r.cat; n++;
    });
    /* keep the memory of merchants small */
    var tn = new Date(); d.lastImport = tn.getFullYear() + '-' + String(tn.getMonth() + 1).padStart(2, '0') + '-' + String(tn.getDate()).padStart(2, '0');
    var keys = Object.keys(d.catMemory); if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(function (k) { delete d.catMemory[k]; });
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
    close();
    if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-check-lg"></i> ' + n + ' expense' + (n === 1 ? '' : 's') + ' imported' + (nin ? ' · ' + nin + ' in' : '') + (bills ? ' · ' + bills + ' bill' + (bills === 1 ? '' : 's') + ' ticked as paid' : ''));
  }

  btn.addEventListener('click', intro);
  bg.addEventListener('click', function (e) {
    if (e.target === bg || e.target.closest('[data-close]')) { close(); return; }
    if (e.target.closest('[data-pick]')) { file.value = ''; file.click(); return; }
    if (e.target.closest('[data-import]')) { doImport(); return; }
  });
  bg.addEventListener('change', function (e) {
    var cb = e.target.closest('input[data-i]');
    if (cb) { found.rows[+cb.dataset.i].on = cb.checked; cb.closest('li').classList.toggle('off', !cb.checked); sumLine(); return; }
    var sel = e.target.closest('select[data-cat]');
    if (sel) { found.rows[+sel.dataset.cat].cat = sel.value; return; }
    var cc = e.target.closest('input[data-card]');
    if (cc && found && found.source) preview(analyse(found.source, { card: cc.checked }));
  });
  file.addEventListener('change', function () {
    var f = file.files && file.files[0]; if (!f) return;
    f.arrayBuffer().then(function (buf) {
      var u8 = new Uint8Array(buf), isZip = u8[0] === 0x50 && u8[1] === 0x4b;
      return isZip ? readXlsx(buf) : decode(buf);
    }).then(function (rows) {
      var res = analyse(rows);
      if (res.error) open('<h2 class="im-h"><i class="bi bi-bank"></i> Couldn’t read that file</h2><p class="muted im-p">' + esc(res.error) + '</p><div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button type="button" class="pill-btn wide" data-pick>Try another file</button></div>');
      else preview(res);
    }).catch(function (e) {
      open('<h2 class="im-h"><i class="bi bi-bank"></i> Couldn’t read that file</h2><p class="muted im-p">' + esc(e && e.message || 'Unknown file') + '. CSV or Excel (.xlsx) from your bank works best.</p><div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button type="button" class="pill-btn wide" data-pick>Try another file</button></div>');
    });
  });
  document.addEventListener('keydown', function (e) { if (!bg.hidden && e.key === 'Escape') close(); });
  window.Vault.onLock(close);
  /* …/finance/#import (from the weekly check-in or search) opens it straight away */
  function fromHash() { if (location.hash === '#import') { history.replaceState(null, '', location.pathname + location.search); setTimeout(intro, 350); } }
  window.Vault.onUnlock(fromHash);
  window.addEventListener('hashchange', fromHash);
  window.BankImport = { analyse: analyse };     // for tests
})();
} catch (e) { console.error("finance/import.js", e); }
/* ===== kit.js ===== */
try {
/* Kit: one building block for the smaller tools – a card with a summary, a list and an
   add/edit sheet generated from a list of fields. Data lives in Features.tools()[key]. */
(function () {
  "use strict";
  var F = window.Features;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function today() { return F.dkey(new Date()); }
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function fmt(k, o) { return k ? F.fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

  /* ---------- one shared sheet ---------- */
  var sheet = null;
  function ensureSheet() {
    if (sheet) return sheet;
    var bg = document.createElement('div');
    bg.className = 'cl-sheet-bg kit-bg'; bg.hidden = true;
    bg.innerHTML = '<form class="cl-sheet kit-sheet" role="dialog" aria-modal="true" autocomplete="off">' +
      '<div class="cl-sheet-head"><button class="text-btn" type="button" data-close>Cancel</button><h2></h2><button class="pill-btn" type="submit">Save</button></div>' +
      '<div class="cl-edit kit-fields"></div><div class="cl-del kit-del" hidden><button class="text-btn danger" type="button"><i class="bi bi-trash3"></i> <span>Delete</span></button></div></form>';
    document.body.appendChild(bg);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bg.hidden) close(); });
    sheet = { bg: bg, form: bg.querySelector('form'), fields: bg.querySelector('.kit-fields'), title: bg.querySelector('h2'), del: bg.querySelector('.kit-del') };
    return sheet;
  }
  function open() {
    var s = ensureSheet();
    s.bg.hidden = false;
    requestAnimationFrame(function () { s.bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
  }
  function close() {
    if (!sheet) return;
    sheet.bg.classList.remove('open');
    document.documentElement.classList.remove('cl-modal');
    setTimeout(function () { sheet.bg.hidden = true; }, 220);
  }

  function input(f, v) {
    var id = 'kf-' + f.k, req = f.req ? ' required' : '', ph = f.ph ? ' placeholder="' + esc(f.ph) + '"' : '';
    var val = v == null ? '' : v;
    if (f.type === 'textarea') return '<textarea id="' + id + '" rows="' + (f.rows || 3) + '"' + ph + req + ' maxlength="' + (f.max || 2000) + '">' + esc(val) + '</textarea>';
    if (f.type === 'select') return '<select id="' + id + '" class="st-wide">' + (typeof f.options === 'function' ? f.options() : f.options).map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select>';
    if (f.type === 'check') return '<input type="checkbox" class="switch" id="' + id + '"' + (val ? ' checked' : '') + '>';
    var t = f.type === 'number' ? 'text" inputmode="decimal' : (f.type || 'text');
    return '<input id="' + id + '" type="' + t + '"' + ph + req + ' maxlength="' + (f.max || 200) + '" value="' + esc(val) + '">';
  }
  function edit(cfg, item) {
    var s = ensureSheet(), isNew = !item;
    item = item ? JSON.parse(JSON.stringify(item)) : {};
    s.title.textContent = isNew ? (cfg.addTitle || 'Add') : (cfg.editTitle || 'Edit');
    var rows = '', inline = '';
    cfg.fields.forEach(function (f) {
      var v = item[f.k] != null ? item[f.k] : (isNew && f.def != null ? (typeof f.def === 'function' ? f.def() : f.def) : '');
      if (f.type === 'title') { rows += '<input class="cl-in-title" id="kf-' + f.k + '" placeholder="' + esc(f.ph || f.label) + '"' + (f.req ? ' required' : '') + ' maxlength="' + (f.max || 120) + '" value="' + esc(v) + '">'; return; }
      var line = '<label class="st-row kit-row' + (f.type === 'textarea' ? ' kit-tall' : '') + '"><span>' + esc(f.label) + '</span>' + input(f, v) + (f.suffix ? '<em>' + esc(f.suffix) + '</em>' : '') + '</label>';
      if (f.type === 'textarea') rows += '<div class="cl-group cl-group-text kit-text"><span class="kit-lbl">' + esc(f.label) + '</span>' + input(f, v) + (f.help ? '<small class="kit-help">' + esc(f.help) + '</small>' : '') + '</div>';
      else rows += '<div class="cl-group">' + line + (f.help ? '<small class="kit-help">' + esc(f.help) + '</small>' : '') + '</div>';
    });
    s.fields.innerHTML = rows;
    s.del.hidden = isNew;
    var delArmed = false;
    s.del.querySelector('span').textContent = 'Delete';
    s.del.querySelector('button').onclick = function () {
      if (!delArmed) { delArmed = true; s.del.querySelector('span').textContent = 'Tap again to delete'; return; }
      var t = F.tools(); t[cfg.key] = (t[cfg.key] || []).filter(function (x) { return x.id !== item.id; });
      if (cfg.onDelete) cfg.onDelete(item);
      F.saveTools(t); close();
    };
    s.form.onsubmit = function (e) {
      e.preventDefault();
      var bad = null;
      cfg.fields.forEach(function (f) {
        var el = document.getElementById('kf-' + f.k);
        if (!el) return;
        var v = f.type === 'check' ? el.checked : el.value.trim();
        if (f.type === 'number') v = v === '' ? '' : (num(v) == null ? (bad = bad || el, '') : num(v));
        if (f.req && (v === '' || v == null)) bad = bad || el;
        item[f.k] = v;
      });
      if (bad) { bad.focus(); bad.classList.add('kit-bad'); return; }
      if (!item.id) item.id = uid();
      if (cfg.beforeSave) cfg.beforeSave(item, isNew);
      var t = F.tools(), l = Array.isArray(t[cfg.key]) ? t[cfg.key] : [];
      var i = l.findIndex(function (x) { return x.id === item.id; });
      if (i > -1) l[i] = item; else l.push(item);
      t[cfg.key] = l;
      F.saveTools(t);
      if (cfg.afterSave) cfg.afterSave(item, isNew);
      close();
    };
    open();
    if (isNew && innerWidth >= 700) setTimeout(function () { var first = s.fields.querySelector('input,textarea'); if (first) first.focus(); }, 60);
  }

  /* ---------- a collection card ---------- */
  function collection(cfg) {
    var el = cfg.mount, showAll = false, openId = null, scrolled = false;
    if (!el) return null;
    function render() {
      var on = F.on(cfg.feature);
      el.hidden = !on;
      if (!on) { el.innerHTML = ''; return; }
      var items = F.list(cfg.key).slice();
      if (cfg.sort) items.sort(cfg.sort);
      var lim = cfg.limit || 8, shown = showAll ? items : items.slice(0, lim);
      el.innerHTML = '<section class="card kit-card" id="' + cfg.key + '">' +
        '<div class="card-head"><h2><i class="bi bi-' + cfg.icon + '"></i> ' + esc(cfg.title) + '</h2>' +
        '<div class="head-actions">' + (cfg.headExtra ? cfg.headExtra(items) : '') + '<button class="text-btn" type="button" data-kit-add><i class="bi bi-plus-lg"></i> ' + esc(cfg.addLabel || 'Add') + '</button></div></div>' +
        (cfg.summary ? '<div class="kit-sum">' + cfg.summary(items) + '</div>' : '') +
        (cfg.above ? cfg.above(items) : '') +
        (items.length ? '<ul class="kit-list">' + shown.map(function (it) {
          var r = cfg.row(it);
          return '<li class="kit-item' + (r.cls ? ' ' + r.cls : '') + (openId === it.id ? ' open' : '') + '" data-id="' + esc(it.id) + '">' +
            '<button type="button" class="kit-main" data-kit-' + (cfg.detail ? 'toggle' : 'edit') + '="' + esc(it.id) + '">' +
            (r.icon ? '<span class="kit-ic" style="--c:' + (r.color || 'var(--accent)') + '"><i class="bi bi-' + r.icon + '"></i></span>' : '') +
            '<span class="kit-x"><b>' + esc(r.title) + '</b>' + (r.sub ? '<small>' + r.sub + '</small>' : '') + '</span>' +
            (r.right ? '<span class="kit-r">' + r.right + '</span>' : '') + '</button>' +
            (cfg.detail && openId === it.id ? '<div class="kit-detail">' + cfg.detail(it) + '<button type="button" class="text-btn" data-kit-edit="' + esc(it.id) + '"><i class="bi bi-pencil"></i> Edit</button></div>' : '') +
            '</li>';
        }).join('') + '</ul>' : '<p class="empty kit-empty">' + esc(cfg.empty || 'Nothing here yet.') + '</p>') +
        (items.length > lim ? '<button class="text-btn kit-more" type="button" data-kit-more>' + (showAll ? 'Show less' : 'Show all ' + items.length) + '</button>' : '') +
        '</section>';
      if (cfg.afterRender) cfg.afterRender(el, items);
      /* arriving from a calendar reminder (…/#subs): scroll to the card once */
      if (!scrolled && location.hash === '#' + cfg.key && document.documentElement.classList.contains('unlocked')) {
        scrolled = true;
        /* wait until the rest of the page has drawn (charts, lists), then scroll */
        setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 450);
      }
    }
    el.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-kit-add]')) return edit(cfg, null);
      if ((b = e.target.closest('[data-kit-edit]'))) return edit(cfg, F.list(cfg.key).filter(function (x) { return x.id === b.dataset.kitEdit; })[0]);
      if ((b = e.target.closest('[data-kit-toggle]'))) { openId = openId === b.dataset.kitToggle ? null : b.dataset.kitToggle; return render(); }
      if (e.target.closest('[data-kit-more]')) { showAll = !showAll; return render(); }
      if (cfg.onClick) cfg.onClick(e, render);
    });
    window.addEventListener('tools:change', render);
    window.addEventListener('features:change', render);
    var prevReload = window.Dash && window.Dash.reload;
    window.Dash = window.Dash || {};
    window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
    if (window.Vault) window.Vault.onUnlock(render);
    return { render: render, edit: function (it) { edit(cfg, it); } };
  }

  window.Kit = { collection: collection, edit: edit, close: close, esc: esc, uid: uid, num: num, kr: kr, fmt: fmt, today: today };
})();
} catch (e) { console.error("kit.js", e); }
/* ===== tools.js ===== */
try {
/* The optional tools (Settings → Features). Each one mounts into a [data-tool="…"]
   container on the page where it belongs:
   Work page:      flex time, meeting notes, courses & certificates
   Habits page:    training log, journal
   Travel page:    places to visit
   Finance page:   subscriptions, warranties & receipts
   Dashboard:      a small "Work today" card for flex time */
(function () {
  "use strict";
  var F = window.Features, K = window.Kit;
  if (!F || !K) return;
  var esc = K.esc, today = K.today, fmt = K.fmt, kr = K.kr;
  function $t(name) { return document.querySelector('[data-tool="' + name + '"]'); }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
  function addDays(k, n) { var d = F.fromKey(k); d.setDate(d.getDate() + n); return F.dkey(d); }
  function tile(label, value, sub) { return '<div class="kit-tile" data-tk="' + String(label).replace(/\b(19|20)\d\d\b/g, 'Y').replace(/"/g, '') + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function hm(min) {
    var neg = min < 0; min = Math.abs(Math.round(min));
    var h = Math.floor(min / 60), m = min % 60;
    return (neg ? '−' : '') + (h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min');
  }
  /* short form for the number tiles: 15 h 26 → "15h 26m" */
  function hms(min) {
    var neg = min < 0; min = Math.abs(Math.round(min));
    var h = Math.floor(min / 60), m = min % 60;
    return (neg ? '−' : '') + (h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm');
  }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function nowHM() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  /* ================= WORK: flex time ================= */
  var FLEX_TYPES = { work: 'Work', vacation: 'Holiday (ferie)', sick: 'Sick', flexoff: 'Flex day off (avspasering)', holiday: 'Public holiday', course: 'Course / travel' };
  function flexCfg() { var c = F.tools().flexcfg || {}; return { norm: +c.norm || 7.5, vacation: +c.vacation || 25 }; }
  function worked(e, isToday) {
    if (e.type !== 'work' && e.type !== 'course') return 0;
    var a = toMin(e.in), b = toMin(e.out);
    if (a == null) return 0;
    if (b == null) { if (!isToday) return 0; b = toMin(nowHM()); }
    var w = b - a; if (w < 0) w += 1440;
    return Math.max(0, w - (+e.brk || 0));
  }
  function flexDays() {
    var by = {}, td = today();
    F.list('flex').forEach(function (e) { (by[e.date] = by[e.date] || []).push(e); });
    var norm = flexCfg().norm * 60;
    return Object.keys(by).sort().map(function (k) {
      var es = by[k], open = es.some(function (e) { return (e.type === 'work' || e.type === 'course') && e.in && !e.out; });
      var w = es.reduce(function (a, e) { return a + worked(e, k === td); }, 0);
      var free = es.some(function (e) { return e.type === 'vacation' || e.type === 'sick' || e.type === 'holiday'; });
      var hol = F.holiday(k) && F.fromKey(k).getDay() % 6 !== 0;   // public holiday on a weekday: all work is extra
      var delta = free ? 0 : hol ? w : w - norm;
      return { date: k, entries: es, worked: w, delta: delta, open: open, free: free };
    });
  }
  function flexStats() {
    var days = flexDays(), td = today(), y = td.slice(0, 4), mon = F.dkey(monday(new Date()));
    var balance = days.filter(function (d) { return d.date < td || (d.date === td && !d.open); }).reduce(function (a, d) { return a + d.delta; }, 0);
    var t = days.filter(function (d) { return d.date === td; })[0];
    var week = days.filter(function (d) { return d.date >= mon && d.date <= td; });
    var weekWorked = week.reduce(function (a, d) { return a + d.worked; }, 0);
    var wd = Math.min(5, ((new Date().getDay() + 6) % 7) + 1), off = {};
    week.forEach(function (d) { if (d.free) off[d.date] = 1; });
    for (var i = 0; i < wd; i++) { var hk = addDays(mon, i); if (F.holiday(hk)) off[hk] = 1; }
    var weekFree = Object.keys(off).filter(function (k) { var g = F.fromKey(k).getDay(); return g > 0 && g < 6; }).length;
    var weekTarget = Math.max(0, wd - weekFree) * flexCfg().norm * 60;
    var vac = F.list('flex').filter(function (e) { return e.type === 'vacation' && String(e.date).slice(0, 4) === y; }).length;
    var openE = F.list('flex').filter(function (e) { return e.date === td && (e.type === 'work' || e.type === 'course') && e.in && !e.out; })[0];
    return { balance: balance, today: t ? t.worked : 0, open: openE, week: weekWorked, weekTarget: weekTarget, vac: vac };
  }
  function clock() {
    var t = F.tools(), l = Array.isArray(t.flex) ? t.flex : [], td = today();
    var open = l.filter(function (e) { return e.date === td && e.in && !e.out && e.type === 'work'; })[0];
    if (open) open.out = nowHM();
    else l.push({ id: K.uid(), date: td, type: 'work', in: nowHM(), out: '', brk: l.some(function (e) { return e.date === td && e.type === 'work'; }) ? 0 : (+(t.flexcfg || {}).brk || 0) });
    t.flex = l;
    F.saveTools(t);
  }
  function clockBlock(s) {
    return '<div class="flex-clock">' +
      '<div class="fc-now"><span class="fc-dot' + (s.open ? ' on' : '') + '"></span><span>' + (s.open ? 'Clocked in at <b>' + esc(s.open.in) + '</b>' : 'Not clocked in') + '</span></div>' +
      '<b class="fc-time" data-flex-live>' + hm(s.today) + '</b><small>today</small>' +
      '<button type="button" class="pill-btn fc-btn' + (s.open ? ' out' : '') + '" data-flex-clock><i class="bi bi-' + (s.open ? 'stop-fill' : 'play-fill') + '"></i> ' + (s.open ? 'Clock out' : 'Clock in') + '</button></div>';
  }
  var flex = K.collection({
    mount: $t('flex'), feature: 'flex', key: 'flex', title: 'Flex time', icon: 'stopwatch', addLabel: 'Add day',
    addTitle: 'Add a day', editTitle: 'Edit day', limit: 6,
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'type', label: 'Type', type: 'select', options: Object.keys(FLEX_TYPES).map(function (k) { return [k, FLEX_TYPES[k]]; }), def: 'work' },
      { k: 'in', label: 'In', type: 'time' }, { k: 'out', label: 'Out', type: 'time' },
      { k: 'brk', label: 'Unpaid break', type: 'number', suffix: 'min', def: 0, help: 'Only if lunch is not part of your paid time.' },
      { k: 'note', label: 'Note', type: 'textarea', rows: 2 }
    ],
    sort: function (a, b) { return (b.date + (b.in || '')) > (a.date + (a.in || '')) ? 1 : -1; },
    summary: function () {
      var s = flexStats(), c = flexCfg();
      return clockBlock(s) + '<div class="kit-tiles">' +
        tile('Flex balance', '<span class="' + (s.balance < 0 ? 'neg' : 'pos') + '">' + (s.balance > 0 ? '+' : '') + hms(s.balance) + '</span>', 'logged days') +
        tile('This week', hms(s.week), 'of ' + hms(s.weekTarget)) +
        tile('Holiday ' + today().slice(0, 4), s.vac + ' <small>/ ' + c.vacation + '</small>', 'days used') + '</div>';
    },
    row: function (e) {
      var isT = e.date === today(), w = worked(e, isT), lbl = FLEX_TYPES[e.type] || 'Work';
      return { icon: e.type === 'vacation' ? 'sun' : e.type === 'sick' ? 'thermometer-half' : e.type === 'flexoff' ? 'cup-hot' : e.type === 'holiday' ? 'flag' : 'briefcase',
        color: e.type === 'work' || e.type === 'course' ? '#e8743b' : '#7a8794',
        title: fmt(e.date, { weekday: 'short', day: 'numeric', month: 'short' }) + (e.type !== 'work' ? ' · ' + lbl : ''),
        sub: (e.in ? esc(e.in) + '–' + (e.out ? esc(e.out) : 'now') : '') + (e.brk ? ' · ' + e.brk + ' min break' : '') + (e.note ? ' · ' + esc(e.note) : ''),
        right: e.type === 'work' || e.type === 'course' ? hm(w) : '' };
    },
    empty: 'Tap “Clock in” when you start, “Clock out” when you leave. Holidays and flex days off go in with “Add day”.',
    afterRender: function (el) {
      var c = flexCfg();
      el.querySelector('.kit-card').insertAdjacentHTML('beforeend', '<p class="kit-foot">Normal day ' + String(c.norm).replace('.', ',') + ' h · ' + c.vacation + ' holiday days a year · <a href="/cmd/?settings=work">Change</a></p>' +
        '<div class="fr-bar"><span class="muted"><i class="bi bi-file-earmark-text"></i> Monthly report</span><select class="fr-month" aria-label="Month for the report">' + reportMonths() + '</select>' +
        '<button type="button" class="text-btn" data-frcsv>CSV</button><button type="button" class="text-btn" data-frpdf>PDF</button></div>');
    },
    onClick: function (e) {
      if (e.target.closest('[data-flex-clock]')) clock();
      var m = e.target.closest('.kit-card') && e.target.closest('.kit-card').querySelector('.fr-month');
      if (e.target.closest('[data-frcsv]') && m) reportCsv(m.value);
      if (e.target.closest('[data-frpdf]') && m) reportPdf(m.value);
    }
  });

  /* ---------- monthly report: every day, hours, flex and days off – CSV or a printable page (Save as PDF) ---------- */
  function reportMonths() {
    var out = '', d = new Date(), have = {};
    F.list('flex').forEach(function (e) { have[String(e.date).slice(0, 7)] = 1; });
    for (var i = 0; i < 13; i++) {
      var x = new Date(d.getFullYear(), d.getMonth() - i, 1), k = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
      if (i > 0 && !have[k]) continue;
      out += '<option value="' + k + '">' + x.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + '</option>';
    }
    return out;
  }
  function report(ym) {
    var c = flexCfg(), days = flexDays(), inM = days.filter(function (d) { return d.date.slice(0, 7) === ym; });
    var end = ym + '-31', bal = days.filter(function (d) { return d.date <= end && !d.open; }).reduce(function (a, d) { return a + d.delta; }, 0);
    var rows = [];
    inM.forEach(function (d) {
      d.entries.forEach(function (e) {
        rows.push({ date: d.date, wd: F.fromKey(d.date).toLocaleDateString('en-GB', { weekday: 'short' }), type: FLEX_TYPES[e.type] || 'Work', in: e.in || '', out: e.out || '', brk: +e.brk || 0, worked: worked(e, false), note: e.note || '' });
      });
    });
    var tot = inM.reduce(function (a, d) { return a + d.worked; }, 0), delta = inM.reduce(function (a, d) { return a + d.delta; }, 0);
    var count = function (t) { return F.list('flex').filter(function (e) { return e.type === t && String(e.date).slice(0, 7) === ym; }).length; };
    return { ym: ym, name: new Date(ym + '-15').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), rows: rows, total: tot, delta: delta, balance: bal, norm: c.norm,
      vacation: count('vacation'), sick: count('sick'), flexoff: count('flexoff'), days: inM.filter(function (d) { return d.worked > 0; }).length };
  }
  function hmPlain(m) { var s = m < 0 ? '-' : ''; m = Math.abs(Math.round(m)); return s + Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }
  function download(name, type, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function reportCsv(ym) {
    var r = report(ym), q = function (v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['Date', 'Day', 'Type', 'In', 'Out', 'Break (min)', 'Worked (h:mm)', 'Note'].join(';')]
      .concat(r.rows.map(function (x) { return [x.date, x.wd, x.type, x.in, x.out, x.brk, hmPlain(x.worked), x.note].map(q).join(';'); }))
      .concat(['', 'Total worked;' + hmPlain(r.total), 'Flex this month;' + hmPlain(r.delta), 'Flex balance at month end;' + hmPlain(r.balance),
        'Holiday days;' + r.vacation, 'Sick days;' + r.sick, 'Flex days off;' + r.flexoff, 'Normal day (h);' + String(r.norm).replace('.', ',')]);
    download('flex-' + ym + '.csv', 'text/csv;charset=utf-8', '\ufeff' + lines.join('\r\n'));
  }
  function reportPdf(ym) {
    var r = report(ym), me = (function () { try { return JSON.parse(localStorage.getItem('dash.profile')) || {}; } catch (e) { return {}; } })();
    var html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Flex time ' + esc(r.name) + '</title><style>' +
      'body{font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:32px auto;max-width:760px;padding:0 20px}h1{font-size:22px;margin:0 0 2px}p.s{color:#555;margin:0 0 18px}' +
      'table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd}th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#555}td.n{text-align:right;font-variant-numeric:tabular-nums}' +
      '.sum{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.sum div{border:1px solid #ddd;border-radius:8px;padding:10px}.sum b{display:block;font-size:18px}.sum span{font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.04em}' +
      '.tip{color:#555;font-size:12px;margin-top:24px}.wrap{overflow-x:auto}@media (max-width:600px){body{margin:20px auto}th,td{padding:5px 4px;font-size:12px}.sum b{font-size:16px}}@media print{.tip{display:none}body{margin:0 auto}}</style></head><body>' +
      '<h1>Flex time – ' + esc(r.name) + '</h1><p class="s">' + esc(me.name || 'John Paul Lundberg') + (me.employer ? ' · ' + esc(me.employer) : '') + ' · normal day ' + String(r.norm).replace('.', ',') + ' h</p>' +
      '<div class="sum"><div><span>Worked</span><b>' + hmPlain(r.total) + '</b>' + r.days + ' days</div><div><span>Flex this month</span><b>' + (r.delta > 0 ? '+' : '') + hmPlain(r.delta) + '</b>balance ' + (r.balance > 0 ? '+' : '') + hmPlain(r.balance) + '</div>' +
      '<div><span>Days off</span><b>' + r.vacation + '</b>holiday · ' + r.sick + ' sick · ' + r.flexoff + ' flex</div></div>' +
      '<div class="wrap"><table><thead><tr><th>Date</th><th>Type</th><th>In</th><th>Out</th><th class="n">Break</th><th class="n">Worked</th><th>Note</th></tr></thead><tbody>' +
      (r.rows.length ? r.rows.map(function (x) { return '<tr><td>' + esc(x.wd + ' ' + x.date.slice(8) + '.' + x.date.slice(5, 7)) + '</td><td>' + esc(x.type) + '</td><td>' + esc(x.in) + '</td><td>' + esc(x.out) + '</td><td class="n">' + (x.brk ? x.brk + ' min' : '') + '</td><td class="n">' + (x.worked ? hmPlain(x.worked) : '') + '</td><td>' + esc(x.note) + '</td></tr>'; }).join('') : '<tr><td colspan="7">Nothing logged this month.</td></tr>') +
      '</tbody></table></div><p class="tip">Use Print → Save as PDF (on iPhone: Share → Print, then pinch out on the preview to get the PDF).</p>' +
      '<script>setTimeout(function(){try{window.print()}catch(e){}},400)<\/script></body></html>';
    var w = null;
    try { w = window.open('', '_blank'); } catch (e) {}
    if (w && w.document) { w.document.open(); w.document.write(html); w.document.close(); }
    else download('flex-' + ym + '.html', 'text/html;charset=utf-8', html);
  }
  document.addEventListener('change', function (e) {
    var k = e.target.dataset && e.target.dataset.flexcfg;
    if (!k) return;
    var v = K.num(e.target.value);
    if (v == null || v <= 0) return;
    var t = F.tools(); t.flexcfg = t.flexcfg || {}; t.flexcfg[k] = v; F.saveTools(t);
  });
  /* keep the running time fresh */
  setInterval(function () {
    if (!F.on('flex')) return;
    var s = flexStats();
    if (!s.open) return;
    document.querySelectorAll('[data-flex-live]').forEach(function (el) { el.textContent = hm(s.today); });
  }, 30000);

  /* Dashboard card: Work today */
  var home = document.getElementById('flexCard');
  function renderHome() {
    if (!home) return;
    var on = F.on('flex');
    home.hidden = !on;
    if (!on) return;
    var s = flexStats();
    home.innerHTML = '<div class="card-head"><h2><i class="bi bi-stopwatch"></i> Work today</h2><a class="text-btn" href="work/">Details</a></div>' +
      clockBlock(s) + '<p class="fc-bal">Flex balance <b class="' + (s.balance < 0 ? 'neg' : 'pos') + '">' + (s.balance > 0 ? '+' : '') + hm(s.balance) + '</b> · this week ' + hm(s.week) + '</p>';
  }
  if (home) {
    home.addEventListener('click', function (e) { if (e.target.closest('[data-flex-clock]')) clock(); });
    window.addEventListener('tools:change', renderHome);
    window.addEventListener('features:change', renderHome);
    if (window.Vault) window.Vault.onUnlock(renderHome);
  }

  /* ================= WORK: meeting notes ================= */
  K.collection({
    mount: $t('meetings'), feature: 'meetings', key: 'meetings', title: 'Meeting notes', icon: 'people', addLabel: 'New',
    addTitle: 'New meeting note', editTitle: 'Edit meeting note',
    fields: [
      { k: 'title', type: 'title', label: 'Title', ph: 'Meeting, e.g. Status FDVU handover', req: true },
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'who', label: 'With', ph: 'Who was there' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 6 },
      { k: 'actions', label: 'Action points', type: 'textarea', rows: 3, help: 'One per line. Tick them off here or send them to your to-do list.' }
    ],
    beforeSave: function (it) { it.done = it.done || {}; },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    row: function (m) {
      var acts = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); }), done = acts.filter(function (_, i) { return (m.done || {})[i]; }).length;
      return { icon: 'people', color: '#3987e5', title: m.title || 'Meeting', sub: fmt(m.date) + (m.who ? ' · ' + esc(m.who) : '') + (acts.length ? ' · ' + done + '/' + acts.length + ' actions' : ''),
        cls: acts.length && done < acts.length ? 'has-open' : '' };
    },
    detail: function (m) {
      var acts = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); });
      return (m.notes ? '<p class="kit-notes">' + esc(m.notes) + '</p>' : '') +
        (acts.length ? '<ul class="kit-checks">' + acts.map(function (a, i) {
          var d = (m.done || {})[i];
          return '<li class="' + (d ? 'done' : '') + '"><label><input type="checkbox" data-mact="' + esc(m.id) + ':' + i + '"' + (d ? ' checked' : '') + '><span>' + esc(a) + '</span></label>' +
            '<button type="button" class="text-btn" data-mtodo="' + esc(m.id) + ':' + i + '"><i class="bi bi-box-arrow-in-right"></i> To-do</button></li>';
        }).join('') + '</ul>' : '');
    },
    empty: 'Write down what was decided and who does what. Action points can go straight to your to-do list.',
    onClick: function (e, render) {
      var b = e.target.closest('[data-mtodo]');
      if (!b) return;
      var p = b.dataset.mtodo.split(':'), m = F.list('meetings').filter(function (x) { return x.id === p[0]; })[0];
      if (!m) return;
      var text = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); })[+p[1]];
      var todos = readJSON('dash.todos') || [];
      todos.push({ id: K.uid(), text: text.trim() + (m.title ? ' (' + m.title + ')' : ''), done: false });
      writeJSON('dash.todos', todos);
      b.innerHTML = '<i class="bi bi-check2"></i> Added';
      b.disabled = true;
    }
  });
  document.addEventListener('change', function (e) {
    var a = e.target.dataset && e.target.dataset.mact;
    if (!a) return;
    var p = a.split(':'), t = F.tools();
    (t.meetings || []).forEach(function (m) { if (m.id === p[0]) { m.done = m.done || {}; if (e.target.checked) m.done[p[1]] = true; else delete m.done[p[1]]; } });
    F.saveTools(t);
  });

  /* ================= WORK: courses & certificates ================= */
  var KINDS = [['course', 'Course'], ['certificate', 'Certificate'], ['book', 'Book'], ['standard', 'Standard / regulation'], ['other', 'Other']];
  var KIND_ICON = { course: 'mortarboard', certificate: 'award', book: 'book', standard: 'file-earmark-text', other: 'lightbulb' };
  var STATUS = [['planned', 'Planned'], ['progress', 'In progress'], ['done', 'Done']];
  function expiryBadge(k) {
    if (!k) return '';
    var days = Math.round((F.fromKey(k) - F.fromKey(today())) / 864e5);
    if (days < 0) return '<span class="kit-badge bad">Expired</span>';
    if (days < 183) return '<span class="kit-badge warn">Expires ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
    return '<span class="kit-badge">Until ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
  }
  K.collection({
    mount: $t('learning'), feature: 'learning', key: 'learning', title: 'Courses & certificates', icon: 'mortarboard',
    addTitle: 'Add course or certificate',
    fields: [
      { k: 'title', type: 'title', label: 'Title', ph: 'e.g. Varme arbeider, NS 3456, Plania advanced', req: true },
      { k: 'kind', label: 'Type', type: 'select', options: KINDS, def: 'course' },
      { k: 'provider', label: 'From', ph: 'Provider or author' },
      { k: 'status', label: 'Status', type: 'select', options: STATUS, def: 'planned' },
      { k: 'date', label: 'Date', type: 'date', help: 'When you took it or plan to.' },
      { k: 'expires', label: 'Expires', type: 'date', help: 'For certificates that must be renewed – you get a reminder in your calendar 2 months before.' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
    ],
    sort: function (a, b) { var o = { progress: 0, planned: 1, done: 2 }; return (o[a.status] - o[b.status]) || ((b.date || '') > (a.date || '') ? 1 : -1); },
    summary: function (items) {
      var y = today().slice(0, 4);
      var done = items.filter(function (c) { return c.status === 'done' && String(c.date || '').slice(0, 4) === y; }).length;
      var prog = items.filter(function (c) { return c.status === 'progress'; }).length;
      var soon = items.filter(function (c) { return c.expires && c.expires < F.addMonths(today(), 6); }).length;
      return items.length ? '<div class="kit-tiles">' + tile('Done in ' + y, done) + tile('In progress', prog) + tile('Expiring soon', '<span class="' + (soon ? 'neg' : '') + '">' + soon + '</span>', 'within 6 months') + '</div>' : '';
    },
    row: function (c) {
      return { icon: KIND_ICON[c.kind] || 'lightbulb', color: '#8a6fdf', title: c.title, cls: c.status === 'done' ? 'is-done' : '',
        sub: [c.provider ? esc(c.provider) : '', (STATUS.filter(function (s) { return s[0] === c.status; })[0] || ['', ''])[1], c.date ? fmt(c.date, { month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · '),
        right: expiryBadge(c.expires) };
    },
    empty: 'Courses you want to take, certificates that need renewing (like varme arbeider or first aid), and standards you’re reading up on.'
  });

  /* ================= HABITS: training log ================= */
  var SPORTS = [['strength', 'Strength', 'trophy'], ['run', 'Running', 'person-walking'], ['walk', 'Walking', 'person-walking'], ['bike', 'Cycling', 'bicycle'],
    ['swim', 'Swimming', 'water'], ['ball', 'Ball sports', 'dribbble'], ['yoga', 'Yoga / mobility', 'person-arms-up'], ['other', 'Other', 'heart-pulse']];
  var EFFORT = [['1', 'Easy'], ['2', 'Light'], ['3', 'Moderate'], ['4', 'Hard'], ['5', 'All out']];
  function habitOptions() {
    var hb = readJSON('dash.habits') || { list: [] };
    return [['', 'Don’t tick a habit']].concat((hb.list || []).map(function (h) { return [h.id, 'Tick “' + h.name + '”']; }));
  }
  function defaultHabit() {
    var hb = readJSON('dash.habits') || { list: [] };
    var h = (hb.list || []).filter(function (x) { return /train|trening|gym|workout|løp|run|exercise/i.test(x.name); })[0];
    return h ? h.id : '';
  }
  K.collection({
    mount: $t('training'), feature: 'training', key: 'training', title: 'Training log', icon: 'heart-pulse', addLabel: 'Log workout',
    addTitle: 'Log a workout', editTitle: 'Edit workout',
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'kind', label: 'Type', type: 'select', options: SPORTS.map(function (s) { return [s[0], s[1]]; }), def: 'strength' },
      { k: 'min', label: 'Time', type: 'number', suffix: 'min', req: true, def: 60 },
      { k: 'km', label: 'Distance', type: 'number', suffix: 'km' },
      { k: 'effort', label: 'How hard', type: 'select', options: EFFORT, def: '3' },
      { k: 'habit', label: 'Habit', type: 'select', options: habitOptions, def: defaultHabit },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, help: 'Exercises, weights, how it felt.' }
    ],
    afterSave: function (w) {
      if (!w.habit) return;
      var hb = readJSON('dash.habits') || { list: [], log: {} };
      hb.log = hb.log || {};
      var l = hb.log[w.date] = hb.log[w.date] || [];
      if (l.indexOf(w.habit) < 0) { l.push(w.habit); writeJSON('dash.habits', hb); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
    },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    summary: function (items) {
      var mon = F.dkey(monday(new Date())), m = today().slice(0, 7);
      var wk = items.filter(function (w) { return w.date >= mon; }), mo = items.filter(function (w) { return String(w.date).slice(0, 7) === m; });
      var sum = function (l, k) { return l.reduce(function (a, w) { return a + (+w[k] || 0); }, 0); };
      return '<div class="kit-tiles">' + tile('This week', wk.length + ' <small>sessions</small>', hms(sum(wk, 'min'))) +
        tile('This month', mo.length + ' <small>sessions</small>', hms(sum(mo, 'min'))) +
        tile('Distance this month', (Math.round(sum(mo, 'km') * 10) / 10).toString().replace('.', ',') + ' <small>km</small>') + '</div>';
    },
    row: function (w) {
      var s = SPORTS.filter(function (x) { return x[0] === w.kind; })[0] || SPORTS[7];
      return { icon: s[2], color: '#d55181', title: s[1], sub: fmt(w.date, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + hm(+w.min || 0) + (w.km ? ' · ' + String(w.km).replace('.', ',') + ' km' : '') + (w.notes ? ' · ' + esc(String(w.notes).slice(0, 60)) : ''),
        right: '<span class="kit-dots">' + [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= +w.effort ? 'on' : '') + '"></i>'; }).join('') + '</span>' };
    },
    empty: 'Log a workout and it also ticks your training habit for that day.'
  });

  /* ================= HEALTH: check-ups, vaccines, medicine ================= */
  var HKINDS = [['checkup', 'Appointment / check-up'], ['vaccine', 'Vaccine'], ['medicine', 'Medicine / prescription']];
  var HICON = { checkup: 'clipboard2-pulse', vaccine: 'shield-plus', medicine: 'capsule' };
  var HNEXT = { checkup: 'Next check-up', vaccine: 'Booster due', medicine: 'Renew by' };
  function dueBadge(k, word) {
    if (!k) return '';
    var days = Math.round((F.fromKey(k) - F.fromKey(today())) / 864e5);
    if (days < 0) return '<span class="kit-badge bad">' + word + ' overdue</span>';
    if (days <= 60) return '<span class="kit-badge warn">' + word + ' ' + fmt(k, { day: 'numeric', month: 'short' }) + '</span>';
    return '<span class="kit-badge">' + word + ' ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
  }
  K.collection({
    mount: $t('health'), feature: 'health', key: 'health', title: 'Check-ups & medicine', icon: 'clipboard2-pulse',
    addTitle: 'Add to health', editTitle: 'Edit',
    fields: [
      { k: 'title', type: 'title', label: 'What', ph: 'e.g. Dentist, Tetanus booster, Allergy pills', req: true },
      { k: 'kind', label: 'Type', type: 'select', options: HKINDS, def: 'checkup' },
      { k: 'date', label: 'Date', type: 'date', def: today, help: 'The appointment, when you took the vaccine, or when it was prescribed.' },
      { k: 'time', label: 'Time', type: 'time', help: 'For appointments – it goes in your calendar.' },
      { k: 'where', label: 'Where / who', ph: 'Clinic, doctor, pharmacy' },
      { k: 'next', label: 'Next / renew by', type: 'date', help: 'Next check-up, when a booster is due, or when the prescription runs out. You get a reminder in your calendar.' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, help: 'Dose, what was said, questions for next time …' }
    ],
    sort: function (a, b) {
      var ka = a.kind === 'checkup' && a.date >= today() ? a.date : (a.next || '9999'), kb = b.kind === 'checkup' && b.date >= today() ? b.date : (b.next || '9999');
      return ka > kb ? 1 : ka < kb ? -1 : 0;
    },
    summary: function (items) {
      if (!items.length) return '';
      var td = today();
      var up = items.filter(function (h) { return h.kind === 'checkup' && h.date >= td; }).sort(function (a, b) { return a.date > b.date ? 1 : -1; })[0];
      var due = items.filter(function (h) { return h.next && h.next <= F.addMonths(td, 2); }).length;
      var vac = items.filter(function (h) { return h.kind === 'vaccine'; }).length;
      return '<div class="kit-tiles">' + tile('Next appointment', up ? fmt(up.date, { weekday: 'short', day: 'numeric', month: 'short' }) : '–', up ? esc(up.title) + (up.time ? ' · ' + esc(up.time) : '') : 'nothing booked') +
        tile('Due soon', '<span class="' + (due ? 'neg' : '') + '">' + due + '</span>', 'within 2 months') + tile('Vaccines', vac, 'on record') + '</div>';
    },
    row: function (h) {
      var past = h.kind === 'checkup' && h.date && h.date < today();
      return { icon: HICON[h.kind] || 'clipboard2-pulse', color: '#e66767', title: h.title,
        sub: [{ checkup: 'Check-up', vaccine: 'Vaccine', medicine: 'Medicine' }[h.kind] || '', h.date ? fmt(h.date) + (h.time && !past ? ' ' + esc(h.time) : '') : '', h.where ? esc(h.where) : ''].filter(Boolean).join(' · '),
        right: dueBadge(h.next, h.kind === 'medicine' ? 'Renew' : h.kind === 'vaccine' ? 'Booster' : 'Next') };
    },
    empty: 'Doctor and dentist appointments, vaccines (useful before trips) and prescriptions. You get reminders in your calendar before things are due.'
  });

  /* ================= HABITS: journal ================= */
  var MOODS = [['1', 'Bad', 'emoji-frown', '#e66767'], ['2', 'Meh', 'emoji-neutral', '#e8743b'], ['3', 'OK', 'emoji-smile', '#c9a227'], ['4', 'Good', 'emoji-laughing', '#22b35e'], ['5', 'Great', 'emoji-heart-eyes', '#14b8a6']];
  function mood(v) { return MOODS.filter(function (m) { return m[0] === String(v); })[0] || MOODS[2]; }
  K.collection({
    mount: $t('journal'), feature: 'journal', key: 'journal', title: 'Journal', icon: 'journal-bookmark', addLabel: 'Today',
    addTitle: 'Journal', editTitle: 'Journal', limit: 7,
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'mood', label: 'Mood', type: 'select', options: MOODS.map(function (m) { return [m[0], m[1]]; }), def: '4' },
      { k: 'line', type: 'title', label: 'Today in one line', ph: 'Today in one sentence', req: true, max: 200 },
      { k: 'notes', label: 'More (optional)', type: 'textarea', rows: 4 }
    ],
    beforeSave: function (it) {    /* one entry per day */
      var t = F.tools();
      t.journal = (t.journal || []).filter(function (x) { return x.date !== it.date || x.id === it.id; });
      F.saveTools(t);
    },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    summary: function (items) {
      var by = {}; items.forEach(function (j) { by[j.date] = j; });
      var cells = '', t = today();
      for (var i = 27; i >= 0; i--) {
        var k = addDays(t, -i), j = by[k];
        cells += '<i title="' + fmt(k, { weekday: 'short', day: 'numeric', month: 'short' }) + (j ? ': ' + mood(j.mood)[1] : '') + '" style="' + (j ? 'background:' + mood(j.mood)[3] : '') + '"></i>';
      }
      var streak = 0; for (var d = 0; d < 400; d++) { if (by[addDays(t, -d)]) streak++; else if (d > 0) break; }
      var last7 = items.filter(function (j) { return j.date > addDays(t, -7); });
      var avg = last7.length ? last7.reduce(function (a, j) { return a + (+j.mood || 0); }, 0) / last7.length : 0;
      return '<div class="kit-mood">' + cells + '</div><p class="kit-moodlbl">Last 4 weeks' + (streak ? ' · ' + streak + ' day' + (streak > 1 ? 's' : '') + ' in a row' : '') + (avg ? ' · this week: ' + mood(Math.round(avg))[1].toLowerCase() : '') + '</p>';
    },
    row: function (j) { var m = mood(j.mood); return { icon: m[2], color: m[3], title: j.line, sub: fmt(j.date, { weekday: 'long', day: 'numeric', month: 'short' }) + (j.notes ? ' · ' + esc(String(j.notes).slice(0, 70)) : '') }; },
    empty: 'One line a day is enough. Over time you’ll see how your weeks really were.'
  });

  /* ================= TRAVEL: places to visit ================= */
  K.collection({
    mount: $t('bucket'), feature: 'bucket', key: 'bucket', title: 'Places to visit', icon: 'pin-map',
    addTitle: 'A place you want to visit',
    fields: [
      { k: 'place', type: 'title', label: 'Place', ph: 'City or place, e.g. Lisbon', req: true },
      { k: 'notes', label: 'Why / what to do', type: 'textarea', rows: 3 },
      { k: 'visited', label: 'Been there', type: 'check' }
    ],
    afterSave: function (it) {      /* find it on the map */
      if (!window.World || (it.geo && it.geo.q === it.place)) return;
      window.World.search(it.place).then(function (l) {
        if (!l || !l[0]) return;
        var t = F.tools();
        (t.bucket || []).forEach(function (x) { if (x.id === it.id) x.geo = Object.assign({ q: it.place }, l[0]); });
        F.saveTools(t);
      }).catch(function () {});
    },
    sort: function (a, b) { return (a.visited ? 1 : 0) - (b.visited ? 1 : 0) || (a.place > b.place ? 1 : -1); },
    summary: function (items) {
      var v = items.filter(function (x) { return x.visited; }).length;
      return items.length ? '<p class="kit-moodlbl">' + items.length + ' place' + (items.length > 1 ? 's' : '') + ' · ' + v + ' visited · they show on the map under History</p>' : '';
    },
    row: function (b) { return { icon: b.visited ? 'check-circle-fill' : 'pin-map', color: b.visited ? '#22b35e' : '#0891b2', title: b.place, cls: b.visited ? 'is-done' : '', sub: [b.geo ? esc(b.geo.country) : '', b.notes ? esc(String(b.notes).slice(0, 70)) : ''].filter(Boolean).join(' · ') }; },
    detail: function (b) {
      return (b.notes ? '<p class="kit-notes">' + esc(b.notes) + '</p>' : '') +
        (b.visited ? '' : '<span class="kit-acts"><button type="button" class="text-btn" data-plantrip="' + esc(b.id) + '"><i class="bi bi-suitcase-lg"></i> Plan a trip</button>' +
          (window.World ? '<a class="text-btn" href="' + esc(window.World.flightsLink((b.geo && b.geo.name) || b.place)) + '" target="_blank" rel="noopener"><i class="bi bi-airplane"></i> Flight prices</a>' : '') + '</span>');
    },
    empty: 'Cities and places you want to see. Turn one into a trip when you’re ready.',
    onClick: function (e) {
      var b = e.target.closest('[data-plantrip]');
      if (!b || !window.Flow) return;
      var it = F.list('bucket').filter(function (x) { return x.id === b.dataset.plantrip; })[0];
      if (!it) return;
      var tr = window.Flow.travel(), start = F.addMonths(today(), 1);
      var trip = { id: K.uid(), name: it.place, dest: it.geo ? it.geo.name : it.place, start: start, end: addDays(start, 3), items: [], pack: [], notes: it.notes || '' };
      if (it.geo) trip.place = { name: it.geo.name, region: it.geo.region, country: it.geo.country, cc: it.geo.cc, lat: it.geo.lat, lon: it.geo.lon, tz: it.geo.tz };
      tr.trips.push(trip);
      window.Flow.saveTravel(tr);
      location.href = '/cmd/travel/#trip=' + trip.id;
    }
  });

  /* ================= FINANCE: subscriptions ================= */
  var PERIODS = [['monthly', 'Every month'], ['quarterly', 'Every 3 months'], ['yearly', 'Every year']];
  var PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  var SUB_CATS = [['streaming', 'Streaming & music'], ['software', 'Apps & software'], ['phone', 'Phone & internet'], ['training', 'Training'], ['news', 'News & magazines'], ['insurance', 'Insurance'], ['other', 'Other']];
  K.collection({
    mount: $t('subs'), feature: 'subs', key: 'subs', title: 'Subscriptions', icon: 'arrow-repeat',
    addTitle: 'Add subscription', editTitle: 'Edit subscription',
    fields: [
      { k: 'name', type: 'title', label: 'Name', ph: 'e.g. Spotify, iCloud+, SATS', req: true },
      { k: 'amount', label: 'Price', type: 'number', suffix: 'kr', req: true },
      { k: 'period', label: 'Paid', type: 'select', options: PERIODS, def: 'monthly' },
      { k: 'renews', label: 'Next payment', type: 'date', req: true, def: today, help: 'It shows in your calendar every time it renews.' },
      { k: 'cat', label: 'Category', type: 'select', options: SUB_CATS, def: 'streaming' },
      { k: 'paused', label: 'Paused / cancelled', type: 'check' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'e.g. how to cancel, or the account it’s on.' }
    ],
    sort: function (a, b) { return (a.paused ? 1 : 0) - (b.paused ? 1 : 0) || (F.nextRenewal(a) > F.nextRenewal(b) ? 1 : -1); },
    summary: function (items) {
      var act = items.filter(function (s) { return !s.paused; });
      var m = act.reduce(function (a, s) { return a + (+s.amount || 0) * (PER_MONTH[s.period] || 1); }, 0);
      var next = act.slice().sort(function (a, b) { return F.nextRenewal(a) > F.nextRenewal(b) ? 1 : -1; })[0];
      return items.length ? '<div class="kit-tiles">' + tile('Per month', kr(m)) + tile('Per year', kr(m * 12)) +
        (next ? tile('Next', esc(next.name), fmt(F.nextRenewal(next), { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</div>' : '';
    },
    row: function (s) {
      var per = { monthly: '/ month', quarterly: '/ 3 months', yearly: '/ year' }[s.period] || '';
      return { icon: 'arrow-repeat', color: '#11a597', title: s.name, cls: s.paused ? 'is-done' : '',
        sub: kr(+s.amount) + ' ' + per + (s.paused ? ' · paused' : ' · next ' + fmt(F.nextRenewal(s), { day: 'numeric', month: 'short' })),
        right: s.period !== 'monthly' && !s.paused ? '<small class="muted">' + kr((+s.amount || 0) * (PER_MONTH[s.period] || 1)) + '/mo</small>' : '' };
    },
    empty: 'Streaming, apps, phone, gym … see what it all costs per month and year, and get a reminder before each payment.'
  });

  /* ================= FINANCE: warranties & receipts ================= */
  K.collection({
    mount: $t('warranty'), feature: 'warranty', key: 'warranty', title: 'Warranties & receipts', icon: 'receipt-cutoff',
    addTitle: 'Add a purchase', editTitle: 'Edit purchase',
    fields: [
      { k: 'item', type: 'title', label: 'What', ph: 'e.g. MacBook Air, washing machine', req: true },
      { k: 'store', label: 'Store', ph: 'Where you bought it' },
      { k: 'bought', label: 'Bought', type: 'date', req: true, def: today },
      { k: 'price', label: 'Price', type: 'number', suffix: 'kr' },
      { k: 'years', label: 'Complaint period', type: 'select', def: '2', options: [['2', '2 years (most things)'], ['5', '5 years (meant to last: phone, PC, white goods…)'], ['1', '1 year'], ['3', '3 years']],
        help: 'In Norway you can complain (reklamere) for 2 years, or 5 years for things meant to last much longer.' },
      { k: 'receipt', label: 'Receipt', ph: 'Where it is, e.g. email, Vipps, folder' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'Serial number, model, insurance …' }
    ],
    sort: function (a, b) { return F.warrantyEnd(a) > F.warrantyEnd(b) ? 1 : -1; },
    summary: function (items) {
      var td = today(), act = items.filter(function (w) { return F.warrantyEnd(w) >= td; });
      var soon = act.filter(function (w) { return F.warrantyEnd(w) < F.addMonths(td, 3); }).length;
      var val = act.reduce(function (a, w) { return a + (+w.price || 0); }, 0);
      return items.length ? '<div class="kit-tiles">' + tile('Covered', act.length, 'things still under warranty') + tile('Ending soon', '<span class="' + (soon ? 'neg' : '') + '">' + soon + '</span>', 'within 3 months') + tile('Value covered', kr(val)) + '</div>' : '';
    },
    row: function (w) {
      var end = F.warrantyEnd(w), over = end < today();
      return { icon: 'receipt-cutoff', color: '#c98500', title: w.item, cls: over ? 'is-done' : '',
        sub: [w.store ? esc(w.store) : '', fmt(w.bought), w.price ? kr(+w.price) : '', w.receipt ? 'receipt: ' + esc(w.receipt) : ''].filter(Boolean).join(' · '),
        right: over ? '<span class="kit-badge">Ended</span>' : expiryBadge(end).replace('Until', 'Until').replace('Expires', 'Ends') };
    },
    empty: 'Keep track of what you bought, where the receipt is, and when you can no longer complain. You get a reminder in your calendar.'
  });

  /* Work page with nothing switched on */
  var wkEmpty = document.getElementById('wkEmpty');
  function workEmpty() { if (wkEmpty) wkEmpty.hidden = F.on('work'); }
  if (wkEmpty) { window.addEventListener('features:change', workEmpty); workEmpty(); }
})();
} catch (e) { console.error("tools.js", e); }
/* ===== profile.js ===== */
try {
/* Your profile: photo, details you use across the dashboard, and your socials.
   Stored in "dash.profile" (synced and encrypted with your passcode).
   - the avatar in the top corner opens Profile & settings
   - home and office address become Home / Work in Travel
   - normal working day is the one Flex time uses
   - your birthday goes in the calendar
   - socials you mark as public can be published to jplundberg.com */
(function () {
  "use strict";
  var KEY = 'dash.profile';
  var $ = function (id) { return document.getElementById(id); };
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var NETS = {
    linkedin: { name: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/{h}/', host: 'linkedin.com' },
    instagram: { name: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/{h}/', host: 'instagram.com' },
    facebook: { name: 'Facebook', icon: 'facebook', url: 'https://www.facebook.com/{h}', host: 'facebook.com' },
    tiktok: { name: 'TikTok', icon: 'tiktok', url: 'https://www.tiktok.com/@{h}', host: 'tiktok.com' },
    x: { name: 'X', icon: 'twitter-x', url: 'https://x.com/{h}', host: 'x.com' },
    threads: { name: 'Threads', icon: 'threads', url: 'https://www.threads.net/@{h}', host: 'threads.net' },
    youtube: { name: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com/@{h}', host: 'youtube.com' },
    snapchat: { name: 'Snapchat', icon: 'snapchat', url: 'https://www.snapchat.com/add/{h}', host: 'snapchat.com' },
    strava: { name: 'Strava', icon: 'strava', url: 'https://www.strava.com/athletes/{h}', host: 'strava.com' },
    github: { name: 'GitHub', icon: 'github', url: 'https://github.com/{h}', host: 'github.com' }
  };
  /* the two already on jplundberg.com */
  var START_SOCIALS = [
    { net: 'linkedin', handle: 'john-paul-lundberg-8a804623b', pub: true },
    { net: 'instagram', handle: 'jp.lundberg.official', pub: true }
  ];
  function socialUrl(s) {
    var N = NETS[s.net], h = String(s.handle || '').trim();
    if (!N || !h) return '';
    if (/^https:\/\//i.test(h)) {
      try { var u = new URL(h); return (u.hostname === N.host || u.hostname.slice(-N.host.length - 1) === '.' + N.host) ? u.href : ''; } catch (e) { return ''; }
    }
    h = h.replace(/^@/, '').replace(/[^\w.\-]/g, '');
    return h ? N.url.replace('{h}', h) : '';
  }

  function load() {
    var p = readJSON(KEY);
    p = p && typeof p === 'object' ? p : {};
    if (!Array.isArray(p.socials)) {
      p.socials = START_SOCIALS.map(function (s) { return Object.assign({ id: uid() }, s); });
      if (window.Vault && document.documentElement.classList.contains('unlocked')) {      /* keep the same ids from now on */
        try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
      }
    }
    return p;
  }
  function save(p) {
    var before = null;
    try { before = JSON.stringify((JSON.parse(localStorage.getItem(KEY)) || {}).socials || null); } catch (e) {}
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));
    window.dispatchEvent(new Event('profile:change'));
    if (before !== JSON.stringify(p.socials || null)) window.dispatchEvent(new Event('socials:change'));
  }
  function initials(p) {
    var n = String(p.name || (readJSON('dash.settings') || {}).name || '').trim().split(/\s+/).filter(Boolean);
    return n.length ? (n[0][0] + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase() : '';
  }
  function avatar(p, cls) {
    p = p || load();
    return '<span class="me-av ' + (cls || '') + '">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="">' :
      (initials(p) ? '<b>' + esc(initials(p)) + '</b>' : '<i class="bi bi-person"></i>')) + '</span>';
  }
  function age(k) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k || '')) return null;
    var b = k.split('-').map(Number), t = new Date(), a = t.getFullYear() - b[0];
    if (t.getMonth() + 1 < b[1] || (t.getMonth() + 1 === b[1] && t.getDate() < b[2])) a--;
    return a;
  }

  /* ---------- the avatar button(s) ---------- */
  function paintButtons() {
    var p = load();
    document.querySelectorAll('[data-me]').forEach(function (b) { b.innerHTML = avatar(p); });
  }
  /* other pages: a small avatar in the top corner that opens Profile & settings */
  var main = $('fp');
  if (main && !$('settingsBtn')) {
    var a = document.createElement('a');
    a.className = 'me-btn me-sub'; a.href = '/cmd/?settings'; a.setAttribute('data-me', '');
    a.addEventListener('click', function () { try { sessionStorage.setItem('dash.stFrom', location.pathname); } catch (e) {} });
    a.setAttribute('aria-label', 'Profile and settings');
    /* in the page's top row (same height as on the dashboard, below the iPhone status bar) */
    var host = document.querySelector('#fp > .fp-top');
    if (host) { a.classList.add('me-in'); host.appendChild(a); } else document.body.appendChild(a);
  }
  window.addEventListener('profile:change', paintButtons);
  if (window.Vault) window.Vault.onUnlock(paintButtons);
  paintButtons();

  /* the links that should be on jplundberg.com (switched on, with a valid address) */
  function publicSocials() {
    return load().socials.filter(function (s) { return s.pub && socialUrl(s); }).map(function (s) { return { net: s.net, url: socialUrl(s) }; });
  }
  /* Undo on the Socials page: back to what's live */
  function resetSocials(live) {
    if (!Array.isArray(live)) return;
    var p = load(), used = {};
    p.socials.forEach(function (s) { var u = socialUrl(s); s.pub = live.some(function (l) { return l.url === u; }); used[u] = 1; });
    live.forEach(function (l) { if (!used[l.url]) p.socials.push({ id: uid(), net: l.net, handle: l.url, pub: true }); });
    save(p);
    window.dispatchEvent(new Event('socials:reset'));
  }
  window.Profile = { load: load, save: save, avatar: avatar, NETS: NETS, socialUrl: socialUrl, age: age, publicSocials: publicSocials, resetSocials: resetSocials };

  /* ---------- Health page: medical info card ---------- */
  var med = $('meHealth');
  function renderMed() {
    if (!med) return;
    var p = load(), rows = [['GP (fastlege)', p.gp], ['Blood type', p.blood], ['Allergies', p.allergies], ['Medicines', p.meds]].filter(function (r) { return r[1]; });
    var ice = p.iceName ? esc(p.iceName) + (p.iceRel ? ' (' + esc(p.iceRel) + ')' : '') + (p.icePhone ? ' · <a href="tel:' + esc(p.icePhone.replace(/\s/g, '')) + '">' + esc(p.icePhone) + '</a>' : '') : '';
    med.hidden = !rows.length && !ice;
    med.innerHTML = '<div class="card-head"><h2><i class="bi bi-person-vcard"></i> Medical info</h2><a class="text-btn" href="/cmd/?settings=profile">Edit</a></div>' +
      '<dl class="me-dl">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') +
      (ice ? '<dt>Emergency contact</dt><dd>' + ice + '</dd>' : '') + '</dl>';
  }
  /* Travel page: emergency contact under travel documents */
  var docs = $('tpDocsCard');
  function renderIce() {
    if (!docs) return;
    var p = load(), el = $('meIce');
    if (!el) { el = document.createElement('p'); el.id = 'meIce'; el.className = 'me-ice'; docs.appendChild(el); }
    el.hidden = !p.iceName;
    el.innerHTML = p.iceName ? '<i class="bi bi-telephone"></i> Emergency contact: <b>' + esc(p.iceName) + '</b>' + (p.iceRel ? ' (' + esc(p.iceRel) + ')' : '') +
      (p.icePhone ? ' · <a href="tel:' + esc(p.icePhone.replace(/\s/g, '')) + '">' + esc(p.icePhone) + '</a>' : '') : '';
  }
  [renderMed, renderIce].forEach(function (fn) {
    window.addEventListener('profile:change', fn);
    if (window.Vault) window.Vault.onUnlock(fn);
  });

  /* ---------- Profile & settings panel (dashboard only) ---------- */
  var head = $('stProfile'), box = $('meBox'), soBox = $('soBox');
  var area = box && (box.closest('.st-panel') || box);     // profile and socials pages share the handlers below
  if (!head || !box) return;

  function renderHead() {
    var p = load(), F = window.Features, sub = [p.role, p.employer].filter(Boolean).join(' · ');
    head.innerHTML = avatar(p, 'lg') + '<span class="st-label"><b>' + esc(p.name || 'Your profile') + '</b><small>' +
      esc(sub || 'Your details and photo – private') + '</small></span><i class="bi bi-chevron-right"></i>';
  }

  var FIELDS = [
    { sec: 'About you', icon: 'person', rows: [
      ['name', 'Name', 'text', 'Full name'], ['birthday', 'Birthday', 'date'], ['phone', 'Phone', 'tel', '+47'], ['email', 'Email', 'email', 'you@example.com'],
      ['city', 'City', 'text', 'Oslo']] },
    { sec: 'Home', icon: 'house-door', rows: [['home', 'Address', 'place', 'Search for your address', 'home']],
      note: 'Becomes “Home” in Travel, so departures and “leave by” start from here.' },
    { sec: 'Work', icon: 'briefcase', rows: [['employer', 'Employer', 'text', 'Company'], ['role', 'Role', 'text', 'Job title'],
      ['office', 'Office', 'place', 'Search for the office address', 'work'], ['norm', 'Normal working day', 'hours']],
      note: 'The office becomes “Work” in Travel. The working day is what Flex time counts against.' },
    { sec: 'Emergency contact', icon: 'telephone', rows: [['iceName', 'Name', 'text'], ['iceRel', 'Relation', 'text', 'e.g. Mother, partner'], ['icePhone', 'Phone', 'tel']],
      note: 'Shown with your travel documents and on the Health page.' },
    { sec: 'Health', icon: 'heart-pulse', rows: [['gp', 'GP (fastlege)', 'text', 'Name and clinic'],
      ['blood', 'Blood type', 'select', ['', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', '0+', '0−']], ['allergies', 'Allergies', 'text', 'None'], ['meds', 'Medicines', 'text', 'Anything you take regularly']] },
    { sec: 'Sizes', icon: 'rulers', rows: [['sizeTop', 'Shirts & jackets', 'text', 'M'], ['sizeBottom', 'Trousers', 'text', '32/32'], ['sizeShoe', 'Shoes', 'text', '43'], ['sizeOther', 'Other', 'text', 'Ring, hat …']] }
  ];

  function travelPlace(k) { return window.Flow ? (window.Flow.travel().places || {})[k] : null; }
  function flexNorm() { return window.Features ? +((window.Features.tools().flexcfg || {}).norm) || 7.5 : 7.5; }

  function render() {
    renderSocials();
    var p = load();
    var photo = '<div class="me-photo">' + avatar(p, 'xl') + '<div><button type="button" class="pill-btn" id="mePick"><i class="bi bi-camera"></i> ' + (p.photo ? 'Change photo' : 'Add photo') + '</button>' +
      (p.photo ? '<button type="button" class="text-btn danger" id="meNoPhoto">Remove</button>' : '') +
      '<p class="st-note">' + (p.birthday && age(p.birthday) != null ? age(p.birthday) + ' years · ' : '') + 'Saved encrypted, only for you.</p></div>' +
      '<input type="file" id="meFile" accept="image/*" hidden></div>';
    var secs = FIELDS.map(function (S) {
      return '<p class="st-sub"><i class="bi bi-' + S.icon + '"></i> ' + S.sec + '</p><section class="st-group">' + S.rows.map(function (r) {
        var k = r[0], v = p[k], ph = typeof r[3] === 'string' ? ' placeholder="' + esc(r[3]) + '"' : '';
        var input;
        if (r[2] === 'place') {
          var tp = travelPlace(r[4]);
          input = '<span class="ps-wrap me-place"><input data-mplace="' + k + '" data-tp="' + r[4] + '" value="' + esc((tp && tp.name) || (p[k] && p[k].name) || '') + '"' + ph + ' aria-label="' + r[1] + '"></span>';
        } else if (r[2] === 'select') {
          input = '<select class="st-select" data-mk="' + k + '">' + r[3].map(function (o) { return '<option' + (o === (v || '') ? ' selected' : '') + ' value="' + o + '">' + (o || '–') + '</option>'; }).join('') + '</select>';
        } else if (r[2] === 'hours') {
          input = '<span class="me-hours"><input data-mnorm inputmode="decimal" value="' + String(flexNorm()).replace('.', ',') + '" aria-label="Normal working day in hours"> h</span>';
        } else {
          input = '<input class="st-input" type="' + r[2] + '" data-mk="' + k + '" value="' + esc(v || '') + '"' + ph + ' maxlength="120" aria-label="' + r[1] + '">';
        }
        return '<label class="st-row me-row"><span>' + r[1] + '</span>' + input + '</label>';
      }).join('') + '</section>' + (S.note ? '<p class="st-note me-note">' + S.note + '</p>' : '');
    }).join('');
    box.innerHTML = '<p class="me-private"><i class="bi bi-lock"></i><span><b>Private.</b> Only you see this – nothing here is shown on jplundberg.com. What’s public is under Settings → jplundberg.com.</span></p>' + photo + secs +
      '<p class="st-sub"><i class="bi bi-pencil"></i> Notes</p><section class="st-group"><textarea class="me-notes" data-mk="notes" rows="3" maxlength="2000" placeholder="Anything else you want to keep handy">' + esc(p.notes || '') + '</textarea></section>';
    if (window.Places) box.querySelectorAll('[data-mplace]').forEach(function (inp) {
      window.Places.field(inp, { onPick: function (pl) {
        if (!pl) return;
        var q = load(), plain = { id: pl.id || '', name: pl.name, sub: pl.sub || '', lat: pl.lat, lon: pl.lon, stop: !!pl.stop };
        q[inp.dataset.mplace] = plain; save(q);
        if (window.Flow) { var t = window.Flow.travel(); t.places = t.places || {}; t.places[inp.dataset.tp] = plain; window.Flow.saveTravel(t); }
        flash(inp);
      } });
    });
  }
  function flash(el) { var row = el.closest('.st-row'); if (!row) return; row.classList.add('me-saved'); setTimeout(function () { row.classList.remove('me-saved'); }, 900); }

  /* ---------- socials ---------- */
  var pubMsg = '';
  function renderSocials() { if (soBox) soBox.innerHTML = socialsHtml(load()); }
  window.addEventListener('socials:reset', renderSocials);
  function socialsHtml(p) {
    var opts = function (cur) { return Object.keys(NETS).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + NETS[k].name + '</option>'; }).join(''); };
    return '<p class="st-sub"><i class="bi bi-share"></i> Your profiles <span class="st-hint">Username or link. The switch decides if it’s shown on jplundberg.com</span></p>' +
      '<section class="st-group me-socials">' + p.socials.map(function (s) {
        var url = socialUrl(s), N = NETS[s.net] || NETS.linkedin;
        return '<div class="st-row me-soc" data-sid="' + esc(s.id) + '">' +
          '<span class="me-soc-ic"><i class="bi bi-' + N.icon + '"></i></span>' +
          '<select class="me-soc-net" data-snet aria-label="Network">' + opts(s.net) + '</select>' +
          '<input class="me-soc-h" data-shandle value="' + esc(s.handle || '') + '" placeholder="username" maxlength="200" aria-label="' + N.name + ' username or link" spellcheck="false" autocapitalize="off">' +
          '<a class="icon-btn me-soc-open" href="' + esc(url || '#') + '"' + (url ? '' : ' hidden') + ' target="_blank" rel="noopener" aria-label="Open ' + N.name + '"><i class="bi bi-box-arrow-up-right"></i></a>' +
          '<input type="checkbox" class="switch" data-spub' + (s.pub ? ' checked' : '') + ' aria-label="Show ' + N.name + ' on jplundberg.com">' +
          '<button type="button" class="text-btn danger me-soc-del" data-sdel aria-label="Remove"><i class="bi bi-x-lg"></i></button></div>';
      }).join('') +
      (p.socials.length < 10 ? '<button type="button" class="st-row st-btn cs-add" data-sadd><span><i class="bi bi-plus-lg"></i> Add social</span></button>' : '') +
      '</section>';
  }
  /* ---------- editing ---------- */
  var timer = null;
  area.addEventListener('input', function (e) {
    var t = e.target, k = t.dataset.mk;
    if (k) {
      clearTimeout(timer);
      timer = setTimeout(function () { var p = load(); p[k] = t.value.trim().slice(0, k === 'notes' ? 2000 : 120); save(p); renderHead(); }, 350);
    }
    if (t.hasAttribute('data-shandle')) {
      var p2 = load(), id = t.closest('[data-sid]').dataset.sid;
      var link = t.closest('[data-sid]').querySelector('.me-soc-open');
      p2.socials.forEach(function (s) {
        if (s.id !== id) return;
        s.handle = t.value.trim().slice(0, 200);
        var u = socialUrl(s); link.hidden = !u; link.href = u || '#';
      });
      save(p2);
    }
  });
  area.addEventListener('change', function (e) {
    var t = e.target, p = load(), row = t.closest('[data-sid]');
    if (t.dataset.mk) { p[t.dataset.mk] = t.value.trim(); save(p); flash(t); renderHead(); return; }
    if (t.hasAttribute('data-mnorm') && window.Features) {
      var n = parseFloat(t.value.replace(',', '.'));
      if (n > 0 && n < 16) { var tl = window.Features.tools(); tl.flexcfg = tl.flexcfg || {}; tl.flexcfg.norm = n; window.Features.saveTools(tl); flash(t); }
      return;
    }
    if (row) {
      p.socials.forEach(function (s) {
        if (s.id !== row.dataset.sid) return;
        if (t.hasAttribute('data-snet')) s.net = t.value;
        if (t.hasAttribute('data-spub')) s.pub = t.checked;
      });
      save(p);
      if (t.hasAttribute('data-snet')) render();
    }
  });
  area.addEventListener('click', function (e) {
    var p;
    if (e.target.closest('#mePick')) return $('meFile').click();
    if (e.target.closest('#meNoPhoto')) { p = load(); delete p.photo; save(p); render(); renderHead(); return; }
    if (e.target.closest('[data-sadd]')) {
      p = load(); var used = p.socials.map(function (s) { return s.net; });
      p.socials.push({ id: uid(), net: Object.keys(NETS).filter(function (k) { return used.indexOf(k) < 0; })[0] || 'instagram', handle: '', pub: false });
      save(p); render();
      var last = area.querySelectorAll('[data-shandle]'); if (last.length) last[last.length - 1].focus();
      return;
    }
    var del = e.target.closest('[data-sdel]');
    if (del) {
      var id = del.closest('[data-sid]').dataset.sid;
      if (!del.classList.contains('armed')) { del.classList.add('armed'); del.innerHTML = 'Remove?'; return; }
      p = load(); p.socials = p.socials.filter(function (s) { return s.id !== id; }); save(p); render();
    }
  });
  /* photo: cropped to a square and made small (about 20 KB) so it syncs quickly */
  area.addEventListener('change', function (e) {
    if (e.target.id !== 'meFile' || !e.target.files[0]) return;
    var img = new Image(), url = URL.createObjectURL(e.target.files[0]);
    img.onload = function () {
      var s = Math.min(img.width, img.height), c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      var p = load(); p.photo = c.toDataURL('image/jpeg', 0.82); save(p); render(); renderHead();
    };
    img.src = url;
  });

  window.addEventListener('st:page', function (e) { if (e.detail === 'profile' || e.detail === 'socials') render(); if (e.detail === 'home') renderHead(); });
  window.addEventListener('profile:change', renderHead);
  if (window.Vault) window.Vault.onUnlock(renderHead);
  renderHead();
})();
} catch (e) { console.error("profile.js", e); }
/* ===== links.js ===== */
try {
/* Connections: when you change something in one place, the places that depend on it follow.
   Runs on every dashboard page, after the vault is unlocked.
   - Subscriptions → Monthly budget: each active subscription is a fixed cost (per month;
     yearly and quarterly ones spread out), monthly ones also get a due day in Upcoming bills
   - Trips → Finances: booking costs and a trip's other costs are spending (Travel), old trips too
   - Trips → Places to visit: a place you've now been to is ticked off as visited
   - Workouts → your training habit: a logged workout ticks the habit that day
   (workouts, courses and health → calendar in features.js) */
(function () {
  "use strict";
  var F = window.Features;
  if (!F || !window.Vault) return;
  var PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

  /* ---------- subscriptions → budget fixed costs ---------- */
  function syncSubs() {
    var d = window.Vault.get();
    if (!d) return;
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = F.on('subs') ? F.list('subs').filter(function (s) { return !s.paused && +s.amount > 0; }).map(function (s) {
      var monthly = (s.period || 'monthly') === 'monthly', old = fixed.filter(function (f) { return f.id === 'sub-' + s.id; })[0];
      var day = monthly && /^\d{4}-\d{2}-\d{2}$/.test(s.renews || '') ? +s.renews.slice(8, 10) : null;
      return { id: 'sub-' + s.id, name: s.name + (monthly ? '' : ' (' + (s.period === 'yearly' ? 'yearly' : 'every 3 months') + ')'),
        amount: Math.round((+s.amount) * (PER_MONTH[s.period] || 1)), day: day, src: 'sub' };
    }) : [];
    var mine = fixed.filter(function (f) { return f.src !== 'sub'; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'sub'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = mine.concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }

  /* ---------- savings goals → budget: "set aside every month" becomes a fixed cost ---------- */
  function syncSave() {
    var d = window.Vault.get(), B = window.Budget;
    if (!d || !B || !B.saveMonthly) return;
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = (d.savings || []).filter(function (g) { return g.aside; }).map(function (g) {
      return { id: 'save-' + g.id, name: 'Savings: ' + (g.name || 'goal'), amount: B.saveMonthly(g), day: null, src: 'save' };
    }).filter(function (f) { return f.amount > 0; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'save'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = fixed.filter(function (f) { return f.src !== 'save'; }).concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }
  window.Links = { syncSave: syncSave };

  /* ---------- trips → places to visit ---------- */
  function near(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return false;
    var dx = (a.lat - b.lat) * 111, dy = (a.lon - b.lon) * 111 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy) < 30;                 // within 30 km counts as the same place
  }
  function syncBucket() {
    if (!window.Flow || !F.on('bucket')) return;
    var today = F.dkey(new Date()), been = window.Flow.travel().trips.filter(function (t) { return t.start && t.start <= today && t.place; });
    if (!been.length) return;
    var t = F.tools(), changed = false;
    (t.bucket || []).forEach(function (b) {
      if (b.visited) return;
      var hit = been.filter(function (tr) {
        return near(tr.place, b.geo) || String(tr.place.name).toLowerCase() === String(b.place).toLowerCase();
      })[0];
      if (hit) { b.visited = true; b.visitedTrip = hit.id; changed = true; }
    });
    if (changed) F.saveTools(t);
  }

  /* ---------- trips → Finances ----------
     Every booking cost and a trip's "other costs" are spending in Finances (category Travel).
     Older trips and bookings made before this was automatic are added too: past ones on
     their own date, upcoming ones today (that's when you paid). Removed in Finances = left out. */
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) && n > 0 ? n : 0;
  }
  var syncingTrips = false;
  function syncTrips() {
    var d = window.Vault.get(), Fl = window.Flow;
    if (!d || !Fl || syncingTrips) return;
    d.expenses = Array.isArray(d.expenses) ? d.expenses : [];
    var byId = {}; d.expenses.forEach(function (e) { byId[e.id] = e; });
    var today = F.dkey(new Date()), tr = Fl.travel(), finChanged = false, travelChanged = false;
    function want(owner, idKey, amount, date, note, keepOutKey) {
      var ex = owner[idKey] && byId[owner[idKey]];
      if (owner[idKey] && !ex) { delete owner[idKey]; owner[keepOutKey] = true; travelChanged = true; return; }   // deleted in Finances
      if (!amount) { if (ex) { d.expenses = d.expenses.filter(function (x) { return x !== ex; }); delete owner[idKey]; finChanged = travelChanged = true; } return; }
      if (ex) {
        if (ex.amount !== amount || ex.note !== note) { ex.amount = amount; ex.note = note; finChanged = true; }
        return;
      }
      if (owner[keepOutKey]) return;
      var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      d.expenses.push({ id: id, t: Date.now(), date: date, amount: Math.round(amount * 100) / 100, cat: 'travel', note: note, src: 'trip' });
      owner[idKey] = id; finChanged = travelChanged = true;
    }
    tr.trips.forEach(function (t) {
      var name = t.name || t.dest || 'Trip', past = (t.end || t.start || today) < today;
      (t.items || []).forEach(function (it) {
        var label = it.title || ({ flight: 'Flight', train: 'Train', bus: 'Bus', boat: 'Boat', car: 'Car', hotel: 'Hotel', activity: 'Activity' }[it.type] || 'Booking');
        want(it, 'spendId', num(it.cost), past && /^\d{4}-\d{2}-\d{2}$/.test(it.date || '') ? it.date : today, (name + ': ' + label).slice(0, 80), 'noFin');
      });
      want(t, 'spentId', num(t.spent), past ? (t.start || today) : today, (name + ': other costs').slice(0, 80), 'noFinSpent');
    });
    if (!finChanged && !travelChanged) return;
    syncingTrips = true;
    try {
      if (finChanged) { window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
      if (travelChanged) Fl.saveTravel(tr);
    } finally { syncingTrips = false; }
  }

  /* ---------- workouts → the training habit ----------
     A logged workout ticks its habit that day (the one picked when logging, else your
     training/gym habit). Only adds ticks – ticking a day by hand still works as before. */
  function syncWorkouts() {
    if (!F.on('training')) return;
    var hb = null; try { hb = JSON.parse(localStorage.getItem('dash.habits')); } catch (e) {}
    if (!hb || !Array.isArray(hb.list) || !hb.list.length) return;
    var def = hb.list.filter(function (h) { return /train|trening|gym|workout|løp|run|exercise|økt/i.test(h.name); })[0];
    var ids = {}; hb.list.forEach(function (h) { ids[h.id] = 1; });
    hb.log = hb.log || {};
    var changed = false;
    F.list('training').forEach(function (w) {
      var hid = w.habit === '' ? null : (w.habit && ids[w.habit] ? w.habit : def && def.id);
      if (!hid || !/^\d{4}-\d{2}-\d{2}$/.test(w.date || '')) return;
      var day = hb.log[w.date] = hb.log[w.date] || [];
      if (day.indexOf(hid) < 0) { day.push(hid); changed = true; }
    });
    if (!changed) return;
    try { localStorage.setItem('dash.habits', JSON.stringify(hb)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));
    window.dispatchEvent(new Event('habits:change'));
    if (window.Dash && window.Dash.reload) window.Dash.reload();
  }

  function run() {
    try { syncWorkouts(); } catch (e) { console.error(e); }
    try { syncSubs(); } catch (e) { console.error(e); }
    try { syncSave(); } catch (e) { console.error(e); }
    try { syncTrips(); } catch (e) { console.error(e); }
    try { syncBucket(); } catch (e) { console.error(e); }
  }
  window.Vault.onUnlock(function () { setTimeout(run, 0); });
  window.addEventListener('tools:change', function () { if (window.Vault.get()) { syncSubs(); syncWorkouts(); } });
  window.addEventListener('features:change', function () { if (window.Vault.get()) run(); });
  window.addEventListener('travel:change', function () { if (window.Vault.get()) { syncTrips(); syncBucket(); } });
})();
} catch (e) { console.error("links.js", e); }
