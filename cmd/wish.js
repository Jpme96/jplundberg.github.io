/* Wishlist (/cmd/wish/): things you'd like to buy – for the home, for you, as a gift – with price, link and
   priority, and whether it fits this month; a "To buy" list for the small things (hooks, light bulbs –
   the grocery list stays on Food); and what you've bought, which can go straight into Home inventory,
   Finances or Shared home.
   Updates itself: "fits this month" follows your budget, a new wish waits a few days before it nags
   ("still want it?"), and wishes that have sat on the list a long time are flagged.
   Data in dash.tools: wishes [{id,title,price,link,prio,for,room,cat,notes,added}],
                       wbought [{…wish, bought, paid, inv?, exp?}], wbuy [{id,title,where,qty,added}],
                       wishcfg (Settings → Pages → Wishlist). */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in wish.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["wish"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var x = parseFloat(String(v == null ? '' : v).replace(/[\s kr]/gi, '').replace(',', '.')); return isFinite(x) ? x : null; }
  var dkey = Fe.dkey;
  var fromKey = Fe.fromKey;
  function today() { return dkey(new Date()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function daysSince(k) { return isKey(k) ? Math.round((fromKey(today()) - fromKey(k)) / 864e5) : 0; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(+n || 0)) + ' kr'; }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function on() { return Fe.on('wish'); }
  var RED = '#e66767';
  var AMBER = '#c98500';
  var GREEN = '#22b35e';
  var PURPLE = '#8a6fdf';
  var GREY = '#7a8794';
  var DEF = { share: 50, aside: 0, cool: 7, stale: 90, toFin: true, toInv: true, brief: true, sort: 'prio', clearBuy: true };
  function cfg() { var c = Fe.tools().wishcfg; return Object.assign({}, DEF, c && typeof c === 'object' ? c : {}); }
  function setCfg(p) { var t = Fe.tools(); t.wishcfg = Object.assign({}, t.wishcfg || {}, p); Fe.saveTools(t); }
  var PRIO = [[1, 'Need it', RED], [2, 'Would like it', AMBER], [3, 'Some day', GREY]];
  function prioOf(p) { return PRIO.filter(function (x) { return x[0] === +p; })[0] || PRIO[1]; }
  function room() {
    var d = window.Vault.get(), B = window.Budget; if (!d || !B || !d.budget) return null;
    try {
      var per = B.period(d), fixed = (d.budget.fixed || []).reduce(function (a, x) { return a + (+x.amount || 0); }, 0), spent = B.spent(d, per);
      if (!(per.income > 0)) return null;
      return { left: Math.max(0, per.income - fixed - spent), days: per.daysLeft };
    } catch (e) { return null; }
  }
  function fit(w, r) {
    var c = cfg(), p = +w.price || 0; if (!p) return null;
    r = r === undefined ? room() : r;
    if (r && p <= r.left * (+c.share || 50) / 100) return { now: true, t: 'Fits this month', c: GREEN };
    if (+c.aside > 0) { var m = Math.ceil(p / +c.aside); return { now: false, t: m <= 1 ? 'Next month' : 'In ' + m + ' months', c: m <= 3 ? AMBER : GREY, m: m }; }
    return r ? { now: false, t: 'Not this month', c: AMBER } : null;
  }
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!on() || !cfg().brief) return;
    var c = cfg(), l = Fe.list('wishes');
    var ready = l.filter(function (w) { return +c.cool && isKey(w.added) && daysSince(w.added) === +c.cool; })[0];
    if (ready) add(62, 'stars', PURPLE, 'Still want ' + ready.title + '?', 'It’s been ' + c.cool + ' days' + (ready.price ? ' · ' + kr(ready.price) : ''), '/cmd/wish/#wishes=' + ready.id);
    var stale = +c.stale ? l.filter(function (w) { return daysSince(w.added) >= +c.stale && daysSince(w.added) % 30 === 0; })[0] : null;
    if (stale) add(70, 'hourglass-split', GREY, stale.title + ' has been on your wishlist ' + daysSince(stale.added) + ' days', I18N.k('ui.buy-it-or-let-it-go', 'Buy it, or let it go'), '/cmd/wish/#wishes=' + stale.id);
  });
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    if (!on()) return;
    Fe.list('wishes').forEach(function (w) { add('Wishlist', 'stars', w.title, [w.price ? kr(w.price) : '', prioOf(w.prio)[1]].filter(Boolean).join(' · '), '/cmd/wish/#wishes=' + w.id); });
    Fe.list('wbuy').forEach(function (x) { add(I18N.k('ui.to-buy', 'To buy'), 'cart-check', x.title, x.where || '', '/cmd/wish/#wbuy'); });
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() ? [{ i: 'stars', t: 'New wish', s: 'Wishlist', run: function () { if (__ui().K && __ui().$t('wishes')) __ui().K.edit(__ui().WF, null); else location.href = '/cmd/wish/#wishes'; }, x: 'wish wishlist ønske ønskeliste kjøpe' }] : [];
  });
  (function () {
    function sel(f, label, opts, sub) { var v = String(cfg()[f]); return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><select class="st-select" data-wscfg="' + f + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
    function sw(f, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-wscfg="' + f + '"' + (cfg()[f] ? ' checked' : '') + '></label>'; }
    function numIn(f, label, unit, sub) { var v = cfg()[f]; return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><span class="st-unit"><input class="st-input st-num" inputmode="decimal" data-wscfg="' + f + '" value="' + (v ? esc(String(v)) : '') + '" placeholder="0">' + (unit ? '<span>' + esc(unit) + '</span>' : '') + '</span></label>'; }
    function sub(icon, t) { return '<p class="st-sub ap-sub"><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</p>'; }
    function fill() {
      var box = document.getElementById('hlSet-wish'); if (!box || box.contains(document.activeElement)) return;
      box.innerHTML = '<p class="st-intro" data-t="ui.how-the-wishlist-decides-what-fits-when">How the wishlist decides what fits, when it reminds you, and where bought things go.</p>' +
        sub('wallet2', I18N.k('ui.does-it-fit', 'Does it fit?')) + '<div class="st-group">' + sel('share', I18N.k('ui.count-as-fitting-when-it-costs-up-to', 'Count as fitting when it costs up to'), [[25, '25 % of what’s left this month'], [50, '50 % of what’s left'], [75, '75 % of what’s left'], [100, 'All of what’s left']], I18N.k('ui.whats-left-salary-bills-spending-so-far', 'What’s left = salary − bills − spending so far, until payday')) +
        numIn('aside', I18N.k('ui.you-put-aside-for-wishes', 'You put aside for wishes'), 'kr / month', I18N.k('ui.shows-in-3-months-for-the-ones-that-dont', 'Shows “in 3 months” for the ones that don’t fit now')) + '</div>' +
        sub('hourglass-split', I18N.k('ui.thinking-it-over', 'Thinking it over')) + '<div class="st-group">' + sel('cool', I18N.k('ui.new-wishes-wait', 'New wishes wait'), [[0, 'Don’t wait'], [3, '3 days'], [7, 'A week'], [14, '2 weeks'], [30, '30 days']], I18N.k('ui.then-at-a-glance-asks-if-you-still-want', 'Then At a glance asks if you still want it')) +
        sel('stale', I18N.k('ui.flag-wishes-on-the-list-longer-than', 'Flag wishes on the list longer than'), [[0, 'Never'], [60, '2 months'], [90, '3 months'], [180, '6 months'], [365, 'A year']]) + sw('brief', I18N.k('ui.wishlist-in-at-a-glance', 'Wishlist in At a glance')) + '</div>' +
        sub('bag-check', I18N.k('ui.when-you-buy-something', 'When you buy something')) + '<div class="st-group">' + sw('toInv', I18N.k('ui.things-for-the-home-go-into-home-invento', 'Things for the home go into Home inventory'), I18N.k('ui.ticked-in-bought-it-you-can-untick-it-th', 'Ticked in “Bought it” – you can untick it there')) + sw('toFin', I18N.k('ui.add-it-to-finances-as-spending', 'Add it to Finances as spending'), I18N.k('ui.unless-you-split-it-in-shared-home', 'Unless you split it in Shared home')) + '</div>' +
        sub('sort-down', 'Order') + '<div class="st-group">' + sel('sort', 'Wishes', [['prio', 'Most wanted first'], ['price', 'Cheapest first'], ['added', 'Newest first']]) + '</div>' +
        '<div class="st-group"><a class="st-row st-btn" href="/cmd/wish/"><span><i class="bi bi-stars"></i> <span data-t="ui.open-wishlist">Open Wishlist</span></span><i class="bi bi-chevron-right"></i></a><a class="st-row st-btn" href="/cmd/wish/?customize"><span><i class="bi bi-grid-1x2"></i> <span data-t="ui.order-and-hide-cards">Order and hide cards</span></span><i class="bi bi-chevron-right"></i></a></div>';
    }
    function summary() { var c = cfg(), r = document.getElementById('sum-wish'); if (r) r.textContent = 'Fits at ' + c.share + ' % of what’s left' + (+c.cool ? ' · waits ' + c.cool + ' days' : ''); var row = document.getElementById('stRow-wish'); if (row) row.hidden = !on(); var cu = document.querySelector('[data-hlcust="wish"]'); if (cu) cu.hidden = !on(); }
    document.addEventListener('change', function (e) {
      var i = e.target.closest('[data-wscfg]'); if (!i) return;
      var v = i.type === 'checkbox' ? i.checked : i.classList.contains('st-num') ? Math.max(0, num(i.value) || 0) : /^\d+$/.test(i.value) ? +i.value : i.value;
      var p = {}; p[i.dataset.wscfg] = v; setCfg(p); summary(); toast('<i class="bi bi-check2"></i> Saved');
    });
    window.addEventListener('st:page', function (e) { if (e.detail === 'wish') fill(); if (e.detail === 'home' || e.detail === 'layout') summary(); });
    ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, summary); });
    window.Vault.onUnlock(summary);
  })();
  window.Wish = { fit: fit, room: room, cfg: cfg };
  (window.__core = window.__core || {})["wish"] = { toast: toast, setCfg: setCfg, Fe: Fe, num: num, on: on, esc: esc, cfg: cfg, DEF: DEF, prioOf: prioOf, PRIO: PRIO, GREY: GREY, AMBER: AMBER, RED: RED, kr: kr, nf: nf, PURPLE: PURPLE, daysSince: daysSince, today: today, dkey: dkey, fromKey: fromKey, isKey: isKey, room: room, fit: fit, GREEN: GREEN };
})();
