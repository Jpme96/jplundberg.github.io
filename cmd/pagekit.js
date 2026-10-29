/* Customize a page: change the order of its sections and cards, and hide the ones you don't use.
   Opened from Settings → Dashboard → Pages (…/finance/?customize), shown at the top of the page.

   Sections (data-pk on the page) move up and down the page; cards move inside their group
   (Apple Health, Training, Check-ups … or Pace, Change by category …). Saved per page in
   dash.settings.pages, so it follows you to every device. Cards a Feature has switched off
   stay off – this only orders and hides what is on. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var main = document.querySelector('main.fp'); if (!main) return;
  var page = (location.pathname.match(/\/cmd\/([a-z]+)\//) || [])[1]; if (!page) return;
  var editing = false;
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* the groups that can be ordered: the page itself, and each grid of cards */
  function zones() {
    var z = [];
    if (main.querySelector(':scope > [data-pk]')) z.push({ key: 'main', name: 'Sections', el: main });
    main.querySelectorAll('.kit-grid, .fp-grid').forEach(function (g, i) {
      z.push({ key: g.dataset.pk ? 'cards:' + g.dataset.pk : g.classList.contains('fp-grid') ? 'stats' : 'cards' + (i ? i : ''), name: g.dataset.pkName || (g.classList.contains('fp-grid') ? 'Statistics' : 'Cards'), el: g });
    });
    return z;
  }
  function keyOf(el) {
    if (el.dataset.pk) return el.dataset.pk;
    if (el.dataset.tool) return 'tool:' + el.dataset.tool;
    if (el.id) return el.id;
    var h = el.querySelector('h2'); return h ? 'h:' + h.textContent.trim().replace(/\s+/g, ' ') : null;
  }
  function nameOf(el) {
    if (el.dataset.pkName) return el.dataset.pkName;
    var h = el.querySelector('h2'); if (h) return h.textContent.trim().replace(/\s+/g, ' ');
    return el.dataset.tool || el.id || 'Card';
  }
  /* what can move in a zone: sections marked data-pk, or the cards in a grid (not those a Feature turned off) */
  function items(z) {
    return Array.prototype.filter.call(z.el.children, function (c) {
      if (z.key === 'main') return !!c.dataset.pk;
      if (c.classList.contains('pk-bar')) return false;
      return keyOf(c) && (!c.hidden || c.classList.contains('pk-off'));
    });
  }
  function conf() { return (((readJSON('dash.settings', {}) || {}).pages || {})[page]) || {}; }
  function save(fn) {
    var st = readJSON('dash.settings', {}) || {}; st.pages = st.pages || {};
    var c = st.pages[page] || {}; fn(c);
    Object.keys(c).forEach(function (k) { var v = c[k]; if (v && !(v.order && v.order.length) && !(v.off && v.off.length)) delete c[k]; });
    if (Object.keys(c).length) st.pages[page] = c; else delete st.pages[page];
    writeJSON('dash.settings', st);
  }

  /* put each zone in the saved order; only touches the page when something has to move */
  function apply() {
    var C = conf();
    zones().forEach(function (z) {
      var c = C[z.key] || {}, order = c.order || [], off = c.off || [], list = items(z);
      list.forEach(function (el) { var o = off.indexOf(keyOf(el)) >= 0; el.classList.toggle('pk-off', o); });
      if (!order.length) return;
      var sorted = list.slice().sort(function (a, b) {
        var ia = order.indexOf(keyOf(a)), ib = order.indexOf(keyOf(b));
        return (ia < 0 ? 99 + list.indexOf(a) : ia) - (ib < 0 ? 99 + list.indexOf(b) : ib);
      });
      if (sorted.every(function (el, i) { return el === list[i]; })) return;
      var marks = list.map(function (el) { var m = document.createComment('pk'); z.el.insertBefore(m, el); return m; });
      sorted.forEach(function (el, i) { z.el.insertBefore(el, marks[i]); });
      marks.forEach(function (m) { m.remove(); });
    });
  }

  /* the button at the bottom of the page and the editor it opens */
  var bar = document.createElement('div'); bar.className = 'pk-bar';
  var hero = main.querySelector(':scope > .fp-hero, :scope > .tv-hero'); main.insertBefore(bar, hero ? hero.nextSibling : main.firstChild);
  editing = /[?&]customize/.test(location.search);
  function draw() {
    bar.hidden = !editing;
    if (!editing) { bar.innerHTML = ''; return; }
    var C = conf();
    bar.innerHTML = '<section class="card pk-editor" aria-label="Customize this page"><div class="card-head"><h2><i class="bi bi-layout-text-window-reverse"></i> Customize this page</h2></div>' +
      '<p class="muted pk-intro">Move sections and cards up or down, and switch off what you don’t use. Number tiles have their own Customize button. Open this again from Settings → Dashboard → Pages.</p>' +
      zones().map(function (z) {
        var list = items(z); if (list.length < 2 && z.key !== 'main') return '';
        var off = (C[z.key] || {}).off || [];
        return '<p class="st-sub">' + esc(z.name) + '</p>' + list.map(function (el, i) {
          var k = keyOf(el), on = off.indexOf(k) < 0;
          return '<div class="pk-row' + (on ? '' : ' is-off') + '"><span class="pk-name">' + esc(nameOf(el)) + '</span>' +
            '<span class="pk-mv"><button type="button" class="icon-btn" data-pkmove="' + esc(k) + '" data-z="' + esc(z.key) + '" data-d="-1" aria-label="Move ' + esc(nameOf(el)) + ' up"' + (i ? '' : ' disabled') + '><i class="bi bi-arrow-up"></i></button>' +
            '<button type="button" class="icon-btn" data-pkmove="' + esc(k) + '" data-z="' + esc(z.key) + '" data-d="1" aria-label="Move ' + esc(nameOf(el)) + ' down"' + (i < list.length - 1 ? '' : ' disabled') + '><i class="bi bi-arrow-down"></i></button></span>' +
            '<input type="checkbox" class="switch" data-pkshow="' + esc(k) + '" data-z="' + esc(z.key) + '"' + (on ? ' checked' : '') + ' aria-label="Show ' + esc(nameOf(el)) + '"></div>';
        }).join('');
      }).join('') +
      (zones().some(function (z) { return items(z).length > 1; }) ? '' : '<p class="muted pk-intro">Nothing to arrange on this page yet – switch on more cards under Settings → Features.</p>') +
      '<div class="pk-foot"><button type="button" class="text-btn" data-pkreset>Reset</button><button type="button" class="pill-btn" data-pkedit>Done</button></div></section>';
  }
  function zoneBy(key) { return zones().filter(function (z) { return z.key === key; })[0]; }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-pkedit]')) {
      editing = false; draw();
      history.replaceState(null, '', location.pathname + location.hash);
      return;
    }
    var mv = e.target.closest('[data-pkmove]');
    if (mv) {
      var z = zoneBy(mv.dataset.z); if (!z) return;
      var ord = items(z).map(keyOf), ix = ord.indexOf(mv.dataset.pkmove), to = ix + (+mv.dataset.d);
      if (to < 0 || to >= ord.length) return;
      ord.splice(to, 0, ord.splice(ix, 1)[0]);
      save(function (c) { c[z.key] = c[z.key] || {}; c[z.key].order = ord; });
      apply(); draw();
      var nb = bar.querySelector('[data-pkmove="' + mv.dataset.pkmove + '"][data-z="' + mv.dataset.z + '"][data-d="' + mv.dataset.d + '"]'); if (nb && !nb.disabled) nb.focus();
      return;
    }
    if (e.target.closest('[data-pkreset]')) { save(function (c) { Object.keys(c).forEach(function (k) { delete c[k]; }); }); location.reload(); }
  });
  document.addEventListener('change', function (e) {
    var sw = e.target.closest('[data-pkshow]'); if (!sw) return;
    save(function (c) {
      var z = c[sw.dataset.z] = c[sw.dataset.z] || {}, off = z.off = z.off || [], i = off.indexOf(sw.dataset.pkshow);
      if (sw.checked && i >= 0) off.splice(i, 1); else if (!sw.checked && i < 0) off.push(sw.dataset.pkshow);
    });
    apply(); var row = sw.closest('.pk-row'); if (row) row.classList.toggle('is-off', !sw.checked);
  });

  /* cards appear after unlocking (and Apple Health is added later): order them when they do */
  var queued = false;
  new MutationObserver(function () { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; apply(); }); } })
    .observe(main, { childList: true, subtree: false });
  main.querySelectorAll('.kit-grid, .fp-grid').forEach(function (g) {
    new MutationObserver(function () { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; apply(); }); } }).observe(g, { childList: true, attributes: true, attributeFilter: ['hidden'], subtree: false });
  });
  window.Vault.onUnlock(function () { setTimeout(function () { apply(); draw(); }, 60); });
  draw();
  window.PageKit = { apply: apply };
})();
