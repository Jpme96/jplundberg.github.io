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
  var K = null, recs = {}, rids = {}, tab = rj('home.tab', 'shop'), me = 'p', PASS = null;
  /* preview: the owner opens this inside Settings → Shared space to see what the other one sees – read-only */
  var preview = (function () { var m = location.hash.match(/^#preview&k=([A-Za-z0-9_-]{43})/); if (!m) return null; history.replaceState(null, '', location.pathname); return m[1]; })();
  if (preview) { document.documentElement.classList.add('h-preview'); tab = 'shop'; }
  var pending = preview ? null : (function () { var m = location.hash.match(/[#&]k=([A-Za-z0-9_-]{43})/); if (m) { try { sessionStorage.setItem('home.newkey', m[1]); } catch (e) {} history.replaceState(null, '', location.pathname); return m[1]; } try { return sessionStorage.getItem('home.newkey'); } catch (e) { return null; } })();
  function screen(h) { app.innerHTML = '<div class="h-screen">' + h + '</div>'; var f = app.querySelector('input'); if (f && matchMedia('(hover: hover)').matches) f.focus(); }
  function boot() {
    if (preview) { K = preview; start(); return; }
    SC.api('share').then(function (j) {
      if (!j.partner) { screen('<i class="bi bi-house-heart h-big"></i><h1>' + L('This is the shared app', 'Dette er den delte appen') + '</h1><p>' + L('It’s for the person you share your home with. Your own dashboard is here:', 'Den er for den du deler hjemmet med. Ditt eget dashbord er her:') + '</p><a class="h-btn" href="/cmd/">' + L('Open your dashboard', 'Åpne dashbordet ditt') + '</a>'); return; }
      if (pending) return setPass(pending);
      var rem = rj('home.key', null); if (rem) { K = rem; My.remembered(); return start(); }
      SC.api('share?wrap').then(function (w) { askPass(w); }, function (e) {
        if (e.status === 404) screen('<i class="bi bi-qr-code-scan h-big"></i><h1>' + L('Almost there', 'Nesten klar') + '</h1><p>' + L('Open the Camera app and scan the code on the other phone (Settings → Shared space → Show the code).', 'Åpne Kamera-appen og skann koden på den andre telefonen (Innstillinger → Delt hjem → Vis koden).') + '</p><form class="h-form" data-paste><input name="link" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + L('…or paste the invite link here', '…eller lim inn invitasjonslenken her') + '"><p class="h-err" data-err></p><button class="h-btn" type="submit">' + L('Continue', 'Fortsett') + '</button></form>' +
          '<p class="h-small">' + L('Scan the code with this phone’s Camera after you’ve logged in here. If it still asks, copy the invite link on the other phone and paste it above.', 'Skann koden med Kamera på denne telefonen etter at du har logget inn her. Spør den fortsatt, kopier invitasjonslenken på den andre telefonen og lim den inn over.') + '</p>');
        var pf = app.querySelector('[data-paste]'); if (pf) pf.onsubmit = function (ev) { ev.preventDefault(); var m = String(pf.link.value).match(/[#&]k=([A-Za-z0-9_-]{43})/) || String(pf.link.value).trim().match(/^([A-Za-z0-9_-]{43})$/); if (!m) { pf.querySelector('[data-err]').textContent = L('That isn’t an invite link.', 'Det er ikke en invitasjonslenke.'); return; } pending = m[1]; setPass(m[1]); };
        else offline();
      });
    }, function (e) {
      if (e.status === 403) { stoppedScreen(); return; }
      if (e.status === 401) screen('<i class="bi bi-box-arrow-in-right h-big"></i><h1>' + L('Log in again', 'Logg inn igjen') + '</h1><button class="h-btn" type="button" data-reload>' + L('Reload', 'Last inn på nytt') + '</button>');
      else offline();
    });
  }
  function stoppedScreen() {
    ['home.key', 'home.queue', 'home.profiled', 'home.tab'].forEach(function (k) { wj(k, null); });
    try { sessionStorage.removeItem('home.newkey'); } catch (e) {}
    K = null; recs = {}; rids = {}; queue = {}; stopped = true;
    screen('<i class="bi bi-door-closed h-big"></i><h1>' + L('Sharing has stopped', 'Delingen er stoppet') + '</h1><p>' + L('Nothing shared is kept on this phone any more. If you get a new code, scan it to start again.', 'Ingenting delt ligger igjen på denne telefonen. Får du en ny kode, skann den for å starte på nytt.') + '</p><button class="h-btn ghost" type="button" data-reload>' + L('Check again', 'Sjekk igjen') + '</button>');
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
      PASS = f.a.value; SC.importKey(k).then(function () { return SC.wrap(f.a.value, k); }).then(function (w) { return SC.api('share?wrap', { method: 'PUT', body: w }); }).then(function () {
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
      var pw = f.a.value; SC.unwrap(pw, w).then(function (k) { K = k; PASS = pw; if (f.rem.checked) wj('home.key', k); My.unlock(pw, f.rem.checked).then(start, start); }, function () { er.textContent = L('Wrong passcode.', 'Feil kode.'); f.a.select(); });
    };
  }

  /* ---------- the box ---------- */
  var badKey = 0;
  function absorb(srv) {
    var r = (srv && srv.recs) || {}, jobs = []; badKey = 0;
    Object.keys(r).forEach(function (rid) {
      var x = r[rid], old = recs[rid]; if (old && old.t === x.t) return;
      if (x.del) { recs[rid] = { t: x.t, del: 1, c: old && old.c, id: old && old.id }; return; }
      jobs.push(SC.decrypt(K, x).then(function (o) { recs[rid] = { t: x.t, by: x.by, c: o.c, id: o.id, f: SC.clean(o.c, o.f) || {} }; rids[o.c + '|' + o.id] = rid; }, function () { badKey++; }));
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
    if (preview) { toast('<i class="bi bi-eye"></i> ' + L('Preview – nothing changes here', 'Forhåndsvisning – ingenting endres her')); return Promise.resolve(); }
    var t = Date.now(), key = c + '|' + id, cf = del ? null : SC.clean(c, f);
    return (rids[key] ? Promise.resolve(rids[key]) : SC.rid(K, c, id)).then(function (rid) {
      rids[key] = rid; recs[rid] = del ? { t: t, del: 1, c: c, id: id } : { t: t, by: me, c: c, id: id, f: cf }; draw();
      if (del) { queue[rid] = { t: t, del: 1 }; return; }
      return SC.encrypt(K, { c: c, id: id, f: cf }).then(function (e) { queue[rid] = { t: t, iv: e.iv, ct: e.ct }; });
    }).then(function () { wj('home.queue', queue); return flush(); }).then(draw);
  }
  function pull() { if (preview) return SC.api('shared').then(absorb).then(draw, function () {}); return flush().then(function () { return SC.api('shared'); }).then(absorb).then(draw, function (e) { if (e && e.status === 403) stoppedScreen(); }); }
  var stopped = false;
  function start() {
    app.innerHTML = '<p class="h-wait"><i class="bi bi-arrow-repeat"></i></p>';
    pull().then(function () {
      if (preview) return;
      if (!stopped && badKey && !list('info').length) {   /* sharing was started again with a new key */
        wj('home.key', null); K = null; recs = {}; rids = {};
        screen('<i class="bi bi-qr-code-scan h-big"></i><h1>' + L('Scan the new code', 'Skann den nye koden') + '</h1><p>' + L('Sharing was started again, so the old code no longer works.', 'Delingen ble startet på nytt, så den gamle koden virker ikke lenger.') + '</p><button class="h-btn" type="button" data-reload>' + L('Continue', 'Fortsett') + '</button>');
        return;
      }
      if (!stopped && list('info').length && !list('pme').length && !rj('home.profiled', false)) setTimeout(profileSheet, 300); if (!stopped && !list('info').length) screen('<i class="bi bi-hourglass-split h-big"></i><h1>' + L('Waiting for the first sync', 'Venter på første synk') + '</h1><p>' + L('Ask the other one to open their dashboard once.', 'Be den andre åpne dashbordet sitt én gang.') + '</p><button class="h-btn ghost" type="button" data-reload>' + L('Check again', 'Sjekk igjen') + '</button>'); });
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
  /* the log: the owner's record of every tick (clog) plus your own ticks not yet in it */
  function logList() {
    var l = list('clog').map(function (r) { return r.f; }), have = {};
    l.forEach(function (x) { have[x.cid + '|' + x.at] = 1; });
    list('cdone').forEach(function (r) { var f = r.f, cid = String(f.k || '').split('|')[1], ch = find('chore', cid); if (f.at && !have[cid + '|' + f.at]) l.push({ cid: cid, name: ch ? ch.f.name : '', who: f.who, at: f.at }); });
    return l.filter(function (x) { return x.at; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }
  function lastDone(cid) { return logList().filter(function (x) { return x.cid === cid; })[0] || null; }
  var showLog = false;
  function choreLog() {
    var l = logList(); if (!l.length) return '';
    var ym = today().slice(0, 7), me = 0, o = 0; l.forEach(function (x) { if (x.at.slice(0, 7) === ym) { if (x.who === 'them') me++; else o++; } });
    return '<p class="h-sum">' + L('This month: you ', 'Denne måneden: du ') + me + ' · ' + esc(owner()) + ' ' + o + '</p><button type="button" class="h-link" data-chlog>' + (showLog ? L('Hide history', 'Skjul historikk') : L('History', 'Historikk')) + '</button>' +
      (showLog ? '<ul class="h-list">' + l.slice(0, 40).map(function (x) { return '<li><span class="h-row"><span>' + esc(x.name || L('Chore', 'Oppgave')) + '<small>' + esc(fdate(x.at, { weekday: 'short', day: 'numeric', month: 'short' })) + '</small></span><small>' + esc(x.who === 'them' ? L('You', 'Du') : owner()) + '</small></span></li>'; }).join('') + '</ul>' : '');
  }
  function doneOf(cid, p) { var r = list('cdone').filter(function (x) { return x.f.k === p.key + '|' + cid; })[0]; return r ? r.f.who : null; }

  /* ---------- money ---------- */
  function balance() {   /* > 0: you owe the owner */
    var b = +info().extra || 0;
    list('sx').forEach(function (r) { var f = r.f, s = f.shares || {}; b += f.payer === 'o' ? +s.p || 0 : -(+s.o || 0); });
    list('pay').forEach(function (r) { var f = r.f; b += f.from === 'o' ? +f.amount || 0 : -(+f.amount || 0); });
    list('led').forEach(function (r) { var f = r.f; b += f.kind === 'back' ? +f.amount || 0 : f.payer === 'o' ? +f.p || 0 : -(+f.o || 0); });
    return Math.round(b * 100) / 100;
  }

  /* ---------- drawing ---------- */
  var TABS = [['shop', 'cart3', 'Food', 'Mat'], ['chores', 'arrow-repeat', 'Chores', 'Husarbeid'], ['money', 'people', 'Money', 'Penger'], ['cal', 'calendar-heart', 'Plans', 'Planer'], ['notes', 'sticky', 'Home', 'Hjem'], ['me', 'person-lock', 'Me', 'Meg']];
  var showAllMoney = false;
  function tabsOn() { var w = info().what || {}, on = function (k) { return w[k] !== false; };
    return TABS.filter(function (t) { return { shop: on('shop') || on('meals') || on('pantry') || on('recipes'), chores: on('chores') || on('plants') || on('move'), money: on('money') || on('bills'), cal: on('cal') || on('trips'), notes: on('notes') || on('house'), me: !preview && My.any() }[t[0]]; }); }
  /* avatars: yours (you make it in Settings) and the owner's */
  function mine() { var r = list('pme')[0]; return r ? r.f : {}; }
  function myName() { return mine().name || info().partner || L('You', 'Deg'); }
  var MOM = { k: 'day', bg: '#1d2533', sky: 'sun', i: 'sun', c: '#f2c94c' };
  function face(look, cls) { var A = window.Avatar; if (!A || !A.figure || !look) return '<span class="h-av ' + (cls || '') + ' none"><i class="bi bi-person"></i></span>'; try { return '<span class="h-av ' + (cls || '') + '">' + A.figure(A.MOMENTS && A.MOMENTS.day || MOM, look) + '</span>'; } catch (e) { return '<span class="h-av none"><i class="bi bi-person"></i></span>'; } }
  function draw() {
    if (!K || stopped || !list('info').length) return;
    var ts = tabsOn(); if (!ts.some(function (t) { return t[0] === tab; })) tab = ts.length ? ts[0][0] : 'shop';
    var keep = document.activeElement && document.activeElement.name ? { n: document.activeElement.name, v: document.activeElement.value } : null;
    app.innerHTML = '<header class="h-top"><div class="h-faces">' + face(info().olook, 'o') + face(mine().look, 'p') + '</div><div class="h-tt"><small>' + esc(fdate(today(), { weekday: 'long', day: 'numeric', month: 'long' })) + '</small><h1>' + esc(L('Home with ', 'Hjemme med ') + owner()) + '</h1></div><button type="button" class="h-icon" data-menu aria-label="' + L('Settings', 'Innstillinger') + '"><i class="bi bi-gear"></i></button></header>' +
      (!mine().look && !preview ? '<button type="button" class="h-nudge" data-avatar><i class="bi bi-person-bounding-box"></i> ' + L('Make your avatar – it shows up for ', 'Lag avataren din – den dukker opp hos ') + esc(owner()) + '</button>' : '') +
      (preview ? '<div class="h-prevbar"><i class="bi bi-eye"></i> ' + L('Preview of ', 'Forhåndsvisning av ') + esc(info().partner || L('their', 'deres')) + L('’s app – nothing can be changed here', ' sin app – ingenting kan endres her') + '</div>' : '') +
      '<section class="h-body">' + ({ shop: shop, chores: chores, money: money, cal: cal, notes: notes, me: My.view }[tab] || shop)() + '</section>' +
      '<nav class="h-tabs">' + ts.map(function (t) { return '<button type="button" data-tab="' + t[0] + '" aria-current="' + (t[0] === tab) + '"><i class="bi bi-' + t[1] + '"></i><span>' + L(t[2], t[3]) + '</span></button>'; }).join('') + '</nav>';
    if (keep) { var el = app.querySelector('[name="' + keep.n + '"]'); if (el && 'value' in el) { el.value = keep.v; el.focus(); } }
  }
  function dinners() {
    if ((info().what || {}).meals === false) return '';
    var by = {}; list('meal').forEach(function (r) { by[r.f.date || r.id] = r.f.text; });
    var rows = []; for (var i = 0; i < 7; i++) { var d = new Date(); d.setDate(d.getDate() + i); var k = dkey(d); rows.push('<li><button type="button" class="h-tick" data-meal="' + k + '"><i class="bi bi-' + (by[k] ? 'egg-fried' : 'plus-circle') + '"></i><span>' + (by[k] ? esc(by[k]) : '<em>' + L('Add dinner', 'Legg til middag') + '</em>') + '<small>' + esc(i === 0 ? L('Today', 'I dag') : i === 1 ? L('Tomorrow', 'I morgen') : fdate(k, { weekday: 'long' })) + '</small></span></button></li>'); }
    return '<h2 class="h-h">' + L('Dinners this week', 'Middager denne uka') + '</h2><ul class="h-list">' + rows.join('') + '</ul>';
  }
  function pantryHtml() {
    if ((info().what || {}).pantry !== true) return '';
    var l = list('pantry').sort(function (a, b) { return (a.f.state === 'low' ? 0 : 1) - (b.f.state === 'low' ? 0 : 1) || String(a.f.name).localeCompare(String(b.f.name)); }); if (!l.length) return '';
    return '<h2 class="h-h">' + L('Pantry – tap what’s running out', 'Matskap – trykk på det som snart er tomt') + '</h2><div class="h-chips">' + l.map(function (r) { return '<button type="button" class="h-pchip' + (r.f.state === 'low' ? ' low' : '') + '" data-pantry="' + esc(r.id) + '">' + esc(r.f.name) + '</button>'; }).join('') + '</div>';
  }
  function recipesHtml() {
    if ((info().what || {}).recipes !== true) return '';
    var l = list('recipe').sort(function (a, b) { return String(a.f.title).localeCompare(String(b.f.title)); }); if (!l.length) return '';
    return '<h2 class="h-h">' + L('Recipes', 'Oppskrifter') + '</h2><ul class="h-list">' + l.map(function (r) { return '<li><button type="button" class="h-tick" data-recipe="' + esc(r.id) + '"><i class="bi bi-journal-text"></i><span>' + esc(r.f.title) + '<small>' + esc([r.f.mins ? r.f.mins + ' min' : '', r.f.serves ? L('serves ', 'til ') + r.f.serves : ''].filter(Boolean).join(' · ')) + '</small></span></button></li>'; }).join('') + '</ul>';
  }
  function shop() {
    if ((info().what || {}).shop === false) return dinners() + pantryHtml() + recipesHtml();
    var l = list('shop').sort(function (a, b) { return (a.f.done ? 1 : 0) - (b.f.done ? 1 : 0) || a.t - b.t; }), open = l.filter(function (r) { return !r.f.done; }).length;
    return '<form class="h-add" data-addshop><input name="shop" placeholder="' + L('Add to the list …', 'Legg til på listen …') + '" autocomplete="off" enterkeyhint="done"><button type="submit" aria-label="' + L('Add', 'Legg til') + '"><i class="bi bi-plus-lg"></i></button></form>' +
      '<p class="h-sum">' + (l.length ? (open ? open + ' ' + L('to buy', 'å kjøpe') : L('All bought', 'Alt er kjøpt')) : L('The list is empty.', 'Listen er tom.')) + '</p>' +
      '<ul class="h-list">' + l.map(function (r) { return '<li class="' + (r.f.done ? 'done' : '') + '"><button type="button" class="h-tick" data-shop="' + esc(r.id) + '" aria-pressed="' + !!r.f.done + '"><i class="bi bi-' + (r.f.done ? 'check-circle-fill' : 'circle') + '"></i><span>' + esc(r.f.text) + '</span></button><button type="button" class="h-x" data-shopdel="' + esc(r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x-lg"></i></button></li>'; }).join('') + '</ul>' +
      (l.some(function (r) { return r.f.done; }) ? '<button type="button" class="h-link" data-shopclear>' + L('Clear ticked', 'Fjern avkryssede') + '</button>' : '') + dinners() + pantryHtml() + recipesHtml();
  }
  function chores() {
    var w = info().what || {}, out = '', tk = today();
    if (w.chores !== false) {
      var l = list('chore').map(function (r) { var p = period(r.f), tu = turn(r.f, p); return { r: r, p: p, tu: tu, dn: doneOf(r.id, p) }; }).sort(function (a, b) { return (a.dn ? 1 : 0) - (b.dn ? 1 : 0) || (a.p.day < b.p.day ? -1 : 1); });
      var mine = l.filter(function (x) { return !x.dn && x.tu === 'them'; }).length;
      out += '<h2 class="h-h">' + L('Chores', 'Husarbeid') + '</h2><p class="h-sum">' + (l.length ? (mine ? L('Your turn: ', 'Din tur: ') + mine : L('Nothing on you right now', 'Ingenting på deg akkurat nå')) : L('No chores yet.', 'Ingen oppgaver ennå.')) + '</p>' +
        '<ul class="h-list">' + l.map(function (x) {
          var n = Math.round((fromKey(x.p.day) - fromKey(tk)) / 864e5), when = n === 0 ? L('today', 'i dag') : n === 1 ? L('tomorrow', 'i morgen') : n < 0 ? (x.dn ? '' : (-n) + L(' days late', ' dager på etterskudd')) : fdate(x.p.day, { weekday: 'long' });
          var ls = lastDone(x.r.id);
          return '<li class="' + (x.dn ? 'done' : '') + '"><button type="button" class="h-tick" data-chore="' + esc(x.r.id) + '" aria-pressed="' + !!x.dn + '"><i class="bi bi-' + (x.dn ? 'check-circle-fill' : 'circle') + '"></i><span>' + esc(x.r.f.name) + '<small>' + esc([x.tu === 'them' ? L('Your turn', 'Din tur') : owner() + L('’s turn', ' sin tur'), when, ls ? L('last ', 'sist ') + fdate(ls.at, { weekday: 'short', day: 'numeric', month: 'short' }) + L(' by ', ' av ') + (ls.who === 'them' ? L('you', 'deg') : owner()) : ''].filter(Boolean).join(' · ')) + '</small></span></button><button type="button" class="h-x" data-choreedit="' + esc(x.r.id) + '" aria-label="' + L('Edit', 'Endre') + '"><i class="bi bi-pencil"></i></button></li>';
        }).join('') + '</ul><button type="button" class="h-btn ghost wide" data-choreadd><i class="bi bi-plus-lg"></i> ' + L('Add a chore', 'Legg til en oppgave') + '</button>' + choreLog();
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
  function bills() {
    var l = list('bill').sort(function (a, c) { return (a.f.next || '') < (c.f.next || '') ? -1 : 1; }), o = owner(); if (!l.length) return '';
    var tot = l.reduce(function (a, r) { return a + (+r.f.part || 0); }, 0);
    return '<h2 class="h-h">' + L('Home bills · your part ', 'Regninger · din del ') + esc(kr(tot)) + L(' a month', ' i måneden') + '</h2><ul class="h-list">' + l.map(function (r) { var f = r.f;
      return '<li><span class="h-row"><span>' + esc(f.name) + '<small>' + esc(fdate(f.next, { day: 'numeric', month: 'short' }) + ' · ' + (f.payer === 'o' ? o + L(' pays it', ' betaler') : f.payer === 'p' ? L('you pay it', 'du betaler') : L('you each pay your part', 'dere betaler hver deres del')) + ' · ' + L('of ', 'av ') + kr(f.amount)) + '</small></span><b>' + esc(kr(f.part)) + '</b></span></li>'; }).join('') + '</ul>';
  }
  function money() {
    if ((info().what || {}).money === false) return bills() || '<p class="h-sum">' + L('Nothing shared here yet.', 'Ingenting delt her ennå.') + '</p>';
    var b = balance(), o = owner();
    var rows = list('sx').map(function (r) { return { d: r.f.date, r: r, k: 'sx' }; }).concat(list('pay').map(function (r) { return { d: r.f.date, r: r, k: 'pay' }; })).concat(list('led').map(function (r) { return { d: r.f.date, r: r, k: 'led' }; })).sort(function (a, c) { return a.d < c.d ? 1 : a.d > c.d ? -1 : c.r.t - a.r.t; });
    var shown = showAllMoney ? rows : rows.slice(0, 12);
    return '<div class="h-bal ' + (Math.abs(b) < 1 ? 'even' : b > 0 ? 'owe' : 'get') + '"><small>' + (Math.abs(b) < 1 ? L('You’re even', 'Dere er skuls') : b > 0 ? L('You owe ', 'Du skylder ') + esc(o) : esc(o) + L(' owes you', ' skylder deg')) + '</small><b>' + (Math.abs(b) < 1 ? '0 kr' : esc(kr(Math.abs(b)))) + '</b>' +
      (Math.abs(b) >= 1 ? '<button type="button" class="h-btn sm" data-settle>' + L('Settle up', 'Gjør opp') + '</button>' : '') + '</div>' +
      '<button type="button" class="h-btn ghost wide" data-addcost><i class="bi bi-plus-lg"></i> ' + L('Add a shared cost', 'Legg til en felles utgift') + '</button>' +
      (rows.length ? '<p class="h-small h-key"><b class="pos">+</b> ' + esc(o) + L(' owes you for it', ' skylder deg for det') + ' · <b class="neg">−</b> ' + L('you owe ', 'du skylder ') + esc(o) + L(' for it', ' for det') + '</p><ul class="h-list">' + shown.map(function (x) {
        var f = x.r.f;
        if (x.k === 'led') { var you = f.kind === 'back' ? f.amount : f.payer === 'o' ? f.p : f.o;
          return '<li><span class="h-row"><span><i class="bi bi-' + (f.kind === 'bill' ? 'receipt' : f.kind === 'back' ? 'arrow-return-left' : 'calendar2-week') + '"></i> ' + esc(f.note) + '<small>' + esc(fdate(f.date) + ' · ' + (f.kind === 'back' ? o + L(' paid you back', ' betalte deg tilbake') : (f.payer === 'o' ? o + L(' paid', ' betalte') : L('you paid', 'du betalte')) + ' · ' + (f.payer === 'o' ? L('your part ', 'din del ') + kr(f.p) : L('their part ', 'deres del ') + kr(f.o)))) + '</small></span><b class="' + (f.kind === 'back' ? 'neg' : f.payer === 'o' ? 'neg' : 'pos') + '">' + (f.kind === 'back' || f.payer === 'o' ? '−' : '+') + esc(kr(you)) + '</b></span></li>'; }
        if (x.k === 'pay') return '<li><span class="h-row"><span><i class="bi bi-arrow-left-right"></i> ' + esc(f.from === 'p' ? L('You paid ', 'Du betalte ') + o : o + L(' paid you', ' betalte deg')) + '<small>' + esc(fdate(f.date)) + '</small></span><b>' + esc(kr(f.amount)) + '</b></span>' + (x.r.by === 'p' ? '<button type="button" class="h-x" data-paydel="' + esc(x.r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x-lg"></i></button>' : '') + '</li>';
        var s = f.shares || {};
        return '<li><span class="h-row"><span>' + esc(f.note || L('Shared', 'Felles')) + '<small>' + esc(fdate(f.date) + ' · ' + (f.payer === 'p' ? L('you paid ', 'du betalte ') + kr(f.total) + ' · ' + o + L('’s part ', ' sin del ') + kr(s.o) : o + L(' paid ', ' betalte ') + kr(f.total) + ' · ' + L('your part ', 'din del ') + kr(s.p))) + '</small></span><b class="' + (f.payer === 'p' ? 'pos' : 'neg') + '">' + (f.payer === 'p' ? '+' : '−') + esc(kr(f.payer === 'p' ? s.o : s.p)) + '</b></span>' + (x.r.by === 'p' ? '<button type="button" class="h-x" data-sxdel="' + esc(x.r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x-lg"></i></button>' : '') + '</li>';
      }).join('') + '</ul>' + (rows.length > 12 ? '<button type="button" class="h-link" data-moneyall>' + (showAllMoney ? L('Show fewer', 'Vis færre') : L('Show all ', 'Vis alle ') + rows.length) + '</button>' : '') : '<p class="h-sum">' + L('Nothing shared yet.', 'Ingenting delt ennå.') + '</p>') + bills();
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
  function trips() {
    var l = list('trip').sort(function (a, b) { return (a.f.start || '') < (b.f.start || '') ? -1 : 1; }); if (!l.length) return '';
    return '<h2 class="h-h">' + L('Trips', 'Turer') + '</h2><ul class="h-list">' + l.map(function (r) { var f = r.f, pk = f.pack || [], dn = pk.filter(function (x) { return x.done; }).length, n = f.start ? Math.round((fromKey(f.start) - fromKey(today())) / 864e5) : null;
      return '<li><button type="button" class="h-tick" data-trip="' + esc(r.id) + '"><i class="bi bi-airplane"></i><span>' + esc(f.name + (f.dest && f.dest !== f.name ? ' · ' + f.dest : '')) + '<small>' + esc((f.start ? fdate(f.start, { day: 'numeric', month: 'short' }) + (f.end ? '–' + fdate(f.end, { day: 'numeric', month: 'short' }) : '') : '') + (n != null && n > 0 ? ' · ' + L('in ', 'om ') + n + L(' days', ' dager') : '') + (pk.length ? ' · ' + L('packed ', 'pakket ') + dn + '/' + pk.length : '')) + '</small></span></button></li>'; }).join('') + '</ul>';
  }
  function house() {
    var pj = list('proj').sort(function (a, b) { return String(a.f.name).localeCompare(String(b.f.name)); }), dc = list('doc').sort(function (a, b) { return String(a.f.name).localeCompare(String(b.f.name)); }), out = '';
    var ST = { idea: L('Idea', 'Idé'), plan: L('Planned', 'Planlagt'), doing: L('In progress', 'Pågår'), done: L('Done', 'Ferdig') };
    if (pj.length) out += '<h2 class="h-h">' + L('House projects', 'Prosjekter') + '</h2><ul class="h-list">' + pj.map(function (r) { var f = r.f, tk = f.tasks || [], dn = tk.filter(function (x) { return x.done; }).length;
      return '<li><button type="button" class="h-tick" data-proj="' + esc(r.id) + '"><i class="bi bi-hammer"></i><span>' + esc(f.name) + '<small>' + esc([ST[f.status] || '', f.room, tk.length ? dn + '/' + tk.length + L(' tasks', ' oppgaver') : '', f.budget ? L('budget ', 'budsjett ') + kr(f.budget) + (f.spent ? ' · ' + L('spent ', 'brukt ') + kr(f.spent) : '') : ''].filter(Boolean).join(' · ')) + '</small></span></button></li>'; }).join('') + '</ul>';
    if (dc.length) out += '<h2 class="h-h">' + L('Documents', 'Dokumenter') + '</h2><ul class="h-list">' + dc.map(function (r) { var f = r.f, n = (f.files || []).length;
      return '<li><button type="button" class="h-tick" data-doc="' + esc(r.id) + '"><i class="bi bi-file-earmark-text"></i><span>' + esc(f.name) + '<small>' + esc([f.cat, f.date ? fdate(f.date, { day: 'numeric', month: 'short', year: 'numeric' }) : '', n ? n + (n === 1 ? L(' file', ' fil') : L(' files', ' filer')) : L('the file is on its way', 'filen er på vei')].filter(Boolean).join(' · ')) + '</small></span></button></li>'; }).join('') + '</ul>';
    return out;
  }
  function notes() {
    if ((info().what || {}).notes === false) return house() || '<p class="h-sum">' + L('Nothing shared here yet.', 'Ingenting delt her ennå.') + '</p>';
    var l = list('note').sort(function (a, b) { return String(a.f.title || '').localeCompare(String(b.f.title || '')); });
    return '<button type="button" class="h-btn ghost wide" data-noteadd><i class="bi bi-plus-lg"></i> ' + L('Add a note', 'Legg til et notat') + '</button>' +
      (l.length ? '<ul class="h-list h-notes">' + l.map(function (r) { return '<li><button type="button" class="h-tick" data-note="' + esc(r.id) + '"><i class="bi bi-sticky"></i><span>' + esc(r.f.title || L('Note', 'Notat')) + '<small class="h-pre">' + esc(r.f.text || '') + '</small></span></button></li>'; }).join('') + '</ul>'
        : '<p class="h-sum">' + L('Bin days, the Wi-Fi name, who to call when something breaks – notes you both see.', 'Søppeldager, navnet på Wi-Fi, hvem man ringer når noe går i stykker – notater dere begge ser.') + '</p>') + house();
  }
  function cal() {
    if ((info().what || {}).cal === false) return trips() || '<p class="h-sum">' + L('Nothing shared here yet.', 'Ingenting delt her ennå.') + '</p>';
    var tk = today(), l = list('ev').map(function (r) { return { r: r, d: nextOf(r.f, tk) }; }).filter(function (x) { return x.d; }).sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : String(a.r.f.start || '') < String(b.r.f.start || '') ? -1 : 1; });
    return trips() + '<h2 class="h-h">' + L('Coming up', 'Kommer') + '</h2><button type="button" class="h-btn ghost wide" data-addev><i class="bi bi-plus-lg"></i> ' + L('Add an event', 'Legg til en hendelse') + '</button>' +
      (l.length ? '<ul class="h-list">' + l.slice(0, 40).map(function (x) { var f = x.r.f; return '<li><span class="h-row"><span>' + esc(f.title) + '<small>' + esc(fdate(x.d) + (f.allDay ? '' : ' · ' + (f.start || '') + (f.stop ? '–' + f.stop : '')) + (f.location ? ' · ' + f.location : '') + (f.repeat ? ' · ↻' : '')) + '</small></span></span>' + (x.r.by === 'p' ? '<button type="button" class="h-x" data-evdel="' + esc(x.r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x-lg"></i></button>' : '') + '</li>'; }).join('') + '</ul>'
        : '<p class="h-sum">' + L('Nothing coming up.', 'Ingenting som kommer.') + '</p>') + earlier();
  }
  /* events that have been (one-off, last 30 days) – so one added for yesterday doesn't seem to vanish */
  var showEarlier = false;
  function earlier() {
    var tk = today(), from = (function () { var d = new Date(); d.setDate(d.getDate() - 30); return dkey(d); })();
    var l = list('ev').filter(function (r) { var f = r.f, end = f.end || f.date; return !f.repeat && f.date && end < tk && f.date >= from; }).sort(function (a, b) { return a.f.date < b.f.date ? 1 : -1; });
    if (!l.length) return '';
    return '<button type="button" class="h-link" data-earlier>' + (showEarlier ? L('Hide earlier', 'Skjul tidligere') : L('Earlier', 'Tidligere') + ' (' + l.length + ')') + '</button>' +
      (showEarlier ? '<ul class="h-list h-past">' + l.map(function (r) { var f = r.f; return '<li><span class="h-row"><span>' + esc(f.title) + '<small>' + esc(fdate(f.date) + (f.allDay ? '' : ' · ' + (f.start || '') + (f.stop ? '–' + f.stop : '')) + (f.location ? ' · ' + f.location : '')) + '</small></span></span>' + (r.by === 'p' ? '<button type="button" class="h-x" data-evdel="' + esc(r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x-lg"></i></button>' : '') + '</li>'; }).join('') + '</ul>' : '');
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
      var id = 'h' + uid(); put('ev', id, ev); if (ev.date < today()) showEarlier = true; toast('<i class="bi bi-calendar-check"></i> ' + esc(ev.title) + (ev.date < today() ? ' · ' + L('under Earlier', 'under Tidligere') : ''), function () { put('ev', id, null, true); });
    });
  }
  function mealSheet(k) {
    var cur = list('meal').filter(function (r) { return (r.f.date || r.id) === k; })[0];
    sheet('<h2>' + esc(L('Dinner · ', 'Middag · ') + fdate(k, { weekday: 'long', day: 'numeric', month: 'short' })) + '</h2><input name="text" maxlength="80" placeholder="' + L('e.g. Tacos', 'f.eks. Taco') + '" value="' + esc(cur ? cur.f.text : '') + '">' + (cur ? '<button type="button" class="h-link danger" data-mealdel="' + k + '">' + L('Remove this dinner', 'Fjern denne middagen') + '</button>' : ''), function (f) {
      var v = f.text.value.trim(); if (!v) { if (cur) put('meal', k, null, true); return; } put('meal', k, { date: k, text: v });
    });
  }
  function tripSheet(id) {
    var r = find('trip', id); if (!r) return;
    var bg = sheet('<h2>' + esc(r.f.name) + '</h2><p class="h-small">' + L('Tick things off as you pack – you both see it.', 'Kryss av mens dere pakker – dere ser det begge.') + '</p><ul class="h-list" data-packlist></ul>', function () {});
    var ul = bg.querySelector('[data-packlist]'), paint = function () { var x = find('trip', id); ul.innerHTML = ((x && x.f.pack) || []).map(function (p, i) { return '<li class="' + (p.done ? 'done' : '') + '"><button type="button" class="h-tick" data-pk="' + i + '"><i class="bi bi-' + (p.done ? 'check-circle-fill' : 'circle') + '"></i><span>' + esc(p.t) + '</span></button></li>'; }).join('') || '<li><span class="h-row"><span>' + L('No packing list yet.', 'Ingen pakkeliste ennå.') + '</span></span></li>'; };
    paint(); bg.querySelector('[type=submit]').textContent = L('Done', 'Ferdig'); var cx = bg.querySelector('[data-x]'); if (cx) cx.remove();
    ul.addEventListener('click', function (e) { var b = e.target.closest('[data-pk]'); if (!b) return; var x = find('trip', id); if (!x) return; var pk = (x.f.pack || []).map(function (p) { return { t: p.t, done: p.done }; }); pk[+b.dataset.pk].done = !pk[+b.dataset.pk].done; put('trip', id, Object.assign({}, x.f, { pack: pk })).then(paint); paint(); });
  }
  function noteSheet(id) {
    var r = id ? find('note', id) : null;
    sheet('<h2>' + (r ? L('Note', 'Notat') : L('New note', 'Nytt notat')) + '</h2><input name="title" maxlength="60" placeholder="' + L('Title – e.g. Bins', 'Tittel – f.eks. Søppel') + '" value="' + esc(r ? r.f.title : '') + '" required><textarea name="text" rows="6" maxlength="1500" placeholder="' + L('Write it here', 'Skriv det her') + '">' + esc(r ? r.f.text : '') + '</textarea>' + (r ? '<button type="button" class="h-link danger" data-notedel="' + esc(r.id) + '">' + L('Delete this note', 'Slett notatet') + '</button>' : '') + '<p class="h-small">' + L('Don’t put passwords here.', 'Ikke skriv passord her.') + '</p>', function (f) {
      if (!f.title.value.trim()) { f.title.focus(); return false; }
      put('note', r ? r.id : 'h' + uid(), { title: f.title.value.trim(), text: f.text.value.trim() });
    });
  }
  var DAYS = function () { return [L('Monday', 'mandag'), L('Tuesday', 'tirsdag'), L('Wednesday', 'onsdag'), L('Thursday', 'torsdag'), L('Friday', 'fredag'), L('Saturday', 'lørdag'), L('Sunday', 'søndag')]; };
  function choreSheet(id) {
    var r = id ? find('chore', id) : null, f = r ? r.f : { every: '1w', day: 5, who: 'rotate' }, o = owner();
    sheet('<h2>' + (r ? L('Edit chore', 'Endre oppgave') : L('New chore', 'Ny oppgave')) + '</h2><input name="name" maxlength="80" placeholder="' + L('e.g. Take out the bins', 'f.eks. Ta ut søpla') + '" value="' + esc(f.name || '') + '" required>' +
      '<label class="h-lbl">' + L('How often', 'Hvor ofte') + '<select name="every"><option value="1w"' + (f.every === '1w' ? ' selected' : '') + '>' + L('Every week', 'Hver uke') + '</option><option value="2w"' + (f.every === '2w' ? ' selected' : '') + '>' + L('Every 2 weeks', 'Annenhver uke') + '</option><option value="1m"' + (f.every === '1m' ? ' selected' : '') + '>' + L('Once a month', 'En gang i måneden') + '</option></select></label>' +
      '<label class="h-lbl">' + L('On', 'På') + '<select name="day">' + DAYS().map(function (d, i) { return '<option value="' + i + '"' + (+f.day === i ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></label>' +
      '<label class="h-lbl">' + L('Who', 'Hvem') + '<select name="who"><option value="rotate"' + (f.who === 'rotate' ? ' selected' : '') + '>' + L('Take turns', 'Bytt på') + '</option><option value="them"' + (f.who === 'them' ? ' selected' : '') + '>' + L('Always me', 'Alltid meg') + '</option><option value="me"' + (f.who === 'me' ? ' selected' : '') + '>' + L('Always ', 'Alltid ') + esc(o) + '</option></select></label>' +
      (r ? '<button type="button" class="h-link danger" data-choredel="' + esc(r.id) + '">' + L('Delete this chore', 'Slett oppgaven') + '</button>' : ''), function (fm) {
      if (!fm.name.value.trim()) { fm.name.focus(); return false; }
      put('chore', r ? r.id : 'h' + uid(), { name: fm.name.value.trim(), every: fm.every.value, day: +fm.day.value, who: fm.who.value, start: (r && r.f.start) || today() });
    });
  }
  function projSheet(id) {
    var r = find('proj', id); if (!r) return;
    var bg = sheet('<h2>' + esc(r.f.name) + '</h2><ul class="h-list" data-tasks></ul><div class="h-add"><input name="nt" maxlength="120" placeholder="' + L('Add a task …', 'Legg til en oppgave …') + '"><button type="button" data-taskadd aria-label="' + L('Add', 'Legg til') + '"><i class="bi bi-plus-lg"></i></button></div>', function () {});
    bg.querySelector('[type=submit]').textContent = L('Done', 'Ferdig'); var cx = bg.querySelector('[data-x]'); if (cx) cx.remove();
    var ul = bg.querySelector('[data-tasks]'), paint = function () { var x = find('proj', id); ul.innerHTML = ((x && x.f.tasks) || []).map(function (q, i) { return '<li class="' + (q.done ? 'done' : '') + '"><button type="button" class="h-tick" data-tk="' + i + '"><i class="bi bi-' + (q.done ? 'check-circle-fill' : 'circle') + '"></i><span>' + esc(q.t) + (q.due ? '<small>' + esc(fdate(q.due, { day: 'numeric', month: 'short' })) + '</small>' : '') + '</span></button></li>'; }).join('') || '<li><span class="h-row"><span>' + L('No tasks yet.', 'Ingen oppgaver ennå.') + '</span></span></li>'; };
    var save = function (fn) { var x = find('proj', id); if (!x) return; var tk = (x.f.tasks || []).map(function (q) { return Object.assign({}, q); }); fn(tk); put('proj', id, Object.assign({}, x.f, { tasks: tk })).then(paint); paint(); };
    paint();
    bg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tk]'); if (b) { save(function (tk) { tk[+b.dataset.tk].done = !tk[+b.dataset.tk].done; }); return; }
      if (e.target.closest('[data-taskadd]')) { var i = bg.querySelector('[name=nt]'), v = i.value.trim(); if (!v) return; i.value = ''; save(function (tk) { tk.push({ id: 'h' + uid(), t: v, done: false }); }); }
    });
  }
  function docSheet(id) {
    var r = find('doc', id); if (!r) return;
    var bg = sheet('<h2>' + esc(r.f.name) + '</h2><div data-files>' + ((r.f.files || []).length ? '' : '<p class="h-small">' + L('The file is on its way – try again in a minute.', 'Filen er på vei – prøv igjen om et minutt.') + '</p>') + '</div>', function () {});
    bg.querySelector('[type=submit]').textContent = L('Close', 'Lukk'); var cx = bg.querySelector('[data-x]'); if (cx) cx.remove();
    var box = bg.querySelector('[data-files]');
    (r.f.files || []).forEach(function (f) {
      var row = document.createElement('div'); row.className = 'h-file'; row.innerHTML = '<span><i class="bi bi-hourglass-split"></i> ' + esc(f.name) + '</span>'; box.appendChild(row);
      fetch('/cmd/api/sfile?id=' + f.fid, { credentials: 'same-origin', cache: 'no-store' }).then(function (res) { if (!res.ok) throw new Error(res.status); return res.arrayBuffer(); })
        .then(function (buf) { return SC.decryptBytes(K, buf); }).then(function (pt) {
          var url = URL.createObjectURL(new Blob([pt], { type: f.type || 'application/octet-stream' }));
          row.innerHTML = (/^image\//.test(f.type) ? '<img src="' + url + '" alt="">' : '') + '<a class="h-btn" href="' + url + '" target="_blank" rel="noopener" download="' + esc(f.name) + '"><i class="bi bi-box-arrow-up-right"></i> ' + L('Open ', 'Åpne ') + esc(f.name) + '</a>';
        }, function () { row.innerHTML = '<span class="h-err">' + L('Couldn’t open ', 'Kunne ikke åpne ') + esc(f.name) + '</span>'; });
    });
  }
  function profileSheet() {
    var me0 = mine(), bd = String(me0.bday || '').match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/), bdv = bd && bd[3] ? bd[3] + '-' + pad(+bd[2]) + '-' + pad(+bd[1]) : '';
    var bg = sheet('<h2>' + L('About you', 'Om deg') + '</h2><p class="h-small">' + esc(owner()) + L(' gets you as a person in their dashboard – your birthday and number are optional.', ' får deg som person i dashbordet sitt – bursdag og nummer er valgfritt.') + '</p>' +
      '<div class="h-me">' + face(me0.look, 'big') + '<div><button type="button" class="h-btn sm" data-avatar>' + (me0.look ? L('Change your avatar', 'Endre avataren') : L('Make your avatar', 'Lag avataren din')) + '</button></div></div>' +
      '<label class="h-lbl">' + L('Your name', 'Navnet ditt') + '<input name="nm" maxlength="30" value="' + esc(me0.name || info().partner || '') + '" required></label>' +
      '<label class="h-lbl">' + L('Birthday', 'Bursdag') + '<input name="bd" type="date" value="' + esc(bdv) + '"></label>' +
      '<label class="h-lbl">' + L('Phone', 'Telefon') + '<input name="ph" type="tel" inputmode="tel" maxlength="20" placeholder="+47" value="' + esc(me0.phone || '') + '"></label>', function (f) {
      var nm = f.nm.value.trim(); if (!nm) { f.nm.focus(); return false; }
      var o = Object.assign({}, mine(), { name: nm }), bv = f.bd.value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(bv)) o.bday = +bv.slice(8, 10) + '.' + +bv.slice(5, 7) + '.' + bv.slice(0, 4); else delete o.bday;
      var ph = f.ph.value.trim(); if (ph) o.phone = ph; else delete o.phone;
      wj('home.profiled', true); put('pme', 'me', o); toast('<i class="bi bi-check2"></i> ' + L('Saved – ', 'Lagret – ') + esc(owner()) + L(' sees it now', ' ser det nå'));
    });
    bg.querySelector('[data-x]').addEventListener('click', function () { wj('home.profiled', true); });
  }
  function recipeSheet(id) {
    var r = find('recipe', id); if (!r) return; var f = r.f, ing = String(f.ingr || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var bg = sheet('<h2>' + esc(f.title) + '</h2>' + (ing.length ? '<h3 class="h-h">' + L('Ingredients', 'Ingredienser') + '</h3><ul class="h-plain">' + ing.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><button type="button" class="h-btn ghost" data-recshop="' + esc(id) + '"><i class="bi bi-cart-plus"></i> ' + L('Put them on the shopping list', 'Legg dem på handlelisten') + '</button>' : '') +
      (f.steps ? '<h3 class="h-h">' + L('Steps', 'Fremgangsmåte') + '</h3><p class="h-pre h-small">' + esc(f.steps) + '</p>' : '') + (f.link ? '<a class="h-link" href="' + esc(f.link) + '" target="_blank" rel="noopener">' + L('Open the recipe page', 'Åpne oppskriftssiden') + '</a>' : ''), function () {});
    bg.querySelector('[type=submit]').textContent = L('Close', 'Lukk'); var cx = bg.querySelector('[data-x]'); if (cx) cx.remove();
  }
  function settingsSheet() {
    var w = info().what || {}, rem = !!rj('home.key', null), o = owner();
    var NAMES = [['shop', L('Shopping list', 'Handleliste'), 'Handleliste'], ['meals', L('Dinner plan', 'Middagsplan')], ['chores', L('Chores', 'Husarbeid')], ['money', L('Money between you', 'Penger mellom dere')], ['bills', L('Home bills', 'Regninger')], ['cal', L('Calendar events', 'Kalenderhendelser')], ['trips', L('Trips', 'Turer')], ['plants', L('Plants', 'Planter')], ['move', L('Moving checklist', 'Flyttesjekkliste')], ['notes', L('Home notes', 'Hjemmenotater')]];
    var bg = sheet('<h2>' + L('Settings', 'Innstillinger') + '</h2>' + (preview ? '<div class="h-prevbar"><i class="bi bi-eye"></i> ' + L('Their settings, as they see them – read-only', 'Innstillingene deres slik de ser dem – kun visning') + '</div>' : '') +
      '<div class="h-me">' + face(mine().look, 'big') + '<div><b>' + esc(myName()) + '</b><button type="button" class="h-btn sm" data-avatar>' + (mine().look ? L('Change your avatar', 'Endre avataren') : L('Make your avatar', 'Lag avataren din')) + '</button></div></div>' +
      '<label class="h-lbl">' + L('Your name', 'Navnet ditt') + '<input name="nm" maxlength="30" value="' + esc(mine().name || info().partner || '') + '"></label>' +
      '<button type="button" class="h-btn ghost" data-profile><i class="bi bi-person-vcard"></i> ' + L('Birthday and phone', 'Bursdag og telefon') + '</button>' +
      '<label class="h-lbl">' + L('Language', 'Språk') + '<select name="lang"><option value="en"' + (nb ? '' : ' selected') + '>English</option><option value="nb"' + (nb ? ' selected' : '') + '>Norsk</option></select></label>' +
      '<label class="h-check"><input type="checkbox" name="rem"' + (rem ? ' checked' : '') + '> ' + L('Keep me unlocked on this phone', 'Hold meg innlogget på denne telefonen') + '</label>' +
      '<div class="h-det-box"><b><i class="bi bi-person-lock"></i> ' + L('Your own features', 'Dine egne funksjoner') + '</b><p class="h-small">' + L('Only you see these – locked with your own key. ', 'Bare du ser disse – låst med din egen nøkkel. ') + esc(o) + L(' can’t open them.', ' kan ikke åpne dem.') + '</p>' +
        [['cal', L('My calendar', 'Min kalender')], ['money', L('My money', 'Min økonomi')], ['todos', L('My to-dos', 'Mine gjøremål')]].map(function (x) { return '<label class="h-check"><input type="checkbox" name="my_' + x[0] + '"' + (My.on(x[0]) ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join('') +
        (My.any() ? '<button type="button" class="h-link" data-mydl>' + L('Download my own data', 'Last ned mine egne data') + '</button>' : '') + '</div>' +
      '<details class="h-det"><summary>' + L('Change passcode', 'Endre kode') + '</summary><input type="password" name="pa" autocomplete="new-password" placeholder="' + L('New passcode', 'Ny kode') + '"><input type="password" name="pb" autocomplete="new-password" placeholder="' + L('Once more', 'En gang til') + '"><p class="h-err" data-err></p></details>' +
      '<div class="h-det-box"><b>' + L('What ', 'Hva ') + esc(o) + L(' shares with you', ' deler med deg') + '</b><p class="h-small">' + NAMES.filter(function (n) { return w[n[0]] !== false; }).map(function (n) { return n[1]; }).join(' · ') + '</p><p class="h-small">' + esc(o) + L(' chooses this. Nothing else from their dashboard is shared.', ' bestemmer dette. Ingenting annet fra dashbordet deres deles.') + '</p></div>' +
      '<p class="h-small">' + L('Tip: Share → Add to Home Screen to open this like an app.', 'Tips: Del → Legg til på Hjem-skjerm for å åpne dette som en app.') + '</p>' +
      '<div class="h-two"><button type="button" class="h-btn ghost" data-lock>' + L('Lock now', 'Lås nå') + '</button><button type="button" class="h-btn ghost danger" data-forget>' + L('Forget this phone', 'Glem denne telefonen') + '</button></div>', function (f) {
      var er = f.querySelector('[data-err]');
      if (preview) { toast('<i class="bi bi-eye"></i> ' + L('Preview – nothing changes here', 'Forhåndsvisning – ingenting endres her')); return; }
      if (f.pa.value || f.pb.value) {
        if (f.pa.value.length < 6) { er.textContent = L('At least 6 characters.', 'Minst 6 tegn.'); f.closest('form').querySelector('details').open = true; return false; }
        if (f.pa.value !== f.pb.value) { er.textContent = L('The two don’t match.', 'De to er ikke like.'); f.closest('form').querySelector('details').open = true; return false; }
        var np = f.pa.value; PASS = np; SC.wrap(np, K).then(function (wv) { return SC.api('share?wrap', { method: 'PUT', body: wv }); }).then(function () { return My.rewrap(np); }).then(function () { toast('<i class="bi bi-check2"></i> ' + L('New passcode saved', 'Ny kode er lagret')); }, function () { toast(L('Couldn’t save the passcode', 'Kunne ikke lagre koden')); });
      }
      if (f.rem.checked) wj('home.key', K); else wj('home.key', null);
      My.remember(f.rem.checked);
      var wantMy = {}; ['cal', 'money', 'todos'].forEach(function (k) { wantMy[k] = !!(f['my_' + k] && f['my_' + k].checked); }); My.setFeatures(wantMy);
      var nm = f.nm.value.trim(); if (nm && nm !== (mine().name || '')) put('pme', 'me', Object.assign({}, mine(), { name: nm }));
      if ((f.lang.value === 'nb') !== nb) { try { localStorage.setItem('home.lang', f.lang.value); } catch (x) {} setTimeout(function () { location.reload(); }, 150); }
    });
    bg.querySelector('[type=submit]').textContent = L('Save', 'Lagre');
    if (preview) bg.querySelectorAll('input, select, details, [data-lock], [data-forget], [data-avatar], [data-profile], [data-mydl]').forEach(function (x) { if (x.tagName === 'DETAILS') x.style.display = 'none'; else x.disabled = true; });
  }
  var backToProfile = false;
  function avatarEdit() {
    var A = window.Avatar; if (!A || !A.editor) { toast(L('Couldn’t open the avatar maker', 'Kunne ikke åpne avatarmakeren')); return; }
    var start = mine().look || (A.personLook ? A.personLook({ id: 'p-' + (info().partner || 'x'), name: myName() }) : {});
    A.editor(myName(), start, function (lk) { put('pme', 'me', Object.assign({}, mine(), { name: mine().name || info().partner || '', look: lk })); if (backToProfile) { backToProfile = false; setTimeout(profileSheet, 260); } toast('<i class="bi bi-person-bounding-box"></i> ' + L('Avatar saved – ', 'Avataren er lagret – ') + esc(owner()) + L(' sees it too', ' ser den også')); });
  }
  /* the avatar maker asks for a dialog – a small sheet here */
  window.HomeLife = { dialog: function (html, onClick) {
    var bg = document.createElement('div'); bg.className = 'h-sheetbg'; bg.innerHTML = '<div class="h-sheet h-avsheet">' + html + '</div>'; document.body.appendChild(bg);
    requestAnimationFrame(function () { bg.classList.add('open'); });
    var close = function () { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 200); };
    bg.addEventListener('click', function (e) { if (e.target === bg) { close(); return; } onClick(e, close); });
    return { el: bg, close: close };
  } };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var d = b.dataset;
    if (d.avatar != null) { e.preventDefault(); backToProfile = !!(b.closest('.h-sheet') && b.closest('.h-sheet').querySelector('[name=bd]')); var open = document.querySelector('.h-sheetbg'); if (open && !open.querySelector('.ave')) { open.remove(); } avatarEdit(); return; }
    if (d.lock != null) { wj('home.key', null); wj('home.pkey', null); location.reload(); return; }
    if (d.forget != null) { ['home.key', 'home.queue', 'home.tab', 'home.pkey', 'home.myf', 'home.profiled'].forEach(function (k) { wj(k, null); }); location.reload(); return; }
    if (d.mydl != null) { My.download(); return; }
    if (d.recshop) { var rr = find('recipe', d.recshop); if (rr) { var have = {}; list('shop').forEach(function (x) { if (!x.f.done) have[String(x.f.text).toLowerCase()] = 1; }); var n = 0; String(rr.f.ingr || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (x) { if (!have[x.toLowerCase()]) { put('shop', 'h' + uid(), { text: x.slice(0, 120), done: false }); n++; } }); toast('<i class="bi bi-cart-plus"></i> ' + n + L(' on the shopping list', ' på handlelisten')); } var s9 = b.closest('.h-sheetbg'); if (s9) s9.remove(); return; }
    if (d.profile != null) { var s0 = b.closest('.h-sheetbg'); if (s0) s0.remove(); profileSheet(); return; }
    if (d.choredel && find('chore', d.choredel)) { var cf = find('chore', d.choredel).f, cid = d.choredel; put('chore', cid, null, true); var s3 = b.closest('.h-sheetbg'); if (s3) s3.remove(); toast('<i class="bi bi-trash3"></i> ' + esc(cf.name), function () { put('chore', cid, cf); }); return; }
    if (d.mealdel) { put('meal', d.mealdel, null, true); var s1 = b.closest('.h-sheetbg'); if (s1) s1.remove(); return; }
    if (d.notedel && find('note', d.notedel)) { var kf = find('note', d.notedel).f, nid = d.notedel; put('note', nid, null, true); var s2 = b.closest('.h-sheetbg'); if (s2) s2.remove(); toast('<i class="bi bi-trash3"></i> ' + L('Note deleted', 'Notatet er slettet'), function () { put('note', nid, kf); }); }
  });
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
    if (d.tab) { tab = d.tab; wj('home.tab', tab); draw(); scrollTo(0, 0); return; }
    if (d.menu != null) { settingsSheet(); return; }
    if (d.meal) { mealSheet(d.meal); return; }
    if (d.trip) { tripSheet(d.trip); return; }
    if (d.note) { noteSheet(d.note); return; }
    if (d.noteadd != null) { noteSheet(null); return; }
    if (d.choreedit) { choreSheet(d.choreedit); return; }
    if (d.choreadd != null) { choreSheet(null); return; }
    if (d.chlog != null) { showLog = !showLog; draw(); return; }
    if (d.proj) { projSheet(d.proj); return; }
    if (d.recipe) { recipeSheet(d.recipe); return; }
    if (d.pantry && (r = find('pantry', d.pantry))) {
      if (r.f.state === 'low') { put('pantry', r.id, { name: r.f.name, state: 'ok' }); return; }
      put('pantry', r.id, { name: r.f.name, state: 'low' });
      if (!list('shop').some(function (x) { return !x.f.done && String(x.f.text).toLowerCase() === String(r.f.name).toLowerCase(); })) put('shop', 'h' + uid(), { text: r.f.name, done: false });
      toast('<i class="bi bi-cart-plus"></i> ' + esc(r.f.name) + L(' is on the shopping list', ' er på handlelisten')); return; }
    if (d.doc) { docSheet(d.doc); return; }
    if (d.shop && (r = find('shop', d.shop))) { put('shop', r.id, { text: r.f.text, done: !r.f.done }); return; }
    if (d.shopdel && (r = find('shop', d.shopdel))) { var keep = r.f; put('shop', r.id, null, true); toast('<i class="bi bi-trash3"></i> ' + esc(keep.text), function () { put('shop', r.id, keep); }); return; }
    if (d.shopclear != null) { var gone = list('shop').filter(function (x) { return x.f.done; }); gone.forEach(function (x) { put('shop', x.id, null, true); }); toast('<i class="bi bi-trash3"></i> ' + gone.length + L(' removed', ' fjernet'), function () { gone.forEach(function (x) { put('shop', x.id, x.f); }); }); return; }
    if (d.chore && (r = find('chore', d.chore))) { var p = period(r.f), k = p.key + '|' + r.id, dn = doneOf(r.id, p); if (dn) put('cdone', k, null, true); else { put('cdone', k, { k: k, who: turn(r.f, p), at: today() }); toast('<i class="bi bi-check2"></i> ' + esc(r.f.name), function () { put('cdone', k, null, true); }); } return; }
    if (d.water && (r = find('plant', d.water))) { var was = r.f; put('plant', r.id, Object.assign({}, r.f, { last: today() })); toast('<i class="bi bi-droplet"></i> ' + L('Watered', 'Vannet'), function () { put('plant', r.id, was); }); return; }
    if (d.mv && (r = find('mv', d.mv))) { put('mv', r.id, { text: r.f.text, done: !r.f.done }); return; }
    if (d.addcost != null) { costSheet(); return; }
    if (d.settle != null) { settleSheet(); return; }
    if (d.moneyall != null) { showAllMoney = !showAllMoney; draw(); return; }
    if (d.addev != null) { evSheet(); return; }
    if (d.earlier != null) { showEarlier = !showEarlier; draw(); return; }
    var del = d.sxdel ? ['sx', d.sxdel] : d.paydel ? ['pay', d.paydel] : d.evdel ? ['ev', d.evdel] : null;
    if (del && (r = find(del[0], del[1]))) { var kf = r.f; put(del[0], r.id, null, true); toast('<i class="bi bi-trash3"></i> ' + L('Removed', 'Fjernet'), function () { put(del[0], r.id, kf); }); }
  });
  /* ================= Their own space: calendar, money, to-dos – only theirs =================
     A random key of their own, locked with their passcode (/cmd/api/pvault?wrap); the data is one encrypted
     blob (/cmd/api/pvault) that only their login can reach. Items carry t (and del) so two phones merge. */
  var My = (function () {
    var PK = null, P = null, rev = -1, saveT = null, loading = null;
    var feats = rj('home.myf', {}) || {};
    function on(k) { return !!feats[k]; }
    function any() { return on('cal') || on('money') || on('todos'); }
    function empty() { return { events: [], exp: [], todos: [], budget: null }; }
    function load() {
      if (!PK) return Promise.resolve(null);
      return loading = SC.api('pvault').then(function (v) { rev = v.rev || 0; return SC.decrypt(PK, v); }, function (e) { if (e.status === 404) { rev = -1; return empty(); } throw e; })
        .then(function (d) { P = Object.assign(empty(), d || {}); if (P.features) { feats = P.features; wj('home.myf', feats); } draw(); return P; });
    }
    function merge(a, b) {
      var o = empty(); ['events', 'exp', 'todos'].forEach(function (k) { var m = {}; (a[k] || []).concat(b[k] || []).forEach(function (x) { if (x && x.id && (!m[x.id] || (x.t || 0) > (m[x.id].t || 0))) m[x.id] = x; }); o[k] = Object.keys(m).map(function (id) { return m[id]; }); });
      o.budget = (a.budget && b.budget) ? ((a.budget.t || 0) >= (b.budget.t || 0) ? a.budget : b.budget) : (a.budget || b.budget);
      o.features = (a.ft || 0) >= (b.ft || 0) ? a.features : b.features; o.ft = Math.max(a.ft || 0, b.ft || 0);
      return o;
    }
    function save() {
      clearTimeout(saveT); saveT = setTimeout(function () {
        if (!PK || !P) return;
        SC.encrypt(PK, P).then(function (e) {
          return fetch('/cmd/api/pvault', { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'X-Base-Rev': String(rev) }, body: JSON.stringify({ v: 1, rev: rev + 1, iv: e.iv, ct: e.ct }) });
        }).then(function (r) {
          if (r.status === 409) return r.json().then(function (cur) { rev = cur.rev || 0; return SC.decrypt(PK, cur).then(function (d) { P = merge(P, d || {}); save(); draw(); }); });
          if (r.ok) rev = rev + 1; else toast('<i class="bi bi-cloud-slash"></i> ' + L('Couldn’t save – trying again soon', 'Kunne ikke lagre – prøver igjen snart'));
        }, function () { setTimeout(save, 8000); });
      }, 700);
    }
    function ensureKey() {
      if (PK) return Promise.resolve(PK);
      return SC.api('pvault?wrap').then(function (w) {
        if (!PASS) throw new Error('pass');
        return SC.unwrap(PASS, w).then(function (k) { PK = k; return k; });
      }, function (e) {
        if (e.status !== 404) throw e; if (!PASS) throw new Error('pass');
        var k = SC.genKey(); return SC.wrap(PASS, k).then(function (w) { return SC.api('pvault?wrap', { method: 'PUT', body: w }); }).then(function () { PK = k; P = empty(); rev = -1; return k; });
      });
    }
    function askPassThen(fn) {
      sheet('<h2>' + L('Your passcode', 'Koden din') + '</h2><p class="h-small">' + L('Type it once to unlock your own space on this phone.', 'Skriv den én gang for å låse opp ditt eget område på denne telefonen.') + '</p><input type="password" name="pp" autocomplete="current-password" required><p class="h-err" data-err></p>', function (f) {
        var pw = f.pp.value; if (!pw) return false; PASS = pw;
        ensureKey().then(function () { if (rj('home.key', null)) wj('home.pkey', PK); return load(); }).then(fn, function () { PASS = null; toast(L('Wrong passcode', 'Feil kode')); });
      });
    }
    function setFeatures(want) {
      var was = JSON.stringify(feats); if (JSON.stringify(want) === was) return;
      feats = want; wj('home.myf', feats);
      if (!any()) { if (P) { P.features = feats; P.ft = Date.now(); save(); } draw(); return; }
      var go = function () { P = P || empty(); P.features = feats; P.ft = Date.now(); save(); tab = 'me'; draw(); };
      ensureKey().then(function () { if (rj('home.key', null)) wj('home.pkey', PK); return P ? P : load(); }).then(go, function () { askPassThen(go); });
    }
    function unlock(pw, rem) { PASS = pw; return SC.api('pvault?wrap').then(function (w) { return SC.unwrap(pw, w); }).then(function (k) { PK = k; if (rem) wj('home.pkey', k); return load(); }, function () { return null; }); }
    function remembered() { var k = rj('home.pkey', null); if (k) { PK = k; load().catch(function () {}); } }
    function remember(on) { if (on && PK) wj('home.pkey', PK); else if (!on) wj('home.pkey', null); }
    function rewrap(np) { if (!PK) return Promise.resolve(); return SC.wrap(np, PK).then(function (w) { return SC.api('pvault?wrap', { method: 'PUT', body: w }); }); }
    function live(k) { return ((P && P[k]) || []).filter(function (x) { return !x.del; }); }
    function upd(k, item) { P = P || empty(); item.t = Date.now(); var l = P[k], i = l.findIndex(function (x) { return x.id === item.id; }); if (i > -1) l[i] = item; else l.push(item); save(); draw(); }
    function del(k, id) { var it = (P[k] || []).filter(function (x) { return x.id === id; })[0]; if (!it) return; var keep = Object.assign({}, it); upd(k, { id: id, del: 1 }); toast('<i class="bi bi-trash3"></i> ' + L('Deleted', 'Slettet'), function () { delete keep.del; upd(k, keep); }); }
    var CATS = [['food', L('Food', 'Mat')], ['eating', L('Eating out', 'Spise ute')], ['transport', L('Transport', 'Transport')], ['shopping', L('Shopping', 'Shopping')], ['fun', L('Fun', 'Moro')], ['health', L('Health', 'Helse')], ['bills', L('Bills', 'Regninger')], ['other', L('Other', 'Annet')]];
    function catName(c) { return (CATS.filter(function (x) { return x[0] === c; })[0] || CATS[CATS.length - 1])[1]; }
    function view() {
      if (!PK || !P) return '<div class="h-screen" style="margin-top:6vh"><i class="bi bi-person-lock h-big"></i><p>' + L('Your own space is locked on this phone.', 'Ditt eget område er låst på denne telefonen.') + '</p><button type="button" class="h-btn" data-myunlock>' + L('Unlock', 'Lås opp') + '</button></div>';
      var out = '<p class="h-sum"><i class="bi bi-lock"></i> ' + L('Only you see this – ', 'Bare du ser dette – ') + esc(owner()) + L(' can’t.', ' kan ikke.') + '</p>', tk = today();
      if (on('cal')) {
        var ev = live('events').filter(function (e) { return (e.date || '') >= tk; }).sort(function (a, b) { return (a.date + (a.start || '')) < (b.date + (b.start || '')) ? -1 : 1; });
        out += '<h2 class="h-h">' + L('My calendar', 'Min kalender') + '</h2><button type="button" class="h-btn ghost wide" data-myev><i class="bi bi-plus-lg"></i> ' + L('Add an event', 'Legg til en hendelse') + '</button>' +
          (ev.length ? '<ul class="h-list">' + ev.slice(0, 30).map(function (e) { return '<li><span class="h-row"><span>' + esc(e.title) + '<small>' + esc(fdate(e.date) + (e.allDay ? '' : ' · ' + (e.start || '') + (e.stop ? '–' + e.stop : '')) + (e.loc ? ' · ' + e.loc : '')) + '</small></span></span><button type="button" class="h-x" data-myevdel="' + esc(e.id) + '" aria-label="' + L('Delete', 'Slett') + '"><i class="bi bi-x-lg"></i></button></li>'; }).join('') + '</ul>' : '<p class="h-sum">' + L('Nothing coming up.', 'Ingenting som kommer.') + '</p>');
      }
      if (on('money')) {
        var ym = tk.slice(0, 7), mx = live('exp').filter(function (x) { return (x.date || '').slice(0, 7) === ym; }), tot = mx.reduce(function (a, x) { return a + (+x.amount || 0); }, 0), bud = P.budget && +P.budget.v || 0;
        var by = {}; mx.forEach(function (x) { by[x.cat] = (by[x.cat] || 0) + (+x.amount || 0); }); var cs = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }), mxv = cs.length ? by[cs[0]] : 1;
        out += '<h2 class="h-h">' + L('My money', 'Min økonomi') + '</h2><div class="h-bal ' + (bud && tot > bud ? 'owe' : 'even') + '"><small>' + L('Spent this month', 'Brukt denne måneden') + (bud ? ' · ' + L('budget ', 'budsjett ') + esc(kr(bud)) : '') + '</small><b>' + esc(kr(tot)) + '</b><button type="button" class="h-btn sm" data-myexp>' + L('Add', 'Legg til') + '</button></div>' +
          (bud ? '<div class="h-bar"><i style="width:' + Math.min(100, Math.round(tot / bud * 100)) + '%"></i></div>' : '') +
          (cs.length ? '<ul class="h-list">' + cs.map(function (c) { return '<li><span class="h-row"><span>' + esc(catName(c)) + '<span class="h-bar sm"><i style="width:' + Math.round(by[c] / mxv * 100) + '%"></i></span></span><b>' + esc(kr(by[c])) + '</b></span></li>'; }).join('') + '</ul>' : '') +
          '<button type="button" class="h-link" data-mybud>' + (bud ? L('Change the monthly budget', 'Endre månedsbudsjettet') : L('Set a monthly budget', 'Sett et månedsbudsjett')) + '</button>' +
          (mx.length ? '<ul class="h-list">' + mx.sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 20).map(function (x) { return '<li><span class="h-row"><span>' + esc(x.note || catName(x.cat)) + '<small>' + esc(fdate(x.date) + ' · ' + catName(x.cat)) + '</small></span><b>' + esc(kr(x.amount)) + '</b></span><button type="button" class="h-x" data-myexpdel="' + esc(x.id) + '" aria-label="' + L('Delete', 'Slett') + '"><i class="bi bi-x-lg"></i></button></li>'; }).join('') + '</ul>' : '');
      }
      if (on('todos')) {
        var td = live('todos').sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.c || 0) - (b.c || 0); });
        out += '<h2 class="h-h">' + L('My to-dos', 'Mine gjøremål') + '</h2><form class="h-add" data-mytodo><input name="mytodo" placeholder="' + L('Add a to-do …', 'Legg til et gjøremål …') + '" autocomplete="off"><button type="submit" aria-label="' + L('Add', 'Legg til') + '"><i class="bi bi-plus-lg"></i></button></form>' +
          (td.length ? '<ul class="h-list">' + td.map(function (x) { return '<li class="' + (x.done ? 'done' : '') + '"><button type="button" class="h-tick" data-mytd="' + esc(x.id) + '"><i class="bi bi-' + (x.done ? 'check-circle-fill' : 'circle') + '"></i><span>' + esc(x.text) + '</span></button><button type="button" class="h-x" data-mytddel="' + esc(x.id) + '" aria-label="' + L('Delete', 'Slett') + '"><i class="bi bi-x-lg"></i></button></li>'; }).join('') + '</ul>' : '');
      }
      return out;
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; var d = b.dataset;
      if (d.myunlock != null) { askPassThen(function () { draw(); }); return; }
      if (d.myev != null) { sheet('<h2>' + L('New event', 'Ny hendelse') + '</h2><input name="title" maxlength="120" placeholder="' + L('Title', 'Tittel') + '" required><input name="date" type="date" value="' + today() + '" required><label class="h-check"><input type="checkbox" name="all"> ' + L('All day', 'Hele dagen') + '</label><div class="h-two"><input name="start" type="time" value="18:00"><input name="stop" type="time" value="19:00"></div><input name="loc" maxlength="160" placeholder="' + L('Where (optional)', 'Hvor (valgfritt)') + '">', function (f) {
          if (!f.title.value.trim()) { f.title.focus(); return false; } var it = { id: 'm' + uid(), title: f.title.value.trim(), date: f.date.value || today(), allDay: f.all.checked, loc: f.loc.value.trim() }; if (!it.allDay) { it.start = f.start.value; it.stop = f.stop.value; } upd('events', it); }); return; }
      if (d.myevdel) { del('events', d.myevdel); return; }
      if (d.myexp != null) { sheet('<h2>' + L('Spent', 'Brukt') + '</h2><input name="amt" inputmode="decimal" placeholder="' + L('Amount, kr', 'Beløp, kr') + '" required><label class="h-lbl">' + L('Category', 'Kategori') + '<select name="cat">' + CATS.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join('') + '</select></label><input name="note" maxlength="80" placeholder="' + L('What was it? (optional)', 'Hva var det? (valgfritt)') + '"><input name="date" type="date" value="' + today() + '">', function (f) {
          var a = num(f.amt.value); if (!(a > 0)) { f.amt.focus(); return false; } upd('exp', { id: 'm' + uid(), amount: a, cat: f.cat.value, note: f.note.value.trim(), date: f.date.value || today() }); }); return; }
      if (d.myexpdel) { del('exp', d.myexpdel); return; }
      if (d.mybud != null) { sheet('<h2>' + L('Monthly budget', 'Månedsbudsjett') + '</h2><input name="b" inputmode="decimal" placeholder="' + L('e.g. 8 000', 'f.eks. 8 000') + '" value="' + esc(P && P.budget && P.budget.v || '') + '">', function (f) { var v = num(f.b.value); P.budget = { v: v > 0 ? v : 0, t: Date.now() }; save(); draw(); }); return; }
      if (d.mytd) { var x = live('todos').filter(function (q) { return q.id === d.mytd; })[0]; if (x) upd('todos', Object.assign({}, x, { done: !x.done })); return; }
      if (d.mytddel) { del('todos', d.mytddel); return; }
    });
    document.addEventListener('submit', function (e) { var f = e.target.closest('[data-mytodo]'); if (!f) return; e.preventDefault(); var v = f.mytodo.value.trim(); if (!v) return; f.mytodo.value = ''; upd('todos', { id: 'm' + uid(), text: v.slice(0, 160), done: false, c: Date.now() }); });
    function download() {
      var blob = new Blob([JSON.stringify(P || empty(), null, 2)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'my-own-data-' + today() + '.json'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500);
    }
    return { on: on, any: any, view: view, setFeatures: setFeatures, unlock: unlock, remembered: remembered, remember: remember, rewrap: rewrap, download: download };
  })();
  boot();
})();
