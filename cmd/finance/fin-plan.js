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
  var VIEWS = ['now', 'tx', 'insights', 'setup'], OLD = { overview: 'now', plan: 'setup', wealth: 'insights' };
  function current() { return main.dataset.tab || 'now'; }
  function show(tab, opts) {
    if (OLD[tab]) tab = OLD[tab];
    if (VIEWS.indexOf(tab) < 0) tab = 'now';
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
    /* #subs, #recur, #shared … – a card mounted by id: open the tab it's on */
    else if (/^#[a-z]+$/.test(location.hash)) { var t0 = document.querySelector('#fp [data-tool="' + location.hash.slice(1) + '"]') || document.getElementById(location.hash.slice(1)); if (t0 && tabOf(t0)) show(tabOf(t0), { keep: true }); }
  }
  window.addEventListener('hashchange', fromHash);
  if (/[?&]customize/.test(location.search)) main.classList.add('fp-all');      // customizing shows every card
  (function () { var t = null; try { t = localStorage.getItem('dash.finTab'); } catch (e) {} show(t || 'now', { keep: true }); fromHash(); })();
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
      box.innerHTML = '<p class="empty">Add your salary under Setup → Income &amp; fixed costs, and choose which account pays each fixed cost under <button type="button" class="text-btn" data-ftab-go="setup" data-fp-to="accounts">Plan → Accounts</button>. Then this shows what to move where on payday.</p>';
      return;
    }
    /* the month as you'd work it out yourself: salary − credit cards − loans − other bills − savings = left */
    var cards = B.cardBills(d), A = window.Accts;
    var cardPay = sum(cards, function (c) { return c.amount; });
    var nonCredit = sum(p.list.filter(function (a) { return a.kind !== 'credit'; }), function (a) { return by[a.id]; });
    var other = Math.max(0, nonCredit - p.loans), saving = p.save + p.yearly, leftM = inc - cardPay - p.loans - other - saving;
    var segs = [
      ['Credit cards', cardPay, '#d95926', cards.map(function (c) { return c.acct.label + ' ' + kr(c.amount) + (c.owedNow ? ' (owed now)' : c.known ? ' (last month)' : ''); }).join(' · ')],
      ['Loans', p.loans, '#8a6fdf', ''],
      ['Other bills', other, '#3987e5', ''],
      ['Savings & yearly costs', saving, '#22b35e', ''],
      ['Salary left for everyday', Math.max(0, leftM), 'var(--accent)', '']
    ].filter(function (s0) { return s0[1] > 0; });
    var tot = Math.max(inc, sum(segs, function (s) { return s[1]; }), 1);
    var openN = p.open.length, payday = p.per.byPayday && p.per.days - p.per.daysLeft < 7;
    box.innerHTML =
      '<div class="pf-in"><span><i class="bi bi-' + p.main.icon + '"></i> Salary in · ' + esc(p.main.label) + '</span><b>' + money(inc) + '</b></div>' +
      '<div class="stack pf-bar" role="img" aria-label="Where the salary goes">' + segs.map(function (s) { return '<span style="width:' + (s[1] / tot * 100).toFixed(2) + '%;background:' + s[2] + '"></span>'; }).join('') + '</div>' +
      '<ul class="pf-wf">' + segs.map(function (s0) { var last = s0[0] === 'Salary left for everyday'; return '<li class="' + (last ? 'pf-eq' : '') + '"><i class="dot" style="background:' + s0[2] + '"></i><span>' + (last ? '= ' : '− ') + esc(s0[0]) + (s0[3] ? '<small>' + esc(s0[3]) + '</small>' : '') + '</span><b>' + money(last ? leftM : s0[1]) + '</b></li>'; }).join('') +
        (leftM < 0 ? '<li class="pf-eq neg"><i class="dot" style="background:var(--danger)"></i><span>= The salary doesn’t cover these</span><b>' + money(leftM) + '</b></li>' : '') + '</ul>' +
      '<p class="muted pf-note"><i class="bi bi-info-circle"></i> This is the plan for one salary. The number at the top of Now is different: it’s what’s really in your accounts today, until payday.</p>' +
      (p.moves.length ? '<p class="pf-h">Payday checklist' + (openN ? ' · <span class="' + (payday ? 'pf-due' : '') + '">' + openN + ' to do</span>' : ' · <span class="pf-ok"><i class="bi bi-check2-all"></i> all done</span>') + '</p><ul class="pf-moves pf-check">' + p.moves.map(function (m) {
        return '<li class="' + (m.done ? 'done' : '') + '"><button type="button" class="check" data-pfmove="' + esc(m.id) + '" aria-pressed="' + m.done + '" aria-label="' + esc(m.label) + (m.done ? ' – done' : ' – mark as done') + '"><i class="bi bi-check-lg"></i></button><span>' + esc(m.label) + '<small>' + esc(m.sub) + '</small></span><b>' + money(m.amount) + '</b></li>';
      }).join('') + '</ul>' : '') +
      '';
  }
  window.FinCC = function (c) { return ccLine(c); };       // used by Next 14 days
  /* one credit card's bill this month: amount, due day, paid in full (and what paying only part would cost) */
  function ccLine(c) {
    if (!c.amount && !c.due) return '';
    var late = c.due && !c.paid && c.days < 0, soon = c.due && !c.paid && c.days >= 0 && c.days <= 5;
    var when = !c.due ? '<button type="button" class="text-btn" data-ftab-go="setup" data-fp-to="accounts">Set the due day</button>' :
      c.paid ? 'Paid in full' : late ? '<span class="late">' + (-c.days) + ' day' + (c.days === -1 ? '' : 's') + ' overdue</span>' : c.days === 0 ? '<span class="soon">Due today</span>' : 'Due ' + c.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · in ' + c.days + ' day' + (c.days === 1 ? '' : 's');
    return '<div class="pf-cc' + (c.paid ? ' paid' : late ? ' late' : soon ? ' soon' : '') + '"><button type="button" class="check" data-pfcc="' + esc(c.acct.id) + '" aria-pressed="' + c.paid + '" aria-label="' + esc(c.acct.label) + (c.paid ? ' – paid in full' : ' – mark as paid in full') + '"><i class="bi bi-check-lg"></i></button>' +
      '<span><b>' + esc(c.acct.label) + ' bill</b><small>' + when + (c.known ? (c.owedNow ? ' · what you owe now' : '') : ' · put in what you owe under Your accounts') + '</small></span>' + money(c.amount) + '</div>' +
      (!c.paid && c.amount > 0 ? '<p class="pf-warn"><i class="bi bi-exclamation-diamond"></i> Pay the <b>whole</b> bill – card interest is often 20–25 % a year, about ' + money(c.interest) + ' a month on this amount.</p>' : '');
  }
  document.addEventListener('click', function (e) {
    var mv = e.target.closest('[data-pfmove]'), cc = e.target.closest('[data-pfcc]'); if (!mv && !cc) return;
    var d = data(); if (!d) return;
    if (mv) {
      var k = B.period(d).startKey, all = d.budget.payDone = d.budget.payDone || {}, m = all[k] = all[k] || {}, id = mv.dataset.pfmove;
      var pp = B.payPlan(d), move = pp.moves.filter(function (x) { return x.id === id; })[0];
      /* ticking a move moves the money: out of the salary account, into the account it goes to, onto the savings goal.
         What was moved is remembered on the tick, so unticking puts it back exactly. */
      var shift = function (rec, sign) {
        if (!rec || typeof rec !== 'object') return;
        var L = d.budget.acctList = Array.isArray(d.budget.acctList) ? d.budget.acctList : [];
        var bump = function (aid, v) { var a = L.filter(function (x) { return x.id === aid; })[0]; if (a && a.bal != null) a.bal = Math.round((+a.bal + v) * 100) / 100; };
        if (rec.from) bump(rec.from, -sign * rec.amt);
        if (rec.to) bump(rec.to, sign * rec.amt);
        if (rec.goal) (d.savings || []).forEach(function (g) {
          if (g.id !== rec.goal) return;
          g.saved = Math.max(0, (+g.saved || 0) + sign * rec.amt);
          var y = String(new Date().getFullYear()); g.yr = g.yr || {}; g.yr[y] = Math.max(0, (+g.yr[y] || 0) + sign * rec.amt);
        });
      };
      if (m[id]) { shift(m[id], -1); delete m[id]; }
      else {
        var rec = move ? { amt: Math.round(move.amount), from: pp.main && pp.main.id, to: move.to || null, goal: move.goal || null } : true;
        m[id] = rec; shift(rec, 1);
        if (move && (move.goal || move.to)) setTimeout(function () { if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-check-lg"></i> ' + esc(kr(move.amount)) + ' moved' + (move.goal ? ' – added to the goal' : '')); }, 0);
      }
      if (window.Links) setTimeout(window.Links.syncSave, 0);              // a goal that grew may need less a month
      Object.keys(all).sort().slice(0, -6).forEach(function (x) { delete all[x]; });        // keep the last six periods
    } else {
      var now = new Date(), key = cc.dataset.pfcc + ':' + now.getFullYear() + '-' + pad(now.getMonth() + 1), pd = d.budget.ccPaid = d.budget.ccPaid || {};
      if (pd[key]) delete pd[key]; else pd[key] = true;
      Object.keys(pd).sort(function (a, b) { return a.slice(-7) < b.slice(-7) ? -1 : 1; }).slice(0, -24).forEach(function (x) { delete pd[x]; });
    }
    save(d);
  });

  /* ================= Your accounts – what's actually in them (Overview) =================
     Each account's balance (bal, balAt, balSrc 'hand'|'import'); credit cards: what you owe + the limit. */
  var monEditing = false;
  function ago(k) {
    if (!k) return '';
    var n = Math.round((new Date(new Date().toDateString()) - new Date(k + 'T00:00')) / 864e5);
    return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago';
  }
  function seeded(d) { return (d.budget.acctList || []).some(function (a) { return a.bal != null || ['salary', 'credit', 'card'].indexOf(a.id) < 0; }); }
  function renderMoney(d) {
    var box = $('fpMoney'); if (!box) return;
    if (box.contains(document.activeElement) && document.activeElement.matches('input')) return;
    var A = window.Accts, list = A.list(d), m = A.money(d);
    $('fpMoneyEdit').textContent = monEditing ? 'Done' : 'Update';
    var setup = !seeded(d) ? '<div class="mn-setup"><p><b>Set up Finances</b><span class="muted">Accounts, salary and what goes out each month – 4 short steps.</span></p><button type="button" class="pill-btn" data-fsopen="0"><i class="bi bi-magic"></i> Start</button></div>' : '';
    var row = function (a) {
      var cr = a.kind === 'credit', v = a.bal;
      if (monEditing) return '<li class="mn-row ed"><span class="pa-ico" style="--c:' + a.c + '"><i class="bi bi-' + a.icon + '"></i></span><span class="mn-n">' + esc(a.label) + '<small>' + (cr ? 'What you owe now' : 'What’s in it now') + '</small></span>' +
        '<input data-mnbal="' + esc(a.id) + '" inputmode="decimal" value="' + esc(v != null ? String(v).replace('.', ',') : '') + '" placeholder="kr" aria-label="' + esc((cr ? 'Owed on ' : 'Balance of ') + a.label) + '" autocomplete="off">' +
        (cr ? '<input class="mn-lim" data-mnlim="' + esc(a.id) + '" inputmode="decimal" value="' + esc(a.limit || '') + '" placeholder="Limit, kr" aria-label="Credit limit of ' + esc(a.label) + '" autocomplete="off">' : '') +
        '<label class="mn-nw"><input type="checkbox" data-mnnw="' + esc(a.id) + '"' + (a.nw ? ' checked' : '') + '> In net worth</label></li>';
      var lim = cr && a.limit ? '<span class="mn-bar"><i style="width:' + Math.min(100, (v || 0) / a.limit * 100).toFixed(1) + '%;background:' + ((v || 0) / a.limit > .8 ? 'var(--danger)' : (v || 0) / a.limit > .5 ? '#c98500' : a.c) + '"></i></span>' : '';
      var sub = v == null ? '<button type="button" class="text-btn" data-mnedit>Add the balance</button>' :
        (cr && a.limit ? money(Math.max(0, a.limit - v)) + ' free of ' + money(a.limit) + ' · ' : '') + esc(ago(a.balAt)) + (a.balSrc === 'import' ? ' · from import' : '') + (a.nw ? '' : ' · not in net worth');
      return '<li class="mn-row' + (v == null ? ' none' : '') + '"><span class="pa-ico" style="--c:' + a.c + '"><i class="bi bi-' + a.icon + '"></i></span><span class="mn-n">' + esc(a.label) + '<small>' + sub + '</small>' + lim + '</span>' +
        (v == null ? '<span class="muted">–</span>' : money(cr ? -Math.max(0, v) : v, cr && v > 0 ? 'neg' : '')) + '</li>';
    };
    box.innerHTML = setup + '<ul class="mn-list">' + list.map(row).join('') + '</ul>' +
      (m.known && !monEditing ? '<div class="mn-tot"><span>In your accounts<b>' + money(m.cash) + '</b></span>' + (m.owed || m.limit ? '<span>Owed on cards<b class="neg">' + money(-m.owed) + '</b></span>' : '') + (m.saved ? '<span>Savings &amp; funds<b>' + money(m.saved) + '</b></span>' : '') + '<span>Net worth<b>' + money(m.worth) + '</b></span></div>' : '') +
      (seeded(d) && !monEditing ? '<button type="button" class="text-btn mn-wiz" data-fsopen="0"><i class="bi bi-magic"></i> Set up step by step</button>' : '') +
      (monEditing ? '<p class="muted mn-p">Type what your bank shows now. Importing a file afterwards moves the balance on by itself (or takes the balance column, when the file has one).</p>' :
        !m.known ? '<p class="muted mn-p">Add what’s in each account – then the budget shows what you can really use, not just what the plan says.</p>' : '');
  }
  function setBal(d, id, patch) {
    var list = d.budget.acctList = Array.isArray(d.budget.acctList) ? d.budget.acctList : [];
    var a = list.filter(function (x) { return x.id === id; })[0];
    if (!a) { var k = window.Accts.get(d, id); a = { id: id, kind: k ? k.kind : id }; list.push(a); }
    Object.assign(a, patch);
  }
  $('fpMoneyEdit') && $('fpMoneyEdit').addEventListener('click', function () { monEditing = !monEditing; if (!monEditing && document.activeElement && document.activeElement.blur) document.activeElement.blur(); var d = data(); if (d) renderMoney(d); if (monEditing) { var i = document.querySelector('#fpMoney input'); if (i) i.focus(); } });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#fpMoney')) return;
    var d = data(); if (!d) return;
    if (e.target.closest('[data-mnedit]')) { monEditing = true; renderMoney(d); var i = document.querySelector('#fpMoney input'); if (i) i.focus(); return; }
    if (e.target.closest('[data-mnseed]')) {
      var have = d.budget.acctList = Array.isArray(d.budget.acctList) ? d.budget.acctList : [], names = d.budget.accts || {};
      window.Accts.STARTER.forEach(function (s0) {
        var a = have.filter(function (x) { return x.id === s0.id; })[0];
        if (a) { if (!a.name && !names[s0.id]) a.name = s0.name; delete a.off; }
        else have.push({ id: s0.id, kind: s0.kind, name: names[s0.id] || s0.name });
      });
      monEditing = true; save(d);
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.dataset || !(t.dataset.mnbal || t.dataset.mnlim || t.dataset.mnnw)) return;
    var d = data(); if (!d) return;
    if (t.dataset.mnnw) { setBal(d, t.dataset.mnnw, { nw: t.checked }); window.Vault.save(d); setTimeout(function () { window.dispatchEvent(new Event('fin:change')); }, 0); return; }
    var v = num(t.value), k = new Date(), key = k.getFullYear() + '-' + pad(k.getMonth() + 1) + '-' + pad(k.getDate());
    if (t.dataset.mnbal) setBal(d, t.dataset.mnbal, t.value.trim() === '' ? { bal: null, balAt: null, balSrc: null } : isFinite(v) ? { bal: Math.round(v * 100) / 100, balAt: key, balSrc: 'hand' } : {});
    else setBal(d, t.dataset.mnlim, { limit: Math.max(0, Math.round(num(t.value) || 0)) });
    window.Vault.save(d);
    setTimeout(function () { window.dispatchEvent(new Event('fin:change')); }, 0);       // the budget follows; the field you're in stays
  });

  /* ================= Accounts & fixed costs (Plan) ================= */
  var acctAdding = false;
  function renderAcct(d) {
    var box = $('fpAcct'); if (!box) return;
    if (box.contains(document.activeElement) && document.activeElement.matches('input, select')) return;
    var A = window.Accts, list = A.list(d), fixed = d.budget.fixed, p = plan(d);
    var opt = function (sel, filter) { return list.filter(filter || function () { return true; }).map(function (a) { return '<option value="' + a.id + '"' + (sel === a.id ? ' selected' : '') + '>' + esc(a.label) + '</option>'; }).join(''); };
    var ofAcct = function (f) { return list.some(function (x) { return x.id === f.acct; }) ? f.acct : p.main.id; };
    /* this month's ticks – the same ones as in Now → Next 14 days */
    var pk = new Date().toISOString().slice(0, 7), paidL = (d.paid && d.paid[pk]) || [], today = new Date().getDate();
    function isPaid(f) { return paidL.indexOf(f.id) > -1 || (f.src === 'sub' && f.day && +f.day <= today); }
    var bills = fixed.filter(function (f) { return f.src !== 'save' && f.src !== 'year'; }), nPaid = bills.filter(isPaid).length, toPay = sum(bills.filter(function (f) { return !isPaid(f); }));
    var used = [], empty = [];
    list.forEach(function (a) {
      var rows = fixed.filter(function (f) { return f.src !== 'save' && f.src !== 'year' && ofAcct(f) === a.id; });
      (rows.length ? used : empty).push({ a: a, rows: rows });
    });
    /* savings goals and yearly costs: shown under the account they go to */
    var saves = fixed.filter(function (f) { return f.src === 'save' || f.src === 'year'; });
    var groups = used.map(function (g) {
      var a = g.a;
      return '<div class="pa-grp"><p class="pa-h"><span class="pa-ico sm" style="--c:' + a.c + '"><i class="bi bi-' + a.icon + '"></i></span>' + esc(a.label) +
        '<small>' + g.rows.length + ' bill' + (g.rows.length === 1 ? '' : 's') + '</small><b>' + money(sum(g.rows)) + '</b></p>' +
        '<ul class="pa-list">' + g.rows.map(function (f) {
          var info = (f.day ? 'the ' + esc(f.day) + '.' : 'no fixed day') + (f.src === 'loan' ? ' · loan' : f.src === 'sub' ? ' · subscription' : '') + (f.until ? ' · until ' + esc(new Date(+f.until.slice(0, 4), +f.until.slice(5, 7) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })) : '') + (f.split ? ' · <i class="bi bi-people"></i> your ' + esc(String(f.split.pct).replace('.', ',')) + ' %' : '') + (f.vary ? ' · <i class="bi bi-graph-up"></i> varies' + (f.usual && !f.split ? ', usually ' + esc(kr(f.usual)) : '') : '');
          var go = f.src === 'loan' ? 'change the loan' : f.src === 'sub' ? 'change the subscription' : 'open where it comes from';
          var pd = isPaid(f), tick = '<button type="button" class="check pa-tick" data-papaid="' + esc(f.id) + '" aria-pressed="' + pd + '" aria-label="' + esc(f.name) + (pd ? ' – paid this month' : ' – mark as paid this month') + '"><i class="bi bi-check-lg"></i></button>';
          return '<li class="' + (pd ? 'pa-paid' : '') + '">' + tick + (f.src ? '<button type="button" class="pa-open" data-pasrc="' + esc(f.src + '|' + f.id) + '" aria-label="' + esc(f.name) + ' – ' + go + '"><span>' + esc(f.name) + '<small>' + info + ' · <i class="bi bi-link-45deg"></i> ' + go + '</small></span><i class="bi bi-pencil" aria-hidden="true"></i></button>' : '<button type="button" class="pa-open" data-fbopen="' + esc(f.id) + '" aria-label="Change ' + esc(f.name) + '"><span>' + esc(f.name) + '<small>' + info + '</small></span><i class="bi bi-pencil" aria-hidden="true"></i></button>') + money(f.amount) +
            '<label class="pa-move" title="Paid from"><i class="bi bi-arrow-left-right"></i><select data-pafrom="' + esc(f.id) + '" aria-label="Paid from, ' + esc(f.name) + '">' + opt(a.id, function (x) { return x.kind !== 'savings' && x.kind !== 'fund'; }) + '</select></label></li>';
        }).join('') + '</ul></div>';
    }).join('');
    box.innerHTML =
      (bills.length ? '<div class="pa-month"><b>' + esc(new Date().toLocaleDateString('en-GB', { month: 'long' })) + ': ' + nPaid + ' of ' + bills.length + ' paid</b><span>' + (toPay > 0 ? money(toPay) + ' still to pay' : '<i class="bi bi-check2-all"></i> all paid') + '</span>' +
        '<span class="stack"><span style="width:' + (bills.length ? nPaid / bills.length * 100 : 0).toFixed(1) + '%;background:var(--accent)"></span></span></div>' : '') +
      '<p class="muted pa-p">Tick a bill when it’s paid. Tap it to change it – the amount, the due day, months it changes, or when it starts or ends. <i class="bi bi-arrow-left-right"></i> moves it to another account.</p>' +
      '<div class="pa-acts"><button type="button" class="text-btn" data-fsopen="0"><i class="bi bi-bank2"></i> Edit accounts</button><button type="button" class="text-btn" data-fsopen="2"><i class="bi bi-list-check"></i> All bills step by step</button></div>' +
      (groups || '<p class="empty">No bills yet – add one with + Bill.</p>') +
      (saves.length ? '<div class="pa-grp"><p class="pa-h"><span class="pa-ico sm" style="--c:#22b35e"><i class="bi bi-piggy-bank"></i></span>Savings<b>' + money(sum(saves)) + '</b></p><ul class="pa-list pa-ro">' + saves.map(function (f) {
          var to = A.get(d, f.to) || p.saveTo; return '<li><span>' + esc(f.name) + '<small>' + (to ? '→ ' + esc(to.label) : 'no account chosen') + '</small></span>' + money(f.amount) + '</li>'; }).join('') + '</ul></div>' : '') +
      laterEnded(d) +
      (empty.length ? '<p class="muted pa-none">No bills from ' + esc(empty.map(function (g) { return g.a.label; }).join(', ')) + '</p>' : '') +
      '<div class="pa-set">' +
        '<label><span><i class="bi bi-basket"></i> Everyday shopping with</span><select data-padaily>' + opt(p.daily, function (x) { return x.kind !== 'savings' && x.kind !== 'fund'; }) + '</select></label>' +
        '<label><span><i class="bi bi-piggy-bank"></i> Savings go to</span><select data-pasave><option value="">Not set</option>' + opt(p.saveTo ? p.saveTo.id : '', function (x) { return x.kind !== 'salary' && x.kind !== 'credit'; }) + '</select></label>' +
      '</div>' +
      '<div class="pa-reset"><button type="button" class="text-btn danger" data-frreset><i class="bi bi-arrow-counterclockwise"></i> Reset finances …</button></div>';
  }
  /* bills that start later or have ended (their first / last month) */
  function laterEnded(d) {
    var mn = function (k) { return new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); };
    var row = function (f, t) { return '<li><button type="button" class="pa-open" data-fbopen="' + esc(f.id) + '" aria-label="Change ' + esc(f.name) + '"><span>' + esc(f.name) + '<small>' + t + '</small></span><i class="bi bi-pencil" aria-hidden="true"></i></button>' + money(f.amount) + '</li>'; };
    var later = d.budget.later || [], ended = (d.budget.ended || []).slice(-5).reverse(), out = '';
    if (later.length) out += '<div class="pa-grp"><p class="pa-h"><span class="pa-ico sm" style="--c:#7a8794"><i class="bi bi-calendar-plus"></i></span>Starting later</p><ul class="pa-list">' + later.map(function (f) { return row(f, 'from ' + esc(mn(f.from)) + (f.until ? ' to ' + esc(mn(f.until)) : '')); }).join('') + '</ul></div>';
    if (ended.length) out += '<details class="pa-ended"><summary>Ended · ' + ended.length + '</summary><ul class="pa-list">' + ended.map(function (f) { return row(f, 'last month ' + esc(mn(f.until))); }).join('') + '</ul></details>';
    return out;
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
    else if (t.dataset.pakind) setAcct(d, t.dataset.pakind, { kind: t.value });
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
      if (!confirm('Remove ' + a.label + '? Fixed costs paid from it move to your salary account. Expenses imported from it stay in Spending.')) return;
      if (a.builtin) setAcct(d, id, { off: true, name: '' }); else d.budget.acctList = (d.budget.acctList || []).filter(function (x) { return x.id !== id; });
      var to = (window.Accts.list(d).filter(function (x) { return x.kind === 'salary'; })[0] || { id: 'salary' }).id;
      d.budget.fixed.forEach(function (f) { if (f.acct === id) f.acct = to; });
      (d.accounts || []).forEach(function (l) { if (l.from === id) l.from = to; });
      if (id === 'card') d.budget.cardBuffer = 0;
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
      box.innerHTML = '<p class="empty">Add a mortgage, car loan or student loan with its interest and monthly payment. You see when it’s paid off, what the interest costs, the tax deduction – and what paying a bit more would save. The payment goes into your fixed costs by itself – and a loan you share with a partner counts only your part.</p>';
      return;
    }
    var yearTax = 0;
    box.innerHTML = '<ul class="ln-list">' + loans.map(function (l) { return foldLoan(l, oneLoan(l)); }).join('') + '</ul>' +
      (yearTax > 0 ? '<p class="ln-sum"><i class="bi bi-percent"></i> All loans: about ' + money(yearTax) + ' less tax over the next 12 months (rentefradrag)</p>' : '');
    function oneLoan(l) {
      if (l.inner && Lo.inner) { var tb = Lo.myTaxBack(l); yearTax += tb; return innerLoan(l); }
      var c = Lo.calc(l), x = tryExtra[l.id] || 0, cx = x ? Lo.calc(l, x) : null, pt = Lo.part ? Lo.part(l) : 1, sh = pt < 1, who = String(l.with || '').trim() || 'The other';
      if (c && !c.never) yearTax += c.taxBack * pt;
      var head = '<div class="ln-top"><span class="ln-name"><b>' + esc(l.name) + '</b><small>' + (l.rate ? esc(String(l.rate).replace('.', ',')) + ' % · ' : '') + (l.pay ? esc(kr(l.pay)) + ' a month' + (l.fee ? ' + ' + esc(kr(l.fee)) + ' fee' : '') : 'no payment set') +
        (sh ? ' · <i class="bi bi-people"></i> shared' : '') +
        (l.fixed !== false && l.pay ? ' · <i class="bi bi-link-45deg"></i> ' + (sh ? 'your part ' : '') + 'in fixed costs' : '') + '</small></span>' + money(c ? -c.balance : -l.balance, 'neg') +
        '<button type="button" class="icon-btn sm" data-lnedit="' + esc(l.id) + '" aria-label="Change ' + esc(l.name) + '"><i class="bi bi-pencil"></i></button></div>';
      /* shared: who pays what each month and whose part of the loan it is */
      var split = '';
      if (sh) {
        var pay = (+l.pay || 0) + (+l.fee || 0), bal = c ? c.balance : +l.balance || 0, pc = function (v) { return String(Math.round(v * 1000) / 10).replace('.', ','); };
        split = '<div class="ln-split"><div class="ln-sbar" role="img" aria-label="You ' + pc(pt) + ' %, ' + esc(who) + ' ' + pc(1 - pt) + ' %"><span style="width:' + (pt * 100).toFixed(1) + '%"></span></div>' +
          '<div class="ln-who"><span><small>You · ' + pc(pt) + ' %</small><b>' + money(pay * pt) + '<em> a month</em></b><em>' + money(bal * pt) + ' of the loan</em></span>' +
          '<span><small>' + esc(who) + ' · ' + pc(1 - pt) + ' %</small><b>' + money(pay * (1 - pt)) + '<em> a month</em></b><em>' + money(bal * (1 - pt)) + ' of the loan</em></span></div>' +
          '<button type="button" class="text-btn ln-chg" data-lnedit="' + esc(l.id) + '"><i class="bi bi-sliders"></i> Change the split</button></div>';
      }
      if (!c && +l.pay > 0 && Lo.owedNow && Lo.owedNow(l) <= 0.5) return '<li class="ln is-done">' + head.replace(/<span class="money neg">[^<]*<\/span>/, money(0)) + '<p class="ln-p ln-win"><i class="bi bi-check2-circle"></i> Paid off</p></li>';
      if (!c) return '<li class="ln">' + head + split + '<p class="muted ln-p">Give it an interest rate and a monthly payment (or the years left) to see the maths.</p></li>';
      if (c.never) return '<li class="ln">' + head + split + '<p class="ln-p neg">The payment doesn’t cover the interest (' + esc(kr(c.interest)) + ' a month) – the loan never gets smaller.</p></li>';
      var paidPct = l.orig > 0 ? Math.min(1, 1 - c.balance / l.orig) : null;
      return '<li class="ln">' + head + floatLine(l) + monthsLine(l, sh ? who : null) + split +
        '<div class="ln-grid">' +
          '<span><small>Paid off</small><b>' + esc(c.endLabel) + '</b></span>' +
          '<span><small>This month</small><b>' + money(c.interest) + ' interest</b><em>' + money(c.principal) + ' off the loan</em></span>' +
          '<span><small>Interest left</small><b>' + money(c.interestLeft) + '</b></span>' +
          '<span><small>Tax deduction' + (sh ? ', yours' : '') + '</small><b>' + money(c.taxBack * pt) + '</b><em>next 12 months, 22 %' + (sh ? ' of your part' : '') + '</em></span>' +
        '</div>' +
        paidBlock(l, pt, null) + (l.home && +l.home.value > 0 ? homeBlock(l, c.balance * pt, c.balance * (1 - pt), who) : '') +
        '<div class="ln-acts"><button type="button" class="text-btn" data-lnextra="' + esc(l.id) + '"><i class="bi bi-plus-circle"></i> Extra payment</button></div>' + extraList(l, sh ? who : null) +
        '<label class="ln-try"><span>Pay more each month</span><input type="range" min="0" max="' + Math.max(2000, Math.ceil(l.pay / 1000) * 1000) + '" step="250" value="' + x + '" data-lntry="' + esc(l.id) + '" aria-label="Extra a month for ' + esc(l.name) + '"><b class="ln-x">' + (x ? '+' + esc(kr(x)) : '+0 kr') + '</b></label>' +
        '<p class="ln-p ln-win"' + (cx && !cx.never ? '' : ' hidden') + '>' + (cx && !cx.never ? win(c, cx) : '') + '</p>' +
        (l.asOf ? '<p class="muted ln-p">Balance worked out from ' + esc(kr(l.balance)) + ' on ' + esc(new Date(l.asOf + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })) + ' and the payments since – update it under Wealth now and then.</p>' : '') +
      '</li>';
    }
  }
  /* months with a different payment: December interest only … – the whole loan, and each person's part */
  var MNS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function monthsLine(l, who) {
    var rl = (l.payRules || []).filter(function (r) { return r && +r.m >= 1; }); if (!rl.length || !Lo.monthPay) return '';
    var now = new Date();
    return '<ul class="ln-months">' + rl.map(function (r) {
      var y = now.getFullYear(), day = Math.min(+l.day || 15, 28), d = new Date(y, r.m - 1, day); if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = new Date(y + 1, r.m - 1, day);
      var mp = Lo.monthPay(l, d), norm = Lo.monthPay(Object.assign({}, l, { payRules: [] }), d);
      return '<li><i class="bi bi-calendar2-minus"></i><span><b>' + esc(MNS[r.m - 1]) + ': ' + esc(kr(mp.total + mp.fee)) + '</b> <small>' + (r.mode === 'interest' ? 'interest only' : 'a set amount') + ' · usually ' + esc(kr(norm.total + norm.fee)) + '</small>' +
        (who ? '<small class="ln-mwho">You ' + esc(kr(mp.me)) + ' · ' + esc(who) + ' ' + esc(kr(mp.them)) + '</small>' : '') + '</span></li>';
    }).join('') + '</ul>';
  }
  /* extra payments on a loan with one payment (who paid, when) */
  function extraList(l, who) {
    var ex = (l.extra || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }); if (!ex.length) return '';
    var tot = ex.reduce(function (a, e) { return a + (+e.amount || 0); }, 0);
    return '<ul class="ln-ex">' + ex.slice(0, 4).map(function (e) { return '<li><span>' + esc(new Date(e.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })) + (who ? ' · ' + (e.who === 'them' ? esc(who) : 'You') : '') + '</span>' + money(e.amount) + '<button type="button" class="icon-btn sm" data-lnexdel="' + esc(l.id + '|' + e.id) + '" aria-label="Remove extra payment"><i class="bi bi-x"></i></button></li>'; }).join('') + '</ul>' +
      (ex.length > 1 ? '<p class="muted ln-p">Extra payments in all: ' + esc(kr(tot)) + '</p>' : '');
  }
  /* already paid: what's paid off the loan since it started (or since the amount you borrowed), and the interest so far */
  function paidBlock(l, pt, q) {
    var P = Lo.paid ? Lo.paid(l) : null; if (!P || !(P.start > 0)) return '';
    var started = !l.asOf || new Date(l.asOf + 'T12:00') <= new Date(), pct = P.start > 0 ? Math.min(1, P.principal / P.start) : 0, pc = function (v) { return String(Math.round(v * 1000) / 10).replace('.', ','); };
    var since = l.asOf ? new Date(l.asOf + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    if (!started) return '<div class="ln-paid"><p class="ln-ph"><i class="bi bi-check2-circle"></i> <b>Paid so far</b> <span class="muted">– nothing yet, the loan starts ' + esc(since) + '</span></p></div>';
    var rows;
    if (q) rows = '<div class="ln-who"><span><small>Your part · of ' + money(q.me.start) + '</small><b>' + money(q.me.paidOff) + '<em> paid off</em></b><em>' + money(q.me.interestSoFar) + ' interest so far</em></span>' +
      '<span><small>' + esc(String(l.with || '').trim() || 'The other') + '’s part · of ' + money(q.them.start) + '</small><b>' + money(q.them.paidOff) + '<em> paid off</em></b><em>' + money(q.them.interestSoFar) + ' interest so far</em></span></div>';
    else rows = '<div class="ln-who"><span><small>Paid off the loan</small><b>' + money(P.principal) + '</b><em>' + pc(pct) + ' % of ' + money(P.start) + (pt != null && pt < 1 ? ' · your part ' + money(P.principal * pt) : '') + '</em></span>' +
      '<span><small>Interest paid</small><b>' + money(P.interest) + '</b><em>' + (P.payments ? P.payments + ' payment' + (P.payments === 1 ? '' : 's') + ' since ' + esc(since) : 'since ' + esc(since)) + '</em></span></div>';
    return '<div class="ln-paid"><p class="ln-ph"><i class="bi bi-check2-circle"></i> <b>Paid so far</b> <span class="muted">' + pc(pct) + ' % of the loan</span></p><div class="stack ln-bar"><span style="width:' + (pct * 100).toFixed(1) + '%;background:var(--accent)"></span></div>' + rows +
      (!q && (!P.fromOrig || +l.orig === +l.balance) ? '<p class="muted ln-p">Counted from the balance on ' + esc(since) + '. Add “Borrowed at the start” with the pencil to see everything paid since the loan began.</p>' : '') + '</div>';
  }
  /* the home: the own money each of you put in, and what each gets if it's sold today */
  function homeBlock(l, myLoan, theirLoan, who) {
    var hm = l.home, own = (+hm.own || 50) / 100, net = +hm.value * (1 - (+hm.costs || 0) / 100), eqM = +hm.eqMe || 0, eqT = +hm.eqThem || 0, eq = hm.split === 'eq' && (eqM || eqT);
    var mine = eq ? eqM + (net - eqM - eqT) * own - myLoan : net * own - myLoan, theirs = eq ? eqT + (net - eqM - eqT) * (1 - own) - theirLoan : net * (1 - own) - theirLoan;
    var paid = (eqM || eqT) ? '<div class="ln-who ln-eq"><span><small>Your own money in</small><b>' + money(eqM) + '</b><em>egenkapital</em></span><span><small>' + esc(who) + '’s own money in</small><b>' + money(eqT) + '</b><em>egenkapital</em></span></div>' : '';
    return '<div class="ln-home"><p><i class="bi bi-house-door"></i> <b>If sold at ' + esc(kr(hm.value)) + '</b> <span class="muted">(less ' + esc(String(+hm.costs || 0).replace('.', ',')) + ' % sale costs' + (eq ? ', own money back first' : '') + ')</span></p>' + paid +
      '<div class="ln-who"><span><small>Your settlement</small><b>' + money(mine, mine < 0 ? 'neg' : '') + '</b><em>' + (eq ? 'your own money back + ' + Math.round(own * 100) + ' % of the rest' : 'your ' + Math.round(own * 100) + ' %') + ', less your part of the loan</em></span>' +
      '<span><small>' + esc(who) + '’s settlement</small><b>' + money(theirs, theirs < 0 ? 'neg' : '') + '</b><em>' + (eq ? 'their own money back + ' + Math.round((1 - own) * 100) + ' % of the rest' : Math.round((1 - own) * 100) + ' %') + ', less their part</em></span></div>' +
      '<p class="muted ln-p">Value from ' + esc(hm.at || '–') + ' – change it with the pencil now and then.' + ((eqM || eqT) && !eq ? ' Your samboerkontrakt gives own money back first? Choose it under “If you sell”.' : '') + '</p></div>';
  }
  /* each loan folds to one line – what you pay a month and when it's done – and opens on a tap */
  var lnOpen = (function () { try { return JSON.parse(sessionStorage.getItem('dash.lnOpen')) || {}; } catch (e) { return {}; } })();
  function foldLoan(l, html) {
    var top = html.indexOf('<div class="ln-top">'), end = top < 0 ? -1 : html.indexOf('</button></div>', top);
    if (end < 0) return html;
    end += '</button></div>'.length;
    var c = Lo.calc(l), pay = Lo.myPay ? Lo.myPay(l) : (+l.pay || 0) + (+l.fee || 0), part = Lo.part(l), open = !!lnOpen[l.id];
    var paidOff = +l.pay > 0 && !l.inner && Lo.owedNow(l) <= 0.5, starts = l.asOf && l.asOf > new Date().toISOString().slice(0, 10);
    var sum = paidOff ? 'Paid off' : (pay > 0 ? kr(pay) + ' a month' + (l.inner || part < 1 ? ' (your part)' : '') : 'no payment set') +
      (starts ? ' · starts ' + new Date(l.asOf + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : c && !c.never ? ' · done ' + c.endLabel.split(' (')[0] : '') + (l.float ? ' · floating' : '');
    return html.slice(0, end).replace('<li class="ln', '<li class="ln ln-fold' + (open ? ' open' : '')) +
      '<button type="button" class="ln-tog" data-lntog="' + esc(l.id) + '" aria-expanded="' + open + '"><span>' + esc(sum) + '</span><i class="bi bi-chevron-' + (open ? 'up' : 'down') + '"></i></button>' +
      '<div class="ln-more"' + (open ? '' : ' hidden') + '>' + html.slice(end).replace(/<\/li>$/, '') + '</div></li>';
  }
  /* a mortgage in two internal parts (samboerkontrakt): each part on its own, extra payments, your tax numbers, your settlement */
  function innerLoan(l) {
    var q = Lo.inner(l), c = Lo.calc(l), who = String(l.with || '').trim() || 'The other', yr = new Date().getFullYear(); if (!q) return '';
    var started = new Date(l.asOf + 'T12:00') <= new Date();
    var head = '<div class="ln-top"><span class="ln-name"><b>' + esc(l.name) + '</b><small>' + (l.rate ? esc(String(l.rate).replace('.', ',')) + ' % · ' : '') + '<i class="bi bi-people"></i> two internal parts' +
      (l.fixed !== false ? ' · <i class="bi bi-link-45deg"></i> your instalment in fixed costs' : '') + (started ? '' : ' · starts ' + esc(new Date(l.asOf + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))) + '</small></span>' + money(-(q.me.bal + q.them.bal), 'neg') +
      '<button type="button" class="icon-btn sm" data-lnedit="' + esc(l.id) + '" aria-label="Change ' + esc(l.name) + '"><i class="bi bi-pencil"></i></button></div>';
    var tot = q.me.bal + q.them.bal, pt = tot > 0 ? q.me.bal / tot : 1, pc = function (v) { return String(Math.round(v * 1000) / 10).replace('.', ','); };
    var col = function (name, x, fee, cls) {
      return '<span class="' + cls + '"><small>' + esc(name) + ' · ' + money(x.bal) + '</small><b>' + money(x.pay + fee) + '<em> a month</em></b><em>' + money(x.interest) + ' interest + ' + money(x.pay - x.interest) + ' off the part</em></span>';
    };
    var split = '<div class="ln-split"><div class="ln-sbar" role="img" aria-label="Your part ' + pc(pt) + ' %, ' + esc(who) + ' ' + pc(1 - pt) + ' %"><span style="width:' + (pt * 100).toFixed(1) + '%"></span></div>' +
      '<div class="ln-who">' + col('Your part', q.me, q.fee.me, '') + col(who + '’s part', q.them, q.fee.them, '') + '</div></div>';
    var fees = q.fee.me * q.me.yearPays, tax = (q.me.year + fees) * Lo.TAX;
    var grid = '<div class="ln-grid">' +
      '<span><small>Paid off</small><b>' + (c && !c.never ? esc(c.endLabel) : '–') + '</b></span>' +
      '<span><small>Your interest + fees ' + yr + '</small><b>' + money(q.me.year + fees) + '</b><em>for the skattemelding · ' + q.me.yearPays + ' payment' + (q.me.yearPays === 1 ? '' : 's') + '</em></span>' +
      '<span><small>Tax deduction ' + yr + ', yours</small><b>' + money(tax) + '</b><em>22 % of your own interest and fees</em></span>' +
      '<span><small>Next 12 months, yours</small><b>' + money(q.me.next12) + ' interest</b><em>' + money(Lo.myTaxBack(l)) + ' less tax</em></span>' +
    '</div>';
    var settle = paidBlock(l, null, q) + (l.home && +l.home.value > 0 ? homeBlock(l, q.me.bal, q.them.bal, who) : '');
    var ex = (l.extra || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var exl = ex.length ? '<ul class="ln-ex">' + ex.slice(0, 4).map(function (e) { return '<li><span>' + esc(new Date(e.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })) + ' · ' + (e.who === 'them' ? esc(who) : 'You') + '</span>' + money(e.amount) + '<button type="button" class="icon-btn sm" data-lnexdel="' + esc(l.id + '|' + e.id) + '" aria-label="Remove extra payment"><i class="bi bi-x"></i></button></li>'; }).join('') + '</ul>' : '';
    return '<li class="ln">' + head + floatLine(l) + monthsLine(l, who) + split + grid +
      '<div class="ln-acts"><button type="button" class="text-btn" data-lnextra="' + esc(l.id) + '"><i class="bi bi-plus-circle"></i> Extra payment</button>' +
      (window.SharedHome ? '<button type="button" class="text-btn" data-lnsub="' + esc(l.id) + '"><i class="bi bi-arrow-left-right"></i> Covered an instalment</button>' : '') + '</div>' + exl + settle +
      (q.left < (+l.inner.months || 0) || !started ? '' : '') + '</li>';
  }
  /* an extra payment on one internal part */
  function extraSheet(id) {
    var d = data(), l = d && (d.accounts || []).filter(function (a) { return String(a.id) === String(id); })[0]; if (!l) return;
    var who = String(l.with || '').trim() || 'The other', bg = document.createElement('div'); bg.className = 'fo-bg lf-bg'; var sh = !!l.inner || Lo.part(l) < 1;
    bg.innerHTML = '<form class="fo-box lf-box mp-box" role="dialog" aria-modal="true" aria-label="Extra payment"><div class="lf-head"><h3><i class="bi bi-plus-circle"></i> Extra payment</h3><button type="button" class="icon-btn sm" data-x aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' +
      '<p class="muted">' + (l.inner ? 'It lowers only the payer’s part – and that person’s next instalments, with the same term.' : 'It comes off the loan; the monthly payment stays and the loan is paid off sooner.') + '</p>' +
      (sh ? '<div class="seg lf-seg"><button type="button" data-w="me" aria-pressed="true">You paid</button><button type="button" data-w="them" aria-pressed="false">' + esc(who) + ' paid</button></div>' : '') +
      '<div class="mp-grid"><input name="amt" inputmode="decimal" placeholder="Amount, kr" autocomplete="off" required><input name="date" type="date" value="' + esc(new Date().toISOString().slice(0, 10)) + '" aria-label="Date"></div>' +
      '<div class="lf-foot"><span class="spacer"></span><button type="submit" class="pill-btn wide"><i class="bi bi-check2"></i> Save</button></div></form>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var w = 'me', close = function () { bg.remove(); };
    bg.addEventListener('click', function (e) { var b = e.target.closest('[data-w]'); if (b) { w = b.dataset.w; bg.querySelectorAll('[data-w]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === b)); }); return; } if (e.target === bg || e.target.closest('[data-x]')) close(); });
    bg.addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, n = parseFloat(String(f.amt.value).replace(/\s/g, '').replace(',', '.'));
      if (!(n > 0)) { f.amt.focus(); return; }
      var d2 = data(); (d2.accounts || []).forEach(function (a) { if (String(a.id) === String(id)) { a.extra = Array.isArray(a.extra) ? a.extra : []; a.extra.push({ id: Date.now().toString(36), date: f.date.value || new Date().toISOString().slice(0, 10), amount: Math.round(n), who: w }); } });
      window.Vault.save(d2); if (window.Links) window.Links.syncLoans(); close(); save(data());
      if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-check2"></i> Extra payment saved' + (l.inner ? ' – ' + (w === 'me' ? 'your' : esc(who) + '’s') + ' part is lower' : ' – the loan is lower'));
    });
  }
  /* a floating rate: where it comes from, and a change on its way */
  function floatLine(l) {
    var P = window.Policy; if (!l.float || !P) return '';
    var fl = l.float, f2 = function (v) { return String(Math.round(v * 100) / 100).replace('.', ','); }, dt = function (k) { return new Date(k + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
    var pend = (P.data().changes || []).filter(function (c) { return c.date > (fl.since || '') && (fl.applied || []).indexOf(c.date) < 0; })[0], nm = P.nextMeeting(), out;
    out = '<i class="bi bi-graph-up-arrow"></i> Floating: policy rate ' + f2(P.at(new Date().toISOString().slice(0, 10))) + ' % ' + (fl.margin >= 0 ? '+ ' : '− ') + f2(Math.abs(fl.margin)) + ' (your margin)';
    if (pend) { var e = new Date(pend.date + 'T12:00'); e.setDate(e.getDate() + (+fl.lag >= 0 ? +fl.lag : 42)); out += '<br><b>From ' + dt(e.toISOString().slice(0, 10)) + ': ' + f2(+pend.rate + (+fl.margin || 0)) + ' %</b> – Norges Bank set the policy rate to ' + f2(pend.rate) + ' % on ' + dt(pend.date); }
    else if (l.rateLog && l.rateLog.length) { var last = l.rateLog[l.rateLog.length - 1]; out += '<br>Last change: ' + f2(last.rate) + ' % from ' + dt(last.date); }
    if (nm) out += ' · next meeting ' + dt(nm);
    return '<p class="ln-float">' + out + '</p>';
  }
  function win(c, cx) { return '<i class="bi bi-stars"></i> Paid off <b>' + esc(cx.endLabel.split(' (')[0]) + '</b> – ' + (c.months - cx.months) + ' months sooner, <b>' + money(c.interestLeft - cx.interestLeft) + '</b> less interest'; }
  function editLoan(id) {
    var dd = data(), pl = id && dd && (dd.accounts || []).filter(function (x) { return String(x.id) === String(id) && x.plan; })[0];
    if (pl) { location.href = '/cmd/house/#hplan=' + encodeURIComponent(pl.id); return; }     /* bought in parts: changed on the House page */
    show('insights', { keep: true });
    setTimeout(function () {
      if (id) { var li = document.querySelector('#nwList .acc[data-id="' + id + '"]'); if (li) li.click(); }
      else { if ($('nwForm').hidden) $('nwAddBtn').click(); $('nwKind').value = 'debt'; $('nwKind').dispatchEvent(new Event('change')); }
      var f = $('nwForm'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lnedit]'); if (b) { editLoan(b.dataset.lnedit); return; }
    if ((b = e.target.closest('[data-papaid]'))) { var dp = data(); if (!dp) return; var k = new Date().toISOString().slice(0, 7), l = (dp.paid = dp.paid || {})[k] = (dp.paid[k] || []), ix = l.indexOf(b.dataset.papaid); if (ix > -1) l.splice(ix, 1); else l.push(b.dataset.papaid); save(dp); return; }
    if ((b = e.target.closest('[data-lntog]'))) {
      var li = b.closest('.ln'), more = li.querySelector('.ln-more'), op = more.hidden; more.hidden = !op; li.classList.toggle('open', op);
      b.setAttribute('aria-expanded', String(op)); var ic = b.querySelector('.bi'); if (ic) ic.className = 'bi bi-chevron-' + (op ? 'up' : 'down');
      if (op) lnOpen[b.dataset.lntog] = 1; else delete lnOpen[b.dataset.lntog]; try { sessionStorage.setItem('dash.lnOpen', JSON.stringify(lnOpen)); } catch (er) {}
      return;
    }
    /* a linked bill in Accounts & fixed costs: open the thing it comes from */
    if ((b = e.target.closest('[data-pasrc]'))) {
      var q = b.dataset.pasrc.split('|'), src = q[0], fid = q.slice(1).join('|');
      if (src === 'loan') { var lid = fid.replace(/^loan-/, ''), dd = data(), ln = dd && (dd.accounts || []).filter(function (x) { return String(x.id) === lid; })[0];
        if (ln && ln.plan) { editLoan(lid); return; }
        goCard('#fpLoanCard'); setTimeout(function () { var card = document.querySelector('#fpLoans [data-lnedit="' + lid + '"]'); if (card) { var tg = card.closest('.ln').querySelector('[data-lntog][aria-expanded="false"]'); if (tg) tg.click(); card.closest('.ln').scrollIntoView({ behavior: 'smooth', block: 'start' }); card.closest('.ln').classList.add('flash'); setTimeout(function () { card.closest('.ln').classList.remove('flash'); }, 1600); } }, 120); return; }
      if (src === 'save') { goCard('.card.savings'); return; }
      if (src === 'year') { goCard('#fpYearlyCard'); return; }
      if (src === 'sub') { var sc = document.querySelector('[data-tool="subs"]'); if (sc) goCard(sc); else location.href = '/cmd/finance/#subs'; return; }
      return;
    }
    if ((b = e.target.closest('[data-lnextra]'))) { extraSheet(b.dataset.lnextra); return; }
    if ((b = e.target.closest('[data-lnsub]'))) { if (window.SharedHome) window.SharedHome.cover(b.dataset.lnsub); return; }
    if ((b = e.target.closest('[data-lnexdel]'))) { var q = b.dataset.lnexdel.split('|'), d0 = data(); (d0.accounts || []).forEach(function (a) { if (String(a.id) === q[0]) a.extra = (a.extra || []).filter(function (x) { return x.id !== q[1]; }); }); window.Vault.save(d0); if (window.Links) window.Links.syncLoans(); save(data()); return; }
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
    var loanTax = Lo ? (d.accounts || []).filter(function (a) { return a.kind === 'debt'; }).reduce(function (a, l) { var c = Lo.calc(l); return a + (c && !c.never ? c.taxBack * (Lo.part ? Lo.part(l) : 1) : 0) * (l.inner ? 0 : 1) + (l.inner ? Lo.myTaxBack(l) : 0); }, 0) : 0;
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
  var CATS = [['groceries', 'Groceries', '#11a597', 'basket'], ['eating', 'Eating out', '#d95926', 'cup-hot'], ['transport', 'Transport', '#3987e5', 'bus-front'], ['shopping', 'Shopping', '#c98500', 'bag'], ['home', 'Home', '#a0673a', 'house'],
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
    if (!(n.total > 0)) { box.innerHTML = ''; return; }
    var seg = '<div class="seg bf-seg" role="group" aria-label="How many months">' + [1, 2, 3, 4, 6].map(function (m) { return '<button type="button" data-bfm="' + m + '" aria-pressed="' + (m === months) + '">' + m + ' mo</button>'; }).join('') + '</div>';
    if (!g) {
      box.innerHTML = '<div class="bf-tip"><i class="bi bi-shield-check"></i><span><b>A buffer</b> – money for the unexpected, so it never goes on the card. ' + months + ' month' + (months === 1 ? '' : 's') + ' of your costs (' + money(n.total) + ' a month) = <b>' + money(target) + '</b>.</span>' +
        '<button type="button" class="pill-btn" data-bfmake>Add it</button></div>';
      return;
    }
    if (g.autoT !== false && Math.abs((+g.target || 0) - target) > 500) { g.target = target; window.Vault.save(d); setTimeout(function () { window.dispatchEvent(new Event('fin:change')); }, 0); }
    var cov = n.total ? (+g.saved || 0) / n.total : 0, pct = Math.min(1, cov / months);
    box.innerHTML = '<div class="bf-row"><span class="bf-ic"><i class="bi bi-shield-check"></i></span><span class="bf-t"><b>Buffer · ' + (cov >= 10 ? Math.round(cov) : cov.toFixed(1).replace('.', ',')) + ' of ' + months + ' months covered</b>' +
      '<small>' + money(g.saved) + ' of ' + money(g.target) + ' · a month costs you ' + money(n.total) + (g.autoT === false ? ' · <button type="button" class="text-btn" data-bfauto>follow the maths</button>' : '') + '</small>' +
      '<span class="bf-bar"><i style="width:' + (pct * 100).toFixed(1) + '%"></i>' + Array.apply(null, Array(months - 1)).map(function (x, i) { return '<b style="left:' + ((i + 1) / months * 100).toFixed(1) + '%"></b>'; }).join('') + '</span></span></div>' + seg;
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
    try { originals(d); if (syncYearly(d)) { save(d); return; } fillFrom(d); renderMoney(d); renderFlow(d); renderLimits(d); renderAcct(d); renderBuf(d); renderYearly(d); renderLoans(d); renderYear(d); } catch (e) { console.error(e); }
  }
  window.addEventListener('fin:change', function () { setTimeout(render, 0); });
  window.addEventListener('features:change', render);
  window.Vault.onUnlock(function () { render(); fromHash(); });
  window.Vault.onLock(function () { ['fpMoney', 'fpFlow', 'fpLimits', 'fpAcct', 'fpBuf', 'fpYearly', 'fpLoans', 'fpYearAhead'].forEach(function (id) { if ($(id)) $(id).innerHTML = ''; }); });
  window.FinTabs = { show: show, current: current, go: goCard, plan: function () { var d = data(); return d ? plan(d) : null; } };
})();
