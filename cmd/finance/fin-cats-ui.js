/* Your spending categories (2026-11-21, JP): a "Categories" button under the spending chart opens one sheet –
   rename any category, add your own with a colour and an icon, remove your own (its expenses move to a category you pick).
   The list itself lives in fin-cats.js (head), so the import, quick add, the charts and the caps all follow. */
(function () {
  'use strict';
  if (!window.FinCats || !window.Vault) return;
  var K = function (key, en, o) { return I18N.k(key, en, o); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var st = { del: '', color: FinCats.COLORS[0], icon: 'tag' };
  function btn() {
    var chart = document.getElementById('spChart'); if (!chart) return;
    var el = document.getElementById('fcxBtn');
    if (!el) { el = document.createElement('button'); el.type = 'button'; el.id = 'fcxBtn'; el.className = 'text-btn so-btn'; var so = document.getElementById('soBtn'); chart.parentNode.insertBefore(el, (so || chart).nextSibling); }
    el.innerHTML = '<i class="bi bi-tags"></i> ' + esc(K('ui.fcx-btn', 'Categories'));
  }
  function body() {
    var L = FinCats.list();
    return '<h2 class="im-h"><i class="bi bi-tags"></i> ' + esc(K('ui.fcx-title', 'Spending categories')) + '</h2><p class="muted im-p">' + esc(K('ui.fcx-sub', 'Rename any of them, or add your own. Your own can be removed – their expenses move to the category you pick.')) + '</p>' +
      '<ul class="fcx-list">' + L.map(function (c) {
        var n = FinCats.count(c.id);
        var row = '<li class="fcx-row"><span class="fcx-dot" style="--c:' + c.color + '"><i class="bi bi-' + c.icon + '"></i></span><input class="fcx-name" data-fcxname="' + esc(c.id) + '" value="' + esc(c.name) + '" maxlength="40" aria-label="' + esc(K('ui.fcx-name', 'Name')) + '"><small class="muted tnum">' + esc(K('ui.fcx-n', '{n} expenses', { n: n })) + '</small>' +
          (c.own ? '<button type="button" class="icon-btn sm" data-fcxdel="' + esc(c.id) + '" aria-label="' + esc(K('ui.fcx-del', 'Remove')) + '"><i class="bi bi-trash3"></i></button>' : '') + '</li>';
        if (c.own) row += '<li class="fcx-own"><div class="fcx-sw">' + FinCats.COLORS.map(function (x) { return '<button type="button" class="fcx-c" style="--c:' + x + '" aria-pressed="' + (x === c.color) + '" data-fcxcol="' + esc(c.id) + '|' + x + '" aria-label="' + esc(K('ui.fcx-colour', 'Colour')) + '"></button>'; }).join('') + '</div>' +
          '<select data-fcxicon="' + esc(c.id) + '" aria-label="' + esc(K('ui.fcx-icon', 'Icon')) + '">' + FinCats.ICONS.map(function (x) { return '<option value="' + x + '"' + (x === c.icon ? ' selected' : '') + '>' + x.replace(/-/g, ' ') + '</option>'; }).join('') + '</select></li>';
        if (st.del === c.id) row += '<li class="fcx-delbox"><span>' + esc(K('ui.fcx-move', 'Move its {n} expenses to', { n: n })) + '</span><select data-fcxto>' + L.filter(function (x) { return x.id !== c.id; }).map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === 'other' ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' +
          '<button type="button" class="pill-btn" data-fcxdelok="' + esc(c.id) + '">' + esc(K('ui.fcx-del', 'Remove')) + '</button><button type="button" class="text-btn" data-fcxdelx>' + esc(K('ui.cancel', 'Cancel')) + '</button></li>';
        return row;
      }).join('') + '</ul>' +
      '<form class="fcx-add" data-fcxadd><h3 class="im-h3">' + esc(K('ui.fcx-new', 'New category')) + '</h3><div class="fcx-addr"><span class="fcx-dot" style="--c:' + st.color + '"><i class="bi bi-' + st.icon + '"></i></span><input name="n" maxlength="40" placeholder="' + esc(K('ui.fcx-new-ph', 'e.g. Car, Subscriptions, Gifts')) + '" required>' +
      '<select name="i" data-fcxnewicon aria-label="' + esc(K('ui.fcx-icon', 'Icon')) + '">' + FinCats.ICONS.map(function (x) { return '<option value="' + x + '"' + (x === st.icon ? ' selected' : '') + '>' + x.replace(/-/g, ' ') + '</option>'; }).join('') + '</select></div>' +
      '<div class="fcx-sw">' + FinCats.COLORS.map(function (x) { return '<button type="button" class="fcx-c" style="--c:' + x + '" aria-pressed="' + (x === st.color) + '" data-fcxnewcol="' + x + '" aria-label="' + esc(K('ui.fcx-colour', 'Colour')) + '"></button>'; }).join('') + '</div>' +
      '<button type="submit" class="pill-btn"><i class="bi bi-plus-lg"></i> ' + esc(K('ui.add', 'Add')) + '</button></form>' +
      '<div class="qa-acts"><span class="spacer"></span><button type="button" class="pill-btn wide" data-close>' + esc(K('ui.done', 'Done')) + '</button></div>';
  }
  function open() { if (!window.BankImport || !BankImport.open) return; st.del = ''; BankImport.open(body()); }
  function redraw() { var box = document.querySelector('.im-box'); if (!box || !box.querySelector('.fcx-list')) return; var y = box.scrollTop; box.innerHTML = body(); box.scrollTop = y; }
  function toast(h) { if (window.Quick && Quick.toast) Quick.toast(h); }
  document.addEventListener('click', function (e) {
    var t = e.target, b;
    if (t.closest('#fcxBtn')) { open(); return; }
    if (!t.closest('.im-box') || !document.querySelector('.fcx-list')) return;
    if ((b = t.closest('[data-fcxcol]'))) { var p = b.dataset.fcxcol.split('|'); FinCats.edit(p[0], { color: p[1] }); redraw(); return; }
    if ((b = t.closest('[data-fcxnewcol]'))) { st.color = b.dataset.fcxnewcol; redraw(); return; }
    if ((b = t.closest('[data-fcxdel]'))) { st.del = b.dataset.fcxdel; redraw(); return; }
    if (t.closest('[data-fcxdelx]')) { st.del = ''; redraw(); return; }
    if ((b = t.closest('[data-fcxdelok]'))) { var to = (document.querySelector('[data-fcxto]') || {}).value || 'other', nm = FinCats.name(b.dataset.fcxdelok); FinCats.remove(b.dataset.fcxdelok, to); st.del = ''; redraw(); toast('<i class="bi bi-trash3"></i> ' + esc(K('ui.fcx-removed', '{c} removed – its expenses are in {t}', { c: nm, t: FinCats.name(to) }))); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('[data-fcxname]')) { FinCats.edit(t.dataset.fcxname, { name: t.value }); redraw(); return; }
    if (t.matches && t.matches('[data-fcxicon]')) { FinCats.edit(t.dataset.fcxicon, { icon: t.value }); redraw(); return; }
    if (t.matches && t.matches('[data-fcxnewicon]')) { st.icon = t.value; var n = document.querySelector('form[data-fcxadd] [name="n"]'), v = n ? n.value : ''; redraw(); var n2 = document.querySelector('form[data-fcxadd] [name="n"]'); if (n2) n2.value = v; }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('form[data-fcxadd]'); if (!f) return; e.preventDefault();
    var id = FinCats.add(f.n.value, st.color, st.icon);
    if (id) { st.icon = 'tag'; st.color = FinCats.COLORS[FinCats.list().filter(function (c) { return c.own; }).length % FinCats.COLORS.length]; redraw(); toast('<i class="bi bi-tags"></i> ' + esc(K('ui.fcx-added', '{c} added – pick it on any expense', { c: FinCats.name(id) }))); }
  });
  window.addEventListener('fin:change', function () { setTimeout(btn, 60); });
  window.Vault.onUnlock(function () { setTimeout(btn, 320); });
  btn();
  window.FinCatsUI = { open: open };
})();
