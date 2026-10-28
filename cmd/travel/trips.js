/* Travel page, part 2: trips. A trip has a plan (flights, trains, stays, activities),
   a packing list, money and notes. Everything shows up in the calendar, costs can be
   sent to Finances, and every booking can open the journey planner ("get there in time"). */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var F = window.Flow, C = window.Cal, esc = C.esc, T = F.TYPES;
  var BASICS = ['Passport or ID', 'Phone charger', 'Wallet and cards', 'Headphones', 'Toothbrush', 'Medicine', 'Clothes for the days', 'Travel adapter'];
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)); }
  function num(v) {
    var s = String(v || '').replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : null;
  }
  var today = function () { return F.dkey(new Date()); };
  var openId = null;

  function all() { return F.travel(); }
  function find(t, id) { return t.trips.filter(function (x) { return x.id === id; })[0] || null; }
  function update(fn) {
    var t = all(), tr = find(t, openId);
    if (!tr) return;
    fn(tr, t);
    F.saveTravel(t);
  }
  function sortItems(items) {
    return items.slice().sort(function (a, b) { return (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1; });
  }
  function relDays(tr) {
    var n = Math.round((C.fromKey(tr.start) - C.day0(new Date())) / 864e5);
    var len = Math.round((C.fromKey(tr.end || tr.start) - C.fromKey(tr.start)) / 864e5) + 1;
    if ((tr.end || tr.start) < today()) {
      var ago = -Math.round((C.fromKey(tr.end || tr.start) - C.day0(new Date())) / 864e5);
      return ago < 14 ? ago + ' day' + (ago === 1 ? '' : 's') + ' ago' : ago < 60 ? Math.round(ago / 7) + ' weeks ago' : C.fromKey(tr.start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    if (n <= 0) return 'Travelling now · day ' + (1 - n) + ' of ' + len;
    return (n === 1 ? 'Tomorrow' : 'In ' + n + ' days') + ' · ' + len + ' day' + (len > 1 ? 's' : '');
  }
  function planned(tr) { return (tr.items || []).reduce(function (a, it) { return a + (num(it.cost) || 0); }, 0); }

  /* ================= list ================= */
  function card(tr) {
    var items = tr.items || [], pack = tr.pack || [];
    var moves = items.filter(function (i) { return (T[i.type] || {}).move; }).length;
    var stays = items.filter(function (i) { return i.type === 'hotel'; }).length;
    var packed = pack.filter(function (p) { return p.done; }).length, cost = planned(tr);
    var bits = [];
    if (moves) bits.push('<span><i class="bi bi-airplane"></i>' + moves + '</span>');
    if (stays) bits.push('<span><i class="bi bi-building"></i>' + stays + '</span>');
    if (pack.length) bits.push('<span><i class="bi bi-luggage"></i>' + packed + '/' + pack.length + '</span>');
    if (cost) bits.push('<span><i class="bi bi-cash-coin"></i>' + esc(kr(cost)) + '</span>');
    return '<button type="button" class="tp-card" data-trip="' + esc(tr.id) + '">' +
      '<span class="k">' + esc(relDays(tr)) + '</span><b>' + esc(tr.name) + '</b>' +
      '<span class="s">' + esc(window.TravelPage.rangeLabel(tr)) + '</span>' +
      (bits.length ? '<span class="tp-bits">' + bits.join('') + '</span>' : '') + '<i class="bi bi-chevron-right tp-go"></i></button>';
  }
  function renderList() {
    var t = all(), td = today();
    var up = t.trips.filter(function (x) { return (x.end || x.start) >= td; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    var past = t.trips.filter(function (x) { return (x.end || x.start) < td; }).sort(function (a, b) { return a.start > b.start ? -1 : 1; });
    $('tpUpcoming').innerHTML = up.map(card).join('');
    $('tpPast').innerHTML = past.map(card).join('');
    $('tpPastBox').hidden = !past.length;
    $('tpEmpty').hidden = up.length > 0;
    $('tvTripCount').textContent = up.length ? up.length : '';
  }
  $('paneTrips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-trip]');
    if (b) location.hash = 'trip=' + b.dataset.trip;
  });

  /* ================= one trip ================= */
  function renderDetail() {
    var tr = find(all(), openId);
    if (!tr) { closeTrip(); return; }
    var a = C.fromKey(tr.start), b = C.fromKey(tr.end || tr.start);
    var range = a.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
      (tr.end && tr.end !== tr.start ? ' – ' + b.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ', ' + a.getFullYear());
    $('tpHead').innerHTML = '<div class="tp-head-main"><p class="k">' + esc(relDays(tr)) + '</p><h2>' + esc(tr.name) + '</h2>' +
      '<p class="muted">' + esc(range) + (tr.dest ? ' · ' + esc(tr.dest) : '') + '</p></div>' +
      '<div class="tp-head-acts"><a class="text-btn" href="../calendar/#d=' + esc(tr.start) + '"><i class="bi bi-calendar3"></i> In calendar</a>' +
      '<button class="text-btn" type="button" id="tpEdit"><i class="bi bi-pencil"></i> Edit</button></div>';
    renderItems(tr); renderPack(tr); renderMoney(tr);
    if (document.activeElement !== $('tpNotes')) $('tpNotes').value = tr.notes || '';
  }

  /* ---------- plan ---------- */
  function renderItems(tr) {
    var items = sortItems(tr.items || []), html = '', last = '', td = today();
    items.forEach(function (it) {
      var w = F.when(it), Ty = T[it.type] || T.other;
      if (it.date !== last) {
        last = it.date;
        html += '<h3 class="tp-day">' + esc(C.fromKey(it.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })) + '</h3>';
      }
      var line1 = [];
      if (it.time) line1.push(it.time + (it.endTime ? ' – ' + it.endTime + (it.endDate && it.endDate !== it.date ? ' (' + C.fromKey(it.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ')' : '') : ''));
      else if (it.type === 'hotel' && it.endDate) line1.push('until ' + C.fromKey(it.endDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }));
      if (Ty.move && (it.from || it.to)) line1.push(esc(it.from || '?') + ' → ' + esc(it.to || '?'));
      else if (it.from) line1.push(esc(it.from));
      var line2 = [];
      if (it.ref) line2.push('Ref <b class="tp-ref">' + esc(it.ref) + '</b>');
      if (num(it.cost)) line2.push(esc(kr(num(it.cost))));
      var canRoute = it.from && w && w.timed && it.date >= td && it.type !== 'hotel';
      html += '<div class="tp-item" data-item="' + esc(it.id) + '">' +
        '<span class="ic"><i class="bi bi-' + Ty.icon + '"></i></span>' +
        '<button type="button" class="x" data-edit="' + esc(it.id) + '"><b>' + esc(it.title || Ty.name) + '</b>' +
        (line1.length ? '<span class="s">' + line1.join(' · ') + '</span>' : '') +
        (line2.length ? '<span class="s">' + line2.join(' · ') + '</span>' : '') + '</button>' +
        (canRoute ? '<button type="button" class="tp-route" data-route="' + esc(it.id) + '" title="Plan how to get to ' + esc(it.from) + ' in time"><i class="bi bi-signpost-split"></i><span>Get there</span></button>' : '') +
        '</div>';
    });
    $('tpItems').innerHTML = html || '<p class="empty">Add flights, trains, where you stay and what you’ll do. Everything with a date shows up in your calendar.</p>' +
      '<div class="tp-quick">' + ['flight', 'train', 'hotel', 'activity'].map(function (k) {
        return '<button type="button" class="tv-chip" data-quick="' + k + '"><i class="bi bi-' + T[k].icon + '"></i>' + T[k].name + '</button>';
      }).join('') + '</div>';
  }
  $('tpItems').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-route]'))) return routeItem(b.dataset.route);
    if ((b = e.target.closest('[data-edit]'))) return openItem(b.dataset.edit);
    if ((b = e.target.closest('[data-quick]'))) return openItem(null, b.dataset.quick);
  });
  $('tpAddItem').addEventListener('click', function () { openItem(null); });

  /* Trip -> journey planner: be at the airport/station in time */
  function routeItem(id) {
    var tr = find(all(), openId), it = tr && (tr.items || []).filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    var w = F.when(it), Ty = T[it.type] || T.other, buf = Ty.buffer;
    F.route({ toText: it.from, arriveBy: new Date(w.start.getTime() - buf * 60e3),
      context: { title: (it.title || Ty.name) + (Ty.move && it.to ? ' to ' + it.to : ''), note: buf ? buf + ' min before ' + it.time : 'starts ' + it.time, cat: 'life' } });
  }

  /* ---------- packing ---------- */
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
      BASICS.forEach(function (x) { if (!tr.pack.some(function (p) { return p.text.toLowerCase() === x.toLowerCase(); })) tr.pack.push({ id: F.uid(), text: x, done: false }); });
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
      '<p class="muted tp-left">' + (total > budget ? esc(kr(total - budget)) + ' over budget' : esc(kr(budget - total)) + ' left to spend') + '</p>';
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

  /* ---------- notes ---------- */
  var noteTimer = null;
  $('tpNotes').addEventListener('input', function () {
    var v = this.value;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { update(function (tr) { tr.notes = v.slice(0, 4000); }); }, 500);
  });

  /* ================= open / close ================= */
  function openTrip(id) {
    openId = id;
    window.TravelPage.setTab('trips', true);
    $('tpList').hidden = true; $('tpDetail').hidden = false;
    renderDetail();
    window.scrollTo({ top: Math.max(0, $('tvTabs').offsetTop - 80) });
  }
  function closeTrip() {
    openId = null;
    $('tpList').hidden = false; $('tpDetail').hidden = true;
    renderList();
  }
  function fromHash() {
    var m = location.hash.match(/^#trip=(.+)$/);
    if (m && find(all(), decodeURIComponent(m[1]))) openTrip(decodeURIComponent(m[1]));
    else closeTrip();
  }
  window.addEventListener('hashchange', fromHash);
  $('tpBack').addEventListener('click', function () { history.replaceState(null, '', location.pathname); closeTrip(); });
  window.addEventListener('travel:tab', function (e) {
    if (e.detail === 'journey' && openId) { history.replaceState(null, '', location.pathname); closeTrip(); }
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
  ['tsBg', 'tiBg'].forEach(function (id) {
    var bg = $(id);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-close]')) closeSheet(bg); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['tsBg', 'tiBg'].forEach(function (id) { if (!$(id).hidden) closeSheet($(id)); });
  });

  /* ---------- trip editor ---------- */
  var editingTrip = null, delArmed = false;
  function openTripEditor(tr) {
    editingTrip = tr ? tr.id : null; delArmed = false;
    $('tsTitle').textContent = tr ? 'Edit trip' : 'New trip';
    $('tsName').value = tr ? tr.name : '';
    $('tsDest').value = tr ? (tr.dest || '') : '';
    var nextWeek = F.dkey(C.addDays(new Date(), 14));
    $('tsStart').value = tr ? tr.start : nextWeek;
    $('tsEnd').value = tr ? (tr.end || tr.start) : F.dkey(C.addDays(C.fromKey(nextWeek), 3));
    $('tsBudget').value = tr && tr.budget ? tr.budget : '';
    $('tsDelBox').hidden = !tr;
    $('tsDelete').innerHTML = '<i class="bi bi-trash3"></i> Delete trip';
    openSheet($('tsBg'));
    if (!tr && innerWidth >= 700) setTimeout(function () { $('tsName').focus(); }, 60);
  }
  $('tpNew').addEventListener('click', function () { openTripEditor(null); });
  $('tpHead').addEventListener('click', function (e) { if (e.target.closest('#tpEdit')) openTripEditor(find(all(), openId)); });
  $('tsStart').addEventListener('change', function () { if (!$('tsEnd').value || $('tsEnd').value < this.value) $('tsEnd').value = this.value; });
  $('tsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('tsName').value.trim(), start = $('tsStart').value, end = $('tsEnd').value || start;
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
    if (end < start) end = start;
    var t = all(), tr = editingTrip ? find(t, editingTrip) : null;
    if (!tr) { tr = { id: F.uid(), items: [], pack: [], notes: '' }; t.trips.push(tr); }
    tr.name = name.slice(0, 80); tr.dest = $('tsDest').value.trim().slice(0, 80); tr.start = start; tr.end = end;
    var b = num($('tsBudget').value);
    if (b) tr.budget = b; else delete tr.budget;
    if (C.load().hidden.travel) { var cd = C.load(); delete cd.hidden.travel; C.save(cd); }   // make sure it shows in the calendar
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
    var tr = find(all(), openId);
    if (!tr) return;
    var it = id ? (tr.items || []).filter(function (x) { return x.id === id; })[0] : null;
    editingItem = it ? it.id : null;
    $('tiTitle').textContent = it ? 'Edit' : 'Add to plan';
    setType(it ? it.type : (type || 'flight'));
    var items = sortItems(tr.items || []);
    var defDate = items.length ? items[items.length - 1].date : tr.start;
    $('tiName').value = it ? (it.title || '') : '';
    $('tiDate').value = it ? it.date : defDate;
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

  /* ================= wiring ================= */
  function refresh() { if (openId) renderDetail(); else renderList(); }
  window.addEventListener('travel:change', refresh);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash.reload = function () { if (prevReload) prevReload(); refresh(); };
  window.Vault.onUnlock(function () { renderList(); fromHash(); });
  window.Vault.onLock(function () { closeTrip(); });
})();
