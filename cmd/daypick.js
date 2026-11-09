/* Day-of-the-month picker: any <select data-daypick> (options 1–31, optionally "" and "last") or <input data-daypick>
   gets a button instead – "The 15th · next Mon 15 Dec" – that opens a small grid of days with "Last day" and "None".
   The original field stays (hidden) and gets the value and a change event, so the code that saves it doesn't change.
   data-daypick="due" (default) or "pay" only changes the wording. */
(function () {
  "use strict";
  var NO = function () { return document.documentElement.lang === 'no' || /^nb|^no/.test(document.documentElement.lang || ''); };
  var L = function (en, no) { return NO() ? no : en; };
  function th(n) { if (NO()) return n + '.'; var s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'; return n + s; }
  function lastOpt(el) { return el.tagName === 'SELECT' && [].some.call(el.options, function (o) { return o.value === 'last'; }); }
  function val(el) { var v = String(el.value || '').trim(); return v === 'last' ? 'last' : /^\d+$/.test(v) && +v >= 1 && +v <= 31 ? +v : ''; }
  function next(v) {
    if (!v) return null;
    var now = new Date(), t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (var k = 0; k < 3; k++) {
      var y = now.getFullYear(), m = now.getMonth() + k, dim = new Date(y, m + 1, 0).getDate(), d = new Date(y, m, v === 'last' ? dim : Math.min(v, dim));
      if (d >= t) return d;
    }
    return null;
  }
  function label(el) {
    var v = val(el), pay = el.dataset.daypick === 'pay';
    if (!v) return '<span class="dp-ph">' + (pay ? L('Payday…', 'Lønningsdag …') : L('No due day', 'Ingen forfallsdag')) + '</span>';
    var n = next(v), what = v === 'last' || v === 31 ? L('Last day of the month', 'Siste dag i måneden') : L('The ' + th(v) + ' every month', 'Den ' + th(v) + ' hver måned');
    return '<b>' + what + '</b>' + (n ? '<small>' + L('Next: ', 'Neste: ') + n.toLocaleDateString(NO() ? 'nb-NO' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + '</small>' : '');
  }
  function css() {
    if (document.getElementById('dpCss')) return;
    var s = document.createElement('style'); s.id = 'dpCss';
    s.textContent = '.dp-btn{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:8px 12px;border-radius:12px;border:1px solid var(--line,rgba(127,127,127,.25));background:rgba(var(--ink-rgb,255,255,255),.05);color:inherit;font:inherit;text-align:left;cursor:pointer}' +
      '.dp-btn>i{color:var(--accent,#11a597);font-size:16px}.dp-btn>span{flex:1;min-width:0;display:grid;line-height:1.25}.dp-btn b{font-weight:600;font-size:14.5px}.dp-btn small{font-size:12px;opacity:.65}.dp-ph{opacity:.6}' +
      '.dp-bg{position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center}' +
      '@media (min-width:600px){.dp-bg{align-items:center}}' +
      '.dp-pop{width:min(380px,100%);background:var(--bg-solid,#16171b);color:var(--text,#eee);border-radius:20px 20px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.4)}' +
      '@media (min-width:600px){.dp-pop{border-radius:20px}}' +
      '.dp-pop h3{margin:0 0 12px;font-size:16px;text-align:center}.dp-g{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}' +
      '.dp-g button,.dp-row button{height:42px;border-radius:12px;border:0;background:rgba(127,127,127,.14);color:inherit;font:inherit;font-size:15px;cursor:pointer}' +
      '.dp-g button.on,.dp-row button.on{background:var(--accent,#11a597);color:var(--on-accent,#fff);font-weight:600}' +
      '.dp-row{display:flex;gap:8px;margin-top:10px}.dp-row button{flex:1;font-size:14px}.dp-note{margin:10px 2px 0;font-size:12.5px;opacity:.65;text-align:center;min-height:1.3em}';
    document.head.appendChild(s);
  }
  function open(el) {
    css();
    var cur = val(el), pay = el.dataset.daypick === 'pay', canLast = el.tagName !== 'SELECT' || lastOpt(el) || [].some.call(el.options, function (o) { return o.value === '31'; });
    var bg = document.createElement('div'); bg.className = 'dp-bg';
    var g = ''; for (var d = 1; d <= 31; d++) g += '<button type="button" data-v="' + d + '"' + (cur === d ? ' class="on"' : '') + '>' + d + '</button>';
    bg.innerHTML = '<div class="dp-pop" role="dialog" aria-label="' + (pay ? L('Payday', 'Lønningsdag') : L('Due day', 'Forfallsdag')) + '"><h3>' + (pay ? L('Which day are you paid?', 'Hvilken dag får du lønn?') : L('Which day is it due each month?', 'Hvilken dag forfaller den hver måned?')) + '</h3>' +
      '<div class="dp-g">' + g + '</div><div class="dp-row">' + (canLast ? '<button type="button" data-v="last"' + (cur === 'last' || cur === 31 ? ' class="on"' : '') + '>' + L('Last day', 'Siste dag') + '</button>' : '') +
      '<button type="button" data-v=""' + (cur === '' ? ' class="on"' : '') + '>' + L('None', 'Ingen') + '</button></div>' +
      '<p class="dp-note">' + L('29–31: in shorter months, the last day', '29–31: i kortere måneder den siste dagen') + '</p></div>';
    document.body.appendChild(bg);
    bg.addEventListener('click', function (e) {
      if (e.target === bg) { bg.remove(); return; }
      var b = e.target.closest('button[data-v]'); if (!b) return;
      var v = b.dataset.v;
      if (v === 'last' && el.tagName === 'SELECT' && !lastOpt(el)) v = '31';      /* stored as the 31st: shorter months use their last day */
      el.value = v; bg.remove();
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      paint(el);
    });
  }
  function paint(el) { if (el._dp) el._dp.innerHTML = '<i class="bi bi-calendar-event"></i><span>' + label(el) + '</span><i class="bi bi-chevron-down" style="color:inherit;opacity:.5;font-size:13px"></i>'; }
  function enhance(el) {
    if (el._dp) return;
    css();
    var b = document.createElement('button'); b.type = 'button'; b.className = 'dp-btn'; b.setAttribute('aria-label', el.getAttribute('aria-label') || L('Due day', 'Forfallsdag'));
    el._dp = b; el.hidden = true; el.style.display = 'none'; el.parentNode.insertBefore(b, el.nextSibling);
    b.addEventListener('click', function () { open(el); });
    el.addEventListener('change', function () { paint(el); });
    paint(el);
  }
  function scan(root) { (root && root.querySelectorAll ? root : document).querySelectorAll('select[data-daypick], input[data-daypick]').forEach(enhance); }
  if (window.MutationObserver) new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) if (ms[i].addedNodes.length) { scan(document); return; } }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', function () { scan(document); });
  scan(document);
  window.DayPick = { scan: scan, open: open };
})();
