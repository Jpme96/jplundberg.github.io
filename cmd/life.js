/* Optional helpers (Settings → Features), on every page:
     Talk to add        a mic in the top bar – say it, and Quick add fills itself in
     Shutdown ritual    end the workday: clock out, move what's left, pick tomorrow's top 3
     Find time          a free slot this week for anything, booked in one tap
     Meeting prep       before a meeting: notes and open action points from last time
     Trip budget mode   while you're away: what you can spend today
     Rest-day advisor   ready to train, go easy or rest – from sleep, heart rate and training
   Their lines in At a glance come through window.BriefExtra; commands for ⌘K through window.CommandExtra. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var Fe = window.Features;
  function on(k) { return !!(Fe && Fe.on(k)); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function hm(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function reloadAll() { window.dispatchEvent(new Event('todos:change')); if (window.Dash && window.Dash.reload) window.Dash.reload(); window.dispatchEvent(new Event('brief:refresh')); }
  window.BriefExtra = window.BriefExtra || [];
  window.CommandExtra = window.CommandExtra || [];

  /* ---------- one dialog for all of them (centred, closes with Esc or a tap outside) ---------- */
  function dialog(cls, html, onClick) {
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<div class="fo-box lf-box ' + cls + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    function close() { bg.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-lfclose]')) return close(); if (onClick) onClick(e, close, bg.firstChild); });
    var f = bg.querySelector('input, button:not([data-lfclose])'); if (f && matchMedia('(hover: hover)').matches) setTimeout(function () { f.focus(); }, 30);
    return { el: bg.firstChild, close: close };
  }
  function head(icon, title, sub) { return '<div class="lf-head"><h3><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h3><button type="button" class="icon-btn sm" data-lfclose aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' + (sub ? '<p class="muted lf-sub">' + esc(sub) + '</p>' : ''); }

  /* the button host: the modern bar, or the top corner of the page */
  function addButton(btn) {
    var host = document.querySelector('.mb-acts') || document.querySelector('.top-actions') || document.querySelector('#fp > .fp-top');
    if (!host) return;
    var before = host.querySelector('#quickAdd') || host.querySelector('[data-search]') || null;
    host.insertBefore(btn, before);
  }

  /* ================= Talk to add ================= */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var mic = null;
  function voiceButton() {
    var want = on('voice') && !!SR && document.documentElement.classList.contains('unlocked');
    if (!want) { if (mic) mic.hidden = true; return; }
    if (!mic) {
      mic = document.createElement('button'); mic.type = 'button'; mic.className = 'icon-btn mic-btn'; mic.id = 'micBtn';
      mic.setAttribute('aria-label', 'Talk to add'); mic.title = 'Talk to add'; mic.innerHTML = '<i class="bi bi-mic"></i>';
      mic.addEventListener('click', listen);
    }
    if (!mic.isConnected) addButton(mic);
    mic.hidden = false;
  }
  function listen() {
    if (!SR) return;
    var lang = (readJSON('dash.settings', {}) || {}).voiceLang || ((readJSON('dash.settings', {}) || {}).lang === 'en' ? 'en-GB' : 'nb-NO');
    var r = new SR(); r.lang = lang; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
    var pill = document.createElement('div'); pill.className = 'mic-pill'; pill.setAttribute('role', 'status');
    pill.innerHTML = '<span class="mic-dot"></span><span class="mic-tx">' + (lang === 'nb-NO' ? 'Lytter … si f.eks. «149 Rema»' : 'Listening … say e.g. “149 Rema”') + '</span><button type="button" class="icon-btn sm" aria-label="Stop"><i class="bi bi-stop-fill"></i></button>';
    document.body.appendChild(pill); mic.classList.add('on');
    var text = '', done = false;
    function end() { if (done) return; done = true; pill.remove(); mic.classList.remove('on'); if (text.trim() && window.Quick) window.Quick.open(null, null, text.trim()); }
    pill.querySelector('button').addEventListener('click', function () { try { r.stop(); } catch (e) {} });
    r.onresult = function (e) { text = Array.prototype.map.call(e.results, function (x) { return x[0].transcript; }).join(' '); pill.querySelector('.mic-tx').textContent = text; };
    r.onerror = function (e) { if (e.error === 'not-allowed') toast('<i class="bi bi-mic-mute"></i> Allow the microphone for this site to talk to add'); end(); };
    r.onend = end;
    try { r.start(); } catch (e) { end(); }
  }
  window.CommandExtra.push(function () { return on('voice') && SR ? [{ i: 'mic', t: 'Talk to add', s: 'Say it, and it’s added', run: listen, x: 'voice speak mic snakk tale' }] : []; });

  /* ================= Shutdown ritual ================= */
  function shutdownDue(now) {
    var d = now.getDay(); if (d === 0 || d === 6) return false;
    return now.getHours() >= 15 && now.getHours() < 23 && localStorage.getItem('dash.shutdown') !== dkey(now);
  }
  function shutdown() {
    var now = new Date(), tk = dkey(now), tom = addDays(tk, 1);
    var todos = readJSON('dash.todos', []) || [];
    var left = todos.filter(function (t) { return !t.done && (t.today === tk || (t.due && t.due <= tk)); });
    var open = todos.filter(function (t) { return !t.done; });
    var flexOpen = on('flex') ? Fe.list('flex').filter(function (e) { return e.date === tk && e.in && !e.out; })[0] : null;
    var nowHM = pad(now.getHours()) + ':' + pad(now.getMinutes());
    var picks = open.filter(function (t) { return t.today === tom; }).map(function (t) { return t.id; });
    var tomEv = [];
    if (window.Cal && window.Cal.occurrences) { try { var a = fromKey(tom), b = fromKey(tom); b.setHours(23, 59); tomEv = window.Cal.occurrences(a, b).filter(function (o) { return !o.allDay && !(o.ev && o.ev.holiday); }).slice(0, 3); } catch (e) {} }
    var html = head('moon-stars', 'End your workday', 'Close today in one go – and know what tomorrow holds.') +
      (flexOpen ? '<section class="lf-sec"><h4>Work time</h4><label class="lf-check"><input type="checkbox" id="sdOut" checked> Clock out now (' + nowHM + ') – clocked in at ' + esc(flexOpen.in) + '</label></section>' : '') +
      '<section class="lf-sec"><h4>Left from today</h4>' + (left.length ? left.map(function (t) { return '<label class="lf-check"><input type="checkbox" data-sdmove="' + esc(t.id) + '" checked> <span>Move <b>' + esc(t.text) + '</b> to tomorrow</span></label>'; }).join('') : '<p class="muted">Nothing left – nice work.</p>') + '</section>' +
      '<section class="lf-sec"><h4>Tomorrow’s top 3 <small class="muted" id="sdCount"></small></h4><div class="lf-chips" id="sdPick">' +
      (open.length ? open.slice(0, 14).map(function (t) { return '<button type="button" class="lf-chip" data-sdpick="' + esc(t.id) + '" aria-pressed="' + (picks.indexOf(t.id) > -1) + '">' + esc(t.text) + '</button>'; }).join('') : '<p class="muted">No open tasks.</p>') + '</div></section>' +
      (tomEv.length ? '<section class="lf-sec"><h4>Tomorrow</h4>' + tomEv.map(function (o) { return '<p class="lf-ev"><b>' + pad(o.start.getHours()) + ':' + pad(o.start.getMinutes()) + '</b> ' + esc(o.title) + '</p>'; }).join('') + '</section>' : '') +
      '<div class="lf-foot"><button type="button" class="text-btn" data-lfclose>Not now</button><button type="button" class="pill-btn wide" data-sddo><i class="bi bi-check2"></i> End my day</button></div>';
    var d = dialog('lf-shutdown', html, function (e, close, box) {
      var p = e.target.closest('[data-sdpick]');
      if (p) {
        var onNow = p.getAttribute('aria-pressed') === 'true';
        if (!onNow && box.querySelectorAll('[data-sdpick][aria-pressed="true"]').length >= 3) { toast('<i class="bi bi-trophy"></i> Three is the limit – take one out first'); return; }
        p.setAttribute('aria-pressed', String(!onNow)); count(box); return;
      }
      if (!e.target.closest('[data-sddo]')) return;
      var l = readJSON('dash.todos', []) || [];
      var moves = Array.prototype.map.call(box.querySelectorAll('[data-sdmove]:checked'), function (x) { return x.dataset.sdmove; });
      var chosen = Array.prototype.map.call(box.querySelectorAll('[data-sdpick][aria-pressed="true"]'), function (x) { return x.dataset.sdpick; });
      l.forEach(function (t) {
        if (moves.indexOf(t.id) > -1) { t.due = tom; if (t.today === tk) { delete t.today; delete t.rank; } }
        if (t.today === tom && chosen.indexOf(t.id) < 0) { delete t.today; delete t.rank; }
      });
      chosen.forEach(function (id, i) { l.forEach(function (t) { if (t.id === id) { t.today = tom; t.rank = i + 1; } }); });
      writeJSON('dash.todos', l);
      var out = box.querySelector('#sdOut');
      if (out && out.checked && flexOpen) { var tt = Fe.tools(); (tt.flex || []).forEach(function (x) { if (x.id === flexOpen.id) x.out = nowHM; }); Fe.saveTools(tt); }
      try { localStorage.setItem('dash.shutdown', tk); } catch (x) {}
      close(); reloadAll(); window.dispatchEvent(new Event('plan:change'));
      toast('<i class="bi bi-moon-stars"></i> Workday closed' + (moves.length ? ' · ' + moves.length + ' moved to tomorrow' : '') + '. See you tomorrow.');
    });
    function count(box) { var n = box.querySelectorAll('[data-sdpick][aria-pressed="true"]').length; box.querySelector('#sdCount').textContent = n + ' of 3'; }
    count(d.el);
  }
  window.BriefExtra.push(function (add, now) {
    if (on('shutdown') && shutdownDue(now)) add(30, 'moon-stars', '#6b4bc4', 'End your workday', 'Move what’s left and pick tomorrow’s top 3', '#shutdown');
  });
  window.CommandExtra.push(function () { return on('shutdown') ? [{ i: 'moon-stars', t: 'End my workday', s: 'Clock out, move what’s left, pick tomorrow’s top 3', run: shutdown, x: 'shutdown end day close avslutt' }] : []; });

  /* ================= Find time ================= */
  function busy(dayKey) {
    var C = window.Cal; if (!C || !C.occurrences) return [];
    var a = fromKey(dayKey), b = fromKey(dayKey); b.setHours(23, 59);
    try { return C.occurrences(a, b).filter(function (o) { return !o.allDay; }).map(function (o) { return [o.start.getHours() * 60 + o.start.getMinutes(), o.end ? (o.end.getHours() * 60 + o.end.getMinutes() || 1440) : o.start.getHours() * 60 + o.start.getMinutes() + 60]; }); } catch (e) { return []; }
  }
  function slots(len, range, win, weekends) {
    var now = new Date(), tk = dkey(now), out = [], startDay = range === 'next' ? addDays(tk, 7 - ((now.getDay() + 6) % 7)) : tk;
    var days = range === 'week' ? 7 - ((now.getDay() + 6) % 7) : range === 'next' ? 7 : 14;
    for (var i = 0; i < days; i++) {
      var k = addDays(startDay, i), dow = fromKey(k).getDay();
      if (!weekends && (dow === 0 || dow === 6)) continue;
      if (Fe && Fe.holiday && Fe.holiday(k) && win[0] < 17 * 60) continue;
      var b = busy(k).map(function (x) { return [x[0] - 15, x[1] + 15]; }).sort(function (x, y) { return x[0] - y[0]; });
      var t = win[0];
      if (k === tk) t = Math.max(t, Math.ceil((now.getHours() * 60 + now.getMinutes() + 30) / 30) * 30);
      var dayOut = [];
      while (t + len <= win[1]) {
        var clash = b.filter(function (x) { return x[0] < t + len && x[1] > t; })[0];
        if (clash) { t = Math.ceil(clash[1] / 30) * 30; continue; }
        dayOut.push({ date: k, start: t }); t += Math.max(len, 60);
      }
      if (dayOut.length) out.push(dayOut);
    }
    /* one per day first (the earliest that isn't too early), then the rest */
    var first = out.map(function (d) { return d[0]; }), rest = [];
    out.forEach(function (d) { rest = rest.concat(d.slice(1)); });
    return first.concat(rest).slice(0, 8);
  }
  function findTime(preTitle) {
    if (!window.Cal) { location.href = '/cmd/calendar/#findtime'; return; }
    var st = { len: 60, range: 'week', win: 'work', wk: false };
    var WIN = { work: [8 * 60, 16 * 60], evening: [17 * 60, 22 * 60], any: [8 * 60, 22 * 60] };
    var seg = function (k, opts) { return '<div class="seg lf-seg" role="group">' + opts.map(function (o) { return '<button type="button" data-ft="' + k + ':' + o[0] + '" aria-pressed="' + (String(st[k]) === String(o[0])) + '">' + o[1] + '</button>'; }).join('') + '</div>'; };
    function body() {
      var list = slots(st.len, st.range, WIN[st.win], st.wk);
      return seg('len', [[30, '30 min'], [60, '1 h'], [120, '2 h'], [180, '3 h']]) + seg('range', [['week', 'This week'], ['next', 'Next week'], ['two', '2 weeks']]) +
        seg('win', [['work', 'Work hours'], ['evening', 'Evenings'], ['any', 'Any time']]) +
        '<label class="lf-check"><input type="checkbox" data-ftwk' + (st.wk ? ' checked' : '') + '> Weekends too</label>' +
        '<div class="lf-slots">' + (list.length ? list.map(function (s) {
          var d = fromKey(s.date);
          return '<button type="button" class="lf-slot" data-ftbook="' + s.date + '|' + s.start + '"><b>' + esc(d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })) + '</b><span>' + hm(s.start) + '–' + hm(s.start + st.len) + '</span><i class="bi bi-plus-lg"></i></button>';
        }).join('') : '<p class="muted">No free slot that long – try a shorter time, or more days.</p>') + '</div>';
    }
    var d = dialog('lf-find', head('calendar2-range', 'Find time', 'What do you need time for?') +
      '<input id="ftTitle" placeholder="e.g. Write the FDV report, gym, call mum" maxlength="120" value="' + esc(preTitle || '') + '"><div id="ftBody">' + body() + '</div>',
      function (e, close, box) {
        var b = e.target.closest('[data-ft]');
        if (b) { var p = b.dataset.ft.split(':'); st[p[0]] = p[0] === 'len' ? +p[1] : p[1]; box.querySelector('#ftBody').innerHTML = body(); return; }
        if (e.target.matches('[data-ftwk]')) { st.wk = e.target.checked; box.querySelector('#ftBody').innerHTML = body(); return; }
        var bk = e.target.closest('[data-ftbook]'); if (!bk) return;
        var title = box.querySelector('#ftTitle').value.trim();
        if (!title) { box.querySelector('#ftTitle').focus(); box.querySelector('#ftTitle').classList.add('kit-bad'); return; }
        var q = bk.dataset.ftbook.split('|'), C = window.Cal, cal = C.load();
        var cat = window.Smart && window.Smart.guessCat ? window.Smart.guessCat(title) : null; if (!cat || !C.CATS[cat]) cat = C.CATS.personal ? 'personal' : C.CAT_ORDER[0];
        var ev = { id: C.uid(), title: title, cat: cat, date: q[0], allDay: false, start: hm(+q[1]), stop: hm(Math.min(+q[1] + st.len, 1439)) };
        cal.events.push(ev); if (cal.hidden && cal.hidden[cat]) delete cal.hidden[cat]; C.save(cal);
        window.dispatchEvent(new Event('cal:change')); close();
        toast('<i class="bi bi-calendar-check"></i> ' + esc(title) + ' · ' + esc(fromKey(q[0]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })) + ' ' + ev.start, function () { var c2 = C.load(); c2.events = c2.events.filter(function (x) { return x.id !== ev.id; }); C.save(c2); window.dispatchEvent(new Event('cal:change')); });
      });
    d.el.addEventListener('change', function (e) { if (e.target.matches('[data-ftwk]')) { st.wk = e.target.checked; d.el.querySelector('#ftBody').innerHTML = body(); } });
  }
  window.CommandExtra.push(function () { return on('findtime') ? [{ i: 'calendar2-range', t: 'Find time', s: 'A free slot this week for anything', run: function () { findTime(); }, x: 'find time free slot schedule ledig tid' }] : []; });
  /* a "Find time" button next to New on the calendar page */
  function calButton() {
    var nw = document.getElementById('clNew'); if (!nw) return;
    var b = document.getElementById('clFind');
    if (!on('findtime')) { if (b) b.hidden = true; return; }
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'clFind'; b.className = 'icon-btn cl-find'; b.setAttribute('aria-label', 'Find time'); b.title = 'Find time'; b.innerHTML = '<i class="bi bi-calendar2-range"></i>'; b.addEventListener('click', function () { findTime(); }); nw.parentNode.insertBefore(b, nw); }
    b.hidden = false;
  }
  if (location.hash === '#findtime') window.Vault.onUnlock(function () { history.replaceState(null, '', location.pathname + location.search); setTimeout(function () { findTime(); }, 400); });

  /* ================= Meeting prep ================= */
  var STOP = { the: 1, and: 1, med: 1, til: 1, for: 1, och: 1, meeting: 1, 'møte': 1, with: 1, 'på': 1, 'og': 1, 'i': 1, 'om': 1, 'av': 1 };
  function words(s) { return String(s || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(function (w) { return w.length >= 3 && !STOP[w]; }); }
  function lastMeeting(title) {
    if (!Fe || !Fe.on('meetings')) return null;
    var w = words(title); if (!w.length) return null;
    var best = null, bestScore = 0;
    Fe.list('meetings').forEach(function (m) {
      var mw = words(m.title + ' ' + (m.who || '')), hit = w.filter(function (x) { return mw.indexOf(x) > -1; }).length;
      var score = hit / Math.min(w.length, Math.max(1, mw.length));
      if (hit && (score > bestScore || (score === bestScore && best && m.date > best.date))) { best = m; bestScore = score; }
    });
    return bestScore >= .5 || (best && words(best.title).length && bestScore > 0 && w.length <= 2) ? best : null;
  }
  function openActs(m) { return String(m.actions || '').split('\n').map(function (x, i) { return { t: x.trim(), i: i }; }).filter(function (a) { return a.t && !(m.done || {})[a.i]; }); }
  var prepFor = {};
  window.BriefExtra.push(function (add, now) {
    if (!on('prep') || !window.Cal || !window.Cal.occurrences) return;
    var end = new Date(now.getTime() + 3 * 36e5), occ = [];
    try { occ = window.Cal.occurrences(now, end).filter(function (o) { return !o.allDay && o.start > now && !(o.ev && (o.ev.todo || o.ev.holiday || o.ev.reminder)); }); } catch (e) {}
    occ.slice(0, 2).forEach(function (o) {
      var m = lastMeeting(o.title), notes = o.ev && o.ev.notes;
      if (!m && !notes) return;
      var id = 'prep' + Object.keys(prepFor).length; prepFor[id] = { o: o, m: m };
      var acts = m ? openActs(m) : [];
      add(9, 'clipboard-check', '#3987e5', 'Prep: ' + o.title + ' at ' + pad(o.start.getHours()) + ':' + pad(o.start.getMinutes()),
        m ? 'Last time ' + new Date(m.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + (acts.length ? ' · ' + acts.length + ' open action' + (acts.length === 1 ? '' : 's') : ' · notes ready') : 'Notes in the event', '#' + id);
    });
  });
  function showPrep(p) {
    var o = p.o, m = p.m, acts = m ? openActs(m) : [];
    var html = head('clipboard-check', o.title, pad(o.start.getHours()) + ':' + pad(o.start.getMinutes()) + (o.ev && o.ev.location ? ' · ' + o.ev.location : '')) +
      (o.ev && o.ev.notes ? '<section class="lf-sec"><h4>In the event</h4><p class="lf-notes">' + esc(o.ev.notes) + '</p></section>' : '') +
      (m ? '<section class="lf-sec"><h4>Last time · ' + esc(new Date(m.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })) + (m.who ? ' · ' + esc(m.who) : '') + '</h4>' +
        (m.notes ? '<p class="lf-notes">' + esc(m.notes) + '</p>' : '') +
        (acts.length ? '<h4>Open action points</h4>' + acts.map(function (a) { return '<label class="lf-check"><input type="checkbox" data-prepact="' + esc(m.id) + ':' + a.i + '"> ' + esc(a.t) + '</label>'; }).join('') : '<p class="muted">All action points done.</p>') + '</section>' : '') +
      '<div class="lf-foot"><a class="text-btn" href="/cmd/work/#meetings"><i class="bi bi-people"></i> Meeting notes</a><button type="button" class="pill-btn wide" data-lfclose>Ready</button></div>';
    var d = dialog('lf-prep', html);
    d.el.addEventListener('change', function (e) {
      var a = e.target.dataset.prepact; if (!a) return;
      var q = a.split(':'), t = Fe.tools(); (t.meetings || []).forEach(function (x) { if (x.id === q[0]) { x.done = x.done || {}; if (e.target.checked) x.done[q[1]] = true; else delete x.done[q[1]]; } }); Fe.saveTools(t);
    });
  }

  /* ================= Trip budget mode ================= */
  function tripToday() {
    if (!on('tripbudget') || !window.Flow || !window.Flow.travel) return null;
    var now = new Date(), tk = dkey(now);
    var tr = (window.Flow.travel().trips || []).filter(function (t) { return t.start <= tk && (t.end || t.start) >= tk && +t.budget > 0; })[0];
    if (!tr) return null;
    var n = function (v) { var x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
    var items = tr.items || [], booked = items.reduce(function (a, it) { return a + n(it.cost); }, 0);
    var linked = {}; items.forEach(function (it) { if (it.spendId) linked[it.spendId] = 1; });
    var ex = ((window.Vault.get() || {}).expenses || []).filter(function (e) { return e.date >= tr.start && e.date <= (tr.end || tr.start) && !linked[e.id]; });
    var before = ex.filter(function (e) { return e.date < tk; }).reduce(function (a, e) { return a + n(e.amount); }, 0);
    var today = ex.filter(function (e) { return e.date === tk; }).reduce(function (a, e) { return a + n(e.amount); }, 0);
    var daysLeft = Math.round((fromKey(tr.end || tr.start) - fromKey(tk)) / 864e5) + 1;
    var perDay = (n(tr.budget) - booked - before) / Math.max(1, daysLeft);
    return { trip: tr, perDay: perDay, spentToday: today, left: perDay - today, daysLeft: daysLeft };
  }
  window.TripBudget = { today: tripToday };
  window.BriefExtra.push(function (add) {
    var t = tripToday(); if (!t) return;
    var nm = t.trip.name || t.trip.dest || 'Trip';
    add(6, 'cash-coin', t.left < 0 ? '#e66767' : '#0891b2', t.left < 0 ? nm + ': ' + kr(-t.left) + ' over today' : nm + ': ' + kr(t.left) + ' left today',
      (t.perDay > 0 ? kr(t.perDay) + ' a day' : 'Budget used') + ' · ' + t.daysLeft + ' day' + (t.daysLeft === 1 ? '' : 's') + ' left', '/cmd/travel/#trip=' + t.trip.id);
  });

  /* ================= Rest-day advisor ================= */
  function readiness() {
    if (!on('rest')) return null;
    var D = ((window.Vault.get() || {}).health || {}).days || {}, now = new Date(), tk = dkey(now);
    var day = D[tk] || D[addDays(tk, -1)] || null;
    function base(f) { var v = []; for (var i = 1; i <= 15; i++) { var x = D[addDays(tk, -i)]; if (x && x[f] != null) v.push(+x[f]); } return v.length >= 4 ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; }
    var why = [], score = 100, data = 0;
    if (day && day.hrv != null) { data++; var bh = base('hrv'); if (bh) { var drop = (bh - day.hrv) / bh * 100; if (drop > 5) { score -= Math.min(40, drop * 1.5); why.push('HRV ' + Math.round(drop) + ' % below your normal'); } else if (drop < -5) why.push('HRV above your normal'); } }
    if (day && day.rhr != null) { data++; var br = base('rhr'); if (br) { var rise = day.rhr - br; if (rise > 2) { score -= Math.min(25, rise * 4); why.push('Resting pulse +' + Math.round(rise) + ' bpm'); } } }
    if (day && day.sleep != null) { data++; if (day.sleep < 7) { score -= (7 - day.sleep) * 12; why.push('Slept ' + String(Math.round(day.sleep * 10) / 10).replace('.', ',') + ' h'); } else why.push('Slept well'); }
    /* training: days in a row with a workout or a gym session */
    var trained = {};
    if (Fe) { (Fe.tools().training || []).forEach(function (w) { trained[w.date] = 1; }); (Fe.tools().gym || []).forEach(function (s) { trained[s.date] = 1; }); }
    var streak = 0; for (var i = 1; i <= 7; i++) { if (trained[addDays(tk, -i)]) streak++; else break; }
    if (streak >= 3) { score -= streak >= 4 ? 25 : 15; why.push(streak + ' training days in a row'); }
    if (!data && !streak) return { score: null, level: 'none', why: [] };
    score = Math.max(0, Math.min(100, Math.round(score)));
    return { score: score, level: score >= 75 ? 'go' : score >= 55 ? 'easy' : 'rest', why: why, streak: streak };
  }
  window.Readiness = readiness;
  window.BriefExtra.push(function (add) {
    var r = readiness(); if (!r || r.score == null || r.level === 'go') return;
    add(r.level === 'rest' ? 11 : 32, 'battery-half', r.level === 'rest' ? '#e66767' : '#c98500', r.level === 'rest' ? 'Take a rest day' : 'Go easy today', r.why.slice(0, 2).join(' · ') + ' · readiness ' + r.score, '/cmd/habits/#rest', { key: 'rest:' + dkey(new Date()) });
  });

  /* ---------- clicks on At a glance lines ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#prep"], a[href="#shutdown"]');
    if (!a) return;
    e.preventDefault();
    var h = a.getAttribute('href').slice(1);
    if (h === 'shutdown') shutdown(); else if (prepFor[h]) showPrep(prepFor[h]);
  });

  function refresh() { voiceButton(); calButton(); }
  window.addEventListener('features:change', function () { refresh(); window.dispatchEvent(new Event('brief:refresh')); });
  window.Vault.onUnlock(function () { setTimeout(refresh, 80); });
  refresh();
  window.Life = { shutdown: shutdown, findTime: findTime, listen: listen, readiness: readiness };
})();
