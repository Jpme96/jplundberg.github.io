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
        '<div class="cl-group cl-group-text kit-text wp-parts"><span class="kit-lbl" data-t="ui.your-own-building-parts">Your own building parts</span><textarea data-wpparts rows="3" placeholder="One per line, e.g. Garage, Balcony, Lift" data-t-placeholder="ui.one-per-line-e-g-garage-balcony-lift" maxlength="1000">' + esc(myParts().join('\n')) + '</textarea><small class="kit-help" data-t="ui.theyre-added-to-the-list-of-parts-in-eve">They’re added to the list of parts in every inspection.</small></div>' +
        '<div class="st-row"><span><span data-t="ui.your-phrases">Your phrases</span><small class="st-rsub">' + (ph.length ? ph.length + ' saved – remove them on the chips in an inspection' : 'Save one with ☆ in an inspection') + '</small></span></div></div>';
    }
    pg.addEventListener('change', function (e) {
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
  (window.__core = window.__core || {})["work"] = { toast: toast, myParts: myParts, Fe: Fe, esc: esc, myPhrases: myPhrases };
})();
