/* Small things that keep themselves going (Nov 2026):
   · Habit streaks – weeks in a row on target (the flame on Home's Habits card is delight.js); At a glance warns late in the week
     when a streak is about to break, and cheers at 4, 8, 12 … weeks.
   · Birthday gifts – two weeks before a birthday (Settings → People), At a glance reminds you to find a gift,
     with the person's gift ideas and your budget; one tap puts the idea on the Wishlist.
   Settings: healthcfg.streakBrief (Settings → Health), peoplecfg.giftLead (Settings → People). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function readJSON(k, f) { try { var v = localStorage.getItem(k); return v === null ? f : JSON.parse(v); } catch (e) { return f; } }
  var dkey = Fe.dkey;
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function hcfg() { var c = Fe.tools().healthcfg; return Object.assign({ streakBrief: true }, c && typeof c === 'object' ? c : {}); }
  function pcfg() { var c = Fe.tools().peoplecfg; return Object.assign({ giftLead: 14 }, c && typeof c === 'object' ? c : {}); }

  /* ================= habit streaks ================= */
  function count(hb, id, mon) { var n = 0; for (var i = 0; i < 7; i++) { var d = new Date(mon); d.setDate(mon.getDate() + i); if (((hb.log || {})[dkey(d)] || []).indexOf(id) > -1) n++; } return n; }
  function of(h, hb) {
    hb = hb || readJSON('dash.habits', { list: [], log: {} });
    var thisMon = monday(new Date()), first = Object.keys(hb.log || {}).sort()[0], run = 0, best = 0;
    if (!first) return { cur: 0, best: 0, week: 0, met: false };
    for (var m = monday(new Date(first + 'T12:00')); m <= thisMon; m.setDate(m.getDate() + 7)) {
      var met = count(hb, h.id, m) >= (+h.target || 1);
      if (met) { run++; best = Math.max(best, run); } else if (m < thisMon) run = 0;
    }
    var wk = count(hb, h.id, thisMon);
    return { cur: run, best: best, week: wk, met: wk >= (+h.target || 1) };
  }
  window.Streak = { of: of };

  (window.BriefExtra = window.BriefExtra || []).push(function (add, now) {
    if (!hcfg().streakBrief || !(Fe.on('habits') || Fe.on('healthpage'))) return;
    var hb = readJSON('dash.habits', { list: [], log: {} }), wd = (now.getDay() + 6) % 7, left = 6 - wd + 1;   /* days left this week, today included */
    (hb.list || []).forEach(function (h) {
      var s = of(h, hb), need = (+h.target || 1) - s.week;
      if (s.met && s.cur >= 4 && s.cur % 4 === 0 && wd >= 4) add(60, 'fire', '#e8743b', s.cur + ' weeks in a row: ' + h.name, s.cur >= s.best ? 'Your best streak yet' : 'Best is ' + s.best + ' weeks', '/cmd/habits/');
      else if (!s.met && s.cur >= 2 && wd >= 4 && need > 0 && need <= left) add(need === left ? 30 : 46, 'fire', '#e8743b', h.name + ': ' + need + ' more to keep your ' + s.cur + '-week streak', need === left ? 'Every day left this week' : left + ' days left this week', '/cmd/');
    });
  });

  /* ================= birthday gifts, two weeks ahead ================= */
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    var HL = window.HomeLife; if (!HL || !Fe.on('people')) return;
    var c = pcfg(), lead = +c.giftLead || 0, birthLead = +c.lead || 0; if (!lead) return;
    var y = String(new Date().getFullYear()), gifts = Fe.list('gifts');
    Fe.list('people').forEach(function (p) {
      var b = HL.bday(p); if (!b || b.n > lead || b.n <= birthLead) return;     /* the birthday's own heads-up takes over in the last days */
      if (gifts.some(function (g) { return g.pid === p.id && g.occ === 'bday' && String(g.date || '').slice(0, 4) === b.next.slice(0, 4); })) return;
      var ideas = String(p.gifts || '').split('\n').map(function (x) { return x.replace(/^[-*•]\s*/, '').trim(); }).filter(Boolean);
      var wl = Fe.on('wish') && ideas.length && !Fe.list('wishes').some(function (w) { return w.for === 'gift' && w.title === ideas[0] + ' – ' + p.name; });
      add(b.n <= 7 ? 34 : 50, 'gift', '#d55181', 'A gift for ' + p.name + ' – birthday in ' + b.n + ' days',
        (ideas.length ? 'Ideas: ' + ideas.slice(0, 2).join(', ') : 'No gift ideas yet – add some on People') + (+c.gbBday ? ' · budget ' + nf.format(+c.gbBday) + ' kr' : ''), '/cmd/people/#people=' + p.id,
        wl ? { main: true, act: { id: 'gw:' + p.id + ':' + y, label: 'Wishlist' }, run: function () {
          var t = Fe.tools(); t.wishes = (Array.isArray(t.wishes) ? t.wishes : []).concat([{ id: Date.now().toString(36), title: ideas[0] + ' – ' + p.name, for: 'gift', prio: 1, price: +c.gbBday || '', added: dkey(new Date()), notes: 'For ' + p.name + '’s birthday ' + b.next }]); Fe.saveTools(t);
          toast('<i class="bi bi-stars"></i> On the Wishlist');
        } } : undefined);
    });
  });

  /* ================= gym bag: on your gym days, a packing list in the morning ================= */
  function gcfg() { var c = Fe.tools().healthcfg; c = c && typeof c === 'object' ? c : {}; return { days: Array.isArray(c.gymDays) ? c.gymDays : [], bag: typeof c.gymBag === 'string' ? c.gymBag : 'Shoes, towel, lock, water bottle, headphones' }; }
  (window.BriefExtra = window.BriefExtra || []).push(function (add, now) {
    if (!(Fe.on('gym') || Fe.on('training'))) return;
    var g = gcfg(), wd = (now.getDay() + 6) % 7, tk = dkey(now); if (g.days.indexOf(wd) < 0 || now.getHours() >= 17) return;
    var T = Fe.tools(), trained = (T.training || []).some(function (w) { return w.date === tk; }) || (T.gym || []).some(function (x) { return String(x.date || '').slice(0, 10) === tk; });
    if (trained || (T.gympacked || '') === tk) return;
    add(now.getHours() < 9 ? 38 : 52, 'bag-check', '#d55181', 'Gym today – pack your bag', g.bag, '/cmd/habits/#training', { main: true, act: { id: 'gb:' + tk, label: 'Packed' }, run: function () { var t = Fe.tools(); t.gympacked = tk; Fe.saveTools(t); } });
  });
  /* ================= Water (Health page) =================
     The same glasses as the Home chip (dash.tools.water { day: glasses }); Apple Health's water (litres) counts too –
     the higher of the two wins for a day, so nothing is counted twice. Settings: ringcfg.card, ringcfg.glass (ml). */
  function wcfg() { var r = Fe.tools().ringcfg || {}; return { card: r.card !== false, goal: +r.waterGoal || 8, ml: +r.glass || 250 }; }
  function wDay(k, c) {
    var g = +((Fe.tools().water || {})[k]) || 0, d = window.Vault.get() || {}, a = d.health && d.health.days && d.health.days[k] ? +d.health.days[k].water || 0 : 0;
    if (a > 20) a = a / 1000;
    var ag = Math.round(a * 1000 / c.ml);
    return { n: Math.max(g, ag), tap: g, apple: ag > g };
  }
  function wAdd(delta) {
    var t = Fe.tools(), k = Fe.dkey(new Date()), c = wcfg(); t.water = t.water && typeof t.water === 'object' ? Object.assign({}, t.water) : {};
    var was = +t.water[k] || 0, now = Math.max(0, Math.min(40, wDay(k, c).n + delta));
    t.water[k] = now; Fe.saveTools(t);
    if (delta > 0) toast('<i class="bi bi-cup-straw"></i> ' + now + ' of ' + c.goal + ' glasses', function () { var t2 = Fe.tools(); t2.water = Object.assign({}, t2.water || {}); t2.water[k] = was; Fe.saveTools(t2); });
  }
  function drawWater() {
    var el = $t('hwater'); if (!el) return;
    var c = wcfg(); if (!c.card || !window.Vault.get()) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    var now = new Date(), k = Fe.dkey(now), w = wDay(k, c), p = Math.min(1, w.n / c.goal), R = 34, C = 2 * Math.PI * R, l = (w.n * c.ml / 1000);
    var week = [], hit = 0;
    for (var i = 6; i >= 0; i--) { var d = new Date(now); d.setDate(d.getDate() - i); var dk = Fe.dkey(d), x = wDay(dk, c); if (x.n >= c.goal) hit++; week.push({ k: dk, n: x.n, lab: d.toLocaleDateString('en-GB', { weekday: 'short' }) }); }
    var max = Math.max(c.goal, Math.max.apply(null, week.map(function (x) { return x.n; })));
    el.innerHTML = '<section class="card kit-card wt-card" id="hwater"><div class="card-head"><h2><i class="bi bi-cup-straw"></i> Drinking water</h2><a class="text-btn" href="../?settings=health" aria-label="Settings" data-t-aria-label="ui.settings"><i class="bi bi-sliders"></i></a></div>' +
      '<div class="wt-top"><svg class="wt-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="' + R + '" class="t"/><circle cx="40" cy="40" r="' + R + '" class="v" stroke-dasharray="' + (C * p).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg>' +
      '<div class="wt-num"><b>' + w.n + '<small>/' + c.goal + '</small></b><span>' + (w.n >= c.goal ? 'Goal reached' : (c.goal - w.n) + ' to go') + '</span><small class="muted">' + esc(l.toFixed(1).replace('.', ',')) + ' l · ' + c.ml + ' ml a glass' + (w.apple ? ' · from Apple Health' : '') + '</small></div>' +
      '<div class="wt-btns"><button type="button" class="pill-btn wt-add" data-wtadd="1"><i class="bi bi-plus-lg"></i> Glass</button><button type="button" class="text-btn" data-wtadd="-1"' + (w.n ? '' : ' disabled') + ' aria-label="One glass less"><i class="bi bi-dash-lg"></i></button></div></div>' +
      '<div class="wt-week" aria-label="Last 7 days" data-t-aria-label="ui.last-7-days">' + week.map(function (x) { return '<span class="wt-d' + (x.n >= c.goal ? ' ok' : '') + (x.k === k ? ' now' : '') + '" title="' + x.n + ' glasses"><i style="height:' + Math.max(4, Math.round(x.n / max * 100)) + '%"></i><small>' + esc(x.lab) + '</small></span>'; }).join('') + '</div>' +
      '<p class="muted hl-small">' + hit + ' of 7 days on target · the chip on Home counts here too</p></section>';
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-wtadd]'); if (b && !b.disabled) { e.preventDefault(); wAdd(+b.dataset.wtadd); } });
  if ($t('hwater')) { ['tools:change', 'health:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(drawWater, 20); }); }); window.Vault.onUnlock(function () { setTimeout(drawWater, 80); }); setTimeout(drawWater, 0); }

  /* ================= settings: under Health and People ================= */
  function sel(attr, v0, label, opts, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><select class="st-select" ' + attr + '>' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(v0) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
  function fill(page) {
    if (page === 'health') {
      var b = document.getElementById('hpSet2'); if (!b || b.contains(document.activeElement)) return;
      var gc = gcfg(), DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      b.innerHTML = '<p class="st-sub ap-sub"><i class="bi bi-bag-check"></i> Gym bag</p><div class="st-group"><div class="st-row gb-days"><span>Gym days<small class="st-rsub" data-t="ui.a-packing-list-in-at-a-glance-those-morn">A packing list in At a glance those mornings</small></span><span class="gb-dd">' + DN.map(function (n, i) { return '<button type="button" data-gbday="' + i + '" aria-pressed="' + (gc.days.indexOf(i) > -1) + '">' + n + '</button>'; }).join('') + '</span></div>' +
        '<label class="st-row"><span data-t="ui.in-the-bag">In the bag</span><input class="st-input" data-gbbag value="' + esc(gc.bag) + '" maxlength="160"></label></div>' +
        (function () { var rc = Fe.tools().ringcfg || {}; return '<p class="st-sub ap-sub"><i class="bi bi-circle"></i> Rings on Home</p><div class="st-group"><label class="st-row"><span>Steps and water rings<small class="st-rsub" data-t="ui.small-rings-in-the-chips-at-the-top-of-h">Small rings in the chips at the top of Home that fill during the day</small></span><input type="checkbox" class="switch" data-ringcfg="on"' + (rc.on !== false ? ' checked' : '') + '></label>' +
          '<label class="st-row"><span>Water<small class="st-rsub" data-t="ui.tap-the-chip-for-each-glass">Tap the chip for each glass</small></span><input type="checkbox" class="switch" data-ringcfg="water"' + (rc.water !== false ? ' checked' : '') + '></label>' +
          sel('data-ringcfg="waterGoal"', rc.waterGoal || 8, 'Glasses a day', [[6, '6'], [8, '8'], [10, '10'], [12, '12']]) +
          sel('data-ringcfg="glass"', rc.glass || 250, 'Glass size', [[150, '150 ml'], [200, '200 ml'], [250, '250 ml'], [330, '330 ml'], [500, '500 ml']], 'For litres, and for water from Apple Health') +
          '<label class="st-row"><span>Water card on Health<small class="st-rsub" data-t="ui.add-glasses-todays-ring-and-the-last-7-d">Add glasses, today’s ring and the last 7 days</small></span><input type="checkbox" class="switch" data-ringcfg="card"' + (rc.card !== false ? ' checked' : '') + '></label></div>'; })() +
        '<p class="st-sub ap-sub"><i class="bi bi-fire"></i> Streaks</p><div class="st-group"><label class="st-row"><span>Streaks in At a glance<small class="st-rsub" data-t="ui.late-in-the-week-when-one-is-about-to-br">Late in the week when one is about to break, and every 4 weeks in a row</small></span><input type="checkbox" class="switch" data-lmcfg="healthcfg:streakBrief"' + (hcfg().streakBrief ? ' checked' : '') + '></label></div>';
    }
    if (page === 'people') {
      var p = document.getElementById('hlSet-people2'); if (!p || p.contains(document.activeElement)) return;
      p.innerHTML = '<p class="st-sub ap-sub"><i class="bi bi-gift"></i> Birthday gifts</p><div class="st-group">' + sel('data-lmcfg="peoplecfg:giftLead"', pcfg().giftLead, 'Remind me to find a gift', [[0, 'Don’t'], [7, 'A week before'], [14, '2 weeks before'], [21, '3 weeks before'], [30, 'A month before']], 'With their gift ideas – until you note a gift for them') + '</div>';
    }
  }
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-lmcfg]'); if (!i) return;
    var q = i.dataset.lmcfg.split(':'), t = Fe.tools(); t[q[0]] = Object.assign({}, t[q[0]] || {}); t[q[0]][q[1]] = i.type === 'checkbox' ? i.checked : +i.value; Fe.saveTools(t);
    toast('<i class="bi bi-check2"></i> Saved');
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-gbday]'); if (!b) return;
    var t = Fe.tools(), c = Object.assign({}, t.healthcfg || {}), l = Array.isArray(c.gymDays) ? c.gymDays.slice() : [], i = +b.dataset.gbday, at = l.indexOf(i);
    if (at > -1) l.splice(at, 1); else l.push(i); c.gymDays = l.sort(); t.healthcfg = c; Fe.saveTools(t); b.setAttribute('aria-pressed', String(at < 0));
  });
  document.addEventListener('change', function (e) {
    var r = e.target.closest('[data-ringcfg]'); if (!r) return;
    var t = Fe.tools(); t.ringcfg = Object.assign({}, t.ringcfg || {}); t.ringcfg[r.dataset.ringcfg] = r.type === 'checkbox' ? r.checked : +r.value; Fe.saveTools(t); toast('<i class="bi bi-check2"></i> Saved');
  });
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-gbbag]'); if (!i) return;
    var t = Fe.tools(); t.healthcfg = Object.assign({}, t.healthcfg || {}, { gymBag: i.value.trim() }); Fe.saveTools(t); toast('<i class="bi bi-check2"></i> Saved');
  });
  window.addEventListener('st:page', function (e) { setTimeout(function () { fill(e.detail); }, 0); });
})();
