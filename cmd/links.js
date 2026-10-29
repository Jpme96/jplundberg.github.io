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
      return { id: 'save-' + g.id, name: 'Savings: ' + (g.name || 'goal'), amount: B.saveMonthly(g), day: null, src: 'save' };
    }).filter(function (f) { return f.amount > 0; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'save'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = fixed.filter(function (f) { return f.src !== 'save'; }).concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }
  window.Links = { syncSave: syncSave };

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
    try { syncTrips(); } catch (e) { console.error(e); }
    try { syncBucket(); } catch (e) { console.error(e); }
  }
  window.Vault.onUnlock(function () { setTimeout(run, 0); });
  window.addEventListener('tools:change', function () { if (window.Vault.get()) { syncSubs(); syncWorkouts(); } });
  window.addEventListener('features:change', function () { if (window.Vault.get()) run(); });
  window.addEventListener('travel:change', function () { if (window.Vault.get()) { syncTrips(); syncBucket(); } });
})();
