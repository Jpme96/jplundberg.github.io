/* House files (Nov 2026): one store for the photos and documents of the take-over guide, home projects,
   the FDV binder and reklamasjon claims. Kept on the device (IndexedDB "dash-hfiles") and synced,
   encrypted, to your other devices through filesync.js – the Worker only ever sees bytes it can't read.
   Ids say where a file belongs: tk- take-over, rk- claims, pj- projects, fdv- the FDV binder.
   A file is only deleted when nothing uses it any more (a fault's photo can also be on a claim), and
   only after a few seconds, so Undo still has it.
   window.HouseFiles = { put, get, url, fill, view, release, uses, strip, sheet, head, isPdf, size, uid } */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function size(b) { b = +b || 0; return b > 1e6 ? (b / 1e6).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' kB'; }
  function isPdf(f) { return f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')); }
  function isImg(f) { return f && (/^image\//.test(f.type || '') || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(f.name || '')); }

  var idb = null;
  function db() { return idb || (idb = new Promise(function (res, rej) { var r = indexedDB.open('dash-hfiles', 1); r.onupgradeneeded = function () { r.result.createObjectStore('files'); }; r.onsuccess = function () { res(r.result); }; r.onerror = rej; })); }
  function keep(id, blob) { return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('files', 'readwrite'); t.objectStore('files').put(blob, id); t.oncomplete = res; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); }; }); }); }
  function local(id) { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('files').objectStore('files').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function get(id) { return local(id).then(function (b) { if (b || !window.FileSync) return b; return window.FileSync.down(id).then(function (nb) { if (nb) keep(id, nb); return nb; }).catch(function () { return null; }); }); }
  function drop(id) { if (window.FileSync) window.FileSync.del(id); return db().then(function (d) { d.transaction('files', 'readwrite').objectStore('files').delete(id); }).catch(function () {}); }

  /* photos stay readable but small; PDFs and other documents are kept as they are */
  function shrink(file, max) {
    max = max || 1800;
    return new Promise(function (res, rej) {
      var img = new Image(); img.onload = function () { var s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(function (b) { b ? res(b) : rej(); }, 'image/jpeg', .84); URL.revokeObjectURL(img.src); };
      img.onerror = rej; img.src = URL.createObjectURL(file);
    });
  }
  /* put one file: returns {id, name, type 'img'|'pdf'|'doc', size, at}. opts.max = image size, opts.any = keep other kinds too */
  var LIMIT = 20e6;
  function put(file, prefix, opts) {
    opts = opts || {};
    var pdf = isPdf(file), img = !pdf && isImg(file);
    if (!pdf && !img && !opts.any) return Promise.reject(new Error('kind'));
    if (!img && file.size > LIMIT) return Promise.reject(new Error('big'));
    var id = (prefix || 'hf') + '-' + uid();
    return (img ? shrink(file, opts.max).catch(function () { if (file.size > LIMIT) throw new Error('big'); return file; }) : Promise.resolve(file)).then(function (b) {
      if (!b.type && file.type) b = new Blob([b], { type: file.type });
      return keep(id, b).then(function () {
        if (window.FileSync && !opts.noUp) window.FileSync.up(id, b);
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
        return { id: id, name: String(file.name || (img ? 'Photo.jpg' : 'Document')).slice(0, 160), type: img ? 'img' : pdf ? 'pdf' : 'doc', size: b.size, at: Fe.dkey(new Date()) };
      });
    });
  }
  /* many files (an imported FDV pack): sent up two at a time instead of all at once; what fails goes up the next time House opens */
  function upQueue(ids) {
    if (!window.FileSync || !ids.length) return Promise.resolve();
    var q = ids.slice(), n = 0;
    function next() { var id = q.shift(); if (!id) return Promise.resolve(); return local(id).then(function (b) { return b ? window.FileSync.up(id, b) : null; }).catch(function () {}).then(function () { n++; return next(); }); }
    return Promise.all([next(), next()]);
  }
  /* several at once, one after the other; bad ones are listed, not fatal */
  function putAll(list, prefix, opts) {
    var out = [], bad = [];
    return Array.prototype.reduce.call(list, function (p, f) {
      return p.then(function () { return put(f, prefix, opts).then(function (m) { out.push(m); }, function (e) { bad.push((f.name || 'File') + (e && e.message === 'big' ? ' (over 20 MB)' : e && e.message === 'kind' ? ' (not a photo or PDF)' : ' (couldn’t read it)')); }); });
    }, Promise.resolve()).then(function () { return { files: out, bad: bad }; });
  }

  /* ---------- object URLs (one per file, reused) ---------- */
  var urls = {};
  function url(id) {
    if (urls[id]) return Promise.resolve(urls[id]);
    return get(id).then(function (b) { if (!b) return null; return (urls[id] = URL.createObjectURL(b)); });
  }
  /* fill every <img data-hfimg> and <a data-hfopen> inside el */
  function fill(el) {
    if (!el) return;
    el.querySelectorAll('img[data-hfimg]').forEach(function (im) { if (im._hf === im.dataset.hfimg) return; im._hf = im.dataset.hfimg; url(im.dataset.hfimg).then(function (u) { if (u) im.src = u; else im.classList.add('hf-gone'); }); });
    el.querySelectorAll('a[data-hfopen]').forEach(function (a) { if (a._hf === a.dataset.hfopen) return; a._hf = a.dataset.hfopen; url(a.dataset.hfopen).then(function (u) { if (u) { a.href = u; a.classList.remove('hf-wait'); } else { a.classList.add('hf-gone'); a.removeAttribute('href'); } }); });
  }
  /* a photo, big */
  function view(id, cap) {
    var X = sheet('Photo', 'hf-viewbox');
    X.box.innerHTML = head('image', cap || 'Photo') + '<div class="hf-view"><img data-hfimg="' + esc(id) + '" alt=""></div>';
    fill(X.box);
  }

  /* ---------- who uses a file: each part says which ids it keeps ---------- */
  var users = [];
  function uses(fn) { users.push(fn); }
  function used() { var s = {}; users.forEach(function (f) { try { (f() || []).forEach(function (id) { if (id) s[id] = 1; }); } catch (e) {} }); return s; }
  /* after an item lost a file: delete it in a little while, unless something still (or again, after Undo) uses it */
  function release(ids) {
    ids = [].concat(ids || []).filter(Boolean); if (!ids.length) return;
    setTimeout(function () { var u = used(); ids.forEach(function (id) { if (!u[id]) { drop(id); delete urls[id]; } }); }, 9000);
  }

  /* ---------- a row of photos with an Add button ---------- */
  function strip(ids, key, opts) {
    opts = opts || {};
    ids = (ids || []).filter(Boolean);
    return '<div class="hf-strip">' + ids.map(function (id) {
      return '<span class="hf-th"><button type="button" class="hf-thb" data-hfview="' + esc(id) + '" aria-label="Open the photo"><img data-hfimg="' + esc(id) + '" alt=""></button>' +
        (opts.del === false ? '' : '<button type="button" class="hf-x" data-hfdel="' + esc(key + '|' + id) + '" aria-label="Remove the photo"><i class="bi bi-x"></i></button>') + '</span>';
    }).join('') +
      '<label class="hf-add"><i class="bi bi-camera"></i><span>' + (ids.length ? 'More' : esc(opts.label || 'Add photos')) + '</span><input type="file" accept="image/*" multiple data-hfadd="' + esc(key) + '" hidden></label></div>';
  }
  var adders = {}, removers = {};
  /* key looks like "claim:<id>" – the part before the colon picks the handler */
  function onAdd(kind, fn) { adders[kind] = fn; }
  function onRemove(kind, fn) { removers[kind] = fn; }
  document.addEventListener('change', function (e) {
    var i = e.target.closest('input[data-hfadd]'); if (!i || !i.files || !i.files.length) return;
    var key = i.dataset.hfadd, kind = key.split(':')[0], fn = adders[kind], files = Array.prototype.slice.call(i.files); i.value = '';
    if (!fn) return;
    toast('<i class="bi bi-hourglass-split"></i> Saving ' + (files.length === 1 ? 'the photo' : files.length + ' photos') + ' …');
    putAll(files, ({ take: 'tk', claim: 'rk', proj: 'pj' })[kind] || 'hf').then(function (r) {
      if (r.files.length) fn(key.slice(kind.length + 1), r.files.map(function (m) { return m.id; }), r.files);
      if (r.bad.length) toast('<i class="bi bi-exclamation-triangle"></i> Not added: ' + esc(r.bad.join(', ')));
      else if (r.files.length) toast('<i class="bi bi-check2"></i> ' + (r.files.length === 1 ? 'Photo saved' : r.files.length + ' photos saved') + (window.FileSync && window.FileSync.state().ok !== false ? ' – syncing to your other devices' : ''));
    });
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hfview]'); if (b) { e.preventDefault(); view(b.dataset.hfview); return; }
    var x = e.target.closest('[data-hfdel]'); if (!x) return;
    e.preventDefault(); e.stopPropagation();
    var q = x.dataset.hfdel.split('|'), key = q[0], kind = key.split(':')[0], fn = removers[kind]; if (!fn) return;
    fn(key.slice(kind.length + 1), q[1]);
  });

  /* ---------- a sheet (the same look as the other House sheets) ---------- */
  function sheet(label, cls) {
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<div class="fo-box lf-box mp-box hs2-box hx-box' + (cls ? ' ' + cls : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(label) + '"></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    function close() { bg.classList.remove('open'); document.removeEventListener('keydown', key, true); if (!document.querySelector('.fo-bg.open')) document.documentElement.classList.remove('cl-modal'); setTimeout(function () { bg.remove(); }, 180); }
    document.addEventListener('keydown', key, true);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-x]')) close(); });
    return { box: bg.firstChild, close: close, bg: bg };
  }
  function head(icon, t, sub) { return '<div class="lf-head"><h3><i class="bi bi-' + icon + '"></i> ' + esc(t) + '</h3><button type="button" class="icon-btn sm" data-x aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' + (sub ? '<p class="muted lf-sub">' + esc(sub) + '</p>' : ''); }

  /* ---------- on the House page: send up what only this device has ---------- */
  if (/\/cmd\/house\/$/.test(location.pathname.replace(/index\.html$/, ''))) window.Vault.onUnlock(function () {
    setTimeout(function () {
      if (!window.FileSync || !Fe.on('house')) return;
      var ids = Object.keys(used());
      if (ids.length) window.FileSync.sync({ ids: ids, getLocal: local, putLocal: keep, download: false });
    }, 2200);
  });

  window.HouseFiles = { put: put, putAll: putAll, upQueue: upQueue, get: get, url: url, fill: fill, view: view, release: release, uses: uses, used: used, strip: strip, onAdd: onAdd, onRemove: onRemove,
    sheet: sheet, head: head, isPdf: isPdf, isImg: isImg, size: size, uid: uid, local: local, keep: keep };
})();
