/* Set up Finances, step by step – the one place to get the basics right:
   1 Your accounts   name, type, what's in it now (credit cards: what you owe + the limit)
   2 Salary          what lands each month after tax, the payday, which account
   3 Every month     what goes out: loans, rent, power … and which account pays it
   4 Your month      salary − credit cards − loans − bills − savings = left, and what you can use until payday
   Opened from Your accounts ("Set up"), the budget card when it's empty, Plan → Accounts, or #setup.
   Everything is saved into the same places the cards use (d.budget.acctList, d.budget.income, d.budget.fixed). */
(function () {
  "use strict";
  if (!window.Vault || !document.getElementById('fp')) return;
  var $ = function (id) { return document.getElementById(id); };
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '').replace('−', '-'); if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var n = parseFloat(s.replace(',', '.')); return isFinite(n) ? n : NaN; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayKey() { var t = new Date(); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  var STEPS = ['Your accounts', 'Salary', 'Every month', 'Your month'];
  var step = 0, draft = null;

  var bg = document.createElement('div');
  bg.className = 'qa-bg fs-bg'; bg.hidden = true;
  bg.innerHTML = '<div class="qa-box fs-box" role="dialog" aria-modal="true" aria-label="Set up Finances"><div class="qa-handle"></div><div id="fsBody"></div></div>';
  document.body.appendChild(bg);
  /* on the Setup tab the form sits right on the page (#fsInline); the sheet is only a fallback */
  var inline = $('fsInline');
  function host() { return inline || $('fsBody'); }

  /* ---------- a working copy, written back on each Next ---------- */
  function load() {
    var d = window.Vault.get() || {}, b = d.budget || {}, A = window.Accts;
    var have = Array.isArray(b.acctList) && b.acctList.some(function (a) { return a.bal != null || ['salary', 'credit', 'card'].indexOf(a.id) < 0; });
    var accts = (have ? A.list(d) : A.STARTER.map(function (s) { var cur = A.get(d, s.id); return Object.assign({}, s, cur && cur.name ? { name: cur.name } : {}, cur ? { bal: cur.bal, limit: cur.limit, due: cur.due } : {}); }))
      .map(function (a) { return { id: a.id, kind: a.kind, name: a.name || a.label || '', bal: a.bal != null ? a.bal : '', limit: a.limit || '', due: a.due || '', nw: a.nw !== false }; });
    var inc = (b.income || [])[0] || null;
    var fixed = (b.fixed || []).map(function (f) { return Object.assign({}, f); });
    return { accts: accts, salary: inc ? { id: inc.id, amount: inc.gross > 0 ? '' : inc.amount, day: inc.day || '', gross: inc.gross > 0, net: window.Budget ? window.Budget.ordinary(inc) : inc.amount, name: inc.name } : { id: null, amount: '', day: '', gross: false },
      fixed: fixed, extraIncome: (b.income || []).length > 1 };
  }
  function write(part) {
    var d = window.Vault.get(); if (!d) return;
    d.budget = d.budget || { income: [], fixed: [] }; d.budget.income = d.budget.income || []; d.budget.fixed = d.budget.fixed || [];
    if (part === 'accts') {
      var old = Array.isArray(d.budget.acctList) ? d.budget.acctList : [], keep = {};
      var list = draft.accts.filter(function (a) { return a.name.trim() || a.bal !== '' || ['salary', 'credit', 'card'].indexOf(a.id) > -1; }).map(function (a) {
        var o = old.filter(function (x) { return x.id === a.id; })[0] || {}, bal = a.bal === '' ? null : num(a.bal);
        keep[a.id] = 1;
        var rec = Object.assign({}, o, { id: a.id, kind: a.kind, name: a.name.trim().slice(0, 40), limit: a.kind === 'credit' ? Math.max(0, Math.round(num(a.limit) || 0)) : 0, due: a.kind === 'credit' ? (+a.due || null) : null, nw: a.nw !== false });
        delete rec.off;
        if (bal == null || !isFinite(bal)) { rec.bal = null; rec.balAt = null; rec.balSrc = null; }
        else if (o.bal !== bal) { rec.bal = Math.round(bal * 100) / 100; rec.balAt = todayKey(); rec.balSrc = 'hand'; }
        return rec;
      });
      ['salary', 'credit', 'card'].forEach(function (id) { if (!keep[id]) list.push({ id: id, kind: id, off: true }); });     // the starting three: removed = off
      d.budget.acctList = list;
      var live = {}; list.forEach(function (a) { if (!a.off) live[a.id] = a; });
      var main = list.filter(function (a) { return !a.off && a.kind === 'salary'; })[0];
      (d.budget.fixed || []).forEach(function (f) { if (f.acct && !live[f.acct]) f.acct = main ? main.id : 'salary'; });   // paid from an account you removed
      d.budget.accts = {};
      if (!list.some(function (a) { return !a.off && a.kind === 'salary'; })) { var first = list.filter(function (a) { return !a.off; })[0]; if (first) first.kind = 'salary'; }
    }
    if (part === 'salary') {
      var s = draft.salary, amt = num(s.amount), day = +s.day || null;
      var row = s.id ? d.budget.income.filter(function (r) { return r.id === s.id; })[0] : null;
      if (row) { if (!row.gross && amt > 0) row.amount = Math.round(amt); row.day = day; }
      else if (amt > 0) d.budget.income.unshift({ id: uid(), name: 'Salary', amount: Math.round(amt), day: day });
      if (day && d.budget.period == null) d.budget.period = 'payday';
    }
    if (part === 'fixed') {
      var linked = d.budget.fixed.filter(function (f) { return f.src; });
      var was = {}; d.budget.fixed.forEach(function (f) { if (f && f.id) was[f.id] = f; });
      var mine = draft.fixed.filter(function (f) { return !f.src && String(f.name || '').trim() && num(f.amount) > 0; }).map(function (f) {
        var old = (f.id && was[f.id]) || {}, rec = Object.assign({}, old, { id: f.id || uid(), name: String(f.name).trim().slice(0, 50), amount: Math.round(num(f.amount)), day: +f.day || null, acct: f.acct || 'salary' });
        if (rec.vary && Math.round(num(f.amount)) !== Math.round(+old.amount || 0)) {      /* changed here = this month's amount */
          var t = new Date(), k = t.getFullYear() + '-' + pad(t.getMonth() + 1); rec.months = Object.assign({}, rec.months || {}); rec.months[k] = rec.amount;
        }
        return rec;
      });
      linked.forEach(function (f) { var dr = draft.fixed.filter(function (x) { return x.id === f.id; })[0]; if (dr && dr.acct) f.acct = dr.acct; });
      d.budget.fixed = mine.concat(linked);
    }
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }

  /* ---------- the steps ---------- */
  var KINDS = function () { return window.Accts.KINDS; };
  function acctOptions(sel, filter) {
    return draft.accts.filter(function (a) { return a.name.trim() && (!filter || filter(a)); }).map(function (a) { return '<option value="' + esc(a.id) + '"' + (sel === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('');
  }
  function dayOptions(v, none) { var o = '<option value="">' + (none || 'Day?') + '</option>'; for (var i = 1; i <= 31; i++) o += '<option value="' + i + '"' + (+v === i ? ' selected' : '') + '>the ' + i + '.</option>'; return o; }
  function head() {
    return '<div class="fs-steps">' + STEPS.map(function (t, i) { return '<button type="button" data-fsgo="' + i + '" class="' + (i === step ? 'on' : i < step ? 'done' : '') + '"><b>' + (i < step ? '<i class="bi bi-check-lg"></i>' : i + 1) + '</b><span>' + t + '</span></button>'; }).join('') + '</div>';
  }
  function foot(nextLabel) {
    return '<div class="qa-acts fs-foot">' + (step ? '<button type="button" class="text-btn" data-fsback><i class="bi bi-chevron-left"></i> Back</button>' : inline ? '' : '<button type="button" class="text-btn" data-fsclose>Later</button>') +
      '<span class="spacer"></span><button type="button" class="pill-btn wide" data-fsnext>' + nextLabel + '</button></div>';
  }
  function stepAccts() {
    var K = KINDS();
    return '<h2 class="im-h"><i class="bi bi-bank2"></i> Your accounts</h2><p class="muted im-p">Name each account, what kind it is and what’s in it today (look in the bank app). For a credit card: what you owe and the limit. Remove the ones you don’t have.</p>' +
      '<ul class="fs-acc">' + draft.accts.map(function (a, i) {
        var cr = a.kind === 'credit';
        return '<li><div class="fs-r1"><span class="pa-ico" style="--c:' + K[a.kind].c + '"><i class="bi bi-' + K[a.kind].icon + '"></i></span><input data-fa="name" data-i="' + i + '" value="' + esc(a.name) + '" placeholder="Name" aria-label="Name" autocomplete="off">' +
          '<button type="button" class="icon-btn sm" data-fadel="' + i + '" aria-label="Remove ' + esc(a.name || 'account') + '"><i class="bi bi-trash3"></i></button></div>' +
          '<div class="fs-r2"><select data-fa="kind" data-i="' + i + '" aria-label="Type">' + Object.keys(K).map(function (k) { return '<option value="' + k + '"' + (a.kind === k ? ' selected' : '') + '>' + K[k].name + '</option>'; }).join('') + '</select>' +
          '<label><span>' + (cr ? 'You owe' : 'In it now') + '</span><input data-fa="bal" data-i="' + i + '" inputmode="decimal" value="' + esc(a.bal) + '" placeholder="kr" autocomplete="off"></label>' +
          (cr ? '<label><span>Limit</span><input data-fa="limit" data-i="' + i + '" inputmode="decimal" value="' + esc(a.limit) + '" placeholder="kr" autocomplete="off"></label><label><span>Bill due</span><select data-fa="due" data-i="' + i + '">' + dayOptions(a.due) + '</select></label>' : '') +
          '</div><label class="qa-check fs-nw"><input type="checkbox" data-fanw="' + i + '"' + (a.nw !== false ? ' checked' : '') + '> Count it in my net worth</label></li>';
      }).join('') + '</ul><button type="button" class="text-btn" data-faadd><i class="bi bi-plus-lg"></i> Add an account</button>' + foot('Next: salary');
  }
  function stepSalary() {
    var s = draft.salary, salAcc = draft.accts.filter(function (a) { return a.kind === 'salary' && a.name.trim(); })[0];
    return '<h2 class="im-h"><i class="bi bi-cash-stack"></i> Salary</h2><p class="muted im-p">What lands in ' + esc(salAcc ? salAcc.name : 'your salary account') + ' each month, after tax – and on which day.</p>' +
      '<div class="fs-form">' +
        (s.gross ? '<p class="fs-note"><i class="bi bi-calculator"></i> Worked out from your payslip (gross, tax %): about <b>' + esc(kr(s.net)) + '</b> a normal month, holiday pay in June and half tax in December. Change it under Monthly budget → Edit.</p>' :
          '<label><span>Salary after tax</span><input data-fs="amount" inputmode="decimal" value="' + esc(s.amount) + '" placeholder="e.g. 52 000" autocomplete="off"></label>') +
        '<label><span>Payday</span><select data-fs="day">' + dayOptions(s.day, 'Pick the day') + '</select></label>' +
        '<p class="muted fs-hint">When it’s a weekend, the Friday before counts. The budget then runs from payday to payday.</p>' +
        (draft.extraIncome ? '<p class="muted fs-hint">You have more than one income – the others are kept as they are.</p>' : '') +
      '</div>' + foot('Next: every month');
  }
  var QUICK = ['Loan', 'Rent', 'Power', 'Insurance', 'Phone', 'Internet', 'Car', 'Kindergarten', 'Streaming', 'Gym'];
  function stepFixed() {
    var mine = draft.fixed.filter(function (f) { return !f.src && !f.split; }), linked = draft.fixed.filter(function (f) { return f.src || f.split; });
    var credit = draft.accts.filter(function (a) { return a.kind === 'credit' && a.name.trim(); });
    var from = function (f, i) { return '<select data-ff="acct" data-i="' + i + '" aria-label="Paid from">' + acctOptions(f.acct || 'salary', function (a) { return a.kind !== 'fund'; }) + '</select>'; };
    return '<h2 class="im-h"><i class="bi bi-arrow-repeat"></i> Every month</h2><p class="muted im-p">What goes out every month – loans, rent, power, insurance … – how much, which day, and which account pays it. ' +
        (credit.length ? 'Your credit card' + (credit.length > 1 ? 's are' : ' is') + ' paid from what you owe on ' + (credit.length > 1 ? 'them' : 'it') + ' – no need to add ' + (credit.length > 1 ? 'them' : 'it') + ' here.' : '') + '</p>' +
      '<div class="fs-quick">' + QUICK.map(function (q) { return '<button type="button" data-ffq="' + esc(q) + '">+ ' + esc(q) + '</button>'; }).join('') + '</div>' +
      '<ul class="fs-fix">' + draft.fixed.map(function (f, i) {
        if (f.src || f.split) return '';
        return '<li><div class="fs-r1"><input data-ff="name" data-i="' + i + '" value="' + esc(f.name) + '" placeholder="What" aria-label="What" autocomplete="off"><input data-ff="amount" data-i="' + i + '" inputmode="decimal" value="' + esc(f.amount) + '" placeholder="kr" aria-label="Amount a month" autocomplete="off">' +
          '<button type="button" class="icon-btn sm" data-ffdel="' + i + '" aria-label="Remove"><i class="bi bi-trash3"></i></button></div>' +
          '<div class="fs-r2"><select data-ff="day" data-i="' + i + '" aria-label="Due day">' + dayOptions(f.day, 'No fixed day') + '</select>' + from(f, i) + '</div>' +
          (f.vary ? '<p class="muted fs-hint"><i class="bi bi-graph-up"></i> Changes from month to month – the amount above is this month’s. Set the other months under Setup → Accounts &amp; fixed costs.</p>' : '') + '</li>';
      }).join('') + '</ul><button type="button" class="text-btn" data-ffadd><i class="bi bi-plus-lg"></i> Add one</button>' +
      (linked.length ? '<p class="muted fs-hint"><i class="bi bi-link-45deg"></i> Also counted (change them where they come from): ' + esc(linked.map(function (f) { return f.name + ' ' + kr(f.amount); }).join(' · ')) + '</p>' : '') +
      (!mine.length ? '<p class="muted fs-hint">Nothing yet – tap a button above to start.</p>' : '') +
      foot('See your month');
  }
  function stepMonth() {
    var d = window.Vault.get() || {}, B = window.Budget, p = B.payPlan(d), cards = B.cardBills(d), real = B.real(d);
    var cardPay = cards.reduce(function (s, c) { return s + c.amount; }, 0);
    var nonCredit = p.list.filter(function (a) { return a.kind !== 'credit'; }).reduce(function (s, a) { return s + p.by[a.id]; }, 0);
    var other = Math.max(0, nonCredit - p.loans), saving = p.save + p.yearly, inc = p.per.salary || B.income(d), left = inc - cardPay - p.loans - other - saving;
    var line = function (t, v, sub, cls) { return '<li class="' + (cls || '') + '"><span>' + t + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span><b>' + esc(kr(v)) + '</b></li>'; };
    return '<h2 class="im-h"><i class="bi bi-check2-circle"></i> Your month</h2><p class="muted im-p">This is what the dashboard now works with. It follows your imports from here on – update the balances in Your accounts now and then.</p>' +
      '<ul class="fs-sum">' + line('Salary in', inc) +
        (cardPay ? line('− Credit cards', cardPay, cards.filter(function (c) { return c.amount; }).map(function (c) { return c.acct.label + ' ' + kr(c.amount); }).join(' · ')) : '') +
        (p.loans ? line('− Loans', p.loans) : '') + (other ? line('− Other bills', other) : '') + (saving ? line('− Savings', saving) : '') +
        line('= Left for everyday', left, '', 'eq' + (left < 0 ? ' neg' : '')) + '</ul>' +
      (real ? '<div class="fs-real"><span>Free to use until payday<small>' + esc(kr(real.cash)) + ' in your accounts' + (real.owed ? ' − ' + esc(kr(real.owed)) + ' owed on cards' : '') + (real.bills ? ' − ' + esc(kr(real.bills)) + ' bills still due' : '') + '</small></span><b class="' + (real.free < 0 ? 'neg' : '') + '">' + esc(kr(real.free)) + '</b></div>' :
        '<p class="muted fs-hint">Add what’s in your salary account and regningskonto (step 1) to see what you can really use until payday.</p>') +
      foot('Done');
  }
  function draw() {
    var html = [stepAccts, stepSalary, stepFixed, stepMonth][step]();
    host().innerHTML = head() + html;
    if (inline) { var top = inline.getBoundingClientRect().top; if (top < 70 && moved) window.scrollBy(0, top - 90); moved = false; }
    else { var box = bg.querySelector('.fs-box'); if (box) box.scrollTop = 0; }
  }
  var moved = false;
  function open(at) {
    if (!window.Vault.get()) return;
    draft = load(); step = at || 0;
    if (inline) { if (window.FinTabs) window.FinTabs.show('setup', { keep: true }); draw(); setTimeout(function () { var c = $('fsCard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); return; }
    draw();
    bg.hidden = false; document.body.classList.add('qa-open'); requestAnimationFrame(function () { bg.classList.add('open'); });
  }
  /* the Setup tab draws the form when it's shown (and again when something changes elsewhere, unless you're typing in it) */
  function showInline() {
    if (!inline || !window.Vault.get()) return;
    if (inline.contains(document.activeElement) && document.activeElement.matches('input, select')) return;
    draft = load(); draw();
  }
  function close() {
    if (inline) { step = 0; showInline(); if (window.FinTabs) window.FinTabs.show('now'); return; }
    bg.classList.remove('open'); document.body.classList.remove('qa-open'); setTimeout(function () { if (!bg.classList.contains('open')) bg.hidden = true; }, 320); }
  function saveStep() { write(['accts', 'salary', 'fixed', null][step]); }

  function onInput(e) {
    var t = e.target, i = +t.dataset.i;
    if (t.dataset.fa) draft.accts[i][t.dataset.fa] = t.value;
    else if (t.dataset.ff) draft.fixed[i][t.dataset.ff] = t.value;
    else if (t.dataset.fs) draft.salary[t.dataset.fs] = t.value;
  }
  function onChange(e) {
    var t = e.target, i = +t.dataset.i;
    if (t.dataset.fanw != null) { draft.accts[+t.dataset.fanw].nw = t.checked; return; }
    if (t.dataset.fa) { draft.accts[i][t.dataset.fa] = t.value; if (t.dataset.fa === 'kind') draw(); }
    else if (t.dataset.ff) draft.fixed[i][t.dataset.ff] = t.value;
    else if (t.dataset.fs) draft.salary[t.dataset.fs] = t.value;
  }
  function onClick(e) {
    var t = e.target;
    if (t === bg || t.closest('[data-fsclose]')) { close(); return; }
    if (t.closest('[data-fsnext], [data-fsback], [data-fsgo]')) moved = true;
    if (t.closest('[data-fsnext]')) { saveStep(); if (step >= STEPS.length - 1) { close(); if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-check-lg"></i> Finances set up'); return; } step++; draft = Object.assign(load(), {}); draw(); return; }
    if (t.closest('[data-fsback]')) { saveStep(); step--; draft = load(); draw(); return; }
    var go = t.closest('[data-fsgo]'); if (go) { saveStep(); step = +go.dataset.fsgo; draft = load(); draw(); return; }
    if (t.closest('[data-faadd]')) { draft.accts.push({ id: 'ac' + uid(), kind: 'card', name: '', bal: '', limit: '', due: '', nw: true }); draw(); var ins = host().querySelectorAll('[data-fa="name"]'); if (ins.length) ins[ins.length - 1].focus(); return; }
    var del = t.closest('[data-fadel]');
    if (del) {
      var a = draft.accts[+del.dataset.fadel];
      if (a.kind === 'salary' && draft.accts.filter(function (x) { return x.kind === 'salary'; }).length < 2) { alert('Your salary has to land somewhere – change another account to “Salary account” first.'); return; }
      draft.accts.splice(+del.dataset.fadel, 1); draw(); return;
    }
    var q = t.closest('[data-ffq]');
    if (q) { draft.fixed.push({ name: q.dataset.ffq, amount: '', day: '', acct: q.dataset.ffq === 'Loan' ? 'salary' : (draft.accts.filter(function (x) { return x.kind === 'card'; })[0] || { id: 'salary' }).id }); draw(); var am = host().querySelectorAll('[data-ff="amount"]'); if (am.length) am[am.length - 1].focus(); return; }
    if (t.closest('[data-ffadd]')) { draft.fixed.push({ name: '', amount: '', day: '', acct: 'salary' }); draw(); var nm = host().querySelectorAll('[data-ff="name"]'); if (nm.length) nm[nm.length - 1].focus(); return; }
    var fd = t.closest('[data-ffdel]'); if (fd) { draft.fixed.splice(+fd.dataset.ffdel, 1); draw(); }
  }
  [bg, inline].forEach(function (el) { if (!el) return; el.addEventListener('input', onInput); el.addEventListener('change', onChange); el.addEventListener('click', onClick); });
  document.addEventListener('keydown', function (e) { if (!bg.hidden && e.key === 'Escape') close(); });
  window.Vault.onLock(close);
  /* entry points */
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-fsopen]'); if (b) { e.preventDefault(); open(+b.dataset.fsopen || 0); } });
  function fromHash() { if (location.hash === '#setup') { history.replaceState(null, '', location.pathname + location.search); setTimeout(function () { open(0); }, 300); } }
  window.Vault.onUnlock(fromHash); window.addEventListener('hashchange', fromHash);
  if (inline) {
    window.Vault.onUnlock(function () { setTimeout(showInline, 100); });
    window.addEventListener('fin:change', function () { if (document.getElementById('fp').dataset.tab === 'setup') return; setTimeout(showInline, 0); });
  }
  window.FinSetup = { open: open, close: close, show: showInline };
})();
