/* Food, batch 5 (Oct 2026):
     Pantry            – the basics you always keep at home. "Running out" puts one on the shopping list;
                         ticked off there, it's back in stock. Recipes skip basics you have.
     Recipe from a link – paste a recipe page's address: the Worker (/cmd/api/recipe) reads its
                         schema.org Recipe data – name, ingredients, steps, servings, time.
     Servings          – a recipe with "Serves" can be scaled up or down; the shopping list follows.
   Data in dash.tools: pantry [{id,name,state:'ok'|'low',alt?}], recipes[].serves. Settings in foodcfg. */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in food-plus.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["foodplus"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  var HL = window.HomeLife;
  if (!HL) return;
  function on() { return Fe.on('food'); }
  function fcfg() { return HL.cfg('foodcfg'); }
  var FR = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125 };
  var QRX = /^(\d+\s+\d+\/\d+|\d+\s*[½¼¾⅓⅔⅛]|[½¼¾⅓⅔⅛]|\d+\/\d+|\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?/;
  function qval(s) {
    var m; s = s.trim();
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
    if ((m = s.match(/^(\d+)\s*([½¼¾⅓⅔⅛])$/))) return +m[1] + FR[m[2]];
    if (FR[s] != null) return FR[s];
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
    return parseFloat(s.replace(',', '.'));
  }
  function qfmt(x) {
    if (x >= 10) return String(Math.round(x));
    var w = Math.floor(x), q = Math.round((x - w) * 4) / 4;
    if (q === 1) { w++; q = 0; }
    var f = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' }[q];
    if (!w && !f) return String(Math.max(.1, Math.round(x * 10) / 10)).replace('.', ',');
    return (w ? String(w) : '') + f;
  }
  function scaleLine(line, f) {
    if (f === 1) return line;
    var m = line.match(QRX); if (!m) return line;
    var out = qfmt(qval(m[1]) * f); if (m[2]) out += '–' + qfmt(qval(m[2]) * f);
    return out + line.slice(m[0].length);
  }
  var SV = {};
  function servings(r, ctx) { var b = +r.serves || 0; if (!b) return 0; return ctx === 'week' ? (+fcfg().servings || b) : (SV[r.id] || +fcfg().servings || b); }
  function lines(r, ctx) { var b = +r.serves || 0, n = servings(r, ctx), f = b && n ? n / b : 1; return HL.ingredients(r).map(function (l) { return scaleLine(l, f); }); }
  function pantry() { return Fe.list('pantry').filter(function (x) { return typeof x.name === 'string' && x.name.trim(); }); }
  function word(k) { try { return new RegExp('(^|[^\\p{L}])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}])', 'iu'); } catch (e) { return new RegExp('\\b' + k + '\\b', 'i'); } }
  function keys(x) { return [String(x.name || '').toLowerCase()].concat(x.alt || []).filter(Boolean); }
  function inPantry(s) {
    if (!fcfg().pantrySkip) return false;
    var t = String(s).toLowerCase();
    return pantry().some(function (x) { return x.state !== 'low' && keys(x).some(function (k) { return word(k).test(t); }); });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function matches(x, text) { var t = String(text).toLowerCase(); return t === String(x.name).toLowerCase() || keys(x).some(function (k) { return word(k).test(t); }); }
  var UNITS = /^(g|gram|kg|hg|dl|cl|ml|l|liter|ss|ts|spiseskje|teskje|stk|pk|pakke|pakker|boks|bokser|glass|bunt|fedd|klype|never|skive|skiver|tbsp|tsp|cups?|oz|lb|pcs|pack|packs|tins?|cans?|jars?|bunch|cloves?|x)\.?\s+/i;
  function cleanName(text) {
    var t = String(text).trim().replace(QRX, '').trim().replace(UNITS, '').replace(/^(av|of)\s+/i, '').trim();
    if (!t) t = String(text).trim();
    return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 60);
  }
  /* the pantry follows the shopping list (running out → on the list, ticked off → back in stock): a data job, on every page */
  function syncShop() {
    if (!on()) return;
    var t = Fe.tools(), shop = Array.isArray(t.shop) ? t.shop : [], ch = false, cfg = fcfg(), added = [];
    t.pantry = Array.isArray(t.pantry) ? t.pantry : [];
    t.pantry.forEach(function (x) {
      if (!x) return;
      var it = shop.filter(function (s) { return s && matches(x, s.text); });
      if (x.state === 'low' && cfg.pantryBack && (!it.length || it.every(function (s) { return s.done; }))) { x.state = 'ok'; ch = true; }
      else if (x.state !== 'low' && cfg.pantryLow !== false && it.some(function (s) { return !s.done; })) { x.state = 'low'; ch = true; }
    });
    if (cfg.shopToPantry !== false) {
      var no = Array.isArray(t.pantryNo) ? t.pantryNo : [];
      if (!t.shopPanInit) { shop.forEach(function (s) { if (s && s.done) s.pan = 1; }); t.shopPanInit = 1; ch = true; }   /* what was ticked before this existed stays out */
      else shop.forEach(function (s) {
        if (!s || !s.done || s.pan) return;
        s.pan = 1; ch = true;
        if (t.pantry.some(function (x) { return x && matches(x, s.text); })) return;
        var nm = cleanName(s.text); if (!nm || no.indexOf(nm.toLowerCase()) > -1) return;
        var it = { id: uid(), name: nm, state: 'ok' }; t.pantry.push(it); added.push(it);
      });
    }
    if (ch) Fe.saveTools(t);
    if (added.length) toast('<i class="bi bi-box-seam"></i> ' + (added.length === 1 ? esc(added[0].name) + ' is in the pantry' : added.length + ' added to the pantry'), function () {
      var t2 = Fe.tools(), ids = added.map(function (x) { return x.id; });
      t2.pantry = (t2.pantry || []).filter(function (x) { return x && ids.indexOf(x.id) < 0; });
      t2.pantryNo = (Array.isArray(t2.pantryNo) ? t2.pantryNo : []).concat(added.map(function (x) { return x.name.toLowerCase(); })).slice(-200);
      Fe.saveTools(t2);
    });
  }
  ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(syncShop.t); syncShop.t = setTimeout(syncShop, 30); }); });
  window.Vault.onUnlock(function () { setTimeout(syncShop, 50); });
  window.CommandExtra = window.CommandExtra || [];
  window.CommandExtra.push(function () { return on() ? [
    { i: 'link-45deg', t: 'Recipe from a link', s: 'Food', run: function () { if (__ui().openImport) __ui().openImport(''); else location.href = '/cmd/food/#recipe='; }, x: 'recipe import link url oppskrift lenke' },
    { i: 'box-seam', t: 'Pantry', s: 'Food', run: function () { location.href = '/cmd/food/#pantry'; }, x: 'pantry basics skap basisvarer running out' }] : []; });
  window.FoodPlus = { inPantry: inPantry, lines: lines, scale: scaleLine, pantry: pantry, importBtn: function () { return '<button type="button" class="text-btn" data-fpimport aria-label="Recipe from a link" data-t-aria-label="ui.recipe-from-a-link"><i class="bi bi-link-45deg"></i> <span data-t="ui.from-a-link">From a link</span></button>'; } };
  (window.__core = window.__core || {})["foodplus"] = { matches: matches, cleanName: cleanName, syncShop: syncShop, on: on, Fe: Fe, HL: HL, lines: lines, scaleLine: scaleLine, qval: qval, FR: FR, qfmt: qfmt, QRX: QRX, servings: servings, SV: SV, fcfg: fcfg, inPantry: inPantry, word: word, keys: keys, pantry: pantry };
})();
