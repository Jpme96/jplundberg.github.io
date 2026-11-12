/* Chores (House → Upkeep), Nov 2026: bins, bathroom, vacuuming … taking turns with the person you live with
   (who that is: Settings → Finances → Shared expenses, the partner – nobody is hard-coded). Each chore has a day
   and how often; whose turn it is changes by itself each time. Tick it off when it's done; At a glance tells you
   on the day when it's your turn.
   Data: dash.tools.chores [{id, name, every: 1w|2w|1m, day: 0–6 (Mon–Sun), who: rotate|me|them, start, room?}],
         dash.tools.rooms [{id, name, icon, size}] (rooms of the home – shared with the person you live with),
         dash.tools.choreDone { '<period>|<id>': 'me'|'them' }, dash.tools.chorecfg (Settings → House). */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in chores.page.js, loaded only on its own page. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var dkey = Fe.dkey;
  var fromKey = Fe.fromKey;
  function today() { return dkey(new Date()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function monday(k) { var d = fromKey(k); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dkey(d); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function on() { return Fe.on('house'); }
  function cfg() { var c = Fe.tools().chorecfg; return Object.assign({ brief: true, both: false }, c && typeof c === 'object' ? c : {}); }
  function partner() { var S = window.Shared; var p = S && S.partner ? S.partner() : null; return p && p.name ? p : null; }
  var USUAL = [['Take out the bins', '1w', 6, 'trash'], ['Clean the bathroom', '1w', 5, 'droplet'], ['Vacuum and mop', '1w', 5, 'stars'], ['Change the bed sheets', '2w', 6, 'moon'], ['Clean the kitchen properly', '2w', 4, 'cup-hot'], ['Water the plants', '1w', 2, 'flower1'], ['Clean the fridge', '1m', 6, 'snow2']];
  function icon(n) { var u = USUAL.filter(function (x) { return x[0] === n; })[0]; return u ? u[3] : /bin|søppel|trash/i.test(n) ? 'trash' : /bath|bad|toalett/i.test(n) ? 'droplet' : /vacuum|støvsug|mop/i.test(n) ? 'stars' : /laundry|vask|klær/i.test(n) ? 'basket' : 'check2-square'; }
  function period(c, k) {
    k = k || today(); var st = isKey(c.start) ? c.start : k;
    if (c.every === '1m') {
      var d = fromKey(k), first = new Date(d.getFullYear(), d.getMonth(), 1); first.setDate(1 + ((+c.day || 0) - (first.getDay() + 6) % 7 + 7) % 7);
      var n = (d.getFullYear() - fromKey(st).getFullYear()) * 12 + d.getMonth() - fromKey(st).getMonth();
      if (dkey(first) < st && n === 0) { var nx = new Date(d.getFullYear(), d.getMonth() + 1, 1); nx.setDate(1 + ((+c.day || 0) - (nx.getDay() + 6) % 7 + 7) % 7); return { key: dkey(nx).slice(0, 7), day: dkey(nx), n: 1 }; }
      return { key: k.slice(0, 7), day: dkey(first), n: n };
    }
    var w = Math.round((fromKey(monday(k)) - fromKey(monday(st))) / 6048e5), step = c.every === '2w' ? 2 : 1;
    var wn = Math.floor(w / step) * step, mon = fromKey(monday(st)); mon.setDate(mon.getDate() + wn * 7);
    var day = new Date(mon); day.setDate(mon.getDate() + (+c.day || 0));
    /* added after this time's day: the first time is the next one */
    if (dkey(day) < st) { mon.setDate(mon.getDate() + step * 7); day.setDate(day.getDate() + step * 7); return { key: dkey(mon), day: dkey(day), n: Math.floor(w / step) + 1 }; }
    return { key: dkey(mon), day: dkey(day), n: Math.floor(w / step) };
  }
  function turn(c, p) { if (c.who === 'me' || !partner()) return 'me'; if (c.who === 'them') return 'them'; return ((p.n % 2) + 2) % 2 === 0 ? 'me' : 'them'; }
  function done(c, p) { return (Fe.tools().choreDone || {})[p.key + '|' + c.id] || null; }
  function whoName(w) { var p = partner(); return w === 'me' ? 'You' : p ? p.name : 'Them'; }
  function logOf() { var l = Fe.tools().choreLog; return Array.isArray(l) ? l : []; }
  function addLog(t, c, k, who, at) {
    var l = Array.isArray(t.choreLog) ? t.choreLog : (t.choreLog = []);
    if (l.some(function (x) { return x.k === k; })) return;
    l.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), k: k, cid: c.id, name: c.name, who: who, at: at || today() });
    var cut = dkey(new Date(Date.now() - 366 * 864e5)); t.choreLog = l.filter(function (x) { return x.at >= cut; }).slice(-600);
  }
  function setDone(c, who) {
    var p = period(c), t = Fe.tools(), m = t.choreDone = Object.assign({}, t.choreDone || {}), k = p.key + '|' + c.id, was = m[k];
    if (was) { delete m[k]; t.choreLog = logOf().filter(function (x) { return x.k !== k; }); } else { m[k] = who || turn(c, p); addLog(t, c, k, m[k]); }
    Object.keys(m).forEach(function (x) { if (x.slice(0, 10) < dkey(new Date(Date.now() - 120 * 864e5))) delete m[x]; });
    Fe.saveTools(t);
    if (!was) toast('<i class="bi bi-check2"></i> ' + esc(c.name) + ' done', function () { var t2 = Fe.tools(); delete (t2.choreDone || {})[k]; Fe.saveTools(t2); });
  }
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!on() || !cfg().brief) return;
    var tk = today();
    Fe.list('chores').forEach(function (c) {
      var p = period(c), w = turn(c, p); if (done(c, p) || (w !== 'me' && !cfg().both) || p.day > tk) return;
      var late = p.day < tk;
      add(late ? 36 : 48, icon(c.name), w === 'me' ? '#22b35e' : '#3987e5', (w === 'me' ? 'Your turn: ' : whoName(w) + '’s turn: ') + c.name, late ? 'From ' + fromKey(p.day).toLocaleDateString('en-GB', { weekday: 'long' }) : 'Today', '/cmd/house/#hchores',
        { main: true, act: { id: 'ch:' + p.key + ':' + c.id, label: 'Done' }, run: function () { setDone(c, w); } });
    });
  });
  function setFill() {
    var box = document.getElementById('hlSet-house3'); if (!box || box.contains(document.activeElement)) return;
    if (!on()) { box.innerHTML = ''; return; }
    var c = cfg(), sw = function (f, l, s) { return '<label class="st-row"><span>' + esc(l) + '<small class="st-rsub">' + esc(s) + '</small></span><input type="checkbox" class="switch" data-chcfg="' + f + '"' + (c[f] ? ' checked' : '') + '></label>'; };
    box.innerHTML = '<p class="st-sub ap-sub"><i class="bi bi-arrow-repeat"></i> <span data-t="ui.chores">Chores</span></p><div class="st-group">' + sw('brief', I18N.k('ui.chores-in-at-a-glance', 'Chores in At a glance'), I18N.k('ui.on-the-day-its-your-turn-with-done', 'On the day it’s your turn, with Done')) + sw('both', I18N.k('ui.also-show-the-other-ones-turn', 'Also show the other one’s turn'), I18N.k('ui.handy-if-you-share-one-phone-or-remind-e', 'Handy if you share one phone or remind each other')) + '</div>';
  }
  document.addEventListener('change', function (e) { var i = e.target.closest('[data-chcfg]'); if (!i) return; var t = Fe.tools(); t.chorecfg = Object.assign({}, t.chorecfg || {}); t.chorecfg[i.dataset.chcfg] = i.checked; Fe.saveTools(t); toast('<i class="bi bi-check2"></i> Saved'); });
  window.addEventListener('st:page', function (e) { if (e.detail === 'house') setTimeout(setFill, 0); });
  window.Chores = { period: period, turn: turn, done: done, addLog: addLog, log: logOf, setDone: setDone, whoName: whoName, icon: icon };
  (window.__core = window.__core || {})["chores"] = { setFill: setFill, esc: esc, cfg: cfg, Fe: Fe, on: on, toast: toast, fromKey: fromKey, whoName: whoName, partner: partner, icon: icon, USUAL: USUAL, done: done, turn: turn, period: period, monday: monday, dkey: dkey, isKey: isKey, today: today, setDone: setDone, addLog: addLog, logOf: logOf };
})();
