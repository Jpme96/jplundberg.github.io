/* the subscription check (Finances → Subscriptions, 2026-11-15): a charge that went up, and the ones you haven't looked at
   for half a year – drawn by the Subscriptions card in tools.js through window.SubCheck, only on this page. */
(function () {
  "use strict";
  var F = window.Features, K = window.Kit; if (!F || !K || !window.Vault) return;
  var esc = K.esc, today = K.today, fmt = K.fmt, kr = K.kr;
  function addDays(k, n) { var d = F.fromKey(k); d.setDate(d.getDate() + n); return F.dkey(d); }
  /* the subscription check: a charge that went up (seen in what you spent), and the ones you haven't looked at for half a year */
  function subRise(sb) {
    var nm = String(sb.name || '').toLowerCase().trim(); if (nm.length < 3) return null;
    var d = window.Vault.get() || {}, from = addDays(today(), -62), hit = null;
    (d.expenses || []).forEach(function (e) { if (e.date >= from && String(e.note || '').toLowerCase().indexOf(nm) > -1 && (+e.amount || 0) > (+sb.amount || 0) * 1.02 && (!hit || e.date > hit.date)) hit = e; });
    return hit && !(sb.riseSeen && +sb.riseSeen === +hit.amount) ? hit : null;
  }
  var PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  function subCheck(act) {
    var half = addDays(today(), -182), rows = [];
    act.forEach(function (sb) {
      var r = subRise(sb);
      if (r) rows.push('<li class="sub-ck up"><i class="bi bi-graph-up-arrow"></i><span><b>' + esc(sb.name) + '</b><small>' + esc(I18N.k('ui.sub-rise', 'Was {a}, last charge {b} ({d})', { a: kr(+sb.amount), b: kr(+r.amount), d: fmt(r.date, { day: 'numeric', month: 'short' }) })) + '</small></span>' +
        '<button type="button" class="pill-btn sm" data-subprice="' + esc(sb.id) + '|' + (+r.amount) + '">' + esc(I18N.k('ui.sub-update-price', 'Update the price')) + '</button><button type="button" class="text-btn" data-subrise="' + esc(sb.id) + '|' + (+r.amount) + '">' + esc(I18N.k('ui.sub-not-now', 'Not now')) + '</button></li>');
      else if (!sb.checked || sb.checked < half) rows.push('<li class="sub-ck"><i class="bi bi-question-circle"></i><span><b>' + esc(sb.name) + '</b><small>' + esc(I18N.k('ui.sub-still', 'Still using it? {a} a year', { a: kr((+sb.amount || 0) * (PER_MONTH[sb.period] || 1) * 12) })) + '</small></span>' +
        '<button type="button" class="pill-btn sm" data-subkeep="' + esc(sb.id) + '">' + esc(I18N.k('ui.sub-keep', 'Keep')) + '</button><button type="button" class="text-btn" data-subcancel="' + esc(sb.id) + '">' + esc(I18N.k('ui.sub-cancel', 'Cancel it')) + '</button></li>');
    });
    if (!rows.length) return '';
    return '<div class="sub-check"><p class="pa-h"><i class="bi bi-clipboard-check"></i> ' + esc(I18N.k('ui.sub-check', 'Subscription check')) + '</p><ul>' + rows.slice(0, 6).join('') + '</ul></div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-subkeep], [data-subcancel], [data-subprice], [data-subrise]'); if (!b) return;
    var t = F.tools(), l = t.subs || [], v = (b.dataset.subkeep || b.dataset.subcancel || b.dataset.subprice || b.dataset.subrise).split('|'), sb = l.filter(function (x) { return x.id === v[0]; })[0]; if (!sb) return;
    if (b.dataset.subkeep) sb.checked = today();
    else if (b.dataset.subcancel) { sb.paused = true; sb.checked = today(); sb.notes = ((sb.notes || '') + (sb.notes ? '\n' : '') + I18N.k('ui.sub-cancel-note', 'Cancelled {d} – remember to end it with the company too', { d: fmt(today()) })).slice(0, 600); }
    else if (b.dataset.subprice) { sb.amount = +v[1]; sb.checked = today(); }
    else sb.riseSeen = +v[1];
    F.saveTools(t);
    if (b.dataset.subcancel && window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-pause-circle"></i> ' + esc(I18N.k('ui.sub-cancelled', '{x} is paused – cancel it with the company too', { x: sb.name })));
  });

  window.SubCheck = subCheck;
  window.dispatchEvent(new Event('tools:change'));
})();
