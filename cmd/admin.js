/* Admin – the control room (page /cmd/admin/).
   Status lights for the website, the server, sync, backups, security and keys; visitors; every article and project with a
   live/hidden switch; health checks you can run (speed, uptime from this device, broken links, link previews);
   errors and self-check; storage; an admin to-do list (some items added for you); an activity log; the changelog
   from GitHub; quick actions and ⌘K commands.
   Settings: dash.settings.admin (Settings → Admin page – panels, refresh, warning levels, key expiry date).
   Local only: dash.adminChecks (check history, this device), dash.tools.admintodo / adminlog (synced). */
(function () {
  "use strict";
  var box = document.getElementById('crRoot');
  if (!box || !window.Vault) return;
  var NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  var Fe = window.Features, root = document.documentElement;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rj(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function wj(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  var nf = new Intl.NumberFormat(NB ? 'nb-NO' : 'en-GB');
  function ago(ts) {
    if (!ts) return L('never', 'aldri');
    var s = (Date.now() - ts) / 1000;
    return s < 90 ? L('just now', 'nå nettopp') : s < 3600 ? Math.round(s / 60) + L(' min ago', ' min siden') : s < 86400 ? Math.round(s / 3600) + L(' h ago', ' t siden') : Math.round(s / 86400) === 1 ? L('yesterday', 'i går') : Math.round(s / 86400) + L(' days ago', ' dager siden');
  }
  function toast(h) { if (window.Quick && window.Quick.toast) window.Quick.toast(h); }

  /* ---------- settings (Settings → Admin page) ---------- */
  var DEF = { tab: true, refresh: 5, backupWarn: 14, syncWarn: 24, speedWarn: 1500, ghExpiry: '2027-09-28', cfExpiry: '', domainExpiry: '', resendExpiry: '', linkCheck: 'manual', alerts: 'red', quietFrom: 22, quietTo: 7, logLen: 80, homeStrip: false, order: [], autoTodo: {},
    panels: { status: true, actions: true, site: true, content: true, health: true, system: true, todo: true, log: true, changes: true } };
  function cfg() { var s = rj('dash.settings', {}) || {}; var a = Object.assign({}, DEF, s.admin || {}); a.panels = Object.assign({}, DEF.panels, (s.admin || {}).panels || {}); return a; }

  /* ---------- activity log + admin to-do (synced in dash.tools) ---------- */
  function T() { return Fe ? Fe.tools() : {}; }
  function logIt(t, icon) {
    if (!Fe) return; var tt = Fe.tools(), l = Array.isArray(tt.adminlog) ? tt.adminlog : [];
    l.unshift({ at: Date.now(), t: String(t).slice(0, 140), i: icon || 'dot' }); tt.adminlog = l.slice(0, +cfg().logLen || 80); Fe.saveTools(tt);
  }
  function todos() { var l = T().admintodo; return Array.isArray(l) ? l : []; }

  /* ---------- checks ---------- */
  var S = { ping: null, site: null, visitors: null, content: null, speed: null, links: null, preview: null, commits: null, busy: {} };
  function timed(url, opt) {
    var t0 = performance.now();
    return fetch(url, Object.assign({ cache: 'no-store', credentials: 'same-origin' }, opt || {})).then(function (r) {
      var ms = Math.round(performance.now() - t0);
      return r.text().then(function (txt) { var j = null; try { j = JSON.parse(txt); } catch (e) {} return { ok: r.ok, status: r.status, ms: ms, json: j, text: txt }; });
    }).catch(function (e) { return { ok: false, status: 0, ms: null, err: String(e && e.message || e) }; });
  }
  function history() { return rj('dash.adminChecks', []) || []; }
  function runCore() {
    S.busy.core = true; draw();
    return Promise.all([timed('/cmd/api/ping'), timed('/cmd/api/site'), timed('/?admincheck=' + Date.now()), timed('/cmd/api/backup')]).then(function (r) {
      S.ping = r[0]; S.site = r[1]; S.speed = r[2];
      /* is the weekly email backup really set up on the server? (null = couldn't tell) */
      S.mailReady = r[3] && r[3].ok && r[3].json && typeof r[3].json.ready === 'boolean' ? r[3].json.ready : null;
      var h = history(); h.push({ at: Date.now(), api: r[0].ok ? r[0].ms : null, web: r[2].ok ? r[2].ms : null }); wj('dash.adminChecks', h.slice(-300));
      S.busy.core = false; S.checkedAt = Date.now(); draw();
    });
  }
  function runVisitors() { return timed('/cmd/api/visitors?days=7').then(function (r) { S.visitors = r; draw(); }); }
  function runContent() { return timed('/cmd/api/content').then(function (r) { S.content = r; draw(); }); }
  function runCommits() {
    return fetch('https://api.github.com/repos/Jpme96/jplundberg.github.io/commits?per_page=8', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { S.commits = Array.isArray(j) ? j : 'off'; draw(); }).catch(function () { S.commits = 'off'; draw(); });
  }
  /* broken links: every page in the sitemap, four at a time */
  function runLinks() {
    if (S.busy.links) return;
    S.busy.links = true; S.links = { done: 0, total: 0, bad: [] }; draw();
    return fetch('/sitemap.xml', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (x) {
      var urls = (x.match(/<loc>([^<]+)<\/loc>/g) || []).map(function (u) { return u.replace(/<\/?loc>/g, '').replace(/^https?:\/\/[^/]+/, ''); });
      S.links.total = urls.length;
      var i = 0;
      function next() {
        if (i >= urls.length) return Promise.resolve();
        var u = urls[i++];
        return fetch(u, { cache: 'no-store', redirect: 'follow' }).then(function (r) { if (!r.ok) S.links.bad.push({ u: u, s: r.status }); }).catch(function () { S.links.bad.push({ u: u, s: 0 }); })
          .then(function () { S.links.done++; if (S.links.done % 4 === 0) draw(); return next(); });
      }
      return Promise.all([next(), next(), next(), next()]);
    }).then(function () { S.busy.links = false; S.links.at = Date.now(); wj('dash.adminLinks', S.links); draw(); logIt(L('Link check: ', 'Lenkesjekk: ') + (S.links.bad.length ? S.links.bad.length + L(' broken', ' brutte') : L('all fine', 'alt i orden')), 'link-45deg'); })
      .catch(function () { S.busy.links = false; draw(); });
  }
  /* link preview: what LinkedIn / Messages will show for a page */
  function runPreview(path) {
    path = String(path || '/').trim(); if (!/^\//.test(path)) path = path.replace(/^https?:\/\/[^/]+/, '') || '/';
    S.preview = { loading: true, path: path }; draw();
    fetch(path, { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (h) {
      var d = new DOMParser().parseFromString(h, 'text/html'), m = function (p) { var e = d.querySelector('meta[property="' + p + '"], meta[name="' + p + '"]'); return e ? e.getAttribute('content') : ''; };
      S.preview = { path: path, title: m('og:title') || (d.querySelector('title') || {}).textContent || '', desc: m('og:description') || m('description'), img: m('og:image'), site: m('og:site_name') };
      draw();
    }).catch(function () { S.preview = { path: path, err: true }; draw(); });
  }

  /* ---------- the status lights ---------- */
  function lights() {
    var c = cfg(), d = window.Vault.get() || {}, out = [];
    var diag = window.Diag && window.Diag.state ? window.Diag.state() : {};
    /* website */
    out.push(S.site == null ? ['globe2', L('Website', 'Nettsted'), L('Checking …', 'Sjekker …'), 'wait']
      : S.site.ok ? ['globe2', L('Website', 'Nettsted'), L('Live · settings readable', 'Live · innstillinger kan leses'), S.speed && S.speed.ms > c.speedWarn ? 'warn' : 'ok']
        : ['globe2', L('Website', 'Nettsted'), S.site.status === 401 || /401/.test(S.site.text || '') ? L('GitHub key rejected', 'GitHub-nøkkelen avvist') : L('Can’t read the website settings', 'Får ikke lest nettstedsinnstillingene') + ' (' + S.site.status + ')', 'bad']);
    /* server */
    out.push(S.ping == null ? ['hdd-network', L('Server', 'Server'), L('Checking …', 'Sjekker …'), 'wait']
      : S.ping.ok ? ['hdd-network', L('Server', 'Server'), L('Answering in ', 'Svarer på ') + S.ping.ms + ' ms', S.ping.ms > c.speedWarn ? 'warn' : 'ok']
        : ['hdd-network', L('Server', 'Server'), L('Not answering', 'Svarer ikke') + (S.ping.status ? ' (' + S.ping.status + ')' : ''), 'bad']);
    /* sync */
    var st = window.Vault.syncState ? window.Vault.syncState() : 'off', last = diag.syncOk || 0, hrs = last ? (Date.now() - last) / 36e5 : 999;
    if (st === 'ok' && !last) last = Date.now(), hrs = 0;
    out.push(['arrow-repeat', L('Sync', 'Synk'), st === 'off' && !last ? L('Not syncing (this device only)', 'Synker ikke (bare denne enheten)') : (st === 'ok' ? L('Synced ', 'Synket ') : st === 'offline' ? L('Offline · last ', 'Frakoblet · sist ') : L('Last synced ', 'Sist synket ')) + ago(last),
      st === 'off' && !last ? 'warn' : st === 'offline' || hrs > c.syncWarn * 2 ? 'bad' : hrs > c.syncWarn ? 'warn' : 'ok']);
    /* backups */
    var bk = Math.max(+(localStorage.getItem('dash.lastBackup') || 0), +((window.Vault && window.Vault.get() || {}).lastBackup || 0)), bd = bk ? (Date.now() - bk) / 864e5 : 999;
    out.push(['cloud-arrow-down', L('Backup', 'Sikkerhetskopi'), bk ? L('Downloaded ', 'Lastet ned ') + ago(bk) : L('Never downloaded', 'Aldri lastet ned'), bd > c.backupWarn * 2 ? 'bad' : bd > c.backupWarn ? 'warn' : 'ok']);
    /* security */
    var pk = !!localStorage.getItem('dash.pk'), rec = !!d._recCode;
    out.push(['shield-lock', L('Security', 'Sikkerhet'), [pk ? 'Face ID' : L('No Face ID', 'Ingen Face ID'), rec ? L('recovery code', 'gjenopprettingskode') : L('no recovery code', 'ingen gjenopprettingskode')].join(' · '), rec ? 'ok' : 'warn']);
    /* keys */
    [['ghExpiry', 'key', L('GitHub key', 'GitHub-nøkkel'), true], ['cfExpiry', 'cloud', L('Cloudflare token', 'Cloudflare-token')], ['domainExpiry', 'globe', L('Domain renewal', 'Domenefornyelse')], ['resendExpiry', 'envelope', L('Resend key', 'Resend-nøkkel')]].forEach(function (k) {
      var dt = c[k[0]]; if (!dt && !k[3]) return;
      /* a key for something that isn't in use is no reason for a red light: the Resend key only counts while the
         email backup is set up on the server (it went red from a date typed once, 2026-11-10) */
      if (k[0] === 'resendExpiry' && S.mailReady === false) return;
      var ex = dt ? Math.round((new Date(dt + 'T12:00') - new Date()) / 864e5) : null;
      out.push([k[1], k[2], ex == null ? L('Expiry date not set', 'Utløpsdato ikke satt') : ex < 0 ? L('Expired ', 'Utløpt for ') + (-ex) + L(' days ago', ' dager siden') : L('Expires in ', 'Utløper om ') + ex + L(' days', ' dager'), ex == null ? 'warn' : ex < 0 ? 'bad' : ex <= 30 ? 'warn' : 'ok', k[0]]);
    });
    return out;
  }
  function overall(ls) { return ls.some(function (x) { return x[3] === 'bad'; }) ? 'bad' : ls.some(function (x) { return x[3] === 'warn'; }) ? 'warn' : ls.some(function (x) { return x[3] === 'wait'; }) ? 'wait' : 'ok'; }

  /* things that need you – added to the admin to-do automatically (removed again when solved) */
  function autoTodos(ls) {
    var c = cfg(), want = [];
    ls.forEach(function (x) {
      if (x[3] !== 'warn' && x[3] !== 'bad') return;
      if (x[4]) want.push(['key', L('Renew: ', 'Forny: ') + x[1] + ' – ' + x[2].toLowerCase()]);
      if (x[0] === 'cloud-arrow-down') want.push(['backup', L('Download an encrypted backup', 'Last ned en kryptert sikkerhetskopi')]);
      if (x[0] === 'shield-lock') want.push(['rec', L('Make a recovery code (Settings → Security)', 'Lag en gjenopprettingskode (Innstillinger → Sikkerhet)')]);
      if (x[0] === 'hdd-network' && x[3] === 'bad') want.push(['server', L('The server isn’t answering – check the Worker in Cloudflare', 'Serveren svarer ikke – sjekk Workeren i Cloudflare')]);
    });
    if (S.links && S.links.bad && S.links.bad.length) want.push(['links', L('Fix ', 'Rett ') + S.links.bad.length + L(' broken link(s) on the website', ' brutte lenke(r) på nettstedet')]);
    var AT = c.autoTodo || {}; want = want.filter(function (w) { return AT[w[0]] !== false; });
    if (!Fe) return;
    var tt = Fe.tools(), l = Array.isArray(tt.admintodo) ? tt.admintodo : [], ch = false, keys = want.map(function (w) { return w[0]; });
    l = l.filter(function (x) { if (x.auto && keys.indexOf(x.auto) < 0) { ch = true; return false; } return true; });
    want.forEach(function (w) { if (!l.some(function (x) { return x.auto === w[0]; })) { l.push({ id: uid(), text: w[1], auto: w[0] }); ch = true; } });
    if (ch) { tt.admintodo = l; Fe.saveTools(tt); }
  }

  /* ---------- drawing ---------- */
  var LAB = { ok: L('OK', 'OK'), warn: L('Check', 'Sjekk'), bad: L('Needs you', 'Trenger deg'), wait: '…' };
  function card(id, icon, title, head, body, wide) {
    return '<section class="card cr-card' + (wide ? ' cr-wide' : '') + '" id="cr-' + id + '"><div class="card-head"><h2><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h2><div class="head-actions">' + (head || '') + '</div></div>' + body + '</section>';
  }
  function spark(vals, h) {
    var v = vals.filter(function (x) { return x != null; }); if (v.length < 2) return '';
    var max = Math.max.apply(null, v), W = 220, H = h || 36, n = vals.length;
    var pts = vals.map(function (x, i) { return x == null ? null : [(i / (n - 1)) * W, H - 3 - (x / max) * (H - 8)]; });
    var d = ''; pts.forEach(function (p) { if (p) d += (d ? ' L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); });
    return '<svg class="cr-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  function bars(rows, key) {
    if (!rows || !rows.length) return '';
    var max = Math.max.apply(null, rows.map(function (r) { return r[key]; }).concat([1]));
    return '<div class="cr-bars">' + rows.map(function (r) { return '<span style="height:' + Math.max(4, Math.round(r[key] / max * 100)) + '%" title="' + esc(r.name) + ': ' + r[key] + '"></span>'; }).join('') + '</div>';
  }
  function draw() {
    if (!box.isConnected) return;   /* left Admin (instant page change) while a check was still running – nothing to draw on */
    try { drawInner(); } catch (err) {
      if (window.Diag && window.Diag.log) window.Diag.log('error', 'admin: ' + (err && err.message), 'admin.js');
      box.innerHTML = '<div class="cr-bar cr-bad"><span class="cr-pulse"></span><b>' + esc(L('Admin couldn’t draw everything', 'Admin klarte ikke å vise alt')) + '</b><span class="cr-meta">' + esc(String(err && err.message || err).slice(0, 160)) + '</span><button type="button" class="pill-btn" onclick="location.reload()">' + esc(L('Reload', 'Last inn på nytt')) + '</button></div>';
    }
  }
  function drawInner() {
    var c = cfg(), P = c.panels, ls = lights(), ov = overall(ls), h = history(), d30 = h.filter(function (x) { return Date.now() - x.at < 30 * 864e5; });
    var up = d30.length ? Math.round(d30.filter(function (x) { return x.api != null && x.web != null; }).length / d30.length * 1000) / 10 : null;
    var html = '', C = {};
    /* command bar */
    html += '<div class="cr-bar cr-' + ov + '"><span class="cr-pulse" aria-hidden="true"></span><b>' + esc(ov === 'ok' ? L('All systems normal', 'Alle systemer normale') : ov === 'warn' ? L('Something to look at', 'Noe å se på') : ov === 'bad' ? L('Something needs you', 'Noe trenger deg') : L('Checking …', 'Sjekker …')) + '</b>' +
      '<span class="cr-meta">' + (S.checkedAt ? L('Checked ', 'Sjekket ') + ago(S.checkedAt) : '') + (c.refresh ? ' · ' + L('auto every ', 'automatisk hvert ') + c.refresh + ' min' : '') + '</span>' +
      '<button type="button" class="pill-btn cr-run" data-crrun' + (S.busy.core ? ' disabled' : '') + '><i class="bi bi-arrow-clockwise' + (S.busy.core ? ' cr-spin' : '') + '"></i> ' + L('Check everything', 'Sjekk alt') + '</button></div>';
    if (P.status) html += '<div class="cr-lights">' + ls.map(function (x) {
      return '<div class="cr-light cr-' + x[3] + '"><i class="bi bi-' + x[0] + '"></i><div><b>' + esc(x[1]) + '</b><small>' + esc(x[2]) + '</small></div><span class="cr-dot" title="' + LAB[x[3]] + '"></span></div>';
    }).join('') + '</div>';
    if (P.actions) html += '<div class="cr-actions">' + [
      ['globe2', L('Open the site', 'Åpne nettstedet'), 'data-cract="site"'], ['cloud-upload', L('Publish website', 'Publiser nettstedet'), 'data-cract="publish"'], ['download', L('Download backup', 'Last ned sikkerhetskopi'), 'data-cract="backup"'],
      ['lock', L('Lock now', 'Lås nå'), 'data-cract="lock"'], ['clipboard2-pulse', L('Copy report', 'Kopier rapport'), 'data-cract="report"'], ['sliders', L('Admin settings', 'Admin-innstillinger'), 'data-cract="settings"']
    ].map(function (a) { return '<button type="button" class="cr-act" ' + a[2] + '><i class="bi bi-' + a[0] + '"></i><span>' + esc(a[1]) + '</span></button>'; }).join('') + '</div>';
    /* website: visitors */
    if (P.site) {
      var v = S.visitors && S.visitors.json, body;
      if (!S.visitors) body = '<p class="muted">' + L('Loading …', 'Laster …') + '</p>';
      else if (!S.visitors.ok || !v) body = '<p class="muted">' + L('Visitor numbers aren’t available (Cloudflare analytics not set up or not answering).', 'Besøkstall er ikke tilgjengelig (Cloudflare-statistikk ikke satt opp eller svarer ikke).') + '</p>';
      else body = '<div class="cr-kpis"><div><b data-cu>' + nf.format(v.visits || 0) + '</b><small>' + L('visits · 7 days', 'besøk · 7 dager') + '</small></div><div><b>' + nf.format(v.views || 0) + '</b><small>' + L('page views', 'sidevisninger') + '</small></div></div>' + bars(v.perDay, 'visits') +
        ((v.pages || []).length ? '<ul class="cr-list">' + v.pages.slice(0, 5).map(function (p) { return '<li><span>' + esc(p.name || '/') + '</span><b>' + nf.format(p.views || p.visits || 0) + '</b></li>';   /* page views: Cloudflare counts a visit only on the page people land on, so other pages showed 0 */ }).join('') + '</ul>' : '') +
        ((v.referrers || []).filter(function (r) { return r.name; }).length ? '<p class="cr-sub">' + L('From', 'Fra') + ': ' + v.referrers.filter(function (r) { return r.name; }).slice(0, 4).map(function (r) { return esc(r.name) + ' (' + nf.format(r.visits || r.views || 0) + ')'; }).join(' · ') + '</p>' : '');
      C['site'] = card('site', 'bar-chart-line', L('Visitors', 'Besøkende'), '<a class="icon-btn sm" href="https://jplundberg.com/" target="_blank" rel="noopener" aria-label="' + L('Open the site', 'Åpne nettstedet') + '"><i class="bi bi-box-arrow-up-right"></i></a>', body);
    }
    /* uptime + speed */
    if (P.health) {
      var last = h.slice(-40), sp = S.speed;
      C['uptime'] = card('uptime', 'activity', L('Uptime & speed', 'Oppetid og fart'), '', '<div class="cr-kpis"><div><b>' + (up == null ? '–' : String(up).replace('.', NB ? ',' : '.') + ' %') + '</b><small>' + L('up · 30 days', 'oppe · 30 dager') + '</small></div><div><b>' + (sp && sp.ms != null ? sp.ms + ' ms' : '–') + '</b><small>' + L('front page', 'forsiden') + '</small></div><div><b>' + (S.ping && S.ping.ms != null ? S.ping.ms + ' ms' : '–') + '</b><small>' + L('server', 'server') + '</small></div></div>' +
        spark(last.map(function (x) { return x.web; })) + '<p class="cr-sub">' + d30.length + (d30.length === 1 ? L(' check', ' sjekk') : L(' checks', ' sjekker')) + L(' from this device (every time Admin is open and refreshing)', ' sjekker fra denne enheten (hver gang Admin er åpen og oppdaterer)') + '</p>');
      var lk = S.links || rj('dash.adminLinks', null);
      C['links'] = card('links', 'link-45deg', L('Broken links', 'Brutte lenker'), '<button type="button" class="icon-btn sm" data-crlinks aria-label="' + L('Check all pages', 'Sjekk alle sider') + '"' + (S.busy.links ? ' disabled' : '') + '><i class="bi bi-arrow-clockwise' + (S.busy.links ? ' cr-spin' : '') + '"></i></button>',
        !lk ? '<p class="muted">' + L('Checks every page in the sitemap for errors.', 'Sjekker alle sider i sitemapet for feil.') + '</p><button type="button" class="text-btn" data-crlinks><i class="bi bi-play"></i> ' + L('Run the check', 'Kjør sjekken') + '</button>'
          : S.busy.links ? '<div class="cr-prog"><span style="width:' + (lk.total ? Math.round(lk.done / lk.total * 100) : 5) + '%"></span></div><p class="cr-sub">' + lk.done + ' / ' + (lk.total || '…') + '</p>'
            : lk.bad.length ? '<ul class="cr-list bad">' + lk.bad.slice(0, 8).map(function (b) { return '<li><span>' + esc(b.u) + '</span><b>' + (b.s || L('no answer', 'ikke svar')) + '</b></li>'; }).join('') + '</ul>'
              : '<p class="cr-okline"><i class="bi bi-check-circle-fill"></i> ' + lk.total + L(' pages, all fine', ' sider, alle i orden') + ' · ' + ago(lk.at) + '</p>');
      var pv = S.preview;
      C['preview'] = card('preview', 'share', L('Link preview', 'Lenkeforhåndsvisning'), '', '<form class="cr-pvf"><input placeholder="/articles/… ' + L('or a full link', 'eller en hel lenke') + '" value="' + esc(pv ? pv.path : '/') + '" aria-label="' + L('Page to preview', 'Side å forhåndsvise') + '"><button type="submit" class="icon-btn" aria-label="' + L('Preview', 'Forhåndsvis') + '"><i class="bi bi-eye"></i></button></form>' +
        (!pv ? '<p class="cr-sub">' + L('See what LinkedIn, Messages and Facebook will show before you share a page.', 'Se hva LinkedIn, Meldinger og Facebook viser før du deler en side.') + '</p>'
          : pv.loading ? '<p class="muted">' + L('Loading …', 'Laster …') + '</p>' : pv.err ? '<p class="muted">' + L('Couldn’t read that page.', 'Fikk ikke lest den siden.') + '</p>'
            : '<div class="cr-og">' + (pv.img ? '<img src="' + esc(pv.img) + '" alt="" loading="lazy">' : '<div class="cr-og-noimg">' + L('No image', 'Ingen bilde') + '</div>') + '<div><small>JPLUNDBERG.COM</small><b>' + esc(pv.title) + '</b><p>' + esc(pv.desc || L('No description – add a summary to the page.', 'Ingen beskrivelse – legg til et sammendrag på siden.')) + '</p></div></div>'));
    }
    /* articles & projects */
    if (P.content) {
      var cj = S.content && S.content.json, items = cj && Array.isArray(cj.items) ? cj.items : null, by = {};
      if (items) items.forEach(function (x) { var k = x.collection + '|' + x.ref; (by[k] = by[k] || []).push(x); });
      var rows = items ? Object.keys(by).map(function (k) { var l = by[k], en = l.filter(function (x) { return x.lang === 'en'; })[0] || l[0]; return { k: k, col: en.collection, ref: en.ref, title: en.title, date: en.date, on: l.every(function (x) { return x.published; }), langs: l.map(function (x) { return x.lang; }).sort().join(' · ').toUpperCase() }; })
        .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }) : [];
      C['content'] = card('content', 'journal-check', L('Articles & projects', 'Artikler og prosjekter'), (items ? '<span class="muted cr-count">' + rows.filter(function (r) { return r.on; }).length + ' / ' + rows.length + L(' live', ' live') + '</span>' : '') + '<button type="button" class="icon-btn sm" data-crnew="articles" aria-label="' + L('New article', 'Ny artikkel') + '"><i class="bi bi-pencil-square"></i></button><button type="button" class="icon-btn sm" data-crmanage aria-label="' + L('Show / hide', 'Vis / skjul') + '"><i class="bi bi-toggles"></i></button>',
        !S.content ? '<p class="muted">' + L('Loading …', 'Laster …') + '</p>' : !items ? '<p class="muted">' + L('Couldn’t load the list (GitHub key?).', 'Fikk ikke lastet listen (GitHub-nøkkel?).') + '</p>'
          : '<ul class="cr-items">' + rows.map(function (r) {
            return '<li><i class="bi bi-' + (r.col === 'projects' ? 'kanban' : 'journal-text') + '"></i><span class="cr-it"><b>' + esc(r.title) + '</b><small>' + esc((r.date || '') + ' · ' + r.langs) + '</small></span>' +
              '<span class="cr-pill' + (r.on ? ' on' : '') + '">' + (r.on ? L('Live', 'Live') : L('Hidden', 'Skjult')) + '</span><button type="button" class="icon-btn sm" data-credit="' + esc(r.col + '|' + r.ref) + '" aria-label="' + L('Edit', 'Rediger') + ' ' + esc(r.title) + '"><i class="bi bi-pencil"></i></button></li>';
          }).join('') + '</ul>', true);
    }
    /* system */
    if (P.system) {
      var D = window.Diag, errs = D && D.list ? D.list() : [], dst = D && D.state ? D.state() : {}, chk = dst.check || null;
      C['system'] = card('system', 'cpu', L('System', 'System'), '<button type="button" class="icon-btn sm" data-crself aria-label="' + L('Run the self-check', 'Kjør selvsjekken') + '"><i class="bi bi-heart-pulse"></i></button>',
        '<ul class="cr-list">' +
        '<li><span>' + L('Daily self-check', 'Daglig selvsjekk') + '</span><b class="' + (chk && (chk.issues || []).length ? 'neg' : '') + '">' + (chk ? ((chk.issues || []).length ? (chk.issues || []).length + L(' issue(s)', ' problem(er)') : L('Fine', 'Fint')) + ' · ' + ago(chk.t) : '–') + '</b></li>' +
        '<li><span>' + L('Errors logged', 'Feil logget') + '</span><b class="' + (errs.length ? 'neg' : '') + '">' + errs.length + '</b></li>' +
        '<li><span data-t="ui.apple-health"><span data-t="ui.apple-health">Apple Health</span></span><b>' + (Fe && Fe.on('ahealth') ? ago(dst.healthPull) : L('off', 'av')) + '</b></li>' +
        '<li><span>' + L('App version', 'App-versjon') + '</span><b id="crVer">…</b></li></ul>' +
        (errs.length ? '<ul class="cr-errs">' + errs.slice(0, 4).map(function (e) { return '<li>' + esc(String(e.msg || e.m || e.message || e).slice(0, 110)) + (e.n > 1 ? ' ×' + e.n : '') + '</li>'; }).join('') + '</ul>' : ''));
      C['clean'] = window.AdminClean ? window.AdminClean.card(card) : '';
      C['storage'] = card('storage', 'database', L('Storage', 'Lagring'), '', '<div id="crStore"><p class="muted">' + L('Counting …', 'Teller …') + '</p></div>');
    }
    /* admin to-do */
    if (P.todo) {
      var tl = todos(), open = tl.filter(function (x) { return !x.done; });
      C['todo'] = card('todo', 'list-check', L('Admin to-do', 'Admin-gjøremål'), open.length ? '<span class="hl-count">' + open.length + '</span>' : '',
        '<ul class="cr-todo">' + tl.slice(0, 12).map(function (x) {
          return '<li class="' + (x.done ? 'done' : '') + '"><label><input type="checkbox" data-crtodo="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '><span>' + esc(x.text) + '</span></label>' + (x.auto ? '<span class="cr-auto" title="' + L('Added for you', 'Lagt til for deg') + '"><i class="bi bi-magic"></i></span>' : '<button type="button" class="icon-btn sm" data-crtododel="' + esc(x.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x"></i></button>') + '</li>';
        }).join('') + '</ul>' + (!tl.length ? '<p class="cr-okline"><i class="bi bi-check-circle-fill"></i> ' + L('Nothing to do – things that need you appear here by themselves.', 'Ingenting å gjøre – ting som trenger deg dukker opp her av seg selv.') + '</p>' : '') +
        '<form class="hl-shopadd cr-tdf"><input placeholder="' + L('Add – e.g. update the CV', 'Legg til – f.eks. oppdater CV-en') + '" maxlength="140" aria-label="' + L('Add an admin task', 'Legg til en admin-oppgave') + '"><button type="submit" class="icon-btn" aria-label="' + L('Add', 'Legg til') + '"><i class="bi bi-plus-lg"></i></button></form>');
    }
    /* activity log */
    if (P.log) {
      var lg = Array.isArray(T().adminlog) ? T().adminlog : [];
      C['log'] = card('log', 'clock-history', L('Activity', 'Aktivitet'), '', lg.length ? '<ul class="cr-log">' + lg.slice(0, 10).map(function (x) { return '<li><i class="bi bi-' + esc(x.i || 'dot') + '"></i><span>' + esc(x.t) + '</span><small>' + ago(x.at) + '</small></li>'; }).join('') + '</ul>' : '<p class="muted">' + L('Publishing, switches and checks from here are listed as they happen.', 'Publisering, brytere og sjekker herfra listes når de skjer.') + '</p>');
    }
    /* changelog */
    if (P.changes) {
      var cm = S.commits;
      C['changes'] = card('changes', 'git', L('Changes to the site & dashboard', 'Endringer i nettsted og dashbord'), '<a class="icon-btn sm" href="https://github.com/Jpme96/jplundberg.github.io/commits/main" target="_blank" rel="noopener" aria-label="GitHub"><i class="bi bi-box-arrow-up-right"></i></a>',
        cm == null ? '<p class="muted">' + L('Loading …', 'Laster …') + '</p>' : cm === 'off' ? '<p class="muted">' + L('GitHub didn’t answer – open the list on GitHub instead.', 'GitHub svarte ikke – åpne listen på GitHub i stedet.') + '</p>'
          : '<ul class="cr-log">' + cm.map(function (x) { var msg = String((x.commit || {}).message || '').split('\n')[0], at = new Date(((x.commit || {}).author || {}).date || 0).getTime(); return '<li><i class="bi bi-dot"></i><span>' + esc(msg.slice(0, 110)) + '</span><small>' + ago(at) + '</small></li>'; }).join('') + '</ul>');
    }
    /* tabs: Overview · Website · System – cards follow your own order (Settings → Admin page) */
    /* Team (work.jplundberg.com): its own site with its own Worker and storage – only links go from here, no team data */
    var TU = 'https://work.jplundberg.com/';
    C['team'] = card('team', 'people', L('Team', 'Team'), '', '<p class="muted">' + L('Members, invites, roles and the change log are managed in Team itself, so no team data ever comes into this dashboard. It uses the same sign-in as here.', 'Medlemmer, invitasjoner, roller og endringsloggen styres i Team selv, så ingen teamdata kommer inn i dette dashbordet. Den bruker samme innlogging som her.') + '</p>' +
      '<div class="cr-team-links"><a class="pill-btn" href="' + TU + '#team">' + L('Members and invites', 'Medlemmer og invitasjoner') + ' <i class="bi bi-box-arrow-up-right"></i></a><a class="pill-btn" href="' + TU + '">' + L('Open Team', 'Åpne Team') + ' <i class="bi bi-box-arrow-up-right"></i></a></div>', true);
    var TABS = { overview: ['site', 'content', 'todo', 'log'], website: ['links', 'preview', 'changes'], system: ['uptime', 'storage', 'clean'], shared: [], team: ['team'] };
    var ord = c.order || [], sortT = function (l) { return l.slice().sort(function (a, b) { var ia = ord.indexOf(a), ib = ord.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }); };
    var tabbar = '<div class="cr-tabs" role="tablist">' + [['overview', 'grid-1x2', L('Overview', 'Oversikt')], ['website', 'globe2', L('Website', 'Nettsted')], ['system', 'cpu', L('System', 'System')], ['shared', 'house-heart', L('Shared home', 'Felles hjem')], ['team', 'people', L('Team', 'Team')]].map(function (t) {
      return '<button type="button" role="tab" data-crtab="' + t[0] + '" aria-selected="' + (TAB === t[0]) + '"><i class="bi bi-' + t[1] + '"></i> ' + t[2] + (t[0] === 'website' && pendingCount() ? ' <span class="hl-count">' + pendingCount() + '</span>' : '') + '</button>'; }).join('') + '</div>';
    var grid = (TAB === 'website' ? '<p class="cr-sec"><i class="bi bi-activity"></i> ' + L('Site health', 'Nettstedets helse') + '</p>' : '') + '<div class="cr-grid' + (TAB === 'website' ? ' cr-eq' : '') + '">' + sortT(TABS[TAB]).filter(function (k) { return c.panels[k] !== false; }).map(function (k) { return C[k] || ''; }).join('') + '</div>';
    var top = TAB === 'overview' ? html : html.replace(/<div class="cr-lights">[\s\S]*$/, '');
    if (!document.getElementById('crTop')) box.innerHTML = '<div id="crTop"></div><div id="crWs" hidden></div><div id="crDiag" hidden></div><div id="crShare" class="cr-share" hidden><div id="crShareBox"></div></div><div id="crCards"></div>';
    var keep = document.activeElement && document.activeElement.closest && document.activeElement.closest('#crCards form') ? { sel: document.activeElement.closest('form').className, v: document.activeElement.value } : null;
    document.getElementById('crTop').innerHTML = top + tabbar;
    document.getElementById('crCards').innerHTML = grid;
    var wsEl = document.getElementById('crWs'); wsEl.hidden = TAB !== 'website'; if (TAB === 'website') mountWs();
    box.classList.toggle('cr-sys', TAB === 'system');     /* System: Diagnostics' cards and the System cards share one grid (gridpack.js) */
    /* Shared home: the settings that used to be in Settings → Shared space (share.js draws them here) */
    var shEl = document.getElementById('crShare'); shEl.hidden = TAB !== 'shared'; document.getElementById('crCards').hidden = TAB === 'shared'; if (TAB === 'shared' && window.ShareSpace && ShareSpace.drawSettings && !shEl._on) { shEl._on = 1; ShareSpace.drawSettings(); } if (TAB !== 'shared') shEl._on = 0;
    var dgEl = document.getElementById('crDiag'); dgEl.hidden = TAB !== 'system'; if (TAB === 'system' && window.DiagUI) window.DiagUI.mount(dgEl);
    if (keep) { var f = box.querySelector('#crCards form.' + keep.sel.split(' ').join('.') + ' input'); if (f) { f.value = keep.v; f.focus(); } }
    fillAsync();
    autoTodos(ls);
    report(ls, ov);
  }
  /* remember the state for the strip on Home, and alert when a light turns red (or amber) */
  function report(ls, ov) {
    if (ls.some(function (x) { return x[3] === 'wait'; })) return;
    var c = cfg(), prev = rj('dash.adminPrev', {}), now = {}, fresh = [];
    ls.forEach(function (x) { now[x[1]] = x[3]; var bad = x[3] === 'bad' || (c.alerts === 'amber' && x[3] === 'warn'); if (bad && prev[x[1]] !== x[3]) fresh.push(x); });
    wj('dash.adminPrev', now);
    wj('dash.adminStatus', { ov: ov, bad: ls.filter(function (x) { return x[3] === 'bad' || x[3] === 'warn'; }).map(function (x) { return [x[1], x[3]]; }), at: Date.now() });
    var h = new Date().getHours(), qf = +c.quietFrom, qt = +c.quietTo, quiet = qf === qt ? false : qf < qt ? (h >= qf && h < qt) : (h >= qf || h < qt);
    if (!fresh.length || c.alerts === 'off' || quiet || !('Notification' in window) || Notification.permission !== 'granted' || !Object.keys(prev).length) return;
    try { new Notification(L('Admin: ', 'Admin: ') + fresh.map(function (x) { return x[1]; }).join(', '), { body: fresh.map(function (x) { return x[1] + ' – ' + x[2]; }).join('\n'), tag: 'dash-admin', icon: '/cmd/assets/icons/icon-192.png' }); } catch (e) {}
  }
  function fillAsync() {
    var ver = document.getElementById('crVer');
    if (ver && window.caches) caches.keys().then(function (k) { var v = k.filter(function (x) { return /^cmd-v/.test(x); }).sort().pop(); ver.textContent = v || '–'; }).catch(function () {});
    var st = document.getElementById('crStore'); if (!st) return;
    var ls = 0; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); ls += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch (e) {}
    var vault = (localStorage.getItem('dash.vault') || '').length;
    var mb = function (b) { return b > 1048576 ? (b / 1048576).toFixed(1).replace('.', NB ? ',' : '.') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' kB'; };
    var done = function (est) {
      st.innerHTML = '<ul class="cr-list"><li><span>' + L('Encrypted data', 'Kryptert data') + '</span><b>' + mb(vault) + '</b></li><li><span>' + L('Everything in this browser', 'Alt i denne nettleseren') + '</span><b>' + mb(ls) + '</b></li>' +
        (est ? '<li><span>' + L('Photos & files on this device', 'Bilder og filer på denne enheten') + '</span><b>' + mb(Math.max(0, (est.usage || 0) - ls)) + '</b></li>' : '') + '</ul>' +
        '<div class="cr-prog"><span style="width:' + Math.min(100, Math.round(vault / (25 * 1048576) * 100) || 1) + '%"></span></div><p class="cr-sub">' + L('Server limit per value: 25 MB – you use ', 'Servergrense per verdi: 25 MB – du bruker ') + Math.max(1, Math.round(vault / (25 * 1048576) * 100)) + ' %</p>';
    };
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(done, function () { done(null); }); else done(null);
  }

  /* ---------- the Website tab: the editors from Settings → jplundberg.com, a live preview and one publish bar ---------- */
  var TAB = 'overview'; try { TAB = sessionStorage.getItem('adTab') || (location.hash === '#website' ? 'website' : 'overview'); } catch (e) {}
  if (/^#(links|preview)$/.test(location.hash)) TAB = 'website';
  var wsHash = location.hash.match(/^#ws=([a-z]+)$/), startEd = null;
  if (wsHash) { TAB = 'website'; startEd = wsHash[1]; window.history.replaceState(null, '', location.pathname); }
  else if (location.hash === '#overview') { TAB = 'overview'; window.history.replaceState(null, '', location.pathname); }
  else if (location.hash === '#shared') { TAB = 'shared'; window.history.replaceState(null, '', location.pathname); }
  else if (location.hash === '#team') { TAB = 'team'; window.history.replaceState(null, '', location.pathname); }
  else if (/^#(system|report)$/.test(location.hash)) { TAB = 'system'; var wantReport = location.hash === '#report'; window.history.replaceState(null, '', location.pathname); if (wantReport) window.Vault.onUnlock(function () { setTimeout(function () { if (window.DiagUI) window.DiagUI.report(''); }, 900); }); }
  var ED = [['sections', 'layout-text-sidebar', L('Front page', 'Forside')], ['announce', 'megaphone', L('Announcement', 'Kunngjøring')], ['featured', 'star', L('Featured', 'Fremhevet')], ['texts', 'fonts', L('Texts', 'Tekster')],
    ['cv', 'file-earmark-person', L('CV & experience', 'CV og erfaring')], ['courses', 'mortarboard', L('Courses', 'Kurs')], ['socials', 'share', L('Socials', 'Sosiale medier')], ['progress', 'bullseye', L('Project progress', 'Prosjektfremdrift')], ['content', 'journal-check', L('Articles & projects', 'Artikler og prosjekter')]];
  var edCur = startEd && ED.some(function (x) { return x[0] === startEd; }) ? startEd : 'sections', home = {};   /* where each settings page lived, to give it back */
  function pendingCount() {
    var n = 0, sd = window.SiteDraftSite ? window.SiteDraftSite() : null, td = window.SiteDraftTexts ? window.SiteDraftTexts() : null;
    if (sd && sd.saved && sd.draft) Object.keys(sd.draft).forEach(function (k) { if (k !== 'updated' && JSON.stringify(sd.draft[k]) !== JSON.stringify(sd.saved[k])) n++; });
    if (td && td.saved && td.draft) ['en', 'nb'].forEach(function (l) { var a = td.saved[l] || {}, b = td.draft[l] || {}; Object.keys(Object.assign({}, a, b)).forEach(function (k) { if ((a[k] || '') !== (b[k] || '')) n++; }); });
    return n;
  }
  function mountWs() {
    var ws = document.getElementById('crWs'); if (!ws) return;
    if (!ws.firstChild) {
      ws.innerHTML = '<div class="aw"><nav class="aw-nav" aria-label="' + L('Website parts', 'Deler av nettstedet') + '">' + ED.map(function (e) { return '<button type="button" data-awed="' + e[0] + '"><i class="bi bi-' + e[1] + '"></i><span>' + esc(e[2]) + '</span></button>'; }).join('') + '</nav>' +
        '<div class="aw-main"><div class="aw-ed st-panelish" id="awEd"></div><div class="aw-bar" id="awBar"></div></div>' +
        '<div class="aw-pv"><div class="aw-pvh"><b><i class="bi bi-eye"></i> ' + L('Preview', 'Forhåndsvisning') + '</b><span class="aw-lang"><button type="button" data-awlang="en" aria-pressed="true">EN</button><button type="button" data-awlang="nb" aria-pressed="false">NO</button></span>' +
        '<button type="button" class="icon-btn sm" data-awreload aria-label="' + L('Reload', 'Last inn på nytt') + '"><i class="bi bi-arrow-clockwise"></i></button></div>' +
        '<div class="aw-frame"><iframe id="awFrame" title="' + L('Preview of jplundberg.com', 'Forhåndsvisning av jplundberg.com') + '" loading="lazy"></iframe></div><p class="cr-sub" id="awNote">' + L('Your unpublished changes are shown in yellow. Sections you switch on appear after publishing.', 'Upubliserte endringer vises i gult. Seksjoner du slår på vises etter publisering.') + '</p></div></div>';
      ws.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-awed]'))) { openEd(b.dataset.awed); return; }
        if ((b = e.target.closest('[data-awlang]'))) { pvLang = b.dataset.awlang; ws.querySelectorAll('[data-awlang]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); loadPv(); return; }
        if (e.target.closest('[data-awreload]')) loadPv();
      });
      openEd(edCur); loadPv();
    }
  }
  function openEd(k) {
    var ed = document.getElementById('awEd'); if (!ed) return;
    var wasWrite = edCur === 'write';
    /* give the previous page back to the settings panel, take the new one */
    ed.querySelectorAll('.st-page').forEach(function (pg) { var h = home[pg.dataset.page]; pg.hidden = true; if (h) h.appendChild(pg); });
    var wr = document.getElementById('crWrite');
    if (k === 'write') {   /* the article/project writer (writer.js) draws here and uses the preview frame */
      if (!wr) { wr = document.createElement('div'); wr.id = 'crWrite'; ed.appendChild(wr); }
      edCur = k; box.classList.add('cr-writing'); document.querySelectorAll('[data-awed]').forEach(function (x) { x.setAttribute('aria-current', String(x.dataset.awed === 'content')); });
      var bar0 = document.getElementById('awBar'); if (bar0) bar0.hidden = true;
      return;
    }
    if (wr) wr.remove(); box.classList.remove('cr-writing');
    var slot0 = document.getElementById('awBar'); if (slot0) slot0.hidden = false;
    edCur = k;
    if (wasWrite) { var nt = document.getElementById('awNote'); if (nt) nt.textContent = L('Your unpublished changes are shown in yellow. Sections you switch on appear after publishing.', 'Upubliserte endringer vises i gult. Seksjoner du slår på vises etter publisering.'); loadPv(); }
    var pg = document.querySelector('#settings .st-page[data-page="' + k + '"]'); if (!pg) return;
    home[k] = pg.parentNode; ed.appendChild(pg); pg.hidden = false; edCur = k;
    pvJump = ''; var awEl = document.querySelector('#crWs .aw'); if (awEl) awEl.classList.toggle('aw-follow', /^(cv|courses|sections|featured|progress|content|texts)$/.test(k));
    var bar = document.getElementById('wsBar'), slot = document.getElementById('awBar');
    if (bar && slot && bar.parentNode !== slot) { home.__bar = home.__bar || bar.parentNode; slot.appendChild(bar); }
    document.querySelectorAll('[data-awed]').forEach(function (x) { x.setAttribute('aria-current', String(x.dataset.awed === k)); });
    window.dispatchEvent(new CustomEvent('st:page', { detail: k }));
    setTimeout(applyPv, 600);
  }
  /* preview: the real page in a frame, with your drafts written into it */
  var pvLang = 'en', pvT = null;
  function loadPv() { var f = document.getElementById('awFrame'); if (!f) return; if (edCur === 'write') return; pvJump = ''; f.removeAttribute('srcdoc'); f.onload = function () { setTimeout(applyPv, 60); }; f.src = (pvLang === 'nb' ? '/no/' : '/') + '?preview=' + Date.now(); }
  var PV_SEC = { cv: 'resume', courses: 'courses', featured: 'projects', progress: 'projects', socials: 'contact', content: 'articles' }, pvJump = '';
  function jumpPv() {
    var f = document.getElementById('awFrame'), d = f && f.contentDocument, id = PV_SEC[edCur];
    if (!d || !d.body || !id || pvJump === edCur + pvLang) return;
    var el = d.getElementById(id); if (!el) return;
    pvJump = edCur + pvLang;
    try { d.documentElement.style.scrollBehavior = 'auto'; (d.scrollingElement || d.documentElement).scrollTop = el.getBoundingClientRect().top + (d.scrollingElement || d.documentElement).scrollTop - 10; } catch (e) {}
  }
  function applyPv() {
    if (edCur === 'write') return;
    setTimeout(jumpPv, 50);
    var f = document.getElementById('awFrame'), d = f && f.contentDocument; if (!d || !d.body) return;
    var mark = function (el) { if (el && el.style) { el.style.outline = '2px dashed #d9a400'; el.style.outlineOffset = '3px'; el.style.background = 'rgba(217,164,0,.12)'; } };
    var td = window.SiteDraftTexts ? window.SiteDraftTexts() : null;
    if (td && td.draft && td.defaults) {
      var live = Object.assign({}, td.defaults[pvLang] || {}, (td.saved || {})[pvLang] || {}), want = Object.assign({}, td.defaults[pvLang] || {}, td.draft[pvLang] || {});
      /* one walk over the page; a text we already swapped remembers its key, so typing keeps updating it */
      var nodes = [], w = d.createTreeWalker(d.body, 4), n;
      while ((n = w.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
      Object.keys(want).forEach(function (k) {
        var a = String(live[k] || '').trim(), b = String(want[k] || '').trim(); if (!a) return;
        nodes.forEach(function (n) {
          var t = n.__pvKey === k ? null : n.nodeValue.replace(/\s+/g, ' ').trim();
          if (n.__pvKey === k || (a !== b && !n.__pvKey && (t === a || (a.length > 30 && t.indexOf(a.slice(0, 30)) === 0)))) {
            if (n.nodeValue !== b) n.nodeValue = b || a; n.__pvKey = k;
            if (a !== b) mark(n.parentElement); else if (n.parentElement && n.parentElement.style) { n.parentElement.style.outline = ''; n.parentElement.style.background = ''; }
          }
        });
      });
    }
    var sd = window.SiteDraftSite ? window.SiteDraftSite() : null;
    if (sd && sd.draft) {
      var dr = sd.draft, sv = sd.saved || {};
      var an = dr.announcement || {}, el = d.getElementById('announce'), txt = an[pvLang] || an.en;
      if (JSON.stringify(an) !== JSON.stringify(sv.announcement || {})) {
        if (an.on && txt) { if (!el) { el = d.createElement('div'); el.className = 'announce'; el.id = 'announce'; el.innerHTML = '<i class="bi bi-megaphone-fill"></i> <span class="announce-text"></span>'; d.body.insertBefore(el, d.body.firstChild); } var at = el.querySelector('.announce-text'); if (at) at.textContent = txt; mark(el); }
        else if (el) el.remove();
      }
      var nw = dr.now || {}, nt = nw[pvLang] || nw.en, hn = d.querySelector('.hero-now');
      if (JSON.stringify(nw) !== JSON.stringify(sv.now || {}) && hn) { var strong = hn.querySelector('strong'); hn.innerHTML = '<span class="now-dot"></span>' + (strong ? strong.outerHTML : '') + ' '; hn.appendChild(d.createTextNode(nt || '')); hn.style.display = nt ? '' : 'none'; mark(hn); }
      /* jobs (CV & experience): the Experience timeline on the front page is drawn from your draft */
      var exD = (dr.experience || {})[pvLang] || [], exS = (sv.experience || {})[pvLang] || [], tl = d.querySelector('#resume .timeline');
      if (tl && exD.length && JSON.stringify(exD) !== JSON.stringify(exS)) {
        tl.innerHTML = exD.map(function (j) { return '<div class="resume-item"><h4>' + esc(j.title) + '</h4><h5>' + esc(j.dates) + '</h5><p class="company">' + esc(j.company) + '</p>' + ((j.points || []).length ? '<ul>' + j.points.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>'; }).join('');
        mark(tl);
      }
      (dr.sections || []).forEach(function (x) { var sec = d.getElementById(x.id); if (sec && x.on === false) { sec.style.opacity = '.25'; sec.style.filter = 'grayscale(1)'; mark(sec); } });
    }
  }
  /* from the Settings panel's website rows (website.js) */
  window.addEventListener('admin:goto', function (e) {
    var k = e.detail;
    if (k === 'write') { if (window.ArticleWriter) window.ArticleWriter.open({ col: 'articles', isNew: true }); return; }
    if (k === 'system' || k === 'report') { TAB = 'system'; try { sessionStorage.setItem('adTab', TAB); } catch (x) {} draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); if (k === 'report' && window.DiagUI) setTimeout(function () { window.DiagUI.report(''); }, 200); return; }
    if (k === 'shared') { TAB = 'shared'; try { sessionStorage.setItem('adTab', TAB); } catch (x) {} draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (k === 'overview' || k === 'visitors') { TAB = 'overview'; try { sessionStorage.setItem('adTab', TAB); } catch (x) {} draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    window.CrWorkspace.open(ED.some(function (x) { return x[0] === k; }) ? k : 'sections');
  });
  window.CrWorkspace = { open: function (k) {
    if (TAB !== 'website') { TAB = 'website'; try { sessionStorage.setItem('adTab', TAB); } catch (x) {} draw(); }
    mountWs(); openEd(k); var w = document.getElementById('crWs'); if (w && w.scrollIntoView) w.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } };
  /* typing: the preview updates almost at once; the tab's change count is updated without redrawing the whole page */
  var cntT = null;
  window.addEventListener('site:draft', function () {
    clearTimeout(pvT); pvT = setTimeout(applyPv, 120);
    clearTimeout(cntT); cntT = setTimeout(function () {
      var b = document.querySelector('[data-crtab="website"]'); if (!b) return;
      var n = pendingCount(), c = b.querySelector('.hl-count');
      if (n && !c) { c = document.createElement('span'); c.className = 'hl-count'; b.appendChild(document.createTextNode(' ')); b.appendChild(c); }
      if (c) { if (n) c.textContent = n; else c.remove(); }
    }, 600);
  });
  window.addEventListener('site:published', function () { setTimeout(loadPv, 2500); });
  /* on this page, Settings → jplundberg.com rows open the Website tab instead */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#settings [data-go]'); if (!b) return;
    var k = b.dataset.go; if (!ED.some(function (x) { return x[0] === k; }) && k !== 'texts') return;
    e.preventDefault(); e.stopPropagation();
    var close = document.querySelector('#settings [data-close], #stClose'); if (close) close.click();
    TAB = 'website'; edCur = k; draw(); setTimeout(function () { openEd(k); }, 50);
  }, true);

  /* ---------- actions ---------- */
  function openSettings(page) {
    var a = document.createElement('a'); a.href = '/cmd/?settings=' + page; document.body.appendChild(a); a.click(); a.remove();
  }
  box.addEventListener('click', function (e) {
    if (e.target.closest('#crWs, #crDiag')) return;
    var b;
    if ((b = e.target.closest('[data-crtab]'))) { TAB = b.dataset.crtab; try { sessionStorage.setItem('adTab', TAB); } catch (x) {} draw(); if (TAB === 'website') runContent(); return; }
    if (e.target.closest('[data-crrun]')) { refreshAll(); logIt(L('Ran all checks', 'Kjørte alle sjekker'), 'arrow-clockwise'); return; }
    if ((b = e.target.closest('[data-credit]'))) { var q0 = b.dataset.credit.split('|'); window.dispatchEvent(new CustomEvent('article:open', { detail: { col: q0[0], ref: q0[1] } })); return; }
    if ((b = e.target.closest('[data-crnew]'))) { window.dispatchEvent(new CustomEvent('article:open', { detail: { col: b.dataset.crnew, isNew: true } })); return; }
    if (e.target.closest('[data-crmanage]')) { TAB = 'website'; draw(); setTimeout(function () { openEd('content'); var w = document.getElementById('crWs'); if (w) w.scrollIntoView({ behavior: 'smooth' }); }, 60); return; }
    if (e.target.closest('[data-crlinks]')) { runLinks(); return; }
    if (e.target.closest('[data-crself]')) { if (window.Diag && window.Diag.selfCheck) { Promise.resolve(window.Diag.selfCheck(true)).then(function () { draw(); toast('<i class="bi bi-heart-pulse"></i> ' + L('Self-check done', 'Selvsjekk ferdig')); }); } return; }
    if ((b = e.target.closest('[data-crtododel]'))) { var t1 = Fe.tools(); t1.admintodo = todos().filter(function (x) { return x.id !== b.dataset.crtododel; }); Fe.saveTools(t1); return; }
    if ((b = e.target.closest('[data-cract]'))) {
      var k = b.dataset.cract;
      if (k === 'site') window.open('https://jplundberg.com/', '_blank', 'noopener');
      if (k === 'publish') openSettings('sections');
      if (k === 'settings') openSettings('adminset');
      if (k === 'backup') { var bb = document.getElementById('stBackup'); if (bb) { bb.click(); logIt(L('Downloaded a backup', 'Lastet ned sikkerhetskopi'), 'download'); setTimeout(draw, 1500); } }
      if (k === 'lock') { logIt(L('Locked the dashboard', 'Låste dashbordet'), 'lock'); setTimeout(function () { if (window.Vault.lock) window.Vault.lock(); }, 150); }
      if (k === 'report' && window.Diag && window.Diag.report) { var rep = window.Diag.report(); (navigator.clipboard ? navigator.clipboard.writeText(rep) : Promise.reject()).then(function () { toast('<i class="bi bi-clipboard-check"></i> ' + L('Report copied – no personal data', 'Rapport kopiert – ingen personopplysninger')); }, function () {}); }
    }
  });
  box.addEventListener('change', function (e) {
    if (e.target.closest('#crWs, #crDiag')) return;
    var t = e.target;
    if (t.dataset.crtodo) { var tt = Fe.tools(); (tt.admintodo || []).forEach(function (x) { if (x.id === t.dataset.crtodo) { x.done = t.checked; x.doneAt = t.checked ? Date.now() : null; } }); Fe.saveTools(tt); if (t.checked) logIt(L('Done: ', 'Gjort: ') + ((tt.admintodo || []).filter(function (x) { return x.id === t.dataset.crtodo; })[0] || {}).text, 'check2'); return; }
    if (t.dataset.crpub) {
      var q = t.dataset.crpub.split('|'), on = t.checked, key = 'pub' + q[0] + '|' + q[1];
      S.busy[key] = true;
      fetch('/cmd/api/content', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collection: q[0], ref: q[1], published: on }) })
        .then(function (r) { return r.json().then(function (j) { j._s = r.status; return j; }); }).then(function (j) {
          delete S.busy[key];
          if (j.ok) { S.content = { ok: true, json: { items: j.items } }; logIt((on ? L('Showed ', 'Viste ') : L('Hid ', 'Skjulte ')) + q[1], on ? 'eye' : 'eye-slash'); toast('<i class="bi bi-' + (on ? 'eye' : 'eye-slash') + '"></i> ' + (on ? L('Live on jplundberg.com in about a minute', 'Live på jplundberg.com om ca. ett minutt') : L('Hidden from jplundberg.com in about a minute', 'Skjult fra jplundberg.com om ca. ett minutt'))); }
          else toast('<i class="bi bi-exclamation-triangle"></i> ' + L('Didn’t change: ', 'Ble ikke endret: ') + (j.error || j._s));
          draw();
        }).catch(function () { delete S.busy[key]; toast('<i class="bi bi-wifi-off"></i> ' + L('No connection', 'Ingen forbindelse')); draw(); });
      draw();
    }
  });
  box.addEventListener('submit', function (e) {
    if (e.target.closest('#crWs, #crDiag')) return;
    e.preventDefault();
    var f = e.target, inp = f.querySelector('input'), v = inp ? inp.value.trim() : '';
    if (f.classList.contains('cr-pvf')) { runPreview(v || '/'); return; }
    if (f.classList.contains('cr-tdf') && v) { var tt = Fe.tools(); tt.admintodo = todos().concat([{ id: uid(), text: v.slice(0, 140) }]); Fe.saveTools(tt); inp.value = ''; }
  });

  /* ---------- refresh ---------- */
  var timer = null;
  function refreshAll() { runCore(); runVisitors(); runContent(); runCommits(); }
  function schedule() {
    clearInterval(timer); var m = cfg().refresh;
    if (m > 0) timer = setInterval(function () { if (!document.hidden && root.classList.contains('unlocked')) runCore(); }, m * 60000);
  }
  var started = false;
  function start() {
    started = true;
    draw(); refreshAll(); schedule();
    if (cfg().linkCheck === 'open') { var lk = rj('dash.adminLinks', null); if (!lk || Date.now() - (lk.at || 0) > 864e5) setTimeout(runLinks, 1500); }
  }
  window.Vault.onUnlock(function () { setTimeout(start, 100); });
  /* safety net: if the page was opened already unlocked and nothing started, start anyway */
  setTimeout(function () { if (!started && root.classList.contains('unlocked')) start(); else if (!box.innerHTML.trim() && root.classList.contains('unlocked')) draw(); }, 2500);
  if (root.classList.contains('unlocked')) start();
  var soon = function () { clearTimeout(soon.t); soon.t = setTimeout(draw, 120); };
  ['tools:change', 'dash:local', 'sync:state', 'clean:done'].forEach(function (ev) { window.addEventListener(ev, soon); });
  window.addEventListener('admin:cfg', function () { schedule(); draw(); });
})();
