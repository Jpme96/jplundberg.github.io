/* "What if?" on Finances → Insights (2026-11-19, plan Part 2). Shows where your money goes over the next years with
   today's numbers, and lets you try changes before you make them: a rate change, a big purchase, a pay change, extra
   loan payments, a new monthly cost, a child. The maths is in whatif.js. Kept in dash.tools.whatif =
   [{ id: 'main', name, changes: [...] }] (its own tool list, so its own vault piece; only for you for now). */
(function () {
  'use strict';
  var el = document.getElementById('wiCard'); if (!el || !window.WhatIf) return;
  var F = window.Features, V = window.Vault, K = function (n, e, o) { return window.I18N && I18N.k ? I18N.k(n, e, o) : e; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function nb() { return window.I18N && I18N.lang === 'nb'; }
  function mon(k) { if (!k) return ''; var p = k.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString(nb() ? 'nb-NO' : 'en-GB', { month: 'short', year: 'numeric' }); }
  function store() { var t = F.tools(), l = Array.isArray(t.whatif) ? t.whatif : []; return l[0] || { id: 'main', name: 'My plan', changes: [], years: 5 }; }
  function save(sc) { var t = F.tools(); t.whatif = [sc]; F.saveTools(t); }
  function uid() { return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  var adding = '';
  var TYPES = [
    ['rate', 'percent', function () { return K('ui.wi-t-rate', 'The interest rate changes'); }],
    ['buy', 'bag', function () { return K('ui.wi-t-buy', 'A big purchase'); }],
    ['income', 'briefcase', function () { return K('ui.wi-t-income', 'My pay changes'); }],
    ['extra', 'piggy-bank', function () { return K('ui.wi-t-extra', 'Extra on the loan each month'); }],
    ['cost', 'receipt', function () { return K('ui.wi-t-cost', 'A new monthly cost'); }],
    ['child', 'heart', function () { return K('ui.wi-t-child', 'A child'); }]
  ];
  function tname(t) { var r = TYPES.filter(function (x) { return x[0] === t; })[0]; return r ? r[2]() : t; }
  function ticon(t) { var r = TYPES.filter(function (x) { return x[0] === t; })[0]; return r ? r[1] : 'dot'; }
  function describe(c) {
    var from = mon(c.from);
    if (c.type === 'rate') return K('ui.wi-d-rate', 'From {m}: the rate {s} {n} %-points', { m: from, s: (+c.delta >= 0 ? '+' : '−'), n: String(Math.abs(+c.delta || 0)).replace('.', nb() ? ',' : '.') });
    if (c.type === 'buy') return K('ui.wi-d-buy', '{m}: {a}', { m: from, a: kr(c.amount) }) + (c.loan ? ' · ' + K('ui.wi-d-loan', 'loan {r} %, {y} years', { r: c.rate, y: c.years }) : ' · ' + K('ui.wi-d-cash', 'paid in cash'));
    if (c.type === 'income') return K('ui.wi-d-income', 'From {m}: {p} % of today’s pay', { m: from, p: c.pct });
    if (c.type === 'extra') return K('ui.wi-d-extra', 'From {m}: {a} extra a month', { m: from, a: kr(c.amount) });
    if (c.type === 'cost') return K('ui.wi-d-cost', 'From {m}: {a} a month', { m: from, a: kr(c.amount) }) + (c.until ? ' ' + K('ui.wi-d-until', 'until {m}', { m: mon(c.until) }) : '');
    if (c.type === 'child') return K('ui.wi-d-child', 'From {m}: {a} a month', { m: from, a: kr(c.amount) });
    return '';
  }
  function chart(a, b, low) {
    var rows = a.rows, W = 600, H = 230, pl = 6, pr = 6, pt = 22, pb = 30;
    var all = rows.map(function (r) { return r.net; }).concat(b ? b.rows.map(function (r) { return r.net; }) : []);
    var mn = Math.min(0, Math.min.apply(null, all)), mx = Math.max(0, Math.max.apply(null, all)); if (mx - mn < 1) mx = mn + 1;
    var x = function (i) { return pl + (W - pl - pr) * i / Math.max(1, rows.length - 1); }, y = function (v) { return pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn)); };
    var line = function (rs) { return rs.map(function (r, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(r.net).toFixed(1); }).join(''); };
    var years = '', yr0 = +rows[0].m.slice(0, 4);
    rows.forEach(function (r, i) { if (r.m.slice(5) === '01') years += '<line x1="' + x(i).toFixed(1) + '" x2="' + x(i).toFixed(1) + '" y1="' + pt + '" y2="' + (H - pb) + '" class="wi-grid"/><text x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" class="wi-ax" text-anchor="' + (i < 3 ? 'start' : 'middle') + '">' + r.m.slice(0, 4) + '</text>'; });
    var lowI = low ? (b || a).rows.findIndex(function (r) { return r.m === low; }) : -1;
    return '<svg class="wi-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(K('ui.wi-chart', 'Net worth month by month')) + '">' + years +
      '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" class="wi-zero"/>' +
      '<path d="' + line(rows) + '" class="wi-base' + (b ? ' wi-dim' : '') + '"/>' + (b ? '<path d="' + line(b.rows) + '" class="wi-plan"/>' : '') +
      (lowI >= 0 ? '<circle cx="' + x(lowI).toFixed(1) + '" cy="' + y((b || a).rows[lowI].net).toFixed(1) + '" r="5" class="wi-low"><title>' + esc(K('ui.wi-low-tip', 'Savings under one month’s costs')) + '</title></circle>' : '') +
      '<text x="' + (W - pr) + '" y="' + (pt - 6) + '" class="wi-ax" text-anchor="end">' + esc(kr(mx)) + '</text>' + (mn < 0 ? '<text x="' + (W - pr) + '" y="' + (H - pb - 4) + '" class="wi-ax" text-anchor="end">' + esc(kr(mn)) + '</text>' : '') + '</svg>';
  }
  function field(t) {
    var nm = function (k, ph, v, step) { return '<input class="wi-in" name="' + k + '" inputmode="decimal" placeholder="' + esc(ph) + '"' + (v != null ? ' value="' + v + '"' : '') + ' autocomplete="off">'; };
    var next = WhatIf.addM(WhatIf.base(V.get() || {}).start, 1);
    var from = '<label class="wi-lb"><span>' + esc(t === 'buy' ? K('ui.wi-when', 'When') : K('ui.wi-from', 'From')) + '</span><input type="month" name="from" value="' + next + '" required></label>';
    if (t === 'rate') return from + '<label class="wi-lb"><span>' + esc(K('ui.wi-points', '%-points (− for down)')) + '</span>' + nm('delta', '0,5', '0,5') + '</label>';
    if (t === 'buy') return from + '<label class="wi-lb"><span>' + esc(K('ui.wi-amount', 'Amount (kr)')) + '</span>' + nm('amount', '250 000') + '</label>' +
      '<label class="wi-lb"><span>' + esc(K('ui.wi-pay-with', 'Paid with')) + '</span><select name="loan"><option value="">' + esc(K('ui.wi-cash', 'Savings (cash)')) + '</option><option value="1">' + esc(K('ui.wi-newloan', 'A new loan')) + '</option></select></label>' +
      '<label class="wi-lb wi-loanf"><span>' + esc(K('ui.wi-rate', 'Rate %')) + '</span>' + nm('rate', '6', '6') + '</label><label class="wi-lb wi-loanf"><span>' + esc(K('ui.wi-years', 'Years')) + '</span>' + nm('years', '5', '5') + '</label>';
    if (t === 'income') return from + '<label class="wi-lb"><span>' + esc(K('ui.wi-pct', '% of today’s pay')) + '</span>' + nm('pct', '80', '80') + '</label>';
    if (t === 'extra') return from + '<label class="wi-lb"><span>' + esc(K('ui.wi-month-kr', 'kr a month')) + '</span>' + nm('amount', '2 000') + '</label>';
    if (t === 'cost') return from + '<label class="wi-lb"><span>' + esc(K('ui.wi-month-kr-neg', 'kr a month (− for a cost that stops)')) + '</span>' + nm('amount', '1 500') + '</label>' +
      '<label class="wi-lb"><span>' + esc(K('ui.wi-until', 'Until (empty = for good)')) + '</span><input type="month" name="until"></label>';
    if (t === 'child') return from + '<label class="wi-lb"><span>' + esc(K('ui.wi-child-kr', 'Costs a month (a rough guess – change it)')) + '</span>' + nm('amount', '5 000', '5000') + '</label>';
    return '';
  }
  function num(v) { return parseFloat(String(v || '').replace(/\s/g, '').replace(/ /g, '').replace(',', '.')); }
  function render() {
    var d = V && V.get && V.get(); if (!d) { el.hidden = true; return; }
    el.hidden = false;
    var sc = store(), years = [3, 5, 10].indexOf(+sc.years) >= 0 ? +sc.years : 5, n = years * 12;
    var b = WhatIf.base(d), a = WhatIf.project(b, [], n), has = sc.changes.length, p = has ? WhatIf.project(b, sc.changes, n) : null;
    var endA = a.rows[a.rows.length - 1], endP = p && p.rows[p.rows.length - 1], low = (p || a).low;
    var diff = p ? endP.net - endA.net : 0;
    var known = b.income > 0;
    el.innerHTML = '<div class="card-head"><h2><i class="bi bi-signpost-split"></i> ' + esc(K('ui.wi-title', 'What if?')) + '</h2>' +
      '<div class="head-actions"><select class="wi-yrs" data-wiyrs aria-label="' + esc(K('ui.wi-ahead', 'How far ahead')) + '">' + [3, 5, 10].map(function (y) { return '<option value="' + y + '"' + (y === years ? ' selected' : '') + '>' + esc(K('ui.wi-n-years', '{n} years', { n: y })) + '</option>'; }).join('') + '</select></div></div>' +
      (!known ? '<p class="empty">' + esc(K('ui.wi-need-pay', 'Add your pay under Accounts → Income & fixed costs first – the plan starts from it.')) + '</p>' :
      '<p class="wi-sum tnum">' + esc(K('ui.wi-in', 'In {m}', { m: mon(endA.m) })) + ': <b>' + esc(kr(endA.net)) + '</b> ' + esc(K('ui.wi-networth', 'net worth')) + ' <span class="muted">· ' + esc(K('ui.wi-assets', 'assets')) + ' ' + esc(kr(endA.assets)) + ' · ' + esc(K('ui.wi-debt', 'debt')) + ' ' + esc(kr(endA.debt)) + '</span></p>' +
      (p ? '<p class="wi-sum tnum">' + esc(K('ui.wi-with', 'With your changes')) + ': <b>' + esc(kr(endP.net)) + '</b> <span class="stt ' + (diff >= 0 ? 'stt-ok' : 'stt-bad') + '">' + (diff >= 0 ? '+' : '−') + esc(kr(Math.abs(diff))) + '</span></p>' : '') +
      (low ? '<p class="wi-warn"><span class="stt stt-bad">' + esc(K('ui.wi-low', 'Savings under one month’s costs from {m}', { m: mon(low) })) + '</span></p>' : '') +
      chart(a, p, low) +
      (p ? '<p class="wi-key"><span class="wi-k wi-k-base"></span>' + esc(K('ui.wi-as-now', 'As now')) + ' <span class="wi-k wi-k-plan"></span>' + esc(K('ui.wi-with', 'With your changes')) + '</p>' : '') +
      (has ? '<ul class="wi-list">' + sc.changes.map(function (c) { return '<li><i class="bi bi-' + ticon(c.type) + '"></i><span><b>' + esc(tname(c.type)) + '</b><small>' + esc(describe(c)) + '</small></span><button type="button" class="icon-btn sm" data-widel="' + esc(c.id) + '" aria-label="' + esc(K('ui.remove', 'Remove')) + '"><i class="bi bi-x-lg"></i></button></li>'; }).join('') + '</ul>' : '') +
      (adding ? '<form class="wi-add" data-wiform="' + adding + '"><p class="wi-add-h"><i class="bi bi-' + ticon(adding) + '"></i> ' + esc(tname(adding)) + '</p><div class="wi-fields">' + field(adding) + '</div>' +
        '<div class="wi-btns"><button type="button" class="text-btn" data-wicancel>' + esc(K('ui.cancel', 'Cancel')) + '</button><button type="submit" class="pill-btn">' + esc(K('ui.add', 'Add')) + '</button></div></form>' :
        '<div class="wi-types">' + TYPES.map(function (t) { return '<button type="button" class="wi-type" data-witype="' + t[0] + '"><i class="bi bi-' + t[1] + '"></i> ' + esc(t[2]()) + '</button>'; }).join('') + '</div>') +
      '<p class="wi-note muted">' + esc(K('ui.wi-note', 'Today’s kroner – no price growth or pay rises. From: pay {i}, fixed costs {f}, everyday spending {s} (last three months), your part of {n} loans.', { i: kr(b.income), f: kr(b.fixed), s: kr(b.spend), n: b.loans.length })) + '</p>');
    var lf = el.querySelector('select[name=loan]'); if (lf) { var tg = function () { [].forEach.call(el.querySelectorAll('.wi-loanf'), function (x) { x.hidden = !lf.value; }); }; lf.addEventListener('change', tg); tg(); }
    var f1 = el.querySelector('.wi-add .wi-in'); if (f1 && !f1.value) f1.focus();
  }
  el.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-witype]'))) { adding = b.dataset.witype; render(); return; }
    if (e.target.closest('[data-wicancel]')) { adding = ''; render(); return; }
    if ((b = e.target.closest('[data-widel]'))) {
      var sc = store(), gone = sc.changes.filter(function (c) { return c.id === b.dataset.widel; })[0], at = sc.changes.indexOf(gone);
      sc.changes = sc.changes.filter(function (c) { return c !== gone; }); save(sc); render();
      if (gone && window.Quick && Quick.toast) Quick.toast('<i class="bi bi-x-lg"></i> ' + esc(tname(gone.type)) + ' ' + esc(K('ui.wi-removed', 'removed')), function () { var s2 = store(); s2.changes.splice(Math.min(at, s2.changes.length), 0, gone); save(s2); render(); });
    }
  });
  el.addEventListener('change', function (e) { if (e.target.matches('[data-wiyrs]')) { var sc = store(); sc.years = +e.target.value; save(sc); render(); } });
  el.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-wiform]'); if (!f) return; e.preventDefault();
    var t = f.dataset.wiform, g = function (k) { return f.elements[k] ? f.elements[k].value : ''; };
    var c = { id: uid(), type: t, from: g('from') };
    if (!/^\d{4}-\d{2}$/.test(c.from)) return;
    if (t === 'rate') c.delta = num(g('delta'));
    if (t === 'buy') { c.amount = num(g('amount')); c.loan = !!g('loan'); if (c.loan) { c.rate = num(g('rate')) || 0; c.years = num(g('years')) || 5; } }
    if (t === 'income') c.pct = num(g('pct'));
    if (t === 'extra' || t === 'cost' || t === 'child') c.amount = num(g('amount'));
    if (t === 'cost' && /^\d{4}-\d{2}$/.test(g('until'))) c.until = g('until');
    var bad = ['delta', 'amount', 'pct'].some(function (k) { return k in c && !isFinite(c[k]); });
    if (bad) { var i = f.querySelector('.wi-in'); if (i) { i.focus(); i.select(); } return; }
    var sc = store(); sc.changes.push(c); save(sc); adding = ''; render();
  });
  window.addEventListener('tools:change', function () { if (!el.querySelector('.wi-add')) render(); });
  window.addEventListener('fin:change', function () { if (!el.querySelector('.wi-add')) render(); });
  if (V && V.onUnlock) V.onUnlock(render);
  render();
})();
