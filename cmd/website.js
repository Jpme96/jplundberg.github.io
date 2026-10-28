/* Settings → jplundberg.com: announcement, front page sections, featured content, visitors.
   Changes are saved by the dashboard's Cloudflare Worker to _data/site.json in GitHub,
   and GitHub Pages publishes them in about a minute. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var SECTION = {
    about: ['person', 'About'], resume: ['briefcase', 'Experience'],
    projects: ['kanban', 'Projects'], articles: ['journal-text', 'Latest articles']
  };
  var EDIT_PAGES = ['announce', 'sections', 'featured'];

  var saved = null, draft = null, sha = null, content = null, loading = null, publishing = false, problem = '';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function dirty() { return saved && JSON.stringify(strip(saved)) !== JSON.stringify(strip(draft)); }
  function strip(o) { var c = clone(o); delete c.updated; return c; }

  function load() {
    if (loading) return loading;
    status('Loading…');
    loading = Promise.all([
      fetch('api/site', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; });
      }),
      fetch('content.json', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).catch(function () { return { articles: [], projects: [] }; })
    ]).then(function (res) {
      var j = res[0];
      content = res[1];
      if (!j.settings) {
        problem = j.error === 'github not configured' ? 'setup' : 'error';
        throw new Error(j.error || 'failed');
      }
      problem = '';
      saved = j.settings; sha = j.sha; draft = clone(saved);
      fill(); summary(); status('');
    }).catch(function () {
      loading = null;
      status(problem === 'setup'
        ? 'Connect GitHub first: add GITHUB_TOKEN to the Worker (see the guide).'
        : 'Couldn’t load the website settings. Check your connection and try again.', true);
      summary();
    });
    return loading;
  }

  /* ---------- fill the pages from the draft ---------- */
  function fill() {
    if (!draft) return;
    var a = draft.announcement;
    $('wsAnnOn').checked = a.on;
    if (document.activeElement !== $('wsAnnEn')) $('wsAnnEn').value = a.en;
    if (document.activeElement !== $('wsAnnNb')) $('wsAnnNb').value = a.nb;
    var opts = '<option value="">No link</option>' + groupTitles(content.articles).map(function (x) {
      return '<option value="' + esc(x.url) + '">Article: ' + esc(x.title) + '</option>';
    }).join('') + groupTitles(content.projects).map(function (x) {
      return '<option value="' + esc(x.url) + '">Project: ' + esc(x.title) + '</option>';
    }).join('') + '<option value="custom">Other address…</option>';
    $('wsAnnPick').innerHTML = opts;
    var known = Array.prototype.some.call($('wsAnnPick').options, function (o) { return o.value === a.link; });
    $('wsAnnPick').value = !a.link ? '' : known ? a.link : 'custom';
    $('wsAnnLink').hidden = $('wsAnnPick').value !== 'custom';
    if (document.activeElement !== $('wsAnnLink')) $('wsAnnLink').value = a.link;
    preview();

    var n = draft.sections.length;
    $('wsSections').innerHTML =
      '<div class="st-row ws-fixed"><span><i class="bi bi-image"></i> Intro (name and title)</span><i class="bi bi-lock" title="Always first"></i></div>' +
      draft.sections.map(function (s, i) {
        var m = SECTION[s.id];
        return '<div class="st-row ws-sec' + (s.on ? '' : ' off') + '">' +
          '<span><i class="bi bi-' + m[0] + '"></i> ' + m[1] + '</span>' +
          '<span class="ws-tools"><button type="button" data-move="' + i + ':-1" aria-label="Move ' + m[1] + ' up"' + (i === 0 ? ' disabled' : '') + '><i class="bi bi-chevron-up"></i></button>' +
          '<button type="button" data-move="' + i + ':1" aria-label="Move ' + m[1] + ' down"' + (i === n - 1 ? ' disabled' : '') + '><i class="bi bi-chevron-down"></i></button>' +
          '<input type="checkbox" class="switch" data-sec="' + i + '"' + (s.on ? ' checked' : '') + ' aria-label="Show ' + m[1] + '"></span></div>';
      }).join('') +
      '<div class="st-row ws-fixed"><span><i class="bi bi-envelope"></i> Contact</span><i class="bi bi-lock" title="Always last"></i></div>';

    $('wsFeatArticle').innerHTML = '<option value="">Newest (automatic)</option>' + groupTitles(content.articles).map(function (x) {
      return '<option value="' + esc(x.ref) + '">' + esc(x.title) + '</option>';
    }).join('');
    $('wsFeatProject').innerHTML = '<option value="">Newest (automatic)</option>' + groupTitles(content.projects).map(function (x) {
      return '<option value="' + esc(x.ref) + '">' + esc(x.title) + '</option>';
    }).join('');
    $('wsFeatArticle').value = draft.featured.article;
    $('wsFeatProject').value = draft.featured.project;
  }

  /* one entry per article/project (Norwegian and English versions share a ref) */
  function groupTitles(list) {
    var by = {};
    (list || []).forEach(function (x) {
      if (!by[x.ref] || x.lang === 'en') by[x.ref] = x;
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }

  function preview() {
    var a = draft.announcement, el = $('wsAnnPreview');
    el.hidden = !(a.on && (a.en || a.nb));
    el.querySelector('span').textContent = a.en || a.nb;
  }

  function summary() {
    var s = draft || saved;
    var mark = dirty() ? ' · not published' : '';
    if (!s) {
      $('sumAnnounce').textContent = $('sumSections').textContent = $('sumFeatured').textContent = problem === 'setup' ? 'Needs GitHub connection' : '–';
      return;
    }
    $('sumAnnounce').textContent = (s.announcement.on ? 'On' : 'Off') + mark;
    var on = s.sections.filter(function (x) { return x.on; }).length;
    $('sumSections').textContent = on + ' of ' + s.sections.length + ' sections shown' + mark;
    var f = [s.featured.article && 'article', s.featured.project && 'project'].filter(Boolean);
    $('sumFeatured').textContent = (f.length ? 'Pinned ' + f.join(' and ') : 'Newest first') + mark;
  }

  /* ---------- edits ---------- */
  function changed() { preview(); summary(); bar(); }
  $('wsAnnOn').addEventListener('change', function () { draft.announcement.on = this.checked; changed(); });
  $('wsAnnEn').addEventListener('input', function () { draft.announcement.en = this.value; changed(); });
  $('wsAnnNb').addEventListener('input', function () { draft.announcement.nb = this.value; changed(); });
  $('wsAnnPick').addEventListener('change', function () {
    $('wsAnnLink').hidden = this.value !== 'custom';
    if (this.value === 'custom') { $('wsAnnLink').focus(); draft.announcement.link = $('wsAnnLink').value; }
    else draft.announcement.link = this.value;
    changed();
  });
  $('wsAnnLink').addEventListener('input', function () { draft.announcement.link = this.value.trim(); changed(); });
  $('wsSections').addEventListener('click', function (e) {
    var b = e.target.closest('[data-move]');
    if (!b) return;
    var p = b.dataset.move.split(':'), i = +p[0], j = i + +p[1];
    var list = draft.sections, x = list[i];
    list[i] = list[j]; list[j] = x;
    fill(); changed();
    var again = document.querySelector('[data-move="' + j + ':' + p[1] + '"]');
    if (again && !again.disabled) again.focus();
  });
  $('wsSections').addEventListener('change', function (e) {
    var c = e.target.closest('[data-sec]');
    if (!c) return;
    draft.sections[+c.dataset.sec].on = c.checked;
    c.closest('.ws-sec').classList.toggle('off', !c.checked);
    changed();
  });
  $('wsFeatArticle').addEventListener('change', function () { draft.featured.article = this.value; changed(); });
  $('wsFeatProject').addEventListener('change', function () { draft.featured.project = this.value; changed(); });

  /* ---------- publish ---------- */
  var current = 'home';
  function status(t, warn) {
    $('wsStatus').textContent = t;
    $('wsStatus').classList.toggle('warn', !!warn);
  }
  function bar() {
    var show = EDIT_PAGES.indexOf(current) > -1;
    $('wsBar').hidden = !show;
    $('wsPublish').disabled = !dirty() || publishing;
    $('wsUndo').hidden = !dirty() || publishing;
    if (show && !publishing && saved) status(dirty() ? 'Not published yet' : (saved.updated ? 'Live · last change ' + new Date(saved.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Live'));
  }
  $('wsUndo').addEventListener('click', function () { draft = clone(saved); fill(); changed(); });
  $('wsPublish').addEventListener('click', function () {
    if (!dirty()) return;
    publishing = true; bar();
    status('Publishing…');
    fetch('api/site', {
      method: 'PUT', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: draft, sha: sha })
    }).then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }); }).then(function (j) {
      publishing = false;
      if (j.ok) {
        saved = j.settings; sha = j.sha; draft = clone(saved);
        fill(); summary(); bar();
        status('Published ✓ Live on jplundberg.com in about a minute');
      } else if (j._status === 409) {
        loading = null;
        status('The settings changed somewhere else. Loading the newest version…', true);
        load();
      } else { bar(); status('Couldn’t publish (' + (j.error || j._status) + '). Try again.', true); }
    }).catch(function () { publishing = false; bar(); status('Couldn’t publish. Check your connection.', true); });
  });

  /* ---------- visitors ---------- */
  var days = 7, vCache = {};
  function visitors() {
    var box = $('wsVisitors');
    if (vCache[days]) return drawVisitors(vCache[days]);
    box.innerHTML = '<p class="st-intro">Loading…</p>';
    fetch('api/visitors?days=' + days, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; });
    }).then(function (j) {
      if (j._status === 503) {
        box.innerHTML = '<p class="st-intro">Visitor statistics aren’t connected yet. They need Cloudflare Web Analytics switched on for jplundberg.com and three settings on the Worker (see the guide).</p>';
        $('sumVisitors').textContent = 'Not connected';
        return;
      }
      if (j.error) { box.innerHTML = '<p class="st-intro">Couldn’t load statistics right now.' + (j.detail ? ' <small>(' + esc(j.detail) + ')</small>' : '') + '</p>'; return; }
      vCache[days] = j;
      drawVisitors(j);
    }).catch(function () { box.innerHTML = '<p class="st-intro">Couldn’t load statistics. Check your connection.</p>'; });
  }
  function drawVisitors(j) {
    $('sumVisitors').textContent = j.visits + ' visits · last ' + j.days + ' days';
    var max = Math.max.apply(null, j.perDay.map(function (d) { return d.visits; }).concat([1]));
    var W = 320, H = 90, bw = W / Math.max(j.perDay.length, 1);
    var bars = j.perDay.map(function (d, i) {
      var h = Math.max(2, d.visits / max * (H - 18));
      var day = new Date(d.name + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      return '<rect x="' + (i * bw + bw * .18).toFixed(1) + '" y="' + (H - 14 - h).toFixed(1) + '" width="' + (bw * .64).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"><title>' + esc(day) + ': ' + d.visits + ' visits, ' + d.views + ' page views</title></rect>';
    }).join('');
    var first = j.perDay[0], last = j.perDay[j.perDay.length - 1];
    var lbl = function (d) { return d ? new Date(d.name + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''; };
    var list = function (title, rows, icon, fmt) {
      if (!rows.length) return '';
      var top = rows[0].views || 1;
      return '<p class="st-sub">' + title + '</p><ul class="ws-list">' + rows.map(function (r) {
        return '<li><span class="n"><i class="bi bi-' + icon + '"></i>' + esc(fmt ? fmt(r.name) : r.name || '(direct)') + '</span><b>' + r.views + '</b><i class="bar" style="width:' + (r.views / top * 100).toFixed(0) + '%"></i></li>';
      }).join('') + '</ul>';
    };
    $('wsVisitors').innerHTML =
      '<div class="ws-tiles"><div><span>Visits</span><b>' + j.visits + '</b></div><div><span>Page views</span><b>' + j.views + '</b></div></div>' +
      '<section class="st-group ws-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Visits per day, last ' + j.days + ' days">' + bars +
      '<text x="0" y="' + (H - 2) + '">' + esc(lbl(first)) + '</text><text x="' + W + '" y="' + (H - 2) + '" text-anchor="end">' + esc(lbl(last)) + '</text></svg></section>' +
      list('Most read pages', j.pages, 'file-earmark-text', pageName) +
      list('Where visitors come from', j.referrers, 'box-arrow-in-right') +
      list('Countries', j.countries, 'geo-alt', countryName) +
      '<p class="st-foot muted">From Cloudflare Web Analytics · no cookies, no personal data.</p>';
  }
  /* "/articles/…/" → the article's title; "NO" → "Norway" */
  function pageName(p) {
    if (p === '/') return 'Front page (English)';
    if (p === '/no/') return 'Front page (Norwegian)';
    var all = content ? (content.articles || []).concat(content.projects || []) : [];
    var hit = all.filter(function (x) { return x.url === p || x.url === p + '/'; })[0];
    return hit ? hit.title : p === '/articles/' ? 'All articles' : p === '/projects/' ? 'All projects' : p;
  }
  var regions = null;
  try { regions = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) {}
  function countryName(c) {
    if (regions && /^[A-Z]{2}$/.test(c || '')) { try { return regions.of(c); } catch (e) {} }
    return c || 'Unknown';
  }
  $('wsDays').addEventListener('click', function (e) {
    var b = e.target.closest('[data-days]');
    if (!b) return;
    days = +b.dataset.days;
    this.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    visitors();
  });

  /* ---------- page changes in the settings panel ---------- */
  window.addEventListener('st:page', function (e) {
    current = e.detail;
    if (current === 'home' || EDIT_PAGES.indexOf(current) > -1) { if (!saved) load(); else { fill(); summary(); } }
    if (current === 'visitors') { if (!content) load(); visitors(); }
    bar();
    if (EDIT_PAGES.indexOf(current) > -1 && !saved) status(problem ? $('wsStatus').textContent : 'Loading…', !!problem);
  });
  if (window.Vault) window.Vault.onLock(function () { saved = draft = sha = null; loading = null; vCache = {}; });
})();
