/* Reset finances – a careful one. You tick what to clear:
     · Imported transactions  everything that came from bank files (spending, money in, which file is which account),
                              so the same files can be imported again. What you logged yourself stays.
     · Balances               what's in each account (type fresh numbers, or let a new import set them)
     · The setup              accounts, salary, fixed costs, spending limits, yearly costs, payday ticks – the
                              4-step setup opens afterwards with your accounts filled in
     · Everything             all of the above + every expense, savings goals, net worth and its history
   A copy of what was there is kept for 2 minutes (Undo). "Everything" asks you to type RESET. The server's
   daily copies (Settings → Data & sync → Earlier versions) are another way back.
   Opened from Plan → Accounts & fixed costs and Transactions (data-frreset="imports" preselects). */
(function () {
  "use strict";
  if (!window.Vault || !document.getElementById('fp')) return;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  var pick = {}, undo = null, undoT = null;

  var bg = document.createElement('div');
  bg.className = 'qa-bg fr-bg'; bg.hidden = true;
  bg.innerHTML = '<div class="qa-box fr-box" role="dialog" aria-modal="true" aria-label="Reset finances"><div class="qa-handle"></div><div id="frBody"></div></div>';
  document.body.appendChild(bg);

  function counts(d) {
    var b = d.budget || {}, ex = d.expenses || [];
    var bank = ex.filter(function (e) { return e.src === 'bank'; });
    return {
      bank: bank.length, bankKr: bank.reduce(function (s, e) { return s + (+e.amount || 0); }, 0), bankIn: (d.extra || []).filter(function (e) { return e.src === 'bank'; }).length,
      files: Object.keys(d.bankFiles || {}).filter(function (k) { return !/^\d{11}$/.test(k); }).length,
      bals: (b.acctList || []).filter(function (a) { return a.bal != null; }).length,
      accts: (b.acctList || []).filter(function (a) { return !a.off; }).length, fixed: (b.fixed || []).filter(function (f) { return !f.src || f.src === 'year'; }).length, income: (b.income || []).length,
      mine: ex.filter(function (e) { return e.src !== 'bank'; }).length, all: ex.length, goals: (d.savings || []).length, nw: (d.accounts || []).length
    };
  }
  var OPTS = [
    ['imports', 'Imported transactions', 'download', function (c) { return c.bank + ' expense' + (c.bank === 1 ? '' : 's') + ' from bank files (' + nf.format(c.bankKr) + ')' + (c.bankIn ? ' + ' + c.bankIn + ' money in' : '') + ' – so you can import the same files again. What you logged yourself stays.'; }],
    ['balances', 'Balances', 'bank2', function (c) { return c.bals ? 'What’s in your ' + c.bals + ' account' + (c.bals === 1 ? '' : 's') + ' – type fresh numbers, or let the next import set them.' : 'No balances saved.'; }],
    ['setup', 'The setup', 'sliders', function (c) { return 'Accounts, salary, ' + c.fixed + ' fixed cost' + (c.fixed === 1 ? '' : 's') + ', spending limits, yearly costs, payday ticks. The 4-step setup opens afterwards.'; }],
    ['all', 'Everything', 'exclamation-octagon', function (c) { return 'All of the above + all ' + c.all + ' expenses (also the ' + c.mine + ' you logged yourself), ' + c.goals + ' savings goal' + (c.goals === 1 ? '' : 's') + ', net worth and its history.'; }]
  ];
  function draw() {
    var d = window.Vault.get() || {}, c = counts(d), any = Object.keys(pick).some(function (k) { return pick[k]; });
    $('frBody').innerHTML = '<h2 class="im-h"><i class="bi bi-arrow-counterclockwise"></i> Reset finances</h2>' +
      '<p class="muted im-p">Tick what to clear. Nothing else is touched, and you can undo it for 2 minutes afterwards.</p>' +
      '<ul class="fr-list">' + OPTS.map(function (o) {
        var on = pick[o[0]] || (pick.all && o[0] !== 'all');
        return '<li class="' + (o[0] === 'all' ? 'fr-all' : '') + (on ? ' on' : '') + '"><label><input type="checkbox" data-frk="' + o[0] + '"' + (on ? ' checked' : '') + (pick.all && o[0] !== 'all' ? ' disabled' : '') + '>' +
          '<span><b><i class="bi bi-' + o[2] + '"></i> ' + o[1] + '</b><small>' + esc(o[3](c)) + '</small></span></label></li>';
      }).join('') + '</ul>' +
      (pick.all ? '<label class="fr-type"><span>Type <b>RESET</b> to clear everything</span><input id="frWord" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>' : '') +
      '<p class="muted fr-p"><i class="bi bi-cloud-check"></i> The server also keeps a copy of each day (Settings → Data & sync → Earlier versions).</p>' +
      '<div class="qa-acts"><button type="button" class="text-btn" data-frclose>Cancel</button><span class="spacer"></span><button type="button" class="pill-btn wide fr-go" data-frgo' + (any ? '' : ' disabled') + '>Clear</button></div>';
  }
  function open(pre) {
    if (!window.Vault.get()) return;
    pick = {}; if (pre) pick[pre] = true;
    draw(); bg.hidden = false; document.body.classList.add('qa-open'); requestAnimationFrame(function () { bg.classList.add('open'); });
  }
  function close() { bg.classList.remove('open'); document.body.classList.remove('qa-open'); setTimeout(function () { if (!bg.classList.contains('open')) bg.hidden = true; }, 320); }

  function apply() {
    var d = window.Vault.get(); if (!d) return;
    var all = !!pick.all, P = { imports: all || pick.imports, balances: all || pick.balances, setup: all || pick.setup };
    undo = JSON.parse(JSON.stringify(d));
    d.budget = d.budget || { income: [], fixed: [] };
    var b = d.budget, done = [];
    if (P.imports) {
      var n = (d.expenses || []).filter(function (e) { return e.src === 'bank'; }).length;
      d.expenses = (d.expenses || []).filter(function (e) { return e.src !== 'bank'; });
      (d.expenses || []).forEach(function (e) { if (e.ref && /^bank:/.test(e.ref)) delete e.ref; });   // your own entries forget the bank row they were matched to
      d.extra = (d.extra || []).filter(function (e) { return e.src !== 'bank'; });
      delete d.bankFiles; delete d.lastImport; delete b.ccPaid;
      if (b.payslips) Object.keys(b.payslips).forEach(function (k) { if (b.payslips[k] && b.payslips[k].src === 'bank') delete b.payslips[k]; });   // salaries read from imports
      done.push(n + ' imported');
    }
    if (P.balances) { (b.acctList || []).forEach(function (a) { a.bal = null; a.balAt = null; a.balSrc = null; }); done.push('balances'); }
    if (P.setup) {
      b.acctList = []; b.accts = {}; b.income = []; b.fixed = (b.fixed || []).filter(function (f) { return f.src === 'sub' || f.src === 'save' || f.src === 'loan'; });
      ['later', 'ended', 'limits', 'yearly', 'cardBuffer', 'daily', 'saveAcct', 'payDone', 'ccPaid', 'ccDue', 'bufMonths', 'taxBack', 'payslips', 'period'].forEach(function (k) { delete b[k]; });
      d.paid = {};
      done.push('the setup');
    }
    if (all) {
      d.expenses = []; d.extra = []; d.savings = []; d.accounts = []; d.history = {};
      b.fixed = (b.fixed || []).filter(function (f) { return f.src === 'sub'; });       // subscriptions live on their own card
      done = ['everything'];
    }
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
    if (window.Links) { try { window.Links.syncSave(); window.Links.syncLoans(); } catch (e) {} }
    close();
    showUndo('Cleared ' + done.join(', '));
    if (P.setup && window.FinSetup) setTimeout(function () { window.FinSetup.open(0); }, 600);
    else if (P.imports && window.FinTabs) window.FinTabs.go('.card.spending');
  }
  /* a bar at the bottom with Undo for 2 minutes */
  function showUndo(text) {
    var u = $('frUndo');
    if (!u) { u = document.createElement('div'); u.id = 'frUndo'; u.className = 'fr-undo'; u.setAttribute('role', 'status'); document.body.appendChild(u); }
    u.innerHTML = '<span><i class="bi bi-check-lg"></i> ' + esc(text) + '</span><button type="button" class="pill-btn" data-frundo>Undo</button><button type="button" class="icon-btn sm" data-frx aria-label="Close"><i class="bi bi-x-lg"></i></button>';
    u.hidden = false; requestAnimationFrame(function () { u.classList.add('show'); });
    clearTimeout(undoT); undoT = setTimeout(hideUndo, 120000);
  }
  function hideUndo() { var u = $('frUndo'); if (u) { u.classList.remove('show'); setTimeout(function () { u.hidden = true; }, 300); } undo = null; }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-frundo]')) {
      if (undo) { window.Vault.save(undo); window.dispatchEvent(new Event('fin:change')); if (window.FinSetup) window.FinSetup.close(); if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-arrow-counterclockwise"></i> Back as it was'); }
      hideUndo(); return;
    }
    if (e.target.closest('[data-frx]')) { hideUndo(); return; }
    var o = e.target.closest('[data-frreset]'); if (o) { e.preventDefault(); open(o.dataset.frreset || null); }
  });
  bg.addEventListener('click', function (e) {
    if (e.target === bg || e.target.closest('[data-frclose]')) { close(); return; }
    if (e.target.closest('[data-frgo]')) {
      if (pick.all && String(($('frWord') || {}).value || '').trim().toUpperCase() !== 'RESET') { var w = $('frWord'); if (w) { w.focus(); w.classList.add('fr-bad'); } return; }
      apply();
    }
  });
  bg.addEventListener('change', function (e) { var c = e.target.closest('[data-frk]'); if (c) { pick[c.dataset.frk] = c.checked; draw(); if (pick.all) { var w = $('frWord'); if (w) w.focus(); } } });
  bg.addEventListener('input', function (e) { if (e.target.id === 'frWord') e.target.classList.remove('fr-bad'); });
  document.addEventListener('keydown', function (e) { if (!bg.hidden && e.key === 'Escape') close(); });
  window.Vault.onLock(function () { close(); hideUndo(); });
  window.FinReset = { open: open };
})();
