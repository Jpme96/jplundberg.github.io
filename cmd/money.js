/* Money card on the dashboard: what's left, the next payday and bills due soon.
   Logging and editing live on the Finances page – this is the glance. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var box = $('moneyBody');
  if (!box) return;
  var B = window.Budget, Fe = window.Features;
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)); }
  function money(n, cls) { return '<span class="money' + (cls ? ' ' + cls : '') + '">' + esc(kr(n)) + '</span>'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ym(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function sum(l, f) { return (l || []).reduce(function (a, x) { return a + (+(f ? f(x) : x.amount) || 0); }, 0); }

  function render() {
    var d = window.Vault && window.Vault.get();
    if (!d) { box.innerHTML = ''; return; }
    var now = new Date(), key = ym(now), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var b = d.budget || { income: [], fixed: [] };
    var per = B.period(d, now), income = per.income, fixed = sum(b.fixed), spent = B.spent(d, per);
    var left = income - fixed - spent;
    if (!income && !fixed && !spent) {
      box.innerHTML = '<p class="empty">Set up your budget on the Finances page – salary, fixed costs – and this shows what you can spend each day.</p>' +
        '<div class="mo-acts"><a class="pill-btn wide" href="finance/#c=budget"><i class="bi bi-pie-chart"></i> Set up budget</a></div>';
      return;
    }
    var pay = B.nextPayday(d, now), untilPay = per.byPayday || (pay && pay.days > 0 && pay.days <= dim);
    var perDay = left > 0 ? left / (per.byPayday ? per.daysLeft : untilPay ? pay.days : dim - now.getDate() + 1) : 0;
    var base = Math.max(income, fixed + spent, 1), w = function (v) { return Math.max(0, v / base * 100).toFixed(2) + '%'; };

    /* bills: overdue or due within a week */
    var paid = (d.paid && d.paid[key]) || [], today = now.getDate();
    var due = (b.fixed || []).filter(function (f) { return f.day && paid.indexOf(f.id) < 0 && !(f.src === 'sub' && Math.min(f.day, dim) <= today); })
      .map(function (f) { return { f: f, diff: Math.min(f.day, dim) - today }; })
      .filter(function (x) { return x.diff <= 7; }).sort(function (a, b) { return a.diff - b.diff; }).slice(0, 3);

    /* where the period ends up at this pace, and what today has cost */
    var pc = B.pace ? B.pace(d, now) : null, tk = key + '-' + String(now.getDate()).padStart(2, '0');
    var todaySum = sum((d.expenses || []).filter(function (e) { return e.date === tk; }));
    var paceHtml = !pc || left < 0 ? '' : pc.ok
      ? '<p class="mo-pace ok"><i class="bi bi-check-circle"></i><span>On track – about ' + money(pc.end) + ' left ' + (per.byPayday ? 'at payday' : 'at the end of the month') + '</span></p>'
      : '<p class="mo-pace warn"><i class="bi bi-speedometer2"></i><span>At this pace ' + money(-pc.end) + ' over ' + (per.byPayday ? 'by payday' : 'this month') + ' · keep to ' + money(Math.max(0, (pc.room - pc.spent) / per.daysLeft)) + '/day</span></p>';
    /* a small chart: spending so far, an even pace to the budget, and where this pace ends */
    var spark = '';
    if (pc && pc.room > 0) {
      var W = 300, H = 64, P = 4, cum = [], acc = 0, byDay = {};
      (d.expenses || []).forEach(function (e) { if (per.has(e.date)) { var k = String(e.date).slice(0, 10); byDay[k] = (byDay[k] || 0) + (+e.amount || 0); } });
      for (var i = 0; i < pc.elapsed; i++) { var dd = new Date(per.start); dd.setDate(dd.getDate() + i); acc += byDay[dd.getFullYear() + '-' + pad(dd.getMonth() + 1) + '-' + pad(dd.getDate())] || 0; cum.push(acc); }
      var mx = Math.max(pc.room, pc.projected, acc) * 1.05 || 1, X = function (i) { return P + i / Math.max(1, per.days - 1) * (W - 2 * P); }, Y = function (v) { return H - P - v / mx * (H - 2 * P); };
      var pts = cum.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ');
      spark = '<svg class="mo-spark' + (pc.ok ? '' : ' warn') + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Spending so far against the budget">' +
        '<line class="ref" x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(per.days - 1) + '" y2="' + Y(pc.room) + '"/>' +
        '<polyline class="ln" points="' + pts + '"/>' +
        '<line class="proj" x1="' + X(pc.elapsed - 1) + '" y1="' + Y(acc) + '" x2="' + X(per.days - 1) + '" y2="' + Y(pc.projected) + '"/>' +
        '</svg>' +
        '<div class="mo-spark-l"><span><i class="ln"></i>Spent</span><span><i class="ref"></i>Budget pace</span><span><i class="proj"></i>At this pace</span></div>';
    }
    box.innerHTML =
      '<div class="mo-top"><div><div class="big-num' + (left < 0 ? ' neg' : '') + '">' + money(left) + '</div>' +
        '<div class="muted">' + (left < 0 ? 'over budget this month' : 'left' + (untilPay ? ' until payday' : ' this month') + (left > 0 ? ' · ' + money(perDay) + '/day' : '')) + '</div></div></div>' +
      '<div class="stack" role="img" aria-label="Fixed ' + esc(kr(fixed)) + ', spent ' + esc(kr(spent)) + ', left ' + esc(kr(left)) + '">' +
        '<span class="s-fixed" style="width:' + w(fixed) + '"></span><span class="s-spent" style="width:' + w(spent) + '"></span><span class="s-left" style="width:' + w(Math.max(left, 0)) + '"></span></div>' +
      paceHtml + spark +
      '<ul class="mo-rows">' +
        (todaySum > 0 ? '<li><i class="bi bi-bag"></i><span>Spent today</span>' + money(todaySum) + '</li>' : '') +
        '<li><i class="bi bi-receipt"></i><span>Spent ' + (per.byPayday ? 'since payday' : 'in ' + esc(now.toLocaleDateString('en-GB', { month: 'short' }))) + '</span>' + money(spent) + '</li>' +
        (per.extra ? '<li><i class="bi bi-arrow-down-left-circle"></i><span>Money in (refunds, Vipps)</span><span class="money">+' + esc(kr(per.extra)) + '</span></li>' : '') +
        (pay ? '<li><i class="bi bi-cash-stack"></i><span>' + esc(pay.title) + (pay.days === 0 ? ' <b>today</b>' : pay.days === 1 ? ' <b>tomorrow</b>' : ' ' + pay.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · in ' + pay.days + ' days') + '</span>' + (pay.net ? money(pay.net) : '') + '</li>' : '') +
        due.map(function (x) {
          return '<li' + (x.diff < 0 ? ' class="late"' : '') + '><i class="bi bi-' + (x.diff < 0 ? 'exclamation-circle' : 'calendar-check') + '"></i><span>' + esc(x.f.name) +
            (x.diff < 0 ? ' <b>overdue</b> ' + (-x.diff) + ' day' + (x.diff === -1 ? '' : 's') : x.diff === 0 ? ' <b>due today</b>' : ' due in ' + x.diff + ' day' + (x.diff === 1 ? '' : 's')) + '</span>' + money(x.f.amount) + '</li>';
        }).join('') +
      '</ul>' +
      '<div class="mo-acts"><button type="button" class="pill-btn wide" data-quick="expense"><i class="bi bi-plus-lg"></i> Log expense</button>' +
        (due.length ? '<a class="text-btn" href="finance/#c=bills">Bills</a>' : '') + '</div>';
  }

  /* hide amounts (shared with the Finances page) */
  var hb = $('finHide');
  function setHidden(on) {
    document.body.classList.toggle('fin-hidden', on);
    hb.innerHTML = '<i class="bi bi-eye' + (on ? '-slash' : '') + '"></i>';
    hb.setAttribute('aria-label', on ? 'Show amounts' : 'Hide amounts');
    try { localStorage.setItem('dash.finHide', on ? '1' : '0'); } catch (e) {}
  }
  if (hb && !hb.dataset.bound) {
    hb.dataset.bound = '1';
    hb.addEventListener('click', function () { setHidden(!document.body.classList.contains('fin-hidden')); });
    try { setHidden(localStorage.getItem('dash.finHide') === '1'); } catch (e) { setHidden(false); }
  }

  window.Vault.onUnlock(function () { setTimeout(render, 0); });
  window.Vault.onLock(function () { box.innerHTML = ''; });
  ['fin:change', 'features:change', 'tools:change'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(render, 0); }); });
  setInterval(render, 60000);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
})();
