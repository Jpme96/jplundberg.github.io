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
      } },
    { n: 2, what: 'step 7: the off switches for the shared home, saving in pieces and instant page changes are gone',
      run: function (d, get, set) {
        var ch = false;
        if (obj(d.share) && d.share.direct) { delete d.share.direct; ch = true; }   /* every shared part is read straight from the box now */
        var s = get('dash.settings'); if (obj(s) && 'softNav' in s) { delete s.softNav; set('dash.settings', s); ch = true; }
        try { if (localStorage.getItem('dash.vp.off') != null) { localStorage.removeItem('dash.vp.off'); ch = true; } } catch (e) {}
        return ch;
      } },
    { n: 3, what: 'F0: the avatar settings and choices JP took out are removed from saved looks (yours and your people\'s)',
      run: function (d, get, set) {
        var A = window.Avatar; if (!A || !A.trimLook) throw new Error('avatar code not loaded yet');   /* tried again next time */
        var ch = false, same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
        var s = get('dash.settings'); if (obj(s) && obj(s.avatar)) { var t = A.trimLook(s.avatar); if (!same(t, s.avatar)) { s.avatar = t; set('dash.settings', s); ch = true; } }
        var tl = get('dash.tools'); if (obj(tl) && Array.isArray(tl.people)) { var pc = false;
          tl.people.forEach(function (p) { if (obj(p) && obj(p.look)) { var t2 = A.trimLook(p.look); if (!same(t2, p.look)) { p.look = t2; pc = true; } } });
          if (pc) { set('dash.tools', tl); ch = true; } }
        return ch;
      } },
    { n: 4, what: 'FDV after NS 3451 and NS 3424: each finding and phrase gets a building part code from its old part; the old name stays as the place where there is no clear code',
      run: function (d, get, set) {
        /* the old parts (English, or Norwegian when they were picked in Norwegian) → NS 3451; parts with no single code keep their name as the place */
        var MAP = { 'roof': ['26', ''], 'tak': ['26', ''], 'facade': ['23', ''], 'fasade': ['23', ''], 'windows and doors': ['23', 'Windows and doors'], 'vinduer og dører': ['23', 'Vinduer og dører'],
          'electrical': ['4', ''], 'elektro': ['4', ''], 'plumbing (vvs)': ['31', ''], 'vvs': ['31', ''], 'ventilation': ['36', ''], 'ventilasjon': ['36', ''], 'heating': ['32', ''], 'oppvarming': ['32', ''],
          'structure': ['22', ''], 'konstruksjon': ['22', ''], 'outdoor areas': ['7', ''], 'utomhus': ['7', ''], 'other': ['', ''], 'annet': ['', ''] };
        var tl = get('dash.tools'); if (!obj(tl)) return false;
        var ch = false;
        function move(x) { if (!obj(x) || 'code' in x) return; var p0 = String(x.part || ''), m = MAP[p0.trim().toLowerCase()];
          var lead = p0.match(/^(\d{1,4})\s+(.*)$/);   /* a part that already started with a code (your own parts) */
          if (m) { x.code = m[0]; x.part = m[1]; } else if (lead) { x.code = lead[1]; x.part = lead[2]; } else { x.code = ''; }
          if (p0) x.oldPart = p0; ch = true; }
        (Array.isArray(tl.fdv) ? tl.fdv : []).forEach(function (r) { if (obj(r)) (Array.isArray(r.findings) ? r.findings : []).forEach(move); });
        (Array.isArray(tl.fdvph) ? tl.fdvph : []).forEach(function (q) { if (!obj(q) || 'code' in q) return; move(q); q.place = q.part || ''; delete q.part; });
        /* your own building parts: the ones that start with a code become your own codes; the rest stay as places */
        if (Array.isArray(tl.fdvparts) && !Array.isArray(tl.fdvcodes)) { var own = [], keep = [];
          tl.fdvparts.forEach(function (v) { var m2 = String(v || '').match(/^(\d{3,4})\s+(.*)$/); if (m2) own.push({ c: m2[1], n: m2[2] }); else keep.push(v); });
          if (own.length) { tl.fdvcodes = own; tl.fdvparts = keep; ch = true; } }
        if (ch) set('dash.tools', tl);
        return ch;
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
