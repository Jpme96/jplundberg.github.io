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

    /* the list: a few at first, then 25 more at a time, grouped by day so a long month stays readable */
    var limit = showAll === true ? list.length : (showAll || 6), shown = list.slice(0, limit), lastDay = '';
    $('spList').innerHTML = shown.map(function (e) {
      var c = catById[e.cat] || catById.other;
      var d = new Date(e.date + 'T12:00'), head = '';
      if (shown.length > 8 && e.date !== lastDay) {
        var dayTotal = list.filter(function (x) { return x.date === e.date; }).reduce(function (a, x) { return a + (x.amount || 0); }, 0);
        head = '<li class="tx-day"><span>' + esc(d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })) + '</span><span class="money">' + esc(kr(dayTotal)) + '</span></li>';
        lastDay = e.date;
      }
      return head + '<li class="tx"><i class="dot" style="background:' + c.color + '"></i>' +
        '<span class="tx-text"><strong>' + esc(e.note || c.name) + '</strong><span class="muted">' +
        esc(c.name) + (shown.length > 8 ? '' : ' · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + (e.src === 'bank' ? ' · <i class="bi bi-bank" title="From your bank"></i>' : '') + '</span></span>' +
        money(e.amount) +
        '<button class="del" type="button" data-xdel="' + e.id + '" aria-label="Delete"><i class="bi bi-x"></i></button></li>';
    }).join('');
    $('spMore').hidden = list.length <= 6;
    $('spMore').innerHTML = shown.length >= list.length
      ? (list.length > 6 ? '<i class="bi bi-chevron-up"></i> Show less' : '')
      : 'Show ' + Math.min(25, list.length - shown.length) + ' more <span class="muted">· ' + (list.length - shown.length) + ' left</span>';
  }

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
  $('spMore').addEventListener('click', function () {
    var list = D.expenses.filter(function (e) { return e.date.slice(0, 7) === viewMonth; }), cur = showAll === true ? list.length : (showAll || 6);
    showAll = cur >= list.length ? false : (cur + 25 >= list.length ? true : cur + 25);
    renderSpending();
    if (showAll === false) $('spList').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

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
        ' · ' + Math.round(pct * 100) + '\u00a0%</span></div>' +
        '<div class="stepper"><button type="button" data-sv="-1" aria-label="Take out ' + step(g.target) + ' kr">−</button>' +
        '<button type="button" data-sv="1" aria-label="Add ' + step(g.target) + ' kr">+</button></div></li>';
    }).join('');
  }

  function openSaving(g) {
    editingSaving = g ? g.id : null;
    $('svForm').hidden = false;
    $('svName').value = g ? g.name : '';
    $('svSaved').value = g ? g.saved : '';
    $('svTarget').value = g ? g.target : '';
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
    var name = $('svName').value.trim();
    if (editingSaving) {
      D.savings.forEach(function (g) { if (g.id === editingSaving) { g.name = name; g.saved = s; g.target = t; } });
    } else {
      D.savings.push({ id: uid(), name: name, saved: s, target: t });
    }
    persist();
    closeSaving();
    renderSavings();
  });
  $('svDelete').addEventListener('click', function () {
    D.savings = D.savings.filter(function (g) { return g.id !== editingSaving; });
    persist();
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
