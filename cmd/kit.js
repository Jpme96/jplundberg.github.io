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
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  /* delete with Undo: the item goes at once, its photos/files only after the Undo has had its chance */
  function removeItem(cfg, item) {
    var t = F.tools(), l = Array.isArray(t[cfg.key]) ? t[cfg.key] : [], at = l.findIndex(function (x) { return x.id === item.id; });
    if (at < 0) return;
    var gone = l[at]; t[cfg.key] = l.filter(function (x) { return x.id !== item.id; }); F.saveTools(t);
    var undone = false, tm = setTimeout(function () { if (!undone && cfg.onDelete) try { cfg.onDelete(gone); } catch (e) {} }, 6500);
    toast('<i class="bi bi-trash3"></i> ' + esc(gone.title || gone.name || gone.text || 'Deleted') + ' deleted', function () {
      undone = true; clearTimeout(tm); var t2 = F.tools(), l2 = Array.isArray(t2[cfg.key]) ? t2[cfg.key].slice() : [];
      if (!l2.some(function (x) { return x.id === gone.id; })) l2.splice(Math.min(at, l2.length), 0, gone); t2[cfg.key] = l2; F.saveTools(t2);
    });
  }
  function fmt(k, o) { return k ? F.fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

  /* ---------- one shared sheet ---------- */
  var sheet = null;
  function ensureSheet() {
    if (sheet) return sheet;
    var bg = document.createElement('div');
    bg.className = 'cl-sheet-bg kit-bg'; bg.hidden = true;
    bg.innerHTML = '<form class="cl-sheet kit-sheet" role="dialog" aria-modal="true" autocomplete="off">' +
      '<div class="cl-sheet-head"><button class="text-btn" type="button" data-close>Cancel</button><h2></h2><button class="pill-btn" type="submit">Save</button></div>' +
      '<div class="cl-edit kit-fields"></div><div class="cl-del kit-del" hidden><button class="text-btn kit-dup" type="button" data-kit-dup><i class="bi bi-copy"></i> Duplicate</button><button class="text-btn danger" type="button" data-kit-delbtn><i class="bi bi-trash3"></i> <span>Delete</span></button></div></form>';
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
  function editNew(cfg, pre) { edit(cfg, null, pre); }
  function edit(cfg, item, pre) {
    var s = ensureSheet(), isNew = !item, before = item ? JSON.parse(JSON.stringify(item)) : null;
    item = item ? JSON.parse(JSON.stringify(item)) : (pre ? JSON.parse(JSON.stringify(pre)) : {});
    s.title.textContent = isNew ? (cfg.addTitle || 'Add') : (cfg.editTitle || 'Edit');
    var rows = '', inline = '';
    cfg.fields.forEach(function (f) {
      var v = item[f.k] != null ? item[f.k] : (isNew && f.def != null ? (typeof f.def === 'function' ? f.def() : f.def) : '');
      if (f.type === 'title') { rows += '<input class="cl-in-title" id="kf-' + f.k + '" placeholder="' + esc(f.ph || f.label) + '"' + (f.req ? ' required' : '') + ' maxlength="' + (f.max || 120) + '" value="' + esc(v) + '">'; return; }
      var line = '<label class="st-row kit-row' + (f.type === 'textarea' ? ' kit-tall' : '') + '"><span>' + esc(f.label) + '</span>' + input(f, v) + (f.suffix ? '<em>' + esc(f.suffix) + '</em>' : '') + '</label>';
      if (f.type === 'textarea') rows += '<div class="cl-group cl-group-text kit-text"><span class="kit-lbl">' + esc(f.label) + '</span>' + input(f, v) + (f.help ? '<small class="kit-help">' + esc(f.help) + '</small>' : '') + '</div>';
      else rows += '<div class="cl-group">' + line + (f.help ? '<small class="kit-help">' + esc(f.help) + '</small>' : '') + '</div>';
    });
    /* Shared space: "Share with …" on the kinds that can be shared one by one (projects, papers) */
    var shl = window.ShareSpace && window.ShareSpace.kitRow ? window.ShareSpace.kitRow(cfg.key) : '';
    if (shl) rows += '<div class="cl-group"><label class="st-row kit-row"><span><i class="bi bi-people"></i> ' + esc(shl) + '</span><input type="checkbox" class="switch" id="kf-__share"' + (item.share ? ' checked' : '') + '></label><small class="kit-help">' + esc(window.ShareSpace.kitHelp(cfg.key)) + '</small></div>';
    s.fields.innerHTML = rows;
    s.del.hidden = isNew;
    var delArmed = false;
    s.del.querySelector('[data-kit-delbtn] span').textContent = 'Delete';
    s.del.querySelector('[data-kit-delbtn]').onclick = function () { close(); removeItem(cfg, item); };     /* Undo instead of tap-twice */
    var dup = s.del.querySelector('[data-kit-dup]'); dup.hidden = cfg.noDup === true;
    dup.onclick = function () {
      var c = JSON.parse(JSON.stringify(item)); delete c.id; ['done', 'doneAt', 'last', 'files', 'photos', 'photo', 'receipt', 'findings'].forEach(function (k) { delete c[k]; });
      if (cfg.duplicate) try { c = cfg.duplicate(c) || c; } catch (e) {}
      close(); setTimeout(function () { editNew(cfg, c); }, 240);
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
      var shc = document.getElementById('kf-__share'); if (shc) { if (shc.checked) item.share = true; else delete item.share; }
      if (!item.id) item.id = uid();
      if (cfg.beforeSave) cfg.beforeSave(item, isNew);
      var t = F.tools(), l = Array.isArray(t[cfg.key]) ? t[cfg.key] : [];
      var i = l.findIndex(function (x) { return x.id === item.id; });
      if (i > -1) l[i] = item; else l.push(item);
      t[cfg.key] = l;
      F.saveTools(t);
      if (cfg.afterSave) cfg.afterSave(item, isNew);
      close();
      var nm = esc(item.title || item.name || item.text || '');
      if (!isNew && before && JSON.stringify(before) !== JSON.stringify(item)) toast('<i class="bi bi-check2"></i> ' + (nm ? nm + ' saved' : 'Saved'), function () { var t2 = F.tools(), l2 = Array.isArray(t2[cfg.key]) ? t2[cfg.key] : [], j = l2.findIndex(function (x) { return x.id === before.id; }); if (j > -1) { l2[j] = before; t2[cfg.key] = l2; F.saveTools(t2); } });
      else if (isNew) toast('<i class="bi bi-check2"></i> ' + (nm ? nm + ' added' : 'Added'), function () { var t2 = F.tools(); t2[cfg.key] = (t2[cfg.key] || []).filter(function (x) { return x.id !== item.id; }); F.saveTools(t2); });
    };
    open();
    if (isNew && innerWidth >= 700) setTimeout(function () { var first = s.fields.querySelector('input,textarea'); if (first) first.focus(); }, 60);
  }

  /* one odd item (an old format, a missing number) must not break the card: each part is drawn on its
     own, a failing row shows as "Couldn't show this one" (still editable), and stray NaN/undefined become – */
  function tidyOut(h) { return typeof h === 'string' ? h.replace(/\bNaN\b|\bundefined\b|\[object Object\]|Invalid Date/g, '–') : h; }
  function safe(fn, args, fb, what) {
    try { return tidyOut(fn.apply(null, args)); }
    catch (e) { if (window.Diag) window.Diag.log('render', (e && e.message) || String(e), what); return fb; }
  }
  /* ---------- a collection card ---------- */
  function collection(cfg) {
    var el = cfg.mount, showAll = false, openId = null, scrolled = false, q = '';
    if (!el) return null;
    function render() {
      var on = F.on(cfg.feature);
      el.hidden = !on;
      if (!on) { el.innerHTML = ''; return; }
      var items = F.list(cfg.key).slice();
      if (cfg.filter) try { items = items.filter(cfg.filter); } catch (e) {}
      if (cfg.sort) try { items.sort(cfg.sort); } catch (e) {}
      var kw = 'kit:' + cfg.key;
      var lim = cfg.limit || 8, total = items.length, findable = total > Math.max(lim, 8) && cfg.search !== false;
      if (findable && q) { var ql = q.toLowerCase(); items = items.filter(function (it) { var r = {}; try { r = cfg.row(it) || {}; } catch (e) {} return (String(r.title || '') + ' ' + String(r.sub || '').replace(/<[^>]+>/g, ' ') + ' ' + String(it.notes || '')).toLowerCase().indexOf(ql) > -1; }); }
      var shown = showAll || q ? items : items.slice(0, lim);
      el.innerHTML = '<section class="card kit-card" id="' + cfg.key + '">' +
        '<div class="card-head"><h2><i class="bi bi-' + cfg.icon + '"></i> ' + esc(cfg.title) + '</h2>' +
        '<div class="head-actions">' + (cfg.headExtra ? safe(cfg.headExtra, [items], '', kw) : '') + '<button class="text-btn" type="button" data-kit-add><i class="bi bi-plus-lg"></i> ' + esc(cfg.addLabel || 'Add') + '</button></div></div>' +
        (cfg.summary ? '<div class="kit-sum">' + safe(cfg.summary, [items], '', kw) + '</div>' : '') +
        (cfg.above ? safe(cfg.above, [items], '', kw) : '') +
        (findable ? '<label class="kit-find"><i class="bi bi-search"></i><input type="search" data-kit-find placeholder="Find in ' + esc(String(cfg.title).toLowerCase()) + '" value="' + esc(q) + '" aria-label="Find in ' + esc(cfg.title) + '"></label>' : '') +
        (q && !items.length ? '<p class="empty kit-empty">Nothing matches “' + esc(q) + '”.</p>' : '') +
        (items.length ? '<ul class="kit-list">' + shown.map(function (it) {
          var r = (function () { try { return cfg.row(it) || {}; } catch (e) { if (window.Diag) window.Diag.log('render', e.message, kw); return { icon: 'exclamation-circle', title: it.title || it.name || 'Couldn’t show this one', sub: 'Tap to edit' }; } })();
          r = { icon: r.icon, color: r.color, cls: r.cls, title: tidyOut(r.title == null ? '' : String(r.title)), sub: tidyOut(r.sub), right: tidyOut(r.right) };
          return '<li class="kit-item' + (r.cls ? ' ' + r.cls : '') + (openId === it.id ? ' open' : '') + '" data-id="' + esc(it.id) + '">' +
            '<button type="button" class="kit-main" data-kit-' + (cfg.detail ? 'toggle' : 'edit') + '="' + esc(it.id) + '">' +
            (r.icon ? '<span class="kit-ic" style="--c:' + (r.color || 'var(--accent)') + '"><i class="bi bi-' + r.icon + '"></i></span>' : '') +
            '<span class="kit-x"><b>' + esc(r.title) + (it.share && window.ShareSpace && window.ShareSpace.kitRow && window.ShareSpace.kitRow(cfg.key) ? ' <i class="bi bi-people sh-ic" title="Shared"></i>' : '') + '</b>' + (r.sub ? '<small>' + r.sub + '</small>' : '') + '</span>' +
            (r.right ? '<span class="kit-r">' + r.right + '</span>' : '') + '</button>' +
            (cfg.detail && openId === it.id ? '<div class="kit-detail">' + safe(cfg.detail, [it], '', kw) + '<button type="button" class="text-btn" data-kit-edit="' + esc(it.id) + '"><i class="bi bi-pencil"></i> Edit</button></div>' : '') +
            '</li>';
        }).join('') + '</ul>' : (q ? '' : '<p class="empty kit-empty">' + esc(cfg.empty || 'Nothing here yet.') + '</p>')) +
        (items.length > lim && !q ? '<button class="text-btn kit-more" type="button" data-kit-more>' + (showAll ? 'Show less' : 'Show all ' + items.length) + '</button>' : '') +
        '</section>';
      if (cfg.afterRender) cfg.afterRender(el, items);
      if (refocus) { var fi = el.querySelector('[data-kit-find]'); if (fi) { fi.focus(); try { fi.setSelectionRange(fi.value.length, fi.value.length); } catch (e) {} } refocus = false; }
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
    var refocus = false;
    el.addEventListener('input', function (e) { if (e.target.matches('[data-kit-find]')) { q = e.target.value.trim(); refocus = true; render(); } });
    /* swipe a row left to delete it (with Undo) – like Mail on the iPhone */
    var sw = null;
    el.addEventListener('touchstart', function (e) {
      var m = e.target.closest('.kit-main'); if (!m || cfg.swipe === false || e.touches.length !== 1) { sw = null; return; }
      sw = { m: m, li: m.closest('.kit-item'), x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, on: false };
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (!sw) return; var dx = e.touches[0].clientX - sw.x, dy = e.touches[0].clientY - sw.y;
      if (!sw.on) { if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; } if (dx < -14 && Math.abs(dx) > Math.abs(dy) * 1.4) { sw.on = true; sw.li.classList.add('kit-swiping'); } else return; }
      sw.dx = Math.max(-160, Math.min(0, dx)); sw.m.style.transform = 'translateX(' + sw.dx + 'px)'; sw.li.classList.toggle('kit-swipe-go', sw.dx < -90);
    }, { passive: true });
    el.addEventListener('touchend', function () {
      if (!sw) return; var s0 = sw; sw = null; if (!s0.on) return;
      s0.li.classList.remove('kit-swiping', 'kit-swipe-go'); s0.m.style.transform = '';
      s0.m.dataset.kitSwiped = '1'; setTimeout(function () { delete s0.m.dataset.kitSwiped; }, 400);
      if (s0.dx < -90) { var it = F.list(cfg.key).filter(function (x) { return x.id === s0.li.dataset.id; })[0]; if (it) removeItem(cfg, it); }
    });
    el.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-kit-swiped]')) { e.preventDefault(); return; }
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
    return { render: render, edit: function (it) { edit(cfg, it); }, add: function (pre) { editNew(cfg, pre); }, remove: function (it) { removeItem(cfg, it); } };
  }

  window.Kit = { collection: collection, edit: edit, close: close, esc: esc, uid: uid, num: num, kr: kr, fmt: fmt, today: today };
})();
