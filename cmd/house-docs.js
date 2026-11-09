/* FDV binder (Nov 2026): the documents for your own home – purchase papers, drawings, manuals, product sheets,
   warranties, the housing association's papers – sorted by building part, on House → Docs.
   Import a whole download in one go: many PDFs at once, or a .zip (from Boligmappa, the builder's FDV portal …).
   Each file is put in a category from its name and folder – Norwegian and English words, NS 3451 codes at the
   start of a folder ("31 Sanitær", "43 Lavspent"), and what you chose before (a file you move teaches it the
   word). You check the list before anything is saved. Download it all again as a .zip, one folder per category.
   Files: house-files.js (fdv-…), synced encrypted like the rest. Data: dash.tools.hdocs = [{id, name, cat, file, date,
   notes, path, at}], dash.tools.hdocscat = { extra: [{id, name, kw}], kw: {cat: 'words'}, learn: {word: cat} }. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, HF = window.HouseFiles, el = document.querySelector('[data-tool="hdocs"]');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +(p[2] || 1)); }
  function today() { return dkey(new Date()); }
  function fmt(k) { return isKey(k) ? fromKey(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function on() { return Fe.on('house') && Fe.on('hdocs'); }
  function tr(s) { return window.I18N ? window.I18N.t(s) : s; }
  /* every document; list(h) = the ones for the home in view (or home h) – house-homes.js */
  function all() { return Fe.list('hdocs'); }
  function list(h) { var H = window.Homes; return all().filter(function (d) { return !H || H.belongs(d, h || H.view()); }); }
  function hview() { return window.Homes ? window.Homes.view() : undefined; }
  function ccfg() { var c = Fe.tools().hdocscat; c = c && typeof c === 'object' && !Array.isArray(c) ? c : {}; return { extra: Array.isArray(c.extra) ? c.extra.filter(function (x) { return x && x.id; }) : [], kw: c.kw && typeof c.kw === 'object' ? c.kw : {}, learn: c.learn && typeof c.learn === 'object' ? c.learn : {} }; }
  function setC(fn) { var t = Fe.tools(), c = ccfg(); fn(c); t.hdocscat = c; Fe.saveTools(t); }
  HF && HF.uses(function () { return all().map(function (d) { return d.file && d.file.id; }); });

  /* the categories, in the order a file is tested against them (first match wins) */
  var CATS = [
    ['sale', 'Purchase and take-over', 'file-earmark-text', '#a0673a', 'kjøpekontrakt kontrakt contract salgsoppgave prospekt tilstandsrapport takst verdivurdering overtakelse protokoll skjøte grunnbok egenerklæring boligsalgsrapport ferdigattest brukstillatelse midlertidig matrikkel purchase takeover deed survey'],
    ['assoc', 'Housing association', 'buildings', '#6b4bc4', 'borettslag sameie vedtekt husorden house rules årsberetning årsrapport generalforsamling innkalling styret felleskost association regnskap budsjett'],
    ['warranty', 'Warranties and receipts', 'receipt', '#c98500', 'garanti warranty kvittering receipt faktura invoice ordrebekreftelse order confirmation'],
    ['insurance', 'Insurance', 'shield-check', '#22b35e', 'forsikring insurance polise policy skadesak'],
    ['drawings', 'Drawings and plans', 'rulers', '#3987e5', 'tegning plantegning situasjonsplan snitt drawing floor plan floorplan arkitekt architect målsatt'],
    ['wet', 'Bathroom and wet rooms', 'droplet-half', '#0891b2', 'våtrom bad baderom bath bathroom membran membrane sluk drain flis tile dusj shower wc toalett toilet servant sanitær flislegger'],
    ['kitchen', 'Kitchen and appliances', 'cup-hot', '#e8743b', 'kjøkken kitchen hvitevare oppvask dishwasher komfyr cooker induksjon platetopp hob stekeovn oven kjøleskap fridge fryser freezer vaskemaskin washing tørketrommel dryer ventilator kjøkkenvifte hood microwave mikrobølge'],
    ['heating', 'Heating and ventilation', 'fan', '#e66767', 'varmepumpe heat pump ventilasjon ventilation balansert avtrekk ovn stove peis fireplace radiator gulvvarme underfloor termostat thermostat filter fjernvarme district heating luft-til'],
    ['electric', 'Electrical', 'lightning-charge', '#d9a400', 'elektro el-anlegg elanlegg elektrisk electric electrical samsvarserklæring sikring sikringsskap fuse kursfortegnelse jordfeil stikkontakt socket lysbryter belysning lighting elkontroll el-kontroll nek400 elektriker smarthus'],
    ['plumbing', 'Pipes and water', 'moisture', '#3b9de0', 'vvs rør pipe pipes plumbing vann water varmtvann bereder water heater stoppekran vannmåler avløp sewer lekkasje leak rørlegger vannstopp'],
    ['safety', 'Fire and safety', 'fire', '#e5484d', 'brann fire røyk smoke slukke extinguisher brannalarm alarm sikkerhet safety rømning evacuation'],
    ['building', 'Roof, facade and windows', 'house', '#7a6a58', 'tak roof takstein takrenne gutter fasade facade kledning cladding vindu window vinduer windows beslag grunnmur foundation drenering drainage isolasjon insulation konstruksjon structure tømrer snekker blikkenslager murer pipe chimney'],
    ['surfaces', 'Floors, walls and doors', 'grid-3x3', '#8a6fdf', 'gulv floor flooring parkett parquet laminat laminate maling paint vegg wall tapet wallpaper dør door innerdør listverk overflate himling ceiling trapp stair maler'],
    ['outdoor', 'Outdoors and garage', 'tree', '#2f9e57', 'hage garden terrasse deck garasje garage carport utvendig outdoor gjerde fence platting markise awning utelys'],
    ['fdv', 'FDV in general', 'journal-bookmark', '#0891b2', 'fdv fdvu drift vedlikehold maintenance manual bruksanvisning brukerveiledning veiledning produktdatablad datablad datasheet monteringsanvisning installation instructions'],
    ['other', 'Other', 'folder2', '#7a8794', '']];
  /* NS 3451 codes at the start of a folder or file name ("31 Sanitær", "43_Lavspent") */
  var NS = { 21: 'building', 22: 'building', 23: 'building', 24: 'surfaces', 25: 'surfaces', 26: 'building', 27: 'kitchen', 28: 'building', 29: 'building',
    31: 'plumbing', 32: 'heating', 33: 'safety', 34: 'plumbing', 35: 'heating', 36: 'heating', 37: 'heating', 39: 'plumbing',
    41: 'electric', 42: 'electric', 43: 'electric', 44: 'electric', 45: 'electric', 46: 'electric', 49: 'electric', 54: 'safety', 55: 'electric', 56: 'electric', 57: 'electric', 71: 'outdoor', 72: 'outdoor', 73: 'outdoor', 74: 'outdoor', 76: 'outdoor', 77: 'outdoor', 78: 'outdoor' };
  function cats() {
    var c = ccfg();
    return CATS.slice(0, -1).map(function (x) { return { id: x[0], name: x[1], icon: x[2], c: x[3], kw: x[4] + ' ' + (c.kw[x[0]] || '') }; })
      .concat(c.extra.map(function (x) { return { id: x.id, name: x.name, icon: 'folder', c: '#7a8794', kw: x.kw || '', own: true }; }))
      .concat([{ id: 'other', name: 'Other', icon: 'folder2', c: '#7a8794', kw: '' }]);
  }
  function cat(id) { return cats().filter(function (c) { return c.id === id; })[0] || cats()[cats().length - 1]; }
  function norm(s) { return String(s || '').toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '').replace(/[_\-.+()[\]{}&,;:]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  var STOP = 'with from and the for til med fra og for på av som eller document dokument file fil scan skann page side kopi copy versjon version final ny new img image bilde'.split(' ');
  function words(s) { return norm(s).split(' ').filter(function (w) { return w.length >= 4 && STOP.indexOf(w) < 0 && !/^\d+$/.test(w); }); }
  /* which category: learned words first, then NS 3451 codes on folders, then the words */
  function guess(name, path) {
    var c = ccfg(), segs = String(path || '').split('/').filter(Boolean), text = norm(segs.join(' ') + ' ' + name);
    var ws = words(name), i;
    for (i = 0; i < ws.length; i++) if (c.learn[ws[i]] && cat(c.learn[ws[i]]).id === c.learn[ws[i]]) return c.learn[ws[i]];
    var all = segs.concat([name]);
    for (i = all.length - 1; i >= 0; i--) { var m = String(all[i]).match(/^(?:ns\s?3451\s?)?(\d{2})\d?[\s._-]/i); if (m && NS[m[1]]) return NS[m[1]]; }
    /* "FDV" in a folder name says nothing (the whole download is FDV) – that one only counts in the file's own name */
    var L = cats(), own = norm(name);
    for (i = 0; i < L.length; i++) if (L[i].kw && phrase(L[i].id === 'fdv' ? own : text, L[i].kw)) return L[i].id;
    return 'other';
  }
  /* each keyword must start a word; keywords with a space ("heat pump") must appear as written */
  var kwCache = {};
  function phrase(text, kw) {
    var re = kwCache[kw];
    if (!re) {
      var parts = []; String(kw).replace(/\s+/g, ' ').trim().split(' ').forEach(function (w) { if (w.length > 1) parts.push(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); });
      /* known two-word ones */
      ['heat pump', 'water heater', 'floor plan', 'house rules', 'order confirmation', 'district heating', 'installation instructions'].forEach(function (p) { if (kw.indexOf(p) > -1) parts.unshift(p.replace(' ', '\\s')); });
      re = kwCache[kw] = new RegExp('(^|[^a-z0-9æøåäöü])(' + parts.join('|') + ')', 'i');
    }
    return re.test(text);
  }
  /* a moved file teaches its first good word (only when the word didn't already point somewhere else) */
  function learn(name, catId) {
    var ws = words(name); if (!ws.length) return;
    var w = ws[0];
    setC(function (c) { if (catId === 'other') delete c.learn[w]; else c.learn[w] = catId; var k = Object.keys(c.learn); if (k.length > 300) delete c.learn[k[0]]; });
  }

  /* ---------- the card ---------- */
  var filt = (function () { try { return sessionStorage.getItem('dash.hdFilt') || ''; } catch (e) { return ''; } })(), q = '', openId = null, showAll = false;
  function typing() { var a = document.activeElement; return a && el && el.contains(a) && a.matches('input[type="search"]'); }
  function draw() {
    if (!el) return;
    if (!on()) { el.hidden = true; if (el.innerHTML) { el.innerHTML = ''; el._h = ''; } return; }
    el.hidden = false;
    var L = list(), C = cats(), counts = {}; L.forEach(function (d) { var k = cat(d.cat).id; counts[k] = (counts[k] || 0) + 1; });
    var bytes = L.reduce(function (a, d) { return a + (+(d.file || {}).size || 0); }, 0);
    var shown = L.filter(function (d) { return (!filt || cat(d.cat).id === filt) && (!q || norm(d.name + ' ' + (d.notes || '') + ' ' + (d.file ? d.file.name : '') + ' ' + tr(cat(d.cat).name)).indexOf(norm(q)) > -1); })
      .sort(function (a, b) { return (cat(a.cat).name).localeCompare(cat(b.cat).name) || String(a.name).localeCompare(String(b.name)); });
    var lim = showAll || q || filt ? shown.length : 12;
    var html = '<section class="card kit-card hd-card" id="hdocs"><div class="card-head"><h2><i class="bi bi-journal-bookmark"></i> FDV binder</h2><div class="head-actions">' +
      (L.length ? '<button type="button" class="text-btn" data-hdzip aria-label="Download all as a zip"><i class="bi bi-file-earmark-zip"></i> Download</button>' : '') +
      '<button type="button" class="text-btn" data-hdcats aria-label="Categories"><i class="bi bi-sliders"></i></button><button type="button" class="text-btn" data-hdimport><i class="bi bi-plus-lg"></i> Import</button></div></div>' +
      (L.length ? '<div class="kit-tiles"><div class="kit-tile" data-tk="docs"><span>Documents</span><b>' + L.length + '</b><small>' + esc(HF ? HF.size(bytes) : '') + '</small></div>' +
        '<div class="kit-tile" data-tk="cats"><span>Categories</span><b>' + Object.keys(counts).length + '</b><small>' + (counts.other ? counts.other + ' in Other' : 'all sorted') + '</small></div>' +
        '<div class="kit-tile" data-tk="last"><span>Last added</span><b>' + esc(fmt(L.map(function (d) { return d.at; }).filter(isKey).sort().pop()).replace(/ \d{4}$/, '') || '–') + '</b><small>&nbsp;</small></div></div>' +
        '<div class="hd-cats">' + C.filter(function (c) { return counts[c.id]; }).map(function (c) { return '<button type="button" class="hd-cat" data-hdfilt="' + esc(c.id) + '" aria-pressed="' + (filt === c.id) + '" style="--c:' + c.c + '"><i class="bi bi-' + c.icon + '"></i><span' + (c.own ? ' data-noi18n' : '') + '>' + esc(c.name) + '</span><b>' + counts[c.id] + '</b></button>'; }).join('') + '</div>' +
        '<label class="hd-q"><i class="bi bi-search"></i><input type="search" placeholder="Find a document" value="' + esc(q) + '" data-hdq autocomplete="off" aria-label="Find a document"></label>' +
        (shown.length ? '<ul class="kit-list hd-list">' + shown.slice(0, lim).map(row).join('') + '</ul>' : '<p class="empty kit-empty">Nothing matches.</p>') +
        (shown.length > lim ? '<button type="button" class="text-btn kit-more" data-hdmore>Show all ' + shown.length + '</button>' : '') +
        (filt ? '<div class="hl-acts"><button type="button" class="text-btn" data-hdzip="' + esc(filt) + '"><i class="bi bi-file-earmark-zip"></i> Download this category</button><button type="button" class="text-btn" data-hdfilt="' + esc(filt) + '"><i class="bi bi-x"></i> Show all</button></div>' : '')
        : '<p class="empty kit-empty">Keep the papers for your home in one place – manuals, drawings, product sheets, warranties, the take-over protocol. Got a login to an FDV portal or Boligmappa? Download everything, then import the files or the .zip here: they’re sorted by building part for you.</p>' +
          '<div class="hl-acts"><button type="button" class="pill-btn" data-hdimport><i class="bi bi-upload"></i> Import documents</button></div>') +
      '</section>';
    if (el._h !== html) { var y = typing(), pos = y ? document.activeElement.selectionStart : 0; el._h = html; el.innerHTML = html; if (y) { var i = el.querySelector('[data-hdq]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} } } }
    if (HF) HF.fill(el);
  }
  function icon(d) { var t = (d.file || {}).type, n = String((d.file || {}).name || ''); return t === 'img' ? 'file-earmark-image' : t === 'pdf' ? 'file-earmark-pdf' : /\.(docx?|odt)$/i.test(n) ? 'file-earmark-word' : /\.(xlsx?|ods|csv)$/i.test(n) ? 'file-earmark-spreadsheet' : /\.(dwg|dxf|ifc)$/i.test(n) ? 'file-earmark-ruled' : 'file-earmark'; }
  function row(d) {
    var c = cat(d.cat), open = openId === d.id, f = d.file || {};
    return '<li class="kit-item' + (open ? ' open' : '') + '" data-id="' + esc(d.id) + '"><button type="button" class="kit-main" data-hdopen="' + esc(d.id) + '"><span class="kit-ic" style="--c:' + c.c + '"><i class="bi bi-' + icon(d) + '"></i></span>' +
      '<span class="kit-x"><b data-noi18n>' + esc(d.name) + (d.share && window.ShareSpace && window.ShareSpace.kitRow && window.ShareSpace.kitRow('hdocs') ? ' <i class="bi bi-people sh-ic" title="Shared"></i>' : '') + '</b><small><span' + (c.own ? ' data-noi18n' : '') + '>' + esc(c.name) + '</span>' + esc([HF ? ' · ' + HF.size(f.size) : '', d.date ? ' · ' + fmt(d.date) : ''].join('')) + '</small></span></button>' +
      (open ? '<div class="kit-detail hd-detail">' +
        '<div class="hl-acts"><a class="pill-btn hf-wait" data-hfopen="' + esc(f.id) + '" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Open</a><a class="text-btn hf-wait" data-hfopen="' + esc(f.id) + '" download="' + esc(f.name || d.name) + '"><i class="bi bi-download"></i> Download</a></div>' +
        '<label class="hx-f"><span>Category</span><select data-hdcat="' + esc(d.id) + '">' + cats().map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="hx-f"><span>Name</span><input data-hdname="' + esc(d.id) + '" value="' + esc(d.name) + '" maxlength="160"></label>' +
        '<label class="hx-f"><span>Notes</span><textarea rows="2" data-hdnotes="' + esc(d.id) + '" maxlength="600" placeholder="e.g. Which room, the model, who installed it">' + esc(d.notes || '') + '</textarea></label>' +
        '<p class="muted hl-small" data-noi18n>' + esc(f.name || '') + (d.path ? ' · ' + esc(d.path) : '') + '</p>' +
        (window.ShareSpace && window.ShareSpace.kitRow && window.ShareSpace.kitRow('hdocs') ? '<label class="tp-share"><span><i class="bi bi-people"></i> ' + esc(window.ShareSpace.kitRow('hdocs')) + '<small>' + esc(window.ShareSpace.kitHelp('hdocs')) + '</small></span><input type="checkbox" class="switch" data-hdshare="' + esc(d.id) + '"' + (d.share ? ' checked' : '') + '></label>' : '') +
        '<button type="button" class="text-btn danger" data-hddel="' + esc(d.id) + '"><i class="bi bi-trash3"></i> <span>Delete</span></button></div>' : '') + '</li>';
  }
  function saveDoc(id, fn) { var t = Fe.tools(); (t.hdocs || []).forEach(function (d) { if (d && d.id === id) fn(d); }); Fe.saveTools(t); }
  if (el) {
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-hdopen]'))) { openId = openId === b.dataset.hdopen ? null : b.dataset.hdopen; return draw(); }
      if ((b = e.target.closest('[data-hdfilt]'))) { filt = filt === b.dataset.hdfilt ? '' : b.dataset.hdfilt; try { sessionStorage.setItem('dash.hdFilt', filt); } catch (x) {} return draw(); }
      if (e.target.closest('[data-hdmore]')) { showAll = true; return draw(); }
      if (e.target.closest('[data-hdimport]')) return importSheet();
      if (e.target.closest('[data-hdcats]')) return catSheet();
      if ((b = e.target.closest('[data-hdzip]'))) return zipAll(b.dataset.hdzip || '');
      if ((b = e.target.closest('[data-hddel]'))) {
        if (!b.dataset.armed) { b.dataset.armed = 1; b.querySelector('span').textContent = tr('Tap again to delete'); return; }
        return remove(b.dataset.hddel);
      }
    });
    el.addEventListener('input', function (e) { if (e.target.matches('[data-hdq]')) { q = e.target.value; clearTimeout(draw.qt); draw.qt = setTimeout(draw, 120); } });
    el.addEventListener('change', function (e) {
      var c = e.target, id;
      if ((id = c.dataset.hdcat)) { var d = list().filter(function (x) { return x.id === id; })[0]; saveDoc(id, function (x) { x.cat = c.value; }); if (d) learn(d.file && d.file.name || d.name, c.value); toast('<i class="bi bi-folder-check"></i> Moved – files with a name like this go there next time'); return; }
      if ((id = c.dataset.hdname)) { var v = c.value.trim(); if (v) saveDoc(id, function (x) { x.name = v.slice(0, 160); }); return; }
      if ((id = c.dataset.hdnotes)) saveDoc(id, function (x) { x.notes = c.value.trim().slice(0, 600); });
    });
  }
  function remove(id, quiet) {
    var t = Fe.tools(), old = JSON.parse(JSON.stringify(t.hdocs || [])), d = (t.hdocs || []).filter(function (x) { return x && x.id === id; })[0]; if (!d) return;
    t.hdocs = (t.hdocs || []).filter(function (x) { return x && x.id !== id; }); Fe.saveTools(t);
    if (d.file) HF.release(d.file.id);
    if (!quiet) toast('<i class="bi bi-trash3"></i> Deleted', function () { var t2 = Fe.tools(); t2.hdocs = old; Fe.saveTools(t2); });
  }

  /* ---------- reading a .zip (stored or deflated – what Windows, macOS and the portals make) ---------- */
  function readZip(file) {
    return file.arrayBuffer().then(function (buf) {
      var v = new DataView(buf), u8 = new Uint8Array(buf), n = buf.byteLength, eocd = -1;
      for (var i = n - 22; i >= Math.max(0, n - 70000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      if (eocd < 0) throw new Error('not a zip');
      var count = v.getUint16(eocd + 10, true), off = v.getUint32(eocd + 16, true), out = [];
      var dec8 = new TextDecoder('utf-8');
      for (var k = 0; k < count && off + 46 <= n; k++) {
        if (v.getUint32(off, true) !== 0x02014b50) break;
        var flags = v.getUint16(off + 8, true), method = v.getUint16(off + 10, true), csize = v.getUint32(off + 20, true), usize = v.getUint32(off + 24, true);
        var nl = v.getUint16(off + 28, true), xl = v.getUint16(off + 30, true), cl = v.getUint16(off + 32, true), loc = v.getUint32(off + 42, true);
        /* names are UTF-8 (flag 0x800, or most zips today); old Windows zips use code page 437 – keep ASCII, and Latin-1 for æøå */
        var nameBytes = u8.subarray(off + 46, off + 46 + nl), name;
        try { name = new TextDecoder('utf-8', { fatal: !(flags & 0x800) }).decode(nameBytes); } catch (e) { name = Array.prototype.map.call(nameBytes, function (b) { return String.fromCharCode(b === 0x91 ? 230 : b === 0x9B ? 248 : b === 0x86 ? 229 : b === 0x92 ? 198 : b === 0x9D ? 216 : b === 0x8F ? 197 : b < 128 ? b : 95); }).join(''); }
        off += 46 + nl + xl + cl;
        if (/\/$/.test(name) || /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)(\/|$)/i.test(name) || /(^|\/)\._/.test(name)) continue;
        var lnl = v.getUint16(loc + 26, true), lxl = v.getUint16(loc + 28, true), start = loc + 30 + lnl + lxl;
        out.push({ name: name.split('/').pop(), path: name.split('/').slice(0, -1).join('/'), method: method, data: u8.subarray(start, start + csize), size: usize });
      }
      return out;
    });
  }
  function unzipOne(z, type) {
    if (z.method === 0) return Promise.resolve(new Blob([z.data], { type: type }));
    if (z.method !== 8 || typeof DecompressionStream === 'undefined') return Promise.reject(new Error('method'));
    var ds = new DecompressionStream('deflate-raw');
    return new Response(new Blob([z.data]).stream().pipeThrough(ds)).arrayBuffer().then(function (b) { return new Blob([b], { type: type }); });
  }
  function mime(n) { n = String(n).toLowerCase(); return /\.pdf$/.test(n) ? 'application/pdf' : /\.jpe?g$/.test(n) ? 'image/jpeg' : /\.png$/.test(n) ? 'image/png' : /\.heic$/.test(n) ? 'image/heic' : /\.webp$/.test(n) ? 'image/webp' : /\.docx$/.test(n) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : /\.xlsx$/.test(n) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : /\.txt$/.test(n) ? 'text/plain' : 'application/octet-stream'; }
  var OK = /\.(pdf|jpe?g|png|heic|heif|webp|gif|docx?|xlsx?|odt|ods|txt|rtf|dwg|dxf|ifc|csv|msg|eml)$/i;

  /* ---------- making a .zip (stored – PDFs are compressed already) ---------- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function makeZip(entries) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0, d = new Date();
    var dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    entries.forEach(function (e) {
      var nm = enc.encode(e.path), crc = crc32(e.data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(8, 0, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true);
      h.setUint32(14, crc, true); h.setUint32(18, e.data.length, true); h.setUint32(22, e.data.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nm, e.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(10, 0, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true);
      c.setUint32(16, crc, true); c.setUint32(20, e.data.length, true); c.setUint32(24, e.data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nm);
      off += 30 + nm.length + e.data.length;
    });
    var csize = central.reduce(function (a, x) { return a + x.length; }, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }
  function safe(s) { return String(s || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file'; }
  function zipAll(only, hid) {
    var L = list(hid).filter(function (d) { return d.file && (!only || cat(d.cat).id === only); }); if (!L.length) return;
    toast('<i class="bi bi-hourglass-split"></i> Packing ' + L.length + (L.length === 1 ? ' document' : ' documents') + ' …');
    var used = {}, entries = [], missing = 0;
    L.reduce(function (p, d) {
      return p.then(function () {
        return HF.get(d.file.id).then(function (b) {
          if (!b) { missing++; return; }
          return b.arrayBuffer().then(function (ab) {
            var folder = safe(tr(cat(d.cat).name)), fname = safe(d.file.name || d.name), ext = (fname.match(/\.[a-z0-9]{2,5}$/i) || [''])[0];
            if (!ext) fname += d.file.type === 'pdf' ? '.pdf' : d.file.type === 'img' ? '.jpg' : '';
            var path = folder + '/' + fname, n = 2; while (used[path.toLowerCase()]) { path = folder + '/' + fname.replace(/(\.[a-z0-9]{2,5})?$/i, ' (' + (n++) + ')$1'); } used[path.toLowerCase()] = 1;
            entries.push({ path: path, data: new Uint8Array(ab) });
          });
        });
      });
    }, Promise.resolve()).then(function () {
      if (!entries.length) return toast('<i class="bi bi-exclamation-triangle"></i> The files aren’t on this device yet – open the House page while online and try again');
      var idx = '﻿' + [['Category', 'Name', 'File', 'Date', 'Notes'].join(';')].concat(L.map(function (d) { return [tr(cat(d.cat).name), d.name, d.file.name, d.date || '', (d.notes || '').replace(/[\r\n;]+/g, ' ')].map(function (v) { v = String(v); return /[;"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); })).join('\r\n');
      entries.unshift({ path: (window.I18N && window.I18N.lang === 'nb' ? 'Innhold' : 'Contents') + '.csv', data: new TextEncoder().encode(idx) });
      var z = makeZip(entries), nm = 'FDV-' + (only ? safe(tr(cat(only).name)) + '-' : '') + today() + '.zip';
      var a = document.createElement('a'); a.href = URL.createObjectURL(z); a.download = nm; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      toast('<i class="bi bi-file-earmark-zip"></i> ' + esc(nm) + ' · ' + esc(HF.size(z.size)) + (missing ? ' – ' + missing + ' not on this device yet' : ''));
    });
  }

  /* ---------- import: pick files or a zip → check the sorting → save ---------- */
  function importSheet(preset) {
    var X = HF.sheet('Import documents', 'hd-box'), rows = [], have = {};
    list().forEach(function (d) { if (d.file) have[String(d.file.name).toLowerCase() + '|' + d.file.size] = 1; });
    function first() {
      X.box.innerHTML = HF.head('upload', 'Import documents', 'PDFs, photos, Word or Excel files – or a whole .zip. Nothing is saved until you’ve checked the list.') +
        '<div class="hd-pick"><label class="pill-btn"><i class="bi bi-files"></i> Choose files<input type="file" multiple data-hdin hidden></label>' +
        '<label class="text-btn"><i class="bi bi-file-earmark-zip"></i> A .zip<input type="file" accept=".zip,application/zip,application/x-zip-compressed" data-hdin hidden></label></div>' +
        '<div class="hd-drop" data-hddrop><i class="bi bi-cloud-arrow-down"></i><span>Or drop files here</span></div>' +
        '<p class="muted hs2-note"><i class="bi bi-info-circle"></i> On the iPhone: download from the portal in Safari, then choose the files from Files → Downloads. Up to 20 MB a file; they’re encrypted and synced to your other devices.</p>';
    }
    function review() {
      var C = cats(), n = rows.filter(function (r) { return r.on; }).length, by = {};
      rows.forEach(function (r) { if (r.on) by[r.cat] = (by[r.cat] || 0) + 1; });
      X.box.innerHTML = HF.head('list-check', rows.length + (rows.length === 1 ? ' file' : ' files'), 'Check where each one goes – change the ones that are wrong.') +
        '<p class="hd-sum">' + C.filter(function (c) { return by[c.id]; }).map(function (c) { return '<span class="hl-chip" style="--c:' + c.c + '"><i class="bi bi-' + c.icon + '"></i> ' + esc(c.name) + ' ' + by[c.id] + '</span>'; }).join(' ') + '</p>' +
        '<ul class="hd-rev">' + rows.map(function (r, i) {
          return '<li class="' + (r.on ? '' : 'off') + '"><label class="hd-ron"><input type="checkbox" data-hdon="' + i + '"' + (r.on ? ' checked' : '') + ' aria-label="Import this one"></label><span class="hd-rn"><b data-noi18n>' + esc(r.name) + '</b><small>' + esc((r.path ? r.path + ' · ' : '') + HF.size(r.size)) + (r.why ? ' · <em>' + esc(r.why) + '</em>' : '') + '</small></span>' +
            '<select data-hdrc="' + i + '" aria-label="Category">' + C.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === r.cat ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></li>';
        }).join('') + '</ul>' +
        '<div class="lf-foot"><button type="button" class="text-btn" data-hdback><i class="bi bi-arrow-left"></i> Other files</button><button type="button" class="pill-btn" data-hdgo' + (n ? '' : ' disabled') + '><i class="bi bi-check2"></i> Import ' + n + '</button></div>';
    }
    function take(files) {
      var list0 = Array.prototype.slice.call(files || []), zips = list0.filter(function (f) { return /\.zip$/i.test(f.name) || /zip/.test(f.type || ''); }), plain = list0.filter(function (f) { return zips.indexOf(f) < 0; });
      X.box.innerHTML = HF.head('hourglass-split', 'Reading …') + '<p class="muted">Opening ' + list0.length + (list0.length === 1 ? ' file' : ' files') + ' …</p>';
      rows = [];
      plain.forEach(function (f) { add(f.name, '', f.size, function () { return Promise.resolve(f); }); });
      zips.reduce(function (p, z) {
        return p.then(function () {
          return readZip(z).then(function (es) {
            es.forEach(function (e) { add(e.name, e.path, e.size, function () { return unzipOne(e, mime(e.name)).then(function (b) { return new File([b], e.name, { type: mime(e.name) }); }); }); });
          }, function () { rows.push({ name: z.name, path: '', size: z.size, cat: 'other', on: false, why: 'couldn’t open this zip', get: null }); });
        });
      }, Promise.resolve()).then(function () {
        if (!rows.length) { first(); return toast('<i class="bi bi-exclamation-triangle"></i> Nothing to import there'); }
        rows.sort(function (a, b) { return (a.path + '/' + a.name).localeCompare(b.path + '/' + b.name); });
        review();
      });
    }
    function add(name, path, sz, get) {
      var why = '', on = true;
      if (!OK.test(name)) { why = 'this kind of file isn’t kept'; on = false; }
      else if (sz > 20e6) { why = 'over 20 MB'; on = false; }
      else if (have[String(name).toLowerCase() + '|' + sz]) { why = 'already in the binder'; on = false; }
      var nice = String(name).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
      rows.push({ name: nice || name, file: name, path: path, size: sz, cat: preset && preset.cat || guess(name, path), on: on, why: why, get: get });
    }
    function go() {
      var pick = rows.filter(function (r) { return r.on && r.get; }), done = 0, saved = [], bad = [];
      X.box.innerHTML = HF.head('hourglass-split', 'Importing …') + '<p class="muted hd-pr">0 of ' + pick.length + '</p><span class="stack"><span style="width:0%;background:var(--accent)"></span></span>';
      var pr = X.box.querySelector('.hd-pr'), bar = X.box.querySelector('.stack span');
      pick.reduce(function (p, r) {
        return p.then(function () {
          return r.get().then(function (f) { return HF.put(f, 'fdv', { any: true, max: 2200, noUp: true }); }).then(function (m) {
            saved.push({ id: uid(), home: hview(), name: r.name.slice(0, 160), cat: r.cat, file: m, date: '', notes: '', path: r.path ? r.path.slice(0, 200) : '', at: today() });
          }, function () { bad.push(r.name); }).then(function () { done++; pr.textContent = done + ' of ' + pick.length; bar.style.width = (done / pick.length * 100).toFixed(1) + '%'; });
        });
      }, Promise.resolve()).then(function () {
        var t = Fe.tools(); t.hdocs = (Array.isArray(t.hdocs) ? t.hdocs : []).concat(saved); Fe.saveTools(t);
        HF.upQueue(saved.map(function (d) { return d.file.id; }));
        X.close();
        toast('<i class="bi bi-journal-check"></i> ' + saved.length + (saved.length === 1 ? ' document' : ' documents') + ' in the FDV binder' + (bad.length ? ' – ' + bad.length + ' couldn’t be read' : '') + (saved.length > 150 ? ' · uploading in the background' : ''));
        filt = ''; draw();
      });
    }
    first();
    X.box.addEventListener('change', function (e) {
      var c = e.target;
      if (c.matches('[data-hdin]') && c.files && c.files.length) { var fs = c.files; take(fs); c.value = ''; return; }
      if (c.dataset.hdon != null) { rows[+c.dataset.hdon].on = c.checked; return review(); }
      if (c.dataset.hdrc != null) { var r = rows[+c.dataset.hdrc]; r.cat = c.value; learn(r.file || r.name, c.value); return review(); }
    });
    X.box.addEventListener('click', function (e) {
      if (e.target.closest('[data-hdback]')) return first();
      if (e.target.closest('[data-hdgo]')) return go();
    });
    X.box.addEventListener('dragover', function (e) { if (e.target.closest('[data-hddrop]')) { e.preventDefault(); e.target.closest('[data-hddrop]').classList.add('on'); } });
    X.box.addEventListener('dragleave', function (e) { var d = e.target.closest('[data-hddrop]'); if (d) d.classList.remove('on'); });
    X.box.addEventListener('drop', function (e) { if (!e.target.closest('[data-hddrop]')) return; e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) take(e.dataTransfer.files); });
  }

  /* ---------- categories: your own, and extra words for the built-in ones ---------- */
  function catSheet() {
    var X = HF.sheet('Categories', 'hd-box');
    function drawC() {
      var c = ccfg(), learned = Object.keys(c.learn).length;
      X.box.innerHTML = HF.head('sliders', 'Categories', 'Files are sorted by words in their name and folder. Add your own words, or a category of your own.') +
        '<ul class="hd-cl">' + CATS.slice(0, -1).map(function (x) {
          return '<li><span class="kit-ic" style="--c:' + x[3] + '"><i class="bi bi-' + x[2] + '"></i></span><label class="hx-f"><span>' + esc(x[1]) + '</span><input data-hdkw="' + esc(x[0]) + '" value="' + esc(c.kw[x[0]] || '') + '" placeholder="Your own words, e.g. ' + esc(x[4].split(' ').slice(0, 2).join(', ')) + '" maxlength="200" autocomplete="off"></label></li>';
        }).join('') + c.extra.map(function (x) {
          return '<li><span class="kit-ic" style="--c:#7a8794"><i class="bi bi-folder"></i></span><label class="hx-f"><span data-noi18n>' + esc(x.name) + '</span><input data-hdxkw="' + esc(x.id) + '" value="' + esc(x.kw || '') + '" placeholder="Words that belong here" maxlength="200" autocomplete="off"></label><button type="button" class="icon-btn sm" data-hdxdel="' + esc(x.id) + '" aria-label="Remove the category"><i class="bi bi-x"></i></button></li>';
        }).join('') + '</ul>' +
        '<form class="hx-row" data-hdxadd><input name="n" placeholder="A category of your own, e.g. Boat" maxlength="40" autocomplete="off"><button type="submit" class="icon-btn sm" aria-label="Add"><i class="bi bi-plus-lg"></i></button></form>' +
        (learned ? '<p class="muted hs2-note">Learned from your moves: ' + learned + (learned === 1 ? ' word' : ' words') + '. <button type="button" class="text-btn" data-hdforget>Forget them</button></p>' : '') +
        '<p class="muted hs2-note">NS 3451 folder codes (21–29 building, 31–39 VVS, 41–49 electrical, 7x outdoors) are recognised too.</p>';
    }
    drawC();
    X.box.addEventListener('change', function (e) {
      var c = e.target, id;
      if ((id = c.dataset.hdkw)) { var v = c.value.toLowerCase().replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim(); setC(function (x) { if (v) x.kw[id] = v; else delete x.kw[id]; }); kwCache = {}; }
      if ((id = c.dataset.hdxkw)) { var w = c.value.toLowerCase().replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim(); setC(function (x) { x.extra.forEach(function (y) { if (y.id === id) y.kw = w; }); }); kwCache = {}; }
    });
    X.box.addEventListener('submit', function (e) { var f = e.target.closest('[data-hdxadd]'); if (!f) return; e.preventDefault(); var n = f.n.value.trim(); if (!n) return; setC(function (x) { x.extra.push({ id: 'x' + uid(), name: n.slice(0, 40), kw: n.toLowerCase() }); }); drawC(); });
    X.box.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-hdxdel]'))) { var id = b.dataset.hdxdel, n = list().filter(function (d) { return d.cat === id; }).length; setC(function (x) { x.extra = x.extra.filter(function (y) { return y.id !== id; }); }); toast('<i class="bi bi-folder-x"></i> Category removed' + (n ? ' – its ' + n + ' documents are under Other' : '')); drawC(); }
      if (e.target.closest('[data-hdforget]')) { setC(function (x) { x.learn = {}; }); drawC(); }
    });
  }

  /* one file from elsewhere (the take-over guide's signed protocol) */
  function addFile(file, o) {
    o = o || {};
    return HF.put(file, 'fdv', { any: true, max: 2200 }).then(function (m) {
      var d = { id: uid(), home: o.home || hview(), name: (o.name || String(file.name).replace(/\.[a-z0-9]{2,5}$/i, '')).slice(0, 160), cat: o.cat || guess(file.name, ''), file: m, date: o.date || '', notes: o.notes || '', path: '', at: today() };
      var t = Fe.tools(); t.hdocs = (Array.isArray(t.hdocs) ? t.hdocs : []).concat([d]); Fe.saveTools(t);
      return d.id;
    });
  }

  /* ---------- the rest of the dashboard ---------- */
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() ? [{ i: 'journal-bookmark', t: 'FDV binder – import documents', s: 'House · Docs', run: function () { if (el) { if (window.PageTabs) window.PageTabs.show('docs', true); importSheet(); } else location.href = '/cmd/house/#hdocs'; }, x: 'fdv binder documents dokumenter manual bruksanvisning boligmappa import zip drawings tegninger' }] : [];
  });
  /* search finds documents by name, category and notes */
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    if (!on()) return;
    all().forEach(function (d) { add('FDV binder', 'journal-bookmark', d.name, tr(cat(d.cat).name), '/cmd/house/#hdocs', '', (d.notes || '') + ' ' + (d.file ? d.file.name : '') + ' fdv'); });
  });
  ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(draw.t); draw.t = setTimeout(draw, 40); }); });
  window.Vault.onUnlock(function () { setTimeout(draw, 80); });
  window.Vault.onLock(function () { if (el) { el.innerHTML = ''; el._h = ''; el.hidden = true; } openId = null; q = ''; });
  window.HouseDocs = { addFile: addFile, remove: remove, guess: guess, list: list, all: all, importSheet: importSheet, zip: zipAll, _zip: { make: makeZip, read: readZip, unzip: unzipOne } };
})();
