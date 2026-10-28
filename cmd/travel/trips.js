/* Travel page, part 2: trips and travel documents.
   A trip has four parts:
   - Overview: destination (weather, local time, currency), how far you've come, notes
   - Plan:     bookings or day by day, a map, and ideas for things to do
   - Prepare:  before-you-go checklist (documents, check-in, your own to-dos) and packing
   - Money:    costs vs budget (sent to Finances) and a currency converter
   Bookings, check-in and document expiry show up in the calendar; "Get there" opens Entur. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var F = window.Flow, C = window.Cal, W = window.World, esc = C.esc, T = F.TYPES, D = F.DOCS;
  var BASICS = ['Passport or ID', 'Phone charger', 'Wallet and cards', 'Headphones', 'Toothbrush', 'Medicine', 'Clothes for the days', 'Travel adapter'];
  var TODO_IDEAS = ['Buy an eSIM or check roaming prices', 'Download offline maps', 'Book transport to the airport', 'Ask someone to look after home', 'Set an out-of-office reply'];
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)); }
  function num(v) {
    var s = String(v || '').replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : null;
  }
  function today() { return F.dkey(new Date()); }
  function fmt(k, o) { return C.fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }); }
  var openId = null, pane = 'overview', planView = 'list';
  try { planView = localStorage.getItem('dash.tpPlanView') || 'list'; } catch (e) {}

  function all() { return F.travel(); }
  function find(t, id) { return t.trips.filter(function (x) { return x.id === id; })[0] || null; }
  function current() { return openId ? find(all(), openId) : null; }
  function update(fn) {
    var t = all(), tr = find(t, openId);
    if (!tr) return;
    fn(tr, t);
    F.saveTravel(t);
  }
  function sortItems(items) {
    return items.slice().sort(function (a, b) { return (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1; });
  }
  function tripDays(tr) {
    var out = [], d = tr.start, end = tr.end || tr.start;
    for (var i = 0; d <= end && i < 60; i++) { out.push(d); d = W.addDays(d, 1); }
    return out;
  }
  function relDays(tr) {
    var n = Math.round((C.fromKey(tr.start) - C.day0(new Date())) / 864e5);
    var len = tripDays(tr).length;
    if ((tr.end || tr.start) < today()) {
      var ago = -Math.round((C.fromKey(tr.end || tr.start) - C.day0(new Date())) / 864e5);
      return ago < 14 ? ago + ' day' + (ago === 1 ? '' : 's') + ' ago' : ago < 60 ? Math.round(ago / 7) + ' weeks ago' : fmt(tr.start, { month: 'long', year: 'numeric' });
    }
    if (n <= 0) return 'Travelling now · day ' + (1 - n) + ' of ' + len;
    return (n === 1 ? 'Tomorrow' : 'In ' + n + ' days') + ' · ' + len + ' day' + (len > 1 ? 's' : '');
  }
  function planned(tr) { return (tr.items || []).reduce(function (a, it) { return a + (num(it.cost) || 0); }, 0); }
  function abroad(tr) { return tr.place ? W.abroad(tr.place.cc) : false; }

  /* ================= travel documents ================= */
  function docStatus(d, until) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.expires || '')) return { cls: 'none', text: 'No expiry date' };
    var td = today();
    if (d.expires < td) return { cls: 'bad', text: 'Expired ' + fmt(d.expires) };
    if (until && d.expires < until) return { cls: 'bad', text: 'Expires ' + fmt(d.expires) + ' – during the trip' };
    var exp = C.fromKey(d.expires), warnFrom = new Date(exp.getFullYear(), exp.getMonth() - (+d.remind || 6), exp.getDate());
    var months = Math.round((exp - new Date()) / (30.4 * 864e5));
    if (new Date() >= warnFrom) return { cls: 'warn', text: 'Expires in ' + (months <= 1 ? 'under a month' : months + ' months') + ' · ' + fmt(d.expires) };
    return { cls: 'ok', text: 'Valid until ' + fmt(d.expires, { month: 'short', year: 'numeric' }) };
  }
  function renderDocs() {
    var docs = all().docs.slice().sort(function (a, b) { return (a.expires || '9') < (b.expires || '9') ? -1 : 1; });
    $('docList').innerHTML = docs.map(function (d) {
      var K = D[d.kind] || D.other, st = docStatus(d);
      return '<li><button type="button" class="doc-row" data-doc="' + esc(d.id) + '"><span class="ic"><i class="bi bi-' + K.icon + '"></i></span>' +
        '<span class="x"><b>' + esc(d.name || K.name) + '</b><span class="st ' + st.cls + '">' + esc(st.text) + '</span></span><i class="bi bi-chevron-right"></i></button></li>';
    }).join('');
    $('docIntro').hidden = docs.length > 0;
  }
  /* What the documents mean for one trip */
  function docChecks(tr) {
    var out = [], docs = all().docs, end = tr.end || tr.start, cc = tr.place && tr.place.cc;
    if (!abroad(tr)) return out;
    var ids = docs.filter(function (d) { return d.kind === 'passport' || d.kind === 'id'; });
    var outsideEEA = !W.inEEA(cc);
    var pass = ids.filter(function (d) { return d.kind === 'passport'; });
    var best = (outsideEEA ? pass : ids).filter(function (d) { return docStatus(d, end).cls !== 'bad' && docStatus(d, end).cls !== 'none'; })[0];
    if (best) {
      var six = outsideEEA && best.expires < W.addDays(end, 182);
      out.push({ key: 'doc:pass', state: six ? 'warn' : 'ok', text: (D[best.kind] || D.other).name + ' is valid for the trip',
        sub: six ? 'Expires ' + fmt(best.expires) + '. Many countries outside Europe want 6 months left – check the entry rules.' : 'Valid until ' + fmt(best.expires), doc: best.id });
    } else {
      var bad = (outsideEEA ? pass : ids)[0];
      out.push({ key: 'doc:pass', state: 'bad', text: outsideEEA ? 'You need a passport for ' + tr.place.country : 'Bring a passport or national ID',
        sub: bad ? docStatus(bad, end).text : 'Add your passport under Travel documents to have it checked.', doc: bad ? bad.id : null, add: bad ? null : 'passport' });
    }
    var ins = docs.filter(function (d) { return d.kind === 'insurance'; })[0];
    out.push(ins && docStatus(ins, end).cls !== 'bad'
      ? { key: 'doc:ins', state: 'ok', text: 'Travel insurance', sub: docStatus(ins, end).text, doc: ins.id }
      : { key: 'doc:ins', state: 'todo', text: 'Travel insurance', sub: ins ? docStatus(ins, end).text : 'Add it under Travel documents (most bank cards include some cover).', doc: ins ? ins.id : null, add: ins ? null : 'insurance' });
    if (W.inEEA(cc)) {
      var ehic = docs.filter(function (d) { return d.kind === 'ehic'; })[0];
      out.push(ehic && docStatus(ehic, end).cls !== 'bad'
        ? { key: 'doc:ehic', state: 'ok', text: 'EU health card', sub: docStatus(ehic, end).text, doc: ehic.id }
        : { key: 'doc:ehic', state: 'todo', text: 'EU health card (Europeisk helsetrygdkort)', sub: ehic ? docStatus(ehic, end).text : 'Free from Helsenorge – covers necessary care in the EU/EEA.', doc: ehic ? ehic.id : null, add: ehic ? null : 'ehic' });
    }
    return out;
  }

  /* ================= list ================= */
  function card(tr) {
    var items = tr.items || [], pack = tr.pack || [];
    var moves = items.filter(function (i) { return (T[i.type] || {}).move; }).length;
    var stays = items.filter(function (i) { return i.type === 'hotel'; }).length;
    var packed = pack.filter(function (p) { return p.done; }).length, cost = planned(tr);
    var issues = (tr.end || tr.start) >= today() ? docChecks(tr).filter(function (c) { return c.state === 'bad'; }).length : 0;
    var bits = [];
    if (issues) bits.push('<span class="bad"><i class="bi bi-exclamation-triangle"></i>Check documents</span>');
    if (moves) bits.push('<span><i class="bi bi-airplane"></i>' + moves + '</span>');
    if (stays) bits.push('<span><i class="bi bi-building"></i>' + stays + '</span>');
    if (pack.length) bits.push('<span><i class="bi bi-luggage"></i>' + packed + '/' + pack.length + '</span>');
    if (cost) bits.push('<span><i class="bi bi-cash-coin"></i>' + esc(kr(cost)) + '</span>');
    return '<button type="button" class="tp-card" data-trip="' + esc(tr.id) + '">' +
      '<span class="k">' + esc(relDays(tr)) + '</span><b>' + esc(tr.name) + '</b>' +
      '<span class="s">' + esc(window.TravelPage.rangeLabel(tr)) + (tr.place && tr.place.country && tr.place.country !== tr.dest ? ', ' + esc(tr.place.country) : '') + '</span>' +
      (bits.length ? '<span class="tp-bits">' + bits.join('') + '</span>' : '') + '<i class="bi bi-chevron-right tp-go"></i></button>';
  }
  function renderList() {
    var t = all(), td = today();
    var up = t.trips.filter(function (x) { return (x.end || x.start) >= td; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    $('tpUpcoming').innerHTML = up.map(card).join('');
    $('tpEmpty').hidden = up.length > 0;
    $('tvTripCount').textContent = up.length ? up.length : '';
    renderDocs();
  }
  window.TripCard = card;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-trip]');
    if (b) location.hash = 'trip=' + b.dataset.trip;
  });

  /* ================= one trip ================= */
  function renderDetail() {
    var tr = current();
    if (!tr) { closeTrip(); return; }
    var range = fmt(tr.start, { weekday: 'short', day: 'numeric', month: 'short' }) +
      (tr.end && tr.end !== tr.start ? ' – ' + fmt(tr.end, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ', ' + tr.start.slice(0, 4));
    var where = tr.place ? [tr.place.name, tr.place.country].filter(Boolean).join(', ') : (tr.dest || '');
    $('tpHead').innerHTML = '<div class="tp-head-main"><p class="k">' + esc(relDays(tr)) + '</p><h2>' + esc(tr.name) + '</h2>' +
      '<p class="muted">' + esc(range) + (where ? ' · ' + esc(where) : '') + '</p></div>' +
      '<div class="tp-head-acts"><a class="text-btn" href="../calendar/#d=' + esc(tr.start) + '"><i class="bi bi-calendar3"></i> In calendar</a>' +
      '<button class="text-btn" type="button" id="tpEdit"><i class="bi bi-pencil"></i> Edit</button></div>';
    document.querySelectorAll('#tpTabs [data-tp]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tp === pane)); });
    document.querySelectorAll('#tpDetail .tp-pane').forEach(function (p) { p.hidden = p.dataset.pane !== pane; });
    var checks = checklist(tr), open = checks.filter(function (c) { return !c.done; }).length;
    $('tpPrepCount').textContent = open ? open : '';
    if (pane === 'overview') { renderDest(tr); renderGlance(tr, checks); if (document.activeElement !== $('tpNotes')) $('tpNotes').value = tr.notes || ''; }
    if (pane === 'plan') { renderPlan(tr); renderIdeas(tr); renderMap(tr); }
    if (pane === 'prepare') { renderChecks(tr, checks); renderPack(tr); }
    if (pane === 'money') { renderMoney(tr); renderFx(tr); }
    ensurePlace(tr);
  }
  $('tpTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tp]');
    if (!b) return;
    pane = b.dataset.tp;
    renderDetail();
  });
  function goPane(p) { pane = p; renderDetail(); window.scrollTo({ top: Math.max(0, $('tpTabs').offsetTop - 80), behavior: 'smooth' }); }

  /* Older trips (or a typed destination) get their place looked up once */
  var placing = {};
  function ensurePlace(tr) {
    if (tr.place || !tr.dest || placing[tr.id]) return;
    placing[tr.id] = true;
    W.search(tr.dest).then(function (l) {
      if (!l[0]) return;
      var t = all(), x = find(t, tr.id);
      if (x && !x.place && x.dest === tr.dest) { x.place = l[0]; F.saveTravel(t); }
    }).catch(function () {});
  }

  /* ---------- overview: destination ---------- */
  var wxCache = {};
  function wxFor(tr) {
    if (!tr.place) return Promise.resolve({});
    var k = tr.place.lat + ',' + tr.place.lon + tr.start + (tr.end || '');
    if (!wxCache[k]) wxCache[k] = W.weather(tr.place, tr.start, tr.end || tr.start).catch(function () { return {}; });
    return wxCache[k];
  }
  function wxChip(day, w, short) {
    var x = W.wmo(w.code);
    return '<div class="wx' + (w.kind === 'typical' ? ' typ' : '') + '" title="' + esc(x[0]) + '">' +
      (short ? '' : '<span class="d">' + esc(fmt(day, { weekday: 'short' })) + '<small>' + C.fromKey(day).getDate() + '</small></span>') +
      '<i class="bi bi-' + x[1] + '"></i><span class="t">' + Math.round(w.max) + '°<small>' + Math.round(w.min) + '°</small></span>' +
      (w.rain != null && w.rain >= 30 ? '<span class="r">' + w.rain + '%</span>' : w.mm != null && w.mm >= 1 ? '<span class="r">' + Math.round(w.mm) + ' mm</span>' : '') + '</div>';
  }
  function renderDest(tr) {
    var box = $('tpDest');
    if (!tr.place) {
      box.innerHTML = '<div class="card-head"><h2><i class="bi bi-geo-alt"></i> Destination</h2></div>' +
        (tr.dest ? '<p class="muted"><i class="bi bi-arrow-repeat spin-i"></i> Looking up ' + esc(tr.dest) + '…</p>'
          : '<p class="muted">Add a destination city to see the weather for your days, the local time and the currency.</p><button class="text-btn" type="button" data-editTrip><i class="bi bi-pencil"></i> Add destination</button>');
      return;
    }
    var p = tr.place, ti = W.timeInfo(p.tz), cur = W.currencyOf(p.cc);
    box.innerHTML = '<div class="card-head"><h2><i class="bi bi-geo-alt"></i> ' + esc(p.name) + '</h2><span class="muted">' + esc([p.region, p.country].filter(Boolean).join(', ')) + '</span></div>' +
      '<div class="tp-wx" id="tpWx"><p class="muted"><i class="bi bi-arrow-repeat spin-i"></i> Weather…</p></div>' +
      '<ul class="tp-facts">' +
      (ti ? '<li><i class="bi bi-clock"></i><span><b>' + esc(ti.now) + '</b> local time · ' + esc(ti.text) + '</span></li>' : '') +
      (cur && cur !== 'NOK' ? '<li><i class="bi bi-currency-exchange"></i><span id="tpRate">' + esc(cur) + '</span></li>' : '') +
      '<li><i class="bi bi-map"></i><span><a href="' + esc(W.osmLink(p)) + '" target="_blank" rel="noopener">Map</a> · <a href="' + esc(W.gmapsLink(p.name + ', ' + p.country)) + '" target="_blank" rel="noopener">Google Maps</a></span></li>' +
      '</ul>';
    var id = tr.id;
    wxFor(tr).then(function (wx) {
      if (!$('tpWx') || openId !== id) return;
      var days = tripDays(tr).filter(function (d) { return wx[d]; }).slice(0, 14);
      if (!days.length) { $('tpWx').innerHTML = (tr.end || tr.start) < today() ? '' : '<p class="muted">No weather for these dates yet.</p>'; return; }
      var typ = days.some(function (d) { return wx[d].kind === 'typical'; }), fc = days.some(function (d) { return wx[d].kind === 'forecast'; });
      $('tpWx').innerHTML = '<div class="wx-row">' + days.map(function (d) { return wxChip(d, wx[d]); }).join('') + '</div>' +
        '<p class="muted wx-note">' + (fc && typ ? 'Forecast, then the same dates last year (faded)' : typ ? 'Same dates last year – the forecast comes 16 days before' : 'Forecast from Open-Meteo') + '</p>';
    });
    if (cur && cur !== 'NOK') W.rate(cur).then(function (r) {
      if (!$('tpRate') || !r) return;
      $('tpRate').innerHTML = '<b>1 ' + esc(cur) + ' = ' + esc(r.nok.toFixed(r.nok < 1 ? 3 : 2).replace('.', ',')) + ' kr</b> · <button type="button" class="link-btn" data-pane="money">Converter</button>';
    });
  }
  /* ---------- overview: at a glance ---------- */
  function renderGlance(tr, checks) {
    var items = sortItems(tr.items || []), pack = tr.pack || [], packed = pack.filter(function (p) { return p.done; }).length;
    var done = checks.filter(function (c) { return c.done; }).length, budget = num(tr.budget), cost = planned(tr);
    var now = new Date(), next = items.filter(function (it) { var w = F.when(it); return w && (w.timed ? w.start > now : it.date >= today()); })[0];
    var warn = checks.filter(function (c) { return c.state === 'bad' || c.state === 'warn'; });
    function row(icon, label, value, pct, go) {
      return '<button type="button" class="gl-row" data-pane="' + go + '"><i class="bi bi-' + icon + '"></i><span class="l">' + label + '</span><span class="v">' + value + '</span>' +
        (pct != null ? '<span class="gl-bar"><i style="width:' + Math.min(100, pct) + '%"></i></span>' : '') + '</button>';
    }
    var nw = next ? F.when(next) : null, NT = next ? (T[next.type] || T.other) : null;
    $('tpGlance').innerHTML = '<div class="card-head"><h2><i class="bi bi-speedometer2"></i> At a glance</h2></div>' +
      warn.map(function (c) { return '<button type="button" class="gl-warn ' + c.state + '" data-pane="prepare"><i class="bi bi-exclamation-triangle"></i><span><b>' + esc(c.text) + '</b><small>' + esc(c.sub || '') + '</small></span></button>'; }).join('') +
      (next ? '<div class="gl-next"><span class="ic"><i class="bi bi-' + NT.icon + '"></i></span><span class="x"><small>Next up</small><b>' + esc(next.title || NT.name) + '</b>' +
        '<span>' + esc(fmt(next.date, { weekday: 'short', day: 'numeric', month: 'short' })) + (next.time ? ' ' + esc(next.time) : '') + (next.from ? ' · ' + esc(next.from) : '') + '</span></span>' +
        (next.from && nw && nw.timed && next.type !== 'hotel' ? '<button type="button" class="tp-route" data-route="' + esc(next.id) + '"><i class="bi bi-signpost-split"></i><span>Get there</span></button>' : '') + '</div>' : '') +
      row('list-ol', 'Plan', items.length ? items.length + ' booking' + (items.length > 1 ? 's' : '') : 'Nothing yet', null, 'plan') +
      row('check2-square', 'Before you go', done + ' of ' + checks.length, checks.length ? done / checks.length * 100 : 0, 'prepare') +
      row('luggage', 'Packing', pack.length ? packed + ' of ' + pack.length : 'No list yet', pack.length ? packed / pack.length * 100 : null, 'prepare') +
      row('cash-coin', 'Booked', esc(kr(cost)) + (budget ? ' of ' + esc(kr(budget)) : ''), budget ? cost / budget * 100 : null, 'money');
  }
  $('tpDetail').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-route]'))) return routeItem(b.dataset.route);
    if ((b = e.target.closest('[data-pane]')) && !b.classList.contains('tp-pane')) return goPane(b.dataset.pane);
    if (e.target.closest('[data-edittrip]')) return openTripEditor(current());
  });

  /* ---------- plan: bookings / day by day ---------- */
  function itemLines(it) {
    var Ty = T[it.type] || T.other, line1 = [], line2 = [];
    if (it.time) line1.push(it.time + (it.endTime ? ' – ' + it.endTime + (it.endDate && it.endDate !== it.date ? ' (' + fmt(it.endDate, { day: 'numeric', month: 'short' }) + ')' : '') : ''));
    else if (it.type === 'hotel' && it.endDate) line1.push('until ' + fmt(it.endDate, { weekday: 'short', day: 'numeric', month: 'short' }));
    if (Ty.move && (it.from || it.to)) line1.push(esc(it.from || '?') + ' → ' + esc(it.to || '?'));
    else if (it.from) line1.push(esc(it.from));
    if (it.ref) line2.push('Ref <b class="tp-ref">' + esc(it.ref) + '</b>');
    if (num(it.cost)) line2.push(esc(kr(num(it.cost))));
    return { l1: line1.join(' · '), l2: line2.join(' · ') };
  }
  function itemRow(it, n) {
    var Ty = T[it.type] || T.other, w = F.when(it), L = itemLines(it);
    var canRoute = it.from && w && w.timed && it.date >= today() && it.type !== 'hotel';
    return '<div class="tp-item" data-item="' + esc(it.id) + '">' +
      '<span class="ic"><i class="bi bi-' + Ty.icon + '"></i>' + (n ? '<em>' + n + '</em>' : '') + '</span>' +
      '<button type="button" class="x" data-edit="' + esc(it.id) + '"><b>' + esc(it.title || Ty.name) + '</b>' +
      (L.l1 ? '<span class="s">' + L.l1 + '</span>' : '') + (L.l2 ? '<span class="s">' + L.l2 + '</span>' : '') + '</button>' +
      (canRoute ? '<button type="button" class="tp-route" data-route="' + esc(it.id) + '" title="Plan how to get to ' + esc(it.from) + ' in time"><i class="bi bi-signpost-split"></i><span>Get there</span></button>' : '') +
      '</div>';
  }
  var mapNo = {};    // item id -> number on the map
  function renderPlan(tr) {
    document.querySelectorAll('#tpPlanView [data-pv]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.pv === planView)); });
    var items = sortItems(tr.items || []);
    if (!items.length && planView === 'list') {
      $('tpItems').innerHTML = '<p class="empty">Add flights, trains, where you stay and what you’ll do. Everything with a date shows up in your calendar.</p>' +
        '<div class="tp-quick">' + ['flight', 'train', 'hotel', 'activity'].map(function (k) {
          return '<button type="button" class="tv-chip" data-quick="' + k + '"><i class="bi bi-' + T[k].icon + '"></i>' + T[k].name + '</button>';
        }).join('') + '</div>';
      return;
    }
    if (planView === 'list') {
      var html = '', last = '';
      items.forEach(function (it) {
        if (it.date !== last) { last = it.date; html += '<h3 class="tp-day">' + esc(fmt(it.date, { weekday: 'long', day: 'numeric', month: 'short' })) + '</h3>'; }
        html += itemRow(it, mapNo[it.id]);
      });
      $('tpItems').innerHTML = html;
      return;
    }
    /* day by day */
    var days = tripDays(tr), extra = items.map(function (i) { return i.date; }).filter(function (d) { return days.indexOf(d) < 0; });
    days = days.concat(extra.filter(function (d, i) { return extra.indexOf(d) === i; })).sort();
    var ideas = tr.ideas || [], id = tr.id;
    $('tpItems').innerHTML = '<div class="tp-days">' + days.map(function (d, i) {
      var its = items.filter(function (it) { return it.date === d; });
      var stay = items.filter(function (it) { return it.type === 'hotel' && it.date < d && (it.endDate || it.date) > d; })[0];
      var ids = ideas.filter(function (x) { return x.day === d; });
      return '<section class="tp-dd" data-day="' + d + '"><header><span class="n">Day ' + (i + 1) + '</span><b>' + esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'short' })) + '</b><span class="wxs" data-wx="' + d + '"></span></header>' +
        its.map(function (it) { return itemRow(it, mapNo[it.id]); }).join('') +
        ids.map(function (x) { return '<div class="tp-dd-idea' + (x.done ? ' done' : '') + '"><i class="bi bi-lightbulb"></i><span>' + esc(x.text) + '</span></div>'; }).join('') +
        (stay ? '<p class="tp-dd-stay"><i class="bi bi-building"></i> ' + esc(stay.title || 'Your stay') + '</p>' : '') +
        (!its.length && !ids.length && !stay ? '<p class="tp-dd-free">Free day – add an idea and pick this day.</p>' : '') + '</section>';
    }).join('') + '</div>';
    wxFor(tr).then(function (wx) {
      if (openId !== id) return;
      document.querySelectorAll('[data-wx]').forEach(function (el) { var w = wx[el.dataset.wx]; if (w) el.innerHTML = wxChip(el.dataset.wx, w, true); });
    });
  }
  $('tpPlanView').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pv]');
    if (!b) return;
    planView = b.dataset.pv;
    try { localStorage.setItem('dash.tpPlanView', planView); } catch (x) {}
    renderPlan(current());
  });
  $('tpItems').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-edit]'))) return openItem(b.dataset.edit);
    if ((b = e.target.closest('[data-quick]'))) return openItem(null, b.dataset.quick);
  });
  $('tpAddItem').addEventListener('click', function () { openItem(null); });

  /* Trip -> journey planner: be at the airport/station in time */
  function routeItem(id) {
    var tr = current(), it = tr && (tr.items || []).filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    var w = F.when(it), Ty = T[it.type] || T.other, buf = Ty.buffer;
    F.route({ toText: it.from, arriveBy: new Date(w.start.getTime() - buf * 60e3),
      context: { title: (it.title || Ty.name) + (Ty.move && it.to ? ' to ' + it.to : ''), note: buf ? buf + ' min before ' + it.time : 'starts ' + it.time, cat: 'life' } });
  }

  /* ---------- plan: map ---------- */
  function mapQuery(it, tr) {
    var Ty = T[it.type] || T.other, q = Ty.move ? it.to : it.from;
    if (!q) return '';
    if (!Ty.move && tr.place && q.toLowerCase().indexOf(tr.place.name.toLowerCase()) < 0) q += ', ' + tr.place.name;
    return q;
  }
  var mapSig = '', locating = {};
  function renderMap(tr) {
    var items = sortItems(tr.items || []), pts = [], n = 0, missing = 0;
    mapNo = {};
    items.forEach(function (it) {
      var q = mapQuery(it, tr);
      if (!q) return;
      if (it.geo && it.geo.q === q) { n++; mapNo[it.id] = n; pts.push({ lat: it.geo.lat, lon: it.geo.lon, n: n, label: esc(it.title || (T[it.type] || T.other).name) + '<br><small>' + esc(q) + '</small>', color: '#0891b2' }); }
      else if (!(it.geo && it.geo.q === q && it.geo.none)) { missing++; locateItem(tr.id, it.id, q); }
    });
    if (tr.place) pts.unshift({ lat: tr.place.lat, lon: tr.place.lon, label: esc(tr.place.name), color: 'var(--accent)' });
    $('tpMapOpen').hidden = !tr.place;
    if (tr.place) $('tpMapOpen').href = W.gmapsLink(tr.place.name + ', ' + tr.place.country);
    $('tpMapNote').textContent = missing ? 'Finding ' + missing + ' place' + (missing > 1 ? 's' : '') + ' on the map…'
      : n ? 'Numbers match the bookings in your plan.' : tr.place ? 'Addresses in your plan (hotel, activities, arrival station) are shown here.' : 'Add a destination to see a map.';
    var sig = JSON.stringify(pts.map(function (p) { return [p.lat, p.lon, p.n]; })) + document.documentElement.getAttribute('data-theme');
    if (!pts.length) { $('tpMap').hidden = true; mapSig = ''; return; }
    $('tpMap').hidden = false;
    if (sig === mapSig && $('tpMap')._map) { setTimeout(function () { $('tpMap')._map.invalidateSize(); }, 50); return; }
    mapSig = sig;
    W.map($('tpMap'), pts, { zoom: 11 }).catch(function () { $('tpMapNote').textContent = 'The map couldn’t load right now.'; });
  }
  function locateItem(tripId, itemId, q) {
    var key = itemId + '|' + q;
    if (locating[key]) return;
    locating[key] = true;
    W.locate(q).then(function (r) {
      var t = all(), tr = find(t, tripId), it = tr && (tr.items || []).filter(function (x) { return x.id === itemId; })[0];
      if (!it) return;
      it.geo = r ? { q: q, lat: r.lat, lon: r.lon } : { q: q, none: true };
      F.saveTravel(t);
    });
  }

  /* ---------- plan: ideas ---------- */
  function renderIdeas(tr) {
    var ideas = tr.ideas || [], days = tripDays(tr);
    $('tpIdeaCount').textContent = ideas.length ? ideas.filter(function (x) { return x.done; }).length + ' of ' + ideas.length + ' done' : '';
    $('tpIdeas').innerHTML = ideas.map(function (x) {
      return '<li class="' + (x.done ? 'done' : '') + '"><label><input type="checkbox" data-idea="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '><span>' + esc(x.text) + '</span></label>' +
        '<select data-ideaday="' + esc(x.id) + '" aria-label="Day for ' + esc(x.text) + '"><option value="">Any day</option>' + days.map(function (d, i) {
          return '<option value="' + d + '"' + (x.day === d ? ' selected' : '') + '>Day ' + (i + 1) + ' · ' + esc(fmt(d, { weekday: 'short', day: 'numeric' })) + '</option>';
        }).join('') + '</select>' +
        '<button type="button" class="tp-x" data-unidea="' + esc(x.id) + '" aria-label="Remove ' + esc(x.text) + '"><i class="bi bi-x"></i></button></li>';
    }).join('') || '<li class="tp-empty-li muted">Museums, restaurants, a view – collect them here and give them a day.</li>';
  }
  $('tpIdeaForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('tpIdeaIn').value.trim();
    if (!v) return;
    update(function (tr) { tr.ideas = tr.ideas || []; tr.ideas.push({ id: F.uid(), text: v.slice(0, 120), day: '', done: false }); });
    $('tpIdeaIn').value = '';
  });
  $('tpIdeas').addEventListener('change', function (e) {
    var id = e.target.dataset.idea, dd = e.target.dataset.ideaday;
    if (id) update(function (tr) { (tr.ideas || []).forEach(function (x) { if (x.id === id) x.done = e.target.checked; }); });
    if (dd) update(function (tr) { (tr.ideas || []).forEach(function (x) { if (x.id === dd) x.day = e.target.value; }); });
  });
  $('tpIdeas').addEventListener('click', function (e) {
    var b = e.target.closest('[data-unidea]');
    if (b) update(function (tr) { tr.ideas = (tr.ideas || []).filter(function (x) { return x.id !== b.dataset.unidea; }); });
  });

  /* ---------- prepare: before you go ---------- */
  function checklist(tr) {
    var done = tr.done || {}, out = [];
    docChecks(tr).forEach(function (c) { c.done = c.state === 'ok'; c.auto = true; out.push(c); });
    sortItems(tr.items || []).forEach(function (it) {
      var w = F.when(it);
      if (it.type !== 'flight' || !w || !w.timed) return;
      var opens = new Date(w.start.getTime() - 864e5);
      out.push({ key: 'checkin:' + it.id, text: 'Check in for ' + (it.title || 'your flight'), done: !!done['checkin:' + it.id],
        sub: (opens > new Date() ? 'Usually opens ' : 'Opened ') + opens.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + F.hm(opens) + ' (24 h before)' + (it.ref ? ' · ref ' + it.ref : '') });
    });
    var cur = tr.place && W.currencyOf(tr.place.cc);
    if (cur && cur !== 'NOK') out.push({ key: 'cash', text: 'Card that works in ' + cur + ', and a little cash', done: !!done.cash });
    (tr.todo || []).forEach(function (x) { out.push({ key: 'todo:' + x.id, text: x.text, done: !!x.done, own: x.id }); });
    return out;
  }
  function renderChecks(tr, checks) {
    var done = checks.filter(function (c) { return c.done; }).length;
    $('tpCheckCount').textContent = checks.length ? done + ' of ' + checks.length : '';
    $('tpChecks').innerHTML = checks.map(function (c) {
      var tick = c.auto
        ? '<span class="auto ' + c.state + '"><i class="bi bi-' + (c.state === 'ok' ? 'check-circle-fill' : c.state === 'todo' ? 'circle' : 'exclamation-triangle') + '"></i></span>'
        : '<input type="checkbox" data-check="' + esc(c.key) + '"' + (c.done ? ' checked' : '') + '>';
      var act = c.auto ? (c.doc ? '<button type="button" class="text-btn" data-doc="' + esc(c.doc) + '">View</button>'
        : c.add ? '<button type="button" class="text-btn" data-adddoc="' + esc(c.add) + '">Add</button>' : '')
        : c.own ? '<button type="button" class="tp-x" data-untodo="' + esc(c.own) + '" aria-label="Remove"><i class="bi bi-x"></i></button>' : '';
      return '<li class="' + (c.done ? 'done' : '') + (c.auto ? ' is-auto' : '') + '"><label>' + tick + '<span><b>' + esc(c.text) + '</b>' + (c.sub ? '<small>' + esc(c.sub) + '</small>' : '') + '</span></label>' + act + '</li>';
    }).join('') || '<li class="tp-empty-li muted">Add what you need to sort out before you leave.</li>';
    var have = (tr.todo || []).map(function (x) { return x.text.toLowerCase(); });
    $('tpTodoIdeas').hidden = TODO_IDEAS.every(function (x) { return have.indexOf(x.toLowerCase()) > -1; });
  }
  $('tpChecks').addEventListener('change', function (e) {
    var k = e.target.dataset.check;
    if (!k) return;
    update(function (tr) {
      if (k.indexOf('todo:') === 0) (tr.todo || []).forEach(function (x) { if ('todo:' + x.id === k) x.done = e.target.checked; });
      else { tr.done = tr.done || {}; if (e.target.checked) tr.done[k] = true; else delete tr.done[k]; }
    });
  });
  $('tpChecks').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-untodo]'))) update(function (tr) { tr.todo = (tr.todo || []).filter(function (x) { return x.id !== b.dataset.untodo; }); });
    else if ((b = e.target.closest('[data-adddoc]'))) openDoc(null, b.dataset.adddoc);
  });
  $('tpTodoForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('tpTodoIn').value.trim();
    if (!v) return;
    update(function (tr) { tr.todo = tr.todo || []; tr.todo.push({ id: F.uid(), text: v.slice(0, 100), done: false }); });
    $('tpTodoIn').value = '';
  });
  $('tpTodoIdeas').addEventListener('click', function () {
    update(function (tr) {
      tr.todo = tr.todo || [];
      var foreign = abroad(tr);
      TODO_IDEAS.forEach(function (x, i) {
        if (i === 0 && !foreign) return;
        if (!tr.todo.some(function (t) { return t.text.toLowerCase() === x.toLowerCase(); })) tr.todo.push({ id: F.uid(), text: x, done: false });
      });
    });
  });

  /* ---------- prepare: packing ---------- */
  function renderPack(tr) {
    var pack = tr.pack || [], done = pack.filter(function (p) { return p.done; }).length;
    $('tpPackCount').textContent = pack.length ? done + ' of ' + pack.length : '';
    $('tpPack').innerHTML = pack.map(function (p) {
      return '<li class="' + (p.done ? 'done' : '') + '"><label><input type="checkbox" data-pack="' + esc(p.id) + '"' + (p.done ? ' checked' : '') + '><span>' + esc(p.text) + '</span></label>' +
        '<button type="button" class="tp-x" data-unpack="' + esc(p.id) + '" aria-label="Remove ' + esc(p.text) + '"><i class="bi bi-x"></i></button></li>';
    }).join('');
    $('tpPackBasics').hidden = pack.length >= 3;
  }
  $('tpPackForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('tpPackIn').value.trim();
    if (!v) return;
    update(function (tr) { tr.pack = tr.pack || []; tr.pack.push({ id: F.uid(), text: v.slice(0, 80), done: false }); });
    $('tpPackIn').value = '';
  });
  $('tpPack').addEventListener('change', function (e) {
    var id = e.target.dataset.pack;
    if (id) update(function (tr) { (tr.pack || []).forEach(function (p) { if (p.id === id) p.done = e.target.checked; }); });
  });
  $('tpPack').addEventListener('click', function (e) {
    var b = e.target.closest('[data-unpack]');
    if (b) update(function (tr) { tr.pack = (tr.pack || []).filter(function (p) { return p.id !== b.dataset.unpack; }); });
  });
  $('tpPackBasics').addEventListener('click', function () {
    update(function (tr) {
      tr.pack = tr.pack || [];
      var list = BASICS.slice();
      if (!abroad(tr)) list = list.filter(function (x) { return x !== 'Travel adapter'; });
      list.forEach(function (x) { if (!tr.pack.some(function (p) { return p.text.toLowerCase() === x.toLowerCase(); })) tr.pack.push({ id: F.uid(), text: x, done: false }); });
    });
  });

  /* ---------- money: trip -> Finances ---------- */
  function renderMoney(tr) {
    var costs = sortItems(tr.items || []).filter(function (it) { return num(it.cost); });
    var total = planned(tr), budget = num(tr.budget), logged = costs.filter(function (it) { return it.spendId; });
    var pct = budget ? Math.min(100, Math.round(total / budget * 100)) : 0;
    var html = '<div class="tp-total"><div><span class="muted">Booked so far</span><b>' + esc(kr(total)) + '</b></div>' +
      (budget ? '<div class="r"><span class="muted">Budget</span><b>' + esc(kr(budget)) + '</b></div>' : '') + '</div>';
    if (budget) html += '<div class="tp-progress' + (total > budget ? ' over' : '') + '"><i style="width:' + pct + '%"></i></div>' +
      '<p class="muted tp-left">' + (total > budget ? esc(kr(total - budget)) + ' over budget' : esc(kr(budget - total)) + ' left to spend') +
      (budget > total && tripDays(tr).length ? ' · about ' + esc(kr((budget - total) / tripDays(tr).length)) + ' a day' : '') + '</p>';
    else html += '<p class="muted tp-left"><button type="button" class="link-btn" data-edittrip>Set a budget</button> to see what’s left per day.</p>';
    if (costs.length) {
      html += '<ul class="tp-costs">' + costs.map(function (it) {
        var Ty = T[it.type] || T.other;
        return '<li><i class="bi bi-' + Ty.icon + '"></i><span class="n">' + esc(it.title || Ty.name) + '</span><span class="a">' + esc(kr(num(it.cost))) + '</span>' +
          (it.spendId ? '<button type="button" class="text-btn tp-logged" data-unlog="' + esc(it.id) + '" title="Remove from Finances"><i class="bi bi-check2"></i> In Finances</button>'
            : '<button type="button" class="text-btn" data-log="' + esc(it.id) + '">Add to Finances</button>') + '</li>';
      }).join('') + '</ul>';
      var open = costs.length - logged.length;
      html += '<div class="tp-money-acts">' + (open > 1 ? '<button type="button" class="text-btn" data-logall><i class="bi bi-box-arrow-in-right"></i> Add all ' + open + ' to Finances</button>' : '') +
        (logged.length ? '<a class="text-btn" href="../finance/"><i class="bi bi-wallet2"></i> See in Finances</a>' : '') + '</div>';
    } else html += '<p class="muted tp-hint">Put a cost on a booking and it adds up here. One tap sends it to your spending in Finances (category Travel).</p>';
    $('tpMoney').innerHTML = html;
  }
  $('tpMoney').addEventListener('click', function (e) {
    var b = e.target.closest('[data-log], [data-unlog], [data-logall]');
    if (!b) return;
    update(function (tr) {
      (tr.items || []).forEach(function (it) {
        if (!num(it.cost)) return;
        if ((b.dataset.log === it.id || b.hasAttribute('data-logall')) && !it.spendId) {
          it.spendId = F.logSpend({ amount: num(it.cost), date: today(), cat: 'travel', note: tr.name + ': ' + (it.title || (T[it.type] || T.other).name) }) || undefined;
        } else if (b.dataset.unlog === it.id && it.spendId) { F.unlogSpend(it.spendId); delete it.spendId; }
      });
    });
  });

  /* ---------- money: currency converter ---------- */
  var fxRate = null;
  function renderFx(tr) {
    var cur = tr.place && W.currencyOf(tr.place.cc), box = $('tpFx');
    if (!tr.place) { box.innerHTML = '<div class="card-head"><h2><i class="bi bi-currency-exchange"></i> Currency</h2></div><p class="muted">Add a destination to get the exchange rate.</p>'; return; }
    if (!cur || cur === 'NOK') { box.innerHTML = '<div class="card-head"><h2><i class="bi bi-currency-exchange"></i> Currency</h2></div><p class="muted">' + (cur === 'NOK' ? 'Norwegian kroner – no exchange needed.' : 'No exchange rate available for ' + esc(tr.place.country) + '.') + '</p>'; return; }
    box.innerHTML = '<div class="card-head"><h2><i class="bi bi-currency-exchange"></i> ' + esc(cur) + '</h2><span class="muted" id="fxDate"></span></div><p class="muted" id="fxMsg"><i class="bi bi-arrow-repeat spin-i"></i> Getting the rate…</p>';
    W.rate(cur).then(function (r) {
      if (!r) { $('fxMsg').textContent = 'Couldn’t get the rate right now.'; return; }
      fxRate = r;
      var c = function (n) { return (Math.round(n * r.nok)).toLocaleString('nb-NO') + ' kr'; };
      var steps = r.nok < 0.05 ? [1000, 10000, 50000, 100000] : r.nok < 1 ? [100, 500, 1000, 5000] : [5, 10, 50, 100];
      box.innerHTML = '<div class="card-head"><h2><i class="bi bi-currency-exchange"></i> ' + esc(cur) + '</h2><span class="muted">ECB rate · ' + esc(fmt(r.date)) + '</span></div>' +
        '<div class="fx-conv"><label><input id="fxLocal" inputmode="decimal" placeholder="0"><span>' + esc(cur) + '</span></label>' +
        '<i class="bi bi-arrow-left-right"></i><label><input id="fxNok" inputmode="decimal" placeholder="0"><span>NOK</span></label></div>' +
        '<ul class="fx-table">' + steps.map(function (n) { return '<li><span>' + n.toLocaleString('nb-NO') + ' ' + esc(cur) + '</span><b>' + c(n) + '</b></li>'; }).join('') + '</ul>';
    });
  }
  $('tpFx').addEventListener('input', function (e) {
    if (!fxRate) return;
    var v = num(e.target.value);
    if (e.target.id === 'fxLocal') $('fxNok').value = v == null ? '' : (Math.round(v * fxRate.nok * 100) / 100).toLocaleString('nb-NO');
    if (e.target.id === 'fxNok') $('fxLocal').value = v == null ? '' : (Math.round(v / fxRate.nok * 100) / 100).toLocaleString('nb-NO');
  });

  /* ---------- notes ---------- */
  var noteTimer = null;
  $('tpNotes').addEventListener('input', function () {
    var v = this.value;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { update(function (tr) { tr.notes = v.slice(0, 4000); }); }, 500);
  });

  /* ================= open / close ================= */
  function openTrip(id) {
    var changed = openId !== id;
    openId = id;
    if (changed) { pane = 'overview'; mapSig = ''; }
    window.TravelPage.setTab('trips', true);
    $('tpList').hidden = true; $('tpDetail').hidden = false;
    renderDetail();
    if (changed) window.scrollTo({ top: Math.max(0, $('tvTabs').offsetTop - 80) });
  }
  function closeTrip() {
    openId = null;
    $('tpList').hidden = false; $('tpDetail').hidden = true;
    renderList();
  }
  function fromHash() {
    var m = location.hash.match(/^#trip=(.+)$/);
    if (m && find(all(), decodeURIComponent(m[1]))) return openTrip(decodeURIComponent(m[1]));
    closeTrip();
    if (location.hash === '#docs') {
      window.TravelPage.setTab('trips', true);
      setTimeout(function () { $('tpDocsCard').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      history.replaceState(null, '', location.pathname);
    }
  }
  window.addEventListener('hashchange', fromHash);
  $('tpBack').addEventListener('click', function () { history.replaceState(null, '', location.pathname); closeTrip(); });
  window.addEventListener('travel:tab', function (e) {
    if (e.detail !== 'trips' && openId) { history.replaceState(null, '', location.pathname); closeTrip(); }
  });

  /* ================= sheets ================= */
  function openSheet(bg) {
    bg.hidden = false;
    requestAnimationFrame(function () { bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
  }
  function closeSheet(bg) {
    bg.classList.remove('open');
    document.documentElement.classList.remove('cl-modal');
    setTimeout(function () { bg.hidden = true; }, 220);
  }
  ['tsBg', 'tiBg', 'docBg'].forEach(function (id) {
    var bg = $(id);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-close]')) closeSheet(bg); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['tsBg', 'tiBg', 'docBg'].forEach(function (id) { if (!$(id).hidden) closeSheet($(id)); });
  });

  /* ---------- trip editor ---------- */
  var editingTrip = null, delArmed = false, pickedPlace = null;
  var destField = window.Places.field($('tsDest'), {
    search: function (q) {
      return W.search(q).then(function (l) { return l.map(function (r) { return Object.assign({ sub: [r.region, r.country].filter(Boolean).join(', ') }, r); }); });
    },
    onPick: function (p) { pickedPlace = p; }
  });
  function openTripEditor(tr) {
    editingTrip = tr ? tr.id : null; delArmed = false; pickedPlace = tr && tr.place ? tr.place : null;
    $('tsTitle').textContent = tr ? 'Edit trip' : 'New trip';
    $('tsName').value = tr ? tr.name : '';
    $('tsDest').value = tr ? (tr.dest || '') : '';
    var start = F.dkey(C.addDays(new Date(), 14));
    $('tsStart').value = tr ? tr.start : start;
    $('tsEnd').value = tr ? (tr.end || tr.start) : F.dkey(C.addDays(C.fromKey(start), 3));
    $('tsBudget').value = tr && tr.budget ? tr.budget : '';
    $('tsDelBox').hidden = !tr;
    $('tsDelete').innerHTML = '<i class="bi bi-trash3"></i> Delete trip';
    openSheet($('tsBg'));
    if (!tr && innerWidth >= 700) setTimeout(function () { $('tsName').focus(); }, 60);
  }
  $('tpNew').addEventListener('click', function () { openTripEditor(null); });
  $('tpHead').addEventListener('click', function (e) { if (e.target.closest('#tpEdit')) openTripEditor(current()); });
  $('tsStart').addEventListener('change', function () { if (!$('tsEnd').value || $('tsEnd').value < this.value) $('tsEnd').value = this.value; });
  $('tsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('tsName').value.trim(), start = $('tsStart').value, end = $('tsEnd').value || start;
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
    if (end < start) end = start;
    var t = all(), tr = editingTrip ? find(t, editingTrip) : null;
    if (!tr) { tr = { id: F.uid(), items: [], pack: [], notes: '' }; t.trips.push(tr); }
    var dest = $('tsDest').value.trim().slice(0, 80);
    if (pickedPlace && pickedPlace.name === dest) tr.place = pickedPlace;
    else if (dest !== tr.dest) delete tr.place;          // looked up again when the trip opens
    if (!dest) delete tr.place;
    tr.name = name.slice(0, 80); tr.dest = dest; tr.start = start; tr.end = end;
    var b = num($('tsBudget').value);
    if (b) tr.budget = b; else delete tr.budget;
    var cd = C.load();
    if (cd.hidden.travel) { delete cd.hidden.travel; C.save(cd); }   // make sure it shows in the calendar
    F.saveTravel(t);
    closeSheet($('tsBg'));
    if (!editingTrip) location.hash = 'trip=' + tr.id;
  });
  $('tsDelete').addEventListener('click', function () {
    if (!delArmed) { delArmed = true; this.innerHTML = '<i class="bi bi-trash3"></i> Tap again to delete the whole trip'; return; }
    var t = all();
    t.trips = t.trips.filter(function (x) { return x.id !== editingTrip; });
    F.saveTravel(t);
    closeSheet($('tsBg'));
    history.replaceState(null, '', location.pathname);
    closeTrip();
  });

  /* ---------- plan item editor ---------- */
  var editingItem = null, itype = 'flight';
  $('tiTypes').innerHTML = Object.keys(T).map(function (k) {
    return '<button type="button" data-type="' + k + '"><i class="bi bi-' + T[k].icon + '"></i><span>' + T[k].name + '</span></button>';
  }).join('');
  var LABELS = {
    move: ['Departs', 'Arrives', 'From, e.g. Oslo lufthavn', 'To, e.g. Berlin BER'],
    hotel: ['Check in', 'Check out', 'Address', ''],
    other: ['Starts', 'Ends', 'Place or address', '']
  };
  var TITLES = { flight: 'Flight number, e.g. SK 4035', train: 'e.g. Vy R10', bus: 'e.g. Flybussen', boat: 'e.g. Color Line', car: 'e.g. Rental car', hotel: 'Where you stay', activity: 'e.g. Museum, concert, dinner', other: 'Title' };
  function setType(k) {
    itype = k;
    document.querySelectorAll('#tiTypes [data-type]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.type === k)); });
    var L = T[k].move ? LABELS.move : k === 'hotel' ? LABELS.hotel : LABELS.other;
    $('tiStartLbl').textContent = L[0]; $('tiEndLbl').textContent = L[1];
    $('tiFrom').placeholder = L[2]; $('tiTo').placeholder = L[3]; $('tiTo').hidden = !L[3];
    $('tiName').placeholder = TITLES[k];
  }
  $('tiTypes').addEventListener('click', function (e) { var b = e.target.closest('[data-type]'); if (b) setType(b.dataset.type); });
  $('tiDate').addEventListener('change', function () { if ($('tiEndDate').value && $('tiEndDate').value < this.value) $('tiEndDate').value = this.value; });

  function openItem(id, type) {
    var tr = current();
    if (!tr) return;
    var it = id ? (tr.items || []).filter(function (x) { return x.id === id; })[0] : null;
    editingItem = it ? it.id : null;
    $('tiTitle').textContent = it ? 'Edit' : 'Add to plan';
    setType(it ? it.type : (type || 'flight'));
    var items = sortItems(tr.items || []);
    $('tiName').value = it ? (it.title || '') : '';
    $('tiDate').value = it ? it.date : (items.length ? items[items.length - 1].date : tr.start);
    $('tiTime').value = it ? (it.time || '') : '';
    $('tiEndDate').value = it ? (it.endDate || '') : (itype === 'hotel' ? (tr.end || '') : '');
    $('tiEndTime').value = it ? (it.endTime || '') : '';
    $('tiFrom').value = it ? (it.from || '') : '';
    $('tiTo').value = it ? (it.to || '') : '';
    $('tiRef').value = it ? (it.ref || '') : '';
    $('tiCost').value = it && it.cost ? it.cost : '';
    $('tiNotes').value = it ? (it.notes || '') : '';
    $('tiDelBox').hidden = !it;
    openSheet($('tiBg'));
  }
  $('tiForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var date = $('tiDate').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('tiDate').focus(); return; }
    update(function (tr) {
      tr.items = tr.items || [];
      var it = editingItem ? tr.items.filter(function (x) { return x.id === editingItem; })[0] : null;
      if (!it) { it = { id: F.uid() }; tr.items.push(it); }
      var cost = num($('tiCost').value);
      Object.assign(it, {
        type: itype, title: $('tiName').value.trim().slice(0, 100), date: date, time: $('tiTime').value || '',
        endDate: $('tiEndDate').value && $('tiEndDate').value >= date ? $('tiEndDate').value : '', endTime: $('tiEndTime').value || '',
        from: $('tiFrom').value.trim().slice(0, 120), to: $('tiTo').hidden ? '' : $('tiTo').value.trim().slice(0, 120),
        ref: $('tiRef').value.trim().slice(0, 40), cost: cost ? String(cost) : '', notes: $('tiNotes').value.trim().slice(0, 1000)
      });
      /* a cost already in Finances follows the change */
      if (it.spendId && window.Vault.get()) {
        var d = window.Vault.get(), ex = (d.expenses || []).filter(function (x) { return x.id === it.spendId; })[0];
        if (ex && cost) { ex.amount = cost; window.Vault.save(d); }
        else if (ex && !cost) { F.unlogSpend(it.spendId); delete it.spendId; }
      }
      /* a trip grows to fit what's planned */
      if (date < tr.start) tr.start = date;
      var last = it.endDate || date;
      if (last > (tr.end || tr.start)) tr.end = last;
    });
    closeSheet($('tiBg'));
  });
  $('tiDelete').addEventListener('click', function () {
    update(function (tr) {
      var it = (tr.items || []).filter(function (x) { return x.id === editingItem; })[0];
      if (it && it.spendId) F.unlogSpend(it.spendId);
      tr.items = (tr.items || []).filter(function (x) { return x.id !== editingItem; });
    });
    closeSheet($('tiBg'));
  });

  /* ---------- document editor ---------- */
  var editingDoc = null, dkind = 'passport';
  $('docKinds').innerHTML = Object.keys(D).map(function (k) {
    return '<button type="button" data-kind="' + k + '"><i class="bi bi-' + D[k].icon + '"></i><span>' + D[k].name + '</span></button>';
  }).join('');
  function setKind(k) {
    var prev = D[dkind] && D[dkind].name;
    dkind = k;
    document.querySelectorAll('#docKinds [data-kind]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.kind === k)); });
    if (!$('docName').value || $('docName').value === prev) $('docName').value = D[k].name;
  }
  $('docKinds').addEventListener('click', function (e) { var b = e.target.closest('[data-kind]'); if (b) setKind(b.dataset.kind); });
  function openDoc(id, kind) {
    var d = id ? all().docs.filter(function (x) { return x.id === id; })[0] : null;
    editingDoc = d ? d.id : null;
    $('docTitle').textContent = d ? 'Edit document' : 'Add document';
    $('docName').value = d ? (d.name || '') : '';
    dkind = null; setKind(d ? d.kind : (kind || 'passport'));
    if (d) $('docName').value = d.name || D[d.kind].name;
    $('docExp').value = d ? (d.expires || '') : '';
    $('docRemind').value = String(d && d.remind ? d.remind : (kind === 'insurance' || (d && d.kind === 'insurance') ? 1 : 6));
    $('docNote').value = d ? (d.note || '') : '';
    $('docDelBox').hidden = !d;
    openSheet($('docBg'));
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-doc]');
    if (b && !b.closest('.cl-sheet')) openDoc(b.dataset.doc);
  });
  $('docAdd').addEventListener('click', function () { openDoc(null); });
  $('docForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = all(), d = editingDoc ? t.docs.filter(function (x) { return x.id === editingDoc; })[0] : null;
    if (!d) { d = { id: F.uid() }; t.docs.push(d); }
    Object.assign(d, { kind: dkind, name: $('docName').value.trim().slice(0, 60) || D[dkind].name, expires: $('docExp').value || '',
      remind: +$('docRemind').value || 6, note: $('docNote').value.trim().slice(0, 120) });
    F.saveTravel(t);
    closeSheet($('docBg'));
  });
  $('docDelete').addEventListener('click', function () {
    var t = all();
    t.docs = t.docs.filter(function (x) { return x.id !== editingDoc; });
    F.saveTravel(t);
    closeSheet($('docBg'));
  });

  /* ================= wiring ================= */
  function refresh() { if (openId) renderDetail(); else renderList(); }
  window.addEventListener('travel:change', refresh);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash.reload = function () { if (prevReload) prevReload(); refresh(); };
  window.Trips = { docStatus: docStatus, tripDays: tripDays, planned: planned };
  window.Vault.onUnlock(function () { renderList(); fromHash(); });
  window.Vault.onLock(function () { closeTrip(); });
})();
