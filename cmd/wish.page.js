/* Wishlist (/cmd/wish/): things you'd like to buy – for the home, for you, as a gift – with price, link and
   priority, and whether it fits this month; a "To buy" list for the small things (hooks, light bulbs –
   the grocery list stays on Food); and what you've bought, which can go straight into Home inventory,
   Finances or Shared home.
   Updates itself: "fits this month" follows your budget, a new wish waits a few days before it nags
   ("still want it?"), and wishes that have sat on the list a long time are flagged.
   Data in dash.tools: wishes [{id,title,price,link,prio,for,room,cat,notes,added}],
                       wbought [{…wish, bought, paid, inv?, exp?}], wbuy [{id,title,where,qty,added}],
                       wishcfg (Settings → Pages → Wishlist). */
/* The page part of wish.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is wish.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["wish"]; if (!__c) return;
  var fromKey = __c.fromKey, dkey = __c.dkey, PURPLE = __c.PURPLE, GREY = __c.GREY, cfg = __c.cfg, isKey = __c.isKey, daysSince = __c.daysSince, PRIO = __c.PRIO, today = __c.today, room = __c.room, fit = __c.fit, kr = __c.kr, prioOf = __c.prioOf, esc = __c.esc, Fe = __c.Fe, num = __c.num, toast = __c.toast, on = __c.on, GREEN = __c.GREEN, AMBER = __c.AMBER;
  var K = window.Kit || null;
  var PAGE = /\/cmd\/wish\/$/.test(location.pathname);
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function fmt(k, o) { return fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }); }
  function chip(t, c) { return '<span class="hl-chip" style="--c:' + c + '">' + t + '</span>'; }
  var BLUE = '#3987e5';
  var FOR = [['home', 'For the home', 'house-heart', BLUE], ['me', 'For me', 'person', PURPLE], ['gift', 'A gift', 'gift', '#d55181'], ['other', 'Something else', 'bag', GREY]];
  var ROOMS = [['', 'No room'], ['living', 'Living room'], ['kitchen', 'Kitchen'], ['bedroom', 'Bedroom'], ['office', 'Office'], ['bathroom', 'Bathroom'], ['hall', 'Hall'], ['storage', 'Storage or attic'], ['outdoor', 'Outdoors'], ['other', 'Other']];
  var CATS = [['furniture', 'Furniture'], ['appliance', 'Appliance'], ['electronics', 'Electronics'], ['kitchen', 'Kitchen things'], ['decor', 'Decor and textiles'], ['tools', 'Tools'], ['sport', 'Bikes and sport'], ['clothes', 'Clothes'], ['other', 'Other']];
  function forOf(f) { return FOR.filter(function (x) { return x[0] === f; })[0] || FOR[3]; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function safeUrl(u) { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; try { return new URL(u).href; } catch (e) { return ''; } }
  function cooling(w) { var c = +cfg().cool || 0; return c && isKey(w.added) && daysSince(w.added) < c ? addDays(w.added, c) : null; }
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
    headExtra: function () { return '<a class="text-btn" href="/cmd/?settings=wish" aria-label="Settings" data-t-aria-label="ui.settings"><i class="bi bi-sliders"></i> Settings</a>'; },
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
  function partner() { var S = window.Shared; return S && S.partner ? S.partner() : null; }
  function boughtSheet(id) {
    var w = byId('wishes', id); if (!w) return;
    var c = cfg(), p = partner(), homeOn = Fe.on('house'), isHome = w.for === 'home';
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<form class="fo-box lf-box hl-box" role="dialog" aria-modal="true" aria-label="Bought it" data-t-aria-label="ui.bought-it"><div class="lf-head"><h3><i class="bi bi-bag-check"></i> ' + esc(w.title) + '</h3><button type="button" class="icon-btn sm" data-x aria-label="Close" data-t-aria-label="ui.close"><i class="bi bi-x-lg"></i></button></div>' +
      '<div class="mp-grid"><label><span data-t="ui.paid-kr">Paid, kr</span><input name="paid" inputmode="decimal" value="' + (w.price ? esc(String(w.price)) : '') + '" autocomplete="off"></label><label><span data-t="ui.when">When</span><input name="date" type="date" value="' + today() + '"></label></div>' +
      (homeOn ? '<label class="lf-check"><input type="checkbox" name="inv"' + (isHome && c.toInv ? ' checked' : '') + '> Add to Home inventory <small class="muted" data-t="ui.add-the-receipt-there">(add the receipt there)</small></label>' : '') +
      (p && isHome ? '<label class="lf-check"><input type="checkbox" name="shared"> Bought together with ' + esc(p.name) + ' <small class="muted" data-t="ui.split-in-shared-home">(split in Shared home)</small></label>' : '') +
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
  var buyCol = K && $t('wbuy') ? K.collection({
    mount: $t('wbuy'), feature: 'wish', key: 'wbuy', icon: 'cart-check', title: 'To buy', addLabel: 'Add', limit: 15,
    addTitle: 'Something to buy', editTitle: 'Edit', fields: [
      { k: 'title', type: 'title', label: 'What', ph: 'e.g. Picture hooks, light bulbs E27', req: true },
      { k: 'where', label: 'Where', ph: 'e.g. Clas Ohlson, Jula, IKEA' },
      { k: 'qty', label: 'How many', ph: 'e.g. 2' }],
    beforeSave: function (it, isNew) { if (isNew) it.added = today(); },
    empty: 'Small things you need next time you’re out – hooks, batteries, a doormat. Groceries go on the shopping list on Food.',
    above: function () { return '<form class="wb-quick" data-wbquick><input name="q" placeholder="Add something to buy …" data-t-placeholder="ui.add-something-to-buy" autocomplete="off" aria-label="Add something to buy" maxlength="80"><button type="submit" class="icon-btn sm" aria-label="Add" data-t-aria-label="ui.add"><i class="bi bi-plus-lg"></i></button></form>'; },
    sort: function (a, b) { return String(a.where || '~').localeCompare(String(b.where || '~')) || (a.added < b.added ? -1 : 1); },
    row: function (x) { return { icon: 'circle', color: GREY, title: x.title + (x.qty ? ' × ' + x.qty : ''), sub: esc(x.where || ''), right: '<span class="wb-got" data-wbgot="' + esc(x.id) + '" role="button" tabindex="0" aria-label="Got it"><i class="bi bi-check-lg"></i></span>' }; },
    onClick: function (e) { var g = e.target.closest('[data-wbgot]'); if (g) { e.stopPropagation(); got(g.dataset.wbgot); } }
  }) : null;
  function got(id) {
    var old = (Fe.tools().wbuy || []).slice(), it = byId('wbuy', id); if (!it) return;
    var t = Fe.tools(); t.wbuy = (t.wbuy || []).filter(function (x) { return x.id !== id; }); Fe.saveTools(t);
    toast('<i class="bi bi-check2"></i> Got ' + esc(it.title), function () { var t2 = Fe.tools(); t2.wbuy = old; Fe.saveTools(t2); });
  }
  document.addEventListener('click', function (e) { var g = e.target.closest('[data-wbgot]'); if (g) { e.preventDefault(); e.stopPropagation(); got(g.dataset.wbgot); } }, true);
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-wbquick]'); if (!f) return; e.preventDefault();
    var v = f.q.value.trim(); if (!v) return;
    var m = v.match(/^(.*?)(?:\s+(?:x|×)\s*(\d+))?(?:\s+(?:fra|from|@)\s+(.+))?$/i) || [v, v];
    var t = Fe.tools(); t.wbuy = (Array.isArray(t.wbuy) ? t.wbuy : []).concat([{ id: uid(), title: (m[1] || v).trim(), qty: m[2] || '', where: (m[3] || '').trim(), added: today() }]); Fe.saveTools(t);
    setTimeout(function () { var i = document.querySelector('[data-wbquick] input'); if (i) i.focus(); }, 30);
  });
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
  Object.assign(window.Wish, { add: function () { if (K) K.edit(WF, null); } });
  (window.__ui = window.__ui || {})["wish"] = { K: K, $t: $t, WF: WF };
})();
