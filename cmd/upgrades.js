/* One place for data changes (Phase C step 9). When the shape of saved data changes, it gets a numbered step here
   instead of compatibility code spread around the app. The vault remembers the last step it has been through
   (data.dv), so each step runs once: right after unlocking (on the first device that has the new version – the
   result then syncs everywhere) and again after restoring an older backup.
   Rules for a step:
   · only ever add new steps at the end, with the next number; never change or remove an old one
   · a step must be safe to run on data that is already new (it can meet a mix after a sync)
   · it works on the vault data (d) and the synced device keys (get/set of 'dash.settings', 'dash.tools' …)
   · it never throws away something it doesn't understand
   Looks that come from the shared box (the person you share with, older apps) can still be old, so avatar.js
   keeps reading the old 'extra' when it draws – but what's saved here is upgraded. */
(function () {
  'use strict';
  function rj(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function wj(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function obj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  var STEPS = [
    { n: 1, what: "avatar: the old single 'extra' becomes hat / neck / watch / ears",
      run: function (d, get, set) {
        var s = get('dash.settings'); if (!obj(s) || !obj(s.avatar)) return false;
        var L = Object.assign({}, s.avatar), x = L.extra;
        if (!x || x === 'none') return false;
        if (x === 'cap' && (!L.hat || L.hat === 'none')) { L.hat = 'cap'; L.oldCap = 1; }   /* drawn exactly as before */
        if (x === 'lanyard' && (!L.neck || L.neck === 'none')) L.neck = 'lanyard';
        if (x === 'watch' && (!L.watch || L.watch === 'no')) L.watch = 'yes';
        if (x === 'earbuds' && (!L.ears || L.ears === 'none')) L.ears = 'buds';
        L.extra = 'none';
        s.avatar = L; set('dash.settings', s); return true;
      } }
  ];
  var LAST = STEPS[STEPS.length - 1].n;

  /* run(d): brings the vault data up to date. Returns the steps that changed something; d.dv is the last step passed. */
  function run(d, io) {
    if (!obj(d)) return [];
    var get = (io && io.get) || rj, set = (io && io.set) || wj;
    var from = +d.dv || 0, done = [];
    if (from >= LAST) return done;
    for (var i = 0; i < STEPS.length; i++) {
      var st = STEPS[i]; if (st.n <= from) continue;
      /* a step that fails stops here (the later ones wait), and is tried again next time */
      try { if (st.run(d, get, set)) done.push(st.n); }
      catch (e) { if (window.Diag && window.Diag.log) window.Diag.log('upgrade', 'Data step ' + st.n + ' failed: ' + (e && e.message), 'upgrades.js'); break; }
      d.dv = st.n;
    }
    if (done.length && window.Diag && window.Diag.log) window.Diag.log('upgrade', 'Data brought up to date: step ' + done.join(', '), 'upgrades.js', { raw: true });
    return done;
  }
  window.Upgrades = { run: run, last: LAST, steps: STEPS.map(function (s) { return { n: s.n, what: s.what }; }) };
})();
