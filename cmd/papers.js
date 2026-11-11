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
  var hasDate = function (g) { return !!g('date'); };
  var FIELDS = [
    { k: 'title', type: 'title', label: 'Paper', ph: 'Name, e.g. Home insurance', req: true },
    { k: 'kind', label: 'Kind', type: 'select', options: KINDS.map(function (c) { return [c[0], c[1]]; }), def: 'contract', grp: 'a' },
    { k: 'who', label: 'From or with', ph: 'Gjensidige, DNB …', grp: 'a' },
    { k: 'ref', label: 'Reference no.', ph: 'Optional', grp: 'a' },
    { k: 'signed', label: 'Signed or issued', type: 'date', grp: 'd', head: 'Dates' },
    { k: 'date', label: 'Date to watch', type: 'date', help: 'When it expires, renews or must be cancelled – leave empty if it never does', grp: 'd' },
    { k: 'dateKind', label: 'That date it', type: 'select', options: DATEK, def: 'expires', grp: 'd', when: hasDate },
    { k: 'every', label: 'Repeats', type: 'select', options: [['', 'Once'], ['1', 'Every year'], ['2', 'Every 2 years'], ['3', 'Every 3 years'], ['5', 'Every 5 years'], ['10', 'Every 10 years']], def: '', grp: 'd', when: hasDate },
    { k: 'lead', label: 'Remind me', type: 'select', options: [['30', '1 month before'], ['14', '2 weeks before'], ['60', '2 months before'], ['90', '3 months before'], ['7', '1 week before'], ['0', 'No reminder']], def: '30', grp: 'd', when: hasDate },
    { k: 'cost', label: 'Costs per year', type: 'number', suffix: 'kr', grp: 'c', head: 'Cost', when: function (g) { return /^(insurance|loan|home|car|other)$/.test(g('kind')) || !!g('cost'); } },
    { k: 'excess', label: 'Excess (egenandel)', type: 'number', suffix: 'kr', grp: 'c', when: function (g) { return g('kind') === 'insurance' || !!g('excess'); } },
    { k: 'covers', label: 'Covers', ph: 'Contents, travel, theft …', grp: 'c', when: function (g) { return g('kind') === 'insurance' || !!g('covers'); } },
    { k: 'link', label: 'Belongs to', type: 'select', options: linkOptions, def: '', grp: 'l', when: function (g) { return linkOptions().length > 1 || !!g('link'); } },
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
  /* ---------- one form per kind: only the fields that kind needs, in its own words ---------- */
  var FORMS = {
    home: { sub: 'Samboerkontrakt, purchase contract, take-over protocol', ph: 'e.g. Samboerkontrakt', f: {
      who: { label: 'With', ph: 'Iago, the seller, the bank …' }, signed: { label: 'Signed' }, date: { label: 'Look at it again', help: 'Optional – e.g. when to update the samboerkontrakt' }, lead: {}, link: { label: 'Belongs to' }, notes: { help: 'Where the signed original is, what you agreed …' } }, dk: 'review' },
    contract: { sub: 'Phone, power, rent, gym, subscriptions', ph: 'e.g. Phone subscription', f: {
      who: { label: 'Company', ph: 'Telia, Tibber …' }, ref: { label: 'Customer no.' }, signed: { label: 'Signed' }, date: { label: 'Ends or notice by', help: 'The last day to cancel, or when it runs out' }, every: {}, lead: {}, cost: {}, notes: { help: 'Notice period, binding time, what’s included …' } }, dk: 'ends' },
    insurance: { sub: 'Home contents, travel, life, accident', ph: 'e.g. Home insurance (innbo)', f: {
      who: { label: 'Insurer', ph: 'Gjensidige, If, Tryg …' }, ref: { label: 'Policy no.' }, date: { label: 'Renews', help: '' }, every: { def: '1' }, lead: {}, cost: { label: 'Price per year' }, excess: { label: 'Excess (egenandel)' }, covers: {}, link: { label: 'Covers this item' }, notes: { help: 'Phone number for claims, what isn’t covered …' } }, dk: 'renews' },
    loan: { sub: 'Mortgage, loan agreement, bank papers', ph: 'e.g. Mortgage agreement', f: {
      who: { label: 'Bank', ph: 'DNB, Sbanken …' }, ref: { label: 'Loan no.' }, signed: { label: 'Signed' }, date: { label: 'Fixed rate ends', help: 'Optional – when the rate or terms should be looked at' }, lead: {}, link: { label: 'The loan in Finances' }, notes: {} }, dk: 'review' },
    work: { sub: 'Work contract, pay changes, references', ph: 'e.g. Work contract', f: {
      who: { label: 'Employer' }, signed: { label: 'Signed' }, date: { label: 'Ends', help: 'Only for a temporary job' }, lead: {}, notes: { help: 'Notice period, pension, holidays …' } }, dk: 'ends' },
    id: { sub: 'Passport, driving licence, certificates', ph: 'e.g. Driving licence', f: {
      who: { label: 'Issued by', ph: 'Politiet, Statens vegvesen …' }, ref: { label: 'Document no.' }, signed: { label: 'Issued' }, date: { label: 'Expires', help: '' }, lead: { def: '90' }, notes: {} }, dk: 'expires' },
    car: { sub: 'Registration, car insurance, service', ph: 'e.g. Vehicle registration', f: {
      who: { label: 'From or with' }, ref: { label: 'Reg. no.' }, date: { label: 'Date to watch' }, dateKind: {}, every: {}, lead: {}, cost: {}, notes: {} } },
    health: { sub: 'Referrals, results, vaccinations', ph: 'e.g. Referral', f: {
      who: { label: 'From', ph: 'GP, hospital …' }, signed: { label: 'Date' }, date: { label: 'Look at it again', help: 'Optional' }, lead: {}, notes: {} }, dk: 'review' },
    tax: { sub: 'Tax return, assessments, deductions', ph: 'e.g. Tax return 2026', f: {
      who: { label: 'From', def: 'Skatteetaten' }, signed: { label: 'Date' }, date: { label: 'Deadline', help: 'Optional – e.g. the last day to change the tax return' }, lead: { def: '14' }, notes: {} }, dk: 'ends' },
    other: { sub: 'Anything else worth keeping', ph: 'Name of the paper', f: null }
  };
  function cfgFor(k) {
    var F = FORMS[k] || FORMS.other, kn = kind(k)[1];
    var fields = !F.f ? FIELDS : FIELDS.filter(function (f) { return f.k === 'title' || f.k === 'kind' || f.k in F.f; }).map(function (f) {
      var o = F.f[f.k] || {}, n = Object.assign({}, f);
      if (f.k === 'title') n.ph = F.ph;
      ['label', 'ph', 'def'].forEach(function (p) { if (o[p] != null) n[p] = o[p]; });
      if (o.help != null) n.help = o.help || undefined;
      return n;
    });
    if (F.f) {
      /* the kind's own choice of fields shows them always – only the date's follow-ups wait for a date */
      fields = fields.map(function (f) { return /^(dateKind|every|lead|link)$/.test(f.k) ? f : Object.assign({}, f, { when: undefined }); });
      /* each box keeps its heading on whichever of its fields comes first */
      var heads = {}, seen = {}; FIELDS.forEach(function (f) { if (f.grp && f.head) heads[f.grp] = f.head; });
      fields = fields.map(function (f) { if (!f.grp) return f; var n = Object.assign({}, f); delete n.head; if (!seen[f.grp]) { seen[f.grp] = 1; if (heads[f.grp]) n.head = heads[f.grp]; } return n; });
    }
    return Object.assign({}, CFG, { fields: fields, addTitle: 'New: ' + kn.toLowerCase(), editTitle: kn,
      beforeSave: function (it, isNew) { it.kind = it.kind || k; if (F.dk && FORMS[it.kind] === F) it.dateKind = F.dk; return CFG.beforeSave(it, isNew); } });
  }
  function pickKind(then) {
    var H = window.HomeLife;
    if (!H || !H.picker) { then('contract'); return; }
    H.picker('folder2-open', 'What kind of paper?', 'You get a form for just that kind', KINDS.filter(function (c) { return c[0] !== 'car'; }).map(function (c) { return { k: c[0], n: c[1], s: (FORMS[c[0]] || {}).sub, i: c[2], c: c[3] }; }), function (o) { then(o.k); });
  }
  function editSheet(item, preset, keep) {
    if (!item && !preset && !keep) { pickKind(function (k) { editSheet(null, null, { kind: k }); }); return; }
    var kk0 = (item && item.kind) || (keep && keep.kind) || (preset && preset[1]) || 'other';
    pending = [];
    K.edit(cfgFor(kk0), item || null, item ? null : Object.assign({ kind: kk0 }, keep || {}));
    var t = document.getElementById('kf-title'); if (!t) return;
    /* changing the kind opens that kind's form, keeping what you typed */
    var ks = document.getElementById('kf-kind');
    if (ks) ks.addEventListener('change', function () {
      var cur = { kind: ks.value }; FIELDS.forEach(function (f) { var el = document.getElementById('kf-' + f.k); if (el && el.value !== '') cur[f.k] = el.value; }); cur.kind = ks.value;
      var files = pending;
      if (item) { var it2 = Object.assign({}, item, cur); editSheet(it2); } else editSheet(null, null, Object.assign({}, keep || {}, cur));
      pending = files;
    });
    if (preset) { t.value = preset[0]; if (preset[2] && !(FORMS[kk0] || {}).dk) { var dk = document.getElementById('kf-dateKind'); if (dk) dk.value = preset[2]; } var ev = document.getElementById('kf-every'); if (ev && preset[2] === 'renews' && !ev.value) ev.value = '1'; }
    var box = document.createElement('div'); box.className = 'cl-group pa-pick';
    var n = item && item.files ? item.files.length : 0;
    box.innerHTML = '<label class="st-row kit-row"><span>' + (n ? 'Add more files' : 'File') + '</span><span class="pa-pickbtn"><i class="bi bi-paperclip"></i> <span data-papickt>' + (n ? n + ' saved · add' : 'PDF or photos') + '</span></span>' +
      '<input type="file" accept="application/pdf,.pdf,image/*" multiple hidden data-papick></label><small class="kit-help">' + (syncs() ? 'Encrypted and synced to your other devices' : 'Kept on this device') + ' – PDF up to 15 MB, photos are made smaller.</small>';
    var anchor = document.getElementById('kf-kind'); anchor = anchor && (anchor.closest('.kit-gwrap') || anchor.closest('.cl-group'));
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
      if (kinds.length > 1) h += '<div class="pa-chips" role="group" aria-label="Show" data-t-aria-label="ui.show">' + [['all', 'All', 'grid']].concat(kinds.map(function (k) { return [k[0], k[1], k[2]]; })).map(function (k) {
        var n = k[0] === 'all' ? l.length : l.filter(function (x) { return (x.kind || 'other') === k[0]; }).length;
        return '<button type="button" class="pa-chip' + (filt === k[0] ? ' on' : '') + '" data-pafilt="' + k[0] + '" aria-pressed="' + (filt === k[0]) + '"><i class="bi bi-' + k[2] + '"></i> ' + esc(k[1]) + ' <small>' + n + '</small></button>';
      }).join('') + '</div>';
      if (l.length < 6) {
        var have = l.map(function (x) { return String(x.title || '').toLowerCase(); });
        var sug = COMMON.filter(function (c) { var w = c[0].toLowerCase().split(' (')[0]; return !have.some(function (t) { return t.indexOf(w) > -1; }); }).slice(0, 6);
        if (sug.length) h += '<div class="pa-sug"><span>' + (l.length ? 'Also worth keeping' : 'Start with') + '</span>' + sug.map(function (c) { return '<button type="button" class="pa-sugb" data-pasug="' + esc(c[0]) + '"><i class="bi bi-plus"></i> ' + esc(c[0]) + '</button>'; }).join('') + '</div>';
      }
      h += '<div class="pa-bulk"><label class="pill-btn"><i class="bi bi-files"></i> Add several files<input type="file" accept="application/pdf,.pdf,image/*" multiple hidden data-pabulk></label><small data-t="ui.each-file-becomes-a-paper-check-the-name">Each file becomes a paper – check the names and kinds, then add the dates later</small></div>';
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
  /* ---------- many files at once: each becomes a paper, you check name + kind in one list ---------- */
  var GUESS = [[/forsikr|insurance|polise|polisse|egenandel/i, 'insurance'], [/l[åa]n\b|lån|loan|mortgage|bank|dnb|nordea|sparebank|handelsbanken|sbanken/i, 'loan'],
    [/arbeid|ansett|l[øo]nnsslipp|employ|work|attest|vitnem/i, 'work'], [/samboer|kj[øo]pekontrakt|overtak|tilstandsrapport|takst|bolig|eierskifte|borettslag|sameie|home|house/i, 'home'],
    [/pass\b|passport|f[øo]rerkort|licen[cs]e|sertifikat|certificat|\bid\b|identitet/i, 'id'], [/skatt|tax|selvangivelse/i, 'tax'], [/helse|lege|legen|journal|resept|vaksin|health|henvis/i, 'health'],
    [/kontrakt|avtale|contract|agreement|abonnement|subscription/i, 'contract']];
  function guessKind(n) { for (var i = 0; i < GUESS.length; i++) if (GUESS[i][0].test(n)) return GUESS[i][1]; return 'other'; }
  function cleanName(n) { var t = String(n || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim(); if (/^(img|image|scan|dok|doc|document|pxl|photo)\s?\d*/i.test(t) || !t) t = ''; return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }
  function bulk(list) {
    var H = window.HomeLife, fl = Array.prototype.slice.call(list || []).filter(function (f) { return isPdf(f) || /^image\//.test(f.type || '') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name || ''); });
    if (!fl.length) { toast('Only PDFs and photos can be added'); return; }
    if (!H || !H.dialog) return;
    var opts = KINDS.map(function (c) { return '<option value="' + c[0] + '">' + esc(c[1]) + '</option>'; }).join('');
    var rows = fl.map(function (f, i) { var nm = cleanName(f.name), k = guessKind(f.name);
      return '<li class="pa-brow"><span class="pa-bico"><i class="bi bi-' + (isPdf(f) ? 'file-earmark-pdf' : 'image') + '"></i></span><input data-pbn="' + i + '" maxlength="120" value="' + esc(nm) + '" placeholder="' + esc(f.name) + '"><select data-pbk="' + i + '">' + opts.replace('value="' + k + '"', 'value="' + k + '" selected') + '</select><button type="button" class="icon-btn sm" data-pbx="' + i + '" aria-label="Leave this one out"><i class="bi bi-x-lg"></i></button></li>'; }).join('');
    var d = H.dialog(H.dhead('files', fl.length + (fl.length === 1 ? ' file' : ' files'), 'Each becomes its own paper. The kind is guessed from the file name – change what’s wrong.') +
      '<ul class="pa-blist">' + rows + '</ul><div class="pa-bacts"><button type="button" class="pill-btn" data-pbgo><i class="bi bi-check2"></i> Add <span data-pbn2>' + fl.length + '</span> papers</button></div>', function (e, close) {
      var x = e.target.closest('[data-pbx]');
      if (x) { var li = x.closest('li'); li.hidden = true; li.dataset.out = '1'; var left = d.el.querySelectorAll('.pa-brow:not([data-out])').length; d.el.querySelector('[data-pbn2]').textContent = left; if (!left) close(); return; }
      if (!e.target.closest('[data-pbgo]')) return;
      var add = []; d.el.querySelectorAll('.pa-brow').forEach(function (li, i) { if (li.dataset.out) return; var nm = li.querySelector('[data-pbn]').value.trim() || cleanName(fl[i].name) || fl[i].name; add.push({ f: fl[i], title: nm, kind: li.querySelector('[data-pbk]').value }); });
      close(); if (!add.length) return;
      toast('<i class="bi bi-arrow-repeat"></i> Adding ' + add.length + ' papers …');
      add.reduce(function (p, a) { return p.then(function (done) { return storeFiles([a.f]).then(function (r) { if (r.files.length) done.push({ id: uid(), title: a.title.slice(0, 120), kind: a.kind, dateKind: (FORMS[a.kind] || {}).dk || 'expires', lead: '30', files: r.files, added: today() }); return done; }); }); }, Promise.resolve([]))
        .then(function (done) { var t = Fe.tools(); t.papers = (Array.isArray(t.papers) ? t.papers : []).concat(done); Fe.saveTools(t); loadHere();
          toast('<i class="bi bi-check2"></i> ' + done.length + ' papers added – open one to add its dates', function () { var t2 = Fe.tools(), ids = done.map(function (x) { return x.id; }); done.forEach(function (x) { (x.files || []).forEach(function (fm) { delF(fm.id); }); }); t2.papers = (t2.papers || []).filter(function (x) { return ids.indexOf(x.id) < 0; }); Fe.saveTools(t2); }); });
    });
  }
  document.addEventListener('change', function (e) { var i = e.target.closest('[data-pabulk]'); if (!i || !i.files.length) return; var l = Array.prototype.slice.call(i.files); i.value = ''; bulk(l); });
  /* on a computer: drop files on the Papers card */
  if (col) { var dz = $t('papers');
    dz.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') > -1) { e.preventDefault(); dz.classList.add('pa-drop'); } });
    dz.addEventListener('dragleave', function (e) { if (!dz.contains(e.relatedTarget)) dz.classList.remove('pa-drop'); });
    dz.addEventListener('drop', function (e) { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); dz.classList.remove('pa-drop'); bulk(e.dataTransfer.files); }); }

  /* ---------- receipts from the Home inventory, as tiles ---------- */
  var invDb = null;
  function invGet(id) {
    var loc = (invDb || (invDb = new Promise(function (res, rej) { var r = indexedDB.open('dash-inv', 1); r.onupgradeneeded = function () { r.result.createObjectStore('photos'); }; r.onsuccess = function () { res(r.result); }; r.onerror = rej; })))
      .then(function (d) { return new Promise(function (res) { var q = d.transaction('photos').objectStore('photos').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; });
    return loc.then(function (b) { return b || !window.FileSync ? b : window.FileSync.down(id); });
  }
  var rcUrls = {};
  function drawReceipts() {
    var el = $t('parcpt'); if (!el) return;
    var inv = Fe.on('house') ? Fe.list('hinv').filter(function (x) { return x && x.receipt; }) : [];
    if (!on() || !inv.length) { el.hidden = true; el.innerHTML = ''; return; }
    var by = {}; inv.forEach(function (x) { (by[x.receipt] = by[x.receipt] || []).push(x); });
    var ids = Object.keys(by).sort(function (a, b) { var A = by[a][0].bought || '', B = by[b][0].bought || ''; return A < B ? 1 : A > B ? -1 : 0; });
    var tot = inv.reduce(function (a, x) { return a + (+x.price || 0); }, 0);
    var h = '<section class="card kit-card" id="parcpt"><div class="card-head"><h2><i class="bi bi-receipt"></i> Receipts</h2><span class="muted pa-rsum">' + ids.length + (ids.length === 1 ? ' receipt' : ' receipts') + (tot ? ' · ' + kr(tot) : '') + '</span></div>' +
      '<ul class="pa-rgrid">' + ids.map(function (rid) { var l = by[rid], x = l[0], pdf = l.some(function (y) { return y.receiptPdf; }), pr = l.reduce(function (a, y) { return a + (+y.price || 0); }, 0);
        return '<li><a class="pa-rt" data-rcopen="' + esc(rid) + '" target="_blank" rel="noopener"><span class="pa-rth">' + (pdf ? '<i class="bi bi-file-earmark-pdf"></i>' : '<img data-rcimg="' + esc(rid) + '" alt=""><i class="bi bi-receipt"></i>') + '</span>' +
          '<b>' + esc(l.map(function (y) { return y.name; }).filter(Boolean).join(' + ') || 'Receipt') + '</b><small>' + esc([pr ? kr(pr) : '', x.bought ? fmt(x.bought, { day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ') || ' ') + '</small></a>' +
          '<a class="pa-rgo" href="/cmd/house/#hinv=' + esc(x.id) + '" aria-label="Open ' + esc(x.name || 'the item') + ' in Home inventory" title="Open in Home inventory"><i class="bi bi-box-arrow-up-right"></i></a></li>'; }).join('') + '</ul></section>';
    el.hidden = false;
    if (el._h !== h) { el._h = h; el.innerHTML = h;
      ids.forEach(function (rid) { invGet(rid).then(function (b) { if (!b) return; var u = rcUrls[rid] || (rcUrls[rid] = URL.createObjectURL(b.type ? b : new Blob([b], { type: by[rid].some(function (y) { return y.receiptPdf; }) ? 'application/pdf' : 'image/jpeg' }))); var a = el.querySelector('[data-rcopen="' + rid + '"]'); if (a) a.href = u; var im = el.querySelector('img[data-rcimg="' + rid + '"]'); if (im) { im.src = u; im.onload = function () { im.parentNode.classList.add('has-img'); }; } }); }); }
  }
  document.addEventListener('click', function (e) { var a = e.target.closest('[data-rcopen]'); if (a && !a.getAttribute('href')) { e.preventDefault(); toast('That receipt is only on the device it was added on – open House there once to sync it'); } });

  function redraw() { if (col) col.render(); drawSoon(); drawElse(); drawTiles(); drawReceipts(); }
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
    if (Fe.on('house')) { var inv = Fe.list('hinv'), rc = inv.filter(function (x) { return x.receipt; }).length; if (!rc) rows.push(['box-seam', '#22b35e', 'Receipts on home items', inv.length ? rc + ' of ' + inv.length + ' items have a receipt' : 'Photos and receipts for your valuables', '/cmd/house/#hinv']); }
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
  ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(drawTiles.t); drawTiles.t = setTimeout(function () { drawSoon(); drawElse(); drawTiles(); drawReceipts(); }, 30); }); });
  window.Vault.onUnlock(function () {
    setTimeout(function () {
      drawSoon(); drawElse(); drawTiles(); drawReceipts();
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
