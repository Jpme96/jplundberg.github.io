/* Papers (Nov 2026): one place for the papers that matter – contracts, insurance, loan and bank papers,
   work papers, ID, car, health and tax – each with its PDF or photos, who it's with, a reference number,
   and a reminder before it expires or renews (At a glance + the calendar).
   The details (title, dates, notes) are in dash.tools.papers – synced and encrypted like everything else.
   The FILES are kept on the device (IndexedDB "dash-papers") and synced encrypted to your other devices
   through the Worker (filesync.js); the page shows what is synced and what is still on its way. Receipts on Home inventory items,
   warranties and travel documents keep living where they are; the page links to them. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, K = window.Kit;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +(p[2] || 1)); }
  function today() { return dkey(new Date()); }
  function daysTo(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function addYears(k, n) { var d = fromKey(k), day = d.getDate(); d.setDate(1); d.setFullYear(d.getFullYear() + n); var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return dkey(d); }
  function fmt(k, o) { return isKey(k) ? fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function on() { return Fe.on('papers'); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function size(b) { return b > 1e6 ? (b / 1e6).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' kB'; }
  var IS_PAGE = /\/cmd\/papers\/$/.test(location.pathname.replace(/index\.html$/, ''));

  var KINDS = [
    ['home', 'Home', 'house-door', '#a0673a'], ['contract', 'Contract', 'file-earmark-text', '#3987e5'], ['insurance', 'Insurance', 'shield-check', '#22b35e'],
    ['loan', 'Loan & bank', 'bank', '#11a597'], ['work', 'Work', 'briefcase', '#e8743b'], ['id', 'ID & certificates', 'person-vcard', '#8a6fdf'],
    ['car', 'Car', 'car-front', '#0891b2'], ['health', 'Health', 'heart-pulse', '#d55181'], ['tax', 'Tax', 'percent', '#6b6d73'], ['other', 'Other', 'folder2', '#7a8794']];
  function kind(k) { return KINDS.filter(function (x) { return x[0] === k; })[0] || KINDS[KINDS.length - 1]; }
  var DATEK = [['expires', 'Expires'], ['renews', 'Renews'], ['ends', 'Ends or notice by'], ['review', 'Look at it again']];
  var VERB = { expires: 'expires', renews: 'renews', ends: 'ends', review: 'look at it again' };
  /* common papers, offered as one-tap starts while the list is short */
  var COMMON = [
    ['Samboerkontrakt', 'home', ''], ['Purchase contract (kjøpekontrakt)', 'home', ''], ['Take-over protocol (overtakelsesprotokoll)', 'home', ''],
    ['Home insurance (innbo)', 'insurance', 'renews'], ['Mortgage agreement', 'loan', ''], ['Work contract', 'work', ''],
    ['Car insurance', 'insurance', 'renews'], ['Travel insurance', 'insurance', 'renews'], ['Tax return (skattemelding)', 'tax', ''], ['Will or power of attorney', 'other', '']];

  /* ---------- the files: kept on the device, synced (encrypted) through filesync.js ---------- */
  var idb = null;
  function db() { return idb || (idb = new Promise(function (res, rej) { var r = indexedDB.open('dash-papers', 1); r.onupgradeneeded = function () { r.result.createObjectStore('files'); }; r.onsuccess = function () { res(r.result); }; r.onerror = rej; })); }
  function putF(id, blob) { return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('files', 'readwrite'); t.objectStore('files').put(blob, id); t.oncomplete = res; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); }; }); }); }
  function getF(id) { return localF(id).then(function (b) { if (b || !window.FileSync) return b; return window.FileSync.down(id).then(function (nb) { if (nb) putF(id, nb).then(soonHere); return nb; }); }); }
  function soonHere() { clearTimeout(soonHere.t); soonHere.t = setTimeout(loadHere, 200); }
  function localF(id) { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('files').objectStore('files').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function delF(id) { if (window.FileSync) window.FileSync.del(id); return db().then(function (d) { d.transaction('files', 'readwrite').objectStore('files').delete(id); }).catch(function () {}); }
  function allKeys() { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('files').objectStore('files').getAllKeys(); q.onsuccess = function () { res(q.result || []); }; q.onerror = function () { res([]); }; }); }).catch(function () { return []; }); }
  var here = null;                         // file ids on this device (null until read)
  function loadHere() { return allKeys().then(function (k) { var n = {}; k.forEach(function (x) { n[x] = 1; }); var ch = JSON.stringify(n) !== JSON.stringify(here); here = n; if (ch) redraw(); }); }
  function shrink(file) {
    /* photos of papers have to stay readable: up to 2200 px on the long side */
    return new Promise(function (res, rej) {
      var img = new Image(); img.onload = function () { var s = Math.min(1, 2200 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(function (b) { b ? res(b) : rej(); }, 'image/jpeg', .86); URL.revokeObjectURL(img.src); };
      img.onerror = rej; img.src = URL.createObjectURL(file);
    });
  }
  function isPdf(f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''); }
  /* store the chosen files; returns the meta to put on the paper */
  function storeFiles(list) {
    var out = [], bad = [];
    return Array.prototype.reduce.call(list, function (p, f) {
      return p.then(function () {
        var pdf = isPdf(f);
        if (pdf && f.size > 15e6) { bad.push(f.name + ' (over 15 MB)'); return; }
        if (!pdf && !/^image\//.test(f.type || '') && !/\.(heic|heif|jpe?g|png|webp)$/i.test(f.name || '')) { bad.push(f.name + ' (not a PDF or photo)'); return; }
        var id = 'pp-' + uid();
        return (pdf ? Promise.resolve(f) : shrink(f)).then(function (b) { return putF(id, b).then(function () { if (window.FileSync) window.FileSync.up(id, b); out.push({ id: id, name: f.name || (pdf ? 'Document.pdf' : 'Photo.jpg'), type: pdf ? 'pdf' : 'img', size: b.size, at: today() }); }); })
          .catch(function () { bad.push(f.name + ' (couldn’t read it)'); });
      });
    }, Promise.resolve()).then(function () { askKeep(); return { files: out, bad: bad }; });
  }
  /* Safari can clear a web page's storage when it isn't used for a while – ask to keep it */
  function askKeep() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(function () { keepState(); }); } catch (e) {} }
  var kept = null;
  function keepState() { try { if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(function (v) { if (v !== kept) { kept = v; redraw(); } }); } catch (e) {} }

  /* ---------- the next date: a paper that renews every N years rolls on by itself ---------- */
  function next(x) {
    if (!isKey(x.date)) return null;
    var d = x.date, ev = +x.every || 0;
    if (ev > 0) { var g = 0; while (daysTo(d) < 0 && g++ < 200) d = addYears(d, ev); }
    return d;
  }
  function lead(x) { return x.lead === '' || x.lead == null ? 30 : +x.lead; }
  function inDays(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n < 0 ? (-n) + ' days ago' : n < 45 ? 'in ' + n + ' days' : n < 550 ? 'in ' + Math.round(n / 30.4) + ' months' : 'in ' + (n / 365).toFixed(1).replace('.', ',').replace(',0', '') + ' years'; }
  function status(x) {
    var d = next(x); if (!d) return null;
    var n = daysTo(d), v = VERB[x.dateKind] || 'expires';
    var past = n < 0 ? (v === 'expires' ? 'expired' : v === 'renews' ? 'renewed' : v === 'ends' ? 'ended' : 'was due') : null;
    return { date: d, n: n, soon: n <= lead(x) && lead(x) > 0, over: n < 0,
      text: past ? cap(past) + ' ' + fmt(d) : cap(v) + ' ' + fmt(d), rel: inDays(n) };
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- links to the rest of the dashboard ---------- */
  function linkOptions() {
    var o = [['', 'Nothing']];
    try { (Vault.get().accounts || []).filter(function (a) { return a.kind === 'debt'; }).forEach(function (a) { o.push(['loan:' + a.id, 'Loan: ' + (a.name || 'Loan')]); }); } catch (e) {}
    if (Fe.on('house')) Fe.list('hinv').forEach(function (x) { o.push(['inv:' + x.id, 'Home item: ' + x.name]); });
    if (Fe.on('warranty')) Fe.list('warranty').forEach(function (x) { o.push(['war:' + x.id, 'Warranty: ' + x.item]); });
    return o;
  }
  function linkOf(x) {
    var m = String(x.link || '').match(/^(loan|inv|war):(.+)$/); if (!m) return null;
    if (m[1] === 'loan') { var a = null; try { a = (Vault.get().accounts || []).filter(function (y) { return y.id === m[2]; })[0]; } catch (e) {} return a ? { icon: 'bank', text: a.name || 'Loan', href: '/cmd/finance/#loans' } : null; }
    if (m[1] === 'inv') { var it = Fe.list('hinv').filter(function (y) { return y.id === m[2]; })[0]; return it ? { icon: 'box-seam', text: it.name, href: '/cmd/house/#hinv=' + it.id } : null; }
    var w = Fe.list('warranty').filter(function (y) { return y.id === m[2]; })[0]; return w ? { icon: 'receipt-cutoff', text: w.item, href: '/cmd/finance/#warranty=' + w.id } : null;
  }

  /* ---------- the list ---------- */
  var FIELDS = [
    { k: 'title', type: 'title', label: 'Paper', ph: 'e.g. Samboerkontrakt, Home insurance, Work contract', req: true },
    { k: 'kind', label: 'Kind', type: 'select', options: KINDS.map(function (c) { return [c[0], c[1]]; }), def: 'contract' },
    { k: 'who', label: 'From or with', ph: 'e.g. Gjensidige, DNB, employer' },
    { k: 'ref', label: 'Policy or reference no.', ph: 'Optional' },
    { k: 'signed', label: 'Signed or issued', type: 'date' },
    { k: 'date', label: 'Date to watch', type: 'date', help: 'When it expires, renews or has to be cancelled – leave empty if it never does' },
    { k: 'dateKind', label: 'That date is when it', type: 'select', options: DATEK, def: 'expires' },
    { k: 'every', label: 'Repeats', type: 'select', options: [['', 'Once'], ['1', 'Every year'], ['2', 'Every 2 years'], ['3', 'Every 3 years'], ['5', 'Every 5 years'], ['10', 'Every 10 years']], def: '' },
    { k: 'lead', label: 'Remind me', type: 'select', options: [['30', '1 month before'], ['14', '2 weeks before'], ['60', '2 months before'], ['90', '3 months before'], ['7', '1 week before'], ['0', 'No reminder']], def: '30' },
    { k: 'cost', label: 'Costs per year', type: 'number', suffix: 'kr', help: 'Optional – for insurance and the like' },
    { k: 'covers', label: 'What it covers', ph: 'Insurance: e.g. contents up to 1,5 mill., travel, theft' },
    { k: 'excess', label: 'Excess (egenandel)', type: 'number', suffix: 'kr', help: 'Insurance: what you pay yourself on a claim' },
    { k: 'link', label: 'Belongs to', type: 'select', options: linkOptions, def: '' },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, help: 'Where the original is, what to remember, notice period …' }];
  var pending = [];                        // files picked in the edit sheet, stored on save
  var CFG = { key: 'papers', addTitle: 'New paper', editTitle: 'Edit paper', fields: FIELDS,
    beforeSave: function (it) {
      if (!Array.isArray(it.files)) it.files = [];
      if (!pending.length) return;
      var files = pending; pending = [];
      var id = it.id;
      storeFiles(files).then(function (r) {
        var t = Fe.tools(); (t.papers || []).forEach(function (x) { if (x.id === id) x.files = (x.files || []).concat(r.files); }); Fe.saveTools(t);
        loadHere();
        if (r.files.length) toast('<i class="bi bi-check2"></i> ' + (r.files.length === 1 ? 'File' : r.files.length + ' files') + ' saved' + (syncs() ? ' – syncing to your other devices' : ' on this device'));
        if (r.bad.length) toast('<i class="bi bi-exclamation-triangle"></i> Not added: ' + esc(r.bad.join(', ')));
      });
    },
    onDelete: function (it) { (it.files || []).forEach(function (f) { delF(f.id); }); setTimeout(loadHere, 50); } };
  /* the edit sheet gets a "File" row: pick the PDF or photos while you add the paper */
  function editSheet(item, preset) {
    pending = [];
    K.edit(CFG, item || null);
    var t = document.getElementById('kf-title'); if (!t) return;
    if (preset) { t.value = preset[0]; var kk = document.getElementById('kf-kind'); if (kk) kk.value = preset[1]; if (preset[2]) { var dk = document.getElementById('kf-dateKind'); if (dk) dk.value = preset[2]; var ev = document.getElementById('kf-every'); if (ev && preset[2] === 'renews') ev.value = '1'; } }
    var box = document.createElement('div'); box.className = 'cl-group pa-pick';
    var n = item && item.files ? item.files.length : 0;
    box.innerHTML = '<label class="st-row kit-row"><span>' + (n ? 'Add more files' : 'File') + '</span><span class="pa-pickbtn"><i class="bi bi-paperclip"></i> <span data-papickt>' + (n ? n + ' saved · add' : 'PDF or photos') + '</span></span>' +
      '<input type="file" accept="application/pdf,.pdf,image/*" multiple hidden data-papick></label><small class="kit-help">' + (syncs() ? 'Encrypted and synced to your other devices' : 'Kept on this device') + ' – PDF up to 15 MB, photos are made smaller.</small>';
    var anchor = document.getElementById('kf-kind'); anchor = anchor && anchor.closest('.cl-group');
    if (anchor && anchor.nextSibling) anchor.parentNode.insertBefore(box, anchor.nextSibling); else t.parentNode.appendChild(box);
    box.querySelector('[data-papick]').addEventListener('change', function (e) {
      pending = Array.prototype.slice.call(e.target.files || []);
      box.querySelector('[data-papickt]').textContent = pending.length ? pending.length === 1 ? pending[0].name : pending.length + ' files chosen' : 'PDF or photos';
    });
  }
  function sortPapers(a, b) {
    var sa = status(a), sb = status(b), ka = sa ? (sa.soon ? 0 : 1) : 2, kb = sb ? (sb.soon ? 0 : 1) : 2;
    if (ka !== kb) return ka - kb;
    if (sa && sb && sa.date !== sb.date) return sa.date < sb.date ? -1 : 1;
    return String(a.title || '').localeCompare(String(b.title || ''), 'nb');
  }
  function syncs() { return !!window.FileSync && window.FileSync.state().ok !== false; }
  function onServer(id) { var st = window.FileSync && window.FileSync.state(); return !!(st && st.server && id in st.server); }
  function missing(x) { return here ? (x.files || []).filter(function (f) { return !here[f.id]; }).length : 0; }
  var filt = 'all';
  try { filt = sessionStorage.getItem('dash.paFilt') || 'all'; } catch (e) {}
  function tile(label, value, sub) { return '<div class="kit-tile" data-tk="' + esc(label) + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  var col = K && $t('papers') ? K.collection({
    mount: $t('papers'), feature: 'papers', key: 'papers', icon: 'folder2-open', title: 'Papers', addLabel: 'Paper', limit: 80,
    addTitle: CFG.addTitle, editTitle: CFG.editTitle, fields: FIELDS, beforeSave: CFG.beforeSave, onDelete: CFG.onDelete, sort: sortPapers,
    empty: 'Add the papers you’d hate to search for – the samboerkontrakt, insurance, the loan agreement, your work contract – with the PDF, and get a reminder before they expire or renew.',
    above: function (l) {
      var h = '';
      var kinds = KINDS.filter(function (k) { return l.some(function (x) { return (x.kind || 'other') === k[0]; }); });
      if (kinds.length > 1) h += '<div class="pa-chips" role="group" aria-label="Show">' + [['all', 'All', 'grid']].concat(kinds.map(function (k) { return [k[0], k[1], k[2]]; })).map(function (k) {
        var n = k[0] === 'all' ? l.length : l.filter(function (x) { return (x.kind || 'other') === k[0]; }).length;
        return '<button type="button" class="pa-chip' + (filt === k[0] ? ' on' : '') + '" data-pafilt="' + k[0] + '" aria-pressed="' + (filt === k[0]) + '"><i class="bi bi-' + k[2] + '"></i> ' + esc(k[1]) + ' <small>' + n + '</small></button>';
      }).join('') + '</div>';
      if (l.length < 6) {
        var have = l.map(function (x) { return String(x.title || '').toLowerCase(); });
        var sug = COMMON.filter(function (c) { var w = c[0].toLowerCase().split(' (')[0]; return !have.some(function (t) { return t.indexOf(w) > -1; }); }).slice(0, 6);
        if (sug.length) h += '<div class="pa-sug"><span>' + (l.length ? 'Also worth keeping' : 'Start with') + '</span>' + sug.map(function (c) { return '<button type="button" class="pa-sugb" data-pasug="' + esc(c[0]) + '"><i class="bi bi-plus"></i> ' + esc(c[0]) + '</button>'; }).join('') + '</div>';
      }
      var files = 0, miss = 0, onSrv = 0, wait = 0, fs = window.FileSync ? window.FileSync.state() : null;
      l.forEach(function (x) { (x.files || []).forEach(function (f) { files++; var h0 = !here || here[f.id], sv = fs && fs.server && f.id in fs.server; if (!h0) miss++; if (sv) onSrv++; else if (h0) wait++; }); });
      var msg;
      if (!fs || fs.ok === false) msg = '<i class="bi bi-' + (miss ? 'cloud-slash' : 'phone') + '"></i> ' + (miss ? '<b>' + (files - miss) + ' of ' + files + ' files</b> are on this device. ' : '<b>All ' + files + ' files</b> are on this device. ') + (fs && fs.ok === false ? 'To sync them to your other devices, paste the new <b>worker.js</b> in Cloudflare.' : 'The details sync, the files don’t.');
      else if (fs.ok && !miss && !wait) msg = '<i class="bi bi-cloud-check"></i> <b>All ' + files + ' files</b> are synced, encrypted, and on this device.';
      else if (fs.ok) msg = '<i class="bi bi-arrow-repeat"></i> <b>' + onSrv + ' of ' + files + ' files</b> synced' + (wait ? ' · ' + wait + ' uploading' : '') + (miss ? ' · ' + miss + ' only on the phone or computer ' + (miss === 1 ? 'it was' : 'they were') + ' added on – open Papers there once' : '') + '.';
      else msg = '<i class="bi bi-phone"></i> <b>' + (files - miss) + ' of ' + files + ' files</b> are on this device. ' + (fs.error === 'offline' ? 'They sync when you’re online.' : 'Syncing …');
      if (files) h += '<p class="pa-note"><span>' + msg + '</span>' +
        (kept === false ? ' <button type="button" class="text-btn" data-pakeep>Ask the browser to keep them</button>' : kept ? ' The browser has been asked to keep them.' : '') + '</p>';
      return h;
    },
    row: function (x) {
      var k = kind(x.kind), s = status(x), n = (x.files || []).length, m = missing(x);
      var sub = [x.who, s ? s.text : '', x.ref ? 'no. ' + x.ref : ''].filter(Boolean).map(esc).join(' · ');
      sub += n ? ' <span class="pa-fc' + (m ? ' miss' : '') + '" title="' + (m ? m + ' not on this device yet' : 'On this device') + '"><i class="bi bi-' + (m === n ? 'cloud-arrow-down' : 'paperclip') + '"></i>' + n + '</span>' : ' <span class="pa-fc none"><i class="bi bi-paperclip"></i>no file</span>';
      var right = s && (s.soon || s.over) ? '<span class="pa-due' + (s.over && x.dateKind !== 'renews' ? ' over' : s.n <= 7 ? ' near' : '') + '">' + esc(s.rel) + '</span>' : '';
      return { icon: k[2], color: k[3], title: x.title, sub: sub, right: right, cls: 'pa-k-' + (x.kind || 'other') };
    },
    detail: function (x) {
      var s = status(x), ln = linkOf(x), files = x.files || [];
      var facts = [
        ['tag', 'Kind', kind(x.kind)[1]], x.who ? ['building', 'From or with', x.who] : null, x.ref ? ['hash', 'Reference', x.ref] : null,
        isKey(x.signed) ? ['pen', 'Signed', fmt(x.signed)] : null,
        s ? ['calendar-event', DATEK.filter(function (d) { return d[0] === (x.dateKind || 'expires'); })[0][1], fmt(s.date) + ' · ' + s.rel + (+x.every ? ' · every ' + (+x.every === 1 ? 'year' : x.every + ' years') : '')] : null,
        +x.cost ? ['cash-coin', 'Per year', kr(x.cost) + ' · ' + kr(x.cost / 12) + ' a month'] : null].filter(Boolean);
      return '<dl class="pa-facts">' + facts.map(function (f) { return '<div><dt><i class="bi bi-' + f[0] + '"></i> ' + esc(f[1]) + '</dt><dd>' + esc(f[2]) + '</dd></div>'; }).join('') + '</dl>' +
        (ln ? '<a class="text-btn pa-link" href="' + esc(ln.href) + '"><i class="bi bi-' + ln.icon + '"></i> ' + esc(ln.text) + ' <i class="bi bi-chevron-right"></i></a>' : '') +
        '<ul class="pa-files">' + files.map(function (f) {
          var hereNow = !here || here[f.id];
          return '<li data-paf="' + esc(f.id) + '"' + (hereNow ? '' : ' class="gone"') + '>' +
            (f.type === 'img' && hereNow ? '<img data-paimg="' + esc(f.id) + '" alt="">' : '<i class="bi bi-' + (f.type === 'pdf' ? 'file-earmark-pdf' : 'image') + '"></i>') +
            '<a class="pa-fn" target="_blank" rel="noopener" data-paopen="' + esc(f.id) + '"><b>' + esc(f.name) + '</b><small>' + (hereNow ? esc(size(f.size || 0)) + ' · added ' + esc(fmt(f.at)) : onServer(f.id) ? 'Downloading …' : 'Only on the device it was added on – open Papers there once to sync it') + '</small></a>' +
            (hereNow ? '<a class="icon-btn" data-padl="' + esc(f.id) + '" download="' + esc(f.name) + '" aria-label="Save a copy" title="Save a copy"><i class="bi bi-download"></i></a>' : '') +
            '<button type="button" class="icon-btn" data-pafdel="' + esc(x.id + '|' + f.id) + '" aria-label="Remove file" title="Remove file"><i class="bi bi-x-lg"></i></button></li>';
        }).join('') + '</ul>' +
        '<label class="text-btn pa-addf"><i class="bi bi-paperclip"></i> ' + (files.length ? 'Add another file' : 'Add the PDF or a photo') + '<input type="file" accept="application/pdf,.pdf,image/*" multiple hidden data-paadd="' + esc(x.id) + '"></label>' +
        (x.notes ? '<p class="kit-notes">' + esc(x.notes) + '</p>' : '');
    },
    afterRender: function (el) {
      el.querySelectorAll('.kit-item').forEach(function (li) { var it = Fe.list('papers').filter(function (x) { return x.id === li.dataset.id; })[0]; li.hidden = filt !== 'all' && it && (it.kind || 'other') !== filt; });
      el.querySelectorAll('[data-paopen], [data-padl]').forEach(function (a) {
        var id = a.dataset.paopen || a.dataset.padl;
        getF(id).then(function (b) { if (b) a.href = URL.createObjectURL(b.type ? b : new Blob([b], { type: 'application/pdf' })); });
      });
      el.querySelectorAll('img[data-paimg]').forEach(function (im) { getF(im.dataset.paimg).then(function (b) { if (b) im.src = URL.createObjectURL(b); }); });
    },
    onClick: function (e, render) {
      var b;
      if ((b = e.target.closest('[data-pafilt]'))) { filt = b.dataset.pafilt; try { sessionStorage.setItem('dash.paFilt', filt); } catch (x) {} render(); return; }
      if ((b = e.target.closest('[data-pasug]'))) { var c = COMMON.filter(function (x) { return x[0] === b.dataset.pasug; })[0]; editSheet(null, c); return; }
      if (e.target.closest('[data-pakeep]')) { askKeep(); setTimeout(function () { if (kept === false) toast('The browser said no for now – it usually agrees once the dashboard is on your home screen'); }, 600); return; }
      if ((b = e.target.closest('[data-paopen]')) && !b.getAttribute('href')) { e.preventDefault(); toast(onServer(b.dataset.paopen) ? 'Downloading – try again in a moment' : 'That file is only on the device it was added on'); return; }
      if ((b = e.target.closest('[data-pafdel]'))) {
        if (!b.classList.contains('armed')) { b.classList.add('armed'); b.setAttribute('aria-label', 'Tap again to remove'); b.innerHTML = '<i class="bi bi-trash3"></i>'; setTimeout(function () { b.classList.remove('armed'); }, 3000); return; }
        var q = b.dataset.pafdel.split('|'), t = Fe.tools();
        (t.papers || []).forEach(function (x) { if (x.id === q[0]) x.files = (x.files || []).filter(function (f) { return f.id !== q[1]; }); });
        Fe.saveTools(t); delF(q[1]); setTimeout(loadHere, 50); toast('<i class="bi bi-check2"></i> File removed');
      }
    }
  }) : null;
  function redraw() { if (col) col.render(); drawSoon(); drawElse(); drawTiles(); }
  /* the Edit and + Paper buttons open the sheet with the File row */
  if (col) $t('papers').addEventListener('click', function (e) {
    var b = e.target.closest('[data-kit-add], [data-kit-edit]'); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    editSheet(b.hasAttribute('data-kit-edit') ? Fe.list('papers').filter(function (x) { return x.id === b.dataset.kitEdit; })[0] : null);
  }, true);
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-paadd]'); if (!i || !i.files.length) return;
    var id = i.dataset.paadd, files = Array.prototype.slice.call(i.files); i.value = '';
    storeFiles(files).then(function (r) {
      var t = Fe.tools(); (t.papers || []).forEach(function (x) { if (x.id === id) x.files = (x.files || []).concat(r.files); }); Fe.saveTools(t);
      loadHere();
      if (r.files.length) toast('<i class="bi bi-check2"></i> ' + (r.files.length === 1 ? 'File' : r.files.length + ' files') + ' saved' + (syncs() ? ' – syncing to your other devices' : ' on this device'));
      if (r.bad.length) toast('<i class="bi bi-exclamation-triangle"></i> Not added: ' + esc(r.bad.join(', ')));
    });
  });

  /* ---------- coming up: the next 12 months, with travel documents ---------- */
  function travelDocs() { try { var t = JSON.parse(localStorage.getItem('dash.travel')) || {}; return Array.isArray(t.docs) ? t.docs : []; } catch (e) { return []; } }
  function upcoming(days) {
    var out = [];
    Fe.list('papers').forEach(function (x) { var s = status(x); if (s && s.n >= -14 && s.n <= days) out.push({ date: s.date, n: s.n, title: x.title, what: VERB[x.dateKind] || 'expires', k: kind(x.kind), href: '#papers=' + x.id, renew: x.dateKind === 'renews' }); });
    if (Fe.on('travel')) travelDocs().forEach(function (d) { if (isKey(d.expires)) { var n = daysTo(d.expires); if (n >= -14 && n <= days) out.push({ date: d.expires, n: n, title: d.name || 'Travel document', what: 'expires', k: ['', 'Travel', 'passport', '#0891b2'], href: '/cmd/travel/#docs', travel: true }); } });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  function drawSoon() {
    var el = $t('pasoon'); if (!el) return;
    if (!on()) { el.hidden = true; el.innerHTML = ''; return; }
    var l = upcoming(365); el.hidden = !l.length && !Fe.list('papers').length;
    var h = '<section class="card kit-card" id="pasoon"><div class="card-head"><h2><i class="bi bi-calendar-event"></i> Coming up</h2></div>' +
      (l.length ? '<ul class="pa-soon">' + l.map(function (u) {
        return '<li><a href="' + esc(u.href) + '"' + (u.travel ? '' : ' data-pago') + '><span class="pa-when' + (u.n < 0 && !u.renew ? ' over' : u.n <= 30 ? ' near' : '') + '"><b>' + esc(fromKey(u.date).getDate()) + '</b><small>' + esc(fmt(u.date, { month: 'short' })) + (fromKey(u.date).getFullYear() !== new Date().getFullYear() ? ' ' + fromKey(u.date).getFullYear() : '') + '</small></span>' +
          '<span class="kit-ic" style="--c:' + u.k[3] + '"><i class="bi bi-' + u.k[2] + '"></i></span><span class="kit-x"><b>' + esc(u.title) + '</b><small>' + esc(cap(u.what) + ' ' + inDays(u.n) + (u.travel ? ' · Travel' : '')) + '</small></span></a></li>';
      }).join('') + '</ul>' : '<p class="empty kit-empty">Nothing expires or renews in the next 12 months. Add a date to a paper to see it here.</p>') + '</section>';
    if (el.innerHTML !== h) el.innerHTML = h;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-pago]'); if (!a) return;
    e.preventDefault(); history.replaceState(null, '', a.getAttribute('href')); window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  /* ---------- kept elsewhere: receipts, warranties and travel documents ---------- */
  function drawElse() {
    var el = $t('paelse'); if (!el) return;
    if (!on()) { el.hidden = true; el.innerHTML = ''; return; }
    var rows = [];
    if (Fe.on('house')) { var inv = Fe.list('hinv'), rc = inv.filter(function (x) { return x.receipt; }).length; rows.push(['box-seam', '#22b35e', 'Receipts on home items', inv.length ? rc + ' of ' + inv.length + ' items have a receipt' : 'Photos and receipts for your valuables', '/cmd/house/#hinv']); }
    if (Fe.on('travel')) { var td = travelDocs(), nx = td.filter(function (d) { return isKey(d.expires) && daysTo(d.expires) >= 0; }).sort(function (a, b) { return a.expires < b.expires ? -1 : 1; })[0]; rows.push(['passport', '#0891b2', 'Travel documents', td.length ? td.length + ' saved' + (nx ? ' · next to expire: ' + (nx.name || 'document') + ' ' + fmt(nx.expires, { month: 'short', year: 'numeric' }) : '') : 'Passport, ID, EHIC and travel insurance', '/cmd/travel/#docs']); }
    if (Fe.on('house') && window.SharedHome) rows.push(['people', '#a0673a', 'Household register', 'Appendix B of the samboerkontrakt – from the Home inventory', '/cmd/house/#hinv']);
    el.hidden = !rows.length;
    var h = rows.length ? '<section class="card kit-card" id="paelse"><div class="card-head"><h2><i class="bi bi-signpost"></i> Kept elsewhere</h2></div><ul class="pa-else">' + rows.map(function (r) {
      return '<li><a href="' + esc(r[4]) + '"><span class="kit-ic" style="--c:' + r[1] + '"><i class="bi bi-' + r[0] + '"></i></span><span class="kit-x"><b>' + esc(r[2]) + '</b><small>' + esc(r[3]) + '</small></span><i class="bi bi-chevron-right"></i></a></li>';
    }).join('') + '</ul></section>' : '';
    if (el.innerHTML !== h) el.innerHTML = h;
  }

  /* ---------- the numbers at the top ---------- */
  function heroTile(icon, label, value, sub, href, c) { return '<a class="fp-tile hl-tile" href="' + href + '"' + (c ? ' style="--c:' + c + '"' : '') + '><div class="lbl"><i class="bi bi-' + icon + '"></i>' + label + '</div><div class="val">' + value + '</div><div class="sub">' + (sub || '&nbsp;') + '</div></a>'; }
  function drawTiles() {
    var el = document.getElementById('paTiles'); if (!el) return;
    var em = document.querySelector('[data-paempty]'); if (em) em.hidden = on();
    if (!on()) { el.hidden = true; el.innerHTML = ''; return; }
    var l = Fe.list('papers'), u = upcoming(365).filter(function (x) { return x.n >= 0; })[0];
    var ins = l.filter(function (x) { return +x.cost > 0; }).reduce(function (a, x) { return a + (+x.cost); }, 0);
    var nofile = l.filter(function (x) { return !(x.files || []).length; }).length;
    el.hidden = false;
    var h = heroTile('folder2-open', 'Papers', l.length, nofile ? nofile + ' without a file' : l.length ? 'all with a file' : 'none yet', '#papers', '#6b4bc4') +
      heroTile('calendar-event', 'Next date', u ? esc(fmt(u.date, { day: 'numeric', month: 'short' })) : '–', u ? esc(u.title) : 'nothing in 12 months', '#pasoon', u && u.n <= 30 ? '#e8743b' : '#3987e5') +
      heroTile('cash-coin', 'Per year', ins ? kr(ins) : '–', ins ? kr(ins / 12) + ' a month' : 'add what insurance costs', '#papers', '#22b35e');
    if (el.innerHTML !== h) el.innerHTML = h;
  }
  ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(drawTiles.t); drawTiles.t = setTimeout(function () { drawSoon(); drawElse(); drawTiles(); }, 30); }); });
  window.Vault.onUnlock(function () {
    setTimeout(function () {
      drawSoon(); drawElse(); drawTiles();
      if (IS_PAGE) { loadHere().then(syncAll); keepState(); if (location.hash === '#add' && on() && col) { history.replaceState(null, '', location.pathname); editSheet(null); } }
    }, 60);
  });

  /* ---------- sync the files on this page: up what only this device has, down what's missing here ---------- */
  function syncAll() {
    if (!window.FileSync || !on()) return;
    var ids = []; Fe.list('papers').forEach(function (x) { (x.files || []).forEach(function (f) { ids.push(f.id); }); });
    window.FileSync.sync({ ids: ids, getLocal: localF, putLocal: putF, download: true }).then(loadHere);
  }
  if (IS_PAGE) window.addEventListener('filesync:change', function () { clearTimeout(syncAll.t); syncAll.t = setTimeout(function () { if (col) col.render(); }, 250); });

  /* ---------- At a glance: before a paper expires or renews ---------- */
  window.BriefExtra = window.BriefExtra || [];
  window.BriefExtra.push(function (add) {
    if (!on()) return;
    Fe.list('papers').map(function (x) { return [x, status(x)]; }).filter(function (p) { return p[1] && lead(p[0]) > 0 && p[1].n <= lead(p[0]) && p[1].n >= (p[0].dateKind === 'renews' ? 0 : -30); })
      .sort(function (a, b) { return a[1].n - b[1].n; }).slice(0, 3).forEach(function (p) {
        var x = p[0], s = p[1], k = kind(x.kind), v = VERB[x.dateKind] || 'expires';
        add(s.n < 0 ? 30 : s.n <= 7 ? 38 : 56, k[2], s.n < 0 ? '#e66767' : s.n <= 7 ? '#e8743b' : k[3],
          x.title + ' ' + (s.n < 0 ? (v === 'expires' ? 'has expired' : v === 'ends' ? 'has ended' : 'was due') : v + ' ' + s.rel),
          [fmt(s.date), x.who, x.dateKind === 'ends' ? 'cancel or renew before then' : x.dateKind === 'renews' ? 'check the price, or switch' : ''].filter(Boolean).join(' · '), '/cmd/papers/#papers=' + x.id);
      });
  });
  /* ---------- the calendar ---------- */
  (window.EventsExtra = window.EventsExtra || []).push(function () {
    if (!on()) return [];
    return Fe.list('papers').filter(function (x) { return isKey(x.date); }).map(function (x) {
      var k = kind(x.kind), ev = +x.every || 0;
      var e = { id: 'rem:paper:' + x.id, title: x.title + ' ' + (VERB[x.dateKind] || 'expires'), allDay: true, start: fromKey(x.date), days: 1, color: k[3], readOnly: true, reminder: true,
        link: '/cmd/papers/#papers=' + x.id, location: '', notes: [x.who, x.ref ? 'No. ' + x.ref : ''].filter(Boolean).join(' · '), exDays: {} };
      if (ev) e.rule = { freq: 'YEARLY', interval: ev };
      return e;
    });
  });
  /* ---------- search and the command bar ---------- */
  window.CommandExtra = window.CommandExtra || [];
  window.CommandExtra.push(function () {
    if (!on()) return [];
    return [{ i: 'folder-plus', t: 'Add a paper', s: 'Papers', run: function () { if (IS_PAGE && col) editSheet(null); else location.href = '/cmd/papers/#add'; }, x: 'papers document dokument kontrakt contract insurance forsikring pdf' },
      { i: 'folder2-open', t: 'Papers', s: 'Contracts, insurance and documents', run: function () { location.href = '/cmd/papers/'; }, x: 'papers dokumenter papirer kontrakter avtaler' }];
  });
  window.Papers = { getFile: getF, add: function (preset) { editSheet(null, preset); }, list: function () { return Fe.list('papers'); }, upcoming: upcoming, status: status };
})();
