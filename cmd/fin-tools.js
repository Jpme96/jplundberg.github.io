/* Finances, the extras (Nov 2026):
   · Can I afford it? – a price in, and an answer out: from this month's room, from what's in your accounts
     (keeping your buffer), from savings, or how many months of saving. Works from the Wishlist and the ⌘K menu too.
   · Tax time – Insights: the dates of the Norwegian tax year (skattemelding, settlement, the last day for things
     that count this year), what to check in your return from what the dashboard knows, ticked off per year.
   · Debt-free – Loans: when each loan is paid off, the day you're debt-free, and what paying a bit more does.
   · Interest watch – Loans: notices when a loan's rate changes (what it means a month), and asks now and then
     whether the rate is still right.
   · Categories that learn: change the category of a bank row and the others from the same shop follow, and
     the next import uses it (Finances → Spending; the list of what it learned is in Settings → Finances).
   Settings: dash.tools.fintools (Settings → Finances, under the shared expenses). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, B = window.Budget, A = window.Accts, L = window.Loans;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, ''); if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var x = parseFloat(s.replace(',', '.')); return isFinite(x) ? x : null; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(+n || 0)) + ' kr'; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return dkey(new Date()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +(p[2] || 1)); }
  function days(a, b) { return Math.round((fromKey(b) - fromKey(a)) / 864e5); }
  function fmtD(k, y) { return fromKey(k).toLocaleDateString('en-GB', y ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function fin() { return Fe.on('finance') ? window.Vault.get() : null; }
  var GREEN = '#22b35e', AMBER = '#c98500', RED = '#e66767', BLUE = '#3987e5', GREY = '#7a8794';

  var DEF = { eye: true, rise: true, payBrief: true, ebBrief: true, merge: true, buffer: 5000, share: 100, taxBrief: true, rateBrief: true, rateCheck: 6, learn: true, learnAll: true, extra: 1000 };
  function cfg() { var c = Fe.tools().fintools; return Object.assign({}, DEF, c && typeof c === 'object' ? c : {}); }
  function setCfg(p) { var t = Fe.tools(); t.fintools = Object.assign({}, t.fintools || {}, p); Fe.saveTools(t); }
  function debts(d) { return ((d && d.accounts) || []).filter(function (a) { return a.kind === 'debt'; }); }

  /* ================= Can I afford it? ================= */
  function afford(price, months) {
    var d = fin(); if (!d || !B) return null;
    var c = cfg(), out = { price: price, months: months || 1 };
    var monthly = price / out.months;
    try { var pp = B.payPlan(d); out.left = Math.max(0, pp.left); out.daysLeft = pp.per.daysLeft; out.save = +pp.save || 0; } catch (e) { out.left = null; }
    var m = A ? A.money(d) : null;
    out.cash = m && m.cashKnown ? m.cash : null; out.saved = m ? m.saved : 0; out.owed = m ? m.owed : 0;
    var share = (+c.share || 100) / 100;
    if (out.left != null && monthly <= out.left * share) { out.ok = 2; out.how = out.months > 1 ? 'Yes – ' + kr(monthly) + ' a month fits in what’s left each month' : 'Yes – it fits in what’s left until payday'; out.after = out.left - monthly; out.afterLbl = 'left until payday after'; }
    else if (out.cash != null && out.cash - out.owed - monthly >= +c.buffer) { out.ok = 1; out.how = 'Yes, from your accounts – but it’s more than this month’s room'; out.after = out.cash - out.owed - monthly; out.afterLbl = 'in your accounts after (cards paid)'; }
    else if (out.saved >= price) { out.ok = 0; out.how = 'Only from your savings'; out.after = out.saved - price; out.afterLbl = 'left in savings after'; }
    else { out.ok = -1; out.how = 'Better wait'; }
    var per = out.save > 0 ? out.save : (out.left > 0 ? out.left * 0.5 : 0);
    out.wait = per > 0 ? Math.ceil(Math.max(0, price - (out.ok >= 0 ? price : out.saved)) / per) : null;
    if (out.ok < 0 && per > 0) out.wait = Math.ceil((price - Math.max(0, out.saved)) / per);
    out.per = per;
    return out;
  }
  function affordHtml(r) {
    if (!r) return '<p class="muted">Add your salary and bills in Finances first.</p>';
    var col = r.ok === 2 ? GREEN : r.ok === 1 ? BLUE : r.ok === 0 ? AMBER : RED, ic = r.ok >= 1 ? 'check2-circle' : r.ok === 0 ? 'piggy-bank' : 'hourglass-split';
    return '<div class="fa-res" style="--c:' + col + '"><b><i class="bi bi-' + ic + '"></i> ' + esc(r.how) + '</b>' +
      (r.after != null ? '<span>' + esc(kr(r.after)) + ' ' + esc(r.afterLbl) + '</span>' : '') +
      (r.ok < 0 && r.wait ? '<span>About ' + r.wait + (r.wait === 1 ? ' month' : ' months') + ' of saving ' + esc(kr(r.per)) + ' a month</span>' : '') + '</div>' +
      '<ul class="fa-facts">' + (r.left != null ? '<li><span>Left until payday</span><b>' + esc(kr(r.left)) + '</b></li>' : '') +
      (r.cash != null ? '<li><span>In your accounts</span><b>' + esc(kr(r.cash)) + '</b></li>' : '') +
      (r.owed ? '<li><span>Owed on cards</span><b class="neg">' + esc(kr(-r.owed)) + '</b></li>' : '') +
      (r.saved ? '<li><span>Saved</span><b>' + esc(kr(r.saved)) + '</b></li>' : '') + '</ul>';
  }
  function affordSheet(price, title) {
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<form class="fo-box lf-box hl-box" role="dialog" aria-modal="true" aria-label="Can I afford it?" autocomplete="off"><div class="lf-head"><h3><i class="bi bi-calculator"></i> Can I afford it?</h3><button type="button" class="icon-btn sm" data-x aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' +
      (title ? '<p class="muted lf-sub">' + esc(title) + '</p>' : '') + affordForm(price) + '<div data-fares></div></form>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var close = function () { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 180); };
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-x]')) close(); });
    var f = bg.querySelector('form'); f.addEventListener('submit', function (e) { e.preventDefault(); });
    var run = function () { var p = num(f.price.value); bg.querySelector('[data-fares]').innerHTML = p > 0 ? affordHtml(afford(p, +f.months.value || 1)) : ''; };
    f.addEventListener('input', run); f.addEventListener('change', run); run();
    setTimeout(function () { if (!price && !matchMedia('(pointer: coarse)').matches) f.price.focus(); }, 60);
  }
  function affordForm(price) {
    return '<div class="mp-grid fa-in"><label><span>Price, kr</span><input name="price" inputmode="decimal" value="' + (price ? esc(String(price)) : '') + '" placeholder="e.g. 12 000"></label>' +
      '<label><span>Paid</span><select name="months"><option value="1">All at once</option><option value="3">Over 3 months</option><option value="6">Over 6 months</option><option value="12">Over 12 months</option></select></label></div>';
  }
  /* before you type a price: how much you could spend right now, three ways, and the wishes that fit */
  function limits() {
    var r = afford(1, 1); if (!r) return '<p class="muted fa-hint">Add your salary and bills, then type a price here.</p>';
    var c = cfg(), month = r.left != null ? r.left * (+c.share || 100) / 100 : null, acc = r.cash != null ? Math.max(0, r.cash - r.owed - (+c.buffer || 0)) : null;
    var W = window.Wish, wl = W && Fe.on('wish') ? Fe.list('wishes').filter(function (w) { return +w.price > 0; }).sort(function (a, b) { return a.price - b.price; }).slice(0, 4) : [];
    return '<p class="muted fa-hint">Type a price – or see what you can spend now:</p><ul class="fa-lim">' +
      (month != null ? '<li style="--c:' + GREEN + '"><i class="bi bi-calendar-check"></i><span>This month, until payday</span><b>' + esc(kr(month)) + '</b></li>' : '') +
      (acc != null ? '<li style="--c:' + BLUE + '"><i class="bi bi-bank2"></i><span>From your accounts' + (+c.buffer ? ', keeping ' + esc(kr(c.buffer)) : '') + '</span><b>' + esc(kr(acc)) + '</b></li>' : '') +
      '<li style="--c:' + AMBER + '"><i class="bi bi-piggy-bank"></i><span>In savings</span><b>' + esc(kr(r.saved)) + '</b></li></ul>' +
      (wl.length ? '<p class="fx-sub">From your wishlist</p><ul class="fa-wl">' + wl.map(function (w) { var a = afford(+w.price, 1), col = a.ok === 2 ? GREEN : a.ok === 1 ? BLUE : a.ok === 0 ? AMBER : RED; return '<li><a href="/cmd/wish/#wishes=' + esc(w.id) + '">' + esc(w.title) + '</a><span class="hl-chip" style="--c:' + col + '">' + (a.ok === 2 ? 'Fits' : a.ok === 1 ? 'From accounts' : a.ok === 0 ? 'From savings' : 'Wait') + '</span><b>' + esc(kr(w.price)) + '</b></li>'; }).join('') + '</ul>' : '');
  }
  window.FinAfford = { open: affordSheet, check: afford };

  /* the card on Insights */
  function affordCard() {
    var box = $('fnAfford'); if (!box) return;
    if (!box.firstChild) {
      box.innerHTML = '<form class="fa-card" autocomplete="off">' + affordForm('') + '<div data-fares></div></form>';
      var f = box.querySelector('form'), run = function () { var p = num(f.price.value); f.querySelector('[data-fares]').innerHTML = p > 0 ? affordHtml(afford(p, +f.months.value || 1)) : limits(); };
      f.addEventListener('submit', function (e) { e.preventDefault(); }); f.addEventListener('input', run); f.addEventListener('change', run); run();
      affordCard.run = run;
    } else if (affordCard.run && !box.contains(document.activeElement)) affordCard.run();
  }

  /* ================= Tax time ================= */
  function taxDates(now) {
    var y = now.getFullYear(), t = dkey(now);
    var l = [
      { k: y + '-03-18', t: 'Your tax return opens', s: 'Skattemeldingen for ' + (y - 1) + ' – around mid-March', i: 'envelope-open' },
      { k: y + '-04-30', t: 'Last day to change your tax return', s: 'For ' + (y - 1) + ' – you can ask for more time', i: 'calendar-x' },
      { k: y + '-06-20', t: 'Tax settlement starts', s: 'Skatteoppgjøret for ' + (y - 1) + ' – June to autumn', i: 'cash-coin' },
      { k: y + '-12-31', t: 'Last day for things that count for ' + y, s: 'Gifts to charity, union fees, fund savings', i: 'hourglass-bottom' },
      { k: (y + 1) + '-03-18', t: 'Your tax return opens', s: 'Skattemeldingen for ' + y + ' – around mid-March', i: 'envelope-open' }
    ];
    return l.filter(function (x) { return x.k >= t; });
  }
  /* which year's return you're working on: from January until 30 April it's last year's, then this year's (for planning) */
  function taxYear(now) { var y = now.getFullYear(); return now.getMonth() < 5 ? y - 1 : y; }
  function taxChecks(ty) {
    var d = fin() || {}, out = [], dl = debts(d), sh = dl.some(function (l) { return L && L.shared(l); });
    var back = dl.reduce(function (s, l) { try { return s + (L ? L.myTaxBack(l) : 0); } catch (e) { return s; } }, 0);
    if (dl.length) out.push({ id: 'interest', t: 'Loan interest is in, and right', s: (back > 0 ? 'About ' + kr(back) + ' back a year in deduction (22 %)' : 'The deduction is 22 % of the interest') + (sh ? ' – a shared loan: the interest is split by who owns and pays it' : '') });
    var M = window.HouseMove, mv = M && M.date && M.date();
    if (mv && String(mv).slice(0, 4) === String(ty)) out.push({ id: 'home', t: 'Your new home is listed', s: 'Moved in ' + fmtD(mv, true) + ' – check the address, your share, and that it’s your primary home' });
    var p = window.Shared && window.Shared.partner && window.Shared.partner();
    if (p && Fe.on('house')) out.push({ id: 'shared', t: 'You and ' + p.name + ' report the same split', s: 'Shares of the home and the loan should match in both returns' });
    if (A && A.list(d).some(function (a) { return a.kind === 'fund'; })) out.push({ id: 'fund', t: 'Funds and shares', s: 'Check what the fund account (ASK) reports – gains, losses, the value 1 January' });
    var fixed = ((d.budget && d.budget.fixed) || []);
    if (fixed.some(function (f) { return /fagforen|union|forbund|lo\b|nito|tekna|akademikerne/i.test(f.name || ''); })) out.push({ id: 'union', t: 'Union fees', s: 'Usually filled in by your union – check it’s there' });
    out.push({ id: 'gifts', t: 'Gifts to charities', s: 'Only if you gave with your personal number – the organisation reports it' });
    out.push({ id: 'travel', t: 'Travel to work', s: 'A long commute can give a travel deduction (reisefradrag)' });
    out.push({ id: 'done', t: 'Looked through and delivered', s: 'Or nothing to change – then it’s delivered by itself' });
    return out;
  }
  function taxState(ty) { var t = Fe.tools().taxcheck; return t && typeof t === 'object' && t[ty] && typeof t[ty] === 'object' ? t[ty] : {}; }
  function taxCard() {
    var box = $('fnTax'); if (!box) return;
    var now = new Date(), ty = taxYear(now), st = taxState(ty), list = taxChecks(ty), dates = taxDates(now).slice(0, 3);
    var done = list.filter(function (x) { return st[x.id]; }).length;
    $('fnTaxNote') && ($('fnTaxNote').textContent = 'For ' + ty + ' · ' + done + ' of ' + list.length);
    box.innerHTML = '<ul class="fx-dates">' + dates.map(function (x, i) { var n = days(today(), x.k); return '<li' + (i === 0 ? ' class="next"' : '') + '><span class="kit-ic" style="--c:' + (i === 0 ? BLUE : GREY) + '"><i class="bi bi-' + x.i + '"></i></span><span><b>' + esc(x.t) + '</b><small>' + esc(x.s) + '</small></span><em>' + (n <= 0 ? 'Today' : n <= 60 ? 'In ' + n + ' days' : esc(fmtD(x.k))) + '</em></li>'; }).join('') + '</ul>' +
      '<p class="fx-sub">Check in your return for ' + ty + '</p><ul class="fx-checks">' + list.map(function (x) { var on = !!st[x.id]; return '<li class="' + (on ? 'done' : '') + '"><button type="button" class="check" data-taxck="' + x.id + '" aria-pressed="' + on + '" aria-label="' + esc(x.t) + '"><i class="bi bi-check-lg"></i></button><span><b>' + esc(x.t) + '</b><small>' + esc(x.s) + '</small></span></li>'; }).join('') + '</ul>' +
      '<p class="muted hl-small">Dates are the usual ones – Skatteetaten sends the exact ones. <a href="https://www.skatteetaten.no/person/skatt/skattemelding/" target="_blank" rel="noopener">skatteetaten.no</a></p>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-taxck]'); if (!b) return;
    var ty = taxYear(new Date()), t = Fe.tools(); t.taxcheck = t.taxcheck && typeof t.taxcheck === 'object' ? t.taxcheck : {};
    var s = t.taxcheck[ty] = t.taxcheck[ty] || {}; if (s[b.dataset.taxck]) delete s[b.dataset.taxck]; else s[b.dataset.taxck] = today();
    Fe.saveTools(t); taxCard();
  });

  /* ================= Debt-free ================= */
  function debtCard() {
    var box = $('fnDebt'); if (!box) return;
    var d = fin(); if (!d || !L) { box.innerHTML = ''; return; }
    var dl = debts(d), m = A ? A.money(d) : { owed: 0 }, c = cfg();
    var rows = dl.map(function (l) { var x = null; try { x = L.calc(l); } catch (e) {} return { l: l, c: x, owe: L.owedNow(l) * L.part(l) }; }).filter(function (r) { return r.owe > 0; });
    if (!rows.length && !(m.owed > 0)) { box.innerHTML = '<p class="empty">No loans – you’re debt-free. Add a loan under Loans and you see the day it’s paid off.</p>'; $('fnDebtNote').textContent = ''; return; }
    rows.sort(function (a, b) { return (a.c && !a.c.never ? a.c.months : 1e9) - (b.c && !b.c.never ? b.c.months : 1e9); });
    var last = rows.filter(function (r) { return r.c && !r.c.never; }).slice(-1)[0], never = rows.some(function (r) { return !r.c || r.c.never; });
    var total = rows.reduce(function (s, r) { return s + r.owe; }, 0) + (m.owed || 0);
    $('fnDebtNote').textContent = kr(total) + ' left';
    /* paying more: on the loan with the highest rate (it saves the most) */
    var ex = +c.extra || 0, top = rows.slice().sort(function (a, b) { return (+b.l.rate || 0) - (+a.l.rate || 0); })[0], gain = null;
    if (ex > 0 && top && top.c && !top.c.never) { try { var c2 = L.calc(top.l, ex); if (c2 && !c2.never) gain = { name: top.l.name || 'the loan', months: top.c.months - c2.months, interest: (top.c.interestLeft - c2.interestLeft) * L.part(top.l), end: c2.endLabel }; } catch (e) {} }
    box.innerHTML = '<div class="fx-big"><small>' + (never ? 'Not on its way down yet' : 'Debt-free') + '</small><b>' + (last && !never ? esc(last.c.end.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })) : '–') + '</b>' + (last && !never ? '<span class="muted">' + esc(last.c.endLabel.replace(/^.*\(in /, 'in ').replace(/\)$/, '')) + '</span>' : '') + '</div>' +
      '<ul class="fx-debts">' + (m.owed > 0 ? '<li><span class="kit-ic" style="--c:' + RED + '"><i class="bi bi-credit-card"></i></span><span><b>Credit cards</b><small>Pay these first – the highest interest</small></span><em>' + esc(kr(m.owed)) + '</em></li>' : '') +
      rows.map(function (r) { return '<li><span class="kit-ic" style="--c:' + AMBER + '"><i class="bi bi-house-door"></i></span><span><b>' + esc(r.l.name || 'Loan') + '</b><small>' + (r.c && !r.c.never ? 'Paid off ' + esc(r.c.endLabel) : 'The payment doesn’t cover the interest') + (+r.l.rate ? ' · ' + String(r.l.rate).replace('.', ',') + ' %' : '') + '</small></span><em>' + esc(kr(r.owe)) + '</em></li>'; }).join('') + '</ul>' +
      (top && top.c && !top.c.never ? '<div class="fx-more"><label><span>Pay more on ' + esc(top.l.name || 'the loan') + '</span><select data-fxextra>' + [0, 500, 1000, 2000, 3000, 5000, 10000].map(function (v) { return '<option value="' + v + '"' + (v === ex ? ' selected' : '') + '>' + (v ? '+' + kr(v) + ' a month' : 'Nothing extra') + '</option>'; }).join('') + '</select></label>' +
        (gain && gain.months > 0 ? '<p><b>' + gain.months + (gain.months === 1 ? ' month' : ' months') + ' sooner</b> – done ' + esc(gain.end.replace(/ \(.*$/, '')) + ', about ' + esc(kr(gain.interest)) + ' less interest (your part)</p>' : '') + '</div>' : '');
  }
  document.addEventListener('change', function (e) { var s = e.target.closest('[data-fxextra]'); if (s) { setCfg({ extra: +s.value }); debtCard(); } });

  /* ================= Interest watch ================= */
  function rateSeen() { var t = Fe.tools(); return t.rateSeen && typeof t.rateSeen === 'object' ? t.rateSeen : {}; }
  function rateLog() { var t = Fe.tools(); return Array.isArray(t.rateLog) ? t.rateLog : []; }
  /* notice a changed rate (typed into a loan): log it with what it means a month */
  function watch() {
    var d = fin(); if (!d || !L) return;
    var seen = rateSeen(), log = rateLog(), ch = false;
    debts(d).forEach(function (l) {
      var r = +l.rate; if (!(r >= 0) || !l.id) return;
      var s = seen[l.id];
      if (!s) { seen[l.id] = { r: r, at: today(), ok: today() }; ch = true; return; }
      if (Math.abs(s.r - r) > 0.0001) {
        var owe = L.owedNow(l) * L.part(l), month = owe * (r - s.r) / 1200;
        log.unshift({ id: l.id, name: l.name || 'Loan', date: today(), from: s.r, to: r, month: Math.round(month) });
        seen[l.id] = { r: r, at: today(), ok: today() }; ch = true;
        if (Math.abs(month) >= 1) toast('<i class="bi bi-percent"></i> ' + esc(l.name || 'Loan') + ': ' + fmtR(s.r) + ' → ' + fmtR(r) + ' % · about ' + (month > 0 ? '+' : '−') + esc(kr(Math.abs(month))) + ' a month in interest');
      }
    });
    if (ch) { var t = Fe.tools(); t.rateSeen = seen; t.rateLog = log.slice(0, 30); Fe.saveTools(t); }
  }
  function fmtR(r) { return String(Math.round(r * 100) / 100).replace('.', ','); }
  function rateCard() {
    var box = $('fnRate'); if (!box) return;
    var d = fin(); if (!d || !L) { box.innerHTML = ''; return; }
    var dl = debts(d).filter(function (l) { return +l.rate > 0; }), seen = rateSeen(), log = rateLog(), c = cfg();
    if (!dl.length) { box.innerHTML = '<p class="empty">Add a loan with its interest rate – you see here when it changes and what it costs a month.</p>'; return; }
    box.innerHTML = '<ul class="fx-debts">' + dl.map(function (l) {
      var s = seen[l.id] || {}, ok = s.ok || s.at, old = ok && +c.rateCheck > 0 && days(ok, today()) >= c.rateCheck * 30, owe = L.owedNow(l) * L.part(l);
      var bp = owe * 0.25 / 1200;
      return '<li><span class="kit-ic" style="--c:' + (old ? AMBER : BLUE) + '"><i class="bi bi-percent"></i></span><span><b>' + esc(l.name || 'Loan') + ' · ' + fmtR(+l.rate) + ' %</b><small>' + (ok ? (old ? 'Checked ' + esc(fmtD(ok, true)) + ' – still right?' : 'Checked ' + esc(fmtD(ok, true))) : '') + ' · 0,25 % more ≈ ' + esc(kr(bp)) + ' a month</small></span>' +
        '<button type="button" class="text-btn" data-rateok="' + esc(l.id) + '">' + (old ? 'Still right' : 'Checked') + '</button></li>';
    }).join('') + '</ul>' +
      (log.length ? '<p class="fx-sub">Changes</p><ul class="fx-log">' + log.slice(0, 4).map(function (x) { return '<li><span>' + esc(fmtD(x.date, true)) + ' · ' + esc(x.name) + '</span><b class="' + (x.to > x.from ? 'neg' : 'pos') + '">' + fmtR(x.from) + ' → ' + fmtR(x.to) + ' %</b><small>' + (x.month ? (x.month > 0 ? '+' : '−') + esc(kr(Math.abs(x.month))) + ' a month' : '') + '</small></li>'; }).join('') + '</ul>' : '') +
      '<p class="muted hl-small">Change the rate on the loan (Loans → the loan → Edit) when the bank writes to you – it’s tracked from there.</p>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-rateok]'); if (!b) return;
    var t = Fe.tools(); t.rateSeen = t.rateSeen || {}; var s = t.rateSeen[b.dataset.rateok]; if (s) s.ok = today(); Fe.saveTools(t); rateCard(); toast('<i class="bi bi-check2"></i> Noted');
  });

  /* ================= At a glance ================= */
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    var d = fin(); if (!d) return;
    var c = cfg(), now = new Date(), t = today();
    if (c.taxBrief) {
      var y = now.getFullYear(), ty = taxYear(now), st = taxState(ty);
      if (t >= y + '-03-18' && t <= y + '-04-30' && !st.done) { var n = days(t, y + '-04-30'); add(n <= 7 ? 40 : 66, 'envelope-open', BLUE, 'Tax return for ' + ty + (n <= 7 ? ' – ' + (n ? n + ' days left' : 'last day') : ' is open'), 'Deadline 30 April · what to check is on Finances → Insights', '/cmd/finance/#fntax'); }
      if (t >= y + '-12-10' && t <= y + '-12-31') add(74, 'hourglass-bottom', GREY, 'Things that count for ' + y + ' end on 31 Dec', 'Gifts to charity, fund savings – if you planned any', '/cmd/finance/#fntax');
    }
    rises().slice(0, 2).forEach(function (r) {
      add(54, 'graph-up-arrow', AMBER, r.name + ' went up: ' + kr(r.was) + ' → ' + kr(r.now), 'Charged ' + fmtD(r.date) + ' · update the price?', r.kind === 'sub' ? '/cmd/finance/#subs' : '/cmd/finance/#fpAcctCard',
        { act: { id: 'rise:' + r.key, label: 'Update' }, run: function () { riseFix(r, true); } });
    });
    if (c.payBrief && B && B.payPlan) { try { var pp = B.payPlan(d), op = pp.moves.filter(function (m) { return !m.done; }); var into = pp.per.days - pp.per.daysLeft;
      if (pp.per.byPayday && into <= 3 && op.length) add(30, 'list-check', BLUE, 'Payday: ' + op.length + (op.length === 1 ? ' move' : ' moves') + ' to do', kr(op.reduce(function (a, m) { return a + m.amount; }, 0)) + ' to move · tap All done when you have', '/cmd/finance/#fnPayCard', { act: { id: 'payall:' + pp.per.startKey, label: 'All done' }, run: payAll });
    } catch (er) {} }
    if (c.ebBrief) Fe.list('ebudgets').forEach(function (b) {
      if (!isKey(b.start)) return; var n = days(t, b.start), sp = ebSpent(b, d).reduce(function (a, e) { return a + (+e.amount || 0); }, 0), bu = +b.budget || 0;
      if (n >= 0 && n <= 14) add(60, b.kind === 'trip' ? 'airplane' : 'calendar2-heart', '#d55181', b.name + ' in ' + n + (n === 1 ? ' day' : ' days'), kr(Math.max(0, bu - sp)) + ' left of ' + kr(bu), '/cmd/finance/#ebud');
      else if (n < 0 && t <= (b.end || b.start) && sp > bu) add(42, 'exclamation-triangle', RED, b.name + ': over budget', kr(sp - bu) + ' over', '/cmd/finance/#ebud');
    });
    if (c.rateBrief) {
      var lg = rateLog().filter(function (x) { return days(x.date, t) <= 10; })[0];
      if (lg) add(56, 'percent', lg.to > lg.from ? AMBER : GREEN, 'Interest on ' + lg.name + ' ' + (lg.to > lg.from ? 'up' : 'down') + ' to ' + fmtR(lg.to) + ' %', lg.month ? 'About ' + (lg.month > 0 ? '+' : '−') + kr(Math.abs(lg.month)) + ' a month' : 'From ' + fmtR(lg.from) + ' %', '/cmd/finance/#fnrate');
      if (+c.rateCheck > 0 && now.getDate() === 1) {
        var seen = rateSeen(), old = debts(d).filter(function (l) { var s = seen[l.id]; return s && +l.rate > 0 && days(s.ok || s.at, t) >= c.rateCheck * 30; })[0];
        if (old) add(76, 'percent', GREY, 'Is ' + fmtR(+old.rate) + ' % still the rate on ' + (old.name || 'your loan') + '?', 'Tap Still right on Finances → Loans, or change it on the loan', '/cmd/finance/#fnrate');
      }
    }
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return Fe.on('finance') ? [{ i: 'calculator', t: 'Can I afford it?', s: 'Finances', run: function () { affordSheet(''); }, x: 'afford råd kjøpe har jeg råd price' }] : [];
  });

  /* ================= Settings → Finances (under what money-plus.js draws) ================= */
  function setFill() {
    var box = $('mpSet2'); if (!box || box.contains(document.activeElement)) return;
    if (!Fe.on('finance')) { box.innerHTML = ''; return; }
    var c = cfg(), d = fin() || {}, mem = d.catMemory || {}, keys = Object.keys(mem);
    var CN = { groceries: 'Groceries', eating: 'Eating out', transport: 'Transport', shopping: 'Shopping', home: 'Home', fun: 'Fun', health: 'Health', travel: 'Travel', other: 'Other', fixed: 'Bills' };
    function sel(f, label, opts, sub) { var v = String(c[f]); return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><select class="st-select" data-ftcfg="' + f + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
    function sw(f, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-ftcfg="' + f + '"' + (c[f] ? ' checked' : '') + '></label>'; }
    function sub(icon, t) { return '<p class="st-sub ap-sub"><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</p>'; }
    box.innerHTML = sub('eye-slash', 'Hide amounts') + '<div class="st-group">' + sw('eye', 'The eye button on every page', 'Blurs all amounts when someone is next to you – reload the page after changing') + '</div>' +
      sub('calculator', 'Can I afford it?') + '<div class="st-group">' +
      sel('buffer', 'Always keep in your accounts', [[0, 'Nothing'], [2000, '2 000 kr'], [5000, '5 000 kr'], [10000, '10 000 kr'], [20000, '20 000 kr'], [50000, '50 000 kr']], 'Paying from the accounts never goes below this') +
      sel('share', 'A price fits this month when it’s up to', [[50, 'Half of what’s left'], [75, '75 % of what’s left'], [100, 'All of what’s left']]) + '</div>' +
      sub('calendar2-heart', 'Events, payday and prices') + '<div class="st-group">' + sw('ebBrief', 'Event and trip budgets in At a glance', 'Two weeks before, and when one goes over') + sw('payBrief', 'Payday moves in At a glance', 'With an All done button') + sw('rise', 'Tell me when a bill or subscription costs more', 'From your bank imports – with an Update button') + '</div>' +
      sub('percent', 'Loans') + '<div class="st-group">' + sw('rateBrief', 'Tell me when a loan’s interest changes', 'At a glance, for 10 days') +
      sel('rateCheck', 'Ask if the rate is still right', [[0, 'Never'], [3, 'Every 3 months'], [6, 'Every 6 months'], [12, 'Once a year']]) + '</div>' +
      sub('envelope-open', 'Tax') + '<div class="st-group">' + sw('taxBrief', 'Tax dates in At a glance', 'The tax return in March–April, the last days of the year in December') + '</div>' +
      sub('intersect', 'Typed and from the bank') + '<div class="st-group">' + sw('merge', 'Count a spending once', 'When you typed it and the bank file has it too – same amount, within a few days') + '</div>' +
      sub('tags', 'Categories that learn') + '<div class="st-group">' + sw('learn', 'Learn from the categories you pick', 'The next import puts the same shop in the same category') +
      sw('learnAll', 'Change the others from the same shop too', 'When you change one bank row – with Undo') +
      (keys.length ? '<details class="st-row fx-mem"><summary><span>What it has learned<small class="st-rsub">' + keys.length + ' shops</small></span><i class="bi bi-chevron-down"></i></summary><ul>' + keys.sort().slice(0, 200).map(function (k) { return '<li><span>' + esc(k) + '</span><em>' + esc(CN[mem[k]] || mem[k]) + '</em><button type="button" class="icon-btn sm" data-ftforget="' + esc(k) + '" aria-label="Forget ' + esc(k) + '"><i class="bi bi-x-lg"></i></button></li>'; }).join('') + '</ul></details>' : '') + '</div>';
  }
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-ftcfg]'); if (!i) return;
    var p = {}; p[i.dataset.ftcfg] = i.type === 'checkbox' ? i.checked : +i.value; setCfg(p); toast('<i class="bi bi-check2"></i> Saved');
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ftforget]'); if (!b) return;
    var d = window.Vault.get(); if (!d || !d.catMemory) return;
    var k = b.dataset.ftforget, was = d.catMemory[k]; delete d.catMemory[k]; window.Vault.save(d);
    b.closest('li').remove(); toast('<i class="bi bi-x-lg"></i> Forgot ' + esc(k), function () { var d2 = window.Vault.get(); d2.catMemory = d2.catMemory || {}; d2.catMemory[k] = was; window.Vault.save(d2); setFill(); });
  });
  window.addEventListener('st:page', function (e) { if (e.detail === 'finance') setTimeout(setFill, 0); });

  /* ================= categories that learn: the others from the same shop follow ================= */
  function normNote(s) { return window.Smart && window.Smart.norm ? window.Smart.norm(s) : String(s || '').toLowerCase().replace(/[^a-zæøå ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
  /* finance.js calls this after you change one row's category */
  window.FinLearn = {
    changed: function (id, cat, oldCat) {
      var c = cfg(), d = window.Vault.get(); if (!d) return;
      var ex = (d.expenses || []).filter(function (x) { return x.id === id; })[0]; if (!ex || !ex.note) return;
      var key = normNote(ex.note);
      if (c.learn) { d.catMemory = d.catMemory || {}; d.catMemory[key] = cat; }
      var others = c.learnAll ? (d.expenses || []).filter(function (x) { return x.id !== id && x.cat === oldCat && x.cat !== 'fixed' && x.note && normNote(x.note) === key; }) : [];
      var undo = others.map(function (x) { return [x.id, x.cat]; });
      others.forEach(function (x) { x.cat = cat; });
      window.Vault.save(d);
      if (others.length) {
        window.dispatchEvent(new Event('fin:change'));
        toast('<i class="bi bi-tags"></i> ' + others.length + ' more from ' + esc(ex.note) + ' moved too', function () {
          var d2 = window.Vault.get(), m = {}; undo.forEach(function (u) { m[u[0]] = u[1]; });
          (d2.expenses || []).forEach(function (x) { if (m[x.id]) x.cat = m[x.id]; }); window.Vault.save(d2); window.dispatchEvent(new Event('fin:change'));
        });
      }
      return others.length;
    },
    norm: normNote, on: function () { return cfg().learn; }
  };


  /* ================= Price rise alert: a subscription or bill the bank charged more for than you noted ================= */
  function rises() {
    var d = fin(); if (!d || !cfg().rise) return [];
    var since = (function () { var x = new Date(); x.setDate(x.getDate() - 45); return dkey(x); })(), n = window.FinLearn ? window.FinLearn.norm : function (s) { return String(s || '').toLowerCase(); };
    var bank = (d.expenses || []).filter(function (e) { return e && e.src === 'bank' && e.date >= since && e.note; });
    var seen = Fe.tools().riseSeen || {}, out = [];
    var check = function (kind, id, name, amount) {
      var k = n(name).split(' ')[0]; if (!k || k.length < 4 || !(+amount > 0)) return;
      var hit = bank.filter(function (e) { return n(e.note).split(' ')[0] === k; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
      if (!hit || +hit.amount <= +amount * 1.03 + 2) return;
      var key = kind + ':' + id + ':' + Math.round(hit.amount); if (seen[key]) return;
      out.push({ kind: kind, id: id, name: name, was: +amount, now: +hit.amount, date: hit.date, key: key });
    };
    if (Fe.on('subs')) Fe.list('subs').forEach(function (x) { check('sub', x.id, x.name, x.amount); });
    ((d.budget && d.budget.fixed) || []).forEach(function (f) { if (!f.src) check('fixed', f.id, f.name, f.amount); });
    return out;
  }
  function riseFix(r, update) {
    var t = Fe.tools(); t.riseSeen = Object.assign({}, t.riseSeen || {}); t.riseSeen[r.key] = today();
    if (update && r.kind === 'sub') (t.subs || []).forEach(function (x) { if (x.id === r.id) x.amount = Math.round(r.now * 100) / 100; });
    Fe.saveTools(t);
    if (update && r.kind === 'fixed') { var d = window.Vault.get(); ((d.budget && d.budget.fixed) || []).forEach(function (f) { if (f.id === r.id) f.amount = Math.round(r.now); }); window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
    toast('<i class="bi bi-check2"></i> ' + (update ? esc(r.name) + ' updated to ' + esc(kr(r.now)) : 'Noted'));
  }

  /* ================= Payday autopilot: tick every move at once ================= */
  function payAll() {
    var d = window.Vault.get(); if (!d || !B || !B.payPlan) return 0;
    var p = B.payPlan(d), k = p.per.startKey, open = p.moves.filter(function (m) { return !m.done; }); if (!open.length) return 0;
    d.budget.payDone = d.budget.payDone || {}; var m = d.budget.payDone[k] = d.budget.payDone[k] || {};
    open.forEach(function (x) { m[x.id] = true; }); window.Vault.save(d); window.dispatchEvent(new Event('fin:change'));
    toast('<i class="bi bi-check2-all"></i> ' + open.length + ' payday moves done', function () { var d2 = window.Vault.get(), m2 = ((d2.budget || {}).payDone || {})[k] || {}; open.forEach(function (x) { delete m2[x.id]; }); window.Vault.save(d2); window.dispatchEvent(new Event('fin:change')); });
    return open.length;
  }
  window.FinPayAll = payAll;
  document.addEventListener('click', function (e) { if (e.target.closest('[data-payall]')) { e.preventDefault(); payAll(); } });

  /* ================= Budgets for events and trips ================= */
  /* dash.tools.ebudgets = [{ id, name, kind: event|trip, start, end, budget, saved }]; a spending counts when it's
     tagged (expense.ebud = id), and for a trip also everything you spend between its dates */
  function ebSpent(b, d) {
    d = d || fin() || {}; var all = b.kind === 'trip';
    return (d.expenses || []).filter(function (e) { return e && (e.ebud === b.id || (all && isKey(b.start) && e.date >= b.start && e.date <= (b.end || b.start) && e.cat !== 'fixed' && !e.ebud)); });
  }
  function monthsTo(k) { if (!isKey(k)) return 0; var a = new Date(), b = fromKey(k); return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()); }
  function ebSaveMonthly(b) { var left = Math.max(0, (+b.budget || 0) - (+b.saved || 0)), m = monthsTo(b.start); return m > 0 ? Math.ceil(left / m / 10) * 10 : 0; }
  var EBK = [['event', 'An event'], ['trip', 'A trip']];
  var ebCol = (window.Kit && document.querySelector('[data-tool="ebud"]')) ? window.Kit.collection({
    mount: document.querySelector('[data-tool="ebud"]'), feature: 'finance', key: 'ebudgets', icon: 'calendar2-heart', title: 'Budgets for events and trips', addLabel: 'Add', limit: 6,
    addTitle: 'New budget', editTitle: 'Edit budget', fields: [
      { k: 'name', type: 'title', label: 'For', ph: 'e.g. Christmas, Spain in May, the moving day', req: true },
      { k: 'kind', label: 'It’s', type: 'select', options: EBK, def: 'event', help: 'A trip counts everything you spend between its dates; an event counts what you tag.' },
      { k: 'budget', label: 'Budget', type: 'number', suffix: 'kr', req: true },
      { k: 'start', label: 'From', type: 'date' }, { k: 'end', label: 'To', type: 'date' },
      { k: 'saved', label: 'Already put aside', type: 'number', suffix: 'kr' }],
    empty: 'Christmas, a birthday party, the move, a trip – give it a budget and a date, and you see what’s spent, what’s left, and what to put aside each month until then.',
    sort: function (a, b) { return String(a.start || '9').localeCompare(String(b.start || '9')); },
    row: function (b) {
      var sp = ebSpent(b).reduce(function (a, e) { return a + (+e.amount || 0); }, 0), bu = +b.budget || 0, past = isKey(b.end || b.start) && (b.end || b.start) < today();
      var c = sp > bu ? RED : sp > bu * .85 ? AMBER : GREEN, per = ebSaveMonthly(b);
      return { icon: b.kind === 'trip' ? 'airplane' : 'calendar2-heart', color: b.kind === 'trip' ? '#0891b2' : '#d55181', title: b.name,
        sub: esc([isKey(b.start) ? fmtD(b.start) + (isKey(b.end) && b.end !== b.start ? '–' + fmtD(b.end) : '') : '', kr(sp) + ' of ' + kr(bu), !past && per && sp === 0 ? 'put aside ' + kr(per) + ' a month' : ''].filter(Boolean).join(' · ')),
        right: '<span class="hl-chip" style="--c:' + c + '">' + (past ? (sp > bu ? kr(sp - bu) + ' over' : kr(bu - sp) + ' under') : kr(Math.max(0, bu - sp)) + ' left') + '</span>' };
    },
    detail: function (b) {
      var d = fin() || {}, l = ebSpent(b, d), bu = +b.budget || 0, sp = l.reduce(function (a, e) { return a + (+e.amount || 0); }, 0), per = ebSaveMonthly(b);
      var near = (d.expenses || []).filter(function (e) { return e && !e.ebud && e.cat !== 'fixed' && isKey(e.date) && e.date >= (function () { var x = new Date(); x.setDate(x.getDate() - 30); return dkey(x); })() && l.indexOf(e) < 0; }).sort(function (a, b2) { return a.date < b2.date ? 1 : -1; }).slice(0, 6);
      var has = ((d.budget && d.budget.fixed) || []).some(function (f) { return f.id === 'eb-' + b.id; });
      return '<div class="fn-bar"><i style="width:' + Math.min(100, bu ? sp / bu * 100 : 0).toFixed(1) + '%"></i></div>' +
        (l.length ? '<ul class="eb-l">' + l.slice(0, 8).map(function (e) { return '<li><span>' + esc(e.note || e.cat) + ' <small>' + esc(fmtD(e.date)) + '</small></span><b>' + esc(kr(e.amount)) + '</b>' + (e.ebud ? '<button type="button" class="icon-btn sm" data-ebuntag="' + esc(e.id) + '" aria-label="Don’t count it"><i class="bi bi-x-lg"></i></button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted hl-small">Nothing counted yet.</p>') +
        (near.length ? '<p class="fx-sub">Count a recent spending</p><ul class="eb-l">' + near.map(function (e) { return '<li><span>' + esc(e.note || e.cat) + ' <small>' + esc(fmtD(e.date)) + '</small></span><b>' + esc(kr(e.amount)) + '</b><button type="button" class="icon-btn sm" data-ebtag="' + esc(e.id) + '|' + esc(b.id) + '" aria-label="Count it"><i class="bi bi-plus-lg"></i></button></li>'; }).join('') + '</ul>' : '') +
        '<div class="hl-acts">' + (per && !has ? '<button type="button" class="pill-btn" data-ebsave="' + esc(b.id) + '"><i class="bi bi-piggy-bank"></i> Put aside ' + esc(kr(per)) + ' a month</button>' : has ? '<span class="muted hl-small"><i class="bi bi-check2"></i> In your payday moves</span>' : '') + '</div>';
    },
    onClick: function (e, render) {
      var b;
      if ((b = e.target.closest('[data-ebtag]'))) { var q = b.dataset.ebtag.split('|'), d = window.Vault.get(); (d.expenses || []).forEach(function (x) { if (x.id === q[0]) x.ebud = q[1]; }); window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); render(); return; }
      if ((b = e.target.closest('[data-ebuntag]'))) { var d2 = window.Vault.get(); (d2.expenses || []).forEach(function (x) { if (x.id === b.dataset.ebuntag) delete x.ebud; }); window.Vault.save(d2); window.dispatchEvent(new Event('fin:change')); render(); return; }
      if ((b = e.target.closest('[data-ebsave]'))) {
        var it = Fe.list('ebudgets').filter(function (x) { return x.id === b.dataset.ebsave; })[0]; if (!it) return;
        var d3 = window.Vault.get(); d3.budget = d3.budget || { income: [], fixed: [] }; d3.budget.fixed = d3.budget.fixed || [];
        d3.budget.fixed.push({ id: 'eb-' + it.id, name: 'Savings: ' + it.name, amount: ebSaveMonthly(it), src: 'save', until: isKey(it.start) ? it.start.slice(0, 7) : undefined });
        window.Vault.save(d3); window.dispatchEvent(new Event('fin:change')); render(); toast('<i class="bi bi-piggy-bank"></i> Added to your payday moves');
      }
    },
    onDelete: function (it) { var d = window.Vault.get(); if (!d) return; (d.expenses || []).forEach(function (x) { if (x.ebud === it.id) delete x.ebud; }); if (d.budget && d.budget.fixed) d.budget.fixed = d.budget.fixed.filter(function (f) { return f.id !== 'eb-' + it.id; }); window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
  }) : null;
  if (ebCol) window.addEventListener('fin:change', function () { ebCol.render(); });
  /* the monthly saving stops once the event has come */
  window.Vault.onUnlock(function () { setTimeout(function () {
    var d = window.Vault.get(); if (!d || !d.budget || !d.budget.fixed) return;
    var ids = {}; Fe.list('ebudgets').forEach(function (b) { if (isKey(b.start) && b.start <= today()) ids['eb-' + b.id] = 1; });
    var n = d.budget.fixed.length; d.budget.fixed = d.budget.fixed.filter(function (f) { return !ids[f.id]; }); if (d.budget.fixed.length !== n) { window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
  }, 1500); });
  window.EventBudgets = { spent: ebSpent, monthly: ebSaveMonthly };

  /* ================= Hide amounts on every page (the eye that Finances has) ================= */
  (function () {
    function hidden() { try { return localStorage.getItem('dash.finHide') === '1'; } catch (e) { return false; } }
    function paint(b) { var h = hidden(); b.innerHTML = '<i class="bi bi-eye' + (h ? '-slash' : '') + '"></i>'; b.setAttribute('aria-label', h ? 'Show amounts' : 'Hide amounts'); }
    document.body.classList.toggle('fin-hidden', hidden());
    if (document.getElementById('finHide') || !cfg().eye) return;          /* Finances has its own */
    var host = document.querySelector('.top-actions') || document.querySelector('#fp > .fp-top'); if (!host) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'icon-btn'; b.id = 'finHideAll'; paint(b);
    host.insertBefore(b, host.querySelector('[data-me]') || null);
    b.addEventListener('click', function () {
      var h = !hidden(); try { localStorage.setItem('dash.finHide', h ? '1' : '0'); } catch (e) {}
      document.body.classList.toggle('fin-hidden', h); paint(b); window.dispatchEvent(new Event('dash:local'));
    });
    window.addEventListener('storage', function (e) { if (e.key === 'dash.finHide') { document.body.classList.toggle('fin-hidden', hidden()); paint(b); } });
  })();

  function all() { [affordCard, taxCard, debtCard, rateCard].forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  window.addEventListener('fin:change', function () { setTimeout(function () { watch(); all(); }, 30); });
  window.addEventListener('tools:change', function () { clearTimeout(all.t); all.t = setTimeout(all, 40); });
  window.Vault.onUnlock(function () { setTimeout(function () { watch(); all(); }, 80); });
})();
