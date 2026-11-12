/* Finances, batch 3 (Oct 2026):
     Recurring payments – charges that come back every month, found in your bank imports and in what
                          you log yourself; add them as a subscription or a fixed cost in one tap.
     Shared expenses    – split a payment with someone, see who owes what, settle up.
   Cards mount into [data-tool="recur"] and [data-tool="shared"] on the Finances page; the At a glance
   lines and Settings → Pages → Finances work on every page. Data: dash.tools.shared,
   dash.tools.recurIgnore, dash.tools.fincfg (all inside the encrypted vault). */
/* The page part of money-plus.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is money-plus.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["moneyplus"]; if (!__c) return;
  var fromKey = __c.fromKey, detect = __c.detect, Fe = __c.Fe, esc = __c.esc, kr = __c.kr, person = __c.person, sh = __c.sh, sides = __c.sides, dkey = __c.dkey, owePays = __c.owePays, uid = __c.uid, saveSh = __c.saveSh, toast = __c.toast, balance = __c.balance, cfg = __c.cfg, dayN = __c.dayN, remove = __c.remove, save = __c.save, owePlans = __c.owePlans, planPays = __c.planPays, billClaims = __c.billClaims, addAs = __c.addAs, setIgnore = __c.setIgnore;
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, ''); if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var x = parseFloat(s.replace(',', '.')); return isFinite(x) ? x : null; }
  function fmt(k, o) { return fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }); }
  function ord(n) { var t = n % 100, u = n % 10; return n + (t > 10 && t < 14 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'); }
  var CAT = { groceries: 'Groceries', eating: 'Eating out', transport: 'Transport', shopping: 'Shopping', home: 'Home', fun: 'Fun', health: 'Health', travel: 'Travel', other: 'Other' };
  var CATC = { groceries: '#11a597', eating: '#d95926', transport: '#3987e5', shopping: '#c98500', home: '#a0673a', fun: '#d55181', health: '#8a6fdf', travel: '#0891b2', other: '#6b6d73' };
  var showIgnored = false;
  function recurCard(el) {
    var all = detect(), list = all.filter(function (r) { return !r.ignored; }), ign = all.filter(function (r) { return r.ignored; });
    var active = list.filter(function (r) { return r.active; }), fresh = list.filter(function (r) { return !r.sub && !r.fixed; });
    var perMonth = active.reduce(function (a, r) { return a + r.amount; }, 0), subsOn = Fe.on('subs');
    var row = function (r) {
      var c = CATC[r.cat] || CATC.other, done = r.sub || r.fixed;
      var status = r.sub ? '<span class="mp-tag ok"><i class="bi bi-check2"></i> <span data-t="ui.subscription">Subscription</span></span>' : r.fixed ? '<span class="mp-tag ok"><i class="bi bi-check2"></i> <span data-t="ui.fixed-cost">Fixed cost</span></span>' : '';
      var price = r.sub && Math.abs(+r.sub.amount - r.amount) >= 5 ? '<button type="button" class="pill-btn sm" data-rcprice="' + esc(r.key) + '">Update price to ' + esc(kr(r.amount)) + '</button>' : '';
      var acts = r.ignored ? '<button type="button" class="text-btn" data-rcunign="' + esc(r.key) + '"><span data-t="ui.show-again">Show again</span></button>'
        : done ? price : (subsOn ? '<button type="button" class="pill-btn sm" data-rcadd="' + esc(r.key) + '" data-kind="sub"><span data-t="ui.subscription">Subscription</span></button>' : '') +
          '<button type="button" class="' + (subsOn ? 'text-btn' : 'pill-btn sm') + '" data-rcadd="' + esc(r.key) + '" data-kind="fixed"><span data-t="ui.fixed-cost">Fixed cost</span></button>' +
          '<button type="button" class="icon-btn sm" data-rcign="' + esc(r.key) + '" aria-label="Not a repeating payment" title="Not a repeating payment"><i class="bi bi-x"></i></button>';
      return '<li class="mp-row' + (done ? ' is-done' : '') + (r.active ? '' : ' is-old') + '"><span class="kit-ic" style="--c:' + c + '"><i class="bi bi-' + (r.bank ? 'bank' : 'arrow-repeat') + '"></i></span>' +
        '<span class="kit-x"><b>' + esc(r.name) + '</b><small>' + esc(kr(r.amount) + ' · around the ' + ord(r.day) + ' · ' + r.n + ' months' + (r.active ? ' · next ≈ ' + fmt(r.next) : ' · last ' + fmt(r.last))) +
        (r.up ? ' <span class="mp-up">↑ from ' + esc(kr(r.prev)) + '</span>' : '') + '</small>' + status + '</span><span class="mp-acts">' + acts + '</span></li>';
    };
    var body = list.length || ign.length ? '<div class="kit-tiles">' +
        tile('Found', String(list.length), list.length === 1 ? 'repeating payment' : 'repeating payments') +
        tile(I18N.k('ui.per-month', 'Per month'), esc(kr(perMonth)), 'still running') +
        tile(I18N.k('ui.not-added', 'Not added'), String(fresh.length), fresh.length ? 'to the budget yet' : 'all in the budget') + '</div>' +
        (list.length ? '<ul class="mp-list">' + list.map(row).join('') + '</ul>' : '<p class="empty kit-empty" data-t="ui.nothing-left-to-look-at">Nothing left to look at.</p>') +
        (ign.length ? '<button type="button" class="text-btn mp-more" data-rcshowign>' + (showIgnored ? 'Hide' : 'Show') + ' ' + ign.length + ' not repeating</button>' + (showIgnored ? '<ul class="mp-list">' + ign.map(row).join('') + '</ul>' : '') : '')
      : '<p class="empty kit-empty" data-t="ui.when-the-same-shop-or-service-charges-yo">When the same shop or service charges you about once a month at the same price – in a bank import or what you log – it shows up here, so you can add it to the budget in one tap.</p>';
    el.innerHTML = '<section class="card kit-card mp-card" id="recur"><div class="card-head"><h2><i class="bi bi-arrow-repeat"></i> <span data-t="ui.recurring-payments">Recurring payments</span></h2><div class="head-actions"><a class="text-btn" href="/cmd/?settings=finance" aria-label="Settings" data-t-aria-label="ui.settings"><i class="bi bi-sliders"></i></a></div></div>' + body + '</section>';
  }
  function tile(label, value, sub) { return '<div class="kit-tile" data-tk="' + esc(label) + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function pname(s, id) { if (id === 'me') return 'You'; var p = person(s, id); return p ? p.name : '?'; }
  function payBackSheet(pid, loanId, pre) {
    var s = sh(), p = person(s, pid); if (!p) return;
    var d = window.Vault.get() || {}, a = loanId ? (d.accounts || []).filter(function (x) { return x.id === loanId && x.owe; })[0] : null, L = window.Loans;
    /* only what you owe them – what they owe you is kept apart and isn't taken off (Shared home shows both sides) */
    var owed = Math.max(0, sides(pid).you), left = a && L ? L.owedNow(a) : 0;
    var nx = new Date(); nx = new Date(nx.getFullYear(), nx.getMonth() + 1, 1);
    var first = a ? (function () { var st = fromKey(a.asOf); var f1 = new Date(st.getFullYear(), st.getMonth() + 1, 1); f1.setDate(Math.min(+a.day || 1, new Date(f1.getFullYear(), f1.getMonth() + 1, 0).getDate())); return dkey(f1); })() : dkey(nx);
    var S = sheet(I18N.k('ui.pay-back-each-month', 'Pay back each month')), box = S.box;
    box.innerHTML = head('calendar2-check', 'Pay back ' + p.name + ' each month') +
      (pre && !a ? '<p class="muted">' + esc(p.name) + ' paid for ' + esc(pre.note || 'it') + ' – pay your part back a set amount each month. It goes into your fixed costs, and each payment counts as paid to ' + esc(p.name) + '.</p>' : a ? '<p class="muted">' + esc(kr(left)) + ' left of ' + esc(kr(a.balance)) + '. Change the monthly amount or the day – payments already made stay.</p>'
        : '<p class="muted">' + (owed >= 1 ? 'You owe ' + esc(p.name) + ' ' + esc(kr(owed)) + ' now.' : 'You don’t owe ' + esc(p.name) + ' anything yet.') + ' Type what you owe in all – if it’s more, the difference is noted as money ' + esc(p.name) + ' lent you. The monthly amount goes into your fixed costs, and each payment counts as paid to ' + esc(p.name) + '.</p>') +
      '<div class="mp-grid">' +
        (a ? '' : '<label><span>' + (pre ? 'Your part to pay back, kr' : 'You owe in all, kr') + '</span><input name="total" inputmode="decimal" value="' + (pre && pre.total > 0 ? esc(String(Math.round(pre.total))) : owed >= 1 ? esc(String(Math.round(owed))) : '') + '" placeholder="e.g. 50 000" autocomplete="off"></label>') +
        '<label><span data-t="ui.each-month-kr">Each month, kr</span><input name="pay" inputmode="decimal" value="' + (a ? esc(String(a.pay)) : '') + '" placeholder="e.g. 2 000" autocomplete="off"></label>' +
        '<label><span data-t="ui.first-payment"><span data-t="ui.first-payment">First payment</span></span><input name="first" type="date" value="' + esc(first) + '"></label>' +
        (a ? '' : '<label><span data-t="ui.what-for-optional">What for (optional)</span><input name="note" maxlength="60" placeholder="e.g. Egenkapital" value="' + esc(pre && pre.note || '') + '" autocomplete="off"></label>') +
      '</div><p class="mp-prev" id="pbPrev"></p>' +
      '<div class="lf-foot">' + (a ? '<button type="button" class="text-btn danger" data-pbstop><i class="bi bi-stop-circle"></i> <span data-t="ui.stop">Stop</span></button>' : '<span class="spacer"></span>') + '<button type="button" class="pill-btn wide" data-pbsave><i class="bi bi-check2"></i> <span data-t="ui.save">Save</span></button></div>';
    function vals() { return { total: a ? +a.balance : num((box.querySelector('[name="total"]') || {}).value), pay: num(box.querySelector('[name="pay"]').value), first: box.querySelector('[name="first"]').value }; }
    function prev() {
      var v = vals(), base = a ? left : v.total, el = box.querySelector('#pbPrev');
      if (!(base > 0) || !(v.pay > 0)) { el.textContent = 'Type ' + (a ? 'the monthly amount.' : 'what you owe and the monthly amount.'); return; }
      var n = Math.ceil(base / v.pay), f = /^\d{4}-\d{2}-\d{2}$/.test(v.first) ? fromKey(v.first) : nx, last = new Date(f.getFullYear(), f.getMonth() + n - 1, 1);
      el.innerHTML = esc(n + ' payment' + (n === 1 ? '' : 's') + ' – the last in ' + last.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + '.');
    }
    box.addEventListener('input', prev); prev();
    box.addEventListener('click', function (e) {
      if (e.target.closest('[data-pbstop]')) {
        /* the payments made so far stay as payments to them; the rest is owed again as normal */
        var made = owePays(null, pid).filter(function (q) { return q.loan === a.id; }), s2 = sh();
        made.forEach(function (q) { s2.pays.push({ id: uid(), date: q.date, from: 'me', to: pid, amount: q.amount, note: a.name || 'Paying back' }); });
        saveSh(s2);
        var d2 = window.Vault.get(); d2.accounts = (d2.accounts || []).filter(function (x) { return x.id !== a.id; }); window.Vault.save(d2);
        if (window.Links && window.Links.syncLoans) window.Links.syncLoans();
        window.dispatchEvent(new Event('fin:change')); S.close();
        toast('<i class="bi bi-stop-circle"></i> Stopped – ' + esc(kr(left)) + ' still owed to ' + esc(p.name)); return;
      }
      if (!e.target.closest('[data-pbsave]')) return;
      var v = vals();
      if (!a && !(v.total > 0)) { box.querySelector('[name="total"]').focus(); return; }
      if (!(v.pay > 0)) { box.querySelector('[name="pay"]').focus(); return; }
      var f = /^\d{4}-\d{2}-\d{2}$/.test(v.first) ? fromKey(v.first) : nx;
      var asOf = new Date(f.getFullYear(), f.getMonth() - 1, 1); asOf.setDate(Math.min(f.getDate(), new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0).getDate()));
      var d2 = window.Vault.get(); d2.accounts = d2.accounts || [];
      if (a) {
        /* a new amount or day: start again from what's left today, keeping what's been paid as payments */
        var made = owePays(null, pid).filter(function (q) { return q.loan === a.id; }), s3 = sh();
        made.forEach(function (q) { s3.pays.push({ id: uid(), date: q.date, from: 'me', to: pid, amount: q.amount, note: a.name || 'Paying back' }); });
        saveSh(s3);
        d2.accounts.forEach(function (x) { if (x.id !== a.id) return; x.balance = Math.round(left * 100) / 100; x.pay = Math.round(v.pay); x.day = f.getDate(); x.asOf = dkey(asOf); delete x.extra; });
      } else {
        var extra = v.total - owed, note = (box.querySelector('[name="note"]').value || '').trim();
        if (pre) extra = 0;   /* your part of something they paid is already owed – nothing new lent */
        if (extra > 0.5) { var s4 = sh(); s4.pays.push({ id: uid(), date: dkey(new Date()), from: pid, to: 'me', amount: Math.round(extra * 100) / 100, note: note || 'Lent to you', lend: true }); saveSh(s4); }
        d2.accounts.push({ id: 'ow' + uid(), kind: 'debt', name: ('Pay back ' + p.name + (note ? ' – ' + note : '')).slice(0, 60), balance: Math.round(v.total * 100) / 100, orig: Math.round(v.total * 100) / 100, rate: 0, pay: Math.round(v.pay), fee: 0, day: f.getDate(), asOf: dkey(asOf), from: 'salary', fixed: true, owe: pre && pre.inv ? { pid: pid, inv: pre.inv } : { pid: pid } });
      }
      window.Vault.save(d2);
      if (window.Links && window.Links.syncLoans) window.Links.syncLoans();
      window.dispatchEvent(new Event('fin:change')); S.close();
      toast('<i class="bi bi-calendar2-check"></i> ' + esc(kr(v.pay)) + ' a month to ' + esc(p.name) + ' – in your fixed costs');
    });
  }
  function sharedCard(el) {
    var s = sh(), ym = dkey(new Date()).slice(0, 7);
    var bal = s.people.map(function (p) { return { p: p, b: balance(s, p.id) }; });
    var owed = bal.reduce(function (a, x) { return a + Math.max(0, x.b); }, 0), owe = bal.reduce(function (a, x) { return a + Math.max(0, -x.b); }, 0);
    var mine = s.items.filter(function (x) { return String(x.date).slice(0, 7) === ym; }).reduce(function (a, x) { return a + (+(x.shares || {}).me || 0); }, 0);
    var people = bal.filter(function (x) { return Math.abs(x.b) >= 1 || s.items.some(function (i) { return i.payer === x.p.id || (i.shares || {})[x.p.id] != null; }); })
      .sort(function (a, b) { return Math.abs(b.b) - Math.abs(a.b); });
    var recent = s.items.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).slice(0, 4);
    var body = s.items.length || s.pays.length ? '<div class="kit-tiles">' + tile(I18N.k('ui.owed-to-you', 'Owed to you'), esc(kr(owed)), owed ? 'by ' + bal.filter(function (x) { return x.b >= 1; }).length + ' ' + (bal.filter(function (x) { return x.b >= 1; }).length === 1 ? 'person' : 'people') : 'all square') +
        tile(I18N.k('ui.you-owe', 'You owe'), esc(kr(owe)), owe ? 'to ' + bal.filter(function (x) { return x.b <= -1; }).length + ' ' + (bal.filter(function (x) { return x.b <= -1; }).length === 1 ? 'person' : 'people') : 'nothing') +
        tile(I18N.k('ui.your-share', 'Your share'), esc(kr(mine)), 'this month') + '</div>' +
        '<ul class="mp-list">' + people.map(function (x) {
          var b = x.b, txt = b >= 1 ? 'owes you ' + kr(b) : b <= -1 ? 'you owe ' + kr(-b) : 'settled up';
          return '<li class="mp-row' + (Math.abs(b) < 1 ? ' is-done' : '') + '"><button type="button" class="kit-main" data-shp="' + esc(x.p.id) + '"><span class="kit-ic mp-av" style="--c:' + (b >= 1 ? '#22b35e' : b <= -1 ? '#e8743b' : '#7a8794') + '">' + esc((x.p.name || '?').slice(0, 1).toUpperCase()) + '</span>' +
            '<span class="kit-x"><b>' + esc(x.p.name) + '</b><small class="' + (b >= 1 ? 'mp-pos' : b <= -1 ? 'mp-neg' : '') + '">' + esc(txt) + '</small></span></button>' +
            (Math.abs(b) >= 1 ? '<span class="mp-acts"><button type="button" class="pill-btn sm" data-shsettle="' + esc(x.p.id) + '"><span data-t="ui.settle-up">Settle up</span></button></span>' : '') + '</li>';
        }).join('') + '</ul>' +
        (recent.length ? '<h3 class="lp-h3" data-t="ui.latest"><span data-t="ui.latest">Latest</span></h3><ul class="mp-list mp-recent">' + recent.map(function (x) {
          var others = Object.keys(x.shares || {}).filter(function (k) { return k !== 'me'; }).map(function (k) { return pname(s, k); });
          return '<li class="mp-row"><button type="button" class="kit-main" data-shitem="' + esc(x.id) + '"><span class="kit-ic" style="--c:' + (CATC[x.cat] || CATC.other) + '"><i class="bi bi-people"></i></span><span class="kit-x"><b>' + esc(x.note || 'Shared') + '</b><small>' +
            esc(fmt(x.date) + ' · ' + kr(x.total) + ' · ' + (x.payer === 'me' ? 'you paid' : 'paid by ' + pname(s, x.payer)) + ' · shared with ' + others.join(', ')) + '</small></span><span class="money">' + esc(kr((x.shares || {}).me || 0)) + '</span></button></li>';
        }).join('') + '</ul>' : '')
      : '<p class="empty kit-empty" data-t="ui.paid-for-dinner-a-cabin-or-the-groceries">Paid for dinner, a cabin or the groceries with someone? Split it here – only your share counts in your spending, and you see who owes what until you settle up.</p>';
    el.innerHTML = '<section class="card kit-card mp-card" id="shared"><div class="card-head"><h2><i class="bi bi-people"></i> <span data-t="ui.shared-expenses">Shared expenses</span></h2><div class="head-actions"><button type="button" class="text-btn" data-shnew><i class="bi bi-plus-lg"></i> <span data-t="ui.split">Split</span></button></div></div>' + body + '</section>';
  }
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
  function head(icon, t) { return '<div class="lf-head"><h3><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</h3><button type="button" class="icon-btn sm" data-x aria-label="Close" data-t-aria-label="ui.close"><i class="bi bi-x-lg"></i></button></div>'; }
  function splitSheet(item, preset) {
    var s = sh(), d = window.Vault.get() || {}, isNew = !item;
    var x = item ? JSON.parse(JSON.stringify(item)) : { id: uid(), date: dkey(new Date()), note: '', total: '', payer: 'me', shares: {}, cat: 'eating', exp: null, add: true };
    var withIds = Object.keys(x.shares || {}).filter(function (k) { return k !== 'me'; });
    var C = cfg(), mode = item ? (item.mode === 'amount' || item.mode === 'pct' ? item.mode : 'equal') : C.split === 'amount' || C.split === 'pct' ? C.split : 'equal', custom = {};
    var myPct = item && item.mode === 'pct' && item.pct != null ? +item.pct : +C.pct || 50;
    if (isNew && C.partner && person(s, C.partner)) withIds = [C.partner];       /* new splits start with your usual partner */
    if (preset && preset.payer) x.payer = preset.payer;
    if (mode === 'amount') Object.keys(x.shares || {}).forEach(function (k) { custom[k] = x.shares[k]; });
    if (preset) { x.note = preset.note || ''; x.total = preset.amount; x.date = preset.date; x.cat = preset.cat || 'other'; x.exp = preset.id; }
    var S = sheet(I18N.k('ui.split-a-payment', 'Split a payment'), 'mp-box'), box = S.box, newPerson = '';
    var recentEx = (d.expenses || []).filter(function (e) { return !e.shared && dayN(dkey(new Date())) - dayN(e.date) <= 21 && +e.amount > 0; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 8);
    function shares() {
      var tot = num(x.total) || 0, ids = ['me'].concat(withIds), out = {};
      if (mode === 'equal') { var each = Math.round(tot / ids.length * 100) / 100, acc = 0; ids.forEach(function (k, i) { out[k] = i === ids.length - 1 ? Math.round((tot - acc) * 100) / 100 : each; acc += each; }); }
      else if (mode === 'pct') {    /* you take your %, the others share the rest equally */
        var mine = Math.round(tot * myPct) / 100, left = tot - mine, each2 = Math.round(left / Math.max(1, withIds.length) * 100) / 100, acc2 = 0;
        out.me = mine; withIds.forEach(function (k, i) { out[k] = i === withIds.length - 1 ? Math.round((left - acc2) * 100) / 100 : each2; acc2 += each2; });
      }
      else { var rest = tot; withIds.forEach(function (k) { out[k] = num(custom[k]) || 0; rest -= out[k]; }); out.me = Math.round(rest * 100) / 100; }
      return out;
    }
    function draw() {
      var sv = shares(), tot = num(x.total) || 0;
      var prev = withIds.length && tot > 0 ? withIds.map(function (k) {
        return x.payer === 'me' ? esc(pname(s, k)) + ' owes you <b>' + esc(kr(sv[k])) + '</b>' : x.payer === k ? 'You owe ' + esc(pname(s, k)) + ' <b>' + esc(kr(sv.me)) + '</b>' : '';
      }).filter(Boolean).join(' · ') + ' · your share ' + esc(kr(sv.me)) : 'Pick who you shared it with.';
      box.innerHTML = head('people', isNew ? 'Split a payment' : 'Shared payment') +
        (isNew && recentEx.length && !x.exp ? '<p class="mp-lbl" data-t="ui.from-your-spending">From your spending</p><div class="lf-chips mp-chips">' + recentEx.map(function (e) { return '<button type="button" class="lf-chip" data-shfrom="' + esc(e.id) + '">' + esc((e.note || CAT[e.cat] || 'Expense') + ' · ' + kr(e.amount)) + '</button>'; }).join('') + '</div>' : '') +
        (x.exp ? '<p class="muted mp-from"><i class="bi bi-link-45deg"></i> From your spending – it will count only your share</p>' : '') +
        '<div class="mp-grid"><input name="note" placeholder="What was it? e.g. Dinner at Lofoten" value="' + esc(x.note) + '" maxlength="60" autocomplete="off">' +
        '<input name="total" placeholder="Total, kr" inputmode="decimal" value="' + esc(x.total === '' ? '' : String(x.total).replace('.', ',')) + '" autocomplete="off">' +
        '<select name="cat" aria-label="Category" data-t-aria-label="ui.category">' + Object.keys(CAT).map(function (k) { return '<option value="' + k + '"' + (k === x.cat ? ' selected' : '') + '>' + CAT[k] + '</option>'; }).join('') + '</select><input name="date" type="date" value="' + esc(x.date) + '" aria-label="Date"></div>' +
        '<p class="mp-lbl" data-t="ui.shared-with"><span data-t="ui.shared-with">Shared with</span></p><div class="lf-chips mp-chips">' + s.people.map(function (p) { return '<button type="button" class="lf-chip" data-shwith="' + esc(p.id) + '" aria-pressed="' + (withIds.indexOf(p.id) > -1) + '">' + esc(p.name) + '</button>'; }).join('') +
        '<span class="mp-newp"><input name="np" placeholder="New person" value="' + esc(newPerson) + '" maxlength="30" autocomplete="off"><button type="button" class="icon-btn sm" data-shaddp aria-label="Add person" data-t-aria-label="ui.add-person"><i class="bi bi-plus-lg"></i></button></span></div>' +
        (withIds.length ? '<p class="mp-lbl" data-t="ui.who-paid"><span data-t="ui.who-paid">Who paid?</span></p><div class="seg lf-seg">' + ['me'].concat(withIds).map(function (k) { return '<button type="button" data-shpayer="' + esc(k) + '" aria-pressed="' + (x.payer === k) + '">' + esc(k === 'me' ? 'You' : pname(s, k)) + '</button>'; }).join('') + '</div>' +
          '<p class="mp-lbl" data-t="ui.split"><span data-t="ui.split">Split</span></p><div class="seg lf-seg"><button type="button" data-shmode="equal" aria-pressed="' + (mode === 'equal') + '"><span data-t="ui.equally">Equally</span></button><button type="button" data-shmode="pct" aria-pressed="' + (mode === 'pct') + '">By %</button><button type="button" data-shmode="amount" aria-pressed="' + (mode === 'amount') + '"><span data-t="ui.by-amount">By amount</span></button></div>' +
          (mode === 'pct' ? '<div class="mp-pct"><label>You pay<input inputmode="decimal" data-shpct value="' + esc(String(myPct).replace('.', ',')) + '" aria-label="Your share in %"><span>%</span></label><div class="lf-chips mp-chips">' + [50, 60, 40, 70, 30].map(function (v) { return '<button type="button" class="lf-chip" data-shpctq="' + v + '" aria-pressed="' + (myPct === v) + '">' + v + ' / ' + (100 - v) + '</button>'; }).join('') + '</div></div>' : '') +
          (mode === 'amount' ? '<div class="mp-amts">' + withIds.map(function (k) { return '<label>' + esc(pname(s, k)) + '<input inputmode="decimal" data-shamt="' + esc(k) + '" value="' + esc(custom[k] == null ? '' : String(custom[k]).replace('.', ',')) + '" placeholder="kr"></label>'; }).join('') + '<label><span data-t="ui.you">You</span><b>' + esc(kr(sv.me)) + '</b></label></div>' : '') : '') +
        (!x.exp && x.payer !== 'me' && withIds.length ? '<label class="lf-check"><input type="checkbox" name="add"' + (x.add !== false ? ' checked' : '') + '> Add your share to Spending</label>' : '') +
        '<p class="mp-prev" id="mpPrev">' + prev + '</p>' +
        '<div class="lf-foot">' + (isNew ? '<span class="spacer"></span>' : '<button type="button" class="text-btn danger" data-shdel><i class="bi bi-trash3"></i> <span data-t="ui.delete">Delete</span></button>') + '<button type="button" class="pill-btn wide" data-shsave><i class="bi bi-check2"></i> <span data-t="ui.save">Save</span></button></div>';
    }
    function sync() { var f = box; ['note', 'total', 'date', 'cat'].forEach(function (n) { var i = f.querySelector('[name="' + n + '"]'); if (i) x[n] = n === 'total' ? i.value : i.value || x[n]; }); var a = f.querySelector('[name="add"]'); if (a) x.add = a.checked; var np = f.querySelector('[name="np"]'); if (np) newPerson = np.value; }
    function addPerson() {
      var n = newPerson.trim(); if (!n) return;
      var p = s.people.filter(function (q) { return String(q.name || '').toLowerCase() === n.toLowerCase(); })[0];
      if (!p) { p = { id: uid(), name: n.slice(0, 30) }; s.people.push(p); }
      if (withIds.indexOf(p.id) < 0) withIds.push(p.id); newPerson = ''; draw();
    }
    box.addEventListener('input', function (e) {
      if (e.target.dataset.shamt) { custom[e.target.dataset.shamt] = e.target.value; }
      if (e.target.hasAttribute('data-shpct')) { var pv = num(e.target.value); if (pv >= 0 && pv <= 100) myPct = pv; var pr = box.querySelector('#mpPrev'), sv1 = shares(); if (pr) pr.innerHTML = 'Your share ' + esc(kr(sv1.me)) + ' · ' + withIds.map(function (k) { return esc(pname(s, k)) + ' ' + esc(kr(sv1[k])); }).join(' · '); return; }
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
      if ((b = e.target.closest('[data-shpctq]'))) { myPct = +b.dataset.shpctq; draw(); return; }
      if ((b = e.target.closest('[data-shmode]'))) { mode = b.dataset.shmode; if (mode === 'amount') { var sv0 = shares(); withIds.forEach(function (k) { if (custom[k] == null) custom[k] = sv0[k]; }); } draw(); return; }
      if (e.target.closest('[data-shdel]')) { remove(item); S.close(); return; }
      if (e.target.closest('[data-shsave]')) {
        var tot = num(x.total);
        if (!(tot > 0)) { var ti = box.querySelector('[name="total"]'); if (ti) ti.focus(); return; }
        if (!withIds.length) { var np = box.querySelector('[name="np"]'); if (np) np.focus(); return; }
        var sv = shares();
        if (sv.me < 0) { box.querySelector('#mpPrev').innerHTML = '<span class="mp-neg" data-t="ui.the-amounts-add-up-to-more-than-the-tota">The amounts add up to more than the total.</span>'; return; }
        x.total = tot; x.shares = sv; x.mode = mode; if (mode === 'pct') x.pct = myPct; else delete x.pct;
        save(x, item, s); S.close();
      }
    });
    draw();
  }
  function settleSheet(pid) {
    var s = sh(), b = balance(s, pid), p = person(s, pid); if (!p) return;
    var sq = Math.abs(b) < 1, S = sheet(sq ? 'Payment' : 'Settle up'), box = S.box, theyPay = b > 0;
    box.innerHTML = head(sq ? 'arrow-left-right' : 'cash-coin', (sq ? 'Payment with ' : 'Settle up with ') + p.name) +
      '<p class="muted">' + (sq ? 'You’re all square. Paid ' + esc(p.name) + ' something ahead, or got money from them? Add it here and it counts in what you owe each other.' : esc(theyPay ? p.name + ' owes you ' + kr(b) : 'You owe ' + p.name + ' ' + kr(-b)) + '. How much was paid? Only part of it (a down payment)? Type that amount – the rest stays owed.') + '</p>' +
      '<div class="seg lf-seg"><button type="button" data-dir="in" aria-pressed="' + theyPay + '">' + esc(p.name) + ' paid you</button><button type="button" data-dir="out" aria-pressed="' + !theyPay + '">You paid ' + esc(p.name) + '</button></div>' +
      '<div class="mp-grid"><input name="amt" inputmode="decimal" value="' + (sq ? '' : esc(String(Math.round(Math.abs(b) * 100) / 100).replace('.', ','))) + '" placeholder="Amount, kr" aria-label="Amount, kr"><input name="date" type="date" value="' + dkey(new Date()) + '" aria-label="Date paid"></div>' +
      '<input name="note" placeholder="Note (optional) – e.g. Vipps, first part" data-t-placeholder="ui.note-optional-e-g-vipps-first-part" maxlength="60" autocomplete="off" aria-label="Note">' +
      '<button type="button" class="text-btn" data-shpb><i class="bi bi-calendar2-check"></i> ' + (owePlans(pid).length ? 'Paying back ' + esc(p.name) + ' each month – change' : 'I owe ' + esc(p.name) + ' – pay back each month') + '</button>' +
      '<div class="lf-foot">' + (sq ? '<span class="spacer"></span>' : '<button type="button" class="text-btn" data-shcopy><i class="bi bi-chat-text"></i> <span data-t="ui.send-a-reminder">Send a reminder</span></button>') + '<button type="button" class="pill-btn wide" data-shpay><i class="bi bi-check2"></i> ' + (sq ? 'Save' : 'Mark as paid') + '</button></div>';
    var dir = theyPay ? 'in' : 'out';
    box.addEventListener('click', function (e) {
      var q;
      if ((q = e.target.closest('[data-dir]'))) { dir = q.dataset.dir; box.querySelectorAll('[data-dir]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === q)); }); return; }
      if (e.target.closest('[data-shcopy]')) { share(pid); return; }
      if (e.target.closest('[data-shpb]')) { S.close(); var op = owePlans(pid)[0]; payBackSheet(pid, op ? op.id : null); return; }
      if (e.target.closest('[data-shpay]')) {
        var a = num(box.querySelector('[name="amt"]').value); if (!(a > 0)) return;
        var dt = box.querySelector('[name="date"]').value, nt = box.querySelector('[name="note"]').value.trim();
        var s2 = sh(), pay = { id: uid(), date: /^\d{4}-\d{2}-\d{2}$/.test(dt) ? dt : dkey(new Date()), from: dir === 'in' ? pid : 'me', to: dir === 'in' ? 'me' : pid, amount: a };
        if (nt) pay.note = nt.slice(0, 60);
        s2.pays.push(pay); saveSh(s2); S.close();
        toast('<i class="bi bi-check2-circle"></i> ' + esc(kr(a)) + ' marked as paid', function () { var s3 = sh(); s3.pays = s3.pays.filter(function (z) { return z.id !== pay.id; }); saveSh(s3); });
      }
    });
  }
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
        .concat(s.pays.filter(function (q) { return q.from === pid || q.to === pid; }).map(function (q) { return { k: 'p', date: q.date, x: q, v: q.from === 'me' ? +q.amount : -q.amount, t: (q.from === 'me' ? 'You paid ' + p.name : p.name + ' paid you') + (q.note ? ' · ' + q.note : '') }; }))
        .concat(planPays(null, pid).filter(function (q) { return q.payer !== 'each'; }).map(function (q) { return { k: 'l', date: q.date, x: { total: q.amount, id: q.loan }, v: q.payer === 'me' ? q.them : -q.mine, t: q.name + ' · payment ' + q.n + ' of ' + q.of }; }))
        .concat(owePays(null, pid).map(function (q) { return { k: 'l', date: q.date, x: { total: q.amount, id: q.loan }, v: q.amount, t: q.name + (q.extra ? ' · extra payment' : ' · payment ' + q.n + ' of ' + q.of) }; }))
        .concat(billClaims(null, pid).map(function (q) { return { k: 'l', date: q.date, x: { total: q.amount, id: q.bill }, v: q.payer === 'me' ? q.them : -q.mine, t: q.name + ' · ' + fmt(q.date + '', { month: 'long', year: 'numeric' }) }; }))
        .sort(function (a, c) { return a.date < c.date ? 1 : -1; });
      box.innerHTML = head('person', p.name) + '<p class="mp-bal ' + (b >= 1 ? 'mp-pos' : b <= -1 ? 'mp-neg' : '') + '">' + esc(b >= 1 ? 'Owes you ' + kr(b) : b <= -1 ? 'You owe ' + kr(-b) : 'Settled up') + '</p>' +
        '<ul class="mp-list">' + ev.map(function (r) {
          return '<li class="mp-row"><span class="kit-ic" style="--c:' + (r.k === 'p' ? '#22b35e' : r.k === 'l' ? '#a0673a' : '#3987e5') + '"><i class="bi bi-' + (r.k === 'p' ? 'cash-coin' : r.k === 'l' ? 'calendar2-check' : 'people') + '"></i></span><span class="kit-x"><b>' + esc(r.t) + '</b><small>' + esc(fmt(r.date) + (r.k !== 'p' ? ' · ' + kr(r.x.total) + ' in total' : '')) + '</small></span>' +
            '<span class="money ' + (r.v > 0 ? 'mp-pos' : r.v < 0 ? 'mp-neg' : '') + '">' + (r.v > 0 ? '+' : r.v < 0 ? '−' : '') + esc(kr(Math.abs(r.v))) + '</span>' +
            (r.k === 'p' ? '<button type="button" class="icon-btn sm" data-shdelpay="' + esc(r.x.id) + '" aria-label="Delete payment"><i class="bi bi-trash3"></i></button>' : r.k === 'l' ? '<span class="icon-btn sm" aria-hidden="true"><i class="bi bi-calendar2-check"></i></span>' : '<button type="button" class="icon-btn sm" data-shedit="' + esc(r.x.id) + '" aria-label="Edit"><i class="bi bi-pencil"></i></button>') + '</li>';
        }).join('') + '</ul>' +
        '<div class="lf-foot"><button type="button" class="text-btn danger" data-shdelp' + (ev.length ? ' hidden' : '') + '><i class="bi bi-trash3"></i> Remove ' + esc(p.name) + '</button><button type="button" class="text-btn" data-shcopy><i class="bi bi-chat-text"></i> <span data-t="ui.message">Message</span></button>' +
        (Math.abs(b) >= 1 ? '<button type="button" class="pill-btn" data-shsettle="' + esc(pid) + '"><span data-t="ui.settle-up">Settle up</span></button>' : '') + '</div>';
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
  Object.assign(window.MoneyPlus, { split: splitSheet });
  Object.assign(window.Shared, { payBack: payBackSheet, split: splitSheet, settle: settleSheet, history: personSheet, message: share });
  (window.__ui = window.__ui || {})["moneyplus"] = { boxes: boxes, splitSheet: splitSheet };
})();
