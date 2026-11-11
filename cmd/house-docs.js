/* FDV binder (Nov 2026): the documents for your own home – purchase papers, drawings, manuals, product sheets,
   warranties, the housing association's papers – sorted by building part, on House → Docs.
   Import a whole download in one go: many PDFs at once, or a .zip (from Boligmappa, the builder's FDV portal …).
   Each file is put in a category from its name and folder – Norwegian and English words, NS 3451 codes at the
   start of a folder ("31 Sanitær", "43 Lavspent"), and what you chose before (a file you move teaches it the
   word). You check the list before anything is saved. Download it all again as a .zip, one folder per category.
   Files: house-files.js (fdv-…), synced encrypted like the rest. Data: dash.tools.hdocs = [{id, name, cat, file, date,
   notes, path, at}], dash.tools.hdocscat = { extra: [{id, name, kw}], kw: {cat: 'words'}, learn: {word: cat} }. */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in house-docs.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["docs"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  var HF = window.HouseFiles;
  function on() { return Fe.on('house') && Fe.on('hdocs'); }
  function tr(s) { return window.I18N ? window.I18N.t(s) : s; }
  function all() { return Fe.list('hdocs'); }
  function list(h) { var H = window.Homes; return all().filter(function (d) { return !H || H.belongs(d, h || H.view()); }); }
  function ccfg() { var c = Fe.tools().hdocscat; c = c && typeof c === 'object' && !Array.isArray(c) ? c : {}; return { extra: Array.isArray(c.extra) ? c.extra.filter(function (x) { return x && x.id; }) : [], kw: c.kw && typeof c.kw === 'object' ? c.kw : {}, learn: c.learn && typeof c.learn === 'object' ? c.learn : {} }; }
  HF && HF.uses(function () { return all().map(function (d) { return d.file && d.file.id; }); });
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
  var kwCache = {};
  function kwReset() { kwCache = {}; }      /* the page part changes the key words */
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
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() ? [{ i: 'journal-bookmark', t: 'FDV binder – import documents', s: 'House · Docs', run: function () { if (__ui().el) { if (window.PageTabs) window.PageTabs.show('docs', true); __ui().importSheet(); } else location.href = '/cmd/house/#hdocs'; }, x: 'fdv binder documents dokumenter manual bruksanvisning boligmappa import zip drawings tegninger' }] : [];
  });
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    if (!on()) return;
    all().forEach(function (d) { add('FDV binder', 'journal-bookmark', d.name, tr(cat(d.cat).name), '/cmd/house/#hdocs', '', (d.notes || '') + ' ' + (d.file ? d.file.name : '') + ' fdv'); });
  });
  window.HouseDocs = { guess: guess, list: list, all: all };
  (window.__core = window.__core || {})["docs"] = { kwReset: kwReset, cat: cat, cats: cats, CATS: CATS, ccfg: ccfg, Fe: Fe, tr: tr, all: all, on: on, HF: HF, list: list, guess: guess, phrase: phrase, kwCache: kwCache, NS: NS, words: words, STOP: STOP, norm: norm };
})();
