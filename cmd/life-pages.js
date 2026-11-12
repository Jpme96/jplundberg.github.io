/* Optional cards on the pages they belong to (Settings → Features):
     Finances   Strømpris (hour-by-hour price in NO1), Savings jars
     Work       FDV inspection notes (findings with TG, a summary to send), Holiday planner
     Health     Gym log (sets × reps × kg, progress, next weight), Rest-day advisor
     Travel     Smart packing (from the trip's length and weather)
   Each mounts into a [data-tool="…"] box in the page, like the other tools. */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in life-pages.page.js, loaded only on its own page. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var Fe = window.Features;
  if (!Fe) return;
  function on(k) { return Fe.on(k); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function fmt(k, o) { return fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  var mounts = [];
  function drawAll() { mounts.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  var pwLoading = {};
  function prices(k) {
    var c = readJSON('dash.power', {}) || {};
    if (c[k]) return c[k];
    if (pwLoading[k]) return null;
    pwLoading[k] = true;
    var d = fromKey(k), url = 'https://www.hvakosterstrommen.no/api/v1/prices/' + d.getFullYear() + '/' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_NO1.json';
    /* through your Worker (cached, no browser limits); straight from the source if the Worker is older */
    var get = function (u) { return fetch(u, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
    get('/cmd/api/power?date=' + k).catch(function () { return get(url); }).then(function (l) {
      if (!Array.isArray(l)) throw new Error('bad');
      /* by the hour (the market gives 15-minute prices since autumn 2025) – incl. 25 % VAT, in øre */
      var h = []; for (var i = 0; i < 24; i++) h.push([]);
      l.forEach(function (x) { var t = new Date(x.time_start); if (dkey(t) === k) h[t.getHours()].push(x.NOK_per_kWh * 125); });
      var out = h.map(function (v) { return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; });
      var cc = readJSON('dash.power', {}) || {}; Object.keys(cc).forEach(function (x) { if (x < addDays(dkey(new Date()), -2)) delete cc[x]; });
      cc[k] = out; try { localStorage.setItem('dash.power', JSON.stringify(cc)); } catch (e) {}
      pwLoading[k] = false; drawAll(); window.dispatchEvent(new Event('brief:refresh'));
    }).catch(function () { pwLoading[k] = 'fail'; drawAll(); });
    return null;
  }
  function cheapest(h, len, from) {
    var best = null;
    for (var i = from || 0; i + len <= 24; i++) {
      var v = h.slice(i, i + len); if (v.some(function (x) { return x == null; })) continue;
      var a = v.reduce(function (s, x) { return s + x; }, 0) / len;
      if (!best || a < best.avg) best = { h: i, avg: a };
    }
    return best;
  }
  function support(p) { return p - .9 * Math.max(0, p - 93.75); }
  window.BriefExtra = window.BriefExtra || [];
  window.BriefExtra.push(function (add, now) {
    if (!on('power')) return;
    var tk = dkey(now), h = prices(tk); if (!h) return;
    var cfg = Fe.tools().powercfg || {}; if (cfg.norgespris) return;
    var c3 = cheapest(h, 3, now.getHours()), cur = h[now.getHours()];
    if (c3 && c3.h === now.getHours()) add(36, 'lightning-charge', '#22b35e', 'Cheap power now – ' + nf.format(Math.round(cur)) + ' øre', 'Good time to wash, dry or charge · until ' + pad(c3.h + 3) + ':00', (Fe.on('house') ? '/cmd/house/#power' : '/cmd/finance/#power'));
    else if (c3 && now.getHours() >= 17 && now.getHours() < 23) add(48, 'lightning-charge', '#c98500', 'Cheapest power ' + pad(c3.h) + '–' + pad(c3.h + 3), nf.format(Math.round(c3.avg)) + ' øre/kWh · now ' + nf.format(Math.round(cur)) + ' øre', (Fe.on('house') ? '/cmd/house/#power' : '/cmd/finance/#power'));
  });
  var TG = { 0: ['TG 0', 'No issues', '#22b35e'], 1: ['TG 1', 'Minor issues', '#3987e5'], 2: ['TG 2', 'Significant issues', '#c98500'], 3: ['TG 3', 'Serious issues', '#e66767'], iu: ['TG IU', 'Not examined', '#8b8f9a'] };
  function summary(r) {
    var f = r.findings || [], by = function (t) { return f.filter(function (x) { return String(x.tg) === t; }); };
    var lines = ['FDV inspection – ' + (r.building || ''), [r.address, fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' }), r.client ? 'For ' + r.client : ''].filter(Boolean).join(' · '), ''];
    lines.push('Summary: ' + ['3', '2', '1', '0', 'iu'].map(function (t) { return by(t).length ? by(t).length + ' × ' + TG[t][0] : ''; }).filter(Boolean).join(', '), '');
    ['3', '2', '1', 'iu', '0'].forEach(function (t) {
      if (!by(t).length) return;
      lines.push(TG[t][0] + ' – ' + TG[t][1]);
      by(t).forEach(function (x) { lines.push('• ' + x.part + ': ' + x.text + (x.action ? ' → ' + x.action : '')); });
      lines.push('');
    });
    if (r.notes) lines.push('Notes: ' + r.notes);
    return lines.join('\n').trim();
  }
  function templates() { var l = Fe.tools().gymtpl; return Array.isArray(l) ? l.filter(function (t) { return t && t.name && Array.isArray(t.ex); }) : []; }
  function saveTpls(l) { var t = Fe.tools(); t.gymtpl = l; Fe.saveTools(t); }
  var STARTER = [['Push', ['Bench press', 'Overhead press', 'Dips', 'Triceps pushdown']], ['Pull', ['Pull-ups', 'Barbell row', 'Lat pulldown', 'Biceps curl']], ['Legs', ['Squat', 'Romanian deadlift', 'Leg press', 'Calf raise']]];
  function starter() {
    var l = templates();
    STARTER.forEach(function (s) { if (!l.some(function (t) { return String(t.name || '').toLowerCase() === s[0].toLowerCase(); })) l.push({ id: uid(), name: s[0], ex: s[1].map(function (n) { return { n: n, sets: 3, r: 8 }; }) }); });
    saveTpls(l); toast('<i class="bi bi-collection"></i> Push, Pull and Legs added – tap one to start');
  }
  window.PowerPrice = { day: prices, support: support };
  window.GymTpl = { list: templates, starter: starter };
  window.LifePages = { redraw: drawAll, summary: summary };
  (window.__core = window.__core || {})["lifepages"] = { pad: pad, nf: nf, cheapest: cheapest, Fe: Fe, prices: prices, drawAll: drawAll, mounts: mounts, addDays: addDays, dkey: dkey, fromKey: fromKey, pwLoading: pwLoading, readJSON: readJSON, on: on, summary: summary, TG: TG, fmt: fmt, starter: starter, toast: toast, saveTpls: saveTpls, uid: uid, STARTER: STARTER, templates: templates, support: support };
})();
