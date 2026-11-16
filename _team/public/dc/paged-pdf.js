/* Copied from cmd/paged-pdf.js by _team/build.py – edit it there, not here. */
/* A4 PDFs made on the device (moved out of fdv.page.js on 2026-11-14 so Team can use the same code): a report in the
   .rp-doc look is laid out at A4 width, drawn to pictures (html2canvas) a few pages at a time, cut between paragraphs,
   rows and findings – never through a line – and put into a PDF (jsPDF) with a text footer and page numbers.
   PagedPdf.html(html, foot, name) → Promise<File>; PagedPdf.share(file); PagedPdf.photo = fn(id) → Promise<Blob> for
   img[data-rph] (FDV photos); PagedPdf.vendor = where the two tools are fetched from (only the first time).
   Used by cmd (Building inspection, Document control) and by Team (work.jplundberg.com, copied there by cmd/build.py). */
(function () {
  "use strict";
  if (window.PagedPdf) return;
  var P = window.PagedPdf = { vendor: window.PAGED_PDF_VENDOR || '/cmd/vendor/', photo: null };
  function sharePdf(file) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: file.name.replace(/\.(pdf|xlsx)$/, '') }).catch(function (e) { if (!e || e.name !== 'AbortError') save(file); }); return; }   /* the browser refused (the tap was too long ago): save it instead (JP 21:31) */
    save(file);
  }
  /* see the PDF before it goes anywhere (JP 2026-11-16: it was shared or saved straight away): its pages as they are in the
     PDF, each with its footer, and Share / Save / Close. Used by Document requirements, Document control and the inspection. */
  function K(key, en, o) { return window.I18N && window.I18N.k ? window.I18N.k(key, en, o) : en; }
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function view(file) {
    var old = document.getElementById('ppView'); if (old) old.remove();
    var canShare = !!(navigator.canShare && navigator.canShare({ files: [file] })), imgs = file._imgs || [], n = imgs.length;
    var el = document.createElement('div'); el.id = 'ppView'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', file.name);
    el.style.cssText = 'position:fixed;inset:0;z-index:4000;background:rgba(10,12,16,.82);display:flex;flex-direction:column;color:#f4f5f7;font:inherit';
    var btn = 'border:0;border-radius:999px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer;display:inline-flex;gap:6px;align-items:center;';
    el.innerHTML = '<div style="display:flex;gap:8px;align-items:center;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;background:#16191f;border-bottom:1px solid rgba(255,255,255,.08)">' +
      '<div style="flex:1;min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(file.name) + '</b><small style="opacity:.7">' + esc(K('ui.pp-pages', '{n} pages', { n: file._pages || n })) + '</small></div>' +
      (canShare ? '<button type="button" data-ppshare style="' + btn + 'background:#7c5cff;color:#fff"><i class="bi bi-box-arrow-up"></i> ' + esc(K('ui.share', 'Share')) + '</button>' : '') +
      '<button type="button" data-ppsave style="' + btn + 'background:' + (canShare ? '#2a2f38;color:#f4f5f7' : '#7c5cff;color:#fff') + '"><i class="bi bi-download"></i> ' + esc(K('ui.save', 'Save')) + '</button>' +
      '<button type="button" data-ppclose aria-label="' + esc(K('ui.close', 'Close')) + '" style="' + btn + 'background:#2a2f38;color:#f4f5f7;padding:9px 12px"><i class="bi bi-x-lg"></i></button></div>' +
      '<div data-ppbody style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:16px 12px calc(24px + env(safe-area-inset-bottom,0px))">' +
      (n ? imgs.map(function (src, i) { return '<figure style="margin:0 auto 16px;max-width:820px;background:#fff;border-radius:4px;box-shadow:0 4px 18px rgba(0,0,0,.35);padding:3.5% 3.5% 2%">' +
        '<img src="' + src + '" alt="" style="display:block;width:100%;height:auto">' +
        '<figcaption style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid #d5dae0;margin-top:10px;padding-top:4px;color:#6e7680;font-size:9px"><span>' + esc(String(file._foot || '').replace(/­/g, '')) + '</span><span>' + (i + 1) + ' / ' + n + '</span></figcaption></figure>'; }).join('')
        : '<p style="text-align:center;opacity:.8">' + esc(K('ui.pp-no-preview', 'No preview – save or share the PDF to see it.')) + '</p>') + '</div>';
    document.body.appendChild(el);
    var prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
    function close() { el.remove(); document.documentElement.style.overflow = prevOverflow; document.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', onKey, true);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-ppclose]')) { close(); return; }
      if (e.target.closest('[data-ppshare]')) { sharePdf(file); return; }
      if (e.target.closest('[data-ppsave]')) { save(file); return; }
    });
    var cb = el.querySelector('[data-ppclose]'); if (cb) cb.focus();
    return el;
  }
  P.view = view;
  function save(file) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  /* the PDF is made on the device: the report is laid out at A4 width, drawn to a picture (html2canvas), cut into pages between
     paragraphs, rows and findings – never through a line – and put into a PDF (jsPDF) with your name, the report number and
     the page number as real text at the foot of every page. The two tools are fetched only the first time (cmd/vendor). */
  function loadJs(src) { return new Promise(function (res, rej) { var sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }); }
  var LIBS = null;
  function libs() { return LIBS || (LIBS = Promise.all([window.jspdf ? 1 : loadJs(P.vendor + 'jspdf.umd.min.js?v=2.5.2'), window.html2canvas ? 1 : loadJs(P.vendor + 'html2canvas.min.js?v=1.4.1')]).catch(function (e) { LIBS = null; throw e; })); }
  /* any report in the .rp-doc look as an A4 PDF with a text footer (also used by Document control) */
  function pagedPdf(html, foot, name) {
    name = String(name || 'report.pdf').replace(/\u00ad/g, '');   /* soft hyphens in the Norwegian tab names stay out of the PDF */
    return libs().then(function () {
      var W = 700, MM = W / 182, PAGE = Math.floor(259 * MM); var imgs = [];   /* A4 with 14 mm sides, 14 mm top and 24 mm for the footer */
      var box = document.createElement('div'); box.className = 'rp-pdfbox';
      box.innerHTML = '<article class="rp-doc rp-pdf">' + html + '</article>'; document.body.appendChild(box);
      var doc = box.firstChild;
      var waits = [].map.call(doc.querySelectorAll('img[data-rph]'), function (im) { return (P.photo ? P.photo(im.dataset.rph) : Promise.resolve(null)).then(function (bl) { if (!bl) { (im.closest('figure') || im).remove(); return; } return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { im.onload = ok; im.onerror = ok; im.src = fr.result; }; fr.readAsDataURL(bl); }); }); });
      /* where the pages break is measured in the very copy html2canvas draws (JP 20:17: rows were cut in half – the page was
         measured before the bold font had loaded, the picture drawn after, so every row sat a little lower than measured) */
      function measure(doc) {
        var top0 = doc.getBoundingClientRect().top, Y = function (el, w) { var b = el.getBoundingClientRect(); return w ? b.bottom - top0 : b.top - top0; };
        var total = doc.scrollHeight;
        var atoms = [].slice.call(doc.querySelectorAll('h2, h3, p, tr, li, .rp-f, figure, .rp-bar1, .rp-mxt, .rp-tgt, .rp-head, .rp-cvt tr, footer')).map(function (e) { return [Y(e), Y(e, 1), /^H[23]$/.test(e.tagName)]; });
        var forced = [].slice.call(doc.querySelectorAll('.rp-newpage')).map(function (e) { return Y(e); }).concat([].slice.call(doc.querySelectorAll('.rp-cover')).map(function (e) { return Y(e, 1) + 1; })).filter(function (y) { return y > 4; }).sort(function (a, b) { return a - b; });
        var cuts = [], st = 0;
        while (st < total - 2) {
          var lim = st + PAGE, fb = forced.filter(function (y) { return y > st + 4 && y <= lim; })[0], end;
          if (fb) end = fb;
          else if (lim >= total) end = total;
          else {
            end = lim;
            /* break on the edge of a row or paragraph: rows touch, and their edges are often between two whole pixels */
            var cand = atoms.map(function (a) { return a[1]; }).concat(atoms.map(function (a) { return a[0]; })).filter(function (y) { return y <= lim && y > st + PAGE * .4; }).sort(function (a, b) { return b - a; });
            for (var i = 0; i < cand.length; i++) { var y = cand[i]; if (!atoms.some(function (a) { return a[0] < y - .5 && a[1] > y + .5; })) { end = y; break; } }
            /* a heading never ends a page alone */
            atoms.forEach(function (a) { if (a[2] && a[0] >= st && a[1] <= end && end - a[1] < 40 && a[0] > st + 20) end = Math.min(end, a[0] - 2); });
          }
          cuts.push([st, end]); st = end;
          while (st < total && !atoms.some(function (a) { return a[1] > st; })) st = total;
        }
        return cuts;
      }
      /* html2canvas copies the whole page before it draws – the scenes, cards and menus too. Only the report is copied (the
         head keeps the styles), and the pages are drawn with a pause between them, so the phone never freezes for seconds
         (iPhone 2026-11-14: "stuck for 5 s" after Make PDF) */
      var ign = function (el) { return el.parentNode === document.body && el !== box; };
      var rest = function (v) { return new Promise(function (ok) { setTimeout(function () { ok(v); }, 0); }); };
      return Promise.all(waits).then(function () { return document.fonts && document.fonts.ready; }).then(function () { return new Promise(function (ok) { setTimeout(ok, 120); }); }).then(function () {
        var cuts = null;
        return window.html2canvas(box, { scale: .05, backgroundColor: '#ffffff', logging: false, ignoreElements: ign, windowWidth: document.documentElement.clientWidth, windowHeight: window.innerHeight,
          onclone: function (d) { var bx = d.querySelector('.rp-pdfbox'), ar = bx && bx.firstElementChild; if (!ar) return; cuts = measure(ar); bx.style.height = '1px'; bx.style.overflow = 'hidden'; } }).then(function () {
        if (!cuts || !cuts.length) cuts = measure(doc);   /* the copy had no report: measure here instead */
        /* drawn a few pages at a time (JP 13:05 – a long report stopped half way on the iPhone: Safari draws nothing past ~16 million
           pixels in one picture, so one picture of the whole report came out blank at the bottom) */
        var chunks = [], cur = null;
        cuts.forEach(function (c, i) { if (!cur || c[1] - cur.a > 2400) { cur = { a: c[0], b: c[1], ix: [] }; chunks.push(cur); } cur.b = c[1]; cur.ix.push(i); });
        var PDF = window.jspdf.jsPDF, pdf = new PDF({ unit: 'mm', format: 'a4', compress: true }), W0 = doc.offsetWidth;
        return chunks.reduce(function (pr, ch) {
          return pr.then(rest).then(function () {
            var H = Math.ceil(ch.b - ch.a);
            return window.html2canvas(box, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, ignoreElements: ign, windowWidth: document.documentElement.clientWidth, windowHeight: window.innerHeight,
              onclone: function (d) { var bx = d.querySelector('.rp-pdfbox'), ar = bx && bx.firstElementChild; if (!ar) return; bx.style.height = H + 'px'; bx.style.overflow = 'hidden'; ar.style.setProperty('margin-top', (-ch.a) + 'px', 'important'); } }   /* the same width the pages were measured at – on a phone it used to draw at desktop width, so the cuts landed in the wrong places (an empty page after a heading) */).then(function (cv) {
              var S = cv.width / W0;
              ch.ix.forEach(function (i) {
                var c = cuts[i];
                if (i) pdf.addPage();
                var h = Math.max(1, Math.round((c[1] - c[0]) * S)), pc = document.createElement('canvas'); pc.width = cv.width; pc.height = h;
                var g = pc.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, pc.width, h); g.drawImage(cv, 0, Math.round((c[0] - ch.a) * S), cv.width, h, 0, 0, cv.width, h);
                var du = pc.toDataURL('image/jpeg', .9); imgs[i] = du;   /* kept for the viewer: what you see is the page in the PDF */
                pdf.addImage(du, 'JPEG', 14, 14, 182, (c[1] - c[0]) / MM, undefined, 'FAST');
                pdf.setDrawColor(213, 218, 224); pdf.setLineWidth(.2); pdf.line(14, 284, 196, 284);
                pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(110, 118, 128);
                pdf.text(foot.replace(/­/g, ''), 14, 288.5, { maxWidth: 160 }); pdf.text((i + 1) + ' / ' + cuts.length, 196, 288.5, { align: 'right' });
              });
              cv.width = cv.height = 0;
            });
          });
        }, Promise.resolve()).then(function () {
          box.remove();
          var file = new File([pdf.output('blob')], name, { type: 'application/pdf' }); file._pages = cuts.length; file._cuts = cuts; file._imgs = imgs; file._foot = foot;
          return file;
        });
      });
      }).catch(function (e) { box.remove(); throw e; });
    });
  }
  P.html = pagedPdf; P.share = sharePdf;
})();
