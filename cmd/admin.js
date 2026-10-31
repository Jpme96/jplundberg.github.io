/* Admin – the control room (page /cmd/admin/).
   Status lights for the website, the server, sync, backups, security and keys; visitors; every article and project with a
   live/hidden switch; health checks you can run (speed, uptime from this device, broken links, link previews);
   errors and self-check; storage; an admin to-do list (some items added for you); an activity log; the changelog
   from GitHub; quick actions and ⌘K commands.
   Settings: dash.settings.admin (Settings → Admin page – panels, refresh, warning levels, key expiry date).
   Local only: dash.adminChecks (check history, this device), dash.tools.admintodo / adminlog (synced). */
(function () {
  "use strict";
  var box = document.getElementById('adRoot');
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
    return s < 90 ? L('just now', 'nå nettopp') : s < 3600 ? Math.round(s / 60) + L(' min ago', ' min siden') : s < 86400 ? Math.round(s / 3600) + L(' h ago', ' t siden') : Math.round(s / 86400) + L(' days ago', ' dager siden');
  }
  function toast(h) { if (window.Quick && window.Quick.toast) window.Quick.toast(h); }

  /* ---------- settings (Settings → Admin page) ---------- */
  var DEF = { tab: true, refresh: 5, backupWarn: 14, syncWarn: 24, speedWarn: 1500, ghExpiry: '2027-09-28', linkCheck: 'manual',
    panels: { status: true, actions: true, site: true, content: true, health: true, system: true, todo: true, log: true, changes: true } };
  function cfg() { var s = rj('dash.settings', {}) || {}; var a = Object.assign({}, DEF, s.admin || {}); a.panels = Object.assign({}, DEF.panels, (s.admin || {}).panels || {}); return a; }

  /* ---------- activity log + admin to-do (synced in dash.tools) ---------- */
  function T() { return Fe ? Fe.tools() : {}; }
  function logIt(t, icon) {
    if (!Fe) return; var tt = Fe.tools(), l = Array.isArray(tt.adminlog) ? tt.adminlog : [];
    l.unshift({ at: Date.now(), t: String(t).slice(0, 140), i: icon || 'dot' }); tt.adminlog = l.slice(0, 80); Fe.saveTools(tt);
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
    return Promise.all([timed('/cmd/api/ping'), timed('/cmd/api/site'), timed('/?admincheck=' + Date.now())]).then(function (r) {
      S.ping = r[0]; S.site = r[1]; S.speed = r[2];
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
    var bk = +(localStorage.getItem('dash.lastBackup') || 0), bd = bk ? (Date.now() - bk) / 864e5 : 999;
    out.push(['cloud-arrow-down', L('Backup', 'Sikkerhetskopi'), bk ? L('Downloaded ', 'Lastet ned ') + ago(bk) : L('Never downloaded', 'Aldri lastet ned'), bd > c.backupWarn * 2 ? 'bad' : bd > c.backupWarn ? 'warn' : 'ok']);
    /* security */
    var pk = !!localStorage.getItem('dash.pk'), rec = !!d._recCode;
    out.push(['shield-lock', L('Security', 'Sikkerhet'), [pk ? 'Face ID' : L('No Face ID', 'Ingen Face ID'), rec ? L('recovery code', 'gjenopprettingskode') : L('no recovery code', 'ingen gjenopprettingskode')].join(' · '), rec ? 'ok' : 'warn']);
    /* keys */
    var ex = c.ghExpiry ? Math.round((new Date(c.ghExpiry + 'T12:00') - new Date()) / 864e5) : null;
    out.push(['key', L('GitHub key', 'GitHub-nøkkel'), ex == null ? L('Expiry date not set', 'Utløpsdato ikke satt') : ex < 0 ? L('Expired ', 'Utløpt for ') + (-ex) + L(' days ago', ' dager siden') : L('Expires in ', 'Utløper om ') + ex + L(' days', ' dager'), ex == null ? 'warn' : ex < 0 ? 'bad' : ex <= 30 ? 'warn' : 'ok']);
    return out;
  }
  function overall(ls) { return ls.some(function (x) { return x[3] === 'bad'; }) ? 'bad' : ls.some(function (x) { return x[3] === 'warn'; }) ? 'warn' : ls.some(function (x) { return x[3] === 'wait'; }) ? 'wait' : 'ok'; }

  /* things that need you – added to the admin to-do automatically (removed again when solved) */
  function autoTodos(ls) {
    var c = cfg(), want = [];
    ls.forEach(function (x) {
      if (x[3] !== 'warn' && x[3] !== 'bad') return;
      if (x[0] === 'key') want.push(['key', L('Renew the GitHub key (Settings → jplundberg.com explains how)', 'Forny GitHub-nøkkelen (Innstillinger → jplundberg.com forklarer hvordan)')]);
      if (x[0] === 'cloud-arrow-down') want.push(['backup', L('Download an encrypted backup', 'Last ned en kryptert sikkerhetskopi')]);
      if (x[0] === 'shield-lock') want.push(['rec', L('Make a recovery code (Settings → Security)', 'Lag en gjenopprettingskode (Innstillinger → Sikkerhet)')]);
      if (x[0] === 'hdd-network' && x[3] === 'bad') want.push(['server', L('The server isn’t answering – check the Worker in Cloudflare', 'Serveren svarer ikke – sjekk Workeren i Cloudflare')]);
    });
    if (S.links && S.links.bad && S.links.bad.length) want.push(['links', L('Fix ', 'Rett ') + S.links.bad.length + L(' broken link(s) on the website', ' brutte lenke(r) på nettstedet')]);
    if (!Fe) return;
    var tt = Fe.tools(), l = Array.isArray(tt.admintodo) ? tt.admintodo : [], ch = false, keys = want.map(function (w) { return w[0]; });
    l = l.filter(function (x) { if (x.auto && keys.indexOf(x.auto) < 0) { ch = true; return false; } return true; });
    want.forEach(function (w) { if (!l.some(function (x) { return x.auto === w[0]; })) { l.push({ id: uid(), text: w[1], auto: w[0] }); ch = true; } });
    if (ch) { tt.admintodo = l; Fe.saveTools(tt); }
  }

  /* ---------- drawing ---------- */
  var LAB = { ok: L('OK', 'OK'), warn: L('Check', 'Sjekk'), bad: L('Needs you', 'Trenger deg'), wait: '…' };
  function card(id, icon, title, head, body, wide) {
    return '<section class="card ad-card' + (wide ? ' ad-wide' : '') + '" id="ad-' + id + '"><div class="card-head"><h2><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h2><div class="head-actions">' + (head || '') + '</div></div>' + body + '</section>';
  }
  function spark(vals, h) {
    var v = vals.filter(function (x) { return x != null; }); if (v.length < 2) return '';
    var max = Math.max.apply(null, v), W = 220, H = h || 36, n = vals.length;
    var pts = vals.map(function (x, i) { return x == null ? null : [(i / (n - 1)) * W, H - 3 - (x / max) * (H - 8)]; });
    var d = ''; pts.forEach(function (p) { if (p) d += (d ? ' L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); });
    return '<svg class="ad-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  function bars(rows, key) {
    if (!rows || !rows.length) return '';
    var max = Math.max.apply(null, rows.map(function (r) { return r[key]; }).concat([1]));
    return '<div class="ad-bars">' + rows.map(function (r) { return '<span style="height:' + Math.max(4, Math.round(r[key] / max * 100)) + '%" title="' + esc(r.name) + ': ' + r[key] + '"></span>'; }).join('') + '</div>';
  }
  function draw() {
    var c = cfg(), P = c.panels, ls = lights(), ov = overall(ls), h = history(), d30 = h.filter(function (x) { return Date.now() - x.at < 30 * 864e5; });
    var up = d30.length ? Math.round(d30.filter(function (x) { return x.api != null && x.web != null; }).length / d30.length * 1000) / 10 : null;
    var html = '';
    /* command bar */
    html += '<div class="ad-bar ad-' + ov + '"><span class="ad-pulse" aria-hidden="true"></span><b>' + esc(ov === 'ok' ? L('All systems normal', 'Alle systemer normale') : ov === 'warn' ? L('Something to look at', 'Noe å se på') : ov === 'bad' ? L('Something needs you', 'Noe trenger deg') : L('Checking …', 'Sjekker …')) + '</b>' +
      '<span class="ad-meta">' + (S.checkedAt ? L('Checked ', 'Sjekket ') + ago(S.checkedAt) : '') + (c.refresh ? ' · ' + L('auto every ', 'automatisk hvert ') + c.refresh + ' min' : '') + '</span>' +
      '<button type="button" class="pill-btn ad-run" data-adrun' + (S.busy.core ? ' disabled' : '') + '><i class="bi bi-arrow-clockwise' + (S.busy.core ? ' ad-spin' : '') + '"></i> ' + L('Check everything', 'Sjekk alt') + '</button></div>';
    if (P.status) html += '<div class="ad-lights">' + ls.map(function (x) {
      return '<div class="ad-light ad-' + x[3] + '"><i class="bi bi-' + x[0] + '"></i><div><b>' + esc(x[1]) + '</b><small>' + esc(x[2]) + '</small></div><span class="ad-dot" title="' + LAB[x[3]] + '"></span></div>';
    }).join('') + '</div>';
    if (P.actions) html += '<div class="ad-actions">' + [
      ['globe2', L('Open the site', 'Åpne nettstedet'), 'data-adact="site"'], ['cloud-upload', L('Publish website', 'Publiser nettstedet'), 'data-adact="publish"'], ['download', L('Download backup', 'Last ned sikkerhetskopi'), 'data-adact="backup"'],
      ['lock', L('Lock now', 'Lås nå'), 'data-adact="lock"'], ['clipboard2-pulse', L('Copy report', 'Kopier rapport'), 'data-adact="report"'], ['sliders', L('Admin settings', 'Admin-innstillinger'), 'data-adact="settings"']
    ].map(function (a) { return '<button type="button" class="ad-act" ' + a[2] + '><i class="bi bi-' + a[0] + '"></i><span>' + esc(a[1]) + '</span></button>'; }).join('') + '</div>';
    html += '<div class="ad-grid">';
    /* website: visitors */
    if (P.site) {
      var v = S.visitors && S.visitors.json, body;
      if (!S.visitors) body = '<p class="muted">' + L('Loading …', 'Laster …') + '</p>';
      else if (!S.visitors.ok || !v) body = '<p class="muted">' + L('Visitor numbers aren’t available (Cloudflare analytics not set up or not answering).', 'Besøkstall er ikke tilgjengelig (Cloudflare-statistikk ikke satt opp eller svarer ikke).') + '</p>';
      else body = '<div class="ad-kpis"><div><b data-cu>' + nf.format(v.visits || 0) + '</b><small>' + L('visits · 7 days', 'besøk · 7 dager') + '</small></div><div><b>' + nf.format(v.views || 0) + '</b><small>' + L('page views', 'sidevisninger') + '</small></div></div>' + bars(v.perDay, 'visits') +
        ((v.pages || []).length ? '<ul class="ad-list">' + v.pages.slice(0, 5).map(function (p) { return '<li><span>' + esc(p.name || '/') + '</span><b>' + p.visits + '</b></li>'; }).join('') + '</ul>' : '') +
        ((v.referrers || []).filter(function (r) { return r.name; }).length ? '<p class="ad-sub">' + L('From', 'Fra') + ': ' + v.referrers.filter(function (r) { return r.name; }).slice(0, 4).map(function (r) { return esc(r.name) + ' (' + r.visits + ')'; }).join(' · ') + '</p>' : '');
      html += card('site', 'bar-chart-line', L('Visitors', 'Besøkende'), '<a class="icon-btn sm" href="https://jplundberg.com/" target="_blank" rel="noopener" aria-label="' + L('Open the site', 'Åpne nettstedet') + '"><i class="bi bi-box-arrow-up-right"></i></a>', body);
    }
    /* uptime + speed */
    if (P.health) {
      var last = h.slice(-40), sp = S.speed;
      html += card('uptime', 'activity', L('Uptime & speed', 'Oppetid og fart'), '', '<div class="ad-kpis"><div><b>' + (up == null ? '–' : String(up).replace('.', NB ? ',' : '.') + ' %') + '</b><small>' + L('up · 30 days', 'oppe · 30 dager') + '</small></div><div><b>' + (sp && sp.ms != null ? sp.ms + ' ms' : '–') + '</b><small>' + L('front page', 'forsiden') + '</small></div><div><b>' + (S.ping && S.ping.ms != null ? S.ping.ms + ' ms' : '–') + '</b><small>' + L('server', 'server') + '</small></div></div>' +
        spark(last.map(function (x) { return x.web; })) + '<p class="ad-sub">' + d30.length + L(' checks from this device (every time Admin is open and refreshing)', ' sjekker fra denne enheten (hver gang Admin er åpen og oppdaterer)') + '</p>');
      var lk = S.links || rj('dash.adminLinks', null);
      html += card('links', 'link-45deg', L('Broken links', 'Brutte lenker'), '<button type="button" class="icon-btn sm" data-adlinks aria-label="' + L('Check all pages', 'Sjekk alle sider') + '"' + (S.busy.links ? ' disabled' : '') + '><i class="bi bi-arrow-clockwise' + (S.busy.links ? ' ad-spin' : '') + '"></i></button>',
        !lk ? '<p class="muted">' + L('Checks every page in the sitemap for errors.', 'Sjekker alle sider i sitemapet for feil.') + '</p><button type="button" class="text-btn" data-adlinks><i class="bi bi-play"></i> ' + L('Run the check', 'Kjør sjekken') + '</button>'
          : S.busy.links ? '<div class="ad-prog"><span style="width:' + (lk.total ? Math.round(lk.done / lk.total * 100) : 5) + '%"></span></div><p class="ad-sub">' + lk.done + ' / ' + (lk.total || '…') + '</p>'
            : lk.bad.length ? '<ul class="ad-list bad">' + lk.bad.slice(0, 8).map(function (b) { return '<li><span>' + esc(b.u) + '</span><b>' + (b.s || L('no answer', 'ikke svar')) + '</b></li>'; }).join('') + '</ul>'
              : '<p class="ad-okline"><i class="bi bi-check-circle-fill"></i> ' + lk.total + L(' pages, all fine', ' sider, alle i orden') + ' · ' + ago(lk.at) + '</p>');
      var pv = S.preview;
      html += card('preview', 'share', L('Link preview', 'Lenkeforhåndsvisning'), '', '<form class="ad-pvf"><input placeholder="/articles/… ' + L('or a full link', 'eller en hel lenke') + '" value="' + esc(pv ? pv.path : '/') + '" aria-label="' + L('Page to preview', 'Side å forhåndsvise') + '"><button type="submit" class="icon-btn" aria-label="' + L('Preview', 'Forhåndsvis') + '"><i class="bi bi-eye"></i></button></form>' +
        (!pv ? '<p class="ad-sub">' + L('See what LinkedIn, Messages and Facebook will show before you share a page.', 'Se hva LinkedIn, Meldinger og Facebook viser før du deler en side.') + '</p>'
          : pv.loading ? '<p class="muted">' + L('Loading …', 'Laster …') + '</p>' : pv.err ? '<p class="muted">' + L('Couldn’t read that page.', 'Fikk ikke lest den siden.') + '</p>'
            : '<div class="ad-og">' + (pv.img ? '<img src="' + esc(pv.img) + '" alt="" loading="lazy">' : '<div class="ad-og-noimg">' + L('No image', 'Ingen bilde') + '</div>') + '<div><small>JPLUNDBERG.COM</small><b>' + esc(pv.title) + '</b><p>' + esc(pv.desc || L('No description – add a summary to the page.', 'Ingen beskrivelse – legg til et sammendrag på siden.')) + '</p></div></div>'));
    }
    html += '</div>';
    /* articles & projects */
    if (P.content) {
      var cj = S.content && S.content.json, items = cj && Array.isArray(cj.items) ? cj.items : null, by = {};
      if (items) items.forEach(function (x) { var k = x.collection + '|' + x.ref; (by[k] = by[k] || []).push(x); });
      var rows = items ? Object.keys(by).map(function (k) { var l = by[k], en = l.filter(function (x) { return x.lang === 'en'; })[0] || l[0]; return { k: k, col: en.collection, ref: en.ref, title: en.title, date: en.date, on: l.every(function (x) { return x.published; }), langs: l.map(function (x) { return x.lang; }).sort().join(' · ').toUpperCase() }; })
        .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }) : [];
      html += card('content', 'journal-check', L('Articles & projects', 'Artikler og prosjekter'), items ? '<span class="muted ad-count">' + rows.filter(function (r) { return r.on; }).length + ' / ' + rows.length + L(' live', ' live') + '</span>' : '',
        !S.content ? '<p class="muted">' + L('Loading …', 'Laster …') + '</p>' : !items ? '<p class="muted">' + L('Couldn’t load the list (GitHub key?).', 'Fikk ikke lastet listen (GitHub-nøkkel?).') + '</p>'
          : '<ul class="ad-items">' + rows.map(function (r) {
            return '<li><i class="bi bi-' + (r.col === 'projects' ? 'kanban' : 'journal-text') + '"></i><span class="ad-it"><b>' + esc(r.title) + '</b><small>' + esc((r.date || '') + ' · ' + r.langs) + '</small></span>' +
              '<label class="ad-sw"><span class="' + (r.on ? 'on' : '') + '">' + (r.on ? L('Live', 'Live') : L('Hidden', 'Skjult')) + '</span><input type="checkbox" class="switch" data-adpub="' + esc(r.col + '|' + r.ref) + '"' + (r.on ? ' checked' : '') + (S.busy['pub' + r.k] ? ' disabled' : '') + ' aria-label="' + esc(r.title) + '"></label></li>';
          }).join('') + '</ul>', true);
    }
    html += '<div class="ad-grid">';
    /* system */
    if (P.system) {
      var D = window.Diag, errs = D && D.list ? D.list() : [], dst = D && D.state ? D.state() : {}, chk = dst.check || null;
      html += card('system', 'cpu', L('System', 'System'), '<button type="button" class="icon-btn sm" data-adself aria-label="' + L('Run the self-check', 'Kjør selvsjekken') + '"><i class="bi bi-heart-pulse"></i></button>',
        '<ul class="ad-list">' +
        '<li><span>' + L('Daily self-check', 'Daglig selvsjekk') + '</span><b class="' + (chk && (chk.issues || []).length ? 'neg' : '') + '">' + (chk ? ((chk.issues || []).length ? (chk.issues || []).length + L(' issue(s)', ' problem(er)') : L('Fine', 'Fint')) + ' · ' + ago(chk.t) : '–') + '</b></li>' +
        '<li><span>' + L('Errors logged', 'Feil logget') + '</span><b class="' + (errs.length ? 'neg' : '') + '">' + errs.length + '</b></li>' +
        '<li><span>Apple Health</span><b>' + (Fe && Fe.on('ahealth') ? ago(dst.healthPull) : L('off', 'av')) + '</b></li>' +
        '<li><span>' + L('App version', 'App-versjon') + '</span><b id="adVer">…</b></li></ul>' +
        (errs.length ? '<ul class="ad-errs">' + errs.slice(0, 4).map(function (e) { return '<li>' + esc(String(e.msg || e.m || e.message || e).slice(0, 110)) + (e.n > 1 ? ' ×' + e.n : '') + '</li>'; }).join('') + '</ul>' : ''));
      html += card('storage', 'database', L('Storage', 'Lagring'), '', '<div id="adStore"><p class="muted">' + L('Counting …', 'Teller …') + '</p></div>');
    }
    /* admin to-do */
    if (P.todo) {
      var tl = todos(), open = tl.filter(function (x) { return !x.done; });
      html += card('todo', 'list-check', L('Admin to-do', 'Admin-gjøremål'), open.length ? '<span class="hl-count">' + open.length + '</span>' : '',
        '<ul class="ad-todo">' + tl.slice(0, 12).map(function (x) {
          return '<li class="' + (x.done ? 'done' : '') + '"><label><input type="checkbox" data-adtodo="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '><span>' + esc(x.text) + '</span></label>' + (x.auto ? '<span class="ad-auto" title="' + L('Added for you', 'Lagt til for deg') + '"><i class="bi bi-magic"></i></span>' : '<button type="button" class="icon-btn sm" data-adtododel="' + esc(x.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x"></i></button>') + '</li>';
        }).join('') + '</ul>' + (!tl.length ? '<p class="ad-okline"><i class="bi bi-check-circle-fill"></i> ' + L('Nothing to do – things that need you appear here by themselves.', 'Ingenting å gjøre – ting som trenger deg dukker opp her av seg selv.') + '</p>' : '') +
        '<form class="hl-shopadd ad-tdf"><input placeholder="' + L('Add – e.g. update the CV', 'Legg til – f.eks. oppdater CV-en') + '" maxlength="140" aria-label="' + L('Add an admin task', 'Legg til en admin-oppgave') + '"><button type="submit" class="icon-btn" aria-label="' + L('Add', 'Legg til') + '"><i class="bi bi-plus-lg"></i></button></form>');
    }
    html += '</div><div class="ad-grid">';
    /* activity log */
    if (P.log) {
      var lg = Array.isArray(T().adminlog) ? T().adminlog : [];
      html += card('log', 'clock-history', L('Activity', 'Aktivitet'), '', lg.length ? '<ul class="ad-log">' + lg.slice(0, 10).map(function (x) { return '<li><i class="bi bi-' + esc(x.i || 'dot') + '"></i><span>' + esc(x.t) + '</span><small>' + ago(x.at) + '</small></li>'; }).join('') + '</ul>' : '<p class="muted">' + L('Publishing, switches and checks from here are listed as they happen.', 'Publisering, brytere og sjekker herfra listes når de skjer.') + '</p>');
    }
    /* changelog */
    if (P.changes) {
      var cm = S.commits;
      html += card('changes', 'git', L('Changes to the site & dashboard', 'Endringer i nettsted og dashbord'), '<a class="icon-btn sm" href="https://github.com/Jpme96/jplundberg.github.io/commits/main" target="_blank" rel="noopener" aria-label="GitHub"><i class="bi bi-box-arrow-up-right"></i></a>',
        cm == null ? '<p class="muted">' + L('Loading …', 'Laster …') + '</p>' : cm === 'off' ? '<p class="muted">' + L('GitHub didn’t answer – open the list on GitHub instead.', 'GitHub svarte ikke – åpne listen på GitHub i stedet.') + '</p>'
          : '<ul class="ad-log">' + cm.map(function (x) { var msg = String((x.commit || {}).message || '').split('\n')[0], at = new Date(((x.commit || {}).author || {}).date || 0).getTime(); return '<li><i class="bi bi-dot"></i><span>' + esc(msg.slice(0, 110)) + '</span><small>' + ago(at) + '</small></li>'; }).join('') + '</ul>');
    }
    html += '</div>';
    var keep = document.activeElement && document.activeElement.closest && document.activeElement.closest('#adRoot form') ? { sel: document.activeElement.closest('form').className, v: document.activeElement.value } : null;
    box.innerHTML = html;
    if (keep) { var f = box.querySelector('form.' + keep.sel.split(' ').join('.') + ' input'); if (f) { f.value = keep.v; f.focus(); } }
    fillAsync();
    autoTodos(ls);
  }
  function fillAsync() {
    var ver = document.getElementById('adVer');
    if (ver && window.caches) caches.keys().then(function (k) { var v = k.filter(function (x) { return /^cmd-v/.test(x); }).sort().pop(); ver.textContent = v || '–'; }).catch(function () {});
    var st = document.getElementById('adStore'); if (!st) return;
    var ls = 0; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); ls += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch (e) {}
    var vault = (localStorage.getItem('dash.vault') || '').length;
    var mb = function (b) { return b > 1048576 ? (b / 1048576).toFixed(1).replace('.', NB ? ',' : '.') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' kB'; };
    var done = function (est) {
      st.innerHTML = '<ul class="ad-list"><li><span>' + L('Encrypted data', 'Kryptert data') + '</span><b>' + mb(vault) + '</b></li><li><span>' + L('Everything in this browser', 'Alt i denne nettleseren') + '</span><b>' + mb(ls) + '</b></li>' +
        (est ? '<li><span>' + L('Photos & files on this device', 'Bilder og filer på denne enheten') + '</span><b>' + mb(Math.max(0, (est.usage || 0) - ls)) + '</b></li>' : '') + '</ul>' +
        '<div class="ad-prog"><span style="width:' + Math.min(100, Math.round(vault / (25 * 1048576) * 100) || 1) + '%"></span></div><p class="ad-sub">' + L('Server limit per value: 25 MB – you use ', 'Servergrense per verdi: 25 MB – du bruker ') + Math.max(1, Math.round(vault / (25 * 1048576) * 100)) + ' %</p>';
    };
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(done, function () { done(null); }); else done(null);
  }

  /* ---------- actions ---------- */
  function openSettings(page) {
    var a = document.createElement('a'); a.href = '/cmd/?settings=' + page; document.body.appendChild(a); a.click(); a.remove();
  }
  box.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-adrun]')) { refreshAll(); logIt(L('Ran all checks', 'Kjørte alle sjekker'), 'arrow-clockwise'); return; }
    if (e.target.closest('[data-adlinks]')) { runLinks(); return; }
    if (e.target.closest('[data-adself]')) { if (window.Diag && window.Diag.selfCheck) { Promise.resolve(window.Diag.selfCheck(true)).then(function () { draw(); toast('<i class="bi bi-heart-pulse"></i> ' + L('Self-check done', 'Selvsjekk ferdig')); }); } return; }
    if ((b = e.target.closest('[data-adtododel]'))) { var t1 = Fe.tools(); t1.admintodo = todos().filter(function (x) { return x.id !== b.dataset.adtododel; }); Fe.saveTools(t1); return; }
    if ((b = e.target.closest('[data-adact]'))) {
      var k = b.dataset.adact;
      if (k === 'site') window.open('https://jplundberg.com/', '_blank', 'noopener');
      if (k === 'publish') openSettings('sections');
      if (k === 'settings') openSettings('adminset');
      if (k === 'backup') { var bb = document.getElementById('stBackup'); if (bb) { bb.click(); logIt(L('Downloaded a backup', 'Lastet ned sikkerhetskopi'), 'download'); setTimeout(draw, 1500); } }
      if (k === 'lock') { logIt(L('Locked the dashboard', 'Låste dashbordet'), 'lock'); setTimeout(function () { if (window.Vault.lock) window.Vault.lock(); }, 150); }
      if (k === 'report' && window.Diag && window.Diag.report) { var rep = window.Diag.report(); (navigator.clipboard ? navigator.clipboard.writeText(rep) : Promise.reject()).then(function () { toast('<i class="bi bi-clipboard-check"></i> ' + L('Report copied – no personal data', 'Rapport kopiert – ingen personopplysninger')); }, function () {}); }
    }
  });
  box.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.adtodo) { var tt = Fe.tools(); (tt.admintodo || []).forEach(function (x) { if (x.id === t.dataset.adtodo) { x.done = t.checked; x.doneAt = t.checked ? Date.now() : null; } }); Fe.saveTools(tt); if (t.checked) logIt(L('Done: ', 'Gjort: ') + ((tt.admintodo || []).filter(function (x) { return x.id === t.dataset.adtodo; })[0] || {}).text, 'check2'); return; }
    if (t.dataset.adpub) {
      var q = t.dataset.adpub.split('|'), on = t.checked, key = 'pub' + q[0] + '|' + q[1];
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
    e.preventDefault();
    var f = e.target, inp = f.querySelector('input'), v = inp ? inp.value.trim() : '';
    if (f.classList.contains('ad-pvf')) { runPreview(v || '/'); return; }
    if (f.classList.contains('ad-tdf') && v) { var tt = Fe.tools(); tt.admintodo = todos().concat([{ id: uid(), text: v.slice(0, 140) }]); Fe.saveTools(tt); inp.value = ''; }
  });

  /* ---------- refresh ---------- */
  var timer = null;
  function refreshAll() { runCore(); runVisitors(); runContent(); runCommits(); }
  function schedule() {
    clearInterval(timer); var m = cfg().refresh;
    if (m > 0) timer = setInterval(function () { if (!document.hidden && root.classList.contains('unlocked')) runCore(); }, m * 60000);
  }
  function start() {
    draw(); refreshAll(); schedule();
    if (cfg().linkCheck === 'open') { var lk = rj('dash.adminLinks', null); if (!lk || Date.now() - (lk.at || 0) > 864e5) setTimeout(runLinks, 1500); }
  }
  window.Vault.onUnlock(function () { setTimeout(start, 100); });
  if (root.classList.contains('unlocked')) start();
  var soon = function () { clearTimeout(soon.t); soon.t = setTimeout(draw, 120); };
  ['tools:change', 'dash:local', 'sync:state'].forEach(function (ev) { window.addEventListener(ev, soon); });
  window.addEventListener('admin:cfg', function () { schedule(); draw(); });
})();
