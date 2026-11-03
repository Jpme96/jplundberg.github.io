/* Finances, reorganised in four views – and the money maths behind them.
   · Overview      what you can spend, where the salary goes on payday, what's due, by category
   · Transactions  everything you spent (bank files from all three accounts, receipts, by hand) and the recurring cards
   · Plan          your three accounts and which one pays each fixed cost, loans, savings goals, the year ahead
                   (holiday pay in June, half tax in December, BSU, interest deduction, the tax settlement)
   · Wealth        net worth and the statistics
   The three accounts JP uses: the salary account (salary lands here and is spread out), the credit card
   (bills, groceries, everyday) and the card account (some bills). Everything is read from the vault and
   written back the same way finance.js does. */
(function () {
  "use strict";
  var main = document.getElementById('fp'), tabsEl = document.getElementById('fpTabs');
  if (!main || !tabsEl || !window.Vault) return;
  var $ = function (id) { return document.getElementById(id); };
  var B = window.Budget, Lo = window.Loans;
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)); }
  function money(n, cls) { return '<span class="money' + (cls ? ' ' + cls : '') + '">' + esc(kr(n)) + '</span>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '').replace('−', '-'); if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var n = parseFloat(s.replace(',', '.')); return isFinite(n) ? n : NaN; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ym(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function sum(l, f) { return l.reduce(function (a, x) { return a + (+(f ? f(x) : x.amount) || 0); }, 0); }
  function data() { var d = window.Vault.get(); if (!d) return null; d.budget = d.budget || { income: [], fixed: [] }; d.budget.fixed = d.budget.fixed || []; return d; }
  function save(d) { window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }

  function acctName(d, k) { var a = window.Accts.get(d, k); return a ? a.label : 'By hand'; }

  /* ================= the four views ================= */
  var VIEWS = ['overview', 'tx', 'plan', 'wealth'];
  function current() { return main.dataset.tab || 'overview'; }
  function show(tab, opts) {
    if (VIEWS.indexOf(tab) < 0) tab = 'overview';
    var was = current();
    main.dataset.tab = tab;
    tabsEl.querySelectorAll('[data-ftab-go]').forEach(function (b) { var on = b.dataset.ftabGo === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    try { localStorage.setItem('dash.finTab', tab); } catch (e) {}
    if (window.FinSpending) window.FinSpending.rows(tab === 'tx' ? 20 : 6);
    if (was !== tab) {
      window.dispatchEvent(new Event('resize'));        // charts that were hidden measure themselves again
      if (!(opts && opts.keep)) { var top = tabsEl.getBoundingClientRect().top + scrollY - 70; if (scrollY > top) window.scrollTo(0, Math.max(0, top)); }
    }
  }
  function tabOf(el) { var p = el && el.closest('[data-ftab]'); return p ? p.dataset.ftab : null; }
  function goCard(sel) {
    var el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el) return;
    var t = tabOf(el); if (t) show(t, { keep: true });
    setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }
  tabsEl.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var i = VIEWS.indexOf(current()) + (e.key === 'ArrowRight' ? 1 : -1); i = (i + VIEWS.length) % VIEWS.length;
    show(VIEWS[i]); var b = tabsEl.querySelector('[data-ftab-go="' + VIEWS[i] + '"]'); if (b) b.focus();
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ftab-go]'); if (!b || !main.contains(b)) return;
    if (b.dataset.fpTo) { goCard('.card.' + b.dataset.fpTo); return; }
    show(b.dataset.ftabGo);
  });
  /* arriving with #c=savings, #c=loans … (search, the budget's link icons, the dashboard) or #import */
  function fromHash() {
    var m = location.hash.match(/^#c=([a-z]+)$/);
    if (m) { var c = document.querySelector('#fp .card.' + m[1]); if (c && tabOf(c)) show(tabOf(c), { keep: true }); }
    else if (location.hash === '#import' || location.hash === '#scan') show('tx', { keep: true });
  }
  window.addEventListener('hashchange', fromHash);
  if (/[?&]customize/.test(location.search)) main.classList.add('fp-all');      // customizing shows every card
  (function () { var t = null; try { t = localStorage.getItem('dash.finTab'); } catch (e) {} show(t || 'overview', { keep: true }); fromHash(); })();
  /* search results and other links that scroll to a card on another view */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="#c="]'); if (!a) return;
    var m = a.getAttribute('href').match(/#c=([a-z]+)$/), c = m && document.querySelector('#fp .card.' + m[1]);
    if (c && /\/finance\//.test(a.pathname || location.pathname) && a.pathname === location.pathname) { e.preventDefault(); goCard(c); }
  });

  /* ================= Payday plan + checklist (Overview) ================= */
  function plan(d) { return B.payPlan(d); }
  function renderFlow(d) {
    var box = $('fpFlow'); if (!box) return;
    var p = plan(d), inc = p.per.income, by = p.by;
    if (!(inc > 0)) {
      box.innerHTML = '<p class="empty">Add your salary under Monthly budget → Edit, and choose which account pays each fixed cost under <button type="button" class="text-btn" data-ftab-go="plan" data-fp-to="accounts">Plan → Accounts</button>. Then this shows what to move where on payday.</p>';
      return;
    }
    var segs = [];
    p.list.forEach(function (a) {
      var v = by[a.id] + (a.kind === 'salary' || a.kind === 'credit' ? 0 : a.buffer || 0);
      if (v > 0) segs.push([a.kind === 'salary' ? 'Bills from ' + a.label : a.kind === 'credit' ? 'Bills on ' + a.label : 'To ' + a.label, v, a.c]);
    });
    segs.push(['To savings', p.save, '#22b35e'], ['Set aside for yearly costs', p.yearly, '#0891b2'], ['Everyday spending', Math.max(0, p.room - p.buffers), 'var(--accent)']);
    segs = segs.filter(function (s) { return s[1] > 0; });
    var tot = Math.max(inc, sum(segs, function (s) { return s[1]; }), 1);
    var openN = p.open.length, payday = p.per.byPayday && p.per.days - p.per.daysLeft < 7;
    var cards = B.cardBills(d);
    box.innerHTML =
      '<div class="pf-in"><span><i class="bi bi-' + p.main.icon + '"></i> ' + esc(p.main.label) + ' gets</span><b>' + money(inc) + '</b></div>' +
      '<div class="stack pf-bar" role="img" aria-label="Where the salary goes">' + segs.map(function (s) { return '<span style="width:' + (s[1] / tot * 100).toFixed(2) + '%;background:' + s[2] + '"></span>'; }).join('') + '</div>' +
      '<ul class="legend pf-leg">' + segs.map(function (s) { return '<li><i class="dot" style="background:' + s[2] + '"></i>' + esc(s[0]) + '<b>' + money(s[1]) + '</b></li>'; }).join('') + '</ul>' +
      (p.moves.length ? '<p class="pf-h">Payday checklist' + (openN ? ' · <span class="' + (payday ? 'pf-due' : '') + '">' + openN + ' to do</span>' : ' · <span class="pf-ok"><i class="bi bi-check2-all"></i> all done</span>') + '</p><ul class="pf-moves pf-check">' + p.moves.map(function (m) {
        return '<li class="' + (m.done ? 'done' : '') + '"><button type="button" class="check" data-pfmove="' + esc(m.id) + '" aria-pressed="' + m.done + '" aria-label="' + esc(m.label) + (m.done ? ' – done' : ' – mark as done') + '"><i class="bi bi-check-lg"></i></button><span>' + esc(m.label) + '<small>' + esc(m.sub) + '</small></span><b>' + money(m.amount) + '</b></li>';
      }).join('') + '</ul>' : '') +
      cards.map(ccLine).join('') +
      '<p class="pf-h">This period · ' + esc(p.per.name) + '</p>' +
      '<ul class="pf-moves pf-spent">' +
        p.list.concat([{ id: 'hand', label: 'Logged by hand', icon: 'pencil' }]).filter(function (a) { return p.perAcct[a.id] > 0; }).map(function (a) {
          return '<li><i class="bi bi-' + a.icon + '"' + (a.c ? ' style="color:' + a.c + '"' : '') + '></i><span>' + esc(a.label) + '</span><b>' + money(p.perAcct[a.id]) + '</b></li>';
        }).join('') +
        '<li class="pf-left' + (p.left < 0 ? ' neg' : '') + '"><i class="bi bi-wallet2"></i><span>' + (p.left < 0 ? 'Over budget' : 'Safe to spend') + '<small>' + (p.left > 0 ? esc(kr(p.perDay)) + ' a day for ' + p.per.daysLeft + ' day' + (p.per.daysLeft === 1 ? '' : 's') : 'spend less until payday') + '</small></span><b>' + money(p.left) + '</b></li>' +
      '</ul>';
  }
  /* one credit card's bill this month: amount, due day, paid in full (and what paying only part would cost) */
  function ccLine(c) {
    if (!c.amount && !c.due) return '';
    var late = c.due && !c.paid && c.days < 0, soon = c.due && !c.paid && c.days >= 0 && c.days <= 5;
    var when = !c.due ? '<button type="button" class="text-btn" data-ftab-go="plan" data-fp-to="accounts">Set the due day</button>' :
      c.paid ? 'Paid in full' : late ? '<span class="late">' + (-c.days) + ' day' + (c.days === -1 ? '' : 's') + ' overdue</span>' : c.days === 0 ? '<span class="soon">Due today</span>' : 'Due ' + c.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · in ' + c.days + ' day' + (c.days === 1 ? '' : 's');
    return '<div class="pf-cc' + (c.paid ? ' paid' : late ? ' late' : soon ? ' soon' : '') + '"><button type="button" class="check" data-pfcc="' + esc(c.acct.id) + '" aria-pressed="' + c.paid + '" aria-label="' + esc(c.acct.label) + (c.paid ? ' – paid in full' : ' – mark as paid in full') + '"><i class="bi bi-check-lg"></i></button>' +
      '<span><b>' + esc(c.acct.label) + ' bill</b><small>' + when + (c.known ? '' : ' · import last month’s card file for the exact amount') + '</small></span>' + money(c.amount) + '</div>' +
      (!c.paid && c.amount > 0 ? '<p class="pf-warn"><i class="bi bi-exclamation-diamond"></i> Pay the <b>whole</b> bill – card interest is often 20–25 % a year, about ' + money(c.interest) + ' a month on this amount.</p>' : '');
  }
  document.addEventListener('click', function (e) {
    var mv = e.target.closest('[data-pfmove]'), cc = e.target.closest('[data-pfcc]'); if (!mv && !cc) return;
    var d = data(); if (!d) return;
    if (mv) {
      var k = B.period(d).startKey, all = d.budget.payDone = d.budget.payDone || {}, m = all[k] = all[k] || {};
      if (m[mv.dataset.pfmove]) delete m[mv.dataset.pfmove]; else m[mv.dataset.pfmove] = true;
      Object.keys(all).sort().slice(0, -6).forEach(function (x) { delete all[x]; });        // keep the last six periods
    } else {
      var now = new Date(), key = cc.dataset.pfcc + ':' + now.getFullYear() + '-' + pad(now.getMonth() + 1), pd = d.budget.ccPaid = d.budget.ccPaid || {};
      if (pd[key]) delete pd[key]; else pd[key] = true;
      Object.keys(pd).sort(function (a, b) { return a.slice(-7) < b.slice(-7) ? -1 : 1; }).slice(0, -24).forEach(function (x) { delete pd[x]; });
    }
    save(d);
  });

  /* ================= Accounts & fixed costs (Plan) ================= */
  var acctAdding = false;
  function renderAcct(d) {
    var box = $('fpAcct'); if (!box) return;
    if (box.contains(document.activeElement) && document.activeElement.matches('input')) return;   // don't redraw under your fingers
    var A = window.Accts, list = A.list(d), fixed = d.budget.fixed;
    var opt = function (sel, filter) { return list.filter(filter || function () { return true; }).map(function (a) { return '<option value="' + a.id + '"' + (sel === a.id ? ' selected' : '') + '>' + esc(a.label) + '</option>'; }).join(''); };
    var dayOpts = function (v) { var o = '<option value="">Due day?</option>'; for (var i = 1; i <= 31; i++) o += '<option value="' + i + '"' + (+v === i ? ' selected' : '') + '>Due the ' + i + '.</option>'; return o; };
    var p = plan(d);
    var groups = list.map(function (a) {
      var rows = fixed.filter(function (f) { return f.src !== 'save' && f.src !== 'year' && (list.some(function (x) { return x.id === f.acct; }) ? f.acct : p.main.id) === a.id; });
      return '<div class="pa-grp"><p class="pa-h"><i class="bi bi-' + a.icon + '" style="color:' + a.c + '"></i> ' + esc(a.label) + '<b>' + money(sum(rows)) + '</b></p>' +
        (rows.length ? '<ul class="pa-list">' + rows.map(function (f) {
          return '<li><span>' + esc(f.name) + (f.day ? '<small>the ' + esc(f.day) + '.</small>' : '') + '</span>' + money(f.amount) +
            '<select data-pafrom="' + esc(f.id) + '" aria-label="Paid from, ' + esc(f.name) + '">' + opt(a.id, function (x) { return x.kind !== 'savings'; }) + '</select></li>';
        }).join('') + '</ul>' : '<p class="muted pa-none">' + (a.kind === 'savings' ? 'Savings and yearly costs can go here (below)' : 'Nothing paid from here') + '</p>') + '</div>';
    }).join('');
    var row = function (a) {
      var k = A.KINDS[a.kind];
      return '<div class="pa-acct" data-paid="' + esc(a.id) + '"><span class="pa-ico" style="--c:' + a.c + '"><i class="bi bi-' + a.icon + '"></i></span>' +
        '<input data-paname="' + esc(a.id) + '" value="' + esc(a.name) + '" placeholder="' + esc(a.extra ? k.name : a.kind === 'salary' ? 'e.g. DNB brukskonto' : a.kind === 'credit' ? 'e.g. Trumf Visa' : 'e.g. Regningskonto') + '" aria-label="Name of ' + esc(a.label) + '" autocomplete="off">' +
        (a.kind === 'credit' ? '<select data-padue="' + esc(a.id) + '" aria-label="Bill due day">' + dayOpts(a.due) + '</select>' :
          a.kind === 'card' || a.kind === 'savings' ? '<input data-pabuf="' + esc(a.id) + '" inputmode="decimal" value="' + esc(a.buffer || '') + '" placeholder="+ kr/payday" aria-label="Extra to ' + esc(a.label) + ' each payday" autocomplete="off">' : '<span class="muted pa-kind">' + k.name + '</span>') +
        (a.extra ? '<button type="button" class="icon-btn sm" data-padel="' + esc(a.id) + '" aria-label="Remove ' + esc(a.label) + '"><i class="bi bi-x-lg"></i></button>' : '<span></span>') + '</div>';
    };
    box.innerHTML =
      '<p class="muted pa-p">Your salary lands on the salary account and is spread out from there. Name your accounts, say which one pays each fixed cost – the payday plan then tells you what to move where. Credit cards: the day the bill is due. Other accounts: an extra amount to move each payday (optional).</p>' +
      '<div class="pa-accts">' + list.map(row).join('') + '</div>' +
      (acctAdding ? '<form class="pa-add" id="paAdd"><input name="n" placeholder="Name, e.g. Felleskonto" required autocomplete="off"><select name="k" aria-label="Type">' +
          Object.keys(A.KINDS).filter(function (k) { return k !== 'salary'; }).map(function (k) { return '<option value="' + k + '">' + A.KINDS[k].name + '</option>'; }).join('') + '</select>' +
          '<button type="button" class="text-btn" data-paaddx>Cancel</button><button type="submit" class="pill-btn">Add</button></form>'
        : '<button type="button" class="text-btn pa-more" data-paaddgo><i class="bi bi-plus-lg"></i> Add an account</button>') +
      '<div class="pa-names">' +
        '<label><span><i class="bi bi-basket"></i> Everyday shopping with</span><select data-padaily>' + opt(p.daily, function (x) { return x.kind !== 'savings'; }) + '</select></label>' +
        '<label><span><i class="bi bi-piggy-bank"></i> Savings and yearly costs go to</span><select data-pasave><option value="">Not set</option>' + opt(p.saveTo ? p.saveTo.id : '', function (x) { return x.kind !== 'salary' && x.kind !== 'credit'; }) + '</select></label>' +
      '</div>' + groups +
      '<p class="muted pa-p">Add or change fixed costs under Overview → Monthly budget → Edit. Loans come in by themselves from Loans below.</p>';
  }
  function setAcct(d, id, patch) {
    var list = d.budget.acctList = Array.isArray(d.budget.acctList) ? d.budget.acctList : [];
    var a = list.filter(function (x) { return x.id === id; })[0];
    if (!a) { a = { id: id, kind: id }; list.push(a); }
    Object.assign(a, patch);
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.closest || !t.closest('#fpAcct') || t.closest('#paAdd')) return;
    var d = data(); if (!d) return;
    if (t.dataset.pafrom) {
      var id = t.dataset.pafrom, f = d.budget.fixed.filter(function (x) { return String(x.id) === id; })[0];
      if (f && f.src === 'loan') { (d.accounts || []).forEach(function (a) { if ('loan-' + a.id === id) a.from = t.value; }); }
      if (f) f.acct = t.value;
    } else if (t.dataset.paname) { var nm = t.value.trim().slice(0, 40); setAcct(d, t.dataset.paname, { name: nm }); if (['salary', 'credit', 'card'].indexOf(t.dataset.paname) > -1) { d.budget.accts = d.budget.accts || {}; d.budget.accts[t.dataset.paname] = nm; } }
    else if (t.dataset.padue) setAcct(d, t.dataset.padue, { due: +t.value || null });
    else if (t.dataset.pabuf) { var v = Math.max(0, Math.round(num(t.value) || 0)); setAcct(d, t.dataset.pabuf, { buffer: v }); if (t.dataset.pabuf === 'card') d.budget.cardBuffer = v; }
    else if (t.hasAttribute('data-padaily')) d.budget.daily = t.value;
    else if (t.hasAttribute('data-pasave')) d.budget.saveAcct = t.value || null;
    else return;
    save(d);
    setTimeout(function () { if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#fpAcct')) document.activeElement.blur(); renderAcct(data()); }, 0);
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#fpAcct')) return;
    var d = data(); if (!d) return;
    if (e.target.closest('[data-paaddgo]')) { acctAdding = true; renderAcct(d); var i = document.querySelector('#paAdd input'); if (i) i.focus(); return; }
    if (e.target.closest('[data-paaddx]')) { acctAdding = false; renderAcct(d); return; }
    var del = e.target.closest('[data-padel]');
    if (del) {
      var id = del.dataset.padel, a = window.Accts.get(d, id); if (!a) return;
      if (!confirm('Remove ' + a.label + '? Fixed costs paid from it move to the salary account. Expenses imported from it keep their amounts.')) return;
      d.budget.acctList = (d.budget.acctList || []).filter(function (x) { return x.id !== id; });
      d.budget.fixed.forEach(function (f) { if (f.acct === id) f.acct = 'salary'; });
      (d.accounts || []).forEach(function (l) { if (l.from === id) l.from = 'salary'; });
      if (d.budget.saveAcct === id) d.budget.saveAcct = null;
      if (d.budget.daily === id) d.budget.daily = 'credit';
      save(d);
    }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('#paAdd'); if (!f) return;
    e.preventDefault();
    var d = data(); if (!d) return;
    var name = f.n.value.trim().slice(0, 40); if (!name) { f.n.focus(); return; }
    d.budget.acctList = Array.isArray(d.budget.acctList) ? d.budget.acctList : [];
    d.budget.acctList.push({ id: 'ac' + Date.now().toString(36), kind: f.k.value, name: name });
    acctAdding = false; if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    save(d);
  });

  /* ================= Loans (Plan) ================= */
  var tryExtra = {};
  function renderLoans(d) {
    var box = $('fpLoans'); if (!box || !Lo) return;
    var loans = (d.accounts || []).filter(function (a) { return a.kind === 'debt'; });
    if (!loans.length) {
      box.innerHTML = '<p class="empty">Add a mortgage, car loan or student loan with its interest and monthly payment. You see when it’s paid off, what the interest costs, the tax deduction – and what paying a bit more would save. The payment goes into your fixed costs by itself.</p>';
      return;
    }
    var yearTax = 0;
    box.innerHTML = '<ul class="ln-list">' + loans.map(function (l) {
      var c = Lo.calc(l), x = tryExtra[l.id] || 0, cx = x ? Lo.calc(l, x) : null;
      if (c && !c.never) yearTax += c.taxBack;
      var head = '<div class="ln-top"><span class="ln-name"><b>' + esc(l.name) + '</b><small>' + (l.rate ? esc(String(l.rate).replace('.', ',')) + ' % · ' : '') + (l.pay ? esc(kr(l.pay)) + ' a month' + (l.fee ? ' + ' + esc(kr(l.fee)) + ' fee' : '') : 'no payment set') +
        (l.fixed !== false && l.pay ? ' · <i class="bi bi-link-45deg"></i> in fixed costs' : '') + '</small></span>' + money(c ? -c.balance : -l.balance, 'neg') +
        '<button type="button" class="icon-btn sm" data-lnedit="' + esc(l.id) + '" aria-label="Change ' + esc(l.name) + '"><i class="bi bi-pencil"></i></button></div>';
      if (!c) return '<li class="ln">' + head + '<p class="muted ln-p">Give it an interest rate and a monthly payment (or the years left) to see the maths.</p></li>';
      if (c.never) return '<li class="ln">' + head + '<p class="ln-p neg">The payment doesn’t cover the interest (' + esc(kr(c.interest)) + ' a month) – the loan never gets smaller.</p></li>';
      var paidPct = l.orig > 0 ? Math.min(1, 1 - c.balance / l.orig) : null;
      return '<li class="ln">' + head +
        '<div class="ln-grid">' +
          '<span><small>Paid off</small><b>' + esc(c.endLabel) + '</b></span>' +
          '<span><small>This month</small><b>' + money(c.interest) + ' interest</b><em>' + money(c.principal) + ' off the loan</em></span>' +
          '<span><small>Interest left</small><b>' + money(c.interestLeft) + '</b></span>' +
          '<span><small>Tax deduction</small><b>' + money(c.taxBack) + '</b><em>next 12 months, 22 %</em></span>' +
        '</div>' +
        (paidPct != null ? '<div class="stack ln-bar"><span style="width:' + (paidPct * 100).toFixed(1) + '%;background:var(--accent)"></span></div>' : '') +
        '<label class="ln-try"><span>Pay more each month</span><input type="range" min="0" max="' + Math.max(2000, Math.ceil(l.pay / 1000) * 1000) + '" step="250" value="' + x + '" data-lntry="' + esc(l.id) + '" aria-label="Extra a month for ' + esc(l.name) + '"><b class="ln-x">' + (x ? '+' + esc(kr(x)) : '+0 kr') + '</b></label>' +
        '<p class="ln-p ln-win"' + (cx && !cx.never ? '' : ' hidden') + '>' + (cx && !cx.never ? win(c, cx) : '') + '</p>' +
        (l.asOf ? '<p class="muted ln-p">Balance worked out from ' + esc(kr(l.balance)) + ' on ' + esc(new Date(l.asOf + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })) + ' and the payments since – update it under Wealth now and then.</p>' : '') +
      '</li>';
    }).join('') + '</ul>' +
      (yearTax > 0 ? '<p class="ln-sum"><i class="bi bi-percent"></i> All loans: about ' + money(yearTax) + ' less tax over the next 12 months (rentefradrag)</p>' : '');
  }
  function win(c, cx) { return '<i class="bi bi-stars"></i> Paid off <b>' + esc(cx.endLabel.split(' (')[0]) + '</b> – ' + (c.months - cx.months) + ' months sooner, <b>' + money(c.interestLeft - cx.interestLeft) + '</b> less interest'; }
  function editLoan(id) {
    show('wealth', { keep: true });
    setTimeout(function () {
      if (id) { var li = document.querySelector('#nwList .acc[data-id="' + id + '"]'); if (li) li.click(); }
      else { if ($('nwForm').hidden) $('nwAddBtn').click(); $('nwKind').value = 'debt'; $('nwKind').dispatchEvent(new Event('change')); }
      var f = $('nwForm'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lnedit]'); if (b) { editLoan(b.dataset.lnedit); return; }
    if (e.target.closest('#fpLoanAdd')) editLoan(null);
  });
  document.addEventListener('input', function (e) {
    var r = e.target.closest && e.target.closest('[data-lntry]'); if (!r) return;
    var x = tryExtra[r.dataset.lntry] = +r.value || 0, d = data(); if (!d) return;
    var l = (d.accounts || []).filter(function (a) { return String(a.id) === r.dataset.lntry; })[0]; if (!l) return;
    var li = r.closest('.ln'), c = Lo.calc(l), cx = x ? Lo.calc(l, x) : null, w = li.querySelector('.ln-win');     // only the numbers change – the slider keeps moving
    li.querySelector('.ln-x').textContent = '+' + kr(x);
    w.hidden = !(cx && !cx.never && c && !c.never); w.innerHTML = w.hidden ? '' : win(c, cx);
  });
  /* the first time a loan gets a balance, remember it as the starting point for "how much is paid" */
  function originals(d) {
    var ch = false;
    (d.accounts || []).forEach(function (a) { if (a.kind === 'debt' && !(a.orig > 0) && a.balance > 0 && a.pay > 0) { a.orig = a.balance; ch = true; } });
    if (ch) window.Vault.save(d);
  }

  /* ================= The year ahead (Plan) ================= */
  function renderYear(d) {
    var box = $('fpYearAhead'); if (!box) return;
    if (box.contains(document.activeElement) && document.activeElement.matches('input')) return;
    var now = new Date(), rows = d.budget.income || [], modelled = rows.some(function (r) { return +r.gross > 0; });
    var fixed = sum(d.budget.fixed), months = [];
    for (var i = 0; i < 12; i++) {
      var dt = new Date(now.getFullYear(), now.getMonth() + i, 1), key = ym(dt), inc = B.incomeOf(d, key);
      months.push({ key: key, dt: dt, net: inc.net, note: inc.note, hol: inc.rows.some(function (r) { return r.holiday; }), half: /Half tax/.test(inc.note || '') });
    }
    var tb = d.budget.taxBack || {};
    if (tb.amount && /^\d{4}-\d{2}$/.test(tb.month || '')) months.forEach(function (m) { if (m.key === tb.month) m.tax = +tb.amount; });
    var ord = rows.reduce(function (a, r) { return a + B.ordinary(r); }, 0);
    var max = Math.max.apply(null, months.map(function (m) { return m.net + Math.max(0, m.tax || 0); }).concat([fixed, 1]));
    var y = String(now.getFullYear());
    var bsu = (d.savings || []).filter(function (g) { return g.bsu; }), bsuIn = sum(bsu, function (g) { return (g.yr || {})[y] || 0; });
    var loanTax = Lo ? (d.accounts || []).filter(function (a) { return a.kind === 'debt'; }).reduce(function (a, l) { var c = Lo.calc(l); return a + (c && !c.never ? c.taxBack : 0); }, 0) : 0;
    var june = months.filter(function (m) { return m.hol; })[0], dec = months.filter(function (m) { return m.half; })[0];
    var facts = [];
    if (june) facts.push(['sun', '#c98500', 'Holiday pay in ' + june.dt.toLocaleDateString('en-GB', { month: 'long' }), money(june.net) + ' paid out – ' + money(Math.abs(june.net - ord)) + (june.net >= ord ? ' more' : ' less') + ' than a normal month, no tax on the holiday pay']);
    if (dec) facts.push(['snow', '#3987e5', 'Half tax in December', money(dec.net) + ' – ' + money(Math.max(0, dec.net - ord)) + ' more than usual']);
    if (bsu.length) facts.push(['house-heart', '#22b35e', 'BSU this year', money(Math.min(bsuIn, 27500)) + ' of 27 500 kr put in → ' + money(Math.min(bsuIn, 27500) * 0.1) + ' less tax' + (bsuIn < 27500 ? ' · ' + money(27500 - bsuIn) + ' more fills it up' : ' · full for ' + y)]);
    if (loanTax > 0) facts.push(['percent', '#8a6fdf', 'Interest deduction', 'About ' + money(loanTax) + ' less tax over the next 12 months from your loans']);
    if (tb.amount) facts.push(['bank', tb.amount > 0 ? '#22b35e' : '#e66767', 'Tax settlement', (tb.amount > 0 ? money(tb.amount) + ' back' : money(-tb.amount) + ' to pay') + (tb.month ? ' in ' + new Date(tb.month + '-15T12:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '')]);
    $('fpYearNote').textContent = modelled ? '' : 'net salary';
    box.innerHTML =
      '<div class="ya-bars" role="img" aria-label="Income month by month for the next 12 months">' + months.map(function (m) {
        var h = m.net / max * 100, th = m.tax > 0 ? m.tax / max * 100 : 0;
        return '<span class="ya-m' + (m.hol ? ' hol' : '') + (m.half ? ' half' : '') + (m.key === ym(now) ? ' now' : '') + '" title="' + esc(m.dt.toLocaleDateString('en-GB', { month: 'long' }) + ': ' + kr(m.net) + (m.note ? ' · ' + m.note : '') + (m.tax ? ' · tax settlement ' + kr(m.tax) : '')) + '">' +
          '<i style="height:' + (h * .82).toFixed(1) + '%"></i>' + (th ? '<i class="ya-tax" style="height:' + (th * .82).toFixed(1) + '%"></i>' : '') + '<small>' + esc(m.dt.toLocaleDateString('en-GB', { month: 'narrow' })) + '</small></span>';
      }).join('') + '<b class="ya-fixed" style="bottom:calc((100% - 18px) * ' + (fixed / max * .82).toFixed(3) + ' + 18px)" title="Fixed costs ' + esc(kr(fixed)) + '"></b></div>' +
      '<p class="muted ya-leg"><i class="dot" style="background:var(--accent)"></i> Net pay <i class="dot" style="background:#c98500"></i> Holiday pay <i class="dot" style="background:#3987e5"></i> Half tax <span class="ya-line"></span> Fixed costs</p>' +
      (facts.length ? '<ul class="ya-facts">' + facts.map(function (f) { return '<li><i class="bi bi-' + f[0] + '" style="color:' + f[1] + '"></i><span><b>' + esc(f[2]) + '</b><small>' + f[3] + '</small></span></li>'; }).join('') + '</ul>' : '') +
      (!modelled ? '<p class="muted ya-p"><i class="bi bi-info-circle"></i> Enter your salary as <b>gross with tax %</b> (Monthly budget → Edit → the salary) and tick “paid by the year” – then holiday pay in June and half tax in December are worked out here and in the budget.</p>' : '') +
      '<div class="ya-tb"><p class="pa-h">Tax settlement (skatteoppgjør)</p><div class="row2">' +
        '<label class="sv-by"><span>Back (+) or to pay (−), kr</span><input data-yatb inputmode="decimal" value="' + esc(tb.amount || '') + '" placeholder="From the tax return" autocomplete="off"></label>' +
        '<label class="sv-by"><span>When</span><input data-yatbm type="month" value="' + esc(tb.month || '') + '"></label></div></div>';
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.closest || !t.closest('#fpYearAhead')) return;
    var d = data(); if (!d) return;
    d.budget.taxBack = d.budget.taxBack || {};
    if (t.hasAttribute('data-yatb')) d.budget.taxBack.amount = Math.round(num(t.value) || 0);
    else if (t.hasAttribute('data-yatbm')) d.budget.taxBack.month = t.value;
    else return;
    save(d); setTimeout(function () { renderYear(data()); }, 0);
  });

  /* ================= Spending limits per category (Overview) =================
     d.budget.limits = { groceries: 5000, eating: 1500, … } – kr per budget period (payday → payday, or the month) */
  var CATS = [['groceries', 'Groceries', '#11a597', 'basket'], ['eating', 'Eating out', '#d95926', 'cup-hot'], ['transport', 'Transport', '#3987e5', 'bus-front'], ['shopping', 'Shopping', '#c98500', 'bag'],
    ['fun', 'Fun', '#d55181', 'controller'], ['health', 'Health', '#8a6fdf', 'heart-pulse'], ['travel', 'Travel', '#0891b2', 'airplane'], ['other', 'Other', '#6b6d73', 'three-dots']];
  var limEditing = false;
  /* what you usually spend per category in a budget period: the average of the last three full months */
  function usual(d) {
    var now = new Date(), from = ym(new Date(now.getFullYear(), now.getMonth() - 3, 1)), to = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)), out = {}, months = {};
    (d.expenses || []).forEach(function (e) { var k = String(e.date).slice(0, 7); if (k < from || k > to) return; months[k] = 1; out[e.cat] = (out[e.cat] || 0) + (+e.amount || 0); });
    var n = Math.max(1, Object.keys(months).length);
    Object.keys(out).forEach(function (k) { out[k] = Math.ceil(out[k] / n / 100) * 100; });
    return out;
  }
  function renderLimits(d) {
    var box = $('fpLimits'); if (!box) return;
    if (box.contains(document.activeElement) && document.activeElement.matches('input')) return;
    var lim = d.budget.limits || {}, per = B.period(d), p = plan(d), have = Object.keys(lim).filter(function (k) { return +lim[k] > 0; });
    var spent = {}; (d.expenses || []).forEach(function (e) { if (per.has(e.date)) spent[e.cat] = (spent[e.cat] || 0) + (+e.amount || 0); });
    var elapsed = Math.max(1, per.days - per.daysLeft + 1), share = elapsed / per.days, total = sum(have, function (k) { return lim[k]; });
    $('fpLimitEdit').textContent = limEditing ? 'Done' : have.length ? 'Change' : 'Set limits';
    if (limEditing) {
      var u = usual(d);
      box.innerHTML = '<p class="muted pa-p">How much may each kind of spending take ' + (per.byPayday ? 'from payday to payday' : 'a month') + '? Leave it empty for no limit. <i>Usually</i> is what you spent on average the last three months.</p>' +
        '<ul class="lm-edit">' + CATS.map(function (c) {
          return '<li><span><i class="bi bi-' + c[3] + '" style="color:' + c[2] + '"></i> ' + c[1] + (u[c[0]] ? '<small>usually ' + esc(kr(u[c[0]])) + '</small>' : '') + '</span>' +
            '<input data-lim="' + c[0] + '" inputmode="decimal" value="' + esc(lim[c[0]] || '') + '" placeholder="' + (u[c[0]] ? esc(String(u[c[0]])) : 'No limit') + '" aria-label="Limit for ' + c[1] + '" autocomplete="off"></li>';
        }).join('') + '</ul>' +
        '<div class="lm-acts">' + (Object.keys(u).length ? '<button type="button" class="text-btn" data-limusual><i class="bi bi-magic"></i> Use what I usually spend</button>' : '') + '<span class="spacer"></span><button type="button" class="pill-btn" data-limdone>Done</button></div>' +
        lmRoom(p, total);
      return;
    }
    if (!have.length) {
      box.innerHTML = '<p class="empty">Give groceries, eating out and the rest a limit for the period. You see what’s left in each, how much a day – and if you’re spending faster than the days go.</p>';
      return;
    }
    var rows = CATS.filter(function (c) { return +lim[c[0]] > 0 || spent[c[0]] > 0; }).map(function (c) {
      var L = +lim[c[0]] || 0, sp = spent[c[0]] || 0, left = L - sp, pct = L ? Math.min(1, sp / L) : 1, pace = L ? sp / (L * share) : 0;
      var state = !L ? 'free' : left < 0 ? 'over' : pace > 1.15 && share < .95 ? 'fast' : 'ok';
      var note = !L ? 'no limit' : left < 0 ? money(-left) + ' over' : money(left) + ' left · ' + money(left / Math.max(1, per.daysLeft)) + '/day' + (state === 'fast' ? ' · <span class="lm-fast">faster than the days</span>' : '');
      return '<li class="lm ' + state + '"><span class="lm-n"><i class="bi bi-' + c[3] + '" style="color:' + c[2] + '"></i> ' + c[1] + '<small>' + note + '</small></span>' +
        '<span class="lm-v">' + money(sp) + (L ? '<small>of ' + esc(kr(L)) + '</small>' : '') + '</span>' +
        (L ? '<span class="lm-bar"><i style="width:' + (pct * 100).toFixed(1) + '%;background:' + (state === 'over' ? 'var(--danger)' : state === 'fast' ? '#c98500' : c[2]) + '"></i><b style="left:' + (Math.min(1, share) * 100).toFixed(1) + '%" title="Where you’d be if you spent evenly"></b></span>' : '') + '</li>';
    }).join('');
    box.innerHTML = '<ul class="lm-list">' + rows + '</ul>' + lmRoom(p, total);
  }
  function lmRoom(p, total) {
    if (!(p.per.income > 0)) return '';
    var free = p.room - total;
    return '<p class="lm-room' + (free < 0 ? ' neg' : '') + '"><i class="bi bi-' + (free < 0 ? 'exclamation-triangle' : 'shield-check') + '"></i> ' +
      (free < 0 ? 'Your limits are ' + money(-free) + ' more than you have after fixed costs (' + money(p.room) + ')' : money(free) + ' after fixed costs isn’t given to a category – your buffer') + '</p>';
  }
  $('fpLimitEdit') && $('fpLimitEdit').addEventListener('click', function () { limEditing = !limEditing; var d = data(); if (d) renderLimits(d); if (limEditing) { var i = document.querySelector('#fpLimits input'); if (i) i.focus(); } });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#fpLimits')) return;
    var d = data(); if (!d) return;
    if (e.target.closest('[data-limdone]')) { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); limEditing = false; renderLimits(d); return; }
    if (e.target.closest('[data-limusual]')) { d.budget.limits = usual(d); save(d); setTimeout(function () { renderLimits(data()); }, 0); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.dataset || !t.dataset.lim) return;
    var d = data(); if (!d) return;
    d.budget.limits = d.budget.limits || {};
    var v = Math.round(num(t.value) || 0); if (v > 0) d.budget.limits[t.dataset.lim] = v; else delete d.budget.limits[t.dataset.lim];
    save(d);
    var r = document.querySelector('#fpLimits .lm-room'); if (r) r.outerHTML = lmRoom(plan(d), sum(Object.keys(d.budget.limits), function (k) { return d.budget.limits[k]; }));
  });

  /* ================= Yearly costs (Plan) =================
     Insurance, car service, the TV licence, Christmas … paid once or twice a year. A twelfth of the
     total is set aside every month as one fixed cost, so the month they're due doesn't break the budget.
     d.budget.yearly = [{ id, name, amount, month (1–12) }] */
  var yrEditing = null;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function syncYearly(d) {
    var list = d.budget.yearly || [], total = sum(list), fixed = d.budget.fixed;
    var want = total > 0 ? [{ id: 'year-all', name: 'Yearly costs (set aside)', amount: Math.ceil(total / 12 / 10) * 10, day: null, src: 'year', acct: (d.budget.yearAcct || 'salary') }] : [];
    if (JSON.stringify(fixed.filter(function (f) { return f.src === 'year'; })) === JSON.stringify(want)) return false;
    d.budget.fixed = fixed.filter(function (f) { return f.src !== 'year'; }).concat(want);
    return true;
  }
  function renderYearly(d) {
    var box = $('fpYearly'); if (!box) return;
    if (box.contains(document.activeElement) && document.activeElement.matches('input, select')) return;
    var list = (d.budget.yearly || []).slice(), total = sum(list), now = new Date(), m0 = now.getMonth() + 1;
    list.sort(function (a, b) { return ((a.month - m0 + 12) % 12) - ((b.month - m0 + 12) % 12); });
    var form = function (y) {
      return '<form class="inline-form yr-form" data-yrid="' + (y ? esc(y.id) : 'new') + '"><input name="n" placeholder="e.g. Car insurance" value="' + esc(y ? y.name : '') + '" required autocomplete="off">' +
        '<div class="row2"><input name="a" placeholder="kr a year" inputmode="decimal" value="' + esc(y ? y.amount : '') + '" required autocomplete="off"><select name="m" aria-label="Month it’s paid">' +
        MONTHS.map(function (n, i) { return '<option value="' + (i + 1) + '"' + ((y ? y.month : m0) === i + 1 ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
        '<div class="form-actions">' + (y ? '<button type="button" class="text-btn danger" data-yrdel>Delete</button>' : '') + '<span class="spacer"></span><button type="button" class="text-btn" data-yrcancel>Cancel</button><button type="submit" class="pill-btn">Save</button></div></form>';
    };
    box.innerHTML = (yrEditing === 'new' ? form(null) : '') +
      (list.length ? '<p class="yr-sum"><b>' + money(Math.ceil(total / 12 / 10) * 10) + '</b> a month set aside · ' + money(total) + ' a year · <i class="bi bi-link-45deg"></i> in fixed costs</p>' +
        '<ul class="yr-list">' + list.map(function (y) {
          if (yrEditing === y.id) return '<li>' + form(y) + '</li>';
          var inM = (y.month - m0 + 12) % 12;
          return '<li class="yr" data-yr="' + esc(y.id) + '"><span><b>' + esc(y.name) + '</b><small>' + MONTHS[y.month - 1] + (inM === 0 ? ' · this month' : inM === 1 ? ' · next month' : ' · in ' + inM + ' months') + '</small></span>' + money(y.amount) + '</li>';
        }).join('') + '</ul>'
      : yrEditing ? '' : '<p class="empty">Bills that come once a year – insurance, car service, the TV licence, Christmas presents. A twelfth is set aside each month, so the month they’re due is like any other.</p>');
    var f = box.querySelector('.yr-form input[name="n"]'); if (f && !f.value) f.focus();
  }
  $('fpYearlyAdd') && $('fpYearlyAdd').addEventListener('click', function () { yrEditing = yrEditing === 'new' ? null : 'new'; var d = data(); if (d) renderYearly(d); });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#fpYearly')) return;
    var d = data(); if (!d) return;
    if (e.target.closest('[data-yrcancel]')) { yrEditing = null; renderYearly(d); return; }
    if (e.target.closest('[data-yrdel]')) {
      var id = e.target.closest('form').dataset.yrid; d.budget.yearly = (d.budget.yearly || []).filter(function (y) { return y.id !== id; });
      yrEditing = null; syncYearly(d); save(d); return;
    }
    var li = e.target.closest('[data-yr]'); if (li) { yrEditing = li.dataset.yr; renderYearly(d); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('.yr-form'); if (!f) return;
    e.preventDefault();
    var d = data(); if (!d) return;
    var a = Math.round(num(f.a.value) || 0); if (!(a > 0)) { f.a.focus(); return; }
    var rec = { name: f.n.value.trim().slice(0, 50), amount: a, month: +f.m.value };
    d.budget.yearly = d.budget.yearly || [];
    if (f.dataset.yrid === 'new') d.budget.yearly.push(Object.assign({ id: Date.now().toString(36) }, rec));
    else d.budget.yearly.forEach(function (y) { if (y.id === f.dataset.yrid) Object.assign(y, rec); });
    yrEditing = null; document.activeElement && document.activeElement.blur && document.activeElement.blur();
    syncYearly(d); save(d);
  });

  /* ================= Buffer (Plan) =================
     An emergency fund: N months (d.budget.bufMonths, default 3) of what a month costs you – fixed costs
     (not savings) plus what you usually spend. It's a savings goal marked buffer; its target follows the
     maths (g.autoT) until you change the target yourself. */
  function monthNeed(d) {
    var fixed = sum(d.budget.fixed.filter(function (f) { return f.src !== 'save'; }));
    var u = usual(d), every = sum(Object.keys(u), function (k) { return u[k]; });
    if (!every) { var lim = d.budget.limits || {}; every = sum(Object.keys(lim), function (k) { return lim[k]; }); }
    return { fixed: fixed, every: every, total: fixed + every };
  }
  function renderBuf(d) {
    var box = $('fpBuf'); if (!box) return;
    var n = monthNeed(d), months = +d.budget.bufMonths || 3, target = Math.ceil(n.total * months / 1000) * 1000;
    var g = (d.savings || []).filter(function (x) { return x.buffer; })[0];
    $('fpBufNote').textContent = '';
    var seg = '<div class="seg bf-seg" role="group" aria-label="How many months">' + [1, 2, 3, 4, 6].map(function (m) { return '<button type="button" data-bfm="' + m + '" aria-pressed="' + (m === months) + '">' + m + ' mo</button>'; }).join('') + '</div>';
    if (!(n.total > 0)) { box.innerHTML = '<p class="empty">Add your fixed costs (and some spending) first – then the buffer you need is worked out here.</p>'; return; }
    var need = '<p class="muted bf-p">A month costs you about <b>' + money(n.total) + '</b> – ' + money(n.fixed) + ' fixed + ' + money(n.every) + ' ' + (Object.keys(usual(d)).length ? 'usual spending' : 'spending limits') + '.</p>';
    if (!g) {
      box.innerHTML = need + seg + '<div class="bf-goal"><span>Your buffer for ' + months + ' month' + (months === 1 ? '' : 's') + '</span><b>' + money(target) + '</b></div>' +
        '<p class="muted bf-p">Money for the unexpected – losing the job, the car, the dentist – so it never goes on the credit card. 3 months is the usual advice.</p>' +
        '<div class="form-actions"><span class="spacer"></span><button type="button" class="pill-btn" data-bfmake><i class="bi bi-plus-lg"></i> Make it a savings goal</button></div>';
      return;
    }
    if (g.autoT !== false && Math.abs((+g.target || 0) - target) > 500) { g.target = target; window.Vault.save(d); setTimeout(function () { window.dispatchEvent(new Event('fin:change')); }, 0); }
    var cov = n.total ? (+g.saved || 0) / n.total : 0, pct = Math.min(1, cov / months);
    var fc = B.saveForecast && +g.monthly > 0 ? B.saveForecast(g) : null, mo = B.saveMonthly ? B.saveMonthly(g) : 0;
    box.innerHTML = need + seg +
      '<div class="bf-big"><b>' + (cov >= 10 ? Math.round(cov) : cov.toFixed(1).replace('.', ',')) + '</b><span>month' + (cov === 1 ? '' : 's') + ' covered<small>' + money(g.saved) + ' of ' + money(g.target) + '</small></span></div>' +
      '<div class="bf-bar"><i style="width:' + (pct * 100).toFixed(1) + '%"></i>' + Array.apply(null, Array(months - 1)).map(function (x, i) { return '<b style="left:' + ((i + 1) / months * 100).toFixed(1) + '%"></b>'; }).join('') + '</div>' +
      '<p class="muted bf-p">' + (pct >= 1 ? '<i class="bi bi-check2-circle" style="color:var(--accent)"></i> Full – anything more can go to other goals.' :
        mo ? 'Saving ' + money(mo) + ' a month' + (fc && fc.label ? ' gets you there ' + esc(fc.label) : g.by ? ' gets you there by ' + esc(new Date(g.by + 'T12:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })) : '') + '.' :
        'Give the goal an amount a month (Savings goals → Buffer) to see when it’s full.') +
        (g.autoT === false ? ' · Your own target – <button type="button" class="text-btn" data-bfauto>follow the maths</button>' : '') + '</p>';
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#fpBuf')) return;
    var d = data(); if (!d) return;
    var m = e.target.closest('[data-bfm]');
    if (m) { d.budget.bufMonths = +m.dataset.bfm; save(d); return; }
    if (e.target.closest('[data-bfauto]')) { (d.savings || []).forEach(function (g) { if (g.buffer) g.autoT = true; }); save(d); return; }
    if (e.target.closest('[data-bfmake]')) {
      var n = monthNeed(d), months = +d.budget.bufMonths || 3;
      d.savings = d.savings || [];
      var nid = Date.now().toString(36) + 'b';
      d.savings.unshift({ id: nid, name: 'Buffer', saved: 0, target: Math.ceil(n.total * months / 1000) * 1000, buffer: true, autoT: true, monthly: 0, aside: false });
      save(d);
      var tries = 0;
      (function openIt() {             // open it (once Savings goals has drawn it) to set how much a month
        var li = document.querySelector('#svList .goal[data-id="' + nid + '"]');
        if (li) { li.click(); var f = $('svForm'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' }); var m = $('svMonthly'); if (m) setTimeout(function () { m.focus(); }, 300); }
        else if (tries++ < 20) setTimeout(openIt, 60);
      })();
    }
  });
  /* changing the buffer goal's target by hand stops it following the maths */
  document.addEventListener('submit', function (e) {
    if (!e.target.closest || !e.target.closest('#svForm')) return;
    var d0 = data(), before = {}; if (!d0) return;
    (d0.savings || []).forEach(function (g) { if (g.buffer) before[g.id] = +g.target; });
    setTimeout(function () {
      var d = data(); if (!d) return; var ch = false;
      (d.savings || []).forEach(function (g) { if (g.buffer && before[g.id] != null && +g.target !== before[g.id] && g.autoT !== false) { g.autoT = false; ch = true; } });
      if (ch) save(d); else render();
    }, 0);
  }, true);
  /* savings goals and net worth save without telling anyone – redraw what depends on them */
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#svList [data-sv], #svDelete, #nwDelete')) setTimeout(render, 0); });
  document.addEventListener('submit', function (e) { if (e.target.closest && e.target.closest('#nwForm')) setTimeout(render, 50); });
  /* the loan form's "Paid from" lists your accounts */
  function fillFrom(d) {
    var s = $('nwFrom'); if (!s) return;
    var v = s.value, html = window.Accts.list(d).filter(function (a) { return a.kind !== 'savings'; }).map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.label) + '</option>'; }).join('');
    if (s._h !== html) { s.innerHTML = html; s._h = html; s.value = v || 'salary'; }
  }

  /* ================= drawing ================= */
  function render() {
    var d = data(); if (!d) return;
    try { originals(d); if (syncYearly(d)) { save(d); return; } fillFrom(d); renderFlow(d); renderLimits(d); renderAcct(d); renderBuf(d); renderYearly(d); renderLoans(d); renderYear(d); } catch (e) { console.error(e); }
  }
  window.addEventListener('fin:change', function () { setTimeout(render, 0); });
  window.addEventListener('features:change', render);
  window.Vault.onUnlock(function () { render(); fromHash(); });
  window.Vault.onLock(function () { ['fpFlow', 'fpLimits', 'fpAcct', 'fpBuf', 'fpYearly', 'fpLoans', 'fpYearAhead'].forEach(function (id) { if ($(id)) $(id).innerHTML = ''; }); });
  window.FinTabs = { show: show, current: current, go: goCard, plan: function () { var d = data(); return d ? plan(d) : null; } };
})();
