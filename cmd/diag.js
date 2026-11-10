/* Diagnostics: catches errors, keeps a small log on this device, shows calm notices, and checks
   itself once a day (Settings → Diagnostics).
   - Every uncaught error and unhandled promise rejection goes into localStorage "dash.errlog"
     (newest 40, repeats counted). Messages are scrubbed: numbers, e-mail addresses and quoted text
     are masked, so no amounts, names or other personal data end up in the log or the report.
   - window.Diag.notice(id, text, action, fn): one calm message at the bottom with "Try again".
   - Sync (lock.js) and Apple Health (ahealth.js) report here; the self-check runs once a day after
     unlocking and only says something when a check fails.
   Loaded first on every page (head bundle), so it sees errors in everything after it. */
(function () {
  "use strict";
  var LOG = 'dash.errlog', ST = 'dash.diag', MAX = 60;
  var nb = function () { return !!(window.I18N && window.I18N.lang === 'nb'); };
  function L(en, no) { return nb() ? no : en; }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* no personal or financial data: mask numbers, e-mails, quoted text and long words */
  function scrub(s) {
    return String(s == null ? '' : s)
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
      .replace(/(["'“‘«])[^"'”’»]{1,}?(["'”’»])/g, '$1…$2')
      .replace(/https?:\/\/[^\s)]+/g, function (u) { try { return new URL(u).pathname.replace(/[^/]+\.js.*$/, function (f) { return f.split('?')[0]; }); } catch (e) { return '<url>'; } })
      .replace(/\d+([.,:\s]\d+)*/g, '#')
      .slice(0, 180);
  }
  function page() { var m = location.pathname.match(/\/cmd\/([a-z]+)\//); return m ? m[1] : 'home'; }
  /* which version of the app logged it: the shared bundle's hash (known once the page has parsed) */
  var VER = '';
  function ver() {
    if (VER) return VER;
    var sc = document.querySelector('script[src*="dist/tail.js"]'), m = sc && sc.getAttribute('src').match(/v=(\w+)/);
    return (VER = m ? m[1] : '');
  }
  var T0 = Date.now();
  function where(stack, file, line) {
    var m = String(stack || '').match(/\/cmd\/(?:dist\/)?([\w-]+\.js)[^:\s]*:(\d+)/);
    if (m) return m[1] + ':' + m[2];
    if (file) { var f = String(file).split('?')[0].split('/').pop(); return f + (line ? ':' + line : ''); }
    return '';
  }
  /* log(kind, message, where, opts): opts.raw keeps numbers (only for our own messages, e.g. page times), opts.p = page */
  function log(kind, msg, at, opts) {
    opts = opts || {};
    var l = readJSON(LOG, []); if (!Array.isArray(l)) l = [];
    var m = opts.raw ? String(msg).slice(0, 180) : scrub(msg), a = String(at || '').slice(0, 90), now = Date.now(), pg = opts.p || page();
    var hit = l.filter(function (x) { return x.k === kind && x.m === m && x.a === a; })[0];
    var v = ver() || '?';
    if (hit) { hit.n = (hit.n || 1) + 1; hit.t = now; hit.p = pg; hit.v = v; }
    else l.push({ k: kind, m: m, a: a, p: pg, t: now, n: 1, v: v });
    l.sort(function (x, y) { return x.t - y.t; });
    writeJSON(LOG, l.slice(-MAX));
    try { window.dispatchEvent(new Event('diag:log')); } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && t.tagName) {            // a script, style or image that didn't load
      var u = t.src || t.href || ''; if (!/\/cmd\//.test(u)) return;
      log('load', t.tagName.toLowerCase() + ' ' + u, '');
      return;
    }
    if (!e.message || /^Script error\.?$/.test(e.message)) return;
    log('error', e.message, where(e.error && e.error.stack, e.filename, e.lineno));
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason; if (!r) return;
    if (r && r.name === 'AbortError') return;
    log('promise', r.message || String(r), where(r.stack));
  });
  /* the bundles wrap each file in try/catch (cmd/build.py) and report here */
  window.__dlog = function (e, file) { log('script', (e && e.message) || String(e), file + (e && e.stack ? ' ' + where(e.stack) : '')); };

  /* once the page has parsed: stamp what was logged before the version was known, and when the app has been
     updated, drop what older versions logged – those may already be fixed */
  function settle() {
    var v = ver(); if (!v) return;
    var l = readJSON(LOG, []); if (!Array.isArray(l)) return;
    l.forEach(function (x) { if (x.v === '?' && x.t >= T0) x.v = v; });
    var s = readJSON(ST, {});
    if (s.ver !== v) { l = l.filter(function (x) { return x.v === v; }); s.ver = v; s.verAt = Date.now(); writeJSON(ST, s); }
    writeJSON(LOG, l);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settle); else settle();
  var IN_TEST = /[?&]selftest=1/.test(location.search) || window !== window.top;   /* Admin's "Test everything" runs pages in a frame */
  function root() { return document.documentElement; }
  function unlocked() { return root().classList.contains('unlocked'); }

  /* ---------- the last few taps, as element names only (never the text on them) ---------- */
  var crumbs = [];
  function label(el) {
    if (!el || !el.tagName) return '';
    var t = (el.closest && el.closest('button, a, input, select, textarea, label, summary, [role="button"], [data-go], [data-tab]')) || el;
    var s = t.tagName.toLowerCase();
    if (t.id) s += '#' + t.id;
    var da = Array.prototype.filter.call(t.attributes || [], function (a) { return /^data-/.test(a.name) && !/^data-(noi18n|aos|i18n)/.test(a.name); }).slice(0, 2)
      .map(function (a) { return '[' + a.name.slice(5) + (a.value && a.value.length < 26 && /^[\w\-\/:.|]+$/.test(a.value) ? '=' + a.value : '') + ']'; }).join('');
    if (!t.id && !da && typeof t.className === 'string' && t.className.trim()) s += '.' + t.className.trim().split(/\s+/).slice(0, 2).join('.');
    if (t.tagName === 'A') { var h = t.getAttribute('href') || ''; if (/^(\/cmd\/|[a-z]+\/$|#)/.test(h)) s += '[' + h.split('?')[0].slice(0, 30) + ']'; }
    return (s + da).slice(0, 80);
  }
  document.addEventListener('click', function (e) { crumbs.push({ t: Date.now(), a: label(e.target), p: page() }); if (crumbs.length > 10) crumbs.shift(); }, true);

  /* ---------- freezes: a watchdog while the page is open, and a heartbeat that notices a page that died ---------- */
  var HB = 'dash.hb';
  function beat(closed) {
    if (IN_TEST) return;
    try { sessionStorage.setItem(HB, JSON.stringify({ t: Date.now(), p: page(), v: document.visibilityState === 'visible', c: crumbs.slice(-3).map(function (x) { return x.a; }), x: !!closed })); } catch (e) {}
  }
  if (!IN_TEST) {
    try {
      var prev = JSON.parse(sessionStorage.getItem(HB) || 'null'), gap = prev ? Date.now() - prev.t : 0;
      /* the last page was visible, never said goodbye and stopped beating: it froze (or the system closed it) */
      if (prev && !prev.x && prev.v && gap > 2500 && gap < 15 * 6e4) {
        log('freeze', 'The page stopped responding or was closed while open', prev.c && prev.c.length ? L('after ', 'etter ') + prev.c.join(' › ') : '', { p: prev.p, raw: true });
        setTimeout(function () { notice('freeze', L('The dashboard stopped responding last time. It has been noted – want to send a report?', 'Dashbordet sluttet å svare sist. Det er notert – vil du sende en rapport?'), L('Report', 'Rapporter'), function () { openPanel('report'); }, 'bug'); }, 2500);
      }
    } catch (e) {}
    beat(false);
    var lastTick = Date.now(), lastVis = !document.hidden;
    setInterval(function () {
      var now = Date.now(), vis = !document.hidden, g = now - lastTick;
      /* a long gap while visible both before and after = the page was stuck (gaps over 2 minutes are a sleeping computer) */
      if (vis && lastVis && g > 4000 && g < 120000) log('freeze', 'The page was stuck for ' + Math.round(g / 1000) + ' s', crumbs.length ? L('after ', 'etter ') + crumbs.slice(-3).map(function (x) { return x.a; }).join(' › ') : '', { raw: true });
      lastTick = now; lastVis = vis; beat(false);
    }, 1000);
    document.addEventListener('visibilitychange', function () { lastTick = Date.now(); lastVis = !document.hidden; beat(false); });
    window.addEventListener('pagehide', function () { beat(true); });
  }

  /* ---------- server calls that fail (own Worker and the outside services) ---------- */
  var SERVICES = { 'api.entur.io': 'Entur', 'api.open-meteo.com': 'Weather', 'geocoding-api.open-meteo.com': 'Weather search', 'api.frankfurter.app': 'Exchange rates', 'api.frankfurter.dev': 'Exchange rates',
    'nominatim.openstreetmap.org': 'Addresses', 'api.github.com': 'GitHub', 'raw.githubusercontent.com': 'GitHub', 'hvakosterstrommen.no': 'Power prices' };
  function svc(url) {
    var u; try { u = new URL(url, location.href); } catch (e) { return null; }
    if (u.origin === location.origin) { var m = u.pathname.match(/^\/cmd\/api\/([a-z]+)/); return m ? 'api/' + m[1] : null; }
    return SERVICES[u.hostname.replace(/^www\./, '')] || null;
  }
  var netOk = {};
  function netCheck(url, status, init) {
    var s = svc(url); if (!s) return;
    var hd = init && init.headers; if (hd && (hd['X-Diag-Probe'] || (hd.get && hd.get('X-Diag-Probe')))) return;
    var method = String((init && init.method) || 'GET').toUpperCase();
    if (status >= 200 && status < 400) { netOk[s] = Date.now(); return; }
    if (!status && navigator.onLine === false) return;                     // offline: the sync notice already says so
    if (s === 'api/vault' && status === 404) return;                         // nothing saved on the server yet
    if (status === 409 || status === 412) return;                            // "changed elsewhere" – handled where it happens
    log('net', s + ' ' + method + ' ' + (status || 'no answer'), '', { raw: true });
  }
  if (window.fetch) {
    var of = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var pr = of.apply(this, arguments);
      try { pr.then(function (r) { netCheck(url, r.status, init); }, function (e) { if (!e || e.name !== 'AbortError') netCheck(url, 0, init); }); } catch (e) {}
      return pr;
    };
  }

  /* ---------- how fast each page opens on this device (only when it unlocks by itself) ---------- */
  var SPEED = 'dash.speed';
  (function () {
    var typed = false, done = false;
    document.addEventListener('input', function (e) { if (e.target && /^lock/.test(e.target.id || '')) typed = true; }, true);
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#lockPk, #lockSubmit')) typed = true; }, true);
    function check() {
      if (done || !unlocked()) return; done = true;
      var ms = Math.round(performance.now());
      if (typed || IN_TEST || ms > 15000) return;
      var all = readJSON(SPEED, {}), pg = page(), list = Array.isArray(all[pg]) ? all[pg] : [];
      if (list.length >= 5) {
        var med = list.slice().sort(function (a, b) { return a - b; })[Math.floor(list.length / 2)];
        if (ms > Math.max(1500, med * 1.8)) log('slow', 'Opened in ' + (ms / 1000).toFixed(1) + ' s (usually ' + (med / 1000).toFixed(1) + ' s)', '', { raw: true });
      }
      list.push(ms); all[pg] = list.slice(-20); writeJSON(SPEED, all);
    }
    new MutationObserver(check).observe(root(), { attributes: true, attributeFilter: ['class'] });
    check();
  })();

  /* ---------- broken things on the page: "undefined", "NaN", pictures that don't load, out-of-place bars ---------- */
  var seen = {};
  function once(sig) { if (seen[sig]) return false; seen[sig] = 1; return true; }
  function spot(el) {
    var c = el.closest && el.closest('[data-tool], section[id], .card[id], [id]');
    if (!c) return L('the page', 'siden');
    return c.dataset && c.dataset.tool ? 'card ' + c.dataset.tool : '#' + c.id;
  }
  var BAD = /(^|[^\w])(undefined|NaN|\[object Object\]|Invalid Date)([^\w]|$)/;
  function overlayOpen() {
    var r = root(), b = document.body;
    if (r.classList.contains('wrs-open') || (b && (b.classList.contains('qa-open') || b.classList.contains('st-open') || b.classList.contains('rp-open'))) || !!document.querySelector('dialog[open], .sheet.open, .kit-sheet.open, #settings.open, .st-panel.open, .sh-prev-bg.open')) return true;
    return !!coverAll();
  }
  /* any popup at all: a layer on the page itself that covers (nearly) the whole window and sits on top – so a new popup
     no longer needs adding to the list above before it stops giving a false "two things cover each other" (2026-11-10) */
  function coverAll() {
    var b = document.body; if (!b) return null;
    for (var i = b.children.length - 1; i >= 0; i--) {
      var e = b.children[i], cs = getComputedStyle(e);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .2 || cs.pointerEvents === 'none') continue;
      if (!(parseInt(cs.zIndex, 10) > 0) || e.id === 'lock' || e.classList.contains('bg')) continue;
      var rr = e.getBoundingClientRect();
      if (rr.width >= innerWidth * .9 && rr.height >= innerHeight * .9) return e;
    }
    return null;
  }
  function scanContent(found) {
    var main = document.body; if (!main) return;   /* the whole page – page heroes sit outside <main> */
    var w = document.createTreeWalker(main, 4), n, hits = 0;
    while ((n = w.nextNode()) && hits < 4) {
      var v = n.nodeValue; if (!v || v.length > 240) continue;
      var m = v.match(BAD); if (!m) continue;
      var el = n.parentElement;
      if (!el || !el.offsetParent || el.closest('script, style, textarea, code, pre, input, [contenteditable], .dg-errs, .cr-errs, .dgu, #wrStudio')) continue;
      hits++; var sig = 'c|' + m[2] + '|' + spot(el);
      if (once(sig)) { log('content', 'Shows "' + m[2] + '" in ' + spot(el), '', { raw: true }); found.push(sig); }
    }
    /* English left in Norwegian mode (own words and names are skipped, like the translator does) */
    if (nb() && window.I18N && window.I18N.skip) {
      var EN = /\b(the|and|your|you|with|this|from|when|yet|here|tap|items|week|month|show|edit|save|delete|nothing|today|tomorrow|shows|switch|each|every|next|days|paid|owe|owes)\b/i;
      var w2 = document.createTreeWalker(main, 4), n2, lh = 0, sk = window.I18N.skip + ',.dgu code,.dg-errs,.rp-doc,.ad-log,[contenteditable]';
      while ((n2 = w2.nextNode()) && lh < 6) {
        var tv = (n2.nodeValue || '').trim(); if (tv.length < 3 || tv.length > 200 || !EN.test(tv)) continue;
        var pe2 = n2.parentElement; if (!pe2 || !pe2.offsetParent || pe2.closest(sk)) continue;
        var sg = 'l|' + tv.slice(0, 60);
        if (once(sg)) { lh++; log('lang', scrub(tv).slice(0, 90), spot(pe2), { raw: true }); found.push(sg); }
      }
    }
    Array.prototype.forEach.call(document.images, function (img) {
      var src = img.getAttribute('src') || '';
      if (!src || /^data:/.test(src) || !img.complete || img.naturalWidth || !img.offsetParent) return;
      var sig = 'i|' + src.split('?')[0].slice(-60);
      if (once(sig)) { log('content', 'A picture didn’t load in ' + spot(img), src.split('?')[0].replace(/^https?:\/\/[^/]+/, '').slice(0, 80), { raw: true }); found.push(sig); }
    });
  }
  function scanLayout(found) {
    var iw = innerWidth, over = root().scrollWidth - iw;
    if (over > 4 && !overlayOpen()) {
      var cul = null, els = (document.querySelector('main') || document.body).getElementsByTagName('*');
      for (var i = 0; i < els.length && i < 4000; i++) {
        var r = els[i].getBoundingClientRect(); if (!r.width || r.right <= iw + 4) continue;
        var p = els[i].parentElement, pr = p && p.getBoundingClientRect();
        if (!pr || pr.right <= iw + 1) { cul = els[i]; break; }
      }
      var sig = 'w|' + (cul ? label(cul) : '');
      if (once(sig)) { log('layout', 'The page is ' + over + ' px wider than the screen', cul ? label(cul) + ' · ' + spot(cul) : '', { raw: true }); found.push(sig); }
    }
    /* form fields that spill out of their box into the next one (Safari's date fields did) */
    Array.prototype.forEach.call(document.querySelectorAll('input, select, textarea'), function (f) {
      if (!f.offsetParent || f.type === 'checkbox' || f.type === 'radio' || f.type === 'hidden') return;
      var fr = f.getBoundingClientRect(), pe = f.parentElement; if (!pe || !fr.width) return;
      var pr2 = pe.getBoundingClientRect(), ov = getComputedStyle(pe).overflowX;
      if (ov !== 'visible' || !pr2.width) return;
      var out2 = Math.max(pr2.left - fr.left, fr.right - pr2.right);
      if (out2 > 3) { var s0 = 'f|' + label(f); if (once(s0)) { log('layout', 'A field sticks out of its box by ' + Math.round(out2) + ' px', label(f) + ' · ' + spot(f), { raw: true }); found.push(s0); } }
    });
    /* bars (sticky/fixed) that stick out of their box, or fixed buttons sitting on top of each other */
    var fixed = [], all = document.body.getElementsByTagName('*');
    for (var j = 0; j < all.length && j < 4000; j++) {
      var e = all[j], cs = getComputedStyle(e), pos = cs.position;
      if (pos !== 'sticky' && pos !== 'fixed') continue;
      if (!e.offsetParent && pos !== 'fixed') continue;
      var rr = e.getBoundingClientRect(); if (rr.width < 20 || rr.height < 14) continue;
      if (pos === 'sticky' && e.parentElement) {
        var pb = e.parentElement.getBoundingClientRect();
        var out = Math.max(pb.left - rr.left, rr.right - pb.right);
        if (out > 8 && pb.width > 0) { var s1 = 's|' + label(e); if (once(s1)) { log('layout', 'A bar sticks out of its box by ' + Math.round(out) + ' px', label(e) + ' · ' + spot(e), { raw: true }); found.push(s1); } }
      } else if (pos === 'fixed' && rr.bottom > 0 && rr.top < innerHeight && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > .2 && e.querySelector('button, a')) fixed.push([e, rr]);
    }
    if (!overlayOpen()) for (var a = 0; a < fixed.length; a++) for (var b2 = a + 1; b2 < fixed.length; b2++) {
      var A = fixed[a], B = fixed[b2]; if (A[0].contains(B[0]) || B[0].contains(A[0])) continue;
      var ix = Math.max(0, Math.min(A[1].right, B[1].right) - Math.max(A[1].left, B[1].left)), iy = Math.max(0, Math.min(A[1].bottom, B[1].bottom) - Math.max(A[1].top, B[1].top));
      var small = Math.min(A[1].width * A[1].height, B[1].width * B[1].height);
      if (ix * iy > small * .3) { var s2 = 'o|' + label(A[0]) + '|' + label(B[0]); if (once(s2)) { log('layout', 'Two things on the screen cover each other', label(A[0]) + ' + ' + label(B[0]), { raw: true }); found.push(s2); } }
    }
  }
  function scanNow() {
    var found = [];
    if (document.hidden || !unlocked() || !document.body) return found;
    try { scanContent(found); } catch (e) {}
    try { scanLayout(found); } catch (e) {}
    return found;
  }
  var scanT = null, lastScan = 0;
  function later() {
    clearTimeout(scanT);
    scanT = setTimeout(function () {
      var go = function () { lastScan = Date.now(); scanNow(); };
      if (Date.now() - lastScan < 20000) { later(); return; }
      if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 3000 }); else go();
    }, 5000);
  }
  function startScans() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', startScans); return; }
    new MutationObserver(function (list) {
      if (!unlocked()) return;
      if (list.every(function (m) { var t = m.target; return t.closest && t.closest('#dgNote, .dgu'); })) return;
      later();
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', later);
    later();
  }
  startScans();

  /* status marks (no personal data): last good sync, health pull, self-check … */
  function mark(k, v) { var s = readJSON(ST, {}); s[k] = v === undefined ? Date.now() : v; writeJSON(ST, s); }
  function state() { return readJSON(ST, {}); }

  /* ---------- one calm notice at a time ---------- */
  var cur = null;
  function notice(id, text, action, fn, icon) {
    if (!document.body) { document.addEventListener('DOMContentLoaded', function () { notice(id, text, action, fn, icon); }); return; }
    var el = document.getElementById('dgNote');
    if (!el) {
      el = document.createElement('div'); el.id = 'dgNote'; el.className = 'dg-note'; el.setAttribute('role', 'status'); el.setAttribute('data-noi18n', '');
      document.body.appendChild(el);
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-dgx]')) { hide(cur && cur.id); return; }
        var b = e.target.closest('[data-dgact]'); if (!b || !cur) return;
        var f = cur.fn; hide(cur.id); if (f) try { f(); } catch (x) { log('error', x.message, 'notice'); }
      });
    }
    cur = { id: id, fn: fn };
    el.innerHTML = '<i class="bi bi-' + (icon || 'cloud-slash') + '"></i><span>' + esc(text) + '</span>' +
      (action ? '<button type="button" class="dg-act" data-dgact>' + esc(action) + '</button>' : '') +
      '<button type="button" class="dg-x" data-dgx aria-label="' + L('Close', 'Lukk') + '"><i class="bi bi-x"></i></button>';
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('show'); });
  }
  function hide(id) {
    var el = document.getElementById('dgNote');
    if (!el || !cur || (id && cur.id !== id)) return;
    cur = null; el.classList.remove('show'); setTimeout(function () { if (!cur) el.hidden = true; }, 300);
  }

  /* ---------- retry with backoff (used for Worker calls) ---------- */
  function retry(fn, opts) {
    opts = opts || {};
    var waits = opts.waits || [3000, 10000, 30000], n = 0;
    return new Promise(function (resolve, reject) {
      (function go() {
        Promise.resolve().then(fn).then(resolve, function (e) {
          if (n >= waits.length || (opts.stop && opts.stop(e))) { reject(e); return; }
          setTimeout(go, waits[n++]);
        });
      })();
    });
  }

  /* ---------- the daily self-check ---------- */
  function dkey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function daysAgo(t) { return t ? (Date.now() - t) / 864e5 : Infinity; }
  function selfCheck(manual) {
    var V = window.Vault, d = V && V.get && V.get(), issues = [], checks = [];
    function bad(id, en, no) { issues.push({ id: id, t: L(en, no) }); }
    if (!d) return Promise.resolve(null);
    /* 1. data shape */
    var shape = 0;
    ['expenses', 'savings', 'networth', 'bills'].forEach(function (k) { if (d[k] != null && !Array.isArray(d[k])) shape++; });
    if (Array.isArray(d.expenses)) d.expenses.forEach(function (e) { if (!e || typeof e !== 'object' || !/^\d{4}-\d{2}-\d{2}/.test(e.date || '') || !isFinite(+e.amount)) shape++; });
    ['dash.todos', 'dash.notes', 'dash.goals', 'dash.links'].forEach(function (k) { var v = readJSON(k, null); if (v != null && !Array.isArray(v) && typeof v !== 'object') shape++; });
    ['dash.settings', 'dash.tools', 'dash.profile', 'dash.travel', 'dash.calendar', 'dash.habits'].forEach(function (k) { var v = readJSON(k, null); if (v != null && (typeof v !== 'object' || Array.isArray(v))) shape++; });
    checks.push({ id: 'shape', ok: !shape });
    if (shape) bad('shape', shape + ' saved item(s) look damaged. The pages skip them – nothing else is affected.', shape + ' lagrede ting ser ødelagte ut. Sidene hopper over dem – ingenting annet påvirkes.');
    /* 2. sync recent */
    var s = state(), syncAge = daysAgo(s.syncOk), everSynced = !!s.syncOk;
    checks.push({ id: 'sync', ok: !everSynced || syncAge < 2 });
    if (everSynced && syncAge >= 2) bad('sync', 'Not synced for ' + Math.floor(syncAge) + ' days. Changes are only on this device.', 'Ikke synkronisert på ' + Math.floor(syncAge) + ' dager. Endringene finnes bare på denne enheten.');
    /* 3. Apple Health import recent */
    var F = window.Features, hOn = F && F.on && F.on('ahealth');
    if (hOn) {
      var days = (d.health && d.health.days) || {}, last = Object.keys(days).sort().pop(), age = last ? (Date.now() - new Date(last + 'T12:00').getTime()) / 864e5 : Infinity;
      var imp = d.health && d.health.last ? (Date.now() - d.health.last) / 36e5 : null;
      if (imp != null && imp >= 36 && age < 3) { checks.push({ id: 'health', ok: false }); bad('health', 'Nothing from Apple Health for ' + Math.round(imp) + ' hours. Check the Shortcut’s automation on the iPhone.', 'Ingenting fra Apple Helse på ' + Math.round(imp) + ' timer. Sjekk automasjonen til snarveien på iPhonen.'); }
      else checks.push({ id: 'health', ok: age < 3 });
      if (age >= 3 && last) bad('health', 'No Apple Health numbers since ' + last.split('-').reverse().join('.') + '. Check the Shortcut’s automation on the iPhone.', 'Ingen tall fra Apple Helse siden ' + last.split('-').reverse().join('.') + '. Sjekk automasjonen til snarveien på iPhonen.');
    }
    /* 4. errors today */
    var errs = readJSON(LOG, []).filter(function (x) { return daysAgo(x.t) < 1 && (!ver() || x.v === ver()) && x.k !== 'lang'; }).reduce(function (a, x) { return a + (x.n || 1); }, 0);
    checks.push({ id: 'errors', ok: errs < 10 });
    if (errs >= 10) bad('errors', errs + ' errors in the last day – see Settings → Diagnostics.', errs + ' feil siste døgn – se Innstillinger → Diagnostikk.');
    /* 4b. changes that haven't reached the server */
    var V2 = window.Vault, ss = V2 && V2.syncState ? V2.syncState() : s.syncState, hrs = s.syncOk ? (Date.now() - s.syncOk) / 36e5 : 0;
    if (everSynced && ss !== 'ok' && hrs >= 1 && syncAge < 2) { checks.push({ id: 'pending', ok: false }); bad('pending', 'Changes on this device haven’t reached the server for ' + Math.round(hrs) + ' hours.', 'Endringer på denne enheten har ikke nådd serveren på ' + Math.round(hrs) + ' timer.'); }
    else checks.push({ id: 'pending', ok: true });
    /* 6. backup */
    var lb = Math.max(+(localStorage.getItem('dash.lastBackup') || 0), +(d.lastBackup || 0)), bAge = daysAgo(lb);
    checks.push({ id: 'backup', ok: bAge <= 30 });
    if (bAge > 30) bad('backup', lb ? 'Your last encrypted backup is ' + Math.floor(bAge) + ' days old.' : 'You haven’t downloaded an encrypted backup yet.', lb ? 'Den siste krypterte sikkerhetskopien er ' + Math.floor(bAge) + ' dager gammel.' : 'Du har ikke lastet ned en kryptert sikkerhetskopi ennå.');
    /* 7. money that doesn't add up */
    var acc = Array.isArray(d.accounts) ? d.accounts : [], fx = d.budget && Array.isArray(d.budget.fixed) ? d.budget.fixed : [], today = dkey(new Date()), money = 0;
    var orphan = fx.filter(function (f) { return f && f.src === 'loan' && !acc.some(function (a) { return 'loan-' + a.id === f.id; }); });
    if (orphan.length) { money++; bad('orphan', orphan.length + ' fixed cost(s) belong to a loan that no longer exists.', orphan.length + ' fast(e) kostnad(er) hører til et lån som ikke finnes lenger.'); }
    var Lo = window.Loans;
    if (Lo && Lo.owedNow) {
      var doneOwe = acc.filter(function (a) { return a && a.kind === 'debt' && a.owe && Lo.owedNow(a) <= 0.5; });
      if (doneOwe.length) { money++; bad('owedone', doneOwe.length + ' pay-back plan(s) are paid off – remove them under Shared home → Paying back.', doneOwe.length + ' tilbakebetalingsplan(er) er nedbetalt – fjern dem under Felles hjem → Betaler tilbake.'); }
    }
    var later45 = dkey(new Date(Date.now() + 45 * 864e5)), fut = acc.filter(function (a) { return a && a.kind === 'debt' && a.asOf && a.asOf > later45; });
    if (fut.length) { money++; bad('future', fut.length + ' loan(s) start more than 45 days from now – they don’t count in your budget until then.', fut.length + ' lån starter mer enn 45 dager fram i tid – de teller ikke i budsjettet før da.'); }
    var Sh = window.Shared;
    if (Sh && Sh.partner && Sh.sides && Sh.partner()) { var pid = Sh.partner().id, sd = Sh.sides(pid), bl = Sh.balance(pid); if (Math.abs(sd.net - bl) > 1) { money++; bad('sides', 'Shared home: the two sides don’t add up to the total.', 'Felles hjem: de to sidene stemmer ikke med totalen.'); } }
    checks.push({ id: 'money', ok: !money });
    /* 8. files: on the server, and how full the free storage is */
    var files = (window.FileSync && everSynced && navigator.onLine !== false) ? window.FileSync.list().then(function (srv) {
      if (!srv) return;
      var F2 = window.Features, tools = F2 && F2.tools ? F2.tools() : {}, gone = Array.isArray(tools.filegone) ? tools.filegone : [], refs = {};
      (function walk(o, k) {
        if (typeof o === 'string') { if (k !== 'id' && /^(pp|inv|tk|rk|pj|fdv)-[A-Za-z0-9_-]{3,90}$/.test(o)) refs[o] = 1; return; }
        if (o && typeof o === 'object') for (var key in o) if (Object.prototype.hasOwnProperty.call(o, key) && key !== 'filegone' && key !== 'fold') walk(o[key], key);
      })(tools, '');
      var miss = Object.keys(refs).filter(function (id) { return !(id in srv) && gone.indexOf(id) < 0; });
      checks.push({ id: 'files', ok: !miss.length });
      if (miss.length) bad('files', miss.length + ' photo(s) or file(s) aren’t on the server – they’re only on one device, or missing. Open House or Papers on the device that has them.', miss.length + ' bilde(r) eller fil(er) er ikke på serveren – de finnes bare på én enhet, eller mangler. Åpne Bolig eller Papirer på enheten som har dem.');
      var used = window.FileSync.state().bytes || 0, pct = used / 1073741824 * 100;
      checks.push({ id: 'space', ok: pct < 80 });
      if (pct >= 80) bad('space', 'File storage is ' + Math.round(pct) + ' % full (free 1 GB).', 'Fillagringen er ' + Math.round(pct) + ' % full (gratis 1 GB).');
    }).catch(function () {}) : Promise.resolve();
    /* 9. space on this device */
    var dev = navigator.storage && navigator.storage.estimate ? navigator.storage.estimate().then(function (e) {
      var p = e && e.quota ? e.usage / e.quota : 0;
      checks.push({ id: 'device', ok: p < 0.8 });
      if (p >= 0.8) bad('device', 'This device’s storage for the dashboard is ' + Math.round(p * 100) + ' % full.', 'Lagringen for dashbordet på denne enheten er ' + Math.round(p * 100) + ' % full.');
    }).catch(function () {}) : Promise.resolve();
    /* 5. the server's daily copy */
    var snap = (everSynced && navigator.onLine !== false) ? fetch('/cmd/api/vault?snaps=1', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        var list = (j && (j.snaps || j.items || j)) || [];
        if (!Array.isArray(list)) return;
        var dates = list.map(function (x) { return typeof x === 'string' ? x : x && x.date; }).filter(Boolean).sort();
        var newest = dates.pop(), age = newest ? (Date.now() - new Date(newest + 'T12:00').getTime()) / 864e5 : Infinity;
        checks.push({ id: 'snap', ok: age < 3 });
        if (age >= 3) bad('snap', newest ? 'The server’s newest daily copy is from ' + newest.split('-').reverse().join('.') + '.' : 'The server has no daily copies yet.', newest ? 'Serverens nyeste daglige kopi er fra ' + newest.split('-').reverse().join('.') + '.' : 'Serveren har ingen daglige kopier ennå.');
      }).catch(function () {}) : Promise.resolve();
    return Promise.all([snap, files, dev]).then(function () {
      var res = { t: Date.now(), d: dkey(new Date()), issues: issues, checks: checks };
      mark('check', res);
      if (issues.length && !manual) tell(issues);
      try { window.dispatchEvent(new Event('diag:log')); } catch (e) {}
      return res;
    });
  }
  function tell(issues) {
    var t = issues.length === 1 ? issues[0].t : L(issues.length + ' things need a look: ', issues.length + ' ting bør sjekkes: ') + issues.map(function (x) { return x.t.split('.')[0]; }).join(' · ');
    notice('check', t, L('Details', 'Detaljer'), openPanel, 'clipboard2-pulse');
    /* a phone notification too, when they're switched on – no titles or numbers */
    try {
      if (window.Notification && Notification.permission === 'granted' && navigator.serviceWorker && document.hidden)
        navigator.serviceWorker.ready.then(function (r) { r.showNotification(L('Dashboard check', 'Dashbord-sjekk'), { body: L('Something needs a look – open Settings → Diagnostics.', 'Noe bør sjekkes – åpne Innstillinger → Diagnostikk.'), tag: 'selfcheck', icon: '/cmd/assets/icons/icon-192.png' }); });
    } catch (e) {}
  }
  /* Diagnostics lives in Admin → System */
  function openPanel(what) {
    what = what === 'report' ? 'report' : 'system';
    if (/^\/cmd\/admin\//.test(location.pathname)) { try { window.dispatchEvent(new CustomEvent('admin:goto', { detail: what })); } catch (e) {} return; }
    location.href = '/cmd/admin/#' + what;
  }
  function startCheck() {
    var s = state(); if (s.check && s.check.d === dkey(new Date())) return;
    setTimeout(function () { if (window.Vault && window.Vault.get()) selfCheck(false); }, 9000);
  }
  function hook() { if (window.Vault && window.Vault.onUnlock) window.Vault.onUnlock(startCheck); else setTimeout(hook, 200); }
  hook();
  window.addEventListener('sync:state', function (e) { if (e.detail === 'ok') mark('syncOk'); mark('syncState', e.detail); });

  /* ---------- the Diagnostics page in Settings ---------- */
  function ago(t) {
    if (!t) return L('never', 'aldri');
    var m = Math.round((Date.now() - t) / 6e4);
    if (m < 1) return L('just now', 'akkurat nå');
    if (m < 60) return L(m + ' min ago', 'for ' + m + ' min siden');
    var h = Math.round(m / 60); if (h < 36) return L(h + ' h ago', 'for ' + h + ' t siden');
    return L(Math.round(h / 24) + ' days ago', 'for ' + Math.round(h / 24) + ' dager siden');
  }
  function swVersion() {
    if (!window.caches) return Promise.resolve('');
    return caches.keys().then(function (k) { return k.filter(function (x) { return /^cmd-v/.test(x); }).join(', '); }).catch(function () { return ''; });
  }
  function bundle() { var s = document.querySelector('script[src*="dist/tail.js"]'); var m = s && s.src.match(/v=(\w+)/); return m ? m[1] : ''; }
  function info() {
    var d = window.Vault && window.Vault.get && window.Vault.get(), s = state();
    var hl = d && d.health ? d.health.last : 0, hdays = d && d.health && d.health.days ? Object.keys(d.health.days).sort() : [];
    var V = window.Vault, st = V && V.syncState ? V.syncState() : s.syncState;
    return swVersion().then(function (sw) {
      return { sync: st || '–', syncOk: s.syncOk, healthLast: hl, healthDay: hdays[hdays.length - 1] || '', healthPull: s.healthPull, healthFail: s.healthFail,
        sw: sw || L('not installed', 'ikke installert'), bundle: bundle(), check: s.check, errs: readJSON(LOG, []) };
    });
  }
  function report() {
    return info().then(function (i) {
      var ua = navigator.userAgent, os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : 'other';
      var br = /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'other';
      var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
      var lines = ['Dashboard diagnostics ' + new Date().toISOString().slice(0, 16).replace('T', ' '),
        'App: ' + i.sw + ' · bundle ' + i.bundle + ' · page ' + page() + ' · ' + os + ' ' + br + (standalone ? ' (home screen app)' : '') + ' · ' + innerWidth + 'px',
        'Sync: ' + i.sync + ' · last OK ' + (i.syncOk ? new Date(i.syncOk).toISOString().slice(0, 16) : 'never') + ' · online ' + (navigator.onLine !== false),
        'Apple Health: last import ' + (i.healthLast ? new Date(i.healthLast).toISOString().slice(0, 16) : 'never') + ' · newest day ' + (i.healthDay || '–') + (i.healthFail ? ' · last failed fetch ' + new Date(i.healthFail).toISOString().slice(0, 16) : ''),
        'Self-check: ' + (i.check ? i.check.d + ' ' + (i.check.checks || []).map(function (c) { return c.id + (c.ok ? ' ok' : ' FAIL'); }).join(', ') : 'not run'),
        'Errors (' + i.errs.length + '):'];
      i.errs.slice().reverse().forEach(function (e) { lines.push('- ' + new Date(e.t).toISOString().slice(5, 16).replace('T', ' ') + ' ' + e.k + ' ' + e.p + ' ' + (e.a || '') + ' ×' + (e.n || 1) + ': ' + e.m); });
      return lines.join('\n');
    });
  }
  function render() {
    var box = document.getElementById('dgBody'); if (!box) return;
    info().then(function (i) {
      var syncTxt = { ok: L('Synced', 'Synkronisert'), busy: L('Syncing …', 'Synkroniserer …'), offline: L('Offline – saved on this device', 'Frakoblet – lagret på denne enheten'), off: L('Not syncing', 'Synkroniserer ikke') }[i.sync] || i.sync;
      var c = i.check, cTxt = c ? (c.issues.length ? c.issues.map(function (x) { return esc(x.t); }).join('<br>') : L('All good', 'Alt i orden')) : L('Not run yet', 'Ikke kjørt ennå');
      var row = function (ic, col, label, val, sub) { return '<div class="st-row dg-row"><span class="st-ico" style="--c:' + col + '"><i class="bi bi-' + ic + '"></i></span><span class="st-label">' + label + '<small>' + sub + '</small></span><span class="dg-val">' + val + '</span></div>'; };
      var errs = i.errs.slice().reverse();
      box.innerHTML =
        '<section class="st-group">' +
          row('cloud-check', '#11a597', L('Sync', 'Synkronisering'), esc(syncTxt), L('Last OK ', 'Sist OK ') + ago(i.syncOk)) +
          row('apple', '#e66767', L('Apple Health', 'Apple Helse'), i.healthDay ? esc(i.healthDay.split('-').reverse().slice(0, 2).join('.')) : '–', L('Last import ', 'Siste import ') + ago(i.healthLast) + (i.healthFail && (!i.healthPull || i.healthFail > i.healthPull) ? L(' · last fetch failed ', ' · siste henting feilet ') + ago(i.healthFail) : '')) +
          row('clipboard2-pulse', c && c.issues.length ? '#d95926' : '#22b35e', L('Daily self-check', 'Daglig sjekk'), c ? (c.issues.length ? '<b class="dg-bad">' + c.issues.length + '</b>' : '<i class="bi bi-check-lg dg-ok"></i>') : '–', cTxt + (c ? ' · ' + ago(c.t) : '')) +
          row('box-seam', '#8a6fdf', L('App version', 'App-versjon'), esc(i.sw.replace('cmd-', '')), L('Scripts ', 'Skript ') + esc(i.bundle)) +
        '</section>' +
        '<div class="dg-acts"><button type="button" class="pill-btn" id="dgCopy"><i class="bi bi-clipboard"></i> ' + L('Copy report', 'Kopier rapport') + '</button>' +
          '<button type="button" class="text-btn" id="dgRun"><i class="bi bi-arrow-repeat"></i> ' + L('Check now', 'Sjekk nå') + '</button></div>' +
        '<p class="st-sub ap-sub"><i class="bi bi-bug"></i> ' + L('Recent errors', 'Siste feil') + ' <span class="st-hint">' + L('On this device · numbers and names are masked', 'På denne enheten · tall og navn er skjult') + '</span></p>' +
        '<section class="st-group"><ul class="st-inv dg-errs">' + (errs.length ? errs.slice(0, 15).map(function (e) {
          return '<li><span class="dg-et">' + esc(new Date(e.t).toLocaleString(nb() ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + ' · ' + esc(e.p) + (e.n > 1 ? ' · ×' + e.n : '') + '</span><code>' + esc(e.m) + '</code>' + (e.a ? '<small>' + esc(e.a) + '</small>' : '') + '</li>';
        }).join('') : '<li class="muted">' + L('No errors. Nice.', 'Ingen feil. Fint.') + '</li>') + '</ul>' +
        (errs.length ? '<button type="button" class="st-row st-btn" id="dgClear"><span><i class="bi bi-trash3"></i> ' + L('Clear the log', 'Tøm loggen') + '</span></button>' : '') + '</section>' +
        '<p class="st-intro st-after">' + L('The report has no amounts, names or other personal data – just versions, times and error messages with numbers masked. Paste it to Claude when something isn’t right.', 'Rapporten har ingen beløp, navn eller andre personlige data – bare versjoner, tidspunkter og feilmeldinger med tall skjult. Lim den inn til Claude når noe ikke stemmer.') + '</p>';
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-go="diag"]')) setTimeout(render, 0);
    if (e.target.closest('#dgCopy')) {
      var b = e.target.closest('#dgCopy');
      report().then(function (t) {
        var done = function () { b.innerHTML = '<i class="bi bi-check-lg"></i> ' + L('Copied', 'Kopiert'); setTimeout(render, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { fallback(t); done(); }); else { fallback(t); done(); }
      });
    }
    if (e.target.closest('#dgRun')) { var r = e.target.closest('#dgRun'); r.disabled = true; selfCheck(true).then(render); }
    if (e.target.closest('#dgClear')) { writeJSON(LOG, []); render(); }
  });
  function fallback(t) { var a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); }
  window.addEventListener('diag:log', function () { var pg = document.querySelector('.st-page[data-page="diag"]'); if (pg && !pg.hidden) render(); });

  window.Diag = { log: log, list: function () { return readJSON(LOG, []); }, clear: function () { writeJSON(LOG, []); seen = {}; }, ver: ver, mark: mark, state: state,
    notice: notice, hide: hide, retry: retry, selfCheck: selfCheck, report: report, scrub: scrub, render: render,
    crumbs: function () { return crumbs.slice(); }, speed: function () { return readJSON(SPEED, {}); }, scanNow: scanNow, label: label, page: page, open: openPanel, netOk: function () { return netOk; } };
})();
