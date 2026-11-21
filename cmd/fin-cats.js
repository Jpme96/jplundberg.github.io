/* Spending categories in one place (2026-11-21, JP: "your own spending categories"). The nine built-in ones stay;
   you can add your own (name, colour, icon), rename any of them and remove your own. Every file that shows or picks a
   category asks here: FinCats.list() / get(id) / name(id), or FinCats.live(shape) for a list kept up to date in place.
   Data: the vault's own top-level key `spendCats` = { own: [{ id, name, color, icon }], names: { builtInId: 'Your name' } }
   – a new key, so older copies simply don't have it. A head module: names are looked up when asked (the words load later). */
(function () {
  'use strict';
  var BASE = [
    ['groceries', 'ui.groceries', 'Groceries', '#11a597', 'basket'], ['eating', 'ui.eating-out', 'Eating out', '#d95926', 'cup-hot'],
    ['transport', 'ui.transport', 'Transport', '#3987e5', 'bus-front'], ['shopping', 'ui.shopping', 'Shopping', '#c98500', 'bag'],
    ['home', 'ui.home', 'Home', '#a0673a', 'house'], ['fun', 'ui.fun', 'Fun', '#d55181', 'controller'], ['health', 'ui.health', 'Health', '#8a6fdf', 'heart-pulse'],
    ['travel', 'ui.travel', 'Travel', '#0891b2', 'airplane'], ['other', 'ui.other', 'Other', '#6b6d73', 'three-dots']];
  /* what you can pick for your own: colours that read on light and dark, icons in cmd's set */
  var COLORS = ['#e0b100', '#2f9d62', '#3a8a78', '#305b90', '#5c4e92', '#e895b7', '#e57a3c', '#883635', '#7a5a44', '#555c66'];
  var ICONS = ['car-front', 'receipt', 'arrow-repeat', 'bag-heart', 'gift', 'bag-check', 'scissors', 'cart', 'tools', 'lightning-charge', 'phone', 'wifi', 'piggy-bank', 'mortarboard', 'book', 'balloon-heart', 'trophy', 'music-note-beamed', 'camera', 'paw', 'flower1', 'cup-straw', 'fuel-pump', 'shield-check', 'people', 'briefcase', 'star', 'tag'];
  function k(key, en) { return window.I18N && I18N.k ? I18N.k(key, en) : en; }
  function data(d) { d = d || (window.Vault && window.Vault.get && window.Vault.get()) || {}; var s = d.spendCats; return s && typeof s === 'object' ? s : { own: [], names: {} }; }
  function list(d) {
    var s = data(d), nm = s.names || {};
    return BASE.map(function (b) { return { id: b[0], name: nm[b[0]] || k(b[1], b[2]), color: b[3], icon: b[4], own: false }; }).slice(0, 8)
      .concat((s.own || []).filter(function (c) { return c && c.id && c.name; }).map(function (c) { return { id: c.id, name: String(c.name).slice(0, 40), color: COLORS.indexOf(c.color) > -1 ? c.color : COLORS[0], icon: ICONS.indexOf(c.icon) > -1 ? c.icon : 'tag', own: true }; }))
      .concat([{ id: 'other', name: nm.other || k('ui.other', 'Other'), color: BASE[8][3], icon: BASE[8][4], own: false }]);   /* Other always last */
  }
  function get(id, d) { var L = list(d); for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return L[L.length - 1]; }
  function has(id, d) { return list(d).some(function (c) { return c.id === id; }); }
  /* lists kept up to date in place, in the shape each file already used */
  var LIVE = [];
  function shape(c, how) { return how === 'pair' ? [c.id, c.name] : how === 'plan' ? [c.id, c.name, c.color, c.icon] : { id: c.id, name: c.name, color: c.color, icon: c.icon, own: c.own }; }
  function fill(a) { var L = list(); a.length = 0; L.forEach(function (c) { a.push(shape(c, a.__how)); }); return a; }
  function live(how) { var a = []; a.__how = how || 'obj'; fill(a); LIVE.push(a); if (LIVE.length > 60) LIVE.splice(0, LIVE.length - 60); return a; }
  function refill() { LIVE.forEach(fill); }
  function save(fn) {
    var d = window.Vault && window.Vault.get(); if (!d) return false;
    var s = JSON.parse(JSON.stringify(data(d))); s.own = s.own || []; s.names = s.names || {};
    var r = fn(s, d); if (r === false) return false;
    d.spendCats = s; window.Vault.save(d); refill();
    try { window.dispatchEvent(new Event('cats:change')); window.dispatchEvent(new Event('fin:change')); } catch (e) {}
    return true;
  }
  function slug(name) { return 'c_' + String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '').slice(0, 16) + '_' + Date.now().toString(36).slice(-4); }
  function add(name, color, icon) {
    name = String(name || '').trim().slice(0, 40); if (!name) return null;
    var id = slug(name);
    return save(function (s) { if (s.own.length >= 30) return false; s.own.push({ id: id, name: name, color: COLORS.indexOf(color) > -1 ? color : COLORS[s.own.length % COLORS.length], icon: ICONS.indexOf(icon) > -1 ? icon : 'tag' }); }) ? id : null;
  }
  function edit(id, ch) {
    return save(function (s) {
      var o = s.own.filter(function (c) { return c.id === id; })[0];
      if (o) { if (ch.name != null && String(ch.name).trim()) o.name = String(ch.name).trim().slice(0, 40); if (ch.color && COLORS.indexOf(ch.color) > -1) o.color = ch.color; if (ch.icon && ICONS.indexOf(ch.icon) > -1) o.icon = ch.icon; return; }
      if (!BASE.some(function (b) { return b[0] === id; })) return false;
      var n = String(ch.name == null ? '' : ch.name).trim().slice(0, 40); if (n) s.names[id] = n; else delete s.names[id];   /* an empty name gives the built-in one back */
    });
  }
  /* remove one of your own: its expenses, remembered shops and spending caps move to `to` (default Other) */
  function remove(id, to) {
    to = to && to !== id ? to : 'other';
    return save(function (s, d) {
      if (!s.own.some(function (c) { return c.id === id; })) return false;
      s.own = s.own.filter(function (c) { return c.id !== id; });
      (d.expenses || []).forEach(function (e) { if (e && e.cat === id) e.cat = to; });
      Object.keys(d.catMemory || {}).forEach(function (m) { if (d.catMemory[m] === id) d.catMemory[m] = to; });
      var lim = d.budget && d.budget.limits; if (lim && lim[id] != null) { lim[to] = (+lim[to] || 0) + (+lim[id] || 0); delete lim[id]; }
    });
  }
  function count(id, d) { d = d || (window.Vault && window.Vault.get()) || {}; return (d.expenses || []).filter(function (e) { return e && e.cat === id; }).length; }
  window.addEventListener('vault:in', refill);
  window.addEventListener('lang:change', refill);
  (function hook() { if (window.Vault && window.Vault.onUnlock) window.Vault.onUnlock(refill); else setTimeout(hook, 200); })();
  window.FinCats = { list: list, get: get, has: has, name: function (id) { return get(id).name; }, color: function (id) { return get(id).color; }, live: live, refill: refill, add: add, edit: edit, remove: remove, count: count, COLORS: COLORS, ICONS: ICONS, BASE_IDS: BASE.map(function (b) { return b[0]; }) };
})();
