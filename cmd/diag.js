/* Diagnostics: catches errors, keeps a small log on this device, shows calm notices, and checks
   itself once a day (Settings → Diagnostics).
   - Every uncaught error and unhandled promise rejection goes into localStorage "dash.errlog"
     (newest 40, repeats counted). Messages are scrubbed: numbers, e-mail addresses and quoted text
     are masked, so no amounts, names or other personal data end up in the log or the report.
   - window.Diag.notice(id, text, action, fn): one calm message at the bottom with "Try again".
   - Sync (lock.js) and Apple Health (ahealth.js) report here; the self-check runs once a day after
     unlocking and only says something when a check fails.
   Loaded first on every page (head bundle), so it sees errors in everything after it. */
(function () {
  "use strict";
  var LOG = 'dash.errlog', ST = 'dash.diag', MAX = 40;
  var nb = function () { return !!(window.I18N && window.I18N.lang === 'nb'); };
  function L(en, no) { return nb() ? no : en; }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* no personal or financial data: mask numbers, e-mails, quoted text and long words */
  function scrub(s) {
    return String(s == null ? '' : s)
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
      .replace(/(["'“‘«])[^"'”’»]{1,}?(["'”’»])/g, '$1…$2')
      .replace(/https?:\/\/[^\s)]+/g, function (u) { try { return new URL(u).pathname.replace(/[^/]+\.js.*$/, function (f) { return f.split('?')[0]; }); } catch (e) { return '<url>'; } })
      .replace(/\d+([.,:\s]\d+)*/g, '#')
      .slice(0, 180);
  }
  function page() { var m = location.pathname.match(/\/cmd\/([a-z]+)\//); return m ? m[1] : 'home'; }
  function where(stack, file, line) {
    var m = String(stack || '').match(/\/cmd\/(?:dist\/)?([\w-]+\.js)[^:\s]*:(\d+)/);
    if (m) return m[1] + ':' + m[2];
    if (file) { var f = String(file).split('?')[0].split('/').pop(); return f + (line ? ':' + line : ''); }
    return '';
  }
  function log(kind, msg, at) {
    var l = readJSON(LOG, []); if (!Array.isArray(l)) l = [];
    var m = scrub(msg), a = String(at || '').slice(0, 60), now = Date.now();
    var hit = l.filter(function (x) { return x.k === kind && x.m === m && x.a === a; })[0];
    if (hit) { hit.n = (hit.n || 1) + 1; hit.t = now; hit.p = page(); }
    else l.push({ k: kind, m: m, a: a, p: page(), t: now, n: 1 });
    l.sort(function (x, y) { return x.t - y.t; });
    writeJSON(LOG, l.slice(-MAX));
    try { window.dispatchEvent(new Event('diag:log')); } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && t.tagName) {            // a script, style or image that didn't load
      var u = t.src || t.href || ''; if (!/\/cmd\//.test(u)) return;
      log('load', t.tagName.toLowerCase() + ' ' + u, '');
      return;
    }
    if (!e.message || /^Script error\.?$/.test(e.message)) return;
    log('error', e.message, where(e.error && e.error.stack, e.filename, e.lineno));
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason; if (!r) return;
    if (r && r.name === 'AbortError') return;
    log('promise', r.message || String(r), where(r.stack));
  });
  /* the bundles wrap each file in try/catch (cmd/build.py) and report here */
  window.__dlog = function (e, file) { log('script', (e && e.message) || String(e), file + (e && e.stack ? ' ' + where(e.stack) : '')); };

  /* status marks (no personal data): last good sync, health pull, self-check … */
  function mark(k, v) { var s = readJSON(ST, {}); s[k] = v === undefined ? Date.now() : v; writeJSON(ST, s); }
  function state() { return readJSON(ST, {}); }

  /* ---------- one calm notice at a time ---------- */
  var cur = null;
  function notice(id, text, action, fn, icon) {
    if (!document.body) { document.addEventListener('DOMContentLoaded', function () { notice(id, text, action, fn, icon); }); return; }
    var el = document.getElementById('dgNote');
    if (!el) {
      el = document.createElement('div'); el.id = 'dgNote'; el.className = 'dg-note'; el.setAttribute('role', 'status'); el.setAttribute('data-noi18n', '');
      document.body.appendChild(el);
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-dgx]')) { hide(cur && cur.id); return; }
        var b = e.target.closest('[data-dgact]'); if (!b || !cur) return;
        var f = cur.fn; hide(cur.id); if (f) try { f(); } catch (x) { log('error', x.message, 'notice'); }
      });
    }
    cur = { id: id, fn: fn };
    el.innerHTML = '<i class="bi bi-' + (icon || 'cloud-slash') + '"></i><span>' + esc(text) + '</span>' +
      (action ? '<button type="button" class="dg-act" data-dgact>' + esc(action) + '</button>' : '') +
      '<button type="button" class="dg-x" data-dgx aria-label="' + L('Close', 'Lukk') + '"><i class="bi bi-x"></i></button>';
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('show'); });
  }
  function hide(id) {
    var el = document.getElementById('dgNote');
    if (!el || !cur || (id && cur.id !== id)) return;
    cur = null; el.classList.remove('show'); setTimeout(function () { if (!cur) el.hidden = true; }, 300);
  }

  /* ---------- retry with backoff (used for Worker calls) ---------- */
  function retry(fn, opts) {
    opts = opts || {};
    var waits = opts.waits || [3000, 10000, 30000], n = 0;
    return new Promise(function (resolve, reject) {
      (function go() {
        Promise.resolve().then(fn).then(resolve, function (e) {
          if (n >= waits.length || (opts.stop && opts.stop(e))) { reject(e); return; }
          setTimeout(go, waits[n++]);
        });
      })();
    });
  }

  /* ---------- the daily self-check ---------- */
  function dkey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function daysAgo(t) { return t ? (Date.now() - t) / 864e5 : Infinity; }
  function selfCheck(manual) {
    var V = window.Vault, d = V && V.get && V.get(), issues = [], checks = [];
    function bad(id, en, no) { issues.push({ id: id, t: L(en, no) }); }
    if (!d) return Promise.resolve(null);
    /* 1. data shape */
    var shape = 0;
    ['expenses', 'savings', 'networth', 'bills'].forEach(function (k) { if (d[k] != null && !Array.isArray(d[k])) shape++; });
    if (Array.isArray(d.expenses)) d.expenses.forEach(function (e) { if (!e || typeof e !== 'object' || !/^\d{4}-\d{2}-\d{2}/.test(e.date || '') || !isFinite(+e.amount)) shape++; });
    ['dash.todos', 'dash.notes', 'dash.goals', 'dash.links'].forEach(function (k) { var v = readJSON(k, null); if (v != null && !Array.isArray(v) && typeof v !== 'object') shape++; });
    ['dash.settings', 'dash.tools', 'dash.profile', 'dash.travel', 'dash.calendar', 'dash.habits'].forEach(function (k) { var v = readJSON(k, null); if (v != null && (typeof v !== 'object' || Array.isArray(v))) shape++; });
    checks.push({ id: 'shape', ok: !shape });
    if (shape) bad('shape', shape + ' saved item(s) look damaged. The pages skip them – nothing else is affected.', shape + ' lagrede ting ser ødelagte ut. Sidene hopper over dem – ingenting annet påvirkes.');
    /* 2. sync recent */
    var s = state(), syncAge = daysAgo(s.syncOk), everSynced = !!s.syncOk;
    checks.push({ id: 'sync', ok: !everSynced || syncAge < 2 });
    if (everSynced && syncAge >= 2) bad('sync', 'Not synced for ' + Math.floor(syncAge) + ' days. Changes are only on this device.', 'Ikke synkronisert på ' + Math.floor(syncAge) + ' dager. Endringene finnes bare på denne enheten.');
    /* 3. Apple Health import recent */
    var F = window.Features, hOn = F && F.on && F.on('ahealth');
    if (hOn) {
      var days = (d.health && d.health.days) || {}, last = Object.keys(days).sort().pop(), age = last ? (Date.now() - new Date(last + 'T12:00').getTime()) / 864e5 : Infinity;
      checks.push({ id: 'health', ok: age < 3 });
      if (age >= 3 && last) bad('health', 'No Apple Health numbers since ' + last.split('-').reverse().join('.') + '. Check the Shortcut’s automation on the iPhone.', 'Ingen tall fra Apple Helse siden ' + last.split('-').reverse().join('.') + '. Sjekk automasjonen til snarveien på iPhonen.');
    }
    /* 4. errors today */
    var errs = readJSON(LOG, []).filter(function (x) { return daysAgo(x.t) < 1; }).reduce(function (a, x) { return a + (x.n || 1); }, 0);
    checks.push({ id: 'errors', ok: errs < 10 });
    if (errs >= 10) bad('errors', errs + ' errors in the last day – see Settings → Diagnostics.', errs + ' feil siste døgn – se Innstillinger → Diagnostikk.');
    /* 5. the server's daily copy */
    var snap = (everSynced && navigator.onLine !== false) ? fetch('/cmd/api/vault?snaps=1', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        var list = (j && (j.snaps || j.items || j)) || [];
        if (!Array.isArray(list)) return;
        var dates = list.map(function (x) { return typeof x === 'string' ? x : x && x.date; }).filter(Boolean).sort();
        var newest = dates.pop(), age = newest ? (Date.now() - new Date(newest + 'T12:00').getTime()) / 864e5 : Infinity;
        checks.push({ id: 'snap', ok: age < 3 });
        if (age >= 3) bad('snap', newest ? 'The server’s newest daily copy is from ' + newest.split('-').reverse().join('.') + '.' : 'The server has no daily copies yet.', newest ? 'Serverens nyeste daglige kopi er fra ' + newest.split('-').reverse().join('.') + '.' : 'Serveren har ingen daglige kopier ennå.');
      }).catch(function () {}) : Promise.resolve();
    return snap.then(function () {
      var res = { t: Date.now(), d: dkey(new Date()), issues: issues, checks: checks };
      mark('check', res);
      if (issues.length && !manual) tell(issues);
      try { window.dispatchEvent(new Event('diag:log')); } catch (e) {}
      return res;
    });
  }
  function tell(issues) {
    var t = issues.length === 1 ? issues[0].t : L(issues.length + ' things need a look: ', issues.length + ' ting bør sjekkes: ') + issues.map(function (x) { return x.t.split('.')[0]; }).join(' · ');
    notice('check', t, L('Details', 'Detaljer'), openPanel, 'clipboard2-pulse');
    /* a phone notification too, when they're switched on – no titles or numbers */
    try {
      if (window.Notification && Notification.permission === 'granted' && navigator.serviceWorker && document.hidden)
        navigator.serviceWorker.ready.then(function (r) { r.showNotification(L('Dashboard check', 'Dashbord-sjekk'), { body: L('Something needs a look – open Settings → Diagnostics.', 'Noe bør sjekkes – åpne Innstillinger → Diagnostikk.'), tag: 'selfcheck', icon: '/cmd/assets/icons/icon-192.png' }); });
    } catch (e) {}
  }
  function openPanel() {
    var b = document.getElementById('settingsBtn') || document.querySelector('.me-btn');
    if (b) { b.click(); setTimeout(function () { var g = document.querySelector('[data-go="diag"]'); if (g) g.click(); }, 320); }
  }
  function startCheck() {
    var s = state(); if (s.check && s.check.d === dkey(new Date())) return;
    setTimeout(function () { if (window.Vault && window.Vault.get()) selfCheck(false); }, 9000);
  }
  function hook() { if (window.Vault && window.Vault.onUnlock) window.Vault.onUnlock(startCheck); else setTimeout(hook, 200); }
  hook();
  window.addEventListener('sync:state', function (e) { if (e.detail === 'ok') mark('syncOk'); mark('syncState', e.detail); });

  /* ---------- the Diagnostics page in Settings ---------- */
  function ago(t) {
    if (!t) return L('never', 'aldri');
    var m = Math.round((Date.now() - t) / 6e4);
    if (m < 1) return L('just now', 'akkurat nå');
    if (m < 60) return L(m + ' min ago', 'for ' + m + ' min siden');
    var h = Math.round(m / 60); if (h < 36) return L(h + ' h ago', 'for ' + h + ' t siden');
    return L(Math.round(h / 24) + ' days ago', 'for ' + Math.round(h / 24) + ' dager siden');
  }
  function swVersion() {
    if (!window.caches) return Promise.resolve('');
    return caches.keys().then(function (k) { return k.filter(function (x) { return /^cmd-v/.test(x); }).join(', '); }).catch(function () { return ''; });
  }
  function bundle() { var s = document.querySelector('script[src*="dist/tail.js"]'); var m = s && s.src.match(/v=(\w+)/); return m ? m[1] : ''; }
  function info() {
    var d = window.Vault && window.Vault.get && window.Vault.get(), s = state();
    var hl = d && d.health ? d.health.last : 0, hdays = d && d.health && d.health.days ? Object.keys(d.health.days).sort() : [];
    var V = window.Vault, st = V && V.syncState ? V.syncState() : s.syncState;
    return swVersion().then(function (sw) {
      return { sync: st || '–', syncOk: s.syncOk, healthLast: hl, healthDay: hdays[hdays.length - 1] || '', healthPull: s.healthPull, healthFail: s.healthFail,
        sw: sw || L('not installed', 'ikke installert'), bundle: bundle(), check: s.check, errs: readJSON(LOG, []) };
    });
  }
  function report() {
    return info().then(function (i) {
      var ua = navigator.userAgent, os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : 'other';
      var br = /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'other';
      var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
      var lines = ['Dashboard diagnostics ' + new Date().toISOString().slice(0, 16).replace('T', ' '),
        'App: ' + i.sw + ' · bundle ' + i.bundle + ' · page ' + page() + ' · ' + os + ' ' + br + (standalone ? ' (home screen app)' : '') + ' · ' + innerWidth + 'px',
        'Sync: ' + i.sync + ' · last OK ' + (i.syncOk ? new Date(i.syncOk).toISOString().slice(0, 16) : 'never') + ' · online ' + (navigator.onLine !== false),
        'Apple Health: last import ' + (i.healthLast ? new Date(i.healthLast).toISOString().slice(0, 16) : 'never') + ' · newest day ' + (i.healthDay || '–') + (i.healthFail ? ' · last failed fetch ' + new Date(i.healthFail).toISOString().slice(0, 16) : ''),
        'Self-check: ' + (i.check ? i.check.d + ' ' + (i.check.checks || []).map(function (c) { return c.id + (c.ok ? ' ok' : ' FAIL'); }).join(', ') : 'not run'),
        'Errors (' + i.errs.length + '):'];
      i.errs.slice().reverse().forEach(function (e) { lines.push('- ' + new Date(e.t).toISOString().slice(5, 16).replace('T', ' ') + ' ' + e.k + ' ' + e.p + ' ' + (e.a || '') + ' ×' + (e.n || 1) + ': ' + e.m); });
      return lines.join('\n');
    });
  }
  function render() {
    var box = document.getElementById('dgBody'); if (!box) return;
    info().then(function (i) {
      var syncTxt = { ok: L('Synced', 'Synkronisert'), busy: L('Syncing …', 'Synkroniserer …'), offline: L('Offline – saved on this device', 'Frakoblet – lagret på denne enheten'), off: L('Not syncing', 'Synkroniserer ikke') }[i.sync] || i.sync;
      var c = i.check, cTxt = c ? (c.issues.length ? c.issues.map(function (x) { return esc(x.t); }).join('<br>') : L('All good', 'Alt i orden')) : L('Not run yet', 'Ikke kjørt ennå');
      var row = function (ic, col, label, val, sub) { return '<div class="st-row dg-row"><span class="st-ico" style="--c:' + col + '"><i class="bi bi-' + ic + '"></i></span><span class="st-label">' + label + '<small>' + sub + '</small></span><span class="dg-val">' + val + '</span></div>'; };
      var errs = i.errs.slice().reverse();
      box.innerHTML =
        '<section class="st-group">' +
          row('cloud-check', '#11a597', L('Sync', 'Synkronisering'), esc(syncTxt), L('Last OK ', 'Sist OK ') + ago(i.syncOk)) +
          row('apple', '#e66767', L('Apple Health', 'Apple Helse'), i.healthDay ? esc(i.healthDay.split('-').reverse().slice(0, 2).join('.')) : '–', L('Last import ', 'Siste import ') + ago(i.healthLast) + (i.healthFail && (!i.healthPull || i.healthFail > i.healthPull) ? L(' · last fetch failed ', ' · siste henting feilet ') + ago(i.healthFail) : '')) +
          row('clipboard2-pulse', c && c.issues.length ? '#d95926' : '#22b35e', L('Daily self-check', 'Daglig sjekk'), c ? (c.issues.length ? '<b class="dg-bad">' + c.issues.length + '</b>' : '<i class="bi bi-check-lg dg-ok"></i>') : '–', cTxt + (c ? ' · ' + ago(c.t) : '')) +
          row('box-seam', '#8a6fdf', L('App version', 'App-versjon'), esc(i.sw.replace('cmd-', '')), L('Scripts ', 'Skript ') + esc(i.bundle)) +
        '</section>' +
        '<div class="dg-acts"><button type="button" class="pill-btn" id="dgCopy"><i class="bi bi-clipboard"></i> ' + L('Copy report', 'Kopier rapport') + '</button>' +
          '<button type="button" class="text-btn" id="dgRun"><i class="bi bi-arrow-repeat"></i> ' + L('Check now', 'Sjekk nå') + '</button></div>' +
        '<p class="st-sub ap-sub"><i class="bi bi-bug"></i> ' + L('Recent errors', 'Siste feil') + ' <span class="st-hint">' + L('On this device · numbers and names are masked', 'På denne enheten · tall og navn er skjult') + '</span></p>' +
        '<section class="st-group"><ul class="st-inv dg-errs">' + (errs.length ? errs.slice(0, 15).map(function (e) {
          return '<li><span class="dg-et">' + esc(new Date(e.t).toLocaleString(nb() ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + ' · ' + esc(e.p) + (e.n > 1 ? ' · ×' + e.n : '') + '</span><code>' + esc(e.m) + '</code>' + (e.a ? '<small>' + esc(e.a) + '</small>' : '') + '</li>';
        }).join('') : '<li class="muted">' + L('No errors. Nice.', 'Ingen feil. Fint.') + '</li>') + '</ul>' +
        (errs.length ? '<button type="button" class="st-row st-btn" id="dgClear"><span><i class="bi bi-trash3"></i> ' + L('Clear the log', 'Tøm loggen') + '</span></button>' : '') + '</section>' +
        '<p class="st-intro st-after">' + L('The report has no amounts, names or other personal data – just versions, times and error messages with numbers masked. Paste it to Claude when something isn’t right.', 'Rapporten har ingen beløp, navn eller andre personlige data – bare versjoner, tidspunkter og feilmeldinger med tall skjult. Lim den inn til Claude når noe ikke stemmer.') + '</p>';
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-go="diag"]')) setTimeout(render, 0);
    if (e.target.closest('#dgCopy')) {
      var b = e.target.closest('#dgCopy');
      report().then(function (t) {
        var done = function () { b.innerHTML = '<i class="bi bi-check-lg"></i> ' + L('Copied', 'Kopiert'); setTimeout(render, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { fallback(t); done(); }); else { fallback(t); done(); }
      });
    }
    if (e.target.closest('#dgRun')) { var r = e.target.closest('#dgRun'); r.disabled = true; selfCheck(true).then(render); }
    if (e.target.closest('#dgClear')) { writeJSON(LOG, []); render(); }
  });
  function fallback(t) { var a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); }
  window.addEventListener('diag:log', function () { var pg = document.querySelector('.st-page[data-page="diag"]'); if (pg && !pg.hidden) render(); });

  window.Diag = { log: log, list: function () { return readJSON(LOG, []); }, clear: function () { writeJSON(LOG, []); }, mark: mark, state: state,
    notice: notice, hide: hide, retry: retry, selfCheck: selfCheck, report: report, scrub: scrub, render: render };
})();
