/* Every file picker opens the same drop popup (JP 2026-11-17 21:02): "Add files" – drop them here – or "Choose files".
   A head module (runs once): it catches a tap on a file field's label, a click on the field itself and a script's
   input.click(), opens the popup, and hands the chosen or dropped files back to the original field (input + change
   events), so every feature keeps its own code. Not for camera fields (capture=…), fields marked data-nodrop or the
   popup's own field. Also loaded by Team (copied to /dc/ by _team/build.py).
   It also holds window.Ask – the app's own confirm/prompt/alert popups (2026-11-19), in the same look. */
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
    'ui.close': ['Close', 'Lukk'],
    'ui.ok': ['OK', 'OK'],
    'ui.cancel': ['Cancel', 'Avbryt'],
    'ui.awake-off': ['Keep screen on', 'Hold skjermen på'],
    'ui.awake-on': ['Screen stays on', 'Skjermen holdes på']
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
  var CSS = '@keyframes fdz-in{from{opacity:0}}.fdz-ov{animation:fdz-in .18s ease-out}@media (prefers-reduced-motion:reduce){.fdz-ov{animation:none}}' +
    '.fdz-ov{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}' +
    '.fdz-sh{width:min(620px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--bg-solid,var(--bg,#0e0f11));color:var(--text,var(--ink,#e7e7ea));border:1px solid var(--line,rgba(255,255,255,.1));border-radius:18px;padding:16px 18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.45);box-sizing:border-box;font-family:inherit}' +
    '.fdz-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.fdz-hd b{font-size:18px}' +
    '.fdz-x{width:44px;height:44px;border-radius:50%;border:1px solid var(--line,rgba(255,255,255,.12));background:none;color:inherit;font-size:20px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}' +
    '.fdz-dz{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:220px;padding:24px;border:2px dashed rgba(127,127,127,.45);border-radius:16px;text-align:center;cursor:pointer;transition:background .15s,border-color .15s}' +
    '.fdz-dz.on{border-color:var(--accent,var(--acc,#14b8a6));background:rgba(var(--accent-rgb,var(--acc-rgb,20,184,166)),.08)}' +
    '.fdz-dz svg{width:44px;height:44px;color:var(--accent,var(--acc,#14b8a6))}.fdz-dz>b{font-size:17px}.fdz-or{opacity:.7;font-size:14px}' +
    '.fdz-pk{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:8px 22px;border-radius:12px;background:var(--accent,var(--acc,#14b8a6));color:var(--on-accent,var(--acc-ink,#04201c));font-weight:600;font-size:15px}' +
    '.fdz-pk svg{width:18px;height:18px;color:inherit}' +
    '.fdz-help{margin:12px 2px 0;font-size:14px;line-height:1.45;color:var(--muted,#a3a3aa)}.fdz-bad{margin:10px 2px 0;font-size:14px;color:var(--danger,var(--bad,#e66767))}' +
    'html.fdz-modal{overflow:hidden}' +
    '.ask-sh{width:min(440px,100%)}.ask-msg{margin:4px 2px 0;font-size:16px;line-height:1.5;white-space:pre-line}' +
    '.ask-in{width:100%;box-sizing:border-box;margin-top:14px;min-height:44px;padding:10px 12px;border-radius:12px;border:1px solid var(--line,rgba(127,127,127,.35));background:transparent;color:inherit;font-size:16px}' +
    '.ask-bt{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.ask-bt button{min-height:44px;padding:8px 20px;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;border:1px solid var(--line,rgba(127,127,127,.35));background:none;color:inherit}' +
    '.ask-bt .ask-ok{border-color:transparent;background:var(--accent,var(--acc,#14b8a6));color:var(--on-accent,var(--acc-ink,#04201c))}.ask-bt .ask-ok.ask-dg{background:var(--danger,var(--bad,#e66767));color:#fff}' +
    '@media (max-width:560px){.ask-bt button{flex:1}}' +
    '.tap-tip{position:fixed;z-index:2147482500;max-width:min(280px,calc(100vw - 24px));padding:7px 11px;border-radius:10px;background:var(--text,var(--ink,#e7e7ea));color:var(--bg-solid,var(--bg,#0e0f11));font-size:14px;line-height:1.35;box-shadow:0 6px 20px rgba(0,0,0,.25);pointer-events:none;white-space:pre-line}' +
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

  /* ---------- Ask: the app's own "Are you sure?", "Type a value" and notice (2026-11-19) ----------
     Instead of the browser's own grey boxes (confirm, prompt, alert), which can't be styled, are English-only in places
     and block the page. Each returns a Promise: Ask.confirm(msg, {ok, danger, title}) → true/false,
     Ask.prompt(msg, value, {ok, ph}) → the text or null, Ask.alert(msg) → undefined. Test: no-native-dialogs. */
  function ask(kind, msg, val, o) {
    o = o || {};
    return new Promise(function (done) {
      style();
      var ov = document.createElement('div'); ov.className = 'fdz-ov ask-ov';
      var title = o.title ? '<div class="fdz-hd"><b>' + esc(o.title) + '</b></div>' : '';
      ov.innerHTML = '<div class="fdz-sh ask-sh" role="' + (kind === 'alert' ? 'alertdialog' : 'dialog') + '" aria-modal="true">' + title +
        '<p class="ask-msg">' + esc(msg) + '</p>' +
        (kind === 'prompt' ? '<input class="ask-in" type="text" autocomplete="off"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + ' value="' + esc(val == null ? '' : val) + '">' : '') +
        '<div class="ask-bt">' + (kind === 'alert' ? '' : '<button type="button" class="ask-no">' + esc(o.cancel || t('ui.cancel')) + '</button>') +
        '<button type="button" class="ask-ok' + (o.danger ? ' ask-dg' : '') + '">' + esc(o.ok || t('ui.ok')) + '</button></div></div>';
      var back = document.activeElement, inp = ov.querySelector('.ask-in'), fin = false;
      var close = function (r) {
        if (fin) return; fin = true;
        ov.remove(); document.removeEventListener('keydown', key, true);
        if (!document.querySelector('.fdz-ov')) document.documentElement.classList.remove('fdz-modal');
        try { if (back && back.focus && document.contains(back)) back.focus(); } catch (e) {}
        done(r);
      };
      var yes = function () { close(kind === 'prompt' ? inp.value : kind === 'confirm' ? true : undefined); };
      var no = function () { close(kind === 'prompt' ? null : kind === 'confirm' ? false : undefined); };
      var key = function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); no(); }
        else if (e.key === 'Enter' && kind === 'prompt' && e.target === inp) { e.stopPropagation(); e.preventDefault(); yes(); }
      };
      var dn = null; ov.addEventListener('pointerdown', function (e) { dn = e.target; });
      ov.addEventListener('click', function (e) {
        if (e.target.closest('.ask-ok')) yes();
        else if (e.target.closest('.ask-no') || (e.target === ov && dn === ov)) no();
      });
      document.addEventListener('keydown', key, true);
      document.body.appendChild(ov); document.documentElement.classList.add('fdz-modal');
      if (inp) { inp.focus(); try { inp.select(); } catch (e) {} } else { var f = ov.querySelector(o.danger ? '.ask-no' : '.ask-ok') || ov.querySelector('.ask-ok'); if (f) f.focus(); }
    });
  }

  /* ---------- Tap tips (2026-11-19, plan Part 3 A3) ----------
     A title="…" on a number, bar or cell is a hover tip – on a phone nobody sees it. With a touch screen a tap on such a
     thing (not a button, link or field – those do their own job) shows the same words in a small tip for a few seconds.
     SVG shapes with a <title> child work the same way. */
  var tipEl = null, tipT = 0;
  function hideTip() { clearTimeout(tipT); if (tipEl) { tipEl.remove(); tipEl = null; } }
  function showTip(el, txt) {
    hideTip(); style();
    tipEl = document.createElement('div'); tipEl.className = 'tap-tip'; tipEl.setAttribute('role', 'status'); tipEl.textContent = txt;
    document.body.appendChild(tipEl);
    var r = el.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight, vw = document.documentElement.clientWidth;
    var x = Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2)), y = r.top - h - 8;
    if (y < 8) y = r.bottom + 8;
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    tipT = setTimeout(hideTip, 3000);
  }
  function tipText(t) {
    for (var el = t; el && el !== document.body && el.nodeType === 1; el = el.parentNode) {
      if (el.closest && el.closest('button, a[href], input, select, textarea, label, summary, [role=button], [role=tab], [contenteditable], .fdz-ov, [data-notip]')) return null;
      var tt = el.getAttribute && el.getAttribute('title');
      if (tt && tt.trim()) return { el: el, t: tt.trim() };
      var st = el.namespaceURI === 'http://www.w3.org/2000/svg' && el.querySelector && el.querySelector(':scope > title');
      if (st && st.textContent.trim()) return { el: el, t: st.textContent.trim() };
    }
    return null;
  }
  var coarse = window.matchMedia ? window.matchMedia('(hover: none) and (pointer: coarse)') : null;
  document.addEventListener('click', function (e) {
    if (tipEl && !e.defaultPrevented) hideTip();
    if (!coarse || !coarse.matches || e.defaultPrevented) return;
    var f = tipText(e.target); if (f) showTip(f.el, f.t);
  });
  window.addEventListener('scroll', hideTip, { passive: true, capture: true });

  /* ---------- Keep the screen on (2026-11-19, plan Part 4) ----------
     While cooking from a recipe or shopping from the list the phone shouldn't lock. Awake.btn() gives a toggle button
     (empty where the browser has no Wake Lock); it asks for a screen wake lock, takes it again when the tab comes back,
     and lets go when you leave the page (instant page change too) or tap it again. */
  var awakeWant = false, awakeLock = null;
  function awakeSync() {
    [].forEach.call(document.querySelectorAll('[data-awake]'), function (b) {
      b.setAttribute('aria-pressed', awakeWant ? 'true' : 'false');
      var s = b.querySelector('span'); if (s) s.textContent = t(awakeWant ? 'ui.awake-on' : 'ui.awake-off');
      var i = b.querySelector('i'); if (i) i.className = 'bi bi-' + (awakeWant ? 'brightness-alt-high-fill' : 'brightness-alt-high');
    });
  }
  function awakeGet() {
    if (!awakeWant || awakeLock || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (l) {
      awakeLock = l; l.addEventListener('release', function () { awakeLock = null; });
      if (!awakeWant) { l.release().catch(function () {}); }
    }, function () { awakeWant = false; awakeSync(); });
  }
  function awakeSet(on) {
    awakeWant = !!on; awakeSync();
    if (awakeWant) awakeGet(); else if (awakeLock) { var l = awakeLock; awakeLock = null; l.release().catch(function () {}); }
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-awake]'); if (b) { e.preventDefault(); awakeSet(!awakeWant); } });
  document.addEventListener('visibilitychange', awakeGet);
  window.addEventListener('softnav:swap', function () { awakeSet(false); });
  window.addEventListener('pagehide', function () { awakeSet(false); });
  window.Awake = {
    on: function () { return awakeWant; },
    set: awakeSet,
    btn: function () {
      if (!('wakeLock' in navigator)) return '';
      return '<button type="button" class="text-btn" data-awake aria-pressed="' + awakeWant + '"><i class="bi bi-brightness-alt-high' + (awakeWant ? '-fill' : '') + '"></i> <span>' + esc(t(awakeWant ? 'ui.awake-on' : 'ui.awake-off')) + '</span></button>';
    }
  };
  window.Ask = {
    confirm: function (msg, o) { return ask('confirm', msg, null, o); },
    prompt: function (msg, val, o) { return ask('prompt', msg, val, o); },
    alert: function (msg, o) { return ask('alert', msg, null, o); },
    tip: showTip
  };
  window.FileDrop = { open: open, give: give, kinds: kinds, style: style };
})();
