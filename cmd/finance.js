/* Finances: budget, spending, savings goals and net worth.
   All numbers live in the encrypted vault (lock.js). Nothing is sent anywhere. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';

  var CATS = [
    { id: 'groceries', name: 'Groceries', color: '#11a597' },
    { id: 'eating', name: 'Eating out', color: '#d95926' },
    { id: 'transport', name: 'Transport', color: '#3987e5' },
    { id: 'shopping', name: 'Shopping', color: '#c98500' },
    { id: 'fun', name: 'Fun', color: '#d55181' },
    { id: 'health', name: 'Health', color: '#8a6fdf' },
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
    $('finHide').innerHTML = '<i class="bi bi-eye' + (on ? '-slash' : '') + '"></i>';
    $('finHide').setAttribute('aria-label', on ? 'Show amounts' : 'Hide amounts');
    try { localStorage.setItem('dash.finHide', on ? '1' : '0'); } catch (e) {}
  }
  $('finHide').addEventListener('click', function () {
    setHidden(!document.body.classList.contains('fin-hidden'));
  });
  try { setHidden(localStorage.getItem('dash.finHide') === '1'); } catch (e) { setHidden(false); }

  /* ================= Budget ================= */
  function monthSpent(key) {
    return sum(D.expenses.filter(function (e) { return e.date.slice(0, 7) === key; }));
  }

  function renderBudget() {
    var b = D.budget;
    var income = sum(b.income), fixed = sum(b.fixed), spent = monthSpent(ym(new Date()));
    var left = income - fixed - spent;
    var box = $('budgetBody');

    if (budgetEditing) {
      box.innerHTML = budgetEditor('income', 'Income', 'e.g. Salary') + budgetEditor('fixed', 'Fixed costs', 'e.g. Rent');
      $('budgetEdit').textContent = 'Done';
      return;
    }
    $('budgetEdit').textContent = income || fixed ? 'Edit' : 'Set up';

    if (!income && !fixed) {
      box.innerHTML = '<p class="empty">Add your monthly income and fixed costs (rent, loans, subscriptions). Spending you log below is counted automatically.</p>';
      return;
    }
    var base = Math.max(income, fixed + spent, 1);
    var w = function (v) { return Math.max(0, v / base * 100).toFixed(2) + '%'; };
    box.innerHTML =
      '<div class="big-num ' + (left < 0 ? 'neg' : '') + '">' + money(left) + '</div>' +
      '<div class="muted">' + (left < 0 ? 'over budget' : 'left this month') + ' · of ' + money(income) + ' income</div>' +
      '<div class="stack" role="img" aria-label="Fixed ' + esc(kr(fixed)) + ', spent ' + esc(kr(spent)) + ', left ' + esc(kr(left)) + '">' +
        '<span class="s-fixed" style="width:' + w(fixed) + '"></span>' +
        '<span class="s-spent" style="width:' + w(spent) + '"></span>' +
        '<span class="s-left" style="width:' + w(Math.max(left, 0)) + '"></span>' +
      '</div>' +
      '<ul class="legend">' +
        '<li><i class="dot" style="background:#3987e5"></i>Fixed costs<b>' + money(fixed) + '</b></li>' +
        '<li><i class="dot" style="background:#d95926"></i>Spent in ' + esc(monthName(ym(new Date()), true)) + '<b>' + money(spent) + '</b></li>' +
        '<li><i class="dot" style="background:var(--accent)"></i>Left<b>' + money(left) + '</b></li>' +
      '</ul>';
  }

  function budgetEditor(kind, title, ph) {
    var rows = D.budget[kind].map(function (r) {
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

  $('budgetEdit').addEventListener('click', function () { budgetEditing = !budgetEditing; renderBudget(); });
  $('budgetBody').addEventListener('submit', function (e) {
    var f = e.target.closest('.b-add');
    if (!f) return;
    e.preventDefault();
    var a = num(f.a.value);
    if (!(a > 0)) { f.a.focus(); return; }
    D.budget[f.dataset.kind].push({ id: uid(), name: f.n.value.trim(), amount: a });
    persist();
    renderBudget();
    var again = $('budgetBody').querySelector('.b-add[data-kind="' + f.dataset.kind + '"] input');
    if (again) again.focus();
  });
  $('budgetBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-bdel]');
    if (!b) return;
    var p = b.dataset.bdel.split(':');
    D.budget[p[0]] = D.budget[p[0]].filter(function (r) { return r.id !== p[1]; });
    persist();
    renderBudget();
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
            '<span class="muted pct">' + Math.round(x.v / total * 100) + ' %</span><b>' + money(x.v) + '</b></li>';
        }).join('') + '</ul>';
    }

    var shown = showAll ? list : list.slice(0, 6);
    $('spList').innerHTML = shown.map(function (e) {
      var c = catById[e.cat] || catById.other;
      var d = new Date(e.date + 'T12:00');
      return '<li class="tx"><i class="dot" style="background:' + c.color + '"></i>' +
        '<span class="tx-text"><strong>' + esc(e.note || c.name) + '</strong><span class="muted">' +
        esc(c.name) + ' · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</span></span>' +
        money(e.amount) +
        '<button class="del" type="button" data-xdel="' + e.id + '" aria-label="Delete"><i class="bi bi-x"></i></button></li>';
    }).join('');
    $('spMore').hidden = list.length <= 6;
    $('spMore').textContent = showAll ? 'Show less' : 'Show all ' + list.length;
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
  $('spMore').addEventListener('click', function () { showAll = !showAll; renderSpending(); });

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
        ' · ' + Math.round(pct * 100) + ' %</span></div>' +
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

  /* ================= Backup and passcode ================= */
  $('finMore').addEventListener('click', function () {
    var m = $('finMenu');
    m.hidden = !m.hidden;
    $('pcForm').hidden = true;
    $('finMenuMsg').textContent = '';
  });
  $('finBackup').addEventListener('click', function () {
    window.Vault.backup().then(function () {
      $('finMenuMsg').textContent = 'Backup downloaded. It’s encrypted, so it’s only readable with your passcode.';
    });
  });
  $('finChangePc').addEventListener('click', function () {
    $('pcForm').hidden = false;
    $('pcNew').focus();
  });
  $('pcCancel').addEventListener('click', function () { $('pcForm').hidden = true; });
  $('pcForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = $('pcNew').value;
    if (p.length < 6) { $('finMenuMsg').textContent = 'Use at least 6 characters.'; return; }
    if (p !== $('pcConfirm').value) { $('finMenuMsg').textContent = 'The two passcodes don’t match.'; return; }
    window.Vault.changePasscode(p).then(function () {
      $('pcNew').value = '';
      $('pcConfirm').value = '';
      $('pcForm').hidden = true;
      $('finMenuMsg').textContent = 'Passcode changed. Old backups still need the old passcode.';
    });
  });

  /* ================= Lock / unlock ================= */
  function renderAll() { renderBudget(); renderSpending(); renderSavings(); renderNet(); }

  window.Vault.onUnlock(function (data) {
    D = data && data.budget ? data : Object.assign(blank(), data || {});
    if (!D.history) D.history = {};
    viewMonth = ym(new Date());
    snapshot();
    renderAll();
  });

  window.Vault.onLock(function () {
    D = null;
    budgetEditing = false;
    showAll = false;
    closeSaving();
    closeAcc();
    $('finMenu').hidden = true;
    ['budgetBody', 'spChart', 'spList', 'svList', 'nwBig', 'nwSub', 'nwChart', 'nwList'].forEach(function (id) { $(id).innerHTML = ''; });
  });
})();
