/* Finances, batch 3 (Oct 2026):
     Recurring payments – charges that come back every month, found in your bank imports and in what
                          you log yourself; add them as a subscription or a fixed cost in one tap.
     Shared expenses    – split a payment with someone, see who owes what, settle up.
   Cards mount into [data-tool="recur"] and [data-tool="shared"] on the Finances page; the At a glance
   lines and Settings → Pages → Finances work on every page. Data: dash.tools.shared,
   dash.tools.recurIgnore, dash.tools.fincfg (all inside the encrypted vault). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function dayN(k) { return Math.round(fromKey(k) / 864e5); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, ''); if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var x = parseFloat(s.replace(',', '.')); return isFinite(x) ? x : null; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function fmt(k, o) { return fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function norm(s) { return window.Smart ? window.Smart.norm(s) : String(s || '').toLowerCase().replace(/[^a-zæøå ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function ord(n) { var t = n % 100, u = n % 10; return n + (t > 10 && t < 14 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'); }
  var CAT = { groceries: 'Groceries', eating: 'Eating out', transport: 'Transport', shopping: 'Shopping', fun: 'Fun', health: 'Health', travel: 'Travel', other: 'Other' };
  var CATC = { groceries: '#11a597', eating: '#d95926', transport: '#3987e5', shopping: '#c98500', fun: '#d55181', health: '#8a6fdf', travel: '#0891b2', other: '#6b6d73' };

  /* ---------- settings (Settings → Pages → Finances) ---------- */
  var DEF = { months: 6, recurGlance: true, sharedGlance: true, sharedMin: 200, split: 'equal' };
  function cfg() { var c = Fe.tools().fincfg; return Object.assign({}, DEF, c && typeof c === 'object' ? c : {}); }
  function setCfg(p) { var t = Fe.tools(); t.fincfg = Object.assign({}, t.fincfg || {}, p); Fe.saveTools(t); }

  /* ======================= Recurring payments ======================= */
  function ignored() { var l = Fe.tools().recurIgnore; return Array.isArray(l) ? l : []; }
  /* every group of charges with the same text that comes back about once a month at a steady amount */
  function detect(d, now) {
    d = d || window.Vault.get() || {}; now = now || new Date();
    var since = dkey(new Date(now.getFullYear(), now.getMonth() - cfg().months, 1)), by = {};
    (d.expenses || []).forEach(function (e) {
      if (!e || !e.note || String(e.date) < since || e.cat === 'travel' || e.shared) return;
      var k = norm(e.note); if (k.length < 3) return;
      (by[k] = by[k] || []).push(e);
    });
    var subs = Fe.list('subs'), fixed = (d.budget && d.budget.fixed) || [], ign = ignored(), out = [];
    var match = function (k, l) { return l.filter(function (x) { var n = norm(x.name); return n && (k.indexOf(n) > -1 || n.indexOf(k) > -1); })[0]; };
    Object.keys(by).forEach(function (k) {
      var l = by[k].sort(function (a, b) { return a.date > b.date ? 1 : -1; });
      if (l.length < 2) return;
      /* gaps between charges: 25–35 days each (so the 30th → the 2nd still counts) */
      var gaps = []; for (var i = 1; i < l.length; i++) gaps.push(dayN(l[i].date) - dayN(l[i - 1].date));
      if (gaps.some(function (g) { return g < 24 || g > 36; })) return;
      var amts = l.map(function (e) { return +e.amount || 0; }), lo = Math.min.apply(null, amts), hi = Math.max.apply(null, amts);
      var last = l[l.length - 1], prev = l[l.length - 2];
      var steady = hi - lo <= Math.max(10, lo * .1);
      var priceUp = !steady && last.amount > prev.amount * 1.03 && l.slice(0, -1).every(function (e) { return Math.abs(e.amount - prev.amount) <= prev.amount * .03; });
      if (!steady && !priceUp) return;
      if (l.length < 3 && !(hi === lo || last.cat === 'fun')) return;          // two charges are enough only for the obvious ones
      var days = l.map(function (e) { return +String(e.date).slice(8, 10); }).sort(function (a, b) { return a - b; });
      var day = days[Math.floor(days.length / 2)];
      var nx = fromKey(last.date); nx.setMonth(nx.getMonth() + 1);
      var sub = match(k, subs), fx = sub ? null : match(k, fixed);
      out.push({ key: k, name: last.note, amount: +last.amount, prev: +prev.amount, avg: amts.reduce(function (a, x) { return a + x; }, 0) / amts.length, day: day, n: l.length, last: last.date, next: dkey(nx),
        cat: last.cat || 'other', bank: l.some(function (e) { return e.src === 'bank'; }), up: priceUp, sub: sub || null, fixed: fx || null, ignored: ign.indexOf(k) > -1,
        active: dayN(dkey(now)) - dayN(last.date) <= 40 });
    });
    return out.sort(function (a, b) { return (a.sub || a.fixed ? 1 : 0) - (b.sub || b.fixed ? 1 : 0) || b.amount - a.amount; });
  }
  /* add one as a subscription (when that part is on) or as a fixed cost in the budget */
  function addAs(r, kind) {
    var now = new Date(), dd = window.Vault.get(); if (!dd) return;
    var per = window.Budget && window.Budget.period ? window.Budget.period(dd, now) : null;
    /* from now on it's counted by the subscription / fixed cost – don't count this period's charge twice */
    if (per) dd.expenses = (dd.expenses || []).filter(function (e) { return !(e.note && norm(e.note) === r.key && per.has(e.date)); });
    if (kind === 'sub') {
      window.Vault.save(dd);
      var nx = new Date(now.getFullYear(), now.getMonth() + (r.day <= now.getDate() ? 1 : 0), Math.min(r.day, 28));
      var t = Fe.tools(); t.subs = t.subs || [];
      t.subs.push({ id: uid(), name: r.name, amount: r.amount, period: 'monthly', renews: dkey(nx), cat: r.cat === 'fun' ? 'streaming' : 'other', notes: r.bank ? 'Found in your bank import' : 'Found in your spending' });
      Fe.saveTools(t);
    } else {
      dd.budget = dd.budget || { income: [], fixed: [] }; dd.budget.fixed = dd.budget.fixed || [];
      var fid = uid(); dd.budget.fixed.push({ id: fid, name: r.name, amount: Math.round(r.amount), day: Math.min(r.day, 28) });
      var ym = dkey(now).slice(0, 7);
      if (String(r.last).slice(0, 7) === ym) { dd.paid = dd.paid || {}; (dd.paid[ym] = dd.paid[ym] || []).push(fid); }
      window.Vault.save(dd);
    }
    window.dispatchEvent(new Event('fin:change'));
    toast('<i class="bi bi-check2"></i> ' + esc(r.name) + (kind === 'sub' ? ' added to subscriptions' : ' is now a fixed cost'));
  }
  function setIgnore(k, on) {
    var t = Fe.tools(), l = Array.isArray(t.recurIgnore) ? t.recurIgnore.slice() : [];
    l = l.filter(function (x) { return x !== k; }); if (on) l.push(k);
    t.recurIgnore = l.slice(-200); Fe.saveTools(t);
  }

  var showIgnored = false;
  function recurCard(el) {
    var all = detect(), list = all.filter(function (r) { return !r.ignored; }), ign = all.filter(function (r) { return r.ignored; });
    var active = list.filter(function (r) { return r.active; }), fresh = list.filter(function (r) { return !r.sub && !r.fixed; });
    var perMonth = active.reduce(function (a, r) { return a + r.amount; }, 0), subsOn = Fe.on('subs');
    var row = function (r) {
      var c = CATC[r.cat] || CATC.other, done = r.sub || r.fixed;
      var status = r.sub ? '<span class="mp-tag ok"><i class="bi bi-check2"></i> Subscription</span>' : r.fixed ? '<span class="mp-tag ok"><i class="bi bi-check2"></i> Fixed cost</span>' : '';
      var price = r.sub && Math.abs(+r.sub.amount - r.amount) >= 5 ? '<button type="button" class="pill-btn sm" data-rcprice="' + esc(r.key) + '">Update price to ' + esc(kr(r.amount)) + '</button>' : '';
      var acts = r.ignored ? '<button type="button" class="text-btn" data-rcunign="' + esc(r.key) + '">Show again</button>'
        : done ? price : (subsOn ? '<button type="button" class="pill-btn sm" data-rcadd="' + esc(r.key) + '" data-kind="sub">Subscription</button>' : '') +
          '<button type="button" class="' + (subsOn ? 'text-btn' : 'pill-btn sm') + '" data-rcadd="' + esc(r.key) + '" data-kind="fixed">Fixed cost</button>' +
          '<button type="button" class="icon-btn sm" data-rcign="' + esc(r.key) + '" aria-label="Not a repeating payment" title="Not a repeating payment"><i class="bi bi-x"></i></button>';
      return '<li class="mp-row' + (done ? ' is-done' : '') + (r.active ? '' : ' is-old') + '"><span class="kit-ic" style="--c:' + c + '"><i class="bi bi-' + (r.bank ? 'bank' : 'arrow-repeat') + '"></i></span>' +
        '<span class="kit-x"><b>' + esc(r.name) + '</b><small>' + esc(kr(r.amount) + ' · around the ' + ord(r.day) + ' · ' + r.n + ' months' + (r.active ? ' · next ≈ ' + fmt(r.next) : ' · last ' + fmt(r.last))) +
        (r.up ? ' <span class="mp-up">↑ from ' + esc(kr(r.prev)) + '</span>' : '') + '</small>' + status + '</span><span class="mp-acts">' + acts + '</span></li>';
    };
    var body = list.length || ign.length ? '<div class="kit-tiles">' +
        tile('Found', String(list.length), list.length === 1 ? 'repeating payment' : 'repeating payments') +
        tile('Per month', esc(kr(perMonth)), 'still running') +
        tile('Not added', String(fresh.length), fresh.length ? 'to the budget yet' : 'all in the budget') + '</div>' +
        (list.length ? '<ul class="mp-list">' + list.map(row).join('') + '</ul>' : '<p class="empty kit-empty">Nothing left to look at.</p>') +
        (ign.length ? '<button type="button" class="text-btn mp-more" data-rcshowign>' + (showIgnored ? 'Hide' : 'Show') + ' ' + ign.length + ' not repeating</button>' + (showIgnored ? '<ul class="mp-list">' + ign.map(row).join('') + '</ul>' : '') : '')
      : '<p class="empty kit-empty">When the same shop or service charges you about once a month at the same price – in a bank import or what you log – it shows up here, so you can add it to the budget in one tap.</p>';
    el.innerHTML = '<section class="card kit-card mp-card" id="recur"><div class="card-head"><h2><i class="bi bi-arrow-repeat"></i> Recurring payments</h2><div class="head-actions"><a class="text-btn" href="/cmd/?settings=finance" aria-label="Settings"><i class="bi bi-sliders"></i></a></div></div>' + body + '</section>';
  }
  function tile(label, value, sub) { return '<div class="kit-tile" data-tk="' + esc(label) + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }

  /* ======================= Shared expenses ======================= */
  function sh() {
    var s = Fe.tools().shared; s = s && typeof s === 'object' ? s : {};
    return { people: Array.isArray(s.people) ? s.people : [], items: Array.isArray(s.items) ? s.items : [], pays: Array.isArray(s.pays) ? s.pays : [] };
  }
  function saveSh(s) { var t = Fe.tools(); t.shared = s; Fe.saveTools(t); }
  function person(s, id) { return s.people.filter(function (p) { return p.id === id; })[0]; }
  function pname(s, id) { if (id === 'me') return 'You'; var p = person(s, id); return p ? p.name : '?'; }
  /* > 0: they owe you · < 0: you owe them */
  function balance(s, pid) {
    var b = 0;
    s.items.forEach(function (x) { var sh = x.shares || {}; if (x.payer === 'me') b += +sh[pid] || 0; else if (x.payer === pid) b -= +sh.me || 0; });
    s.pays.forEach(function (p) { if (p.from === 'me' && p.to === pid) b += +p.amount || 0; if (p.from === pid && p.to === 'me') b -= +p.amount || 0; });
    return Math.round(b * 100) / 100;
  }
  function sharedCard(el) {
    var s = sh(), ym = dkey(new Date()).slice(0, 7);
    var bal = s.people.map(function (p) { return { p: p, b: balance(s, p.id) }; });
    var owed = bal.reduce(function (a, x) { return a + Math.max(0, x.b); }, 0), owe = bal.reduce(function (a, x) { return a + Math.max(0, -x.b); }, 0);
    var mine = s.items.filter(function (x) { return String(x.date).slice(0, 7) === ym; }).reduce(function (a, x) { return a + (+(x.shares || {}).me || 0); }, 0);
    var people = bal.filter(function (x) { return Math.abs(x.b) >= 1 || s.items.some(function (i) { return i.payer === x.p.id || (i.shares || {})[x.p.id] != null; }); })
      .sort(function (a, b) { return Math.abs(b.b) - Math.abs(a.b); });
    var recent = s.items.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).slice(0, 4);
    var body = s.items.length || s.pays.length ? '<div class="kit-tiles">' + tile('Owed to you', esc(kr(owed)), owed ? 'by ' + bal.filter(function (x) { return x.b >= 1; }).length + ' ' + (bal.filter(function (x) { return x.b >= 1; }).length === 1 ? 'person' : 'people') : 'all square') +
        tile('You owe', esc(kr(owe)), owe ? 'to ' + bal.filter(function (x) { return x.b <= -1; }).length + ' ' + (bal.filter(function (x) { return x.b <= -1; }).length === 1 ? 'person' : 'people') : 'nothing') +
        tile('Your share', esc(kr(mine)), 'this month') + '</div>' +
        '<ul class="mp-list">' + people.map(function (x) {
          var b = x.b, txt = b >= 1 ? 'owes you ' + kr(b) : b <= -1 ? 'you owe ' + kr(-b) : 'settled up';
          return '<li class="mp-row' + (Math.abs(b) < 1 ? ' is-done' : '') + '"><button type="button" class="kit-main" data-shp="' + esc(x.p.id) + '"><span class="kit-ic mp-av" style="--c:' + (b >= 1 ? '#22b35e' : b <= -1 ? '#e8743b' : '#7a8794') + '">' + esc((x.p.name || '?').slice(0, 1).toUpperCase()) + '</span>' +
            '<span class="kit-x"><b>' + esc(x.p.name) + '</b><small class="' + (b >= 1 ? 'mp-pos' : b <= -1 ? 'mp-neg' : '') + '">' + esc(txt) + '</small></span></button>' +
            (Math.abs(b) >= 1 ? '<span class="mp-acts"><button type="button" class="pill-btn sm" data-shsettle="' + esc(x.p.id) + '">Settle up</button></span>' : '') + '</li>';
        }).join('') + '</ul>' +
        (recent.length ? '<h3 class="lp-h3">Latest</h3><ul class="mp-list mp-recent">' + recent.map(function (x) {
          var others = Object.keys(x.shares || {}).filter(function (k) { return k !== 'me'; }).map(function (k) { return pname(s, k); });
          return '<li class="mp-row"><button type="button" class="kit-main" data-shitem="' + esc(x.id) + '"><span class="kit-ic" style="--c:' + (CATC[x.cat] || CATC.other) + '"><i class="bi bi-people"></i></span><span class="kit-x"><b>' + esc(x.note || 'Shared') + '</b><small>' +
            esc(fmt(x.date) + ' · ' + kr(x.total) + ' · ' + (x.payer === 'me' ? 'you paid' : 'paid by ' + pname(s, x.payer)) + ' · shared with ' + others.join(', ')) + '</small></span><span class="money">' + esc(kr((x.shares || {}).me || 0)) + '</span></button></li>';
        }).join('') + '</ul>' : '')
      : '<p class="empty kit-empty">Paid for dinner, a cabin or the groceries with someone? Split it here – only your share counts in your spending, and you see who owes what until you settle up.</p>';
    el.innerHTML = '<section class="card kit-card mp-card" id="shared"><div class="card-head"><h2><i class="bi bi-people"></i> Shared expenses</h2><div class="head-actions"><button type="button" class="text-btn" data-shnew><i class="bi bi-plus-lg"></i> Split</button></div></div>' + body + '</section>';
  }

  /* ---------- the sheets ---------- */
  function sheet(label, cls) {
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<div class="fo-box lf-box ' + (cls || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(label) + '"></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var box = bg.firstChild;
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    function close() { bg.remove(); document.removeEventListener('keydown', key, true); }
    document.addEventListener('keydown', key, true);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-x]')) close(); });
    return { box: box, close: close };
  }
  function head(icon, t) { return '<div class="lf-head"><h3><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</h3><button type="button" class="icon-btn sm" data-x aria-label="Close"><i class="bi bi-x-lg"></i></button></div>'; }

  /* split a payment: who paid, with whom, equally or by amount – optionally from an expense you already have */
  function splitSheet(item, preset) {
    var s = sh(), d = window.Vault.get() || {}, isNew = !item;
    var x = item ? JSON.parse(JSON.stringify(item)) : { id: uid(), date: dkey(new Date()), note: '', total: '', payer: 'me', shares: {}, cat: 'eating', exp: null, add: true };
    var withIds = Object.keys(x.shares || {}).filter(function (k) { return k !== 'me'; });
    var mode = item && item.mode === 'amount' ? 'amount' : cfg().split === 'amount' ? 'amount' : 'equal', custom = {};
    if (mode === 'amount') Object.keys(x.shares || {}).forEach(function (k) { custom[k] = x.shares[k]; });
    if (preset) { x.note = preset.note || ''; x.total = preset.amount; x.date = preset.date; x.cat = preset.cat || 'other'; x.exp = preset.id; }
    var S = sheet('Split a payment', 'mp-box'), box = S.box, newPerson = '';
    var recentEx = (d.expenses || []).filter(function (e) { return !e.shared && dayN(dkey(new Date())) - dayN(e.date) <= 21 && +e.amount > 0; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 8);
    function shares() {
      var tot = num(x.total) || 0, ids = ['me'].concat(withIds), out = {};
      if (mode === 'equal') { var each = Math.round(tot / ids.length * 100) / 100, acc = 0; ids.forEach(function (k, i) { out[k] = i === ids.length - 1 ? Math.round((tot - acc) * 100) / 100 : each; acc += each; }); }
      else { var rest = tot; withIds.forEach(function (k) { out[k] = num(custom[k]) || 0; rest -= out[k]; }); out.me = Math.round(rest * 100) / 100; }
      return out;
    }
    function draw() {
      var sv = shares(), tot = num(x.total) || 0;
      var prev = withIds.length && tot > 0 ? withIds.map(function (k) {
        return x.payer === 'me' ? esc(pname(s, k)) + ' owes you <b>' + esc(kr(sv[k])) + '</b>' : x.payer === k ? 'You owe ' + esc(pname(s, k)) + ' <b>' + esc(kr(sv.me)) + '</b>' : '';
      }).filter(Boolean).join(' · ') + ' · your share ' + esc(kr(sv.me)) : 'Pick who you shared it with.';
      box.innerHTML = head('people', isNew ? 'Split a payment' : 'Shared payment') +
        (isNew && recentEx.length && !x.exp ? '<p class="mp-lbl">From your spending</p><div class="lf-chips mp-chips">' + recentEx.map(function (e) { return '<button type="button" class="lf-chip" data-shfrom="' + esc(e.id) + '">' + esc((e.note || CAT[e.cat] || 'Expense') + ' · ' + kr(e.amount)) + '</button>'; }).join('') + '</div>' : '') +
        (x.exp ? '<p class="muted mp-from"><i class="bi bi-link-45deg"></i> From your spending – it will count only your share</p>' : '') +
        '<div class="mp-grid"><input name="note" placeholder="What was it? e.g. Dinner at Lofoten" value="' + esc(x.note) + '" maxlength="60" autocomplete="off">' +
        '<input name="total" placeholder="Total, kr" inputmode="decimal" value="' + esc(x.total === '' ? '' : String(x.total).replace('.', ',')) + '" autocomplete="off">' +
        '<select name="cat" aria-label="Category">' + Object.keys(CAT).map(function (k) { return '<option value="' + k + '"' + (k === x.cat ? ' selected' : '') + '>' + CAT[k] + '</option>'; }).join('') + '</select><input name="date" type="date" value="' + esc(x.date) + '" aria-label="Date"></div>' +
        '<p class="mp-lbl">Shared with</p><div class="lf-chips mp-chips">' + s.people.map(function (p) { return '<button type="button" class="lf-chip" data-shwith="' + esc(p.id) + '" aria-pressed="' + (withIds.indexOf(p.id) > -1) + '">' + esc(p.name) + '</button>'; }).join('') +
        '<span class="mp-newp"><input name="np" placeholder="New person" value="' + esc(newPerson) + '" maxlength="30" autocomplete="off"><button type="button" class="icon-btn sm" data-shaddp aria-label="Add person"><i class="bi bi-plus-lg"></i></button></span></div>' +
        (withIds.length ? '<p class="mp-lbl">Who paid?</p><div class="seg lf-seg">' + ['me'].concat(withIds).map(function (k) { return '<button type="button" data-shpayer="' + esc(k) + '" aria-pressed="' + (x.payer === k) + '">' + esc(k === 'me' ? 'You' : pname(s, k)) + '</button>'; }).join('') + '</div>' +
          '<p class="mp-lbl">Split</p><div class="seg lf-seg"><button type="button" data-shmode="equal" aria-pressed="' + (mode === 'equal') + '">Equally</button><button type="button" data-shmode="amount" aria-pressed="' + (mode === 'amount') + '">By amount</button></div>' +
          (mode === 'amount' ? '<div class="mp-amts">' + withIds.map(function (k) { return '<label>' + esc(pname(s, k)) + '<input inputmode="decimal" data-shamt="' + esc(k) + '" value="' + esc(custom[k] == null ? '' : String(custom[k]).replace('.', ',')) + '" placeholder="kr"></label>'; }).join('') + '<label>You<b>' + esc(kr(sv.me)) + '</b></label></div>' : '') : '') +
        (!x.exp && x.payer !== 'me' && withIds.length ? '<label class="lf-check"><input type="checkbox" name="add"' + (x.add !== false ? ' checked' : '') + '> Add your share to Spending</label>' : '') +
        '<p class="mp-prev" id="mpPrev">' + prev + '</p>' +
        '<div class="lf-foot">' + (isNew ? '<span class="spacer"></span>' : '<button type="button" class="text-btn danger" data-shdel><i class="bi bi-trash3"></i> Delete</button>') + '<button type="button" class="pill-btn wide" data-shsave><i class="bi bi-check2"></i> Save</button></div>';
    }
    function sync() { var f = box; ['note', 'total', 'date', 'cat'].forEach(function (n) { var i = f.querySelector('[name="' + n + '"]'); if (i) x[n] = n === 'total' ? i.value : i.value || x[n]; }); var a = f.querySelector('[name="add"]'); if (a) x.add = a.checked; var np = f.querySelector('[name="np"]'); if (np) newPerson = np.value; }
    function addPerson() {
      var n = newPerson.trim(); if (!n) return;
      var p = s.people.filter(function (q) { return q.name.toLowerCase() === n.toLowerCase(); })[0];
      if (!p) { p = { id: uid(), name: n.slice(0, 30) }; s.people.push(p); }
      if (withIds.indexOf(p.id) < 0) withIds.push(p.id); newPerson = ''; draw();
    }
    box.addEventListener('input', function (e) {
      if (e.target.dataset.shamt) { custom[e.target.dataset.shamt] = e.target.value; }
      sync();
      if (e.target.name === 'total' || e.target.dataset.shamt) { var keep = e.target, pos = keep.selectionStart; draw(); var again = box.querySelector(keep.name ? '[name="' + keep.name + '"]' : '[data-shamt="' + keep.dataset.shamt + '"]'); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (er) {} } }
    });
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.name === 'np') { e.preventDefault(); sync(); addPerson(); } });
    box.addEventListener('click', function (e) {
      var b; sync();
      if ((b = e.target.closest('[data-shfrom]'))) { var ex = (d.expenses || []).filter(function (q) { return q.id === b.dataset.shfrom; })[0]; if (ex) { x.note = ex.note || ''; x.total = ex.amount; x.date = ex.date; x.cat = ex.cat || 'other'; x.exp = ex.id; x.payer = 'me'; } draw(); return; }
      if ((b = e.target.closest('[data-shwith]'))) { var id = b.dataset.shwith, i = withIds.indexOf(id); if (i > -1) { withIds.splice(i, 1); if (x.payer === id) x.payer = 'me'; } else withIds.push(id); draw(); return; }
      if (e.target.closest('[data-shaddp]')) { addPerson(); return; }
      if ((b = e.target.closest('[data-shpayer]'))) { x.payer = b.dataset.shpayer; if (x.payer !== 'me' && x.exp) x.exp = null; draw(); return; }
      if ((b = e.target.closest('[data-shmode]'))) { mode = b.dataset.shmode; if (mode === 'amount') { var sv0 = shares(); withIds.forEach(function (k) { if (custom[k] == null) custom[k] = sv0[k]; }); } draw(); return; }
      if (e.target.closest('[data-shdel]')) { remove(item); S.close(); return; }
      if (e.target.closest('[data-shsave]')) {
        var tot = num(x.total);
        if (!(tot > 0)) { var ti = box.querySelector('[name="total"]'); if (ti) ti.focus(); return; }
        if (!withIds.length) { var np = box.querySelector('[name="np"]'); if (np) np.focus(); return; }
        var sv = shares();
        if (sv.me < 0) { box.querySelector('#mpPrev').innerHTML = '<span class="mp-neg">The amounts add up to more than the total.</span>'; return; }
        x.total = tot; x.shares = sv; x.mode = mode;
        save(x, item, s); S.close();
      }
    });
    draw();
  }
  /* write it, and keep Spending honest: only your share counts */
  function save(x, old, s) {
    var d = window.Vault.get(); if (!d) return;
    d.expenses = d.expenses || [];
    var me = +x.shares.me || 0;
    if (old && old.exp && old.exp !== x.exp) d.expenses.forEach(function (e) { if (e.id === old.exp && e.full != null) { e.amount = e.full; delete e.full; delete e.shared; } });
    var linked = x.exp ? d.expenses.filter(function (e) { return e.id === x.exp; })[0] : null;
    if (linked) {
      if (linked.full == null) linked.full = +linked.amount;
      linked.amount = me; linked.shared = x.id; linked.note = linked.note || x.note; linked.date = x.date; linked.cat = x.cat;
    } else if (x.payer !== 'me' && x.add !== false && me > 0) {
      var e = old && old.made ? d.expenses.filter(function (q) { return q.id === old.made; })[0] : null;
      if (!e) { e = { id: uid(), t: Date.now() }; d.expenses.push(e); }
      e.date = x.date; e.amount = me; e.cat = x.cat; e.note = x.note || 'Shared'; e.shared = x.id; x.made = e.id;
    } else if (old && old.made) {
      d.expenses = d.expenses.filter(function (q) { return q.id !== old.made; }); delete x.made;
    }
    delete x.add;
    window.Vault.save(d);
    s = s || sh(); s.items = s.items.filter(function (q) { return q.id !== x.id; }); s.items.push(x); saveSh(s);
    window.dispatchEvent(new Event('fin:change'));
    toast('<i class="bi bi-people"></i> ' + (old ? 'Saved' : 'Split saved') + ' – your share ' + esc(kr(me)));
  }
  function remove(item) {
    var s = sh(), d = window.Vault.get(); if (!d || !item) return;
    var before = JSON.parse(JSON.stringify(d.expenses || [])), beforeS = JSON.parse(JSON.stringify(s));
    (d.expenses || []).forEach(function (e) { if (e.id === item.exp && e.full != null) { e.amount = e.full; delete e.full; delete e.shared; } });
    if (item.made) d.expenses = (d.expenses || []).filter(function (e) { return e.id !== item.made; });
    window.Vault.save(d);
    s.items = s.items.filter(function (q) { return q.id !== item.id; }); saveSh(s);
    window.dispatchEvent(new Event('fin:change'));
    toast('<i class="bi bi-trash3"></i> Removed', function () { var d2 = window.Vault.get(); d2.expenses = before; window.Vault.save(d2); saveSh(beforeS); window.dispatchEvent(new Event('fin:change')); });
  }
  function settleSheet(pid) {
    var s = sh(), b = balance(s, pid), p = person(s, pid); if (!p) return;
    var S = sheet('Settle up'), box = S.box, theyPay = b > 0;
    box.innerHTML = head('cash-coin', 'Settle up with ' + p.name) +
      '<p class="muted">' + esc(theyPay ? p.name + ' owes you ' + kr(b) : 'You owe ' + p.name + ' ' + kr(-b)) + '. How much was paid?</p>' +
      '<div class="seg lf-seg"><button type="button" data-dir="in" aria-pressed="' + theyPay + '">' + esc(p.name) + ' paid you</button><button type="button" data-dir="out" aria-pressed="' + !theyPay + '">You paid ' + esc(p.name) + '</button></div>' +
      '<input name="amt" inputmode="decimal" value="' + esc(String(Math.abs(b)).replace('.', ',')) + '" aria-label="Amount, kr">' +
      '<div class="lf-foot"><button type="button" class="text-btn" data-shcopy><i class="bi bi-chat-text"></i> Send a reminder</button><button type="button" class="pill-btn wide" data-shpay><i class="bi bi-check2"></i> Mark as paid</button></div>';
    var dir = theyPay ? 'in' : 'out';
    box.addEventListener('click', function (e) {
      var q;
      if ((q = e.target.closest('[data-dir]'))) { dir = q.dataset.dir; box.querySelectorAll('[data-dir]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === q)); }); return; }
      if (e.target.closest('[data-shcopy]')) { share(pid); return; }
      if (e.target.closest('[data-shpay]')) {
        var a = num(box.querySelector('[name="amt"]').value); if (!(a > 0)) return;
        var s2 = sh(), pay = { id: uid(), date: dkey(new Date()), from: dir === 'in' ? pid : 'me', to: dir === 'in' ? 'me' : pid, amount: a };
        s2.pays.push(pay); saveSh(s2); S.close();
        toast('<i class="bi bi-check2-circle"></i> ' + esc(kr(a)) + ' marked as paid', function () { var s3 = sh(); s3.pays = s3.pays.filter(function (z) { return z.id !== pay.id; }); saveSh(s3); });
      }
    });
  }
  /* what they owe, as a message to paste in Messages / Vipps */
  function share(pid) {
    var s = sh(), p = person(s, pid), b = balance(s, pid); if (!p) return;
    var lines = s.items.filter(function (x) { return (x.payer === 'me' && (x.shares || {})[pid]) || (x.payer === pid && (x.shares || {}).me); }).sort(function (a, c) { return a.date > c.date ? 1 : -1; }).slice(-8)
      .map(function (x) { return '• ' + (x.note || 'Shared') + ' (' + fmt(x.date) + '): ' + kr(x.payer === 'me' ? x.shares[pid] : -x.shares.me); });
    var txt = (b >= 0 ? 'Hi ' + p.name + '! Here’s what we shared:\n' : 'Hi ' + p.name + '! What I owe you:\n') + lines.join('\n') + '\n' + (b >= 0 ? 'In total ' + kr(b) + ' 🙂' : 'In total ' + kr(-b) + ' – I’ll send it.');
    if (window.I18N && window.I18N.lang === 'nb') txt = (b >= 0 ? 'Hei ' + p.name + '! Her er det vi delte:\n' : 'Hei ' + p.name + '! Det jeg skylder deg:\n') + lines.join('\n') + '\n' + (b >= 0 ? 'Til sammen ' + kr(b) + ' 🙂' : 'Til sammen ' + kr(-b) + ' – jeg sender det.');
    if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(txt).then(function () { toast('<i class="bi bi-clipboard-check"></i> Copied – paste it in a message'); }); } catch (e) {}
  }
  function personSheet(pid) {
    var s = sh(), p = person(s, pid); if (!p) return;
    var S = sheet(p.name), box = S.box;
    function draw() {
      s = sh(); var b = balance(s, pid);
      var ev = s.items.filter(function (x) { return x.payer === pid || (x.shares || {})[pid] != null; }).map(function (x) { return { k: 'i', date: x.date, x: x, v: x.payer === 'me' ? +(x.shares[pid] || 0) : x.payer === pid ? -(+x.shares.me || 0) : 0, t: x.note || 'Shared' }; })
        .concat(s.pays.filter(function (q) { return q.from === pid || q.to === pid; }).map(function (q) { return { k: 'p', date: q.date, x: q, v: q.from === 'me' ? +q.amount : -q.amount, t: q.from === 'me' ? 'You paid ' + p.name : p.name + ' paid you' }; }))
        .sort(function (a, c) { return a.date < c.date ? 1 : -1; });
      box.innerHTML = head('person', p.name) + '<p class="mp-bal ' + (b >= 1 ? 'mp-pos' : b <= -1 ? 'mp-neg' : '') + '">' + esc(b >= 1 ? 'Owes you ' + kr(b) : b <= -1 ? 'You owe ' + kr(-b) : 'Settled up') + '</p>' +
        '<ul class="mp-list">' + ev.map(function (r) {
          return '<li class="mp-row"><span class="kit-ic" style="--c:' + (r.k === 'p' ? '#22b35e' : '#3987e5') + '"><i class="bi bi-' + (r.k === 'p' ? 'cash-coin' : 'people') + '"></i></span><span class="kit-x"><b>' + esc(r.t) + '</b><small>' + esc(fmt(r.date) + (r.k === 'i' ? ' · ' + kr(r.x.total) + ' in total' : '')) + '</small></span>' +
            '<span class="money ' + (r.v > 0 ? 'mp-pos' : r.v < 0 ? 'mp-neg' : '') + '">' + (r.v > 0 ? '+' : r.v < 0 ? '−' : '') + esc(kr(Math.abs(r.v))) + '</span>' +
            (r.k === 'p' ? '<button type="button" class="icon-btn sm" data-shdelpay="' + esc(r.x.id) + '" aria-label="Delete payment"><i class="bi bi-trash3"></i></button>' : '<button type="button" class="icon-btn sm" data-shedit="' + esc(r.x.id) + '" aria-label="Edit"><i class="bi bi-pencil"></i></button>') + '</li>';
        }).join('') + '</ul>' +
        '<div class="lf-foot"><button type="button" class="text-btn danger" data-shdelp' + (ev.length ? ' hidden' : '') + '><i class="bi bi-trash3"></i> Remove ' + esc(p.name) + '</button><button type="button" class="text-btn" data-shcopy><i class="bi bi-chat-text"></i> Message</button>' +
        (Math.abs(b) >= 1 ? '<button type="button" class="pill-btn" data-shsettle="' + esc(pid) + '">Settle up</button>' : '') + '</div>';
    }
    box.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-shdelpay]'))) { var s2 = sh(), gone = s2.pays.filter(function (q) { return q.id === b.dataset.shdelpay; })[0]; s2.pays = s2.pays.filter(function (q) { return q !== gone; }); saveSh(s2); draw(); toast('<i class="bi bi-trash3"></i> Payment removed', function () { var s3 = sh(); s3.pays.push(gone); saveSh(s3); }); return; }
      if ((b = e.target.closest('[data-shedit]'))) { var it = sh().items.filter(function (q) { return q.id === b.dataset.shedit; })[0]; S.close(); if (it) splitSheet(it); return; }
      if (e.target.closest('[data-shcopy]')) { share(pid); return; }
      if (e.target.closest('[data-shsettle]')) { S.close(); settleSheet(pid); return; }
      if (e.target.closest('[data-shdelp]')) { var s4 = sh(); s4.people = s4.people.filter(function (q) { return q.id !== pid; }); saveSh(s4); S.close(); }
    });
    draw();
  }

  /* ---------- mount the cards on the Finances page ---------- */
  var boxes = { recur: document.querySelector('[data-tool="recur"]'), shared: document.querySelector('[data-tool="shared"]') };
  function draw() {
    if (!window.Vault.get()) return;
    if (boxes.recur) { boxes.recur.hidden = !Fe.on('recur'); if (Fe.on('recur')) recurCard(boxes.recur); else boxes.recur.innerHTML = ''; }
    if (boxes.shared) { boxes.shared.hidden = !Fe.on('shared'); if (Fe.on('shared')) sharedCard(boxes.shared); else boxes.shared.innerHTML = ''; }
  }
  if (boxes.recur || boxes.shared) {
    var t = null;
    ['tools:change', 'features:change', 'fin:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(t); t = setTimeout(draw, 40); }); });
    var prevReload = window.Dash && window.Dash.reload; window.Dash = window.Dash || {};
    window.Dash.reload = function () { if (prevReload) prevReload(); clearTimeout(t); t = setTimeout(draw, 40); };   // newer data from another device
    window.Vault.onUnlock(function () { setTimeout(function () { draw(); if (location.hash === '#shared' || location.hash === '#recur') { var c = document.getElementById(location.hash.slice(1)); if (c) c.scrollIntoView({ block: 'start' }); } }, 120); });
    document.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-rcadd]'))) { var r = detect().filter(function (x) { return x.key === b.dataset.rcadd; })[0]; if (r) addAs(r, b.dataset.kind); return; }
      if ((b = e.target.closest('[data-rcign]'))) { var k = b.dataset.rcign; setIgnore(k, true); toast('<i class="bi bi-eye-slash"></i> Won’t suggest it again', function () { setIgnore(k, false); }); return; }
      if ((b = e.target.closest('[data-rcunign]'))) { setIgnore(b.dataset.rcunign, false); return; }
      if (e.target.closest('[data-rcshowign]')) { showIgnored = !showIgnored; draw(); return; }
      if ((b = e.target.closest('[data-rcprice]'))) { var r2 = detect().filter(function (x) { return x.key === b.dataset.rcprice; })[0]; if (r2 && r2.sub) { var tl = Fe.tools(); (tl.subs || []).forEach(function (q) { if (q.id === r2.sub.id) q.amount = r2.amount; }); Fe.saveTools(tl); toast('<i class="bi bi-check2"></i> Price updated'); } return; }
      if (e.target.closest('[data-shnew]')) { splitSheet(null); return; }
      if ((b = e.target.closest('#shared [data-shsettle]'))) { settleSheet(b.dataset.shsettle); return; }
      if ((b = e.target.closest('#shared [data-shp]'))) { personSheet(b.dataset.shp); return; }
      if ((b = e.target.closest('#shared [data-shitem]'))) { var it = sh().items.filter(function (q) { return q.id === b.dataset.shitem; })[0]; if (it) splitSheet(it); }
    });
  }

  /* ---------- At a glance: who owes you ---------- */
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!Fe.on('shared') || !Fe.on('finance') || !cfg().sharedGlance) return;
    var s = sh(), min = +cfg().sharedMin || 0, href = /\/cmd\/finance\//.test(location.pathname) ? '#shared' : '/cmd/finance/#shared';
    s.people.forEach(function (p) {
      var b = balance(s, p.id); if (Math.abs(b) < Math.max(1, min)) return;
      add(62, 'people', b > 0 ? '#22b35e' : '#e8743b', b > 0 ? p.name + ' owes you ' + kr(b) : 'You owe ' + p.name + ' ' + kr(-b), 'Shared expenses · settle up when it suits', href, { key: 'shared:' + p.id + ':' + Math.round(b / 50), tip: true });
    });
  });

  (window.CommandExtra = window.CommandExtra || []).push(function () { return Fe.on('shared') && Fe.on('finance') ? [{ i: 'people', t: 'Split a payment', s: 'Shared expenses', run: function () { if (boxes.shared) splitSheet(null); else location.href = '/cmd/finance/#shared'; }, x: 'split share del dele skylder owe' }] : []; });

  /* ---------- Settings → Pages → Finances ---------- */
  (function () {
    var pg = document.querySelector('.st-page[data-page="finance"]'); if (!pg) return;
    function sel(f, label, opts, sub) { var v = String(cfg()[f]); return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><select class="st-select" data-fcfg="' + f + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
    function sw(f, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-fcfg="' + f + '"' + (cfg()[f] ? ' checked' : '') + '></label>'; }
    function feat(id, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-ffeat="' + id + '"' + (Fe.on(id) ? ' checked' : '') + '></label>'; }
    function subh(icon, t) { return '<p class="st-sub ap-sub"><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</p>'; }
    function fill() {
      var box = document.getElementById('mpSet'); if (!box || (box.contains(document.activeElement) && document.activeElement.tagName === 'SELECT')) return;
      var ni = ignored().length;
      box.innerHTML = '<p class="st-intro">Extras on the Finances page. Everything is worked out on this device from your own entries.</p>' +
        subh('arrow-repeat', 'Recurring payments') + '<div class="st-group">' + feat('recur', 'Show the card', 'Charges that come back every month') + sel('months', 'Look back', [[3, '3 months'], [6, '6 months'], [12, '12 months']]) +
        sw('recurGlance', 'Suggest new ones in At a glance') + (ni ? '<button type="button" class="st-row st-btn" data-funign><span><i class="bi bi-arrow-counterclockwise"></i> Suggest the ' + ni + ' I waved away again</span></button>' : '') + '</div>' +
        subh('people', 'Shared expenses') + '<div class="st-group">' + feat('shared', 'Show the card', 'Split payments and see who owes what') + sel('split', 'New splits start', [['equal', 'Equally'], ['amount', 'By amount']]) +
        sw('sharedGlance', 'Remind me in At a glance', 'When someone owes you, or you owe them') + sel('sharedMin', 'From', [[1, 'Any amount'], [100, '100 kr'], [200, '200 kr'], [500, '500 kr'], [1000, '1 000 kr']]) + '</div>' +
        '<div class="st-group"><a class="st-row st-btn" href="/cmd/finance/"><span><i class="bi bi-wallet2"></i> Open Finances</span><i class="bi bi-chevron-right"></i></a><a class="st-row st-btn" href="/cmd/finance/?customize"><span><i class="bi bi-grid-1x2"></i> Order and hide cards</span><i class="bi bi-chevron-right"></i></a></div>';
    }
    function row() {
      var r = document.getElementById('stRow-finance'); if (r) r.hidden = !Fe.on('finance');
      var s = document.getElementById('sum-finance');
      if (s) { var on = ['recur', 'shared'].filter(Fe.on).map(function (k) { return k === 'recur' ? 'Recurring payments' : 'Shared expenses'; }); s.textContent = on.length ? on.join(' · ') : 'Recurring payments, shared expenses'; }
    }
    pg.addEventListener('change', function (e) {
      var i = e.target;
      if (i.dataset.ffeat) { Fe.set(i.dataset.ffeat, i.checked); return; }
      if (!i.dataset.fcfg) return;
      var p = {}; p[i.dataset.fcfg] = i.type === 'checkbox' ? i.checked : /^\d+$/.test(i.value) ? +i.value : i.value; setCfg(p);
      toast('<i class="bi bi-check2"></i> Saved');
    });
    pg.addEventListener('click', function (e) { if (e.target.closest('[data-funign]')) { var t = Fe.tools(); t.recurIgnore = []; Fe.saveTools(t); fill(); toast('<i class="bi bi-check2"></i> They can be suggested again'); } });
    window.addEventListener('st:page', function (e) { if (e.detail === 'finance') fill(); if (e.detail === 'home') row(); });
    ['features:change', 'tools:change'].forEach(function (ev) { window.addEventListener(ev, function () { row(); if (!pg.hidden) fill(); }); });
    window.Vault.onUnlock(function () { row(); fill(); });
  })();

  window.MoneyPlus = { detect: detect, balance: function (pid) { return balance(sh(), pid); }, ignored: ignored, cfg: cfg, split: splitSheet };
})();
