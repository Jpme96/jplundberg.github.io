/* Connections: when you change something in one place, the places that depend on it follow.
   Runs on every dashboard page, after the vault is unlocked.
   - Subscriptions → Monthly budget: each active subscription is a fixed cost (per month;
     yearly and quarterly ones spread out), monthly ones also get a due day in Upcoming bills
   - Trips → Finances: booking costs and a trip's other costs are spending (Travel), old trips too
   - Trips → Places to visit: a place you've now been to is ticked off as visited
   - Workouts → your training habit: a logged workout ticks the habit that day
   (workouts, courses and health → calendar in features.js) */
(function () {
  "use strict";
  var F = window.Features;
  if (!F || !window.Vault) return;
  var PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

  /* ---------- subscriptions → budget fixed costs ---------- */
  function syncSubs() {
    var d = window.Vault.get();
    if (!d) return;
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = F.on('subs') ? F.list('subs').filter(function (s) { return !s.paused && +s.amount > 0; }).map(function (s) {
      var monthly = (s.period || 'monthly') === 'monthly', old = fixed.filter(function (f) { return f.id === 'sub-' + s.id; })[0];
      var day = monthly && /^\d{4}-\d{2}-\d{2}$/.test(s.renews || '') ? +s.renews.slice(8, 10) : null;
      return { id: 'sub-' + s.id, name: s.name + (monthly ? '' : ' (' + (s.period === 'yearly' ? 'yearly' : 'every 3 months') + ')'),
        amount: Math.round((+s.amount) * (PER_MONTH[s.period] || 1)), day: day, src: 'sub' };
    }) : [];
    var mine = fixed.filter(function (f) { return f.src !== 'sub'; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'sub'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = mine.concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }

  /* ---------- savings goals → budget: "set aside every month" becomes a fixed cost ---------- */
  function syncSave() {
    var d = window.Vault.get(), B = window.Budget;
    if (!d || !B || !B.saveMonthly) return;
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = (d.savings || []).filter(function (g) { return g.aside; }).map(function (g) {
      return { id: 'save-' + g.id, name: 'Savings: ' + (g.name || 'goal'), amount: B.saveMonthly(g), day: null, src: 'save', goal: g.id, to: g.to || '' };
    }).filter(function (f) { return f.amount > 0; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'save'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = fixed.filter(function (f) { return f.src !== 'save'; }).concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }
  /* loans (Net worth → a debt with a monthly payment) → fixed costs, so the budget knows the payment */
  function syncLoans() {
    var d = window.Vault.get(); if (!d || !window.Loans) return;     /* needs budget.js (shared loans); pages without it leave this to the ones with it */
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = (d.accounts || []).filter(function (a) { return a.kind === 'debt' && a.fixed !== false && (+a.pay > 0 || a.inner) && window.Loans.owedNow(a) > 0.5 && !(a.asOf > dk(new Date())); }).map(function (a) {     /* a paid-off loan stops costing */
      /* a shared loan: only your part of the payment (and fee) goes into your budget */
      var part = window.Loans.part ? window.Loans.part(a) : 1;
      if (a.inner) return { id: 'loan-' + a.id, name: 'Loan: ' + (a.name || 'loan') + ' (your part)', amount: Math.round(window.Loans.myPay(a)), day: a.day || null, src: 'loan', acct: a.from || 'salary', start: a.asOf || null };
      return { id: 'loan-' + a.id, name: 'Loan: ' + (a.name || 'loan') + (part < 1 ? ' (your ' + Math.round(part * 100) + ' %)' : ''), amount: Math.round((+a.pay + (+a.fee || 0)) * part), day: a.day || null, src: 'loan', acct: a.from || 'salary', start: a.asOf || null };
    });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'loan'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = fixed.filter(function (f) { return f.src !== 'loan'; }).concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }
  /* fixed costs that change from month to month: f.amount follows this month (Budget.fixedAmt) */
  function syncVary() {
    var d = window.Vault.get(), B = window.Budget; if (!d || !B || !B.fixedAmt) return;
    var fixed = (d.budget && Array.isArray(d.budget.fixed)) ? d.budget.fixed : [], ch = false, k = B.ym(new Date());
    fixed.forEach(function (f) {
      if (!f || !(f.vary || f.split) || f.src) return;
      var a = Math.round(B.fixedAmt(f, k));
      if (a > 0 && a !== +f.amount) { f.amount = a; ch = true; }
      /* keep a year and a bit of history */
      var ks = Object.keys(f.months || {}).sort(); if (ks.length > 15) { ks.slice(0, ks.length - 15).forEach(function (x) { delete f.months[x]; }); ch = true; }
    });
    if (!ch) return;
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }
  /* floating rates that follow Norges Bank (a.float = { margin, lag (days), since, applied: [change dates] }):
     when the policy rate changes, the loan's rate becomes policy + margin once the bank's notice has run (lag days).
     The loan is then re-based on its last due date: what's owed then, the months left, and a new instalment
     (the term stays – that's what Norwegian banks do). a.rateLog keeps the history. */
  function dk(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function syncRates() {
    var d = window.Vault.get(), P = window.Policy, L = window.Loans; if (!d || !P || !L) return false;
    var ch = false, today = dk(new Date());
    (d.accounts || []).forEach(function (a) {
      var fl = a && a.kind === 'debt' && !a.plan && a.float; if (!fl || !a.asOf) return;
      fl.applied = Array.isArray(fl.applied) ? fl.applied : [];
      (P.data().changes || []).forEach(function (c) {
        if (c.date <= (fl.since || '') || fl.applied.indexOf(c.date) > -1) return;
        var eff = new Date(c.date + 'T12:00'); eff.setDate(eff.getDate() + (+fl.lag >= 0 ? +fl.lag : 42));
        if (dk(eff) > today) return;
        var nr = Math.round((+c.rate + (+fl.margin || 0)) * 1000) / 1000;
        rebase(a, eff, nr); fl.applied.push(c.date);
        a.rateLog = (a.rateLog || []).concat([{ date: dk(eff), rate: nr, policy: +c.rate }]).slice(-24);
        ch = true;
      });
    });
    if (ch) { window.Vault.save(d); syncLoans(); window.dispatchEvent(new Event('fin:change')); }
    return ch;
  }
  function rebase(a, eff, rate) {
    var L = window.Loans, day = +a.day || +String(a.asOf).slice(8, 10) || 1;
    /* the last due date on or before the day the new rate starts */
    var r = new Date(eff.getFullYear(), eff.getMonth(), Math.min(day, new Date(eff.getFullYear(), eff.getMonth() + 1, 0).getDate()));
    if (r > eff) r = new Date(eff.getFullYear(), eff.getMonth() - 1, Math.min(day, new Date(eff.getFullYear(), eff.getMonth(), 0).getDate()));
    if (dk(r) <= a.asOf) {          /* no payment since the balance was entered: just the new rate (and instalment, same term) */
      if (!a.inner && +a.pay > 0) { var b0 = +a.balance || 0, i0 = (+a.rate || 0) / 1200, n0 = 0; while (b0 > 0.5 && n0 < 1200) { b0 = b0 * (1 + i0) - (+a.pay); n0++; } if (n0 > 0 && n0 < 1200) a.pay = Math.round(L.payment(+a.balance || 0, rate, n0)); }
      a.rate = rate; if (a.inner) a.pay = Math.round(L.payment(+a.inner.mine, rate, +a.inner.months) + L.payment(Math.max(0, a.balance - a.inner.mine), rate, +a.inner.months));
      return;
    }
    if (a.inner) {
      var q = L.inner(a, new Date(r.getFullYear(), r.getMonth(), r.getDate(), 12)); if (!q) { a.rate = rate; return; }
      var key = dk(r);
      a.extraDone = (a.extraDone || []).concat((a.extra || []).filter(function (e) { return e.date <= key; })).slice(-40);
      a.extra = (a.extra || []).filter(function (e) { return e.date > key; });
      a.inner.mine = Math.round(q.me.bal); a.balance = Math.round(q.me.bal + q.them.bal); a.inner.months = q.left; a.asOf = key; a.rate = rate;
      a.pay = Math.round(L.payment(q.me.bal, rate, q.left) + (q.them.bal > 0.5 ? L.payment(q.them.bal, rate, q.left) : 0));
      return;
    }
    if (!(+a.pay > 0)) { a.rate = rate; return; }
    var bal = L.balanceNow(a, new Date(r.getFullYear(), r.getMonth(), r.getDate(), 12)), i = (+a.rate || 0) / 1200, n = 0, b = bal;
    while (b > 0.5 && n < 1200) { b = b * (1 + i) - (+a.pay); n++; }
    a.balance = Math.round(bal); a.asOf = dk(r); a.rate = rate;
    if (n > 0 && n < 1200) a.pay = Math.round(L.payment(bal, rate, n));
  }
  /* bills with a first / last month: only the ones for this month are in d.budget.fixed */
  function syncDates() {
    var d = window.Vault.get(), B = window.Budget; if (!d || !B || !B.activeIn || !d.budget) return;
    var b = d.budget, k = B.ym(new Date()), fixed = Array.isArray(b.fixed) ? b.fixed : [], later = Array.isArray(b.later) ? b.later : [], ended = Array.isArray(b.ended) ? b.ended : [];
    var all = fixed.concat(later), keep = [], wait = [], gone = ended.slice(), ch = false;
    all.forEach(function (f) {
      if (!f || f.src || (!f.from && !f.until)) { keep.push(f); return; }
      var where = f.until && f.until < k ? gone : f.from && f.from > k ? wait : keep;
      where.push(f);
    });
    /* an ended bill whose end you moved later comes back */
    gone = gone.filter(function (f) { if (f && !f.src && (!f.until || f.until >= k)) { (f.from && f.from > k ? wait : keep).push(f); return false; } return true; });
    if (keep.length !== fixed.length || wait.length !== later.length || gone.length !== ended.length) ch = true;
    if (!ch) return;
    b.fixed = keep; b.later = wait; b.ended = gone.slice(-30);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }
  window.Links = { syncSave: syncSave, syncLoans: syncLoans, syncVary: syncVary, syncRates: syncRates, syncDates: syncDates };

  /* ---------- trips → places to visit ---------- */
  function near(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return false;
    var dx = (a.lat - b.lat) * 111, dy = (a.lon - b.lon) * 111 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy) < 30;                 // within 30 km counts as the same place
  }
  function syncBucket() {
    if (!window.Flow || !F.on('bucket')) return;
    var today = F.dkey(new Date()), been = window.Flow.travel().trips.filter(function (t) { return t.start && t.start <= today && t.place; });
    if (!been.length) return;
    var t = F.tools(), changed = false;
    (t.bucket || []).forEach(function (b) {
      if (b.visited) return;
      var hit = been.filter(function (tr) {
        return near(tr.place, b.geo) || String(tr.place.name).toLowerCase() === String(b.place).toLowerCase();
      })[0];
      if (hit) { b.visited = true; b.visitedTrip = hit.id; changed = true; }
    });
    if (changed) F.saveTools(t);
  }

  /* ---------- trips → Finances ----------
     Every booking cost and a trip's "other costs" are spending in Finances (category Travel).
     Older trips and bookings made before this was automatic are added too: past ones on
     their own date, upcoming ones today (that's when you paid). Removed in Finances = left out. */
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) && n > 0 ? n : 0;
  }
  var syncingTrips = false;
  function syncTrips() {
    var d = window.Vault.get(), Fl = window.Flow;
    if (!d || !Fl || syncingTrips) return;
    d.expenses = Array.isArray(d.expenses) ? d.expenses : [];
    var byId = {}; d.expenses.forEach(function (e) { byId[e.id] = e; });
    var today = F.dkey(new Date()), tr = Fl.travel(), finChanged = false, travelChanged = false;
    function want(owner, idKey, amount, date, note, keepOutKey) {
      var ex = owner[idKey] && byId[owner[idKey]];
      if (owner[idKey] && !ex) { delete owner[idKey]; owner[keepOutKey] = true; travelChanged = true; return; }   // deleted in Finances
      if (!amount) { if (ex) { d.expenses = d.expenses.filter(function (x) { return x !== ex; }); delete owner[idKey]; finChanged = travelChanged = true; } return; }
      if (ex) {
        if (ex.amount !== amount || ex.note !== note) { ex.amount = amount; ex.note = note; finChanged = true; }
        return;
      }
      if (owner[keepOutKey]) return;
      var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      d.expenses.push({ id: id, t: Date.now(), date: date, amount: Math.round(amount * 100) / 100, cat: 'travel', note: note, src: 'trip' });
      owner[idKey] = id; finChanged = travelChanged = true;
    }
    tr.trips.forEach(function (t) {
      var name = t.name || t.dest || 'Trip', past = (t.end || t.start || today) < today;
      (t.items || []).forEach(function (it) {
        var label = it.title || ({ flight: 'Flight', train: 'Train', bus: 'Bus', boat: 'Boat', car: 'Car', hotel: 'Hotel', activity: 'Activity' }[it.type] || 'Booking');
        want(it, 'spendId', num(it.cost), past && /^\d{4}-\d{2}-\d{2}$/.test(it.date || '') ? it.date : today, (name + ': ' + label).slice(0, 80), 'noFin');
      });
      want(t, 'spentId', num(t.spent), past ? (t.start || today) : today, (name + ': other costs').slice(0, 80), 'noFinSpent');
    });
    if (!finChanged && !travelChanged) return;
    syncingTrips = true;
    try {
      if (finChanged) { window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
      if (travelChanged) Fl.saveTravel(tr);
    } finally { syncingTrips = false; }
  }

  /* ---------- workouts → the training habit ----------
     A logged workout ticks its habit that day (the one picked when logging, else your
     training/gym habit). Only adds ticks – ticking a day by hand still works as before. */
  function syncWorkouts() {
    if (!F.on('training')) return;
    var hb = null; try { hb = JSON.parse(localStorage.getItem('dash.habits')); } catch (e) {}
    if (!hb || !Array.isArray(hb.list) || !hb.list.length) return;
    var def = hb.list.filter(function (h) { return /train|trening|gym|workout|løp|run|exercise|økt/i.test(h.name); })[0];
    var ids = {}; hb.list.forEach(function (h) { ids[h.id] = 1; });
    hb.log = hb.log || {};
    var changed = false;
    F.list('training').forEach(function (w) {
      var hid = w.habit === '' ? null : (w.habit && ids[w.habit] ? w.habit : def && def.id);
      if (!hid || !/^\d{4}-\d{2}-\d{2}$/.test(w.date || '')) return;
      var day = hb.log[w.date] = hb.log[w.date] || [];
      if (day.indexOf(hid) < 0) { day.push(hid); changed = true; }
    });
    if (!changed) return;
    try { localStorage.setItem('dash.habits', JSON.stringify(hb)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));
    window.dispatchEvent(new Event('habits:change'));
    if (window.Dash && window.Dash.reload) window.Dash.reload();
  }

  function run() {
    try { syncWorkouts(); } catch (e) { console.error(e); }
    try { syncSubs(); } catch (e) { console.error(e); }
    try { syncSave(); } catch (e) { console.error(e); }
    try { syncLoans(); } catch (e) { console.error(e); }
    try { syncVary(); } catch (e) { console.error(e); }
    try { syncDates(); } catch (e) { console.error(e); }
    try { syncRates(); if (window.Policy && (window.Vault.get().accounts || []).some(function (a) { return a && a.float; })) window.Policy.update(function () { try { syncRates(); } catch (e) {} }); } catch (e) { console.error(e); }
    try { syncTrips(); } catch (e) { console.error(e); }
    try { syncBucket(); } catch (e) { console.error(e); }
  }
  window.Vault.onUnlock(function () { setTimeout(run, 0); });
  window.addEventListener('tools:change', function () { if (window.Vault.get()) { syncSubs(); syncWorkouts(); } });
  window.addEventListener('features:change', function () { if (window.Vault.get()) run(); });
  window.addEventListener('fin:change', function () { if (window.Vault.get()) { try { syncVary(); syncDates(); } catch (e) { console.error(e); } } });   /* e.g. a bank import found this month's power bill */
  window.addEventListener('travel:change', function () { if (window.Vault.get()) { syncTrips(); syncBucket(); } });
})();
