/* The live line under a page's title (Phase G, the new look): the few facts that matter right now –
   "Fleksi −7 t 30 min · Neste møte 13:00 · 2 dokumenter venter". A page calls
     PageLive.set([{ t: 'Fleksi −7 t 30 min', c: 'neg' }, { t: 'Neste møte 13:00', href: '#…' }, 'Plain text'])
   whenever its data changes; an empty list takes the line away and the page's description comes back.
   Head module: it only defines the function, so a page bundle can call it at any time, and it finds the
   page's own title area each time (instant page changes swap the page under it). */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hero() { return document.querySelector('main.fp .fp-hero') || document.querySelector('.fp-hero, .tv-hero'); }
  function html(list) {
    return (list || []).filter(function (x) { return x && (typeof x === 'string' ? x.trim() : x.t); }).map(function (x) {
      if (typeof x === 'string') x = { t: x };
      var cls = x.c ? ' class="' + esc(x.c) + '"' : '';
      return x.href ? '<span' + cls + '><a href="' + esc(x.href) + '">' + esc(x.t) + '</a></span>' : '<span' + cls + '>' + esc(x.t) + '</span>';
    }).join('');
  }
  window.PageLive = {
    set: function (list) {
      var h = hero(); if (!h) return;
      var p = h.querySelector('.fp-live'), inner = html(list);
      if (!p) {
        if (!inner) return;
        p = document.createElement('p'); p.className = 'fp-live'; p.setAttribute('aria-live', 'polite');
        var t = h.querySelector('h1'); if (t && t.nextSibling) h.insertBefore(p, t.nextSibling); else h.appendChild(p);
      }
      if (p._h !== inner) { p._h = inner; p.innerHTML = inner; }
      h.classList.toggle('has-live', !!inner);
    },
    text: function () { var h = hero(), p = h && h.querySelector('.fp-live'); return p ? p.textContent : ''; }
  };
})();
