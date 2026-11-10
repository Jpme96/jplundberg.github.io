/* Your files open inside the dashboard instead of a new tab: a picture or a PDF (papers, receipts, house documents,
   chat files …) shows in a panel over the page, with Download, Expand (the whole screen) and Close.
   Works for every link to a file kept on this device (a blob: link opened in a new tab), so new places get it for free.
   Other files (a spreadsheet, a zip) show their name with Download. */
(function () {
  'use strict';
  function t(en, nb) { return window.I18N && I18N.lang === 'nb' ? nb : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var box = null, last = null;
  function nameOf(a) {
    var n = a.getAttribute('data-name') || a.getAttribute('download') || '';
    if (!n) { var b = a.querySelector('b, .pa-rtn, strong'); n = b ? b.textContent : a.getAttribute('aria-label') || a.textContent; }
    return String(n || t('File', 'Fil')).replace(/^Open\s+/i, '').trim().slice(0, 120);
  }
  function close() {
    if (!box) return;
    box.classList.remove('open');
    var b = box; box = null; setTimeout(function () { b.remove(); }, 200);
    document.documentElement.classList.remove('fv-on');
    if (last && last.focus) try { last.focus({ preventScroll: true }); } catch (e) {}
  }
  function show(url, name) {
    close();
    last = document.activeElement;
    box = document.createElement('div');
    box.className = 'fv-bg'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', name);
    box.innerHTML = '<div class="fv-box"><div class="fv-top"><b class="fv-name">' + esc(name) + '</b>' +
      '<a class="icon-btn fv-dl" href="' + esc(url) + '" download="' + esc(name) + '" aria-label="' + t('Download', 'Last ned') + '" title="' + t('Download', 'Last ned') + '"><i class="bi bi-download"></i></a>' +
      '<button type="button" class="icon-btn fv-big" aria-label="' + t('Expand', 'Utvid') + '" title="' + t('Expand', 'Utvid') + '"><i class="bi bi-arrows-angle-expand"></i></button>' +
      '<button type="button" class="icon-btn fv-x" aria-label="' + t('Close', 'Lukk') + '" title="' + t('Close', 'Lukk') + '"><i class="bi bi-x-lg"></i></button></div>' +
      '<div class="fv-body"><p class="fv-wait muted">' + t('Opening …', 'Åpner …') + '</p></div></div>';
    document.body.appendChild(box);
    document.documentElement.classList.add('fv-on');
    requestAnimationFrame(function () { if (box) box.classList.add('open'); });
    var me = box, body = box.querySelector('.fv-body');
    fetch(url).then(function (r) { return r.blob(); }).then(function (bl) {
      if (box !== me) return;
      var ty = bl.type || (/\.pdf$/i.test(name) ? 'application/pdf' : /\.(png|jpe?g|gif|webp|heic|avif)$/i.test(name) ? 'image/*' : '');
      var ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' }[ty];
      if (ext && !/\.[a-z0-9]{2,5}$/i.test(name)) box.querySelector('.fv-dl').setAttribute('download', name + '.' + ext);   /* "Receipt" downloads as Receipt.pdf */
      if (/^image\//.test(ty)) body.innerHTML = '<img class="fv-img" src="' + esc(url) + '" alt="' + esc(name) + '">';
      else if (/pdf/.test(ty)) body.innerHTML = '<iframe class="fv-pdf" src="' + esc(url) + '#view=FitH" title="' + esc(name) + '"></iframe>';
      else body.innerHTML = '<div class="fv-other"><i class="bi bi-file-earmark"></i><b>' + esc(name) + '</b><p class="muted">' + t('This kind of file can’t be shown here – download it to open it.', 'Denne filtypen kan ikke vises her – last den ned for å åpne den.') + '</p></div>';
    }, function () { if (box === me) body.innerHTML = '<p class="muted">' + t('Couldn’t open the file.', 'Klarte ikke å åpne filen.') + '</p>'; });
    box.querySelector('.fv-x').focus({ preventScroll: true });
  }
  window.FileView = { show: show, close: close };

  /* a file kept on this device, opened in a new tab: show it here instead */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="blob:"]');
    if (!a || a.hasAttribute('download') || a.closest('.fv-bg')) return;
    e.preventDefault(); e.stopPropagation();
    show(a.href, nameOf(a));
  }, true);
  document.addEventListener('click', function (e) {
    if (!box) return;
    if (e.target === box || e.target.closest('.fv-x')) { e.preventDefault(); close(); return; }
    var big = e.target.closest('.fv-big');
    if (big) { var on = box.classList.toggle('fv-full'); big.innerHTML = '<i class="bi bi-arrows-angle-' + (on ? 'contract' : 'expand') + '"></i>'; big.setAttribute('aria-label', on ? t('Make smaller', 'Gjør mindre') : t('Expand', 'Utvid')); return; }
    var img = e.target.closest('.fv-img'); if (img) img.classList.toggle('fv-zoom');
  });
  document.addEventListener('keydown', function (e) { if (box && e.key === 'Escape') { e.preventDefault(); close(); } });
})();
