/* Quick add – the extra kinds (2026-11-22, JP: "All of it"): shopping, dinner, mood, wish, return, gift idea, thank-you,
   freezer, use it up, flex. Not in any page bundle: quick.js loads dist/quick-more.js the first time the sheet opens
   (build.py stamps QMV_V), so every page stays light. It hands back the forms, the saving and the form → saving glue. */
window.QuickMore = function (api) {
  'use strict';
  var Fe = api.Fe, esc = api.esc, uid = api.uid, today = api.today, pad = api.pad, num = api.num, toast = api.toast, K = api.K;
  function nowHM() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function retDay(got, n) { var d = new Date(got + 'T12:00'); d.setDate(d.getDate() + (n || 14)); var k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); return window.Smart ? window.Smart.when(k) : k; }
  function qform(kind, body, go) {
    return '<form class="qa-form" data-kind="' + kind + '">' + body + '<div class="qa-acts"><button type="button" class="text-btn" data-close><span data-t="ui.cancel">Cancel</span></button><span class="spacer"></span><button class="pill-btn wide" type="submit">' + esc(go) + '</button></div></form>';
  }
  /* a new row in one of the tool lists, with Undo */
  function push(key, row, msg) {
    var t = Fe.tools(), l = Array.isArray(t[key]) ? t[key] : [], x = Object.assign({ id: uid() }, row); Object.keys(x).forEach(function (k) { if (x[k] === undefined) delete x[k]; });
    l.push(x); t[key] = l; Fe.saveTools(t);
    toast('<i class="bi bi-check-lg"></i> ' + esc(msg), function () { var t2 = Fe.tools(); t2[key] = (t2[key] || []).filter(function (q) { return q.id !== x.id; }); Fe.saveTools(t2); }); return true;
  }
  function undoable(msg, key, isNew) { toast('<i class="bi bi-check-lg"></i> ' + esc(msg), function () { var t2 = Fe.tools(); t2[key] = (t2[key] || []).filter(function (q) { return !isNew(q); }); Fe.saveTools(t2); }); }
  var FORMS = {
    /* more kinds (2026-11-22, JP: "All of it") – each only while its section is on */
    shop: function (p) { return qform('shop', '<input name="t" autocomplete="off" required placeholder="' + esc(K('ui.qa-shop-ph', 'Milk, eggs, bread – commas for several')) + '" value="' + esc(p.t || '') + '">', K('ui.qa-shop-go', 'Add to the list')); },
    dinner: function (p) { return qform('dinner', '<input name="t" autocomplete="off" required placeholder="' + esc(K('ui.qa-dinner-ph', 'What’s for dinner – e.g. Taco')) + '" value="' + esc(p.t || '') + '"><div class="qa-row"><input name="d" type="date" value="' + esc(p.d || today()) + '" aria-label="' + esc(K('ui.date', 'Date')) + '"></div>', K('ui.qa-dinner-go', 'Plan dinner')); },
    mood: function (p) {
      var M = [[1, 'emoji-frown', K('ui.lp-md-1', 'Bad')], [2, 'emoji-neutral', K('ui.lp-md-2', 'Meh')], [3, 'emoji-smile', K('ui.lp-md-3', 'OK')], [4, 'emoji-laughing', K('ui.lp-md-4', 'Good')], [5, 'emoji-heart-eyes', K('ui.lp-md-5', 'Great')]];
      return qform('mood', '<div class="qa-moods">' + M.map(function (m) { return '<label><input type="radio" name="m" value="' + m[0] + '"' + (+p.m === m[0] ? ' checked' : '') + '><i class="bi bi-' + m[1] + '"></i><span>' + esc(m[2]) + '</span></label>'; }).join('') + '</div>' +
        '<input name="t" autocomplete="off" placeholder="' + esc(K('ui.qa-mood-ph', 'One line about today (optional)')) + '" value="' + esc(p.t || '') + '">', K('ui.qa-mood-go', 'Save today'));
    },
    wish: function (p) { return qform('wish', '<input name="t" autocomplete="off" required placeholder="' + esc(K('ui.qa-wish-ph', 'What you’d like – e.g. Coffee machine')) + '" value="' + esc(p.t || '') + '"><div class="qa-row"><input name="a" inputmode="decimal" placeholder="' + esc(K('ui.qa-price', 'Price (kr)')) + '" value="' + esc(p.a || '') + '"></div>', K('ui.qa-wish-go', 'Add wish')); },
    'return': function (p) {
      var D = [[14, K('ui.lp-ret-14', '14 days – bought online or by phone (angrerett)')], [30, K('ui.lp-ret-30', '30 days')], [60, K('ui.lp-ret-60', '60 days')], [100, K('ui.lp-ret-100', '100 days')], [365, K('ui.lp-ret-365', 'A year')]];
      return qform('return', '<input name="t" autocomplete="off" required placeholder="' + esc(K('ui.lp-ret-ph', 'e.g. Jacket from Zalando')) + '" value="' + esc(p.t || '') + '"><div class="qa-row"><input name="d" type="date" value="' + esc(p.d || today()) + '" aria-label="' + esc(K('ui.lp-ret-got', 'Received')) + '">' +
        '<select name="n" aria-label="' + esc(K('ui.lp-ret-days', 'Return within')) + '">' + D.map(function (d) { return '<option value="' + d[0] + '">' + esc(d[1]) + '</option>'; }).join('') + '</select></div>', K('ui.qa-return-go', 'Add with deadline'));
    },
    gift: function (p) {
      var ppl = (Fe.tools().people || []).filter(function (x) { return x && x.name; }).sort(function (a, b) { return String(a.name).localeCompare(b.name, 'nb'); }), sel = String(p.who || '').toLowerCase();
      if (!ppl.length) return '<p class="muted qa-hint">' + esc(K('ui.qa-gift-none', 'Add people on the People page first – then gift ideas go on the right person.')) + '</p>';
      return qform('gift', '<div class="qa-row"><select name="p" aria-label="' + esc(K('ui.qa-for', 'For')) + '">' + ppl.map(function (x) { return '<option value="' + esc(x.id) + '"' + (sel && String(x.name).toLowerCase().indexOf(sel) === 0 ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>' +
        '<input name="t" autocomplete="off" required placeholder="' + esc(K('ui.qa-gift-ph', 'The idea – e.g. a book about birds')) + '" value="' + esc(p.t || '') + '">', K('ui.qa-gift-go', 'Save idea'));
    },
    thanks: function (p) { return qform('thanks', '<input name="t" autocomplete="off" required placeholder="' + esc(K('ui.lp-ty-ph', 'e.g. A scarf, a dinner invitation')) + '" value="' + esc(p.t || '') + '"><input name="f" autocomplete="off" placeholder="' + esc(K('ui.qa-from', 'From whom')) + '" value="' + esc(p.f || '') + '">', K('ui.qa-thanks-go', 'Add')); },
    freezer: function (p) { return qform('freezer', '<input name="t" autocomplete="off" required placeholder="' + esc(K('ui.lp-frz-ph', 'e.g. Bolognese, bread, berries')) + '" value="' + esc(p.t || '') + '"><div class="qa-row"><input name="n" type="number" min="1" max="50" value="' + esc(p.n || 1) + '" aria-label="' + esc(K('ui.lp-frz-n', 'Portions')) + '"><span class="muted">' + esc(K('ui.lp-frz-n', 'Portions')) + '</span></div>', K('ui.qa-freezer-go', 'Into the freezer')); },
    usefood: function (p) { var d2 = new Date(); d2.setDate(d2.getDate() + 2); var dk = d2.getFullYear() + '-' + pad(d2.getMonth() + 1) + '-' + pad(d2.getDate());
      return qform('usefood', '<input name="t" autocomplete="off" required placeholder="' + esc(K('ui.lp-use-ph', 'e.g. Spinach, cream, half a chicken')) + '" value="' + esc(p.t || '') + '"><div class="qa-row"><input name="d" type="date" value="' + esc(p.d || dk) + '" aria-label="' + esc(K('ui.lp-use-by', 'Use by')) + '"></div>', K('ui.qa-use-go', 'Add')); },
    flex: function (p) { return qform('flex', '<div class="qa-row"><input name="d" type="date" value="' + esc(p.d || today()) + '" aria-label="' + esc(K('ui.date', 'Date')) + '"><input name="i" type="time" value="' + esc(p.i || '08:00') + '" aria-label="' + esc(K('ui.qa-in', 'In')) + '"><input name="o" type="time" value="' + esc(p.o || nowHM()) + '" aria-label="' + esc(K('ui.qa-out', 'Out')) + '"></div>', K('ui.qa-flex-go', 'Log the day')); }
  };
  var ADD = {
    /* more kinds (2026-11-22) – saved where their section keeps them, with Undo */
    shop: function (p) {
      var items = (p.items || []).map(function (x) { return String(x).trim(); }).filter(Boolean); if (!items.length) return false;
      var HL = window.HomeLife, before = (Fe.tools().shop || []).map(function (x) { return x.id; });
      if (HL && HL.addShop) HL.addShop(items, '');   /* typed by you: on the list even if the pantry says you have it */ else { var t = Fe.tools(); t.shop = (t.shop || []).concat(items.map(function (x) { return { id: uid(), text: x.slice(0, 120), done: false, from: 'quick' }; })); Fe.saveTools(t); }
      undoable(K('ui.qa-shop-ok', 'On the shopping list: {t}', { t: items.join(', ') }), 'shop', function (x) { return before.indexOf(x.id) < 0; }); return true;
    },
    dinner: function (p) {
      var x = String(p.text || '').trim(); if (!x) return false; var d = p.date || today(), t = Fe.tools(), m = t.meals && typeof t.meals === 'object' && !Array.isArray(t.meals) ? t.meals : {}, was = m[d];
      m[d] = x.slice(0, 80); t.meals = m; Fe.saveTools(t);
      toast('<i class="bi bi-check-lg"></i> ' + esc(K('ui.qa-dinner-ok', 'Dinner {d}: {t}', { d: window.Smart ? window.Smart.when(d) : d, t: x })), function () { var t2 = Fe.tools(); if (was) t2.meals[d] = was; else delete t2.meals[d]; Fe.saveTools(t2); }); return true;
    },
    mood: function (p) {
      var md = +p.mood || 0, line = String(p.line || '').trim(); if (!md && !line) return false;
      var t = Fe.tools(), l = Array.isArray(t.journal) ? t.journal : [], d = today(), j = l.filter(function (x) { return x.date === d; })[0], old = j ? Object.assign({}, j) : null;
      if (!j) { j = { id: uid(), date: d, mood: String(md || 3), line: '' }; l.push(j); }
      if (md) j.mood = String(md); if (line) j.line = j.line ? j.line + ' ' + line : line; t.journal = l; Fe.saveTools(t);
      toast('<i class="bi bi-check-lg"></i> ' + esc(K('ui.qa-mood-ok', 'Today is saved')), function () { var t2 = Fe.tools(); t2.journal = (t2.journal || []).filter(function (x) { return x.id !== j.id; }); if (old) t2.journal.push(old); Fe.saveTools(t2); }); return true;
    },
    wish: function (p) { var x = String(p.title || '').trim(); if (!x) return false; return push('wishes', { title: x.slice(0, 120), price: +p.price > 0 ? +p.price : undefined, prio: 2, 'for': 'home', added: today() }, K('ui.qa-wish-ok', 'On the wishlist: {t}', { t: x })); },
    'return': function (p) { var x = String(p.title || '').trim(); if (!x) return false; return push('returns', { title: x.slice(0, 120), got: p.got || today(), days: +p.days || 14, state: 'open' }, K('ui.qa-return-ok', '{t} – last day {d}', { t: x, d: retDay(p.got || today(), +p.days || 14) })); },
    gift: function (p) {
      var idea = String(p.idea || '').trim(); if (!idea) return false;
      var t = Fe.tools(), ppl = t.people || [], who = p.pid ? ppl.filter(function (x) { return x.id === p.pid; })[0] : ppl.filter(function (x) { return x.name && String(x.name).toLowerCase().indexOf(String(p.who || '').toLowerCase()) === 0; })[0];
      if (!who) { toast(esc(K('ui.qa-gift-who', 'Couldn’t find {n} in People', { n: p.who || '' }))); return false; }
      var was = who.gifts || ''; who.gifts = (was ? was.replace(/\s+$/, '') + '\n' : '') + idea.slice(0, 120); Fe.saveTools(t);
      toast('<i class="bi bi-check-lg"></i> ' + esc(K('ui.qa-gift-ok', 'Gift idea for {n}', { n: who.name })), function () { var t2 = Fe.tools(); (t2.people || []).forEach(function (x) { if (x.id === who.id) x.gifts = was; }); Fe.saveTools(t2); }); return true;
    },
    thanks: function (p) {
      var x = String(p.what || '').trim(); if (!x) return false; var f = String(p.from || '').trim(), pp = f ? (Fe.tools().people || []).filter(function (q) { return q.name && String(q.name).toLowerCase() === f.toLowerCase(); })[0] : null;
      return push('thanks', { what: x.slice(0, 120), pid: pp ? pp.id : '', from: pp ? '' : f.slice(0, 60), date: p.date || today(), done: false }, K('ui.qa-thanks-ok', 'Noted – say thanks soon'));
    },
    freezer: function (p) { var x = String(p.title || '').trim(); if (!x) return false; return push('freezer', { title: x.slice(0, 80), n: Math.max(1, Math.min(50, +p.n || 1)), date: today() }, K('ui.qa-freezer-ok', 'In the freezer: {t}', { t: x })); },
    usefood: function (p) { var x = String(p.title || '').trim(); if (!x) return false; return push('usefood', { title: x.slice(0, 80), by: p.by || today() }, K('ui.qa-use-ok', 'Use it up: {t}', { t: x })); },
    flex: function (p) {
      if (!/^\d{2}:\d{2}$/.test(p.in || '') || !/^\d{2}:\d{2}$/.test(p.out || '') || p.out <= p.in) return false;
      return push('flex', { date: p.date || today(), type: 'work', in: p.in, out: p.out, brk: 0 }, K('ui.qa-flex-ok', 'Flex: {a}–{b}', { a: p.in, b: p.out }));
    }
  };
  var SAVE = {
    shop: function (f) { return ADD.shop({ items: f.t.value.split(/\s*,\s*/) }); },
    dinner: function (f) { return ADD.dinner({ text: f.t.value, date: f.d.value }); },
    mood: function (f) { var m = f.querySelector('[name=m]:checked'); return ADD.mood({ mood: m ? +m.value : 0, line: f.t.value }); },
    wish: function (f) { return ADD.wish({ title: f.t.value, price: num(f.a.value) }); },
    'return': function (f) { return ADD['return']({ title: f.t.value, got: f.d.value, days: +f.n.value }); },
    gift: function (f) { return ADD.gift({ pid: f.p.value, idea: f.t.value }); },
    thanks: function (f) { return ADD.thanks({ what: f.t.value, from: f.f.value }); },
    freezer: function (f) { return ADD.freezer({ title: f.t.value, n: +f.n.value }); },
    usefood: function (f) { return ADD.usefood({ title: f.t.value, by: f.d.value }); },
    flex: function (f) { return ADD.flex({ date: f.d.value, in: f.i.value, out: f.o.value }); }
  };
  return { FORMS: FORMS, ADD: ADD, SAVE: SAVE };
};
