/* "Review" before publishing: every changed field, before → after, so a typo never goes live unseen */
(function () {
  var NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function flat(o, p, out) {
    out = out || {};
    if (o && typeof o === 'object') { Object.keys(o).forEach(function (k) { var v = o[k], lab = Array.isArray(o) && v && typeof v === 'object' ? (v.title || v.name || v.label || v.id || (+k + 1)) : k; flat(v, p ? p + ' › ' + lab : String(lab), out); }); if (!Object.keys(o).length && p) out[p] = ''; }
    else out[p] = o == null ? '' : o === true ? L('On', 'På') : o === false ? L('Off', 'Av') : String(o);
    return out;
  }
  function nice(path) { return path.replace(/\ben\b/g, 'English').replace(/\bnb\b/g, 'Norsk').replace(/_/g, ' ').replace(/ › (\d+)/g, function (m, n) { return ' #' + (+n + 1); }); }
  function show(title, before, after) {
    var a = flat(before || {}), b = flat(after || {}), keys = {}, rows = [];
    Object.keys(a).concat(Object.keys(b)).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).sort().forEach(function (k) { if (k === 'updated') return; var x = a[k] == null ? '' : a[k], y = b[k] == null ? '' : b[k]; if (x !== y) rows.push([k, x, y]); });
    var box = document.getElementById('siteReview');
    if (!box) { box = document.createElement('div'); box.id = 'siteReview'; box.className = 'spv-sheet'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); document.body.appendChild(box);
      box.addEventListener('click', function (e) { if (e.target === box || e.target.closest('[data-srclose]')) box.hidden = true; }); }
    box.innerHTML = '<div class="spv-card"><div class="spv-head"><b>' + esc(title) + '</b><button type="button" class="icon-btn sm" data-srclose aria-label="' + L('Close', 'Lukk') + '"><i class="bi bi-x-lg"></i></button></div>' +
      (rows.length ? '<p class="muted spv-sub">' + rows.length + L(' change' + (rows.length === 1 ? '' : 's') + ' – read them once before you publish', (rows.length === 1 ? ' endring' : ' endringer') + ' – les gjennom før du publiserer') + '</p><div class="spv-list">' + rows.slice(0, 80).map(function (r) {
        return '<div class="spv-row"><span class="spv-k">' + esc(nice(r[0])) + '</span>' + (r[1] ? '<del>' + esc(r[1]) + '</del>' : '<i class="muted">' + L('(empty)', '(tom)') + '</i>') + '<ins>' + (r[2] ? esc(r[2]) : '<i>' + L('(removed – the original is used)', '(fjernet – originalen brukes)') + '</i>') + '</ins></div>';
      }).join('') + '</div>' : '<p class="muted">' + L('Nothing changed.', 'Ingenting er endret.') + '</p>') +
      '<div class="spv-foot"><a class="text-btn" href="/" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> ' + L('Open the live site', 'Åpne nettstedet') + '</a><button type="button" class="pill-btn" data-srclose>' + L('Done', 'Ferdig') + '</button></div></div>';
    box.hidden = false;
  }
  window.SiteReview = { show: show };
})();

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
    about: ['person', 'About'], resume: ['briefcase', 'Experience'], courses: ['mortarboard', 'Courses & certificates'],
    projects: ['kanban', 'Projects'], articles: ['journal-text', 'Latest articles']
  };
  var EDIT_PAGES = ['announce', 'sections', 'featured', 'socials', 'courses', 'progress', 'cv'];
  var cvLang = 'en', jobEdit = null, eduEdit = null;
  var DEFAULT_SOCIALS = [{ net: 'linkedin', url: 'https://www.linkedin.com/in/john-paul-lundberg-8a804623b/' }, { net: 'instagram', url: 'https://www.instagram.com/jp.lundberg.official/' }];
  /* each page has its own Publish button; what it publishes, in words */
  var PART = { announce: [['announcement'], 'Announcement'], sections: [['sections', 'now'], 'Front page'], featured: [['featured'], 'Featured'], socials: [['socials'], 'Socials'],
    courses: [['courses'], 'Courses & certificates'], progress: [['goals'], 'Project progress'], cv: [['cv', 'experience'], 'CV'] };
  function partDirty(keys) { return saved && draft && keys.some(function (key) { return JSON.stringify(saved[key] == null ? null : saved[key]) !== JSON.stringify(draft[key] == null ? null : draft[key]); }); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  /* what the dashboard would publish right now: courses marked public, goals marked public */
  function coursesNow() {
    var F = window.Features; if (!F) return [];
    return F.list('learning').filter(function (c) { return c.pub; }).sort(function (a, b) { return String(b.date || '') > String(a.date || '') ? 1 : -1; }).map(function (c) {
      return { title: String(c.title || '').slice(0, 120), org: String(c.provider || '').slice(0, 120), year: String(c.date || '').slice(0, 4), kind: ['course', 'certificate', 'book', 'standard', 'other'].indexOf(c.kind) > -1 ? c.kind : 'course', cv: !!c.cv };
    });
  }
  function goalsNow() {
    return readJSON('dash.goals', []).filter(function (g) { return g.pub; }).map(function (g) {
      return { name: String(g.name || '').slice(0, 120), value: +g.value || 0, target: +g.target || 0, updated: new Date().toISOString().slice(0, 10) };
    });
  }
  /* the saved date is kept when the numbers haven't changed, so nothing looks "unpublished" by itself */
  function syncDerived() {
    if (!draft) return;
    draft.courses = coursesNow();
    draft.goals = goalsNow().map(function (g) {
      var old = (saved.goals || []).filter(function (x) { return x.name === g.name; })[0];
      return old && old.value === g.value && old.target === g.target ? old : g;
    });
  }

  var saved = null, draft = null, sha = null, content = null, loading = null, publishing = false, problem = '';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function dirty() { return saved && JSON.stringify(strip(saved)) !== JSON.stringify(strip(draft)); }
  function strip(o) { var c = clone(o); delete c.updated; return c; }

  function load() {
    if (loading) return loading;
    status('Loading…');
    loading = Promise.all([
      fetch('/cmd/api/site', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; });
      }),
      fetch('/cmd/content.json', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).catch(function () { return { articles: [], projects: [] }; })
    ]).then(function (res) {
      var j = res[0];
      content = res[1];
      if (!j.settings) {
        problem = j.error === 'github not configured' ? 'setup' : 'error';
        throw new Error(j.error || 'failed');
      }
      problem = '';
      saved = j.settings; sha = j.sha;
      /* nothing published yet: the site shows these (_data/socials_default.yml) */
      if (!Array.isArray(saved.socials) || !saved.socials.length && !j.settings.updated) saved.socials = DEFAULT_SOCIALS.slice();
      draft = clone(saved);
      fill(); summary(); status('');
    }).catch(function (e) {
      if (window.Diag && e && e.message !== 'load' && e.message !== 'failed') window.Diag.log('website', e.message, 'website.js');
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

    draft.now = draft.now || { en: '', nb: '' };
    if (document.activeElement !== $('wsNowEn')) $('wsNowEn').value = draft.now.en || '';
    if (document.activeElement !== $('wsNowNb')) $('wsNowNb').value = draft.now.nb || '';
    draft.cv = draft.cv || { on: false, courses: true, projects: true, articles: false };
    draft.cv.profile = draft.cv.profile || { en: '', nb: '' };
    ['education', 'skills', 'languages', 'hobbies'].forEach(function (k) { draft.cv[k] = draft.cv[k] || { en: [], nb: [] }; });
    draft.cv.contact = draft.cv.contact || { phone: '', address: '', born: '', nationality: '' };
    draft.experience = draft.experience || { en: [], nb: [] };
    $('wsCvOn').checked = !!draft.cv.on; $('wsCvCourses').checked = draft.cv.courses !== false; $('wsCvProjects').checked = draft.cv.projects !== false; $('wsCvArticles').checked = !!draft.cv.articles;
    fillCv();
    syncDerived();
    var F = window.Features, items = F ? F.list('learning').slice().sort(function (a, b) { return String(b.date || '') > String(a.date || '') ? 1 : -1; }) : [];
    $('wsCourses').innerHTML = items.length ? items.map(function (c) {
      return '<div class="st-row ws-course' + (c.pub ? '' : ' off') + '"><span class="st-label">' + esc(c.title || '') + '<small>' + esc([c.provider, String(c.date || '').slice(0, 4), c.status === 'done' ? '' : (c.status === 'progress' ? 'in progress' : 'planned')].filter(Boolean).join(' · ')) + '</small></span>' +
        '<span class="ws-tools ws-course-sw"><label class="ws-mini"><input type="checkbox" class="switch" data-cpub="' + esc(c.id) + '"' + (c.pub ? ' checked' : '') + '> Site</label>' +
        '<label class="ws-mini"' + (c.pub ? '' : ' hidden') + '><input type="checkbox" class="switch" data-ccv="' + esc(c.id) + '"' + (c.cv ? ' checked' : '') + '> CV</label></span></div>';
    }).join('') : '<p class="st-note">No courses yet. Add them on the Work page (switch on “Courses & certificates” under Features).</p>';
    var goals = readJSON('dash.goals', []);
    $('wsGoals').innerHTML = goals.length ? goals.map(function (g) {
      var pct = g.target > 0 ? Math.round((+g.value || 0) / g.target * 100) : 0;
      return '<label class="st-row"><span class="st-label">' + esc(g.name || '') + '<small>' + esc(String(g.value || 0)) + ' / ' + esc(String(g.target || 0)) + ' · ' + pct + ' %</small></span><input type="checkbox" class="switch" data-gpub="' + esc(g.id) + '"' + (g.pub ? ' checked' : '') + '></label>';
    }).join('') : '<p class="st-note">No goals yet. Add one on the dashboard’s Goals card.</p>';

    $('wsFeatArticle').innerHTML = '<option value="">Newest (automatic)</option>' + groupTitles(content.articles).map(function (x) {
      return '<option value="' + esc(x.ref) + '">' + esc(x.title) + '</option>';
    }).join('');
    $('wsFeatProject').innerHTML = '<option value="">Newest (automatic)</option>' + groupTitles(content.projects).map(function (x) {
      return '<option value="' + esc(x.ref) + '">' + esc(x.title) + '</option>';
    }).join('');
    $('wsFeatArticle').value = draft.featured.article;
    $('wsFeatProject').value = draft.featured.project;
  }

  /* ---------- CV: profile text and experience, per language ---------- */
  function fillCv() {
    $('cvLang').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === cvLang)); });
    if (document.activeElement !== $('cvProfile')) $('cvProfile').value = draft.cv.profile[cvLang] || '';
    $('cvProfile').placeholder = content && content.profile && content.profile[cvLang] ? content.profile[cvLang].slice(0, 160) + '…' : 'Two or three sentences about what you do.';
    var jobs = draft.experience[cvLang] || [];
    $('cvExpNote').textContent = jobs.length ? jobs.length + ' job' + (jobs.length === 1 ? '' : 's') : 'from the site';
    $('cvJobsImport').hidden = jobs.length > 0 || !(content && content.jobs && content.jobs[cvLang] && content.jobs[cvLang].length);
    $('cvJobs').innerHTML = jobs.map(function (j, i) {
      if (jobEdit === i) return jobForm(j, i);
      return '<div class="st-row ws-job"><button type="button" class="b-open" data-jedit="' + i + '"><span>' + esc(j.title) + '</span><small class="muted">' + esc([j.company, j.dates].filter(Boolean).join(' · ')) + (j.points && j.points.length ? ' · ' + j.points.length + ' point' + (j.points.length === 1 ? '' : 's') : '') + '</small></button>' +
        '<span class="ws-tools"><button type="button" data-jmove="' + i + ':-1" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '><i class="bi bi-chevron-up"></i></button><button type="button" data-jmove="' + i + ':1" aria-label="Move down"' + (i === jobs.length - 1 ? ' disabled' : '') + '><i class="bi bi-chevron-down"></i></button>' +
        '<button type="button" class="del" data-jdel="' + i + '" aria-label="Remove"><i class="bi bi-x"></i></button></span></div>';
    }).join('') + (jobEdit === 'new' ? jobForm(null, 'new') : '');
    /* education, skills, languages, interests, contact */
    var edu = draft.cv.education[cvLang] || [];
    $('cvEduNote').textContent = edu.length ? edu.length + ' entr' + (edu.length === 1 ? 'y' : 'ies') : '';
    $('cvEdu').innerHTML = edu.map(function (e, i) {
      if (eduEdit === i) return eduForm(e, i);
      return '<div class="st-row ws-job"><button type="button" class="b-open" data-eedit="' + i + '"><span>' + esc(e.title) + '</span><small class="muted">' + esc([e.school, e.dates].filter(Boolean).join(' · ')) + '</small></button>' +
        '<span class="ws-tools"><button type="button" data-emove="' + i + ':-1" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '><i class="bi bi-chevron-up"></i></button><button type="button" data-emove="' + i + ':1" aria-label="Move down"' + (i === edu.length - 1 ? ' disabled' : '') + '><i class="bi bi-chevron-down"></i></button>' +
        '<button type="button" class="del" data-edel="' + i + '" aria-label="Remove"><i class="bi bi-x"></i></button></span></div>';
    }).join('') + (eduEdit === 'new' ? eduForm(null, 'new') : '');
    var lines = function (l) { return (l || []).map(function (x) { return x.name + ', ' + x.level; }).join('\n'); };
    if (document.activeElement !== $('cvSkills')) $('cvSkills').value = lines(draft.cv.skills[cvLang]);
    if (document.activeElement !== $('cvLangs')) $('cvLangs').value = lines(draft.cv.languages[cvLang]);
    if (document.activeElement !== $('cvHobbies')) $('cvHobbies').value = (draft.cv.hobbies[cvLang] || []).join('\n');
    [['cvPhone', 'phone'], ['cvAddress', 'address'], ['cvBorn', 'born'], ['cvNat', 'nationality']].forEach(function (x) { if (document.activeElement !== $(x[0])) $(x[0]).value = draft.cv.contact[x[1]] || ''; });
  }
  function eduForm(e, i) {
    return '<form class="ws-jobform" data-ei="' + i + '">' +
      '<input name="title" placeholder="e.g. FDVU Technician" value="' + esc(e ? e.title : '') + '" required autocomplete="off">' +
      '<div class="row2"><input name="school" placeholder="School" value="' + esc(e ? e.school : '') + '" autocomplete="off"><input name="dates" placeholder="Dates" value="' + esc(e ? e.dates : '') + '" autocomplete="off"></div>' +
      '<input name="note" placeholder="Note (optional)" value="' + esc(e ? e.note : '') + '" autocomplete="off">' +
      '<div class="form-actions"><button type="button" class="text-btn" data-ecancel>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">' + (e ? 'Save' : 'Add') + '</button></div></form>';
  }
  function levels(text) {
    return String(text || '').split('\n').map(function (l) { var m = l.match(/^(.*?)(?:[,;:\s]\s*(\d{1,3})\s*%?)?\s*$/); return m && m[1].trim() ? { name: m[1].trim().slice(0, 60), level: Math.max(0, Math.min(100, +m[2] || 80)) } : null; }).filter(Boolean).slice(0, 12);
  }
  $('cvSkills').addEventListener('input', function () { draft.cv.skills[cvLang] = levels(this.value); changed(); });
  $('cvLangs').addEventListener('input', function () { draft.cv.languages[cvLang] = levels(this.value); changed(); });
  $('cvHobbies').addEventListener('input', function () { draft.cv.hobbies[cvLang] = this.value.split('\n').map(function (x) { return x.trim().slice(0, 40); }).filter(Boolean).slice(0, 10); changed(); });
  [['cvPhone', 'phone'], ['cvAddress', 'address'], ['cvBorn', 'born'], ['cvNat', 'nationality']].forEach(function (x) { $(x[0]).addEventListener('input', function () { draft.cv.contact[x[1]] = this.value.trim(); changed(); }); });
  $('cvEduAdd').addEventListener('click', function () { eduEdit = 'new'; fillCv(); var f = $('cvEdu').querySelector('input[name=title]'); if (f) f.focus(); });
  $('cvEdu').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-eedit]'))) { eduEdit = +b.dataset.eedit; fillCv(); return; }
    if (e.target.closest('[data-ecancel]')) { eduEdit = null; fillCv(); return; }
    if ((b = e.target.closest('[data-edel]'))) { draft.cv.education[cvLang].splice(+b.dataset.edel, 1); eduEdit = null; fillCv(); changed(); return; }
    if ((b = e.target.closest('[data-emove]'))) { var p = b.dataset.emove.split(':'), i = +p[0], j = i + +p[1], l = draft.cv.education[cvLang]; if (j < 0 || j >= l.length) return; var x = l[i]; l[i] = l[j]; l[j] = x; fillCv(); changed(); }
  });
  $('cvEdu').addEventListener('submit', function (e) {
    var f = e.target.closest('.ws-jobform'); if (!f || f.dataset.ei == null) return;
    e.preventDefault();
    var en = { title: f.title.value.trim(), school: f.school.value.trim(), dates: f.dates.value.trim(), note: f.note.value.trim() };
    if (!en.title) { f.title.focus(); return; }
    var l = draft.cv.education[cvLang];
    if (f.dataset.ei === 'new') l.push(en); else l[+f.dataset.ei] = en;
    eduEdit = null; fillCv(); changed();
  });
  function jobForm(j, i) {
    return '<form class="ws-jobform" data-ji="' + i + '">' +
      '<input name="title" placeholder="Title, e.g. FDVU Advisor" value="' + esc(j ? j.title : '') + '" required autocomplete="off">' +
      '<div class="row2"><input name="company" placeholder="Company, city" value="' + esc(j ? j.company : '') + '" autocomplete="off"><input name="dates" placeholder="Dates, e.g. 2020 – 2025" value="' + esc(j ? j.dates : '') + '" autocomplete="off"></div>' +
      '<textarea name="points" rows="3" placeholder="What you did – one point per line">' + esc(j && j.points ? j.points.join('\n') : '') + '</textarea>' +
      '<div class="form-actions"><button type="button" class="text-btn" data-jcancel>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">' + (j ? 'Save' : 'Add') + '</button></div></form>';
  }
  $('cvLang').addEventListener('click', function (e) { var b = e.target.closest('[data-lang]'); if (!b) return; cvLang = b.dataset.lang; jobEdit = null; eduEdit = null; fillCv(); });
  $('cvProfile').addEventListener('input', function () { draft.cv.profile[cvLang] = this.value; changed(); });
  $('cvJobsImport').addEventListener('click', function () {
    draft.experience[cvLang] = clone(content.jobs[cvLang]).map(function (j) { return { title: j.title || '', dates: j.dates || '', company: j.company || '', points: j.points || [] }; });
    fillCv(); changed();
  });
  $('cvJobAdd').addEventListener('click', function () { jobEdit = 'new'; fillCv(); var f = $('cvJobs').querySelector('input[name=title]'); if (f) f.focus(); });
  $('cvJobs').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-jedit]'))) { jobEdit = +b.dataset.jedit; fillCv(); return; }
    if (e.target.closest('[data-jcancel]')) { jobEdit = null; fillCv(); return; }
    if ((b = e.target.closest('[data-jdel]'))) { draft.experience[cvLang].splice(+b.dataset.jdel, 1); jobEdit = null; fillCv(); changed(); return; }
    if ((b = e.target.closest('[data-jmove]'))) { var p = b.dataset.jmove.split(':'), i = +p[0], j = i + +p[1], l = draft.experience[cvLang]; if (j < 0 || j >= l.length) return; var x = l[i]; l[i] = l[j]; l[j] = x; fillCv(); changed(); }
  });
  $('cvJobs').addEventListener('submit', function (e) {
    var f = e.target.closest('.ws-jobform'); if (!f) return;
    e.preventDefault();
    var j = { title: f.title.value.trim(), company: f.company.value.trim(), dates: f.dates.value.trim(), points: f.points.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) };
    if (!j.title) { f.title.focus(); return; }
    var l = draft.experience[cvLang];
    if (f.dataset.ji === 'new') l.push(j); else l[+f.dataset.ji] = j;
    jobEdit = null; fillCv(); changed();
  });

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
      $('sumAnnounce').textContent = $('sumSections').textContent = $('sumFeatured').textContent = $('sumCourses').textContent = $('sumProgress').textContent = $('sumCv').textContent = problem === 'setup' ? 'Needs GitHub connection' : '–';
      return;
    }
    $('sumAnnounce').textContent = (s.announcement.on ? 'On' : 'Off') + mark;
    var on = s.sections.filter(function (x) { return x.on; }).length;
    $('sumSections').textContent = on + ' of ' + s.sections.length + ' sections shown' + mark;
    var f = [s.featured.article && 'article', s.featured.project && 'project'].filter(Boolean);
    $('sumFeatured').textContent = (f.length ? 'Pinned ' + f.join(' and ') : 'Newest first') + mark;
    var nc = (s.courses || []).length, ncv = (s.courses || []).filter(function (c) { return c.cv; }).length;
    $('sumCourses').textContent = (nc ? nc + ' on the site · ' + ncv + ' in the CV' : 'None published') + mark;
    var ng = (s.goals || []).length;
    $('sumProgress').textContent = (ng ? ng + ' goal' + (ng === 1 ? '' : 's') + ' published' : 'None published') + mark;
    var ne = s.experience ? (s.experience.en || []).length : 0;
    $('sumCv').textContent = (s.cv && s.cv.on ? 'On · jplundberg.com/cv' : 'Off') + (ne ? ' · ' + ne + ' jobs' : '') + mark;
  }

  /* ---------- edits ---------- */
  function changed() { preview(); summary(); bar(); try { window.dispatchEvent(new Event('site:draft')); } catch (e) {} }
  window.SiteDraftSite = function () { return { saved: saved, draft: draft }; };
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
  $('wsNowEn').addEventListener('input', function () { draft.now.en = this.value; changed(); });
  $('wsNowNb').addEventListener('input', function () { draft.now.nb = this.value; changed(); });
  ['wsCvOn', 'wsCvCourses', 'wsCvProjects', 'wsCvArticles'].forEach(function (id) {
    $(id).addEventListener('change', function () { draft.cv[{ wsCvOn: 'on', wsCvCourses: 'courses', wsCvProjects: 'projects', wsCvArticles: 'articles' }[id]] = this.checked; changed(); });
  });
  /* which courses go public / in the CV: stored on the course itself (synced), published with the button */
  $('wsCourses').addEventListener('change', function (e) {
    var F = window.Features, el = e.target, id = el.dataset.cpub || el.dataset.ccv;
    if (!F || !id) return;
    var t = F.tools(); (t.learning || []).forEach(function (c) { if (c.id === id) { if (el.dataset.cpub) { c.pub = el.checked; if (!el.checked) c.cv = false; } else c.cv = el.checked; } });
    F.saveTools(t);
    fill(); changed();
  });
  $('wsGoals').addEventListener('change', function (e) {
    var el = e.target; if (!el.dataset.gpub) return;
    var goals = readJSON('dash.goals', []); goals.forEach(function (g) { if (g.id === el.dataset.gpub) g.pub = el.checked; });
    try { localStorage.setItem('dash.goals', JSON.stringify(goals)); } catch (x) {}
    window.dispatchEvent(new Event('dash:local'));
    if (window.Dash && window.Dash.reload) window.Dash.reload();
    syncDerived(); changed();
  });
  window.addEventListener('tools:change', function () { if (draft && current === 'courses') { fill(); changed(); } else if (draft) { syncDerived(); summary(); bar(); } });
  window.addEventListener('dash:local', function () { if (draft) { syncDerived(); summary(); bar(); } });
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
    if (!show) return;
    var P = PART[current], mine = partDirty(P[0]);
    var others = Object.keys(PART).filter(function (k) { return k !== current && partDirty(PART[k][0]); }).map(function (k) { return PART[k][1].toLowerCase(); });
    $('wsPublish').innerHTML = '<i class="bi bi-cloud-upload"></i> Publish ' + P[1].toLowerCase();
    $('wsPublish').disabled = !mine || publishing;
    if ($('wsReview')) $('wsReview').hidden = !dirty() || publishing;
    $('wsUndo').hidden = !mine || publishing;
    if (!publishing && saved) status(mine ? 'Not published yet' + (others.length ? ' · also includes your ' + others.join(' and ') + ' changes' : '')
      : others.length ? 'Unpublished changes in ' + others.join(' and ')
      : (saved.updated ? 'Live · last change ' + new Date(saved.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Live'));
  }
  /* Undo only undoes this page */
  $('wsUndo').addEventListener('click', function () {
    var ks = PART[current] && PART[current][0];
    if (!ks) return;
    ks.forEach(function (k) { if (saved[k] == null) delete draft[k]; else draft[k] = clone(saved[k]); });
    if (ks[0] === 'socials' && window.Profile) window.Profile.resetSocials(saved.socials);
    fill(); changed();
  });
  /* Socials come from Settings → jplundberg.com → Socials (profile.js) */
  window.addEventListener('socials:change', function () {
    if (!draft || !window.Profile) return;
    draft.socials = window.Profile.publicSocials();
    changed();
  });
  if ($('wsReview')) $('wsReview').addEventListener('click', function () { if (window.SiteReview && saved && draft) window.SiteReview.show('Changes to jplundberg.com', saved, draft); });
  $('wsPublish').addEventListener('click', function () {
    if (!dirty()) return;
    publishing = true; bar();
    status('Publishing…');
    fetch('/cmd/api/site', {
      method: 'PUT', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: draft, sha: sha })
    }).then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }); }).then(function (j) {
      publishing = false;
      if (j.ok) {
        saved = j.settings; sha = j.sha; draft = clone(saved);
        fill(); summary(); bar();
        status('Published ✓ Live on jplundberg.com in about a minute');
        try { window.dispatchEvent(new CustomEvent('site:published', { detail: (PART[current] ? PART[current][1].toLowerCase() : 'website settings') })); } catch (e) {}
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
    fetch('/cmd/api/visitors?days=' + days, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
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

  /* ---------- articles and projects: hide / show ---------- */
  var items = null, itemsLoading = null, busyRef = '';
  function loadItems() {
    if (itemsLoading) return itemsLoading;
    itemsLoading = fetch('/cmd/api/content', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; });
    }).then(function (j) {
      itemsLoading = null;
      if (!j.items) {
        $('wsContent').innerHTML = '<p class="st-intro">' + (j._status === 503 ? 'Connect GitHub first (see the guide).' : j._status === 404 ? 'Update the Worker code to use this (see the guide).' : 'Couldn’t load your articles right now.') + '</p>';
        $('sumContent').textContent = '–';
        return;
      }
      items = j.items; drawItems();
    }).catch(function () { itemsLoading = null; $('wsContent').innerHTML = '<p class="st-intro">Couldn’t load your articles. Check your connection.</p>'; });
    return itemsLoading;
  }
  /* one row per article/project; language versions share a ref */
  function grouped(col) {
    var by = {};
    items.filter(function (i) { return i.collection === col; }).forEach(function (i) {
      var g = by[i.ref] || (by[i.ref] = { ref: i.ref, col: col, langs: [], title: '', date: '', published: false });
      g.langs.push(i.lang === 'nb' ? 'NO' : 'EN');
      if (!g.title || i.lang === 'en') g.title = i.title;
      if (i.date > g.date) g.date = i.date;
      if (i.published) g.published = true;
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
  }
  function drawItems() {
    var html = [['articles', 'Articles', 'journal-text'], ['projects', 'Projects', 'kanban']].map(function (c) {
      var rows = grouped(c[0]);
      if (!rows.length) return '';
      return '<p class="st-sub">' + c[1] + '</p><section class="st-group">' + rows.map(function (g) {
        var busy = busyRef === c[0] + ':' + g.ref;
        var d = g.date ? new Date(g.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        return '<label class="st-row ws-item' + (g.published ? '' : ' off') + '"><span class="st-label"><span><i class="bi bi-' + c[2] + '"></i> ' + esc(g.title) + '</span>' +
          '<small>' + (busy ? (g.published ? 'Hiding…' : 'Showing…') : (g.published ? 'Shown' : 'Hidden') + ' · ' + g.langs.sort().join(' + ') + (d ? ' · ' + d : '')) + '</small></span>' +
          '<input type="checkbox" class="switch" data-col="' + c[0] + '" data-ref="' + esc(g.ref) + '"' + (g.published ? ' checked' : '') + (busyRef ? ' disabled' : '') +
          ' aria-label="Show ' + esc(g.title) + ' on the website"></label>';
      }).join('') + '</section>';
    }).join('');
    $('wsContent').innerHTML = html || '<p class="st-intro">No articles or projects yet.</p>';
    var all = grouped('articles').concat(grouped('projects')), hidden = all.filter(function (g) { return !g.published; }).length;
    $('sumContent').textContent = hidden ? hidden + ' hidden' : 'All shown';
  }
  $('wsContent').addEventListener('change', function (e) {
    var c = e.target.closest('[data-ref]');
    if (!c || busyRef) return;
    var on = c.checked;
    busyRef = c.dataset.col + ':' + c.dataset.ref;
    drawItems();
    fetch('/cmd/api/content', {
      method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: c.dataset.col, ref: c.dataset.ref, published: on })
    }).then(function (r) { return r.json(); }).then(function (j) {
      busyRef = '';
      if (j.items) { items = j.items; drawItems(); stMsg((on ? 'Shown again' : 'Hidden') + ' ✓ Live on jplundberg.com in about a minute', true); }
      else { drawItems(); stMsg('Couldn’t change it (' + (j.error || 'error') + '). Try again.'); }
    }).catch(function () { busyRef = ''; drawItems(); stMsg('Couldn’t change it. Check your connection.'); });
  });
  function stMsg(t, ok) { var m = document.getElementById('stMsg'); m.textContent = t; m.classList.toggle('ok', !!ok); }

  /* ---------- page changes in the settings panel ---------- */
  window.addEventListener('st:page', function (e) {
    current = e.detail;
    if (current === 'home' || EDIT_PAGES.indexOf(current) > -1) {
      (saved ? Promise.resolve() : load()).then(function () {
        if (current === 'socials' && draft && window.Profile) { draft.socials = window.Profile.publicSocials(); }
        if (draft) { fill(); summary(); bar(); }
      });
    }
    if (current === 'visitors') { if (!content) load(); visitors(); }
    if (current === 'content') { if (items) drawItems(); else { $('wsContent').innerHTML = '<p class="st-intro">Loading…</p>'; loadItems(); } }
    if (current === 'home' && !items) loadItems();
    bar();
    if (EDIT_PAGES.indexOf(current) > -1 && !saved) status(problem ? $('wsStatus').textContent : 'Loading…', !!problem);
  });
  if (window.Vault) window.Vault.onLock(function () { saved = draft = sha = null; loading = null; vCache = {}; items = null; });
})();
