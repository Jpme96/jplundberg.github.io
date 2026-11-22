/* App bits shared by every /cmd page:
   - install as an app (service worker, so it opens fast and works offline once loaded)
   - a gentle monthly reminder to download an encrypted backup
   - Settings → Features: switch each part of the dashboard on or off */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- app install ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/cmd/sw.js', { scope: '/cmd/' }).catch(function () {});
    });
  }

  /* ---------- a page left open (the Mac, a tab for days) picks up a new version by itself ----------
     The version is CACHE in sw.js. When it changes, the page reloads the next time it's in the background or comes back –
     never while you're typing – so two devices never run different versions of the sync for long. */
  (function () {
    var mine = null, newer = false;
    /* the page you have may itself be the old one (it opens from the saved copy while the new one downloads – JP
       2026-11-20: "I had to reload twice"): compare the scripts this page runs with the ones on the server's page */
    function ver(html) { var m = String(html || '').match(/dist\/tail\.js\?v=([\w]+)/); return m ? m[1] : null; }
    var running = ver((document.querySelector('script[src*="dist/tail.js"]') || {}).src);
    function check() {
      return fetch(location.pathname, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok && !r.redirected ? r.text() : ''; }).then(function (t) {
        var v = ver(t); if (!v || !running) return;
        if (v !== running) { newer = true; bar(); }
      }, function () {});
    }
    /* "New version – Update": one tap loads it (the saved copy is fresh by then) */
    function bar() {
      if (document.getElementById('nvBar') || document.hidden) return;
      var el = document.createElement('div'); el.id = 'nvBar'; el.className = 'nv-bar'; el.setAttribute('role', 'status');
      el.innerHTML = '<i class="bi bi-stars"></i><span>' + (window.I18N ? I18N.k('ui.nv-ready', 'A new version of cmd is ready') : 'A new version of cmd is ready') + '</span><button type="button" class="pill-btn" data-nvgo>' + (window.I18N ? I18N.k('ui.nv-update', 'Update') : 'Update') + '</button><button type="button" class="icon-btn sm" data-nvx aria-label="Later"><i class="bi bi-x-lg"></i></button>';
      document.body.appendChild(el);
    }
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-nvgo]')) { var sw = navigator.serviceWorker, go = function () { location.reload(); }; if (sw && sw.getRegistration) sw.getRegistration('/cmd/').then(function (r) { return r && r.update(); }).then(function () { setTimeout(go, 300); }, go); else go(); return; }
      if (e.target.closest('[data-nvx]')) { var b0 = document.getElementById('nvBar'); if (b0) b0.remove(); }
    });
    window.__nvCheck = check;
    function busy() { var e = document.activeElement; return !!(e && (e.tagName === 'TEXTAREA' || e.tagName === 'INPUT' || e.isContentEditable) && String(e.value || e.textContent || '').trim()); }
    function maybe() { if (!newer || busy() || document.querySelector('.st-backdrop:not([hidden]) form, dialog[open]')) return; newer = false;
      var go = function () { location.reload(); }, sw = navigator.serviceWorker;
      if (sw && sw.getRegistration) sw.getRegistration('/cmd/').then(function (r) { return r && r.update(); }).then(function () { setTimeout(go, 700); }, go); else go(); }
    setTimeout(check, 2500);
    setInterval(function () { check().then(function () { if (document.hidden) maybe(); }); }, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) { if (newer) maybe(); return; } check().then(maybe); });
  })();

  /* ---------- backup reminder (home page) ---------- */
  var DAY = 864e5;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function backupNote() {
    var el = $('backupNote');
    if (!el) return;
    /* a backup taken on another device counts too */
    var vd = window.Vault && window.Vault.get && window.Vault.get();
    var last = Math.max(+lsGet('dash.lastBackup') || 0, +(vd && vd.lastBackup) || 0), snooze = +lsGet('dash.backupSnooze') || 0, now = Date.now();
    var first = +lsGet('dash.firstUse') || 0;
    if (!first) { lsSet('dash.firstUse', String(now)); first = now; }
    var due = last ? now - last > 30 * DAY : now - first > 7 * DAY;     // give a new setup a week first
    if (!due || now < snooze) { el.hidden = true; return; }
    var ago = last ? Math.floor((now - last) / DAY) : 0;
    el.innerHTML = '<i class="bi bi-shield-check"></i><span><b>Time for a backup.</b> ' +
      (last ? 'Your last one was ' + ago + ' days ago.' : 'You haven’t downloaded one yet.') +
      ' It’s encrypted with your passcode – keep it in iCloud Drive or OneDrive.</span>' +
      '<button type="button" class="pill-btn" data-backup-now><i class="bi bi-download"></i> <span data-t="ui.download">Download</span></button>' +
      '<button type="button" class="text-btn" data-backup-later data-t="ui.later"><span data-t="ui.later">Later</span></button>';
    el.hidden = false;
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-backup-now]') && window.Vault) {
      window.Vault.backup().then(backupNote);
    } else if (e.target.closest('[data-backup-later]')) {
      lsSet('dash.backupSnooze', String(Date.now() + 7 * DAY));
      backupNote();
    }
  });
  window.addEventListener('dash:backup', backupNote);
  if (window.Vault) window.Vault.onUnlock(backupNote);

  /* ---------- Settings → Features ---------- */
  var F = window.Features;
  var box = $('ftList');
  if (!F || !box) return;
  /* grouped by where you find them (2026-11-22, JP: "clean the features, it's getting very long") – each group folds */
  var GROUPS = [
    ['Main pages', 'grid-1x2', I18N.k('ui.ftg-main', 'Main pages'), I18N.k('ui.ftg-main-n', 'Each one is a page in the menu. Switching one off hides its page, cards and calendar items – nothing is deleted.')],
    ['Everywhere', 'stars', I18N.k('ui.ftg-every', 'Helpers everywhere'), ''],
    ['Finances', 'wallet2', I18N.k('ui.ftg-fin', 'Finances'), I18N.k('ui.ftg-fin-n', 'Shown on the Finances page. Renewals and warranty dates also go in your calendar.')],
    ['Health', 'heart-pulse', I18N.k('ui.ftg-health', 'Health'), I18N.k('ui.ftg-health-n', 'Shown on the Health page.')],
    ['Work', 'briefcase', I18N.k('ui.ftg-work', 'Work'), I18N.k('ui.ftg-work-n', 'Turning on any of these adds a Work page to the menu.')],
    ['Travel', 'airplane', I18N.k('ui.ftg-travel', 'Travel'), I18N.k('ui.ftg-travel-n', 'Shown under Trips on the Travel page.')],
    ['House', 'house-gear', I18N.k('ui.ftg-house', 'House'), ''],
    ['Home life', 'house-heart', I18N.k('ui.nav-homelife', 'Home life'), I18N.k('ui.ftg-page-n', 'Turning on any of these adds this page to the menu.')],
    ['Life admin', 'clipboard-check', I18N.k('ui.nav-lifeadmin', 'Life admin'), I18N.k('ui.ftg-page-n', 'Turning on any of these adds this page to the menu.')],
    ['Me', 'person-heart', I18N.k('ui.nav-me', 'Me'), I18N.k('ui.ftg-page-n', 'Turning on any of these adds this page to the menu.')]
  ];
  var openG = {}, ftq = '';   /* which groups are open and what you searched – only for this visit to Settings */
  /* added in October 2026 – marked until you've tried them */
  var NEW = { mood: 1, wheel: 1, wins: 1, hobbies: 1, bodycare: 1, screen: 1, style: 1, ready: 1, hood: 1, ladmin: 1, deals: 1, climate: 1, parties: 1, moments: 1, family: 1, pets: 1, clubs: 1, sleep: 1, calm: 1, media: 1, later: 1, digital: 1, career: 1, outdoor: 1, voice: 1, findtime: 1, shutdown: 1, prep: 1, fdv: 1, holiday: 1, gym: 1, rest: 1, tripbudget: 1, smartpack: 1, power: 1, jars: 1, ptime: 1, house: 1, people: 1, food: 1, papers: 1, hproj: 1, hdocs: 1, hclaim: 1, recur: 1, shared: 1, hreport: 1 };
  function render() {
    var simp = F.simple && F.simple(), q = ftq.trim().toLowerCase(), hits = 0;
    var rowOf = function (x) {
      var nm = I18N.k('ui.ftn-' + x.id, x.name), ds = I18N.k('ui.ftd-' + x.id, x.desc);
      if (q && (nm + ' ' + ds + ' ' + x.name).toLowerCase().indexOf(q) < 0) return '';
      hits++;
      return '<label class="st-row ft-row"><span class="st-ico" style="--c:' + x.c + '"><i class="bi bi-' + x.icon + '"></i></span>' +
        '<span class="st-label">' + nm + (NEW[x.id] && !F.on(x.id) ? ' <span class="ft-new"><span data-t="ui.new">New</span></span>' : '') + '<small>' + ds + '</small></span>' +
        '<input type="checkbox" class="switch" data-feat="' + x.id + '"' + (F.on(x.id) ? ' checked' : '') + ' aria-label="' + nm + '"></label>';
    };
    var known = GROUPS.map(function (g) { return g[0]; }), rest = [];
    F.LIST.forEach(function (x) { if (known.indexOf(x.group) < 0 && rest.indexOf(x.group) < 0) rest.push(x.group); });
    var html = GROUPS.concat(rest.map(function (g) { return [g, 'grid', g, '']; })).map(function (g) {
      var all = F.LIST.filter(function (x) { return x.group === g[0] && !(simp && F.ADV && F.ADV.indexOf(x.id) > -1); });
      if (!all.length) return '';
      var rows = all.map(rowOf).join(''); if (!rows) return '';
      var on = all.filter(function (x) { return F.on(x.id); }).length, nw = all.filter(function (x) { return NEW[x.id] && !F.on(x.id); }).length;
      return '<details class="ft-grp" data-ftg="' + g[0] + '"' + (q || openG[g[0]] ? ' open' : '') + '><summary><span class="st-ico"><i class="bi bi-' + g[1] + '"></i></span><b>' + g[2] + '</b>' +
        '<small class="ft-cnt tnum">' + I18N.k('ui.sum-n-of-m-on', '{n} of {m} on', { n: on, m: all.length }) + '</small>' + (nw ? '<span class="ft-new">' + I18N.k('ui.ftg-new', '{n} new', { n: nw }) + '</span>' : '') + '<i class="bi bi-chevron-down ft-chev"></i></summary>' +
        rows + (g[3] ? '<p class="st-note ft-note">' + g[3] + '</p>' : '') + '</details>';
    }).join('');
    box.innerHTML = '<label class="ft-search"><i class="bi bi-search"></i><input type="search" data-ftq placeholder="' + I18N.k('ui.ftg-find', 'Find a feature') + '" aria-label="' + I18N.k('ui.ftg-find', 'Find a feature') + '" value="' + ftq.replace(/"/g, '&quot;') + '"></label>' +
      '<label class="st-row ft-row ft-simple"><span class="st-ico" style="--c:#7a8794"><i class="bi bi-ui-checks-grid"></i></span><span class="st-label"><span data-t="ui.simple-mode">Simple mode</span><small>' +
      (simp ? 'On – the extras are hidden. Your switches are kept for when you turn it off.' : 'Hide the extras (talk to add, find time, shutdown ritual, holiday planner, rest-day advisor, health report, trip budget, smart packing, power prices, savings jars, recurring and shared payments, warranties)') +
      '</small></span><input type="checkbox" class="switch" data-simple' + (simp ? ' checked' : '') + ' aria-label="Simple mode"></label>' +
      html + (q && !hits ? '<p class="st-note ft-none">' + I18N.k('ui.ftg-none', 'No feature matches that.') + '</p>' : '');
    summary();
  }
  function summary() {
    var s = $('sumFeatures');
    if (!s) return;
    var extra = F.LIST.filter(function (x) { return !x.def && F.on(x.id); }).length;
    s.textContent = I18N.k('ui.sum-n-of-m-on', '{n} of {m} on', { n: F.LIST.filter(function (x) { return F.on(x.id); }).length, m: F.LIST.length }) + (extra ? ' · ' + I18N.k('ui.sum-n-extra', '{n} extra', { n: extra }) : '');
  }
  box.addEventListener('toggle', function (e) { var d = e.target; if (d.dataset && d.dataset.ftg && !ftq) openG[d.dataset.ftg] = d.open; }, true);
  box.addEventListener('input', function (e) {
    if (!e.target.hasAttribute || !e.target.hasAttribute('data-ftq')) return;
    ftq = e.target.value; var at = e.target.selectionStart; render();
    var n = box.querySelector('[data-ftq]'); if (n) { n.focus(); try { n.setSelectionRange(at, at); } catch (x) {} }
  });
  box.addEventListener('change', function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute('data-simple')) { F.setSimple(e.target.checked); render(); return; }
    var id = e.target.dataset && e.target.dataset.feat;
    if (id) { F.set(id, e.target.checked); var d = e.target.closest('details'); if (d) { var on = d.querySelectorAll('[data-feat]:checked').length, all = d.querySelectorAll('[data-feat]').length, c = d.querySelector('.ft-cnt'); if (c) c.textContent = I18N.k('ui.sum-n-of-m-on', '{n} of {m} on', { n: on, m: all }); } }
  });
  /* ---------- Settings → Work (flex time preferences; shown when a Work part is on) ---------- */
  function wkCfg() { var c = F.tools().flexcfg || {}; return { norm: +c.norm || 7.5, brk: +c.brk || 0, vacation: +c.vacation || 25 }; }
  function wkFill() {
    var row = $('stWorkRow'); if (!row) return;
    var on = F.WORK.some(F.on), c = wkCfg();
    row.hidden = !on;
    $('sumWork').textContent = I18N.k('ui.sum-h-day', '{n} h day', { n: String(c.norm).replace('.', ',') }) + ' · ' + I18N.k('ui.sum-holiday-days', '{n} holiday days', { n: c.vacation }) + (c.brk ? ' · ' + I18N.k('ui.sum-min-break', '{n} min break', { n: c.brk }) : '');
    if (document.activeElement !== $('wkNorm')) $('wkNorm').value = String(c.norm).replace('.', ',');
    if (document.activeElement !== $('wkBrk')) $('wkBrk').value = c.brk || '';
    if (document.activeElement !== $('wkVac')) $('wkVac').value = c.vacation;
  }
  ['wkNorm', 'wkBrk', 'wkVac'].forEach(function (id) {
    var el = $(id); if (!el) return;
    el.addEventListener('change', function () {
      var v = parseFloat(String(el.value).replace(',', '.')), k = { wkNorm: 'norm', wkBrk: 'brk', wkVac: 'vacation' }[id];
      if (!isFinite(v) || v < 0 || (k === 'norm' && !(v > 0 && v < 16))) { wkFill(); return; }
      var t = F.tools(); t.flexcfg = t.flexcfg || {}; t.flexcfg[k] = v; F.saveTools(t); wkFill();
    });
  });
  window.addEventListener('tools:change', wkFill);
  window.addEventListener('st:page', function (e) { if (e.detail === 'features') render(); if (e.detail === 'home') { summary(); wkFill(); } if (e.detail === 'work') wkFill(); });
  if (window.Vault) window.Vault.onUnlock(wkFill);
  window.addEventListener('features:change', function () { summary(); wkFill(); });
  if (window.Vault) window.Vault.onUnlock(summary);
  summary();
})();
