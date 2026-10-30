/* Settings: search box at the top. Finds menu entries and the settings inside each page
   ("lock", "language", "bins" …) and takes you straight there. */
(function () {
  "use strict";
  var box = document.getElementById('stSearch'), out = document.getElementById('stResults'), menu = document.getElementById('stMenu');
  if (!box || !out || !menu) return;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fold(s) { return String(s || '').toLowerCase().replace(/[åä]/g, 'a').replace(/[øö]/g, 'o').replace(/æ/g, 'ae').replace(/\s+/g, ' ').trim(); }
  function visible(el) { return !el.closest('[hidden]') || el.closest('.st-page'); }
  function first(el) { var t = ''; el.childNodes.forEach(function (n) { if (!t && n.nodeType === 3 && n.nodeValue.trim()) t = n.nodeValue.trim(); }); return t || (el.querySelector('span, b') || el).textContent.trim().split('\n')[0]; }
  function index() {
    var items = [];
    menu.querySelectorAll('[data-go]').forEach(function (b) {
      if (b.hidden) return;
      var l = b.querySelector('.st-label'); var name = l ? first(l) : b.textContent.trim();
      var sm = l && l.querySelector('small');
      items.push({ go: b.dataset.go, page: name, label: name, sub: sm ? sm.textContent : '', icon: (b.querySelector('.st-ico') || {}).outerHTML || '' });
    });
    var names = {}; items.forEach(function (x) { names[x.go] = x; });
    document.querySelectorAll('#settings .st-page[data-page]').forEach(function (pg) {
      var k = pg.dataset.page; if (k === 'home' || !names[k]) return;
      pg.querySelectorAll('.st-row, .st-sub').forEach(function (r) {
        if (r.closest('[hidden]') && r.closest('[hidden]') !== pg) return;
        var span = r.matches('.st-sub') ? r : r.querySelector(':scope > span, .st-label') || r;
        var t = first(span); if (!t || t.length > 70) return;
        items.push({ go: k, page: names[k].label, label: t, el: r, icon: names[k].icon });
      });
    });
    return items;
  }
  var idx = null;
  function search() {
    var q = fold(box.value);
    menu.hidden = !!q; out.hidden = !q;
    if (!q) { out.innerHTML = ''; return; }
    idx = idx || index();
    var words = q.split(' '), seen = {};
    var hits = idx.filter(function (x) {
      var hay = fold(x.label + ' ' + x.page + ' ' + (x.sub || ''));
      if (!words.every(function (w) { return hay.indexOf(w) > -1; })) return false;
      var key = x.go + '|' + x.label; if (seen[key]) return false; seen[key] = 1; return true;
    }).sort(function (a, b) { return (fold(b.label).indexOf(q) === 0) - (fold(a.label).indexOf(q) === 0) || (!!a.el) - (!!b.el); }).slice(0, 14);
    out.innerHTML = hits.length ? '<nav class="st-group st-menu">' + hits.map(function (x, i) {
      return '<button type="button" class="st-row st-btn" data-sri="' + i + '">' + x.icon + '<span class="st-label">' + esc(x.label) + '<small>' + esc(x.el ? x.page : (x.sub || 'Settings')) + '</small></span><i class="bi bi-chevron-right"></i></button>';
    }).join('') + '</nav>' : '<p class="st-note st-pad">Nothing found for “' + esc(box.value.trim()) + '”.</p>';
    out._hits = hits;
  }
  box.addEventListener('input', search);
  box.addEventListener('focus', function () { idx = null; });
  box.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var b = out.querySelector('[data-sri]'); if (b) b.click(); } if (e.key === 'Escape' && box.value) { e.stopPropagation(); box.value = ''; search(); } });
  out.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sri]'); if (!b) return;
    var x = out._hits[+b.dataset.sri], go = menu.querySelector('[data-go="' + x.go + '"]');
    box.value = ''; search(); box.blur();
    if (go) go.click();
    if (x.el) setTimeout(function () {
      x.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      x.el.classList.remove('st-flash'); void x.el.offsetWidth; x.el.classList.add('st-flash');
    }, 320);
  });
  /* a group whose rows are all switched off disappears with its heading */
  function groups() {
    menu.querySelectorAll('nav.st-group').forEach(function (n) {
      var any = Array.prototype.some.call(n.querySelectorAll('[data-go]'), function (b) { return !b.hidden; });
      n.hidden = !any; var h = n.previousElementSibling; if (h && h.classList.contains('st-minor')) h.hidden = !any;
    });
  }
  new MutationObserver(groups).observe(menu, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  groups();
  window.addEventListener('st:page', function (e) { if (e.detail === 'home' && box.value) { box.value = ''; search(); } });
})();
