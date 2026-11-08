/* Finances → Now, the right-hand column: your accounts at a glance, the payday moves (around payday),
   the spending pace, what's between you and your partner, and the latest spending.
   The full accounts card, the salary plan and the bills live on Accounts; loans and savings on Loans. */
(function () {
  "use strict";
  if (!window.Vault || !document.getElementById('fnAccts')) return;
  var $ = function (id) { return document.getElementById(id); };
  var B = window.Budget, A = window.Accts;
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)); }
  function money(n, cls) { return '<span class="money' + (cls ? ' ' + cls : '') + '">' + esc(kr(n)) + '</span>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dk(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today0() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  function sum(l, f) { return l.reduce(function (a, x) { return a + (+(f ? f(x) : x.amount) || 0); }, 0); }
  var CATN = { groceries: 'Groceries', eating: 'Eating out', transport: 'Transport', shopping: 'Shopping', home: 'Home', fun: 'Fun', health: 'Health', travel: 'Travel', other: 'Other', fixed: 'Bills' };
  var CATI = { groceries: 'basket', eating: 'cup-hot', transport: 'bus-front', shopping: 'bag', home: 'house', fun: 'controller', health: 'heart-pulse', travel: 'airplane', other: 'three-dots', fixed: 'receipt' };
  var CATC = { groceries: '#22b35e', eating: '#d95926', transport: '#3987e5', shopping: '#d55181', home: '#c98500', fun: '#8a6fdf', health: '#11a597', travel: '#0891b2', other: '#6b6d73', fixed: '#6b6d73' };
  function data() { var d = window.Vault.get(); if (!d) return null; d.budget = d.budget || { income: [], fixed: [] }; d.budget.fixed = d.budget.fixed || []; d.budget.income = d.budget.income || []; return d; }

  /* ---------- your accounts at a glance ---------- */
  function accts(d) {
    var box = $('fnAccts'), list = A.list(d), m = A.money(d);
    if (!m.known) { box.innerHTML = '<p class="empty">No balances yet. <button type="button" class="text-btn" data-ftab-go="accts" data-fp-to="myaccts">Add what’s in your accounts</button></p>'; return; }
    box.innerHTML = '<div class="fn-tiles">' + list.map(function (a) {
      var cr = a.kind === 'credit', v = a.bal;
      return '<button type="button" class="fn-tile" data-ftab-go="accts" data-fp-to="myaccts" style="--c:' + a.c + '"><span><i class="bi bi-' + a.icon + '"></i> ' + esc(a.label) + '</span>' +
        (v == null ? '<b class="muted">–</b>' : '<b class="' + (cr && v > 0 ? 'neg' : '') + '">' + esc(kr(cr ? -Math.max(0, v) : v)) + '</b>') + '</button>';
    }).join('') + '</div>' +
      '<p class="muted fn-tot"><span>In your accounts</span> ' + money(m.cash) + (m.owed ? ' · <span>owed on cards</span> ' + money(-m.owed, 'neg') : '') + (m.saved ? ' · <span>saved</span> ' + money(m.saved) : '') + '</p>';
  }

  /* ---------- payday moves: from 5 days before payday until they're all ticked (or a week after) ---------- */
  function pay(d) {
    var card = $('fnPayCard'), box = $('fnPay'), p = B.payPlan(d), per = p.per;
    if (!p.moves.length) { card.hidden = true; return; }
    var into = per.days - per.daysLeft, open = p.moves.filter(function (m) { return !m.done; });
    var next = B.paydays ? B.paydays(d, today0(), new Date(Date.now() + 6 * 864e5))[0] : null;
    var soon = !!next, fresh = per.byPayday && into < 7 && open.length;
    if (!soon && !fresh) { card.hidden = true; return; }
    card.hidden = false;
    var nextP = soon ? B.payPlan(d, new Date(next.date.getTime() + 864e5 / 2)) : p;
    var moves = soon && !fresh ? nextP.moves : p.moves;
    $('fnPayNote').textContent = soon && !fresh ? next.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : open.length ? open.length + ' to do' : 'all done';
    box.innerHTML = (soon && !fresh ? '<p class="muted fn-pl">On payday, move this – tick each one when it’s done.</p>' : '') +
      '<ul class="pf-moves pf-check">' + moves.map(function (m) {
        var can = !(soon && !fresh);
        return '<li class="' + (m.done ? 'done' : '') + '">' + (can ? '<button type="button" class="check" data-pfmove="' + esc(m.id) + '" aria-pressed="' + !!m.done + '" aria-label="' + esc(m.label) + (m.done ? ' – done' : ' – mark as done') + '"><i class="bi bi-check-lg"></i></button>' : '<span class="fn-ic pay"><i class="bi bi-arrow-right"></i></span>') +
          '<span>' + esc(m.label) + '<small>' + esc(m.sub || '') + '</small></span><b>' + money(m.amount) + '</b></li>';
      }).join('') + '</ul>';
  }

  /* ---------- spending pace ---------- */
  function pace(d) {
    var box = $('fnPace'), per = B.period(d), ex = d.expenses || [];
    var t0 = today0(), wk = new Date(t0); wk.setDate(wk.getDate() - ((wk.getDay() + 6) % 7));
    var wkK = dk(wk), tK = dk(t0);
    var week = sum(ex.filter(function (e) { return e.date >= wkK && e.date <= tK && e.cat !== 'fixed'; }));
    var spent = B.spent(d, per), fixedAll = sum(d.budget.fixed), room = per.income - fixedAll;
    var daysIn = Math.max(1, per.days - per.daysLeft), share = daysIn / per.days, used = room > 0 ? spent / room : 0;
    var perDay = per.daysLeft > 0 ? Math.max(0, room - spent) / per.daysLeft : 0;
    var ahead = room > 0 ? used - share : 0;
    var lim = d.budget.limits || {}, sp = {};
    ex.forEach(function (e) { if (per.has(e.date)) sp[e.cat] = (sp[e.cat] || 0) + (+e.amount || 0); });
    var close = Object.keys(lim).filter(function (c) { return +lim[c] > 0 && sp[c] / lim[c] >= 0.75; }).sort(function (a, b) { return sp[b] / lim[b] - sp[a] / lim[a]; }).slice(0, 3);
    if (!(room > 0) && !week) { box.innerHTML = '<p class="empty">Add your salary and bills under Accounts, then you see here how fast you spend.</p>'; return; }
    var state = room <= 0 ? '' : ahead > 0.08 ? '<span class="fn-st bad"><i class="bi bi-exclamation-triangle"></i> Faster than the days go</span>' : ahead < -0.08 ? '<span class="fn-st good"><i class="bi bi-check2-circle"></i> Slower than the days go</span>' : '<span class="fn-st ok"><i class="bi bi-check2"></i> On pace</span>';
    box.innerHTML = '<div class="fn-pace-g"><div><small>This week</small><b>' + esc(kr(week)) + '</b></div>' + (room > 0 ? '<div><small>Per day until payday</small><b>' + esc(kr(perDay)) + '</b></div>' : '') + '</div>' +
      (room > 0 ? '<div class="fn-bar" role="img" aria-label="' + Math.round(used * 100) + ' % of what you can spend used, ' + Math.round(share * 100) + ' % of the days gone"><i style="width:' + Math.min(100, used * 100).toFixed(1) + '%"></i><em style="left:' + Math.min(100, share * 100).toFixed(1) + '%"></em></div>' +
        '<p class="muted fn-pl">' + Math.round(used * 100) + ' % used · ' + Math.round(share * 100) + ' % of the days gone ' + state + '</p>' : '') +
      (close.length ? '<ul class="fn-lims">' + close.map(function (c) { var r = sp[c] / lim[c]; return '<li><span>' + esc(CATN[c] || c) + '</span><span class="fn-lb"><i style="width:' + Math.min(100, r * 100).toFixed(0) + '%;background:' + (r >= 1 ? 'var(--danger)' : '#c98500') + '"></i></span><b>' + Math.round(r * 100) + ' %</b></li>'; }).join('') + '</ul>' : '');
  }

  /* ---------- between you and your partner (Shared home / shared expenses) ---------- */
  function us() {
    var card = $('fnUsCard'), S = window.Shared, p = S && S.partner && S.partner();
    if (!p || !S.sides) { card.hidden = true; return; }
    var sd = S.sides(p.id);
    if (sd.they < 1 && sd.you < 1) { card.hidden = true; return; }
    card.hidden = false;
    $('fnUsTitle').textContent = 'You and ' + p.name;
    $('fnUs').innerHTML = '<div class="fn-us-g"><div><small>' + esc(p.name) + ' owes you</small><b class="pos">' + esc(kr(sd.they)) + '</b></div><div><small>You owe ' + esc(p.name) + '</small><b class="neg">' + esc(kr(sd.you)) + '</b></div>' +
      '<div><small>In total</small><b class="' + (sd.net >= 0 ? 'pos' : 'neg') + '">' + (sd.net >= 0 ? '+' : '−') + esc(kr(Math.abs(sd.net))) + '</b></div></div>';
  }

  /* ---------- latest spending ---------- */
  function latest(d) {
    var box = $('fnLatest');
    var l = (d.expenses || []).filter(function (e) { return e && e.cat !== 'fixed' && +e.amount > 0; }).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.t || 0) - (a.t || 0); }).slice(0, 4);
    if (!l.length) { box.innerHTML = '<p class="empty">Nothing yet. Add a spending with + or import your bank file.</p>'; return; }
    var t0 = dk(today0()), y = new Date(today0()); y.setDate(y.getDate() - 1); var yK = dk(y);
    box.innerHTML = '<ul class="fn-lt">' + l.map(function (e) {
      var c = e.cat || 'other', when = e.date === t0 ? 'Today' : e.date === yK ? 'Yesterday' : new Date(e.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      return '<li><span class="kit-ic" style="--c:' + (CATC[c] || CATC.other) + '"><i class="bi bi-' + (CATI[c] || 'three-dots') + '"></i></span><span class="fn-ltx"><b>' + esc(e.note || CATN[c] || c) + '</b><small>' + esc(when + ' · ' + (CATN[c] || c)) + (e.src === 'bank' || e.ref ? ' · <i class="bi bi-bank2" aria-label="from the bank"></i>' : '') + '</small></span>' + money(-(+e.amount)) + '</li>';
    }).join('') + '</ul>';
  }

  function render() {
    var d = data(); if (!d || !B || !A) return;
    var box = document.getElementById('fp');
    if (box && box.contains(document.activeElement) && document.activeElement.closest && document.activeElement.closest('#fnAcctsCard, #fnPayCard, #fnPaceCard, #fnUsCard, #fnLatestCard') && document.activeElement.matches('input')) return;
    [accts, pay, pace, us, latest].forEach(function (f) { try { f(d); } catch (e) { console.error(e); } });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-fnadd]') && window.Quick) { e.preventDefault(); window.Quick.open('expense'); }
  });
  window.addEventListener('fin:change', function () { setTimeout(render, 0); });
  window.addEventListener('shared:change', render);
  window.addEventListener('tools:change', function () { setTimeout(us, 0); });
  window.Vault.onUnlock(function () { setTimeout(render, 50); });
  window.FinNow2 = { render: render };
})();
