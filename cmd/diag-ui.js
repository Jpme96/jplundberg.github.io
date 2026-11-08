/* Diagnostics in Admin → System (diag.js does the catching on every page; this draws it and fixes things).
   - Top: one plain answer ("Everything is fine" / "2 things need you") with a fix button per item.
   - One-tap fixes: Sync now, Reload newest version (clears the saved copy of the app), Check again.
   - Problems found: errors, freezes, failed server calls, broken values/pictures, out-of-place bars and slow pages,
     grouped, in plain words, with what to do; the technical line folds out.
   - Server (Worker): checks that the Cloudflare Worker has the newest code, and copies it for you if not.
   - This device: browser, home-screen app, Face ID, storage, offline copy, notifications, page speed.
   - Test everything: opens every page in the background and lists what broke.
   - Report a problem: one sentence + the report (no personal data), ready to paste to Claude. */
(function () {
  "use strict";
  if (!window.Vault || !window.Diag) return;
  var NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(h) { if (window.Quick && window.Quick.toast) window.Quick.toast(h); }
  var D = window.Diag, host = null, worker = null, test = null, dev = null, busy = {};
  var PAGES = [['home', '/cmd/', L('Home', 'Hjem')], ['calendar', '/cmd/calendar/', L('Calendar', 'Kalender')], ['travel', '/cmd/travel/', L('Travel', 'Reise')], ['finance', '/cmd/finance/', L('Finances', 'Økonomi')],
    ['habits', '/cmd/habits/', L('Health', 'Helse')], ['work', '/cmd/work/', L('Work', 'Jobb')], ['house', '/cmd/house/', L('House', 'Hus')], ['people', '/cmd/people/', L('People', 'Folk')], ['food', '/cmd/food/', L('Food', 'Mat')], ['wish', '/cmd/wish/', L('Wishlist', 'Ønskeliste')], ['goals', '/cmd/goals/', L('Goals', 'Mål')], ['admin', '/cmd/admin/', 'Admin']];
  function pageName(p) { var x = PAGES.filter(function (q) { return q[0] === p; })[0]; return x ? x[2] : p; }
  function ago(t) {
    if (!t) return L('never', 'aldri');
    var m = Math.round((Date.now() - t) / 6e4);
    if (m < 1) return L('just now', 'akkurat nå'); if (m < 60) return L(m + ' min ago', 'for ' + m + ' min siden');
    var h = Math.round(m / 60); if (h < 36) return L(h + ' h ago', 'for ' + h + ' t siden');
    return L(Math.round(h / 24) + ' days ago', 'for ' + Math.round(h / 24) + ' dager siden');
  }

  /* ---------- plain words for each kind of problem ---------- */
  var SVC = { 'api/vault': L('Sync', 'Synkronisering'), 'api/site': L('Website settings', 'Nettstedsinnstillinger'), 'api/texts': L('Website texts', 'Nettstedstekster'), 'api/content': L('Articles & projects', 'Artikler og prosjekter'),
    'api/article': L('Writing articles', 'Skriving av artikler'), 'api/health': 'Apple Health', 'api/push': L('Notifications', 'Varsler'), 'api/visitors': L('Visitor numbers', 'Besøkstall'), 'api/calendar': L('Phone calendars', 'Telefonkalendere'),
    'api/recipe': L('Recipe from a link', 'Oppskrift fra lenke'), 'api/backup': L('Backup email', 'Sikkerhetskopi på e-post'), 'api/power': L('Power prices', 'Strømpriser'), 'api/ping': L('Server check', 'Serversjekk') };
  function explain(e) {
    var m = e.m || '', k = e.k;
    if (k === 'net') {
      var parts = m.split(' '), s = parts[0], code = parts.slice(2).join(' '), name = SVC[s] || s, n = +code;
      if (/^api\//.test(s)) {
        if (n === 401 || n === 403) return { t: name + L(': you were logged out', ': du ble logget ut'), w: L('Cloudflare asked you to log in again. Reload the page and log in – nothing is lost.', 'Cloudflare ba deg logge inn igjen. Last inn siden på nytt og logg inn – ingenting er tapt.'), need: true, fix: 'reload' };
        if (n === 404 || n === 405) return { t: name + L(': the server doesn’t know this yet', ': serveren kjenner ikke dette ennå'), w: L('The Cloudflare Worker runs older code. Paste the newest Worker (see Server below).', 'Cloudflare-workeren kjører eldre kode. Lim inn den nyeste workeren (se Server under).'), need: true, fix: 'worker' };
        if (n >= 500) return { t: name + L(': the server had a problem', ': serveren hadde et problem'), w: L('Usually fixes itself within minutes. If it keeps happening, send a report.', 'Ordner seg som regel i løpet av minutter. Send en rapport hvis det fortsetter.'), need: e.n >= 3 };
        return { t: name + L(': no answer', ': ikke svar'), w: L('The connection dropped. Your changes are kept on this device and sent when it’s back.', 'Forbindelsen falt ut. Endringene dine ligger på denne enheten og sendes når den er tilbake.'), need: false };
      }
      return { t: name + L(' didn’t answer', ' svarte ikke'), w: L('An outside service (not yours). It usually comes back by itself – nothing to do.', 'En ekstern tjeneste (ikke din). Den kommer som regel tilbake av seg selv – ingenting å gjøre.'), need: false };
    }
    if (k === 'freeze') return { t: L('The page stopped responding', 'Siden sluttet å svare'), w: L('A bug or a very slow step. Send a report – it says what you tapped just before.', 'En feil eller et veldig tregt steg. Send en rapport – den sier hva du trykket på rett før.'), need: true, fix: 'report' };
    if (k === 'content') return { t: /picture/.test(m) ? L('A picture didn’t load', 'Et bilde lastet ikke') : L('Something showed a broken value', 'Noe viste en ødelagt verdi'), w: L('Shown as “undefined”, “NaN” or a missing picture. It’s a small bug – send a report so it can be fixed.', 'Vist som «undefined», «NaN» eller et manglende bilde. En liten feil – send en rapport så den kan rettes.'), need: true, fix: 'report' };
    if (k === 'layout') return { t: /wider/.test(m) ? L('A page was wider than the screen', 'En side var bredere enn skjermen') : /cover/.test(m) ? L('Two things covered each other', 'To ting dekket hverandre') : /field/.test(m) ? L('A field spilled into the next one', 'Et felt gikk over i det neste') : L('A bar was out of place', 'En linje var på feil sted'), w: L('Something on the screen was out of place. Send a report – it says where.', 'Noe på skjermen var på feil sted. Send en rapport – den sier hvor.'), need: true, fix: 'report' };
    if (k === 'lang') return { t: L('English text in Norwegian mode', 'Engelsk tekst i norsk modus'), w: L('Some words weren’t translated. Copy it to Claude – it says which text and where.', 'Noen ord ble ikke oversatt. Kopier det til Claude – det står hvilken tekst og hvor.'), need: true, fix: 'report' };
    if (k === 'slow') return { t: L('A page opened slower than usual', 'En side åpnet tregere enn vanlig'), w: L('Once is normal (weak connection, an update). If it keeps happening, send a report.', 'Én gang er normalt (svak forbindelse, en oppdatering). Send en rapport hvis det skjer ofte.'), need: e.n >= 3, fix: 'report' };
    if (k === 'load') return { t: L('A file didn’t load', 'En fil lastet ikke'), w: L('Usually a weak connection. If something looks broken: Reload newest version.', 'Som regel svak forbindelse. Ser noe ødelagt ut: Last inn nyeste versjon.'), need: e.n >= 3, fix: 'reload' };
    if (/Failed to fetch|NetworkError|Load failed|network connection was lost/i.test(m)) return { t: L('No connection for a moment', 'Ingen forbindelse et øyeblikk'), w: L('The internet dropped while something loaded. Nothing to do.', 'Internett falt ut mens noe lastet. Ingenting å gjøre.'), need: false };
    if (/QuotaExceeded|quota/i.test(m)) return { t: L('This browser’s storage is full', 'Lagringen i denne nettleseren er full'), w: L('Your data is still saved on the server. Free some space (Storage card) or clear old photos.', 'Dataene dine er fortsatt lagret på serveren. Frigjør plass (Lagring-kortet) eller slett gamle bilder.'), need: true };
    if (/ResizeObserver loop/i.test(m)) return { t: L('A harmless browser message', 'En ufarlig nettlesermelding'), w: L('Nothing to do.', 'Ingenting å gjøre.'), need: false, hide: true };
    if (k === 'script') return { t: L('A part of the dashboard failed to start', 'En del av dashbordet startet ikke'), w: L('Something on ', 'Noe på ') + pageName(e.p) + L(' may be missing. Try Reload newest version; if it stays, send a report.', ' kan mangle. Prøv Last inn nyeste versjon; send en rapport hvis det fortsetter.'), need: true, fix: 'reload' };
    return { t: L('An error in the dashboard', 'En feil i dashbordet'), w: e.n >= 3 ? L('It has happened ' + e.n + ' times – send a report.', 'Det har skjedd ' + e.n + ' ganger – send en rapport.') : L('Once is usually nothing. If something didn’t work, send a report.', 'Én gang er som regel ingenting. Send en rapport hvis noe ikke virket.'), need: e.n >= 3, fix: 'report' };
  }
  function groups(days) {
    var since = Date.now() - (days || 7) * 864e5, by = {};
    var cv = D.ver ? D.ver() : '';
    D.list().filter(function (e) { return e.t >= since && (!cv || !e.v || e.v === cv); }).forEach(function (e) {
      var key = e.k === 'lang' ? 'lang' : e.k + '|' + e.m, g = by[key];
      if (!g) g = by[key] = { k: e.k, m: e.m, a: e.a, n: 0, t: 0, pages: [], texts: [] };
      if (e.k === 'lang' && g.texts.length < 12) g.texts.push(e.m + (e.a ? ' (' + e.p + ' · ' + e.a + ')' : ' (' + e.p + ')'));
      g.n += e.n || 1; if (e.t > g.t) { g.t = e.t; g.a = e.a || g.a; }
      if (g.pages.indexOf(e.p) < 0) g.pages.push(e.p);
    });
    return Object.keys(by).map(function (k) { var g = by[k], x = explain(g); g.x = x; return g; }).filter(function (g) { return !g.x.hide; })
      .sort(function (a, b) { return (b.x.need - a.x.need) || (b.t - a.t); });
  }

  /* ---------- the Worker: does it have the newest code? ---------- */
  var RAW = 'https://raw.githubusercontent.com/Jpme96/jplundberg.github.io/main/_cloudflare/worker.js';
  function probe(path, opt, ok) {
    var o = Object.assign({ credentials: 'same-origin', cache: 'no-store' }, opt || {});
    o.headers = Object.assign({ 'X-Diag-Probe': '1' }, (opt && opt.headers) || {});
    return fetch(path, o).then(function (r) {
      var res = { s: r.status, ok: r.status === 503 ? null : ok(r.status) };
      return /\/ping$/.test(path) && r.ok ? r.json().then(function (j) { res.j = j; return res; }, function () { return res; }) : res;
    }, function () { return { s: 0, ok: null }; });
  }
  function checkWorker() {
    busy.worker = true; draw();
    return Promise.all([
      probe('/cmd/api/ping', null, function (s) { return s === 200; }),
      probe('/cmd/api/article', null, function (s) { return s === 400; }),
      probe('/cmd/api/article', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{"paths":[]}' }, function (s) { return s === 400; }),
      probe('/cmd/api/backup', null, function (s) { return s !== 404; }),
      probe('/cmd/api/recipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, function (s) { return s !== 404; })
    ]).then(function (r) {
      var names = [L('Server answers', 'Serveren svarer'), L('Writing articles', 'Skrive artikler'), L('Deleting articles', 'Slette artikler'), L('Backup email', 'Sikkerhetskopi på e-post'), L('Recipe from a link', 'Oppskrift fra lenke')];
      worker = { t: Date.now(), items: r.map(function (x, i) { return { n: names[i], ok: x.ok, s: x.s }; }), cron: r[0].j && 'cron' in r[0].j ? (+r[0].j.cron || 0) : null };
      worker.down = r[0].ok === false || r[0].s === 0;
      worker.old = !worker.down && r.slice(1).some(function (x) { return x.ok === false; });
      try { localStorage.setItem('dash.diagWorker', JSON.stringify(worker)); } catch (e) {}
      busy.worker = false; draw();
    });
  }
  function copyWorker(btn) {
    var setB = function (h) { if (btn) btn.innerHTML = h; };
    setB('<i class="bi bi-hourglass-split"></i> ' + L('Copying …', 'Kopierer …'));
    var get = fetch(RAW, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); });
    var ok = function () { setB('<i class="bi bi-check-lg"></i> ' + L('Copied – paste it in Cloudflare', 'Kopiert – lim den inn i Cloudflare')); };
    var fail = function () { setB('<i class="bi bi-box-arrow-up-right"></i> ' + L('Open the code instead', 'Åpne koden i stedet')); if (btn) btn.dataset.dgopen = RAW; };
    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {   /* Safari wants the clipboard promise right in the tap */
        navigator.clipboard.write([new ClipboardItem({ 'text/plain': get.then(function (t) { return new Blob([t], { type: 'text/plain' }); }) })]).then(ok, function () { get.then(function (t) { return navigator.clipboard.writeText(t); }).then(ok, fail); });
        return;
      }
    } catch (e) {}
    get.then(function (t) { return navigator.clipboard.writeText(t); }).then(ok, fail);
  }

  /* ---------- this device ---------- */
  function device() {
    var ua = navigator.userAgent, out = {};
    out.os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : L('other', 'annet');
    var v = (ua.match(/Version\/([\d.]+)/) || [])[1], cv = (ua.match(/(?:Chrome|CriOS)\/([\d]+)/) || [])[1], fv = (ua.match(/(?:Firefox|FxiOS)\/([\d]+)/) || [])[1], ev = (ua.match(/Edg\/([\d]+)/) || [])[1];
    out.browser = ev ? 'Edge ' + ev : cv ? 'Chrome ' + cv : fv ? 'Firefox ' + fv : /Safari/.test(ua) ? 'Safari ' + (v || '') : L('other', 'annet');
    out.app = !!((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone);
    out.screen = innerWidth + ' × ' + innerHeight + ' px';
    out.online = navigator.onLine !== false;
    out.notif = window.Notification ? Notification.permission : 'unsupported';
    try { out.faceSet = !!localStorage.getItem('dash.pk'); } catch (e) { out.faceSet = false; }
    var jobs = [];
    jobs.push(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function (x) { out.face = x; }, function () { out.face = false; }) : Promise.resolve(out.face = false));
    jobs.push(navigator.storage && navigator.storage.estimate ? navigator.storage.estimate().then(function (e) { out.used = e.usage; out.quota = e.quota; }, function () {}) : Promise.resolve());
    jobs.push(window.caches ? caches.keys().then(function (k) {
      var v2 = k.filter(function (x) { return /^cmd-v/.test(x); }).sort().pop(); out.version = v2 || '';
      return v2 ? caches.open(v2).then(function (c) { return c.keys(); }).then(function (r) { out.offline = r.filter(function (q) { return /\/cmd\/[a-z]*\/?$/.test(new URL(q.url).pathname); }).length; }) : null;
    }).catch(function () {}) : Promise.resolve());
    jobs.push(navigator.serviceWorker && navigator.serviceWorker.getRegistration ? navigator.serviceWorker.getRegistration('/cmd/').then(function (r) { out.sw = !!(r && r.active); out.swWaiting = !!(r && r.waiting); }, function () {}) : Promise.resolve());
    return Promise.all(jobs).then(function () { dev = out; return out; });
  }
  function mb(b) { return b > 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((b || 0) / 1024)) + ' kB'; }
  function speeds() {
    var s = D.speed();
    return Object.keys(s).map(function (p) { var l = (s[p] || []).slice().sort(function (a, b) { return a - b; }); return { p: p, med: l[Math.floor(l.length / 2)] || 0, last: (s[p] || []).slice(-1)[0] || 0, n: l.length }; })
      .filter(function (x) { return x.n; }).sort(function (a, b) { return b.med - a.med; });
  }

  /* ---------- what needs you, in one list ---------- */
  function needs() {
    var out = [], st = D.state(), chk = st.check;
    var FX = { sync: 'sync', pending: 'sync', backup: 'backup', orphan: 'orphan', files: 'check', health: null };
    if (chk && chk.issues) chk.issues.forEach(function (x) { out.push({ t: x.t, fix: FX[x.id] || null }); });
    var V = window.Vault, ss = V && V.syncState ? V.syncState() : st.syncState;
    if (ss === 'off' && !(chk && chk.issues.some(function (x) { return x.id === 'sync'; }))) out.push({ t: L('Sync is off on this device – changes stay here.', 'Synkronisering er av på denne enheten – endringer blir her.'), fix: 'sync' });
    if (worker && worker.old) out.push({ t: L('The Cloudflare Worker runs older code – some features won’t work until you paste the newest.', 'Cloudflare-workeren kjører eldre kode – noen funksjoner virker ikke før du limer inn den nyeste.'), fix: 'worker' });
    if (worker && worker.down) out.push({ t: L('The server didn’t answer the check.', 'Serveren svarte ikke på sjekken.'), fix: 'check' });
    if (worker && worker.cron === 0) out.push({ t: L('Reminders: the 5-minute timer on the Worker has never run. Cloudflare → the Worker → Settings → Triggers → add Cron */5 * * * *.', 'Påminnelser: 5-minutters-timeren på workeren har aldri kjørt. Cloudflare → workeren → Settings → Triggers → legg til Cron */5 * * * *.'), fix: 'checkworker' });
    else if (worker && worker.cron && Date.now() - worker.cron > 3 * 36e5) out.push({ t: L('Reminders: the Worker’s 5-minute timer last ran ' + ago(worker.cron) + ' – reminders may not arrive.', 'Påminnelser: workerens 5-minutters-timer kjørte sist ' + ago(worker.cron) + ' – påminnelser kommer kanskje ikke fram.'), fix: 'checkworker' });
    if (dev && dev.swWaiting) out.push({ t: L('A newer version of the app is ready.', 'En nyere versjon av appen er klar.'), fix: 'reload' });
    groups(2).filter(function (g) { return g.x.need; }).slice(0, 4).forEach(function (g) { out.push({ t: g.x.t + (g.pages.length ? ' · ' + g.pages.map(pageName).join(', ') : ''), fix: g.x.fix || 'report', g: g }); });
    if (test && test.done) test.res.filter(function (r) { return r.issues.length; }).forEach(function (r) { out.push({ t: L('Test: ', 'Test: ') + pageName(r.p) + ' – ' + r.issues[0], fix: 'report' }); });
    return out;
  }
  var FIX = { backup: ['cloud-arrow-down', L('Download backup', 'Last ned sikkerhetskopi')], orphan: ['trash3', L('Remove them', 'Fjern dem')], sync: ['arrow-repeat', L('Sync now', 'Synk nå')], reload: ['arrow-clockwise', L('Reload newest version', 'Last inn nyeste versjon')], worker: ['clipboard', L('Copy the newest Worker', 'Kopier nyeste worker')], report: ['send', L('Report it', 'Rapporter')], check: ['arrow-repeat', L('Check again', 'Sjekk igjen')] };

  /* ---------- drawing ---------- */
  function draw() {
    if (!host) return;
    var list = needs(), gs = groups(7), sp = speeds(), d = dev || {};
    var h = '<div class="dgu">';
    /* 1. the answer */
    h += '<section class="card cr-card dgu-top ' + (list.length ? 'bad' : 'ok') + '"><div class="dgu-ans"><span class="dgu-dot"></span><div><b>' + (list.length ? (list.length === 1 ? L('1 thing needs you', '1 ting trenger deg') : list.length + L(' things need you', ' ting trenger deg')) : L('Everything is fine', 'Alt er i orden')) + '</b>' +
      '<small>' + L('Checked ', 'Sjekket ') + ago(Math.max((D.state().check || {}).t || 0, (worker || {}).t || 0)) + L(' · watches for errors, freezes, failed calls and broken screens on this device', ' · følger med på feil, frys, mislykkede kall og ødelagte skjermbilder på denne enheten') + '</small></div></div>' +
      (list.length ? '<ul class="dgu-needs">' + list.map(function (x, i) { var f = x.fix && FIX[x.fix]; return '<li><i class="bi bi-exclamation-circle"></i><span>' + esc(x.t) + '</span>' + '<button type="button" class="icon-btn sm dgu-cp" data-dgfix="copyone" data-i="' + i + '" aria-label="' + L('Copy', 'Kopier') + '"><i class="bi bi-clipboard"></i></button>' + (f ? '<button type="button" class="text-btn" data-dgfix="' + x.fix + '" data-i="' + i + '"><i class="bi bi-' + f[0] + '"></i> ' + f[1] + '</button>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="dgu-acts">' + (list.length ? '<button type="button" class="pill-btn" data-dgfix="copyall"><i class="bi bi-clipboard"></i> ' + L('Copy all', 'Kopier alt') + '</button>' : '') + '<button type="button" class="' + (list.length ? 'text-btn' : 'pill-btn') + '" data-dgfix="report"><i class="bi bi-send"></i> ' + L('Report a problem', 'Rapporter et problem') + '</button>' +
        '<button type="button" class="text-btn" data-dgfix="check"' + (busy.check ? ' disabled' : '') + '><i class="bi bi-arrow-repeat' + (busy.check ? ' cr-spin' : '') + '"></i> ' + L('Check again', 'Sjekk igjen') + '</button>' +
        '<button type="button" class="text-btn" data-dgfix="sync"><i class="bi bi-cloud-arrow-up"></i> ' + L('Sync now', 'Synk nå') + '</button>' +
        '<button type="button" class="text-btn" data-dgfix="test"' + (test && !test.done ? ' disabled' : '') + '><i class="bi bi-ui-checks-grid"></i> ' + L('Test everything', 'Test alt') + '</button>' +
        '<button type="button" class="text-btn" data-dgfix="reload"><i class="bi bi-arrow-clockwise"></i> ' + L('Reload newest version', 'Last inn nyeste versjon') + '</button></div></section>';
    h += '<div class="cr-grid dgu-grid">';
    /* test results */
    if (test) {
      h += '<section class="card cr-card cr-wide"><div class="card-head"><h2><i class="bi bi-ui-checks-grid"></i> ' + L('Test everything', 'Test alt') + '</h2><div class="head-actions">' + (test.done ? '<small class="muted">' + ago(test.t) + '</small>' : '') + '</div></div>' +
        (test.done ? '' : '<div class="cr-prog"><span style="width:' + Math.round(test.res.length / test.pages.length * 100) + '%"></span></div><p class="cr-sub">' + L('Opening ', 'Åpner ') + esc(pageName((test.pages[test.res.length] || [])[0] || '')) + ' … ' + L('(keep this page open)', '(hold denne siden åpen)') + '</p>') +
        '<ul class="dgu-test">' + test.res.map(function (r) { return '<li class="' + (r.issues.length ? 'bad' : r.skip ? 'skip' : 'ok') + '"><i class="bi bi-' + (r.issues.length ? 'x-circle' : r.skip ? 'dash-circle' : 'check-circle') + '"></i><b>' + esc(pageName(r.p)) + '</b><span>' + (r.skip ? esc(r.skip) : r.issues.length ? esc(r.issues.join(' · ')) : L('OK', 'OK') + (r.ms ? ' · ' + (r.ms / 1000).toFixed(1) + ' s' : '')) + '</span></li>'; }).join('') + '</ul></section>';
    }
    /* problems found */
    h += '<section class="card cr-card"><div class="card-head"><h2><i class="bi bi-bug"></i> ' + L('Problems found', 'Problemer funnet') + '</h2><div class="head-actions">' + (gs.length ? '<button type="button" class="icon-btn sm" data-dgfix="clear" aria-label="' + L('Clear the list', 'Tøm listen') + '"><i class="bi bi-trash3"></i></button>' : '') + '</div></div>' +
      (gs.length ? '<ul class="dgu-probs">' + gs.slice(0, 12).map(function (g) {
        return '<li class="' + (g.x.need ? 'need' : '') + '"><div class="dgu-ph"><b>' + esc(g.x.t) + '</b><small>' + esc(g.pages.map(pageName).join(', ')) + ' · ' + ago(g.t) + (g.n > 1 ? ' · ×' + g.n : '') + '</small></div><p>' + esc(g.x.w) + '</p>' +
          '<details><summary>' + L('Technical', 'Teknisk') + '</summary><code>' + esc(g.k + ': ' + g.m + (g.a ? ' — ' + g.a : '')) + '</code></details></li>';
      }).join('') + '</ul>' : '<p class="cr-okline"><i class="bi bi-check-circle-fill"></i> ' + L('Nothing in the last 7 days.', 'Ingenting de siste 7 dagene.') + '</p>') + '</section>';
    /* the Worker */
    h += '<section class="card cr-card"><div class="card-head"><h2><i class="bi bi-hdd-network"></i> ' + L('Server (Worker)', 'Server (worker)') + '</h2><div class="head-actions"><button type="button" class="icon-btn sm" data-dgfix="checkworker" aria-label="' + L('Check the Worker', 'Sjekk workeren') + '"' + (busy.worker ? ' disabled' : '') + '><i class="bi bi-arrow-clockwise' + (busy.worker ? ' cr-spin' : '') + '"></i></button></div></div>' +
      (worker ? '<ul class="cr-list">' + worker.items.map(function (x) { return '<li><span>' + esc(x.n) + '</span><b class="' + (x.ok === false ? 'neg' : '') + '">' + (x.ok === true ? '<i class="bi bi-check-lg dgu-ok"></i>' : x.ok === false ? L('Missing', 'Mangler') : '–') + '</b></li>'; }).join('') + '</ul>' +
        (worker.old ? '<div class="dgu-steps"><b>' + L('Paste the newest Worker (2 minutes)', 'Lim inn nyeste worker (2 minutter)') + '</b><ol><li>' + L('Tap the button to copy the code.', 'Trykk på knappen for å kopiere koden.') + '</li><li>' + L('Cloudflare → Workers & Pages → dashboard-sync → Edit code.', 'Cloudflare → Workers & Pages → dashboard-sync → Edit code.') + '</li><li>' + L('Select all, paste, Deploy. Then Check again here.', 'Merk alt, lim inn, Deploy. Sjekk så igjen her.') + '</li></ol><button type="button" class="pill-btn" data-dgfix="worker"><i class="bi bi-clipboard"></i> ' + L('Copy the newest Worker', 'Kopier nyeste worker') + '</button></div>' : worker.down ? '' : '<p class="cr-okline"><i class="bi bi-check-circle-fill"></i> ' + L('Up to date', 'Oppdatert') + ' · ' + ago(worker.t) + '</p>')
        : '<p class="muted">' + L('Checking …', 'Sjekker …') + '</p>') + '</section>';
    /* this device */
    h += '<section class="card cr-card"><div class="card-head"><h2><i class="bi bi-phone"></i> ' + L('This device', 'Denne enheten') + '</h2></div><ul class="cr-list">' +
      '<li><span>' + L('Device & browser', 'Enhet og nettleser') + '</span><b>' + esc((d.os || '–') + ' · ' + (d.browser || '')) + '</b></li>' +
      '<li><span>' + L('Home-screen app', 'App på Hjem-skjermen') + '</span><b>' + (d.app ? L('Yes', 'Ja') : L('No (browser)', 'Nei (nettleser)')) + '</b></li>' +
      '<li><span>Face ID / Touch ID</span><b>' + (d.faceSet ? L('On', 'På') : d.face ? L('Available, off', 'Tilgjengelig, av') : L('Not available', 'Ikke tilgjengelig')) + '</b></li>' +
      '<li><span>' + L('App version', 'App-versjon') + '</span><b>' + esc((d.version || '–').replace('cmd-', '')) + '</b></li>' +
      '<li><span>' + L('Works offline', 'Virker uten nett') + '</span><b class="' + (d.offline ? '' : 'neg') + '">' + (d.offline ? d.offline + L(' pages saved', ' sider lagret') : L('Not yet', 'Ikke ennå')) + '</b></li>' +
      '<li><span>' + L('Storage used', 'Lagring brukt') + '</span><b>' + (d.used != null ? mb(d.used) + (d.quota ? ' / ' + mb(d.quota) : '') : '–') + '</b></li>' +
      '<li><span>' + L('Notifications', 'Varsler') + '</span><b>' + esc({ granted: L('Allowed', 'Tillatt'), denied: L('Blocked', 'Blokkert'), 'default': L('Not asked', 'Ikke spurt'), unsupported: L('Not supported', 'Ikke støttet') }[d.notif] || '–') + '</b></li>' +
      '<li><span>' + L('Screen', 'Skjerm') + '</span><b>' + esc(d.screen || '') + '</b></li></ul>' +
      (sp.length ? '<p class="cr-sub dgu-sph">' + L('Time to open each page (usual)', 'Tid for å åpne hver side (vanlig)') + '</p><ul class="dgu-speed">' + sp.map(function (x) { var w = Math.min(100, Math.round(x.med / 40)); return '<li><span>' + esc(pageName(x.p)) + '</span><i><em style="width:' + w + '%" class="' + (x.med > 2500 ? 'slow' : '') + '"></em></i><b>' + (x.med / 1000).toFixed(1) + ' s</b></li>'; }).join('') + '</ul>' : '') + '</section>';
    h += '</div></div>';
    host.innerHTML = h;
  }

  /* ---------- fixes ---------- */
  function reloadNewest() {
    toast('<i class="bi bi-arrow-clockwise"></i> ' + L('Getting the newest version …', 'Henter nyeste versjon …'));
    var jobs = [];
    if (window.caches) jobs.push(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return /^cmd-/.test(x); }).map(function (x) { return caches.delete(x); })); }));
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) jobs.push(navigator.serviceWorker.getRegistration('/cmd/').then(function (r) { return r && r.update(); }).catch(function () {}));
    Promise.all(jobs).catch(function () {}).then(function () { setTimeout(function () { location.reload(); }, 300); });
  }
  function syncNow(btn) {
    var V = window.Vault; if (!V || !V.sync) return;
    if (btn) btn.disabled = true;
    Promise.resolve(V.sync()).then(function () { toast('<i class="bi bi-cloud-check"></i> ' + L('Synced', 'Synkronisert')); }, function () { toast('<i class="bi bi-cloud-slash"></i> ' + L('Couldn’t sync right now – it tries again by itself', 'Fikk ikke synkronisert nå – prøver igjen selv')); })
      .then(function () { if (btn) btn.disabled = false; setTimeout(draw, 300); });
  }
  function checkAll() {
    busy.check = true; draw();
    D.scanNow();
    Promise.all([Promise.resolve(D.selfCheck(true)).catch(function () {}), checkWorker(), device()]).then(function () { busy.check = false; draw(); });
  }

  /* ---------- Test everything: every page in a hidden frame, one at a time ---------- */
  function runTest() {
    var on = PAGES.filter(function (p) { return p[0] === 'home' || p[0] === 'admin' || !document.documentElement.classList.contains('tab-off-' + p[0]); });
    test = { t: Date.now(), pages: on, res: [], done: false }; draw();
    var i = 0;
    (function next() {
      if (i >= on.length) { test.done = true; test.t = Date.now(); try { localStorage.setItem('dash.diagTest', JSON.stringify(test)); } catch (e) {} draw(); return; }
      var pg = on[i++], start = Date.now(), f = document.createElement('iframe'), finished = false;
      f.className = 'dgu-frame'; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
      f.style.width = Math.min(innerWidth, 1400) + 'px'; f.style.height = Math.max(700, innerHeight) + 'px';
      var finish = function (skip) {
        if (finished) return; finished = true;
        var issues = [], w = null, ms = 0;
        try { w = f.contentWindow; } catch (e) {}
        try {
          if (!skip && w && w.Diag) { w.Diag.scanNow(); }
          var de = w && w.document && w.document.documentElement;
          if (!skip && de && de.scrollWidth - w.innerWidth > 4) issues.push(L('wider than the screen', 'bredere enn skjermen'));
          if (!skip && w && w.performance) ms = Math.round(w.performance.now());
        } catch (e) {}
        D.list().filter(function (e) { return e.t >= start && e.p === pg[0] && e.k !== 'net' && e.k !== 'slow'; }).forEach(function (e) { var x = explain(e); if (!x.hide && issues.indexOf(x.t) < 0) issues.push(x.t); });
        test.res.push({ p: pg[0], issues: issues, skip: skip || '', ms: ms });
        f.remove(); draw(); setTimeout(next, 150);
      };
      f.onload = function () {
        var t0 = Date.now();
        (function wait() {
          var de = null; try { de = f.contentWindow.document.documentElement; } catch (e) {}
          if (de && de.classList.contains('unlocked')) { setTimeout(function () { finish(''); }, 2500); return; }
          if (Date.now() - t0 > 9000) { finish(de && de.querySelector('#lockPass') ? L('stayed locked – skipped', 'forble låst – hoppet over') : L('didn’t finish loading', 'ble ikke ferdig lastet')); return; }
          setTimeout(wait, 250);
        })();
      };
      setTimeout(function () { finish(L('didn’t finish loading', 'ble ikke ferdig lastet')); }, 20000);
      f.src = pg[1] + '?selftest=1';
      document.body.appendChild(f);
    })();
  }

  /* ---------- Report a problem ---------- */
  function fullReport(desc) {
    return Promise.resolve(D.report()).then(function (base) {
      var d = dev || {}, sp = speeds(), cr = D.crumbs(), gs = groups(7);
      var lines = [];
      if (desc) lines.push('Problem: ' + desc.trim(), '');
      lines.push(base, '',
        'Device: ' + (d.os || '?') + ' · ' + (d.browser || '?') + (d.app ? ' · home-screen app' : '') + ' · ' + (d.screen || '') + ' · Face ID ' + (d.faceSet ? 'on' : d.face ? 'available' : 'n/a') + ' · offline pages ' + (d.offline || 0) + ' · storage ' + (d.used != null ? mb(d.used) : '?') + ' · notifications ' + (d.notif || '?'),
        'Worker: ' + (worker ? worker.items.map(function (x) { return x.n + ' ' + (x.ok === true ? 'ok' : x.ok === false ? 'MISSING' : '?') + '(' + x.s + ')'; }).join(', ') : 'not checked'),
        'Page speed (median): ' + (sp.length ? sp.map(function (x) { return x.p + ' ' + (x.med / 1000).toFixed(1) + 's'; }).join(', ') : '–'),
        'Last taps: ' + (cr.length ? cr.map(function (x) { return x.p + ':' + x.a; }).join(' › ') : '–'));
      if (test && test.done) lines.push('Test everything (' + new Date(test.t).toISOString().slice(0, 16) + '): ' + test.res.map(function (r) { return r.p + ' ' + (r.skip ? 'skipped' : r.issues.length ? 'FAIL ' + r.issues.join('/') : 'ok'); }).join(', '));
      if (gs.length) { lines.push('Grouped (7 days):'); gs.forEach(function (g) { lines.push('- ' + g.k + ' ×' + g.n + ' [' + g.pages.join(',') + ']: ' + g.m + (g.a ? ' — ' + g.a : '')); }); }
      return lines.join('\n');
    });
  }
  /* one problem, or all of them, as text to paste to Claude (with the technical report) */
  function needText(x) {
    var t = '• ' + x.t;
    if (x.g) {
      t += '\n  ' + x.g.k + ' ×' + x.g.n + ' [' + x.g.pages.join(',') + '] last ' + new Date(x.g.t).toISOString().slice(0, 16).replace('T', ' ');
      if (x.g.texts && x.g.texts.length) t += '\n  ' + x.g.texts.join('\n  ');
      else t += ': ' + x.g.m + (x.g.a ? ' — ' + x.g.a : '');
    }
    return t;
  }
  function copyText(btn, tp) {
    var done = function () { if (btn) { var h = btn.innerHTML; btn.innerHTML = '<i class="bi bi-check-lg"></i>' + (btn.classList.contains('icon-btn') ? '' : ' ' + L('Copied – paste it to Claude', 'Kopiert – lim det inn til Claude')); setTimeout(function () { btn.innerHTML = h; }, 1800); } };
    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) { navigator.clipboard.write([new ClipboardItem({ 'text/plain': tp.then(function (t) { return new Blob([t], { type: 'text/plain' }); }) })]).then(done, function () { tp.then(fallback).then(done); }); return; }
    } catch (x) {}
    tp.then(function (t) { return navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t).catch(function () { fallback(t); }) : fallback(t); }).then(done);
  }
  function copyAll(btn) {
    var l = needs();
    copyText(btn, device().then(function () { return fullReport(''); }).then(function (rep) {
      return (l.length + ' thing(s) need me:\n' + l.map(needText).join('\n') + '\n\n' + rep);
    }));
  }
  function copyOne(btn, x) {
    if (!x) return;
    copyText(btn, Promise.resolve(D.report()).then(function (base) { return needText(x) + '\n\n' + base.split('\nErrors')[0]; }));
  }
  function reportSheet(prefill) {
    var bg = document.createElement('div'); bg.className = 'dgu-sheet'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true');
    bg.innerHTML = '<div class="dgu-box"><h3><i class="bi bi-send"></i> ' + L('Report a problem', 'Rapporter et problem') + '</h3>' +
      '<p class="muted">' + L('Write what happened in a sentence. The report adds the page, device, recent errors and your last taps – no amounts, names or personal data.', 'Skriv hva som skjedde i én setning. Rapporten legger til side, enhet, siste feil og de siste trykkene dine – ingen beløp, navn eller personlige data.') + '</p>' +
      '<textarea rows="4" placeholder="' + esc(L('e.g. The preview didn’t update when I changed my CV on the iPad', 'f.eks. Forhåndsvisningen ble ikke oppdatert da jeg endret CV-en på iPaden')) + '">' + esc(prefill || '') + '</textarea>' +
      '<label class="dgu-chk"><input type="checkbox" checked> ' + L('Include the technical report', 'Ta med den tekniske rapporten') + '</label>' +
      '<details class="dgu-peek"><summary>' + L('See what’s included', 'Se hva som er med') + '</summary><pre></pre></details>' +
      '<div class="dgu-sbar"><button type="button" class="text-btn" data-dgsx>' + L('Cancel', 'Avbryt') + '</button><span></span>' + (navigator.share ? '<button type="button" class="text-btn" data-dgshare><i class="bi bi-share"></i> ' + L('Share', 'Del') + '</button>' : '') +
      '<button type="button" class="pill-btn" data-dgcopy><i class="bi bi-clipboard"></i> ' + L('Copy for Claude', 'Kopier til Claude') + '</button></div></div>';
    document.body.appendChild(bg);
    var ta = bg.querySelector('textarea'), chk = bg.querySelector('input[type=checkbox]'), pre = bg.querySelector('pre');
    var text = function () { return chk.checked ? fullReport(ta.value) : Promise.resolve(ta.value.trim()); };
    device().then(function () { return fullReport(''); }).then(function (t) { pre.textContent = t; });
    setTimeout(function () { ta.focus(); }, 60);
    bg.addEventListener('click', function (e) {
      if (e.target === bg || e.target.closest('[data-dgsx]')) { bg.remove(); return; }
      var c = e.target.closest('[data-dgcopy]');
      if (c) {
        var tp = text();
        var done = function () { c.innerHTML = '<i class="bi bi-check-lg"></i> ' + L('Copied – paste it in the chat', 'Kopiert – lim det inn i chatten'); setTimeout(function () { bg.remove(); }, 1400); };
        try {
          if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) { navigator.clipboard.write([new ClipboardItem({ 'text/plain': tp.then(function (t) { return new Blob([t], { type: 'text/plain' }); }) })]).then(done, function () { tp.then(fallback).then(done); }); return; }
        } catch (x) {}
        tp.then(function (t) { return navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t).catch(function () { fallback(t); }) : fallback(t); }).then(done);
      }
      if (e.target.closest('[data-dgshare]')) text().then(function (t) { navigator.share({ title: 'Dashboard problem', text: t }).catch(function () {}); });
    });
    bg.addEventListener('keydown', function (e) { if (e.key === 'Escape') bg.remove(); });
  }
  function fallback(t) { var a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); }

  /* ---------- wiring ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-dgfix], [data-dgopen]'); if (!b || !host || !host.contains(b)) return;
    if (b.dataset.dgopen) { window.open(b.dataset.dgopen, '_blank', 'noopener'); return; }
    var f = b.dataset.dgfix, it = b.dataset.i != null ? needs()[+b.dataset.i] : null;
    if (f === 'report') reportSheet(it && it.g ? it.g.x.t + ' (' + it.g.pages.map(pageName).join(', ') + ')' : '');
    else if (f === 'check') checkAll();
    else if (f === 'checkworker') checkWorker();
    else if (f === 'sync') syncNow(b);
    else if (f === 'reload') reloadNewest();
    else if (f === 'worker') copyWorker(b);
    else if (f === 'test') runTest();
    else if (f === 'clear') { D.clear(); draw(); }
    else if (f === 'copyall') copyAll(b);
    else if (f === 'copyone') copyOne(b, it);
    else if (f === 'backup') { var bb = document.getElementById('stBackup'); if (bb) bb.click(); else location.href = '/cmd/?settings=data'; setTimeout(checkAll, 2500); }
    else if (f === 'orphan') {
      var d0 = window.Vault.get(); if (!d0 || !d0.budget) return;
      var acc0 = d0.accounts || [], n0 = 0;
      d0.budget.fixed = (d0.budget.fixed || []).filter(function (x) { var keep = !(x && x.src === 'loan' && !acc0.some(function (a) { return 'loan-' + a.id === x.id; })); if (!keep) n0++; return keep; });
      window.Vault.save(d0); window.dispatchEvent(new Event('fin:change'));
      toast('<i class="bi bi-check2"></i> ' + L('Removed ' + n0 + ' old fixed cost(s)', 'Fjernet ' + n0 + ' gamle faste kostnad(er)')); checkAll();
    }
  });
  var drawT = null;
  window.addEventListener('diag:log', function () { clearTimeout(drawT); drawT = setTimeout(function () { if (host && host.offsetParent) draw(); }, 400); });
  window.addEventListener('sync:state', function () { if (host && host.offsetParent) draw(); });
  function mount(el) {
    if (host === el) return;
    host = el;
    try { worker = JSON.parse(localStorage.getItem('dash.diagWorker') || 'null'); } catch (e) {}
    try { var tt = JSON.parse(localStorage.getItem('dash.diagTest') || 'null'); if (tt && tt.done && Date.now() - tt.t < 864e5) test = tt; } catch (e) {}
    draw();
    device().then(draw);
    /* the Worker is checked again when the last check is over 10 minutes old (a new Cron Trigger shows up quickly) */
    if (!worker || Date.now() - worker.t > 10 * 6e4) checkWorker();
  }
  window.DiagUI = { mount: mount, report: function (t) { reportSheet(t); }, test: runTest, check: checkAll, draw: draw };
})();
