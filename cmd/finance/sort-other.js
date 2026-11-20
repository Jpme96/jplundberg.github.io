/* Sort "Other" (2026-11-20, JP: a third of November was "Other"): under By category, when "Other" is a big part of
   this month, a button opens one list of the shops in it – pick a category once per shop. Every expense from that
   shop that is still "Other" (any month) moves, and the choice is remembered for the next import (d.catMemory,
   the same memory the bank import uses). */
(function () {
  'use strict';
  if (!window.Vault) return;
  var K = function (n, e, o) { return window.I18N && I18N.k ? I18N.k(n, e, o) : e.replace(/\{(\w+)\}/g, function (m, k) { return o && o[k] != null ? o[k] : m; }); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function norm(s) { return window.BankImport && BankImport.norm ? BankImport.norm(s) : String(s || '').toLowerCase().trim(); }
  function ym() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function groups() {
    var d = window.Vault.get() || {}, m = ym(), all = 0, by = {};
    (d.expenses || []).forEach(function (e) {
      if (!e || String(e.date).slice(0, 7) !== m || !(+e.amount > 0)) return;
      all += +e.amount; if ((e.cat || 'other') !== 'other') return;
      var k = norm(e.note); if (!k) return;
      var g = by[k] || (by[k] = { k: k, note: e.note, n: 0, sum: 0 }); g.n++; g.sum += +e.amount;
    });
    var l = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.sum - a.sum; });
    var other = l.reduce(function (a, g) { return a + g.sum; }, 0);
    return { list: l, other: other, share: all ? other / all : 0 };
  }
  function btn() {
    var chart = document.getElementById('spChart'); if (!chart) return;
    var g = groups(), el = document.getElementById('soBtn');
    if (g.list.length < 2 || g.share < 0.1) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('button'); el.type = 'button'; el.id = 'soBtn'; el.className = 'text-btn so-btn'; chart.parentNode.insertBefore(el, chart.nextSibling); }
    el.innerHTML = '<i class="bi bi-tags"></i> ' + esc(K('ui.so-btn', 'Sort “Other” – {n} shops, {s}', { n: g.list.length, s: nf.format(Math.round(g.other)) }));
  }
  function sheet() {
    var g = groups(), cats = (window.BankImport && BankImport.cats) || [['other', 'Other']];
    if (!window.BankImport || !BankImport.open) return;
    BankImport.open('<h2 class="im-h"><i class="bi bi-tags"></i> ' + esc(K('ui.so-title', 'Sort “Other”')) + '</h2><p class="muted im-p">' + esc(K('ui.so-sub', 'Pick a category once per shop. Everything from that shop still in “Other” moves, and the next imports remember it.')) + '</p>' +
      '<ul class="so-list">' + g.list.slice(0, 50).map(function (x, i) {
        return '<li><span><b>' + esc(x.note) + '</b><small class="muted">' + esc(K('ui.so-n', '{n} × · {s}', { n: x.n, s: nf.format(Math.round(x.sum)) })) + '</small></span><select data-so="' + i + '">' +
          cats.map(function (c) { return '<option value="' + esc(c[0]) + '"' + (c[0] === 'other' ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select></li>';
      }).join('') + '</ul>' +
      '<div class="qa-acts"><button type="button" class="text-btn" data-close>' + esc(K('ui.cancel', 'Cancel')) + '</button><span class="spacer"></span><button type="button" class="pill-btn wide" data-sosave><i class="bi bi-check-lg"></i> ' + esc(K('ui.save', 'Save')) + '</button></div>');
    sheet.list = g.list;
  }
  function save() {
    var pick = {}; document.querySelectorAll('[data-so]').forEach(function (s) { var x = (sheet.list || [])[+s.getAttribute('data-so')]; if (x && s.value && s.value !== 'other') pick[x.k] = s.value; });
    var keys = Object.keys(pick); if (!keys.length) { BankImport.close(); return; }
    var d = window.Vault.get(), n = 0; d.catMemory = d.catMemory || {};
    (d.expenses || []).forEach(function (e) { var k = norm(e.note); if (pick[k] && (e.cat || 'other') === 'other') { e.cat = pick[k]; n++; } });
    keys.forEach(function (k) { d.catMemory[k] = pick[k]; });
    window.Vault.save(d); window.dispatchEvent(new Event('fin:change'));
    BankImport.close();
    if (window.Quick && Quick.toast) Quick.toast('<i class="bi bi-tags"></i> ' + esc(K('ui.so-done', '{n} expenses moved out of “Other”', { n: n })));
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('#soBtn')) { sheet(); return; }
    if (e.target.closest('[data-sosave]')) save();
  });
  window.addEventListener('fin:change', function () { setTimeout(btn, 50); });
  window.Vault.onUnlock(function () { setTimeout(btn, 300); });
  btn();
  window.SortOther = { groups: groups, open: sheet };
})();
