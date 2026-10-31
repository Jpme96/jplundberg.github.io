/* Kit: one building block for the smaller tools – a card with a summary, a list and an
   add/edit sheet generated from a list of fields. Data lives in Features.tools()[key]. */
(function () {
  "use strict";
  var F = window.Features;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function today() { return F.dkey(new Date()); }
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function fmt(k, o) { return k ? F.fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

  /* ---------- one shared sheet ---------- */
  var sheet = null;
  function ensureSheet() {
    if (sheet) return sheet;
    var bg = document.createElement('div');
    bg.className = 'cl-sheet-bg kit-bg'; bg.hidden = true;
    bg.innerHTML = '<form class="cl-sheet kit-sheet" role="dialog" aria-modal="true" autocomplete="off">' +
      '<div class="cl-sheet-head"><button class="text-btn" type="button" data-close>Cancel</button><h2></h2><button class="pill-btn" type="submit">Save</button></div>' +
      '<div class="cl-edit kit-fields"></div><div class="cl-del kit-del" hidden><button class="text-btn danger" type="button"><i class="bi bi-trash3"></i> <span>Delete</span></button></div></form>';
    document.body.appendChild(bg);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bg.hidden) close(); });
    sheet = { bg: bg, form: bg.querySelector('form'), fields: bg.querySelector('.kit-fields'), title: bg.querySelector('h2'), del: bg.querySelector('.kit-del') };
    return sheet;
  }
  function open() {
    var s = ensureSheet();
    s.bg.hidden = false;
    requestAnimationFrame(function () { s.bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
  }
  function close() {
    if (!sheet) return;
    sheet.bg.classList.remove('open');
    document.documentElement.classList.remove('cl-modal');
    setTimeout(function () { sheet.bg.hidden = true; }, 220);
  }

  function input(f, v) {
    var id = 'kf-' + f.k, req = f.req ? ' required' : '', ph = f.ph ? ' placeholder="' + esc(f.ph) + '"' : '';
    var val = v == null ? '' : v;
    if (f.type === 'textarea') return '<textarea id="' + id + '" rows="' + (f.rows || 3) + '"' + ph + req + ' maxlength="' + (f.max || 2000) + '">' + esc(val) + '</textarea>';
    if (f.type === 'select') return '<select id="' + id + '" class="st-wide">' + (typeof f.options === 'function' ? f.options() : f.options).map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select>';
    if (f.type === 'check') return '<input type="checkbox" class="switch" id="' + id + '"' + (val ? ' checked' : '') + '>';
    var t = f.type === 'number' ? 'text" inputmode="decimal' : (f.type || 'text');
    return '<input id="' + id + '" type="' + t + '"' + ph + req + ' maxlength="' + (f.max || 200) + '" value="' + esc(val) + '">';
  }
  function edit(cfg, item) {
    var s = ensureSheet(), isNew = !item;
    item = item ? JSON.parse(JSON.stringify(item)) : {};
    s.title.textContent = isNew ? (cfg.addTitle || 'Add') : (cfg.editTitle || 'Edit');
    var rows = '', inline = '';
    cfg.fields.forEach(function (f) {
      var v = item[f.k] != null ? item[f.k] : (isNew && f.def != null ? (typeof f.def === 'function' ? f.def() : f.def) : '');
      if (f.type === 'title') { rows += '<input class="cl-in-title" id="kf-' + f.k + '" placeholder="' + esc(f.ph || f.label) + '"' + (f.req ? ' required' : '') + ' maxlength="' + (f.max || 120) + '" value="' + esc(v) + '">'; return; }
      var line = '<label class="st-row kit-row' + (f.type === 'textarea' ? ' kit-tall' : '') + '"><span>' + esc(f.label) + '</span>' + input(f, v) + (f.suffix ? '<em>' + esc(f.suffix) + '</em>' : '') + '</label>';
      if (f.type === 'textarea') rows += '<div class="cl-group cl-group-text kit-text"><span class="kit-lbl">' + esc(f.label) + '</span>' + input(f, v) + (f.help ? '<small class="kit-help">' + esc(f.help) + '</small>' : '') + '</div>';
      else rows += '<div class="cl-group">' + line + (f.help ? '<small class="kit-help">' + esc(f.help) + '</small>' : '') + '</div>';
    });
    s.fields.innerHTML = rows;
    s.del.hidden = isNew;
    var delArmed = false;
    s.del.querySelector('span').textContent = 'Delete';
    s.del.querySelector('button').onclick = function () {
      if (!delArmed) { delArmed = true; s.del.querySelector('span').textContent = 'Tap again to delete'; return; }
      var t = F.tools(); t[cfg.key] = (t[cfg.key] || []).filter(function (x) { return x.id !== item.id; });
      if (cfg.onDelete) cfg.onDelete(item);
      F.saveTools(t); close();
    };
    s.form.onsubmit = function (e) {
      e.preventDefault();
      var bad = null;
      cfg.fields.forEach(function (f) {
        var el = document.getElementById('kf-' + f.k);
        if (!el) return;
        var v = f.type === 'check' ? el.checked : el.value.trim();
        if (f.type === 'number') v = v === '' ? '' : (num(v) == null ? (bad = bad || el, '') : num(v));
        if (f.req && (v === '' || v == null)) bad = bad || el;
        item[f.k] = v;
      });
      if (bad) { bad.focus(); bad.classList.add('kit-bad'); return; }
      if (!item.id) item.id = uid();
      if (cfg.beforeSave) cfg.beforeSave(item, isNew);
      var t = F.tools(), l = Array.isArray(t[cfg.key]) ? t[cfg.key] : [];
      var i = l.findIndex(function (x) { return x.id === item.id; });
      if (i > -1) l[i] = item; else l.push(item);
      t[cfg.key] = l;
      F.saveTools(t);
      if (cfg.afterSave) cfg.afterSave(item, isNew);
      close();
    };
    open();
    if (isNew && innerWidth >= 700) setTimeout(function () { var first = s.fields.querySelector('input,textarea'); if (first) first.focus(); }, 60);
  }

  /* ---------- a collection card ---------- */
  function collection(cfg) {
    var el = cfg.mount, showAll = false, openId = null, scrolled = false;
    if (!el) return null;
    function render() {
      var on = F.on(cfg.feature);
      el.hidden = !on;
      if (!on) { el.innerHTML = ''; return; }
      var items = F.list(cfg.key).slice();
      if (cfg.sort) items.sort(cfg.sort);
      var lim = cfg.limit || 8, shown = showAll ? items : items.slice(0, lim);
      el.innerHTML = '<section class="card kit-card" id="' + cfg.key + '">' +
        '<div class="card-head"><h2><i class="bi bi-' + cfg.icon + '"></i> ' + esc(cfg.title) + '</h2>' +
        '<div class="head-actions">' + (cfg.headExtra ? cfg.headExtra(items) : '') + '<button class="text-btn" type="button" data-kit-add><i class="bi bi-plus-lg"></i> ' + esc(cfg.addLabel || 'Add') + '</button></div></div>' +
        (cfg.summary ? '<div class="kit-sum">' + cfg.summary(items) + '</div>' : '') +
        (cfg.above ? cfg.above(items) : '') +
        (items.length ? '<ul class="kit-list">' + shown.map(function (it) {
          var r = cfg.row(it);
          return '<li class="kit-item' + (r.cls ? ' ' + r.cls : '') + (openId === it.id ? ' open' : '') + '" data-id="' + esc(it.id) + '">' +
            '<button type="button" class="kit-main" data-kit-' + (cfg.detail ? 'toggle' : 'edit') + '="' + esc(it.id) + '">' +
            (r.icon ? '<span class="kit-ic" style="--c:' + (r.color || 'var(--accent)') + '"><i class="bi bi-' + r.icon + '"></i></span>' : '') +
            '<span class="kit-x"><b>' + esc(r.title) + '</b>' + (r.sub ? '<small>' + r.sub + '</small>' : '') + '</span>' +
            (r.right ? '<span class="kit-r">' + r.right + '</span>' : '') + '</button>' +
            (cfg.detail && openId === it.id ? '<div class="kit-detail">' + cfg.detail(it) + '<button type="button" class="text-btn" data-kit-edit="' + esc(it.id) + '"><i class="bi bi-pencil"></i> Edit</button></div>' : '') +
            '</li>';
        }).join('') + '</ul>' : '<p class="empty kit-empty">' + esc(cfg.empty || 'Nothing here yet.') + '</p>') +
        (items.length > lim ? '<button class="text-btn kit-more" type="button" data-kit-more>' + (showAll ? 'Show less' : 'Show all ' + items.length) + '</button>' : '') +
        '</section>';
      if (cfg.afterRender) cfg.afterRender(el, items);
      /* arriving from search (…/#people=<id>): open that one, show all, scroll to it */
      var hm = location.hash.match(new RegExp('^#' + cfg.key + '=([\\w-]+)$'));
      if (hm && document.documentElement.classList.contains('unlocked') && items.some(function (x) { return x.id === hm[1]; })) {
        openId = hm[1]; showAll = true; scrolled = true;
        history.replaceState(null, '', location.pathname + location.search);
        render();
        var li = el.querySelector('.kit-item[data-id="' + hm[1] + '"]');
        if (li) setTimeout(function () { li.scrollIntoView({ behavior: 'smooth', block: 'center' }); li.classList.add('sr-flash'); setTimeout(function () { li.classList.remove('sr-flash'); }, 1600); }, 350);
        return;
      }
      /* arriving from a calendar reminder (…/#subs): scroll to the card once */
      if (!scrolled && location.hash === '#' + cfg.key && document.documentElement.classList.contains('unlocked')) {
        scrolled = true;
        /* wait until the rest of the page has drawn (charts, lists), then scroll */
        setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 450);
      }
    }
    el.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-kit-add]')) return edit(cfg, null);
      if ((b = e.target.closest('[data-kit-edit]'))) return edit(cfg, F.list(cfg.key).filter(function (x) { return x.id === b.dataset.kitEdit; })[0]);
      if ((b = e.target.closest('[data-kit-toggle]'))) { openId = openId === b.dataset.kitToggle ? null : b.dataset.kitToggle; return render(); }
      if (e.target.closest('[data-kit-more]')) { showAll = !showAll; return render(); }
      if (cfg.onClick) cfg.onClick(e, render);
    });
    window.addEventListener('tools:change', render);
    window.addEventListener('features:change', render);
    window.addEventListener('hashchange', function () { if (location.hash.indexOf('#' + cfg.key + '=') === 0) render(); });
    var prevReload = window.Dash && window.Dash.reload;
    window.Dash = window.Dash || {};
    window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
    if (window.Vault) window.Vault.onUnlock(render);
    return { render: render, edit: function (it) { edit(cfg, it); } };
  }

  window.Kit = { collection: collection, edit: edit, close: close, esc: esc, uid: uid, num: num, kr: kr, fmt: fmt, today: today };
})();
