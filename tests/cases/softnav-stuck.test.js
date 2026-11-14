/* A page change can never leave you stuck (2026-11-10: on a Mac, tapping Health highlighted it but the page never came):
   if the new page's scripts never finish, after 6 s it loads the page normally and notes it in Diagnostics. Made-up data only. */
const { open, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await sl(1200);
  await p.evaluate(() => { window.__same = 1; });
  /* the next page's own script never finishes loading (a hanging network) */
  await p.evaluate(() => { const ap = Element.prototype.appendChild; Element.prototype.appendChild = function (n) { if (n && n.tagName === 'SCRIPT' && /page-habits/.test(n.src || '')) return n; return ap.call(this, n); }; });
  await p.evaluate(() => { const a = [...document.querySelectorAll('a[href]')].find(a => a.offsetWidth && new URL(a.href).pathname === '/cmd/habits/'); a.click(); });
  await sl(2500);
  check(await p.evaluate(() => window.__same === 1), 'the page change starts softly (nothing reloads yet)');
  const loaded = await until(p, () => location.pathname === '/cmd/habits/' && window.__same !== 1, 12000);
  check(loaded !== null, 'after a few seconds Health loads normally instead of staying stuck');
  check(await p.evaluate(() => /\/cmd\/habits\/ took too long.*stuck at: script page-habits\.js/.test(sessionStorage.getItem('softnav.err') || '')), 'it is noted for Diagnostics, with the step it was stuck at: ' + await p.evaluate(() => sessionStorage.getItem('softnav.err')));

  /* a new version on the server: the page loads normally, and a slow normal load is not a failed page change (14 Nov 2026:
     Windows Firefox took over 6 s, it was counted as a failure five times and instant page changes were paused there) */
  {
    const { launch, unlock, U } = require('../lib/browser');
    const b4 = await launch(), v = await b4.newPage(); v.errs = [];
    await v.setViewport({ width: 1280, height: 900 });
    await v.setBypassServiceWorker(true); await v.setRequestInterception(true);
    v.on('request', async r => {
      const u = r.url(); if (!u.startsWith('http://localhost')) return r.abort();
      if (/\/cmd\/goals\/(\?.*)?$/.test(u) && r.resourceType() === 'fetch') {
        const html = await (await fetch(u)).text();
        return r.respond({ status: 200, contentType: 'text/html', body: html.replace(/dist\/head\.js\?v=[^"]+/, 'dist/head.js?v=newversion') });
      }
      if (/\/cmd\/goals\/(\?.*)?$/.test(u) && r.resourceType() === 'document') await sl(7500);
      r.continue();
    });
    await v.goto(U); await sl(1500); await unlock(v); await sl(800);
    await v.evaluate(() => { sessionStorage.removeItem('softnav.err'); const a = [...document.querySelectorAll('a[href]')].find(a => a.offsetWidth && new URL(a.href).pathname === '/cmd/goals/'); a.click(); });
    const got = await until(v, () => location.pathname === '/cmd/goals/' && !!document.querySelector('main'), 20000);
    await sl(1500);
    const nv = await v.evaluate(() => ({ err: sessionStorage.getItem('softnav.err') || '', diag: (window.Diag ? Diag.list() : []).filter(x => x.k === 'softnav').map(x => x.m).join(' | '), paused: (localStorage.getItem('dash.snpause') || '') + (JSON.parse(localStorage.getItem('dash.snfail') || '[]').length ? 'fail' : '') }));
    check(got !== null && !nv.err && !nv.diag && !nv.paused, 'a new version loads normally and a slow load is not counted as a failed page change ' + JSON.stringify(nv));
    await b4.close();
  }

  /* Safari has built-in objects on window that can't be changed; leaving a page must not trip over them */
  const { b: b3, p: r } = await open(1280);
  await r.evaluateOnNewDocument(() => { const ro = {}; Object.defineProperty(ro, 'pushNotification', { value: 1, writable: false, enumerable: true }); Object.preventExtensions(ro); window.safari = ro; window.__frozenList = Object.freeze([1, 2]); });
  await r.reload(); await sl(2500);
  await r.evaluate(() => { window.__same = 1; sessionStorage.removeItem('softnav.err'); });
  await r.evaluate(() => { const a = [...document.querySelectorAll('a[href]')].find(a => a.offsetWidth && new URL(a.href).pathname === '/cmd/finance/'); a.click(); });
  await until(r, () => location.pathname === '/cmd/finance/' && window.SoftNav.count > 0, 6000);
  const ro = await r.evaluate(() => ({ same: window.__same === 1, err: sessionStorage.getItem('softnav.err') || '', diag: (window.Diag ? Diag.list() : []).filter(x => x.k === 'softnav').map(x => x.m).join(' | ') }));
  check(ro.same && !ro.err && !ro.diag, 'read-only objects like Safari’s don’t break leaving a page ' + JSON.stringify(ro));
  await b3.close();

  /* Safari: pages switch without the glide (with it, they never finished on a Mac) – and quickly, without reloading */
  const { b: b2, p: s } = await open(1280);
  await s.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0.1 Safari/605.1.15');
  await s.reload(); await sl(2500);
  await s.evaluate(() => { window.__same = 1; document.startViewTransition = function () { throw new Error('glide used on Safari'); }; });
  const t0 = Date.now();
  await s.evaluate(() => { const a = [...document.querySelectorAll('a[href]')].find(a => a.offsetWidth && new URL(a.href).pathname === '/cmd/finance/'); a.click(); });
  const ok = await until(s, () => location.pathname === '/cmd/finance/' && window.SoftNav.count > 0, 6000);
  check(ok !== null && await s.evaluate(() => window.__same === 1) && Date.now() - t0 < 5000, 'Safari: Finances opens softly without the glide, in ' + (Date.now() - t0) + ' ms');
  check(!s.errs.length, 'no errors on Safari ' + s.errs.join(' | ').slice(0, 200));
  await done(b, b2);
})();
