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
      out.push({ k: 'i', key: 'i:' + x.id, id: x.id, date: x.date, work: x.work, sub: x.sub, note: x.note || 'Shared', total: +x.total || 0, payer: x.payer, mine: +sh.me || 0, them: +sh[pid] || 0, cat: x.cat || 'other', plan: x.plan });
    });
    S().planPays(null, pid).forEach(function (q) {
      if (q.date.slice(0, 7) !== ym) return;
      out.push({ k: 'l', key: 'l:' + q.loan + ':' + q.n, id: q.loan, date: q.date, note: q.name + ' · payment ' + q.n + ' of ' + q.of, total: q.amount, payer: q.payer, mine: q.mine, them: q.them, cat: 'home' });
    });
    /* running costs you share, the month they're due (also the ones you each pay your own part of) */
    var B = window.Budget, now0 = dkey(new Date());
    runCosts(pid).forEach(function (f) {
      var sp = f.split; if (!sp.from || ym < sp.from) return;
      var dim = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(), dk = ym + '-' + pad(Math.min(+f.day || 1, dim)); if (dk > now0) return;
      var whole = B.fixedWhole(f, ym), mine = Math.round(whole * B.splitPart(f) * 100) / 100; if (!(whole > 0)) return;
      out.push({ k: 'b', key: 'b:' + f.id + ':' + ym, id: f.id, date: dk, note: f.name, total: whole, payer: sp.payer, mine: mine, them: Math.round((whole - mine) * 100) / 100, cat: 'home', bill: true });
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  function runCosts(pid) {
    var d = window.Vault.get() || {};
    return ((d.budget && d.budget.fixed) || []).filter(function (f) { return f && f.split && (!pid || f.split.pid === pid); });
  }
  function C() { return S().cfg(); }
  function lateRate() { var r = +C().lateRate; return r > 0 ? r : 12.25; }
  function daysSince(k) { return Math.floor((fromKey(dkey(new Date())) - fromKey(k)) / 864e5); }
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
    var ae = document.activeElement; if (mount.contains(ae) && ae.matches('input:not([type="checkbox"]), select, textarea')) return;   /* don't redraw under someone typing */
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
    var led = S().ledger(p.id), st = {}; led.rows.forEach(function (r) { st[r.key] = r; });
    var pl = plans(p.id), L = window.Loans;
    var planLeft = pl.reduce(function (a, x) { return a + (L ? L.owedNow(x) : 0); }, 0);
    var bal = b >= 1 ? esc(p.name) + ' owes you' : b <= -1 ? 'You owe ' + esc(p.name) : 'Between you';
    var body = '<div class="kit-tiles">' +
        (function () {
          var sd = S().sides ? S().sides(p.id) : { they: Math.max(0, b), you: Math.max(0, -b), net: b };
          return tile(esc(p.name) + ' owes you', sd.they >= 1 ? money(sd.they, 'mp-pos') : '0 kr', 'their part of what you paid', 'they') +
            tile('You owe ' + esc(p.name), sd.you >= 1 ? money(sd.you, 'mp-neg') : '0 kr', 'your part of what they paid', 'you') +
            tile('In total', Math.abs(b) >= 1 ? money(Math.abs(b), b >= 1 ? 'mp-pos' : 'mp-neg') : 'All square', Math.abs(b) >= 1 ? (b >= 1 ? 'you’re in plus · ' + esc(p.name) + ' sends you this' : 'you’re in minus · you send ' + esc(p.name) + ' this') : 'nothing to settle', 'balance');
        })() +
        tile('This month', money(cur.total), 'together · your part ' + esc(kr(cur.mine)), 'month') +
        tile('On the home ' + yr, money(yearHome), 'together' + (yearAll > yearHome ? ' · ' + esc(kr(yearAll)) + ' shared in all' : ''), 'year') +
        (pl.length ? tile('Bought in parts', money(planLeft), 'left on ' + pl.length + ' plan' + (pl.length === 1 ? '' : 's'), 'parts') : '') +
      '</div>' +
      '<div class="hs2-acts">' + (Math.abs(b) >= 1 ? '<button type="button" class="pill-btn sm" data-hs2settle><i class="bi bi-cash-coin"></i> Settle up</button>' : '') +
        '<button type="button" class="text-btn" data-hs2settle><i class="bi bi-arrow-left-right"></i> Payment</button>' +
        ((S().sides ? S().sides(p.id).you : -b) >= 1 && !S().owePlans(p.id).length ? '<button type="button" class="text-btn" data-hs2pb><i class="bi bi-calendar2-check"></i> Pay back monthly</button>' : '') +
        '<button type="button" class="text-btn" data-hs2hist><i class="bi bi-clock-history"></i> History</button>' +
        (Math.abs(b) >= 1 ? '<button type="button" class="text-btn" data-hs2msg><i class="bi bi-chat-text"></i> Send a reminder</button>' : '') + '</div>' + paybackLine(p, led);
    body += oweSection(p) + coveredSection(p, led) + runSection(p, st);
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
    var mb = '<div class="hs2-mh"><span class="hs2-nav"><button type="button" class="icon-btn sm" data-hs2m="-1" aria-label="Earlier month"><i class="bi bi-chevron-left"></i></button><b>' + esc(mName(ym, true)) + '</b>' +
      '<button type="button" class="icon-btn sm" data-hs2m="1" aria-label="Later month"' + (month >= 0 ? ' disabled' : '') + '><i class="bi bi-chevron-right"></i></button></span></div>';
    if (!lines.length) mb += '<p class="empty kit-empty">Nothing shared in ' + esc(mName(ym, true)) + '. Bought something for the home together? Add it with <b>+ Add</b>.</p>';
    else {
      mb += '<ul class="mp-list hs2-lines">' + lines.map(function (l) {
        var pay = l.payer === 'me' ? 'you paid' : l.payer === p.id ? esc(p.name) + ' paid' : 'each paid their part', r = st[l.key];
        var chip = r ? '<span class="hs2-st hs2-' + r.state + '">' + (r.state === 'paid' ? '<i class="bi bi-check2"></i> paid back' + (r.paidAt && r.paidAt !== r.date ? ' ' + esc(fmt(r.paidAt)) : '') : r.state === 'part' ? esc(kr(r.left)) + ' left' : (r.dir > 0 ? 'open' : 'you owe')) + '</span>' : '';
        return '<li class="mp-row"><button type="button" class="kit-main" ' + (l.k === 'l' ? 'data-hs2plan' : l.k === 'b' ? 'data-hs2run' : 'data-hs2item') + '="' + esc(l.id) + '"><span class="kit-ic" style="--c:' + (CATC[l.cat] || CATC.other) + '"><i class="bi bi-' + (l.k === 'l' ? 'calendar2-check' : l.k === 'b' ? 'lightning-charge' : l.sub ? 'arrow-left-right' : l.work ? WORKI[l.work] : CATI[l.cat] || 'people') + '"></i></span>' +
          '<span class="kit-x"><b>' + esc(l.note) + '</b><small>' + esc(fmt(l.date)) + ' · ' + esc(kr(l.total)) + ' · ' + pay + (l.work ? ' · ' + esc(WORKN[l.work] || '') : '') + '</small>' + chip + '</span><span class="money">' + esc(kr(l.mine)) + '</span></button></li>';
      }).join('') + '</ul>' +
      '<div class="hs2-sum"><div class="hs2-sumrow"><span>Together</span><b>' + money(m.total) + '</b></div>' +
        '<div class="hs2-sumrow"><span>You paid</span><b>' + money(m.paidMe) + '</b></div><div class="hs2-sumrow"><span>' + esc(p.name) + ' paid</span><b>' + money(m.paidThem) + '</b></div>' +
        '<div class="hs2-sumrow"><span>Your part</span><b>' + money(m.mine) + '</b></div>' +
        '<p class="hs2-even">' + (Math.abs(m.net) < 1 ? '<i class="bi bi-check2-circle"></i> This month evens out by itself' : '<i class="bi bi-arrow-left-right"></i> To even out ' + esc(mName(ym)) + ': <b>' + (m.net > 0 ? esc(p.name) + ' sends you ' + esc(kr(m.net)) : 'you send ' + esc(p.name) + ' ' + esc(kr(-m.net))) + '</b>') + '</p>' +
        '<button type="button" class="text-btn" data-hs2copy><i class="bi bi-share"></i> Share the month</button></div>';
    }
    body += sec('month', 'Your month together', esc(mName(ym, true)) + ' · ' + esc(kr(m.total)) + ' together', mb);
    body += workSection(p, yr) + moveSection();
    /* what you share, by category this year */
    var cats = Object.keys(byCat).sort(function (a, c) { return byCat[c] - byCat[a]; }), mx = cats.length ? byCat[cats[0]] : 1;
    if (cats.length > 1) body += sec('cats', 'Shared in ' + yr, esc(kr(yearAll)) + ' in all', '<ul class="hs2-cats">' + cats.map(function (c) {
      return '<li><span>' + esc(catName(c)) + '</span><span class="hs2-cb"><i style="width:' + Math.max(3, byCat[c] / mx * 100).toFixed(1) + '%;background:' + (CATC[c] || CATC.other) + '"></i></span>' + money(byCat[c]) + '</li>';
    }).join('') + '</ul>');
    mount.innerHTML = '<section class="card kit-card hs2" id="hshared">' + head + body + '</section>';
  }
  /* a section that folds to one line (title + a short summary); open or closed is remembered on this device */
  function secOpen() { try { return JSON.parse(localStorage.getItem('dash.hs2sec') || '{}') || {}; } catch (e) { return {}; } }
  function sec(k, title, sum, inner) {
    return '<details class="hs2-sec" data-hs2sec="' + k + '"' + (secOpen()[k] ? ' open' : '') + '><summary><span class="hs2-stt">' + title + '</span><small>' + sum + '</small><i class="bi bi-chevron-down"></i></summary><div class="hs2-sb">' + inner + '</div></details>';
  }
  var WORKN = { repair: 'minor repair', urgent: 'urgent repair', improve: 'improvement' };
  var WORKI = { repair: 'wrench', urgent: 'exclamation-triangle', improve: 'stars' };
  var REPAIR_CAP = 5000;
  /* the last repayment each way, and what's still open */
  function paybackLine(p, led) {
    var li = led.last.in, lo = led.last.out, open = led.rows.filter(function (r) { return r.dir > 0 && r.state !== 'paid'; }), oldest = open[0];
    var bits = [];
    if (li) bits.push('<i class="bi bi-arrow-down-left"></i> Last paid back by ' + esc(p.name) + ': <b>' + esc(fmt(li.date)) + ' · ' + esc(kr(li.amount)) + '</b>');
    if (lo) bits.push('<i class="bi bi-arrow-up-right"></i> You last paid ' + esc(p.name) + ': <b>' + esc(fmt(lo.date)) + ' · ' + esc(kr(lo.amount)) + '</b>');
    if (open.length) bits.push('<i class="bi bi-hourglass-split"></i> ' + open.length + ' open · oldest ' + esc(fmt(oldest.date)) + ' (' + daysSince(oldest.date) + ' days)');
    if (!bits.length) return '';
    return '<p class="hs2-pb">' + bits.join('<br>') + '</p>';
  }
  /* covered instalments (samboerkontrakt 3.4): 40 days to pay back, then a personal debt with overdue interest */
  function coveredSection(p, led) {
    var rows = led.rows.filter(function (r) { return r.sub && r.state !== 'paid'; }); if (!rows.length) return '';
    return '<h3 class="lp-h3">Covered instalments</h3><ul class="hs2-cov">' + rows.map(function (r) {
      var age = daysSince(r.date), left = 40 - age, debt = left < 0, interest = debt ? r.left * lateRate() / 100 * age / 365 : 0;
      var whoOwes = r.dir > 0 ? esc(p.name) + ' owes you' : 'You owe ' + esc(p.name);
      return '<li class="' + (debt ? 'late' : left <= 10 ? 'soon' : '') + '"><span><b>' + whoOwes + ' ' + esc(kr(r.left)) + '</b><small>' + esc(r.note) + ' · ' + esc(fmt(r.date)) + '</small>' +
        '<small>' + (debt ? '<i class="bi bi-exclamation-triangle"></i> Over 40 days: a personal debt from ' + esc(fmt(r.date)) + ' – overdue interest so far ' + esc(kr(interest)) + ' (' + esc(pc(lateRate())) + ' %)' : '<i class="bi bi-hourglass-split"></i> ' + left + ' day' + (left === 1 ? '' : 's') + ' left to pay it back (40-day rule)') + '</small></span>' +
        '<button type="button" class="text-btn" data-hs2settle>Settle up</button></li>';
    }).join('') + '</ul>';
  }
  /* shared running costs */
  function runSection(p, st) {
    var rc = runCosts(p.id), B = window.Budget, ym = dkey(new Date()).slice(0, 7);
    var head = '<div class="hs2-mh hs2-mr"><button type="button" class="text-btn" data-hs2run="new"><i class="bi bi-plus-lg"></i> Running cost</button></div>';
    if (!rc.length) return sec('run', 'Running costs', 'none yet', head + '<p class="muted hs2-note">Felleskostnader, power, internet, contents insurance … – shared every month. Add them once: your part goes into your budget, and when one of you pays the bill the other’s part is a claim to settle within 40 days.</p>' +
      '<div class="lf-chips mp-chips">' + RUNQ.map(function (q) { return '<button type="button" class="lf-chip" data-hs2runq="' + esc(q) + '">+ ' + esc(q) + '</button>'; }).join('') + '</div>');
    var tot = 0, mine = 0;
    var list = rc.map(function (f) {
      var whole = B.fixedWhole(f, ym), my = whole * B.splitPart(f); tot += whole; mine += my;
      var who = f.split.payer === 'me' ? 'you pay it' : f.split.payer === p.id ? esc(p.name) + ' pays it' : 'each pays their part';
      var r = st['b:' + f.id + ':' + ym];
      return '<li><button type="button" class="kit-main" data-hs2run="' + esc(f.id) + '"><span class="kit-ic" style="--c:#0891b2"><i class="bi bi-lightning-charge"></i></span><span class="kit-x"><b>' + esc(f.name) + '</b><small>' +
        (f.vary ? '≈ ' : '') + esc(kr(whole)) + ' · ' + who + (f.day ? ' · the ' + esc(f.day) + '.' : '') + ' · you ' + esc(pc(+f.split.pct)) + ' %' + (r && r.state !== 'paid' ? ' · ' + (r.dir > 0 ? 'claim open' : 'you owe') : '') + '</small></span><span class="money">' + esc(kr(my)) + '</span></button></li>';
    }).join('');
    return sec('run', 'Running costs', rc.length + ' a month · your part ' + esc(kr(mine)), head + '<ul class="mp-list hs2-run">' + list + '</ul><p class="muted hs2-note">' + esc(mName(ym, true)) + ': ' + esc(kr(tot)) + ' together · your part ' + esc(kr(mine)) + '</p>');
  }
  var RUNQ = ['Felleskostnader', 'Strøm og nettleie', 'Internett', 'Innboforsikring', 'TV og strømming', 'Renovasjon'];
  /* repairs and improvements (samboerkontrakt 4.3) */
  function workSection(p, yr) {
    var s = S().data(), items = s.items.filter(function (x) { return x.work && String(x.date).slice(0, 4) === yr && (x.shares || {})[p.id] != null; });
    if (!items.length) return '';
    var minor = items.filter(function (x) { return x.work === 'repair'; }).reduce(function (a, x) { return a + (+x.total || 0); }, 0), over = minor > REPAIR_CAP;
    var imp = items.filter(function (x) { return x.work === 'improve'; }), urg = items.filter(function (x) { return x.work === 'urgent'; });
    return sec('work', 'Repairs and improvements ' + yr, esc(kr(minor)) + ' of ' + esc(kr(REPAIR_CAP)) + ' minor repairs' + (over ? ' · over the limit' : ''),
      '<div class="hs2-cap"><p><span>Minor repairs, shared up to ' + esc(kr(REPAIR_CAP)) + ' a year</span><b' + (over ? ' class="mp-neg"' : '') + '>' + esc(kr(minor)) + '</b></p><span class="stack"><span style="width:' + Math.min(100, minor / REPAIR_CAP * 100).toFixed(1) + '%;background:' + (over ? '#e8743b' : '#a0673a') + '"></span></span>' +
      (over ? '<small class="mp-neg">Over the limit – the rest needs a written agreement first, or it’s the payer’s own cost.</small>' : '<small class="muted">' + esc(kr(REPAIR_CAP - minor)) + ' left this year</small>') + '</div>' +
      (urg.length || imp.length ? '<ul class="mp-list hs2-work">' + urg.concat(imp).map(function (x) {
        var ok = x.work === 'urgent' || x.agreed;
        return '<li><button type="button" class="kit-main" data-hs2item="' + esc(x.id) + '"><span class="kit-ic" style="--c:' + (x.work === 'urgent' ? '#e8743b' : '#8a6fdf') + '"><i class="bi bi-' + WORKI[x.work] + '"></i></span><span class="kit-x"><b>' + esc(x.note) + '</b><small>' + esc(fmt(x.date)) + ' · ' + esc(kr(x.total)) + ' · ' +
          (x.work === 'urgent' ? 'urgent repair – shared, tell ' + esc(p.name) + ' in writing' : ok ? 'agreed in writing ' + esc(fmt(x.agreed)) : '<span class="mp-neg"><i class="bi bi-exclamation-triangle"></i> no written agreement yet</span>') + '</small></span></button></li>';
      }).join('') + '</ul>' : ''));
  }
  /* moving in: the take-over date and a checklist */
  var MOVE = ['Flyttemelding to Folkeregisteret (Skatteetaten)', 'Power contract for the new address', 'Internet at the new place', 'Contents insurance (innboforsikring) for both', 'Payment protection insurance on your part of the loan', 'Ettersending of post (Posten)', 'New address at the bank, employer and NAV', 'Take-over protocol and meter reading on the day', 'Keys and the borettslag’s house rules', 'Register household items (the list in the Home inventory)'];
  function move() { var t = Fe.tools().hmove; return t && typeof t === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(t.date || '') ? t : null; }
  function moveSection() {
    var mv = move(); if (!mv) return '';
    var items = Array.isArray(mv.items) ? mv.items : [], done = items.filter(function (x) { return x.done; }).length, days = -daysSince(mv.date);
    if (days < -30 && done === items.length) return '';
    return sec('move', 'Moving in', esc(fromKey(mv.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + ' · ' +
      (days > 0 ? 'in ' + days + ' day' + (days === 1 ? '' : 's') : days === 0 ? 'today' : (-days) + ' days ago') + ' · ' + done + ' of ' + items.length + ' done',
      '<ul class="hs2-move">' + items.map(function (x) { return '<li><label class="lf-check"><input type="checkbox" data-hs2mv="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '> <span>' + esc(x.text) + '</span></label><button type="button" class="icon-btn sm" data-hs2mvdel="' + esc(x.id) + '" aria-label="Remove"><i class="bi bi-x"></i></button></li>'; }).join('') + '</ul>' +
      '<form class="hs2-mvadd" data-hs2mvadd><input name="t" placeholder="Add to the list" maxlength="80" autocomplete="off"><button type="submit" class="icon-btn sm" aria-label="Add"><i class="bi bi-plus-lg"></i></button></form>');
  }
  function setMove(fn) { var t = Fe.tools(); var mv = t.hmove && typeof t.hmove === 'object' ? t.hmove : {}; fn(mv); t.hmove = mv; Fe.saveTools(t); }

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
    var mv = move();
    X.box.innerHTML = shead('people', 'Who and how you split') + setupForm(partner()) + '<p class="muted hs2-note">Changing the % applies to new purchases. Ones already saved keep their split – open one to change it.</p>' +
      '<form class="hs2-more" data-hs2more><p class="mp-lbl">Moving in</p><label><span>Take-over date</span><input type="date" name="move" value="' + esc(mv ? mv.date : '') + '"></label>' +
      '<p class="muted hs2-note">Shows a moving checklist on this card and the day in your calendar. Empty = no list.</p>' +
      '<p class="mp-lbl">Overdue interest</p><label><span>Forsinkelsesrente, % a year</span><input name="rate" inputmode="decimal" value="' + esc(pc(lateRate())) + '"></label>' +
      '<p class="muted hs2-note">Used for a covered instalment not paid back within 40 days. It changes on 1 January and 1 July (Finanstilsynet) – 12,25 % from 1 July 2026.</p>' +
      '<div class="lf-foot"><span class="spacer"></span><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> Save these</button></div></form>';
    wireSetup(X.box, function () { X.close(); draw(); });
    X.box.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-hs2more]'); if (!f) return; e.preventDefault();
      var r = num(f.rate.value); if (r > 0 && r < 50) S().setCfg({ lateRate: r });
      var dt = f.move.value;
      setMove(function (m) {
        if (!dt) { delete m.date; return; }
        m.date = dt;
        if (!Array.isArray(m.items) || !m.items.length) m.items = MOVE.map(function (t, i) { return { id: 'm' + i + uid(), text: t, done: false }; });
      });
      X.close(); draw(); toast('<i class="bi bi-check2"></i> Saved');
    });
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
  function buySheet(loanId, pre) {
    var p = partner(); if (!p) return;
    var d = window.Vault.get() || {}, L = window.Loans, loan = loanId ? (d.accounts || []).filter(function (a) { return a.id === loanId && a.plan; })[0] : null;
    if (loanId && !loan) return;
    var pl = loan ? loan.plan : null;
    var downItem = pl && pl.item ? S().data().items.filter(function (x) { return x.id === pl.item; })[0] : null;
    var st = loan ? {
      note: loan.name, price: pl.price, date: loan.asOf, cat: 'home', payer: downItem ? downItem.payer : 'me', pct: L.part(loan) * 100, parts: true,
      down: pl.down || '', months: pl.months || '', rate: loan.rate || '', startFee: pl.startFee || '', fee: loan.fee || '', pay: loan.pay || '', payAuto: !pl.payTyped, day: loan.day || '', store: pl.payer || 'me', inv: false, kind: 'furniture', room: 'living'
    } : { work: '', agreed: '', note: '', price: '', date: dkey(new Date()), cat: 'home', payer: 'me', pct: myPct(), parts: false, down: '', months: 12, rate: '', startFee: '', fee: '', pay: '', payAuto: true, day: '', store: 'me', inv: true, kind: 'furniture', room: 'living' };
    /* from an item already in the Home inventory: fill in what it knows, and link the two instead of adding it again */
    if (pre && !loan) { st.note = pre.note || ''; st.price = pre.price || ''; if (pre.date) st.date = pre.date; if (+pre.pct > 0 && +pre.pct <= 100) st.pct = +pre.pct; st.inv = false; st.invLink = pre.inv; }
    var X = sheet(loan ? 'Bought in parts' : 'Bought together'), box = X.box;
    function calc() {
      var price = num(st.price) || 0, down = num(st.down) || 0, fin = Math.max(0, price - down + (num(st.startFee) || 0)), n = Math.round(num(st.months) || 0);
      var auto = n > 0 && fin > 0 ? Math.round(L.payment(fin, num(st.rate) || 0, n)) : 0, pay = st.payAuto ? auto : num(st.pay) || 0;
      var total = down + (pay + (num(st.fee) || 0)) * (n || 0);
      return { price: price, down: down, fin: fin, n: n, auto: auto, pay: pay, total: total, extra: total - price };
    }
    function preview() {
      var price = num(st.price) || 0, pct = num(st.pct) || 0, me = st.pct > 0 && st.pct <= 100 ? pct / 100 : 0;
      if (st.work === 'repair' && overCap(st)) return '<span class="mp-neg">This takes minor repairs this year over 5 000 kr.</span> Your part ' + esc(kr(price * me)) + ' – only with a written agreement.';
      if (st.work === 'improve' && !st.agreed) return '<span class="mp-neg">No written agreement date yet.</span> Your part would be ' + esc(kr(price * me)) + '.';
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
        (loan ? '' : '<p class="mp-lbl">What kind</p><div class="seg lf-seg hs2-kind">' + [['', 'Purchase'], ['repair', 'Minor repair'], ['urgent', 'Urgent repair'], ['improve', 'Improvement']].map(function (o) { return '<button type="button" data-bwork="' + o[0] + '" aria-pressed="' + (st.work === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
          (st.work === 'improve' || (st.work === 'repair' && overCap(st)) ? '<label class="hs2-agreed"><span>' + (st.work === 'improve' ? 'Agreed in writing on' : 'Over 5 000 kr this year – agreed in writing on') + '</span><input type="date" name="agreed" value="' + esc(st.agreed) + '"></label>' +
            '<p class="muted hs2-note">' + (st.work === 'improve' ? 'An improvement (a new kitchen, a bathroom …) can only be split if you both agreed in writing first – with the work, the estimate and the split.' : 'Minor repairs are shared up to 5 000 kr a year; above that, agree in writing first.') + '</p>' : '') +
          (st.work === 'urgent' ? '<p class="muted hs2-note">Necessary and urgent repairs to prevent damage are shared – tell ' + esc(p.name) + ' in writing straight away.</p>' : '')) +
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
        (loan ? '' : st.invLink ? '<p class="muted hs2-note"><i class="bi bi-box-seam"></i> Linked to this item in the Home inventory.</p>' : '<label class="lf-check"><input type="checkbox" name="inv"' + (st.inv ? ' checked' : '') + '> Add to the Home inventory (owned together)</label>' +
          (st.inv ? '<div class="mp-grid hs2-ig"><select name="kind" aria-label="Kind">' + opts(KINDS, st.kind) + '</select><select name="room" aria-label="Room">' + opts(ROOMS, st.room) + '</select></div>' : '')) +
        '<p class="mp-prev" id="hs2Prev">' + preview() + '</p>' +
        '<div class="lf-foot">' + (loan ? '<button type="button" class="text-btn danger" data-bdel><i class="bi bi-trash3"></i> Delete</button>' : '<span class="spacer"></span>') + '<button type="button" class="pill-btn wide" data-bsave><i class="bi bi-check2"></i> Save</button></div>';
    }
    function read() {
      ['note', 'price', 'date', 'cat', 'pct', 'down', 'months', 'rate', 'startFee', 'fee', 'day', 'kind', 'room', 'agreed'].forEach(function (n) { var i = box.querySelector('[name="' + n + '"]'); if (i) st[n] = i.value; });
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
      if ((b = e.target.closest('[data-bwork]'))) { read(); st.work = b.dataset.bwork; if (st.work) { st.inv = false; st.parts = false; } draw2(); return; }
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
      if (st.work) { x.work = st.work; if (st.agreed) x.agreed = st.agreed; else delete x.agreed; }
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
    var made = null;
    if (!st.parts) {
      made = sharedPayment(price, note, null);
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
    /* linked to an item already in the inventory: keep the ownership there in step */
    if (st.invLink) {
      var ti = Fe.tools(); (ti.hinv || []).forEach(function (x) {
        if (x.id !== st.invLink) return;
        x.shared = loan ? loan.id : made ? made.id : x.shared;
        if (pct < 100) { x.ownPct = Math.round(pct * 10) / 10; x.ownWith = p.name; }
      });
      Fe.saveTools(ti);
      if (loan && loan.plan) { var d3 = window.Vault.get(); (d3.accounts || []).forEach(function (x) { if (x.id === loan.id) x.plan.inv = st.invLink; }); window.Vault.save(d3); }
    }
    if (st.inv && !st.invLink && !st.work && !(loan && loan.plan && loan.plan.inv)) {
      var t = Fe.tools(); t.hinv = Array.isArray(t.hinv) ? t.hinv : [];
      invId = uid();
      t.hinv.push({ id: invId, shared: loan ? loan.id : made ? made.id : null, name: note, cat: st.kind || 'furniture', room: st.room || 'living', price: Math.round(price), bought: date, ownPct: pct < 100 ? Math.round(pct * 10) / 10 : null, ownWith: pct < 100 ? p.name : '',
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
  function overCap(st) {
    var p = partner(), yr = String(st.date || dkey(new Date())).slice(0, 4); if (!p) return false;
    var used = S().data().items.filter(function (x) { return x.work === 'repair' && String(x.date).slice(0, 4) === yr && (x.shares || {})[p.id] != null; }).reduce(function (a, x) { return a + (+x.total || 0); }, 0);
    return used + (num(st.price) || 0) > REPAIR_CAP;
  }

  /* a running cost you share: the whole bill, your %, who pays it; your part goes into fixed costs */
  function runSheet(id, preset) {
    var p = partner(); if (!p) return;
    var d = window.Vault.get() || {}, B = window.Budget, ym = dkey(new Date()).slice(0, 7), mv = move(), f = id && id !== 'new' ? runCosts().filter(function (x) { return x.id === id; })[0] : null;
    var st = f ? { name: f.name, amt: Math.round(B.fixedWhole(f, ym)), day: f.day || '', payer: f.split.payer, pct: +f.split.pct, vary: !!f.vary, from: f.split.from }
      : { name: preset || '', amt: '', day: '', payer: 'me', pct: 50, vary: /strøm|power/i.test(preset || ''), from: mv && mv.date.slice(0, 7) > ym ? mv.date.slice(0, 7) : ym };
    var X = sheet('Running cost'), box = X.box;
    function draw3() {
      var seg = function (v, t) { return '<button type="button" data-rpay="' + esc(v) + '" aria-pressed="' + (st.payer === v) + '">' + esc(t) + '</button>'; };
      var a = num(st.amt) || 0, me = (num(st.pct) || 0) / 100;
      box.innerHTML = shead('lightning-charge', f ? f.name : 'Running cost') +
        '<div class="mp-grid"><input name="note" placeholder="What? e.g. Felleskostnader" value="' + esc(st.name) + '" maxlength="50" autocomplete="off">' +
        '<input name="amt" inputmode="decimal" placeholder="' + (st.vary ? 'This month, kr' : 'Kr a month (whole bill)') + '" value="' + esc(st.amt) + '" autocomplete="off">' +
        '<input name="day" inputmode="numeric" placeholder="Due day" value="' + esc(st.day) + '" autocomplete="off" aria-label="Due day"></div>' +
        '<label class="lf-check"><input type="checkbox" name="vary"' + (st.vary ? ' checked' : '') + '> The amount changes from month to month</label>' +
        '<p class="mp-lbl">Who pays the bill?</p><div class="seg lf-seg">' + seg('me', 'You') + seg(p.id, p.name) + seg('each', 'Each our part') + '</div>' +
        '<p class="mp-lbl">Split</p><div class="mp-pct"><label>You pay<input inputmode="decimal" name="pct" value="' + esc(pc(st.pct)) + '"><span>%</span></label></div>' +
        '<label class="hs2-agreed"><span>Shared from</span><input type="month" name="from" value="' + esc(st.from) + '"></label>' +
        '<p class="mp-prev">' + (a ? 'Your part ' + esc(kr(a * me)) + ' a month goes into your fixed costs' + (st.payer === 'me' ? ' · ' + esc(p.name) + '’s ' + esc(kr(a * (1 - me))) + ' is a claim each month' : st.payer === p.id ? ' · you owe ' + esc(p.name) + ' ' + esc(kr(a * me)) + ' each month' : '') + '.' : 'Type the whole bill.') + '</p>' +
        '<div class="lf-foot">' + (f ? '<button type="button" class="text-btn danger" data-rdel><i class="bi bi-trash3"></i> Delete</button>' : '<span class="spacer"></span>') + '<button type="button" class="pill-btn wide" data-rsave><i class="bi bi-check2"></i> Save</button></div>';
    }
    function read() { ['note', 'amt', 'day', 'pct', 'from'].forEach(function (n) { var i = box.querySelector('[name="' + n + '"]'); if (i) st[n === 'note' ? 'name' : n] = i.value; }); var v = box.querySelector('[name="vary"]'); if (v) st.vary = v.checked; }
    box.addEventListener('input', function (e) { read(); if (/amt|pct/.test(e.target.name)) { var pv = box.querySelector('.mp-prev'), a = num(st.amt) || 0, me = (num(st.pct) || 0) / 100; if (pv) pv.innerHTML = a ? 'Your part ' + esc(kr(a * me)) + ' a month' : 'Type the whole bill.'; } });
    box.addEventListener('change', function (e) { if (e.target.name === 'vary') { read(); draw3(); } });
    box.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-rpay]'))) { read(); st.payer = b.dataset.rpay; draw3(); return; }
      if (e.target.closest('[data-rdel]')) { if (!confirm('Delete “' + f.name + '”? Claims already made from it go too.')) return; var d0 = window.Vault.get(); d0.budget.fixed = d0.budget.fixed.filter(function (x) { return x.id !== f.id; }); window.Vault.save(d0); window.dispatchEvent(new Event('fin:change')); X.close(); draw(); return; }
      if (!e.target.closest('[data-rsave]')) return;
      read();
      var name = String(st.name || '').trim(), a = num(st.amt), pct = num(st.pct), day = Math.round(num(st.day) || 0);
      var bad = function (n) { var i = box.querySelector('[name="' + n + '"]'); if (i) i.focus(); };
      if (!name) return bad('note'); if (!(a > 0)) return bad('amt'); if (!(pct >= 0 && pct <= 100)) return bad('pct'); if (st.day && !(day >= 1 && day <= 31)) return bad('day');
      var from = /^\d{4}-\d{2}$/.test(st.from) ? st.from : ym;
      var d1 = window.Vault.get(); d1.budget = d1.budget || { income: [], fixed: [] }; d1.budget.fixed = d1.budget.fixed || [];
      var row = f ? d1.budget.fixed.filter(function (x) { return x.id === f.id; })[0] : null;
      if (!row) { row = { id: uid(), acct: 'salary' }; d1.budget.fixed.push(row); }
      row.name = name.slice(0, 50); row.day = day || null; row.split = { pid: p.id, pct: Math.round(pct * 10) / 10, payer: st.payer, from: from };
      if (st.vary) { row.vary = true; row.months = Object.assign({}, row.months || {}); row.months[ym] = Math.round(a); if (!(+row.usual > 0)) row.usual = Math.round(a); delete row.full; }
      else { delete row.vary; delete row.months; delete row.usual; delete row.mbank; row.full = Math.round(a); }
      row.amount = Math.round(B.fixedAmt(row, ym));
      window.Vault.save(d1); window.dispatchEvent(new Event('fin:change'));
      X.close(); draw(); toast('<i class="bi bi-lightning-charge"></i> ' + esc(row.name) + ' – your part ' + esc(kr(row.amount)) + ' a month');
    });
    draw3();
  }
  /* one of you covered the other's mortgage instalment (samboerkontrakt 3.4) */
  function coverSheet(loanId) {
    var p = partner(); if (!p) { location.href = '/cmd/house/#hshared'; return; }
    var d = window.Vault.get() || {}, L = window.Loans, l = (d.accounts || []).filter(function (a) { return String(a.id) === String(loanId); })[0];
    var q = l && L.inner ? L.inner(l) : null, dir = 'me';
    var due = function () { return q ? Math.round(dir === 'me' ? q.them.pay + q.fee.them : q.me.pay + q.fee.me) : ''; };
    var X = sheet('Covered an instalment'), box = X.box;
    function draw4() {
      box.innerHTML = shead('arrow-left-right', 'Covered an instalment') +
        '<p class="muted">When one of you pays the other’s instalment: paid back within 40 days, it counts as if they paid it themselves. After that it’s a personal debt with overdue interest from the day it was paid.</p>' +
        '<div class="seg lf-seg"><button type="button" data-cdir="me" aria-pressed="' + (dir === 'me') + '">You covered ' + esc(p.name) + '’s</button><button type="button" data-cdir="them" aria-pressed="' + (dir === 'them') + '">' + esc(p.name) + ' covered yours</button></div>' +
        '<div class="mp-grid"><input name="amt" inputmode="decimal" placeholder="Amount, kr" value="' + esc(due()) + '" autocomplete="off"><input name="date" type="date" value="' + esc(dkey(new Date())) + '" aria-label="Date paid"></div>' +
        '<div class="lf-foot"><span class="spacer"></span><button type="button" class="pill-btn wide" data-csave><i class="bi bi-check2"></i> Save</button></div>';
    }
    box.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-cdir]'))) { dir = b.dataset.cdir; draw4(); return; }
      if (!e.target.closest('[data-csave]')) return;
      var a = num(box.querySelector('[name="amt"]').value), dt = box.querySelector('[name="date"]').value || dkey(new Date());
      if (!(a > 0)) { box.querySelector('[name="amt"]').focus(); return; }
      var x = { id: uid(), date: dt, note: (dir === 'me' ? 'You covered ' + p.name + '’s instalment' : p.name + ' covered your instalment') + (l ? ' · ' + l.name : ''), total: Math.round(a * 100) / 100, payer: dir === 'me' ? 'me' : p.id, cat: 'home', mode: 'amount', sub: true, loan: l ? l.id : null, add: false, shares: {} };
      x.shares.me = dir === 'me' ? 0 : x.total; x.shares[p.id] = dir === 'me' ? x.total : 0;
      S().saveItem(x, null, S().data());
      X.close(); draw(); toast('<i class="bi bi-hourglass-split"></i> Saved – 40 days to pay it back, until ' + esc(fmt(dkey(new Date(fromKey(dt).getTime() + 40 * 864e5)))));
    });
    draw4();
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

  /* paying back what you owe your partner, a set amount each month (a fixed cost – window.Shared.payBack) */
  function oweSection(p) {
    var L = window.Loans, ow = S().owePlans ? S().owePlans(p.id) : []; if (!ow.length || !L) return '';
    return '<h3 class="lp-h3">Paying back</h3><ul class="hs2-plans">' + ow.map(function (a) {
      var left = L.owedNow(a), paid = left <= 0.5, now = new Date(), nd = new Date(now.getFullYear(), now.getMonth(), 1), day = +a.day || 1;
      var dimN = function (d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
      if (Math.min(day, dimN(nd)) <= now.getDate() - 0 && dkey(new Date(nd.getFullYear(), nd.getMonth(), Math.min(day, dimN(nd)))) <= dkey(now)) nd = new Date(nd.getFullYear(), nd.getMonth() + 1, 1);
      if (a.asOf && a.asOf >= dkey(now)) { var st0 = fromKey(a.asOf); nd = new Date(st0.getFullYear(), st0.getMonth() + 1, 1); }
      var lastM = new Date(nd.getFullYear(), nd.getMonth() + Math.max(0, Math.ceil(left / (+a.pay || 1)) - 1), 1), c = { endLabel: lastM.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) };
      return '<li><button type="button" class="hs2-plan' + (paid ? ' is-done' : '') + '" data-hs2owe="' + esc(a.id) + '"><span class="hs2-pt"><b>' + esc(a.name) + '</b><small>' +
        (paid ? '<i class="bi bi-check2-circle"></i> Paid back' : esc(kr(a.pay)) + ' a month on the ' + (+a.day || 1) + '. · in your fixed costs' + ' · last ' + esc(c.endLabel)) + '</small></span>' +
        '<span class="hs2-pr">' + (paid ? '' : money(left) + '<small>left</small>') + '</span></button></li>';
    }).join('') + '</ul>';
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
      if (e.target.closest('[data-hs2pb]')) { S().payBack(p.id); return; }
      if ((b = e.target.closest('[data-hs2owe]'))) { S().payBack(p.id, b.dataset.hs2owe); return; }
      if (e.target.closest('[data-hs2msg]')) { S().message(p.id); return; }
      if (e.target.closest('[data-hs2copy]')) { shareMonth(); return; }
      if ((b = e.target.closest('[data-hs2run]'))) { runSheet(b.dataset.hs2run); return; }
      if ((b = e.target.closest('[data-hs2runq]'))) { runSheet('new', b.dataset.hs2runq); return; }
      if ((b = e.target.closest('[data-hs2mvdel]'))) { var mid = b.dataset.hs2mvdel; setMove(function (m) { m.items = (m.items || []).filter(function (x) { return x.id !== mid; }); }); return; }
      if ((b = e.target.closest('[data-hs2m]'))) { month = Math.min(0, month + +b.dataset.hs2m); draw(); return; }
      if ((b = e.target.closest('[data-hs2plan]'))) { buySheet(b.dataset.hs2plan); return; }
      if ((b = e.target.closest('[data-hs2item]'))) { var it = S().data().items.filter(function (x) { return x.id === b.dataset.hs2item; })[0]; if (!it) return; var lp = it.plan ? plans().filter(function (a) { return a.plan.item === it.id; })[0] : null; if (lp) buySheet(lp.id); else S().split(it); }
    });
    mount.addEventListener('toggle', function (e) {
      var d = e.target; if (!d.matches || !d.matches('details[data-hs2sec]')) return;
      var o = secOpen(); if (d.open) o[d.dataset.hs2sec] = 1; else delete o[d.dataset.hs2sec];
      try { localStorage.setItem('dash.hs2sec', JSON.stringify(o)); } catch (er) {}
    }, true);
    mount.addEventListener('submit', function (e) {
      var m = e.target.closest('[data-hs2mvadd]');
      if (m) { e.preventDefault(); var t = m.t.value.trim(); if (t) setMove(function (mv) { mv.items = (mv.items || []).concat([{ id: uid(), text: t.slice(0, 80), done: false }]); }); return; }
      var f = e.target.closest('[data-hs2setup]'); if (!f) return; e.preventDefault(); if (saveSetup(f)) draw();
    });
    mount.addEventListener('change', function (e) {
      var c = e.target.closest('[data-hs2mv]'); if (!c) return;
      var id = c.dataset.hs2mv, on = c.checked; setMove(function (m) { (m.items || []).forEach(function (x) { if (x.id === id) x.done = on; }); });
    });
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
  /* At a glance: claims and covered instalments near the 40-day limit, and moving day */
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!Fe.on('house') || !S()) return;
    var p = partner(), href = /\/cmd\/house\//.test(location.pathname) ? '#hshared' : '/cmd/house/#hshared';
    if (p) S().ledger(p.id).rows.forEach(function (r) {
      if (r.state === 'paid' || !(r.kind === 'bill' || r.sub)) return;
      var age = daysSince(r.date); if (age < 30) return;
      var late = age > 40;
      add(late ? 9 : 22, r.sub ? 'arrow-left-right' : 'lightning-charge', late ? '#e66767' : '#c98500',
        (r.dir > 0 ? p.name + ' owes you ' : 'You owe ' + p.name + ' ') + kr(r.left) + (late ? ' – over 40 days' : ' – ' + (40 - age) + ' day' + (40 - age === 1 ? '' : 's') + ' left'),
        r.note + (r.sub && late ? ' · now a personal debt with overdue interest' : ' · settle within 40 days'), href, { key: 'hs40:' + r.key + (late ? ':late' : ''), badge: late });
    });
    var mv = move();
    if (mv) {
      var days = -daysSince(mv.date), items = mv.items || [], left = items.filter(function (x) { return !x.done; }).length;
      if (days >= 0 && days <= 45 && left) add(days <= 7 ? 14 : 45, 'house-door', '#a0673a', days === 0 ? 'Take-over day!' : 'Moving in ' + days + ' day' + (days === 1 ? '' : 's'), left + ' thing' + (left === 1 ? '' : 's') + ' left on the moving list', href, { key: 'move:' + mv.date + ':' + left, tip: days > 14 });
    }
  });
  /* the calendar: take-over day */
  (window.EventsExtra = window.EventsExtra || []).push(function () {
    var mv = Fe.on('house') && move(); if (!mv) return [];
    return [{ id: 'rem:move', title: 'Take-over: the new home', allDay: true, start: fromKey(mv.date), days: 1, color: '#a0673a', readOnly: true, reminder: true, link: '/cmd/house/#hshared', location: '', notes: 'Moving checklist on the House page', exDays: {} }];
  });
  /* the take-over date, also set from the take-over guide (house-move.js) */
  function moveDate(dt) {
    setMove(function (m) {
      if (!dt) { delete m.date; return; }
      m.date = dt;
      if (!Array.isArray(m.items) || !m.items.length) m.items = MOVE.map(function (t, i) { return { id: 'm' + i + uid(), text: t, done: false }; });
    });
  }
  /* an item in the Home inventory → its split and who paid: open the purchase it came from, or add it to Shared home linked to the item */
  function forInv(invId) {
    var inv = (Fe.tools().hinv || []).filter(function (x) { return x.id === invId; })[0]; if (!inv) return;
    var p = partner();
    if (!p) { toast('<i class="bi bi-people"></i> Set up Shared home first – say who you share with'); goShared(); return; }
    var pl = plans(p.id).filter(function (a) { return a.id === inv.shared || (a.plan && a.plan.inv === invId); })[0];
    if (pl) { buySheet(pl.id); return; }
    var items = S().data().items, it = items.filter(function (x) { return x.id === inv.shared; })[0];
    if (!it && !inv.shared) {
      pl = plans(p.id).filter(function (a) { return a.name === inv.name; })[0]; if (pl) { buySheet(pl.id); return; }
      it = items.filter(function (x) { return x.home && x.note === inv.name; })[0];
    }
    if (it) { S().split(it); return; }
    buySheet(null, { note: inv.name, price: inv.price, date: inv.bought && /^\d{4}-\d{2}-\d{2}$/.test(inv.bought) ? inv.bought : '', pct: inv.ownPct != null && inv.ownPct !== '' ? inv.ownPct : null, inv: invId });
  }
  /* for the inventory row: is it linked to a purchase, who paid, your part, and any pay-back plan for it */
  function invInfo(invId) {
    var inv = (Fe.tools().hinv || []).filter(function (x) { return x.id === invId; })[0], p = partner(); if (!inv || !p || !S()) return null;
    var items = S().data().items, it = items.filter(function (x) { return x.id === inv.shared; })[0] || (!inv.shared ? items.filter(function (x) { return x.home && x.note === inv.name; })[0] : null);
    var ow = (S().owePlans ? S().owePlans(p.id) : []).filter(function (a) { return a.owe.inv === invId; })[0], L = window.Loans;
    return { p: p, item: it || null, theyPaid: !!(it && it.payer === p.id), mine: it ? +(it.shares || {}).me || 0 : 0, owe: ow ? { id: ow.id, left: L ? L.owedNow(ow) : +ow.balance, pay: +ow.pay } : null };
  }
  function payBackInv(invId) {
    var i = invInfo(invId); if (!i) return;
    if (i.owe) { S().payBack(i.p.id, i.owe.id); return; }
    var inv = (Fe.tools().hinv || []).filter(function (x) { return x.id === invId; })[0];
    var owed = Math.max(0, S().sides ? S().sides(i.p.id).you : -S().balance(i.p.id));
    S().payBack(i.p.id, null, { total: Math.min(i.mine, owed || i.mine), note: inv.name, inv: invId });
  }
  function goShared() { var t = document.querySelector('[data-ptab-go="shared"]'); if (t) t.click(); var c = document.getElementById('hshared'); if (c) setTimeout(function () { c.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 120); }
  window.SharedHome = { forInv: forInv, invInfo: invInfo, payBackInv: payBackInv, add: function () { buySheet(null); }, buy: function (pre) { buySheet(null, pre); }, plan: buySheet, draw: draw, cover: coverSheet, run: runSheet, move: move, moveDate: moveDate };
})();
