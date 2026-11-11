/* Homes (Nov 2026): the homes you live in over the years, and their history – House → History.
   One home is "now" (dash.tools.homeCur). Moving? "Set up your next home" archives the one you leave:
   its take-over guide (with the photos), the moving checklist, its loans (closed as paid off when sold, with a
   copy of how they stood), the price it was sold for – and starts a fresh take-over guide for the new place.
   Claims, projects and FDV documents belong to a home (item.home; old items without it = the first home), so
   each home keeps its own. On the House page you can look at an earlier home (sessionStorage dash.homeView):
   Projects, Docs and Claims then show that home, with a bar to go back to now.
   History shows every home with its years, take-over record, claims report, projects, documents (.zip),
   money while you lived there (spending per year, on the home, shared purchases), loans, value and power use.
   Data: dash.tools.homes = [{id, name, addr, from, to, kind, seller, agent, co, coName, price, sold, notes,
     take, move, loans:[{id,name,owed,part,rate,pay,with,value,at}]}], dash.tools.homeCur. */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in house-homes.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["homes"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function on() { return Fe.on('house'); }
  function raw() { var l = Fe.tools().homes; return Array.isArray(l) ? l.filter(function (h) { return h && h.id; }) : []; }
  function list() { return raw(); }
  function first() { var l = raw(); return l.length ? l[0].id : 'h1'; }
  function current() { var c = Fe.tools().homeCur, l = raw(); return c && l.some(function (h) { return h.id === c; }) ? c : l.length ? l[l.length - 1].id : 'h1'; }
  function get(id) { return raw().filter(function (h) { return h.id === id; })[0] || null; }
  var VK = 'dash.homeView';
  function view() { var v = null; try { v = sessionStorage.getItem(VK); } catch (e) {} return v && get(v) ? v : current(); }
  function setView(id) { try { if (!id || id === current()) sessionStorage.removeItem(VK); else sessionStorage.setItem(VK, id); } catch (e) {} window.dispatchEvent(new Event('homes:view')); window.dispatchEvent(new Event('tools:change')); }
  function isPast(id) { return !!id && id !== current() && !!get(id); }
  function belongs(x, id) { return ((x && x.home) || first()) === (id || view()); }
  function inView(x) { return belongs(x, view()); }
  function label(h) { if (!h) return 'Home'; var t = h.id === current() ? Fe.tools().htake || {} : {}; return h.name || t.addr || h.addr || 'Home'; }
  function years(h) { var a = isKey(h.from) ? h.from.slice(0, 4) : '', b = isKey(h.to) ? h.to.slice(0, 4) : h.id === current() ? 'now' : ''; return a && b ? (a === b ? a : a + '–' + b) : a || b; }
  function ensure() {
    if (!on()) return;
    var t = Fe.tools(); if (Array.isArray(t.homes) && t.homes.length) return;
    var tk = t.htake || {}, mv = t.hmove || {};
    t.homes = [{ id: 'h1', name: '', addr: tk.addr || '', from: isKey(mv.date) ? mv.date : '', kind: tk.kind || 'used', seller: tk.seller || '', agent: tk.agent || '', loans: [] }];
    t.homeCur = 'h1'; Fe.saveTools(t);
  }
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() ? [{ i: 'truck', t: 'Set up a new home (moving)', s: 'House · History', run: function () { if (__ui().el) __ui().newHome(); else location.href = '/cmd/house/#hhist'; }, x: 'move flytte new home ny bolig moving history historikk' },
      { i: 'clock-history', t: 'Home history', s: 'House', run: function () { location.href = '/cmd/house/#hhist'; }, x: 'history historikk homes boliger old previous tidligere' }] : [];
  });
  window.Homes = { list: list, get: get, current: current, view: view, setView: setView, isPast: isPast, belongs: belongs, inView: inView, label: label, years: years, ensure: ensure };
  (window.__core = window.__core || {})["homes"] = { on: on, Fe: Fe, ensure: ensure, isKey: isKey, years: years, current: current, raw: raw, label: label, inView: inView, view: view, get: get, VK: VK, belongs: belongs, first: first, isPast: isPast, setView: setView, list: list };
})();
