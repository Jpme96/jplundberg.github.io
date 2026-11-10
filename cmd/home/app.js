/* The shared app (/cmd/home/) for the person JP shares his home with. It only knows the shared box:
   shopping list, chores (+ plants and the moving checklist), money between the two of you, and shared events.
   The key comes once from the QR code on the owner's phone and is kept locked with this person's own passcode. */
(function () {
  "use strict";
  /* no pinch- or double-tap zoom on the phone: it is an app, and the text size is set in Settings */
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault(); }, { passive: false });
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
  var refusedAt = 0;
  function toast(h, undo) {
    if (Date.now() - refusedAt < 600 && h.indexOf('bi-lock') < 0) return;          /* a refused change keeps its own message */
    var t = document.getElementById('toast'); t._undo = undo || null;
    t.innerHTML = '<span>' + h + '</span>' + (undo ? '<button type="button" data-undo>' + L('Undo', 'Angre') + '</button>' : '');
    t.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('show'); t._undo = null; }, undo ? 5000 : 2400);
  }
  document.getElementById('toast').addEventListener('click', function (e) { var t = this; if (e.target.closest('[data-undo]') && t._undo) { var u = t._undo; t._undo = null; t.classList.remove('show'); u(); } });

  /* ---------- the key ---------- */
  var K = null, recs = {}, rids = {}, tab = (function (t) { return t === 'notes' || t === 'chat' ? 'today' : t; })(rj('home.tab', 'today')), me = 'p', PASS = null;
  /* preview: the owner opens this inside Settings → Shared space to see what the other one sees – read-only */
  var preview = (function () { var m = location.hash.match(/^#preview&k=([A-Za-z0-9_-]{43})/); if (!m) return null; history.replaceState(null, '', location.pathname); return m[1]; })();
  if (preview) { document.documentElement.classList.add('h-preview'); tab = 'today'; }
  var pending = preview ? null : (function () { var m = location.hash.match(/[#&]k=([A-Za-z0-9_-]{43})/); if (m) { try { sessionStorage.setItem('home.newkey', m[1]); } catch (e) {} history.replaceState(null, '', location.pathname); return m[1]; } try { return sessionStorage.getItem('home.newkey'); } catch (e) { return null; } })();
  function screen(h) { lastHtml = ''; if (window.__hnav) window.__hnav.hidden = true; if (window.HomeChat && HomeChat.hideBubble) HomeChat.hideBubble(); chatOn = false; app.innerHTML = '<div class="h-screen">' + h + '</div>'; var f = app.querySelector('input'); if (f && matchMedia('(hover: hover)').matches) f.focus(); }
  function boot() {
    if (preview) { K = preview; start(); return; }
    SC.api('share').then(function (j) {
      if (!j.partner) { screen('<i class="bi bi-house-heart h-big"></i><h1>' + L('This is the shared app', 'Dette er den delte appen') + '</h1><p>' + L('It’s for the person you share your home with. Your own dashboard is here:', 'Den er for den du deler hjemmet med. Ditt eget dashbord er her:') + '</p><a class="h-btn" href="/cmd/">' + L('Open your dashboard', 'Åpne dashbordet ditt') + '</a>'); return; }
      if (pending) return setPass(pending);
      if (j.paused && !rj('home.key', null)) { pausedScreen(); var u = app.querySelector('[data-pausedme]'); if (!u) app.querySelector('.h-screen').insertAdjacentHTML('beforeend', '<button class="h-btn ghost" type="button" data-unlockown>' + L('Unlock your own features', 'Lås opp dine egne funksjoner') + '</button>'); return; }
      var rem = rj('home.key', null); if (rem) { K = rem; My.remembered(); return start(); }
      SC.api('share?wrap').then(function (w) { askPass(w); }, function (e) {
        if (e.status === 404) screen('<i class="bi bi-qr-code-scan h-big"></i><h1>' + L('Almost there', 'Nesten klar') + '</h1><p>' + L('Open the Camera app and scan the code on the other phone (Settings → Shared space → Show the code).', 'Åpne Kamera-appen og skann koden på den andre telefonen (Innstillinger → Delt hjem → Vis koden).') + '</p><form class="h-form" data-paste><input name="link" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + L('…or paste the invite link here', '…eller lim inn invitasjonslenken her') + '"><p class="h-err" data-err></p><button class="h-btn" type="submit">' + L('Continue', 'Fortsett') + '</button></form>' +
          '<p class="h-small">' + L('Scan the code with this phone’s Camera after you’ve logged in here. If it still asks, copy the invite link on the other phone and paste it above.', 'Skann koden med Kamera på denne telefonen etter at du har logget inn her. Spør den fortsatt, kopier invitasjonslenken på den andre telefonen og lim den inn over.') + '</p>');
        var pf = app.querySelector('[data-paste]'); if (pf) pf.onsubmit = function (ev) { ev.preventDefault(); var m = String(pf.link.value).match(/[#&]k=([A-Za-z0-9_-]{43})/) || String(pf.link.value).trim().match(/^([A-Za-z0-9_-]{43})$/); if (!m) { pf.querySelector('[data-err]').textContent = L('That isn’t an invite link.', 'Det er ikke en invitasjonslenke.'); return; } pending = m[1]; setPass(m[1]); };
        else offline();
      });
    }, function (e) {
      if (e.status === 403 && e.body && e.body.paused) { pausedScreen(); return; }
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
  var boxRev = null, pulling = false;
  function absorb(srv) {
    var r = (srv && srv.recs) || {}, jobs = []; badKey = 0; if (srv && srv.rev != null) boxRev = srv.rev;
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
  var KIND_AREA = { shop: 'shop', meal: 'meals', pantry: 'pantry', chore: 'chores', cdone: 'chores', room: 'chores', vote: 'meals', sx: 'money', pay: 'money', ev: 'cal', trip: 'trips', plant: 'plants', mv: 'move', note: 'notes', proj: 'house' };
  function canEdit(area) { return ((info().perm || {})[area] || 'edit') !== 'view'; }
  /* tell the owner's phone about what you did – only the kinds they switched on */
  var tellQ = [], tellT = null;
  function tell(c, f, del, isNew) {
    var on = info().onotify || [], me0 = myName(), k = null, txt = '';
    if (del) return;
    if (c === 'sx' && isNew) { k = 'cost'; txt = me0 + L(' added a shared cost: ', ' la til en felles utgift: ') + (f.note || '') + ' ' + kr(f.total); }
    else if (c === 'pay' && isNew) { k = 'settle'; txt = me0 + L(' settled up ', ' gjorde opp ') + kr(f.amount); }
    else if (c === 'ev' && isNew) { k = 'event'; txt = me0 + L(' added an event: ', ' la til en hendelse: ') + f.title; }
    else if (c === 'shop' && isNew) { k = 'shop'; txt = me0 + L(' added ', ' la til ') + f.text + L(' to the list', ' på listen'); }
    else if (c === 'cdone') { var ch = find('chore', String(f.k || '').split('|')[1]); k = 'chore'; txt = me0 + L(' did: ', ' gjorde: ') + (ch ? ch.f.name : ''); }
    else if (c === 'note') { k = 'note'; txt = me0 + L(' wrote a note: ', ' skrev et notat: ') + (f.title || ''); }
    if (!k || on.indexOf(k) < 0) return;
    tellQ.push(txt); clearTimeout(tellT);
    tellT = setTimeout(function () { var b = tellQ.slice(0, 3).join(' · ') + (tellQ.length > 3 ? ' …' : ''); tellQ = []; SC.api('push', { method: 'POST', body: { notify: { title: L('Home', 'Hjem'), body: b, tag: 'p' + Date.now() } } }).catch(function () {}); }, 4000);
  }
  function put(c, id, f, del) {
    if (!preview && KIND_AREA[c] && !canEdit(KIND_AREA[c])) { refusedAt = Date.now(); toast('<i class="bi bi-lock"></i> ' + esc(owner()) + L(' has made this view only', ' har gjort dette kun til visning')); return Promise.resolve(); }
    var isNew = !find(c, id);
    if (!preview) tell(c, f || {}, del, isNew);
    if (preview) { toast('<i class="bi bi-eye"></i> ' + L('Preview – nothing changes here', 'Forhåndsvisning – ingenting endres her')); return Promise.resolve(); }
    var t = Date.now(), key = c + '|' + id, cf = del ? null : SC.clean(c, f);
    if (c === 'pme' && cf) wj('home.pme', cf);
    return (rids[key] ? Promise.resolve(rids[key]) : SC.rid(K, c, id)).then(function (rid) {
      rids[key] = rid; recs[rid] = del ? { t: t, del: 1, c: c, id: id } : { t: t, by: me, c: c, id: id, f: cf }; draw();
      if (del) { queue[rid] = { t: t, del: 1 }; return; }
      return SC.encrypt(K, { c: c, id: id, f: cf }).then(function (e) { queue[rid] = { t: t, iv: e.iv, ct: e.ct }; if (c === 'pme') queue[rid].po = 1; });
    }).then(function () { wj('home.queue', queue); return flush(); }).then(draw);
  }
  var paused = false;
  /* the owner's changes show up within seconds: the live check sees the box move on */
  function livePull(j) { if (!K || stopped || preview || pulling || !j || j.box == null || j.box === boxRev) return; pulling = true; var done = function () { pulling = false; }; var pr = pull(); if (pr && pr.then) pr.then(done, done); else done(); }
  function pull() { if (preview) return SC.api('shared').then(absorb).then(draw, function () {}); return flush().then(function () { return SC.api('shared'); }).then(function (srv) { paused = false; return absorb(srv); }).then(function () { draw(); Push.update(); }, function (e) { if (e && e.status === 403 && e.body && e.body.paused) { paused = true; pausedScreen(); return; } if (e && e.status === 403) stoppedScreen(); }); }
  function pausedScreen() {
    screen('<i class="bi bi-pause-circle h-big"></i><h1>' + L('Sharing is paused', 'Delingen er satt på pause') + '</h1><p>' + esc(owner()) + L(' has paused sharing for now. Nothing is deleted – it comes back here when they turn it on again.', ' har satt delingen på pause. Ingenting er slettet – det kommer tilbake hit når den slås på igjen.') + '</p>' +
      (My.any() ? '<button class="h-btn" type="button" data-pausedme>' + L('Open your own features', 'Åpne dine egne funksjoner') + '</button>' : '') + '<button class="h-btn ghost" type="button" data-reload>' + L('Check again', 'Sjekk igjen') + '</button>');
  }
  var stopped = false;
  /* the app's version – it must match app.js?v= in index.html. When a newer one is published the app reloads itself,
     so a phone that keeps the app open (Home Screen apps do) never stays on old code. */
  var APPV = 49;
  function checkVersion() {
    if (preview) return;
    fetch('/cmd/home/index.html?t=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (h) {
      var m = /app\.js\?v=(\d+)/.exec(h || ''), v = m ? +m[1] : 0, done = '';
      try { done = sessionStorage.getItem('home.reloadedFor') || ''; } catch (e) {}
      if (v > APPV && done !== String(v)) { try { sessionStorage.setItem('home.reloadedFor', String(v)); } catch (e) {} location.replace('/cmd/home/?v=' + v); }
    }).catch(function () {});
  }
  /* your profile (name + avatar) is kept on this phone too. If it is missing from the shared box, or this is a new
     version of the app, it is sent again by itself – nobody has to open the profile to make it reach the other side. */
  function healProfile() {
    if (preview || stopped || paused || !K || !list('info').length) return;
    var r = list('pme')[0], saved = rj('home.pme', null), sentV = rj('home.pmeV', 0);
    if (r && r.f && (r.f.name || r.f.look)) {
      wj('home.pme', r.f);
      if (sentV !== APPV || r.f.v !== APPV) { wj('home.pmeV', APPV); put('pme', 'me', Object.assign({}, r.f, { v: APPV })); }
    } else if (saved && (saved.name || saved.look)) { wj('home.pmeV', APPV); put('pme', 'me', Object.assign({}, saved, { v: APPV })); }
  }
  function start() {
    lastHtml = ''; if (window.__hnav) window.__hnav.hidden = true; app.innerHTML = '<p class="h-wait"><i class="bi bi-arrow-repeat"></i></p>';
    pull().then(function () {
      if (preview) return;
      if (!stopped && badKey && !list('info').length) {   /* sharing was started again with a new key */
        wj('home.key', null); K = null; recs = {}; rids = {};
        screen('<i class="bi bi-qr-code-scan h-big"></i><h1>' + L('Scan the new code', 'Skann den nye koden') + '</h1><p>' + L('Sharing was started again, so the old code no longer works.', 'Delingen ble startet på nytt, så den gamle koden virker ikke lenger.') + '</p><button class="h-btn" type="button" data-reload>' + L('Continue', 'Fortsett') + '</button>');
        return;
      }
      healProfile();
      if (!stopped && list('info').length && !list('pme').length && !rj('home.profiled', false)) setTimeout(profileSheet, 300); if (!stopped && !list('info').length) screen('<i class="bi bi-hourglass-split h-big"></i><h1>' + L('Waiting for the first sync', 'Venter på første synk') + '</h1><p>' + L('Ask the other one to open their dashboard once.', 'Be den andre åpne dashbordet sitt én gang.') + '</p><button class="h-btn ghost" type="button" data-reload>' + L('Check again', 'Sjekk igjen') + '</button>'); });
    setInterval(function () { if (!document.hidden && !stopped) pull(); }, 30000);
    if (!preview) SC.live(livePull);
    chatStart();
    checkVersion(); setInterval(function () { if (!document.hidden) checkVersion(); }, 10 * 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !stopped) { pull(); checkVersion(); } });
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
    var pend = info().pend || [];
    list('sx').forEach(function (r) { if (pend.indexOf(r.id) > -1) return; var f = r.f, s = f.shares || {}; b += f.payer === 'o' ? +s.p || 0 : -(+s.o || 0); });
    list('pay').forEach(function (r) { var f = r.f; b += f.from === 'o' ? +f.amount || 0 : -(+f.amount || 0); });
    list('led').forEach(function (r) { var f = r.f; b += f.kind === 'back' ? +f.amount || 0 : f.payer === 'o' ? +f.p || 0 : -(+f.o || 0); });
    return Math.round(b * 100) / 100;
  }

  /* ---------- drawing ---------- */
  var TABS = [['today', 'sun', 'Today', 'I dag'], ['shop', 'cart3', 'Food', 'Mat'], ['chores', 'house-heart', 'Home', 'Hjem'], ['money', 'people', 'Money', 'Penger'], ['cal', 'calendar-heart', 'Plans', 'Planer'], ['me', 'person-lock', 'Me', 'Meg']];
  var showAllMoney = false;
  function tabsOn() { var w = info().what || {}, on = function (k) { return w[k] !== false; };
    return TABS.filter(function (t) { return { today: true, shop: on('shop') || on('meals') || on('pantry') || on('recipes'), chores: on('chores') || on('plants') || on('move') || on('house'), money: on('money') || on('bills'), cal: on('cal') || on('trips'),  me: !preview && My.any() }[t[0]]; }); }
  /* avatars: yours (you make it in Settings) and the owner's */
  function mine() { var r = list('pme')[0]; return r ? r.f : {}; }
  function myName() { return mine().name || info().partner || L('You', 'Deg'); }
  var MOM = { k: 'day', bg: '#1d2533', sky: 'sun', i: 'sun', c: '#f2c94c' };
  function face(look, cls) { var A = window.Avatar; if (!A || !A.figure || !look) return '<span class="h-av ' + (cls || '') + ' none"><i class="bi bi-person"></i></span>'; try { return '<span class="h-av ' + (cls || '') + '">' + A.figure(A.MOMENTS && A.MOMENTS.day || MOM, look) + '</span>'; } catch (e) { return '<span class="h-av none"><i class="bi bi-person"></i></span>'; } }
  var lastHtml = '', nav = document.createElement('nav'); nav.className = 'h-tabs'; nav.hidden = true; document.body.appendChild(nav); window.__hnav = nav;
  nav.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; wj('home.tab', tab); draw(); scrollTo(0, 0); });
  /* the menu is made once and stays put – only the highlighted tab (and the chat's unread number) changes */
  function navDraw(ts) {
    ts = ts || tabsOn();
    var sig = ts.map(function (t) { return t[0]; }).join() + '|' + L('en', 'no');
    if (nav.dataset.sig !== sig) { nav.dataset.sig = sig; nav.innerHTML = ts.map(function (t) { return '<button type="button" data-tab="' + t[0] + '"><i class="bi bi-' + t[1] + '"></i><span>' + L(t[2], t[3]) + '</span>' + '</button>'; }).join(''); }
    nav.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-current', String(b.dataset.tab === tab)); });
    nav.hidden = false;
  }
  var chatOn = false;
  function chatStart() {
    if (chatOn || !window.HomeChat || !K || preview) return; chatOn = true;
    HomeChat.init({ key: K, me: 'p', no: nb, keys: function () { var r = list('keys')[0]; return r && r.f && Array.isArray(r.f.list) ? r.f.list : []; },
      name: function (side) { return side === 'o' ? owner() : myName(); },
      face: function (side) { return face(side === 'o' ? info().olook : mine().look, ''); },
      notes: { on: function () { return (info().what || {}).notes !== false; }, list: function () { return list('note').map(function (r) { return { id: r.id, title: r.f.title || '', text: r.f.text || '' }; }).sort(function (a, b) { return a.title.localeCompare(b.title); }); },
        add: function (title, text) { put('note', 'h' + uid(), { title: title, text: text || '' }); }, remove: function (id) { put('note', id, null, true); } },
      missing: L('The chat isn’t switched on yet – ', 'Chatten er ikke slått på ennå – ') + owner() + L(' needs to update the server.', ' må oppdatere serveren.'),
      actions: {
        shop: function (text) { put('shop', 'h' + uid(), { text: text.slice(0, 120), done: false }); },
        plan: function (title, date, time) { var ev = { title: title, date: date, allDay: !time }; if (time) ev.start = time; put('ev', 'h' + uid(), ev); }
      },
      onChange: function () {} });
    HomeChat.bubble({ label: L('Chat with ', 'Chat med ') + owner(), zoom: String(parseFloat(getComputedStyle(document.body).zoom) || 1) });
  }
  function draw() {
    if (!K || stopped || !list('info').length) return;
    if (!chatOn && !preview) chatStart();
    var ts = tabsOn(); if (!ts.some(function (t) { return t[0] === tab; })) tab = ts.length ? ts[0][0] : 'shop';
    var keep = document.activeElement && document.activeElement.name ? { n: document.activeElement.name, v: document.activeElement.value } : null;
    var html = '<header class="h-top"><div class="h-faces">' + face(info().olook, 'o') + face(mine().look, 'p') + '</div><div class="h-tt"><small>' + esc(fdate(today(), { weekday: 'long', day: 'numeric', month: 'long' })) + '</small><h1>' + esc(L('Home with ', 'Hjemme med ') + owner()) + '</h1></div><button type="button" class="h-icon" data-menu aria-label="' + L('Settings', 'Innstillinger') + '"><i class="bi bi-gear"></i></button></header>' +
      /* once, on Today, and it can be put away – it sat on top of every tab (2026-11-10); Settings still has it */
      (!mine().look && !preview && tab === 'today' && !rj('home.avNudgeOff', 0) ? '<div class="h-nudgew"><button type="button" class="h-nudge" data-avatar><i class="bi bi-person-bounding-box"></i> ' + L('Make your avatar – it shows up for ', 'Lag avataren din – den dukker opp hos ') + esc(owner()) + '</button><button type="button" class="h-nudgex" data-avnx aria-label="' + L('Not now', 'Ikke nå') + '"><i class="bi bi-x-lg"></i></button></div>' : '') +
      (preview ? '<div class="h-prevbar"><i class="bi bi-eye"></i> ' + L('Preview of ', 'Forhåndsvisning av ') + esc(info().partner || L('their', 'deres')) + L('’s app – nothing can be changed here', ' sin app – ingenting kan endres her') + '</div>' : '') +
      '<section class="h-body">' + ({ today: todayView, shop: shop, chores: chores, money: money, cal: cal, notes: notes, me: My.view }[tab] || todayView)() + '</section>';
    /* only touch the page when something on it changed: every refresh used to rebuild it, which made it jump */
    if (html !== lastHtml || !app.querySelector('.h-body')) { lastHtml = html; var y = scrollY; app.innerHTML = html; if (scrollY !== y) scrollTo(0, y);
      if (keep) { var el = app.querySelector('[name="' + keep.n + '"]'); if (el && 'value' in el) { el.value = keep.v; el.focus(); } } }
    navDraw(ts);
  }
  /* what changed from the owner since you last looked (remembered per phone) */
  var known = rj('home.known', null), lastLook = +rj('home.lastLook', 0) || 0;
  function changes() {
    if (!known) return [];
    var out = [], o = owner();
    Object.keys(recs).forEach(function (rid) {
      var r = recs[rid]; if (r.by === 'p' || !r.c || r.c === 'info' || r.c === 'clog' || r.c === 'led' || r.c === 'pme') return;
      var was = known[rid]; if (was && was >= r.t) return; if (r.t <= lastLook) return;
      var f = r.f || {}, nm = f.text || f.title || f.name || f.note || '';
      if (r.del) { if (!was) return; out.push({ t: r.t, i: 'dash-circle', s: o + L(' removed something', ' fjernet noe') }); return; }
      var verb = was ? L(' changed ', ' endret ') : L(' added ', ' la til ');
      var what = { shop: L('to the list: ', 'på listen: '), meal: L('dinner: ', 'middag: '), ev: L('an event: ', 'en hendelse: '), chore: L('a chore: ', 'en oppgave: '), sx: L('a shared cost: ', 'en felles utgift: '), pay: L('a settle-up: ', 'en oppgjør: '), note: L('a note: ', 'et notat: '), trip: L('a trip: ', 'en tur: '), proj: L('a project: ', 'et prosjekt: '), doc: L('a document: ', 'et dokument: '), plant: L('a plant: ', 'en plante: '), mv: L('the moving checklist: ', 'flyttelisten: '), recipe: L('a recipe: ', 'en oppskrift: '), pantry: L('the pantry: ', 'matskapet: '), bill: L('a bill: ', 'en regning: '), cdone: '' }[r.c];
      if (r.c === 'cdone') { var ch = find('chore', String(f.k || '').split('|')[1]); if (ch) out.push({ t: r.t, i: 'check2-circle', s: o + L(' did: ', ' gjorde: ') + ch.f.name }); return; }
      if (what == null) return;
      if (r.c === 'shop' && f.done) { out.push({ t: r.t, i: 'cart-check', s: o + L(' bought ', ' kjøpte ') + nm }); return; }
      out.push({ t: r.t, i: 'arrow-repeat', s: o + verb + what + nm + (r.c === 'sx' ? ' ' + kr(f.total) : r.c === 'pay' ? kr(f.amount) : '') });
    });
    return out.sort(function (a, b) { return b.t - a.t; }).slice(0, 12);
  }
  function lookedNow() { var k = {}; Object.keys(recs).forEach(function (rid) { k[rid] = recs[rid].t; }); known = k; lastLook = Date.now(); wj('home.known', k); wj('home.lastLook', lastLook); }
  /* the two of you: holding hands, a high five when a chore was done today, a hug on your birthday, a kiss in the evening – tap for the next */
  var coupleK = null;
  function coupleCard() {
    var A = window.Avatar, ol = info().olook, my = mine().look; if (!A || !A.couple || !ol || !my) return '';
    var tk = today(), bd = String(mine().bday || '').split('.').slice(0, 2).map(Number).join('.'), d = new Date(), dm = d.getDate() + '.' + (d.getMonth() + 1);
    var did = Object.keys(recs).some(function (rid) { var r = recs[rid]; return r.c === 'cdone' && !r.del && r.t && dkey(new Date(r.t)) === tk; });
    var k = coupleK || A.coupleKind({ hi5: did, hug: bd === dm }), o = owner();
    var say = { hold: L('You and ', 'Du og ') + o + ' 💛', hi5: coupleK ? L('High five!', 'High five!') : L('Chores done today – high five!', 'Husarbeid gjort i dag – high five!'), hug: coupleK ? L('A big hug', 'En god klem') : L('Happy birthday – a big hug!', 'Gratulerer med dagen – en god klem!'), kiss: L('Good night, you two', 'God natt, dere to') }[k];
    var pic = ''; try { var th = document.documentElement.getAttribute('data-theme'); pic = A.couple(k, my, ol, { label: say, light: th === 'light' || (!th && matchMedia('(prefers-color-scheme: light)').matches) }); } catch (e) { return ''; }
    return '<button type="button" class="h-couple" data-couple aria-label="' + esc(say + ' – ' + L('tap for the next', 'trykk for neste')) + '">' + pic + '<span>' + esc(say) + '</span></button>';
  }
  function todayView() {
    var tk = today(), w = info().what || {}, o = owner(), rows = [];
    var meal = list('meal').filter(function (r) { return (r.f.date || r.id) === tk; })[0];
    if (w.meals !== false) rows.push(['egg-fried', meal ? esc(meal.f.text) : '<em>' + L('Nothing planned', 'Ikke planlagt') + '</em>', L('Dinner tonight', 'Middag i kveld'), 'shop']);
    if (w.chores !== false) { var due = list('chore').map(function (r) { var p = period(r.f); return { r: r, p: p, tu: turn(r.f, p), dn: doneOf(r.id, p) }; }).filter(function (x) { return !x.dn && x.p.day <= tk; });
      var mine = due.filter(function (x) { return x.tu === 'them'; }); rows.push(['arrow-repeat', mine.length ? esc(mine.map(function (x) { return x.r.f.name; }).join(', ')) : '<em>' + L('Nothing on you today', 'Ingenting på deg i dag') + '</em>', L('Your turn', 'Din tur') + (due.length > mine.length ? ' · ' + o + ': ' + (due.length - mine.length) : ''), 'chores']); }
    if (w.cal !== false) { var ev = list('ev').map(function (r) { return { r: r, d: nextOf(r.f, tk) }; }).filter(function (x) { return x.d === tk; });
      rows.push(['calendar-heart', ev.length ? esc(ev.map(function (x) { return (x.r.f.allDay ? '' : (x.r.f.start || '') + ' ') + x.r.f.title; }).join(', ')) : '<em>' + L('Nothing today', 'Ingenting i dag') + '</em>', L('Today', 'I dag'), 'cal']); }
    if (w.shop !== false) { var sl = list('shop').filter(function (r) { return !r.f.done; }); rows.push(['cart3', sl.length ? esc(sl.slice(0, 5).map(function (r) { return r.f.text; }).join(', ') + (sl.length > 5 ? ' …' : '')) : '<em>' + L('The list is empty', 'Listen er tom') + '</em>', sl.length + L(' to buy', ' å kjøpe'), 'shop']); }
    if (w.money !== false) { var b = balance(); rows.push(['people', Math.abs(b) < 1 ? L('You’re even', 'Dere er skuls') : b > 0 ? L('You owe ', 'Du skylder ') + esc(o) + ' ' + esc(kr(b)) : esc(o) + L(' owes you ', ' skylder deg ') + esc(kr(-b)), L('Money', 'Penger'), 'money']); }
    if (w.plants !== false) { var th = list('plant').filter(function (r) { var d = r.f.last ? fromKey(r.f.last) : new Date(0); d.setDate(d.getDate() + (+r.f.every || 7)); return dkey(d) <= tk; }); if (th.length) rows.push(['droplet', esc(th.map(function (r) { return r.f.name; }).join(', ')), L('Thirsty plants', 'Tørste planter'), 'chores']); }
    var ch = changes();
    var html = '<ul class="h-list h-today">' + rows.map(function (r) { return '<li><button type="button" class="h-tick" data-tab="' + r[3] + '"><i class="bi bi-' + r[0] + '"></i><span>' + r[1] + '<small>' + esc(r[2]) + '</small></span></button></li>'; }).join('') + '</ul>' +
      '<h2 class="h-h">' + L('What’s changed', 'Hva som er endret') + '</h2>' +
      (ch.length ? '<ul class="h-list">' + ch.map(function (x) { return '<li><span class="h-row"><span><i class="bi bi-' + x.i + '"></i> ' + esc(x.s) + '<small>' + esc(new Date(x.t).toLocaleString(nb ? 'nb-NO' : 'en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })) + '</small></span></span></li>'; }).join('') + '</ul><button type="button" class="h-link" data-looked>' + L('Mark as seen', 'Merk som sett') + '</button>'
        : '<p class="h-sum">' + (known ? L('Nothing new since you last looked.', 'Ingenting nytt siden sist.') : L('From now on, what ', 'Fra nå av ser du her hva ') + esc(o) + L(' changes shows up here.', ' endrer.')) + '</p>');
    if (!known && !preview) setTimeout(lookedNow, 0);
    return coupleCard() + html;
  }
  function dinners() {
    if ((info().what || {}).meals === false) return '';
    var by = {}; list('meal').forEach(function (r) { by[r.f.date || r.id] = r.f.text; });
    var rows = []; for (var i = 0; i < 7; i++) { var d = new Date(); d.setDate(d.getDate() + i); var k = dkey(d); rows.push('<li><button type="button" class="h-tick" data-meal="' + k + '"><i class="bi bi-' + (by[k] ? 'egg-fried' : 'plus-circle') + '"></i><span>' + (by[k] ? esc(by[k]) : '<em>' + L('Add dinner', 'Legg til middag') + '</em>') + '<small>' + esc(i === 0 ? L('Today', 'I dag') : i === 1 ? L('Tomorrow', 'I morgen') : fdate(k, { weekday: 'long' })) + '</small></span></button></li>'); }
    return '<h2 class="h-h">' + L('Dinners this week', 'Middager denne uka') + '</h2>' + votesHtml() + '<ul class="h-list">' + rows.join('') + '</ul>' +
      '<button type="button" class="h-btn ghost wide" data-votenew><i class="bi bi-hand-index-thumb"></i> ' + esc(L('Let ', 'La ') + owner() + L(' choose', ' velge')) + '</button>';
  }
  /* dinner voting: one suggests 2–3 dinners, the other picks; the pick goes on the plan */
  function votesHtml() {
    var cut = dkey(new Date(Date.now() - 2 * 864e5)), o = owner(), dd = function (k) { return fdate(k, { weekday: 'long', day: 'numeric', month: 'short' }); };
    var l = list('vote').filter(function (r) { return r.f.date >= cut && Array.isArray(r.f.opts) && r.f.opts.length; }).sort(function (a, b) { return a.f.date < b.f.date ? -1 : 1; });
    if (!l.length) return '';
    return '<ul class="h-list h-votes">' + l.map(function (r) {
      var f = r.f;
      if (f.pick != null) return '<li><span class="h-row"><span><i class="bi bi-check2-circle"></i> ' + esc((f.from === 'p' ? o + L(' picked ', ' valgte ') : L('You picked ', 'Du valgte ')) + f.opts[f.pick] + L(' for ', ' til ') + dd(f.date)) + '</span></span></li>';
      if (f.from === 'p') return '<li><span class="h-row"><span><i class="bi bi-hourglass-split"></i> ' + esc(L('Waiting for ', 'Venter på at ') + o + L(' to pick for ', ' velger til ') + dd(f.date) + ': ' + f.opts.join(' · ')) + '</span></span><button type="button" class="h-x" data-votedel="' + esc(r.id) + '" aria-label="' + L('Cancel', 'Avbryt') + '"><i class="bi bi-x"></i></button></li>';
      return '<li class="h-vote"><span class="h-row"><span><i class="bi bi-hand-index-thumb"></i> ' + esc(o + L(' can’t decide – pick dinner for ', ' klarer ikke å velge – velg middag til ') + dd(f.date)) + '</span></span><div class="h-vopts">' + f.opts.map(function (x, i) { return '<button type="button" class="h-btn sm" data-votepick="' + esc(r.id) + '|' + i + '">' + esc(x) + '</button>'; }).join('') + '</div></li>';
    }).join('') + '</ul>';
  }
  function voteSheet() {
    var opts = ''; for (var i = 0; i < 7; i++) { var d = new Date(); d.setDate(d.getDate() + i); var k = dkey(d); opts += '<option value="' + k + '">' + esc(i === 0 ? L('Today', 'I dag') : i === 1 ? L('Tomorrow', 'I morgen') : fdate(k, { weekday: 'long', day: 'numeric', month: 'short' })) + '</option>'; }
    sheet('<h2>' + esc(L('Let ', 'La ') + owner() + L(' choose', ' velge')) + '</h2><label class="h-lbl">' + L('Which day', 'Hvilken dag') + '<select name="d">' + opts + '</select></label>' +
      [1, 2, 3].map(function (n) { return '<input name="o' + n + '" maxlength="80" placeholder="' + esc(n === 3 ? L('Suggestion 3 (optional)', 'Forslag 3 (valgfritt)') : L('Suggestion ', 'Forslag ') + n) + '">'; }).join(''), function (f) {
      var o = [f.o1.value, f.o2.value, f.o3.value].map(function (x) { return x.trim(); }).filter(Boolean); if (o.length < 2) { (f.o1.value.trim() ? f.o2 : f.o1).focus(); return false; }
      put('vote', 'h' + uid(), { date: f.d.value, opts: o.slice(0, 3), from: 'p', at: Date.now() });
      toast('<i class="bi bi-send"></i> ' + esc(L('Sent to ', 'Sendt til ') + owner()));
    });
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
  function toggleChore(id) {
    var r = find('chore', id); if (!r) return; var p = period(r.f), k = p.key + '|' + r.id, dn = doneOf(r.id, p);
    if (dn) put('cdone', k, null, true); else { put('cdone', k, { k: k, who: turn(r.f, p), at: today() }); toast('<i class="bi bi-check2"></i> ' + esc(r.f.name), function () { put('cdone', k, null, true); }); }
  }
  /* ---------- the home map (the owner shows it from House → Map): tap a room for its chores, a pin for where things are ---------- */
  var mapUrl = null, mapFid = null, MAPI = { water: ['droplet', '#0891b2'], power: ['lightning-charge', '#c98500'], wifi: ['wifi', '#3987e5'], smoke: ['alarm', '#e05555'], fire: ['fire', '#e8743b'], key: ['key', '#7a8794'], heat: ['thermometer-half', '#d55181'], heater: ['water', '#0891b2'], app: ['plug', '#8a6fdf'], chore: ['check2-square', '#1f9d55'], up: ['tools', '#e05555'], note: ['pin-map', '#6b6f76'] };
  function mapRec() { var r = list('hmap')[0]; return r && r.f && r.f.fid && Array.isArray(r.f.rooms) ? r.f : null; }
  function mapImg(f) {
    if (mapFid === f.fid) return; mapFid = f.fid; mapUrl = null;
    fetch('/cmd/api/sfile?id=' + f.fid, { credentials: 'same-origin', cache: 'no-store' }).then(function (res) { if (!res.ok) throw new Error(res.status); return res.arrayBuffer(); })
      .then(function (buf) { return SC.decryptBytes(K, buf); }).then(function (pt) { mapUrl = URL.createObjectURL(new Blob([pt], { type: 'image/png' })); var im = document.querySelector('.h-map img'); if (im) im.src = mapUrl; }, function () { mapFid = null; });
  }
  function mapChores(f, rid) {
    var tk = today(); return list('chore').filter(function (r) { return (f.cr || {})[r.id] === rid; }).map(function (r) { var p = period(r.f); return { r: r, p: p, tu: turn(r.f, p), dn: doneOf(r.id, p) }; }).sort(function (a, b) { return (a.dn ? 1 : 0) - (b.dn ? 1 : 0) || (a.p.day < b.p.day ? -1 : 1); });
  }
  function homeMap() {
    var f = mapRec(); if (!f) return '';
    mapImg(f);
    var H = Math.round(1000 * f.h / f.w), tk = today(), badges = '';
    f.rooms.forEach(function (rm) {
      var big = rm.r.slice().sort(function (a, b) { return b[2] * b[3] - a[2] * a[3]; })[0], n = mapChores(f, rm.id).filter(function (x) { return !x.dn && x.tu === 'them' && Math.round((fromKey(x.p.day) - fromKey(tk)) / 864e5) <= 2; });
      if (n.length) badges += '<span class="h-mbadge' + (n.some(function (x) { return x.p.day < tk; }) ? ' late' : '') + '" style="left:' + ((big[0] + big[2]) * 100) + '%;top:' + (big[1] * 100) + '%">' + n.length + '</span>';
    });
    return '<h2 class="h-h">' + L('Home map', 'Boligkart') + '</h2><div class="h-map' + (f.mono ? ' mono' : '') + (f.style === 'clean' ? ' clean' : '') + '" style="aspect-ratio:' + f.w + ' / ' + f.h + '"><img alt="' + L('Floor plan', 'Plantegning') + '"' + (mapUrl ? ' src="' + mapUrl + '"' : '') + '>' +
      '<svg viewBox="0 0 1000 ' + H + '" preserveAspectRatio="none">' + f.rooms.map(function (rm) { return rm.r.map(function (q) { return '<rect data-hmroom="' + esc(rm.id) + '" style="--rc:' + (rm.c || 'var(--acc)') + '" x="' + q[0] * 1000 + '" y="' + q[1] * H + '" width="' + q[2] * 1000 + '" height="' + q[3] * H + '"></rect>'; }).join(''); }).join('') +
      (f.furn || []).map(function (x) { var q = x.r; return '<rect class="h-mfurn" x="' + q[0] * 1000 + '" y="' + q[1] * H + '" width="' + q[2] * 1000 + '" height="' + q[3] * H + '"></rect>'; }).join('') + '</svg>' +
      (f.style === 'clean' ? f.rooms.map(function (rm) { var big = rm.r.slice().sort(function (a, b) { return b[2] * b[3] - a[2] * a[3]; })[0]; return '<span class="h-mlabel" style="left:' + (big[0] + big[2] / 2) * 100 + '%;top:' + (big[1] + big[3] / 2) * 100 + '%">' + esc(rm.name) + '</span>'; }).join('') : '') +
      f.pins.map(function (p) { var ic = MAPI[p.k] || MAPI.note; return '<button type="button" class="h-mpin" data-hmpin="' + esc(p.id) + '" style="left:' + p.x * 100 + '%;top:' + p.y * 100 + '%;--c:' + ic[1] + '" aria-label="' + esc(p.t) + '"><i class="bi bi-' + ic[0] + '"></i></button>'; }).join('') + badges + '</div>' +
      '<p class="h-small h-mhint">' + L('Tap a room for its chores, or a pin for where things are.', 'Trykk på et rom for husarbeidet der, eller en nål for hvor ting er.') + '</p>';
  }
  function mapRoomSheet(id) {
    var f = mapRec(); if (!f) return; var rm = f.rooms.filter(function (x) { return x.id === id; })[0]; if (!rm) return;
    function rows() {
      var l = mapChores(f, id), all = mapChores(f, 'all').filter(function (x) { return !x.dn; }), tk = today(), pins = f.pins.filter(function (p) { return rm.r.some(function (q) { return p.x >= q[0] && p.x <= q[0] + q[2] && p.y >= q[1] && p.y <= q[1] + q[3]; }); });
      var row = function (x) { var n = Math.round((fromKey(x.p.day) - fromKey(tk)) / 864e5), when = n === 0 ? L('today', 'i dag') : n === 1 ? L('tomorrow', 'i morgen') : n < 0 ? (x.dn ? '' : (-n) + (n === -1 ? L(' day late', ' dag på etterskudd') : L(' days late', ' dager på etterskudd'))) : fdate(x.p.day, { weekday: 'long' });
        return '<li class="' + (x.dn ? 'done' : '') + '"><button type="button" class="h-tick" data-mchore="' + esc(x.r.id) + '"><i class="bi bi-' + (x.dn ? 'check-circle-fill' : 'circle') + '"></i><span>' + esc(x.r.f.name) + '<small>' + esc([x.tu === 'them' ? L('Your turn', 'Din tur') : owner() + L('’s turn', ' sin tur'), when].filter(Boolean).join(' · ')) + '</small></span></button></li>'; };
      return (l.length ? '<ul class="h-list">' + l.map(row).join('') + '</ul>' : '<p class="h-small">' + L('No chores in this room.', 'Ikke noe husarbeid i dette rommet.') + '</p>') +
        (pins.length ? '<h3 class="h-h">' + L('Here', 'Her') + '</h3><ul class="h-list">' + pins.map(function (p) { var ic = MAPI[p.k] || MAPI.note; return '<li><button type="button" class="h-tick" data-mpin="' + esc(p.id) + '"><i class="bi bi-' + ic[0] + '" style="color:' + ic[1] + '"></i><span>' + esc(p.t) + '</span></button></li>'; }).join('') + '</ul>' : '') +
        (all.length ? '<h3 class="h-h">' + L('For the whole home', 'For hele boligen') + '</h3><ul class="h-list">' + all.map(row).join('') + '</ul>' : '');
    }
    var bg = sheet('<h2>' + esc(rm.name) + '</h2>' + (rm.area ? '<p class="h-small">' + esc(rm.area) + ' m²</p>' : '') + '<div data-mrows>' + rows() + '</div>', function () {});
    bg.querySelector('[type=submit]').textContent = L('Close', 'Lukk'); var cx = bg.querySelector('[data-x]'); if (cx) cx.remove();
    bg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mchore]'); if (b) { e.preventDefault(); toggleChore(b.dataset.mchore); setTimeout(function () { var w = bg.querySelector('[data-mrows]'); if (w) w.innerHTML = rows(); }, 60); return; }
      var pb = e.target.closest('[data-mpin]'); if (pb) { e.preventDefault(); bg.remove(); mapPinSheet(pb.dataset.mpin); }
    });
  }
  function mapPinSheet(id) {
    var f = mapRec(); if (!f) return; var p = f.pins.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var ic = MAPI[p.k] || MAPI.note, rm = f.rooms.filter(function (r) { return r.r.some(function (q) { return p.x >= q[0] && p.x <= q[0] + q[2] && p.y >= q[1] && p.y <= q[1] + q[3]; }); })[0], ch = p.c ? find('chore', p.c) : null;
    var bg = sheet('<h2><i class="bi bi-' + ic[0] + '" style="color:' + ic[1] + '"></i> ' + esc(p.t) + '</h2><p class="h-small">' + esc(rm ? rm.name : '') + (p.u ? ' · ' + esc(owner()) + L(' looks after this', ' tar seg av dette') : '') + '</p>' +
      (p.info && p.info.length ? '<dl class="h-mfacts">' + p.info.map(function (q) { return '<div><dt>' + esc(q[0]) + '</dt><dd' + (q[2] ? ' class="pre"' : '') + '>' + esc(q[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
      (ch ? '<ul class="h-list"><li><button type="button" class="h-tick" data-mchore="' + esc(ch.id) + '"><i class="bi bi-circle"></i><span>' + esc(ch.f.name) + '</span></button></li></ul>' : ''), function () {});
    bg.querySelector('[type=submit]').textContent = L('Close', 'Lukk'); var cx = bg.querySelector('[data-x]'); if (cx) cx.remove();
    bg.addEventListener('click', function (e) { var b = e.target.closest('[data-mchore]'); if (b) { e.preventDefault(); toggleChore(b.dataset.mchore); bg.remove(); } });
  }
  app.addEventListener('click', function (e) {
    var r = e.target.closest('[data-hmroom]'); if (r) { mapRoomSheet(r.getAttribute('data-hmroom')); return; }
    var p = e.target.closest('[data-hmpin]'); if (p) mapPinSheet(p.dataset.hmpin);
  });
  /* who did what in the shared home – the same list the owner sees (ShareCore.activity) */
  var actWho = '', actAll = false;
  function whoDid() {
    if (!SC.activity) return '';
    /* chores only (it's under the chores – shopping, pantry and dinners are in What's changed on Today), and short:
       the latest five, "Show all" for the rest (2026-11-10: 48 pantry lines and an unfair count) */
    var nm = { p: L('You', 'Du'), o: owner() }, l = SC.activity(recs, nm, L, { who: actWho, days: 14, max: 60, only: ['cdone'] });
    var all = SC.activity(recs, nm, L, { days: 14, max: 400, only: ['cdone'] }), mine = all.filter(function (x) { return x.by === 'p'; }).length;
    var more = l.length > 5 && !actAll ? l.length - 5 : 0; if (more) l = l.slice(0, 5);
    return '<h2 class="h-h">' + L('Who did what', 'Hvem gjorde hva') + '</h2><p class="h-sum">' + (all.length ? esc(L('Last 2 weeks: you ', 'Siste 2 uker: du ') + mine + ' · ' + owner() + ' ' + (all.length - mine)) : L('Nothing yet.', 'Ingenting ennå.')) + '</p>' +
      (all.length ? '<div class="h-rooms">' + [['', L('Both', 'Begge')], ['p', L('You', 'Du')], ['o', owner()]].map(function (x) { return '<button type="button" class="h-room' + (actWho === x[0] ? ' on' : '') + '" data-actwho="' + x[0] + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>' +
      '<ul class="h-list h-act">' + l.map(function (x) { return '<li><span class="h-row"><span><i class="bi bi-' + x.icon + '"></i> ' + esc(x.text) + '<small>' + esc(new Date(x.t).toLocaleString(L('en-GB', 'nb-NO'), { weekday: 'short', hour: '2-digit', minute: '2-digit' })) + '</small></span></span></li>'; }).join('') + '</ul>' + (more ? '<button type="button" class="h-more" data-actall>' + esc(L('Show all ', 'Vis alle ') + (more + 5)) + '</button>' : '') : '');
  }
  /* rooms (the owner sets them up; you both pick them on chores) */
  function roomList() { return list('room').sort(function (a, b) { return (+a.f.order || 0) - (+b.f.order || 0); }); }
  var inRoom = rj('home.chroom', '') || '';
  function chores() {
    var w = info().what || {}, out = '', tk = today();
    if (w.chores !== false) {
      var rl = roomList(); if (inRoom && !rl.some(function (r) { return r.id === inRoom; })) inRoom = '';
      var all = list('chore').map(function (r) { var p = period(r.f), tu = turn(r.f, p); return { r: r, p: p, tu: tu, dn: doneOf(r.id, p) }; });
      var l = all.filter(function (x) { return !inRoom || x.r.f.room === inRoom; }).sort(function (a, b) { return (a.dn ? 1 : 0) - (b.dn ? 1 : 0) || (a.p.day < b.p.day ? -1 : 1); });
      var rname = function (id) { var r = rl.filter(function (q) { return q.id === id; })[0]; return r ? r.f.name : ''; };
      var chips = rl.length ? '<div class="h-rooms"><button type="button" class="h-room' + (inRoom ? '' : ' on') + '" data-hroom="">' + L('All rooms', 'Alle rom') + '</button>' + rl.map(function (r) { var n = all.filter(function (x) { return x.r.f.room === r.id && !x.dn && x.p.day <= tk; }).length; return '<button type="button" class="h-room' + (inRoom === r.id ? ' on' : '') + '" data-hroom="' + esc(r.id) + '"><i class="bi bi-' + esc(r.f.icon || 'house') + '"></i> ' + esc(r.f.name) + (n ? ' <b>' + n + '</b>' : '') + '</button>'; }).join('') + '</div>' : '';
      var mine = l.filter(function (x) { return !x.dn && x.tu === 'them'; }).length;
      out += '<h2 class="h-h">' + L('Chores', 'Husarbeid') + '</h2><p class="h-sum">' + (l.length ? (mine ? L('Your turn: ', 'Din tur: ') + mine : L('Nothing on you right now', 'Ingenting på deg akkurat nå')) : L('No chores yet.', 'Ingen oppgaver ennå.')) + '</p>' +
        chips + (inRoom ? (function () { var ym = today().slice(0, 7), you = 0, them = 0; logList().forEach(function (x) { var ch = find('chore', x.cid); if (!ch || ch.f.room !== inRoom || String(x.at).slice(0, 7) !== ym) return; if (x.who === 'them') you++; else them++; }); return you + them ? '<p class="h-sum">' + esc(rname(inRoom) + L(' this month: you ', ' denne måneden: du ') + you + ' · ' + owner() + ' ' + them) + '</p>' : ''; })() : '') + '<ul class="h-list">' + l.map(function (x) {
          var n = Math.round((fromKey(x.p.day) - fromKey(tk)) / 864e5), when = n === 0 ? L('today', 'i dag') : n === 1 ? L('tomorrow', 'i morgen') : n < 0 ? (x.dn ? '' : (-n) + (n === -1 ? L(' day late', ' dag på etterskudd') : L(' days late', ' dager på etterskudd'))) : fdate(x.p.day, { weekday: 'long' });
          var ls = lastDone(x.r.id);
          return '<li class="' + (x.dn ? 'done' : '') + '"><button type="button" class="h-tick" data-chore="' + esc(x.r.id) + '" aria-pressed="' + !!x.dn + '"><i class="bi bi-' + (x.dn ? 'check-circle-fill' : 'circle') + '"></i><span>' + esc(x.r.f.name) + '<small>' + esc([inRoom ? '' : rname(x.r.f.room), x.tu === 'them' ? L('Your turn', 'Din tur') : owner() + L('’s turn', ' sin tur'), when, ls ? L('last ', 'sist ') + fdate(ls.at, { weekday: 'short', day: 'numeric', month: 'short' }) + L(' by ', ' av ') + (ls.who === 'them' ? L('you', 'deg') : owner()) : ''].filter(Boolean).join(' · ')) + '</small></span></button><button type="button" class="h-x" data-choreedit="' + esc(x.r.id) + '" aria-label="' + L('Edit', 'Endre') + '"><i class="bi bi-pencil"></i></button></li>';
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
    out += house();
    out += whoDid();
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
        var waiting = (info().pend || []).indexOf(x.r.id) > -1;
        return '<li' + (waiting ? ' class="h-wait-ok"' : '') + '><span class="h-row"><span>' + esc(f.note || L('Shared', 'Felles')) + (waiting ? ' <span class="h-chip warn">' + L('Waiting for ', 'Venter på ') + esc(owner()) + L('’s OK', ' sin OK') + '</span>' : '') + '<small>' + esc(fdate(f.date) + ' · ' + (f.payer === 'p' ? L('you paid ', 'du betalte ') + kr(f.total) + ' · ' + o + L('’s part ', ' sin del ') + kr(s.o) : o + L(' paid ', ' betalte ') + kr(f.total) + ' · ' + L('your part ', 'din del ') + kr(s.p))) + '</small></span><b class="' + (f.payer === 'p' ? 'pos' : 'neg') + '">' + (f.payer === 'p' ? '+' : '−') + esc(kr(f.payer === 'p' ? s.o : s.p)) + '</b></span>' + (x.r.by === 'p' ? '<button type="button" class="h-x" data-sxdel="' + esc(x.r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x-lg"></i></button>' : '') + '</li>';
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
      (roomList().length ? '<label class="h-lbl">' + L('Room', 'Rom') + '<select name="room"><option value="">' + L('No room', 'Ingen rom') + '</option>' + roomList().map(function (q) { return '<option value="' + esc(q.id) + '"' + ((f.room || (!r && inRoom)) === q.id ? ' selected' : '') + '>' + esc(q.f.name) + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="h-lbl">' + L('Who', 'Hvem') + '<select name="who"><option value="rotate"' + (f.who === 'rotate' ? ' selected' : '') + '>' + L('Take turns', 'Bytt på') + '</option><option value="them"' + (f.who === 'them' ? ' selected' : '') + '>' + L('Always me', 'Alltid meg') + '</option><option value="me"' + (f.who === 'me' ? ' selected' : '') + '>' + L('Always ', 'Alltid ') + esc(o) + '</option></select></label>' +
      (r ? '<button type="button" class="h-link danger" data-choredel="' + esc(r.id) + '">' + L('Delete this chore', 'Slett oppgaven') + '</button>' : ''), function (fm) {
      if (!fm.name.value.trim()) { fm.name.focus(); return false; }
      put('chore', r ? r.id : 'h' + uid(), { name: fm.name.value.trim(), every: fm.every.value, day: +fm.day.value, who: fm.who.value, start: (r && r.f.start) || today(), room: fm.room ? fm.room.value : (r && r.f.room) || '' });
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
  /* ---------- Settings → Appearance (this phone only, localStorage home.look) ---------- */
  var Look = {
    ACC: [['teal', '#14b8a6', L('Teal', 'Turkis')], ['blue', '#2563eb', L('Blue', 'Blå')], ['purple', '#7c3aed', L('Purple', 'Lilla')], ['pink', '#db2777', L('Pink', 'Rosa')], ['orange', '#f59e0b', L('Orange', 'Oransje')], ['green', '#22c55e', L('Green', 'Grønn')]],
    get: function () { var a = rj('home.look', {}); return { theme: a.theme || 'auto', acc: a.acc || 'teal', size: a.size || 'm' }; },
    apply: function (a) {
      var r = document.documentElement;
      if (a.theme === 'light' || a.theme === 'dark') r.setAttribute('data-theme', a.theme); else r.removeAttribute('data-theme');
      if (a.acc && a.acc !== 'teal') r.setAttribute('data-acc', a.acc); else r.removeAttribute('data-acc');
      if (a.size === 's' || a.size === 'l') r.setAttribute('data-size', a.size); else r.removeAttribute('data-size');
      var dark = a.theme === 'dark' || (a.theme !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
      var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', dark ? '#0e0f11' : '#f4f5f7');
    },
    set: function (k, v) { var a = Look.get(); a[k] = v; wj('home.look', a); Look.apply(a); return a; },
    seg: function (k, opts, cur) { return '<div class="h-seg" role="group">' + opts.map(function (o) { return '<button type="button" data-lookk="' + k + '" data-lookv="' + o[0] + '" aria-pressed="' + (o[0] === cur) + '">' + (o[2] ? '<i class="bi ' + o[2] + '"></i> ' : '') + o[1] + '</button>'; }).join('') + '</div>'; },
    html: function () {
      var a = Look.get();
      return '<div class="h-det-box h-ap"><b><i class="bi bi-palette"></i> ' + L('Appearance', 'Utseende') + '</b>' +
        '<div class="h-ap-row">' + L('Theme', 'Tema') + Look.seg('theme', [['auto', L('Phone', 'Telefon'), 'bi-phone'], ['light', L('Light', 'Lys'), 'bi-sun'], ['dark', L('Dark', 'Mørk'), 'bi-moon-stars']], a.theme) + '</div>' +
        '<div class="h-ap-row">' + L('Colour', 'Farge') + '<div class="h-dots" role="group">' + Look.ACC.map(function (c) { return '<button type="button" data-lookk="acc" data-lookv="' + c[0] + '" style="--dot:' + c[1] + '" aria-label="' + esc(c[2]) + '" title="' + esc(c[2]) + '" aria-pressed="' + (c[0] === a.acc) + '"></button>'; }).join('') + '</div></div>' +
        '<div class="h-ap-row">' + L('Text size', 'Tekststørrelse') + Look.seg('size', [['s', L('Small', 'Liten')], ['m', L('Normal', 'Normal')], ['l', L('Large', 'Stor')]], a.size) + '</div>' +
        '<p class="h-small">' + L('Only on this phone. Changes show right away.', 'Bare på denne telefonen. Endringer vises med en gang.') + '</p></div>';
    }
  };
  if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { Look.apply(Look.get()); }); } catch (e) {} }
  function settingsSheet() {
    var w = info().what || {}, rem = !!rj('home.key', null), o = owner();
    var NAMES = [['shop', L('Shopping list', 'Handleliste'), 'Handleliste'], ['meals', L('Dinner plan', 'Middagsplan')], ['chores', L('Chores', 'Husarbeid')], ['money', L('Money between you', 'Penger mellom dere')], ['bills', L('Home bills', 'Regninger')], ['cal', L('Calendar events', 'Kalenderhendelser')], ['trips', L('Trips', 'Turer')], ['plants', L('Plants', 'Planter')], ['move', L('Moving checklist', 'Flyttesjekkliste')], ['notes', L('Home notes', 'Hjemmenotater')]];
    var bg = sheet('<h2>' + L('Settings', 'Innstillinger') + '</h2>' + (preview ? '<div class="h-prevbar"><i class="bi bi-eye"></i> ' + L('Their settings, as they see them – read-only', 'Innstillingene deres slik de ser dem – kun visning') + '</div>' : '') +
      '<div class="h-me">' + face(mine().look, 'big') + '<div><b>' + esc(myName()) + '</b><button type="button" class="h-btn sm" data-avatar>' + (mine().look ? L('Change your avatar', 'Endre avataren') : L('Make your avatar', 'Lag avataren din')) + '</button></div></div>' +
      '<label class="h-lbl">' + L('Your name', 'Navnet ditt') + '<input name="nm" maxlength="30" value="' + esc(mine().name || info().partner || '') + '"></label>' +
      '<button type="button" class="h-btn ghost" data-profile><i class="bi bi-person-vcard"></i> ' + L('Birthday and phone', 'Bursdag og telefon') + '</button>' +
      '<label class="h-lbl">' + L('Language', 'Språk') + '<select name="lang"><option value="en"' + (nb ? '' : ' selected') + '>English</option><option value="nb"' + (nb ? ' selected' : '') + '>Norsk</option></select></label>' +
      Look.html() +
      '<label class="h-check"><input type="checkbox" name="rem"' + (rem ? ' checked' : '') + '> ' + L('Keep me unlocked on this phone', 'Hold meg innlogget på denne telefonen') + '</label>' +
      '<div class="h-det-box"><b><i class="bi bi-bell"></i> ' + L('Notifications on this phone', 'Varsler på denne telefonen') + '</b>' + Push.html() + '</div>' +
      '<div class="h-det-box"><b><i class="bi bi-person-lock"></i> ' + L('Your own features', 'Dine egne funksjoner') + '</b><p class="h-small">' + L('Only you see these – locked with your own key. ', 'Bare du ser disse – låst med din egen nøkkel. ') + esc(o) + L(' can’t open them.', ' kan ikke åpne dem.') + '</p>' +
        [['cal', L('My calendar', 'Min kalender')], ['money', L('My money', 'Min økonomi')], ['todos', L('My to-dos', 'Mine gjøremål')]].map(function (x) { return '<label class="h-check"><input type="checkbox" name="my_' + x[0] + '"' + (My.on(x[0]) ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join('') +
        (My.any() ? '<button type="button" class="h-link" data-mydl>' + L('Download my own data', 'Last ned mine egne data') + '</button>' : '') + '</div>' +
      '<details class="h-det"><summary>' + L('Change passcode', 'Endre kode') + '</summary><input type="password" name="pa" autocomplete="new-password" placeholder="' + L('New passcode', 'Ny kode') + '"><input type="password" name="pb" autocomplete="new-password" placeholder="' + L('Once more', 'En gang til') + '"><p class="h-err" data-err></p></details>' +
      '<div class="h-det-box"><b>' + L('What ', 'Hva ') + esc(o) + L(' shares with you', ' deler med deg') + '</b><p class="h-small">' + NAMES.filter(function (n) { return w[n[0]] !== false; }).map(function (n) { return n[1]; }).join(' · ') + '</p><p class="h-small">' + esc(o) + L(' chooses this. Nothing else from their dashboard is shared.', ' bestemmer dette. Ingenting annet fra dashbordet deres deles.') + '</p></div>' +
      '<p class="h-small">' + L('Tip: Share → Add to Home Screen to open this like an app.', 'Tips: Del → Legg til på Hjem-skjerm for å åpne dette som en app.') + '</p>' +
      '<div class="h-two"><button type="button" class="h-btn ghost" data-lock>' + L('Lock now', 'Lås nå') + '</button><button type="button" class="h-btn ghost danger" data-forget>' + L('Forget this phone', 'Glem denne telefonen') + '</button></div>' +
      '<p class="h-ver"><i class="bi bi-info-circle"></i> ' + L('Shared home · version ', 'Felles hjem · versjon ') + APPV + ' · ' + L('updates by itself', 'oppdateres av seg selv') + '</p>', function (f) {
      var er = f.querySelector('[data-err]');
      if (preview) { toast('<i class="bi bi-eye"></i> ' + L('Preview – nothing changes here', 'Forhåndsvisning – ingenting endres her')); return; }
      if (f.pa.value || f.pb.value) {
        if (f.pa.value.length < 6) { er.textContent = L('At least 6 characters.', 'Minst 6 tegn.'); f.closest('form').querySelector('details').open = true; return false; }
        if (f.pa.value !== f.pb.value) { er.textContent = L('The two don’t match.', 'De to er ikke like.'); f.closest('form').querySelector('details').open = true; return false; }
        var np = f.pa.value; PASS = np; SC.wrap(np, K).then(function (wv) { return SC.api('share?wrap', { method: 'PUT', body: wv }); }).then(function () { return My.rewrap(np); }).then(function () { toast('<i class="bi bi-check2"></i> ' + L('New passcode saved', 'Ny kode er lagret')); }, function () { toast(L('Couldn’t save the passcode', 'Kunne ikke lagre koden')); });
      }
      if (f.rem.checked) wj('home.key', K); else wj('home.key', null);
      My.remember(f.rem.checked);
      if (!preview) Push.save(f);
      var wantMy = {}; ['cal', 'money', 'todos'].forEach(function (k) { wantMy[k] = !!(f['my_' + k] && f['my_' + k].checked); }); My.setFeatures(wantMy);
      var nm = f.nm.value.trim(); if (nm && nm !== (mine().name || '')) put('pme', 'me', Object.assign({}, mine(), { name: nm }));
      if ((f.lang.value === 'nb') !== nb) { try { localStorage.setItem('home.lang', f.lang.value); } catch (x) {} setTimeout(function () { location.reload(); }, 150); }
    });
    bg.querySelector('[type=submit]').textContent = L('Save', 'Lagre');
    if (preview) bg.querySelectorAll('input, select, details, [data-lock], [data-forget], [data-avatar], [data-profile], [data-mydl], [data-lookk]').forEach(function (x) { if (x.tagName === 'DETAILS') x.style.display = 'none'; else x.disabled = true; });
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
    if (d.lookk) { if (preview) return; Look.set(d.lookk, d.lookv); var gp = b.parentNode; gp.querySelectorAll('[data-lookk]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); return; }
    if (d.avnx != null) { e.preventDefault(); wj('home.avNudgeOff', 1); draw(); return; }
    if (d.avatar != null) { e.preventDefault(); backToProfile = !!(b.closest('.h-sheet') && b.closest('.h-sheet').querySelector('[name=bd]')); var open = document.querySelector('.h-sheetbg'); if (open && !open.querySelector('.ave')) { open.remove(); } avatarEdit(); return; }
    if (d.lock != null) { wj('home.key', null); wj('home.pkey', null); location.reload(); return; }
    if (d.forget != null) { ['home.key', 'home.queue', 'home.tab', 'home.pkey', 'home.myf', 'home.profiled'].forEach(function (k) { wj(k, null); }); location.reload(); return; }
    if (d.mydl != null) { My.download(); return; }
    if (d.unlockown != null) { SC.api('share?wrap').then(askPass, function () {}); return; }
    if (d.pausedme != null) { tab = 'me'; paused = false; draw(); return; }
    if (d.pushtest != null) { Push.test(); return; }
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
    if (d.couple != null) { var KS = window.Avatar.COUPLE_KINDS, cur = coupleK || (b.querySelector('svg').getAttribute('class').match(/cp-(\w+)/) || [])[1] || 'hold'; coupleK = KS[(KS.indexOf(cur) + 1) % KS.length]; draw(); return; }
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
    if (d.chore && find('chore', d.chore)) { toggleChore(d.chore); return; }
    if (d.actwho != null) { actWho = d.actwho; actAll = false; draw(); return; }
    if (d.actall != null) { actAll = true; draw(); return; }
    if (d.votenew != null) { voteSheet(); return; }
    if (d.votedel) { put('vote', d.votedel, null, true); return; }
    if (d.votepick) { var vq = d.votepick.split('|'), vr = find('vote', vq[0]); if (vr) { var vf = Object.assign({}, vr.f, { pick: +vq[1] }); put('vote', vr.id, vf); put('meal', vf.date, { date: vf.date, text: vf.opts[+vq[1]] }); toast('<i class="bi bi-egg-fried"></i> ' + esc(vf.opts[+vq[1]]) + L(' it is', ' blir det')); } return; }
    if (d.hroom != null) { inRoom = inRoom === d.hroom ? '' : d.hroom; wj('home.chroom', inRoom); draw(); requestAnimationFrame(function () { var on = document.querySelector('.h-room.on'); if (on && on.parentElement) on.parentElement.scrollLeft = Math.max(0, on.offsetLeft - 40); }); return; }
    if (d.water && (r = find('plant', d.water))) { var was = r.f; put('plant', r.id, Object.assign({}, r.f, { last: today() })); toast('<i class="bi bi-droplet"></i> ' + L('Watered', 'Vannet'), function () { put('plant', r.id, was); }); return; }
    if (d.mv && (r = find('mv', d.mv))) { put('mv', r.id, { text: r.f.text, done: !r.f.done }); return; }
    if (d.addcost != null) { costSheet(); return; }
    if (d.settle != null) { settleSheet(); return; }
    if (d.moneyall != null) { showAllMoney = !showAllMoney; draw(); return; }
    if (d.addev != null) { evSheet(); return; }
    if (d.looked != null) { lookedNow(); draw(); return; }
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
  /* ================= Notifications on their phone =================
     A small service worker of its own (/cmd/home/sw.js) shows them. Two kinds:
     · right away, sent by the owner's dashboard when they add something you chose (list, events, money, dinner, chores)
     · reminders this app sets: your turn for a chore (at the hour you pick), and shared events an hour before */
  var Push = (function () {
    var KINDS = [['list', L('John adds to the shopping list', 'John legger til på handlelisten')], ['events', L('A new shared event', 'En ny delt hendelse')], ['money', L('Shared costs and settling up', 'Felles utgifter og oppgjør')], ['dinner', L('Dinner plans', 'Middagsplaner')], ['chores', L('New chores', 'Nye oppgaver')], ['turn', L('Your turn for a chore (morning)', 'Din tur for en oppgave (morgen)')], ['soon', L('Shared events, an hour before', 'Delte hendelser, en time før')]];
    function prefs() { return Object.assign({ list: true, events: true, money: true, dinner: false, chores: true, turn: true, soon: true }, (mine().notif) || {}); }
    function devId() { var d = rj('home.dev', null); if (!d) { d = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); wj('home.dev', d); } return d; }
    function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
    function on() { return !!rj('home.push', false); }
    function html() {
      var p = prefs(), o = owner();
      if (!supported()) return '<p class="h-small">' + L('On iPhone, notifications work once this app is on your Home Screen: Share → Add to Home Screen, then open it from there.', 'På iPhone virker varsler når appen ligger på Hjem-skjermen: Del → Legg til på Hjem-skjerm, og åpne den derfra.') + '</p>';
      return '<label class="h-check"><input type="checkbox" name="push_on"' + (on() ? ' checked' : '') + '> ' + L('Send notifications to this phone', 'Send varsler til denne telefonen') + '</label>' +
        KINDS.map(function (k) { return '<label class="h-check h-sub"><input type="checkbox" name="push_' + k[0] + '"' + (p[k[0]] ? ' checked' : '') + '> ' + esc(k[1].replace('John', o)) + '</label>'; }).join('') +
        '<label class="h-lbl">' + L('Chore reminder at', 'Oppgavepåminnelse klokka') + '<select name="push_hour">' + [7, 8, 9, 12, 16, 18, 20].map(function (h) { return '<option value="' + h + '"' + (+(rj('home.pushHour', 8)) === h ? ' selected' : '') + '>' + pad(h) + ':00</option>'; }).join('') + '</select></label>' +
        (on() ? '<button type="button" class="h-link" data-pushtest>' + L('Send a test', 'Send en test') + '</button>' : '');
    }
    function reg() { return navigator.serviceWorker.register('/cmd/home/sw.js', { scope: '/cmd/home/' }).then(function () { return navigator.serviceWorker.ready; }); }
    function b64u(s) { var p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
    function items() {
      var p = prefs(), out = [], now = Date.now(), hr = +(rj('home.pushHour', 8)) || 8;
      if (p.turn) list('chore').forEach(function (r) {
        for (var w = 0; w < 3; w++) { var d = new Date(); d.setDate(d.getDate() + w * 7); var pr = period(r.f, dkey(d)); if (turn(r.f, pr) !== 'them' || doneOf(r.id, pr)) continue;
          var at = fromKey(pr.day); at.setHours(hr, 0, 0, 0); if (at.getTime() > now) out.push({ id: 'turn:' + r.id + ':' + pr.key, at: at.getTime(), title: L('Your turn', 'Din tur'), body: r.f.name, url: '/cmd/home/' }); }
      });
      if (p.soon) list('ev').forEach(function (r) { var f = r.f; if (f.allDay) return; var dd = nextOf(f, today()); if (!dd) return; var at = fromKey(dd); var hm = String(f.start || '18:00').split(':'); at.setHours(+hm[0], +hm[1] || 0, 0, 0); var t0 = at.getTime() - 3600e3; if (t0 > now && t0 < now + 14 * 864e5) out.push({ id: 'ev:' + r.id + ':' + dd, at: t0, title: f.title, body: L('In an hour', 'Om en time') + (f.location ? ' · ' + f.location : ''), url: '/cmd/home/' }); });
      return out.sort(function (a, b) { return a.at - b.at; }).slice(0, 60);
    }
    var lastSent = '';
    function update(force) {
      if (!on() || !supported() || preview || !K) return Promise.resolve();
      return reg().then(function (r) { return r.pushManager.getSubscription(); }).then(function (sub) {
        if (!sub) return; var it = items(), sig = JSON.stringify(it) + sub.endpoint; if (!force && sig === lastSent) return; lastSent = sig;
        return SC.api('push', { method: 'PUT', body: { id: devId(), sub: sub.toJSON(), items: it } });
      }).catch(function () {});
    }
    function enable() {
      return Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') throw new Error('denied');
        return Promise.all([reg(), SC.api('push')]);
      }).then(function (x) { return x[0].pushManager.getSubscription().then(function (s) { return s || x[0].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(x[1].key) }); }); })
        .then(function () { wj('home.push', true); return update(true); });
    }
    function disable() { wj('home.push', null); return SC.api('push', { method: 'DELETE', body: { id: devId() } }).catch(function () {}); }
    function save(f) {
      if (!f.push_on) return;
      var np = {}; KINDS.forEach(function (k) { np[k[0]] = !!(f['push_' + k[0]] && f['push_' + k[0]].checked); });
      if (f.push_hour) wj('home.pushHour', +f.push_hour.value || 8);
      if (JSON.stringify(np) !== JSON.stringify(prefs())) put('pme', 'me', Object.assign({}, mine(), { notif: np }));
      if (f.push_on.checked && !on()) enable().then(function () { toast('<i class="bi bi-bell"></i> ' + L('Notifications are on', 'Varsler er på')); }, function () { toast(L('Notifications weren’t allowed – check Settings → Notifications on the phone', 'Varsler ble ikke tillatt – sjekk Innstillinger → Varslinger på telefonen')); });
      else if (!f.push_on.checked && on()) disable(); else update(true);
    }
    function test() { SC.api('push', { method: 'POST', body: { id: devId(), test: true } }).then(function () { toast('<i class="bi bi-bell"></i> ' + L('Test sent', 'Test sendt')); }, function (e) { toast(esc((e && e.body && e.body.error) || L('Couldn’t send', 'Kunne ikke sende'))); }); }
    return { html: html, save: save, update: update, test: test };
  })();
  setInterval(function () { Push.update(); }, 5 * 60e3);
  boot();
})();
