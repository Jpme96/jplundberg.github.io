/* Admin → System → Clean up (Nov 2026): finds what has piled up and can go – the same spending twice, to-dos
   done long ago, empty notes, old calendar events, meter readings twice on one day, things with no name,
   goals and wishes that were finished long ago – and clears each kind in one tap, with Undo.
   Nothing is removed without a tap. admin.js draws the card (AdminClean.card) in the System tab. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rj(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function wj(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  var dkey = Fe.dkey;
  function ago(n) { var d = new Date(); d.setDate(d.getDate() - n); return dkey(d); }
  function clone(x) { return JSON.parse(JSON.stringify(x == null ? null : x)); }
  var LISTS = ['wishes', 'wbuy', 'wbought', 'hmaint', 'hinv', 'hproj', 'hpros', 'people', 'papers', 'recipes', 'subs', 'hdocs'];
  /* a row with nothing in it: no text at all besides its id (older rows may keep their name under another field) */
  function empty(x) { return !x || typeof x !== 'object' || !Object.keys(x).some(function (k) { return k !== 'id' && typeof x[k] === 'string' && x[k].trim(); }); }

  /* each check: what it finds (n), and how to clear it – in the vault, dash.tools or localStorage */
  function checks() {
    var d = window.Vault.get() || {}, t = Fe.tools(), out = [];
    /* the same spending twice: same day, amount and text (not merged bank + typed – that's fin-moves) */
    var seen = {}, dup = [];
    /* only real copies: a bank row imported twice (same reference), or the same entry saved twice (same moment) –
       two coffees for the same price on the same day are left alone */
    (d.expenses || []).forEach(function (e) { if (!e || !e.date) return; var k = e.ref ? 'r|' + e.ref + '|' + e.date + '|' + (+e.amount || 0) : e.t ? 't|' + e.t + '|' + (+e.amount || 0) + '|' + String(e.note || '') : null; if (!k) return; if (seen[k]) dup.push(e.id); else seen[k] = 1; });
    out.push({ id: 'dupexp', icon: 'files', c: '#e66767', t: 'The same spending twice', s: 'A bank row imported twice, or saved twice – one of each is kept', n: dup.length, where: 'vault',
      run: function (dd) { var ids = {}; dup.forEach(function (i) { ids[i] = 1; }); dd.expenses = (dd.expenses || []).filter(function (e) { return !ids[e.id]; }); } });
    var todos = rj('dash.todos', []) || [], oldT = todos.filter(function (x) { return x.done && (!x.doneAt || x.doneAt < ago(60)); });
    out.push({ id: 'todos', icon: 'check2-square', c: '#22b35e', t: 'To-dos done over 2 months ago', s: 'Done is done', n: oldT.length, where: 'local', key: 'dash.todos',
      run: function (l) { return (l || []).filter(function (x) { return !(x.done && (!x.doneAt || x.doneAt < ago(60))); }); } });
    var notes = rj('dash.notes', []) || [];
    out.push({ id: 'notes', icon: 'sticky', c: '#c98500', t: 'Empty notes', s: '', n: notes.filter(function (x) { return !String(x.text || '').trim(); }).length, where: 'local', key: 'dash.notes',
      run: function (l) { return (l || []).filter(function (x) { return String(x.text || '').trim(); }); } });
    var cal = rj('dash.calendar', {}) || {}, oldE = (cal.events || []).filter(function (e) { return e.date && e.date < ago(730) && !e.repeat && !e.rrule; });
    out.push({ id: 'cal', icon: 'calendar-x', c: '#3987e5', t: 'Calendar events over 2 years old', s: 'One-off events only – repeating ones stay', n: oldE.length, where: 'local', key: 'dash.calendar',
      run: function (c) { c = c || {}; c.events = (c.events || []).filter(function (e) { return !(e.date && e.date < ago(730) && !e.repeat && !e.rrule); }); return c; } });
    var md = {}, mdup = [];
    (t.hmeter || []).forEach(function (m) { if (!m || !m.date) return; if (md[m.date]) mdup.push(m.id); else md[m.date] = 1; });
    out.push({ id: 'meter', icon: 'speedometer2', c: '#c98500', t: 'Two meter readings on one day', s: 'The first one is kept', n: mdup.length, where: 'tools', run: function (tt) { var ids = {}; mdup.forEach(function (i) { ids[i] = 1; }); tt.hmeter = (tt.hmeter || []).filter(function (m) { return !ids[m.id]; }); } });
    var blank = 0; LISTS.forEach(function (k) { (Array.isArray(t[k]) ? t[k] : []).forEach(function (x) { if (empty(x)) blank++; }); });
    out.push({ id: 'blank', icon: 'question-square', c: '#7a8794', t: 'Things with no name', s: 'Empty rows in wishes, upkeep, inventory, people …', n: blank, where: 'tools',
      run: function (tt) { LISTS.forEach(function (k) { if (Array.isArray(tt[k])) tt[k] = tt[k].filter(function (x) { return !empty(x); }); }); } });
    var goals = rj('dash.goals', []) || [], oldG = goals.filter(function (g) { return g.arch && g.done && g.done < ago(365); });
    out.push({ id: 'goals', icon: 'trophy', c: '#3987e5', t: 'Goals reached over a year ago', s: 'From Done on the Goals page', n: oldG.length, where: 'local', key: 'dash.goals',
      run: function (l) { return (l || []).filter(function (g) { return !(g.arch && g.done && g.done < ago(365)); }); } });
    var oldW = (t.wbought || []).filter(function (x) { return x.bought && x.bought < ago(730); });
    out.push({ id: 'wbought', icon: 'bag-check', c: '#8a6fdf', t: 'Wishes bought over 2 years ago', s: 'They stay in Home inventory and Finances', n: oldW.length, where: 'tools', run: function (tt) { tt.wbought = (tt.wbought || []).filter(function (x) { return !(x.bought && x.bought < ago(730)); }); } });
    var mem = Object.keys(d.catMemory || {}).length;
    out.push({ id: 'mem', icon: 'tags', c: '#11a597', t: 'Learned categories', s: 'Keeps the newest 300', n: Math.max(0, mem - 300), where: 'vault', run: function (dd) { var k = Object.keys(dd.catMemory || {}); k.slice(0, Math.max(0, k.length - 300)).forEach(function (x) { delete dd.catMemory[x]; }); } });
    return out;
  }
  function card(fn) {
    var l; try { l = checks(); } catch (e) { return ''; }
    var todo = l.filter(function (x) { return x.n > 0; });
    return fn('clean', 'stars', 'Clean up', todo.length > 1 ? '<button type="button" class="text-btn" data-cleanall data-t="ui.clean-all">Clean all</button>' : '',
      todo.length ? '<ul class="cl-list">' + todo.map(function (x) { return '<li><span class="kit-ic" style="--c:' + x.c + '"><i class="bi bi-' + x.icon + '"></i></span><span><b>' + esc(x.t) + ' · ' + x.n + '</b>' + (x.s ? '<small>' + esc(x.s) + '</small>' : '') + '</span><button type="button" class="text-btn" data-clean="' + x.id + '">Clean</button></li>'; }).join('') + '</ul>'
        : '<p class="muted cl-ok"><i class="bi bi-check2-circle"></i> Nothing has piled up – no duplicates, old done things or empty rows.</p>');
  }
  function run(ids) {
    var l = checks().filter(function (x) { return ids.indexOf(x.id) > -1 && x.n > 0; }); if (!l.length) return;
    var snap = { vault: clone(window.Vault.get()), tools: clone(Fe.tools()), local: {} }, n = 0, vch = false, tch = false, tt = Fe.tools(), dd = window.Vault.get();
    l.forEach(function (x) {
      n += x.n;
      if (x.where === 'vault' && dd) { x.run(dd); vch = true; }
      else if (x.where === 'tools') { x.run(tt); tch = true; }
      else if (x.where === 'local') { if (!(x.key in snap.local)) snap.local[x.key] = localStorage.getItem(x.key); wj(x.key, x.run(rj(x.key, null))); }
    });
    if (vch) { window.Vault.save(dd); window.dispatchEvent(new Event('fin:change')); }
    if (tch) Fe.saveTools(tt);
    window.dispatchEvent(new Event('clean:done'));
    toast('<i class="bi bi-stars"></i> Cleaned ' + n + (n === 1 ? ' thing' : ' things'), function () {
      if (vch && snap.vault) { window.Vault.save(snap.vault); window.dispatchEvent(new Event('fin:change')); }
      if (tch) Fe.saveTools(snap.tools);
      Object.keys(snap.local).forEach(function (k) { try { if (snap.local[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, snap.local[k]); } catch (e) {} });
      window.dispatchEvent(new Event('dash:local')); window.dispatchEvent(new Event('clean:done'));
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-clean]'); if (b) { run([b.dataset.clean]); return; }
    if (e.target.closest('[data-cleanall]')) run(checks().map(function (x) { return x.id; }));
  });
  window.AdminClean = { card: card, checks: checks, run: run };
})();
