/* Food, batch 5 (Oct 2026):
     Pantry            – the basics you always keep at home. "Running out" puts one on the shopping list;
                         ticked off there, it's back in stock. Recipes skip basics you have.
     Recipe from a link – paste a recipe page's address: the Worker (/cmd/api/recipe) reads its
                         schema.org Recipe data – name, ingredients, steps, servings, time.
     Servings          – a recipe with "Serves" can be scaled up or down; the shopping list follows.
   Data in dash.tools: pantry [{id,name,state:'ok'|'low',alt?}], recipes[].serves. Settings in foodcfg. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, HL = window.HomeLife;
  if (!HL) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function on() { return Fe.on('food'); }
  function fcfg() { return HL.cfg('foodcfg'); }
  function snapshot(k) { return JSON.parse(JSON.stringify(Fe.tools()[k] || null)); }
  function restore(k, v) { var t = Fe.tools(); t[k] = v; Fe.saveTools(t); }
  var nb = window.I18N && window.I18N.lang === 'nb';

  /* ======================= servings ======================= */
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
  var SV = {};       // servings picked per recipe, this visit
  function servings(r, ctx) { var b = +r.serves || 0; if (!b) return 0; return ctx === 'week' ? (+fcfg().servings || b) : (SV[r.id] || +fcfg().servings || b); }
  function lines(r, ctx) { var b = +r.serves || 0, n = servings(r, ctx), f = b && n ? n / b : 1; return HL.ingredients(r).map(function (l) { return scaleLine(l, f); }); }
  function ingrInner(r) {
    var b = +r.serves || 0, n = servings(r), l = lines(r);
    return (b ? '<div class="fp5-serve"><span>Servings</span><button type="button" class="icon-btn sm" data-fpsv="' + esc(r.id) + '|-1" aria-label="Fewer servings"' + (n <= 1 ? ' disabled' : '') + '><i class="bi bi-dash-lg"></i></button><b>' + n + '</b>' +
      '<button type="button" class="icon-btn sm" data-fpsv="' + esc(r.id) + '|1" aria-label="More servings"' + (n >= 40 ? ' disabled' : '') + '><i class="bi bi-plus-lg"></i></button>' + (n !== b ? '<small class="muted">scaled from ' + b + '</small>' : '') + '</div>' : '') +
      (l.length ? '<ul class="hl-ingr" data-noi18n>' + l.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '');
  }
  function ingrBlock(r) { return '<div class="fp5-ingr" data-fprec="' + esc(r.id) + '">' + ingrInner(r) + '</div>'; }

  /* ======================= pantry ======================= */
  /* the usual basics: English, Norwegian, and the words recipes use for them */
  var BASICS = [['Salt', 'Salt', []], ['Pepper', 'Pepper', ['pepper', 'sort pepper', 'black pepper']], ['Olive oil', 'Olivenolje', ['olivenolje', 'olive oil']], ['Rapeseed oil', 'Rapsolje', ['rapsolje', 'matolje', 'nøytral olje', 'vegetable oil']],
    ['Rice', 'Ris', ['ris', 'rice']], ['Pasta', 'Pasta', ['pasta', 'spaghetti']], ['Flour', 'Hvetemel', ['hvetemel', 'mel', 'flour']], ['Sugar', 'Sukker', ['sukker', 'sugar']], ['Coffee', 'Kaffe', ['kaffe', 'coffee']], ['Tea', 'Te', ['te', 'tea']],
    ['Butter', 'Smør', ['smør', 'butter']], ['Eggs', 'Egg', ['egg', 'eggs']], ['Milk', 'Melk', ['melk', 'milk']], ['Onions', 'Løk', ['løk', 'onion', 'onions']], ['Garlic', 'Hvitløk', ['hvitløk', 'garlic']],
    ['Tinned tomatoes', 'Hermetiske tomater', ['hakkede tomater', 'tomater på boks', 'tinned tomatoes', 'chopped tomatoes']], ['Stock cubes', 'Buljong', ['buljong', 'buljongterning', 'stock cube']], ['Soy sauce', 'Soyasaus', ['soyasaus', 'soy sauce']],
    ['Toilet paper', 'Dopapir', ['dopapir', 'toilet paper']], ['Washing-up liquid', 'Oppvaskmiddel', ['oppvaskmiddel', 'washing-up liquid']]];
  function pantry() { return Fe.list('pantry'); }
  function word(k) { try { return new RegExp('(^|[^\\p{L}])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}])', 'iu'); } catch (e) { return new RegExp('\\b' + k + '\\b', 'i'); } }
  function keys(x) { return [String(x.name || '').toLowerCase()].concat(x.alt || []).filter(Boolean); }
  /* an ingredient line that is one of your basics, in stock → stays off the shopping list */
  function inPantry(s) {
    if (!fcfg().pantrySkip) return false;
    var t = String(s).toLowerCase();
    return pantry().some(function (x) { return x.state !== 'low' && keys(x).some(function (k) { return word(k).test(t); }); });
  }
  /* does a shopping list line ("2 dl melk") mean this pantry item ("Melk")? */
  function matches(x, text) { var t = String(text).toLowerCase(); return t === String(x.name).toLowerCase() || keys(x).some(function (k) { return word(k).test(t); }); }
  function inList(text) { return pantry().filter(function (x) { return matches(x, text); })[0]; }
  /* "2 dl melk" → "Melk", "1 boks hakkede tomater" → "Hakkede tomater" */
  var UNITS = /^(g|gram|kg|hg|dl|cl|ml|l|liter|ss|ts|spiseskje|teskje|stk|pk|pakke|pakker|boks|bokser|glass|bunt|fedd|klype|never|skive|skiver|tbsp|tsp|cups?|oz|lb|pcs|pack|packs|tins?|cans?|jars?|bunch|cloves?|x)\.?\s+/i;
  function cleanName(text) {
    var t = String(text).trim().replace(QRX, '').trim().replace(UNITS, '').replace(/^(av|of)\s+/i, '').trim();
    if (!t) t = String(text).trim();
    return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 60);
  }
  /* on a shopping list row: keep it in the pantry from now on (bought → in stock, still to buy → on the list) */
  function shopBtn(x) {
    if (!on() || inList(x.text)) return '';
    return '<button type="button" class="icon-btn sm fp5-topan" data-fptopan="' + esc(x.id) + '" aria-label="Keep ' + esc(cleanName(x.text)) + ' in the pantry" title="Keep in the pantry"><i class="bi bi-box-arrow-in-down"></i></button>';
  }
  var editP = false;
  function drawPantry() {
    var el = $t('pantry'); if (!el) return;
    var ok = on(); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; }
    var l = pantry(), low = l.filter(function (x) { return x.state === 'low'; });
    var keep = el.querySelector('.fp5-padd input'), typed = keep ? keep.value : '', focus = keep && document.activeElement === keep;
    var by = {}; l.forEach(function (x) { var a = HL.aisleOf(x.name); (by[a] = by[a] || []).push(x); });
    var groups = Object.keys(by).sort(function (a, b) { return HL.AISLE[a].i - HL.AISLE[b].i; });
    /* a tidy pantry: what's running out on top, then everything as tap-able chips by shop section */
    var sorted = function (arr) { return arr.slice().sort(function (x, y) { return x.name.localeCompare(y.name, 'nb'); }); };
    var chip = function (x) {
      var lw = x.state === 'low';
      if (editP) return '<span class="pn-chip edit" data-noi18n>' + esc(x.name) + '<button type="button" data-fpdel="' + esc(x.id) + '" aria-label="Remove ' + esc(x.name) + '"><i class="bi bi-x"></i></button></span>';
      return '<button type="button" class="pn-chip' + (lw ? ' low' : '') + '" ' + (lw ? 'data-fpok' : 'data-fplow') + '="' + esc(x.id) + '" data-pn="' + esc(x.name.toLowerCase()) + '" aria-label="' + esc(x.name) + (lw ? ' – on the shopping list, tap when you have it again' : ' – tap if it’s running out') + '">' +
        (lw ? '<i class="bi bi-cart3"></i>' : '') + '<span data-noi18n>' + esc(x.name) + '</span></button>';
    };
    var body = l.length ? (low.length && !editP ? '<div class="pn-low"><p><i class="bi bi-cart3"></i> Running out · on your shopping list</p><div class="pn-chips">' + sorted(low).map(function (x) {
        return '<button type="button" class="pn-chip low" data-fpok="' + esc(x.id) + '" aria-label="Got ' + esc(x.name) + ' again"><span data-noi18n>' + esc(x.name) + '</span><i class="bi bi-check2"></i></button>'; }).join('') + '</div><p class="pn-tip">Tap when it’s back in the cupboard</p></div>' : '') +
      '<div class="pn-groups">' + groups.map(function (a) {
        var A = HL.AISLE[a];
        return '<div class="pn-grp" data-pngrp><p class="pn-h" style="--c:' + A.c + '"><i class="bi bi-' + A.ic + '"></i> ' + esc(A.n) + ' <span>' + by[a].length + '</span></p><div class="pn-chips">' + sorted(by[a]).map(chip).join('') + '</div></div>';
      }).join('') + '</div>' + (editP ? '' : '<p class="pn-tip">Tap anything that’s running out – it goes on the shopping list.</p>')
      : '<p class="empty kit-empty">The basics you always keep at home. Tap one when it’s running out and it goes on the shopping list – ticked off there, it’s back in stock.</p><div class="hl-acts"><button type="button" class="pill-btn" data-fpbasics><i class="bi bi-magic"></i> Add the usual basics</button></div>';
    el.innerHTML = '<section class="card kit-card pn-card" id="pantry"><div class="card-head"><h2><i class="bi bi-box-seam"></i> Pantry' + (low.length ? ' <span class="hl-count">' + low.length + '</span>' : '') + '</h2>' +
      '<div class="head-actions">' + (l.length ? '<span class="muted pn-sum">' + l.length + ' at home</span><button type="button" class="text-btn" data-fpedit aria-pressed="' + editP + '"><i class="bi bi-' + (editP ? 'check2' : 'pencil') + '"></i> ' + (editP ? 'Done' : 'Edit') + '</button>' : '') + '</div></div>' +
      (l.length ? '<form class="hl-shopadd fp5-padd pn-find"><i class="bi bi-search" aria-hidden="true"></i><input placeholder="Find or add – e.g. oats" maxlength="60" enterkeyhint="done" autocomplete="off" aria-label="Find or add to the pantry"><button type="submit" class="icon-btn" aria-label="Add"><i class="bi bi-plus-lg"></i></button></form>' : '') +
      body + (!l.length ? '<form class="hl-shopadd fp5-padd"><input placeholder="Or add your own – e.g. oats" maxlength="60" enterkeyhint="done" autocomplete="off" aria-label="Add to the pantry"><button type="submit" class="icon-btn" aria-label="Add"><i class="bi bi-plus-lg"></i></button></form>' : '') +
      (editP && l.length < BASICS.length ? '<button type="button" class="text-btn" data-fpbasics><i class="bi bi-magic"></i> Add the usual basics you don’t have</button>' : '') + '</section>';
    filterPantry(el, typed);
    var inp = el.querySelector('.fp5-padd input'); inp.value = typed; if (focus) inp.focus();
    if (location.hash === '#pantry' && document.documentElement.classList.contains('unlocked')) { history.replaceState(null, '', location.pathname + location.search); setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 400); }
  }
  /* typing in "Find or add" narrows the chips; Enter adds it when it isn't there */
  function filterPantry(el, q) {
    q = String(q || '').trim().toLowerCase();
    el.querySelectorAll('.pn-groups [data-pn]').forEach(function (c) { c.hidden = !!q && c.dataset.pn.indexOf(q) < 0; });
    el.querySelectorAll('[data-pngrp]').forEach(function (g) { g.hidden = !!q && !g.querySelector('[data-pn]:not([hidden])'); });
    var low = el.querySelector('.pn-low'); if (low) low.hidden = !!q;
  }
  document.addEventListener('input', function (e) { var i = e.target.closest && e.target.closest('.pn-find input'); if (i) filterPantry($t('pantry'), i.value); });
  function setState(id, st) { var t = Fe.tools(); (t.pantry || []).forEach(function (x) { if (x.id === id) x.state = st; }); Fe.saveTools(t); }
  /* bought (ticked off) or cleared from the shopping list → back in stock */
  function syncShop() {
    if (!on() || !fcfg().pantryBack) return;
    var t = Fe.tools(), shop = Array.isArray(t.shop) ? t.shop : [], ch = false;
    (t.pantry || []).forEach(function (x) {
      if (x.state !== 'low') return;
      var it = shop.filter(function (s) { return matches(x, s.text); });
      if (!it.length || it.every(function (s) { return s.done; })) { x.state = 'ok'; ch = true; }
    });
    if (ch) Fe.saveTools(t);
  }
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('.fp5-padd'); if (!f) return;
    e.preventDefault();
    var inp = f.querySelector('input'), names = inp.value.split(/,|\n/).map(function (x) { return x.trim().slice(0, 60); }).filter(Boolean); inp.value = '';
    var t = Fe.tools(), l = Array.isArray(t.pantry) ? t.pantry : [], have = {}; l.forEach(function (x) { have[x.name.toLowerCase()] = 1; });
    var added = 0, already = [];
    names.forEach(function (n) { if (!have[n.toLowerCase()]) { l.push({ id: uid(), name: n.charAt(0).toUpperCase() + n.slice(1), state: 'ok' }); have[n.toLowerCase()] = 1; added++; } else already.push(n.toLowerCase()); });
    var el = $t('pantry'); if (el) filterPantry(el, '');
    if (added) { t.pantry = l; Fe.saveTools(t); toast('<i class="bi bi-box-seam"></i> ' + (added === 1 ? esc(names[0]) + ' is in the pantry' : added + ' added to the pantry')); }
    setTimeout(function () {
      already.forEach(function (n) { var c = document.querySelector('.pn-groups [data-pn="' + n.replace(/"/g, '') + '"]'); if (c) { c.classList.remove('pn-flash'); void c.offsetWidth; c.classList.add('pn-flash'); c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } });
      var i = document.querySelector('.fp5-padd input'); if (i) i.focus();
    }, 80);
  });
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-fplow]'))) {
      var x = pantry().filter(function (p) { return p.id === b.dataset.fplow; })[0]; if (!x) return;
      var oldS = snapshot('shop'), oldP = snapshot('pantry');
      HL.addShop([x.name], 'pantry'); setState(x.id, 'low');
      toast('<i class="bi bi-cart-plus"></i> ' + esc(x.name) + ' is on the shopping list', function () { restore('shop', oldS); restore('pantry', oldP); });
      return;
    }
    if ((b = e.target.closest('[data-fptopan]'))) {
      var si = (Fe.tools().shop || []).filter(function (q) { return q.id === b.dataset.fptopan; })[0]; if (!si) return;
      var o3 = snapshot('pantry'), t4 = Fe.tools(), nm = cleanName(si.text);
      t4.pantry = Array.isArray(t4.pantry) ? t4.pantry : [];
      t4.pantry.push({ id: uid(), name: nm, state: si.done ? 'ok' : 'low' }); Fe.saveTools(t4);
      toast('<i class="bi bi-box-seam"></i> ' + esc(nm) + (si.done ? ' is in the pantry' : ' – in the pantry, on the list'), function () { restore('pantry', o3); });
      return;
    }
    if ((b = e.target.closest('[data-fpok]'))) {
      var id = b.dataset.fpok, p = pantry().filter(function (q) { return q.id === id; })[0]; if (!p) return;
      var t = Fe.tools(); (t.shop || []).forEach(function (s) { if (s.from === 'pantry' && s.text.toLowerCase() === p.name.toLowerCase()) s.done = true; });
      (t.pantry || []).forEach(function (q) { if (q.id === id) q.state = 'ok'; }); Fe.saveTools(t);
      toast('<i class="bi bi-check2"></i> ' + esc(p.name) + ' – in stock'); return;
    }
    if ((b = e.target.closest('[data-fpdel]'))) { var o = snapshot('pantry'), t2 = Fe.tools(); t2.pantry = (t2.pantry || []).filter(function (q) { return q.id !== b.dataset.fpdel; }); Fe.saveTools(t2); toast('<i class="bi bi-trash3"></i> Removed', function () { restore('pantry', o); }); return; }
    if (e.target.closest('[data-fpedit]')) { editP = !editP; return drawPantry(); }
    if (e.target.closest('[data-fpbasics]')) {
      var o2 = snapshot('pantry'), t3 = Fe.tools(), l = Array.isArray(t3.pantry) ? t3.pantry : [], n = 0;
      BASICS.forEach(function (x) {
        var nm = nb ? x[1] : x[0];
        if (l.some(function (q) { return keys(q).indexOf(x[0].toLowerCase()) > -1 || keys(q).indexOf(x[1].toLowerCase()) > -1; })) return;
        l.push({ id: uid(), name: nm, state: 'ok', alt: [x[0].toLowerCase(), x[1].toLowerCase()].concat(x[2]) }); n++;
      });
      t3.pantry = l; Fe.saveTools(t3); editP = false;
      toast('<i class="bi bi-box-seam"></i> ' + n + ' basics added', function () { restore('pantry', o2); }); return;
    }
    if ((b = e.target.closest('[data-fpsv]'))) {
      var q2 = b.dataset.fpsv.split('|'), r = Fe.list('recipes').filter(function (x) { return x.id === q2[0]; })[0]; if (!r) return;
      SV[r.id] = Math.min(40, Math.max(1, servings(r) + (+q2[1])));
      var box = b.closest('.fp5-ingr'); if (box) box.innerHTML = ingrInner(r);
      return;
    }
    if (e.target.closest('[data-fpimport]')) { e.preventDefault(); openImport(''); }
  });
  ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(drawPantry.t); drawPantry.t = setTimeout(function () { syncShop(); drawPantry(); }, 30); }); });
  window.Vault.onUnlock(function () { setTimeout(function () { syncShop(); drawPantry(); }, 50); setTimeout(fromHash, 400); });

  /* ======================= recipe from a link ======================= */
  function openImport(url) {
    if (!on()) return;
    var st = { url: url || '', busy: false, r: null, err: '' };
    var dg = HL.dialog('<div class="fp5-imp"></div>', function (e, close) {
      if (e.target.closest('[data-fpisave]')) {
        var r = st.r, nm = (dg.el.querySelector('[name=fpname]') || {}).value || r.name;
        var t = Fe.tools(), l = Array.isArray(t.recipes) ? t.recipes : [], id = uid();
        l.push({ id: id, title: String(nm).trim().slice(0, 120) || 'Recipe', mins: r.mins || '', serves: r.servings || '', ingr: (r.ingredients || []).join('\n'), steps: (r.steps || []).join('\n').slice(0, 2000), link: r.url });
        t.recipes = l; Fe.saveTools(t); close();
        toast('<i class="bi bi-journal-check"></i> Recipe saved');
        if (/\/cmd\/food\//.test(location.pathname)) setTimeout(function () { location.hash = 'recipes=' + id; }, 150); else location.href = '/cmd/food/#recipes=' + id;
        return;
      }
      if (e.target.closest('[data-fpihand]')) {
        close();
        var go = function () { var a = document.querySelector('[data-tool="recipes"] [data-kit-add]'); if (!a) return; a.click(); setTimeout(function () { var ti = document.getElementById('kf-title'), li = document.getElementById('kf-link'); if (ti && st.title) ti.value = st.title; if (li) li.value = st.url; }, 60); };
        if (/\/cmd\/food\//.test(location.pathname)) setTimeout(go, 200);
        return;
      }
      if (e.target.closest('[data-fpiopen]')) { close(); location.hash = 'recipes=' + st.have; return; }
    });
    function draw() {
      var box = dg.el.querySelector('.fp5-imp'), h = HL.dhead('link-45deg', 'Recipe from a link', 'Paste the address of a recipe page – the name, ingredients and steps are read from it.');
      var form = '<form class="fp5-url"><input name="u" type="url" inputmode="url" placeholder="https://www.matprat.no/oppskrifter/…" value="' + esc(st.url) + '" autocomplete="off" required aria-label="Recipe link"><button type="submit" class="pill-btn"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? 'Reading …' : 'Get it') + '</button></form>';
      var r = st.r, res = '';
      if (st.have) res = '<p class="pp5-msg">You have this one already.</p><div class="hl-acts"><button type="button" class="pill-btn" data-fpiopen>Open it</button></div>';
      else if (st.err) res = '<p class="pp5-msg">' + esc(st.err) + '</p>' + (st.hand ? '<div class="hl-acts"><button type="button" class="text-btn" data-fpihand><i class="bi bi-pencil"></i> Add it by hand</button></div>' : '');
      else if (r) res = '<div class="fp5-prev"><input name="fpname" value="' + esc(r.name) + '" maxlength="120" aria-label="Name" data-noi18n><p class="muted hl-small">' +
        esc([r.servings ? 'Serves ' + r.servings : '', r.mins ? r.mins + ' min' : '', (r.ingredients || []).length + ' ingredients', (r.steps || []).length ? (r.steps || []).length + ' steps' : ''].filter(Boolean).join(' · ')) + '</p>' +
        '<ul class="hl-ingr" data-noi18n>' + (r.ingredients || []).slice(0, 10).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' + ((r.ingredients || []).length > 10 ? '<p class="muted hl-small">and ' + ((r.ingredients || []).length - 10) + ' more</p>' : '') +
        '<div class="qa-acts"><button type="button" class="text-btn" data-hlclose>Cancel</button><span class="spacer"></span><button type="button" class="pill-btn" data-fpisave><i class="bi bi-journal-plus"></i> Save recipe</button></div></div>';
      box.innerHTML = h + form + res;
      box.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); get(box.querySelector('[name=u]').value.trim()); });
    }
    function get(u) {
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
      st.url = u; st.err = ''; st.r = null; st.have = null; st.hand = false;
      var dup = Fe.list('recipes').filter(function (x) { return x.link && x.link.replace(/[?#].*$/, '') === u.replace(/[?#].*$/, ''); })[0];
      if (dup) { st.have = dup.id; return draw(); }
      st.busy = true; draw();
      fetch('/cmd/api/recipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: u }), credentials: 'same-origin' })
        .then(function (res) { return res.json().catch(function () { return { error: 'http ' + res.status }; }).then(function (j) { j._s = res.status; return j; }); })
        .then(function (j) {
          st.busy = false;
          if (j && j.name && j._s === 200) st.r = j;
          else if (j && j.error === 'no recipe') { st.err = 'There’s no recipe data on that page' + (j.title ? ' (“' + j.title + '”)' : '') + '. Many blogs don’t include it.'; st.hand = true; st.title = j.title || ''; }
          else if (j && j.error === 'not found') st.err = 'Your server doesn’t know this yet – paste the newest worker.js into the Worker (Settings → Data & sync has the details).';
          else if (j && j.error === 'unsupported link') st.err = 'That link can’t be read – use the address of a public web page.';
          else { st.err = 'Couldn’t read the page' + (j && j.error ? ' (' + j.error + ')' : '') + '. Try again, or add it by hand.'; st.hand = true; }
          draw();
        }, function () { st.busy = false; st.err = 'No connection – try again when you’re online.'; draw(); });
    }
    draw();
    if (url) get(url); else setTimeout(function () { var i = dg.el.querySelector('[name=u]'); if (i && innerWidth >= 700) i.focus(); }, 80);
  }
  /* /cmd/food/#recipe=<link> (from a Share Sheet shortcut) opens the import */
  function fromHash() {
    var m = location.hash.match(/^#recipe=(.+)$/); if (!m || !/\/cmd\/food\/$/.test(location.pathname)) return;
    var u = ''; try { u = decodeURIComponent(m[1]); } catch (e) { u = m[1]; }
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(function () { openImport(u); }, 200);
  }
  window.addEventListener('hashchange', function () { if (document.documentElement.classList.contains('unlocked')) fromHash(); });

  window.FoodPlus = { shopBtn: shopBtn, cleanName: cleanName, inPantry: inPantry, lines: lines, ingrBlock: ingrBlock, scale: scaleLine, openImport: openImport, pantry: pantry,
    importBtn: function () { return '<button type="button" class="text-btn" data-fpimport aria-label="Recipe from a link"><i class="bi bi-link-45deg"></i> From a link</button>'; } };
  window.CommandExtra = window.CommandExtra || [];
  window.CommandExtra.push(function () { return on() ? [
    { i: 'link-45deg', t: 'Recipe from a link', s: 'Food', run: function () { openImport(''); }, x: 'recipe import link url oppskrift lenke' },
    { i: 'box-seam', t: 'Pantry', s: 'Food', run: function () { location.href = '/cmd/food/#pantry'; }, x: 'pantry basics skap basisvarer running out' }] : []; });
})();
