/* Change one bill (a fixed cost you added yourself) – and bills whose amount changes from month to month.
   Opened by anything with data-fbopen="<fixed id>" (Setup → Accounts & fixed costs, Next 14 days, the budget editor)
   or window.FinBill.open(id).
   A bill that varies (power, phone, kindergarten …) keeps f.vary = true, f.usual (the normal amount, optional) and
   f.months = { 'YYYY-MM': kr } – typed in here, or taken from a bank import when the bill's payment is found.
   Budget.fixedAmt(f, month) gives the amount for any month; f.amount follows the current month (Links.syncVary). */
(function () {
  "use strict";
  if (!window.Vault || !document.getElementById('fp')) return;
  var $ = function (id) { return document.getElementById(id); };
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '').replace('−', '-'); if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var n = parseFloat(s.replace(',', '.')); return isFinite(n) ? n : NaN; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function addM(k, n) { var d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1 + n, 1); return ymOf(d); }
  function mName(k, long) { return new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString('en-GB', long ? { month: 'long', year: 'numeric' } : { month: 'short' }); }

  var bg = document.createElement('div');
  bg.className = 'qa-bg fs-bg fb-bg'; bg.hidden = true;
  bg.innerHTML = '<div class="qa-box fs-box fb-box" role="dialog" aria-modal="true" aria-label="Change a bill"><div class="qa-handle"></div><form id="fbForm" novalidate></form></div>';
  document.body.appendChild(bg);

  var cur = null;          // { id, vary } while the sheet is open
  var draft = null;          /* a new bill being added (not saved yet) */
  function bill(d, id) { if (id === 'new') return draft; var b = (d && d.budget) || {}; return [].concat(b.fixed || [], b.later || [], b.ended || []).filter(function (f) { return f && f.id === id; })[0] || null; }

  function draw() {
    var d = window.Vault.get(), f = d && bill(d, cur.id); if (!f) { close(); return; }
    var B = window.Budget, now = ymOf(new Date()), vary = cur.vary;
    var A = window.Accts, accts = A ? A.list(d).filter(function (a) { return a.kind !== 'savings' && a.kind !== 'fund'; }) : [];
    var acct = f.acct && accts.some(function (a) { return a.id === f.acct; }) ? f.acct : (accts[0] || { id: 'salary' }).id;
    var days = '<option value="">No fixed day</option>'; for (var i = 1; i <= 31; i++) days += '<option value="' + i + '"' + (+f.day === i ? ' selected' : '') + '>the ' + i + '.</option>';
    var m = f.months || {}, avg = B.varyAvg(f, now);
    /* months: the last three, this one and the next two */
    var rows = '';
    if (vary) {
      for (var k = -3; k <= 2; k++) {
        var key = addM(now, k), has = m[key] != null && m[key] !== '', est = Math.round(B.fixedAmt(Object.assign({}, f, { vary: true }), key));
        rows += '<li class="' + (key === now ? 'now' : key < now ? 'past' : '') + '"><span>' + esc(mName(key, true)) + (key === now ? '<small data-t="ui.this-month-2">this month</small>' : has && f.mbank && f.mbank[key] ? '<small data-t="ui.from-the-bank">from the bank</small>' : '') + '</span>' +
          '<input data-fbm="' + key + '" inputmode="decimal" autocomplete="off" value="' + (has ? esc(String(m[key])) : '') + '" placeholder="' + (est > 0 ? '≈ ' + esc(est.toLocaleString('nb-NO')) : 'kr') + '" aria-label="Amount for ' + esc(mName(key, true)) + '"></li>';
      }
    }
    /* a little history: every month with an amount (up to 12) */
    var hist = Object.keys(m).filter(function (x) { return /^\d{4}-\d{2}$/.test(x) && m[x] !== '' && isFinite(+m[x]); }).sort().slice(-12), max = Math.max.apply(null, hist.map(function (x) { return +m[x]; }).concat([1]));
    var chart = vary && hist.length >= 2 ? '<div class="fb-hist" role="img" aria-label="Last ' + hist.length + ' months">' + hist.map(function (x) {
      return '<span class="' + (x === now ? 'now' : '') + '" title="' + esc(mName(x, true) + ': ' + kr(m[x])) + '"><i style="height:' + Math.max(4, Math.round(+m[x] / max * 56)) + 'px"></i><small>' + esc(mName(x).slice(0, 3)) + '</small></span>';
    }).join('') + '</div>' : '';
    $('fbForm').innerHTML =
      '<h2 class="im-h"><i class="bi bi-receipt"></i> ' + (f === draft ? 'New bill' : esc(f.name || 'Bill')) + '</h2>' +
      '<div class="fs-form fb-form">' +
        '<label><span data-t="ui.name-2">Name</span><input name="n" value="' + esc(f.name) + '" required maxlength="50" autocomplete="off"></label>' +
        '<label class="qa-check fb-vary"><input type="checkbox" name="vary"' + (vary ? ' checked' : '') + '> The amount changes from month to month <small class="muted">power, phone, kindergarten …</small></label>' +
        (vary ?
          '<div class="fb-usual"><label><span>Usually, kr</span><input name="u" inputmode="decimal" autocomplete="off" value="' + (+f.usual > 0 ? esc(String(f.usual)) : '') + '" placeholder="' + (avg ? '≈ ' + esc(avg.toLocaleString('nb-NO')) + ' (average)' : 'e.g. 900') + '"></label>' +
            '<p class="muted fs-hint">Used for months without their own amount' + (avg ? ' – leave it empty to use the average of the last three months (' + esc(kr(avg)) + ')' : '') + '. Bank imports fill in the real amount when they find the payment.</p></div>' +
          chart +
          '<p class="fb-mh">Amount each month</p><ul class="fb-months">' + rows + '</ul>'
        : '<label><span>Kr a month</span><input name="a" inputmode="decimal" autocomplete="off" value="' + (f === draft && !f.amount ? '' : esc(String(Math.round(+f.amount || 0)))) + '" placeholder="e.g. 900" required></label>') +
        '<div class="fs-r2 fb-when"><label><span>First month</span><input type="month" name="from" value="' + esc(f.from || '') + '"></label><label><span data-t="ui.last-month">Last month</span><input type="month" name="until" value="' + esc(f.until || '') + '"></label></div>' +
        '<p class="muted fs-hint">Optional. Rent that stops when you move, a contract that ends – outside these months the bill isn’t counted.</p>' +
        '<div class="fs-r2"><label><span>Due</span><select name="day">' + days + '</select></label>' +
          (accts.length ? '<label><span>Paid from</span><select name="acct">' + accts.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === acct ? ' selected' : '') + '>' + esc(a.label) + '</option>'; }).join('') + '</select></label>' : '') + '</div>' +
      '</div>' +
      '<div class="qa-acts fs-foot">' + (f === draft ? '' : '<button type="button" class="text-btn danger" data-fbdel data-t="ui.delete">Delete</button>') + '<span class="spacer"></span><button type="button" class="text-btn" data-fbclose data-t="ui.cancel">Cancel</button><button type="submit" class="pill-btn" data-t="ui.save">Save</button></div>';
  }

  function open(id) {
    if (id === 'new') { var d0 = window.Vault.get(); if (!d0) return; draft = { id: 'new', name: '', amount: '', day: null }; }
    var d = window.Vault.get(), f = d && bill(d, id); if (!f) return;
    if (f.src) return;                  // linked bills (loans, subscriptions, savings, yearly) are changed where they come from
    if (f.split && window.SharedHome) { window.SharedHome.run(id); return; }      // a running cost you share: the House page's sheet
    cur = { id: id, vary: !!f.vary }; draw();
    bg.hidden = false; document.body.classList.add('qa-open'); requestAnimationFrame(function () { bg.classList.add('open'); });
  }
  function close() { cur = null; bg.classList.remove('open'); document.body.classList.remove('qa-open'); setTimeout(function () { if (!bg.classList.contains('open')) bg.hidden = true; }, 320); }

  /* keep what's typed when the checkbox redraws the form */
  function keepTyped(f, form) {
    if (form.n) f.name = form.n.value;
    if (form.day) f.day = form.day.value ? +form.day.value : null;
    if (form.acct) f.acct = form.acct.value;
    if (form.from) f.from = form.from.value; if (form.until) f.until = form.until.value;
  }
  bg.addEventListener('change', function (e) {
    if (!cur || e.target.name !== 'vary') return;
    var form = $('fbForm'), d = window.Vault.get(), f = bill(d, cur.id); if (!f) return;
    var tmp = { name: f.name, day: f.day, acct: f.acct, from: f.from, until: f.until }; keepTyped(tmp, form);
    cur.vary = e.target.checked;
    var typedAmt = form.a ? num(form.a.value) : NaN;
    draw();
    form = $('fbForm'); form.n.value = tmp.name; form.day.value = tmp.day || ''; if (form.acct && tmp.acct) form.acct.value = tmp.acct; form.from.value = tmp.from || ''; form.until.value = tmp.until || '';
    /* switching on: this month starts as what the bill was; switching off: the usual/this month's amount */
    if (cur.vary) { var mi = form.querySelector('[data-fbm="' + ymOf(new Date()) + '"]'); if (mi && !mi.value && typedAmt > 0) mi.value = Math.round(typedAmt); if (mi) mi.focus(); }
    else if (form.a) form.a.select();
  });
  bg.addEventListener('submit', function (e) {
    e.preventDefault(); if (!cur) return;
    var form = $('fbForm'), d = window.Vault.get(), f = bill(d, cur.id); if (!f) { close(); return; }
    var name = form.n.value.trim(); if (!name) { form.n.focus(); return; }
    var B = window.Budget, now = ymOf(new Date());
    if (cur.vary) {
      var months = Object.assign({}, f.months || {}), bad = null;
      [].forEach.call(form.querySelectorAll('[data-fbm]'), function (inp) {
        var k = inp.dataset.fbm, v = inp.value.trim();
        if (!v) { delete months[k]; if (f.mbank) delete f.mbank[k]; return; }
        var n = num(v); if (!(n >= 0)) { bad = bad || inp; return; }
        if (+months[k] !== Math.round(n) && f.mbank) delete f.mbank[k];          // typed over the bank's amount
        months[k] = Math.round(n);
      });
      var u = form.u.value.trim() ? num(form.u.value) : null;
      if (bad) { bad.focus(); return; }
      if (u != null && !(u > 0)) { form.u.focus(); return; }
      f.vary = true; f.months = months; if (u > 0) f.usual = Math.round(u); else delete f.usual;
      var a = Math.round(B.fixedAmt(f, now));
      if (!(a > 0)) { var mi = form.querySelector('[data-fbm="' + now + '"]'); (form.u.value ? mi : form.u).focus(); if (window.Quick && window.Quick.toast) window.Quick.toast('Give it this month’s amount or a usual one'); return; }
      f.amount = a;
    } else {
      var amt = num(form.a.value); if (!(amt > 0)) { form.a.focus(); return; }
      f.amount = Math.round(amt); delete f.vary; delete f.usual; delete f.months; delete f.mbank;
    }
    if (f === draft) { f = Object.assign({}, draft, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }); delete f.draft; d.budget = d.budget || { income: [], fixed: [] }; d.budget.fixed = d.budget.fixed || []; d.budget.fixed.push(f); draft = null; }
    f.name = name.slice(0, 50); f.day = form.day.value ? +form.day.value : null; if (form.acct) f.acct = form.acct.value;
    var fr = form.from && form.from.value, un = form.until && form.until.value;
    if (fr && un && un < fr) { form.until.focus(); return; }
    if (fr) f.from = fr; else delete f.from; if (un) f.until = un; else delete f.until;
    window.Vault.save(d); window.dispatchEvent(new Event('fin:change'));
    close();
    if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-check-lg"></i> ' + esc(f.name) + ' saved' + (f.vary ? ' · ' + esc(kr(f.amount)) + ' this month' : ''));
  });
  bg.addEventListener('click', function (e) {
    var t = e.target;
    if (t === bg || t.closest('[data-fbclose]')) { close(); return; }
    if (t.closest('[data-fbdel]') && cur) {
      var d = window.Vault.get(), f = bill(d, cur.id); if (!f) { close(); return; }
      var id = cur.id, go = function () { var d2 = window.Vault.get(); ['fixed', 'later', 'ended'].forEach(function (k) { if (Array.isArray(d2.budget[k])) d2.budget[k] = d2.budget[k].filter(function (x) { return x.id !== id; }); }); window.Vault.save(d2); window.dispatchEvent(new Event('fin:change')); };
      close();
      if (window.VaultUndo) window.VaultUndo('<i class="bi bi-trash3"></i> ' + String(f.name || 'Bill').replace(/[<>&]/g, '') + ' deleted', go); else go();
    }
  });
  document.addEventListener('keydown', function (e) { if (!bg.hidden && e.key === 'Escape') close(); });
  window.Vault.onLock(close);
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-fbopen]'); if (b && !bg.contains(b)) { e.preventDefault(); open(b.dataset.fbopen); } });
  window.FinBill = { open: open, close: close };
})();
