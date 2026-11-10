/* Instant page changes (rebuild A5) – on unless turned off in Settings → Appearance → "Instant page changes".
   A tap on the menu doesn't load a new page: the dashboard stays open (unlocked, the data already in memory) and
   only the page's own part is swapped and started again. Normal loading is the fallback for anything unexpected.

   How a page is "left" without reloading: everything the page's scripts (the page bundle and tail.js) set up on
   things that stay – listeners on window/document/<html>/<body>, timers, observers, live connections, classes on
   <html>, additions to the head's own objects – is written down when it is made, and undone when you leave.
   Who made it is read from the call stack (head.js or not), so the head's own (the lock, the menu) stays.
   Off: nothing here runs at all – the switch is read once when a page loads. */
(function () {
  'use strict';
  var on = false;
  try { on = (JSON.parse(localStorage.getItem('dash.settings')) || {}).softNav !== false; } catch (e) { on = true; }   /* on unless turned off */
  window.SoftNav = { on: on, count: 0 };
  if (!on || !window.history || !window.history.pushState || !window.fetch || !window.DOMParser) return;

  var root = document.documentElement, epoch = 0, running = false;
  var PAGES = ['/cmd/', '/cmd/calendar/', '/cmd/finance/', '/cmd/habits/', '/cmd/travel/', '/cmd/work/', '/cmd/house/', '/cmd/people/', '/cmd/food/', '/cmd/papers/', '/cmd/wish/', '/cmd/goals/', '/cmd/admin/'];
  var KEEP = ['lock', 'dgNote'];        /* parts of the page that belong to the head (the lock screen, the problem note) */

  /* ---------- who made it: the head, or the page? ---------- */
  function byPage() {
    var st = (new Error()).stack || '', fr = st.split('\n').filter(function (l) { return /(https?:|\/cmd\/)/.test(l); });
    var caller = fr[2] || '';               /* 0: byPage, 1: the wrapper, 2: whoever called it */
    return !/\/dist\/head\.js/.test(caller);
  }
  var rec = { ls: [], iv: [], obs: [], ws: [], cls: [] };
  function stays(t) {
    return t === window || t === document || t === root || t === document.body || t === window.visualViewport || t === screen.orientation ||
      (window.MediaQueryList && t instanceof MediaQueryList) || (window.BroadcastChannel && t instanceof BroadcastChannel) || (navigator.serviceWorker && t === navigator.serviceWorker);
  }
  var addL = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opt) {
    if (fn && stays(this) && byPage()) {
      rec.ls.push([this, type, fn, opt]);
      /* started again after the page had loaded: "when the page is ready" is now */
      if (running && (type === 'DOMContentLoaded' || (type === 'load' && this === window))) { var f = fn; setTimeout(function () { try { typeof f === 'function' ? f.call(document, new Event(type)) : f.handleEvent(new Event(type)); } catch (e) { console.error(e); } }, 0); }
    }
    return addL.call(this, type, fn, opt);
  };
  var sI = window.setInterval, sT = window.setTimeout, rAF = window.requestAnimationFrame;
  window.setInterval = function (fn, ms) { var id = sI.apply(window, arguments); if (byPage()) rec.iv.push(id); return id; };
  window.setTimeout = function (fn, ms) {
    if (typeof fn === 'function' && byPage()) { var e0 = epoch, f = fn, args = [].slice.call(arguments, 2); return sT.call(window, function () { if (e0 === epoch) f.apply(window, args); }, ms); }
    return sT.apply(window, arguments);
  };
  if (rAF) window.requestAnimationFrame = function (fn) { if (byPage()) { var e0 = epoch; return rAF.call(window, function (t) { if (e0 === epoch) fn(t); }); } return rAF.call(window, fn); };
  ['MutationObserver', 'ResizeObserver', 'IntersectionObserver'].forEach(function (n) {
    var O = window[n]; if (!O) return;
    var W = function (cb) { var o = new O(cb); if (byPage()) rec.obs.push(o); return o; };
    W.prototype = O.prototype; window[n] = W;
  });
  if (window.WebSocket) { var WS = window.WebSocket, W2 = function (u, p) { var s = p === undefined ? new WS(u) : new WS(u, p); if (byPage()) rec.ws.push(s); return s; }; W2.prototype = WS.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) { W2[k] = WS[k]; }); window.WebSocket = W2; }
  var cAdd = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function () { if (this === root.classList && byPage()) for (var i = 0; i < arguments.length; i++) if (!root.classList.contains(arguments[i])) rec.cls.push(arguments[i]); return cAdd.apply(this, arguments); };

  /* the head's own objects as they are now (a page adds to them; that goes when you leave) */
  var snap = {}, regs = null;
  function takeSnap() {
    Object.keys(window).forEach(function (k) {
      var v; try { v = window[k]; } catch (e) { return; }
      if (!v || (typeof v !== 'object' && typeof v !== 'function')) { snap[k] = { v: v }; return; }
      var plain = Array.isArray(v) ? 'a' : Object.getPrototypeOf(v) === Object.prototype ? 'o' : '';
      snap[k] = { v: v, t: plain, c: plain === 'a' ? v.slice() : plain === 'o' ? Object.assign({}, v) : null };
    });
    regs = window.Vault && window.Vault._regs ? window.Vault._regs.mark() : null;
  }
  takeSnap(); delete snap.SoftNav;
  function restore() {
    Object.keys(snap).forEach(function (k) {
      var s = snap[k]; try { if (window[k] !== s.v) window[k] = s.v; } catch (e) {}
      if (s.t === 'a') { s.v.length = 0; Array.prototype.push.apply(s.v, s.c); }
      else if (s.t === 'o') { Object.keys(s.v).forEach(function (x) { if (!(x in s.c)) delete s.v[x]; }); Object.assign(s.v, s.c); }
    });
    if (regs && window.Vault && window.Vault._regs) window.Vault._regs.reset(regs);
  }
  function leave() {
    epoch++;
    rec.ls.forEach(function (l) { try { l[0].removeEventListener(l[1], l[2], l[3]); } catch (e) {} });
    rec.iv.forEach(function (id) { clearInterval(id); });
    rec.obs.forEach(function (o) { try { o.disconnect(); } catch (e) {} });
    rec.ws.forEach(function (s) { try { s.onclose = null; s.onerror = null; s.onmessage = null; s.close(); } catch (e) {} });
    rec.cls.forEach(function (c) { if (c !== 'unlocked' && c !== 'locked' && c !== 'resuming') root.classList.remove(c); });
    rec = { ls: [], iv: [], obs: [], ws: [], cls: [] };
    restore();
  }

  /* ---------- going to a page ---------- */
  var htmlCache = {};
  function page(u) { var x = new URL(u, location.href); return x.origin === location.origin && PAGES.indexOf(x.pathname) > -1 ? x : null; }
  function getHtml(u) { var k = u.pathname; return htmlCache[k] ? Promise.resolve(htmlCache[k]) : fetch(u.pathname, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) { htmlCache[k] = t; return t; }); }
  function srcOf(doc, re) { var s = [].filter.call(doc.querySelectorAll('script[src]'), function (x) { return re.test(x.getAttribute('src')); })[0]; return s ? new URL(s.getAttribute('src'), s.ownerDocument === document ? location.href : base).href : ''; }
  var base = location.href, busy = false, HEAD = '';
  sT.call(window, function () { HEAD = srcOf(document, /dist\/head\.js/); }, 0);   /* the head that is running (its tag goes with the first page swap) */
  function go(u, pop) {
    if (busy) return; busy = true;
    var full = function () { location.href = u.href; };
    getHtml(u).then(function (text) {
      var doc = new DOMParser().parseFromString(text, 'text/html');
      base = u.href;
      /* a new version of the dashboard: load it properly */
      if (!HEAD || srcOf(doc, /dist\/head\.js/) !== HEAD) return full();
      var scripts = [].filter.call(doc.querySelectorAll('body script[src]'), function (x) { return !/dist\/head\.js/.test(x.getAttribute('src')); }).map(function (x) { return new URL(x.getAttribute('src'), u.href).href; });
      var swap = function () {
        leave();
        if (!pop) history.pushState({ soft: 1 }, '', u.href);
        document.title = doc.title;
        /* the page's own style sheets */
        var want = [].map.call(doc.querySelectorAll('head link[rel="stylesheet"]'), function (l) { return new URL(l.getAttribute('href'), u.href).href; });
        [].forEach.call(document.querySelectorAll('head link[rel="stylesheet"]'), function (l) { if (want.indexOf(l.href) < 0) l.remove(); });
        want.forEach(function (h) { if (![].some.call(document.querySelectorAll('head link[rel="stylesheet"]'), function (l) { return l.href === h; })) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; document.head.appendChild(l); } });
        /* the page itself; the lock screen stays the one that is running */
        var body = document.body, keep = KEEP.map(function (id) { return document.getElementById(id); }).filter(Boolean);
        [].slice.call(body.childNodes).forEach(function (n) { if (keep.indexOf(n) < 0) body.removeChild(n); });
        [].slice.call(body.attributes).forEach(function (a) { body.removeAttribute(a.name); });
        [].forEach.call(doc.body.attributes, function (a) { body.setAttribute(a.name, a.value); });
        var first = body.firstChild;
        [].slice.call(doc.body.childNodes).forEach(function (n) {
          if (n.nodeType === 1 && (n.tagName === 'SCRIPT' || (n.id && KEEP.indexOf(n.id) > -1))) return;
          body.insertBefore(document.importNode(n, true), first);
        });
        window.scrollTo(0, pop && history.state && history.state.y ? history.state.y : 0);
        window.dispatchEvent(new Event('softnav:swap'));
      };
      var vt = document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches ? document.startViewTransition(swap) : (swap(), null);
      return (vt ? vt.updateCallbackDone : Promise.resolve()).then(function () { return run(scripts); }).then(function () {
        window.SoftNav.count++;
        window.dispatchEvent(new Event('softnav:done'));
      });
    }).catch(function (e) { try { sessionStorage.setItem('softnav.err', String((e && e.stack) || e).slice(0, 500)); } catch (er) {} if (window.Diag && window.Diag.log) window.Diag.log('softnav', (e && e.message) || String(e), 'softnav.js'); full(); })
      .then(function () { busy = false; });
  }
  /* the page bundle and tail.js run again, in order (from the browser's cache) */
  function run(srcs) {
    running = true;
    return srcs.reduce(function (p, src) {
      return p.then(function () { return new Promise(function (ok) { var s = document.createElement('script'); s.src = src; s.async = false; s.onload = s.onerror = function () { s.remove(); ok(); }; document.body.appendChild(s); }); });
    }, Promise.resolve()).then(function () { running = false; window.dispatchEvent(new Event('resize')); }, function () { running = false; });
  }

  addL.call(document, 'click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]'); if (!a || a.target || a.hasAttribute('download')) return;
    var u = page(a.href); if (!u) return;
    if (u.pathname === location.pathname && u.search === location.search) { if (u.hash) return; e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!root.classList.contains('unlocked')) return;          /* locked: the lock screen does its job on a normal load */
    e.preventDefault();
    try { history.replaceState(Object.assign({}, history.state || {}, { y: window.scrollY }), ''); } catch (er) {}
    go(u, false);
  });
  addL.call(window, 'popstate', function () { var u = page(location.href); if (u && root.classList.contains('unlocked')) go(u, true); else location.reload(); });
  /* the pages you're likely to open next are fetched while nothing else happens */
  addL.call(window, 'load', function () { sT.call(window, function () { [].forEach.call(document.querySelectorAll('.tabbar a[href]'), function (a) { var u = page(a.href); if (u && u.pathname !== location.pathname) getHtml(u).catch(function () {}); }); }, 2500); });
})();
