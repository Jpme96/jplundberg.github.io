/* Quick add: one "+" on every page. Log an expense, add an event, a workout, a task or a note
   in a couple of taps – without going to the page it belongs to. On phones it floats above
   the menu; on larger screens it sits in the top row. Press "+" on a keyboard to open it. */
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
    '<div class="qa-tabs" role="tablist" id="qaTabs"></div><div class="qa-body" id="qaBody"></div></div>';
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
  function open(k) {
    if (!window.Vault || !window.Vault.get()) return;          // locked
    var ks = kinds();
    if (k && ks.some(function (x) { return x[0] === k; })) kind = k;
    if (!ks.some(function (x) { return x[0] === kind; })) kind = ks[0][0];
    $('qaTabs').innerHTML = ks.map(function (x) {
      return '<button type="button" role="tab" data-tab="' + x[0] + '" aria-selected="' + (x[0] === kind) + '"><i class="bi bi-' + x[1] + '"></i><span>' + x[2] + '</span></button>';
    }).join('');
    $('qaBody').innerHTML = FORMS[kind]();
    bg.hidden = false; document.body.classList.add('qa-open');
    requestAnimationFrame(function () { bg.classList.add('open'); var f = $('qaBody').querySelector('[autofocus]'); if (f && matchMedia('(hover: hover)').matches) f.focus(); });
    try { localStorage.setItem('dash.quickKind', kind); } catch (e) {}
  }
  function close() {
    bg.classList.remove('open'); document.body.classList.remove('qa-open');
    setTimeout(function () { if (!bg.classList.contains('open')) bg.hidden = true; }, 320);
  }
  function toast(html) {
    var t = $('qaToast');
    if (!t) { t = document.createElement('div'); t.id = 'qaToast'; t.className = 'qa-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.innerHTML = html; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
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
    expense: function () {
      var chips = recentChips();
      return '<form class="qa-form" data-kind="expense">' +
        '<div class="qa-row"><input name="a" class="qa-amt" placeholder="Amount, kr" inputmode="decimal" autocomplete="off" required autofocus>' +
          '<select name="c" aria-label="Category">' + SPEND.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="qa-row"><input name="n" placeholder="What was it? (optional)" autocomplete="off"><input name="d" type="date" value="' + today() + '" aria-label="Date"></div>' +
        (chips.length ? '<div class="qa-chips">' + chips.map(function (e) {
          return '<button type="button" data-chip data-a="' + esc(e.amount) + '" data-c="' + esc(e.cat) + '" data-n="' + esc(e.note) + '">' + esc(e.note) + ' <b>' + esc(nf.format(e.amount)) + '</b></button>';
        }).join('') + '</div>' : '') +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Log expense</button></div></form>';
    },
    event: function () {
      var cats = window.Cal ? window.Cal.CAT_ORDER.map(function (id) { return [id, window.Cal.CATS[id].name]; }) :
        (function () { var c = readJSON('dash.calendar', {}).cats; return Array.isArray(c) && c.length ? c.map(function (x) { return [x.id, x.name]; }) : [['personal', 'Personal'], ['work', 'Work'], ['study', 'Study'], ['training', 'Training'], ['social', 'Social']]; })();
      var last = ''; try { last = localStorage.getItem('dash.calLastCat') || ''; } catch (e) {}
      var n = new Date(), hh = pad(Math.min(23, n.getHours() + 1)) + ':00';
      return '<form class="qa-form" data-kind="event">' +
        '<input name="t" placeholder="What? e.g. Dentist" autocomplete="off" required autofocus>' +
        '<div class="qa-row"><input name="d" type="date" value="' + today() + '" aria-label="Date"><input name="s" type="time" value="' + hh + '" aria-label="Start"><label class="qa-check"><input type="checkbox" name="all"> All day</label></div>' +
        '<div class="qa-row"><select name="c" aria-label="Category">' + cats.map(function (c) { return '<option value="' + esc(c[0]) + '"' + (c[0] === last ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select>' +
          '<input name="l" placeholder="Where (optional)" autocomplete="off"></div>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Add event</button></div></form>';
    },
    workout: function () {
      return '<form class="qa-form" data-kind="workout">' +
        '<div class="qa-row"><select name="k" aria-label="Type">' + SPORTS.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') + '</select>' +
          '<input name="m" placeholder="Minutes" inputmode="numeric" value="60" aria-label="Minutes" required></div>' +
        '<div class="qa-row"><input name="km" placeholder="km (optional)" inputmode="decimal" aria-label="Distance"><input name="d" type="date" value="' + today() + '" aria-label="Date"></div>' +
        '<div class="qa-effort" role="radiogroup" aria-label="How hard">' + [['1', 'Easy'], ['2', 'Light'], ['3', 'Moderate'], ['4', 'Hard'], ['5', 'All out']].map(function (e) {
          return '<label><input type="radio" name="e" value="' + e[0] + '"' + (e[0] === '3' ? ' checked' : '') + '><span>' + e[1] + '</span></label>';
        }).join('') + '</div>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Log workout</button></div></form>';
    },
    todo: function () {
      return '<form class="qa-form" data-kind="todo"><input name="t" placeholder="Something to do…" autocomplete="off" required autofocus>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Add task</button></div></form>';
    },
    note: function () {
      return '<form class="qa-form" data-kind="note"><textarea name="t" rows="3" placeholder="Write something…" required autofocus></textarea>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Save note</button></div></form>';
    }
  };

  /* ---------- saving: straight into the same places the pages use ---------- */
  function reload() { if (window.Dash && window.Dash.reload) window.Dash.reload(); }
  var SAVE = {
    expense: function (f) {
      var a = num(f.a.value); if (!(a > 0)) { f.a.focus(); return false; }
      var d = window.Vault.get(); d.expenses = d.expenses || [];
      var e = { id: uid(), t: Date.now(), date: f.d.value || today(), amount: a, cat: f.c.value, note: f.n.value.trim() };
      d.expenses.push(e); window.Vault.save(d);
      window.dispatchEvent(new Event('fin:change'));
      toast('<i class="bi bi-check-lg"></i> ' + esc(nf.format(a)) + (e.note ? ' · ' + esc(e.note) : '') + ' logged');
      return true;
    },
    event: function (f) {
      var t = f.t.value.trim(); if (!t) { f.t.focus(); return false; }
      var date = /^\d{4}-\d{2}-\d{2}$/.test(f.d.value) ? f.d.value : today(), all = f.all.checked;
      var ev = { id: uid(), title: t.slice(0, 120), cat: f.c.value, date: date, allDay: all, location: f.l.value.trim().slice(0, 160), notes: '' };
      if (!all) { var s = /^\d{2}:\d{2}$/.test(f.s.value) ? f.s.value : '09:00'; ev.start = s; var m = +s.slice(0, 2) * 60 + +s.slice(3) + 60; ev.stop = pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); }
      if (window.Cal) { var cd = window.Cal.load(); cd.events.push(ev); if (cd.hidden[ev.cat]) delete cd.hidden[ev.cat]; window.Cal.save(cd); }
      else { var raw = readJSON('dash.calendar', {}); raw.events = Array.isArray(raw.events) ? raw.events : []; raw.events.push(ev); if (raw.hidden && raw.hidden[ev.cat]) delete raw.hidden[ev.cat]; writeJSON('dash.calendar', raw); window.dispatchEvent(new Event('cal:change')); }
      try { localStorage.setItem('dash.calLastCat', ev.cat); } catch (e) {}
      toast('<i class="bi bi-check-lg"></i> ' + esc(t) + ' added' + (date === today() ? ' today' : ' on ' + new Date(date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })));
      return true;
    },
    workout: function (f) {
      var min = +f.m.value; if (!(min > 0)) { f.m.focus(); return false; }
      var hb = readJSON('dash.habits', { list: [], log: {} });
      var habit = (hb.list || []).filter(function (x) { return /train|trening|gym|workout|løp|run|exercise/i.test(x.name); })[0];
      var w = { id: uid(), date: f.d.value || today(), kind: f.k.value, min: min, km: num(f.km.value) || '', effort: f.e.value, habit: habit ? habit.id : '', notes: '' };
      var t = Fe.tools(); t.training = Array.isArray(t.training) ? t.training : []; t.training.push(w); Fe.saveTools(t);
      if (habit) { hb.log = hb.log || {}; var l = hb.log[w.date] = hb.log[w.date] || []; if (l.indexOf(habit.id) < 0) { l.push(habit.id); writeJSON('dash.habits', hb); window.dispatchEvent(new Event('habits:change')); } }
      toast('<i class="bi bi-check-lg"></i> Workout logged' + (habit ? ' · “' + esc(habit.name) + '” ticked' : ''));
      return true;
    },
    todo: function (f) {
      var t = f.t.value.trim(); if (!t) return false;
      var todos = readJSON('dash.todos', []); todos.push({ id: uid(), text: t, done: false }); writeJSON('dash.todos', todos);
      toast('<i class="bi bi-check-lg"></i> Task added'); return true;
    },
    note: function (f) {
      var t = f.t.value.trim(); if (!t) return false;
      var notes = readJSON('dash.notes', []); notes.unshift({ id: uid(), text: t }); writeJSON('dash.notes', notes);
      toast('<i class="bi bi-check-lg"></i> Note saved'); return true;
    }
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
    var chip = e.target.closest('[data-chip]');
    if (chip) { var f = chip.closest('form'); f.a.value = chip.dataset.a; f.c.value = chip.dataset.c; f.n.value = chip.dataset.n; f.querySelector('button[type=submit]').focus(); }
  });
  bg.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (SAVE[f.dataset.kind](f)) { close(); setTimeout(reload, 0); }
  });
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
  window.Quick = { open: open, close: close };
})();
