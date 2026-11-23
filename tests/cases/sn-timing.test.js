/* Each page change is timed by its steps (2026-11-23, to find the stutter in the iPhone app): the numbers land in
   dash.sntime and in the Diagnostics copy. */
const { open, sl, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await go(p, '', 2500); await sl(4500);
  for (const k of ['calendar', 'travel']) {
    await p.evaluate(k => { const a = [...document.querySelectorAll('a[href]')].find(x => new URL(x.href).pathname === '/cmd/' + k + '/'); a.click(); }, k);
    await until(p, k => location.pathname === '/cmd/' + k + '/', 8000, k); await sl(1500);
  }
  const t = await p.evaluate(() => JSON.parse(localStorage.getItem('dash.sntime') || '[]'));
  check(t.length >= 2 && t[0].p === 'travel' && t[1].p === 'calendar', 'both changes are timed ' + JSON.stringify(t.slice(0, 2)));
  check(t.every(x => x.all >= x.page + x.swap + x.scripts && x.freeze >= 0), 'the steps add up');
  const txt = await p.evaluate(() => { const D = window.DiagUI || window.Diag; return D && D.copyText ? D.copyText() : ''; });
  if (txt) check(/Page changes \(newest first/.test(txt), 'the Diagnostics copy lists them');
  await done(b);
})();
