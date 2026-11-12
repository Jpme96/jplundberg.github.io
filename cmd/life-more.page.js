/* Small things that keep themselves going (Nov 2026):
   · Habit streaks – weeks in a row on target (the flame on Home's Habits card is delight.js); At a glance warns late in the week
     when a streak is about to break, and cheers at 4, 8, 12 … weeks.
   · Birthday gifts – two weeks before a birthday (Settings → People), At a glance reminds you to find a gift,
     with the person's gift ideas and your budget; one tap puts the idea on the Wishlist.
   Settings: healthcfg.streakBrief (Settings → Health), peoplecfg.giftLead (Settings → People). */
/* The page part of life-more.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is life-more.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["lifemore"]; if (!__c) return;
  var Fe = __c.Fe, toast = __c.toast, esc = __c.esc;
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
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
})();
