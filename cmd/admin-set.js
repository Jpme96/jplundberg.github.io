/* Settings → Admin page (every page, settings bundle): which panels show, auto-refresh, warning levels, the GitHub key's
   expiry date, the link check. Stored in dash.settings.admin. Also: the admin activity log for publishing done anywhere,
   and ⌘K commands for the control room. */
(function () {
  "use strict";
  var NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rj(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  var DEF = { tab: true, refresh: 5, backupWarn: 14, syncWarn: 24, speedWarn: 1500, ghExpiry: '2027-09-28', cfExpiry: '', domainExpiry: '', resendExpiry: '', linkCheck: 'manual', alerts: 'red', quietFrom: 22, quietTo: 7, logLen: 80, homeStrip: false, order: [], autoTodo: {},
    panels: { status: true, actions: true, site: true, content: true, health: true, system: true, todo: true, log: true, changes: true } };
  function cfg() { var s = rj('dash.settings', {}) || {}; var a = Object.assign({}, DEF, s.admin || {}); a.panels = Object.assign({}, DEF.panels, (s.admin || {}).panels || {}); return a; }
  function save(patch, panel) {
    var s = rj('dash.settings', {}) || {}, a = Object.assign({}, s.admin || {});
    if (panel) a.panels = Object.assign({}, a.panels || {}, patch); else Object.assign(a, patch);
    s.admin = a; try { localStorage.setItem('dash.settings', JSON.stringify(s)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local')); window.dispatchEvent(new Event('admin:cfg'));
    if ('tab' in patch && !panel) document.documentElement.classList.toggle('tab-off-admin', patch.tab === false);
    summary();
  }
  var PN = [['status', L('Status lights', 'Statuslys')], ['actions', L('Quick actions', 'Hurtighandlinger')], ['site', L('Visitors', 'Besøkende')], ['content', L('Articles & projects', 'Artikler og prosjekter')],
    ['health', L('Uptime, speed, links & previews', 'Oppetid, fart, lenker og forhåndsvisning')], ['system', L('System & storage', 'System og lagring')], ['todo', L('Admin to-do', 'Admin-gjøremål')], ['log', L('Activity', 'Aktivitet')], ['changes', L('Changes (GitHub)', 'Endringer (GitHub)')]];
  function sel(k, opts, v) { return '<select class="st-select" data-adset="' + k + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
  function row(label, sub, ctl) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span>' + ctl + '</label>'; }
  function fill() {
    var box = document.getElementById('adSet'); if (!box) return; var c = cfg();
    box.innerHTML = '<p class="st-note">' + L('The control room at Admin in the menu. These settings are synced.', 'Kontrollrommet under Admin i menyen. Innstillingene synkes.') + ' <a href="/cmd/admin/">' + L('Open Admin', 'Åpne Admin') + ' →</a></p>' +
      '<p class="st-sub ap-sub"><i class="bi bi-speedometer2"></i> ' + L('General', 'Generelt') + '</p><div class="st-group">' +
      row(L('Admin in the menu', 'Admin i menyen'), L('Off: still at /cmd/admin/ and in search', 'Av: fortsatt på /cmd/admin/ og i søk'), '<input type="checkbox" class="switch" data-adset="tab"' + (c.tab !== false ? ' checked' : '') + '>') +
      row(L('Check automatically', 'Sjekk automatisk'), L('While Admin is open', 'Mens Admin er åpen'), sel('refresh', [[0, L('Off', 'Av')], [1, L('Every minute', 'Hvert minutt')], [5, L('Every 5 min', 'Hvert 5. min')], [15, L('Every 15 min', 'Hvert 15. min')], [60, L('Every hour', 'Hver time')]], c.refresh)) +
      row(L('Broken-link check', 'Sjekk av brutte lenker'), L('Checks every page in the sitemap', 'Sjekker alle sider i sitemapet'), sel('linkCheck', [['manual', L('When I ask', 'Når jeg ber om det')], ['open', L('Daily, when Admin opens', 'Daglig, når Admin åpnes')]], c.linkCheck)) + '</div>' +
      '<p class="st-sub ap-sub"><i class="bi bi-exclamation-triangle"></i> ' + L('When to warn', 'Når det skal varsles') + '</p><div class="st-group">' +
      row(L('Backup older than', 'Sikkerhetskopi eldre enn'), '', sel('backupWarn', [[7, L('1 week', '1 uke')], [14, L('2 weeks', '2 uker')], [30, L('1 month', '1 måned')], [60, L('2 months', '2 måneder')]], c.backupWarn)) +
      row(L('No sync for', 'Ingen synk på'), '', sel('syncWarn', [[6, '6 h'], [24, L('1 day', '1 dag')], [72, L('3 days', '3 dager')]], c.syncWarn)) +
      row(L('Slow above', 'Tregt over'), L('Server and front page answer time', 'Svartid for server og forside'), sel('speedWarn', [[800, '0,8 s'], [1500, '1,5 s'], [3000, '3 s']], c.speedWarn)) +
      row(L('GitHub key expires', 'GitHub-nøkkelen utløper'), L('From GitHub → Settings → Developer settings → tokens', 'Fra GitHub → Settings → Developer settings → tokens'), '<input type="date" class="st-input" data-adset="ghExpiry" value="' + esc(c.ghExpiry || '') + '">') + '</div>' +
      row(L('Cloudflare token expires', 'Cloudflare-token utløper'), L('Leave empty if it never expires', 'La stå tomt hvis den aldri utløper'), '<input type="date" class="st-input" data-adset="cfExpiry" value="' + esc(c.cfExpiry || '') + '">') +
      row(L('Domain renews', 'Domenet fornyes'), 'jplundberg.com', '<input type="date" class="st-input" data-adset="domainExpiry" value="' + esc(c.domainExpiry || '') + '">') +
      row(L('Resend key expires', 'Resend-nøkkelen utløper'), L('Only if you use the weekly backup email', 'Bare hvis du bruker ukentlig sikkerhetskopi på e-post'), '<input type="date" class="st-input" data-adset="resendExpiry" value="' + esc(c.resendExpiry || '') + '">') + '</div>' +
      '<p class="st-sub ap-sub"><i class="bi bi-bell"></i> ' + L('Alerts', 'Varsler') + '</p><div class="st-group">' +
      row(L('Notify me when', 'Varsle meg når'), L('A phone notification while the app is open or in the background (notifications must be allowed)', 'Et varsel på telefonen mens appen er åpen eller i bakgrunnen (varsler må være tillatt)'), sel('alerts', [['off', L('Never', 'Aldri')], ['red', L('A light turns red', 'Et lys blir rødt')], ['amber', L('A light turns amber or red', 'Et lys blir gult eller rødt')]], c.alerts)) +
      row(L('Quiet hours from', 'Stille timer fra'), '', sel('quietFrom', [18, 19, 20, 21, 22, 23, 0].map(function (h) { return [h, (h < 10 ? '0' : '') + h + ':00']; }), c.quietFrom)) +
      row(L('Quiet hours until', 'Stille timer til'), '', sel('quietTo', [5, 6, 7, 8, 9].map(function (h) { return [h, '0' + h + ':00']; }), c.quietTo)) +
      row(L('Status on Home', 'Status på Hjem'), L('A small strip under the greeting – only when something needs you', 'En liten stripe under hilsenen – bare når noe trenger deg'), '<input type="checkbox" class="switch" data-adset="homeStrip"' + (c.homeStrip ? ' checked' : '') + '>') + '</div>' +
      '<p class="st-sub ap-sub"><i class="bi bi-magic"></i> ' + L('Added to the admin to-do for me', 'Legges til i admin-gjøremål for meg') + '</p><div class="st-group">' +
      [['key', L('Keys and renewals about to expire', 'Nøkler og fornyelser som snart utløper')], ['backup', L('An old backup', 'En gammel sikkerhetskopi')], ['rec', L('No recovery code', 'Ingen gjenopprettingskode')], ['server', L('The server not answering', 'Serveren svarer ikke')], ['links', L('Broken links', 'Brutte lenker')]].map(function (a) {
        return row(a[1], '', '<input type="checkbox" class="switch" data-adauto="' + a[0] + '"' + ((c.autoTodo || {})[a[0]] !== false ? ' checked' : '') + '>'); }).join('') + '</div>' +
      '<p class="st-sub ap-sub"><i class="bi bi-grid-1x2"></i> ' + L('Panels – on/off and order', 'Paneler – av/på og rekkefølge') + '</p><div class="st-group">' +
      ordered(c).map(function (p, i, arr) { return '<div class="st-row"><span>' + esc(p[1]) + '</span><span class="pk-mv"><button type="button" class="icon-btn" data-admv="' + p[0] + '" data-d="-1" aria-label="' + L('Move up', 'Flytt opp') + '"' + (i ? '' : ' disabled') + '><i class="bi bi-arrow-up"></i></button><button type="button" class="icon-btn" data-admv="' + p[0] + '" data-d="1" aria-label="' + L('Move down', 'Flytt ned') + '"' + (i < arr.length - 1 ? '' : ' disabled') + '><i class="bi bi-arrow-down"></i></button></span><input type="checkbox" class="switch" data-adpanel="' + p[0] + '"' + (c.panels[p[0]] !== false ? ' checked' : '') + ' aria-label="' + esc(p[1]) + '"></div>'; }).join('') + '</div>' +
      '<p class="st-sub ap-sub"><i class="bi bi-clock-history"></i> ' + L('Activity & data', 'Aktivitet og data') + '</p><div class="st-group">' +
      row(L('Keep activity entries', 'Behold aktivitetsoppføringer'), '', sel('logLen', [[50, '50'], [80, '80'], [150, '150'], [300, '300']], c.logLen)) +
      '<button type="button" class="st-row st-btn" data-adexport><span><i class="bi bi-filetype-csv"></i> ' + L('Export checks and activity (CSV)', 'Eksporter sjekker og aktivitet (CSV)') + '</span><i class="bi bi-download"></i></button>' +
      '<button type="button" class="st-row st-btn" data-adclear><span><i class="bi bi-trash3"></i> ' + L('Clear the activity log and check history', 'Tøm aktivitetsloggen og sjekkhistorikken') + '</span></button></div>';
  }
  var CARDS = [['site', L('Visitors', 'Besøkende')], ['todo', L('Admin to-do', 'Admin-gjøremål')], ['log', L('Activity', 'Aktivitet')], ['content', L('Articles & projects', 'Artikler og prosjekter')], ['links', L('Broken links', 'Brutte lenker')], ['preview', L('Link preview', 'Lenkeforhåndsvisning')], ['changes', L('Changes (GitHub)', 'Endringer (GitHub)')], ['uptime', L('Uptime & speed', 'Oppetid og fart')], ['system', L('System', 'System')], ['storage', L('Storage', 'Lagring')]];
  var PANELKEY = { site: 'site', todo: 'todo', log: 'log', content: 'content', links: 'health', preview: 'health', uptime: 'health', changes: 'changes', system: 'system', storage: 'system' };
  function ordered(c) { var o = c.order || []; return [['status', L('Status lights', 'Statuslys')], ['actions', L('Quick actions', 'Hurtighandlinger')]].concat(CARDS.slice().sort(function (a, b) { var ia = o.indexOf(a[0]), ib = o.indexOf(b[0]); return (ia < 0 ? 99 + CARDS.indexOf(a) : ia) - (ib < 0 ? 99 + CARDS.indexOf(b) : ib); })); }
  function summary() { var s = document.getElementById('sumAdmin'); if (!s) return; var c = cfg(), n = PN.filter(function (p) { return c.panels[p[0]] !== false; }).length; s.textContent = n + L(' of ', ' av ') + PN.length + L(' panels', ' paneler') + ' · ' + (c.refresh ? L('checks every ', 'sjekker hvert ') + c.refresh + ' min' : L('manual checks', 'manuelle sjekker')); }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.closest || !t.closest('#adSet')) return;
    if (t.dataset.adpanel) { var p = {}; p[t.dataset.adpanel] = t.checked; save(p, true); return; }
    if (t.dataset.adauto) { var a0 = cfg().autoTodo || {}; a0 = Object.assign({}, a0); a0[t.dataset.adauto] = t.checked; save({ autoTodo: a0 }); return; }
    if (t.dataset.adset === 'alerts' && t.value !== 'off' && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    var k = t.dataset.adset; if (!k) return; var v = t.type === 'checkbox' ? t.checked : t.type === 'date' ? t.value : isNaN(+t.value) ? t.value : +t.value;
    var o = {}; o[k] = v; save(o);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#adSet [data-admv], #adSet [data-adexport], #adSet [data-adclear]'); if (!b) return;
    if (b.dataset.admv) {
      var c = cfg(), list = ordered(c).slice(2).map(function (x) { return x[0]; }), i = list.indexOf(b.dataset.admv), j = i + (+b.dataset.d);
      if (j < 0 || j >= list.length) return; list.splice(j, 0, list.splice(i, 1)[0]); save({ order: list }); fill(); return;
    }
    if (b.hasAttribute('data-adexport')) {
      var F = window.Features, lg = F ? (F.tools().adminlog || []) : [], ch = rj('dash.adminChecks', []) || [];
      var rows = [['when', 'type', 'what', 'server ms', 'front page ms']].concat(ch.map(function (x) { return [new Date(x.at).toISOString(), 'check', '', x.api == null ? 'down' : x.api, x.web == null ? 'down' : x.web]; }), lg.map(function (x) { return [new Date(x.at).toISOString(), 'activity', x.t, '', '']; }));
      var csv = rows.map(function (r) { return r.map(function (v) { v = String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = 'admin-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    if (b.hasAttribute('data-adclear')) {
      if (!confirm(L('Clear the activity log and the check history?', 'Tømme aktivitetsloggen og sjekkhistorikken?'))) return;
      var F2 = window.Features; if (F2) { var tt = F2.tools(); tt.adminlog = []; F2.saveTools(tt); }
      try { localStorage.removeItem('dash.adminChecks'); } catch (x) {}
      window.dispatchEvent(new Event('admin:cfg'));
    }
  });
  window.addEventListener('st:page', function (e) { if (e.detail === 'adminset') fill(); });

  /* a small status strip on Home when something needs you (from the last Admin check) */
  function strip() {
    var hero = document.querySelector('.mhero'), old = document.getElementById('adStrip');
    if (!hero || !/\/cmd\/$/.test(location.pathname)) return;
    var c = cfg(), st = rj('dash.adminStatus', null);
    if (!c.homeStrip || !st || st.ov === 'ok' || !st.bad || !st.bad.length) { if (old) old.remove(); return; }
    var el = old || document.createElement('a'); el.id = 'adStrip'; el.href = '/cmd/admin/'; el.className = 'ad-strip ad-' + st.ov;
    el.innerHTML = '<span class="ad-dot"></span><b>' + esc(st.ov === 'bad' ? L('Admin: something needs you', 'Admin: noe trenger deg') : L('Admin: something to look at', 'Admin: noe å se på')) + '</b><span>' + esc(st.bad.map(function (x) { return x[0]; }).join(' · ')) + '</span><i class="bi bi-chevron-right"></i>';
    if (!old) hero.parentNode.insertBefore(el, hero.nextSibling);
  }
  ['admin:cfg', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(strip, 100); }); });
  if (window.Vault && window.Vault.onUnlock) window.Vault.onUnlock(function () { setTimeout(strip, 1200); });
  summary();

  /* the activity log, wherever you publish from */
  function logIt(t, icon) {
    var F = window.Features; if (!F || !document.documentElement.classList.contains('unlocked')) return;
    var tt = F.tools(), l = Array.isArray(tt.adminlog) ? tt.adminlog : [];
    l.unshift({ at: Date.now(), t: String(t).slice(0, 140), i: icon || 'dot' }); tt.adminlog = l.slice(0, 80); F.saveTools(tt);
  }
  window.AdminLog = logIt;
  window.addEventListener('site:published', function (e) { logIt(L('Published ', 'Publiserte ') + ((e && e.detail) || L('the website', 'nettstedet')), 'cloud-upload'); });

  /* ⌘K */
  window.CommandExtra = window.CommandExtra || [];
  window.CommandExtra.push(function () {
    var go = function (h) { return function () { location.href = '/cmd/admin/' + (h || ''); }; };
    return [{ i: 'speedometer2', t: L('Admin – control room', 'Admin – kontrollrom'), s: 'Admin', run: go(), x: 'admin control room status kontrollrom' },
      { i: 'link-45deg', t: L('Check for broken links', 'Sjekk etter brutte lenker'), s: 'Admin', run: go('#links'), x: 'broken links lenker sjekk' },
      { i: 'share', t: L('Test a link preview', 'Test en lenkeforhåndsvisning'), s: 'Admin', run: go('#preview'), x: 'link preview og linkedin share' }];
  });
})();
