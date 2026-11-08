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
        wl ? { act: { id: 'gw:' + p.id + ':' + y, label: 'Wishlist' }, run: function () {
          var t = Fe.tools(); t.wishes = (Array.isArray(t.wishes) ? t.wishes : []).concat([{ id: Date.now().toString(36), title: ideas[0] + ' – ' + p.name, for: 'gift', prio: 1, price: +c.gbBday || '', added: dkey(new Date()), notes: 'For ' + p.name + '’s birthday ' + b.next }]); Fe.saveTools(t);
          toast('<i class="bi bi-stars"></i> On the Wishlist');
        } } : undefined);
    });
  });

  /* ================= settings: under Health and People ================= */
  function sel(attr, v0, label, opts, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><select class="st-select" ' + attr + '>' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(v0) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
  function fill(page) {
    if (page === 'health') {
      var b = document.getElementById('hpSet2'); if (!b || b.contains(document.activeElement)) return;
      b.innerHTML = '<p class="st-sub ap-sub"><i class="bi bi-fire"></i> Streaks</p><div class="st-group"><label class="st-row"><span>Streaks in At a glance<small class="st-rsub">Late in the week when one is about to break, and every 4 weeks in a row</small></span><input type="checkbox" class="switch" data-lmcfg="healthcfg:streakBrief"' + (hcfg().streakBrief ? ' checked' : '') + '></label></div>';
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
  window.addEventListener('st:page', function (e) { setTimeout(function () { fill(e.detail); }, 0); });
})();
