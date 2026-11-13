/* Work, batch 4 (Oct 2026):
     FDV templates  – phrases per building part (built-in + your own) inserted with one tap while on site,
                      your own building parts, and the form remembers the last part and grade.
     Offline        – the FDV card says clearly when you're offline (everything is kept on the phone)
                      and shows "Synced ✓" when it's back online.
     Invoice draft  – from Time per client: hours × rate for one client and month, as an A4 page
                      (same look as the FDV report) – Save as PDF from the print sheet.
   Data in dash.tools: fdvph (your phrases), fdvparts (your building parts), ptcfg (invoice details). */
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in work-plus.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["work"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function myPhrases() { var l = Fe.tools().fdvph; return Array.isArray(l) ? l : []; }
  /* lines like "231 Name", "231.000 | 2341.000 | Name" or a table pasted with tabs – the longest code on a line wins; reserved and empty rows are skipped */
  function parseCodes(txt) {
    var seen = {}, out = [];
    String(txt || '').split(/\r?\n/).forEach(function (ln) {
      ln = ln.trim(); if (!ln || ln[0] === '#') return;
      var code = '', name = '';
      if (/[|\t;]/.test(ln)) { ln.split(/[|\t;]/).map(function (x) { return x.trim(); }).forEach(function (x) { var m = x.match(/^(\d{3,4})(?:[.,]0+)?$/); if (m) { if (m[1].length >= code.length) code = m[1]; } else if (x) name = x; }); }
      else { var m2 = ln.match(/^(\d{3,4})(?:[.,]0+)?\s*[-–:.]?\s*(.*)$/); if (m2) { code = m2[1]; name = m2[2]; } }
      name = name.replace(/\s+/g, ' ').replace(/\.$/, '').trim();
      if (!code || seen[code] || /^\(?reservert\)?$/i.test(name)) return;
      seen[code] = 1; out.push({ c: code, n: name.slice(0, 100) });
    });
    return out.sort(function (a, b) { return a.c < b.c ? -1 : 1; }).slice(0, 3000);
  }
  function myCodes() { var l = Fe.tools().fdvcodes; return Array.isArray(l) ? l.filter(function (c) { return c && c.c; }) : []; }
  function myParts() { var l = Fe.tools().fdvparts; return Array.isArray(l) ? l.filter(Boolean) : []; }
  (window.CommandExtra = window.CommandExtra || []).push(function () { return Fe.on('ptime') ? [{ i: 'receipt', t: 'Invoice draft', s: 'From Time per client', run: function () { if (document.querySelector('[data-tool="ptime"]')) __ui().invoiceSheet(); else location.href = '/cmd/work/#ptime'; }, x: 'invoice faktura bill hours timer' }] : []; });
  (function () {
    var pg = document.querySelector('.st-page[data-page="work"]'); if (!pg) return;
    function fill() {
      var box = document.getElementById('wpSet');
      if (!Fe.on('fdv')) { if (box) box.remove(); return; }
      if (!box) { box = document.createElement('div'); box.id = 'wpSet'; pg.appendChild(box); }
      if (box.contains(document.activeElement)) return;
      var ph = myPhrases();
      box.innerHTML = '<p class="st-sub ap-sub"><i class="bi bi-building-check"></i> <span data-t="ui.fdv-inspections">FDV inspections</span></p><div class="st-group">' +
        '<div class="cl-group cl-group-text kit-text wp-codes"><span class="kit-lbl" data-t="ui.your-ns-3451-codes">Your own NS 3451 codes</span>' +
          '<div class="wp-crow"><span class="st-rsub">' + esc(myCodes().length ? I18N.k('ui.n-codes', '{n} codes', { n: myCodes().length }) : I18N.k('ui.no-codes-yet', 'None yet')) + '</span><label class="text-btn"><i class="bi bi-upload"></i> <span data-t="ui.import-codes">Import codes</span><input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" data-wpcfile hidden></label></div>' +
          '<details class="wp-cdet"><summary data-t="ui.show-and-edit-the-list">Show and edit the list</summary><textarea data-wpcodes rows="8" placeholder="One per line, e.g. 231 Load-bearing outer walls" data-t-placeholder="ui.one-per-line-e-g-231" maxlength="200000">' + esc(myCodes().map(function (c) { return c.c + ' ' + (c.n || ''); }).join('\n')) + '</textarea></details>' +
          '<small class="kit-help" data-t="ui.ns-codes-help-2">Three- and four-digit codes from your copy of the standard – a file or pasted lines like “231 Bærende yttervegger” (a table copied with the codes in columns works too). They show under their group in every inspection.</small></div>' +
        '<div class="cl-group cl-group-text kit-text wp-parts"><span class="kit-lbl" data-t="ui.your-own-places">Your own places</span><textarea data-wpparts rows="3" placeholder="One per line, e.g. Garage, Balcony, Lift" data-t-placeholder="ui.one-per-line-e-g-garage-balcony-lift" maxlength="1000">' + esc(myParts().join('\n')) + '</textarea><small class="kit-help" data-t="ui.places-help">Suggested in the “Where” field of every finding.</small></div>' +
        '<div class="st-row"><span><span data-t="ui.your-phrases">Your phrases</span><small class="st-rsub">' + (ph.length ? ph.length + ' saved – remove them on the chips in an inspection' : I18N.k('ui.save-one-with-star-in-an-inspection', 'Save one with ☆ in an inspection')) + '</small></span></div></div>';
    }
    pg.addEventListener('change', function (e) {
      if (e.target.matches('[data-wpcodes]')) { var l0 = parseCodes(e.target.value); var t0 = Fe.tools(); t0.fdvcodes = l0; Fe.saveTools(t0); toast('<i class="bi bi-check2"></i> ' + esc(I18N.k('ui.n-codes', '{n} codes', { n: l0.length }))); fill(); return; }
      if (e.target.matches('[data-wpcfile]') && e.target.files[0]) {
        var rd = new FileReader(); rd.onload = function () { var got = parseCodes(String(rd.result || '')); if (!got.length) { toast('<i class="bi bi-info-circle"></i> ' + esc(I18N.k('ui.no-codes-in-file', 'No codes found in that file'))); return; }
          var t1 = Fe.tools(), m = {}; (Array.isArray(t1.fdvcodes) ? t1.fdvcodes : []).concat(got).forEach(function (c) { if (c && c.c) m[c.c] = c; });
          t1.fdvcodes = Object.keys(m).sort().map(function (k) { return m[k]; }).slice(0, 3000); Fe.saveTools(t1); fill();
          toast('<i class="bi bi-check2"></i> ' + esc(I18N.k('ui.codes-imported', '{n} codes imported', { n: got.length }))); };
        rd.readAsText(e.target.files[0]); e.target.value = ''; return;
      }
      if (!e.target.matches('[data-wpparts]')) return;
      var t = Fe.tools(); t.fdvparts = e.target.value.split('\n').map(function (x) { return x.trim().slice(0, 40); }).filter(Boolean).slice(0, 30); Fe.saveTools(t);
      toast('<i class="bi bi-check2"></i> Saved');
    });
    window.addEventListener('st:page', function (e) { if (e.detail === 'work') fill(); });
    window.addEventListener('features:change', fill);
    window.Vault.onUnlock(function () { var r = document.getElementById('stWorkRow'); if (r && Fe.on('fdv')) r.hidden = false; fill(); });
  })();
  window.WorkPlus = {  };
  /* inspections saved offline wait as dash.fdvPend; when a sync goes through – on whatever page you are – the flag is cleared */
  window.addEventListener('sync:state', function (e) { var n = 0; try { n = +localStorage.getItem('dash.fdvPend') || 0; } catch (er) {} if (e.detail !== 'ok' || !n) return; try { localStorage.setItem('dash.fdvPend', '0'); } catch (er) {} window.dispatchEvent(new Event('fdv:synced')); });
  (window.__core = window.__core || {})["work"] = { parseCodes: parseCodes, toast: toast, myParts: myParts, Fe: Fe, esc: esc, myPhrases: myPhrases };
})();
