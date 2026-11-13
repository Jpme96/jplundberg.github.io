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
/* The page part of fin-tools.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is fin-tools.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["fintools"]; if (!__c) return;
  var esc = __c.esc, affordForm = __c.affordForm, num = __c.num, affordHtml = __c.affordHtml, afford = __c.afford, fin = __c.fin, L = __c.L, rateSeen = __c.rateSeen, rateLog = __c.rateLog, debts = __c.debts, today = __c.today, toast = __c.toast, fmtR = __c.fmtR, kr = __c.kr, Fe = __c.Fe, B = __c.B, ebSpent = __c.ebSpent, isKey = __c.isKey, RED = __c.RED, AMBER = __c.AMBER, GREEN = __c.GREEN, ebSaveMonthly = __c.ebSaveMonthly, fmtD = __c.fmtD, dkey = __c.dkey, cfg = __c.cfg, all = __c.all;
  var EBK = [['event', I18N.k('ui.an-event', 'An event')], ['trip', I18N.k('ui.a-trip', 'A trip')]];
  var ebCol = (window.Kit && document.querySelector('[data-tool="ebud"]')) ? window.Kit.collection({
    mount: document.querySelector('[data-tool="ebud"]'), feature: 'finance', key: 'ebudgets', icon: 'calendar2-heart', title: I18N.k('ui.budgets-for-events-and-trips', 'Budgets for events and trips'), addLabel: I18N.k('ui.add', 'Add'), limit: 6,
    addTitle: 'New budget', editTitle: 'Edit budget', fields: [
      { k: 'name', type: 'title', label: 'For', ph: 'e.g. Christmas, Spain in May, the moving day', req: true },
      { k: 'kind', label: 'It’s', type: 'select', options: EBK, def: 'event', help: 'A trip counts everything you spend between its dates; an event counts what you tag.' },
      { k: 'budget', label: 'Budget', type: 'number', suffix: 'kr', req: true },
      { k: 'start', label: 'From', type: 'date' }, { k: 'end', label: 'To', type: 'date' },
      { k: 'saved', label: 'Already put aside', type: 'number', suffix: 'kr' }],
    empty: I18N.k('ui.christmas-a-birthday-party-the-move-a-tr', 'Christmas, a birthday party, the move, a trip – give it a budget and a date, and you see what’s spent, what’s left, and what to put aside each month until then.'),
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
        (l.length ? '<ul class="eb-l">' + l.slice(0, 8).map(function (e) { return '<li><span>' + esc(e.note || e.cat) + ' <small>' + esc(fmtD(e.date)) + '</small></span><b>' + esc(kr(e.amount)) + '</b>' + (e.ebud ? '<button type="button" class="icon-btn sm" data-ebuntag="' + esc(e.id) + '" aria-label="Don’t count it"><i class="bi bi-x-lg"></i></button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted hl-small" data-t="ui.nothing-counted-yet">Nothing counted yet.</p>') +
        (near.length ? '<p class="fx-sub" data-t="ui.count-a-recent-spending">Count a recent spending</p><ul class="eb-l">' + near.map(function (e) { return '<li><span>' + esc(e.note || e.cat) + ' <small>' + esc(fmtD(e.date)) + '</small></span><b>' + esc(kr(e.amount)) + '</b><button type="button" class="icon-btn sm" data-ebtag="' + esc(e.id) + '|' + esc(b.id) + '" aria-label="Count it"><i class="bi bi-plus-lg"></i></button></li>'; }).join('') + '</ul>' : '') +
        '<div class="hl-acts">' + (per && !has ? '<button type="button" class="pill-btn" data-ebsave="' + esc(b.id) + '"><i class="bi bi-piggy-bank"></i> Put aside ' + esc(kr(per)) + ' a month</button>' : has ? '<span class="muted hl-small"><i class="bi bi-check2"></i> <span data-t="ui.in-your-payday-moves">In your payday moves</span></span>' : '') + '</div>';
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
})();
