/* House page → "Shared home": what you and your partner pay for the home together.
   - one partner and your usual % (e.g. you 60, them 40) – every purchase starts there
   - purchases (furniture, appliances, anything) split by %, who paid, one running "who owes whom" + Settle up
   - bought in parts (delbetaling): down payment, monthly payments, interest and fees – the plan is a loan in
     Net worth with a.plan, so your part is a fixed cost, it shows in Next 14 days, the calendar and net worth,
     and each monthly payment one of you makes to the store counts in the balance between you
   - optionally into the Home inventory as owned together (your %)
   - a month at a glance: together, what each paid, and the one transfer that evens it out
   It uses the same data as Finances → Shared expenses (window.Shared from money-plus.js): one balance, not two.
   Mounts into [data-tool="hshared"]. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, mount = document.querySelector('[data-tool="hshared"]');
  function S() { return window.Shared; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2] || 1); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr%]/gi, ''); if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var x = parseFloat(s.replace(',', '.')); return isFinite(x) ? x : null; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function money(n, cls) { return '<span class="money' + (cls ? ' ' + cls : '') + '">' + esc(kr(n)) + '</span>'; }
  function pc(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function mName(ym, long) { return fromKey(ym + '-01').toLocaleDateString('en-GB', long ? { month: 'long', year: 'numeric' } : { month: 'short' }); }
  function fmt(k) { return fromKey(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  var CAT = [['home', 'Home'], ['groceries', 'Groceries'], ['eating', 'Eating out'], ['transport', 'Transport'], ['shopping', 'Shopping'], ['fun', 'Fun'], ['health', 'Health'], ['travel', 'Travel'], ['other', 'Other']];
  var CATC = { home: '#a0673a', groceries: '#11a597', eating: '#d95926', transport: '#3987e5', shopping: '#c98500', fun: '#d55181', health: '#8a6fdf', travel: '#0891b2', other: '#6b6d73' };
  var CATI = { home: 'house', groceries: 'basket', eating: 'cup-hot', transport: 'bus-front', shopping: 'bag', fun: 'controller', health: 'heart-pulse', travel: 'airplane', other: 'three-dots' };
  var KINDS = [['furniture', 'Furniture'], ['appliance', 'Appliance'], ['electronics', 'Electronics'], ['art', 'Art and design'], ['tools', 'Tools'], ['other', 'Other']];
  var ROOMS = [['living', 'Living room'], ['kitchen', 'Kitchen'], ['bedroom', 'Bedroom'], ['office', 'Office'], ['bathroom', 'Bathroom'], ['hall', 'Hall'], ['storage', 'Storage or attic'], ['garage', 'Garage or shed'], ['outdoor', 'Outdoors'], ['other', 'Other']];
  function opts(list, v) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
  function catName(k) { return (CAT.filter(function (c) { return c[0] === k; })[0] || [0, 'Other'])[1]; }

  var month = 0;           /* the month shown in "Your month together": 0 = this one, -1 = last … */

  /* ---------- the data, read through money-plus.js ---------- */
  function partner() { return S() ? S().partner() : null; }
  function myPct() { var c = S().cfg(); return +c.pct > 0 && +c.pct < 100 ? +c.pct : 50; }
  function plans(pid) {
    var d = window.Vault.get() || {};
    return (d.accounts || []).filter(function (a) { return a && a.kind === 'debt' && a.plan && (!pid || a.plan.pid === pid); });
  }
  /* every shared thing in a month with the partner: purchases and part payments */
  function monthLines(pid, ym) {
    var s = S().data(), out = [];
    s.items.forEach(function (x) {
      var sh = x.shares || {}; if (String(x.date).slice(0, 7) !== ym || sh[pid] == null) return;
      out.push({ k: 'i', id: x.id, date: x.date, note: x.note || 'Shared', total: +x.total || 0, payer: x.payer, mine: +sh.me || 0, them: +sh[pid] || 0, cat: x.cat || 'other', plan: x.plan });
    });
    S().planPays(null, pid).forEach(function (q) {
      if (q.date.slice(0, 7) !== ym) return;
      out.push({ k: 'l', id: q.loan, date: q.date, note: q.name + ' · payment ' + q.n + ' of ' + q.of, total: q.amount, payer: q.payer, mine: q.mine, them: q.them, cat: 'home' });
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  /* what each actually paid in a month, what's fair, and the one transfer that evens it out */
  function monthSum(lines, pid) {
    var r = { total: 0, mine: 0, them: 0, paidMe: 0, paidThem: 0 };
    lines.forEach(function (l) {
      r.total += l.total; r.mine += l.mine; r.them += l.them;
      if (l.payer === 'me') r.paidMe += l.total; else if (l.payer === pid) r.paidThem += l.total;
      else { r.paidMe += l.mine; r.paidThem += l.them; }      /* each paid their own part */
    });
    r.net = Math.round(r.paidMe - r.mine);     /* > 0: they send you this much for the month · < 0: you send them */
    return r;
  }

  /* ---------- the card ---------- */
  function tile(label, value, sub, key) { return '<div class="kit-tile" data-tk="' + esc(key || label) + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function draw() {
    if (!mount) return;
    var on = Fe.on('house') && !!S();
    mount.hidden = !on; if (!on) { mount.innerHTML = ''; return; }
    if (mount.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) return;
    var p = partner(), head = '<div class="card-head"><h2><i class="bi bi-people"></i> Shared home' + (p ? ' <span class="muted hs2-with">with ' + esc(p.name) + '</span>' : '') + '</h2>' +
      (p ? '<div class="head-actions"><button type="button" class="icon-btn sm" data-hs2set aria-label="Who and how you split"><i class="bi bi-sliders"></i></button><button type="button" class="text-btn" data-hs2add><i class="bi bi-plus-lg"></i> Add</button></div>' : '') + '</div>';
    if (!p) { mount.innerHTML = '<section class="card kit-card hs2" id="hshared">' + head + setupForm() + '</section>'; return; }
    var s = S().data(), b = S().balance(p.id), now = new Date(), ym = dkey(new Date(now.getFullYear(), now.getMonth() + month, 1)).slice(0, 7);
    var lines = monthLines(p.id, ym), m = monthSum(lines, p.id), cur = month ? monthSum(monthLines(p.id, dkey(now).slice(0, 7)), p.id) : m;
    var yr = String(now.getFullYear()), yearHome = 0, yearAll = 0, byCat = {};
    for (var k = 0; k < 12; k++) {
      var mk = yr + '-' + pad(k + 1); if (mk > dkey(now).slice(0, 7)) break;
      monthLines(p.id, mk).forEach(function (l) { yearAll += l.total; byCat[l.cat] = (byCat[l.cat] || 0) + l.total; if (l.cat === 'home') yearHome += l.total; });
    }
    var pl = plans(p.id), L = window.Loans;
    var planLeft = pl.reduce(function (a, x) { return a + (L ? L.owedNow(x) : 0); }, 0);
    var bal = b >= 1 ? esc(p.name) + ' owes you' : b <= -1 ? 'You owe ' + esc(p.name) : 'Between you';
    var body = '<div class="kit-tiles">' +
        tile(bal, Math.abs(b) >= 1 ? money(Math.abs(b), b >= 1 ? 'mp-pos' : 'mp-neg') : 'All square', Math.abs(b) >= 1 ? 'everything so far' : 'nothing to settle', 'balance') +
        tile('This month', money(cur.total), 'together · your part ' + esc(kr(cur.mine)), 'month') +
        tile('On the home ' + yr, money(yearHome), 'together' + (yearAll > yearHome ? ' · ' + esc(kr(yearAll)) + ' shared in all' : ''), 'year') +
        (pl.length ? tile('Bought in parts', money(planLeft), 'left on ' + pl.length + ' plan' + (pl.length === 1 ? '' : 's'), 'parts') : '') +
      '</div>' +
      '<div class="hs2-acts">' + (Math.abs(b) >= 1 ? '<button type="button" class="pill-btn sm" data-hs2settle><i class="bi bi-cash-coin"></i> Settle up</button>' : '') +
        '<button type="button" class="text-btn" data-hs2hist><i class="bi bi-clock-history"></i> History</button>' +
        (Math.abs(b) >= 1 ? '<button type="button" class="text-btn" data-hs2msg><i class="bi bi-chat-text"></i> Send a reminder</button>' : '') + '</div>';
    /* bought in parts */
    if (pl.length) {
      body += '<h3 class="lp-h3">Bought in parts</h3><ul class="hs2-plans">' + pl.map(function (a) {
        var c = L.calc(a), tot = S().monthsFor(Object.assign({}, a)), left = L.owedNow(a), done = Math.max(0, tot - (c && !c.never ? c.months : 0)), part = L.part(a), payAmt = (+a.pay || 0) + (+a.fee || 0);
        var who = a.plan.payer === 'me' ? 'you pay the store' : a.plan.payer === p.id ? esc(p.name) + ' pays the store' : 'each pays their part';
        var paid = left <= 0.5;
        return '<li><button type="button" class="hs2-plan' + (paid ? ' is-done' : '') + '" data-hs2plan="' + esc(a.id) + '">' +
          '<span class="hs2-pt"><b>' + esc(a.name) + '</b><small>' + (paid ? '<i class="bi bi-check2-circle"></i> Paid off' : done + ' of ' + tot + ' paid · ' + esc(kr(payAmt)) + ' a month' + (part < 1 ? ' (yours ' + esc(kr(payAmt * part)) + ')' : '') + ' · ' + who + (c && !c.never ? ' · done ' + esc(c.endLabel.split(' (')[0]) : '')) + '</small></span>' +
          '<span class="hs2-pr">' + (paid ? '' : money(left) + '<small>left</small>') + '</span>' +
          '<span class="stack hs2-bar"><span style="width:' + (tot ? Math.min(100, done / tot * 100) : 100).toFixed(1) + '%"></span></span></button></li>';
      }).join('') + '</ul>';
    }
    /* the month */
    body += '<div class="hs2-mh"><h3 class="lp-h3">Your month together</h3><span class="hs2-nav"><button type="button" class="icon-btn sm" data-hs2m="-1" aria-label="Earlier month"><i class="bi bi-chevron-left"></i></button><b>' + esc(mName(ym, true)) + '</b>' +
      '<button type="button" class="icon-btn sm" data-hs2m="1" aria-label="Later month"' + (month >= 0 ? ' disabled' : '') + '><i class="bi bi-chevron-right"></i></button></span></div>';
    if (!lines.length) body += '<p class="empty kit-empty">Nothing shared in ' + esc(mName(ym, true)) + '. Bought something for the home together? Add it with <b>+ Add</b>.</p>';
    else {
      body += '<ul class="mp-list hs2-lines">' + lines.map(function (l) {
        var pay = l.payer === 'me' ? 'you paid' : l.payer === p.id ? esc(p.name) + ' paid' : 'each paid their part';
        return '<li class="mp-row"><button type="button" class="kit-main" ' + (l.k === 'l' ? 'data-hs2plan' : 'data-hs2item') + '="' + esc(l.id) + '"><span class="kit-ic" style="--c:' + (CATC[l.cat] || CATC.other) + '"><i class="bi bi-' + (l.k === 'l' ? 'calendar2-check' : CATI[l.cat] || 'people') + '"></i></span>' +
          '<span class="kit-x"><b>' + esc(l.note) + '</b><small>' + esc(fmt(l.date)) + ' · ' + esc(kr(l.total)) + ' · ' + pay + '</small></span><span class="money">' + esc(kr(l.mine)) + '</span></button></li>';
      }).join('') + '</ul>' +
      '<div class="hs2-sum"><div class="hs2-sumrow"><span>Together</span><b>' + money(m.total) + '</b></div>' +
        '<div class="hs2-sumrow"><span>You paid</span><b>' + money(m.paidMe) + '</b></div><div class="hs2-sumrow"><span>' + esc(p.name) + ' paid</span><b>' + money(m.paidThem) + '</b></div>' +
        '<div class="hs2-sumrow"><span>Your part</span><b>' + money(m.mine) + '</b></div>' +
        '<p class="hs2-even">' + (Math.abs(m.net) < 1 ? '<i class="bi bi-check2-circle"></i> This month evens out by itself' : '<i class="bi bi-arrow-left-right"></i> To even out ' + esc(mName(ym)) + ': <b>' + (m.net > 0 ? esc(p.name) + ' sends you ' + esc(kr(m.net)) : 'you send ' + esc(p.name) + ' ' + esc(kr(-m.net))) + '</b>') + '</p>' +
        '<button type="button" class="text-btn" data-hs2copy><i class="bi bi-share"></i> Share the month</button></div>';
    }
    /* what you share, by category this year */
    var cats = Object.keys(byCat).sort(function (a, c) { return byCat[c] - byCat[a]; }), mx = cats.length ? byCat[cats[0]] : 1;
    if (cats.length > 1) body += '<h3 class="lp-h3">Shared in ' + yr + '</h3><ul class="hs2-cats">' + cats.map(function (c) {
      return '<li><span>' + esc(catName(c)) + '</span><span class="hs2-cb"><i style="width:' + Math.max(3, byCat[c] / mx * 100).toFixed(1) + '%;background:' + (CATC[c] || CATC.other) + '"></i></span>' + money(byCat[c]) + '</li>';
    }).join('') + '</ul>';
    mount.innerHTML = '<section class="card kit-card hs2" id="hshared">' + head + body + '</section>';
  }
  function setupForm(p) {
    var s = S().data(), pct = p ? myPct() : 50;
    return '<form class="hs2-setup" data-hs2setup><p class="muted">Share your home with someone? Say who and how you split, then add what you buy together – furniture, a new fridge, the lot. You see who owes whom, things you pay in parts, and the one transfer that evens out each month.</p>' +
      (s.people.length ? '<div class="lf-chips mp-chips">' + s.people.map(function (q) { return '<button type="button" class="lf-chip" data-hs2pick="' + esc(q.id) + '" aria-pressed="' + (!!p && p.id === q.id) + '">' + esc(q.name) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="mp-grid hs2-sg"><label><span>Who</span><input name="who" value="' + esc(p ? p.name : '') + '" placeholder="Your partner’s name" maxlength="30" autocomplete="off" required></label>' +
      '<label><span>You pay, %</span><input name="pct" value="' + esc(pc(pct)) + '" inputmode="decimal" autocomplete="off"></label></div>' +
      '<div class="lf-chips mp-chips">' + [50, 60, 40, 70, 30].map(function (v) { return '<button type="button" class="lf-chip" data-hs2q="' + v + '" aria-pressed="' + (pct === v) + '">' + v + ' / ' + (100 - v) + '</button>'; }).join('') + '</div>' +
      '<div class="lf-foot"><span class="spacer"></span><button type="submit" class="pill-btn wide"><i class="bi bi-check2"></i> ' + (p ? 'Save' : 'Start') + '</button></div></form>';
  }
  function saveSetup(form) {
    var who = form.who.value.trim(), pct = num(form.pct.value);
    if (!who) { form.who.focus(); return false; }
    if (!(pct > 0 && pct < 100)) { form.pct.focus(); return false; }
    var s = S().data(), q = s.people.filter(function (x) { return String(x.name || '').toLowerCase() === who.toLowerCase(); })[0];
    if (!q) { q = { id: uid(), name: who.slice(0, 30) }; s.people.push(q); S().save(s); }
    S().setCfg({ partner: q.id, pct: Math.round(pct * 10) / 10, split: 'pct' });
    if (!Fe.on('shared')) Fe.set('shared', true);           /* the same balance on Finances and in At a glance */
    toast('<i class="bi bi-people"></i> You ' + pc(pct) + ' % · ' + esc(q.name) + ' ' + pc(100 - pct) + ' %');
    return true;
  }

  /* ---------- sheets ---------- */
  function sheet(label) {
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<div class="fo-box lf-box mp-box hs2-box" role="dialog" aria-modal="true" aria-label="' + esc(label) + '"></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    function close() { bg.remove(); document.removeEventListener('keydown', key, true); }
    document.addEventListener('keydown', key, true);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-x]')) close(); });
    return { box: bg.firstChild, close: close };
  }
  function shead(icon, t) { return '<div class="lf-head"><h3><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</h3><button type="button" class="icon-btn sm" data-x aria-label="Close"><i class="bi bi-x-lg"></i></button></div>'; }

  function setSheet() {
    var X = sheet('Who and how you split');
    X.box.innerHTML = shead('people', 'Who and how you split') + setupForm(partner()) + '<p class="muted hs2-note">Changing the % applies to new purchases. Ones already saved keep their split – open one to change it.</p>';
    wireSetup(X.box, function () { X.close(); draw(); });
  }
  function wireSetup(box, done) {
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hs2q]'), f = box.querySelector('[data-hs2setup]'); if (!f) return;
      if (b) { f.pct.value = b.dataset.hs2q; box.querySelectorAll('[data-hs2q]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === b)); }); return; }
      var pk = e.target.closest('[data-hs2pick]'); if (pk) { var q = S().person(pk.dataset.hs2pick); if (q) f.who.value = q.name; box.querySelectorAll('[data-hs2pick]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === pk)); }); }
    });
    box.addEventListener('submit', function (e) { var f = e.target.closest('[data-hs2setup]'); if (!f) return; e.preventDefault(); if (saveSetup(f)) done(); });
  }

  /* add a purchase, or change a thing bought in parts */
  function buySheet(loanId) {
    var p = partner(); if (!p) return;
    var d = window.Vault.get() || {}, L = window.Loans, loan = loanId ? (d.accounts || []).filter(function (a) { return a.id === loanId && a.plan; })[0] : null;
    if (loanId && !loan) return;
    var pl = loan ? loan.plan : null;
    var downItem = pl && pl.item ? S().data().items.filter(function (x) { return x.id === pl.item; })[0] : null;
    var st = loan ? {
      note: loan.name, price: pl.price, date: loan.asOf, cat: 'home', payer: downItem ? downItem.payer : 'me', pct: L.part(loan) * 100, parts: true,
      down: pl.down || '', months: pl.months || '', rate: loan.rate || '', startFee: pl.startFee || '', fee: loan.fee || '', pay: loan.pay || '', payAuto: !pl.payTyped, day: loan.day || '', store: pl.payer || 'me', inv: false, kind: 'furniture', room: 'living'
    } : { note: '', price: '', date: dkey(new Date()), cat: 'home', payer: 'me', pct: myPct(), parts: false, down: '', months: 12, rate: '', startFee: '', fee: '', pay: '', payAuto: true, day: '', store: 'me', inv: true, kind: 'furniture', room: 'living' };
    var X = sheet(loan ? 'Bought in parts' : 'Bought together'), box = X.box;
    function calc() {
      var price = num(st.price) || 0, down = num(st.down) || 0, fin = Math.max(0, price - down + (num(st.startFee) || 0)), n = Math.round(num(st.months) || 0);
      var auto = n > 0 && fin > 0 ? Math.round(L.payment(fin, num(st.rate) || 0, n)) : 0, pay = st.payAuto ? auto : num(st.pay) || 0;
      var total = down + (pay + (num(st.fee) || 0)) * (n || 0);
      return { price: price, down: down, fin: fin, n: n, auto: auto, pay: pay, total: total, extra: total - price };
    }
    function preview() {
      var price = num(st.price) || 0, pct = num(st.pct) || 0, me = st.pct > 0 && st.pct <= 100 ? pct / 100 : 0;
      if (!st.parts) return price ? 'Your part ' + esc(kr(price * me)) + ' · ' + esc(p.name) + ' ' + esc(kr(price * (1 - me))) + (st.payer === 'me' ? ' – ' + esc(p.name) + ' owes you ' + esc(kr(price * (1 - me))) : ' – you owe ' + esc(p.name) + ' ' + esc(kr(price * me))) : 'Type the price.';
      var c = calc(); if (!c.n || !c.fin) return 'Type the price, down payment and number of months.';
      var mo = c.pay + (num(st.fee) || 0);
      return 'Each month <b>' + esc(kr(mo)) + '</b> for ' + c.n + ' months – your part ' + esc(kr(mo * me)) + ', ' + esc(p.name) + ' ' + esc(kr(mo * (1 - me))) + '.<br>In all ' + esc(kr(c.total)) + (c.extra > 1 ? ' – <span class="mp-neg">' + esc(kr(c.extra)) + ' more than the price</span> in interest and fees' : ' – no extra cost') + '.';
    }
    function draw2() {
      var c = calc(), who = function (name, val, cur) { return '<button type="button" data-' + name + '="' + esc(val[0]) + '" aria-pressed="' + (cur === val[0]) + '">' + esc(val[1]) + '</button>'; };
      box.innerHTML = shead(st.parts ? 'calendar2-range' : 'bag-check', loan ? 'Bought in parts' : 'Bought together') +
        '<div class="mp-grid"><input name="note" placeholder="What? e.g. Sofa from Bohus" value="' + esc(st.note) + '" maxlength="60" autocomplete="off">' +
        '<input name="price" placeholder="Price, kr" inputmode="decimal" value="' + esc(st.price === '' ? '' : String(st.price).replace('.', ',')) + '" autocomplete="off">' +
        '<select name="cat" aria-label="Category">' + opts(CAT, st.cat) + '</select><input name="date" type="date" value="' + esc(st.date) + '" aria-label="Date bought"></div>' +
        '<p class="mp-lbl">Split</p><div class="mp-pct"><label>You pay<input inputmode="decimal" name="pct" value="' + esc(pc(st.pct)) + '" aria-label="Your share in %"><span>%</span></label><div class="lf-chips mp-chips">' + [50, 60, 40, 70, 30].map(function (v) { return '<button type="button" class="lf-chip" data-bq="' + v + '" aria-pressed="' + (+st.pct === v) + '">' + v + ' / ' + (100 - v) + '</button>'; }).join('') + '</div></div>' +
        '<p class="mp-lbl">' + (st.parts ? 'Who paid the down payment?' : 'Who paid?') + '</p><div class="seg lf-seg">' + who('bpayer', ['me', 'You'], st.payer) + who('bpayer', [p.id, p.name], st.payer) + '</div>' +
        '<label class="lf-check"><input type="checkbox" name="parts"' + (st.parts ? ' checked' : '') + (loan ? ' disabled' : '') + '> Paying in parts (delbetaling)</label>' +
        (st.parts ? '<div class="hs2-parts">' +
          '<div class="mp-grid hs2-pg">' +
            '<label><span>Down payment, kr</span><input name="down" inputmode="decimal" value="' + esc(st.down) + '" placeholder="0" autocomplete="off"></label>' +
            '<label><span>Months</span><input name="months" inputmode="numeric" value="' + esc(st.months) + '" placeholder="12" autocomplete="off"></label>' +
            '<label><span>Interest, % a year</span><input name="rate" inputmode="decimal" value="' + esc(String(st.rate).replace('.', ',')) + '" placeholder="0" autocomplete="off"></label>' +
            '<label><span>Start fee, kr</span><input name="startFee" inputmode="decimal" value="' + esc(st.startFee) + '" placeholder="Etableringsgebyr" autocomplete="off"></label>' +
            '<label><span>Fee a month, kr</span><input name="fee" inputmode="decimal" value="' + esc(st.fee) + '" placeholder="Termingebyr" autocomplete="off"></label>' +
            '<label><span>Each month, kr</span><input name="pay" inputmode="decimal" value="' + esc(st.payAuto ? '' : st.pay) + '" placeholder="' + (c.auto ? esc(nf.format(c.auto)) + ' (auto)' : 'Worked out') + '" autocomplete="off"></label>' +
            '<label><span>Due day</span><input name="day" inputmode="numeric" value="' + esc(st.day) + '" placeholder="1–31" autocomplete="off"></label>' +
          '</div>' +
          '<p class="mp-lbl">Who pays the store each month?</p><div class="seg lf-seg">' + who('bstore', ['me', 'You'], st.store) + who('bstore', [p.id, p.name], st.store) + who('bstore', ['each', 'Each our part'], st.store) + '</div>' +
          '</div>' : '') +
        (loan ? '' : '<label class="lf-check"><input type="checkbox" name="inv"' + (st.inv ? ' checked' : '') + '> Add to the Home inventory (owned together)</label>' +
          (st.inv ? '<div class="mp-grid hs2-ig"><select name="kind" aria-label="Kind">' + opts(KINDS, st.kind) + '</select><select name="room" aria-label="Room">' + opts(ROOMS, st.room) + '</select></div>' : '')) +
        '<p class="mp-prev" id="hs2Prev">' + preview() + '</p>' +
        '<div class="lf-foot">' + (loan ? '<button type="button" class="text-btn danger" data-bdel><i class="bi bi-trash3"></i> Delete</button>' : '<span class="spacer"></span>') + '<button type="button" class="pill-btn wide" data-bsave><i class="bi bi-check2"></i> Save</button></div>';
    }
    function read() {
      ['note', 'price', 'date', 'cat', 'pct', 'down', 'months', 'rate', 'startFee', 'fee', 'day', 'kind', 'room'].forEach(function (n) { var i = box.querySelector('[name="' + n + '"]'); if (i) st[n] = i.value; });
      var pi = box.querySelector('[name="pay"]'); if (pi) { st.payAuto = !pi.value.trim(); st.pay = pi.value; }
      var ch = box.querySelector('[name="parts"]'); if (ch) st.parts = ch.checked;
      var iv = box.querySelector('[name="inv"]'); if (iv) st.inv = iv.checked;
    }
    box.addEventListener('input', function (e) {
      read();
      if (e.target.name === 'pay' || e.target.name === 'pct' || e.target.name === 'price' || e.target.name === 'down' || e.target.name === 'months' || e.target.name === 'rate' || e.target.name === 'startFee' || e.target.name === 'fee') {
        var pv = box.querySelector('#hs2Prev'); if (pv) pv.innerHTML = preview();
        var pp = box.querySelector('[name="pay"]'), c = calc(); if (pp) pp.placeholder = c.auto ? nf.format(c.auto) + ' (auto)' : 'Worked out';
        box.querySelectorAll('[data-bq]').forEach(function (z) { z.setAttribute('aria-pressed', String(+z.dataset.bq === num(st.pct))); });
      }
    });
    box.addEventListener('change', function (e) { if (e.target.name === 'parts' || e.target.name === 'inv') { read(); if (e.target.name === 'parts' && st.parts && !st.day) st.day = String(fromKey(st.date).getDate()); draw2(); } });
    box.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-bq]'))) { read(); st.pct = +b.dataset.bq; draw2(); return; }
      if ((b = e.target.closest('[data-bpayer]'))) { read(); st.payer = b.dataset.bpayer; draw2(); return; }
      if ((b = e.target.closest('[data-bstore]'))) { read(); st.store = b.dataset.bstore; draw2(); return; }
      if (e.target.closest('[data-bdel]')) { read(); if (confirm('Delete “' + (loan.name || 'this') + '”? The payments so far are taken out of what you owe each other. (The Home inventory keeps the item.)')) { delPlan(loan.id); X.close(); } return; }
      if (e.target.closest('[data-bsave]')) { read(); if (savePurchase(st, loan, p, calc(), box)) X.close(); }
    });
    draw2();
    var f0 = box.querySelector(loan ? '[name="months"]' : '[name="note"]'); if (f0 && !matchMedia('(pointer: coarse)').matches) f0.focus();
  }

  function savePurchase(st, loan, p, c, box) {
    var note = String(st.note || '').trim(), price = num(st.price), pct = num(st.pct);
    var bad = function (n) { var i = box.querySelector('[name="' + n + '"]'); if (i) i.focus(); return false; };
    if (!note) return bad('note');
    if (!(price > 0)) return bad('price');
    if (!(pct > 0 && pct <= 100)) return bad('pct');
    var date = /^\d{4}-\d{2}-\d{2}$/.test(st.date) ? st.date : dkey(new Date()), me = pct / 100;
    var d = window.Vault.get(); if (!d) return false;
    d.accounts = d.accounts || []; d.expenses = d.expenses || [];
    /* a shared payment (the purchase, or the down payment) through the shared-expenses engine: only your part counts in Spending */
    function sharedPayment(total, text, old) {
      var x = old ? JSON.parse(JSON.stringify(old)) : { id: uid() };
      x.date = date; x.note = text; x.total = Math.round(total * 100) / 100; x.payer = st.payer; x.cat = st.cat || 'home'; x.mode = 'pct'; x.pct = pct; x.home = true;
      x.shares = { me: Math.round(total * me * 100) / 100 }; x.shares[p.id] = Math.round((x.total - x.shares.me) * 100) / 100;
      if (pct >= 100) delete x.shares[p.id];
      if (st.payer === 'me') {
        /* you paid the whole thing: it goes into Spending, and the engine brings it down to your part */
        var e = x.exp ? d.expenses.filter(function (q) { return q.id === x.exp; })[0] : null;
        if (!e) { e = { id: uid(), t: Date.now() }; d.expenses.push(e); x.exp = e.id; }
        e.date = date; e.amount = x.total; delete e.full; e.cat = x.cat; e.note = text;
        if (x.made) { d.expenses = d.expenses.filter(function (q) { return q.id !== x.made; }); delete x.made; }
      } else {
        if (x.exp) { d.expenses = d.expenses.filter(function (q) { return q.id !== x.exp; }); delete x.exp; }
        x.add = true;
      }
      window.Vault.save(d);
      S().saveItem(x, old || null, S().data());
      d = window.Vault.get();
      return x;
    }
    var s = S().data(), invId = null;
    if (!st.parts) {
      sharedPayment(price, note, null);
    } else {
      if (!(c.n > 0)) return bad('months');
      if (!(c.fin > 0)) return bad('down');
      if (!(c.pay > 0)) return bad('pay');
      var day = Math.round(num(st.day) || fromKey(date).getDate()); if (day < 1 || day > 31) return bad('day');
      var old = loan || null, oldDown = old && old.plan.item ? s.items.filter(function (x) { return x.id === old.plan.item; })[0] : null, downId = null;
      if (c.down > 0) downId = sharedPayment(c.down, note + ' – down payment', oldDown).id;
      else if (oldDown) S().removeItem(oldDown);
      d = window.Vault.get(); d.accounts = d.accounts || [];
      var a = old ? d.accounts.filter(function (x) { return x.id === old.id; })[0] : null;
      if (!a) { a = { id: 'pl' + uid(), kind: 'debt' }; d.accounts.push(a); }
      Object.assign(a, { name: note.slice(0, 60), balance: Math.round(c.fin), orig: Math.round(c.fin), rate: num(st.rate) || 0, pay: Math.round(c.pay), fee: Math.round(num(st.fee) || 0), day: day,
        from: a.from || 'salary', fixed: true, asOf: date });
      if (pct < 100) { a.share = Math.round(pct * 10) / 10; a.with = p.name; } else { delete a.share; delete a.with; }
      a.plan = { price: Math.round(price), down: Math.round(c.down), startFee: Math.round(num(st.startFee) || 0), months: c.n, payer: st.store || 'me', pid: p.id, item: downId, inv: (old && old.plan.inv) || null, payTyped: !st.payAuto };
      window.Vault.save(d);
      if (window.Links && window.Links.syncLoans) window.Links.syncLoans();
      loan = a;
    }
    /* into the Home inventory, owned together */
    if (st.inv && !(loan && loan.plan && loan.plan.inv)) {
      var t = Fe.tools(); t.hinv = Array.isArray(t.hinv) ? t.hinv : [];
      invId = uid();
      t.hinv.push({ id: invId, name: note, cat: st.kind || 'furniture', room: st.room || 'living', price: Math.round(price), bought: date, ownPct: pct < 100 ? Math.round(pct * 10) / 10 : null, ownWith: pct < 100 ? p.name : '',
        notes: (pct < 100 ? 'Bought together with ' + p.name + ' (' + pc(pct) + ' / ' + pc(100 - pct) + ')' : '') + (st.parts ? ' · paid in parts' : '') });
      Fe.saveTools(t);
      if (loan && loan.plan) { var d2 = window.Vault.get(); (d2.accounts || []).forEach(function (x) { if (x.id === loan.id) x.plan.inv = invId; }); window.Vault.save(d2); }
    }
    if (!Fe.on('shared')) Fe.set('shared', true);
    window.dispatchEvent(new Event('fin:change'));
    toast('<i class="bi bi-house-check"></i> ' + esc(note) + ' saved' + (st.parts ? ' · ' + c.n + ' payments' : '') + (invId ? ' · in the inventory' : ''));
    draw();
    return true;
  }
  function delPlan(id) {
    var d = window.Vault.get(); if (!d) return;
    var a = (d.accounts || []).filter(function (x) { return x.id === id; })[0]; if (!a) return;
    var item = a.plan && a.plan.item ? S().data().items.filter(function (x) { return x.id === a.plan.item; })[0] : null;
    if (item) S().removeItem(item);
    d = window.Vault.get(); d.accounts = (d.accounts || []).filter(function (x) { return x.id !== id; }); window.Vault.save(d);
    if (window.Links && window.Links.syncLoans) window.Links.syncLoans();
    window.dispatchEvent(new Event('fin:change')); draw();
    toast('<i class="bi bi-trash3"></i> ' + esc(a.name || 'Plan') + ' deleted');
  }
  function shareMonth() {
    var p = partner(); if (!p) return;
    var now = new Date(), ym = dkey(new Date(now.getFullYear(), now.getMonth() + month, 1)).slice(0, 7), lines = monthLines(p.id, ym), m = monthSum(lines, p.id);
    var nb = window.I18N && window.I18N.lang === 'nb';
    var txt = (nb ? 'Felles for hjemmet, ' : 'Shared for the home, ') + mName(ym, true) + ':\n' + lines.map(function (l) { return '• ' + l.note + ': ' + kr(l.total) + (l.payer === 'me' ? (nb ? ' (jeg betalte)' : ' (I paid)') : l.payer === p.id ? (nb ? ' (du betalte)' : ' (you paid)') : ''); }).join('\n') +
      '\n' + (nb ? 'Til sammen ' : 'Together ') + kr(m.total) + '.\n' + (Math.abs(m.net) < 1 ? (nb ? 'Det går opp av seg selv 🙂' : 'It evens out by itself 🙂') : m.net > 0 ? (nb ? 'Du sender meg ' : 'You send me ') + kr(m.net) + ' 🙂' : (nb ? 'Jeg sender deg ' : 'I send you ') + kr(-m.net) + '.');
    if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(txt).then(function () { toast('<i class="bi bi-clipboard-check"></i> Copied – paste it in a message'); }); } catch (e) {}
  }

  /* ---------- events ---------- */
  if (mount) {
    mount.addEventListener('click', function (e) {
      var b, p = partner();
      if ((b = e.target.closest('[data-hs2q]')) && b.closest('[data-hs2setup]')) { var f = b.closest('form'); f.pct.value = b.dataset.hs2q; f.querySelectorAll('[data-hs2q]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === b)); }); return; }
      if ((b = e.target.closest('[data-hs2pick]'))) { var q = S().person(b.dataset.hs2pick), f2 = b.closest('form'); if (q && f2) f2.who.value = q.name; return; }
      if (e.target.closest('[data-hs2add]')) { buySheet(null); return; }
      if (e.target.closest('[data-hs2set]')) { setSheet(); return; }
      if (!p) return;
      if (e.target.closest('[data-hs2settle]')) { S().settle(p.id); return; }
      if (e.target.closest('[data-hs2hist]')) { S().history(p.id); return; }
      if (e.target.closest('[data-hs2msg]')) { S().message(p.id); return; }
      if (e.target.closest('[data-hs2copy]')) { shareMonth(); return; }
      if ((b = e.target.closest('[data-hs2m]'))) { month = Math.min(0, month + +b.dataset.hs2m); draw(); return; }
      if ((b = e.target.closest('[data-hs2plan]'))) { buySheet(b.dataset.hs2plan); return; }
      if ((b = e.target.closest('[data-hs2item]'))) { var it = S().data().items.filter(function (x) { return x.id === b.dataset.hs2item; })[0]; if (!it) return; var lp = it.plan ? plans().filter(function (a) { return a.plan.item === it.id; })[0] : null; if (lp) buySheet(lp.id); else S().split(it); }
    });
    mount.addEventListener('submit', function (e) { var f = e.target.closest('[data-hs2setup]'); if (!f) return; e.preventDefault(); if (saveSetup(f)) draw(); });
    ['tools:change', 'fin:change', 'features:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () { if (window.Vault.get()) draw(); }); });
    window.Vault.onUnlock(function () { setTimeout(function () { draw(); fromHash(); }, 150); });
    window.Vault.onLock(function () { mount.innerHTML = ''; });
    window.addEventListener('hashchange', fromHash);
  }
  function fromHash() {
    var h = location.hash, m = h.match(/^#hplan=(.+)$/);
    if (m) { history.replaceState(null, '', location.pathname + location.search); setTimeout(function () { buySheet(decodeURIComponent(m[1])); }, 200); }
    if (h === '#hshared' || m) { var c = document.getElementById('hshared'); if (c) c.scrollIntoView({ block: 'start' }); }
  }
  /* ⌘K */
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return Fe.on('house') ? [{ i: 'people', t: 'Bought something together', s: 'House · Shared home', run: function () { if (mount && partner()) buySheet(null); else location.href = '/cmd/house/#hshared'; }, x: 'shared home partner furniture møbler delbetaling avbetaling split felles' }] : [];
  });
  window.SharedHome = { add: function () { buySheet(null); }, plan: buySheet, draw: draw };
})();
