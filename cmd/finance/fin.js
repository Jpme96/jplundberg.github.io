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
      return '<div class="fp-tile"><div class="lbl"><i class="bi bi-' + t.i + '"></i>' + t.l + '</div><div class="val">' + t.v + '</div><div class="sub">' + t.s + '</div></div>';
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
    var max = rows[0].v;
    $('fpCats').innerHTML = rows.map(function (r) {
      var ch = r.p > 0 ? (r.v - r.p) / r.p : null;
      var meta = Math.round(r.v / total * 100) + ' % of spending' + (months.length > 1 ? ' · ' + esc(kr(r.v / months.length)) + '/month' : '') +
        (ch === null ? ' · new' : ' · <span class="' + (ch <= 0 ? 'up' : 'down') + '">' + (ch > 0 ? '+' : '') + Math.round(ch * 100) + ' %</span>');
      return '<li><span class="name">' + dot(r.c.color) + esc(r.c.name) + '</span><span class="amt">' + money(r.v) + '</span>' +
        '<span class="bar"><span style="width:' + (r.v / max * 100).toFixed(1) + '%;background:' + r.c.color + '"></span></span>' +
        '<span class="meta">' + meta + '</span></li>';
    }).join('');
  }

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
  window.Vault.onLock(function () {
    D = null;
    hideTip();
    ['fpTiles', 'fpMonths', 'fpMonthsTable', 'fpPace', 'fpCats', 'fpNet', 'fpNetSub', 'fpNetChart', 'fpAccs', 'fpGoals', 'fpTop'].forEach(function (id) { if ($(id)) $(id).innerHTML = ''; });
  });
})();
