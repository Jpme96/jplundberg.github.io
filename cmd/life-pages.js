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
  /* NS 3451 (the building parts table): the main and two-digit groups, [code, English, Norwegian]. The standard is
     Standard Norge's – only these headings are kept here (the repo is public); three-digit codes are typed in and
     remembered per user (tools.fdvcodes). NS 3424 (condition surveys): TG 0–3 / IU, KG 0–3, survey level 1–3. */
  var NS = [['2', 'Building', 'Bygning'], ['21', 'Ground and foundations', 'Grunn og fundamenter'], ['22', 'Load-bearing structure', 'Bæresystemer'], ['23', 'Outer walls', 'Yttervegger'], ['24', 'Inner walls', 'Innervegger'], ['25', 'Floors and slabs', 'Dekker'], ['26', 'Roof', 'Yttertak'], ['27', 'Fixed furnishings', 'Fast inventar'], ['28', 'Stairs and balconies', 'Trapper, balkonger m.m.'], ['29', 'Other building parts', 'Andre bygningsmessige deler'],
    ['3', 'Plumbing, heating and ventilation', 'VVS-installasjoner'], ['31', 'Sanitary', 'Sanitær'], ['32', 'Heating', 'Varme'], ['33', 'Fire extinguishing', 'Brannslokking'], ['34', 'Gas and compressed air', 'Gass og trykkluft'], ['35', 'Heat pumps and cooling', 'Varmepumpe- og kuldeinstallasjoner'], ['36', 'Air handling (ventilation)', 'Luftbehandling'], ['37', 'Comfort cooling', 'Komfortkjøling'], ['38', 'Water treatment', 'Vannbehandling'], ['39', 'Other HVAC installations', 'Andre VVS-installasjoner'],
    ['4', 'Electrical power', 'Elkraft'], ['41', 'Basic electrical installations', 'Basisinstallasjoner for elkraft'], ['42', 'High-voltage supply', 'Høyspent forsyning'], ['43', 'Low-voltage supply', 'Lavspent forsyning'], ['44', 'Lighting', 'Lys'], ['45', 'Electric heating', 'Elvarme'], ['46', 'Backup power', 'Reservekraft'], ['47', 'Local power production', 'Lokal elkraftproduksjon'], ['48', 'Electrical protection', 'Installasjon for elektrisk beskyttelse'], ['49', 'Other electrical installations', 'Andre elkraftinstallasjoner'],
    ['5', 'Electronic communication and automation', 'Ekom og automatisering'], ['51', 'Basic ekom and automation', 'Basisinstallasjoner for ekom og automatisering'], ['52', 'Integrated communication', 'Integrert kommunikasjon'], ['53', 'Telephony and paging', 'Telefoni og personsøking'], ['54', 'Alarm and signal', 'Alarm og signal'], ['55', 'Sound and picture', 'Lyd og bilde'], ['56', 'Automation', 'Automatisering'], ['57', 'Instrumentation', 'Instrumentering'], ['59', 'Other ekom and automation', 'Andre installasjoner for ekom og automatisering'],
    ['6', 'Other installations', 'Andre installasjoner'], ['61', 'Prefabricated rooms', 'Prefabrikkerte rom'], ['62', 'Lifts and transport', 'Person- og varetransport'], ['63', 'Transport systems', 'Transportanlegg'], ['64', 'Local heat production', 'Lokal varmeproduksjon'], ['65', 'Waste and vacuum systems', 'Avfall og støvsuging'], ['66', 'Fixed special equipment', 'Fastmontert spesialutrustning for virksomhet'], ['67', 'Loose special equipment', 'Løs spesialutrustning for virksomhet'], ['68', 'Furnishings', 'Inventar'], ['69', 'Other technical installations', 'Andre tekniske installasjoner'],
    ['7', 'Outdoors', 'Utendørs'], ['71', 'Worked terrain', 'Bearbeidet terreng'], ['72', 'Outdoor structures', 'Utendørs konstruksjoner'], ['73', 'Outdoor pipework', 'Utendørs røranlegg'], ['74', 'Outdoor electrical', 'Utendørs elkraft'], ['75', 'Outdoor ekom and automation', 'Utendørs ekom og automatisering'], ['76', 'Roads and yards', 'Veier og plasser'], ['77', 'Park and green areas', 'Park og grøntanlegg'], ['78', 'Outdoor infrastructure', 'Utendørs infrastruktur'], ['79', 'Other outdoor', 'Andre utendørs anlegg']];
  var NSM = {}; NS.forEach(function (q) { NSM[q[0]] = q; });
  function nb() { return window.I18N && I18N.lang === 'nb'; }
  /* the name of a code: a two-digit or main group from the table, a three-digit one from your own list (else its group's name) */
  var OWN = { l: null, m: {}, at: 0 };
  function ownMap() { if (Date.now() - OWN.at < 400) return OWN.m; OWN.at = Date.now(); var l = Fe.tools().fdvcodes, k = Array.isArray(l) && l.length ? l.length + '|' + JSON.stringify(l[0]) + JSON.stringify(l[l.length - 1]) + JSON.stringify(l[l.length >> 1]) : ''; if (k !== OWN.l) { OWN.l = k; OWN.m = {}; (Array.isArray(l) ? l : []).forEach(function (c) { if (c && c.c) OWN.m[c.c] = c.n || ''; }); } return OWN.m; }
  function nsName(code) { code = String(code || ''); var own = ownMap()[code]; if (own) return own; var q = NSM[code] || NSM[code.slice(0, 2)] || NSM[code.slice(0, 1)]; return q ? (nb() ? q[2] : q[1]) : ''; }
  function nsLabel(code) { return code ? code + ' ' + nsName(code) : ''; }
  /* a finding's building part as one line: "23 Outer walls · 2nd floor, south" (older findings may only have their place) */
  function partLabel(x) { return [nsLabel(x.code), x.part].filter(Boolean).join(' · ') || (nb() ? 'Uten kode' : 'No code'); }
  var KG = { 0: ['KG 0', 'No consequences', '#22b35e'], 1: ['KG 1', 'Small consequences', '#3987e5'], 2: ['KG 2', 'Medium consequences', '#c98500'], 3: ['KG 3', 'Large consequences', '#e66767'] };
  /* priority from TG and KG (this app's own help, not a rule of the standard): TG × KG – 6 and up high, 3–5 medium, 1–2 low */
  function prio(x) { var t = +x.tg, k = +x.kg; if (!isFinite(t) || x.kg == null || x.kg === '' || !isFinite(k)) return null; var s = t * k; return s >= 6 ? 3 : s >= 3 ? 2 : s >= 1 ? 1 : 0; }
  var PRIO = { 3: ['High', '#e66767'], 2: ['Medium', '#c98500'], 1: ['Low', '#3987e5'], 0: ['None', '#22b35e'] };
  var WHEN = { now: 'Now', y1: 'Within 1 year', y5: '1–5 years', y10: '5–10 years' };
  function summary(r) {
    var f = r.findings || [], by = function (t) { return f.filter(function (x) { return String(x.tg) === t; }); };
    var lines = ['FDV inspection – ' + (r.building || ''), [r.address, fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' }), r.client ? 'For ' + r.client : '', r.level ? 'Survey level ' + r.level + ' (NS 3424)' : ''].filter(Boolean).join(' · '), ''];
    lines.push('Summary: ' + ['3', '2', '1', '0', 'iu'].map(function (t) { return by(t).length ? by(t).length + ' × ' + TG[t][0] : ''; }).filter(Boolean).join(', '), '');
    ['3', '2', '1', 'iu', '0'].forEach(function (t) {
      if (!by(t).length) return;
      lines.push(TG[t][0] + ' – ' + TG[t][1]);
      by(t).slice().sort(function (p, q) { return String(p.code || '9').localeCompare(String(q.code || '9')); }).forEach(function (x) { var pr = prio(x); lines.push('• ' + partLabel(x) + ': ' + x.text + (x.kg != null && x.kg !== '' ? ' (' + KG[x.kg][0] + (pr != null ? ', priority ' + PRIO[pr][0].toLowerCase() : '') + ')' : '') + (x.action ? ' → ' + x.action : '') + (x.when && WHEN[x.when] ? ' [' + WHEN[x.when] + ']' : '')); });
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
  window.LifePages = { redraw: drawAll, summary: summary, partLabel: partLabel, nsLabel: nsLabel, NS: NS };
  (window.__core = window.__core || {})["lifepages"] = { ownMap: ownMap, NS: NS, NSM: NSM, nsName: nsName, nsLabel: nsLabel, partLabel: partLabel, KG: KG, prio: prio, PRIO: PRIO, WHEN: WHEN, pad: pad, nf: nf, cheapest: cheapest, Fe: Fe, prices: prices, drawAll: drawAll, mounts: mounts, addDays: addDays, dkey: dkey, fromKey: fromKey, pwLoading: pwLoading, readJSON: readJSON, on: on, summary: summary, TG: TG, fmt: fmt, starter: starter, toast: toast, saveTpls: saveTpls, uid: uid, STARTER: STARTER, templates: templates, support: support };
})();
