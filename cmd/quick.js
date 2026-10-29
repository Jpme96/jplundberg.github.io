/* Quick add: one "+" on every page. Type a line – "149 rema", "tor 14 tannlege", "løp 5 km" –
   and it works out what it is (smart.js), or use the forms below for an expense, event, workout,
   task or note. Press "+" on a keyboard to open it.
   Links can fill it in too, for Siri, Shortcuts and Back Tap:
     /cmd/?add=149 rema            → the line, ready to confirm
     /cmd/?add=expense&kr=149&note=Rema&cat=groceries */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var Fe = window.Features;
  var on = function (k, d) { return Fe ? Fe.on(k) : d; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function num(v) {
    var s = String(v || '').replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.')); return isFinite(n) ? n : NaN;
  }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  var SPEND = [['groceries', 'Groceries'], ['eating', 'Eating out'], ['transport', 'Transport'], ['shopping', 'Shopping'], ['fun', 'Fun'], ['health', 'Health'], ['travel', 'Travel'], ['other', 'Other']];
  var SPORTS = [['strength', 'Strength'], ['run', 'Running'], ['walk', 'Walking'], ['bike', 'Cycling'], ['swim', 'Swimming'], ['ball', 'Ball sports'], ['yoga', 'Yoga / mobility'], ['other', 'Other']];

  /* ---------- the button ---------- */
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'qa-btn'; btn.id = 'quickAdd'; btn.setAttribute('aria-label', 'Add (expense, event, workout, task or note)');
  btn.innerHTML = '<i class="bi bi-plus-lg"></i>';
  var host = document.querySelector('.top-actions') || document.querySelector('#fp > .fp-top');
  if (host) host.insertBefore(btn, host.querySelector('[data-search]') || host.querySelector('[data-me]') || null); else document.body.appendChild(btn);

  /* ---------- the sheet ---------- */
  var bg = document.createElement('div');
  bg.className = 'qa-bg'; bg.id = 'quickSheet'; bg.hidden = true;
  bg.innerHTML = '<div class="qa-box" role="dialog" aria-modal="true" aria-label="Add"><div class="qa-handle"></div>' +
    '<form class="qa-smart" id="qaSmart" autocomplete="off"><i class="bi bi-stars" aria-hidden="true"></i>' +
      '<input id="qaLine" enterkeyhint="done" placeholder="Type it: 149 rema · tor 14 tannlege · løp 5 km" aria-label="Type what to add" spellcheck="false">' +
      '<button type="button" class="qa-clear" id="qaClear" aria-label="Clear" hidden><i class="bi bi-x-circle-fill"></i></button></form>' +
    '<div class="qa-prev" id="qaPrev" hidden></div>' +
    '<div class="qa-manual"><div class="qa-tabs" role="tablist" id="qaTabs"></div><div class="qa-body" id="qaBody"></div></div></div>';
  document.body.appendChild(bg);
  var kind = 'expense';
  try { kind = localStorage.getItem('dash.quickKind') || 'expense'; } catch (e) {}

  function kinds() {
    var k = [];
    if (on('finance', true)) k.push(['expense', 'receipt', 'Expense']);
    if (on('calendar', true)) k.push(['event', 'calendar-plus', 'Event']);
    if (on('training', false)) k.push(['workout', 'heart-pulse', 'Workout']);
    k.push(['todo', 'check2-square', 'Task']);
    k.push(['note', 'journal-text', 'Note']);
    return k;
  }
  /* open(kind, prefill, line): a tab (and its fields filled in), or a typed line */
  function open(k, pre, line) {
    if (!window.Vault || !window.Vault.get()) return;          // locked
    var ks = kinds();
    if (k && ks.some(function (x) { return x[0] === k; })) kind = k;
    if (!ks.some(function (x) { return x[0] === kind; })) kind = ks[0][0];
    $('qaTabs').innerHTML = ks.map(function (x) {
      return '<button type="button" role="tab" data-tab="' + x[0] + '" aria-selected="' + (x[0] === kind) + '"><i class="bi bi-' + x[1] + '"></i><span>' + x[2] + '</span></button>';
    }).join('');
    $('qaBody').innerHTML = FORMS[kind](pre || {});
    var wasOpen = !bg.hidden && bg.classList.contains('open');
    $('qaLine').value = line || ''; preview();
    bg.hidden = false; document.body.classList.add('qa-open');
    requestAnimationFrame(function () {
      bg.classList.add('open');
      if (!matchMedia('(hover: hover)').matches || wasOpen && !pre) return;  // phones: no keyboard until you tap
      var f = pre ? $('qaBody').querySelector('button[type=submit]') : $('qaLine');
      if (f) f.focus();
    });
    try { localStorage.setItem('dash.quickKind', kind); } catch (e) {}
  }

  /* ---------- the typed line ---------- */
  var parsed = null;
  function memory() { var d = window.Vault.get() || {}; return d.catMemory || {}; }
  function allowed(p) { return p && kinds().some(function (x) { return x[0] === p.kind; }); }
  function preview() {
    var v = $('qaLine').value.trim(), box = $('qaPrev'), S = window.Smart;
    $('qaClear').hidden = !v;
    parsed = v && S ? S.parse(v, { memory: memory() }) : null;
    var off = parsed && !allowed(parsed) ? parsed.kind : null;
    if (off) parsed = null;
    bg.classList.toggle('qa-typing', !!v);
    if (!v) { box.hidden = true; box.innerHTML = ''; return; }
    var d = S && S.describe(parsed);
    box.hidden = false;
    box.innerHTML = d ? '<div class="qa-guess"><span class="qa-gi"><i class="bi bi-' + d.icon + '"></i></span><span class="qa-gx"><small>' + esc(d.label) + '</small><b>' + d.bits.map(esc).join(' · ') + '</b></span></div>' +
      '<div class="qa-acts"><button type="button" class="text-btn" data-qaedit>Edit</button><span class="spacer"></span><button type="button" class="pill-btn wide" data-addline><i class="bi bi-plus-lg"></i> Add ' + esc(d.label.toLowerCase()) + '</button></div>'
      : off ? '<p class="muted qa-hint">' + ({ workout: 'Logging workouts needs the Training log – switch it on in Settings → Features.', expense: 'Expenses need Finances – switch it on in Settings → Features.', event: 'Events need the Calendar – switch it on in Settings → Features.' }[off] || 'That part is switched off.') + '</p>'
      : '<p class="muted qa-hint">Didn’t get that – try “149 rema”, “fre 18 middag”, “løp 5 km” or “kjøp melk i morgen”.</p>';
  }
  function addLine() {
    if (!parsed) return false;
    var p = parsed, ok = ADD[p.kind](p);
    if (ok) { $('qaLine').value = ''; preview(); }
    return ok;
  }
  /* "Edit": the matching form, filled in */
  function editLine() {
    if (!parsed) return;
    var p = parsed, pre = {};
    if (p.kind === 'expense') pre = { a: p.amount, c: p.cat, n: p.note, d: p.date };
    else if (p.kind === 'event') pre = { t: p.title, d: p.date, s: p.start, all: p.allDay, l: p.location };
    else if (p.kind === 'workout') pre = { k: p.sport, m: p.min, km: p.km, d: p.date };
    else if (p.kind === 'todo') pre = { t: p.text, due: p.due };
    else if (p.kind === 'note') pre = { t: p.text };
    open(p.kind, pre, '');
  }
  function close() {
    bg.classList.remove('open'); document.body.classList.remove('qa-open');
    setTimeout(function () { if (!bg.classList.contains('open')) bg.hidden = true; }, 320);
  }
  /* toast(html, undo): a short note at the bottom; with undo, an Undo button for a few seconds */
  function toast(html, undo) {
    var t = $('qaToast');
    if (!t) {
      t = document.createElement('div'); t.id = 'qaToast'; t.className = 'qa-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t);
      t.addEventListener('click', function (e) {
        if (!e.target.closest('[data-undo]') || !t._undo) return;
        var u = t._undo; t._undo = null; u(); t.classList.remove('show'); setTimeout(reload, 0);
      });
    }
    t._undo = undo || null;
    t.innerHTML = '<span>' + html + '</span>' + (undo ? '<button type="button" class="qa-undo" data-undo>Undo</button>' : '');
    t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); t._undo = null; }, undo ? 5000 : 2600);
  }

  /* recent expenses as one-tap chips (the same note, category and amount) */
  function recentChips() {
    var d = window.Vault.get() || {}, seen = {}, out = [];
    (d.expenses || []).slice().sort(function (a, b) { return (b.t || 0) - (a.t || 0); }).forEach(function (e) {
      var k = (e.note || '').toLowerCase() + '|' + e.cat + '|' + e.amount;
      if (seen[k] || out.length >= 6 || !e.note || e.src) return;
      seen[k] = 1; out.push(e);
    });
    return out;
  }
  var FORMS = {
    expense: function (p) {
      var chips = p.a ? [] : recentChips();
      return '<form class="qa-form" data-kind="expense">' +
        '<div class="qa-row"><input name="a" class="qa-amt" placeholder="Amount, kr" inputmode="decimal" autocomplete="off" required value="' + esc(p.a ? (p.a % 1 ? (+p.a).toFixed(2) : String(p.a)).replace('.', ',') : '') + '">' +
          '<select name="c" aria-label="Category">' + SPEND.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === p.c ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="qa-row"><input name="n" placeholder="What was it? (optional)" autocomplete="off" value="' + esc(p.n || '') + '"><input name="d" type="date" value="' + esc(p.d || today()) + '" aria-label="Date"></div>' +
        (chips.length ? '<div class="qa-chips">' + chips.map(function (e) {
          return '<button type="button" data-chip data-a="' + esc(e.amount) + '" data-c="' + esc(e.cat) + '" data-n="' + esc(e.note) + '">' + esc(e.note) + ' <b>' + esc(nf.format(e.amount)) + '</b></button>';
        }).join('') + '</div>' : '') +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Log expense</button></div></form>';
    },
    event: function (p) {
      var cats = window.Cal ? window.Cal.CAT_ORDER.map(function (id) { return [id, window.Cal.CATS[id].name]; }) :
        (function () { var c = readJSON('dash.calendar', {}).cats; return Array.isArray(c) && c.length ? c.map(function (x) { return [x.id, x.name]; }) : [['personal', 'Personal'], ['work', 'Work'], ['study', 'Study'], ['training', 'Training'], ['social', 'Social']]; })();
      var last = ''; try { last = localStorage.getItem('dash.calLastCat') || ''; } catch (e) {}
      var n = new Date(), hh = p.s || pad(Math.min(23, n.getHours() + 1)) + ':00';
      return '<form class="qa-form" data-kind="event">' +
        '<input name="t" placeholder="What? e.g. Dentist" autocomplete="off" required value="' + esc(p.t || '') + '">' +
        '<div class="qa-row"><input name="d" type="date" value="' + esc(p.d || today()) + '" aria-label="Date"><input name="s" type="time" value="' + esc(hh) + '" aria-label="Start"' + (p.all ? ' disabled' : '') + '><label class="qa-check"><input type="checkbox" name="all"' + (p.all ? ' checked' : '') + '> All day</label></div>' +
        '<div class="qa-row"><select name="c" aria-label="Category">' + cats.map(function (c) { return '<option value="' + esc(c[0]) + '"' + (c[0] === last ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select>' +
          '<input name="l" placeholder="Where (optional)" autocomplete="off" value="' + esc(p.l || '') + '"></div>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Add event</button></div></form>';
    },
    workout: function (p) {
      return '<form class="qa-form" data-kind="workout">' +
        '<div class="qa-row"><select name="k" aria-label="Type">' + SPORTS.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === p.k ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' +
          '<input name="m" placeholder="Minutes" inputmode="numeric" value="' + esc(p.m || 60) + '" aria-label="Minutes" required></div>' +
        '<div class="qa-row"><input name="km" placeholder="km (optional)" inputmode="decimal" aria-label="Distance" value="' + esc(p.km ? String(p.km).replace('.', ',') : '') + '"><input name="d" type="date" value="' + esc(p.d || today()) + '" aria-label="Date"></div>' +
        '<div class="qa-effort" role="radiogroup" aria-label="How hard">' + [['1', 'Easy'], ['2', 'Light'], ['3', 'Moderate'], ['4', 'Hard'], ['5', 'All out']].map(function (e) {
          return '<label><input type="radio" name="e" value="' + e[0] + '"' + (e[0] === '3' ? ' checked' : '') + '><span>' + e[1] + '</span></label>';
        }).join('') + '</div>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Log workout</button></div></form>';
    },
    todo: function (p) {
      return '<form class="qa-form" data-kind="todo"><input name="t" placeholder="Something to do…" autocomplete="off" required value="' + esc(p.t || '') + '">' +
        '<div class="qa-row"><label class="qa-lbl" for="qaDue">Due</label><input id="qaDue" name="due" type="date" value="' + esc(p.due || '') + '" aria-label="Due date (optional)"></div>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Add task</button></div></form>';
    },
    note: function (p) {
      return '<form class="qa-form" data-kind="note"><textarea name="t" rows="3" placeholder="Write something…" required>' + esc(p.t || '') + '</textarea>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Save note</button></div></form>';
    }
  };

  /* ---------- saving: straight into the same places the pages use ---------- */
  function reload() { if (window.Dash && window.Dash.reload) window.Dash.reload(); }
  /* ADD: the data, from the typed line or a form – straight into the same places the pages use */
  var ADD = {
    expense: function (p) {
      var a = +p.amount; if (!(a > 0)) return false;
      var d = window.Vault.get(); d.expenses = d.expenses || [];
      var e = { id: uid(), t: Date.now(), date: p.date || today(), amount: a, cat: p.cat || 'other', note: String(p.note || '').trim().slice(0, 80) };
      d.expenses.push(e);
      if (e.note && window.Smart) { d.catMemory = d.catMemory || {}; d.catMemory[window.Smart.norm(e.note)] = e.cat; }
      window.Vault.save(d);
      window.dispatchEvent(new Event('fin:change'));
      toast('<i class="bi bi-check-lg"></i> ' + esc(nf.format(a)) + (e.note ? ' · ' + esc(e.note) : '') + ' logged', function () {
        var x = window.Vault.get(); x.expenses = (x.expenses || []).filter(function (y) { return y.id !== e.id; }); window.Vault.save(x); window.dispatchEvent(new Event('fin:change'));
      });
      return true;
    },
    event: function (p) {
      var t = String(p.title || '').trim(); if (!t) return false;
      var date = /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : today(), all = !!p.allDay || !p.start;
      var cat = p.cat;
      if (!cat) { try { cat = localStorage.getItem('dash.calLastCat') || ''; } catch (e) {} }
      if (window.Cal && !window.Cal.CATS[cat]) cat = window.Cal.CAT_ORDER[0];
      var ev = { id: uid(), title: t.slice(0, 120), cat: cat || 'personal', date: date, allDay: all, location: String(p.location || '').trim().slice(0, 160), notes: '' };
      if (!all) { var s = /^\d{2}:\d{2}$/.test(p.start) ? p.start : '09:00'; ev.start = s; var m = +s.slice(0, 2) * 60 + +s.slice(3) + 60; ev.stop = pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); }
      function store(fn) {
        if (window.Cal) { var cd = window.Cal.load(); fn(cd); window.Cal.save(cd); }
        else { var raw = readJSON('dash.calendar', {}); raw.events = Array.isArray(raw.events) ? raw.events : []; raw.hidden = raw.hidden || {}; fn(raw); writeJSON('dash.calendar', raw); window.dispatchEvent(new Event('cal:change')); }
      }
      store(function (cd) { cd.events.push(ev); if (cd.hidden && cd.hidden[ev.cat]) delete cd.hidden[ev.cat]; });
      try { localStorage.setItem('dash.calLastCat', ev.cat); } catch (e) {}
      toast('<i class="bi bi-check-lg"></i> ' + esc(t) + ' added ' + (window.Smart ? window.Smart.when(date) : date) + (ev.start ? ' ' + ev.start : ''), function () {
        store(function (cd) { cd.events = cd.events.filter(function (x) { return x.id !== ev.id; }); });
      });
      return true;
    },
    workout: function (p) {
      var min = +p.min; if (!(min > 0)) return false;
      var hb = readJSON('dash.habits', { list: [], log: {} });
      var habit = (hb.list || []).filter(function (x) { return /train|trening|gym|workout|løp|run|exercise/i.test(x.name); })[0];
      var w = { id: uid(), date: p.date || today(), kind: p.sport || 'other', min: min, km: +p.km || '', effort: p.effort || '3', habit: habit ? habit.id : '', notes: String(p.note || '') };
      var t = Fe.tools(); t.training = Array.isArray(t.training) ? t.training : []; t.training.push(w); Fe.saveTools(t);
      var ticked = false;
      if (habit) { hb.log = hb.log || {}; var l = hb.log[w.date] = hb.log[w.date] || []; if (l.indexOf(habit.id) < 0) { l.push(habit.id); ticked = true; writeJSON('dash.habits', hb); window.dispatchEvent(new Event('habits:change')); } }
      toast('<i class="bi bi-check-lg"></i> Workout logged' + (ticked ? ' · “' + esc(habit.name) + '” ticked' : ''), function () {
        var tl = Fe.tools(); tl.training = (tl.training || []).filter(function (x) { return x.id !== w.id; }); Fe.saveTools(tl);
        if (ticked) { var h2 = readJSON('dash.habits', { list: [], log: {} }); h2.log[w.date] = (h2.log[w.date] || []).filter(function (x) { return x !== habit.id; }); writeJSON('dash.habits', h2); window.dispatchEvent(new Event('habits:change')); }
      });
      return true;
    },
    todo: function (p) {
      var t = String(p.text || '').trim(); if (!t) return false;
      var todos = readJSON('dash.todos', []), item = { id: uid(), text: t.slice(0, 200), done: false };
      if (/^\d{4}-\d{2}-\d{2}$/.test(p.due || '')) item.due = p.due;
      todos.push(item); writeJSON('dash.todos', todos);
      toast('<i class="bi bi-check-lg"></i> Task added' + (item.due && window.Smart ? ' · due ' + window.Smart.when(item.due) : ''), function () {
        writeJSON('dash.todos', readJSON('dash.todos', []).filter(function (x) { return x.id !== item.id; }));
      });
      return true;
    },
    note: function (p) {
      var t = String(p.text || '').trim(); if (!t) return false;
      var notes = readJSON('dash.notes', []), n = { id: uid(), text: t }; notes.unshift(n); writeJSON('dash.notes', notes);
      toast('<i class="bi bi-check-lg"></i> Note saved', function () { writeJSON('dash.notes', readJSON('dash.notes', []).filter(function (x) { return x.id !== n.id; })); });
      return true;
    }
  };
  /* the forms → ADD */
  var SAVE = {
    expense: function (f) { var a = num(f.a.value); if (!(a > 0)) { f.a.focus(); return false; } return ADD.expense({ amount: a, cat: f.c.value, note: f.n.value, date: f.d.value }); },
    event: function (f) { if (!f.t.value.trim()) { f.t.focus(); return false; } return ADD.event({ title: f.t.value, date: f.d.value, start: f.all.checked ? null : f.s.value, allDay: f.all.checked, cat: f.c.value, location: f.l.value }); },
    workout: function (f) { if (!(+f.m.value > 0)) { f.m.focus(); return false; } return ADD.workout({ sport: f.k.value, min: +f.m.value, km: num(f.km.value), date: f.d.value, effort: f.e.value }); },
    todo: function (f) { return ADD.todo({ text: f.t.value, due: f.due.value }); },
    note: function (f) { return ADD.note({ text: f.t.value }); }
  };

  /* ---------- wiring ---------- */
  btn.addEventListener('click', function () { open(); });
  document.addEventListener('click', function (e) {
    var q = e.target.closest('[data-quick]');
    if (q) { e.preventDefault(); open(q.dataset.quick); }
  });
  bg.addEventListener('click', function (e) {
    if (e.target === bg || e.target.closest('[data-close]')) { close(); return; }
    var tab = e.target.closest('[data-tab]');
    if (tab) { kind = tab.dataset.tab; try { localStorage.setItem('dash.quickKind', kind); } catch (x) {} open(kind); return; }
    if (e.target.closest('[data-addline]')) { if (addLine()) { close(); setTimeout(reload, 0); } return; }
    if (e.target.closest("[data-qaedit]")) { editLine(); return; }
    if (e.target.closest('#qaClear')) { $('qaLine').value = ''; preview(); $('qaLine').focus(); return; }
    var chip = e.target.closest('[data-chip]');
    if (chip) { var f = chip.closest('form'); f.a.value = chip.dataset.a; f.c.value = chip.dataset.c; f.n.value = chip.dataset.n; f.querySelector('button[type=submit]').focus(); }
  });
  bg.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (f.id === 'qaSmart') { if (addLine()) { close(); setTimeout(reload, 0); } return; }
    if (SAVE[f.dataset.kind](f)) { close(); setTimeout(reload, 0); }
  });
  bg.addEventListener('input', function (e) { if (e.target.id === 'qaLine') preview(); });
  bg.addEventListener('change', function (e) {
    if (e.target.name === 'all') { var s = e.target.closest('form').s; s.disabled = e.target.checked; }
  });
  document.addEventListener('keydown', function (e) {
    if (!bg.hidden && e.key === 'Escape') { close(); return; }
    if (e.key === '+' && !/input|textarea|select/i.test(document.activeElement.tagName) && bg.hidden) { e.preventDefault(); open(); }
  });
  /* phone: pull the sheet down to close */
  (function () {
    var box = bg.firstElementChild, sd = null;
    box.addEventListener('touchstart', function (e) { var t = e.touches[0]; sd = { y0: t.clientY, dy: 0, t0: Date.now(), go: box.scrollTop <= 0 && !e.target.closest('input, select, textarea') }; }, { passive: true });
    box.addEventListener('touchmove', function (e) {
      if (!sd || !sd.go) return;
      sd.dy = e.touches[0].clientY - sd.y0;
      if (sd.dy > 0) { box.style.transition = 'none'; box.style.transform = 'translateY(' + sd.dy + 'px)'; }
    }, { passive: true });
    box.addEventListener('touchend', function () {
      if (!sd) return; var d = sd; sd = null; box.style.transition = ''; box.style.transform = '';
      if (d.go && (d.dy > 110 || (d.dy > 40 && Date.now() - d.t0 < 260))) close();
    });
  })();
  window.Vault.onLock(close);

  /* links from Siri, Shortcuts or Back Tap: /cmd/?add=… opens the sheet filled in, ready to confirm */
  (function () {
    var q = new URLSearchParams(location.search), a = q.get('add');
    if (!a) return;
    var line = a, pre = null, k = null;
    if (/^(expense|event|workout|task|todo|note)$/i.test(a)) {
      k = a.toLowerCase() === 'task' ? 'todo' : a.toLowerCase(); line = '';
      if (k === 'expense') pre = { a: num(q.get('kr') || q.get('amount')) || '', n: q.get('note') || '', c: q.get('cat') || '', d: q.get('date') || '' };
      else if (k === 'event') pre = { t: q.get('title') || q.get('note') || '', d: q.get('date') || '', s: q.get('time') || '', l: q.get('where') || '' };
      else if (k === 'workout') pre = { k: q.get('type') || '', m: q.get('min') || '', km: q.get('km') || '' };
      else pre = { t: q.get('text') || q.get('note') || '' };
    }
    q.delete('add'); ['kr', 'amount', 'note', 'cat', 'date', 'title', 'time', 'where', 'type', 'min', 'km', 'text'].forEach(function (x) { q.delete(x); });
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    window.Vault.onUnlock(function () { setTimeout(function () { open(k, pre, line); }, 350); });
  })();
  window.Quick = { open: open, close: close, toast: toast, add: function (p) { return allowed(p) && ADD[p.kind](p); } };
})();
