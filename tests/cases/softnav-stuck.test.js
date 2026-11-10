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
