/* Copied from cmd/filedrop.js by _team/build.py – edit it there, not here. */
/* Every file picker opens the same drop popup (JP 2026-11-17 21:02): "Add files" – drop them here – or "Choose files".
   A head module (runs once): it catches a tap on a file field's label, a click on the field itself and a script's
   input.click(), opens the popup, and hands the chosen or dropped files back to the original field (input + change
   events), so every feature keeps its own code. Not for camera fields (capture=…), fields marked data-nodrop or the
   popup's own field. Also loaded by Team (copied to /dc/ by _team/build.py). */
(function () {
  'use strict';
  if (window.FileDrop) return;
  /* words: by name through I18N where there is one; Team (no I18N before Documents opens) uses the table */
  var W = {
    'ui.fdz-t': ['Add files', 'Legg til filer'],
    'ui.fdz-t1': ['Add a file', 'Legg til en fil'],
    'ui.fdz-here': ['Drop the files here', 'Slipp filene her'],
    'ui.fdz-here1': ['Drop the file here', 'Slipp filen her'],
    'ui.dx-drop-or': ['or', 'eller'],
    'ui.dx-drop-pick': ['Choose files', 'Velg filer'],
    'ui.fdz-pick1': ['Choose a file', 'Velg en fil'],
    'ui.fdz-any': ['Any kind of file', 'Alle slags filer'],
    'ui.fdz-photos': ['photos', 'bilder'],
    'ui.fdz-videos': ['videos', 'videoer'],
    'ui.fdz-text': ['text', 'tekst'],
    'ui.fdz-wrong': ['That kind of file doesn’t fit here – {k}', 'Den filtypen passer ikke her – {k}'],
    'ui.close': ['Close', 'Lukk']
  };
  function nb() { return /^(nb|no|nn)/i.test(document.documentElement.lang || ''); }
  function t(key, o) {
    var w = W[key] || [key, key], s = window.I18N && I18N.k ? I18N.k(key, w[0], o) : (nb() ? w[1] : w[0]);
    if (o && s.indexOf('{') >= 0) s = s.replace(/\{(\w+)\}/g, function (m, x) { return o[x] != null ? o[x] : m; });
    return s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* what the field takes, in plain words */
  function kinds(acc) {
    if (!acc) return t('ui.fdz-any');
    var out = [];
    acc.split(',').forEach(function (a) {
      a = a.trim().toLowerCase(); if (!a) return;
      var n = /pdf/.test(a) ? 'PDF' : a === 'image/*' || /^image\//.test(a) || /^\.(jpe?g|png|heic|webp|gif)$/.test(a) ? t('ui.fdz-photos') : /^video\//.test(a) ? t('ui.fdz-videos') :
        /\.xls|spreadsheet|excel/.test(a) ? 'Excel' : /csv/.test(a) ? 'CSV' : /json/.test(a) ? 'JSON' : /\.docx?|word/.test(a) ? 'Word' : /zip/.test(a) ? '.zip' :
        a === '.txt' || a === 'text/plain' ? t('ui.fdz-text') : a.charAt(0) === '.' ? a.slice(1).toUpperCase() : a;
      if (out.indexOf(n) < 0) out.push(n);
    });
    return out.join(', ');
  }
  function fits(f, acc) {
    if (!acc) return true;
    var nm = (f.name || '').toLowerCase(), ty = (f.type || '').toLowerCase();
    return acc.split(',').some(function (a) {
      a = a.trim().toLowerCase(); if (!a) return false;
      if (a.charAt(0) === '.') return nm.slice(-a.length) === a;
      if (/\/\*$/.test(a)) return ty.indexOf(a.slice(0, -1)) === 0;
      return ty === a;
    });
  }
  function wants(i) {
    return !!(i && i.type === 'file' && !i.disabled && !i.hasAttribute('capture') && !i.hasAttribute('data-nodrop') && !i.hasAttribute('webkitdirectory') &&
      !(i.closest && i.closest('[data-nodrop], .fdz-ov, .dx-dz')));
  }
  function give(inp, files) {
    var acc = inp.getAttribute('accept') || '', ok = files.filter(function (f) { return fits(f, acc); });
    if (!ok.length) return false;
    if (!inp.multiple) ok = ok.slice(0, 1);
    try { var dt = new DataTransfer(); ok.forEach(function (f) { dt.items.add(f); }); inp.files = dt.files; } catch (e) { return false; }
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  var CSS = '.fdz-ov{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55)}' +
    '.fdz-sh{width:min(620px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--bg-solid,var(--bg,#0e0f11));color:var(--text,var(--ink,#e7e7ea));border:1px solid var(--line,rgba(255,255,255,.1));border-radius:18px;padding:16px 18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.45);box-sizing:border-box;font-family:inherit}' +
    '.fdz-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.fdz-hd b{font-size:18px}' +
    '.fdz-x{width:44px;height:44px;border-radius:50%;border:1px solid var(--line,rgba(255,255,255,.12));background:none;color:inherit;font-size:20px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}' +
    '.fdz-dz{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:220px;padding:24px;border:2px dashed rgba(127,127,127,.45);border-radius:16px;text-align:center;cursor:pointer;transition:background .15s,border-color .15s}' +
    '.fdz-dz.on{border-color:var(--accent,var(--acc,#14b8a6));background:rgba(var(--accent-rgb,20,184,166),.08)}' +
    '.fdz-dz svg{width:44px;height:44px;color:var(--accent,var(--acc,#14b8a6))}.fdz-dz>b{font-size:17px}.fdz-or{opacity:.7;font-size:14px}' +
    '.fdz-pk{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:8px 22px;border-radius:12px;background:var(--accent,var(--acc,#14b8a6));color:var(--on-accent,var(--acc-ink,#04201c));font-weight:600;font-size:15px}' +
    '.fdz-pk svg{width:18px;height:18px;color:inherit}' +
    '.fdz-help{margin:12px 2px 0;font-size:14px;line-height:1.45;color:var(--muted,#a3a3aa)}.fdz-bad{margin:10px 2px 0;font-size:14px;color:var(--danger,var(--bad,#e66767))}' +
    'html.fdz-modal{overflow:hidden}' +
    '@media (max-width:560px){.fdz-ov{align-items:flex-end;padding:0}.fdz-sh{border-radius:18px 18px 0 0;max-height:92dvh;padding-bottom:max(20px,env(safe-area-inset-bottom))}.fdz-dz{min-height:180px}}';
  var CLOUD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5H7z"/><path d="M12 15V10m0 0-2.5 2.5M12 10l2.5 2.5"/></svg>',
    FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2h9A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>';
  function style() { if (document.getElementById('fdzCss')) return; var s = document.createElement('style'); s.id = 'fdzCss'; s.textContent = CSS; document.head.appendChild(s); }
  function open(inp) {
    if (document.querySelector('.fdz-ov')) return;
    style();
    var acc = inp.getAttribute('accept') || '', many = inp.multiple;
    var ov = document.createElement('div'); ov.className = 'fdz-ov';
    ov.innerHTML = '<div class="fdz-sh" role="dialog" aria-modal="true" aria-label="' + esc(t(many ? 'ui.fdz-t' : 'ui.fdz-t1')) + '"><div class="fdz-hd"><b>' + esc(t(many ? 'ui.fdz-t' : 'ui.fdz-t1')) + '</b><button type="button" class="fdz-x" data-fdzx aria-label="' + esc(t('ui.close')) + '">&#x2715;</button></div>' +
      '<label class="fdz-dz">' + CLOUD + '<b>' + esc(t(many ? 'ui.fdz-here' : 'ui.fdz-here1')) + '</b><span class="fdz-or">' + esc(t('ui.dx-drop-or')) + '</span><span class="fdz-pk">' + FOLDER + ' ' + esc(t(many ? 'ui.dx-drop-pick' : 'ui.fdz-pick1')) + '</span>' +
      '<input type="file"' + (many ? ' multiple' : '') + (acc ? ' accept="' + esc(acc) + '"' : '') + ' hidden></label><p class="fdz-help">' + esc(kinds(acc)) + '</p><p class="fdz-bad" hidden></p></div>';
    var dz = ov.querySelector('.fdz-dz'), bad = ov.querySelector('.fdz-bad'), back = document.activeElement;
    var close = function () { ov.remove(); document.removeEventListener('keydown', key, true); document.documentElement.classList.remove('fdz-modal'); try { if (back && back.focus && document.contains(back)) back.focus(); } catch (e) {} };
    var key = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    var take = function (fl) { fl = [].slice.call(fl || []); if (!fl.length) return; close(); if (!give(inp, fl)) { open(inp); var b2 = document.querySelector('.fdz-ov .fdz-bad'); if (b2) { b2.textContent = t('ui.fdz-wrong', { k: kinds(acc) }); b2.hidden = false; } } };
    var dn = null; ov.addEventListener('pointerdown', function (e) { dn = e.target; });   /* a press that starts in the box and ends outside it doesn't close it */
    ov.addEventListener('click', function (e) { if ((e.target === ov && dn === ov) || e.target.closest('[data-fdzx]')) close(); });
    ov.addEventListener('change', function (e) { if (e.target.type === 'file') take(e.target.files); });
    ['dragenter', 'dragover'].forEach(function (ev) { ov.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('on'); }); });
    ov.addEventListener('dragleave', function (e) { if (!ov.contains(e.relatedTarget)) dz.classList.remove('on'); });
    ov.addEventListener('drop', function (e) { e.preventDefault(); dz.classList.remove('on'); take(e.dataTransfer && e.dataTransfer.files); });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(ov); document.documentElement.classList.add('fdz-modal');
    var x = ov.querySelector('[data-fdzx]'); if (x) x.focus();
    bad.hidden = true;
  }
  /* a script's input.click() */
  var click0 = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () { if (wants(this) && !window.__fdzOff) { open(this); return; } return click0.apply(this, arguments); };
  /* a tap on the field's label, or on the field itself */
  document.addEventListener('click', function (e) {
    if (window.__fdzOff || e.defaultPrevented) return;
    var tg = e.target, inp = null;
    if (tg && tg.tagName === 'INPUT' && tg.type === 'file') inp = tg;
    else { var lb = tg && tg.closest && tg.closest('label'); if (lb) inp = lb.control || lb.querySelector('input[type=file]'); }
    if (!inp || inp.type !== 'file' || !wants(inp)) return;
    e.preventDefault();
    open(inp);
  }, true);
  window.FileDrop = { open: open, give: give, kinds: kinds };
})();
