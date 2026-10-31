/* Settings → Admin page (every page, settings bundle): which panels show, auto-refresh, warning levels, the GitHub key's
   expiry date, the link check. Stored in dash.settings.admin. Also: the admin activity log for publishing done anywhere,
   and ⌘K commands for the control room. */
(function () {
  "use strict";
  var NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rj(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  var DEF = { tab: true, refresh: 5, backupWarn: 14, syncWarn: 24, speedWarn: 1500, ghExpiry: '2027-09-28', linkCheck: 'manual',
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
      '<p class="st-sub ap-sub"><i class="bi bi-grid-1x2"></i> ' + L('Panels', 'Paneler') + '</p><div class="st-group">' +
      PN.map(function (p) { return row(p[1], '', '<input type="checkbox" class="switch" data-adpanel="' + p[0] + '"' + (c.panels[p[0]] !== false ? ' checked' : '') + '>'); }).join('') + '</div>';
  }
  function summary() { var s = document.getElementById('sumAdmin'); if (!s) return; var c = cfg(), n = PN.filter(function (p) { return c.panels[p[0]] !== false; }).length; s.textContent = n + L(' of ', ' av ') + PN.length + L(' panels', ' paneler') + ' · ' + (c.refresh ? L('checks every ', 'sjekker hvert ') + c.refresh + ' min' : L('manual checks', 'manuelle sjekker')); }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.closest || !t.closest('#adSet')) return;
    if (t.dataset.adpanel) { var p = {}; p[t.dataset.adpanel] = t.checked; save(p, true); return; }
    var k = t.dataset.adset; if (!k) return; var v = t.type === 'checkbox' ? t.checked : t.type === 'date' ? t.value : isNaN(+t.value) ? t.value : +t.value;
    var o = {}; o[k] = v; save(o);
  });
  window.addEventListener('st:page', function (e) { if (e.detail === 'adminset') fill(); });
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
