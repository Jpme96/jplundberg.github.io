/* Home projects (Nov 2026): plans for the home on their own House tab – paint the bedroom, a new bathroom,
   floors, the garden. Each project has a kind (with a starter task list), status, budget, tasks with a day,
   what you've spent, and before/after photos.
   Shared with your partner: a cost can go straight into Shared home as a shared purchase (minor repair,
   urgent repair or improvement – so the 5 000 kr repairs cap and the "agree improvements in writing" rule
   from the samboerkontrakt keep working), otherwise into Finances as a Home expense.
   Data: dash.tools.hproj = [{id, name, kind, room, status idea|plan|doing|done, budget, start, end, shared, work, agreed,
     notes, tasks:[{id,t,done,due}], costs:[{id,date,what,amount,exp,sh,payer}], photos:[], doneAt}]. Photos: pj-… */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in house-proj.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["proj"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  var HF = window.HouseFiles;
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +(p[2] || 1)); }
  function today() { return dkey(new Date()); }
  function daysTo(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function on() { return Fe.on('house') && Fe.on('hproj'); }
  function list() { return Fe.list('hproj'); }
  function arr(x) { return Array.isArray(x) ? x.filter(function (y) { return y && typeof y === 'object'; }) : []; }
  HF && HF.uses(function () { var ids = []; list().forEach(function (p) { ids = ids.concat(p.photos || []); }); return ids; });
  var KINDS = [
    ['paint', 'Paint a room', 'brush', '#8a6fdf', ['Pick the colour and buy paint', 'Wash the walls and fill holes', 'Tape and cover the floor', 'Prime where it’s needed', 'Two coats', 'Note the colour code in Good to know']],
    ['bath', 'Bathroom', 'droplet-half', '#0891b2', ['Get 2–3 quotes from wet-room approved firms (våtromsgodkjent)', I18N.k('ui.agree-price-start-and-finish-in-writing', 'Agree price, start and finish in writing'), I18N.k('ui.photos-of-the-membrane-and-drain-before', 'Photos of the membrane and drain before the tiles go on'), I18N.k('ui.get-the-documentation-and-the-samsvarser', 'Get the documentation and the samsvarserklæring'), 'Save the papers in the FDV binder']],
    ['kitchen', 'Kitchen', 'cup-hot', '#e8743b', ['Measure and draw it', 'Quotes for the kitchen and the fitting', 'An authorised electrician for sockets and the cooker', 'A plumber for the sink and dishwasher (with a leak guard)', I18N.k('ui.plan-the-delivery', 'Plan the delivery'), 'Keep manuals and warranties in the FDV binder']],
    ['floor', 'Floors', 'grid-3x3', '#c98500', ['Choose the floor and measure the m²', 'Check the subfloor is level and dry', 'Let the boards settle in the room for 48 hours', 'Lay the floor', 'Skirting boards', 'Keep the product sheet (FDV)']],
    ['outdoor', 'Garden or outdoors', 'tree', '#22b35e', ['Make a plan', 'Check the rules (housing association or kommune)', I18N.k('ui.buy-what-you-need', 'Buy what you need'), I18N.k('ui.do-the-work', 'Do the work'), 'Tidy up']],
    ['repair', 'Repair', 'wrench-adjustable', '#e66767', ['Find the cause', 'Get a quote or buy the parts', 'Fix it', 'Check it again after a week']],
    ['other', 'Something else', 'hammer', '#7a8794', []]];
  function kind(k) { return KINDS.filter(function (x) { return x[0] === k; })[0] || KINDS[KINDS.length - 1]; }
  var STATUS = [['idea', 'Idea', '#7a8794'], ['plan', 'Planned', '#3987e5'], ['doing', 'Under way', '#e8743b'], ['done', 'Done', '#22b35e']];
  function st(k) { return STATUS.filter(function (s) { return s[0] === k; })[0] || STATUS[0]; }
  function spent(p) { return arr(p.costs).reduce(function (a, c) { return a + (+c.amount || 0); }, 0); }
  var here = /\/cmd\/house\//.test(location.pathname);
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!on()) return;
    var due = [];
    list().forEach(function (p) { if (p.status === 'done') return; arr(p.tasks).forEach(function (x) { if (!x.done && isKey(x.due) && daysTo(x.due) < 0) due.push({ p: p, x: x }); }); });   /* today's tasks are already in At a glance through the calendar – here only the overdue ones */
    due.sort(function (a, b) { return a.x.due < b.x.due ? -1 : 1; });
    if (due.length) add(26, 'hammer', '#e8743b', (due.length === 1 ? due[0].x.t : due.length + ' project tasks overdue'), due.length === 1 ? due[0].p.name + (daysTo(due[0].x.due) < 0 ? ' · overdue' : ' · today') : due.slice(0, 2).map(function (d) { return d.x.t; }).join(' · '), (here ? '' : '/cmd/house/') + '#hproj=' + due[0].p.id, { key: 'hp:' + due.map(function (d) { return d.x.id; }).join(',') });
  });
  (window.EventsExtra = window.EventsExtra || []).push(function () {
    if (!on()) return [];
    var out = [];
    list().forEach(function (p) { if (p.status === 'done') return; arr(p.tasks).forEach(function (x) { if (!x.done && isKey(x.due)) out.push({ id: 'rem:hp:' + x.id, title: '🔨 ' + x.t, allDay: true, start: fromKey(x.due), days: 1, color: '#e8743b', readOnly: true, reminder: true, link: '/cmd/house/#hproj=' + p.id, location: '', notes: p.name, exDays: {} }); }); });
    return out;
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() ? [{ i: 'hammer', t: 'New home project', s: 'House · Projects', run: function () { if (__ui().mountEl && __ui().K) { if (window.PageTabs) window.PageTabs.show('projects', true); __ui().pickKind(); } else location.href = '/cmd/house/#hproj'; }, x: 'project prosjekt renovate oppussing paint male bathroom bad kitchen kjøkken garden hage' }] : [];
  });
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    if (!on()) return;
    list().forEach(function (p) { add('House', kind(p.kind)[2], p.name, 'Project · ' + st(p.status)[1] + (p.room ? ' · ' + p.room : ''), '/cmd/house/#hproj=' + p.id, p.start || '', [p.notes, arr(p.tasks).map(function (x) { return x.t; }).join(' '), 'project prosjekt'].join(' ')); });
  });
  window.HouseProjects = { list: list, spent: spent };
  (window.__core = window.__core || {})["proj"] = { arr: arr, st: st, STATUS: STATUS, kind: kind, KINDS: KINDS, list: list, Fe: Fe, on: on, fromKey: fromKey, isKey: isKey, here: here, daysTo: daysTo, today: today, dkey: dkey, pad: pad, HF: HF, spent: spent };
})();
