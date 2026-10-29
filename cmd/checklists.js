/* Checklists: ready-made sets of repeating tasks you can switch on and off
   (Settings → Dashboard → Checklists). They are ordinary to-dos with a day and a repeat –
   so they show in To-do, the calendar, At a glance, the weekly check-in and notifications.
   Switching a list off removes its open tasks again (with Undo). */
(function () {
  "use strict";
  if (!window.Vault) return;
  var $ = function (id) { return document.getElementById(id); };
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nb() { return ((readJSON('dash.settings', {}) || {}).lang) === 'nb'; }

  /* first day: in n days, or the next given month/day */
  function inDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return dkey(d); }
  function nextDate(m, day) { var t = new Date(), d = new Date(t.getFullYear(), m - 1, day); if (d < new Date(t.getFullYear(), t.getMonth(), t.getDate())) d.setFullYear(d.getFullYear() + 1); return dkey(d); }
  var LISTS = {
    home: { icon: 'house-gear', name: 'Home maintenance', nameNb: 'Vedlikehold hjemme', desc: 'FDVU for your own home – smoke alarms, filters, drains, the boring things that save money', descNb: 'FDVU for ditt eget hjem – røykvarslere, filtre, sluk og det andre som sparer penger',
      tasks: function () { return [
        ['Test smoke alarms', 'Teste røykvarslerne', 'monthly', inDays(2)],
        ['Change smoke alarm batteries', 'Bytte batteri i røykvarslerne', 'yearly', nextDate(12, 1)],
        ['Check fire extinguisher and fire blanket', 'Sjekke brannslukker og brannteppe', 'yearly', nextDate(12, 1)],
        ['Clean the kitchen hood filter', 'Rengjøre filteret i kjøkkenviften', 'quarterly', inDays(9)],
        ['Change or clean ventilation filters', 'Bytte eller rengjøre ventilasjonsfiltre', 'quarterly', inDays(16)],
        ['Clean bathroom drains', 'Rense sluk på badet', 'quarterly', inDays(23)],
        ['Check under the sink and dishwasher for leaks', 'Sjekke under vasken og oppvaskmaskinen for lekkasjer', 'quarterly', inDays(30)],
        ['Hot cleaning cycle in the washing machine', 'Rengjøringsprogram på vaskemaskinen', 'monthly', inDays(12)],
        ['Clean the fridge, check the freezer', 'Vaske kjøleskapet, sjekke fryseren', 'quarterly', inDays(37)],
        ['Bleed the radiators', 'Lufte radiatorene', 'yearly', nextDate(10, 15)],
        ['Wash the windows', 'Vaske vinduene', 'yearly', nextDate(5, 1)],
        ['Update the contents list for the home insurance', 'Oppdatere innboliste for forsikringen', 'yearly', nextDate(1, 15)]
      ]; } }
  };

  function has(id) { return readJSON('dash.todos', []).some(function (t) { return t.list === id && !t.done; }); }
  function add(id) {
    var L = LISTS[id], todos = readJSON('dash.todos', []), no = nb();
    L.tasks().forEach(function (x) {
      var text = no ? x[1] : x[0];
      if (todos.some(function (t) { return t.list === id && (t.text === x[0] || t.text === x[1]); })) return;
      todos.push({ id: uid(), text: text, done: false, due: x[3], repeat: x[2], list: id });
    });
    writeJSON('dash.todos', todos);
    changed();
    if (window.Quick) window.Quick.toast('<i class="bi bi-' + L.icon + '"></i> ' + (no ? L.nameNb : L.name) + ' added – ' + L.tasks().length + ' repeating tasks');
  }
  function remove(id) {
    var before = readJSON('dash.todos', []), L = LISTS[id];
    writeJSON('dash.todos', before.filter(function (t) { return t.list !== id; }));
    changed();
    if (window.Quick) window.Quick.toast('<i class="bi bi-' + L.icon + '"></i> ' + (nb() ? L.nameNb : L.name) + ' removed', function () { writeJSON('dash.todos', before); changed(); });
  }
  function changed() {
    window.dispatchEvent(new Event('todos:change'));
    if (window.Dash && window.Dash.reload) window.Dash.reload();
    fill();
  }
  function fill() {
    var box = $('stLists'); if (!box) return;
    var no = nb();
    box.innerHTML = Object.keys(LISTS).map(function (id) {
      var L = LISTS[id], n = readJSON('dash.todos', []).filter(function (t) { return t.list === id; }).length;
      return '<label class="st-row"><span class="st-ico" style="--c:#c98500"><i class="bi bi-' + L.icon + '"></i></span><span class="st-label">' + (no ? L.nameNb : L.name) +
        '<small>' + (n ? n + (no ? ' oppgaver i Gjøremål' : ' tasks in your To-do') : (no ? L.descNb : L.desc)) + '</small></span><input type="checkbox" class="switch" data-list="' + id + '"' + (n ? ' checked' : '') + '></label>';
    }).join('');
  }
  document.addEventListener('change', function (e) {
    var c = e.target.closest('[data-list]'); if (!c) return;
    if (c.checked) add(c.dataset.list); else remove(c.dataset.list);
  });
  /* checklist tasks follow the dashboard's language (only the ones still in their original words) */
  function relang() {
    var todos = readJSON('dash.todos', []), no = nb(), ch = false;
    Object.keys(LISTS).forEach(function (id) {
      LISTS[id].tasks().forEach(function (x) {
        todos.forEach(function (t) { if (t.list === id && t.text === (no ? x[0] : x[1])) { t.text = no ? x[1] : x[0]; ch = true; } });
      });
    });
    if (ch) { writeJSON('dash.todos', todos); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
  }
  window.Vault.onUnlock(function () { setTimeout(function () { relang(); fill(); }, 0); });
  window.addEventListener('todos:change', function () { setTimeout(fill, 0); });
  window.Checklists = { LISTS: LISTS, has: has, add: add, remove: remove };
})();
