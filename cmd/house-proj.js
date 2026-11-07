/* Home projects (Nov 2026): plans for the home on their own House tab – paint the bedroom, a new bathroom,
   floors, the garden. Each project has a kind (with a starter task list), status, budget, tasks with a day,
   what you've spent, and before/after photos.
   Shared with your partner: a cost can go straight into Shared home as a shared purchase (minor repair,
   urgent repair or improvement – so the 5 000 kr repairs cap and the "agree improvements in writing" rule
   from the samboerkontrakt keep working), otherwise into Finances as a Home expense.
   Data: dash.tools.hproj = [{id, name, kind, room, status idea|plan|doing|done, budget, start, end, shared, work, agreed,
     notes, tasks:[{id,t,done,due}], costs:[{id,date,what,amount,exp,sh,payer}], photos:[], doneAt}]. Photos: pj-… */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, K = window.Kit, HF = window.HouseFiles, mountEl = document.querySelector('[data-tool="hproj"]');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +(p[2] || 1)); }
  function today() { return dkey(new Date()); }
  function daysTo(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function fmt(k, o) { return isKey(k) ? fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }) : ''; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, ''); if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var n = parseFloat(s.replace(',', '.')); return isFinite(n) ? n : null; }
  function on() { return Fe.on('house') && Fe.on('hproj'); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function list() { return Fe.list('hproj'); }
  function byId(id) { return list().filter(function (x) { return x.id === id; })[0]; }
  function saveOne(id, fn) { var t = Fe.tools(); (t.hproj || []).forEach(function (x) { if (x && x.id === id) fn(x); }); Fe.saveTools(t); }
  function arr(x) { return Array.isArray(x) ? x.filter(function (y) { return y && typeof y === 'object'; }) : []; }
  HF && HF.uses(function () { var ids = []; list().forEach(function (p) { ids = ids.concat(p.photos || []); }); return ids; });

  var KINDS = [
    ['paint', 'Paint a room', 'brush', '#8a6fdf', ['Pick the colour and buy paint', 'Wash the walls and fill holes', 'Tape and cover the floor', 'Prime where it’s needed', 'Two coats', 'Note the colour code in Good to know']],
    ['bath', 'Bathroom', 'droplet-half', '#0891b2', ['Get 2–3 quotes from wet-room approved firms (våtromsgodkjent)', 'Agree price, start and finish in writing', 'Photos of the membrane and drain before the tiles go on', 'Get the documentation and the samsvarserklæring', 'Save the papers in the FDV binder']],
    ['kitchen', 'Kitchen', 'cup-hot', '#e8743b', ['Measure and draw it', 'Quotes for the kitchen and the fitting', 'An authorised electrician for sockets and the cooker', 'A plumber for the sink and dishwasher (with a leak guard)', 'Plan the delivery', 'Keep manuals and warranties in the FDV binder']],
    ['floor', 'Floors', 'grid-3x3', '#c98500', ['Choose the floor and measure the m²', 'Check the subfloor is level and dry', 'Let the boards settle in the room for 48 hours', 'Lay the floor', 'Skirting boards', 'Keep the product sheet (FDV)']],
    ['outdoor', 'Garden or outdoors', 'tree', '#22b35e', ['Make a plan', 'Check the rules (housing association or kommune)', 'Buy what you need', 'Do the work', 'Tidy up']],
    ['repair', 'Repair', 'wrench-adjustable', '#e66767', ['Find the cause', 'Get a quote or buy the parts', 'Fix it', 'Check it again after a week']],
    ['other', 'Something else', 'hammer', '#7a8794', []]];
  function kind(k) { return KINDS.filter(function (x) { return x[0] === k; })[0] || KINDS[KINDS.length - 1]; }
  var STATUS = [['idea', 'Idea', '#7a8794'], ['plan', 'Planned', '#3987e5'], ['doing', 'Under way', '#e8743b'], ['done', 'Done', '#22b35e']];
  function st(k) { return STATUS.filter(function (s) { return s[0] === k; })[0] || STATUS[0]; }
  var WORK = [['improve', 'Improvement – agree it in writing first'], ['minor', 'Minor repair (counts towards the 5 000 kr a year)'], ['urgent', 'Urgent repair']];
  function partner() { return window.Shared && window.Shared.partner && window.Shared.partner(); }
  function spent(p) { return arr(p.costs).reduce(function (a, c) { return a + (+c.amount || 0); }, 0); }
  function prog(p) { var t = arr(p.tasks); return t.length ? t.filter(function (x) { return x.done; }).length / t.length : (p.status === 'done' ? 1 : 0); }

  var FIELDS = [
    { k: 'name', type: 'title', label: 'Project', ph: 'e.g. Paint the bedroom', req: true },
    { k: 'kind', label: 'Kind', type: 'select', options: KINDS.map(function (x) { return [x[0], x[1]]; }), def: 'other' },
    { k: 'room', label: 'Room', ph: 'e.g. Bedroom' },
    { k: 'status', label: 'Status', type: 'select', options: STATUS.map(function (s) { return [s[0], s[1]]; }), def: 'idea' },
    { k: 'budget', label: 'Budget', type: 'number', suffix: 'kr' },
    { k: 'start', label: 'Start', type: 'date' },
    { k: 'end', label: 'Done by', type: 'date' },
    { k: 'shared', label: 'Together with your partner', type: 'check', help: 'Costs can then go into Shared home, split by your usual %.' },
    { k: 'work', label: 'For the samboerkontrakt', type: 'select', options: WORK, def: 'improve', help: 'Only matters when it’s shared.' },
    { k: 'agreed', label: 'Agreed in writing', type: 'date', help: 'For an improvement: the day you both agreed to it.' },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, help: 'Measurements, the colour, who to call …' }];
  var NEWK = null;
  function cfgFor(defs) {
    return { key: 'hproj', addTitle: 'New project', editTitle: 'Edit project', fields: FIELDS.map(function (f) { return f.k in defs ? Object.assign({}, f, { def: defs[f.k] }) : f; }),
      beforeSave: function (it, isNew) {
        if (isNew) { if (window.Homes) it.home = window.Homes.view(); var k = kind(it.kind); it.tasks = (NEWK ? k[4] : []).map(function (t) { return { id: uid(), t: t, done: false }; }); it.costs = []; it.photos = []; it.at = today(); }
        if (it.status === 'done' && !it.doneAt) it.doneAt = today(); if (it.status !== 'done') delete it.doneAt;
        if (!it.shared) { delete it.work; delete it.agreed; }
      },
      afterSave: function (it, isNew) { NEWK = null; if (isNew) setTimeout(function () { location.hash = 'hproj=' + it.id; }, 60); if (it.status === 'done' && it.doneAt === today()) doneNudge(it); },
      onDelete: function (it) { HF && HF.release(it.photos || []); } };
  }
  var BASE = cfgFor({});
  function pickKind() {
    var HL = window.HomeLife; if (!HL) return K.edit(BASE, null);
    HL.dialog(HL.dhead('hammer', 'New project', 'What kind? It comes with a starter list of tasks.') + '<div class="hl-pick">' + KINDS.map(function (k, i) {
      return '<button type="button" data-hppick="' + i + '"><span class="kit-ic" style="--c:' + k[3] + '"><i class="bi bi-' + k[2] + '"></i></span><span><b>' + esc(k[1]) + '</b>' + (k[4].length ? '<small>' + esc(k[4].length + ' tasks to start with') + '</small>' : '<small>An empty list</small>') + '</span></button>';
    }).join('') + '</div>', function (e, close) {
      var b = e.target.closest('[data-hppick]'); if (!b) return; close();
      var k = KINDS[+b.dataset.hppick]; NEWK = k;
      setTimeout(function () { K.edit(cfgFor({ kind: k[0], name: k[0] === 'other' ? '' : k[1], shared: !!partner(), work: k[0] === 'repair' ? 'minor' : 'improve', status: 'plan' }), null); }, 120);
    });
  }
  var taskOpen = null;
  var col = K && mountEl ? K.collection({
    mount: mountEl, feature: 'hproj', key: 'hproj', filter: function (x) { return !window.Homes || window.Homes.inView(x); }, icon: 'hammer', title: 'Home projects', addLabel: 'Project', limit: 8,
    addTitle: BASE.addTitle, editTitle: BASE.editTitle, fields: BASE.fields, beforeSave: BASE.beforeSave, afterSave: BASE.afterSave, onDelete: BASE.onDelete,
    empty: 'Painting, a new bathroom, the garden – plan it here with tasks, a budget and what you spend. Shared projects go straight into Shared home.',
    sort: function (a, b) { var o = { doing: 0, plan: 1, idea: 2, done: 3 }; return (o[a.status] - o[b.status]) || ((a.end || a.start || '9') < (b.end || b.start || '9') ? -1 : 1); },
    summary: function (l) {
      if (!l.length) return '';
      var act = l.filter(function (p) { return p.status !== 'done'; }), bud = act.reduce(function (a, p) { return a + (+p.budget || 0); }, 0), sp = act.reduce(function (a, p) { return a + spent(p); }, 0);
      var y = String(new Date().getFullYear()), yr = l.reduce(function (a, p) { return a + arr(p.costs).filter(function (c) { return String(c.date || '').slice(0, 4) === y; }).reduce(function (b, c) { return b + (+c.amount || 0); }, 0); }, 0);
      return '<div class="kit-tiles"><div class="kit-tile" data-tk="active"><span>Going on</span><b>' + act.length + '</b><small>' + (l.length - act.length ? (l.length - act.length) + ' done' : '&nbsp;') + '</small></div>' +
        '<div class="kit-tile" data-tk="budget"><span>Spent of budget</span><b>' + (bud ? Math.round(sp / bud * 100) + ' %' : '–') + '</b><small>' + esc(bud ? kr(sp) + ' of ' + kr(bud) : sp ? kr(sp) : 'no budget set') + '</small></div>' +
        '<div class="kit-tile" data-tk="year"><span>Spent ' + y + '</span><b>' + nf.format(yr) + ' <small>kr</small></b><small>on all projects</small></div></div>';
    },
    row: function (p) {
      var k = kind(p.kind), s = st(p.status), t = arr(p.tasks), dn = t.filter(function (x) { return x.done; }).length, sp = spent(p);
      var due = t.filter(function (x) { return !x.done && isKey(x.due); }).sort(function (a, b) { return a.due < b.due ? -1 : 1; })[0];
      var flag = p.shared && p.work === 'improve' && !p.agreed ? ' · <span class="dn">not agreed in writing yet</span>' : '';
      return { icon: k[2], color: k[3], cls: p.status === 'done' ? 'hp-done' : '', title: p.name,
        sub: esc([p.room, t.length ? dn + ' of ' + t.length + ' tasks' : '', +p.budget ? kr(sp) + ' of ' + kr(p.budget) : sp ? kr(sp) + ' spent' : '', due ? 'next: ' + fmt(due.due) : p.end && p.status !== 'done' ? 'by ' + fmt(p.end) : ''].filter(Boolean).join(' · ')) + flag +
          '<span class="hp-bar"><i style="width:' + Math.round(prog(p) * 100) + '%;background:' + s[2] + '"></i></span>',
        right: '<span class="hl-chip" style="--c:' + s[2] + '">' + esc(s[1]) + '</span>' };
    },
    detail: function (p) {
      var t = arr(p.tasks), c = arr(p.costs), sp = spent(p), b = +p.budget || 0, pt = partner();
      return (p.notes ? '<p class="kit-notes">' + esc(p.notes) + '</p>' : '') +
        (p.shared && p.work === 'improve' ? '<p class="hp-agree' + (p.agreed ? ' ok' : '') + '"><i class="bi bi-' + (p.agreed ? 'check2-circle' : 'exclamation-triangle') + '"></i> ' + (p.agreed ? 'Improvement agreed in writing ' + esc(fmt(p.agreed, { day: 'numeric', month: 'short', year: 'numeric' })) : 'An improvement you share: agree it in writing first' + (pt ? ' with ' + esc(pt.name) : '') + ' – <button type="button" class="text-btn" data-hpagree="' + esc(p.id) + '">Agreed today</button>') + '</p>' : '') +
        '<div class="hp-stat">' + STATUS.map(function (s) { return '<button type="button" class="lf-chip" data-hpst="' + esc(p.id + '|' + s[0]) + '" aria-pressed="' + (p.status === s[0]) + '">' + esc(s[1]) + '</button>'; }).join('') + '</div>' +
        '<h3 class="lp-h3">Tasks</h3><ul class="hp-tasks">' + t.map(function (x) {
          var n = isKey(x.due) ? daysTo(x.due) : null;
          return '<li class="' + (x.done ? 'done' : '') + '"><label class="lf-check"><input type="checkbox" data-hptick="' + esc(p.id + '|' + x.id) + '"' + (x.done ? ' checked' : '') + '> <span data-noi18n>' + esc(x.t) + '</span></label>' +
            (taskOpen === x.id ? '<input type="date" class="hp-due" value="' + esc(x.due || '') + '" data-hpdue="' + esc(p.id + '|' + x.id) + '" aria-label="Day"><button type="button" class="icon-btn sm" data-hptdel="' + esc(p.id + '|' + x.id) + '" aria-label="Delete the task"><i class="bi bi-trash3"></i></button>'
              : (n != null && !x.done ? '<span class="hl-chip" style="--c:' + (n < 0 ? '#e66767' : n <= 3 ? '#c98500' : '#7a8794') + '">' + esc(n === 0 ? 'today' : n === 1 ? 'tomorrow' : fmt(x.due)) + '</span>' : '') + '<button type="button" class="icon-btn sm" data-hptopen="' + esc(x.id) + '" aria-label="Day or delete"><i class="bi bi-three-dots"></i></button>') + '</li>';
        }).join('') + '</ul><form class="hx-row hp-tadd" data-hptadd="' + esc(p.id) + '"><input name="t" placeholder="Add a task" maxlength="120" autocomplete="off"><button type="submit" class="icon-btn sm" aria-label="Add"><i class="bi bi-plus-lg"></i></button></form>' +
        '<div class="hx-fh"><h3 class="lp-h3">Spent ' + (b ? esc(kr(sp) + ' of ' + kr(b)) : esc(kr(sp))) + '</h3><button type="button" class="pill-btn sm" data-hpcost="' + esc(p.id) + '"><i class="bi bi-plus-lg"></i> Cost</button></div>' +
        (b ? '<span class="stack hp-budget"><span style="width:' + Math.min(100, sp / b * 100).toFixed(1) + '%;background:' + (sp > b ? '#e66767' : '#22b35e') + '"></span></span>' + (sp > b ? '<small class="dn">' + esc(kr(sp - b)) + ' over the budget</small>' : '<small class="muted">' + esc(kr(b - sp)) + ' left</small>') : '') +
        (c.length ? '<ul class="hp-costs">' + c.slice().sort(function (x, y) { return (y.date || '').localeCompare(x.date || ''); }).map(function (x) {
          return '<li><span><b data-noi18n>' + esc(x.what || 'Cost') + '</b><small>' + esc([fmt(x.date), x.sh ? 'in Shared home' : x.exp ? 'in Finances' : '', x.payer && x.payer !== 'me' && pt ? pt.name + ' paid' : ''].filter(Boolean).join(' · ')) + '</small></span><b class="money">' + esc(kr(x.amount)) + '</b><button type="button" class="icon-btn sm" data-hpcdel="' + esc(p.id + '|' + x.id) + '" aria-label="Remove"><i class="bi bi-x"></i></button></li>';
        }).join('') + '</ul>' : '') +
        '<h3 class="lp-h3">Before and after</h3>' + (HF ? HF.strip(p.photos, 'proj:' + p.id, { label: 'Add photos' }) : '') +
        (p.status === 'done' && Fe.on('hdocs') ? '<p class="hx-tip"><i class="bi bi-journal-bookmark"></i> Got papers from the job (manuals, the tradesman’s documentation)? Keep them in the <a href="#hdocs" data-hpgo="hdocs">FDV binder</a>.</p>' : '');
    },
    afterRender: function (el) { if (HF) HF.fill(el); },
    onClick: function (e) {
      var b;
      if ((b = e.target.closest('[data-hpst]'))) { var q = b.dataset.hpst.split('|'); saveOne(q[0], function (p) { p.status = q[1]; if (q[1] === 'done') p.doneAt = p.doneAt || today(); else delete p.doneAt; }); if (q[1] === 'done') doneNudge(byId(q[0])); return; }
      if ((b = e.target.closest('[data-hpagree]'))) return saveOne(b.dataset.hpagree, function (p) { p.agreed = today(); });
      if ((b = e.target.closest('[data-hptopen]'))) { taskOpen = taskOpen === b.dataset.hptopen ? null : b.dataset.hptopen; return col.render(); }
      if ((b = e.target.closest('[data-hptdel]'))) { var r = b.dataset.hptdel.split('|'), old = JSON.parse(JSON.stringify(arr((byId(r[0]) || {}).tasks))); saveOne(r[0], function (p) { p.tasks = arr(p.tasks).filter(function (x) { return x.id !== r[1]; }); }); taskOpen = null; return toast('<i class="bi bi-trash3"></i> Task deleted', function () { saveOne(r[0], function (p) { p.tasks = old; }); }); }
      if ((b = e.target.closest('[data-hpcost]'))) return costSheet(b.dataset.hpcost);
      if ((b = e.target.closest('[data-hpcdel]'))) return delCost(b.dataset.hpcdel.split('|'));
      if ((b = e.target.closest('[data-hpgo]'))) { e.preventDefault(); if (window.PageTabs) window.PageTabs.show('docs', true); var c = document.getElementById('hdocs'); if (c) setTimeout(function () { c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); }
    }
  }) : null;
  if (mountEl) {
    mountEl.addEventListener('click', function (e) { if (e.target.closest('[data-kit-add]')) { e.stopPropagation(); e.preventDefault(); pickKind(); } }, true);
    mountEl.addEventListener('change', function (e) {
      var c = e.target, q;
      if (c.dataset.hptick) { q = c.dataset.hptick.split('|'); saveOne(q[0], function (p) { arr(p.tasks).forEach(function (x) { if (x.id === q[1]) { x.done = c.checked; if (c.checked) x.at = today(); else delete x.at; } }); if (c.checked && p.status === 'idea' || c.checked && p.status === 'plan') p.status = 'doing'; }); return; }
      if (c.dataset.hpdue) { q = c.dataset.hpdue.split('|'); saveOne(q[0], function (p) { arr(p.tasks).forEach(function (x) { if (x.id === q[1]) { if (isKey(c.value)) x.due = c.value; else delete x.due; } }); }); taskOpen = null; }
    });
    mountEl.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-hptadd]'); if (!f) return; e.preventDefault();
      var v = f.t.value.trim(); if (!v) return; var pid = f.dataset.hptadd;
      /* "Buy paint 15.11" – a day at the end is the task's day */
      var due = null, m = v.match(/\s(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/);
      if (m) { var y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear(), d = new Date(y, +m[2] - 1, +m[1]); if (!m[3] && d < fromKey(today())) d.setFullYear(y + 1); if (+m[2] >= 1 && +m[2] <= 12) { due = dkey(d); v = v.slice(0, m.index).trim(); } }
      saveOne(pid, function (p) { p.tasks = arr(p.tasks); var x = { id: uid(), t: v.slice(0, 120), done: false }; if (due) x.due = due; p.tasks.push(x); });
      setTimeout(function () { var i = mountEl.querySelector('[data-hptadd="' + pid + '"] input'); if (i) i.focus(); }, 90);
    });
  }
  if (HF) {
    HF.onAdd('proj', function (pid, ids) { saveOne(pid, function (p) { p.photos = (p.photos || []).concat(ids); }); });
    HF.onRemove('proj', function (pid, ph) { var old = null; saveOne(pid, function (p) { old = (p.photos || []).slice(); p.photos = (p.photos || []).filter(function (x) { return x !== ph; }); }); HF.release(ph); toast('<i class="bi bi-trash3"></i> Photo removed', function () { saveOne(pid, function (p) { p.photos = old; }); }); });
  }
  function doneNudge(p) { if (!p) return; toast('<i class="bi bi-stars"></i> “' + esc(p.name) + '” is done' + (Fe.on('hdocs') ? ' – keep any papers in the FDV binder' : '')); if (window.Delight && window.Delight.confetti) try { window.Delight.confetti(); } catch (e) {} }

  /* a cost: into Shared home (shared projects) or Finances */
  function costSheet(pid) {
    var p = byId(pid); if (!p) return;
    var pt = p.shared ? partner() : null, S = window.Shared;
    var X = HF.sheet('New cost');
    X.box.innerHTML = HF.head('receipt', 'New cost', p.name) + '<form class="hx-form"><div class="mp-grid hs2-sg"><label class="hx-f"><span>What</span><input name="what" maxlength="80" placeholder="e.g. Paint, 10 litres" required autocomplete="off"></label><label class="hx-f"><span>Amount, kr</span><input name="amt" inputmode="decimal" required autocomplete="off"></label></div>' +
      '<label class="hx-f"><span>Date</span><input type="date" name="d" value="' + today() + '"></label>' +
      (pt && S ? '<p class="mp-lbl">Who paid</p><div class="lf-chips"><button type="button" class="lf-chip" data-hppay="me" aria-pressed="true">You</button><button type="button" class="lf-chip" data-hppay="' + esc(pt.id) + '" aria-pressed="false">' + esc(pt.name) + '</button></div>' +
        '<label class="lf-check"><input type="checkbox" name="fin" checked> <span>Put it in Shared home, split ' + esc(String(S.cfg().pct || 50).replace('.', ',')) + ' / ' + esc(String(100 - (S.cfg().pct || 50)).replace('.', ',')) + ' (' + esc((WORK.filter(function (w) { return w[0] === p.work; })[0] || WORK[0])[1].split(' – ')[0].split(' (')[0].toLowerCase()) + ')</span></label>'
        : '<label class="lf-check"><input type="checkbox" name="fin" checked> <span>Also put it in Finances (category Home)</span></label>') +
      '<div class="lf-foot"><span></span><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> Save</button></div></form>';
    var payer = 'me';
    X.box.addEventListener('click', function (e) { var b = e.target.closest('[data-hppay]'); if (b) { payer = b.dataset.hppay; X.box.querySelectorAll('[data-hppay]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === b)); }); } });
    X.box.addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, amt = num(f.amt.value), what = f.what.value.trim(), date = isKey(f.d.value) ? f.d.value : today();
      if (!what) return f.what.focus(); if (!(amt > 0)) return f.amt.focus();
      var cost = { id: uid(), date: date, what: what.slice(0, 80), amount: Math.round(amt * 100) / 100, payer: payer }, note = p.name + ': ' + what;
      var d = window.Vault.get();
      if (f.fin.checked && d) {
        if (pt && S) {
          var pct = +S.cfg().pct || 50, x = { id: uid(), date: date, note: note.slice(0, 80), total: cost.amount, payer: payer, cat: 'home', mode: 'pct', pct: pct, home: true, work: p.work || 'improve', proj: p.id };
          if (p.agreed) x.agreed = p.agreed;
          x.shares = { me: Math.round(cost.amount * pct) / 100 }; x.shares[pt.id] = Math.round((cost.amount - x.shares.me) * 100) / 100;
          d.expenses = d.expenses || [];
          if (payer === 'me') { var ex = { id: uid(), t: Date.now(), date: date, amount: cost.amount, cat: 'home', note: note.slice(0, 80) }; d.expenses.push(ex); x.exp = ex.id; window.Vault.save(d); }
          else x.add = true;
          S.saveItem(x, null, S.data());
          cost.sh = x.id;
        } else {
          d.expenses = d.expenses || []; var e2 = { id: uid(), t: Date.now(), date: date, amount: cost.amount, cat: 'home', note: note.slice(0, 80) }; d.expenses.push(e2); window.Vault.save(d); cost.exp = e2.id;
          window.dispatchEvent(new Event('fin:change'));
        }
      }
      saveOne(pid, function (q) { q.costs = arr(q.costs); q.costs.push(cost); if (q.status === 'idea' || q.status === 'plan') q.status = 'doing'; });
      X.close();
      if (!cost.sh) toast('<i class="bi bi-check2"></i> ' + esc(kr(cost.amount)) + ' added' + (cost.exp ? ' – also in Finances' : ''));
    });
  }
  function delCost(q) {
    var p = byId(q[0]); if (!p) return; var c = arr(p.costs).filter(function (x) { return x.id === q[1]; })[0]; if (!c) return;
    var old = JSON.parse(JSON.stringify(arr(p.costs)));
    saveOne(q[0], function (x) { x.costs = arr(x.costs).filter(function (y) { return y.id !== q[1]; }); });
    /* take it out of Finances / Shared home too */
    if (c.sh && window.Shared) { var it = (window.Shared.data().items || []).filter(function (x) { return x.id === c.sh; })[0]; if (it) { window.Shared.removeItem(it); return; } }
    var d = window.Vault.get(), before = d ? JSON.parse(JSON.stringify(d.expenses || [])) : null;
    if (c.exp && d) { d.expenses = (d.expenses || []).filter(function (e) { return e.id !== c.exp; }); window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
    toast('<i class="bi bi-trash3"></i> Cost removed', function () { saveOne(q[0], function (x) { x.costs = old; }); if (before) { var d2 = window.Vault.get(); d2.expenses = before; window.Vault.save(d2); window.dispatchEvent(new Event('fin:change')); } });
  }

  /* ---------- the rest of the dashboard ---------- */
  var here = /\/cmd\/house\//.test(location.pathname);
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!on()) return;
    var due = [];
    list().forEach(function (p) { if (p.status === 'done') return; arr(p.tasks).forEach(function (x) { if (!x.done && isKey(x.due) && daysTo(x.due) <= 0) due.push({ p: p, x: x }); }); });
    due.sort(function (a, b) { return a.x.due < b.x.due ? -1 : 1; });
    if (due.length) add(daysTo(due[0].x.due) < 0 ? 26 : 38, 'hammer', '#e8743b', (due.length === 1 ? due[0].x.t : due.length + ' project tasks due'), due.length === 1 ? due[0].p.name + (daysTo(due[0].x.due) < 0 ? ' · overdue' : ' · today') : due.slice(0, 2).map(function (d) { return d.x.t; }).join(' · '), (here ? '' : '/cmd/house/') + '#hproj=' + due[0].p.id, { key: 'hp:' + due.map(function (d) { return d.x.id; }).join(',') });
  });
  (window.EventsExtra = window.EventsExtra || []).push(function () {
    if (!on()) return [];
    var out = [];
    list().forEach(function (p) { if (p.status === 'done') return; arr(p.tasks).forEach(function (x) { if (!x.done && isKey(x.due)) out.push({ id: 'rem:hp:' + x.id, title: '🔨 ' + x.t, allDay: true, start: fromKey(x.due), days: 1, color: '#e8743b', readOnly: true, reminder: true, link: '/cmd/house/#hproj=' + p.id, location: '', notes: p.name, exDays: {} }); }); });
    return out;
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() ? [{ i: 'hammer', t: 'New home project', s: 'House · Projects', run: function () { if (mountEl && K) { if (window.PageTabs) window.PageTabs.show('projects', true); pickKind(); } else location.href = '/cmd/house/#hproj'; }, x: 'project prosjekt renovate oppussing paint male bathroom bad kitchen kjøkken garden hage' }] : [];
  });
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    if (!on()) return;
    list().forEach(function (p) { add('House', kind(p.kind)[2], p.name, 'Project · ' + st(p.status)[1] + (p.room ? ' · ' + p.room : ''), '/cmd/house/#hproj=' + p.id, p.start || '', [p.notes, arr(p.tasks).map(function (x) { return x.t; }).join(' '), 'project prosjekt'].join(' ')); });
  });
  window.HouseProjects = { list: list, spent: spent };
})();
