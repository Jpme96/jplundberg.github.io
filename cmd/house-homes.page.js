/* Homes (Nov 2026): the homes you live in over the years, and their history – House → History.
   One home is "now" (dash.tools.homeCur). Moving? "Set up your next home" archives the one you leave:
   its take-over guide (with the photos), the moving checklist, its loans (closed as paid off when sold, with a
   copy of how they stood), the price it was sold for – and starts a fresh take-over guide for the new place.
   Claims, projects and FDV documents belong to a home (item.home; old items without it = the first home), so
   each home keeps its own. On the House page you can look at an earlier home (sessionStorage dash.homeView):
   Projects, Docs and Claims then show that home, with a bar to go back to now.
   History shows every home with its years, take-over record, claims report, projects, documents (.zip),
   money while you lived there (spending per year, on the home, shared purchases), loans, value and power use.
   Data: dash.tools.homes = [{id, name, addr, from, to, kind, seller, agent, co, coName, price, sold, notes,
     take, move, loans:[{id,name,owed,part,rate,pay,with,value,at}]}], dash.tools.homeCur. */
/* The page part of house-homes.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is house-homes.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["homes"]; if (!__c) return;
  var isKey = __c.isKey, Fe = __c.Fe, raw = __c.raw, view = __c.view, isPast = __c.isPast, on = __c.on, get = __c.get, label = __c.label, years = __c.years, current = __c.current, setView = __c.setView, belongs = __c.belongs, ensure = __c.ensure;
  var HF = window.HouseFiles;
  var el = document.querySelector('[data-tool="hhist"]');
  var main = document.getElementById('fp');
  var HOUSE = /\/cmd\/house\/$/.test(location.pathname.replace(/index\.html$/, ''));
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +(p[2] || 1)); }
  function today() { return dkey(new Date()); }
  function fmt(k, o) { return isKey(k) ? fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, ''); if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var n = parseFloat(s.replace(',', '.')); return isFinite(n) ? n : null; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function copy(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function saveHomes(fn) { var t = Fe.tools(), l = Array.isArray(t.homes) ? t.homes : []; fn(l, t); t.homes = l; Fe.saveTools(t); }
  var bar = null;
  function drawBar() {
    if (!HOUSE || !main) return;
    var hero = main.querySelector('.fp-hero');
    if (!bar) { bar = document.createElement('div'); bar.className = 'hm-bar'; bar.id = 'hmBar'; if (hero) main.insertBefore(bar, hero.nextSibling); else main.insertBefore(bar, main.firstChild); }
    var l = raw(), v = view(), past = isPast(v);
    main.classList.toggle('hm-past', past && on());
    if (!on() || !window.Vault.get() || (l.length < 2 && !past)) { bar.hidden = true; bar.innerHTML = ''; bar._h = ''; return; }
    var h = get(v), html = past
      ? '<div class="hm-past-bar"><i class="bi bi-clock-history"></i><span><b>' + esc(label(h)) + '</b><small>' + esc(years(h)) + ' · an earlier home – projects, documents and claims from then</small></span><button type="button" class="pill-btn sm" data-hmnow><i class="bi bi-house-door"></i> <span data-t="ui.back-to-now">Back to now</span></button></div>'
      : '<div class="hm-chips" role="group" aria-label="Homes">' + l.slice().reverse().map(function (x) { return '<button type="button" class="lf-chip" data-hmview="' + esc(x.id) + '" aria-pressed="' + (x.id === v) + '"><i class="bi bi-' + (x.id === current() ? 'house-door' : 'clock-history') + '"></i> ' + esc(label(x)) + ' <small>' + esc(years(x)) + '</small></button>'; }).join('') + '</div>';
    bar.hidden = false;
    if (bar._h !== html) { bar._h = html; bar.innerHTML = html; }
  }
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-hmview]'))) { setView(b.dataset.hmview); if (isPast(b.dataset.hmview) && window.PageTabs) setTimeout(function () { window.PageTabs.show(window.PageTabs.current()); }, 60); return; }
    if (e.target.closest('[data-hmnow]')) { setView(null); return; }
    if (e.target.closest('[data-hmnew]')) return newHome();
    if ((b = e.target.closest('[data-hmedit]'))) return editHome(b.dataset.hmedit);
    if ((b = e.target.closest('[data-hmtake]'))) { if (window.HouseMove && window.HouseMove.record) window.HouseMove.record(b.dataset.hmtake === current() ? null : b.dataset.hmtake); return; }
    if ((b = e.target.closest('[data-hmclaims]'))) { if (window.HouseClaims) window.HouseClaims.reportAll({ home: b.dataset.hmclaims }); return; }
    if ((b = e.target.closest('[data-hmdocs]'))) { if (window.HouseDocs) window.HouseDocs.zip('', b.dataset.hmdocs); return; }
    if ((b = e.target.closest('[data-hmopen]'))) { var q = b.dataset.hmopen.split('|'); setView(q[0]); if (window.PageTabs) setTimeout(function () { window.PageTabs.show(q[1]); }, 80); return; }
    if ((b = e.target.closest('[data-hmtog]'))) { var id = b.dataset.hmtog; openH[id] = !openH[id]; draw(); }
  });
  function money(h) {
    var d = window.Vault.get() || {}, from = isKey(h.from) ? h.from : '0000', to = isKey(h.to) ? h.to : today(), yrs = {}, onHome = 0, all = 0;
    (d.expenses || []).forEach(function (e) { if (!e || !isKey(e.date) || e.date < from || e.date > to) return; var a = +e.amount || 0, y = e.date.slice(0, 4); yrs[y] = yrs[y] || { all: 0, home: 0 }; yrs[y].all += a; all += a; if (e.cat === 'home') { yrs[y].home += a; onHome += a; } });
    var sh = 0; try { ((window.Shared && window.Shared.data().items) || []).forEach(function (x) { if (x && x.home && isKey(x.date) && x.date >= from && x.date <= to) sh += +x.total || 0; }); } catch (e) {}
    var loans = [];
    if (h.id === current()) {
      (d.accounts || []).forEach(function (a) {
        if (!a || a.kind !== 'debt' || a.closedAt || (a.homeId && a.homeId !== h.id)) return;
        var L = window.Loans, owed = 0, part = 1; try { owed = L ? L.owedNow(a) : +a.balance || 0; part = L ? L.part(a) : 1; } catch (e) {}
        if (!(a.homeId || a.share || a.inner || a.home)) return;          // only loans that belong to the home
        loans.push({ name: a.name, owed: owed, part: part, rate: a.rate, value: a.home && +a.home.value || 0 });
      });
    } else loans = (h.loans || []).slice();
    var kwh = null; try { if (window.HousePlus) { var P = window.HousePlus.perMonth().m, s = 0, n = 0; Object.keys(P).forEach(function (m) { if (m >= from.slice(0, 7) && m <= to.slice(0, 7)) { s += P[m]; n++; } }); if (n >= 2) kwh = s / n * 12; } } catch (e) {}
    return { years: yrs, all: all, home: onHome, shared: sh, loans: loans, kwh: kwh };
  }
  function counts(h) {
    var c = Fe.list('hclaims').filter(function (x) { return belongs(x, h.id); }), p = Fe.list('hproj').filter(function (x) { return belongs(x, h.id); }), d = Fe.list('hdocs').filter(function (x) { return belongs(x, h.id); });
    var spent = p.reduce(function (a, x) { return a + (x.costs || []).reduce(function (b, y) { return b + (+(y && y.amount) || 0); }, 0); }, 0);
    return { claims: c, open: c.filter(function (x) { return /^(draft|sent|reply|agreed)$/.test(x.status); }).length, proj: p, spent: spent, docs: d };
  }
  var openH = {};
  function draw() {
    if (on() && window.Vault.get()) syncFrom();
    drawBar();
    if (!el) return;
    if (!on()) { el.hidden = true; el.innerHTML = ''; el._h = ''; return; }
    el.hidden = false;
    var l = raw().slice().reverse(), cur = current();
    if (!l.length) l = [{ id: 'h1', loans: [] }];
    var html = '<section class="card kit-card hm-card" id="hhist"><div class="card-head"><h2><i class="bi bi-clock-history"></i> <span data-t="ui.your-homes">Your homes</span></h2><div class="head-actions"><button type="button" class="text-btn" data-hmnew><i class="bi bi-plus-lg"></i> <span data-t="ui.new-home">New home</span></button></div></div>' +
      '<p class="muted hx-lead" data-t="ui.everything-stays-when-you-move-the-old-h">Everything stays: when you move, the old home keeps its take-over, claims, projects, documents and loans here – and you start fresh at the new place.</p>' +
      '<ol class="hm-list">' + l.map(function (h, i) {
        var isCur = h.id === cur, c = counts(h), m = money(h), op = openH[h.id] != null ? openH[h.id] : (isCur || i === 0), td = isCur ? (window.HouseMove && window.HouseMove.date()) || h.from : h.from;
        var yl = Object.keys(m.years).sort().reverse();
        return '<li class="hm-home' + (isCur ? ' now' : '') + (op ? ' open' : '') + '"><button type="button" class="hm-hh" data-hmtog="' + esc(h.id) + '" aria-expanded="' + op + '"><span class="kit-ic" style="--c:' + (isCur ? '#22b35e' : '#7a8794') + '"><i class="bi bi-' + (isCur ? 'house-door' : 'clock-history') + '"></i></span>' +
          '<span class="hm-ht"><b' + (h.name ? ' data-noi18n' : '') + '>' + esc(label(h)) + '</b><small>' + esc(isCur ? (isKey(h.from) ? 'since ' + fmt(h.from) : 'where you live now') : [years(h), 'moved out ' + fmt(h.to)].filter(Boolean).join(' · ')) + '</small></span><i class="bi bi-chevron-down hx-chev"></i></button>' +
          (op ? '<div class="hm-hb">' +
            '<div class="kit-tiles"><div class="kit-tile" data-tk="claims"><span data-t="ui.claims"><span data-t="ui.claims">Claims</span></span><b>' + c.claims.length + '</b><small>' + (c.open ? c.open + ' open' : '&nbsp;') + '</small></div><div class="kit-tile" data-tk="proj"><span data-t="ui.projects"><span data-t="ui.projects">Projects</span></span><b>' + c.proj.length + '</b><small>' + (c.spent ? esc(kr(c.spent)) : '&nbsp;') + '</small></div><div class="kit-tile" data-tk="docs"><span data-t="ui.documents"><span data-t="ui.documents">Documents</span></span><b>' + c.docs.length + '</b><small>&nbsp;</small></div></div>' +
            '<div class="hm-acts">' + (isKey(td) ? '<button type="button" class="text-btn" data-hmtake="' + esc(h.id) + '"><i class="bi bi-key"></i> Take-over ' + esc(fmt(td)) + '</button>' : '') +
              (c.claims.length ? '<button type="button" class="text-btn" data-hmclaims="' + esc(h.id) + '"><i class="bi bi-file-earmark-pdf"></i> <span data-t="ui.claims-report">Claims report</span></button>' : '') +
              (c.docs.length ? '<button type="button" class="text-btn" data-hmdocs="' + esc(h.id) + '"><i class="bi bi-file-earmark-zip"></i> <span data-t="ui.documents-zip">Documents (.zip)</span></button>' : '') +
              (!isCur ? '<button type="button" class="text-btn" data-hmopen="' + esc(h.id + '|claims') + '"><i class="bi bi-eye"></i> <span data-t="ui.open-this-home">Open this home</span></button>' : '') +
              '<button type="button" class="text-btn" data-hmedit="' + esc(h.id) + '"><i class="bi bi-pencil"></i> <span data-t="ui.details">Details</span></button></div>' +
            '<h3 class="lp-h3" data-t="ui.money-while-you-lived-there">Money while you lived there</h3>' +
            (yl.length ? '<table class="hm-yt"><thead><tr><th data-t="ui.year"><span data-t="ui.year">Year</span></th><th data-t="ui.spent"><span data-t="ui.spent">Spent</span></th><th data-t="ui.on-the-home"><span data-t="ui.on-the-home">On the home</span></th></tr></thead><tbody>' + yl.map(function (y) { return '<tr><td>' + y + '</td><td>' + esc(kr(m.years[y].all)) + '</td><td>' + esc(kr(m.years[y].home)) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted hl-small" data-t="ui.nothing-in-finances-from-those-years-yet">Nothing in Finances from those years yet.</p>') +
            (m.shared ? '<p class="hl-small"><span data-t="ui.bought-together-for-the-home">Bought together for the home:</span> <b>' + esc(kr(m.shared)) + '</b></p>' : '') +
            (m.loans.length ? '<ul class="hm-loans">' + m.loans.map(function (a) { return '<li><i class="bi bi-bank"></i><span><b data-noi18n>' + esc(a.name || 'Loan') + '</b><small>' + esc([isCur ? 'owed now ' + kr(a.owed) : 'owed when you moved ' + kr(a.owed), a.part < 1 ? 'your part ' + Math.round(a.part * 100) + ' %' : '', a.rate ? String(a.rate).replace('.', ',') + ' %' : '', isCur ? '' : 'paid off ' + fmt(a.at)].filter(Boolean).join(' · ')) + '</small></span></li>'; }).join('') + '</ul>' : '') +
            ((+h.price || +h.sold) ? '<p class="hl-small">' + esc([+h.price ? 'Bought for ' + kr(h.price) : '', +h.sold ? 'sold for ' + kr(h.sold) : '', +h.price && +h.sold ? ((h.sold - h.price >= 0 ? '+' : '−') + kr(Math.abs(h.sold - h.price))) : ''].filter(Boolean).join(' · ')) + '</p>' : '') +
            (m.kwh ? '<p class="hl-small"><i class="bi bi-lightning-charge"></i> About ' + esc(nf.format(m.kwh)) + ' kWh a year</p>' : '') +
            (h.notes ? '<p class="kit-notes" data-noi18n>' + esc(h.notes) + '</p>' : '') + '</div>' : '') + '</li>';
      }).join('') + '</ol>' +
      '<div class="hm-move"><i class="bi bi-truck"></i><span><b data-t="ui.moving"><span data-t="ui.moving">Moving?</span></b><small data-t="ui.set-up-your-next-home-the-one-you-leave">Set up your next home – the one you leave keeps its history here.</small></span><button type="button" class="pill-btn" data-hmnew><i class="bi bi-plus-lg"></i> <span data-t="ui.set-up-a-new-home">Set up a new home</span></button></div></section>';
    if (el._h !== html) { el._h = html; el.innerHTML = html; }
  }
  function newHome() {
    ensure();
    var X = HF.sheet(I18N.k('ui.a-new-home', 'A new home'), 'hm-box'), old = get(current()), d = window.Vault.get() || {};
    var debts = (d.accounts || []).filter(function (a) { return a && a.kind === 'debt' && !a.closedAt && (!a.homeId || a.homeId === old.id) && (a.share || a.inner || a.home || a.homeId); });
    X.box.innerHTML = HF.head('truck', I18N.k('ui.a-new-home', 'A new home'), I18N.k('ui.the-home-you-live-in-now-moves-to-histor', 'The home you live in now moves to History with everything that belongs to it.')) +
      '<form class="hx-form"><label class="hx-f"><span data-t="ui.name-2"><span data-t="ui.name-2">Name</span></span><input name="name" maxlength="40" placeholder="e.g. Bislett, The house in Asker" data-t-placeholder="ui.e-g-bislett-the-house-in-asker" autocomplete="off"></label>' +
      '<label class="hx-f"><span data-t="ui.address"><span data-t="ui.address">Address</span></span><input name="addr" maxlength="120" placeholder="Street and number, postcode" data-t-placeholder="ui.street-and-number-postcode" autocomplete="off"></label>' +
      '<div class="mp-grid hs2-sg"><label class="hx-f"><span data-t="ui.take-over-date"><span data-t="ui.take-over-date">Take-over date</span></span><input type="date" name="from" required></label><label class="hx-f"><span>You leave ' + esc(label(old)) + '</span><input type="date" name="to"></label></div>' +
      '<p class="mp-lbl" data-t="ui.the-new-home-is">The new home is</p><div class="lf-chips"><button type="button" class="lf-chip" data-hmkind="used" aria-pressed="true" data-t="ui.used-bought-from-the-owner"><span data-t="ui.used-bought-from-the-owner">Used – bought from the owner</span></button><button type="button" class="lf-chip" data-hmkind="new" aria-pressed="false" data-t="ui.new-from-a-builder"><span data-t="ui.new-from-a-builder">New – from a builder</span></button></div>' +
      '<label class="hx-f"><span data-t="ui.seller-or-builder">Seller or builder</span><input name="seller" maxlength="80" autocomplete="off"></label>' +
      '<p class="mp-lbl" data-t="ui.you-live-with">You live with</p><div class="lf-chips"><button type="button" class="lf-chip" data-hmco="" aria-pressed="true" data-t="ui.the-same-as-now">The same as now</button><button type="button" class="lf-chip" data-hmco="name" aria-pressed="false">Someone else</button><button type="button" class="lf-chip" data-hmco="none" aria-pressed="false" data-t="ui.just-me"><span data-t="ui.just-me">Just me</span></button></div>' +
      '<label class="hx-f" data-hmconame hidden><span data-t="ui.name-2"><span data-t="ui.name-2">Name</span></span><input name="cn" maxlength="60" autocomplete="off"></label>' +
      (debts.length ? '<p class="mp-lbl">Loans on ' + esc(label(old)) + '</p>' + debts.map(function (a) { return '<label class="lf-check"><input type="checkbox" name="close" value="' + esc(a.id) + '" checked> <span>Paid off when it’s sold: <b data-noi18n>' + esc(a.name || 'Loan') + '</b></span></label>'; }).join('') +
        '<p class="muted hs2-note" data-t="ui.a-paid-off-loan-stops-as-a-bill-and-leav">A paid-off loan stops as a bill and leaves net worth; a copy of how it stood stays in History. Untick a loan that moves with you.</p>' : '') +
      '<label class="hx-f"><span data-t="ui.sold-for-kr">Sold for, kr</span><input name="sold" inputmode="decimal" placeholder="Optional" data-t-placeholder="ui.optional" autocomplete="off"></label>' +
      '<div class="lf-foot"><span></span><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> <span data-t="ui.set-it-up">Set it up</span></button></div></form>';
    var kind = 'used', co = '';
    X.box.addEventListener('click', function (e) {
      var k = e.target.closest('[data-hmkind]'), c = e.target.closest('[data-hmco]');
      if (k) { kind = k.dataset.hmkind; X.box.querySelectorAll('[data-hmkind]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === k)); }); }
      if (c) { co = c.dataset.hmco; X.box.querySelectorAll('[data-hmco]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === c)); }); X.box.querySelector('[data-hmconame]').hidden = co !== 'name'; }
    });
    X.box.addEventListener('change', function (e) { if (e.target.name === 'from') { var t2 = X.box.querySelector('[name=to]'); if (!t2.value) t2.value = e.target.value; } });
    X.box.addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, from = f.from.value; if (!isKey(from)) return f.from.focus();
      var to = isKey(f.to.value) ? f.to.value : from, closeIds = [].map.call(f.querySelectorAll('[name=close]:checked'), function (x) { return x.value; });
      var before = { tools: copy(Fe.tools()), vault: copy(window.Vault.get()) };
      /* 1. close the old home's loans (paid off when sold), with a copy */
      var snaps = [], v = window.Vault.get();
      if (v && closeIds.length) {
        (v.accounts || []).forEach(function (a) {
          if (closeIds.indexOf(a.id) < 0) return;
          var owed = +a.balance || 0, part = 1; try { owed = window.Loans ? window.Loans.owedNow(a, fromKey(to)) : owed; part = window.Loans ? window.Loans.part(a) : 1; } catch (er) {}
          snaps.push({ id: a.id, name: a.name, owed: Math.round(owed), part: part, rate: a.rate, pay: a.pay, with: a.with, value: a.home && +a.home.value || 0, at: to, copy: copy(a) });
          a.balance = 0; a.pay = 0; a.asOf = to; a.closedAt = to; a.homeId = old.id; delete a.inner; delete a.float; delete a.home; delete a.extra;
        });
        window.Vault.save(v); window.dispatchEvent(new Event('fin:change'));
      }
      /* 2. the old home keeps its guide, moving list and loans; 3. the new one starts fresh */
      var t = Fe.tools(), nid = 'h' + uid();
      t.homes = (Array.isArray(t.homes) ? t.homes : []).map(function (h) {
        if (h.id !== old.id) return h;
        var tk = copy(t.htake) || {}; delete tk.open; delete tk.hide;
        return Object.assign({}, h, { to: to, take: tk, move: copy(t.hmove) || null, addr: h.addr || tk.addr || '', seller: h.seller || tk.seller || '', agent: h.agent || tk.agent || '', kind: h.kind || tk.kind, from: h.from || (t.hmove && t.hmove.date) || '', sold: num(f.sold.value) || h.sold || '', loans: (h.loans || []).concat(snaps) });
      });
      t.homes.push({ id: nid, name: f.name.value.trim().slice(0, 40), addr: f.addr.value.trim().slice(0, 120), from: from, kind: kind, seller: f.seller.value.trim().slice(0, 80), agent: '', co: co || '', coName: co === 'name' ? f.cn.value.trim().slice(0, 60) : '', loans: [] });
      t.homeCur = nid;
      t.htake = { addr: f.addr.value.trim().slice(0, 120), seller: f.seller.value.trim().slice(0, 80), kind: kind };
      delete t.hmove;
      Fe.saveTools(t);
      if (window.SharedHome && window.SharedHome.moveDate) window.SharedHome.moveDate(from);
      setView(null); X.close();
      toast('<i class="bi bi-house-add"></i> New home set up – the take-over guide is ready on Shared', function () { var t2 = Fe.tools(); Object.keys(t2).forEach(function (k) { delete t2[k]; }); Object.assign(t2, before.tools); Fe.saveTools(t2); if (before.vault) { window.Vault.save(before.vault); window.dispatchEvent(new Event('fin:change')); } });
      if (window.PageTabs) setTimeout(function () { window.PageTabs.show('shared'); }, 120);
    });
  }
  function editHome(id) {
    ensure(); var h = get(id); if (!h) return;
    var isCur = id === current(), X = HF.sheet(I18N.k('ui.the-home', 'The home'), 'hm-box');
    X.box.innerHTML = HF.head('house', isCur ? 'The home you live in' : 'An earlier home') +
      '<form class="hx-form"><label class="hx-f"><span data-t="ui.name-2"><span data-t="ui.name-2">Name</span></span><input name="name" maxlength="40" value="' + esc(h.name || '') + '" placeholder="e.g. Bislett"></label>' +
      '<label class="hx-f"><span data-t="ui.address"><span data-t="ui.address">Address</span></span><input name="addr" maxlength="120" value="' + esc(h.addr || (isCur ? (Fe.tools().htake || {}).addr || '' : '')) + '"></label>' +
      '<div class="mp-grid hs2-sg"><label class="hx-f"><span data-t="ui.moved-in"><span data-t="ui.moved-in">Moved in</span></span><input type="date" name="from" value="' + esc(h.from || '') + '"' + (isCur ? ' disabled' : '') + '></label>' + (isCur ? '' : '<label class="hx-f"><span data-t="ui.moved-out"><span data-t="ui.moved-out">Moved out</span></span><input type="date" name="to" value="' + esc(h.to || '') + '"></label>') + '</div>' +
      '<div class="mp-grid hs2-sg"><label class="hx-f"><span data-t="ui.bought-for-kr">Bought for, kr</span><input name="price" inputmode="decimal" value="' + esc(h.price || '') + '"></label><label class="hx-f"><span data-t="ui.sold-for-kr">Sold for, kr</span><input name="sold" inputmode="decimal" value="' + esc(h.sold || '') + '"></label></div>' +
      '<p class="mp-lbl">You live' + (isCur ? '' : 'd') + ' with</p><div class="lf-chips"><button type="button" class="lf-chip" data-hmco="" aria-pressed="' + !h.co + '"><span data-t="ui.as-in-the-claim-settings">As in the claim settings</span></button><button type="button" class="lf-chip" data-hmco="name" aria-pressed="' + (h.co === 'name') + '">Someone else</button><button type="button" class="lf-chip" data-hmco="none" aria-pressed="' + (h.co === 'none') + '"><span data-t="ui.just-me">Just me</span></button></div>' +
      '<label class="hx-f" data-hmconame' + (h.co === 'name' ? '' : ' hidden') + '><span data-t="ui.name-2"><span data-t="ui.name-2">Name</span></span><input name="cn" maxlength="60" value="' + esc(h.coName || '') + '"></label>' +
      '<label class="hx-f"><span data-t="ui.notes">Notes</span><textarea name="notes" rows="2" maxlength="600">' + esc(h.notes || '') + '</textarea></label>' +
      (isCur ? '<p class="muted hs2-note" data-t="ui.the-take-over-date-is-set-on-the-take-ov">The take-over date is set on the take-over guide (Shared tab).</p>' : '') +
      '<div class="lf-foot"><span></span><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> <span data-t="ui.save">Save</span></button></div></form>';
    var co = h.co || '';
    X.box.addEventListener('click', function (e) { var c = e.target.closest('[data-hmco]'); if (c) { co = c.dataset.hmco; X.box.querySelectorAll('[data-hmco]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === c)); }); X.box.querySelector('[data-hmconame]').hidden = co !== 'name'; } });
    X.box.addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target;
      saveHomes(function (l, t) { l.forEach(function (x) { if (x.id !== id) return; x.name = f.name.value.trim().slice(0, 40); x.addr = f.addr.value.trim().slice(0, 120); if (!isCur) { if (isKey(f.from.value)) x.from = f.from.value; if (isKey(f.to.value)) x.to = f.to.value; } x.price = num(f.price.value) || ''; x.sold = num(f.sold.value) || ''; x.co = co; x.coName = co === 'name' ? f.cn.value.trim().slice(0, 60) : ''; x.notes = f.notes.value.trim().slice(0, 600); });
        if (isCur && t.htake && f.addr.value.trim()) t.htake.addr = f.addr.value.trim().slice(0, 120); });
      X.close(); toast('<i class="bi bi-check2"></i> Saved');
    });
  }
  function syncFrom() { var t = Fe.tools(), mv = t.hmove, l = t.homes; if (!Array.isArray(l) || !mv || !isKey(mv.date)) return; var h = l.filter(function (x) { return x.id === current(); })[0]; if (h && h.from !== mv.date) { h.from = mv.date; Fe.saveTools(t); } }
  ['tools:change', 'features:change', 'fin:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(draw.t); draw.t = setTimeout(draw, 50); }); });
  window.Vault.onUnlock(function () { setTimeout(function () { ensure(); syncFrom(); draw(); }, 90); });
  window.Vault.onLock(function () { if (el) { el.innerHTML = ''; el._h = ''; el.hidden = true; } if (bar) { bar.innerHTML = ''; bar._h = ''; bar.hidden = true; } });
  Object.assign(window.Homes, { money: money, newHome: newHome, edit: editHome });
  (window.__ui = window.__ui || {})["homes"] = { el: el, newHome: newHome };
})();
