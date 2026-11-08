/* Wishlist (/cmd/wish/): things you'd like to buy – for the home, for you, as a gift – with price, link and
   priority, and whether it fits this month; a "To buy" list for the small things (hooks, light bulbs –
   the grocery list stays on Food); and what you've bought, which can go straight into Home inventory,
   Finances or Shared home.
   Updates itself: "fits this month" follows your budget, a new wish waits a few days before it nags
   ("still want it?"), and wishes that have sat on the list a long time are flagged.
   Data in dash.tools: wishes [{id,title,price,link,prio,for,room,cat,notes,added}],
                       wbought [{…wish, bought, paid, inv?, exp?}], wbuy [{id,title,where,qty,added}],
                       wishcfg (Settings → Pages → Wishlist). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, K = window.Kit || null;
  var PAGE = /\/cmd\/wish\/$/.test(location.pathname);
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var x = parseFloat(String(v == null ? '' : v).replace(/[\s kr]/gi, '').replace(',', '.')); return isFinite(x) ? x : null; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var dkey = Fe.dkey, fromKey = Fe.fromKey;
  function today() { return dkey(new Date()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function daysSince(k) { return isKey(k) ? Math.round((fromKey(today()) - fromKey(k)) / 864e5) : 0; }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function fmt(k, o) { return fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(+n || 0)) + ' kr'; }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function chip(t, c) { return '<span class="hl-chip" style="--c:' + c + '">' + t + '</span>'; }
  function on() { return Fe.on('wish'); }
  var RED = '#e66767', AMBER = '#c98500', GREEN = '#22b35e', BLUE = '#3987e5', PURPLE = '#8a6fdf', GREY = '#7a8794';

  var DEF = { share: 50, aside: 0, cool: 7, stale: 90, toFin: true, toInv: true, brief: true, sort: 'prio', clearBuy: true };
  function cfg() { var c = Fe.tools().wishcfg; return Object.assign({}, DEF, c && typeof c === 'object' ? c : {}); }
  function setCfg(p) { var t = Fe.tools(); t.wishcfg = Object.assign({}, t.wishcfg || {}, p); Fe.saveTools(t); }

  var PRIO = [[1, 'Need it', RED], [2, 'Would like it', AMBER], [3, 'Some day', GREY]];
  var FOR = [['home', 'For the home', 'house-heart', BLUE], ['me', 'For me', 'person', PURPLE], ['gift', 'A gift', 'gift', '#d55181'], ['other', 'Something else', 'bag', GREY]];
  var ROOMS = [['', 'No room'], ['living', 'Living room'], ['kitchen', 'Kitchen'], ['bedroom', 'Bedroom'], ['office', 'Office'], ['bathroom', 'Bathroom'], ['hall', 'Hall'], ['storage', 'Storage or attic'], ['outdoor', 'Outdoors'], ['other', 'Other']];
  var CATS = [['furniture', 'Furniture'], ['appliance', 'Appliance'], ['electronics', 'Electronics'], ['kitchen', 'Kitchen things'], ['decor', 'Decor and textiles'], ['tools', 'Tools'], ['sport', 'Bikes and sport'], ['clothes', 'Clothes'], ['other', 'Other']];
  function prioOf(p) { return PRIO.filter(function (x) { return x[0] === +p; })[0] || PRIO[1]; }
  function forOf(f) { return FOR.filter(function (x) { return x[0] === f; })[0] || FOR[3]; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function safeUrl(u) { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; try { return new URL(u).href; } catch (e) { return ''; } }

  /* ---------- does it fit? what's left this period after bills and spending so far ---------- */
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
  function cooling(w) { var c = +cfg().cool || 0; return c && isKey(w.added) && daysSince(w.added) < c ? addDays(w.added, c) : null; }

  /* ---------- the wish form ---------- */
  var WF = { key: 'wishes', addTitle: 'New wish', editTitle: 'Edit wish', fields: [
    { k: 'title', type: 'title', label: 'What', ph: 'e.g. Bed frame, coffee machine, rain jacket', req: true },
    { k: 'price', label: 'Price', type: 'number', suffix: 'kr' },
    { k: 'link', label: 'Link', ph: 'https://…', help: 'Where you found it – opens from the wish.' },
    { k: 'prio', label: 'How much do you want it', type: 'select', options: PRIO.map(function (p) { return [p[0], p[1]]; }), def: 2 },
    { k: 'for', label: 'For', type: 'select', options: FOR.map(function (f) { return [f[0], f[1]]; }), def: 'home' },
    { k: 'room', label: 'Room', type: 'select', options: ROOMS, def: '', help: 'For the home – goes with it into Home inventory when you buy it.' },
    { k: 'cat', label: 'Kind', type: 'select', options: CATS, def: 'furniture' },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, ph: 'Size, colour, which model …' }],
    beforeSave: function (it, isNew) { if (isNew || !isKey(it.added)) it.added = today(); it.link = safeUrl(it.link); if (it.price === '') delete it.price; }
  };
  function sorter() {
    var s = cfg().sort;
    return function (a, b) {
      if (s === 'price') return (+a.price || 0) - (+b.price || 0);
      if (s === 'added') return a.added < b.added ? 1 : -1;
      return (+a.prio || 2) - (+b.prio || 2) || (+a.price || 0) - (+b.price || 0);
    };
  }

  var wishCol = K && $t('wishes') ? K.collection({
    mount: $t('wishes'), feature: 'wish', key: 'wishes', icon: 'stars', title: 'Wishes', addLabel: 'Add', limit: 12,
    addTitle: WF.addTitle, editTitle: WF.editTitle, fields: WF.fields, beforeSave: WF.beforeSave,
    headExtra: function () { return '<a class="text-btn" href="/cmd/?settings=wish" aria-label="Settings"><i class="bi bi-sliders"></i> Settings</a>'; },
    empty: 'Things you’d like to buy – for the home, for you, or as a gift. Add the price and you see whether it fits this month.',
    sort: function (a, b) { return sorter()(a, b); },
    summary: function (l) {
      if (!l.length) return '';
      var total = l.reduce(function (a, w) { return a + (+w.price || 0); }, 0), r = room(), fits = l.filter(function (w) { var f = fit(w, r); return f && f.now; }).length;
      return '<span>' + l.length + (l.length === 1 ? ' wish' : ' wishes') + (total ? ' · ' + kr(total) + ' in all' : '') + '</span>' + (r ? '<span>' + fits + ' fit this month · ' + kr(r.left) + ' left until payday</span>' : '');
    },
    row: function (w) {
      var p = prioOf(w.prio), f = forOf(w.for), fi = fit(w), cool = cooling(w), old = (+cfg().stale || 0) && daysSince(w.added) >= +cfg().stale;
      var sub = [p[1], w.price ? kr(w.price) : '', host(w.link)].filter(Boolean).join(' · ');
      return { icon: f[2], color: f[3], title: w.title, sub: esc(sub) + (old ? ' · <span class="hl-warn">on the list ' + daysSince(w.added) + ' days</span>' : ''),
        right: cool ? chip('Wait until ' + fmt(cool), GREY) : fi ? chip(fi.t, fi.c) : '' };
    },
    detail: function (w) {
      var fi = fit(w), cool = cooling(w), u = safeUrl(w.link);
      return (w.notes ? '<p class="kit-notes">' + esc(w.notes) + '</p>' : '') +
        '<p class="muted hl-small">Added ' + (isKey(w.added) ? esc(fmt(w.added, { day: 'numeric', month: 'short', year: 'numeric' })) : '') + (cool ? ' · think it over until ' + esc(fmt(cool)) : '') + (fi && !fi.now && fi.m ? ' · with ' + kr(cfg().aside) + ' put aside a month: ' + esc(fi.t.toLowerCase()) : '') + '</p>' +
        '<div class="hl-acts"><button type="button" class="pill-btn" data-wbought="' + esc(w.id) + '"><i class="bi bi-bag-check"></i> Bought it</button>' +
        (u ? '<a class="text-btn" href="' + esc(u) + '" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Open the link</a>' : '') +
        (window.FinAfford ? '<button type="button" class="text-btn" data-wafford="' + esc(w.id) + '"><i class="bi bi-calculator"></i> Can I afford it?</button>' : '') + '</div>';
    },
    onClick: function (e) {
      var b = e.target.closest('[data-wbought]'); if (b) { boughtSheet(b.dataset.wbought); return; }
      var a = e.target.closest('[data-wafford]'); if (a) { var w = byId('wishes', a.dataset.wafford); if (w && window.FinAfford) window.FinAfford.open(+w.price || 0, w.title); }
    }
  }) : null;
  function byId(key, id) { return Fe.list(key).filter(function (x) { return x.id === id; })[0]; }

  /* ---------- "Bought it": what you paid, and where it should go ---------- */
  function partner() { var S = window.Shared; return S && S.partner ? S.partner() : null; }
  function boughtSheet(id) {
    var w = byId('wishes', id); if (!w) return;
    var c = cfg(), p = partner(), homeOn = Fe.on('house'), isHome = w.for === 'home';
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<form class="fo-box lf-box hl-box" role="dialog" aria-modal="true" aria-label="Bought it"><div class="lf-head"><h3><i class="bi bi-bag-check"></i> ' + esc(w.title) + '</h3><button type="button" class="icon-btn sm" data-x aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' +
      '<div class="mp-grid"><label><span>Paid, kr</span><input name="paid" inputmode="decimal" value="' + (w.price ? esc(String(w.price)) : '') + '" autocomplete="off"></label><label><span>When</span><input name="date" type="date" value="' + today() + '"></label></div>' +
      (homeOn ? '<label class="lf-check"><input type="checkbox" name="inv"' + (isHome && c.toInv ? ' checked' : '') + '> Add to Home inventory <small class="muted">(add the receipt there)</small></label>' : '') +
      (p && isHome ? '<label class="lf-check"><input type="checkbox" name="shared"> Bought together with ' + esc(p.name) + ' <small class="muted">(split in Shared home)</small></label>' : '') +
      '<label class="lf-check"><input type="checkbox" name="fin"' + (c.toFin ? ' checked' : '') + '> Add to Finances as spending</label>' +
      '<div class="lf-foot"><span class="spacer"></span><button type="submit" class="pill-btn wide"><i class="bi bi-check2"></i> Bought</button></div></form>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var close = function () { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 180); };
    var f = bg.querySelector('form');
    if (f.shared) f.shared.addEventListener('change', function () { if (f.shared.checked) f.fin.checked = false; });
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-x]')) close(); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var paid = num(f.paid.value), date = isKey(f.date.value) ? f.date.value : today();
      var old = JSON.parse(JSON.stringify({ w: Fe.tools().wishes || [], b: Fe.tools().wbought || [], inv: Fe.tools().hinv || [] }));
      var t = Fe.tools(), rec = Object.assign({}, w, { bought: date, paid: paid != null ? paid : (+w.price || 0) });
      t.wishes = (t.wishes || []).filter(function (x) { return x.id !== w.id; });
      if (f.inv && f.inv.checked) {
        var invId = uid();
        t.hinv = Array.isArray(t.hinv) ? t.hinv : [];
        t.hinv.push({ id: invId, name: w.title, room: w.room || 'other', cat: ({ kitchen: 'appliance', decor: 'furniture', tools: 'other', clothes: 'other' })[w.cat] || w.cat || 'other', price: rec.paid, bought: date, notes: w.notes || '' });
        rec.inv = invId;
      }
      t.wbought = (Array.isArray(t.wbought) ? t.wbought : []).concat([rec]);
      Fe.saveTools(t);
      var expId = null;
      if (f.fin.checked && rec.paid > 0) {
        var d = window.Vault.get();
        if (d) { expId = 'wb' + uid(); d.expenses = d.expenses || []; d.expenses.push({ id: expId, t: Date.now(), date: date, amount: rec.paid, cat: w.for === 'home' ? 'home' : 'shopping', note: w.title }); window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
        if (expId) { var t2 = Fe.tools(); (t2.wbought || []).forEach(function (x) { if (x.id === w.id) x.exp = expId; }); Fe.saveTools(t2); }
      }
      close();
      if (f.shared && f.shared.checked && window.SharedHome && window.SharedHome.buy) setTimeout(function () { window.SharedHome.buy({ note: w.title, price: rec.paid, date: date, inv: rec.inv }); }, 220);
      toast('<i class="bi bi-bag-check"></i> ' + esc(w.title) + ' bought' + (rec.inv ? ' – in Home inventory' : ''), function () {
        var t3 = Fe.tools(); t3.wishes = old.w; t3.wbought = old.b; t3.hinv = old.inv; Fe.saveTools(t3);
        if (expId) { var d3 = window.Vault.get(); if (d3) { d3.expenses = (d3.expenses || []).filter(function (x) { return x.id !== expId; }); window.Vault.save(d3); window.dispatchEvent(new Event('fin:change')); } }
      });
    });
    setTimeout(function () { if (!matchMedia('(pointer: coarse)').matches) f.paid.focus(); }, 60);
  }

  /* ---------- To buy: the small things (not food – that's on Food) ---------- */
  var buyCol = K && $t('wbuy') ? K.collection({
    mount: $t('wbuy'), feature: 'wish', key: 'wbuy', icon: 'cart-check', title: 'To buy', addLabel: 'Add', limit: 15,
    addTitle: 'Something to buy', editTitle: 'Edit', fields: [
      { k: 'title', type: 'title', label: 'What', ph: 'e.g. Picture hooks, light bulbs E27', req: true },
      { k: 'where', label: 'Where', ph: 'e.g. Clas Ohlson, Jula, IKEA' },
      { k: 'qty', label: 'How many', ph: 'e.g. 2' }],
    beforeSave: function (it, isNew) { if (isNew) it.added = today(); },
    empty: 'Small things you need next time you’re out – hooks, batteries, a doormat. Groceries go on the shopping list on Food.',
    above: function () { return '<form class="wb-quick" data-wbquick><input name="q" placeholder="Add something to buy …" autocomplete="off" aria-label="Add something to buy" maxlength="80"><button type="submit" class="icon-btn sm" aria-label="Add"><i class="bi bi-plus-lg"></i></button></form>'; },
    sort: function (a, b) { return String(a.where || '~').localeCompare(String(b.where || '~')) || (a.added < b.added ? -1 : 1); },
    row: function (x) { return { icon: 'circle', color: GREY, title: x.title + (x.qty ? ' × ' + x.qty : ''), sub: esc(x.where || ''), right: '<span class="wb-got" data-wbgot="' + esc(x.id) + '" role="button" tabindex="0" aria-label="Got it"><i class="bi bi-check-lg"></i></span>' }; },
    onClick: function (e) { var g = e.target.closest('[data-wbgot]'); if (g) { e.stopPropagation(); got(g.dataset.wbgot); } }
  }) : null;
  function got(id) {
    var old = (Fe.tools().wbuy || []).slice(), it = byId('wbuy', id); if (!it) return;
    var t = Fe.tools(); t.wbuy = (t.wbuy || []).filter(function (x) { return x.id !== id; }); Fe.saveTools(t);
    toast('<i class="bi bi-check2"></i> Got ' + esc(it.title), function () { var t2 = Fe.tools(); t2.wbuy = old; Fe.saveTools(t2); });
  }
  /* tap the tick before Kit opens the edit form */
  document.addEventListener('click', function (e) { var g = e.target.closest('[data-wbgot]'); if (g) { e.preventDefault(); e.stopPropagation(); got(g.dataset.wbgot); } }, true);
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-wbquick]'); if (!f) return; e.preventDefault();
    var v = f.q.value.trim(); if (!v) return;
    var m = v.match(/^(.*?)(?:\s+(?:x|×)\s*(\d+))?(?:\s+(?:fra|from|@)\s+(.+))?$/i) || [v, v];
    var t = Fe.tools(); t.wbuy = (Array.isArray(t.wbuy) ? t.wbuy : []).concat([{ id: uid(), title: (m[1] || v).trim(), qty: m[2] || '', where: (m[3] || '').trim(), added: today() }]); Fe.saveTools(t);
    setTimeout(function () { var i = document.querySelector('[data-wbquick] input'); if (i) i.focus(); }, 30);
  });

  /* ---------- Bought ---------- */
  var boughtCol = K && $t('wbought') ? K.collection({
    mount: $t('wbought'), feature: 'wish', key: 'wbought', icon: 'bag-check', title: 'Bought', addLabel: 'Add', limit: 6,
    addTitle: 'Something you bought', editTitle: 'Edit', fields: [
      { k: 'title', type: 'title', label: 'What', req: true }, { k: 'paid', label: 'Paid', type: 'number', suffix: 'kr' }, { k: 'bought', label: 'When', type: 'date', def: today }],
    empty: 'What you buy from your wishes ends up here – with what you paid.',
    sort: function (a, b) { return a.bought < b.bought ? 1 : -1; },
    summary: function (l) { var y = String(new Date().getFullYear()), s = l.filter(function (x) { return String(x.bought || '').slice(0, 4) === y; }); return s.length ? '<span>' + s.length + ' bought in ' + y + ' · ' + kr(s.reduce(function (a, x) { return a + (+x.paid || 0); }, 0)) + '</span>' : ''; },
    row: function (x) { var f = forOf(x.for); return { icon: f[2], color: f[3], title: x.title, sub: esc([isKey(x.bought) ? fmt(x.bought, { day: 'numeric', month: 'short', year: 'numeric' }) : '', x.inv ? 'in Home inventory' : '', x.exp ? 'in Finances' : ''].filter(Boolean).join(' · ')), right: x.paid ? '<span class="money">' + esc(kr(x.paid)) + '</span>' : '' }; },
    detail: function (x) { return (x.inv ? '<a class="text-btn" href="/cmd/house/#hinv=' + esc(x.inv) + '"><i class="bi bi-box-seam"></i> Open in Home inventory</a>' : '') + '<button type="button" class="text-btn" data-wback="' + esc(x.id) + '"><i class="bi bi-arrow-counterclockwise"></i> Back on the wishlist</button>'; },
    onClick: function (e) {
      var b = e.target.closest('[data-wback]'); if (!b) return;
      var t = Fe.tools(), x = (t.wbought || []).filter(function (z) { return z.id === b.dataset.wback; })[0]; if (!x) return;
      t.wbought = t.wbought.filter(function (z) { return z.id !== x.id; });
      var w = Object.assign({}, x); delete w.bought; delete w.paid; delete w.inv; delete w.exp;
      t.wishes = (t.wishes || []).concat([w]); Fe.saveTools(t); toast('<i class="bi bi-stars"></i> Back on the wishlist');
    }
  }) : null;

  /* ---------- the numbers at the top ---------- */
  function tile(icon, label, val, sub, href, c) { return '<a class="fp-tile hl-tile" href="' + href + '" style="--c:' + c + '"><div class="lbl"><i class="bi bi-' + icon + '"></i>' + label + '</div><div class="val">' + val + '</div><div class="sub">' + (sub || '&nbsp;') + '</div></a>'; }
  function hero() {
    var el = document.getElementById('wsTiles'); if (!el) return;
    if (!on()) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    var l = Fe.list('wishes'), r = room(), fits = l.filter(function (w) { var f = fit(w, r); return f && f.now; }), total = l.reduce(function (a, w) { return a + (+w.price || 0); }, 0);
    var y = String(new Date().getFullYear()), by = Fe.list('wbought').filter(function (x) { return String(x.bought || '').slice(0, 4) === y; });
    var h = tile('stars', 'Wishes', l.length, total ? kr(total) : 'none yet', '#wishes', PURPLE) +
      tile('check2-circle', 'Fit this month', fits.length, r ? kr(r.left) + ' left until payday' : 'add your budget in Finances', '#wishes', GREEN) +
      tile('cart-check', 'To buy', Fe.list('wbuy').length, 'small things', '#wbuy', BLUE) +
      tile('bag-check', 'Bought in ' + y, kr(by.reduce(function (a, x) { return a + (+x.paid || 0); }, 0)), by.length + (by.length === 1 ? ' thing' : ' things'), '#wbought', AMBER);
    if (el.innerHTML !== h) el.innerHTML = h;
  }
  if (PAGE) {
    ['tools:change', 'features:change', 'fin:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(hero.t); hero.t = setTimeout(hero, 30); }); });
    window.addEventListener('fin:change', function () { if (wishCol) wishCol.render(); });
    window.Vault.onUnlock(hero);
    var pgEmpty = function () { var e = document.querySelector('[data-pgempty="wish"]'); if (e) e.hidden = on(); };
    pgEmpty(); window.addEventListener('features:change', pgEmpty); window.Vault.onUnlock(pgEmpty);
  }

  /* ---------- At a glance: a wish that's done waiting, one that's been there for ages ---------- */
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!on() || !cfg().brief) return;
    var c = cfg(), l = Fe.list('wishes');
    var ready = l.filter(function (w) { return +c.cool && isKey(w.added) && daysSince(w.added) === +c.cool; })[0];
    if (ready) add(62, 'stars', PURPLE, 'Still want ' + ready.title + '?', 'It’s been ' + c.cool + ' days' + (ready.price ? ' · ' + kr(ready.price) : ''), '/cmd/wish/#wishes=' + ready.id);
    var stale = +c.stale ? l.filter(function (w) { return daysSince(w.added) >= +c.stale && daysSince(w.added) % 30 === 0; })[0] : null;
    if (stale) add(70, 'hourglass-split', GREY, stale.title + ' has been on your wishlist ' + daysSince(stale.added) + ' days', 'Buy it, or let it go', '/cmd/wish/#wishes=' + stale.id);
  });
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    if (!on()) return;
    Fe.list('wishes').forEach(function (w) { add('Wishlist', 'stars', w.title, [w.price ? kr(w.price) : '', prioOf(w.prio)[1]].filter(Boolean).join(' · '), '/cmd/wish/#wishes=' + w.id); });
    Fe.list('wbuy').forEach(function (x) { add('To buy', 'cart-check', x.title, x.where || '', '/cmd/wish/#wbuy'); });
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() ? [{ i: 'stars', t: 'New wish', s: 'Wishlist', run: function () { if (K && $t('wishes')) K.edit(WF, null); else location.href = '/cmd/wish/#wishes'; }, x: 'wish wishlist ønske ønskeliste kjøpe' }] : [];
  });

  /* ---------- Settings → Pages → Wishlist ---------- */
  (function () {
    function sel(f, label, opts, sub) { var v = String(cfg()[f]); return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><select class="st-select" data-wscfg="' + f + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
    function sw(f, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-wscfg="' + f + '"' + (cfg()[f] ? ' checked' : '') + '></label>'; }
    function numIn(f, label, unit, sub) { var v = cfg()[f]; return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><span class="st-unit"><input class="st-input st-num" inputmode="decimal" data-wscfg="' + f + '" value="' + (v ? esc(String(v)) : '') + '" placeholder="0">' + (unit ? '<span>' + esc(unit) + '</span>' : '') + '</span></label>'; }
    function sub(icon, t) { return '<p class="st-sub ap-sub"><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</p>'; }
    function fill() {
      var box = document.getElementById('hlSet-wish'); if (!box || box.contains(document.activeElement)) return;
      box.innerHTML = '<p class="st-intro">How the wishlist decides what fits, when it reminds you, and where bought things go.</p>' +
        sub('wallet2', 'Does it fit?') + '<div class="st-group">' + sel('share', 'Count as fitting when it costs up to', [[25, '25 % of what’s left this month'], [50, '50 % of what’s left'], [75, '75 % of what’s left'], [100, 'All of what’s left']], 'What’s left = salary − bills − spending so far, until payday') +
        numIn('aside', 'You put aside for wishes', 'kr / month', 'Shows “in 3 months” for the ones that don’t fit now') + '</div>' +
        sub('hourglass-split', 'Thinking it over') + '<div class="st-group">' + sel('cool', 'New wishes wait', [[0, 'Don’t wait'], [3, '3 days'], [7, 'A week'], [14, '2 weeks'], [30, '30 days']], 'Then At a glance asks if you still want it') +
        sel('stale', 'Flag wishes on the list longer than', [[0, 'Never'], [60, '2 months'], [90, '3 months'], [180, '6 months'], [365, 'A year']]) + sw('brief', 'Wishlist in At a glance') + '</div>' +
        sub('bag-check', 'When you buy something') + '<div class="st-group">' + sw('toInv', 'Things for the home go into Home inventory', 'Ticked in “Bought it” – you can untick it there') + sw('toFin', 'Add it to Finances as spending', 'Unless you split it in Shared home') + '</div>' +
        sub('sort-down', 'Order') + '<div class="st-group">' + sel('sort', 'Wishes', [['prio', 'Most wanted first'], ['price', 'Cheapest first'], ['added', 'Newest first']]) + '</div>' +
        '<div class="st-group"><a class="st-row st-btn" href="/cmd/wish/"><span><i class="bi bi-stars"></i> Open Wishlist</span><i class="bi bi-chevron-right"></i></a><a class="st-row st-btn" href="/cmd/wish/?customize"><span><i class="bi bi-grid-1x2"></i> Order and hide cards</span><i class="bi bi-chevron-right"></i></a></div>';
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

  window.Wish = { fit: fit, room: room, cfg: cfg, add: function () { if (K) K.edit(WF, null); } };
})();
