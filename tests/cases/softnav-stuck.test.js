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
  check(await p.evaluate(() => /timeout \/cmd\/habits\//.test(sessionStorage.getItem('softnav.err') || '')), 'it is noted for Diagnostics');
  await done(b);
})();
