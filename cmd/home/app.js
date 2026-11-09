/* The shared app (/cmd/home/) for the person JP shares his home with. It only knows the shared box:
   shopping list, chores (+ plants and the moving checklist), money between the two of you, and shared events.
   The key comes once from the QR code on the owner's phone and is kept locked with this person's own passcode. */
(function () {
  "use strict";
  var SC = window.ShareCore, app = document.getElementById('app');
  /* ---------- language ---------- */
  var nb = (function () { try { var v = localStorage.getItem('home.lang'); if (v) return v === 'nb'; } catch (e) {} return /^(nb|no|nn)/i.test(navigator.language || ''); })();
  function L(en, no) { return nb ? no : en; }
  document.documentElement.lang = nb ? 'nb' : 'en';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2] || 1); }
  function today() { return dkey(new Date()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, ''); if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var x = parseFloat(s.replace(',', '.')); return isFinite(x) ? x : null; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function fdate(k, o) { return fromKey(k).toLocaleDateString(nb ? 'nb-NO' : 'en-GB', o || { weekday: 'short', day: 'numeric', month: 'short' }); }
  function rj(k, fb) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } }
  function wj(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var tt = null;
  function toast(h, undo) {
    var t = document.getElementById('toast'); t._undo = undo || null;
    t.innerHTML = '<span>' + h + '</span>' + (undo ? '<button type="button" data-undo>' + L('Undo', 'Angre') + '</button>' : '');
    t.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('show'); t._undo = null; }, undo ? 5000 : 2400);
  }
  document.getElementById('toast').addEventListener('click', function (e) { var t = this; if (e.target.closest('[data-undo]') && t._undo) { var u = t._undo; t._undo = null; t.classList.remove('show'); u(); } });

  /* ---------- the key ---------- */
  var K = null, recs = {}, rids = {}, tab = rj('home.tab', 'shop'), me = 'p';
  var pending = (function () { var m = location.hash.match(/[#&]k=([A-Za-z0-9_-]{43})/); if (m) { try { sessionStorage.setItem('home.newkey', m[1]); } catch (e) {} history.replaceState(null, '', location.pathname); return m[1]; } try { return sessionStorage.getItem('home.newkey'); } catch (e) { return null; } })();
  function screen(h) { app.innerHTML = '<div class="h-screen">' + h + '</div>'; var f = app.querySelector('input'); if (f && matchMedia('(hover: hover)').matches) f.focus(); }
  function boot() {
    SC.api('share').then(function (j) {
      if (!j.partner) { screen('<i class="bi bi-house-heart h-big"></i><h1>' + L('This is the shared app', 'Dette er den delte appen') + '</h1><p>' + L('It’s for the person you share your home with. Your own dashboard is here:', 'Den er for den du deler hjemmet med. Ditt eget dashbord er her:') + '</p><a class="h-btn" href="/cmd/">' + L('Open your dashboard', 'Åpne dashbordet ditt') + '</a>'); return; }
      if (pending) return setPass(pending);
      var rem = rj('home.key', null); if (rem) { K = rem; return start(); }
      SC.api('share?wrap').then(function (w) { askPass(w); }, function (e) {
        if (e.status === 404) screen('<i class="bi bi-qr-code-scan h-big"></i><h1>' + L('Almost there', 'Nesten klar') + '</h1><p>' + L('Open the Camera app and scan the code on the other phone (Settings → Shared space → Show the code).', 'Åpne Kamera-appen og skann koden på den andre telefonen (Innstillinger → Delt hjem → Vis koden).') + '</p><button class="h-btn ghost" type="button" data-reload>' + L('I’ve scanned it', 'Jeg har skannet') + '</button>');
        else offline();
      });
    }, function (e) {
      if (e.status === 401) screen('<i class="bi bi-box-arrow-in-right h-big"></i><h1>' + L('Log in again', 'Logg inn igjen') + '</h1><button class="h-btn" type="button" data-reload>' + L('Reload', 'Last inn på nytt') + '</button>');
      else offline();
    });
  }
  function offline() { screen('<i class="bi bi-wifi-off h-big"></i><h1>' + L('No connection', 'Ingen forbindelse') + '</h1><p>' + L('Check the internet and try again.', 'Sjekk nettet og prøv igjen.') + '</p><button class="h-btn" type="button" data-reload>' + L('Try again', 'Prøv igjen') + '</button>'); }
  function setPass(k) {
    screen('<i class="bi bi-shield-lock h-big"></i><h1>' + L('Choose your passcode', 'Velg en kode') + '</h1><p>' + L('You type it when you open the app. At least 6 characters.', 'Du skriver den når du åpner appen. Minst 6 tegn.') + '</p>' +
      '<form class="h-form" data-setpass><input type="password" name="a" autocomplete="new-password" placeholder="' + L('Passcode', 'Kode') + '" minlength="6" required><input type="password" name="b" autocomplete="new-password" placeholder="' + L('Once more', 'En gang til') + '" minlength="6" required>' +
      '<label class="h-check"><input type="checkbox" name="rem"> ' + L('Keep me unlocked on this phone', 'Hold meg innlogget på denne telefonen') + '</label><p class="h-err" data-err></p><button class="h-btn" type="submit">' + L('Save and open', 'Lagre og åpne') + '</button></form>');
    app.querySelector('[data-setpass]').onsubmit = function (e) {
      e.preventDefault(); var f = e.target, er = f.querySelector('[data-err]');
      if (f.a.value.length < 6) { er.textContent = L('At least 6 characters.', 'Minst 6 tegn.'); return; }
      if (f.a.value !== f.b.value) { er.textContent = L('The two don’t match.', 'De to er ikke like.'); return; }
      er.textContent = L('Saving …', 'Lagrer …');
      SC.importKey(k).then(function () { return SC.wrap(f.a.value, k); }).then(function (w) { return SC.api('share?wrap', { method: 'PUT', body: w }); }).then(function () {
        try { sessionStorage.removeItem('home.newkey'); } catch (x) {} pending = null; K = k; if (f.rem.checked) wj('home.key', k); start();
        toast('<i class="bi bi-check2"></i> ' + L('All set – add this page to your Home Screen', 'Klart – legg siden til på Hjem-skjermen'));
      }, function () { er.textContent = L('Couldn’t save – try again.', 'Kunne ikke lagre – prøv igjen.'); });
    };
  }
  function askPass(w) {
    screen('<i class="bi bi-house-heart h-big"></i><h1>' + L('Home', 'Hjem') + '</h1><form class="h-form" data-pass><input type="password" name="a" autocomplete="current-password" placeholder="' + L('Passcode', 'Kode') + '" required>' +
      '<label class="h-check"><input type="checkbox" name="rem"> ' + L('Keep me unlocked on this phone', 'Hold meg innlogget på denne telefonen') + '</label><p class="h-err" data-err></p><button class="h-btn" type="submit">' + L('Open', 'Åpne') + '</button></form>' +
      '<p class="h-small">' + L('Forgot it? Scan the code on the other phone again and choose a new one.', 'Glemt den? Skann koden på den andre telefonen igjen og velg en ny.') + '</p>');
    app.querySelector('[data-pass]').onsubmit = function (e) {
      e.preventDefault(); var f = e.target, er = f.querySelector('[data-err]'); er.textContent = '…';
      SC.unwrap(f.a.value, w).then(function (k) { K = k; if (f.rem.checked) wj('home.key', k); start(); }, function () { er.textContent = L('Wrong passcode.', 'Feil kode.'); f.a.select(); });
    };
  }

  /* ---------- the box ---------- */
  function absorb(srv) {
    var r = (srv && srv.recs) || {}, jobs = [];
    Object.keys(r).forEach(function (rid) {
      var x = r[rid], old = recs[rid]; if (old && old.t === x.t) return;
      if (x.del) { recs[rid] = { t: x.t, del: 1, c: old && old.c, id: old && old.id }; return; }
      jobs.push(SC.decrypt(K, x).then(function (o) { recs[rid] = { t: x.t, by: x.by, c: o.c, id: o.id, f: SC.clean(o.c, o.f) || {} }; rids[o.c + '|' + o.id] = rid; }, function () {}));
    });
    return Promise.all(jobs);
  }
  function list(c) { return Object.keys(recs).map(function (k) { return recs[k]; }).filter(function (r) { return r.c === c && !r.del; }); }
  function info() { var i = list('info')[0]; return i ? i.f : {}; }
  function owner() { return info().owner || L('the other one', 'den andre'); }
  var queue = rj('home.queue', {});
  function flush() {
    if (!Object.keys(queue).length) return Promise.resolve();
    var send = queue; return SC.api('shared', { method: 'PUT', body: { recs: send } }).then(function (srv) {
      Object.keys(send).forEach(function (k) { if (queue[k] === send[k]) delete queue[k]; }); wj('home.queue', queue); return absorb(srv);
    }, function () { toast('<i class="bi bi-cloud-slash"></i> ' + L('Saved here – sends when you’re online', 'Lagret her – sendes når du er på nett')); });
  }
  /* change one record: shown at once, sent right after (kept and resent if the network is away) */
  function put(c, id, f, del) {
    var t = Date.now(), key = c + '|' + id, cf = del ? null : SC.clean(c, f);
    return (rids[key] ? Promise.resolve(rids[key]) : SC.rid(K, c, id)).then(function (rid) {
      rids[key] = rid; recs[rid] = del ? { t: t, del: 1, c: c, id: id } : { t: t, by: me, c: c, id: id, f: cf }; draw();
      if (del) { queue[rid] = { t: t, del: 1 }; return; }
      return SC.encrypt(K, { c: c, id: id, f: cf }).then(function (e) { queue[rid] = { t: t, iv: e.iv, ct: e.ct }; });
    }).then(function () { wj('home.queue', queue); return flush(); }).then(draw);
  }
  function pull() { return flush().then(function () { return SC.api('shared'); }).then(absorb).then(draw, function (e) { if (e && e.status === 403) { wj('home.key', null); screen('<i class="bi bi-door-closed h-big"></i><h1>' + L('Sharing has stopped', 'Delingen er stoppet') + '</h1><p>' + L('Ask for a new code if this is a mistake.', 'Be om en ny kode hvis dette er feil.') + '</p>'); stopped = true; } }); }
  var stopped = false;
  function start() {
    app.innerHTML = '<p class="h-wait"><i class="bi bi-arrow-repeat"></i></p>';
    pull().then(function () { if (!stopped && !list('info').length) screen('<i class="bi bi-hourglass-split h-big"></i><h1>' + L('Waiting for the first sync', 'Venter på første synk') + '</h1><p>' + L('Ask the other one to open their dashboard once.', 'Be den andre åpne dashbordet sitt én gang.') + '</p><button class="h-btn ghost" type="button" data-reload>' + L('Check again', 'Sjekk igjen') + '</button>'); });
    setInterval(function () { if (!document.hidden && !stopped) pull(); }, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !stopped) pull(); });
    window.addEventListener('online', function () { if (!stopped) pull(); });
  }

  /* ---------- chores: whose turn (the same rules as the dashboard) ---------- */
  function monday(k) { var d = fromKey(k); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dkey(d); }
  function period(c, k) {
    k = k || today(); var st = /^\d{4}-\d{2}-\d{2}$/.test(c.start || '') ? c.start : k;
    if (c.every === '1m') {
      var d = fromKey(k), first = new Date(d.getFullYear(), d.getMonth(), 1); first.setDate(1 + ((+c.day || 0) - (first.getDay() + 6) % 7 + 7) % 7);
      var n = (d.getFullYear() - fromKey(st).getFullYear()) * 12 + d.getMonth() - fromKey(st).getMonth();
      if (dkey(first) < st && n === 0) { var nx = new Date(d.getFullYear(), d.getMonth() + 1, 1); nx.setDate(1 + ((+c.day || 0) - (nx.getDay() + 6) % 7 + 7) % 7); return { key: dkey(nx).slice(0, 7), day: dkey(nx), n: 1 }; }
      return { key: k.slice(0, 7), day: dkey(first), n: n };
    }
    var w = Math.round((fromKey(monday(k)) - fromKey(monday(st))) / 6048e5), step = c.every === '2w' ? 2 : 1;
    var wn = Math.floor(w / step) * step, mon = fromKey(monday(st)); mon.setDate(mon.getDate() + wn * 7);
    var day = new Date(mon); day.setDate(mon.getDate() + (+c.day || 0));
    if (dkey(day) < st) { mon.setDate(mon.getDate() + step * 7); day.setDate(day.getDate() + step * 7); return { key: dkey(mon), day: dkey(day), n: Math.floor(w / step) + 1 }; }
    return { key: dkey(mon), day: dkey(day), n: Math.floor(w / step) };
  }
  function turn(c, p) { if (c.who === 'me') return 'me'; if (c.who === 'them') return 'them'; return ((p.n % 2) + 2) % 2 === 0 ? 'me' : 'them'; }   /* 'me' = the owner, 'them' = you */
  function doneOf(cid, p) { var r = list('cdone').filter(function (x) { return x.f.k === p.key + '|' + cid; })[0]; return r ? r.f.who : null; }

  /* ---------- money ---------- */
  function balance() {   /* > 0: you owe the owner */
    var b = +info().extra || 0;
    list('sx').forEach(function (r) { var f = r.f, s = f.shares || {}; b += f.payer === 'o' ? +s.p || 0 : -(+s.o || 0); });
    list('pay').forEach(function (r) { var f = r.f; b += f.from === 'o' ? +f.amount || 0 : -(+f.amount || 0); });
    return Math.round(b * 100) / 100;
  }

  /* ---------- drawing ---------- */
  var TABS = [['shop', 'cart3', 'Shopping', 'Handleliste'], ['chores', 'arrow-repeat', 'Chores', 'Husarbeid'], ['money', 'people', 'Money', 'Penger'], ['cal', 'calendar-heart', 'Calendar', 'Kalender']];
  var showAllMoney = false, menu = false;
  function tabsOn() { var w = info().what || {}; return TABS.filter(function (t) { return t[0] === 'chores' ? (w.chores !== false || w.plants !== false || w.move !== false) : w[t[0]] !== false; }); }
  function draw() {
    if (!K || stopped || !list('info').length) return;
    var ts = tabsOn(); if (!ts.some(function (t) { return t[0] === tab; })) tab = ts.length ? ts[0][0] : 'shop';
    var keep = document.activeElement && document.activeElement.name ? { n: document.activeElement.name, v: document.activeElement.value } : null;
    app.innerHTML = '<header class="h-top"><div><small>' + esc(fdate(today(), { weekday: 'long', day: 'numeric', month: 'long' })) + '</small><h1>' + esc(L('Home with ', 'Hjemme med ') + owner()) + '</h1></div><button type="button" class="h-icon" data-menu aria-label="' + L('Menu', 'Meny') + '"><i class="bi bi-three-dots"></i></button></header>' +
      (menu ? '<div class="h-menu"><button type="button" data-lang>' + (nb ? 'English' : 'Norsk') + '</button><button type="button" data-lock>' + L('Lock', 'Lås') + '</button><button type="button" data-forget>' + L('Forget this phone', 'Glem denne telefonen') + '</button></div>' : '') +
      '<section class="h-body">' + ({ shop: shop, chores: chores, money: money, cal: cal }[tab] || shop)() + '</section>' +
      '<nav class="h-tabs">' + ts.map(function (t) { return '<button type="button" data-tab="' + t[0] + '" aria-current="' + (t[0] === tab) + '"><i class="bi bi-' + t[1] + '"></i><span>' + L(t[2], t[3]) + '</span></button>'; }).join('') + '</nav>';
    if (keep) { var el = app.querySelector('[name="' + keep.n + '"]'); if (el && 'value' in el) { el.value = keep.v; el.focus(); } }
  }
  function shop() {
    var l = list('shop').sort(function (a, b) { return (a.f.done ? 1 : 0) - (b.f.done ? 1 : 0) || a.t - b.t; }), open = l.filter(function (r) { return !r.f.done; }).length;
    return '<form class="h-add" data-addshop><input name="shop" placeholder="' + L('Add to the list …', 'Legg til på listen …') + '" autocomplete="off" enterkeyhint="done"><button type="submit" aria-label="' + L('Add', 'Legg til') + '"><i class="bi bi-plus-lg"></i></button></form>' +
      '<p class="h-sum">' + (l.length ? (open ? open + ' ' + L('to buy', 'å kjøpe') : L('All bought', 'Alt er kjøpt')) : L('The list is empty.', 'Listen er tom.')) + '</p>' +
      '<ul class="h-list">' + l.map(function (r) { return '<li class="' + (r.f.done ? 'done' : '') + '"><button type="button" class="h-tick" data-shop="' + esc(r.id) + '" aria-pressed="' + !!r.f.done + '"><i class="bi bi-' + (r.f.done ? 'check-circle-fill' : 'circle') + '"></i><span>' + esc(r.f.text) + '</span></button><button type="button" class="h-x" data-shopdel="' + esc(r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x-lg"></i></button></li>'; }).join('') + '</ul>' +
      (l.some(function (r) { return r.f.done; }) ? '<button type="button" class="h-link" data-shopclear>' + L('Clear ticked', 'Fjern avkryssede') + '</button>' : '');
  }
  function chores() {
    var w = info().what || {}, out = '', tk = today();
    if (w.chores !== false) {
      var l = list('chore').map(function (r) { var p = period(r.f), tu = turn(r.f, p); return { r: r, p: p, tu: tu, dn: doneOf(r.id, p) }; }).sort(function (a, b) { return (a.dn ? 1 : 0) - (b.dn ? 1 : 0) || (a.p.day < b.p.day ? -1 : 1); });
      var mine = l.filter(function (x) { return !x.dn && x.tu === 'them'; }).length;
      out += '<h2 class="h-h">' + L('Chores', 'Husarbeid') + '</h2><p class="h-sum">' + (l.length ? (mine ? L('Your turn: ', 'Din tur: ') + mine : L('Nothing on you right now', 'Ingenting på deg akkurat nå')) : L('No chores yet.', 'Ingen oppgaver ennå.')) + '</p>' +
        '<ul class="h-list">' + l.map(function (x) {
          var n = Math.round((fromKey(x.p.day) - fromKey(tk)) / 864e5), when = n === 0 ? L('today', 'i dag') : n === 1 ? L('tomorrow', 'i morgen') : n < 0 ? (x.dn ? '' : (-n) + L(' days late', ' dager på etterskudd')) : fdate(x.p.day, { weekday: 'long' });
          return '<li class="' + (x.dn ? 'done' : '') + '"><button type="button" class="h-tick" data-chore="' + esc(x.r.id) + '" aria-pressed="' + !!x.dn + '"><i class="bi bi-' + (x.dn ? 'check-circle-fill' : 'circle') + '"></i><span>' + esc(x.r.f.name) + '<small>' + esc([x.tu === 'them' ? L('Your turn', 'Din tur') : owner() + L('’s turn', ' sin tur'), when].filter(Boolean).join(' · ')) + '</small></span></button></li>';
        }).join('') + '</ul>';
    }
    if (w.plants !== false) {
      var pl = list('plant').map(function (r) { var due = r.f.last ? (function () { var d = fromKey(r.f.last); d.setDate(d.getDate() + (+r.f.every || 7)); return dkey(d); })() : tk; return { r: r, n: Math.round((fromKey(due) - fromKey(tk)) / 864e5) }; }).sort(function (a, b) { return a.n - b.n; });
      if (pl.length) out += '<h2 class="h-h">' + L('Plants', 'Planter') + '</h2><ul class="h-list">' + pl.map(function (x) {
        return '<li><span class="h-row"><span>' + esc(x.r.f.name) + '<small>' + esc(x.r.f.room || '') + '</small></span><span class="h-chip ' + (x.n < 0 ? 'bad' : x.n === 0 ? 'warn' : '') + '">' + (x.n < 0 ? L('Thirsty', 'Tørst') : x.n === 0 ? L('Today', 'I dag') : L('In ', 'Om ') + x.n + L(' d', ' d')) + '</span></span><button type="button" class="h-x" data-water="' + esc(x.r.id) + '" aria-label="' + L('Watered', 'Vannet') + '"><i class="bi bi-droplet-fill"></i></button></li>';
      }).join('') + '</ul>';
    }
    if (w.move !== false) {
      var mv = list('mv').sort(function (a, b) { return (a.f.done ? 1 : 0) - (b.f.done ? 1 : 0); });
      if (mv.length) out += '<h2 class="h-h">' + L('Moving checklist', 'Flyttesjekkliste') + (info().mvdate ? ' · ' + esc(fdate(info().mvdate, { day: 'numeric', month: 'short' })) : '') + '</h2><ul class="h-list">' + mv.map(function (r) {
        return '<li class="' + (r.f.done ? 'done' : '') + '"><button type="button" class="h-tick" data-mv="' + esc(r.id) + '" aria-pressed="' + !!r.f.done + '"><i class="bi bi-' + (r.f.done ? 'check-circle-fill' : 'circle') + '"></i><span>' + esc(r.f.text) + '</span></button></li>';
      }).join('') + '</ul>';
    }
    return out || '<p class="h-sum">' + L('Nothing shared here yet.', 'Ingenting delt her ennå.') + '</p>';
  }
  function money() {
    var b = balance(), o = owner();
    var rows = list('sx').map(function (r) { return { d: r.f.date, r: r, k: 'sx' }; }).concat(list('pay').map(function (r) { return { d: r.f.date, r: r, k: 'pay' }; })).sort(function (a, c) { return a.d < c.d ? 1 : a.d > c.d ? -1 : c.r.t - a.r.t; });
    var shown = showAllMoney ? rows : rows.slice(0, 12);
    return '<div class="h-bal ' + (Math.abs(b) < 1 ? 'even' : b > 0 ? 'owe' : 'get') + '"><small>' + (Math.abs(b) < 1 ? L('You’re even', 'Dere er skuls') : b > 0 ? L('You owe ', 'Du skylder ') + esc(o) : esc(o) + L(' owes you', ' skylder deg')) + '</small><b>' + (Math.abs(b) < 1 ? '0 kr' : esc(kr(Math.abs(b)))) + '</b>' +
      (Math.abs(b) >= 1 ? '<button type="button" class="h-btn sm" data-settle>' + L('Settle up', 'Gjør opp') + '</button>' : '') + '</div>' +
      '<button type="button" class="h-btn ghost wide" data-addcost><i class="bi bi-plus-lg"></i> ' + L('Add a shared cost', 'Legg til en felles utgift') + '</button>' +
      (rows.length ? '<ul class="h-list">' + shown.map(function (x) {
        var f = x.r.f;
        if (x.k === 'pay') return '<li><span class="h-row"><span><i class="bi bi-arrow-left-right"></i> ' + esc(f.from === 'p' ? L('You paid ', 'Du betalte ') + o : o + L(' paid you', ' betalte deg')) + '<small>' + esc(fdate(f.date)) + '</small></span><b>' + esc(kr(f.amount)) + '</b></span>' + (x.r.by === 'p' ? '<button type="button" class="h-x" data-paydel="' + esc(x.r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x-lg"></i></button>' : '') + '</li>';
        var s = f.shares || {};
        return '<li><span class="h-row"><span>' + esc(f.note || L('Shared', 'Felles')) + '<small>' + esc(fdate(f.date) + ' · ' + (f.payer === 'p' ? L('you paid', 'du betalte') : o + L(' paid', ' betalte')) + ' · ' + L('your part ', 'din del ') + kr(s.p)) + '</small></span><b>' + esc(kr(f.total)) + '</b></span>' + (x.r.by === 'p' ? '<button type="button" class="h-x" data-sxdel="' + esc(x.r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x-lg"></i></button>' : '') + '</li>';
      }).join('') + '</ul>' + (rows.length > 12 ? '<button type="button" class="h-link" data-moneyall>' + (showAllMoney ? L('Show fewer', 'Vis færre') : L('Show all ', 'Vis alle ') + rows.length) + '</button>' : '') : '<p class="h-sum">' + L('Nothing shared yet.', 'Ingenting delt ennå.') + '</p>');
  }
  var RN = { daily: 1, weekly: 7, '2weeks': 14, weekdays: 1 };
  function nextOf(f, from) {
    if (!f.repeat) return f.date >= from || (f.end && f.end >= from) ? f.date : null;
    if (f.until && f.until < from) return null;
    var d = fromKey(f.date), lim = fromKey(from), g = 0;
    while (dkey(d) < from && g++ < 800) { if (f.repeat === 'monthly') d.setMonth(d.getMonth() + 1); else if (f.repeat === 'yearly') d.setFullYear(d.getFullYear() + 1); else d.setDate(d.getDate() + (RN[f.repeat] || 7)); }
    if (f.repeat === 'weekdays') while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    var k = dkey(d); return f.until && k > f.until ? null : (d >= lim ? k : null);
  }
  function cal() {
    var tk = today(), l = list('ev').map(function (r) { return { r: r, d: nextOf(r.f, tk) }; }).filter(function (x) { return x.d; }).sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : String(a.r.f.start || '') < String(b.r.f.start || '') ? -1 : 1; });
    return '<button type="button" class="h-btn ghost wide" data-addev><i class="bi bi-plus-lg"></i> ' + L('Add an event', 'Legg til en hendelse') + '</button>' +
      (l.length ? '<ul class="h-list">' + l.slice(0, 40).map(function (x) { var f = x.r.f; return '<li><span class="h-row"><span>' + esc(f.title) + '<small>' + esc(fdate(x.d) + (f.allDay ? '' : ' · ' + (f.start || '') + (f.stop ? '–' + f.stop : '')) + (f.location ? ' · ' + f.location : '') + (f.repeat ? ' · ↻' : '')) + '</small></span></span>' + (x.r.by === 'p' ? '<button type="button" class="h-x" data-evdel="' + esc(x.r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x-lg"></i></button>' : '') + '</li>'; }).join('') + '</ul>'
        : '<p class="h-sum">' + L('Nothing coming up.', 'Ingenting som kommer.') + '</p>');
  }
  /* ---------- sheets ---------- */
  function sheet(h, onsub) {
    var bg = document.createElement('div'); bg.className = 'h-sheetbg';
    bg.innerHTML = '<form class="h-sheet">' + h + '<div class="h-acts"><button type="button" class="h-btn ghost" data-x>' + L('Cancel', 'Avbryt') + '</button><button type="submit" class="h-btn">' + L('Save', 'Lagre') + '</button></div></form>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var close = function () { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 200); };
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-x]')) close(); });
    bg.querySelector('form').onsubmit = function (e) { e.preventDefault(); if (onsub(e.target) !== false) close(); };
    return bg;
  }
  function costSheet() {
    var o = owner(), sp = info().split || { o: 50, p: 50 };
    sheet('<h2>' + L('Shared cost', 'Felles utgift') + '</h2><input name="amt" inputmode="decimal" placeholder="' + L('Amount, kr', 'Beløp, kr') + '" required><input name="note" maxlength="80" placeholder="' + L('What was it?', 'Hva var det?') + '">' +
      '<label class="h-lbl">' + L('Who paid', 'Hvem betalte') + '<select name="payer"><option value="p">' + L('I did', 'Jeg') + '</option><option value="o">' + esc(o) + '</option></select></label>' +
      '<label class="h-lbl">' + L('Split', 'Fordeling') + '<select name="split"><option value="usual">' + L('As usual', 'Som vanlig') + ' (' + L('you ', 'du ') + sp.p + ' %)</option><option value="half">50/50</option><option value="mine">' + L('All mine', 'Alt mitt') + '</option><option value="theirs">' + L('All ', 'Alt ') + esc(o) + L('’s', ' sitt') + '</option></select></label>' +
      '<input name="date" type="date" value="' + today() + '">', function (f) {
      var a = num(f.amt.value); if (!(a > 0)) { f.amt.focus(); return false; }
      var pp = f.split.value === 'half' ? 50 : f.split.value === 'mine' ? 100 : f.split.value === 'theirs' ? 0 : +sp.p || 50, mine = Math.round(a * pp) / 100;
      var id = 'h' + uid(); put('sx', id, { date: f.date.value || today(), note: f.note.value.trim().slice(0, 80) || L('Shared', 'Felles'), total: a, payer: f.payer.value, shares: { o: Math.round((a - mine) * 100) / 100, p: mine }, cat: 'other' });
      toast('<i class="bi bi-check2"></i> ' + esc(kr(a)) + L(' added', ' lagt til'), function () { put('sx', id, null, true); });
    });
  }
  function settleSheet() {
    var b = balance(), o = owner();
    sheet('<h2>' + L('Settle up', 'Gjør opp') + '</h2><p class="h-small">' + (b > 0 ? L('You pay ', 'Du betaler ') + esc(o) : esc(o) + L(' pays you', ' betaler deg')) + '</p><input name="amt" inputmode="decimal" value="' + esc(String(Math.abs(Math.round(b)))) + '" required><input name="date" type="date" value="' + today() + '">', function (f) {
      var a = num(f.amt.value); if (!(a > 0)) { f.amt.focus(); return false; }
      var id = 'h' + uid(); put('pay', id, b > 0 ? { date: f.date.value || today(), from: 'p', to: 'o', amount: a } : { date: f.date.value || today(), from: 'o', to: 'p', amount: a });
      toast('<i class="bi bi-check2"></i> ' + L('Settled ', 'Gjort opp ') + esc(kr(a)), function () { put('pay', id, null, true); });
    });
  }
  function evSheet() {
    sheet('<h2>' + L('New event', 'Ny hendelse') + '</h2><input name="title" maxlength="120" placeholder="' + L('Title', 'Tittel') + '" required><input name="date" type="date" value="' + today() + '" required>' +
      '<label class="h-check"><input type="checkbox" name="all"> ' + L('All day', 'Hele dagen') + '</label><div class="h-two"><input name="start" type="time" value="18:00"><input name="stop" type="time" value="19:00"></div><input name="loc" maxlength="160" placeholder="' + L('Where (optional)', 'Hvor (valgfritt)') + '">', function (f) {
      if (!f.title.value.trim()) { f.title.focus(); return false; }
      var ev = { title: f.title.value.trim(), date: f.date.value || today(), allDay: f.all.checked, location: f.loc.value.trim() };
      if (!f.all.checked) { ev.start = f.start.value || '18:00'; ev.stop = f.stop.value || ''; }
      var id = 'h' + uid(); put('ev', id, ev); toast('<i class="bi bi-calendar-check"></i> ' + esc(ev.title), function () { put('ev', id, null, true); });
    });
  }
  /* ---------- taps ---------- */
  app.addEventListener('submit', function (e) {
    if (!e.target.matches('[data-addshop]')) return; e.preventDefault();
    var i = e.target.shop, v = i.value.trim(); if (!v) return; i.value = '';
    v.split(/\s*,\s*/).filter(Boolean).forEach(function (x) { put('shop', 'h' + uid(), { text: x.slice(0, 120), done: false }); });
    i.focus();
  });
  function find(c, id) { return list(c).filter(function (r) { return r.id === id; })[0]; }
  app.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var d = b.dataset, r;
    if (d.reload != null) { location.reload(); return; }
    if (d.tab) { tab = d.tab; wj('home.tab', tab); menu = false; draw(); scrollTo(0, 0); return; }
    if (d.menu != null) { menu = !menu; draw(); return; }
    if (d.lang != null) { try { localStorage.setItem('home.lang', nb ? 'en' : 'nb'); } catch (x) {} location.reload(); return; }
    if (d.lock != null) { wj('home.key', null); location.reload(); return; }
    if (d.forget != null) { wj('home.key', null); wj('home.queue', null); wj('home.tab', null); location.reload(); return; }
    if (d.shop && (r = find('shop', d.shop))) { put('shop', r.id, { text: r.f.text, done: !r.f.done }); return; }
    if (d.shopdel && (r = find('shop', d.shopdel))) { var keep = r.f; put('shop', r.id, null, true); toast('<i class="bi bi-trash3"></i> ' + esc(keep.text), function () { put('shop', r.id, keep); }); return; }
    if (d.shopclear != null) { var gone = list('shop').filter(function (x) { return x.f.done; }); gone.forEach(function (x) { put('shop', x.id, null, true); }); toast('<i class="bi bi-trash3"></i> ' + gone.length + L(' removed', ' fjernet'), function () { gone.forEach(function (x) { put('shop', x.id, x.f); }); }); return; }
    if (d.chore && (r = find('chore', d.chore))) { var p = period(r.f), k = p.key + '|' + r.id, dn = doneOf(r.id, p); if (dn) put('cdone', k, null, true); else { put('cdone', k, { k: k, who: turn(r.f, p) }); toast('<i class="bi bi-check2"></i> ' + esc(r.f.name), function () { put('cdone', k, null, true); }); } return; }
    if (d.water && (r = find('plant', d.water))) { var was = r.f; put('plant', r.id, Object.assign({}, r.f, { last: today() })); toast('<i class="bi bi-droplet"></i> ' + L('Watered', 'Vannet'), function () { put('plant', r.id, was); }); return; }
    if (d.mv && (r = find('mv', d.mv))) { put('mv', r.id, { text: r.f.text, done: !r.f.done }); return; }
    if (d.addcost != null) { costSheet(); return; }
    if (d.settle != null) { settleSheet(); return; }
    if (d.moneyall != null) { showAllMoney = !showAllMoney; draw(); return; }
    if (d.addev != null) { evSheet(); return; }
    var del = d.sxdel ? ['sx', d.sxdel] : d.paydel ? ['pay', d.paydel] : d.evdel ? ['ev', d.evdel] : null;
    if (del && (r = find(del[0], del[1]))) { var kf = r.f; put(del[0], r.id, null, true); toast('<i class="bi bi-trash3"></i> ' + L('Removed', 'Fjernet'), function () { put(del[0], r.id, kf); }); }
  });
  boot();
})();
